import { execFileSync } from "node:child_process";
import process from "node:process";

// BF-007: echte Storage-HTTP-Negativmatrix gegen die lokale Supabase-Storage-REST-API im
// Replay-Job (nicht nur SQL-Inventar wie scripts/quality/f0_negative_tests.sql Abschnitt F).
// Keys werden zur Laufzeit aus "npx supabase status" geparst (keine gehardcodeten Secrets).
//
// Aufruf (Replay-Job, nach "npx supabase db start" + "npx supabase db reset --local"):
//   node scripts/quality/f0-storage-http-tests.mjs

const SUPABASE_BIN_ARGS = ["--yes", "supabase@2.111.0"];
const BUCKET = "item-photos"; // 12 MiB, image/jpeg|png|webp (siehe storage.buckets, BF-002/F0-06)
const OTHER_BUCKET = "scans"; // fuer den bucketuebergreifenden Test (S6)
const SIZE_LIMIT_BYTES = 12582912;
const PROBE_PREFIX = `f0-http-probe/${Date.now()}`;

let failures = 0;
const results = [];
function report(id, ok, detail) {
  results.push({ id, ok, detail });
  console.log(`${ok ? "PASS" : "FAIL"}\tS${id}\t${detail ?? ""}`.trimEnd());
  if (!ok) failures += 1;
}

function parseSupabaseStatus() {
  const raw = execFileSync("npx", [...SUPABASE_BIN_ARGS, "status", "-o", "env"], {
    encoding: "utf8",
  });
  const map = {};
  for (const line of raw.split(/\r?\n/)) {
    const match = line.match(/^([A-Z0-9_]+)="?([^"]*)"?$/);
    if (match) map[match[1]] = match[2];
  }
  const apiUrl = map.API_URL;
  const anonKey = map.ANON_KEY;
  const serviceRoleKey = map.SERVICE_ROLE_KEY;
  if (!apiUrl || !anonKey || !serviceRoleKey) {
    console.error("F0-STORAGE-HTTP FATAL: konnte API_URL/ANON_KEY/SERVICE_ROLE_KEY nicht aus 'supabase status -o env' parsen.");
    console.error("Rohausgabe:\n" + raw);
    process.exit(1);
  }
  return { apiUrl, anonKey, serviceRoleKey };
}

const { apiUrl, anonKey, serviceRoleKey } = parseSupabaseStatus();
const STORAGE_BASE = `${apiUrl}/storage/v1`;

function authHeaders(key) {
  return { apikey: key, Authorization: `Bearer ${key}` };
}

async function bodySnippet(response) {
  try {
    const text = await response.text();
    return text.slice(0, 300);
  } catch {
    return "(body unreadable)";
  }
}

function pngBytes() {
  // Minimaler, aber gueltiger 1x1-PNG (Signatur + IHDR + IDAT + IEND) - ausreichend fuer
  // "gueltiges PNG" ohne eine Bildbibliothek als Abhaengigkeit einzufuehren.
  return Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
    "base64",
  );
}

async function upload(bucket, objectPath, bytes, contentType, key) {
  const response = await fetch(`${STORAGE_BASE}/object/${bucket}/${objectPath}`, {
    method: "POST",
    headers: { ...authHeaders(key), "Content-Type": contentType, "x-upsert": "false" },
    body: bytes,
  });
  return response;
}

