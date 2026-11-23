# BodenNivel – Entwurf

Ausgleichsmassen- und Laser-Aufmaßrechner. Stand 2026-11-23.
Umsetzung später durch ein anderes Modell nach dem Plan in
`docs/superpowers/plans/` – dieser Entwurf ist die Grundlage dafür.

## 1. Zweck

Auf der Baustelle (Rohbau, oft ohne Empfang) wird ein unebener Boden mit einem
Kreuzlinienlaser und einem Gliedermaßstab eingemessen: Abstand Boden →
Laserlinie in mm, in einem Raster von ca. 1 × 1 m. Die App nimmt diese Werte am
Smartphone auf, zeigt eine Draufsicht, an der man sieht, ob der Raum vollständig
aufgenommen ist, und berechnet daraus pro Raum und gesamt den Bedarf an
Ausgleichsmasse (Säcke, Paletten, Wasser) sowie das Soll-Maß zum Anzeichnen an
den Wänden.

## 2. Ziele, Nicht-Ziele, Anti-Ziele

**Ziele**
- Schnelle Einhand-Eingabe: Wert tippen → Enter/„+“ → nächste Rasterzelle.
- Draufsicht je Raum mit allen Messwerten im Raster, Lücken sofort sichtbar.
- Korrekte Mengen nach PROBAU-Standardwerten, alles einstellbar.
- Läuft offline, verliert nie Daten (Speichern bei jeder Eingabe).
- Laser umsetzen, ohne Rohwerte zu verfälschen.

**Nicht-Ziele (v1)**
- Freie Grundrisse mit schrägen Wänden (L-Räume u. ä. über abgewählte Zellen).
- Übernahme von Räumen aus dem Raumrechner (`raum/`) – später möglich, da
  gleiche Herkunft; Datenmodell soll dem nicht im Weg stehen.
- Grundierung, Randdämmstreifen, Kosten.
- Mehrere Projekte gleichzeitig synchronisieren / Cloud.

**Anti-Ziele** (wäre ein Fehlschlag, auch wenn es „funktioniert“)
- Ein fertiges Projekt hängt am Netz oder an einem CDN.
- Ein Eingabefehler beim Laser-Umsetzen verändert gespeicherte Rohwerte
  unwiderruflich.
- „2,5“ wird als 25 mm gelesen oder ein Wert geht beim Display-Sperren verloren.
- Die App rechnet mit unvollständigem Raster, ohne das deutlich zu sagen.

## 3. Abweichungen von der ursprünglichen Beschreibung (mit Begründung)

| Ursprünglich | Jetzt | Warum |
| --- | --- | --- |
| Tailwind CSS + Lucide per CDN | Design aus `shared/css/ui.css` + eigene `css/app.css`; Lucide-Icons als einzelne SVG-Dateien unverändert in `bodennivel/vendor/lucide/` (mit LICENSE, VERSION) | Repo-Regel: kein Build, keine CDN-/npm-Abhängigkeit, gemeinsames Design. Offline im Rohbau. |
| Freie Punktliste mit Positions-Chips | **Raster-Draufsicht** als Hauptweg; freie Punkte (mit Chips „Tür“, „Ecke NW“ …) zusätzlich | Bei gleichmäßigem 1-m-Raster ist der Mittelwert korrekt; Vollständigkeit sichtbar; Häufung in Senken verfälscht nichts. |
| Mittelwert über alle Punkte | Mittelwert nur über **Rasterpunkte**; freie Punkte zählen für $d_{\min}$ und $h_{\max}$, nicht für $\bar h$ | Freie Punkte liegen gezielt an Extremstellen und würden den Mittelwert verzerren. Räume ganz ohne Raster (WC) nutzen den Mittelwert der freien Punkte – mit Hinweis. |
| Laser-Umsetzen rechnet Punkte um | Rohwerte bleiben, jeder Punkt kennt seinen **Laser-Standort**; Korrektur wird beim Rechnen angewandt | Korrigierbar, nachvollziehbar, testbar. |
| ein $d_{\text{Soll}}$ | $d_{\text{Soll}}$ **je Laser-Standort** | Nach dem Umsetzen liegt die Linie anders; zum Anzeichnen braucht man den Wert des aktuell stehenden Lasers. |
| Säcke nur pro Raum aufrunden | pro Raum aufgerundet **und** Gesamt = ⌈Σ Masse / Sackgewicht⌉ | Verbundene Räume werden in einem Zug gegossen; Summe der Einzelrundungen überschätzt. Beide Zahlen werden angezeigt. |
| Ø Schichtdicke über alle Räume | **flächengewichtet** | Ein WC darf nicht so viel zählen wie das Wohnzimmer. |
| globaler Schalter „schwellenlos“ | globaler Schalter + pro Raum „gehört zum Verbund“ (Standard: ja) | Z. B. Bad mit anderem Aufbau ausnehmen, ohne alles abzuschalten. |
| Paletten | ⌈Säcke/48⌉ **und** „2 Paletten + 7 Säcke“ | Für die Bestellung ist die Aufteilung nützlicher. |

