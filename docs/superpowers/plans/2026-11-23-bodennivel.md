# BodenNivel Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Offline-fähige Mobil-Web-App `bodennivel/`, die Laser-Messwerte im Raster je Raum aufnimmt, als Draufsicht zeigt und daraus Ausgleichsmasse, Säcke, Paletten, Wasser und das Anzeichen-Maß berechnet.

**Architecture:** Reine Fachlogik in kleinen, getesteten ES-Modulen (`format`, `model`, `grid`, `calc`, `store`) ohne DOM. Die Oberfläche (`ui/*.js`) rendert bei jeder Änderung neu aus einem Zustandsobjekt; jede Änderung läuft über `commit()` → speichern → rendern. Draufsicht als SVG.

**Tech Stack:** HTML/CSS/JavaScript (ES-Module, JSDoc-Typen), `shared/css/ui.css`, `shared/js/theme.js`, Lucide-Icons als SVG in `vendor/`, `node --test`, `tsc --noEmit` über npx, Playwright (vorinstalliert, nur für die Abnahme, nicht im Repo).

**Spec:** `docs/superpowers/specs/2026-11-23-bodennivel-design.md` – vor Beginn ganz lesen. Außerdem `CLAUDE.md` und `README.md` im Hauptordner.

## Global Constraints

- Kein Build, keine npm-Pakete im Repo, kein CDN. Fremdcode nur unverändert in `bodennivel/vendor/<name>/` mit `LICENSE` und `VERSION`.
- Kommentare/Doku deutsch, Bezeichner englisch. Commit-Betreff deutsch, Imperativ, mit den Trailer-Zeilen aus der Session.
- Code-Stil wie `Travel-Map-Generator/js` und `shared/js`: keine Semikolons, einfache Anführungszeichen, 2 Leerzeichen.
- Nur relative Pfade. Design aus `../shared/css/ui.css`, Hell/Dunkel über `../shared/js/theme.js` (`applyStoredTheme()` früh im `<head>`).
- Speicher: ein Schlüssel `bodennivel.v1`. Theme bleibt `privat-projekte.theme`.
- Service Worker: Präfix `pp-bodennivel-`, nur eigene `SHELL`-Pfade, löscht nur eigene Caches; Version bei jeder Dateiänderung hochzählen.
- **`bodennivel/index.html` erst in Task 10 anlegen.** Bis dahin heißt die Seite `bodennivel/dev.html`.
- Zahlenfelder: `type="text" inputmode="decimal"`, Auswertung nur über `parseNum` (Komma!). Nie `type="number"`.
- Standardwerte: Verbrauch 1,6 kg/(mm·m²) · Sack 20 kg · Mindestschicht 3 mm · Max-Schicht 30 mm (Schnellwahl 30/40) · Reserve 5 % · Wasser 4,6 L/Sack · 48 Säcke/Palette · Rastermaß 1,0 m (0,5–2,0).
- Farbstufen: h ≤ 10 → `ok` (grün), 10 < h ≤ 25 → `mid` (gelb/orange), h > 25 → `high` (rot).
- Touch-Ziele ≥ 48 px. Löschen immer mit Rückfrage.
- Vor jedem Commit `npm run check` – muss grün sein.

## Review Focus

1. **Negatives Anzeichen-Maß nach dem Umsetzen:** Steht der Laser tiefer, kann $d_{\text{Soll}}(S) < 0$ werden. Erwartet: Anzeige „5 mm über der Linie“ statt „−5 mm“. → Test in Task 4 (`formatMark`), Anzeige in Task 8.
2. **Leere/ausgeschlossene Zellen verfälschen $d_{\min}$:** Ausgeschlossene Zellen mit altem Wert und leere Zellen zählen nirgends mit. → Test in Task 4.
3. **Unsinnige Eingaben:** `""`, `"abc"`, negative Werte → nicht speichern, Feld markieren. `"12.5"` und `"12,5"` → 12,5. → Test in Task 1 (`parseMeasurement`).
4. **Kein Speicher verfügbar** (privates Fenster, Quota voll): App läuft im Speicher weiter und zeigt ein Banner „Wird nicht gespeichert – bitte exportieren“. → Test in Task 5.
5. **Kaputter oder neuerer Import:** Fehlermeldung, bestehende Daten bleiben unverändert. → Test in Task 5.

---

## File Structure

