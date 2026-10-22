'use client'
import { useMemo, useState } from 'react'
import { Search, Globe, Star } from 'lucide-react'
import Modal from '@/components/ui/Modal'
import { ui } from '@/lib/ui'
import { createClient } from '@/lib/supabase'
import { ACCIONES, accionDe } from '@/lib/actas/acciones'

// A qué clientes se ofrece una plantilla al crear un préstamo.
//  - Uso general: sirve para cualquier cliente (la estándar, el pagaré…).
//  - Clientes: la plantilla se ofrece y viene marcada para esos clientes.
//  - De Ingemedic: la que se usa en su acción si el cliente no tiene una propia
//    para esa acción (una por acción).
export default function AsignarPlantilla({ plantilla, clientes, onCerrar, onGuardado }) {
  const supabase = useMemo(() => createClient(), [])
  const actuales = (plantilla.clientes || []).map(c => c.cliente_id || c.cliente?.id).filter(Boolean)
  const [general, setGeneral] = useState(!!plantilla.uso_general)
  const [estandar, setEstandar] = useState(!!plantilla.es_estandar)
  const accionTxt = ACCIONES[accionDe(plantilla)].toLowerCase()
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
    if (estandar && !plantilla.es_estandar) {
      // Solo una de Ingemedic por acción
      const { error } = await supabase.from('plantillas_acta').update({ es_estandar: false }).eq('accion', accionDe(plantilla)).neq('id', plantilla.id)
      if (error) { setError(error.message); setGuardando(false); return }
    }
    if (general !== !!plantilla.uso_general || estandar !== !!plantilla.es_estandar) {
      const { error } = await supabase.from('plantillas_acta').update({ uso_general: general, es_estandar: estandar }).eq('id', plantilla.id)
      if (error) { setError(error.message); setGuardando(false); return }
    }
    onGuardado({ uso_general: general, es_estandar: estandar, clientes: elegidos.map((id, i) => ({ cliente_id: id, orden: i, cliente: clientes.find(c => c.id === id) })) })
  }

  return (
    <Modal onCerrar={onCerrar} titulo="Clientes de la plantilla" subtitulo={plantilla.nombre} z="z-[60]" bloqueado={guardando}
      pie={<>
        <button onClick={onCerrar} disabled={guardando} className={ui.btnSecundario}>Cancelar</button>
        <button onClick={guardar} disabled={guardando} className={ui.btnPrimario}>{guardando ? 'Guardando…' : 'Guardar'}</button>
      </>}>
        <div className="space-y-4">
          <label className={`flex items-start gap-3 p-3 rounded-[10px] border cursor-pointer ${estandar ? 'border-[#1B3A6B]/40 bg-[#1B3A6B]/[0.04]' : 'border-slate-200'}`}>
            <input type="checkbox" className="mt-0.5" checked={estandar} onChange={e => setEstandar(e.target.checked)} />
            <span>
              <span className="flex items-center gap-1.5 text-[13.5px] font-semibold text-slate-800"><Star size={14} /> De Ingemedic para {accionTxt}</span>
              <span className="block text-[12px] text-slate-500 mt-0.5">Se usa cuando el cliente no tiene una propia de {accionTxt}. Solo una por acción.</span>
            </span>
          </label>
          <label className={`flex items-start gap-3 p-3 rounded-[10px] border cursor-pointer ${general ? 'border-[#1B3A6B]/40 bg-[#1B3A6B]/[0.04]' : 'border-slate-200'}`}>
            <input type="checkbox" className="mt-0.5" checked={general} onChange={e => setGeneral(e.target.checked)} />
            <span>
              <span className="flex items-center gap-1.5 text-[13.5px] font-semibold text-slate-800"><Globe size={14} /> Uso general</span>
              <span className="block text-[12px] text-slate-500 mt-0.5">Se puede elegir con cualquier cliente.</span>
            </span>
          </label>
          <div>
            <div className="text-[11px] font-bold uppercase tracking-[0.07em] text-slate-500 mb-1.5">Clientes que la usan ({elegidos.length})</div>
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
    </Modal>
  )
}
