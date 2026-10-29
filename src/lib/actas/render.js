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
//                filas_minimas, ocultar_vacia, filas_fijas [{texto, coincide?, juntar?, resto?}]
//                (filas preimpresas: cada una toma la primera fila cuya descripción,
//                categoría, modelo o marca coincide con la expresión `coincide`, o todas
//                con `juntar`; la de `resto` junta las que sobran)
//   firmas       firmas [{rol 'recibe' | 'entrega' | 'vacia', titulo, lineas [{etiqueta, valor}]}]
//   imagen       url, alto (px), alineacion (logos o sellos sueltos, p. ej. de un Word importado)
//   espacio      alto (px)
//   pie          texto (centrado, pequeño)
//   salto_pagina
//   campos_propios  etiquetas { variable: 'Nombre visible' } — no se dibuja (lib/actas/nombres.js)
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
    const html = v == null || v === ''
      ? `<span class="raya">${'&nbsp;'.repeat(raya)}</span>`
      : marcar ? `<span class="valor">${esc(v)}</span>` : esc(v)
    // Modo llenar (ctx.marcar): cada dato lleva su clave para resaltarlo y tocarlo
    if (!vars.__marcar) return html
    const clave = (typeof vars.__marcar === 'object' && vars.__marcar[k]) || `v:${k}`
    return `<span class="cmp${v == null || v === '' ? ' vacio' : ''}" data-campo="${clave}">${html}</span>`
  })
}
// Un renglón "FIRMA:" se firma a mano: no se marca para llenar
const esFirma = c => /^\s*firma/i.test(c.etiqueta || '')
const attrCampo = (ctx, clave, lleno) => ctx.marcar ? ` data-campo="${clave}" class="cmp${lleno ? '' : ' vacio'}"` : ''

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
const sinTexto = html => !html.replace(/<span class="raya">.*?<\/span>/g, '').replace(/<[^>]+>/g, '').replace(/&nbsp;|\s/g, '')

const imgFirma = (rol, ctx) => ctx.firmas?.[rol] ? `<img class="firma-linea" src="${esc(ctx.firmas[rol])}">` : ''

// Renglón en blanco que la persona llenó (ctx.manuales; claves de campos.js → lineasEnBlanco)
const manual = (ctx, clave) => {
  const v = ctx.manuales?.[clave]
  return v != null && String(v).trim() ? esc(String(v).trim()) : ''
}

// Celdas de un recuadro (campos en tabla): etiqueta en negrita y el valor o lo
// escrito a mano. clave(ci) = clave del renglón en blanco (datos_acta.manuales)
function celdasGrilla(lista, cols, ctx, clave) {
  const vars = ctx.variables || {}
  const celdas = []
  let fila = [], usadas = 0
  for (const [ci, c] of (lista || []).entries()) {
    const span = Math.min(c.span || 1, cols)
    if (usadas + span > cols) { celdas.push(fila); fila = []; usadas = 0 }
    const escrito = !c.valor && !c.firma ? manual(ctx, clave(ci)) : ''
    const valor = (c.firma ? imgFirma(c.firma, ctx) : '') + (escrito || (c.valor || !c.firma ? interpolar(c.valor || '', vars, { raya: 10 }) : ''))
    const marca = !c.valor && !c.firma && !esFirma(c) ? attrCampo(ctx, `m:${clave(ci)}`, !!escrito) : ''
    fila.push(`<td colspan="${span}"${marca}><span class="et">${esc(c.etiqueta)}</span> ${valor}</td>`)
    usadas += span
  }
  if (fila.length) celdas.push(fila)
  return `<table class="grilla">${celdas.map(f => `<tr>${f.join('')}</tr>`).join('')}</table>`
}

