const CACHE_NAME = 'kreile-static-v3';
const LEGACY_API_DB = 'kreile-offline-db';
const STATIC_ASSETS = [
  '/manifest.webmanifest',
  '/icons/icon-192.png',
  '/icons/icon-512.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_ASSETS)));
  self.skipWaiting();
});

function deleteLegacyApiDatabase() {
  return new Promise((resolve) => {
    const request = indexedDB.deleteDatabase(LEGACY_API_DB);
    request.onsuccess = () => resolve();
    request.onerror = () => resolve();
    request.onblocked = () => resolve();
  });
}

self.addEventListener('activate', (event) => {
  event.waitUntil(Promise.all([
    caches.keys().then((names) => Promise.all(
      names.filter((name) => name !== CACHE_NAME).map((name) => caches.delete(name))
    )),
    deleteLegacyApiDatabase()
  ]));
  self.clients.claim();
});

function isSensitiveRequest(request, url) {
  return request.method !== 'GET' ||
    url.pathname.startsWith('/api/') ||
    url.pathname.startsWith('/auth/') ||
    url.pathname.startsWith('/supabase/') ||
    url.hostname.endsWith('.supabase.co');
}

self.addEventListener('fetch', (event) => {
  const request = event.request;
  const url = new URL(request.url);

  if (isSensitiveRequest(request, url) || request.mode === 'navigate') {
    event.respondWith(fetch(request));
    return;
  }

  const cacheableStatic = url.origin === self.location.origin &&
    (STATIC_ASSETS.includes(url.pathname) || url.pathname.startsWith('/_next/static/'));
  if (!cacheableStatic) {
    event.respondWith(fetch(request));
    return;
  }

  event.respondWith(caches.match(request).then(async (cached) => {
    if (cached) return cached;
    const response = await fetch(request);
    if (response.ok && response.type === 'basic') {
      const cache = await caches.open(CACHE_NAME);
      await cache.put(request, response.clone());
    }
    return response;
  }));
});
