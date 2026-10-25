import { formatear, formatearSoloFecha, diaLocal } from './fechas.js'
import { NOMBRE_ACCION, accionDeEntrega, esRecargaVisita } from './accionesPrestamo.js'

// Eventos del historial de un préstamo (components/prestamos/HistorialPrestamo.js).
// orden: el préstamo con equipos (orden_equipos con equipo) y visitas (entregas con
// estado, repartidor, datos); bitacora: filas de la bitácora del préstamo y de sus
// visitas, con usuario(nombre). Devuelve [{ tipo, fecha, texto, detalle, quien, visita }]
// del más nuevo al más viejo.

const nombreEquipo = eq => eq?.tipo_equipo?.atributos?.nombre || eq?.tipo_equipo?.nombre || 'Equipo'
const lista = eqs => eqs.map(e => e?.codigo).filter(Boolean).join(', ')
const duracion = m => m == null ? null : m < 60 ? `${Math.max(1, m)} min` : `${Math.floor(m / 60)} h${m % 60 ? ` ${m % 60} min` : ''}`

export function armarHistorialPrestamo(orden, bitacora = []) {
  const visitas = orden.visitas || []
    const ev = []
    const quien = (entidadId, accion) => bitacora.find(b => b.entidad_id === entidadId && (!accion || b.accion === accion))?.usuario?.nombre
    const creacion = bitacora.find(b => b.entidad_id === orden.id && b.accion === 'crear')

    ev.push({ tipo: 'creado', fecha: orden.fecha_creacion, texto: `Préstamo creado${creacion?.detalle?.con_domicilio ? ' para entregar a domicilio' : ' en oficina'}`, quien: creacion?.usuario?.nombre })

    // Equipos que salieron con el préstamo (por día) y los que entraron después en un cambio
    const cubiertos = new Set() // orden_equipos que ya cuenta una visita (recogida o cambio)
    for (const v of visitas) {
      if (v.estado?.nombre !== 'Completada') continue
      for (const x of v.datos?.equipos || []) if (v.tipo === 'retiro') cubiertos.add(x.orden_equipo_id)
      for (const c of v.datos?.cambios || []) cubiertos.add(c.orden_equipo_id)
    }
    const entrantes = new Set(visitas.flatMap(v => (v.datos?.cambios || []).map(c => c.entra?.id)))
    const porDia = new Map()
    for (const oe of orden.equipos || []) {
      if (oe.fecha_entrega && !entrantes.has(oe.equipo?.id)) {
        const k = diaLocal(oe.fecha_entrega)
        if (!porDia.has(k)) porDia.set(k, { fecha: oe.fecha_entrega, eqs: [] })
        porDia.get(k).eqs.push(oe.equipo)
      }
      // Devoluciones y cambios hechos sin acta (antes de las acciones, o al finalizar)
      if (oe.fecha_devolucion && !cubiertos.has(oe.id)) {
        const obs = oe.observaciones_devolucion || ''
        ev.push(/^Cambiado por/i.test(obs)
          ? { tipo: 'cambio', fecha: oe.fecha_devolucion, texto: `${oe.equipo?.codigo} ${obs.charAt(0).toLowerCase()}${obs.slice(1)}`, detalle: nombreEquipo(oe.equipo) }
          : { tipo: 'devolucion', fecha: oe.fecha_devolucion, texto: `Devuelto ${oe.equipo?.codigo} · ${nombreEquipo(oe.equipo)}`, detalle: obs || null })
      }
    }
    for (const { fecha, eqs } of porDia.values()) {
      ev.push({ tipo: 'entregado', fecha, texto: `${eqs.length === 1 ? 'Sale' : `Salen ${eqs.length} equipos`}: ${eqs.map(e => `${e?.codigo} ${nombreEquipo(e)}`).join(' · ')}` })
    }

    // Visitas: la entrega a domicilio y las recogidas, recargas y cambios
    for (const v of visitas) {
      const accion = accionDeEntrega(v)
      const nombre = esRecargaVisita(v) ? 'Recarga' : NOMBRE_ACCION[accion]
      // La entrega del préstamo no guarda sus equipos: son los del préstamo (sin los que entraron en un cambio)
      const eqs = v.tipo === 'cambio' ? (v.datos?.cambios || []).map(c => `${c.sale?.codigo} → ${c.entra?.codigo}`).join(' · ')
        : accion === 'prestamo' ? (orden.equipos || []).filter(oe => !entrantes.has(oe.equipo?.id)).map(oe => `${oe.equipo?.codigo} ${nombreEquipo(oe.equipo)}`).join(' · ')
        : lista((v.datos?.equipos || []).map(x => x.equipo))
      const como = v.modo === 'oficina' ? 'en oficina' : `a domicilio${v.repartidor?.nombre ? ` por ${v.repartidor.nombre}` : ''}`
      const estado = v.estado?.nombre
      if (estado === 'Completada') {
        const tipo = accion === 'prestamo' ? 'entrega' : esRecargaVisita(v) ? 'recarga' : accion
        const texto = accion === 'prestamo' ? `Entregado a domicilio${v.repartidor?.nombre ? ` por ${v.repartidor.nombre}` : ''}` : `${nombre} ${como}`
        ev.push({
          tipo, fecha: v.fecha_completada, texto, visita: v,
          detalle: [eqs, v.recibido_por && `${accion === 'devolucion' ? 'entregó' : 'recibió'} ${v.recibido_por}`, v.modo !== 'oficina' && duracion(v.duracion_minutos), v.datos?.motivo && `motivo: ${v.datos.motivo}`].filter(Boolean).join(' · '),
          quien: v.modo === 'oficina' ? quien(v.id) : null,
        })
      } else if (estado === 'Cancelada') {
        ev.push({ tipo: 'cancelado', fecha: v.fecha_creacion || v.fecha_programada, texto: `${nombre} cancelada`, detalle: eqs, quien: quien(v.id, 'cancelar') || quien(orden.id, 'cancelar') })
      } else if (accion !== 'prestamo') {
        ev.push({ tipo: 'programado', fecha: v.fecha_creacion || v.fecha_programada,
          texto: `${nombre} programada ${como}${v.fecha_programada ? ` para el ${formatear(v.fecha_programada, { hour: '2-digit', minute: '2-digit' })}` : ''}`,
          detalle: [eqs, estado === 'En progreso' ? 'en camino' : 'por iniciar'].filter(Boolean).join(' · '), quien: quien(v.id, 'crear') })
      }
    }

    // De la bitácora: vigencia, frecuencia de recarga y cancelación
    for (const b of bitacora.filter(b => b.entidad_id === orden.id)) {
      if (b.accion === 'editar' && b.detalle && 'fecha_vigencia' in b.detalle && !b.detalle.cliente_id) {
        ev.push({ tipo: 'vigencia', fecha: b.fecha, texto: b.detalle.fecha_vigencia ? `Vigencia hasta el ${formatearSoloFecha(b.detalle.fecha_vigencia)}` : 'Préstamo sin fecha de vencimiento', quien: b.usuario?.nombre })
      } else if (b.accion === 'editar' && b.detalle && 'recarga_cada_dias' in b.detalle) {
        ev.push({ tipo: 'recarga', fecha: b.fecha, texto: b.detalle.recarga_cada_dias ? `Recarga cada ${b.detalle.recarga_cada_dias} días` : 'Recarga solo a demanda', quien: b.usuario?.nombre })
      } else if (b.accion === 'editar' && b.detalle?.cambio_equipo) {
        // Cambio sin acta (antes de entregar): ya sale por orden_equipos si hubo historial
        if (!b.detalle.con_historial) ev.push({ tipo: 'cambio', fecha: b.fecha, texto: `${b.detalle.cambio_equipo.sale} cambiado por ${b.detalle.cambio_equipo.entra} antes de entregar`, detalle: b.detalle.motivo || null, quien: b.usuario?.nombre })
      } else if (b.accion === 'cancelar' && b.entidad === 'préstamo') {
        ev.push({ tipo: 'cancelado', fecha: b.fecha, texto: 'Préstamo cancelado', quien: b.usuario?.nombre })
      }
    }

    if (orden.estado?.nombre === 'Finalizada') {
      const ultima = (orden.equipos || []).map(oe => oe.fecha_devolucion).filter(Boolean).sort().pop()
      if (ultima) ev.push({ tipo: 'finalizado', fecha: ultima, texto: 'Préstamo finalizado: todos los equipos devueltos' })
    }

    // Por día de Colombia (varias fechas guardan solo el día) y, el mismo día, en el orden en que pasan
    const RANGO = { creado: 0, programado: 1, entrega: 2, entregado: 3, vigencia: 4, recarga: 5, cambio: 6, devolucion: 7, cancelado: 8, finalizado: 9 }
    return ev.filter(e => e.fecha).sort((a, b) => diaLocal(b.fecha).localeCompare(diaLocal(a.fecha)) || (RANGO[b.tipo] ?? 0) - (RANGO[a.tipo] ?? 0) || new Date(b.fecha) - new Date(a.fecha))
}
