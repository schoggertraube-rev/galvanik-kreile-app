const STATIC_CACHE_NAME = "kreile-static-assets-v1";
const STATIC_ASSETS = [
  "/manifest.webmanifest",
  "/icons/icon-192.png",
  "/icons/icon-512.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE_NAME).then((cache) => cache.addAll(STATIC_ASSETS)),
  );
  self.skipWaiting();
});

self.addEventListener("activate", () => {
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const request = event.request;

  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  // Only build-addressed public assets; never pages, RSC, auth, APIs or uploaded originals.
  const immutableBuildAsset = /^\/_next\/static\/.+\.(?:js|css|woff2?|ttf|otf|png|svg|webp)$/.test(url.pathname);
  if ((!STATIC_ASSETS.includes(url.pathname) && !immutableBuildAsset) || url.search !== "" || request.headers.has("authorization")) return;

  event.respondWith((async () => {
    let cached;
    try { cached = await caches.match(request, {cacheName: STATIC_CACHE_NAME}); }
    catch { /* Network remains usable when local cache is unavailable. */ }
    if (cached) return cached;
    const response = await fetch(request);
    const contentType = response.headers.get("content-type") || "";
    const publicAssetType = /^(?:text\/css|(?:text|application)\/javascript|application\/(?:x-font|font)|font\/|image\/)/i.test(contentType);
    if (response.ok && !response.redirected && (publicAssetType || STATIC_ASSETS.includes(url.pathname) && /application\/(?:manifest\+json|json)/i.test(contentType))) {
      const copy = response.clone();
      event.waitUntil(caches.open(STATIC_CACHE_NAME).then(cache => cache.put(request, copy)).catch(() => {}));
    }
    return response;
  })());
});
