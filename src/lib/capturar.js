// Convierte HTML en imagen (canvas) para armar PDFs con jsPDF: actas, informe
// del cliente, hoja de vida del equipo. Un solo lugar para todos.
//
// El HTML se pinta en un iframe aparte (su CSS no choca con el de la app) y el
// texto lo dibuja el navegador (html2canvas con foreignObject): cuando html2canvas
// dibuja el texto él mismo, en algunos equipos (celulares sin Arial) calcula mal
// la altura de la letra y los textos quedan corridos sobre rayas y bordes. En
// ese modo las imágenes externas no cargan, así que se incrustan antes. Si el
// navegador no lo soporta (captura bloqueada o vacía), se usa el dibujo normal.
// No usar doc.html() de jsPDF: corrompe el PDF.

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
    const { data } = canvas.getContext('2d').getImageData(0, 0, canvas.width, Math.min(canvas.height, 400))
    for (let i = 0; i < data.length; i += 64) if (data[i] < 200) return true
    return false
  } catch { return false }
}

// html: documento completo o fragmento. ancho en px; altoMinimo para que la hoja
// tenga al menos ese alto (actas: A4); escala 2 = nítido (1 en celular ahorra memoria).
export async function capturarHTML(html, { ancho, altoMinimo = 0, escala = 2 } = {}) {
  const { default: html2canvas } = await import('html2canvas')
  const iframe = document.createElement('iframe')
  Object.assign(iframe.style, { position: 'fixed', left: '-10000px', top: '0', width: `${ancho}px`, height: `${Math.max(altoMinimo, 100)}px`, border: '0' })
  document.body.appendChild(iframe)
  try {
    const doc = iframe.contentDocument
    const completo = /^\s*(<!doctype|<html)/i.test(html)
    doc.open()
    doc.write(completo ? html : `<!DOCTYPE html><html><head><meta charset="utf-8"><style>*{box-sizing:border-box}body{margin:0;background:#fff}</style></head><body>${html}</body></html>`)
    doc.close()
    // Esperar imágenes (logos, firmas) antes de capturar
    await Promise.all([...doc.images].map(img => img.complete ? null : new Promise(r => { img.onload = img.onerror = r })))
    const alto = Math.max(doc.body.scrollHeight, doc.documentElement.scrollHeight, altoMinimo)
    iframe.style.height = `${alto}px`
    const opciones = { width: ancho, windowWidth: ancho, height: alto, scale: escala, useCORS: true, backgroundColor: '#ffffff', logging: false }
    try {
      await incrustarImagenes(doc)
      const canvas = await html2canvas(doc.body, { ...opciones, foreignObjectRendering: true })
      if (sirve(canvas)) return canvas
    } catch { /* sin soporte: dibujo normal */ }
    return await html2canvas(doc.body, opciones)
  } finally {
    document.body.removeChild(iframe)
  }
}
