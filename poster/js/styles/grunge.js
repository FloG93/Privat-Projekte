window.Poster = window.Poster || {};
Poster.styles = Poster.styles || {};

// Grunge / Konzertflyer: dunkler Untergrund, Duoton-Cover, Risskanten, gestempelte
// Schreibmaschinen-Schrift — Fotokopie-Flyer-Optik.
Poster.styles.grunge = {
  id: 'grunge',
  label: 'Grunge / Flyer',

  draw(ctx, W, H, model) {
    const U = Poster.util;
    const rand = U.seededRandom('grunge-' + model.title + model.artist);
    const bgDark = '#121012';

    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = bgDark;
    ctx.fillRect(0, 0, W, H);

    const coverTop = H * 0.06;
    const coverH = H * 0.52;

    // torn top/bottom edges via jagged clip
    ctx.save();
    torn(ctx, 0, coverTop, W, coverH, rand);
    ctx.clip();
    try { ctx.filter = 'grayscale(1) contrast(1.2) brightness(0.85)'; } catch (e) { /* unsupported */ }
    U.drawCover(ctx, model.coverImg, 0, coverTop, W, coverH);
    ctx.filter = 'none';
    ctx.globalCompositeOperation = 'multiply';
    ctx.fillStyle = model.accent;
    ctx.globalAlpha = 0.55;
    ctx.fillRect(0, coverTop, W, coverH);
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
    // scanline / photocopy noise
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    for (let ly = coverTop; ly < coverTop + coverH; ly += 3) {
      if (rand() > 0.6) ctx.fillRect(0, ly, W, 1);
    }
    ctx.fillStyle = 'rgba(255,255,255,0.06)';
    for (let i = 0; i < 400; i++) {
      ctx.fillRect(rand() * W, coverTop + rand() * coverH, 1.5, 1.5);
    }
    ctx.restore();

    // headline stamped across the bottom edge of the cover
    ctx.save();
    const titleY = coverTop + coverH + H * 0.01;
    ctx.translate(W * 0.07, titleY);
    ctx.rotate(-0.035);
    ctx.fillStyle = '#f3f1ea';
    const titleSize = U.fitText(ctx, model.title.toUpperCase(), W * 0.92, W * 0.11, '"Anton"', '400', W * 0.045);
    const lines = U.wrapLines(ctx, model.title.toUpperCase(), W * 0.92).slice(0, 2);
    let ly = titleSize * 0.9;
    lines.forEach((line) => {
      ctx.fillText(line, 0, ly);
      ly += titleSize * 0.92;
    });
    ctx.restore();

    let y = titleY + (U.wrapLines(ctx, model.title.toUpperCase(), W * 0.92).length) * titleSize * 0.92 + H * 0.02;

    // artist stamp
    ctx.save();
    ctx.font = '400 ' + W * 0.034 + 'px "Special Elite"';
    const stampText = model.artist.toUpperCase();
    const tw = ctx.measureText(stampText).width;
    const padX = W * 0.025, padY = H * 0.014;
    ctx.translate(W * 0.07 + tw / 2 + padX, y + padY * 1.4);
    ctx.rotate(0.02);
    ctx.fillStyle = model.accent;
    U.roundRect(ctx, -tw / 2 - padX, -padY * 1.6, tw + padX * 2, padY * 3.2, W * 0.006);
    ctx.fill();
    ctx.fillStyle = U.contrastColor(model.accent);
    ctx.textAlign = 'center';
    ctx.fillText(stampText, 0, padY * 0.3);
    ctx.textAlign = 'left';
    ctx.restore();

    y += padY * 3.2 + H * 0.02;
    if (model.subtitle) {
      ctx.font = '400 ' + W * 0.02 + 'px "Special Elite"';
      ctx.fillStyle = 'rgba(243,241,234,0.75)';
      ctx.fillText(model.subtitle, W * 0.07, y);
      y += H * 0.03;
    }

    if (model.drawCode) {
      const codeSize = W * 0.15;
      const bx = W - W * 0.09 - codeSize;
      const by = H - H * 0.1 - codeSize;
      ctx.save();
      ctx.translate(bx + codeSize / 2, by + codeSize / 2);
      ctx.rotate(0.05);
      ctx.translate(-(bx + codeSize / 2), -(by + codeSize / 2));
      const stickerPad = codeSize * 0.12;
      ctx.fillStyle = '#f3f1ea';
      U.roundRect(ctx, bx - stickerPad, by - stickerPad, codeSize + stickerPad * 2, codeSize + stickerPad * 2 + H * 0.028, W * 0.004);
      ctx.fill();
      model.drawCode(ctx, bx, by, codeSize, codeSize);
      ctx.font = '400 ' + W * 0.014 + 'px "Special Elite"';
      ctx.fillStyle = '#121012';
      ctx.textAlign = 'center';
      ctx.fillText('SCAN', bx + codeSize / 2, by + codeSize + stickerPad + H * 0.018);
      ctx.textAlign = 'left';
      ctx.restore();
    }

    function torn(c, x, y0, w, h, rng) {
      const teeth = 22;
      const amp = h * 0.018;
      c.beginPath();
      c.moveTo(x, y0);
      for (let i = 0; i <= teeth; i++) {
        c.lineTo(x + (w * i) / teeth, y0 + (rng() - 0.5) * amp);
      }
      for (let i = 0; i <= teeth; i++) {
        c.lineTo(x + w - (w * i) / teeth, y0 + h + (rng() - 0.5) * amp);
      }
      c.closePath();
    }
  },
};
