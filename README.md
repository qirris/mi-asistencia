# SalvaTuCurso

Web app responsive e instalable (PWA) para que estudiantes de Andalucía controlen sus faltas y su situación respecto a la evaluación continua en ESO, Bachillerato y Formación Profesional.

> **Cloudflare, Google y avisos verificados:** [versión publicada en Cloudflare](https://salvatucurso.qirris.workers.dev), con acceso real, primer guardado del curso y una notificación programada recibida en el móvil con la app cerrada. Google sigue en modo Prueba para la cuenta autorizada; el acceso general está pendiente. El usuario eligió mantener el plan gratuito y aplazar correo/contraseña. Los datos anteriores de GitHub Pages requieren exportar e importar una copia. [Configuración, pruebas y límites](docs/notificaciones.md).

> Herramienta informativa. No sustituye al centro educativo ni a la normativa oficial.

---

## Funcionalidades y Secciones

SalvaTuCurso se organiza en seis secciones principales con una interfaz moderna, elegante y coherente:

1. **Dashboard (Inicio)**: Resumen general de la actividad académica con saludo dinámico, fecha actual, resumen compacto, próxima clase y entrega más cercana, alertas de asistencia y de tareas urgentes, listado de clases del día en curso y resumen global de asistencia.
2. **Asignaturas**: Gestión de materias con formulario desplegable, previsualización en tiempo real, selector de color pastel y cálculo automático de horas planificadas.
3. **Mi horario**: Cuadrícula escolar semanal tradicional (lunes a viernes) interactiva. Resumen compacto y vista por días en móvil. Panel de configuración general y franjas oculto por defecto para priorizar la visualización de la semana. Edición rápida de casillas, recreos discretos y resumen de horas semanales.
4. **Mis tareas**: Agenda académica completa para deberes, exámenes, trabajos y notas personales. Los filtros se despliegan bajo demanda y las estadísticas ocupan una sola franja. Incluye pestañas de estado (*Pendientes, Completadas, Todas*), filtros avanzados, prioridad, fechas relativas e integración exacta con las clases de origen del horario.
5. **Historial**: Calendario mensual visual e interactivo con indicadores diarios de ausencia, estadísticas superiores y lista cronológica filtrable de ausencias.
6. **Ajustes**: Configuración de la etapa educativa, criterios del centro (ESO/Bachillerato), copias de seguridad JSON, información de privacidad (almacenamiento 100% local), instalación PWA, referencias normativas oficiales y acciones avanzadas.

---

## Primeros pasos

La guía opcional de Inicio permite elegir la etapa, añadir asignaturas y colocar la primera clase. Conserva el progreso al recargar, permite continuar después y se puede reabrir desde Ajustes. Los cursos existentes mantienen sus datos y no repiten los pasos ya completados.

## Uso diario

Inicio actualiza la fecha, la clase actual o siguiente y los avisos al cambiar de minuto cuando es necesario y al volver a la aplicación. El temporizador se detiene mientras la página está oculta y las actualizaciones no reinician los formularios.

Al crear una tarea se muestran título, asignatura y fecha de entrega. **Más opciones** reúne tipo, prioridad, estado y notas. Al editar una actividad con detalles adicionales, este apartado se abre automáticamente y conserva sus valores aunque se guarde plegado.

Al eliminar tareas, notas o faltas aparece **Deshacer** durante diez segundos. Los borrados seguidos se agrupan; el plazo se pausa mientras el aviso tiene el foco, el puntero encima o la app está oculta. También puedes recuperar al recargar dentro del plazo. La recuperación temporal usa `salvatucursoDeshacer`, separada de los datos académicos, y se descarta al importar, borrar una asignatura o reiniciar el curso.

En **Horario → Copiar día** elige un origen y uno o varios destinos. El resumen indica las casillas que cambiarán y solicita confirmación si ya estaban ocupadas. Se copian las clases y los huecos de las franjas compartidas, respetando la salida de cada día y omitiendo las asignaturas archivadas o eliminadas. No se duplican tareas ni faltas. Si una clase se sustituye, sus actividades se conservan en **Mis tareas** con su asignatura y detalles, sin un enlace incorrecto a la nueva clase.

## Horario y calendario

### Registrar las faltas de un día

En **Faltas → Registrar faltas de un día** elige hoy o una fecha pasada; **Ayer** permite ir al día anterior. Marca las clases perdidas o usa **Seleccionar todas**, elige un tipo común y añade un motivo opcional. El resumen muestra clases y duración total antes de guardar.

Se registran clases completas, una falta por sesión, calculando los minutos reales del horario. Los recreos y las franjas que no caben antes de la salida quedan fuera. La pantalla avisa de asignaturas sin colocar, archivadas o eliminadas. El calendario del curso determina los días disponibles; para excepciones y faltas parciales se mantiene el formulario manual.

La consulta usa **el horario actual**, porque no existe un histórico de horarios. Las faltas nuevas conservan su intervalo en el campo opcional `sesion: { inicio, fin }`, aunque después cambies o regeneres las franjas. Las repeticiones exactas aparecen como **Ya registrada** y no se pueden seleccionar. Ante faltas manuales o intervalos solapados, se muestran los registros existentes y se exige revisar cada clase antes de añadirla.

Después de guardar, **Deshacer** permite retirar el último lote durante diez segundos, también tras recargar dentro del plazo. Conserva las faltas anteriores y cualquier registro del lote que hayas modificado después. Un fallo de guardado conserva el estado anterior. Al editar una falta automática, cambiar fecha, asignatura u horas retira su identificación de sesión; cambiar solo motivo o justificación la mantiene.

### Cambiar una clase

Toca una clase del horario y pulsa **Cambiar clase**. Elige otra asignatura activa, **Marcar recreo** o **Dejar vacía**, y confirma con **Guardar clase**. Cancelar, cerrar o pulsar Escape descartan la selección provisional.

El selector indica cuántas actividades quedarán desvinculadas. Se conservan en **Mis tareas** con su asignatura original, fecha, estado y detalles. Mantener la misma asignatura conserva sus vínculos. Las casillas con asignaturas eliminadas también se pueden reparar. Guarda o cancela primero la configuración general del horario si está abierta.

### Calendario del curso

En **Ajustes → Calendario del curso** puedes indicar inicio y fin del curso: ambos días se incluyen. Completa las dos fechas o deja ambas vacías para seguir utilizando el horario semanal sin límites de curso.

En **Días sin clase** puedes añadir, editar y eliminar festivos o periodos de vacaciones. La fecha final es opcional para días sueltos y los periodos solapados se consideran una unión de días excluidos. La eliminación solicita confirmación.

Inicio omite esos días al mostrar las clases de hoy y buscar la próxima clase, incluso durante vacaciones de varias semanas. Antes y después del curso muestra el mensaje correspondiente, con acceso al calendario. El horario semanal sigue disponible para editarlo.

El calendario es manual y se guarda con los datos académicos en `config.calendario`. No cambia las horas planificadas, los porcentajes de asistencia, las faltas ni las fechas de entrega. Los cursos existentes empiezan sin fechas ni exclusiones y conservan sus datos.

## Apariencia y formularios

En **Ajustes → Apariencia** puedes elegir **Automático, Claro u Oscuro**. La opción automática sigue el dispositivo y la elección manual se conserva en este navegador mediante `salvatucursoTema`, separada de los datos académicos. El tema se aplica antes del CSS y también funciona sin conexión.

La paleta de asignaturas y los avisos tienen variantes para cada tema. Los diálogos mantienen la cabecera y las acciones visibles mientras se desplazan los campos. Los iconos son SVG locales, sin fuentes ni dependencias externas.

## Tecnologías y Arquitectura

- Interfaz HTML5, CSS3 y JavaScript Vanilla; servidor opcional Cloudflare Workers + D1 con Better Auth y Web Push.
- Almacenamiento local mediante `localStorage` (clave: `miAsistenciaState`).
- Service Worker y Web App Manifest para funcionamiento como PWA instalable.
- Organización modular por responsabilidades en `src/css/` y `src/js/`.
- La interfaz estática puede abrirse sin npm. Para cuentas y avisos, npm prepara los recursos públicos y Wrangler compila el Worker.

---

## Estructura del proyecto

```
mi-asistencia/
├── index.html                  # Estructura de la interfaz y vistas
├── manifest.webmanifest        # Manifiesto de la PWA
├── service-worker.js           # Caché del app shell y funcionamiento offline
├── README.md
├── AGENTS.md
├── memoria.md
├── .gitignore
├── .gitattributes
├── assets/
│   └── icons/
│       ├── icon-192.png
│       └── icon-512.png
├── docs/
│   └── referencia-normativa-evaluacion-continua-andalucia.txt
├── instrucciones/
│   ├── INSTRUCCIONES_GENERALES.md
│   └── TAREAS_PENDIENTES.md
├── src/
│   ├── css/
│   │   └── styles.css          # Sistema de diseño unificado y moderno
│   └── js/
│       ├── theme.js            # Apariencia automática y preferencia local
│       ├── calendar.js         # Calendario manual, fechas locales y periodos sin clase
│       ├── absence-day.js      # Registro por día, sesiones, coincidencias y duraciones
│       ├── attendance.js       # Etapas y cálculos de asistencia
│       ├── storage.js          # Persistencia, migración y normalización
│       ├── schedule.js         # Horario escolar, franjas y resumen de horas
│       ├── tasks.js            # Agenda académica y tareas
│       ├── history.js          # Calendario y historial de ausencias
│       ├── recovery.js         # Recuperación breve de tareas y faltas borradas
│       └── app.js              # Render, eventos e inicialización
└── tests/
    ├── attendance.test.js      # Pruebas de cálculos y render
    └── check-ids.js            # Consistencia entre HTML y JavaScript
```

---

## Puesta en marcha local

### Opción A — Abrir el archivo directamente
Haz doble clic en `index.html`.
> Sirve para revisar la interfaz y los cálculos, pero **no** para probar la PWA: el service worker y la instalación no funcionan desde `file://`.

### Opción B — Servidor local (recomendado)
```bash
# Con Python
python -m http.server 8080

# Con Node.js
npx serve .
```
Abre `http://localhost:8080` en el navegador.

---

## Pruebas

Para todas las pruebas, incluidas cuentas y Cloudflare: `npm ci --ignore-scripts` y `npm test`. La integración se ejecuta localmente, sin enviar correos ni avisos reales.

Desde la raíz del proyecto:
```bash
node tests/attendance.test.js   # cálculos FP/ESO, asistencia global y render
node tests/check-ids.js         # consistencia de IDs entre HTML y JS
node tests/theme.test.js        # tema, contraste, diálogos y recursos offline
node tests/daily-use.test.js    # reloj, reanudación, borradores y tareas rápidas
node tests/changes.test.js      # deshacer, copia de días y conservación de datos
node tests/calendar.test.js     # calendario manual, vacaciones y edición de clases
node tests/absence-day.test.js  # lotes de faltas, coincidencias, precisión y Deshacer
```

Verificación de sintaxis de los módulos:
```bash
node --check src/js/app.js
node --check src/js/storage.js
node --check src/js/calendar.js
node --check src/js/absence-day.js
node --check src/js/schedule.js
node --check src/js/tasks.js
node --check src/js/history.js
node --check src/js/recovery.js
node --check src/js/attendance.js
```

---

## Privacidad y almacenamiento local

- En la versión estática, los datos se guardan **en el dispositivo y navegador** mediante `localStorage` (`miAsistenciaState`).
- La versión con cuentas preparada para Cloudflare necesita conectar y desplegar el servicio antes de compartir datos. Se explica qué se guarda y cuándo en [la documentación](docs/notificaciones.md).
- Usa **Ajustes → Exportar JSON** para realizar copias de seguridad de tus datos.

---

## Normativa y cálculos

Fórmula aplicada:
```
Asistencia (%) = (horas asistidas ÷ horas planificadas) × 100
```
- **FP presencial**: mínimo del **80 % de asistencia** (20 % de ausencia). Fuente: Orden de 18/09/2025, art. 2.4.
- **ESO / Bachillerato**: el límite lo fija el **Plan de Convivencia** del centro (Decreto 327/2010, art. 34.3).
- Estados informativos: **«Sin riesgo»**, **«Cerca del límite»**, **«Límite superado»** y **«Falta criterio del centro»**. Nunca se muestra «Aprobado» ni «Suspendido».
