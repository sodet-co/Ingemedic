// Datos del informe de un cliente o paciente, a partir de sus préstamos. Lo usan
// la pestaña "Línea de tiempo" del detalle, el PDF y el Excel, para que digan lo
// mismo. La línea de tiempo habla de equipos y personas ("Se prestó Cama
// hospitalaria a Ana Pérez"), no de códigos de orden: en Ingemedic nadie usa
// el número de préstamo.
//
// `ordenes`: filas de ordenes_servicio con
//   estado(nombre), cliente(nombre), paciente(nombre),
//   equipos: orden_equipos(fecha_entrega, fecha_devolucion, observaciones_devolucion,
//            equipo(codigo, tipo_equipo(nombre, atributos)))
// `esCliente`: el informe es de un cliente (nombra pacientes) o de un paciente
// (nombra al cliente).
// `entregas`: filas de entregas (tipo, modo, fecha_completada, estado, recibido_por,
//   datos, orden(id)) — de ahí salen las recargas y el modo de cada recogida o cambio
//   (lib/accionesPrestamo.js). Devuelve además `porEquipo`: la historia de cada
//   equipo que tuvo (prestado, recargas, cambios, devuelto), para el informe detallado.

import { diaLocal } from './fechas.js'

export const nombreTipo = t => t?.atributos?.nombre || t?.nombre || 'Equipo'
const dia = f => (f || '').slice(0, 10)

const MODO = { oficina: 'en oficina', domicilio: 'a domicilio' }

