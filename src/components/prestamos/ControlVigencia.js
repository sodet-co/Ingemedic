'use client'
import { useState } from 'react'
import { formatearSoloFecha, hoyBogota, sumarDias } from '@/lib/fechas'

const inputCls = 'w-full px-3 py-2.5 border border-slate-200 rounded-[9px] text-[13.5px] text-slate-800 outline-none focus:border-[#D81B43] bg-white transition-colors placeholder:text-slate-400'
const labelCls = 'block text-[11px] font-bold uppercase tracking-[0.07em] text-slate-500 mb-1.5'

const PRESETS_VIGENCIA = [30, 60, 90]

// Captura de fecha_vigencia — un solo control para el wizard y para editar una
// orden existente. Apagado = préstamo indefinido (fecha_vigencia null, caso de
// las instituciones). Encendido = chips de 30/60/90 días desde hoy, o "Hasta
// fecha" con selector — siempre se guarda solo la fecha final, nunca la
// duración (si luego se extiende, la duración deja de ser verdad).
export default function ControlVigencia({ value, onChange }) {
  const activo = !!value
  const chipsCalculados = PRESETS_VIGENCIA.map(dias => ({ dias, fecha: sumarDias(hoyBogota(), dias) }))
  const [modo, setModo] = useState(() => {
    const coincideConChip = value && chipsCalculados.some(c => c.fecha === value)
    return value && !coincideConChip ? 'fecha' : 'chip'
  })

  function toggle() {
    if (activo) { onChange(null); return }
    onChange(sumarDias(hoyBogota(), 30)) // al encender, preselecciona 30 días
    setModo('chip')
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <span className={labelCls + ' mb-0'}>Vigencia del préstamo</span>
        <button type="button" onClick={toggle} aria-pressed={activo}
          className={`relative w-10 h-6 rounded-full transition-colors flex-shrink-0 ${activo ? 'bg-[#D81B43]' : 'bg-slate-200'}`}>
          <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${activo ? 'translate-x-4' : ''}`} />
        </button>
      </div>

      {!activo ? (
        <div className="text-[12.5px] text-slate-400">Préstamo indefinido — sin fecha de vencimiento (uso típico para instituciones).</div>
      ) : (
        <div className="space-y-2.5">
          <div className="flex items-center gap-2 flex-wrap">
            {chipsCalculados.map(c => (
              <button type="button" key={c.dias} onClick={() => { onChange(c.fecha); setModo('chip') }}
                className={`px-3 py-1.5 rounded-full text-[12px] font-medium border transition-all ${
                  modo === 'chip' && value === c.fecha
                    ? 'bg-[#D81B43] text-white border-[#D81B43]'
                    : 'bg-white border-slate-200 text-slate-600 hover:border-[#D81B43]'
                }`}>
                {c.dias} días
              </button>
            ))}
            <button type="button" onClick={() => setModo('fecha')}
              className={`px-3 py-1.5 rounded-full text-[12px] font-medium border transition-all ${
                modo === 'fecha' ? 'bg-[#D81B43] text-white border-[#D81B43]' : 'bg-white border-slate-200 text-slate-600 hover:border-[#D81B43]'
              }`}>
              Hasta fecha
            </button>
          </div>
          {modo === 'fecha' && (
            <input type="date" value={value || ''} onChange={e => onChange(e.target.value || null)} className={inputCls} />
          )}
          {value && (
            <div className="text-[11.5px] text-slate-400">Vence el {formatearSoloFecha(value)}</div>
          )}
        </div>
      )}
    </div>
  )
}
