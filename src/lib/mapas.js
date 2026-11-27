// Enlaces para ir a una dirección: Google Maps y Waze. En el celular abren la app
// si está instalada (si no, la página). Waze busca peor por texto que Maps, por
// eso se ofrecen los dos.
const consulta = partes => [...partes.filter(Boolean), 'Colombia'].join(', ')

export const urlGoogleMaps = (...partes) => partes.some(Boolean)
  ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(consulta(partes))}` : null

export const urlWaze = (...partes) => partes.some(Boolean)
  ? `https://waze.com/ul?q=${encodeURIComponent(consulta(partes))}&navigate=yes` : null
