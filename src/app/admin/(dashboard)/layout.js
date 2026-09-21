import { createClient } from '@/lib/supabase-server'
import { redirect } from 'next/navigation'
import Sidebar from '@/components/layout/Sidebar'
import RepartidorHeader from '@/components/layout/RepartidorHeader'
import { esSuperAdmin } from '@/lib/permisos'
import { UsuarioProvider } from '@/lib/usuario-context'

export default async function DashboardLayout({ children }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/admin/login')

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

  // El rol Repartidor tiene un layout dedicado, sin el sidebar/navegación de admin
  // (la restricción de qué rutas puede visitar vive en middleware.js).
  if (usuario?.roles?.nombre === 'Repartidor') {
    return (
      <RepartidorHeader logoUrl={empresa?.logo_url || '/logo.png'}>
        {children}
      </RepartidorHeader>
    )
  }

  // SuperAdmin no consulta permisos (es inmune) — para el resto de roles,
  // el Sidebar necesita saber qué módulos ocultar.
  const superAdmin = esSuperAdmin(usuario?.roles?.nombre)
  const { data: permisos } = superAdmin
    ? { data: [] }
    : await supabase.from('permisos').select('modulo, puede_ver').eq('rol_id', usuario?.rol_id)

  return (
    <div className="flex h-screen overflow-hidden bg-[#F8FAFC]">
      <Sidebar usuario={usuario} empresa={empresa} permisos={permisos || []} esSuperAdmin={superAdmin} />
      <UsuarioProvider usuario={usuario} esSuperAdmin={superAdmin}>
        <main className="flex-1 min-w-0 flex flex-col h-screen overflow-hidden pt-12 md:pt-0 pb-[var(--mobile-nav-space,0px)] md:pb-0">
          {children}
        </main>
      </UsuarioProvider>
    </div>
  )
}