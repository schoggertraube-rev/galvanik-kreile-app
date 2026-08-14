import { AsyncLocalStorage } from "node:async_hooks";
import { createHmac } from "node:crypto";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import process from "node:process";
import { execFileSync } from "node:child_process";
import vm from "node:vm";
import bcrypt from "bcryptjs";
import { createFromFetch } from "next/dist/compiled/react-server-dom-webpack/client.node.js";

// BF-006: echte HTTP-Session-/Autorisierungskette gegen einen ECHTEN "next start"-Server im
// Replay-Job. Testet die ECHTE Server Action reserveOrderIntakeAttachmentAction mit
// deterministischer Action-ID-Aufloesung aus dem Next.js Build-Manifest und DB-State-Snapshots.
//
// Dekodiert wird ausschliesslich mit dem ECHTEN React-Server-Components-Decoder
// (createFromFetch aus next/dist/compiled/react-server-dom-webpack/client.node.js).
// Kein handgebauter/toleranter Flight-Parser. Jede Vertragsverletzung wirft.
//
// Kern-Vertraege:
//  1. loginWithPin: echter Login-POST -> HTTP 200 + text/x-component + dekodiertes
//     Ergebnis mit exakt {ok, role} + echtes kreile_app_session-Cookie (alles gemeinsam)
//  2. reserveOrderIntakeAttachmentAction: echte Server Action auf /warendurchlauf/wareneingang
//     mit gueltigem meister-Session -> VALIDATION_ERROR (abgelehnt wegen ungueultiger Input)
//  3. mit gueltigem readonly-Session -> FORBIDDEN (Rolle hat keine perm_op_photos)
//  4. ohne Session -> UNAUTHENTICATED
//  5. mit manipuliertem Cookie -> UNAUTHENTICATED
//  6. Vor + nach den Reserve-Aufrufen: DB-State ist bit-for-bit unveraendert (Count+Digest).
//
// Manifest-basierte Action-ID-Aufloesung (keine Kandidaten, kein HTML-Scraping):
//  - Liest .next/server/server-reference-manifest.json
//  - Sucht nach exportedName="loginWithPin" im node + edge Mapping mit filename=auth.actions.ts
//  - Sucht nach exportedName="reserveOrderIntakeAttachmentAction" mit filename=actions.ts (warendurchlauf)
//  - Require genau eine Match pro Action, sonst FATAL.
//
// Aufruf (nach "npm run build" + "npx next start -p 3100"):
//   BASE_URL=http://127.0.0.1:3100 DATABASE_URL=postgresql://... \
//   APP_SESSION_SECRET=<secret> node scripts/quality/f0-verify-http-tests.mjs

const ROOT = process.cwd();
const BASE_URL = process.env.BASE_URL ?? "http://127.0.0.1:3100";
const DATABASE_URL =
  process.env.DATABASE_URL ?? "postgresql://postgres:postgres@127.0.0.1:54322/postgres";
const APP_SESSION_SECRET = process.env.APP_SESSION_SECRET;
const APP_TENANT_ID = "galvanik-kreile";
const MANIFEST_PATH = path.join(ROOT, ".next/server/server-reference-manifest.json");
const START_CLIENT_REFERENCE_MANIFEST_PATH = path.join(
  ROOT,
  ".next/server/app/start/page_client-reference-manifest.js"
);
const START_CLIENT_REFERENCE_MANIFEST_ROUTE = "/start/page";
const WARENEINGANG_CLIENT_REFERENCE_MANIFEST_PATH = path.join(
  ROOT,
  ".next/server/app/warendurchlauf/wareneingang/page_client-reference-manifest.js"
);
const WARENEINGANG_CLIENT_REFERENCE_MANIFEST_ROUTE = "/warendurchlauf/wareneingang/page";
// Echte Route-Page-Artefakte des aktuellen generierten Builds. Jedes Artefakt gehoert
// unverwechselbar zu genau einer Route und wird per echtem Node/CommonJS-Require geladen
// (siehe loadRoutePageArtifact), damit es beim Laden seine eigenen Module in die geladene
// .next/server/webpack-runtime.js registriert (__next_app__.require.m).
const START_PAGE_ARTIFACT_PATH = path.join(ROOT, ".next/server/app/start/page.js");
const WARENEINGANG_PAGE_ARTIFACT_PATH = path.join(
  ROOT,
  ".next/server/app/warendurchlauf/wareneingang/page.js"
);
// Echte Webpack-Runtime des aktuellen generierten Builds. Ihr module.exports ist die reale
// __webpack_require__-Funktion; ihre '.e'-Methode ist der reale Chunk-Loader. Vor dem Laden
// eines Route-Page-Artefakts ist ihr Modul-Register '.m' leer -- sie wird erst durch das
// jeweilige Route-Bootstrap (siehe loadRoutePageArtifact) befuellt. Fuer die Dauer der
// RSC-Dekodierung wird ausschliesslich das routegebundene __next_app__.require (identisch mit
// dieser Instanz, aber NACH Route-Bootstrap) an globalThis.__next_require__ /
// __webpack_chunk_load__ gebunden (siehe decodeActionResult), weil der ECHTE
// createFromFetch-Decoder (react-server-dom-webpack-client) SSR-Modul-Chunks der
// ssrModuleMapping ueber genau diese beiden Globals aufloest.
const WEBPACK_RUNTIME_PATH = path.join(ROOT, ".next/server/webpack-runtime.js");
const SESSION_COOKIE_NAME = "kreile_app_session";
const LOGIN_ACTION_PATH = "/start";
// V3/V4: unauthentifiziert -> proxy laesst /start unverandert durch.
const UNAUTHENTICATED_RESERVE_ACTION_PATH = "/start";
// V2/V5: authentifiziert -> proxy leitet /start per 307 um, echte Seite ist /warendurchlauf/wareneingang.
const AUTHENTICATED_RESERVE_ACTION_PATH = "/warendurchlauf/wareneingang";

