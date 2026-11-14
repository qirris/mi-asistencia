# Cuentas, sincronización y avisos en Cloudflare

## Estado

**Cloudflare y Google están conectados en https://salvatucurso.qirris.workers.dev. Se han verificado un inicio de sesión real, el primer guardado del curso y una notificación programada recibida en el móvil con la app cerrada.** Google sigue en modo Prueba, con la cuenta del propietario autorizada; todavía no se admite el acceso general de otras cuentas. La base D1 tiene jurisdicción de la Unión Europea y ambas migraciones aplicadas. Las claves de producción están guardadas como secretos del Worker y el cron está publicado.

El 14/11/2026 el usuario eligió mantener el plan gratuito y activar primero Google; no dispone de dominio propio. El registro con correo/contraseña queda aplazado. No se ha contratado ningún plan ni activado envío de correo. La base comenzó vacía; después de la activación en móvil se comprobaron una cuenta, un curso y un dispositivo con prueba registrada. No se han importado los datos académicos anteriores de GitHub Pages, que conserva el guardado local y el acceso a las copias JSON.

La configuración pública solo habilita el acceso cuando existe un proveedor y un secreto de sesión válido. La versión de Cloudflare ofrece Google; la versión estática de GitHub Pages mantiene el acceso desactivado. Los avisos se habilitan en cada dispositivo después de sincronizar la cuenta y aceptar el permiso del navegador.

## Arquitectura

- Interfaz existente en HTML/CSS/JS, conservando calendario, horario, tareas, faltas, temas y PWA.
- Worker con recursos estáticos y API en el mismo origen: evita depender de cookies de terceros en Safari. La versión con cuentas se abrirá desde su dirección de Cloudflare.
- D1 guarda usuarios, sesiones, curso, cinco copias recientes y recordatorios. Better Auth 1.7.22 gestiona Google, contraseñas, verificación y recuperación. No se implementan algoritmos de contraseñas propios.
- Las sesiones usan cookies de Better Auth. No se guardan contraseñas ni tokens de sesión en localStorage. Los datos académicos y las copias locales siguen disponibles en este navegador.
- La implementación de correo admite verificaciones y recuperaciones mediante Cloudflare Email Service, pero está desactivada: AUTH_EMAIL_ENABLED=false y no hay binding EMAIL en el despliegue gratuito. Requiere un dominio habilitado y, para destinatarios arbitrarios, Workers Paid. A 13/11/2026, Workers parte de 5 USD/mes; Email Sending incluye 3000 correos mensuales y después 0,35 USD por 1000. No activar servicios de pago sin autorización.
- El cron llama al Worker cada minuto; Web Push usa la clave VAPID privada del servidor. Los avisos no dependen de temporizadores de una pestaña abierta.

## Entrar y sincronizar

En Ajustes, «Tu cuenta y tus datos» ofrece Google. Con el correo aplazado se ocultan sus campos, registro y recuperación, y el foco comienza en el acceso disponible. La implementación de correo/contraseña sigue preparada; cuando se active, las contraseñas nuevas tendrán al menos 12 caracteres.

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

1. Conexión de Cloudflare autorizada. Para este despliegue se usan account:read, user:read, workers_scripts:write y d1:write, además de offline_access. No se necesita permiso de correo ni dominios para la primera entrega con Google. La conexión se guarda cifrada con clave en el almacén de credenciales de Windows.
2. D1 remoto creado y migraciones aplicadas. El identificador real y jurisdiction=eu están en wrangler.jsonc. No volver a crear ni reiniciar la base. No hay una ruta pública de migración.
3. APP_ORIGIN configurado con la dirección devuelta por la API de Cloudflare: `https://salvatucurso.qirris.workers.dev`. El proyecto Google SalvaTuCurso (`qirris-salvatucurso`) está creado con autorización expresa del usuario y sin activar facturación. El usuario aceptó la política de Google y el correo de asistencia, creó el cliente web y proporcionó su archivo de conexión. La devolución exacta es `https://salvatucurso.qirris.workers.dev/api/auth/callback/google`. Google solicita únicamente email, profile y openid. El propietario autorizó y completó el primer acceso real. La publicación general de Google queda pendiente: el panel pide completar la información de marca, que todavía no tiene página principal ni política de privacidad enlazadas.
4. BETTER_AUTH_SECRET, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT, GOOGLE_CLIENT_ID y GOOGLE_CLIENT_SECRET están guardados como secretos del Worker. No regenerarlos al volver a desplegar. Nunca guardar el archivo de conexión ni las claves en GitHub, recursos públicos o mensajes.
5. Mantener AUTH_EMAIL_ENABLED=false y sin binding EMAIL durante esta entrega gratuita. Si se retoma el correo, revisar por separado dominio, remitente y autorización de pago antes de habilitarlo; probar entonces verificación y recuperación reales.
6. Ejecutar `npm test`, `npm run build` y `npx wrangler deploy --dry-run`. Publicar después de completar la configuración y las autorizaciones necesarias.
7. Comprobar Google y correo en dos navegadores, sesiones, conflictos, traslado de datos y cambios sin conexión. Instalar en un móvil, activar avisos, enviar una prueba, cerrar la app y verificar una entrega programada.
8. Publicar la dirección definitiva y conservar acceso a la exportación en GitHub Pages.

