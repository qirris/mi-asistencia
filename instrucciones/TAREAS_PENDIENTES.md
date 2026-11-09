# Tareas Pendientes

## Verificación
- [x] Probar la app en un servidor local (`python -m http.server 8080`): todos los recursos responden 200.
- [ ] Comprobar instalación PWA en Chrome/Edge (Application → Manifest y Service Worker).
- [ ] Probar funcionamiento offline tras la primera carga.
- [ ] Revisar diseño en móvil real (sin scroll horizontal, botones táctiles).
- [ ] Probar instalación en Android (Chrome) y en iPhone (Safari).

## Funcionalidad
- [ ] Revisar que añadir/editar/archivar/eliminar asignaturas actualiza el dashboard.
- [ ] Revisar que registrar/eliminar faltas actualiza cálculos e historial.
- [ ] Probar exportación e importación de JSON.
- [ ] Verificar que la migración desde `asistenciaData` conserva los datos antiguos.

## Mejoras opcionales
- [ ] Empaquetar Tesseract.js y modelos de idioma localmente para OCR offline.
- [ ] Añadir filtro por rango de fechas en el historial.
- [ ] Añadir resumen de absentismo (25 h injustificadas/mes) como indicador separado, claramente diferenciado de la evaluación continua.
- [ ] Añadir icono maskable específico con mayor zona de seguridad.
