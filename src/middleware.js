import { createServerClient } from '@supabase/ssr'
import { NextResponse } from 'next/server'
import { esSuperAdmin, moduloDeRuta, puedeVerModulo, primerModuloPermitido, MODULOS_RUTA } from '@/lib/permisos'

// Duración máxima de una sesión, sin importar actividad — hasta ahora la
// sesión de Supabase se renovaba sola indefinidamente (el cliente refresca
// el JWT solo) y la única forma de salir era el botón "Cerrar sesión".
// La marca de inicio la pone src/app/admin/(auth)/login/page.js en una
// cookie de texto plano (no httpOnly: solo la lee este middleware para
// medir cuánto ha pasado, no protege nada por sí misma).
const SESION_COOKIE = 'sesion_inicio'
const SESION_MAX_MS = 8 * 60 * 60 * 1000 // 8 horas

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

  // ── LÍMITE ABSOLUTO DE SESIÓN (8h desde el login, sin importar actividad) ──
  if (esRutaAdmin && !esLogin && user) {
    const inicio = request.cookies.get(SESION_COOKIE)?.value
    if (inicio && Date.now() - Number(inicio) > SESION_MAX_MS) {
      await supabase.auth.signOut()
      const salida = NextResponse.redirect(new URL('/admin/login?expirada=1', request.url))
      salida.cookies.delete(SESION_COOKIE)
      return salida
    }
    // Sesiones que ya existían antes de esta cookie (o que la perdieron por
    // algún motivo) arrancan el conteo de nuevo en vez de cerrarse de una —
    // no tiene sentido expulsar de golpe a alguien que ya estaba adentro.
    if (!inicio) {
      response.cookies.set(SESION_COOKIE, String(Date.now()), { path: '/', maxAge: 60 * 60 * 24 })
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
      .select('rol_id, roles (nombre)')
      .eq('email', user.email)
      .single()

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
