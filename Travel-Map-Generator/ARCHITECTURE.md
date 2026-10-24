# Travel-Map-Generator – Architektur und technische Entscheidungen

Begleitdokument zu [`PLAN.md`](PLAN.md). Hier stehen die Festlegungen, auf die
sich die Meilensteine stützen – inklusive der Gründe und der bekannten Grenzen.

## 1. Repo-Layout

```
Privat-Projekte/
├── index.html                    Übersichtsseite -> flog93.github.io/Privat-Projekte/
├── favicon.svg
├── shared/                       Gemeinsam für alle Projekte
│   ├── css/ui.css                Farben (hell/dunkel), Typografie, Knöpfe
│   └── js/theme.js               Hell/Dunkel, gemerkt unter privat-projekte.theme
├── Travel-Map-Generator/
│   ├── index.html                Die App (statisches Markup)
│   ├── favicon.svg
│   ├── README.md  PLAN.md  ARCHITECTURE.md
│   ├── css/app.css               Eigene Farbe und Layout der App
│   ├── js/
│   │   ├── main.js               Einstieg: verdrahtet Markup und Module
│   │   ├── core/                 Reine Logik ohne DOM, voll getestet
│   │   │   ├── model.js          Projekt-Schema, Versionierung, Migration
│   │   │   ├── geo.js            Bogenlänge, Großkreis, Douglas-Peucker, GPX
│   │   │   └── timeline.js       Zeit -> Zustand, Keyframes, Easing
│   │   ├── providers/            Routing/Geocoding/Höhe/Wetter, reine Clients
│   │   ├── map/                  MapLibre: Stile, Layer, Terrain, Marker
│   │   ├── export/               Frame-Renderer, Encoder, Alpha, Share-Paket
│   │   └── storage/              IndexedDB, .tmgz Ex-/Import, Key-Verwaltung
│   ├── vendor/maplibre-gl/       MapLibre unverändert, mit Lizenz und VERSION
│   └── tests/                    node --test
├── tools/check-links.mjs         Prüft jeden relativen Verweis
├── types/node-test.d.ts          Minimale Typen für node:test (kein npm-Paket)
├── tsconfig.json                 Nur Prüfung (checkJs, noEmit) – kein Build
├── package.json                  npm start / npm test / npm run typecheck
└── .github/workflows/            tests.yml und pages.yml
```

Es gibt **keinen Build-Schritt**. `pages.yml` kopiert die Dateien, wie sie im
Repository liegen: die Übersichtsseite nach `/`, jeden Ordner mit einer
`index.html` nach `/<Ordner>/`. Tests, Anleitungen und Typdateien bleiben
draußen. Weil nur relative Pfade benutzt werden, verhält sich
`python3 -m http.server` lokal genau wie GitHub Pages im Unterordner
`/Privat-Projekte/`.

## 2. Stack

| Baustein | Wahl | Grund |
|---|---|---|
| Sprache | JavaScript (ES-Module) mit JSDoc-Typen | Kein Build, und das Datenmodell ist trotzdem typgeprüft: `npm run typecheck` fährt `tsc --noEmit` über die JSDoc-Angaben. Fehler wie ein vertauschtes Feld im Projekt-Schema fallen vor dem Commit auf, nicht beim Nutzer. |
| Oberfläche | Statisches Markup in `index.html`, Verhalten in `js/` | Was sich nicht ändert, steht als HTML da und braucht kein Framework. Die veränderlichen Teile (Timeline, Medienliste) bekommen in M3/M6 kleine, eigene Render-Funktionen über klar benannte Container. |
| Karte | MapLibre GL JS, mitgeliefert in `vendor/` | Open Source, kein Pflicht-Token, 3D-Terrain, `preserveDrawingBuffer` für Frame-Capture, Custom Layer für 3D-Modelle. Die Datei ist in sich geschlossen, es braucht nur sie, den Worker und die CSS. |
| 3D-Modelle (ab M5) | three.js in einem MapLibre-Custom-Layer, ebenfalls `vendor/` | Nur wo nötig; Icon-Sprites decken den Großteil ab und kosten keine Leistung. |
| Styling | CSS-Variablen aus `shared/css/ui.css` | Ein Satz Farben für alle Projekte, hell und dunkel; die App überschreibt nur `--accent`. |
| Video | WebCodecs + Muxer, Fallback `ffmpeg.wasm` | Siehe Abschnitt 7. Beide kommen als `vendor/`-Datei dazu, sobald M4 ansteht. |
| Tests | `node --test`, dazu `tools/check-links.mjs` | Ohne Build gibt es nichts, das kaputte Pfade meldet – deshalb prüft ein eigener Test jeden relativen Verweis. |

