import { createClient } from '@/lib/supabase-server'
import BitacoraClient from './BitacoraClient'

export default async function BitacoraPage() {
  const supabase = await createClient()

  const [{ data: registros }, { data: clientes }] = await Promise.all([
    supabase
      .from('bitacora')
      .select(`
        *,
        usuario:usuarios(id, nombre)
      `)
      .order('fecha', { ascending: false })
      .limit(500),

    // Solo para nombrar al cliente en "Creó un préstamo para…": el detalle
    // del registro guarda el id, no el nombre.
    supabase.from('clientes').select('id, nombre'),
  ])

  const nombresClientes = Object.fromEntries((clientes || []).map(c => [c.id, c.nombre]))

  return <BitacoraClient registrosIniciales={registros || []} nombresClientes={nombresClientes} />
}