'use client'
import { AlertTriangle } from 'lucide-react'

export default function ConfirmDialog({
  abierto,
  titulo,
  mensaje,
  textoConfirmar = 'Confirmar',
  textoCancelar  = 'Cancelar',
  tipo           = 'default',
  onConfirmar,
  onCancelar,
}) {
  if (!abierto) return null
  const esPeligro = tipo === 'peligro'
  return (
    <>
      {/* Sin backdrop-blur: es el diálogo de confirmación genérico
          (CLAUDE.md pide reusarlo antes de crear uno nuevo), así que puede
          terminar abierto sobre cualquier página — incluido el dashboard,
          donde el mapa de Leaflet usa capas GPU que un backdrop-filter no
          alcanza a difuminar y quedarían nítidas encima del fondo. */}
      <div
        className="fixed inset-0 bg-black/60 z-[60]"
        onClick={esPeligro ? undefined : onCancelar}
      />
      <div className="fixed inset-0 z-[60] flex items-end md:items-center justify-center p-0 md:p-4">
        <div className="bg-white rounded-t-2xl md:rounded-2xl w-full max-w-[460px] p-6 shadow-2xl text-center" style={{ paddingBottom: "max(24px, env(safe-area-inset-bottom))" }}>
          <div className={`w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-4 ${
            esPeligro ? 'bg-red-50' : 'bg-[#E8EEF9]'
          }`}>
            <AlertTriangle size={22} className={esPeligro ? 'text-[#D81B43]' : 'text-[#1B3A6B]'} />
          </div>
          <h3 className="text-[16px] font-bold text-slate-800 mb-2">{titulo}</h3>
          {mensaje && <p className="text-[13px] text-slate-500 leading-relaxed mb-6">{mensaje}</p>}
          {/* Mismo orden que las ventanas del sistema: Cancelar a la izquierda, la acción a la derecha */}
          <div className="flex gap-2">
            <button onClick={onCancelar}
              className="flex-1 h-[40px] bg-white border border-slate-200 text-slate-600 rounded-[9px] text-[13px] font-medium hover:border-slate-300 hover:text-slate-800">
              {textoCancelar}
            </button>
            <button onClick={onConfirmar}
              className={`flex-1 h-[40px] rounded-[9px] text-[13px] font-semibold text-white transition-colors ${
                esPeligro ? 'bg-[#D81B43] hover:bg-[#B0172F]' : 'bg-[#1B3A6B] hover:bg-[#152D54]'
              }`}>
              {textoConfirmar}
            </button>
          </div>
        </div>
      </div>
    </>
  )
}
