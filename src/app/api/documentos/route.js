import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import { verificarSesion } from '@/lib/api-auth'
import { formatear, formatearSoloFecha } from '@/lib/fechas'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } }
)

// Permisos de módulo que exige esta ruta (ver src/lib/api-auth.js)
const MODULOS = []

function reemplazarVariables(html, variables) {
  return html.replace(/\{\{\s*([a-zA-Z0-9_\.]+)\s*\}\}/g, (_, key) => {
    return variables[key] ?? ''
  })
}

function formatearFecha(fecha) {
  return fecha ? formatear(fecha, { month: '2-digit' }) : ''
}

export async function POST(request) {
  try {
    const { respuesta } = await verificarSesion({ modulos: MODULOS })
    if (respuesta) return respuesta

    const { tipo, orden_id, mantenimiento_id } = await request.json()

    // 1. Cargar datos de la empresa
    const { data: empresa } = await supabaseAdmin
      .from('configuracion_empresa')
      .select('*')
      .single()

    // 2. Cargar plantilla según tipo
    const nombrePlantilla = {
      'entrega':     'Acta de Entrega de Equipo Biomédico',
      'devolucion':  'Acta de Devolución de Equipo Biomédico',
      'mantenimiento': 'Reporte de Mantenimiento',
    }[tipo]

    let { data: plantilla } = await supabaseAdmin
      .from('plantillas_orden')
      .select('contenido')
      .eq('nombre', nombrePlantilla)
      .single()

    if (!plantilla) {
      // Fallback: buscar por coincidencia parcial en caso de nombre diferente en BD
      const { data: plantillaFallback } = await supabaseAdmin
        .from('plantillas_orden')
        .select('contenido')
        .ilike('nombre', `%${tipo === 'entrega' ? 'entrega' : tipo === 'devolucion' ? 'devolución' : 'mantenimiento'}%`)
        .limit(1)
        .single()
      plantilla = plantillaFallback
    }

    if (!plantilla || !plantilla.contenido) {
      return NextResponse.json({ error: 'Plantilla no encontrada' }, { status: 404 })
    }

    // 3. Construir variables según tipo
    let variables = {
      empresa_logo:  empresa?.logo_url || '',
      empresa_dir:   empresa?.dir || '',
      empresa_tel:   empresa?.tel || '',
      empresa_email: empresa?.email || '',
      empresa_web:   empresa?.web || '',
      ciudad: 'Valledupar',
    }

    if (tipo === 'entrega' || tipo === 'devolucion') {
      const { data: orden } = await supabaseAdmin
        .from('ordenes_servicio')
        .select(`
          *,
          cliente:clientes(nombre),
          repartidor:usuarios(nombre),
          equipos:orden_equipos(
            fecha_entrega, fecha_devolucion,
            equipo:equipos(codigo,
              tipo_equipo:tipos_equipo(marca, modelo, invima,
                categoria:categorias_equipo(nombre)
              )
            )
          )
        `)
        .eq('id', orden_id)
        .single()

      if (!orden) return NextResponse.json({ error: 'Orden no encontrada' }, { status: 404 })

      const eq = orden.equipos?.[0]
      variables = {
        ...variables,
        orden_codigo:    orden.codigo || '',
        orden_fecha:     formatearFecha(orden.fecha_creacion),
        devolucion_fecha: formatearFecha(eq?.fecha_devolucion),
        cliente_nombre:  orden.cliente?.nombre || '',
        repartidor_nombre: orden.repartidor?.nombre || '',
        repartidor_cc:   '',
        recibido_por:    orden.recibido_por || '',
        recibido_cargo:  '',
        recibido_cc:     '',
        equipo_nombre:   eq?.equipo?.tipo_equipo?.categoria?.nombre || '',
        equipo_marca:    eq?.equipo?.tipo_equipo?.marca || '',
        equipo_modelo:   eq?.equipo?.tipo_equipo?.modelo || '',
        equipo_codigo:   eq?.equipo?.codigo || '',
        equipo_invima:   eq?.equipo?.tipo_equipo?.invima || '',
      }
    }

    if (tipo === 'mantenimiento') {
      const { data: mant } = await supabaseAdmin
        .from('mantenimientos')
        .select(`
          *,
          equipo:equipos(codigo,
            tipo_equipo:tipos_equipo(marca, modelo, invima,
              categoria:categorias_equipo(nombre)
            )
          ),
          tipo:tipos_mantenimiento(nombre),
          estado:estados_mantenimiento(nombre)
        `)
        .eq('id', mantenimiento_id)
        .single()

      if (!mant) return NextResponse.json({ error: 'Mantenimiento no encontrado' }, { status: 404 })

      variables = {
        ...variables,
        mant_codigo:     mant.codigo || '',
        mant_fecha:      formatearSoloFecha(mant.fecha_cierre_real || mant.fecha_apertura),
        mant_tipo:       mant.tipo?.nombre || '',
        mant_estado:     mant.estado?.nombre || '',
        mant_tecnico:    mant.tecnico || '',
        mant_tecnico_cc: '',
        equipo_nombre:   mant.equipo?.tipo_equipo?.categoria?.nombre || '',
        equipo_marca:    mant.equipo?.tipo_equipo?.marca || '',
        equipo_modelo:   mant.equipo?.tipo_equipo?.modelo || '',
        equipo_codigo:   mant.equipo?.codigo || '',
        equipo_invima:   mant.equipo?.tipo_equipo?.invima || '',
        cliente_nombre:  '',
        recibido_por:    '',
      }
    }

    // 4. Reemplazar variables en el HTML
    const html = reemplazarVariables(plantilla.contenido, variables)

    // 5. Generar PDF con Puppeteer
    let chromium, puppeteer
    if (process.env.NODE_ENV === 'production') {
      chromium = (await import('@sparticuz/chromium')).default
      puppeteer = (await import('puppeteer-core')).default
    } else {
      puppeteer = (await import('puppeteer')).default
    }

    const browser = await (process.env.NODE_ENV === 'production'
      ? puppeteer.launch({
          args: chromium.args,
          defaultViewport: chromium.defaultViewport,
          executablePath: await chromium.executablePath(),
          headless: chromium.headless,
        })
      : puppeteer.launch({ headless: 'new' })
    )

    const page = await browser.newPage()
    await page.setContent(html, { waitUntil: 'networkidle0' })
    const pdf = await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: { top: '10mm', bottom: '10mm', left: '10mm', right: '10mm' }
    })
    await browser.close()

    return new NextResponse(pdf, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${nombrePlantilla}-${Date.now()}.pdf"`,
      }
    })

  } catch (error) {
    console.error('Error generando PDF:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}