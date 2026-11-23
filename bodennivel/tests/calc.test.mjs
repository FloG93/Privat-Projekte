import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  addSetup, computeProject, corrected, formatMark, layerClass, recomputeOffsets, removeSetup, setupInUse, setupOffset, updateSetupRef,
} from '../js/calc.js'
import { createProject, createRoom, newId } from '../js/model.js'

/**
 * Raum mit Raster `cols`×`rows` (je 1 m) und Messwerten zeilenweise.
 * `null` lässt die Zelle leer.
 * @param {string} name
 * @param {number} cols
 * @param {number} rows
 * @param {Array<number | null>} values
 * @param {string | null} [setupId]
 */
function roomWith(name, cols, rows, values, setupId = null) {
  const room = createRoom(name, cols, rows, 1)
  room.grid.cells.forEach((cell, i) => {
    cell.value = values[i] ?? null
    cell.setupId = cell.value === null ? null : setupId
  })
  return room
}

/**
 * Projekt mit den Räumen.
 * @param {boolean} connected
 * @param {...import('../js/model.js').Room} rooms
 */
function projectWith(connected, ...rooms) {
  const project = createProject('Test')
  project.connected = connected
  project.rooms.push(...rooms)
  return project
}

/** @param {ReturnType<typeof computeProject>} summary @param {number} i */
function res(summary, i) {
  const r = summary.rooms[i]
  if (!r) throw new Error('Raumergebnis fehlt')
  return r
}

describe('Raumergebnis', () => {
  it('rechnet das Beispiel aus dem Entwurf', () => {
    const room = roomWith('A', 2, 2, [10, 12, 14, 20])
    const r = res(computeProject(projectWith(false, room)), 0)
    assert.equal(r.dMin, 10)
    assert.equal(r.dSoll, 7)
    assert.equal(r.hCells.get('0,0'), 3)
    assert.equal(r.hCells.get('0,1'), 5)
    assert.equal(r.hCells.get('1,0'), 7)
    assert.equal(r.hCells.get('1,1'), 13)
    assert.equal(r.hMean, 7)
    assert.equal(r.hMax, 13)
    assert.equal(r.area, 4)
    assert.ok(Math.abs(r.massKg - 47.04) < 1e-9)
    assert.equal(r.bags, 3)
    assert.ok(Math.abs(r.waterL - 13.8) < 1e-9)
    assert.equal(r.status, 'complete')
    assert.equal(r.basis, 'grid')
  })

  it('Raum ohne Werte: leer, keine Mengen', () => {
    const r = res(computeProject(projectWith(false, roomWith('A', 2, 1, []))), 0)
    assert.equal(r.status, 'empty')
    assert.equal(r.massKg, 0)
    assert.equal(r.bags, 0)
    assert.equal(r.hMean, null)
  })

  it('unvollständiges Raster: vorläufig, mit Warnung', () => {
    const summary = computeProject(projectWith(false, roomWith('Bad', 2, 2, [10, 12, null, null])))
    assert.equal(res(summary, 0).status, 'partial')
    assert.ok(summary.warnings.includes('Bad: vorläufig – 2 von 4 Punkten'))
  })

  it('ausgeschlossene und leere Zellen verfälschen dMin nicht', () => {
    const room = roomWith('A', 3, 1, [10, 1, null])
    const cell = room.grid.cells[1]
    if (!cell) throw new Error('Zelle fehlt')
    cell.excluded = true
    const r = res(computeProject(projectWith(false, room)), 0)
    assert.equal(r.dMin, 10)
    assert.equal(r.hCells.has('0,1'), false)
  })

  it('Grenzwert überschritten: overMax und Warnung', () => {
    const summary = computeProject(projectWith(false, roomWith('Wohnen', 2, 1, [5, 33])))
    const r = res(summary, 0)
    assert.equal(r.hMax, 31)
    assert.equal(r.overMax, true)
    assert.ok(summary.warnings.includes('Wohnen: max. 31 mm über Grenzwert 30 mm'))
  })

  it('fehlende Fläche bei vorhandenen Werten wird gemeldet', () => {
    const room = createRoom('WC', null, null, 1)
    room.freePoints.push({ id: newId(), label: 'Mitte', value: 10, setupId: 'x' })
    const summary = computeProject(projectWith(false, room))
    assert.ok(summary.warnings.includes('WC: Fläche fehlt'))
  })
})