## 4. Fachlogik (reine Funktionen in `js/calc.js`)

Alle Längen intern in **mm** (Messwerte) bzw. **m** (Raum), Flächen in m².
Eingaben akzeptieren Komma, auch halbe mm (`parseNum` wie im Raumrechner).

### 4.1 Laser-Standorte
- Projekt hat Liste `setups` (S1, S2, …). S1 hat Offset 0. Genau einer ist
  „aktiv“; neue Messwerte bekommen die `setupId` des aktiven Standorts.
- „Laser umsetzen“ (Dialog): Referenzpunkt wählen oder frei benennen,
  Wert **vorher** $d_v$ (mit bisherigem Standort) und **nachher** $d_n$ (neuer
  Standort). $\Delta = d_n - d_v$. Neuer Standort: `offset = offsetAlt + Δ`.
- Korrigierter Wert eines Punkts: $d_i^{*} = d_i^{roh} - \text{offset}(S)$
  (bezogen auf die Linie von S1).
- Standorte bleiben editierbar (vorher/nachher korrigieren → alle Werte
  stimmen sofort wieder). Löschen nur, wenn kein Punkt ihn nutzt.

### 4.2 Bezugsgruppen
- Schalter „Räume schwellenlos verbinden“ an: alle Räume mit
  `inGroup = true` bilden eine Gruppe; übrige Räume je eine eigene.
- Schalter aus: jeder Raum ist eine eigene Gruppe.
- Pro Gruppe: $d_{\min} = \min(d_i^{*})$ über alle Punkte (Raster + frei) der
  Gruppe; $d_{\text{Soll}} = d_{\min} - t_{\min}$ (Mindestschichtdicke).
- Anzeige zum Anzeichnen je Standort: $d_{\text{Soll}}(S) = d_{\text{Soll}} + \text{offset}(S)$.

### 4.3 Je Raum
- $h_i = d_i^{*} - d_{\text{Soll}}$ für jeden Punkt.
- $\bar h$ = Mittel der Raster-$h_i$ (oder der freien, falls kein Raster).
- $h_{\max} = \max h_i$ (alle Punkte); Warnung, wenn $h_{\max} > t_{\max}$.
- Fläche: Standard Länge × Breite − abgewählte Zellen; manuell überschreibbar.
- Masse $= A \cdot \bar h \cdot c \cdot (1 + r/100)$; Säcke $=\lceil m/w\rceil$;
  Wasser = Säcke × Wasser/Sack.
- Räume ohne Messwerte: keine Mengen, Hinweis „noch nicht gemessen“.
- Unvollständiges Raster: Mengen werden mit vorhandenen Punkten gerechnet, aber
  deutlich als „vorläufig – X von Y Punkten“ markiert.

