# Motion-Blur-Werkzeug, Stufe B — Implementierungsplan

> **Für agentische Worker:** ERFORDERLICHE SUB-SKILL: `superpowers:subagent-driven-development` (empfohlen) oder `superpowers:executing-plans`, um diesen Plan Aufgabe für Aufgabe umzusetzen. Schritte benutzen Checkbox-Syntax (`- [ ]`) zur Verfolgung.

**Ziel:** Eine eigenständige Windows-App, die Videodateien und Ordner per Drag & Drop annimmt und sie mit ffmpeg zu hochwertigem Motion Blur verarbeitet.

**Architektur:** Tauri v2. Rust-Backend mit einer **reinen** `plan()`-Funktion, die als einzige über das Aussehen entscheidet, und einem `BlurBackend`-Trait, hinter dem in Stufe B die ffmpeg-CLI und in Stufe C eine GPU-Pipeline steckt. Frontend ist pures HTML/CSS/JS ohne Build-Schritt und spricht nur über Tauri-Commands mit dem Backend.

**Tech Stack:** Rust stable · Tauri v2 (`withGlobalTauri`) · `serde`, `thiserror`, `num-rational` · ffmpeg/ffprobe als Sidecar · HTML/CSS/JS ohne npm

**Spec:** `docs/superpowers/specs/2026-11-02-motionblur-spec.md`

## Global Constraints

- Framerates sind **immer** `num_rational::Ratio<u32>`, niemals `f32` oder `i32`.
- **Null `panic!`, `unwrap()`, `expect()` außerhalb von `#[cfg(test)]`.** Jeder Fehler ist ein `thiserror`-Typ und erreicht das UI als Text mitsamt ffmpeg-stderr.
- Frontend: **kein npm, kein Bundler, kein Build-Schritt.** Tauri-Zugriff ausschließlich über `window.__TAURI__.*`.
- **Tauri v2**, nicht v1. Bei jedem Prompt ausdrücklich nennen.
- Code-Bezeichner englisch, Kommentare und alle UI-Texte deutsch.
- Mitteln geschieht in **linearem Licht** und mit **≥ 10 bit** Präzision. Nie stillschweigend 8 bit.
- Farbmetrik (Transfer, Matrix, Primaries) wird aus `ffprobe` gelesen, nie angenommen.
- Commit nach jeder Aufgabe. Commit-Betreff deutsch im Imperativ.

## Review Focus

Diese fünf Eingaben beißen in der Praxis und werden von keiner naheliegenden Aufgabe automatisch abgedeckt. Jede hat unten ihren Test in der Aufgabe, die den Code besitzt.

1. **Quell-fps ist kein ganzzahliges Vielfaches der Ausgabe** (119,88 → 30, 29,97-Material). Der Planer muss mit Brüchen rechnen und bei nicht-ganzzahligem `R` eine Warnung statt eines gerundeten Fensters liefern. → Aufgabe 5
2. **VFR-Material.** GoPro lässt bei Hitze Frames fallen; `avg_frame_rate` ≠ `r_frame_rate`. Muss erkannt und gemeldet werden, weil das Blend-Fenster sonst wandert. → Aufgabe 4
3. **Pfade mit Umlaut, Leerzeichen oder über 260 Zeichen.** Argumente gehen als `Vec<String>` an den Prozess, niemals über eine zusammengesetzte Kommandozeile. → Aufgabe 6
4. **Ordner-Drop mit gemischtem Inhalt** — Fotos, `.LRV`, Unterordner, eine defekte Datei. Die Queue darf nicht an einer Datei sterben. → Aufgabe 10
5. **Abbruch mitten im Rendern.** Teildatei muss gelöscht, der ganze Prozessbaum beendet werden (ffmpeg startet Kindprozesse). → Aufgabe 12

## Dateistruktur

| Datei | Verantwortung |
|---|---|
| `src-tauri/src/main.rs` | Tauri-Setup, Command-Registrierung |
| `src-tauri/src/commands.rs` | Tauri-Grenze; ruft nur weiter, enthält keine Logik |
| `src-tauri/src/model.rs` | `BlurJob`, `Profile`, `Weighting`, `Interpolation`, serde |
| `src-tauri/src/media.rs` | `MediaInfo` |
| `src-tauri/src/probe.rs` | ffprobe-JSON → `MediaInfo` |
| `src-tauri/src/weights.rs` | Gewichtungskurven — **rein** |
| `src-tauri/src/planner.rs` | `plan()`, `Plan`, `PlanWarning` — **rein** |
| `src-tauri/src/backend/mod.rs` | `trait BlurBackend` |
| `src-tauri/src/backend/ffmpeg_cli.rs` | `Plan` → ffmpeg-Argumente → Prozess |
| `src-tauri/src/progress.rs` | `-progress pipe:1`-Parser |
| `src-tauri/src/preflight.rs` | Prüfungen vor dem Start |
| `src-tauri/src/queue.rs` | Job-Queue, Abbruch |
| `src-tauri/src/gopro.rs` | Kapitel-Gruppierung, GPMF, Dateifilter |
| `src-tauri/src/errors.rs` | `thiserror`-Typen |
| `ui/index.html`, `ui/css/*.css`, `ui/js/*.js` | Oberfläche, buildfrei |

---

## Aufgabe 1: Messung und Qualitätsreferenz (kein App-Code)

Dies ist das **Tor** für den ganzen Plan. Sie entscheidet, welche Profile überhaupt gebaut werden und ob Stufe C je nötig ist. Nichts anderes im Projekt hat so viel Wirkung pro Stunde.

**Files:**
- Create: `docs/messung.md`
- Create: `benchmarks/` (die erzeugten Clips, nicht eingecheckt)

**Interfaces:**
- Consumes: nichts
- Produces: die Entscheidung, welche Profile in Aufgabe 5 implementiert werden; die reale Sample-Zahl, die „gut genug" aussieht

- [ ] **Schritt 1: Testmaterial wählen**

Einen echten GoPro-Clip mit schneller Bewegung, 10–20 Sekunden, und wenn möglich zwei Varianten: einmal 4K120, einmal 1080p240 oder 2,7K240.

- [ ] **Schritt 2: CPU-Decode-Decke messen**

```bash
ffmpeg -i GX010123.MP4 -f null -
```

Notiere `fps=` und Wandzeit. Das ist die Obergrenze ohne Hardware-Decode.

- [ ] **Schritt 3: NVDEC-Decke messen**

```bash
ffmpeg -hwaccel cuda -hwaccel_output_format cuda -i GX010123.MP4 -f null -
```

Der Unterschied zu Schritt 2 ist der Gewinn, den Stufe C allein beim Decodieren holt.

- [ ] **Schritt 4: Die Filterkette als Variablenblock anlegen**

> **Die Kette unten ist gemessen, nicht geraten.** Eine frühere Fassung dieses
> Plans benutzte `tmix=frames=W,framestep=S`. Das ist **falsch**: an einem
> 16-Frame-Clip mit bekannten Luma-Werten ergab sie `[0, 0, 0, 0, 40, 104, 168]`
> statt `[24, 88, 152, 216]` — sieben Frames statt vier, die ersten vier
> schwarz, der Rest um einen Quellframe verschoben. Ursache: `tmix` mittelt die
> **letzten** W Frames, `framestep` behält aber `n = 0, S, 2S…`, deren Fenster
> beim ersten fast leer ist. Richtig ist eine um `W-1` verschobene Phase.

```bash
IN=GX010123.MP4; W=8; S=8; OUT_FPS=30   # W = Samples, S = Quell-fps / Ziel-fps
WTS=$(yes 1 | head -n $W | paste -sd' '); PH=$((W-1))
SEL="select='gte(n\\,$PH)*not(mod(n-$PH\\,$S))'"
ENC="-c:v hevc_nvenc -preset p5 -rc constqp -qp 20 -profile:v main10 -c:a copy"
```

`W` ist die Zahl der zu mittelnden Frames, `S` das Verhältnis Quell-fps zu
Ziel-fps. Bei 240 fps → 30 fps und 360° ist `W=8, S=8`; bei 180° wäre `W=4, S=8`.

