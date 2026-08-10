#!/usr/bin/env node
// F0 doc-truth gate (BF-004/005; extended F0-W1 GOV-06): canonical status docs must be
// placeholder-free, internally consistent, use only contract-legal status enums, must not
// imply ZIP_READINESS=GREEN without FINAL_STATUS=PASS, and must not present stale/superseded
// commit SHAs as the current HEAD/main. Historical documents are exempt via EXEMPT list;
// history INSIDE canonical docs is allowed only in sections whose heading contains "Historie",
// "Governance-Vermerk" or "SUPERSEDED" (and, for the stale-head check only, in any line that
// itself mentions Historie/REMOTE_MUTATIONS/history).
//
// Usage:
//   node scripts/quality/check-f0-doc-truth.mjs             normal gate (exit 0 = consistent)
//   node scripts/quality/check-f0-doc-truth.mjs --selftest  proves the rules themselves fire
//                                                            (exit 0 = rules correctly catch
//                                                            embedded negative fixtures AND do
//                                                            not false-positive on exempt ones)
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const SELFTEST = process.argv.includes("--selftest");
const read = (p) => readFileSync(p, "utf8");

const CANONICAL = [
  "docs/project/CURRENT_STATE.md",
  "docs/project/NON_LOSS_REGISTER.md",
  "docs/evidence/f0/F0_FINAL_REPORT.md",
  "docs/evidence/f0/F0_HANDOFF.json",
  "docs/evidence/f0/F0_CLOSEOUT.md",
  "docs/evidence/f0/F0_TEST_EVIDENCE.md",
  "docs/evidence/f0/F0_STORAGE_CONTRACT.md",
];
const SCAN_DIRS = ["docs/evidence/f0"];
const EXEMPT = new Set([
  "docs/evidence/f0/F0_CONTRACT_V1.md", // externally provided norm, verbatim
]);
const EXEMPT_PREFIX = ["docs/evidence/f0/hardening/"]; // historical hardening evidence

const HIST_HEADING = /^#{1,6}.*(Historie|Governance-Vermerk|SUPERSEDED)/i;

// ---- GOV-06(a): every FINAL_STATUS occurrence in canonical docs must use a contract-legal
//      enum value. Allowed values per the F0 status contract (PASS_WITH_DECLARED_EXTERNAL_
//      EXCEPTION and any other free-form value are illegal). ----------------------------------
const ALLOWED_STATUS = [
  "PASS",
  "FAIL_INTERNAL",
  "BLOCKED_EXTERNAL_PERMISSION",
  "BLOCKED_PRODUCT_DECISION",
  "BLOCKED_CAPABILITY_ADAPTER_MISSING",
];
function checkStatusEnumMd(path, content) {
  const out = [];
  const re = /FINAL_STATUS=([A-Za-z_]+)/g;
  let m;
  while ((m = re.exec(content))) {
    if (!ALLOWED_STATUS.includes(m[1]))
      out.push(`${path}: illegal FINAL_STATUS enum "${m[1]}" (allowed: ${ALLOWED_STATUS.join(", ")})`);
  }
  return out;
}
function checkStatusEnumJson(path, content) {
  const out = [];
  const re = /"FINAL_STATUS":\s*"([A-Za-z_]+)"/g;
  let m;
  while ((m = re.exec(content))) {
    if (!ALLOWED_STATUS.includes(m[1]))
      out.push(`${path}: illegal FINAL_STATUS enum "${m[1]}" (allowed: ${ALLOWED_STATUS.join(", ")})`);
  }
  return out;
}

// ---- GOV-06(b): ZIP_READINESS=GREEN anywhere in a canonical doc implies the handoff's
//      FINAL_STATUS must be PASS. ---------------------------------------------------------
function checkZipImplication(path, content, finalStatus) {
  const out = [];
  if (/ZIP_READINESS\s*[:=]\s*"?GREEN"?/.test(content) && finalStatus !== "PASS")
    out.push(
      `${path}: ZIP_READINESS=GREEN requires FINAL_STATUS=PASS (actual handoff FINAL_STATUS=${finalStatus})`
    );
  return out;
}

