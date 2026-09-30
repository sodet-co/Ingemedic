'use client'
import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import dynamic from 'next/dynamic'
import { createClient } from '@/lib/supabase'
import {
  Package, Wrench, FileText,
  CheckCircle2, TrendingUp, Calendar,
  ArrowUpRight, Users, X, MapPin
} from 'lucide-react'
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer } from 'recharts'
import EntregaEnCursoBanner from '@/components/dashboard/EntregaEnCursoBanner'
import PanelAtencion from '@/components/dashboard/PanelAtencion'
import BuzonNovedades from '@/components/layout/BuzonNovedades'
import { formatear } from '@/lib/fechas'
import { COLOR_ESCALA_MUNICIPIOS, normalizarNombreMunicipio } from '@/lib/municipios'

const MapaMunicipios = dynamic(() => import('@/components/dashboard/MapaMunicipios'), { ssr: false })

const COLORES_DONA = ['#1B3A6B', '#D81B43', '#2EB5D4', '#0F7B55', '#B45309', '#6D28D9', '#0E86A0', '#94A3B8']

const ESTADO_EQUIPO_STYLES = {
  'Disponible': { bg: '#ECFDF5', color: '#0F7B55', dot: '#0F7B55' },
  'Reservado': { bg: '#FFFBEB', color: '#B45309', dot: '#F59E0B' },
  'En préstamo': { bg: '#E8F7FB', color: '#0E86A0', dot: '#25A9E0' },
  'En mantenimiento': { bg: '#FFFBEB', color: '#B45309', dot: '#F59E0B' },
  'Con novedad': { bg: '#FEF2F2', color: '#D81B43', dot: '#D81B43' },
  'Baja': { bg: '#F1F5F9', color: '#64748B', dot: '#94A3B8' },
}

const COLOR_POR_ESTADO = Object.fromEntries(Object.entries(ESTADO_EQUIPO_STYLES).map(([k, v]) => [k, v.dot]))

const ESTADO_OS_STYLES = {
  'Borrador': { bg: '#F1F5F9', color: '#64748B' },
  'Programada': { bg: '#EFF6FF', color: '#1D4ED8' },
  'En reparto': { bg: '#FFFBEB', color: '#B45309' },
  'Entregada': { bg: '#E8F7FB', color: '#0E86A0' },
  'Finalizada': { bg: '#ECFDF5', color: '#0F7B55' },
}

function nombreEquipo(eq) {
  return eq?.tipo_equipo?.atributos?.nombre || eq?.tipo_equipo?.nombre || '—'
}

