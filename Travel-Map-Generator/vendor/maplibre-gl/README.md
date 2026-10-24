# vendor/maplibre-gl

MapLibre GL JS, unverändert aus dem npm-Paket `maplibre-gl` übernommen.
Version steht in [`VERSION`](VERSION), Lizenz (3-Clause BSD) in
[`LICENSE.txt`](LICENSE.txt).

| Datei | Wofür |
| --- | --- |
| `maplibre-gl.mjs` | Die Bibliothek. In sich geschlossen, keine weiteren Importe. |
| `maplibre-gl-worker.mjs` | Der Web-Worker. Muss mitgeliefert werden, sonst bleibt die Karte leer. |
| `maplibre-gl.css` | Pflicht-Stile für Bedienelemente, Attribution und Popups. |
| `maplibre-gl.d.mts` | Typen, damit `npm run typecheck` die Aufrufe gegen die echte API prüft. |

## Aktualisieren

```bash
npm pack maplibre-gl@<version>          # außerhalb des Repos auspacken
cp package/dist/maplibre-gl.mjs        Travel-Map-Generator/vendor/maplibre-gl/
cp package/dist/maplibre-gl-worker.mjs Travel-Map-Generator/vendor/maplibre-gl/
cp package/dist/maplibre-gl.css        Travel-Map-Generator/vendor/maplibre-gl/
cp package/dist/maplibre-gl.d.ts       Travel-Map-Generator/vendor/maplibre-gl/maplibre-gl.d.mts
cp package/LICENSE.txt                 Travel-Map-Generator/vendor/maplibre-gl/
echo "<version>" >                     Travel-Map-Generator/vendor/maplibre-gl/VERSION
```

Danach `npm test` und `npm run typecheck` laufen lassen: MapLibre hat zwischen
großen Versionen schon Dinge verschoben, die nur der Typprüfer findet – in
Version 6 etwa `preserveDrawingBuffer` nach `canvasContextAttributes` und den
Standard-Export zu benannten Exporten.
