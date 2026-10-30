// Acciones de un préstamo que llevan acta: prestar, recoger (devolución),
// recargar (cilindros) y cambiar un equipo. Cada plantilla es de UNA acción
// (plantillas_acta.accion): hay plantillas de préstamo, de devolución, de recarga…
//  - es_estandar: la de Ingemedic para su acción (una por acción); se usa cuando
//    el cliente no tiene una propia para esa acción.
//  - cliente_plantillas_acta: qué plantillas usa cada cliente (cada una ya dice su acción).
import { filaEquipo, categoriasDe, deCategorias } from './contexto.js'

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

// Expresiones de las filas impresas de equipos de una plantilla (F-FAM-11: "1. EQUIPO
// CPAP" → /\bc-?pap/). Una plantilla con filas así es de un tipo de equipo.
const filasDeEquipos = p => (p.bloques || [])
  .filter(b => b.tipo === 'tabla' && (b.fuente || 'equipos') === 'equipos' && b.filas_fijas?.length)
  .flatMap(b => b.filas_fijas.map(ff => ff.coincide).filter(Boolean))
  .map(re => { try { return new RegExp(re, 'i') } catch { return null } })
  .filter(Boolean)

// ¿Algún equipo del préstamo es para esta plantilla? Si la plantilla dice sus
// categorías (Equipos: Solo algunos, contexto.js → categoriasDe), por la categoría; si
// no, por sus filas impresas, con el mismo texto que mira render.js → tablaFija
const esDeTipo = p => categoriasDe(p.bloques).length > 0 || filasDeEquipos(p).length > 0
const llevaEquipo = (p, equipos) => {
  const categorias = categoriasDe(p.bloques)
  const filas = filasDeEquipos(p)
  return equipos.some(eq => {
    const f = filaEquipo(eq)
    return categorias.length ? deCategorias(f, categorias) : filas.some(r => r.test(`${f.descripcion} ${f.categoria} ${f.modelo} ${f.marca}`))
  })
}

// Las que se sugieren para una acción: las del cliente de esa acción, en su orden;
// si no tiene, la de Ingemedic de esa acción. Los anexos (pagaré) nunca se sugieren.
// Con `equipos` (unidades del inventario), las plantillas de un tipo de equipo (las
// que dicen sus categorías, o con filas impresas como el F-FAM-11) solo se sugieren si
// el préstamo lleva ese tipo; si ningún equipo encaja en ninguna, se dejan todas para
// que la persona elija.
export function plantillasSugeridas(plantillas, clienteId, accion = 'prestamo', equipos = null) {
  const candidatas = (plantillas || []).filter(p => (p.tipo || 'entrega') === 'entrega' && sirvePara(p, accion))
  let delCliente = candidatas
    .map(p => ({ p, rel: (p.clientes || []).find(c => c.cliente_id === clienteId) }))
    .filter(x => x.rel)
    .sort((a, b) => a.rel.orden - b.rel.orden)
    .map(x => x.p)
  if (equipos?.length) {
    const deTipo = delCliente.filter(esDeTipo)
    const encajan = new Set(deTipo.filter(p => llevaEquipo(p, equipos)).map(p => p.id))
    if (encajan.size) delCliente = delCliente.filter(p => !deTipo.includes(p) || encajan.has(p.id))
  }
  if (delCliente.length) return delCliente.map(p => p.id)
  const estandar = candidatas.find(p => p.es_estandar)
  return estandar ? [estandar.id] : []
}

// Lo mismo para varias acciones juntas (una recarga: cambio + recarga)
export const sugeridasDe = (plantillas, clienteId, acciones, equipos = null) => [...new Set(acciones.flatMap(a => plantillasSugeridas(plantillas, clienteId, a, equipos)))]
export const ofrecidasDe = (plantillas, clienteId, acciones, elegidas = []) => acciones.flatMap(a => plantillasOfrecidas(plantillas, clienteId, a, elegidas))
  .filter((p, i, l) => l.findIndex(x => x.id === p.id) === i)

// Las que se pueden elegir para una acción: las del cliente, las de uso general,
// la de Ingemedic y las ya elegidas
export function plantillasOfrecidas(plantillas, clienteId, accion = 'prestamo', elegidas = []) {
  return (plantillas || []).filter(p => sirvePara(p, accion) && (
    p.uso_general || p.es_estandar || elegidas.includes(p.id) || (p.clientes || []).some(c => c.cliente_id === clienteId)))
}
