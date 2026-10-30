'use client'
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { ZoomIn, ZoomOut, Check, X, Trash2 } from 'lucide-react'
import { renderPaginas, ANCHO_PAGINA } from '@/lib/actas/render'

const ALTO_A4 = Math.round(ANCHO_PAGINA * 297 / 210)

// En qué texto y en qué letra cayó el toque: el cuadro tocado, o la letra bajo el
// puntero (data-o de cada pedazo + la posición dentro de él). Sin texto (un renglón
// vacío), o = Infinity: al final de ese renglón.
function dondeCayo(doc, ev, dato) {
  const tipo = d => d.classList.contains('ed-sis') ? 'sis' : d.classList.contains('ed-libre') ? 'libre' : 'blanco'
  if (dato) return { ruta: dato.closest('[data-src]')?.dataset.src, o: Number(dato.dataset.o), len: Number(dato.dataset.len), var: dato.dataset.var || null, tipo: tipo(dato) }
  let nodo = null, pos = 0
  if (doc.caretRangeFromPoint) { const r = doc.caretRangeFromPoint(ev.clientX, ev.clientY); nodo = r?.startContainer; pos = r?.startOffset || 0 }
  else if (doc.caretPositionFromPoint) { const p = doc.caretPositionFromPoint(ev.clientX, ev.clientY); nodo = p?.offsetNode; pos = p?.offset || 0 }
  const el = nodo?.nodeType === 3 ? nodo.parentElement : nodo
  const pedazo = el?.closest?.('[data-o]')
  const texto = (el?.closest?.('[data-src]')) || ev.target.closest('[data-ed]')?.querySelector('[data-src]')
  if (pedazo && nodo?.nodeType === 3 && !pedazo.classList.contains('ed-dato')) return { ruta: pedazo.closest('[data-src]').dataset.src, o: Number(pedazo.dataset.o) + pos, len: 0 }
  return { ruta: texto?.dataset.src || null, o: Infinity, len: 0 }
}

// El bloque al que se ancla una firma fija que queda a la altura y (px de la hoja): el
// último que empieza a esa altura o más arriba (o el primero). { bi, top } o null.
function anclaEn(doc, y) {
  const arriba = doc.scrollingElement?.scrollTop || 0
  const bloques = [...doc.querySelectorAll('[data-bi]')].map(el => ({ bi: Number(el.dataset.bi), top: el.getBoundingClientRect().top + arriba }))
  if (!bloques.length) return null
  return bloques.filter(b => b.top <= y).pop() || bloques[0]
}

// Firma fija mientras se mueve: se arrastra con el puntero (también con el dedo) y se
// agranda o achica desde la esquina; ✓ guarda la posición, ✕ la deja como estaba y la
// papelera la quita. Posición y ancho en px de la hoja (la vista va escalada).
function FirmaMovil({ firma, escala, altoHoja, onCambio, onTerminar }) {
  const arrastre = useRef(null) // { modo: 'mover' | 'tamano', px, py, x, y, ancho }
  const empezar = (modo, e) => {
    e.preventDefault(); e.stopPropagation()
    e.currentTarget.setPointerCapture?.(e.pointerId)
    arrastre.current = { modo, px: e.clientX, py: e.clientY, x: firma.x, y: firma.y, ancho: firma.ancho }
  }
  const mover = e => {
    const a = arrastre.current
    if (!a) return
    const dx = (e.clientX - a.px) / escala, dy = (e.clientY - a.py) / escala
    if (a.modo === 'mover') onCambio({ x: Math.min(Math.max(0, a.x + dx), ANCHO_PAGINA - a.ancho), y: Math.min(Math.max(0, a.y + dy), altoHoja - 20) })
    else onCambio({ ancho: Math.min(Math.max(40, a.ancho + dx), ANCHO_PAGINA - a.x) })
  }
  const soltar = () => { arrastre.current = null }
  // Esc deja la firma como estaba
  useEffect(() => {
    const onTecla = e => { if (e.key === 'Escape') { e.stopImmediatePropagation(); onTerminar(false) } }
    window.addEventListener('keydown', onTecla, true)
    return () => window.removeEventListener('keydown', onTecla, true)
  }, [onTerminar])
  const arriba = firma.y * escala > 48 // los botones van encima; si no caben, debajo
  const boton = 'w-8 h-8 rounded-full shadow-lg flex items-center justify-center'
  return (
    <div className="absolute z-10 touch-none select-none" style={{ left: firma.x * escala, top: firma.y * escala, width: firma.ancho * escala }}>
      <div onPointerDown={e => empezar('mover', e)} onPointerMove={mover} onPointerUp={soltar} onPointerCancel={soltar}
        className="relative cursor-move outline outline-2 outline-[#2EB5D4] bg-[#2EB5D4]/5 rounded-[2px]">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={firma.url} alt="Firma" draggable={false} className="w-full h-auto pointer-events-none" />
        <span onPointerDown={e => empezar('tamano', e)} onPointerMove={mover} onPointerUp={soltar} onPointerCancel={soltar}
          aria-label="Cambiar tamaño" className="absolute -right-2 -bottom-2 w-5 h-5 rounded-full bg-white border-2 border-[#2EB5D4] cursor-nwse-resize" />
      </div>
      <div className={`absolute right-0 flex gap-1.5 ${arriba ? '-top-11' : '-bottom-11'}`}>
        <button type="button" onClick={() => onTerminar('quitar')} aria-label="Quitar firma" title="Quitar" className={`${boton} bg-white text-[#D81B43]`}><Trash2 size={14} /></button>
        <button type="button" onClick={() => onTerminar(false)} aria-label="Dejar como estaba" title="Dejar como estaba" className={`${boton} bg-white text-slate-500`}><X size={15} /></button>
        <button type="button" onClick={() => onTerminar(true)} aria-label="Guardar posición" title="Guardar posición" className={`${boton} bg-[#0F7B55] text-white`}><Check size={16} strokeWidth={3} /></button>
      </div>
    </div>
  )
}

