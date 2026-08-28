/**
 * FALAH service worker — offline-first PWA.
 * - App shell: network-first with cache fallback (so deploys propagate).
 * - Hashed build assets (/assets/*): cache-first (immutable).
 * - Google Fonts + recitation audio: cache-first with a size-capped runtime cache.
 */
const VERSION = 'falah-v2';
const SHELL_CACHE = `${VERSION}-shell`;
const ASSET_CACHE = `${VERSION}-assets`;
const MEDIA_CACHE = `${VERSION}-media`;
const MEDIA_LIMIT = 120;

const SHELL_URLS = ['/', '/index.html', '/manifest.webmanifest', '/icon.svg'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(SHELL_CACHE)
      .then((cache) => cache.addAll(SHELL_URLS))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((k) => !k.startsWith(VERSION)).map((k) => caches.delete(k))),
      )
      .then(() => self.clients.claim()),
  );
});

async function trimCache(cacheName, limit) {
  const cache = await caches.open(cacheName);
  const keys = await cache.keys();
  if (keys.length > limit) {
    await cache.delete(keys[0]);
    await trimCache(cacheName, limit);
  }
}

async function cacheFirst(request, cacheName, trim) {
  const cached = await caches.match(request);
  if (cached) return cached;
  const response = await fetch(request);
  if (response.ok || response.type === 'opaque') {
    const cache = await caches.open(cacheName);
    cache.put(request, response.clone());
    if (trim) trimCache(cacheName, MEDIA_LIMIT);
  }
  return response;
}

async function networkFirstShell(request) {
  try {
    const response = await fetch(request);
    const cache = await caches.open(SHELL_CACHE);
    cache.put('/index.html', response.clone());
    return response;
  } catch {
    return (await caches.match(request)) || (await caches.match('/index.html'));
  }
}

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);

  // SPA navigations → shell.
  if (request.mode === 'navigate') {
    event.respondWith(networkFirstShell(request));
    return;
  }
  // Immutable hashed build assets.
  if (url.origin === self.location.origin && url.pathname.startsWith('/assets/')) {
    event.respondWith(cacheFirst(request, ASSET_CACHE, false));
    return;
  }
  // Fonts + recitation audio (cross-origin, cache-first, capped).
  if (
    url.hostname === 'fonts.googleapis.com' ||
    url.hostname === 'fonts.gstatic.com' ||
    url.hostname === 'cdn.islamic.network'
  ) {
    event.respondWith(cacheFirst(request, MEDIA_CACHE, true));
    return;
  }
  // Same-origin statics (manifest, icon).
  if (url.origin === self.location.origin) {
    event.respondWith(caches.match(request).then((cached) => cached || fetch(request)));
  }
});
