/**
 * Gemeinsame Typen der Oberfläche (nur JSDoc, kein Code).
 *
 * @typedef {import('../model.js').Project} Project
 * @typedef {import('../model.js').AppState} AppState
 *
 * Ändert Projekt oder Zustand, speichert und zeichnet neu.
 * @typedef {(mutator: (project: Project, state: AppState) => void) => void} Commit
 *
 * @typedef {object} RoomUi
 * @property {{ row: number, col: number } | null} selected  ausgewählte Zelle
 * @property {string | null} freeLabel  gewählter Chip für einen freien Punkt
 * @property {'raw' | 'h' | 'both'} show
 *
 * @typedef {object} Ui
 * @property {Set<string>} open  aufgeklappte <details>
 * @property {(roomId: string) => RoomUi} roomUi
 */
export {}
