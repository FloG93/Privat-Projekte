'use strict';

/* ─────────────────────────────────────────────────────────────
 * Raumrechner — Raum-, Decken- und Bodenflächen berechnen,
 * Grundriss zeichnen, Angebot exportieren.
 *
 * Vanilla JS, no build step, offline-capable (see sw.js).
 * Geometry/area engine below mirrors the working calculation
 * logic from the approved design draft (Raumrechner.dc.html).
 * ───────────────────────────────────────────────────────────── */

const STORAGE_KEY = 'raumrechner.v2';
const LEGACY_KEY = 'raumrechner.v1';

const DIRS = [[1, 0], [0, 1], [-1, 0], [0, -1]];
const DIRNAME = ['Nord', 'Ost', 'Süd', 'West'];
const PRESETS = [
  { key: 'fenster', label: 'Fenster', w: 1.20, h: 1.30, color: '#5BA8F0' },
  { key: 'tuer', label: 'Zimmertür', w: 0.885, h: 2.01, color: '#5BD6A0' },
  { key: 'terrasse', label: 'Terrassentür', w: 1.00, h: 2.10, color: '#5BD6A0' },
  { key: 'frei', label: 'Freie Fläche', w: 1.00, h: 1.00, color: '#6f7682' },
];

/* A fresh or reset room starts genuinely empty: four walls at zero length,
 * so every area reads 0,0 m² until measurements are entered. Pre-filling a
 * 4×3 m room made "reset" look like it had done nothing. */
const EMPTY_WALLS = [0, 0, 0, 0];
const DEFAULT_HEIGHT = 2.50;
const DEFAULT_PRICE = 12.5;

let uid = Date.now();
const nid = () => ++uid;
const nf = (v, d = 2) => (isFinite(v) ? v : 0).toLocaleString('de-DE', { minimumFractionDigits: d, maximumFractionDigits: d });

/* Plain German decimal for input fields — deliberately without thousands
 * separators, so what is shown always parses back unambiguously. */
const inputNum = v => (isFinite(v) ? String(Math.round(v * 1000) / 1000).replace('.', ',') : '');

/* Accepts what a German keyboard actually produces. A number input used to
 * swallow the comma outright, turning "2,75" into 275. */
function parseNum(raw, fallback) {
  let t = String(raw).trim().replace(/\s/g, '');
  if (t.includes(',')) t = t.replace(/\./g, '').replace(',', '.');
  const v = parseFloat(t);
  return isFinite(v) ? v : fallback;
}

function formatDateDE(d) {
  const p = n => String(n).padStart(2, '0');
  return `${p(d.getDate())}.${p(d.getMonth() + 1)}.${d.getFullYear()}`;
}

function mkRoom(name, lens, height) {
  return {
    id: nid(), name, height,
    walls: (lens || EMPTY_WALLS).map(l => ({ id: nid(), len: l, turn: 'r' })),
    openings: [], photos: [], note: '',
  };
}

function mkProject(name, height, price) {
  const room = mkRoom('Raum 1', EMPTY_WALLS, height || DEFAULT_HEIGHT);
  return {
    id: nid(),
    name: name || 'Neues Projekt',
    date: formatDateDE(new Date()),
    price: price == null ? DEFAULT_PRICE : price,
    defaultHeight: height || DEFAULT_HEIGHT,
    activeRoomId: room.id,
    rooms: [room],
  };
}

function demoProject() {
  const r1 = mkRoom('Wohnzimmer', [5.20, 4.10, 5.20, 4.10], 2.55);
  r1.openings = [
    { id: nid(), key: 'fenster', label: 'Fenster', w: 1.40, h: 1.35, count: 2, wall: 0, offset: 0.80, color: '#5BA8F0' },
    { id: nid(), key: 'terrasse', label: 'Terrassentür', w: 1.80, h: 2.10, count: 1, wall: 1, offset: 1.20, color: '#5BD6A0' },
    { id: nid(), key: 'tuer', label: 'Zimmertür', w: 0.885, h: 2.01, count: 1, wall: 2, offset: 0.60, color: '#5BD6A0' },
  ];
  const rooms = [r1, mkRoom('Schlafzimmer', [4.00, 3.40, 4.00, 3.40], 2.55), mkRoom('Flur', [3.60, 1.30, 3.60, 1.30], 2.55)];
  return {
    id: nid(), name: 'Beispielprojekt', date: formatDateDE(new Date()),
    price: DEFAULT_PRICE, defaultHeight: 2.55,
    activeRoomId: r1.id, rooms,
  };
}

function defaultState() {
  const p = demoProject();
  return { schema: 2, tab: 'projekt', activeProjectId: p.id, projects: [p] };
}

function normalizeRoom(r) {
  return {
    id: r.id == null ? nid() : r.id,
    name: r.name || 'Raum',
    height: isFinite(r.height) ? r.height : DEFAULT_HEIGHT,
    walls: Array.isArray(r.walls) && r.walls.length ? r.walls : mkRoom('x').walls,
    openings: Array.isArray(r.openings) ? r.openings : [],
    photos: Array.isArray(r.photos) ? r.photos : [],
    note: r.note || '',
  };
}

/* v1 kept one project inline and a price on every room; fold that into the
 * project shape rather than making the user start over. */
function migrateV1(old) {
  if (!old || !Array.isArray(old.rooms) || !old.rooms.length) return null;
  const rooms = old.rooms.map(normalizeRoom);
  const project = {
    id: nid(),
    name: old.projectName || 'Mein Projekt',
    date: old.projectDate || formatDateDE(new Date()),
    price: isFinite(old.rooms[0].price) ? old.rooms[0].price : DEFAULT_PRICE,
    defaultHeight: rooms[0].height,
    activeRoomId: old.activeId != null && rooms.some(r => r.id === old.activeId) ? old.activeId : rooms[0].id,
    rooms,
  };
  return { schema: 2, tab: old.tab || 'projekt', activeProjectId: project.id, projects: [project] };
}

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && Array.isArray(parsed.projects) && parsed.projects.length) {
        parsed.projects = parsed.projects.map(pr => ({
          ...pr,
          price: isFinite(pr.price) ? pr.price : DEFAULT_PRICE,
          defaultHeight: isFinite(pr.defaultHeight) ? pr.defaultHeight : DEFAULT_HEIGHT,
          rooms: (Array.isArray(pr.rooms) && pr.rooms.length ? pr.rooms : [mkRoom('Raum 1', EMPTY_WALLS, DEFAULT_HEIGHT)]).map(normalizeRoom),
        }));
        return parsed;
      }
    }
    const legacy = localStorage.getItem(LEGACY_KEY);
    if (legacy) return migrateV1(JSON.parse(legacy));
    return null;
  } catch {
    return null;
  }
}

let state = loadState() || defaultState();
let flashTimer = null;
let storageFailed = false;
let undoEntry = null;

function save() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    storageFailed = false;
  } catch {
    // Quota or private mode: the app keeps running in memory, but the user
    // needs to know the project is no longer being kept.
    storageFailed = true;
  }
}

function setState(updater) {
  const patch = typeof updater === 'function' ? updater(state) : updater;
  state = Object.assign({}, state, patch);
  save();
  render();
}

/* ─── project / room access ─── */

function getProject() {
  return state.projects.find(p => p.id === state.activeProjectId) || state.projects[0];
}

function getActiveRoom() {
  const p = getProject();
  if (!p) return null;
  return p.rooms.find(r => r.id === p.activeRoomId) || p.rooms[0];
}

function patchProject(fn) {
  const p = getProject();
  if (!p) return;
  setState(s => ({ projects: s.projects.map(x => (x.id === p.id ? fn({ ...x }) : x)) }));
}

function patchRoom(fn) {
  const room = getActiveRoom();
  if (!room) return;
  const id = room.id;
  patchProject(p => ({ ...p, rooms: p.rooms.map(r => (r.id === id ? fn({ ...r }) : r)) }));
}

