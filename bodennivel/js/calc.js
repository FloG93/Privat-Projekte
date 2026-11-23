/**
 * Fachlogik: Laser-Standorte, Bezugsgruppen, Schichtdicken und Materialbedarf.
 * Reine Funktionen ohne DOM. Messwerte in mm, Flächen in m².
 *
 * Gemessen wird der Abstand Boden → Laserlinie: kleiner Wert = hoher Boden,
 * großer Wert = tiefe Senke. Die Schichtdicke eines Punkts ist
 * `d − dSoll`, wobei dSoll = dMin − Mindestschicht die Soll-Höhe festlegt.
 */

import { formatNum } from './format.js'
import { gridProgress, roomArea } from './grid.js'
import { newId } from './model.js'

/** @typedef {import('./model.js').Project} Project */
/** @typedef {import('./model.js').Room} Room */
/** @typedef {import('./model.js').Setup} Setup */

/** Grenzen der Farbstufen in mm Schichtdicke. */
export const LAYER_OK_MAX = 10
export const LAYER_MID_MAX = 25

/**
 * @typedef {object} RoomResult
 * @property {string} roomId
 * @property {'empty' | 'partial' | 'complete'} status
 * @property {number} measured
 * @property {number} total
 * @property {'grid' | 'free' | null} basis
 * @property {number | null} dMin
 * @property {number | null} dSoll
 * @property {Array<{ setupId: string, name: string, dSoll: number }>} marks
 * @property {Map<string, number>} hCells   Schlüssel „row,col“
 * @property {Map<string, number>} hPoints  Schlüssel Point.id
 * @property {Map<string, number>} diffCells   Differenz zur Laserhöhe in mm (leer ohne Laserhöhe)
 * @property {Map<string, number>} diffPoints  dasselbe für freie Punkte
 * @property {number | null} hMean
 * @property {number | null} hMax
 * @property {number} area
 * @property {number} massKg
 * @property {number} bags
 * @property {number} waterL
 * @property {boolean} overMax
 */

/**
 * @typedef {object} Summary
 * @property {RoomResult[]} rooms
 * @property {number} massKg
 * @property {number} bagsTotal
 * @property {number} bagsSumRooms
 * @property {number} pallets
 * @property {number} palletFull
 * @property {number} palletRest
 * @property {number} waterL
 * @property {number | null} hMeanWeighted
 * @property {string[]} warnings
 */

/**
 * @param {Project} project
 * @param {string | null} setupId
 * @returns {number} Versatz gegenüber S1; 0 für unbekannte Standorte
 */
export function setupOffset(project, setupId) {
  return project.setups.find((setup) => setup.id === setupId)?.offset ?? 0
}

/**
 * Setzt den Laser um: neuer Standort, aktiv. Mutiert das Projekt.
 * @param {Project} project
 * @param {string} label Bezeichnung des Referenzpunkts
 * @param {number} before Wert vor dem Umsetzen (alter Standort)
 * @param {number} after Wert nach dem Umsetzen (neuer Standort)
 * @returns {Setup}
 */
export function addSetup(project, label, before, after) {
  const setup = {
    id: newId(),
    name: `S${project.setups.length + 1}`,
    offset: setupOffset(project, project.activeSetupId) + (after - before),
    ref: { label, before, after, baseId: project.activeSetupId },
  }
  project.setups.push(setup)
  project.activeSetupId = setup.id
  return setup
}

/**
 * Rechnet alle Versätze aus Bezugsstandort und Referenzmessung neu. Nötig,
 * nachdem eine Referenzmessung korrigiert wurde: Folgestandorte bauen darauf auf.
 * @param {Project} project
 */
export function recomputeOffsets(project) {
  for (const setup of project.setups) {
    if (!setup.ref) continue
    setup.offset = setupOffset(project, setup.ref.baseId) + (setup.ref.after - setup.ref.before)
  }
}

/**
 * Korrigiert die Referenzmessung eines Standorts und rechnet alles nach.
 * @param {Project} project
 * @param {string} setupId
 * @param {string} label
 * @param {number} before
 * @param {number} after
 */
export function updateSetupRef(project, setupId, label, before, after) {
  const setup = project.setups.find((s) => s.id === setupId)
  if (!setup?.ref) return
  setup.ref = { ...setup.ref, label, before, after }
  recomputeOffsets(project)
}

/**
 * Hängt an dem Standort noch etwas? (Messwert oder ein Folgestandort)
 * @param {Project} project
 * @param {string} setupId
 * @returns {boolean}
 */
