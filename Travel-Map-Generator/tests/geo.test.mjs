import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  MAX_MERCATOR_LAT,
  clampLat,
  formatDistance,
  formatLonLat,
  haversineMeters,
  normalizeLon,
  pathLengthMeters,
} from '../js/core/geo.js'

const BERLIN = /** @type {[number, number]} */ ([13.405, 52.52])
const DRESDEN = /** @type {[number, number]} */ ([13.7373, 51.0504])

describe('normalizeLon', () => {
  it('lässt Werte im Bereich unverändert', () => {
    assert.equal(normalizeLon(13.405), 13.405)
    assert.equal(normalizeLon(-77), -77)
  })

  it('holt Werte hinter der Datumsgrenze zurück', () => {
    // Beim Scrollen über den Pazifik liefert die Karte Werte wie diese.
    assert.equal(normalizeLon(190), -170)
    assert.equal(normalizeLon(-190), 170)
    assert.equal(normalizeLon(540), 180)
  })

  it('wehrt sich gegen Werte, die keine Zahl sind', () => {
    assert.throws(() => normalizeLon(Number.NaN), /Längengrad/)
  })
})

describe('clampLat', () => {
  it('begrenzt auf das, was Web-Mercator darstellen kann', () => {
    assert.equal(clampLat(90), MAX_MERCATOR_LAT)
    assert.equal(clampLat(-90), -MAX_MERCATOR_LAT)
    assert.equal(clampLat(52.52), 52.52)
  })
})

describe('haversineMeters', () => {
  it('trifft eine bekannte Strecke', () => {
    // Berlin–Dresden sind rund 165 km Luftlinie.
    const meters = haversineMeters(BERLIN, DRESDEN)
    assert.ok(Math.abs(meters - 165_000) < 1000, `${meters} m liegt zu weit daneben`)
  })

  it('ist null für denselben Punkt und symmetrisch', () => {
    assert.equal(haversineMeters(BERLIN, BERLIN), 0)
    assert.ok(Math.abs(haversineMeters(BERLIN, DRESDEN) - haversineMeters(DRESDEN, BERLIN)) < 1e-6)
  })

  it('nimmt über die Datumsgrenze den kurzen Weg', () => {
    // 1° Längengrad am Äquator sind rund 111 km – nicht 359°.
    const meters = haversineMeters([179.5, 0], [-179.5, 0])
    assert.ok(Math.abs(meters - 111_200) < 1500, `${meters} m – offenbar einmal um die Welt`)
  })
})

describe('pathLengthMeters', () => {
  it('ist null für weniger als zwei Punkte', () => {
    assert.equal(pathLengthMeters([]), 0)
    assert.equal(pathLengthMeters([BERLIN]), 0)
  })

  it('summiert die Teilstrecken', () => {
    const over = /** @type {[number, number]} */ ([13.5, 51.8])
    const direct = pathLengthMeters([BERLIN, DRESDEN])
    const viaPoint = pathLengthMeters([BERLIN, over, DRESDEN])
    assert.ok(viaPoint > direct, 'Ein Umweg kann nicht kürzer sein als die Gerade')
  })
})

describe('Formatierung', () => {
  it('schreibt Meter unter einem Kilometer aus', () => {
    assert.equal(formatDistance(840), '840 m')
  })

  it('schreibt Kilometer deutsch, mit Komma', () => {
    assert.equal(formatDistance(4200), '4,2 km')
    assert.equal(formatDistance(165_000), '165 km')
  })

  it('weicht bei Unsinn auf einen Strich aus, statt NaN zu zeigen', () => {
    assert.equal(formatDistance(Number.NaN), '–')
    assert.equal(formatDistance(-1), '–')
  })

  it('nennt Himmelsrichtungen auf Deutsch', () => {
    assert.equal(formatLonLat(BERLIN), '52,5200° N, 13,4050° O')
    assert.equal(formatLonLat([-74.006, -33.8688]), '33,8688° S, 74,0060° W')
  })
})
