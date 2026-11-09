/* ============================================================
   Mi Asistencia — ocr.js
   Extracción de texto de una foto de horario con Tesseract.js.
   ============================================================ */

function bindOCR() {
  $('#btn-ocr').addEventListener('click', async () => {
    const file = $('#ocr-file').files[0];
    const status = $('#ocr-status');
    if (!file) return toast('Selecciona una foto primero');

    if (typeof Tesseract === 'undefined') {
      status.textContent = 'El OCR no está disponible (sin conexión o CDN bloqueada). Puedes escribir el horario manualmente.';
      status.className = 'note danger';
      return;
    }

    status.textContent = 'Procesando imagen... puede tardar unos segundos.';
    status.className = 'note info';

    try {
      const result = await Tesseract.recognize(file, 'spa');
      const text = (result && result.data && result.data.text) ? result.data.text.trim() : '';
      $('#ocr-text').value = text;
      status.textContent = 'Texto extraído. Revísalo y corrige los errores antes de usarlo.';
      status.className = 'note warn';
    } catch (err) {
      status.textContent = 'No se pudo procesar la imagen: ' + err.message;
      status.className = 'note danger';
    }
  });
}
