import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { evaluateCapabilities } from '../js/export/capabilities.js'

/** @type {import('../js/export/capabilities.js').CapabilityProbe} */
const base = {
  hasVideoEncoder: false,
  isCrossOriginIsolated: false,
  hasOffscreenCanvas: false,
  hasFileSystemAccess: false,
}

describe('evaluateCapabilities', () => {
  it('nimmt WebCodecs, sobald es da ist', () => {
    assert.equal(evaluateCapabilities({ ...base, hasVideoEncoder: true }).path, 'webcodecs')
  })

  it('bevorzugt WebCodecs auch ohne Cross-Origin-Isolation', () => {
    // Genau der Fall auf GitHub Pages: keine COOP/COEP-Header, aber WebCodecs.
    const report = evaluateCapabilities({
      ...base,
      hasVideoEncoder: true,
      isCrossOriginIsolated: false,
    })
    assert.equal(report.path, 'webcodecs')
  })

  it('fällt ohne WebCodecs auf mehrkerniges ffmpeg zurück, wenn isoliert', () => {
    const report = evaluateCapabilities({ ...base, isCrossOriginIsolated: true })
    assert.equal(report.path, 'ffmpeg-wasm-mt')
  })

  it('bleibt im langsamen Pfad, wenn nichts davon verfügbar ist', () => {
    const report = evaluateCapabilities(base)
    assert.equal(report.path, 'ffmpeg-wasm-st')
    assert.match(report.note, /PNG-Sequenz/)
  })

  it('bietet die PNG-Sequenz immer an', () => {
    for (const hasVideoEncoder of [false, true]) {
      for (const isCrossOriginIsolated of [false, true]) {
        const report = evaluateCapabilities({ ...base, hasVideoEncoder, isCrossOriginIsolated })
        assert.ok(report.alphaPaths.includes('png-sequence'))
      }
    }
  })

  it('bietet ProRes nur bei Cross-Origin-Isolation an', () => {
    assert.ok(!evaluateCapabilities(base).alphaPaths.includes('prores'))
    const isolated = evaluateCapabilities({ ...base, isCrossOriginIsolated: true })
    assert.ok(isolated.alphaPaths.includes('prores'))
  })

  it('bietet WebM mit Alpha nur mit WebCodecs an', () => {
    assert.ok(!evaluateCapabilities(base).alphaPaths.includes('webm-alpha'))
    const withCodecs = evaluateCapabilities({ ...base, hasVideoEncoder: true })
    assert.ok(withCodecs.alphaPaths.includes('webm-alpha'))
  })

  it('meldet Datei-Streaming nur, wenn der Picker existiert', () => {
    assert.equal(evaluateCapabilities(base).canStreamToDisk, false)
    const withPicker = evaluateCapabilities({ ...base, hasFileSystemAccess: true })
    assert.equal(withPicker.canStreamToDisk, true)
  })
})
