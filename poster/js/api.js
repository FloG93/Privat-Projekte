window.Poster = window.Poster || {};

Poster.api = (function () {
  // Ohne Land sucht iTunes im US-Store: deutsche Veröffentlichungen fehlen dort
  // oder stehen weit hinten. Spotify braucht denselben Markt als `market`.
  const MARKET = 'DE';
  const LIMIT = '25';

  // „Load failed" (WebKit) heißt: die Verbindung kam nicht zustande. Auf dem
  // iPad trifft das zuverlässig die zweite Abfrage an denselben Host — in Brave,
  // während Safari auf demselben Gerät durchläuft. Wiederholt wird deshalb
  // dreimal mit wachsender Pause: ein Versuch nach 250 ms greift oft dieselbe
  // tote Verbindung aus dem Pool wieder ab.
  //
  // `fetch` lehnt nur bei echten Netzwerkfehlern ab, HTTP-Fehler kommen normal
  // zurück — wiederholt wird also genau die richtige Klasse, keine 404, kein 403.
  function log(text) {
    if (Poster.log) Poster.log.add(text);
  }

  function label(url) {
    const u = new URL(url, location.href);
    return u.host + u.pathname;
  }

  async function request(url, init) {
    const name = label(url);
    for (let attempt = 1; attempt <= 3; attempt++) {
      if (attempt > 1) await new Promise((r) => setTimeout(r, attempt === 2 ? 400 : 1400));
      const t0 = Date.now();
      try {
        const resp = await fetch(url, init);
        log('fetch ' + name + ' #' + attempt + ' → HTTP ' + resp.status + ' (' + (Date.now() - t0) + ' ms)');
        return resp;
      } catch (e) {
        log('fetch ' + name + ' #' + attempt + ' → ' + (e.name || 'Fehler') + ': ' + e.message
          + ' (' + (Date.now() - t0) + ' ms)');
      }
    }
    probeControlHost();
    const err = new Error('Keine Verbindung zu ' + new URL(url, location.href).host);
    err.network = true;
    throw err;
  }

  // Gegenprobe an einen anderen Host, einmal je Sitzung: scheitert auch die,
  // liegt es nicht an Apple, sondern am Gerät oder am Browser insgesamt.
  let probed = false;
  function probeControlHost() {
    if (probed) return;
    probed = true;
    const t0 = Date.now();
    fetch('https://musicbrainz.org/ws/2/release/?query=a&fmt=json&limit=1')
      .then((r) => log('Gegenprobe musicbrainz.org → HTTP ' + r.status + ' (' + (Date.now() - t0) + ' ms)'))
      .catch((e) => log('Gegenprobe musicbrainz.org → ' + (e.name || 'Fehler') + ': ' + e.message
        + ' (' + (Date.now() - t0) + ' ms)'));
  }

  // Letzter Ausweg für die iTunes-Endpunkte, wenn fetch gar nicht durchkommt:
  // sie beherrschen JSONP, und ein <script>-Tag nimmt einen anderen Weg durch
  // den Browser als fetch — ohne CORS und an blockierten XHR-Pfaden vorbei.
  //
  // Der Preis ist real: JSONP führt Code der Gegenseite in dieser Seite aus.
  // Deshalb nur als Rückfallebene, nur für Apples eigene API über HTTPS.
  let jsonpSeq = 0;
  function jsonp(url, timeoutMs) {
    return new Promise((resolve, reject) => {
      const name = '__posterJsonp' + (++jsonpSeq);
      const script = document.createElement('script');
      const t0 = Date.now();
      const done = (err, data) => {
        clearTimeout(timer);
        delete window[name];
        script.remove();
        log('jsonp ' + label(url) + ' → ' + (err ? err.message : 'geladen')
          + ' (' + (Date.now() - t0) + ' ms)');
        if (err) reject(err); else resolve(data);
      };
      const timer = setTimeout(() => done(Object.assign(new Error('Zeitüberschreitung'), { network: true })), timeoutMs || 12000);
      window[name] = (data) => done(null, data);
      script.onerror = () => done(Object.assign(new Error('Auch der Rückfallweg wurde blockiert'), { network: true }));
      script.src = url + (url.indexOf('?') === -1 ? '?' : '&') + 'callback=' + name;
      log('jsonp ' + label(url) + ' startet');
      document.head.appendChild(script);
    });
  }

  async function itunesJson(url, what) {
    try {
      const resp = await request(url);
      if (!resp.ok) throw new Error(what + ' fehlgeschlagen (' + resp.status + ')');
      return await resp.json();
    } catch (e) {
      if (!e.network) throw e;
      return jsonp(url);
    }
  }

  // Apple liefert höchstens die Auflösung des hinterlegten Masters — eine
  // größere Anfrage gibt dieselben Bytes zurück, nicht mehr Pixel.
  function upgradeArtwork(url, px) {
    if (!url) return url;
    return url.replace(/\/\d+x\d+bb(\.[a-z]+)$/i, '/' + px + 'x' + px + 'bb$1');
  }

  // Dieselbe Aufnahme kommt bei iTunes aus jeder Wiederveröffentlichung einmal
  // zurück — ohne Zusammenfassen füllen 16 Treffer sich mit einem einzigen Song.
  function dedupe(results) {
    const seen = new Set();
    return results.filter((r) => {
      const key = [r.type, r.title, r.artist, r.albumName]
        .map((v) => String(v || '').toLowerCase().trim()).join('|');
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  const ITUNES_ENTITY = { song: 'song', album: 'album', artist: 'musicArtist' };

  async function searchITunes(term, entity) {
    const url = 'https://itunes.apple.com/search?' + new URLSearchParams({
      term, media: 'music', entity: ITUNES_ENTITY[entity] || 'song', limit: LIMIT, country: MARKET,
    });
    const json = await itunesJson(url, 'iTunes-Suche');

    if (entity === 'artist') {
      // Künstlertreffer haben bei iTunes kein Bild — nur Name, Genre und die ID,
      // über die unten die Diskografie kommt.
      return json.results.filter((r) => r.artistId).map((r) => ({
        source: 'itunes',
        type: 'artist',
        id: 'itunes:artist:' + r.artistId,
        artistId: String(r.artistId),
        title: r.artistName,
        artist: r.artistName,
        genre: r.primaryGenreName || '',
        coverUrl: null,
      }));
    }

    return dedupe(json.results.map((r) => ({
      source: 'itunes',
      type: entity === 'album' ? 'album' : 'track',
      id: 'itunes:' + (r.trackId || r.collectionId),
      albumId: r.collectionId ? String(r.collectionId) : null,
      title: entity === 'album' ? r.collectionName : r.trackName,
      artist: r.artistName,
      albumName: r.collectionName,
      year: (r.releaseDate || '').slice(0, 4),
      releaseDate: r.releaseDate || '',
      genre: r.primaryGenreName || '',
      durationMs: r.trackTimeMillis || null,
      explicit: r.trackExplicitness === 'explicit' || r.collectionExplicitness === 'explicit',
      coverUrl: r.artworkUrl100 || r.artworkUrl60,
      coverUrlHigh: upgradeArtwork(r.artworkUrl100 || r.artworkUrl60, 3000),
      appleUrl: r.trackViewUrl || r.collectionViewUrl || null,
      spotifyUri: null,
    })));
  }

  // Alle Alben eines Künstlers, neueste zuerst — der Weg von „wie hieß die Band"
  // zum konkreten Album, ohne den Albumtitel schon zu kennen.
  async function fetchITunesDiscography(artistId) {
    const url = 'https://itunes.apple.com/lookup?' + new URLSearchParams({
      id: artistId, entity: 'album', limit: '60', country: MARKET,
    });
    const json = await itunesJson(url, 'Diskografie');
    return dedupe(json.results
      .filter((r) => r.wrapperType === 'collection' && r.collectionName)
      .map((r) => ({
        source: 'itunes',
        type: 'album',
        id: 'itunes:' + r.collectionId,
        albumId: String(r.collectionId),
        title: r.collectionName,
        artist: r.artistName,
        albumName: r.collectionName,
        year: (r.releaseDate || '').slice(0, 4),
        releaseDate: r.releaseDate || '',
        genre: r.primaryGenreName || '',
        durationMs: null,
        trackCount: r.trackCount || null,
        explicit: r.collectionExplicitness === 'explicit',
        coverUrl: r.artworkUrl100 || r.artworkUrl60,
        coverUrlHigh: upgradeArtwork(r.artworkUrl100 || r.artworkUrl60, 3000),
        appleUrl: r.collectionViewUrl || null,
        spotifyUri: null,
      })))
      .sort((a, b) => String(b.releaseDate).localeCompare(String(a.releaseDate)));
  }

  // The album behind a hit: tracklist, label, exact release date, total running time.
  // Everything the tracklist-style posters print beyond what a search result carries.
  async function fetchITunesAlbum(collectionId) {
    const url = 'https://itunes.apple.com/lookup?' + new URLSearchParams({
      id: collectionId, entity: 'song', limit: '200',
    });
    const json = await itunesJson(url, 'iTunes-Album');
    const collection = json.results.find((r) => r.wrapperType === 'collection') || {};
    const tracks = json.results
      .filter((r) => r.wrapperType === 'track' && r.trackName)
      .sort((a, b) => (a.discNumber - b.discNumber) || (a.trackNumber - b.trackNumber))
      .map((t) => ({
        name: t.trackName,
        durationMs: t.trackTimeMillis || 0,
        explicit: t.trackExplicitness === 'explicit',
      }));
    return {
      tracks,
      copyright: collection.copyright || '',
      label: deriveLabel(collection.copyright || ''),
      releaseDate: collection.releaseDate || '',
      genre: collection.primaryGenreName || '',
      explicit: collection.collectionExplicitness === 'explicit',
    };
  }

  // iTunes exposes no label field, only a copyright line like
  // "℗ 2013 Daft Life Limited, under exclusive license to Columbia". The first
  // clause after the year is the closest thing to a label — and stays editable.
  function deriveLabel(copyright) {
    if (!copyright) return '';
    return copyright
      .replace(/^[℗©]\s*/, '')
      .replace(/^\d{4}\s+/, '')
      .split(/,| under | unter /i)[0]
      .trim();
  }

  // Cover-Alternativen für ein Album, absichtlich als Vorschläge zur Auswahl:
  // über Namen gematcht landet sonst still das Artwork einer anderen Ausgabe
  // (Remaster, Deluxe, Single) auf dem Poster.
  async function findCoverCandidates(artist, albumName) {
    const term = (artist + ' ' + albumName).trim();
    if (!term) return [];
    const [apple, caa] = await Promise.allSettled([
      findCoverCandidatesApple(term),
      findCoverCandidatesCAA(artist, albumName),
    ]);
    return [
      ...(apple.status === 'fulfilled' ? apple.value : []),
      ...(caa.status === 'fulfilled' ? caa.value : []),
    ];
  }

  async function findCoverCandidatesApple(term) {
    const hits = await searchITunes(term, 'album');
    return hits.filter((h) => h.coverUrl).slice(0, 6).map((h) => ({
      source: 'Apple',
      title: h.title,
      artist: h.artist,
      year: h.year,
      thumbUrl: h.coverUrl,
      sizeUrls: [upgradeArtwork(h.coverUrl, 3000)],
    }));
  }

  // Das Cover Art Archive hält die Originalscans der jeweiligen Ausgabe — oft
  // größer als Apples Master, und mit `Access-Control-Allow-Origin: *`, also
  // ohne getaintete Canvas beim Export.
  async function findCoverCandidatesCAA(artist, albumName) {
    const clean = (s) => String(s || '').replace(/["\\]/g, ' ').trim();
    const query = 'release:"' + clean(albumName) + '" AND artist:"' + clean(artist) + '"';
    const resp = await request('https://musicbrainz.org/ws/2/release/?' + new URLSearchParams({
      query, fmt: 'json', limit: '8',
    }));
    if (!resp.ok) return [];
    const json = await resp.json();
    return (json.releases || []).map((rel) => ({
      source: 'Cover Art Archive',
      title: rel.title,
      artist: ((rel['artist-credit'] || [])[0] || {}).name || artist,
      year: (rel.date || '').slice(0, 4),
      detail: [rel.country, (rel.media || [])[0] && rel.media[0].format].filter(Boolean).join(' · '),
      thumbUrl: 'https://coverartarchive.org/release/' + rel.id + '/front-250',
      // `front` ist der unskalierte Originalscan; 1200 fängt die Fälle ab, in
      // denen das Original zu groß oder nicht hinterlegt ist.
      sizeUrls: [
        'https://coverartarchive.org/release/' + rel.id + '/front',
        'https://coverartarchive.org/release/' + rel.id + '/front-1200',
      ],
    }));
  }

  // Notnagel, wenn die eigentliche Quelle kein brauchbares Cover hat: liefert
  // Kandidaten-URLs, ohne sie zu prüfen. Vorher lud diese Funktion jedes Bild
  // per fetch nur zum Dasein-Test und las den Body nie aus — in WebKit hält
  // eine solche Antwort die Verbindung offen und lässt die nächste Anfrage an
  // denselben Host mit „Load failed" auflaufen. Ob es das Bild gibt, entscheidet
  // jetzt der Ladeversuch des Aufrufers.
  async function findCoverViaMusicBrainz(artist, title) {
    try {
      const q = new URLSearchParams({
        query: 'release:"' + title + '" AND artist:"' + artist + '"',
        fmt: 'json',
        limit: '3',
      });
      const resp = await request('https://musicbrainz.org/ws/2/release/?' + q);
      if (!resp.ok) return [];
      const json = await resp.json();
      return (json.releases || []).map((rel) => 'https://coverartarchive.org/release/' + rel.id + '/front-500');
    } catch (e) {
      return []; // offline oder blockiert — der Aufrufer weicht weiter aus
    }
  }

  const Spotify = {
    STORAGE_KEY: 'posterapp.spotify.creds',
    _token: null,
    _tokenExp: 0,

    getCreds() {
      try { return JSON.parse(localStorage.getItem(this.STORAGE_KEY) || 'null'); }
      catch (e) { return null; }
    },
    setCreds(id, secret) {
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify({ id, secret }));
      this._token = null;
    },
    clearCreds() {
      localStorage.removeItem(this.STORAGE_KEY);
      this._token = null;
    },
    isConfigured() {
      const c = this.getCreds();
      return !!(c && c.id && c.secret);
    },

    async getToken() {
      const creds = this.getCreds();
      if (!creds || !creds.id || !creds.secret) return null;
      if (this._token && this._tokenExp > Date.now()) return this._token;
      const resp = await request('https://accounts.spotify.com/api/token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          Authorization: 'Basic ' + btoa(creds.id + ':' + creds.secret),
        },
        body: new URLSearchParams({ grant_type: 'client_credentials' }),
      });
      if (!resp.ok) throw new Error('Spotify-Anmeldung fehlgeschlagen (' + resp.status + ')');
      const json = await resp.json();
      this._token = json.access_token;
      this._tokenExp = Date.now() + (json.expires_in - 30) * 1000;
      return this._token;
    },

    async search(term, entity) {
      const token = await this.getToken();
      if (!token) return null;
      const type = entity === 'album' ? 'album' : entity === 'artist' ? 'artist' : 'track';
      const url = 'https://api.spotify.com/v1/search?' + new URLSearchParams({
        q: term, type, limit: LIMIT, market: MARKET,
      });
      const resp = await request(url, { headers: { Authorization: 'Bearer ' + token } });
      if (!resp.ok) throw new Error('Spotify-Suche fehlgeschlagen (' + resp.status + ')');
      const json = await resp.json();

      if (type === 'artist') {
        // Anders als iTunes liefert Spotify Künstlerfotos mit.
        return (json.artists.items || []).map((a) => ({
          source: 'spotify',
          type: 'artist',
          id: 'spotify:artist:' + a.id,
          artistId: a.id,
          title: a.name,
          artist: a.name,
          genre: (a.genres || [])[0] || '',
          coverUrl: (a.images || [])[(a.images || []).length - 1] && a.images[a.images.length - 1].url,
          coverUrlHigh: (a.images || [])[0] && a.images[0].url,
        }));
      }

      const items = type === 'album' ? json.albums.items : json.tracks.items;
      return dedupe(items.map((it) => {
        const albumImages = (it.album && it.album.images) || it.images || [];
        const releaseDate = (entity === 'album' ? it.release_date : it.album && it.album.release_date) || '';
        return {
          source: 'spotify',
          type: entity === 'album' ? 'album' : 'track',
          id: 'spotify:' + it.id,
          albumId: entity === 'album' ? it.id : (it.album && it.album.id) || null,
          title: it.name,
          artist: (it.artists || []).map((a) => a.name).join(', '),
          albumName: entity === 'album' ? it.name : (it.album && it.album.name) || '',
          year: releaseDate.slice(0, 4),
          releaseDate,
          genre: '',
          durationMs: it.duration_ms || null,
          explicit: !!it.explicit,
          coverUrl: albumImages[0] && albumImages[0].url,
          coverUrlHigh: albumImages[0] && albumImages[0].url,
          appleUrl: null,
          spotifyUri: it.uri,
        };
      }));
    },

    // Diskografie eines Künstlers, neueste zuerst.
    async getArtistAlbums(artistId) {
      const token = await this.getToken();
      if (!token) return null;
      const url = 'https://api.spotify.com/v1/artists/' + artistId + '/albums?' + new URLSearchParams({
        include_groups: 'album,compilation', limit: '50', market: MARKET,
      });
      const resp = await request(url, { headers: { Authorization: 'Bearer ' + token } });
      if (!resp.ok) throw new Error('Diskografie konnte nicht geladen werden (' + resp.status + ')');
      const json = await resp.json();
      return dedupe((json.items || []).map((a) => ({
        source: 'spotify',
        type: 'album',
        id: 'spotify:' + a.id,
        albumId: a.id,
        title: a.name,
        artist: (a.artists || []).map((x) => x.name).join(', '),
        albumName: a.name,
        year: (a.release_date || '').slice(0, 4),
        releaseDate: a.release_date || '',
        genre: '',
        durationMs: null,
        trackCount: a.total_tracks || null,
        explicit: false,
        coverUrl: (a.images || [])[(a.images || []).length - 1] && a.images[a.images.length - 1].url,
        coverUrlHigh: (a.images || [])[0] && a.images[0].url,
        appleUrl: null,
        spotifyUri: a.uri,
      }))).sort((x, y) => String(y.releaseDate).localeCompare(String(x.releaseDate)));
    },

    // The full album object — unlike search results it carries label, copyrights
    // and the tracklist (paged at 50, so long albums need the follow-up requests).
    async getAlbum(albumId) {
      const token = await this.getToken();
      if (!token) return null;
      const headers = { Authorization: 'Bearer ' + token };
      const resp = await request('https://api.spotify.com/v1/albums/' + albumId, { headers });
      if (!resp.ok) throw new Error('Spotify-Album konnte nicht geladen werden (' + resp.status + ')');
      const album = await resp.json();

      let items = (album.tracks && album.tracks.items) || [];
      let next = album.tracks && album.tracks.next;
      while (next && items.length < 200) {
        const page = await request(next, { headers });
        if (!page.ok) break;
        const json = await page.json();
        items = items.concat(json.items || []);
        next = json.next;
      }

      return {
        tracks: items.map((t) => ({
          name: t.name,
          durationMs: t.duration_ms || 0,
          explicit: !!t.explicit,
        })),
        copyright: ((album.copyrights || [])[0] || {}).text || '',
        label: album.label || '',
        releaseDate: album.release_date || '',
        genre: (album.genres || [])[0] || '',
        explicit: items.some((t) => t.explicit),
      };
    },

    // Silent background lookup: find a Spotify URI for a track/album found via iTunes.
    async resolveUri(artist, title, type) {
      try {
        const results = await this.search(artist + ' ' + title, type);
        if (results && results.length) return results[0].spotifyUri;
      } catch (e) { /* best effort, no UI feedback needed */ }
      return null;
    },

    // Public, unauthenticated endpoint that renders the real scannable Spotify code.
    scannableUrl(uri, opts) {
      opts = opts || {};
      const bg = (opts.bg || '000000').replace('#', '');
      const codeColor = opts.codeColor === 'black' ? 'black' : 'white';
      const size = opts.size || 640;
      return 'https://scannables.spotify.com/uri/plain/png/' + bg + '/' + codeColor + '/' + size + '/' + encodeURIComponent(uri);
    },
  };

  // Primary combined search: Spotify first when configured (real catalogue + real codes),
  // otherwise the login-free iTunes Search API.
  async function search(term, entity) {
    if (Spotify.isConfigured()) {
      try {
        const results = await Spotify.search(term, entity);
        if (results && results.length) return { results, source: 'spotify' };
      } catch (e) {
        console.warn('Spotify-Suche fehlgeschlagen, weiche auf iTunes aus:', e);
      }
    }
    const results = await searchITunes(term, entity);
    return { results, source: 'itunes' };
  }

  // Tracklist + album metadata for a hit, from whichever source can answer:
  // its own first, then the other one matched by artist + album name.
  async function fetchAlbumDetails(result) {
    if (result.source === 'spotify' && result.albumId && Spotify.isConfigured()) {
      try {
        const details = await Spotify.getAlbum(result.albumId);
        if (details) return details;
      } catch (e) {
        console.warn('Spotify-Albumdetails fehlgeschlagen, weiche auf iTunes aus:', e);
      }
    }
    if (result.source === 'itunes' && result.albumId) {
      return fetchITunesAlbum(result.albumId);
    }
    const albumName = result.albumName || result.title;
    if (!albumName) return null;
    const hits = await searchITunes(result.artist + ' ' + albumName, 'album');
    const match = hits.find((h) => h.albumId);
    return match ? fetchITunesAlbum(match.albumId) : null;
  }

  // Diskografie über die Quelle, aus der der Künstlertreffer stammt.
  async function fetchDiscography(artistResult) {
    if (artistResult.source === 'spotify' && Spotify.isConfigured()) {
      const albums = await Spotify.getArtistAlbums(artistResult.artistId);
      if (albums && albums.length) return albums;
    }
    if (artistResult.source === 'itunes') return fetchITunesDiscography(artistResult.artistId);
    const hits = await searchITunes(artistResult.artist, 'artist');
    return hits.length ? fetchITunesDiscography(hits[0].artistId) : [];
  }

  return {
    search, searchITunes, fetchAlbumDetails, fetchDiscography, findCoverCandidates,
    findCoverViaMusicBrainz, Spotify, upgradeArtwork,
    // request wird von tmdb.js mitgenutzt: der Wiederholversuch gegen
    // abgebrochene Verbindungen soll für alle Quellen gelten.
    request,
  };
})();
