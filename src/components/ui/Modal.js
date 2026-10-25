'use client'
import { useEffect } from 'react'
import { X } from 'lucide-react'

// Anchos generosos: con 560px los formularios quedaban amontonados
const ANCHOS = { sm: 480, md: 720, lg: 960, xl: 1180 }

// Ventana emergente estándar del panel. Todas tienen la misma forma:
//  - PC: centrada, rounded-2xl, alto máximo de la pantalla menos 3rem.
//  - Celular: hoja que sube desde abajo (rounded-t-2xl, hasta 92% del alto).
//  - Encabezado (título, subtítulo opcional, X), cuerpo con scroll y pie fijo
//    con los botones alineados a la derecha (Cancelar a la izquierda del principal).
// Esc cierra, salvo que `bloqueado` (guardando…).
export default function Modal({
  onCerrar, titulo, subtitulo, icono, tamano = 'md', children, pie,
  bloqueado = false, cerrarConFondo = true, z = 'z-50', sinPadding = false,
}) {
  useEffect(() => {
    const onEsc = e => { if (e.key === 'Escape' && !bloqueado) { e.stopPropagation(); onCerrar?.() } }
    window.addEventListener('keydown', onEsc)
    return () => window.removeEventListener('keydown', onEsc)
  }, [onCerrar, bloqueado])

  return (
    <div className={`fixed inset-0 ${z} flex items-end md:items-center justify-center md:p-6`} role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-slate-900/45" onClick={cerrarConFondo && !bloqueado ? onCerrar : undefined} />
      <div className="relative w-full max-h-[92dvh] md:max-h-[calc(100dvh-3rem)] rounded-t-2xl md:rounded-2xl bg-white flex flex-col shadow-2xl overflow-hidden"
        style={{ maxWidth: `min(${ANCHOS[tamano] || tamano}px, 100%)` }}>
        {titulo !== undefined && (
          <div className="flex items-start gap-3 px-5 md:px-6 py-4 border-b border-slate-200 flex-shrink-0">
            {icono && <div className="w-9 h-9 rounded-[10px] bg-slate-100 text-slate-500 flex items-center justify-center flex-shrink-0">{icono}</div>}
            <div className="min-w-0 flex-1">
              <div className="text-[16px] font-bold text-slate-800 leading-tight">{titulo}</div>
              {subtitulo && <div className="text-[12.5px] text-slate-400 mt-0.5">{subtitulo}</div>}
            </div>
            {onCerrar && (
              <button type="button" onClick={onCerrar} disabled={bloqueado} aria-label="Cerrar"
                className="w-8 h-8 -mr-1 flex items-center justify-center rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 disabled:opacity-40 flex-shrink-0">
                <X size={17} />
              </button>
            )}
          </div>
        )}
        <div className={`flex-1 min-h-0 overflow-y-auto ${sinPadding ? '' : 'px-5 md:px-6 py-5'}`}>{children}</div>
        {pie && (
          <div className="flex items-center justify-end gap-2 px-5 md:px-6 py-3.5 border-t border-slate-200 bg-white flex-shrink-0"
            style={{ paddingBottom: 'max(14px, env(safe-area-inset-bottom))' }}>
            {pie}
          </div>
        )}
      </div>
    </div>
  )
}