describe('Freie Punkte', () => {
  it('zählen für dMin und hMax, nicht für den Mittelwert', () => {
    const room = roomWith('A', 2, 1, [10, 12])
    room.freePoints.push({ id: 'p1', label: 'Tür', value: 4, setupId: 'x' })
    const r = res(computeProject(projectWith(false, room)), 0)
    assert.equal(r.dMin, 4)
    assert.equal(r.dSoll, 1)
    assert.equal(r.hMean, 10)
    assert.equal(r.hMax, 11)
    assert.equal(r.hPoints.get('p1'), 3)
  })

  it('Raum ohne Raster rechnet mit dem Mittel der freien Punkte', () => {
    const room = createRoom('WC', null, null, 1)
    room.areaOverride = 2
    room.freePoints.push(
      { id: 'a', label: 'P1', value: 10, setupId: 'x' },
      { id: 'b', label: 'P2', value: 16, setupId: 'x' },
    )
    const r = res(computeProject(projectWith(false, room)), 0)
    assert.equal(r.basis, 'free')
    assert.equal(r.hMean, 6)
    assert.equal(r.status, 'complete')
  })
})

describe('Bezugsgruppen', () => {
  it('verbundene Räume teilen sich dMin', () => {
    const summary = computeProject(projectWith(true, roomWith('A', 2, 1, [10, 12]), roomWith('B', 2, 1, [5, 30])))
    assert.equal(res(summary, 0).dMin, 5)
    assert.equal(res(summary, 1).dSoll, 2)
    assert.equal(res(summary, 0).hCells.get('0,0'), 8)
    assert.equal(res(summary, 0).hCells.get('0,1'), 10)
  })

  it('ohne Verbund hat jeder Raum seinen eigenen Bezug', () => {
    const summary = computeProject(projectWith(false, roomWith('A', 2, 1, [10, 12]), roomWith('B', 2, 1, [5, 30])))
    assert.equal(res(summary, 0).dMin, 10)
  })

  it('Raum außerhalb des Verbunds bleibt für sich', () => {
    const b = roomWith('B', 2, 1, [5, 30])
    b.inGroup = false
    const summary = computeProject(projectWith(true, roomWith('A', 2, 1, [10, 12]), b))
    assert.equal(res(summary, 0).dMin, 10)
    assert.equal(res(summary, 1).dMin, 5)
  })
})

describe('Laser-Standorte', () => {
  it('addSetup berechnet den Versatz und wird aktiv', () => {
    const p = createProject('Test')
    const s2 = addSetup(p, 'Tür', 20, 8)
    assert.equal(s2.name, 'S2')
    assert.equal(s2.offset, -12)
    assert.equal(p.activeSetupId, s2.id)
    assert.equal(setupOffset(p, s2.id), -12)
    assert.equal(setupOffset(p, null), 0)
    assert.equal(setupOffset(p, 'unbekannt'), 0)
  })

  it('korrigiert Rohwerte auf die Linie von S1', () => {
    const p = createProject('Test')
    const s2 = addSetup(p, 'Tür', 20, 8)
    assert.equal(corrected(p, 15, s2.id), 27)
  })

  it('zeigt das Anzeichen-Maß je Standort', () => {
    const p = createProject('Test')
    const s2 = addSetup(p, 'Tür', 20, 8)
    p.rooms.push(roomWith('A', 1, 1, [15], s2.id))
    const r = res(computeProject(p), 0)
    assert.equal(r.dMin, 27)
    assert.equal(r.dSoll, 24)
    assert.deepEqual(r.marks.map((m) => [m.name, m.dSoll]), [['S1', 24], ['S2', 12]])
  })

  it('formatMark zeigt negative Maße als „über der Linie“', () => {
    assert.equal(formatMark(72), '72 mm unter der Linie')
    assert.equal(formatMark(-5), '5 mm über der Linie')
  })
})

