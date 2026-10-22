import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import ExcelJS from 'exceljs'
import { verificarSesion } from '@/lib/api-auth'
import { formatear, hoyBogota } from '@/lib/fechas'
import { armarInforme } from '@/lib/informeCliente'

// Informe en Excel de UN cliente o paciente (detalle de Clientes): resumen,
// equipos que tiene, pacientes y línea de tiempo. Mismos datos que el PDF
// (lib/informeCliente.js). ?id=<uuid>&tipo=cliente|paciente
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } }
)
const MODULOS = ['clientes']
const ROJO = 'D81B43', AZUL = '1B3A6B', TEXTO = '1E293B', BLANCO = 'FFFFFF'

function hoja(wb, nombre, titulo, columnas, filas) {
  const ws = wb.addWorksheet(nombre)
  ws.columns = columnas.map(c => ({ width: c.ancho }))
  ws.mergeCells(1, 1, 1, columnas.length)
  Object.assign(ws.getCell(1, 1), { value: titulo })
  ws.getCell(1, 1).font = { bold: true, color: { argb: AZUL }, name: 'Arial', size: 13 }
  ws.getRow(1).height = 26
  const enc = ws.getRow(3)
  columnas.forEach((c, i) => {
    const cell = enc.getCell(i + 1)
    cell.value = c.titulo
    cell.font = { bold: true, color: { argb: BLANCO }, name: 'Arial', size: 10 }
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: ROJO } }
    cell.alignment = { vertical: 'middle' }
  })
  enc.height = 20
  filas.forEach((f, r) => {
    const row = ws.getRow(r + 4)
    f.forEach((v, i) => {
      const cell = row.getCell(i + 1)
      cell.value = v ?? ''
      cell.font = { name: 'Arial', size: 10, color: { argb: TEXTO } }
      if (r % 2) cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'F8FAFC' } }
    })
  })
  if (filas.length) ws.autoFilter = { from: { row: 3, column: 1 }, to: { row: 3, column: columnas.length } }
  ws.views = [{ state: 'frozen', ySplit: 3 }]
  return ws
}

export async function GET(request) {
  try {
    const { respuesta } = await verificarSesion({ modulos: MODULOS })
    if (respuesta) return respuesta

    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')
    const esCliente = searchParams.get('tipo') !== 'paciente'
    if (!id) return NextResponse.json({ error: 'Falta el id' }, { status: 400 })

    const [{ data: persona }, { data: ordenes, error }] = await Promise.all([
      supabase.from(esCliente ? 'clientes' : 'pacientes').select('*').eq('id', id).maybeSingle(),
      supabase.from('ordenes_servicio').select(`
        id, fecha_creacion, estado:estados_orden(nombre), cliente:clientes(nombre), paciente:pacientes(nombre),
        equipos:orden_equipos(fecha_entrega, fecha_devolucion, observaciones_devolucion,
          equipo:equipos(id, codigo, tipo_equipo:tipos_equipo(nombre, atributos)))
      `).eq(esCliente ? 'cliente_id' : 'paciente_id', id),
    ])
    if (error) throw error
    if (!persona) return NextResponse.json({ error: 'No encontrado' }, { status: 404 })

    // Recogidas, recargas y cambios de esos préstamos (lib/accionesPrestamo.js)
    const idsOrdenes = (ordenes || []).map(o => o.id)
    const { data: entregas } = idsOrdenes.length
      ? await supabase.from('entregas').select('id, tipo, modo, fecha_completada, recibido_por, datos, orden_id, estado:estados_entrega(nombre)').in('orden_id', idsOrdenes)
      : { data: [] }
    const inf = armarInforme(ordenes || [], { esCliente, entregas: (entregas || []).map(e => ({ ...e, orden: { id: e.orden_id } })) })
    const wb = new ExcelJS.Workbook()
    wb.creator = 'Ingemedic'

    hoja(wb, 'Resumen', persona.nombre, [{ titulo: 'Dato', ancho: 26 }, { titulo: 'Valor', ancho: 48 }], [
      ...(esCliente
        ? [['NIT / CC', persona.nit_cc ? persona.nit_cc + (persona.digito_verificacion ? '-' + persona.digito_verificacion : '') : ''], ['Teléfono', persona.telefono], ['Correo', persona.email], ['Dirección', persona.direccion]]
        : [['Cédula', persona.cedula], ['Teléfono', persona.telefono], ['Dirección', persona.direccion], ['Ciudad', persona.ciudad]]),
      ['Equipos en préstamo', inf.activos.length],
      ...(esCliente ? [['Pacientes con equipos', inf.pacientes.filter(p => p.nombre !== 'Sin paciente').length]] : []),
      ['Préstamos registrados', inf.totalPrestamos],
      ['Generado', formatear(new Date().toISOString(), { hour: '2-digit', minute: '2-digit' })],
    ])
    hoja(wb, 'Equipos en préstamo', `Equipos en préstamo · ${persona.nombre}`,
      [{ titulo: 'Código', ancho: 14 }, { titulo: 'Equipo', ancho: 36 }, { titulo: esCliente ? 'Paciente' : 'Cliente', ancho: 32 }, { titulo: 'Desde', ancho: 16 }],
      inf.activos.map(a => [a.codigo, a.tipo, esCliente ? a.paciente : a.cliente, formatear(a.desde)]))
    if (esCliente) {
      hoja(wb, 'Pacientes', `Pacientes · ${persona.nombre}`, [{ titulo: 'Paciente', ancho: 40 }, { titulo: 'Equipos', ancho: 12 }],
        inf.pacientes.map(p => [p.nombre, p.equipos]))
    }
    hoja(wb, 'Línea de tiempo', `Línea de tiempo · ${persona.nombre}`,
      [{ titulo: 'Fecha', ancho: 16 }, { titulo: 'Qué pasó', ancho: 60 }, { titulo: 'Equipos / nota', ancho: 40 }],
      inf.eventos.map(e => [formatear(e.fecha), e.texto, e.detalle]))
    hoja(wb, 'Historial por equipo', `Historial por equipo · ${persona.nombre}`,
      [{ titulo: 'Código', ancho: 14 }, { titulo: 'Equipo', ancho: 30 }, { titulo: 'Fecha', ancho: 16 }, { titulo: 'Qué pasó', ancho: 60 }],
      inf.porEquipo.flatMap(x => x.eventos.map(e => [x.codigo, x.tipo, formatear(e.fecha), e.texto])))

    const buffer = await wb.xlsx.writeBuffer()
    // Solo ASCII: el encabezado HTTP no admite cualquier carácter
    const nombre = (persona.nombre || 'informe').normalize('NFD').replace(/[^A-Za-z0-9]+/g, '_')
    return new NextResponse(buffer, {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="Informe_${nombre}_${hoyBogota()}.xlsx"`,
      },
    })
  } catch (error) {
    console.error('Error exportando informe:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
