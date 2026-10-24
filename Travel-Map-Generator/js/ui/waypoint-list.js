import { formatDistance, formatLonLat, haversineMeters } from '../core/geo.js'

/** @typedef {import('../core/model.js').Project} Project */
/** @typedef {import('../core/model.js').Waypoint} Waypoint */

/**
 * @typedef {object} WaypointListHandlers
 * @property {(id: string, name: string) => void} onRename
 * @property {(id: string) => void} onRemove
 * @property {(from: number, to: number) => void} onReorder
 * @property {(id: string) => void} onSelect
 */

/**
 * Die Liste der Wegpunkte in der Seitenleiste.
 *
 * Umsortieren geht auf zwei Wegen: Ziehen mit der Maus und die Pfeilknöpfe.
 * Die Knöpfe sind nicht nur Beiwerk – Ziehen lässt sich mit der Tastatur nicht
 * bedienen und auf dem Telefon schlecht treffen.
 *
 * @param {HTMLElement} container
 * @param {WaypointListHandlers} handlers
 */
export function createWaypointList(container, handlers) {
  /** @type {number | null} */
  let dragFrom = null

  /**
   * @param {Waypoint} waypoint
   * @param {number} index
   * @param {Project} project
   * @param {string | null} selectedId
   * @returns {HTMLLIElement}
   */
  function renderRow(waypoint, index, project, selectedId) {
    const row = document.createElement('li')
    row.className = 'waypoint'
    row.draggable = true
    row.dataset['index'] = String(index)
    row.dataset['waypointId'] = waypoint.id
    if (waypoint.id === selectedId) row.classList.add('is-selected')

    const number = document.createElement('span')
    number.className = 'waypoint-number'
    number.textContent = String(index + 1)

    const name = document.createElement('input')
    name.className = 'waypoint-name'
    name.value = waypoint.name
    name.placeholder = `Punkt ${index + 1}`
    name.setAttribute('aria-label', `Name von Punkt ${index + 1}`)
    name.addEventListener('change', () => handlers.onRename(waypoint.id, name.value))
    name.addEventListener('focus', () => handlers.onSelect(waypoint.id))
    // Während getippt wird, darf die Zeile nicht unter der Maus weggezogen werden.
    name.addEventListener('pointerdown', () => {
      row.draggable = false
    })
    name.addEventListener('blur', () => {
      row.draggable = true
    })

    const meta = document.createElement('span')
    meta.className = 'waypoint-meta'
    const previous = project.waypoints[index - 1]
    const distance = previous
      ? ` · ${formatDistance(haversineMeters([previous.lon, previous.lat], [waypoint.lon, waypoint.lat]))} Luftlinie`
      : ''
    meta.textContent = `${formatLonLat([waypoint.lon, waypoint.lat])}${distance}`

    const actions = document.createElement('span')
    actions.className = 'waypoint-actions'
    actions.append(
      iconButton('▲', 'Nach oben', index === 0, () => handlers.onReorder(index, index - 1)),
      iconButton('▼', 'Nach unten', index === project.waypoints.length - 1, () =>
        handlers.onReorder(index, index + 1),
      ),
      iconButton('✕', 'Punkt entfernen', false, () => handlers.onRemove(waypoint.id)),
    )

    row.append(number, name, meta, actions)
    row.addEventListener('click', (event) => {
      if (event.target === row || event.target === meta || event.target === number) {
        handlers.onSelect(waypoint.id)
      }
    })

    row.addEventListener('dragstart', (event) => {
      dragFrom = index
      row.classList.add('is-dragging')
      event.dataTransfer?.setData('text/plain', String(index))
      if (event.dataTransfer) event.dataTransfer.effectAllowed = 'move'
    })
    row.addEventListener('dragend', () => {
      dragFrom = null
      row.classList.remove('is-dragging')
      for (const other of container.querySelectorAll('.is-drop-target')) {
        other.classList.remove('is-drop-target')
      }
    })
    row.addEventListener('dragover', (event) => {
      if (dragFrom === null || dragFrom === index) return
      event.preventDefault()
      if (event.dataTransfer) event.dataTransfer.dropEffect = 'move'
      row.classList.add('is-drop-target')
    })
    row.addEventListener('dragleave', () => row.classList.remove('is-drop-target'))
    row.addEventListener('drop', (event) => {
      event.preventDefault()
      row.classList.remove('is-drop-target')
      if (dragFrom !== null && dragFrom !== index) handlers.onReorder(dragFrom, index)
      dragFrom = null
    })

    return row
  }

  /**
   * @param {string} glyph
   * @param {string} label
   * @param {boolean} disabled
   * @param {() => void} onClick
   * @returns {HTMLButtonElement}
   */
  function iconButton(glyph, label, disabled, onClick) {
    const button = document.createElement('button')
    button.type = 'button'
    button.className = 'waypoint-button'
    button.textContent = glyph
    button.title = label
    button.setAttribute('aria-label', label)
    button.disabled = disabled
    button.addEventListener('click', (event) => {
      event.stopPropagation()
      onClick()
    })
    return button
  }

  return {
    /**
     * Baut die Liste neu auf.
     *
     * Dabei wird der Tastaturfokus gerettet: Wer gerade einen Namen tippt und
     * nebenher einen Marker verschiebt, soll nicht mitten im Wort das Feld
     * verlieren.
     *
     * @param {Project} project
     * @param {string | null} selectedId
     */
    render(project, selectedId) {
      const active = document.activeElement
      const focusedId =
        active instanceof HTMLInputElement && active.classList.contains('waypoint-name')
          ? (active.closest('.waypoint')?.getAttribute('data-waypoint-id') ?? null)
          : null
      const caret = active instanceof HTMLInputElement ? active.selectionStart : null

      container.replaceChildren()
      if (project.waypoints.length === 0) {
        const hint = document.createElement('p')
        hint.className = 'muted small'
        hint.textContent =
          'Noch keine Punkte. Klick auf die Karte setzt den ersten; weitere hängen sich hinten an.'
        container.append(hint)
        return
      }
      const list = document.createElement('ol')
      list.className = 'waypoints'
      for (const [index, waypoint] of project.waypoints.entries()) {
        list.append(renderRow(waypoint, index, project, selectedId))
      }
      container.append(list)

      if (focusedId !== null) {
        const field = container.querySelector(
          `.waypoint[data-waypoint-id="${CSS.escape(focusedId)}"] .waypoint-name`,
        )
        if (field instanceof HTMLInputElement) {
          field.focus()
          if (caret !== null) field.setSelectionRange(caret, caret)
        }
      }
    },

    /**
     * Hebt eine Zeile hervor, **ohne** die Liste neu zu bauen.
     *
     * Das ist kein Feinschliff, sondern nötig: Ein Neuaufbau beim Fokussieren
     * zerstört genau das Eingabefeld, in das gerade jemand klickt – die
     * Umbenennung käme nie an.
     *
     * @param {string | null} selectedId
     */
    setSelected(selectedId) {
      for (const row of container.querySelectorAll('.waypoint')) {
        row.classList.toggle('is-selected', row.getAttribute('data-waypoint-id') === selectedId)
      }
    },
  }
}
