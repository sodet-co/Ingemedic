import { createClient } from '@/lib/supabase-server'
import { esSuperAdmin } from '@/lib/permisos'
import ConfiguracionClient from './ConfiguracionClient'

export default async function ConfiguracionPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const [
    { data: usuarios },
    { data: roles },
    { data: categorias },
    { data: tipos },
    { data: plantillas },
    { data: listas },
    { data: actividades },
    { data: empresa },
    { data: usuarioActual },
    { data: todosPermisos },
  ] = await Promise.all([
    supabase.from('usuarios').select('*, rol:roles(id, nombre)').order('nombre'),
    supabase.from('roles').select('*'),
    supabase.from('categorias_equipo').select('*').eq('activo', true).order('nombre'),
    supabase.from('tipos_equipo')
      .select('*, atributos, categoria:categorias_equipo(id, nombre, atributos_extra), lista:listas_mantenimiento(id, nombre)')
      .eq('activo', true)
      .order('nombre'),
    supabase.from('plantillas_orden').select('*').eq('eliminado', false).order('nombre'),
    supabase.from('listas_mantenimiento').select('*').eq('activo', true).order('nombre'),
    supabase.from('actividades_lista_mantenimiento').select('*').eq('activo', true).order('orden'),
    supabase.from('configuracion_empresa').select('*').single(),
    supabase.from('usuarios').select('rol_id, roles(nombre)').eq('email', user?.email).single(),
    supabase.from('permisos').select('*'),
  ])

  const superAdmin = esSuperAdmin(usuarioActual?.roles?.nombre)
  const permisosDelRolActual = superAdmin
    ? []
    : (todosPermisos || []).filter(p => p.rol_id === usuarioActual?.rol_id)

  return (
    <ConfiguracionClient
      usuariosIniciales={usuarios || []}
      roles={roles || []}
      categorias={categorias || []}
      tipos={tipos || []}
      plantillas={plantillas || []}
      listas={listas || []}
      actividades={actividades || []}
      empresaInicial={empresa || {}}
      esSuperAdmin={superAdmin}
      permisosDelRolActual={permisosDelRolActual}
      todosPermisosIniciales={todosPermisos || []}
    />
  )
}