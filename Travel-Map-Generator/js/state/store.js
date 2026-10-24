/**
 * Ein sehr kleiner Zustandsspeicher: hält das aktuelle Projekt und sagt
 * Bescheid, wenn es sich geändert hat.
 *
 * Absichtlich klein gehalten. Weil alle Operationen in `core/model.js` ein
 * neues Projekt zurückgeben, genügt hier ein Wert plus Zuhörerliste – und
 * Undo/Redo (M9) wird später eine Liste solcher Werte.
 *
 * @template T
 * @param {T} initial
 */
export function createStore(initial) {
  let state = initial
  /** @type {Set<(state: T) => void>} */
  const listeners = new Set()

  return {
    /** @returns {T} */
    get: () => state,

    /** @param {T} next */
    set(next) {
      if (next === state) return
      state = next
      for (const listener of listeners) listener(state)
    },

    /** @param {(state: T) => T} change */
    update(change) {
      this.set(change(state))
    },

    /**
     * @param {(state: T) => void} listener
     * @returns {() => void} Abmelden
     */
    subscribe(listener) {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
  }
}

/**
 * Ruft `action` erst auf, wenn `wait` Millisekunden lang nichts mehr kam.
 * Für das automatische Speichern: nicht bei jedem Mausziehen schreiben.
 *
 * @template {unknown[]} A
 * @param {(...args: A) => void} action
 * @param {number} wait
 * @returns {((...args: A) => void) & {flush: () => void}}
 */
export function debounce(action, wait) {
  /** @type {ReturnType<typeof setTimeout> | undefined} */
  let timer
  /** @type {A | undefined} */
  let pending

  const run = (/** @type {A} */ ...args) => {
    pending = args
    clearTimeout(timer)
    timer = setTimeout(() => {
      timer = undefined
      const args2 = pending
      pending = undefined
      if (args2) action(...args2)
    }, wait)
  }
  // Vor dem Schließen des Tabs muss der letzte Stand noch raus.
  run.flush = () => {
    if (timer === undefined) return
    clearTimeout(timer)
    timer = undefined
    const args = pending
    pending = undefined
    if (args) action(...args)
  }
  return run
}
