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
- Edición de clases ocupadas con selección provisional, guardado explícito y conservación de actividades en «Mis tareas» al desvincularlas.
- Calendario manual en Ajustes: fechas del curso y días o periodos sin clase. Inicio comparte sus reglas y salta vacaciones largas.
- Registro de faltas por día desde el horario: clases completas, minutos precisos, revisión de coincidencias y Deshacer del último lote.
- Datos en `localStorage` con migración segura y copias JSON.
- Código organizado en `src/css/` y `src/js/`; pruebas en `tests/`.
- Repositorio: <https://github.com/qirris/salvatucurso>. Se conserva el historial; mantener libre el nombre anterior mi-asistencia para conservar la redirección de GitHub.
- GitHub Pages desactivado el 14/11/2026 con rama de publicación None. Cloudflare es la única web publicada. No reactivar Pages al guardar cambios.
- Cloudflare y Google conectados: Worker publicado en https://salvatucurso.qirris.workers.dev y D1 de la UE con migraciones aplicadas. Claves de producción guardadas como secretos. Acceso real, primer guardado y notificación programada recibida con la app cerrada verificados con el usuario. Google está en producción para cualquier cuenta externa, con página principal y política de privacidad públicas; solicita solo `openid`, `email` y `profile`. La versión antigua estaba vacía y no requirió traslado. Queda pendiente comprobar los contenidos del curso en dos dispositivos. Consultar docs/notificaciones.md antes de activar o desplegar. No se utiliza Supabase.
- El usuario eligió el 14/11/2026 mantener el plan gratuito y activar primero Google; no tiene dominio propio. Correo/contraseña aplazados. No contratar planes ni habilitar correo.
- npm test incluye las pruebas de cuentas y backend, además de las anteriores. Las claves locales y dist se excluyen con .gitignore.
- Pendiente: prueba real de instalación PWA en dispositivo. La interfaz se revisó en móvil estrecho y escritorio.

### Reglas duras
- El código real manda: si la memoria difiere del código, se corrige la memoria.
- No inventar reglas legales ni umbrales. Citar fuente verificada.
- No usar «Aprobado»/«Suspendido» como resultado de asistencia.
- No guardar secretos en el repositorio.
- Todo cambio importante se registra en `memoria.md`.


