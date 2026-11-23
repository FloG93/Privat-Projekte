# BodenNivel

Ausgleichsmassen-Rechner für unebene Böden. Auf der Baustelle misst du mit
Kreuzlinienlaser und Gliedermaßstab den Abstand Boden → Laserlinie in einem
Raster von etwa 1 × 1 m. BodenNivel nimmt die Werte am Smartphone auf, zeigt
eine Draufsicht und berechnet pro Raum und insgesamt, wie viel Ausgleichsmasse
du brauchst – samt dem Maß zum Anzeichnen an den Wänden.

**Online:** <https://flog93.github.io/Privat-Projekte/bodennivel/> – läuft
nach dem ersten Laden auch ohne Netz und lässt sich zum Home-Bildschirm
hinzufügen.

## Bedienung auf der Baustelle

1. **Raum anlegen:** Name, Länge (Ost–West) und Breite (Nord–Süd) in Metern.
   Daraus entsteht das Raster; die App zeigt, in welchem Abstand du anzeichnen
   musst. Räume ohne Raster (WC) bekommen nur eine Fläche und freie Punkte.
2. **Messen:** Wert in mm tippen, Enter oder „+“ – die Auswahl springt in
   Schlangenlinie zur nächsten Zelle, das Feld bleibt offen. „Zurück“ und
   „Überspringen“ liegen daneben; eine Zelle antippen wählt sie gezielt.
3. **Zelle gehört nicht zum Raum** (L-Raum, Nische): lange drücken.
4. **Freie Punkte:** Chips wie „Ecke NW“ oder „Tür“ für gezielt gemessene
   Stellen. Sie zählen für den höchsten Punkt und die maximale Schicht, nicht
   für den Mittelwert.
5. **Laserhöhe und Einheit:** Unten in der Eingabeleiste „Höhe …“ antippen. Steht der
   Laser z. B. auf 30 cm und du liest 30,4 cm ab, zeigt die Draufsicht **+4**
   (mm) in der Zelle. Eingabe wahlweise in cm (30,4) oder mm (304). Ein Wert,
   der weit von der Laserhöhe abweicht (z. B. Einheit vertauscht), fragt vor dem
   Speichern nach. Gespeichert wird immer der abgelesene Wert; die Laserhöhe
   ändert nur die Anzeige, nicht das Anzeichen-Maß.
6. **Laser umsetzen:** Wenn die Linie nicht mehr passt: einen Punkt messen,
   Laser umstellen, denselben Punkt noch einmal messen. Die App rechnet alle
   Werte auf die Linie des ersten Standorts um; die Rohwerte bleiben stehen.
7. **Ergebnis:** je Raum und als Einkaufsliste (Masse, Säcke, Paletten,
   Wasser). Die Druckansicht gibt je Raum eine Seite mit Draufsicht und
   Anzeichen-Maß aus.

Kleiner Wert = hoher Boden, großer Wert = tiefe Senke.

## Formeln

Gemessen wird der Abstand $d$ von der Laserlinie zum Boden (mm).

- Höchster Punkt der Gruppe: $d_{\min}$ (korrigiert auf die Linie von S1).
- Soll-Maß: $d_{\text{Soll}} = d_{\min} - t_{\min}$ (Mindestschichtdicke).
- Schichtdicke je Punkt: $h_i = d_i - d_{\text{Soll}}$.
- Masse je Raum: $m = A \cdot \bar h \cdot c \cdot (1 + r/100)$; $\bar h$ ist
  der Mittelwert der **Rasterpunkte**, $c$ der Verbrauch in kg/(mm·m²), $r$
  die Reserve in Prozent.
- Säcke je Raum aufgerundet; **gesamt** $\lceil \sum m / w \rceil$, denn
  verbundene Räume werden in einem Zug gegossen. Beide Zahlen stehen in der
  Einkaufsliste.
- Mit „Räume schwellenlos verbinden“ teilen die Räume einen gemeinsamen
  $d_{\min}$; einzelne Räume lassen sich ausnehmen.

Standardwerte (alle einstellbar): Verbrauch 1,6 kg/(mm·m²), Sack 20 kg,
Mindestschicht 3 mm, Maximalschicht 30 mm (Schnellwahl 30/40), Reserve 5 %,
Wasser 4,6 L je Sack, 48 Säcke je Palette, Rastermaß 1,0 m.

Ist das Raster unvollständig, rechnet die App mit den vorhandenen Punkten und
kennzeichnet das Ergebnis als **vorläufig**.

## Daten

Alles liegt im `localStorage` dieses Geräts (Schlüssel `bodennivel.v1`),
gespeichert wird bei jeder Eingabe. Nichts verlässt das Gerät. Als Sicherung
dient der Export (Daten und Druck → Exportieren, eine JSON-Datei); der Import
prüft die Datei streng und lässt die vorhandenen Daten bei Fehlern unberührt.
Ist der Speicher nicht verfügbar (privates Fenster), zeigt die App ein Banner.

## Entwicklung

Reines HTML/CSS/JavaScript ohne Build. Fachlogik in `js/` (DOM-frei, getestet),
Oberfläche in `js/ui/`.

```bash
npm start            # http://localhost:8080/bodennivel/
npm run check        # Typen, Tests, Verweise
```

Entwurf: `docs/superpowers/specs/2026-11-23-bodennivel-design.md`.
Icons: [Lucide](https://lucide.dev) (ISC), siehe `vendor/lucide/`.
