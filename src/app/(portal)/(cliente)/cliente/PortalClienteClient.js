'use client'
import { useState, useMemo, useEffect } from 'react'
import {
  Search, SlidersHorizontal, ChevronRight, ChevronDown, ChevronLeft, User, Package,
  HeartPulse, Wrench, LogOut, MessageCircle, Plus, X, Loader2, MapPin,
} from 'lucide-react'
import { createClient } from '@/lib/supabase'
import { IconoTipo } from '@/components/inventario/IconoTipo'
import { usePaginacion } from '@/hooks/usePaginacion'
import { formatear } from '@/lib/fechas'
import { EMPRESA } from '@/lib/sitio'
import { iniciales } from '@/components/layout/RepartidorHeader'

// Diseño del portal de clientes (mobile-first): bloque azul con el saludo,
// buscador + filtros, tarjetas y barra inferior con los contadores.
// En pantallas medianas la barra inferior pasa a ser pestañas arriba.

const nombreTipo = tipo => tipo?.atributos?.nombre || tipo?.nombre || 'Equipo'
const normalizar = s => (s || '').toString().normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
const MONO = { fontFamily: 'var(--font-jetbrains), ui-monospace, monospace' }

const ESTILO_MANT = {
  'Abierto':    'bg-amber-50 text-amber-700',
  'En proceso': 'bg-[#E3F5FA] text-[#11809A]',
  'Cerrado':    'bg-[#E3F4EC] text-[#0F7B55]',
}
const abierto = m => m.estado?.nombre !== 'Cerrado'

const ESTILO_ESTADO_EQUIPO = {
  'En mantenimiento': 'bg-amber-50 text-amber-700',
  'Reservado':        'bg-[#E3F5FA] text-[#11809A]',
}

