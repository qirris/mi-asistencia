/* Service Worker — SalvaTuCurso
   Cachea los recursos esenciales para funcionar sin conexión. */

const CACHE_VERSION = 'salvatucurso-v46';
const APP_SHELL = [
  './index.html',
  './src/css/styles.css?v=43',
  './src/js/theme.js?v=43',
  './src/js/attendance.js?v=43',
  './src/js/calendar.js?v=43',
  './src/js/absence-day.js?v=43',
  './src/js/storage.js?v=43',
  './src/js/schedule.js?v=43',
  './src/js/tasks.js?v=43',
  './src/js/history.js?v=43',
  './src/js/recovery.js?v=43',
  './src/js/push-config.js?v=43',
  './src/js/account.js?v=44',
  './src/js/reminders.js?v=43',
  './src/js/app.js?v=43',
  './manifest.webmanifest',
  './assets/icons/icon-192.png',
  './assets/icons/icon-512.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_VERSION).then((cache) => cache.addAll(APP_SHELL))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_VERSION).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  const requestURL = new URL(req.url);

  // Solo gestionamos GET del mismo origen
  if (req.method !== 'GET' || requestURL.origin !== self.location.origin) {
    return;
  }
  // Las sesiones y los datos de cuenta siempre pasan por el servidor.
  // Nunca conservar respuestas privadas ni reutilizarlas al cambiar de usuario.
  if (requestURL.pathname.startsWith(new URL('./api/', self.registration.scope).pathname)) return;
  if (requestURL.pathname === new URL('./src/js/push-config.js', self.registration.scope).pathname) {
    // Configuración pública actualizada al conectar servicios, con copia offline.
    event.respondWith(fetch(req, { cache: 'no-store' }).then(response => {
      if (!response.ok) throw new Error('Configuración no disponible');
      const copy = response.clone();
      event.waitUntil(caches.open(CACHE_VERSION).then(cache => cache.put(req, copy)).catch(() => {}));
      return response;
    }).catch(() => caches.match(req)));
    return;
  }

  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req).then((res) => {
        if (res.ok) {
          const copy = res.clone();
          // Conservar solo la página pública, sin tokens ni parámetros en la clave.
          caches.open(CACHE_VERSION).then(cache => cache.put('./index.html', copy)).catch(() => {});
        }
        return res;
      }).catch(async () => {
        const cached = await caches.match(req) || await caches.match('./index.html');
        // Algunos alojamientos redirigen index.html a /. Convertir la copia evita
        // devolver una respuesta marcada como redirigida en una navegación offline.
        return cached && new Response(cached.body, { status: cached.status, statusText: cached.statusText, headers: cached.headers });
      })
    );
    return;
  }

  event.respondWith(
    caches.match(req).then((cached) => {
      if (cached) return cached;
      return fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE_VERSION).then((cache) => cache.put(req, copy)).catch(() => {});
          return res;
        })
        .catch(() => caches.match('./index.html'));
    })
  );
});

/* Los envíos se programan en el servidor; este proceso no usa temporizadores. */
self.addEventListener('push', event => {
  event.waitUntil((async () => {
    let payload = {};
    try { payload = event.data ? event.data.json() : {}; } catch (error) { /* Aviso genérico. */ }
    const taskId = typeof payload.taskId === 'string' ? payload.taskId.slice(0, 100) : '';
    await self.registration.showNotification(
      typeof payload.title === 'string' ? payload.title.slice(0, 180) : 'SalvaTuCurso',
      {
        body: typeof payload.body === 'string' ? payload.body.slice(0, 350) : 'Tienes un aviso de tu curso.',
        icon: new URL('./assets/icons/icon-192.png', self.registration.scope).href,
        badge: new URL('./assets/icons/icon-192.png', self.registration.scope).href,
        tag: typeof payload.tag === 'string' ? payload.tag.slice(0, 180) : 'salvatucurso-aviso',
        data: { taskId },
        renotify: false
      }
    );
  })());
});
self.addEventListener('notificationclick', event => {
  event.notification.close();
  const taskId = event.notification.data?.taskId || '';
  event.waitUntil((async () => {
    const target = new URL('./index.html', self.registration.scope);
    if (taskId) target.searchParams.set('actividad', taskId);
    const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    const client = windows.find(item => item.url.startsWith(self.registration.scope));
    if (client) {
      await client.focus();
      client.postMessage({ type: 'open-reminder', taskId });
    } else {
      await self.clients.openWindow(target.href);
    }
  })());
});
