import { createClient } from '@/lib/supabase-server'
import { traerTodosLosEquipos } from '@/lib/equipos'
import { SELECT_EQUIPO_MANT, SELECT_MANTENIMIENTO } from '@/lib/mantenimientos'
import MantenimientosClient from './MantenimientosClient'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export default async function MantenimientosPage() {
  const supabase = await createClient()

  const [
    { data: mantenimientos },
    equipos,
    { data: listas },
    { data: categorias },
    { data: tiposEquipo },
  ] = await Promise.all([
    supabase.from('mantenimientos').select(SELECT_MANTENIMIENTO).order('fecha_creacion', { ascending: false }),
    traerTodosLosEquipos(supabase, q => q.select(SELECT_EQUIPO_MANT).order('codigo')),
    supabase.from('listas_mantenimiento').select(`
      id, nombre, descripcion,
      actividades:actividades_lista_mantenimiento(id, nombre, orden)
    `).eq('activo', true).order('nombre'),
    supabase.from('categorias_equipo').select('id, nombre, imagen_url, atributos_extra').eq('activo', true).order('nombre'),
    supabase.from('tipos_equipo').select('id, nombre, atributos, categoria_id, imagen_url').eq('activo', true).order('nombre'),
  ])

  return (
    <MantenimientosClient
      mantenimientosIniciales={mantenimientos || []}
      equipos={equipos || []}
      listas={listas || []}
      categorias={categorias || []}
      tiposEquipo={tiposEquipo || []}
    />
  )
}
