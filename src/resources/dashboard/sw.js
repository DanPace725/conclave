// Bump the version when changing offline resources. Never cache authenticated
// HTML, handoffs, API responses, account pages, OAuth traffic or MCP requests.
const prefix = 'conclave-dashboard-offline-';
const cacheName = `${prefix}v1`;
const offline = '/dashboard/offline.html';
const publicPaths = [offline, '/dashboard/offline.css', '/dashboard/icon-192.png',
  '/dashboard/icon-512.png', '/dashboard/icon-maskable-512.png', '/dashboard/apple-touch-icon.png'];
self.addEventListener('install', event => {
  event.waitUntil((async () => {
    const cache = await caches.open(cacheName);
    await cache.addAll(publicPaths.map(path => new Request(path, { cache: 'reload', credentials: 'omit' })));
    await self.skipWaiting();
  })());
});
self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    for (const key of await caches.keys()) {
      if (key.startsWith(prefix) && key !== cacheName) await caches.delete(key);
    }
    await self.clients.claim();
  })());
});
self.addEventListener('fetch', event => {
  const { request } = event;
  const url = new URL(request.url);
  if (request.method !== 'GET' || url.origin !== self.location.origin) return;
  if (request.mode === 'navigate' && ['/dashboard', '/dashboard/'].includes(url.pathname)) {
    event.respondWith(fetch(request).catch(async () => (await (await caches.open(cacheName)).match(offline))
      || new Response('Conclave is offline. Reconnect and try again.', { status: 503, headers: { 'Content-Type': 'text/plain' } })));
  } else if (!url.search && publicPaths.includes(url.pathname)) {
    event.respondWith((async () => (await (await caches.open(cacheName)).match(request)) || fetch(request))());
  }
});