```
bodennivel/
  dev.html → (Task 10) index.html   Seite, lädt css + js/main.js
  manifest.webmanifest, sw.js, icons/ (Task 10)
  css/app.css                       Layout, Raster-Farben, Eingabeleiste, @media print
  js/format.js                      parseNum, parseMeasurement, Zahlenformat deutsch
  js/model.js                       JSDoc-Typen, Standardwerte, Fabriken, newId
  js/grid.js                        Rastermaße, Schlangen-Reihenfolge, nächste Zelle, Größe ändern
  js/calc.js                        Laser-Offsets, Gruppen, Raum- und Projektergebnis
  js/store.js                       laden/speichern/migrieren, Export/Import JSON
  js/main.js                        Zustand, commit(), Hash-Routing, Start
  js/ui/dom.js                      el()-Helfer, icon(), confirmDialog()
  js/ui/dashboard.js                Projektansicht inkl. Einstellungen, Standorte, Einkaufsliste
  js/ui/room.js                     Raumansicht (Kopf, Plan, freie Punkte, Ergebnis)
  js/ui/plan-svg.js                 Draufsicht als SVG
  js/ui/entry-bar.js                fixierte Eingabeleiste
  js/ui/laser-dialog.js             Dialog „Laser umsetzen“
  js/ui/print.js                    Druckansicht
  vendor/lucide/                    ausgewählte SVGs + LICENSE + VERSION
  tests/*.test.mjs
  README.md
```

---

### Task 1: Gerüst und Zahlenformat

**Files:**
- Create: `bodennivel/js/format.js`, `bodennivel/tests/format.test.mjs`
- Modify: `package.json` (Script `test:bodennivel`: `node --test "bodennivel/tests/*.test.mjs"`, in `test` vor `test:links` einhängen), `.github/workflows/tests.yml` (Job `bodennivel` analog `travel-map`, `run: npm run test:bodennivel`)

**Interfaces:**
- Produces:
  - `parseNum(raw: string, fallback?: number|null): number|null` – Logik wie `raum/app.js:41` (`"1.234,5"` → 1234.5, `"12.5"` → 12.5), Standard-fallback `null`.
  - `parseMeasurement(raw: string): number|null` – `parseNum`, dann `null` bei NaN, < 0 oder > 2000; auf 0,1 gerundet.
  - `formatNum(v: number, digits?: number): string` – `Intl.NumberFormat('de-DE')`, Standard 1 Nachkommastelle, ohne nachgestellte Nullen (`12` → `"12"`, `12.5` → `"12,5"`).
  - `formatMm(v: number): string` → `"12,5 mm"`; `formatKg(v)` → unter 1000 `"47 kg"` (ganzzahlig gerundet), ab 1000 `"1.250 kg (1,25 t)"`; `formatL(v)` → `"13,8 L"`; `formatM2(v)` → `"21,34 m²"` (2 Stellen).

- [ ] **Step 1: Tests schreiben** – `parseMeasurement`: `"12,5"`→12.5, `"12.5"`→12.5, `" 8 "`→8, `""`→null, `"abc"`→null, `"-3"`→null, `"2500"`→null, `"7,25"`→7.3. `formatNum(12)`→`"12"`, `formatNum(12.5)`→`"12,5"`, `formatKg(47.04)`→`"47 kg"`, `formatKg(1250)`→`"1.250 kg (1,25 t)"`, `formatM2(21.3375)`→`"21,34 m²"`.
- [ ] **Step 2:** `npm run test:bodennivel` → FAIL (Modul fehlt).
- [ ] **Step 3:** `format.js` implementieren, Script und CI-Job eintragen.
- [ ] **Step 4:** `npm run check` → PASS.
- [ ] **Step 5:** Commit „BodenNivel: Zahlenformat und Testgerüst anlegen“.

### Task 2: Datenmodell

**Files:**
- Create: `bodennivel/js/model.js`, `bodennivel/tests/model.test.mjs`

**Interfaces:**
- Produces (JSDoc-`@typedef`, exportiert über `@typedef` im Modul):
  - `Settings { consumption, bagKg, minLayer, maxLayer, reservePct, waterPerBag, bagsPerPallet, gridSize }` (alle `number`)
  - `Setup { id: string, name: string, offset: number, ref: { label: string, before: number, after: number } | null }`
  - `Corner = 'NW'|'NE'|'SW'|'SE'`
  - `Cell { row: number, col: number, excluded: boolean, value: number|null, setupId: string|null }`
  - `Point { id: string, label: string, value: number, setupId: string }`
  - `Room { id, name, length: number|null, width: number|null, areaOverride: number|null, inGroup: boolean, startCorner: Corner, grid: { cols: number, rows: number, cells: Cell[] }, freePoints: Point[] }`
  - `Project { id, name, connected: boolean, settings: Settings, setups: Setup[], activeSetupId: string, rooms: Room[], createdAt: string }`
  - `AppState { version: 1, activeProjectId: string|null, projects: Project[] }`
  - `DEFAULT_SETTINGS: Readonly<Settings>` (Werte aus Global Constraints)
  - `newId(): string` – `crypto.randomUUID()` wenn vorhanden, sonst Zeit+Zufall.
  - `createProject(name: string): Project` – ein Setup `{ name: 'S1', offset: 0, ref: null }`, aktiv; `connected: true`; Kopie der Standardwerte.
  - (`createRoom` folgt in Task 3, weil es `gridDims` braucht.)
  - `emptyState(): AppState` – ein Projekt „Mein Projekt“, aktiv.

