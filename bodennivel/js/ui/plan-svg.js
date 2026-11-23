/**
 * Draufsicht eines Raums als SVG: ein Kästchen je Rasterzelle mit dem
 * Messwert, Farbe nach Schichtdicke. Oben ist Norden, links Westen.
 */

import { layerClass } from '../calc.js'
import { formatDiff, formatNum, formatReading } from '../format.js'

/** @typedef {import('../model.js').Room} Room */
/** @typedef {import('../calc.js').RoomResult} RoomResult */
/** @typedef {import('./types.js').RoomUi} RoomUi */
/** @typedef {{ row: number, col: number }} CellPos */

const NS = 'http://www.w3.org/2000/svg'
const CELL = 100
const MARGIN = 44
/** So lange gedrückt halten, bis eine Zelle aus dem Raum genommen wird. */
const LONG_PRESS_MS = 500

/**
 * @param {string} tag
 * @param {Record<string, string | number>} [attrs]
 * @param {...(Node | string)} children
 * @returns {SVGElement}
 */
function svg(tag, attrs = {}, ...children) {
  const node = document.createElementNS(NS, tag)
  for (const [key, value] of Object.entries(attrs)) node.setAttribute(key, String(value))
  node.append(...children)
  return node
}

/**
 * @param {Room} room
 * @param {RoomResult} result
 * @param {Pick<RoomUi, 'selected' | 'show'>} ui
 * @param {import('../format.js').InputUnit} unit Einheit der angezeigten Messwerte
 * @param {(cell: CellPos) => void} onSelect
 * @param {(cell: CellPos) => void} onToggleExclude
 * @returns {SVGElement}
 */
export function renderPlan(room, result, ui, unit, onSelect, onToggleExclude) {
  const { cols, rows } = room.grid
  const width = cols * CELL
  const height = rows * CELL
  const root = svg('svg', {
    class: 'plan',
    viewBox: `${-MARGIN} ${-MARGIN} ${width + 2 * MARGIN} ${height + 2 * MARGIN}`,
    role: 'group',
    'aria-label': `Draufsicht ${room.name}`,
  })

  root.append(svg('defs', {},
    svg('pattern', { id: 'plan-hatch', width: 14, height: 14, patternUnits: 'userSpaceOnUse', patternTransform: 'rotate(45)' },
      svg('line', { x1: 0, y1: 0, x2: 0, y2: 14, class: 'hatch-line', 'stroke-width': 5 }))))

  for (const cell of room.grid.cells) {
    const key = `${cell.row},${cell.col}`
    const h = result.hCells.get(key)
    const measured = !cell.excluded && cell.value !== null
    const selected = ui.selected?.row === cell.row && ui.selected.col === cell.col
    const state = cell.excluded ? 'excluded' : measured && h !== undefined ? layerClass(h) : 'empty'
    const group = svg('g', {
      class: `cell ${state}${selected ? ' sel' : ''}`,
      transform: `translate(${cell.col * CELL} ${cell.row * CELL})`,
      role: 'button',
      tabindex: 0,
      'aria-label': `Zeile ${cell.row + 1}, Spalte ${cell.col + 1}: ${
        cell.excluded ? 'gehört nicht zum Raum' : measured ? formatReading(cell.value ?? 0, unit) : 'leer'}`,
    })
    group.append(svg('rect', { x: 2, y: 2, width: CELL - 4, height: CELL - 4, rx: 10 }))

    if (measured && cell.value !== null) {
      // Mit Laserhöhe steht die Differenz in der Zelle, sonst der abgelesene Wert.
      const diff = result.diffCells.get(key)
      const raw = diff !== undefined
        ? formatDiff(diff)
        : formatNum(unit === 'cm' ? cell.value / 10 : cell.value, unit === 'cm' ? 2 : 1)
      const hText = h === undefined ? '' : formatNum(h)
      if (ui.show === 'both') {
        group.append(
          svg('text', { x: CELL / 2, y: 46, class: 'v-main' }, raw),
          svg('text', { x: CELL / 2, y: 80, class: 'v-sub' }, `h ${hText}`))
      } else {
        group.append(svg('text', { x: CELL / 2, y: CELL / 2 + 12, class: 'v-main' }, ui.show === 'h' ? hText : raw))
      }
    }

    // Antippen wählt, langes Drücken (oder Rechtsklick) nimmt die Zelle aus dem Raum.
    let timer = 0
    let lastToggle = -Infinity
    const cancel = () => window.clearTimeout(timer)
    const toggle = () => {
      // Sonst feuert der Timer nach einem Rechtsklick ein zweites Mal, weil
      // das Neuzeichnen das pointerup-Ziel entfernt hat.
      cancel()
      lastToggle = Date.now()
      onToggleExclude({ row: cell.row, col: cell.col })
    }
    group.addEventListener('pointerdown', () => {
      cancel()
      timer = window.setTimeout(toggle, LONG_PRESS_MS)
    })
    for (const type of ['pointerup', 'pointerleave', 'pointercancel']) group.addEventListener(type, cancel)
    group.addEventListener('click', () => {
      if (Date.now() - lastToggle < 800) return
      onSelect({ row: cell.row, col: cell.col })
    })
    group.addEventListener('contextmenu', (event) => {
      event.preventDefault()
      if (Date.now() - lastToggle > 800) toggle()
    })
    group.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault()
        onSelect({ row: cell.row, col: cell.col })
      }
    })
    root.append(group)
  }

  // Himmelsrichtungen: Zeile 0 liegt an der Nordwand.
  const compass = /** @type {Array<[string, number, number]>} */ ([
    ['N', width / 2, -MARGIN / 2 + 8],
    ['S', width / 2, height + MARGIN / 2 + 8],
    ['W', -MARGIN / 2, height / 2 + 8],
    ['O', width + MARGIN / 2, height / 2 + 8],
  ])
  for (const [letter, x, y] of compass) root.append(svg('text', { x, y, class: 'compass' }, letter))
  return root
}
