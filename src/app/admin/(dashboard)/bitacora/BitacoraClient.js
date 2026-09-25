'use client'
import { useState, useMemo, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import { Search, Filter, Download, User, Clock } from 'lucide-react'
import Paginador from '@/components/ui/Paginador'
import { usePaginacion } from '@/hooks/usePaginacion'
import { formatear, paraGuardar, hoyBogota } from '@/lib/fechas'
import BuzonNovedades from '@/components/layout/BuzonNovedades'

const ACCION_STYLES = {
  'crear': { bg: '#ECFDF5', color: '#0F7B55', label: 'CREACIÓN' },
  'editar': { bg: '#E8F7FB', color: '#0E86A0', label: 'EDICIÓN' },
  'eliminar': { bg: '#FEF2F2', color: '#C0392B', label: 'ELIMINACIÓN' },
  'login': { bg: '#F5F3FF', color: '#6D28D9', label: 'ACCESO' },
  'logout': { bg: '#F1F5F9', color: '#64748B', label: 'SALIDA' },
  'activar': { bg: '#ECFDF5', color: '#0F7B55', label: 'ACTIVACIÓN' },
  'desactivar': { bg: '#FEF2F2', color: '#C0392B', label: 'DESACTIVACIÓN' },
  'cerrar': { bg: '#FFFBEB', color: '#B45309', label: 'CIERRE' },
  'avanzar': { bg: '#E8F7FB', color: '#0E86A0', label: 'AVANCE' },
}

const MODULO_LABELS = {
  inventario: 'Inventario',
  clientes: 'Clientes',
  ordenes: 'Órdenes',
  entregas: 'Entregas',
  mantenimientos: 'Mantenimientos',
  servicios: 'Servicios',
  configuracion: 'Configuración',
  auth: 'Autenticación',
}

export default function BitacoraClient({ registrosIniciales }) {
  const router = useRouter()
  const supabase = createClient()
  const [search, setSearch] = useState('')
  const [filtroModulo, setFiltroModulo] = useState('')
  const [filtroAccion, setFiltroAccion] = useState('')
  const [desde, setDesde] = useState('')
  const [hasta, setHasta] = useState('')

  // ── SINCRONIZACIÓN EN TIEMPO REAL ─────────────────────────
  // Igual que en Dashboard: no hay estado local que proteger,
  // solo se refresca la página cuando entra un registro nuevo.
  useEffect(() => {
    let debounceTimer = null
    function refrescarConDebounce() {
      clearTimeout(debounceTimer)
      debounceTimer = setTimeout(() => router.refresh(), 500)
    }

    const canal = supabase
      .channel('bitacora-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'bitacora' }, refrescarConDebounce)
      .subscribe()

    return () => { clearTimeout(debounceTimer); supabase.removeChannel(canal) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const modulos = useMemo(() =>
    [...new Set(registrosIniciales.map(r => r.modulo).filter(Boolean))].sort(),
    [registrosIniciales]
  )

  const acciones = useMemo(() =>
    [...new Set(registrosIniciales.map(r => r.accion).filter(Boolean))].sort(),
    [registrosIniciales]
  )

  const filtrados = useMemo(() => {
    return registrosIniciales.filter(r => {
      const mq = !search || [r.accion, r.modulo, r.entidad, r.usuario?.nombre, r.detalle?.descripcion]
        .some(v => v?.toLowerCase().includes(search.toLowerCase()))
      const mm = !filtroModulo || r.modulo === filtroModulo
      const ma = !filtroAccion || r.accion === filtroAccion
      const fecha = new Date(r.fecha)
      const md = !desde || fecha >= new Date(paraGuardar(desde))
      const mh = !hasta || fecha <= new Date(paraGuardar(`${hasta}T23:59`))
      return mq && mm && ma && md && mh
    })
  }, [registrosIniciales, search, filtroModulo, filtroAccion, desde, hasta])

  const paginacionBitacora = usePaginacion(filtrados, 20)
  const registrosPagina = paginacionBitacora.itemsPagina

  function exportarCSV() {
    const header = ['Fecha', 'Usuario', 'Módulo', 'Acción', 'Entidad', 'Detalle']
    const rows = filtrados.map(r => [
      formatear(r.fecha, { month: '2-digit', hour: '2-digit', minute: '2-digit' }),
      r.usuario?.nombre || '—',
      MODULO_LABELS[r.modulo] || r.modulo || '—',
      r.accion || '—',
      r.entidad || '—',
      r.detalle?.descripcion || JSON.stringify(r.detalle) || '—'
    ])
    const bom = '\uFEFF'
    const csv = bom + [header, ...rows].map(row =>
      row.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')
    ).join('\n')
    const a = document.createElement('a')
    a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8;' }))
    a.download = `bitacora_${hoyBogota()}.csv`
    a.click()
    URL.revokeObjectURL(a.href)
  }

  const selectCls = 'px-3 py-2 border border-slate-200 rounded-[9px] text-[13px] outline-none focus:border-[#2EB5D4] bg-white text-slate-600'

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Topbar */}
      <div className="h-14 md:h-16 bg-white border-b border-slate-200 flex items-center px-4 md:px-7 flex-shrink-0">
        <div>
          <div className="text-[18px] font-bold text-[#1B3A6B]">Bitácora</div>
          <div className="text-[12px] text-slate-400 mt-0.5">Registro de actividad del sistema</div>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <BuzonNovedades />
          <button onClick={exportarCSV}
            className="flex items-center gap-1.5 px-4 py-2 bg-[#1B3A6B] text-white text-[13px] font-semibold rounded-[9px] hover:bg-[#1E4D8C] transition-colors">
            <Download size={14} /> Exportar CSV
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-hidden flex flex-col p-3 md:p-6 gap-3 md:gap-4 pb-28 md:pb-6">
        {/* Filtros */}
        <div className="bg-white border border-slate-200 rounded-xl p-4 flex items-center gap-3 flex-wrap flex-shrink-0 shadow-sm">
          <div className="relative flex-1 min-w-[160px] md:max-w-[280px]">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Buscar acción, usuario, entidad..."
              className="w-full pl-9 pr-4 py-2 border border-slate-200 rounded-[9px] text-[13px] outline-none focus:border-[#2EB5D4] bg-slate-50" />
          </div>

          <select value={filtroModulo} onChange={e => setFiltroModulo(e.target.value)} className={selectCls}>
            <option value="">Todos los módulos</option>
            {modulos.map(m => <option key={m} value={m}>{MODULO_LABELS[m] || m}</option>)}
          </select>

          <select value={filtroAccion} onChange={e => setFiltroAccion(e.target.value)} className={selectCls}>
            <option value="">Todas las acciones</option>
            {acciones.map(a => <option key={a} value={a}>{ACCION_STYLES[a]?.label || a}</option>)}
          </select>

          <div className="flex items-center gap-2 flex-wrap w-full sm:w-auto">
            <span className="text-[12px] text-slate-500 font-medium">Desde</span>
            <input type="date" value={desde} onChange={e => setDesde(e.target.value)}
              className="px-3 py-2 border border-slate-200 rounded-[9px] text-[13px] outline-none focus:border-[#2EB5D4] bg-white" />
            <span className="text-[12px] text-slate-500 font-medium">Hasta</span>
            <input type="date" value={hasta} onChange={e => setHasta(e.target.value)}
              className="px-3 py-2 border border-slate-200 rounded-[9px] text-[13px] outline-none focus:border-[#2EB5D4] bg-white" />
          </div>

          {(filtroModulo || filtroAccion || desde || hasta || search) && (
            <button onClick={() => { setSearch(''); setFiltroModulo(''); setFiltroAccion(''); setDesde(''); setHasta('') }}
              className="text-[12px] text-slate-400 hover:text-red-500 transition-colors font-medium">
              Limpiar filtros
            </button>
          )}
        </div>

        {/* Stats rápidas */}
        <div className="hidden md:grid md:grid-cols-4 gap-3 flex-shrink-0">
          {[
            { label: 'Total registros', value: filtrados.length, color: '#1B3A6B' },
            { label: 'Creaciones', value: filtrados.filter(r => r.accion === 'crear').length, color: '#0F7B55' },
            { label: 'Ediciones', value: filtrados.filter(r => r.accion === 'editar').length, color: '#0E86A0' },
            { label: 'Eliminaciones', value: filtrados.filter(r => r.accion === 'eliminar').length, color: '#C0392B' },
          ].map(s => (
            <div key={s.label} className="bg-white rounded-xl border border-slate-200 p-3 shadow-sm">
              <div className="text-xl font-extrabold tabular-nums" style={{ color: s.color }}>{s.value}</div>
              <div className="text-[11px] text-slate-400 mt-0.5">{s.label}</div>
            </div>
          ))}
        </div>

        {/* Tabla — md+ */}
        <div className="hidden md:flex flex-col flex-1 bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="overflow-auto flex-1">
            <table className="w-full border-collapse min-w-[800px]">
              <thead className="sticky top-0 z-10">
                <tr className="border-b-2 border-slate-200">
                  {['Fecha', 'Usuario', 'Módulo', 'Acción', 'Entidad', 'Detalle'].map(h => (
                    <th key={h} className="px-4 py-3 text-left text-[10.5px] font-bold uppercase tracking-[0.07em] text-slate-400 bg-slate-50 whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtrados.length === 0 && (
                  <tr><td colSpan={6} className="text-center py-16 text-slate-400">No hay registros que coincidan</td></tr>
                )}
                {registrosPagina.map(r => {
                  const estilo = ACCION_STYLES[r.accion] || { bg: '#F1F5F9', color: '#64748B', label: r.accion?.toUpperCase() }
                  return (
                    <tr key={r.id} className="border-b border-slate-50 hover:bg-slate-50 transition-colors">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1.5 text-[12px] font-mono text-slate-500">
                          <Clock size={11} className="text-slate-400" />
                          {formatear(r.fecha, { month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <div className="w-6 h-6 rounded-full bg-[#1B3A6B] flex items-center justify-center flex-shrink-0">
                            <User size={11} className="text-white" />
                          </div>
                          <span className="text-[13px] font-medium text-slate-700">{r.usuario?.nombre || '—'}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-[12.5px] text-slate-500">{MODULO_LABELS[r.modulo] || r.modulo || '—'}</span>
                      </td>
                      <td className="px-4 py-3">
                        <span className="inline-flex items-center px-2.5 py-1 rounded-full text-[10.5px] font-bold"
                          style={{ background: estilo.bg, color: estilo.color }}>
                          {estilo.label}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-[12.5px] text-slate-500">{r.entidad || '—'}</td>
                      <td className="px-4 py-3 text-[12.5px] text-slate-500 max-w-[240px] truncate">
                        {r.detalle?.descripcion || JSON.stringify(r.detalle) || '—'}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          <Paginador {...paginacionBitacora} />
        </div>

        {/* Cards móvil */}
        <div className="md:hidden flex flex-col gap-2 flex-1 overflow-y-auto">
          {filtrados.length === 0 && (
            <div className="text-center py-12 text-slate-400">No hay registros que coincidan</div>
          )}
          {registrosPagina.map(r => {
            const estilo = ACCION_STYLES[r.accion] || { bg: '#F1F5F9', color: '#64748B', label: r.accion?.toUpperCase() }
            return (
              <div key={r.id} className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-full bg-[#1B3A6B] flex items-center justify-center flex-shrink-0">
                      <User size={12} className="text-white" />
                    </div>
                    <div>
                      <div className="text-[13px] font-semibold text-slate-700">{r.usuario?.nombre || '—'}</div>
                      <div className="text-[10.5px] text-slate-400 font-mono flex items-center gap-1">
                        <Clock size={9} />{formatear(r.fecha, { month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                      </div>
                    </div>
                  </div>
                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold flex-shrink-0"
                    style={{ background: estilo.bg, color: estilo.color }}>
                    {estilo.label}
                  </span>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-[11.5px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded font-medium">
                    {MODULO_LABELS[r.modulo] || r.modulo || '—'}
                  </span>
                  {r.entidad && <span className="text-[11.5px] text-slate-500">{r.entidad}</span>}
                </div>
                {(r.detalle?.descripcion || r.detalle) && (
                  <div className="text-[11.5px] text-slate-400 mt-1.5 line-clamp-2">
                    {r.detalle?.descripcion || JSON.stringify(r.detalle)}
                  </div>
                )}
              </div>
            )
          })}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden mt-2">
            <Paginador {...paginacionBitacora} />
          </div>
        </div>
      </div>
    </div>
  )
}