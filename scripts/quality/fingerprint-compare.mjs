// F0 Fingerprint-Vergleich: Fresh-Replay-Fingerprint vs committete Prod-Referenz.
// SCHARF fuer die exakt matchbaren Komponenten (DIFF => exit 1, Job-Fail).
// Klassen:
//  - expectMatch: byte-exakt reproduzierbar; Regression bricht CI.
//  - knownNormalization: cons/trig/pol - PG-Parse-Tree-Folding (Konstanten-Cast-Coercion wird beim
//    Re-Parse gerenderter DDL gefaltet; Prods historischer Parse-Tree rendert anders). Semantisch
//    identisch (Objektmengen und Ausdruckssemantik verifiziert); byte-Match prinzipiell unerreichbar
//    per Replay. Belegt durch No-Op-Experiment (DROP+CREATE aller Trigger+Policies aenderte nichts).
//  - knownExternal: def_privs - supabase_admin Default Privileges (Cluster/Owner, lokal nicht setzbar).
// viewopts (BF-002, ergaenzt 2026-08-10): md5 ueber pg_class.reloptions aller public/private-Views
//   (u.a. security_invoker). expectMatch/hart, da byte-exakt replayfaehig; deckt genau die BF-001-Drift
//   (v_auftrag_db ohne security_invoker) ab, die die urspruengliche 10-Komponenten-Definition nicht sah.
// Aufruf: node scripts/quality/fingerprint-compare.mjs "<pipe-delimited-fp>" <referenz-datei>
import { readFileSync } from "node:fs";

const order = ["cols","idx","cons","trig","func","pol","rls","grants","func_grants","def_privs","viewopts"];
const expectMatch = new Set(["cols","idx","func","rls","grants","func_grants","viewopts"]);
const knownNormalization = new Set(["cons","trig","pol"]);
const knownExternal = new Set(["def_privs"]);

const fpArg = process.argv[2] ?? "";
const refPath = process.argv[3] ?? "";
const vals = fpArg.split("|").map((s) => s.trim().toLowerCase());

const ref = {};
for (const line of readFileSync(refPath, "utf8").split(/\r?\n/)) {
  const m = line.match(/^(\w+)=([a-f0-9]{32})$/);
  if (m) ref[m[1]] = m[2].toLowerCase();
}

let hardFails = 0;
order.forEach((k, i) => {
  const got = vals[i] ?? "";
  const want = ref[k] ?? "";
  const ok = got !== "" && got === want;
  let tag;
  if (ok) tag = "MATCH";
  else if (knownNormalization.has(k)) tag = "DIFF(known-normalization)";
  else if (knownExternal.has(k)) tag = "DIFF(known-external)";
  else { tag = "DIFF(HARD-FAIL)"; hardFails += 1; }
  if (!ok && expectMatch.has(k)) hardFails += 0; // counted above via HARD-FAIL tag
  console.log(`${tag}\t${k}\treplay=${got || "(none)"}\tprod=${want || "(none)"}`);
});
console.log(`FINGERPRINT_HARD_FAILS=${hardFails}`);
console.log(hardFails === 0
  ? "FINGERPRINT_PARITY=PASS (7 exakt; cons/trig/pol known-normalization; def_privs known-external)"
  : `FINGERPRINT_PARITY=FAIL (${hardFails} Regression(en) in exakt matchbaren Komponenten)`);
process.exit(hardFails === 0 ? 0 : 1);
