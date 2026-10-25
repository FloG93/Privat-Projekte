window.Poster = window.Poster || {};
Poster.styles = Poster.styles || {};

// Minimalistisch: großes Cover, viel Weißraum, ruhige Typografie — der bekannte
// "Spotify-Poster"-Look.
Poster.styles.minimal = {
  id: 'minimal',
  label: 'Minimalistisch',

  draw(ctx, W, H, model) {
    const U = Poster.util;
    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, W, H);

    const pad = W * 0.08;
    const coverSize = W - pad * 2;
    const coverY = pad;
    U.drawCover(ctx, model.coverImg, pad, coverY, coverSize, coverSize);

    let y = coverY + coverSize + H * 0.06;
    ctx.textBaseline = 'alphabetic';
    ctx.fillStyle = '#121214';

    const titleStart = W * 0.062;
    const titleSize = U.fitText(ctx, model.title, coverSize, titleStart, '"Space Grotesk"', '700', W * 0.026);
    const titleLines = U.wrapLines(ctx, model.title, coverSize).slice(0, 2);
    titleLines.forEach((line) => {
      y += titleSize * 1.06;
      ctx.fillText(line, pad, y);
    });

    y += H * 0.022;
    ctx.font = '500 ' + W * 0.03 + 'px "Hanken Grotesk"';
    ctx.fillStyle = '#6b6f76';
    ctx.fillText(model.artist, pad, y);

    y += H * 0.05;
    const waveH = H * 0.045;
    const bars = 52;
    const gap = coverSize / bars;
    const seed = U.seededRandom(model.title + model.artist);
    ctx.fillStyle = model.accent;
    for (let i = 0; i < bars; i++) {
      const bh = waveH * (0.2 + seed() * 0.8);
      ctx.fillRect(pad + i * gap, y + (waveH - bh), gap * 0.5, bh);
    }

    y += waveH + H * 0.028;
    ctx.font = '500 ' + W * 0.021 + 'px "Hanken Grotesk"';
    ctx.fillStyle = '#9a9ea5';
    ctx.fillText('0:00', pad, y);
    if (model.duration) {
      const dw = ctx.measureText(model.duration).width;
      ctx.fillText(model.duration, pad + coverSize - dw, y);
    }

    if (model.drawCode) {
      const codeMaxH = H * 0.07;
      const codeMaxW = coverSize * 0.55;
      const codeY = y + H * 0.03;
      model.drawCode(ctx, pad, codeY, codeMaxW, codeMaxH);
    }
  },
};
