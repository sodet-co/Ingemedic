'use client'
import { useEffect, useMemo, useState } from 'react'
import { FilePlus2, Truck, ArrowUpRight, ArrowDownLeft, RefreshCw, ArrowLeftRight, CalendarClock, Ban, CheckCircle2, Clock, FileText, Loader2, Store, PenLine } from 'lucide-react'
import { createClient } from '@/lib/supabase'
import { formatear } from '@/lib/fechas'
import { accionDeEntrega, equiposDelActa, nombreVisita, formatosDeVisita } from '@/lib/accionesPrestamo'
import { sugeridasDe } from '@/lib/actas/acciones'
import { armarHistorialPrestamo } from '@/lib/historialPrestamo'
import PreviaActas from '@/components/actas/PreviaActas'
import { nombreDeArchivo } from '@/lib/actas/pdf'
import FirmaActas from '@/components/actas/FirmaActas'

// Historial de un préstamo: todo lo que le pasó, en orden y con quién lo hizo.
// Sale de lo que ya se guarda: el préstamo, sus equipos (orden_equipos), sus
// visitas (entregas: entrega, recogidas, recargas, cambios) y la bitácora del
// préstamo y de cada visita (quién lo creó, cambió la vigencia, lo canceló…).
// Las visitas con acta tienen "Ver acta". Una recogida, recarga o cambio hecha en
// oficina sin formatos tiene "Llenar formatos": se llenan y firman cuando se quiera.

const ICONO = {
  creado: [FilePlus2, '#1B3A6B', '#E8EEF9'], entregado: [ArrowUpRight, '#0E86A0', '#E8F7FB'],
  entrega: [Truck, '#0F7B55', '#E7F6EF'], devolucion: [ArrowDownLeft, '#B45309', '#FEF3E2'],
  recarga: [RefreshCw, '#6D28D9', '#F5F3FF'], cambio: [ArrowLeftRight, '#1B3A6B', '#E8EEF9'],
  programado: [Clock, '#B45309', '#FFFBEB'], cancelado: [Ban, '#64748B', '#F1F5F9'],
  vigencia: [CalendarClock, '#1B3A6B', '#E8EEF9'], finalizado: [CheckCircle2, '#0F7B55', '#E7F6EF'],
}