let failures = 0;
function report(id, ok, detail) {
  console.log(`${ok ? "PASS" : "FAIL"}\t${id}\t${detail ?? ""}`.trimEnd());
  if (!ok) failures += 1;
}

function runSql(query) {
  const result = execFileSync("psql", ["-X", "-v", "ON_ERROR_STOP=1", "-d", DATABASE_URL, "-c", query], {
    stdio: ["ignore", "pipe", "pipe"],
    encoding: "utf8",
  });
  return result;
}

function queryForSnapshot(query) {
  const result = execFileSync("psql", ["-X", "-A", "-t", "-v", "ON_ERROR_STOP=1", "-d", DATABASE_URL, "-c", query], {
    stdio: ["ignore", "pipe", "pipe"],
    encoding: "utf8",
  });
  return result.trim();
}

function loginHandleFor(userId) {
  return createHmac("sha256", APP_SESSION_SECRET)
    .update(`pin-login:${APP_TENANT_ID}:${userId}`)
    .digest("base64url");
}

// Resolves action IDs deterministically from the Next.js manifest.
// Returns { loginWithPin, reserveOrderIntakeAttachmentAction } or throws FATAL.
function resolveActionIdsFromManifest() {
  let manifest;
  try {
    const raw = readFileSync(MANIFEST_PATH, "utf8");
    manifest = JSON.parse(raw);
  } catch (error) {
    throw new Error(`Manifest ${MANIFEST_PATH} konnte nicht gelesen werden: ${error.message}`);
  }

  if (!manifest.node || !manifest.edge) {
    throw new Error("Manifest hat keine 'node' und 'edge' Maps.");
  }

  // Deterministic filename normalization per spec:
  // 1. Backslash to Slash
  // 2. Remove leading ./
  // 3. Reject absolute paths and .. segments
  // Then require exact match with target filename.
  function normalizeAndValidateFilename(filename, target) {
    if (!filename) return false;

    let workingPath = filename;
    if (workingPath.startsWith("./")) {
      workingPath = workingPath.substring(2);
    }

    const unixStyle = workingPath.replace(/\\/g, "/");

    if (unixStyle.startsWith("/") || unixStyle.includes("..")) {
      // Fall through to Windows case with parent prefix
    } else {
      return unixStyle === target;
    }

    if (filename.startsWith("../")) {
      const afterRemoval = filename.substring(3);

      if (!path.win32.isAbsolute(afterRemoval)) {
        return false;
      }

      const canonicalRoot = path.win32.resolve(ROOT);
      const canonicalAbsolutePath = path.win32.resolve(afterRemoval);

      const relative = path.win32.relative(canonicalRoot, canonicalAbsolutePath);

      if (
        !relative ||
        path.win32.isAbsolute(relative) ||
        relative === ".." ||
        relative.startsWith(".." + path.win32.sep)
      ) {
        return false;
      }

      const normalized = relative.replace(/\\/g, "/");
      return normalized === target;
    }

    return false;
  }

  // Resolve loginWithPin from auth.actions.ts (exact match only)
  const loginIds = new Map();
  for (const [id, entry] of Object.entries(manifest.node ?? {})) {
    if (
      entry.exportedName === "loginWithPin" &&
      normalizeAndValidateFilename(entry.filename, "src/app/actions/auth.actions.ts")
    ) {
      loginIds.set(id, entry);
    }
  }
  for (const [id, entry] of Object.entries(manifest.edge ?? {})) {
    if (
      entry.exportedName === "loginWithPin" &&
      normalizeAndValidateFilename(entry.filename, "src/app/actions/auth.actions.ts")
    ) {
      loginIds.set(id, entry); // Deduplicate by id
    }
  }
  if (loginIds.size === 0) {
    throw new Error("loginWithPin action ID nicht im Manifest gefunden.");
  }
  if (loginIds.size > 1) {
    throw new Error(
      `loginWithPin hat ${loginIds.size} Action IDs (ambiguous): ${[...loginIds.keys()].join(", ")}`
    );
  }
  const loginWithPinId = [...loginIds.keys()][0];

  // Resolve reserveOrderIntakeAttachmentAction from warendurchlauf/actions.ts (exact match only)
  const reserveIds = new Map();
  for (const [id, entry] of Object.entries(manifest.node ?? {})) {
    if (
      entry.exportedName === "reserveOrderIntakeAttachmentAction" &&
      normalizeAndValidateFilename(entry.filename, "src/app/warendurchlauf/actions.ts")
    ) {
      reserveIds.set(id, entry);
    }
  }
  for (const [id, entry] of Object.entries(manifest.edge ?? {})) {
    if (
      entry.exportedName === "reserveOrderIntakeAttachmentAction" &&
      normalizeAndValidateFilename(entry.filename, "src/app/warendurchlauf/actions.ts")
    ) {
      reserveIds.set(id, entry); // Deduplicate by id
    }
  }
  if (reserveIds.size === 0) {
    throw new Error(
      "reserveOrderIntakeAttachmentAction action ID nicht im Manifest gefunden."
    );
  }
  if (reserveIds.size > 1) {
    throw new Error(
      `reserveOrderIntakeAttachmentAction hat ${reserveIds.size} Action IDs (ambiguous): ${[...reserveIds.keys()].join(", ")}`
    );
  }
  const reserveOrderIntakeAttachmentActionId = [...reserveIds.keys()][0];

  return { loginWithPinId, reserveOrderIntakeAttachmentActionId };
}

