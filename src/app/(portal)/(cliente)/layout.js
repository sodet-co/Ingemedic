import { redirect } from 'next/navigation'
import { Manrope, JetBrains_Mono } from 'next/font/google'
import { createClient } from '@/lib/supabase-server'

// Tipografías del portal de clientes (solo se cargan aquí)
const manrope = Manrope({ subsets: ['latin'], weight: ['400', '500', '600', '700', '800'], variable: '--font-manrope', display: 'swap' })
const jetbrains = JetBrains_Mono({ subsets: ['latin'], weight: ['500', '600'], variable: '--font-jetbrains', display: 'swap' })

// Layout del portal de clientes — sin el sidebar del personal. El encabezado
// vive en la propia página (bloque azul con el saludo). Que aquí solo llegue
// un cliente lo garantiza middleware.js; lo que puede leer, RLS.
export default async function ClienteLayout({ children }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login?cliente=1')

  const { data: cliente } = await supabase
    .from('clientes').select('id').eq('auth_user_id', user.id).maybeSingle()
  if (!cliente) redirect('/login?cliente=1')

  return (
    <div className={`${manrope.variable} ${jetbrains.variable} min-h-[100dvh] bg-[#F4F6FA] text-[#0F1E36]`}
      style={{ fontFamily: 'var(--font-manrope), system-ui, sans-serif' }}>
      {children}
    </div>
  )
}
