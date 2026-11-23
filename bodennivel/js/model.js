/**
 * Datenmodell von BodenNivel: Typen, Standardwerte und Fabriken.
 * Längen der Messwerte in mm, Raummaße in m. Kein DOM-Zugriff.
 */

import { buildCells, gridDims } from './grid.js'

/**
 * @typedef {object} Settings
 * @property {number} consumption   Verbrauch in kg je mm und m²
 * @property {number} bagKg         Sackgewicht in kg
 * @property {number} minLayer      Mindestschichtdicke in mm
 * @property {number} maxLayer      Grenzwert der Schichtdicke in mm
 * @property {number} reservePct    Reserve in Prozent
 * @property {number} waterPerBag   Wasser je Sack in Litern
 * @property {number} bagsPerPallet Säcke je Palette
 * @property {number} gridSize      Rastermaß in m
 */

/**
 * @typedef {object} SetupRef
 * @property {string} label  Bezeichnung des Referenzpunkts
 * @property {number} before Wert vor dem Umsetzen (alter Standort)
 * @property {number} after  Wert nach dem Umsetzen (neuer Standort)
 * @property {string} baseId  Standort, von dem aus umgesetzt wurde
 */

/**
 * Ein Laser-Standort. Der Versatz bezieht sich auf die Linie von S1.
 * @typedef {object} Setup
 * @property {string} id
 * @property {string} name
 * @property {number} offset
 * @property {SetupRef | null} ref
 */

/** @typedef {'NW' | 'NE' | 'SW' | 'SE'} Corner */

/**
 * @typedef {object} Cell
 * @property {number} row
 * @property {number} col
 * @property {boolean} excluded
 * @property {number | null} value Rohwert in mm
 * @property {string | null} setupId
 */

/**
 * @typedef {object} Point
 * @property {string} id
 * @property {string} label
 * @property {number} value Rohwert in mm
 * @property {string} setupId
 */

/**
 * @typedef {object} Grid
 * @property {number} cols
 * @property {number} rows
 * @property {Cell[]} cells zeilenweise
 */

/**
 * @typedef {object} Room
 * @property {string} id
 * @property {string} name
 * @property {number | null} length Ost-West in m
 * @property {number | null} width  Nord-Süd in m
 * @property {number | null} areaOverride
 * @property {boolean} inGroup
 * @property {Corner} startCorner
 * @property {Grid} grid
 * @property {Point[]} freePoints
 */

/**
 * @typedef {object} Project
 * @property {string} id
 * @property {string} name
 * @property {boolean} connected
 * @property {Settings} settings
 * @property {Setup[]} setups
 * @property {string} activeSetupId
 * @property {Room[]} rooms
 * @property {string} createdAt
 */

/**
 * @typedef {object} AppState
 * @property {1} version
 * @property {string | null} activeProjectId
 * @property {Project[]} projects
 */

/** @type {Readonly<Settings>} */
export const DEFAULT_SETTINGS = Object.freeze({
  consumption: 1.6,
  bagKg: 20,
  minLayer: 3,
  maxLayer: 30,
  reservePct: 5,
  waterPerBag: 4.6,
  bagsPerPallet: 48,
  gridSize: 1,
})

/** @returns {string} */
export function newId() {
  if (typeof globalThis.crypto?.randomUUID === 'function') return globalThis.crypto.randomUUID()
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`
}

/**
 * @param {string} name
 * @returns {Project}
 */
export function createProject(name) {
  const setup = { id: newId(), name: 'S1', offset: 0, ref: null }
  return {
    id: newId(),
    name,
    connected: true,
    settings: { ...DEFAULT_SETTINGS },
    setups: [setup],
    activeSetupId: setup.id,
    rooms: [],
    createdAt: new Date().toISOString(),
  }
}

/** @returns {AppState} */
export function emptyState() {
  const project = createProject('Mein Projekt')
  return { version: 1, activeProjectId: project.id, projects: [project] }
}

/**
 * Neuer Raum. Ohne Maße entsteht kein Raster (Raum nur mit freien Punkten).
 * @param {string} name
 * @param {number | null} length Ost-West in m
 * @param {number | null} width Nord-Süd in m
 * @param {number} gridSize Rastermaß in m
 * @returns {Room}
 */
export function createRoom(name, length, width, gridSize) {
  const { cols, rows } = gridDims(length, width, gridSize)
  return {
    id: newId(),
    name,
    length,
    width,
    areaOverride: null,
    inGroup: true,
    startCorner: 'NW',
    grid: { cols, rows, cells: buildCells(cols, rows) },
    freePoints: [],
  }
}
