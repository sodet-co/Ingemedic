'use client'
import { useLayoutEffect, useMemo, useRef, useState } from 'react'
import { ZoomIn, ZoomOut } from 'lucide-react'
import { renderPaginas, ANCHO_PAGINA } from '@/lib/actas/render'

const ALTO_A4 = Math.round(ANCHO_PAGINA * 297 / 210)

// Muestra un acta tal como saldrá impresa: una hoja A4 por página, escalada
// al ancho disponible. Cada página va en un iframe para que el CSS del acta no
// choque con el de la app. En celular la hoja queda a menos de la mitad y no se
// lee: "Ampliar" la muestra en tamaño real con desplazamiento lateral.
export default function VistaActa({ bloques, ctx }) {
  const paginas = useMemo(() => renderPaginas(bloques, ctx), [bloques, ctx])
  const ref = useRef(null)
  const [ancho, setAncho] = useState(0) // 0 = aún sin medir: no se pinta a tamaño real por un instante
  const [ampliado, setAmpliado] = useState(false)

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
            <div key={i} className="mx-auto bg-white shadow-md ring-1 ring-slate-200 overflow-hidden"
              style={{ width: ANCHO_PAGINA * escala, height: ALTO_A4 * escala }}>
              <iframe srcDoc={html} title={`Página ${i + 1}`} tabIndex={-1}
                style={{ width: ANCHO_PAGINA, height: ALTO_A4, border: 0, transform: `scale(${escala})`, transformOrigin: 'top left', pointerEvents: 'none' }} />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
