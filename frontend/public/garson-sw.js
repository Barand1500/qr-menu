/* Garson PWA — install + yerel bildirim gösterimi */
const CACHE = 'garson-shell-v1';
const SHELL = ['/garson', '/garson-icon-192.png', '/garson-icon-512.png', '/garson-manifest.webmanifest'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(SHELL).catch(() => undefined)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  if (event.request.method !== 'GET') return;
  if (url.pathname.startsWith('/api/') || url.pathname.startsWith('/uploads/')) return;
  event.respondWith(
    fetch(event.request)
      .then((res) => {
        const copy = res.clone();
        if (res.ok && url.origin === self.location.origin) {
          void caches.open(CACHE).then((c) => c.put(event.request, copy));
        }
        return res;
      })
      .catch(() => caches.match(event.request).then((hit) => hit || caches.match('/garson')))
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const target = event.notification.data?.url || '/garson';
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      for (const client of clients) {
        if ('focus' in client && String(client.url).includes('/garson')) {
          return client.focus();
        }
      }
      if (self.clients.openWindow) return self.clients.openWindow(target);
      return undefined;
    })
  );
});

self.addEventListener('message', (event) => {
  const data = event.data;
  if (!data || data.type !== 'GARSON_NOTIFY') return;
  const title = data.title || 'Yeni çağrı';
  const options = {
    body: data.body || 'Masadan garson çağrısı var',
    icon: '/garson-icon-192.png',
    badge: '/garson-icon-192.png',
    tag: data.tag || 'garson-call',
    renotify: true,
    vibrate: data.vibrate || [180, 80, 180, 80, 240],
    data: { url: data.url || '/garson' },
  };
  event.waitUntil(self.registration.showNotification(title, options));
});
