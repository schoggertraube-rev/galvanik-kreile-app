import { AsyncLocalStorage } from "node:async_hooks";
import { createHmac } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import process from "node:process";
import { execFileSync } from "node:child_process";
import vm from "node:vm";
import bcrypt from "bcryptjs";
import { createFromFetch } from "next/dist/compiled/react-server-dom-turbopack/client.node.js";

// BF-006: echte HTTP-Session-/Autorisierungskette gegen einen ECHTEN "next start"-Server im
// Replay-Job. Testet die ECHTE Server Action reserveOrderIntakeAttachmentAction mit
// deterministischer Action-ID-Aufloesung aus dem Next.js Build-Manifest und DB-State-Snapshots.
//
// Der installierte Next-Build ist Turbopack (kein Webpack): das generierte Standalone-Artefakt
// hat KEINE .next/standalone/.next/server/webpack-runtime.js. Jede Route-Page laedt stattdessen
// beim Require ihre eigene reale SSR-Turbopack-Runtime (server/chunks/ssr/[turbopack]_runtime.js)
// und exportiert __next_app__ mit den echten Funktionen .require und .loadChunk.
//
// Dekodiert wird ausschliesslich mit dem ECHTEN React-Server-Components-Decoder
// (createFromFetch aus next/dist/compiled/react-server-dom-turbopack/client.node.js). Dieser
// Decoder loest Server-Module ueber globalThis.__next_require__ und globalThis.__next_chunk_load__
// auf (NICHT __webpack_chunk_load__). Kein handgebauter/toleranter Flight-Parser. Jede
// Vertragsverletzung wirft.
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
//  - Liest .next/standalone/.next/server/server-reference-manifest.json
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
// Der per CI tatsaechlich gestartete Server ist IMMER der Standalone-Server
// (HOSTNAME=... PORT=... node .next/standalone/server.js). Seine deploybare Next-Wurzel ist
// NICHT ROOT/.next, sondern die innere Kopie ROOT/.next/standalone/.next (next.config.ts:
// output=standalone). Genau EINE kanonische Wurzel: server-reference-manifest.json, beide
// client-reference-manifest.js-Dateien, beide Route-Page-Artefakte und der Turbopack-Runtime-
// Provenienznachweis werden ALLE deterministisch aus genau dieser inneren Wurzel gelesen/geladen
// -- keine Kandidatenliste, kein Fallback/Mischen mit ROOT/.next, kein rekursives Scannen.
const STANDALONE_SERVER_PATH = path.join(ROOT, ".next/standalone/server.js");
const STANDALONE_NEXT_ROOT = path.join(ROOT, ".next/standalone/.next");
const MANIFEST_PATH = path.join(STANDALONE_NEXT_ROOT, "server/server-reference-manifest.json");
const START_CLIENT_REFERENCE_MANIFEST_PATH = path.join(
  STANDALONE_NEXT_ROOT,
  "server/app/start/page_client-reference-manifest.js"
);
const START_CLIENT_REFERENCE_MANIFEST_ROUTE = "/start/page";
const WARENEINGANG_CLIENT_REFERENCE_MANIFEST_PATH = path.join(
  STANDALONE_NEXT_ROOT,
  "server/app/warendurchlauf/wareneingang/page_client-reference-manifest.js"
);
const WARENEINGANG_CLIENT_REFERENCE_MANIFEST_ROUTE = "/warendurchlauf/wareneingang/page";
// Echte Route-Page-Artefakte des aktuellen generierten Builds, geladen aus der tatsaechlich
// deployten Standalone-Next-Wurzel. Jedes Artefakt gehoert unverwechselbar zu genau einer Route
// und wird per echtem Node/CommonJS-Require geladen (siehe loadRoutePageArtifact); dabei laedt es
// intern seine eigene reale SSR-Turbopack-Runtime und befuellt seine eigenen __next_app__.require
// / __next_app__.loadChunk-Funktionen. Es gibt keine geteilte Runtime-Instanz ueber Routen hinweg.
const START_PAGE_ARTIFACT_PATH = path.join(STANDALONE_NEXT_ROOT, "server/app/start/page.js");
const WARENEINGANG_PAGE_ARTIFACT_PATH = path.join(
  STANDALONE_NEXT_ROOT,
  "server/app/warendurchlauf/wareneingang/page.js"
);
// Reiner Existenz-/Provenienznachweis: der aktuelle generierte Standalone-Build ist ein
// Turbopack-Build (kein Webpack-Build). Diese Datei wird NICHT per Require geladen -- sie dient
// ausschliesslich dazu, VOR jedem Route-Bootstrap fail-closed zu pruefen, dass die erwartete
// Turbopack-Runtime-Chunk-Datei in der kanonischen Standalone-Next-Wurzel tatsaechlich existiert.
const TURBOPACK_RUNTIME_PROVENANCE_PATH = path.join(
  STANDALONE_NEXT_ROOT,
  "server/chunks/[turbopack]_runtime.js"
);
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

