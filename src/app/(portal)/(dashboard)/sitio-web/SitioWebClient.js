'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import { MessageCircle, Send, RefreshCw, ExternalLink } from 'lucide-react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer } from 'recharts'
import { SITIO_URL } from '@/lib/sitio'

const VERDE = '#0F7B55'
const AZUL  = '#1B3A6B'

function Ranking({ titulo, sub, filas, vacio, color = VERDE }) {
  const maximo = filas[0]?.cantidad || 1
  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
      <div className="text-[14px] font-bold text-[#0F172A]">{titulo}</div>
      <div className="text-[11.5px] text-slate-400 mt-0.5 mb-4">{sub}</div>
      {filas.length === 0 ? (
        <div className="text-[13px] text-slate-300 py-6 text-center">{vacio}</div>
      ) : (
        <div className="flex flex-col gap-2.5">
          {filas.map(f => (
            <div key={f.nombre}>
              <div className="flex items-center justify-between gap-3 text-[12.5px]">
                <span className="text-slate-700 truncate">{f.nombre}</span>
                <span className="font-bold text-slate-800 tabular-nums flex-shrink-0">{f.cantidad}</span>
              </div>
              <div className="h-1.5 rounded-full bg-slate-100 mt-1 overflow-hidden">
                <div className="h-full rounded-full" style={{ width: `${(f.cantidad / maximo) * 100}%`, background: color }} />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export default function SitioWebClient({ datos }) {
  const router = useRouter()
  const [enVivo, setEnVivo] = useState(false)

  // ── TIEMPO REAL ── cada clic o formulario nuevo refresca los datos solo.
  // Igual que el Dashboard: todo viene de props, así que basta router.refresh().
  // La política de lectura de `eventos_sitio` solo deja pasar a SuperAdmin; si
  // la suscripción no conecta, el punto queda gris y sigue el botón Actualizar.
  useEffect(() => {
    const supabase = createClient()
    let debounceTimer = null
    function refrescarConDebounce() {
      clearTimeout(debounceTimer)
      debounceTimer = setTimeout(() => router.refresh(), 500)
    }

    const canal = supabase
      .channel('sitio-web-realtime')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'eventos_sitio' }, refrescarConDebounce)
      .subscribe(estado => setEnVivo(estado === 'SUBSCRIBED'))

    return () => { clearTimeout(debounceTimer); supabase.removeChannel(canal) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const sinActividad = datos.whatsapp30 + datos.formularios30 === 0

  const cifras = [
    { label: 'Clics en WhatsApp', icon: MessageCircle, color: VERDE, d7: datos.whatsapp7, d30: datos.whatsapp30 },
    { label: 'Formularios enviados', icon: Send, color: AZUL, d7: datos.formularios7, d30: datos.formularios30 },
  ]

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Topbar */}
      <div className="h-14 md:h-16 md:bg-white md:border-b md:border-slate-200 flex items-center px-4 md:px-7 flex-shrink-0">
        <div>
          <div className="text-[18px] font-bold text-slate-800">Página web</div>
          <div className="text-[12px] text-slate-400 mt-0.5">Interés que genera el sitio público · últimos {datos.dias} días</div>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <span className="flex items-center gap-1.5 text-[11.5px] font-semibold text-slate-500 mr-1"
            title={enVivo ? 'Los datos se actualizan solos' : 'Sin conexión en vivo: usa Actualizar'}>
            <span className={`w-2 h-2 rounded-full ${enVivo ? 'bg-[#0F7B55] animate-pulse' : 'bg-slate-300'}`} />
            {enVivo ? 'En vivo' : 'Sin conexión'}
          </span>
          <a href={SITIO_URL} target="_blank" rel="noopener noreferrer"
            className="hidden md:flex items-center gap-1.5 px-3 py-2 text-[12.5px] font-semibold text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors">
            <ExternalLink size={13} /> Ver sitio
          </a>
          <button onClick={() => router.refresh()}
            className="flex items-center gap-1.5 px-3 py-2 text-[12.5px] font-semibold text-white bg-[#1B3A6B] rounded-lg hover:bg-[#152E55] transition-colors">
            <RefreshCw size={13} /> Actualizar
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-3 md:p-6 pb-28 md:pb-6 space-y-5">

        {datos.error && (
          <div className="bg-[#FFFBEB] border border-[#F59E0B]/40 text-[#B45309] rounded-xl px-4 py-3 text-[12.5px]">
            No se pudieron leer los datos. Si el módulo es nuevo, falta crear la tabla <span className="font-mono">eventos_sitio</span> en Supabase.
          </div>
        )}

        {/* ── CIFRAS ── */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {cifras.map(c => {
            const Icon = c.icon
            return (
              <div key={c.label} className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
                <div className="flex items-center gap-2.5 mb-3">
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: c.color + '15' }}>
                    <Icon size={15} style={{ color: c.color }} />
                  </div>
                  <div className="text-[13px] font-semibold text-slate-700">{c.label}</div>
                </div>
                <div className="flex items-end gap-6">
                  <div>
                    <div className="text-3xl font-extrabold tabular-nums leading-none" style={{ color: c.color }}>{c.d7}</div>
                    <div className="text-[11px] text-slate-400 mt-1">últimos 7 días</div>
                  </div>
                  <div>
                    <div className="text-xl font-bold tabular-nums leading-none text-slate-700">{c.d30}</div>
                    <div className="text-[11px] text-slate-400 mt-1">últimos {datos.dias} días</div>
                  </div>
                </div>
              </div>
            )
          })}
        </div>

        {/* ── POR DÍA ── */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
          <div className="text-[14px] font-bold text-[#0F172A]">Actividad por día</div>
          <div className="text-[11.5px] text-slate-400 mt-0.5 mb-3">Clics en WhatsApp y formularios enviados</div>
          {sinActividad ? (
            <div className="h-[200px] flex items-center justify-center text-slate-300 text-[13px]">Aún no hay actividad registrada</div>
          ) : (
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={datos.serie} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
                <XAxis dataKey="dia" tick={{ fontSize: 10 }} axisLine={false} tickLine={false} interval="preserveStartEnd" minTickGap={18} />
                <YAxis tick={{ fontSize: 11 }} axisLine={false} tickLine={false} allowDecimals={false} />
                <Tooltip />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Bar dataKey="whatsapp" name="WhatsApp" stackId="a" fill={VERDE} />
                <Bar dataKey="formularios" name="Formularios" stackId="a" fill={AZUL} radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* ── DESGLOSES ── */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Ranking titulo="WhatsApp por botón" sub="Cuál botón lleva más gente a WhatsApp"
            filas={datos.porBoton} vacio="Aún no hay clics registrados" />
          <Ranking titulo="WhatsApp por página" sub="Desde qué página hicieron clic"
            filas={datos.porPagina} vacio="Aún no hay clics registrados" />
          <Ranking titulo="Equipos más consultados" sub="Clics en “consultar” desde las tarjetas del portafolio"
            filas={datos.porEquipo} vacio="Aún no hay consultas por equipo" />
          <Ranking titulo="Formularios por servicio" sub="Servicio elegido al enviar el formulario de contacto"
            filas={datos.porServicio} vacio="Aún no hay formularios enviados" color={AZUL} />
        </div>

        <p className="text-[11.5px] text-slate-400 leading-relaxed">
          Un clic cuenta a quien abrió WhatsApp desde la página, no a quien terminó escribiendo o comprando. No se guarda ningún dato de la persona.
        </p>
      </div>
    </div>
  )
}
