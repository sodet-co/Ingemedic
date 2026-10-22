'use client'
import { useMemo, useState } from 'react'
import { Search, ChevronDown, Wrench, Loader2 } from 'lucide-react'
import { createClient } from '@/lib/supabase'
import { formatear, diaLocal } from '@/lib/fechas'
import { usePaginacion } from '@/hooks/usePaginacion'
import Paginador from '@/components/ui/Paginador'

// Historia de cada equipo que tuvo un cliente: prestado, recargas, cambios y
// devolución, en orden (lib/informeCliente.js → porEquipo). Al abrir uno se
// traen también sus mantenimientos.
// El mismo día, en el orden en que pasan (varias fechas guardan solo el día)
const RANGO = { prestamo: 0, recarga: 1, cambio: 2, mantenimiento: 3, devolucion: 4 }
const COLOR = { prestamo: '#0E86A0', recarga: '#6D28D9', cambio: '#1B3A6B', devolucion: '#B45309', mantenimiento: '#64748B' }

export default function HistorialPorEquipo({ equipos }) {
  const supabase = useMemo(() => createClient(), [])
  const [buscar, setBuscar] = useState('')
  const [abierto, setAbierto] = useState(null)
  const [mantenimientos, setMantenimientos] = useState({}) // equipo id → filas | 'cargando'

  const filtrados = useMemo(() => {
    const q = buscar.trim().toLowerCase()
    return q ? equipos.filter(x => [x.codigo, x.tipo].some(v => v?.toLowerCase().includes(q))) : equipos
  }, [equipos, buscar])
  const pag = usePaginacion(filtrados, 20)

  async function alternar(x) {
    const k = x.id || x.codigo
    setAbierto(a => a === k ? null : k)
    if (!x.id || mantenimientos[x.id]) return
    setMantenimientos(m => ({ ...m, [x.id]: 'cargando' }))
    const { data } = await supabase.from('mantenimientos')
      .select('id, codigo, fecha_apertura, fecha_cierre, tipo:tipos_mantenimiento(nombre)')
      .eq('equipo_id', x.id).order('fecha_apertura')
    setMantenimientos(m => ({ ...m, [x.id]: data || [] }))
  }

  if (!equipos.length) return <div className="text-center py-10 text-slate-400 text-[13px]">Sin equipos registrados</div>

  return (
    <div className="space-y-3">
      <div className="relative">
        <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
        <input value={buscar} onChange={e => setBuscar(e.target.value)} placeholder="Código o tipo de equipo"
          className="w-full pl-9 pr-3 h-[38px] border border-slate-200 rounded-[9px] text-[13px] bg-white outline-none focus:border-[#D81B43]" />
      </div>
      <div className="rounded-[10px] border border-slate-200 divide-y divide-slate-100 overflow-hidden">
        {pag.itemsPagina.map(x => {
          const k = x.id || x.codigo
          const mant = x.id && Array.isArray(mantenimientos[x.id]) ? mantenimientos[x.id] : []
          const eventos = [...x.eventos, ...mant.map(m => ({ tipo: 'mantenimiento', fecha: m.fecha_apertura, texto: `Mantenimiento ${m.tipo?.nombre?.toLowerCase() || ''} ${m.codigo || ''}${m.fecha_cierre ? '' : ' · abierto'}`.trim() }))]
            .sort((a, b) => diaLocal(a.fecha).localeCompare(diaLocal(b.fecha)) || (RANGO[a.tipo] ?? 9) - (RANGO[b.tipo] ?? 9))
          const ultimo = x.eventos[x.eventos.length - 1]
          return (
            <div key={k}>
              <button type="button" onClick={() => alternar(x)} className="w-full flex items-center gap-3 px-3 py-2.5 text-left hover:bg-slate-50">
                <ChevronDown size={14} className={`text-slate-400 flex-shrink-0 transition-transform ${abierto === k ? '' : '-rotate-90'}`} />
                <span className="min-w-0 flex-1">
                  <span className="block text-[13px] text-slate-700 truncate"><span className="font-mono font-bold">{x.codigo}</span> · {x.tipo}</span>
                  {ultimo && <span className="block text-[11.5px] text-slate-400 truncate">{ultimo.texto} · {formatear(ultimo.fecha)}</span>}
                </span>
                <span className="text-[11.5px] font-bold text-slate-400 tabular-nums flex-shrink-0">{x.eventos.length}</span>
              </button>
              {abierto === k && (
                <div className="px-4 pb-3 pt-1 bg-slate-50/60">
                  <div className="relative pl-5">
                    <div className="absolute left-[5px] top-1 bottom-1 w-px bg-slate-200" />
                    {eventos.map((e, i) => (
                      <div key={i} className="relative py-1">
                        <span className="absolute -left-5 top-[9px] w-[11px] h-[11px] rounded-full border-2 border-white" style={{ background: COLOR[e.tipo] || '#94A3B8' }} />
                        <div className="text-[12.5px] text-slate-700 leading-snug">{e.tipo === 'mantenimiento' && <Wrench size={11} className="inline mr-1 -mt-0.5 text-slate-400" />}{e.texto}</div>
                        <div className="text-[11px] text-slate-400">{formatear(e.fecha)}</div>
                      </div>
                    ))}
                    {x.id && mantenimientos[x.id] === 'cargando' && <div className="text-[11.5px] text-slate-400 flex items-center gap-1.5 py-1"><Loader2 size={11} className="animate-spin" /> Buscando mantenimientos…</div>}
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>
      <Paginador {...pag} compacto />
    </div>
  )
}
