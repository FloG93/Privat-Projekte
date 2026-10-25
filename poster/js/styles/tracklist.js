window.Poster = window.Poster || {};
Poster.styles = Poster.styles || {};

// Tracklist-Klassiker: Cover, Titelzeile mit Code daneben, komplette Tracklist,
// darunter Farbpalette und Eckdaten — das meistgedruckte Album-Poster-Layout.
Poster.styles.tracklist = {
  id: 'tracklist',
  label: 'Tracklist-Klassiker',
  needsTracks: true,

  draw(ctx, W, H, model) {
    const U = Poster.util;
    const P = Poster.parts;

    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, W, H);

    const pad = W * 0.075;
    const contentW = W - pad * 2;
    const coverSize = contentW;

    U.drawCover(ctx, model.coverImg, pad, pad, coverSize, coverSize);
    if (model.showExplicit) {
      const bw = coverSize * 0.15;
      P.explicitBadge(ctx, pad + coverSize - bw - coverSize * 0.03, pad + coverSize - bw * 0.62 - coverSize * 0.03, bw);
    }

    let y = pad + coverSize + H * 0.045;
    ctx.textBaseline = 'alphabetic';

    // Titel + Interpret links, Code rechts daneben.
    const textW = model.drawCode ? contentW * 0.58 : contentW;
    ctx.fillStyle = '#111114';
    const titleSize = U.fitText(ctx, model.title, textW, W * 0.052, '"Space Grotesk"', '700', W * 0.026);
    ctx.fillText(P.truncate(ctx, model.title, textW), pad, y);

    ctx.font = '400 ' + W * 0.026 + 'px "Hanken Grotesk"';
    ctx.fillStyle = '#6b6f76';
    ctx.fillText(P.truncate(ctx, model.artist, textW), pad, y + titleSize * 0.82);

    if (model.drawCode) {
      const codeW = contentW * 0.38;
      const codeH = H * 0.048;
      model.drawCode(ctx, pad + contentW - codeW, y - titleSize * 0.68, codeW, codeH, 'right');
    }

    y += titleSize * 0.82 + H * 0.028;
    ctx.fillStyle = '#dcdee2';
    ctx.fillRect(pad, y, contentW, Math.max(1, W * 0.0015));

    // Tracklist füllt den Raum bis zur Fußzeile.
    const footerY = H - pad - H * 0.045;
    y += H * 0.03;
    P.tracklist(ctx, model.tracks, pad, y, contentW, footerY - y - H * 0.02, {
      maxFont: W * 0.027,
      color: '#22242a',
    });

    // Fußzeile: Palette links, Eckdaten rechts.
    const swatch = W * 0.042;
    P.paletteStrip(ctx, model.palette, pad, footerY - swatch * 0.2, swatch * 5, swatch, 5);

    const metaSize = W * 0.016;
    ctx.textAlign = 'right';
    ctx.font = '700 ' + metaSize + 'px "Hanken Grotesk"';
    ctx.fillStyle = '#111114';
    ctx.fillText('LÄNGE', W - pad, footerY);
    ctx.font = '400 ' + metaSize + 'px "Hanken Grotesk"';
    ctx.fillStyle = '#6b6f76';
    ctx.fillText(model.totalLength || model.duration || '—', W - pad, footerY + metaSize * 1.5);

    ctx.font = '700 ' + metaSize + 'px "Hanken Grotesk"';
    ctx.fillStyle = '#111114';
    ctx.fillText('ERSCHIENEN', W - pad - W * 0.19, footerY);
    ctx.font = '400 ' + metaSize + 'px "Hanken Grotesk"';
    ctx.fillStyle = '#6b6f76';
    ctx.fillText(model.releaseDate || model.year || '—', W - pad - W * 0.19, footerY + metaSize * 1.5);
    ctx.textAlign = 'left';
  },
};
