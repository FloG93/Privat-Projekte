/**
 * Dialog „Laser umsetzen“: Referenzpunkt vor und nach dem Umstellen messen,
 * daraus ergibt sich der Versatz des neuen Standorts.
 */

import { addSetup, setupOffset } from '../calc.js'
import { formatNum, formatReading, parseReading } from '../format.js'
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
  const unit = project.settings.inputUnit
  const next = `S${project.setups.length + 1}`
  const base = setupOffset(project, project.activeSetupId)

  /** @param {Record<string, string>} v */
  const delta = (v) => {
    const before = parseReading(v['before'] ?? '', unit)
    const after = parseReading(v['after'] ?? '', unit)
    return before === null || after === null ? null : after - before
  }

  const values = await formDialog({
    title: 'Laser umsetzen',
    intro: 'Vor dem Umstellen einen markanten Punkt messen, Laser umstellen, denselben Punkt noch einmal messen.',
    fields: [
      { name: 'label', label: 'Referenzpunkt', value: 'Tür', hint: 'Wo gemessen wurde – nur zur Erinnerung.' },
      { name: 'before', label: `Wert vorher (alter Standort, ${unit})`, kind: 'decimal' },
      { name: 'after', label: `Wert nachher (neuer Standort, ${unit})`, kind: 'decimal' },
    ],
    submitLabel: 'Standort anlegen',
    onInput: (v) => {
      const d = delta(v)
      return d === null ? '' : `Δ = ${signed(d)} mm → neuer Standort ${next} (Versatz ${signed(base + d)} mm)`
    },
    validate: (v) => {
      if (!v['label']?.trim()) return 'Bitte den Referenzpunkt benennen.'
      return delta(v) === null ? `Beide Werte als Zahl bis ${unit === 'cm' ? '200 cm' : '2000 mm'} eingeben.` : null
    },
  })
  if (!values) return
  const before = parseReading(values['before'] ?? '', unit)
  const after = parseReading(values['after'] ?? '', unit)
  if (before === null || after === null) return
  commit((p) => { addSetup(p, (values['label'] ?? '').trim(), before, after) })
}

/**
 * Laserhöhe und Eingabeeinheit einstellen. Abgelesene Werte werden gegen die
 * Laserhöhe verrechnet: Höhe 30 cm, abgelesen 30,4 cm → +4 mm.
 * @param {Project} project
 * @param {Commit} commit
 * @returns {Promise<void>}
 */
export async function openLaserHeightDialog(project, commit) {
  const current = project.settings.inputUnit
  const height = project.settings.laserHeight
  const values = await formDialog({
    title: 'Laserhöhe',
    intro: 'Auf welcher Höhe steht die Laserlinie? Abgelesene Werte werden damit verrechnet, z. B. Laser auf 30 cm, abgelesen 30,4 cm → +4 mm. 0 = nicht verrechnen.',
    fields: [
      {
        name: 'height',
        label: 'Laserhöhe (in der gewählten Einheit)',
        kind: 'decimal',
        value: height > 0 ? formatNum(current === 'cm' ? height / 10 : height, 2).replace(/\./g, '') : '0',
      },
      {
        name: 'unit',
        label: 'Messwerte eingeben in',
        kind: 'select',
        value: current,
        options: [{ value: 'cm', label: 'Zentimeter (30,4)' }, { value: 'mm', label: 'Millimeter (304)' }],
      },
    ],
    validate: (v) => (parseReading(v['height'] ?? '', v['unit'] === 'cm' ? 'cm' : 'mm') === null
      ? 'Die Laserhöhe als Zahl bis 200 cm (2000 mm) eingeben, oder 0.' : null),
  })
  if (!values) return
  const unit = values['unit'] === 'cm' ? 'cm' : 'mm'
  const mm = parseReading(values['height'] ?? '', unit)
  if (mm === null) return
  commit((p) => {
    p.settings.inputUnit = unit
    p.settings.laserHeight = mm
  })
}

/**
 * Kurzschreibweise für die Anzeige der Laserhöhe.
 * @param {Project} project
 * @returns {string}
 */
export function describeLaserHeight(project) {
  const { laserHeight, inputUnit } = project.settings
  return laserHeight > 0 ? formatReading(laserHeight, inputUnit) : 'nicht gesetzt'
}
