/**
 * Dialog „Laser umsetzen“: Referenzpunkt vor und nach dem Umstellen messen,
 * daraus ergibt sich der Versatz des neuen Standorts.
 */

import { addSetup, setupOffset } from '../calc.js'
import { formatNum, parseMeasurement } from '../format.js'
import { formDialog } from './dom.js'

/** @typedef {import('../model.js').Project} Project */
/** @typedef {import('./types.js').Commit} Commit */

/** @param {number} value */
const signed = (value) => `${value > 0 ? '+' : ''}${formatNum(value)}`

/**
 * @param {Project} project
 * @param {Commit} commit
 * @returns {Promise<void>}
 */
export async function openLaserDialog(project, commit) {
  const next = `S${project.setups.length + 1}`
  const base = setupOffset(project, project.activeSetupId)

  /** @param {Record<string, string>} v */
  const delta = (v) => {
    const before = parseMeasurement(v['before'] ?? '')
    const after = parseMeasurement(v['after'] ?? '')
    return before === null || after === null ? null : after - before
  }

  const values = await formDialog({
    title: 'Laser umsetzen',
    intro: 'Vor dem Umstellen einen markanten Punkt messen, Laser umstellen, denselben Punkt noch einmal messen.',
    fields: [
      { name: 'label', label: 'Referenzpunkt', value: 'Tür', hint: 'Wo gemessen wurde – nur zur Erinnerung.' },
      { name: 'before', label: 'Wert vorher (alter Standort, mm)', kind: 'decimal' },
      { name: 'after', label: 'Wert nachher (neuer Standort, mm)', kind: 'decimal' },
    ],
    submitLabel: 'Standort anlegen',
    onInput: (v) => {
      const d = delta(v)
      return d === null ? '' : `Δ = ${signed(d)} mm → neuer Standort ${next} (Versatz ${signed(base + d)} mm)`
    },
    validate: (v) => {
      if (!v['label']?.trim()) return 'Bitte den Referenzpunkt benennen.'
      return delta(v) === null ? 'Beide Werte als Zahl zwischen 0 und 2000 mm eingeben.' : null
    },
  })
  if (!values) return
  const before = parseMeasurement(values['before'] ?? '')
  const after = parseMeasurement(values['after'] ?? '')
  if (before === null || after === null) return
  commit((p) => { addSetup(p, (values['label'] ?? '').trim(), before, after) })
}
