import { createServerClient } from '@supabase/ssr'
import { NextResponse } from 'next/server'
import { esSuperAdmin, moduloDeRuta, puedeVerModulo, primerModuloPermitido, MODULOS_RUTA } from '@/lib/permisos'
import { SITIO_URL, PORTAL_URL, esRutaPortal } from '@/lib/sitio'

// Duración máxima de una sesión, sin importar actividad — la sesión de
// Supabase se renueva sola indefinidamente (el cliente refresca el JWT).
// Se mide desde `user.last_sign_in_at`: Supabase lo fija al iniciar sesión
// con contraseña y NO cambia al refrescar el token, y viene verificado del
// servidor de Auth. Antes se usaba una cookie puesta por el navegador
// (`sesion_inicio`): bastaba borrarla para que el conteo arrancara de nuevo.
const SESION_MAX_MS = 8 * 60 * 60 * 1000 // 8 horas
const COOKIE_VIEJA  = 'sesion_inicio'

export async function middleware(request) {
  const { pathname, search } = request.nextUrl

  // ── SEPARACIÓN POR DOMINIO ────────────────────────────────────────────
  // portal.ingemedic.com.co → solo el panel · www.ingemedic.com.co → solo el
  // sitio público · cualquier otro host (localhost, *.vercel.app) → todo,
  // para poder desarrollar y revisar previews. portal.localhost:3000 sirve
  // para probar el comportamiento del portal en local.
  const host     = (request.headers.get('host') || '').toLowerCase()
  const enPortal = host.startsWith('portal.')
  const enSitio  = host === 'www.ingemedic.com.co' || host === 'ingemedic.com.co'
  const rutaPanel = esRutaPortal(pathname)

  // Enlaces y accesos directos viejos (/admin/...) → la misma ruta sin el
  // prefijo; si venían del dominio público, en el portal.
  if (pathname === '/admin' || pathname.startsWith('/admin/')) {
    const ruta = pathname.slice('/admin'.length) || '/'
    return NextResponse.redirect(new URL(ruta + search, enSitio ? PORTAL_URL : request.url))
  }
  if (enSitio && rutaPanel) {
    return NextResponse.redirect(new URL(pathname + search, PORTAL_URL))
  }
  if (enPortal && !rutaPanel && pathname !== '/') {
    return NextResponse.redirect(new URL(pathname + search, SITIO_URL))
  }

  // Páginas públicas: sin consultar Supabase (la landing es estática y no
  // debe pagar una consulta de sesión por visita).
  if (!rutaPanel && !enPortal) {
    return NextResponse.next()
  }

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

  const esRutaAdmin = rutaPanel
  const esLogin     = pathname === '/login'

  // Raíz del portal → login, o el dashboard si ya hay sesión
  if (enPortal && pathname === '/') {
    return NextResponse.redirect(new URL(user ? '/dashboard' : '/login', request.url))
  }

  // Sin sesión, intentando entrar a una ruta del panel que no sea el login → al login
  if (esRutaAdmin && !esLogin && !user) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  // Con sesión, intentando ver el login → directo al dashboard
  if (esLogin && user) {
    return NextResponse.redirect(new URL('/dashboard', request.url))
  }

  // Cierra la sesión y manda al login con un aviso (?expirada=1 / ?inactivo=1).
  // signOut() escribe las cookies de sesión vaciadas en `response`; hay que
  // copiarlas al redirect, o el navegador se quedaría con la sesión vieja.
  async function cerrarSesion(motivo) {
    await supabase.auth.signOut()
    const salida = NextResponse.redirect(new URL(`/login?${motivo}=1`, request.url))
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
  // Se salta en login. /sin-acceso sí pasa por aquí (para mandar al cliente a
  // /cliente): no tiene módulo mapeado, así que no genera loop para el personal.
  if (esRutaAdmin && !esLogin && user) {
    // Mismo id que auth.users; el email (sin importar mayúsculas) queda de
    // respaldo por usuarios viejos cuyo id no coincide — igual que api-auth.js.
    const COLUMNAS_USUARIO = 'rol_id, activo, roles (nombre)'
    let { data: usuario } = await supabase
      .from('usuarios').select(COLUMNAS_USUARIO).eq('id', user.id).maybeSingle()
    if (!usuario && user.email) {
      ;({ data: usuario } = await supabase
        .from('usuarios').select(COLUMNAS_USUARIO).ilike('email', user.email).maybeSingle())
    }

    const esRutaCliente = pathname === '/cliente' || pathname.startsWith('/cliente/')

    // ── PORTAL DE CLIENTES ──
    // Una sesión que no es del personal puede ser la cuenta de un cliente
    // (clientes.auth_user_id, creada desde Clientes → Acceso al portal). El
    // cliente solo ve /cliente; lo que lee lo limita RLS (mi_cliente_id()).
    if (!usuario) {
      const { data: cliente } = await supabase
        .from('clientes').select('id, activo').eq('auth_user_id', user.id).maybeSingle()
      // Ni personal ni cliente (o cliente desactivado): antes pasaba sin
      // ninguna restricción de módulos. Ahora se cierra la sesión.
      if (!cliente || cliente.activo === false) return cerrarSesion('inactivo')
      if (!esRutaCliente) return NextResponse.redirect(new URL('/cliente', request.url))
      return response
    }

    // El personal no tiene nada que hacer en el portal de clientes
    if (esRutaCliente) {
      return NextResponse.redirect(new URL('/dashboard', request.url))
    }

    // Usuario desactivado en Configuración → fuera. Desde 2026-09-25 además
    // se bloquea en Supabase Auth (/api/usuarios), pero esto cubre sesiones
    // que ya estaban abiertas al momento de desactivarlo.
    if (usuario.activo === false) {
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
          return NextResponse.redirect(new URL(rutaDestino || '/sin-acceso', request.url))
        }
      }
    }
  }

  return response
}

// Todo menos /api, los estáticos de Next y archivos con extensión (imágenes,
// robots.txt, sitemap.xml, favicon…).
export const config = {
  matcher: ['/((?!api|_next/static|_next/image|.*\\..*).*)'],
}
