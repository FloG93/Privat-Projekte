/**
 * Einstieg: Zustand, `commit()`, Hash-Routing.
 *
 * Jede Änderung läuft über `commit()` → speichern → neu zeichnen. Die
 * Oberfläche hält keinen eigenen Zustand außer dem, was in `ui` steht
 * (aufgeklappte Bereiche, gewählte Zelle) – das geht beim Neuladen verloren,
 * die Messwerte nicht.
 */

import { wireThemeToggle } from '../../shared/js/theme.js'
import { computeProject } from './calc.js'
import { renderDashboard } from './ui/dashboard.js'
import { openLaserDialog } from './ui/laser-dialog.js'
import { renderPrint } from './ui/print.js'
import { renderRoom } from './ui/room.js'
import { el, icon } from './ui/dom.js'
import { loadState, saveState } from './store.js'

/** @typedef {import('./ui/types.js').Commit} Commit */
/** @typedef {import('./ui/types.js').RoomUi} RoomUi */
/** @typedef {import('./ui/types.js').Ui} Ui */

const loaded = loadState()
let state = loaded.state
let persistent = loaded.persistent
let saveFailed = false

/** @type {Map<string, RoomUi>} */
const roomUis = new Map()

/** @type {Ui} */
const ui = {
  open: new Set(),
  undoRoom: null,
  roomUi(roomId) {
    let entry = roomUis.get(roomId)
    if (!entry) {
      entry = { selected: null, freeLabel: null, show: 'raw' }
      roomUis.set(roomId, entry)
    }
    return entry
  },
}

/** @returns {import('./model.js').Project} */
function getProject() {
  const project = state.projects.find((p) => p.id === state.activeProjectId) ?? state.projects[0]
  if (!project) throw new Error('Kein Projekt vorhanden')
  state.activeProjectId = project.id
  return project
}

/** @type {Commit} */
function commit(mutator) {
  mutator(getProject(), state)
  saveFailed = !saveState(state)
  render()
}

/** @param {string} hash */
function navigate(hash) {
  if (location.hash === hash) render()
  else location.hash = hash
}

/** @returns {{ name: 'dashboard' } | { name: 'room', id: string } | { name: 'print' }} */
function parseRoute() {
  const [, kind, id] = location.hash.split('/')
  if (kind === 'raum' && id) return { name: 'room', id: decodeURIComponent(id) }
  if (kind === 'druck') return { name: 'print' }
  return { name: 'dashboard' }
}

function renderBanner() {
  const banner = document.getElementById('banner')
  if (!banner) return
  const message = !persistent
    ? 'Speicher nicht verfügbar – Änderungen gehen beim Schließen verloren. Bitte exportieren.'
    : saveFailed
      ? 'Wird nicht gespeichert – bitte exportieren.'
      : null
  banner.replaceChildren(...(message ? [el('p', { class: 'banner', role: 'alert' }, icon('triangle-alert'), message)] : []))
}

function render() {
  const root = document.getElementById('app')
  if (!root) return
  const project = getProject()
  const summary = computeProject(project)
  const scroll = window.scrollY
  root.replaceChildren()
  document.body.classList.remove('has-entry')
  const route = parseRoute()
  if (route.name === 'room') {
    const index = project.rooms.findIndex((r) => r.id === route.id)
    const room = project.rooms[index]
    const result = summary.rooms[index]
    if (room && result) {
      ui.undoRoom = null
      renderRoom(root, { project, room, result, commit, rerender: render, navigate, ui: ui.roomUi(room.id), appUi: ui, onLaser: () => openLaserDialog(project, commit) })
      renderBanner()
      window.scrollTo(0, scroll)
      return
    }
  }
  if (route.name === 'print') {
    renderPrint(root, { project, summary })
    renderBanner()
    window.scrollTo(0, scroll)
    return
  }
  // Raum unbekannt (gelöscht, Link aus einem anderen Projekt): zur Übersicht.
  renderDashboard(root, { project, projects: state.projects, summary, commit, navigate, ui })
  renderBanner()
  window.scrollTo(0, scroll)
}

window.addEventListener('hashchange', () => {
  window.scrollTo(0, 0)
  render()
})
// Sicherheitsnetz: zusätzlich zum Speichern bei jeder Änderung.
window.addEventListener('pagehide', () => saveState(state))
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'hidden') saveState(state)
})

wireThemeToggle(document.getElementById('theme'))
render()
