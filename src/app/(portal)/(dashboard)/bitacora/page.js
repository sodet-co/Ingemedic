import { createClient } from '@/lib/supabase-server'
import BitacoraClient from './BitacoraClient'

export default async function BitacoraPage() {
  const supabase = await createClient()

  const { data: registros } = await supabase
    .from('bitacora')
    .select(`
      *,
      usuario:usuarios(id, nombre)
    `)
    .order('fecha', { ascending: false })
    .limit(500)

  return <BitacoraClient registrosIniciales={registros || []} />
}