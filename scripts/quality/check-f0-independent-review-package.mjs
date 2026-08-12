#!/usr/bin/env node

import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const MANIFEST_PATH = path.join(
  ROOT,
  "docs/evidence/f0/F0_W2C_W4_INDEPENDENT_REVIEW_MANIFEST.json",
);
const BASE = "c294c0564dc8a5e137eaa00de1276677cb1a1c53";
const CANDIDATE = "e3138f9286775bf6e79c0b5b1845ff72a0230b62";
const NAME_STATUS_SHA256 =
  "075c21a5b733fb45843e814917b4f744b28849b5312e75d3fea8361e0b673a6f";
const PACKAGE_PATHS = [
  "docs/evidence/f0/F0_W2C_W4_INDEPENDENT_REVIEW_PACKET.md",
  "docs/evidence/f0/F0_W2C_W4_INDEPENDENT_REVIEW_MANIFEST.json",
  "scripts/quality/check-f0-independent-review-package.mjs",
];
const CRITERION_IDS = [
  "T0-01", "T0-02", "T0-03", "T0-04",
  "W2C-01", "W2C-02", "W2C-03", "W2C-04", "W2C-05", "W2C-06",
  "W2C-07", "W2C-08", "W2C-09",
  "W3-01", "W3-02", "W3-03", "W3-04", "W3-05", "W3-06", "W3-07",
  "W3-08",
  "W4-01", "W4-02", "W4-03", "W4-04", "W4-05", "W4-06", "W4-07",
  "W4-08", "W4-09", "W4-10",
  "G-01", "G-02", "G-03", "G-04", "G-05",
];
const KNOWN_GAP_IDS = [];
const CLOSED_W4_IDS = ["W4-02", "W4-03", "W4-04", "W4-08", "W4-09"];
const STATUS_ALLOWLIST = new Set([
  "PASS_STATIC",
  "PASS_LOCAL",
  "NOT_PROVEN",
  "NOT_RUN",
  "BLOCKED_EXTERNAL_PERMISSION",
  "BLOCKED_PRODUCT_DECISION",
  "BLOCKED_EXTERNAL_PERMISSION/BOOTSTRAP_DECISION",
]);
const ALLOWED_PATTERNS = [
  "public/sw.js",
  "src/**",
  "supabase/migrations/**",
  "supabase/functions/**",
  "supabase/config.toml",
  "scripts/quality/**",
  "scripts/fetch_and_classify_orders.ts",
  "scripts/test_order_source.ts",
  "vitest.config.ts",
  ".github/workflows/quality.yml",
  ".github/workflows/agentur-gate.yml",
  "tests/**",
  "playwright.config.*",
  "package.json",
  "docs/project/**",
  "docs/evidence/f0/**",
  "missions/F0_FOUNDATION_CONVERGENCE_W2C_W4_001.yml",
];
const FORBIDDEN_PATTERNS = [
  "node_modules/**",
  ".env",
  ".env.*",
  "**/*.pem",
  "**/*.key",
  "**/*.p12",
  "**/*.pfx",
  "outside this repository",
  "old worktrees or clones",
];
const OUTSIDE_ALLOWED = [];
const SOURCE_FILES = [
  ["AGENTS.md", "e83a80bf8632783a0d2364e6f9246a4cdd8510b33c355e28ac4aa96906caa25f", 4440],
  ["missions/F0_FOUNDATION_CONVERGENCE_W2C_W4_001.yml", "e01c32902ae5c6ede263d26cce800dd2d700372c57afcb132706dc1ead41fd7d", 8244],
  ["docs/project/MASTERPLAN.md", "3506038938e265b9e268d3c478a0f708dbb37e078af6cac985cdc00aa395c85a", 8495],
  ["docs/project/CURRENT_STATE.md", "d253d8d422f206f2db82f037cf154e15ee048190a33767a4517928c14b050e67", 6405],
  ["docs/project/NON_LOSS_REGISTER.md", "1d09574389a2289984fe355c9b14833b24be3afe15ed4e2c1f4d1e602c6e15da", 18158],
  ["docs/project/DOCUMENT_AUTHORITY.md", "65256df05176279477da003407217081fdfb44b2ae157502e6c4ec7cb6e61c6e", 4881],
  ["docs/project/MODULARITY_STRATEGY.md", "441c7ac48c3d1ae6553a32c6fca6247cb6208d88587124c7dd47b1403f7587fa", 7307],
  ["docs/evidence/f0/F0_CONTRACT_V1.md", "f6b95f99e572f12226df9bf341f4d3364fa5fc995e32796559914e968de3ec97", 27593],
  ["docs/evidence/f0/F0_PRECHECK.md", "7648cf2b350ce27b845bb7be62c57c07d4b971efd84ee911282a18ab6befc8fb", 5443],
  ["docs/evidence/f0/W2C_EDGE_LIVE_RECONCILIATION.md", "38e71ae7ff6d1514df2a65a46bd9a3e4e8d33a4e47f7c309db8c8ffe69b1fe24", 1366],
  ["docs/evidence/f0/W2C_REENABLEMENT_MATRIX.md", "570cb3d236d5534fe45c3bb7aa3c1ed168f3583b21061526b284185462887ab1", 23511],
  ["docs/evidence/f0/W3_ORDER_STATION_TRANSITION_EVIDENCE.md", "de2333700a8444ee284f0e4443ed549b4a954aa3095a9ae49a64f17f79b2f4a4", 6302],
  ["docs/evidence/f0/W4_ORDER_STATION_EVENT_READMODEL_EVIDENCE.md", "c60898493f8f360c6588c4519e54e8e792d7cb1521f672146fe2a6c54bade193", 6698],
  ["docs/evidence/f0/W4_OPERATIONAL_ORDER_READ_EVIDENCE.md", "2ac7567324078d59d1df4d29cf7028ce5b4d27635f7efcb90e81fc3a6780958b", 6808],
  ["docs/evidence/f0/W4_ORDER_STATION_ATTACHMENT_EVIDENCE.md", "47bbc1e52c3da1d463f2e39f0cd345e6486051211418db33ee2af51379d5de9a", 14603],
  ["docs/evidence/f0/W4_EVIDENCE_READ_CONTRACT_EVIDENCE.md", "83680067b7d614b9877b4c5fa324aa536765f01ca53d97f131c408c6c3aad911", 7212],
  ["docs/evidence/f0/W4_CROSS_MODULE_READ_PORT_INVENTORY.json", "81b59e510927c6b9caab38b633e0e1ca5f0c25bcc567e4ff19cd0bc3ae669582", 1402],
  ["docs/evidence/f0/F0_CLAUDE_REPAIR_LEDGER.md", "62a81b4e7ffe76cde2b2bc3e35fcec35b7f5ca2fd7fbd9265776bdf23ef91493", 7649],
  ["docs/evidence/f0/W4_CANDIDATE_FINGERPRINT_EVIDENCE.md", "15fb812f42180daabcf63933ae16fb6e0b9f3782f7d8522f17034db88b119235", 12206],
  ["docs/evidence/f0/W4_CANDIDATE_SCHEMA_CONTRACT.json", "f17e2abbb78144ef87bdc11a0cfdd520b40123c295665e13c7ebf0061597cb53", 94379],
  [".github/workflows/quality.yml", "b587dc7502b9335f4e1180da6d498a67bd3772211941cc8ed93fb22e56c2504d", 19743],
  ["scripts/quality/check-w4-candidate-schema.mjs", "6e39de0341fbae85bb736934da838415eb6a32012a1d21ec3b7e28547c167806", 38950],
  ["scripts/quality/check-w4-cross-module-read-ports.mjs", "210d535882f3fc50057734c3df521d97e33b726020d4790389825747e6447f8c", 9703],
  ["supabase/migrations/20260811150000_w3_order_station_version.sql", "034cc8d6509aabe093948ff84c2e092289ddc211123d087a87e5bdfe7cbb45d7", 269],
  ["supabase/migrations/20260811154732_w4_order_station_event_readmodels.sql", "44ecf82b34023c763c1f0773266483cfe6a0a87809fc5970d0406370aea00595", 5958],
  ["supabase/migrations/20260811184850_w4_order_station_attachment.sql", "70aaead2150d95069829997bfdb128c2496b292d59cb6b69c8440dd1dfd2b6cb", 9943],
  ["supabase/migrations/20260812103446_w4_evidence_read_contract.sql", "dfd01b52b146ecbea34499b535ff4833cf18e7fa1dcecc1182ff6f8bb93cfd3f", 14447],
  ["src/lib/server/evidenceRead.ts", "add2ebdd3b64c12094f452ecdcf48cd9080f3d44f13a11e4282199fea641670d", 12639],
  ["src/lib/server/orderStationAttachment.ts", "47c496a4356fc455440a8a107aa35d6963133148849966fb51b17d610427247f", 52036],
  ["src/app/warendurchlauf/actions.ts", "e379cf05f8c6ee8b7d6a9a3f6ace1d101db6576507512eae9161f06339d65623", 8404],
  ["src/components/orders/GalvanikHandoffAttachmentPanel.tsx", "410772109a51627285012642a92bd57b0b966750a0b37848583576734b9641b8", 39519],
  ["src/test/w4_order_station_attachment.integration.test.ts", "293d77790e02f509487f0650f536465c557e01512f02453795d16bbf8b42bf76", 76361],
];

