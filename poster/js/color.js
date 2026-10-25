window.Poster = window.Poster || {};

// Extracts a small dominant-color palette from a cover image via canvas pixel sampling —
// no external service, works fully offline once the image is loaded.
Poster.color = (function () {
  function extractPalette(img, count) {
    count = count || 6;
    const fallback = { accent: '#1db954', palette: ['#1db954', '#191414', '#f2f2f2'] };

    const w = 48;
    const h = Math.max(1, Math.round((48 * img.height) / img.width));
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    const ctx = c.getContext('2d', { willReadFrequently: true });
    ctx.drawImage(img, 0, 0, w, h);

    let data;
    try {
      data = ctx.getImageData(0, 0, w, h).data;
    } catch (e) {
      return fallback; // tainted canvas (cross-origin image without CORS headers)
    }

    const BUCKET = 24;
    const buckets = new Map();
    for (let i = 0; i < data.length; i += 4) {
      if (data[i + 3] < 200) continue;
      const r = data[i], g = data[i + 1], b = data[i + 2];
      const key = Math.round(r / BUCKET) + ',' + Math.round(g / BUCKET) + ',' + Math.round(b / BUCKET);
      const entry = buckets.get(key) || { r: 0, g: 0, b: 0, n: 0 };
      entry.r += r; entry.g += g; entry.b += b; entry.n += 1;
      buckets.set(key, entry);
    }
    if (buckets.size === 0) return fallback;

    const swatches = [...buckets.values()]
      .map((e) => {
        const r = e.r / e.n, g = e.g / e.n, b = e.b / e.n;
        const { s, l } = Poster.util.rgbToHsl(r, g, b);
        // Favor frequent, saturated, mid-lightness colors over dominant near-white/black backgrounds.
        const weight = e.n * (0.3 + s * 1.3) * (1 - Math.abs(l - 0.5) * 0.7);
        return { r, g, b, s, l, n: e.n, weight };
      })
      .sort((a, b) => b.weight - a.weight);

    const picked = [];
    for (const sw of swatches) {
      if (picked.length >= count) break;
      const tooClose = picked.some((p) => Math.hypot(p.r - sw.r, p.g - sw.g, p.b - sw.b) < 36);
      if (!tooClose) picked.push(sw);
    }
    if (picked.length === 0) picked.push(swatches[0]);

    const palette = picked.map((p) => Poster.util.rgbToHex(p.r, p.g, p.b));
    const accentCandidate = picked.find((p) => p.s > 0.22 && p.l > 0.15 && p.l < 0.88) || picked[0];
    const accent = Poster.util.rgbToHex(accentCandidate.r, accentCandidate.g, accentCandidate.b);
    return { accent, palette };
  }

  return { extractPalette };
})();
