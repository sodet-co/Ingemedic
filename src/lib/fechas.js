// Manejo centralizado de fechas/horas en zona horaria de Colombia (UTC-5 fijo, sin horario de verano).
// Usar SIEMPRE estas funciones en vez de manipular new Date() / toLocaleString() sueltos.

// Convierte lo que venga de un <input type="date"> o "datetime-local"
// a un string ISO con offset explícito de Colombia, listo para guardar
// en Supabase sin ambigüedad.
export function paraGuardar(valorInput) {
  if (!valorInput) return null
  const tieneHora = valorInput.includes('T')
  return tieneHora ? `${valorInput}:00-05:00` : `${valorInput}T00:00:00-05:00`
}

// Formatea una fecha de la BD (timestamptz) para mostrarla en pantalla,
// siempre en hora de Colombia sin importar la zona del navegador.
export function formatear(fechaIso, opciones = {}) {
  if (!fechaIso) return '—'
  return new Date(fechaIso).toLocaleString('es-CO', {
    timeZone: 'America/Bogota',
    day: '2-digit', month: 'short', year: 'numeric',
    ...opciones,
  })
}

// Compara si una fecha (de BD) ya pasó, comparando solo el día
// (ignora la hora) en zona horaria de Colombia.
export function yaPaso(fechaIso) {
  if (!fechaIso) return false
  const hoy = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Bogota' })
  const fecha = new Date(fechaIso).toLocaleDateString('en-CA', { timeZone: 'America/Bogota' })
  return fecha < hoy
}

// Día calendario (YYYY-MM-DD) de una fecha con hora (timestamptz), en zona de Colombia.
// Útil para filtrar/agrupar por día un campo que sí trae hora (ej. fecha_creacion) sin
// que la conversión a UTC corra el día cerca de la medianoche de Bogotá.
export function soloDia(fechaIso) {
  if (!fechaIso) return ''
  return new Date(fechaIso).toLocaleDateString('en-CA', { timeZone: 'America/Bogota' })
}

// "Hoy" (YYYY-MM-DD) en zona de Colombia, para comparar contra columnas `date` o usar
// como límite de rango — evita el corrimiento de día que da `new Date().toISOString()` en UTC.
export function hoyBogota() {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'America/Bogota' })
}

// Convierte una fecha de la BD al formato que espera un
// <input type="datetime-local"> para pre-llenar un formulario de edición.
export function paraInput(fechaIso) {
  if (!fechaIso) return ''
  const d = new Date(fechaIso)
  return d.toLocaleString('sv-SE', { timeZone: 'America/Bogota' }).replace(' ', 'T').slice(0, 16)
}

const MESES_CORTOS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']

// Formatea una columna `date` pura (sin hora, ej. "2026-09-01") para mostrarla en pantalla.
// A diferencia de formatear(), NO pasa por new Date()/timeZone: una fecha sin hora no tiene
// ambigüedad de zona horaria, y convertirla con new Date() la correría un día si se fuerza
// a America/Bogota (el string se interpretaría primero como medianoche UTC).
export function formatearSoloFecha(fechaStr) {
  if (!fechaStr) return '—'
  const [anio, mes, dia] = fechaStr.slice(0, 10).split('-')
  return `${dia} ${MESES_CORTOS[Number(mes) - 1]} ${anio}`
}

// Suma N días a una fecha YYYY-MM-DD (columna `date` pura, sin hora) usando
// aritmética UTC sobre los componentes — evita el corrimiento de día que daría
// sumar milisegundos sobre un new Date() interpretado en la zona del navegador.
export function sumarDias(fechaStr, dias) {
  const [anio, mes, dia] = fechaStr.slice(0, 10).split('-').map(Number)
  const fecha = new Date(Date.UTC(anio, mes - 1, dia))
  fecha.setUTCDate(fecha.getUTCDate() + dias)
  return fecha.toISOString().slice(0, 10)
}
