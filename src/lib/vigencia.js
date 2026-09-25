// Vigencia de un préstamo (ordenes_servicio.fecha_vigencia) — se CALCULA a partir
// de la fecha guardada, nunca se persiste como estado. Ver docs/bitacora.md
// (2026-09-24) para el porqué: si se guardara "vencido" como bandera, un préstamo
// extendido quedaría mintiendo hasta que alguien lo tocara a mano.
//
// Consolida estaVencida() (antes duplicada en OrdenesClient.js) y el cálculo de
// días restantes (antes diasRestantes() en DashboardClient.js, ahí atado solo a
// fecha_vigencia pese al nombre genérico) — mismo comportamiento que ya tenían.

export function estaVencida(orden) {
  if (!orden?.fecha_vigencia) return false
  return new Date(orden.fecha_vigencia) < new Date()
}

// Días que faltan para el vencimiento (negativo si ya venció, 0 si es hoy).
// null si el préstamo es indefinido (sin fecha_vigencia).
export function diasParaVencer(orden) {
  if (!orden?.fecha_vigencia) return null
  return Math.ceil((new Date(orden.fecha_vigencia) - new Date()) / 86400000)
}
