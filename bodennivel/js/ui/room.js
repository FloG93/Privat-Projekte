/**
 * Raumansicht: Draufsicht, Eingabeleiste, freie Punkte, Ergebnis.
 */

import { formatKg, formatL, formatM2, formatMm, formatNum, parseMeasurement, parseNum } from '../format.js'
import { formatMark, layerClass } from '../calc.js'
import { buildCells, gridDims, gridProgress, nextCell, spacing } from '../grid.js'
import { validateRoomForm } from './dashboard.js'
import { confirmDialog, el, formDialog, icon } from './dom.js'
import { focusEntry, renderEntryBar, requestEntryFocus } from './entry-bar.js'
import { renderPlan } from './plan-svg.js'

/** @typedef {import('../model.js').Project} Project */
/** @typedef {import('../model.js').Room} Room */
/** @typedef {import('../calc.js').RoomResult} RoomResult */
/** @typedef {import('./types.js').Commit} Commit */
/** @typedef {import('./types.js').RoomUi} RoomUi */
/** @typedef {import('./types.js').Ui} Ui */

/**
 * @typedef {object} RoomCtx
 * @property {Project} project
 * @property {Room} room
 * @property {RoomResult} result
 * @property {Commit} commit
 * @property {() => void} rerender
 * @property {(hash: string) => void} navigate
 * @property {RoomUi} ui
 * @property {Ui} appUi
 * @property {(() => void) | undefined} [onLaser]
 */

/** Feste Bezeichnungen für freie Punkte (Spec 6.2). */
const FREE_CHIPS = ['Ecke NW', 'Ecke NO', 'Ecke SW', 'Ecke SO', 'Mitte', 'Tür']

const CORNERS = [
  { value: 'NW', label: 'oben links (Nordwest)' },
  { value: 'NE', label: 'oben rechts (Nordost)' },
  { value: 'SW', label: 'unten links (Südwest)' },
  { value: 'SE', label: 'unten rechts (Südost)' },
]

/**
 * @param {HTMLElement} root
 * @param {RoomCtx} ctx
 */
export function renderRoom(root, ctx) {
  const { room, ui } = ctx
  document.body.classList.add('has-entry')

  // Ohne Auswahl beginnt die Messung bei der ersten freien Zelle.
  if (room.grid.cols > 0 && ui.selected === null && ui.freeLabel === null) {
    ui.selected = nextCell(room, null)
  }

  root.append(
    roomHead(ctx),
    room.grid.cols > 0 ? planBlock(ctx) : el('p', { class: 'card muted' },
      'Dieser Raum hat kein Raster. Misst du hier gezielt einzelne Stellen, nimm die Chips unten (Ecke, Mitte, Tür …).'),
    freePointsBlock(ctx),
    resultBlock(ctx),
    renderEntryBar(ctx),
  )
  focusEntry(root)
}

// ---------------------------------------------------------------------------

/** @param {RoomCtx} ctx */
function roomHead(ctx) {
  const { project, room, result, commit, navigate, appUi } = ctx
  return el('section', { class: 'room-head' },
    el('div', { class: 'row' },
      el('a', { class: 'btn icon-btn', href: '#/', 'aria-label': 'Zurück zur Übersicht', title: 'Zurück' }, icon('chevron-left')),
      el('h1', {}, room.name),
      result.overMax || result.status === 'partial'
        ? el('span', { class: 'warn-inline', title: result.overMax ? 'Grenzwert überschritten' : 'Vorläufig' }, icon('triangle-alert'))
        : null,
      el('button', { class: 'btn icon-btn', type: 'button', title: 'Raum bearbeiten', 'aria-label': 'Raum bearbeiten', onclick: () => editRoom(ctx) }, icon('pencil')),
      el('button', {
        class: 'btn icon-btn',
        type: 'button',
        title: 'Raum löschen',
        'aria-label': 'Raum löschen',
        onclick: async () => {
          if (!(await confirmDialog(`Raum „${room.name}“ mit allen Messwerten löschen?`))) return
          const index = project.rooms.findIndex((r) => r.id === room.id)
          appUi.undoRoom = { room: structuredClone(room), index }
          commit((p) => { p.rooms = p.rooms.filter((r) => r.id !== room.id) })
          navigate('#/')
        },
      }, icon('trash-2')),
    ),
    el('p', { class: 'muted' }, result.area > 0 ? formatM2(result.area) : 'Fläche fehlt – im Raum bearbeiten eintragen'),
    project.connected
      ? el('label', { class: 'switch compact' },
        el('input', {
          type: 'checkbox',
          checked: room.inGroup,
          onchange: (/** @type {Event} */ e) => {
            const on = /** @type {HTMLInputElement} */ (e.target).checked
            commit((p) => {
              const target = p.rooms.find((r) => r.id === room.id)
              if (target) target.inGroup = on
            })
          },
        }),
        el('span', {}, 'Gehört zum schwellenlosen Verbund'))
      : null,
  )
}

