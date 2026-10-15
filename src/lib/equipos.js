import { paraGuardar, hoyBogota } from '@/lib/fechas'

// Supabase corta silenciosamente en 1000 filas si no se pagina explícitamente
// (sin error, el resultado simplemente llega incompleto). Este helper trae TODOS
// los equipos en lotes de 1000 usando .range() hasta que un lote vuelve incompleto.
// Solo trae los vivos (activo = true): un equipo eliminado conserva su fila para
// el historial de préstamos y mantenimientos, pero no aparece en ninguna lista
// ni ocupa su código (ver eliminarEquipos más abajo).
const TAMANO_LOTE = 1000

export async function traerTodosLosEquipos(supabase, buildQuery) {
  let todos = []
  let desde = 0
  while (true) {
    const { data, error } = await buildQuery(supabase.from('equipos'))
      .eq('activo', true)
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
// Solo cuentan los equipos vivos: el código de uno eliminado queda libre y, si
// era el último agregado, la sugerencia vuelve a él.
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

// ── El código vive en la columna `codigo` ────────────────────────────────
// Las categorías además muestran una columna "Código de inventario" que sale de
// `atributos` (clave codigo_inventario, codigo_de_inventario o codigo, según la
// categoría). Editarla por separado dejaba la tabla diciendo un código y el
// sistema validando otro. La columna `codigo` es la verdad; estas claves son copia.
export const esCampoCodigo = clave => /^codigo(_de)?(_inventario)?$/.test(clave || '')

// Atributos con todas sus claves de código (las que ya tenga, las de `campos`
// de la categoría y codigo_inventario) iguales a `codigo`.
export function atributosConCodigo(atributos, codigo, campos = []) {
  const claves = new Set(['codigo_inventario',
    ...Object.keys(atributos || {}).filter(esCampoCodigo),
    ...campos.map(c => c.clave).filter(esCampoCodigo)])
  const res = { ...(atributos || {}) }
  for (const k of claves) res[k] = codigo
  return res
}

// ── Eliminar equipos ──────────────────────────────────────────────────────
// No se borra la fila: los préstamos, entregas y mantenimientos la referencian
// y sus actas deben seguir mostrando el código. Se marca activo = false (sale de
// todas las listas y su código queda libre para reutilizarse) y estado "Baja".
// Los préstamos en curso se cierran: la fila del equipo queda devuelta hoy con
// el motivo, y si la orden se queda sin equipos pasa a "Finalizada" (ya se había
// entregado) o "Cancelada" (aún no salía; su entrega pendiente también se cancela).
// Con un mantenimiento abierto no se elimina: hay que cerrarlo primero.

const ORDEN_CERRADA = ['Finalizada', 'Cancelada']
const LOTE_IDS = 100 // .in() con cientos de uuids rompe el largo de la URL

function enLotes(ids) {
  const lotes = []
  for (let i = 0; i < ids.length; i += LOTE_IDS) lotes.push(ids.slice(i, i + LOTE_IDS))
  return lotes
}

// Equipos vivos de unos tipos (para eliminar un tipo o una categoría completa)
export async function equiposDeTipos(supabase, tipoIds) {
  let res = []
  for (const lote of enLotes(tipoIds)) {
    const filas = await traerTodosLosEquipos(supabase, q => q.select('id, codigo').in('tipo_equipo_id', lote))
    res = res.concat(filas)
  }
  return res
}

// Lo que pasaría al eliminar: préstamos en curso y mantenimientos abiertos
export async function revisarEliminacion(supabase, equipoIds) {
  const prestamos = []
  const mantenimientos = []
  for (const lote of enLotes(equipoIds)) {
    const { data, error } = await supabase.from('orden_equipos')
      .select('id, equipo_id, equipo:equipos(codigo), orden:ordenes_servicio(id, codigo, estado:estados_orden(nombre), cliente:clientes(nombre), paciente:pacientes(nombre))')
      .in('equipo_id', lote)
      .is('fecha_devolucion', null)
    if (error) throw error
    prestamos.push(...(data || []).filter(oe => oe.orden && !ORDEN_CERRADA.includes(oe.orden.estado?.nombre)))

    const { data: mants, error: errM } = await supabase.from('mantenimientos')
      .select('codigo, equipo:equipos(codigo), estado:estados_mantenimiento(nombre)')
      .in('equipo_id', lote)
    if (errM) throw errM
    mantenimientos.push(...(mants || []).filter(m => m.estado?.nombre !== 'Cerrado'))
  }
  return { prestamos, mantenimientos }
}

export async function eliminarEquipos({ supabase, equipoIds, motivo }) {
  const ids = [...new Set((equipoIds || []).filter(Boolean))]
  if (ids.length === 0) return { error: null, prestamos: [], ordenes: [] }
  if (!motivo?.trim()) return { error: { message: 'El motivo es obligatorio' } }

  let revision
  try { revision = await revisarEliminacion(supabase, ids) } catch (error) { return { error } }
  if (revision.mantenimientos.length) {
    return { error: { message: 'Hay mantenimientos abiertos. Ciérralos antes de eliminar el equipo.' } }
  }

  const { data: estadosOrden } = await supabase.from('estados_orden').select('id, nombre')
  const { data: estadosEntrega } = await supabase.from('estados_entrega').select('id, nombre')
  const { data: estadoBaja } = await supabase.from('estados_equipo').select('id').eq('nombre', 'Baja').maybeSingle()
  const idOrden = n => estadosOrden?.find(e => e.nombre === n)?.id
  const idEntrega = n => estadosEntrega?.find(e => e.nombre === n)?.id
  if (!estadoBaja) return { error: { message: 'No se encontró el estado "Baja" en estados_equipo' } }

  // 1. Cerrar los préstamos en curso
  const nota = `Equipo eliminado del inventario — ${motivo.trim()}`
  const { prestamos } = revision
  for (const lote of enLotes(prestamos.map(p => p.id))) {
    const { error } = await supabase.from('orden_equipos')
      .update({ fecha_devolucion: paraGuardar(hoyBogota()), observaciones_devolucion: nota })
      .in('id', lote)
    if (error) return { error }
  }

  // 2. Las órdenes que se quedaron sin equipos se cierran
  const ordenes = []
  const ordenesAfectadas = [...new Map(prestamos.map(p => [p.orden.id, p.orden])).values()]
  for (const orden of ordenesAfectadas) {
    const { data: filas, error } = await supabase.from('orden_equipos').select('fecha_devolucion').eq('orden_id', orden.id)
    if (error) return { error }
    const quedanEquipos = (filas || []).some(f => !f.fecha_devolucion)
    if (quedanEquipos) { ordenes.push({ codigo: orden.codigo, queda: orden.estado?.nombre }); continue }

    const entregada = orden.estado?.nombre === 'Entregada'
    const nuevo = entregada ? 'Finalizada' : 'Cancelada'
    const { error: errOrden } = await supabase.from('ordenes_servicio').update({ estado_id: idOrden(nuevo) }).eq('id', orden.id)
    if (errOrden) return { error: errOrden }
    if (!entregada && idEntrega('Cancelada')) {
      let q = supabase.from('entregas').update({ estado_id: idEntrega('Cancelada') }).eq('orden_id', orden.id)
      if (idEntrega('Completada')) q = q.neq('estado_id', idEntrega('Completada'))
      await q
    }
    ordenes.push({ codigo: orden.codigo, queda: nuevo })
  }

  // 3. Los equipos salen del inventario
  for (const lote of enLotes(ids)) {
    const { error } = await supabase.from('equipos').update({
      activo: false,
      estado_id: estadoBaja.id,
      paciente_actual_id: null,
      cliente_actual_id: null,
      fecha_eliminacion: new Date().toISOString(),
      motivo_eliminacion: motivo.trim(),
    }).in('id', lote)
    if (error) return { error }
  }

  return { error: null, prestamos, ordenes }
}
