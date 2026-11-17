// Descarga una plantilla como Word (.docx), escrita como la lee importarWord.js:
// los datos van entre corchetes ([Nombre del paciente]), las tablas de equipos
// llevan [Equipos] / [Insumos] y las firmas [Firma de quien recibe]. Así el Word
// sirve de ejemplo y, editado, se puede volver a importar como plantilla nueva.
// No copia la hoja al milímetro: lleva la estructura (encabezado, títulos, textos,
// recuadros, tablas, firmas, imágenes y saltos de página).

import JSZip from 'jszip'
import { aTexto, mapearTextos, propiosDe, NOMBRE_FIRMA, FIRMAS, normalizar } from './nombres'
import { COLUMNAS_ESTANDAR, columnasEstandar } from './render'

const OCULTOS = new Set(['campos_propios', 'para_equipos', 'renovable', 'firma_libre'])
const ANCHO = 10206                 // ancho útil de la hoja A4 en twips (márgenes de 1,5 cm)
const EMU_PX = 9525
const ANCHO_EMU = Math.round(ANCHO / 1440 * 96 * EMU_PX)
const ETIQUETAS = { ...COLUMNAS_ESTANDAR, item: 'ÍTEM', serie: 'SERIE', lote: 'LOTE', invima: 'REG. INVIMA' }
const MARCADOR_TABLA = { insumos: '[Insumos]', ambos: '[Equipos e insumos]' }

const esc = s => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
const JC = { centro: 'center', derecha: 'right', justificado: 'both', izquierda: 'left' }

// ── Piezas de WordprocessingML ──
// Texto con **negrita** → runs
function runs(texto, { negrita = false, tam = null } = {}) {
  const rPr = b => (b || tam) ? `<w:rPr>${b ? '<w:b/>' : ''}${tam ? `<w:sz w:val="${tam}"/>` : ''}</w:rPr>` : ''
  return String(texto ?? '').split(/(\*\*.+?\*\*)/g).filter(Boolean).map(t => {
    const b = negrita || /^\*\*.+\*\*$/.test(t)
    return `<w:r>${rPr(b)}<w:t xml:space="preserve">${esc(b && !negrita ? t.slice(2, -2) : t).replace(/\t/g, '</w:t><w:tab/><w:t xml:space="preserve">')}</w:t></w:r>`
  }).join('')
}
const parrafo = (contenido = '', { alineacion, salto = false, espacioDespues, espacioAntes, tabs } = {}) => {
  const pPr = [tabs?.length ? `<w:tabs>${tabs.map(t => `<w:tab w:val="left" w:pos="${t}"/>`).join('')}</w:tabs>` : '', alineacion && alineacion !== 'izquierda' ? `<w:jc w:val="${JC[alineacion] || 'left'}"/>` : '',
    espacioDespues != null || espacioAntes != null ? `<w:spacing${espacioAntes != null ? ` w:before="${espacioAntes}"` : ''}${espacioDespues != null ? ` w:after="${espacioDespues}"` : ''}/>` : ''].join('')
  return `<w:p>${pPr ? `<w:pPr>${pPr}</w:pPr>` : ''}${salto ? '<w:r><w:br w:type="page"/></w:r>' : ''}${contenido}</w:p>`
}
// Un párrafo por línea (Word no tiene saltos dentro del mismo párrafo que importarWord lea igual)
const lineas = (texto, op = {}, run = {}) => String(texto ?? '').split('\n').map(l => parrafo(runs(l, run), op)).join('')

