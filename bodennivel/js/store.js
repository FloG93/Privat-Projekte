/**
 * Speichern, Laden, Export und Import.
 *
 * Alles liegt in einem Dokument unter `bodennivel.v1` im localStorage. Nichts
 * hier wirft nach außen, wo die App weiterlaufen muss (kein Speicher, Quota
 * voll, kaputte Daten): Fehler werden gemeldet, Daten gehen nicht verloren.
 */

import { DEFAULT_SETTINGS, emptyState } from './model.js'

/** @typedef {import('./model.js').AppState} AppState */
/** @typedef {import('./model.js').Project} Project */

export const STORAGE_KEY = 'bodennivel.v1'
const BROKEN_KEY = `${STORAGE_KEY}.broken`

/** @typedef {Pick<Storage, 'getItem' | 'setItem'>} StorageLike */

/** @returns {StorageLike | null} */
function defaultStorage() {
  try {
    return globalThis.localStorage ?? null
  } catch {
    // Privates Fenster oder blockierte Website-Daten.
    return null
  }
}

/**
 * Lädt den Zustand. Ohne Speicher oder bei kaputten Daten startet die App
 * leer; kaputter Text bleibt unter `bodennivel.v1.broken` gesichert.
 * @param {StorageLike | null} [storage] Standard: localStorage
 * @returns {{ state: AppState, persistent: boolean }}
 */
export function loadState(storage = defaultStorage()) {
  if (!storage) return { state: emptyState(), persistent: false }
  let text = null
  try {
    text = storage.getItem(STORAGE_KEY)
  } catch {
    return { state: emptyState(), persistent: false }
  }
  if (text === null) return { state: emptyState(), persistent: true }
  try {
    return { state: migrate(JSON.parse(text)), persistent: true }
  } catch {
    try {
      storage.setItem(BROKEN_KEY, text)
    } catch {
      // Sicherung ist ein Extra – ohne sie geht es trotzdem weiter.
    }
    return { state: emptyState(), persistent: true }
  }
}

/**
 * @param {AppState} state
 * @param {StorageLike | null} [storage] Standard: localStorage
 * @returns {boolean} false, wenn nicht gespeichert werden konnte
 */
export function saveState(state, storage = defaultStorage()) {
  if (!storage) return false
  try {
    storage.setItem(STORAGE_KEY, JSON.stringify(state))
    return true
  } catch {
    return false
  }
}

// ---------------------------------------------------------------------------
// Prüfung

/** @param {unknown} v @returns {v is Record<string, unknown>} */
const isObject = (v) => typeof v === 'object' && v !== null && !Array.isArray(v)
/** @param {unknown} v @returns {v is number} */
const isNum = (v) => typeof v === 'number' && Number.isFinite(v)
/** @param {unknown} v @returns {v is number | null} */
const isNumOrNull = (v) => v === null || isNum(v)
/** @param {unknown} v @returns {v is string} */
const isStr = (v) => typeof v === 'string'
/** @param {unknown} v @returns {v is boolean} */
const isBool = (v) => typeof v === 'boolean'

/**
 * Prüft Felder eines Objekts: Pflichtfelder mit Typ, optional keine fremden.
 * @param {unknown} raw
 * @param {Record<string, (v: unknown) => boolean>} spec
 * @param {string} where
 * @param {boolean} strict fremde Felder ablehnen
 * @returns {Record<string, unknown>}
 */
function checkFields(raw, spec, where, strict) {
  if (!isObject(raw)) throw new Error(`${where}: kein Objekt`)
  for (const [key, test] of Object.entries(spec)) {
    if (!(key in raw)) throw new Error(`${where}: Pflichtfeld „${key}“ fehlt`)
    if (!test(raw[key])) throw new Error(`${where}: „${key}“ hat einen ungültigen Wert`)
  }
  if (strict) {
    const unknown = Object.keys(raw).filter((key) => !(key in spec))
    if (unknown.length > 0) throw new Error(`${where}: unbekannte Felder (${unknown.join(', ')})`)
  }
  return raw
}

/**
 * Prüft ein Projekt und füllt fehlende Einstellungen mit Standardwerten auf.
 * @param {unknown} raw
 * @param {boolean} strict
 * @returns {Project}
 */
