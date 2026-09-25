'use client'
import { useMemo } from 'react'
import L from 'leaflet'
import { MapContainer, GeoJSON } from 'react-leaflet'
import 'leaflet/dist/leaflet.css'
import { normalizarNombreMunicipio, colorPorConteoMunicipio } from '@/lib/municipios'

export default function MapaMunicipios({ geojsonCesar, conteoPorCiudad, interactivo = false }) {
  // En vez de un center+zoom fijo (que se ve bien a un tamaño de contenedor y
  // cortado a otro), se calculan los límites reales del Cesar a partir del
  // propio geojson — así el mapa se encuadra solo sin importar cuán chica sea
  // la tarjeta donde viva.
  const bounds = useMemo(() => L.geoJSON(geojsonCesar).getBounds(), [geojsonCesar])

  function estiloFeature(feature) {
    const nombre  = normalizarNombreMunicipio(feature.properties.MPIO_CNMBR)
    const conteo  = conteoPorCiudad[nombre] || 0
    return {
      fillColor: colorPorConteoMunicipio(conteo),
      weight: 1.5,
      color: '#FFFFFF',
      fillOpacity: 0.85,
    }
  }

  function onEachFeature(feature, layer) {
    const nombre     = feature.properties.MPIO_CNMBR
    const nombreNorm = normalizarNombreMunicipio(nombre)
    const conteo     = conteoPorCiudad[nombreNorm] || 0
    layer.bindTooltip(
      `<strong>${nombre}</strong><br/>${conteo} equipo${conteo !== 1 ? 's' : ''} activo${conteo !== 1 ? 's' : ''}`,
      { sticky: true }
    )
    layer.on({
      mouseover: (e) => e.target.setStyle({ fillOpacity: 1, weight: 2.5 }),
      mouseout: (e) => e.target.setStyle({ fillOpacity: 0.85, weight: 1.5 }),
    })
  }

  return (
    <MapContainer bounds={bounds} boundsOptions={{ padding: [4, 4] }} zoomSnap={0.1}
      zoomControl={interactivo} attributionControl={false} dragging={interactivo} scrollWheelZoom={interactivo}
      doubleClickZoom={interactivo} touchZoom={interactivo} boxZoom={interactivo} keyboard={interactivo}
      // isolation: 'isolate' — Leaflet le pone z-index 200-700 a sus panes
      // internos (.leaflet-map-pane, .leaflet-overlay-pane, etc). El propio
      // .leaflet-container queda con position:relative pero z-index:auto, y
      // ESO no basta para contenerlos: un elemento position:relative con
      // z-index:auto no abre su propio contexto de apilamiento, así que esos
      // z-index de 400+ se comparan contra el contexto del ANCESTRO más
      // cercano que sí lo abra — en este caso, la página completa — y le
      // ganan a cualquier modal con z-index más chico (confirmado con
      // document.elementFromPoint(): sin esto, el mapa queda por ENCIMA de
      // cualquier fondo de modal, sin importar cuánto z-index tenga). Forzar
      // un contexto de apilamiento propio aquí contiene esos z-index adentro.
      style={{ height: '100%', width: '100%', minHeight: 280, background: 'transparent', isolation: 'isolate' }}>
      <GeoJSON data={geojsonCesar} style={estiloFeature} onEachFeature={onEachFeature} />
    </MapContainer>
  )
}
