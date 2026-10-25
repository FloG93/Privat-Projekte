window.Poster = window.Poster || {};
Poster.styles = Poster.styles || {};

// Liner Notes: Cover oben, darunter die Tracklist links und rechts der
// Angabenblock wie auf einer Plattenhülle — Titel, Palette, Datum, Label.
Poster.styles.linernotes = {
  id: 'linernotes',
  label: 'Liner Notes',
  needsTracks: true,

  draw(ctx, W, H, model) {
    const U = Poster.util;
    const P = Poster.parts;

    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, W, H);

    const pad = W * 0.075;
    const contentW = W - pad * 2;
    ctx.textBaseline = 'alphabetic';

    U.drawCover(ctx, model.coverImg, pad, pad, contentW, contentW);
    if (model.showExplicit) {
      const bw = contentW * 0.12;
      P.explicitBadge(ctx, pad + contentW - bw - contentW * 0.03, pad + contentW - bw * 0.62 - contentW * 0.03, bw);
    }

    let y = pad + contentW + H * 0.045;
    ctx.fillStyle = '#111114';
    ctx.fillRect(pad, y, contentW, Math.max(1, W * 0.0016));

    y += H * 0.032;
    const colGap = contentW * 0.05;
    const listW = contentW * 0.63;
    const infoW = contentW - listW - colGap;

    P.tracklist(ctx, model.tracks, pad, y, listW, H - y - pad, {
      maxFont: W * 0.021,
      color: '#22242a',
      columns: (model.tracks || []).length > 9 ? 2 : 1,
      gap: listW * 0.06,
    });

    // Angabenblock rechts
    let iy = y + W * 0.018;
    ctx.textAlign = 'right';
    const titleSize = U.fitText(ctx, model.title, infoW, W * 0.028, '"Hanken Grotesk"', '700', W * 0.016);
    ctx.fillStyle = '#111114';
    ctx.fillText(P.truncate(ctx, model.title, infoW), W - pad, iy);
    iy += titleSize * 1.3;
    ctx.font = '400 ' + W * 0.022 + 'px "Hanken Grotesk"';
    ctx.fillStyle = '#3a3d43';
    ctx.fillText(P.truncate(ctx, model.artist, infoW), W - pad, iy);
    ctx.textAlign = 'left';

    iy += H * 0.018;
    const swatchH = W * 0.024;
    P.paletteStrip(ctx, model.palette, W - pad - infoW, iy, infoW, swatchH, 5);
    iy += swatchH + H * 0.028;

    const metaSize = W * 0.015;
    const dateLine = [model.releaseDate || model.year, model.totalLength].filter(Boolean).join('  ·  ');
    iy += P.meta(ctx, 'Erschienen', dateLine, W - pad, iy, metaSize, { align: 'right' });
    if (model.label) {
      iy += P.meta(ctx, 'Label', model.label, W - pad, iy, metaSize, { align: 'right' });
    }

    if (model.drawCode) {
      const codeH = H * 0.05;
      model.drawCode(ctx, W - pad - infoW, Math.max(iy, H - pad - codeH), infoW, codeH, 'right');
    }
  },
};
