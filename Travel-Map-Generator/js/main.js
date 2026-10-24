import { wireThemeToggle } from '../../shared/js/theme.js'
import { evaluateCapabilities, probeBrowser } from './export/capabilities.js'
import { createMap } from './map/map-view.js'
import { DEFAULT_STYLE_ID, MAP_STYLES, getStyle } from './map/styles.js'

/**
 * @template {Element} T
 * @param {string} selector
 * @returns {T}
 */
function need(selector) {
  const element = document.querySelector(selector)
  if (!element) throw new Error(`Element fehlt im Dokument: ${selector}`)
  return /** @type {T} */ (element)
}

wireThemeToggle(document.querySelector('#theme-toggle'))

// Was der Export in diesem Browser kann, steht in der Seitenleiste – nicht erst
// in einer Fehlermeldung nach zehn Minuten Rendern.
const capabilities = evaluateCapabilities(probeBrowser())
need('#capability-label').textContent = capabilities.label
need('#capability-note').textContent = capabilities.note

/** @type {HTMLSelectElement} */
const styleSelect = need('#map-style')
for (const style of MAP_STYLES) {
  const option = document.createElement('option')
  option.value = style.id
  option.textContent = style.needsKey ? `${style.label} (API-Key nötig)` : style.label
  option.disabled = style.needsKey
  option.title = style.hint
  styleSelect.append(option)
}
styleSelect.value = DEFAULT_STYLE_ID

const map = createMap(need('#map'), DEFAULT_STYLE_ID)
styleSelect.addEventListener('change', () => {
  map.setStyle(getStyle(styleSelect.value).url)
})