// Laedt das ECHTE Next.js-Build-Artefakt fuer eine RSC-Client-Reference-Manifest-Route
// per node:vm runInNewContext (kein handgebautes JSON-/Flight-Parsing).
// Fail-closed: jede Verletzung der erwarteten Struktur wirft eine Exception.
function loadClientReferenceManifest(manifestPath, manifestRoute) {
  let source;
  try {
    source = readFileSync(manifestPath, "utf8");
  } catch (error) {
    throw new Error(
      `Client-Reference-Manifest ${manifestPath} konnte nicht gelesen werden: ${error.message}`
    );
  }

  const sandbox = {};
  sandbox.globalThis = sandbox;

  try {
    vm.runInNewContext(source, sandbox, { filename: manifestPath });
  } catch (error) {
    throw new Error(
      `Client-Reference-Manifest ${manifestPath} konnte nicht ausgewertet werden: ${error.message}`
    );
  }

  const manifestByRoute = sandbox.__RSC_MANIFEST;
  if (typeof manifestByRoute !== "object" || manifestByRoute === null) {
    throw new Error("Client-Reference-Manifest hat kein Objekt '__RSC_MANIFEST'");
  }

  const entry = manifestByRoute[manifestRoute];
  if (typeof entry !== "object" || entry === null || Array.isArray(entry)) {
    throw new Error(
      `Client-Reference-Manifest hat keinen Objekt-Eintrag fuer '${manifestRoute}'`
    );
  }

  const { moduleLoading, ssrModuleMapping } = entry;
  if (moduleLoading === undefined) {
    throw new Error(
      `Client-Reference-Manifest-Eintrag fuer '${manifestRoute}' hat kein 'moduleLoading'`
    );
  }
  if (
    typeof ssrModuleMapping !== "object" ||
    ssrModuleMapping === null ||
    Array.isArray(ssrModuleMapping) ||
    Object.keys(ssrModuleMapping).length === 0
  ) {
    throw new Error(
      `Client-Reference-Manifest-Eintrag fuer '${manifestRoute}' hat kein nicht-leeres Objekt 'ssrModuleMapping'`
    );
  }

  return { moduleLoading, ssrModuleMapping };
}

function extractSessionCookie(response) {
  const raw =
    typeof response.headers.getSetCookie === "function"
      ? response.headers.getSetCookie()
      : [response.headers.get("set-cookie")].filter(Boolean);
  for (const entry of raw) {
    const match = entry.match(/kreile_app_session=([^;]+)/);
    if (match) return `kreile_app_session=${match[1]}`;
  }
  return null;
}

// Laedt und validiert die ECHTE Webpack-Runtime des aktuellen generierten Builds
// (.next/server/webpack-runtime.js) ueber den echten Node-CommonJS-Require (kein vm-Sandbox,
// keine Textauswertung), damit ihre eigenen relativen require("./chunks/...")-Aufrufe korrekt
// aufgeloest werden. module.exports muss die reale __webpack_require__-Funktion sein, mit
// echtem Modul-Register '.m', echtem Chunk-Handler-Register '.f' (mind. ein Handler, z.B.
// 'require') und einer echten Chunk-Lade-Funktion '.e'. Fail-closed: jede Abweichung wirft.
// Wird genau einmal pro Prozess geladen/validiert und danach wiederverwendet (siehe
// getRealWebpackRuntime).
function loadRealWebpackRuntime() {
  const requireFromRuntimeDir = createRequire(WEBPACK_RUNTIME_PATH);

  let runtimeExports;
  try {
    runtimeExports = requireFromRuntimeDir(WEBPACK_RUNTIME_PATH);
  } catch (error) {
    throw new Error(
      `Webpack-Runtime ${WEBPACK_RUNTIME_PATH} konnte nicht geladen werden: ${error.message}`
    );
  }

  if (typeof runtimeExports !== "function") {
    throw new Error(
      `Webpack-Runtime ${WEBPACK_RUNTIME_PATH}: module.exports ist keine Funktion (typeof=${typeof runtimeExports}); erwartet wird die reale __webpack_require__-Funktion`
    );
  }
  if (typeof runtimeExports.m !== "object" || runtimeExports.m === null) {
    throw new Error(
      `Webpack-Runtime ${WEBPACK_RUNTIME_PATH}: kein Modul-Register '.m' gefunden`
    );
  }
  if (typeof runtimeExports.f !== "object" || runtimeExports.f === null) {
    throw new Error(
      `Webpack-Runtime ${WEBPACK_RUNTIME_PATH}: kein Chunk-Handler-Register '.f' gefunden`
    );
  }
  const chunkHandlerKeys = Object.keys(runtimeExports.f).filter(
    (key) => typeof runtimeExports.f[key] === "function"
  );
  if (chunkHandlerKeys.length === 0) {
    throw new Error(
      `Webpack-Runtime ${WEBPACK_RUNTIME_PATH}: '.f' enthaelt keinen registrierten Chunk-Handler`
    );
  }
  if (typeof runtimeExports.e !== "function") {
    throw new Error(
      `Webpack-Runtime ${WEBPACK_RUNTIME_PATH}: keine Funktion '.e' gefunden (erwartet wird der reale Chunk-Loader)`
    );
  }

  return runtimeExports;
}

let cachedRealWebpackRuntime = null;
function getRealWebpackRuntime() {
  if (cachedRealWebpackRuntime === null) {
    cachedRealWebpackRuntime = loadRealWebpackRuntime();
  }
  return cachedRealWebpackRuntime;
}

// Liest den aktuellen Property-Descriptor von globalThis[propertyName] und wirft FAIL-CLOSED,
// wenn eine bereits vorhandene Property nicht-konfigurierbar ist -- dann koennte sie nach einer
// temporaeren Ersetzung nicht mehr exakt wiederhergestellt werden. Wird VOR jeder Mutation
// aufgerufen (kein Fallback, kein stiller Ueberschreib-Versuch).
function assertRestorableDescriptor(propertyName) {
  const descriptor = Object.getOwnPropertyDescriptor(globalThis, propertyName);
  if (descriptor && descriptor.configurable === false) {
    throw new Error(
      `globalThis.${propertyName} ist bereits als nicht-konfigurierbare Property gesetzt ` +
        `und kann nicht sicher temporaer ersetzt und wiederhergestellt werden.`
    );
  }
  return descriptor;
}

