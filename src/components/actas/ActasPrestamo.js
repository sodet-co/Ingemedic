'use client'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { FileText, Download, Loader2, Eye, PencilLine, AlertCircle, PenLine, CheckCircle2, RefreshCw } from 'lucide-react'
import { createClient } from '@/lib/supabase'
import { formatear, formatearSoloFecha } from '@/lib/fechas'
import { cargarParaFirma, SELECT_PLANTILLAS } from '@/lib/actas/firmar'
import { accionDeEntrega, equiposDelActa, formatosDeVisita, nombreVisita } from '@/lib/accionesPrestamo'
import FirmaActas from './FirmaActas'
import { construirContexto, paraPlantilla, esRenovable } from '@/lib/actas/contexto'
import PreviaActas from './PreviaActas'
import DescargarActas from './DescargarActas'
import RenovarActa from './RenovarActa'
import LlenarFormatos, { VentanaLlenarFormatos } from './LlenarFormatos'
import { leerDatosActa, camposPedidos, camposVacios } from '@/lib/actas/campos'
import { ui } from '@/lib/ui'
import { sugeridasDe } from '@/lib/actas/acciones'

const CAMPOS_PACIENTE = ['cedula', 'tipo_documento', 'direccion', 'barrio', 'ciudad', 'telefono', 'correo', 'eps', 'fecha_nacimiento']

