// Interruptor global del portal de clientes. No usa columna propia: se guarda
// como un permiso más del rol "Cliente" (tabla `permisos`, módulo
// 'portal_clientes'), con el mismo modelo del resto del sistema: sin fila o con
// puede_ver = true → activo; puede_ver = false → bloqueado.
// Lo cambia solo un SuperAdmin desde Configuración → Portal de clientes. Con el
// portal bloqueado: el cliente que entra ve "Módulo bloqueado temporalmente",
// el login avisa en la pestaña "Soy cliente" y en Clientes no se pueden crear,
// cambiar ni quitar accesos (también lo rechaza /api/clientes/acceso).

export const ROL_CLIENTE_ID = 'c0820792-5e11-4ba5-8423-1f99bec152f7'
export const MODULO_PORTAL = 'portal_clientes'
export const MENSAJE_PORTAL_BLOQUEADO = 'El portal de clientes está bloqueado temporalmente.'

// Fila del interruptor dentro de una lista de permisos ya cargada
export function filaPortal(permisos) {
  return (permisos || []).find(p => p.rol_id === ROL_CLIENTE_ID && p.modulo === MODULO_PORTAL) || null
}

// `supabase` debe poder leer `permisos`: service_role o una sesión del
// personal (RLS no deja que un cliente la lea). Si falla, se toma como activo.
export async function portalClientesActivo(supabase) {
  const { data, error } = await supabase.from('permisos').select('puede_ver')
    .eq('rol_id', ROL_CLIENTE_ID).eq('modulo', MODULO_PORTAL).maybeSingle()
  if (error || !data) return true
  return data.puede_ver !== false
}