- [ ] **Schritt 5: Blend ohne lineares Licht**

```bash
ffmpeg -i "$IN" -vf "format=p010le,tmix=frames=$W:weights='$WTS',$SEL,setpts=N/$OUT_FPS/TB" -r $OUT_FPS $ENC bench_${W}samples.mp4
```

`format=p010le` **vor** `tmix` ist wichtig: sonst mittelt ffmpeg eine
8-bit-Quelle in 8 bit und erzeugt Banding im Blur.

- [ ] **Schritt 6: Blend mit linearem Licht (die korrekte Variante)**

```bash
ffmpeg -i "$IN" -vf "zscale=t=linear:npl=100,format=gbrpf32le,tmix=frames=$W:weights='$WTS',$SEL,setparams=range=tv:color_primaries=bt709:color_trc=linear:colorspace=bt709,zscale=t=bt709,format=p010le,setpts=N/$OUT_FPS/TB" -r $OUT_FPS $ENC bench_${W}samples_linear.mp4
```

Zwei Teile dieser Kette sind nicht wegzulassen, beide gemessen:

- **`setparams` nach dem Fenster ist Pflicht.** `tmix` verwirft alle
  Farbeigenschaften; das zweite `zscale` bricht sonst mit
  `no path between colorspaces` ab, sobald `W > 1`.
- **`color_trc=linear`, nicht `bt709`.** Nach `zscale=t=linear` sind die Daten
  linear. Erklärt man sie als `bt709`, hält das folgende `zscale=t=bt709` sie
  für fertig und tut nichts. Gemessen an derselben Rampe:

  | `setparams` sagt | Ergebnis | |
  |---|---|---|
  | `color_trc=bt709` | `[3, 24, 72, 153]` | katastrophal dunkel |
  | `color_trc=linear` | `[43,5, 95,2, 150,3, 205,9]` | richtig |
  | Handrechnung (BT.1886) | `[43,51, 95,18, 150,28, 205,90]` | Ziel |

- **`zscale=t=linear` benutzt bei `bt709` die reine Gamma-2,4-Kurve (BT.1886),
  nicht die BT.709-Kamera-OETF.** Gemessen am Float-Zwischenbild: Luma 128 im
  Begrenztbereich ergibt `0.200013`, und das ist `((128-16)/219)^2,4` auf sechs
  Stellen. Die Kamerakurve ergäbe `0.270711`. Wer die Erwartungswerte von Hand
  nachrechnet, muss Gamma 2,4 nehmen.
- **Der Prüfclip muss `yuv420p` sein, nicht `gray`.** swscale und zimg halten
  `gray` für ein Format im **Vollbereich**, auch wenn es als `tv` getaggt ist.
  Gemessen, dieselbe Luma 128: `gray` ergibt `0.191253` = `(128/255)^2,4`,
  `yuv420p` ergibt `0.200013` = `((128-16)/219)^2,4`. Mit `gray` heben sich
  zwei Bereichsfehler beinahe auf — beinahe, nicht ganz. GoPro liefert
  ohnehin `yuv420p`. Rücklesen als `yuv420p10le`.

- [ ] **Schritt 6b: Die Kette an einem Testbild gegenprüfen, bevor du Material verbrennst**

```bash
ffmpeg -v error -y -f lavfi -i "color=c=black:s=64x64:r=4:d=4" -vf "format=gray,geq=lum='16*N',setparams=range=tv:color_primaries=bt709:color_trc=bt709:colorspace=bt709" -frames:v 16 -c:v ffv1 ramp.mkv
```

```bash
ffmpeg -v error -y -i ramp.mkv -vf "format=gray10le,tmix=frames=4:weights='1 1 1 1',select='gte(n\,3)*not(mod(n-3\,4))',setpts=N/4/TB" -r 4 -c:v ffv1 probe.mkv && ffmpeg -v error -i probe.mkv -f rawvideo -pix_fmt gray - | od -An -tu1 -j0 -N1 -w1
```

Muss **24** ausgeben — das Mittel von 0, 16, 32, 48. Kommt etwas anderes,
stimmt die Kette nicht, und alles Weitere ist wertlos.

- [ ] **Schritt 6c: Sample-Reihe für die Sichtprüfung**

Schritt 6 mit `W=2`, `W=4`, `W=8` und — bei 240-fps-Material — `W=16`
wiederholen, `S` jeweils gleich lassen. Nur `W` ändert die Sample-Zahl, `S`
die Ausgabe-Framerate.

- [ ] **Schritt 7: Ansehen und entscheiden**

Die Clips nebeneinander bei schnellen Schwenks betrachten. Ab welcher Sample-Zahl verschwinden die Doppelkanten für *dein* Material und *dein* Auge?

- [ ] **Schritt 8: Referenzqualität mit Interpolation prüfen (nur 5 Sekunden Clip!)**

```bash
ffmpeg -i GX010123_5s.MP4 -vf "minterpolate=fps=480:mi_mode=mci:mc_mode=aobmc:me_mode=bidir:vsbmc=1,zscale=t=linear:npl=100,format=gbrpf32le,tmix=frames=16:weights='1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1',select='gte(n\,15)*not(mod(n-15\,16))',setparams=range=tv:color_primaries=bt709:color_trc=linear:colorspace=bt709,zscale=t=bt709,format=p010le,setpts=N/30/TB" -r 30 -c:v hevc_nvenc -preset p5 -rc constqp -qp 20 -profile:v main10 bench_reference.mp4
```

Das ist absichtlich langsam. Es beantwortet die einzige Frage, die Stufe C rechtfertigt: **Sieht interpolierter Blur deutlich besser aus als 8 echte Samples?**

- [ ] **Schritt 9: `docs/messung.md` schreiben**

Tabelle mit Wandzeit und `fps=` pro Lauf, die korrigierten Filterketten, und ein Absatz „Urteil": welche Sample-Zahl genügt, ob lineares Licht sichtbar besser ist, ob Interpolation den Aufwand lohnt.

- [ ] **Schritt 10: Commit**

```bash
git add docs/messung.md
git commit -m "Messung der ffmpeg-Pipeline und Qualitaetsreferenz dokumentieren"
```

---

## Aufgabe 2: Tauri-Gerüst mit leerem Fenster

**Files:**
- Create: `src-tauri/Cargo.toml`, `src-tauri/tauri.conf.json`, `src-tauri/src/main.rs`, `src-tauri/src/commands.rs`
- Create: `ui/index.html`, `ui/css/app.css`, `ui/js/app.js`
- Create: `.gitignore`

**Interfaces:**
- Consumes: nichts
- Produces: `invoke("ping") -> String`; das Muster, mit dem alle späteren Commands registriert werden

- [ ] **Schritt 1: Projekt anlegen**

`cargo tauri init` oder von Hand. In `tauri.conf.json` **muss** stehen:

```json
{
  "app": { "withGlobalTauri": true },
  "build": { "frontendDist": "../ui" }
}
```

Kein `beforeBuildCommand`, kein `devUrl` — das Frontend ist statisch.

- [ ] **Schritt 2: `ping`-Command schreiben**

In `commands.rs`: `#[tauri::command] fn ping() -> String`, gibt `"pong"` zurück. In `main.rs` über `invoke_handler(tauri::generate_handler![ping])` registrieren.

- [ ] **Schritt 3: Frontend-Gegenstück**

`ui/index.html` mit einem Knopf, `ui/js/app.js` ruft `window.__TAURI__.core.invoke("ping")` und schreibt das Ergebnis in das DOM.

- [ ] **Schritt 4: Starten und prüfen**

Run: `cargo tauri dev`
Expected: Fenster öffnet, Klick auf den Knopf zeigt `pong`.

- [ ] **Schritt 5: `.gitignore`**

`target/`, `src-tauri/target/`. **`Cargo.lock` wird eingecheckt** (Binary, reproduzierbare Builds).

- [ ] **Schritt 6: Commit**

```bash
git add -A
git commit -m "Tauri-Geruest mit buildfreiem Frontend anlegen"
```

---

## Aufgabe 3: Gewichtungskurven (rein)

