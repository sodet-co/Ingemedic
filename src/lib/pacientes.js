// Reglas compartidas para crear/editar pacientes — las usan el modal
// "Nuevo paciente" (ClientesClient.js) y el wizard de Nuevo préstamo
// (OrdenesClient.js), para que los dos caminos validen igual.
//
// En la BD hay un índice único sobre la cédula normalizada a solo dígitos
// (pacientes_cedula_unica). Estas funciones hacen la misma normalización
// para avisar antes de guardar; el índice queda de respaldo.

export const MENSAJE_CEDULA_DUPLICADA = 'Cédula ya registrada en el sistema'

export function normalizarCedula(cedula) {
  return (cedula || '').replace(/[^0-9]/g, '')
}

// Devuelve el paciente que ya tiene esa cédula (ignorando `excluirId`,
// para cuando se edita un paciente existente), o null.
export function buscarCedulaDuplicada(pacientes, cedula, excluirId = null) {
  const buscada = normalizarCedula(cedula)
  if (!buscada) return null
  return (pacientes || []).find(p => p.id !== excluirId && normalizarCedula(p.cedula) === buscada) || null
}

export function mensajeCedulaDuplicada(paciente) {
  return paciente?.nombre
    ? `${MENSAJE_CEDULA_DUPLICADA} (${paciente.nombre})`
    : MENSAJE_CEDULA_DUPLICADA
}

// El índice rechazó el insert/update (23505 = unique_violation de Postgres).
// Cubre el caso de que otro usuario haya registrado la misma cédula mientras
// este formulario estaba abierto, y la lista local todavía no lo tenía.
export function esErrorCedulaDuplicada(error) {
  return error?.code === '23505' && (error.message || '').includes('pacientes_cedula_unica')
}
