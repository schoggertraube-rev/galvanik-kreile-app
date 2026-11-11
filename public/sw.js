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
  if(request.headers.has("authorization")||request.headers.has("rsc")||request.headers.has("next-router-state-tree"))return;
  // PL12.11.00:11: offline navigation reuses only the existing qualified HTML.
  // HTTP denials never use a cached page, and this marker never grants server rights.
  if(request.mode==="navigate"&&url.search===""&&!/^\/(?:api|auth|start|login)(?:\/|$)/.test(url.pathname)){
    event.respondWith(fetch(request).catch(async error=>{
      const cached=await readPrivateNavigation(request);if(cached)return cached;throw error;
    }));
    return;
  }
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

// Native worker projection of the existing QueueV2 shellMetadata. It never
// creates a database, changes metadata, grants authentication or touches originals.
async function privateLoginMarker() {
  if (!self.cookieStore) return null;
  const values = await self.cookieStore.getAll("kreile_offline_cache_scope");
  return values.length === 1 && /^[a-f0-9]{64}$/.test(values[0].value) ? values[0].value : null;
}
async function existingShell(scope, login) {
  if (!indexedDB.databases) return null;
  const name = "kreile-pending-originals-v1-" + scope;
  if (!(await indexedDB.databases()).some(db => db.name === name && db.version === 2)) return null;
  return new Promise((resolve, reject) => {
    const open = indexedDB.open(name, 2);
    open.onupgradeneeded = () => { open.transaction.abort(); };
    open.onerror = () => reject(Error("OFFLINE_WORKER_METADATA_UNAVAILABLE"));
    open.onblocked = () => reject(Error("OFFLINE_WORKER_METADATA_BLOCKED"));
    open.onsuccess = () => {
      const db = open.result;
      db.onversionchange = () => db.close();
      if (!db.objectStoreNames.contains("shellMetadata")) { db.close(); resolve(null); return; }
      const tx = db.transaction("shellMetadata", "readonly"), read = tx.objectStore("shellMetadata").get("login:" + login);
      tx.onabort = () => { db.close(); reject(Error("OFFLINE_WORKER_METADATA_ABORTED")); };
      tx.oncomplete = () => {
        db.close(); const row = read.result;
        resolve(row && typeof row === "object" && Object.keys(row).length === 3 && row.scope === login && Number.isSafeInteger(row.cacheGeneration) && row.cacheGeneration > 0 && row.cacheGeneration < Number.MAX_SAFE_INTEGER && typeof row.updatedAt === "string" && Number.isFinite(Date.parse(row.updatedAt)) ? row : null);
      };
    };
  });
}
async function readPrivateNavigation(request) {
  try {
    const login = await privateLoginMarker(), names = await caches.keys();
    const pattern = /^kreile-private-([a-f0-9]{64})-([a-f0-9]{64})-([1-9][0-9]*)$/;
    if (!login) {
      for (const name of names) if (pattern.test(name)) await caches.delete(name);
      return null;
    }
    const eligible = [];
    for (const name of names) {
      const parts = pattern.exec(name);
      if (!parts || parts[2] !== login) continue;
      const metadata = await existingShell(parts[1], login);
      if (metadata && metadata.cacheGeneration === Number(parts[3])) eligible.push({name, scope: parts[1], generation: metadata.cacheGeneration});
    }
    if (eligible.length !== 1 || await privateLoginMarker() !== login) return null;
    const selected = eligible[0], response = await caches.match(request, {cacheName: selected.name});
    if (!response || !response.ok || response.redirected || !/^text\/html(?:;|$)/i.test(response.headers.get("content-type") || "")) return null;
    const html=await response.clone().text(),root=/<html\b[^>]*>/i.exec(html)?.[0];
    if(!root||!root.includes('data-auth-status="authenticated"')||!root.includes('data-offline-24h="enabled"')||!root.includes('data-offline-scope="'+selected.scope+'"')||!root.includes('data-offline-login-scope="'+login+'"'))return null;
    const current = await existingShell(selected.scope, login);
    if (await privateLoginMarker() !== login || !current || current.cacheGeneration !== selected.generation) return null;
    return response;
  } catch { console.error("[OFFLINE_WORKER_PRIVATE_READ_BLOCKED]"); return null; }
}
