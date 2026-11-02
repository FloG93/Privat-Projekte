# Motion-Blur-Werkzeug (eigenes Projekt, nicht Teil dieser Website)

Hier liegen nur die **Planungsdokumente** für ein eigenständiges
Windows-Werkzeug, das GoPro-Videos mit Motion Blur versieht. Es gehört
nicht zu den Web-Projekten dieses Repos und wird von `pages.yml` nicht
veröffentlicht (kein `index.html`).

| Datei | Inhalt |
|---|---|
| `SPEC.md` | Die Entscheidungen: Physik des Frame-Blendings, Shutter-Angle-Formel, Sample-Schwellen, Profile, Datenmodell, Qualitätsregeln |
| `PLAN-stufe-b.md` | Fahrplan in 14 Aufgaben für Stufe B (ffmpeg-CLI als Motor), mit Testcode je Aufgabe |

## Warum das hier liegt und nicht im Projekt-Repo

Der eigentliche Code ist Rust mit Tauri und verträgt sich nicht mit den
Regeln dieses Repos (reines HTML/CSS/JS, kein Build-Schritt). Er braucht ein
eigenes Repository. Diese beiden Dokumente liegen hier, damit die Planung
nicht verloren geht, bis es das gibt.

## Stand der Umsetzung

Der Kern ist als Rust-Bibliothek `motionblur-core` umgesetzt (Gewichtungs-
kurven, ffprobe-Auswertung, Planer, ffmpeg-Argumentbau) — dieser Code liegt
noch nicht in einem Repository.

**Wichtig bei Aufgabe 1:** Die Filterketten im Fahrplan sind inzwischen
gemessen und korrigiert. Eine frühere Fassung benutzte
`tmix=frames=W,framestep=S`; das erzeugt ein fast leeres erstes Fenster und
verschiebt alle Werte. Die Begründung samt Messwerten steht in `PLAN-stufe-b.md`,
Aufgabe 1, Schritt 4 und 6.
