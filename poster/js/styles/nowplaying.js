window.Poster = window.Poster || {};
Poster.styles = Poster.styles || {};

// Now Playing: das Poster als Player-Oberfläche — Cover, Titel, Fortschrittsbalken
// mit Laufzeit und Transporttasten. Funktioniert auch für einzelne Songs.
Poster.styles.nowplaying = {
  id: 'nowplaying',
  label: 'Now Playing',

  draw(ctx, W, H, model) {
    const U = Poster.util;
    const P = Poster.parts;

    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, W, H);

    const pad = W * 0.085;
    const contentW = W - pad * 2;
    ctx.textBaseline = 'alphabetic';

    ctx.save();
    U.roundRect(ctx, pad, pad, contentW, contentW, W * 0.03);
    ctx.clip();
    U.drawCover(ctx, model.coverImg, pad, pad, contentW, contentW);
    ctx.restore();

    let y = pad + contentW + H * 0.065;

    // Titel und Interpret, rechts der Menüpunkt des Players.
    const dotsR = W * 0.035;
    const textW = contentW - dotsR * 2.6;
    ctx.fillStyle = '#111114';
    const titleSize = U.fitText(ctx, model.title, textW, W * 0.055, '"Hanken Grotesk"', '700', W * 0.03);
    ctx.fillText(P.truncate(ctx, model.title, textW), pad, y);
    ctx.font = '400 ' + W * 0.038 + 'px "Hanken Grotesk"';
    ctx.fillStyle = '#4a4d54';
    ctx.fillText(P.truncate(ctx, model.artist, textW), pad, y + titleSize * 0.95);

    ctx.beginPath();
    ctx.arc(W - pad - dotsR, y - titleSize * 0.1, dotsR, 0, Math.PI * 2);
    ctx.fillStyle = '#111114';
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    for (let i = -1; i <= 1; i++) {
      ctx.beginPath();
      ctx.arc(W - pad - dotsR + i * dotsR * 0.42, y - titleSize * 0.1, dotsR * 0.11, 0, Math.PI * 2);
      ctx.fill();
    }

    // Fortschrittsbalken mit gespielter und verbleibender Zeit.
    y += titleSize * 0.95 + H * 0.045;
    const barH = W * 0.014;
    const ratio = 0.42;
    P.progressBar(ctx, pad, y, contentW, barH, ratio, { fillColor: model.accent, trackColor: '#d4d7dd' });

    y += barH + W * 0.038;
    const totalSec = parseClock(model.duration);
    ctx.font = '400 ' + W * 0.026 + 'px "Hanken Grotesk"';
    ctx.fillStyle = '#4a4d54';
    ctx.fillText(totalSec ? clock(Math.round(totalSec * ratio)) : '0:44', pad, y);
    ctx.textAlign = 'right';
    ctx.fillText(totalSec ? '-' + clock(Math.round(totalSec * (1 - ratio))) : '-1:49', W - pad, y);
    ctx.textAlign = 'left';

    y += H * 0.06;
    P.playerControls(ctx, W / 2, y, W * 0.07, '#111114');

    // Fußzeile: Angaben links, Code rechts daneben — untereinander wird es in
    // A4-Proportionen unter den Bedientasten zu eng.
    const footY = H - pad;
    ctx.font = '400 ' + W * 0.019 + 'px "Hanken Grotesk"';
    ctx.fillStyle = '#6b6f76';
    const footLine = [model.label, model.releaseDate || model.year].filter(Boolean).join('  ·  ');
    if (footLine) ctx.fillText(P.truncate(ctx, footLine, contentW * 0.6), pad, footY);

    if (model.drawCode) {
      const codeW = contentW * 0.3;
      const codeH = H * 0.05;
      model.drawCode(ctx, W - pad - codeW, footY - codeH * 0.8, codeW, codeH, 'right');
    }

    function parseClock(str) {
      const m = String(str || '').match(/^(\d+):(\d{2})$/);
      return m ? +m[1] * 60 + +m[2] : 0;
    }
    function clock(sec) {
      return Math.floor(sec / 60) + ':' + String(sec % 60).padStart(2, '0');
    }
  },
};
