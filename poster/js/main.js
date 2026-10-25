(function () {
  const U = Poster.util;
  const api = Poster.api;

  const els = {
    searchForm: document.getElementById('search-form'),
    searchInput: document.getElementById('search-input'),
    searchStatus: document.getElementById('search-status'),
    searchResults: document.getElementById('search-results'),
    resultsBack: document.getElementById('results-back'),
    modePicker: document.getElementById('mode-picker'),
    entityRow: document.getElementById('search-entity-row'),
    manualBtn: document.getElementById('manual-btn'),

    spotifyId: document.getElementById('spotify-id'),
    spotifySecret: document.getElementById('spotify-secret'),
    spotifySave: document.getElementById('spotify-save'),
    spotifyClear: document.getElementById('spotify-clear'),
    spotifyStatus: document.getElementById('spotify-status'),

    editorFields: document.getElementById('editor-fields'),
    stylePicker: document.getElementById('style-picker'),
    fieldTitle: document.getElementById('field-title'),
    fieldArtist: document.getElementById('field-artist'),
    fieldSubtitle: document.getElementById('field-subtitle'),
    fieldTracks: document.getElementById('field-tracks'),
    tracksStatus: document.getElementById('tracks-status'),
    fieldRelease: document.getElementById('field-release'),
    fieldLength: document.getElementById('field-length'),
    fieldLabel: document.getElementById('field-label'),
    fieldExplicit: document.getElementById('field-explicit'),
    fieldCredits: document.getElementById('field-credits'),
    fieldFsk: document.getElementById('field-fsk'),
    tmdbBlock: document.getElementById('tmdb-block'),
    tmdbKey: document.getElementById('tmdb-key'),
    tmdbSave: document.getElementById('tmdb-save'),
    tmdbClear: document.getElementById('tmdb-clear'),
    tmdbStatus: document.getElementById('tmdb-status'),
    coverPreview: document.getElementById('cover-preview'),
    coverUpload: document.getElementById('cover-upload'),
    coverMeta: document.getElementById('cover-meta'),
    coverUpgrade: document.getElementById('cover-upgrade'),
    coverUpscale: document.getElementById('cover-upscale'),
    coverStatus: document.getElementById('cover-status'),
    coverCandidates: document.getElementById('cover-candidates'),
    codePicker: document.getElementById('code-picker'),
    codeHint: document.getElementById('code-hint'),
    paletteRow: document.getElementById('palette-row'),
    accentCustom: document.getElementById('accent-custom'),
    sizePicker: document.getElementById('size-picker'),
    exportPng: document.getElementById('export-png'),
    exportPdf: document.getElementById('export-pdf'),
    exportStatus: document.getElementById('export-status'),

    posterCanvas: document.getElementById('poster-canvas'),
    previewStage: document.getElementById('preview-stage'),
    previewNote: document.getElementById('preview-note'),
    framePicker: document.getElementById('frame-picker'),
    toggleBtns: document.querySelectorAll('.toggle-btn'),
  };

  // Die Vorschau ist so breit wie eh und je, ihre Höhe folgt aber dem
  // Seitenverhältnis des gewählten Formats: die A-Reihe hat 1:1,414, die
  // Plakatmaße 1:1,40 und 1:1,43.
  const PREVIEW_W = 720;
  function previewHeight() {
    return Math.round(PREVIEW_W * Poster.exportPoster.ratio(model.size));
  }

  const model = {
    kind: 'music',
    // Filmfelder: Regie und Besetzung liegen getrennt, weil das Plakat sie an
    // verschiedenen Stellen setzt; filmCredits ist der Billing Block.
    tagline: '', director: '', cast: [], filmCredits: [],
    runtimeText: '', genresText: '', certification: '', studio: '',
    releaseLine: '', titleLogoImg: null, movieId: null,
    title: '', artist: '', subtitle: '', albumName: '', duration: '',
    tracks: [], releaseDate: '', label: '', totalLength: '', year: '',
    showExplicit: false,
    coverImg: null,
    accent: '#1db954', palette: [],
    style: 'tracklist',
    codeType: 'qr',
    spotifyUri: null,
    appleUrl: null,
    size: 'A4',
  };
  let codeGeneration = 0;
  let detailGeneration = 0;
  let renderTimer = null;

  function placeholderCover() {
    const c = document.createElement('canvas');
    c.width = 600; c.height = 600;
    const ctx = c.getContext('2d');
    const g = ctx.createLinearGradient(0, 0, 600, 600);
    g.addColorStop(0, '#2a2d34');
    g.addColorStop(1, '#12141a');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 600, 600);
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    ctx.beginPath();
    ctx.arc(230, 380, 46, 0, Math.PI * 2);
    ctx.arc(400, 340, 46, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillRect(266, 160, 14, 224);
    ctx.fillRect(436, 120, 14, 224);
    ctx.fillRect(266, 160, 184, 14);
    const img = new Image();
    img.src = c.toDataURL('image/png');
    return img;
  }

  async function loadFonts() {
    const specs = [
      '400 16px "Hanken Grotesk"', '700 16px "Hanken Grotesk"',
      '400 16px "Space Grotesk"', '700 16px "Space Grotesk"',
      '400 16px "Abril Fatface"',
      '400 16px "Vollkorn"', '700 16px "Vollkorn"',
      '400 16px "Anton"',
      '400 16px "Special Elite"',
      '400 16px "Saira Extra Condensed"', '600 16px "Saira Extra Condensed"',
    ];
    await Promise.all(specs.map((s) => document.fonts.load(s).catch(() => {})));
    try { await document.fonts.ready; } catch (e) { /* older browsers */ }
  }

  // Ein einzelnes fehlendes Element hat früher die ganze Initialisierung
  // abgebrochen — und damit auch den Submit-Handler der Suche, der ganz unten
  // steht. Seither hängt kein Listener mehr an der Existenz aller anderen.
  function on(el, type, fn) {
    if (el) el.addEventListener(type, fn);
  }

  // „Load failed" (WebKit) bzw. „Failed to fetch" (Chromium) heißt beides nur:
  // die Verbindung kam nicht zustande. Als Meldung ist das für niemanden
  // brauchbar.
  function errorText(e) {
    return /load failed|failed to fetch|networkerror/i.test(e.message || '')
      ? 'Netzwerkfehler — bitte noch einmal versuchen.'
      : e.message;
  }

  function setStatus(el, text, kind) {
    el.textContent = text || '';
    el.dataset.kind = kind || '';
  }

  // --- Kanal und Version ------------------------------------------------------

  (function showBuild() {
    const badge = document.getElementById('build-badge');
    const link = document.getElementById('channel-link');
    if (!badge) return;
    const build = Poster.BUILD || { channel: 'lokal', version: 'dev' };

    badge.dataset.channel = build.channel;
    badge.textContent = ({ release: 'Release', beta: 'Beta', lokal: 'Lokal' }[build.channel] || build.channel)
      + ' ' + build.version + (build.commit ? ' · ' + build.commit : '');

    if (!link) return;
    if (build.channel === 'release') {
      link.href = 'beta/';
      link.textContent = 'Beta-Version öffnen →';
    } else if (build.channel === 'beta') {
      link.href = '../';
      link.textContent = '← zur stabilen Version';
    } else {
      link.hidden = true;
    }
  })();

  // --- Diagnose ---------------------------------------------------------------

  const diag = {
    block: document.getElementById('diag-block'),
    log: document.getElementById('diag-log'),
    copy: document.getElementById('diag-copy'),
    test: document.getElementById('diag-test'),
    status: document.getElementById('diag-status'),
  };

  if (Poster.log && diag.log) {
    const paint = () => { diag.log.value = Poster.log.text(); };
    paint();
    Poster.log.watch(() => { if (diag.block.open) paint(); });
    on(diag.block, 'toggle', () => { if (diag.block.open) paint(); });

    on(diag.copy, 'click', async () => {
      const text = Poster.log.text();
      try {
        await navigator.clipboard.writeText(text);
        setStatus(diag.status, 'Protokoll kopiert.');
      } catch (e) {
        // Auf iOS scheitert das Clipboard je nach Kontext — dann wenigstens
        // alles markieren, damit „Kopieren" aus dem Menü reicht.
        diag.log.focus();
        diag.log.select();
        setStatus(diag.status, 'Markiert — bitte über das Menü kopieren.');
      }
    });

    // Prüft der Reihe nach die beteiligten Hosts und schreibt jedes Ergebnis
    // mit Dauer ins Protokoll: daran ist ablesbar, was genau nicht durchkommt.
    on(diag.test, 'click', async () => {
      setStatus(diag.status, 'Test läuft…');
      diag.test.disabled = true;
      const targets = [
        ['iTunes-Suche', 'https://itunes.apple.com/search?term=test&media=music&entity=song&limit=1&country=DE'],
        ['MusicBrainz', 'https://musicbrainz.org/ws/2/release/?query=a&fmt=json&limit=1'],
        ['Cover Art Archive', 'https://coverartarchive.org/release/36e2aede-346d-4931-8565-78d810d167c7/front-250'],
        ['eigene Herkunft', 'room.svg?t=' + Date.now()],
      ];
      for (const [name, url] of targets) {
        const t0 = Date.now();
        try {
          const resp = await fetch(url, { cache: 'no-store' });
          Poster.log.add('TEST ' + name + ' → HTTP ' + resp.status + ' (' + (Date.now() - t0) + ' ms)');
        } catch (e) {
          Poster.log.add('TEST ' + name + ' → ' + (e.name || 'Fehler') + ': ' + e.message
            + ' (' + (Date.now() - t0) + ' ms)');
        }
      }
      diag.log.value = Poster.log.text();
      diag.test.disabled = false;
      setStatus(diag.status, 'Test fertig — Protokoll unten.');
    });
  }

  // --- Modus: Musik oder Film -------------------------------------------------

  // Statt einer zweiten Oberfläche schaltet der Modus dieselbe um: Felder
  // bekommen andere Beschriftungen, die Stilauswahl zeigt nur die passenden
  // Layouts, und die filmspezifischen Blöcke tauchen auf.
  const MODE_STYLE = { music: 'tracklist', film: 'filmkeyart' };

  function applyMode(kind) {
    model.kind = kind;

    document.querySelectorAll('[data-kind]').forEach((el) => {
      el.hidden = el.dataset.kind !== kind;
    });
    document.querySelectorAll('[data-l-music]').forEach((el) => {
      el.textContent = kind === 'film' ? el.dataset.lFilm : el.dataset.lMusic;
    });

    if (els.entityRow) els.entityRow.hidden = kind === 'film';
    if (els.searchInput) {
      els.searchInput.placeholder = kind === 'film'
        ? 'Filmtitel…' : 'Künstler, Album oder Song…';
    }

    // Ein Musikstil kann kein Filmplakat zeichnen und umgekehrt.
    const current = Poster.styles[model.style];
    const fits = current && (current.kinds || ['music']).indexOf(kind) !== -1;
    if (!fits) {
      model.style = MODE_STYLE[kind];
      const radio = els.stylePicker.querySelector('input[value="' + model.style + '"]');
      if (radio) radio.checked = true;
    }

    els.searchResults.innerHTML = '';
    els.resultsBack.hidden = true;
    setStatus(els.searchStatus, '');
    updateTrackHint();
    scheduleRender();
  }

  on(els.modePicker, 'change', (e) => {
    if (e.target.name !== 'mode') return;
    applyMode(e.target.value);
  });

  // --- TMDB-Zugang ------------------------------------------------------------

  (function initTmdbPanel() {
    if (!els.tmdbKey) return;
    if (Poster.tmdb.isConfigured()) setStatus(els.tmdbStatus, 'Schlüssel hinterlegt.');
  })();

  on(els.tmdbSave, 'click', async () => {
    const key = (els.tmdbKey.value || '').trim();
    if (!key) {
      setStatus(els.tmdbStatus, 'Bitte den API-Schlüssel eintragen.', 'error');
      return;
    }
    Poster.tmdb.setKey(key);
    setStatus(els.tmdbStatus, 'Prüfe…');
    try {
      await Poster.tmdb.search('Test');
      setStatus(els.tmdbStatus, 'Schlüssel akzeptiert — Filmsuche steht bereit.');
      els.tmdbKey.value = '';
    } catch (e) {
      setStatus(els.tmdbStatus, errorText(e), 'error');
    }
  });

  on(els.tmdbClear, 'click', () => {
    Poster.tmdb.clearKey();
    els.tmdbKey.value = '';
    setStatus(els.tmdbStatus, 'Schlüssel entfernt.');
  });

  // --- Search -------------------------------------------------------------

  function searchEntity() {
    const el = els.searchForm.querySelector('input[name="search-entity"]:checked');
    return el ? el.value : 'song';
  }

  let artistResults = null;

  async function doSearch(term) {
    if (!term.trim()) return;
    setStatus(els.searchStatus, 'Suche läuft…');
    els.searchResults.innerHTML = '';
    els.resultsBack.hidden = true;
    artistResults = null;
    try {
      if (model.kind === 'film') {
        if (!Poster.tmdb.isConfigured()) {
          setStatus(els.searchStatus, 'Für Filme fehlt der TMDB-Schlüssel — siehe „TMDB-Zugang".', 'error');
          if (els.tmdbBlock) els.tmdbBlock.open = true;
          return;
        }
        const films = await Poster.tmdb.search(term.trim());
        renderResults(films);
        setStatus(els.searchStatus, films.length ? films.length + ' Filme (TMDB)' : 'Keine Treffer.');
        return;
      }
      const { results, source } = await api.search(term.trim(), searchEntity());
      renderResults(results);
      if (searchEntity() === 'artist') artistResults = results;
      setStatus(
        els.searchStatus,
        results.length
          ? results.length + ' Treffer (' + (source === 'spotify' ? 'Spotify' : 'iTunes') + ')'
          : 'Keine Treffer.'
      );
    } catch (e) {
      console.error(e);
      setStatus(els.searchStatus, 'Suche fehlgeschlagen: ' + errorText(e) + ' — Details unter „Diagnose".', 'error');
    }
  }

  // Ein Künstlertreffer ist kein Poster, sondern der Weg dorthin: er klappt die
  // Diskografie auf, damit man das Album nicht am Titel erraten muss.
  async function showDiscography(artistResult) {
    setStatus(els.searchStatus, 'Alben von ' + artistResult.artist + ' werden geladen…');
    els.searchResults.innerHTML = '';
    try {
      const albums = await api.fetchDiscography(artistResult);
      renderResults(albums);
      els.resultsBack.hidden = false;
      setStatus(els.searchStatus, albums.length
        ? albums.length + ' Alben von ' + artistResult.artist + ', neueste zuerst'
        : 'Keine Alben gefunden.');
    } catch (e) {
      console.error(e);
      setStatus(els.searchStatus, 'Diskografie fehlgeschlagen: ' + errorText(e), 'error');
    }
  }

  on(els.resultsBack, 'click', () => {
    if (!artistResults) return;
    renderResults(artistResults);
    els.resultsBack.hidden = true;
    setStatus(els.searchStatus, artistResults.length + ' Künstler');
  });

  // iTunes liefert zu Künstlern grundsätzlich kein Bild. Ein <img> ohne Quelle
  // zeigt das Kaputt-Symbol des Browsers — deshalb gezeichnete Platzhalter:
  // Schattenriss für Künstler, Platte fürs Album, Note für den Song.
  const PLACEHOLDERS = {
    artist: '<svg viewBox="0 0 40 40" aria-hidden="true"><circle cx="20" cy="14.5" r="6.8"/>'
      + '<path d="M6.5 35.5c0-7.4 6-11.4 13.5-11.4s13.5 4 13.5 11.4z"/></svg>',
    album: '<svg viewBox="0 0 40 40" aria-hidden="true"><circle cx="20" cy="20" r="12.5" fill="none"'
      + ' stroke="currentColor" stroke-width="2.6"/><circle cx="20" cy="20" r="3.1"/></svg>',
    movie: '<svg viewBox="0 0 40 40" aria-hidden="true"><rect x="7" y="9" width="26" height="22" rx="2.5" fill="none" stroke="currentColor" stroke-width="2.4"/>'
      + '<path d="M12 9v22M28 9v22" stroke="currentColor" stroke-width="2.2"/>'
      + '<circle cx="9.6" cy="13" r="1.3"/><circle cx="9.6" cy="20" r="1.3"/><circle cx="9.6" cy="27" r="1.3"/>'
      + '<circle cx="30.4" cy="13" r="1.3"/><circle cx="30.4" cy="20" r="1.3"/><circle cx="30.4" cy="27" r="1.3"/></svg>',
    track: '<svg viewBox="0 0 40 40" aria-hidden="true"><path d="M17.5 9.5L30 6.8v4.1l-12.5 2.7z"/>'
      + '<rect x="17.5" y="9.5" width="2.4" height="17.5"/><rect x="27.6" y="6.8" width="2.4" height="14.8"/>'
      + '<ellipse cx="14.5" cy="27.6" rx="5.2" ry="4.3"/><ellipse cx="24.6" cy="24.9" rx="5.2" ry="4.3"/></svg>',
  };

  function resultThumb(r) {
    if (r.coverUrl) {
      const img = document.createElement('img');
      img.src = r.coverUrl;
      img.alt = '';
      img.loading = 'lazy';
      return img;
    }
    const span = document.createElement('span');
    span.className = 'result-placeholder';
    span.innerHTML = PLACEHOLDERS[r.type] || PLACEHOLDERS.album;
    return span;
  }

  function renderResults(results) {
    els.searchResults.innerHTML = '';
    results.forEach((r) => {
      const li = document.createElement('li');
      li.className = 'result-item';
      li.tabIndex = 0;

      const thumb = resultThumb(r);

      const text = document.createElement('span');
      text.className = 'result-text';
      const title = document.createElement('strong');
      title.textContent = r.title;
      const sub = document.createElement('span');
      // Zweite Zeile trägt das, woran man die richtige Ausgabe erkennt: bei
      // Songs das Album, bei Alben Jahr und Titelzahl, bei Künstlern das Genre.
      if (r.type === 'movie') {
        sub.textContent = [r.year, r.originalTitle !== r.title ? r.originalTitle : '']
          .filter(Boolean).join(' · ');
      } else if (r.type === 'artist') {
        sub.textContent = r.genre || 'Künstler';
      } else if (r.type === 'album') {
        sub.textContent = [r.artist, r.year, r.trackCount ? r.trackCount + ' Titel' : '']
          .filter(Boolean).join(' · ');
      } else {
        sub.textContent = [r.artist, r.albumName, r.year].filter(Boolean).join(' · ');
      }
      text.append(title, sub);

      const badge = document.createElement('span');
      badge.className = 'result-badge';
      badge.textContent = r.type === 'movie' ? 'Film'
        : r.type === 'artist' ? 'Alben ›'
        : r.type === 'album' ? 'Album' : 'Song';

      li.append(thumb, text, badge);
      const open = () => (r.type === 'artist' ? showDiscography(r) : selectResult(r));
      li.addEventListener('click', open);
      li.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open(); }
      });
      els.searchResults.appendChild(li);
    });
  }

  async function selectResult(r) {
    if (r.type === 'movie') return selectMovie(r);
    model.title = r.title || '';
    model.artist = r.artist || '';
    model.albumName = r.albumName || r.title || '';
    model.duration = U.formatDuration(r.durationMs);
    model.subtitle = [r.type === 'track' ? r.albumName : '', r.year].filter(Boolean).join(' · ');
    model.year = r.year || '';
    model.releaseDate = U.formatDateDE(r.releaseDate) || r.year || '';
    model.showExplicit = !!r.explicit;
    model.tracks = [];
    model.totalLength = '';
    model.label = '';
    model.spotifyUri = r.spotifyUri || null;
    model.appleUrl = r.appleUrl || null;

    syncFieldsFromModel();
    els.editorFields.hidden = false;
    loadAlbumDetails(r);

    await loadCover(r);
    updatePaletteUI();

    if (!model.spotifyUri && api.Spotify.isConfigured()) {
      api.Spotify.resolveUri(model.artist, model.title, r.type).then((uri) => {
        if (uri) { model.spotifyUri = uri; updateCodeOptionsUI(); prepareCodeAssets(); }
      });
    }
    updateCodeOptionsUI();
    prepareCodeAssets();
  }

  // Der Filmtreffer trägt nur Titel, Jahr und Plakat. Stab, Laufzeit, Freigabe
  // und Titelschriftzug holt ein zweiter Aufruf nach.
  async function selectMovie(r) {
    const gen = ++detailGeneration;
    model.movieId = r.movieId;
    model.title = r.title || '';
    model.year = r.year || '';
    model.subtitle = '';
    model.tagline = '';
    model.director = '';
    model.cast = [];
    model.filmCredits = [];
    model.runtimeText = '';
    model.genresText = '';
    model.certification = '';
    model.studio = '';
    model.releaseDate = U.formatDateDE(r.releaseDate) || r.year || '';
    model.releaseLine = '';
    model.titleLogoImg = null;
    model.tracks = [];
    model.spotifyUri = null;
    model.appleUrl = null;

    syncFieldsFromModel();
    els.editorFields.hidden = false;
    await loadCover(r);

    setStatus(els.tracksStatus, 'Filmdaten werden geladen…');
    try {
      const d = await Poster.tmdb.details(r.movieId);
      if (gen !== detailGeneration) return;

      model.title = d.title || model.title;
      model.tagline = d.tagline;
      model.subtitle = d.tagline;
      model.director = d.directors.join(', ');
      model.artist = model.director;
      model.cast = d.cast.slice(0, 8);
      model.runtimeText = d.runtime ? d.runtime + ' Min.' : '';
      model.genresText = d.genres.slice(0, 3).join(' · ');
      model.certification = d.certification;
      model.studio = d.studios[0] || '';
      model.releaseDate = U.formatDateDE(d.releaseDate) || model.releaseDate;
      model.releaseLine = model.releaseDate ? 'Im Kino ab ' + model.releaseDate : '';
      model.year = (d.releaseDate || '').slice(0, 4) || model.year;
      model.filmCredits = [
        { label: 'Regie', names: d.directors },
        { label: 'Drehbuch', names: d.writers },
        { label: 'Kamera', names: d.camera },
        { label: 'Schnitt', names: d.editors },
        { label: 'Musik', names: d.music },
        { label: 'Produktion', names: d.producers },
      ].filter((c) => c.names.length);

      // Der Originalschriftzug ist ein PNG mit Transparenz — wenn er sich nicht
      // laden lässt, setzt der Stil den Titel einfach als Schrift.
      if (d.titleLogoUrl) {
        U.loadImage(d.titleLogoUrl, 'anonymous')
          .then((img) => {
            if (gen !== detailGeneration) return;
            model.titleLogoImg = img;
            setStatus(els.tracksStatus, 'Filmdaten geladen — mit Original-Titelschriftzug.');
            scheduleRender();
          })
          .catch(() => {});
      }

      syncFieldsFromModel();
      setStatus(els.tracksStatus, 'Filmdaten geladen.');
      prepareCodeAssets();
      scheduleRender();
    } catch (e) {
      if (gen !== detailGeneration) return;
      setStatus(els.tracksStatus, 'Filmdaten nicht ladbar: ' + errorText(e), 'error');
    }
  }

  // Tracklist und Albumangaben kommen erst nach der Auswahl — die Suche liefert sie nicht mit.
  async function loadAlbumDetails(r) {
    const gen = ++detailGeneration;
    setStatus(els.tracksStatus, 'Tracklist wird geladen…');
    try {
      const details = await api.fetchAlbumDetails(r);
      if (gen !== detailGeneration) return;
      if (!details || !details.tracks.length) {
        setStatus(els.tracksStatus, 'Keine Tracklist gefunden — Titel hier von Hand eintragen.', 'error');
        return;
      }
      model.tracks = details.tracks.map((t) => t.name);
      model.totalLength = U.formatDuration(details.tracks.reduce((sum, t) => sum + (t.durationMs || 0), 0));
      model.releaseDate = U.formatDateDE(details.releaseDate) || model.releaseDate;
      model.label = details.label || '';
      if (details.explicit) model.showExplicit = true;
      syncFieldsFromModel();
      setStatus(els.tracksStatus, details.tracks.length + ' Titel geladen.');
      scheduleRender();
    } catch (e) {
      if (gen !== detailGeneration) return;
      setStatus(els.tracksStatus, 'Tracklist nicht ladbar: ' + errorText(e), 'error');
    }
  }

  async function loadCover(r) {
    const candidates = [r.coverUrlHigh, r.coverUrl].filter(Boolean);
    for (const url of candidates) {
      try {
        const img = await U.loadImage(url, 'anonymous');
        applyCover(img);
        return;
      } catch (e) { /* try next candidate */ }
    }
    setStatus(els.exportStatus, 'Cover wird über MusicBrainz gesucht…');
    const mbUrls = await api.findCoverViaMusicBrainz(model.artist, model.title);
    for (const url of mbUrls) {
      try {
        const img = await U.loadImage(url, 'anonymous');
        applyCover(img);
        setStatus(els.exportStatus, '');
        return;
      } catch (e) { /* nächste Ausgabe versuchen */ }
    }
    applyCover(placeholderCover());
    setStatus(els.exportStatus, 'Kein Cover gefunden — bitte manuell hochladen.', 'error');
  }

  function applyCover(img) {
    model.coverImg = img;
    els.coverPreview.src = img.src;
    const { accent, palette } = Poster.color.extractPalette(img);
    model.accent = accent;
    model.palette = palette;
    els.accentCustom.value = accent;
    updatePaletteUI();
    updateCoverMeta();
    scheduleRender();
  }

  // Wie scharf das Cover im Druck wird, hängt am gewählten Format: dieselben
  // 640 px sind auf A4 gerade noch brauchbar und auf A2 sichtbar weich.
  function updateCoverMeta() {
    const img = model.coverImg;
    if (!img || !img.naturalWidth) {
      els.coverMeta.textContent = '';
      return;
    }
    const paperMm = (Poster.exportPoster.SIZES[model.size] || { w: 210 }).w * 0.85;
    const dpi = Math.round(img.naturalWidth / (paperMm / 25.4));
    els.coverMeta.textContent = img.naturalWidth + ' × ' + img.naturalHeight
      + ' px · ca. ' + dpi + ' dpi bei ' + model.size
      + (model.coverUpscaled ? ' · hochgerechnet' : '');
    els.coverMeta.dataset.kind = dpi < 150 ? 'error' : dpi < 220 ? 'warn' : '';
    // Hochrechnen ist die Notlösung: nur anbieten, wenn es wirklich knapp wird
    // und das Bild noch klein genug ist, dass es überhaupt etwas ändert.
    els.coverUpscale.hidden = model.coverUpscaled || dpi >= 220 || img.naturalWidth >= Poster.upscale.MAX_TARGET;
  }

  // Bewusst ein Knopf und eine Auswahl: automatisch über Namen gematcht landet
  // sonst still das Cover einer anderen Ausgabe auf dem Poster.
  on(els.coverUpgrade, 'click', async () => {
    const album = model.albumName || model.title;
    els.coverCandidates.hidden = true;
    setStatus(els.coverStatus, 'Suche Cover in höherer Auflösung…');
    try {
      const candidates = await api.findCoverCandidates(model.artist, album);
      if (!candidates.length) {
        setStatus(els.coverStatus, 'Keine Alternativen gefunden.', 'error');
        return;
      }
      renderCoverCandidates(candidates);
      setStatus(els.coverStatus, 'Richtige Ausgabe wählen — die Liste enthält auch Remaster und Singles.');
    } catch (e) {
      setStatus(els.coverStatus, 'Suche fehlgeschlagen: ' + errorText(e), 'error');
    }
  });

  function renderCoverCandidates(candidates) {
    els.coverCandidates.innerHTML = '';
    candidates.forEach((c) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'cover-candidate';
      const img = document.createElement('img');
      img.src = c.thumbUrl;
      img.alt = '';
      img.loading = 'lazy';
      // Das Cover Art Archive hat nicht zu jeder Ausgabe einen Scan; solche
      // Vorschläge fallen still raus, statt als leeres Kästchen dazustehen.
      img.addEventListener('error', () => btn.remove());
      const caption = document.createElement('span');
      caption.textContent = [c.year, c.detail].filter(Boolean).join(' · ') || c.title;
      caption.title = c.artist + ' — ' + c.title + ' (' + c.source + ')';
      const source = document.createElement('em');
      source.textContent = c.source === 'Apple' ? 'Apple' : 'CAA';
      btn.append(img, caption, source);
      btn.addEventListener('click', () => applyCandidate(c));
      els.coverCandidates.appendChild(btn);
    });
    els.coverCandidates.hidden = false;
  }

  async function applyCandidate(c) {
    const before = model.coverImg ? model.coverImg.naturalWidth : 0;
    setStatus(els.coverStatus, 'Cover wird geladen…');
    for (const url of c.sizeUrls) {
      try {
        const img = await U.loadImage(url, 'anonymous');
        model.coverUpscaled = false;
        applyCover(img);
        els.coverCandidates.hidden = true;
        setStatus(els.coverStatus, before
          ? 'Übernommen (' + c.source + '): ' + before + ' → ' + img.naturalWidth + ' px.'
          : 'Übernommen (' + c.source + '): ' + img.naturalWidth + ' px.');
        return;
      } catch (e) { /* nächstkleinere Größe versuchen */ }
    }
    setStatus(els.coverStatus, 'Dieses Cover ließ sich nicht laden.', 'error');
  }

  // Letzte Möglichkeit, wenn keine Quelle mehr Pixel hat: rechnet das Cover
  // hoch, ohne Details zu erfinden — Lanczos statt der weichen Interpolation,
  // die der Browser beim Export sonst von allein anwendet.
  on(els.coverUpscale, 'click', async () => {
    if (!model.coverImg) return;
    const before = model.coverImg.naturalWidth;
    const paperMm = (Poster.exportPoster.SIZES[model.size] || { w: 210 }).w * 0.85;
    const target = Math.round((paperMm / 25.4) * 300);
    setStatus(els.coverStatus, 'Wird hochgerechnet — das dauert einen Moment…');
    els.coverUpscale.disabled = true;
    await new Promise((r) => setTimeout(r, 40)); // Statuszeile zeichnen lassen
    try {
      const img = await Poster.upscale.enlarge(model.coverImg, target);
      model.coverUpscaled = true;
      applyCover(img);
      setStatus(els.coverStatus, before + ' → ' + img.naturalWidth
        + ' px hochgerechnet. Das schärft die Kanten, bringt aber keine echten Details zurück.');
    } catch (e) {
      console.error(e);
      setStatus(els.coverStatus, 'Hochrechnen fehlgeschlagen: ' + e.message, 'error');
    } finally {
      els.coverUpscale.disabled = false;
    }
  });

  on(els.coverUpload, 'change', () => {
    const file = els.coverUpload.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      U.loadImage(reader.result).then(applyCover);
    };
    reader.readAsDataURL(file);
  });

  on(els.manualBtn, 'click', () => {
    if (model.kind === 'film') {
      model.title = model.title || 'Filmtitel';
      model.director = model.director || 'Regie';
      model.tagline = model.tagline || '';
      if (!model.coverImg) applyCover(placeholderCover());
      syncFieldsFromModel();
      els.editorFields.hidden = false;
      prepareCodeAssets();
      return;
    }
    model.title = model.title || 'Songtitel';
    model.artist = model.artist || 'Künstler:in';
    model.subtitle = model.subtitle || '';
    if (!model.coverImg) applyCover(placeholderCover());
    syncFieldsFromModel();
    els.editorFields.hidden = false;
    updateTrackHint();
    updateCodeOptionsUI();
    prepareCodeAssets();
  });

  // --- Editor fields --------------------------------------------------------

  function syncFieldsFromModel() {
    const film = model.kind === 'film';
    els.fieldTitle.value = model.title;
    els.fieldArtist.value = film ? model.director : model.artist;
    els.fieldSubtitle.value = film ? model.tagline : model.subtitle;
    els.fieldTracks.value = (film ? model.cast : model.tracks).join('\n');
    els.fieldRelease.value = model.releaseDate;
    els.fieldLength.value = film ? model.runtimeText : (model.totalLength || model.duration);
    els.fieldLabel.value = film ? model.studio : model.label;
    els.fieldExplicit.checked = model.showExplicit;
    if (els.fieldFsk) els.fieldFsk.value = model.certification;
    if (els.fieldCredits) {
      els.fieldCredits.value = (model.filmCredits || [])
        .map((c) => c.label + ': ' + c.names.join(', ')).join('\n');
    }
    [...els.sizePicker.querySelectorAll('input')].forEach((i) => { i.checked = i.value === model.size; });
    [...els.stylePicker.querySelectorAll('input')].forEach((i) => { i.checked = i.value === model.style; });
  }

  const film = () => model.kind === 'film';

  on(els.fieldTitle, 'input', () => { model.title = els.fieldTitle.value; scheduleRender(); });
  on(els.fieldArtist, 'input', () => {
    if (film()) model.director = els.fieldArtist.value; else model.artist = els.fieldArtist.value;
    scheduleRender();
  });
  on(els.fieldSubtitle, 'input', () => {
    if (film()) model.tagline = els.fieldSubtitle.value; else model.subtitle = els.fieldSubtitle.value;
    scheduleRender();
  });
  on(els.fieldRelease, 'input', () => {
    model.releaseDate = els.fieldRelease.value;
    if (film()) model.releaseLine = model.releaseDate ? 'Im Kino ab ' + model.releaseDate : '';
    scheduleRender();
  });
  on(els.fieldLength, 'input', () => {
    if (film()) model.runtimeText = els.fieldLength.value; else model.totalLength = els.fieldLength.value;
    scheduleRender();
  });
  on(els.fieldLabel, 'input', () => {
    if (film()) model.studio = els.fieldLabel.value; else model.label = els.fieldLabel.value;
    scheduleRender();
  });
  on(els.fieldFsk, 'input', () => { model.certification = els.fieldFsk.value.trim(); scheduleRender(); });
  // Der Billing Block wird als „Rolle: Namen" je Zeile eingegeben und bleibt
  // damit genauso überschreibbar wie die Tracklist.
  on(els.fieldCredits, 'input', () => {
    model.filmCredits = els.fieldCredits.value.split('\n')
      .map((line) => {
        const i = line.indexOf(':');
        if (i === -1) return null;
        const names = line.slice(i + 1).split(',').map((n) => n.trim()).filter(Boolean);
        return names.length ? { label: line.slice(0, i).trim(), names } : null;
      })
      .filter(Boolean);
    scheduleRender();
  });
  on(els.fieldExplicit, 'change', () => {
    model.showExplicit = els.fieldExplicit.checked;
    scheduleRender();
  });
  on(els.fieldTracks, 'input', () => {
    const lines = els.fieldTracks.value.split('\n').map((l) => l.trim()).filter(Boolean);
    if (film()) model.cast = lines; else model.tracks = lines;
    scheduleRender();
  });

  on(els.stylePicker, 'change', (e) => {
    if (e.target.name !== 'style') return;
    model.style = e.target.value;
    updateTrackHint();
    scheduleRender();
  });

  // Manche Layouts leben von der Tracklist — ohne sie bleibt dort eine Lücke.
  function updateTrackHint() {
    if (model.kind === 'film') { setStatus(els.tracksStatus, ''); return; }
    const styleModule = Poster.styles[model.style];
    if (styleModule && styleModule.needsTracks && !model.tracks.length) {
      setStatus(els.tracksStatus, 'Dieser Stil zeigt eine Tracklist — bitte Titel eintragen oder einen Treffer wählen.', 'error');
    }
  }

  on(els.sizePicker, 'change', (e) => {
    if (e.target.name !== 'size') return;
    model.size = e.target.value;
    updateCoverMeta();
    updateWallScale();
    // Die Plakatmaße haben andere Seitenverhältnisse als die A-Reihe: ohne
    // Neuzeichnen behielte die Vorschau die Maße des vorherigen Formats.
    scheduleRender();
  });

  function updatePaletteUI() {
    els.paletteRow.innerHTML = '';
    model.palette.forEach((hex) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'swatch-btn';
      b.style.background = hex;
      b.title = hex;
      if (hex.toLowerCase() === model.accent.toLowerCase()) b.classList.add('active');
      b.addEventListener('click', () => {
        model.accent = hex;
        els.accentCustom.value = hex;
        [...els.paletteRow.children].forEach((c) => c.classList.remove('active'));
        b.classList.add('active');
        prepareCodeAssets();
      });
      els.paletteRow.appendChild(b);
    });
  }

  on(els.accentCustom, 'input', () => {
    model.accent = els.accentCustom.value;
    [...els.paletteRow.children].forEach((c) => c.classList.remove('active'));
    prepareCodeAssets();
  });

  function updateCodeOptionsUI() {
    const spotifyRadio = els.codePicker.querySelector('input[value="spotify"]');
    spotifyRadio.disabled = !model.spotifyUri;
    if (!model.spotifyUri && model.codeType === 'spotify') {
      model.codeType = 'qr';
      els.codePicker.querySelector('input[value="qr"]').checked = true;
    }
    setStatus(
      els.codeHint,
      model.spotifyUri
        ? 'Echter, scanbarer Spotify-Code verfügbar.'
        : 'Kein Spotify-Code auflösbar — QR-Code verlinkt zum Song.'
    );
  }

  on(els.codePicker, 'change', (e) => {
    if (e.target.name !== 'codeType') return;
    model.codeType = e.target.value;
    prepareCodeAssets();
  });

  // --- Spotify credentials --------------------------------------------------

  (function initSpotifyPanel() {
    const creds = api.Spotify.getCreds();
    if (creds) {
      els.spotifyId.value = creds.id || '';
      setStatus(els.spotifyStatus, 'Gespeicherte Zugangsdaten aktiv.');
    }
  })();

  on(els.spotifySave, 'click', async () => {
    const id = els.spotifyId.value.trim();
    const secret = els.spotifySecret.value.trim();
    if (!id || !secret) {
      setStatus(els.spotifyStatus, 'Bitte Client-ID und Client-Secret eingeben.', 'error');
      return;
    }
    api.Spotify.setCreds(id, secret);
    setStatus(els.spotifyStatus, 'Verbinde…');
    try {
      await api.Spotify.getToken();
      setStatus(els.spotifyStatus, 'Verbunden — Spotify ist jetzt Hauptquelle für Suche & Code.');
      els.spotifySecret.value = '';
    } catch (e) {
      setStatus(els.spotifyStatus, e.message + ' — App nutzt weiterhin iTunes/QR-Code.', 'error');
    }
  });

  on(els.spotifyClear, 'click', () => {
    api.Spotify.clearCreds();
    els.spotifyId.value = '';
    els.spotifySecret.value = '';
    setStatus(els.spotifyStatus, 'Zugangsdaten entfernt.');
  });

  // --- Code asset resolution (Spotify scannable code vs. QR fallback) -------

  function qrTargetUrl() {
    if (model.spotifyUri) {
      const parts = model.spotifyUri.split(':');
      return 'https://open.spotify.com/' + parts[1] + '/' + parts[2];
    }
    if (model.appleUrl) return model.appleUrl;
    return 'https://open.spotify.com/search/' + encodeURIComponent((model.artist + ' ' + model.title).trim() || 'music');
  }

  async function prepareCodeAssets() {
    const gen = ++codeGeneration;
    model._effectiveCodeType = model.codeType;
    model._spotifyCodeImg = null;
    model.qrTargetUrl = qrTargetUrl();

    if (model.codeType === 'spotify' && model.spotifyUri) {
      const bgLight = U.relativeLuminance(...Object.values(U.hexToRgb(model.accent))) > 0.5;
      const url = api.Spotify.scannableUrl(model.spotifyUri, {
        bg: model.accent,
        codeColor: bgLight ? 'black' : 'white',
      });
      try {
        const img = await U.loadImage(url, 'anonymous');
        if (gen !== codeGeneration) return;
        model._spotifyCodeImg = img;
      } catch (e) {
        if (gen !== codeGeneration) return;
        model._effectiveCodeType = 'qr';
        setStatus(els.codeHint, 'Spotify-Code aktuell nicht ladbar — QR-Code verwendet.', 'error');
      }
    }
    if (gen !== codeGeneration) return;
    buildDrawCode();
    scheduleRender();
  }

  function buildDrawCode() {
    if (model._effectiveCodeType === 'none') {
      model.drawCode = null;
      return;
    }
    // Der Spotify-Code ist ein breiter Streifen, der QR-Code quadratisch. Beide
    // füllen die zugewiesene Box also unterschiedlich — daher die Ausrichtung.
    if (model._effectiveCodeType === 'spotify' && model._spotifyCodeImg) {
      const img = model._spotifyCodeImg;
      model.drawCode = function (ctx, x, y, maxW, maxH, align) {
        const scale = Math.min(maxW / img.width, maxH / img.height);
        const w = img.width * scale, h = img.height * scale;
        ctx.drawImage(img, anchor(x, maxW, w, align), y, w, h);
        return { w, h };
      };
      return;
    }
    const target = model.qrTargetUrl;
    model.drawCode = function (ctx, x, y, maxW, maxH, align) {
      const size = Math.min(maxW, maxH);
      return Poster.qr.drawQR(ctx, target, anchor(x, maxW, size, align), y, size, {
        dark: '#111111', light: '#ffffff',
      });
    };
  }

  function anchor(x, boxW, drawnW, align) {
    if (align === 'right') return x + boxW - drawnW;
    if (align === 'center') return x + (boxW - drawnW) / 2;
    return x;
  }

  // --- Preview render ---------------------------------------------------------

  function scheduleRender() {
    clearTimeout(renderTimer);
    renderTimer = setTimeout(render, 90);
  }

  function render() {
    if (!model.coverImg) return;
    const canvas = els.posterCanvas;
    const h = previewHeight();
    if (canvas.width !== PREVIEW_W || canvas.height !== h) {
      canvas.width = PREVIEW_W;
      canvas.height = h;
      // Ohne das bliebe das im Stylesheet gesetzte Verhältnis stehen und das
      // Bild würde verzerrt dargestellt.
      canvas.style.aspectRatio = PREVIEW_W + ' / ' + h;
    }
    const ctx = canvas.getContext('2d');
    const styleModule = Poster.styles[model.style] || Poster.styles.minimal;
    styleModule.draw(ctx, PREVIEW_W, h, model);
  }

  // --- Preview mode toggle (poster / framed wall) -----------------------------

  els.toggleBtns.forEach((btn) => {
    btn.addEventListener('click', () => {
      els.toggleBtns.forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      const wall = btn.dataset.mode === 'wall';
      els.previewStage.classList.toggle('mode-wall', wall);
      els.previewStage.classList.toggle('mode-poster', !wall);
      els.framePicker.hidden = !wall;
      els.previewNote.textContent = wall
        ? 'Maßstabsgetreu über einem 2-m-Sofa — nur Vorschau, nicht Teil des Exports.'
        : 'Die Wand-Ansicht ist nur eine Vorschau und nicht Teil des Exports.';
      updateWallScale();
    });
  });

  on(els.framePicker, 'click', (e) => {
    const btn = e.target.closest('.frame-btn');
    if (!btn) return;
    [...els.framePicker.querySelectorAll('.frame-btn')].forEach((b) => b.classList.remove('active'));
    btn.classList.add('active');
    els.previewStage.classList.remove('frame-black', 'frame-oak', 'frame-white');
    els.previewStage.classList.add('frame-' + btn.dataset.frame);
  });

  // Die Raumszene zeigt 130 cm Wandbreite. Daraus bekommt das Poster seine
  // echte Größe im Bild — A4 neben A2 an derselben Wand ist der eigentliche
  // Zweck der Ansicht, nicht die Deko.
  const SCENE = { w: 1200, h: 1000, wallCm: 130, centerY: 470 };

  function updateWallScale() {
    const paper = Poster.exportPoster.sizeInfo(model.size);
    const wCm = paper.w / 10;
    const hCm = paper.h / 10;
    const unitsPerCm = SCENE.w / SCENE.wallCm;
    const wUnits = wCm * unitsPerCm;
    const hUnits = hCm * unitsPerCm;
    els.previewStage.style.setProperty('--poster-width', (wUnits / SCENE.w) * 100 + '%');
    els.previewStage.style.setProperty('--poster-top', ((SCENE.centerY - hUnits / 2) / SCENE.h) * 100 + '%');
  }

  // --- Export -----------------------------------------------------------------

  on(els.exportPng, 'click', async () => {
    if (!model.coverImg) return;
    setStatus(els.exportStatus, 'PNG wird erstellt (kann bei A2 etwas dauern)…');
    try {
      await Poster.exportPoster.exportPNG(model, model.size);
      setStatus(els.exportStatus, 'PNG exportiert.');
    } catch (e) {
      console.error(e);
      setStatus(els.exportStatus, 'Export fehlgeschlagen: ' + e.message, 'error');
    }
  });

  on(els.exportPdf, 'click', async () => {
    if (!model.coverImg) return;
    setStatus(els.exportStatus, 'PDF wird erstellt (kann bei A2 etwas dauern)…');
    try {
      await Poster.exportPoster.exportPDF(model, model.size);
      setStatus(els.exportStatus, 'PDF exportiert.');
    } catch (e) {
      console.error(e);
      setStatus(els.exportStatus, 'Export fehlgeschlagen: ' + e.message, 'error');
    }
  });

  // --- Init ---------------------------------------------------------------

  on(els.searchForm, 'submit', (e) => {
    e.preventDefault();
    doSearch(els.searchInput.value);
  });

  applyMode('music');

  loadFonts().then(() => {
    buildDrawCode();
    if (model.coverImg) render();
  });
})();
