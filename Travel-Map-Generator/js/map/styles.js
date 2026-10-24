/**
 * Registry der Kartenstile.
 *
 * Grundsatz des Projekts: ohne jeden API-Key muss die App vollwertig
 * funktionieren. Stile, die einen Key brauchen (Satellit, fotorealistisches
 * 3D), stehen in der Liste, werden aber ausgegraut, solange kein Key gesetzt
 * ist – statt zu scheitern, sobald jemand sie anklickt.
 *
 * Ausgebaut wird das in Meilenstein M5 (Retro-Papier, Seekarte, Topografie).
 */

/** @typedef {'liberty' | 'bright' | 'positron'} MapStyleId */

/**
 * @typedef {object} MapStyleDef
 * @property {MapStyleId} id
 * @property {string} label  Beschriftung in der Oberfläche.
 * @property {string} url
 * @property {string} hint   Kurze Einordnung für den Nutzer.
 * @property {boolean} needsKey  true = ohne Key nicht nutzbar.
 */

/**
 * OpenFreeMap liefert MapLibre-Vektorkacheln ohne Key und ohne Registrierung.
 * Die Attribution ist Pflicht und steckt in den Stilen selbst.
 * @type {readonly MapStyleDef[]}
 */
export const MAP_STYLES = [
  {
    id: 'liberty',
    label: 'Liberty',
    url: 'https://tiles.openfreemap.org/styles/liberty',
    hint: 'Klassische Straßenkarte, gut zum Einordnen der Route.',
    needsKey: false,
  },
  {
    id: 'bright',
    label: 'Bright',
    url: 'https://tiles.openfreemap.org/styles/bright',
    hint: 'Helle, kontrastreiche Karte.',
    needsKey: false,
  },
  {
    id: 'positron',
    label: 'Positron',
    url: 'https://tiles.openfreemap.org/styles/positron',
    hint: 'Zurückhaltend und grau – lässt die Routenlinie dominieren.',
    needsKey: false,
  },
]

/** @type {MapStyleId} */
export const DEFAULT_STYLE_ID = 'liberty'

/**
 * @param {string} id
 * @returns {MapStyleDef}
 */
export function getStyle(id) {
  const style = MAP_STYLES.find((candidate) => candidate.id === id)
  if (!style) throw new Error(`Unbekannter Kartenstil: ${id}`)
  return style
}
