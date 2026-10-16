// Motor de actas: convierte los bloques de una plantilla (plantillas_acta.bloques)
// más el contexto de una entrega en HTML, una cadena por página. Es puro (sin
// React ni Supabase) para usarlo igual en la vista previa del editor, en el paso
// de firma y al generar el PDF (lib/actas/pdf.js).
//
// Bloques (todos aceptan `borde: true` para encerrarlos en un recuadro):
//   encabezado   logos, logo_pie (texto bajo el logo), centro [{texto, estilo, etiqueta?}],
//                derecha [{etiqueta, valor}], logos_derecha, pie [{etiqueta, valor}]
//   titulo       texto, alineacion
//   texto        texto con {{variables}}, **negrita**, saltos de línea; alineacion, tamano
//   campos       titulo?, columnas, estilo 'lineas' | 'tabla', campos [{etiqueta, valor, span, firma}]
//                (firma 'recibe' | 'entrega' pone la imagen de esa firma sobre la raya,
//                junto al valor si también lo hay; arriba: true pone la etiqueta en su
//                propio renglón, para las largas)
//   tabla        fuente 'equipos' | 'insumos' | 'ambos', titulo?, columnas [{clave, etiqueta, ancho}],
//                filas_minimas, ocultar_vacia, filas_fijas [{texto, coincide?, resto?}]
//                (filas preimpresas: cada una toma la primera fila cuya descripción
//                coincide con la expresión `coincide`; la de `resto` junta las que sobran)
//   firmas       firmas [{rol 'recibe' | 'entrega' | 'vacia', titulo, lineas [{etiqueta, valor}]}]
//   espacio      alto (px)
//   pie          texto (centrado, pequeño)
//   salto_pagina
//
// Valores: texto libre con {{variable}}. Una variable vacía se dibuja como raya
// para llenar a mano, igual que en los formatos impresos.

export const ANCHO_PAGINA = 760 // px de render; html2canvas lo escala a A4

const esc = s => String(s ?? '')
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

// Reemplaza {{var}}. `marcar` envuelve el valor subrayado (texto corrido de contratos).
function interpolar(texto, vars, { marcar = false, raya = 14 } = {}) {
  return esc(texto).replace(/\{\{\s*([a-z0-9_]+)\s*\}\}/gi, (_, k) => {
    const v = vars[k]
    if (v == null || v === '') return `<span class="raya">${'&nbsp;'.repeat(raya)}</span>`
    return marcar ? `<span class="valor">${esc(v)}</span>` : esc(v)
  })
}

// **negrita** y saltos de línea, después de interpolar (el texto ya viene escapado)
const formato = html => html
  .replace(/\*\*(.+?)\*\*/g, '<b>$1</b>')
  .replace(/\n/g, '<br>')

const alinear = a => a === 'centro' ? 'center' : a === 'derecha' ? 'right' : a === 'justificado' ? 'justify' : 'left'

const caja = (b, html) => b.borde ? `<div class="caja">${html}</div>` : html

function encabezado(b, vars) {
  // Solo logos con imagen: si la plantilla aún no tiene el logo, no se deja un
  // recuadro vacío; la celda desaparece y el título ocupa ese espacio
  const conImagen = lista => (lista || []).filter(l => l.url)
  const logos = (lista, extra = '') => conImagen(lista).map(l =>
    `<img src="${esc(l.url)}" style="max-height:${l.alto || 60}px;max-width:100%">`).join(extra)
  const lineaCentro = c => `<div class="enc-${c.estilo || 'normal'}">${formato(interpolar(c.texto, vars))}</div>`
  // Con etiquetas (PERIODO / PROCESO) el centro es una tabla de dos columnas
  const centro = (b.centro || []).some(c => c.etiqueta)
    ? `<table class="enc-filas">${b.centro.map(c => `<tr><td class="enc-et">${esc(c.etiqueta || '')}</td><td>${lineaCentro(c)}</td></tr>`).join('')}</table>`
    : (b.centro || []).map(lineaCentro).join('')
  const filas = lista => (lista || []).map(c =>
    `<tr><td class="enc-et">${esc(c.etiqueta)}</td><td class="enc-va">${interpolar(c.valor || '', vars)}</td></tr>`).join('')
  const derecha = b.derecha?.length ? `<td class="enc-der"><table>${filas(b.derecha)}</table></td>` : ''
  const logosDer = conImagen(b.logos_derecha).length ? `<td class="enc-logo">${logos(b.logos_derecha, '<br>')}</td>` : ''
  const logoIzq = conImagen(b.logos).length || b.logo_pie
    ? `<td class="enc-logo" style="width:${b.ancho_logo || 22}%">${logos(b.logos)}${b.logo_pie ? `<div class="enc-logo-pie">${formato(esc(b.logo_pie))}</div>` : ''}</td>`
    : ''
  const pie = b.pie?.length
    ? `<tr><td colspan="4" class="enc-pie">${b.pie.map(c => `<span><b>${esc(c.etiqueta)}</b> ${interpolar(c.valor || '', vars)}</span>`).join('')}</td></tr>`
    : ''
  return `<table class="enc"><tr>
    ${logoIzq}
    <td class="enc-centro"${(b.centro || []).some(c => c.etiqueta) ? ' style="padding:0"' : ''}>${centro}</td>${derecha}${logosDer}
  </tr>${pie}</table>`
}

