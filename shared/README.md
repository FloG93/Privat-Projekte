# shared

Gemeinsamer Code aller Projekte in diesem Repository.

| Datei | Inhalt |
| --- | --- |
| `css/ui.css` | Farben als CSS-Variablen (hell und dunkel), Grundtypografie, Knöpfe, Chips, `.wrap` für die Seitenbreite |

Eingebunden wird immer **relativ**, damit alles lokal mit
`python3 -m http.server` und auf GitHub Pages gleich funktioniert:

```html
<link rel="stylesheet" href="../shared/css/ui.css" />
<link rel="stylesheet" href="css/app.css" />
```

Die eigene CSS kommt danach und darf einzelne Token überschreiben:

```css
:root {
  --accent: #fbbf24;
}
```

Hell/Dunkel merken sich alle Projekte gemeinsam unter dem Schlüssel
`privat-projekte.theme`; eigene Schlüssel beginnen mit dem Projektnamen
(`travel-map-generator.…`).
