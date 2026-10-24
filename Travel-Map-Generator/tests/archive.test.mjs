import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { describe, it } from 'node:test'
import { addWaypoint, createProject } from '../js/core/model.js'
import {
  PROJECT_ENTRY,
  archiveFileName,
  crc32,
  createZip,
  packProject,
  readZip,
  unpackProject,
} from '../js/storage/archive.js'

const encoder = new TextEncoder()
const decoder = new TextDecoder()

/** @param {string} text */
const bytes = (text) => encoder.encode(text)

function sampleProject() {
  let project = createProject({ title: 'Berlin → Sächsische Schweiz' })
  project = addWaypoint(project, { lon: 13.405, lat: 52.52, name: 'Attilaplatz' })
  project = addWaypoint(project, { lon: 14.0658, lat: 50.9612, name: 'Bastei' })
  return project
}

describe('crc32', () => {
  it('trifft den bekannten Wert für "123456789"', () => {
    // Der Standardtestwert für CRC-32 (IEEE) ist 0xCBF43926.
    assert.equal(crc32(bytes('123456789')), 0xcbf43926)
  })

  it('ist für leere Daten null', () => {
    assert.equal(crc32(new Uint8Array(0)), 0)
  })
})

describe('createZip / readZip', () => {
  it('schreibt etwas, das sich als ZIP erkennen lässt', async () => {
    const archive = await createZip([{ name: 'a.txt', data: bytes('hallo') }])
    assert.equal(archive[0], 0x50, 'ZIP beginnt mit P')
    assert.equal(archive[1], 0x4b, 'ZIP beginnt mit PK')
  })

  it('liest zurück, was es geschrieben hat', async () => {
    const archive = await createZip([
      { name: 'a.txt', data: bytes('hallo') },
      { name: 'ordner/b.json', data: bytes('{"x":1}') },
    ])
    const files = await readZip(archive)
    assert.deepEqual([...files.keys()], ['a.txt', 'ordner/b.json'])
    assert.equal(decoder.decode(files.get('a.txt')), 'hallo')
    assert.equal(decoder.decode(files.get('ordner/b.json')), '{"x":1}')
  })

  it('verträgt Umlaute im Dateinamen und im Inhalt', async () => {
    const archive = await createZip([{ name: 'Sächsische Schweiz.txt', data: bytes('Grüße 🏍') }])
    const files = await readZip(archive)
    assert.equal(decoder.decode(files.get('Sächsische Schweiz.txt')), 'Grüße 🏍')
  })

  it('komprimiert, sobald sich das lohnt', async () => {
    const repetitive = bytes('alle meine entchen '.repeat(200))
    const archive = await createZip([{ name: 'lang.txt', data: repetitive }])
    assert.ok(archive.length < repetitive.length / 2, `Archiv ist ${archive.length} Bytes groß`)
    const files = await readZip(archive)
    assert.equal(files.get('lang.txt')?.length, repetitive.length)
  })

  it('bleibt bei kurzen Daten auch korrekt, wenn Komprimieren nichts bringt', async () => {
    const archive = await createZip([{ name: 'kurz.txt', data: bytes('x') }])
    const files = await readZip(archive)
    assert.equal(decoder.decode(files.get('kurz.txt')), 'x')
  })

  it('merkt, wenn ein Byte gekippt ist', async () => {
    const archive = await createZip([{ name: 'a.txt', data: bytes('alle meine entchen'.repeat(50)) }])
    // Mitten in die Nutzdaten greifen, nicht in die Kopfdaten.
    const broken = archive.slice()
    broken[60] = (broken[60] ?? 0) ^ 0xff
    await assert.rejects(() => readZip(broken), /Prüfsumme|Archiv/)
  })

  it('lehnt ab, was gar kein Archiv ist', async () => {
    await assert.rejects(() => readZip(bytes('Das ist nur Text.')), /keine \.tmgz-Datei/)
  })
})

describe('packProject / unpackProject', () => {
  it('überlebt den Rundlauf unverändert', async () => {
    const project = sampleProject()
    const back = await unpackProject(await packProject(project))
    assert.deepEqual(back, project)
  })

  it('legt das Projekt unter dem vereinbarten Namen ab', async () => {
    const files = await readZip(await packProject(sampleProject()))
    assert.ok(files.has(PROJECT_ENTRY))
  })

  it('liest ein Archiv, das ein fremder Packer geschrieben hat', async () => {
    // Die Datei stammt aus Pythons zipfile – wir müssen auch lesen können, was
    // nicht aus unserem eigenen Schreiber kommt.
    const file = new URL('./fixtures/fremder-packer.tmgz', import.meta.url)
    const project = await unpackProject(new Uint8Array(await readFile(file)))
    assert.equal(project.waypoints.length, 2)
    assert.equal(project.waypoints[0]?.name, 'Berlin')
    assert.equal(project.legs.length, 1)
  })

  it('sagt klar Bescheid, wenn die Projektdatei im Archiv fehlt', async () => {
    const archive = await createZip([{ name: 'etwas-anderes.txt', data: bytes('hallo') }])
    await assert.rejects(() => unpackProject(archive), /fehlt project\.json/)
  })

  it('sagt klar Bescheid, wenn die Projektdatei kaputt ist', async () => {
    const archive = await createZip([{ name: PROJECT_ENTRY, data: bytes('{kein json') }])
    await assert.rejects(() => unpackProject(archive), /kein gültiges JSON/)
  })

  it('reicht die Prüfung des Schemas durch', async () => {
    const archive = await createZip([{ name: PROJECT_ENTRY, data: bytes('{"schemaVersion": 99}') }])
    await assert.rejects(() => unpackProject(archive), /neueren Fassung/)
  })
})

describe('archiveFileName', () => {
  it('macht aus dem Titel einen brauchbaren Dateinamen und behält Umlaute', () => {
    assert.equal(archiveFileName('Berlin → Sächsische Schweiz'), 'Berlin-Sächsische-Schweiz.tmgz')
  })

  it('wirft weg, was Dateisysteme nicht mögen', () => {
    assert.equal(archiveFileName('a/b\\c:d*e?"f'), 'abcdef.tmgz')
  })

  it('weicht auf einen Standardnamen aus, wenn nichts übrig bleibt', () => {
    assert.equal(archiveFileName('///'), 'reise.tmgz')
    assert.equal(archiveFileName(''), 'reise.tmgz')
  })
})
