import { createClient } from '@/lib/supabase-server'
import EntregasClient from './EntregasClient'
import EntregasRepartidorClient from './EntregasRepartidorClient'

// Evita que Next.js cachee las consultas de esta página.
// Sin esto, router.refresh() puede devolver datos desactualizados
// (ej. una entrega recién completada "revierte" visualmente a pendiente).
export const dynamic = 'force-dynamic'
export const revalidate = 0

export default async function EntregasPage() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  const { data: usuario } = await supabase
    .from('usuarios')
    .select('id, nombre, roles (nombre)')
    .eq('email', user.email)
    .single()

  const esRepartidor = usuario?.roles?.nombre === 'Repartidor'

  let entregasQuery = supabase.from('entregas').select(`
      *,
      orden:ordenes_servicio(
        id, codigo, fecha_vigencia, observaciones, paciente_id, cliente_id,
        cliente:clientes(id, nombre, tipo_persona, nit_cc, direccion, telefono, municipio:municipios(nombre)),
        paciente:pacientes(id, nombre, direccion, telefono, ciudad),
        equipos:orden_equipos(
          id, equipo_id,
          equipo:equipos(id, codigo,
            tipo_equipo:tipos_equipo(id, nombre, atributos)
          )
        ),
        plantillas:orden_plantillas(
          id, plantilla_id, firmado, firmado_por, firma_iniciales, fecha_firma,
          plantilla:plantillas_orden(id, nombre, contenido)
        )
      ),
      cliente:clientes(id, nombre),
      repartidor:usuarios!entregas_repartidor_id_fkey(id, nombre),
      estado:estados_entrega(id, nombre)
    `).order('fecha_creacion', { ascending: false })

  // Órdenes en estado "Programada" sin entrega activa aún
  let ordenesQuery = supabase.from('ordenes_servicio').select(`
      id, codigo, fecha_vigencia, fecha_entrega, observaciones, paciente_id, cliente_id,
      cliente:clientes(id, nombre, tipo_persona, nit_cc, direccion, telefono, municipio:municipios(nombre)),
      paciente:pacientes(id, nombre, direccion, telefono, ciudad),
      repartidor:usuarios!ordenes_servicio_repartidor_id_fkey(id, nombre),
      estado:estados_orden(id, nombre),
      equipos:orden_equipos(
        id, equipo_id,
        equipo:equipos(id, codigo,
          tipo_equipo:tipos_equipo(id, nombre, atributos)
        )
      ),
      plantillas:orden_plantillas(
        id, plantilla_id, firmado, firmado_por, firma_iniciales, fecha_firma,
        plantilla:plantillas_orden(id, nombre, contenido)
      )
    `).eq('estado_id', '9430f8fe-008f-494e-ada5-3c667799b26c').order('fecha_entrega', { ascending: true })

  // Un repartidor solo ve sus propias entregas/órdenes asignadas — el admin las ve todas
  if (esRepartidor) {
    entregasQuery = entregasQuery.eq('repartidor_id', usuario.id)
    ordenesQuery  = ordenesQuery.eq('repartidor_id', usuario.id)
  }

  const [
    { data: entregas },
    { data: ordenes },
    { data: estados },
    { data: estadosEquipo },
    { data: empresa },
  ] = await Promise.all([
    entregasQuery,
    ordenesQuery,
    supabase.from('estados_entrega').select('*').order('nombre'),
    supabase.from('estados_equipo').select('*').order('nombre'),
    supabase.from('configuracion_empresa').select('*').single(),
  ])

  if (esRepartidor) {
    return (
      <EntregasRepartidorClient
        nombreRepartidor={usuario?.nombre || ''}
        entregasIniciales={entregas || []}
        ordenesAsignadas={ordenes || []}
        estadosEquipo={estadosEquipo || []}
      />
    )
  }

  return (
    <EntregasClient
      entregasIniciales={entregas || []}
      ordenesEnReparto={ordenes || []}
      estados={estados || []}
      estadosEquipo={estadosEquipo || []}
      empresa={empresa || {}}
    />
  )
}
