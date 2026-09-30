import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import { verificarSesion } from '@/lib/api-auth'
import ExcelJS from 'exceljs'
import { formatear, hoyBogota } from '@/lib/fechas'
import { traerTodosLosEquipos } from '@/lib/equipos'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } }
)

// Permisos de módulo que exige esta ruta (ver src/lib/api-auth.js)
const MODULOS = ['inventario']

// Paleta Ingemedic
const ROJO    = 'D81B43'
const CELESTE = '25A9E0'
const GRIS    = 'F1F5F9'
const TEXTO   = '1E293B'
const BLANCO  = 'FFFFFF'

function estiloHeader(ws, fila, nCols) {
  for (let c = 1; c <= nCols; c++) {
    const cell = ws.getCell(fila, c)
    cell.font      = { bold: true, color: { argb: BLANCO }, name: 'Arial', size: 10 }
    cell.fill      = { type: 'pattern', pattern: 'solid', fgColor: { argb: ROJO } }
    cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true }
    cell.border    = { bottom: { style: 'medium', color: { argb: ROJO } } }
  }
  ws.getRow(fila).height = 22
}

function estiloFila(ws, fila, nCols, par) {
  for (let c = 1; c <= nCols; c++) {
    const cell = ws.getCell(fila, c)
    cell.font      = { name: 'Arial', size: 10, color: { argb: TEXTO } }
    cell.fill      = { type: 'pattern', pattern: 'solid', fgColor: { argb: par ? 'F8FAFC' : BLANCO } }
    cell.alignment = { vertical: 'middle' }
    cell.border    = { bottom: { style: 'thin', color: { argb: 'E2E8F0' } } }
  }
  ws.getRow(fila).height = 18
}

function agregarTitulo(ws, titulo, nCols) {
  ws.mergeCells(1, 1, 1, nCols)
  const cell = ws.getCell(1, 1)
  cell.value     = titulo
  cell.font      = { bold: true, color: { argb: ROJO }, name: 'Arial', size: 13 }
  cell.fill      = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF5F7' } }
  cell.alignment = { horizontal: 'center', vertical: 'middle' }
  ws.getRow(1).height = 30

  ws.mergeCells(2, 1, 2, nCols)
  const sub = ws.getCell(2, 1)
  sub.value     = `Generado: ${formatear(new Date().toISOString(), { hour: '2-digit', minute: '2-digit', second: '2-digit' })}`
  sub.font      = { italic: true, color: { argb: '94A3B8' }, name: 'Arial', size: 9 }
  sub.alignment = { horizontal: 'right', vertical: 'middle' }
  ws.getRow(2).height = 16
}

function colorEstado(cell, estadoNombre) {
  if (estadoNombre === 'Disponible')       cell.font = { ...cell.font, color: { argb: '0F7B55' }, bold: true }
  if (estadoNombre === 'En préstamo')      cell.font = { ...cell.font, color: { argb: '0E86A0' }, bold: true }
  if (estadoNombre === 'En mantenimiento') cell.font = { ...cell.font, color: { argb: 'B45309' }, bold: true }
  if (estadoNombre === 'Baja')             cell.font = { ...cell.font, color: { argb: '64748B' }, bold: true }
}

// Valor de un campo de unidad: en `atributos` o en una columna propia del
// equipo (ej. codigo); los numéricos van como número para que Excel los sume.
function valorCampoUnidad(eq, campo) {
  const val = eq.atributos?.[campo.clave] || eq[campo.clave] || ''
  if (campo.tipo === 'numero' && !isNaN(val) && val !== '') return Number(val)
  return val
}

function conteoEstados(eqs) {
  return [
    eqs.length,
    eqs.filter(e => e.estado?.nombre === 'Disponible').length,
    eqs.filter(e => e.estado?.nombre === 'En préstamo').length,
    eqs.filter(e => e.estado?.nombre === 'En mantenimiento').length,
  ]
}

