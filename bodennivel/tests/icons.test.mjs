import assert from 'node:assert/strict'
import { access, readFile } from 'node:fs/promises'
import { describe, it } from 'node:test'
import { ICONS } from '../js/ui/dom.js'

describe('Lucide-Icons', () => {
  it('jedes benannte Icon liegt als SVG im vendor-Ordner', async () => {
    for (const name of ICONS) {
      await access(new URL(`../vendor/lucide/icons/${name}.svg`, import.meta.url))
    }
  })

  it('LICENSE und VERSION liegen daneben', async () => {
    await access(new URL('../vendor/lucide/LICENSE', import.meta.url))
    const version = await readFile(new URL('../vendor/lucide/VERSION', import.meta.url), 'utf8')
    assert.match(version.trim(), /^\d+\.\d+\.\d+/)
  })
})
