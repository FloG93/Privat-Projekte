window.Poster = window.Poster || {};
Poster.styles = Poster.styles || {};

// Minimal: flächige Farbe aus dem Motiv, das Plakat als eingesetztes Bild mit
// viel Rand, Titel und Regie groß darunter — der Ton der „Alternative Movie
// Poster" statt der Kinoplakat-Fülle.
Poster.styles.filmminimal = {
  id: 'filmminimal',
  label: 'Minimal',
  kinds: ['film'],

  draw(ctx, W, H, model) {
    const U = Poster.util;
    const P = Poster.parts;

    const { r, g, b } = U.hexToRgb(model.accent);
    const { h: hue, s: sat } = U.rgbToHsl(r, g, b);
    const bg = hslToHex(hue, Math.min(0.5, sat * 0.8), 0.11);
    const ink = '#f4f2ee';

    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, W, H);

    const pad = W * 0.1;
    const contentW = W - pad * 2;
    ctx.textBaseline = 'alphabetic';

    // Das Motiv behält sein 2:3-Verhältnis, statt auf Plakatmaß beschnitten zu
    // werden — genau das macht die Ruhe dieses Layouts.
    const artW = contentW;
    const artH = Math.min(artW * 1.5, H * 0.6);
    P.shadowed(ctx, () => {
      ctx.fillStyle = '#000';
      ctx.fillRect(pad, pad, artW, artH);
    }, { blur: W * 0.06, offsetY: W * 0.016, color: 'rgba(0,0,0,0.5)' });
    U.drawCover(ctx, model.coverImg, pad, pad, artW, artH);

    let y = pad + artH + H * 0.055;

    const caps = (model.title || '').toUpperCase();
    const size = U.fitText(ctx, caps, contentW, W * 0.105, '"Anton"', '400', W * 0.042);
    const lines = U.wrapLines(ctx, caps, contentW).slice(0, 2);
    ctx.fillStyle = ink;
    lines.forEach((line) => {
      ctx.fillText(line, pad, y);
      y += size * 0.94;
    });

    if (model.director) {
      y += H * 0.004;
      ctx.font = '600 ' + W * 0.032 + 'px "Saira Extra Condensed"';
      ctx.fillStyle = model.accent;
      ctx.fillText(('ein Film von ' + model.director).toUpperCase(), pad, y);
      y += H * 0.028;
    }

    // Datenzeile: nur was da ist, durch Mittelpunkte getrennt.
    const facts = [model.year, model.runtimeText, model.genresText, model.certification ? 'FSK ' + model.certification : '']
      .filter(Boolean).join('   ·   ');
    if (facts) {
      ctx.font = '400 ' + W * 0.024 + 'px "Saira Extra Condensed"';
      ctx.fillStyle = 'rgba(244,242,238,0.7)';
      ctx.fillText(P.truncate(ctx, facts.toUpperCase(), contentW), pad, y);
    }

    // Fußzeile: Palette links, Code rechts.
    const footY = H - pad;
    const swatch = W * 0.032;
    P.paletteStrip(ctx, model.palette, pad, footY - swatch, swatch * 5, swatch, 5);
    if (model.drawCode) {
      const codeW = W * 0.1;
      model.drawCode(ctx, W - pad - codeW, footY - codeW, codeW, codeW, 'right');
    }

    function hslToHex(hh, s, l) {
      const k = (n) => (n + hh * 12) % 12;
      const a = s * Math.min(l, 1 - l);
      const f = (n) => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
      return U.rgbToHex(f(0) * 255, f(8) * 255, f(4) * 255);
    }
  },
};
