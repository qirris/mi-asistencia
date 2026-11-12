/* Service Worker — Mi Asistencia
   Cachea los recursos esenciales para funcionar sin conexión. */

const CACHE_VERSION = 'mi-asistencia-v17';
const APP_SHELL = [
  './',
  './index.html',
  './src/css/styles.css?v=15',
  './src/js/attendance.js',
  './src/js/storage.js',
  './src/js/schedule.js',
  './src/js/tasks.js',
  './src/js/history.js',
  './src/js/app.js?v=17',
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

  // Solo gestionamos GET del mismo origen
  if (req.method !== 'GET' || new URL(req.url).origin !== self.location.origin) {
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
