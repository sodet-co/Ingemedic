// Página de una plantilla desde PDF (bloque hoja_fija) dibujada directo en un canvas
// para el PDF del acta. No pasa por html2canvas: ahí la letra quedaba unos píxeles
// más abajo que en pantalla y se montaba sobre la raya del formato. Aquí la base de
// cada letra cae exactamente en el borde de abajo del recuadro, igual que en el
// editor y en la vista previa (render.js → hojaFija, .hf-base).

import { ANCHO_PAGINA, ALTO_HOJA, cajaHojaFija, filasHojaFija, letraHojaFija, esRenglonHojaFija } from './render.js'

const FUENTE = 'Arial, Helvetica, sans-serif'

function cargar(src) {
  return new Promise((ok, mal) => {
    const img = new Image()
    if (!src.startsWith('data:')) img.crossOrigin = 'anonymous'
    img.onload = () => ok(img)
    img.onerror = () => mal(new Error('No se pudo cargar una imagen del acta'))
    img.src = src
  })
}

// {{variable}} → su valor, sin marcas de **negrita** ni [Firma …] (texto plano)
const textoPlano = (valor, vars) => String(valor || '')
  .replace(/\{\{\s*([a-z0-9_]+)\s*\}\}/gi, (_, k) => (vars[k] == null ? '' : String(vars[k])))
  .replace(/\*\*/g, '').replace(/\[[^\[\]\n]{1,60}\]/g, '')

// Recorta con "…" lo que no cabe en el ancho
function recortar(g, t, ancho) {
  if (g.measureText(t).width <= ancho) return t
  while (t && g.measureText(t + '…').width > ancho) t = t.slice(0, -1)
  return t + '…'
}

// Renglones de un texto largo dentro del ancho (por palabras; las muy largas se parten)
function partir(g, texto, ancho) {
  const lineas = []
  for (const parrafo of texto.split('\n')) {
    let linea = ''
    for (const palabra of parrafo.split(/\s+/).filter(Boolean)) {
      const prueba = linea ? `${linea} ${palabra}` : palabra
      if (g.measureText(prueba).width <= ancho || !linea) linea = prueba
      else { lineas.push(linea); linea = palabra }
    }
    lineas.push(linea)
  }
  return lineas
}

export async function dibujarHojaFija(b, ctx, escala = 2) {
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(ANCHO_PAGINA * escala)
  canvas.height = Math.round(ALTO_HOJA * escala)
  const g = canvas.getContext('2d')
  g.scale(escala, escala)
  g.fillStyle = '#fff'
  g.fillRect(0, 0, ANCHO_PAGINA, ALTO_HOJA)

  const caja = cajaHojaFija(b.proporcion)
  g.drawImage(await cargar(b.url), caja.left, caja.top, caja.ancho, caja.alto)

  const vars = ctx.variables || {}
  g.fillStyle = '#0a0a0a'
  g.textBaseline = 'alphabetic'
  for (const c of b.campos || []) {
    const x = caja.left + (Number(c.x) || 0) / 100 * caja.ancho
    const y = caja.top + (Number(c.y) || 0) / 100 * caja.alto
    const w = (Number(c.w) || 0) / 100 * caja.ancho
    const h = (Number(c.h) || 0) / 100 * caja.alto
    const tam = letraHojaFija(c, caja)

    if (c.tipo === 'firma') {
      const src = ctx.firmas?.[c.rol]
      if (!src) continue
      const img = await cargar(src)
      // Contenida en el recuadro, abajo y al centro (como .hf-firma)
      const k = Math.min(w / img.width, h / img.height)
      g.drawImage(img, x + (w - img.width * k) / 2, y + h - img.height * k, img.width * k, img.height * k)
      continue
    }

    if (c.tipo === 'tabla') {
      const filas = filasHojaFija(c, ctx).slice(0, c.filas || 1)
      const alto = h / (c.filas || 1)
      g.font = `${tam}px ${FUENTE}`
      g.textAlign = 'left'
      let cx = x
      for (const col of c.columnas || []) {
        const cw = (Number(col.w) || 0) / 100 * w
        filas.forEach((get, ri) => {
          const t = recortar(g, String(get(col.clave) ?? ''), cw - 4)
          // La base un poco arriba del borde de abajo del renglón
          if (t) g.fillText(t, cx + 2, y + (ri + 1) * alto - Math.max(1, tam * 0.2))
        })
        cx += cw
      }
      continue
    }

    // Texto
    const texto = textoPlano(c.valor, vars).trim()
    if (!texto) continue
    g.font = `${c.negrita ? 'bold ' : ''}${tam}px ${FUENTE}`
    const alineacion = c.alineacion === 'centro' ? 'center' : c.alineacion === 'derecha' ? 'right' : 'left'
    g.textAlign = alineacion
    const tx = alineacion === 'center' ? x + w / 2 : alineacion === 'right' ? x + w - 2 : x + 2
    if (esRenglonHojaFija(c, caja, tam)) {
      // Un renglón: la base de la letra justo en el borde de abajo del recuadro
      g.fillText(texto.replace(/\s*\n\s*/g, ' '), tx, y + h)
    } else {
      // Varios renglones desde arriba (line-height 1.15, como en pantalla)
      g.save()
      g.beginPath(); g.rect(x, y, w, h); g.clip()
      partir(g, texto, w - 4).forEach((l, i) => g.fillText(l, tx, y + tam * 0.92 + i * tam * 1.15))
      g.restore()
    }
  }
  return canvas
}
