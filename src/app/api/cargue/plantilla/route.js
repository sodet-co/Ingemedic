import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import { verificarSesion } from '@/lib/api-auth'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } }
)

// Permisos de módulo que exige esta ruta (ver src/lib/api-auth.js)
const MODULOS = ['configuracion', 'configuracion.cargue']

const COLUMNAS_BASE_CLIENTES = ['tipo_persona', 'nombre', 'nit_cc', 'digito_verificacion', 'departamento', 'municipio', 'direccion', 'telefono', 'email']

export async function GET(request) {
  const { respuesta } = await verificarSesion({ modulos: MODULOS })
  if (respuesta) return respuesta

  const { searchParams } = new URL(request.url)
  const tipo        = searchParams.get('tipo')
  const categoriaId = searchParams.get('categoria_id')

  let columnas = []

  if (tipo === 'clientes') {
    columnas = COLUMNAS_BASE_CLIENTES
  } else if (tipo === 'equipos') {
    if (!categoriaId) {
      return NextResponse.json({ error: 'Debes indicar categoria_id' }, { status: 400 })
    }
    const { data: cat } = await supabaseAdmin
      .from('categorias_equipo')
      .select('nombre, atributos_extra')
      .eq('id', categoriaId)
      .single()

    if (!cat) {
      return NextResponse.json({ error: 'Categoría no encontrada' }, { status: 404 })
    }

    const camposTipo   = cat.atributos_extra?.campos_tipo   || []
    const camposUnidad = cat.atributos_extra?.campos_unidad || []

    columnas = ['tipo', 'codigo', ...camposTipo.map(c => c.clave), ...camposUnidad.map(c => c.clave)]
  } else {
    return NextResponse.json({ error: 'Tipo inválido' }, { status: 400 })
  }

  const bom = '\uFEFF'
  const csv = bom + columnas.map(c => `"${c}"`).join(';')

  return new NextResponse(csv, {
    headers: {
      'Content-Type': 'text/csv;charset=utf-8',
      'Content-Disposition': `attachment; filename="plantilla_${tipo}${categoriaId ? '_' + categoriaId.slice(0,8) : ''}.csv"`,
    }
  })
}