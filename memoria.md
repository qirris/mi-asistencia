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
- La versión publicada hasta el 13/11/2026 conserva el modo local. El usuario ha autorizado preparar cuentas, sincronización y avisos en Cloudflare; requieren conexión y despliegue.

- Apariencia automática/clara/oscura en Ajustes, con preferencia local `salvatucursoTema`, aplicada antes del CSS y sin alterar los datos académicos.
- Colores semánticos compartidos y variantes oscuras para los ocho colores de asignatura y los avisos.
- Formularios con entradas de 16 px en móvil, controles táctiles ampliados y diálogos con contenido desplazable y un único pie de acciones.
- Iconos SVG consistentes en avisos, estados vacíos y acciones; se retiraron los emojis decorativos restantes.

- Inicio se actualiza al cruzar límites horarios o cambiar de fecha, y al recuperar visibilidad, foco o una página desde la caché de navegación. Un único temporizador se alinea con el minuto y se pausa en segundo plano.
- El refresco actúa sobre los bloques temporales, evita reconstruirlos si no cambiaron y conserva los borradores de tareas y de la guía inicial.
- Creación rápida de tareas con título, asignatura y fecha; tipo, prioridad, estado y notas en «Más opciones». La edición y el acceso a notas abren las opciones cuando corresponde, sin perder los campos plegados ni la vinculación con una clase.
- La edición mantiene la asignatura archivada de una tarea existente. Se limpian los errores al abrir un formulario nuevo y el foco empieza en el título.

- Recuperación con «Deshacer» durante diez segundos para tareas, notas y faltas; agrupa borrados consecutivos, pausa con foco/puntero/segundo plano y conserva un diario temporal local (`salvatucursoDeshacer`) para la recarga dentro del plazo.
- La recuperación inserta los registros originales, respeta cambios posteriores, evita duplicados y limpia vínculos con clases que hayan cambiado. Importar, borrar una asignatura y borrar todos los datos descartan el diario pendiente.
- Se conectaron los botones de editar y eliminar faltas del historial y del detalle diario. Al eliminar desde un diálogo se cierra para que «Deshacer» quede accesible.
- Copia de un día del horario a varios destinos mediante un diálogo con resumen y confirmación explícita de casillas ocupadas. Respeta las salidas distintas, omite asignaturas archivadas o huérfanas y mantiene las franjas y los recreos generales.
- No se duplican actividades ni faltas al copiar. Las actividades de clases sustituidas conservan sus datos en «Mis tareas» y pierden sólo el vínculo con la clase que ya no corresponde.
- Cancelar la configuración del horario restaura también la versión persistida. La copia queda desactivada durante la edición y revierte los cambios si no puede guardarlos.
- Caché de la PWA actualizada a `salvatucurso-v39`, incluyendo el calendario, el registro de faltas por día y el módulo de recuperación.
- «Cambiar clase» permite sustituir asignaturas, marcar recreos o vaciar casillas con una selección provisional y guardado explícito. Cancelar, cerrar y Escape conservan los datos anteriores; se protege la edición general abierta y se pueden reparar casillas huérfanas.
- Los cambios de casilla y de vínculos se guardan conjuntamente y se revierten si falla el almacenamiento. Las actividades desvinculadas conservan asignatura, fechas, estado y contenido en «Mis tareas». Se comparte esta limpieza con la copia de días.
- Calendario manual en Ajustes, persistido en `config.calendario = { inicio, fin, noLectivos: [{ id, nombre, inicio, fin }] }`. Fechas del curso opcionales como pareja, intervalos inclusivos y fecha final opcional para días sueltos. Se admiten solapamientos y se confirma la eliminación de periodos.
- Inicio usa una comprobación compartida de día lectivo, salta periodos completos y respeta el comienzo y el final del curso. Mantiene mensajes específicos y acceso directo al calendario sin modificar asistencia, faltas ni fechas de tareas.
- Fechas civiles locales para evitar errores de zona horaria y cambios de hora. La normalización añade un calendario vacío a formatos anteriores sin reiniciar el curso ni su guía inicial.
- La protección frente a cambios de otra pestaña compara con la copia realmente leída del almacenamiento, evitando falsos conflictos al ampliar el formato durante la normalización.
- Los selectores mantienen el foco al elegir una asignatura y lo devuelven al origen al cerrarse; el periodo editado también recupera su botón de origen tras guardar.
- Registro de faltas por día en la sección Faltas, con fecha inicial Hoy, acceso a Ayer, selección provisional de clases completas y tipo/motivo comunes. Se respeta el calendario y la salida por día, se excluyen recreos y se informa de casillas no disponibles.
- Una falta por sesión, conservando `sesion: { inicio, fin }` como campo opcional y `horas = minutos / 60` sin redondear a medias horas. Las duraciones del historial y los registros recientes se expresan en horas/minutos; las entradas manuales admiten valores fraccionarios.
- Las repeticiones exactas se reconocen por fecha, asignatura e intervalo, sin depender del identificador de franja. Las faltas manuales de la misma asignatura/fecha y los intervalos solapados requieren confirmación por clase. Se bloquean sesiones seleccionadas que se solapan entre sí.
- Cambiar fecha, asignatura u horas de una falta automática retira su sesión; modificar únicamente tipo o motivo la conserva. La normalización mantiene sesiones válidas y descarta solo los metadatos inválidos, conservando la falta.
- Los lotes se guardan completos con comprobación de previsualización y almacenamiento vigente. Deshacer se amplió para anular altas durante diez segundos, compatible con los diarios antiguos de borrado y con recarga. Solo retira registros idénticos a los creados; preserva cambios posteriores y revierte el estado si falla el guardado.
- Se corrigió el desbordamiento del historial estrecho permitiendo que las acciones pasen a otra línea, manteniendo el calendario con desplazamiento interno.