// ¿El valor quedó sin nada escrito? (solo rayas para llenar a mano)
const sinTexto = html => !html.replace(/<span class="raya">.*?<\/span>/g, '').replace(/&nbsp;|\s/g, '')

const imgFirma = (rol, ctx) => ctx.firmas?.[rol] ? `<img class="firma-linea" src="${esc(ctx.firmas[rol])}">` : ''

function campos(b, ctx) {
  const vars = ctx.variables || {}
  const cols = b.columnas || 1
  const titulo = b.titulo ? `<div class="sub">${esc(b.titulo)}</div>` : ''
  if (b.estilo === 'tabla') {
    const celdas = []
    let fila = [], usadas = 0
    for (const c of b.campos || []) {
      const span = Math.min(c.span || 1, cols)
      if (usadas + span > cols) { celdas.push(fila); fila = []; usadas = 0 }
      const valor = (c.firma ? imgFirma(c.firma, ctx) : '') + (c.valor || !c.firma ? interpolar(c.valor || '', vars, { raya: 10 }) : '')
      fila.push(`<td colspan="${span}"><span class="et">${esc(c.etiqueta)}</span> ${valor}</td>`)
      usadas += span
    }
    if (fila.length) celdas.push(fila)
    return titulo + `<table class="grilla">${celdas.map(f => `<tr>${f.join('')}</tr>`).join('')}</table>`
  }
  // 'lineas': etiqueta y el valor sobre una raya, como los formularios impresos
  const items = (b.campos || []).map(c => {
    const texto = c.valor ? interpolar(c.valor, vars, { raya: 3 }) : ''
    // Firma y nombre juntos (F-FAM-11): la firma va encima del nombre, no al lado
    const conTexto = !sinTexto(texto)
    const firma = c.firma ? (conTexto ? `<span class="firma-sobre">${imgFirma(c.firma, ctx)}</span>` : imgFirma(c.firma, ctx)) : ''
    const valor = firma + (conTexto ? texto : '')
    const vacio = !valor
    if (c.arriba) return `<div class="linea-arriba" style="grid-column:span ${Math.min(c.span || 1, cols)}">
      <div class="et">${esc(c.etiqueta)}</div><div class="llenar">${vacio ? '&nbsp;' : valor}</div></div>`
    return `<div class="linea" style="grid-column:span ${Math.min(c.span || 1, cols)}">
      <span class="et">${esc(c.etiqueta)}</span><span class="llenar">${vacio ? '&nbsp;' : valor}</span></div>`
  }).join('')
  return titulo + `<div class="lineas" style="grid-template-columns:repeat(${cols},1fr)">${items}</div>`
}

const COLUMNAS_TABLA = {
  item: 'ÍTEM', descripcion: 'DESCRIPCIÓN', marca: 'MARCA', modelo: 'MODELO', serie: 'SERIE',
  codigo: 'CÓDIGO', estado: 'ESTADO', cantidad: 'CANT.', lote: 'LOTE', invima: 'REG. INVIMA',
}

