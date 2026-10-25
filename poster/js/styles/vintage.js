window.Poster = window.Poster || {};
Poster.styles = Poster.styles || {};

// Vintage / Vinyl-Retro: cremefarbener Untergrund, doppelte Rahmenlinie, Cover als
// Schallplatten-Label auf einer gezeichneten Vinyl-Scheibe, Serifen-Display-Type.
Poster.styles.vintage = {
  id: 'vintage',
  label: 'Vintage / Vinyl',

  draw(ctx, W, H, model) {
    const U = Poster.util;
    const bg = '#f2e8d3';
    const ink = '#2c2418';

    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, W, H);

    // paper grain
    const grain = U.seededRandom('grain-' + model.title);
    ctx.fillStyle = 'rgba(44,36,24,0.035)';
    for (let i = 0; i < W * H * 0.00012; i++) {
      ctx.fillRect(grain() * W, grain() * H, 1.4, 1.4);
    }

    // double-rule frame
    const m = W * 0.055;
    ctx.strokeStyle = model.accent;
    ctx.lineWidth = W * 0.006;
    ctx.strokeRect(m, m, W - m * 2, H - m * 2);
    ctx.lineWidth = W * 0.0016;
    ctx.strokeStyle = ink;
    ctx.strokeRect(m + W * 0.014, m + W * 0.014, W - (m + W * 0.014) * 2, H - (m + W * 0.014) * 2);

    // vinyl record
    const cx = W / 2;
    const cy = H * 0.4;
    const outerR = W * 0.34;
    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, outerR, 0, Math.PI * 2);
    ctx.fillStyle = '#1b1712';
    ctx.fill();
    ctx.restore();

    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, outerR, 0, Math.PI * 2);
    ctx.clip();
    ctx.strokeStyle = 'rgba(242,232,211,0.16)';
    for (let r = outerR * 0.5; r < outerR; r += outerR * 0.028) {
      ctx.lineWidth = outerR * 0.006;
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.stroke();
    }
    // light sheen
    const sheen = ctx.createLinearGradient(cx - outerR, cy - outerR, cx + outerR, cy + outerR);
    sheen.addColorStop(0, 'rgba(255,255,255,0.10)');
    sheen.addColorStop(0.5, 'rgba(255,255,255,0)');
    sheen.addColorStop(1, 'rgba(255,255,255,0.05)');
    ctx.fillStyle = sheen;
    ctx.fillRect(cx - outerR, cy - outerR, outerR * 2, outerR * 2);
    ctx.restore();

    // label = cover art
    const labelR = outerR * 0.42;
    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, labelR, 0, Math.PI * 2);
    ctx.clip();
    U.drawCover(ctx, model.coverImg, cx - labelR, cy - labelR, labelR * 2, labelR * 2);
    ctx.fillStyle = 'rgba(0,0,0,0.12)';
    ctx.fillRect(cx - labelR, cy - labelR, labelR * 2, labelR * 2);
    ctx.restore();
    ctx.beginPath();
    ctx.arc(cx, cy, labelR, 0, Math.PI * 2);
    ctx.strokeStyle = model.accent;
    ctx.lineWidth = outerR * 0.02;
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(cx, cy, outerR * 0.045, 0, Math.PI * 2);
    ctx.fillStyle = bg;
    ctx.fill();

    // title
    let y = cy + outerR + H * 0.09;
    ctx.textAlign = 'center';
    ctx.fillStyle = ink;
    const titleSize = U.fitText(ctx, model.title.toUpperCase(), W - m * 4, W * 0.075, '"Abril Fatface"', '400', W * 0.03);
    const titleLines = U.wrapLines(ctx, model.title.toUpperCase(), W - m * 4).slice(0, 2);
    titleLines.forEach((line) => {
      ctx.fillText(line, cx, y);
      y += titleSize * 1.05;
    });

    y += H * 0.006;
    ctx.font = '700 ' + W * 0.03 + 'px "Vollkorn"';
    ctx.fillStyle = model.accent;
    ctx.fillText(spaced(model.artist.toUpperCase()), cx, y);

    if (model.subtitle) {
      y += H * 0.035;
      ctx.font = 'italic 400 ' + W * 0.02 + 'px "Vollkorn"';
      ctx.fillStyle = ink;
      ctx.globalAlpha = 0.75;
      ctx.fillText(model.subtitle, cx, y);
      ctx.globalAlpha = 1;
    }
    ctx.textAlign = 'left';

    if (model.drawCode) {
      const codeSize = W * 0.16;
      const bx = W - m - W * 0.014 - codeSize - W * 0.03;
      const by = H - m - W * 0.014 - codeSize - W * 0.03;
      ctx.save();
      ctx.translate(bx + codeSize / 2, by + codeSize / 2);
      ctx.rotate(-0.04);
      ctx.translate(-(bx + codeSize / 2), -(by + codeSize / 2));
      ctx.fillStyle = '#fffdf6';
      ctx.strokeStyle = ink;
      ctx.lineWidth = W * 0.0018;
      const stampPad = codeSize * 0.12;
      U.roundRect(ctx, bx - stampPad, by - stampPad, codeSize + stampPad * 2, codeSize + stampPad * 2, W * 0.006);
      ctx.fill();
      ctx.stroke();
      model.drawCode(ctx, bx, by, codeSize, codeSize);
      ctx.restore();
    }

    function spaced(str) {
      return str.split('').join('  ');
    }
  },
};
