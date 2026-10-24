/**
 * Projekt-Schema v1 und die Operationen darauf – reine Funktionen, kein DOM.
 *
 * Aufbau: Ein Projekt ist eine Folge von **Wegpunkten** und den **Etappen**
 * dazwischen. `legs[i]` verbindet `waypoints[i]` mit `waypoints[i + 1]`, es
 * gibt also immer genau eine Etappe weniger als Punkte. Diese Zusage prüft
 * `validateProject()`, und jede Operation hier hält sie ein.
 *
 * Warum Etappen und nicht ein Modus fürs ganze Projekt: Eine Reise fährt mit
 * dem Motorrad bis zum Hafen, setzt per Schiff über und fährt weiter. Der
 * Fortbewegungsmodus gehört deshalb an die Strecke, nicht an die Reise.
 *
 * Alle Operationen geben ein **neues** Projekt zurück und verändern das
 * übergebene nicht. Das kostet bei dieser Datenmenge nichts und ist die
 * Grundlage für Undo/Redo über Schnappschüsse (M9).
 */

import { clampLat, normalizeLon, pathLengthMeters } from './geo.js'

/** @typedef {import('./geo.js').LonLat} LonLat */

/** Aktuelle Fassung des Schemas. Wird in jeder Projektdatei mitgeschrieben. */
export const SCHEMA_VERSION = 1

/**
 * Fortbewegung einer Etappe.
 *
 * M1 kennt nur `line` – die Luftlinie. Die übrigen Werte stehen schon hier,
 * damit gespeicherte Projekte später nicht wandern müssen; die Oberfläche
 * bietet sie erst an, wenn M2 das Routing bringt.
 *
 * @typedef {'line' | 'car' | 'motorcycle' | 'bicycle' | 'foot' | 'plane' | 'ship' | 'gpx'} LegMode
 */

/**
 * @typedef {object} Waypoint
 * @property {string} id      Stabil über Umsortieren und Speichern hinweg.
 * @property {string} name    Darf leer sein – dann zeigt die Oberfläche die Nummer.
 * @property {number} lon     −180…180
 * @property {number} lat     −85,051…85,051 (was Web-Mercator darstellen kann)
 */

/**
 * @typedef {object} Leg
 * @property {string} id
 * @property {LegMode} mode
 * @property {LonLat[] | null} geometry  Berechneter Verlauf (ab M2); `null`
 *   heißt: Es gilt die gerade Verbindung der beiden Wegpunkte.
 */

/**
 * @typedef {object} Project
 * @property {number} schemaVersion
 * @property {string} id
 * @property {string} title
 * @property {string} createdAt   ISO-8601
 * @property {string} updatedAt   ISO-8601
 * @property {Waypoint[]} waypoints
 * @property {Leg[]} legs         Immer `max(waypoints.length - 1, 0)` Stück
 * @property {{styleId: string}} style
 */

/** @returns {string} */
function newId() {
  // randomUUID gibt es im Browser und in Node; der Rückfall ist nur für ganz
  // alte Umgebungen und muss nicht kryptografisch sein – die Kennungen sind
  // rein intern.
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  return `id-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`
}

/** @returns {string} */
const now = () => new Date().toISOString()

/**
 * @param {Project} project
 * @param {Partial<Project>} changes
 * @returns {Project}
 */
function updated(project, changes) {
  return { ...project, ...changes, updatedAt: now() }
}

/**
 * Hält die Zusage „eine Etappe weniger als Punkte" ein: hängt fehlende Etappen
 * an und wirft überzählige weg. Vorhandene Etappen behalten ihren Modus.
 * @param {Leg[]} legs
 * @param {number} waypointCount
 * @returns {Leg[]}
 */
function fitLegs(legs, waypointCount) {
  const wanted = Math.max(waypointCount - 1, 0)
  const result = legs.slice(0, wanted)
  while (result.length < wanted) result.push(createLeg())
  return result
}

/**
 * @param {LegMode} [mode]
 * @returns {Leg}
 */
export function createLeg(mode = 'line') {
  return { id: newId(), mode, geometry: null }
}

/**
 * Ein leeres Projekt.
 * @param {{title?: string, styleId?: string}} [options]
 * @returns {Project}
 */
export function createProject(options = {}) {
  const timestamp = now()
  return {
    schemaVersion: SCHEMA_VERSION,
    id: newId(),
    title: options.title ?? 'Neue Reise',
    createdAt: timestamp,
    updatedAt: timestamp,
    waypoints: [],
    legs: [],
    style: { styleId: options.styleId ?? 'liberty' },
  }
}

/**
 * Hängt einen Wegpunkt ans Ende der Reise.
 * @param {Project} project
 * @param {{lon: number, lat: number, name?: string}} point
 * @returns {Project}
 */
