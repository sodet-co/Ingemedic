// Enlaces para ir a una dirección: Google Maps y Waze. En el celular abren la app
// si está instalada (si no, la página). Con el punto exacto guardado del destino
// (lib/ubicacion.js → puntoDe) van ahí; si no, buscan la dirección escrita (Waze
// busca peor por texto que Maps, por eso se ofrecen los dos).
const consulta = partes => [...partes.filter(Boolean), 'Colombia'].join(', ')

export const urlGoogleMaps = (direccion, ciudad, punto) => punto
  ? `https://www.google.com/maps/dir/?api=1&destination=${punto.lat},${punto.lng}`
  : direccion || ciudad ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(consulta([direccion, ciudad]))}` : null

export const urlWaze = (direccion, ciudad, punto) => punto
  ? `https://waze.com/ul?ll=${punto.lat},${punto.lng}&navigate=yes`
  : direccion || ciudad ? `https://waze.com/ul?q=${encodeURIComponent(consulta([direccion, ciudad]))}&navigate=yes` : null

// Dónde quedó registrada una entrega (la prueba)
export const urlPunto = (lat, lng) => `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`
