window.Poster = window.Poster || {};

// Thin wrapper around the vendored qrcode-generator library (vendor/qrcode-generator.js).
Poster.qr = (function () {
  function drawQR(ctx, text, x, y, size, opts) {
    opts = opts || {};
    const dark = opts.dark || '#111111';
    const light = opts.light === 'transparent' ? null : (opts.light || '#ffffff');
    const margin = opts.margin === undefined ? 2 : opts.margin;

    const qr = qrcode(0, opts.ecLevel || 'M');
    qr.addData(text || '');
    qr.make();
    const count = qr.getModuleCount();
    const cell = size / (count + margin * 2);

    if (light) {
      ctx.fillStyle = light;
      ctx.fillRect(x, y, size, size);
    }
    ctx.fillStyle = dark;
    for (let r = 0; r < count; r++) {
      for (let c = 0; c < count; c++) {
        if (qr.isDark(r, c)) {
          ctx.fillRect(x + (c + margin) * cell, y + (r + margin) * cell, cell + 0.5, cell + 0.5);
        }
      }
    }
    return { w: size, h: size };
  }

  return { drawQR };
})();
