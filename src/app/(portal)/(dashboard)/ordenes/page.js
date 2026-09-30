import { createClient } from '@/lib/supabase-server'
import { traerTodosLosEquipos } from '@/lib/equipos'
import OrdenesClient from './OrdenesClient'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export default async function OrdenesPage() {
  const supabase = await createClient()

  const resultados = await Promise.all([
    supabase.from('ordenes_servicio').select(`
      *,
      cliente:clientes(id, nombre, tipo_persona, nit_cc),
      paciente:pacientes(id, nombre, cedula, direccion),
      estado:estados_orden(id, nombre),
      repartidor:usuarios!ordenes_servicio_repartidor_id_fkey(id, nombre),
      equipos:orden_equipos(
        id, equipo_id, fecha_entrega, fecha_devolucion, observaciones_devolucion,
        equipo:equipos(
          id, codigo,
          tipo_equipo:tipos_equipo(id, nombre, atributos,
            categoria:categorias_equipo(id, nombre)
          )
        )
      ),
      plantillas:orden_plantillas(
        id, plantilla_id, firmado, firmado_por, firma_iniciales, fecha_firma,
        plantilla:plantillas_orden(id, nombre)
      )
    `).order('fecha_creacion', { ascending: false }),
    supabase.from('clientes').select('id, nombre, tipo_persona, nit_cc').eq('activo', true).order('nombre'),
    supabase.from('pacientes').select('*').eq('activo', true).order('nombre'),
    supabase.from('estados_orden').select('*').order('nombre'),
    supabase.from('estados_equipo').select('*').order('nombre'),
    supabase.from('plantillas_orden').select('id, nombre, descripcion').eq('activo', true).order('nombre'),
    traerTodosLosEquipos(supabase, q => q.select(`
      id, codigo, tipo_equipo_id, atributos,
      tipo_equipo:tipos_equipo(id, nombre, atributos,
        categoria:categorias_equipo(id, nombre)
      ),
      estado:estados_equipo(id, nombre)
    `).order('codigo'))
      .then(data => ({ data, error: null }))
      .catch(error => ({ data: null, error })),
    supabase.from('usuarios').select('id, nombre').eq('activo', true).eq('rol_id', '17cd4f56-cae6-4efd-971b-2f8875f1f633').order('nombre'),
    supabase.from('tipos_orden').select('id, nombre').eq('activo', true).order('nombre'),
    supabase.from('categorias_equipo').select('id, nombre, imagen_url, atributos_extra').eq('activo', true).order('nombre'),
    supabase.from('tipos_equipo').select('id, nombre, atributos, categoria_id, imagen_url').eq('activo', true).order('nombre'),
    supabase.from('estados_entrega').select('id, nombre').order('nombre'),
  ])

  const NOMBRES_CONSULTAS = [
    'ordenes_servicio', 'clientes', 'pacientes', 'estados_orden', 'estados_equipo',
    'plantillas_orden', 'equipos', 'usuarios', 'tipos_orden', 'categorias_equipo',
    'tipos_equipo', 'estados_entrega',
  ]
  resultados.forEach(({ error }, i) => {
    if (error) console.error(`[ordenes/page.js] Error consultando ${NOMBRES_CONSULTAS[i]}:`, error.message)
  })

  const [
    { data: ordenes },
    { data: clientes },
    { data: pacientes },
    { data: estados },
    { data: estadosEquipo },
    { data: plantillas },
    { data: equipos },
    { data: usuarios },
    { data: tipos },
    { data: categorias },
    { data: tiposEquipo },
    { data: estadosEntrega },
  ] = resultados

  return (
    <OrdenesClient
      ordenesIniciales={ordenes || []}
      clientes={clientes || []}
      pacientes={pacientes || []}
      estados={estados || []}
      estadosEquipo={estadosEquipo || []}
      plantillas={plantillas || []}
      equipos={equipos || []}
      usuarios={usuarios || []}
      tipos={tipos || []}
      categorias={categorias || []}
      tiposEquipo={tiposEquipo || []}
      estadosEntrega={estadosEntrega || []}
    />
  )
}