// Todas las actas de un préstamo en un solo lugar (detalle de Préstamos / Entregas),
// firmadas o no, agrupadas por lo que pasó:
//  - Préstamo: las firmadas de la entrega, o los formatos que se relacionaron al
//    crearlo, llenos con sus datos y sin firmas ("Llenar datos" los completa).
//  - Cada recogida, cambio y recarga, con sus actas. Hoy siempre se guardan (sin
//    firmas si no se firmó en el momento); las de antes que no tienen se muestran
//    llenas con lo que hay. "Firmar" las firma y reemplaza la que no tenía firmas.
//    Una recarga tiene dos: el acta de cambio de equipo y la de recarga.
// onCambio: después de renovar (el historial del préstamo se vuelve a leer)
// completa: la pestaña Actas del préstamo (filas grandes, renovaciones bajo su acta);
// sin ella, la lista corta del resumen
export default function ActasPrestamo({ ordenId, ordenCodigo, onToast, onCambio, completa = false }) {
  const supabase = useMemo(() => createClient(), [])
  const [actas, setActas] = useState(null)
  const [formatos, setFormatos] = useState([])
  const [visitas, setVisitas] = useState([])     // [{ visita, plantillas }] recogidas, cambios y recargas hechas
  const [previa, setPrevia] = useState(null)     // { filas, inicial } con la vista previa abierta
  const [base, setBase] = useState(null)         // préstamo (y sus formatos sin firmar): cargarParaFirma
  const [editar, setEditar] = useState(null)     // { paciente, diagnostico, acta } mientras se llenan los datos
  const [guardando, setGuardando] = useState(false)
  const [firmando, setFirmando] = useState(null) // { visita, plantillas, tieneActa }
  const [renovables, setRenovables] = useState(new Set()) // plantillas marcadas Renovable (hoy)
  const [renovando, setRenovando] = useState(null)     // acta firmada que se renueva

  const cargar = useCallback(async () => {
    const [{ data: guardadas }, { data: orden }, { data: hechas }] = await Promise.all([
      supabase.from('actas').select('id, nombre, accion, entrega_id, plantilla_id, fecha_firma, bloques, datos, firma_recibe, firma_entrega')
        .eq('orden_id', ordenId).order('fecha_firma'),
      supabase.from('ordenes_servicio').select('plantillas_acta, cliente_id').eq('id', ordenId).single(),
      supabase.from('entregas').select('id, tipo, modo, datos, recibido_por, fecha_completada, estado:estados_entrega(nombre)')
        .eq('orden_id', ordenId).neq('tipo', 'entrega').order('fecha_completada'),
    ])
    setActas(guardadas || [])
    // ¿Cuáles se renuevan? Las de plantillas marcadas Renovable (también si se marcó después de firmar)
    const ids = [...new Set((guardadas || []).map(a => a.plantilla_id).filter(Boolean))]
    if (ids.length) supabase.from('plantillas_acta').select('id, bloques').in('id', ids)
      .then(({ data }) => setRenovables(new Set((data || []).filter(p => esRenovable(p.bloques)).map(p => p.id))))
    const completadas = (hechas || []).filter(v => v.estado?.nombre === 'Completada')
    const faltan = completadas.some(v => !(guardadas || []).some(a => a.entrega_id === v.id && a.firma_recibe))
    const { data: plantillas } = faltan ? await supabase.from('plantillas_acta').select(SELECT_PLANTILLAS).eq('activo', true) : { data: [] }
    setVisitas(completadas.map(v => ({
      visita: v,
      plantillas: sugeridasDe(plantillas || [], orden?.cliente_id, formatosDeVisita(v)).map(id => plantillas.find(p => p.id === id)).filter(Boolean),
    })))
    const delPrestamo = (guardadas || []).filter(a => (a.accion || 'prestamo') === 'prestamo')
    try {
      // El préstamo y la empresa hacen falta para pintar lo que no tiene acta guardada
      const b = await cargarParaFirma(supabase, ordenId, delPrestamo.length || !orden?.plantillas_acta?.length ? { plantillaIds: [] } : undefined)
      setBase(b)
      setFormatos(delPrestamo.length ? [] : b.plantillas)
    } catch { setFormatos([]) }
  }, [supabase, ordenId])

  useEffect(() => { const t = setTimeout(cargar, 0); return () => clearTimeout(t) }, [cargar])

  // ── Grupos: el préstamo y cada visita, con sus filas listas para pintar ──
  const grupos = useMemo(() => {
    if (actas === null) return []
    // Las renovaciones van en su propio grupo, no con el acta que renuevan
    const renovaciones = actas.filter(a => a.accion === 'renovacion')
    const propias = actas.filter(a => a.accion !== 'renovacion')
    const sinFirmas = (ctx, plantillas, prefijo) => plantillas.map(p => ({ id: `${prefijo}-${p.id}`, plantilla_id: p.id, nombre: p.nombre, bloques: p.bloques, datos: paraPlantilla(ctx, p), firma_recibe: null, firma_entrega: null }))
    const g = []
    const delPrestamo = propias.filter(a => (a.accion || 'prestamo') === 'prestamo')
    if (delPrestamo.length) g.push({ clave: 'prestamo', titulo: 'Préstamo', fecha: delPrestamo[0].fecha_firma, filas: delPrestamo, guardadas: true })
    else if (formatos.length && base) {
      const ctx = construirContexto({ empresa: base.empresa, orden: base.orden, equipos: base.equipos, datos: leerDatosActa(base.orden.datos_acta), firmas: {} })
      g.push({ clave: 'prestamo', titulo: 'Préstamo', fecha: null, filas: sinFirmas(ctx, formatos, 'p'), guardadas: false })
    }
    for (const { visita: v, plantillas } of visitas) {
      const suyas = propias.filter(a => a.entrega_id === v.id)
      let filas = suyas
      if (!suyas.length && base) {
        const { equipos, retirados } = equiposDelActa(accionDeEntrega(v), v.datos || {})
        const ctx = construirContexto({ empresa: base.empresa, orden: base.orden, equipos, retirados,
          datos: { ...leerDatosActa(v.datos?.datos_acta), motivo: v.datos?.motivo, fecha: v.fecha_completada }, firmas: {} })
        filas = sinFirmas(ctx, plantillas, v.id)
      }
      g.push({ clave: v.id, titulo: nombreVisita(v), fecha: v.fecha_completada, modo: v.modo, filas, guardadas: suyas.length > 0, visita: v, plantillas })
    }
    // Actas de una acción cuya visita ya no está (por si acaso): no se pierden
    const huerfanas = propias.filter(a => (a.accion || 'prestamo') !== 'prestamo' && !visitas.some(x => x.visita.id === a.entrega_id))
    if (huerfanas.length) g.push({ clave: 'otras', titulo: 'Otras actas', fecha: null, filas: huerfanas, guardadas: true })
    if (renovaciones.length) g.push({ clave: 'renovaciones', titulo: 'Renovaciones', fecha: null, guardadas: true,
      filas: renovaciones.map(a => ({ ...a, detalle: a.datos?.renovacion?.fecha ? formatearSoloFecha(a.datos.renovacion.fecha) : null })) })
    return g
  }, [actas, formatos, base, visitas])

  const todas = useMemo(() => grupos.flatMap(g => g.filas), [grupos])

  function ver(id) {
    const i = Math.max(0, todas.findIndex(f => f.id === id))
    setPrevia({ filas: todas, inicial: i })
  }

  const nombreArchivo = `Actas_${ordenCodigo || 'prestamo'}`
  const error = msg => onToast?.(msg, 'error')

  // Datos que faltan en los formatos del préstamo sin firmar
  const pedidos = useMemo(() => base && formatos.length ? camposPedidos(formatos, { conPaciente: !!base.orden.paciente }) : null, [base, formatos])
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
  if (!grupos.length) return <div className="text-[12.5px] text-slate-400">Sin actas todavía.</div>

  const nFirmadas = todas.filter(f => f.firma_recibe).length
  // Renovable: lo dice la copia del acta o su plantilla de hoy (Configuración → Renovable)
  const esDeRenovable = f => esRenovable(f.bloques) || renovables.has(f.plantilla_id)
  // Renovaciones de un acta (las que salen de ella), en el orden en que se hicieron
  const renovaciones = (actas || []).filter(a => a.accion === 'renovacion')
  const renovacionesDe = f => renovaciones.filter(r => r.datos?.renovacion?.de === f.id)
  const huerfanasRenov = renovaciones.filter(r => !todas.some(f => f.id === r.datos?.renovacion?.de))
  return (
    <div>
      {completa ? (<>
      {/* Pestaña Actas: cada acta en su fila, con su estado, si se renueva, sus botones y,
          debajo, sus renovaciones */}
      <div className="flex flex-wrap items-center gap-3 mb-4">
        <div className="flex items-center gap-2 text-[12.5px]">
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-50 text-[#0F7B55] font-semibold"><CheckCircle2 size={13} /> {nFirmadas} firmada{nFirmadas !== 1 ? 's' : ''}</span>
          {todas.length - nFirmadas > 0 && <span className="px-2.5 py-1 rounded-full bg-amber-50 text-[#B45309] font-semibold">{todas.length - nFirmadas} sin firmas</span>}
        </div>
        <div className="ml-auto flex flex-wrap gap-2">
          <button onClick={() => ver(todas[0]?.id)} disabled={!todas.length} className={ui.btnSecundario}><Eye size={14} /> Ver todas</button>
          <DescargarActas actas={todas} nombre={nombreArchivo} onError={error} className={ui.btnAzul}>
            {ocupado => <>{ocupado ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />} {ocupado ? 'Generando…' : 'Descargar'}</>}
          </DescargarActas>
        </div>
      </div>
      <div className="space-y-5">
        {grupos.filter(g => g.clave !== 'renovaciones').map(g => {
          const firmada = g.filas.length > 0 && g.filas.every(f => f.firma_recibe)
          return (
            <section key={g.clave}>
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1 mb-2">
                <span className="text-[10.5px] font-bold uppercase tracking-[0.1em] text-slate-400">{g.titulo}</span>
                {g.fecha && <span className="text-[12px] text-slate-400">{formatear(g.fecha, { year: undefined })}{g.modo === 'oficina' ? ' · oficina' : g.modo === 'domicilio' ? ' · domicilio' : ''}</span>}
                <span className="ml-auto flex items-center gap-3">
                  {g.clave === 'prestamo' && !g.guardadas && base && (
                    <button type="button" onClick={abrirEditar} className="inline-flex items-center gap-1 text-[12.5px] font-semibold text-[#1B3A6B] hover:underline"><PencilLine size={13} /> Llenar datos</button>
                  )}
                  {g.visita && !firmada && g.plantillas.length > 0 && (
                    <button type="button" onClick={() => setFirmando({ visita: g.visita, plantillas: g.plantillas, tieneActa: g.guardadas })}
                      className="inline-flex items-center gap-1 text-[12.5px] font-semibold text-[#D81B43] hover:underline"><PenLine size={13} /> Firmar</button>
                  )}
                </span>
              </div>
              {g.clave === 'prestamo' && !g.guardadas && pedidos && faltan > 0 && (
                <div className="mb-2 text-[12px] text-[#B45309] inline-flex items-center gap-1"><AlertCircle size={12} /> Faltan {faltan} {faltan === 1 ? 'dato' : 'datos'} por llenar</div>
              )}
              {!g.filas.length && <div className="text-[12.5px] text-slate-400">No hay formatos para esta acción (Configuración → Plantillas).</div>}
              <div className="space-y-2">
                {g.filas.map(f => {
                  const renovable = esDeRenovable(f)
                  const suyas = renovacionesDe(f)
                  return (
                    <div key={f.id} className="rounded-xl border border-slate-200 bg-white">
                      <div className="flex items-center gap-3 px-3 py-2.5">
                        <div className={`w-9 h-9 rounded-[9px] flex items-center justify-center flex-shrink-0 ${f.firma_recibe ? 'bg-[#D81B43]/10 text-[#D81B43]' : 'bg-slate-100 text-slate-400'}`}><FileText size={17} /></div>
                        <div className="min-w-0 flex-1">
                          <button type="button" onClick={() => ver(f.id)} className="block max-w-full text-left text-[13.5px] font-semibold text-slate-800 hover:text-[#1B3A6B] hover:underline truncate">{f.nombre}</button>
                          <div className="flex flex-wrap items-center gap-1.5 mt-0.5">
                            {f.firma_recibe
                              ? <span className="inline-flex items-center gap-1 text-[11.5px] font-semibold text-[#0F7B55]"><CheckCircle2 size={12} /> Firmada{f.fecha_firma ? ` · ${formatear(f.fecha_firma, { year: undefined })}` : ''}</span>
                              : <span className="text-[11.5px] font-semibold text-[#B45309]">Sin firmas</span>}
                            {renovable && <span className="px-2 py-px rounded-full bg-[#F5F3FF] text-[11px] font-semibold text-[#6D28D9]">Renovable</span>}
                            {renovable && !f.firma_recibe && <span className="text-[11.5px] text-slate-400">· fírmala para poder renovarla</span>}
                          </div>
                        </div>
                        <div className="flex items-center gap-1 flex-shrink-0">
                          {renovable && f.firma_recibe && g.guardadas && (
                            <button type="button" onClick={() => setRenovando(suyas.length ? suyas[suyas.length - 1] : f)}
                              className="inline-flex items-center gap-1.5 h-8 px-3 rounded-[8px] bg-[#6D28D9] text-white text-[12.5px] font-semibold hover:bg-[#5B21B6]">
                              <RefreshCw size={13} /> Renovar
                            </button>
                          )}
                          <button type="button" onClick={() => ver(f.id)} aria-label="Ver acta" title="Ver" className={ui.btnIcono}><Eye size={15} /></button>
                          <DescargarActas actas={[f]} nombre={`${nombreArchivo}_${(f.nombre || 'acta').replace(/[^\w]+/g, '_')}`} onError={error} etiqueta="Descargar esta acta" className={ui.btnIcono}>
                            {ocupado => ocupado ? <Loader2 size={15} className="animate-spin" /> : <Download size={15} />}
                          </DescargarActas>
                        </div>
                      </div>
                      {/* Renovaciones de esta acta, de la más nueva a la más vieja */}
                      {suyas.length > 0 && (
                        <div className="border-t border-slate-100 px-3 py-2 bg-[#F5F3FF]/40 rounded-b-xl">
                          <div className="text-[11px] font-semibold text-[#6D28D9] mb-1">Renovaciones ({suyas.length})</div>
                          {[...suyas].reverse().map(r => (
                            <div key={r.id} className="flex items-center gap-2 py-0.5 text-[12.5px] text-slate-600">
                              <RefreshCw size={12} className="text-[#6D28D9] flex-shrink-0" />
                              <span className="flex-1 min-w-0 truncate">Renovada para el {r.datos?.renovacion?.fecha ? formatearSoloFecha(r.datos.renovacion.fecha) : '—'}</span>
                              <button type="button" onClick={() => ver(r.id)} className="text-[12px] font-semibold text-[#1B3A6B] hover:underline flex-shrink-0">Ver</button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </section>
          )
        })}
        {/* Renovaciones cuya acta original ya no está en la lista (por si acaso): no se pierden */}
        {huerfanasRenov.length > 0 && (
          <section>
            <div className="text-[10.5px] font-bold uppercase tracking-[0.1em] text-slate-400 mb-2">Otras renovaciones</div>
            {huerfanasRenov.map(r => (
              <button key={r.id} type="button" onClick={() => ver(r.id)} className="w-full flex items-center gap-2 py-1 text-left text-[13px] text-slate-700 hover:text-[#1B3A6B]">
                <RefreshCw size={13} className="text-[#6D28D9]" /> {r.nombre} · {r.datos?.renovacion?.fecha ? formatearSoloFecha(r.datos.renovacion.fecha) : ''}
              </button>
            ))}
          </section>
        )}
      </div>
      </>) : (<>
      <div className="text-[11.5px] text-slate-400 mb-2">
        {todas.length} {todas.length === 1 ? 'acta' : 'actas'} · {nFirmadas} firmada{nFirmadas !== 1 ? 's' : ''}{todas.length - nFirmadas > 0 && <span className="text-[#B45309] font-semibold"> · {todas.length - nFirmadas} sin firmas</span>}
      </div>
      <div className="rounded-[10px] border border-slate-200 divide-y divide-slate-100">
        {grupos.map(g => {
          const firmada = g.filas.length > 0 && g.filas.every(f => f.firma_recibe)
          return (
            <div key={g.clave} className="px-3 py-2.5">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-[12.5px] font-bold text-slate-700">{g.titulo}</span>
                {g.fecha && <span className="text-[11.5px] text-slate-400">· {formatear(g.fecha, { year: undefined })}{g.modo === 'oficina' ? ' · oficina' : g.modo === 'domicilio' ? ' · domicilio' : ''}</span>}
                <span className="ml-auto flex items-center gap-2 flex-shrink-0">
                  {firmada
                    ? <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#0F7B55]"><CheckCircle2 size={12} /> Firmada</span>
                    : <span className="text-[11px] font-semibold text-[#B45309]">Sin firmas</span>}
                  {g.clave === 'prestamo' && !g.guardadas && base && (
                    <button type="button" onClick={abrirEditar} className="inline-flex items-center gap-1 text-[12px] font-semibold text-[#1B3A6B] hover:underline">
                      <PencilLine size={12} /> Llenar datos
                    </button>
                  )}
                  {g.visita && !firmada && g.plantillas.length > 0 && (
                    <button type="button" onClick={() => setFirmando({ visita: g.visita, plantillas: g.plantillas, tieneActa: g.guardadas })}
                      className="inline-flex items-center gap-1 text-[12px] font-semibold text-[#D81B43] hover:underline">
                      <PenLine size={12} /> Firmar
                    </button>
                  )}
                </span>
              </div>
              {g.clave === 'prestamo' && !g.guardadas && pedidos && faltan > 0 && (
                <div className="text-[11.5px] text-[#B45309] mb-1 inline-flex items-center gap-1"><AlertCircle size={11} /> Faltan {faltan} {faltan === 1 ? 'dato' : 'datos'}</div>
              )}
              {g.filas.length ? g.filas.map(f => (
                <div key={f.id} className="flex items-center gap-2">
                  <button type="button" onClick={() => ver(f.id)}
                    className="flex-1 min-w-0 flex items-center gap-2 py-0.5 text-left text-[13px] text-slate-700 hover:text-[#1B3A6B] group">
                    <FileText size={13} className={`flex-shrink-0 ${f.firma_recibe ? 'text-[#D81B43]' : 'text-slate-400'}`} />
                    <span className="min-w-0 truncate group-hover:underline">{f.nombre}</span>
                    {f.detalle && <span className="text-[11.5px] text-slate-400 flex-shrink-0">· {f.detalle}</span>}
                  </button>
                  {/* Firmada y de una plantilla renovable: se renueva con fecha nueva y la misma firma */}
                  {f.firma_recibe && g.guardadas && (esRenovable(f.bloques) || renovables.has(f.plantilla_id)) && (
                    <button type="button" onClick={() => setRenovando(f)}
                      className="inline-flex items-center gap-1 text-[12px] font-semibold text-[#6D28D9] hover:underline flex-shrink-0">
                      <RefreshCw size={12} /> Renovar
                    </button>
                  )}
                </div>
              )) :<div className="text-[12px] text-slate-400">No hay formatos para esta acción (Configuración → Plantillas).</div>}
            </div>
          )
        })}
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        <button onClick={() => ver(todas[0]?.id)} disabled={!todas.length}
          className="flex items-center gap-1.5 px-3 py-2 bg-white border border-slate-200 text-slate-700 rounded-[8px] text-[12.5px] font-semibold hover:border-slate-300 disabled:opacity-60">
          <Eye size={13} /> Ver todas
        </button>
        <DescargarActas actas={todas} nombre={nombreArchivo} onError={error}
          className="flex items-center gap-1.5 px-3 py-2 bg-[#1B3A6B] text-white rounded-[8px] text-[12.5px] font-semibold hover:bg-[#152D54] disabled:opacity-60">
          {ocupado => <>
            {ocupado ? <Loader2 size={13} className="animate-spin" /> : <Download size={13} />}
            {ocupado ? 'Generando PDF…' : 'Descargar PDF'}
          </>}
        </DescargarActas>
      </div>
      </>)}

      {editar && (
        <VentanaLlenarFormatos subtitulo={ordenCodigo} onCerrar={() => setEditar(null)} bloqueado={guardando}
          pie={<>
            <button onClick={() => setEditar(null)} disabled={guardando} className={ui.btnSecundario}>Cancelar</button>
            <button onClick={guardarDatos} disabled={guardando} className={ui.btnPrimario}>{guardando ? 'Guardando…' : 'Guardar'}</button>
          </>}>
          <LlenarFormatos plantillas={formatos} valores={editar} conPaciente={!!base.orden.paciente} nombrePaciente={base.orden.paciente?.nombre}
            base={baseFormatos}
            onPaciente={(k, v) => setEditar(x => ({ ...x, paciente: { ...x.paciente, [k]: v } }))}
            onDiagnostico={v => setEditar(x => ({ ...x, diagnostico: v }))}
            onActa={v => setEditar(x => ({ ...x, acta: v }))} />
        </VentanaLlenarFormatos>
      )}
      {renovando && (
        <RenovarActa acta={renovando} ordenId={ordenId} supabase={supabase} onCerrar={() => setRenovando(null)}
          onHecho={() => { setRenovando(null); onToast?.('Acta renovada'); cargar(); onCambio?.() }} />
      )}
      {firmando && (() => {
        const v = firmando.visita
        const accion = accionDeEntrega(v)
        const { equipos, retirados } = equiposDelActa(accion, v.datos || {})
        return (
          <FirmaActas ordenId={ordenId} entregaId={v.id} accion={accion} plantillaIds={firmando.plantillas.map(p => p.id)}
            equipos={equipos} retirados={retirados} datosIniciales={{ ...(v.datos?.datos_acta || {}), motivo: v.datos?.motivo }}
            titulo={`Firmar · ${nombreVisita(v)}`}
            alFirmar={async ({ recibidoPor, firma, datosActa }) => {
              // La visita ya está hecha: el acta sin firmas se reemplaza por la firmada
              // y a la visita se le anota quién firmó y lo escrito
              const { data: borradas, error: errBorrar } = await supabase.from('actas').delete().eq('entrega_id', v.id).is('firma_recibe', null).select('id')
              if (errBorrar) return errBorrar
              // RLS no avisa: si había acta sin firmas y no se borró, no se guarda otra encima
              if (firmando.tieneActa && !borradas?.length) return { message: 'No se pudo reemplazar el acta sin firmas (permisos de la tabla actas).' }
              const { error } = await supabase.from('entregas').update({
                recibido_por: v.recibido_por || recibidoPor, firma_iniciales: firma,
                datos: { ...(v.datos || {}), datos_acta: datosActa },
              }).eq('id', v.id)
              return error || { entregaId: v.id }
            }}
            onCancelar={() => setFirmando(null)}
            onHecho={() => { setFirmando(null); setPrevia(null); onToast?.('Actas firmadas'); cargar() }} />
        )
      })()}
      {previa && (
        <PreviaActas actas={previa.filas} inicial={previa.inicial}
          titulo={`Actas · ${ordenCodigo || 'préstamo'}`}
          nombreArchivo={nombreArchivo} onError={error} onCerrar={() => setPrevia(null)} />
      )}
    </div>
  )
}