## 3. Datenmodell (Schema v1)

Eine Projektdatei ist JSON; `.tmgz` ist ein ZIP aus `project.json` plus
optionalen Medien (ab M6). `schemaVersion` wird bei jedem Laden geprüft und
nötigenfalls migriert.

Der Aufbau ist **Wegpunkte plus Etappen dazwischen**: `legs[i]` verbindet
`waypoints[i]` mit `waypoints[i + 1]`, es gibt also immer genau eine Etappe
weniger als Punkte. `validateProject()` prüft diese Zusage, und jede Operation
in `js/core/model.js` hält sie ein.

Warum der Modus an der Etappe hängt und nicht am Projekt: Eine Reise fährt mit
dem Motorrad bis zum Hafen, setzt per Schiff über und fährt weiter. Ein Modus
fürs ganze Projekt könnte das nicht abbilden, und ein nachträglicher Umbau
hätte jede gespeicherte Datei migrieren müssen.

```js
/**
 * @typedef {object} Project
 * @property {number} schemaVersion
 * @property {string} id
 * @property {string} title
 * @property {string} createdAt   ISO-8601
 * @property {string} updatedAt   ISO-8601
 * @property {Waypoint[]} waypoints
 * @property {Leg[]} legs         immer max(waypoints.length - 1, 0) Stück
 * @property {{styleId: string}} style
 *
 * Ab M6 kommen hier media, annotations, camera, timing und export dazu –
 * jeweils mit einem Migrationsschritt in migrateProject().
 */

/**
 * @typedef {object} Waypoint
 * @property {string} id     stabil über Umsortieren und Speichern hinweg
 * @property {string} name   darf leer sein
 * @property {number} lon
 * @property {number} lat
 */

/**
 * @typedef {object} Leg
 * @property {LegMode} mode                 'line' (M1) … 'car' | 'motorcycle' |
 *                                          'bicycle' | 'foot' | 'plane' | 'ship' | 'gpx'
 * @property {[number, number][] | null} geometry  berechneter Verlauf (ab M2);
 *                                          null = gerade Verbindung der beiden Punkte
 */
```

Drei Entscheidungen dahinter:

- **Alle Operationen sind rein** und geben ein neues Projekt zurück. Das kostet
  bei dieser Datenmenge nichts und ist die Grundlage für Undo/Redo (M9).
- **Routen-Geometrie wird mitgespeichert.** Ein Projekt muss ohne erneute
  API-Anfrage wieder öffnen und exportieren können – sonst hängt ein fertiges
  Video am Tageskontingent eines Gratis-Dienstes. Umgekehrt wird `geometry`
  auf `null` gesetzt, sobald ein Punkt sich bewegt: Ein Verlauf, der zur alten
  Lage gehört, wäre gelogen.
- **Medien werden referenziert, nicht eingebettet**, solange man im Editor
  arbeitet (IndexedDB-Handle). Erst Export/Teilen packt Kopien ein.

## 4. Provider-Abstraktion

Jede externe Quelle liegt hinter einem Interface mit einer Fähigkeiten-Tabelle,
damit die Oberfläche nur anbietet, was der aktive Anbieter wirklich kann.

| Aufgabe | Default (kein Key) | Optional mit Key | Hinweis |
|---|---|---|---|
| Basiskarte (Vektor) | OpenFreeMap | MapTiler, Stadia | Attribution ist Pflicht und fest eingebaut. |
| Satellit / 3D-Fotorealismus | – | MapTiler, Mapbox, Google 3D Tiles | Ohne Key nicht verfügbar; Stil wird ausgegraut. |
| Höhenmodell / 3D-Gelände | AWS Terrarium (`encoding: "terrarium"`) | MapTiler Terrain | Keyless, global; falsches `encoding` ergibt still falsches Relief. |
| Routing | OSRM-Demo bzw. HeiGIT-Gratiskontingent | HeiGIT/ORS-Key, GraphHopper | Siehe Abschnitt 5. |
| Geocoding | Photon / Nominatim | ORS Pelias | Rate-Limits der Nominatim-Policy werden eingehalten (Entprellen, Cache). |
| Historisches Wetter | Open-Meteo Archiv | – | Keyless, CORS-fähig. |

Keys liegen ausschließlich im `localStorage` des Nutzers, mit sichtbarem Hinweis
im Einstellungsdialog. Kein Key wird jemals committet oder weitergesendet.

