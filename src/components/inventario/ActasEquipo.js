'use client'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { FileText, Download, Loader2, PenLine, RefreshCw, ArrowLeftRight, ArrowDownLeft, ArrowUpRight } from 'lucide-react'
import { createClient } from '@/lib/supabase'
import { formatear } from '@/lib/fechas'
import { descargarActasPDF } from '@/lib/actas/pdf'
import { SELECT_PLANTILLAS } from '@/lib/actas/firmar'
import { sugeridasDe } from '@/lib/actas/acciones'
import { accionDeEntrega, equiposDelActa, formatosDeVisita } from '@/lib/accionesPrestamo'
import PreviaActas from '@/components/actas/PreviaActas'
import FirmaActas from '@/components/actas/FirmaActas'

// Hoja de vida del equipo (Inventario): cada vez que pasó por un préstamo
// —entregado, recogido, cambiado o en una recarga— con sus actas. En una recarga
// el equipo que salió vacío y el que entró recargado ven las dos actas: la de
// cambio de equipo (del préstamo) y la de recarga (del equipo). Si se hizo sin
// formatos, "Llenar y firmar" los firma después.

const CAMPOS_ACTA = 'id, nombre, accion, entrega_id, orden_id, fecha_firma, bloques, datos, firma_recibe, firma_entrega'

// Qué le pasó a este equipo en la visita
function papel(v, equipoId) {
  if (v.tipo === 'entrega') return { texto: 'Prestado', Icono: ArrowUpRight, color: '#0E86A0' }
  if (v.tipo === 'retiro') return { texto: 'Recogido', Icono: ArrowDownLeft, color: '#0F7B55' }
  if (v.tipo === 'recarga') return { texto: 'Recargado', Icono: RefreshCw, color: '#6D28D9' }
  const c = (v.datos?.cambios || []).find(x => x.sale?.id === equipoId || x.entra?.id === equipoId)
  const sale = c?.sale?.id === equipoId
  if (v.datos?.recarga) return { texto: sale ? `Salió a recargar · entró ${c?.entra?.codigo || ''}` : `Entró recargado · salió ${c?.sale?.codigo || ''}`, Icono: RefreshCw, color: '#6D28D9' }
  return { texto: sale ? `Cambiado por ${c?.entra?.codigo || ''}` : `Entró en un cambio · salió ${c?.sale?.codigo || ''}`, Icono: ArrowLeftRight, color: '#1B3A6B' }
}

