# Travel-Map-Generator – Projektplan

> Reisedaten werden zu animierten Karten-Videos und interaktiven Web-Karten.
> Projekt in [`Privat-Projekte`](../README.md).

- **Pfad im Repo:** `Privat-Projekte/Travel-Map-Generator/`
- **Adresse:** `https://flog93.github.io/Privat-Projekte/Travel-Map-Generator/`
- **Einstieg:** Übersichtsseite `https://flog93.github.io/Privat-Projekte/` verlinkt das Projekt
- **Sprache:** Oberfläche und Dokumentation deutsch, Code und Bezeichner englisch
- **Bauweise:** reines HTML/CSS/JavaScript (ES-Module), **kein Build-Schritt** –
  wie überall in diesem Repository

Technische Details: [`ARCHITECTURE.md`](ARCHITECTURE.md).

---

## 1. Ziel

Eine App, die rohe Reisedaten (manuelle Punkte, berechnete Routen, GPX-Tracks)
in eine animierte, visuell gestaltete Karte verwandelt – mit angehefteten
Medien, programmierbarer Kamerafahrt und Export als Video, Overlay-Spur oder
einbettbare interaktive Karte.

## 2. Harte Rahmenbedingungen („läuft in meiner GitHub")

Die App soll auf GitHub Pages laufen. Daraus folgt alles Weitere:

| Rahmenbedingung | Konsequenz für den Plan |
|---|---|
| Kein Server, kein Backend | Reine Client-App (Static Site). Alle Berechnungen, auch Video-Encoding, laufen im Browser des Nutzers. |
| Repository-Regel: kein Build-Schritt | Keine npm-Pakete im Repo. Fremdbibliotheken wie MapLibre liegen als Datei in `vendor/`, Typsicherheit kommt aus JSDoc plus `tsc --noEmit` über `npx`. Nur relative Pfade, damit lokal und auf Pages dasselbe gilt. |
| Repository ist öffentlich, keine Secrets möglich | API-Keys dürfen **nicht** ins Repo. Sie werden vom Nutzer einmalig in der App eingegeben und im `localStorage` gehalten. Default-Konfiguration braucht **keinen** Key. |
| GitHub Pages kann keine HTTP-Header setzen | Kein `SharedArrayBuffer` ohne Trick → kein multithreaded `ffmpeg.wasm`. Lösung: primär **WebCodecs** (nativ, hardwarebeschleunigt), optional `coi-serviceworker` für den `ffmpeg.wasm`-Fallback. |
| Keine Nutzer-Accounts, kein Cloud-Storage | Projekte und Medien liegen in IndexedDB im Browser, Austausch über Export/Import einer Projektdatei (`.tmgz`). |
| Pages-Repos haben Größengrenzen (~1 GB, 100 MB/Datei) | Nutzer-Fotos und -Videos werden **nicht** ins Repo geladen. Für das Einbetten erzeugt die App ein eigenständiges Viewer-Paket, das der Nutzer bewusst ablegt. |

**Offene Aktion für dich:** GitHub Pages im Repo einschalten
(*Settings → Pages → Source: GitHub Actions*). Das kann ich nicht für dich tun.

## 3. Architektur in drei Sätzen

1. **Kern (`core/`)** ist eine reine TypeScript-Bibliothek ohne DOM: Datenmodell,
   Routen-Geometrie, Zeitachse, Kamera-Interpolation. Vollständig unit-testbar
   und **deterministisch** – dieselbe Zeit ergibt immer denselben Kartenzustand.
2. **Editor (`app/`)** ist eine React-Oberfläche über MapLibre GL JS: Karte,
   Routen-Liste, Medien-Bibliothek, Timeline mit Keyframes.
3. **Export (`export/`)** fährt dieselbe Zeitachse Frame für Frame ab, wartet
   auf fertig geladene Kartenkacheln und schiebt jedes Bild in einen Encoder.
   Weil der Kern deterministisch ist, sieht der Export genauso aus wie die
   Vorschau – nur in Zielauflösung und ohne Ruckler.

## 4. Meilensteine

Jeder Meilenstein ist für sich benutzbar und endet mit Lint + Tests grün und
einem Deploy auf Pages.

