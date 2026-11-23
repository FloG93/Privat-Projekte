import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { addSetup } from '../js/calc.js'
import { createProject, createRoom, emptyState } from '../js/model.js'
import { STORAGE_KEY, exportProject, loadState, migrate, parseImport, saveState } from '../js/store.js'

/** Einfacher Speicher im Arbeitsspeicher. */
function fakeStorage() {
  /** @type {Map<string, string>} */
  const data = new Map()
  return {
    data,
    getItem: (/** @type {string} */ k) => data.get(k) ?? null,
    setItem: (/** @type {string} */ k, /** @type {string} */ v) => { data.set(k, v) },
    removeItem: (/** @type {string} */ k) => { data.delete(k) },
  }
}

/** Projekt mit einem Raum, Wert und zweitem Standort. */
function sampleProject() {
  const project = createProject('Haus Müller')
  const room = createRoom('Wohnzimmer', 4, 3, 1)
  const cell = room.grid.cells[0]
  if (!cell) throw new Error('Zelle fehlt')
  cell.value = 12.5
  cell.setupId = project.activeSetupId
  room.freePoints.push({ id: 'p1', label: 'Tür', value: 9, setupId: project.activeSetupId })
  project.rooms.push(room)
  addSetup(project, 'Tür', 20, 8)
  return project
}

describe('loadState / saveState', () => {
  it('Rundlauf: gespeichert = geladen', () => {
    const storage = fakeStorage()
    const state = emptyState()
    const project = sampleProject()
    state.projects[0] = project
    state.activeProjectId = project.id
    assert.equal(saveState(state, storage), true)
    const loaded = loadState(storage)
    assert.equal(loaded.persistent, true)
    assert.deepEqual(loaded.state, state)
  })

  it('ohne Speicher: leerer Zustand, nicht persistent', () => {
    const loaded = loadState(null)
    assert.equal(loaded.persistent, false)
    assert.equal(loaded.state.projects.length, 1)
  })

  it('leerer Speicher ist in Ordnung und persistent', () => {
    assert.equal(loadState(fakeStorage()).persistent, true)
  })

  it('Speichern bei voller Quota wirft nicht, sondern meldet false', () => {
    const storage = { ...fakeStorage(), setItem: () => { throw new Error('QuotaExceededError') } }
    assert.equal(saveState(emptyState(), storage), false)
    assert.equal(saveState(emptyState(), null), false)
  })

  it('kaputtes JSON: leerer Zustand, alter Text bleibt gesichert', () => {
    const storage = fakeStorage()
    storage.setItem(STORAGE_KEY, '{kaputt')
    const loaded = loadState(storage)
    assert.equal(loaded.state.projects.length, 1)
    assert.equal(storage.getItem(`${STORAGE_KEY}.broken`), '{kaputt')
  })

  it('gültiges JSON mit falscher Form wird wie kaputt behandelt', () => {
    const storage = fakeStorage()
    storage.setItem(STORAGE_KEY, '{"version":1,"projects":"nein"}')
    const loaded = loadState(storage)
    assert.equal(loaded.state.projects.length, 1)
    assert.equal(storage.getItem(`${STORAGE_KEY}.broken`), '{"version":1,"projects":"nein"}')
  })
})

describe('migrate', () => {
  it('reicht Version 1 durch und lehnt neuere ab', () => {
    const state = emptyState()
    assert.deepEqual(migrate(JSON.parse(JSON.stringify(state))), state)
    assert.throws(() => migrate({ version: 2, projects: [] }), /neueren Version/)
  })
})

describe('Export und Import', () => {
  it('Dateiname aus Projektname und Datum', () => {
    const { filename } = exportProject(createProject('Haus Müller'), new Date(2026, 10, 23))
    assert.equal(filename, 'bodennivel-haus-mueller-2026-11-23.json')
  })

  it('Rundlauf Export → Import ergibt dasselbe Projekt', () => {
    const project = sampleProject()
    assert.deepEqual(parseImport(exportProject(project).json), project)
  })

  it('fehlende Einstellungen werden mit Standardwerten aufgefüllt', () => {
    const project = sampleProject()
    const file = JSON.parse(exportProject(project).json)
    delete file.project.settings.gridSize
    assert.equal(parseImport(JSON.stringify(file)).settings.gridSize, 1)
  })

  it('lehnt Unsinn mit deutscher Meldung ab', () => {
    assert.throws(() => parseImport('quatsch'), /keine gültige JSON-Datei/)
    assert.throws(() => parseImport('{"app":"anders","version":1}'), /nicht von BodenNivel/)
    assert.throws(() => parseImport('{"app":"bodennivel","version":2}'), /neueren Version/)
    assert.throws(() => parseImport('{"app":"bodennivel","version":1,"project":{"name":"x"}}'), /fehlt/)
  })

  it('lehnt unbekannte Felder ab statt sie still zu verwerfen', () => {
    const file = JSON.parse(exportProject(sampleProject()).json)
    file.project.geheim = 1
    assert.throws(() => parseImport(JSON.stringify(file)), /unbekannte/i)
  })

  it('lehnt Messwerte mit falschem Typ ab', () => {
    const file = JSON.parse(exportProject(sampleProject()).json)
    file.project.rooms[0].grid.cells[0].value = 'zwölf'
    assert.throws(() => parseImport(JSON.stringify(file)), /Messwert/)
  })
})

describe('Laserhöhe und Einheit im Speicher', () => {
  it('ältere Daten ohne die neuen Felder werden mit Standardwerten ergänzt', () => {
    const file = JSON.parse(exportProject(sampleProject()).json)
    delete file.project.settings.laserHeight
    delete file.project.settings.inputUnit
    const project = parseImport(JSON.stringify(file))
    assert.equal(project.settings.laserHeight, 0)
    assert.equal(project.settings.inputUnit, 'mm')
  })

  it('Rundlauf mit Laserhöhe in cm', () => {
    const project = sampleProject()
    project.settings.laserHeight = 300
    project.settings.inputUnit = 'cm'
    assert.deepEqual(parseImport(exportProject(project).json), project)
  })

  it('lehnt eine unbekannte Einheit ab', () => {
    const file = JSON.parse(exportProject(sampleProject()).json)
    file.project.settings.inputUnit = 'zoll'
    assert.throws(() => parseImport(JSON.stringify(file)), /inputUnit/)
  })
})