// Laedt das ECHTE Route-Page-Artefakt (.next/server/app/<route>/page.js) per echtem
// Node/CommonJS-Require (kein vm-Sandbox, keine Textauswertung), damit dessen eigene relative
// require(...)-Aufrufe -- insbesondere der Require der Webpack-Runtime -- ueber den Node
// Require-Cache korrekt und identisch mit der bereits geladenen .next/server/webpack-runtime.js
// aufgeloest werden. Genau dieser Ladevorgang befuellt das Modul-Register '.m' der Runtime
// (Route-Bootstrap).
//
// Next.js-Route-Artefakte pruefen beim Laden global auf AsyncLocalStorage. Falls sie noch nicht
// vorhanden ist, wird sie hier NUR FUER DIE DAUER DES REQUIRE temporaer mit der echten
// node:async_hooks-Implementierung gesetzt und in finally property-descriptor-genau
// wiederhergestellt (auch wenn vorher gar keine Property existierte).
//
// Fail-closed: jede Abweichung von der erwarteten Route-Bootstrap-Struktur wirft eine Exception.
// expectedWebpackRuntime muss dieselbe Funktionsinstanz sein wie das Ergebnis von
// getRealWebpackRuntime() -- keine strukturelle Aehnlichkeit, sondern Referenzgleichheit.
function loadRoutePageArtifact(pageArtifactPath, expectedWebpackRuntime) {
  if (typeof expectedWebpackRuntime !== "function") {
    throw new Error(
      `loadRoutePageArtifact(${pageArtifactPath}): expectedWebpackRuntime ist keine Funktion`
    );
  }

  const previousAsyncLocalStorageDescriptor = assertRestorableDescriptor("AsyncLocalStorage");
  const needsAsyncLocalStorage = typeof globalThis.AsyncLocalStorage !== "function";

  let pageExports;
  try {
    if (needsAsyncLocalStorage) {
      // Object.defineProperty statt Zuweisung: bei einer vorhandenen konfigurierbaren
      // Accessor-Property wuerde eine einfache Zuweisung deren Setter aufrufen, ohne den
      // Decoder-Global sicher durch die echte AsyncLocalStorage-Implementierung zu ersetzen.
      // Ein eigener Data-Descriptor ersetzt die Property immer vollstaendig.
      Object.defineProperty(globalThis, "AsyncLocalStorage", {
        value: AsyncLocalStorage,
        configurable: true,
        writable: true,
        enumerable: previousAsyncLocalStorageDescriptor
          ? previousAsyncLocalStorageDescriptor.enumerable
          : true,
      });
    }

    const requireFromPageDir = createRequire(pageArtifactPath);
    try {
      pageExports = requireFromPageDir(pageArtifactPath);
    } catch (error) {
      throw new Error(
        `Route-Page-Artefakt ${pageArtifactPath} konnte nicht geladen werden: ${error.message}`
      );
    }
  } finally {
    if (needsAsyncLocalStorage) {
      if (previousAsyncLocalStorageDescriptor) {
        Object.defineProperty(
          globalThis,
          "AsyncLocalStorage",
          previousAsyncLocalStorageDescriptor
        );
      } else {
        delete globalThis.AsyncLocalStorage;
      }
    }
  }

  if (typeof pageExports !== "object" || pageExports === null) {
    throw new Error(`Route-Page-Artefakt ${pageArtifactPath} hat keinen Objekt-Export`);
  }

  const nextApp = pageExports.__next_app__;
  if (typeof nextApp !== "object" || nextApp === null) {
    throw new Error(`Route-Page-Artefakt ${pageArtifactPath} hat kein Objekt '__next_app__'`);
  }

  const routeRequire = nextApp.require;
  if (typeof routeRequire !== "function") {
    throw new Error(
      `Route-Page-Artefakt ${pageArtifactPath}: __next_app__.require ist keine Funktion ` +
        `(typeof=${typeof routeRequire})`
    );
  }
  if (routeRequire !== expectedWebpackRuntime) {
    throw new Error(
      `Route-Page-Artefakt ${pageArtifactPath}: __next_app__.require ist NICHT identisch mit ` +
        `der geladenen ${WEBPACK_RUNTIME_PATH}`
    );
  }
  if (
    typeof routeRequire.m !== "object" ||
    routeRequire.m === null ||
    Object.keys(routeRequire.m).length === 0
  ) {
    throw new Error(
      `Route-Page-Artefakt ${pageArtifactPath}: __next_app__.require.m ist nach Route-Bootstrap leer`
    );
  }
  if (
    typeof routeRequire.f !== "object" ||
    routeRequire.f === null ||
    typeof routeRequire.f.require !== "function"
  ) {
    throw new Error(
      `Route-Page-Artefakt ${pageArtifactPath}: __next_app__.require.f.require ist keine echte Funktion`
    );
  }
  if (typeof routeRequire.e !== "function") {
    throw new Error(
      `Route-Page-Artefakt ${pageArtifactPath}: __next_app__.require.e ist keine echte Funktion`
    );
  }

  return { require: routeRequire };
}

