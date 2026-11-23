import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { formatKg, formatL, formatM2, formatMm, formatNum, parseMeasurement, parseNum } from '../js/format.js'

describe('parseNum', () => {
  it('liest deutsches Komma und Punkt', () => {
    assert.equal(parseNum('1.234,5'), 1234.5)
    assert.equal(parseNum('12.5'), 12.5)
    assert.equal(parseNum('12,5'), 12.5)
  })
  it('liefert den Ersatzwert bei Unsinn', () => {
    assert.equal(parseNum('abc'), null)
    assert.equal(parseNum('abc', 0), 0)
  })
})

describe('parseMeasurement', () => {
  it('akzeptiert Komma und Punkt', () => {
    assert.equal(parseMeasurement('12,5'), 12.5)
    assert.equal(parseMeasurement('12.5'), 12.5)
    assert.equal(parseMeasurement(' 8 '), 8)
  })
  it('lehnt leere, falsche, negative und absurde Werte ab', () => {
    assert.equal(parseMeasurement(''), null)
    assert.equal(parseMeasurement('abc'), null)
    assert.equal(parseMeasurement('-3'), null)
    assert.equal(parseMeasurement('2500'), null)
  })
  it('rundet auf 0,1 mm', () => {
    assert.equal(parseMeasurement('7,25'), 7.3)
  })
})

describe('Formatierung', () => {
  it('formatNum ohne nachgestellte Nullen', () => {
    assert.equal(formatNum(12), '12')
    assert.equal(formatNum(12.5), '12,5')
  })
  it('formatMm, formatKg, formatL, formatM2', () => {
    assert.equal(formatMm(12.5), '12,5 mm')
    assert.equal(formatKg(47.04), '47 kg')
    assert.equal(formatKg(1250), '1.250 kg (1,25 t)')
    assert.equal(formatL(13.8), '13,8 L')
    assert.equal(formatM2(21.3375), '21,34 m²')
  })
})
