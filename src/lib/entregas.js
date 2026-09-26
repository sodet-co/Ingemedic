// Lógica de negocio de entregas compartida entre la vista de admin (EntregasClient.js)
// y la vista simplificada de repartidor (EntregasRepartidorClient.js) — un solo lugar
// para "iniciar entrega" y "completar entrega" con firma, sin duplicar reglas.

export const ESTADOS_ENTREGA = {
  NoIniciada: '14b43a74-439d-4647-855e-4693339db133',
  EnProgreso: '00baf9e1-8e9d-4da5-b16d-acbfdf3b4354',
  Completada: 'b1f845f1-d69e-4ec8-985b-c7f27c50818c',
}
export const ESTADO_OS_ENTREGADA  = 'acafaf48-918e-4681-bf31-3111c218bcc9'
export const ESTADO_OS_EN_REPARTO = 'e87fa300-a4c7-4225-b618-faf162ccf7ef'

const SELECT_ENTREGA = `
  *,
  orden:ordenes_servicio(
    id, codigo, fecha_vigencia, fecha_entrega, observaciones, paciente_id, cliente_id,
    cliente:clientes(id, nombre, tipo_persona, nit_cc, direccion, telefono, municipio:municipios(nombre)),
    paciente:pacientes(id, nombre, direccion, telefono, ciudad),
    equipos:orden_equipos(id, equipo_id, equipo:equipos(id, codigo, tipo_equipo:tipos_equipo(id, nombre, atributos))),
    plantillas:orden_plantillas(id, plantilla_id, firmado, firmado_por, firma_iniciales, fecha_firma, plantilla:plantillas_orden(id, nombre))
  ),
  cliente:clientes(id, nombre),
  repartidor:usuarios!entregas_repartidor_id_fkey(id, nombre),
  estado:estados_entrega(id, nombre)
`

// Pasa una orden "Programada" a "En reparto" y crea su fila de entrega.
// El código se genera contando el total real de entregas en BD (no el tamaño de
// la lista local) — importante porque el repartidor solo ve SUS entregas filtradas,
// y contar sobre esa lista parcial produciría códigos duplicados entre repartidores.
export async function crearEntrega(supabase, orden) {
  const { count } = await supabase.from('entregas').select('id', { count: 'exact', head: true })
  const codigo = `ENT-${new Date().getFullYear()}-${String((count || 0) + 1).padStart(3, '0')}`

  await supabase.from('ordenes_servicio')
    .update({ estado_id: ESTADO_OS_EN_REPARTO })
    .eq('id', orden.id)

  return supabase.from('entregas').insert({
    codigo,
    orden_id:         orden.id,
    cliente_id:       orden.cliente?.id,
    repartidor_id:    orden.repartidor?.id || null,
    tipo:             'entrega',
    estado_id:        ESTADOS_ENTREGA.EnProgreso,
    fecha_asignacion: new Date().toISOString(),
    fecha_inicio:     new Date().toISOString(),
  }).select(SELECT_ENTREGA).single()
}

// Marca una entrega como completada: guarda firma + quién recibe, aplica la misma
// firma a todos los documentos de la orden, pasa la orden a "Entregada" y el/los
// equipo(s) de "Reservado" a "En préstamo".
export async function finalizarEntrega(supabase, { entrega, recibidoPor, firma, observaciones, estadosEquipo }) {
  const ahora    = new Date().toISOString()
  const inicio   = entrega.fecha_inicio ? new Date(entrega.fecha_inicio) : new Date()
  const duracion = Math.round((new Date() - inicio) / 60000)

  const { error } = await supabase.from('entregas').update({
    estado_id:        ESTADOS_ENTREGA.Completada,
    recibido_por:     recibidoPor,
    firma_iniciales:  firma,
    observaciones:    observaciones || null,
    fecha_completada: ahora,
    duracion_minutos: duracion,
  }).eq('id', entrega.id)
  if (error) return { error }

  // La misma firma se aplica a todos los documentos de la orden
  const docs = entrega.orden?.plantillas || []
  let erroresFirma = 0
  for (const doc of docs) {
    const { error: errFirma } = await supabase.from('orden_plantillas').update({
      firmado:         true,
      firmado_por:     recibidoPor,
      firma_iniciales: firma,
      fecha_firma:     ahora,
    }).eq('id', doc.id)
    if (errFirma) { erroresFirma++; console.error('Error guardando firma:', errFirma) }
  }

  await supabase.from('ordenes_servicio')
    .update({ estado_id: ESTADO_OS_ENTREGADA, recibido_por: recibidoPor })
    .eq('id', entrega.orden?.id)

  // Equipo pasa de "Reservado" a "En préstamo" — paciente_actual_id/cliente_actual_id
  // ya quedaron asignados al crear la orden (quedó reservado desde ese momento).
  const idsEquipos = (entrega.orden?.equipos || []).map(oe => oe.equipo_id || oe.equipo?.id).filter(Boolean)
  const estadoPrestamo = (estadosEquipo || []).find(e => e.nombre === 'En préstamo')
  if (idsEquipos.length > 0 && estadoPrestamo) {
    await supabase.from('equipos').update({ estado_id: estadoPrestamo.id }).in('id', idsEquipos)
  }

  return {
    error: null,
    erroresFirma,
    cambios: {
      estado:           { id: ESTADOS_ENTREGA.Completada, nombre: 'Completada' },
      recibido_por:      recibidoPor,
      fecha_completada:  ahora,
      duracion_minutos:  duracion,
      observaciones:     observaciones || null,
    },
  }
}
