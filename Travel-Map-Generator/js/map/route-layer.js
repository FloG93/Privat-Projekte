import { Marker } from '../../vendor/maplibre-gl/maplibre-gl.mjs'
import { routeLine } from '../core/model.js'

/** @typedef {import('../core/model.js').Project} Project */
/** @typedef {import('../../vendor/maplibre-gl/maplibre-gl.mjs').MapLibreMap} MapLibreMap */

const SOURCE_ID = 'route'
const LAYER_LINE = 'route-line'
const LAYER_CASING = 'route-line-casing'

/**
 * @typedef {object} RouteLayerOptions
 * @property {(waypointId: string, position: {lon: number, lat: number}) => void} onMoved
 * @property {(waypointId: string) => void} onSelected
 */

/**
 * Zeichnet die Reise: eine Linie und je Wegpunkt einen Marker zum Ziehen.
 *
 * Wichtig: Ein Stilwechsel (`map.setStyle`) wirft **alle** eigenen Quellen und
 * Ebenen weg – Marker überleben ihn, weil sie DOM-Elemente sind, Linien nicht.
 * Deshalb hängen wir uns an `styledata` und bauen die Linie danach neu auf.
 * Ohne das verschwindet die Route beim Umschalten des Kartenstils, und zwar
 * lautlos.
 *
 * @param {MapLibreMap} map
 * @param {RouteLayerOptions} options
 */
export function createRouteLayer(map, options) {
  /** @type {Map<string, Marker>} */
  const markers = new Map()
  /** @type {Project | null} */
  let current = null
  /** @type {string | null} */
  let selectedId = null

  function ensureLineLayers() {
    if (!map.getSource(SOURCE_ID)) {
      map.addSource(SOURCE_ID, {
        type: 'geojson',
        data: { type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: [] } },
      })
    }
    if (!map.getLayer(LAYER_CASING)) {
      map.addLayer({
        id: LAYER_CASING,
        type: 'line',
        source: SOURCE_ID,
        layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: { 'line-color': '#1c1917', 'line-opacity': 0.45, 'line-width': 8 },
      })
    }
    if (!map.getLayer(LAYER_LINE)) {
      map.addLayer({
        id: LAYER_LINE,
        type: 'line',
        source: SOURCE_ID,
        layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: { 'line-color': '#fbbf24', 'line-width': 4 },
      })
    }
  }

  function drawLine() {
    const source = map.getSource(SOURCE_ID)
    if (!source || !current) return
    /** @type {import('../../vendor/maplibre-gl/maplibre-gl.mjs').GeoJSONSource} */ (
      source
    ).setData({
      type: 'Feature',
      properties: {},
      geometry: { type: 'LineString', coordinates: routeLine(current) },
    })
  }

  /**
   * @param {number} index
   * @param {string} waypointId
   * @returns {HTMLElement}
   */
  function createMarkerElement(index, waypointId) {
    const element = document.createElement('button')
    element.type = 'button'
    element.className = 'route-marker'
    element.textContent = String(index + 1)
    element.addEventListener('click', (event) => {
      event.stopPropagation() // sonst setzt der Klick gleich einen neuen Punkt
      options.onSelected(waypointId)
    })
    return element
  }

  function syncMarkers() {
    if (!current) return
    const seen = new Set()

    current.waypoints.forEach((waypoint, index) => {
      seen.add(waypoint.id)
      let marker = markers.get(waypoint.id)
      if (!marker) {
        marker = new Marker({ element: createMarkerElement(index, waypoint.id), draggable: true })
        // Erst die Position, dann auf die Karte: `addTo` rechnet sofort aus, wo
        // der Marker hingehört, und wirft ohne LngLat.
        marker.setLngLat([waypoint.lon, waypoint.lat])
        marker.on('dragend', () => {
          const { lng, lat } = /** @type {Marker} */ (marker).getLngLat()
          options.onMoved(waypoint.id, { lon: lng, lat })
        })
        marker.addTo(map)
        markers.set(waypoint.id, marker)
      } else {
        marker.setLngLat([waypoint.lon, waypoint.lat])
      }

      const element = marker.getElement()
      element.textContent = String(index + 1)
      element.classList.toggle('is-selected', waypoint.id === selectedId)
      element.title = waypoint.name || `Punkt ${index + 1}`
    })

    for (const [id, marker] of markers) {
      if (!seen.has(id)) {
        marker.remove()
        markers.delete(id)
      }
    }
  }

  // Nach jedem Stilwechsel sind Quelle und Ebenen weg – also neu anlegen.
  map.on('styledata', () => {
    ensureLineLayers()
    drawLine()
  })

  return {
    /** @param {Project} project */
    render(project) {
      current = project
      if (map.isStyleLoaded()) {
        ensureLineLayers()
        drawLine()
      }
      syncMarkers()
    },

    /** @param {string | null} waypointId */
    select(waypointId) {
      selectedId = waypointId
      syncMarkers()
    },

    /** Zeigt die ganze Reise. */
    fit() {
      const line = current ? routeLine(current) : []
      if (line.length === 0) return
      const first = line[0]
      if (!first) return
      let [west, south] = first
      let [east, north] = first
      for (const [lon, lat] of line) {
        west = Math.min(west, lon)
        east = Math.max(east, lon)
        south = Math.min(south, lat)
        north = Math.max(north, lat)
      }
      if (line.length === 1) {
        map.easeTo({ center: [west, south], zoom: Math.max(map.getZoom(), 10) })
        return
      }
      map.fitBounds(
        [
          [west, south],
          [east, north],
        ],
        { padding: 72, maxZoom: 14, duration: 600 },
      )
    },

    destroy() {
      for (const marker of markers.values()) marker.remove()
      markers.clear()
    },
  }
}
