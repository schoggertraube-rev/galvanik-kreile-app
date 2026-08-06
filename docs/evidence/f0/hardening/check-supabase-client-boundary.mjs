#!/usr/bin/env node
// F0-07 Guard: verbietet direkte Supabase-Client-Erzeugung ausserhalb der kanonischen Stelle.
// Kanonisch: src/lib/supabase/{client,server,admin}.ts. Alles andere muss ueber diese Factories.
// Nutzung: node docs/evidence/f0/hardening/check-supabase-client-boundary.mjs
// Exit 1 bei Verstoessen. (Noch NICHT in CI verdrahtet: erst nach Admin-Factory-Refactor gruen.)
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

const ROOT = "src";
const ALLOW = ["src/lib/supabase/client.ts", "src/lib/supabase/server.ts", "src/lib/supabase/admin.ts"].map(p => p.replaceAll("/", "\\"));
const RE = /\bcreateClient\s*\(/;               // supabase-js direct client
const RE_IMPORT = /from\s+["']@supabase\/supabase-js["']/;

function walk(dir) {
  let out = [];
  for (const e of readdirSync(dir)) {
    const p = join(dir, e);
    if (statSync(p).isDirectory()) out = out.concat(walk(p));
    else if (/\.(ts|tsx)$/.test(e)) out.push(p);
  }
  return out;
}

const violations = [];
for (const f of walk(ROOT)) {
  const norm = f.replaceAll("/", "\\");
  if (ALLOW.some(a => norm.endsWith(a))) continue;
  const src = readFileSync(f, "utf8");
  if (RE_IMPORT.test(src) && RE.test(src)) violations.push(f);
}

if (violations.length) {
  console.error("F0-07 Client-Boundary-Verstoss (direkter @supabase/supabase-js createClient ausserhalb lib/supabase/):");
  for (const v of violations) console.error("  - " + v);
  console.error("Fix: kanonische Factory in src/lib/supabase/admin.ts verwenden.");
  process.exit(1);
}
console.log("F0-07 Client-Boundary OK (keine direkten createClient ausserhalb lib/supabase/).");
