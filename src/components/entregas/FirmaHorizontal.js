'use client'
import { useEffect, useState } from 'react'
import { X, Check, RotateCw } from 'lucide-react'
import FirmaPad from './FirmaPad'
import { ui } from '@/lib/ui'

// Firma a pantalla completa y de lado, para quien prefiera firmar con el celular
// horizontal. Intenta poner la pantalla en horizontal (Android, pantalla completa);
// si el celular sigue vertical (iPhone o giro bloqueado), el pad se dibuja rotado y
// se pide girar el celular. La firma se guarda derecha (FirmaPad recorta al trazo),
// así que en el PDF sale igual que una firmada en vertical.
export default function FirmaHorizontal({ titulo, onListo, onCerrar }) {
  const [vertical, setVertical] = useState(() => typeof window !== 'undefined' && window.matchMedia('(orientation: portrait)').matches)
  const [firma, setFirma] = useState(null)

  useEffect(() => {
    const mq = window.matchMedia('(orientation: portrait)')
    const cambio = () => setVertical(mq.matches)
    mq.addEventListener('change', cambio)
    // Pantalla completa + horizontal donde el navegador lo permite (si no, no pasa nada)
    document.documentElement.requestFullscreen?.().then(() => screen.orientation?.lock?.('landscape')).catch(() => {})
    return () => {
      mq.removeEventListener('change', cambio)
      try { screen.orientation?.unlock?.() } catch { /* no soportado */ }
      if (document.fullscreenElement) document.exitFullscreen?.().catch(() => {})
    }
  }, [])

  // Celular vertical: todo el contenido rotado 90° a la derecha (se lee girando el celular)
  const estilo = vertical
    ? { position: 'absolute', top: 0, left: '100vw', width: '100dvh', height: '100vw', transform: 'rotate(90deg)', transformOrigin: 'top left' }
    : { position: 'absolute', inset: 0 }

  return (
    <div className="fixed inset-0 z-[90] bg-white overflow-hidden" role="dialog" aria-modal="true" aria-label="Firmar en horizontal">
      <div style={estilo} className="flex flex-col p-3 gap-2">
        <div className="flex items-center gap-2 flex-shrink-0">
          <div className="flex-1 min-w-0">
            <div className="text-[15px] font-bold text-slate-800 truncate">{titulo}</div>
            {vertical && <div className="text-[12px] text-slate-500 flex items-center gap-1"><RotateCw size={12} /> Gira el celular para firmar de lado</div>}
          </div>
          <button type="button" onClick={onCerrar} className={ui.btnSecundario}><X size={14} /> Cancelar</button>
          <button type="button" onClick={() => onListo(firma)} disabled={!firma} className={ui.btnPrimario}><Check size={14} /> Listo</button>
        </div>
        {/* key: al girar se arma de nuevo (el tamaño cambia y el trazo se pierde) */}
        <FirmaPad key={vertical ? 'v' : 'h'} fullscreen girado={vertical} onFirma={setFirma} onLimpiar={() => setFirma(null)} />
      </div>
    </div>
  )
}
