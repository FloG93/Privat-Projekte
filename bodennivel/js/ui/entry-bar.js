/**
 * Fixierte Eingabeleiste unten: Wert tippen → Enter → nächste Zelle.
 * Das Feld behält den Fokus, damit die Tastatur offen bleibt.
 */

import { formatNum, parseMeasurement } from '../format.js'
import { nextCell, prevCell, snakeOrder } from '../grid.js'
import { newId } from '../model.js'
import { el, icon } from './dom.js'

/** @typedef {import('../model.js').Project} Project */
/** @typedef {import('../model.js').Room} Room */
/** @typedef {import('../calc.js').RoomResult} RoomResult */
/** @typedef {import('./types.js').Commit} Commit */
/** @typedef {import('./types.js').RoomUi} RoomUi */

/**
 * @typedef {object} EntryCtx
 * @property {Project} project
 * @property {Room} room
 * @property {RoomResult} result
 * @property {Commit} commit
 * @property {() => void} rerender Zeichnet neu, ohne zu speichern
 * @property {RoomUi} ui
 * @property {(() => void) | undefined} [onLaser] öffnet „Laser umsetzen“
 */

let wantFocus = false

/** Beim nächsten Zeichnen das Eingabefeld fokussieren. */
export function requestEntryFocus() {
  wantFocus = true
}

/**
 * Setzt den Fokus, falls angefragt. Muss nach dem Einhängen laufen – und
 * synchron zur Eingabe des Nutzers, sonst schließt iOS die Tastatur.
 * @param {ParentNode} root
 */
export function focusEntry(root) {
  if (!wantFocus) return
  wantFocus = false
  root.querySelector('.entry-input')?.dispatchEvent(new Event('x-focus'))
}

/** @param {number} value */
const toField = (value) => formatNum(value, 1).replace(/\./g, '')

/**
 * @param {EntryCtx} ctx
 * @returns {HTMLElement}
 */
export function renderEntryBar(ctx) {
  const { project, room, commit, rerender, ui } = ctx
  const hasGrid = room.grid.cols > 0
  const selectedCell = ui.selected
    ? room.grid.cells.find((c) => c.row === ui.selected?.row && c.col === ui.selected.col)
    : undefined
  const freeMode = ui.freeLabel !== null
  const canEnter = freeMode || selectedCell !== undefined
  const setup = project.setups.find((s) => s.id === project.activeSetupId)

  const label = freeMode
    ? `Freier Punkt: ${ui.freeLabel}`
    : selectedCell
      ? `R${selectedCell.row + 1} · S${selectedCell.col + 1}`
      : hasGrid ? 'Alle Zellen gemessen' : 'Chip für freien Punkt wählen'

  const input = el('input', {
    class: 'entry-input',
    type: 'text',
    inputmode: 'decimal',
    enterkeyhint: 'next',
    autocomplete: 'off',
    'aria-label': 'Messwert in Millimetern',
    disabled: !canEnter,
    value: !freeMode && selectedCell?.value != null ? toField(selectedCell.value) : '',
  })
  // Fokus kommt von außen (focusEntry), erst wenn das Feld im Dokument hängt.
  input.addEventListener('x-focus', () => { input.focus(); input.select() })
  input.addEventListener('input', () => input.removeAttribute('aria-invalid'))

  /** Wert speichern und zur nächsten Zelle springen. */
  const save = () => {
    const value = parseMeasurement(input.value)
    if (value === null) {
      input.setAttribute('aria-invalid', 'true')
      input.focus()
      return
    }
    requestEntryFocus()
    if (freeMode) {
      const labelText = ui.freeLabel ?? 'Punkt'
      commit((p) => {
        const target = p.rooms.find((r) => r.id === room.id)
        target?.freePoints.push({ id: newId(), label: labelText, value, setupId: p.activeSetupId })
        ui.freeLabel = null
        ui.selected = target ? nextCell(target, null) : null
      })
      return
    }
    const pos = ui.selected
    if (!pos) return
    commit((p) => {
      const target = p.rooms.find((r) => r.id === room.id)
      const cell = target?.grid.cells.find((c) => c.row === pos.row && c.col === pos.col)
      if (!target || !cell) return
      cell.value = value
      cell.setupId = p.activeSetupId
      // Die Zelle ist jetzt belegt: die nächste freie liefert die Reihenfolge.
      ui.selected = nextCell(target, pos)
    })
  }

  const skip = () => {
    requestEntryFocus()
    if (ui.selected) ui.selected = nextCell(room, ui.selected)
    rerender()
  }

  const back = () => {
    requestEntryFocus()
    ui.freeLabel = null
    const order = snakeOrder(room.grid.cols, room.grid.rows, room.startCorner)
    const from = ui.selected ?? order[order.length - 1]
    if (!from) return
    // Ohne Auswahl (alles gemessen) zuerst auf die letzte Zelle springen.
    ui.selected = ui.selected ? prevCell(room, from) ?? ui.selected : lastActive(room, order)
    rerender()
  }

  const clearValue = () => {
    const pos = ui.selected
    if (!pos) return
    requestEntryFocus()
    commit((p) => {
      const cell = p.rooms.find((r) => r.id === room.id)?.grid.cells.find((c) => c.row === pos.row && c.col === pos.col)
      if (cell) {
        cell.value = null
        cell.setupId = null
      }
    })
  }

  const form = el('form', { class: 'entry-form', novalidate: true },
    el('span', { class: 'entry-label' }, label),
    input,
    el('span', { class: 'entry-unit' }, 'mm'),
    el('button', { class: 'btn primary entry-add', type: 'submit', disabled: !canEnter, 'aria-label': 'Speichern und weiter' }, icon('plus')),
  )
  form.addEventListener('submit', (event) => {
    event.preventDefault()
    save()
  })

  return el('div', { class: 'entry' },
    el('div', { class: 'wrap' },
      form,
      el('div', { class: 'entry-tools' },
        el('button', { class: 'btn', type: 'button', onclick: back, disabled: !hasGrid, 'aria-label': 'Zurück zur vorigen Zelle' }, icon('chevron-left'), 'Zurück'),
        el('button', { class: 'btn', type: 'button', onclick: skip, disabled: !selectedCell, 'aria-label': 'Zelle überspringen' }, icon('skip-forward'), 'Überspringen'),
        selectedCell?.value != null
          ? el('button', { class: 'btn', type: 'button', onclick: clearValue, 'aria-label': 'Wert dieser Zelle löschen' }, icon('trash-2'), 'Wert')
          : null,
      ),
      el('div', { class: 'entry-laser' },
        el('span', {}, `Laser: ${setup?.name ?? 'S1'}${setup && setup.offset !== 0 ? ` (${setup.offset > 0 ? '+' : ''}${formatNum(setup.offset)} mm)` : ''}`),
        ctx.onLaser
          ? el('button', { class: 'btn', type: 'button', onclick: ctx.onLaser }, icon('crosshair'), 'Laser umsetzen')
          : null,
      ),
    ),
  )
}

/**
 * @param {Room} room
 * @param {Array<{ row: number, col: number }>} order
 * @returns {{ row: number, col: number } | null}
 */
function lastActive(room, order) {
  for (let i = order.length - 1; i >= 0; i--) {
    const pos = order[i]
    const cell = pos && room.grid.cells.find((c) => c.row === pos.row && c.col === pos.col)
    if (pos && cell && !cell.excluded) return pos
  }
  return null
}
