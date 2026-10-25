window.Poster = window.Poster || {};

Poster.exportPoster = (function () {
  const DPI = 300;
  const MM_PER_INCH = 25.4;
  const SIZES = {
    A4: { w: 210, h: 297 },
    A3: { w: 297, h: 420 },
    A2: { w: 420, h: 594 },
  };

  function pxForSize(size) {
    const mm = SIZES[size] || SIZES.A4;
    return {
      w: Math.round((mm.w / MM_PER_INCH) * DPI),
      h: Math.round((mm.h / MM_PER_INCH) * DPI),
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
        downloadBlob(blob, slug(model) + '-' + size + '-300dpi.png');
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
    pdf.save(slug(model) + '-' + size + '-300dpi.pdf');
  }

  return { exportPNG, exportPDF, pxForSize, SIZES };
})();
