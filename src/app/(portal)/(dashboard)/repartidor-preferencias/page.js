import { createClient } from '@/lib/supabase-server'
import { redirect } from 'next/navigation'
import RepartidorPreferenciasClient from './RepartidorPreferenciasClient'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export default async function RepartidorPreferenciasPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: usuario } = await supabase
    .from('usuarios')
    .select('id, nombre, email, username, roles (nombre)')
    .eq('email', user.email)
    .single()

  return <RepartidorPreferenciasClient usuario={usuario} />
}
