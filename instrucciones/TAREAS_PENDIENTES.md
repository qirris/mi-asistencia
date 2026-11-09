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
- [x] Añadir filtro por rango de fechas en el historial.
- [ ] Añadir resumen de absentismo (25 h injustificadas/mes) como indicador separado, claramente diferenciado de la evaluación continua.
- [ ] Añadir icono maskable específico con mayor zona de seguridad.

## Repositorio
- [x] Repositorio privado `qirris/mi-asistencia` creado y sincronizado en `main`.
- [ ] Publicar en HTTPS para probar la instalación PWA (opcional).

## Futuro (Trabajo futuro planificado — NO implementar todavía)

### 1. Sistema de cuentas opcional (Prioridad: futura)
- [ ] Permitir utilizar Mi Asistencia sin registrarse (Modo local en `localStorage`).
- [ ] Permitir crear una cuenta voluntariamente de forma opcional.
- [ ] Permitir a los usuarios registrados acceder a sus datos desde diferentes dispositivos (Modo con cuenta).
- [ ] Explicar claramente en la interfaz las diferencias entre ambos modos.

### 2. Copias de seguridad avanzadas (Prioridad: futura)
- [ ] Exportar los datos personales a un archivo.
- [ ] Importar una copia de seguridad recuperando asignaturas, horarios, faltas y configuración.
- [ ] Comprobar compatibilidad de copias entre versiones y avisar antes de sobrescribir información.

### 3. Sincronización entre dispositivos (Prioridad: futura)
- [ ] Sincronización segura de datos para usuarios registrados entre ordenador, tablet y móvil sin alterar el modo local.

### 4. Privacidad y protección de datos (Prioridad: futura)
- [ ] Minimizar datos personales solicitados y proteger credenciales con autenticación segura.
- [ ] Permitir eliminar una cuenta y sus datos asociados.
- [ ] Documentar información almacenada y evaluar obligaciones de protección de datos aplicables.

### 5. Arquitectura prevista (Futura)
- [ ] Conservar doble modalidad (aplicación local sin registro y aplicación con cuenta opcional y sincronización) sin obligar a abandonar el modo local ni depender permanentemente de Internet.