## 5. Routing-Profile, ehrlich

- *Auto*, *Fahrrad*, *Zu Fuß* bilden direkt auf die Profile der Anbieter ab
  (`driving-car`, `cycling-regular`, `foot-walking`).
- *Motorrad* gibt es in den Gratis-Profilen **nicht**: GraphHoppers
  Motorrad-Profil ist nur auf Anfrage verfügbar, ORS hat keines. Wir setzen es
  als Auto-Profil mit `avoid_features: ["highways", "tollways"]` plus Vorliebe
  für kurvige Nebenstrecken um und schreiben das in die Oberfläche. Ein echtes
  Motorrad-Profil bleibt als Key-Option im Interface vorgesehen.
- „Autobahnen vermeiden" ist bei ORS über `avoid_features` abgedeckt; zusätzlich
  sind Vermeidungs-Polygone möglich, falls einzelne Abschnitte raus sollen.
- Hinweis zum Endpunkt: `api.openrouteservice.org` ist zugunsten von
  `api.heigit.org` abgekündigt und stark kontingentiert – wir sprechen von
  Anfang an den neuen Endpunkt.

## 6. Animation: deterministische Zeitachse

Der Kern ist eine reine Funktion:

```js
/**
 * @param {Project} project
 * @param {number} tSeconds
 * @returns {FrameState} Position, Kurswinkel, Neigung, gezeichneter
 *   Linienanteil, Kamera (Center/Zoom/Pitch/Bearing), sichtbare Medien und Texte
 */
export function stateAt(project, tSeconds) { … }
```

Keine Wanduhr, kein `requestAnimationFrame` im Kern. Vorschau und Export rufen
dieselbe Funktion – die Vorschau mit der echten Zeit, der Export mit
`frame / fps`. Das ist die Voraussetzung dafür, dass der Export aussieht wie die
Vorschau, dass Scrubbing exakt ist und dass Frames im Test per Hash vergleichbar
sind.

Details: Routen werden nach Bogenlänge parametrisiert (nicht nach Punktindex,
sonst wird die Fahrt an dichten Trackstellen langsam); Geschwindigkeit und
Kamera werden über Keyframes mit Bézier-Easing interpoliert, Kurswinkel aus der
Tangente, Kurvenneigung aus der Winkeländerung pro Strecke.

## 6a. Zwei Fallstricke, die schon eingebaut sind

Beides fällt erst spät auf und ist dann teuer, deshalb steht es ab M0 im Code:

