import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { DEFAULT_STYLE_ID, MAP_STYLES, getStyle } from '../js/map/styles.js'

describe('Kartenstil-Registry', () => {
  it('hat eindeutige Kennungen', () => {
    const ids = MAP_STYLES.map((style) => style.id)
    assert.equal(new Set(ids).size, ids.length)
  })

  it('liefert jeden Stil über getStyle', () => {
    for (const style of MAP_STYLES) {
      assert.equal(getStyle(style.id), style)
    }
  })

  it('wirft bei unbekannter Kennung, statt still etwas Falsches zu laden', () => {
    assert.throws(() => getStyle('gibt-es-nicht'), /Unbekannter Kartenstil/)
  })

  it('der Standardstil existiert und braucht keinen Key', () => {
    assert.equal(getStyle(DEFAULT_STYLE_ID).needsKey, false)
  })

  it('jeder keylose Stil hat eine absolute https-URL ohne Platzhalter', () => {
    for (const style of MAP_STYLES.filter((candidate) => !candidate.needsKey)) {
      assert.match(style.url, /^https:\/\//)
      assert.doesNotMatch(style.url, /\{.*\}/)
    }
  })
})
