'use client'

const inputCls = 'w-full px-3 py-2.5 border border-slate-200 rounded-[9px] text-[13.5px] text-slate-800 outline-none focus:border-[#D81B43] bg-white transition-colors placeholder:text-slate-400'
const labelCls = 'block text-[11px] font-bold uppercase tracking-[0.07em] text-slate-500 mb-1.5'

// Modal de fecha + observaciones + Confirmar para marcar un equipo como devuelto.
// Compartido entre Préstamos (OrdenesClient) y los paneles de detalle de
// Cliente/Paciente (ClientesClient) — mismo JSX que ya vivía en OrdenesClient.
export default function ModalDevolucion({ abierto, form, onChangeFecha, onChangeObservaciones, onConfirmar, onCancelar }) {
  if (!abierto) return null

  return (
    <>
      {/* z-75: por encima de cualquier otro modal/pop-up desde el que se
          pueda abrir este (ej. el pop-up de atención del dashboard, z-65) —
          si no, este modal queda detrás y ni se ve ni se puede interactuar. */}
      <div className="fixed inset-0 bg-black/50 z-[75] backdrop-blur-sm" onClick={onCancelar} />
      <div className="fixed inset-0 z-[75] flex items-end md:items-center justify-center p-0 md:p-4">
        <div className="bg-white rounded-t-2xl md:rounded-2xl w-full max-w-[380px] p-6 shadow-2xl">
          <h3 className="text-[16px] font-bold text-slate-800 mb-4">Marcar como devuelto</h3>
          <div className="space-y-3">
            <div>
              <label className={labelCls}>Fecha de devolución <span className="text-[#D81B43]">*</span></label>
              <input type="date" value={form.fecha}
                onChange={e => onChangeFecha(e.target.value)}
                className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Observaciones (opcional)</label>
              <textarea value={form.observaciones}
                onChange={e => onChangeObservaciones(e.target.value)}
                placeholder="Estado del equipo, novedades, etc." rows={3}
                className="w-full px-3 py-2.5 border border-slate-200 rounded-[9px] text-[13.5px] outline-none focus:border-[#D81B43] resize-none placeholder:text-slate-400" />
            </div>
          </div>
          <div className="flex gap-2 mt-5">
            <button type="button" disabled={!form.fecha}
              onClick={onConfirmar}
              className="flex-1 py-2.5 bg-[#D81B43] text-white rounded-[9px] text-[13px] font-semibold hover:bg-[#B0172F] disabled:opacity-50">
              Confirmar
            </button>
            <button type="button" onClick={onCancelar}
              className="flex-1 py-2.5 bg-slate-100 text-slate-600 rounded-[9px] text-[13px] font-semibold hover:bg-slate-200">
              Cancelar
            </button>
          </div>
        </div>
      </div>
    </>
  )
}
