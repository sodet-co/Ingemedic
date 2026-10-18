'use client'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { FileText, Download, Loader2, Eye, PencilLine, AlertCircle } from 'lucide-react'
import { createClient } from '@/lib/supabase'
import { formatear } from '@/lib/fechas'
import { descargarActasPDF } from '@/lib/actas/pdf'
import { cargarParaFirma } from '@/lib/actas/firmar'
import { construirContexto, conManuales } from '@/lib/actas/contexto'
import PreviaActas from './PreviaActas'
import LlenarFormatos, { VentanaLlenarFormatos } from './LlenarFormatos'
import { leerDatosActa, camposPedidos, camposVacios } from '@/lib/actas/campos'
import { ui } from '@/lib/ui'

const CAMPOS_PACIENTE = ['cedula', 'tipo_documento', 'direccion', 'barrio', 'ciudad', 'telefono', 'correo', 'eps', 'fecha_nacimiento']

// Actas de un préstamo (detalle de Préstamos / Entregas).
//  - Firmadas (entregas a domicilio): se listan y se descargan en un solo PDF.
//  - Sin firmar (préstamos en oficina: el paciente no está ahí para firmar): se
//    listan los formatos que se relacionaron al crear el préstamo y se descargan
//    llenos con los datos del préstamo y las firmas en blanco. "Llenar datos"
//    se llenan mirando la hoja (LlenarFormatos) y se guarda en el préstamo.
export default function ActasPrestamo({ ordenId, ordenCodigo, onToast }) {
  const supabase = useMemo(() => createClient(), [])
  const [actas, setActas] = useState(null)
  const [formatos, setFormatos] = useState([])
  const [descargando, setDescargando] = useState(false)
  const [previa, setPrevia] = useState(null)   // { filas, inicial } con la vista previa abierta
  const [preparando, setPreparando] = useState(false)
  const [base, setBase] = useState(null)       // préstamo y formatos sin firmar (cargarParaFirma)
  const [editar, setEditar] = useState(null)   // { paciente, diagnostico, acta } mientras se llenan los datos
  const [guardando, setGuardando] = useState(false)

  const cargar = useCallback(async () => {
    const [{ data: firmadas }, { data: orden }] = await Promise.all([
      supabase.from('actas').select('id, nombre, fecha_firma, bloques, datos, firma_recibe, firma_entrega')
        .eq('orden_id', ordenId).order('fecha_firma'),
      supabase.from('ordenes_servicio').select('plantillas_acta').eq('id', ordenId).single(),
    ])
    setActas(firmadas || [])
    if (!firmadas?.length && orden?.plantillas_acta?.length) {
      try {
        const b = await cargarParaFirma(supabase, ordenId)
        setBase(b)
        setFormatos(b.plantillas)
      } catch { setFormatos([]) }
    } else setFormatos([])
  }, [supabase, ordenId])

  useEffect(() => { const t = setTimeout(cargar, 0); return () => clearTimeout(t) }, [cargar])

  // Filas listas para pintar: las firmadas tal cual; los formatos sin firmar se
  // llenan con lo que ya se sabe del préstamo y las firmas en blanco
  async function filasParaPintar() {
    if (actas.length) return actas
    const ctx = construirContexto({
      empresa: base.empresa, orden: base.orden, equipos: base.equipos,
      datos: leerDatosActa(base.orden.datos_acta), firmas: {},
    })
    return base.plantillas.map(p => ({ id: p.id, nombre: p.nombre, bloques: p.bloques, datos: conManuales(ctx, p.id), firma_recibe: null, firma_entrega: null }))
  }

  async function ver(i = 0) {
    setPreparando(true)
    try { setPrevia({ filas: previa?.filas || await filasParaPintar(), inicial: i }) }
    catch (e) { onToast?.('No se pudo abrir la vista previa: ' + e.message, 'error') }
    finally { setPreparando(false) }
  }

  async function descargar(filas) {
    setDescargando(true)
    try {
      const f = filas || await filasParaPintar()
      await descargarActasPDF(f, `${actas.length ? 'Actas' : 'Formatos'}_${ordenCodigo || 'prestamo'}.pdf`)
    } catch (e) { onToast?.('No se pudo generar el PDF: ' + e.message, 'error') }
    finally { setDescargando(false) }
  }

  // Datos que faltan en los formatos sin firmar
  const pedidos = useMemo(() => base ? camposPedidos(base.plantillas, { conPaciente: !!base.orden.paciente }) : null, [base])
  const faltan = base && pedidos
    ? camposVacios(pedidos.campos, { paciente: base.orden.paciente || {}, diagnostico: base.orden.diagnostico, acta: leerDatosActa(base.orden.datos_acta) }).length
    : 0

  const baseFormatos = useMemo(() => base && ({ empresa: base.empresa, orden: base.orden, equipos: base.equipos }), [base])

  function abrirEditar() {
    setEditar({ paciente: { ...(base.orden.paciente || {}) }, diagnostico: base.orden.diagnostico || '', acta: leerDatosActa(base.orden.datos_acta) })
  }

  async function guardarDatos() {
    setGuardando(true)
    const pac = base.orden.paciente
    if (pac?.id) {
      const cambios = Object.fromEntries(CAMPOS_PACIENTE.filter(k => (editar.paciente[k] || null) !== (pac[k] || null)).map(k => [k, editar.paciente[k] || null]))
      if (Object.keys(cambios).length) {
        const { error } = await supabase.from('pacientes').update(cambios).eq('id', pac.id)
        if (error) {
          onToast?.(error.code === '23505' ? 'Esa cédula ya está registrada en otro paciente' : 'No se guardó el paciente: ' + error.message, 'error')
          setGuardando(false); return
        }
      }
    }
    const { error } = await supabase.from('ordenes_servicio').update({ diagnostico: editar.diagnostico || null, datos_acta: editar.acta }).eq('id', ordenId)
    setGuardando(false)
    if (error) { onToast?.('No se guardaron los datos: ' + error.message, 'error'); return }
    setEditar(null)
    onToast?.('Datos guardados')
    cargar()
  }

  if (actas === null) return <div className="flex items-center gap-2 text-[12.5px] text-slate-400"><Loader2 size={13} className="animate-spin" /> Cargando actas…</div>

  const firmadas = actas.length > 0
  const lista = firmadas ? actas : formatos
  return (
    <div>
      {lista.length === 0 ? (
        <div className="text-[12.5px] text-slate-400">Sin formatos relacionados.</div>
      ) : (
        <>
          {!firmadas && (
            <div className="flex items-center gap-2 mb-2 text-[11.5px]">
              <span className="text-slate-400">Sin firmar</span>
              {pedidos && (faltan > 0
                ? <span className="inline-flex items-center gap-1 text-[#B45309] font-semibold"><AlertCircle size={12} /> Faltan {faltan} {faltan === 1 ? 'dato' : 'datos'}</span>
                : <span className="text-[#0F7B55] font-semibold">Datos completos</span>)}
            </div>
          )}
          <div className="space-y-1.5">
            {lista.map((a, i) => (
              <div key={a.id} className="flex items-center gap-2 text-[13px] text-slate-700">
                <FileText size={13} className={`flex-shrink-0 ${firmadas ? 'text-[#D81B43]' : 'text-slate-400'}`} />
                <button type="button" onClick={() => ver(i)} disabled={preparando}
                  className="flex-1 min-w-0 truncate text-left hover:text-[#1B3A6B] hover:underline">{a.nombre}</button>
                {firmadas
                  ? <span className="text-[11px] text-slate-400 flex-shrink-0">{formatear(a.fecha_firma, { year: undefined })}</span>
                  : <span className="text-[11px] text-slate-400 flex-shrink-0">Pendiente</span>}
              </div>
            ))}
          </div>
        </>
      )}
      {lista.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-2">
          {!firmadas && base && (
            <button onClick={abrirEditar}
              className="flex items-center gap-1.5 px-3 py-2 bg-white border border-slate-200 text-slate-700 rounded-[8px] text-[12.5px] font-semibold hover:border-slate-300">
              <PencilLine size={13} /> Llenar datos
            </button>
          )}
          <button onClick={() => ver(0)} disabled={preparando}
            className="flex items-center gap-1.5 px-3 py-2 bg-white border border-slate-200 text-slate-700 rounded-[8px] text-[12.5px] font-semibold hover:border-slate-300 disabled:opacity-60">
            {preparando ? <Loader2 size={13} className="animate-spin" /> : <Eye size={13} />}
            {firmadas ? 'Ver actas' : 'Ver formatos'}
          </button>
          <button onClick={() => descargar()} disabled={descargando}
            className="flex items-center gap-1.5 px-3 py-2 bg-[#1B3A6B] text-white rounded-[8px] text-[12.5px] font-semibold hover:bg-[#152D54] disabled:opacity-60">
            {descargando ? <Loader2 size={13} className="animate-spin" /> : <Download size={13} />}
            {descargando ? 'Generando PDF…' : 'Descargar PDF'}
          </button>
        </div>
      )}
      {editar && (
        <VentanaLlenarFormatos subtitulo={ordenCodigo} onCerrar={() => setEditar(null)} bloqueado={guardando}
          pie={<>
            <button onClick={() => setEditar(null)} disabled={guardando} className={ui.btnSecundario}>Cancelar</button>
            <button onClick={guardarDatos} disabled={guardando} className={ui.btnPrimario}>{guardando ? 'Guardando…' : 'Guardar'}</button>
          </>}>
          <LlenarFormatos plantillas={base.plantillas} valores={editar} conPaciente={!!base.orden.paciente} nombrePaciente={base.orden.paciente?.nombre}
            base={baseFormatos}
            onPaciente={(k, v) => setEditar(x => ({ ...x, paciente: { ...x.paciente, [k]: v } }))}
            onDiagnostico={v => setEditar(x => ({ ...x, diagnostico: v }))}
            onActa={v => setEditar(x => ({ ...x, acta: v }))} />
        </VentanaLlenarFormatos>
      )}
      {previa && (
        <PreviaActas actas={previa.filas} inicial={previa.inicial}
          titulo={`${firmadas ? 'Actas' : 'Formatos sin firmar'} · ${ordenCodigo || 'préstamo'}`}
          descargando={descargando} onDescargar={() => descargar(previa.filas)} onCerrar={() => setPrevia(null)} />
      )}
    </div>
  )
}
