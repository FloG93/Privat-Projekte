/**
 * Projektansicht: Räume, Einkaufsliste, Einstellungen, Laser-Standorte.
 */

import { formatKg, formatL, formatM2, formatMm, formatNum, formatPallets, parseMeasurement, parseNum } from '../format.js'
import { removeSetup, setupInUse, updateSetupRef } from '../calc.js'
import { createProject, createRoom } from '../model.js'
import { alertDialog, confirmDialog, el, formDialog, icon } from './dom.js'
import { openLaserDialog } from './laser-dialog.js'

/** @typedef {import('../model.js').Project} Project */
/** @typedef {import('../model.js').Settings} Settings */
/** @typedef {import('../calc.js').Summary} Summary */
/** @typedef {import('./types.js').Commit} Commit */
/** @typedef {import('./types.js').Ui} Ui */

/**
 * @typedef {object} DashboardCtx
 * @property {Project} project
 * @property {Project[]} projects alle Projekte (für die Auswahl)
 * @property {Summary} summary
 * @property {Commit} commit
 * @property {(hash: string) => void} navigate
 * @property {Ui} ui
 */

/** Größtes erlaubtes Raster – mehr Zellen misst auf der Baustelle niemand. */
const MAX_CELLS = 600

/**
 * @typedef {object} SettingSpec
 * @property {keyof Settings} key
 * @property {string} label
 * @property {string} unit
 * @property {number} min
 * @property {number} max
 * @property {string} [hint]
 */

/** @type {SettingSpec[]} */
const SETTING_SPECS = [
  { key: 'consumption', label: 'Verbrauch', unit: 'kg je mm und m²', min: 0.1, max: 5 },
  { key: 'bagKg', label: 'Sackgewicht', unit: 'kg', min: 1, max: 100 },
  { key: 'minLayer', label: 'Mindestschichtdicke', unit: 'mm', min: 0, max: 50 },
  { key: 'maxLayer', label: 'Maximale Schichtdicke', unit: 'mm', min: 1, max: 200 },
  { key: 'reservePct', label: 'Reserve', unit: '%', min: 0, max: 50 },
  { key: 'waterPerBag', label: 'Wasser je Sack', unit: 'L', min: 0, max: 20 },
  { key: 'bagsPerPallet', label: 'Säcke je Palette', unit: 'Stück', min: 1, max: 200 },
  { key: 'gridSize', label: 'Rastermaß für neue Räume', unit: 'm', min: 0.5, max: 2, hint: 'Gilt nur für neu angelegte Räume.' },
]

/**
 * Zahl aus einem Textfeld, nur im erlaubten Bereich.
 * @param {string | undefined} text
 * @param {number} min
 * @param {number} max
 * @returns {number | null}
 */
function parseRange(text, min, max) {
  const value = parseNum(text ?? '')
  return value !== null && value >= min && value <= max ? value : null
}

/**
 * @param {HTMLElement} root
 * @param {DashboardCtx} ctx
 */
export function renderDashboard(root, ctx) {
  const undo = undoBanner(ctx)
  root.append(
    projectHeader(ctx),
    ...(undo ? [undo] : []),
    roomsSection(ctx),
    shoppingList(ctx),
    settingsSection(ctx),
    setupsSection(ctx),
  )
}

/**
 * Aufklappbarer Bereich, dessen Zustand ein Neuzeichnen übersteht.
 * @param {DashboardCtx} ctx
 * @param {string} id
 * @param {string} title
 * @param {Array<Node | null>} content
 */
export function section(ctx, id, title, content) {
  return el('details', {
    class: 'card fold',
    open: ctx.ui.open.has(id),
    ontoggle: (/** @type {Event} */ e) => {
      const open = /** @type {HTMLDetailsElement} */ (e.target).open
      if (open) ctx.ui.open.add(id)
      else ctx.ui.open.delete(id)
    },
  }, el('summary', {}, title), ...content)
}

// ---------------------------------------------------------------------------

