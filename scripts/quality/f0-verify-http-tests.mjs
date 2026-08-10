import { execFileSync } from "node:child_process";
import { createHmac } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";
import process from "node:process";
import bcrypt from "bcryptjs";

// BF-006: echte HTTP-Session-/Autorisierungskette gegen einen ECHTEN "next start"-Server im
// Replay-Job. Schliesst die im Befund beschriebene Beweisluecke: der einzige bisher in CI
// laufende Integrationstest (scan_order.integration.test.ts) mockt
// "@/lib/server/authorization" vollstaendig; verify.integration.test.ts kann in CI nicht laufen,
// weil ein direkter Funktionsaufruf ausserhalb eines echten Next-Request-Scopes cookies() zum
// Werfen bringt. Dieses Skript umgeht beides nicht, sondern spricht den Server ausschliesslich
// ueber echtes HTTP an (echte Cookies, echte Server-Action-Ausfuehrung, echte DB-Lookups).
//
// Pfade/Cookies stammen aus dem tatsaechlichen Code (nicht angenommen):
//  - Cookie-Name/Signatur: src/lib/server/appSession.ts (COOKIE_NAME="kreile_app_session",
//    HMAC-SHA256 ueber JSON-Payload, base64(payload)+"."+hex(sig)).
//  - Login: src/app/actions/auth.actions.ts::loginWithPin(loginHandle, pin) - Server Action
//    ("use server"), aufgerufen aus src/components/start/StartScreenClient.tsx per onClick (kein
//    <form action>, also der fetch/Next-Action-Pfad, nicht der No-JS-Formular-Fallback).
//    StartScreenClient wird von src/app/start/page.tsx gerendert -> die reale Seiten-URL ist
//    "/start", NICHT "/" (CI-Fund 2026-08-10-Zyklus-3: mit POST-Ziel "/" kam nie ein
//    Set-Cookie zustande - unten korrigiert auf "/start" fuer Discovery-GET UND Action-POST).
//  - loginHandle ist KEIN DB-Feld, sondern HMAC-SHA256(APP_SESSION_SECRET,
//    "pin-login:<tenant>:<userId>") als base64url (src/lib/server/pinLoginHandle.ts) - hier
//    identisch nachgebaut, da dasselbe APP_SESSION_SECRET dem Testserver mitgegeben wird.
//  - Autorisierungsgrenze: src/app/api/erfassung/item-photo-upload/route.ts ruft zuerst
//    checkAppAuthorization("write") (src/lib/server/authHelper.ts). WRITE_ROLES enthaelt
//    "readonly" NICHT -> ein echter, gueltig eingeloggter readonly-User wird trotzdem
//    authentifiziert, aber fuer "write" abgelehnt (V5). Fehlt jede Session -> 401 (V3). Eine
//    manipulierte Signatur -> INVALID_SIGNATURE -> 401 (V4). Eine erfolgreiche Anfrage ohne
//    "file"-Feld erreicht nachweislich die Business-Logik hinter dem Auth-Gate (400 "No file
//    provided" statt 401) - das ist der Erfolgsvertrag fuer V2, ohne an Storage/Edge-Function-
//    Infrastruktur zu koppeln (das ist BF-007s Gegenstand).
//
// V1 (echter Login-POST) ist die einzige Stelle, die den internen Next.js Server-Action-
// Transport braucht (POST auf die Seiten-URL, Header "Next-Action: <id>", Body = JSON-Array der
// Argumente, Content-Type text/plain). Die Action-ID ist ein build-zeitiger Hash ohne stabile
// oeffentliche Formel; statt sie zu erraten, werden ALLE plausiblen Kandidaten-IDs aus dem echten
// Build-Manifest (.next/server/server-reference-manifest.json) UND aus der ausgelieferten HTML
// gesammelt und der Reihe nach versucht, bis eine tatsaechlich ein Set-Cookie fuer
// kreile_app_session liefert. Schlaegt das fehl, bricht das Skript mit vollem Diagnosetext ab
// (keine stille Ersatzloesung, die die Pruefgrenze aufweicht).
//
// Aufruf (Replay-Job, nach "npm run build" + "npx next start -p 3100" + Readiness-Loop):
//   BASE_URL=http://127.0.0.1:3100 DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:54322/postgres \
//   APP_SESSION_SECRET=<gleiches Secret wie beim next-start-Prozess> \
//   node scripts/quality/f0-verify-http-tests.mjs

const ROOT = process.cwd();
const BASE_URL = process.env.BASE_URL ?? "http://127.0.0.1:3100";
const DATABASE_URL =
  process.env.DATABASE_URL ?? "postgresql://postgres:postgres@127.0.0.1:54322/postgres";