- [ ] **Step 1: Tests** – `createProject('Haus A')` hat `settings` gleich `DEFAULT_SETTINGS` (und ist eine Kopie, Änderung wirkt nicht zurück), `setups.length === 1`, `setups[0].offset === 0`, `activeSetupId === setups[0].id`; `newId()` zweimal → verschieden; `emptyState().projects.length === 1`.
- [ ] **Step 2:** Test → FAIL.
- [ ] **Step 3:** `model.js` implementieren.
- [ ] **Step 4:** `npm run check` → PASS.
- [ ] **Step 5:** Commit „BodenNivel: Datenmodell festlegen“.

### Task 3: Raster

**Files:**
- Create: `bodennivel/js/grid.js`, `bodennivel/tests/grid.test.mjs`
- Modify: `bodennivel/js/model.js` (`createRoom` ergänzen)

**Interfaces:**
- Consumes: Typen aus Task 2.
- Produces:
  - `gridDims(length: number|null, width: number|null, gridSize: number): { cols: number, rows: number }` – `cols = max(1, round(length/gridSize))`, `rows` analog mit `width`; ohne Maße `{ cols: 0, rows: 0 }`.
  - `buildCells(cols: number, rows: number, old?: Cell[]): Cell[]` – zeilenweise; Werte/`excluded` alter Zellen mit gleicher (row,col) übernehmen, Rest verwerfen.
  - `spacing(length: number, cols: number): { first: number, step: number }` – `step = length/cols`, `first = step/2` (m).
  - `snakeOrder(cols: number, rows: number, start: Corner): Array<{row: number, col: number}>` – Zeile 0 = Nordwand, Spalte 0 = Westwand. Start `NW`: Zeile 0 links→rechts, Zeile 1 rechts→links …; `NE`: Zeile 0 rechts→links; `SW`/`SE`: von der letzten Zeile nach oben, Richtung analog.
  - `nextCell(room: Room, from: {row,col}|null): {row,col}|null` – nächste Zelle in `snakeOrder` nach `from` (bei `null` ab Anfang), die nicht `excluded` ist und `value === null`; läuft einmal herum; `null`, wenn alles gemessen.
  - `prevCell(room: Room, from: {row,col}): {row,col}|null` – vorige nicht ausgeschlossene Zelle in Reihenfolge, egal ob gemessen.
  - `gridProgress(room: Room): { measured: number, total: number }` – nur nicht ausgeschlossene Zellen.
  - `roomArea(room: Room): number` – `areaOverride` falls gesetzt, sonst `length*width − excludedCount*(length/cols)*(width/rows)`, ohne Maße 0.
  - In `model.js`: `createRoom(name, length, width, gridSize): Room` – `inGroup: true`, `startCorner: 'NW'`, `areaOverride: null`, `freePoints: []`.

- [ ] **Step 1: Tests** – `gridDims(4.2, 3.1, 1)` → `{cols:4, rows:3}`; `gridDims(0.4, 0.4, 1)` → `{1,1}`; `gridDims(null,null,1)` → `{0,0}`; `spacing(4.2, 4)` → `{first:0.525, step:1.05}`; `snakeOrder(3,2,'NW')` → `[(0,0),(0,1),(0,2),(1,2),(1,1),(1,0)]`; `snakeOrder(3,2,'SE')` → `[(1,2),(1,1),(1,0),(0,0),(0,1),(0,2)]`; `nextCell` überspringt ausgeschlossene und gemessene, liefert `null` bei vollem Raster; `buildCells(2,2, alt3x3)` übernimmt (1,1)-Wert, verwirft (2,2); `roomArea` 4×3 m, 4×3 Raster, 1 Zelle ausgeschlossen → 11; mit `areaOverride: 9.5` → 9.5; `gridProgress` zählt ausgeschlossene nicht.
- [ ] **Step 2:** FAIL.
- [ ] **Step 3:** Implementieren.
- [ ] **Step 4:** `npm run check` → PASS.
- [ ] **Step 5:** Commit „BodenNivel: Raster und Messreihenfolge“.

