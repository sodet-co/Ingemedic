import { createClient } from '@/lib/supabase-server'
import ServiciosClient from './ServiciosClient'

export default async function ServiciosPage() {
  const supabase = await createClient()

  const { data: servicios } = await supabase
    .from('servicios_prestados')
    .select('*')
    .order('fecha_entrega', { ascending: false })

  return <ServiciosClient serviciosIniciales={servicios || []} />
}