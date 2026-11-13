/* Recordatorios, consentimiento, sincronización y recepción; sin contactar servicios reales. */
const fs = require('fs');
const vm = require('vm');
const assert = require('assert/strict');
const { pathToFileURL } = require('url');
const path = require('path');

function environment(options = {}) {
  const nodes = new Map(), values = {}, calls = [], timers = new Map(), events = {};
  let nextTimer = 0, subscription = null, unsubscribed = 0;
  const academic = { asignaturas: [{ id: 'a', nombre: 'Redes' }], tareas: [
    { id: 'e', asignaturaId: 'a', titulo: 'Examen de redes', tipo: 'examen', estado: 'pendiente', fechaEntrega: '2026-11-16' },
    { id: 't', asignaturaId: 'a', titulo: 'Práctica', tipo: 'trabajo', estado: 'pendiente', fechaEntrega: '2026-11-16' }
  ] };
  const node = selector => {
    if (!nodes.has(selector)) nodes.set(selector, { value: '', dataset: {}, textContent: '', hidden: false, disabled: false,
      addEventListener(name, callback) { this[name] = callback; }, reportValidity() {} });
    return nodes.get(selector);
  };
  const createSub = () => ({ toJSON: () => ({ endpoint: 'https://fcm.googleapis.com/fcm/send/test', keys: { p256dh: 'B'.repeat(87), auth: 'A'.repeat(22) } }),
    async unsubscribe() { unsubscribed++; subscription = null; return true; } });
  const reg = { pushManager: { async getSubscription() { return subscription; }, async subscribe() { calls.push('subscribe'); return subscription = createSub(); } } };
  const Notification = { permission: 'default', async requestPermission() { calls.push('permission'); return Notification.permission = options.denied ? 'denied' : 'granted'; } };
  const navigator = { userAgent: options.ios ? 'iPhone' : 'test', platform: 'test', serviceWorker: {
    ready: Promise.resolve(reg), async getRegistration() { return reg; }, addEventListener(name, callback) { events['sw-' + name] = callback; }
  } };
  const context = { console, Date, Intl, URLSearchParams, AbortController, Uint8Array, atob, Notification, navigator, crypto: require('crypto').webcrypto,
    location: { search: '', pathname: '/index.html', hash: '' }, history: { replaceState() {} },
    window: { isSecureContext: true, Notification, PushManager: {}, matchMedia: () => ({ matches: false }),
      addEventListener(name, callback) { events[name] = callback; }, SalvaTuCursoPushConfig: options.configured === false ? {} : {
        enabled: true, apiBase: '/api', vapidPublicKey: 'B'.repeat(87) } },
    document: { hidden: false, addEventListener(name, callback) { events[name] = callback; } },
    localStorage: { getItem: key => values[key] || null, setItem(key, value) { if (options.blocked) throw Error('bloqueado'); values[key] = value; }, removeItem: key => { delete values[key]; } },
    setTimeout(fn, delay) { timers.set(++nextTimer, { fn, delay }); return nextTimer; }, clearTimeout(id) { timers.delete(id); },
    async fetch(url, init) {
      const body = JSON.parse(init.body); calls.push({ url, body });
      if (options.networkError || (options.syncError && url.includes('/functions/'))) throw Error('Sin conexión');
      return { ok: true, json: async () => url.includes('/auth/') ? { access_token: 'jwt-test', refresh_token: 'refresh-test', expires_in: 3600 } : { ok: true } };
    },
    $: node, state: academic, STORAGE_KEY: 'miAsistenciaState', normalizeState: value => value,
    showView() {}, openTaskEditDialog() {}, toast() {}
  };
  context.CourseAccount = { user: () => ({ id: 'cuenta-de-prueba' }), ready: () => true, async started() {}, async sync() {},
    async api(path, body) { calls.push({ url: '/api/' + path, body }); if (options.networkError || options.syncError) throw Error('Sin conexión'); return { ok: true }; } };
  values.miAsistenciaState = JSON.stringify(academic);
  vm.createContext(context);
  vm.runInContext(fs.readFileSync('src/js/calendar.js', 'utf8') + '\n' + fs.readFileSync('src/js/reminders.js', 'utf8') + '\nthis.api = TaskReminders;', context);
  context.api.bind();
  return { ...context, context, nodes, values, calls, timers, events, academic, node,
    get unsubscribed() { return unsubscribed; },
    async flush() {
      const scheduled = [...timers.entries()].find(([, item]) => item.delay === 1200);
      assert.ok(scheduled, 'hay una actualización pendiente'); timers.delete(scheduled[0]); await scheduled[1].fn();
    }
  };
}

