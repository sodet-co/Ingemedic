'use client'
import { useMemo } from 'react'
import L from 'leaflet'
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet'
import 'leaflet/dist/leaflet.css'
import { haceCuanto, senalVieja } from '@/lib/seguimiento'
import { urlPunto } from '@/lib/mapas'

// Mapa con la última ubicación conocida de cada repartidor en ruta (lib/seguimiento.js).
// puntos: [{ id, nombre, lat, lng, creado, precision, destino, codigo }]
const VALLEDUPAR = [10.4631, -73.2532]

const icono = (nombre, viejo) => L.divIcon({
  className: '',
  html: `<div style="display:flex;flex-direction:column;align-items:center;transform:translateY(-100%)">
    <div style="background:${viejo ? '#94A3B8' : '#D81B43'};color:#fff;font:700 12px Arial;padding:3px 8px;border-radius:999px;white-space:nowrap;box-shadow:0 2px 6px rgba(0,0,0,.25)">${String(nombre || '').split(/\s+/)[0]}</div>
    <div style="width:0;height:0;border:6px solid transparent;border-top-color:${viejo ? '#94A3B8' : '#D81B43'}"></div></div>`,
  iconSize: [0, 0],
})

export default function MapaRepartidores({ puntos }) {
  const bounds = useMemo(() => puntos.length > 1 ? L.latLngBounds(puntos.map(p => [p.lat, p.lng])) : null, [puntos])
  return (
    <MapContainer {...(bounds ? { bounds, boundsOptions: { padding: [40, 40], maxZoom: 15 } } : { center: puntos[0] ? [puntos[0].lat, puntos[0].lng] : VALLEDUPAR, zoom: puntos[0] ? 15 : 13 })}
      // isolation: los panes de Leaflet tienen z-index altos; así no tapan las ventanas (ver MapaMunicipios.js)
      style={{ height: '100%', width: '100%', minHeight: 320, isolation: 'isolate' }}>
      <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" attribution="&copy; OpenStreetMap" />
      {puntos.map(p => {
        // Sin señal reciente: gris
        const viejo = senalVieja(p.creado)
        return (
          <Marker key={p.id} position={[p.lat, p.lng]} icon={icono(p.nombre, viejo)}>
            <Popup>
              <div style={{ font: '12px Arial', minWidth: 160 }}>
                <b>{p.nombre}</b><br />
                Última señal {haceCuanto(p.creado)}{p.precision ? ` (±${p.precision} m)` : ''}<br />
                {p.codigo && <>{p.codigo} · </>}{p.destino || ''}<br />
                <a href={urlPunto(p.lat, p.lng)} target="_blank" rel="noopener noreferrer">Abrir en Maps</a>
              </div>
            </Popup>
          </Marker>
        )
      })}
    </MapContainer>
  )
}
