/**
 * Prüft, dass jeder relative Verweis im Repository auf eine Datei zeigt, die es
 * gibt – in HTML (`href`, `src`) und in JavaScript (`import … from '…'`).
 *
 * Warum eigens dafür ein Test: Ohne Build-Schritt merkt niemand, wenn ein Pfad
 * nicht stimmt. Die Seite lädt, bleibt aber halb leer, und in der Konsole steht
 * eine Zeile, die beim Veröffentlichen keiner sieht. Genau so ging in der
 * früheren Fassung dieser App der Karten-Worker verloren.
 *
 * Aufruf: node tools/check-links.mjs
 */

import { readdir, readFile, stat } from 'node:fs/promises'
import { dirname, join, posix, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const SKIP_DIRS = new Set(['.git', 'node_modules', '_site', 'build'])

/** @param {string} dir @returns {Promise<string[]>} */
async function filesUnder(dir) {
  /** @type {string[]} */
  const found = []
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    if (entry.name.startsWith('.') && entry.name !== '.github') continue
    if (SKIP_DIRS.has(entry.name)) continue
    const full = join(dir, entry.name)
    if (entry.isDirectory()) found.push(...(await filesUnder(full)))
    else found.push(full)
  }
  return found
}

/** Verweise, die wir nicht prüfen können oder wollen. */
function isExternal(target) {
  return (
    /^[a-z][a-z0-9+.-]*:/i.test(target) || // https:, data:, mailto: …
    target.startsWith('//') ||
    target.startsWith('#')
  )
}

/**
 * @param {string} file  Datei, in der der Verweis steht
 * @param {string} target  der Verweis selbst
 * @returns {Promise<string | null>} Fehlertext oder null
 */
async function checkTarget(file, target) {
  if (isExternal(target)) return null

  const clean = target.split(/[?#]/)[0]
  if (!clean) return null

  if (clean.startsWith('/')) {
    // Absolute Pfade brechen, sobald die Seite in einem Unterordner liegt –
    // und auf GitHub Pages liegt sie das immer (/Privat-Projekte/…).
    return `absoluter Pfad "${target}" – nur relative Pfade benutzen`
  }

  const resolved = resolve(dirname(file), clean)
  try {
    const info = await stat(resolved)
    // Ein Verweis auf einen Ordner lädt dessen index.html.
    if (info.isDirectory()) {
      await stat(join(resolved, 'index.html'))
    }
    return null
  } catch {
    return `zeigt ins Leere: "${target}"`
  }
}

/**
 * Entfernt Kommentare, bevor wir nach Verweisen suchen. Sonst meldet der Test
 * Beispielpfade aus erklärenden Kommentaren als kaputte Verweise.
 * @param {string} text
 * @param {boolean} isHtml
 */
function withoutComments(text, isHtml) {
  if (isHtml) return text.replace(/<!--[\s\S]*?-->/g, '')
  return text.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"\\])\/\/[^\n]*/g, '$1')
}

/** @param {string} file @returns {Promise<string[]>} */
async function checkFile(file) {
  const isHtml = file.endsWith('.html')
  const text = withoutComments(await readFile(file, 'utf8'), isHtml)
  /** @type {string[]} */
  const targets = []

  if (isHtml) {
    for (const match of text.matchAll(/\b(?:href|src)\s*=\s*"([^"]*)"/g)) {
      targets.push(match[1])
    }
  }
  if (/\.m?js$/.test(file)) {
    for (const match of text.matchAll(/\bfrom\s*'([^']+)'/g)) targets.push(match[1])
    for (const match of text.matchAll(/\bimport\s*\(\s*'([^']+)'\s*\)/g)) targets.push(match[1])
    // new URL('…', import.meta.url) – so findet MapLibre seinen Worker.
    for (const match of text.matchAll(/new URL\(\s*'([^']+)'\s*,\s*import\.meta\.url/g)) {
      targets.push(match[1])
    }
  }

  /** @type {string[]} */
  const problems = []
  for (const target of targets) {
    if (target.startsWith('node:')) continue
    const problem = await checkTarget(file, target)
    if (problem) problems.push(`${posix.normalize(relative(ROOT, file))}: ${problem}`)
  }
  return problems
}

const files = (await filesUnder(ROOT)).filter((file) => /\.(html|m?js)$/.test(file))
/** @type {string[]} */
const problems = []
for (const file of files) problems.push(...(await checkFile(file)))

if (problems.length > 0) {
  console.error(`${problems.length} fehlerhafte Verweise:\n`)
  for (const problem of problems) console.error(`  ${problem}`)
  process.exit(1)
}
console.log(`${files.length} Dateien geprüft, alle Verweise zeigen auf vorhandene Dateien.`)
