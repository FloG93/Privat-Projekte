window.Poster = window.Poster || {};
Poster.styles = Poster.styles || {};

// Vinyl-Hülle: getönter Passepartout-Grund, Name und Titel oben gesetzt, das Cover
// als Hülle, aus der die Platte seitlich herausragt.
Poster.styles.vinylsleeve = {
  id: 'vinylsleeve',
  label: 'Vinyl-Hülle',

  draw(ctx, W, H, model) {
    const U = Poster.util;
    const P = Poster.parts;

    const { r, g, b } = U.hexToRgb(model.accent);
    const { h: hue } = U.rgbToHsl(r, g, b);
    const bg = hslToHex(hue, 0.22, 0.93);
    const ink = '#1d1b20';

    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, W, H);

    const pad = W * 0.08;
    const contentW = W - pad * 2;
    ctx.textBaseline = 'alphabetic';
    ctx.textAlign = 'center';

    let y = pad + H * 0.055;
    ctx.fillStyle = ink;
    const nameSize = U.fitText(ctx, model.artist, contentW, W * 0.1, '"Hanken Grotesk"', '700', W * 0.045);
    ctx.fillText(P.truncate(ctx, model.artist, contentW), W / 2, y);

    y += nameSize * 0.5 + H * 0.035;
    const titleSize = U.fitText(ctx, model.title, contentW * 0.9, W * 0.045, '"Hanken Grotesk"', '400', W * 0.024);
    ctx.fillText(P.truncate(ctx, model.title, contentW * 0.9), W / 2, y);

    y += H * 0.026;
    ctx.font = '400 ' + W * 0.019 + 'px "Hanken Grotesk"';
    ctx.fillStyle = 'rgba(29,27,32,0.65)';
    ctx.fillText(model.releaseDate || model.year || '', W / 2, y);
    ctx.textAlign = 'left';

    // Hülle plus herausragende Platte müssen zusammen in die Breite passen —
    // daraus ergibt sich die Hüllengröße, nicht umgekehrt.
    const sleeveX = pad;
    const sleeve = (W - pad - sleeveX) / 1.53;
    const discR = sleeve * 0.46;
    const bandTop = y + H * 0.03;
    const bandBottom = H - pad - H * 0.085;
    const sleeveY = bandTop + Math.max(0, (bandBottom - bandTop - sleeve) / 2);

    // Platte zuerst, damit die Hülle darüber liegt.
    P.vinylDisc(ctx, sleeveX + sleeve + discR * 0.15, sleeveY + sleeve / 2, discR, model.accent);

    P.shadowed(ctx, () => {
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(sleeveX, sleeveY, sleeve, sleeve);
    }, { blur: W * 0.045, offsetY: W * 0.012, color: 'rgba(0,0,0,0.28)' });
    U.drawCover(ctx, model.coverImg, sleeveX, sleeveY, sleeve, sleeve);
    if (model.showExplicit) {
      const bw = sleeve * 0.15;
      P.explicitBadge(ctx, sleeveX + sleeve - bw - sleeve * 0.03, sleeveY + sleeve - bw * 0.62 - sleeve * 0.03, bw);
    }

    // Fußzeile: Label links, Länge rechts, Code mittig.
    const footY = H - pad;
    ctx.font = '400 ' + W * 0.018 + 'px "Hanken Grotesk"';
    ctx.fillStyle = 'rgba(29,27,32,0.7)';
    if (model.label) ctx.fillText(P.truncate(ctx, model.label, contentW * 0.4), pad, footY);
    ctx.textAlign = 'right';
    if (model.totalLength || model.duration) ctx.fillText(model.totalLength || model.duration, W - pad, footY);
    ctx.textAlign = 'left';

    if (model.drawCode) {
      const codeW = contentW * 0.3;
      model.drawCode(ctx, W / 2 - codeW / 2, footY - H * 0.095, codeW, H * 0.06, 'center');
    }

    function hslToHex(hh, s, l) {
      const k = (n) => (n + hh * 12) % 12;
      const a = s * Math.min(l, 1 - l);
      const f = (n) => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
      return U.rgbToHex(f(0) * 255, f(8) * 255, f(4) * 255);
    }
  },
};
