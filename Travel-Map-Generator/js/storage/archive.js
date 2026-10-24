/**
 * `.tmgz` – das Austausch- und Sicherungsformat eines Projekts.
 *
 * Eine `.tmgz`-Datei ist ein gewöhnliches ZIP-Archiv. Darin liegt immer
 * `project.json`; ab M6 kommen die Medien in `media/` daneben. Dass es ein
 * echtes ZIP ist, hat einen praktischen Grund: Wer wissen will, was die App
 * gespeichert hat, benennt die Datei in `.zip` um und schaut hinein.
 *
 * Geschrieben wird das Archiv von Hand – ZIP ist für diesen Zweck ein
 * überschaubares Format, und so braucht das Projekt keine Bibliothek. Die
 * eigentliche Kompression übernimmt `CompressionStream('deflate-raw')`, die
 * jeder aktuelle Browser und Node mitbringen.
 *
 * Nicht unterstützt (und beim Lesen mit klarer Meldung abgelehnt): ZIP64,
 * verschlüsselte Archive und andere Kompressionsverfahren als „gespeichert"
 * und „deflate".
 */

import { migrateProject } from '../core/model.js'

/** @typedef {import('../core/model.js').Project} Project */

/** Name der Projektdatei im Archiv. */
export const PROJECT_ENTRY = 'project.json'

const SIGNATURE_LOCAL = 0x04034b50
const SIGNATURE_CENTRAL = 0x02014b50
const SIGNATURE_END = 0x06054b50
/** Bit 11 der allgemeinen Flags: Dateinamen sind UTF-8. */
const FLAG_UTF8 = 0x0800
const METHOD_STORE = 0
const METHOD_DEFLATE = 8

/** @type {Uint32Array | null} */
let crcTable = null

/** @returns {Uint32Array} */
function getCrcTable() {
  if (crcTable) return crcTable
  const table = new Uint32Array(256)
  for (let index = 0; index < 256; index += 1) {
    let value = index
    for (let bit = 0; bit < 8; bit += 1) {
      value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1
    }
    table[index] = value >>> 0
  }
  crcTable = table
  return table
}

/**
 * CRC-32, wie ZIP es für jeden Eintrag verlangt.
 * @param {Uint8Array} bytes
 * @returns {number}
 */
export function crc32(bytes) {
  const table = getCrcTable()
  let crc = 0xffffffff
  for (const byte of bytes) {
    crc = (crc >>> 8) ^ (table[(crc ^ byte) & 0xff] ?? 0)
  }
  return (crc ^ 0xffffffff) >>> 0
}

/**
 * @param {ReadableStream<Uint8Array>} stream
 * @returns {Promise<Uint8Array>}
 */
async function readAll(stream) {
  /** @type {Uint8Array[]} */
  const chunks = []
  let length = 0
  for await (const chunk of /** @type {AsyncIterable<Uint8Array>} */ (
    /** @type {unknown} */ (stream)
  )) {
    chunks.push(chunk)
    length += chunk.length
  }
  const result = new Uint8Array(length)
  let offset = 0
  for (const chunk of chunks) {
    result.set(chunk, offset)
    offset += chunk.length
  }
  return result
}

/**
 * Die Bytes als Strom – ohne den Umweg über ein Blob, das nur erzeugt würde,
 * um es sofort wieder zu lesen.
 * @param {Uint8Array} bytes
 * @returns {ReadableStream<Uint8Array<ArrayBuffer>>}
 */
function streamOf(bytes) {
  const chunk = /** @type {Uint8Array<ArrayBuffer>} */ (bytes)
  return /** @type {ReadableStream<Uint8Array<ArrayBuffer>>} */ (
    new ReadableStream({
      start(controller) {
        controller.enqueue(chunk)
        controller.close()
      },
    })
  )
}

/**
 * @param {Uint8Array} bytes
 * @returns {Promise<Uint8Array>}
 */
async function deflate(bytes) {
  const stream = streamOf(bytes).pipeThrough(new CompressionStream('deflate-raw'))
  return readAll(/** @type {ReadableStream<Uint8Array>} */ (stream))
}

/**
 * @param {Uint8Array} bytes
 * @returns {Promise<Uint8Array>}
 */
async function inflate(bytes) {
  const stream = streamOf(bytes).pipeThrough(new DecompressionStream('deflate-raw'))
  return readAll(/** @type {ReadableStream<Uint8Array>} */ (stream))
}

