// Acciones de un préstamo que llevan acta: prestar, recoger (devolución),
// recargar (cilindros) y cambiar un equipo. Cada plantilla es de UNA acción
// (plantillas_acta.accion): hay plantillas de préstamo, de devolución, de recarga…
//  - es_estandar: la de Ingemedic para su acción (una por acción); se usa cuando
//    el cliente no tiene una propia para esa acción.
//  - cliente_plantillas_acta: qué plantillas usa cada cliente (cada una ya dice su acción).

export const ACCIONES = {
  prestamo: 'Préstamo',
  devolucion: 'Devolución',
  recarga: 'Recarga',
  cambio: 'Cambio de equipo',
}

export const accionDe = p => p?.accion || 'prestamo'

// ¿Este tipo de equipo se recarga? Se marca en Configuración → Tipos
// (tipos_equipo.atributos.se_recarga); si no se ha marcado, los cilindros sí.
export const seRecarga = tipo => tipo?.atributos?.se_recarga ?? /cilindro/i.test(tipo?.categoria?.nombre || '')
export const sirvePara = (p, accion) => accionDe(p) === accion

// Las que se sugieren para una acción: las del cliente de esa acción, en su orden;
// si no tiene, la de Ingemedic de esa acción. Los anexos (pagaré) nunca se sugieren.
export function plantillasSugeridas(plantillas, clienteId, accion = 'prestamo') {
  const candidatas = (plantillas || []).filter(p => (p.tipo || 'entrega') === 'entrega' && sirvePara(p, accion))
  const delCliente = candidatas
    .map(p => ({ p, rel: (p.clientes || []).find(c => c.cliente_id === clienteId) }))
    .filter(x => x.rel)
    .sort((a, b) => a.rel.orden - b.rel.orden)
    .map(x => x.p.id)
  if (delCliente.length) return delCliente
  const estandar = candidatas.find(p => p.es_estandar)
  return estandar ? [estandar.id] : []
}

// Las que se pueden elegir para una acción: las del cliente, las de uso general,
// la de Ingemedic y las ya elegidas
export function plantillasOfrecidas(plantillas, clienteId, accion = 'prestamo', elegidas = []) {
  return (plantillas || []).filter(p => sirvePara(p, accion) && (
    p.uso_general || p.es_estandar || elegidas.includes(p.id) || (p.clientes || []).some(c => c.cliente_id === clienteId)))
}
