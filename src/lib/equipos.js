// Supabase corta silenciosamente en 1000 filas si no se pagina explícitamente
// (sin error, el resultado simplemente llega incompleto). Este helper trae TODOS
// los equipos en lotes de 1000 usando .range() hasta que un lote vuelve incompleto.
const TAMANO_LOTE = 1000

export async function traerTodosLosEquipos(supabase, buildQuery) {
  let todos = []
  let desde = 0
  while (true) {
    const { data, error } = await buildQuery(supabase.from('equipos'))
      .range(desde, desde + TAMANO_LOTE - 1)
    if (error) throw error
    todos = todos.concat(data || [])
    if (!data || data.length < TAMANO_LOTE) break
    desde += TAMANO_LOTE
  }
  return todos
}

// ── Consecutivo de códigos de inventario ─────────────────────────────────
// Sugerencia para una unidad nueva: el ÚLTIMO código AGREGADO en todo el
// inventario + 1, conservando sus letras y formato, sin importar cuáles sean.
// Ej.: se registra RL140 y luego EQ34 → la siguiente sugerencia es EQ35.
// Si ese código ya existe, salta al siguiente libre.

// Código "simple": letras (con guion/espacio opcional) + número.
const RE_SIMPLE = /^([A-Z]+[-\s]?)(\d+)$/

// Clave para detectar duplicados comparando por número: RL528 = RL0528,
// CON-0001 = CON-1. Códigos compuestos (RL409/FAM356) se comparan tal cual.
export function claveCodigo(codigo) {
  const c = (codigo || '').trim().toUpperCase()
  const m = c.match(RE_SIMPLE)
  return m ? `${letrasDe(m[1])}${Number(m[2])}` : c
}
const letrasDe = pref => pref.replace(/[-\s]/g, '').toUpperCase()

// Separa un código simple en { pref (tal cual, ej. "CON-"), letras ("CON"), num, ancho }
export function partesCodigo(codigo) {
  const m = (codigo || '').trim().toUpperCase().match(RE_SIMPLE)
  return m ? { pref: m[1], letras: letrasDe(m[1]), num: Number(m[2]), ancho: m[2].length } : null
}

// Más recientes primero; en un empate de fecha (cargue masivo) gana el número mayor.
export function porMasReciente(a, b) {
  return (b.fecha_creacion || '').localeCompare(a.fecha_creacion || '') ||
    ((partesCodigo(b.codigo)?.num || 0) - (partesCodigo(a.codigo)?.num || 0))
}

// Trae todos los equipos, arma el mapa de códigos usados, calcula la
// sugerencia y los últimos 5 (en `categoriaId` y en todo el inventario).
export async function consecutivoCodigos(supabase, categoriaId = null) {
  const filas = await traerTodosLosEquipos(supabase, q =>
    q.select('codigo, fecha_creacion, tipo_equipo:tipos_equipo(nombre, atributos, categoria_id, categoria:categorias_equipo(nombre))'))
  const existentes = new Map() // clave → nombre del equipo que ya lo usa
  for (const f of filas) {
    if (f.codigo) existentes.set(claveCodigo(f.codigo), f.tipo_equipo?.atributos?.nombre || f.tipo_equipo?.nombre || 'otro equipo')
  }

  const conCodigo = filas.filter(f => f.codigo).sort(porMasReciente)
  const aItem = f => ({
    codigo: f.codigo.trim(),
    equipo: f.tipo_equipo?.atributos?.nombre || f.tipo_equipo?.nombre || '—',
    categoria: f.tipo_equipo?.categoria?.nombre || '—',
    fecha: f.fecha_creacion,
  })
  const ultimos = conCodigo.slice(0, 5).map(aItem)
  const ultimosCategoria = categoriaId
    ? conCodigo.filter(f => f.tipo_equipo?.categoria_id === categoriaId).slice(0, 5).map(aItem)
    : []

  // Base: el último agregado que tenga formato letras + número
  const base = conCodigo.find(f => partesCodigo(f.codigo))
  if (!base) return { ultimo: null, siguiente: '', existentes, ultimos, ultimosCategoria }

  const p = partesCodigo(base.codigo)
  const formar = k => p.pref + String(k).padStart(p.ancho, '0')
  let n = p.num + 1
  while (existentes.has(claveCodigo(formar(n)))) n++
  return { ultimo: base.codigo.trim(), siguiente: formar(n), existentes, ultimos, ultimosCategoria }
}