## 3. Tecnologías y arquitectura
- HTML5 + CSS3 + JavaScript Vanilla (sin frameworks ni dependencias npm).
- Estructura modular en `src/css/` y `src/js/`:
  - `theme.js`: Resuelve el tema antes de pintar y conserva la preferencia de apariencia por navegador.
  - `calendar.js`: Calendario manual del curso, fechas civiles, exclusiones y formularios de configuración.
  - `absence-day.js`: Sesiones de ausencia, registro por día, revisión de coincidencias y formato de duración.
  - `storage.js`: Persistencia, migración de datos y normalización de estado.
  - `attendance.js`: Etapas educativas, umbrales normativos y cálculos de asistencia.
  - `schedule.js`: Horario escolar semanal, configuración de franjas y resumen de horas.
  - `tasks.js`: Agenda académica, deberes, exámenes, notas y su vinculación con clases.
  - `history.js`: Calendario mensual visual interactivo y registro de ausencias.
  - `recovery.js`: Diario temporal local y recuperación de tareas y faltas borradas.
  - `app.js`: Inicialización global, render y eventos de navegación.
- Nota histórica sobre OCR: inicialmente se evaluó e implementó un prototipo con `Tesseract.js` vía CDN, pero posteriormente se eliminó por completo para priorizar la construcción de un horario escolar semanal interactivo, nativo y conectado directamente a las asignaturas.

## 4. Instrucciones y restricciones
- Idioma por defecto: Español.
- Seguir sistema de memoria (`AGENTS.md`, `instrucciones/`).
- No inventar reglas legales ni umbrales no verificados.
- No usar «Aprobado»/«Suspendido» como resultado del cálculo de asistencia.
- El modo estático mantiene datos locales. El usuario ha autorizado Cloudflare para cuentas, sincronización y recordatorios; no se utiliza Supabase. No activar servicios de pago sin autorización.

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

- `node tests/theme.test.js`: tema automático/manual, recarga, preferencias inválidas, almacenamiento bloqueado, contraste en ambos temas y las 16 variantes de asignatura, estructura de diálogos y recursos precacheados.
- Revisión de las siete vistas en ambos temas a 320, 390, 768 y 1280 px: sin desbordamientos de página. Revisión de diálogos con altura reducida, validación y cierre con Escape con retorno del foco.
- Recarga local con el servidor apagado: se conservaron el tema oscuro y los datos existentes, sin depender de la red.

- `node tests/daily-use.test.js`: cambio de clase, medianoche, foco, visibilidad, recuperación de página, temporizador único, conservación de borradores, valores avanzados plegados, edición y asignatura archivada.
- Prueba de creación y edición en la vista local: formulario de tres campos, validación del título, recuperación de detalles al editar y comprobación en claro/oscuro, móvil estrecho con altura reducida y escritorio.

- `node tests/changes.test.js`: recuperación individual y agrupada, recarga, vencimiento, foco, segundo plano, fallos de almacenamiento, cambios en otra pestaña, reinicio, vínculos de clase, copia múltiple, destinos cortos, sustitución confirmada, tareas conservadas, revisión obsoleta, cancelación persistida y botones del historial.
- Revisión local de la copia y de «Deshacer» a 320, 390, 768 y 1280 px, con altura reducida y temas claro/oscuro; cierre con Escape y retorno del foco. Sin desbordamiento de página en los tamaños comprobados.
- Recarga con el servidor local apagado: las tareas, el tema oscuro, «Deshacer» y el diálogo de copia siguieron funcionando desde la caché.

