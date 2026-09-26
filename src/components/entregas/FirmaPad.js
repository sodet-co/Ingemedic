'use client'
import { useEffect, useRef, useState } from 'react'

// Tamaño de la imagen que se guarda. Proporción ~2.75:1, la misma del recuadro
// donde el acta PDF (EntregasClient.js → doc.addImage(..., 55, 20)) pone la
// firma, para que no salga estirada.
const EXPORT_W = 550
const EXPORT_H = 200
const MARGEN   = 12

// Pad de firma sobre canvas — compartido entre la vista de admin (EntregasClient.js)
// y la vista de repartidor (EntregasRepartidorClient.js).
//
// - El canvas mide lo mismo que su recuadro en pantalla (× devicePixelRatio).
//   Antes era un 900×500 fijo estirado con CSS: en un celular vertical la firma
//   quedaba deformada ~3 veces a lo alto.
// - Al guardar se recorta al trazo y se centra, sin deformar, en un PNG de
//   EXPORT_W×EXPORT_H con fondo BLANCO (transparente se veía negro en
//   WhatsApp, galería y algunos PDF).
// - Solo se reporta la firma si de verdad se trazó algo (un toque o que el
//   mouse saliera del recuadro enviaba una firma en blanco).
export default function FirmaPad({ onFirma, onLimpiar, fullscreen = false }) {
  const canvasRef = useRef(null)
  const drawing   = useRef(false)
  const bbox      = useRef(null)   // límites del trazo en px de pantalla
  const [vacio, setVacio] = useState(true)

  // Ajusta el canvas a su tamaño real. Cambiar width/height borra el dibujo,
  // así que si ya había firma (p. ej. al girar el celular) se pide de nuevo.
  useEffect(() => {
    const canvas = canvasRef.current
    function ajustar() {
      const r = canvas.getBoundingClientRect()
      const dpr = window.devicePixelRatio || 1
      const w = Math.round(r.width * dpr), h = Math.round(r.height * dpr)
      if (!w || !h || (canvas.width === w && canvas.height === h)) return
      canvas.width = w; canvas.height = h
      const ctx = canvas.getContext('2d')
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      ctx.fillStyle = '#FFFFFF'
      ctx.fillRect(0, 0, r.width, r.height)
      if (bbox.current) { bbox.current = null; setVacio(true); onLimpiar() }
    }
    ajustar()
    const ro = new ResizeObserver(ajustar)
    ro.observe(canvas)
    return () => ro.disconnect()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function getPos(e) {
    const r = canvasRef.current.getBoundingClientRect()
    const src = e.touches ? e.touches[0] : e
    return { x: src.clientX - r.left, y: src.clientY - r.top }
  }
  function ampliarBbox({ x, y }) {
    const b = bbox.current
    bbox.current = b
      ? { x0: Math.min(b.x0, x), y0: Math.min(b.y0, y), x1: Math.max(b.x1, x), y1: Math.max(b.y1, y) }
      : { x0: x, y0: y, x1: x, y1: y }
  }
  function start(e) {
    e.preventDefault()
    const ctx = canvasRef.current.getContext('2d')
    const pos = getPos(e)
    ctx.beginPath(); ctx.moveTo(pos.x, pos.y)
    drawing.current = true
  }
  function move(e) {
    e.preventDefault()
    if (!drawing.current) return
    const ctx = canvasRef.current.getContext('2d')
    const pos = getPos(e)
    ctx.lineWidth = 2.5; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.strokeStyle = '#1B3A6B'
    ctx.lineTo(pos.x, pos.y); ctx.stroke(); ctx.beginPath(); ctx.moveTo(pos.x, pos.y)
    ampliarBbox(pos)
    if (vacio) setVacio(false)
  }
  function end() {
    if (!drawing.current) return
    drawing.current = false
    if (bbox.current) onFirma(exportar())
  }

  // Recorta al trazo y lo centra, conservando proporción, en un PNG blanco fijo
  function exportar() {
    const canvas = canvasRef.current
    const dpr = window.devicePixelRatio || 1
    const pad = 6
    const b = bbox.current
    const sx = Math.max(0, (b.x0 - pad) * dpr), sy = Math.max(0, (b.y0 - pad) * dpr)
    const sw = Math.min(canvas.width - sx, (b.x1 - b.x0 + pad * 2) * dpr)
    const sh = Math.min(canvas.height - sy, (b.y1 - b.y0 + pad * 2) * dpr)

    const out = document.createElement('canvas')
    out.width = EXPORT_W; out.height = EXPORT_H
    const ctx = out.getContext('2d')
    ctx.fillStyle = '#FFFFFF'
    ctx.fillRect(0, 0, EXPORT_W, EXPORT_H)
    const escala = Math.min((EXPORT_W - MARGEN * 2) / sw, (EXPORT_H - MARGEN * 2) / sh)
    const dw = sw * escala, dh = sh * escala
    ctx.drawImage(canvas, sx, sy, sw, sh, (EXPORT_W - dw) / 2, (EXPORT_H - dh) / 2, dw, dh)
    return out.toDataURL('image/png')
  }

  function limpiar() {
    const canvas = canvasRef.current
    const r = canvas.getBoundingClientRect()
    const ctx = canvas.getContext('2d')
    ctx.fillStyle = '#FFFFFF'
    ctx.fillRect(0, 0, r.width, r.height)
    bbox.current = null
    setVacio(true); onLimpiar()
  }

  return (
    <div className={fullscreen ? 'flex-1 flex flex-col min-h-0' : ''}>
      <div className={`border-2 border-dashed border-slate-300 rounded-[10px] overflow-hidden bg-white relative ${
        fullscreen ? 'flex-1 min-h-[240px]' : 'h-[160px]'
      }`}>
        <canvas ref={canvasRef}
          className="touch-none cursor-crosshair block w-full h-full"
          onMouseDown={start} onMouseMove={move} onMouseUp={end} onMouseLeave={end}
          onTouchStart={start} onTouchMove={move} onTouchEnd={end} />
        {vacio && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <span className={`text-slate-300 font-medium ${fullscreen ? 'text-[15px]' : 'text-[12px]'}`}>Firme aquí</span>
          </div>
        )}
      </div>
      <button type="button" onClick={limpiar} className="mt-2 text-[12.5px] text-slate-400 hover:text-red-500 transition-colors flex-shrink-0">
        Limpiar firma
      </button>
    </div>
  )
}
