# AGENTS.md — Mi Asistencia

Punto de entrada del proyecto. Proyecto: web app responsive e instalable (PWA) para controlar faltas y evaluación continua en Andalucía.

### Orden de lectura obligatoria
1. `memoria.md`
2. `instrucciones/INSTRUCCIONES_GENERALES.md`
3. `README.md` (estructura, pruebas y publicación)

### Estado actual
- Dashboard PWA completo con vistas: Inicio, Asignaturas, Faltas, Horario, Historial y Ajustes.
- Datos en `localStorage` con migración segura y copias JSON.
- Código organizado en `src/css/` y `src/js/`; pruebas en `tests/`.
- Repositorio privado: <https://github.com/qirris/mi-asistencia>.
- Pendiente: prueba real de instalación PWA en dispositivo y revisión visual móvil.

### Reglas duras
- El código real manda: si la memoria difiere del código, se corrige la memoria.
- No inventar reglas legales ni umbrales. Citar fuente verificada.
- No usar «Aprobado»/«Suspendido» como resultado de asistencia.
- No guardar secretos en el repositorio.
- Todo cambio importante se registra en `memoria.md`.