/** @param {DashboardCtx} ctx */
function projectHeader({ project, projects, commit }) {
  const select = el('select', {
    'aria-label': 'Projekt wählen',
    onchange: (/** @type {Event} */ e) => {
      const id = /** @type {HTMLSelectElement} */ (e.target).value
      commit((_p, state) => { state.activeProjectId = id })
    },
  }, ...projects.map((p) => el('option', { value: p.id, selected: p.id === project.id }, p.name)))

  return el('section', { class: 'project-head' },
    el('div', { class: 'row' },
      el('h1', {}, project.name),
      el('button', {
        class: 'btn icon-btn',
        type: 'button',
        title: 'Projekt umbenennen',
        'aria-label': 'Projekt umbenennen',
        onclick: async () => {
          const values = await formDialog({
            title: 'Projekt umbenennen',
            fields: [{ name: 'name', label: 'Name', value: project.name }],
            validate: (v) => (v['name']?.trim() ? null : 'Bitte einen Namen eingeben.'),
          })
          if (values) commit((p) => { p.name = (values['name'] ?? '').trim() })
        },
      }, icon('pencil')),
    ),
    el('div', { class: 'row wrap-row' },
      select,
      el('button', {
        class: 'btn',
        type: 'button',
        onclick: async () => {
          const values = await formDialog({
            title: 'Neues Projekt',
            fields: [{ name: 'name', label: 'Name der Baustelle' }],
            validate: (v) => (v['name']?.trim() ? null : 'Bitte einen Namen eingeben.'),
            submitLabel: 'Anlegen',
          })
          if (!values) return
          const created = createProject((values['name'] ?? '').trim())
          commit((_p, state) => {
            state.projects.push(created)
            state.activeProjectId = created.id
          })
        },
      }, icon('plus'), 'Neues Projekt'),
      el('button', {
        class: 'btn',
        type: 'button',
        onclick: async () => {
          if (!(await confirmDialog(`Projekt „${project.name}“ mit allen Räumen und Messwerten löschen? Das lässt sich nicht rückgängig machen.`))) return
          commit((_p, state) => {
            state.projects = state.projects.filter((p) => p.id !== project.id)
            if (state.projects.length === 0) state.projects.push(createProject('Mein Projekt'))
            state.activeProjectId = state.projects[0]?.id ?? null
          })
        },
      }, icon('trash-2'), 'Projekt löschen'),
    ),
    el('label', { class: 'switch' },
      el('input', {
        type: 'checkbox',
        checked: project.connected,
        onchange: (/** @type {Event} */ e) => {
          const on = /** @type {HTMLInputElement} */ (e.target).checked
          commit((p) => { p.connected = on })
        },
      }),
      el('span', {},
        'Räume schwellenlos verbinden',
        el('small', {}, 'Gemeinsamer Bezug: der höchste Punkt aller verbundenen Räume bestimmt die Soll-Höhe.')),
    ),
  )
}

/**
 * Nach dem Löschen eines Raums: Rückgängig anbieten.
 * @param {DashboardCtx} ctx */
function undoBanner({ ui, commit }) {
  const undo = ui.undoRoom
  if (!undo) return null
  return el('p', { class: 'toast', role: 'status' },
    el('span', {}, `Raum „${undo.room.name}“ gelöscht.`),
    el('button', {
      class: 'btn',
      type: 'button',
      onclick: () => {
        ui.undoRoom = null
        commit((p) => { p.rooms.splice(Math.min(undo.index, p.rooms.length), 0, undo.room) })
      },
    }, icon('undo-2'), 'Rückgängig'),
    el('button', { class: 'btn icon-btn', type: 'button', 'aria-label': 'Hinweis schließen', onclick: () => { ui.undoRoom = null; commit(() => {}) } }, icon('x')),
  )
}

// ---------------------------------------------------------------------------

/** @param {DashboardCtx} ctx */
function roomsSection({ project, summary, commit, navigate }) {
  const cards = project.rooms.map((room, i) => {
    const result = summary.rooms[i]
    const free = room.freePoints.length
    const progress = !result
      ? ''
      : room.grid.cols === 0
        ? (free > 0 ? `${free} freie Punkte` : 'noch nicht gemessen')
        : result.status === 'empty' && free === 0
          ? 'noch nicht gemessen'
          : `${result.measured}/${result.total} gemessen`
    const warn = result && (result.overMax || result.status === 'partial')
    return el('a', { class: 'card room-card', href: `#/raum/${encodeURIComponent(room.id)}` },
      el('span', { class: 'room-name' }, room.name),
      el('span', { class: 'muted' }, result && result.area > 0 ? formatM2(result.area) : 'Fläche fehlt'),
      el('span', { class: 'muted' }, progress),
      el('span', { class: 'room-bags' }, result && result.bags > 0 ? `${result.bags} Säcke` : '–'),
      warn ? el('span', { class: 'warn', title: result.overMax ? 'Grenzwert überschritten' : 'Vorläufig – Raster unvollständig' }, icon('triangle-alert')) : null,
    )
  })

  return el('section', {},
    el('h2', {}, 'Räume'),
    project.rooms.length === 0 ? el('p', { class: 'muted' }, 'Noch kein Raum angelegt.') : null,
    el('div', { class: 'room-list' }, ...cards),
    el('button', {
      class: 'btn primary add-room',
      type: 'button',
      onclick: async () => {
        const values = await formDialog({
          title: 'Neuer Raum',
          intro: 'Länge und Breite leer lassen für Räume ohne Raster (z. B. WC) – dann Fläche eintragen und freie Punkte messen.',
          fields: [
            { name: 'name', label: 'Name', value: `Raum ${project.rooms.length + 1}` },
            { name: 'length', label: 'Länge Ost–West (m)', kind: 'decimal' },
            { name: 'width', label: 'Breite Nord–Süd (m)', kind: 'decimal' },
            { name: 'area', label: 'Fläche (m²), optional', kind: 'decimal', hint: 'Überschreibt Länge × Breite.' },
          ],
          validate: (v) => validateRoomForm(v, project.settings.gridSize),
          submitLabel: 'Anlegen',
        })
        if (!values) return
        const length = parseNum(values['length'] ?? '')
        const width = parseNum(values['width'] ?? '')
        const room = createRoom((values['name'] ?? '').trim(), length, width, project.settings.gridSize)
        room.areaOverride = parseNum(values['area'] ?? '')
        commit((p) => { p.rooms.push(room) })
        navigate(`#/raum/${encodeURIComponent(room.id)}`)
      },
    }, icon('plus'), 'Raum'),
  )
}

