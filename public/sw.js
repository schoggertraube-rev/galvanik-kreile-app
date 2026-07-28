// Static-only cache. Product/API/auth/RSC responses must never be cached here:
// they are actor- and tenant-dependent and require a separate offline contract.
const CACHE_NAME = 'kreile-static-cache-v3';

const STATIC_ASSETS = [
  '/manifest.webmanifest',
  '/icons/icon-192.png',
  '/icons/icon-512.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener('activate', () => {
  // Do not erase prior browser cache/IndexedDB entries as part of a repair.
  // This worker simply stops reading them.
  self.clients.claim();
});

function isVersionedStaticAsset(request, url) {
  if (request.method !== 'GET' || url.origin !== self.location.origin) return false;
  return url.pathname.startsWith('/_next/static/') || STATIC_ASSETS.includes(url.pathname);
}

function isSensitiveProductRequest(request, url) {
  const accept = request.headers.get('accept') || '';
  return (
    request.method !== 'GET' ||
    url.pathname.startsWith('/api/') ||
    url.pathname.startsWith('/supabase/') ||
    url.pathname.startsWith('/auth/') ||
    url.searchParams.has('_rsc') ||
    request.headers.has('Rsc') ||
    accept.includes('text/x-component')
  );
}

self.addEventListener('fetch', (event) => {
  const request = event.request;
  const url = new URL(request.url);

  // APIs, authentication, Next RSC payloads and every mutation bypass the
  // worker. Network failure must remain an honest failure, never cached data.
  if (isSensitiveProductRequest(request, url)) return;

  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request).catch(() => new Response(
        'Offline: Diese Ansicht braucht eine Netzwerkverbindung.',
        { status: 503, headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' } }
      ))
    );
    return;
  }

  if (isVersionedStaticAsset(request, url)) {
    event.respondWith(
      caches.match(request).then((cached) => cached || fetch(request).then((response) => {
        if (response.ok) {
          caches.open(CACHE_NAME).then((cache) => cache.put(request, response.clone()));
        }
        return response;
      }))
    );
  }
});
