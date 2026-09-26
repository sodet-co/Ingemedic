import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'
import { esSuperAdmin, puedeVerModulo } from '@/lib/permisos'

// Verificación de sesión para las rutas /api/*.
//
// El middleware solo cubre /admin/* (matcher), así que las rutas de API no
// tienen ninguna protección por sí solas — y todas usan service_role, que se
// salta RLS. Sin esto, cualquiera sin sesión podía descargar el Excel de
// clientes/pacientes o crear un usuario SuperAdmin.
//
// Uso, al inicio de cada handler:
//   const { usuario, respuesta } = await verificarSesion({ modulos: ['clientes'] })
//   if (respuesta) return respuesta
//
// `modulos` usa los mismos nombres y la misma regla (puedeVerModulo) que el
// middleware y el Sidebar, para que la API no permita lo que la pantalla
// oculta. SuperAdmin es inmune, igual que en el resto del sistema.
export async function verificarSesion({ modulos = [] } = {}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return { respuesta: NextResponse.json({ error: 'Sesión no válida. Vuelve a iniciar sesión.' }, { status: 401 }) }
  }

  // Mismo id que auth.users (así los crea /api/usuarios); el email queda de
  // respaldo, igual que en el middleware, por si algún usuario viejo no coincide.
  let { data: usuario } = await supabase
    .from('usuarios').select('id, activo, rol_id, rol:roles(nombre)')
    .eq('id', user.id).maybeSingle()
  if (!usuario && user.email) {
    ;({ data: usuario } = await supabase
      .from('usuarios').select('id, activo, rol_id, rol:roles(nombre)')
      .ilike('email', user.email).maybeSingle())
  }
  if (!usuario || usuario.activo === false) {
    return { respuesta: NextResponse.json({ error: 'Tu usuario no tiene acceso al sistema.' }, { status: 403 }) }
  }

  const superAdmin = esSuperAdmin(usuario.rol?.nombre)
  if (modulos.length && !superAdmin) {
    const { data: permisosDelRol } = await supabase
      .from('permisos').select('modulo, puede_ver').eq('rol_id', usuario.rol_id)
    if (!modulos.every(m => puedeVerModulo(m, permisosDelRol))) {
      return { respuesta: NextResponse.json({ error: 'No tienes permiso para esta acción.' }, { status: 403 }) }
    }
  }

  return { usuario: { ...usuario, esSuperAdmin: superAdmin } }
}