/**
 * Wandelt Datum und Uhrzeit in die beiden 16-Bit-Felder von MS-DOS um, die ZIP
 * bis heute benutzt. Sekunden haben darin nur zwei Sekunden Auflösung.
 * @param {Date} date
 * @returns {{time: number, date: number}}
 */
function toDosDateTime(date) {
  const year = Math.max(1980, date.getFullYear())
  return {
    time:
      (date.getHours() << 11) | (date.getMinutes() << 5) | (Math.floor(date.getSeconds() / 2) & 0x1f),
    date: ((year - 1980) << 9) | ((date.getMonth() + 1) << 5) | date.getDate(),
  }
}

/**
 * @typedef {object} ArchiveEntry
 * @property {string} name   Pfad im Archiv, z. B. 'project.json'
 * @property {Uint8Array} data
 */

/**
 * Packt Einträge zu einem ZIP-Archiv.
 * @param {ArchiveEntry[]} entries
 * @param {Date} [modified]
 * @returns {Promise<Uint8Array>}
 */
export async function createZip(entries, modified = new Date()) {
  const { time, date } = toDosDateTime(modified)
  const encoder = new TextEncoder()

  /** @type {Uint8Array[]} */
  const parts = []
  /** @type {Uint8Array[]} */
  const central = []
  let offset = 0

  for (const entry of entries) {
    const name = encoder.encode(entry.name)
    const crc = crc32(entry.data)
    const deflated = await deflate(entry.data)
    // Kleine oder bereits dichte Daten werden durch Deflate größer – dann
    // lieber unkomprimiert ablegen.
    const useDeflate = deflated.length < entry.data.length
    const payload = useDeflate ? deflated : entry.data
    const method = useDeflate ? METHOD_DEFLATE : METHOD_STORE

    const local = new Uint8Array(30 + name.length)
    const localView = new DataView(local.buffer)
    localView.setUint32(0, SIGNATURE_LOCAL, true)
    localView.setUint16(4, 20, true) // benötigte Fassung: 2.0
    localView.setUint16(6, FLAG_UTF8, true)
    localView.setUint16(8, method, true)
    localView.setUint16(10, time, true)
    localView.setUint16(12, date, true)
    localView.setUint32(14, crc, true)
    localView.setUint32(18, payload.length, true)
    localView.setUint32(22, entry.data.length, true)
    localView.setUint16(26, name.length, true)
    localView.setUint16(28, 0, true) // kein Extra-Feld
    local.set(name, 30)

    const header = new Uint8Array(46 + name.length)
    const headerView = new DataView(header.buffer)
    headerView.setUint32(0, SIGNATURE_CENTRAL, true)
    headerView.setUint16(4, 20, true) // erzeugt von Fassung 2.0
    headerView.setUint16(6, 20, true)
    headerView.setUint16(8, FLAG_UTF8, true)
    headerView.setUint16(10, method, true)
    headerView.setUint16(12, time, true)
    headerView.setUint16(14, date, true)
    headerView.setUint32(16, crc, true)
    headerView.setUint32(20, payload.length, true)
    headerView.setUint32(24, entry.data.length, true)
    headerView.setUint16(28, name.length, true)
    headerView.setUint32(42, offset, true)
    header.set(name, 46)

    parts.push(local, payload)
    central.push(header)
    offset += local.length + payload.length
  }

  const centralSize = central.reduce((sum, part) => sum + part.length, 0)
  const end = new Uint8Array(22)
  const endView = new DataView(end.buffer)
  endView.setUint32(0, SIGNATURE_END, true)
  endView.setUint16(8, entries.length, true)
  endView.setUint16(10, entries.length, true)
  endView.setUint32(12, centralSize, true)
  endView.setUint32(16, offset, true)

  const all = [...parts, ...central, end]
  const total = all.reduce((sum, part) => sum + part.length, 0)
  const archive = new Uint8Array(total)
  let at = 0
  for (const part of all) {
    archive.set(part, at)
    at += part.length
  }
  return archive
}

/**
 * Liest ein ZIP-Archiv.
 * @param {Uint8Array} archive
 * @returns {Promise<Map<string, Uint8Array>>} Pfad im Archiv → Inhalt
 */
