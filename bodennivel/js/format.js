/**
 * Zahlen lesen und schön ausgeben (deutsches Format).
 *
 * Reine Funktionen ohne DOM – damit testbar und auf der Baustelle verlässlich:
 * „2,5“ darf nie als 25 gelesen werden.
 */

/**
 * Liest, was eine deutsche Tastatur liefert („1.234,5“, „12,5“, „12.5“).
 * Mit Komma ist der Punkt ein Tausendertrenner, ohne Komma ein Dezimalpunkt.
 * @param {string} raw
 * @param {number | null} [fallback]
 * @returns {number | null}
 */
export function parseNum(raw, fallback = null) {
  let text = String(raw).trim().replace(/\s/g, '')
  if (text.includes(',')) text = text.replace(/\./g, '').replace(',', '.')
  if (!/^[+-]?(\d+\.?\d*|\.\d+)$/.test(text)) return fallback
  const value = Number(text)
  return Number.isFinite(value) ? value : fallback
}

/**
 * Messwert in mm: 0 bis 2000, auf 0,1 gerundet. Alles andere → null.
 * @param {string} raw
 * @returns {number | null}
 */
export function parseMeasurement(raw) {
  const value = parseNum(raw)
  if (value === null || value < 0 || value > 2000) return null
  return Math.round(value * 10) / 10
}

/**
 * @param {number} value
 * @param {number} [digits] höchstens so viele Nachkommastellen
 * @returns {string}
 */
export function formatNum(value, digits = 1) {
  return new Intl.NumberFormat('de-DE', {
    maximumFractionDigits: digits,
    minimumFractionDigits: 0,
    useGrouping: true,
  }).format(value)
}

/** @param {number} value */
export const formatMm = (value) => `${formatNum(value)} mm`

/** @param {number} value */
export function formatKg(value) {
  const kg = formatNum(Math.round(value), 0)
  return value >= 1000 ? `${kg} kg (${formatNum(value / 1000, 2)} t)` : `${kg} kg`
}

/** @param {number} value */
export const formatL = (value) => `${formatNum(value)} L`

/** @param {number} value */
export const formatM2 = (value) => `${formatNum(value, 2)} m²`