// Muestra un acta tal como saldrá impresa: una hoja A4 por página, escalada
// al ancho disponible. Cada página va en un iframe para que el CSS del acta no
// choque con el de la app. En celular la hoja queda a menos de la mitad y no se
// lee: "Ampliar" la muestra en tamaño real con desplazamiento lateral.
// onElegir({ bi, ed }): en el editor, tocar la hoja dice qué bloque (bi) y qué
// renglón (ed, render.js → data-ed) se tocó.
// onEspacio({ ruta, o, len, var, tipo, bi, ed, x, y, px, py }): tocar un cuadro (dato o
// raya) o hacer doble clic / doble toque en la hoja dice en qué texto (ruta) y en qué
// letra (o) fue — render.js → interpolarEditor —; x, y es el punto en la pantalla y
// px, py en la hoja (para poner ahí una firma fija).
// onFirma(bi, { x, y, ancho } | null): un clic en una firma fija (render.js → firma_libre)
// la deja mover y cambiar de tamaño; ✓ la guarda ahí, la papelera la quita (null).
export default function VistaActa({ bloques, ctx, onElegir, onEspacio, onFirma }) {
  const paginas = useMemo(() => renderPaginas(bloques, ctx), [bloques, ctx])
  const ref = useRef(null)
  const [ancho, setAncho] = useState(0) // 0 = aún sin medir: no se pinta a tamaño real por un instante
  const [ampliado, setAmpliado] = useState(false)
  // Alto real de cada hoja (si pasa de A4, en el PDF sigue en otra hoja; aquí se ve entera)
  const [altos, setAltos] = useState({})
  const altoDe = i => Math.max(ALTO_A4, altos[paginas[i]] || 0)
  const medir = (i, e) => {
    const h = e.currentTarget.contentDocument?.body?.scrollHeight || 0
    setAltos(a => a[paginas[i]] === h ? a : { ...a, [paginas[i]]: h })
  }
  const elegirRef = useRef({ onElegir, onEspacio, onFirma, bloques })
  useEffect(() => { elegirRef.current = { onElegir, onEspacio, onFirma, bloques } })
  // Firma fija que se está moviendo: { i (hoja), bi, x, y, ancho, url }; su imagen en el
  // iframe se oculta mientras tanto (imgMovida)
  const [moviendo, setMoviendo] = useState(null)
  const imgMovida = useRef(null)
  function terminarMover(guardar) {
    if (!moviendo) return
    const doc = imgMovida.current?.ownerDocument
    if (imgMovida.current) imgMovida.current.style.visibility = ''
    imgMovida.current = null
    if (guardar === 'quitar') onFirma?.(moviendo.bi, null)
    else if (guardar) {
      // Queda anclada al bloque que tiene encima (render.js → paginaHtml): ancla y distancia a él
      const ancla = doc ? anclaEn(doc, moviendo.y) : null
      onFirma?.(moviendo.bi, { x: Math.round(moviendo.x), ancho: Math.round(moviendo.ancho),
        ...(ancla ? { ancla: ancla.bi, dy: Math.round(moviendo.y - ancla.top) } : { y: Math.round(moviendo.y) }) })
    }
    setMoviendo(null)
  }
  // Toques en la hoja (cada carga del iframe trae un documento nuevo)
  function alCargar(i, e) {
    medir(i, e)
    const marco = e.currentTarget
    const doc = marco.contentDocument
    if (!(onElegir || onEspacio || onFirma) || !doc) return
    const estilo = doc.createElement('style')
    estilo.textContent = '[data-bi]{cursor:pointer;border-radius:3px;outline:2px dashed transparent;outline-offset:2px}[data-bi]:hover{outline-color:rgba(46,181,212,.55)}[data-ed]:hover{background:rgba(46,181,212,.10)}.ed-dato:hover{filter:brightness(.94)}[data-firma]{cursor:move}[data-firma]:hover{outline:2px dashed rgba(46,181,212,.7)}'
    doc.head.appendChild(estilo)
    let anterior = null // primer toque, para reconocer el doble (también en el celular)
    doc.addEventListener('click', ev => {
      // Una firma fija: a moverla
      const firma = ev.target.closest?.('[data-firma]')
      if (firma && elegirRef.current.onFirma) {
        const bi = Number(firma.dataset.firma)
        const b = elegirRef.current.bloques?.[bi] || {}
        if (imgMovida.current) imgMovida.current.style.visibility = ''
        // Dónde está de verdad en la hoja (si va anclada, depende de su bloque)
        const r = firma.getBoundingClientRect(), arriba = doc.scrollingElement?.scrollTop || 0
        firma.style.visibility = 'hidden'
        imgMovida.current = firma
        setMoviendo({ i, bi, x: r.left, y: r.top + arriba, ancho: Number(b.ancho) || r.width, url: b.url })
        return
      }
      // Fuera de un bloque (un espacio en blanco de la hoja): cuenta el bloque de más arriba
      const bloque = ev.target.closest?.('[data-bi]')
        || [...doc.querySelectorAll('[data-bi]')].filter(el => el.getBoundingClientRect().top <= ev.clientY).pop()
        || doc.querySelector('[data-bi]')
      if (!bloque) return
      const ahora = Date.now()
      const doble = anterior && ahora - anterior.t < 450 && Math.hypot(ev.clientX - anterior.x, ev.clientY - anterior.y) < 24
      anterior = doble ? null : { t: ahora, x: ev.clientX, y: ev.clientY }
      const bi = Number(bloque.dataset.bi)
      const ed = ev.target.closest('[data-ed]')?.dataset.ed || null
      const dato = ev.target.closest('.ed-dato')
      const { onElegir: elegir, onEspacio: espacio } = elegirRef.current
      if (espacio && (dato || doble)) {
        doc.getSelection()?.removeAllRanges()
        const r = marco.getBoundingClientRect()
        const k = r.width / ANCHO_PAGINA
        const py = ev.clientY + (doc.scrollingElement?.scrollTop || 0)
        espacio({ ...dondeCayo(doc, ev, dato), bi, ed, x: r.left + ev.clientX * k, y: r.top + ev.clientY * k,
          px: ev.clientX, py, ancla: anclaEn(doc, py - 30) })
        return
      }
      elegir?.({ bi, ed })
    })
  }

  useLayoutEffect(() => {
    if (!ref.current) return
    const obs = new ResizeObserver(([e]) => setAncho(e.contentRect.width))
    obs.observe(ref.current)
    return () => obs.disconnect()
  }, [])

  const reducida = ancho > 0 && ancho < ANCHO_PAGINA
  const escala = ampliado || !reducida ? 1 : ancho / ANCHO_PAGINA

  return (
    <div ref={ref} className="w-full">
      {reducida && (
        <div className="flex justify-end mb-2">
          <button type="button" onClick={() => setAmpliado(a => !a)}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-200 rounded-full text-[12px] font-semibold text-slate-600 shadow-sm">
            {ampliado ? <><ZoomOut size={13} /> Ajustar al ancho</> : <><ZoomIn size={13} /> Ampliar</>}
          </button>
        </div>
      )}
      <div className={ampliado ? 'overflow-x-auto -mx-3 px-3' : ''}>
        <div className="space-y-4" style={{ width: ampliado ? ANCHO_PAGINA : undefined }}>
          {ancho > 0 && paginas.map((html, i) => (
            <div key={i} className="siempre-claro relative mx-auto bg-white shadow-md ring-1 ring-slate-200 overflow-hidden"
              style={{ width: ANCHO_PAGINA * escala, height: altoDe(i) * escala }}>
              <iframe srcDoc={html} title={`Página ${i + 1}`} tabIndex={-1} onLoad={e => alCargar(i, e)}
                style={{ width: ANCHO_PAGINA, height: altoDe(i), border: 0, transform: `scale(${escala})`, transformOrigin: 'top left', pointerEvents: onElegir || onEspacio || onFirma ? 'auto' : 'none' }} />
              {moviendo?.i === i && (
                <FirmaMovil firma={moviendo} escala={escala} altoHoja={altoDe(i)}
                  onCambio={c => setMoviendo(m => ({ ...m, ...c }))} onTerminar={terminarMover} />
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