### Task 4: Berechnung

**Files:**
- Create: `bodennivel/js/calc.js`, `bodennivel/tests/calc.test.mjs`

**Interfaces:**
- Consumes: Typen (Task 2), `roomArea`, `gridProgress` (Task 3).
- Produces:
  - `setupOffset(project: Project, setupId: string|null): number` – 0 für unbekannt/null.
  - `addSetup(project: Project, label: string, before: number, after: number): Setup` – neues Setup `S<n+1>`, `offset = offset(aktiv) + (after − before)`, wird aktiv (mutiert `project`).
  - `corrected(project, raw: number, setupId: string|null): number` = `raw − setupOffset`.
  - `groupKey(project: Project, room: Room): string` – `'all'` wenn `project.connected && room.inGroup`, sonst `room.id`.
  - `layerClass(h: number): 'ok'|'mid'|'high'`
  - `formatMark(dSoll: number): string` – ≥ 0: `"72 mm unter der Linie"`, < 0: `"5 mm über der Linie"` (nutzt `formatNum`).
  - `RoomResult { roomId, status: 'empty'|'partial'|'complete', measured, total, basis: 'grid'|'free'|null, dMin: number|null, dSoll: number|null, marks: Array<{setupId, name, dSoll: number}>, hCells: Map<string, number>  /* Schlüssel "row,col" */, hPoints: Map<string, number> /* Point.id */, hMean: number|null, hMax: number|null, area: number, massKg: number, bags: number, waterL: number, overMax: boolean }`
  - `Summary { rooms: RoomResult[], massKg, bagsTotal, bagsSumRooms, pallets, palletFull, palletRest, waterL, hMeanWeighted: number|null, warnings: string[] }`
  - `computeProject(project: Project): Summary`

Regeln (aus Spec 4.2–4.4): $d_{\min}$ je Gruppe über korrigierte Werte aller nicht ausgeschlossenen Zellen mit Wert und aller freien Punkte. $d_{\text{Soll}} = d_{\min} − \text{minLayer}$. $\bar h$ aus Rasterzellen, wenn mindestens eine gemessen ist (`basis: 'grid'`), sonst aus freien Punkten (`'free'`), sonst `null` und Mengen 0. `marks` für jedes Setup des Projekts: `dSoll + offset`. `status`: `empty` ohne jeden Wert, `complete` wenn Raster voll (oder Raum ohne Raster mit ≥ 1 freiem Punkt), sonst `partial`. Säcke pro Raum `ceil(mass/bagKg)` (0 bei Masse 0); `bagsTotal = ceil(Σmass/bagKg)`; `pallets = ceil(bagsTotal/bagsPerPallet)`, `palletFull = floor(...)`, `palletRest = bagsTotal % bagsPerPallet`; `waterL = bagsTotal*waterPerBag`; `hMeanWeighted = Σ(area·hMean)/Σarea` über Räume mit `hMean`. `warnings`: je Raum „<Name>: max. 32 mm über Grenzwert 30 mm“ und „<Name>: vorläufig – 13 von 20 Punkten“.

- [ ] **Step 1: Tests** (Fixtures als kleine Helfer im Test bauen):
  - Raum 2×2 m, Raster 2×2, Werte 10/12/14/20, S1, nicht verbunden: `dMin 10`, `dSoll 7`, `hCells` 3/5/7/13, `hMean 7`, `hMax 13`, `area 4`, `massKg ≈ 47.04` (`4·7·1,6·1,05`), `bags 3`, `waterL` des Raums `13.8`, `status 'complete'`.
  - Laser: `addSetup(p, 'Tür', 20, 8)` → `offset −12`, aktiv; Rohwert 15 mit S2 → `corrected 27`; `marks` für S2 = `dSoll − 12`; `formatMark(-5)` → `"5 mm über der Linie"`.
  - Verbund: Raum A [10,12], Raum B [5,30], `connected: true` → beide `dMin 5`, `dSoll 2`, A `hCells` 8/10. Mit `connected: false` → A `dMin 10`. Mit `connected: true`, B `inGroup: false` → A `dMin 10`.
  - Review Focus 2: ausgeschlossene Zelle mit Wert 1 und leere Zelle ändern `dMin` nicht.
  - Freie Punkte: Raster gemessen + freier Punkt mit Wert 4 → `dMin 4`, `hMean` nur aus Raster; Raum ohne Raster, freie Punkte 10/16, `areaOverride 2` → `basis 'free'`, `hMean` = Mittel der freien h.
  - Summe: zwei Räume mit 47,04 kg und 30,5 kg → `bagsTotal 4`, `bagsSumRooms 5`; 100 Säcke → `pallets 3`, `palletFull 2`, `palletRest 4`; Flächengewicht: (A=4, h̄=7), (B=1, h̄=17) → `hMeanWeighted 9`.
  - `overMax`: `hMax 31` bei `maxLayer 30` → true, plus Warnung; `layerClass(10)`→`ok`, `(10.5)`→`mid`, `(25)`→`mid`, `(25.5)`→`high`.
