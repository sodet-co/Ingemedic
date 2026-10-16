import { renderPaginas, ANCHO_PAGINA } from './render.js'
import { contextoDeActa } from './firmar.js'

// PDF de las actas firmadas de un préstamo: cada página del acta se pinta en un
// iframe aparte (su CSS no choca con el de la app) y se captura con html2canvas
// a una hoja A4. No usar doc.html() de jsPDF: corrompe el PDF (ver la nota en
// EntregasClient.js).
const ALTO_A4 = Math.round(ANCHO_PAGINA * 297 / 210)

async function capturar(html, html2canvas) {
  const iframe = document.createElement('iframe')
  Object.assign(iframe.style, { position: 'fixed', left: '-10000px', top: '0', width: `${ANCHO_PAGINA}px`, height: `${ALTO_A4}px`, border: '0' })
  document.body.appendChild(iframe)
  try {
    const doc = iframe.contentDocument
    doc.open(); doc.write(html); doc.close()
    // Esperar imágenes (logos, firmas) antes de capturar
    await Promise.all([...doc.images].map(img => img.complete ? null : new Promise(r => { img.onload = img.onerror = r })))
    const alto = Math.max(doc.body.scrollHeight, ALTO_A4)
    iframe.style.height = `${alto}px`
    return await html2canvas(doc.body, { width: ANCHO_PAGINA, windowWidth: ANCHO_PAGINA, height: alto, scale: 2, useCORS: true, backgroundColor: '#ffffff' })
  } finally {
    document.body.removeChild(iframe)
  }
}

// actas: filas de la tabla `actas` (con bloques, datos y firmas)
export async function descargarActasPDF(actas, nombreArchivo) {
  const [{ default: jsPDF }, { default: html2canvas }] = await Promise.all([import('jspdf'), import('html2canvas')])
  const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
  let primera = true
  for (const acta of actas) {
    for (const html of renderPaginas(acta.bloques, contextoDeActa(acta))) {
      const canvas = await capturar(html, html2canvas)
      // Si una página se pasa del alto A4, se parte en varias hojas
      const pxPorHoja = canvas.width * 297 / 210
      for (let y = 0; y < canvas.height; y += pxPorHoja) {
        const alto = Math.min(pxPorHoja, canvas.height - y)
        const corte = document.createElement('canvas')
        corte.width = canvas.width; corte.height = alto
        corte.getContext('2d').drawImage(canvas, 0, y, canvas.width, alto, 0, 0, canvas.width, alto)
        if (!primera) pdf.addPage()
        primera = false
        pdf.addImage(corte.toDataURL('image/jpeg', 0.92), 'JPEG', 0, 0, 210, alto * 210 / canvas.width)
      }
    }
  }
  pdf.save(nombreArchivo)
}