// ECHTER React-Server-Components-Decoder. Kein Eigenbau-Parser, keine Toleranz.
// Fail-closed: jede Verletzung des Envelope-Vertrags wirft eine Exception.
//
// Der Decoder (react-server-dom-webpack-client) loest SSR-Modul-Chunks der ssrModuleMapping
// ueber globalThis.__next_require__ (Modul-Aufloesung) und globalThis.__webpack_chunk_load__
// (Chunk-Ladung) auf. routeRequire MUSS das routegebundene __next_app__.require aus
// loadRoutePageArtifact sein (NIEMALS __next_app__.loadChunk, das im Build ein reines
// () => Promise.resolve()-Noop ist). Beide Globals werden fuer die GESAMTE Dauer der
// Dekodierung (inklusive des asynchronen Aufloesens von envelope.a, da Chunk-Ladungen dort
// verzoegert ausgeloest werden koennen) gebunden und in finally exakt auf ihren vorherigen
// Zustand zurueckgesetzt -- einschliesslich vorher nicht vorhandener Properties. Die
// Restorability beider Ziel-Properties wird VOR jeder Mutation gepueft (fail-closed); beide
// Zuweisungen liegen INNERHALB des try-Blocks, damit auch ein Fehlschlag der zweiten Zuweisung
// den finally-Block mit der Wiederherstellung in umgekehrter Reihenfolge ausloest.
async function decodeActionResult(response, clientReferenceManifest, routeRequire) {
  if (typeof routeRequire !== "function") {
    throw new Error("decodeActionResult: routegebundenes __next_app__.require ist keine Funktion");
  }
  if (typeof routeRequire.e !== "function") {
    throw new Error(
      "decodeActionResult: routegebundenes __next_app__.require.e ist keine echte Funktion " +
        "(Chunk-Loader erwartet)"
    );
  }

  const previousRequireDescriptor = assertRestorableDescriptor("__next_require__");
  const previousChunkLoadDescriptor = assertRestorableDescriptor("__webpack_chunk_load__");

  try {
    // Object.defineProperty statt Zuweisung: bei einer vorhandenen konfigurierbaren
    // Accessor-Property wuerde eine einfache Zuweisung deren Setter aufrufen, ohne den
    // Decoder-Global sicher durch das routegebundene __next_app__.require zu ersetzen.
    // Ein eigener Data-Descriptor ersetzt jede der beiden Properties immer vollstaendig.
    Object.defineProperty(globalThis, "__next_require__", {
      value: routeRequire,
      configurable: true,
      writable: true,
      enumerable: previousRequireDescriptor ? previousRequireDescriptor.enumerable : true,
    });
    Object.defineProperty(globalThis, "__webpack_chunk_load__", {
      value: routeRequire.e,
      configurable: true,
      writable: true,
      enumerable: previousChunkLoadDescriptor ? previousChunkLoadDescriptor.enumerable : true,
    });

    const envelope = await createFromFetch(Promise.resolve(response), {
      serverConsumerManifest: {
        moduleLoading: clientReferenceManifest.moduleLoading,
        moduleMap: clientReferenceManifest.ssrModuleMapping,
        serverModuleMap: null,
      },
      replayConsoleLogs: false,
    });

    if (envelope === null || envelope === undefined) {
      throw new Error("RSC-Envelope ist null/undefined");
    }
    if (Array.isArray(envelope)) {
      throw new Error("RSC-Envelope ist ein Array; erwartet wird ein Objekt");
    }
    if (typeof envelope !== "object") {
      throw new Error(`RSC-Envelope ist kein Objekt (typeof=${typeof envelope})`);
    }
    if (!Object.prototype.hasOwnProperty.call(envelope, "a")) {
      throw new Error("RSC-Envelope hat kein eigenes Feld 'a' (Action-Result-Referenz)");
    }

    const result = await envelope.a;

    if (result === null || result === undefined) {
      throw new Error("Action-Result (envelope.a) ist null/undefined");
    }
    if (Array.isArray(result)) {
      throw new Error("Action-Result ist ein Array; erwartet wird ein Objekt");
    }
    if (typeof result !== "object") {
      throw new Error(`Action-Result ist kein Objekt (typeof=${typeof result})`);
    }

    return result;
  } finally {
    // Restore in umgekehrter Reihenfolge der Installation -- auch wenn die zweite Zuweisung
    // (__webpack_chunk_load__) oben eine Exception geworfen hat, laeuft dieser Block und macht
    // beide Mutationen exakt rueckgaengig.
    if (previousChunkLoadDescriptor) {
      Object.defineProperty(globalThis, "__webpack_chunk_load__", previousChunkLoadDescriptor);
    } else {
      delete globalThis.__webpack_chunk_load__;
    }
    if (previousRequireDescriptor) {
      Object.defineProperty(globalThis, "__next_require__", previousRequireDescriptor);
    } else {
      delete globalThis.__next_require__;
    }
  }
}

// Gemeinsamer Action-Aufruf fuer ALLE Pruefungen.
// Verlangt HTTP-Status exakt 200 UND Content-Type (case-insensitive) beginnend mit
// "text/x-component". Danach echte RSC-Dekodierung. Sonst Exception.
async function invokeServerAction({
  actionId,
  args,
  cookieHeader = null,
  pathname,
  clientReferenceManifest,
  routeRequire,
}) {
  if (typeof actionId !== "string" || actionId.length === 0) {
    throw new Error("Action-ID fehlt oder ist keine nicht-leere Zeichenkette");
  }

  const headers = {
    "Next-Action": actionId,
    Accept: "text/x-component",
    "Content-Type": "text/plain;charset=UTF-8",
    Origin: BASE_URL,
  };
  if (cookieHeader) headers.Cookie = cookieHeader;

  const response = await fetch(`${BASE_URL}${pathname}`, {
    method: "POST",
    redirect: "manual",
    headers,
    body: JSON.stringify(args),
  });

  // HTTP/RSC fail-closed BEVOR der Body interpretiert wird.
  if (response.status !== 200) {
    throw new Error(`Erwartet HTTP-Status 200, erhalten ${response.status} (POST ${pathname})`);
  }

  const contentType = response.headers.get("content-type");
  if (
    typeof contentType !== "string" ||
    !contentType.toLowerCase().startsWith("text/x-component")
  ) {
    throw new Error(
      `Erwartet Content-Type text/x-component, erhalten ${contentType ?? "<keiner>"} (POST ${pathname})`
    );
  }

  // Cookies aus den Headern lesen, bevor der Body-Stream konsumiert wird.
  const cookie = extractSessionCookie(response);
  const result = await decodeActionResult(response, clientReferenceManifest, routeRequire);

  return { status: response.status, contentType, cookie, result };
}

