# Spezifikation: Motion-Blur-Werkzeug für GoPro-Material

**Stand:** 2026-11-02
**Status:** verbindlich für Stufe B, Umriss für Stufe C

---

## 1. Ziel

Eine eigenständige Windows-Anwendung, die Videodateien per Drag & Drop (einzelne
Dateien **oder** ganze Ordner) annimmt und mit hochwertigem, echt wirkenden
Motion Blur versieht.

**Qualität ist das Primärziel, Tempo das Sekundärziel.** Wo beides kollidiert,
gewinnt Qualität — aber die Anwendung sagt dem Nutzer immer vorher, was ihn
zeitlich erwartet.

## 2. Nicht-Ziele

Ausdrücklich nicht gebaut (YAGNI):

- Schnitt, Farbkorrektur, LUTs, Masking, Vorschau-Fenster, Zeitraffer
- Mehrere Encoder-Profile zur Auswahl durch den Nutzer (ein guter Satz, fest)
- Linux/macOS
- Kommandozeilenbedienung
- Austauschbare Decoder-Plugins (`bestsource`/`ffms2`/`lsmas`-Zoo)
- Freitext-Konfigurationsdateien, die der Nutzer von Hand editiert

## 3. Stack und globale Randbedingungen

| | |
|---|---|
| Backend | Rust (stable), **Tauri v2** |
| Frontend | pures HTML/CSS/JS, **kein npm, kein Bundler, kein Build-Schritt** |
| Tauri-Brücke | `app.withGlobalTauri = true` → `window.__TAURI__.*`, keine Imports |
| Video-Motor | `ffmpeg.exe` + `ffprobe.exe` als Tauri-**Sidecar** mitgeliefert |
| Tests | `cargo test`; alle Qualitätsmathematik in reinen Funktionen |
| Fehlerbehandlung | `thiserror` in der Bibliothek, **null `panic!`/`unwrap()` außerhalb von Tests** |
| Zahlen | Framerates sind `num_rational::Ratio<u32>`, **niemals `f32`/`i32`** |
| Sprache | Code-Bezeichner englisch, Kommentare und UI-Texte deutsch |
| Ausgabe | eine portable `.exe` plus Sidecars, ~10 MB + ffmpeg |

## 4. Die Physik — der Teil, den niemand herleiten kann

Frame-Blending erzeugt Unschärfe durch **Mitteln diskreter Samples**. N Samples
ergeben N Geisterbilder. Es wirkt nur dann wie Bewegungsunschärfe, wenn
aufeinanderfolgende Samples sich um ~1–2 Pixel verschieben.

### 4.1 Die Kernformel

Gegeben:
- `f_in` = Framerate des Materials, das in den Blend geht (nach optionaler Interpolation)
- `f_out` = Ziel-Framerate
- `θ` = Shutter-Angle in Grad (180° = klassischer Film-Look)

```
R      = f_in / f_out              Verhältnis, muss ganzzahlig sein
window = round(R * θ / 360)        Anzahl zu mittelnder Frames, min. 1
stride = R                         Schrittweite zwischen Ausgabeframes
samples = window                   das, was der Nutzer sehen will
```

Prüfbeispiele (gehören als Testfälle in `planner.rs`):

| f_in | f_out | θ | R | window | stride |
|---|---|---|---|---|---|
| 240 | 30 | 180° | 8 | 4 | 8 |
| 240 | 30 | 360° | 8 | 8 | 8 |
| 120 | 30 | 180° | 4 | 2 | 4 |
| 120 | 30 | 360° | 4 | 4 | 4 |
| 120 | 60 | 360° | 2 | 2 | 2 |
| 960 | 30 | 180° | 32 | 16 | 32 |

### 4.2 Wie viele Samples sind genug

Bei einer schnellen GoPro-Fahrt bewegt sich Vordergrund 1.000–2.000 px/s. Bei
120 fps sind das 8–17 px zwischen zwei Frames — zwei Samples im Abstand von
17 px sind eine **Doppelbelichtung, keine Unschärfe**.

Schwellen für `PlanWarning`:

| Samples | Bewertung | Verhalten |
|---|---|---|
| 1 | kein Blur | `NoBlur` — Blend überspringen |
| 2–3 | sichtbare Doppelkanten | `TooFewSamples` **warnen** |
| 4–7 | brauchbar, bei schnellen Schwenks sichtbar gestuft | `FewSamples` Hinweis |
| 8–15 | gut | keine Warnung |
| ≥ 16 | sehr gut, stufenlos | keine Warnung |

### 4.3 Die wichtigste Konsequenz für Stufe B

**Bei 240-fps-Material braucht Stufe B keine Interpolation, um gut auszusehen.**

```
1080p240  →  1080p30 @ 360°   =  8 Samples   ohne Interpolation, schnell
2,7K240   →  1080p30 @ 360°   =  8 Samples   ohne Interpolation, schnell
4K120     →  4K30    @ 360°   =  4 Samples   ohne Interpolation, schnell
4K120     →  4K30    @ 180°   =  2 Samples   zu wenig → Warnung
```

