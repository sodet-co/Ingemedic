import { createClient } from '@/lib/supabase-server'
import { traerTodosLosEquipos } from '@/lib/equipos'
import { normalizarCiudadPaciente } from '@/lib/municipios'
import { REGLAS_ATENCION, contarRegla } from '@/lib/atencion'
import fs from 'fs'
import path from 'path'
import DashboardClient from './DashboardClient'

const ESTADO_EN_PRESTAMO = '56abea9f-8cad-413e-bc3c-31ba19fa00fe'
const ESTADO_RESERVADO   = '81f762da-6922-4a98-8593-cbaf029dbf6b'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export default async function DashboardPage() {
  const supabase = await createClient()

  const [
    equiposEstados,
    { data: mantenimientosActivos },
    conteosAtencion,
    { data: actividadReciente },
    equiposConCliente,
    { data: equiposConCiudad },
  ] = await Promise.all([
    traerTodosLosEquipos(supabase, q => q.select('estado:estados_equipo(id, nombre)')),

    supabase.from('mantenimientos').select(`
      id, codigo, fecha_apertura,
      equipo:equipos(id, codigo, tipo_equipo:tipos_equipo(id, nombre, atributos)),
      estado:estados_mantenimiento(id, nombre),
      tipo:tipos_mantenimiento(id, nombre)
    `)
    .not('estado_id', 'eq', '08136bd6-f134-406a-98e9-2132516edd7f')
    .order('fecha_creacion', { ascending: false })
    .limit(8),

    // Solo el conteo por regla — el detalle (cliente, paciente, equipo) se
    // trae en el navegador desde PanelAtencion/BuzonNovedades, solo cuando
    // hace falta mostrarlo. El dashboard es force-dynamic y sin caché: no
    // tiene sentido cargarle el detalle completo a cada visita.
    Promise.all(REGLAS_ATENCION.map(async regla => ({
      id: regla.id, titulo: regla.titulo, severidad: regla.severidad,
      count: await contarRegla(supabase, regla),
    }))),

    supabase.from('ordenes_servicio').select(`
      id, codigo, fecha_creacion,
      cliente:clientes(id, nombre),
      estado:estados_orden(id, nombre)
    `)
    .order('fecha_creacion', { ascending: false })
    .limit(5),

    traerTodosLosEquipos(supabase, q => q
      .select('cliente_actual:clientes(id, nombre)')
      .not('cliente_actual_id', 'is', null)),

    supabase.from('equipos')
      .select('paciente_actual:pacientes(ciudad)')
      .in('estado_id', [ESTADO_EN_PRESTAMO, ESTADO_RESERVADO])
      .not('paciente_actual_id', 'is', null),
  ])

  const estadosEquipo = {}
  ;(equiposEstados || []).forEach(e => {
    const n = e.estado?.nombre || 'Sin estado'
    estadosEquipo[n] = (estadosEquipo[n] || 0) + 1
  })

  const topClientes = Object.values(
    (equiposConCliente || []).reduce((acc, e) => {
      const id     = e.cliente_actual?.id
      const nombre = e.cliente_actual?.nombre
      if (!id) return acc
      acc[id] = acc[id] || { nombre, cantidad: 0 }
      acc[id].cantidad++
      return acc
    }, {})
  ).sort((a, b) => b.cantidad - a.cantidad).slice(0, 8)

  // ── MAPA DE EQUIPOS ACTIVOS POR MUNICIPIO (Cesar) ──
  const conteoPorCiudad = {}
  ;(equiposConCiudad || []).forEach(eq => {
    const ciudad = eq.paciente_actual?.ciudad
    if (!ciudad) return
    const normalizada = normalizarCiudadPaciente(ciudad)
    conteoPorCiudad[normalizada] = (conteoPorCiudad[normalizada] || 0) + 1
  })

  const geojsonCesar = JSON.parse(
    fs.readFileSync(path.join(process.cwd(), 'public/geo/cesar-municipios.geojson'), 'utf8')
  )

  return (
    <DashboardClient
      totalEquipos={(equiposEstados || []).length}
      estadosEquipo={estadosEquipo}
      mantenimientosActivos={mantenimientosActivos || []}
      reglasAtencion={conteosAtencion || []}
      actividadReciente={actividadReciente || []}
      topClientes={topClientes}
      geojsonCesar={geojsonCesar}
      conteoPorCiudad={conteoPorCiudad}
    />
  )
}