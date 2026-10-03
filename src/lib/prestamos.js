import { paraGuardar } from '@/lib/fechas'
import { liberarEquipos } from '@/lib/mantenimientos'

// Devuelve un equipo prestado: marca la fecha de devolución en orden_equipos,
// libera el equipo (vuelve a "Disponible", sin paciente/cliente asignado) y,
// si con esta devolución ya no queda ningún equipo activo en la orden, la
// pasa a "Finalizada". Compartida entre Préstamos (OrdenesClient) y los
// paneles de detalle de Cliente/Paciente (ClientesClient) — no depende del
// estado de ningún componente, recibe todo lo que necesita por parámetro.
export async function devolverEquipo({ supabase, ordenEquipoId, equipoId, ordenId, fechaDevolucion, observaciones }) {
  const { error } = await supabase.from('orden_equipos')
    .update({
      fecha_devolucion:         paraGuardar(fechaDevolucion),
      observaciones_devolucion: observaciones || null,
    })
    .eq('id', ordenEquipoId)
  if (error) return { error }

  // Si el equipo está en mantenimiento, sigue "En mantenimiento" (ver lib/mantenimientos.js)
  const { data: estadoDisponible } = await supabase
    .from('estados_equipo').select('id').eq('nombre', 'Disponible').maybeSingle()
  const { error: errLiberar } = await liberarEquipos(supabase, [equipoId], estadoDisponible?.id)
  if (errLiberar) return { error: errLiberar }

  const { data: todos } = await supabase.from('orden_equipos')
    .select('fecha_devolucion').eq('orden_id', ordenId)
  const todosDevueltos = todos?.every(oe => oe.fecha_devolucion !== null) ?? false

  if (todosDevueltos) {
    const { data: estadoFinalizada } = await supabase
      .from('estados_orden').select('id').eq('nombre', 'Finalizada').maybeSingle()
    if (estadoFinalizada) {
      await supabase.from('ordenes_servicio')
        .update({ estado_id: estadoFinalizada.id }).eq('id', ordenId)
    }
  }

  return { error: null, todosDevueltos }
}

// Cambia un equipo de un préstamo por otro disponible (normalmente del mismo
// tipo, ej. un cilindro por otro), sin tener que devolverlo y prestar de nuevo.
//  - Antes de la entrega (Borrador/Programada/En reparto) el equipo no ha salido:
//    se reemplaza en la misma fila de orden_equipos y el nuevo queda "Reservado";
//    el acta de la entrega ya sale con él.
//  - Ya entregado: queda el historial. La fila vieja se cierra como devuelta
//    ("Cambiado por <código>") y entra una fila nueva "En préstamo" con la fecha
//    del cambio. La orden sigue activa: aquí nunca se finaliza.
// El equipo que sale se libera con liberarEquipos (respeta mantenimientos).
export async function cambiarEquipo({ supabase, orden, ordenEquipoId, equipoAnteriorId, equipoNuevo, fecha, motivo }) {
  // Se confirma en BD que el nuevo sigue disponible (la lista en pantalla puede ser vieja)
  const { data: actual, error: errNuevo } = await supabase.from('equipos')
    .select('estado:estados_equipo(nombre)').eq('id', equipoNuevo.id).maybeSingle()
  if (errNuevo) return { error: errNuevo }
  if (actual?.estado?.nombre !== 'Disponible') {
    return { error: { message: `El equipo ${equipoNuevo.codigo} ya no está disponible.` } }
  }

  const { data: estadosEq } = await supabase.from('estados_equipo').select('id, nombre')
    .in('nombre', ['Disponible', 'Reservado', 'En préstamo'])
  const idEstado = nombre => estadosEq?.find(e => e.nombre === nombre)?.id
  const entregada = orden.estado?.nombre === 'Entregada'

  if (entregada) {
    const { error } = await supabase.from('orden_equipos').insert({
      orden_id: orden.id, equipo_id: equipoNuevo.id, fecha_entrega: paraGuardar(fecha),
    })
    if (error) return { error }
    const nota = `Cambiado por ${equipoNuevo.codigo}${motivo ? ` — ${motivo}` : ''}`
    const { error: errViejo } = await supabase.from('orden_equipos')
      .update({ fecha_devolucion: paraGuardar(fecha), observaciones_devolucion: nota })
      .eq('id', ordenEquipoId)
    if (errViejo) return { error: errViejo }
  } else {
    const { error } = await supabase.from('orden_equipos')
      .update({ equipo_id: equipoNuevo.id }).eq('id', ordenEquipoId)
    if (error) return { error }
  }

  const { error: errAsignar } = await supabase.from('equipos').update({
    estado_id:          idEstado(entregada ? 'En préstamo' : 'Reservado'),
    paciente_actual_id: orden.paciente_id || null,
    cliente_actual_id:  orden.cliente_id || null,
  }).eq('id', equipoNuevo.id)
  if (errAsignar) return { error: errAsignar }

  const { error: errLiberar } = await liberarEquipos(supabase, [equipoAnteriorId], idEstado('Disponible'))
  return { error: errLiberar || null, entregada }
}
