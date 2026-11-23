import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { formatKg, formatL, formatM2, formatMm, formatNum, formatPallets, formatDiff, formatReading, parseMeasurement, parseNum, parseReading } from '../js/format.js'

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

describe('formatPallets', () => {
  it('Aufteilung in volle Paletten und lose Säcke', () => {
    assert.equal(formatPallets(2, 7), '2 Paletten + 7 Säcke')
    assert.equal(formatPallets(1, 1), '1 Palette + 1 Sack')
    assert.equal(formatPallets(3, 0), '3 Paletten')
    assert.equal(formatPallets(0, 12), '12 Säcke (keine volle Palette)')
    assert.equal(formatPallets(0, 0), '–')
  })
})

describe('parseReading', () => {
  it('liest Millimeter wie parseMeasurement', () => {
    assert.equal(parseReading('304', 'mm'), 304)
    assert.equal(parseReading('7,25', 'mm'), 7.3)
  })
  it('rechnet Zentimeter in Millimeter um', () => {
    assert.equal(parseReading('30,4', 'cm'), 304)
    assert.equal(parseReading('30.4', 'cm'), 304)
    assert.equal(parseReading('30,45', 'cm'), 304.5)
    assert.equal(parseReading('0,8', 'cm'), 8)
  })
  it('lehnt Unsinn und Werte über 2 m ab – „304“ in cm sind 3 m', () => {
    assert.equal(parseReading('304', 'cm'), null)
    assert.equal(parseReading('', 'cm'), null)
    assert.equal(parseReading('abc', 'cm'), null)
    assert.equal(parseReading('-1', 'cm'), null)
  })
})

describe('formatReading / formatDiff', () => {
  it('zeigt den Wert in der gewählten Einheit', () => {
    assert.equal(formatReading(304, 'cm'), '30,4 cm')
    assert.equal(formatReading(304, 'mm'), '304 mm')
    assert.equal(formatReading(304.5, 'cm'), '30,45 cm')
  })
  it('Differenz mit Vorzeichen', () => {
    assert.equal(formatDiff(4), '+4')
    assert.equal(formatDiff(-2.5), '-2,5')
    assert.equal(formatDiff(0), '0')
  })
})
