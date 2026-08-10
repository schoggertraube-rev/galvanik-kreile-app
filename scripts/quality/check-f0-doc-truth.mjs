#!/usr/bin/env node
// F0 doc-truth gate (BF-004/005): canonical status docs must be placeholder-free,
// internally consistent, and must not present superseded foundation states as current.
// Historical documents are exempt via EXEMPT list; history INSIDE canonical docs is
// allowed only in sections whose heading contains "Historie" or "Governance-Vermerk".
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const fail = [];
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
  for (const k of ["contract_ref","TECHNICAL_PROOF_COMMIT","evidence_payload_ref","RATIFICATION_STATUS","PRODUCTION_DEPLOYMENT_HEAD","FRESH_REPLAY_RUNS","FRESH_REPLAY_DIGEST","SCHEMA_SECURITY_DIGEST","LEDGER","OPEN_FOUNDATION_PRS","REMOTE_MUTATIONS","NEXT_REQUIRED_PERMISSION","FINAL_STATUS","F0_A_MATRIX"])
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
const HIST_HEADING = /^#{1,6}.*(Historie|Governance-Vermerk|SUPERSEDED)/i;
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

if (fail.length) {
  console.error("F0_DOC_TRUTH=FAIL");
  for (const f of fail) console.error(" - " + f);
  process.exit(1);
}
console.log("F0_DOC_TRUTH=PASS (canonical docs consistent, no placeholders, no superseded-as-current states)");