// ---- GOV-06(c): stale/superseded HEAD SHAs must not be presented as the current HEAD/main
//      in canonical .md (line-context regex). Exempt: lines inside a Historie/Governance-
//      Vermerk/SUPERSEDED-headed section, and any individual line mentioning Historie,
//      REMOTE_MUTATIONS or history (e.g. changelog-style entries). "aktuell" is matched as a
//      substring so German inflections (aktuelle/aktuellen/aktueller) are caught too; "HEAD"
//      requires a word boundary so compound identifiers like PRODUCTION_DEPLOYMENT_HEAD do not
//      false-positive; "main" before "=" likewise requires a word boundary (excludes "domain="
//      etc.). ------------------------------------------------------------------------------
const STALE_HEADS = ["6e0c748", "ae47f3de", "ac6b3680", "010eee35"];
const STALE_CONTEXT_RE = /(aktuell|\bHEAD\b|\bmain\s*=)/i;
const STALE_LINE_EXEMPT_RE = /(Historie|REMOTE_MUTATIONS|history)/i;
function checkStaleHead(path, content) {
  const out = [];
  const lines = content.split("\n");
  let inHist = false;
  lines.forEach((line, i) => {
    if (/^#{1,6}\s/.test(line)) inHist = HIST_HEADING.test(line);
    if (inHist) return;
    if (STALE_LINE_EXEMPT_RE.test(line)) return;
    for (const sha of STALE_HEADS) {
      if (line.includes(sha) && STALE_CONTEXT_RE.test(line))
        out.push(`${path}:${i + 1}: stale head "${sha}" presented as current: "${line.trim().slice(0, 100)}"`);
    }
  });
  return out;
}

function runGate() {
  const fail = [];

  // 1) placeholder scan across evidence + canonical project docs
  const PLACEHOLDER = /(SET_ON_MERGE|\bTODO\b|\bTBC\b)/;
  const files = new Set(CANONICAL);
  for (const d of SCAN_DIRS)
    for (const f of readdirSync(d))
      if (/\.(md|json)$/.test(f)) files.add(join(d, f).replace(/\\/g, "/"));
  for (const f of files) {
    if (EXEMPT.has(f) || EXEMPT_PREFIX.some((p) => f.startsWith(p))) continue;
    let t;
    try { t = read(f); } catch { continue; }
    const m = t.match(PLACEHOLDER);
    if (m) fail.push(`${f}: placeholder "${m[1]}"`);
  }

  // 2) handoff parseable + required fields
  let handoff = null;
  try {
    handoff = JSON.parse(read("docs/evidence/f0/F0_HANDOFF.json"));
    for (const k of ["contract_ref","TECHNICAL_PROOF_COMMIT","evidence_payload_ref","RATIFICATION_STATUS","PRODUCTION_DEPLOYMENT_HEAD","FRESH_REPLAY_RUNS","FRESH_REPLAY_DIGEST","SCHEMA_SECURITY_DIGEST","LEDGER","OPEN_FOUNDATION_PRS","REMOTE_MUTATIONS","NEXT_REQUIRED_PERMISSION","FINAL_STATUS","F0_A_MATRIX","ZIP_READINESS","OPEN_INTERNAL_BLOCKERS"])
      if (!(k in handoff)) fail.push(`F0_HANDOFF.json: missing required field ${k}`);
    if (handoff.RATIFICATION_REF === undefined) fail.push("F0_HANDOFF.json: RATIFICATION_REF must exist (null allowed)");
  } catch (e) { fail.push(`F0_HANDOFF.json: not parseable (${e.message})`); }

  // 3) superseded foundation states must not appear as CURRENT in canonical docs
  //    (allowed inside history-marked sections)
  const FORBIDDEN = [
    /Migrationswahrheit auf main\s*=\s*FAIL/,
    /LEDGER-CONSOLIDATION-001\s*=\s*ACTIVE/,
    /RLS-CONTRACT-001\s*=\s*ACTIVE/,
    /\b6e0c748[0-9a-f]*\b[^\n]*(HEAD|main)/i,
  ];
  for (const f of CANONICAL) {
    if (!f.endsWith(".md")) continue;
    let t; try { t = read(f); } catch { continue; }
    const lines = t.split("\n");
    let inHist = false;
    lines.forEach((line, i) => {
      if (/^#{1,6}\s/.test(line)) inHist = HIST_HEADING.test(line);
      if (inHist) return;
      for (const re of FORBIDDEN)
        if (re.test(line)) fail.push(`${f}:${i + 1}: superseded state presented as current: "${line.trim().slice(0, 80)}"`);
    });
  }

  // 4) FINAL_STATUS consistency report <-> handoff
  try {
    const rep = read("docs/evidence/f0/F0_FINAL_REPORT.md");
    const m = rep.match(/FINAL_STATUS=([A-Z_]+)/);
    if (!m) fail.push("F0_FINAL_REPORT.md: FINAL_STATUS line missing");
    else if (handoff && handoff.FINAL_STATUS !== m[1])
      fail.push(`FINAL_STATUS mismatch: report=${m[1]} handoff=${handoff.FINAL_STATUS}`);
  } catch { fail.push("F0_FINAL_REPORT.md: unreadable"); }

  // NON_LOSS guard: register must carry the 2026-08-10 supersession header that marks
  // foundation rows as history (BF-005 recheck finding).
  try {
    const nl = read("docs/project/NON_LOSS_REGISTER.md");
    if (!/Nachtrag 2026-08-10 \(massgeblich fuer Fundament-Stati\)/.test(nl))
      fail.push("NON_LOSS_REGISTER.md: missing supersession header for foundation states");
  } catch { fail.push("NON_LOSS_REGISTER.md unreadable"); }

  // 5) GOV-06(a): status-enum gate across all canonical docs
  for (const f of CANONICAL) {
    let t; try { t = read(f); } catch { continue; }
    fail.push(...(f.endsWith(".json") ? checkStatusEnumJson(f, t) : checkStatusEnumMd(f, t)));
  }

  // 6) GOV-06(b): ZIP_READINESS=GREEN => FINAL_STATUS=PASS, across all canonical docs
  {
    const finalStatus = handoff ? handoff.FINAL_STATUS : null;
    for (const f of CANONICAL) {
      let t; try { t = read(f); } catch { continue; }
      fail.push(...checkZipImplication(f, t, finalStatus));
    }
  }

  // 7) GOV-06(c): stale HEAD SHAs must not be presented as current, across canonical .md
  for (const f of CANONICAL) {
    if (!f.endsWith(".md")) continue;
    let t; try { t = read(f); } catch { continue; }
    fail.push(...checkStaleHead(f, t));
  }

  if (fail.length) {
    console.error("F0_DOC_TRUTH=FAIL");
    for (const f of fail) console.error(" - " + f);
    process.exit(1);
  }
  console.log(
    "F0_DOC_TRUTH=PASS (canonical docs consistent, no placeholders, no superseded-as-current states, status enums legal, ZIP/status implication holds, no stale-head-as-current)"
  );
}

// ---- GOV-06(d): selftest. Runs the three new rule-functions above against embedded fixture
//      strings (no real files touched). Negative fixtures MUST each produce >=1 failure
//      (proves the rule fires). Positive/exempt fixtures MUST each produce zero failures
//      (proves the rule does not false-positive on legitimate content, e.g. compound
//      identifiers or genuine history/changelog lines). Exit 0 only if every fixture behaved
//      as expected, i.e. the gate rules themselves are provably correct. -----------------------
function runSelftest() {
  const problems = [];

  const negatives = [
    { name: "illegal-enum-md", run: () => checkStatusEnumMd("fixture.md", "Schlussstatus: `FINAL_STATUS=PASS_WITH_DECLARED_EXTERNAL_EXCEPTION`") },
    { name: "illegal-enum-json", run: () => checkStatusEnumJson("fixture.json", '{"FINAL_STATUS": "PASS_WITH_DECLARED_EXTERNAL_EXCEPTION"}') },
    { name: "green-with-fail-internal", run: () => checkZipImplication("fixture.md", "`ZIP_READINESS=GREEN`", "FAIL_INTERNAL") },
    { name: "stale-head-as-current-main-equals", run: () => checkStaleHead("fixture.md", "Der aktuelle Stand: main = ae47f3de\n") },
    { name: "stale-head-as-current-HEAD-word", run: () => checkStaleHead("fixture.md", "aktueller HEAD ist ac6b3680, verifiziert.\n") },
  ];
  for (const n of negatives) {
    const res = n.run();
    if (res.length === 0) problems.push(`NEGATIVE FIXTURE DID NOT FAIL (rule broken, does not catch a real violation): ${n.name}`);
  }

  const positives = [
    { name: "legal-enum-md", run: () => checkStatusEnumMd("fixture.md", "`FINAL_STATUS=FAIL_INTERNAL`") },
    { name: "green-with-pass-is-fine", run: () => checkZipImplication("fixture.md", "`ZIP_READINESS=GREEN`", "PASS") },
    { name: "stale-head-inside-history-section", run: () => checkStaleHead("fixture.md", "## Historie (nicht kanonisch)\nfrueher main = ae47f3de\n") },
    { name: "stale-head-in-remote-mutations-line", run: () => checkStaleHead("fixture.md", "REMOTE_MUTATIONS: main = ae47f3de am 2026-08-08\n") },
    { name: "stale-head-inside-compound-identifier", run: () => checkStaleHead("fixture.md", "PRODUCTION_DEPLOYMENT_HEAD ae47f3de (Vercel, READY)\n") },
  ];
  for (const p of positives) {
    const res = p.run();
    if (res.length > 0) problems.push(`POSITIVE FIXTURE FAILED UNEXPECTEDLY (rule too strict, false positive): ${p.name}: ${res.join("; ")}`);
  }

  if (problems.length) {
    console.error("F0_DOC_TRUTH_SELFTEST=FAIL");
    for (const p of problems) console.error(" - " + p);
    process.exit(1);
  }
  console.log(
    `F0_DOC_TRUTH_SELFTEST=PASS (${negatives.length} negative fixtures correctly failed, ${positives.length} positive fixtures correctly passed - the gate rules fire as intended)`
  );
  process.exit(0);
}

if (SELFTEST) runSelftest();
else runGate();
