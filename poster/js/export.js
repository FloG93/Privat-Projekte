window.Poster = window.Poster || {};

Poster.exportPoster = (function () {
  const MM_PER_INCH = 25.4;

  // Die Auflösung ist pro Format gestaffelt, weil die Canvas-Fläche der Browser
  // die Grenze setzt, nicht der Drucker: A2 bei 300 dpi sind 34,8 Megapixel und
  // laufen nachweislich durch — A1 wären bei 300 dpi schon 70, A0 gar 140.
  // Jedes Format bleibt deshalb unter etwa 35 Megapixeln. Für Großformat ist das
  // auch fachlich richtig: ein A0-Plakat wird aus zwei Metern Abstand gesehen,
  // 150 dpi sind dort üblich.
  const SIZES = {
    A4: { w: 210, h: 297, dpi: 300, label: 'A4', cm: '21 × 29,7 cm' },
    A3: { w: 297, h: 420, dpi: 300, label: 'A3', cm: '29,7 × 42 cm' },
    A2: { w: 420, h: 594, dpi: 300, label: 'A2', cm: '42 × 59,4 cm' },
    A1: { w: 594, h: 841, dpi: 210, label: 'A1', cm: '59,4 × 84,1 cm' },
    A0: { w: 841, h: 1189, dpi: 150, label: 'A0', cm: '84,1 × 118,9 cm' },
    P50x70: { w: 500, h: 700, dpi: 250, label: '50 × 70', cm: '50 × 70 cm' },
    P70x100: { w: 700, h: 1000, dpi: 170, label: '70 × 100', cm: '70 × 100 cm' },
  };

  function sizeInfo(size) {
    return SIZES[size] || SIZES.A4;
  }

  // Seitenverhältnis Höhe/Breite — die A-Reihe hat 1,414, die Plakatmaße
  // 1,40 bzw. 1,43. Vorschau und Layout richten sich danach.
  function ratio(size) {
    const s = sizeInfo(size);
    return s.h / s.w;
  }

  function pxForSize(size) {
    const mm = sizeInfo(size);
    return {
      w: Math.round((mm.w / MM_PER_INCH) * mm.dpi),
      h: Math.round((mm.h / MM_PER_INCH) * mm.dpi),
      dpi: mm.dpi,
      mm,
    };
  }

  function renderFull(model, size) {
    const { w, h } = pxForSize(size);
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    const styleModule = Poster.styles[model.style] || Poster.styles.minimal;
    styleModule.draw(ctx, w, h, model);
    return canvas;
  }

  function slug(model) {
    return (
      (model.artist + '-' + model.title)
        .toLowerCase()
        .normalize('NFKD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '') || 'poster'
    );
  }

  // Der Dateiname nennt die tatsächliche Auflösung, nicht pauschal 300 dpi.
  function fileName(model, size, ext) {
    const s = sizeInfo(size);
    const tag = s.label.replace(/\s*×\s*/g, 'x').replace(/[^\w]+/g, '');
    return slug(model) + '-' + tag + '-' + s.dpi + 'dpi.' + ext;
  }

  function downloadBlob(blob, filename) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 4000);
  }

  function exportPNG(model, size) {
    const canvas = renderFull(model, size);
    return new Promise((resolve, reject) => {
      canvas.toBlob((blob) => {
        if (!blob) return reject(new Error('PNG-Export fehlgeschlagen'));
        downloadBlob(blob, fileName(model, size, 'png'));
        resolve();
      }, 'image/png');
    });
  }

  async function exportPDF(model, size) {
    const canvas = renderFull(model, size);
    const { mm } = pxForSize(size);
    const dataUrl = canvas.toDataURL('image/png');
    const { jsPDF } = window.jspdf;
    const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: [mm.w, mm.h], compress: true });
    pdf.addImage(dataUrl, 'PNG', 0, 0, mm.w, mm.h, undefined, 'FAST');
    pdf.save(fileName(model, size, 'pdf'));
  }

  return { exportPNG, exportPDF, pxForSize, sizeInfo, ratio, SIZES };
})();