/* ─── undo ─── */

/* One snapshot deep enough to put back anything a single destructive action
 * removed. Photos stay in IndexedDB until the orphan sweep on next start, so
 * restoring a deleted room brings its pictures back too. */
function snapshot(label) {
  undoEntry = { label, state: JSON.parse(JSON.stringify(state)) };
}

function undoLast() {
  if (!undoEntry) return;
  state = undoEntry.state;
  undoEntry = null;
  save();
  flash('Rückgängig gemacht.');
}

/* The toast lives outside the app's DOM and outside its state. It used to be
 * part of state, so its dismissal timer re-rendered everything four seconds
 * later — wiping out whatever field the user was typing in at the time. */
let toast = null;
let toastNode = null;

function renderToast() {
  if (!toastNode) {
    toastNode = el('div', { class: 'toast-host' });
    document.body.appendChild(toastNode);
  }
  toastNode.innerHTML = '';
  if (!toast) { toastNode.hidden = true; return; }
  toastNode.hidden = false;
  toastNode.appendChild(el('div', { class: 'toast' }, [
    el('span', {}, toast.msg),
    toast.undo && undoEntry ? el('button', { class: 'toast-undo', onClick: undoLast }, 'Rückgängig') : null,
  ]));
}

function flash(msg, opts) {
  toast = { msg, undo: !!(opts && opts.undo) };
  renderToast();
  clearTimeout(flashTimer);
  flashTimer = setTimeout(() => { toast = null; renderToast(); }, toast.undo ? 8000 : 4000);
}

/* ─── room actions ─── */

function addRoom() {
  const p = getProject();
  const r = mkRoom('Raum ' + (p.rooms.length + 1), EMPTY_WALLS, p.defaultHeight);
  patchProject(pr => ({ ...pr, rooms: [...pr.rooms, r], activeRoomId: r.id }));
  setState({ tab: 'raum' });
  flash('Neuer Raum angelegt.');
}

/* Back to a blank room, keeping only the name — for the common case of
 * having mistyped your way into a mess and wanting a clean sheet. */
function resetRoom(id) {
  const p = getProject();
  const room = p.rooms.find(r => r.id === id);
  if (!room) return;
  snapshot('reset-room');
  // Everything to zero except the name and the project's standard height.
  const fresh = mkRoom(room.name, EMPTY_WALLS, p.defaultHeight);
  fresh.id = room.id;
  patchProject(pr => ({ ...pr, rooms: pr.rooms.map(r => (r.id === id ? fresh : r)) }));
  flash('„' + room.name + '" zurückgesetzt.', { undo: true });
}

function duplicateRoom(id) {
  const p = getProject();
  const room = p.rooms.find(r => r.id === id);
  if (!room) return;
  const copy = {
    ...JSON.parse(JSON.stringify(room)),
    id: nid(),
    name: room.name + ' (Kopie)',
    walls: room.walls.map(w => ({ ...w, id: nid() })),
    openings: room.openings.map(o => ({ ...o, id: nid() })),
    photos: [],   // pictures belong to the room they were taken in
  };
  const at = p.rooms.findIndex(r => r.id === id) + 1;
  patchProject(pr => {
    const rooms = [...pr.rooms];
    rooms.splice(at, 0, copy);
    return { ...pr, rooms, activeRoomId: copy.id };
  });
  flash('Raum dupliziert.');
}

function deleteRoom(id) {
  const p = getProject();
  if (p.rooms.length <= 1) { flash('Der letzte Raum lässt sich nicht löschen — nutze „Zurücksetzen".'); return; }
  const room = p.rooms.find(r => r.id === id);
  if (!room) return;
  snapshot('delete-room');
  patchProject(pr => {
    const rooms = pr.rooms.filter(r => r.id !== id);
    return { ...pr, rooms, activeRoomId: pr.activeRoomId === id ? rooms[0].id : pr.activeRoomId };
  });
  flash('„' + room.name + '" gelöscht.', { undo: true });
}

function selectRoom(id) {
  patchProject(p => ({ ...p, activeRoomId: id }));
  setState({ tab: 'raum' });
}

/* ─── project actions ─── */

function addProject() {
  const p = getProject();
  const np = mkProject('Projekt ' + (state.projects.length + 1), p ? p.defaultHeight : DEFAULT_HEIGHT, p ? p.price : DEFAULT_PRICE);
  setState(s => ({ projects: [...s.projects, np], activeProjectId: np.id, tab: 'projekt' }));
  flash('Neues Projekt angelegt.');
}

/* Empties the project back to a single blank room but keeps its name, price
 * and standard height — the usual "same customer, start over" case. */
function resetProject() {
  const p = getProject();
  if (!p) return;
  snapshot('reset-project');
  const room = mkRoom('Raum 1', EMPTY_WALLS, p.defaultHeight);
  patchProject(pr => ({ ...pr, rooms: [room], activeRoomId: room.id, date: formatDateDE(new Date()) }));
  setState({ tab: 'projekt' });
  flash('Projekt zurückgesetzt.', { undo: true });
}

function deleteProject(id) {
  if (state.projects.length <= 1) { flash('Das letzte Projekt lässt sich nicht löschen — nutze „Zurücksetzen".'); return; }
  const pr = state.projects.find(p => p.id === id);
  if (!pr) return;
  snapshot('delete-project');
  setState(s => {
    const projects = s.projects.filter(p => p.id !== id);
    return { projects, activeProjectId: s.activeProjectId === id ? projects[0].id : s.activeProjectId };
  });
  flash('Projekt „' + pr.name + '" gelöscht.', { undo: true });
}

function selectProject(id) {
  setState({ activeProjectId: id, tab: 'projekt' });
}

/* ─── geometry / area engine ─── */

function geo(room) {
  let x = 0, y = 0, d = 0;
  const segs = [];
  room.walls.forEach((w, i) => {
    const [dx, dy] = DIRS[d];
    const len = Math.max(0, w.len || 0);
    const seg = { x1: x, y1: y, x2: x + dx * len, y2: y + dy * len, len, dir: d, nr: i + 1, label: DIRNAME[d], wall: w };
    segs.push(seg);
    x = seg.x2; y = seg.y2;
    d = (d + (w.turn === 'l' ? 3 : 1)) % 4;
  });
  const pts = segs.map(s => [s.x1, s.y1]);
  let sh = 0;
  for (let i = 0; i < pts.length; i++) { const p = pts[i], q = pts[(i + 1) % pts.length]; sh += p[0] * q[1] - q[0] * p[1]; }
  const floor = Math.abs(sh) / 2;
  const closed = segs.length > 0 && Math.abs(x) < 0.02 && Math.abs(y) < 0.02;
  return { segs, floor, closed };
}

function calc(room, price) {
  if (price == null) { const p = getProject(); price = p ? p.price : 0; }
  const g = geo(room);
  const umfang = g.segs.reduce((s, w) => s + w.len, 0);
  const brutto = umfang * (room.height || 0);
  const abzug = room.openings.reduce((s, o) => s + (o.w || 0) * (o.h || 0) * (o.count || 0), 0);
  const netto = Math.max(0, brutto - abzug);
  const decke = g.floor;
  const abrechnung = netto + decke;
  return { g, umfang, brutto, abzug, netto, decke, boden: g.floor, abrechnung, preis: abrechnung * (price || 0) };
}

function totals() {
  const project = getProject();
  return project.rooms.reduce((a, r) => {
    const c = calc(r, project.price);
    return { brutto: a.brutto + c.brutto, netto: a.netto + c.netto, abzug: a.abzug + c.abzug, decke: a.decke + c.decke, preis: a.preis + c.preis };
  }, { brutto: 0, netto: 0, abzug: 0, decke: 0, preis: 0 });
}

