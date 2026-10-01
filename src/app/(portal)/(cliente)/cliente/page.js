import { redirect } from 'next/navigation'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase-server'
import { traerTodosLosEquipos } from '@/lib/equipos'
import PortalClienteClient from './PortalClienteClient'
import PortalBloqueado from './PortalBloqueado'
import { portalClientesActivo } from '@/lib/portalClientes'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export const metadata = { title: 'Portal de clientes | Ingemedic' }

// Lo que ve un cliente: los equipos que tiene hoy, los pacientes a los que
// están asignados y los mantenimientos de esos equipos. RLS ya limita todo a
// su cliente (mi_cliente_id()); además cada query filtra por su id, para no
// depender solo de las políticas.
export default async function PortalClientePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login?cliente=1')

  const { data: cliente } = await supabase
    .from('clientes').select('id, nombre, nit_cc, digito_verificacion').eq('auth_user_id', user.id).maybeSingle()
  if (!cliente) redirect('/login?cliente=1')

  // Portal bloqueado por un SuperAdmin: no se consulta nada más. El permiso
  // vive en `permisos`, que RLS no deja leer al cliente → service_role (solo servidor).
  const admin = createAdminClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })
  if (!(await portalClientesActivo(admin))) return <PortalBloqueado nombre={cliente.nombre} />

  const [equipos, { data: categorias }] = await Promise.all([
    traerTodosLosEquipos(supabase, q => q
      .select(`
        id, codigo, atributos,
        estado:estados_equipo(nombre),
        tipo_equipo:tipos_equipo(id, nombre, atributos, imagen_url, categoria_id),
        paciente_actual:pacientes(id, nombre, cedula, ciudad, direccion)
      `)
      .eq('cliente_actual_id', cliente.id)
      .order('codigo')),
    supabase.from('categorias_equipo').select('id, nombre, imagen_url'),
  ])

  // Mantenimientos de sus equipos, en lotes (un .in() con cientos de ids
  // no cabe en la URL).
  const ids = equipos.map(e => e.id)
  const lotes = []
  for (let i = 0; i < ids.length; i += 150) lotes.push(ids.slice(i, i + 150))
  const resultados = await Promise.all(lotes.map(lote => supabase
    .from('mantenimientos')
    .select('id, codigo, equipo_id, fecha_apertura, fecha_cierre, fecha_cierre_real, en_curso, tecnico, observaciones_cliente, estado:estados_mantenimiento(nombre)')
    .in('equipo_id', lote)))
  const mantenimientos = resultados.flatMap(r => r.data || [])

  return (
    <PortalClienteClient
      cliente={cliente}
      equipos={equipos}
      mantenimientos={mantenimientos}
      categorias={categorias || []}
    />
  )
}