- [ ] **Step 2:** FAIL.
- [ ] **Step 3:** Implementieren.
- [ ] **Step 4:** `npm run check` → PASS.
- [ ] **Step 5:** Commit „BodenNivel: Schichtdicken und Materialbedarf berechnen“.

### Task 5: Speichern, Export, Import

**Files:**
- Create: `bodennivel/js/store.js`, `bodennivel/tests/store.test.mjs`

**Interfaces:**
- Consumes: `AppState`, `Project`, `emptyState` (Task 2).
- Produces:
  - `STORAGE_KEY = 'bodennivel.v1'`
  - `loadState(storage?: Storage|null): { state: AppState, persistent: boolean }` – Standard `globalThis.localStorage` in `try`; fehlt/wirft → `emptyState()`, `persistent: false`; ungültiges JSON → `emptyState()`, alter Text bleibt unter `bodennivel.v1.broken` gesichert.
  - `saveState(state: AppState, storage?: Storage|null): boolean` – `false` bei Fehler (Quota), nie werfen.
  - `exportProject(project: Project): { filename: string, json: string }` – `{ app: 'bodennivel', version: 1, project }`, eingerückt; Dateiname `bodennivel-<name-slug>-<YYYY-MM-DD>.json`.
  - `parseImport(json: string): Project` – wirft `Error` mit deutscher Meldung bei: kein JSON, `app` ≠ `'bodennivel'`, `version` > 1 („Datei stammt aus einer neueren Version“), fehlenden Pflichtfeldern. Fehlende `settings`-Felder mit Standardwerten auffüllen.
  - `migrate(raw: unknown): AppState` – v1 durchreichen (Grundlage für später).

- [ ] **Step 1: Tests** (Fake-Storage-Objekt mit `getItem/setItem`): Rundlauf speichern/laden gleich; `loadState(null)` → `persistent false`; Storage, dessen `setItem` wirft → `saveState` gibt `false`; kaputtes JSON → `emptyState` und Sicherung unter `.broken`; `parseImport` von `exportProject(p).json` → gleiches Projekt; `parseImport('{"app":"bodennivel","version":2}')` wirft „neueren Version“; `parseImport('quatsch')` wirft; Dateiname für „Haus Müller“ am 2026-11-23 → `bodennivel-haus-mueller-2026-11-23.json` (Datum als Parameter injizierbar: `exportProject(project, now = new Date())`).
- [ ] **Step 2:** FAIL.
- [ ] **Step 3:** Implementieren.
- [ ] **Step 4:** `npm run check` → PASS.
- [ ] **Step 5:** Commit „BodenNivel: Speichern sowie Export und Import“.

### Task 6: App-Gerüst und Projektansicht

**Files:**
- Create: `bodennivel/dev.html`, `bodennivel/css/app.css`, `bodennivel/js/main.js`, `bodennivel/js/ui/dom.js`, `bodennivel/js/ui/dashboard.js`, `bodennivel/vendor/lucide/` (Icons, `LICENSE`, `VERSION`, `README.md` mit Herkunft), `bodennivel/tests/icons.test.mjs`

**Interfaces:**
- Consumes: alles aus Task 1–5.
- Produces:
  - `main.js`: `getState(): AppState`, `getProject(): Project`, `commit(mutator: (p: Project) => void): void` (mutieren → `saveState` → `render()`; bei `false` Banner „Wird nicht gespeichert – bitte exportieren“), `navigate(hash: string): void`. Routen: `#/` Projekt, `#/raum/<id>`, `#/druck`. Speichern zusätzlich bei `pagehide` und `visibilitychange` (hidden).
  - `ui/dom.js`: `el(tag: string, attrs?: Record<string, unknown>, ...children: Array<Node|string|null>): HTMLElement`, `icon(name: IconName): HTMLElement` (span mit CSS-`mask-image` auf `vendor/lucide/icons/<name>.svg`, Farbe = `currentColor`), `ICONS: readonly IconName[]`, `confirmDialog(text: string): Promise<boolean>` (natives `<dialog>`).
  - `ui/dashboard.js`: `renderDashboard(root: HTMLElement, ctx: { project: Project, summary: Summary, commit, navigate }): void`.
