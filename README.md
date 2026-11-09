# Mi Asistencia

Web app responsive e instalable (PWA) para que estudiantes de Andalucía controlen sus faltas y su situación respecto a la evaluación continua en ESO, Bachillerato y Formación Profesional.

> Herramienta informativa. No sustituye al centro educativo ni a la normativa oficial.

---

## Funcionalidades

- **Dashboard** con asignaturas registradas, horas planificadas, asistencia global ponderada por horas y asignaturas que requieren atención.
- **Gestión de asignaturas**: alta, edición, archivado y eliminación con confirmación. Cálculo automático de horas planificadas (horas/semana × semanas), corregible manualmente. Sin duplicados.
- **Registro de faltas**: asignatura, fecha, horas, tipo (justificada / no justificada) y motivo opcional. Edición y eliminación con recálculo inmediato.
- **Historial** con filtros por asignatura, tipo y rango de fechas.
- **Horario escolar semanal interactivo**: cuadrícula tradicional (lunes–viernes, franjas horarias configurables, entrada/salida, recreos y días independientes), conectado directamente a las asignaturas (nombre, horas y colores pastel). Cálculo automático del resumen semanal de horas. Diseño responsive con pestañas y vista vertical en móviles.
- **Cálculos informativos** con fórmula visible, datos utilizados y límite aplicado.
- **PWA**: manifest, service worker con caché del *app shell*, iconos 192/512 e instalación en móvil.
- **Datos locales**: `localStorage`, exportación/importación JSON con validación y borrado total con doble confirmación.

---

## Tecnologías

- HTML5, CSS3 y JavaScript Vanilla (sin frameworks ni backend).
- `localStorage` para la persistencia.
- Service Worker + Web App Manifest para la PWA.
- Sin dependencias npm ni proceso de compilación.

---

## Estructura del proyecto

```
mi-asistencia/
├── index.html                  # Estructura de la interfaz y vistas
├── manifest.webmanifest        # Manifiesto de la PWA
├── service-worker.js           # Caché del app shell y funcionamiento offline
├── README.md
├── .gitignore
├── .gitattributes
├── assets/
│   └── icons/
│       ├── icon-192.png
│       └── icon-512.png
├── docs/
│   └── referencia-normativa-evaluacion-continua-andalucia.txt
├── src/
│   ├── css/
│   │   └── styles.css          # Diseño mobile-first y responsive
│   └── js/
│       ├── attendance.js       # Etapas y cálculos de asistencia
│       ├── storage.js          # Persistencia, migración y normalización
│       ├── schedule.js         # Horario escolar, franjas y resumen de horas
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
node tests/check-ids.js         # todos los IDs del JS existen en el HTML
```

Comprobaciones adicionales de sintaxis:

```bash
node --check src/js/app.js
node --check src/js/attendance.js
node --check src/js/storage.js
node --check src/js/schedule.js
node --check service-worker.js
```

Las pruebas usan un DOM simulado y no requieren navegador ni dependencias externas.

---

## Instalación como PWA

### Android (Chrome / Edge / Samsung Internet)

1. Abre la web publicada en HTTPS (o en `localhost`).
2. Pulsa **«Instalar app»** o usa el menú del navegador → **«Instalar aplicación»**.
3. Confirma la instalación.

### iPhone / iPad (Safari)

1. Abre la web en **Safari**.
2. Pulsa **Compartir**.
3. Elige **«Añadir a pantalla de inicio»** y confirma.

> En iOS no existe `beforeinstallprompt`; por eso la app muestra instrucciones específicas.

### Publicación en HTTPS

Cualquier alojamiento estático gratuito sirve: GitHub Pages, Netlify, Vercel o Cloudflare Pages. Mantén las rutas relativas (`./`) y comprueba que `manifest.webmanifest`, `service-worker.js` y `assets/icons/` cargan correctamente.

> La instalación como PWA **no** genera un APK/IPA ni publica en Google Play o App Store.

---

## Datos, privacidad y copias de seguridad

- Todos los datos se guardan **solo en el navegador y dispositivo** donde usas la app.
- Clave de almacenamiento: `miAsistenciaState`.
- **No hay servidores, cuentas, analítica ni sincronización** entre dispositivos.
- Si borras los datos del navegador, se pierden las asignaturas y faltas.
- Usa **Ajustes → Exportar JSON** periódicamente como copia de seguridad.
- La importación valida la estructura, pide confirmación y guarda una copia del estado anterior.
- **Ajustes → Borrar todos los datos** elimina todo con doble confirmación.

No se incluyen datos reales de estudiantes en el repositorio, las pruebas ni la documentación.

---

## Cálculos y normativa

Fórmula aplicada:

```
Asistencia (%) = (horas asistidas ÷ horas planificadas) × 100
```

- **FP presencial**: mínimo del **80 % de asistencia** (20 % de ausencia). Fuente: Orden de 18/09/2025, art. 2.4.
- **ESO / Bachillerato**: no existe un porcentaje autonómico único. El límite lo fija el **Plan de Convivencia** del centro (Decreto 327/2010, art. 34.3). La app permite configurarlo en porcentaje o en horas.
- Los estados son informativos: **«Sin riesgo»**, **«Cerca del límite»**, **«Límite superado»** y **«Falta criterio del centro»**. Nunca se muestra «Aprobado» ni «Suspendido».
- El absentismo escolar se mantiene separado de la evaluación continua.

La referencia normativa utilizada está en [`docs/referencia-normativa-evaluacion-continua-andalucia.txt`](docs/referencia-normativa-evaluacion-continua-andalucia.txt).

---

## Limitaciones conocidas

- **Almacenamiento local**: los datos no se sincronizan entre dispositivos ni se conservan si se limpia el navegador.
- **Cálculos**: son orientativos y dependen de los datos introducidos por el usuario. No emiten una resolución oficial.
- **Instalación**: la prueba real de instalación y el funcionamiento offline deben verificarse en cada navegador/dispositivo tras publicar.
- No se ha desarrollado una app nativa ni se ha publicado en tiendas.

---

## Estado del proyecto

- Aplicación completa y funcional en local.
- Repositorio privado: <https://github.com/qirris/mi-asistencia>
- Últimas comprobaciones: sintaxis de todos los módulos, consistencia de IDs y pruebas de cálculo/render.
- Pendiente: revisión visual en dispositivos reales y verificación de instalación PWA tras publicar.

---

## Historial de hitos

- Versión inicial del dashboard, faltas y PWA.
- Reorganización de estilos y scripts por responsabilidades.
- Corrección de la carga de Tesseract.js bajo demanda.
- Añadidas pruebas de cálculo y consistencia.
- Documentación del proyecto y de la estructura.