Interpolation (und damit Stufe C) wird nur gebraucht für 4K-Ausgabe, für 180°
bei 30 fps, oder für mehr als 8 Samples.

## 5. Profile

Der Nutzer wählt ein Profil, keine Einzelwerte. Einzelwerte sind unter
„Eigene Einstellungen" erreichbar.

| Profil | Ausgabe | Interpolation | θ | Samples typ. | Tempo |
|---|---|---|---|---|---|
| **Schnell** | 1080p, Quell-fps/4, **nie unter 24 fps** | nein | 360° | 1–8 | s. u. |
| **Gut** | 1080p30 | nein | 360° | 8 | ~0,5–1× Clipdauer |
| **4K** | 4K30 | nein | 360° | 4 | ~1–2× Clipdauer |
| **Referenz** | 1080p30 | `minterpolate` (CPU) | 180° | 16–32 | **10–60× Clipdauer** |

**Die Tempo-Angaben in dieser Tabelle sind Schätzungen, nicht abgeleitet.**
Bei θ = 360° leisten „Schnell" und „Gut" dieselbe Arbeit — beide lesen jeden
Quellframe. Der echte Hebel ist die Auflösung und ob lineares Licht an ist
(verdreifacht die Datenmenge). Aufgabe 1 (Messung) ersetzt diese Spalte durch
gemessene Werte.

**Untergrenze für „Schnell":** `Quell-fps/4` ergibt bei 30-fps-Material 7,5 fps
Ausgabe — unbrauchbar. Deshalb gilt: der Teiler wird so weit verkleinert, dass
die Ausgabe ≥ 24 fps bleibt; reicht auch Teiler 1 nicht, läuft die Quell-fps
unverändert durch und `LowOutputFramerate` warnt.

`Referenz` ist ausdrücklich als „nur für kurze Testclips" gekennzeichnet und im
UI mit der geschätzten Laufzeit versehen. Sie existiert, um die Qualitätsfrage
**vor** dem Bau von Stufe C zu beantworten.

## 6. Qualitätsregeln

Diese sind nicht verhandelbar, weil sie sichtbar sind:

1. **Mitteln in linearem Licht.** Gamma-codierte Werte zu mitteln macht Kanten
   zu dunkel und matschig. `zscale=t=linear` davor, zurück danach.
   Standardmäßig **an**.
2. **Mitteln mit ≥ 10 bit Präzision.** 8-bit-Mittelung erzeugt Banding im Blur.
   Niemals stillschweigend auf 8 bit zurückfallen.
3. **Farbmetrik aus der Datei lesen, nie annehmen.** Transfer, Matrix und
   Primaries kommen aus `ffprobe`. GoPro HERO 11+ kann HLG.
4. **Ehrliche Oberfläche.** Die Anwendung zeigt vor dem Start die Sample-Zahl
   und jede `PlanWarning` im Klartext. Sie gibt 2 Samples nicht als „Motion
   Blur" aus, ohne zu sagen, was das heißt.
5. **Preflight statt Scheitern mitten im Render.** Encoder-Verfügbarkeit,
   Pfade, Plattenplatz, Verhältnis-Ganzzahligkeit werden **vor** dem ersten
   Frame geprüft.

## 7. GoPro-Besonderheiten

- **Kapitel zusammenfügen.** `GX010123.MP4`, `GX020123.MP4`, … mit identischen
  letzten 4 Ziffern sind *ein* Dreh. Gruppieren und über den
  `concat`-Demuxer als eine Quelle behandeln.
- **`.LRV` und `.THM` ignorieren** (Vorschau- und Thumbnail-Dateien).
- **GPMF-Telemetriespur durchkopieren** (Stream mit
  `codec_tag_string=gpmd`), damit GyroFlow danach noch funktioniert.
- **Audio unverändert durchkopieren.** Die Dauer ändert sich beim Blenden
  nicht, also `-c:a copy`.
- **Stabilisierung gehört vor den Blur**, nicht danach — die Anwendung macht
  keine Stabilisierung, weist aber im UI darauf hin.

## 8. Datenmodell

Drei Typen, strikt getrennt. `BlurJob` ist der Wunsch, `MediaInfo` die
Tatsache, `Plan` die daraus berechnete Anweisung.