const BORDES = v => `<w:tblBorders>${['top', 'left', 'bottom', 'right', 'insideH', 'insideV'].map(l => `<w:${l} w:val="${v ? 'single' : 'nil'}" w:sz="6" w:space="0" w:color="222222"/>`).join('')}</w:tblBorders>`
// filas: [[{ contenido, span, ancho? }]]; anchos: twips por columna
function tabla(filas, anchos, { bordes = true } = {}) {
  const celda = c => `<w:tc><w:tcPr><w:tcW w:w="${anchos.slice(c.col, c.col + (c.span || 1)).reduce((s, x) => s + x, 0)}" w:type="dxa"/>${(c.span || 1) > 1 ? `<w:gridSpan w:val="${c.span}"/>` : ''}${c.vmerge ? `<w:vMerge${c.vmerge === 'inicio' ? ' w:val="restart"' : ''}/>` : ''}${c.fondo ? `<w:shd w:val="clear" w:color="auto" w:fill="${c.fondo}"/>` : ''}<w:vAlign w:val="center"/></w:tcPr>${c.contenido || parrafo()}</w:tc>`
  const conCol = f => { let col = 0; return f.map(c => { const x = { ...c, col: c.col ?? col }; col = x.col + (c.span || 1); return x }) }
  return `<w:tbl><w:tblPr><w:tblW w:w="${ANCHO}" w:type="dxa"/><w:tblLayout w:type="fixed"/>${BORDES(bordes)}<w:tblCellMar><w:left w:w="80" w:type="dxa"/><w:right w:w="80" w:type="dxa"/></w:tblCellMar></w:tblPr>`
    + `<w:tblGrid>${anchos.map(a => `<w:gridCol w:w="${a}"/>`).join('')}</w:tblGrid>`
    + filas.map(f => `<w:tr>${conCol(f).map(celda).join('')}</w:tr>`).join('') + '</w:tbl>'
}
const iguales = n => Array.from({ length: n }, (_, i) => Math.floor(ANCHO / n) + (i < ANCHO % n ? 1 : 0))

// Anchos de columna: los que la plantilla dice en % y el resto repartido
function anchosDe(cols) {
  const fijos = cols.reduce((s, c) => s + (c.ancho || 0), 0)
  const libres = cols.filter(c => !c.ancho).length
  const resto = libres ? Math.max(0, 100 - fijos) / libres : 0
  const pct = cols.map(c => c.ancho || resto)
  const total = pct.reduce((s, x) => s + x, 0) || 1
  return pct.map(p => Math.round(ANCHO * p / total))
}

// ── Imágenes (logos, sellos): se descargan y se meten en el .docx ──
async function medir(blob) {
  try { const b = await createImageBitmap(blob); const r = { w: b.width, h: b.height }; b.close?.(); return r } catch { return null }
}
const EXT = { 'image/png': 'png', 'image/jpeg': 'jpeg', 'image/gif': 'gif', 'image/svg+xml': 'svg', 'image/webp': 'webp' }

function crearParte(zip) {
  const rels = []
  let n = 0
  return {
    rels,
    // Devuelve el run con la imagen, o '' si no se pudo traer
    async imagen(url, altoPx, maxAnchoEmu = ANCHO_EMU) {
      if (!url) return ''
      try {
        const res = await fetch(url)
        if (!res.ok) return ''
        const blob = await res.blob()
        const ext = EXT[blob.type] || (url.match(/\.(png|jpe?g|gif|svg|webp)(\?|$)/i)?.[1] || 'png').toLowerCase().replace('jpg', 'jpeg')
        const dim = await medir(blob)
        let cy = Math.round((altoPx || 60) * EMU_PX)
        let cx = dim ? Math.round(cy * dim.w / dim.h) : cy
        if (cx > maxAnchoEmu) { cy = Math.round(cy * maxAnchoEmu / cx); cx = maxAnchoEmu }
        const archivo = `media/img${crearParte.contador = (crearParte.contador || 0) + 1}.${ext}`
        zip.file(`word/${archivo}`, await blob.arrayBuffer())
        const rid = `rIdImg${++n}`
        rels.push(`<Relationship Id="${rid}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="${archivo}"/>`)
        const id = crearParte.contador
        return `<w:r><w:drawing><wp:inline distT="0" distB="0" distL="0" distR="0"><wp:extent cx="${cx}" cy="${cy}"/><wp:docPr id="${id}" name="Imagen ${id}"/>`
          + `<a:graphic xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture">`
          + `<pic:pic xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture"><pic:nvPicPr><pic:cNvPr id="${id}" name="img${id}"/><pic:cNvPicPr/></pic:nvPicPr>`
          + `<pic:blipFill><a:blip r:embed="${rid}"/><a:stretch><a:fillRect/></a:stretch></pic:blipFill>`
          + `<pic:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="${cx}" cy="${cy}"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></pic:spPr></pic:pic>`
          + '</a:graphicData></a:graphic></wp:inline></w:drawing></w:r>'
      } catch { return '' }
    },
  }
}

