import { createClient } from '@/lib/supabase'

/**
 * Registra una acción en la bitácora de auditoría.
 * Se llama DESPUÉS de que la mutation a Supabase ya fue exitosa (nunca antes,
 * para no registrar acciones que en realidad fallaron).
 *
 * @param {Object} params
 * @param {string} params.modulo    - 'clientes' | 'inventario' | 'ordenes' | 'entregas' | 'mantenimientos' | 'configuracion' | 'auth'
 * @param {string} params.accion   - 'crear' | 'editar' | 'eliminar' | 'activar' | 'desactivar' | 'cerrar' | 'avanzar' | 'login' | 'logout'
 * @param {string} params.entidad  - nombre legible de la entidad afectada, ej. 'cliente', 'equipo', 'orden de servicio'
 * @param {string} [params.entidad_id] - uuid del registro afectado
 * @param {Object} [params.detalle]    - datos adicionales libres (se guardan como jsonb), ej. { nombre: 'Clínica X' }
 */
export async function registrarBitacora({ modulo, accion, entidad, entidad_id = null, detalle = null }) {
  try {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    const { error } = await supabase.from('bitacora').insert({
      usuario_id: user?.id || null,
      modulo, accion, entidad, entidad_id, detalle,
    })
    if (error) console.error('Error registrando bitácora:', error.message)
  } catch (err) {
    // La bitácora NUNCA debe romper el flujo principal de la app.
    console.error('Error registrando bitácora:', err)
  }
}