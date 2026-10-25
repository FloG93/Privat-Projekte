# Musik-Poster-Generator

> **Online:** <https://flog93.github.io/Privat-Projekte/poster/> (freigegebene
> Fassung) und <https://flog93.github.io/Privat-Projekte/poster/beta/> (aktueller
> Stand) – im Repository [`Privat-Projekte`](../README.md).
>
> Umgezogen aus [`FloG93/Arbeit`](https://github.com/FloG93/Arbeit), Adresse
> unverändert `/poster/`. Beide Kanäle sind übernommen: Der Release-Kanal zeigt
> denselben Stand wie dort (Version 1.0.0), der Beta-Kanal den aktuellen
> (1.2.0-beta). Weil der Zeiger in `release.json` auf einen Commit **dieser**
> Historie zeigen muss, steht der freigegebene Stand als eigener Commit
> (`80d0611`) vor dem Beta-Stand. Dieser Commit darf nicht umgeschrieben oder
> mit anderen zusammengefasst werden – sonst fehlt dem Release-Kanal sein Stand.

Künstler, Album, Song **oder Film** suchen und daraus automatisch ein
druckreifes Poster generieren — Motiv groß im Bild, dazu ein scanbarer Code
(echter Spotify-Code, sonst ein QR-Code), in einem von zwölf Design-Stilen.
Kein Login, kein eigener Server — reines HTML/CSS/JavaScript.

Der Umschalter oben in der Suche bestimmt die Art: **Musik** (neun Stile, Daten
von iTunes/Spotify) oder **Film** (drei Stile, Daten von TMDB). Er tauscht nicht
die Oberfläche aus, sondern beschriftet dieselben Felder um — „Künstler" wird
„Regie", „Tracklist" wird „Besetzung" — und blendet die passenden Stile ein.

## Starten

```bash
cd poster
python3 -m http.server 8000
```

Dann `http://localhost:8000/` öffnen. Kein Service Worker, kein Manifest —
die App braucht nur den HTTP-Server, damit `fetch()` und Web-Fonts laufen;
direktes Öffnen per `file://` scheitert an CORS.

## Kanäle und Freigabe

| Kanal | Adresse | Stand |
| --- | --- | --- |
| Release | `/poster/` | der in `poster/release.json` eingetragene Commit |
| Beta | `/poster/beta/` | der aktuelle Stand des Branches |

Beide liegen auf derselben Seite, die Dateien aber nur einmal im Repo: der
Release-Kanal wird beim Deploy mit `git archive <commit> poster` aus der
Historie ausgepackt. Freigeben heißt deshalb, einen Zeiger umzusetzen, statt
Ordner zu kopieren — `poster/release.json`:

```json
{ "version": "1.1.0", "commit": "9a827f6", "released": "2026-09-12" }
```

Der Push dieser Änderung löst den Workflow aus, danach liefert `/poster/` den
eingetragenen Stand. Zurückrollen ist derselbe Handgriff mit einem älteren
Commit, und jede Freigabe steht als eigener Commit in der Historie.

Git-Tags wären der übliche Weg dafür. Sie scheiden hier aus: der Git-Proxy der
Entwicklungsumgebung weist Tag-Pushes ab (`the remote end hung up
unexpectedly`), Branch-Pushes gehen. Ein Zeiger im Repo leistet dasselbe, ohne
von der Umgebung abzuhängen.

Jeder Kanal zeigt oben ein Abzeichen mit Kanal, Version und Commit — Beta in
Gelb, damit die beiden nicht zu verwechseln sind — und einen Link auf den
jeweils anderen. Dieselbe Zeile steht als erste im Diagnose-Protokoll: bei
jeder Fehlermeldung ist damit belegt, welcher Stand gemeint war. Die Version
des Beta-Kanals steht in `poster/version.json`, die freigegebene in
`poster/release.json`. Fehlt der Zeiger oder ist der Commit unbekannt, bekommt
auch der Release-Kanal den aktuellen Stand — besser eine ungekennzeichnete
Fassung als eine 404.

## Formate

| Format | Maße | Auflösung |
| --- | --- | --- |
| A4 / A3 / A2 | 21 × 29,7 bis 42 × 59,4 cm | 300 dpi |
| A1 | 59,4 × 84,1 cm | 210 dpi |
| A0 | 84,1 × 118,9 cm | 150 dpi |
| 50 × 70 | Plakatmaß | 250 dpi |
| 70 × 100 | Kinoplakat | 170 dpi |

Die Auflösung ist gestaffelt, weil nicht der Drucker die Grenze setzt, sondern
die Canvas-Fläche des Browsers: A2 bei 300 dpi sind 34,8 Megapixel und laufen
nachweislich durch, A1 wären bei 300 dpi schon 70 und A0 gar 140. Jedes Format
bleibt deshalb unter etwa 35 Megapixeln. Fachlich ist das ohnehin richtig — ein
A0-Plakat wird aus zwei Metern Abstand gesehen, 150 dpi sind dort üblich. Der
Dateiname nennt die tatsächliche Auflösung.

Die Plakatmaße haben andere Seitenverhältnisse als die A-Reihe (1:1,40 und
1:1,43 gegen 1:1,414). Vorschau, Wand-Ansicht und Layout rechnen deshalb mit
dem Verhältnis des gewählten Formats statt mit einem festen Wert.

## Datenquellen

- **Suche**: primär die [iTunes Search API](https://performance-partners.apple.com/search-api)
  (kein Login, CORS-fähig), wahlweise nach Song, Album oder Künstler. Ist im
  Bereich „Spotify-Zugang" ein eigener, kostenloser Spotify-Client (Client-ID +
  Secret, siehe [developer.spotify.com](https://developer.spotify.com/dashboard))
  hinterlegt, sucht die App stattdessen zuerst in Spotifys eigenem Katalog —
  über den Client-Credentials-Flow, also App-seitige Anmeldung ohne
  Nutzer-Login/Redirect.
- **Künstlersuche** liefert kein Poster, sondern die Diskografie: ein Klick auf
  den Künstler listet seine Alben, neueste zuerst (iTunes `lookup?entity=album`
  bzw. Spotify `/artists/{id}/albums`). Von dort geht es wie gewohnt weiter.
- **Cover**: erst die von der Suche gelieferte Artwork-URL (Apple bis zur Größe
  des hinterlegten Masters, Spotify höchstens 640 px). Schlägt das fehl, sucht
  die App über MusicBrainz + Cover Art Archive nach einem Ersatz; schlägt auch
  das fehl, gibt es ein Platzhalter-Cover plus manuellen Upload. „Schärferes
  Cover suchen" stellt beide Quellen nebeneinander zur Auswahl.
- **Filme**: [TMDB](https://www.themoviedb.org). Apple hat seine Filmsuche
  abgeschaltet (`media=movie` antwortet mit 403, `entity=movie` mit null
  Treffern), und eine schlüsselfreie Quelle für Plakate gibt es nicht —
  Filmplakate sind geschützt und liegen in keiner freien Bilddatenbank. TMDB
  passt technisch: API und Bild-CDN senden beide
  `Access-Control-Allow-Origin: *`, und `/t/p/original` liefert 2000 × 3000 px,
  also 285 dpi auf A4 und 202 auf A3. Ein Aufruf holt über `append_to_response`
  Stab, Freigaben und Bilder mit: Tagline, Laufzeit, Genre, Studio, FSK aus
  `release_dates`, Besetzung und Billing Block aus `credits` — und mit Glück den
  Original-Titelschriftzug als transparentes PNG aus `images.logos`. Der
  kostenlose Schlüssel liegt wie die Spotify-Daten nur im Browser.
- **Tracklist und Albumangaben** (Titel, Gesamtlänge, Label, genaues Datum):
  bei Spotify aus dem vollständigen Album-Objekt, bei iTunes aus
  `lookup?entity=song`. Findet die eigene Quelle nichts, sucht die App das
  Album über Interpret + Albumtitel bei der jeweils anderen. Alles Geladene
  bleibt im Editor frei überschreibbar.
- **Code**: „Spotify-Code" ist nur wählbar, wenn eine Spotify-URI vorliegt
  (direkt aus der Spotify-Suche, oder — bei hinterlegten Zugangsdaten — im
  Hintergrund über eine Zusatzsuche aufgelöst) und sich das öffentliche,
  loginfreie Scannable-Code-Bild von `scannables.spotify.com` laden lässt.
  Sonst greift automatisch ein selbst gezeichneter QR-Code, der zum passenden
  `open.spotify.com`-Link (falls eine URI bekannt ist), sonst zum
  Apple-Music-Link, sonst zur Spotify-Suche nach Künstler + Titel führt.

## Stile

| Stil | Aufbau |
| --- | --- |
| **Tracklist-Klassiker** | Cover, Titelzeile mit Code daneben, volle Tracklist, Farbpalette und Eckdaten in der Fußzeile |
| **Now Playing** | Poster als Player-Oberfläche: Cover mit runden Ecken, Fortschrittsbalken, Laufzeit, Transporttasten |
| **Swiss / Editorial** | Cremegrund, Farbbalken, riesiger Interpretenname, Albumtitel rechts, Tracklist dreispaltig unten |
| **Pantone-Karte** | Cover als aufgeklebtes Foto, Namenskärtchen und Farbfächer daneben, Titelblock und Tracklist unten |
| **Liner Notes** | Cover groß, darunter Trennlinie, links die Tracklist, rechts Titel, Palette, Datum und Label |
| **Vinyl-Hülle** | Getönter Passepartout-Grund, Name und Titel oben, Platte ragt seitlich aus der Cover-Hülle |
| **Minimalistisch** | Cover, Titel, Interpret, Wellenform-Balken in der Akzentfarbe, Laufzeit |
| **Vintage / Vinyl-Retro** | Doppelte Rahmenlinie, Cover als Plattenlabel auf gezeichneter Schallplatte, Serifen-Display |
| **Grunge / Konzertflyer** | Dunkler Grund, Duoton-Cover, Risskanten, gestempelte Schreibmaschinenschrift |
| **Key Art** (Film) | Motiv randlos, Darstellerzeile, Titelschriftzug, Startzeile, Billing Block, FSK |
| **Minimal** (Film) | Flächige Farbe aus dem Motiv, Plakat als eingesetztes Bild im 2:3-Format, Titel und Regie groß |
| **Kinoprogramm** (Film) | Das Plakat als Eintrittskarte: Motiv, Perforation, Angaben als Tabelle, Strichcode |

## Funktionsumfang

| Bereich | Stand |
| --- | --- |
| Suche nach Song, Album oder Künstler über iTunes, optional Spotify | fertig |
| Künstlertreffer klappt die Diskografie auf, neueste Alben zuerst | fertig |
| Deutscher Store (`country=DE`), 25 Treffer, Doppeltreffer zusammengefasst | fertig |
| Tracklist, Gesamtlänge, Label und Datum automatisch laden | fertig |
| Cover-Fallback über MusicBrainz/Cover Art Archive, manueller Upload | fertig |
| Auflösungsanzeige und dpi-Warnung fürs gewählte Format | fertig |
| „Schärferes Cover suchen": Apple- und CAA-Ausgaben zur Auswahl | fertig |
| Notfall-Hochrechnung (Lanczos + Unscharfmaske), nur bei zu wenig dpi | fertig |
| 9 Stile (siehe Tabelle oben) | fertig |
| Editor: Text, Tracklist, Cover, Code-Typ, Akzentfarbe, Größe frei editierbar | fertig |
| Automatische Farbpalette aus dem Cover, frei überschreibbar | fertig |
| Echter Spotify-Code oder QR-Code, je nach Verfügbarkeit wählbar | fertig |
| Explicit-Kennzeichen aufs Cover, automatisch vorbelegt | fertig |
| Wand-Vorschau im Wohnzimmer, maßstabsgetreu, Rahmen in drei Farben | fertig |
| Export als PNG und PDF, A4/A3/A2 bei echten 300 dpi | fertig |
| Manuelles Anlegen ganz ohne Suche/Internetzugriff | fertig |

## Was die Datenquellen nicht hergeben

- **Künstler-Logos** (der gesetzte Schriftzug einer Band) liefert keine der
  Schnittstellen — sie sind Markenzeichen. Stattdessen wird der Name gesetzt.
- **Künstlerfotos** hat nur Spotify. iTunes liefert zu Künstlern gar kein Bild;
  die Trefferliste zeigt dort einen gezeichneten Schattenriss.
- **Aufnahmejahr** gibt es nirgends, nur das Veröffentlichungsdatum.
- **Label** kennt nur Spotify als eigenes Feld. Bei iTunes wird es aus der
  Copyright-Zeile abgeleitet („℗ 2013 Daft Life Limited, under exclusive…" →
  „Daft Life Limited") — eine Heuristik, deshalb ist das Feld editierbar.
- **Cover-Auflösung** begrenzt den sinnvollen Druck. Apple deckelt bei der
  Auflösung des hinterlegten Masters: eine Anfrage nach `3000x3000` liefert
  dieselben Bytes wie `2000x2000`, bei vielen Alben real nur 1500 px. Spotify
  gibt höchstens 640 px. Das Cover Art Archive hält dagegen den Originalscan
  der jeweiligen Ausgabe, häufig größer — und sendet `Access-Control-Allow-Origin: *`,
  ist also ohne getaintete Canvas exportierbar. Unter dem Cover steht deshalb
  immer die echte Auflösung samt geschätzter dpi im gewählten Format, rot ab
  etwa 150 dpi. „Schärferes Cover suchen" stellt Apple- und CAA-Ausgaben zur
  Wahl — bewusst als Knopf mit Auswahl, weil über Namen gematcht sonst still
  das Cover einer anderen Ausgabe (Remaster, Deluxe, Single) auf dem Poster landet.
- **Hochrechnen bringt keine Details zurück.** Der Knopf „Notfall:
  hochrechnen" erscheint nur unter etwa 220 dpi und ersetzt die weiche
  Standard-Interpolation des Browsers durch Lanczos plus leichte
  Unscharfmaskierung. Gemessen an einem Testcover steigt der mittlere
  Kantenkontrast um rund ein Viertel — die Kanten matschen also weniger, aber
  erfundene Schärfe bleibt erfundene Schärfe. Echte Pixel gehen vor.
- **Das Explicit-Kennzeichen** ist nachgezeichnet, nicht das Originallogo des
  RIAA-Markenzeichens.
- **MusicBrainz** wird hier nur für Cover-Art genutzt, nicht für Tracklists.
- **Filme brauchen zwingend einen TMDB-Schlüssel.** Ohne ihn bleibt für Film
  nur der manuelle Weg: Plakat hochladen und die Felder selbst füllen.
- **Der Original-Titelschriftzug** ist nicht zu jedem Film erfasst. Was hochkant
  ankommt, ist bei TMDB falsch einsortiert und wird verworfen — ein
  Titelschriftzug ist immer breiter als hoch; dann wird der Titel gesetzt.
- **FSK-Logos** sind Marken wie das Explicit-Zeichen und deshalb nachgezeichnet.
- **TMDB verlangt Attribution**, mit vorgeschriebenem Wortlaut und Logo. Beides
  steht im Block „TMDB-Zugang". Kommerzielle Nutzung bräuchte eine eigene
  Vereinbarung mit TMDB; privat ist die Nutzung frei.

## Wissenswertes zur Umsetzung

Alle drei ISO-A-Formate haben dasselbe Seitenverhältnis (1:√2). Deshalb
zeichnet ein einziger, größenunabhängiger Layoutcode je Stil (Koordinaten
relativ zu Breite/Höhe) sowohl die kleine Live-Vorschau als auch den Export
— beim Export ändert sich nur die Pixelauflösung, nicht das Layout.

Fremde Bilder (Cover, Spotify-Code) werden ausschließlich mit
`crossOrigin="anonymous"` geladen. Fehlen die CORS-Header des jeweiligen
Servers, bricht das Laden dadurch sauber mit einem Fehler ab und die App
weicht automatisch aus (MusicBrainz → Platzhalter-Cover, Spotify-Code → QR-Code)
— statt einen Export zu erzeugen, der an einer „getainteten" Canvas scheitert.

Schriften werden vor dem ersten Rendern explizit über die Font-Loading-API
geladen (`document.fonts.load(...)`), nicht nur per `@font-face` deklariert.
Ein Font, der nirgends im DOM sichtbar ist, wird von Browsern sonst nie
geladen — Canvas-Text bliebe beim Systemfont hängen.

Spotify-Zugangsdaten landen ausschließlich in `localStorage` dieses Browsers
und werden nur direkt an `accounts.spotify.com`/`api.spotify.com` gesendet.
Es gibt keinen eigenen Server, der sie sehen oder weiterleiten könnte — genau
deshalb ist die Konfiguration optional und pro Browser lokal, nicht Teil des
Repos.

Die Farbpalette entsteht aus einer 48-Pixel-Miniatur des Covers per
Bucket-Histogramm, nicht per k-Means: Farben werden nach Häufigkeit,
Sättigung und Nähe zur mittleren Helligkeit gewichtet, damit dominante
Weiß- oder Schwarzflächen im Cover nicht automatisch zur Akzentfarbe werden.

Die Tracklist setzt sich selbst: Spaltenzahl nach Titelanzahl, dann die größte
Schrift, die in die Höhe passt — und anschließend noch einmal verkleinert, bis
auch der längste Titel in seine Spalte passt. Erst wenn das an der Untergrenze
nicht reicht, wird mit „…" gekürzt. Ohne diesen zweiten Schritt stand in der
dreispaltigen Variante hinter jedem zweiten Titel ein Auslassungszeichen.

Auf dem iPad scheiterte in Brave jede Abfrage nach der ersten mit „Load
failed" — WebKits Wortlaut dafür, dass die Verbindung nicht zustande kam.
Safari auf demselben Gerät lief dabei durch, ebenso Brave auf PC und Android;
es liegt also weder an der API (`itunes.apple.com` sendet
`Access-Control-Allow-Origin: *` und drosselt bei zwölf Abfragen nicht) noch an
WebKit allein, sondern an Braves eigener Anfrage-Pipeline auf iOS.

Dagegen stehen zwei Ebenen. `request()` wiederholt dreimal mit wachsender Pause
(0/400/1400 ms) statt einmal nach 250 ms — ein zu schneller zweiter Versuch
greift dieselbe tote Verbindung aus dem Pool wieder ab. Kommt `fetch`
überhaupt nicht durch, laufen die drei iTunes-Endpunkte über JSONP: ein
`<script>`-Tag nimmt einen anderen Weg durch den Browser, ohne CORS und an
blockierten XHR-Pfaden vorbei. Der Preis dafür ist real — JSONP führt Code der
Gegenseite in dieser Seite aus —, deshalb ist es Rückfallebene und gilt nur für
Apples eigene API über HTTPS.

Verschärft hatte das eine eigene Unart: die Cover-Suche über MusicBrainz lud
jedes Bild per `fetch` nur zum Dasein-Test und las den Body nie aus; eine
solche Antwort hält in WebKit die Verbindung offen. Geprüft wird jetzt gar
nicht mehr, das entscheidet der Ladeversuch des Bildes selbst.

Weil sich der iPad-Fehler von hier aus nicht nachstellen lässt, hat die App
einen Abschnitt „Diagnose": ein Protokoll im Speicher der Seite, das jeden
API-Aufruf mit Weg, Ergebnis und **Dauer** festhält, dazu Browserkennung,
Service-Worker-Status und Cache-Namen. Die Dauer ist dabei die eigentliche
Auskunft — bricht eine Anfrage nach wenigen Millisekunden ab, wurde sie
abgelehnt, bevor etwas über die Leitung ging; eine echte Netzstörung braucht
länger. „Verbindung testen" prüft zusätzlich alle beteiligten Hosts einzeln
gegen die eigene Herkunft, und nach einem Fehlschlag läuft automatisch eine
Gegenprobe an einen anderen Host. Das Protokoll verlässt das Gerät nicht.

Die Poster-App bringt selbst keinen Service Worker mit — der des Raumrechners
liegt aber auf derselben Herkunft und hat damit die ganze Site im Scope. Seine
erste Fassung cachte jede Anfrage darin, also auch diese App, und lieferte sie
danach eingefroren aus: neues HTML mit altem JavaScript, die Initialisierung
brach ab, die Suche reagierte nicht mehr. Sichtbar wurde das nur auf Geräten,
auf denen der Raumrechner schon einmal lief. `app/sw.js` cacht jetzt
ausschließlich die eigenen Dateien aus `ASSETS`; die Cache-Version wanderte auf
v6, damit die alte samt Poster-Resten gelöscht wird. Weil ein reparierter
Worker betroffene Geräte aber erst erreicht, wenn er nachgeladen wird, räumt
`poster/js/sw-recovery.js` beim Start die eigenen Einträge aus jedem Cache und
lädt einmalig neu — überall sonst ein No-Op.

Die Wand-Vorschau hängt das Poster über ein Sofa, und zwar maßstabsgetreu:
`room.svg` zeigt einen Ausschnitt von 130 cm Wandbreite, daraus rechnet
`updateWallScale()` die Breite des Rahmens in Prozent. Ein A4-Poster nimmt dort
16 % der Bildbreite ein, ein A2 32 % — der Größenunterschied, den man sonst
erst nach dem Drucken sieht. Die Szene ist gezeichnetes SVG statt Foto: kein
Lizenzthema, ein paar Kilobyte, und sie lässt sich gegen ein echtes Foto
tauschen, indem `room.svg` ersetzt wird (gleicher Ausschnitt, gleiche 130 cm).

Spotify-Code und QR-Code haben verschiedene Formate — ein breiter Streifen
gegen ein Quadrat. Die Stile geben deshalb nur eine Box samt Ausrichtung vor,
gezeichnet wird darin je nach Codeart unterschiedlich; sonst klebte der QR-Code
dort in der Ecke, wo der Spotify-Streifen bündig säße.

## Aufbau

```
poster/
  index.html            Einstiegspunkt
  version.json          Version des Beta-Kanals
  release.json          Zeiger auf den freigegebenen Commit
  img/tmdb.svg          Logo für die vorgeschriebene TMDB-Attribution
  build.js              Kanal/Version/Commit — beim Deploy je Kanal erzeugt
  styles.css            Design-Tokens, Formulare, Wand-Vorschau
  room.svg              gezeichnete Wohnzimmerwand für die Wand-Vorschau
  fonts/                Fonts für alle drei Stile, offline mitgeliefert (woff2)
  vendor/               jsPDF und ein QR-Code-Generator, offline mitgeliefert
  js/
    api.js              Suche, Tracklist/Albumangaben, Spotify-Anbindung
    color.js            Farbpalette aus dem Cover extrahieren
    parts.js            geteilte Bausteine: Tracklist, Farbfelder, Player, Platte
    qrcode.js           Wrapper um den QR-Code-Generator
    log.js              Diagnose-Protokoll (bleibt auf dem Gerät)
    sw-recovery.js      räumt Reste des Raumrechner-Workers aus dem Cache
    tmdb.js             Filmdaten und Plakate von TMDB
    upscale.js          Notfall-Hochrechnung kleiner Cover (Lanczos + Unscharfmaske)
    export.js           PNG-/PDF-Export bei echten 300 dpi (A4/A3/A2)
    utils.js            Canvas-, Farb-, Datums- und Text-Hilfsfunktionen
    main.js             Zustand, Verkabelung, Live-Vorschau
    styles/             ein Modul je Stil, alle mit derselben draw(ctx, W, H, model)
      filmkeyart.js     filmminimal.js  filmticket.js
      tracklist.js      nowplaying.js   swiss.js
      pantone.js        linernotes.js   vinylsleeve.js
      minimal.js        vintage.js      grunge.js
```

Ein Stil ist eine Datei mit einer einzigen Funktion `draw(ctx, W, H, model)`.
Alle Koordinaten darin sind Vielfache von `W` und `H`, nie feste Pixel — deshalb
zeichnet derselbe Code die 720-Pixel-Vorschau und das A2-Poster mit 4961 Pixeln
Breite. Ein neuer Stil braucht nur diese Datei, einen Eintrag in `index.html`
und eine Zeile in der Stilauswahl.
