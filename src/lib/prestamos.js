import { paraGuardar } from '@/lib/fechas'

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

  const { data: estadoDisponible } = await supabase
    .from('estados_equipo').select('id').eq('nombre', 'Disponible').maybeSingle()
  if (estadoDisponible) {
    await supabase.from('equipos').update({
      estado_id:          estadoDisponible.id,
      paciente_actual_id: null,
      cliente_actual_id:  null,
    }).eq('id', equipoId)
  }

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
