/**
 * Raster einer Raumfläche: Zellen, Messreihenfolge und Fläche.
 * Zeile 0 liegt an der Nordwand, Spalte 0 an der Westwand. Kein DOM-Zugriff.
 */

/** @typedef {import('./model.js').Cell} Cell */
/** @typedef {import('./model.js').Room} Room */
/** @typedef {import('./model.js').Corner} Corner */
/** @typedef {{ row: number, col: number }} CellPos */

/**
 * Zellenzahl je Richtung; ohne Maße 0 × 0 (Raum ohne Raster).
 * @param {number | null} length Ost-West in m
 * @param {number | null} width Nord-Süd in m
 * @param {number} gridSize Rastermaß in m
 * @returns {{ cols: number, rows: number }}
 */
export function gridDims(length, width, gridSize) {
  if (!length || !width || length <= 0 || width <= 0 || gridSize <= 0) return { cols: 0, rows: 0 }
  return {
    cols: Math.max(1, Math.round(length / gridSize)),
    rows: Math.max(1, Math.round(width / gridSize)),
  }
}

/**
 * Baut die Zellen zeilenweise neu. Werte und Ausschluss alter Zellen gleicher
 * Position bleiben erhalten, alles außerhalb des neuen Rasters entfällt.
 * @param {number} cols
 * @param {number} rows
 * @param {Cell[]} [old]
 * @returns {Cell[]}
 */
export function buildCells(cols, rows, old = []) {
  /** @type {Map<string, Cell>} */
  const previous = new Map(old.map((cell) => [`${cell.row},${cell.col}`, cell]))
  /** @type {Cell[]} */
  const cells = []
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const kept = previous.get(`${row},${col}`)
      cells.push(kept
        ? { ...kept }
        : { row, col, excluded: false, value: null, setupId: null })
    }
  }
  return cells
}

/**
 * Abstand des ersten Messpunkts von der Wand und Abstand der Punkte.
 * @param {number} length Länge in m
 * @param {number} cols
 * @returns {{ first: number, step: number }}
 */
export function spacing(length, cols) {
  const step = length / cols
  return { first: step / 2, step }
}

/**
 * Schlangenlinie ab der gewählten Startecke.
 * @param {number} cols
 * @param {number} rows
 * @param {Corner} start
 * @returns {CellPos[]}
 */
export function snakeOrder(cols, rows, start) {
  const fromBottom = start === 'SW' || start === 'SE'
  const firstLeftToRight = start === 'NW' || start === 'SW'
  /** @type {CellPos[]} */
  const order = []
  for (let step = 0; step < rows; step++) {
    const row = fromBottom ? rows - 1 - step : step
    const leftToRight = step % 2 === 0 ? firstLeftToRight : !firstLeftToRight
    for (let i = 0; i < cols; i++) {
      order.push({ row, col: leftToRight ? i : cols - 1 - i })
    }
  }
  return order
}

/**
 * @param {Room} room
 * @param {CellPos} pos
 * @returns {Cell | undefined}
 */
function cellAt(room, pos) {
  return room.grid.cells.find((cell) => cell.row === pos.row && cell.col === pos.col)
}

/**
 * Nächste noch nicht gemessene, nicht ausgeschlossene Zelle nach `from`,
 * einmal rund herum. Bei `null` ab dem Anfang. `null`, wenn nichts mehr fehlt.
 * @param {Room} room
 * @param {CellPos | null} from
 * @returns {CellPos | null}
 */
export function nextCell(room, from) {
  const order = snakeOrder(room.grid.cols, room.grid.rows, room.startCorner)
  const start = from ? order.findIndex((p) => p.row === from.row && p.col === from.col) : -1
  for (let i = 1; i <= order.length; i++) {
    const pos = order[(start + i) % order.length]
    if (!pos) continue
    const cell = cellAt(room, pos)
    if (cell && !cell.excluded && cell.value === null) return pos
  }
  return null
}

/**
 * Vorige nicht ausgeschlossene Zelle in der Reihenfolge, gemessen oder nicht.
 * @param {Room} room
 * @param {CellPos} from
 * @returns {CellPos | null}
 */
export function prevCell(room, from) {
  const order = snakeOrder(room.grid.cols, room.grid.rows, room.startCorner)
  const index = order.findIndex((p) => p.row === from.row && p.col === from.col)
  for (let i = index - 1; i >= 0; i--) {
    const pos = order[i]
    const cell = pos && cellAt(room, pos)
    if (pos && cell && !cell.excluded) return pos
  }
  return null
}

/**
 * @param {Room} room
 * @returns {{ measured: number, total: number }}
 */
export function gridProgress(room) {
  const active = room.grid.cells.filter((cell) => !cell.excluded)
  return { measured: active.filter((cell) => cell.value !== null).length, total: active.length }
}

/**
 * Fläche in m²: manuell gesetzt, sonst Länge × Breite ohne ausgeschlossene
 * Zellen. Ohne Maße 0.
 * @param {Room} room
 * @returns {number}
 */
export function roomArea(room) {
  if (room.areaOverride !== null) return room.areaOverride
  const { length, width, grid } = room
  if (!length || !width || grid.cols === 0 || grid.rows === 0) return 0
  const excluded = grid.cells.filter((cell) => cell.excluded).length
  return length * width - excluded * (length / grid.cols) * (width / grid.rows)
}