function plan(room, c) {
  const segs = c.g.segs;
  const xs = segs.flatMap(s => [s.x1, s.x2]), ys = segs.flatMap(s => [s.y1, s.y2]);
  const minX = Math.min(...xs, 0), maxX = Math.max(...xs, 0);
  const minY = Math.min(...ys, 0), maxY = Math.max(...ys, 0);
  const w = Math.max(0.5, maxX - minX), h = Math.max(0.5, maxY - minY);
  const pad = 40, W = 320, H = 300;
  const k = Math.min((W - pad * 2) / w, (H - pad * 2) / h);
  const ox = (W - w * k) / 2 - minX * k, oy = (H - h * k) / 2 - minY * k;
  const px = v => ox + v * k, py = v => oy + v * k;

  const planWalls = segs.map(s => ({ x1: px(s.x1), y1: py(s.y1), x2: px(s.x2), y2: py(s.y2) }));
  const planOpenings = [];
  room.openings.forEach(o => {
    const s = segs[o.wall];
    if (!s || !s.len) return;
    const [dx, dy] = DIRS[s.dir];
    const n = Math.max(1, o.count || 1);
    for (let i = 0; i < n; i++) {
      const a = Math.min(s.len, (o.offset || 0) + i * ((o.w || 0) + 0.4));
      const b = Math.min(s.len, a + (o.w || 0));
      if (b <= a) continue;
      planOpenings.push({
        x1: px(s.x1 + dx * a), y1: py(s.y1 + dy * a),
        x2: px(s.x1 + dx * b), y2: py(s.y1 + dy * b),
        color: o.color || '#6f7682',
      });
    }
  });
  const planLabels = segs.map(s => {
    const off = 18;
    const nx = s.dir === 1 ? off : s.dir === 3 ? -off : 0;
    const ny = s.dir === 0 ? -off : s.dir === 2 ? off : 0;
    return { x: px((s.x1 + s.x2) / 2) + nx, y: py((s.y1 + s.y2) / 2) + ny, text: nf(s.len) + ' m' };
  });
  const cx = segs.length ? px(segs.reduce((a, s) => a + (s.x1 + s.x2) / 2, 0) / segs.length) : 160;
  const cy = segs.length ? py(segs.reduce((a, s) => a + (s.y1 + s.y2) / 2, 0) / segs.length) : 150;
  return { planWalls, planOpenings, planLabels, cx, cy, scale: Math.round(100 / (k / 100) / 10) * 10 || 50 };
}

/* ─── export ─── */

function exportCsv() {
  const sep = ';';
  const lines = [['Raum', 'Hoehe m', 'Umfang m', 'Brutto m2', 'Abzuege m2', 'Netto m2', 'Decke m2', 'Boden m2', 'Preis/m2', 'Summe EUR'].join(sep)];
  const project = getProject();
  project.rooms.forEach(r => {
    const c = calc(r);
    lines.push([r.name, nf(r.height), nf(c.umfang), nf(c.brutto), nf(c.abzug), nf(c.netto), nf(c.decke), nf(c.boden), nf(project.price), nf(c.preis)].join(sep));
    r.openings.forEach(o => lines.push(['  Abzug: ' + o.label, '', '', nf(o.w) + ' x ' + nf(o.h), 'Anzahl ' + o.count, nf(o.w * o.h * o.count), '', '', '', ''].join(sep)));
  });
  const t = totals();
  lines.push(['Summe', '', '', nf(t.brutto), nf(t.abzug), nf(t.netto), nf(t.decke), '', '', nf(t.preis)].join(sep));
  const blob = new Blob(['﻿' + lines.join('\n')], { type: 'text/csv;charset=utf-8' });
  const a = document.createElement('a');
  const url = URL.createObjectURL(blob);
  a.href = url;
  a.download = 'Flaechen_' + project.name.replace(/[^\w]+/g, '_') + '.csv';
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
  flash('CSV heruntergeladen — in Excel mit Semikolon-Trennung öffnen.');
}

/* PDF comes out of the browser's own print-to-PDF: no library to ship, and
 * it is the one route that works the same on Android Chrome and desktop.
 * The sheet is built into #print-root, which only @media print reveals. */
async function exportPdf() {
  const btnLabel = 'Angebot wird aufbereitet …';
  flash(btnLabel);

  // window.print() is synchronous, so every photo has to be resolved out of
  // IndexedDB and fully decoded before the dialog opens — otherwise the PDF
  // gets blank boxes where the pictures should be.
  const photoUrls = new Map();
  for (const r of getProject().rooms) {
    for (const ph of (r.photos || [])) {
      photoUrls.set(ph.id, (await getPhoto(ph.id)) || ph.thumb);
    }
  }

  const root = document.getElementById('print-root');
  if (!root) { flash('Druckbereich fehlt — bitte Seite neu laden.'); return; }
  root.innerHTML = '';
  root.appendChild(buildPrintSheet(photoUrls));

  await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
  await Promise.all(Array.from(root.querySelectorAll('img')).map(img =>
    img.complete ? Promise.resolve() : new Promise(res => { img.onload = img.onerror = res; })
  ));

  window.print();
  flash('Im Druckdialog „Als PDF speichern" wählen.');
}

function printTile(label, value) {
  return el('div', { class: 'p-tile' }, [
    el('div', { class: 'p-tile-label' }, label),
    el('div', { class: 'p-tile-value' }, value),
  ]);
}

function printRow(cells, cls) {
  return el('div', { class: 'p-row' + (cls ? ' ' + cls : '') }, cells.map(c => el('div', {}, c)));
}

