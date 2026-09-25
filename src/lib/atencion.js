import { hoyBogota, sumarDias } from '@/lib/fechas'
import { estaVencida, diasParaVencer } from '@/lib/vigencia'

// Motor de reglas de atención — cada regla sabe consultar sus propios
// candidatos y filtrarlos con precisión (ver crearReglaVigencia). Agregar
// una regla nueva es agregar un objeto al arreglo REGLAS_ATENCION; nada
// más del dashboard, PanelAtencion ni BuzonNovedades necesita cambiar,
// leen el arreglo genéricamente.
//
// Las alertas se calculan en cada llamada a consulta() — nunca se guardan
// como filas. Si el equipo vuelve o la orden se extiende, la próxima
// consulta ya no la trae; no hay estado que se desincronice.

// estados_orden: excluir Finalizada y Cancelada de cualquier regla de
// vigencia — una orden en esos estados ya no está "en préstamo" activo.
const ESTADO_FINALIZADA = '45383dd9-7f9a-426d-830e-d093f105bef9'
const ESTADO_CANCELADA  = '6a595a41-89b1-4ab0-a1c3-9dec15a099ef'

const SELECT_ORDEN_ATENCION = `
  id, codigo, fecha_vigencia,
  cliente:clientes(id, nombre),
  paciente:pacientes(id, nombre),
  estado:estados_orden(id, nombre),
  equipos:orden_equipos(
    id, equipo_id, fecha_devolucion,
    equipo:equipos(id, codigo, tipo_equipo:tipos_equipo(id, nombre, atributos))
  )
`

// Claves pospuestas de esta regla que siguen vigentes (hasta > ahora).
// La clave es "<regla_id>:<orden_id>" — el prefijo aísla el pospuesto de
// una regla del de otra sobre la misma orden.
async function idsPospuestos(supabase, reglaId) {
  const prefijo = `${reglaId}:`
  const { data, error } = await supabase.from('atencion_pospuestas')
    .select('clave')
    .like('clave', `${prefijo}%`)
    .gt('hasta', new Date().toISOString())
  if (error) { console.error(`[atencion.js] Error consultando pospuestos de ${reglaId}:`, error.message); return [] }
  return (data || []).map(p => p.clave.slice(prefijo.length))
}

// Trae las órdenes con fecha_vigencia <= `hasta`, activas y no pospuestas.
// El filtro de fecha en la BD es deliberadamente amplio (una cota superior
// simple); el corte exacto lo aplica cada regla con estaVencida()/
// diasParaVencer() de src/lib/vigencia.js, para no poder nunca desacordar
// con el badge "Vencida" que ya usa esas mismas funciones en Préstamos.
async function ordenesConVigenciaHasta(supabase, { reglaId, hasta }) {
  const excluidos = await idsPospuestos(supabase, reglaId)
  let q = supabase.from('ordenes_servicio')
    .select(SELECT_ORDEN_ATENCION)
    .not('fecha_vigencia', 'is', null)
    .not('estado_id', 'in', `(${ESTADO_FINALIZADA},${ESTADO_CANCELADA})`)
    .lte('fecha_vigencia', hasta)
    .order('fecha_vigencia', { ascending: true })
  if (excluidos.length > 0) q = q.not('id', 'in', `(${excluidos.join(',')})`)
  const { data, error } = await q
  if (error) { console.error(`[atencion.js] Error consultando ${reglaId}:`, error.message); return [] }
  return data || []
}

function crearReglaVigencia({ id, titulo, severidad, hasta, filtroPreciso }) {
  return {
    id, titulo, severidad,
    acciones: ['recoger', 'extender', 'posponer'],
    // limite acota cuántas filas de detalle se devuelven — el conteo (ver
    // contarRegla) pide un limite alto porque en este dominio (préstamos
    // activos) el universo de candidatos ya es chico por sí solo.
    async consulta(supabase, { limite = 20 } = {}) {
      const candidatas = await ordenesConVigenciaHasta(supabase, { reglaId: id, hasta: hasta() })
      return candidatas.filter(filtroPreciso).slice(0, limite)
    },
  }
}

export const REGLAS_ATENCION = [
  crearReglaVigencia({
    id: 'prestamos_vencidos',
    titulo: 'Préstamos vencidos',
    severidad: 'alta',
    hasta: () => hoyBogota(),
    filtroPreciso: estaVencida,
  }),
  crearReglaVigencia({
    id: 'prestamos_por_vencer',
    titulo: 'Préstamos por vencer',
    severidad: 'media',
    hasta: () => sumarDias(hoyBogota(), 7),
    filtroPreciso: o => !estaVencida(o) && diasParaVencer(o) <= 7,
  }),
]

export async function contarRegla(supabase, regla) {
  const items = await regla.consulta(supabase, { limite: 500 })
  return items.length
}

// Clave para atencion_pospuestas — un solo lugar de verdad para el formato
// "<regla_id>:<orden_id>" que usan tanto la exclusión de consulta() como
// el upsert al posponer desde PanelAtencion/BuzonNovedades.
export function clavePospuesto(reglaId, ordenId) {
  return `${reglaId}:${ordenId}`
}