**Files:**
- Create: `src-tauri/src/weights.rs`
- Test: in derselben Datei, `#[cfg(test)] mod tests`

**Interfaces:**
- Consumes: nichts
- Produces:
  - `enum Weighting { Equal, Gaussian { std_dev: f32 }, Pyramid, Ascending, Descending }`
  - `fn weights_for(w: &Weighting, frames: u32) -> Vec<f32>` — immer normalisiert, Summe 1,0

- [ ] **Schritt 1: Fehlschlagende Tests schreiben**

```rust
#[test]
fn equal_weights_sum_to_one_and_are_uniform() {
    let w = weights_for(&Weighting::Equal, 4);
    assert_eq!(w.len(), 4);
    assert!((w.iter().sum::<f32>() - 1.0).abs() < 1e-6);
    assert!(w.iter().all(|x| (x - 0.25).abs() < 1e-6));
}

#[test]
fn pyramid_is_symmetric_and_peaks_in_the_middle() {
    let w = weights_for(&Weighting::Pyramid, 5);
    assert!((w[0] - w[4]).abs() < 1e-6);
    assert!((w[1] - w[3]).abs() < 1e-6);
    assert!(w[2] > w[1] && w[1] > w[0]);
}

#[test]
fn gaussian_is_symmetric_and_sums_to_one() {
    let w = weights_for(&Weighting::Gaussian { std_dev: 2.0 }, 8);
    assert!((w.iter().sum::<f32>() - 1.0).abs() < 1e-6);
    for i in 0..4 { assert!((w[i] - w[7 - i]).abs() < 1e-6); }
}

#[test]
fn ascending_is_monotonically_increasing() {
    let w = weights_for(&Weighting::Ascending, 4);
    for i in 1..4 { assert!(w[i] > w[i - 1]); }
}

#[test]
fn single_frame_yields_one() {
    assert_eq!(weights_for(&Weighting::Equal, 1), vec![1.0]);
    assert_eq!(weights_for(&Weighting::Gaussian { std_dev: 2.0 }, 1), vec![1.0]);
}

#[test]
fn no_weight_is_ever_negative_or_nan() {
    for n in 1..=32 {
        for w in [Weighting::Equal, Weighting::Pyramid, Weighting::Ascending,
                  Weighting::Descending, Weighting::Gaussian { std_dev: 2.0 }] {
            for x in weights_for(&w, n) {
                assert!(x.is_finite() && x >= 0.0, "n={n} ergab {x}");
            }
        }
    }
}
```

- [ ] **Schritt 2: Tests laufen lassen, Fehlschlag prüfen**

Run: `cargo test weights`
Expected: FAIL, `weights_for` nicht gefunden.

- [ ] **Schritt 3: `weights_for` implementieren**

Vorlage ist `target/scripts/weighting.py` aus smoothie-rs (gleiche Kurvenformen), aber typisiert und ohne die dortige `enable_wizardry`-Sonderbehandlung negativer Gewichte — negative Gewichte gibt es hier nicht. Normalisierung als letzter Schritt in jeder Kurve.

- [ ] **Schritt 4: Tests laufen lassen**

Run: `cargo test weights`
Expected: PASS, 6 Tests.

- [ ] **Schritt 5: Commit**

```bash
git add src-tauri/src/weights.rs
git commit -m "Gewichtungskurven als reine Funktionen mit Tests hinzufuegen"
```

---

## Aufgabe 4: ffprobe-Auswertung zu `MediaInfo`

**Files:**
- Create: `src-tauri/src/media.rs`, `src-tauri/src/probe.rs`
- Create: `src-tauri/tests/fixtures/gopro_4k120.json`, `gopro_1080p240.json`, `vfr_clip.json`
- Test: `src-tauri/src/probe.rs`, `#[cfg(test)] mod tests`

**Interfaces:**
- Consumes: nichts
- Produces:
  - `struct MediaInfo { … }` wie in der Spec, Abschnitt 8
  - `fn parse_probe_json(json: &str) -> Result<MediaInfo, ProbeError>` — **rein, testbar ohne Videodatei**
  - `fn probe_file(ffprobe: &Path, input: &Path) -> Result<MediaInfo, ProbeError>` — ruft den Prozess und gibt an `parse_probe_json` weiter

- [ ] **Schritt 1: Fixtures erzeugen**

Von echten Dateien, einmal:

```bash
ffprobe -v quiet -print_format json -show_streams -show_format GX010123.MP4 > src-tauri/tests/fixtures/gopro_4k120.json
```

Damit sind alle folgenden Tests offline und ohne Videodateien lauffähig.

- [ ] **Schritt 2: Fehlschlagende Tests schreiben**

```rust
#[test]
fn parses_fractional_framerate_as_ratio() {
    let info = parse_probe_json(include_str!("../tests/fixtures/gopro_4k120.json")).unwrap();
    assert_eq!(info.fps, Ratio::new(120000, 1001));   // an das Fixture anpassen
    assert_eq!(info.width, 3840);
    assert_eq!(info.height, 2160);
}

#[test]
fn reads_colour_metadata_instead_of_assuming() {
    let info = parse_probe_json(include_str!("../tests/fixtures/gopro_4k120.json")).unwrap();
    assert!(info.color_transfer.is_some());
    assert!(info.color_matrix.is_some());
}

#[test]
fn detects_vfr_when_avg_and_r_framerate_differ() {
    let info = parse_probe_json(include_str!("../tests/fixtures/vfr_clip.json")).unwrap();
    assert!(info.is_vfr);
}

#[test]
fn finds_gopro_telemetry_stream() {
    let info = parse_probe_json(include_str!("../tests/fixtures/gopro_4k120.json")).unwrap();
    assert!(info.gpmf_stream_index.is_some());
}

#[test]
fn rejects_file_without_video_stream() {
    let audio_only = r#"{"streams":[{"codec_type":"audio"}],"format":{"duration":"1.0"}}"#;
    assert!(matches!(parse_probe_json(audio_only), Err(ProbeError::NoVideoStream)));
}
```

> Review Focus 2 (VFR) ist hier abgedeckt.

- [ ] **Schritt 3: Tests laufen lassen, Fehlschlag prüfen**

Run: `cargo test probe`
Expected: FAIL.

- [ ] **Schritt 4: `MediaInfo` und `parse_probe_json` implementieren**

`avg_frame_rate` kommt als `"120000/1001"` — an `/` trennen und als `Ratio<u32>` bauen. `is_vfr` ist `avg_frame_rate != r_frame_rate`. GPMF-Stream ist der mit `codec_tag_string == "gpmd"`.

- [ ] **Schritt 5: `probe_file` implementieren**

Startet `ffprobe -v quiet -print_format json -show_streams -show_format <input>`, Argumente als `Vec<String>`, Ausgabe an `parse_probe_json`.

- [ ] **Schritt 6: Tests laufen lassen**

Run: `cargo test probe`
Expected: PASS, 5 Tests.

- [ ] **Schritt 7: Commit**

```bash
git add src-tauri/src/media.rs src-tauri/src/probe.rs src-tauri/tests/fixtures/
git commit -m "ffprobe-Auswertung zu typisiertem MediaInfo hinzufuegen"
```

---

## Aufgabe 5: Der Planer (rein) — Herzstück

**Files:**
- Create: `src-tauri/src/planner.rs`, `src-tauri/src/model.rs`
- Test: `src-tauri/src/planner.rs`, `#[cfg(test)] mod tests`

**Interfaces:**
- Consumes: `weights_for` (Aufgabe 3), `MediaInfo` (Aufgabe 4)
- Produces:
  - `struct BlurJob`, `enum Profile`, `enum Interpolation`, `enum BitDepth` wie in der Spec
  - `struct Plan`, `enum PlanWarning { NoBlur, TooFewSamples { got: u32 }, FewSamples { got: u32 }, NonIntegerRatio { ratio: f64 }, VariableFramerate, SlowReferenceProfile { estimated_s: f64 } }`
  - `fn plan(job: &BlurJob, media: &MediaInfo) -> Result<Plan, PlanError>`
  - `fn resolve_profile(p: &Profile, media: &MediaInfo) -> BlurJob` — Profil → konkrete Werte

