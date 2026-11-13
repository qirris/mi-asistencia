# Cuentas, sincronización y avisos en Cloudflare

## Estado

El código está preparado y probado localmente. **El servicio de Cloudflare todavía no está conectado y las notificaciones reales no están activadas.** La versión estática de GitHub Pages conserva los datos en el navegador y muestra el estado pendiente. No se han creado recursos remotos, configurado credenciales de Google, contratado planes ni enviado datos académicos reales.

La elección del usuario es Cloudflare, acceso con Google y correo/contraseña, sincronización entre móvil y ordenador y avisos con la app cerrada.

## Arquitectura

- Interfaz existente en HTML/CSS/JS, conservando calendario, horario, tareas, faltas, temas y PWA.
- Worker con recursos estáticos y API en el mismo origen: evita depender de cookies de terceros en Safari. La versión con cuentas se abrirá desde su dirección de Cloudflare.
- D1 guarda usuarios, sesiones, curso, cinco copias recientes y recordatorios. Better Auth 1.7.22 gestiona Google, contraseñas, verificación y recuperación. No se implementan algoritmos de contraseñas propios.
- Las sesiones usan cookies de Better Auth. No se guardan contraseñas ni tokens de sesión en localStorage. Los datos académicos y las copias locales siguen disponibles en este navegador.
- Cloudflare Email Service envía verificaciones y recuperaciones. Requiere un dominio habilitado y, para destinatarios arbitrarios, Workers Paid. A 13/11/2026, Workers parte de 5 USD/mes; Email Sending incluye 3000 correos mensuales y después 0,35 USD por 1000. No activar servicios de pago sin autorización.
- El cron llama al Worker cada minuto; Web Push usa la clave VAPID privada del servidor. Los avisos no dependen de temporizadores de una pestaña abierta.

## Entrar y sincronizar

En Ajustes, «Tu cuenta y tus datos» ofrece Google, correo y contraseña, registro, verificación y recuperación. Las contraseñas nuevas tienen al menos 12 caracteres. Las opciones sin conectar quedan desactivadas.

La cuenta comparte asignaturas, tareas y notas, faltas con sus detalles, horario, calendario y configuración académica. Apariencia, zoom, antelación y permiso de notificaciones son propios del dispositivo.

Al entrar con datos existentes se revisan las versiones del dispositivo y de la cuenta. Se puede decidir después, conservar los datos de la cuenta o subir los del dispositivo. No se mezclan listas automáticamente. Antes de sustituir datos se guarda una copia local; se conservan hasta cinco por cuenta.

Cada actualización lleva la revisión que se ha leído. Si otro dispositivo guardó antes, el servidor rechaza el reemplazo y se pide revisar. Curso y avisos pendientes se actualizan en la misma transacción. Las consultas usan exclusivamente el usuario de la sesión; no aceptan un identificador de cuenta proporcionado por el cliente.

Los cambios locales se agrupan antes de subirlos. Se consulta la cuenta cada 30 segundos mientras la app está visible y al recuperar visibilidad o conexión. Los formularios modificados y los diálogos abiertos provocan una revisión antes de aplicar cambios remotos. Sin internet, los cambios permanecen en el navegador y se envían cuando vuelve la conexión. Un cambio que aún no ha llegado al servidor no puede modificar sus recordatorios.

Al salir, se retiran los avisos de ese dispositivo y se recupera el curso de invitado. Los cursos de cuenta tienen una copia local separada. Si hay cambios pendientes se requiere resolverlos antes de salir y se ofrece una descarga de seguridad. Vaciar o importar un curso con cuenta avisa expresamente de que el cambio se sincronizará en los otros dispositivos.

## Traslado desde GitHub Pages

Una dirección nueva no puede leer el almacenamiento de otra web. Desde la dirección anterior, descargar una copia en Ajustes → Tu cuenta y tus datos → Copias y traslado de datos. En la nueva dirección, iniciar sesión, importar la copia y revisar la sincronización. Repetir la revisión si el otro dispositivo tenía datos distintos. No borrar el navegador anterior hasta comprobar el curso.

No redirigir automáticamente GitHub Pages a la nueva dirección antes de ofrecer la descarga de los datos existentes.

## Avisos

Valores iniciales: exámenes tres días antes; otras actividades un día antes; 18:00. Se puede elegir el mismo día, uno, dos, tres o siete días antes y una hora local. Un aviso por actividad y dispositivo. Se excluyen notas personales, actividades completadas, asignaturas archivadas y fechas inválidas o pasadas.

Activar es voluntario y solicita el permiso desde el botón. Se requiere una cuenta sincronizada. «Enviar prueba» se limita a una vez por minuto. Al cambiar una actividad desde cualquier dispositivo, el servidor reprograma o retira sus avisos pendientes en todos los dispositivos de la cuenta. «Desactivar» retira solo los del dispositivo actual.

