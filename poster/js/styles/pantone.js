window.Poster = window.Poster || {};
Poster.styles = Poster.styles || {};

// Pantone-Karte: Cover wie ein aufgeklebtes Foto, daneben ein Namenskärtchen und
// die Farbfelder als Musterfächer, unten Titel und Tracklist.
Poster.styles.pantone = {
  id: 'pantone',
  label: 'Pantone-Karte',
  needsTracks: true,

  draw(ctx, W, H, model) {
    const U = Poster.util;
    const P = Poster.parts;

    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, W, H);

    const pad = W * 0.085;
    const contentW = W - pad * 2;
    const gutter = contentW * 0.035;
    const imgW = contentW * 0.7;
    const imgH = imgW * 0.95;
    const colX = pad + imgW + gutter;
    const colW = contentW - imgW - gutter;

    U.drawCover(ctx, model.coverImg, pad, pad, imgW, imgH);

    // Namenskärtchen
    const cardH = imgH * 0.42;
    ctx.fillStyle = '#efefef';
    ctx.fillRect(colX, pad, colW, cardH);
    ctx.textBaseline = 'alphabetic';
    ctx.fillStyle = '#111114';
    const nameSize = W * 0.026;
    ctx.font = '700 ' + nameSize + 'px "Hanken Grotesk"';
    U.wrapLines(ctx, model.artist.toUpperCase(), colW * 0.82).slice(0, 2).forEach((line, i) => {
      ctx.fillText(line, colX + colW * 0.09, pad + cardH * 0.22 + i * nameSize * 1.15);
    });
    ctx.fillStyle = '#111114';
    ctx.fillRect(colX + colW * 0.09, pad + cardH * 0.58, colW * 0.82, cardH * 0.09);
    ctx.font = '700 ' + W * 0.019 + 'px "Hanken Grotesk"';
    U.wrapLines(ctx, (model.albumName || model.title).toUpperCase(), colW * 0.82).slice(0, 2).forEach((line, i) => {
      ctx.fillText(line, colX + colW * 0.09, pad + cardH * 0.82 + i * W * 0.023);
    });

    // Farbfächer
    const fanY = pad + cardH + imgH * 0.06;
    P.paletteColumn(ctx, model.palette, colX, fanY, colW, pad + imgH - fanY, 4);

    // Titelblock
    let y = pad + imgH + H * 0.075;
    ctx.fillStyle = '#111114';
    const titleSize = U.fitText(ctx, model.title.toUpperCase(), contentW, W * 0.078, '"Hanken Grotesk"', '700', W * 0.034);
    ctx.fillText(P.truncate(ctx, model.title.toUpperCase(), contentW), pad, y);

    y += titleSize * 0.72;
    ctx.font = '400 ' + W * 0.04 + 'px "Hanken Grotesk"';
    ctx.fillStyle = '#3a3d43';
    ctx.fillText(P.truncate(ctx, model.artist.toUpperCase(), contentW), pad, y);

    y += H * 0.028;
    ctx.fillStyle = '#111114';
    ctx.fillRect(pad, y, contentW, Math.max(1, W * 0.002));

    const footerY = H - pad - H * 0.01;
    y += H * 0.035;
    P.tracklist(ctx, model.tracks, pad + contentW * 0.05, y, contentW * 0.9, footerY - y - H * 0.05, {
      maxFont: W * 0.026,
      color: '#22242a',
    });

    ctx.textAlign = 'right';
    ctx.font = '700 ' + W * 0.02 + 'px "Hanken Grotesk"';
    ctx.fillStyle = '#111114';
    ctx.fillText('RELEASE | ' + (model.year || '—'), W - pad, footerY);
    ctx.textAlign = 'left';

    if (model.drawCode) {
      model.drawCode(ctx, pad, footerY - H * 0.05, contentW * 0.3, H * 0.06);
    }
  },
};
