'use client'
import { useMemo, useState } from 'react'
import { Search, Package, HeartPulse, Layers, List, ChevronDown, ChevronLeft, ArrowDownLeft, CheckSquare, Square } from 'lucide-react'
import { formatear } from '@/lib/fechas'
import { ui } from '@/lib/ui'
import { usePaginacion } from '@/hooks/usePaginacion'
import Paginador from '@/components/ui/Paginador'
import ConfirmarConEspera from '@/components/ui/ConfirmarConEspera'

// Equipos que un cliente tiene en préstamo. Pensado para clientes con cien o
// más (CUIDARTE, DUSAKAWI): resumen, chips por tipo que filtran, buscador,
// lista paginada o agrupada por paciente / tipo.
// "Devolver equipos" cambia la vista a un buscador con selección múltiple; se
// confirma con espera de 5 s y el detalle llama a onDevolverVarios(items).
// equipos: filas de orden_equipos con { equipo, orden(paciente), fecha_entrega }
const nombreTipo = oe => oe.equipo?.tipo_equipo?.atributos?.nombre || oe.equipo?.tipo_equipo?.nombre || 'Equipo'
const nombrePaciente = oe => oe.orden?.paciente?.nombre || oe.equipo?.paciente_actual?.nombre || null
const coincide = (oe, q) => !q || [oe.equipo?.codigo, nombreTipo(oe), nombrePaciente(oe)].some(v => v?.toLowerCase().includes(q))

