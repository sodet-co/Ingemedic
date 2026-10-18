import { renderPaginas, ANCHO_PAGINA } from './render.js'
import { contextoDeActa } from './firmar.js'

// PDF de las actas firmadas de un préstamo: cada página del acta se pinta en un
// iframe aparte (su CSS no choca con el de la app) y se captura con html2canvas
// a una hoja A4. No usar doc.html() de jsPDF: corrompe el PDF (ver la nota en
// EntregasClient.js).
const ALTO_A4 = Math.round(ANCHO_PAGINA * 297 / 210)

// Logos y demás imágenes por URL → data URL dentro del documento
async function incrustarImagenes(doc) {
  await Promise.all([...doc.images].filter(img => img.src && !img.src.startsWith('data:')).map(async img => {
    const blob = await (await fetch(img.src, { mode: 'cors' })).blob()
    img.src = await new Promise((ok, mal) => { const fr = new FileReader(); fr.onload = () => ok(fr.result); fr.onerror = mal; fr.readAsDataURL(blob) })
    await img.decode().catch(() => {})
  }))
}

// ¿La captura salió bien? Ni bloqueada (Safari viejo) ni vacía (navegador sin soporte)
function sirve(canvas) {
  try {
    const ctx = canvas.getContext('2d')
    const { data } = ctx.getImageData(0, 0, canvas.width, Math.min(canvas.height, 400))
    for (let i = 0; i < data.length; i += 64) if (data[i] < 200) return true
    return false
  } catch { return false }
}

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
    const opciones = { width: ANCHO_PAGINA, windowWidth: ANCHO_PAGINA, height: alto, scale: 2, useCORS: true, backgroundColor: '#ffffff' }
    // Que el texto lo dibuje el navegador (foreignObject): html2canvas, al dibujarlo
    // él mismo, calcula mal la altura de la letra en algunos equipos (celulares sin
    // Arial) y los valores quedaban corridos sobre las rayas. En ese modo las
    // imágenes externas no cargan: los logos se incrustan antes.
    try {
      await incrustarImagenes(doc)
      const canvas = await html2canvas(doc.body, { ...opciones, foreignObjectRendering: true })
      if (sirve(canvas)) return canvas
    } catch { /* este navegador no lo soporta: se usa el dibujo de html2canvas */ }
    return await html2canvas(doc.body, opciones)
  } finally {
    document.body.removeChild(iframe)
  }
}

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
  const [{ default: jsPDF }, { default: html2canvas }] = await Promise.all([import('jspdf'), import('html2canvas')])
  const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
  let primera = true
  for (const acta of actas) {
    for (const html of renderPaginas(acta.bloques, contextoDeActa(acta))) {
      const canvas = await capturar(html, html2canvas)
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
