import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import { verificarSesion } from '@/lib/api-auth'
import { portalClientesActivo, MENSAJE_PORTAL_BLOQUEADO } from '@/lib/portalClientes'

// Acceso de un cliente al portal (portal.ingemedic.com.co/cliente).
// La cuenta es un usuario de Supabase Auth enlazado en clientes.auth_user_id.
// NO va en `usuarios`: eso es lo que lo distingue del personal, y RLS
// (es_personal / mi_cliente_id) le deja leer solo lo suyo.

// Cliente admin con service_role — solo en el servidor
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } }
)

// Misma regla que la pantalla de Clientes
const MODULOS = ['clientes']

async function traerCliente(clienteId) {
  if (!clienteId) return { error: NextResponse.json({ error: 'Falta el cliente.' }, { status: 400 }) }
  const { data, error } = await supabaseAdmin
    .from('clientes').select('id, nombre, activo, auth_user_id').eq('id', clienteId).maybeSingle()
  if (error) {
    // 42703 = la columna auth_user_id aún no existe (falta correr el SQL)
    const msg = error.code === '42703'
      ? 'El acceso de clientes aún no está habilitado en la base de datos.'
      : error.message
    return { error: NextResponse.json({ error: msg }, { status: 500 }) }
  }
  if (!data) return { error: NextResponse.json({ error: 'Cliente no encontrado.' }, { status: 404 }) }
  return { cliente: data }
}

// Con el portal bloqueado (Configuración → Portal de clientes) no se crean,
// cambian ni quitan accesos
async function bloqueado() {
  if (await portalClientesActivo(supabaseAdmin)) return null
  return NextResponse.json({ error: MENSAJE_PORTAL_BLOQUEADO, bloqueado: true }, { status: 423 })
}

function validarClave(password) {
  if (!password || password.length < 8) return 'La contraseña debe tener al menos 8 caracteres.'
  return null
}

// Estado del acceso: con qué correo entra y cuándo fue la última vez
export async function GET(request) {
  try {
    const { respuesta } = await verificarSesion({ modulos: MODULOS })
    if (respuesta) return respuesta

    const { cliente, error } = await traerCliente(new URL(request.url).searchParams.get('cliente_id'))
    if (error) return error
    const portalBloqueado = !(await portalClientesActivo(supabaseAdmin))
    if (!cliente.auth_user_id) return NextResponse.json({ acceso: null, bloqueado: portalBloqueado })

    const { data, error: authError } = await supabaseAdmin.auth.admin.getUserById(cliente.auth_user_id)
    if (authError || !data?.user) return NextResponse.json({ acceso: null, bloqueado: portalBloqueado })

    return NextResponse.json({
      bloqueado: portalBloqueado,
      acceso: {
        email: data.user.email,
        creado: data.user.created_at,
        ultimo_ingreso: data.user.last_sign_in_at,
      },
    })
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

// Dar acceso: crea la cuenta y la enlaza al cliente
export async function POST(request) {
  try {
    const { respuesta } = await verificarSesion({ modulos: MODULOS })
    if (respuesta) return respuesta
    const enBloqueo = await bloqueado()
    if (enBloqueo) return enBloqueo

    const { cliente_id, email: emailCrudo, password } = await request.json()
    const email = (emailCrudo || '').trim().toLowerCase()
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json({ error: 'Escribe un correo válido.' }, { status: 400 })
    }
    const errorClave = validarClave(password)
    if (errorClave) return NextResponse.json({ error: errorClave }, { status: 400 })

    const { cliente, error } = await traerCliente(cliente_id)
    if (error) return error
    if (cliente.activo === false) {
      return NextResponse.json({ error: 'El cliente está desactivado. Actívalo primero.' }, { status: 400 })
    }
    if (cliente.auth_user_id) {
      return NextResponse.json({ error: 'Este cliente ya tiene acceso.' }, { status: 409 })
    }

    // Un correo del personal no puede ser a la vez cuenta de cliente: el
    // personal ve todo, y el cliente terminaría entrando con esos permisos.
    const { data: delPersonal } = await supabaseAdmin
      .from('usuarios').select('id').ilike('email', email).maybeSingle()
    if (delPersonal) {
      return NextResponse.json({ error: 'Ese correo es de un usuario del personal. Usa otro.' }, { status: 409 })
    }

    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      app_metadata: { tipo: 'cliente', cliente_id: cliente.id },
    })
    if (authError) {
      const yaExiste = /already|registered|exists/i.test(authError.message)
      return NextResponse.json({
        error: yaExiste ? 'Ya existe una cuenta con ese correo. Usa otro.' : authError.message,
      }, { status: 400 })
    }

    const { error: dbError } = await supabaseAdmin
      .from('clientes').update({ auth_user_id: authData.user.id }).eq('id', cliente.id)
    if (dbError) {
      // Sin el enlace la cuenta no sirve: se borra para no dejarla suelta
      await supabaseAdmin.auth.admin.deleteUser(authData.user.id)
      return NextResponse.json({ error: dbError.message }, { status: 400 })
    }

    return NextResponse.json({ acceso: { email, creado: authData.user.created_at, ultimo_ingreso: null } })
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

// Cambiar la contraseña (el cliente no puede recuperarla solo)
export async function PUT(request) {
  try {
    const { respuesta } = await verificarSesion({ modulos: MODULOS })
    if (respuesta) return respuesta
    const enBloqueo = await bloqueado()
    if (enBloqueo) return enBloqueo

    const { cliente_id, password } = await request.json()
    const errorClave = validarClave(password)
    if (errorClave) return NextResponse.json({ error: errorClave }, { status: 400 })

    const { cliente, error } = await traerCliente(cliente_id)
    if (error) return error
    if (!cliente.auth_user_id) return NextResponse.json({ error: 'Este cliente no tiene acceso.' }, { status: 400 })

    const { error: authError } = await supabaseAdmin.auth.admin.updateUserById(cliente.auth_user_id, { password })
    if (authError) return NextResponse.json({ error: authError.message }, { status: 400 })

    return NextResponse.json({ ok: true })
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

// Quitar el acceso: se borra la cuenta de Auth (el FK deja auth_user_id en
// NULL; igual se limpia a mano por si el FK no estuviera).
export async function DELETE(request) {
  try {
    const { respuesta } = await verificarSesion({ modulos: MODULOS })
    if (respuesta) return respuesta
    const enBloqueo = await bloqueado()
    if (enBloqueo) return enBloqueo

    const { cliente, error } = await traerCliente(new URL(request.url).searchParams.get('cliente_id'))
    if (error) return error
    if (!cliente.auth_user_id) return NextResponse.json({ ok: true })

    const { error: authError } = await supabaseAdmin.auth.admin.deleteUser(cliente.auth_user_id)
    if (authError && !/not.?found/i.test(authError.message)) {
      return NextResponse.json({ error: authError.message }, { status: 400 })
    }
    await supabaseAdmin.from('clientes').update({ auth_user_id: null }).eq('id', cliente.id)

    return NextResponse.json({ ok: true })
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
