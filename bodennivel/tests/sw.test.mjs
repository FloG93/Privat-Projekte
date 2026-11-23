import assert from 'node:assert/strict'
import { access, readFile, readdir } from 'node:fs/promises'
import { describe, it } from 'node:test'

const root = new URL('../', import.meta.url)
const swText = await readFile(new URL('sw.js', root), 'utf8')

/** Liest das ASSETS-Array aus sw.js, ohne die Datei auszuführen. */
function readAssets() {
  const block = /const ASSETS = \[([\s\S]*?)\]/.exec(swText)
  assert.ok(block, 'ASSETS in sw.js nicht gefunden')
  return [...(block[1] ?? '').matchAll(/'([^']+)'/g)].map((m) => m[1] ?? '')
}

describe('Service Worker', () => {
  it('verwendet das eigene Cache-Präfix', () => {
    assert.match(swText, /const CACHE_PREFIX = 'pp-bodennivel-'/)
  })

  it('jede Datei in ASSETS gibt es', async () => {
    for (const path of readAssets()) {
      if (path === './') continue
      await access(new URL(path, root))
    }
  })

  it('jede Skript-, Stil- und Icon-Datei der App steht in ASSETS', async () => {
    const assets = new Set(readAssets())
    const files = await readdir(root, { recursive: true })
    const needed = files.filter((f) =>
      /\.(js|css|svg)$/.test(f) && !f.startsWith('tests') && f !== 'sw.js')
    assert.ok(needed.length > 20, 'zu wenige App-Dateien gefunden')
    for (const file of needed) {
      assert.ok(assets.has(`./${file}`), `${file} fehlt in ASSETS (sw.js)`)
    }
    for (const base of ['./', './index.html', './manifest.webmanifest']) {
      assert.ok(assets.has(base), `${base} fehlt in ASSETS`)
    }
    assert.ok(assets.has('../shared/css/ui.css'))
    assert.ok(assets.has('../shared/js/theme.js'))
  })
})
