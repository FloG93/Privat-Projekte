window.Poster = window.Poster || {};
Poster.styles = Poster.styles || {};

// Key Art: das Plakatmotiv randlos, darüber Darstellerzeile, Titel und der
// ultraschmale Billing Block — der Aufbau des klassischen Kinoplakats.
Poster.styles.filmkeyart = {
  id: 'filmkeyart',
  label: 'Key Art',
  kinds: ['film'],

  draw(ctx, W, H, model) {
    const U = Poster.util;
    const P = Poster.parts;

    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = '#0b0b0d';
    ctx.fillRect(0, 0, W, H);
    U.drawCover(ctx, model.coverImg, 0, 0, W, H);

    // Ohne Abdunklung unten verschwindet der Text im Motiv.
    const shade = ctx.createLinearGradient(0, H * 0.42, 0, H);
    shade.addColorStop(0, 'rgba(8,8,10,0)');
    shade.addColorStop(0.55, 'rgba(8,8,10,0.72)');
    shade.addColorStop(1, 'rgba(8,8,10,0.96)');
    ctx.fillStyle = shade;
    ctx.fillRect(0, H * 0.42, W, H * 0.58);

    const pad = W * 0.07;
    const contentW = W - pad * 2;
    ctx.textBaseline = 'alphabetic';

    // Von unten nach oben aufgebaut: Freigabe und Code stehen in der Fußzeile,
    // darüber der Billing Block, und der Titel nimmt, was übrig bleibt.
    const footBottom = H - pad;
    const badge = contentW * 0.11;

    if (model.drawCode) {
      model.drawCode(ctx, W - pad - badge, footBottom - badge, badge, badge, 'right');
    }
    if (model.certification) {
      P.fskBadge(ctx, pad, footBottom - badge, badge, model.certification);
    }

    let bottom = footBottom - badge - H * 0.026;
    const blockW = contentW * 0.78;
    const blockH = P.billingBlock(ctx, model.filmCredits || [], W / 2 - blockW / 2, 0, blockW, {
      size: W * 0.019,
      color: 'rgba(255,255,255,0.82)',
      bottom,
    });
    bottom -= blockH + H * 0.024;

    if (model.releaseLine) {
      ctx.textAlign = 'center';
      ctx.font = '600 ' + W * 0.026 + 'px "Saira Extra Condensed"';
      ctx.fillStyle = model.accent;
      ctx.fillText(model.releaseLine.toUpperCase(), W / 2, bottom);
      bottom -= H * 0.032;
      ctx.textAlign = 'left';
    }

    // Titel: wenn TMDB den Originalschriftzug hat, wird er gesetzt, sonst Type.
    // Ein Titelschriftzug ist immer deutlich breiter als hoch; was hochkant
    // ankommt, ist bei TMDB falsch einsortiert und würde hier zur Briefmarke
    // schrumpfen — dann lieber gesetzte Schrift.
    const titleMaxW = contentW;
    const logo = model.titleLogoImg;
    if (logo && logo.width / logo.height >= 1.6) {
      const img = logo;
      const scale = Math.min(titleMaxW / img.width, (H * 0.18) / img.height);
      const tw = img.width * scale, th = img.height * scale;
      ctx.drawImage(img, W / 2 - tw / 2, bottom - th, tw, th);
      bottom -= th + H * 0.024;
    } else {
      const caps = (model.title || '').toUpperCase();
      const size = U.fitText(ctx, caps, titleMaxW, W * 0.14, '"Anton"', '400', W * 0.05);
      const lines = U.wrapLines(ctx, caps, titleMaxW).slice(0, 2);
      ctx.textAlign = 'center';
      ctx.fillStyle = '#ffffff';
      for (let i = lines.length - 1; i >= 0; i--) {
        ctx.fillText(lines[i], W / 2, bottom);
        bottom -= size * 0.92;
      }
      bottom -= H * 0.008;
      ctx.textAlign = 'left';
    }

    if (model.tagline) {
      ctx.textAlign = 'center';
      ctx.font = 'italic 400 ' + W * 0.028 + 'px "Vollkorn"';
      ctx.fillStyle = 'rgba(255,255,255,0.88)';
      ctx.fillText(P.truncate(ctx, model.tagline, contentW), W / 2, bottom);
      bottom -= H * 0.03;
      ctx.textAlign = 'left';
    }

    P.castRow(ctx, model.cast, pad, bottom, contentW, {
      size: W * 0.03,
      color: 'rgba(255,255,255,0.9)',
      max: 5,
    });
  },
};