### M0 – Gerüst und Übersichtsseite (erledigt)
- Projektordner `Travel-Map-Generator/` als reines HTML/CSS/JavaScript,
  ES-Module, keine Abhängigkeit außer der mitgelieferten MapLibre-Datei.
- Übersichtsseite (`index.html` im Hauptordner): Kacheln aller Projekte,
  hell und dunkel, Umschalter für alle Projekte gemeinsam.
- Gemeinsames Design in `shared/css/ui.css`, Hell/Dunkel in `shared/js/theme.js`.
- MapLibre-Karte mit drei keylosen Stilen (OpenFreeMap), Navigations- und
  Maßstabsregler.
- Fähigkeiten-Prüfung des Browsers für den späteren Video-Export, sichtbar in
  der Seitenleiste statt erst beim Exportversuch.
- `pages.yml` veröffentlicht die Übersicht und jeden Ordner mit einer
  `index.html`; `tests.yml` prüft Typen, Unit-Tests und alle Verweise.
- **Abnahme erfüllt:** 13 Unit-Tests grün, Typprüfung ohne Befund, Verweis-Test
  grün, Karte rendert im Browser mit Kacheln und Attribution (im Container mit
  Chromium geprüft). Offen bleibt nur das Einschalten von Pages im
  Repository – das geht nur von Hand.

### M1 – Datenmodell und Karte (erledigt)
- Projekt-Schema v1 (`js/core/model.js`, JSDoc-Typen) mit Wegpunkten und
  Etappen, reinen Operationen, Prüfung und Migrationshaken.
- Projekt in IndexedDB, Autosave mit Verzögerung, zuletzt offenes Projekt wird
  beim nächsten Besuch zurückgeholt.
- Export und Import als `.tmgz` – ein echtes ZIP, von Hand geschrieben mit der
  nativen `CompressionStream`, ohne Bibliothek.
- Manueller Modus: Punkte per Klick setzen, per Marker ziehen, benennen,
  löschen, mit Pfeilknöpfen oder Ziehen umsortieren; Luftlinien-Verbindung,
  Längenanzeige, „Alles zeigen".
- **Abnahme erfüllt:** Im Container mit Chromium geprüft – drei Punkte gesetzt,
  umbenannt, umsortiert; nach dem Neuladen im selben Profil sind Route,
  Reihenfolge, Namen und Länge unverändert da. Export lädt eine `.tmgz`
  herunter, die Pythons `zipfile` und `unzip -t` als gültig lesen; Import in ein
  leeres Profil stellt dieselbe Route wieder her, eine kaputte Datei bringt eine
  verständliche Meldung statt einer leeren Karte.

### M2 – Routing und GPX (Kapitel 1 deiner Beschreibung)
- Provider-Abstraktion für Routing mit Fähigkeiten-Tabelle.
- Smart Routing: Profile *Auto / Motorrad / Fahrrad / Zu Fuß*, Optionen
  „Autobahnen vermeiden", „Mautstraßen vermeiden", „Fähren vermeiden".
  Default-Anbieter keyless, optional HeiGIT/ORS-Key für mehr Kontingent.
- Geocoding-Suchfeld (Photon/Nominatim, konform mit Attribution und Rate-Limit).
- Fluglinie: Großkreis-Interpolation, als Bogen gezeichnet, mit Datumsgrenzen-
  Behandlung – kein Straßennetz.
- GPX-Import: Parser, Höhenprofil, Douglas-Peucker-Vereinfachung mit
  einstellbarer Toleranz, Zeitstempel übernehmen falls vorhanden.
- **Abnahme:** „Attilaplatz Berlin → Sächsische Schweiz, Motorrad, ohne
  Autobahn" liefert eine an Straßen gesnappte Route; ein 300-km-GPX-Track mit
  20 000 Punkten lädt flüssig.

### M3 – Animation und Kamera (Kapitel 4)
- Zeitachse: Route nach Bogenlänge parametrisiert, Geschwindigkeit pro
  Abschnitt, Pausen, Gesamtdauer.
- Indiana-Jones-Linie: progressives Nachzeichnen, Linienstil (Farbe, Breite,
  Strich, Glow), optional Spur-Verblassen.
