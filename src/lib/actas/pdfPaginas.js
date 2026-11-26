// Plantilla desde un PDF (hoja fija): cada página del PDF se vuelve una imagen y
// queda tal cual, sin leer ni interpretar nada. Encima, en el editor
// (components/actas/EditorHojaFija.js), se ubica a mano dónde va cada dato, firma
// o tabla de equipos (render.js → hojaFija). Así un formato nuevo nunca depende
// de cómo esté armado el Word.

import { subirImagen } from './imagenesPlantilla'

const ANCHO_IMAGEN = 1600 // px: nítido al doble del ancho de render (760)
const MAX_PAGINAS = 20

// PDF → [{ blob (JPEG), proporcion (alto / ancho) }]
export async function leerPdf(archivo) {
  const pdfjs = await import('pdfjs-dist')
  pdfjs.GlobalWorkerOptions.workerSrc = new URL('pdfjs-dist/build/pdf.worker.min.mjs', import.meta.url).toString()
  const tarea = pdfjs.getDocument({ data: new Uint8Array(await archivo.arrayBuffer()) })
  const doc = await tarea.promise
  if (doc.numPages > MAX_PAGINAS) { tarea.destroy?.(); throw new Error(`El PDF tiene ${doc.numPages} páginas; el máximo es ${MAX_PAGINAS}.`) }
  const paginas = []
  for (let n = 1; n <= doc.numPages; n++) {
    const pagina = await doc.getPage(n)
    const base = pagina.getViewport({ scale: 1 })
    const vista = pagina.getViewport({ scale: ANCHO_IMAGEN / base.width })
    const canvas = document.createElement('canvas')
    canvas.width = Math.round(vista.width); canvas.height = Math.round(vista.height)
    const ctx = canvas.getContext('2d')
    ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, canvas.width, canvas.height)
    await pagina.render({ canvasContext: ctx, canvas, viewport: vista }).promise
    const blob = await new Promise(ok => canvas.toBlob(ok, 'image/jpeg', 0.92))
    paginas.push({ blob, proporcion: Math.round(vista.height / vista.width * 10000) / 10000 })
    pagina.cleanup()
  }
  // Libera el worker (en pdfjs 6 se hace desde la tarea, no desde el documento)
  await tarea.destroy?.()
  return paginas
}

// Sube las páginas (y el PDF original, para poder descargarlo) y arma los bloques
export async function bloquesDesdePdf(supabase, archivo) {
  const paginas = await leerPdf(archivo)
  if (!paginas.length) throw new Error('El PDF no tiene páginas')
  const urls = []
  for (const p of paginas) urls.push(await subirImagen(supabase, new File([p.blob], 'pagina.jpg', { type: 'image/jpeg' })))
  // El original es opcional: si el bucket no acepta PDF, la plantilla sirve igual
  let original = null
  try { original = await subirImagen(supabase, archivo) } catch { /* sin original */ }
  const bloques = []
  paginas.forEach((p, i) => {
    if (i) bloques.push({ tipo: 'salto_pagina' })
    bloques.push({ tipo: 'hoja_fija', url: urls[i], proporcion: p.proporcion, campos: [], ...(i === 0 && original ? { original } : {}) })
  })
  return bloques
}

export const esHojaFija = bloques => (bloques || []).some(b => b.tipo === 'hoja_fija')