function tabla(b, ctx) {
  const filas = (b.fuente === 'insumos' ? ctx.insumos
    : b.fuente === 'ambos' ? [...(ctx.equipos || []), ...(ctx.insumos || []).map(i => ({ ...i, estado: 'Nuevo' }))]
    : ctx.equipos) || []
  if (!filas.length && b.ocultar_vacia) return ''
  if (b.filas_fijas?.length) return tablaFija(b, filas)
  const cols = b.columnas?.length ? b.columnas : ['item', 'descripcion', 'marca', 'modelo', 'serie'].map(clave => ({ clave }))
  const total = Math.max(filas.length, b.filas_minimas || 0)
  const cuerpo = Array.from({ length: total }, (_, i) => {
    const f = filas[i]
    return `<tr>${cols.map(c => {
      const v = !f ? '' : c.clave === 'item' ? i + 1 : f[c.clave]
      return `<td>${esc(v ?? '')}&nbsp;</td>`
    }).join('')}</tr>`
  }).join('')
  const titulo = b.titulo ? `<div class="sub">${esc(b.titulo)}</div>` : ''
  return titulo + `<table class="tabla"><thead><tr>${cols.map(c =>
    `<th${c.ancho ? ` style="width:${c.ancho}%"` : ''}>${esc(c.etiqueta || COLUMNAS_TABLA[c.clave] || c.clave)}</th>`).join('')}</tr></thead>
    <tbody>${cuerpo}</tbody></table>`
}

// Tabla con las filas ya impresas en el formato (F-FAM-11: "1. EQUIPO CPAP", "3. OTROS:")
function tablaFija(b, filas) {
  const libres = [...filas]
  const tomar = re => {
    const i = libres.findIndex(f => new RegExp(re, 'i').test(`${f.descripcion} ${f.categoria || ''}`))
    return i < 0 ? null : libres.splice(i, 1)[0]
  }
  const asignadas = b.filas_fijas.map(ff => ({ ff, f: ff.coincide ? tomar(ff.coincide) : null }))
  const cols = b.columnas
  const celdas = (ff, f) => cols.map((c, j) => {
    if (j === 0) return `<td>${esc(ff.texto)}${f && ff.resto ? ' ' + esc(f.descripcion) : ''}</td>`
    return `<td>${esc(f?.[c.clave] ?? '')}&nbsp;</td>`
  }).join('')
  const cuerpo = asignadas.map(({ ff, f }) => {
    if (!ff.resto) return `<tr>${celdas(ff, f)}</tr>`
    // La fila de "OTROS" junta lo que no encajó en las anteriores
    const juntas = libres.length ? {
      descripcion: libres.map(x => x.descripcion).join(', '),
      ...Object.fromEntries(cols.slice(1).map(c => [c.clave, libres.map(x => x[c.clave]).filter(v => v !== '' && v != null).join(', ')])),
    } : null
    return `<tr>${celdas(ff, juntas)}</tr>`
  }).join('')
  const titulo = b.titulo ? `<div class="sub">${esc(b.titulo)}</div>` : ''
  return titulo + `<table class="tabla"><thead><tr>${cols.map(c =>
    `<th${c.ancho ? ` style="width:${c.ancho}%"` : ''}>${esc(c.etiqueta || COLUMNAS_TABLA[c.clave] || c.clave)}</th>`).join('')}</tr></thead>
    <tbody>${cuerpo}</tbody></table>`
}

function firmas(b, ctx) {
  const lista = b.firmas || []
  return `<div class="firmas" style="grid-template-columns:repeat(${Math.max(lista.length, 1)},1fr)">${lista.map(f => {
    const img = f.rol !== 'vacia' && ctx.firmas?.[f.rol]
    const lineas = (f.lineas || []).map(l =>
      `<div><b>${esc(l.etiqueta)}</b> ${interpolar(l.valor || '', ctx.variables, { raya: 18 })}</div>`).join('')
    return `<div class="firma">
      <div class="firma-img">${img ? `<img src="${esc(img)}">` : ''}</div>
      <div class="firma-raya"></div>
      ${f.titulo ? `<div class="firma-titulo">${interpolar(f.titulo, ctx.variables)}</div>` : ''}${lineas}
    </div>`
  }).join('')}</div>`
}

function bloque(b, ctx) {
  const vars = ctx.variables || {}
  switch (b.tipo) {
    case 'encabezado': return encabezado(b, vars)
    case 'titulo':
      return `<div class="titulo" style="text-align:${alinear(b.alineacion || 'centro')}">${formato(interpolar(b.texto, vars))}</div>`
    case 'texto':
      return caja(b, `<div class="texto" style="text-align:${alinear(b.alineacion || 'justificado')};font-size:${b.tamano || 12}px">${formato(interpolar(b.texto, vars, { marcar: true }))}</div>`)
    case 'campos': return caja(b, campos(b, ctx))
    case 'tabla': return caja(b, tabla(b, ctx))
    case 'firmas': return caja(b, firmas(b, ctx))
    case 'espacio': return `<div style="height:${b.alto || 16}px"></div>`
    case 'pie': return `<div class="pie">${formato(interpolar(b.texto, vars))}</div>`
    default: return ''
  }
}

