'use client'
import { useMemo, useState } from 'react'
import { RefreshCw, Check } from 'lucide-react'
import Modal from '@/components/ui/Modal'
import { createClient } from '@/lib/supabase'
import { registrarBitacora } from '@/lib/bitacora'
import { ui } from '@/lib/ui'

// Aviso de Inventario: equipos "Por recargar". Quedan así cuando salen vacíos en
// una recarga (cambio de equipo con motivo Recarga, lib/accionesPrestamo.js) y no
// se pueden prestar hasta marcarlos recargados. El aviso sale siempre que haya
// alguno, para que no se olvide pasarlos a Disponible.
const nombreTipo = eq => eq?.tipo_equipo?.atributos?.nombre || eq?.tipo_equipo?.nombre || 'Equipo'

export default function AvisoPorRecargar({ equipos, estados, onListo, onVer, onVerTodos }) {
  const supabase = useMemo(() => createClient(), [])
  const porRecargar = useMemo(() => equipos.filter(e => e.estado?.nombre === 'Por recargar'), [equipos])
  const [abierto, setAbierto] = useState(false)
  const [sel, setSel] = useState([])
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState(null)

  if (!porRecargar.length) return null
  const disponible = estados.find(e => e.nombre === 'Disponible')

  function abrir() { setSel(porRecargar.map(e => e.id)); setError(null); setAbierto(true) }

  async function marcar() {
    if (!sel.length) { setError('Elige al menos un equipo'); return }
    setGuardando(true); setError(null)
    const { error: err } = await supabase.from('equipos').update({ estado_id: disponible?.id }).in('id', sel)
    setGuardando(false)
    if (err) { setError('No se guardó: ' + err.message); return }
    const codigos = porRecargar.filter(e => sel.includes(e.id)).map(e => e.codigo)
    registrarBitacora({ modulo: 'inventario', accion: 'editar', entidad: 'equipo', entidad_id: sel[0], detalle: { estado: 'Disponible', motivo: 'Recargado', equipos: codigos } })
    setAbierto(false)
    onListo?.(`${codigos.length} ${codigos.length === 1 ? 'equipo recargado' : 'equipos recargados'} · ya están disponibles`)
  }

  return (
    <>
      <div className="mb-5 flex flex-col sm:flex-row sm:items-center gap-3 px-4 py-3.5 rounded-xl border border-[#8B5CF6]/30 bg-[#F5F3FF]">
        <div className="w-9 h-9 rounded-full bg-white flex items-center justify-center flex-shrink-0 text-[#6D28D9]"><RefreshCw size={17} /></div>
        <div className="flex-1 min-w-0">
          <div className="text-[13.5px] font-bold text-[#4C1D95]">
            {porRecargar.length} {porRecargar.length === 1 ? 'equipo está' : 'equipos están'} por recargar
          </div>
          <div className="text-[12.5px] text-[#6D28D9]/80">No se pueden prestar hasta marcarlos recargados.</div>
          {/* Cada código abre el equipo, como si se hubiera buscado */}
          <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
            {porRecargar.slice(0, 8).map(e => (
              <button key={e.id} type="button" onClick={() => onVer?.(e)} title={`Ver ${e.codigo}`}
                className="px-2 py-0.5 rounded-full bg-white border border-[#8B5CF6]/30 font-mono text-[11.5px] font-bold text-[#5B21B6] hover:border-[#6D28D9] hover:bg-[#EDE9FE]">
                {e.codigo}
              </button>
            ))}
            <button type="button" onClick={onVerTodos} className="text-[12px] font-semibold text-[#5B21B6] hover:underline ml-1">
              {porRecargar.length > 8 ? `Ver los ${porRecargar.length}` : 'Ver todos'} →
            </button>
          </div>
        </div>
        <button type="button" onClick={abrir} className={`${ui.btnPrimario} !bg-[#6D28D9] hover:!bg-[#5B21B6] flex-shrink-0`}>
          <Check size={14} /> Marcar recargados
        </button>
      </div>

      {abierto && (
        <Modal onCerrar={() => setAbierto(false)} bloqueado={guardando} titulo="Marcar recargados" subtitulo="Pasan a Disponible y se pueden volver a prestar"
          icono={<RefreshCw size={17} />}
          pie={<>
            <button onClick={() => setAbierto(false)} disabled={guardando} className={ui.btnSecundario}>Cancelar</button>
            <button onClick={marcar} disabled={guardando || !sel.length} className={ui.btnPrimario}>
              {guardando ? 'Guardando…' : `Marcar ${sel.length} recargado${sel.length !== 1 ? 's' : ''}`}
            </button>
          </>}>
          <div className="flex items-center justify-between mb-3 text-[12.5px]">
            <span className="text-slate-500">Marca los que ya volvieron recargados.</span>
            <button type="button" onClick={() => setSel(sel.length === porRecargar.length ? [] : porRecargar.map(e => e.id))}
              className="font-semibold text-[#1B3A6B] hover:underline">{sel.length === porRecargar.length ? 'Quitar todos' : 'Marcar todos'}</button>
          </div>
          <div className="rounded-[10px] border border-slate-200 divide-y divide-slate-100 max-h-[50vh] overflow-y-auto">
            {porRecargar.map(e => (
              <label key={e.id} className="flex items-center gap-3 px-3 py-2.5 cursor-pointer hover:bg-slate-50">
                <input type="checkbox" checked={sel.includes(e.id)} onChange={ev => setSel(l => ev.target.checked ? [...l, e.id] : l.filter(x => x !== e.id))} />
                <span className="font-mono font-bold text-[13px] text-slate-800">{e.codigo}</span>
                <span className="text-[13px] text-slate-500 truncate">{nombreTipo(e)}{e.atributos?.serie ? ` · Serie ${e.atributos.serie}` : ''}</span>
              </label>
            ))}
          </div>
          {error && <div className="text-[12px] text-[#D81B43] mt-2">{error}</div>}
        </Modal>
      )}
    </>
  )
}