describe('Gesamtergebnis', () => {
  it('Säcke gesamt aus der Summe, daneben die Summe der Raum-Säcke', () => {
    const p = projectWith(false, roomWith('A', 2, 2, [10, 12, 14, 20]), roomWith('B', 1, 1, [20]))
    Object.assign(p.settings, { consumption: 1, reservePct: 0 })
    const b = p.rooms[1]
    if (!b) throw new Error('Raum fehlt')
    b.areaOverride = 4
    const s = computeProject(p)
    assert.equal(res(s, 0).massKg, 28)
    assert.equal(res(s, 1).massKg, 12)
    assert.equal(s.massKg, 40)
    assert.equal(s.bagsTotal, 2)
    assert.equal(s.bagsSumRooms, 3)
    assert.ok(Math.abs(s.waterL - 2 * 4.6) < 1e-9)
  })

  it('Paletten und Rest', () => {
    const p = projectWith(false, roomWith('A', 1, 1, [20]))
    Object.assign(p.settings, { consumption: 1, reservePct: 0, bagKg: 1, minLayer: 1 })
    const a = p.rooms[0]
    if (!a) throw new Error('Raum fehlt')
    a.areaOverride = 100
    const s = computeProject(p)
    assert.equal(s.bagsTotal, 100)
    assert.equal(s.pallets, 3)
    assert.equal(s.palletFull, 2)
    assert.equal(s.palletRest, 4)
  })

  it('Schichtdicke flächengewichtet', () => {
    const s = computeProject(projectWith(true, roomWith('A', 2, 2, [10, 12, 14, 20]), roomWith('B', 1, 1, [24])))
    assert.equal(s.hMeanWeighted, 9)
  })

  it('ohne Messwerte keine Schichtdicke', () => {
    const s = computeProject(projectWith(false, roomWith('A', 2, 1, [])))
    assert.equal(s.hMeanWeighted, null)
    assert.equal(s.bagsTotal, 0)
  })
})

describe('layerClass', () => {
  it('Farbstufen mit Grenzen 10 und 25 mm', () => {
    assert.equal(layerClass(10), 'ok')
    assert.equal(layerClass(10.5), 'mid')
    assert.equal(layerClass(25), 'mid')
    assert.equal(layerClass(25.5), 'high')
  })
})

describe('Standorte nachträglich ändern', () => {
  it('recomputeOffsets: Kette S2 −12, S3 +5 ergibt S3 −7; S2 auf −10 → S3 −5', () => {
    const p = createProject('Test')
    const s2 = addSetup(p, 'Tür', 20, 8)
    const s3 = addSetup(p, 'Fenster', 10, 15)
    assert.equal(s3.offset, -7)
    if (!s2.ref) throw new Error('ref fehlt')
    s2.ref.after = 10
    recomputeOffsets(p)
    assert.equal(s2.offset, -10)
    assert.equal(s3.offset, -5)
  })

  it('der Bezugs-Standort bleibt erhalten, auch wenn der Laser zu S1 zurückgestellt wurde', () => {
    const p = createProject('Test')
    addSetup(p, 'Tür', 20, 8)
    const first = p.setups[0]
    if (!first) throw new Error('S1 fehlt')
    p.activeSetupId = first.id
    const s3 = addSetup(p, 'Flur', 30, 33)
    assert.equal(s3.offset, 3)
    recomputeOffsets(p)
    assert.equal(s3.offset, 3)
  })

  it('updateSetupRef ändert Werte und rechnet Folgestandorte nach', () => {
    const p = createProject('Test')
    const s2 = addSetup(p, 'Tür', 20, 8)
    const s3 = addSetup(p, 'Fenster', 10, 15)
    updateSetupRef(p, s2.id, 'Haustür', 20, 10)
    assert.equal(s2.ref?.label, 'Haustür')
    assert.equal(s2.offset, -10)
    assert.equal(s3.offset, -5)
  })

  it('setupInUse: Zelle, freier Punkt oder Folgestandort halten ihn fest', () => {
    const p = createProject('Test')
    const s2 = addSetup(p, 'Tür', 20, 8)
    assert.equal(setupInUse(p, s2.id), false)
    const s3 = addSetup(p, 'Fenster', 10, 15)
    assert.equal(setupInUse(p, s2.id), true)
    const room = roomWith('A', 1, 1, [12], s3.id)
    p.rooms.push(room)
    assert.equal(setupInUse(p, s3.id), true)
    const cell = room.grid.cells[0]
    if (!cell) throw new Error('Zelle fehlt')
    cell.value = null
    room.freePoints.push({ id: 'x', label: 'Tür', value: 9, setupId: s3.id })
    assert.equal(setupInUse(p, s3.id), true)
  })

  it('removeSetup löscht nur freie Standorte und nie S1', () => {
    const p = createProject('Test')
    const s1 = p.setups[0]
    if (!s1) throw new Error('S1 fehlt')
    const s2 = addSetup(p, 'Tür', 20, 8)
    assert.equal(removeSetup(p, s1.id), false)
    assert.equal(removeSetup(p, s2.id), true)
    assert.equal(p.setups.length, 1)
    assert.equal(p.activeSetupId, s1.id)
    const s3 = addSetup(p, 'Fenster', 10, 15)
    p.rooms.push(roomWith('A', 1, 1, [12], s3.id))
    assert.equal(removeSetup(p, s3.id), false)
  })
})