- Icons beschaffen: `npm pack lucide-static@<aktuelle Version, ≥ 2 Wochen alt>` im Scratchpad entpacken, nur benötigte SVGs (mindestens `plus`, `trash-2`, `pencil`, `chevron-left`, `settings`, `crosshair`, `move`, `printer`, `download`, `upload`, `triangle-alert`, `check`, `skip-forward`, `undo-2`, `layers`) unverändert nach `bodennivel/vendor/lucide/icons/` kopieren, `LICENSE` und `VERSION` dazu.
- Dashboard-Inhalt (Spec 6.1): Projektname (editierbar), Projektwahl/-neu, Schalter „Räume schwellenlos verbinden“, Raumkarten (Name, Fläche, `measured/total`, Säcke, Warnsymbol bei `overMax` oder `partial`) → Klick öffnet Raum; „+ Raum“ (Dialog: Name, Länge, Breite – leer erlaubt –, Fläche optional); Einkaufsliste aus `Summary` (Säcke gesamt + Σ Raum-Säcke klein darunter, „2 Paletten + 4 Säcke“, kg/t, Wasser, Ø Schichtdicke, Warnungen). Aufklappbar (`<details>`): Materialeinstellungen (alle `Settings`, Max-Schicht mit Chips 30/40), Laser-Standorte (Liste mit Offset; Löschen nur, wenn kein Punkt das Setup nutzt), Daten (Export, Import, Druckansicht).

- [ ] **Step 1: Test** `icons.test.mjs`: jede Datei aus `ICONS` existiert unter `bodennivel/vendor/lucide/icons/`; `VERSION` und `LICENSE` existieren. (Importiere `ICONS` aus `dom.js` – deshalb in `dom.js` keinen DOM-Zugriff auf Modulebene.)
- [ ] **Step 2:** FAIL.
- [ ] **Step 3:** Umsetzen. `dev.html` lädt `../shared/css/ui.css`, `css/app.css`, im `<head>` ein Modul-Skript mit `applyStoredTheme()`, dann `js/main.js`. Meta `viewport`, `theme-color`.
- [ ] **Step 4:** `npm run check` → PASS. `npm start`, `http://localhost:8080/bodennivel/dev.html` mit Playwright (Skript im Scratchpad, iPhone-Emulation) öffnen: Raum anlegen, Reload → Raum noch da. Screenshot ansehen.
- [ ] **Step 5:** Commit „BodenNivel: Projektansicht mit Räumen und Einkaufsliste“.

### Task 7: Raumansicht mit Draufsicht und Eingabeleiste

**Files:**
- Create: `bodennivel/js/ui/room.js`, `bodennivel/js/ui/plan-svg.js`, `bodennivel/js/ui/entry-bar.js`
- Modify: `bodennivel/css/app.css`, `bodennivel/js/main.js` (Route)

**Interfaces:**
- Consumes: `nextCell`, `prevCell`, `spacing`, `gridProgress`, `buildCells`, `gridDims` (Task 3), `computeProject`, `layerClass` (Task 4), `parseMeasurement`, `formatNum` (Task 1).
- Produces:
  - `renderRoom(root, ctx: { project, room, result: RoomResult, commit, navigate, ui: RoomUi }): void`
  - `RoomUi { selected: {row,col}|null, show: 'raw'|'h' }` – liegt in `main.js` im Speicher (nicht persistiert), je Raum.
  - `renderPlan(room: Room, result: RoomResult, ui: RoomUi, onSelect: (cell: {row,col}) => void, onToggleExclude: (cell) => void): SVGSVGElement` – `viewBox` aus `cols×rows`, volle Breite, Beschriftung N/O/S/W, Zelle zeigt Rohwert oder h (gerundet, `formatNum`), Klasse `ok|mid|high`, leer = gestrichelt grau, ausgeschlossen = schraffiert, ausgewählt = dicker Rahmen. Langes Drücken (≥ 500 ms) oder Kontextmenü → `onToggleExclude`.
  - `renderEntryBar(ctx): HTMLElement` – fixiert unten. Feld `type="text" inputmode="decimal" enterkeyhint="next" autocomplete="off"`, Label „R3 · S2“ (Zeile/Spalte 1-basiert). Enter oder „+“: `parseMeasurement`; `null` → Feld rot markieren, nichts speichern; sonst Zelle `value`/`setupId = activeSetupId` setzen, `selected = nextCell(room, selected)`, Feld leeren und **fokussiert lassen** (nach `render()` erneut `focus()`). „Überspringen“ → `selected = nextCell(room, selected)` ohne Speichern. „Zurück“ → `prevCell`, Feld mit dem vorhandenen Wert vorbelegen. Ist eine gemessene Zelle ausgewählt, überschreibt „+“ ihren Wert. Löschen-Knopf für den Wert der ausgewählten Zelle.
  - Zeigt aktiven Standort „Laser: S2 (−12 mm)“ und Knopf „Laser umsetzen“ (öffnet Task 8; bis dahin Knopf ohne Funktion ausblenden).