function fail(code, detail = "") {
  throw new Error(detail ? code + ":" + detail : code);
}

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

function canonical(value) {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return "[" + value.map(canonical).join(",") + "]";
  return "{" + Object.keys(value).sort().map(function (key) {
    return JSON.stringify(key) + ":" + canonical(value[key]);
  }).join(",") + "}";
}

function same(actual, expected) {
  return canonical(actual) === canonical(expected);
}

function exactKeys(value, expected, code) {
  if (
    value === null ||
    Array.isArray(value) ||
    typeof value !== "object" ||
    !same(Object.keys(value).sort(), expected.slice().sort())
  ) {
    fail(code);
  }
}

function assertString(value, code) {
  if (typeof value !== "string" || value.trim() === "") fail(code);
}

function git(args, options = {}) {
  const result = spawnSync("git", args, {
    cwd: ROOT,
    encoding: options.encoding === null ? null : "utf8",
    windowsHide: true,
  });
  if (options.allowFailure) return result;
  if (result.status !== 0) {
    fail(
      "GIT_COMMAND_FAILED",
      args.join(" ") + ":" + String(result.stderr || result.stdout).trim(),
    );
  }
  return result.stdout;
}

function parseNameStatus(raw) {
  const fields = Buffer.isBuffer(raw)
    ? raw.toString("utf8").split("\0")
    : String(raw).split("\0");
  if (fields.at(-1) === "") fields.pop();
  if (fields.length % 2 !== 0) fail("NAME_STATUS_FIELDS_INVALID");
  const entries = [];
  for (let index = 0; index < fields.length; index += 2) {
    const status = fields[index];
    const candidatePath = fields[index + 1].replaceAll("\\", "/");
    if (!["A", "M", "D"].includes(status)) {
      fail("NAME_STATUS_KIND_INVALID", status);
    }
    entries.push(status + "\t" + candidatePath);
  }
  return entries;
}