const APP_SESSION_SECRET = process.env.APP_SESSION_SECRET;
const APP_TENANT_ID = "galvanik-kreile";
const MANIFEST_PATH = path.join(ROOT, ".next/server/server-reference-manifest.json");

if (!APP_SESSION_SECRET) {
  console.error("F0-VERIFY-HTTP FATAL: APP_SESSION_SECRET env ist nicht gesetzt.");
  process.exit(1);
}

let failures = 0;
function report(id, ok, detail) {
  console.log(`${ok ? "PASS" : "FAIL"}\t${id}\t${detail ?? ""}`.trimEnd());
  if (!ok) failures += 1;
}

function runSql(query) {
  execFileSync("psql", [DATABASE_URL, "-v", "ON_ERROR_STOP=1", "-c", query], {
    stdio: ["ignore", "pipe", "pipe"],
  });
}

function loginHandleFor(userId) {
  return createHmac("sha256", APP_SESSION_SECRET)
    .update(`pin-login:${APP_TENANT_ID}:${userId}`)
    .digest("base64url");
}

// Sammelt alle plausiblen Server-Action-IDs (lange Hex-Strings) rekursiv aus einer beliebigen
// JSON-Struktur, unabhaengig vom genauen Manifest-Schema (das sich zwischen Next-Versionen
// unterscheiden kann - Werte werden gesucht, nicht ein fester Schluesselpfad vorausgesetzt).
function collectHexLikeStrings(value, out) {
  if (typeof value === "string") {
    if (/^[a-f0-9]{16,64}$/i.test(value)) out.add(value.toLowerCase());
    return;
  }
  if (Array.isArray(value)) {
    for (const entry of value) collectHexLikeStrings(entry, out);
    return;
  }
  if (value && typeof value === "object") {
    for (const [key, entry] of Object.entries(value)) {
      if (/^[a-f0-9]{16,64}$/i.test(key)) out.add(key.toLowerCase());
      collectHexLikeStrings(entry, out);
    }
  }
}

