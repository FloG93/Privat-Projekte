import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  SCHEMA_VERSION,
  addWaypoint,
  createProject,
  migrateProject,
  moveWaypoint,
  removeWaypoint,
  renameWaypoint,
  reorderWaypoints,
  routeLengthMeters,
  routeLine,
  setTitle,
  validateProject,
} from '../js/core/model.js'

/**
 * Eine Reise mit benannten Punkten – Grundlage der meisten Tests hier.
 * @param {string[]} names
 */
function tripWith(names) {
  let project = createProject({ title: 'Probe' })
  names.forEach((name, index) => {
    project = addWaypoint(project, { lon: 13 + index, lat: 52 - index, name })
  })
  return project
}

/** @param {import('../js/core/model.js').Project} project */
const names = (project) => project.waypoints.map((waypoint) => waypoint.name)

describe('createProject', () => {
  it('legt ein leeres, gültiges Projekt an', () => {
    const project = createProject()
    assert.equal(project.schemaVersion, SCHEMA_VERSION)
    assert.deepEqual(project.waypoints, [])
    assert.deepEqual(project.legs, [])
    assert.doesNotThrow(() => validateProject(project))
  })

  it('vergibt für jedes Projekt eine eigene Kennung', () => {
    assert.notEqual(createProject().id, createProject().id)
  })
})

describe('Zusage: eine Etappe weniger als Punkte', () => {
  it('gilt beim Anlegen', () => {
    for (let count = 0; count <= 4; count += 1) {
      const project = tripWith(Array.from({ length: count }, (_, i) => `P${i}`))
      assert.equal(project.legs.length, Math.max(count - 1, 0), `bei ${count} Punkten`)
    }
  })

  it('gilt nach dem Entfernen', () => {
    const project = tripWith(['A', 'B', 'C'])
    const first = project.waypoints[0]
    assert.ok(first)
    const smaller = removeWaypoint(project, first.id)
    assert.equal(smaller.waypoints.length, 2)
    assert.equal(smaller.legs.length, 1)
    assert.doesNotThrow(() => validateProject(smaller))
  })

  it('gilt auch, wenn der letzte Punkt verschwindet', () => {
    const project = tripWith(['A'])
    const waypoint = project.waypoints[0]
    assert.ok(waypoint)
    const empty = removeWaypoint(project, waypoint.id)
    assert.deepEqual(empty.waypoints, [])
    assert.deepEqual(empty.legs, [])
  })
})

describe('Operationen verändern das übergebene Projekt nicht', () => {
  it('addWaypoint lässt das Original in Ruhe', () => {
    const before = tripWith(['A'])
    const snapshot = JSON.stringify(before)
    addWaypoint(before, { lon: 1, lat: 1 })
    assert.equal(JSON.stringify(before), snapshot)
  })

  it('reorderWaypoints lässt das Original in Ruhe', () => {
    const before = tripWith(['A', 'B'])
    const snapshot = JSON.stringify(before)
    reorderWaypoints(before, 0, 1)
    assert.equal(JSON.stringify(before), snapshot)
  })
})

describe('addWaypoint', () => {
  it('hängt hinten an und bringt Koordinaten in den gültigen Bereich', () => {
    const project = addWaypoint(createProject(), { lon: 190, lat: 95, name: 'Jenseits' })
    const waypoint = project.waypoints[0]
    assert.ok(waypoint)
    assert.equal(waypoint.lon, -170)
    assert.ok(waypoint.lat < 86 && waypoint.lat > 85)
  })

  it('erlaubt Punkte ohne Namen', () => {
    const project = addWaypoint(createProject(), { lon: 13, lat: 52 })
    assert.equal(project.waypoints[0]?.name, '')
  })
})

describe('moveWaypoint', () => {
  it('verschiebt und verwirft die Verläufe der Nachbaretappen', () => {
    let project = tripWith(['A', 'B', 'C'])
    // Verläufe vortäuschen, wie sie ab M2 vom Routing kommen.
    project = {
      ...project,
      legs: project.legs.map((leg) => ({ ...leg, geometry: [[0, 0], [1, 1]] })),
    }
    const middle = project.waypoints[1]
    assert.ok(middle)
    const moved = moveWaypoint(project, middle.id, { lon: 9, lat: 48 })

    assert.equal(moved.waypoints[1]?.lon, 9)
    assert.equal(moved.legs[0]?.geometry, null, 'Etappe davor muss neu berechnet werden')
    assert.equal(moved.legs[1]?.geometry, null, 'Etappe danach muss neu berechnet werden')
  })

  it('meldet einen unbekannten Punkt, statt still nichts zu tun', () => {
    assert.throws(() => moveWaypoint(tripWith(['A']), 'gibt-es-nicht', { lon: 0, lat: 0 }), /Unbekannter Wegpunkt/)
  })
})