export default function HistorialPrestamo({ orden, plantillas = [] }) {
  const supabase = useMemo(() => createClient(), [])
  const [bitacora, setBitacora] = useState(null)
  const [previa, setPrevia] = useState(null)
  const [abriendo, setAbriendo] = useState(null)
  const [sinActa, setSinActa] = useState(null) // visita sin acta guardada
  const [llenando, setLlenando] = useState(null) // visita a la que se le llenan los formatos ahora
  const visitas = useMemo(() => orden.visitas || [], [orden])

  useEffect(() => {
    let cancelado = false
    const ids = [orden.id, ...visitas.map(v => v.id)]
    supabase.from('bitacora').select('id, fecha, accion, entidad, entidad_id, detalle, usuario:usuarios(nombre)')
      .in('entidad_id', ids).order('fecha')
      .then(({ data }) => { if (!cancelado) setBitacora(data || []) })
    return () => { cancelado = true }
  }, [supabase, orden.id, visitas])

  const eventos = useMemo(() => {
    return bitacora ? armarHistorialPrestamo(orden, bitacora) : []
  }, [bitacora, orden])

  async function verActa(v) {
    setAbriendo(v.id)
    const campos = 'id, nombre, accion, fecha_firma, bloques, datos, firma_recibe, firma_entrega'
    let { data } = await supabase.from('actas').select(campos).eq('entrega_id', v.id).order('fecha_firma')
    if (!data?.length && accionDeEntrega(v) === 'prestamo') ({ data } = await supabase.from('actas').select(campos).eq('orden_id', orden.id).eq('accion', 'prestamo').order('fecha_firma'))
    setAbriendo(null)
    if (data?.length) setPrevia({ filas: data, titulo: `${nombreVisita(v)} · ${orden.codigo}`, nombre: `Actas_${orden.codigo}_${nombreDeArchivo(nombreVisita(v))}` })
    else setSinActa(v.id)
  }

  if (!bitacora) return <div className="flex items-center gap-2 text-[12.5px] text-slate-400"><Loader2 size={13} className="animate-spin" /> Cargando historial…</div>

  return (
    <div className="relative pl-7">
      <div className="absolute left-[11px] top-1 bottom-1 w-px bg-slate-200" />
      <div className="space-y-3.5">
        {eventos.map((e, i) => {
          const [Icono, color, fondo] = ICONO[e.tipo] || ICONO.creado
          return (
            <div key={i} className="relative">
              <span className="absolute -left-7 top-0 w-[23px] h-[23px] rounded-full flex items-center justify-center ring-2 ring-white" style={{ background: fondo, color }}>
                {e.visita?.modo === 'oficina' ? <Store size={12} /> : <Icono size={12} />}
              </span>
              <div className="text-[13px] font-semibold text-slate-700 leading-snug">{e.texto}</div>
              <div className="text-[11.5px] text-slate-400 mt-0.5">
                {formatear(e.fecha, String(e.fecha).length > 10 ? { hour: '2-digit', minute: '2-digit' } : {})}
                {e.quien && ` · ${e.quien}`}
                {e.detalle && ` · ${e.detalle}`}
              </div>
              {e.visita && (
                <button type="button" onClick={() => verActa(e.visita)} disabled={abriendo === e.visita.id}
                  className="mt-1 inline-flex items-center gap-1 text-[11.5px] font-semibold text-[#1B3A6B] hover:underline disabled:opacity-50">
                  {abriendo === e.visita.id ? <Loader2 size={11} className="animate-spin" /> : <FileText size={11} />} {sinActa === e.visita.id ? 'Sin acta guardada' : 'Ver acta'}
                </button>
              )}
              {e.visita && sinActa === e.visita.id && e.visita.tipo !== 'entrega' && (
                sugeridasDe(plantillas, orden.cliente_id, formatosDeVisita(e.visita)).length
                  ? <button type="button" onClick={() => setLlenando(e.visita)}
                      className="mt-1 ml-3 inline-flex items-center gap-1 text-[11.5px] font-semibold text-[#D81B43] hover:underline">
                      <PenLine size={11} /> Llenar formatos
                    </button>
                  : <span className="ml-3 text-[11.5px] text-slate-400">No hay formatos de {nombreVisita(e.visita).toLowerCase()}</span>
              )}
            </div>
          )
        })}
      </div>
      {previa && <PreviaActas actas={previa.filas} titulo={previa.titulo} nombreArchivo={previa.nombre} onCerrar={() => setPrevia(null)} />}
      {llenando && (() => {
        const accion = accionDeEntrega(llenando)
        const { equipos, retirados } = equiposDelActa(accion, llenando.datos || {})
        return (
          <FirmaActas ordenId={orden.id} entregaId={llenando.id} accion={accion}
            plantillaIds={sugeridasDe(plantillas, orden.cliente_id, formatosDeVisita(llenando))}
            equipos={equipos} retirados={retirados} datosIniciales={llenando.datos?.datos_acta || undefined}
            titulo={`Formatos · ${nombreVisita(llenando)}`}
            alFirmar={async ({ recibidoPor, firma, datosActa }) => {
              // La visita ya está hecha: solo se le anota quién firmó y lo escrito
              const { error } = await supabase.from('entregas').update({
                recibido_por: llenando.recibido_por || recibidoPor, firma_iniciales: firma,
                datos: { ...(llenando.datos || {}), datos_acta: datosActa },
              }).eq('id', llenando.id)
              return error || { entregaId: llenando.id }
            }}
            onCancelar={() => setLlenando(null)}
            onHecho={() => { const v = llenando; setLlenando(null); setSinActa(null); verActa(v) }} />
        )
      })()}
    </div>
  )
}