export function setupInUse(project, setupId) {
  if (project.setups.some((s) => s.ref?.baseId === setupId)) return true
  return project.rooms.some((room) =>
    room.grid.cells.some((c) => c.value !== null && c.setupId === setupId)
    || room.freePoints.some((p) => p.setupId === setupId))
}

/**
 * Löscht einen Standort, wenn nichts an ihm hängt. S1 (der erste) bleibt immer.
 * @param {Project} project
 * @param {string} setupId
 * @returns {boolean} ob gelöscht wurde
 */
export function removeSetup(project, setupId) {
  const index = project.setups.findIndex((s) => s.id === setupId)
  if (index <= 0 || setupInUse(project, setupId)) return false
  project.setups.splice(index, 1)
  if (project.activeSetupId === setupId) project.activeSetupId = project.setups[0]?.id ?? project.activeSetupId
  return true
}

/**
 * Rohwert auf die Linie von S1 bezogen.
 * @param {Project} project
 * @param {number} raw
 * @param {string | null} setupId
 * @returns {number}
 */
export function corrected(project, raw, setupId) {
  return raw - setupOffset(project, setupId)
}

/**
 * @param {Project} project
 * @param {Room} room
 * @returns {string} Gleicher Schlüssel = gemeinsamer Bezug
 */
export function groupKey(project, room) {
  return project.connected && room.inGroup ? 'all' : room.id
}

/**
 * @param {number} h Schichtdicke in mm
 * @returns {'ok' | 'mid' | 'high'}
 */
export function layerClass(h) {
  if (h <= LAYER_OK_MAX) return 'ok'
  if (h <= LAYER_MID_MAX) return 'mid'
  return 'high'
}

/**
 * Anzeichen-Maß als Text. Negativ heißt: Die Linie liegt unter dem Soll-Maß.
 * @param {number} dSoll
 * @returns {string}
 */
export function formatMark(dSoll) {
  return dSoll >= 0
    ? `${formatNum(dSoll)} mm unter der Linie`
    : `${formatNum(-dSoll)} mm über der Linie`
}

/**
 * Alle korrigierten Messwerte eines Raums (Raster und freie Punkte).
 * Leere und ausgeschlossene Zellen zählen nicht.
 * @param {Project} project
 * @param {Room} room
 * @returns {number[]}
 */
function roomValues(project, room) {
  /** @type {number[]} */
  const values = []
  for (const cell of room.grid.cells) {
    if (!cell.excluded && cell.value !== null) values.push(corrected(project, cell.value, cell.setupId))
  }
  for (const point of room.freePoints) values.push(corrected(project, point.value, point.setupId))
  return values
}

/** @param {number[]} values */
const mean = (values) => values.reduce((sum, v) => sum + v, 0) / values.length

/**
 * @param {Project} project
 * @param {Room} room
 * @param {number | null} dMin
 * @returns {RoomResult}
 */
function computeRoom(project, room, dMin) {
  const s = project.settings
  const dSoll = dMin === null ? null : dMin - s.minLayer
  const { measured, total } = gridProgress(room)
  const hasGrid = room.grid.cols > 0 && room.grid.rows > 0
  /** @type {Map<string, number>} */
  const hCells = new Map()
  /** @type {Map<string, number>} */
  const hPoints = new Map()
  /** @type {RoomResult['marks']} */
  const marks = dSoll === null
    ? []
    : project.setups.map((setup) => ({ setupId: setup.id, name: setup.name, dSoll: dSoll + setup.offset }))

  if (dSoll !== null) {
    for (const cell of room.grid.cells) {
      if (!cell.excluded && cell.value !== null) {
        hCells.set(`${cell.row},${cell.col}`, corrected(project, cell.value, cell.setupId) - dSoll)
      }
    }
    for (const point of room.freePoints) {
      hPoints.set(point.id, corrected(project, point.value, point.setupId) - dSoll)
    }
  }

  // Differenz zur Laserhöhe: nur zur Anzeige. Gerechnet wird mit den
  // abgelesenen Werten, damit das Anzeichen-Maß ein echtes Maß bleibt.
  /** @type {Map<string, number>} */
  const diffCells = new Map()
  /** @type {Map<string, number>} */
  const diffPoints = new Map()
  if (s.laserHeight > 0) {
    for (const cell of room.grid.cells) {
      if (!cell.excluded && cell.value !== null) {
        diffCells.set(`${cell.row},${cell.col}`, corrected(project, cell.value, cell.setupId) - s.laserHeight)
      }
    }
    for (const point of room.freePoints) {
      diffPoints.set(point.id, corrected(project, point.value, point.setupId) - s.laserHeight)
    }
  }

  const gridH = [...hCells.values()]
  const freeH = [...hPoints.values()]
  /** @type {RoomResult['basis']} */
  const basis = gridH.length > 0 ? 'grid' : freeH.length > 0 ? 'free' : null
  const hMean = basis === 'grid' ? mean(gridH) : basis === 'free' ? mean(freeH) : null
  const all = [...gridH, ...freeH]
  const hMax = all.length > 0 ? Math.max(...all) : null
  const area = roomArea(room)
  const massKg = hMean === null ? 0 : area * hMean * s.consumption * (1 + s.reservePct / 100)
  const bags = massKg > 0 ? Math.ceil(massKg / s.bagKg) : 0

  /** @type {RoomResult['status']} */
  let status = 'empty'
  if (all.length > 0) {
    const complete = hasGrid ? total > 0 && measured === total : true
    status = complete ? 'complete' : 'partial'
  }

  return {
    roomId: room.id,
    status,
    measured,
    total,
    basis,
    dMin,
    dSoll,
    marks,
    hCells,
    hPoints,
    diffCells,
    diffPoints,
    hMean,
    hMax,
    area,
    massKg,
    bags,
    waterL: bags * s.waterPerBag,
    overMax: hMax !== null && hMax > s.maxLayer,
  }
}

