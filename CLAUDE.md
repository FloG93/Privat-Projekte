# CLAUDE.md

Private Web-Projekte: `Travel-Map-Generator/`. Übersicht und Aufbau:
`README.md`. Gemeinsamer Code: `shared/`.

## Regeln, die überall gelten

- Reines HTML/CSS/JavaScript (ES-Module), **kein Build-Schritt, keine
  npm-Pakete im Repo**. Fremdbibliotheken liegen unverändert in
  `<Projekt>/vendor/<name>/` samt Lizenz und `VERSION`. Hilfsprogramme
  (TypeScript, Playwright, Python) laufen über `npx`/`pip`, nie als
  Abhängigkeit im Repository.
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