export function addWaypoint(project, point) {
  /** @type {Waypoint} */
  const waypoint = {
    id: newId(),
    name: point.name ?? '',
    lon: normalizeLon(point.lon),
    lat: clampLat(point.lat),
  }
  const waypoints = [...project.waypoints, waypoint]
  return updated(project, { waypoints, legs: fitLegs(project.legs, waypoints.length) })
}

/**
 * Verschiebt einen Wegpunkt. Die Etappen daneben verlieren ihren berechneten
 * Verlauf – er gehörte zur alten Lage und wäre jetzt gelogen.
 * @param {Project} project
 * @param {string} waypointId
 * @param {{lon: number, lat: number}} position
 * @returns {Project}
 */
export function moveWaypoint(project, waypointId, position) {
  const index = project.waypoints.findIndex((candidate) => candidate.id === waypointId)
  if (index === -1) throw new Error(`Unbekannter Wegpunkt: ${waypointId}`)

  const waypoints = project.waypoints.map((waypoint, at) =>
    at === index
      ? { ...waypoint, lon: normalizeLon(position.lon), lat: clampLat(position.lat) }
      : waypoint,
  )
  const legs = project.legs.map((leg, at) =>
    at === index - 1 || at === index ? { ...leg, geometry: null } : leg,
  )
  return updated(project, { waypoints, legs })
}

/**
 * @param {Project} project
 * @param {string} waypointId
 * @param {string} name
 * @returns {Project}
 */
export function renameWaypoint(project, waypointId, name) {
  if (!project.waypoints.some((candidate) => candidate.id === waypointId)) {
    throw new Error(`Unbekannter Wegpunkt: ${waypointId}`)
  }
  const waypoints = project.waypoints.map((waypoint) =>
    waypoint.id === waypointId ? { ...waypoint, name: name.trim() } : waypoint,
  )
  return updated(project, { waypoints })
}

/**
 * Entfernt einen Wegpunkt. Dabei fällt die Etappe **vor** ihm weg, damit die
 * Modi der übrigen Etappen an ihren Strecken bleiben; beim ersten Punkt ist es
 * die Etappe dahinter.
 * @param {Project} project
 * @param {string} waypointId
 * @returns {Project}
 */
export function removeWaypoint(project, waypointId) {
  const index = project.waypoints.findIndex((candidate) => candidate.id === waypointId)
  if (index === -1) throw new Error(`Unbekannter Wegpunkt: ${waypointId}`)

  const waypoints = project.waypoints.filter((_, at) => at !== index)
  const dropped = index === 0 ? 0 : index - 1
  const legs = project.legs.filter((_, at) => at !== dropped)
  // Die Etappe am Schnitt kannte einen Verlauf zwischen zwei anderen Punkten.
  const stitched = legs.map((leg, at) => (at === dropped - 1 ? { ...leg, geometry: null } : leg))
  return updated(project, { waypoints, legs: fitLegs(stitched, waypoints.length) })
}

/**
 * Sortiert einen Wegpunkt um.
 *
 * Die Modi der Etappen bleiben an ihrer Stelle in der Reise (die zweite Etappe
 * bleibt die zweite Etappe), berechnete Verläufe werden verworfen – nach einem
 * Umsortieren stimmt keiner davon mehr.
 *
 * @param {Project} project
 * @param {number} fromIndex
 * @param {number} toIndex
 * @returns {Project}
 */
export function reorderWaypoints(project, fromIndex, toIndex) {
  const count = project.waypoints.length
  if (!Number.isInteger(fromIndex) || fromIndex < 0 || fromIndex >= count) {
    throw new RangeError(`Position außerhalb der Reise: ${fromIndex}`)
  }
  if (!Number.isInteger(toIndex) || toIndex < 0 || toIndex >= count) {
    throw new RangeError(`Position außerhalb der Reise: ${toIndex}`)
  }
  if (fromIndex === toIndex) return project

  const waypoints = [...project.waypoints]
  const [moved] = waypoints.splice(fromIndex, 1)
  if (moved) waypoints.splice(toIndex, 0, moved)

  const legs = project.legs.map((leg) => ({ ...leg, geometry: null }))
  return updated(project, { waypoints, legs })
}

/**
 * @param {Project} project
 * @param {string} title
 * @returns {Project}
 */
export function setTitle(project, title) {
  const trimmed = title.trim()
  return updated(project, { title: trimmed === '' ? 'Neue Reise' : trimmed })
}

/**
 * @param {Project} project
 * @param {string} styleId
 * @returns {Project}
 */
export function setStyleId(project, styleId) {
  return updated(project, { style: { ...project.style, styleId } })
}