/** Größte Abweichung von der Laserhöhe, die noch als plausibel gilt (mm). */
export const READING_TOLERANCE_MM = 100

/**
 * Kann dieser abgelesene Wert zur eingestellten Laserhöhe passen? Fängt
 * falsche Einheiten ab („30,4“ in mm statt cm). Ohne Laserhöhe gibt es nichts
 * zu prüfen.
 * @param {Project} project
 * @param {number} raw abgelesener Wert in mm
 * @param {string | null} setupId
 * @returns {boolean}
 */
export function isPlausibleReading(project, raw, setupId) {
  const height = project.settings.laserHeight
  if (height <= 0) return true
  return Math.abs(corrected(project, raw, setupId) - height) <= READING_TOLERANCE_MM
}

/**
 * Rechnet das ganze Projekt.
 * @param {Project} project
 * @returns {Summary}
 */
export function computeProject(project) {
  const s = project.settings

  /** @type {Map<string, number>} */
  const groupMin = new Map()
  for (const room of project.rooms) {
    const values = roomValues(project, room)
    if (values.length === 0) continue
    const key = groupKey(project, room)
    groupMin.set(key, Math.min(groupMin.get(key) ?? Infinity, ...values))
  }

  const rooms = project.rooms.map((room) => computeRoom(project, room, groupMin.get(groupKey(project, room)) ?? null))

  /** @type {string[]} */
  const warnings = []
  project.rooms.forEach((room, i) => {
    const r = rooms[i]
    if (!r) return
    if (r.overMax && r.hMax !== null) {
      warnings.push(`${room.name}: max. ${formatNum(r.hMax)} mm über Grenzwert ${formatNum(s.maxLayer)} mm`)
    }
    if (r.status === 'partial' && r.total > 0) {
      warnings.push(`${room.name}: vorläufig – ${r.measured} von ${r.total} Punkten`)
    }
    if (r.status !== 'empty' && r.area === 0) warnings.push(`${room.name}: Fläche fehlt`)
  })

  const massKg = rooms.reduce((sum, r) => sum + r.massKg, 0)
  const bagsTotal = massKg > 0 ? Math.ceil(massKg / s.bagKg) : 0
  const weighted = rooms.filter((r) => r.hMean !== null && r.area > 0)
  const areaSum = weighted.reduce((sum, r) => sum + r.area, 0)

  return {
    rooms,
    massKg,
    bagsTotal,
    bagsSumRooms: rooms.reduce((sum, r) => sum + r.bags, 0),
    pallets: Math.ceil(bagsTotal / s.bagsPerPallet),
    palletFull: Math.floor(bagsTotal / s.bagsPerPallet),
    palletRest: bagsTotal % s.bagsPerPallet,
    waterL: bagsTotal * s.waterPerBag,
    hMeanWeighted: areaSum > 0 ? weighted.reduce((sum, r) => sum + r.area * (r.hMean ?? 0), 0) / areaSum : null,
    warnings,
  }
}
