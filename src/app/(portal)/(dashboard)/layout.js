import { createClient } from '@/lib/supabase-server'
import { redirect } from 'next/navigation'
import Sidebar from '@/components/layout/Sidebar'
import RepartidorHeader from '@/components/layout/RepartidorHeader'
import BannerAtencion from '@/components/layout/BannerAtencion'
import PiePanel from '@/components/layout/PiePanel'
import { esSuperAdmin } from '@/lib/permisos'
import { UsuarioProvider } from '@/lib/usuario-context'
import TemaPanel from '@/components/layout/TemaPanel'
import { scriptTema } from '@/lib/tema'

export default async function DashboardLayout({ children }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const { data: usuario } = await supabase
    .from('usuarios')
    .select(`
    id,
    nombre,
    email,
    username,
    rol_id,
    roles (
      nombre
    )
  `)
  .eq('email', user.email)
    .single()

  const { data: empresa } = await supabase
    .from('configuracion_empresa')
    .select('logo_url, razon_social')
    .single()

  // Tema oscuro: el script corre antes de pintar (sin destello claro) y
  // TemaPanel lo mantiene al día. Los colores solo aplican dentro de .panel-app.
  // Consulta aparte y tolerante: si la columna `tema` aún no existe, el panel
  // sigue funcionando con lo guardado en el navegador.
  const { data: pref } = usuario?.id
    ? await supabase.from('usuarios').select('tema').eq('id', usuario.id).maybeSingle()
    : { data: null }
  const tema = <><script dangerouslySetInnerHTML={{ __html: scriptTema(pref?.tema) }} /><TemaPanel temaUsuario={pref?.tema} /></>

  // El rol Repartidor tiene un layout dedicado, sin el sidebar/navegación de admin
  // (la restricción de qué rutas puede visitar vive en middleware.js).
  if (usuario?.roles?.nombre === 'Repartidor') {
    return (
      <div className="panel-app">
        {tema}
        <RepartidorHeader logoUrl={empresa?.logo_url || '/images/logo.png'} nombre={usuario?.nombre}>
          {children}
        </RepartidorHeader>
      </div>
    )
  }

  // SuperAdmin no consulta permisos (es inmune) — para el resto de roles,
  // el Sidebar necesita saber qué módulos ocultar.
  const superAdmin = esSuperAdmin(usuario?.roles?.nombre)
  const { data: permisos } = superAdmin
    ? { data: [] }
    : await supabase.from('permisos').select('modulo, puede_ver').eq('rol_id', usuario?.rol_id)

  return (
    <div className="panel-app flex h-screen overflow-hidden bg-[#F8FAFC]">
      {tema}
      <Sidebar usuario={usuario} empresa={empresa} permisos={permisos || []} esSuperAdmin={superAdmin} />
      <UsuarioProvider usuario={usuario} esSuperAdmin={superAdmin}>
        <main className="flex-1 min-w-0 flex flex-col h-screen overflow-hidden pt-12 md:pt-0 pb-[var(--mobile-nav-space,0px)] md:pb-0">
          <BannerAtencion />
          {/* flex-1/min-h-0: las páginas de abajo miden su interior en h-full,
              no h-screen — así la franja de arriba les resta su espacio real
              en vez de que ambas peleen por el 100vh completo. */}
          <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
            {children}
          </div>
          <PiePanel />
        </main>
      </UsuarioProvider>
    </div>
  )
}