export async function readZip(archive) {
  const view = new DataView(archive.buffer, archive.byteOffset, archive.byteLength)

  // Das Ende-Verzeichnis steht hinten und darf einen Kommentar hinter sich
  // haben, also von hinten danach suchen.
  let end = -1
  for (let at = archive.length - 22; at >= 0; at -= 1) {
    if (view.getUint32(at, true) === SIGNATURE_END) {
      end = at
      break
    }
  }
  if (end === -1) throw new Error('Das ist keine .tmgz-Datei (ZIP-Ende fehlt).')

  const count = view.getUint16(end + 10, true)
  let at = view.getUint32(end + 16, true)
  if (count === 0xffff || at === 0xffffffff) {
    throw new Error('ZIP64-Archive werden nicht unterstützt.')
  }

  /** @type {Map<string, Uint8Array>} */
  const files = new Map()
  const decoder = new TextDecoder()

  for (let index = 0; index < count; index += 1) {
    if (view.getUint32(at, true) !== SIGNATURE_CENTRAL) {
      throw new Error('Beschädigtes Archiv: Verzeichniseintrag erwartet.')
    }
    const flags = view.getUint16(at + 8, true)
    const method = view.getUint16(at + 10, true)
    const compressedSize = view.getUint32(at + 20, true)
    const nameLength = view.getUint16(at + 28, true)
    const extraLength = view.getUint16(at + 30, true)
    const commentLength = view.getUint16(at + 32, true)
    const localOffset = view.getUint32(at + 42, true)
    const name = decoder.decode(archive.subarray(at + 46, at + 46 + nameLength))

    if (flags & 1) throw new Error('Verschlüsselte Archive werden nicht unterstützt.')
    if (method !== METHOD_STORE && method !== METHOD_DEFLATE) {
      throw new Error(`Unbekanntes Kompressionsverfahren im Archiv: ${method}`)
    }

    // Die Längen im lokalen Kopf dürfen abweichen; maßgeblich ist das
    // Verzeichnis. Aus dem lokalen Kopf brauchen wir nur, wo die Daten anfangen.
    if (view.getUint32(localOffset, true) !== SIGNATURE_LOCAL) {
      throw new Error(`Beschädigtes Archiv: Eintrag "${name}" nicht auffindbar.`)
    }
    const localNameLength = view.getUint16(localOffset + 26, true)
    const localExtraLength = view.getUint16(localOffset + 28, true)
    const start = localOffset + 30 + localNameLength + localExtraLength
    const payload = archive.subarray(start, start + compressedSize)

    const data = method === METHOD_DEFLATE ? await inflate(payload) : payload.slice()
    const expectedCrc = view.getUint32(at + 16, true)
    if (crc32(data) !== expectedCrc) {
      throw new Error(`Beschädigtes Archiv: Prüfsumme von "${name}" stimmt nicht.`)
    }
    files.set(name, data)

    at += 46 + nameLength + extraLength + commentLength
  }
  return files
}

/**
 * Packt ein Projekt als `.tmgz`.
 * @param {Project} project
 * @returns {Promise<Uint8Array>}
 */
export async function packProject(project) {
  const json = JSON.stringify(project, null, 2)
  return createZip([{ name: PROJECT_ENTRY, data: new TextEncoder().encode(json) }])
}

/**
 * Liest ein Projekt aus einer `.tmgz`-Datei und bringt es auf die aktuelle
 * Schema-Fassung. Wirft mit einem lesbaren Satz, wenn etwas nicht stimmt.
 * @param {Uint8Array} archive
 * @returns {Promise<Project>}
 */
export async function unpackProject(archive) {
  const files = await readZip(archive)
  const entry = files.get(PROJECT_ENTRY)
  if (!entry) throw new Error(`In der Datei fehlt ${PROJECT_ENTRY}.`)

  let parsed
  try {
    parsed = JSON.parse(new TextDecoder().decode(entry))
  } catch {
    throw new Error(`${PROJECT_ENTRY} in der Datei ist kein gültiges JSON.`)
  }
  return migrateProject(parsed)
}

/**
 * Dateiname für den Export – aus dem Titel, aber ohne alles, was Dateisysteme
 * nicht mögen.
 * @param {string} title
 * @returns {string}
 */
export function archiveFileName(title) {
  // Umlaute bleiben erhalten - jedes heutige Dateisystem kann sie, und
  // "Sächsische-Schweiz.tmgz" liest sich besser als "Sachsische-Schweiz.tmgz".
  // Weg muss nur, was Pfade zerlegt oder Windows verbietet.
  const base =
    title
      .replace(/[^\p{Letter}\p{Number} ._-]/gu, '')
      .trim()
      .replace(/\s+/g, '-')
      .slice(0, 60) || 'reise'
  return `${base}.tmgz`
}