function campos(b, ctx, bi) {
  const vars = ctx.variables || {}
  const cols = b.columnas || 1
  const titulo = b.titulo ? `<div class="sub">${esc(b.titulo)}</div>` : ''
  if (b.estilo === 'tabla') return titulo + celdasGrilla(b.campos, cols, ctx, ci => `${bi}.${ci}`)
  // 'lineas': etiqueta y el valor sobre una raya, como los formularios impresos
  const items = (b.campos || []).map((c, ci) => {
    const texto = c.valor ? interpolar(c.valor, vars, { raya: 3 }) : (!c.firma ? manual(ctx, `${bi}.${ci}`) : '')
    // Firma y nombre juntos (F-FAM-11): la firma va encima del nombre, no al lado
    const conTexto = !sinTexto(texto)
    const firma = c.firma ? (conTexto ? `<span class="firma-sobre">${imgFirma(c.firma, ctx)}</span>` : imgFirma(c.firma, ctx)) : ''
    const valor = firma + (conTexto ? texto : '')
    const vacio = !valor
    const marca = !c.valor && !c.firma && !esFirma(c) ? attrCampo(ctx, `m:${bi}.${ci}`, !vacio) : ''
    if (c.arriba) return `<div class="linea-arriba" style="grid-column:span ${Math.min(c.span || 1, cols)}">
      <div class="et">${esc(c.etiqueta)}</div><div class="llenar"${marca}>${vacio ? '&nbsp;' : valor}</div></div>`
    return `<div class="linea" style="grid-column:span ${Math.min(c.span || 1, cols)}">
      <span class="et">${esc(c.etiqueta)}</span><span class="llenar"${marca}>${vacio ? '&nbsp;' : valor}</span></div>`
  }).join('')
  return titulo + `<div class="lineas" style="grid-template-columns:repeat(${cols},1fr)">${items}</div>`
}

const COLUMNAS_TABLA = {
  item: 'ÍTEM', descripcion: 'DESCRIPCIÓN', marca: 'MARCA', modelo: 'MODELO', serie: 'SERIE',
  codigo: 'CÓDIGO', estado: 'ESTADO', cantidad: 'CANT.', lote: 'LOTE', invima: 'REG. INVIMA',
}

// Equipos agrupados por tipo: una tabla por categoría (cilindros, reguladores,
// concentradores…) con solo las columnas que esos equipos traen. Los equipos van
// primero y los cilindros y reguladores al final. fuente 'retirados': los que
// salen en un cambio de equipo (ctx.retirados); si no, los del préstamo.
const ES_ACCESORIO = /cilindro|regulador/i
function tablasPorTipo(b, ctx, bi) {
  const grupos = []
  for (const f of (b.fuente === 'retirados' ? ctx.retirados : ctx.equipos) || []) {
    const nombre = f.categoria || f.descripcion || 'Equipos'
    const g = grupos.find(x => x.nombre === nombre)
    if (g) g.filas.push(f)
    else grupos.push({ nombre, filas: [f] })
  }
  grupos.sort((x, y) => ES_ACCESORIO.test(x.nombre) - ES_ACCESORIO.test(y.nombre))
  const tablas = grupos.map(g => {
    const cilindros = /cilindro/i.test(g.nombre)
    const hay = clave => g.filas.some(f => String(f[clave] ?? '').trim())
    // La descripción solo si cambia dentro del grupo (si no, ya la dice el título)
    const distintas = new Set(g.filas.map(f => f.descripcion)).size > 1
    const cols = [
      { clave: 'item', etiqueta: 'ÍTEM', ancho: 7 },
      distintas && { clave: 'descripcion', etiqueta: 'DESCRIPCIÓN' },
      hay('marca') && { clave: 'marca', etiqueta: 'MARCA' },
      hay('modelo') && { clave: 'modelo', etiqueta: cilindros ? 'TAMAÑO' : 'MODELO' },
      { clave: 'serie', etiqueta: 'SERIAL' },
      hay('codigo') && { clave: 'codigo', etiqueta: 'CÓDIGO', ancho: 14 },
    ].filter(Boolean)
    const cuerpo = g.filas.map((f, i) => `<tr>${cols.map(c => `<td>${esc(c.clave === 'item' ? i + 1 : f[c.clave] ?? '')}&nbsp;</td>`).join('')}</tr>`).join('')
    return `<div class="grupo-eq"><div class="grupo-titulo">${esc(g.nombre.toUpperCase())}</div><table class="tabla"><thead><tr>${cols.map(c =>
      `<th${c.ancho ? ` style="width:${c.ancho}%"` : ''}>${c.etiqueta}</th>`).join('')}</tr></thead><tbody>${cuerpo}</tbody></table></div>`
  })
  if (!tablas.length) tablas.push(`<table class="tabla"><tbody><tr><td>&nbsp;</td></tr></tbody></table>`)
  // Accesorios que se marcan con X (HUMIDIFICADOR, CANULA…): una fila aparte
  const accesorios = b.accesorios?.length
    ? celdasGrilla(b.accesorios, b.accesorios.length, ctx, ci => `${bi}.a${ci}`).replace('class="grilla"', 'class="grilla grilla-acc"')
    : ''
  return (b.titulo ? `<div class="sub">${esc(b.titulo)}</div>` : '') + tablas.join('') + accesorios
}

