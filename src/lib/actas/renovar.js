// Renovación de un acta firmada (plantilla marcada Renovable en el editor): algunos
// formatos se renuevan cada mes; cambia la fecha (y lo que se quiera corregir) pero
// la firma del cliente se mantiene. Se guarda como un acta nueva del préstamo
// (accion 'renovacion', con la misma firma) y queda en el historial (bitácora 'renovar').
import { registrarBitacora } from '../bitacora'

const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio',
  'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre']

// 'AAAA-MM-DD' → las variables de fecha del acta (contexto.js: fecha, dia, mes, anio)
export function variablesDeFecha(iso) {
  const [a, m, d] = String(iso).split('-').map(Number)
  if (!a || !m || !d) return {}
  return { fecha: `${String(d).padStart(2, '0')}/${String(m).padStart(2, '0')}/${a}`, dia: String(d), mes: MESES[m - 1], anio: String(a) }
}

// Las {{variables}} que usa el acta, en el orden en que aparecen
export const variablesDelActa = bloques => [...new Set([...JSON.stringify(bloques || []).matchAll(/\{\{\s*([a-z0-9_]+)\s*\}\}/gi)].map(m => m[1]))]

// El acta de la que sale una renovación (la primera, no otra renovación). Un formato aún
// sin firmar no está guardado (id 'p-<plantilla>'): sus renovaciones van con ese id
export const actaRaiz = acta => acta?.datos?.renovacion?.de || acta?.id

// Guarda la renovación. acta: la fila de `actas` que se renueva; fecha: 'AAAA-MM-DD';
// cambios: { variable: valor } escrito en la ventana (fecha incluida).
export async function renovarActa(supabase, { acta, ordenId, fecha, cambios }) {
  const { data: { user } } = await supabase.auth.getUser()
  // Solo lo del acta (un formato aún sin firmar trae el contexto completo del préstamo)
  const { variables, equipos, insumos, retirados, manuales } = acta.datos || {}
  const d = { variables, equipos, insumos, retirados, manuales }
  const fila = {
    orden_id: ordenId,
    // Sin visita: si no, el PDF de esa entrega (Entregas) traería las renovaciones; de
    // cuál venía queda en datos.renovacion
    entrega_id: null,
    plantilla_id: acta.plantilla_id || null,
    accion: 'renovacion',
    nombre: acta.nombre,
    bloques: acta.bloques,
    datos: { ...d, variables: { ...(d.variables || {}), ...variablesDeFecha(fecha), ...cambios }, renovacion: { de: actaRaiz(acta), fecha, entrega_id: acta.entrega_id || null } },
    // La misma firma; si el acta aún no tenía, la renovación también queda sin firma
    firma_recibe: acta.firma_recibe || null,
    firma_entrega: acta.firma_entrega || null,
    creado_por: user?.id || null,
  }
  const { data, error } = await supabase.from('actas').insert(fila).select('id').single()
  if (error) return { error }
  // RLS no avisa: si no volvió la fila, no se guardó
  if (!data?.id) return { error: { message: 'No se guardó la renovación (permisos de la tabla actas).' } }
  registrarBitacora({ modulo: 'ordenes', accion: 'renovar', entidad: 'acta', entidad_id: ordenId,
    detalle: { acta: acta.nombre, acta_id: data.id, de: actaRaiz(acta), fecha_acta: variablesDeFecha(fecha).fecha } })
  return { id: data.id }
}