Se usa la zona horaria del dispositivo al actualizar la preferencia. El cálculo del servidor mantiene la hora local durante cambios de horario; una hora inexistente del salto de verano se desplaza al lado posterior del salto. La fecha de actividad no tiene una hora de examen: si se activa un recordatorio después de su hora prevista, puede enviarse en la próxima revisión, hasta finalizar el día de la actividad.

Los avisos enviados se conservan hasta siete días después de la actividad para evitar repeticiones al editar el título o recargar. Hay reservas temporales, un máximo de cuatro intentos y hasta diez dispositivos por cuenta. Los destinos caducados se retiran al recibir 404/410 y las suscripciones sin actualizar durante 120 días se limpian.

El cron procesa hasta 25 avisos por ejecución. El proveedor, la conexión, los permisos y el dispositivo pueden retrasar la recepción. Un fallo después de que el proveedor acepte un envío puede repetirlo; se reutiliza la etiqueta para sustituir el aviso visible. Un aviso ya enviado puede llegar después de completar o borrar una actividad.

En iPhone/iPad se requiere iOS/iPadOS 16.4 o posterior y abrir la app añadida a la pantalla de inicio.

## Publicación

1. Iniciar sesión en Cloudflare y autorizar el acceso necesario a Workers y D1. Revisar plan y dominio antes de activar correo.
2. Crear D1, sustituir el identificador de ejemplo de wrangler.jsonc y aplicar las migraciones en remoto. Las migraciones se generan y prueban primero en local; no hay una ruta pública de migración.
3. Elegir la dirección HTTPS definitiva y configurar APP_ORIGIN. Configurar Google con la devolución exacta `https://DIRECCION/api/auth/callback/google`.
4. Guardar BETTER_AUTH_SECRET, GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY y VAPID_SUBJECT como secretos del Worker. Generar claves de producción independientes de las pruebas locales y conservar la pareja VAPID.
5. Habilitar el dominio de Email Service y el remitente EMAIL_FROM. Solo entonces configurar AUTH_EMAIL_ENABLED=true y el binding EMAIL. Probar verificación y recuperación con una cuenta real.
6. Ejecutar `npm test`, `npm run build` y `npx wrangler deploy --dry-run`. Publicar después de completar la configuración y las autorizaciones necesarias.
7. Comprobar Google y correo en dos navegadores, sesiones, conflictos, traslado de datos y cambios sin conexión. Instalar en un móvil, activar avisos, enviar una prueba, cerrar la app y verificar una entrega programada.
8. Publicar la dirección definitiva y conservar acceso a la exportación en GitHub Pages.

Los recursos públicos se construyen con una lista cerrada (index, manifest, service worker, src y assets). Las claves privadas, .dev.vars, la base local, node_modules y los archivos del servidor no se incluyen en dist. Las API privadas quedan fuera de la caché de la PWA; tampoco se conservan parámetros de recuperación en las claves de navegación.

## Pruebas verificadas y pendientes

`npm test` ejecuta las pruebas existentes y las de recordatorios, interfaz de cuentas y backend. La integración usa SQLite con el contrato D1 real y la misma biblioteca de acceso. Comprueba registro, correo sin verificar, verificación, contraseña cifrada mediante hash, recuperación y revocación de sesiones, aislamiento de usuarios, cambios concurrentes, guardado fallido, programación, duplicados y cancelación. Los correos y Push se sustituyen por transportes locales de prueba.

Las migraciones se aplicaron correctamente en D1 local y el Worker se compiló en simulación. Las dependencias de producción no presentaron vulnerabilidades conocidas en la auditoría realizada.

Se revisaron los formularios en claro y oscuro a 320, 390, 768 y 1280 píxeles y con altura de 480 píxeles: sin desbordamiento de página, entradas de 16 px y acciones visibles. Escape devolvió el foco al botón de origen. La recarga con el servidor local apagado conservó interfaz, tema y preferencias. Se adaptó la respuesta de navegación guardada para alojamientos que redirigen index.html a /.

**Pendiente:** conexión de Cloudflare, dominio/remitente, credenciales reales de Google, configuración del plan si corresponde, despliegue, pruebas de correo real y notificaciones con un móvil cerrado. Las pruebas locales no sustituyen esas comprobaciones.

## Fuentes

[Cloudflare D1](https://developers.cloudflare.com/d1/worker-api/d1-database/), [cron](https://developers.cloudflare.com/workers/configuration/cron-triggers/), [Better Auth en Cloudflare](https://better-auth.com/docs/guides/cloudflare), [Google](https://better-auth.com/docs/authentication/google), [correo y contraseña](https://better-auth.com/docs/authentication/email-password), [Email Service](https://developers.cloudflare.com/email-service/get-started/send-emails/), [tarifas de correo](https://developers.cloudflare.com/email-service/platform/pricing/), [tarifas de Workers](https://developers.cloudflare.com/workers/platform/pricing/), [Web Push en iOS](https://webkit.org/blog/13878/web-push-for-web-apps-on-ios-and-ipados/) y [web-push](https://github.com/web-push-libs/web-push).