function buildPrintSheet(photoUrls) {
  const t = totals();
  const project = getProject();

  const cover = el('section', { class: 'p-page' }, [
    el('header', { class: 'p-head' }, [
      el('div', {}, [
        el('div', { class: 'p-title' }, 'Flächenaufstellung'),
        el('div', { class: 'p-project' }, project.name),
      ]),
      el('div', { class: 'p-date' }, project.date),
    ]),
    el('div', { class: 'p-tiles' }, [
      printTile('Netto-Wandfläche', nf(t.netto, 1) + ' m²'),
      printTile('Brutto-Wandfläche', nf(t.brutto, 1) + ' m²'),
      printTile('Deckenfläche', nf(t.decke, 1) + ' m²'),
      printTile('Räume', String(project.rooms.length)),
    ]),
    el('div', { class: 'p-table' }, [
      printRow(['Raum', 'Brutto m²', 'Abzüge m²', 'Netto m²', 'Decke m²', 'Summe €'], 'p-row-head'),
      ...project.rooms.map(r => {
        const c = calc(r, project.price);
        return printRow([r.name, nf(c.brutto, 1), nf(c.abzug, 1), nf(c.netto, 1), nf(c.decke, 1), nf(c.preis)]);
      }),
      printRow(['Gesamt', nf(t.brutto, 1), nf(t.abzug, 1), nf(t.netto, 1), nf(t.decke, 1), nf(t.preis)], 'p-row-sum'),
    ]),
    el('div', { class: 'p-total' }, [
      el('div', { class: 'k' }, 'Gesamtsumme'),
      el('div', { class: 'v' }, nf(t.preis) + ' €'),
    ]),
    el('p', { class: 'p-legal' }, 'Netto = Brutto-Wandfläche abzüglich Fenster, Türen und freier Flächen. Abgerechnet werden Netto-Wandfläche und Deckenfläche. Alle Maße in Metern, Flächen in m². Angebot freibleibend.'),
  ]);

  const roomPages = project.rooms.map(room => {
    const c = calc(room, project.price);
    const p = plan(room, c);
    const hasMeasure = c.g.segs.some(seg => seg.len > 0);

    const masse = el('div', { class: 'p-table p-table-tight' }, [
      printRow(['Kennzahl', 'Wert'], 'p-row-head'),
      printRow(['Raumhöhe', nf(room.height) + ' m']),
      printRow(['Umfang', nf(c.umfang) + ' m']),
      printRow(['Brutto-Wandfläche', nf(c.brutto, 2) + ' m²']),
      printRow(['Abzüge', '− ' + nf(c.abzug, 2) + ' m²']),
      printRow(['Netto-Wandfläche', nf(c.netto, 2) + ' m²'], 'p-row-sum'),
      printRow(['Deckenfläche', nf(c.decke, 2) + ' m²']),
      printRow(['Bodenfläche', nf(c.boden, 2) + ' m²']),
      printRow(['Abrechenbar (Wand + Decke)', nf(c.abrechnung, 2) + ' m²']),
      printRow(['Preis pro m²', nf(project.price) + ' €']),
      printRow(['Summe', nf(c.preis) + ' €'], 'p-row-sum'),
    ]);

    const walls = el('div', { class: 'p-table p-table-tight' }, [
      printRow(['Wand', 'Länge × Höhe', 'Fläche'], 'p-row-head'),
      ...c.g.segs.map(sg => printRow([
        sg.label + ' · Wand ' + sg.nr,
        nf(sg.len) + ' × ' + nf(room.height) + ' m',
        nf(sg.len * room.height, 2) + ' m²',
      ])),
    ]);

    const openings = room.openings.length
      ? el('div', { class: 'p-table p-table-tight' }, [
          printRow(['Abzug', 'Maß', 'Anzahl', 'Fläche'], 'p-row-head'),
          ...room.openings.map(o => printRow([
            o.label,
            nf(o.w) + ' × ' + nf(o.h) + ' m',
            String(o.count),
            nf((o.w || 0) * (o.h || 0) * (o.count || 0), 2) + ' m²',
          ])),
        ])
      : el('p', { class: 'p-note' }, 'Keine Abzüge — netto entspricht brutto.');

    const photos = (room.photos || []).filter(ph => photoUrls.get(ph.id));

    return el('section', { class: 'p-page' }, [
      el('header', { class: 'p-head p-head-room' }, [
        el('div', {}, [
          el('div', { class: 'p-eyebrow' }, project.name),
          el('div', { class: 'p-title' }, room.name),
        ]),
        el('div', { class: 'p-date' }, nf(c.netto, 1) + ' m² netto'),
      ]),
      el('div', { class: 'p-two-col' }, [
        el('div', {}, [el('div', { class: 'p-sub' }, 'Maße und Kalkulation'), masse]),
        el('div', {}, [
          el('div', { class: 'p-sub' }, hasMeasure ? 'Grundriss · M 1:' + p.scale : 'Grundriss'),
          hasMeasure
            ? el('div', { class: 'p-plan' }, [planSvg(room, c, p, 'print')])
            : el('p', { class: 'p-note' }, 'Für diesen Raum sind noch keine Maße erfasst.'),
          hasMeasure ? el('div', { class: 'p-legend' }, [
            el('span', {}, [el('i', { style: { background: '#5BA8F0' } }), 'Fenster']),
            el('span', {}, [el('i', { style: { background: '#5BD6A0' } }), 'Tür']),
            el('span', {}, [el('i', { style: { background: '#6f7682' } }), 'Fläche']),
          ]) : null,
        ]),
      ]),
      el('div', { class: 'p-sub' }, 'Wände'),
      walls,
      el('div', { class: 'p-sub' }, 'Abzüge'),
      openings,
      room.note ? el('div', {}, [el('div', { class: 'p-sub' }, 'Notiz'), el('p', { class: 'p-note' }, room.note)]) : null,
      photos.length ? el('div', {}, [
        el('div', { class: 'p-sub' }, 'Fotos'),
        el('div', { class: 'p-photos' }, photos.map(ph =>
          el('img', { src: photoUrls.get(ph.id), alt: 'Foto ' + room.name })
        )),
      ]) : null,
    ]);
  });

  return el('div', { class: 'p-doc' }, [cover, ...roomPages]);
}

/* ─── photos ─── */

/* Full-size photos live in IndexedDB; localStorage keeps only the small
 * thumbnails. A handful of site photos as base64 would otherwise blow the
 * ~5 MB localStorage quota and take the whole project down with it. */

const PHOTO_DB = 'raumrechner';
const PHOTO_STORE = 'photos';
const photoCache = new Map();
let photoDbPromise = null;

function photoDb() {
  if (photoDbPromise) return photoDbPromise;
  photoDbPromise = new Promise((resolve, reject) => {
    if (!('indexedDB' in window)) { reject(new Error('IndexedDB nicht verfügbar')); return; }
    const req = indexedDB.open(PHOTO_DB, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(PHOTO_STORE)) db.createObjectStore(PHOTO_STORE);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error || new Error('IndexedDB konnte nicht geöffnet werden'));
  }).catch(err => { photoDbPromise = null; throw err; });
  return photoDbPromise;
}

function photoTx(mode, fn) {
  return photoDb().then(db => new Promise((resolve, reject) => {
    const tx = db.transaction(PHOTO_STORE, mode);
    const req = fn(tx.objectStore(PHOTO_STORE));
    tx.onerror = tx.onabort = () => reject(tx.error || new Error('Transaktion fehlgeschlagen'));
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  }));
}

async function putPhoto(id, dataUrl) {
  photoCache.set(id, dataUrl);
  try { await photoTx('readwrite', st => st.put(dataUrl, id)); return true; }
  catch { return false; }
}

async function getPhoto(id) {
  if (photoCache.has(id)) return photoCache.get(id);
  try {
    const v = await photoTx('readonly', st => st.get(id));
    if (v) photoCache.set(id, v);
    return v || null;
  } catch { return null; }
}

async function dropPhoto(id) {
  photoCache.delete(id);
  try { await photoTx('readwrite', st => st.delete(id)); } catch { /* best effort */ }
}

/* Decode via createImageBitmap where available so EXIF-rotated phone photos
 * come out upright; fall back to an <img> for older browsers. */
function decodeImage(file) {
  if ('createImageBitmap' in window) {
    return createImageBitmap(file, { imageOrientation: 'from-image' }).catch(() => decodeViaImg(file));
  }
  return decodeViaImg(file);
}

function decodeViaImg(file) {
  return new Promise((resolve, reject) => {
    const fr = new FileReader();
    fr.onload = () => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error('Bild konnte nicht gelesen werden'));
      img.src = fr.result;
    };
    fr.onerror = () => reject(new Error('Datei konnte nicht gelesen werden'));
    fr.readAsDataURL(file);
  });
}

function resizeToDataUrl(src, maxEdge, quality) {
  const sw = src.naturalWidth || src.width;
  const sh = src.naturalHeight || src.height;
  const k = Math.min(1, maxEdge / Math.max(sw, sh));
  const w = Math.max(1, Math.round(sw * k));
  const h = Math.max(1, Math.round(sh * k));
  const cv = document.createElement('canvas');
  cv.width = w; cv.height = h;
  cv.getContext('2d').drawImage(src, 0, 0, w, h);
  return { url: cv.toDataURL('image/jpeg', quality), w, h };
}

async function addPhotos(roomId, fileList) {
  const files = Array.from(fileList || []).filter(f => f && f.type && f.type.startsWith('image/'));
  if (!files.length) return;
  flash(files.length === 1 ? 'Foto wird verarbeitet …' : files.length + ' Fotos werden verarbeitet …');

  const added = [];
  let allPersisted = true;
  for (const file of files) {
    try {
      const bmp = await decodeImage(file);
      const full = resizeToDataUrl(bmp, 1600, 0.75);
      const thumb = resizeToDataUrl(bmp, 240, 0.6);
      if (bmp.close) bmp.close();
      const id = 'p' + nid();
      if (!(await putPhoto(id, full.url))) allPersisted = false;
      added.push({ id, thumb: thumb.url, w: full.w, h: full.h });
    } catch {
      allPersisted = false;
    }
  }

  if (!added.length) { flash('Foto konnte nicht verarbeitet werden.'); return; }
  patchProject(p => ({ ...p, rooms: p.rooms.map(r => (r.id === roomId ? { ...r, photos: [...(r.photos || []), ...added] } : r)) }));
  flash(allPersisted
    ? (added.length === 1 ? 'Foto hinzugefügt.' : added.length + ' Fotos hinzugefügt.')
    : 'Foto übernommen — konnte aber nicht dauerhaft gespeichert werden.');
}