- [ ] **Schritt 1: Fehlschlagende Tests schreiben — die Tabelle aus der Spec**

```rust
fn media(fps_num: u32, fps_den: u32, w: u32, h: u32) -> MediaInfo { /* Testhelfer */ }

#[test]
fn shutter_angle_table_from_spec() {
    let cases = [
        // (f_in, f_out, winkel, erwartetes_fenster, erwarteter_stride)
        (240, 30, 180.0, 4,  8),
        (240, 30, 360.0, 8,  8),
        (120, 30, 180.0, 2,  4),
        (120, 30, 360.0, 4,  4),
        (120, 60, 360.0, 2,  2),
        (960, 30, 180.0, 16, 32),
    ];
    for (f_in, f_out, angle, window, stride) in cases {
        let job = job_with(f_out, angle);
        let p = plan(&job, &media(f_in, 1, 1920, 1080)).unwrap();
        assert_eq!(p.blend_window, window, "{f_in}->{f_out} @ {angle}");
        assert_eq!(p.stride, stride, "{f_in}->{f_out} @ {angle}");
        assert_eq!(p.sample_count, window);
    }
}

#[test]
fn weights_always_sum_to_one() {
    let p = plan(&job_with(30, 360.0), &media(240, 1, 1920, 1080)).unwrap();
    assert_eq!(p.weights.len(), p.blend_window as usize);
    assert!((p.weights.iter().sum::<f32>() - 1.0).abs() < 1e-6);
}

#[test]
fn two_samples_produce_a_warning() {
    let p = plan(&job_with(30, 180.0), &media(120, 1, 3840, 2160)).unwrap();
    assert!(p.warnings.iter().any(|w| matches!(w, PlanWarning::TooFewSamples { got: 2 })));
}

#[test]
fn eight_samples_produce_no_sample_warning() {
    let p = plan(&job_with(30, 360.0), &media(240, 1, 1920, 1080)).unwrap();
    assert!(!p.warnings.iter().any(|w|
        matches!(w, PlanWarning::TooFewSamples { .. } | PlanWarning::FewSamples { .. })));
}

#[test]
fn one_sample_means_no_blur() {
    let p = plan(&job_with(30, 90.0), &media(30, 1, 1920, 1080)).unwrap();
    assert_eq!(p.blend_window, 1);
    assert!(p.warnings.contains(&PlanWarning::NoBlur));
}

#[test]
fn ntsc_framerate_uses_exact_ratio_not_rounded_float() {
    // 119,88 -> 29,97 ist genau 4, nicht 4,004
    let p = plan(&job_with_ratio(Ratio::new(30000, 1001), 360.0),
                 &media(120000, 1001, 1920, 1080)).unwrap();
    assert_eq!(p.stride, 4);
    assert!(!p.warnings.iter().any(|w| matches!(w, PlanWarning::NonIntegerRatio { .. })));
}

#[test]
fn non_integer_ratio_warns_instead_of_silently_rounding() {
    // 100 -> 30 ist 3,33 : kein saubereres Fenster moeglich
    let p = plan(&job_with(30, 360.0), &media(100, 1, 1920, 1080)).unwrap();
    assert!(p.warnings.iter().any(|w| matches!(w, PlanWarning::NonIntegerRatio { .. })));
}

#[test]
fn vfr_source_is_passed_through_as_warning() {
    let mut m = media(120, 1, 1920, 1080);
    m.is_vfr = true;
    let p = plan(&job_with(30, 360.0), &m).unwrap();
    assert!(p.warnings.contains(&PlanWarning::VariableFramerate));
}

#[test]
fn ten_bit_is_never_silently_downgraded() {
    let p = plan(&job_with(30, 360.0), &media(240, 1, 1920, 1080)).unwrap();
    assert!(p.pixel_format.contains("p010") || p.pixel_format.contains("10"));
}

#[test]
fn good_profile_targets_1080p30_without_interpolation() {
    let job = resolve_profile(&Profile::Good, &media(240, 1, 2704, 1520));
    assert_eq!(job.output_fps, Ratio::from_integer(30));
    assert!(matches!(job.interpolation, Interpolation::None));
    assert_eq!(job.target_height, Some(1080));
}
```

> Review Focus 1 (nicht-ganzzahliges Verhältnis) ist hier abgedeckt.

- [ ] **Schritt 2: Tests laufen lassen, Fehlschlag prüfen**

Run: `cargo test planner`
Expected: FAIL.

- [ ] **Schritt 3: `plan()` implementieren**

Die Formel steht in der Spec, Abschnitt 4.1. Entscheidend: `R` als `Ratio<u32>` bilden und mit `is_integer()` prüfen, **nicht** `f64` runden. Warnschwellen aus Spec 4.2.

- [ ] **Schritt 4: `resolve_profile()` implementieren**

Profiltabelle aus Spec, Abschnitt 5. Baut aus `Profile` + `MediaInfo` einen vollständigen `BlurJob`.

- [ ] **Schritt 5: Tests laufen lassen**

Run: `cargo test planner`
Expected: PASS, 10 Tests.

- [ ] **Schritt 6: Commit**

```bash
git add src-tauri/src/planner.rs src-tauri/src/model.rs
git commit -m "Planer als reine Funktion mit Shutter-Angle-Mathematik hinzufuegen"
```

---

## Aufgabe 6: `Plan` → ffmpeg-Argumente

**Files:**
- Create: `src-tauri/src/backend/mod.rs`, `src-tauri/src/backend/ffmpeg_cli.rs`
- Test: `src-tauri/src/backend/ffmpeg_cli.rs`, `#[cfg(test)] mod tests`

**Interfaces:**
- Consumes: `Plan` (Aufgabe 5)
- Produces:
  - `trait BlurBackend { fn name(&self) -> &str; fn run(&self, plan: &Plan, out: &Path, on_progress: &dyn Fn(Progress)) -> Result<(), RenderError>; }`
  - `struct FfmpegCliBackend { ffmpeg: PathBuf }`
  - `fn build_args(plan: &Plan, out: &Path) -> Vec<String>` — **rein, testbar ohne Prozess**

- [ ] **Schritt 1: Fehlschlagende Tests schreiben**

```rust
#[test]
fn args_contain_tmix_with_exact_weights_and_phase_shifted_select() {
    let plan = plan_fixture_240_to_30_at_360();   // 8 Samples, equal
    let args = build_args(&plan, Path::new("out.mp4"));
    let vf = arg_after(&args, "-vf");
    assert!(vf.contains("tmix=frames=8"));
    assert!(vf.contains(r"select='gte(n\,7)*not(mod(n-7\,8))'"));
    assert!(!vf.contains("framestep"));   // framestep ist falsch, siehe Aufgabe 1
}

#[test]
fn linear_light_wraps_the_blend_in_zscale() {
    let plan = plan_fixture_with_linear_light(true);
    let vf = arg_after(&build_args(&plan, Path::new("out.mp4")), "-vf");
    let lin = vf.find("zscale=t=linear").unwrap();
    let mix = vf.find("tmix=").unwrap();
    let back = vf.rfind("zscale=t=bt709").unwrap();
    assert!(lin < mix && mix < back, "Reihenfolge falsch: {vf}");
}

#[test]
fn linear_light_off_has_no_zscale_at_all() {
    let vf = arg_after(&build_args(&plan_fixture_with_linear_light(false), Path::new("o.mp4")), "-vf");
    assert!(!vf.contains("zscale"));
}

#[test]
fn audio_is_copied_not_reencoded() {
    let args = build_args(&plan_fixture_with_audio(), Path::new("out.mp4"));
    assert!(windows_contains(&args, &["-c:a", "copy"]));
}

#[test]
fn gpmf_stream_is_mapped_through_when_present() {
    let args = build_args(&plan_fixture_with_gpmf(3), Path::new("out.mp4"));
    assert!(args.iter().any(|a| a == "0:3"));
    assert!(args.iter().any(|a| a == "-copy_unknown"));
}

#[test]
fn ten_bit_output_requests_main10_profile() {
    let args = build_args(&plan_fixture_240_to_30_at_360(), Path::new("out.mp4"));
    assert!(windows_contains(&args, &["-profile:v", "main10"]));
}

#[test]
fn paths_with_spaces_and_umlauts_are_single_arguments() {
    let plan = plan_fixture_with_input("C:\\Videos\\Küste Sommer\\GX010123.MP4");
    let args = build_args(&plan, Path::new("C:\\Aus gabe\\Küste blur.mp4"));
    assert!(args.iter().any(|a| a == "C:\\Videos\\Küste Sommer\\GX010123.MP4"));
    assert!(args.iter().any(|a| a == "C:\\Aus gabe\\Küste blur.mp4"));
    assert!(args.iter().all(|a| !a.contains('"')), "Argumente duerfen nicht gequotet sein");
}

#[test]
fn no_argument_is_ever_empty() {
    let args = build_args(&plan_fixture_240_to_30_at_360(), Path::new("out.mp4"));
    assert!(args.iter().all(|a| !a.trim().is_empty()));
}
```