- Raum-Kopf: Name, Fläche (`formatM2`), Haken „gehört zum Verbund“ (nur sichtbar, wenn `project.connected`), Bearbeiten (Name, Maße, Fläche manuell, Startecke; Maße ändern → `confirmDialog` falls Werte vorhanden, dann `buildCells`), Löschen (Rückfrage). Unter dem Plan: Abstands-Hinweis aus `spacing` („erster Punkt 0,53 m von der Westwand, dann alle 1,05 m“ für beide Richtungen), Fortschritt „13/20 gemessen“, Umschalter Rohwert/Schichtdicke, Eselsbrücke „Kleiner Wert = hoher Boden · Großer Wert = tiefe Senke“.
- Freie Punkte: Chips „Ecke NW“, „Ecke NO“, „Ecke SW“, „Ecke SO“, „Mitte“, „Tür“, „P<n>“ (fortlaufend). Chip wählen → Eingabeleiste speichert als freien Punkt statt in Zelle. Liste mit Wert, h-Kachel, Bearbeiten/Löschen.
- Ergebnis-Karte: dMin, Anzeichen-Maß je Standort (`formatMark`), h̄, hMax, Masse, Säcke, Wasser; rote Warnung bei `overMax`; Hinweis „vorläufig – X von Y Punkten“ bei `partial`; Hinweis bei `basis 'free'`.

- [ ] **Step 1:** Umsetzen (UI – keine Unit-Tests; Logik steckt in getesteten Modulen).
- [ ] **Step 2:** `npm run check` → PASS.
- [ ] **Step 3:** Playwright-Abnahme (iPhone 13): Raum 4,2 × 3,1 m anlegen (4 × 3 = 12 Zellen), eine Zelle ausschließen → „0/11“; 11 Werte per Tastatur + Enter eingeben – nach jeder Eingabe bleibt das Feld fokussiert und die Auswahl springt in Schlangenlinie; `"abc"` wird abgelehnt; am Ende „11/11“ und Status vollständig; Reload → alles da. Screenshot in hell und dunkel ansehen.
- [ ] **Step 4:** Commit „BodenNivel: Raumansicht mit Draufsicht und Schnelleingabe“.

### Task 8: Laser umsetzen

**Files:**
- Create: `bodennivel/js/ui/laser-dialog.js`
- Modify: `bodennivel/js/ui/entry-bar.js`, `bodennivel/js/ui/dashboard.js`

**Interfaces:**
- Consumes: `addSetup`, `setupOffset`, `formatMark` (Task 4), `parseMeasurement`.
- Produces: `openLaserDialog(project: Project, commit): void` – `<dialog>` mit: Referenzpunkt-Bezeichnung (Text, Vorschlag „Tür“), „Wert vorher (alter Standort)“, „Wert nachher (neuer Standort)“, Live-Anzeige „Δ = −12 mm → neuer Standort S2“; Bestätigen → `commit(p => addSetup(p, …))`. Kurzer Erklärtext: „Vor dem Umstellen einen markanten Punkt messen, Laser umstellen, denselben Punkt noch einmal messen.“
- Im Dashboard-Bereich „Laser-Standorte“: Standort wählen = aktiv setzen; Bearbeiten von `before/after` → `offset` neu = `offset(vorheriger Standort in Liste) + after − before`, **nachfolgende Standorte bauen darauf auf**: Offsets aller späteren Setups neu aus ihrer Kette berechnen (Hilfsfunktion `recomputeOffsets(project): void` in `calc.js` ergänzen + Test: S2 Δ −12, S3 Δ +5 → S3 −7; S2 auf Δ −10 ändern → S3 −5).

- [ ] **Step 1:** Test für `recomputeOffsets` in `calc.test.mjs` schreiben → FAIL.
- [ ] **Step 2:** `recomputeOffsets` implementieren → `npm run check` PASS.
- [ ] **Step 3:** Dialog und Standort-Liste umsetzen.
- [ ] **Step 4:** Playwright: zwei Werte mit S1, umsetzen (20 → 8), Wert 15 eingeben → Raumergebnis rechnet mit 27; Anzeichen-Maß zeigt beide Standorte, negatives als „über der Linie“.
- [ ] **Step 5:** Commit „BodenNivel: Laser-Umsetz-Assistent“.

