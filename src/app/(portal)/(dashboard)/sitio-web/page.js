import { createClient } from '@supabase/supabase-js'
import { redirect } from 'next/navigation'
import { verificarSesion } from '@/lib/api-auth'
import { resumenInteresWeb } from '@/lib/interes-web'
import SitioWebClient from './SitioWebClient'

export const dynamic = 'force-dynamic'
export const revalidate = 0

// Módulo "Página web": cómo le va al sitio público (clics en WhatsApp y
// formularios). SOLO SuperAdmin. No está en la tabla `permisos`: la
// restricción vive aquí y en el Sidebar. La tabla `eventos_sitio` solo tiene
// una política de lectura para SuperAdmin (la necesita el tiempo real); los
// datos se consultan con service_role DESPUÉS de confirmar el rol.
export default async function SitioWebPage() {
  const { usuario } = await verificarSesion()
  if (!usuario?.esSuperAdmin) redirect('/dashboard')

  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )

  return <SitioWebClient datos={await resumenInteresWeb(admin)} />
}
