window.Poster = window.Poster || {};

// Bausteine, die mehrere Poster-Stile teilen: Tracklist, Farbfelder, Player-Elemente.
Poster.parts = (function () {
  const U = Poster.util;

  function truncate(ctx, text, maxWidth) {
    if (ctx.measureText(text).width <= maxWidth) return text;
    let s = String(text);
    while (s.length > 1 && ctx.measureText(s + '…').width > maxWidth) s = s.slice(0, -1);
    return s.replace(/\s+$/, '') + '…';
  }

  // Auto-umbrochene Tracklist: Spaltenzahl nach Titelanzahl, dann die größte
  // Schrift, die noch in die Box passt. Gezählt wird spaltenweise von oben.
  function tracklist(ctx, tracks, x, y, w, h, opts) {
    opts = opts || {};
    if (!tracks || !tracks.length) return 0;
    const n = tracks.length;
    const columns = opts.columns || (n <= 6 ? 1 : n <= 14 ? 2 : n <= 27 ? 3 : 4);
    const rows = Math.ceil(n / columns);
    const lineH = opts.lineHeight || 1.5;
    const gap = opts.gap === undefined ? w * 0.045 : opts.gap;
    const colW = (w - gap * (columns - 1)) / columns;
    const font = (s) => (opts.weight || '400') + ' ' + s + 'px ' + (opts.family || '"Hanken Grotesk"');
    const label = (t, i) => (opts.numbered === false ? '' : (i + 1) + '. ') + t;

    ctx.save();
    let size = Math.min(opts.maxFont || w * 0.03, h / (rows * lineH));
    // Erst an der Höhe messen, dann an der breitesten Zeile: lieber etwas
    // kleiner setzen als jeden zweiten Titel mit „…" abschneiden.
    ctx.font = font(size);
    const widest = tracks.reduce((max, t, i) => Math.max(max, ctx.measureText(label(t, i)).width), 0);
    if (widest > colW) size = Math.max(size * (opts.minShrink || 0.62), size * (colW / widest));
    ctx.font = font(size);
    ctx.fillStyle = opts.color || '#111111';
    ctx.textBaseline = 'alphabetic';
    tracks.forEach((t, i) => {
      const col = Math.floor(i / rows);
      const row = i % rows;
      ctx.fillText(truncate(ctx, label(t, i), colW), x + col * (colW + gap), y + (row + 1) * size * lineH);
    });
    ctx.restore();
    return rows * size * lineH;
  }

  function paletteStrip(ctx, palette, x, y, w, h, count) {
    const colors = (palette || []).slice(0, count || 5);
    if (!colors.length) return;
    const cw = w / colors.length;
    colors.forEach((c, i) => {
      ctx.fillStyle = c;
      ctx.fillRect(x + i * cw, y, cw + 0.5, h);
    });
  }

  function paletteColumn(ctx, palette, x, y, w, h, count) {
    const colors = (palette || []).slice(0, count || 4);
    if (!colors.length) return;
    const ch = h / colors.length;
    colors.forEach((c, i) => {
      ctx.fillStyle = c;
      ctx.fillRect(x, y + i * ch, w, ch + 0.5);
    });
  }

  // Kleiner Label-/Wert-Block, wie er auf Tracklist-Postern unter dem Cover steht.
  function meta(ctx, label, value, x, y, size, opts) {
    opts = opts || {};
    const align = opts.align || 'left';
    ctx.save();
    ctx.textAlign = align;
    ctx.font = '700 ' + size + 'px "Hanken Grotesk"';
    ctx.fillStyle = opts.labelColor || '#111111';
    ctx.fillText(String(label).toUpperCase(), x, y);
    ctx.font = '400 ' + size * 1.05 + 'px "Hanken Grotesk"';
    ctx.fillStyle = opts.valueColor || '#6b6f76';
    ctx.fillText(value || '—', x, y + size * 1.5);
    ctx.restore();
    return size * 2.6;
  }

  // Das übliche schwarze Explicit-Kennzeichen. Nachgezeichnet, nicht eingebettet.
  function explicitBadge(ctx, x, y, w) {
    const h = w * 0.62;
    ctx.save();
    ctx.fillStyle = '#000000';
    ctx.fillRect(x, y, w, h);
    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = '700 ' + w * 0.16 + 'px "Hanken Grotesk"';
    ctx.fillText('PARENTAL', x + w / 2, y + h * 0.23);
    ctx.fillText('ADVISORY', x + w / 2, y + h * 0.44);
    ctx.fillRect(x + w * 0.08, y + h * 0.58, w * 0.84, h * 0.03);
    ctx.font = '400 ' + w * 0.115 + 'px "Hanken Grotesk"';
    ctx.fillText('EXPLICIT CONTENT', x + w / 2, y + h * 0.8);
    ctx.restore();
    return h;
  }

  function progressBar(ctx, x, y, w, h, ratio, opts) {
    opts = opts || {};
    ctx.save();
    ctx.fillStyle = opts.trackColor || '#c9ccd2';
    U.roundRect(ctx, x, y, w, h, h / 2);
    ctx.fill();
    ctx.fillStyle = opts.fillColor || '#111111';
    U.roundRect(ctx, x, y, Math.max(h, w * ratio), h, h / 2);
    ctx.fill();
    ctx.restore();
  }

  // ◀◀ ▮▮ ▶▶ — als Pfade gezeichnet, damit sie in jeder Auflösung scharf bleiben.
  function playerControls(ctx, cx, cy, size, color) {
    const gap = size * 1.9;
    ctx.save();
    ctx.fillStyle = color || '#111111';
    skip(cx - gap, -1);
    const barW = size * 0.22;
    ctx.fillRect(cx - barW * 1.5, cy - size * 0.5, barW, size);
    ctx.fillRect(cx + barW * 0.5, cy - size * 0.5, barW, size);
    skip(cx + gap, 1);
    ctx.restore();

    function skip(x, dir) {
      const w = size * 0.48;
      const hh = size * 0.5;
      for (const off of [-w * 0.95, w * 0.05]) {
        ctx.beginPath();
        ctx.moveTo(x + dir * (off + w), cy);
        ctx.lineTo(x + dir * off, cy - hh);
        ctx.lineTo(x + dir * off, cy + hh);
        ctx.closePath();
        ctx.fill();
      }
    }
  }

  // Schallplatte mit Rillen — hinter dem Cover, als würde sie herausgezogen.
  function vinylDisc(ctx, cx, cy, r, accent) {
    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fillStyle = '#17151a';
    ctx.fill();
    ctx.clip();
    ctx.strokeStyle = 'rgba(255,255,255,0.13)';
    for (let rr = r * 0.42; rr < r; rr += r * 0.035) {
      ctx.lineWidth = r * 0.006;
      ctx.beginPath();
      ctx.arc(cx, cy, rr, 0, Math.PI * 2);
      ctx.stroke();
    }
    const sheen = ctx.createLinearGradient(cx - r, cy - r, cx + r, cy + r);
    sheen.addColorStop(0, 'rgba(255,255,255,0.12)');
    sheen.addColorStop(0.5, 'rgba(255,255,255,0)');
    sheen.addColorStop(1, 'rgba(255,255,255,0.07)');
    ctx.fillStyle = sheen;
    ctx.fillRect(cx - r, cy - r, r * 2, r * 2);
    ctx.restore();

    ctx.beginPath();
    ctx.arc(cx, cy, r * 0.33, 0, Math.PI * 2);
    ctx.fillStyle = accent;
    ctx.fill();
    ctx.beginPath();
    ctx.arc(cx, cy, r * 0.035, 0, Math.PI * 2);
    ctx.fillStyle = '#17151a';
    ctx.fill();
  }

  function shadowed(ctx, draw, opts) {
    opts = opts || {};
    ctx.save();
    ctx.shadowColor = opts.color || 'rgba(0,0,0,0.22)';
    ctx.shadowBlur = opts.blur || 0;
    ctx.shadowOffsetY = opts.offsetY || 0;
    draw();
    ctx.restore();
  }

  // --- Filmplakat-Bausteine ---------------------------------------------------

  // Der Billing Block: der ultraschmale Fußtext echter Filmplakate. Die Segmente
  // werden zu einem Fluss verkettet und wie Text umbrochen, damit die Zeilen
  // gleichmäßig füllen — Zeile für Zeile zu setzen ergibt sonst Löcher.
  function billingBlock(ctx, segments, x, y, w, opts) {
    opts = opts || {};
    const parts = segments
      .filter((s) => s.names && s.names.length)
      .map((s) => s.label.toUpperCase() + '  ' + s.names.join(', ').toUpperCase());
    if (!parts.length) return 0;

    const size = opts.size || w * 0.022;
    const gap = '      ';
    ctx.save();
    ctx.font = '400 ' + size + 'px "Saira Extra Condensed"';
    ctx.fillStyle = opts.color || '#ffffff';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'alphabetic';

    const lines = [];
    let line = '';
    parts.forEach((part) => {
      const test = line ? line + gap + part : part;
      if (line && ctx.measureText(test).width > w) {
        lines.push(line);
        line = part;
      } else {
        line = test;
      }
    });
    if (line) lines.push(line);

    // Die Zeilenzahl steht erst nach dem Umbruch fest. Layouts, die von unten
    // nach oben aufbauen, geben deshalb `bottom` statt `y` — sonst müssten sie
    // die Höhe raten und der Block läge unter dem nächsten Element.
    const lineH = size * 1.16;
    const top = opts.bottom !== undefined ? opts.bottom - lines.length * lineH : y;
    lines.forEach((l, i) => ctx.fillText(truncate(ctx, l, w), x + w / 2, top + (i + 1) * lineH));
    ctx.restore();
    return lines.length * lineH;
  }

  // Die Darstellerzeile über dem Titel, gesperrt und schmal gesetzt.
  function castRow(ctx, names, x, y, w, opts) {
    opts = opts || {};
    if (!names || !names.length) return 0;
    let size = opts.size || w * 0.035;
    const family = '"Saira Extra Condensed"';
    ctx.save();
    ctx.textAlign = 'center';
    ctx.fillStyle = opts.color || '#ffffff';
    let text = names.slice(0, opts.max || 5).join('   ·   ').toUpperCase();
    ctx.font = '600 ' + size + 'px ' + family;
    while (ctx.measureText(text).width > w && size > w * 0.016) {
      size *= 0.95;
      ctx.font = '600 ' + size + 'px ' + family;
    }
    ctx.fillText(text, x + w / 2, y);
    ctx.restore();
    return size * 1.3;
  }

  // Altersfreigabe als schlichtes Kästchen. Die FSK-Logos sind Marken, deshalb
  // nachgezeichnet wie das Explicit-Kennzeichen.
  function fskBadge(ctx, x, y, size, cert) {
    if (!cert) return 0;
    ctx.save();
    ctx.fillStyle = '#ffffff';
    U.roundRect(ctx, x, y, size, size, size * 0.14);
    ctx.fill();
    ctx.fillStyle = '#111114';
    ctx.lineWidth = size * 0.07;
    ctx.strokeStyle = '#111114';
    U.roundRect(ctx, x + size * 0.05, y + size * 0.05, size * 0.9, size * 0.9, size * 0.1);
    ctx.stroke();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const label = String(cert);
    let fs = size * (label.length > 2 ? 0.34 : 0.46);
    ctx.font = '600 ' + fs + 'px "Saira Extra Condensed"';
    ctx.fillText(label, x + size / 2, y + size * 0.42);
    ctx.font = '400 ' + size * 0.13 + 'px "Saira Extra Condensed"';
    ctx.fillText('FREIGEGEBEN AB', x + size / 2, y + size * 0.76);
    ctx.restore();
    return size;
  }

  // Perforationslinie fürs Ticket-Layout: Stanzlöcher plus gestrichelte Linie.
  function perforation(ctx, x, y, w, opts) {
    opts = opts || {};
    const r = opts.radius || w * 0.022;
    const bg = opts.notchColor || '#0a0c10';
    ctx.save();
    ctx.strokeStyle = opts.color || 'rgba(17,17,20,0.35)';
    ctx.lineWidth = Math.max(1, w * 0.003);
    ctx.setLineDash([w * 0.018, w * 0.014]);
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = bg;
    [x, x + w].forEach((cx) => {
      ctx.beginPath();
      ctx.arc(cx, y, r, 0, Math.PI * 2);
      ctx.fill();
    });
    ctx.restore();
  }

  // Strichcode-Streifen, rein dekorativ — die Breiten kommen aus dem Titel,
  // damit derselbe Film immer dasselbe Muster bekommt.
  function barcode(ctx, x, y, w, h, seed, color) {
    const rand = U.seededRandom('barcode-' + seed);
    ctx.save();
    ctx.fillStyle = color || '#111114';
    let px = x;
    while (px < x + w) {
      const bw = w * (0.004 + rand() * 0.012);
      if (rand() > 0.35) ctx.fillRect(px, y, bw, h);
      px += bw + w * 0.004;
    }
    ctx.restore();
  }

  return {
    truncate, tracklist, paletteStrip, paletteColumn, meta, explicitBadge,
    progressBar, playerControls, vinylDisc, shadowed,
    billingBlock, castRow, fskBadge, perforation, barcode,
  };
})();
