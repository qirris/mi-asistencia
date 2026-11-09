# Memoria del proyecto: Mi Asistencia

Archivo de memoria persistente. Actualízalo tras cada avance importante.
Regla: NO guardar aquí contraseñas, tokens ni ningún secreto.

## 1. Objetivo y alcance
Web app responsive e instalable (PWA) para estudiantes de Andalucía que permite configurar asignaturas/módulos, registrar faltas y visualizar el riesgo respecto a la evaluación continua. Idiomas: español. Carácter informativo: no sustituye al centro ni a la normativa oficial.

## 2. Estado actual
- Aplicación «Mi Asistencia» reescrita como dashboard PWA (09/11/2026).
- Vistas: Inicio, Asignaturas, Faltas, Horario, Historial y Ajustes.
- PWA: manifest, service worker, iconos 192/512 e instalación con `beforeinstallprompt`.
- Datos en `localStorage` con migración segura desde la versión anterior.
- Carpeta local renombrada de `evaluacion` a `mi-asistencia`.
- Repositorio privado de GitHub: <https://github.com/qirris/mi-asistencia>.
- Código organizado por responsabilidades en `src/css/` y `src/js/`.

## 3. Tecnologías y arquitectura
- HTML5 + CSS3 + JavaScript Vanilla (sin frameworks).
- Archivos: `index.html`, `src/css/styles.css`, `src/js/attendance.js`, `src/js/storage.js`, `src/js/ocr.js`, `src/js/app.js`, `manifest.webmanifest`, `service-worker.js`, `assets/icons/`, `docs/`, `tests/`.
- OCR: `Tesseract.js` cargado bajo demanda desde CDN (requiere Internet; no se anuncia como offline).
- Persistencia: `localStorage` clave `miAsistenciaState`; migración desde clave antigua `asistenciaData` con copia `asistenciaData_backup`.
- Cálculo de asistencia global ponderado por horas.

## 4. Instrucciones y restricciones
- Idioma: Español.
- Seguir sistema de memoria (`AGENTS.md`, `instrucciones/`).
- No inventar reglas legales ni umbrales no verificados.
- No usar «Aprobado»/«Suspendido» como resultado del cálculo de asistencia.

## 5. Funcionalidades implementadas
- Selector de etapa: ESO, Bachillerato, FP Básico/Medio/Superior.
- Alta, edición, archivado y eliminación de asignaturas (con confirmación).
- Auto-cálculo de horas planificadas (horas/semana × semanas), corregible manualmente.
- Registro de faltas con fecha, horas, tipo (justificada/no justificada) y motivo.
- Historial con filtros por asignatura, tipo y rango de fechas; edición y eliminación de registros.
- Dashboard con tarjetas resumen y estado por asignatura, fórmula visible y límite aplicado.
- Lógica FP: mínimo 80 % de asistencia (límite de ausencia 20 %).
- Lógica ESO/Bachillerato: criterio configurable del centro (% o horas).
- OCR de horario con Tesseract.js y texto editable.
- Exportación/importación JSON con validación y copia previa.
- Borrado total con doble confirmación.
- Instalación PWA (botón + instrucciones iOS).
- Fuentes oficiales enlazadas dentro de Ajustes.

## 6. Cambios realizados (sesión 09/11/2026)
- Reescritura completa de `index.html` (6 vistas + diálogo + toast).
- Nuevo `styles.css` mobile-first (sidebar en escritorio, tabs en móvil).
- Nuevo `app.js` con modelo de datos, normalización, cálculos, render y eventos.
- Nuevo `manifest.webmanifest` con scope e iconos maskable.
- Nuevo `service-worker.js` con caché v3, limpieza de versiones y fallback.
- Iconos PNG 192/512 generados en `assets/icons/`.
- `script.js` renombrado a `app.js`; `style.css` renombrado a `styles.css`.
- Creado `README.md` con estructura, pruebas, publicación e instalación.
- Carpeta local renombrada de `evaluacion` a `mi-asistencia`.
- Reorganización: `src/css/styles.css` y `src/js/{attendance,storage,ocr,app}.js`.
- OCR corregido: Tesseract.js se carga bajo demanda desde CDN.
- Documento normativo movido a `docs/` con nombre kebab-case.
- Añadidos `.gitignore`, `.gitattributes` y pruebas en `tests/`.
- Repositorio privado creado en GitHub y sincronizado con `main`.

## 7. Decisiones tomadas
- Mantener JavaScript Vanilla y sin backend.
- Guardar todo en `localStorage` (privacidad, sin servidores).
- Separar «absentismo» de «evaluación continua» (no se implementa el umbral de 25 h como pérdida de evaluación).
- Usar estados informativos: Sin riesgo / Cerca del límite / Límite superado / Falta criterio del centro.
- Migración con copia de seguridad antes de transformar datos antiguos.

## 8. Pruebas verificadas (09/11/2026)
- `node --check` en `src/js/app.js`, `src/js/attendance.js`, `src/js/storage.js`, `src/js/ocr.js` y `service-worker.js` → OK.
- `manifest.webmanifest` validado como JSON → OK.
- `node tests/check-ids.js`: los 60 IDs usados en JS existen en `index.html` → OK.
- `node tests/attendance.test.js`: asistencia FP 80 % → 80,00 %; ausencia 20 % → «cerca del límite»; ESO con criterio 15 % → «límite superado»; ESO sin criterio → «falta criterio»; asistencia global ponderada 88,89 %; `normalizeState` corrige etapa inválida; `render()` completo sin errores → OK.
- Servidor local `python -m http.server 8080`: todos los recursos responden 200 con MIME type correcto → OK.
- Pendiente: prueba visual en dispositivos y prueba de instalación PWA real desde el navegador (Chrome/Edge/Android/iOS).

## 9. Errores y problemas pendientes
- El OCR depende de CDN: sin Internet no está disponible (documentado en la UI y README). Ahora se carga bajo demanda para no bloquear la app.
- No hay sincronización entre dispositivos (limitación de `localStorage`, documentada).
- Falta prueba real de instalación PWA en Android/iOS.

## 10. Próximos pasos
- Publicar en HTTPS y verificar instalación PWA + funcionamiento offline.
- Revisar diseño en móvil real y ajustar si hay desbordamiento.
- Opcional: empaquetar Tesseract.js y modelos de idioma localmente para OCR offline.
- Opcional: exportar/importar también desde la vista Inicio.

## 11. Historial de actualizaciones
- 06/11/2026: Inicialización del sistema.
- 06/11/2026: Actualización con base normativa.
- 06/11/2026: Creación del prototipo de UI.
- 06/11/2026: Implementación de lógica de cálculo.
- 06/11/2026: Mejora de diseño y citación de fuentes.
- 06/11/2026: Añadido flujo de subida de foto (IA en chat).
- 09/11/2026: Reescritura como dashboard PWA «Mi Asistencia» (vistas, localStorage, OCR, backups, manifest, service worker, iconos, README).
- 09/11/2026: Carpeta renombrada a `mi-asistencia`; repositorio privado creado y primer push.
- 09/11/2026: Reorganización en `src/css/` y `src/js/` por responsabilidades.
- 09/11/2026: Corrección del OCR con carga de Tesseract.js bajo demanda.
- 09/11/2026: Pruebas añadidas en `tests/` y README profesional.