### 4.4 Gesamt (Dashboard)
- Σ Masse (kg, ab 1000 kg zusätzlich t), Säcke gesamt = ⌈Σ m / w⌉,
  daneben Σ der Raum-Säcke; Paletten ⌈Säcke/48⌉ und Aufteilung;
  Wasser = Säcke gesamt × Wasser/Sack; Ø Schichtdicke flächengewichtet.
- Liste der Warnungen (Grenzwert, unvollständig).

### 4.5 Farbstufen der Kacheln
≤ 10 mm grün · > 10 bis ≤ 25 mm gelb/orange · > 25 mm rot; leere Zelle
grau gestrichelt; abgewählte Zelle schraffiert. Grenzen als Konstanten.

## 5. Raster

- Eingabe: Länge L (Ost-West, „Breite der Draufsicht“) und Breite B in m,
  Rastermaß a (Standard 1,0 m, einstellbar 0,5–2,0).
- Spalten $= \max(1, \text{round}(L/a))$, Zeilen analog; Zellen gleich groß
  ($L/\text{Spalten}$), Messpunkt = Zellmitte. Die App zeigt die Abstände
  (z. B. „erster Punkt 0,42 m von der Wand, dann alle 0,84 m“), damit man mit
  dem Gliedermaßstab anzeichnen kann.
- Lage: Zeile 1 oben = Nordwand (Kompass-Beschriftung N/O/S/W an der
  Draufsicht), Startecke wählbar (Standard NW). Reihenfolge Schlangenlinie.
- Zelle antippen → auswählen; langes Drücken/Menü → „Zelle gehört nicht zum
  Raum“ (an/aus).
- Raum ohne Raster (WC, Flur): Länge/Breite leer lassen, Fläche direkt
  eingeben, nur freie Punkte.
- Rastergröße ändern, wenn schon Werte da sind: nur mit Rückfrage; Werte
  werden nach (Zeile, Spalte) behalten, soweit noch im Raster, sonst verworfen.

## 6. Oberfläche (mobile first)

Eine Seite mit drei Ansichten (Hash-Routing `#/`, `#/raum/<id>`, `#/druck`):

1. **Projekt / Dashboard**: Projektname, Verbund-Schalter, Räume als Karten
   (Name, Fläche, Fortschritt „18/20“, Säcke, Warn-Symbol), „+ Raum“, darunter
   Einkaufsliste. Aufklappbar: Materialeinstellungen, Laser-Standorte,
   Export/Import/Druck.
2. **Raum**: Kopf (Name, Fläche, Verbund-Haken, Bearbeiten), **Draufsicht**
   (SVG, füllt die Breite, Zellen mit Wert bzw. $h_i$ umschaltbar),
   Eselsbrücke „Kleiner Wert = hoher Boden · Großer Wert = tiefe Senke“,
   freie Punkte mit Chips, Ergebnis-Karte des Raums.
   **Eingabeleiste** unten fixiert: aktuelle Zelle („R3 · S2“), großes Feld
   `type="text" inputmode="decimal" enterkeyhint="next"`, Knöpfe „+“
   (speichern & weiter), „überspringen“, „zurück“; Anzeige aktiver Laser-Standort
   + Knopf „Laser umsetzen“. Fokus bleibt nach Speichern im Feld.
3. **Druckansicht**: je Raum eine Seite: Draufsicht mit Rohwerten und $h_i$,
   $d_{\text{Soll}}$ je Standort groß, Mengen; am Ende Gesamtliste.
   `@media print`, `window.print()`.

Touch-Ziele ≥ 48 px, hoher Kontrast, Hell/Dunkel über `shared/js/theme.js`.
Löschen (Raum, Punkt, Standort) mit Rückfrage; Raum löschen mit „Rückgängig“.

