/**
 * Druckansicht: je Raum eine Seite mit Draufsicht (Rohwert und Schichtdicke),
 * Anzeichen-Maß und Mengen, am Ende die Einkaufsliste.
 */

import { formatMark } from '../calc.js'
import { formatDiff, formatKg, formatL, formatM2, formatMm, formatNum, formatReading } from '../format.js'
import { shoppingList } from './dashboard.js'
import { el, icon } from './dom.js'
import { renderPlan } from './plan-svg.js'

/** @typedef {import('../model.js').Project} Project */
/** @typedef {import('../calc.js').Summary} Summary */

/**
 * @param {HTMLElement} root
 * @param {{ project: Project, summary: Summary }} ctx
 */
export function renderPrint(root, { project, summary }) {
  const s = project.settings
  const date = new Date().toLocaleDateString('de-DE')

  const rooms = project.rooms.map((room, i) => {
    const result = summary.rooms[i]
    if (!result) return null
    const plan = room.grid.cols > 0
      ? renderPlan(room, result, { selected: null, show: 'both' }, s.inputUnit, () => {}, () => {})
      : null
    return el('section', { class: 'print-room' },
      el('h2', {}, room.name, el('span', { class: 'muted' }, ` · ${result.area > 0 ? formatM2(result.area) : 'Fläche fehlt'}`)),
      result.status === 'empty' ? el('p', {}, 'Noch nicht gemessen.') : null,
      plan,
      room.freePoints.length > 0
        ? el('ul', { class: 'print-points' }, ...room.freePoints.map((point) => {
          const h = result.hPoints.get(point.id)
          const diff = result.diffPoints.get(point.id)
          return el('li', {}, `${point.label}: ${formatReading(point.value, s.inputUnit)}${diff === undefined ? '' : ` (${formatDiff(diff)} mm)`}${h === undefined ? '' : ` (Schicht ${formatMm(h)})`}`)
        }))
        : null,
      result.status !== 'empty'
        ? el('div', {},
          ...result.marks.map((m) => el('p', { class: 'mark' }, el('strong', {}, `Anzeichen-Maß ${m.name}: `), formatMark(m.dSoll))),
          el('p', {},
            `Ø Schicht ${result.hMean === null ? '–' : formatMm(result.hMean)} · max. ${result.hMax === null ? '–' : formatMm(result.hMax)} · `
            + `${formatKg(result.massKg)} · ${result.bags} Säcke · ${formatL(result.waterL)}`),
          result.status === 'partial' && result.total > 0
            ? el('p', { class: 'warn-note' }, `Vorläufig – ${result.measured} von ${result.total} Punkten gemessen.`)
            : null,
          result.overMax ? el('p', { class: 'warn-note' }, 'Grenzwert der Schichtdicke überschritten.') : null)
        : null,
    )
  })

  root.append(
    el('div', { class: 'print-tools no-print row wrap-row' },
      el('a', { class: 'btn', href: '#/' }, icon('chevron-left'), 'Zurück'),
      el('button', { class: 'btn primary', type: 'button', onclick: () => window.print() }, icon('printer'), 'Drucken'),
    ),
    el('div', { class: 'print-view' },
      el('header', { class: 'print-head' },
        el('h1', {}, project.name),
        el('p', { class: 'muted' },
          `${date} · Verbrauch ${formatNum(s.consumption, 2)} kg/(mm·m²) · Sack ${formatNum(s.bagKg)} kg · `
          + `Mindestschicht ${formatNum(s.minLayer)} mm · Reserve ${formatNum(s.reservePct)} % · `
          + (project.connected ? 'Räume schwellenlos verbunden' : 'Räume einzeln')),
      ),
      ...rooms.filter((r) => r !== null),
      el('div', { class: 'print-total' }, shoppingList({ summary })),
    ),
  )
}