function removePhoto(roomId, photoId) {
  // The blob stays in IndexedDB so undo can bring it back; the orphan sweep
  // on next start clears anything no project references any more.
  snapshot('delete-photo');
  patchProject(p => ({ ...p, rooms: p.rooms.map(r => (r.id === roomId ? { ...r, photos: (r.photos || []).filter(x => x.id !== photoId) } : r)) }));
  flash('Foto entfernt.', { undo: true });
}

let lightbox = null;

function openLightbox(photo) {
  lightbox = { id: photo.id, url: photo.thumb };
  render();
  getPhoto(photo.id).then(url => {
    if (lightbox && lightbox.id === photo.id && url) { lightbox.url = url; render(); }
  });
}

function closeLightbox() { lightbox = null; render(); }

/* ─── DOM helpers ─── */

function el(tag, attrs, children) {
  const node = document.createElement(tag);
  if (attrs) {
    for (const [k, v] of Object.entries(attrs)) {
      if (v == null || v === false) continue;
      if (k === 'class') node.className = v;
      else if (k === 'style' && typeof v === 'object') Object.assign(node.style, v);
      else if (k.startsWith('on') && typeof v === 'function') node.addEventListener(k.slice(2).toLowerCase(), v);
      else if (k in node) { try { node[k] = v; } catch { node.setAttribute(k, v); } }
      else node.setAttribute(k, v);
    }
  }
  if (children != null) {
    const arr = Array.isArray(children) ? children.flat(Infinity) : [children];
    for (const c of arr) {
      if (c == null || c === false) continue;
      node.appendChild(c instanceof Node ? c : document.createTextNode(String(c)));
    }
  }
  return node;
}

const SVGNS = 'http://www.w3.org/2000/svg';
function svgEl(tag, attrs, children) {
  const node = document.createElementNS(SVGNS, tag);
  if (attrs) for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, v);
  if (children != null) {
    const arr = Array.isArray(children) ? children : [children];
    for (const c of arr) if (c) node.appendChild(c);
  }
  return node;
}

/* ─── views ─── */

/* Fields carry a stable data-fkey so render() can put the caret back exactly
 * where it was; see restoreFocus below. */
function liveInput(cls, fkey, value, onInput, extra) {
  return el('input', Object.assign({
    class: cls, type: 'text', value, 'data-fkey': fkey,
    onInput: e => onInput(e.target.value),
  }, extra || {}));
}

/* Numeric field. Deliberately NOT type="number": that control drops the
 * comma a German keyboard produces, so "2,75" arrived as 275. text +
 * inputmode keeps the numeric keypad on Android and lets us parse both
 * separators ourselves. */
function numInput(value, onCommit, opts) {
  const o = opts || {};
  return el('input', {
    class: 'input mono', type: 'text', 'data-fkey': o.fkey || null,
    inputmode: o.integer ? 'numeric' : 'decimal',
    enterkeyhint: 'done',
    value: o.integer ? String(Math.round(value)) : inputNum(value),
    onFocus: e => e.target.select(),
    onChange: e => {
      const v = parseNum(e.target.value, value);
      onCommit(o.integer ? Math.max(o.min == null ? 1 : o.min, Math.round(v)) : v);
    },
  });
}

function renderHeader() {
  const tabs = [['projekt', 'Projekt'], ['raum', 'Raum'], ['plan', 'Grundriss'], ['export', 'Export']];
  const project = getProject();
  return el('div', { class: 'header' }, [
    el('div', { class: 'header-row' }, [
      el('div', { class: 'header-main' }, [
        el('div', { class: 'eyebrow' }, 'Projekt'),
        liveInput('project-name-input', 'proj-name', project.name, v => patchProject(p => ({ ...p, name: v })),
          { placeholder: 'Projektname', 'aria-label': 'Projektname' }),
      ]),
      liveInput('project-date-input', 'proj-date', project.date, v => patchProject(p => ({ ...p, date: v })),
        { placeholder: 'Datum', 'aria-label': 'Datum' }),
    ]),
    el('div', { class: 'tabbar' }, tabs.map(([k, label]) =>
      el('button', {
        class: 'tab-btn' + (state.tab === k ? ' active' : ''),
        onClick: () => setState({ tab: k }),
      }, label)
    )),
  ]);
}

function renderProjektView() {
  const t = totals();
  const project = getProject();
  const active = getActiveRoom();

  const hero = el('div', { class: 'card hero' }, [
    el('div', { class: 'card-title' }, 'Summe Projekt'),
    el('div', { class: 'big-stat', style: { marginTop: '14px' } }, [
      el('div', { class: 'num' }, nf(t.netto, 1)),
      el('div', { class: 'unit' }, 'm² netto Wand'),
    ]),
    el('div', { class: 'sub-line' }, `brutto ${nf(t.brutto, 1)} m² · Abzüge ${nf(t.abzug, 1)} m²`),
    el('div', { class: 'tile-grid' }, [
      el('div', { class: 'tile' }, [el('div', { class: 'tile-label' }, 'Decke'), el('div', { class: 'tile-value' }, nf(t.decke, 1) + ' m²')]),
      el('div', { class: 'tile' }, [el('div', { class: 'tile-label' }, 'Räume'), el('div', { class: 'tile-value' }, String(project.rooms.length))]),
    ]),
    el('div', { class: 'tile-row' }, [
      el('div', { class: 'k' }, 'Summe'),
      el('div', { class: 'v' }, nf(t.preis) + ' €'),
    ]),
  ]);

  const list = el('div', { class: 'room-list' },
    project.rooms.map(r => {
      const rc = calc(r, project.price);
      return el('div', { class: 'room-card' + (active && r.id === active.id ? ' active' : '') }, [
        el('button', { class: 'room-open', onClick: () => selectRoom(r.id) }, [
          el('div', { class: 'info' }, [
            el('div', { class: 'name' }, r.name),
            el('div', { class: 'meta' }, `${r.walls.length} Wände · ${nf(r.height)} m hoch · ${r.openings.length} Abzüge`),
          ]),
          el('div', { class: 'amounts' }, [
            el('div', { class: 'netto' }, nf(rc.netto, 1)),
            el('div', { class: 'brutto' }, nf(rc.brutto, 1) + ' m² brutto'),
          ]),
          el('div', { class: 'chevron' }, '›'),
        ]),
        el('div', { class: 'room-actions' }, [
          el('button', { class: 'mini-btn', onClick: () => duplicateRoom(r.id) }, 'Duplizieren'),
          el('button', { class: 'mini-btn', onClick: () => resetRoom(r.id) }, 'Zurücksetzen'),
          el('button', {
            class: 'mini-btn danger' + (project.rooms.length <= 1 ? ' off' : ''),
            onClick: () => deleteRoom(r.id),
          }, 'Löschen'),
        ]),
      ]);
    })
  );

  const projectCard = el('div', { class: 'card' }, [
    el('div', { class: 'card-title' }, 'Projekt'),
    el('div', { class: 'card-row', style: { marginTop: '12px' } }, [
      state.projects.length > 1 ? el('label', { class: 'field' }, [
        el('span', { class: 'field-label' }, 'Aktives Projekt'),
        el('select', { class: 'input', 'data-fkey': 'proj-select', onChange: e => selectProject(Number(e.target.value)) },
          state.projects.map(p => el('option', { value: String(p.id), selected: p.id === project.id }, p.name))),
      ]) : null,
      el('div', { class: 'field-pair' }, [
        el('label', { class: 'field' }, [
          el('span', { class: 'field-label' }, 'Preis pro m² · ganzes Projekt'),
          numInput(project.price, v => patchProject(p => ({ ...p, price: v })), { fkey: 'proj-price' }),
        ]),
        el('label', { class: 'field' }, [
          el('span', { class: 'field-label' }, 'Standardhöhe m'),
          numInput(project.defaultHeight, v => patchProject(p => ({ ...p, defaultHeight: v })), { fkey: 'proj-height' }),
        ]),
      ]),
      el('div', { class: 'btn-row' }, [
        el('button', { class: 'btn btn-ghost', onClick: addProject }, '+ Neues Projekt'),
        el('button', { class: 'btn btn-ghost', onClick: resetProject }, 'Projekt zurücksetzen'),
        el('button', {
          class: 'btn btn-ghost danger' + (state.projects.length <= 1 ? ' off' : ''),
          onClick: () => deleteProject(project.id),
        }, 'Projekt löschen'),
      ]),
    ]),
  ]);

  return el('div', { class: 'view' }, [
    storageFailed ? el('div', { class: 'warn-box' }, [
      el('span', { class: 'dot' }),
      el('div', { class: 'msg' }, 'Projekt konnte nicht auf dem Gerät gespeichert werden — Speicher voll oder privater Modus.'),
    ]) : null,
    hero,
    el('div', { class: 'section-head' }, [el('div', { class: 'card-title' }, 'Räume'), el('div', { class: 'hint' }, 'netto · brutto')]),
    list,
    el('button', { class: 'btn-add-room', onClick: addRoom }, '+ Raum hinzufügen'),
    projectCard,
  ]);
}

