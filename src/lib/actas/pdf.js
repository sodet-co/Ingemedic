import { renderPaginas, ANCHO_PAGINA } from './render.js'
import { contextoDeActa } from './firmar.js'
import { capturarHTML } from '../capturar.js'

// PDF de las actas firmadas de un préstamo: cada página del acta se captura
// (lib/capturar.js) y va a una hoja A4. Si una página no cabe en una hoja, se
// parte en varias, pero solo entre bloques, filas de tabla o renglones de
// texto (cortesSeguros): nunca a mitad de una línea.
const ALTO_A4 = Math.round(ANCHO_PAGINA * 297 / 210)
const MARGEN = 28 // px: el padding de arriba del body (render.js); se repite en las hojas que siguen

// Alturas (px del documento) donde se puede cortar sin partir nada
function cortesSeguros(doc) {
  const cortes = new Set()
  const y = r => Math.round(r.bottom + doc.defaultView.scrollY)
  doc.querySelectorAll('.bloque').forEach(b => {
    // Antes de cada bloque; después de un título no (va pegado a lo que sigue)
    cortes.add(Math.round(b.getBoundingClientRect().top + doc.defaultView.scrollY) - 4)
    if (!b.firstElementChild?.classList.contains('titulo')) cortes.add(y(b.getBoundingClientRect()))
  })
  // Filas de tablas (no la del encabezado de columnas) y renglones de campos
  doc.querySelectorAll('.bloque tbody tr:not(:first-child), .grilla tr, .linea, .linea-arriba').forEach(el => {
    cortes.add(Math.round(el.getBoundingClientRect().top + doc.defaultView.scrollY) - 2)
  })
  // Renglones de los párrafos
  doc.querySelectorAll('.texto').forEach(t => {
    const rango = doc.createRange()
    rango.selectNodeContents(t)
    for (const r of rango.getClientRects()) cortes.add(y(r) + 1)
  })
  return [...cortes].sort((a, b) => a - b)
}

// Hojas listas para jsPDF: [{ imagen, x, y, ancho, alto }] en mm
export async function armarHojas(actas) {
  const hojas = []
  for (const acta of actas) {
    for (const html of renderPaginas(acta.bloques, contextoDeActa(acta))) {
      const canvas = await capturarHTML(html, { ancho: ANCHO_PAGINA, altoMinimo: ALTO_A4, medir: cortesSeguros })
      const escala = canvas.width / ANCHO_PAGINA
      const altoDoc = canvas.height / escala
      // Se pasa poco (hasta 8 %): se achica un poco y cabe en una sola hoja
      if (altoDoc <= ALTO_A4 * 1.08) {
        const ancho = altoDoc > ALTO_A4 ? 210 * ALTO_A4 / altoDoc : 210
        hojas.push({ imagen: canvas.toDataURL('image/jpeg', 0.92), x: (210 - ancho) / 2, y: 0, ancho, alto: ancho * altoDoc / ANCHO_PAGINA })
        continue
      }
      const cortes = canvas.medidas || []
      let desde = 0
      while (desde < altoDoc - 4) {
        const margen = desde ? MARGEN : 0
        const cabe = ALTO_A4 - margen - MARGEN
        let hasta = Math.min(desde + cabe, altoDoc)
        if (hasta < altoDoc) {
          // El corte seguro más bajo que quepa (sin dejar la hoja medio vacía)
          const seguro = cortes.filter(c => c > desde + cabe * 0.4 && c <= hasta).pop()
          if (seguro) hasta = seguro
        }
        const corte = document.createElement('canvas')
        corte.width = canvas.width
        corte.height = Math.round((hasta - desde) * escala)
        corte.getContext('2d').drawImage(canvas, 0, Math.round(desde * escala), canvas.width, corte.height, 0, 0, canvas.width, corte.height)
        if (!desde || !enBlanco(corte)) {
          hojas.push({ imagen: corte.toDataURL('image/jpeg', 0.92), x: 0, y: margen * 210 / ANCHO_PAGINA, ancho: 210, alto: (hasta - desde) * 210 / ANCHO_PAGINA })
        }
        desde = hasta
      }
    }
  }
  return hojas
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

async function armarPDF(actas) {
  const { default: jsPDF } = await import('jspdf')
  const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
  ;(await armarHojas(actas)).forEach((h, i) => {
    if (i) pdf.addPage()
    pdf.addImage(h.imagen, 'JPEG', h.x, h.y, h.ancho, h.alto)
  })
  return pdf
}

// actas: filas de la tabla `actas` (con bloques, datos y firmas)
export async function descargarActasPDF(actas, nombreArchivo) {
  (await armarPDF(actas)).save(nombreArchivo)
}

// Nombre de archivo a partir del nombre del acta (sin tildes ni símbolos)
export function nombreDeArchivo(texto) {
  return String(texto || 'Acta').normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^\w-]+/g, '_').replace(/_+/g, '_').replace(/^_|_$/g, '') || 'Acta'
}

// Un PDF por acta: <prefijo>_<nombre del acta>.pdf. Se bajan uno tras otro con
// una pausa corta (sin ella, algunos navegadores se quedan solo con el último).
export async function descargarActasSeparadas(actas, prefijo) {
  const usados = {}
  for (const acta of actas) {
    let nombre = `${prefijo}_${nombreDeArchivo(acta.nombre)}`
    usados[nombre] = (usados[nombre] || 0) + 1
    if (usados[nombre] > 1) nombre += `_${usados[nombre]}`
    ;(await armarPDF([acta])).save(`${nombre}.pdf`)
    await new Promise(r => setTimeout(r, 400))
  }
}
