/**
 * Geometrie und Formatierung – reine Funktionen, kein DOM, keine Karte.
 *
 * Alle Koordinaten sind `[lon, lat]` in Grad, in dieser Reihenfolge. Das ist
 * die Reihenfolge von GeoJSON und MapLibre; wer sie vertauscht, landet im
 * Indischen Ozean. Deshalb heißt der Typ ausdrücklich `LonLat`.
 */

/** @typedef {[number, number]} LonLat  [Längengrad, Breitengrad] in Grad */

/** Erdradius nach WGS-84 (mittlerer Radius) in Metern. */
const EARTH_RADIUS_M = 6371008.8

/**
 * Nördlichster bzw. südlichster Breitengrad, den Web-Mercator darstellen kann.
 * Darüber hinaus wächst die Projektion ins Unendliche.
 */
export const MAX_MERCATOR_LAT = 85.051129

/** @param {number} degrees */
const toRadians = (degrees) => (degrees * Math.PI) / 180

/**
 * Bringt einen Längengrad in den Bereich −180…180. Nötig, weil die Karte beim
 * Scrollen über die Datumsgrenze Werte wie 190 oder −400 liefert.
 * @param {number} lon
 * @returns {number}
 */
export function normalizeLon(lon) {
  if (!Number.isFinite(lon)) throw new RangeError(`Längengrad ist keine Zahl: ${lon}`)
  // −180 und 180 sind derselbe Meridian; wir entscheiden uns für 180.
  if (lon === -180) return 180
  // Der Normalfall kommt ohne Rechnung aus. Das ist kein Geizen: Die Modulo-
  // Kette unten verschiebt 13.405 auf 13.404999999999973, und dieses Rauschen
  // landete sonst in jedem gespeicherten Wegpunkt.
  if (lon > -180 && lon <= 180) return lon

  const wrapped = ((((lon + 180) % 360) + 360) % 360) - 180
  return wrapped === -180 ? 180 : wrapped
}

/**
 * Begrenzt einen Breitengrad auf das, was die Karte darstellen kann.
 * @param {number} lat
 * @returns {number}
 */
export function clampLat(lat) {
  if (!Number.isFinite(lat)) throw new RangeError(`Breitengrad ist keine Zahl: ${lat}`)
  return Math.min(MAX_MERCATOR_LAT, Math.max(-MAX_MERCATOR_LAT, lat))
}

/**
 * Entfernung zweier Punkte auf der Kugel (Haversine), in Metern.
 *
 * Gut genug für Anzeige und Längensummen: gegenüber dem Ellipsoid liegt der
 * Fehler bei etwa 0,3 %. Für die Route selbst zählt ohnehin, was der
 * Routing-Dienst liefert (ab M2).
 *
 * @param {LonLat} from
 * @param {LonLat} to
 * @returns {number}
 */
export function haversineMeters(from, to) {
  const [lon1, lat1] = from
  const [lon2, lat2] = to
  const phi1 = toRadians(lat1)
  const phi2 = toRadians(lat2)
  const deltaPhi = toRadians(lat2 - lat1)
  // Über die Datumsgrenze ist der kürzere Weg gemeint, nicht einmal um die Welt.
  const deltaLambda = toRadians(normalizeLon(lon2 - lon1))

  const a =
    Math.sin(deltaPhi / 2) ** 2 +
    Math.cos(phi1) * Math.cos(phi2) * Math.sin(deltaLambda / 2) ** 2
  return 2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(a)))
}

/**
 * Summe der Luftlinien entlang einer Punktfolge, in Metern.
 * @param {LonLat[]} points
 * @returns {number}
 */
export function pathLengthMeters(points) {
  let total = 0
  for (let index = 1; index < points.length; index += 1) {
    const previous = points[index - 1]
    const current = points[index]
    if (previous && current) total += haversineMeters(previous, current)
  }
  return total
}

/**
 * Entfernung für die Anzeige, deutsch formatiert.
 * @param {number} meters
 * @returns {string}
 */
export function formatDistance(meters) {
  if (!Number.isFinite(meters) || meters < 0) return '–'
  if (meters < 1000) return `${Math.round(meters)} m`
  const kilometers = meters / 1000
  const digits = kilometers < 10 ? 1 : 0
  return `${kilometers.toLocaleString('de-DE', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  })} km`
}

/**
 * Koordinate für die Anzeige, deutsch formatiert (Ost/West, Nord/Süd).
 * @param {LonLat} point
 * @returns {string}
 */
export function formatLonLat(point) {
  const [lon, lat] = point
  /**
   * @param {number} value
   * @param {string} positive
   * @param {string} negative
   */
  const format = (value, positive, negative) =>
    `${Math.abs(value).toLocaleString('de-DE', {
      minimumFractionDigits: 4,
      maximumFractionDigits: 4,
    })}° ${value >= 0 ? positive : negative}`
  return `${format(lat, 'N', 'S')}, ${format(lon, 'O', 'W')}`
}
