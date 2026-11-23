/**
 * Kleine DOM-Helfer: Elemente bauen, Icons, Dialoge.
 * Kein DOM-Zugriff auf Modulebene – die Datei lässt sich in Node importieren
 * (der Icon-Test liest `ICONS`).
 */

/**
 * Icons aus `vendor/lucide/icons/`. Neue Namen auch in `sw.js` eintragen.
 * @type {readonly string[]}
 */
export const ICONS = [
  'plus', 'trash-2', 'pencil', 'chevron-left', 'settings', 'crosshair', 'move', 'printer',
  'download', 'upload', 'triangle-alert', 'check', 'skip-forward', 'undo-2', 'layers', 'x',
]

/**
 * Baut ein Element. `class` setzt die Klasse, `on…` hängt Ereignisse an,
 * `true` setzt ein Attribut ohne Wert, `false`/`null` lässt es weg.
 * @template {keyof HTMLElementTagNameMap} K
 * @param {K} tag
 * @param {Record<string, any>} [attrs]
 * @param {...(Node | string | null | false | undefined)} children
 * @returns {HTMLElementTagNameMap[K]}
 */
export function el(tag, attrs = {}, ...children) {
  const node = document.createElement(tag)
  for (const [key, value] of Object.entries(attrs)) {
    if (value === false || value === null || value === undefined) continue
    if (key === 'class') node.className = value
    else if (key.startsWith('on') && typeof value === 'function') node.addEventListener(key.slice(2), value)
    else if (key === 'value' && 'value' in node) /** @type {HTMLInputElement} */ (node).value = value
    else node.setAttribute(key, value === true ? '' : String(value))
  }
  for (const child of children) {
    if (child === null || child === false || child === undefined) continue
    node.append(child)
  }
  return node
}

/**
 * @param {string} name Eintrag aus `ICONS`
 * @returns {HTMLElement}
 */
export function icon(name) {
  const node = el('span', { class: 'icon', 'aria-hidden': 'true' })
  // Absolut auflösen: eine URL in einer CSS-Variablen gilt sonst relativ zur
  // Stylesheet-Datei (css/), nicht zur Seite.
  const url = new URL(`../../vendor/lucide/icons/${name}.svg`, import.meta.url).href
  node.style.setProperty('--icon', `url(${url})`)
  return node
}

/**
 * Öffnet ein <dialog> und liefert das Ergebnis, wenn es schließt.
 * @template T
 * @param {HTMLDialogElement} dialog
 * @param {() => T} result Wird gelesen, wenn mit „ok“ geschlossen wurde
 * @returns {Promise<T | null>}
 */
function showDialog(dialog, result) {
  return new Promise((resolve) => {
    dialog.addEventListener('close', () => {
      const ok = dialog.returnValue === 'ok'
      const value = ok ? result() : null
      dialog.remove()
      resolve(value)
    })
    document.body.append(dialog)
    dialog.showModal()
  })
}

/**
 * Rückfrage vor dem Löschen o. Ä.
 * @param {string} text
 * @param {string} [confirmLabel]
 * @returns {Promise<boolean>}
 */
export async function confirmDialog(text, confirmLabel = 'Löschen') {
  const dialog = el('dialog', { class: 'dialog' },
    el('form', { method: 'dialog' },
      el('p', {}, text),
      el('div', { class: 'dialog-actions' },
        el('button', { class: 'btn', value: 'cancel', type: 'submit' }, 'Abbrechen'),
        el('button', { class: 'btn primary', value: 'ok', type: 'submit', autofocus: true }, confirmLabel),
      ),
    ),
  )
  return (await showDialog(dialog, () => true)) === true
}

/**
 * Meldung mit einem „OK“-Knopf.
 * @param {string} text
 * @returns {Promise<void>}
 */
export async function alertDialog(text) {
  const dialog = el('dialog', { class: 'dialog' },
    el('form', { method: 'dialog' },
      el('p', {}, text),
      el('div', { class: 'dialog-actions' },
        el('button', { class: 'btn primary', value: 'ok', type: 'submit', autofocus: true }, 'OK'),
      ),
    ),
  )
  await showDialog(dialog, () => true)
}

/**
 * @typedef {object} Field
 * @property {string} name
 * @property {string} label
 * @property {string} [value]
 * @property {'text' | 'decimal' | 'checkbox'} [kind]
 * @property {string} [hint]
 */

/**
 * Formular im Dialog. Gibt die Werte als Text zurück (Kästchen: „true“ oder
 * „“), bei Abbruch null. `validate` liefert eine Fehlermeldung oder null; der
 * Dialog bleibt dann offen. `onInput` liefert einen Live-Text (z. B. Δ).
 * @param {object} options
 * @param {string} options.title
 * @param {string} [options.intro]
 * @param {Field[]} options.fields
 * @param {string} [options.submitLabel]
 * @param {(values: Record<string, string>) => string | null} [options.validate]
 * @param {(values: Record<string, string>) => string} [options.onInput]
 * @returns {Promise<Record<string, string> | null>}
 */
export function formDialog({ title, intro, fields, submitLabel = 'Speichern', validate, onInput }) {
  const inputs = new Map()
  const error = el('p', { class: 'form-error', role: 'alert' })
  const live = el('p', { class: 'form-live' })

  /** @returns {Record<string, string>} */
  const values = () => Object.fromEntries([...inputs].map(([name, input]) =>
    [name, input.type === 'checkbox' ? (input.checked ? 'true' : '') : input.value]))

  const rows = fields.map((field) => {
    const checkbox = field.kind === 'checkbox'
    const input = el('input', {
      type: checkbox ? 'checkbox' : 'text',
      name: field.name,
      value: checkbox ? undefined : (field.value ?? ''),
      checked: checkbox && field.value === 'true',
      inputmode: field.kind === 'decimal' ? 'decimal' : undefined,
      autocomplete: 'off',
      enterkeyhint: 'done',
    })
    inputs.set(field.name, input)
    input.addEventListener('input', () => {
      error.textContent = ''
      if (onInput) live.textContent = onInput(values())
    })
    return el('label', { class: checkbox ? 'field check' : 'field' },
      el('span', { class: 'field-label' }, field.label),
      input,
      field.hint ? el('small', {}, field.hint) : null,
    )
  })

  const form = el('form', { method: 'dialog', novalidate: true },
    el('h2', {}, title),
    intro ? el('p', { class: 'muted' }, intro) : null,
    ...rows, live, error,
    el('div', { class: 'dialog-actions' },
      el('button', { class: 'btn', value: 'cancel', type: 'button', onclick: () => dialog.close('cancel') }, 'Abbrechen'),
      el('button', { class: 'btn primary', type: 'submit' }, submitLabel),
    ),
  )
  const dialog = el('dialog', { class: 'dialog' }, form)
  form.addEventListener('submit', (event) => {
    event.preventDefault()
    const message = validate ? validate(values()) : null
    if (message) {
      error.textContent = message
      return
    }
    dialog.close('ok')
  })
  if (onInput) live.textContent = onInput(values())
  return showDialog(dialog, values)
}
