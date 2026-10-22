import { devolverEquipo, cambiarEquipo } from '@/lib/prestamos'
import { ESTADOS_ENTREGA } from '@/lib/entregas'
import { hoyBogota } from '@/lib/fechas'

// Recoger, recargar y cambiar equipos de un préstamo, con su acta. Cada acción
// es una fila de `entregas` (como la entrega del préstamo):
//  - a domicilio: queda "No iniciada" con repartidor y fecha; el repartidor la
//    inicia y la completa con las firmas (Entregas → su lista);
//  - en oficina: se registra ya completada.
// Lo que cambia en los equipos (devolución, cambio) se aplica al completar.
//
// entregas.datos = {
//   equipos:  [{ orden_equipo_id, equipo }]          los que se recogen o recargan
//   cambios:  [{ orden_equipo_id, sale, entra }]     en un cambio de equipo
//   motivo, observaciones,
//   plantillas: [ids]                                los formatos de la acción
//   datos_acta: { recibe, ciudad, observaciones, manuales, … }  (lib/actas/campos.js)
// }  — los equipos van copiados (código, tipo, serie): la historia no cambia
// aunque después se edite el equipo.

export const TIPO_DE_ACCION = { prestamo: 'entrega', devolucion: 'retiro', recarga: 'recarga', cambio: 'cambio' }
export const ACCION_DE_TIPO = { entrega: 'prestamo', retiro: 'devolucion', recarga: 'recarga', cambio: 'cambio' }
export const NOMBRE_ACCION = { prestamo: 'Entrega', devolucion: 'Recogida', recarga: 'Recarga', cambio: 'Cambio de equipo' }
export const accionDeEntrega = e => ACCION_DE_TIPO[e?.tipo] || 'prestamo'

// Copia de un equipo con lo que piden las actas y la historia
export const copiaEquipo = eq => eq && ({
  id: eq.id, codigo: eq.codigo, atributos: eq.atributos || {}, tipo_equipo_id: eq.tipo_equipo_id || eq.tipo_equipo?.id || null,
  tipo_equipo: eq.tipo_equipo ? {
    id: eq.tipo_equipo.id, nombre: eq.tipo_equipo.nombre, atributos: eq.tipo_equipo.atributos || {},
    categoria: eq.tipo_equipo.categoria ? { id: eq.tipo_equipo.categoria.id, nombre: eq.tipo_equipo.categoria.nombre } : null,
  } : null,
})

// Equipos que salen en el acta: los que se entregan (en un cambio, los nuevos) y los que se retiran
export function equiposDelActa(accion, datos = {}) {
  if (accion === 'cambio') return { equipos: (datos.cambios || []).map(c => c.entra), retirados: (datos.cambios || []).map(c => c.sale) }
  return { equipos: (datos.equipos || []).map(x => x.equipo), retirados: [] }
}

async function codigoNuevo(supabase) {
  const { count } = await supabase.from('entregas').select('id', { count: 'exact', head: true })
  return `ENT-${new Date().getFullYear()}-${String((count || 0) + 1).padStart(3, '0')}`
}

async function idEstadoEquipo(supabase, nombre) {
  const { data } = await supabase.from('estados_equipo').select('id').eq('nombre', nombre).maybeSingle()
  return data?.id || null
}

// Acción a domicilio: el repartidor la ve en su lista. En un cambio, el equipo
// nuevo queda "Reservado" para que nadie más lo preste mientras tanto.
export async function programarAccion(supabase, { orden, accion, repartidorId, fecha, datos }) {
  if (accion === 'cambio') {
    const reservado = await idEstadoEquipo(supabase, 'Reservado')
    const ids = (datos.cambios || []).map(c => c.entra.id)
    const { data: actuales } = await supabase.from('equipos').select('codigo, estado:estados_equipo(nombre)').in('id', ids)
    const ocupado = (actuales || []).find(x => x.estado?.nombre !== 'Disponible')
    if (ocupado) return { error: { message: `El equipo ${ocupado.codigo} ya no está disponible.` } }
    const { error } = await supabase.from('equipos').update({ estado_id: reservado }).in('id', ids)
    if (error) return { error }
  }
  return supabase.from('entregas').insert({
    codigo: await codigoNuevo(supabase),
    orden_id: orden.id, cliente_id: orden.cliente_id || orden.cliente?.id || null,
    repartidor_id: repartidorId, tipo: TIPO_DE_ACCION[accion], modo: 'domicilio',
    estado_id: ESTADOS_ENTREGA.NoIniciada,
    fecha_asignacion: new Date().toISOString(), fecha_programada: fecha, datos,
  }).select('*').single()
}

// El repartidor sale para la acción (no toca el estado del préstamo)
export async function iniciarAccion(supabase, entrega) {
  return supabase.from('entregas').update({ estado_id: ESTADOS_ENTREGA.EnProgreso, fecha_inicio: new Date().toISOString() })
    .eq('id', entrega.id).select('*').single()
}

