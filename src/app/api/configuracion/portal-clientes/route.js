import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import { verificarSesion } from '@/lib/api-auth'
import { portalClientesActivo, ROL_CLIENTE_ID, MODULO_PORTAL } from '@/lib/portalClientes'

// Estado del portal de clientes (permiso 'portal_clientes' del rol Cliente).
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } }
)

// Público: lo consulta el login (sin sesión) para avisar en "Soy cliente".
// Solo dice si está activo; no expone nada más.
export async function GET() {
  return NextResponse.json({ activo: await portalClientesActivo(supabaseAdmin) })
}

// Activar o bloquear. Solo SuperAdmin.
export async function PUT(request) {
  try {
    const { usuario, respuesta } = await verificarSesion()
    if (respuesta) return respuesta
    if (!usuario.esSuperAdmin) {
      return NextResponse.json({ error: 'Solo un SuperAdmin puede bloquear o activar el portal de clientes.' }, { status: 403 })
    }

    const { activo } = await request.json()
    if (typeof activo !== 'boolean') return NextResponse.json({ error: 'Valor inválido.' }, { status: 400 })

    const { data: fila, error: errLeer } = await supabaseAdmin.from('permisos').select('id')
      .eq('rol_id', ROL_CLIENTE_ID).eq('modulo', MODULO_PORTAL).maybeSingle()
    if (errLeer) return NextResponse.json({ error: errLeer.message }, { status: 500 })

    const { error } = fila
      ? await supabaseAdmin.from('permisos').update({ puede_ver: activo }).eq('id', fila.id)
      : await supabaseAdmin.from('permisos').insert({
          rol_id: ROL_CLIENTE_ID, modulo: MODULO_PORTAL, puede_ver: activo,
          puede_crear: false, puede_editar: false, puede_eliminar: false,
        })
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    return NextResponse.json({ activo })
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