/**
 * Prüft das Raumformular (Anlegen und Bearbeiten).
 * @param {Record<string, string>} v
 * @param {number} gridSize
 * @returns {string | null}
 */
export function validateRoomForm(v, gridSize) {
  if (!v['name']?.trim()) return 'Bitte einen Namen eingeben.'
  const hasLength = (v['length'] ?? '').trim() !== ''
  const hasWidth = (v['width'] ?? '').trim() !== ''
  if (hasLength !== hasWidth) return 'Länge und Breite gemeinsam eingeben – oder beide leer lassen.'
  if (hasLength) {
    const length = parseRange(v['length'], 0.1, 50)
    const width = parseRange(v['width'], 0.1, 50)
    if (length === null || width === null) return 'Länge und Breite als Zahl zwischen 0,1 und 50 m eingeben.'
    if (Math.round(length / gridSize) * Math.round(width / gridSize) > MAX_CELLS) {
      return `Zu viele Rasterzellen (mehr als ${MAX_CELLS}) – bitte ein größeres Rastermaß wählen.`
    }
  }
  if ((v['area'] ?? '').trim() !== '' && parseRange(v['area'], 0.01, 5000) === null) {
    return 'Die Fläche als Zahl größer 0 eingeben.'
  }
  return null
}

// ---------------------------------------------------------------------------

/** @param {DashboardCtx} ctx */
function shoppingList({ summary }) {
  if (summary.massKg <= 0) {
    return el('section', { class: 'card shopping' },
      el('h2', {}, 'Einkaufsliste'),
      el('p', { class: 'muted' }, 'Noch keine Messwerte – sobald Werte eingetragen sind, steht hier der Bedarf.'))
  }
  /** @param {string} label @param {string} value @param {string} [note] */
  const row = (label, value, note) =>
    el('div', { class: 'kv' },
      el('dt', {}, label),
      el('dd', {}, value, note ? el('small', {}, note) : null))
  return el('section', { class: 'card shopping' },
    el('h2', {}, 'Einkaufsliste'),
    el('dl', {},
      row('Ausgleichsmasse', formatKg(summary.massKg)),
      row('Säcke', `${summary.bagsTotal}`, summary.bagsSumRooms !== summary.bagsTotal
        ? `Bei getrenntem Gießen je Raum: ${summary.bagsSumRooms}`
        : undefined),
      row('Paletten', formatPallets(summary.palletFull, summary.palletRest),
        summary.pallets > 0 ? `Aufgerundet: ${summary.pallets} Paletten` : undefined),
      row('Wasser', formatL(summary.waterL)),
      summary.hMeanWeighted !== null ? row('Ø Schichtdicke', formatMm(summary.hMeanWeighted), 'nach Fläche gewichtet') : null,
    ),
    summary.warnings.length > 0
      ? el('ul', { class: 'warnings' }, ...summary.warnings.map((w) => el('li', {}, icon('triangle-alert'), w)))
      : null,
  )
}

// ---------------------------------------------------------------------------