/**
 * Die Punktfolge der ganzen Reise – für Karte und Längenberechnung.
 *
 * Solange eine Etappe keinen berechneten Verlauf hat (M1: nie), ist das die
 * gerade Verbindung ihrer beiden Wegpunkte.
 *
 * @param {Project} project
 * @returns {LonLat[]}
 */
export function routeLine(project) {
  /** @type {LonLat[]} */
  const line = []
  project.waypoints.forEach((waypoint, index) => {
    if (index > 0) {
      const geometry = project.legs[index - 1]?.geometry
      // Erster und letzter Punkt des Verlaufs sind die Wegpunkte selbst.
      if (geometry) line.push(...geometry.slice(1, -1))
    }
    line.push([waypoint.lon, waypoint.lat])
  })
  return line
}

/**
 * Länge der Reise in Metern.
 * @param {Project} project
 * @returns {number}
 */
export function routeLengthMeters(project) {
  return pathLengthMeters(routeLine(project))
}

/**
 * Prüft ein Projekt, das von außen kommt (Datei, IndexedDB, alte Fassung).
 *
 * Wirft mit einem Satz, der sagt, was fehlt. Lieber hier laut scheitern als
 * später mit einer leeren Karte und einer Konsolenzeile.
 *
 * @param {unknown} value
 * @returns {Project}
 */
export function validateProject(value) {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new TypeError('Projektdatei enthält kein Projekt.')
  }
  const project = /** @type {Record<string, unknown>} */ (value)

  if (project['schemaVersion'] !== SCHEMA_VERSION) {
    throw new TypeError(
      `Unerwartete Schema-Fassung: ${String(project['schemaVersion'])} (erwartet ${SCHEMA_VERSION}).`,
    )
  }
  for (const field of ['id', 'title', 'createdAt', 'updatedAt']) {
    if (typeof project[field] !== 'string' || project[field] === '') {
      throw new TypeError(`Projekt ohne ${field}.`)
    }
  }
  if (!Array.isArray(project['waypoints'])) throw new TypeError('Projekt ohne Wegpunkte-Liste.')
  if (!Array.isArray(project['legs'])) throw new TypeError('Projekt ohne Etappen-Liste.')

  const waypoints = project['waypoints']
  for (const [index, entry] of waypoints.entries()) {
    const waypoint = /** @type {Record<string, unknown>} */ (entry)
    if (typeof waypoint?.['id'] !== 'string') throw new TypeError(`Wegpunkt ${index + 1} ohne id.`)
    if (typeof waypoint['name'] !== 'string') throw new TypeError(`Wegpunkt ${index + 1} ohne Namen.`)
    for (const axis of ['lon', 'lat']) {
      if (!Number.isFinite(waypoint[axis])) {
        throw new TypeError(`Wegpunkt ${index + 1} hat keine gültige Koordinate (${axis}).`)
      }
    }
  }

  const legs = project['legs']
  const expected = Math.max(waypoints.length - 1, 0)
  if (legs.length !== expected) {
    throw new TypeError(
      `Zu ${waypoints.length} Wegpunkten gehören ${expected} Etappen, gefunden ${legs.length}.`,
    )
  }

  const style = /** @type {Record<string, unknown> | undefined} */ (project['style'])
  if (typeof style?.['styleId'] !== 'string') throw new TypeError('Projekt ohne Kartenstil.')

  return /** @type {Project} */ (/** @type {unknown} */ (project))
}

/**
 * Bringt ein gespeichertes Projekt auf die aktuelle Schema-Fassung.
 *
 * Noch gibt es nur Fassung 1, also ist hier nichts zu tun. Der Haken steht
 * trotzdem schon: Jede künftige Änderung am Schema bekommt hier einen Schritt,
 * und alte Dateien lassen sich weiter öffnen. Eine Datei aus der Zukunft
 * lehnen wir ab, statt Felder stillschweigend zu verlieren.
 *
 * @param {unknown} value
 * @returns {Project}
 */
export function migrateProject(value) {
  if (typeof value !== 'object' || value === null) {
    throw new TypeError('Projektdatei enthält kein Projekt.')
  }
  const version = /** @type {Record<string, unknown>} */ (value)['schemaVersion']
  if (typeof version !== 'number' || !Number.isInteger(version) || version < 1) {
    throw new TypeError(`Projektdatei ohne brauchbare Schema-Fassung: ${String(version)}`)
  }
  if (version > SCHEMA_VERSION) {
    throw new TypeError(
      `Die Datei stammt aus einer neueren Fassung der App (Schema ${version}, hier ${SCHEMA_VERSION}). Bitte die App aktualisieren.`,
    )
  }

  // Ab hier kämen die Schritte: if (version < 2) { … }
  return validateProject(value)
}
