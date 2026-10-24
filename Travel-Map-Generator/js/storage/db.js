/**
 * Projekte in IndexedDB – alles bleibt im Browser, nichts geht ins Netz.
 *
 * IndexedDB statt `localStorage`, weil dort ab M6 auch Fotos und Videos als
 * Blob liegen; `localStorage` kann nur Text und ist auf wenige Megabyte
 * begrenzt.
 */

const DB_NAME = 'travel-map-generator'
const DB_VERSION = 1
const STORE_PROJECTS = 'projects'
/** Welches Projekt zuletzt offen war – klein genug für localStorage. */
const LAST_PROJECT_KEY = 'travel-map-generator.lastProject'

/** @typedef {import('../core/model.js').Project} Project */

/** @type {Promise<IDBDatabase> | null} */
let connection = null

/** @returns {Promise<IDBDatabase>} */
function openDatabase() {
  if (connection) return connection
  connection = new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION)
    request.onupgradeneeded = () => {
      const db = request.result
      if (!db.objectStoreNames.contains(STORE_PROJECTS)) {
        const store = db.createObjectStore(STORE_PROJECTS, { keyPath: 'id' })
        store.createIndex('updatedAt', 'updatedAt')
      }
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () =>
      reject(new Error(`Projektspeicher lässt sich nicht öffnen: ${request.error?.message ?? ''}`))
    request.onblocked = () =>
      reject(new Error('Projektspeicher ist von einem anderen Tab belegt. Bitte den schließen.'))
  })
  return connection
}

/**
 * @template T
 * @param {IDBTransactionMode} mode
 * @param {(store: IDBObjectStore) => IDBRequest} run
 * @returns {Promise<T>}
 */
async function withStore(mode, run) {
  const db = await openDatabase()
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_PROJECTS, mode)
    const request = run(transaction.objectStore(STORE_PROJECTS))
    request.onsuccess = () => resolve(request.result)
    transaction.onerror = () =>
      reject(new Error(`Zugriff auf den Projektspeicher fehlgeschlagen: ${transaction.error?.message ?? ''}`))
    transaction.onabort = () =>
      reject(new Error('Der Browser hat den Schreibvorgang abgebrochen – vermutlich ist kein Platz mehr frei.'))
  })
}

/**
 * @param {Project} project
 * @returns {Promise<void>}
 */
export async function saveProject(project) {
  // Strukturiertes Klonen verträgt keine Proxys oder Funktionen; der Umweg
  // über JSON stellt sicher, dass nur reine Daten in der Datenbank landen.
  const plain = JSON.parse(JSON.stringify(project))
  await withStore('readwrite', (store) => store.put(plain))
}

/**
 * @param {string} id
 * @returns {Promise<unknown>} Rohdaten; die Prüfung macht `migrateProject`.
 */
export function loadProject(id) {
  return withStore('readonly', (store) => store.get(id))
}

/**
 * @param {string} id
 * @returns {Promise<void>}
 */
export async function deleteProject(id) {
  await withStore('readwrite', (store) => store.delete(id))
  if (lastProjectId() === id) rememberLastProject(null)
}

/**
 * Kurzinfo zu allen gespeicherten Projekten, neuestes zuerst.
 * @returns {Promise<{id: string, title: string, updatedAt: string, waypointCount: number}[]>}
 */
export async function listProjects() {
  /** @type {unknown[]} */
  const all = await withStore('readonly', (store) => store.getAll())
  return all
    .map((entry) => {
      const project = /** @type {Project} */ (entry)
      return {
        id: project.id,
        title: project.title,
        updatedAt: project.updatedAt,
        waypointCount: project.waypoints?.length ?? 0,
      }
    })
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
}

/** @returns {string | null} */
export function lastProjectId() {
  try {
    return localStorage.getItem(LAST_PROJECT_KEY)
  } catch {
    return null
  }
}

/** @param {string | null} id */
export function rememberLastProject(id) {
  try {
    if (id === null) localStorage.removeItem(LAST_PROJECT_KEY)
    else localStorage.setItem(LAST_PROJECT_KEY, id)
  } catch {
    // Privates Fenster: Dann beginnt der nächste Besuch eben mit einem leeren
    // Projekt. Kein Grund, die App anzuhalten.
  }
}