### Task 9: Druckansicht, Export und Import in der Oberfläche

**Files:**
- Create: `bodennivel/js/ui/print.js`
- Modify: `bodennivel/js/ui/dashboard.js`, `bodennivel/css/app.css` (`@media print`), `bodennivel/js/main.js` (Route `#/druck`)

**Interfaces:**
- Consumes: `renderPlan` (Task 7, mit `show` fest auf beide: Rohwert groß, h klein – dafür `RoomUi.show` um `'both'` erweitern), `computeProject`, `exportProject`, `parseImport`.
- Produces: `renderPrint(root, ctx: { project, summary }): void` – Kopf (Projekt, Datum, Materialwerte), je Raum ein Block mit `break-inside: avoid` / Seitenumbruch: Draufsicht, Anzeichen-Maß je Standort groß, h̄, hMax, Masse, Säcke, Wasser, Warnungen; am Ende Einkaufsliste. Knöpfe „Drucken“ (`window.print()`) und „Zurück“, im Druck ausgeblendet.
- Export: Blob + `<a download>`; Import: `<input type="file" accept="application/json,.json">` → `parseImport` → Fehler als Meldung, sonst Frage „Aktuelles Projekt ersetzen?“ (ja → ersetzen, nein → als neues Projekt mit neuer `id` hinzufügen).

- [ ] **Step 1:** Umsetzen.
- [ ] **Step 2:** `npm run check` → PASS.
- [ ] **Step 3:** Playwright: Export herunterladen, Daten löschen, Import → identisch; kaputte Datei → Meldung, Daten unverändert; `page.pdf()` der Druckansicht ansehen (eine Seite je Raum, gut lesbar in Schwarz-Weiß).
- [ ] **Step 4:** Commit „BodenNivel: Druckansicht und Datensicherung“.

### Task 10: Offline, Veröffentlichen, Doku

**Files:**
- Create: `bodennivel/sw.js`, `bodennivel/manifest.webmanifest`, `bodennivel/icons/` (192/512, maskable; schlichtes Wasserwaagen-Motiv als SVG→PNG, z. B. mit Playwright gerendert), `bodennivel/README.md`
- Rename: `bodennivel/dev.html` → `bodennivel/index.html` (`git mv`)
- Modify: `index.html` (Hauptordner, Karte ergänzen wie die bestehenden), `README.md` (Tabellenzeile und Aufbau-Baum), `CLAUDE.md` (kurzer Abschnitt BodenNivel: Speicher-Schlüssel, SW-Präfix, „CACHE-Version hochzählen“)

**Interfaces:**
- `sw.js` nach Muster `raum/sw.js`: `CACHE_PREFIX = 'pp-bodennivel-'`, `CACHE = CACHE_PREFIX + 'v1'`, `ASSETS` = alle Dateien der App inkl. `../shared/css/ui.css`, `../shared/js/theme.js` und aller Icon-SVGs; `SHELL` aus `ASSETS`; nur `SHELL` beantworten (Cache zuerst, im Hintergrund aktualisieren); beim Aktivieren nur Caches mit eigenem Präfix ≠ `CACHE` löschen. Registrierung in `main.js` (`navigator.serviceWorker?.register('sw.js')`).
- `manifest.webmanifest`: `name` „BodenNivel – Ausgleichsmassen-Rechner“, `short_name` „BodenNivel“, `start_url` und `scope` `./`, `display: standalone`.
- Test `bodennivel/tests/sw.test.mjs`: jede Datei in `ASSETS` existiert (Pfade relativ zu `bodennivel/` auflösen; `ASSETS` per Regex aus `sw.js` lesen); jede `.js`/`.css`/`.svg` unter `bodennivel/` (außer `tests/`, `sw.js`) steht in `ASSETS`.

- [ ] **Step 1:** `sw.test.mjs` schreiben → FAIL.
- [ ] **Step 2:** `sw.js`, Manifest, Icons, Umbenennung → Test PASS.
- [ ] **Step 3:** Übersichtsseite, `README.md`, `CLAUDE.md`, `bodennivel/README.md` (Bedienung auf der Baustelle in 10 Zeilen, Formeln, Speicherort der Daten, Hinweis Export als Sicherung).
- [ ] **Step 4:** `npm run check` → PASS. Playwright: Seite laden, Netz abschalten (`context.setOffline(true)`), neu laden → App läuft; Übersichtsseite verlinkt die App.
- [ ] **Step 5:** Commit „BodenNivel veröffentlichen: offline-fähig, auf der Übersicht“ und auf `claude/jolly-hamilton-2frv2y` pushen.