Los recursos públicos se construyen con una lista cerrada (index, manifest, service worker, src y assets). Las claves privadas, .dev.vars, la base local, node_modules y los archivos del servidor no se incluyen en dist. Las API privadas quedan fuera de la caché de la PWA; tampoco se conservan parámetros de recuperación en las claves de navegación.

## Pruebas verificadas y pendientes

`npm test` ejecuta las pruebas existentes y las de recordatorios, interfaz de cuentas y backend. La integración usa SQLite con el contrato D1 real y la misma biblioteca de acceso. Comprueba registro, correo sin verificar, verificación, contraseña cifrada mediante hash, recuperación y revocación de sesiones, aislamiento de usuarios, cambios concurrentes, guardado fallido, programación, duplicados y cancelación. Los correos y Push se sustituyen por transportes locales de prueba.

Las migraciones se aplicaron correctamente en D1 local y el Worker se compiló en simulación. Las dependencias de producción no presentaron vulnerabilidades conocidas en la auditoría realizada.

Se revisaron los formularios en claro y oscuro a 320, 390, 768 y 1280 píxeles y con altura de 480 píxeles: sin desbordamiento de página, entradas de 16 px y acciones visibles. Escape devolvió el foco al botón de origen. La recarga con el servidor local apagado conservó interfaz, tema y preferencias. Se adaptó la respuesta de navegación guardada para alojamientos que redirigen index.html a /.

En el despliegue remoto se comprobó la respuesta de la configuración pública, sesión nula sin autenticar, rechazo 401 para cursos sin sesión y rechazo 403 al guardar desde otro origen. La configuración no expone claves privadas. Se repitió npm test después de añadir la protección de disponibilidad de proveedores: todas las suites pasaron.

El acceso real con Google volvió a la app y mostró «Curso sincronizado». La cuenta se conservó al recargar. Se corrigió el refresco de los avisos al cambiar el estado de la cuenta: el botón de activación reconoce la sincronización sin necesitar otra recarga. La caché actual es salvatucurso-v46, con account.js?v=44. Pasaron las pruebas completas y se publicó y revisó la corrección.

El usuario confirmó la recepción de «Enviar prueba» en el móvil. Después autorizó una prueba programada y cerró la app. Se añadió un único aviso temporal a la cola del dispositivo ya registrado, sin cambiar tareas, asignaturas, faltas ni curso. El cron lo envió en el primer intento y el usuario confirmó que llegó con SalvaTuCurso cerrada. Se retiró solo ese aviso temporal después de la comprobación; el dispositivo sigue asociado a la cuenta.

**Pendiente:** trasladar los datos anteriores con revisión del usuario y comprobar sus contenidos en móvil y ordenador. La apertura general del acceso de Google necesita completar la información de marca y publicar la app en Google; por ahora solo entra la cuenta de prueba autorizada. El correo queda aplazado por decisión del usuario. La prueba real confirma el transporte y la ejecución del cron; no garantiza que el sistema del móvil entregue siempre todos los avisos sin retrasos.

## Fuentes

[Cloudflare D1](https://developers.cloudflare.com/d1/worker-api/d1-database/), [cron](https://developers.cloudflare.com/workers/configuration/cron-triggers/), [Better Auth en Cloudflare](https://better-auth.com/docs/guides/cloudflare), [Google](https://better-auth.com/docs/authentication/google), [correo y contraseña](https://better-auth.com/docs/authentication/email-password), [Email Service](https://developers.cloudflare.com/email-service/get-started/send-emails/), [tarifas de correo](https://developers.cloudflare.com/email-service/platform/pricing/), [tarifas de Workers](https://developers.cloudflare.com/workers/platform/pricing/), [Web Push en iOS](https://webkit.org/blog/13878/web-push-for-web-apps-on-ios-and-ipados/) y [web-push](https://github.com/web-push-libs/web-push).