/** @param {RoomCtx} ctx */
async function editRoom(ctx) {
  const { project, room, commit } = ctx
  const values = await formDialog({
    title: 'Raum bearbeiten',
    fields: [
      { name: 'name', label: 'Name', value: room.name },
      { name: 'length', label: 'Länge Ost–West (m)', kind: 'decimal', value: room.length === null ? '' : formatNum(room.length, 3).replace(/\./g, '') },
      { name: 'width', label: 'Breite Nord–Süd (m)', kind: 'decimal', value: room.width === null ? '' : formatNum(room.width, 3).replace(/\./g, '') },
      { name: 'area', label: 'Fläche manuell (m²), optional', kind: 'decimal', value: room.areaOverride === null ? '' : formatNum(room.areaOverride, 3).replace(/\./g, ''), hint: 'Überschreibt Länge × Breite. Leer = berechnen.' },
      { name: 'corner', label: 'Messung beginnt', kind: 'select', value: room.startCorner, options: CORNERS },
    ],
    validate: (v) => validateRoomForm(v, project.settings.gridSize),
  })
  if (!values) return

  const length = parseNum(values['length'] ?? '')
  const width = parseNum(values['width'] ?? '')
  const dimsChanged = length !== room.length || width !== room.width
  const next = dimsChanged ? gridDims(length, width, project.settings.gridSize) : { cols: room.grid.cols, rows: room.grid.rows }
  const gridChanged = next.cols !== room.grid.cols || next.rows !== room.grid.rows
  if (gridChanged && gridProgress(room).measured > 0) {
    const ok = await confirmDialog(
      'Das Raster ändert sich. Werte bleiben nach (Zeile, Spalte) erhalten, soweit sie noch ins neue Raster passen – alle anderen gehen verloren. Fortfahren?',
      'Raster ändern',
    )
    if (!ok) return
  }

  commit((p) => {
    const target = p.rooms.find((r) => r.id === room.id)
    if (!target) return
    target.name = (values['name'] ?? '').trim()
    target.length = length
    target.width = width
    target.areaOverride = parseNum(values['area'] ?? '')
    const corner = values['corner']
    if (corner === 'NW' || corner === 'NE' || corner === 'SW' || corner === 'SE') target.startCorner = corner
    if (gridChanged) {
      target.grid = { cols: next.cols, rows: next.rows, cells: buildCells(next.cols, next.rows, target.grid.cells) }
      ctx.ui.selected = null
    }
  })
}

// ---------------------------------------------------------------------------

/** @param {RoomCtx} ctx */
function planBlock(ctx) {
  const { room, result, commit, rerender, ui } = ctx
  const progress = gridProgress(room)
  const sx = room.length ? spacing(room.length, room.grid.cols) : null
  const sy = room.width ? spacing(room.width, room.grid.rows) : null

  const plan = renderPlan(room, result, ui,
    (cell) => {
      ui.selected = cell
      ui.freeLabel = null
      requestEntryFocus()
      rerender()
    },
    (cell) => {
      commit((p) => {
        const target = p.rooms.find((r) => r.id === room.id)
        const c = target?.grid.cells.find((x) => x.row === cell.row && x.col === cell.col)
        if (c) c.excluded = !c.excluded
      })
    })

  /** @param {'raw' | 'h' | 'both'} mode @param {string} text */
  const modeButton = (mode, text) => el('button', {
    class: ui.show === mode ? 'chip on' : 'chip',
    type: 'button',
    onclick: () => { ui.show = mode; rerender() },
  }, text)

  return el('section', { class: 'card plan-card' },
    plan,
    el('div', { class: 'plan-meta' },
      el('strong', {}, `${progress.measured}/${progress.total} gemessen`),
      el('div', { class: 'chips' }, modeButton('raw', 'Messwert'), modeButton('h', 'Schichtdicke')),
    ),
    el('p', { class: 'hint' }, 'Kleiner Wert = hoher Boden · Großer Wert = tiefe Senke'),
    sx && sy
      ? el('small', {},
        `Messpunkte: erster Punkt ${formatNum(sx.first, 2)} m von der Westwand, dann alle ${formatNum(sx.step, 2)} m · `
        + `von der Nordwand ${formatNum(sy.first, 2)} m, dann alle ${formatNum(sy.step, 2)} m. `
        + 'Zelle lange drücken: gehört nicht zum Raum.')
      : null,
  )
}

