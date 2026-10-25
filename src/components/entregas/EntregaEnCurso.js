'use client'
import { useEffect, useState } from 'react'
import { Truck, MapPin, Phone, Navigation, Package, User, Clock, CheckCircle2, ArrowRight } from 'lucide-react'
import { NOMBRE_ACCION, accionDeEntrega, nombreVisita } from '@/lib/accionesPrestamo'

// Entrega "En progreso": camión animado sobre la ruta, cronómetro y todo lo que
// necesita quien va en camino (destino, teléfono, equipos). La barra avanza con
// el tiempo transcurrido frente a una duración estimada (no hay GPS): llega al
// 95% y ahí espera a que se registre la entrega.
const DURACION_ESTIMADA_MIN = 45

// Arranca en 0 y se pone en hora ya en el navegador: así el HTML del servidor y
// el primer render del cliente coinciden (si no, React descarta el SSR)
function useAhora() {
  const [ahora, setAhora] = useState(0)
  useEffect(() => {
    const tick = () => setAhora(Date.now())
    const t0 = setTimeout(tick, 0), t = setInterval(tick, 1000)
    return () => { clearTimeout(t0); clearInterval(t) }
  }, [])
  return ahora
}

const dos = n => String(n).padStart(2, '0')
function transcurrido(ms) {
  const s = Math.max(0, Math.floor(ms / 1000))
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60)
  return h ? `${h}:${dos(m)}:${dos(s % 60)}` : `${dos(m)}:${dos(s % 60)}`
}

const nombreEquipo = eq => eq?.tipo_equipo?.atributos?.nombre || eq?.tipo_equipo?.nombre || '—'

// Camión sobre la barra: lo comparten la tarjeta y la vista completa
export function RutaAnimada({ inicio, compacto = false }) {
  const ahora = useAhora()
  const ms = inicio && ahora ? ahora - new Date(inicio).getTime() : 0
  const pct = Math.min(95, Math.max(4, (ms / 60000) / DURACION_ESTIMADA_MIN * 100))
  const tarde = ms / 60000 > DURACION_ESTIMADA_MIN
  return (
    <div className={compacto ? '' : 'px-1'}>
      <style>{`
        @keyframes ingemedic-rebote { 0%,100% { transform: translate(-50%, 0) } 50% { transform: translate(-50%, -2px) } }
        @keyframes ingemedic-via { from { background-position: 0 0 } to { background-position: -28px 0 } }
      `}</style>
      <div className={`relative ${compacto ? 'h-7' : 'h-12'}`}>
        <div className={`absolute left-0 right-0 bottom-1.5 ${compacto ? 'h-1.5' : 'h-2.5'} rounded-full bg-slate-100 overflow-hidden`}>
          <div className={`h-full rounded-full transition-[width] duration-1000 ${tarde ? 'bg-[#F59E0B]' : 'bg-[#2EB5D4]'}`} style={{ width: `${pct}%` }} />
          {/* Línea de la vía que corre: da sensación de movimiento */}
          <div className="absolute inset-0 opacity-40" style={{
            backgroundImage: 'repeating-linear-gradient(90deg, transparent 0 8px, rgba(255,255,255,.9) 8px 14px)',
            backgroundSize: '28px 100%', animation: 'ingemedic-via .6s linear infinite',
          }} />
        </div>
        <div className="absolute bottom-3 transition-[left] duration-1000" style={{ left: `${pct}%`, animation: 'ingemedic-rebote .5s ease-in-out infinite' }}>
          <div className={`${compacto ? 'w-6 h-6' : 'w-9 h-9'} rounded-full bg-white shadow-md border border-slate-200 flex items-center justify-center`}>
            <Truck size={compacto ? 13 : 19} className={tarde ? 'text-[#B45309]' : 'text-[#0E86A0]'} />
          </div>
        </div>
        <MapPin size={compacto ? 13 : 18} className="absolute right-0 bottom-3 text-[#D81B43]" />
      </div>
      <div className={`flex items-center justify-between ${compacto ? 'text-[11px]' : 'text-[12px]'} mt-0.5`}>
        <span className="flex items-center gap-1 font-bold tabular-nums text-slate-700"><Clock size={compacto ? 10 : 12} /> {transcurrido(ms)}</span>
        <span className={tarde ? 'font-semibold text-[#B45309]' : 'text-slate-400'}>
          {tarde ? 'Más tiempo del estimado' : `En camino · estimado ${DURACION_ESTIMADA_MIN} min`}
        </span>
      </div>
    </div>
  )
}