async function main() {
  console.log(`F0-STORAGE-HTTP against ${STORAGE_BASE} (bucket=${BUCKET}, probe prefix=${PROBE_PREFIX})`);

  const ownPath = `${PROBE_PREFIX}/own.png`;

  // S1: service_role Upload PNG -> 200
  const s1 = await upload(BUCKET, ownPath, pngBytes(), "image/png", serviceRoleKey);
  report(1, s1.status >= 200 && s1.status < 300, `service_role upload status=${s1.status} ${await bodySnippet(s1)}`);

  // S2: signed URL eigenes Objekt -> 200
  const signResponse = await fetch(`${STORAGE_BASE}/object/sign/${BUCKET}/${ownPath}`, {
    method: "POST",
    headers: { ...authHeaders(serviceRoleKey), "Content-Type": "application/json" },
    body: JSON.stringify({ expiresIn: 120 }),
  });
  let signedUrlPath = null;
  if (signResponse.ok) {
    const signed = await signResponse.json();
    signedUrlPath = signed.signedURL ?? signed.signedUrl ?? null;
  }
  if (signedUrlPath) {
    const s2 = await fetch(`${STORAGE_BASE}${signedUrlPath}`, { headers: authHeaders(anonKey) });
    report(2, s2.status === 200, `signed URL GET status=${s2.status} ${await bodySnippet(s2)}`);
  } else {
    report(2, false, `konnte keine signed URL erzeugen: status=${signResponse.status} ${await bodySnippet(signResponse)}`);
  }

  // S3: anon direkter GET (ohne signed URL) -> deny
  const s3 = await fetch(`${STORAGE_BASE}/object/${BUCKET}/${ownPath}`, { headers: authHeaders(anonKey) });
  report(3, [400, 401, 403, 404].includes(s3.status), `anon direct GET status=${s3.status} ${await bodySnippet(s3)}`);

  // S4: anon Upload -> deny
  const s4 = await upload(BUCKET, `${PROBE_PREFIX}/anon-upload.png`, pngBytes(), "image/png", anonKey);
  report(4, [400, 401, 403].includes(s4.status), `anon upload status=${s4.status} ${await bodySnippet(s4)}`);

  // S5: anon GET auf fremden/erfundenen Objektpfad -> deny
  const s5 = await fetch(`${STORAGE_BASE}/object/${BUCKET}/f0-http-probe/not-mine/${Date.now()}-foreign.png`, {
    headers: authHeaders(anonKey),
  });
  report(5, [400, 401, 403, 404].includes(s5.status), `anon GET foreign path status=${s5.status} ${await bodySnippet(s5)}`);

  // S6: bucketuebergreifend (service_role, aber Objekt existiert nur in BUCKET, nicht in OTHER_BUCKET) -> deny/404
  const s6 = await fetch(`${STORAGE_BASE}/object/${OTHER_BUCKET}/${ownPath}`, { headers: authHeaders(serviceRoleKey) });
  report(6, [400, 403, 404].includes(s6.status), `cross-bucket GET status=${s6.status} ${await bodySnippet(s6)}`);

  // S7: falscher MIME-Typ (text/plain) auf item-photos (erlaubt nur jpeg/png/webp) -> 4xx
  const s7 = await upload(BUCKET, `${PROBE_PREFIX}/wrong-mime.txt`, Buffer.from("f0 probe"), "text/plain", serviceRoleKey);
  report(7, s7.status >= 400 && s7.status < 500, `wrong-MIME upload status=${s7.status} ${await bodySnippet(s7)}`);

  // S8: Upload > 12 MiB (Bucket-Limit) -> 4xx
  const oversized = Buffer.alloc(SIZE_LIMIT_BYTES + 1024, 1);
  const s8 = await upload(BUCKET, `${PROBE_PREFIX}/oversized.png`, oversized, "image/png", serviceRoleKey);
  report(8, s8.status >= 400 && s8.status < 500, `oversized upload status=${s8.status} ${await bodySnippet(s8)}`);

  // S9: signed URL abgelaufen (expiresIn=1, sleep 2s) -> 4xx
  const s9SignResponse = await fetch(`${STORAGE_BASE}/object/sign/${BUCKET}/${ownPath}`, {
    method: "POST",
    headers: { ...authHeaders(serviceRoleKey), "Content-Type": "application/json" },
    body: JSON.stringify({ expiresIn: 1 }),
  });
  if (s9SignResponse.ok) {
    const { signedURL } = await s9SignResponse.json();
    await new Promise((resolve) => setTimeout(resolve, 2000));
    const s9 = await fetch(`${STORAGE_BASE}${signedURL}`, { headers: authHeaders(anonKey) });
    report(9, s9.status >= 400 && s9.status < 500, `expired signed URL GET status=${s9.status} ${await bodySnippet(s9)}`);
  } else {
    report(9, false, `konnte keine signed URL fuer Expiry-Test erzeugen: status=${s9SignResponse.status}`);
  }

  // S10: signed URL manipuliert (Token-Suffix veraendert) -> 4xx
  if (signedUrlPath) {
    const tampered = signedUrlPath.slice(0, -1) + (signedUrlPath.endsWith("a") ? "b" : "a");
    const s10 = await fetch(`${STORAGE_BASE}${tampered}`, { headers: authHeaders(anonKey) });
    report(10, s10.status >= 400 && s10.status < 500, `tampered signed URL GET status=${s10.status} ${await bodySnippet(s10)}`);
  } else {
    report(10, false, "keine signed URL aus S2 verfuegbar, um sie zu manipulieren");
  }

  // S11: signed URL fuer eigenen Pfad erzeugt, aber gegen fremden Pfad verwendet -> 4xx
  if (signedUrlPath) {
    const foreignTarget = `/object/sign/${BUCKET}/f0-http-probe/not-mine/other.png`;
    const tokenMatch = signedUrlPath.match(/token=(.+)$/);
    const s11 = tokenMatch
      ? await fetch(`${STORAGE_BASE}${foreignTarget}?token=${tokenMatch[1]}`, { headers: authHeaders(anonKey) })
      : null;
    report(
      11,
      Boolean(s11) && s11.status >= 400 && s11.status < 500,
      s11 ? `signed URL auf fremden Pfad status=${s11.status} ${await bodySnippet(s11)}` : "kein Token aus S2-Signed-URL extrahierbar",
    );
  } else {
    report(11, false, "keine signed URL aus S2 verfuegbar fuer Pfad-Substitution");
  }

  // S12: Cleanup via service_role + Verifikation (Objekte danach nicht mehr abrufbar)
  const cleanupPaths = [
    ownPath,
    `${PROBE_PREFIX}/anon-upload.png`,
    `${PROBE_PREFIX}/wrong-mime.txt`,
    `${PROBE_PREFIX}/oversized.png`,
  ];
  const deleteResponse = await fetch(`${STORAGE_BASE}/object/${BUCKET}`, {
    method: "DELETE",
    headers: { ...authHeaders(serviceRoleKey), "Content-Type": "application/json" },
    body: JSON.stringify({ prefixes: cleanupPaths }),
  });
  const verifyGone = await fetch(`${STORAGE_BASE}/object/${BUCKET}/${ownPath}`, { headers: authHeaders(serviceRoleKey) });
  report(
    12,
    deleteResponse.ok && verifyGone.status === 404,
    `delete status=${deleteResponse.status}, Verifikations-GET danach status=${verifyGone.status} (erwartet 404)`,
  );

  console.log(`F0_STORAGE_HTTP_FAILURES=${failures}`);
  console.log(failures === 0 ? "F0_STORAGE_HTTP=PASS (S1-S12)" : `F0_STORAGE_HTTP=FAIL (${failures} von 12 Faellen)`);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((error) => {
  console.error("F0-STORAGE-HTTP FATAL:", error);
  process.exit(1);
});
