window.Poster = window.Poster || {};

// Filmdaten von TMDB. Apple hat seine Filmsuche dichtgemacht (media=movie
// antwortet mit 403), und eine schlüsselfreie Quelle für Plakate gibt es nicht —
// Filmplakate sind geschützt und liegen in keiner freien Bilddatenbank.
//
// TMDB passt technisch: API und Bild-CDN senden beide
// `Access-Control-Allow-Origin: *`, und /t/p/original liefert 2000 × 3000 px.
// Es braucht einen kostenlosen Schlüssel, der wie die Spotify-Daten nur im
// Browser des Nutzers liegt.
Poster.tmdb = (function () {
  const API = 'https://api.themoviedb.org/3';
  // Stabiler Pfad des Bild-CDN. /configuration nennt ihn zur Laufzeit, spart
  // aber nur eine Anfrage ein und ändert sich seit Jahren nicht.
  const IMG = 'https://image.tmdb.org/t/p/';
  const LANG = 'de-DE';
  const STORAGE_KEY = 'posterapp.tmdb.key';

  function getKey() {
    try { return localStorage.getItem(STORAGE_KEY) || ''; }
    catch (e) { return ''; }
  }
  function setKey(key) {
    localStorage.setItem(STORAGE_KEY, key.trim());
  }
  function clearKey() {
    localStorage.removeItem(STORAGE_KEY);
  }
  function isConfigured() {
    return !!getKey();
  }

  function url(path, params) {
    const q = new URLSearchParams(Object.assign({ api_key: getKey(), language: LANG }, params || {}));
    return API + path + '?' + q;
  }

  async function get(path, params, what) {
    if (!isConfigured()) throw new Error('Kein TMDB-Schlüssel hinterlegt');
    const resp = await Poster.api.request(url(path, params));
    if (resp.status === 401) throw new Error('TMDB-Schlüssel wurde abgelehnt');
    if (!resp.ok) throw new Error((what || 'TMDB-Abfrage') + ' fehlgeschlagen (' + resp.status + ')');
    return resp.json();
  }

  function poster(path, size) {
    return path ? IMG + (size || 'original') + path : null;
  }

  async function search(term) {
    const json = await get('/search/movie', { query: term, include_adult: 'false' }, 'Filmsuche');
    return (json.results || []).map((m) => ({
      source: 'tmdb',
      type: 'movie',
      kind: 'film',
      id: 'tmdb:' + m.id,
      movieId: m.id,
      title: m.title || m.original_title,
      originalTitle: m.original_title,
      artist: '', // Regie steht erst in den Details
      year: (m.release_date || '').slice(0, 4),
      releaseDate: m.release_date || '',
      overview: m.overview || '',
      voteAverage: m.vote_average || 0,
      coverUrl: poster(m.poster_path, 'w154'),
      coverUrlHigh: poster(m.poster_path, 'original'),
    }));
  }

  // Ein Aufruf holt alles: Stab, Freigaben und Bilder hängen per
  // append_to_response an den Filmdetails.
  async function details(movieId) {
    const m = await get('/movie/' + movieId, {
      append_to_response: 'credits,release_dates,images',
      include_image_language: 'de,en,null',
    }, 'Filmdetails');

    const crew = (m.credits && m.credits.crew) || [];
    const cast = (m.credits && m.credits.cast) || [];
    const byJob = (...jobs) => crew
      .filter((c) => jobs.indexOf(c.job) !== -1)
      .map((c) => c.name)
      .filter((n, i, a) => a.indexOf(n) === i);

    return {
      title: m.title || m.original_title,
      originalTitle: m.original_title,
      tagline: m.tagline || '',
      overview: m.overview || '',
      releaseDate: m.release_date || '',
      runtime: m.runtime || 0,
      genres: (m.genres || []).map((g) => g.name),
      studios: (m.production_companies || []).map((c) => c.name),
      voteAverage: m.vote_average || 0,
      posterUrl: poster(m.poster_path, 'original'),
      backdropUrl: poster(m.backdrop_path, 'original'),
      // Der Original-Titelschriftzug, transparent — nicht zu jedem Film erfasst.
      titleLogoUrl: pickLogo(m.images && m.images.logos),
      cast: cast.slice(0, 12).map((c) => c.name),
      directors: byJob('Director'),
      writers: byJob('Screenplay', 'Writer', 'Story', 'Novel'),
      producers: byJob('Producer'),
      music: byJob('Original Music Composer', 'Music'),
      camera: byJob('Director of Photography'),
      editors: byJob('Editor'),
      certification: pickCertification(m.release_dates),
    };
  }

  function pickLogo(logos) {
    if (!logos || !logos.length) return null;
    const order = ['de', 'en', null];
    for (const lang of order) {
      const hit = logos
        .filter((l) => l.iso_639_1 === lang && /\.png$/i.test(l.file_path || ''))
        .sort((a, b) => (b.vote_average || 0) - (a.vote_average || 0))[0];
      if (hit) return poster(hit.file_path, 'original');
    }
    return null;
  }

  // FSK zuerst, sonst die erste Freigabe, die überhaupt eine Angabe hat.
  function pickCertification(releaseDates) {
    const results = (releaseDates && releaseDates.results) || [];
    const pick = (country) => {
      const entry = results.find((r) => r.iso_3166_1 === country);
      if (!entry) return '';
      const withCert = (entry.release_dates || []).find((d) => d.certification);
      return withCert ? withCert.certification : '';
    };
    return pick('DE') || pick('AT') || pick('US') || '';
  }

  return { search, details, getKey, setKey, clearKey, isConfigured, poster, IMG };
})();
