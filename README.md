# Mi Asistencia

Web app responsive e instalable (PWA) para que estudiantes de Andalucía controlen sus faltas y su situación respecto a la evaluación continua.

> Herramienta informativa. No sustituye al centro educativo ni a la normativa oficial.

---

## 1. Estructura de carpetas

```
evaluacion/
├── index.html              # Estructura de la interfaz (todas las vistas)
├── styles.css              # Diseño mobile-first, responsive y accesible
├── app.js                  # Lógica: datos, cálculos, render, OCR, backups
├── manifest.webmanifest    # Manifiesto PWA (instalación)
├── service-worker.js       # Caché offline y ciclo de actualización
├── assets/
│   └── icons/
│       ├── icon-192.png    # Icono PWA 192×192
│       └── icon-512.png    # Icono PWA 512×512
├── Referencia_normativa_evaluacion_continua_Andalucia.txt
├── memoria.md              # Memoria del proyecto
├── AGENTS.md               # Punto de entrada del proyecto
├── instrucciones/          # Reglas permanentes del proyecto
└── README.md               # Este archivo
```

---

## 2. Cómo abrir y probar la web en el ordenador

### Opción A — Abrir el archivo directamente
Haz doble clic en `index.html`.

> ⚠️ Esto sirve para probar la interfaz y los cálculos, pero **no** para probar la PWA: el service worker y la instalación **no funcionan desde `file://`**.

### Opción B — Servidor local (recomendado)
Necesario para probar la PWA. Cualquiera de estas opciones sirve:

```bash
# Con Python (incluido en macOS/Linux y disponible en Windows)
python -m http.server 8080

# Con Node.js
npx serve .
```

Abre `http://localhost:8080` en el navegador.

---

## 3. Cómo probar la PWA desde localhost

1. Arranca el servidor local (ver arriba).
2. Abre `http://localhost:8080` en Chrome o Edge.
3. Abre las **Herramientas de desarrollo** (F12) → pestaña **Application** (Aplicación):
   - **Manifest**: debe mostrarse «Mi Asistencia» sin errores.
   - **Service Workers**: debe aparecer `service-worker.js` como *activated and running*.
4. En la barra de direcciones aparecerá un icono de **instalación** (o en el menú del navegador, «Instalar aplicación»).
5. Para probar offline: en **Application → Service Workers**, marca *Offline* y recarga. La interfaz, los cálculos y el historial deben seguir funcionando.

---

## 4. Cómo publicarla en HTTPS

Una PWA requiere HTTPS (o localhost). Opciones sencillas y gratuitas:

- **GitHub Pages**: sube la carpeta a un repositorio y activa Pages en *Settings → Pages*.
- **Netlify**: arrastra la carpeta a [app.netlify.com/drop](https://app.netlify.com/drop).
- **Vercel**: importa el proyecto y despliega.
- **Cloudflare Pages**: conecta el repositorio o sube los archivos.

Tras publicar, comprueba que `manifest.webmanifest`, `service-worker.js` y `assets/icons/` cargan correctamente (rutas relativas `./`).

> La instalación como PWA **no** crea un APK/IPA nativo ni publica en Google Play o App Store. En esta fase no se desarrollan apps nativas.

---

## 5. Cómo instalarla en el móvil

### Android (Chrome / Edge / Samsung Internet)
1. Abre la web publicada en HTTPS.
2. Aparecerá un aviso o un botón **«Instalar app»**.
3. Si no aparece, abre el menú del navegador y elige **«Instalar aplicación»** o **«Añadir a pantalla de inicio»**.

### iPhone / iPad (Safari)
1. Abre la web en **Safari**.
2. Pulsa el botón **Compartir**.
3. Elige **«Añadir a pantalla de inicio»**.
4. Confirma con **«Añadir»**.

> En iOS no existe el evento `beforeinstallprompt`; por eso la app muestra instrucciones específicas.

---

## 6. Limitaciones importantes

### localStorage
- Los datos se guardan **solo en el navegador y dispositivo** donde usas la app.
- **No hay sincronización automática** entre dispositivos.
- Si borras los datos del navegador, se pierden las asignaturas y faltas.
- Usa **Exportar JSON** periódicamente como copia de seguridad.

### OCR
- El OCR usa **Tesseract.js desde una CDN**: el primer uso (o cada uso sin caché) **requiere conexión a Internet**.
- **No se anuncia como offline**: el resto de la app sí funciona sin conexión, pero el OCR no.
- El OCR **puede confundir** letras, números, días y horas. Revisa siempre el texto extraído antes de usarlo.
- Si el OCR falla, puedes escribir el horario manualmente.

### Cálculos y normativa
- La app es **informativa**. No emite una resolución oficial ni determina si apruebas o suspendes.
- **FP presencial**: se aplica el mínimo de asistencia del 80 % (Orden de 18/09/2025, art. 2.4). El centro puede concretar en su Proyecto educativo el incumplimiento que determina la pérdida.
- **ESO / Bachillerato**: no existe un porcentaje autonómico único. Debes introducir el criterio de tu **Plan de Convivencia** (Decreto 327/2010, art. 34.3).
- Los estados son: «Sin riesgo», «Cerca del límite», «Límite superado» y «Falta criterio del centro». **No** se usan «Aprobado» ni «Suspendido».

---

## 7. Copias de seguridad y restauración

### Exportar
1. Ve a **Ajustes → Copia de seguridad**.
2. Pulsa **Exportar JSON**.
3. Se descargará un archivo `mi-asistencia-backup-AAAA-MM-DD.json`.

### Importar
1. Ve a **Ajustes → Copia de seguridad**.
2. Pulsa **Importar JSON** y selecciona el archivo.
3. La app valida la estructura y pide confirmación antes de reemplazar los datos.
4. Se guarda automáticamente una copia del estado anterior en `localStorage` (clave `miAsistenciaState_backup_<timestamp>`).

### Borrar todo
**Ajustes → Borrar todos los datos** (pide doble confirmación y guarda una copia previa).

---

## 8. Comprobaciones realizadas antes de entregar

- [x] Sintaxis de `app.js` y `service-worker.js` validada con `node --check`.
- [x] `manifest.webmanifest` es JSON válido.
- [x] Todos los IDs usados en `app.js` existen en `index.html`.
- [x] Migración segura desde la versión anterior (`asistenciaData`) con copia de respaldo.
- [x] Normalización de datos al cargar e importar (evita estados corruptos).
- [ ] Prueba visual en móvil/tablet/escritorio (recomendada tras publicar).
- [ ] Prueba de instalación PWA desde HTTPS/localhost (requiere servidor).

---

## 9. Créditos y fuentes normativas

- Orden de 18 de septiembre de 2025 (FP): <https://www.juntadeandalucia.es/boja/2025/180/c01/1>
- Decreto 147/2025 (FP): <https://www.juntadeandalucia.es/boja/2025/217901/1>
- Decreto 327/2010 (IES), texto consolidado: <https://ws040.juntadeandalucia.es/sedeboja/lconsolidada/eli/es-an/d/2010/07/13/327/con/20260831/spa/html/LE0000422784_20260831.html>
- Orden de 19 de septiembre de 2005 (absentismo): <https://ws040.juntadeandalucia.es/sedeboja/lconsolidada/eli/es-an/o/2005/09/19/%281401437649%29/con/20060113/spa/html/LE0000219382_20060113.html>
