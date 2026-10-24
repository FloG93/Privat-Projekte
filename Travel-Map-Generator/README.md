# Travel-Map-Generator

Verwandelt Reisedaten (manuelle Punkte, berechnete Routen, GPX-Tracks) in
animierte Karten-Videos und interaktive, einbettbare Web-Karten.
Läuft vollständig im Browser – kein Server, keine Installation, keine Anmeldung.

**Öffnen:** <https://flog93.github.io/Privat-Projekte/Travel-Map-Generator/>

> **Stand: Meilenstein M1 – Datenmodell und Karte.** Punkte setzen, ziehen,
> benennen, umsortieren; die Reise wird automatisch gespeichert und ist beim
> nächsten Besuch wieder da. Export und Import als `.tmgz`. Echtes Routing,
> Animation und Video-Export folgen in M2–M4.

- [`PLAN.md`](PLAN.md) – Meilensteine M0–M9 mit Abnahmekriterien
- [`ARCHITECTURE.md`](ARCHITECTURE.md) – Aufbau, Datenmodell, Export-Pipeline, Grenzen

## Was geplant ist

| Meilenstein | Inhalt |
| --- | --- |
| M2 | Routing (Auto, Motorrad, Fahrrad, zu Fuß), Fluglinien, GPX-Import |
| M3 | Animation der Linie, Fahrzeug-Marker, Kamerafahrt mit Keyframes |
| M4 | Video-Export als vertikales MP4 (9:16) mit Musik |
| M5–M9 | Kartenstile und 3D-Gelände, Medien und Wetter, Alpha-Spur für den Schnitt, einbettbare Karte, Reife |

## Bedienung

- **Klick auf die Karte** hängt einen Punkt hinten an die Reise.
- **Marker ziehen** verschiebt einen Punkt.
- In der Liste lassen sich Punkte **benennen**, mit **▲ ▼ oder Ziehen
  umsortieren** und mit **✕ entfernen**.
- Gespeichert wird von selbst. „Sichern …" legt eine `.tmgz`-Datei ab,
  „Öffnen …" liest sie wieder ein – das ist auch das Backup-Format.

## Aufbau

```
index.html         Die App – statisches Markup
css/app.css        Eigene Farbe und Layout (Rest kommt aus ../shared/css/ui.css)
js/main.js         Einstieg: verdrahtet Markup und Module
js/core/           Reine Logik: Projekt-Schema (model.js), Geometrie (geo.js)
js/map/            Kartenstile, MapLibre-Einrichtung, Route und Marker
js/state/          Kleiner Zustandsspeicher und Verzögerung fürs Autosave
js/storage/        IndexedDB (db.js) und das .tmgz-Format (archive.js)
js/ui/             Die Wegpunktliste
js/export/         Prüfung, was der Browser beim Video-Export kann
vendor/maplibre-gl/  MapLibre unverändert, mit Lizenz und VERSION
tests/             node --test, inklusive einer Fremdpacker-Datei als Fixture
```

Kein Build-Schritt, nur relative Pfade. Lokal starten:

```bash
python3 -m http.server 8080    # oder: npm start (im Hauptordner)
# http://localhost:8080/Travel-Map-Generator/
```

## Was ohne API-Key funktioniert

Alles, was aktuell drin ist. Die Basiskarten kommen keylos von
[OpenFreeMap](https://openfreemap.org/); 3D-Gelände (ab M5) nutzt die freien
Terrarium-Kacheln von AWS, historisches Wetter (ab M6) Open-Meteo. Optionale
Keys für mehr Routing-Kontingent und Satellitenbilder kommen in M2 bzw. M5 und
werden nur im Browser gespeichert – niemals im Repository.

## Lizenz

MIT. MapLibre GL JS in `vendor/` steht unter 3-Clause BSD
([`LICENSE.txt`](vendor/maplibre-gl/LICENSE.txt)).
