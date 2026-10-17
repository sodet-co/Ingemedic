'use client'
import { useMemo, useState } from 'react'
import { Search, Package, HeartPulse, Layers, List, ChevronDown, ArrowDownLeft } from 'lucide-react'
import { formatear } from '@/lib/fechas'

// Equipos que un cliente tiene en préstamo, pensado para clientes con cien o
// más (CUIDARTE, DUSAKAWI, FOMAG): antes era una tarjeta de 5 renglones por
// equipo y tocaba desplazarse sin fin. Ahora:
//  - resumen arriba (equipos, pacientes, órdenes) y chips por tipo que filtran;
//  - buscador por código, tipo, paciente u orden;
//  - tabla de un renglón por equipo, o agrupada por paciente o por tipo.
// equipos: filas de orden_equipos con { equipo, orden, fecha_entrega }
const nombreTipo = oe => oe.equipo?.tipo_equipo?.atributos?.nombre || oe.equipo?.tipo_equipo?.nombre || 'Equipo'
const nombrePaciente = oe => oe.equipo?.paciente_actual?.nombre || null

export default function EquiposDelCliente({ equipos, onDevolver }) {
  const [buscar, setBuscar] = useState('')
  const [tipo, setTipo] = useState(null)
  const [vista, setVista] = useState('lista') // 'lista' | 'paciente' | 'tipo'
  const [cerrados, setCerrados] = useState({})

  const resumen = useMemo(() => {
    const tipos = {}
    for (const oe of equipos) tipos[nombreTipo(oe)] = (tipos[nombreTipo(oe)] || 0) + 1
    return {
      tipos: Object.entries(tipos).sort((a, b) => b[1] - a[1]),
      pacientes: new Set(equipos.map(nombrePaciente).filter(Boolean)).size,
      ordenes: new Set(equipos.map(oe => oe.orden?.id)).size,
    }
  }, [equipos])

  const filtrados = useMemo(() => {
    const q = buscar.trim().toLowerCase()
    return equipos
      .filter(oe => !tipo || nombreTipo(oe) === tipo)
      .filter(oe => !q || [oe.equipo?.codigo, nombreTipo(oe), nombrePaciente(oe), oe.orden?.codigo].some(v => v?.toLowerCase().includes(q)))
      .sort((a, b) => nombreTipo(a).localeCompare(nombreTipo(b)) || (a.equipo?.codigo || '').localeCompare(b.equipo?.codigo || ''))
  }, [equipos, buscar, tipo])

  const grupos = useMemo(() => {
    if (vista === 'lista') return [{ clave: '', items: filtrados }]
    const m = new Map()
    for (const oe of filtrados) {
      const k = vista === 'paciente' ? (nombrePaciente(oe) || 'Sin paciente asociado') : nombreTipo(oe)
      if (!m.has(k)) m.set(k, [])
      m.get(k).push(oe)
    }
    return [...m.entries()].map(([clave, items]) => ({ clave, items }))
      .sort((a, b) => b.items.length - a.items.length || a.clave.localeCompare(b.clave))
  }, [filtrados, vista])

  if (equipos.length === 0) {
    return (
      <div className="text-center py-8 text-slate-400">
        <Package className="w-10 h-10 mx-auto mb-2 opacity-20" />
        <div className="text-[12.5px]">Sin equipos activos</div>
        <div className="text-[11.5px] mt-1 text-slate-300">Los préstamos aparecerán aquí</div>
      </div>
    )
  }

  const tabla = items => (
    <>
      {/* Desktop: un renglón por equipo */}
      <table className="hidden md:table w-full border-collapse text-[12.5px]">
        <tbody>
          {items.map(oe => (
            <tr key={oe.id} className="border-b border-slate-100 last:border-0 hover:bg-slate-50 group">
              <td className="py-2 pl-3 pr-2 font-mono font-bold text-slate-700 whitespace-nowrap w-[1%]">{oe.equipo?.codigo || '—'}</td>
              {vista !== 'tipo' && <td className="py-2 px-2 text-slate-700 truncate max-w-[220px]">{nombreTipo(oe)}</td>}
              {vista !== 'paciente' && <td className="py-2 px-2 text-slate-500 truncate max-w-[220px]">{nombrePaciente(oe) || <span className="text-slate-300">—</span>}</td>}
              <td className="py-2 px-2 font-mono text-[11.5px] text-slate-400 whitespace-nowrap">{oe.orden?.codigo}</td>
              <td className="py-2 px-2 text-[11.5px] text-slate-400 whitespace-nowrap">{formatear(oe.fecha_entrega, { year: '2-digit' })}</td>
              <td className="py-2 pl-2 pr-3 text-right whitespace-nowrap w-[1%]">
                <button type="button" onClick={() => onDevolver(oe)}
                  className="text-[11.5px] text-[#D81B43] font-semibold opacity-60 group-hover:opacity-100 hover:underline">
                  {(oe.orden?.equipos?.length || 0) === 1 ? 'Finalizar' : 'Devolver'}
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {/* Celular: dos renglones compactos */}
      <div className="md:hidden divide-y divide-slate-100">
        {items.map(oe => (
          <div key={oe.id} className="flex items-center gap-2 px-3 py-2">
            <div className="flex-1 min-w-0">
              <div className="text-[12.5px] text-slate-700 truncate"><span className="font-mono font-bold">{oe.equipo?.codigo}</span> · {nombreTipo(oe)}</div>
              <div className="text-[11px] text-slate-400 truncate">
                {[vista !== 'paciente' && nombrePaciente(oe), oe.orden?.codigo, formatear(oe.fecha_entrega, { year: '2-digit' })].filter(Boolean).join(' · ')}
              </div>
            </div>
            <button type="button" onClick={() => onDevolver(oe)} aria-label="Devolver"
              className="w-8 h-8 flex items-center justify-center rounded-lg text-[#D81B43] hover:bg-red-50 flex-shrink-0"><ArrowDownLeft size={15} /></button>
          </div>
        ))}
      </div>
    </>
  )

  return (
    <div className="space-y-3">
      {/* Resumen */}
      <div className="grid grid-cols-3 gap-2">
        {[['Equipos', equipos.length, Package], ['Pacientes', resumen.pacientes, HeartPulse], ['Órdenes', resumen.ordenes, Layers]].map(([l, n, Icono]) => (
          <div key={l} className="rounded-[10px] border border-slate-200 px-3 py-2">
            <div className="text-[10.5px] font-bold uppercase tracking-[0.08em] text-slate-400 flex items-center gap-1"><Icono size={11} /> {l}</div>
            <div className="text-[20px] font-extrabold text-slate-800 tabular-nums leading-tight">{n}</div>
          </div>
        ))}
      </div>

      {/* Por tipo: filtran la tabla */}
      <div className="flex flex-wrap gap-1.5">
        {resumen.tipos.map(([t, n]) => (
          <button key={t} type="button" onClick={() => setTipo(tipo === t ? null : t)}
            className={`px-2.5 py-1 rounded-full text-[11.5px] font-semibold border transition-colors ${tipo === t ? 'bg-[#1B3A6B] text-white border-[#1B3A6B]' : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300'}`}>
            {t} <span className={tipo === t ? 'text-white/70' : 'text-slate-400'}>{n}</span>
          </button>
        ))}
      </div>

      {/* Buscar + forma de ver */}
      <div className="flex flex-col sm:flex-row gap-2">
        <div className="relative flex-1">
          <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input value={buscar} onChange={e => setBuscar(e.target.value)} placeholder="Código, tipo, paciente u orden…"
            className="w-full pl-8 pr-3 py-2 border border-slate-200 rounded-[9px] text-[16px] md:text-[12.5px] outline-none focus:border-[#D81B43]" />
        </div>
        <div className="flex bg-slate-100 rounded-[9px] p-0.5 flex-shrink-0">
          {[['lista', 'Lista', List], ['paciente', 'Por paciente', HeartPulse], ['tipo', 'Por tipo', Layers]].map(([v, l, Icono]) => (
            <button key={v} type="button" onClick={() => setVista(v)}
              className={`flex-1 flex items-center justify-center gap-1 px-2.5 py-1.5 rounded-[7px] text-[11.5px] font-semibold whitespace-nowrap ${vista === v ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500'}`}>
              <Icono size={12} /> {l}
            </button>
          ))}
        </div>
      </div>

      {(tipo || buscar) && (
        <div className="text-[11.5px] text-slate-400">{filtrados.length} de {equipos.length} equipos</div>
      )}

      {filtrados.length === 0 ? (
        <div className="text-center py-6 text-[12.5px] text-slate-400">Ningún equipo coincide</div>
      ) : (
        <div className="space-y-2">
          {grupos.map(g => (
            <div key={g.clave || 'todos'} className="rounded-[10px] border border-slate-200 overflow-hidden">
              {g.clave && (
                <button type="button" onClick={() => setCerrados(c => ({ ...c, [g.clave]: !c[g.clave] }))}
                  className="w-full flex items-center gap-2 px-3 py-2 bg-slate-50 border-b border-slate-200 text-left">
                  <ChevronDown size={14} className={`text-slate-400 transition-transform ${cerrados[g.clave] ? '-rotate-90' : ''}`} />
                  <span className="text-[12.5px] font-bold text-slate-700 truncate flex-1">{g.clave}</span>
                  <span className="text-[11.5px] font-bold text-slate-500 tabular-nums">{g.items.length}</span>
                </button>
              )}
              {!cerrados[g.clave] && tabla(g.items)}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