```rust
// Was der Nutzer will — serialisierbar, versioniert
struct BlurJob {
    schema_version: u32,              // 1
    input: InputSource,              // Single(PathBuf) | Chapters(Vec<PathBuf>)
    output_dir: Option<PathBuf>,
    profile: Profile,                 // Fast | Good | FourK | Reference | Custom
    output_fps: Ratio<u32>,
    shutter_angle: f32,
    weighting: Weighting,             // Equal | Gaussian { std_dev } | Pyramid | Ascending | Descending
    linear_light: bool,
    interpolation: Interpolation,     // None | Minterpolate { target_fps } | Rife { .. }  (Rife = Stufe C)
    target_height: Option<u32>,       // None = Quellauflösung
    bit_depth: BitDepth,              // Eight | Ten
}

// Was die Datei ist — aus ffprobe, einmal geparst
struct MediaInfo {
    path: PathBuf,
    width: u32, height: u32,
    fps: Ratio<u32>,                  // aus avg_frame_rate, NIEMALS i32
    duration_s: f64,
    pix_fmt: String,
    bit_depth: u8,
    color_transfer: Option<String>,
    color_matrix: Option<String>,
    color_primaries: Option<String>,
    audio_stream_count: u32,
    gpmf_stream_index: Option<u32>,
    rotation: i32,
    is_vfr: Option<bool>,            // None = unbekannt (r_frame_rate fehlt)
}

// Was zu tun ist — aus plan(), rein berechnet
struct Plan {
    media: MediaInfo,
    blend_input_fps: Ratio<u32>,      // nach Interpolation
    output_fps: Ratio<u32>,
    blend_window: u32,
    stride: u32,
    weights: Vec<f32>,                // normalisiert, Summe 1,0
    sample_count: u32,
    linear_light: bool,
    pixel_format: &'static str,
    scale_to: Option<(u32, u32)>,
    warnings: Vec<PlanWarning>,
    estimated_duration_s: f64,
}
```

**`plan(job: &BlurJob, media: &MediaInfo) -> Result<Plan, PlanError>` ist eine
reine Funktion.** Sie kennt keine Uhr, kein Dateisystem, keinen Prozess. Sie
ist der einzige Ort, an dem über das Aussehen entschieden wird — deshalb ist
sie vollständig testbar, und deshalb kann Stufe C sie unverändert benutzen.

## 9. Architektur

```
UI (HTML/CSS/JS)
  │  window.__TAURI__.core.invoke(…)
  ▼
commands.rs          dünne Tauri-Grenze, sonst nichts
  ├─ probe.rs        ffprobe → MediaInfo
  ├─ planner.rs      plan(job, media) → Plan        ← REIN, getestet
  │   └─ weights.rs  Gewichtungskurven              ← REIN, getestet
  ├─ preflight.rs    prüft, bevor irgendwas startet
  ├─ queue.rs        mehrere Jobs, Reihenfolge, Abbruch
  └─ backend/
      ├─ mod.rs          trait BlurBackend
      ├─ ffmpeg_cli.rs   Plan → Vec<String> → Prozess     (Stufe B)
      └─ cuda.rs         NVDEC → Compute → NVENC          (Stufe C, später)
```

Die Trennung `Plan` ↔ `BlurBackend` ist die Versicherung dafür, dass Stufe C
den Look nicht verändert: die Gewichte kommen aus dem Planer, nicht aus dem
Backend.

## 10. Stufe C — Umriss

Eigene Spezifikation und eigener Plan, erst wenn Stufe B läuft und die Messung
aus Aufgabe 1 vorliegt. Umriss:

- **NVDEC** zum Decodieren (größter einzelner CPU-Posten heute)
- **Compute-Shader** für Linearisierung + gewichtete Mittelung in einem Pass
  (bei 4 Frames ~3 Gsamples/s — auf der GPU praktisch gratis)
- **NVENC** zum Encodieren, Frames verlassen die VRAM nie
- **Interpolation** für echte Qualität: RIFE über ONNX Runtime + DirectML
  (zugänglicher als TensorRT, läuft auch auf AMD)
- Erwartung: **5–10× schneller** als Stufe B bei gleichem Look, CPU nahezu untätig

**Offene Frage, die die Messung beantworten muss:** Ob RIFE bei 4K überhaupt
erträglich ist. Grobe Erwartung 0,05–0,15× Echtzeit — ein 2-Minuten-Clip also
20–40 Minuten. Bei 1080p ist es machbar.

## 11. Entscheidungsprotokoll

| Entscheidung | Begründung |
|---|---|
| Tauri statt egui/WPF | zwei unabhängig prüfbare Schleifen (hinsehen vs. `cargo test`); HTML/CSS/JS ist die Technik, die der Autor täglich schreibt |
| ffmpeg-CLI statt libav-Bindings in Stufe B | kein eigener Videocode, eine `.exe` als Abhängigkeit, Wochen statt Monate |
| kein VapourSynth | VapourSynth-Frames liegen im Hauptspeicher; damit ist der Tempo-Gewinn aus Stufe C grundsätzlich unerreichbar |
| Shutter-Angle statt „intensity" | verständlich für jeden, der gefilmt hat; halbiert bei 180° zugleich den Rechenaufwand |
| `Ratio<u32>` statt `f32` für fps | 119,88 und 29,97 sind Brüche; Fließkomma-Rundung verschiebt das Blend-Fenster |
| Profile statt Einzelwerte | der Nutzer soll nicht Shutter-Angle und Ziel-fps gegeneinander ausrechnen müssen |