// Cancela una acción programada; en un cambio libera el equipo que se había reservado
export async function cancelarAccion(supabase, entrega) {
  const { data: cancelada } = await supabase.from('estados_entrega').select('id').eq('nombre', 'Cancelada').maybeSingle()
  const { error } = await supabase.from('entregas').update({ estado_id: cancelada?.id }).eq('id', entrega.id)
  if (error) return { error }
  if (entrega.tipo === 'cambio') {
    const disponible = await idEstadoEquipo(supabase, 'Disponible')
    const ids = (entrega.datos?.cambios || []).map(c => c.entra?.id).filter(Boolean)
    if (ids.length) await supabase.from('equipos').update({ estado_id: disponible }).in('id', ids).eq('estado_id', await idEstadoEquipo(supabase, 'Reservado'))
  }
  return { error: null }
}

// Lo que la acción cambia en los equipos y el préstamo
export async function aplicarAccion(supabase, { orden, accion, datos, fecha = hoyBogota(), yaReservado = false }) {
  if (accion === 'devolucion') {
    let todosDevueltos = false
    for (const x of datos.equipos || []) {
      const r = await devolverEquipo({
        supabase, ordenEquipoId: x.orden_equipo_id, equipoId: x.equipo.id, ordenId: orden.id,
        fechaDevolucion: fecha, observaciones: datos.observaciones || 'Recogido con acta',
      })
      if (r.error) return r
      todosDevueltos = r.todosDevueltos
    }
    return { error: null, todosDevueltos }
  }
  if (accion === 'recarga') {
    return supabase.from('ordenes_servicio').update({ ultima_recarga: new Date().toISOString() }).eq('id', orden.id)
  }
  if (accion === 'cambio') {
    for (const c of datos.cambios || []) {
      const r = await cambiarEquipo({
        supabase, orden: { ...orden, estado: { nombre: 'Entregada' } }, ordenEquipoId: c.orden_equipo_id,
        equipoAnteriorId: c.sale.id, equipoNuevo: c.entra, fecha, motivo: datos.motivo, yaReservado,
      })
      if (r.error) return r
    }
    return { error: null }
  }
  return { error: null }
}

// En oficina: se aplica y queda registrada como completada
// fecha: el día en que se hizo, si no es hoy (orden_equipos.fecha_devolucion es solo día)
export async function registrarEnOficina(supabase, { orden, accion, datos, recibidoPor, firma, fecha }) {
  const r = await aplicarAccion(supabase, { orden, accion, datos, ...(fecha ? { fecha } : {}) })
  if (r.error) return r
  const ahora = new Date().toISOString()
  const { data, error } = await supabase.from('entregas').insert({
    codigo: await codigoNuevo(supabase),
    orden_id: orden.id, cliente_id: orden.cliente_id || orden.cliente?.id || null,
    repartidor_id: null, tipo: TIPO_DE_ACCION[accion], modo: 'oficina',
    estado_id: ESTADOS_ENTREGA.Completada,
    fecha_asignacion: ahora, fecha_inicio: ahora, fecha_completada: ahora, duracion_minutos: 0,
    recibido_por: recibidoPor || null, firma_iniciales: firma || null, observaciones: datos.observaciones || null, datos,
  }).select('*').single()
  return { data, error, todosDevueltos: r.todosDevueltos }
}

// A domicilio, al firmar: se aplica y la fila queda completada
export async function completarAccion(supabase, { entrega, orden, recibidoPor, firma, observaciones, datos }) {
  const accion = accionDeEntrega(entrega)
  const r = await aplicarAccion(supabase, { orden, accion, datos: { ...entrega.datos, ...datos }, yaReservado: true })
  if (r.error) return r
  const ahora = new Date().toISOString()
  const inicio = entrega.fecha_inicio ? new Date(entrega.fecha_inicio) : new Date()
  const cambios = {
    estado_id: ESTADOS_ENTREGA.Completada, recibido_por: recibidoPor, firma_iniciales: firma,
    observaciones: observaciones || null, fecha_completada: ahora,
    duracion_minutos: Math.round((new Date() - inicio) / 60000),
    datos: { ...entrega.datos, ...datos },
  }
  const { error } = await supabase.from('entregas').update(cambios).eq('id', entrega.id)
  return { error, cambios: { ...cambios, estado: { id: ESTADOS_ENTREGA.Completada, nombre: 'Completada' } } }
}

// ── Recargas periódicas ──
// Próxima recarga de un préstamo con frecuencia: desde la última (o la entrega)
export function proximaRecarga(orden) {
  if (!orden?.recarga_cada_dias) return null
  const desde = orden.ultima_recarga || orden.fecha_entrega
  if (!desde) return null
  const d = new Date(desde)
  d.setDate(d.getDate() + orden.recarga_cada_dias)
  return d.toISOString()
}