export function armarInforme(ordenes = [], { esCliente = true, entregas = [] } = {}) {
  const porEquipo = new Map()
  const historia = (eq, ev) => {
    if (!eq?.id && !eq?.codigo) return
    const k = eq.id || eq.codigo
    if (!porEquipo.has(k)) porEquipo.set(k, { id: eq.id || null, codigo: eq.codigo || '—', tipo: nombreTipo(eq.tipo_equipo), eventos: [] })
    porEquipo.get(k).eventos.push(ev)
  }
  const personaDe = new Map(ordenes.map(o => [o.id, esCliente ? o.paciente?.nombre : o.cliente?.nombre]))
  // Recogidas y cambios con acta: cómo se hicieron (para el detalle)
  const completadas = (entregas || []).filter(e => e.estado?.nombre === 'Completada' && e.tipo && e.tipo !== 'entrega')
  const activos = []
  const grupos = new Map()
  const agregar = (clave, base, codigo) => {
    if (!grupos.has(clave)) grupos.set(clave, { ...base, codigos: [] })
    grupos.get(clave).codigos.push(codigo)
  }

  for (const o of ordenes) {
    const cerrada = ['Finalizada', 'Cancelada'].includes(o.estado?.nombre)
    const persona = esCliente ? o.paciente?.nombre : o.cliente?.nombre
    for (const oe of o.equipos || []) {
      const tipo = nombreTipo(oe.equipo?.tipo_equipo)
      const codigo = oe.equipo?.codigo || '—'
      if (oe.fecha_entrega && !oe.fecha_devolucion && !cerrada) {
        activos.push({ codigo, tipo, paciente: o.paciente?.nombre || null, cliente: o.cliente?.nombre || null, desde: oe.fecha_entrega })
      }
      if (oe.fecha_entrega) {
        agregar(`p|${o.id}|${dia(oe.fecha_entrega)}|${tipo}`, { tipo: 'prestamo', fecha: oe.fecha_entrega, equipo: tipo, persona }, codigo)
        historia(oe.equipo, { tipo: 'prestamo', fecha: oe.fecha_entrega, texto: `Prestado${persona ? (esCliente ? ` a ${persona}` : ` por ${persona}`) : ''}` })
      }
      if (oe.fecha_devolucion) {
        const obs = oe.observaciones_devolucion || ''
        historia(oe.equipo, /^Cambiado por/i.test(obs)
          ? { tipo: 'cambio', fecha: oe.fecha_devolucion, texto: `Cambiado por ${obs.replace(/^Cambiado por\s*/i, '')}` }
          : { tipo: 'devolucion', fecha: oe.fecha_devolucion, texto: `Devuelto${obs ? ` · ${obs}` : ''}` })
        if (/^Cambiado por/i.test(obs)) {
          agregar(`c|${o.id}|${dia(oe.fecha_devolucion)}|${codigo}`, { tipo: 'cambio', fecha: oe.fecha_devolucion, equipo: tipo, persona, nota: obs.replace(/^Cambiado por\s*/i, '') }, codigo)
        } else {
          agregar(`d|${o.id}|${dia(oe.fecha_devolucion)}|${tipo}`, { tipo: 'devolucion', fecha: oe.fecha_devolucion, equipo: tipo, persona, nota: obs || null }, codigo)
        }
      }
    }
  }

  // Recargas (solo existen como acción)
  for (const e of completadas.filter(e => e.tipo === 'recarga')) {
    const persona = personaDe.get(e.orden?.id || e.orden_id)
    const eqs = (e.datos?.equipos || []).map(x => x.equipo).filter(Boolean)
    for (const eq of eqs) historia(eq, { tipo: 'recarga', fecha: e.fecha_completada, texto: `Recargado ${MODO[e.modo] || ''}${e.recibido_por ? ` · recibió ${e.recibido_por}` : ''}`.trim() })
    if (!eqs.length) continue
    const tipos = [...new Set(eqs.map(eq => nombreTipo(eq.tipo_equipo)))]
    agregar(`r|${e.id}`, { tipo: 'recarga', fecha: e.fecha_completada, equipo: tipos.join(', '), persona, nota: MODO[e.modo] }, eqs.map(eq => eq.codigo).join(', '))
  }

  const eventos = [...grupos.values()].map(g => {
    const n = g.codigos.length
    const cuantos = n > 1 ? `${n} × ${g.equipo}` : g.equipo
    const quien = g.persona ? (esCliente ? ` a ${g.persona}` : ` de ${g.persona}`) : ''
    const texto =
      g.tipo === 'prestamo' ? `Se ${n > 1 ? 'prestaron' : 'prestó'} ${cuantos}${quien}` :
      g.tipo === 'devolucion' ? `Se ${n > 1 ? 'devolvieron' : 'devolvió'} ${cuantos}${g.persona ? (esCliente ? ` de ${g.persona}` : '') : ''}` :
      g.tipo === 'recarga' ? `Se recargó ${g.equipo}${quien}` :
      `Se cambió ${g.equipo} por ${g.nota}`
    return { tipo: g.tipo, fecha: g.fecha, texto, detalle: [g.codigos.join(', '), ['devolucion', 'recarga'].includes(g.tipo) ? g.nota : null].filter(Boolean).join(' · ') }
  }).sort((a, b) => new Date(b.fecha) - new Date(a.fecha))

  const porPaciente = new Map()
  for (const a of activos) {
    const k = a.paciente || 'Sin paciente'
    porPaciente.set(k, (porPaciente.get(k) || 0) + 1)
  }
  const pacientes = [...porPaciente.entries()].map(([nombre, equipos]) => ({ nombre, equipos }))
    .sort((a, b) => b.equipos - a.equipos || a.nombre.localeCompare(b.nombre))

  activos.sort((a, b) => a.tipo.localeCompare(b.tipo) || a.codigo.localeCompare(b.codigo))
  // Por día y, el mismo día, en el orden en que pasan las cosas: la devolución y el
  // cambio guardan solo el día (orden_equipos.fecha_devolucion) y si no saldrían
  // antes que el préstamo de esa misma mañana
  const RANGO = { prestamo: 0, recarga: 1, cambio: 2, devolucion: 3 }
  const equipos = [...porEquipo.values()]
    .map(x => ({ ...x, eventos: x.eventos.sort((a, b) => diaLocal(a.fecha).localeCompare(diaLocal(b.fecha)) || (RANGO[a.tipo] ?? 9) - (RANGO[b.tipo] ?? 9) || new Date(a.fecha) - new Date(b.fecha)) }))
    .sort((a, b) => a.tipo.localeCompare(b.tipo) || a.codigo.localeCompare(b.codigo))
  return { activos, pacientes, eventos, porEquipo: equipos, totalPrestamos: ordenes.filter(o => o.estado?.nombre !== 'Cancelada').length }
}