- Fahrzeug-Marker folgt der Route mit korrektem Kurswinkel und Neigung in Kurven.
- Kamera-Modi: *Verfolgen*, *Totale*, *Überflug*, *Fix*; Start in der Totalen mit
  Zoomfahrt zum Startpunkt.
- Keyframes für Zoom, Neigung, Rotation, Geschwindigkeit; Bézier-Easing;
  Timeline-UI mit Scrubbing.
- **Abnahme:** Vorschau läuft bei 1080p mit ≥ 30 fps und ist nach Scrubbing an
  jeder Stelle bildgleich reproduzierbar.

### M4 – Video-Export (Kapitel 5, Teil 1)
- Offline-Renderer: Frame-Schrittbetrieb, Warten auf `idle` der Karte,
  Fortschrittsanzeige, Abbruch.
- MP4/H.264 über WebCodecs + Mediabunny-Muxer, Presets 9:16, 1:1, 16:9,
  Auflösung bis 4K, 24/30/60 fps.
- Audio-Spur: eine Musikdatei des Nutzers, Ein-/Ausblenden, Lautstärke.
- Fallback-Pfad für Browser ohne WebCodecs (singlethreaded `ffmpeg.wasm`,
  mit ehrlicher Warnung zur Dauer).
- **Abnahme:** 60 s Animation in 1080p/30 exportiert reproduzierbar als
  abspielbare MP4-Datei.

### M5 – Kartenstile und Topografie (Kapitel 2)
- Stil-Registry: Dark, Hell, Minimal-Vektor, Retro-Papier, Seekarte,
  Topografisch; Satellit und fotorealistisches 3D als Key-Option.
- 3D-Gelände über keylose Terrarium-DEM-Kacheln, Overdrive-Faktor,
  Hillshade, Himmel/Atmosphäre, Gebäude-Extrusion.
- Fahrzeug-Darstellung: Icon-Set (Motorrad, Auto, Fahrrad, Wanderer, Flugzeug,
  Schiff), Flugzeug mit Schatten; Konfiguration pro Abschnitt.
- **Abnahme:** Stilwechsel und Gelände-Schalter wirken ohne Projektverlust,
  Alpenpass-Route zeigt plastisches Relief.

### M6 – Medien und Storytelling (Kapitel 3)
- Medien-Bibliothek: Fotos/Videos per Drag & Drop, bleiben lokal; EXIF-GPS und
  -Zeit automatisch auf die Route gematcht, manuell korrigierbar.
- Ortsbezogene Pop-ups mit Anzeigedauer, Übergang, Position, Rahmenstil;
  optionale Pause der Reise.
- Text-Banderolen und Kapitel-Titel mit Vorlagen.
- Sprachnotizen: Aufnahme im Browser oder Datei, Abspielen am Ort.
- Historische Wetterdaten (Open-Meteo-Archiv, keyless) je Reisetag, als
  Regen-/Schnee-/Nebel-Overlay und optionale Datenanzeige.
- **Abnahme:** Ein Foto mit GPS-EXIF landet ohne Zutun am richtigen Punkt und
  erscheint im Export zur richtigen Sekunde.

### M7 – Alpha-Export für den Videoschnitt (Kapitel 5, Teil 2)
- Transparenter Hintergrund: Karte aus, nur Linie, Marker, Pop-ups, Text.
- Ausgabe: PNG-Sequenz als ZIP (verlustfrei, Alpha, überall importierbar),
  WebM/VP9 mit Alpha, sowie ProRes 4444 über `ffmpeg.wasm` –
  mit klar dokumentierten Längen- und Speichergrenzen im Browser.
- Beigelegtes `ffmpeg`-Kommando für Nutzer, die lokal umwandeln wollen.
- **Abnahme:** Die PNG-Sequenz lässt sich in DaVinci Resolve als Overlay über
  eigenes Material legen, Kanten sind sauber (Premultiplied korrekt behandelt).

### M8 – Interaktive Web-Karte und Einbetten (Kapitel 5, Teil 3)
- Viewer-Build: eigenständige, leichte Seite, die eine Projektdatei lädt –
  zoombar, klickbare Medienpunkte, Abspielknopf für die Animation.
- „Teilen"-Export erzeugt einen fertigen Ordner (`share/<id>/`) mit Viewer,
  Projektdatei und optimierten Medien plus iFrame-Schnipsel und Direktlink.
