import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

// Ruta PÚBLICA a propósito: el sitio público (sin sesión) registra aquí los
// clics en botones de WhatsApp y los envíos del formulario de contacto, para
// mostrarlos en el dashboard del panel. Se guarda en `eventos_sitio` con
// service_role (la tabla no tiene política de escritura para anon).
// No guarda IP ni ningún dato de la persona: solo qué botón y en qué página.

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } }
)

// Solo se acepta lo que el sitio realmente envía (ver src/lib/analitica.js)
const ORIGENES = {
  whatsapp_clic: [
    'flotante', 'inicio_hero', 'footer', 'contacto', 'contacto_error_formulario',
    'portafolio_equipo', 'portafolio_asesoria',
  ],
  contacto_enviado: ['formulario'],
}

export async function POST(request) {
  let body
  try { body = await request.json() } catch { body = null }

  const evento = body?.evento
  const origen = body?.origen
  if (!ORIGENES[evento]?.includes(origen)) {
    return NextResponse.json({ ok: false }, { status: 400 })
  }

  const texto = (valor, max) => String(valor ?? '').trim().slice(0, max) || null
  const { error } = await supabaseAdmin.from('eventos_sitio').insert({
    evento,
    origen,
    pagina: texto(body.pagina, 120),
    detalle: texto(body.detalle, 120),
  })
  if (error) {
    console.error('[evento] No se pudo guardar', error.message)
    return NextResponse.json({ ok: false }, { status: 500 })
  }
  return NextResponse.json({ ok: true })
}
