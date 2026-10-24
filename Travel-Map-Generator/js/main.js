import { wireThemeToggle } from '../../shared/js/theme.js'
import { formatDistance } from './core/geo.js'
import {
  addWaypoint,
  createProject,
  migrateProject,
  moveWaypoint,
  removeWaypoint,
  renameWaypoint,
  reorderWaypoints,
  routeLengthMeters,
  setStyleId,
  setTitle,
} from './core/model.js'
import { evaluateCapabilities, probeBrowser } from './export/capabilities.js'
import { createMap } from './map/map-view.js'
import { createRouteLayer } from './map/route-layer.js'
import { DEFAULT_STYLE_ID, MAP_STYLES, getStyle } from './map/styles.js'
import { createStore, debounce } from './state/store.js'
import { archiveFileName, packProject, unpackProject } from './storage/archive.js'
import { lastProjectId, loadProject, rememberLastProject, saveProject } from './storage/db.js'
import { createWaypointList } from './ui/waypoint-list.js'

/** @typedef {import('./core/model.js').Project} Project */

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

/** @param {string} message */
function report(message) {
  /** @type {HTMLElement} */
  const bar = need('#notice')
  bar.textContent = message
  bar.hidden = message === ''
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

const store = createStore(createProject({ styleId: DEFAULT_STYLE_ID }))
/** @type {string | null} */
let selectedId = null

const map = createMap(need('#map'), DEFAULT_STYLE_ID)
const routeLayer = createRouteLayer(map, {
  onMoved(id, position) {
    store.update((project) => moveWaypoint(project, id, position))
  },
  onSelected(id) {
    select(id)
  },
})

const waypointList = createWaypointList(need('#waypoints'), {
  onRename(id, name) {
    store.update((project) => renameWaypoint(project, id, name))
  },
  onRemove(id) {
    if (selectedId === id) selectedId = null
    store.update((project) => removeWaypoint(project, id))
  },
  onReorder(from, to) {
    store.update((project) => reorderWaypoints(project, from, to))
  },
  onSelect(id) {
    select(id)
  },
})

/** @param {string | null} id */
function select(id) {
  selectedId = id
  routeLayer.select(id)
  // Nur die Hervorhebung umsetzen. Ein Neuaufbau der Liste würde das
  // Eingabefeld zerstören, dessen Fokus die Auswahl gerade ausgelöst hat.
  waypointList.setSelected(id)
}

// Automatisch speichern, aber nicht bei jedem Pixel beim Ziehen eines Markers.
const autosave = debounce((/** @type {Project} */ project) => {
  saveProject(project)
    .then(() => rememberLastProject(project.id))
    .catch((error) => report(`Nicht gespeichert: ${error.message}`))
}, 400)

/** @type {HTMLInputElement} */
const titleInput = need('#project-title')

store.subscribe((project) => {
  routeLayer.render(project)
  waypointList.render(project, selectedId)
  if (titleInput.value !== project.title && document.activeElement !== titleInput) {
    titleInput.value = project.title
  }
  const count = project.waypoints.length
  // Bei einem einzelnen Punkt gibt es noch keine Strecke – dann „0 m" zu
  // zeigen wäre nur Rauschen.
  need('#route-stats').textContent =
    count === 0
      ? 'Noch keine Punkte'
      : count === 1
        ? '1 Punkt'
        : `${count} Punkte · ${formatDistance(routeLengthMeters(project))} Luftlinie`
  need('#fit-route').toggleAttribute('disabled', count === 0)
  need('#export-project').toggleAttribute('disabled', count === 0)
  autosave(project)
})

// Klick auf die Karte hängt einen Punkt an.
map.on('click', (event) => {
  store.update((project) =>
    addWaypoint(project, { lon: event.lngLat.lng, lat: event.lngLat.lat }),
  )
  const added = store.get().waypoints.at(-1)
  if (added) select(added.id)
  report('')
})
map.getCanvas().style.cursor = 'crosshair'

styleSelect.addEventListener('change', () => {
  map.setStyle(getStyle(styleSelect.value).url)
  store.update((project) => setStyleId(project, styleSelect.value))
})

titleInput.addEventListener('change', () => {
  store.update((project) => setTitle(project, titleInput.value))
})

need('#fit-route').addEventListener('click', () => routeLayer.fit())

need('#new-project').addEventListener('click', () => {
  if (store.get().waypoints.length > 0 && !confirm('Neue Reise beginnen? Die aktuelle bleibt gespeichert.')) {
    return
  }
  selectedId = null
  store.set(createProject({ styleId: styleSelect.value }))
  report('')
})

need('#export-project').addEventListener('click', async () => {
  const project = store.get()
  try {
    const bytes = await packProject(project)
    const blobPart = /** @type {Uint8Array<ArrayBuffer>} */ (bytes)
    const url = URL.createObjectURL(new Blob([blobPart], { type: 'application/zip' }))
    const link = document.createElement('a')
    link.href = url
    link.download = archiveFileName(project.title)
    link.click()
    URL.revokeObjectURL(url)
  } catch (error) {
    report(`Export fehlgeschlagen: ${/** @type {Error} */ (error).message}`)
  }
})

/** @type {HTMLInputElement} */
const importInput = need('#import-file')
need('#import-project').addEventListener('click', () => importInput.click())
importInput.addEventListener('change', async () => {
  const file = importInput.files?.[0]
  if (!file) return
  try {
    const project = await unpackProject(new Uint8Array(await file.arrayBuffer()))
    selectedId = null
    store.set(project)
    styleSelect.value = getStyleIdOrDefault(project.style.styleId)
    map.setStyle(getStyle(styleSelect.value).url)
    routeLayer.fit()
    report('')
  } catch (error) {
    report(`Import fehlgeschlagen: ${/** @type {Error} */ (error).message}`)
  } finally {
    importInput.value = ''
  }
})

/**
 * @param {string} styleId
 * @returns {string}
 */
function getStyleIdOrDefault(styleId) {
  return MAP_STYLES.some((style) => style.id === styleId) ? styleId : DEFAULT_STYLE_ID
}

// Beim Schließen darf der letzte Stand nicht in der Wartezeit hängen bleiben.
addEventListener('pagehide', () => autosave.flush())

/** Zuletzt offenes Projekt zurückholen – das ist die Abnahme von M1. */
async function restore() {
  const id = lastProjectId()
  if (!id) {
    store.set(store.get()) // einmal zeichnen, damit die leere Oberfläche stimmt
    return
  }
  try {
    const stored = await loadProject(id)
    if (!stored) {
      store.set(store.get())
      return
    }
    const project = migrateProject(stored)
    store.set(project)
    styleSelect.value = getStyleIdOrDefault(project.style.styleId)
    map.setStyle(getStyle(styleSelect.value).url)
    if (project.waypoints.length > 0) {
      map.once('idle', () => routeLayer.fit())
    }
  } catch (error) {
    report(`Das zuletzt geöffnete Projekt ließ sich nicht laden: ${/** @type {Error} */ (error).message}`)
    store.set(store.get())
  }
}

styleSelect.value = DEFAULT_STYLE_ID
await restore()
