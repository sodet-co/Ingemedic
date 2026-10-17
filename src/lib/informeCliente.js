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

export const nombreTipo = t => t?.atributos?.nombre || t?.nombre || 'Equipo'
const dia = f => (f || '').slice(0, 10)

export function armarInforme(ordenes = [], { esCliente = true } = {}) {
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
      }
      if (oe.fecha_devolucion) {
        const obs = oe.observaciones_devolucion || ''
        if (/^Cambiado por/i.test(obs)) {
          agregar(`c|${o.id}|${dia(oe.fecha_devolucion)}|${codigo}`, { tipo: 'cambio', fecha: oe.fecha_devolucion, equipo: tipo, persona, nota: obs.replace(/^Cambiado por\s*/i, '') }, codigo)
        } else {
          agregar(`d|${o.id}|${dia(oe.fecha_devolucion)}|${tipo}`, { tipo: 'devolucion', fecha: oe.fecha_devolucion, equipo: tipo, persona, nota: obs || null }, codigo)
        }
      }
    }
  }

  const eventos = [...grupos.values()].map(g => {
    const n = g.codigos.length
    const cuantos = n > 1 ? `${n} × ${g.equipo}` : g.equipo
    const quien = g.persona ? (esCliente ? ` a ${g.persona}` : ` de ${g.persona}`) : ''
    const texto =
      g.tipo === 'prestamo' ? `Se ${n > 1 ? 'prestaron' : 'prestó'} ${cuantos}${quien}` :
      g.tipo === 'devolucion' ? `Se ${n > 1 ? 'devolvieron' : 'devolvió'} ${cuantos}${g.persona ? (esCliente ? ` de ${g.persona}` : '') : ''}` :
      `Se cambió ${g.equipo} por ${g.nota}`
    return { tipo: g.tipo, fecha: g.fecha, texto, detalle: [g.codigos.join(', '), g.tipo === 'devolucion' ? g.nota : null].filter(Boolean).join(' · ') }
  }).sort((a, b) => new Date(b.fecha) - new Date(a.fecha))

  const porPaciente = new Map()
  for (const a of activos) {
    const k = a.paciente || 'Sin paciente'
    porPaciente.set(k, (porPaciente.get(k) || 0) + 1)
  }
  const pacientes = [...porPaciente.entries()].map(([nombre, equipos]) => ({ nombre, equipos }))
    .sort((a, b) => b.equipos - a.equipos || a.nombre.localeCompare(b.nombre))

  activos.sort((a, b) => a.tipo.localeCompare(b.tipo) || a.codigo.localeCompare(b.codigo))
  return { activos, pacientes, eventos, totalPrestamos: ordenes.filter(o => o.estado?.nombre !== 'Cancelada').length }
}
