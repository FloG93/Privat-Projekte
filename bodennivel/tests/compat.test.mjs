import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { describe, it } from 'node:test'
import { computeProject } from '../js/calc.js'
import { STORAGE_KEY, loadState, parseImport } from '../js/store.js'

/**
 * Daten im Format der ersten veröffentlichten Version (vor Laserhöhe und
 * Einheit), mit dem damaligen Code erzeugt. Sie müssen sich mit jeder neuen
 * Version laden lassen – ältere Projekte dürfen nie verloren gehen.
 */
const text = await readFile(new URL('./fixtures/state-v1-erste-version.json', import.meta.url), 'utf8')
const old = JSON.parse(text)

describe('Ältere gespeicherte Projekte', () => {
  it('laden unverändert aus dem Speicher, neue Einstellungen kommen mit Standardwerten dazu', () => {
    /** @type {Map<string, string>} */
    const data = new Map([[STORAGE_KEY, text]])
    const storage = {
      getItem: (/** @type {string} */ k) => data.get(k) ?? null,
      setItem: (/** @type {string} */ k, /** @type {string} */ v) => { data.set(k, v) },
    }
    const { state, persistent } = loadState(storage)
    assert.equal(persistent, true)
    assert.equal(data.has(`${STORAGE_KEY}.broken`), false, 'darf nicht als kaputt gelten')
    const project = state.projects[0]
    const original = old.projects[0]
    assert.equal(state.projects.length, 1)
    assert.equal(project?.name, 'Altes Haus')
    assert.deepEqual(project?.rooms, original.rooms)
    assert.deepEqual(project?.setups, original.setups)
    assert.equal(project?.settings.bagKg, 25)
    assert.equal(project?.settings.laserHeight, 0)
    assert.equal(project?.settings.inputUnit, 'mm')
  })

  it('lassen sich weiter berechnen', () => {
    const { state } = loadState({ getItem: () => text, setItem: () => {} })
    const project = state.projects[0]
    if (!project) throw new Error('Projekt fehlt')
    const summary = computeProject(project)
    assert.equal(summary.rooms.length, 3)
    assert.ok(summary.massKg > 0)
  })

  it('der Export einer älteren Version lässt sich importieren', () => {
    const file = JSON.stringify({ app: 'bodennivel', version: 1, project: old.projects[0] })
    assert.equal(parseImport(file).name, 'Altes Haus')
  })
})
