import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import { verificarSesion } from '@/lib/api-auth'
import Papa from 'papaparse'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } }
)

// Permisos de módulo que exige esta ruta (ver src/lib/api-auth.js)
const MODULOS = ['configuracion', 'configuracion.cargue']

function limpiar(val) {
  if (val === undefined || val === null) return null
  const s = String(val).trim()
  if (s === '' || s.toUpperCase() === 'N/A') return null
  return s
}

function parsearFecha(str) {
  if (!str || str.trim() === '' || str.trim().toUpperCase() === 'N/A') return null
  const s = str.trim()
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(s)) {
    const [d, m, y] = s.split('/')
    return `${y}-${m}-${d}`
  }
  if (/^\d{2}-\d{2}-\d{4}$/.test(s)) {
    const [d, m, y] = s.split('-')
    return `${y}-${m}-${d}`
  }
  return null
}

function leerAtributos(fila, campos) {
  const atributos = {}
  for (const campo of campos) {
    const val = fila[campo.clave]
    if (val !== undefined && val !== null && String(val).trim() !== '' && String(val).trim().toUpperCase() !== 'N/A') {
      atributos[campo.clave] = campo.tipo === 'fecha'
        ? (parsearFecha(val) ?? String(val).trim())
        : String(val).trim()
    }
  }
  return atributos
}

export async function POST(request) {
  try {
    const { respuesta } = await verificarSesion({ modulos: MODULOS })
    if (respuesta) return respuesta

    const formData = await request.formData()
    const tipoCarga = formData.get('tipo')
    const categoriaId = formData.get('categoria_id')
    const archivo = formData.get('archivo')
    const texto = await archivo.text()

    if (tipoCarga !== 'equipos') {
      return NextResponse.json({ error: 'Tipo no soportado' }, { status: 400 })
    }
    if (!categoriaId) {
      return NextResponse.json({ error: 'Debes seleccionar una categoría antes de cargar' }, { status: 400 })
    }

    const { data: filas, errors: parseErrors } = Papa.parse(texto, {
      header: true,
      skipEmptyLines: true,
      delimiter: '',
      transformHeader: h => h.trim().replace(/^﻿/, '').replace(/;$/, '').toLowerCase(),
      transform: v => (typeof v === 'string' ? v.trim() : v),
    })

    if (parseErrors.length > 0) {
      return NextResponse.json({ error: 'Error parseando CSV: ' + parseErrors[0].message }, { status: 400 })
    }

    const filasFinales = filas.filter(f =>
      Object.values(f).some(v => v && v.trim() !== '' && v.trim().toUpperCase() !== 'N/A')
    )

    if (filasFinales.length === 0) {
      return NextResponse.json({ error: 'El archivo está vacío o mal formateado' }, { status: 400 })
    }

    const { data: cat } = await supabaseAdmin
      .from('categorias_equipo')
      .select('id, nombre, atributos_extra')
      .eq('id', categoriaId)
      .single()

    if (!cat) {
      return NextResponse.json({ error: 'Categoría no encontrada' }, { status: 404 })
    }

    const camposTipo = cat.atributos_extra?.campos_tipo || []
    const camposUnidad = cat.atributos_extra?.campos_unidad || []

    const { data: carga } = await supabaseAdmin.from('cargas_masivas').insert({
      categoria_id: categoriaId,
      tipo_carga: 'equipos',
      nombre_archivo: archivo.name,
      total_filas: filasFinales.length,
      estado: 'procesando',
    }).select('id').single()

    const { data: tiposExistentes } = await supabaseAdmin
      .from('tipos_equipo')
      .select('id, nombre, atributos')
      .eq('categoria_id', categoriaId)
      .eq('activo', true)

    const tiposCache = [...(tiposExistentes || [])]

    const { data: estadoDisponible } = await supabaseAdmin
      .from('estados_equipo').select('id').eq('nombre', 'Disponible').single()

    const resultados = { exitosos: 0, errores: [], tiposCreados: 0, tiposReutilizados: 0 }

    for (let i = 0; i < filasFinales.length; i++) {
      const fila = filasFinales[i]
      const nFila = i + 2

      const nombreTipo = limpiar(fila.tipo)
      if (!nombreTipo) {
        resultados.errores.push(`Fila ${nFila}: el campo "tipo" es obligatorio`)
        continue
      }

      const atributosTipo = leerAtributos(fila, camposTipo)
      const atributosUnidad = leerAtributos(fila, camposUnidad)

      let tipoObj = tiposCache.find(t => t.nombre?.toLowerCase() === nombreTipo.toLowerCase())

      if (tipoObj) {
        resultados.tiposReutilizados++
        // Actualizar atributos del tipo existente si el CSV trae valores nuevos para campos recién añadidos
        if (Object.keys(atributosTipo).length > 0) {
          const atributosActualizados = { ...(tipoObj.atributos || {}), ...atributosTipo }
          await supabaseAdmin.from('tipos_equipo').update({ atributos: atributosActualizados }).eq('id', tipoObj.id)
          tipoObj.atributos = atributosActualizados
        }
      } else {
        const { data: nuevoTipo, error: errTipo } = await supabaseAdmin
          .from('tipos_equipo')
          .insert({
            categoria_id: cat.id,
            nombre: nombreTipo,
            atributos: Object.keys(atributosTipo).length > 0 ? atributosTipo : null,
            activo: true,
          })
          .select('id, nombre, atributos').single()

        if (errTipo) {
          resultados.errores.push(`Fila ${nFila}: error creando tipo "${nombreTipo}" — ${errTipo.message}`)
          continue
        }
        tipoObj = nuevoTipo
        tiposCache.push(tipoObj)
        resultados.tiposCreados++
      }

      const codigo = limpiar(fila.codigo)
      if (!codigo) {
        resultados.errores.push(`Fila ${nFila}: el campo "codigo" es obligatorio`)
        continue
      }

      const { data: existente } = await supabaseAdmin.from('equipos').select('id').eq('codigo', codigo).maybeSingle()
      if (existente) {
        resultados.errores.push(`Fila ${nFila}: el código "${codigo}" ya existe en inventario`)
        continue
      }

      const { error } = await supabaseAdmin.from('equipos').insert({
        tipo_equipo_id: tipoObj.id,
        codigo,
        estado_id: estadoDisponible?.id,
        atributos: Object.keys(atributosUnidad).length > 0 ? atributosUnidad : null,
      })

      if (error) {
        resultados.errores.push(`Fila ${nFila}: ${error.message}`)
      } else {
        resultados.exitosos++
      }
    }

    if (carga?.id) {
      await supabaseAdmin.from('cargas_masivas').update({
        exitosos: resultados.exitosos,
        tipos_creados: resultados.tiposCreados,
        tipos_reutilizados: resultados.tiposReutilizados,
        errores: resultados.errores.length > 0 ? resultados.errores : null,
        estado: resultados.errores.length > 0 ? 'con_errores' : 'completado',
        fecha_fin: new Date().toISOString(),
      }).eq('id', carga.id)
    }

    return NextResponse.json({
      carga_id: carga?.id || null,
      total: filasFinales.length,
      exitosos: resultados.exitosos,
      errores: resultados.errores,
      tiposCreados: resultados.tiposCreados,
      tiposReutilizados: resultados.tiposReutilizados,
    })

  } catch (error) {
    console.error('Error en cargue masivo:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}