/**
 * Was der Browser für den Video-Export wirklich kann.
 *
 * Hintergrund: GitHub Pages kann die Header `Cross-Origin-Opener-Policy` und
 * `Cross-Origin-Embedder-Policy` nicht setzen. Ohne sie gibt es keinen
 * `SharedArrayBuffer`, und ohne den läuft `ffmpeg.wasm` nur einkernig – also
 * deutlich langsamer. Darum ist WebCodecs der Hauptpfad, und wir sagen von
 * Anfang an, was möglich ist, statt jemanden in einen Export laufen zu lassen,
 * der nach zehn Minuten abbricht.
 */

/**
 * Rohe Messwerte aus der Umgebung – bewusst getrennt von der Bewertung.
 * @typedef {object} CapabilityProbe
 * @property {boolean} hasVideoEncoder     `VideoEncoder` vorhanden (WebCodecs).
 * @property {boolean} isCrossOriginIsolated  Voraussetzung für `SharedArrayBuffer`.
 * @property {boolean} hasOffscreenCanvas  Rendern ohne sichtbares Canvas möglich.
 * @property {boolean} hasFileSystemAccess `showSaveFilePicker` – Streaming in eine Datei.
 */

/**
 * Welcher Encoder-Pfad benutzt wird.
 * @typedef {'webcodecs' | 'ffmpeg-wasm-mt' | 'ffmpeg-wasm-st'} EncoderPath
 */

/**
 * Wege, eine Spur mit Transparenz auszugeben (Meilenstein M7).
 * @typedef {'png-sequence' | 'webm-alpha' | 'prores'} AlphaPath
 */

/**
 * @typedef {object} CapabilityReport
 * @property {EncoderPath} path
 * @property {string} label       Kurzer Text für die Fußzeile.
 * @property {string} note        Was das bedeutet – eine Zeile, ohne Fachjargon.
 * @property {AlphaPath[]} alphaPaths  Immer mindestens `png-sequence`.
 * @property {boolean} canStreamToDisk Große Exporte scheitern sonst am Speicher.
 */

/** @type {Record<EncoderPath, string>} */
const LABELS = {
  'webcodecs': 'WebCodecs (schnell)',
  'ffmpeg-wasm-mt': 'ffmpeg.wasm, mehrkernig',
  'ffmpeg-wasm-st': 'ffmpeg.wasm, einkernig (langsam)',
}

/** @type {Record<EncoderPath, string>} */
const NOTES = {
  'webcodecs':
    'Video-Export läuft hardwarebeschleunigt über den Browser – der schnelle Weg.',
  'ffmpeg-wasm-mt':
    'Kein WebCodecs in diesem Browser; Export läuft über ffmpeg.wasm mit mehreren Kernen.',
  'ffmpeg-wasm-st':
    'Kein WebCodecs und keine Cross-Origin-Isolation: Export ist möglich, dauert aber ein Vielfaches. Die PNG-Sequenz ist hier oft der bessere Weg.',
}

/**
 * Bewertet die Messwerte. Reine Funktion – deshalb testbar.
 * @param {CapabilityProbe} probe
 * @returns {CapabilityReport}
 */
export function evaluateCapabilities(probe) {
  /** @type {EncoderPath} */
  const path = probe.hasVideoEncoder
    ? 'webcodecs'
    : probe.isCrossOriginIsolated
      ? 'ffmpeg-wasm-mt'
      : 'ffmpeg-wasm-st'

  // Die PNG-Sequenz braucht nur ein Canvas und ein ZIP – sie geht immer.
  /** @type {AlphaPath[]} */
  const alphaPaths = ['png-sequence']
  if (probe.hasVideoEncoder) alphaPaths.push('webm-alpha')
  // ProRes entsteht ausschließlich in ffmpeg, und dort nur mehrkernig in
  // vertretbarer Zeit.
  if (probe.isCrossOriginIsolated) alphaPaths.push('prores')

  return {
    path,
    label: LABELS[path],
    note: NOTES[path],
    alphaPaths,
    canStreamToDisk: probe.hasFileSystemAccess,
  }
}

/**
 * Liest die echten Werte aus dem Browser. Absichtlich dünn gehalten.
 * @returns {CapabilityProbe}
 */
export function probeBrowser() {
  const scope = /** @type {Record<string, unknown>} */ (
    /** @type {unknown} */ (globalThis)
  )
  return {
    hasVideoEncoder: typeof scope['VideoEncoder'] === 'function',
    isCrossOriginIsolated: globalThis.crossOriginIsolated === true,
    hasOffscreenCanvas: typeof scope['OffscreenCanvas'] === 'function',
    hasFileSystemAccess: typeof scope['showSaveFilePicker'] === 'function',
  }
}