// ── Bloques ──
// Encabezado: tabla logo · títulos · código/versión (importarWord → encabezadoDeTabla)
async function encabezado(b, parte) {
  const logos = async (lista, anchoPct) => (await Promise.all((lista || []).filter(l => l.url)
    .map(l => parte.imagen(l.url, Math.min(80, l.alto || 60), Math.round(ANCHO_EMU * anchoPct / 100) - 2 * 80 * 635)))).join('')
  const celdas = []
  const izq = await logos(b.logos, b.ancho_logo || 22)
  if (izq || b.logo_pie) celdas.push({ pct: b.ancho_logo || 22, contenido: parrafo(izq, { alineacion: 'centro' }) + (b.logo_pie ? lineas(b.logo_pie, { alineacion: 'centro' }, { tam: 14 }) : '') })
  const centro = (b.centro || []).map((c, i) => parrafo(runs([c.etiqueta, c.texto].filter(Boolean).join(' '),
    { negrita: c.estilo !== 'normal', tam: (c.estilo || (i ? 'subtitulo' : 'titulo')) === 'titulo' ? 24 : c.estilo === 'normal' ? 18 : 20 }), { alineacion: 'centro', espacioDespues: 0 })).join('')
  celdas.push({ pct: 0, contenido: centro || parrafo() })
  if (b.derecha?.length) celdas.push({ pct: 24, contenido: b.derecha.map(d => parrafo(runs(`**${d.etiqueta}** ${d.valor || ''}`, { tam: 16 }), { espacioDespues: 0 })).join('') })
  const der = await logos(b.logos_derecha, 18)
  if (der) celdas.push({ pct: 18, contenido: parrafo(der, { alineacion: 'centro' }) })
  const fijos = celdas.reduce((s, c) => s + c.pct, 0)
  const anchos = celdas.map(c => Math.round(ANCHO * (c.pct || 100 - fijos) / 100))
  const filas = [celdas.map(c => ({ contenido: c.contenido }))]
  if (b.pie?.length) filas.push([{ span: celdas.length, contenido: parrafo(runs(b.pie.map(p => `**${p.etiqueta}** ${p.valor || ''}`).join('     '), { tam: 16 })) }])
  return tabla(filas, anchos)
}

// Recuadro de datos: "Etiqueta: [Dato]" en cada celda; la firma, [Firma de quien recibe]
function campos(b) {
  const cols = Math.max(1, b.columnas || 1)
  const filas = []
  let fila = [], usadas = 0
  for (const c of b.campos || []) {
    const span = Math.min(c.span || 1, cols)
    if (usadas + span > cols) { filas.push(fila); fila = []; usadas = 0 }
    const valor = [c.firma ? `[${NOMBRE_FIRMA[c.firma] || 'Firma de quien recibe'}]` : '', c.valor || (!c.firma ? '__________' : '')].filter(Boolean).join(' ')
    fila.push({ span, contenido: parrafo(runs(c.etiqueta ? `**${c.etiqueta}** ${valor}` : valor), { espacioDespues: 0 }) })
    usadas += span
  }
  if (fila.length) { if (usadas < cols) fila.push({ span: cols - usadas }); filas.push(fila) }
  if (!filas.length) return ''
  // El título del recuadro va como texto en negrita (en mayúsculas importarWord lo volvería título)
  return (b.titulo ? parrafo(runs(`**${b.titulo}**`), { espacioDespues: 40 }) : '') + tabla(filas, iguales(cols), { bordes: b.estilo === 'tabla' || !!b.borde })
}

