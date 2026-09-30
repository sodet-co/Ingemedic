'use client'
import { useState, useMemo } from 'react'
import { Search, Package, HeartPulse, Wrench, MapPin, User } from 'lucide-react'
import Paginador from '@/components/ui/Paginador'
import LimpiarFiltros from '@/components/ui/LimpiarFiltros'
import { IconoTipo } from '@/components/inventario/IconoTipo'
import { usePaginacion } from '@/hooks/usePaginacion'
import { formatear } from '@/lib/fechas'

const nombreTipo = tipo => tipo?.atributos?.nombre || tipo?.nombre || 'Equipo'

// Colores por estado de mantenimiento (Abierto / En proceso / Cerrado)
const ESTILO_MANT = {
  'Abierto':    'bg-amber-50 text-amber-700',
  'En proceso': 'bg-[#E8F7FB] text-[#0E6F85]',
  'Cerrado':    'bg-green-50 text-[#0F7B55]',
}

const ESTILO_ESTADO_EQUIPO = {
  'En mantenimiento': 'bg-amber-50 text-amber-700',
  'Reservado':        'bg-[#E8F7FB] text-[#0E6F85]',
}

const normalizar = s => (s || '').toString().normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()

export default function PortalClienteClient({ cliente, equipos, mantenimientos, categorias }) {
  const [tab, setTab]       = useState('equipos') // 'equipos' | 'pacientes' | 'mantenimientos'
  const [busqueda, setBusqueda] = useState('')
  const [filtroTipo, setFiltroTipo] = useState('')

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

  const tiposConConteo = useMemo(() => {
    const conteo = new Map()
    for (const e of equipos) {
      const n = nombreTipo(e.tipo_equipo)
      conteo.set(n, (conteo.get(n) || 0) + 1)
    }
    return [...conteo.entries()].sort((a, b) => b[1] - a[1])
  }, [equipos])

  const mantOrdenados = useMemo(() =>
    [...mantenimientos].sort((a, b) => (b.fecha_apertura || '').localeCompare(a.fecha_apertura || '')),
  [mantenimientos])
  const mantAbiertos = mantenimientos.filter(m => m.estado?.nombre !== 'Cerrado').length

  const q = normalizar(busqueda.trim())

  const equiposFiltrados = useMemo(() => equipos.filter(e => {
    if (filtroTipo && nombreTipo(e.tipo_equipo) !== filtroTipo) return false
    if (!q) return true
    return [e.codigo, e.atributos?.serie, e.atributos?.modelo, nombreTipo(e.tipo_equipo), e.tipo_equipo?.nombre, e.paciente_actual?.nombre, e.paciente_actual?.cedula]
      .some(v => normalizar(v).includes(q))
  }), [equipos, filtroTipo, q])

  const pacientesFiltrados = useMemo(() => pacientes.filter(p =>
    !q || [p.nombre, p.cedula, p.ciudad, ...p.equipos.map(e => e.codigo)].some(v => normalizar(v).includes(q))
  ), [pacientes, q])

  const mantFiltrados = useMemo(() => mantOrdenados.filter(m => {
    if (!q) return true
    const eq = equipoPorId[m.equipo_id]
    return [m.codigo, m.tipo?.nombre, m.estado?.nombre, m.tecnico, eq?.codigo, nombreTipo(eq?.tipo_equipo), eq?.paciente_actual?.nombre]
      .some(v => normalizar(v).includes(q))
  }), [mantOrdenados, equipoPorId, q])

  const pagEquipos   = usePaginacion(equiposFiltrados, 20)
  const pagPacientes = usePaginacion(pacientesFiltrados, 20)
  const pagMant      = usePaginacion(mantFiltrados, 20)

  const hayFiltros = !!busqueda || !!filtroTipo
  function limpiar() { setBusqueda(''); setFiltroTipo('') }

  const TABS = [
    { id: 'equipos',        label: 'Equipos',        Icono: Package,    total: equipos.length },
    { id: 'pacientes',      label: 'Pacientes',      Icono: HeartPulse, total: pacientes.length },
    { id: 'mantenimientos', label: 'Mantenimientos', Icono: Wrench,     total: mantenimientos.length },
  ]

  const nit = cliente.nit_cc ? `${cliente.nit_cc}${cliente.digito_verificacion ? `-${cliente.digito_verificacion}` : ''}` : null

  return (
    <div className="max-w-6xl mx-auto p-3 md:p-6 pb-[calc(2.5rem+env(safe-area-inset-bottom))]">
      {/* Saludo + resumen */}
      <section className="mb-4 md:mb-6">
        <h1 className="text-[22px] md:text-[26px] font-extrabold text-[#1B3A6B] leading-tight">{cliente.nombre}</h1>
        {nit && <p className="text-[13.5px] text-slate-500 mt-0.5">NIT / CC {nit}</p>}

        <div className="grid grid-cols-3 gap-2 md:gap-4 mt-4">
          {[
            { label: 'Equipos asignados', corto: 'Equipos', valor: equipos.length, Icono: Package, color: '#D81B43' },
            { label: 'Pacientes', corto: 'Pacientes', valor: pacientes.length, Icono: HeartPulse, color: '#2EB5D4' },
            { label: 'Mantenimientos abiertos', corto: 'En mantenim.', valor: mantAbiertos, Icono: Wrench, color: '#1B3A6B' },
          ].map(k => (
            <div key={k.label} className="bg-white rounded-[14px] border border-slate-200 p-3 md:p-5 min-w-0">
              <k.Icono size={18} style={{ color: k.color }} aria-hidden />
              <div className="text-[24px] md:text-[30px] font-extrabold text-slate-800 leading-none mt-2 tabular-nums">{k.valor}</div>
              <div className="text-[12px] md:text-[13px] text-slate-500 mt-1 leading-tight">
                <span className="sm:hidden">{k.corto}</span>
                <span className="hidden sm:inline">{k.label}</span>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="bg-white rounded-[16px] border border-slate-200 overflow-hidden">
        {/* Pestañas */}
        {/* En celular las tres pestañas se reparten el ancho (antes la tercera
            quedaba cortada); desde sm van en fila, alineadas a la izquierda. */}
        <div role="tablist" className="grid grid-cols-3 sm:flex border-b border-slate-200">
          {TABS.map(({ id, label, Icono, total }) => (
            <button key={id} type="button" role="tab" aria-selected={tab === id}
              onClick={() => { setTab(id); setFiltroTipo('') }}
              className={`flex flex-col sm:flex-row items-center justify-center gap-0.5 sm:gap-1.5 px-1 sm:px-5 py-2 sm:py-0 sm:h-12 min-w-0 text-[12px] sm:text-[13.5px] font-semibold border-b-2 transition-colors ${
                tab === id ? 'border-[#D81B43] text-[#D81B43]' : 'border-transparent text-slate-500 hover:text-slate-700'
              }`}>
              <span className="flex items-center gap-1 sm:gap-1.5 min-w-0">
                <Icono size={15} className="flex-shrink-0" aria-hidden />
                <span className="truncate">{label}</span>
              </span>
              <span className="text-[11.5px] opacity-70 tabular-nums">
                <span className="sm:hidden">{total}</span>
                <span className="hidden sm:inline">({total})</span>
              </span>
            </button>
          ))}
        </div>

        {/* Buscador y filtro */}
        <div className="flex flex-col sm:flex-row gap-2 p-3 md:p-4 border-b border-slate-100">
          <div className="relative flex-1">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" aria-hidden />
            <input type="search" value={busqueda} onChange={e => setBusqueda(e.target.value)}
              aria-label="Buscar"
              placeholder={tab === 'equipos' ? 'Buscar por código, serie, equipo o paciente…'
                : tab === 'pacientes' ? 'Buscar por nombre, cédula o código de equipo…'
                : 'Buscar por código, equipo o técnico…'}
              className="w-full pl-9 pr-3 py-2.5 border border-slate-200 rounded-[9px] text-[16px] sm:text-[14px] outline-none focus:border-[#2EB5D4] focus:ring-2 focus:ring-[#2EB5D4]/20" />
          </div>
          {/* 16px en celular: con menos, iOS hace zoom al tocar el campo */}
          {tab === 'equipos' && tiposConConteo.length > 1 && (
            <select value={filtroTipo} onChange={e => setFiltroTipo(e.target.value)} aria-label="Filtrar por tipo de equipo"
              className="w-full sm:w-auto sm:max-w-[260px] border border-slate-200 rounded-[9px] text-[16px] sm:text-[14px] px-3 py-2.5 text-slate-700 outline-none focus:border-[#2EB5D4] bg-white">
              <option value="">Todos los equipos</option>
              {tiposConConteo.map(([n, c]) => <option key={n} value={n}>{n} ({c})</option>)}
            </select>
          )}
          <LimpiarFiltros activo={hayFiltros} onLimpiar={limpiar} className="self-center" />
        </div>

        {/* EQUIPOS */}
        {tab === 'equipos' && (
          equiposFiltrados.length === 0 ? (
            <Vacio Icono={Package} texto={equipos.length ? 'Ningún equipo coincide con la búsqueda.' : 'No tienes equipos asignados en este momento.'} />
          ) : (
            <>
              {/* grid-cols-1 + min-w-0: sin esto, un nombre de paciente largo
                  ensanchaba la tarjeta y se salía por la derecha en celular */}
              <ul className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 md:gap-3 p-3 md:p-4">
                {pagEquipos.itemsPagina.map(e => (
                  <li key={e.id} className="min-w-0 flex gap-3 p-3 rounded-[12px] border border-slate-200 bg-white">
                    <div className="w-14 h-14 rounded-[10px] bg-gradient-to-br from-rose-50 via-white to-slate-100 flex items-center justify-center flex-shrink-0 overflow-hidden">
                      <IconoTipo tipo={e.tipo_equipo} categorias={categorias} size={40} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-2">
                        <div className="text-[14px] font-bold text-slate-800 leading-tight">{nombreTipo(e.tipo_equipo)}</div>
                        {/* "En préstamo" es lo normal para el cliente: solo se marca lo distinto */}
                        {e.estado?.nombre && e.estado.nombre !== 'En préstamo' && (
                          <span className={`flex-shrink-0 px-2 py-0.5 rounded-full text-[11px] font-semibold whitespace-nowrap ${ESTILO_ESTADO_EQUIPO[e.estado.nombre] || 'bg-slate-100 text-slate-600'}`}>
                            {e.estado.nombre}
                          </span>
                        )}
                      </div>
                      {e.tipo_equipo?.nombre && e.tipo_equipo.nombre !== nombreTipo(e.tipo_equipo) && (
                        <div className="text-[12px] text-slate-500 truncate">{e.tipo_equipo.nombre}</div>
                      )}
                      <div className="text-[12px] text-slate-500 mt-1">
                        <span className="font-semibold text-slate-600">{e.codigo || '—'}</span>
                        {e.atributos?.serie && <> · Serie {e.atributos.serie}</>}
                      </div>
                      <div className="text-[12px] mt-1 flex items-center gap-1 text-slate-600 min-w-0">
                        <User size={12} className="flex-shrink-0 text-slate-400" aria-hidden />
                        <span className="truncate">{e.paciente_actual?.nombre || 'Sin paciente asignado'}</span>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
              <Paginador {...pagEquipos} />
            </>
          )
        )}

        {/* PACIENTES */}
        {tab === 'pacientes' && (
          pacientesFiltrados.length === 0 ? (
            <Vacio Icono={HeartPulse} texto={pacientes.length ? 'Ningún paciente coincide con la búsqueda.' : 'Ninguno de tus equipos tiene un paciente asignado.'} />
          ) : (
            <>
              <ul className="divide-y divide-slate-100">
                {pagPacientes.itemsPagina.map(p => (
                  <li key={p.id} className="p-3 md:px-5 md:py-4 flex flex-col md:flex-row md:items-center gap-2 md:gap-6">
                    <div className="min-w-0 md:w-[40%]">
                      <div className="text-[14px] font-bold text-slate-800">{p.nombre}</div>
                      <div className="text-[12px] text-slate-500 mt-0.5">
                        {p.cedula ? `CC ${p.cedula}` : 'Sin cédula registrada'}
                        {p.ciudad && <> · <MapPin size={11} className="inline -mt-0.5" aria-hidden /> {p.ciudad}</>}
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-1.5 flex-1">
                      {p.equipos.map(e => (
                        <span key={e.id} className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-slate-100 text-[12px] text-slate-700">
                          <span className="font-semibold">{e.codigo || '—'}</span> {nombreTipo(e.tipo_equipo)}
                        </span>
                      ))}
                    </div>
                  </li>
                ))}
              </ul>
              <Paginador {...pagPacientes} />
            </>
          )
        )}

        {/* MANTENIMIENTOS */}
        {tab === 'mantenimientos' && (
          mantFiltrados.length === 0 ? (
            <Vacio Icono={Wrench} texto={mantenimientos.length ? 'Ningún mantenimiento coincide con la búsqueda.' : 'Tus equipos aún no tienen mantenimientos registrados.'} />
          ) : (
            <>
              {/* Escritorio ancho: tabla. En tablet (768) las 7 columnas partían
                  cada texto en 4-5 líneas, así que ahí también van tarjetas. */}
              <div className="hidden lg:block overflow-x-auto">
                <table className="w-full text-[13px]">
                  <thead>
                    <tr className="text-left text-[11px] font-bold uppercase tracking-[0.07em] text-slate-500 bg-slate-50">
                      <th className="px-5 py-3">Código</th>
                      <th className="px-3 py-3">Equipo</th>
                      <th className="px-3 py-3">Tipo</th>
                      <th className="px-3 py-3">Apertura</th>
                      <th className="px-3 py-3">Cierre</th>
                      <th className="px-3 py-3">Técnico</th>
                      <th className="px-5 py-3">Estado</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {pagMant.itemsPagina.map(m => {
                      const eq = equipoPorId[m.equipo_id]
                      return (
                        <tr key={m.id} className="align-top">
                          <td className="px-5 py-3 font-semibold text-slate-700">{m.codigo || '—'}</td>
                          <td className="px-3 py-3">
                            <div className="text-slate-700">{nombreTipo(eq?.tipo_equipo)}</div>
                            <div className="text-[12px] text-slate-500">{eq?.codigo}{eq?.paciente_actual?.nombre && ` · ${eq.paciente_actual.nombre}`}</div>
                            {m.observaciones_cliente && <div className="text-[12px] text-slate-500 mt-1 max-w-[320px]">{m.observaciones_cliente}</div>}
                          </td>
                          <td className="px-3 py-3 text-slate-600">{m.tipo?.nombre || '—'}</td>
                          <td className="px-3 py-3 text-slate-600 whitespace-nowrap">{formatear(m.fecha_apertura)}</td>
                          <td className="px-3 py-3 text-slate-600 whitespace-nowrap">{formatear(m.fecha_cierre_real || m.fecha_cierre)}</td>
                          <td className="px-3 py-3 text-slate-600">{m.tecnico || '—'}</td>
                          <td className="px-5 py-3"><EstadoMant nombre={m.estado?.nombre} /></td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
              {/* Celular y tablet: tarjetas */}
              <ul className="lg:hidden grid grid-cols-1 md:grid-cols-2 gap-2 md:gap-3 p-3 md:p-4">
                {pagMant.itemsPagina.map(m => {
                  const eq = equipoPorId[m.equipo_id]
                  return (
                    <li key={m.id} className="min-w-0 p-3 rounded-[12px] border border-slate-200">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-[13.5px] font-bold text-slate-800">{m.codigo || '—'}</span>
                        <EstadoMant nombre={m.estado?.nombre} />
                      </div>
                      <div className="text-[13px] text-slate-700 mt-1">{nombreTipo(eq?.tipo_equipo)} · {eq?.codigo}</div>
                      {eq?.paciente_actual?.nombre && <div className="text-[12px] text-slate-500 mt-0.5 truncate">Paciente: {eq.paciente_actual.nombre}</div>}
                      <div className="text-[12px] text-slate-500 mt-0.5">
                        {m.tipo?.nombre || 'Mantenimiento'} · abierto {formatear(m.fecha_apertura)}
                        {(m.fecha_cierre_real || m.fecha_cierre) && <> · cierre {formatear(m.fecha_cierre_real || m.fecha_cierre)}</>}
                      </div>
                      {m.tecnico && <div className="text-[12px] text-slate-500 mt-0.5">Técnico: {m.tecnico}</div>}
                      {m.observaciones_cliente && <div className="text-[12px] text-slate-600 mt-1">{m.observaciones_cliente}</div>}
                    </li>
                  )
                })}
              </ul>
              <Paginador {...pagMant} />
            </>
          )
        )}
      </section>

      <p className="text-[12.5px] text-slate-500 text-center mt-6">
        ¿Ves algo que no cuadra? Escríbenos y lo revisamos.
      </p>
    </div>
  )
}

function EstadoMant({ nombre }) {
  return (
    <span className={`inline-block px-2 py-0.5 rounded-full text-[11.5px] font-semibold whitespace-nowrap ${ESTILO_MANT[nombre] || 'bg-slate-100 text-slate-600'}`}>
      {nombre || '—'}
    </span>
  )
}

function Vacio({ Icono, texto }) {
  return (
    <div className="text-center py-14 px-4 text-slate-500">
      <Icono size={36} className="mx-auto mb-3 text-slate-300" aria-hidden />
      <div className="text-[14px]">{texto}</div>
    </div>
  )
}
