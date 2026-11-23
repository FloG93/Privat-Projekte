import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { buildCells, gridDims, gridProgress, nextCell, prevCell, roomArea, snakeOrder, spacing } from '../js/grid.js'
import { createRoom } from '../js/model.js'

/**
 * Raum 4×3 m mit 4×3 Raster; Werte optional als Objekt "row,col" → mm.
 * @param {Record<string, number>} [values]
 * @param {string[]} [excluded]
 */
function room(values = {}, excluded = []) {
  const r = createRoom('Test', 4, 3, 1)
  for (const cell of r.grid.cells) {
    const key = `${cell.row},${cell.col}`
    cell.value = values[key] ?? null
    if (excluded.includes(key)) cell.excluded = true
  }
  return r
}

describe('gridDims', () => {
  it('rundet auf ganze Zellen, mindestens 1', () => {
    assert.deepEqual(gridDims(4.2, 3.1, 1), { cols: 4, rows: 3 })
    assert.deepEqual(gridDims(0.4, 0.4, 1), { cols: 1, rows: 1 })
  })
  it('liefert 0×0 ohne Maße', () => {
    assert.deepEqual(gridDims(null, null, 1), { cols: 0, rows: 0 })
  })
})

describe('spacing', () => {
  it('erster Punkt eine halbe Zelle von der Wand', () => {
    assert.deepEqual(spacing(4.2, 4), { first: 0.525, step: 1.05 })
  })
})

describe('snakeOrder', () => {
  it('NW: Zeile 0 nach rechts, dann zurück', () => {
    assert.deepEqual(snakeOrder(3, 2, 'NW'), [
      { row: 0, col: 0 }, { row: 0, col: 1 }, { row: 0, col: 2 },
      { row: 1, col: 2 }, { row: 1, col: 1 }, { row: 1, col: 0 },
    ])
  })
  it('SE: unten rechts beginnend nach links, dann nach oben', () => {
    assert.deepEqual(snakeOrder(3, 2, 'SE'), [
      { row: 1, col: 2 }, { row: 1, col: 1 }, { row: 1, col: 0 },
      { row: 0, col: 0 }, { row: 0, col: 1 }, { row: 0, col: 2 },
    ])
  })
  it('NE und SW', () => {
    assert.deepEqual(snakeOrder(2, 2, 'NE'), [
      { row: 0, col: 1 }, { row: 0, col: 0 }, { row: 1, col: 0 }, { row: 1, col: 1 },
    ])
    assert.deepEqual(snakeOrder(2, 2, 'SW'), [
      { row: 1, col: 0 }, { row: 1, col: 1 }, { row: 0, col: 1 }, { row: 0, col: 0 },
    ])
  })
})

describe('buildCells', () => {
  it('übernimmt Werte gleicher Position, verwirft den Rest', () => {
    const old = buildCells(3, 3)
    const mid = old.find((c) => c.row === 1 && c.col === 1)
    const corner = old.find((c) => c.row === 2 && c.col === 2)
    if (!mid || !corner) throw new Error('Zelle fehlt')
    mid.value = 14
    mid.setupId = 's'
    mid.excluded = true
    corner.value = 9
    const next = buildCells(2, 2, old)
    assert.equal(next.length, 4)
    const kept = next.find((c) => c.row === 1 && c.col === 1)
    assert.equal(kept?.value, 14)
    assert.equal(kept?.excluded, true)
    assert.equal(next.some((c) => c.value === 9), false)
  })
})

describe('nextCell / prevCell', () => {
  it('beginnt bei null vorn und überspringt Gemessene und Ausgeschlossene', () => {
    const r = room({ '0,0': 5, '0,1': 6 }, ['0,2'])
    assert.deepEqual(nextCell(r, null), { row: 0, col: 3 })
    assert.deepEqual(nextCell(r, { row: 0, col: 3 }), { row: 1, col: 3 })
  })
  it('läuft einmal herum und liefert null bei vollem Raster', () => {
    const r = room({ '0,0': 5 })
    assert.deepEqual(nextCell(r, { row: 2, col: 3 }), { row: 0, col: 1 })
    /** @type {Record<string, number>} */
    const all = {}
    for (const c of r.grid.cells) all[`${c.row},${c.col}`] = 1
    assert.equal(nextCell(room(all), null), null)
  })
  it('prevCell geht zur vorigen nicht ausgeschlossenen Zelle', () => {
    const r = room({}, ['0,2'])
    assert.deepEqual(prevCell(r, { row: 0, col: 3 }), { row: 0, col: 1 })
    assert.equal(prevCell(r, { row: 0, col: 0 }), null)
  })
})

describe('gridProgress', () => {
  it('zählt ausgeschlossene Zellen nicht', () => {
    const r = room({ '0,0': 5, '0,1': 6 }, ['0,1'])
    assert.deepEqual(gridProgress(r), { measured: 1, total: 11 })
  })
})

describe('roomArea', () => {
  it('Länge × Breite minus ausgeschlossene Zellen', () => {
    assert.equal(roomArea(room()), 12)
    assert.equal(roomArea(room({}, ['0,0'])), 11)
  })
  it('manuelle Fläche gewinnt, ohne Maße 0', () => {
    const r = room()
    r.areaOverride = 9.5
    assert.equal(roomArea(r), 9.5)
    assert.equal(roomArea(createRoom('WC', null, null, 1)), 0)
  })
})