function tabla(b, ctx, bi) {
  if (b.agrupar === 'tipo') return tablasPorTipo(b, ctx, bi)
  const filas = (b.fuente === 'insumos' ? ctx.insumos
    : b.fuente === 'ambos' ? [...(ctx.equipos || []), ...(ctx.insumos || []).map(i => ({ ...i, estado: i.estado || 'Nuevo' }))]
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

// Tabla con las filas ya impresas en el formato (F-FAM-11: "1. EQUIPO CPAP", "3. OTROS:").
// El tamaño del cilindro solo está en el modelo ("Cilindro 6.5 M3"): por eso se mira también
function tablaFija(b, filas) {
  const libres = [...filas]
  const texto = f => `${f.descripcion} ${f.categoria || ''} ${f.modelo || ''} ${f.marca || ''}`
  const tomar = (re, todas) => {
    const r = new RegExp(re, 'i')
    const tomadas = []
    for (let i = 0; i < libres.length; i++) {
      if (!r.test(texto(libres[i]))) continue
      tomadas.push(libres.splice(i--, 1)[0])
      if (!todas) break
    }
    return tomadas
  }
  const cols = b.columnas
  // Varias unidades en una fila (dos cilindros): la cantidad se suma y lo demás va separado por comas
  const juntar = (lista, conModelo) => lista.length ? {
    descripcion: lista.map(x => conModelo ? [x.descripcion, x.modelo].filter(Boolean).join(' ') : x.descripcion).join(', '),
    ...Object.fromEntries(cols.slice(1).map(c => {
      const valores = lista.map(x => x[c.clave]).filter(v => v !== '' && v != null)
      // Cantidades en número se suman; si alguna es texto ("1 caja") se listan
      const suma = c.clave === 'cantidad' && valores.every(v => Number.isFinite(Number(v)))
      return [c.clave, suma ? valores.reduce((s, v) => s + Number(v), 0) || '' : valores.join(', ')]
    })),
  } : null
  const asignadas = b.filas_fijas.map(ff => ({ ff, f: ff.coincide ? juntar(tomar(ff.coincide, ff.juntar)) : null }))
  const celdas = (ff, f) => cols.map((c, j) => {
    if (j === 0) return `<td>${esc(ff.texto)}${f && ff.resto ? ' ' + esc(f.descripcion) : ''}</td>`
    return `<td>${esc(f?.[c.clave] ?? '')}&nbsp;</td>`
  }).join('')
  // La fila de "OTROS" junta lo que no encajó en las anteriores (con el modelo, que en
  // los cilindros es el tamaño)
  const cuerpo = asignadas.map(({ ff, f }) => `<tr>${celdas(ff, ff.resto ? juntar(libres, true) : f)}</tr>`).join('')
  const titulo = b.titulo ? `<div class="sub">${esc(b.titulo)}</div>` : ''
  return titulo + `<table class="tabla"><thead><tr>${cols.map(c =>
    `<th${c.ancho ? ` style="width:${c.ancho}%"` : ''}>${esc(c.etiqueta || COLUMNAS_TABLA[c.clave] || c.clave)}</th>`).join('')}</tr></thead>
    <tbody>${cuerpo}</tbody></table>`
}

function firmas(b, ctx, bi) {
  const lista = b.firmas || []
  return `<div class="firmas" style="grid-template-columns:repeat(${Math.max(lista.length, 1)},1fr)">${lista.map((f, fi) => {
    const img = f.rol !== 'vacia' && ctx.firmas?.[f.rol]
    const lineas = (f.lineas || []).map((l, li) => {
      const escrito = !l.valor && manual(ctx, `${bi}.f${fi}.${li}`)
      const contenido = escrito || interpolar(l.valor || '', ctx.variables, { raya: 18 })
      return `<div><b>${esc(l.etiqueta)}</b> ${!l.valor && ctx.marcar ? `<span${attrCampo(ctx, `m:${bi}.f${fi}.${li}`, !!escrito)}>${contenido}</span>` : contenido}</div>`
    }).join('')
    return `<div class="firma">
      <div class="firma-img">${img ? `<img src="${esc(img)}">` : ''}</div>
      <div class="firma-raya"></div>
      ${f.titulo ? `<div class="firma-titulo">${interpolar(f.titulo, ctx.variables)}</div>` : ''}${lineas}
    </div>`
  }).join('')}</div>`
}

function bloque(b, ctx, bi) {
  const vars = ctx.variables || {}
  switch (b.tipo) {
    case 'encabezado': return encabezado(b, vars)
    case 'titulo':
      return `<div class="titulo" style="text-align:${alinear(b.alineacion || 'centro')}">${formato(interpolar(b.texto, vars))}</div>`
    case 'texto':
      return caja(b, `<div class="texto" style="text-align:${alinear(b.alineacion || 'justificado')};font-size:${b.tamano || 12}px">${formato(interpolar(b.texto, vars, { marcar: true }))}</div>`)
    case 'campos': return caja(b, campos(b, ctx, bi))
    case 'tabla': {
      const html = tabla(b, ctx, bi)
      if (!ctx.marcar || !html) return caja(b, html)
      // Claves separadas por espacio: una tabla de equipos e insumos con Estado lleva las dos
      const claves = [(b.columnas || []).some(c => c.clave === 'estado') && b.fuente !== 'insumos' && 'estados', (b.fuente === 'insumos' || b.fuente === 'ambos') && 'insumos'].filter(Boolean)
      return caja(b, claves.length ? `<div data-campo="${claves.join(' ')}" class="cmp-tabla">${html}</div>` : html)
    }
    case 'firmas': return caja(b, firmas(b, ctx, bi))
    case 'imagen': return b.url
      ? `<div style="text-align:${alinear(b.alineacion || 'centro')}"><img src="${esc(b.url)}" style="max-height:${b.alto || 60}px;max-width:100%"></div>`
      : ''
    case 'espacio': return `<div style="height:${b.alto || 16}px"></div>`
    case 'pie': return `<div class="pie">${formato(interpolar(b.texto, vars))}</div>`
    default: return ''
  }
}

const CSS = `
*{box-sizing:border-box;margin:0;padding:0}
html{-webkit-text-size-adjust:100%;text-size-adjust:100%}
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
.texto{line-height:1.45;overflow-wrap:anywhere}
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
.grupo-eq{margin-bottom:6px}
.grupo-titulo{font-size:10.5px;font-weight:bold;margin:0 0 2px 1px}
.grilla-acc{margin-top:2px}
.grilla-acc td{width:25%}
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
.cmp{background:rgba(46,181,212,.12);border-radius:2px;cursor:pointer;transition:background .15s,outline-color .15s}
.cmp:hover{background:rgba(46,181,212,.28)}
.cmp.vacio{background:rgba(245,158,11,.18)}
.cmp.vacio:hover{background:rgba(245,158,11,.32)}
.cmp-tabla{cursor:pointer;border-radius:3px;outline:2px dashed transparent;outline-offset:2px}
.cmp-tabla:hover{outline-color:rgba(46,181,212,.6)}
.activo{background:#FDE68A!important;outline:2px solid #F59E0B!important;outline-offset:1px}
`

// Divide los bloques en páginas (por salto_pagina) y devuelve un documento HTML por página
export function renderPaginas(bloques, ctx) {
  // marcar: true, o un mapa variable → clave (campos.js → CLAVES_HOJA)
  if (ctx?.marcar) ctx = { ...ctx, variables: { ...ctx.variables, __marcar: ctx.marcar } }
  // Cada bloque guarda su posición en la plantilla: es la clave de sus renglones en blanco
  const paginas = [[]]
  ;(bloques || []).forEach((b, bi) => {
    if (b.tipo === 'salto_pagina') paginas.push([])
    else if (b.tipo !== 'campos_propios') paginas[paginas.length - 1].push({ b, bi })
  })
  return paginas
    .filter(p => p.length)
    .map(p => `<!DOCTYPE html><html><head><meta charset="utf-8"><style>${CSS}</style></head><body>${
      p.map(({ b, bi }) => `<div class="bloque">${bloque(b, ctx, bi)}</div>`).join('')
    }</body></html>`)
}
