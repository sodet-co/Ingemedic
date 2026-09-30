import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase-server'
import ClienteHeader from '@/components/layout/ClienteHeader'

// Layout del portal de clientes — sin el sidebar del personal. Que aquí solo
// llegue un cliente lo garantiza middleware.js; lo que puede leer, RLS.
export default async function ClienteLayout({ children }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login?cliente=1')

  const { data: cliente } = await supabase
    .from('clientes').select('id, nombre').eq('auth_user_id', user.id).maybeSingle()
  if (!cliente) redirect('/login?cliente=1')

  return (
    <div className="min-h-[100dvh] flex flex-col bg-[#F8FAFC]">
      <ClienteHeader nombre={cliente.nombre} />
      <main className="flex-1">{children}</main>
    </div>
  )
}
