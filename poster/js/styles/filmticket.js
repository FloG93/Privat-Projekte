window.Poster = window.Poster || {};
Poster.styles = Poster.styles || {};

// Kinoprogramm: das Plakat als Eintrittskarte — Motiv oben, Perforation,
// darunter die Angaben als Tabelle und ein Strichcode mit dem Scan-Code.
Poster.styles.filmticket = {
  id: 'filmticket',
  label: 'Kinoprogramm',
  kinds: ['film'],

  draw(ctx, W, H, model) {
    const U = Poster.util;
    const P = Poster.parts;
    const paper = '#f4f1e8';
    const ink = '#17171a';

    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = paper;
    ctx.fillRect(0, 0, W, H);

    const pad = W * 0.07;
    const contentW = W - pad * 2;
    ctx.textBaseline = 'alphabetic';

    // Kopfzeile wie auf einer Karte: links das Haus, rechts die Nummer.
    ctx.font = '600 ' + W * 0.022 + 'px "Saira Extra Condensed"';
    ctx.fillStyle = 'rgba(23,23,26,0.6)';
    ctx.fillText('KINOPROGRAMM', pad, pad + W * 0.02);
    ctx.textAlign = 'right';
    ctx.fillText('NR. ' + String((model.title || '').length * 7 + 100).padStart(4, '0'), W - pad, pad + W * 0.02);
    ctx.textAlign = 'left';

    const artY = pad + W * 0.045;
    const artH = H * 0.42;
    U.drawCover(ctx, model.coverImg, pad, artY, contentW, artH);

    let y = artY + artH + W * 0.055;
    P.perforation(ctx, pad, y - W * 0.025, contentW, { notchColor: paper, radius: W * 0.02, color: 'rgba(23,23,26,0.4)' });

    const caps = (model.title || '').toUpperCase();
    const size = U.fitText(ctx, caps, contentW, W * 0.092, '"Anton"', '400', W * 0.038);
    const lines = U.wrapLines(ctx, caps, contentW).slice(0, 2);
    ctx.fillStyle = ink;
    lines.forEach((line) => {
      y += size * 0.92;
      ctx.fillText(line, pad, y);
    });

    if (model.tagline) {
      y += H * 0.026;
      ctx.font = 'italic 400 ' + W * 0.024 + 'px "Vollkorn"';
      ctx.fillStyle = 'rgba(23,23,26,0.72)';
      ctx.fillText(P.truncate(ctx, model.tagline, contentW), pad, y);
    }

    // Angaben als zweispaltige Tabelle — nur gefüllte Zeilen.
    y += H * 0.042;
    const rows = [
      ['Regie', model.director],
      ['Laufzeit', model.runtimeText],
      ['Genre', model.genresText],
      ['Start', model.releaseDate || model.year],
      ['FSK', model.certification ? 'ab ' + model.certification + ' Jahren' : ''],
      ['Studio', model.studio],
    ].filter((r) => r[1]);

    const colW = contentW / 2;
    const rowH = H * 0.038;
    const labelSize = W * 0.018;
    rows.forEach(([label, value], i) => {
      const cx = pad + (i % 2) * colW;
      const cy = y + Math.floor(i / 2) * rowH;
      ctx.font = '600 ' + labelSize + 'px "Saira Extra Condensed"';
      ctx.fillStyle = 'rgba(23,23,26,0.55)';
      ctx.fillText(label.toUpperCase(), cx, cy);
      ctx.font = '400 ' + W * 0.027 + 'px "Hanken Grotesk"';
      ctx.fillStyle = ink;
      ctx.fillText(P.truncate(ctx, String(value), colW - W * 0.03), cx, cy + labelSize * 1.6);
    });
    // Die Tabelle ist unterschiedlich hoch, je nachdem was der Film hergibt —
    // der Billing Block schließt deshalb an ihr Ende an, nicht an die Fußzeile.
    y += Math.ceil(rows.length / 2) * rowH + H * 0.022;
    P.billingBlock(ctx, model.filmCredits || [], pad, y, contentW, {
      size: W * 0.017,
      color: 'rgba(23,23,26,0.62)',
    });

    // Fuß: Strichcode und Scan-Code als „Ticket-Kennung".
    const footY = H - pad;
    const codeSize = W * 0.15;
    if (model.drawCode) {
      model.drawCode(ctx, W - pad - codeSize, footY - codeSize, codeSize, codeSize, 'right');
    }
    P.barcode(ctx, pad, footY - codeSize * 0.5, contentW - codeSize - W * 0.05, codeSize * 0.5,
      model.title + model.year, 'rgba(23,23,26,0.85)');
  },
};