function nameStatusPath(entry) {
  const tab = entry.indexOf("\t");
  if (tab !== 1) fail("NAME_STATUS_RECORD_INVALID", entry);
  return entry.slice(2);
}

function encodeNameStatus(entries) {
  return entries.length === 0 ? "" : entries.join("\n") + "\n";
}

function isAllowed(candidatePath) {
  if (candidatePath === "public/sw.js") return true;
  if (candidatePath.startsWith("src/")) return true;
  if (candidatePath.startsWith("supabase/migrations/")) return true;
  if (candidatePath.startsWith("supabase/functions/")) return true;
  if (candidatePath === "supabase/config.toml") return true;
  if (candidatePath.startsWith("scripts/quality/")) return true;
  if (candidatePath === "scripts/fetch_and_classify_orders.ts") return true;
  if (candidatePath === "scripts/test_order_source.ts") return true;
  if (candidatePath === "vitest.config.ts") return true;
  if (candidatePath === ".github/workflows/quality.yml") return true;
  if (candidatePath === ".github/workflows/agentur-gate.yml") return true;
  if (candidatePath.startsWith("tests/")) return true;
  if (/^playwright\.config\.[^/]+$/.test(candidatePath)) return true;
  if (candidatePath === "package.json") return true;
  if (candidatePath.startsWith("docs/project/")) return true;
  if (candidatePath.startsWith("docs/evidence/f0/")) return true;
  return candidatePath === "missions/F0_FOUNDATION_CONVERGENCE_W2C_W4_001.yml";
}

