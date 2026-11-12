/* ============================================================
   Mi Asistencia — ocr.js
   Extracción de texto de una foto de horario con Tesseract.js.
   La librería se carga bajo demanda desde una CDN.
   ============================================================ */

const TESSERACT_CDN = 'https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.min.js';

function loadTesseract() {
  if (typeof Tesseract !== 'undefined') return Promise.resolve(Tesseract);

  return new Promise((resolve, reject) => {
    const existing = document.querySelector('script[data-tesseract]');
    if (existing) {
      existing.addEventListener('load', () => resolve(window.Tesseract));
      existing.addEventListener('error', () => reject(new Error('No se pudo cargar la librería OCR')));
      return;
    }

    const script = document.createElement('script');
    script.src = TESSERACT_CDN;
    script.async = true;
    script.dataset.tesseract = 'true';
    script.onload = () => {
      if (typeof Tesseract !== 'undefined') resolve(Tesseract);
      else reject(new Error('La librería OCR no se inicializó'));
    };
    script.onerror = () => reject(new Error('No se pudo cargar la librería OCR (revisa tu conexión)'));
    document.head.appendChild(script);
  });
}

function bindOCR() {
  $('#btn-ocr').addEventListener('click', async () => {
    const file = $('#ocr-file').files[0];
    const status = $('#ocr-status');
    if (!file) return toast('Selecciona una foto primero');

    status.textContent = 'Cargando el motor OCR...';
    status.className = 'note info';

    try {
      const tesseract = await loadTesseract();
      status.textContent = 'Procesando imagen... puede tardar unos segundos.';
      status.className = 'note info';
      const result = await tesseract.recognize(file, 'spa');
      const text = (result && result.data && result.data.text) ? result.data.text.trim() : '';
      $('#ocr-text').value = text;
      status.textContent = 'Texto extraído. Revísalo y corrige los errores antes de usarlo.';
      status.className = 'note warn';
    } catch (err) {
      status.textContent = 'OCR no disponible: ' + err.message + '. Puedes escribir el horario manualmente.';
      status.className = 'note danger';
    }
  });
}
