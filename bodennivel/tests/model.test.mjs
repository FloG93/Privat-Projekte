import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { DEFAULT_SETTINGS, createProject, emptyState, newId } from '../js/model.js'

describe('createProject', () => {
  it('startet mit den Standardwerten als Kopie', () => {
    const project = createProject('Haus A')
    assert.deepEqual(project.settings, DEFAULT_SETTINGS)
    project.settings.bagKg = 25
    assert.equal(DEFAULT_SETTINGS.bagKg, 20)
  })
  it('hat genau einen aktiven Laser-Standort S1 ohne Versatz', () => {
    const project = createProject('Haus A')
    assert.equal(project.setups.length, 1)
    assert.equal(project.setups[0]?.name, 'S1')
    assert.equal(project.setups[0]?.offset, 0)
    assert.equal(project.activeSetupId, project.setups[0]?.id)
    assert.equal(project.connected, true)
  })
})

describe('newId', () => {
  it('liefert verschiedene Kennungen', () => {
    assert.notEqual(newId(), newId())
  })
})

describe('emptyState', () => {
  it('enthält ein aktives Projekt', () => {
    const state = emptyState()
    assert.equal(state.version, 1)
    assert.equal(state.projects.length, 1)
    assert.equal(state.activeProjectId, state.projects[0]?.id)
  })
})
