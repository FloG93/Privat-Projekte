window.Poster = window.Poster || {};

Poster.util = (function () {
  function clamp(v, min, max) {
    return Math.max(min, Math.min(max, v));
  }

  function formatDuration(ms) {
    if (ms === null || ms === undefined || isNaN(ms)) return '';
    const totalSec = Math.round(ms / 1000);
    const m = Math.floor(totalSec / 60);
    const s = totalSec % 60;
    return m + ':' + String(s).padStart(2, '0');
  }

  // Nimmt "2024", "2024-06" und "2024-06-14T00:00:00Z" — Spotify liefert je nach
  // Genauigkeit alle drei Formen, iTunes den vollen Zeitstempel.
  function formatDateDE(raw) {
    const m = String(raw || '').match(/^(\d{4})(?:-(\d{2}))?(?:-(\d{2}))?/);
    if (!m) return '';
    const months = ['Januar', 'Februar', 'März', 'April', 'Mai', 'Juni',
      'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'];
    const [, year, month, day] = m;
    if (!month) return year;
    if (!day) return months[+month - 1] + ' ' + year;
    return +day + '. ' + months[+month - 1] + ' ' + year;
  }

  function hexToRgb(hex) {
    hex = String(hex).replace('#', '');
    if (hex.length === 3) hex = hex.split('').map((c) => c + c).join('');
    const num = parseInt(hex, 16) || 0;
    return { r: (num >> 16) & 255, g: (num >> 8) & 255, b: num & 255 };
  }

  function rgbToHex(r, g, b) {
    return '#' + [r, g, b].map((v) => clamp(Math.round(v), 0, 255).toString(16).padStart(2, '0')).join('');
  }

  function rgbToHsl(r, g, b) {
    r /= 255; g /= 255; b /= 255;
    const max = Math.max(r, g, b), min = Math.min(r, g, b);
    let h = 0, s = 0;
    const l = (max + min) / 2;
    if (max !== min) {
      const d = max - min;
      s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
      switch (max) {
        case r: h = (g - b) / d + (g < b ? 6 : 0); break;
        case g: h = (b - r) / d + 2; break;
        case b: h = (r - g) / d + 4; break;
      }
      h /= 6;
    }
    return { h, s, l };
  }

  function relativeLuminance(r, g, b) {
    const a = [r, g, b].map((v) => {
      v /= 255;
      return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
    });
    return 0.2126 * a[0] + 0.7152 * a[1] + 0.0722 * a[2];
  }

  // Dark or light text/UI color that reads well against `hex`.
  function contrastColor(hex, dark, light) {
    const { r, g, b } = hexToRgb(hex);
    return relativeLuminance(r, g, b) > 0.5 ? (dark || '#101114') : (light || '#f7f7f5');
  }

  function loadImage(src, crossOrigin) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      if (crossOrigin) img.crossOrigin = crossOrigin;
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error('Bild konnte nicht geladen werden: ' + src));
      img.src = src;
    });
  }

  // Draws `img` into the rect like CSS background-size:cover.
  function drawCover(ctx, img, x, y, w, h) {
    const ir = img.width / img.height, r = w / h;
    let sx = 0, sy = 0, sw = img.width, sh = img.height;
    if (ir > r) { sw = img.height * r; sx = (img.width - sw) / 2; }
    else { sh = img.width / r; sy = (img.height - sh) / 2; }
    ctx.drawImage(img, sx, sy, sw, sh, x, y, w, h);
  }

  function roundRect(ctx, x, y, w, h, r) {
    if (typeof r === 'number') r = { tl: r, tr: r, br: r, bl: r };
    ctx.beginPath();
    ctx.moveTo(x + r.tl, y);
    ctx.lineTo(x + w - r.tr, y);
    ctx.arcTo(x + w, y, x + w, y + r.tr, r.tr);
    ctx.lineTo(x + w, y + h - r.br);
    ctx.arcTo(x + w, y + h, x + w - r.br, y + h, r.br);
    ctx.lineTo(x + r.bl, y + h);
    ctx.arcTo(x, y + h, x, y + h - r.bl, r.bl);
    ctx.lineTo(x, y + r.tl);
    ctx.arcTo(x, y, x + r.tl, y, r.tl);
    ctx.closePath();
  }

  // Shrinks the font size until `text` fits `maxWidth`, sets ctx.font as a side effect.
  function fitText(ctx, text, maxWidth, startSize, family, weight, minSize) {
    minSize = minSize || 10;
    let size = startSize;
    while (size > minSize) {
      ctx.font = weight + ' ' + size + 'px ' + family;
      if (ctx.measureText(text).width <= maxWidth) break;
      size -= Math.max(1, size * 0.02);
    }
    ctx.font = weight + ' ' + size + 'px ' + family;
    return size;
  }

  function wrapLines(ctx, text, maxWidth) {
    const words = String(text).split(/\s+/).filter(Boolean);
    const lines = [];
    let line = '';
    for (const w of words) {
      const test = line ? line + ' ' + w : w;
      if (line && ctx.measureText(test).width > maxWidth) {
        lines.push(line);
        line = w;
      } else {
        line = test;
      }
    }
    if (line) lines.push(line);
    return lines;
  }

  // Deterministic PRNG so re-renders of the same poster don't jitter (mulberry32, FNV-seeded).
  function seededRandom(seedStr) {
    let h = 2166136261;
    const s = String(seedStr || 'poster');
    for (let i = 0; i < s.length; i++) {
      h ^= s.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    let a = h >>> 0;
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  return {
    clamp, formatDuration, formatDateDE, hexToRgb, rgbToHex, rgbToHsl, relativeLuminance,
    contrastColor, loadImage, drawCover, roundRect,
    fitText, wrapLines, seededRandom,
  };
})();
