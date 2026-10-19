import { renderPaginas, ANCHO_PAGINA } from './render.js'
import { contextoDeActa } from './firmar.js'
import { capturarHTML } from '../capturar.js'

// PDF de las actas firmadas de un préstamo: cada página del acta se captura
// (lib/capturar.js) y va a una hoja A4.
const ALTO_A4 = Math.round(ANCHO_PAGINA * 297 / 210)

// ¿El pedazo está todo en blanco? (se revisa un píxel de cada 4 en cada eje)
function enBlanco(canvas) {
  const { data } = canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height)
  const fila = canvas.width * 4
  for (let y = 0; y < canvas.height; y += 4) {
    for (let x = 0; x < fila; x += 16) {
      const i = y * fila + x
      if (data[i] < 245 || data[i + 1] < 245 || data[i + 2] < 245) return false
    }
  }
  return true
}

// actas: filas de la tabla `actas` (con bloques, datos y firmas)
export async function descargarActasPDF(actas, nombreArchivo) {
  const { default: jsPDF } = await import('jspdf')
  const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
  let primera = true
  for (const acta of actas) {
    for (const html of renderPaginas(acta.bloques, contextoDeActa(acta))) {
      const canvas = await capturarHTML(html, { ancho: ANCHO_PAGINA, altoMinimo: ALTO_A4 })
      // Si una página se pasa del alto A4, se parte en varias hojas. El alto va
      // redondeado (con decimales quedaba un resto de 0,3 px que salía como hoja
      // en blanco) y un pedazo sin nada (el margen que se pasa unos píxeles) no
      // se agrega como hoja.
      const pxPorHoja = Math.round(canvas.width * 297 / 210)
      // Se pasa poco (hasta 8 %): se achica un poco y cabe en una sola hoja
      if (canvas.height > pxPorHoja && canvas.height <= pxPorHoja * 1.08) {
        if (!primera) pdf.addPage()
        primera = false
        const ancho = 210 * pxPorHoja / canvas.height
        pdf.addImage(canvas.toDataURL('image/jpeg', 0.92), 'JPEG', (210 - ancho) / 2, 0, ancho, 297)
        continue
      }
      for (let y = 0; y < canvas.height; y += pxPorHoja) {
        const alto = Math.min(pxPorHoja, canvas.height - y)
        if (alto < 4) continue
        const corte = document.createElement('canvas')
        corte.width = canvas.width; corte.height = alto
        corte.getContext('2d').drawImage(canvas, 0, y, canvas.width, alto, 0, 0, canvas.width, alto)
        if (y > 0 && enBlanco(corte)) continue
        if (!primera) pdf.addPage()
        primera = false
        pdf.addImage(corte.toDataURL('image/jpeg', 0.92), 'JPEG', 0, 0, 210, alto * 210 / canvas.width)
      }
    }
  }
  pdf.save(nombreArchivo)
}
