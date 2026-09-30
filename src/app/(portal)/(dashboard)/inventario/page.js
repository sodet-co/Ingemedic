import { createClient } from '@/lib/supabase-server'
import { traerTodosLosEquipos } from '@/lib/equipos'
import InventarioClient from './InventarioClient'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export default async function InventarioPage() {
  const supabase = await createClient()

  const [
    { data: categorias },
    { data: tipos },
    equipos,
    { data: estados },
  ] = await Promise.all([
    supabase.from('categorias_equipo')
      .select('id, nombre, descripcion, imagen_url, atributos_extra')
      .eq('activo', true).order('nombre'),
    supabase.from('tipos_equipo')
      .select('id, nombre, imagen_url, atributos, categoria_id, lista_mantenimiento_id, categoria:categorias_equipo(id, nombre, imagen_url, atributos_extra)')
      .eq('activo', true).order('nombre'),
    traerTodosLosEquipos(supabase, q => q
      .select('*, estado:estados_equipo(id, nombre), tipo_equipo:tipos_equipo(id, nombre, imagen_url, atributos, categoria_id), paciente_actual:pacientes(id, nombre, direccion, ciudad, telefono), cliente_actual:clientes(id, nombre)')
      .order('fecha_creacion', { ascending: false })),
    supabase.from('estados_equipo').select('*').order('nombre'),
  ])

  return (
    <InventarioClient
      categorias={categorias || []}
      tipos={tipos || []}
      equipos={equipos || []}
      estados={estados || []}
    />
  )
}