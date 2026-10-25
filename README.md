# Privat-Projekte

Eigene Werkzeuge, die direkt im Browser laufen – ohne Installation, ohne
Anmeldung, ohne dass Daten das Gerät verlassen.

**Online:** <https://flog93.github.io/Privat-Projekte/> – die Übersichtsseite
verlinkt alle Projekte.

## Projekte

| Projekt | Was es macht | Online | Anleitung |
| --- | --- | --- | --- |
| **Travel-Map-Generator** | Verwandelt Reisedaten in animierte Karten-Videos und interaktive Web-Karten: Route aus Punkten, Smart Routing oder GPX-Track, Fotos an ihren Koordinaten, Kamerafahrt über 3D-Gelände. Export als Video, transparente Overlay-Spur oder einbettbare Karte für den Blog. *(im Aufbau – Meilenstein M1)* | [Öffnen](https://flog93.github.io/Privat-Projekte/Travel-Map-Generator/) | [Travel-Map-Generator](Travel-Map-Generator/README.md) |
| **Raumrechner** | Wand-, Decken- und Bodenflächen unterwegs berechnen, mit Abzügen für Fenster und Türen, automatisch gezeichnetem Grundriss und Fotos je Raum. Export als PDF-Angebot und Excel/CSV, läuft offline und ist installierbar. | [Öffnen](https://flog93.github.io/Privat-Projekte/raum/) | [Raumrechner](raum/README.md) |
| **Musik-Poster-Generator** | Künstler, Album, Song oder Film suchen und daraus ein druckreifes Poster bauen: Motiv groß im Bild, dazu ein scanbarer Code, in zwölf Design-Stilen, bis A0. Mit Release- und Beta-Kanal. | [Öffnen](https://flog93.github.io/Privat-Projekte/poster/) · [Beta](https://flog93.github.io/Privat-Projekte/poster/beta/) | [Poster-Generator](poster/README.md) |

## Aufbau

Jedes Projekt hat einen eigenen Ordner mit Web-App, Tests und Anleitung:

```
index.html              Übersichtsseite (Startseite auf GitHub Pages)
Travel-Map-Generator/   Animierte Reisekarten
  index.html, css/, js/, vendor/   Web-App
  tests/                Tests (node --test)
  README.md, PLAN.md, ARCHITECTURE.md
raum/                   Raumrechner (aus dem Repo Arbeit übernommen, Adresse /raum/)
poster/                 Musik-Poster-Generator mit Release- und Beta-Kanal (ebenfalls aus Arbeit)
shared/                 Gemeinsames Design und Hell/Dunkel (→ shared/README.md)
tools/check-links.mjs   Prüft jeden relativen Verweis im Repository
types/                  Minimale Typen, damit die Typprüfung ohne npm-Pakete läuft
tsconfig.json           Nur Prüfung (checkJs, noEmit) – kein Build
package.json            npm start / npm test / npm run typecheck
.github/workflows/      Tests (tests.yml) und Veröffentlichung (pages.yml)
```

Veröffentlicht wird nach festen Regeln ([`pages.yml`](.github/workflows/pages.yml)):

- `index.html` im Hauptordner → <https://flog93.github.io/Privat-Projekte/>
- jeder Ordner mit einer `index.html` → `https://flog93.github.io/Privat-Projekte/<Ordner>/`
- `shared/` → `https://flog93.github.io/Privat-Projekte/shared/` (von den Projekten per relativem Pfad eingebunden)
- `tests/`, `docs/`, die `*.md` eines Projekts und die Typdateien in `vendor/` kommen nicht auf die Seite
- `poster/` ist die Ausnahme: Es wird aus zwei Kanälen zusammengesetzt. `/poster/` ist die freigegebene Fassung, ausgepackt aus dem Commit in `poster/release.json`, `/poster/beta/` der aktuelle Stand. Freigeben heißt, diesen Zeiger zu ändern (Näheres in [`poster/README.md`](poster/README.md)). Der Commit muss in der Historie bleiben – nicht zusammenfassen, nicht umschreiben.

### Neues Projekt hinzufügen

1. Ordner anlegen, z. B. `Neues-Projekt/`, mit einer `index.html` (reines
   HTML/CSS/JavaScript, nur relative Pfade). Design und Hell/Dunkel kommen aus
   `shared/` (`../shared/css/ui.css`, `../shared/js/theme.js`).
2. Auf der Übersichtsseite (`index.html`) eine Karte ergänzen.
3. Tests in `Neues-Projekt/tests/` ablegen und in
   [`tests.yml`](.github/workflows/tests.yml) und `package.json` eintragen.
4. Browser-Speicher: eigene Schlüssel mit dem Projektnamen beginnen (z. B.
   `neues-projekt.…`). Hell/Dunkel steht für alle in `privat-projekte.theme`.

## GitHub Pages einrichten (einmalig)

1. Im Repository **Settings → Pages** öffnen.
2. Unter **Build and deployment → Source** den Eintrag **GitHub Actions** wählen.
3. Der Workflow veröffentlicht danach die Übersicht und alle Projekte bei jedem
   Push auf den Standard-Branch (oder manuell über *Actions → GitHub Pages →
   Run workflow*).

Solange Pages nicht eingeschaltet ist, scheitert der Workflow nicht, sondern
hinterlässt einen Hinweis im Protokoll.

## Lokal starten und testen

Alles ist reines HTML/CSS/JavaScript ohne Build-Schritt. Wegen der ES-Module
braucht es einen kleinen Webserver:

```bash
python3 -m http.server 8080   # oder: npm start
# Übersicht: http://localhost:8080/   App: http://localhost:8080/Travel-Map-Generator/

npm test          # Unit-Tests aller Projekte + Verweis-Prüfung
npm run typecheck # JSDoc-Typen prüfen (tsc --noEmit über npx, kein Paket im Repo)
npm run check     # beides, wie in der CI
```

Die Tests laufen außerdem bei jedem Push über
[GitHub Actions](.github/workflows/tests.yml).

## Lizenz

MIT. Mitgelieferte Fremdbibliotheken behalten ihre eigene Lizenz; sie liegt
jeweils im `vendor/`-Ordner daneben.