(async () => {
  const env = environment();
  assert.deepEqual(env.calls, [], 'abrir la app no pide permiso ni crea una identidad remota');
  assert.equal(env.node('#push-exam-days').value, '3');
  assert.equal(env.node('#push-task-days').value, '1');
  const untouched = env.values.miAsistenciaState;
  const now = new Date(2026, 10, 13, 12);
  const prefs = env.api.normalize({ examDays: 3, taskDays: 1, time: '18:00' });
  const jobs = env.api.buildJobs(env.academic, prefs, now);
  assert.equal(jobs.length, 2);
  assert.equal(new Date(jobs[0].runAt).getHours(), 18);
  assert.equal(new Date(jobs[0].runAt).getDate(), 13);
  assert.equal(new Date(jobs[1].runAt).getDate(), 15);
  assert.equal(new Date(jobs[0].expiresAt).getDate(), 16);
  assert.equal(env.api.normalize({ examDays: -1, taskDays: 99, time: '24:00' }).time, '18:00');
  const extra = JSON.parse(JSON.stringify(env.academic));
  extra.tareas.push(...['nota', 'completada', 'invalida', 'pasada', 'huerfana'].map((type, index) => ({ ...extra.tareas[0], id: 'x' + index,
    tipo: type === 'nota' ? 'nota' : 'deberes', estado: type === 'completada' ? 'completada' : 'pendiente',
    asignaturaId: type === 'huerfana' ? 'no-existe' : 'a', fechaEntrega: type === 'invalida' ? '2026-02-30' : type === 'pasada' ? '2026-11-12' : '2026-11-16' })));
  assert.equal(env.api.buildJobs(extra, prefs, now).length, 2);
  extra.asignaturas[0].archivada = true;
  assert.equal(env.api.buildJobs(extra, prefs, now).length, 0);
  const leap = JSON.parse(JSON.stringify(env.academic)); leap.tareas[0].fechaEntrega = '2028-03-01';
  const leapJob = env.api.buildJobs(leap, { ...prefs, examDays: 1 }, new Date(2028, 1, 28))[0];
  assert.equal(new Date(leapJob.runAt).getDate(), 29, 'retrocede por el 29 de febrero');
  for (const due of ['2026-03-30', '2026-10-26']) {
    const course = JSON.parse(JSON.stringify(env.academic)); course.tareas = [{ ...course.tareas[0], fechaEntrega: due }];
    const [job] = env.api.buildJobs(course, { ...prefs, examDays: 3 }, new Date(due.slice(0, 7) + '-01T12:00:00'));
    assert.equal(new Date(job.runAt).getHours(), 18, 'conserva la hora local al cambiar el horario de verano');
  }
  await env.node('#push-enable').click();
  assert.equal(env.calls[0], 'permission', 'se solicita permiso directamente desde el botón');
  assert.equal(JSON.parse(env.values.salvatucursoAvisos).enabled, true);
  assert.equal(env.values.miAsistenciaState, untouched, 'no altera los datos académicos');
  assert.ok(env.values.salvatucursoPushDispositivos, 'la dirección de avisos se asocia a este dispositivo y cuenta');
  env.academic.tareas[0].estado = 'completada';
  env.values.miAsistenciaState = JSON.stringify(env.academic);
  env.api.queueSync(); await env.flush();
  let last = env.calls.filter(item => item.body?.action === 'sync').at(-1);
  assert.equal(last.body.prefs.examDays, 3);
  assert.equal(last.body.jobs, undefined, 'el servidor programa los avisos desde el curso de la cuenta');
  env.academic.tareas = []; env.values.miAsistenciaState = JSON.stringify(env.academic);
  env.api.queueSync(); await env.flush();
  last = env.calls.filter(item => item.body?.action === 'sync').at(-1);
  assert.equal(last.body.subscription.endpoint, 'https://fcm.googleapis.com/fcm/send/test');
  env.node('#push-time').value = '19:30'; env.node('#push-time').input(); env.api.renderSettings();
  assert.equal(env.node('#push-time').value, '19:30', 'las actualizaciones no borran la preferencia sin guardar');
  await env.node('#push-disable').click();
  assert.equal(JSON.parse(env.values.salvatucursoAvisos).enabled, false);
  assert.equal(env.unsubscribed, 1);
  const denied = environment({ denied: true }); await denied.node('#push-enable').click();
  assert.equal(denied.calls.length, 1, 'denegar permiso no envía datos ni suscribe');
  const unconfigured = environment({ configured: false }); await unconfigured.node('#push-enable').click();
  assert.equal(unconfigured.node('#push-enable').disabled, true); assert.equal(unconfigured.calls.length, 0);
  const ios = environment({ ios: true }); assert.equal(ios.node('#push-enable').disabled, true);
  assert.match(ios.node('#push-status').textContent, /pantalla de inicio/);
  const blocked = environment({ blocked: true }); await blocked.node('#push-enable').click();
  assert.equal(blocked.calls.filter(item => item === 'subscribe').length, 0, 'no suscribe si no puede persistir');
  const offline = environment({ syncError: true }); await offline.node('#push-enable').click();
  assert.equal(offline.unsubscribed, 1, 'revierte una suscripción nueva si falla la conexión');

  const { validateSubscription, validateJobs, notificationPayload } = await import(pathToFileURL(path.resolve('cloudflare/validation.mjs')));
  const subscription = { endpoint: 'https://fcm.googleapis.com/fcm/send/test', keys: { p256dh: 'B'.repeat(87), auth: 'A'.repeat(22) } };
  assert.equal(validateSubscription(subscription).endpoint, subscription.endpoint);
  for (const endpoint of ['http://fcm.googleapis.com/test', 'https://fcm.googleapis.com.evil.test/test', 'https://127.0.0.1/test',
    'https://fcm.googleapis.com:8443/test', 'https://user@fcm.googleapis.com/test', 'https://push.apple.com.evil.test/test']) {
    assert.throws(() => validateSubscription({ ...subscription, endpoint }), undefined, 'rechaza destinos arbitrarios');
  }
  const validJobs = JSON.parse(JSON.stringify(jobs));
  assert.equal(validateJobs(validJobs, now.getTime()).length, 2);
  assert.throws(() => validateJobs([...validJobs, validJobs[0]], now.getTime()));
  assert.throws(() => validateJobs([{ ...validJobs[0], date: '2026-02-30' }], now.getTime()));
  assert.throws(() => validateJobs([{ ...validJobs[0], timeZone: 'inventada' }], now.getTime()));
  assert.throws(() => validateJobs([{ ...validJobs[0], title: 'x'.repeat(161) }], now.getTime()));
  const payload = notificationPayload(validJobs[0], new Date('2026-11-15T12:00:00Z'));
  assert.equal(payload.title, 'Examen mañana'); assert.equal(payload.taskId, 'e');
  assert.equal(notificationPayload(validJobs[1], new Date('2026-11-16T12:00:00Z')).title, 'Entrega hoy');

  const handlers = {}, notifications = [], opened = [];
  let pending;
  const sw = { URL, self: { location: { origin: 'https://example.test' },
    registration: { scope: 'https://example.test/mi-asistencia/', async showNotification(title, data) { notifications.push({ title, data }); } },
    addEventListener(name, fn) { handlers[name] = fn; }, clients: { async matchAll() { return []; }, async openWindow(url) { opened.push(url); } }
  } };
  vm.createContext(sw); vm.runInContext(fs.readFileSync('service-worker.js', 'utf8'), sw);
  let privateCached = false;
  handlers.fetch({ request: { method: 'GET', url: 'https://example.test/mi-asistencia/api/course', mode: 'cors' }, respondWith() { privateCached = true; } });
  assert.equal(privateCached, false, 'las cuentas y los cursos no pasan por la caché del service worker');
  const cachedPage = new Response('<html lang="es">SalvaTuCurso</html>', { headers: { 'Content-Type': 'text/html' } });
  Object.defineProperty(cachedPage, 'redirected', { value: true });
  sw.Response = Response; sw.fetch = async () => { throw Error('Sin conexión'); }; sw.caches = { async match() { return cachedPage; } };
  handlers.fetch({ request: { method: 'GET', url: 'https://example.test/mi-asistencia/?restablecer=1', mode: 'navigate' }, respondWith(promise) { pending = promise; } });
  const offlinePage = await pending;
  assert.equal(offlinePage.redirected, false, 'la navegación offline limpia la marca de redirección del alojamiento');
  assert.match(await offlinePage.text(), /SalvaTuCurso/);
  sw.caches = { async match() { return new Response('configuración guardada'); }, async open() { return { async put() {} }; } };
  sw.fetch = async () => new Response('configuración actualizada');
  const configEvent = { request: { method: 'GET', url: 'https://example.test/mi-asistencia/src/js/push-config.js?v=43', mode: 'cors' }, respondWith(promise) { pending = promise; }, waitUntil() {} };
  handlers.fetch(configEvent); assert.equal(await (await pending).text(), 'configuración actualizada');
  sw.fetch = async () => { throw Error('Sin conexión'); };
  handlers.fetch(configEvent); assert.equal(await (await pending).text(), 'configuración guardada');
  handlers.push({ data: { json: () => ({ ...payload, url: 'https://evil.test' }) }, waitUntil(promise) { pending = promise; } }); await pending;
  assert.equal(notifications[0].title, 'Examen mañana'); assert.equal(notifications[0].data.tag, 'curso-e|2026-11-16');
  handlers.notificationclick({ notification: { data: { taskId: 'e /?' }, close() {} }, waitUntil(promise) { pending = promise; } }); await pending;
  assert.match(opened[0], /^https:\/\/example\.test\/mi-asistencia\/index.html\?actividad=/);
  assert.equal(new URL(opened[0]).searchParams.get('actividad'), 'e /?');
  handlers.push({ data: { json() { throw Error('inválido'); } }, waitUntil(promise) { pending = promise; } }); await pending;
  assert.equal(notifications[1].title, 'SalvaTuCurso', 'un aviso malformado conserva una notificación visible');
  console.log('OK: fechas locales, consentimiento, preferencias, cancelación, almacenamiento, iPhone, validación de destinos y notificaciones del service worker');
})().catch(error => { console.error(error); process.exitCode = 1; });
