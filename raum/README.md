# Raumrechner

> **Online:** <https://flog93.github.io/Privat-Projekte/raum/> – im Repository
> [`Privat-Projekte`](../README.md).
>
> Umgezogen aus [`FloG93/Arbeit`](https://github.com/FloG93/Arbeit) (dort Ordner
> `app/`, Adresse `/raum/`). Inhalt unverändert bis auf den Service Worker: Er hat
> ein eigenes Cache-Präfix (`pp-raumrechner-`), weil beide Fassungen auf derselben
> Herkunft `flog93.github.io` liegen und sich sonst gegenseitig die Caches
> löschen würden. Die gespeicherten Daten (`localStorage`, IndexedDB) hängen an
> der Herkunft und sind in beiden Fassungen dieselben.

Kleine Web-App, um unterwegs Wand-, Decken- und Bodenflächen zu berechnen —
mit Abzügen für Fenster und Türen, automatisch gezeichnetem Grundriss und
Export für Angebot und Kalkulation.

Läuft ohne Build-Schritt: reines HTML/CSS/JavaScript, installierbar auf dem
Android-Homescreen, funktioniert offline.

## Starten

Die App braucht einen HTTP-Server (wegen Service Worker und Manifest —
direktes Öffnen der Datei per `file://` reicht nicht):

```bash
python3 -m http.server 8000     # im Hauptordner des Repositories
```

Dann `http://localhost:8000/raum/` im Browser öffnen.

Auf dem Android-Smartphone: Seite über HTTPS aufrufen und im Chrome-Menü
„Zum Startbildschirm hinzufügen“ wählen. Danach startet sie wie eine native
App im Vollbild und rechnet auch ohne Netz weiter.

## Funktionsumfang

| Bereich | Stand |
| --- | --- |
| Projekte: mehrere nebeneinander, Name und Datum frei editierbar | fertig |
| Räume: leer anlegen, duplizieren, auf Null zurücksetzen, löschen | fertig |
| Rückgängig direkt nach jedem Löschen oder Zurücksetzen | fertig |
| Raumformular: Höhe, 3–8 Wände, Nord/Ost/Süd/West, Ecken für L-Form | fertig |
| Abzüge mit Presets (Fenster, Zimmertür, Terrassentür, freie Fläche) | fertig |
| Netto groß / brutto klein, Decke und Boden getrennt | fertig |
| Ein Preis pro m² und eine Standardhöhe fürs ganze Projekt | fertig |
| Grundriss automatisch aus der Wandliste, Öffnungen mit Abstand ab Ecke | fertig |
| Speicherung auf dem Gerät, Fotos in IndexedDB | fertig |
| Excel-/CSV-Export mit Abzügen im Detail | fertig |
| PDF-Angebot: Deckblatt + eine Seite je Raum mit Grundriss und Fotos | fertig |
| Fotos pro Raum: Kamera und Galerie, Vollbild-Ansicht | fertig |
| Schriften mitgeliefert — offline identisches Schriftbild | fertig |

## Wissenswertes zur Umsetzung

Ein neuer oder zurückgesetzter Raum ist wirklich leer: vier Wände mit Länge 0,
alle Flächen 0,0 m². Ein vorbelegter 4 × 3-m-Raum sah aus, als hätte
„Zurücksetzen" nichts getan. Erhalten bleiben nur der Name und die
Standardhöhe des Projekts. Solange keine Maße erfasst sind, zeigen Grundriss
und PDF einen Hinweis statt einer entarteten Zeichnung.

`render()` wirft die gesamte Oberfläche weg und baut sie neu auf. Jedes Feld
trägt deshalb ein stabiles `data-fkey`, über das Fokus und Cursorposition
danach wiederhergestellt werden — sonst reißt jede Neuzeichnung den Nutzer aus
dem Feld, in dem er gerade tippt. Der Hinweis-Balken liegt aus demselben Grund
außerhalb von `#app` und außerhalb des App-Zustands: sein Ausblende-Timer hat
früher die ganze Seite neu gebaut.

Zahlenfelder sind bewusst **kein** `type="number"`. Dieses Feld verschluckt das
Komma, das eine deutsche Tastatur liefert: aus „2,75" wurde 275, eine
Raumhöhe von 275 Metern — ohne jede Fehlermeldung. Stattdessen `type="text"`
mit `inputmode="decimal"`: der Ziffernblock bleibt, beide Trennzeichen gehen.

Das PDF entsteht über den Druckdialog des Browsers („Als PDF speichern"), nicht
über eine mitgelieferte Bibliothek — das ist der einzige Weg, der auf Android
und am Rechner gleich funktioniert.

Fotos werden beim Aufnehmen auf max. 1600 px verkleinert. Das Vollbild liegt in
IndexedDB, in localStorage steht nur ein kleines Vorschaubild: ein paar Dutzend
Baustellenfotos als base64 würden sonst das ~5-MB-Limit sprengen und das ganze
Projekt am Speichern hindern. Gelöschte Fotos bleiben zunächst liegen, damit
Rückgängig sie zurückholen kann; verwaiste Bilder räumt der nächste Start weg.

Die Schriften liegen als variable Fonts im Ordner `raum/fonts` und werden
mitgeliefert statt von einem CDN geholt — ein Service Worker cacht nur
Anfragen an die eigene Herkunft, sonst sähe die installierte App offline
anders aus. Je Familie reicht eine Datei für alle Schnitte (zusammen ~57 kB).

Gespeicherte Projekte aus der ersten Fassung werden beim ersten Start
automatisch ins neue Format überführt; der alte Eintrag bleibt als Sicherung
liegen.

## Aufbau

```
raum/                   die eigentliche App
  index.html            Einstiegspunkt
  app.js                UI, Geometrie- und Flächenberechnung, Export
  styles.css            Design-Tokens und Layout
  sw.js                 Service Worker, Cache-first für den App-Shell
  manifest.webmanifest  Installierbarkeit auf Android
  icons/                Launcher-Icons (192/512, normal und maskable)

project/                Entwurf aus Claude Design (Referenz, nicht ausgeliefert)
  Raumrechner.dc.html   der freigegebene Entwurf
  HANDOFF.md            Original-Hinweise aus dem Design-Handoff
  _ds/                  Design-System-Tokens des Entwurfs

chats/                  Gesprächsverlauf aus dem Entwurf — hier steht,
                        was gewünscht war und wo die Entscheidungen fielen
```

Die Rechenlogik steckt in `raum/app.js` in `geo()` und `calc()`:
`geo()` läuft die Wandliste ab, dreht an jeder Ecke nach links oder rechts und
bildet daraus das Polygon (Bodenfläche über die Gaußsche Trapezformel);
`calc()` macht daraus Umfang, Brutto-Wandfläche, Abzüge, Netto und Preis.

---