// Login-PASS nur, wenn ALLE Bedingungen gemeinsam erfuellt sind:
// HTTP 200 + text/x-component (im gemeinsamen Aufruf), dekodiertes Ergebnis mit exakt
// den Keys {ok, role}, ok === true, role === erwartete Rolle und echtes Session-Cookie.
// Ein Cookie allein ist NIEMALS ausreichend.
async function loginAndAssert({
  actionId,
  userId,
  pin,
  expectedRole,
  clientReferenceManifest,
  routeRequire,
}) {
  const invocation = await invokeServerAction({
    actionId,
    args: [loginHandleFor(userId), pin],
    cookieHeader: null,
    pathname: LOGIN_ACTION_PATH,
    clientReferenceManifest,
    routeRequire,
  });

  const keys = Object.keys(invocation.result).sort();
  if (keys.length !== 2 || keys[0] !== "ok" || keys[1] !== "role") {
    throw new Error(
      `Login-Result muss exakt die Keys [ok, role] haben, erhalten [${keys.join(", ")}]`
    );
  }
  if (invocation.result.ok !== true) {
    throw new Error(`Login-Result ok !== true (ok=${JSON.stringify(invocation.result.ok)})`);
  }
  if (invocation.result.role !== expectedRole) {
    throw new Error(
      `Login-Result role=${JSON.stringify(invocation.result.role)}, erwartet "${expectedRole}"`
    );
  }

  const cookie = invocation.cookie;
  if (typeof cookie !== "string" || !cookie.startsWith(`${SESSION_COOKIE_NAME}=`)) {
    throw new Error(`Kein echtes ${SESSION_COOKIE_NAME}-Cookie im Response`);
  }
  const cookieValue = cookie.slice(`${SESSION_COOKIE_NAME}=`.length);
  if (cookieValue.length === 0) {
    throw new Error(`${SESSION_COOKIE_NAME}-Cookie ist leer`);
  }

  return cookie;
}

// Reserve-/Fehlercode exakt pruefen. 503/NOT_AVAILABLE ist niemals ein PASS.
function assertReserveCode(result, expectedCode) {
  const code = result.code;
  if (typeof code !== "string" || code.length === 0) {
    throw new Error(`Action-Result hat keinen nicht-leeren String 'code' (${JSON.stringify(code)})`);
  }
  if (code === "NOT_AVAILABLE") {
    throw new Error("Action-Result code=NOT_AVAILABLE (503-Reserve) ist niemals ein PASS");
  }
  if (code !== expectedCode) {
    throw new Error(`Erwartet code=${expectedCode}, erhalten code=${code}`);
  }
  return code;
}

// Captures deterministic snapshot of exactly 7 business tables.
// Each table returns { count, digest } via single query using json_build_object.
// Throws on any SQL/output/parse/schema error; no sentinel or swallowed error.
function snapshotDatabaseState() {
  const snapshot = {};

  const tables = [
    "public.orders",
    "public.items",
    "public.events",
    "private.order_station_evidence_reservations",
    "private.order_station_evidence",
    "private.evidence_extraction_metadata",
    "private.evidence_domain_links",
  ];

  for (const table of tables) {
    // Single query per table returning JSON object with exact keys [count, digest]
    const query = `SELECT json_build_object(
  'count', (SELECT count(*)::int FROM ${table}),
  'digest', md5(coalesce(
    (SELECT string_agg(to_jsonb(t)::text, E'\\n' ORDER BY to_jsonb(t)::text)
     FROM ${table} t),
    ''
  ))
)`;

    let result;
    try {
      result = queryForSnapshot(query);
    } catch (error) {
      throw new Error(`Snapshot query failed for ${table}: ${error.message}`);
    }

    const lines = result.split("\n").filter((line) => line.trim());
    if (lines.length !== 1) {
      throw new Error(`Expected exactly one output line for ${table}, got ${lines.length}`);
    }

    let parsed;
    try {
      parsed = JSON.parse(lines[0]);
    } catch (error) {
      throw new Error(`Failed to parse JSON snapshot for ${table}: ${error.message}`);
    }

    // Require plain object with exactly keys [count, digest]
    if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
      throw new Error(`Snapshot for ${table} must be plain object, got ${typeof parsed}`);
    }

    const keys = Object.keys(parsed).sort();
    if (keys.length !== 2 || keys[0] !== "count" || keys[1] !== "digest") {
      throw new Error(
        `Snapshot for ${table} must have exactly keys [count, digest], got [${keys.join(", ")}]`
      );
    }

    const count = parsed.count;
    const digest = parsed.digest;

    // Validate count: nonnegative integer
    if (!Number.isInteger(count) || count < 0) {
      throw new Error(`Invalid count for ${table}: ${count} (must be nonnegative integer)`);
    }

    // Validate digest: 32-char lowercase hex (MD5)
    if (typeof digest !== "string" || !/^[a-f0-9]{32}$/.test(digest)) {
      throw new Error(
        `Invalid digest for ${table}: ${digest} (must be 32-char lowercase hex)`
      );
    }

    snapshot[table] = { count, digest };
  }

  const snapshotKeys = Object.keys(snapshot);
  if (snapshotKeys.length !== tables.length || tables.length !== 7) {
    throw new Error(
      `Snapshot muss genau 7 Tabellen enthalten, hat ${snapshotKeys.length} (${snapshotKeys.join(", ")})`
    );
  }

  return snapshot;
}

