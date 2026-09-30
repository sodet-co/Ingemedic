// ── CONTROL DE ACCESO POR ROL ──────────────────────────────────────────────
// Modelo "todo permitido salvo excepción explícita": si NO existe una fila en
// `permisos` para (rol_id, módulo) con puede_ver = false, el rol SÍ puede ver
// ese módulo. Solo se crean filas cuando se restringe algo puntual.
//
// SuperAdmin es inmune a esta tabla por completo — se resuelve ANTES de
// consultarla, comparando el nombre del rol directamente (ver esSuperAdmin).
//
// Los nombres de módulo son los mismos que ya existían en la tabla `permisos`
// desde antes de este sistema (ej. 'ordenes_servicio', no 'prestamos') para no
// desalinear con datos ya sembrados.

export const MODULOS_RUTA = [
  { modulo: 'dashboard',            ruta: '/dashboard' },
  { modulo: 'entregas',             ruta: '/entregas' },
  { modulo: 'inventario',           ruta: '/inventario' },
  { modulo: 'ordenes_servicio',     ruta: '/ordenes' },
  { modulo: 'clientes',             ruta: '/clientes' },
  { modulo: 'mantenimientos',       ruta: '/mantenimientos' },
  { modulo: 'servicios_prestados',  ruta: '/servicios' },
  { modulo: 'bitacora',             ruta: '/bitacora' },
  { modulo: 'configuracion',        ruta: '/configuracion' },
]

// Módulos "principales" (para el listado de checkboxes de Roles y Permisos),
// en el mismo orden en que aparecen en el Sidebar.
export const MODULOS_PRINCIPALES = [
  { modulo: 'dashboard',           label: 'Dashboard' },
  { modulo: 'entregas',            label: 'Entregas' },
  { modulo: 'inventario',          label: 'Inventario' },
  { modulo: 'ordenes_servicio',    label: 'Préstamos' },
  { modulo: 'clientes',            label: 'Clientes' },
  { modulo: 'mantenimientos',      label: 'Mantenimientos' },
  { modulo: 'servicios_prestados', label: 'Servicios prestados' },
  { modulo: 'bitacora',            label: 'Bitácora' },
  { modulo: 'configuracion',       label: 'Configuración (módulo completo)' },
]

// Secciones internas de Configuración — cada una es su propio módulo con
// prefijo 'configuracion.' para poder restringirse por separado del resto.
export const MODULOS_CONFIGURACION = [
  { modulo: 'configuracion.usuarios',     label: 'Usuarios' },
  { modulo: 'configuracion.roles',        label: 'Roles y permisos' },
  { modulo: 'configuracion.categorias',   label: 'Categorías' },
  { modulo: 'configuracion.tipos',        label: 'Tipos de equipo' },
  { modulo: 'configuracion.listas',       label: 'Listas de mantenimiento' },
  { modulo: 'configuracion.empresa',      label: 'Datos de la empresa' },
  { modulo: 'configuracion.plantillas',   label: 'Plantillas documentos' },
  { modulo: 'configuracion.cargue',       label: 'Cargue masivo' },
  { modulo: 'configuracion.preferencias', label: 'Preferencias' },
]

// Módulos cuyo comportamiento por defecto está INVERTIDO: ocultos salvo
// permiso explícito (puede_ver = true). Hoy solo "Roles y permisos" — es un
// área sensible que no debe aparecer abierta de entrada para ningún rol,
// ni siquiera Administrador; se habilita a mano, rol por rol.
export const MODULOS_OCULTOS_POR_DEFECTO = ['configuracion.roles']

export function esSuperAdmin(rolNombre) {
  return rolNombre === 'SuperAdmin'
}

export function moduloDeRuta(pathname) {
  const match = MODULOS_RUTA.find(m => pathname === m.ruta || pathname.startsWith(m.ruta + '/'))
  return match?.modulo || null
}

// `permisosDelRol` es el array de filas { modulo, puede_ver } ya traído para
// un rol_id puntual (una sola consulta por rol, no una por módulo).
export function puedeVerModulo(modulo, permisosDelRol) {
  const fila = (permisosDelRol || []).find(p => p.modulo === modulo)
  if (MODULOS_OCULTOS_POR_DEFECTO.includes(modulo)) {
    return fila?.puede_ver === true
  }
  return !fila || fila.puede_ver !== false
}

// Primer módulo principal permitido para un rol — usado por el middleware
// para redirigir cuando el usuario intenta entrar a un módulo restringido.
export function primerModuloPermitido(permisosDelRol) {
  const encontrado = MODULOS_PRINCIPALES.find(m => puedeVerModulo(m.modulo, permisosDelRol))
  return encontrado?.modulo || null
}
