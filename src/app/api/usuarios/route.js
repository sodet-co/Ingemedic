import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import { verificarSesion } from '@/lib/api-auth'

// Cliente admin con service_role — solo en el servidor
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } }
)

// Misma regla que la pantalla: módulo Configuración + sección Usuarios.
const MODULOS_USUARIOS = ['configuracion', 'configuracion.usuarios']

async function esRolSuperAdmin(rolId) {
  if (!rolId) return false
  const { data } = await supabaseAdmin.from('roles').select('nombre').eq('id', rolId).maybeSingle()
  return data?.nombre === 'SuperAdmin'
}

// Solo un SuperAdmin puede crear/editar/desactivar un SuperAdmin o asignar
// ese rol — si no, un Administrador podría subirse a sí mismo de nivel.
const PROHIBIDO_SUPERADMIN = () =>
  NextResponse.json({ error: 'Solo un SuperAdmin puede asignar o modificar el rol SuperAdmin.' }, { status: 403 })

export async function POST(request) {
  try {
    const { usuario: actual, respuesta } = await verificarSesion({ modulos: MODULOS_USUARIOS })
    if (respuesta) return respuesta

    const { nombre, email, username, password, rol_id } = await request.json()

    if (!nombre || !email || !username || !password || !rol_id) {
      return NextResponse.json({ error: 'Todos los campos son requeridos' }, { status: 400 })
    }
    if (!actual.esSuperAdmin && await esRolSuperAdmin(rol_id)) return PROHIBIDO_SUPERADMIN()

    // 1. Crear usuario en Auth
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    })

    if (authError) {
      return NextResponse.json({ error: authError.message }, { status: 400 })
    }

    // 2. Insertar en tabla usuarios con el mismo ID
    const { data: usuario, error: dbError } = await supabaseAdmin
      .from('usuarios')
      .insert({
        id:       authData.user.id,
        nombre,
        email,
        username,
        rol_id,
        activo:   true,
      })
      .select('*, rol:roles(id, nombre)')
      .single()

    if (dbError) {
      // Si falla la inserción, eliminar el usuario de Auth para no dejar inconsistencia
      await supabaseAdmin.auth.admin.deleteUser(authData.user.id)
      return NextResponse.json({ error: dbError.message }, { status: 400 })
    }

    return NextResponse.json({ usuario })

  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

export async function PUT(request) {
  try {
    const { usuario: actual, respuesta } = await verificarSesion({ modulos: MODULOS_USUARIOS })
    if (respuesta) return respuesta

    const { id, nombre, email, username, rol_id, password, activo } = await request.json()

    if (!id) return NextResponse.json({ error: 'ID requerido' }, { status: 400 })

    if (!actual.esSuperAdmin) {
      const { data: objetivo } = await supabaseAdmin.from('usuarios').select('rol_id').eq('id', id).maybeSingle()
      if (await esRolSuperAdmin(objetivo?.rol_id)) return PROHIBIDO_SUPERADMIN()
      if (rol_id !== undefined && await esRolSuperAdmin(rol_id)) return PROHIBIDO_SUPERADMIN()
    }

    // Nadie puede desactivarse a sí mismo (se quedaría por fuera sin forma de volver)
    if (activo === false && id === actual.id) {
      return NextResponse.json({ error: 'No puedes desactivar tu propio usuario.' }, { status: 400 })
    }

    // Actualizar en Auth si cambió email, password o el estado activo.
    // Desactivar = bloquear la cuenta en Supabase Auth (ban): sin esto,
    // `usuarios.activo = false` era solo una marca y el usuario seguía
    // pudiendo iniciar sesión y usar todo el sistema.
    if (email || password || activo !== undefined) {
      const authUpdate = {}
      if (email)    authUpdate.email    = email
      if (password) authUpdate.password = password
      if (activo !== undefined) authUpdate.ban_duration = activo ? 'none' : '876000h' // ~100 años

      const { error: authError } = await supabaseAdmin.auth.admin.updateUserById(id, authUpdate)
      if (authError) return NextResponse.json({ error: authError.message }, { status: 400 })
    }

    // Construir payload solo con campos definidos
    const payload = {}
    if (nombre    !== undefined) payload.nombre    = nombre
    if (email     !== undefined) payload.email     = email
    if (username  !== undefined) payload.username  = username
    if (rol_id    !== undefined) payload.rol_id    = rol_id
    if (activo    !== undefined) payload.activo    = activo

    const { data: usuario, error: dbError } = await supabaseAdmin
      .from('usuarios')
      .update(payload)
      .eq('id', id)
      .select('*, rol:roles(id, nombre)')
      .single()

    if (dbError) return NextResponse.json({ error: dbError.message }, { status: 400 })

    return NextResponse.json({ usuario })

  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}