// Hoja plana con las unidades de varios tipos: el escalón de abajo cuando se
// exporta desde una categoría. Una fila por unidad, con los campos del tipo
// (marca, modelo…) y los de la unidad, y autofiltro para filtrar por tipo.
function agregarHojaUnidades(wb, { nombreHoja, titulo, equipos, tipos, camposTipo, camposUnidad }) {
  const tipoPorId    = new Map(tipos.map(t => [t.id, t]))
  const ordenTipo    = new Map(tipos.map((t, i) => [t.id, i]))
  const clavesUnidad = new Set(camposUnidad.map(c => c.clave))
  const soloTipo     = camposTipo.filter(c => !clavesUnidad.has(c.clave))

  const headers = [
    'Tipo', 'Estado',
    ...soloTipo.map(c => c.nombre), ...camposUnidad.map(c => c.nombre),
    'Paciente actual', 'Dirección paciente', 'Teléfono paciente', 'Fecha registro',
  ]
  const nCols = headers.length
  const ws = wb.addWorksheet(nombreHoja)
  ws.columns = [
    { width: 28 }, { width: 16 },
    ...soloTipo.map(() => ({ width: 20 })), ...camposUnidad.map(() => ({ width: 20 })),
    { width: 22 }, { width: 26 }, { width: 16 }, { width: 16 },
  ]
  agregarTitulo(ws, titulo, nCols)
  ws.addRow(headers)
  estiloHeader(ws, 3, nCols)

  // Agrupadas por tipo, en el mismo orden de la hoja de tipos
  const filas = [...equipos].sort((a, b) =>
    (ordenTipo.get(a.tipo_equipo_id) ?? 0) - (ordenTipo.get(b.tipo_equipo_id) ?? 0))

  filas.forEach((eq, i) => {
    const tipo = tipoPorId.get(eq.tipo_equipo_id)
    ws.addRow([
      tipo?.nombre || '—',
      eq.estado?.nombre || '',
      ...soloTipo.map(c => tipo?.atributos?.[c.clave] || ''),
      ...camposUnidad.map(c => valorCampoUnidad(eq, c)),
      eq.paciente_actual?.nombre    || '',
      eq.paciente_actual?.direccion || '',
      eq.paciente_actual?.telefono  || '',
      eq.fecha_creacion ? formatear(eq.fecha_creacion) : '',
    ])
    const fila = i + 4
    estiloFila(ws, fila, nCols, i % 2 === 1)
    colorEstado(ws.getCell(fila, 2), eq.estado?.nombre || '')
  })

  ws.autoFilter = { from: { row: 3, column: 1 }, to: { row: 3, column: nCols } }
  ws.views = [{ state: 'frozen', ySplit: 3 }]
  const filaTotal = filas.length + 5
  ws.mergeCells(filaTotal, 1, filaTotal, nCols)
  const total = ws.getCell(filaTotal, 1)
  total.value = `Total: ${filas.length} unidades · ${tipos.length} tipos de equipo`
  total.font  = { bold: true, color: { argb: ROJO }, name: 'Arial', size: 10 }
}

