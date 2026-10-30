// Convierte un .docx en bloques de plantilla (render.js), como borrador para el
// editor. No busca copiar el Word al milímetro: toma la estructura (títulos,
// textos, tablas, imágenes, saltos de página) y los datos escritos entre
// corchetes, que pasan a {{variables}} (nombres.js):
//   [Nombre del paciente]          dato que se llena solo
//   [Número de contrato]           dato que no existe: campo propio de la plantilla
//   [Equipos] / [Insumos]          en una tabla: la tabla lista los del préstamo
//   [Firma de quien recibe]        firma (también quien entrega y responsable)
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

// ── Párrafos ──
// Un párrafo: segmentos de texto con negrita, imágenes y saltos de página
function leerParrafo(p) {
  const segs = [], imagenes = []
  let salto = !!buscar(hijo(p, 'w:pPr'), 'w:pageBreakBefore').length
  const jc = hijo(hijo(p, 'w:pPr'), 'w:jc')?.a['w:val']
  const recorrer = nodo => {
    for (const x of hijos(nodo)) {
      if (x.n === 'w:r') {
        const rPr = hijo(x, 'w:rPr')
        const b = hijo(rPr, 'w:b')
        const negrita = !!b && b.a['w:val'] !== '0' && b.a['w:val'] !== 'false'
        const tam = Number(hijo(rPr, 'w:sz')?.a['w:val']) || null
        for (const y of hijos(x)) {
          if (y.n === 'w:t') segs.push({ t: y.h.filter(z => typeof z === 'string').join(''), negrita, tam })
          else if (y.n === 'w:tab') segs.push({ t: '\t', negrita })
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
    segs, texto, imagenes, salto,
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

// Celda → campo: "Etiqueta: [Dato]" pone el dato; "[Firma de quien recibe]" la firma
function campoDeCelda(c) {
  const texto = c.texto.replace(/\*\*/g, '').replace(/\t+/g, ' ')
  const m = marcador(texto)
  const campo = { etiqueta: '' }
  let resto = texto
  if (m?.firma) { campo.firma = m.firma; resto = resto.replace(m.texto, ' ') }
  const i = resto.indexOf('[')
  if (i >= 0) { campo.etiqueta = resto.slice(0, i).trim(); campo.valor = resto.slice(i).trim() }
  else campo.etiqueta = resto.replace(/_{3,}/g, '').trim()
  if (c.span > 1) campo.span = c.span
  if (campo.etiqueta.length > 60) campo.arriba = true
  return campo
}

// Primera tabla con logo arriba: encabezado del formato (logo · título · código/versión)
function encabezadoDeTabla(t) {
  const logos = [], centro = [], derecha = []
  for (const c of t.filas.flat().filter(c => !c.continua)) {
    c.imagenes.forEach(i => logos.push({ imagen: i.id, alto: Math.min(80, i.alto) }))
    for (const linea of c.texto.replace(/\*\*/g, '').split('\n').map(x => x.trim()).filter(Boolean)) {
      const kv = linea.match(/^([^:]{1,22}):\s*(.*)$/)
      if (kv && linea.length < 50) derecha.push({ etiqueta: `${kv[1].trim()}:`, valor: kv[2].trim() })
      else centro.push({ texto: linea, estilo: centro.length ? 'subtitulo' : 'titulo' })
    }
  }
  return { tipo: 'encabezado', logos, ancho_logo: 22, centro, ...(derecha.length ? { derecha } : {}) }
}

// ── Documento ──
function convertir(cuerpo, { primeraTablaEsEncabezado = true } = {}) {
  const bloques = []
  let hayContenido = false
  const ultimo = () => bloques[bloques.length - 1]
  for (const x of hijos(cuerpo)) {
    if (x.n === 'w:p') {
      const p = leerParrafo(x)
      if (p.salto && hayContenido) bloques.push({ tipo: 'salto_pagina' })
      p.imagenes.forEach(i => bloques.push({ tipo: 'imagen', imagen: i.id, alto: Math.min(120, i.alto), alineacion: p.alineacion === 'izquierda' ? 'izquierda' : p.alineacion === 'derecha' ? 'derecha' : 'centro' }))
      const texto = conFormato(p)
      if (!texto) {
        if (hayContenido && ultimo()?.tipo !== 'espacio' && ultimo()?.tipo !== 'salto_pagina' && !p.imagenes.length) bloques.push({ tipo: 'espacio', alto: 10 })
        continue
      }
      hayContenido = true
      const m = marcador(texto)
      if (m?.firma) {
        const titulo = texto.replace(m.texto, '').replace(/\*\*/g, '').replace(/[:_]+/g, ' ').trim() || NOMBRE_FIRMA[m.firma]
        const f = { rol: m.firma, titulo }
        if (ultimo()?.tipo === 'firmas' && ultimo().firmas.length < 3) ultimo().firmas.push(f)
        else bloques.push({ tipo: 'firmas', firmas: [f] })
        continue
      }
      if (m?.tabla) { bloques.push(m.tabla === 'equipos' ? estandar(null, [], 1) : { tipo: 'tabla', fuente: m.tabla, filas_minimas: 3 }); continue }
      const corto = texto.replace(/\*\*/g, '').length < 110
      const mayus = /[A-ZÁÉÍÓÚÑ]/.test(texto) && texto === texto.toUpperCase()
      if (corto && ((p.negrita && (p.alineacion === 'centro' || mayus)) || (p.alineacion === 'centro' && mayus))) {
        bloques.push({ tipo: 'titulo', texto: texto.replace(/\*\*/g, ''), alineacion: p.alineacion === 'izquierda' ? 'izquierda' : 'centro' })
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
      else if (primeraTablaEsEncabezado && !hayContenido && t.filas[0]?.some(c => c.imagenes.length)) bloques.push(encabezadoDeTabla(t))
      else {
        // Imágenes sueltas dentro de la tabla (sello, logo de otra entidad)
        t.filas.flat().forEach(c => c.imagenes.forEach(i => bloques.push({ tipo: 'imagen', imagen: i.id, alto: Math.min(100, i.alto) })))
        const campos = t.filas.flatMap(f => f.filter(c => !c.continua).map(campoDeCelda))
        if (campos.some(c => c.etiqueta || c.valor || c.firma)) bloques.push({ tipo: 'campos', estilo: 'tabla', columnas: t.columnas, campos })
      }
      hayContenido = true
    } else if (x.n === 'w:sdt') {
      bloques.push(...convertir(hijo(x, 'w:sdtContent') || { h: [] }, { primeraTablaEsEncabezado: false }))
    }
  }
  while (['espacio', 'salto_pagina'].includes(ultimo()?.tipo)) bloques.pop()
  return bloques
}

// Encabezado de página de Word (header1.xml): logos + líneas de texto
function convertirEncabezado(raiz) {
  const tabla = buscar(raiz, 'w:tbl')[0]
  if (tabla) return encabezadoDeTabla(leerTabla(tabla))
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

  // Relaciones: rId → archivo (imágenes) para el documento y para cada encabezado/pie
  async function relaciones(parte) {
    const xml = await leer(`word/_rels/${parte}.rels`)
    if (!xml) return {}
    return Object.fromEntries(buscar(parsearXML(xml), 'Relationship').map(r => [r.a.Id, r.a.Target]))
  }
  const imagenes = {}
  async function resolver(bloques, rels, prefijo) {
    for (const b of bloques) {
      for (const obj of [b, ...(b.logos || [])]) {
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
