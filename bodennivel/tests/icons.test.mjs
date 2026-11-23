import assert from 'node:assert/strict'
import { access, readFile } from 'node:fs/promises'
import { describe, it } from 'node:test'
import { ICONS } from '../js/ui/dom.js'

const dir = new URL('../vendor/lucide/', import.meta.url)

describe('Lucide-Icons', () => {
  it('jedes benannte Icon liegt als SVG im vendor-Ordner', async () => {
    for (const name of ICONS) {
      await access(new URL(`icons/${name}.svg`, dir))
    }
  })

  it('LICENSE und VERSION liegen daneben', async () => {
    await access(new URL('LICENSE', dir))
    const version = await readFile(new URL('VERSION', dir), 'utf8')
    assert.match(version.trim(), /^\d+\.\d+\.\d+/)
  })
})
