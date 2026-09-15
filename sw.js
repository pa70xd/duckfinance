// Funciona sin señal: primero red (para recibir actualizaciones), si no hay, lo guardado.
// Las llamadas a api.github.com nunca pasan por aquí: la cola de cambios vive en la app.
const CACHE = 'df-v4';
const SHELL = ['./', 'index.html', 'css/app.css', 'js/icons.js', 'js/logic.js', 'js/classify.js', 'js/store.js', 'js/app.js', 'manifest.webmanifest',
  'fonts/OverusedGrotesk-VF.woff2', 'fonts/SpaceGrotesk-VF.woff2', 'fonts/Minecraft-Regular.woff2', 'icons/icon-192.png', 'img/trama.png', 'img/key-green.png', 'img/key-black.png'];

self.addEventListener('install', e => { e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting())); });
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== self.location.origin) return;
  e.respondWith((async () => {
    const cache = await caches.open(CACHE);
    const timeout = new Promise(res => setTimeout(() => res(null), 3500));
    try {
      const net = fetch(e.request).then(r => { if (r.ok) cache.put(e.request, r.clone()); return r; });
      net.catch(() => {});
      const r = await Promise.race([net, timeout]);
      if (r) return r;
      return (await cache.match(e.request, { ignoreSearch: true })) || await net;
    } catch (err) {
      const hit = await cache.match(e.request, { ignoreSearch: true });
      if (hit) return hit;
      throw err;
    }
  })());
});
