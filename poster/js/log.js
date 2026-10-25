window.Poster = window.Poster || {};

// Kleines Protokoll für Fehler, die sich nur auf fremden Geräten zeigen.
// Bleibt im Speicher dieser Seite, geht nirgendwo hin und ist im Abschnitt
// „Diagnose" ablesbar. Entscheidend ist dabei weniger die Meldung als die
// Dauer: bricht eine Anfrage nach wenigen Millisekunden ab, wurde sie
// abgelehnt, bevor überhaupt etwas über die Leitung ging.
Poster.log = (function () {
  const MAX = 250;
  const lines = [];
  const started = Date.now();
  let onChange = null;

  function add(text) {
    const t = ((Date.now() - started) / 1000).toFixed(2);
    lines.push(t.padStart(7) + 's  ' + text);
    if (lines.length > MAX) lines.shift();
    if (onChange) { try { onChange(); } catch (e) { /* egal */ } }
  }

  function text() {
    return lines.join('\n');
  }

  function watch(fn) { onChange = fn; }

  const build = Poster.BUILD || {};
  add('Start · ' + location.href);
  add('Build · ' + (build.channel || '?') + ' ' + (build.version || '?')
    + (build.commit ? ' · ' + build.commit : '') + (build.date ? ' · ' + build.date : ''));
  add('Browser · ' + navigator.userAgent);
  add('online=' + navigator.onLine
    + ' · Service Worker=' + (navigator.serviceWorker && navigator.serviceWorker.controller ? 'aktiv' : 'keiner')
    + ' · Bildschirm=' + screen.width + '×' + screen.height);

  if (window.caches) {
    caches.keys()
      .then((names) => add('Caches: ' + (names.join(', ') || '(keine)')))
      .catch((e) => add('Caches nicht lesbar: ' + e.message));
  }

  window.addEventListener('error', (e) => {
    if (e.target && e.target.tagName) {
      add('Ressource fehlgeschlagen: <' + e.target.tagName.toLowerCase() + '> ' + (e.target.src || e.target.href || ''));
    } else {
      add('JS-Fehler: ' + e.message + ' @ ' + String(e.filename || '').split('/').pop() + ':' + e.lineno);
    }
  }, true);

  window.addEventListener('unhandledrejection', (e) => {
    const r = e.reason;
    add('Unbehandelt: ' + ((r && (r.message || r.name)) || String(r)));
  });

  // Verrät, ob die Seite zwischendurch aus dem Cache wiederhergestellt wurde —
  // etwa nachdem der Browser den Tab im Hintergrund entladen hat.
  window.addEventListener('pageshow', (e) => add('pageshow · aus dem Cache: ' + !!e.persisted));
  window.addEventListener('online', () => add('online'));
  window.addEventListener('offline', () => add('offline'));

  return { add, text, watch };
})();