function checkProject(raw, strict) {
  if (isObject(raw) && isObject(raw['settings'])) {
    raw['settings'] = { ...DEFAULT_SETTINGS, ...raw['settings'] }
  }
  const project = checkFields(raw, {
    id: isStr,
    name: isStr,
    connected: isBool,
    settings: isObject,
    setups: (v) => Array.isArray(v) && v.length > 0,
    activeSetupId: isStr,
    rooms: Array.isArray,
    createdAt: isStr,
  }, 'Projekt', strict)

  checkFields(project['settings'], Object.fromEntries(Object.keys(DEFAULT_SETTINGS).map((k) => [k, isNum])), 'Einstellungen', strict)

  const setups = /** @type {unknown[]} */ (project['setups'])
  for (const setup of setups) {
    const fields = checkFields(setup, {
      id: isStr,
      name: isStr,
      offset: isNum,
      ref: (v) => v === null || isObject(v),
    }, 'Laser-Standort', strict)
    if (fields['ref'] !== null) {
      checkFields(fields['ref'], { label: isStr, before: isNum, after: isNum }, 'Laser-Standort', strict)
    }
  }
  if (!setups.some((s) => isObject(s) && s['id'] === project['activeSetupId'])) {
    throw new Error('Projekt: aktiver Laser-Standort fehlt in der Liste')
  }

  for (const room of /** @type {unknown[]} */ (project['rooms'])) {
    const fields = checkFields(room, {
      id: isStr,
      name: isStr,
      length: isNumOrNull,
      width: isNumOrNull,
      areaOverride: isNumOrNull,
      inGroup: isBool,
      startCorner: (v) => v === 'NW' || v === 'NE' || v === 'SW' || v === 'SE',
      grid: isObject,
      freePoints: Array.isArray,
    }, 'Raum', strict)
    const grid = checkFields(fields['grid'], { cols: isNum, rows: isNum, cells: Array.isArray }, 'Raster', strict)
    for (const cell of /** @type {unknown[]} */ (grid['cells'])) {
      if (isObject(cell) && 'value' in cell && !isNumOrNull(cell['value'])) {
        throw new Error('Messwert ungültig: Zahl oder leer erwartet')
      }
      checkFields(cell, {
        row: isNum,
        col: isNum,
        excluded: isBool,
        value: isNumOrNull,
        setupId: (v) => v === null || isStr(v),
      }, 'Zelle', strict)
    }
    for (const point of /** @type {unknown[]} */ (fields['freePoints'])) {
      if (isObject(point) && 'value' in point && !isNum(point['value'])) {
        throw new Error('Messwert ungültig: Zahl erwartet')
      }
      checkFields(point, { id: isStr, label: isStr, value: isNum, setupId: isStr }, 'Freier Punkt', strict)
    }
  }
  return /** @type {Project} */ (/** @type {unknown} */ (project))
}

/**
 * Bringt gespeicherte Daten auf den aktuellen Stand und prüft sie. Grundlage
 * für spätere Schema-Versionen. Wirft bei ungültigen Daten.
 * @param {unknown} raw
 * @returns {AppState}
 */
export function migrate(raw) {
  if (isObject(raw) && isNum(raw['version']) && raw['version'] > 1) {
    throw new Error('Die Daten stammen aus einer neueren Version von BodenNivel')
  }
  const state = checkFields(raw, {
    version: (v) => v === 1,
    activeProjectId: (v) => v === null || isStr(v),
    projects: Array.isArray,
  }, 'Daten', false)
  const projects = /** @type {unknown[]} */ (state['projects']).map((p) => checkProject(p, false))
  if (projects.length === 0) return emptyState()
  const active = projects.some((p) => p.id === state['activeProjectId'])
    ? /** @type {string} */ (state['activeProjectId'])
    : (projects[0]?.id ?? null)
  return { version: 1, activeProjectId: active, projects }
}

// ---------------------------------------------------------------------------
// Export und Import

/** @param {string} text */
function slug(text) {
  const plain = text
    .toLowerCase()
    .replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss')
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
  return plain || 'projekt'
}

/**
 * @param {Project} project
 * @param {Date} [now]
 * @returns {{ filename: string, json: string }}
 */
export function exportProject(project, now = new Date()) {
  const p = (/** @type {number} */ n) => String(n).padStart(2, '0')
  const date = `${now.getFullYear()}-${p(now.getMonth() + 1)}-${p(now.getDate())}`
  return {
    filename: `bodennivel-${slug(project.name)}-${date}.json`,
    json: JSON.stringify({ app: 'bodennivel', version: 1, project }, null, 2),
  }
}

/**
 * Liest eine Exportdatei. Wirft einen Error mit verständlicher Meldung.
 * @param {string} json
 * @returns {Project}
 */
export function parseImport(json) {
  /** @type {unknown} */
  let file
  try {
    file = JSON.parse(json)
  } catch {
    throw new Error('Das ist keine gültige JSON-Datei')
  }
  if (!isObject(file) || file['app'] !== 'bodennivel') {
    throw new Error('Die Datei stammt nicht von BodenNivel')
  }
  if (isNum(file['version']) && file['version'] > 1) {
    throw new Error('Die Datei stammt aus einer neueren Version von BodenNivel')
  }
  const wrapper = checkFields(file, { app: isStr, version: (v) => v === 1, project: isObject }, 'Datei', true)
  return checkProject(wrapper['project'], true)
}