async function discoverCandidateActionIds() {
  const candidates = new Set();

  try {
    const manifestRaw = readFileSync(MANIFEST_PATH, "utf8");
    collectHexLikeStrings(JSON.parse(manifestRaw), candidates);
  } catch (error) {
    console.log(`F0-VERIFY-HTTP NOTICE: Manifest ${MANIFEST_PATH} nicht lesbar (${error.message}).`);
  }

  try {
    const html = await fetch(`${BASE_URL}/start`, { headers: { Accept: "text/html" } }).then((r) => r.text());
    const found = html.match(/[a-f0-9]{16,64}/gi) ?? [];
    for (const id of found) candidates.add(id.toLowerCase());
  } catch (error) {
    console.log(`F0-VERIFY-HTTP NOTICE: GET ${BASE_URL}/start fuer Kandidatensuche fehlgeschlagen (${error.message}).`);
  }

  return [...candidates];
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

async function tryServerAction(actionId, args) {
  const response = await fetch(`${BASE_URL}/start`, {
    method: "POST",
    redirect: "manual",
    headers: {
      "Next-Action": actionId,
      Accept: "text/x-component",
      "Content-Type": "text/plain;charset=UTF-8",
      Origin: BASE_URL,
    },
    body: JSON.stringify(args),
  });
  const cookie = extractSessionCookie(response);
  return { status: response.status, cookie };
}

async function realLogin(label, loginHandle, pin, candidateIds) {
  const attempts = [];
  for (const actionId of candidateIds) {
    let result;
    try {
      result = await tryServerAction(actionId, [loginHandle, pin]);
    } catch (error) {
      attempts.push(`${actionId}: fetch error ${error.message}`);
      continue;
    }
    attempts.push(`${actionId}: status=${result.status} cookie=${result.cookie ? "yes" : "no"}`);
    if (result.cookie) {
      return { cookie: result.cookie, actionId, attempts };
    }
  }
  return { cookie: null, actionId: null, attempts };
}

async function uploadRequest(cookieHeader) {
  const headers = {};
  if (cookieHeader) headers.Cookie = cookieHeader;
  const response = await fetch(`${BASE_URL}/api/erfassung/item-photo-upload`, {
    method: "POST",
    headers,
    body: new FormData(), // bewusst ohne "file" -> Auth-Gate wird trotzdem zuerst durchlaufen.
  });
  let bodyText = "";
  try {
    bodyText = await response.text();
  } catch {
    // ignore body read errors for the assertions below
  }
  return { status: response.status, bodyText };
}

async function main() {
  console.log(`F0-VERIFY-HTTP against ${BASE_URL}`);

  // ── Setup: zwei echte app_users-Zeilen mit zur Laufzeit erzeugtem bcrypt-PIN-Hash ──────────
  const writerId = "00000000-f0be-4006-a000-000000000001";
  const readonlyId = "00000000-f0be-4006-a000-000000000002";
  const writerPin = "4711";
  const readonlyPin = "4712";
  const writerHash = bcrypt.hashSync(writerPin, 10);
  const readonlyHash = bcrypt.hashSync(readonlyPin, 10);

  runSql(`delete from public.app_users where id in ('${writerId}', '${readonlyId}')`);
  runSql(
    `insert into public.app_users (id, tenant_id, email, full_name, role, pin_hash, active) values ` +
      `('${writerId}', '${APP_TENANT_ID}', 'f0-verify-writer@example.invalid', 'F0 Verify Writer', 'meister', '${writerHash}', true), ` +
      `('${readonlyId}', '${APP_TENANT_ID}', 'f0-verify-readonly@example.invalid', 'F0 Verify Readonly', 'readonly', '${readonlyHash}', true)`,
  );
  report("SETUP", true, "app_users Fixtures (writer=meister, readonly=readonly) angelegt");

  const candidateIds = await discoverCandidateActionIds();
  report("SETUP-DISCOVERY", candidateIds.length > 0, `${candidateIds.length} Kandidaten-Action-IDs gefunden`);

  // ── V1: echter Login-POST -> Session-Cookie (fuer beide Test-User) ─────────────────────────
  const writerLogin = await realLogin("writer", loginHandleFor(writerId), writerPin, candidateIds);
  if (!writerLogin.cookie) {
    console.log("F0-VERIFY-HTTP V1 Diagnose (writer):");
    for (const line of writerLogin.attempts) console.log(`  - ${line}`);
  }
  report("V1", Boolean(writerLogin.cookie), writerLogin.cookie ? `Session-Cookie via Action ${writerLogin.actionId} erhalten` : "kein Set-Cookie von keinem Kandidaten erhalten");

  const readonlyLogin = writerLogin.cookie
    ? await realLogin("readonly", loginHandleFor(readonlyId), readonlyPin, [writerLogin.actionId, ...candidateIds])
    : { cookie: null, attempts: [] };
  report("V1-READONLY", Boolean(readonlyLogin.cookie), readonlyLogin.cookie ? "Session-Cookie fuer readonly-User erhalten" : "kein Set-Cookie erhalten");

  if (!writerLogin.cookie) {
    console.error(
      "F0-VERIFY-HTTP FATAL: V1 (echter Login) konnte keinen Session-Cookie erzeugen - " +
        "V2-V5 koennen ohne echte Session nicht sinnvoll gegen 'Erfolg' gepruft werden. Abbruch.",
    );
    console.log(`F0_VERIFY_HTTP_FAILURES=${failures + 1}`);
    process.exit(1);
  }

  // ── V2: verify MIT Session -> Erfolgsvertrag (Auth-Gate durchlaufen, 400 statt 401) ────────
  const v2 = await uploadRequest(writerLogin.cookie);
  report("V2", v2.status === 400, `status=${v2.status} body=${v2.bodyText.slice(0, 200)}`);

  // ── V3: ohne Cookie -> deny ─────────────────────────────────────────────────────────────────
  const v3 = await uploadRequest(null);
  report("V3", v3.status === 401, `status=${v3.status} body=${v3.bodyText.slice(0, 200)}`);

  // ── V4: manipuliertes Cookie -> deny (Signatur am Ende gezielt zerstoert) ──────────────────
  const tampered = writerLogin.cookie.slice(0, -1) + (writerLogin.cookie.endsWith("a") ? "b" : "a");
  const v4 = await uploadRequest(tampered);
  report("V4", v4.status === 401, `status=${v4.status} body=${v4.bodyText.slice(0, 200)}`);

  // ── V5: falsche Rolle (echter readonly-Login, Route prueft WRITE_ROLES) -> deny ────────────
  if (readonlyLogin.cookie) {
    const v5 = await uploadRequest(readonlyLogin.cookie);
    report("V5", v5.status === 401, `status=${v5.status} body=${v5.bodyText.slice(0, 200)}`);
  } else {
    report("V5", false, "readonly-Login (V1-READONLY) fehlgeschlagen, V5 kann nicht ausgefuehrt werden");
  }

  runSql(`delete from public.app_users where id in ('${writerId}', '${readonlyId}')`);

  console.log(`F0_VERIFY_HTTP_FAILURES=${failures}`);
  console.log(failures === 0 ? "F0_VERIFY_HTTP=PASS" : "F0_VERIFY_HTTP=FAIL");
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((error) => {
  console.error("F0-VERIFY-HTTP FATAL:", error);
  process.exit(1);
});