// Tabla de equipos o insumos: títulos de columna, [Equipos] en la primera fila y filas vacías
function tablaEquipos(b) {
  const cols = b.agrupar === 'tipo_equipo' ? columnasEstandar(b.columnas)
    : b.agrupar === 'tipo' ? ['item', 'descripcion', 'marca', 'modelo', 'serie'].map(clave => ({ clave }))
    : b.columnas?.length ? b.columnas : ['item', 'descripcion', 'marca', 'modelo', 'serie'].map(clave => ({ clave }))
  const n = cols.length
  const celda = (t, op = {}) => ({ contenido: parrafo(runs(t, { tam: 18, ...op }), { espacioDespues: 0 }), ...op.celda })
  const filas = []
  if (b.titulo) filas.push([{ span: n, contenido: parrafo(runs(b.titulo, { negrita: true }), { alineacion: 'centro', espacioDespues: 0 }) }])
  filas.push(cols.map(c => celda(c.etiqueta || ETIQUETAS[c.clave] || c.clave.replace(/^attr:/, '').replace(/_/g, ' ').toUpperCase(), { negrita: true, celda: { fondo: 'F1F5F9' } })))
  const marcador = MARCADOR_TABLA[b.fuente] || '[Equipos]'
  // Filas ya impresas (F-FAM-11): su texto en la primera columna
  const fijas = (b.filas_fijas || []).map(ff => cols.map((_, j) => celda(j === 0 ? ff.texto : '')))
  const vacias = Math.max(1, (b.filas_minimas || 1) - fijas.length)
  const cuerpo = fijas.length ? [...fijas, cols.map((_, j) => celda(j === 0 ? marcador : ''))]
    : Array.from({ length: vacias }, (_, i) => cols.map((_, j) => celda(i === 0 && j === 0 ? marcador : '')))
  return tabla([...filas, ...cuerpo], anchosDe(cols))
}

// Tabla de un Word (tabla_libre), tal cual: las celdas unidas hacia abajo van con vMerge
async function tablaLibre(b, parte) {
  const n = Math.max(b.anchos?.length || 0, ...(b.filas || []).map(f => f.reduce((s, c) => s + (c.span || 1), 0)), 1)
  const anchos = b.anchos?.length === n ? anchosDe(b.anchos.map(ancho => ({ ancho }))) : iguales(n)
  const ocupadas = []        // ocupadas[ri] = { col: celda de arriba que sigue (rowspan) }
  const filas = []
  for (const [ri, fila] of (b.filas || []).entries()) {
    const out = []
    let col = 0
    const seguir = ocupadas[ri] || {}
    const llenarHasta = hasta => { while (col < hasta || seguir[col]) { if (seguir[col]) { out.push({ col, span: seguir[col].span, vmerge: 'sigue' }); col += seguir[col].span || 1 } else break } }
    for (const c of fila) {
      llenarHasta(col)
      const imgs = (await Promise.all((c.imagenes || []).map(i => parte.imagen(i.url, i.alto || 60, Math.round(ANCHO_EMU * (anchos.slice(col, col + (c.span || 1)).reduce((s, x) => s + x, 0) / ANCHO)) - 2 * 80 * 635)))).join('')
      const tam = c.tamano ? Math.round(c.tamano / 1.28 * 2) : null
      const op = { alineacion: c.alineacion || 'izquierda', espacioDespues: 0 }
      const contenido = (imgs ? parrafo(imgs, op) : '')
        + (c.firma ? parrafo(runs(`[${NOMBRE_FIRMA[c.firma] || 'Firma de quien recibe'}]`, { tam }), op) : '')
        + (c.texto ? lineas(c.texto, op, { negrita: !!c.negrita, tam }) : '')
      out.push({ col, span: c.span, fondo: c.fondo, contenido: contenido || parrafo('', op), ...((c.rowspan || 1) > 1 ? { vmerge: 'inicio' } : {}) })
      for (let k = 1; k < (c.rowspan || 1); k++) (ocupadas[ri + k] ||= {})[col] = c
      col += c.span || 1
    }
    llenarHasta(n)
    filas.push(out)
  }
  return tabla(filas, anchos, { bordes: !b.sin_bordes })
}