// Vista completa de la entrega en curso
export default function EntregaEnCurso({ entrega, onRegistrar }) {
  const orden = entrega.orden || {}
  const p = orden.paciente
  const c = orden.cliente || entrega.cliente || {}
  const direccion = p?.direccion || c.direccion
  const ciudad = p?.ciudad || c.municipio?.nombre
  const telefono = p?.telefono || c.telefono
  const destino = [direccion, ciudad].filter(Boolean).join(', ')
  // En una recogida, recarga o cambio, solo los equipos de esa acción
  const accion = accionDeEntrega(entrega)
  const nombre = accion === 'prestamo' ? NOMBRE_ACCION.prestamo : nombreVisita(entrega)
  const equipos = accion === 'prestamo'
    ? (orden.equipos || []).filter(oe => !oe.fecha_devolucion)
    : accion === 'cambio'
      ? (entrega.datos?.cambios || []).map(c => ({ id: c.orden_equipo_id, equipo: c.entra, sale: c.sale }))
      : (entrega.datos?.equipos || []).map(x => ({ id: x.orden_equipo_id, equipo: x.equipo }))

  return (
    <div className="space-y-4">
      <div className="rounded-2xl bg-gradient-to-br from-[#1B3A6B] to-[#0E86A0] text-white p-4 md:p-5 shadow-sm">
        <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.1em] text-white/70">
          <span className="w-2 h-2 rounded-full bg-[#7CF0C8] animate-pulse" /> {nombre} en curso
        </div>
        <div className="text-[18px] md:text-[20px] font-extrabold leading-tight mt-1">{p?.nombre || c.nombre}</div>
        {p && <div className="text-[12.5px] text-white/70">{c.nombre}</div>}
        <div className="mt-4 bg-white rounded-xl p-3"><RutaAnimada inicio={entrega.fecha_inicio} /></div>
      </div>

      <div className="rounded-xl border border-slate-200 p-4">
        <div className="text-[10.5px] font-bold uppercase tracking-[0.1em] text-slate-400 mb-2">Destino</div>
        <div className="flex items-start gap-2 text-[14px] font-semibold text-slate-800">
          <MapPin size={16} className="text-[#D81B43] mt-0.5 flex-shrink-0" />
          <span>{destino || 'Sin dirección registrada'}</span>
        </div>
        <div className="grid grid-cols-2 gap-2 mt-3">
          <a href={destino ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(destino)}` : undefined}
            target="_blank" rel="noopener noreferrer" aria-disabled={!destino}
            className={`flex items-center justify-center gap-1.5 py-2.5 rounded-[10px] text-[13px] font-semibold ${destino ? 'bg-[#1B3A6B] text-white' : 'bg-slate-100 text-slate-400 pointer-events-none'}`}>
            <Navigation size={14} /> Cómo llegar
          </a>
          <a href={telefono ? `tel:${String(telefono).replace(/\s/g, '')}` : undefined} aria-disabled={!telefono}
            className={`flex items-center justify-center gap-1.5 py-2.5 rounded-[10px] text-[13px] font-semibold border ${telefono ? 'border-slate-200 text-slate-700' : 'border-slate-100 text-slate-300 pointer-events-none'}`}>
            <Phone size={14} /> {telefono ? 'Llamar' : 'Sin teléfono'}
          </a>
        </div>
      </div>

      <div className="rounded-xl border border-slate-200 p-4">
        <div className="text-[10.5px] font-bold uppercase tracking-[0.1em] text-slate-400 mb-2">Resumen de la orden</div>
        <div className="space-y-1.5 text-[13px]">
          <div className="flex justify-between gap-3"><span className="text-slate-400">Orden</span><span className="font-mono font-bold text-slate-700">{orden.codigo || '—'}</span></div>
          <div className="flex justify-between gap-3"><span className="text-slate-400">{nombre}</span><span className="font-mono text-slate-700">{entrega.codigo}</span></div>
          {entrega.datos?.motivo && <div className="flex justify-between gap-3"><span className="text-slate-400">Motivo</span><span className="text-slate-700 text-right">{entrega.datos.motivo}</span></div>}
          {p && <div className="flex justify-between gap-3"><span className="text-slate-400 flex items-center gap-1"><User size={12} /> Paciente</span><span className="font-medium text-slate-700 text-right">{p.nombre}</span></div>}
          {orden.observaciones && <div className="pt-1 text-[12.5px] text-slate-500 italic">“{orden.observaciones}”</div>}
        </div>
        <div className="text-[10.5px] font-bold uppercase tracking-[0.1em] text-slate-400 mt-4 mb-2">Equipos ({equipos.length})</div>
        <div className="space-y-1.5">
          {equipos.map(oe => (
            <div key={oe.id} className="flex items-center gap-2 text-[13px] text-slate-700">
              <Package size={14} className="text-slate-400 flex-shrink-0" />
              <span className="flex-1 truncate">{nombreEquipo(oe.equipo)}</span>
              {oe.sale && <><span className="font-mono text-[12px] text-slate-400">{oe.sale.codigo}</span><ArrowRight size={12} className="text-slate-300" /></>}
              <span className="font-mono text-[12px] font-semibold text-slate-500">{oe.equipo?.codigo}</span>
            </div>
          ))}
        </div>
      </div>

      {onRegistrar && (
        <button onClick={onRegistrar}
          className="w-full flex items-center justify-center gap-2 py-3.5 bg-[#0F7B55] text-white rounded-[12px] text-[15px] font-bold hover:bg-[#0a5c3f]">
          <CheckCircle2 size={18} /> Llegué · Registrar {nombre.toLowerCase()}
        </button>
      )}
    </div>
  )
}
