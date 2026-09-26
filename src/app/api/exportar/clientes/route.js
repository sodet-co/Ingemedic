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
const MODULOS = ['clientes']

// Paleta Ingemedic
const ROJO    = 'D81B43'
const CELESTE = '25A9E0'
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

export async function GET() {
  try {
    const { respuesta } = await verificarSesion({ modulos: MODULOS })
    if (respuesta) return respuesta

    const [{ data: clientes }, { data: pacientes }, equiposConPaciente] = await Promise.all([
      supabase.from('clientes')
        .select('*, municipio:municipios(nombre), departamento:departamentos(nombre)')
        .order('nombre'),
      supabase.from('pacientes').select('*').order('nombre'),
      traerTodosLosEquipos(supabase, q => q
        .select('id, paciente_actual_id')
        .not('paciente_actual_id', 'is', null)),
    ])

    const conteoPorPaciente = {}
    equiposConPaciente.forEach(e => {
      conteoPorPaciente[e.paciente_actual_id] = (conteoPorPaciente[e.paciente_actual_id] || 0) + 1
    })

    const wb = new ExcelJS.Workbook()
    wb.creator  = 'Ingemedic de Colombia S.A.S.'
    wb.created  = new Date()
    wb.modified = new Date()

    // ── Hoja 1: Clientes ──
    const wsC = wb.addWorksheet('Clientes')
    const headersC = ['Nombre / Razón social', 'Tipo', 'NIT / CC', 'Teléfono', 'Email', 'Dirección', 'Ubicación', 'Estado']
    const nColsC = headersC.length
    wsC.columns = [
      { key: 'nombre', width: 30 }, { key: 'tipo', width: 14 },
      { key: 'nit', width: 16 }, { key: 'tel', width: 16 },
      { key: 'email', width: 26 }, { key: 'dir', width: 26 },
      { key: 'ubic', width: 26 }, { key: 'estado', width: 12 },
    ]
    agregarTitulo(wsC, 'Clientes — Ingemedic de Colombia S.A.S.', nColsC)
    wsC.addRow(headersC)
    estiloHeader(wsC, 3, nColsC)
    ;(clientes || []).forEach((c, i) => {
      wsC.addRow([
        c.nombre || '',
        c.tipo_persona || '',
        c.nit_cc ? `${c.nit_cc}${c.digito_verificacion ? '-' + c.digito_verificacion : ''}` : '',
        c.telefono || '',
        c.email || '',
        c.direccion || '',
        c.municipio?.nombre ? `${c.municipio.nombre}, ${c.departamento?.nombre || ''}` : '',
        c.activo === false ? 'Inactivo' : 'Activo',
      ])
      estiloFila(wsC, i + 4, nColsC, i % 2 === 1)
    })
    wsC.autoFilter = { from: { row: 3, column: 1 }, to: { row: 3, column: nColsC } }
    wsC.views = [{ state: 'frozen', ySplit: 3 }]
    const filaResC = (clientes || []).length + 5
    wsC.mergeCells(filaResC, 1, filaResC, nColsC)
    const rcC = wsC.getCell(filaResC, 1)
    rcC.value = `Total: ${(clientes || []).length} clientes`
    rcC.font  = { bold: true, color: { argb: ROJO }, name: 'Arial', size: 10 }

    // ── Hoja 2: Pacientes ──
    const wsP = wb.addWorksheet('Pacientes')
    const headersP = ['Nombre', 'Cédula', 'Ciudad', 'Teléfono', 'Equipos activos']
    const nColsP = headersP.length
    wsP.columns = [
      { key: 'nombre', width: 30 }, { key: 'cedula', width: 16 },
      { key: 'ciudad', width: 20 }, { key: 'tel', width: 16 },
      { key: 'equipos', width: 16 },
    ]
    agregarTitulo(wsP, 'Pacientes — Ingemedic de Colombia S.A.S.', nColsP)
    wsP.addRow(headersP)
    estiloHeader(wsP, 3, nColsP)
    ;(pacientes || []).forEach((p, i) => {
      wsP.addRow([
        p.nombre || '',
        p.cedula || '',
        p.ciudad || '',
        p.telefono || '',
        conteoPorPaciente[p.id] || 0,
      ])
      estiloFila(wsP, i + 4, nColsP, i % 2 === 1)
    })
    wsP.autoFilter = { from: { row: 3, column: 1 }, to: { row: 3, column: nColsP } }
    wsP.views = [{ state: 'frozen', ySplit: 3 }]
    const filaResP = (pacientes || []).length + 5
    wsP.mergeCells(filaResP, 1, filaResP, nColsP)
    const rcP = wsP.getCell(filaResP, 1)
    rcP.value = `Total: ${(pacientes || []).length} pacientes`
    rcP.font  = { bold: true, color: { argb: CELESTE }, name: 'Arial', size: 10 }

    const buffer = await wb.xlsx.writeBuffer()
    const fecha  = hoyBogota()

    return new NextResponse(buffer, {
      headers: {
        'Content-Type':        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="clientes_pacientes_${fecha}.xlsx"`,
      }
    })

  } catch (error) {
    console.error('Error exportando:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