// Firmas lado a lado y debajo sus renglones
function firmas(b) {
  // Lado a lado: un renglón de rayas y debajo los nombres, separados por tabulaciones
  // (importarWord → firmasDeRayas). La firma que no se reconoce por su nombre lleva la marca
  const lista = b.firmas || []
  if (!lista.length) return ''
  const nombre = f => {
    if (f.rol === 'vacia' || !NOMBRE_FIRMA[f.rol]) return f.titulo || 'Firma'
    if (f.titulo && FIRMAS[normalizar(f.titulo)] === f.rol) return f.titulo
    return `${f.titulo ? f.titulo + ' ' : ''}[${NOMBRE_FIRMA[f.rol]}]`
  }
  // Una columna por firma: una tabulación al inicio de cada una, así raya y nombre quedan alineados
  const col = Math.floor(ANCHO / lista.length)
  const tabs = lista.slice(1).map((_, i) => col * (i + 1))
  const rayas = lista.map(() => '_'.repeat(Math.max(12, Math.floor(col / 110) - 3))).join('\t')
  const lineasDe = f => (f.lineas || []).map(l => `**${l.etiqueta}** ${l.valor || '__________'}`)
  return parrafo(runs(rayas), { espacioDespues: 0, espacioAntes: 600, tabs })
    + parrafo(runs(lista.map(f => `**${nombre(f)}**`).join('\t')), { espacioDespues: 60, tabs })
    // Los renglones de cada firma (C.C., cargo…) debajo, uno por firma
    + lista.flatMap(lineasDe).map(l => parrafo(runs(l), { espacioDespues: 0 })).join('')
}

const TAM_TEXTO = { 10: 16, 11: 18 }

async function cuerpo(bloques, parte) {
  const out = []
  let salto = false
  for (const b of bloques) {
    if (b.tipo === 'salto_pagina') { salto = true; continue }
    // El salto va en un párrafo propio antes de lo que sigue (importarWord lo lee de ahí)
    if (salto) { out.push(parrafo('', { salto: true, espacioDespues: 0 })); salto = false }
    // Word junta dos tablas seguidas en una: entre ellas va un párrafo vacío
    else if (out.length && out[out.length - 1].endsWith('</w:tbl>') && ['encabezado', 'campos', 'tabla', 'tabla_libre'].includes(b.tipo) && !(b.tipo === 'campos' && b.titulo)) out.push(parrafo('', { espacioDespues: 0 }))
    switch (b.tipo) {
      case 'encabezado': out.push(await encabezado(b, parte)); break
      case 'titulo': out.push(lineas(b.texto, { alineacion: b.alineacion || 'centro' }, { negrita: true, tam: 24 })); break
      case 'texto': out.push(lineas(b.texto, { alineacion: b.alineacion || 'justificado' }, { tam: TAM_TEXTO[b.tamano] || null })); break
      case 'campos': out.push(campos(b)); break
      case 'tabla': out.push(tablaEquipos(b)); break
      case 'tabla_libre': out.push(await tablaLibre(b, parte)); break
      case 'firmas': out.push(firmas(b)); break
      case 'imagen': { const img = await parte.imagen(b.url, b.alto || 60); if (img) out.push(parrafo(img, { alineacion: b.alineacion || 'centro' })); break }
      case 'espacio': out.push(parrafo('', { espacioDespues: 0 })); break
      default: break
    }
  }
  return out.join('')
}

