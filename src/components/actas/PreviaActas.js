'use client'
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { X, Download, Loader2, FileText, ChevronLeft, ChevronRight, ZoomIn, ZoomOut } from 'lucide-react'
import { renderPaginas, ANCHO_PAGINA } from '@/lib/actas/render'
import { contextoDeActa } from '@/lib/actas/firmar'

const ALTO_A4 = Math.round(ANCHO_PAGINA * 297 / 210)

// Vista previa de las actas (o formatos sin firmar) de un préstamo en una
// ventana grande. Se ve una hoja a la vez, entera, y se pasa con las flechas
// (también con ← → del teclado o deslizando en el celular). A la izquierda,
// un índice fijo con los documentos y sus hojas; en el celular, un selector.
// actas: filas con { nombre, bloques, datos, firma_recibe, firma_entrega }
export default function PreviaActas({ actas, inicial = 0, titulo, descargando, onDescargar, onCerrar }) {
  // Todas las hojas de todos los documentos en una sola fila
  const hojas = useMemo(() => actas.flatMap((a, doc) =>
    renderPaginas(a.bloques, contextoDeActa(a)).map((html, i, todas) => ({ html, doc, n: i + 1, de: todas.length }))
  ), [actas])
  const primeraDe = doc => Math.max(0, hojas.findIndex(h => h.doc === doc))

  const [actual, setActual] = useState(() => primeraDe(inicial))
  const [ampliado, setAmpliado] = useState(false)
  const hoja = hojas[actual]
  const ir = d => { setActual(i => Math.min(hojas.length - 1, Math.max(0, i + d))); setAmpliado(false) }

  // Medir el área para que la hoja quepa completa (ancho y alto)
  const area = useRef(null)
  const [caja, setCaja] = useState(null)
  useLayoutEffect(() => {
    if (!area.current) return
    const obs = new ResizeObserver(([e]) => setCaja({ w: e.contentRect.width, h: e.contentRect.height }))
    obs.observe(area.current)
    return () => obs.disconnect()
  }, [])
  // Alto real de la hoja (si pasa de A4, en el PDF sigue en otra hoja; aquí se ve entera)
  const [altos, setAltos] = useState({})
  const alto = Math.max(ALTO_A4, altos[hoja?.html] || 0)
  const ajuste = caja ? Math.min(1, (caja.w - 16) / ANCHO_PAGINA, (caja.h - 16) / alto) : 0
  const escala = ampliado ? 1 : ajuste

  // Teclado: Esc cierra solo esta ventana (no el detalle de abajo), ← → pasan hoja
  useEffect(() => {
    const onTecla = e => {
      if (e.key === 'Escape') { e.stopImmediatePropagation(); onCerrar() }
      else if (e.key === 'ArrowRight') ir(1)
      else if (e.key === 'ArrowLeft') ir(-1)
    }
    window.addEventListener('keydown', onTecla, true)
    return () => window.removeEventListener('keydown', onTecla, true)
  })

  // Deslizar en el celular (solo con la hoja ajustada; ampliada se usa para moverse)
  const toque = useRef(null)
  const onTouchStart = e => { toque.current = e.touches[0].clientX }
  const onTouchEnd = e => {
    if (ampliado || toque.current == null) return
    const dx = e.changedTouches[0].clientX - toque.current
    toque.current = null
    if (Math.abs(dx) > 50) ir(dx < 0 ? 1 : -1)
  }

  if (!hoja) return null
  const flecha = 'absolute top-1/2 -translate-y-1/2 z-10 w-11 h-11 md:w-12 md:h-12 rounded-full bg-white/95 shadow-lg ring-1 ring-slate-200 flex items-center justify-center text-slate-700 hover:bg-white hover:text-[#1B3A6B] disabled:opacity-35 disabled:cursor-default disabled:hover:bg-white/95 disabled:hover:text-slate-700'

  return (
    <>
      <div className="fixed inset-0 bg-black/60 z-[70]" onClick={onCerrar} />
      <div className="fixed inset-0 md:inset-auto md:top-1/2 md:left-1/2 md:-translate-x-1/2 md:-translate-y-1/2 md:w-[min(960px,94vw)] md:h-[94vh] md:rounded-2xl bg-white z-[70] flex flex-col shadow-2xl overflow-hidden">
        <div className="px-4 md:px-5 py-3 border-b flex items-center gap-3 flex-shrink-0" style={{ paddingTop: 'max(12px, env(safe-area-inset-top))' }}>
          <div className="min-w-0 flex-1">
            <div className="text-[15px] font-bold text-slate-800 truncate">{titulo || 'Vista previa'}</div>
            <div className="text-[12px] text-slate-400 truncate">{actas[hoja.doc].nombre}</div>
          </div>
          {onDescargar && (
            <button onClick={onDescargar} disabled={descargando}
              className="flex items-center gap-1.5 px-3 py-2 bg-[#1B3A6B] text-white rounded-[8px] text-[12.5px] font-semibold hover:bg-[#152D54] disabled:opacity-60 flex-shrink-0">
              {descargando ? <Loader2 size={13} className="animate-spin" /> : <Download size={13} />}
              <span className="hidden sm:inline">{descargando ? 'Generando…' : 'Descargar PDF'}</span>
            </button>
          )}
          <button onClick={onCerrar} aria-label="Cerrar" className="text-slate-400 hover:text-slate-600 w-9 h-9 flex items-center justify-center rounded-lg hover:bg-slate-100 flex-shrink-0"><X size={18} /></button>
        </div>
        <div className="flex-1 min-h-0 flex">
        {actas.length > 1 && (
          <nav className="hidden md:flex flex-col w-[230px] flex-shrink-0 border-r bg-white overflow-y-auto py-3">
            <div className="px-4 pb-2 text-[10.5px] font-bold uppercase tracking-[0.1em] text-slate-400">Documentos</div>
            {actas.map((a, d) => {
              const suyas = hojas.map((h, i) => ({ ...h, i })).filter(h => h.doc === d)
              const activo = hoja.doc === d
              return (
                <div key={a.id || d} className="px-2">
                  <button onClick={() => { setActual(primeraDe(d)); setAmpliado(false) }}
                    className={`w-full flex items-start gap-2 px-2.5 py-2 rounded-[8px] text-left text-[12.5px] font-semibold ${activo ? 'bg-[#1B3A6B]/[0.07] text-[#1B3A6B]' : 'text-slate-600 hover:bg-slate-50'}`}>
                    <FileText size={13} className="mt-0.5 flex-shrink-0" />
                    <span className="min-w-0 leading-snug">{a.nombre}</span>
                  </button>
                  {activo && suyas.length > 1 && (
                    <div className="flex flex-wrap gap-1 pl-8 pr-2 pb-2 pt-0.5">
                      {suyas.map(h => (
                        <button key={h.i} onClick={() => { setActual(h.i); setAmpliado(false) }}
                          className={`w-7 h-7 rounded-[6px] text-[11.5px] font-bold tabular-nums ${h.i === actual ? 'bg-[#1B3A6B] text-white' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}>{h.n}</button>
                      ))}
                    </div>
                  )}
                </div>
              )
            })}
          </nav>
        )}
        <div className="flex-1 min-w-0 relative bg-slate-100">
          <button onClick={() => ir(-1)} disabled={actual === 0} aria-label="Hoja anterior" className={`${flecha} left-2 md:left-4`}><ChevronLeft size={22} /></button>
          <button onClick={() => ir(1)} disabled={actual === hojas.length - 1} aria-label="Hoja siguiente" className={`${flecha} right-2 md:right-4`}><ChevronRight size={22} /></button>
          <div ref={area} onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}
            className={`absolute inset-0 ${ampliado ? 'overflow-auto' : 'overflow-hidden flex items-center justify-center'}`}>
            {escala > 0 && (
              <div className={`siempre-claro bg-white shadow-md ring-1 ring-slate-200 overflow-hidden ${ampliado ? 'm-2' : ''}`}
                style={{ width: ANCHO_PAGINA * escala, height: alto * escala, flexShrink: 0 }}>
                <iframe key={actual} srcDoc={hoja.html} title={`Hoja ${actual + 1}`} tabIndex={-1}
                  onLoad={e => { const h = e.currentTarget.contentDocument?.body?.scrollHeight || 0; const k = hoja.html; setAltos(a => a[k] === h ? a : { ...a, [k]: h }) }}
                  style={{ width: ANCHO_PAGINA, height: alto, border: 0, transform: `scale(${escala})`, transformOrigin: 'top left', pointerEvents: 'none' }} />
              </div>
            )}
          </div>
        </div>
        </div>

        <div className="px-4 md:px-5 py-2.5 border-t flex items-center justify-between gap-3 flex-shrink-0" style={{ paddingBottom: 'max(10px, env(safe-area-inset-bottom))' }}>
          {actas.length > 1 && (
            <select value={hoja.doc} onChange={e => { setActual(primeraDe(Number(e.target.value))); setAmpliado(false) }}
              className="md:hidden min-w-0 flex-1 px-2 py-1.5 border border-slate-200 rounded-[8px] text-[13px] text-slate-700 bg-white">
              {actas.map((a, d) => <option key={a.id || d} value={d}>{a.nombre}</option>)}
            </select>
          )}
          <div className="text-[12.5px] text-slate-500 tabular-nums flex-shrink-0">
            Hoja <b className="text-slate-700">{actual + 1}</b> de {hojas.length}
            {actas.length > 1 && hoja.de > 1 && <span className="hidden md:inline text-slate-400"> · {hoja.n}/{hoja.de} del documento</span>}
          </div>
          {ajuste > 0 && ajuste < 1 && (
            <button onClick={() => setAmpliado(a => !a)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-200 rounded-full text-[12px] font-semibold text-slate-600">
              {ampliado ? <><ZoomOut size={13} /> Ver hoja entera</> : <><ZoomIn size={13} /> Ampliar</>}
            </button>
          )}
        </div>
      </div>
    </>
  )
}
