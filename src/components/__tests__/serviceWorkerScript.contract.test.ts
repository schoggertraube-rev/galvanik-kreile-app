import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { runInNewContext } from "node:vm";
import { describe, expect, it } from "vitest";

const staticAssets = [
  "/manifest.webmanifest",
  "/icons/icon-192.png",
  "/icons/icon-512.png",
];

type NetworkOutcome = { kind: "response"; status: 200 | 401 | 403 | 500 } | { kind: "reject" };

type Metrics = {
  addAll: string[][];
  cacheDelete: number;
  cacheKeys: number;
  cacheMatch: number;
  cacheOpen: number;
  cachePut: number;
  clientsClaim: number;
  indexedDbGet: number;
  indexedDbOpen: number;
  indexedDbPut: number;
  selfFetch: number;
};

function loadWorker({ network = { kind: "response", status: 200 }, cachedResponse }: { network?: NetworkOutcome; cachedResponse?: Response } = {}) {
  const handlers = new Map<string, (event: never) => void>();
  const metrics: Metrics = {
    addAll: [], cacheDelete: 0, cacheKeys: 0, cacheMatch: 0, cacheOpen: 0, cachePut: 0,
    clientsClaim: 0, indexedDbGet: 0, indexedDbOpen: 0, indexedDbPut: 0, selfFetch: 0,
  };
  const legacyStore = new Map<string, unknown>([["api-cache", { status: 200 }]]);
  const cache = {
    addAll: async (assets: string[]) => { metrics.addAll.push(assets); },
    put: async () => { metrics.cachePut += 1; },
  };
  const source = readFileSync(resolve(process.cwd(), "public", "sw.js"), "utf8");
  const context = {
    URL,
    Response,
    caches: {
      delete: async () => { metrics.cacheDelete += 1; return false; },
      keys: async () => { metrics.cacheKeys += 1; return []; },
      match: async () => { metrics.cacheMatch += 1; return cachedResponse; },
      open: async () => { metrics.cacheOpen += 1; return cache; },
    },
    fetch: async () => {
      metrics.selfFetch += 1;
      if (network.kind === "reject") throw new Error("network offline");
      return new Response(JSON.stringify({ status: network.status }), { status: network.status });
    },
    indexedDB: {
      open: () => {
        metrics.indexedDbOpen += 1;
        return {
          transaction: () => ({
            objectStore: () => ({
              get: (key: string) => { metrics.indexedDbGet += 1; return legacyStore.get(key); },
              put: (value: unknown, key: string) => { metrics.indexedDbPut += 1; legacyStore.set(key, value); },
            }),
          }),
        };
      },
    },
    self: {
      addEventListener: (type: string, handler: (event: never) => void) => { handlers.set(type, handler); },
      clients: { claim: () => { metrics.clientsClaim += 1; } },
      location: { origin: "https://werkstatt.example" },
      skipWaiting: () => undefined,
    },
  };

  runInNewContext(source, context, { filename: "public/sw.js" });
  return { handlers, legacyStore, metrics, source };
}

function fetchEvent(url: string, method = "GET", mode = "cors") {
  let responsePromise: Promise<Response> | undefined;
  return {
    event: {
      request: { url, method, mode, headers: new Headers() },
      waitUntil: (_promise:Promise<unknown>) => { void _promise; },
      respondWith: (response: Promise<Response> | Response) => { responsePromise = Promise.resolve(response); },
    },
    responsePromise: () => responsePromise,
  };
}

function expectNoStorageOrFetch(metrics: Metrics) {
  expect(metrics).toMatchObject({
    cacheDelete: 0, cacheKeys: 0, cacheMatch: 0, cacheOpen: 0, cachePut: 0,
    indexedDbGet: 0, indexedDbOpen: 0, indexedDbPut: 0, selfFetch: 0,
  });
}