> Review Focus 3 (Pfade mit Umlaut/Leerzeichen) ist hier abgedeckt. `build_args` gibt `Vec<String>` zurück, das direkt an `Command::args` geht — nie eine zusammengesetzte Kommandozeile, nie `.split(" ")`.

- [ ] **Schritt 2: Tests laufen lassen, Fehlschlag prüfen**

Run: `cargo test ffmpeg_cli`
Expected: FAIL.

- [ ] **Schritt 3: `build_args` implementieren**

Reihenfolge der Filterkette, wenn `linear_light`:
```
[scale] → zscale=t=linear:npl=100 → format=gbrpf32le → tmix=frames=W
        → select='gte(n\,W-1)*not(mod(n-W+1\,S))'
        → setparams=…:color_trc=linear:…          ← Pflicht, siehe unten
        → zscale=t=bt709 → format=<pixel_format> → setpts
```

Ohne `linear_light` fällt alles zwischen `scale` und `tmix` sowie alles zwischen
`select` und `setpts` weg — dafür muss dann `format=<pixel_format>` **vor**
`tmix` stehen, sonst wird eine 8-bit-Quelle in 8 bit gemittelt.

Drei Dinge an dieser Kette sind gemessen und nicht verhandelbar (Begründung und
Messwerte in Aufgabe 1, Schritt 4 und 6):

- **`select` statt `framestep`.** `framestep` liefert ein fast leeres erstes
  Fenster und verschiebt alle Werte um einen Quellframe.
- **`setparams` nach dem Fenster.** `tmix` verwirft alle Farbeigenschaften; das
  zweite `zscale` bricht sonst mit `no path between colorspaces` ab.
- **`color_trc=linear` in diesem `setparams`**, nicht der Transfer der Quelle.
  Nach `zscale=t=linear` sind die Daten linear; erklärt man sie als `bt709`,
  tut das folgende `zscale` nichts und das Bild wird drastisch zu dunkel.

Gewichte als Leerzeichen-getrennte Liste in `weights='…'`, Werte unverändert aus
`plan.weights`.

- [ ] **Schritt 4: `trait BlurBackend` definieren und `FfmpegCliBackend::run` als Platzhalter**

`run` startet noch keinen Prozess — das kommt in Aufgabe 8. Vorerst `todo!()`-frei: `Err(RenderError::NotImplemented)`.

- [ ] **Schritt 5: Tests laufen lassen**

Run: `cargo test ffmpeg_cli`
Expected: PASS, 8 Tests.

- [ ] **Schritt 6: Commit**

```bash
git add src-tauri/src/backend/
git commit -m "ffmpeg-Argumentbau mit BlurBackend-Trait hinzufuegen"
```

---

## Aufgabe 7: Golden-Test — die Blend-Semantik numerisch festnageln

Der wertvollste Test im Projekt. Er beweist, dass gemittelt wird, **was** gemittelt werden soll — und dass Stufe C später denselben Look liefert.

**Files:**
- Create: `src-tauri/tests/golden_blend.rs`

**Interfaces:**
- Consumes: `build_args` (Aufgabe 6)
- Produces: die Gewissheit, dass `blend_window`, `stride` und `weights` der Realität entsprechen

> **Encoder und Container:** `EncoderChoice::Lossless` ist `ffv1`, und ffv1
> braucht **`.mkv`** — MP4 kann es nicht. Ein verlustbehafteter Encoder
> verschiebt Luma stärker als die Toleranz dieses Tests.

> **Prüfe Framezahl UND Werte.** Beim Fehler der ersten Planfassung war die
> falsche Framezahl (7 statt 4) das deutlichste Symptom.

> **Die Linearlicht-Variante gehört mitgeprüft**, nicht nur die ohne. Sie ist
> der Standardfall und hat ihren eigenen Fehlermodus (`color_trc` nach dem
> Fenster, siehe Aufgabe 1, Schritt 6).

- [ ] **Schritt 1: Testclip mit bekannten Pixelwerten erzeugen**

16 Frames, Frame *n* hat überall den Luma-Wert *n*·16. Mit `-f lavfi -i color=...` pro Frame oder einem `geq`-Ausdruck auf `N`. Der Clip wird im Test erzeugt, nicht eingecheckt.

- [ ] **Schritt 2: Fehlschlagenden Test schreiben**

```rust
#[test]
#[ignore = "braucht ffmpeg im PATH"]
fn equal_blend_of_four_frames_yields_their_arithmetic_mean() {
    // Quelle: 16 Frames, Luma von Frame n ist n*16
    // Plan: window 4, stride 4, equal
    // Erwartung: Ausgabeframe 0 = Mittel(0,16,32,48) = 24
    //            Ausgabeframe 1 = Mittel(64,80,96,112) = 88
    let out = run_blend_on_synthetic_clip(/* window */ 4, /* stride */ 4);
    let lumas = read_frame_lumas(&out);
    assert!((lumas[0] - 24.0).abs() <= 1.0, "Frame 0 war {}", lumas[0]);
    assert!((lumas[1] - 88.0).abs() <= 1.0, "Frame 1 war {}", lumas[1]);
}

#[test]
#[ignore = "braucht ffmpeg im PATH"]
fn weighted_blend_matches_the_planned_weights() {
    // Gewichte [0.1, 0.2, 0.4, 0.3] auf Luma [0, 16, 32, 48]
    // Erwartung: 0*0.1 + 16*0.2 + 32*0.4 + 48*0.3 = 30.4
    let out = run_blend_with_weights(&[0.1, 0.2, 0.4, 0.3]);
    assert!((read_frame_lumas(&out)[0] - 30.4).abs() <= 1.0);
}

#[test]
#[ignore = "braucht ffmpeg im PATH"]
fn output_frame_count_matches_stride() {
    // 16 Eingabeframes, stride 4 -> 4 Ausgabeframes
    let out = run_blend_on_synthetic_clip(4, 4);
    assert_eq!(count_frames(&out), 4);
}
```

- [ ] **Schritt 3: Test laufen lassen**

Run: `cargo test --test golden_blend -- --ignored`
Expected: FAIL, weil die Testhilfsfunktionen noch nicht existieren. Die Filterkette selbst ist inzwischen gemessen und richtig (Aufgabe 1, Schritt 4 und 6) — dieser Test **nagelt sie fest**, er entdeckt sie nicht mehr. Das ist der Unterschied zwischen „einmal gemessen" und „kann nicht unbemerkt zurückkommen".

- [ ] **Schritt 4: `build_args` korrigieren, bis die Mittelwerte stimmen**

Sollte ein Wert abweichen, ist die Kette in `ffmpeg_cli.rs` verändert worden — nicht dieser Test. Die Erwartungswerte sind gemessen:

| W/S | θ | Werte (8 bit) | Frames |
|---|---|---|---|
| 4/4 | 360° | `[24, 88, 152, 216]` | 4 |
| 2/4 | 180° | `[8, 72, 136, 200]` | 4 |
| 8/4 | 720° | `[56, 120, 184]` | 3 |

Die Linearlicht-Variante hat eigene Werte, weil in linearem Licht gemittelt wird. Bei einer **`yuv420p`**-Rampe `16 + 14n` und W/S = 4/4, rückgelesen als `yuv420p10le`:

| Pfad | Werte |
|---|---|
| ohne Linearlicht (arithmetisch) | `[37, 93, 149, 205]` |
| mit Linearlicht (BT.1886, Gamma 2,4) | `[43,5, 95,2, 150,3, 205,9]` |

Prüfe beide — und prüfe ausdrücklich, dass sie **verschieden** sind. Nur das beweist, dass die Linearisierung wirklich stattfindet und nicht bloß Filter durchlaufen werden.

Ein Luma-Test allein genügt übrigens nicht: ein auf 8 bit gezwungenes Zwischenformat bleibt in der Toleranz, weil das Rücklesen die Werte wieder auf 10 bit hebt. Prüfe das Pixelformat der Ausgabe zusätzlich per `ffprobe`.

- [ ] **Schritt 5: Tests laufen lassen**

Run: `cargo test --test golden_blend -- --ignored`
Expected: PASS, 3 Tests.

- [ ] **Schritt 6: Commit**

```bash
git add src-tauri/tests/golden_blend.rs src-tauri/src/backend/ffmpeg_cli.rs
git commit -m "Blend-Semantik mit Golden-Test gegen echtes ffmpeg festnageln"
```

---

## Aufgabe 8: Fortschritt und Prozessausführung

**Files:**
- Create: `src-tauri/src/progress.rs`
- Modify: `src-tauri/src/backend/ffmpeg_cli.rs` (`run` echt implementieren)
- Test: `src-tauri/src/progress.rs`, `#[cfg(test)] mod tests`

**Interfaces:**
- Consumes: `build_args` (Aufgabe 6)
- Produces:
  - `struct Progress { frame: u64, out_time_s: f64, fps: f32, done: bool }`
  - `fn parse_progress_line(line: &str, acc: &mut Progress) -> bool` — **rein**
  - `FfmpegCliBackend::run` startet ffmpeg wirklich und ruft `on_progress`

- [ ] **Schritt 1: Fehlschlagende Tests schreiben**

```rust
#[test]
fn parses_out_time_us_into_seconds() {
    let mut p = Progress::default();
    parse_progress_line("out_time_us=1500000", &mut p);
    assert!((p.out_time_s - 1.5).abs() < 1e-6);
}

#[test]
fn parses_frame_and_fps() {
    let mut p = Progress::default();
    parse_progress_line("frame=42", &mut p);
    parse_progress_line("fps=23.5", &mut p);
    assert_eq!(p.frame, 42);
    assert!((p.fps - 23.5).abs() < 1e-3);
}

#[test]
fn progress_end_marks_done() {
    let mut p = Progress::default();
    assert!(parse_progress_line("progress=end", &mut p));
    assert!(p.done);
}

#[test]
fn unknown_and_malformed_lines_are_ignored_without_error() {
    let mut p = Progress::default();
    for line in ["bitrate=N/A", "", "garbage", "frame=", "out_time_us=abc", "=5"] {
        parse_progress_line(line, &mut p);
    }
    assert_eq!(p.frame, 0);
    assert!(!p.done);
}
```

- [ ] **Schritt 2: Tests laufen lassen, Fehlschlag prüfen**

Run: `cargo test progress`
Expected: FAIL.

- [ ] **Schritt 3: `parse_progress_line` implementieren**

`-progress pipe:1` liefert `key=value`-Zeilen auf **stdout**. Kein Textscraping der `-stats`-Ausgabe.

- [ ] **Schritt 4: `FfmpegCliBackend::run` implementieren**

`-progress pipe:1 -nostats` an die Argumente anhängen. stdout zeilenweise lesen und `on_progress` rufen; stderr vollständig sammeln und bei Exitcode ≠ 0 in `RenderError::Ffmpeg { stderr }` legen. **Kein `panic!`.**

- [ ] **Schritt 5: Tests laufen lassen**

Run: `cargo test progress`
Expected: PASS, 4 Tests.

- [ ] **Schritt 6: Commit**

```bash
git add src-tauri/src/progress.rs src-tauri/src/backend/ffmpeg_cli.rs
git commit -m "Maschinenlesbaren Fortschritt und Prozessausfuehrung hinzufuegen"
```

---

## Aufgabe 9: Preflight

**Files:**
- Create: `src-tauri/src/preflight.rs`
- Test: `src-tauri/src/preflight.rs`, `#[cfg(test)] mod tests`

**Interfaces:**
- Consumes: `Plan` (Aufgabe 5)
- Produces:
  - `enum PreflightIssue { FfmpegMissing, EncoderUnavailable(String), EncoderListedButFails { encoder: String, stderr: String }, OutputNotWritable(PathBuf), NotEnoughSpace { needed_mb: u64, free_mb: u64 }, InputUnreadable(PathBuf) }`
  - `fn parse_encoders(output: &str) -> HashSet<String>` — **rein**
  - `fn check(plan: &Plan, ffmpeg: &Path, out: &Path) -> Vec<PreflightIssue>`

- [ ] **Schritt 1: Fehlschlagende Tests schreiben**

```rust
#[test]
fn parses_encoder_names_from_ffmpeg_output() {
    let out = " V....D hevc_nvenc           NVIDIA NVENC hevc encoder\n \
                V....D h264_nvenc           NVIDIA NVENC H.264 encoder\n \
                A....D aac                  AAC\n";
    let set = parse_encoders(out);
    assert!(set.contains("hevc_nvenc"));
    assert!(set.contains("h264_nvenc"));
    assert!(!set.contains("NVIDIA"));
}

#[test]
fn missing_encoder_is_reported() {
    let issues = check_with_encoders(&["libx264"], "hevc_nvenc");
    assert!(issues.iter().any(|i| matches!(i, PreflightIssue::EncoderUnavailable(e) if e == "hevc_nvenc")));
}
```

- [ ] **Schritt 2: Tests laufen lassen, Fehlschlag prüfen**

Run: `cargo test preflight`
Expected: FAIL.

- [ ] **Schritt 3: `parse_encoders` und `check` implementieren**

- [ ] **Schritt 4: NVENC-Rauchtest implementieren**

„In `-encoders` aufgeführt" ist **nicht** dasselbe wie „funktioniert auf dieser Karte" — Treiberalter und GPU-Generation entscheiden. Deshalb ein echter Ein-Frame-Encode:

```
ffmpeg -hide_banner -f lavfi -i nullsrc=s=256x256 -frames:v 1 -c:v hevc_nvenc -f null -
```

Exitcode ≠ 0 → `EncoderListedButFails` mit dem stderr.

- [ ] **Schritt 5: Tests laufen lassen**

Run: `cargo test preflight`
Expected: PASS, 2 Tests.

- [ ] **Schritt 6: Commit**

```bash
git add src-tauri/src/preflight.rs
git commit -m "Preflight-Pruefungen samt NVENC-Rauchtest hinzufuegen"
```

---

## Aufgabe 10: UI — Drop-Zone und Dateiliste

**Files:**
- Create: `src-tauri/src/gopro.rs`
- Modify: `src-tauri/src/commands.rs`, `ui/index.html`, `ui/css/app.css`, `ui/js/dropzone.js`, `ui/js/app.js`
- Test: `src-tauri/src/gopro.rs`, `#[cfg(test)] mod tests`

**Interfaces:**
- Consumes: `probe_file` (Aufgabe 4), `plan` + `resolve_profile` (Aufgabe 5)
- Produces:
  - `fn collect_inputs(paths: &[PathBuf]) -> Vec<InputSource>` — filtert, gruppiert GoPro-Kapitel
  - `#[tauri::command] fn add_paths(paths: Vec<String>) -> Vec<JobPreview>`
  - `struct JobPreview { label: String, media: MediaInfo, sample_count: u32, warnings: Vec<String>, estimated_duration_s: f64 }`

- [ ] **Schritt 1: Fehlschlagende Tests schreiben**