export default function EquiposDelCliente({ equipos, onDevolverVarios }) {
  const [buscar, setBuscar] = useState('')
  const [tipo, setTipo] = useState(null)
  const [vista, setVista] = useState('lista') // 'lista' | 'paciente' | 'tipo'
  const [alternados, setAlternados] = useState({})
  const [devolviendo, setDevolviendo] = useState(false)
  const [buscarDev, setBuscarDev] = useState('')
  const [elegidos, setElegidos] = useState([])
  const [confirmar, setConfirmar] = useState(false)

  const resumen = useMemo(() => {
    const tipos = {}
    for (const oe of equipos) tipos[nombreTipo(oe)] = (tipos[nombreTipo(oe)] || 0) + 1
    return {
      tipos: Object.entries(tipos).sort((a, b) => b[1] - a[1]),
      pacientes: new Set(equipos.map(nombrePaciente).filter(Boolean)).size,
    }
  }, [equipos])

  const filtrados = useMemo(() => {
    const q = buscar.trim().toLowerCase()
    return equipos
      .filter(oe => (!tipo || nombreTipo(oe) === tipo) && coincide(oe, q))
      .sort((a, b) => nombreTipo(a).localeCompare(nombreTipo(b)) || (a.equipo?.codigo || '').localeCompare(b.equipo?.codigo || ''))
  }, [equipos, buscar, tipo])
  const pag = usePaginacion(filtrados, 20)

  const grupos = useMemo(() => {
    if (vista === 'lista') return []
    const m = new Map()
    for (const oe of filtrados) {
      const k = vista === 'paciente' ? (nombrePaciente(oe) || 'Sin paciente') : nombreTipo(oe)
      if (!m.has(k)) m.set(k, [])
      m.get(k).push(oe)
    }
    return [...m.entries()].map(([clave, items]) => ({ clave, items }))
      .sort((a, b) => b.items.length - a.items.length || a.clave.localeCompare(b.clave))
  }, [filtrados, vista])
  // Con muchos grupos empiezan plegados, para no hacer una lista eterna
  const abierto = clave => (grupos.length <= 5) !== !!alternados[clave]

  const candidatos = useMemo(() => {
    const q = buscarDev.trim().toLowerCase()
    return equipos.filter(oe => coincide(oe, q))
      .sort((a, b) => (a.equipo?.codigo || '').localeCompare(b.equipo?.codigo || ''))
  }, [equipos, buscarDev])
  const alternar = id => setElegidos(l => l.includes(id) ? l.filter(x => x !== id) : [...l, id])
  const seleccion = equipos.filter(oe => elegidos.includes(oe.id))

  if (equipos.length === 0) {
    return (
      <div className="text-center py-10 text-slate-400">
        <Package className="w-10 h-10 mx-auto mb-2 opacity-20" />
        <div className="text-[13px]">Sin equipos en préstamo</div>
      </div>
    )
  }

  // ── Devolver equipos: buscador + selección múltiple ──
  if (devolviendo) {
    return (
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <button type="button" onClick={() => { setDevolviendo(false); setElegidos([]); setBuscarDev('') }}
            className="flex items-center gap-1 -ml-1 text-[13px] font-semibold text-[#1B3A6B]">
            <ChevronLeft size={17} /> Volver
          </button>
          <div className="ml-auto text-[12.5px] text-slate-500">{elegidos.length} seleccionado{elegidos.length !== 1 ? 's' : ''}</div>
        </div>
        <div className="relative">
          <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input autoFocus value={buscarDev} onChange={e => setBuscarDev(e.target.value)} placeholder="Busca el equipo por código, tipo o paciente"
            className={`${ui.input} pl-9`} />
        </div>
        <div className="rounded-[10px] border border-slate-200 divide-y divide-slate-100 max-h-[46vh] overflow-y-auto">
          {candidatos.length === 0 && <div className="py-6 text-center text-[12.5px] text-slate-400">Ningún equipo coincide</div>}
          {candidatos.slice(0, 100).map(oe => {
            const marcado = elegidos.includes(oe.id)
            return (
              <button key={oe.id} type="button" onClick={() => alternar(oe.id)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 text-left ${marcado ? 'bg-[#D81B43]/[0.05]' : 'hover:bg-slate-50'}`}>
                {marcado ? <CheckSquare size={17} className="text-[#D81B43] flex-shrink-0" /> : <Square size={17} className="text-slate-300 flex-shrink-0" />}
                <div className="min-w-0 flex-1">
                  <div className="text-[13px] text-slate-700 truncate"><span className="font-mono font-bold">{oe.equipo?.codigo}</span> · {nombreTipo(oe)}</div>
                  <div className="text-[11.5px] text-slate-400 truncate">{nombrePaciente(oe) || 'Sin paciente'} · desde {formatear(oe.fecha_entrega)}</div>
                </div>
              </button>
            )
          })}
          {candidatos.length > 100 && <div className="py-2 text-center text-[11.5px] text-slate-400">Escribe para encontrar los demás</div>}
        </div>
        <div className="flex justify-end">
          <button type="button" disabled={!elegidos.length} onClick={() => setConfirmar(true)} className={ui.btnPrimario}>
            <ArrowDownLeft size={14} /> Devolver {elegidos.length || ''}
          </button>
        </div>
        {confirmar && (
          <ConfirmarConEspera titulo={`¿Devolver ${seleccion.length} equipo${seleccion.length !== 1 ? 's' : ''}?`} textoConfirmar="Sí, devolver"
            onCancelar={() => setConfirmar(false)}
            onConfirmar={async () => {
              const ok = await onDevolverVarios(seleccion)
              setConfirmar(false)
              if (ok !== false) { setDevolviendo(false); setElegidos([]); setBuscarDev('') }
            }}>
            <div className="space-y-1 max-h-[180px] overflow-y-auto">
              {seleccion.map(oe => <div key={oe.id}><span className="font-mono font-semibold">{oe.equipo?.codigo}</span> · {nombreTipo(oe)}</div>)}
            </div>
            <div className="mt-3 text-[12.5px] text-slate-400">Quedan disponibles con fecha de hoy.</div>
          </ConfirmarConEspera>
        )}
      </div>
    )
  }

  const filas = items => (
    <>
      <table className="hidden md:table w-full border-collapse text-[12.5px]">
        <tbody>
          {items.map(oe => (
            <tr key={oe.id} className="border-b border-slate-100 last:border-0 hover:bg-slate-50">
              <td className="py-2 pl-3 pr-2 font-mono font-bold text-slate-700 whitespace-nowrap w-[1%]">{oe.equipo?.codigo || '—'}</td>
              {vista !== 'tipo' && <td className="py-2 px-2 text-slate-700 truncate max-w-[240px]">{nombreTipo(oe)}</td>}
              {vista !== 'paciente' && <td className="py-2 px-2 text-slate-500 truncate max-w-[240px]">{nombrePaciente(oe) || <span className="text-slate-300">—</span>}</td>}
              <td className="py-2 pl-2 pr-3 text-right text-[11.5px] text-slate-400 whitespace-nowrap">{formatear(oe.fecha_entrega)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="md:hidden divide-y divide-slate-100">
        {items.map(oe => (
          <div key={oe.id} className="px-3 py-2">
            <div className="text-[13px] text-slate-700 truncate"><span className="font-mono font-bold">{oe.equipo?.codigo}</span> · {nombreTipo(oe)}</div>
            <div className="text-[11.5px] text-slate-400 truncate">{[vista !== 'paciente' && nombrePaciente(oe), formatear(oe.fecha_entrega)].filter(Boolean).join(' · ')}</div>
          </div>
        ))}
      </div>
    </>
  )

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-3 gap-2">
        {[['Equipos', equipos.length, Package], ['Pacientes', resumen.pacientes, HeartPulse], ['Tipos', resumen.tipos.length, Layers]].map(([l, n, Icono]) => (
          <div key={l} className="rounded-[10px] border border-slate-200 px-3 py-2">
            <div className={`${ui.tituloSeccion} flex items-center gap-1`}><Icono size={11} /> {l}</div>
            <div className="text-[20px] font-extrabold text-slate-800 tabular-nums leading-tight">{n}</div>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap gap-1.5">
        {resumen.tipos.map(([t, n]) => (
          <button key={t} type="button" onClick={() => setTipo(tipo === t ? null : t)}
            className={`px-2.5 py-1 rounded-full text-[11.5px] font-semibold border transition-colors ${tipo === t ? 'bg-[#1B3A6B] text-white border-[#1B3A6B]' : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300'}`}>
            {t} <span className={tipo === t ? 'text-white/70' : 'text-slate-400'}>{n}</span>
          </button>
        ))}
      </div>

      <div className="flex flex-col sm:flex-row gap-2">
        <div className="relative flex-1">
          <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input value={buscar} onChange={e => setBuscar(e.target.value)} placeholder="Código, tipo o paciente"
            className="w-full pl-9 pr-3 h-[38px] border border-slate-200 rounded-[9px] text-[13px] bg-white outline-none focus:border-[#D81B43]" />
        </div>
        <div className="flex bg-slate-100 rounded-[9px] p-0.5 flex-shrink-0">
          {[['lista', 'Lista', List], ['paciente', 'Por paciente', HeartPulse], ['tipo', 'Por tipo', Layers]].map(([v, l, Icono]) => (
            <button key={v} type="button" onClick={() => setVista(v)}
              className={`flex-1 flex items-center justify-center gap-1 px-2.5 py-1.5 rounded-[7px] text-[11.5px] font-semibold whitespace-nowrap ${vista === v ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500'}`}>
              <Icono size={12} /> {l}
            </button>
          ))}
        </div>
        {onDevolverVarios && (
          <button type="button" onClick={() => setDevolviendo(true)} className={ui.btnSecundario}>
            <ArrowDownLeft size={14} /> Devolver equipos
          </button>
        )}
      </div>

      {filtrados.length === 0 ? (
        <div className="text-center py-6 text-[12.5px] text-slate-400">Ningún equipo coincide</div>
      ) : vista === 'lista' ? (
        <div>
          <div className="rounded-[10px] border border-slate-200 overflow-hidden">{filas(pag.itemsPagina)}</div>
          <Paginador {...pag} compacto />
        </div>
      ) : (
        <div className="space-y-2">
          {grupos.map(g => (
            <div key={g.clave} className="rounded-[10px] border border-slate-200 overflow-hidden">
              <button type="button" onClick={() => setAlternados(c => ({ ...c, [g.clave]: !c[g.clave] }))}
                className={`w-full flex items-center gap-2 px-3 py-2 bg-slate-50 text-left ${abierto(g.clave) ? 'border-b border-slate-200' : ''}`}>
                <ChevronDown size={14} className={`text-slate-400 transition-transform ${abierto(g.clave) ? '' : '-rotate-90'}`} />
                <span className="text-[12.5px] font-bold text-slate-700 truncate flex-1">{g.clave}</span>
                <span className="text-[11.5px] font-bold text-slate-500 tabular-nums">{g.items.length}</span>
              </button>
              {abierto(g.clave) && filas(g.items)}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