function renderRaumView() {
  const room = getActiveRoom();
  if (!room) return el('div', { class: 'view' }, 'Kein Raum ausgewählt.');
  const project = getProject();
  const c = calc(room, project.price);

  const hero = el('div', { class: 'card hero' }, [
    el('div', { class: 'live-dot' }, [el('span', { class: 'dot' }), el('div', { class: 'card-title' }, 'Ergebnis ' + room.name)]),
    el('div', { class: 'big-stat room' }, [el('div', { class: 'num' }, nf(c.netto, 1)), el('div', { class: 'unit' }, 'm² netto')]),
    el('div', { class: 'sub-line-flex' }, [
      el('div', { class: 'item' }, ['brutto ', el('b', {}, nf(c.brutto, 1)), ' m²']),
      el('div', { class: 'item' }, ['Abzüge ', el('b', {}, '−' + nf(c.abzug, 1)), ' m²']),
    ]),
    el('div', { class: 'tile-grid' }, [
      el('div', { class: 'tile' }, [el('div', { class: 'tile-label' }, 'Decke'), el('div', { class: 'tile-value' }, nf(c.decke, 1) + ' m²')]),
      el('div', { class: 'tile' }, [el('div', { class: 'tile-label' }, 'Boden'), el('div', { class: 'tile-value' }, nf(c.boden, 1) + ' m²')]),
    ]),
    el('div', { class: 'tile-row' }, [el('div', { class: 'k' }, 'Umfang'), el('div', { class: 'v' }, nf(c.umfang) + ' m')]),
  ]);

  const wallCountRow = el('div', { class: 'pill-row' },
    [3, 4, 5, 6, 7, 8].map(n => el('button', {
      class: 'pill-btn' + (room.walls.length === n ? ' active' : ''),
      onClick: () => patchRoom(r => {
        const ws = r.walls.slice(0, n);
        while (ws.length < n) ws.push({ id: nid(), len: 2.00, turn: 'r' });
        return { ...r, walls: ws, openings: r.openings.map(o => ({ ...o, wall: Math.min(o.wall, n - 1) })) };
      }),
    }, String(n)))
  );

  const raumdaten = el('div', { class: 'card' }, [
    el('div', { class: 'card-title' }, 'Raumdaten'),
    el('div', { class: 'card-row', style: { marginTop: '14px' } }, [
      el('label', { class: 'field' }, [
        el('span', { class: 'field-label' }, 'Bezeichnung'),
        el('input', { class: 'input', 'data-fkey': 'room-name', value: room.name, onInput: e => patchRoom(r => ({ ...r, name: e.target.value })) }),
      ]),
      el('label', { class: 'field' }, [
        el('span', { class: 'field-label' }, 'Raumhöhe in m'),
        numInput(room.height, v => patchRoom(r => ({ ...r, height: v })), { fkey: 'room-height' }),
      ]),
      el('div', { class: 'field' }, [
        el('span', { class: 'field-label' }, 'Anzahl Wände'),
        wallCountRow,
      ]),
    ]),
  ]);

  const wallRows = c.g.segs.map((s, i) => el('div', { class: 'wall-row' }, [
    el('div', { class: 'tag' }, [el('div', { class: 'dir' }, s.label), el('div', { class: 'nr' }, 'Wand ' + s.nr)]),
    el('input', {
      class: 'input mono', type: 'text', inputmode: 'decimal', enterkeyhint: 'done',
      'data-fkey': 'wall-' + s.wall.id, value: inputNum(s.wall.len),
      onFocus: e => e.target.select(),
      onChange: e => { const v = parseNum(e.target.value, s.wall.len); patchRoom(r => ({ ...r, walls: r.walls.map((w, j) => (j === i ? { ...w, len: v } : w)) })); },
    }),
    el('div', { class: 'unit' }, 'm'),
    el('button', {
      class: 'turn-btn', title: 'Ecke nach links/rechts',
      onClick: () => patchRoom(r => ({ ...r, walls: r.walls.map((w, j) => (j === i ? { ...w, turn: w.turn === 'l' ? 'r' : 'l' } : w)) })),
    }, s.wall.turn === 'l' ? '↰' : '↱'),
  ]));

  const waende = el('div', { class: 'card' }, [
    el('div', { class: 'section-head', style: { padding: 0 } }, [el('div', { class: 'card-title' }, 'Wände'), el('div', { class: 'hint' }, 'Länge · Richtung')]),
    el('div', { class: 'card-row', style: { marginTop: '12px' } }, wallRows),
    el('div', { class: 'hint-text', style: { marginTop: '12px' } }, 'Die Richtung nach jeder Wand bestimmt die Raumform — für L-Form oder Erker einzelne Ecken umstellen.'),
  ]);

  const presetRow = el('div', { class: 'preset-row' },
    PRESETS.map(pr => el('button', {
      class: 'preset-btn',
      onClick: () => patchRoom(r => ({ ...r, openings: [...r.openings, { id: nid(), key: pr.key, label: pr.label, w: pr.w, h: pr.h, count: 1, wall: 0, offset: 0.50, color: pr.color }] })),
    }, '+ ' + pr.label))
  );

  const wallOptions = c.g.segs.map((s, i) => ({ value: i, label: s.label + ' (' + s.nr + ')' }));

  const openingRows = room.openings.map((o, i) => {
    const patch = upd => patchRoom(r => ({ ...r, openings: r.openings.map((x, j) => (j === i ? { ...x, ...upd } : x)) }));
    const wallSelect = el('select', {
      class: 'input', 'data-fkey': 'op-' + o.id + '-wall',
      onChange: e => patch({ wall: parseInt(e.target.value, 10) || 0 }),
    }, wallOptions.map(wo => el('option', { value: wo.value }, wo.label)));
    wallSelect.value = String(o.wall);

    return el('div', { class: 'opening' }, [
      el('div', { class: 'opening-head' }, [
        el('div', { class: 'label' }, o.label),
        el('div', { class: 'area' }, '−' + nf(o.w * o.h * o.count) + ' m²'),
        el('button', { class: 'remove-btn', onClick: () => patchRoom(r => ({ ...r, openings: r.openings.filter((x, j) => j !== i) })) }, '✕'),
      ]),
      el('div', { class: 'opening-grid3' }, [
        el('label', { class: 'field' }, [el('span', { class: 'field-label' }, 'Breite m'), numInput(o.w, v => patch({ w: v }), { fkey: 'op-' + o.id + '-w' })]),
        el('label', { class: 'field' }, [el('span', { class: 'field-label' }, 'Höhe m'), numInput(o.h, v => patch({ h: v }), { fkey: 'op-' + o.id + '-h' })]),
        el('label', { class: 'field' }, [el('span', { class: 'field-label' }, 'Anzahl'), numInput(o.count, v => patch({ count: v }), { integer: true, min: 1, fkey: 'op-' + o.id + '-n' })]),
      ]),
      el('div', { class: 'opening-grid2' }, [
        el('label', { class: 'field' }, [el('span', { class: 'field-label' }, 'Wand'), wallSelect]),
        el('label', { class: 'field' }, [el('span', { class: 'field-label' }, 'Abstand ab Ecke m'), numInput(o.offset, v => patch({ offset: v }), { min: 0, fkey: 'op-' + o.id + '-off' })]),
      ]),
    ]);
  });

  const abzuege = el('div', { class: 'card' }, [
    el('div', { class: 'card-title' }, 'Abzüge'),
    el('div', { class: 'card-row', style: { marginTop: '12px' } }, [
      presetRow,
      ...openingRows,
      room.openings.length === 0 ? el('div', { class: 'empty-note' }, 'Noch keine Abzüge — netto entspricht brutto.') : null,
    ]),
  ]);

  const kalkulation = el('div', { class: 'card' }, [
    el('div', { class: 'card-title' }, 'Kalkulation & Notizen'),
    el('div', { class: 'card-row', style: { marginTop: '14px' } }, [
      el('label', { class: 'field' }, [
        el('span', { class: 'field-label' }, 'Preis pro m² · gilt fürs ganze Projekt'),
        numInput(project.price, v => patchProject(p => ({ ...p, price: v })), { fkey: 'room-price' }),
      ]),
      el('div', { class: 'tile-row', style: { marginTop: 0 } }, [
        el('div', { class: 'k' }, nf(c.abrechnung, 1) + ' m² abrechenbar'),
        el('div', { class: 'v' }, nf(c.preis) + ' €'),
      ]),
      el('label', { class: 'field' }, [
        el('span', { class: 'field-label' }, 'Notiz'),
        el('textarea', { class: 'input', 'data-fkey': 'room-note', rows: 3, value: room.note, onInput: e => patchRoom(r => ({ ...r, note: e.target.value })) }),
      ]),
      renderPhotos(room),
    ]),
  ]);

  const roomActions = el('div', { class: 'card' }, [
    el('div', { class: 'card-title' }, 'Diesen Raum'),
    el('div', { class: 'btn-row', style: { marginTop: '12px' } }, [
      el('button', { class: 'btn btn-ghost', onClick: () => duplicateRoom(room.id) }, 'Duplizieren'),
      el('button', { class: 'btn btn-outline', onClick: () => resetRoom(room.id) }, 'Zurücksetzen'),
      el('button', {
        class: 'btn btn-ghost danger' + (project.rooms.length <= 1 ? ' off' : ''),
        onClick: () => deleteRoom(room.id),
      }, 'Löschen'),
    ]),
    el('div', { class: 'export-copy', style: { marginTop: '10px' } },
      'Zurücksetzen leert Wände, Abzüge, Fotos und Notiz — der Name bleibt. Rückgängig geht direkt danach über den Hinweis.'),
  ]);

  return el('div', { class: 'view' }, [
    hero, raumdaten, waende, abzuege, kalkulation, roomActions,
    el('button', { class: 'btn btn-primary btn-block', onClick: () => setState({ tab: 'plan' }) }, 'Grundriss ansehen'),
  ]);
}