const RESERVE_INVALID_INPUT = {
  orderId: "INVALID_FORMAT",
  itemId: "INVALID_FORMAT",
  expectedVersion: -1,
  clientRequestId: "invalid",
  mimeType: "invalid/type",
};

const RESERVE_PROBE_INPUT = {
  orderId: "x",
  itemId: "y",
  expectedVersion: 0,
  clientRequestId: "z",
  mimeType: "image/png",
};

async function main() {
  console.log(`F0-VERIFY-HTTP against ${BASE_URL}`);

  const writerId = "00000000-f0be-4006-a000-000000000001";
  const readonlyId = "00000000-f0be-4006-a000-000000000002";
  const writerPin = "4711";
  const readonlyPin = "4712";

  try {
    if (!APP_SESSION_SECRET) {
      throw new Error("APP_SESSION_SECRET env ist nicht gesetzt.");
    }

    // ── Setup: Action-IDs deterministisch aus dem Manifest (genau eine ID pro Action) ────────
    const { loginWithPinId, reserveOrderIntakeAttachmentActionId } =
      resolveActionIdsFromManifest();
    report(
      "SETUP-MANIFEST",
      true,
      `loginWithPin=${loginWithPinId.substring(0, 8)}... reserve=${reserveOrderIntakeAttachmentActionId.substring(0, 8)}...`
    );
    const startClientReferenceManifest = loadClientReferenceManifest(
      START_CLIENT_REFERENCE_MANIFEST_PATH,
      START_CLIENT_REFERENCE_MANIFEST_ROUTE
    );
    const wareneingangClientReferenceManifest = loadClientReferenceManifest(
      WARENEINGANG_CLIENT_REFERENCE_MANIFEST_PATH,
      WARENEINGANG_CLIENT_REFERENCE_MANIFEST_ROUTE
    );

    // ── Setup: echtes Route-Bootstrap ───────────────────────────────────────────────────────
    // Webpack-Runtime zuerst laden (primed den Node-Require-Cache fuer WEBPACK_RUNTIME_PATH),
    // danach jedes Route-Page-Artefakt per echtem Require laden. Jedes Page-Artefakt requiret
    // intern denselben Pfad und trifft dadurch ueber den Require-Cache exakt dieselbe Runtime-
    // Instanz, wodurch __next_app__.require.m fuer diese Route real befuellt wird.
    const webpackRuntime = getRealWebpackRuntime();
    const startRouteRequire = loadRoutePageArtifact(START_PAGE_ARTIFACT_PATH, webpackRuntime)
      .require;
    const wareneingangRouteRequire = loadRoutePageArtifact(
      WARENEINGANG_PAGE_ARTIFACT_PATH,
      webpackRuntime
    ).require;
    report(
      "SETUP-ROUTE-BOOTSTRAP",
      true,
      "beide Route-Page-Artefakte real geladen; __next_app__.require identisch mit webpack-runtime.js, .m befuellt"
    );

    // ── Setup: Test-Fixtures ────────────────────────────────────────────────────────────────
    const writerHash = bcrypt.hashSync(writerPin, 10);
    const readonlyHash = bcrypt.hashSync(readonlyPin, 10);
    runSql(`delete from public.app_users where id in ('${writerId}', '${readonlyId}')`);
    runSql(
      `insert into public.app_users (id, tenant_id, email, full_name, role, pin_hash, active) values ` +
        `('${writerId}', '${APP_TENANT_ID}', 'f0-verify-writer@example.invalid', 'F0 Verify Writer', 'meister', '${writerHash}', true), ` +
        `('${readonlyId}', '${APP_TENANT_ID}', 'f0-verify-readonly@example.invalid', 'F0 Verify Readonly', 'readonly', '${readonlyHash}', true)`
    );
    report("SETUP", true, "app_users fixtures (writer=meister, readonly=readonly)");

    // ── V1: echter Login meister (HTTP/RSC + exakte Keys + ok + role + Cookie) ───────────────
    let writerCookie = null;
    try {
      writerCookie = await loginAndAssert({
        actionId: loginWithPinId,
        userId: writerId,
        pin: writerPin,
        expectedRole: "meister",
        clientReferenceManifest: startClientReferenceManifest,
        routeRequire: startRouteRequire,
      });
      report(
        "V1",
        true,
        "HTTP200 + text/x-component + result exakt {ok:true, role:'meister'} + kreile_app_session"
      );
    } catch (error) {
      report("V1", false, `meister login: ${error.message}`);
    }

    // ── V1-READONLY: echter Login readonly ──────────────────────────────────────────────────
    let readonlyCookie = null;
    try {
      readonlyCookie = await loginAndAssert({
        actionId: loginWithPinId,
        userId: readonlyId,
        pin: readonlyPin,
        expectedRole: "readonly",
        clientReferenceManifest: startClientReferenceManifest,
        routeRequire: startRouteRequire,
      });
      report(
        "V1-READONLY",
        true,
        "HTTP200 + text/x-component + result exakt {ok:true, role:'readonly'} + kreile_app_session"
      );
    } catch (error) {
      report("V1-READONLY", false, `readonly login: ${error.message}`);
    }

    // ── DB-Snapshot vor den Reserve-Aufrufen ────────────────────────────────────────────────
    let snapshotBefore = null;
    try {
      snapshotBefore = snapshotDatabaseState();
      report("SNAPSHOT-BEFORE", true, "DB state captured (7 Tabellen)");
    } catch (error) {
      report("SNAPSHOT-BEFORE", false, `Snapshot failed: ${error.message}`);
    }

    // ── V2: meister + ungueltige Daten -> VALIDATION_ERROR ──────────────────────────────────
    if (writerCookie) {
      try {
        const invocation = await invokeServerAction({
          actionId: reserveOrderIntakeAttachmentActionId,
          args: [RESERVE_INVALID_INPUT],
          cookieHeader: writerCookie,
          pathname: AUTHENTICATED_RESERVE_ACTION_PATH,
          clientReferenceManifest: wareneingangClientReferenceManifest,
          routeRequire: wareneingangRouteRequire,
        });
        const code = assertReserveCode(invocation.result, "VALIDATION_ERROR");
        report("V2", true, `code=${code}`);
      } catch (error) {
        report("V2", false, `V2: ${error.message}`);
      }
    } else {
      report("V2", false, "meister session fehlt (V1 nicht bestanden)");
    }

    // ── V3: keine Session -> UNAUTHENTICATED ────────────────────────────────────────────────
    try {
      const invocation = await invokeServerAction({
        actionId: reserveOrderIntakeAttachmentActionId,
        args: [RESERVE_PROBE_INPUT],
        cookieHeader: null,
        pathname: UNAUTHENTICATED_RESERVE_ACTION_PATH,
        clientReferenceManifest: startClientReferenceManifest,
        routeRequire: startRouteRequire,
      });
      const code = assertReserveCode(invocation.result, "UNAUTHENTICATED");
      report("V3", true, `code=${code}`);
    } catch (error) {
      report("V3", false, `V3: ${error.message}`);
    }

    // ── V4: manipulierte Session -> UNAUTHENTICATED ─────────────────────────────────────────
    if (writerCookie) {
      try {
        const tampered =
          writerCookie.slice(0, -1) + (writerCookie.endsWith("a") ? "b" : "a");
        const invocation = await invokeServerAction({
          actionId: reserveOrderIntakeAttachmentActionId,
          args: [RESERVE_PROBE_INPUT],
          cookieHeader: tampered,
          pathname: UNAUTHENTICATED_RESERVE_ACTION_PATH,
          clientReferenceManifest: startClientReferenceManifest,
          routeRequire: startRouteRequire,
        });
        const code = assertReserveCode(invocation.result, "UNAUTHENTICATED");
        report("V4", true, `code=${code}`);
      } catch (error) {
        report("V4", false, `V4: ${error.message}`);
      }
    } else {
      report("V4", false, "meister session fehlt (V1 nicht bestanden)");
    }

    // ── V5: readonly-Rolle -> FORBIDDEN ─────────────────────────────────────────────────────
    if (readonlyCookie) {
      try {
        const invocation = await invokeServerAction({
          actionId: reserveOrderIntakeAttachmentActionId,
          args: [RESERVE_PROBE_INPUT],
          cookieHeader: readonlyCookie,
          pathname: AUTHENTICATED_RESERVE_ACTION_PATH,
          clientReferenceManifest: wareneingangClientReferenceManifest,
          routeRequire: wareneingangRouteRequire,
        });
        const code = assertReserveCode(invocation.result, "FORBIDDEN");
        report("V5", true, `code=${code}`);
      } catch (error) {
        report("V5", false, `V5: ${error.message}`);
      }
    } else {
      report("V5", false, "readonly session fehlt (V1-READONLY nicht bestanden)");
    }

    // ── DB-Snapshot nach den Reserve-Aufrufen ───────────────────────────────────────────────
    let snapshotAfter = null;
    try {
      snapshotAfter = snapshotDatabaseState();
      report("SNAPSHOT-AFTER", true, "DB state captured (7 Tabellen)");
    } catch (error) {
      report("SNAPSHOT-AFTER", false, `Snapshot failed: ${error.message}`);
    }

    // ── Snapshot-Vergleich: identische Keysets und Werte, genau 7 Tabellen ───────────────────
    if (snapshotBefore && snapshotAfter) {
      const beforeKeys = Object.keys(snapshotBefore).sort();
      const afterKeys = Object.keys(snapshotAfter).sort();

      let match = true;
      const diffs = [];

      if (beforeKeys.length !== 7 || afterKeys.length !== 7) {
        match = false;
        diffs.push(
          `table count: before=${beforeKeys.length} after=${afterKeys.length} (expected 7)`
        );
      }

      for (const table of afterKeys) {
        if (!Object.prototype.hasOwnProperty.call(snapshotBefore, table)) {
          match = false;
          diffs.push(`${table}: zusaetzlich in after`);
        }
      }

      for (const table of beforeKeys) {
        if (!Object.prototype.hasOwnProperty.call(snapshotAfter, table)) {
          match = false;
          diffs.push(`${table}: fehlt in after`);
          continue;
        }
        const b = snapshotBefore[table];
        const a = snapshotAfter[table];
        if (b.count !== a.count || b.digest !== a.digest) {
          match = false;
          diffs.push(
            `${table}: count ${b.count}->${a.count} digest ${b.digest.substring(0, 8)}...->${a.digest.substring(0, 8)}...`
          );
        }
      }

      report("SNAPSHOT-COMPARE", match, match ? "all 7 tables unchanged" : diffs.join("; "));
    } else {
      report("SNAPSHOT-COMPARE", false, "Snapshot vorher und/oder nachher fehlt");
    }
  } finally {
    // ── Cleanup: Fixtures immer entfernen ───────────────────────────────────────────────────
    try {
      runSql(`delete from public.app_users where id in ('${writerId}', '${readonlyId}')`);
    } catch (error) {
      report("CLEANUP", false, `app_users delete failed: ${error.message}`);
    }
  }

  // ── Finaler Report: genau ein expliziter Exit nach dem finally-Block ───────────────────────
  console.log(`F0_VERIFY_HTTP_FAILURES=${failures}`);
  console.log(failures === 0 ? "F0_VERIFY_HTTP=PASS" : "F0_VERIFY_HTTP=FAIL");
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((error) => {
  console.error("F0-VERIFY-HTTP FATAL:", error);
  console.log(`F0_VERIFY_HTTP_FAILURES=${failures + 1}`);
  console.log("F0_VERIFY_HTTP=FAIL");
  process.exitCode = 1;
});
