# Memoria del proyecto: SalvaTuCurso

Archivo de memoria persistente. Actualízalo tras cada avance importante.
Regla: NO guardar aquí contraseñas, tokens ni ningún secreto.

## 1. Objetivo y alcance
Web app responsive e instalable (PWA) para estudiantes de Andalucía que permite configurar asignaturas, registrar faltas, consultar el horario escolar semanal, gestionar la agenda académica (tareas y notas) y visualizar el riesgo respecto a la evaluación continua. Idiomas: español. Carácter informativo: no sustituye al centro ni a la normativa oficial.

## 2. Estado actual
- Se retiraron del panel la fórmula técnica y la nota normativa bajo el formulario de faltas; las fuentes legales siguen en los ajustes y la documentación.
- La interfaz ahora indica que el acceso con cuenta aún no está activo y que los datos permanecen en el navegador.
- Aplicación completada con rediseño visual moderno y profesional (estética inspirada en Notion, Linear y Apple).
- Vistas principales: Dashboard (Inicio), Asignaturas, Faltas, Mi horario, Mis tareas, Historial y Ajustes.
- PWA: manifest, service worker con caché del app shell, iconos 192/512 e instalación.
- Datos 100% locales en `localStorage` (clave `miAsistenciaState`) con migración segura y copias JSON.
- La aplicación se publica como sitio estático en GitHub Pages; los datos académicos permanecen en el navegador.
- Identidad SalvaTuCurso: símbolo de asistencia, birrete, lema «Tus faltas, horario y tareas» y paleta azul marino, coral y turquesa.
- Tareas y horario muestran resúmenes compactos; los filtros de tareas se despliegan cuando se necesitan.
- Inicio prioriza la clase actual o siguiente y la entrega más cercana, con acceso a registrar faltas. Las clases de la semana siguiente incluyen fecha.
- Guía opcional de tres pasos (etapa, asignaturas y horario), con progreso persistente y reconocimiento de datos existentes. Sin datos se evitan estadísticas vacías y clases sin asignatura.
- Se mantienen las cuentas y la sincronización fuera de esta entrega.

## 3. Tecnologías y arquitectura
- HTML5 + CSS3 + JavaScript Vanilla (sin frameworks ni dependencias npm).
- Estructura modular en `src/css/` y `src/js/`:
  - `storage.js`: Persistencia, migración de datos y normalización de estado.
  - `attendance.js`: Etapas educativas, umbrales normativos y cálculos de asistencia.
  - `schedule.js`: Horario escolar semanal, configuración de franjas y resumen de horas.
  - `tasks.js`: Agenda académica, deberes, exámenes, notas y su vinculación con clases.
  - `history.js`: Calendario mensual visual interactivo y registro de ausencias.
  - `app.js`: Inicialización global, render y eventos de navegación.
- Nota histórica sobre OCR: inicialmente se evaluó e implementó un prototipo con `Tesseract.js` vía CDN, pero posteriormente se eliminó por completo para priorizar la construcción de un horario escolar semanal interactivo, nativo y conectado directamente a las asignaturas.

## 4. Instrucciones y restricciones
- Idioma por defecto: Español.
- Seguir sistema de memoria (`AGENTS.md`, `instrucciones/`).
- No inventar reglas legales ni umbrales no verificados.
- No usar «Aprobado»/«Suspendido» como resultado del cálculo de asistencia.
- Los datos se mantienen en el navegador; no se incorporan bases de datos remotas, Firebase, Supabase ni cuentas de usuario.

## 5. Funcionalidades implementadas
- Selector de etapa: ESO, Bachillerato, FP Básico/Medio/Superior.
- Gestión avanzada de asignaturas con colores pastel e interfaz desplegable.
- Horario escolar tradicional semanal con celdas interactivas y panel de edición oculto.
- Agenda académica integrada con pestañas, filtros y tarjetas por prioridad/fecha.
- Historial con calendario mensual visual, indicadores diarios y modales de detalle.
- Dashboard completo con saludo en español, estadísticas con cifras tabulares y alertas en tiempo real.
- Copias de seguridad locales (Exportar/Importar JSON) y borrado seguro con confirmación.
- Instalación PWA y soporte offline.
- En móvil, navegación inferior con Inicio, Mis tareas, Horario, Faltas y Más (Asignaturas, Historial y Ajustes).
- Zoom bloqueado por defecto en móvil, con opción para permitirlo en Ajustes; la preferencia se conserva en el navegador.

## 6. Pruebas verificadas
- Validación sintáctica mediante `node --check` en todos los módulos JS y service worker.
- `node tests/check-ids.js`: Todos los IDs utilizados en JavaScript existen en el DOM de `index.html` (100% de consistencia).
- `node tests/attendance.test.js`: Pruebas de cálculo de asistencia FP/ESO, asistencia global ponderada, manejo de umbrales y normalización.
- Pruebas de persistencia en `localStorage`.

## 7. Convención de commits acordada
Para mantener una identidad profesional y seria, los mensajes de commit futuros seguirán rigurosamente esta estructura en español con prefijos normalizados:
- `funcionalidad:`
- `corrección:`
- `documentación:`
- `mantenimiento:`
- `pruebas:`
- `seguridad:`
- `rendimiento:`
*(Ejemplo: `funcionalidad: incorporar la gestión de asignaturas y el registro de asistencia`)*

## 8. Restricciones permanentes del proyecto
- Publicación estática en GitHub Pages autorizada por el usuario; los datos académicos siguen siendo locales.
- Almacenamiento exclusivo en el navegador mediante `localStorage` (`miAsistenciaState`).
- Sin servidores, bases de datos remotas ni cuentas de usuario.