export default function ActasEquipo({ equipo, onToast }) {
  const supabase = useMemo(() => createClient(), [])
  const [filas, setFilas] = useState(null)     // [{ visita, orden, actas }]
  const [previa, setPrevia] = useState(null)
  const [descargando, setDescargando] = useState(null)
  const [llenando, setLlenando] = useState(null) // { visita, orden, plantillas }

  const cargar = useCallback(async () => {
    const { data: oes } = await supabase.from('orden_equipos').select('orden_id').eq('equipo_id', equipo.id)
    const ordenIds = [...new Set((oes || []).map(o => o.orden_id))]
    if (!ordenIds.length) { setFilas([]); return }
    const [{ data: ordenes }, { data: visitas }, { data: actas }] = await Promise.all([
      supabase.from('ordenes_servicio').select('id, codigo, cliente_id').in('id', ordenIds),
      supabase.from('entregas').select('id, codigo, tipo, modo, orden_id, datos, recibido_por, fecha_completada, estado:estados_entrega(nombre)').in('orden_id', ordenIds),
      supabase.from('actas').select(CAMPOS_ACTA).in('orden_id', ordenIds).order('fecha_firma'),
    ])
    const deEquipo = v => v.tipo === 'entrega'
      || (v.datos?.equipos || []).some(x => x.equipo?.id === equipo.id)
      || (v.datos?.cambios || []).some(c => c.sale?.id === equipo.id || c.entra?.id === equipo.id)
    const lista = (visitas || [])
      .filter(v => v.estado?.nombre === 'Completada' && deEquipo(v))
      .map(v => ({
        visita: v, orden: (ordenes || []).find(o => o.id === v.orden_id),
        // La entrega de un préstamo en oficina no tiene fila propia: sus actas van por el préstamo
        actas: (actas || []).filter(a => a.entrega_id === v.id || (v.tipo === 'entrega' && !a.entrega_id && (a.accion || 'prestamo') === 'prestamo' && a.orden_id === v.orden_id)),
      }))
    // Préstamos entregados en oficina (sin fila de entrega): sus actas de préstamo
    for (const o of ordenes || []) {
      if (lista.some(f => f.visita.tipo === 'entrega' && f.visita.orden_id === o.id)) continue
      const delPrestamo = (actas || []).filter(a => a.orden_id === o.id && (a.accion || 'prestamo') === 'prestamo')
      if (delPrestamo.length) lista.push({ visita: { id: `p-${o.id}`, tipo: 'entrega', orden_id: o.id, fecha_completada: delPrestamo[0].fecha_firma }, orden: o, actas: delPrestamo })
    }
    lista.sort((a, b) => String(b.visita.fecha_completada || '').localeCompare(String(a.visita.fecha_completada || '')))
    setFilas(lista)
  }, [supabase, equipo.id])

  useEffect(() => { const t = setTimeout(cargar, 0); return () => clearTimeout(t) }, [cargar])

  async function descargar(f) {
    setDescargando(f.visita.id)
    try { await descargarActasPDF(f.actas, `Actas_${f.orden?.codigo || ''}_${equipo.codigo}.pdf`) }
    catch (e) { onToast?.('No se pudo generar el PDF: ' + e.message, 'error') }
    finally { setDescargando(null) }
  }

  async function abrirLlenar(f) {
    const { data: plantillas } = await supabase.from('plantillas_acta').select(SELECT_PLANTILLAS).eq('activo', true)
    const ids = sugeridasDe(plantillas || [], f.orden?.cliente_id, formatosDeVisita(f.visita))
    if (!ids.length) { onToast?.('Este cliente no tiene formatos para esta acción. Créalos en Configuración → Plantillas.', 'error'); return }
    setLlenando({ ...f, plantillaIds: ids })
  }

  if (filas === null) return <div className="flex items-center gap-2 text-[12.5px] text-slate-400"><Loader2 size={13} className="animate-spin" /> Cargando actas…</div>
  if (!filas.length) return <div className="text-[12px] text-slate-400 italic">Sin actas todavía</div>

  return (
    <div className="space-y-2">
      {filas.map(f => {
        const { texto, Icono, color } = papel(f.visita, equipo.id)
        const sinActa = !f.actas.length
        const sinFirmar = f.visita.tipo !== 'entrega' && (sinActa || f.actas.every(a => !a.firma_recibe))
        return (
          <div key={f.visita.id} className="rounded-[10px] border border-slate-200 px-3 py-2.5">
            <div className="flex items-start gap-2.5">
              <Icono size={15} className="flex-shrink-0 mt-0.5" style={{ color }} />
              <div className="min-w-0 flex-1">
                <div className="text-[13px] font-semibold text-slate-800 truncate">{texto}</div>
                <div className="text-[11.5px] text-slate-400 truncate">
                  {[f.orden?.codigo, f.visita.fecha_completada && formatear(f.visita.fecha_completada), f.visita.recibido_por && `recibió ${f.visita.recibido_por}`].filter(Boolean).join(' · ')}
                </div>
                {!sinActa && (
                  <div className="mt-1.5 flex flex-wrap gap-1.5">
                    {f.actas.map((a, i) => (
                      <button key={a.id} type="button" onClick={() => setPrevia({ filas: f.actas, inicial: i, titulo: `${texto} · ${f.orden?.codigo || ''}` })}
                        className="inline-flex items-center gap-1 max-w-full px-2 py-0.5 rounded-full border border-slate-200 text-[11.5px] text-slate-600 hover:border-[#1B3A6B]/40 hover:text-[#1B3A6B]">
                        <FileText size={11} className="flex-shrink-0 text-[#D81B43]" /> <span className="truncate">{a.nombre}</span>{!a.firma_recibe && <span className="text-slate-400 flex-shrink-0"> · sin firmas</span>}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              {sinFirmar && (
                <button type="button" onClick={() => abrirLlenar(f)}
                  className="flex items-center gap-1 text-[12px] font-semibold text-[#D81B43] hover:underline flex-shrink-0">
                  <PenLine size={12} /> Firmar
                </button>
              )}
              {!sinActa && (
                <button type="button" onClick={() => descargar(f)} disabled={descargando === f.visita.id}
                  className="flex items-center gap-1 text-[12px] font-semibold text-[#1B3A6B] hover:underline flex-shrink-0 disabled:opacity-50">
                  {descargando === f.visita.id ? <Loader2 size={12} className="animate-spin" /> : <Download size={12} />} PDF
                </button>
              )}
            </div>
          </div>
        )
      })}

      {previa && <PreviaActas actas={previa.filas} inicial={previa.inicial} titulo={previa.titulo} onCerrar={() => setPrevia(null)} />}

      {llenando && (() => {
        const v = llenando.visita
        const accion = accionDeEntrega(v)
        const { equipos, retirados } = equiposDelActa(accion, v.datos || {})
        return (
          <FirmaActas ordenId={v.orden_id} entregaId={v.id} accion={accion} plantillaIds={llenando.plantillaIds}
            equipos={equipos} retirados={retirados} datosIniciales={v.datos?.datos_acta || undefined}
            titulo={`Formatos · ${papel(v, equipo.id).texto}`}
            alFirmar={async ({ recibidoPor, firma, datosActa }) => {
              // La visita ya está hecha: el acta sin firmas se reemplaza por la firmada
              const { data: borradas, error: errBorrar } = await supabase.from('actas').delete().eq('entrega_id', v.id).is('firma_recibe', null).select('id')
              if (errBorrar) return errBorrar
              // RLS no avisa: si había acta sin firmas y no se borró, no se guarda otra encima
              if (llenando.actas?.length > 0 && !borradas?.length) return { message: 'No se pudo reemplazar el acta sin firmas (permisos de la tabla actas).' }
              const { error } = await supabase.from('entregas').update({
                recibido_por: v.recibido_por || recibidoPor, firma_iniciales: firma,
                datos: { ...(v.datos || {}), datos_acta: datosActa },
              }).eq('id', v.id)
              return error || { entregaId: v.id }
            }}
            onCancelar={() => setLlenando(null)}
            onHecho={() => { setLlenando(null); onToast?.('Actas firmadas'); cargar() }} />
        )
      })()}
    </div>
  )
}