```rust
#[test]
fn groups_gopro_chapters_with_the_same_trailing_digits() {
    let paths = p(&["GX010123.MP4", "GX020123.MP4", "GX010456.MP4"]);
    let got = collect_inputs(&paths);
    assert_eq!(got.len(), 2);
    assert!(got.iter().any(|s| matches!(s, InputSource::Chapters(v) if v.len() == 2)));
}

#[test]
fn chapters_are_ordered_by_chapter_number() {
    let paths = p(&["GX020123.MP4", "GX010123.MP4"]);
    match &collect_inputs(&paths)[0] {
        InputSource::Chapters(v) => {
            assert!(v[0].to_string_lossy().contains("GX01"));
            assert!(v[1].to_string_lossy().contains("GX02"));
        }
        _ => panic!("erwartet: Chapters"),
    }
}

#[test]
fn ignores_lrv_thm_and_non_video_files() {
    let paths = p(&["GL010123.LRV", "GX010123.THM", "foto.JPG", "notiz.txt", "GX010123.MP4"]);
    assert_eq!(collect_inputs(&paths).len(), 1);
}

#[test]
fn walks_folders_recursively() {
    // Ordner mit Unterordner, in beiden je eine MP4
    assert_eq!(collect_inputs(&[tmp_tree_with_two_videos()]).len(), 2);
}

#[test]
fn an_unreadable_file_does_not_remove_the_others_from_the_list() {
    let paths = p(&["kaputt.MP4", "GX010123.MP4"]);   // kaputt.MP4 ist 0 Byte
    let previews = previews_for(&paths);
    assert_eq!(previews.len(), 2);
    assert!(previews.iter().any(|v| !v.warnings.is_empty()));
}
```

> Review Focus 4 (gemischter Ordner-Drop) ist hier abgedeckt.

- [ ] **Schritt 2: Tests laufen lassen, Fehlschlag prüfen**

Run: `cargo test gopro`
Expected: FAIL.

- [ ] **Schritt 3: `collect_inputs` implementieren**

GoPro-Namensschema: `GX` + 2 Ziffern Kapitel + 4 Ziffern Dreh-ID. Gleiche Dreh-ID = ein `InputSource::Chapters`, nach Kapitelnummer sortiert.

- [ ] **Schritt 4: `add_paths`-Command implementieren**

Pro Eingabe: `probe_file`, dann `resolve_profile` + `plan`, dann `JobPreview` bauen. Eine fehlerhafte Datei liefert einen `JobPreview` mit Warnung, **nicht** einen Fehler für die ganze Liste.

- [ ] **Schritt 5: Drop-Zone im Frontend bauen**

Tauri v2: `window.__TAURI__.webview.getCurrentWebview().onDragDropEvent(cb)` liefert die Pfade. Die HTML5-`drop`-Events der WebView geben unter Tauri **keine** Dateisystempfade — ausschließlich das Tauri-Event benutzen.

- [ ] **Schritt 6: Dateiliste rendern**

Pro Eintrag: Name, Auflösung, Quell-fps, **Sample-Zahl groß und deutlich**, Warnungen im Klartext, geschätzte Dauer. Das ist Spec-Regel 6.4 — die Oberfläche sagt die Wahrheit über das Material.

- [ ] **Schritt 7: Tests laufen lassen und Fenster prüfen**

Run: `cargo test gopro` → PASS, 5 Tests.
Run: `cargo tauri dev`, einen Ordner hineinziehen → Liste erscheint mit Sample-Zahlen.

- [ ] **Schritt 8: Commit**

```bash
git add src-tauri/src/gopro.rs src-tauri/src/commands.rs ui/
git commit -m "Drop-Zone mit GoPro-Kapitelgruppierung und ehrlicher Dateiliste hinzufuegen"
```

---

## Aufgabe 11: UI — Profile und Einstellungen

**Files:**
- Modify: `ui/index.html`, `ui/css/app.css`, `ui/js/settings.js`, `src-tauri/src/commands.rs`

**Interfaces:**
- Consumes: `plan`, `resolve_profile` (Aufgabe 5)
- Produces: `#[tauri::command] fn preview_plan(job: BlurJob, media: MediaInfo) -> Result<Plan, String>`

- [ ] **Schritt 1: Profilumschalter bauen**

Vier Knöpfe: Schnell · Gut · 4K · Referenz. Die Profiltabelle steht in der Spec, Abschnitt 5. Bei `Referenz` die geschätzte Laufzeit in Rot und den Hinweis „nur für kurze Testclips".

- [ ] **Schritt 2: „Eigene Einstellungen" als aufklappbarer Bereich**

Shutter-Angle (Schieber 45–360°, Standard 360), Ziel-fps, Gewichtungskurve, lineares Licht (Standard an), Zielhöhe.

- [ ] **Schritt 3: `preview_plan` anbinden — Live-Rückmeldung**

Bei **jeder** Änderung `preview_plan` rufen und Sample-Zahl plus Warnungen neu zeichnen. `plan()` ist rein und kostet nichts, also fühlt sich das sofort an. Das ist der Punkt, an dem der Nutzer die Physik aus Spec 4.2 *lernt*, statt sie nachzulesen.

- [ ] **Schritt 4: Hell/Dunkel übernehmen**

Aus `Privat-Projekte/shared/` übernehmen, Schlüssel `privat-projekte.theme` beibehalten.

- [ ] **Schritt 5: Prüfen**

Run: `cargo tauri dev` — Shutter-Angle von 360° auf 180° ziehen: Sample-Zahl halbiert sich sichtbar, bei 2 erscheint die Warnung.

- [ ] **Schritt 6: Commit**

```bash
git add ui/ src-tauri/src/commands.rs
git commit -m "Profile und Live-Vorschau des Plans im UI hinzufuegen"
```

---

## Aufgabe 12: Queue, Ausführung, Abbruch

**Files:**
- Create: `src-tauri/src/queue.rs`
- Modify: `src-tauri/src/commands.rs`, `ui/js/queue.js`
- Test: `src-tauri/src/queue.rs`, `#[cfg(test)] mod tests`

**Interfaces:**
- Consumes: `BlurBackend` (Aufgabe 6), `Progress` (Aufgabe 8), `preflight::check` (Aufgabe 9)
- Produces:
  - `#[tauri::command] fn start_queue(jobs: Vec<BlurJob>) -> Result<(), String>`
  - `#[tauri::command] fn cancel_queue() -> Result<(), String>`
  - Tauri-Events `job-progress`, `job-done`, `job-failed`, `queue-done`

- [ ] **Schritt 1: Fehlschlagende Tests schreiben**

```rust
#[test]
fn preflight_failure_stops_before_any_process_starts() {
    let backend = CountingBackend::new();      // zaehlt run()-Aufrufe
    run_queue_with_failing_preflight(&backend);
    assert_eq!(backend.run_count(), 0);
}

#[test]
fn a_failing_job_does_not_stop_the_remaining_jobs() {
    let backend = BackendThatFailsOn(1);       // Job 1 von 3 schlaegt fehl
    let report = run_queue_of_three(&backend);
    assert_eq!(report.succeeded, 2);
    assert_eq!(report.failed, 1);
}

#[test]
fn cancel_removes_the_partial_output_file() {
    let out = temp_path("teil.mp4");
    let h = start_queue_writing_to(&out);
    h.cancel();
    h.wait();
    assert!(!out.exists(), "Teildatei haette geloescht werden muessen");
}

#[test]
fn cancel_terminates_the_whole_process_tree() {
    let h = start_queue_with_long_running_backend();
    h.cancel();
    h.wait();
    assert!(!h.any_child_process_alive());
}
```

> Review Focus 5 (Abbruch) ist hier abgedeckt.

- [ ] **Schritt 2: Tests laufen lassen, Fehlschlag prüfen**

Run: `cargo test queue`
Expected: FAIL.

- [ ] **Schritt 3: Queue implementieren**

Jobs seriell (nicht parallel — die GPU ist ohnehin der Engpass). Vor jedem Job `preflight::check`; bei Fehlern den Job als `job-failed` melden und zum nächsten gehen.

- [ ] **Schritt 4: Abbruch implementieren**

Unter Windows beendet `Child::kill` nur den direkten Prozess. ffmpeg startet Kindprozesse, deshalb entweder ein Job Object oder `taskkill /T /F /PID`. Danach die unvollständige Ausgabedatei löschen. In eine Temp-Datei schreiben und erst bei Erfolg umbenennen ist die robustere Variante.