describe("service worker containment contract", () => {
  it("installs exactly the static public asset allowlist", async () => {
    const { handlers, metrics } = loadWorker();
    const work: Promise<unknown>[] = [];
    handlers.get("install")?.({ waitUntil: (promise: Promise<unknown>) => work.push(promise) } as never);
    await Promise.all(work);
    expect(metrics.cacheOpen).toBe(1);
    expect(metrics.addAll).toEqual([staticAssets]);
  });

  it("claims clients on activate without deleting caches or legacy data", () => {
    const { handlers, legacyStore, metrics } = loadWorker();
    handlers.get("activate")?.({} as never);
    expect(metrics.clientsClaim).toBe(1);
    expectNoStorageOrFetch(metrics);
    expect([...legacyStore.entries()]).toEqual([["api-cache", { status: 200 }]]);
  });

  it.each([200, 401, 403, 500] as const)(
    "leaves every API and Supabase method on the browser path for a configured %i response",
    (status) => {
      const { handlers, legacyStore, metrics } = loadWorker({ network: { kind: "response", status } });
      for (const prefix of ["/api/orders", "/supabase/rest/v1/orders"]) {
        for (const method of ["GET", "POST", "PUT", "PATCH", "DELETE"]) {
          const request = fetchEvent(`https://werkstatt.example${prefix}`, method);
          handlers.get("fetch")?.(request.event as never);
          expect(request.responsePromise()).toBeUndefined();
        }
      }
      expectNoStorageOrFetch(metrics);
      expect([...legacyStore.entries()]).toEqual([["api-cache", { status: 200 }]]);
    },
  );

  it("leaves every API and Supabase method on the browser path when network would reject", () => {
    const { handlers, legacyStore, metrics } = loadWorker({ network: { kind: "reject" } });
    for (const prefix of ["/api/orders", "/supabase/rest/v1/orders"]) {
      for (const method of ["GET", "POST", "PUT", "PATCH", "DELETE"]) {
        const request = fetchEvent(`https://werkstatt.example${prefix}`, method);
        handlers.get("fetch")?.(request.event as never);
        expect(request.responsePromise()).toBeUndefined();
      }
    }
    expectNoStorageOrFetch(metrics);
    expect([...legacyStore.entries()]).toEqual([["api-cache", { status: 200 }]]);
  });

  it("awaits an exact static cache hit through respondWith", async () => {
    const cachedResponse = new Response("cached", { status: 200 });
    const { handlers, metrics } = loadWorker({ cachedResponse });
    const request = fetchEvent("https://werkstatt.example/icons/icon-192.png");
    handlers.get("fetch")?.(request.event as never);
    await expect(request.responsePromise()).resolves.toBe(cachedResponse);
    expect(metrics).toMatchObject({ cacheMatch: 1, selfFetch: 0, cacheOpen: 0, cachePut: 0 });
  });

  it("awaits an exact static cache miss network response without writing it", async () => {
    const { handlers, metrics } = loadWorker({ network: { kind: "response", status: 401 } });
    const request = fetchEvent("https://werkstatt.example/icons/icon-192.png");
    handlers.get("fetch")?.(request.event as never);
    await expect(request.responsePromise()).resolves.toMatchObject({ status: 401 });
    expect(metrics).toMatchObject({ cacheMatch: 1, selfFetch: 1, cacheOpen: 0, cachePut: 0 });
  });

  it("keeps an exact static offline denial rejected instead of synthesizing a response", async () => {
    const { handlers, metrics } = loadWorker({ network: { kind: "reject" } });
    const request = fetchEvent("https://werkstatt.example/icons/icon-192.png");
    handlers.get("fetch")?.(request.event as never);
    await expect(request.responsePromise()).rejects.toThrow("network offline");
    expect(metrics).toMatchObject({ cacheMatch: 1, selfFetch: 1, cacheOpen: 0, cachePut: 0 });
  });

  it("does not respond to query, cross-origin, protected navigation, or unknown requests", () => {
    const { handlers, metrics } = loadWorker();
    for (const [url, method, mode] of [
      ["https://werkstatt.example/icons/icon-192.png?v=1", "GET", "cors"],
      ["https://outside.example/icons/icon-192.png", "GET", "cors"],
      ["https://werkstatt.example/login", "GET", "navigate"],
      ["https://werkstatt.example/orders", "GET", "cors"],
    ] as const) {
      const request = fetchEvent(url, method, mode);
      handlers.get("fetch")?.(request.event as never);
      expect(request.responsePromise()).toBeUndefined();
    }
    expectNoStorageOrFetch(metrics);
  });

  it("serves a cached immutable build asset without touching API or login storage", async () => {
    const {handlers,metrics}=loadWorker({cachedResponse:new Response('TEST immutable build',{headers:{'content-type':'text/javascript'}})});
    const request=fetchEvent('https://werkstatt.example/_next/static/TEST/app.js');
    handlers.get('fetch')?.(request.event as never);
    expect(await (await request.responsePromise())?.text()).toBe('TEST immutable build');
    expect(metrics.selfFetch).toBe(0);expect(metrics.indexedDbOpen).toBe(0);
  });

  it("has source-level guards against API caching, synthetic responses, and fallbacks", () => {
    const { source } = loadWorker();
    expect(source).toContain('const STATIC_ASSETS = [');
    expect(source).toContain('if (request.method !== "GET") return;');
    expect(source).toContain('if (url.origin !== self.location.origin) return;');
    expect(source).not.toMatch(/\bnew\s+Response\s*\(|deleteDatabase|objectStore\([^)]*\)\.put/);
    expect(source).toContain('open.transaction.abort()');
    expect(source).toContain('db.transaction("shellMetadata", "readonly")');
    expect(source).not.toMatch(/(?:pathname|url\.pathname)\s*(?:===|\.startsWith|\.includes|\.match)\s*\(?\s*["'][^"']*\/(?:api|supabase)(?:\/|["'])/i);
    expect(source).not.toMatch(/\bapi-cache\b/);
    expect(source).toContain('parts[2] !== login');
    expect(source).toContain('current.cacheGeneration !== selected.generation');
    expect(source).not.toMatch(/OFFLINE_URL|url\.pathname\s*===\s*["']\/["']/i);
  });
});

it('PL00:11 never invents an offline navigation response without the real private fence',async()=>{
 const {handlers,metrics}=loadWorker({network:{kind:'reject'}}),request=fetchEvent('https://werkstatt.example/customers','GET','navigate');
 handlers.get('fetch')?.(request.event as never);await expect(request.responsePromise()).rejects.toThrow('network offline');expect(metrics.indexedDbOpen).toBe(0);expect(metrics.cachePut).toBe(0);
});
