window.Poster = window.Poster || {};
Poster.styles = Poster.styles || {};

// Swiss / Editorial: cremefarbener Grund, Farbbalken oben, riesiger Interpretenname,
// Cover im Textblock, unten Jahr und Tracklist in drei Spalten.
Poster.styles.swiss = {
  id: 'swiss',
  label: 'Swiss / Editorial',
  needsTracks: true,

  draw(ctx, W, H, model) {
    const U = Poster.util;
    const P = Poster.parts;

    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = '#f1ede6';
    ctx.fillRect(0, 0, W, H);

    const pad = W * 0.085;
    const contentW = W - pad * 2;
    ctx.textBaseline = 'alphabetic';

    // Farbbalken
    const barH = W * 0.016;
    const barW = contentW * 0.28;
    P.paletteStrip(ctx, model.palette, pad, pad, barW, barH, 3);

    ctx.fillStyle = '#111114';
    const nameSize = U.fitText(ctx, longestWord(model.artist), contentW * 0.72, W * 0.115, '"Hanken Grotesk"', '700', W * 0.05);
    const nameLines = U.wrapLines(ctx, model.artist, contentW * 0.72).slice(0, 2);
    let y = pad + barH + H * 0.035 + nameSize * 0.75;
    let lastLineW = 0;
    nameLines.forEach((line, i) => {
      ctx.font = '700 ' + nameSize + 'px "Hanken Grotesk"';
      ctx.fillText(line, pad, y + i * nameSize * 0.95);
      lastLineW = ctx.measureText(line).width;
    });
    y += (nameLines.length - 1) * nameSize * 0.95;

    // Albumtitel rechts auf der Grundlinie der letzten Namenszeile — aber nur,
    // wenn dort noch Platz ist, sonst rutscht er auf eine eigene Zeile darunter.
    const free = contentW - lastLineW - contentW * 0.06;
    const albumLabel = '/ ' + (model.albumName || model.title);
    const sameLine = free > contentW * 0.26;
    const albumW = sameLine ? free : contentW;
    ctx.textAlign = 'right';
    U.fitText(ctx, albumLabel, albumW, W * 0.045, '"Hanken Grotesk"', '400', W * 0.022);
    ctx.fillStyle = model.accent;
    ctx.fillText(P.truncate(ctx, albumLabel, albumW), W - pad, sameLine ? y : y + W * 0.055);
    ctx.textAlign = 'left';
    if (!sameLine) y += W * 0.055;

    // Bildhöhe aus dem Rest zwischen Kopf und Fußzeile, höchstens quadratisch.
    y += H * 0.028;
    const footerH = H * 0.2;
    const imgH = Math.min(contentW, H - pad - footerH - y);
    U.drawCover(ctx, model.coverImg, pad, y, contentW, imgH);
    if (model.showExplicit) {
      const bw = contentW * 0.1;
      P.explicitBadge(ctx, pad + contentW - bw - contentW * 0.025, y + imgH - bw * 0.62 - contentW * 0.025, bw);
    }

    y += imgH + H * 0.045;

    // Fußzeile: Jahr links, Tracklist rechts.
    ctx.font = '700 ' + W * 0.042 + 'px "Hanken Grotesk"';
    ctx.fillStyle = '#111114';
    ctx.fillText('/ ' + (model.year || '—'), pad, y + W * 0.035);

    const listX = pad + contentW * 0.26;
    P.tracklist(ctx, model.tracks, listX, y, W - pad - listX, H - y - pad - H * 0.03, {
      maxFont: W * 0.024,
      numbered: false,
      color: '#22242a',
      lineHeight: 1.35,
      columns: (model.tracks || []).length > 8 ? 3 : 2,
    });

    if (model.drawCode) {
      model.drawCode(ctx, pad, H - pad - H * 0.035, contentW * 0.22, H * 0.035);
    }

    function longestWord(text) {
      return String(text).split(/\s+/).reduce((a, b) => (a.length >= b.length ? a : b), '');
    }
  },
};