const NS = 'xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing"'
const RELS = items => `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${items.join('')}</Relationships>`
const ESTILOS = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
<w:docDefaults><w:rPrDefault><w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial" w:eastAsia="Arial" w:cs="Arial"/><w:sz w:val="20"/><w:szCs w:val="20"/><w:lang w:val="es-CO"/></w:rPr></w:rPrDefault>
<w:pPrDefault><w:pPr><w:spacing w:after="80" w:line="252" w:lineRule="auto"/></w:pPr></w:pPrDefault></w:docDefaults>
<w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/></w:style></w:styles>`

// Devuelve un Blob .docx
export async function exportarWord(plantilla) {
  crearParte.contador = 0
  const zip = new JSZip()
  // {{variables}} → [Nombres]
  const propios = propiosDe(plantilla.bloques)
  let bloques = mapearTextos((plantilla.bloques || []).filter(b => !OCULTOS.has(b.tipo)), t => aTexto(t, propios))

  // Si todas las páginas llevan el mismo encabezado, va en el encabezado de Word
  // (importarWord lo repite en cada página); si cambia, se queda en el cuerpo
  // (el primer bloque y sus copias después de cada salto de página: encabezado o tabla del Word)
  const primero = bloques[0]
  const tras = bloques.filter((b, i) => i > 0 && bloques[i - 1].tipo === 'salto_pagina')
  const encs = primero && ['encabezado', 'tabla_libre'].includes(primero.tipo) ? [primero, ...tras.filter(b => b.tipo === primero.tipo)] : []
  const igual = b => JSON.stringify(b) === JSON.stringify(primero)
  const enEncabezado = encs.length > 0 && tras.every(igual) && (primero.tipo === 'encabezado' ? bloques.filter(b => b.tipo === 'encabezado').every(igual) : tras.length > 0)
  // El pie (texto chico centrado) va en el pie de página
  const pies = [...new Set(bloques.filter(b => b.tipo === 'pie').map(b => b.texto).filter(Boolean))]
  bloques = bloques.filter((b, i) => b.tipo !== 'pie' && !(enEncabezado && igual(b) && (i === 0 || bloques[i - 1].tipo === 'salto_pagina')))

  const doc = crearParte(zip)
  const relsDoc = ['<Relationship Id="rIdEstilos" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>']
  const sect = []
  if (enEncabezado) {
    const enc = crearParte(zip)
    const xml = primero.tipo === 'encabezado' ? await encabezado(primero, enc) : await tablaLibre(primero, enc)
    zip.file('word/header1.xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:hdr ${NS}>${xml}${parrafo('', { espacioDespues: 0 })}</w:hdr>`)
    zip.file('word/_rels/header1.xml.rels', RELS(enc.rels))
    relsDoc.push('<Relationship Id="rIdEnc" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/header" Target="header1.xml"/>')
    sect.push('<w:headerReference w:type="default" r:id="rIdEnc"/>')
  }
  if (pies.length) {
    zip.file('word/footer1.xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:ftr ${NS}>${pies.map(t => lineas(t, { alineacion: 'centro', espacioDespues: 0 }, { tam: 16 })).join('')}</w:ftr>`)
    relsDoc.push('<Relationship Id="rIdPie" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/footer" Target="footer1.xml"/>')
    sect.push('<w:footerReference w:type="default" r:id="rIdPie"/>')
  }

  const contenido = await cuerpo(bloques, doc)
  relsDoc.push(...doc.rels)
  zip.file('word/document.xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document ${NS}><w:body>${contenido}${parrafo('', { espacioDespues: 0 })}`
    + `<w:sectPr>${sect.join('')}<w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="850" w:right="850" w:bottom="850" w:left="850" w:header="425" w:footer="425" w:gutter="0"/></w:sectPr></w:body></w:document>`)
  zip.file('word/_rels/document.xml.rels', RELS(relsDoc))
  zip.file('word/styles.xml', ESTILOS)
  zip.file('_rels/.rels', RELS(['<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>']))
  zip.file('[Content_Types].xml', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">'
    + '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/>'
    + '<Default Extension="png" ContentType="image/png"/><Default Extension="jpeg" ContentType="image/jpeg"/><Default Extension="gif" ContentType="image/gif"/>'
    + '<Default Extension="svg" ContentType="image/svg+xml"/><Default Extension="webp" ContentType="image/webp"/>'
    + '<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>'
    + '<Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/>'
    + (enEncabezado ? '<Override PartName="/word/header1.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.header+xml"/>' : '')
    + (pies.length ? '<Override PartName="/word/footer1.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.footer+xml"/>' : '')
    + '</Types>')
  return zip.generateAsync({ type: 'blob', mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' })
}

// Descarga el Word en el navegador
export async function descargarWord(plantilla) {
  const blob = await exportarWord(plantilla)
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = `${(plantilla.nombre || 'plantilla').replace(/[\\/:*?"<>|]+/g, '-').trim()}.docx`
  document.body.appendChild(a); a.click(); a.remove()
  setTimeout(() => URL.revokeObjectURL(a.href), 1000)
}