```
┌─────────────────────────────┐
│ ← Wohnzimmer   21,3 m² ⚠    │
│        N                    │
│  [ 8][12][15][11][ 9]       │
│ W[10][18][24][17][12]O      │
│  [ 9][14][▣ ][  ][  ]       │
│        S     13/20 gemessen │
├─────────────────────────────┤
│ R3·S3  [ 16,5 ] mm  [ + ]   │
│ Laser: S2 (−12 mm) [umsetzen]│
└─────────────────────────────┘
```

## 7. Daten und Speicherung

- `localStorage`-Schlüssel `bodennivel.v1` (ein Dokument: Projektliste +
  aktives Projekt). Speichern nach jeder Änderung, synchron; zusätzlich bei
  `visibilitychange`/`pagehide`.
- Schema mit `version: 1`; `migrate()` für spätere Versionen, unbekannte
  Felder beim Import ablehnen statt still verwerfen → Fehlermeldung.
- Modell (JSDoc-Typen in `js/model.js`):
  - `Project { id, name, connected, settings, setups[], activeSetupId, rooms[] }`
  - `Settings { consumption 1.6, bagKg 20, minLayer 3, maxLayer 30 (Schnellwahl 30/40), reservePct 5, waterPerBag 4.6, bagsPerPallet 48, gridSize 1.0 }`
  - `Setup { id, name, offset, ref?: { label, before, after } }`
  - `Room { id, name, length, width, areaOverride?, inGroup, startCorner, grid: { cols, rows, cells: Cell[] }, freePoints: Point[] }`
  - `Cell { row, col, excluded, value?: number, setupId? }`
  - `Point { id, label, value, setupId }`
- Export: JSON-Datei `bodennivel-<projekt>-<datum>.json`; Import mit Prüfung,
  fragt „ersetzen“ oder „als neues Projekt“.
- Mehrere Projekte (Baustellen) in einer Liste, einfache Auswahl.

## 8. Technik und Repo-Einbindung

- Ordner `bodennivel/`: `index.html`, `css/app.css`, `js/` (`main.js`,
  `model.js`, `store.js`, `calc.js`, `grid.js`, `format.js`, `ui/*.js`),
  `sw.js`, `manifest.webmanifest`, `icons/`, `vendor/lucide/`, `tests/`,
  `README.md`.
- Reines ES-Modul-JS mit JSDoc, fällt unter die strenge Typprüfung
  (`tsconfig.json` nimmt `*/js/**` automatisch auf).
- Service Worker: Cache-Präfix `pp-bodennivel-`, beantwortet nur eigene
  `SHELL`-Pfade, löscht nur eigene Caches (wie `raum/sw.js`). Bei jeder
  Dateiänderung Version hochzählen.
- Tests `bodennivel/tests/*.test.mjs` (node --test) für `calc`, `grid`,
  `model/migrate`, `format/parseNum`; Script `test:bodennivel` in
  `package.json`, Job in `tests.yml`.
- `index.html` erst anlegen, wenn die App vorzeigbar ist (Regel aus
  CLAUDE.md); bis dahin Entwicklung über `dev.html`, die am Ende umbenannt
  wird. Danach Karte auf der Übersichtsseite und Zeile in `README.md`.
- `npm run check` vor jedem Commit.

## 9. Ansätze (betrachtet)

- **A Raster-Draufsicht + freie Punkte** – gewählt. Korrekter Mittelwert,
  Vollständigkeit sichtbar, passt zur Messweise (1-m-Raster).
- B nur freie Punktliste – einfach, aber Mittelwert verzerrt, keine Übersicht.
- C Raster mit Flächen-Interpolation – bei 1 m kaum genauer, deutlich
  aufwendiger.

## 10. Dem Umsetzer überlassen

Konkrete Farbtöne/Abstände innerhalb von `shared/`, Icon-Auswahl,
Animationen, Aufteilung der `ui/`-Module, genaue Texte von Hinweisen.
