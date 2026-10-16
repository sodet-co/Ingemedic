'use client'
import { useMemo, useState } from 'react'
import { X, Search, Globe } from 'lucide-react'
import { createClient } from '@/lib/supabase'

// A qué clientes se ofrece una plantilla al crear un préstamo.
//  - Uso general: sirve para cualquier cliente (la estándar, el pagaré…).
//  - Clientes: la plantilla se ofrece y viene marcada para esos clientes.
// Un cliente sin plantillas propias recibe la estándar como sugerencia.
export default function AsignarPlantilla({ plantilla, clientes, onCerrar, onGuardado }) {
  const supabase = useMemo(() => createClient(), [])
  const actuales = (plantilla.clientes || []).map(c => c.cliente_id || c.cliente?.id).filter(Boolean)
  const [general, setGeneral] = useState(!!plantilla.uso_general)
  const [elegidos, setElegidos] = useState(actuales)
  const [buscar, setBuscar] = useState('')
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState(null)

  const filtrados = clientes.filter(c => !buscar.trim() || c.nombre.toLowerCase().includes(buscar.trim().toLowerCase()))
  const alternar = id => setElegidos(l => l.includes(id) ? l.filter(x => x !== id) : [...l, id])

  async function guardar() {
    setGuardando(true); setError(null)
    const quitar = actuales.filter(id => !elegidos.includes(id))
    const agregar = elegidos.filter(id => !actuales.includes(id))
    if (quitar.length) {
      const { error } = await supabase.from('cliente_plantillas_acta').delete().eq('plantilla_id', plantilla.id).in('cliente_id', quitar)
      if (error) { setError(error.message); setGuardando(false); return }
    }
    if (agregar.length) {
      // Va al final de los documentos que ya tenga cada cliente
      const { data: existentes } = await supabase.from('cliente_plantillas_acta').select('cliente_id, orden').in('cliente_id', agregar)
      const filas = agregar.map(id => ({
        cliente_id: id, plantilla_id: plantilla.id,
        orden: Math.max(-1, ...(existentes || []).filter(e => e.cliente_id === id).map(e => e.orden)) + 1,
      }))
      const { error } = await supabase.from('cliente_plantillas_acta').insert(filas)
      if (error) { setError(error.message); setGuardando(false); return }
    }
    if (general !== !!plantilla.uso_general) {
      const { error } = await supabase.from('plantillas_acta').update({ uso_general: general }).eq('id', plantilla.id)
      if (error) { setError(error.message); setGuardando(false); return }
    }
    onGuardado({ uso_general: general, clientes: elegidos.map((id, i) => ({ cliente_id: id, orden: i, cliente: clientes.find(c => c.id === id) })) })
  }

  return (
    <>
      <div className="fixed inset-0 bg-black/50 z-[60]" onClick={guardando ? undefined : onCerrar} />
      <div className="fixed inset-x-0 bottom-0 h-[85vh] rounded-t-2xl md:inset-auto md:top-1/2 md:left-1/2 md:-translate-x-1/2 md:-translate-y-1/2 md:h-auto md:max-h-[85vh] md:w-[520px] md:rounded-2xl bg-white z-[60] flex flex-col shadow-2xl overflow-hidden">
        <div className="px-5 py-4 border-b flex items-start justify-between gap-3 flex-shrink-0">
          <div className="min-w-0">
            <div className="text-[15px] font-bold text-slate-800">Clientes de la plantilla</div>
            <div className="text-[12px] text-slate-400 truncate">{plantilla.nombre}</div>
          </div>
          <button onClick={onCerrar} disabled={guardando} className="text-slate-400 hover:text-slate-600 w-8 h-8 flex items-center justify-center rounded-lg hover:bg-slate-100 flex-shrink-0"><X size={16} /></button>
        </div>
        <div className="flex-1 min-h-0 overflow-y-auto p-5 space-y-4">
          <label className={`flex items-start gap-3 p-3 rounded-[10px] border cursor-pointer ${general ? 'border-[#1B3A6B]/40 bg-[#1B3A6B]/[0.04]' : 'border-slate-200'}`}>
            <input type="checkbox" className="mt-0.5" checked={general} onChange={e => setGeneral(e.target.checked)} />
            <span>
              <span className="flex items-center gap-1.5 text-[13.5px] font-semibold text-slate-800"><Globe size={14} /> Uso general</span>
              <span className="block text-[12px] text-slate-500 mt-0.5">Se puede elegir con cualquier cliente al crear un préstamo.</span>
            </span>
          </label>
          <div>
            <div className="text-[11px] font-bold uppercase tracking-[0.07em] text-slate-500 mb-1.5">Clientes que la usan ({elegidos.length})</div>
            <div className="text-[12px] text-slate-400 mb-2">A estos clientes se les ofrece y viene marcada al crear el préstamo.</div>
            <div className="relative mb-2">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input value={buscar} onChange={e => setBuscar(e.target.value)} placeholder="Buscar cliente…"
                className="w-full pl-9 pr-3 py-2.5 border border-slate-200 rounded-[9px] text-[16px] md:text-[13.5px] outline-none focus:border-[#D81B43]" />
            </div>
            <div className="border border-slate-200 rounded-[10px] divide-y divide-slate-100 max-h-[300px] overflow-y-auto">
              {filtrados.map(c => (
                <label key={c.id} className="flex items-center gap-3 px-3 py-2.5 cursor-pointer hover:bg-slate-50 text-[13px] text-slate-700">
                  <input type="checkbox" checked={elegidos.includes(c.id)} onChange={() => alternar(c.id)} />
                  <span className="truncate">{c.nombre}</span>
                </label>
              ))}
            </div>
          </div>
          {error && <div className="px-3 py-2.5 bg-red-50 border border-red-200 rounded-[8px] text-[12.5px] text-red-700">{error}</div>}
        </div>
        <div className="px-5 py-3.5 border-t flex justify-end gap-2 flex-shrink-0" style={{ paddingBottom: 'max(14px, env(safe-area-inset-bottom, 14px))' }}>
          <button onClick={onCerrar} disabled={guardando} className="px-4 py-2.5 border border-slate-200 rounded-[9px] text-[13px] font-medium text-slate-600">Cancelar</button>
          <button onClick={guardar} disabled={guardando} className="px-5 py-2.5 bg-[#D81B43] text-white rounded-[9px] text-[13px] font-semibold hover:bg-[#B0172F] disabled:opacity-50">
            {guardando ? 'Guardando…' : 'Guardar'}
          </button>
        </div>
      </div>
    </>
  )
}