- `node tests/calendar.test.js`: fechas válidas, años bisiestos, límites incluidos, unión de periodos, vacaciones largas, domingos configurados, cambios de hora, migración del formato anterior, recarga, guardados fallidos, cambios externos y conservación de datos. Incluye selección provisional, cancelación, sustitución, recreo, vaciado y reparación de clases huérfanas.
- Revisión de las dos interfaces nuevas en claro y oscuro a 320, 390, 768 y 1280 px, con altura reducida: sin desbordamiento horizontal, acciones visibles y controles de al menos 44 px. Verificados Escape, navegación por teclado y retorno del foco.
- Recarga con el servidor apagado y caché `salvatucurso-v35`: se conservaron calendario, tema, clases y actividades; se guardaron una clase y un periodo sin conexión, y se mantuvo el salto de vacaciones en Inicio.

- `node tests/absence-day.test.js`: precisión de 20/45/60 minutos, sesiones de la misma asignatura, recreos, salidas distintas, calendario, fechas inválidas/futuras, coincidencias manuales, solapamientos, regeneración de identificadores, selección provisional, guardado repetido, fallos de diario/datos, cambios externos, Deshacer tras recargar, conservación de ediciones posteriores y compatibilidad del diario antiguo.
- Revisión del registro y del historial en ambos temas a 320, 390, 768 y 1280 px: sin desbordamiento de página, acciones visibles y controles de al menos 44 px. Verificados teclado, Escape y retorno del foco al botón de origen.
- Recarga con el servidor local apagado y caché `salvatucurso-v39`: el registro por día, las sesiones y el tema oscuro siguieron disponibles. Se guardó un lote de tres faltas, se recargó y se deshizo, conservando las faltas anteriores.

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
- Almacenamiento local en modo estático (`miAsistenciaState`); sincronización voluntaria con una cuenta de SalvaTuCurso en la versión de Cloudflare.
- No guardar secretos en el repositorio ni dar por activa una función pendiente de configurar.

## 9. Ampliación preparada el 13/11/2026: cuentas, sincronización y avisos

- El usuario eligió notificaciones con la app cerrada, Cloudflare (ya tiene cuenta), datos compartidos entre móvil y ordenador y acceso con Google y correo/contraseña.
- Interfaz de cuenta, registro, recuperación, revisión de versiones y copias JSON en Ajustes. No se suben datos existentes al entrar sin revisión explícita. Se mantienen cursos de cuenta e invitado por separado.
- Sincronización con revisión de concurrencia, guardado local sin conexión y consulta cada 30 segundos con la app visible; conservación de formularios y versiones conflictivas. Vaciar/importar indica el efecto sobre la cuenta.
- Backend Workers + D1, Better Auth 1.7.22 y web-push 3.6.7; dependencias fijadas en package-lock. Migraciones en cloudflare/migrations y preparación pública mediante scripts/build-cloudflare.js. No se copian secretos ni servidor a dist.
- Recordatorios configurables por dispositivo: exámenes 3 días antes, tareas 1 día antes, 18:00 inicialmente; permiso voluntario y prueba. El servidor programa desde el curso guardado, actualiza todos los dispositivos al cambiar una tarea y conserva una referencia para evitar avisos repetidos. Hasta 10 dispositivos por cuenta.
- Caché fuente salvatucurso-v45, recursos de interfaz v43. Se excluyen todas las API privadas, se actualiza por red la configuración pública y se devuelve una respuesta de navegación limpia cuando el alojamiento redirige index.html.
- Pasaron todas las pruebas (existentes y nuevas account/reminders/cloudflare), las migraciones D1 locales y la compilación simulada del Worker. Auditoría de producción sin vulnerabilidades conocidas.
- UI revisada en ambos temas a 320/390/768/1280 y altura 480, con acciones visibles, entradas de 16 px, Escape y foco. Recarga del Worker local apagado conservó el tema y las preferencias.
- PENDIENTE de activación real: autorizar Cloudflare, identificar dominio/remitente, revisar plan, crear D1 remoto, configurar Google, publicar Worker y probar correo y Push reales en móvil. No se han contratado planes, creado recursos remotos ni enviado datos académicos reales.
- Cloudflare Email Sending a destinatarios arbitrarios exige Workers Paid. Se informó al usuario: base de Workers desde 5 USD/mes, sin activar pagos. No respondió todavía si dispone de dominio propio.
- La primera propuesta con Supabase se descartó al elegir Cloudflare. No conectar ni pedir Supabase.
- Detalles y procedimiento: docs/notificaciones.md.

## 10. Conexión de Cloudflare y despliegue del 14/11/2026