- **MapLibre-Worker.** MapLibre sucht seinen Web-Worker über `import.meta.url`
  als Nachbardatei von `maplibre-gl.mjs`. Fehlt er, bleibt die Karte leer, und
  zu sehen ist davon nur eine Konsolenzeile („Worker failed to load"). Hier
  liegt er richtig, weil wir ihn mitliefern – `js/map/map-view.js` setzt die URL
  trotzdem ausdrücklich über `setWorkerUrl()`, und `tools/check-links.mjs`
  prüft, dass die Datei da ist. Der Fehler ist zu leise, um sich auf einen
  Dateinamen zu verlassen.
- **`preserveDrawingBuffer`.** Ohne dieses Flag liefert das Karten-Canvas beim
  späteren Frame-Capture ein leeres Bild. In MapLibre 6 sitzt es in
  `canvasContextAttributes` und lässt sich nach dem Erzeugen der Karte nicht
  mehr ändern – also von Anfang an gesetzt (`js/map/map-view.js`).

## 7. Export-Pipeline

```
Zeitachse ──► für jeden Frame:
                 stateAt(t) → Karte setzen → auf 'idle' warten (Kacheln fertig)
                 → Overlay-Canvas zeichnen (Linie, Marker, Pop-ups, Text)
                 → Frame an Encoder
                                   ├── WebCodecs VideoEncoder + Mediabunny → MP4/H.264, WebM/VP9
                                   ├── ffmpeg.wasm (Fallback/ProRes)        → MP4, ProRes 4444
                                   └── PNG-Sequenz + ZIP                    → immer verfügbar, mit Alpha
```

Entscheidungen und Grenzen:

- **Das Warten auf `map.once('idle')` pro Frame ist nicht optional.** Ohne das
  landen halb geladene Kacheln im Video. Es bestimmt die Exportdauer stärker als
  das Encoding.
- **WebCodecs ist der Hauptpfad**: nativ, hardwarebeschleunigt, kein 30-MB-WASM,
  kein `SharedArrayBuffer`. Mediabunny (Nachfolger von `mp4-muxer`/`webm-muxer`)
  übernimmt das Muxen.
- **`ffmpeg.wasm` nur als Fallback und für ProRes.** GitHub Pages kann die
  COOP/COEP-Header für `SharedArrayBuffer` nicht setzen; multithreaded läuft es
  dort nur über einen Service-Worker-Trick (`coi-serviceworker`, kostet einen
  Reload beim ersten Besuch und hilft nicht in jedem eingebetteten Kontext).
  Ohne ihn bleibt der singlethreaded Pfad – deutlich langsamer. Wir prüfen
  `crossOriginIsolated` beim Start und sagen dem Nutzer, was gerade geht.
- **Alpha-Export** (M7): PNG-Sequenz ist der verlässliche Weg (verlustfrei,
  überall importierbar). WebM/VP9 mit Alpha ist kompakt, aber nicht in jedem
  Schnittprogramm willkommen. ProRes 4444 geht über `ffmpeg.wasm` mit harten
  Speichergrenzen – die App rechnet vorher aus, ob Auflösung × Länge passt, und
  legt sonst das fertige lokale `ffmpeg`-Kommando bei.

## 8. Speicherung

- **Projekte:** IndexedDB (`js/storage/db.js`, Datenbank
  `travel-map-generator`), Autosave mit 400 ms Verzögerung und einem `flush`
  beim Verlassen der Seite. Welches Projekt zuletzt offen war, steht in
  `localStorage` unter `travel-map-generator.lastProject`. Undo/Redo über
  Schnappschüsse kommt in M9 – der Store in `js/state/store.js` ist dafür
  vorbereitet.
- **Medien (ab M6):** als Blob in IndexedDB, Thumbnails separat; nichts
  verlässt den Browser.
- **Austausch:** `.tmgz` (`js/storage/archive.js`) – ein gewöhnliches ZIP mit
  `project.json`, geschrieben und gelesen ohne Bibliothek. Das Komprimieren
  übernimmt die native `CompressionStream('deflate-raw')`. Wer nachsehen will,
  was gespeichert wurde, benennt die Datei in `.zip` um. Nicht unterstützt und
  mit klarer Meldung abgelehnt: ZIP64, verschlüsselte Archive und andere
  Verfahren als „gespeichert" und „deflate".
- **Teilen (M8):** erzeugt einen Ordner mit `viewer.html`, `project.json` und
  verkleinerten Medien, den der Nutzer bewusst ins Repo legt. Erst dann ist
  etwas öffentlich.

## 9. Tests und Qualitätsschranken

| Ebene | Werkzeug | Was abgedeckt wird |
|---|---|---|
| Kern | `node --test` | Geo-Mathematik (Bogenlänge, Großkreis, Vereinfachung), GPX-Parser mit echten Beispieldateien, `stateAt` an Abschnittsgrenzen, Schema-Migration |
| Provider | `node --test` mit aufgezeichneten Antworten | Request-Bau, Fehler- und Rate-Limit-Pfade – keine echten API-Aufrufe im CI |
| Oberfläche | Playwright (außerhalb des Repos installiert) | Route anlegen, speichern, neu laden, Timeline scrubben |
| Export | Playwright (außerhalb des Repos installiert) | Kurzer Export, Frame-Hashes gegen Referenzbilder; verhindert stille Abweichungen zwischen Vorschau und Video |
| Pfade | `tools/check-links.mjs` | Jeder `href`, `src` und Import zeigt auf eine Datei, die es gibt; keine absoluten Pfade |
| Budget | CI-Check | Größe der ausgelieferten Dateien, Vorschau-fps bei einer Referenzroute |

## 10. Was diese App ausdrücklich nicht kann

Damit es später keine Enttäuschung gibt:

1. **Kein fotorealistisches 3D ohne bezahlten Key.** Keyless gibt es Vektorkarten
   und echtes 3D-Gelände, aber keine Satellitenbilder.
2. **Exportdauer ist kein Nullsummenspiel.** Ein Minuten-Video braucht
   Minuten – der Großteil davon fürs Nachladen der Kartenkacheln.
3. **ProRes im Browser hat Grenzen.** Für lange Overlay-Spuren ist der Weg
   PNG-Sequenz plus lokales `ffmpeg`.
4. **Medien werden nicht gehostet.** Interaktive Einbettung heißt: Viewer-Paket
   ins eigene Repo legen.
5. **Keine kommerzielle Nutzung der Gratis-Kontingente** – das verbieten die
   Nutzungsbedingungen der Anbieter, nicht wir.
