# SalvaTuCurso

Web app responsive e instalable (PWA) para que estudiantes de Andalucía controlen sus faltas y su situación respecto a la evaluación continua en ESO, Bachillerato y Formación Profesional.

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

## Apariencia y formularios

En **Ajustes → Apariencia** puedes elegir **Automático, Claro u Oscuro**. La opción automática sigue el dispositivo y la elección manual se conserva en este navegador mediante `salvatucursoTema`, separada de los datos académicos. El tema se aplica antes del CSS y también funciona sin conexión.

La paleta de asignaturas y los avisos tienen variantes para cada tema. Los diálogos mantienen la cabecera y las acciones visibles mientras se desplazan los campos. Los iconos son SVG locales, sin fuentes ni dependencias externas.

## Tecnologías y Arquitectura

- HTML5, CSS3 y JavaScript Vanilla (sin frameworks ni dependencias externas).
- Almacenamiento local mediante `localStorage` (clave: `miAsistenciaState`).
- Service Worker y Web App Manifest para funcionamiento como PWA instalable.
- Organización modular por responsabilidades en `src/css/` y `src/js/`.
- Sin procesos de compilación ni dependencias npm.

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
       ├── attendance.js       # Etapas y cálculos de asistencia
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

Desde la raíz del proyecto:
```bash
node tests/attendance.test.js   # cálculos FP/ESO, asistencia global y render
node tests/check-ids.js         # consistencia de IDs entre HTML y JS
node tests/theme.test.js        # tema, contraste, diálogos y recursos offline
node tests/daily-use.test.js    # reloj, reanudación, borradores y tareas rápidas
node tests/changes.test.js      # deshacer, copia de días y conservación de datos
```

Verificación de sintaxis de los módulos:
```bash
node --check src/js/app.js
node --check src/js/storage.js
node --check src/js/schedule.js
node --check src/js/tasks.js
node --check src/js/history.js
node --check src/js/recovery.js
node --check src/js/attendance.js
```

---

## Privacidad y almacenamiento local

- Todos los datos se guardan **exclusivamente en el dispositivo y navegador** mediante `localStorage` (`miAsistenciaState`).
- **No hay servidores, cuentas de usuario, analítica ni sincronización en la nube.**
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