describe('renameWaypoint', () => {
  it('schneidet Leerraum ab', () => {
    const project = tripWith(['A'])
    const waypoint = project.waypoints[0]
    assert.ok(waypoint)
    assert.equal(renameWaypoint(project, waypoint.id, '  Bastei  ').waypoints[0]?.name, 'Bastei')
  })
})

describe('reorderWaypoints', () => {
  it('schiebt einen Punkt nach vorne', () => {
    const project = reorderWaypoints(tripWith(['A', 'B', 'C']), 2, 0)
    assert.deepEqual(names(project), ['C', 'A', 'B'])
  })

  it('schiebt einen Punkt nach hinten', () => {
    const project = reorderWaypoints(tripWith(['A', 'B', 'C']), 0, 2)
    assert.deepEqual(names(project), ['B', 'C', 'A'])
  })

  it('gibt bei gleicher Position dasselbe Projekt zurück', () => {
    const project = tripWith(['A', 'B'])
    assert.equal(reorderWaypoints(project, 1, 1), project)
  })

  it('wehrt sich gegen Positionen außerhalb der Reise', () => {
    const project = tripWith(['A', 'B'])
    assert.throws(() => reorderWaypoints(project, 0, 5), /außerhalb/)
    assert.throws(() => reorderWaypoints(project, -1, 0), /außerhalb/)
  })
})

describe('routeLine und Länge', () => {
  it('reiht die Wegpunkte in ihrer Reihenfolge auf', () => {
    const project = tripWith(['A', 'B'])
    assert.deepEqual(routeLine(project), [
      [13, 52],
      [14, 51],
    ])
  })

  it('legt den berechneten Verlauf einer Etappe dazwischen', () => {
    let project = tripWith(['A', 'B'])
    const leg = project.legs[0]
    assert.ok(leg)
    project = {
      ...project,
      legs: [{ ...leg, geometry: [[13, 52], [13.5, 51.5], [14, 51]] }],
    }
    assert.deepEqual(routeLine(project), [
      [13, 52],
      [13.5, 51.5],
      [14, 51],
    ])
  })

  it('ist für ein leeres Projekt null Meter lang', () => {
    assert.equal(routeLengthMeters(createProject()), 0)
  })
})

describe('setTitle', () => {
  it('weicht bei leerem Titel auf einen Standard aus', () => {
    assert.equal(setTitle(createProject(), '   ').title, 'Neue Reise')
  })
})

describe('validateProject', () => {
  const valid = () => JSON.parse(JSON.stringify(tripWith(['A', 'B'])))

  it('nimmt ein gültiges Projekt an', () => {
    assert.doesNotThrow(() => validateProject(valid()))
  })

  it('lehnt ab, was gar kein Projekt ist', () => {
    assert.throws(() => validateProject(null), /kein Projekt/)
    assert.throws(() => validateProject([]), /kein Projekt/)
    assert.throws(() => validateProject('{}'), /kein Projekt/)
  })

  it('merkt, wenn Etappen und Punkte nicht zusammenpassen', () => {
    const broken = valid()
    broken.legs = []
    assert.throws(() => validateProject(broken), /Etappen/)
  })

  it('merkt eine fehlende Koordinate', () => {
    const broken = valid()
    delete broken.waypoints[1].lat
    assert.throws(() => validateProject(broken), /Koordinate/)
  })

  it('merkt einen fehlenden Kartenstil', () => {
    const broken = valid()
    delete broken.style
    assert.throws(() => validateProject(broken), /Kartenstil/)
  })
})

describe('migrateProject', () => {
  it('lässt ein Projekt der aktuellen Fassung durch', () => {
    const project = JSON.parse(JSON.stringify(tripWith(['A', 'B'])))
    assert.equal(migrateProject(project).id, project.id)
  })

  it('lehnt eine Datei aus der Zukunft ab, statt Felder zu verlieren', () => {
    const future = JSON.parse(JSON.stringify(tripWith(['A'])))
    future.schemaVersion = SCHEMA_VERSION + 1
    assert.throws(() => migrateProject(future), /neueren Fassung/)
  })

  it('lehnt eine Datei ohne brauchbare Fassungsangabe ab', () => {
    assert.throws(() => migrateProject({ schemaVersion: 'eins' }), /Schema-Fassung/)
    assert.throws(() => migrateProject({}), /Schema-Fassung/)
  })
})
