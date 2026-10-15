const CACHE_NAME = 'archangelos-school-v13';
const MEDIA_CACHE_NAME = 'archangelos-media-v1';
const MAX_CACHED_MEDIA_BYTES = 5 * 1024 * 1024;
const MAX_CACHED_MEDIA_FILES = 20;
const APP_SHELL = [
  './', './index.html', './styles.css', './localization.js', './app.js', './manifest.json', './manifest-en.json', './manifest-ar.json',
  './assets/logo.png', './assets/icons/icon-192.png', './assets/icons/icon-512.png', './assets/icons/icon-maskable-512.png',
  './assets/icons/apple-touch-icon.png', './assets/icons/favicon-64.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL)));
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((key) => key !== CACHE_NAME && key !== MEDIA_CACHE_NAME).map((key) => caches.delete(key)))));
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  const requestUrl = new URL(request.url);
  if (request.method !== 'GET' || requestUrl.origin !== self.location.origin || request.headers.has('Range')) return;

  if (requestUrl.pathname === new URL('./api/resources', self.location).pathname) {
    event.respondWith((async () => {
      try {
        const response = await fetch(request);
        if (response.ok) {
          const cache = await caches.open(CACHE_NAME);
          await cache.put(request, response.clone());
        }
        return response;
      } catch (_) {
        return (await caches.match(request)) || Response.error();
      }
    })());
    return;
  }

  if (requestUrl.pathname.startsWith('/api/')) return;

  if (requestUrl.pathname.startsWith('/media/')) {
    event.respondWith((async () => {
      const cache = await caches.open(MEDIA_CACHE_NAME);
      try {
        const response = await fetch(request);
        const size = Number(response.headers.get('Content-Length') || 0);
        if (response.status === 200 && size > 0 && size <= MAX_CACHED_MEDIA_BYTES) {
          const cacheWrite = cache.put(request, response.clone()).then(async () => {
            const keys = await cache.keys();
            while (keys.length > MAX_CACHED_MEDIA_FILES) await cache.delete(keys.shift());
          });
          event.waitUntil(cacheWrite);
        }
        return response;
      } catch (_) {
        return (await cache.match(request)) || Response.error();
      }
    })());
    return;
  }

  event.respondWith(caches.match(request).then((cached) => {
    if (cached) return cached;
    return fetch(request).then((response) => {
      if (response.status === 200) {
        const copy = response.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
      }
      return response;
    }).catch(() => request.mode === 'navigate' ? caches.match('./index.html') : Response.error());
  }));
});

self.addEventListener('notificationclick', (event) => {
  const targetUrl = event.notification.data?.url || self.registration.scope;
  event.notification.close();
  event.waitUntil((async () => {
    const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    for (const client of windows) {
      if (client.url.startsWith(self.registration.scope) && 'focus' in client) {
        if ('navigate' in client) await client.navigate(targetUrl);
        return client.focus();
      }
    }
    return self.clients.openWindow(targetUrl);
  })());
});
