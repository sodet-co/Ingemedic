import { formatearSoloFecha } from '@/lib/fechas'
import { MODULOS_PRINCIPALES, MODULOS_CONFIGURACION } from '@/lib/permisos'

// Convierte un registro de la bitácora en una frase legible para la columna
// "Detalle". Antes se mostraba el `detalle` (jsonb) tal cual, con uuids y
// claves de código. Lo que se guarda no cambia: esto solo es cómo se lee, así
// que sirve igual para los registros viejos.
//
// Al registrar una acción nueva con registrarBitacora() no hace falta tocar
// este archivo: si no hay un caso específico, cae en la frase genérica
// ("Editó el cliente X"). Solo se agrega un caso cuando el detalle trae algo
// que valga la pena contar mejor.

const VERBOS = {
  crear: 'Creó', editar: 'Editó', eliminar: 'Eliminó', activar: 'Activó',
  desactivar: 'Desactivó', cerrar: 'Cerró', avanzar: 'Avanzó', cancelar: 'Canceló', renovar: 'Renovó',
}

// Entidades con artículo femenino; el resto usa "el"
const FEMENINAS = ['acta', 'entrega','categoría de equipo', 'lista de mantenimiento', 'configuración de empresa', 'contraseña', 'orden de servicio', 'sesión']

const NOMBRE_MODULO = Object.fromEntries(
  [...MODULOS_PRINCIPALES, ...MODULOS_CONFIGURACION].map(m => [m.modulo, m.label])
)

const equipos = n => `${n} equipo${n === 1 ? '' : 's'}`

// `clientes` es un mapa { id: nombre } para nombrar al cliente de un préstamo
// (el detalle solo guarda su id).
export function describirBitacora(r, clientes = {}) {
  const d = r.detalle && typeof r.detalle === 'object' ? r.detalle : {}
  if (d.descripcion) return d.descripcion

  const { accion, entidad } = r

  if (accion === 'login')  return d.email ? `Inició sesión con ${d.email}` : 'Inició sesión'
  if (accion === 'logout') return 'Cerró sesión'

  if (entidad === 'préstamo') {
    if (accion === 'crear') {
      const n = Array.isArray(d.equipos_ids) ? d.equipos_ids.length : d.equipo_id ? 1 : 0
      const cliente = clientes[d.cliente_id]
      return [
        `Creó un préstamo${n ? ` de ${equipos(n)}` : ''}${cliente ? ` para ${cliente}` : ''}`,
        d.con_domicilio ? 'con domicilio' : 'sin domicilio',
        d.fecha_vigencia ? `vigente hasta el ${formatearSoloFecha(d.fecha_vigencia)}` : null,
      ].filter(Boolean).join(', ')
    }
    if (d.cambio_equipo) {
      return `Cambió el equipo ${d.cambio_equipo.sale || '—'} por ${d.cambio_equipo.entra || '—'}`
        + `${d.codigo ? ` en el préstamo ${d.codigo}` : ''}${d.motivo ? ` · motivo: ${d.motivo}` : ''}`
    }
    if (accion === 'editar' && d.fecha_vigencia) {
      return `Cambió la vigencia del préstamo al ${formatearSoloFecha(d.fecha_vigencia)}`
    }
  }

  // Extensión de vigencia desde el panel de atención
  if (d.observacion) return d.observacion

  if (entidad === 'permiso') {
    const modulo = NOMBRE_MODULO[d.modulo] || d.modulo || 'un módulo'
    return `${d.puede_ver ? 'Habilitó' : 'Ocultó'} «${modulo}»${d.rol ? ` para el rol ${d.rol}` : ''}`
  }

  if (entidad === 'portal de clientes') {
    return d.activo ? 'Habilitó el portal de clientes' : 'Bloqueó el portal de clientes'
  }

  if (entidad === 'acceso al portal') {
    const de = d.cliente ? ` de ${d.cliente}` : ''
    if (accion === 'crear')    return `Creó el acceso al portal${de}${d.email ? ` (${d.email})` : ''}`
    if (accion === 'eliminar') return `Quitó el acceso al portal${de}`
    if (d.cambio)              return `Cambió la ${d.cambio} del portal${de}`
  }

  if (entidad === 'contraseña') return 'Cambió su contraseña'
  if (entidad === 'configuración de empresa') return 'Editó los datos de la empresa'

  if (entidad === 'entrega') {
    const codigo = d.codigo ? ` ${d.codigo}` : ''
    if (accion === 'avanzar') {
      // Al iniciar, el código que se guarda es el del préstamo (la entrega aún no tiene el suyo)
      return d.estado === 'iniciada'
        ? `Inició la entrega${d.codigo ? ` del préstamo ${d.codigo}` : ''}`
        : `La entrega${codigo} pasó a «${d.estado || '—'}»`
    }
    if (accion === 'cerrar') {
      const tipo = d.tipo && d.tipo !== 'entrega' ? ` (${d.tipo})` : ''
      return `Cerró la entrega${codigo}${tipo}${d.recibido_por ? ` · recibió ${d.recibido_por}` : ''}`
    }
  }

  if (entidad === 'mantenimiento') {
    const codigo = d.codigo ? ` ${d.codigo}` : ''
    if (accion === 'crear')  return `Abrió el mantenimiento${codigo}${d.equipo ? ` del equipo ${d.equipo}` : ''}`
    if (accion === 'cerrar') return `Cerró el mantenimiento${codigo}${d.equipo_queda ? ` · el equipo queda «${d.equipo_queda}»` : ''}`
  }

  // Frase genérica: verbo + artículo + entidad + lo que la identifica
  const verbo = VERBOS[accion] || (accion ? accion.charAt(0).toUpperCase() + accion.slice(1) : 'Acción sobre')
  const articulo = FEMENINAS.includes(entidad) ? 'la' : 'el'
  const quien = d.nombre || d.codigo || d.cliente || d.razon_social || ''
  const extra = d.email && d.email !== quien ? ` (${d.email})` : ''
  const cambio = d.codigo_anterior ? ` (antes ${d.codigo_anterior})` : ''
  const arrastra = Array.isArray(d.equipos_eliminados) && d.equipos_eliminados.length ? ` con ${equipos(d.equipos_eliminados.length)}` : ''
  const cerrados = Array.isArray(d.prestamos_cerrados) && d.prestamos_cerrados.length ? ` · cerró ${d.prestamos_cerrados.join(', ')}` : ''
  const motivo = d.motivo ? ` — ${d.motivo}` : ''
  return `${verbo} ${entidad ? `${articulo} ${entidad}` : 'un registro'}${quien ? ` ${quien}` : ''}${extra}${cambio}${arrastra}${cerrados}${motivo}`
}