export async function POST(request) {
  try {
    const { respuesta } = await verificarSesion({ modulos: MODULOS })
    if (respuesta) return respuesta

    const { nivel, categoria_id, tipo_id } = await request.json()

    const wb = new ExcelJS.Workbook()
    wb.creator  = 'Ingemedic de Colombia S.A.S.'
    wb.created  = new Date()
    wb.modified = new Date()

    // ══════════════════════════════════════════════════════════════
    // Regla de todos los niveles: la primera hoja es lo que se ve en
    // pantalla y la siguiente, el escalón de abajo.
    //
    // COMPLETO (vista de categorías): 3 hojas en un solo Excel
    //   Hoja 1 — Resumen: totales por categoría.
    //   Hoja 2 — Tipos de equipo: todos, con su categoría y conteos.
    //   Hoja 3 — Inventario General: todas las unidades, campos dinámicos
    //            unificados, con autofiltro.
    // ══════════════════════════════════════════════════════════════
    if (nivel === 'completo') {
      const { data: cats }   = await supabase.from('categorias_equipo').select('id, nombre, descripcion, atributos_extra').eq('activo', true).order('nombre')
      const { data: tipos }  = await supabase.from('tipos_equipo').select('*').eq('activo', true)
      const equipos = await traerTodosLosEquipos(supabase, q => q
        .select('*, tipo_equipo:tipos_equipo(*, categoria:categorias_equipo(id, nombre)), estado:estados_equipo(nombre), paciente_actual:pacientes(nombre, direccion, telefono), cliente_actual:clientes(nombre)')
        .order('fecha_creacion', { ascending: false }))

      // ── Hoja 1: Resumen por categoría ───────────────────────
      const ws2 = wb.addWorksheet('Resumen categorías')
      const headers2 = ['Categoría', 'Descripción', 'Tipos', 'Total', 'Disponibles', 'En préstamo', 'En mantenimiento']
      const nCols2 = headers2.length
      ws2.columns = [
        { key: 'cat', width: 28 }, { key: 'desc', width: 30 },
        { key: 'tipos', width: 10 }, { key: 'total', width: 12 },
        { key: 'disp', width: 14 }, { key: 'prest', width: 14 }, { key: 'mant', width: 18 },
      ]
      agregarTitulo(ws2, 'Resumen por Categoría — Ingemedic de Colombia S.A.S.', nCols2)
      ws2.addRow(headers2)
      estiloHeader(ws2, 3, nCols2)
      cats.forEach((cat, i) => {
        const tiposCat   = tipos.filter(t => t.categoria_id === cat.id)
        const equiposCat = equipos.filter(e => tiposCat.some(t => t.id === e.tipo_equipo_id))
        ws2.addRow([
          cat.nombre, cat.descripcion || '', tiposCat.length, equiposCat.length,
          equiposCat.filter(e => e.estado?.nombre === 'Disponible').length,
          equiposCat.filter(e => e.estado?.nombre === 'En préstamo').length,
          equiposCat.filter(e => e.estado?.nombre === 'En mantenimiento').length,
        ])
        estiloFila(ws2, i + 4, nCols2, i % 2 === 1)
      })
      const totRow2 = ws2.addRow([
        'TOTAL', '', tipos.length, equipos.length,
        equipos.filter(e => e.estado?.nombre === 'Disponible').length,
        equipos.filter(e => e.estado?.nombre === 'En préstamo').length,
        equipos.filter(e => e.estado?.nombre === 'En mantenimiento').length,
      ])
      totRow2.eachCell(cell => {
        cell.font = { bold: true, name: 'Arial', size: 10, color: { argb: BLANCO } }
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: CELESTE } }
      })
      ws2.getRow(cats.length + 4).height = 20

      // ── Hoja 2: Tipos de equipo ─────────────────────────────
      const camposTipoUnicos = new Map()
      cats.forEach(cat => (cat.atributos_extra?.campos_tipo || []).forEach(c => {
        if (!camposTipoUnicos.has(c.clave)) camposTipoUnicos.set(c.clave, c.nombre)
      }))
      const clavesTipo = [...camposTipoUnicos.keys()]

      const ws3 = wb.addWorksheet('Tipos de equipo')
      const headers3 = ['Categoría', 'Tipo', 'Total', 'Disponibles', 'En préstamo', 'En mantenimiento',
        ...clavesTipo.map(cl => camposTipoUnicos.get(cl))]
      const nCols3 = headers3.length
      ws3.columns = [
        { width: 24 }, { width: 30 }, { width: 10 }, { width: 13 }, { width: 14 }, { width: 18 },
        ...clavesTipo.map(() => ({ width: 20 })),
      ]
      agregarTitulo(ws3, 'Tipos de equipo — Ingemedic de Colombia S.A.S.', nCols3)
      ws3.addRow(headers3)
      estiloHeader(ws3, 3, nCols3)
      let fila3 = 4
      cats.forEach(cat => {
        tipos
          .filter(t => t.categoria_id === cat.id)
          .sort((a, b) => (a.nombre || '').localeCompare(b.nombre || ''))
          .forEach(tipo => {
            ws3.addRow([
              cat.nombre, tipo.nombre || '',
              ...conteoEstados(equipos.filter(e => e.tipo_equipo_id === tipo.id)),
              ...clavesTipo.map(cl => tipo.atributos?.[cl] || ''),
            ])
            estiloFila(ws3, fila3, nCols3, fila3 % 2 === 1)
            fila3++
          })
      })
      ws3.autoFilter = { from: { row: 3, column: 1 }, to: { row: 3, column: nCols3 } }
      ws3.views = [{ state: 'frozen', ySplit: 3 }]

      // ── Hoja 3: Inventario General ──────────────────────────
      const camposUnicos = new Map()
      cats.forEach(cat => {
        ;[...(cat.atributos_extra?.campos_tipo || []), ...(cat.atributos_extra?.campos_unidad || [])].forEach(c => {
          if (!camposUnicos.has(c.clave)) camposUnicos.set(c.clave, c.nombre)
        })
      })
      const clavesUnicas = [...camposUnicos.keys()]

      const ws1 = wb.addWorksheet('Inventario General')
      const headers1 = [
        'Categoría', 'Tipo', 'Código', 'Estado',
        ...clavesUnicas.map(cl => camposUnicos.get(cl)),
        'Paciente actual', 'Dirección paciente', 'Teléfono paciente',
        'Fecha registro',
      ]
      const nCols1 = headers1.length
      ws1.columns = [
        { key: 'categoria', width: 22 }, { key: 'tipo',      width: 26 },
        { key: 'codigo',    width: 14 }, { key: 'estado',    width: 16 },
        ...clavesUnicas.map(() => ({ width: 20 })),
        { key: 'paciente',  width: 22 }, { key: 'direccion', width: 26 },
        { key: 'telefono',  width: 16 }, { key: 'fecha',     width: 16 },
      ]
      agregarTitulo(ws1, 'Inventario General — Ingemedic de Colombia S.A.S.', nCols1)
      ws1.addRow(headers1)
      estiloHeader(ws1, 3, nCols1)
      equipos.forEach((eq, i) => {
        const tipo = eq.tipo_equipo
        ws1.addRow([
          tipo?.categoria?.nombre || '—',
          tipo?.nombre || '—',
          eq.codigo || '',
          eq.estado?.nombre || '',
          ...clavesUnicas.map(cl => eq.atributos?.[cl] ?? tipo?.atributos?.[cl] ?? ''),
          eq.paciente_actual?.nombre    || '',
          eq.paciente_actual?.direccion || '',
          eq.paciente_actual?.telefono  || '',
          eq.fecha_creacion ? formatear(eq.fecha_creacion) : '',
        ])
        const fila = i + 4
        estiloFila(ws1, fila, nCols1, i % 2 === 1)
        colorEstado(ws1.getCell(fila, 4), eq.estado?.nombre || '')
      })
      ws1.autoFilter = { from: { row: 3, column: 1 }, to: { row: 3, column: nCols1 } }
      ws1.views = [{ state: 'frozen', ySplit: 3 }]
      const filaRes1 = equipos.length + 5
      ws1.mergeCells(filaRes1, 1, filaRes1, nCols1)
      const rc1 = ws1.getCell(filaRes1, 1)
      rc1.value = `Total: ${equipos.length} unidades · ${cats.length} categorías · ${tipos.length} tipos de equipo`
      rc1.font  = { bold: true, color: { argb: ROJO }, name: 'Arial', size: 10 }
    }

    else if (nivel === 'categorias') {
      // ── Hoja: resumen por categoría ──────────────────
      const { data: cats }   = await supabase.from('categorias_equipo').select('*').eq('activo', true).order('nombre')
      const { data: tipos }  = await supabase.from('tipos_equipo').select('id, categoria_id, nombre, atributos').eq('activo', true)
      const equipos = await traerTodosLosEquipos(supabase, q => q
        .select('*, tipo_equipo:tipos_equipo(categoria_id), estado:estados_equipo(nombre)'))

      const ws = wb.addWorksheet('Inventario por categoría')
      const headers = ['Categoría', 'Descripción', 'Tipos', 'Total unidades', 'Disponibles', 'En préstamo', 'En mantenimiento']
      const nCols = headers.length

      ws.columns = [
        { key: 'cat',   width: 28 },
        { key: 'desc',  width: 30 },
        { key: 'tipos', width: 10 },
        { key: 'total', width: 16 },
        { key: 'disp',  width: 14 },
        { key: 'prest', width: 14 },
        { key: 'mant',  width: 18 },
      ]

      agregarTitulo(ws, 'Inventario General — Ingemedic de Colombia S.A.S.', nCols)
      ws.addRow(headers)
      estiloHeader(ws, 3, nCols)

      cats.forEach((cat, i) => {
        const tiposCat   = tipos.filter(t => t.categoria_id === cat.id)
        const equiposCat = equipos.filter(e => tiposCat.some(t => t.id === e.tipo_equipo_id))
        ws.addRow([
          cat.nombre,
          cat.descripcion || '',
          tiposCat.length,
          equiposCat.length,
          equiposCat.filter(e => e.estado?.nombre === 'Disponible').length,
          equiposCat.filter(e => e.estado?.nombre === 'En préstamo').length,
          equiposCat.filter(e => e.estado?.nombre === 'En mantenimiento').length,
        ])
        estiloFila(ws, i + 4, nCols, i % 2 === 1)
      })

      const totRow = ws.addRow([
        'TOTAL', '',
        tipos.length,
        equipos.length,
        equipos.filter(e => e.estado?.nombre === 'Disponible').length,
        equipos.filter(e => e.estado?.nombre === 'En préstamo').length,
        equipos.filter(e => e.estado?.nombre === 'En mantenimiento').length,
      ])
      totRow.eachCell(cell => {
        cell.font = { bold: true, name: 'Arial', size: 10, color: { argb: BLANCO } }
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: CELESTE } }
      })
      ws.getRow(cats.length + 4).height = 20
    }

    else if (nivel === 'tipos' && categoria_id) {
      const { data: cat }    = await supabase.from('categorias_equipo').select('*').eq('id', categoria_id).single()
      const { data: tipos }  = await supabase.from('tipos_equipo').select('*').eq('categoria_id', categoria_id).eq('activo', true).order('nombre')
      // Solo las unidades de esta categoría (antes se traía todo el inventario
      // para contar). Sin tipos, .in() con lista vacía fallaría: se omite.
      const idsTipos = tipos.map(t => t.id)
      const equipos = idsTipos.length === 0 ? [] : await traerTodosLosEquipos(supabase, q => q
        .select('*, estado:estados_equipo(nombre), paciente_actual:pacientes(nombre, direccion, telefono)')
        .in('tipo_equipo_id', idsTipos)
        .order('fecha_creacion', { ascending: false }))

      const camposTipo = cat?.atributos_extra?.campos_tipo || []
      const ws = wb.addWorksheet(cat?.nombre?.slice(0, 31) || 'Tipos')

      const headers = ['Tipo', 'Total', 'Disponibles', 'En préstamo', 'En mantenimiento', ...camposTipo.map(c => c.nombre)]
      const nCols = headers.length

      ws.columns = [
        { key: 'nombre', width: 30 },
        { key: 'total',  width: 10 },
        { key: 'disp',   width: 13 },
        { key: 'prest',  width: 14 },
        { key: 'mant',   width: 18 },
        ...camposTipo.map(() => ({ width: 20 })),
      ]

      agregarTitulo(ws, `${cat?.nombre || 'Categoría'} — Tipos de equipo`, nCols)
      ws.addRow(headers)
      estiloHeader(ws, 3, nCols)

      tipos.forEach((tipo, i) => {
        const eqs = equipos.filter(e => e.tipo_equipo_id === tipo.id)
        ws.addRow([
          tipo.nombre || '',
          eqs.length,
          eqs.filter(e => e.estado?.nombre === 'Disponible').length,
          eqs.filter(e => e.estado?.nombre === 'En préstamo').length,
          eqs.filter(e => e.estado?.nombre === 'En mantenimiento').length,
          ...camposTipo.map(c => tipo.atributos?.[c.clave] || ''),
        ])
        estiloFila(ws, i + 4, nCols, i % 2 === 1)
      })

      // Escalón de abajo: todas las unidades de la categoría
      agregarHojaUnidades(wb, {
        nombreHoja:   'Unidades',
        titulo:       `${cat?.nombre || 'Categoría'} — Unidades`,
        equipos,
        tipos,
        camposTipo,
        camposUnidad: cat?.atributos_extra?.campos_unidad || [],
      })
    }

    else if (nivel === 'unidades' && tipo_id) {
      const { data: tipo }   = await supabase.from('tipos_equipo')
        .select('*, categoria:categorias_equipo(nombre, atributos_extra)').eq('id', tipo_id).single()
      const { data: equipos } = await supabase.from('equipos')
        .select('*, estado:estados_equipo(nombre), paciente_actual:pacientes(nombre, direccion, telefono), cliente_actual:clientes(nombre)').eq('tipo_equipo_id', tipo_id).order('fecha_creacion', { ascending: false })

      const camposUnidad = tipo?.categoria?.atributos_extra?.campos_unidad || []
      const camposTipo   = tipo?.categoria?.atributos_extra?.campos_tipo   || []
      const nombreTipo   = tipo?.nombre || 'Tipo'

      const ws = wb.addWorksheet(nombreTipo.slice(0, 31))
      const headers = ['Estado', ...camposUnidad.map(c => c.nombre), 'Paciente actual', 'Dirección paciente', 'Teléfono paciente', 'Fecha registro']
      const nCols = headers.length

      ws.columns = [
        { key: 'estado',    width: 18 },
        ...camposUnidad.map(() => ({ width: 20 })),
        { key: 'paciente',  width: 22 },
        { key: 'direccion', width: 26 },
        { key: 'telefono',  width: 16 },
        { key: 'fecha',     width: 18 },
      ]

      agregarTitulo(ws, `${nombreTipo} — Unidades`, nCols)

      let filaActual = 3
      if (camposTipo.length > 0 && tipo?.atributos) {
        ws.mergeCells(filaActual, 1, filaActual, nCols)
        const labelCell = ws.getCell(filaActual, 1)
        labelCell.value     = 'COLUMNAS DEL TIPO'
        labelCell.font      = { bold: true, color: { argb: CELESTE }, name: 'Arial', size: 9 }
        labelCell.fill      = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'F0F9FF' } }
        labelCell.alignment = { horizontal: 'left', vertical: 'middle' }
        ws.getRow(filaActual).height = 16
        filaActual++

        const tipoRow = ws.addRow(camposTipo.map(c => `${c.nombre}: ${tipo.atributos?.[c.clave] || '—'}`))
        tipoRow.eachCell(cell => {
          cell.font      = { italic: true, color: { argb: '475569' }, name: 'Arial', size: 9 }
          cell.fill      = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'F0F9FF' } }
          cell.alignment = { vertical: 'middle' }
        })
        ws.getRow(filaActual).height = 16
        filaActual++

        ws.mergeCells(filaActual, 1, filaActual, nCols)
        ws.getRow(filaActual).height = 6
        filaActual++
      }

      ws.addRow(headers)
      estiloHeader(ws, filaActual, nCols)
      filaActual++

      equipos.forEach((eq, i) => {
        const fecha = eq.fecha_creacion ? formatear(eq.fecha_creacion) : ''
        ws.addRow([
          eq.estado?.nombre || '',
          ...camposUnidad.map(c => valorCampoUnidad(eq, c)),
          eq.paciente_actual?.nombre    || '',
          eq.paciente_actual?.direccion || '',
          eq.paciente_actual?.telefono  || '',
          fecha,
        ])
        estiloFila(ws, filaActual + i, nCols, i % 2 === 1)
        colorEstado(ws.getCell(filaActual + i, 1), eq.estado?.nombre || '')
      })

      const resumenFila = filaActual + equipos.length + 1
      ws.getCell(resumenFila, 1).value = `Total: ${equipos.length} unidades`
      ws.getCell(resumenFila, 1).font  = { bold: true, color: { argb: ROJO }, name: 'Arial', size: 10 }
    }

    const buffer = await wb.xlsx.writeBuffer()
    const fecha  = hoyBogota()

    return new NextResponse(buffer, {
      headers: {
        'Content-Type':        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="inventario_${nivel}_${fecha}.xlsx"`,
      }
    })

  } catch (error) {
    console.error('Error exportando:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}