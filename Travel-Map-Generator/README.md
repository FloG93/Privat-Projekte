# Travel-Map-Generator

Verwandelt Reisedaten (manuelle Punkte, berechnete Routen, GPX-Tracks) in
animierte Karten-Videos und interaktive, einbettbare Web-Karten.
Läuft vollständig im Browser – kein Server, keine Installation, keine Anmeldung.

**Öffnen:** <https://flog93.github.io/Privat-Projekte/Travel-Map-Generator/>

> **Stand: Meilenstein M0 – Gerüst.** Karte, gemeinsames Design und
> Auslieferung stehen. Routen, Animation und Video-Export folgen in M1–M4.

- [`PLAN.md`](PLAN.md) – Meilensteine M0–M9 mit Abnahmekriterien
- [`ARCHITECTURE.md`](ARCHITECTURE.md) – Aufbau, Datenmodell, Export-Pipeline, Grenzen

## Was geplant ist

| Meilenstein | Inhalt |
| --- | --- |
| M1 | Datenmodell, Projekt speichern, Punkte auf der Karte setzen |
| M2 | Routing (Auto, Motorrad, Fahrrad, zu Fuß), Fluglinien, GPX-Import |
| M3 | Animation der Linie, Fahrzeug-Marker, Kamerafahrt mit Keyframes |
| M4 | Video-Export als vertikales MP4 (9:16) mit Musik |
| M5–M9 | Kartenstile und 3D-Gelände, Medien und Wetter, Alpha-Spur für den Schnitt, einbettbare Karte, Reife |

## Aufbau

```
index.html         Die App – statisches Markup
css/app.css        Eigene Farbe und Layout (Rest kommt aus ../shared/css/ui.css)
js/main.js         Einstieg: verdrahtet Markup und Module
js/map/            Kartenstile und MapLibre-Einrichtung
js/export/         Prüfung, was der Browser beim Video-Export kann
vendor/maplibre-gl/  MapLibre unverändert, mit Lizenz und VERSION
tests/             node --test
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
