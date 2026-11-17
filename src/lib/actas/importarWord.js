// Convierte un .docx en bloques de plantilla (render.js), como borrador para el
// editor. La regla es simple, para que cada cliente arme su formato a su manera:
// lo que está en el Word se copia igual (textos con su negrita y alineación,
// tablas con sus columnas, celdas unidas y logos, rayas para llenar a mano,
// saltos de página) y solo lo escrito entre corchetes tiene significado:
//   [Nombre del paciente]          dato que se llena solo
//   [Número de contrato]           dato que no existe: campo propio de la plantilla
//   [Equipos] / [Insumos]          en una tabla: la tabla lista los del préstamo
//                                  (también una tabla con títulos ÍTEM, DESCRIPCIÓN,
//                                  CANTIDAD… y las demás filas vacías)
//   [Firma de quien recibe]        firma (también quien entrega y responsable)
// Las demás tablas quedan como tabla_libre (render.js), igual que en el Word.
// Dos renglones "_____   _____" / "Firma de quien devuelve   Firma de quien recibe"
// se vuelven firmas lado a lado.
// Devuelve { bloques, imagenes: { id: { datos, tipo, ext } }, avisos }; las
// imágenes quedan como { imagen: id } hasta subirlas (lib/actas/imagenesPlantilla.js).

import JSZip from 'jszip'
import { aVariables, normalizar, TABLAS, FIRMAS, NOMBRE_FIRMA } from './nombres'
import { COLUMNAS_ESTANDAR, columnasEstandar } from './render'

// ── XML mínimo: árbol { n: nombre, a: atributos, h: hijos } y textos como string ──
const ENT = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" }
const desescapar = s => s.replace(/&(#x?[0-9a-f]+|amp|lt|gt|quot|apos);/gi, (_, e) =>
  e[0] === '#' ? String.fromCodePoint(e[1] === 'x' || e[1] === 'X' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10)) : ENT[e])

