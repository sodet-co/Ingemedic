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
//   para_equipos    categorias [{ id, nombre }] — no se dibuja: la plantilla solo toma esos
//                   equipos y solo se sugiere con ellos (contexto.js → paraPlantilla, acciones.js)
//   renovable       — no se dibuja: sus actas firmadas se pueden renovar (components/actas/RenovarActa.js)
//   firma_libre     url, x, dy, ancho (px) — firma fija encima de la hoja, anclada al bloque
//                   anterior (paginaHtml); en el editor se mueve y se agranda sobre la vista previa
//
// Valores: texto libre con {{variable}}. Una variable vacía se dibuja como raya
// para llenar a mano, igual que en los formatos impresos.

export const ANCHO_PAGINA = 760 // px de render; html2canvas lo escala a A4

const esc = s => String(s ?? '')
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

// Reemplaza {{var}}. `marcar` envuelve el valor subrayado (texto corrido de contratos).
// `ruta`: dónde está este texto en la plantilla ("3.campos.1.valor"); en el editor
// (ctx.editor) se usa para saber dónde se hizo doble clic (interpolarEditor).
function interpolar(texto, vars, { marcar = false, raya = 14, ruta = null } = {}) {
  if (vars.__editor && ruta != null) return interpolarEditor(texto, vars, ruta)
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
// Editor de plantillas: cada espacio es un cuadro de color (azul = lo llena el sistema,
// amarillo = se escribe al prestar, gris = raya en blanco para llenar en el papel) y
// cada pedazo de texto dice dónde empieza en el texto original (data-o), para que un
// doble clic sepa en qué letra cayó. Ya trae **negrita** y saltos: formato() no cambia nada.
function interpolarEditor(texto, vars, ruta) {
  const { propios = {}, nombres = {} } = vars.__editor
  const s = String(texto ?? '')
  const negritas = new Set()
  for (const m of s.matchAll(/\*\*(.+?)\*\*/g)) { negritas.add(m.index); negritas.add(m.index + m[0].length - 2) }
  const pedazo = (o, t) => t ? `<span data-o="${o}">${esc(t)}</span>` : ''
  let html = '', ultimo = 0, abierta = false
  for (const m of s.matchAll(/\{\{\s*([a-z0-9_]+)\s*\}\}|_{2,}|\*\*|\n/g)) {
    html += pedazo(ultimo, s.slice(ultimo, m.index))
    const t = m[0], k = m[1]
    if (k) {
      const libre = k in propios
      const nombre = nombres[k] || propios[k] || k.replace(/_/g, ' ')
      const v = vars[k]
      html += `<span class="ed-dato ${libre ? 'ed-libre' : 'ed-sis'}" data-o="${m.index}" data-len="${t.length}" data-var="${k}" title="${esc(nombre)}">${esc(!libre && v != null && v !== '' ? v : nombre)}</span>`
    } else if (t[0] === '_') {
      html += `<span class="ed-dato ed-blanco" data-o="${m.index}" data-len="${t.length}" title="En blanco">${'&nbsp;'.repeat(Math.max(4, t.length))}</span>`
    } else if (t === '**') {
      if (negritas.has(m.index)) { html += abierta ? '</b>' : '<b>'; abierta = !abierta } else html += pedazo(m.index, t)
    } else html += '<br>'
    ultimo = m.index + t.length
  }
  html += pedazo(ultimo, s.slice(ultimo)) + (abierta ? '</b>' : '')
  return `<span data-src="${ruta}">${html}</span>`
}

// Un renglón "FIRMA:" se firma a mano: no se marca para llenar
const esFirma =c => /^\s*firma/i.test(c.etiqueta || '')
const attrCampo = (ctx, clave, lleno) => ctx.marcar ? ` data-campo="${clave}" class="cmp${lleno ? '' : ' vacio'}"` : ''

// **negrita** y saltos de línea, después de interpolar (el texto ya viene escapado)
const formato = html => html
  .replace(/\*\*(.+?)\*\*/g, '<b>$1</b>')
  .replace(/\n/g, '<br>')

const alinear = a => a === 'centro' ? 'center' : a === 'derecha' ? 'right' : a === 'justificado' ? 'justify' : 'left'

const caja = (b, html) => b.borde ? `<div class="caja">${html}</div>` : html

function encabezado(b, vars, bi) {
  // Solo logos con imagen: si la plantilla aún no tiene el logo, no se deja un
  // recuadro vacío; la celda desaparece y el título ocupa ese espacio
  const conImagen = lista => (lista || []).filter(l => l.url)
  const logos = (lista, extra = '') => conImagen(lista).map(l =>
    `<img src="${esc(l.url)}" style="max-height:${l.alto || 60}px;max-width:100%">`).join(extra)
  const lineaCentro = (c, i) => `<div class="enc-${c.estilo || 'normal'}">${formato(interpolar(c.texto, vars, { ruta: `${bi}.centro.${i}.texto` }))}</div>`
  // Con etiquetas (PERIODO / PROCESO) el centro es una tabla de dos columnas
  const centro = (b.centro || []).some(c => c.etiqueta)
    ? `<table class="enc-filas">${b.centro.map((c, i) => `<tr><td class="enc-et">${esc(c.etiqueta || '')}</td><td>${lineaCentro(c, i)}</td></tr>`).join('')}</table>`
    : (b.centro || []).map(lineaCentro).join('')
  const filas = lista => (lista || []).map((c, i) =>
    `<tr><td class="enc-et">${esc(c.etiqueta)}</td><td class="enc-va">${interpolar(c.valor || '', vars, { ruta: `${bi}.derecha.${i}.valor` })}</td></tr>`).join('')
  const derecha = b.derecha?.length ? `<td class="enc-der"><table>${filas(b.derecha)}</table></td>` : ''
  const logosDer = conImagen(b.logos_derecha).length ? `<td class="enc-logo">${logos(b.logos_derecha, '<br>')}</td>` : ''
  const logoIzq = conImagen(b.logos).length || b.logo_pie
    ? `<td class="enc-logo" style="width:${b.ancho_logo || 22}%">${logos(b.logos)}${b.logo_pie ? `<div class="enc-logo-pie">${formato(esc(b.logo_pie))}</div>` : ''}</td>`
    : ''
  const pie = b.pie?.length
    ? `<tr><td colspan="4" class="enc-pie">${b.pie.map((c, i) => `<span><b>${esc(c.etiqueta)}</b> ${interpolar(c.valor || '', vars, { ruta: `${bi}.pie.${i}.valor` })}</span>`).join('')}</td></tr>`
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
// escrito a mano. clave(ci) = clave del renglón en blanco (datos_acta.manuales);
// ruta(ci) = dónde está su valor en la plantilla (editor)
function celdasGrilla(lista, cols, ctx, clave, ruta) {
  const vars = ctx.variables || {}
  const celdas = []
  let fila = [], usadas = 0
  for (const [ci, c] of (lista || []).entries()) {
    const span = Math.min(c.span || 1, cols)
    if (usadas + span > cols) { celdas.push(fila); fila = []; usadas = 0 }
    const escrito = !c.valor && !c.firma ? manual(ctx, clave(ci)) : ''
    const valor = (c.firma ? imgFirma(c.firma, ctx) : '') + (escrito || (c.valor || !c.firma ? interpolar(c.valor || '', vars, { raya: 10, ruta: ruta?.(ci) }) : ''))
    const marca = !c.valor && !c.firma && !esFirma(c) ? attrCampo(ctx, `m:${clave(ci)}`, !!escrito) : ''
    fila.push(`<td colspan="${span}" data-ed="${clave(ci)}"${marca}><span class="et">${esc(c.etiqueta)}</span> ${valor}</td>`)
    usadas += span
  }
  if (fila.length) celdas.push(fila)
  return `<table class="grilla">${celdas.map(f => `<tr>${f.join('')}</tr>`).join('')}</table>`
}

function campos(b, ctx, bi) {
  const vars = ctx.variables || {}
  const cols = b.columnas || 1
  const titulo = b.titulo ? `<div class="sub">${esc(b.titulo)}</div>` : ''
  if (b.estilo === 'tabla') return titulo + celdasGrilla(b.campos, cols, ctx, ci => `${bi}.${ci}`, ci => `${bi}.campos.${ci}.valor`)
  // 'lineas': etiqueta y el valor sobre una raya, como los formularios impresos
  const items = (b.campos || []).map((c, ci) => {
    const texto = c.valor ? interpolar(c.valor, vars, { raya: 3, ruta: `${bi}.campos.${ci}.valor` }) : (!c.firma ? manual(ctx, `${bi}.${ci}`) : '')
    // Firma y nombre juntos (F-FAM-11): la firma va encima del nombre, no al lado
    const conTexto = !sinTexto(texto)
    const firma = c.firma ? (conTexto ? `<span class="firma-sobre">${imgFirma(c.firma, ctx)}</span>` : imgFirma(c.firma, ctx)) : ''
    const valor = firma + (conTexto ? texto : '')
    const vacio = !valor
    const marca = !c.valor && !c.firma && !esFirma(c) ? attrCampo(ctx, `m:${bi}.${ci}`, !vacio) : ''
    if (c.arriba) return `<div class="linea-arriba" data-ed="${bi}.${ci}" style="grid-column:span ${Math.min(c.span || 1, cols)}">
      <div class="et">${esc(c.etiqueta)}</div><div class="llenar"${marca}>${vacio ? '&nbsp;' : valor}</div></div>`
    return `<div class="linea" data-ed="${bi}.${ci}" style="grid-column:span ${Math.min(c.span || 1, cols)}">
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
    ? celdasGrilla(b.accesorios, b.accesorios.length, ctx, ci => `${bi}.a${ci}`, ci => `${bi}.accesorios.${ci}.valor`).replace('class="grilla"', 'class="grilla grilla-acc"')
    : ''
  return (b.titulo ? `<div class="sub">${esc(b.titulo)}</div>` : '') + tablas.join('') + accesorios
}

// ── Tabla estándar de equipos (agrupar: 'tipo_equipo') ──
// Una fila por tipo de equipo: la cantidad suma las unidades y lo que cambia entre
// ellas (seriales, códigos…) va separado por comas. Columnas: las de siempre y los
// datos que cada categoría define en el inventario ('attr:clave'). La cantidad va
// siempre: si la plantilla no la trae, se pone después de la descripción.
export const COLUMNAS_ESTANDAR = { item: 'ÍTEM', descripcion: 'DESCRIPCIÓN', cantidad: 'CANT.', marca: 'MARCA', modelo: 'MODELO', serie: 'SERIAL', codigo: 'CÓDIGO', estado: 'ESTADO', categoria: 'CATEGORÍA' }
export const columnasEstandar = cols => {
  const lista = cols?.length ? cols : [{ clave: 'descripcion' }, { clave: 'marca' }, { clave: 'modelo' }, { clave: 'serie' }]
  if (lista.some(c => c.clave === 'cantidad')) return lista
  const i = lista.findIndex(c => c.clave === 'descripcion')
  return [...lista.slice(0, i + 1), { clave: 'cantidad' }, ...lista.slice(i + 1)]
}
export function filasEstandar(filas) {
  const grupos = []
  for (const f of filas) {
    const clave = f.tipo_id || `${f.descripcion}|${f.marca}|${f.modelo}`
    const g = grupos.find(x => x.clave === clave)
    if (g) g.unidades.push(f)
    else grupos.push({ clave, unidades: [f] })
  }
  const valor = (u, c) => c.startsWith('attr:') ? u.atributos?.[c.slice(5)] : u[c]
  return grupos.map(({ unidades }) => ({
    cantidad: unidades.reduce((s, u) => s + (Number(u.cantidad) || 1), 0),
    // Lo que tienen las unidades del grupo, sin repetir, separado por comas
    de: c => [...new Set(unidades.map(u => valor(u, c)).filter(v => v != null && String(v).trim() !== '').map(String))].join(', '),
  }))
}
function tablaEstandar(b, ctx) {
  const filas = (b.fuente === 'retirados' ? ctx.retirados : ctx.equipos) || []
  if (!filas.length && b.ocultar_vacia) return ''
  const cols = columnasEstandar(b.columnas)
  const grupos = filasEstandar(filas)
  const total = Math.max(grupos.length, b.filas_minimas || 0)
  const cuerpo = Array.from({ length: total }, (_, i) => {
    const g = grupos[i]
    return `<tr>${cols.map(c => {
      const v = !g ? '' : c.clave === 'item' ? i + 1 : c.clave === 'cantidad' ? g.cantidad : g.de(c.clave)
      return `<td>${esc(v)}&nbsp;</td>`
    }).join('')}</tr>`
  }).join('')
  const titulo = b.titulo ? `<div class="sub">${esc(b.titulo)}</div>` : ''
  return titulo + `<table class="tabla"><thead><tr>${cols.map(c =>
    `<th${c.ancho ? ` style="width:${c.ancho}%"` : ''}>${esc(c.etiqueta || COLUMNAS_ESTANDAR[c.clave] || c.clave.replace(/^attr:/, '').replace(/_/g, ' ').toUpperCase())}</th>`).join('')}</tr></thead>
    <tbody>${cuerpo}</tbody></table>`
}

function tabla(b, ctx, bi) {
  if (b.agrupar === 'tipo') return tablasPorTipo(b, ctx, bi)
  if (b.agrupar === 'tipo_equipo') return tablaEstandar(b, ctx)
  const filas = (b.fuente === 'insumos' ? ctx.insumos
    : b.fuente === 'ambos' ? [...(ctx.equipos || []), ...(ctx.insumos || []).map(i => ({ ...i, estado: i.estado || 'Nuevo' }))]
    : ctx.equipos) || []
  if (!filas.length && b.ocultar_vacia) return ''
  if (b.filas_fijas?.length) return tablaFija(b, filas, ctx, bi)
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
// Lo que pone el sistema en cada celda se puede cambiar o borrar al llenar el acta
// (datos_acta.manuales, clave `bloque.tFila.columna`; '' = borrado): el formato no
// es dinámico y el cliente decide qué queda escrito. El equipo sigue en el préstamo.
// En la primera columna el texto impreso no cambia; lo editable es lo que va después.
export const claveCeldaFija = (bi, ri, cj) => `${bi}.t${ri}.${cj}`
export const esTablaFijaEditable = b => b.tipo === 'tabla' && (b.fuente || 'equipos') === 'equipos' && !!b.filas_fijas?.length && b.agrupar !== 'tipo'

// Valor de cada celda: lo escrito a mano si lo hay (aunque sea vacío), si no lo automático
export function celdasTablaFija(b, filas, manuales = {}, bi = 0) {
  return filasAutomaticas(b, filas).map(({ texto, auto }, ri) => ({
    texto, auto,
    valores: auto.map((v, cj) => {
      const m = manuales[claveCeldaFija(bi, ri, cj)]
      return m != null ? String(m) : v
    }),
  }))
}

function tablaFija(b, filas, ctx = {}, bi = 0) {
  const editable = esTablaFijaEditable(b)
  const filasHtml = editable
    ? celdasTablaFija(b, filas, ctx.manuales || {}, bi)
    : filasAutomaticas(b, filas).map(f => ({ ...f, valores: f.auto }))
  const cuerpo = filasHtml.map(({ texto, valores }) => `<tr>${valores.map((v, j) =>
    j === 0 ? `<td>${esc(texto)}${String(v).trim() ? ' ' + esc(v) : ''}</td>` : `<td>${esc(v)}&nbsp;</td>`).join('')}</tr>`).join('')
  const cols = b.columnas
  const titulo = b.titulo ? `<div class="sub">${esc(b.titulo)}</div>` : ''
  return titulo + `<table class="tabla"><thead><tr>${cols.map(c =>
    `<th${c.ancho ? ` style="width:${c.ancho}%"` : ''}>${esc(c.etiqueta || COLUMNAS_TABLA[c.clave] || c.clave)}</th>`).join('')}</tr></thead>
    <tbody>${cuerpo}</tbody></table>`
}

// Lo que el sistema pone en cada fila impresa: [{ texto impreso, auto: [valor por columna] }]
// (la primera columna: lo que va después del texto impreso, solo en la fila de "OTROS").
// El tamaño del cilindro solo está en el modelo ("Cilindro 6.5 M3"): por eso se mira también
function filasAutomaticas(b, filas) {
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
  // La fila de "OTROS" junta lo que no encajó en las anteriores (con el modelo, que en
  // los cilindros es el tamaño)
  return asignadas.map(({ ff, f: tomada }) => {
    const f = ff.resto ? juntar(libres, true) : tomada
    return { texto: ff.texto, auto: cols.map((c, j) => j === 0 ? (f && ff.resto ? f.descripcion : '') : String(f?.[c.clave] ?? '')) }
  })
}

function firmas(b, ctx, bi) {
  const lista = b.firmas || []
  return `<div class="firmas" style="grid-template-columns:repeat(${Math.max(lista.length, 1)},1fr)">${lista.map((f, fi) => {
    // f.imagen: firma fija puesta en la plantilla (editor → Firma fija); si no, la de quien firma
    const img = f.imagen || (f.rol !== 'vacia' && ctx.firmas?.[f.rol])
    const lineas = (f.lineas || []).map((l, li) => {
      const escrito = !l.valor && manual(ctx, `${bi}.f${fi}.${li}`)
      const contenido = escrito || interpolar(l.valor || '', ctx.variables, { raya: 18, ruta: `${bi}.firmas.${fi}.lineas.${li}.valor` })
      return `<div data-ed="${bi}.f${fi}.${li}"><b>${esc(l.etiqueta)}</b> ${!l.valor && ctx.marcar ? `<span${attrCampo(ctx, `m:${bi}.f${fi}.${li}`, !!escrito)}>${contenido}</span>` : contenido}</div>`
    }).join('')
    return `<div class="firma" data-ed="${bi}.f${fi}">
      <div class="firma-img">${img ? `<img src="${esc(img)}">` : ''}</div>
      <div class="firma-raya"></div>
      ${f.titulo ? `<div class="firma-titulo">${interpolar(f.titulo, ctx.variables, { ruta: `${bi}.firmas.${fi}.titulo` })}</div>` : ''}${lineas}
    </div>`
  }).join('')}</div>`
}

function bloque(b, ctx, bi) {
  const vars = ctx.variables || {}
  switch (b.tipo) {
    case 'encabezado': return encabezado(b, vars, bi)
    case 'titulo':
      return `<div class="titulo" style="text-align:${alinear(b.alineacion || 'centro')}">${formato(interpolar(b.texto, vars, { ruta: `${bi}.texto` }))}</div>`
    case 'texto':
      return caja(b, `<div class="texto" style="text-align:${alinear(b.alineacion || 'justificado')};font-size:${b.tamano || 12}px">${formato(interpolar(b.texto, vars, { marcar: true, ruta: `${bi}.texto` }))}</div>`)
    case 'campos': return caja(b, campos(b, ctx, bi))
    case 'tabla': {
      const html = tabla(b, ctx, bi)
      if (!ctx.marcar || !html) return caja(b, html)
      // Claves separadas por espacio: una tabla de equipos e insumos con Estado lleva las dos
      const claves = [(b.columnas || []).some(c => c.clave === 'estado') && b.fuente !== 'insumos' && 'estados', (b.fuente === 'insumos' || b.fuente === 'ambos') && 'insumos',
        esTablaFijaEditable(b) && `t:${bi}`].filter(Boolean)
      return caja(b, claves.length ? `<div data-campo="${claves.join(' ')}" class="cmp-tabla">${html}</div>` : html)
    }
    case 'firmas': return caja(b, firmas(b, ctx, bi))
    case 'imagen': return b.url
      ? `<div style="text-align:${alinear(b.alineacion || 'centro')}"><img src="${esc(b.url)}" style="max-height:${b.alto || 60}px;max-width:100%"></div>`
      : ''
    case 'espacio': return `<div style="height:${b.alto || 16}px"></div>`
    case 'pie': return `<div class="pie">${formato(interpolar(b.texto, vars, { ruta: `${bi}.texto` }))}</div>`
    default: return ''
  }
}

const CSS = `
*{box-sizing:border-box;margin:0;padding:0}
html{-webkit-text-size-adjust:100%;text-size-adjust:100%}
body{font-family:Arial,Helvetica,sans-serif;font-size:12px;color:#111;background:#fff;width:${ANCHO_PAGINA}px;padding:28px 34px;position:relative}
.firma-libre{position:absolute;height:auto;z-index:2}
.bloque{margin-bottom:10px;position:relative}
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
.ed-dato{border-radius:3px;padding:0 2px;cursor:pointer}
.ed-sis{background:#DBEAFE;box-shadow:inset 0 0 0 1px #93C5FD}
.ed-libre{background:#FEF3C7;box-shadow:inset 0 0 0 1px #FCD34D}
.ed-blanco{background:#F1F5F9;box-shadow:inset 0 0 0 1px #94A3B8;display:inline-block;min-height:1em}
.activo{background:#FDE68A!important;outline:2px solid #F59E0B!important;outline-offset:1px}
`

// ── Firma fija (firma_libre) ──
// Va encima de la hoja sin empujar nada, anclada al bloque que tiene antes en la lista:
// x es desde el borde izquierdo de la hoja y dy desde el borde de arriba de ese bloque.
// Así, si en el préstamo el texto de arriba ocupa más o menos que en el editor (datos
// reales en vez de los de ejemplo), la firma se mueve con su bloque (la raya de firma).
// Sin dy (las primeras que se hicieron) va con `y` desde arriba de la hoja.
export const MARGEN_HOJA_X = 34 // padding izquierdo del body (CSS de abajo): el bloque empieza ahí
const htmlFirmaLibre = (b, bi, anclada) => {
  if (!b.url) return ''
  const ancho = Number(b.ancho) || 170
  const pos = anclada
    ? `left:${(Number(b.x) || 0) - MARGEN_HOJA_X}px;top:${Number(b.dy) || 0}px`
    : `left:${Number(b.x) || 0}px;top:${Number(b.y ?? b.dy) || 0}px`
  return `<img class="firma-libre" data-firma="${bi}" src="${esc(b.url)}" style="${pos};width:${ancho}px">`
}
// El cuerpo de una página: cada bloque en su div (data-bi) y las firmas fijas dentro de su ancla
function paginaHtml(items, ctx) {
  const partes = [] // { html, firmas: [] } por bloque; las firmas sin ancla van sueltas
  const sueltas = []
  for (const { b, bi } of items) {
    if (b.tipo !== 'firma_libre') { partes.push({ html: bloque(b, ctx, bi), bi, firmas: [] }); continue }
    const ancla = partes[partes.length - 1]
    if (ancla && b.dy != null) ancla.firmas.push(htmlFirmaLibre(b, bi, true))
    else sueltas.push(htmlFirmaLibre(b, bi, false))
  }
  return partes.map(x => `<div class="bloque" data-bi="${x.bi}">${x.html}${x.firmas.join('')}</div>`).join('') + sueltas.join('')
}

// Divide los bloques en páginas (por salto_pagina) y devuelve un documento HTML por página
export function renderPaginas(bloques, ctx) {
  // marcar: true, o un mapa variable → clave (campos.js → CLAVES_HOJA)
  if (ctx?.marcar) ctx = { ...ctx, variables: { ...ctx.variables, __marcar: ctx.marcar } }
  // editor: { propios, nombres } — los espacios como cuadros y el texto con su posición (interpolarEditor)
  if (ctx?.editor) ctx = { ...ctx, variables: { ...ctx.variables, __editor: ctx.editor } }
  // Cada bloque guarda su posición en la plantilla: es la clave de sus renglones en blanco
  const paginas = [[]]
  ;(bloques || []).forEach((b, bi) => {
    if (b.tipo === 'salto_pagina') paginas.push([])
    else if (!['campos_propios', 'para_equipos', 'renovable'].includes(b.tipo)) paginas[paginas.length - 1].push({ b, bi })
  })
  return paginas
    .filter(p => p.length)
    .map(p => `<!DOCTYPE html><html><head><meta charset="utf-8"><style>${CSS}</style></head><body>${
      // data-bi / data-ed: qué bloque y qué renglón es (el editor lleva ahí al tocar la vista previa)
      paginaHtml(p, ctx)
    }</body></html>`)
}
