# CLAUDE.md

Private Web-Projekte: `Travel-Map-Generator/`, `raum/` (Raumrechner) und
`poster/` (Musik-Poster-Generator). Übersicht und Aufbau: `README.md`.
Gemeinsamer Code: `shared/`.

## Regeln, die überall gelten

- Reines HTML/CSS/JavaScript (ES-Module), **kein Build-Schritt, keine
  npm-Pakete im Repo**. Fremdbibliotheken liegen unverändert in
  `<Projekt>/vendor/<name>/` samt Lizenz und `VERSION`. Hilfsprogramme
  (TypeScript, Playwright, Python) laufen über `npx`/`pip`, nie als
  Abhängigkeit im Repository. Ausgenommen ist `.claude/skills/`: Agent Skills
  für Claude Code, kein Code der Seite — wird weder veröffentlicht noch
  geprüft.
- Code-Kommentare und Dokumentation auf **Deutsch**, Bezeichner im Code
  **englisch**. Commit-Betreff deutsch im Imperativ.
- Nur relative Pfade (läuft lokal mit `python3 -m http.server` und auf GitHub
  Pages unter `/Privat-Projekte/`). Design und Hell/Dunkel aus `shared/`.
- Jeder Ordner mit einer `index.html` wird von `pages.yml` veröffentlicht:
  **`index.html` erst anlegen, wenn die Seite vorzeigbar ist.**
- Browser-Speicher: Schlüssel mit dem Projektnamen beginnen
  (`travel-map-generator.…`), Hell/Dunkel steht für alle in
  `privat-projekte.theme`.
- Typsicherheit ohne Build: öffentliche Funktionen bekommen JSDoc-Typen,
  `npm run typecheck` prüft sie mit `tsc --noEmit` (`tsconfig.json`,
  `checkJs`, `strict`).
- Vor jedem Commit `npm run check` laufen lassen (Typen, Unit-Tests,
  Verweis-Prüfung). Neue Tests gehören nach `<Projekt>/tests/` und in
  `package.json` sowie `tests.yml`.
- Ohne Build meldet nichts einen falschen Pfad. `tools/check-links.mjs` prüft
  deshalb jeden `href`, `src` und Import – neue Verweisarten dort ergänzen,
  statt den Test zu umgehen.

## Travel-Map-Generator

**Vor jeder Arbeit lesen:** `Travel-Map-Generator/PLAN.md` (nächster
Meilenstein) und `ARCHITECTURE.md` (Festlegungen und Grenzen). Die Reihenfolge
der Meilensteine ist verbindlich: M0 ist fertig, als Nächstes kommt M1.

- **Keylos zuerst.** Jeder Provider (Karte, Routing, Geocoding, Höhe, Wetter)
  braucht einen funktionierenden Weg ohne API-Key. Was einen Key braucht, wird
  in der Oberfläche ausgegraut – es scheitert nie erst beim Klick. Keys stehen
  ausschließlich im `localStorage` des Nutzers, niemals im Repository.
- **Die Zeitachse ist eine reine Funktion.** `stateAt(project, t)` kennt keine
  Wanduhr und kein `requestAnimationFrame`. Vorschau und Export rufen dieselbe
  Funktion, sonst sieht das Video anders aus als die Vorschau und Frames lassen
  sich nicht testen.
- **Routen-Geometrie wird im Projekt gespeichert**, nicht bei jedem Öffnen neu
  angefragt: sonst hängt ein fertiges Video am Tageskontingent eines
  Gratis-Dienstes.
- **Motorrad gibt es bei den Gratis-Anbietern nicht** (GraphHopper nur auf
  Anfrage, ORS gar nicht). Es wird als Auto-Profil mit „Autobahnen vermeiden"
  plus Vorliebe für kurvige Strecken abgebildet, und die Oberfläche sagt das
  offen. Nicht stillschweigend als echtes Motorrad-Routing ausgeben.
- **MapLibre-Fallstricke** (beide stehen in `ARCHITECTURE.md`, Abschnitt 6a):
  `setWorkerUrl()` ausdrücklich setzen, und `preserveDrawingBuffer` gehört in
  `canvasContextAttributes` und lässt sich nachträglich nicht ändern.
- MapLibre aktualisieren nur nach
  `Travel-Map-Generator/vendor/maplibre-gl/README.md`, danach `npm run check`:
  Zwischen großen Versionen wandern Optionen, und das findet nur der Typprüfer.

## Raumrechner und Poster-Generator (`raum/`, `poster/`)

Beide stammen aus dem Repo `FloG93/Arbeit` und sind dort ohne JSDoc-Typen
gewachsen. Sie sind deshalb von der strengen Typprüfung ausgenommen
(`tsconfig.json`, `exclude`). Neue Dateien in diesen Ordnern trotzdem mit Typen
schreiben; geändert wird behutsam, beides läuft im Alltag.

- **Alle Apps liegen auf derselben Herkunft** (`flog93.github.io`) – auch die
  Kopien in `Arbeit`, solange es sie gibt. Jeder Service Worker beantwortet nur
  die eigenen Pfade (`SHELL`) und löscht beim Aktivieren nur Caches mit dem
  eigenen Präfix. Der Raumrechner hier heißt deshalb `pp-raumrechner-…`, nicht
  `raumrechner-…`. **Bei jeder Dateiänderung die `CACHE`-Version in `raum/sw.js`
  hochzählen** und neue Dateien in `ASSETS` eintragen.
- `localStorage` und IndexedDB hängen an der Herkunft, nicht am Pfad: Schlüssel
  wie `raumrechner.v2` teilt sich der Raumrechner hier mit seinem Original in
  `Arbeit`. Datenformate nur abwärtskompatibel ändern.
- Der Poster-Generator hat **zwei Kanäle**: `/poster/` aus dem Commit in
  `poster/release.json`, `/poster/beta/` aus dem aktuellen Stand. Der Release-
  Stand `80d0611` ist ein echter Commit dieser Historie und darf **nie
  umgeschrieben, zusammengefasst (squash) oder durch Rebase verändert werden**,
  sonst verliert der Release-Kanal seinen Stand. Freigeben: `release.json`
  auf einen neuen Commit zeigen lassen, Version eintragen.
- Zahlenfelder im Raumrechner als `type="text" inputmode="decimal"` mit
  `parseNum`/`inputNum` (deutsches Komma) – `type="number"` verschluckt das
  Komma und macht aus 2,75 m eine Raumhöhe von 275 m.