export default function DashboardClient({
  totalEquipos, estadosEquipo,
  mantenimientosActivos, reglasAtencion = [],
  actividadReciente,
  topClientes = [], geojsonCesar, conteoPorCiudad = {}
}) {
  const router = useRouter()
  const supabase = createClient()
  const [mapaModalAbierto, setMapaModalAbierto] = useState(false)

  // ── POP-UP DE ATENCIÓN — se abre solo al entrar al dashboard, una vez
  // por sesión (sessionStorage, se limpia en cada login nuevo desde
  // login/page.js). Si ya se cerró esta sesión, o no hay nada que
  // atender, no se abre solo. La franja transversal (BannerAtencion, en
  // layout.js) también se ve en esta página — con el pop-up de una sola
  // vez, ya no es redundante, y sigue siendo el "ver en Préstamos" desde
  // acá si el pop-up ya se cerró.
  const hayAtencion = (reglasAtencion || []).some(r => r.count > 0)
  const [panelAbierto, setPanelAbierto] = useState(false)
  useEffect(() => {
    if (hayAtencion && sessionStorage.getItem('panel_atencion_oculto') !== '1') {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setPanelAbierto(true)
    }
  }, [hayAtencion])

  function cerrarPanelAtencion() {
    sessionStorage.setItem('panel_atencion_oculto', '1')
    setPanelAbierto(false)
  }

  // ── SINCRONIZACIÓN EN TIEMPO REAL ─────────────────────────
  // El Dashboard no guarda nada en estado local (todo viene de props),
  // así que solo necesitamos disparar router.refresh() cuando algo
  // relevante cambie en otra sesión — sin necesidad de proteger
  // mutaciones optimistas, porque este componente no hace ninguna.
  useEffect(() => {
    let debounceTimer = null
    function refrescarConDebounce() {
      clearTimeout(debounceTimer)
      debounceTimer = setTimeout(() => router.refresh(), 500)
    }

    const canal = supabase
      .channel('dashboard-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'equipos' }, refrescarConDebounce)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'ordenes_servicio' }, refrescarConDebounce)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'entregas' }, refrescarConDebounce)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'mantenimientos' }, refrescarConDebounce)
      .subscribe()

    return () => { clearTimeout(debounceTimer); supabase.removeChannel(canal) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const disponibles = estadosEquipo['Disponible'] || 0
  const enPrestamo = estadosEquipo['En préstamo'] || 0
  const enMant = estadosEquipo['En mantenimiento'] || 0
  const conNovedad = estadosEquipo['Con novedad'] || 0
  const baja = estadosEquipo['Baja'] || 0

  const distribucionEstados = Object.entries(estadosEquipo)
    .map(([nombre, cantidad]) => ({ nombre, cantidad }))
    .sort((a, b) => b.cantidad - a.cantidad)

  // Derivados del mismo conteoPorCiudad que colorea el mapa, pero anclados a
  // los 25 municipios reales del geojson — así el ranking y la cobertura solo
  // muestran municipios de verdad (no texto libre de pacientes.ciudad que no
  // matcheó con ningún municipio real, ej. errores de captura).
  const municipiosConConteo = (geojsonCesar?.features || []).map(f => ({
    nombre: f.properties.MPIO_CNMBR,
    conteo: conteoPorCiudad[normalizarNombreMunicipio(f.properties.MPIO_CNMBR)] || 0,
  }))
  const municipiosConEquipo = municipiosConConteo.filter(m => m.conteo > 0).length
  const topMunicipios = [...municipiosConConteo].sort((a, b) => b.conteo - a.conteo)

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Topbar */}
      <div className="h-14 md:h-16 md:bg-white md:border-b md:border-slate-200 flex items-center px-4 md:px-7 flex-shrink-0">
        <div>
          <div className="text-[18px] font-bold text-slate-800">Dashboard</div>
          <div className="text-[12px] text-slate-400 mt-0.5">
            {new Date().toLocaleDateString('es-CO', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
          </div>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <BuzonNovedades />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-3 md:p-6 pb-28 md:pb-6 space-y-5">

        {/* ── BANNER ENTREGA EN CURSO — solo aparece si hay entregas activas, en cualquier tamaño de pantalla ── */}
        <EntregaEnCursoBanner />

        {/* ── POP-UP DE ATENCIÓN — préstamos vencidos/por vencer, con acciones.
             No se renderiza si está cerrado o si no hay nada que atender. ── */}
        <PanelAtencion reglas={reglasAtencion} abierto={panelAbierto} onCerrar={cerrarPanelAtencion} />

        {/* ── FILA 1 (MÓVIL): tarjeta consolidada de flota ── */}
        <div className="md:hidden bg-white rounded-xl border border-slate-200 shadow-sm px-4 py-3">
          <div className="flex justify-between items-center border-b border-slate-100 pb-2 mb-2.5">
            <span className="text-[12px] font-semibold text-slate-500">Resumen de Equipos</span>
            <span className="text-[12px] font-bold text-slate-800 bg-slate-50 px-2 py-0.5 rounded-full border border-slate-200">
              {totalEquipos} equipos
            </span>
          </div>
          <div className="flex gap-4 items-center flex-wrap">
            {Object.entries(estadosEquipo)
              .filter(([, cantidad]) => cantidad > 0)
              .map(([nombre, cantidad], i, arr) => (
                <div key={nombre} className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: ESTADO_EQUIPO_STYLES[nombre]?.dot || '#94A3B8' }} />
                  <span className="text-[15px] font-bold text-slate-800 tabular-nums">{cantidad}</span>
                  <span className="text-[11px] text-slate-500">{nombre}</span>
                  {i < arr.length - 1 && <span className="w-px h-4 bg-slate-200 ml-2 flex-shrink-0" />}
                </div>
              ))}
          </div>
        </div>

        {/* ── FILA 1 (DESKTOP): 5 KPIs ── */}
        <div className="hidden md:grid md:grid-cols-5 gap-3">
          {[
            { label: 'Total equipos', value: totalEquipos, color: '#1E293B', icon: Package, sub: 'en inventario' },
            { label: 'Disponibles', value: disponibles, color: '#0F7B55', icon: CheckCircle2, sub: 'listos para préstamo' },
            { label: 'En préstamo', value: enPrestamo, color: '#0E86A0', icon: ArrowUpRight, sub: 'fuera del almacén' },
            { label: 'Mantenimiento', value: enMant, color: '#B45309', icon: Wrench, sub: 'en servicio técnico' },
            { label: 'Baja', value: baja, color: '#64748B', icon: Package, sub: 'fuera de servicio' },
          ].map(s => {
            const Icon = s.icon
            return (
              <div key={s.label} className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm hover:shadow-md transition-all">
                <div className="flex items-center justify-between mb-2">
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: s.color + '15' }}>
                    <Icon size={15} style={{ color: s.color }} />
                  </div>
                  <div className="text-2xl font-extrabold tabular-nums" style={{ color: s.color }}>{s.value}</div>
                </div>
                <div className="text-[12px] font-semibold text-slate-700">{s.label}</div>
                <div className="text-[10.5px] text-slate-400 mt-0.5 hidden md:block">{s.sub}</div>
              </div>
            )
          })}
        </div>

        {/* ── FILA 2: Gráficos ── */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

          {/* Top clientes con más equipos */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
            <div className="text-[14px] font-bold text-[#0F172A]">Top clientes con más equipos</div>
            <div className="text-[11.5px] text-slate-400 mt-0.5 mb-3">Equipos actualmente en préstamo por cliente</div>
            {topClientes.length === 0 ? (
              <div className="h-[160px] flex items-center justify-center text-slate-300 text-[13px]">Sin datos</div>
            ) : (
              <>
                <div className="md:hidden">
                  <ResponsiveContainer width="100%" height={160}>
                    <BarChart data={topClientes.slice(0, 4)} layout="vertical" barSize={12} margin={{ top: 2, right: 12, left: 4, bottom: 0 }}>
                      <XAxis type="number" tick={{ fontSize: 10 }} axisLine={false} tickLine={false} allowDecimals={false} />
                      <YAxis type="category" dataKey="nombre" tick={{ fontSize: 10 }} axisLine={false} tickLine={false} width={100} />
                      <Tooltip formatter={(v) => [v + ' equipos', 'Cantidad']} />
                      <Bar dataKey="cantidad" fill="#1B3A6B" radius={[0, 4, 4, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
                <div className="hidden md:block">
                  <ResponsiveContainer width="100%" height={240}>
                    <BarChart data={topClientes} layout="vertical" barSize={16} margin={{ top: 4, right: 16, left: 4, bottom: 0 }}>
                      <XAxis type="number" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} allowDecimals={false} />
                      <YAxis type="category" dataKey="nombre" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} width={110} />
                      <Tooltip formatter={(v) => [v + ' equipos', 'Cantidad']} />
                      <Bar dataKey="cantidad" fill="#1B3A6B" radius={[0, 4, 4, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </>
            )}
          </div>

          {/* Distribución por estado de inventario */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
            <div className="text-[14px] font-bold text-[#0F172A]">Distribución por estado</div>
            <div className="text-[11.5px] text-slate-400 mt-0.5 mb-3">Estado actual del inventario</div>
            {distribucionEstados.length === 0 ? (
              <div className="h-[150px] flex items-center justify-center text-slate-300 text-[13px]">Sin datos</div>
            ) : (
              <>
                <div className="md:hidden">
                  <ResponsiveContainer width="100%" height={150}>
                    <PieChart>
                      <Pie data={distribucionEstados} dataKey="cantidad" nameKey="nombre"
                        innerRadius={35} outerRadius={55} paddingAngle={2}>
                        {distribucionEstados.map((entry, i) => (
                          <Cell key={i} fill={COLOR_POR_ESTADO[entry.nombre] || COLORES_DONA[i % COLORES_DONA.length]} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(v, n) => [v + ' uds.', n]} />
                      <Legend layout="horizontal" verticalAlign="bottom" wrapperStyle={{ fontSize: 10 }} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="hidden md:block">
                  <ResponsiveContainer width="100%" height={220}>
                    <PieChart>
                      <Pie data={distribucionEstados} dataKey="cantidad" nameKey="nombre"
                        innerRadius={55} outerRadius={85} paddingAngle={2}>
                        {distribucionEstados.map((entry, i) => (
                          <Cell key={i} fill={COLOR_POR_ESTADO[entry.nombre] || COLORES_DONA[i % COLORES_DONA.length]} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(v, n) => [v + ' uds.', n]} />
                      <Legend layout="horizontal" verticalAlign="bottom" wrapperStyle={{ fontSize: 11 }} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </>
            )}
          </div>
        </div>

        {/* ── MAPA DE EQUIPOS ACTIVOS POR MUNICIPIO (Cesar) ── */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="text-[14px] font-bold text-[#0F172A]">Equipos activos por municipio</div>
              <div className="text-[11.5px] text-slate-400 mt-0.5 mb-3">Distribución geográfica en el Cesar</div>
            </div>
            <button onClick={() => setMapaModalAbierto(true)}
              className="md:hidden flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 bg-[#3730A3] text-white rounded-full text-[12px] font-semibold hover:bg-[#312E81] transition-colors">
              <MapPin size={13} /> Ver Mapa
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-[38%_1fr] gap-4">
            {/* Columna izquierda: cobertura + ranking + leyenda */}
            <div className="flex flex-col gap-4">
              <div>
                <div className="text-[11px] text-slate-400">Cobertura</div>
                <div className="text-[15px] font-bold text-slate-800">{municipiosConEquipo} / 25 municipios</div>
              </div>

              <div>
                <div className="text-[11px] font-bold uppercase tracking-wide text-slate-400 mb-2">Top municipios</div>
                <div className="flex flex-col gap-1.5">
                  {topMunicipios.slice(0, 5).map((m) => (
                    <div key={m.nombre} className="flex items-center justify-between text-[12.5px]">
                      <span className="text-slate-700 truncate">{m.nombre}</span>
                      <span className="font-bold text-[#3730A3] bg-[#EEF2FF] px-2 py-0.5 rounded-full text-[11px]">{m.conteo}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="mt-auto">
                <div className="text-[10.5px] text-slate-400 mb-1.5">Densidad</div>
                <div className="flex items-center gap-1">
                  {COLOR_ESCALA_MUNICIPIOS.map((color, i) => (
                    <div key={i} className="flex-1 h-2 rounded-sm" style={{ background: color }} />
                  ))}
                </div>
                <div className="flex justify-between text-[9.5px] text-slate-400 mt-1">
                  <span>Sin equipos</span>
                  <span>Más equipos</span>
                </div>
              </div>
            </div>

            {/* Columna derecha: el mapa — oculto en móvil, se abre en modal desde el botón "Ver Mapa" */}
            <div className="hidden md:block">
              {geojsonCesar && <MapaMunicipios geojsonCesar={geojsonCesar} conteoPorCiudad={conteoPorCiudad} />}
            </div>
          </div>
        </div>

        {/* ── MODAL: mapa a pantalla completa (móvil) ── */}
        {mapaModalAbierto && (
          <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex flex-col">
            <div className="flex items-center justify-between px-4 py-3 bg-white border-b border-slate-200 flex-shrink-0">
              <div className="text-[14px] font-bold text-[#0F172A]">Equipos activos por municipio</div>
              <button onClick={() => setMapaModalAbierto(false)}
                className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-slate-100 transition-colors">
                <X size={18} className="text-slate-500" />
              </button>
            </div>
            <div className="flex-1 bg-white p-3 overflow-hidden">
              {geojsonCesar && <MapaMunicipios geojsonCesar={geojsonCesar} conteoPorCiudad={conteoPorCiudad} interactivo />}
            </div>
          </div>
        )}

        {/* ── ALERTAS — solo se muestra si hay datos, para no ocupar espacio en vano ──
             Las de vigencia (vencidos/por vencer) viven en PanelAtencion, arriba del todo. ── */}
        {conNovedad > 0 && (
          <div className="grid grid-cols-1 gap-4">

            {conNovedad > 0 && (
              <div className="bg-white rounded-xl border border-[#D81B43]/30 shadow-sm overflow-hidden">
                <div className="px-5 py-3.5 border-b border-slate-100 flex items-center gap-2">
                  <Package size={14} className="text-[#D81B43]" />
                  <div className="text-[13px] font-bold text-slate-800">Equipos con novedad</div>
                  <span className="ml-auto text-[11px] font-bold text-white bg-[#D81B43] px-2 py-0.5 rounded-full">{conNovedad}</span>
                </div>
                <div className="px-5 py-5 text-center">
                  <div className="text-3xl font-extrabold text-[#D81B43] mb-1">{conNovedad}</div>
                  <div className="text-[12.5px] text-slate-500">equipo{conNovedad !== 1 ? 's' : ''} requieren atención</div>
                  <button onClick={() => router.push('/inventario')}
                    className="mt-3 text-[12px] text-[#D81B43] font-semibold hover:underline">
                    Ver en inventario →
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── FILA 4: Actividad reciente ── */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-100">
            <div className="text-[14px] font-bold text-slate-800">Actividad reciente</div>
            <div className="text-[11.5px] text-slate-400 mt-0.5">Últimas órdenes de servicio</div>
          </div>
          <div className="relative">
            <div className="absolute left-[28px] top-0 bottom-0 w-px bg-slate-100" />
            <div className="divide-y divide-slate-50">
              {actividadReciente.length === 0 && (
                <div className="px-5 py-8 text-center text-[13px] text-slate-400">Sin actividad reciente</div>
              )}
              {actividadReciente.map((o, i) => {
                const s = ESTADO_OS_STYLES[o.estado?.nombre] || ESTADO_OS_STYLES['Borrador']
                return (
                  <div key={o.id} onClick={() => router.push('/ordenes')}
                    className="flex items-start gap-4 px-5 py-3.5 hover:bg-slate-50 cursor-pointer transition-colors">
                    <div className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 z-10 mt-0.5"
                      style={{ background: s.bg }}>
                      <FileText size={12} style={{ color: s.color }} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <div className="text-[13px] font-semibold text-slate-700">
                          <span className="font-mono">{o.codigo}</span>
                          <span className="text-slate-400 font-normal ml-2 hidden sm:inline">— {o.cliente?.nombre}</span>
                        </div>
                        <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full flex-shrink-0"
                          style={{ background: s.bg, color: s.color }}>
                          {o.estado?.nombre}
                        </span>
                      </div>
                      <div className="text-[11.5px] text-slate-400 mt-0.5">
                        {formatear(o.fecha_creacion, { year: undefined, hour: '2-digit', minute: '2-digit' })}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}