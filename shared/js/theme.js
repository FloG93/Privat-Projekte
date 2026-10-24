/**
 * Hell/Dunkel für alle Projekte dieses Repositories.
 *
 * Standard ist die Einstellung des Betriebssystems. Wählt jemand aktiv eine
 * Variante, merken wir sie unter einem gemeinsamen Schlüssel – so bleibt die
 * Entscheidung beim Wechsel zwischen Übersicht und Projekten erhalten.
 */

const STORAGE_KEY = 'privat-projekte.theme'

/** @typedef {'light' | 'dark'} Theme */

/**
 * Liest die gemerkte Einstellung.
 * @returns {Theme | null} null, wenn nichts gemerkt ist oder der Speicher fehlt.
 */
export function storedTheme() {
  try {
    const value = localStorage.getItem(STORAGE_KEY)
    return value === 'light' || value === 'dark' ? value : null
  } catch {
    // Privates Fenster oder blockierte Website-Daten: kein Grund zu scheitern.
    return null
  }
}

/**
 * Setzt die gemerkte Einstellung auf <html>. Ohne gemerkte Einstellung bleibt
 * das Attribut weg, damit die Systemvorgabe greift.
 *
 * Sollte früh laufen – am besten in einem <script> im <head> –, sonst blitzt
 * beim Laden kurz die falsche Variante auf.
 */
export function applyStoredTheme() {
  const theme = storedTheme()
  if (theme) document.documentElement.dataset['theme'] = theme
}

/** @returns {Theme} Die Variante, die gerade tatsächlich zu sehen ist. */
export function currentTheme() {
  const attribute = document.documentElement.dataset['theme']
  if (attribute === 'light' || attribute === 'dark') return attribute
  return matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark'
}

/**
 * Schaltet um und merkt sich das Ergebnis.
 * @returns {Theme} die nun aktive Variante
 */
export function toggleTheme() {
  const next = currentTheme() === 'dark' ? 'light' : 'dark'
  document.documentElement.dataset['theme'] = next
  try {
    localStorage.setItem(STORAGE_KEY, next)
  } catch {
    // Nicht merken können ist unschön, aber kein Fehler für den Nutzer.
  }
  return next
}

/**
 * Hängt den Umschalter an einen Knopf und hält seine Beschriftung aktuell.
 * @param {HTMLElement | null} button
 */
export function wireThemeToggle(button) {
  if (!button) return
  const label = () => {
    const theme = currentTheme()
    const target = theme === 'dark' ? 'Hell' : 'Dunkel'
    button.textContent = theme === 'dark' ? '☀' : '☾'
    button.title = `Auf ${target} umschalten`
    button.setAttribute('aria-label', button.title)
  }
  button.addEventListener('click', () => {
    toggleTheme()
    label()
  })
  label()
}
