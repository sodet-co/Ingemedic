import { createClient } from '@/lib/supabase-server'
import { traerTodosLosEquipos } from '@/lib/equipos'
import ClientesClient from './ClientesClient'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export default async function ClientesPage() {
  const supabase = await createClient()

  const [
    { data: clientes },
    { data: clientesInactivos },
    { data: departamentos },
    { data: municipios },
    { data: pacientes },
    equiposConPaciente,
    equiposConCliente,
  ] = await Promise.all([
    supabase.from('clientes')
      .select('*, municipio:municipios(id, nombre), departamento:departamentos(id, nombre)')
      .eq('activo', true)
      .order('nombre'),
    supabase.from('clientes')
      .select('*, municipio:municipios(id, nombre), departamento:departamentos(id, nombre)')
      .eq('activo', false)
      .order('nombre'),
    supabase.from('departamentos').select('*').eq('activo', true).order('nombre'),
    supabase.from('municipios').select('*').eq('activo', true).order('nombre'),
    supabase.from('pacientes').select('*').order('nombre'),
    traerTodosLosEquipos(supabase, q => q
      .select(`
        id, codigo, atributos, paciente_actual_id,
        tipo_equipo:tipos_equipo(nombre, imagen_url, categoria_id, categoria:categorias_equipo(id, nombre, imagen_url)),
        cliente_actual:clientes(id, nombre)
      `)
      .not('paciente_actual_id', 'is', null)),
    traerTodosLosEquipos(supabase, q => q
      .select('id, cliente_actual_id')
      .not('cliente_actual_id', 'is', null)),
  ])

  return (
    <ClientesClient
      clientesIniciales={clientes || []}
      clientesInactivosIniciales={clientesInactivos || []}
      departamentos={departamentos || []}
      municipios={municipios || []}
      pacientesIniciales={pacientes || []}
      equiposConPaciente={equiposConPaciente || []}
      equiposConCliente={equiposConCliente || []}
    />
  )
}