const CACHE_NAME = 'kreile-pwa-cache-v3';
const OFFLINE_URL = '/';

const STATIC_ASSETS = [
  '/',
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

self.addEventListener('activate', (event) => {
  event.waitUntil(
    Promise.all([
      // Clean up old caches
      caches.keys().then((cacheNames) => {
        return Promise.all(
          cacheNames.map((name) => {
            if (name !== CACHE_NAME) return caches.delete(name);
          })
        );
      }),
      // CONTAINMENT: Delete stale API cache IndexedDB from previous SW version
      new Promise((resolve) => {
        try {
          const req = indexedDB.deleteDatabase('kreile-offline-db');
          req.onsuccess = () => { console.log('[SW] Cleaned up stale kreile-offline-db'); resolve(); };
          req.onerror = () => resolve();
          req.onblocked = () => resolve();
        } catch { resolve(); }
      })
    ])
  );
  self.clients.claim();
});

// CONTAINMENT: API caching disabled until OFFLINE-SHELL-001
// Previously, API responses were cached in IndexedDB and served as stale
// fallbacks. This caused users to see outdated data presented as current.
// Static assets remain cache-first. All other requests are network-only.

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // API requests: network-only, no caching
  if (url.pathname.startsWith('/api/') || url.pathname.startsWith('/supabase/')) {
    event.respondWith(
      fetch(event.request).catch(() => {
        return new Response(JSON.stringify({ error: 'Offline', offline: true }), {
          status: 503,
          headers: { 'Content-Type': 'application/json' }
        });
      })
    );
    return;
  }

  // Navigation: network-first, fallback to cached offline page
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request).catch(() => caches.match(OFFLINE_URL))
    );
  } else {
    // Static assets: cache-first
    event.respondWith(
      caches.match(event.request).then((cached) => cached || fetch(event.request))
    );
  }
});