/** @param {DashboardCtx} ctx */
function settingsSection(ctx) {
  const { project, commit } = ctx
  const fields = SETTING_SPECS.map((spec) => {
    const input = el('input', {
      type: 'text',
      inputmode: 'decimal',
      autocomplete: 'off',
      value: formatNum(project.settings[spec.key], 3).replace(/\./g, ''),
      onchange: async (/** @type {Event} */ e) => {
        const value = parseRange(/** @type {HTMLInputElement} */ (e.target).value, spec.min, spec.max)
        if (value === null) {
          await alertDialog(`${spec.label}: bitte eine Zahl zwischen ${formatNum(spec.min)} und ${formatNum(spec.max)} eingeben.`)
          commit(() => {}) // zurücksetzen: neu zeichnen mit dem gespeicherten Wert
          return
        }
        commit((p) => { p.settings[spec.key] = spec.key === 'bagsPerPallet' ? Math.round(value) : value })
      },
    })
    const chips = spec.key === 'maxLayer'
      ? el('div', { class: 'chips' }, ...[30, 40].map((mm) =>
        el('button', {
          class: project.settings.maxLayer === mm ? 'chip on' : 'chip',
          type: 'button',
          onclick: () => commit((p) => { p.settings.maxLayer = mm }),
        }, `${mm} mm`)))
      : null
    return el('label', { class: 'field' },
      el('span', { class: 'field-label' }, `${spec.label} (${spec.unit})`),
      input,
      spec.hint ? el('small', {}, spec.hint) : null,
      chips,
    )
  })
  return section(ctx, 'settings', 'Materialeinstellungen', [el('div', { class: 'fields' }, ...fields)])
}

// ---------------------------------------------------------------------------

/** @param {DashboardCtx} ctx */
function setupsSection(ctx) {
  const { project, commit } = ctx
  const rows = project.setups.map((setup, index) => {
    const ref = setup.ref
    const inUse = setupInUse(project, setup.id)
    return el('div', { class: 'setup-row' },
      el('label', { class: 'setup-pick' },
        el('input', {
          type: 'radio',
          name: 'setup',
          checked: setup.id === project.activeSetupId,
          onchange: () => commit((p) => { p.activeSetupId = setup.id }),
        }),
        el('span', {},
          el('strong', {}, setup.name),
          ` · Versatz ${setup.offset > 0 ? '+' : ''}${formatMm(setup.offset)}`,
          ref ? el('small', {}, `Bezugspunkt „${ref.label}“: ${formatNum(ref.before)} → ${formatNum(ref.after)} mm`) : null)),
      index === 0 ? null : el('button', {
        class: 'btn icon-btn', type: 'button', title: 'Referenzmessung ändern', 'aria-label': `${setup.name}: Referenzmessung ändern`,
        onclick: async () => {
          if (!ref) return
          const values = await formDialog({
            title: `${setup.name} korrigieren`,
            intro: 'Alle Messwerte dieses Standorts werden mit dem neuen Versatz sofort richtig umgerechnet.',
            fields: [
              { name: 'label', label: 'Referenzpunkt', value: ref.label },
              { name: 'before', label: 'Wert vorher (mm)', kind: 'decimal', value: formatNum(ref.before, 1).replace(/\./g, '') },
              { name: 'after', label: 'Wert nachher (mm)', kind: 'decimal', value: formatNum(ref.after, 1).replace(/\./g, '') },
            ],
            validate: (v) => {
              if (!v['label']?.trim()) return 'Bitte den Referenzpunkt benennen.'
              return parseMeasurement(v['before'] ?? '') === null || parseMeasurement(v['after'] ?? '') === null
                ? 'Beide Werte als Zahl zwischen 0 und 2000 mm eingeben.' : null
            },
          })
          const before = values ? parseMeasurement(values['before'] ?? '') : null
          const after = values ? parseMeasurement(values['after'] ?? '') : null
          if (!values || before === null || after === null) return
          commit((p) => { updateSetupRef(p, setup.id, (values['label'] ?? '').trim(), before, after) })
        },
      }, icon('pencil')),
      index === 0 ? null : el('button', {
        class: 'btn icon-btn',
        type: 'button',
        title: inUse ? 'Wird noch verwendet – nicht löschbar' : 'Standort löschen',
        'aria-label': `${setup.name} löschen`,
        disabled: inUse,
        onclick: async () => {
          if (!(await confirmDialog(`Laser-Standort ${setup.name} löschen?`))) return
          commit((p) => { removeSetup(p, setup.id) })
        },
      }, icon('trash-2')))
  })
  return section(ctx, 'setups', 'Laser-Standorte', [
    el('p', { class: 'muted' }, 'Neue Messwerte gehören zum aktiven Standort. Der Versatz bezieht sich auf die Linie von S1.'),
    ...rows,
    el('button', { class: 'btn', type: 'button', onclick: () => openLaserDialog(project, commit) }, icon('crosshair'), 'Laser umsetzen'),
  ])
}