/* Draws the floor plan for one room. The print sheet reuses this with a
 * light palette so the PDF shows the same geometry on white paper. */
function planSvg(room, c, p, theme) {
  const col = theme === 'print'
    ? { wall: '#464e5b', label: '#5c636e', area: '#1b1f27' }
    : { wall: '#5b6472', label: '#9aa0ac', area: '#dfe2e8' };

  const group = svgEl('g', {}, [
    ...p.planWalls.map(s => svgEl('line', { x1: s.x1, y1: s.y1, x2: s.x2, y2: s.y2, stroke: col.wall, 'stroke-width': 7, 'stroke-linecap': 'square' })),
    ...p.planOpenings.map(o => svgEl('line', { x1: o.x1, y1: o.y1, x2: o.x2, y2: o.y2, stroke: o.color, 'stroke-width': 7, 'stroke-linecap': 'butt' })),
    ...p.planLabels.map(l => {
      const t = svgEl('text', { x: l.x, y: l.y, 'text-anchor': 'middle', 'dominant-baseline': 'middle', fill: col.label });
      t.style.font = "500 11px 'Space Grotesk',sans-serif";
      t.textContent = l.text;
      return t;
    }),
    (() => {
      const t = svgEl('text', { x: p.cx, y: p.cy, 'text-anchor': 'middle', 'dominant-baseline': 'middle', fill: col.area });
      t.style.font = "600 14px 'Space Grotesk',sans-serif";
      t.textContent = nf(c.boden, 1) + ' m²';
      return t;
    })(),
  ]);
  return svgEl('svg', { viewBox: '0 0 320 300' }, [group]);
}

/* Camera and gallery are separate inputs on purpose: Android sends
 * capture="environment" straight to the camera and ignores multiple, so a
 * single combined button would make picking existing photos impossible.
 *
 * Both inputs are created once and kept in the document. Picking a photo can
 * take a while, and a re-render in the meantime would detach an input built
 * per render — the file would then land on an orphaned element. */
const photoInputs = {};
let photoTargetRoom = null;

function photoInput(capture) {
  const key = capture ? 'cam' : 'gallery';
  if (photoInputs[key]) return photoInputs[key];
  const input = el('input', {
    type: 'file', accept: 'image/*', multiple: !capture,
    style: { display: 'none' },
    onChange: e => {
      // Copy first: e.target.files is live, so resetting value would empty
      // the very list being handed on (and the input has to be reset so the
      // same photo can be picked twice in a row).
      const files = Array.from(e.target.files || []);
      e.target.value = '';
      if (photoTargetRoom != null && files.length) addPhotos(photoTargetRoom, files);
    },
  });
  if (capture) input.setAttribute('capture', 'environment');
  document.body.appendChild(input);
  photoInputs[key] = input;
  return input;
}

function pickPhotos(roomId, capture) {
  photoTargetRoom = roomId;
  photoInput(capture).click();
}

function renderPhotos(room) {
  const photos = room.photos || [];

  return el('div', { class: 'photo-block' }, [
    el('div', { class: 'field-label' }, 'Fotos'),
    el('div', { class: 'photo-actions' }, [
      el('button', { class: 'btn btn-outline', onClick: () => pickPhotos(room.id, true) }, 'Foto aufnehmen'),
      el('button', { class: 'btn btn-ghost', onClick: () => pickPhotos(room.id, false) }, 'Aus Galerie'),
    ]),
    photos.length
      ? el('div', { class: 'photo-grid' }, photos.map(ph => el('div', { class: 'photo-thumb' }, [
          el('img', { src: ph.thumb, alt: 'Foto ' + room.name, loading: 'lazy', onClick: () => openLightbox(ph) }),
          el('button', {
            class: 'photo-del', title: 'Foto entfernen', 'aria-label': 'Foto entfernen',
            onClick: () => removePhoto(room.id, ph.id),
          }, '✕'),
        ])))
      : el('div', { class: 'empty-note' }, 'Noch keine Fotos — sie erscheinen im PDF unter dem Raum.'),
  ]);
}

function renderLightbox() {
  if (!lightbox) return null;
  return el('div', { class: 'lightbox', onClick: closeLightbox }, [
    el('img', { src: lightbox.url, alt: 'Foto' }),
    el('button', { class: 'lightbox-close', 'aria-label': 'Schließen' }, '✕'),
  ]);
}