// ---------------------------------------------------------------------------

/** @param {RoomCtx} ctx */
function freePointsBlock(ctx) {
  const { room, result, commit, rerender, ui } = ctx
  const nextLabel = `P${room.freePoints.length + 1}`

  const chips = [...FREE_CHIPS, nextLabel].map((label) =>
    el('button', {
      class: ui.freeLabel === label ? 'chip on' : 'chip',
      type: 'button',
      onclick: () => {
        ui.freeLabel = ui.freeLabel === label ? null : label
        requestEntryFocus()
        rerender()
      },
    }, label))

  const items = room.freePoints.map((point) => {
    const h = result.hPoints.get(point.id)
    return el('li', { class: 'point' },
      el('span', { class: `tile ${h === undefined ? 'empty' : layerClass(h)}` }, h === undefined ? '–' : formatNum(h)),
      el('span', { class: 'point-main' }, el('strong', {}, point.label), el('small', {}, `Messwert ${formatMm(point.value)}`)),
      el('button', {
        class: 'btn icon-btn', type: 'button', title: 'Wert ändern', 'aria-label': `${point.label}: Wert ändern`,
        onclick: async () => {
          const values = await formDialog({
            title: point.label,
            fields: [{ name: 'value', label: 'Messwert (mm)', kind: 'decimal', value: formatNum(point.value, 1).replace(/\./g, '') }],
            validate: (v) => (parseMeasurement(v['value'] ?? '') === null ? 'Bitte einen Wert zwischen 0 und 2000 mm eingeben.' : null),
          })
          const value = values ? parseMeasurement(values['value'] ?? '') : null
          if (value === null) return
          commit((p) => {
            const target = p.rooms.find((r) => r.id === room.id)?.freePoints.find((x) => x.id === point.id)
            if (target) target.value = value
          })
        },
      }, icon('pencil')),
      el('button', {
        class: 'btn icon-btn', type: 'button', title: 'Punkt löschen', 'aria-label': `${point.label} löschen`,
        onclick: async () => {
          if (!(await confirmDialog(`Freien Punkt „${point.label}“ löschen?`))) return
          commit((p) => {
            const target = p.rooms.find((r) => r.id === room.id)
            if (target) target.freePoints = target.freePoints.filter((x) => x.id !== point.id)
          })
        },
      }, icon('trash-2')))
  })

  return el('section', { class: 'card' },
    el('h2', {}, 'Freie Punkte'),
    el('p', { class: 'muted' }, 'Gezielt gemessene Stellen (Ecken, Tür …). Sie zählen für den höchsten Punkt und die maximale Schicht, nicht für den Mittelwert.'),
    el('div', { class: 'chips wrap-chips' }, ...chips),
    items.length > 0 ? el('ul', { class: 'points' }, ...items) : null,
  )
}

// ---------------------------------------------------------------------------

/** @param {RoomCtx} ctx */
function resultBlock(ctx) {
  const { room, result } = ctx
  if (result.status === 'empty') {
    return el('section', { class: 'card' }, el('h2', {}, 'Ergebnis'), el('p', { class: 'muted' }, 'Noch nicht gemessen.'))
  }
  /** @param {string} label @param {string} value */
  const row = (label, value) => el('div', { class: 'kv' }, el('dt', {}, label), el('dd', {}, value))
  return el('section', { class: 'card' },
    el('h2', {}, 'Ergebnis'),
    result.status === 'partial' && result.total > 0
      ? el('p', { class: 'note warn-note' }, icon('triangle-alert'), `Vorläufig – ${result.measured} von ${result.total} Punkten gemessen.`)
      : null,
    result.basis === 'free' && room.grid.cols === 0
      ? el('p', { class: 'note' }, 'Ohne Raster: Mittelwert aus den freien Punkten.')
      : null,
    result.overMax
      ? el('p', { class: 'note warn-note' }, icon('triangle-alert'), `Maximale Schicht ${formatMm(result.hMax ?? 0)} liegt über dem Grenzwert.`)
      : null,
    el('dl', {},
      result.dMin !== null ? row('Höchster Punkt (d min)', formatMm(result.dMin)) : null,
      ...result.marks.map((m) => row(`Anzeichen-Maß ${m.name}`, formatMark(m.dSoll))),
      result.hMean !== null ? row('Ø Schichtdicke', formatMm(result.hMean)) : null,
      result.hMax !== null ? row('Max. Schichtdicke', formatMm(result.hMax)) : null,
      row('Masse', result.area > 0 ? formatKg(result.massKg) : '–'),
      row('Säcke', `${result.bags}`),
      row('Wasser', formatL(result.waterL)),
    ),
  )
}
