# AGENTS.md — SalvaTuCurso

Punto de entrada del proyecto. Proyecto: web app responsive e instalable (PWA) para controlar faltas y evaluación continua en Andalucía.

### Orden de lectura obligatoria
1. `memoria.md`
2. `instrucciones/INSTRUCCIONES_GENERALES.md`
3. `README.md` (estructura, pruebas y publicación)

### Estado actual
- PWA con Inicio, Asignaturas, Faltas, Horario, Mis tareas, Historial y Ajustes.
- Inicio prioriza la próxima clase y la entrega más cercana; tareas y horario tienen resúmenes compactos y existe una guía opcional de tres pasos.
- Temas automático/claro/oscuro, variables de color semánticas e iconos SVG. La apariencia se guarda por separado con `salvatucursoTema`.
- Formularios y diálogos adaptados a pantallas estrechas y con poca altura.
- Refresco temporal de Inicio al cambiar de clase, fecha o volver a la app, con pausa en segundo plano y sin reiniciar borradores.
- Creación rápida de tareas con tres campos y «Más opciones» para conservar los detalles adicionales.
- Borrado recuperable de tareas y faltas con «Deshacer» durante diez segundos; aviso y recuperación local tras recargar dentro del plazo.
- Copia de un día del horario a varios destinos, con revisión y confirmación al sustituir casillas ocupadas; conserva las actividades sin duplicarlas.
- Datos en `localStorage` con migración segura y copias JSON.
- Código organizado en `src/css/` y `src/js/`; pruebas en `tests/`.
- Repositorio: <https://github.com/qirris/mi-asistencia>.
- Publicación estática en GitHub Pages autorizada por el usuario; los datos académicos permanecen en el navegador.
- Pendiente: prueba real de instalación PWA en dispositivo. La interfaz se revisó en móvil estrecho y escritorio.

### Reglas duras
- El código real manda: si la memoria difiere del código, se corrige la memoria.
- No inventar reglas legales ni umbrales. Citar fuente verificada.
- No usar «Aprobado»/«Suspendido» como resultado de asistencia.
- No guardar secretos en el repositorio.
- Todo cambio importante se registra en `memoria.md`.