function isForbidden(candidatePath) {
  const lower = candidatePath.toLowerCase();
  const base = lower.split("/").at(-1);
  if (candidatePath.startsWith("/") || /^[a-z]:\//i.test(candidatePath)) return true;
  if (candidatePath.split("/").includes("..")) return true;
  if (lower.split("/").includes("node_modules")) return true;
  if (base === ".env" || base.startsWith(".env.")) return true;
  return /\.(?:pem|key|p12|pfx)$/i.test(candidatePath);
}

function validateMissionScope(manifest, entries) {
  exactKeys(
    manifest.mission_scope,
    [
      "allowed_patterns",
      "forbidden_patterns",
      "outside_allowed_paths_requiring_reviewer_adjudication",
      "forbidden_paths_in_candidate_diff",
      "deleted_paths_in_candidate_diff",
    ],
    "MISSION_SCOPE_FIELDS_INVALID",
  );
  if (!same(manifest.mission_scope.allowed_patterns, ALLOWED_PATTERNS)) {
    fail("MISSION_ALLOWED_PATTERNS_INVALID");
  }
  if (!same(manifest.mission_scope.forbidden_patterns, FORBIDDEN_PATTERNS)) {
    fail("MISSION_FORBIDDEN_PATTERNS_INVALID");
  }
  const paths = entries.map(nameStatusPath);
  const forbidden = paths.filter(isForbidden);
  const deleted = entries
    .filter(function (entry) { return entry.startsWith("D\t"); })
    .map(nameStatusPath);
  const outside = paths.filter(function (candidatePath) {
    return !isAllowed(candidatePath);
  });
  if (forbidden.length !== 0) fail("FORBIDDEN_PATH_IN_DIFF", forbidden[0]);
  if (deleted.length !== 0) fail("DELETE_PATH_IN_DIFF", deleted[0]);
  if (!same(outside, OUTSIDE_ALLOWED)) fail("MISSION_SCOPE_EXCEPTION_SET_INVALID");
  if (!same(manifest.mission_scope.outside_allowed_paths_requiring_reviewer_adjudication, OUTSIDE_ALLOWED)) {
    fail("MISSION_SCOPE_EXCEPTION_DISCLOSURE_INVALID");
  }
  if (!same(manifest.mission_scope.forbidden_paths_in_candidate_diff, [])) {
    fail("FORBIDDEN_PATH_DISCLOSURE_INVALID");
  }
  if (!same(manifest.mission_scope.deleted_paths_in_candidate_diff, [])) {
    fail("DELETE_PATH_DISCLOSURE_INVALID");
  }
}

function validateSourcesContract(manifest) {
  if (!Array.isArray(manifest.source_files) || manifest.source_files.length !== SOURCE_FILES.length) {
    fail("SOURCE_SET_INVALID");
  }
  for (let index = 0; index < SOURCE_FILES.length; index += 1) {
    const item = manifest.source_files[index];
    exactKeys(item, ["path", "sha256", "bytes"], "SOURCE_FIELDS_INVALID");
    const [expectedPath, expectedSha, expectedBytes] = SOURCE_FILES[index];
    if (
      item.path !== expectedPath ||
      item.sha256 !== expectedSha ||
      item.bytes !== expectedBytes
    ) {
      fail("SOURCE_CONTRACT_INVALID", expectedPath);
    }
  }
}

async function validateSourceFiles(manifest) {
  validateSourcesContract(manifest);
  for (const source of manifest.source_files) {
    const bytes = await readFile(path.join(ROOT, source.path));
    validateSourceReceipt(source, bytes);
  }
}

function validateSourceReceipt(source, bytes) {
  if (bytes.length !== source.bytes || sha256(bytes) !== source.sha256) {
    fail("SOURCE_HASH_DRIFT", source.path);
  }
}

function validateCriteria(manifest) {
  if (!Array.isArray(manifest.criteria)) fail("CRITERIA_NOT_ARRAY");
  if (!same(manifest.criteria.map(function (item) { return item.id; }), CRITERION_IDS)) {
    fail("CRITERION_SET_OR_ORDER_INVALID");
  }
  const sourceSet = new Set(SOURCE_FILES.map(function (item) { return item[0]; }));
  for (const item of manifest.criteria) {
    exactKeys(item, ["id", "status", "evidence", "reviewer_task"], "CRITERION_FIELDS_INVALID");
    if (!STATUS_ALLOWLIST.has(item.status)) fail("CRITERION_STATUS_INVALID", item.id);
    if (!Array.isArray(item.evidence) || item.evidence.length === 0) {
      fail("CRITERION_EVIDENCE_INVALID", item.id);
    }
    for (const evidencePath of item.evidence) {
      if (!sourceSet.has(evidencePath)) fail("CRITERION_EVIDENCE_SOURCE_INVALID", item.id);
    }
    assertString(item.reviewer_task, "CRITERION_REVIEW_TASK_INVALID");
  }
  const byId = new Map(manifest.criteria.map(function (item) { return [item.id, item]; }));
  for (const id of CLOSED_W4_IDS) {
    if (byId.get(id).status !== "PASS_LOCAL") fail("CLOSED_W4_STATUS_INVALID", id);
  }
  if (byId.get("G-01").status !== "NOT_PROVEN") fail("G01_OVERCLAIM");
  for (const id of ["G-03", "G-04", "G-05"]) {
    if (byId.get(id).status !== "NOT_RUN") fail("DELIVERY_GATE_OVERCLAIM", id);
  }
}

function validateKnownGaps(manifest) {
  if (!Array.isArray(manifest.known_gaps)) fail("KNOWN_GAPS_NOT_ARRAY");
  if (!same(manifest.known_gaps.map(function (item) { return item.criterion_id; }), KNOWN_GAP_IDS)) {
    fail("KNOWN_GAP_SET_INVALID");
  }
  for (const item of manifest.known_gaps) {
    exactKeys(item, ["criterion_id", "gap"], "KNOWN_GAP_FIELDS_INVALID");
    assertString(item.gap, "KNOWN_GAP_TEXT_INVALID");
  }
}

function validateP1P12(manifest) {
  if (!Array.isArray(manifest.p1_p12) || manifest.p1_p12.length !== 12) {
    fail("P1_P12_SET_INVALID");
  }
  for (let index = 0; index < manifest.p1_p12.length; index += 1) {
    const item = manifest.p1_p12[index];
    exactKeys(item, ["id", "status", "command"], "P1_P12_FIELDS_INVALID");
    if (item.id !== "P" + (index + 1)) fail("P1_P12_ORDER_INVALID");
    if (item.status !== "NOT_RUN") fail("P1_P12_OVERCLAIM", item.id);
    assertString(item.command, "P1_P12_COMMAND_INVALID");
  }
}

function validateManifest(manifest) {
  exactKeys(
    manifest,
    [
      "schema_version",
      "package_kind",
      "overall_status",
      "expected_maximum_current_verdict",
      "candidate",
      "diff",
      "mission_scope",
      "package_paths",
      "source_files",
      "criteria",
      "known_gaps",
      "p1_p12",
      "delivery_gates",
      "review_boundary",
    ],
    "MANIFEST_FIELDS_INVALID",
  );
  if (manifest.schema_version !== 1) fail("MANIFEST_VERSION_INVALID");
  if (manifest.package_kind !== "F0_W2C_W4_READ_ONLY_ACCEPTANCE_PACKET") {
    fail("PACKAGE_KIND_INVALID");
  }
  if (manifest.overall_status !== "OPEN") fail("OVERALL_STATUS_OVERCLAIM");
  if (manifest.expected_maximum_current_verdict !== "BLOCKED_EXTERNAL_PERMISSION") {
    fail("EXPECTED_VERDICT_INVALID");
  }
  exactKeys(manifest.candidate, ["base", "head", "commits"], "CANDIDATE_FIELDS_INVALID");
  if (
    manifest.candidate.base !== BASE ||
    manifest.candidate.head !== CANDIDATE ||
    manifest.candidate.commits !== 64
  ) {
    fail("CANDIDATE_ANCHOR_INVALID");
  }
  exactKeys(
    manifest.diff,
    [
      "files",
      "added",
      "modified",
      "deleted",
      "canonical_format",
      "canonical_name_status_sha256",
      "canonical_name_status",
    ],
    "DIFF_FIELDS_INVALID",
  );
  if (
    manifest.diff.files !== 314 ||
    manifest.diff.added !== 98 ||
    manifest.diff.modified !== 216 ||
    manifest.diff.deleted !== 0 ||
    manifest.diff.canonical_name_status_sha256 !== NAME_STATUS_SHA256 ||
    manifest.diff.canonical_format !==
      "UTF-8; one STATUS<TAB>PATH record per line; LF after every record including final record; --no-renames"
  ) {
    fail("DIFF_INVENTORY_INVALID");
  }
  if (
    !Array.isArray(manifest.diff.canonical_name_status) ||
    manifest.diff.canonical_name_status.length !== 314 ||
    sha256(encodeNameStatus(manifest.diff.canonical_name_status)) !== NAME_STATUS_SHA256
  ) {
    fail("DIFF_NAME_STATUS_LIST_INVALID");
  }
  if (!same(manifest.package_paths, PACKAGE_PATHS)) fail("PACKAGE_PATH_SET_INVALID");
  validateSourcesContract(manifest);
  validateCriteria(manifest);
  validateKnownGaps(manifest);
  validateP1P12(manifest);
  exactKeys(
    manifest.delivery_gates,
    [
      "current_ci",
      "full_build",
      "draft_pr",
      "vercel_preview",
      "organizational_independent_review",
      "current_production_full_catalog",
    ],
    "DELIVERY_GATE_FIELDS_INVALID",
  );
  if (
    manifest.delivery_gates.current_ci !== "NOT_RUN" ||
    manifest.delivery_gates.draft_pr !== "NOT_RUN" ||
    manifest.delivery_gates.vercel_preview !== "NOT_RUN" ||
    manifest.delivery_gates.organizational_independent_review !== "NOT_RUN" ||
    manifest.delivery_gates.current_production_full_catalog !==
      "BLOCKED_EXTERNAL_PERMISSION/BOOTSTRAP_DECISION" ||
    manifest.delivery_gates.full_build !== "PASS_LOCAL"
  ) {
    fail("DELIVERY_GATE_STATE_INVALID");
  }
  exactKeys(
    manifest.review_boundary,
    [
      "review_mode",
      "remote_or_production_actions",
      "rls_policy_grant_default_acl_mutation",
      "merge_or_deploy",
      "contract_materialization_or_mutation",
      "f0_pass_claim",
      "merge_recommendation",
      "zip_readiness_green",
      "claude_zip",
    ],
    "REVIEW_BOUNDARY_FIELDS_INVALID",
  );
  if (
    manifest.review_boundary.review_mode !== "READ_ONLY_STOP_AFTER_VERDICT_NO_FIXES" ||
    manifest.review_boundary.remote_or_production_actions !== "FORBIDDEN" ||
    manifest.review_boundary.rls_policy_grant_default_acl_mutation !== "FORBIDDEN" ||
    manifest.review_boundary.merge_or_deploy !== "FORBIDDEN" ||
    manifest.review_boundary.contract_materialization_or_mutation !== "FORBIDDEN" ||
    manifest.review_boundary.f0_pass_claim !== "FORBIDDEN_AT_PACKET_CREATION" ||
    manifest.review_boundary.merge_recommendation !== "FORBIDDEN_AT_PACKET_CREATION" ||
    manifest.review_boundary.zip_readiness_green !== "FORBIDDEN_AT_PACKET_CREATION" ||
    manifest.review_boundary.claude_zip !==
      "REQUIRES_SEPARATE_LITERAL_USER_AUTHORIZATION_CLAUDE-ZIP ERSTELLEN_AFTER_INDEPENDENT_F0_GREEN"
  ) {
    fail("REVIEW_BOUNDARY_INVALID");
  }
  validateMissionScope(manifest, manifest.diff.canonical_name_status);
}

async function loadManifest() {
  const bytes = await readFile(MANIFEST_PATH);
  let manifest;
  try {
    manifest = JSON.parse(bytes.toString("utf8"));
  } catch {
    fail("MANIFEST_JSON_INVALID");
  }
  validateManifest(manifest);
  return { manifest, sha256: sha256(bytes) };
}

function validateCandidateGit(manifest) {
  const ancestry = git(
    ["merge-base", "--is-ancestor", BASE, CANDIDATE],
    { allowFailure: true },
  );
  if (ancestry.status !== 0) fail("BASE_NOT_ANCESTOR");
  const commits = Number(git(["rev-list", "--count", BASE + ".." + CANDIDATE]).trim());
  if (commits !== 64) fail("CANDIDATE_COMMIT_COUNT_INVALID", String(commits));
  const entries = parseNameStatus(
    git(
      ["diff", "--name-status", "--no-renames", "-z", BASE + ".." + CANDIDATE],
      { encoding: null },
    ),
  );
  const added = entries.filter(function (entry) { return entry.startsWith("A\t"); }).length;
  const modified = entries.filter(function (entry) { return entry.startsWith("M\t"); }).length;
  const deleted = entries.filter(function (entry) { return entry.startsWith("D\t"); }).length;
  if (entries.length !== 314 || added !== 98 || modified !== 216 || deleted !== 0) {
    fail("CANDIDATE_DIFF_COUNTS_INVALID");
  }
  if (sha256(encodeNameStatus(entries)) !== NAME_STATUS_SHA256) {
    fail("CANDIDATE_DIFF_SHA_INVALID");
  }
  if (!same(entries, manifest.diff.canonical_name_status)) {
    fail("CANDIDATE_DIFF_LIST_INVALID");
  }
  validateMissionScope(manifest, entries);
  return entries;
}

function parseWorkingTreeStatus(raw) {
  const records = raw.toString("utf8").split("\0");
  if (records.at(-1) === "") records.pop();
  return records.map(function (record) {
    if (record.length < 4 || record[2] !== " ") fail("WORKTREE_STATUS_INVALID");
    return { status: record.slice(0, 2), path: record.slice(3).replaceAll("\\", "/") };
  });
}

function validateWorkingTreePackage(head, records) {
  if (head !== CANDIDATE) fail("WORKTREE_HEAD_INVALID", head);
  if (records.some(function (record) { return record.status !== " M"; })) {
    fail("WORKTREE_PACKAGE_STATE_INVALID");
  }
  const paths = records.map(function (record) { return record.path; }).sort();
  if (!same(paths, PACKAGE_PATHS.slice().sort())) fail("WORKTREE_PACKAGE_SET_INVALID");
}

function validateCommittedPackage(head, parents, entries, worktreeClean) {
  if (!worktreeClean) fail("COMMITTED_CHECK_REQUIRES_CLEAN_WORKTREE");
  if (head === CANDIDATE) fail("PACKAGE_COMMIT_MISSING");
  if (!same(parents, [CANDIDATE])) fail("PACKAGE_PARENT_INVALID");
  if (
    entries.some(function (entry) { return !entry.startsWith("M\t"); }) ||
    !same(entries.map(nameStatusPath).sort(), PACKAGE_PATHS.slice().sort())
  ) {
    fail("COMMITTED_PACKAGE_SET_INVALID");
  }
}

async function runCheckWorkingTree() {
  const loaded = await loadManifest();
  await validateSourceFiles(loaded.manifest);
  validateCandidateGit(loaded.manifest);
  const head = git(["rev-parse", "HEAD"]).trim();
  const status = parseWorkingTreeStatus(
    git(["status", "--porcelain=v1", "-z", "--untracked-files=all"], { encoding: null }),
  );
  validateWorkingTreePackage(head, status);
  console.log(JSON.stringify({
    gate: "F0_INDEPENDENT_REVIEW_MANIFEST",
    status: "PASS",
    criteria: 36,
    known_not_proven: KNOWN_GAP_IDS.length,
    candidate_verdict_ceiling: "BLOCKED_EXTERNAL_PERMISSION",
  }));
  console.log(JSON.stringify({
    gate: "F0_INDEPENDENT_REVIEW_CANDIDATE_INVENTORY",
    status: "PASS",
    commits: 64,
    files: 314,
    added: 98,
    modified: 216,
    deleted: 0,
    name_status_sha256: NAME_STATUS_SHA256,
    outside_mission_allowlist_requiring_review: OUTSIDE_ALLOWED.length,
  }));
  console.log(JSON.stringify({
    gate: "F0_INDEPENDENT_REVIEW_PACKAGE",
    status: "PASS",
    mode: "WORKING_TREE",
    package_commit: "NOT_COMMITTED",
    candidate_head: CANDIDATE,
    manifest_sha256: loaded.sha256,
    overall_f0: "OPEN",
  }));
}

async function runCheckCommitted() {
  const loaded = await loadManifest();
  await validateSourceFiles(loaded.manifest);
  validateCandidateGit(loaded.manifest);
  const head = git(["rev-parse", "HEAD"]).trim();
  const parentLine = git(["rev-list", "--parents", "-n", "1", head]).trim().split(/\s+/);
  const parents = parentLine.slice(1);
  const statusRaw = git(
    ["status", "--porcelain=v1", "-z", "--untracked-files=all"],
    { encoding: null },
  );
  const packageEntries = parseNameStatus(
    git(
      ["diff-tree", "--no-commit-id", "--name-status", "--no-renames", "-r", "-z", head + "^", head],
      { encoding: null },
    ),
  );
  validateCommittedPackage(head, parents, packageEntries, statusRaw.length === 0);
  if (Number(git(["rev-list", "--count", CANDIDATE + ".." + head]).trim()) !== 1) {
    fail("PACKAGE_COMMIT_DISTANCE_INVALID");
  }
  console.log(JSON.stringify({
    gate: "F0_INDEPENDENT_REVIEW_MANIFEST",
    status: "PASS",
    criteria: 36,
    known_not_proven: KNOWN_GAP_IDS.length,
    candidate_verdict_ceiling: "BLOCKED_EXTERNAL_PERMISSION",
  }));
  console.log(JSON.stringify({
    gate: "F0_INDEPENDENT_REVIEW_CANDIDATE_INVENTORY",
    status: "PASS",
    commits: 64,
    files: 314,
    added: 98,
    modified: 216,
    deleted: 0,
    name_status_sha256: NAME_STATUS_SHA256,
    outside_mission_allowlist_requiring_review: OUTSIDE_ALLOWED.length,
  }));
  console.log(JSON.stringify({
    gate: "F0_INDEPENDENT_REVIEW_PACKAGE",
    status: "PASS",
    mode: "COMMITTED",
    package_commit: head,
    first_parent: CANDIDATE,
    manifest_sha256: loaded.sha256,
    overall_f0: "OPEN",
  }));
}

async function runSelftest() {
  const loaded = await loadManifest();
  await validateSourceFiles(loaded.manifest);
  const expectReject = function (code, action) {
    try {
      action();
    } catch (error) {
      if (String(error.message).startsWith(code)) return;
      throw error;
    }
    fail("SELFTEST_EXPECTED_REJECTION_MISSING", code);
  };
  const clone = function (value) { return structuredClone(value); };

  const missing = clone(loaded.manifest);
  missing.criteria.pop();
  expectReject("CRITERION_SET_OR_ORDER_INVALID", function () {
    validateManifest(missing);
  });
  const duplicate = clone(loaded.manifest);
  duplicate.criteria[1] = clone(duplicate.criteria[0]);
  expectReject("CRITERION_SET_OR_ORDER_INVALID", function () {
    validateManifest(duplicate);
  });
  const underclaim = clone(loaded.manifest);
  underclaim.criteria.find(function (item) { return item.id === "W4-02"; }).status =
    "NOT_PROVEN";
  expectReject("CLOSED_W4_STATUS_INVALID", function () {
    validateManifest(underclaim);
  });
  const inventedGap = clone(loaded.manifest);
  inventedGap.known_gaps.push({ criterion_id: "W4-02", gap: "invented" });
  expectReject("KNOWN_GAP_SET_INVALID", function () {
    validateManifest(inventedGap);
  });
  const sourceDrift = clone(loaded.manifest);
  sourceDrift.source_files[0].sha256 = "0".repeat(64);
  expectReject("SOURCE_CONTRACT_INVALID", function () {
    validateManifest(sourceDrift);
  });
  expectReject("SOURCE_HASH_DRIFT", function () {
    validateSourceReceipt(loaded.manifest.source_files[0], Buffer.from("drift"));
  });
  const inventoryDrift = clone(loaded.manifest);
  inventoryDrift.diff.canonical_name_status.pop();
  expectReject("DIFF_NAME_STATUS_LIST_INVALID", function () {
    validateManifest(inventoryDrift);
  });
  const forbiddenEntries = loaded.manifest.diff.canonical_name_status.concat(["M\t.env"]);
  expectReject("FORBIDDEN_PATH_IN_DIFF", function () {
    validateMissionScope(loaded.manifest, forbiddenEntries);
  });
  const workingRecords = PACKAGE_PATHS.map(function (packagePath) {
    return { status: " M", path: packagePath };
  });
  expectReject("WORKTREE_HEAD_INVALID", function () {
    validateWorkingTreePackage("0".repeat(40), workingRecords);
  });
  expectReject("WORKTREE_PACKAGE_SET_INVALID", function () {
    validateWorkingTreePackage(CANDIDATE, workingRecords.slice(1));
  });
  const packageEntries = PACKAGE_PATHS.map(function (packagePath) {
    return "M\t" + packagePath;
  });
  expectReject("PACKAGE_PARENT_INVALID", function () {
    validateCommittedPackage("1".repeat(40), ["0".repeat(40)], packageEntries, true);
  });
  expectReject("COMMITTED_PACKAGE_SET_INVALID", function () {
    validateCommittedPackage("1".repeat(40), [CANDIDATE], packageEntries.slice(1), true);
  });

  console.log(JSON.stringify({
    gate: "F0_INDEPENDENT_REVIEW_PACKAGE_SELFTEST",
    status: "PASS",
    mutation_free: true,
    adversarial_cases: 12,
    overall_f0: "OPEN",
  }));
}

async function main() {
  const args = process.argv.slice(2);
  if (args.length !== 1) fail("EXACTLY_ONE_MODE_REQUIRED");
  if (args[0] === "--selftest") return runSelftest();
  if (args[0] === "--check-working-tree") return runCheckWorkingTree();
  if (args[0] === "--check") return runCheckCommitted();
  fail("MODE_UNSUPPORTED", args[0]);
}

main().catch(function (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
