// Ubicación exacta de la entrega. Cuando el repartidor finaliza en el sitio, el
// celular dice dónde está (si da permiso): queda en la entrega como prueba y en el
// paciente (o el cliente, si no hay paciente) para que la próxima vez Waze y Maps
// vayan al punto exacto (lib/mapas.js) y no adivinen por la dirección escrita.
// Solo se usa en la vista del repartidor: desde la oficina guardaría la oficina.

// Precisión máxima (metros) para guardarla en el paciente: una lectura peor (wifi,
// sin GPS) sirve de prueba en la entrega pero no para llevar a la casa
export const PRECISION_DESTINO = 100

// { lat, lng, precision } o null (sin permiso, sin GPS o se demoró). Nunca falla.
export function pedirUbicacion({ espera = 15000 } = {}) {
  return new Promise(ok => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) return ok(null)
    navigator.geolocation.getCurrentPosition(
      p => ok({ lat: p.coords.latitude, lng: p.coords.longitude, precision: Math.round(p.coords.accuracy) }),
      () => ok(null),
      { enableHighAccuracy: true, timeout: espera, maximumAge: 60000 },
    )
  })
}

// Espera la ubicación que se pidió antes, pero no más de `max` ms
export const conTope = (promesa, max = 4000) => Promise.race([promesa || Promise.resolve(null), new Promise(ok => setTimeout(() => ok(null), max))])

// Guarda la ubicación en la entrega y, si es buena, en el destino. Los errores no
// detienen nada: la entrega ya quedó completada.
export async function guardarUbicacionEntrega(supabase, { entrega, orden, ubicacion }) {
  if (!ubicacion || !entrega?.id) return
  const ahora = new Date().toISOString()
  const { error } = await supabase.from('entregas').update({
    ubicacion_lat: ubicacion.lat, ubicacion_lng: ubicacion.lng, ubicacion_precision: ubicacion.precision,
  }).eq('id', entrega.id)
  if (error) console.warn('No se guardó la ubicación de la entrega:', error.message)
  if (ubicacion.precision > PRECISION_DESTINO) return
  const destino = { ubicacion_lat: ubicacion.lat, ubicacion_lng: ubicacion.lng, ubicacion_precision: ubicacion.precision, ubicacion_fecha: ahora }
  const pacienteId = orden?.paciente_id || orden?.paciente?.id
  const clienteId = orden?.cliente_id || orden?.cliente?.id
  const r = pacienteId
    ? await supabase.from('pacientes').update(destino).eq('id', pacienteId)
    : clienteId ? await supabase.from('clientes').update(destino).eq('id', clienteId) : { error: null }
  if (r.error) console.warn('No se guardó la ubicación del destino:', r.error.message)
}

// Punto guardado de un paciente o cliente: { lat, lng } o null
export const puntoDe = x => (x?.ubicacion_lat != null && x?.ubicacion_lng != null ? { lat: x.ubicacion_lat, lng: x.ubicacion_lng } : null)