export default function PortalClienteClient({ cliente, equipos, mantenimientos, categorias }) {
  const [tab, setTab]             = useState('equipos') // 'equipos' | 'pacientes' | 'mantenimientos'
  const [busqueda, setBusqueda]   = useState('')
  const [chip, setChip]           = useState('todos')
  const [filtroTipo, setFiltroTipo] = useState('')
  const [verFiltros, setVerFiltros] = useState(false)
  const [detalle, setDetalle]     = useState(null) // equipo abierto en la hoja de detalle
  const [saliendo, setSaliendo]   = useState(false)

  const equipoPorId = useMemo(() => Object.fromEntries(equipos.map(e => [e.id, e])), [equipos])

  // Pacientes = los que tienen asignado alguno de sus equipos hoy
  const pacientes = useMemo(() => {
    const mapa = new Map()
    for (const e of equipos) {
      const p = e.paciente_actual
      if (!p) continue
      if (!mapa.has(p.id)) mapa.set(p.id, { ...p, equipos: [] })
      mapa.get(p.id).equipos.push(e)
    }
    return [...mapa.values()].sort((a, b) => a.nombre.localeCompare(b.nombre))
  }, [equipos])

  const tipos = useMemo(() => {
    const conteo = new Map()
    for (const e of equipos) conteo.set(nombreTipo(e.tipo_equipo), (conteo.get(nombreTipo(e.tipo_equipo)) || 0) + 1)
    return [...conteo.entries()].sort((a, b) => b[1] - a[1])
  }, [equipos])

  const mantOrdenados = useMemo(() =>
    [...mantenimientos].sort((a, b) => (b.fecha_apertura || '').localeCompare(a.fecha_apertura || '')),
  [mantenimientos])
  const mantAbiertos = mantenimientos.filter(abierto).length

  const q = normalizar(busqueda.trim())

  const equiposFiltrados = useMemo(() => equipos.filter(e => {
    if (chip === 'con_paciente' && !e.paciente_actual) return false
    if (chip === 'sin_paciente' && e.paciente_actual) return false
    if (chip === 'en_mant' && e.estado?.nombre !== 'En mantenimiento') return false
    if (filtroTipo && nombreTipo(e.tipo_equipo) !== filtroTipo) return false
    if (!q) return true
    return [e.codigo, e.atributos?.serie, e.atributos?.modelo, nombreTipo(e.tipo_equipo), e.tipo_equipo?.nombre, e.paciente_actual?.nombre, e.paciente_actual?.cedula]
      .some(v => normalizar(v).includes(q))
  }), [equipos, chip, filtroTipo, q])

  const pacientesFiltrados = useMemo(() => pacientes.filter(p =>
    !q || [p.nombre, p.cedula, p.ciudad, ...p.equipos.map(e => e.codigo)].some(v => normalizar(v).includes(q))
  ), [pacientes, q])

  const mantFiltrados = useMemo(() => mantOrdenados.filter(m => {
    if (chip === 'abiertos' && !abierto(m)) return false
    if (chip === 'cerrados' && abierto(m)) return false
    if (!q) return true
    const eq = equipoPorId[m.equipo_id]
    return [m.codigo, m.tipo?.nombre, m.estado?.nombre, m.tecnico, eq?.codigo, nombreTipo(eq?.tipo_equipo), eq?.paciente_actual?.nombre]
      .some(v => normalizar(v).includes(q))
  }), [mantOrdenados, equipoPorId, chip, q])

  const pagEquipos   = usePaginacion(equiposFiltrados, 20)
  const pagPacientes = usePaginacion(pacientesFiltrados, 20)
  const pagMant      = usePaginacion(mantFiltrados, 20)

  function cambiarTab(id) {
    setTab(id); setChip('todos'); setFiltroTipo(''); setVerFiltros(false)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  // ESC cierra la hoja de detalle
  useEffect(() => {
    if (!detalle) return
    const onEsc = e => { if (e.key === 'Escape') setDetalle(null) }
    window.addEventListener('keydown', onEsc)
    return () => window.removeEventListener('keydown', onEsc)
  }, [detalle])

  async function salir() {
    setSaliendo(true)
    // Sin bitácora: bitacora.usuario_id apunta a `usuarios` y el cliente no está ahí
    await createClient().auth.signOut()
    window.location.href = '/login?cliente=1'
  }

  const nit = cliente.nit_cc ? `${cliente.nit_cc}${cliente.digito_verificacion ? `-${cliente.digito_verificacion}` : ''}` : null

  const TABS = [
    { id: 'equipos',        label: 'Equipos',        Icono: Package,    total: equipos.length,  badge: 'bg-[#D81B43] text-white' },
    { id: 'pacientes',      label: 'Pacientes',      Icono: HeartPulse, total: pacientes.length, badge: 'bg-[#2EB5D4] text-[#0F1E36]' },
    { id: 'mantenimientos', label: 'Mantenimientos', Icono: Wrench,     total: mantAbiertos,     badge: 'bg-amber-400 text-[#0F1E36]' },
  ]

  const CHIPS = tab === 'equipos'
    ? [
        { id: 'todos',        label: 'Todos',        n: equipos.length },
        { id: 'con_paciente', label: 'Con paciente', n: equipos.filter(e => e.paciente_actual).length },
        { id: 'sin_paciente', label: 'Sin paciente', n: equipos.filter(e => !e.paciente_actual).length },
        ...(equipos.some(e => e.estado?.nombre === 'En mantenimiento')
          ? [{ id: 'en_mant', label: 'En mantenimiento', n: equipos.filter(e => e.estado?.nombre === 'En mantenimiento').length }]
          : []),
      ]
    : tab === 'mantenimientos'
      ? [
          { id: 'todos',    label: 'Todos',    n: mantenimientos.length },
          { id: 'abiertos', label: 'Abiertos', n: mantAbiertos },
          { id: 'cerrados', label: 'Cerrados', n: mantenimientos.length - mantAbiertos },
        ]
      : []

  const reportar = `mailto:${EMPRESA.email}?subject=${encodeURIComponent(`Portal de clientes — ${cliente.nombre}`)}`

  return (
    <div className="pb-[calc(96px+env(safe-area-inset-bottom))] md:pb-10">
      {/* ── BLOQUE AZUL ── */}
      <header className="bg-[#1B3A6B] rounded-b-[28px] px-[18px] md:px-0 pt-4 pb-[26px] md:pb-8">
        <div className="max-w-5xl mx-auto md:px-8 flex flex-col gap-[22px]">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-[10px] bg-white flex items-center justify-center" aria-hidden>
                <Plus size={20} strokeWidth={3} className="text-[#D81B43]" />
              </div>
              <div className="flex flex-col gap-px">
                <span className="text-[14px] font-extrabold text-white tracking-[0.06em]">INGEMEDIC</span>
                <span className="text-[11px] font-medium text-[#B9C8E0]">Portal de clientes</span>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <div aria-hidden
                className="w-10 h-10 rounded-full border-2 border-[#2EB5D4] bg-[#274B82] text-white text-[13px] font-bold flex items-center justify-center">
                {iniciales(cliente.nombre)}
              </div>
              <button type="button" onClick={salir} disabled={saliendo} aria-label="Cerrar sesión"
                className="w-10 h-10 rounded-xl border border-[#3A5A8C] flex items-center justify-center text-white hover:bg-white/10 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2EB5D4]">
                {saliendo ? <Loader2 size={18} className="animate-spin" /> : <LogOut size={18} />}
              </button>
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <span className="text-[13px] font-medium text-[#B9C8E0]">Hola, bienvenido</span>
            <h1 className="m-0 text-[28px] md:text-[32px] leading-[1.1] font-extrabold text-white tracking-[-0.01em]">{cliente.nombre}</h1>
            {nit && (
              <div>
                <span className="inline-block text-[12px] font-semibold text-[#DDE6F3] bg-[#274B82] px-2.5 py-1 rounded-full">NIT / CC {nit}</span>
              </div>
            )}
          </div>

          {/* Pestañas en pantallas medianas (en celular van abajo) */}
          <nav aria-label="Secciones" className="hidden md:flex gap-2">
            {TABS.map(({ id, label, Icono, total, badge }) => (
              <button key={id} type="button" onClick={() => cambiarTab(id)} aria-current={tab === id ? 'page' : undefined}
                className={`h-11 px-4 rounded-full flex items-center gap-2 text-[14px] font-bold transition-colors ${
                  tab === id ? 'bg-white text-[#1B3A6B]' : 'text-[#DDE6F3] hover:bg-white/10'
                }`}>
                <Icono size={18} /> {label}
                {total > 0 && <span className={`min-w-[22px] h-[22px] px-1.5 rounded-full text-[11px] font-extrabold flex items-center justify-center ${badge}`}>{total}</span>}
              </button>
            ))}
          </nav>
        </div>
      </header>

      <main className="max-w-5xl mx-auto">
        {/* ── BUSCADOR Y FILTROS ── */}
        <div className="px-3.5 md:px-8 pt-5 flex flex-col gap-3">
          <div className="flex gap-2">
            <label className="flex-1 min-w-0 h-12 flex items-center gap-2.5 px-3.5 bg-white border border-[#DCE3ED] rounded-[14px] focus-within:border-[#2EB5D4] focus-within:ring-2 focus-within:ring-[#2EB5D4]/20">
              <Search size={18} className="text-[#5B6B82] flex-shrink-0" aria-hidden />
              <input type="search" value={busqueda} onChange={e => setBusqueda(e.target.value)}
                aria-label="Buscar"
                placeholder={tab === 'equipos' ? 'Código, serie, equipo o paciente'
                  : tab === 'pacientes' ? 'Nombre, cédula o código de equipo'
                  : 'Código, equipo o técnico'}
                className="flex-1 min-w-0 border-none outline-none bg-transparent text-[16px] md:text-[14px] text-[#0F1E36] placeholder:text-[#7A889C]" />
            </label>
            {tab === 'equipos' && tipos.length > 1 && (
              <button type="button" onClick={() => setVerFiltros(v => !v)} aria-label="Filtrar por tipo de equipo" aria-expanded={verFiltros}
                className={`w-12 h-12 flex-shrink-0 rounded-[14px] border flex items-center justify-center transition-colors ${
                  verFiltros || filtroTipo ? 'bg-[#1B3A6B] border-[#1B3A6B] text-white' : 'bg-white border-[#DCE3ED] text-[#1B3A6B]'
                }`}>
                <SlidersHorizontal size={18} />
              </button>
            )}
          </div>

          {verFiltros && tab === 'equipos' && (
            <div className="relative">
              <select value={filtroTipo} onChange={e => setFiltroTipo(e.target.value)} aria-label="Tipo de equipo"
                className="w-full h-12 appearance-none pl-3.5 pr-10 bg-white border border-[#DCE3ED] rounded-[14px] text-[16px] md:text-[14px] font-semibold text-[#334259] outline-none focus:border-[#2EB5D4]">
                <option value="">Todos los tipos de equipo</option>
                {tipos.map(([n, c]) => <option key={n} value={n}>{n} ({c})</option>)}
              </select>
              <ChevronDown size={16} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[#334259] pointer-events-none" aria-hidden />
            </div>
          )}

          {CHIPS.length > 0 && (
            <div className="flex gap-2 overflow-x-auto -mx-3.5 px-3.5 md:mx-0 md:px-0 pb-0.5 [scrollbar-width:none]">
              {CHIPS.map(c => (
                <button key={c.id} type="button" onClick={() => setChip(c.id)} aria-pressed={chip === c.id}
                  className={`h-9 px-3.5 rounded-full text-[13px] whitespace-nowrap flex-shrink-0 transition-colors ${
                    chip === c.id ? 'bg-[#1B3A6B] text-white font-bold' : 'bg-white border border-[#DCE3ED] text-[#334259] font-semibold hover:border-[#B8C4D4]'
                  }`}>
                  {c.label} · {c.n}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* ── LISTAS ── */}
        <section className="px-3.5 md:px-8 pt-[22px] flex flex-col gap-2.5">
          {tab === 'equipos' && (
            <>
              <Encabezado titulo="Tus equipos" total={equiposFiltrados.length} />
              {equiposFiltrados.length === 0 ? (
                <Vacio texto={equipos.length ? 'Ningún equipo coincide con la búsqueda.' : 'No tienes equipos asignados en este momento.'} />
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                  {pagEquipos.itemsPagina.map(e => (
                    <button key={e.id} type="button" onClick={() => setDetalle(e)}
                      className="min-w-0 text-left bg-white border border-[#E3E9F1] rounded-[18px] p-3.5 flex gap-3 items-center hover:border-[#B8C4D4] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2EB5D4]">
                      <div className="w-[52px] h-[52px] flex-shrink-0 rounded-[14px] bg-[#EEF3FA] flex items-center justify-center overflow-hidden">
                        <IconoTipo tipo={e.tipo_equipo} categorias={categorias} size={30} />
                      </div>
                      <div className="flex-1 min-w-0 flex flex-col gap-1.5">
                        <div className="flex items-center gap-2 min-w-0">
                          <span style={MONO} className="text-[11px] font-semibold text-[#1B3A6B] bg-[#E8EEF7] px-[7px] py-[3px] rounded-md flex-shrink-0">{e.codigo || '—'}</span>
                          {e.atributos?.serie && <span className="text-[12px] font-medium text-[#5B6B82] truncate">Serie {e.atributos.serie}</span>}
                        </div>
                        <div className="flex flex-col gap-px min-w-0">
                          <span className="text-[15px] font-bold text-[#0F1E36] truncate">{nombreTipo(e.tipo_equipo)}</span>
                          {e.tipo_equipo?.nombre && e.tipo_equipo.nombre !== nombreTipo(e.tipo_equipo) && (
                            <span className="text-[12px] font-medium text-[#5B6B82] truncate">{e.tipo_equipo.nombre}</span>
                          )}
                        </div>
                        <div className="flex items-center gap-1.5 flex-wrap min-w-0">
                          <PacientePill nombre={e.paciente_actual?.nombre} />
                          {ESTILO_ESTADO_EQUIPO[e.estado?.nombre] && (
                            <span className={`text-[12px] font-bold px-[9px] py-1 rounded-full ${ESTILO_ESTADO_EQUIPO[e.estado.nombre]}`}>{e.estado.nombre}</span>
                          )}
                        </div>
                      </div>
                      <ChevronRight size={20} className="text-[#8A97AA] flex-shrink-0" aria-hidden />
                    </button>
                  ))}
                </div>
              )}
              <Pie {...pagEquipos} />
            </>
          )}

          {tab === 'pacientes' && (
            <>
              <Encabezado titulo="Tus pacientes" total={pacientesFiltrados.length} />
              {pacientesFiltrados.length === 0 ? (
                <Vacio texto={pacientes.length ? 'Ningún paciente coincide con la búsqueda.' : 'Ninguno de tus equipos tiene un paciente asignado.'} />
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                  {pagPacientes.itemsPagina.map(p => (
                    <div key={p.id} className="min-w-0 bg-white border border-[#E3E9F1] rounded-[18px] p-3.5 flex gap-3">
                      <div className="w-[52px] h-[52px] flex-shrink-0 rounded-[14px] bg-[#E3F4EC] text-[#0F7B55] flex items-center justify-center text-[15px] font-extrabold">
                        {iniciales(p.nombre)}
                      </div>
                      <div className="flex-1 min-w-0 flex flex-col gap-1.5">
                        <span className="text-[15px] font-bold text-[#0F1E36] leading-tight">{p.nombre}</span>
                        <span className="text-[12px] font-medium text-[#5B6B82]">
                          {p.cedula ? `CC ${p.cedula}` : 'Sin cédula registrada'}
                          {p.ciudad && <> · {p.ciudad}</>}
                        </span>
                        <div className="flex flex-wrap gap-1.5 pt-0.5">
                          {p.equipos.map(e => (
                            <button key={e.id} type="button" onClick={() => setDetalle(e)}
                              className="inline-flex items-center gap-1.5 max-w-full px-2 py-1 rounded-lg bg-[#F0F2F6] hover:bg-[#E8EEF7] text-[12px] text-[#334259]">
                              <span style={MONO} className="font-semibold text-[#1B3A6B]">{e.codigo || '—'}</span>
                              <span className="truncate">{nombreTipo(e.tipo_equipo)}</span>
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
              <Pie {...pagPacientes} />
            </>
          )}

          {tab === 'mantenimientos' && (
            <>
              <Encabezado titulo="Mantenimientos" total={mantFiltrados.length} />
              {mantFiltrados.length === 0 ? (
                <Vacio texto={mantenimientos.length ? 'Ningún mantenimiento coincide con la búsqueda.' : 'Tus equipos aún no tienen mantenimientos registrados.'} />
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                  {pagMant.itemsPagina.map(m => <TarjetaMant key={m.id} m={m} eq={equipoPorId[m.equipo_id]} onEquipo={setDetalle} />)}
                </div>
              )}
              <Pie {...pagMant} />
            </>
          )}
        </section>

        {/* ── AYUDA ── */}
        <div className="px-3.5 md:px-8 pt-[22px]">
          <div className="bg-white border border-[#E3E9F1] rounded-[18px] p-4 flex items-center gap-3">
            <div className="w-[42px] h-[42px] flex-shrink-0 rounded-xl bg-[#E3F5FA] flex items-center justify-center" aria-hidden>
              <MessageCircle size={20} className="text-[#11809A]" />
            </div>
            <div className="flex-1 min-w-0 flex flex-col gap-0.5">
              <span className="text-[14px] font-bold text-[#0F1E36]">¿Algo no cuadra?</span>
              <span className="text-[12px] font-medium text-[#5B6B82]">Escríbenos y lo revisamos.</span>
            </div>
            <a href={reportar}
              className="h-10 px-3.5 rounded-xl bg-[#D81B43] hover:bg-[#B8173A] text-white text-[13px] font-bold flex items-center flex-shrink-0 transition-colors">
              Reportar
            </a>
          </div>
        </div>
      </main>

      {/* ── BARRA INFERIOR (celular) ── */}
      <nav aria-label="Secciones"
        className="md:hidden fixed inset-x-0 bottom-0 z-30 bg-white border-t border-[#E3E9F1] shadow-[0_-6px_20px_rgba(27,58,107,0.08)] px-2.5 pt-2 grid grid-cols-3 gap-1.5"
        style={{ paddingBottom: 'calc(10px + env(safe-area-inset-bottom))' }}>
        {TABS.map(({ id, label, Icono, total, badge }) => {
          const activa = tab === id
          return (
            <button key={id} type="button" onClick={() => cambiarTab(id)} aria-current={activa ? 'page' : undefined}
              className="py-1.5 flex flex-col items-center gap-1 min-w-0">
              <div className={`relative w-16 h-[34px] rounded-full flex items-center justify-center ${activa ? 'bg-[#1B3A6B]' : ''}`}>
                <Icono size={20} className={activa ? 'text-white' : 'text-[#4F5E74]'} />
                {total > 0 && (
                  <span className={`absolute -top-1.5 right-1 min-w-[20px] h-5 px-[5px] rounded-full border-2 border-white text-[11px] font-extrabold flex items-center justify-center ${badge}`}>
                    {total}
                  </span>
                )}
              </div>
              <span className={`text-[12px] truncate max-w-full ${activa ? 'font-extrabold text-[#1B3A6B]' : 'font-semibold text-[#4F5E74]'}`}>{label}</span>
            </button>
          )
        })}
      </nav>

      {/* ── DETALLE DEL EQUIPO ── */}
      {detalle && (
        <DetalleEquipo
          equipo={detalle}
          categorias={categorias}
          mantenimientos={mantOrdenados.filter(m => m.equipo_id === detalle.id)}
          onCerrar={() => setDetalle(null)}
        />
      )}
    </div>
  )
}

function Encabezado({ titulo, total }) {
  return (
    <div className="flex items-baseline justify-between px-1">
      <h2 className="m-0 text-[16px] font-extrabold text-[#0F1E36]">{titulo}</h2>
      <span className="text-[12px] font-semibold text-[#5B6B82]">{total} resultado{total !== 1 ? 's' : ''}</span>
    </div>
  )
}

function PacientePill({ nombre }) {
  return nombre ? (
    <span className="inline-flex items-center gap-[5px] max-w-full text-[12px] font-bold text-[#0F7B55] bg-[#E3F4EC] px-[9px] py-1 rounded-full">
      <User size={12} strokeWidth={2.4} className="flex-shrink-0" aria-hidden />
      <span className="truncate">{nombre}</span>
    </span>
  ) : (
    <span className="inline-flex items-center gap-[5px] text-[12px] font-semibold text-[#4F5E74] bg-[#F0F2F6] px-[9px] py-1 rounded-full">
      <User size={12} strokeWidth={2.4} aria-hidden /> Sin paciente
    </span>
  )
}

function EstadoMant({ nombre }) {
  return (
    <span className={`text-[12px] font-bold px-[9px] py-1 rounded-full whitespace-nowrap ${ESTILO_MANT[nombre] || 'bg-[#F0F2F6] text-[#4F5E74]'}`}>
      {nombre || '—'}
    </span>
  )
}

function TarjetaMant({ m, eq, onEquipo }) {
  const cierre = m.fecha_cierre_real || m.fecha_cierre
  return (
    <div className="min-w-0 bg-white border border-[#E3E9F1] rounded-[18px] p-3.5 flex flex-col gap-2">
      <div className="flex items-center justify-between gap-2">
        <span style={MONO} className="text-[11px] font-semibold text-[#1B3A6B] bg-[#E8EEF7] px-[7px] py-[3px] rounded-md">{m.codigo || '—'}</span>
        <EstadoMant nombre={m.estado?.nombre} />
      </div>
      {eq ? (
        <button type="button" onClick={() => onEquipo(eq)} className="text-left min-w-0 group">
          <span className="block text-[15px] font-bold text-[#0F1E36] group-hover:underline truncate">{nombreTipo(eq.tipo_equipo)} · {eq.codigo}</span>
          {eq.paciente_actual?.nombre && <span className="block text-[12px] font-medium text-[#5B6B82] truncate">Paciente: {eq.paciente_actual.nombre}</span>}
        </button>
      ) : <span className="text-[15px] font-bold text-[#0F1E36]">Equipo</span>}
      <span className="text-[12px] font-medium text-[#5B6B82]">
        {m.tipo?.nombre || 'Mantenimiento'} · abierto {formatear(m.fecha_apertura)}
        {cierre && <> · cerrado {formatear(cierre)}</>}
      </span>
      {m.tecnico && <span className="text-[12px] font-medium text-[#5B6B82]">Técnico: {m.tecnico}</span>}
      {m.observaciones_cliente && <p className="m-0 text-[13px] text-[#334259] bg-[#F4F6FA] rounded-xl px-3 py-2">{m.observaciones_cliente}</p>}
    </div>
  )
}

// Paginación con el lenguaje del diseño (reemplaza al <Paginador /> genérico aquí)
function Pie({ paginaActual, totalPaginas, setPagina, porPagina, setPorPagina, total }) {
  if (total === 0) return null
  const inicio = (paginaActual - 1) * porPagina + 1
  const fin = Math.min(paginaActual * porPagina, total)
  return (
    <div className="flex items-center justify-between gap-2 px-1 pt-1.5">
      <span className="text-[12px] font-medium text-[#5B6B82]">Mostrando {inicio}–{fin} de {total}</span>
      <div className="flex items-center gap-1.5">
        {totalPaginas > 1 && (
          <>
            <button type="button" onClick={() => setPagina(p => Math.max(1, p - 1))} disabled={paginaActual === 1} aria-label="Página anterior"
              className="w-9 h-9 rounded-[10px] border border-[#DCE3ED] bg-white flex items-center justify-center text-[#334259] disabled:opacity-40">
              <ChevronLeft size={16} />
            </button>
            <button type="button" onClick={() => setPagina(p => Math.min(totalPaginas, p + 1))} disabled={paginaActual === totalPaginas} aria-label="Página siguiente"
              className="w-9 h-9 rounded-[10px] border border-[#DCE3ED] bg-white flex items-center justify-center text-[#334259] disabled:opacity-40">
              <ChevronRight size={16} />
            </button>
          </>
        )}
        <div className="relative">
          <select value={porPagina} onChange={e => setPorPagina(Number(e.target.value))} aria-label="Resultados por página"
            className="h-9 appearance-none pl-3 pr-8 rounded-[10px] border border-[#DCE3ED] bg-white text-[12px] font-semibold text-[#334259] outline-none focus:border-[#2EB5D4]">
            {[20, 50, 100].map(n => <option key={n} value={n}>{n} por página</option>)}
          </select>
          <ChevronDown size={14} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#334259] pointer-events-none" aria-hidden />
        </div>
      </div>
    </div>
  )
}

function Vacio({ texto }) {
  return (
    <div className="bg-white border border-[#E3E9F1] rounded-[18px] py-12 px-4 text-center text-[14px] font-medium text-[#5B6B82]">
      {texto}
    </div>
  )
}

// Hoja de detalle: desde abajo en celular, centrada en pantallas medianas
function DetalleEquipo({ equipo: e, categorias, mantenimientos, onCerrar }) {
  const p = e.paciente_actual
  const datos = [
    ['Código', e.codigo],
    ['Serie', e.atributos?.serie],
    ['Modelo', e.atributos?.modelo],
    ['Referencia', e.tipo_equipo?.nombre !== nombreTipo(e.tipo_equipo) ? e.tipo_equipo?.nombre : null],
    ['Estado', e.estado?.nombre],
  ].filter(([, v]) => v)

  return (
    <div className="fixed inset-0 z-40 flex items-end md:items-center justify-center md:p-4" role="dialog" aria-modal="true" aria-label={`Equipo ${e.codigo || ''}`}>
      <div className="absolute inset-0 bg-[#0F1E36]/50" onClick={onCerrar} />
      <div className="relative w-full md:max-w-lg max-h-[92vh] md:max-h-[85vh] bg-[#F4F6FA] rounded-t-[24px] md:rounded-[24px] flex flex-col overflow-hidden shadow-2xl">
        <div className="bg-[#1B3A6B] px-[18px] pt-3 pb-5 flex flex-col gap-3">
          <div className="md:hidden mx-auto w-10 h-1 rounded-full bg-white/30" aria-hidden />
          <div className="flex items-start gap-3">
            <div className="w-[52px] h-[52px] flex-shrink-0 rounded-[14px] bg-white flex items-center justify-center overflow-hidden">
              <IconoTipo tipo={e.tipo_equipo} categorias={categorias} size={30} />
            </div>
            <div className="flex-1 min-w-0">
              <span style={MONO} className="inline-block text-[11px] font-semibold text-[#DDE6F3] bg-[#274B82] px-[7px] py-[3px] rounded-md">{e.codigo || '—'}</span>
              <h3 className="m-0 mt-1.5 text-[20px] font-extrabold text-white leading-tight">{nombreTipo(e.tipo_equipo)}</h3>
            </div>
            <button type="button" onClick={onCerrar} aria-label="Cerrar"
              className="w-10 h-10 flex-shrink-0 rounded-xl border border-[#3A5A8C] text-white flex items-center justify-center hover:bg-white/10">
              <X size={18} />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-3.5 flex flex-col gap-2.5" style={{ paddingBottom: 'calc(20px + env(safe-area-inset-bottom))' }}>
          <div className="bg-white border border-[#E3E9F1] rounded-[18px] p-4 grid grid-cols-2 gap-x-4 gap-y-3">
            {datos.map(([k, v]) => (
              <div key={k} className="min-w-0">
                <div className="text-[11px] font-bold uppercase tracking-[0.06em] text-[#7A889C]">{k}</div>
                <div className="text-[14px] font-semibold text-[#0F1E36] break-words">{v}</div>
              </div>
            ))}
          </div>

          <div className="bg-white border border-[#E3E9F1] rounded-[18px] p-4 flex flex-col gap-1">
            <div className="text-[11px] font-bold uppercase tracking-[0.06em] text-[#7A889C]">Paciente</div>
            {p ? (
              <>
                <div className="text-[15px] font-bold text-[#0F1E36]">{p.nombre}</div>
                <div className="text-[13px] font-medium text-[#5B6B82]">{p.cedula ? `CC ${p.cedula}` : 'Sin cédula registrada'}</div>
                {(p.direccion || p.ciudad) && (
                  <div className="text-[13px] font-medium text-[#5B6B82] flex items-start gap-1">
                    <MapPin size={13} className="mt-0.5 flex-shrink-0" aria-hidden />
                    <span>{[p.direccion, p.ciudad].filter(Boolean).join(', ')}</span>
                  </div>
                )}
              </>
            ) : <div className="text-[14px] font-medium text-[#5B6B82]">Sin paciente asignado</div>}
          </div>

          <div className="flex items-baseline justify-between px-1 pt-1">
            <h4 className="m-0 text-[15px] font-extrabold text-[#0F1E36]">Mantenimientos</h4>
            <span className="text-[12px] font-semibold text-[#5B6B82]">{mantenimientos.length}</span>
          </div>
          {mantenimientos.length === 0 ? (
            <div className="bg-white border border-[#E3E9F1] rounded-[18px] p-4 text-[13px] font-medium text-[#5B6B82]">Este equipo no tiene mantenimientos registrados.</div>
          ) : mantenimientos.map(m => (
            <div key={m.id} className="bg-white border border-[#E3E9F1] rounded-[18px] p-3.5 flex flex-col gap-1.5">
              <div className="flex items-center justify-between gap-2">
                <span style={MONO} className="text-[11px] font-semibold text-[#1B3A6B] bg-[#E8EEF7] px-[7px] py-[3px] rounded-md">{m.codigo || '—'}</span>
                <EstadoMant nombre={m.estado?.nombre} />
              </div>
              <span className="text-[12px] font-medium text-[#5B6B82]">
                {m.tipo?.nombre || 'Mantenimiento'} · abierto {formatear(m.fecha_apertura)}
                {(m.fecha_cierre_real || m.fecha_cierre) && <> · cerrado {formatear(m.fecha_cierre_real || m.fecha_cierre)}</>}
              </span>
              {m.observaciones_cliente && <p className="m-0 text-[13px] text-[#334259]">{m.observaciones_cliente}</p>}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