- Dokumentierter Weg, diesen Ordner ins Repo zu legen (Pages serviert ihn).
- **Abnahme:** Der iFrame-Code funktioniert in einem fremden Blog-Entwurf.

### M9 – Reife
- Projekt-Vorlagen und Beispielprojekt („Berlin → Sächsische Schweiz").
- Tastenkürzel, Undo/Redo, Autosave, Warnung bei ungespeicherten Änderungen.
- Ende-zu-Ende-Tests im echten Browser inklusive Frame-Hash-Vergleich gegen
  Referenzbilder (Playwright, außerhalb des Repos installiert).
- Benutzerhandbuch, Barrierefreiheit, Performance-Budgets im CI.

## 5. Nicht-Ziele

- Keine Server-Rendering-Farm, keine Nutzerkonten, kein Teilen über unsere
  Infrastruktur.
- Kein Nachbau eines Videoschnittprogramms – die App liefert die Kartenspur,
  geschnitten wird in Resolve/Premiere.
- Keine kommerzielle Nutzung fremder Gratis-Kontingente: Kartenanbieter werden
  korrekt attribuiert, Limits werden respektiert.

## 6. Risiken und wie der Plan sie auffängt

| Risiko | Umgang |
|---|---|
| Motorrad-Profil gibt es bei den Gratis-Routing-Anbietern nicht | Motorrad wird als Auto-Profil mit „Autobahnen vermeiden" und Vorliebe für kurvige Nebenstrecken abgebildet; die Oberfläche sagt das offen. Echtes Motorrad-Profil bleibt als Key-Option vorgesehen. |
| Video-Export im Browser ist schwer und browserabhängig | WebCodecs als schneller Hauptpfad, `ffmpeg.wasm` als langsamer Fallback, PNG-Sequenz als immer funktionierender Notausgang. Fähigkeiten werden beim Start geprüft und angezeigt. |
| ProRes/Alpha sprengt den Browser-Speicher | Harte Grenzen (Auflösung × Länge) vorab berechnen und warnen; PNG-Sequenz plus lokales `ffmpeg`-Kommando als dokumentierter Profi-Weg. |
| Satellit und fotorealistisches 3D brauchen bezahlte Keys | Als optionale Stile mit eigenem Key-Feld; die keylosen Stile bleiben vollwertig. |
| Große GPX-Tracks und viele Medien bremsen den Browser | Vereinfachung mit Toleranz, Medien-Thumbnails, Lazy Loading, Budget-Tests im CI. |
| Rate-Limits der Gratis-APIs | Ergebnisse cachen, Anfragen entprellen, Routen im Projekt persistieren, verständliche Fehlermeldungen statt stiller Ausfälle. |

## 7. Getroffene Entscheidungen (2026-10-06)

1. **MVP-Schnitt: die Kette M0–M4 zuerst.** Route anlegen → Karte → Animation →
   MP4-Export wird als Erstes durchgehend benutzbar. Stile (M5), Medien (M6),
   Alpha-Spur (M7) und Einbetten (M8) kommen danach auf dieses Fundament.
2. **Keyless als Default, Key-Felder optional.** Die App startet ohne jede
   Einrichtung (OpenFreeMap, AWS-Terrarium-DEM, Open-Meteo, keyless Routing).
   Im Einstellungsdialog gibt es optionale Felder für HeiGIT/ORS und MapTiler;
   gesetzt schalten sie mehr Routing-Kontingent, besseres Geocoding und die
   Satelliten-Stile frei. Kein Key wird jemals ins Repo geschrieben.
   → Konsequenz für die Umsetzung: jeder Provider muss ohne Key einen
   funktionierenden Pfad haben, und die Oberfläche graut aus, was fehlt.
3. **Export-Priorität: vertikales MP4 (9:16) für Social.** M4 liefert
   9:16 mit Musik über WebCodecs. Die Alpha-Spur für Resolve/Premiere bleibt
   M7, der iFrame-Viewer M8 – beide in dieser Reihenfolge, nicht vorgezogen.

Damit ist der Weg bis zum ersten Video festgelegt: **M0 → M1 → M2 → M3 → M4.**
