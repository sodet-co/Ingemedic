import { createClient } from '@/lib/supabase-server'
import { traerTodosLosEquipos } from '@/lib/equipos'
import MantenimientosClient from './MantenimientosClient'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export default async function MantenimientosPage() {
  const supabase = await createClient()

  const [
    { data: mantenimientos },
    { data: tipos },
    equipos,
    { data: listas },
  ] = await Promise.all([
    supabase.from('mantenimientos').select(`
      *,
      equipo:equipos(
        id, codigo,
        tipo_equipo:tipos_equipo(id, nombre, atributos,
          categoria:categorias_equipo(id, nombre)
        ),
        estado:estados_equipo(id, nombre)
      ),
      estado:estados_mantenimiento(id, nombre),
      tipo:tipos_mantenimiento(id, nombre),
      actividades:actividades_mantenimiento(
        id, descripcion, completado, observaciones, fecha, archivo_url,
        adjuntos:adjuntos_actividad_mantenimiento(id, nombre, url, tipo)
      )
    `).order('fecha_creacion', { ascending: false }),
    supabase.from('tipos_mantenimiento').select('*').eq('activo', true).order('nombre'),
    traerTodosLosEquipos(supabase, q => q.select(`
      id, codigo,
      tipo_equipo:tipos_equipo(id, nombre, atributos,
        categoria:categorias_equipo(id, nombre)
      ),
      estado:estados_equipo(id, nombre)
    `).order('codigo')),
    supabase.from('listas_mantenimiento').select(`
      id, nombre, descripcion,
      actividades:actividades_lista_mantenimiento(id, nombre, orden)
    `).eq('activo', true).order('nombre'),
  ])

  return (
    <MantenimientosClient
      mantenimientosIniciales={mantenimientos || []}
      tipos={tipos || []}
      equipos={equipos || []}
      listas={listas || []}
    />
  )
}