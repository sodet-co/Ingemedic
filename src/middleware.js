import { createServerClient } from '@supabase/ssr'
import { NextResponse } from 'next/server'
import { esSuperAdmin, moduloDeRuta, puedeVerModulo, primerModuloPermitido, MODULOS_RUTA } from '@/lib/permisos'

// Duración máxima de una sesión, sin importar actividad — la sesión de
// Supabase se renueva sola indefinidamente (el cliente refresca el JWT).
// Se mide desde `user.last_sign_in_at`: Supabase lo fija al iniciar sesión
// con contraseña y NO cambia al refrescar el token, y viene verificado del
// servidor de Auth. Antes se usaba una cookie puesta por el navegador
// (`sesion_inicio`): bastaba borrarla para que el conteo arrancara de nuevo.
const SESION_MAX_MS = 8 * 60 * 60 * 1000 // 8 horas
const COOKIE_VIEJA  = 'sesion_inicio'

export async function middleware(request) {
  let response = NextResponse.next({ request: { headers: request.headers } })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() { return request.cookies.getAll() },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          response = NextResponse.next({ request: { headers: request.headers } })
          cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options))
        },
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()
  const { pathname } = request.nextUrl

  const esRutaAdmin = pathname.startsWith('/admin')
  const esLogin     = pathname === '/admin/login'
  const esSinAcceso = pathname === '/admin/sin-acceso'

  // Sin sesión, intentando entrar a /admin/* que no sea el login → redirigir al login
  if (esRutaAdmin && !esLogin && !user) {
    return NextResponse.redirect(new URL('/admin/login', request.url))
  }

  // Con sesión, intentando ver el login → directo al dashboard
  if (esLogin && user) {
    return NextResponse.redirect(new URL('/admin/dashboard', request.url))
  }

  // Cierra la sesión y manda al login con un aviso (?expirada=1 / ?inactivo=1).
  // signOut() escribe las cookies de sesión vaciadas en `response`; hay que
  // copiarlas al redirect, o el navegador se quedaría con la sesión vieja.
  async function cerrarSesion(motivo) {
    await supabase.auth.signOut()
    const salida = NextResponse.redirect(new URL(`/admin/login?${motivo}=1`, request.url))
    response.cookies.getAll().forEach(c => salida.cookies.set(c))
    salida.cookies.delete(COOKIE_VIEJA)
    return salida
  }

  // ── LÍMITE ABSOLUTO DE SESIÓN (8h desde el login, sin importar actividad) ──
  if (esRutaAdmin && !esLogin && user) {
    const inicioMs = Date.parse(user.last_sign_in_at || '')
    if (inicioMs && Date.now() - inicioMs > SESION_MAX_MS) {
      return cerrarSesion('expirada')
    }
  }

  // ── CONTROL DE ACCESO POR ROL/MÓDULO ──────────────────────────────────
  // Reemplaza el caso hardcodeado de "Repartidor" — ahora es genérico para
  // cualquier rol, vía la tabla `permisos` (ver src/lib/permisos.js).
  // Se salta en login y en la propia página de "sin acceso" para no generar
  // un loop de redirecciones.
  if (esRutaAdmin && !esLogin && !esSinAcceso && user) {
    const { data: usuario } = await supabase
      .from('usuarios')
      .select('rol_id, activo, roles (nombre)')
      .eq('email', user.email)
      .single()

    // Usuario desactivado en Configuración → fuera. Desde 2026-09-25 además
    // se bloquea en Supabase Auth (/api/usuarios), pero esto cubre sesiones
    // que ya estaban abiertas al momento de desactivarlo.
    if (usuario?.activo === false) {
      return cerrarSesion('inactivo')
    }

    const rolNombre = usuario?.roles?.nombre

    // SuperAdmin es inmune a la tabla permisos — ni siquiera se consulta.
    if (usuario?.rol_id && !esSuperAdmin(rolNombre)) {
      const modulo = moduloDeRuta(pathname)
      // Rutas sin módulo mapeado (ej. la página personal de preferencias del
      // repartidor) no están sujetas a esta restricción.
      if (modulo) {
        const { data: permisosDelRol } = await supabase
          .from('permisos')
          .select('modulo, puede_ver')
          .eq('rol_id', usuario.rol_id)

        if (!puedeVerModulo(modulo, permisosDelRol)) {
          const moduloDestino = primerModuloPermitido(permisosDelRol)
          const rutaDestino   = moduloDestino ? MODULOS_RUTA.find(m => m.modulo === moduloDestino)?.ruta : null
          return NextResponse.redirect(new URL(rutaDestino || '/admin/sin-acceso', request.url))
        }
      }
    }
  }

  // Todo lo demás (landing pública "/", assets, API) pasa sin restricción
  return response
}

export const config = {
  matcher: ['/admin/:path*'],
}