const CSS = `
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:Arial,Helvetica,sans-serif;font-size:12px;color:#111;background:#fff;width:${ANCHO_PAGINA}px;padding:28px 34px}
.bloque{margin-bottom:10px}
.caja{border:1.2px solid #222;padding:8px 10px}
.enc{width:100%;border-collapse:collapse;border:1.2px solid #222}
.enc td{border:1px solid #222;padding:4px 6px;vertical-align:middle}
.enc-logo{text-align:center}
.enc-centro{text-align:center}
.enc-titulo{font-size:14px;font-weight:bold;margin:2px 0}
.enc-subtitulo{font-size:12px;font-weight:bold;margin:2px 0}
.enc-normal{font-size:11px;margin:1px 0}
.enc-der{padding:0!important;width:24%}
.enc-der table{width:100%;border-collapse:collapse}
.enc-der td{border:0;border-bottom:1px solid #222;font-size:10px;padding:4px 6px}
.enc-der tr:last-child td{border-bottom:0}
.enc-et{font-weight:bold;white-space:nowrap}
.enc-pie{font-size:10px}
.enc-logo-pie{font-size:7.5px;line-height:1.2;margin-top:2px}
.enc-filas{width:100%;height:100%;border-collapse:collapse}
.enc-filas td{border:0;border-bottom:1px solid #222;padding:6px}
.enc-filas tr:last-child td{border-bottom:0}
.enc-filas .enc-et{border-right:1px solid #222;font-size:10px;width:22%;vertical-align:bottom}
.enc-pie span{margin-right:28px}
.titulo{font-size:13px;font-weight:bold;margin:6px 0}
.texto{line-height:1.45}
.valor{text-decoration:underline;font-weight:bold}
.raya{display:inline-block;border-bottom:1px solid #111;min-width:60px}
.sub{font-weight:bold;text-align:center;font-size:11.5px;margin-bottom:5px}
.lineas{display:grid;column-gap:18px;row-gap:7px}
.linea{display:flex;align-items:last baseline;gap:6px;font-size:11.5px}
.linea .et{white-space:nowrap}
.linea .llenar{flex:1;border-bottom:1px solid #111;padding:0 4px 1px;line-height:1.3;font-weight:bold}
.linea .raya{border:0;min-width:0}
.linea-arriba{font-size:11.5px}
.linea-arriba .llenar{border-bottom:1px solid #111;min-height:17px;padding-left:4px;font-weight:bold}
.firma-linea{max-height:42px;max-width:200px;display:inline-block;vertical-align:bottom;margin-right:6px}
.firma-sobre{display:block}
.grilla{width:100%;border-collapse:collapse}
.grilla td{border:1px solid #222;padding:4px 6px;font-size:11px;vertical-align:top}
.grilla .et{font-weight:bold}
.tabla{width:100%;border-collapse:collapse}
.tabla th{border:1px solid #222;background:#f0f0f0;font-size:10.5px;padding:4px}
.tabla td{border:1px solid #222;font-size:11px;padding:4px;height:20px}
.firmas{display:grid;column-gap:30px;margin-top:10px}
.firma{font-size:11px}
.firma-img{height:62px;display:flex;align-items:flex-end}
.firma-img img{max-height:60px;max-width:220px}
.firma-raya{border-top:1px solid #111;margin-bottom:3px}
.firma-titulo{font-weight:bold}
.pie{text-align:center;font-size:10px;color:#333;margin-top:14px}
`

// Divide los bloques en páginas (por salto_pagina) y devuelve un documento HTML por página
export function renderPaginas(bloques, ctx) {
  const paginas = [[]]
  for (const b of bloques || []) {
    if (b.tipo === 'salto_pagina') paginas.push([])
    else paginas[paginas.length - 1].push(b)
  }
  return paginas
    .filter(p => p.length)
    .map(p => `<!DOCTYPE html><html><head><meta charset="utf-8"><style>${CSS}</style></head><body>${
      p.map(b => `<div class="bloque">${bloque(b, ctx)}</div>`).join('')
    }</body></html>`)
}
