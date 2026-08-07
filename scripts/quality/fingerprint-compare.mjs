// F0 Fingerprint-Vergleich: Fresh-Replay-Fingerprint vs committete Prod-Referenz.
// Informativ (kein Gate) bis Baseline-Paritaet erreicht ist. Aufruf:
//   node scripts/quality/fingerprint-compare.mjs "<pipe-delimited-fp>" <referenz-datei>
import { readFileSync } from "node:fs";

const order = ["cols","idx","cons","trig","func","pol","rls","grants","func_grants","def_privs"];
const knownExternalDiff = new Set(["def_privs"]); // supabase_admin default privs (extern)

const fpArg = process.argv[2] ?? "";
const refPath = process.argv[3] ?? "";
const vals = fpArg.split("|").map((s) => s.trim().toLowerCase());

const ref = {};
for (const line of readFileSync(refPath, "utf8").split(/\r?\n/)) {
  const m = line.match(/^(\w+)=([a-f0-9]{32})$/);
  if (m) ref[m[1]] = m[2].toLowerCase();
}

let realDiffs = 0;
let expectedDiffs = 0;
order.forEach((k, i) => {
  const got = vals[i] ?? "";
  const want = ref[k] ?? "";
  const ok = got !== "" && got === want;
  let tag;
  if (ok) tag = "MATCH";
  else if (knownExternalDiff.has(k)) { tag = "DIFF(known-external)"; expectedDiffs += 1; }
  else { tag = "DIFF"; realDiffs += 1; }
  console.log(`${tag}\t${k}\treplay=${got || "(none)"}\tprod=${want || "(none)"}`);
});
console.log(`FINGERPRINT_REAL_DIFFS=${realDiffs}`);
console.log(`FINGERPRINT_EXPECTED_EXTERNAL_DIFFS=${expectedDiffs}`);
console.log(realDiffs === 0
  ? "FINGERPRINT_PARITY=PASS (nur bekannte externe Divergenz)"
  : `FINGERPRINT_PARITY=PENDING (${realDiffs} echte Divergenz(en) - Baseline-Inhalt noch nicht Prod-gleich)`);
// Informativ: immer Exit 0 (Schritt hat continue-on-error). Gate wird erst nach Paritaet scharf.
