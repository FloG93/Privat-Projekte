import {
  MapLibreMap,
  NavigationControl,
  ScaleControl,
  setWorkerUrl,
} from '../../vendor/maplibre-gl/maplibre-gl.mjs'
import { getStyle } from './styles.js'

/**
 * MapLibre sucht seinen Web-Worker als Nachbardatei von `maplibre-gl.mjs`.
 * Das stimmt hier zwar, weil wir beide Dateien nebeneinander mitliefern – wir
 * setzen die URL aber trotzdem ausdrücklich: Der Fehlerfall ist eine leere
 * Karte mit nichts als einer Konsolenzeile ("Worker failed to load"), und das
 * fällt erst spät auf.
 */
setWorkerUrl(
  new URL('../../vendor/maplibre-gl/maplibre-gl-worker.mjs', import.meta.url).href,
)

/**
 * Erzeugt die Karte. Noch ohne Route und Animation – das kommt in M1 bis M3.
 *
 * `preserveDrawingBuffer` ist von Anfang an gesetzt: Ohne das Flag liefert
 * `canvas.toBlob()` beim späteren Video-Export ein leeres Bild, und in
 * MapLibre 6 sitzt es in `canvasContextAttributes` und lässt sich nach dem
 * Erzeugen der Karte nicht mehr ändern.
 *
 * @param {HTMLElement} container
 * @param {string} styleId
 * @returns {MapLibreMap}
 */
export function createMap(container, styleId) {
  const map = new MapLibreMap({
    container,
    style: getStyle(styleId).url,
    center: [13.405, 52.52], // Berlin – Startpunkt des Beispielprojekts
    zoom: 9,
    pitch: 0,
    bearing: 0,
    attributionControl: { compact: false },
    canvasContextAttributes: { preserveDrawingBuffer: true },
  })
  map.addControl(new NavigationControl({ visualizePitch: true }), 'top-right')
  map.addControl(new ScaleControl({ unit: 'metric' }), 'bottom-left')
  return map
}