- [ ] **Schritt 5: Fortschritt im UI**

Pro Job ein Balken aus `out_time_s / duration_s`, darüber ein Gesamtbalken, plus verbleibende Zeit aus der laufenden `fps`.

- [ ] **Schritt 6: Tests laufen lassen und echten Durchlauf prüfen**

Run: `cargo test queue` → PASS, 4 Tests.
Run: `cargo tauri dev`, drei echte Clips verarbeiten, einmal mitten im zweiten abbrechen.

- [ ] **Schritt 7: Commit**

```bash
git add src-tauri/src/queue.rs src-tauri/src/commands.rs ui/js/queue.js
git commit -m "Job-Queue mit Fortschritt und sauberem Abbruch hinzufuegen"
```

---

## Aufgabe 13: Referenzprofil mit Interpolation

Erst jetzt, weil es ohne die Messung aus Aufgabe 1 keinen Sinn hat — und möglicherweise ganz entfällt, falls dort 8 Samples genügten.

**Files:**
- Modify: `src-tauri/src/planner.rs`, `src-tauri/src/backend/ffmpeg_cli.rs`, `ui/js/settings.js`

**Interfaces:**
- Consumes: `Plan` (Aufgabe 5)
- Produces: `Interpolation::Minterpolate { target_fps: Ratio<u32> }` wird in der Filterkette und in `blend_input_fps` berücksichtigt

- [ ] **Schritt 1: Fehlschlagende Tests schreiben**

```rust
#[test]
fn interpolation_raises_the_blend_input_framerate() {
    let job = job_with_minterpolate(480, 30, 180.0);
    let p = plan(&job, &media(120, 1, 1920, 1080)).unwrap();
    assert_eq!(p.blend_input_fps, Ratio::from_integer(480));
    assert_eq!(p.blend_window, 8);     // 480/30 = 16, davon 180% -> 8
    assert_eq!(p.stride, 16);
}

#[test]
fn minterpolate_comes_before_the_blend_in_the_filter_chain() {
    let vf = arg_after(&build_args(&plan_with_minterpolate(), Path::new("o.mp4")), "-vf");
    assert!(vf.find("minterpolate").unwrap() < vf.find("tmix").unwrap());
}

#[test]
fn reference_profile_warns_about_its_runtime() {
    let job = resolve_profile(&Profile::Reference, &media(120, 1, 1920, 1080));
    let p = plan(&job, &media(120, 1, 1920, 1080)).unwrap();
    assert!(p.warnings.iter().any(|w| matches!(w, PlanWarning::SlowReferenceProfile { .. })));
}
```

- [ ] **Schritt 2: Tests laufen lassen, Fehlschlag prüfen**

Run: `cargo test interpolation`
Expected: FAIL.

- [ ] **Schritt 3: Implementieren**

`minterpolate=fps=<n>:mi_mode=mci:mc_mode=aobmc:me_mode=bidir:vsbmc=1` als erstes Glied der Kette. `blend_input_fps` wird zur Interpolationsrate, `R` daraus berechnet.

- [ ] **Schritt 4: Laufzeitschätzung ins UI**

Aus der Messung in `docs/messung.md` einen Faktor ableiten und im UI als „geschätzt X Minuten" anzeigen, bevor der Nutzer startet.

- [ ] **Schritt 5: Tests laufen lassen**

Run: `cargo test interpolation`
Expected: PASS, 3 Tests.

- [ ] **Schritt 6: Commit**

```bash
git add -A
git commit -m "Referenzprofil mit minterpolate-Interpolation hinzufuegen"
```

---

## Aufgabe 14: Verpacken als eigenständige Anwendung

**Files:**
- Modify: `src-tauri/tauri.conf.json`
- Create: `src-tauri/icons/`, `src-tauri/binaries/` (ffmpeg/ffprobe als Sidecar)
- Create: `README.md`

**Interfaces:**
- Consumes: alles
- Produces: eine startfähige `.exe` samt Sidecars

- [ ] **Schritt 1: ffmpeg und ffprobe als Sidecar einbinden**

Nach `src-tauri/binaries/ffmpeg-x86_64-pc-windows-msvc.exe` (das Zielsuffix ist für Tauri-Sidecars Pflicht), in `tauri.conf.json` unter `bundle.externalBin` eintragen. Die Pfade im Code über `tauri_plugin_shell`s Sidecar-Auflösung holen, **nicht** über `which`.

- [ ] **Schritt 2: Lizenzen beilegen**

ffmpeg ist LGPL/GPL — Lizenztext und Versionsangabe in `licenses/` neben die Binaries. Bei GPL-Build (x264/x265 enthalten) ist auch das eigene Projekt betroffen; Lizenzwahl im README festhalten.

- [ ] **Schritt 3: Icon und Metadaten**

- [ ] **Schritt 4: Bauen und auf einem zweiten Rechner prüfen**

Run: `cargo tauri build`
Expected: `.exe` startet auf einem Windows-Rechner **ohne** Rust, ohne ffmpeg im PATH und ohne .NET.

- [ ] **Schritt 5: README schreiben**

Was es tut, welche Profile es gibt, welche Quell-Framerate man drehen sollte (die Tabelle aus Spec 4.3), und die Messwerte aus `docs/messung.md`.

- [ ] **Schritt 6: Commit**

```bash
git add -A
git commit -m "Anwendung mit ffmpeg-Sidecar verpacken und dokumentieren"
```

---

## Stufe C — eigener Plan, später

Erst beginnen, wenn Stufe B läuft **und** `docs/messung.md` zeigt, dass der Gewinn die Arbeit lohnt. Was Stufe B schon dafür vorbereitet hat:

- `plan()` liefert die Gewichte → Stufe C erbt den Look unverändert
- `trait BlurBackend` → `CudaBackend` tritt neben `FfmpegCliBackend`
- der Golden-Test aus Aufgabe 7 läuft gegen **jedes** Backend und beweist, dass der Umstieg das Bild nicht verändert

Reihenfolge, wenn es losgeht: NVDEC-Decode zuerst (größter Einzelgewinn, kein eigener Shader nötig) → Blend als Compute-Shader mit Linearisierung im gleichen Pass → NVENC ohne Host-Umweg → RIFE über ONNX Runtime/DirectML als letztes, weil es der größte Brocken ist.

---

## Selbstprüfung

**1. Spec-Deckung.** Abschnitt 4 (Physik) → Aufgaben 5, 7. Abschnitt 5 (Profile) → 5, 11, 13. Abschnitt 6 (Qualitätsregeln) → 6 (lineares Licht, 10 bit), 4 (Farbmetrik), 10/11 (ehrliche Oberfläche), 9 (Preflight). Abschnitt 7 (GoPro) → 10, 6. Abschnitt 8 (Datenmodell) → 4, 5. Abschnitt 9 (Architektur) → 2, 6. Keine Lücke.

**2. Schritt-Durchsicht.** Jeder Schritt nennt entweder Testnamen samt Assertions, eine Signatur mit Zieldatei, oder einen Befehl mit erwarteter Ausgabe. Funktionskörper stehen nur dort, wo Signatur und Test die Umsetzung nicht festlegen (Filterkettenreihenfolge in 6.3, Abbruchmechanik in 12.4).

**3. Typkonsistenz.** `plan()`, `weights_for()`, `build_args()`, `parse_probe_json()`, `parse_progress_line()`, `collect_inputs()` sind in Aufgabe 3–10 definiert und werden in 11–13 unter denselben Namen benutzt. `Ratio<u32>` durchgehend, `Plan.blend_input_fps` durchgehend (nicht `source_fps`, wie in einem frühen Entwurf).

**4. Review Focus.** Alle fünf Punkte haben einen Test in der besitzenden Aufgabe: nicht-ganzzahliges Verhältnis → 5, VFR → 4, Pfade mit Umlaut → 6, gemischter Ordner-Drop → 10, Abbruch → 12.

**5. Proportion.** 14 Aufgaben, überwiegend Tests und Signaturen. Die Implementierung ist deutlich umfangreicher als dieser Plan — richtiges Verhältnis.
