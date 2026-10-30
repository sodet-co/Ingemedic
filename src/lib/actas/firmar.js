// Datos y guardado de las actas de un préstamo. Lo usan el paso de firma
// (components/actas/FirmaActas.js) —en Entregas, en la vista del repartidor y al
// crear un préstamo en oficina— y la descarga del PDF.
import { plantillasSugeridas } from './acciones.js'
import { paraPlantilla } from './contexto.js'

const SELECT_ORDEN = `
  id, codigo, diagnostico, plantillas_acta, datos_acta, cliente_id,
  cliente:clientes(id, nombre, nit_cc),
  paciente:pacientes(id, nombre, cedula, tipo_documento, direccion, barrio, ciudad, telefono, correo, eps, fecha_nacimiento),
  equipos:orden_equipos(id, fecha_entrega, fecha_devolucion, equipo:equipos(id, codigo, atributos, tipo_equipo_id,
    tipo_equipo:tipos_equipo(id, nombre, atributos, categoria:categorias_equipo(id, nombre))))
`

export const SELECT_PLANTILLAS = 'id, nombre, descripcion, tipo, es_estandar, accion, uso_general, bloques, clientes:cliente_plantillas_acta(orden, cliente_id)'

// Formatos que se sugieren al crear un préstamo (y en las demás acciones): lib/actas/acciones.js
export { plantillasSugeridas }

// Todo lo que necesita el paso de firma de un préstamo. plantillaIds: los
// formatos de otra acción (recogida, recarga, cambio); si no, los del préstamo.
export async function cargarParaFirma(supabase, ordenId, { plantillaIds } = {}) {
  const [{ data: orden, error }, { data: plantillas, error: errP }, { data: empresa }, { data: { user } }] = await Promise.all([
    supabase.from('ordenes_servicio').select(SELECT_ORDEN).eq('id', ordenId).single(),
    supabase.from('plantillas_acta').select(SELECT_PLANTILLAS).eq('activo', true),
    supabase.from('configuracion_empresa').select('razon_social, nit, dir, tel, email, rep').single(),
    supabase.auth.getUser(),
  ])
  if (error || errP) throw error || errP
  const { data: usuario } = user?.email
    ? await supabase.from('usuarios').select('id, nombre, cargo, cedula, tipo_documento').eq('email', user.email).maybeSingle()
    : { data: null }

  // Los formatos elegidos al crear el préstamo; los préstamos viejos no tienen y usan la sugerencia
  const equipos = (orden.equipos || []).filter(oe => !oe.fecha_devolucion).map(oe => oe.equipo).filter(Boolean)
  const ids = plantillaIds || (orden.plantillas_acta?.length ? orden.plantillas_acta : plantillasSugeridas(plantillas, orden.cliente_id, 'prestamo', equipos))
  const elegidas = ids.map(id => plantillas.find(p => p.id === id)).filter(Boolean)
  return {
    orden,
    equipos,
    plantillas: elegidas,
    empresa: empresa || {},
    usuario: usuario || {},
  }
}

// Guarda una fila de `actas` por plantilla, con copia de los bloques y del
// contexto: el acta firmada no cambia aunque después se edite la plantilla, el
// paciente o el equipo.
export async function guardarActas(supabase, { ordenId, entregaId = null, accion = 'prestamo', plantillas, ctx, firmas }) {
  const { data: { user } } = await supabase.auth.getUser()
  // Cada acta con lo suyo: sus renglones escritos y, si la plantilla es para algunas
  // categorías, solo esos equipos (contexto.js → paraPlantilla)
  const filas = plantillas.map(p => ({ p, c: paraPlantilla(ctx, p) })).map(({ p, c }) => ({
    orden_id: ordenId,
    entrega_id: entregaId,
    plantilla_id: p.id,
    accion: p.accion || accion,
    nombre: p.nombre,
    bloques: p.bloques,
    datos: { variables: c.variables, equipos: c.equipos, insumos: c.insumos, retirados: c.retirados, manuales: c.manuales },
    firma_recibe: firmas.recibe || null,
    firma_entrega: firmas.entrega || null,
    creado_por: user?.id || null,
  }))
  return supabase.from('actas').insert(filas).select('id, nombre')
}

// Contexto de render de un acta ya firmada (lo inverso de guardarActas)
export function contextoDeActa(acta) {
  const d = acta.datos || {}
  const responsable = !!d.variables?.responsable_nombre
  return {
    variables: d.variables || {},
    equipos: d.equipos || [],
    insumos: d.insumos || [],
    retirados: d.retirados || [],
    manuales: d.manuales || {},
    firmas: {
      recibe: acta.firma_recibe, entrega: acta.firma_entrega,
      [responsable ? 'responsable' : 'paciente']: acta.firma_recibe,
    },
  }
}