- Autorización de Cloudflare completada y confirmada. Las credenciales se guardan cifradas con clave en Windows Credential Manager. Para usarlas desde este entorno, los comandos autorizados necesitan acceso al almacén de Windows; una comprobación restringida puede indicar que no hay sesión aunque sí esté guardada. No repetir el acceso por ese mensaje sin comprobarlo correctamente.
- El permiso genérico workers:write no permitió publicar. Se renovó la autorización con account:read, user:read, workers_scripts:write, d1:write y offline_access; el usuario pulsó Authorize. Se retiraron los permisos de correo y dominios, innecesarios para esta entrega.
- D1 remoto salvatucurso creado con jurisdiction=eu, identificador 6fb9da5f-c13f-47c2-b395-9d087c5ba9ff. Ambas migraciones aplicadas. Comprobación posterior: cero cuentas, cursos y dispositivos; no se subieron datos académicos del usuario.
- Worker y cron publicados en https://salvatucurso.qirris.workers.dev. APP_ORIGIN coincide con esa dirección confirmada por la API; no usar el subdominio distinto que mostraba inicialmente el panel.
- BETTER_AUTH_SECRET y la pareja VAPID de producción, con VAPID_SUBJECT, guardados como secretos del Worker. Claves privadas generadas en memoria, sin archivos ni salida pública. No regenerarlas al desplegar de nuevo.
- El usuario confirmó que no tiene dominio y eligió mantener el plan gratuito y activar primero Google. Se aplazó correo/contraseña; AUTH_EMAIL_ENABLED=false y sin binding EMAIL. No se contrató ningún plan ni se activó facturación.
- La configuración pública anuncia el acceso solo cuando existe un proveedor y un secreto de sesión válido. Añadida prueba; npm test completo pasó. Comprobaciones remotas: configuración pública sin secretos, sesión nula, curso sin sesión 401 y otro origen 403.
- Proyecto Google SalvaTuCurso (qirris-salvatucurso) creado después de que el usuario autorizase expresamente su creación sin facturación. Preparados nombre, público externo y correo de asistencia/contacto; el usuario debe revisar ese correo y aceptar la política de datos de Google para finalizar la identidad de la app. No se aceptó la política en su nombre.
- La identidad de Google se creó después de que el usuario aceptase la política de datos y el correo de asistencia. Se creó un primer cliente web; al fallar su descarga en el navegador, se conectaron las credenciales visibles sin mostrarlas y se retiró el archivo temporal privado tras guardarlas.
- Después el usuario proporcionó un JSON de otro cliente del mismo proyecto, con origen y devolución correctos. Se validó y se guardaron esas credenciales como secretos de Cloudflare, sustituyendo únicamente GOOGLE_CLIENT_ID/GOOGLE_CLIENT_SECRET, sin cambiar las claves de sesión ni VAPID. No guardar ni publicar el archivo aportado, su nombre completo o su contenido.
- La API remota confirma Google activo, correo desactivado, cliente y devolución correctos y permisos exclusivamente email/profile/openid. Google sigue en modo Prueba, sin usuarios de prueba; el botón Publicar app aparece desactivado e indica completar la marca. Pendiente revisar esa configuración y comprobar acceso real, sincronización y Push; no darlos por probados.
- GitHub Pages sigue disponible con copias JSON; no redirigir ni borrar sus datos antes del traslado revisado por el usuario.
- El usuario autorizó expresamente añadir su propia cuenta como usuario de prueba de Google. Se guardó y se comprobó en la lista. Después revisó el consentimiento de Google y pulsó Continuar: la app volvió con su cuenta y «Curso sincronizado». D1 remoto confirmó una cuenta, un curso y cero dispositivos. La sesión y el curso se conservaron al recargar.
- Se corrigió un estado obsoleto del panel de avisos: al cambiar la cuenta o terminar su sincronización, se refresca también TaskReminders.renderSettings, conservando sus borradores. En el modo solo Google se ocultan los campos y acciones de correo, y el foco comienza en Google. Añadidas pruebas de disponibilidad tras sincronizar/salir y del acceso solo Google; npm test completo pasó.
- Caché actual salvatucurso-v46; account.js?v=44 y resto de recursos v43. Corrección publicada en Cloudflare (versión 6aa09ac0-dc18-4109-b155-8d0f7ec3b0e8). UI tras recargar: cuenta sincronizada y botón «Activar notificaciones» disponible.
- Sigue pendiente el traslado revisado desde GitHub Pages, la comprobación en móvil y ordenador y una entrega Push real con la app cerrada. Google sigue en modo Prueba; no afirmar que pueden registrarse otras cuentas. El panel de Google exige completar la marca antes de publicar; página principal y política de privacidad aún vacías. No se publicó Google para todos ni se aceptaron más acuerdos.
