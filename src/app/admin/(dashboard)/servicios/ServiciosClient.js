'use client'
import { useState, useMemo, Fragment } from 'react'
import { Search, Download, ToggleLeft, ToggleRight, Calendar } from 'lucide-react'
import { hoyBogota } from '@/lib/fechas'
import BuzonNovedades from '@/components/layout/BuzonNovedades'

export default function ServiciosClient({ serviciosIniciales }) {
  const [search, setSearch]       = useState('')
  const [filtroEstado, setFiltroEstado] = useState('todos')
  const [desde, setDesde]         = useState(() => hoyBogota().slice(0, 7) + '-01')
  const [hasta, setHasta]         = useState(() => hoyBogota())
  const [agrupado, setAgrupado]   = useState(false)

  const filtrados = useMemo(() => {
    return serviciosIniciales.filter(s => {
      const mq = !search || [s.cliente, s.equipo, s.codigo_equipo, s.codigo_orden]
        .some(v => v?.toLowerCase().includes(search.toLowerCase()))
      const me = filtroEstado === 'todos'
        || (filtroEstado === 'activo'     && !s.fecha_devolucion)
        || (filtroEstado === 'finalizado' && s.fecha_devolucion)
      let mp = true
      if (desde || hasta) {
        const ini = new Date(s.fecha_entrega)
        const fin = s.fecha_devolucion ? new Date(s.fecha_devolucion) : new Date()
        const dsd = desde ? new Date(desde) : new Date('2000-01-01')
        const hst = hasta ? new Date(hasta) : new Date('2099-01-01')
        mp = ini <= hst && fin >= dsd
      }
      return mq && me && mp
    })
  }, [serviciosIniciales, search, filtroEstado, desde, hasta])

  const stats = useMemo(() => {
    const activos    = filtrados.filter(s => !s.fecha_devolucion)
    const cliActivos = [...new Set(activos.map(s => s.cliente))]
    const totalDias  = filtrados.reduce((sum, s) => sum + (s.dias_activo || 0), 0)
    const maxSrv     = activos.length
      ? activos.reduce((mx, s) => (s.dias_activo || 0) > (mx.dias_activo || 0) ? s : mx, activos[0])
      : null
    return { activos: activos.length, clientes: cliActivos.length, totalDias, maxSrv }
  }, [filtrados])

  const grupos = useMemo(() => {
    if (!agrupado) return null
    const map = {}
    filtrados.forEach(s => {
      if (!map[s.cliente]) map[s.cliente] = []
      map[s.cliente].push(s)
    })
    return Object.entries(map).sort((a, b) => {
      const da = a[1].reduce((s, x) => s + (x.dias_activo || 0), 0)
      const db = b[1].reduce((s, x) => s + (x.dias_activo || 0), 0)
      return db - da
    })
  }, [filtrados, agrupado])

  function fmtF(f) {
    if (!f) return null
    const [y, m, d] = f.split('-')
    return `${d}/${m}/${y}`
  }

  function exportarCSV() {
    const header = ['Orden', 'Cliente', 'Equipo', 'Código', 'Fecha entrega', 'Fecha devolución', 'Días activos', 'Estado']
    const rows = filtrados.map(s => [
      s.codigo_orden, s.cliente, s.equipo, s.codigo_equipo,
      s.fecha_entrega, s.fecha_devolucion || '',
      s.dias_activo, s.fecha_devolucion ? 'Finalizado' : 'Activo'
    ])
    const bom = '﻿'
    const csv = bom + [header, ...rows].map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n')
    const a   = document.createElement('a')
    a.href    = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8;' }))
    const periodo = desde && hasta ? `_${desde}_${hasta}` : ''
    a.download = `servicios_prestados${periodo}_${hoyBogota()}.csv`
    a.click()
    URL.revokeObjectURL(a.href)
  }

  function FilaServicio({ s, indent = false }) {
    const activo = !s.fecha_devolucion
    return (
      <tr className={`border-b border-slate-50 hover:bg-slate-50 transition-colors ${activo ? 'border-l-2 border-l-[#2EB5D4]' : ''}`}>
        <td className={`px-4 py-3 text-[13px] font-medium text-slate-700 ${indent ? 'pl-8' : ''}`}>
          {!agrupado && s.cliente}
        </td>
        <td className="px-4 py-3">
          <div className="text-[13px] text-slate-600">{s.equipo}</div>
          <div className="text-[11px] font-mono text-slate-400 mt-0.5">{s.codigo_orden}</div>
        </td>
        <td className="px-4 py-3">
          <span className="font-mono text-[12px] font-bold bg-slate-100 text-[#1B3A6B] px-2 py-0.5 rounded">
            {s.codigo_equipo}
          </span>
        </td>
        <td className="px-4 py-3 font-mono text-[12px] text-slate-500">{fmtF(s.fecha_entrega)}</td>
        <td className="px-4 py-3">
          {activo
            ? <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-[#E8F7FB] text-[#0E86A0]">
                <span className="w-1.5 h-1.5 rounded-full bg-[#2EB5D4] animate-pulse" />
                En campo
              </span>
            : <span className="font-mono text-[12px] text-slate-400">{fmtF(s.fecha_devolucion)}</span>
          }
        </td>
        <td className="px-4 py-3 text-right">
          {activo
            ? <span className="font-mono font-bold text-[14px] text-[#1B3A6B]">{s.dias_activo}</span>
            : <span className="font-mono text-[13px] text-slate-400">{s.dias_activo}</span>
          }
          <span className="text-[11px] text-slate-400 ml-1">días</span>
        </td>
      </tr>
    )
  }

  const filtradosOrdenados = filtrados
    .slice()
    .sort((a, b) => (!a.fecha_devolucion ? -1 : 1) || (b.dias_activo - a.dias_activo))

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Topbar */}
      <div className="h-14 md:h-16 bg-white border-b border-slate-200 flex items-center justify-between px-4 md:px-7 flex-shrink-0">
        <div>
          <div className="text-[18px] font-bold text-[#1B3A6B]">Servicios prestados</div>
          <div className="text-[12px] text-slate-400 mt-0.5">Datos para facturación por cliente y período</div>
        </div>
        <BuzonNovedades />
      </div>

      <div className="flex-1 overflow-hidden flex flex-col p-3 md:p-6 gap-3 md:gap-4 pb-28 md:pb-6">
        {/* Controles */}
        <div className="bg-white border border-slate-200 rounded-xl p-4 flex flex-col sm:flex-row items-start sm:items-center gap-3 flex-wrap flex-shrink-0 shadow-sm">
          {/* Fila 1: search + estado + agrupar */}
          <div className="flex items-center gap-3 flex-wrap w-full sm:w-auto">
            <div className="relative flex-1 min-w-[160px] max-w-[260px]">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input value={search} onChange={e => setSearch(e.target.value)}
                placeholder="Buscar cliente o equipo..."
                className="w-full pl-9 pr-4 py-2 border border-slate-200 rounded-[9px] text-[13px] outline-none focus:border-[#2EB5D4] bg-slate-50" />
            </div>

            <div className="flex bg-slate-100 rounded-[8px] p-1 gap-1 flex-shrink-0">
              {[['todos','Todos'],['activo','Activos'],['finalizado','Finalizados']].map(([v,l]) => (
                <button key={v} onClick={() => setFiltroEstado(v)}
                  className={`px-3 py-1.5 rounded-[6px] text-[12px] font-medium transition-all ${filtroEstado === v ? 'bg-white text-[#1B3A6B] font-bold shadow-sm' : 'text-slate-500'}`}>
                  {l}
                </button>
              ))}
            </div>

            <button onClick={() => setAgrupado(v => !v)}
              className="flex items-center gap-2 text-[12.5px] font-medium text-slate-600 hover:text-[#1B3A6B] transition-colors flex-shrink-0">
              {agrupado ? <ToggleRight size={20} className="text-[#1B3A6B]" /> : <ToggleLeft size={20} className="text-slate-400" />}
              Agrupar por cliente
            </button>
          </div>

          {/* Fila 2: date range + export */}
          <div className="flex items-center gap-2 flex-wrap w-full sm:w-auto">
            <Calendar size={14} className="text-slate-400 flex-shrink-0" />
            <span className="text-[12px] text-slate-500 font-medium">Desde</span>
            <input type="date" value={desde} onChange={e => setDesde(e.target.value)}
              className="px-3 py-2 border border-slate-200 rounded-[9px] text-[13px] outline-none focus:border-[#2EB5D4] bg-white" />
            <span className="text-[12px] text-slate-500 font-medium">Hasta</span>
            <input type="date" value={hasta} onChange={e => setHasta(e.target.value)}
              className="px-3 py-2 border border-slate-200 rounded-[9px] text-[13px] outline-none focus:border-[#2EB5D4] bg-white" />

            <button onClick={exportarCSV}
              className="ml-auto flex items-center gap-1.5 px-4 py-2 bg-[#059669] text-white text-[13px] font-semibold rounded-[9px] hover:bg-[#047857] transition-colors flex-shrink-0">
              <Download size={14} /> Exportar CSV
            </button>
          </div>
        </div>

        {/* Métricas */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 flex-shrink-0">
          {[
            { label: 'Equipos en campo', value: stats.activos,    color: '#2EB5D4', sub: 'Servicios activos ahora' },
            { label: 'Clientes activos', value: stats.clientes,   color: '#1B3A6B', sub: 'Con equipos en campo' },
            { label: 'Mayor permanencia', value: stats.maxSrv ? `${stats.maxSrv.dias_activo} d` : '—', color: '#1B3A6B', sub: stats.maxSrv?.codigo_equipo || '—' },
            { label: 'Total días (período)', value: stats.totalDias.toLocaleString('es-CO'), color: '#64748B', sub: desde && hasta ? `${fmtF(desde)} al ${fmtF(hasta)}` : 'Todos los períodos' },
          ].map(s => (
            <div key={s.label} className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
              <div className="text-[10.5px] font-bold uppercase tracking-[0.08em] text-slate-400 mb-1">{s.label}</div>
              <div className="text-2xl font-extrabold tabular-nums" style={{ color: s.color }}>{s.value}</div>
              <div className="text-[11.5px] text-slate-400 mt-1">{s.sub}</div>
            </div>
          ))}
        </div>

        {/* Tabla — md+ */}
        <div className="hidden md:flex flex-col flex-1 bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="overflow-auto flex-1">
            <table className="w-full border-collapse min-w-[700px]">
              <thead className="sticky top-0 z-10">
                <tr className="border-b-2 border-slate-200">
                  {[agrupado ? '' : 'Cliente', 'Equipo', 'Código', 'Entrega', 'Devolución', 'Días'].map(h => (
                    <th key={h} className={`px-4 py-3 text-left text-[10.5px] font-bold uppercase tracking-[0.07em] text-slate-400 bg-slate-50 whitespace-nowrap ${h === 'Días' ? 'text-right' : ''}`}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtrados.length === 0 && (
                  <tr><td colSpan={6} className="text-center py-16 text-slate-400">No hay servicios que coincidan</td></tr>
                )}
                {agrupado && grupos ? grupos.map(([cliente, items]) => {
                  const diasCliente = items.reduce((s, x) => s + (x.dias_activo || 0), 0)
                  const actCli      = items.filter(s => !s.fecha_devolucion).length
                  return (
                    <Fragment key={cliente}>
                      <tr className="bg-slate-50 border-y border-slate-200">
                        <td colSpan={5} className="px-4 py-2.5 text-[13px] font-bold text-[#1B3A6B]">
                          {cliente}
                          <span className="ml-2 text-[11.5px] font-normal text-slate-500">
                            {items.length} equipo{items.length !== 1 ? 's' : ''}
                            {actCli > 0 && <span className="ml-1.5 text-[#0E86A0]">· {actCli} activo{actCli !== 1 ? 's' : ''}</span>}
                          </span>
                        </td>
                        <td className="px-4 py-2.5 text-right">
                          <span className="font-mono font-extrabold text-[14px] text-[#1B3A6B]">{diasCliente}</span>
                          <span className="text-[11px] text-slate-400 ml-1">días</span>
                        </td>
                      </tr>
                      {items.map(s => <FilaServicio key={s.orden_id} s={s} indent />)}
                    </Fragment>
                  )
                }) : filtradosOrdenados.map(s => <FilaServicio key={s.orden_id} s={s} />)
                }
              </tbody>
            </table>
          </div>
          <div className="px-4 py-2.5 border-t border-slate-200 bg-slate-50 text-[12px] text-slate-400 flex-shrink-0">
            {filtrados.length} registro{filtrados.length !== 1 ? 's' : ''} · {stats.totalDias} días totales
          </div>
        </div>

        {/* Cards móvil — solo mobile */}
        <div className="md:hidden flex flex-col gap-2 flex-1 overflow-y-auto">
          {filtrados.length === 0 && (
            <div className="text-center py-12 text-slate-400">No hay servicios que coincidan</div>
          )}
          {(agrupado && grupos
            ? grupos.flatMap(([, items]) => items)
            : filtradosOrdenados
          ).map(s => {
            const activo = !s.fecha_devolucion
            return (
              <div key={s.orden_id} className={`bg-white rounded-xl border shadow-sm p-4 ${activo ? 'border-l-4 border-l-[#2EB5D4] border-slate-200' : 'border-slate-200'}`}>
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div>
                    <div className="text-[13px] font-bold text-slate-800">{s.cliente}</div>
                    <div className="text-[12px] text-slate-500 mt-0.5">{s.equipo}</div>
                  </div>
                  {activo
                    ? <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10.5px] font-bold bg-[#E8F7FB] text-[#0E86A0] flex-shrink-0">
                        <span className="w-1.5 h-1.5 rounded-full bg-[#2EB5D4] animate-pulse" />
                        En campo
                      </span>
                    : <span className="text-[11px] text-slate-400 flex-shrink-0">Finalizado</span>
                  }
                </div>
                <div className="flex items-center gap-3 flex-wrap">
                  <span className="font-mono text-[11.5px] font-bold bg-slate-100 text-[#1B3A6B] px-2 py-0.5 rounded">{s.codigo_equipo}</span>
                  <span className="text-[11.5px] text-slate-400">Entrega: <span className="text-slate-600 font-medium">{fmtF(s.fecha_entrega)}</span></span>
                  {!activo && s.fecha_devolucion && (
                    <span className="text-[11.5px] text-slate-400">Dev: <span className="text-slate-600 font-medium">{fmtF(s.fecha_devolucion)}</span></span>
                  )}
                  <span className="ml-auto font-mono font-bold text-[14px] text-[#1B3A6B]">{s.dias_activo} <span className="text-[11px] font-normal text-slate-400">días</span></span>
                </div>
              </div>
            )
          })}
          <div className="text-[12px] text-slate-400 text-center py-2">
            {filtrados.length} registro{filtrados.length !== 1 ? 's' : ''} · {stats.totalDias} días totales
          </div>
        </div>
      </div>
    </div>
  )
}
