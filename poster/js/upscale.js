window.Poster = window.Poster || {};

// Notfall-Hochrechnung für zu kleine Cover. Erfindet keine Details — sie ersetzt
// nur die weiche Standard-Interpolation des Browsers durch Lanczos plus eine
// leichte Unscharfmaskierung, damit Kanten im Druck nicht matschen.
Poster.upscale = (function () {
  // Über 2000 px bringt das Hochrechnen nichts mehr — es kämen keine Details
  // dazu, nur Rechenzeit und Speicher.
  const MAX_TARGET = 2000;

  function lanczos(x, a) {
    if (x === 0) return 1;
    if (x <= -a || x >= a) return 0;
    const px = Math.PI * x;
    return (a * Math.sin(px) * Math.sin(px / a)) / (px * px);
  }

  // Getrennt nach Achsen: erst horizontal, dann vertikal. Das ist deutlich
  // billiger als ein 2D-Kernel und liefert dasselbe Ergebnis.
  function resampleAxis(src, srcW, srcH, dstW, horizontal, a) {
    const outW = horizontal ? dstW : srcW;
    const outH = horizontal ? srcH : dstW;
    const out = new Float32Array(outW * outH * 4);
    const srcLen = horizontal ? srcW : srcH;
    const dstLen = dstW;
    const ratio = srcLen / dstLen;
    const support = Math.max(1, ratio) * a;

    for (let d = 0; d < dstLen; d++) {
      const center = (d + 0.5) * ratio - 0.5;
      const start = Math.max(0, Math.ceil(center - support));
      const end = Math.min(srcLen - 1, Math.floor(center + support));
      let weightSum = 0;
      const weights = [];
      for (let s = start; s <= end; s++) {
        const w = lanczos((s - center) / Math.max(1, ratio), a);
        weights.push(w);
        weightSum += w;
      }
      const cross = horizontal ? srcH : srcW;
      for (let c = 0; c < cross; c++) {
        let r = 0, g = 0, b = 0, alpha = 0;
        for (let i = 0; i < weights.length; i++) {
          const w = weights[i] / weightSum;
          const sIdx = horizontal ? (c * srcW + (start + i)) * 4 : ((start + i) * srcW + c) * 4;
          r += src[sIdx] * w;
          g += src[sIdx + 1] * w;
          b += src[sIdx + 2] * w;
          alpha += src[sIdx + 3] * w;
        }
        const oIdx = horizontal ? (c * outW + d) * 4 : (d * outW + c) * 4;
        out[oIdx] = r; out[oIdx + 1] = g; out[oIdx + 2] = b; out[oIdx + 3] = alpha;
      }
    }
    return { data: out, w: outW, h: outH };
  }

  function unsharp(data, w, h, amount) {
    const copy = Float32Array.from(data);
    for (let y = 1; y < h - 1; y++) {
      for (let x = 1; x < w - 1; x++) {
        const i = (y * w + x) * 4;
        for (let c = 0; c < 3; c++) {
          const blur = (
            copy[i + c] * 4
            + copy[i - 4 + c] + copy[i + 4 + c]
            + copy[i - w * 4 + c] + copy[i + w * 4 + c]
          ) / 8;
          data[i + c] = copy[i + c] + (copy[i + c] - blur) * amount;
        }
      }
    }
  }

  // Gibt ein neues Image zurück; das Original bleibt unangetastet.
  function enlarge(img, targetPx, opts) {
    opts = opts || {};
    const a = opts.lobes || 3;
    const target = Math.min(MAX_TARGET, Math.max(img.naturalWidth, targetPx));
    const scale = target / img.naturalWidth;
    if (scale <= 1.02) return Promise.resolve(img);

    const srcCanvas = document.createElement('canvas');
    srcCanvas.width = img.naturalWidth;
    srcCanvas.height = img.naturalHeight;
    const sctx = srcCanvas.getContext('2d', { willReadFrequently: true });
    sctx.drawImage(img, 0, 0);
    const srcData = sctx.getImageData(0, 0, srcCanvas.width, srcCanvas.height).data;

    const dstW = Math.round(img.naturalWidth * scale);
    const dstH = Math.round(img.naturalHeight * scale);

    const pass1 = resampleAxis(srcData, srcCanvas.width, srcCanvas.height, dstW, true, a);
    const pass2 = resampleAxis(pass1.data, pass1.w, pass1.h, dstH, false, a);
    unsharp(pass2.data, pass2.w, pass2.h, opts.sharpen === undefined ? 0.55 : opts.sharpen);

    const outCanvas = document.createElement('canvas');
    outCanvas.width = pass2.w;
    outCanvas.height = pass2.h;
    const octx = outCanvas.getContext('2d');
    const outImage = octx.createImageData(pass2.w, pass2.h);
    for (let i = 0; i < pass2.data.length; i++) {
      outImage.data[i] = Math.max(0, Math.min(255, pass2.data[i]));
    }
    octx.putImageData(outImage, 0, 0);

    return Poster.util.loadImage(outCanvas.toDataURL('image/png'));
  }

  return { enlarge, MAX_TARGET };
})();
