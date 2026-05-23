const CACHE_NAME = "kreile-app-shell-v1";

const PRECACHE_ASSETS = [
  "/",
  "/orders",
  "/status",
  "/performance",
  "/customers",
  "/items",
  "/favicon.ico"
];

// Install Event - Pre-cache the standard app shell paths
self.addEventListener("install", (event) => {
  console.log("👷 Service Worker: Installing and pre-caching App Shell assets...");
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(PRECACHE_ASSETS);
    }).then(() => {
      console.log("👷 Service Worker: App Shell assets cached successfully!");
      return self.skipWaiting();
    })
  );
});

// Activate Event - Clean up any old caches
self.addEventListener("activate", (event) => {
  console.log("👷 Service Worker: Activating...");
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cache) => {
          if (cache !== CACHE_NAME) {
            console.log(`👷 Service Worker: Deleting outdated cache: ${cache}`);
            return caches.delete(cache);
          }
        })
      );
    }).then(() => {
      console.log("👷 Service Worker: Activated and ready.");
      return self.clients.claim();
    })
  );
});

// Fetch Event - Network-First falling back to Cached App Shell
self.addEventListener("fetch", (event) => {
  // Only handle standard HTTP/HTTPS GET requests (avoid chrome-extension or POST requests)
  if (event.request.method !== "GET" || !event.request.url.startsWith(self.location.origin)) {
    return;
  }

  event.respondWith(
    fetch(event.request)
      .then((response) => {
        // If the request succeeds, clone and store it in cache
        if (response && response.status === 200 && response.type === "basic") {
          const responseToCache = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseToCache);
          });
        }
        return response;
      })
      .catch(() => {
        console.log(`👷 Service Worker: Network failed for ${event.request.url}. Serving from Cache.`);
        return caches.match(event.request).then((cachedResponse) => {
          if (cachedResponse) {
            return cachedResponse;
          }
          
          // For SPA pages, if it's a page navigation, return root cache entry "/"
          if (event.request.mode === "navigate") {
            return caches.match("/");
          }

          // Otherwise return standard response error
          return new Response("Offline resource not found in cache", {
            status: 503,
            statusText: "Service Unavailable",
            headers: new Headers({ "Content-Type": "text/plain" })
          });
        });
      })
  );
});