// Validiert fail-closed, dass der tatsaechlich per CI gestartete Standalone-Server existiert,
// BEVOR Runtime- oder Route-Page-Artefakte aus seiner inneren .next-Wurzel geladen werden. Keine
// Kandidatenliste, kein Fallback auf ROOT/.next: der einzige zulaessige kanonische Ursprung ist
// exakt .next/standalone/server.js mit seiner inneren Next-Wurzel .next/standalone/.next. Prueft
// zusaetzlich die Turbopack-Runtime-Provenienzdatei, damit ein versehentlicher Webpack-Build
// (fehlende [turbopack]_runtime.js) sofort fail-closed erkannt wird statt spaeter beim Route-
// Bootstrap mit einer verwirrenden Require-Fehlermeldung zu scheitern.
function assertCanonicalStandaloneServerExists() {
  if (!existsSync(STANDALONE_SERVER_PATH)) {
    throw new Error(
      `Kanonischer Standalone-Server ${STANDALONE_SERVER_PATH} existiert nicht. Erwartet wird ` +
        `der tatsaechlich gestartete "next start"-Standalone-Server ` +
        `(HOSTNAME=... PORT=... node .next/standalone/server.js) mit seiner inneren ` +
        `Next-Wurzel ${STANDALONE_NEXT_ROOT}.`
    );
  }
  if (!existsSync(STANDALONE_NEXT_ROOT)) {
    throw new Error(
      `Innere Standalone-Next-Wurzel ${STANDALONE_NEXT_ROOT} existiert nicht, obwohl ` +
        `${STANDALONE_SERVER_PATH} vorhanden ist.`
    );
  }
  if (!existsSync(TURBOPACK_RUNTIME_PROVENANCE_PATH)) {
    throw new Error(
      `Turbopack-Runtime-Provenienzdatei ${TURBOPACK_RUNTIME_PROVENANCE_PATH} existiert nicht. ` +
        `Erwartet wird ein Turbopack-Standalone-Build (kein Webpack-Build).`
    );
  }
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

// Prueft fail-closed, dass die extrahierten Route-Runtime-Funktionen ECHT sind und keine
// No-op/Immer-Erfolg-Emulation. Ruft __next_app__.require mit einer garantiert unbekannten,
// einmaligen Modul-ID auf und verlangt, dass dieser Aufruf wirft (ein echter Turbopack-Require
// kennt diese ID nicht und wirft "Cannot find module"; ein No-op wuerde still durchlaufen oder
// undefined liefern). Ruft __next_app__.loadChunk mit einem garantiert unbekannten, einmaligen
// Chunk-Pfad auf und verlangt ein Thenable, das ablehnt statt aufzuloesen (ein echter Turbopack-
// Chunk-Loader schlaegt beim Laden einer nicht existierenden Datei fehl; ein No-op wuerde sich
// immer/sofort aufloesen).
async function assertRouteRuntimeIsReal(pageArtifactPath, routeRequire, routeLoadChunk) {
  const uniqueSuffix = `${process.pid}-${Date.now()}-${Math.random().toString(36).slice(2)}`;

  const missingModuleId = `__f0-verify-missing-module__${uniqueSuffix}`;
  let requireThrew = false;
  try {
    routeRequire(missingModuleId);
  } catch {
    requireThrew = true;
  }
  if (!requireThrew) {
    throw new Error(
      `Route-Page-Artefakt ${pageArtifactPath}: __next_app__.require('${missingModuleId}') wirft ` +
        `NICHT -- kein echter Turbopack-Require (No-op/Emulation ist nicht zulaessig)`
    );
  }

  const missingChunkPath = `server/chunks/__f0-verify-missing-chunk__${uniqueSuffix}.js`;
  let chunkPromise;
  try {
    chunkPromise = routeLoadChunk(missingChunkPath);
  } catch (error) {
    throw new Error(
      `Route-Page-Artefakt ${pageArtifactPath}: __next_app__.loadChunk('${missingChunkPath}') ` +
        `wirft synchron statt ein ablehnendes Thenable zurueckzugeben: ${error.message}`
    );
  }
  if (
    chunkPromise === null ||
    typeof chunkPromise !== "object" ||
    typeof chunkPromise.then !== "function"
  ) {
    throw new Error(
      `Route-Page-Artefakt ${pageArtifactPath}: __next_app__.loadChunk('${missingChunkPath}') ` +
        `liefert kein Thenable (typeof=${typeof chunkPromise}) -- kein echter Turbopack-Chunk-Loader`
    );
  }
  let chunkPromiseRejected = false;
  try {
    await chunkPromise;
  } catch {
    chunkPromiseRejected = true;
  }
  if (!chunkPromiseRejected) {
    throw new Error(
      `Route-Page-Artefakt ${pageArtifactPath}: __next_app__.loadChunk('${missingChunkPath}') hat ` +
        `sich NICHT abgelehnt -- kein No-op/Immer-Erfolg-Loader zulaessig`
    );
  }
}

// Laedt das ECHTE Route-Page-Artefakt (.next/standalone/.next/server/app/<route>/page.js) per
// echtem Node/CommonJS-Require (kein vm-Sandbox, keine Textauswertung), damit dessen eigene
// relative require(...)-Aufrufe -- insbesondere der Require seiner eigenen realen SSR-Turbopack-
// Runtime (server/chunks/ssr/[turbopack]_runtime.js) -- korrekt aufgeloest werden. Extrahiert
// ausschliesslich die realen Funktionen __next_app__.require und __next_app__.loadChunk dieser
// EINEN Route; es gibt keine geteilte/verglichene Runtime-Instanz ueber Routen hinweg und keine
// Pruefung auf Webpack-Eigenschaften wie .m/.f/.e.
//
// Next.js-Route-Artefakte pruefen beim Laden global auf AsyncLocalStorage. Falls sie noch nicht
// vorhanden ist, wird sie hier NUR FUER DIE DAUER DES REQUIRE temporaer mit der echten
// node:async_hooks-Implementierung gesetzt und in finally property-descriptor-genau
// wiederhergestellt (auch wenn vorher gar keine Property existierte).
//
// Fail-closed: jede Abweichung von der erwarteten Route-Bootstrap-Struktur wirft eine Exception.
async function loadRoutePageArtifact(pageArtifactPath) {
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
  const routeLoadChunk = nextApp.loadChunk;
  if (typeof routeLoadChunk !== "function") {
    throw new Error(
      `Route-Page-Artefakt ${pageArtifactPath}: __next_app__.loadChunk ist keine Funktion ` +
        `(typeof=${typeof routeLoadChunk})`
    );
  }

  await assertRouteRuntimeIsReal(pageArtifactPath, routeRequire, routeLoadChunk);

  return { require: routeRequire, loadChunk: routeLoadChunk };
}

// ECHTER React-Server-Components-Decoder. Kein Eigenbau-Parser, keine Toleranz.
// Fail-closed: jede Verletzung des Envelope-Vertrags wirft eine Exception.
//
// Der Decoder (react-server-dom-turbopack-client) loest SSR-Module ueber globalThis.__next_require__
// (Modul-Aufloesung) und globalThis.__next_chunk_load__ (Chunk-Ladung) auf -- NIEMALS
// __webpack_chunk_load__, das ist ein Webpack-Global und wird von diesem Decoder nicht gelesen.
// routeRuntime MUSS das exakte { require, loadChunk }-Paar der aufrufenden Route aus
// loadRoutePageArtifact sein. Beide Globals werden fuer die GESAMTE Dauer der Dekodierung
// (inklusive des asynchronen Aufloesens von envelope.a, da Chunk-Ladungen dort verzoegert
// ausgeloest werden koennen) gebunden und in finally exakt auf ihren vorherigen Zustand
// zurueckgesetzt -- einschliesslich vorher nicht vorhandener Properties. Die Restorability beider
// Ziel-Properties wird VOR jeder Mutation gepueft (fail-closed); beide Zuweisungen liegen
// INNERHALB des try-Blocks, damit auch ein Fehlschlag der zweiten Zuweisung den finally-Block mit
// der Wiederherstellung in umgekehrter Reihenfolge ausloest.
async function decodeActionResult(response, clientReferenceManifest, routeRuntime) {
  if (typeof routeRuntime !== "object" || routeRuntime === null) {
    throw new Error("decodeActionResult: routeRuntime ist kein Objekt");
  }
  const { require: routeRequire, loadChunk: routeLoadChunk } = routeRuntime;
  if (typeof routeRequire !== "function") {
    throw new Error("decodeActionResult: routegebundenes __next_app__.require ist keine Funktion");
  }
  if (typeof routeLoadChunk !== "function") {
    throw new Error(
      "decodeActionResult: routegebundenes __next_app__.loadChunk ist keine echte Funktion"
    );
  }

  const previousRequireDescriptor = assertRestorableDescriptor("__next_require__");
  const previousChunkLoadDescriptor = assertRestorableDescriptor("__next_chunk_load__");

  try {
    // Object.defineProperty statt Zuweisung: bei einer vorhandenen konfigurierbaren
    // Accessor-Property wuerde eine einfache Zuweisung deren Setter aufrufen, ohne den
    // Decoder-Global sicher durch das routegebundene __next_app__.require/.loadChunk zu ersetzen.
    // Ein eigener Data-Descriptor ersetzt jede der beiden Properties immer vollstaendig.
    Object.defineProperty(globalThis, "__next_require__", {
      value: routeRequire,
      configurable: true,
      writable: true,
      enumerable: previousRequireDescriptor ? previousRequireDescriptor.enumerable : true,
    });
    Object.defineProperty(globalThis, "__next_chunk_load__", {
      value: routeLoadChunk,
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
    // (__next_chunk_load__) oben eine Exception geworfen hat, laeuft dieser Block und macht
    // beide Mutationen exakt rueckgaengig.
    if (previousChunkLoadDescriptor) {
      Object.defineProperty(globalThis, "__next_chunk_load__", previousChunkLoadDescriptor);
    } else {
      delete globalThis.__next_chunk_load__;
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
  routeRuntime,
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
  const result = await decodeActionResult(response, clientReferenceManifest, routeRuntime);

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
  routeRuntime,
}) {
  const invocation = await invokeServerAction({
    actionId,
    args: [loginHandleFor(userId), pin],
    cookieHeader: null,
    pathname: LOGIN_ACTION_PATH,
    clientReferenceManifest,
    routeRuntime,
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
    // Fail-closed VOR jedem Zugriff auf die Standalone-Next-Wurzel: der kanonische
    // Standalone-Server muss tatsaechlich vorhanden sein (kein Fallback auf ROOT/.next).
    assertCanonicalStandaloneServerExists();
    // Jedes Route-Page-Artefakt einzeln per echtem Node/CommonJS-Require laden. Jede Route laedt
    // dabei intern ihre eigene reale SSR-Turbopack-Runtime; es gibt keine geteilte Runtime-Instanz
    // ueber Routen hinweg. loadRoutePageArtifact validiert fail-closed, dass __next_app__.require
    // und __next_app__.loadChunk echte, nicht-emulierte Funktionen sind (siehe
    // assertRouteRuntimeIsReal).
    const startRouteRuntime = await loadRoutePageArtifact(START_PAGE_ARTIFACT_PATH);
    const wareneingangRouteRuntime = await loadRoutePageArtifact(
      WARENEINGANG_PAGE_ARTIFACT_PATH
    );
    report(
      "SETUP-ROUTE-BOOTSTRAP",
      true,
      "beide Route-Page-Artefakte real geladen; __next_app__.require/.loadChunk pro Route validiert (echter Turbopack-Require wirft bei unbekannter Modul-ID, echter Chunk-Loader lehnt bei unbekanntem Chunk ab)"
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
        routeRuntime: startRouteRuntime,
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
        routeRuntime: startRouteRuntime,
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
          routeRuntime: wareneingangRouteRuntime,
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
        routeRuntime: startRouteRuntime,
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
          routeRuntime: startRouteRuntime,
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
          routeRuntime: wareneingangRouteRuntime,
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