function parsearXML(xml) {
  const raiz = { n: '#raiz', a: {}, h: [] }
  const pila = [raiz]
  const re = /<\?[\s\S]*?\?>|<!--[\s\S]*?-->|<!\[CDATA\[([\s\S]*?)\]\]>|<(\/?)([\w:.-]+)((?:\s+[\w:.-]+\s*=\s*(?:"[^"]*"|'[^']*'))*)\s*(\/?)>|([^<]+)/g
  let m
  while ((m = re.exec(xml))) {
    const tope = pila[pila.length - 1]
    if (m[1] != null) tope.h.push(m[1])
    else if (m[6] != null) { if (pila.length > 1) tope.h.push(desescapar(m[6])) }
    else if (m[3]) {
      if (m[2]) { pila.pop(); continue }
      const a = {}
      for (const x of (m[4] || '').matchAll(/([\w:.-]+)\s*=\s*(?:"([^"]*)"|'([^']*)')/g)) a[x[1]] = desescapar(x[2] ?? x[3])
      const nodo = { n: m[3], a, h: [] }
      tope.h.push(nodo)
      if (!m[5]) pila.push(nodo)
    }
  }
  return raiz
}

const hijos = (nodo, nombre) => (nodo?.h || []).filter(x => typeof x === 'object' && (!nombre || x.n === nombre))
const hijo = (nodo, nombre) => hijos(nodo, nombre)[0]
function buscar(nodo, nombre, salida = []) {
  for (const x of nodo?.h || []) if (typeof x === 'object') { if (x.n === nombre) salida.push(x); buscar(x, nombre, salida) }
  return salida
}

// ── Estilos del Word (styles.xml): negrita, tamaño, subrayado, alineación y sangría
// que un párrafo hereda de su estilo (Título 1, Texto independiente…) ──
let ESTILOS = { def: {}, por: {} }
function leerEstilos(xml) {
  if (!xml) return { def: {}, por: {} }
  const raiz = parsearXML(xml)
  const props = (pPr, rPr) => {
    const o = {}
    const b = hijo(rPr, 'w:b'); if (b) o.b = b.a['w:val'] !== '0' && b.a['w:val'] !== 'false'
    const sz = Number(hijo(rPr, 'w:sz')?.a['w:val']); if (sz) o.sz = sz
    const u = hijo(rPr, 'w:u'); if (u) o.u = u.a['w:val'] !== 'none'
    const jc = hijo(pPr, 'w:jc')?.a['w:val']; if (jc) o.jc = jc
    const ind = hijo(pPr, 'w:ind'); if (ind?.a['w:left'] != null) o.ind = Number(ind.a['w:left']) || 0
    return o
  }
  const dd = buscar(raiz, 'w:docDefaults')[0]
  const def = props(buscar(dd, 'w:pPr')[0], buscar(dd, 'w:rPr')[0])
  const por = {}
  for (const st of buscar(raiz, 'w:style')) {
    por[st.a['w:styleId']] = { base: hijo(st, 'w:basedOn')?.a['w:val'], ...props(hijo(st, 'w:pPr'), hijo(st, 'w:rPr')) }
  }
  return { def, por }
}
// Propiedades de un estilo con las de los estilos en que se basa
function estilo(id, n = 0) {
  const e = id && ESTILOS.por[id]
  if (!e || n > 8) return { ...ESTILOS.def }
  const { base, ...propio } = e
  return { ...estilo(base, n + 1), ...propio }
}

// ── Párrafos ──
// Un párrafo: segmentos de texto con negrita, imágenes y saltos de página
function leerParrafo(p) {
  const segs = [], imagenes = []
  const pPr = hijo(p, 'w:pPr')
  let salto = !!buscar(pPr, 'w:pageBreakBefore').length
  const est = estilo(hijo(pPr, 'w:pStyle')?.a['w:val'])
  const jc = hijo(pPr, 'w:jc')?.a['w:val'] || est.jc
  const indNodo = hijo(pPr, 'w:ind')
  const sangria = indNodo?.a['w:left'] != null ? Number(indNodo.a['w:left']) || 0 : est.ind || 0
  const recorrer = nodo => {
    for (const x of hijos(nodo)) {
      if (x.n === 'w:r') {
        const rPr = hijo(x, 'w:rPr')
        const re = { ...est, ...(hijo(rPr, 'w:rStyle') ? estilo(hijo(rPr, 'w:rStyle').a['w:val']) : {}) }
        const b = hijo(rPr, 'w:b')
        const negrita = b ? b.a['w:val'] !== '0' && b.a['w:val'] !== 'false' : !!re.b
        const tam = Number(hijo(rPr, 'w:sz')?.a['w:val']) || re.sz || null
        const u = hijo(rPr, 'w:u')
        const subrayado = u ? u.a['w:val'] !== 'none' : !!re.u
        for (const y of hijos(x)) {
          if (y.n === 'w:t') {
            const t = y.h.filter(z => typeof z === 'string').join('')
            // Espacios subrayados: una raya para llenar a mano
            segs.push({ t: subrayado && t && !t.trim() ? '_'.repeat(Math.max(8, t.length)) : t, negrita, tam })
          }
          // Una tabulación subrayada (NOMBRE: ________) también es raya
          else if (y.n === 'w:tab') segs.push(subrayado ? { t: '_'.repeat(30), negrita, tam } : { t: '\t', negrita })
          else if (y.n === 'w:br') { if (y.a['w:type'] === 'page') salto = true; else segs.push({ t: '\n', negrita }) }
          else if (y.n === 'w:drawing' || y.n === 'w:pict' || y.n === 'mc:AlternateContent') {
            const blip = buscar(y, 'a:blip')[0] || buscar(y, 'v:imagedata')[0]
            const id = blip?.a['r:embed'] || blip?.a['r:id']
            const ext = buscar(y, 'wp:extent')[0]
            if (id && !imagenes.some(i => i.id === id)) imagenes.push({ id, alto: ext ? Math.round(Number(ext.a.cy) / 9525) : 60 })
          }
        }
      } else if (['w:hyperlink', 'w:smartTag', 'w:ins', 'w:sdt', 'w:sdtContent', 'w:fldSimple'].includes(x.n)) recorrer(x)
    }
  }
  recorrer(p)
  const texto = segs.map(s => s.t).join('')
  const conTexto = segs.filter(s => s.t.trim())
  return {
    segs, texto, imagenes, salto, sangria,
    alineacion: jc === 'center' ? 'centro' : jc === 'right' || jc === 'end' ? 'derecha' : jc === 'both' || jc === 'distribute' ? 'justificado' : 'izquierda',
    negrita: conTexto.length > 0 && conTexto.every(s => s.negrita),
    tam: conTexto.find(s => s.tam)?.tam || null,
  }
}

// Texto con **negrita** de los segmentos (sin partir los [corchetes])
const TABS = /[ \t]*\t[ \t]*/g
function conFormato(par) {
  if (par.negrita) return par.texto.replace(TABS, '   ').trim()
  let out = '', abierta = false
  for (const s of par.segs) {
    if (s.negrita !== abierta && s.t.trim()) { out += '**'; abierta = s.negrita }
    out += s.t
  }
  if (abierta) out += '**'
  // Las tabulaciones de Word hacen de espacio para llenar a mano
  return out.replace(/\*\*(\s*)\*\*/g, '$1').replace(/\[([^\]]*)\]/g, m => m.replace(/\*\*/g, ''))
    .replace(TABS, '   ').trim()
}

const marcador = t => {
  const m = String(t).match(/\[([^\[\]\n]{1,60})\]/g) || []
  for (const x of m) {
    const n = normalizar(x.slice(1, -1))
    if (TABLAS[n]) return { tabla: TABLAS[n], texto: x }
    if (FIRMAS[n]) return { firma: FIRMAS[n], texto: x }
  }
  return null
}

// "FIRMA DE RECIBIDO: ______": si la etiqueta dice de quién es la firma, la raya
// se vuelve la firma en la línea ([Firma de quien recibe], render.js → firmaEnLinea)
function firmasEnRayas(texto) {
  return texto.replace(/(^|\n|\*\*)([^\n\[\]*]{0,10}?firma[^\n:_\[\]*]{0,40})(:?\**:?\s*)(_{3,})/gi, (todo, ini, etiqueta, medio) => {
    const rol = FIRMAS[normalizar(etiqueta)]
    return rol ? `${ini}${etiqueta}${medio}[${NOMBRE_FIRMA[rol]}]` : todo
  })
}

// ── Tablas ──
function leerTabla(tbl) {
  const filas = []
  const columnasGrid = hijos(hijo(tbl, 'w:tblGrid'), 'w:gridCol').length
  for (const tr of hijos(tbl, 'w:tr')) {
    const celdas = []
    for (const tc of hijos(tr, 'w:tc')) {
      const tcPr = hijo(tc, 'w:tcPr')
      const vMerge = hijo(tcPr, 'w:vMerge')
      const span = Number(hijo(tcPr, 'w:gridSpan')?.a['w:val']) || 1
      const pars = hijos(tc, 'w:p').map(leerParrafo)
      celdas.push({
        span, continua: !!vMerge && vMerge.a['w:val'] !== 'restart',
        texto: pars.map(conFormato).filter(Boolean).join('\n'),
        imagenes: pars.flatMap(p => p.imagenes),
        negrita: pars.some(p => p.negrita),
      })
    }
    filas.push(celdas)
  }
  const columnas = Math.max(1, ...filas.map(f => f.reduce((s, c) => s + c.span, 0)), columnasGrid ? 0 : 1)
  return { filas, columnas }
}

const CLAVES = [[/item|ítem|^n[°ºo.]?$/i, 'item'], [/descrip|equipo|insumo|elemento/i, 'descripcion'], [/cant/i, 'cantidad'],
  [/marca/i, 'marca'], [/modelo/i, 'modelo'], [/seri/i, 'serie'], [/c[oó]digo/i, 'codigo'], [/estado/i, 'estado'],
  [/lote/i, 'lote'], [/invima|registro/i, 'invima']]
const claveColumna = t => CLAVES.find(([re]) => re.test(t))?.[1]

const estandar = (titulo, columnas, filasMinimas) => ({
  tipo: 'tabla', fuente: 'equipos', agrupar: 'tipo_equipo', ...(titulo ? { titulo } : {}),
  columnas: columnasEstandar(columnas.length ? columnas : null), filas_minimas: filasMinimas,
})

// Tabla con [Equipos] / [Insumos]: la fila de títulos da las columnas
function tablaDeDatos(t, fuente) {
  const filas = t.filas.filter(f => f.some(c => c.texto.trim()))
  let titulo = null
  if (filas[0]?.length === 1 && !marcador(filas[0][0].texto)) titulo = filas.shift()[0].texto.replace(/\*\*/g, '')
  const cab = filas.findIndex(f => f.filter(c => claveColumna(c.texto)).length >= 2)
  const encabezado = cab >= 0 ? filas[cab] : null
  const usadas = new Set()
  const columnas = (encabezado || []).map(c => {
    let clave = claveColumna(c.texto) || 'descripcion'
    if (usadas.has(clave)) clave = ['marca', 'modelo', 'serie', 'codigo', 'estado'].find(k => !usadas.has(k)) || clave
    usadas.add(clave)
    return { clave, etiqueta: c.texto.replace(/\*\*/g, '').trim() }
  })
  const resto = cab >= 0 ? filas.length - cab - 1 : 0
  // Equipos: la tabla estándar (una fila por tipo, con cantidad; render.js → tablaEstandar)
  if (fuente === 'equipos') return estandar(titulo, columnas.filter(c => COLUMNAS_ESTANDAR[c.clave]), Math.max(1, resto))
  return {
    tipo: 'tabla', fuente, ...(titulo ? { titulo } : {}),
    columnas: columnas.length ? columnas : [{ clave: 'item' }, { clave: 'descripcion' }, { clave: 'marca' }, { clave: 'modelo' }, { clave: 'serie' }],
    filas_minimas: Math.max(3, resto),
  }
}

// ── Tabla tal cual (tabla_libre): anchos de columna, celdas unidas, negrita, fondo y logos ──
const SIN_BORDE = new Set(['nil', 'none'])
const conBorde = nodo => hijos(nodo).some(x => x.a['w:val'] && !SIN_BORDE.has(x.a['w:val']))
function tablaLibre(tbl) {
  const tblPr = hijo(tbl, 'w:tblPr')
  const grid = hijos(hijo(tbl, 'w:tblGrid'), 'w:gridCol').map(g => Number(g.a['w:w']) || 0)
  const filas = []
  const inicio = []          // inicio[ri][col] = celda que empieza en esa columna (para unir hacia abajo)
  let conBordes = false
  for (const tr of hijos(tbl, 'w:tr')) {
    const fila = [], porCol = {}
    let col = Number(hijo(hijo(tr, 'w:trPr'), 'w:gridBefore')?.a['w:val']) || 0
    for (const tc of hijos(tr, 'w:tc')) {
      const tcPr = hijo(tc, 'w:tcPr')
      const span = Number(hijo(tcPr, 'w:gridSpan')?.a['w:val']) || 1
      const vMerge = hijo(tcPr, 'w:vMerge')
      if (conBorde(hijo(tcPr, 'w:tcBorders'))) conBordes = true
      // Continúa la celda de arriba: se alarga esa
      if (vMerge && vMerge.a['w:val'] !== 'restart') {
        for (let r = filas.length - 1; r >= 0; r--) { const c = inicio[r]?.[col]; if (c) { c.rowspan = (c.rowspan || 1) + 1; break } }
        col += span; continue
      }
      const pars = buscar(tc, 'w:p').map(leerParrafo)
      const conTexto = pars.filter(x => x.texto.trim())
      const negrita = conTexto.length > 0 && conTexto.every(x => x.negrita)
      const lineas = pars.map(x => (x.negrita && !negrita && conFormato(x) ? `**${conFormato(x)}**` : conFormato(x)))
      // Sin los renglones vacíos de arriba y abajo (en Word suelen ser solo para centrar)
      while (lineas.length && !lineas[0]) lineas.shift()
      while (lineas.length && !lineas[lineas.length - 1]) lineas.pop()
      // La firma ([Firma de quien recibe]) se queda en el texto: se dibuja ahí mismo
      const texto = firmasEnRayas(lineas.filter((l, i) => l || lineas[i - 1]).join('\n'))
      const celda = { texto }
      if (span > 1) celda.span = span
      if (negrita) celda.negrita = true
      const al = conTexto[0]?.alineacion
      if (al && al !== 'izquierda') celda.alineacion = al
      const tam = conTexto[0]?.tam
      if (tam) celda.tamano = Math.round(tam / 2 * 1.28)
      const fondo = hijo(tcPr, 'w:shd')?.a['w:fill']
      if (fondo && !/^(auto|ffffff)$/i.test(fondo)) celda.fondo = fondo
      const imgs = pars.flatMap(x => x.imagenes)
      if (imgs.length) celda.imagenes = imgs.map(i => ({ imagen: i.id, alto: Math.min(90, i.alto) }))
      fila.push(celda); porCol[col] = celda
      col += span
    }
    filas.push(fila); inicio.push(porCol)
  }
  const bordes = hijo(tblPr, 'w:tblBorders')
  if (conBorde(bordes)) conBordes = true
  if (!bordes && /grid|cuadr/i.test(hijo(tblPr, 'w:tblStyle')?.a['w:val'] || '')) conBordes = true
  const total = grid.reduce((a, x) => a + x, 0)
  return {
    tipo: 'tabla_libre',
    ...(total ? { anchos: grid.map(w => Math.round(w / total * 1000) / 10) } : {}),
    filas, ...(conBordes ? {} : { sin_bordes: true }),
  }
}

// Dos renglones: rayas separadas por espacios y debajo los nombres ("Firma de quien
// devuelve      Firma de quien recibe") → firmas lado a lado
const partes = t => t.replace(/\*\*/g, '').split(/\t+| {3,}/).map(x => x.trim()).filter(Boolean)
function firmasDeRayas(rayas, nombres) {
  const r = partes(rayas), n = partes(nombres)
  if (!r.length || !r.every(x => /^_{3,}$/.test(x)) || r.length !== n.length) return null
  if (r.length === 1 && !/^firma/i.test(n[0])) return null
  return {
    tipo: 'firmas', firmas: n.map(t => {
      // "Quien recibe [Firma de quien recibe]": la marca dice de quién es
      const m = marcador(t)
      if (m?.firma) return { rol: m.firma, titulo: t.replace(m.texto, '').trim() || NOMBRE_FIRMA[m.firma] }
      return { rol: FIRMAS[normalizar(t)] || 'vacia', titulo: t }
    }),
  }
}



// ── Documento ──
function convertir(cuerpo) {
  const bloques = []
  let hayContenido = false
  const ultimo = () => bloques[bloques.length - 1]
  let saltar = null
  const lista = hijos(cuerpo)
  for (const [xi, x] of lista.entries()) {
    if (x === saltar) continue
    if (x.n === 'w:p') {
      const p = leerParrafo(x)
      if (p.salto && hayContenido) bloques.push({ tipo: 'salto_pagina' })
      p.imagenes.forEach(i => bloques.push({ tipo: 'imagen', imagen: i.id, alto: Math.min(120, i.alto), alineacion: p.alineacion === 'izquierda' ? 'izquierda' : p.alineacion === 'derecha' ? 'derecha' : 'centro' }))
      const texto = firmasEnRayas(conFormato(p))
      if (!texto) {
        if (hayContenido && ultimo()?.tipo !== 'espacio' && ultimo()?.tipo !== 'salto_pagina' && !p.imagenes.length) bloques.push({ tipo: 'espacio', alto: 4 })
        continue
      }
      hayContenido = true
      const m = marcador(texto)
      if (m?.firma && !/[a-zñáéíóú0-9]/i.test(texto.replace(m.texto, '').replace(/\*\*/g, ''))) {
        const titulo = texto.replace(m.texto, '').replace(/\*\*/g, '').replace(/[:_]+/g, ' ').trim() || NOMBRE_FIRMA[m.firma]
        const f = { rol: m.firma, titulo }
        if (ultimo()?.tipo === 'firmas' && ultimo().firmas.length < 3) ultimo().firmas.push(f)
        else bloques.push({ tipo: 'firmas', firmas: [f] })
        continue
      }
      if (m?.tabla) { bloques.push(m.tabla === 'equipos' ? estandar(null, [], 1) : { tipo: 'tabla', fuente: m.tabla, filas_minimas: 3 }); continue }
      // Renglón de rayas y debajo los nombres de las firmas
      const sig = lista[xi + 1]
      const firmasRayas = sig?.n === 'w:p' && firmasDeRayas(texto, conFormato(leerParrafo(sig)))
      if (firmasRayas) { bloques.push(firmasRayas); saltar = sig; continue }
      const corto = texto.replace(/\*\*/g, '').length < 110
      const mayus = /[A-ZÁÉÍÓÚÑ]/.test(texto) && texto === texto.toUpperCase()
      if (corto && ((p.negrita && (p.alineacion === 'centro' || mayus)) || (p.alineacion === 'centro' && mayus))) {
        // Un título "centrado" con sangría (común en un Word convertido de PDF) va al centro
        bloques.push({ tipo: 'titulo', texto: texto.replace(/\*\*/g, ''), alineacion: p.alineacion === 'izquierda' && p.sangria < 1400 ? 'izquierda' : p.alineacion === 'derecha' ? 'derecha' : 'centro' })
        continue
      }
      const tamano = p.tam && p.tam <= 18 ? (p.tam <= 16 ? 10 : 11) : undefined
      const prev = ultimo()
      if (prev?.tipo === 'texto' && prev.alineacion === p.alineacion && prev.tamano === tamano) prev.texto += '\n' + texto
      else bloques.push({ tipo: 'texto', texto, alineacion: p.alineacion, ...(tamano ? { tamano } : {}) })
    } else if (x.n === 'w:tbl') {
      const t = leerTabla(x)
      const todo = t.filas.flat().map(c => c.texto).join('\n')
      const m = marcador(todo)
      // Sin [Equipos]: una tabla con títulos de columna (cantidad, descripción, marca…)
      // y el resto de filas vacías también es la lista de equipos
      const cab = t.filas[0] || []
      const pareceLista = cab.filter(c => claveColumna(c.texto)).length >= 3 && t.filas.slice(1).every(f => f.every(c => !c.texto.trim()))
      if (m?.tabla) bloques.push(tablaDeDatos(t, m.tabla))
      else if (pareceLista) bloques.push(tablaDeDatos(t, 'ambos'))
      // Cualquier otra tabla (también el encabezado con logo, código y versión) va tal cual
      else bloques.push(tablaLibre(x))
      hayContenido = true
    } else if (x.n === 'w:sdt') {
      bloques.push(...convertir(hijo(x, 'w:sdtContent') || { h: [] }))
    }
  }
  while (['espacio', 'salto_pagina'].includes(ultimo()?.tipo)) bloques.pop()
  return bloques
}

// Encabezado de página de Word (header1.xml): logos + líneas de texto
function convertirEncabezado(raiz) {
  const tabla = buscar(raiz, 'w:tbl')[0]
  if (tabla) return tablaLibre(tabla)
  const pars = buscar(raiz, 'w:p').map(leerParrafo)
  const logos = pars.flatMap(p => p.imagenes).map(i => ({ imagen: i.id, alto: Math.min(80, i.alto) }))
  const centro = pars.map(conFormato).filter(Boolean).map((t, i) => ({ texto: t.replace(/\*\*/g, ''), estilo: i ? 'subtitulo' : 'titulo' }))
  if (!logos.length && !centro.length) return null
  return { tipo: 'encabezado', logos, ancho_logo: 22, centro }
}

export async function importarWord(archivo) {
  const zip = await JSZip.loadAsync(archivo)
  const leer = async ruta => { const f = zip.file(ruta); return f ? f.async('string') : null }
  const xmlDoc = await leer('word/document.xml')
  if (!xmlDoc) throw new Error('El archivo no es un Word (.docx) válido')
  const avisos = []
  ESTILOS = leerEstilos(await leer('word/styles.xml'))

  // Relaciones: rId → archivo (imágenes) para el documento y para cada encabezado/pie
  async function relaciones(parte) {
    const xml = await leer(`word/_rels/${parte}.rels`)
    if (!xml) return {}
    return Object.fromEntries(buscar(parsearXML(xml), 'Relationship').map(r => [r.a.Id, r.a.Target]))
  }
  const imagenes = {}
  async function resolver(bloques, rels, prefijo) {
    for (const b of bloques) {
      for (const obj of [b, ...(b.logos || []), ...(b.filas || []).flat().flatMap(c => c.imagenes || [])]) {
        if (!obj.imagen) continue
        const destino = rels[obj.imagen]
        const ruta = destino && (destino.startsWith('/') ? destino.slice(1) : `word/${destino.replace(/^\.\//, '')}`)
        const f = ruta && zip.file(ruta)
        if (!f) { delete obj.imagen; continue }
        const ext = ruta.split('.').pop().toLowerCase()
        if (!['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg'].includes(ext)) {
          avisos.push(`Se omitió una imagen en formato ${ext.toUpperCase()}: súbela en el editor.`)
          delete obj.imagen; continue
        }
        const id = `${prefijo}_${obj.imagen}`
        imagenes[id] = { datos: await f.async('uint8array'), ext, tipo: ext === 'svg' ? 'image/svg+xml' : `image/${ext === 'jpg' ? 'jpeg' : ext}` }
        obj.imagen = id
      }
    }
  }

  const doc = parsearXML(xmlDoc)
  const cuerpo = buscar(doc, 'w:body')[0]
  const relsDoc = await relaciones('document.xml')
  const bloques = convertir(cuerpo)
  await resolver(bloques, relsDoc, 'doc')

  // Encabezado y pie de página del Word (los del tipo "default")
  const sect = buscar(cuerpo, 'w:sectPr').pop()
  const ref = tipo => {
    const r = hijos(sect, tipo).find(h => (h.a['w:type'] || 'default') === 'default')
    return r && relsDoc[r.a['r:id']]
  }
  const archEnc = ref('w:headerReference')
  if (archEnc) {
    const xml = await leer(`word/${archEnc}`)
    const enc = xml && convertirEncabezado(parsearXML(xml))
    if (enc) {
      await resolver([enc], await relaciones(archEnc), 'enc')
      // Se repite en cada página, como en Word
      const conEnc = [enc]
      for (const b of bloques) { conEnc.push(b); if (b.tipo === 'salto_pagina') conEnc.push(structuredClone(enc)) }
      bloques.splice(0, bloques.length, ...conEnc)
    }
  }
  const archPie = ref('w:footerReference')
  if (archPie) {
    const xml = await leer(`word/${archPie}`)
    const texto = xml && buscar(parsearXML(xml), 'w:p').map(leerParrafo).map(p => p.texto.trim()).filter(t => t && !/^\d+$/.test(t)).join('\n')
    if (texto) bloques.push({ tipo: 'pie', texto })
  }

  // [Corchetes] → {{variables}}; los nombres desconocidos quedan como campos propios
  const propios = {}
  const conVariables = JSON.parse(JSON.stringify(bloques), (k, v) => (typeof v === 'string' && !['tipo', 'imagen', 'rol', 'fuente', 'clave', 'estilo', 'alineacion', 'firma'].includes(k) ? aVariables(v, propios) : v))
  if (Object.keys(propios).length) conVariables.push({ tipo: 'campos_propios', etiquetas: propios })
  if (!conVariables.some(b => b.tipo === 'firmas' || (b.campos || []).some(c => c.firma))) {
    avisos.push('No se encontraron firmas. Escribe [Firma de quien recibe] donde va la firma, o agrégala en el editor.')
  }
  return { bloques: conVariables, imagenes, avisos }
}