function renderPlanView() {
  const room = getActiveRoom();
  if (!room) return el('div', { class: 'view' }, 'Kein Raum ausgewählt.');
  const c = calc(room);
  const p = plan(room, c);
  // A reset room has four zero-length walls: drawing that stacks four
  // "0,00 m" labels in one corner, which reads as a broken plan.
  const hasMeasure = c.g.segs.some(seg => seg.len > 0);

  const svg = planSvg(room, c, p, 'screen');

  const hero = el('div', { class: 'card hero' }, [
    el('div', { class: 'card-row' }, [
      el('div', { class: 'header-row' }, [
        el('div', { class: 'card-title' }, 'Grundriss ' + room.name),
        hasMeasure ? el('div', { style: { font: "500 11px/1 'Space Grotesk',sans-serif", color: 'var(--text-muted)' } }, 'M 1:' + p.scale) : null,
      ]),
      hasMeasure
        ? el('div', { class: 'plan-frame' }, [svg])
        : el('div', { class: 'plan-frame empty' }, [
            el('div', { class: 'plan-empty' }, [
              el('div', { class: 'icon' }, '▱'),
              el('div', { class: 'title' }, 'Noch keine Maße'),
              el('div', { class: 'sub' }, 'Trage unter „Raum" die Wandlängen ein — der Grundriss zeichnet sich dann von selbst.'),
            ]),
          ]),
      hasMeasure && !c.g.closed ? el('div', { class: 'warn-box' }, [
        el('span', { class: 'dot' }),
        el('div', { class: 'msg' }, 'Umriss nicht geschlossen — Längen oder Ecken anpassen. Flächen werden trotzdem berechnet.'),
      ]) : null,
      hasMeasure ? el('div', { class: 'legend' }, [
        el('div', { class: 'item' }, [el('span', { class: 'swatch', style: { background: '#5BA8F0' } }), 'Fenster']),
        el('div', { class: 'item' }, [el('span', { class: 'swatch', style: { background: '#5BD6A0' } }), 'Tür']),
        el('div', { class: 'item' }, [el('span', { class: 'swatch', style: { background: '#6f7682' } }), 'Fläche']),
      ]) : null,
    ]),
  ]);

  const wallTable = el('div', { class: 'card' }, [
    el('div', { class: 'card-title' }, 'Wandliste'),
    el('div', { style: { marginTop: '10px' } }, c.g.segs.map(s => el('div', { class: 'wall-table-row' }, [
      el('div', { class: 'label' }, s.label + ' · Wand ' + s.nr),
      el('div', { class: 'detail' }, nf(s.len) + ' × ' + nf(room.height) + ' m'),
      el('div', { class: 'area' }, nf(s.len * room.height, 1) + ' m²'),
    ]))),
  ]);

  return el('div', { class: 'view' }, [
    hero,
    wallTable,
    el('button', { class: 'btn btn-outline btn-block', onClick: () => setState({ tab: 'raum' }) }, 'Maße bearbeiten'),
  ]);
}

function renderExportView() {
  const t = totals();
  const project = getProject();

  const exportCard = el('div', { class: 'card' }, [
    el('div', { class: 'card-title' }, 'Export'),
    el('div', { class: 'export-copy', style: { marginTop: '12px' } }, 'Ein Angebotsblatt pro Projekt mit Datum und Gesamtsumme, je Raum eine Zeile. Excel als Tabelle mit Abzügen im Detail.'),
    el('div', { class: 'card-row', style: { marginTop: '12px' } }, [
      el('button', { class: 'btn btn-primary', onClick: exportPdf }, 'PDF-Angebot'),
      el('button', { class: 'btn btn-ghost', onClick: exportCsv }, 'Excel / CSV herunterladen'),
    ]),
  ]);

  const sheet = el('div', { class: 'sheet' }, [
    el('div', { class: 'sheet-head' }, [
      el('div', {}, [
        el('div', { class: 'title' }, 'Flächenaufstellung'),
        el('div', { class: 'sub' }, project.name),
      ]),
      el('div', { class: 'date' }, project.date),
    ]),
    el('div', {}, [
      el('div', { class: 'sheet-table-head' }, [el('div', {}, 'Raum'), el('div', {}, 'Brutto'), el('div', {}, 'Netto'), el('div', {}, 'Decke')]),
      ...project.rooms.map(r => {
        const rc = calc(r, project.price);
        return el('div', { class: 'sheet-row' }, [
          el('div', { class: 'name' }, r.name),
          el('div', { class: 'brutto' }, nf(rc.brutto, 1)),
          el('div', { class: 'netto' }, nf(rc.netto, 1)),
          el('div', { class: 'decke' }, nf(rc.decke, 1)),
        ]);
      }),
    ]),
    el('div', { class: 'sheet-total' }, [el('div', { class: 'k' }, 'Gesamtsumme'), el('div', { class: 'v' }, nf(t.preis) + ' €')]),
    el('div', { class: 'sheet-legal' }, 'Netto = Brutto-Wandfläche abzüglich Fenster, Türen und freier Flächen. Alle Maße in Metern, Flächen in m².'),
  ]);

  return el('div', { class: 'view' }, [
    exportCard,
    el('div', { class: 'card-title', style: { padding: '0 4px' } }, 'Vorschau Angebotsblatt'),
    sheet,
  ]);
}

function currentView() {
  switch (state.tab) {
    case 'raum': return renderRaumView();
    case 'plan': return renderPlanView();
    case 'export': return renderExportView();
    default: return renderProjektView();
  }
}

/* render() throws away the whole DOM, so anything the user is in the middle
 * of typing would lose its caret — and, once a stray timer fired, its focus
 * entirely. Capture the focused field by its stable key and restore it. */
function captureFocus() {
  const a = document.activeElement;
  if (!a || !a.getAttribute) return null;
  const key = a.getAttribute('data-fkey');
  if (!key) return null;
  let start = null, end = null;
  try { start = a.selectionStart; end = a.selectionEnd; } catch { /* select has no range */ }
  return { key, start, end };
}

function restoreFocus(mark) {
  if (!mark) return;
  const node = document.querySelector('[data-fkey="' + mark.key + '"]');
  if (!node) return;
  node.focus();
  if (mark.start != null) {
    try { node.setSelectionRange(mark.start, mark.end); } catch { /* not a text field */ }
  }
}

function render() {
  const mark = captureFocus();
  const root = document.getElementById('app');
  root.innerHTML = '';
  root.appendChild(renderHeader());
  root.appendChild(el('div', { class: 'content' }, [currentView()]));
  const lb = renderLightbox();
  if (lb) root.appendChild(lb);
  restoreFocus(mark);
  // Floating, so messages from photo import and PDF export are visible on
  // every tab — not just on the one card that used to render them.

}

/* Write once on start: a project migrated from v1 otherwise lives only in
 * memory until the user happens to change something, and the old key would
 * be re-read on every launch. */
save();
render();
sweepOrphanPhotos();

/* Free the print DOM (base64 photos are heavy on a phone) once the dialog is
 * gone — but deferred: Chromium fires afterprint around the capture itself,
 * and clearing synchronously can empty the sheet before it is serialised. */
/* Deleting a room or photo leaves its blob in IndexedDB so undo can put it
 * back. Anything still unreferenced at the next start is gone for good. */
async function sweepOrphanPhotos() {
  try {
    const referenced = new Set();
    state.projects.forEach(p => p.rooms.forEach(r => (r.photos || []).forEach(ph => referenced.add(ph.id))));
    const keys = await photoTx('readonly', st => st.getAllKeys());
    const orphans = keys.filter(k => !referenced.has(k));
    for (const k of orphans) await dropPhoto(k);
  } catch { /* storage unavailable — nothing to sweep */ }
}

window.addEventListener('afterprint', () => {
  setTimeout(() => {
    const root = document.getElementById('print-root');
    if (root) root.innerHTML = '';
  }, 2000);
});

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('sw.js').catch(() => { /* offline support best-effort */ });
  });
}
