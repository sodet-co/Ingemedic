// Seguimiento del repartidor mientras tiene una entrega en curso: su celular manda
// la ubicación a `ubicaciones_repartidor` y el admin ve la última de cada uno en un
// mapa (components/entregas/MapaRepartidores.js).
//
// Límite del navegador: solo se manda con la página abierta y la pantalla encendida.
// Si cambia a Waze, minimiza o apaga la pantalla, el celular la deja de mandar; al
// volver a abrir la app sigue. Por eso el mapa dice "hace X min": es la última
// ubicación conocida, no tiempo real.

const CADA_MS = 60_000      // como mucho un punto por minuto…
const MOVIMIENTO_M = 150    // …salvo que se haya movido más que esto

// Distancia aproximada en metros entre dos puntos
function metros(a, b) {
  const R = 6371000, rad = x => x * Math.PI / 180
  const dLat = rad(b.lat - a.lat), dLng = rad(b.lng - a.lng)
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(h))
}

// Empieza a mandar la ubicación; devuelve la función para parar. Sin permiso o sin
// la tabla (SQL sin correr) no hace nada ni molesta: la entrega sigue igual.
export function iniciarSeguimiento(supabase, { repartidorId, entregaId }) {
  if (typeof navigator === 'undefined' || !navigator.geolocation || !repartidorId) return () => {}
  let ultimo = null, enviando = false, parado = false
  const enviar = async (p, forzar = false) => {
    const punto = { lat: p.coords.latitude, lng: p.coords.longitude }
    const ahora = Date.now()
    if (!forzar && ultimo && ahora - ultimo.t < CADA_MS && metros(ultimo, punto) < MOVIMIENTO_M) return
    if (enviando || parado) return
    enviando = true
    ultimo = { ...punto, t: ahora }
    const { error } = await supabase.from('ubicaciones_repartidor').insert({
      repartidor_id: repartidorId, entrega_id: entregaId || null,
      lat: punto.lat, lng: punto.lng, precision: Math.round(p.coords.accuracy),
    })
    if (error) console.warn('Seguimiento: no se guardó la ubicación', error.message)
    enviando = false
  }
  // El primer punto va de una (al iniciar o al volver a abrir la app)
  navigator.geolocation.getCurrentPosition(p => enviar(p, true), () => {}, { enableHighAccuracy: true, timeout: 20000, maximumAge: 30000 })
  const id = navigator.geolocation.watchPosition(p => enviar(p), () => {}, { enableHighAccuracy: true, maximumAge: 30000 })
  // Al volver a la app (después de usar Waze) se manda de una, sin esperar el minuto
  const alVolver = () => {
    if (document.visibilityState !== 'visible') return
    navigator.geolocation.getCurrentPosition(p => enviar(p, true), () => {}, { enableHighAccuracy: true, timeout: 20000, maximumAge: 30000 })
  }
  document.addEventListener('visibilitychange', alVolver)
  return () => { parado = true; navigator.geolocation.clearWatch(id); document.removeEventListener('visibilitychange', alVolver) }
}

// Última ubicación de cada repartidor en las últimas horas: { [repartidor_id]: punto }
export async function ultimasUbicaciones(supabase, { horas = 12 } = {}) {
  const desde = new Date(Date.now() - horas * 3600_000).toISOString()
  const { data, error } = await supabase.from('ubicaciones_repartidor')
    .select('repartidor_id, entrega_id, lat, lng, precision, creado')
    .gte('creado', desde).order('creado', { ascending: false }).limit(1000)
  if (error) return {}
  const out = {}
  for (const u of data || []) if (!out[u.repartidor_id]) out[u.repartidor_id] = u
  return out
}

// "hace 3 min", "hace 1 h"
export function haceCuanto(iso) {
  const min = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000))
  if (min < 1) return 'ahora'
  if (min < 60) return `hace ${min} min`
  const h = Math.floor(min / 60)
  return `hace ${h} h${min % 60 ? ` ${min % 60} min` : ''}`
}

// Más de 15 min sin señal: seguramente está en Waze o con la pantalla apagada
export const senalVieja = iso => Date.now() - new Date(iso).getTime() > 15 * 60000
