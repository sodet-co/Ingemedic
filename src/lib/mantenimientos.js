// Reglas compartidas entre Mantenimientos, Préstamos, Entregas e Inventario para
// que el estado de un equipo no mienta:
//  - Con un mantenimiento abierto, el equipo está "En mantenimiento" pase lo que
//    pase con su préstamo (devolverlo, finalizarlo o cancelarlo no lo vuelve
//    "Disponible"; completar la entrega no lo vuelve "En préstamo").
//  - Se puede abrir mantenimiento a un equipo prestado: conserva su cliente y
//    paciente, y al cerrarse vuelve al estado de su préstamo, no a "Disponible".

// Datos de la unidad que muestran la tabla de Mantenimientos y el selector de
// equipos (los mismos de Inventario → unidades: código, serie, modelo, estado,
// paciente, dirección). Compartido entre page.js y MantenimientosClient.
export const SELECT_EQUIPO_MANT = `
  id, codigo, atributos, tipo_equipo_id,
  tipo_equipo:tipos_equipo(id, nombre, atributos, imagen_url, categoria_id,
    categoria:categorias_equipo(id, nombre)
  ),
  estado:estados_equipo(id, nombre),
  cliente_actual:clientes(nombre),
  paciente_actual:pacientes(nombre, direccion, ciudad)
`

// actividades_texto: la columna de texto `actividades` (resumen del cierre);
// sin el alias la pisa la relación `actividades` (checklist) y se pierde.
export const SELECT_MANTENIMIENTO = `
  *,
  actividades_texto:actividades,
  equipo:equipos(${SELECT_EQUIPO_MANT}),
  estado:estados_mantenimiento(id, nombre),
  tipo:tipos_mantenimiento(id, nombre),
  actividades:actividades_mantenimiento(
    id, descripcion, completado, observaciones, fecha, archivo_url,
    adjuntos:adjuntos_actividad_mantenimiento(id, nombre, url, tipo)
  )
`

const ORDEN_RESERVADA = ['Programada', 'En reparto'] // equipo apartado, aún no entregado
const ORDEN_INACTIVA  = ['Finalizada', 'Cancelada']

// Ids (de la lista dada) que tienen un mantenimiento sin cerrar
export async function equiposConMantenimientoAbierto(supabase, ids) {
  const lista = [...new Set((ids || []).filter(Boolean))]
  if (lista.length === 0) return new Set()
  const { data, error } = await supabase.from('mantenimientos')
    .select('equipo_id, estado:estados_mantenimiento(nombre)')
    .in('equipo_id', lista)
  if (error) throw error
  return new Set((data || []).filter(m => m.estado?.nombre !== 'Cerrado').map(m => m.equipo_id))
}

// Préstamo activo de un equipo (orden no finalizada/cancelada y sin devolución)
export async function prestamoActivo(supabase, equipoId) {
  const { data, error } = await supabase.from('orden_equipos')
    .select('id, orden:ordenes_servicio(id, codigo, estado:estados_orden(nombre), cliente:clientes(nombre), paciente:pacientes(nombre))')
    .eq('equipo_id', equipoId)
    .is('fecha_devolucion', null)
  if (error) throw error
  return (data || []).map(oe => oe.orden).find(o => o && !ORDEN_INACTIVA.includes(o.estado?.nombre)) || null
}

// Nombre del estado al que vuelve un equipo cuando se cierra su mantenimiento
// (sin contar "Baja", que es decisión del técnico)
export function estadoSegunPrestamo(orden) {
  if (!orden) return 'Disponible'
  return ORDEN_RESERVADA.includes(orden.estado?.nombre) ? 'Reservado' : 'En préstamo'
}

// Libera los equipos de un préstamo (devolución, finalizar, cancelar): quedan
// sin cliente ni paciente y "Disponible" — salvo los que están en
// mantenimiento, que conservan ese estado hasta que se cierre.
export async function liberarEquipos(supabase, ids, estadoDisponibleId) {
  const lista = [...new Set((ids || []).filter(Boolean))]
  if (lista.length === 0) return { error: null }
  let enMant
  try { enMant = await equiposConMantenimientoAbierto(supabase, lista) } catch (error) { return { error } }
  const libres = lista.filter(id => !enMant.has(id))
  const ops = []
  if (libres.length && estadoDisponibleId) {
    ops.push(supabase.from('equipos')
      .update({ estado_id: estadoDisponibleId, paciente_actual_id: null, cliente_actual_id: null })
      .in('id', libres))
  }
  if (enMant.size) {
    ops.push(supabase.from('equipos')
      .update({ paciente_actual_id: null, cliente_actual_id: null })
      .in('id', [...enMant]))
  }
  const res = await Promise.all(ops)
  return { error: res.find(r => r.error)?.error || null, enMantenimiento: [...enMant] }
}
