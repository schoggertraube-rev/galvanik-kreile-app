// Delivery-Governance-Gate: prueft Paketmanifeste, rollende Queue,
// Evidenzzeiger, Alt-PR-Dispositionen und das Betriebsreceipt als eine fail-closed Wahrheit.
// Keine Netzwerkzugriffe und keine Mutation des geprueften Baums.

import {
  cpSync,
  existsSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { tmpdir } from "node:os";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import Ajv from "ajv";
import yaml from "js-yaml";

export const DELIVERY_PATHS = Object.freeze({
  manifestDir: "docs/delivery/packages",
  manifestSchema: "docs/delivery/packages/PACKAGE_MANIFEST_SCHEMA_V2.json",
  queue: "docs/delivery/ROLLING_MANIFEST_QUEUE_V1.json",
  queueSchema: "docs/delivery/ROLLING_MANIFEST_QUEUE_SCHEMA_V1.json",
  mapping: "docs/delivery/GATE_MAPPING_V1.yaml",
  mission: "missions/F1_ORDER_TO_CASH_PILOT_001.yml",
  pr113Disposition: "docs/delivery/KR-04_PR113_DISPOSITION_2026-09-29.json",
  operatingReceipt: "docs/delivery/KR-01_BRANCH_PROTECTION_AND_OPERATING_RECEIPT_2026-09-29.json",
  operatingReceiptSchema: "docs/delivery/KR-01_BRANCH_PROTECTION_AND_OPERATING_RECEIPT_SCHEMA_V1.json",
});

export const ACTIVE_MANIFEST_BINDING = Object.freeze({
  path: "docs/delivery/packages/KR-04-PR113-DISPOSITION.yaml",
  packageId: "KR-04-PR113-DISPOSITION",
});

const PR113_PATH_DECISIONS = Object.freeze({
  "e2e/path1-v5-shell-smoke.real.spec.ts": "DEFER_TO_KR20_FRESH_DESIGN_SYSTEM_REBUILD",
  "src/app/buchhaltung/rechnungen/InvoicesClient.tsx": "DEFER_TO_KR20_FRESH_DESIGN_SYSTEM_REBUILD",
  "src/app/buchhaltung/rechnungen/RechnungenClient.tsx": "SALVAGE_AS_KR04R_FRESH_DELETE",
  "src/app/buchhaltung/rechnungen/__tests__/page.test.tsx": "DEFER_TO_KR20_FRESH_DESIGN_SYSTEM_REBUILD",
  "src/app/layout.tsx": "REJECT_MOCK_CSS_INTEGRATION",
  "src/styles/mock/mock-kreile-compat.css": "REJECT_MOCK_CSS_INTEGRATION",
  "src/styles/mock/mock-kreile-rolf-accounting.css": "REJECT_MOCK_CSS_INTEGRATION",
});

const PR113_PATH_BLOBS = Object.freeze({
  "e2e/path1-v5-shell-smoke.real.spec.ts": Object.freeze({
    parent: "0bec1fe7f62bc7f1af8a411f4f80fe7e8a1b9108",
    pr: "85f75d67d4e18a97f1c563c9f033c466294cd6c1",
  }),
  "src/app/buchhaltung/rechnungen/InvoicesClient.tsx": Object.freeze({
    parent: "dc343081d706b15c068d09366dd566fd14991ca4",
    pr: "0157e44ec6bb2b792309753d0d9b2fa8389cb114",
  }),
  "src/app/buchhaltung/rechnungen/RechnungenClient.tsx": Object.freeze({
    parent: "18594debbed3e6565bb63166d6adbc7aa9579745",
    pr: null,
  }),
  "src/app/buchhaltung/rechnungen/__tests__/page.test.tsx": Object.freeze({
    parent: "b1868e792a4a9bec76e36ca7e97dc2a372c6c2a8",
    pr: "f352cad5cf6628d4a440aa2eaffc6dd2454c9454",
  }),
  "src/app/layout.tsx": Object.freeze({
    parent: "320e95d4694b60412ae7d63650bd81032212db8f",
    pr: "b3d37599a5a218b04b524e57711c480c0ee9e27c",
  }),
  "src/styles/mock/mock-kreile-compat.css": Object.freeze({
    parent: "74bcb53a10b184a4881a76b6d2e174af03a8e652",
    pr: "3837617d774c188e24ed73eadc8b7753a8b3aeab",
  }),
  "src/styles/mock/mock-kreile-rolf-accounting.css": Object.freeze({
    parent: null,
    pr: "036b36a73525135e3144b4b2d45711f4c0a62f66",
  }),
});

export const LEGACY_MANIFEST_BINDINGS = Object.freeze({
  "KR-00E-DELIVERY-CONTRACT": Object.freeze({
    path: "docs/delivery/packages/KR-00E-DELIVERY-CONTRACT.yaml",
    sha256: "527AD0100BEF2B7130F1B75B6F79D4960EF94CD038141079C5D1BAFCBDD570D8",
  }),
  "KR-00G-DOCS-IMPORT": Object.freeze({
    path: "docs/delivery/packages/KR-00G-DOCS-IMPORT.yaml",
    sha256: "04877E37F6DF4017D79960BFCF423FA423FA45E7BC77FE9A35B16EB4812B8D0D",
  }),
});

export const LEGACY_V1_MANIFEST_BINDINGS = Object.freeze({
  "docs/delivery/packages/KR-00B0-GOVERNANCE-BOOTSTRAP.yaml": Object.freeze({
    packageId: "KR-00B0-GOVERNANCE-BOOTSTRAP",
    sha256: "BF9F68BC6221F97E4F66EFCEB49F684D63043EB949DCE8C504783A0A11A497F3",
  }),
  "docs/delivery/packages/KR-00B-TRUTH-SYNC.yaml": Object.freeze({
    packageId: "KR-00B-TRUTH-SYNC",
    sha256: "1DBECF8492166D73F9FBC77926D5E3386F060B7AAF6573B4A920534D752C39D4",
  }),
  "docs/delivery/packages/KR-00C-MISSION-CONTRACT.yaml": Object.freeze({
    packageId: "KR-00C-MISSION-CONTRACT",
    sha256: "EBEED806859CA9DAFA836D7D1E39C5C9CE1221BAF8ED9DC0185B9447C5B4809C",
  }),
  "docs/delivery/packages/KR-00D-ALTINVENTAR.yaml": Object.freeze({
    packageId: "KR-00D-ALTINVENTAR",
    sha256: "B410F710DCD3B5F6CBF0B6F57B0359FD36C5CC7579BB479CD9E1132930C6B651",
  }),
});

const EFFECTIVE_REQUIRED_CHECKS = Object.freeze([
  "quality",
  "agentur-gate",
  "Fresh Supabase replay",
]);
const NON_REQUIRED_BUT_MUST_PASS = Object.freeze(["ratchet"]);
const REVIEWED_QUEUE_PARENT_SHA = "0d5dd46bd8484ba3a5b7a97a762cd148b8bafff9";
const SHA_PATTERN = /^[0-9a-f]{40}$/;

function toPosix(value) {
  return value.replaceAll("\\", "/");
}

function sha256(bytes) {
  return createHash("sha256").update(bytes).digest("hex").toUpperCase();
}

function normalizedStringSet(value) {
  if (!Array.isArray(value) || value.some((entry) => typeof entry !== "string")) return null;
  return [...new Set(value)].sort();
}

function sameStringSet(left, right) {
  const normalizedLeft = normalizedStringSet(left);
  const normalizedRight = normalizedStringSet(right);
  return normalizedLeft !== null && normalizedRight !== null && JSON.stringify(normalizedLeft) === JSON.stringify(normalizedRight);
}

function handoffSignature(value) {
  if (!value || typeof value !== "object") return null;
  const entries = Array.isArray(value.entries)
    ? value.entries.map((entry) => ({
        pr: entry?.pr,
        parent_sha: entry?.parent_sha,
        candidate_sha: entry?.candidate_sha,
        merge_sha: entry?.merge_sha,
        tree_sha: entry?.tree_sha,
        scope: entry?.scope,
        review_result: entry?.review_result,
        post_main_agentur_gate_run: entry?.post_main_agentur_gate_run,
        post_main_quality_run: entry?.post_main_quality_run,
        vercel_status: entry?.vercel_status,
      }))
    : null;
  return JSON.stringify({
    queue_parent_sha: value.queue_parent_sha,
    effective_base_sha: value.effective_base_sha,
    effective_base_tree_sha: value.effective_base_tree_sha,
    entries,
  });
}

export function trustedCommitFacts(repo, sha) {
  if (!SHA_PATTERN.test(sha)) {
    throw new Error("ungueltiger Trusted-Commit-SHA");
  }
  const output = execFileSync(
    "git",
    ["-C", repo, "show", "-s", "--format=%H%n%P%n%T", "--end-of-options", sha],
    { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] },
  )
    .trim()
    .split(/\r?\n/);
  return {
    sha: output[0] ?? "",
    parents: (output[1] ?? "").split(" ").filter(Boolean),
    tree: output[2] ?? "",
  };
}

export function validateTrustedHandoff(handoff, trustedBaseSha, readCommitFacts) {
  const findings = [];
  try {
    const base = readCommitFacts(trustedBaseSha);
    if (base.sha !== trustedBaseSha) {
      findings.push("[delivery] Geschuetzter Base-SHA ist im Trusted-Repository nicht aufloesbar");
      return findings;
    }
    if (handoff?.effective_base_sha !== base.sha || handoff?.effective_base_tree_sha !== base.tree) {
      findings.push("[delivery] Effective Base stimmt nicht mit dem geschuetzten Git-Checkout ueberein");
    }

    for (const [index, entry] of (handoff?.entries ?? []).entries()) {
      const commit = readCommitFacts(entry.merge_sha);
      const expectedParents = [entry.parent_sha, entry.candidate_sha];
      if (
        commit.sha !== entry.merge_sha ||
        commit.tree !== entry.tree_sha ||
        JSON.stringify(commit.parents) !== JSON.stringify(expectedParents)
      ) {
        findings.push(`[delivery] Handoff-Eintrag ${index + 1} stimmt nicht mit dem geschuetzten Git-Graph ueberein`);
      }
    }
  } catch (error) {
    findings.push(`[delivery] Geschuetzter Git-Graph konnte nicht geprueft werden (${error.message})`);
  }
  return findings;
}

function checkTrustedHandoff(handoff, findings) {
  const required = process.env.DELIVERY_REQUIRE_TRUSTED_BASE === "true";
  const trustedBaseSha = process.env.DELIVERY_TRUSTED_BASE_SHA;
  const trustedRepo = process.env.DELIVERY_TRUSTED_REPO;
  if (!required && trustedBaseSha === undefined && trustedRepo === undefined) return;
  if (!SHA_PATTERN.test(trustedBaseSha ?? "") || !trustedRepo) {
    findings.push("[delivery] Geschuetzter Base-Kontext ist unvollstaendig oder ungueltig");
    return;
  }
  findings.push(
    ...validateTrustedHandoff(handoff, trustedBaseSha, (sha) => trustedCommitFacts(trustedRepo, sha)),
  );
}

function readJson(root, rel, findings, label = rel) {
  const abs = path.join(root, rel);
  if (!existsSync(abs)) {
    findings.push(`[delivery] ${label}: Datei fehlt`);
    return null;
  }
  try {
    return JSON.parse(readFileSync(abs, "utf8"));
  } catch (error) {
    findings.push(`[delivery] ${label}: ungueltiges JSON (${error.message})`);
    return null;
  }
}

function readYaml(root, rel, findings, label = rel) {
  const abs = path.join(root, rel);
  if (!existsSync(abs)) {
    findings.push(`[delivery] ${label}: Datei fehlt`);
    return null;
  }
  try {
    const value = yaml.load(readFileSync(abs, "utf8"));
    if (!value || typeof value !== "object" || Array.isArray(value)) {
      findings.push(`[delivery] ${label}: YAML-Wurzel muss ein Objekt sein`);
      return null;
    }
    return value;
  } catch (error) {
    findings.push(`[delivery] ${label}: ungueltiges YAML (${error.message})`);
    return null;
  }
}

function compileSchema(schema, label, findings) {
  if (!schema) return null;
  try {
    const ajv = new Ajv({ allErrors: true, $data: true, jsonPointers: true });
    return ajv.compile(schema);
  } catch (error) {
    findings.push(`[delivery] ${label}: Schema kompiliert nicht (${error.message})`);
    return null;
  }
}

function validateWith(validate, value, label, findings) {
  if (!validate || value === null) return;
  if (validate(value)) return;
  for (const error of validate.errors ?? []) {
    findings.push(`[delivery] ${label}${error.dataPath || ""}: ${error.message}`);
  }
}

function manifestFiles(root) {
  const abs = path.join(root, DELIVERY_PATHS.manifestDir);
  if (!existsSync(abs)) return [];
  return readdirSync(abs, { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith(".yaml"))
    .map((entry) => toPosix(path.join(DELIVERY_PATHS.manifestDir, entry.name)))
    .sort();
}

function sourceRuntimeReferences(root, needle, excludedRel) {
  const sourceRoot = path.join(root, "src");
  if (!existsSync(sourceRoot)) return [];
  const pending = [sourceRoot];
  const matches = [];
  while (pending.length > 0) {
    const current = pending.pop();
    for (const entry of readdirSync(current, { withFileTypes: true })) {
      const absolute = path.join(current, entry.name);
      if (entry.isDirectory()) {
        pending.push(absolute);
        continue;
      }
      if (!entry.isFile() || !/\.(?:ts|tsx)$/.test(entry.name)) continue;
      const rel = toPosix(path.relative(root, absolute));
      if (rel === excludedRel) continue;
      if (readFileSync(absolute, "utf8").includes(needle)) matches.push(rel);
    }
  }
  return matches.sort();
}

function gateTargets(manifest) {
  return new Set([
    ...(Array.isArray(manifest.local_gates) ? manifest.local_gates : []),
    ...(Array.isArray(manifest.required_checks_after_push) ? manifest.required_checks_after_push : []),
    ...(Array.isArray(manifest.non_required_but_must_pass) ? manifest.non_required_but_must_pass : []),
  ]);
}

function receiptTargets(manifest) {
  const values = new Set();
  for (const lock of Array.isArray(manifest.source_locks) ? manifest.source_locks : []) {
    if (typeof lock?.source === "string") values.add(lock.source);
    if (typeof lock?.status === "string") values.add(lock.status);
  }
  for (const key of ["gate_mapping_contract", "findings_ledger_contract", "closure_receipt_contract"]) {
    if (typeof manifest[key] === "string") values.add(manifest[key]);
  }
  if (typeof manifest.dependency?.review_evidence === "string") values.add(manifest.dependency.review_evidence);
  return values;
}

function resolveEvidenceRefs(manifest, rel, findings) {
  if (!manifest.register_gate_evidence) return;
  const acceptance = new Set((manifest.acceptance ?? []).map((entry) => entry?.id).filter((id) => typeof id === "string"));
  const invariants = new Set(Object.keys(manifest.invariants ?? {}));
  const gates = gateTargets(manifest);
  const receipts = receiptTargets(manifest);

  for (const [gateName, evidence] of Object.entries(manifest.register_gate_evidence)) {
    const ref = evidence?.evidence_ref;
    if (typeof ref !== "string" || !ref.includes(":")) continue;
    const split = ref.indexOf(":");
    const kind = ref.slice(0, split);
    const target = ref.slice(split + 1);
    let resolved = false;
    if (kind === "acceptance") resolved = acceptance.has(target);
    else if (kind === "invariant") resolved = invariants.has(target);
    else if (kind === "gate") resolved = gates.has(target);
    else if (kind === "receipt") resolved = receipts.has(target);
    if (!resolved) findings.push(`[delivery] ${rel}: ${gateName} evidence_ref '${ref}' loest nicht im eigenen Manifest auf`);
  }
}

function checkLegacyBindings(root, manifests, findings) {
  const occurrences = new Map();
  for (const { rel, value } of manifests) {
    if (typeof value?.package_id !== "string") continue;
    if (!occurrences.has(value.package_id)) occurrences.set(value.package_id, []);
    occurrences.get(value.package_id).push(rel);
  }

  for (const [packageId, binding] of Object.entries(LEGACY_MANIFEST_BINDINGS)) {
    const seen = occurrences.get(packageId) ?? [];
    if (seen.length !== 1 || seen[0] !== binding.path) {
      findings.push(`[delivery] ${packageId}: Legacy-Ausnahme ist nur fuer '${binding.path}' erlaubt, gefunden ${seen.join(", ") || "nichts"}`);
    }
    const abs = path.join(root, binding.path);
    if (!existsSync(abs)) continue;
    const actual = sha256(readFileSync(abs));
    if (actual !== binding.sha256) {
      findings.push(`[delivery] ${binding.path}: Legacy-Hash ${actual}, erwartet ${binding.sha256}`);
    }
  }
}

function checkLegacyV1Bindings(root, manifests, findings) {
  const v1Manifests = manifests.filter(({ value }) => value?.schema_version === 1);
  const knownPaths = new Set(Object.keys(LEGACY_V1_MANIFEST_BINDINGS));

  for (const { rel } of v1Manifests) {
    if (!knownPaths.has(rel)) {
      findings.push(`[delivery] ${rel}: ungebundenes V1-Manifest ist nicht erlaubt`);
    }
  }

  for (const [rel, binding] of Object.entries(LEGACY_V1_MANIFEST_BINDINGS)) {
    const matches = v1Manifests.filter((entry) => entry.rel === rel);
    if (matches.length !== 1) {
      findings.push(`[delivery] ${rel}: eingefrorenes V1-Manifest fehlt oder ist nicht eindeutig`);
      continue;
    }
    if (matches[0].value?.package_id !== binding.packageId) {
      findings.push(`[delivery] ${rel}: V1-package_id '${String(matches[0].value?.package_id)}', erwartet '${binding.packageId}'`);
    }
    const actual = sha256(readFileSync(path.join(root, rel)));
    if (actual !== binding.sha256) {
      findings.push(`[delivery] ${rel}: V1-Legacy-Hash ${actual}, erwartet ${binding.sha256}`);
    }
  }
}

function checkOperatingTruth(receipt, mapping, findings) {
  if (!receipt || !mapping) return;
  const truth = receipt.delivery_truth ?? {};
  for (const key of ["main_delivered", "merge_performed", "production_authorized"]) {
    if (truth[key] !== false) findings.push(`[delivery] Betriebsreceipt delivery_truth.${key} muss false sein`);
  }

  const classicChecks = receipt.classic_protection?.required_checks ?? [];
  const rulesetChecks = receipt.active_ruleset?.required_checks ?? [];
  const effectiveChecks = receipt.effective_required_checks ?? [];
  const derivedEffectiveChecks = [...new Set([...classicChecks, ...rulesetChecks])];
  if (!sameStringSet(effectiveChecks, EFFECTIVE_REQUIRED_CHECKS)) {
    findings.push("[delivery] Betriebsreceipt effective_required_checks weicht von der geschuetzten Sollmenge ab");
  }
  if (!sameStringSet(effectiveChecks, derivedEffectiveChecks)) {
    findings.push("[delivery] Betriebsreceipt effective_required_checks entspricht nicht Classic ∪ Ruleset");
  }
  if (receipt.classic_protection?.enforce_admins !== true) {
    findings.push("[delivery] Betriebsreceipt classic_protection.enforce_admins muss true sein");
  }
  if (receipt.active_ruleset?.enforcement !== "active") {
    findings.push("[delivery] Betriebsreceipt active_ruleset.enforcement muss active sein");
  }
  if (!Array.isArray(receipt.active_ruleset?.bypass_actors) || receipt.active_ruleset.bypass_actors.length !== 0) {
    findings.push("[delivery] Betriebsreceipt active_ruleset.bypass_actors muss leer sein");
  }
  if (receipt.active_ruleset?.current_user_can_bypass !== "never") {
    findings.push("[delivery] Betriebsreceipt active_ruleset.current_user_can_bypass muss never sein");
  }
  if (receipt.ratchet?.required !== false || receipt.ratchet?.must_pass !== true) {
    findings.push("[delivery] Betriebsreceipt ratchet muss NOT_REQUIRED_BUT_MUST_PASS bleiben");
  }

  const mapped = mapping.required_check_truth ?? {};
  if (!sameStringSet(mapped.actual_required_names, effectiveChecks)) {
    findings.push("[delivery] required_check_truth.actual_required_names stimmt nicht mit dem Betriebsreceipt ueberein");
  }
  if (!sameStringSet(mapped.actual_non_required_but_must_pass, NON_REQUIRED_BUT_MUST_PASS)) {
    findings.push("[delivery] required_check_truth.actual_non_required_but_must_pass muss exakt ratchet enthalten");
  }
  if (mapped.active_ruleset_bypass_actors !== receipt.active_ruleset?.bypass_actors?.length) {
    findings.push("[delivery] required_check_truth.active_ruleset_bypass_actors stimmt nicht mit dem Betriebsreceipt ueberein");
  }
  if (mapped.current_user_can_bypass !== receipt.active_ruleset?.current_user_can_bypass) {
    findings.push("[delivery] required_check_truth.current_user_can_bypass stimmt nicht mit dem Betriebsreceipt ueberein");
  }
  if (mapped.branch_protection_receipt !== DELIVERY_PATHS.operatingReceipt) {
    findings.push("[delivery] required_check_truth.branch_protection_receipt zeigt nicht auf das kanonische Betriebsreceipt");
  }

  const calibration = receipt.resource_calibration ?? {};
  const samples = Array.isArray(calibration.samples) ? calibration.samples : [];
  if (samples.length > 0) {
    const minRam = Math.min(...samples.map((sample) => sample.available_ram_mb));
    const maxShell = Math.max(...samples.map((sample) => sample.shell_probe_seconds));
    const maxGit = Math.max(...samples.map((sample) => sample.git_probe_seconds));
    if (calibration.observed_min_available_ram_mb !== minRam) {
      findings.push("[delivery] resource_calibration.observed_min_available_ram_mb ist nicht aus samples abgeleitet");
    }
    if (calibration.observed_max_shell_probe_seconds !== maxShell) {
      findings.push("[delivery] resource_calibration.observed_max_shell_probe_seconds ist nicht aus samples abgeleitet");
    }
    if (calibration.observed_max_git_probe_seconds !== maxGit) {
      findings.push("[delivery] resource_calibration.observed_max_git_probe_seconds ist nicht aus samples abgeleitet");
    }
  }
}

function checkPr113Disposition(root, disposition, findings) {
  if (!disposition) return;
  if (disposition.schema_version !== 1 || disposition.contract_id !== "KR-04_PR113_DISPOSITION_2026-09-29") {
    findings.push("[delivery] PR113-Disposition hat falsche Schema- oder Vertragskennung");
  }
  if (disposition.package_id !== ACTIVE_MANIFEST_BINDING.packageId) {
    findings.push("[delivery] PR113-Disposition ist nicht an das aktive Paket gebunden");
  }
  if (disposition.parent_candidate_sha !== "da8c352d91a694d9c72551a245805386bbf7efdc") {
    findings.push("[delivery] PR113-Disposition hat nicht den geprueften KR-01R-Parent");
  }
  if (disposition.origin_main_sha_at_disposition !== "fa1a989fa5844305e6a8200832ed43e2fc230751") {
    findings.push("[delivery] PR113-Disposition hat nicht den belegten origin/main-Stand");
  }

  const pr = disposition.pull_request ?? {};
  const exactPrFacts = {
    number: 113,
    url: "https://github.com/schoggertraube-rev/galvanik-kreile-app/pull/113",
    base_ref: "main",
    base_sha: "21a23567d51e4805f065ce9ae8c59bdc5faf9fa9",
    head_ref: "path1/v2-k4-geld",
    head_sha: "e477e6b2314d5a97575a32dc35ca0d16b55625d7",
    tree_sha: "7455453281a84fd9bb0a351fd7063ef4994dda4c",
    archive_ref: "archive/pr-113-e477e6b2",
    archive_head_sha: "e477e6b2314d5a97575a32dc35ca0d16b55625d7",
    state_before_closure: "OPEN_DRAFT",
    state_after_closure: "CLOSED_UNMERGED",
    merged: false,
    source_branch_preserved: true,
    archive_ref_preserved: true,
    closed_at: "2026-09-29T15:11:38Z",
  };
  for (const [key, expected] of Object.entries(exactPrFacts)) {
    if (pr[key] !== expected) findings.push(`[delivery] PR113-Disposition pull_request.${key} weicht vom belegten Wert ab`);
  }
  if (!/^https:\/\/github\.com\/schoggertraube-rev\/galvanik-kreile-app\/pull\/113#issuecomment-\d+$/.test(pr.closure_comment_url ?? "")) {
    findings.push("[delivery] PR113-Disposition enthaelt keinen gueltigen Wahrheitskommentar-Link");
  }

  const decisions = Array.isArray(disposition.path_decisions) ? disposition.path_decisions : [];
  if (decisions.length !== 7) findings.push(`[delivery] PR113-Disposition muss exakt 7 Pfadentscheidungen enthalten, gefunden ${decisions.length}`);
  const seen = new Set();
  for (const entry of decisions) {
    const rel = entry?.path;
    if (typeof rel !== "string" || !(rel in PR113_PATH_DECISIONS)) {
      findings.push(`[delivery] PR113-Disposition enthaelt unerwarteten Pfad '${String(rel)}'`);
      continue;
    }
    if (seen.has(rel)) findings.push(`[delivery] PR113-Disposition enthaelt Pfad '${rel}' mehrfach`);
    seen.add(rel);
    if (entry.decision !== PR113_PATH_DECISIONS[rel]) {
      findings.push(`[delivery] Disposition fuer '${rel}' ist '${String(entry.decision)}' statt '${PR113_PATH_DECISIONS[rel]}'`);
    }
    const blobs = PR113_PATH_BLOBS[rel];
    if (entry.parent_blob_sha !== blobs.parent || entry.pr_blob_sha !== blobs.pr) {
      findings.push(`[delivery] PR113-Disposition Blobbindung fuer '${rel}' stimmt nicht`);
    }
    if (typeof entry.reason !== "string" || entry.reason.trim().length < 20) {
      findings.push(`[delivery] PR113-Disposition fuer '${rel}' braucht eine nachvollziehbare Begruendung`);
    }
  }
  for (const rel of Object.keys(PR113_PATH_DECISIONS)) {
    if (!seen.has(rel)) findings.push(`[delivery] PR113-Disposition fuer '${rel}' fehlt`);
  }

  const decisionValues = decisions.map((entry) => entry?.decision);
  const expectedSummary = {
    path_count: 7,
    salvage_paths: decisionValues.filter((value) => value === "SALVAGE_AS_KR04R_FRESH_DELETE").length,
    deferred_design_paths: decisionValues.filter((value) => value === "DEFER_TO_KR20_FRESH_DESIGN_SYSTEM_REBUILD").length,
    rejected_mock_paths: decisionValues.filter((value) => value === "REJECT_MOCK_CSS_INTEGRATION").length,
    direct_import_paths: 0,
    product_files_changed_by_kr04: 0,
  };
  for (const [key, expected] of Object.entries(expectedSummary)) {
    if (disposition.summary?.[key] !== expected) {
      findings.push(`[delivery] PR113-Disposition summary.${key} muss ${expected} sein`);
    }
  }

  const importTarget = "src/app/buchhaltung/rechnungen/RechnungenClient.tsx";
  const actualRuntimeImporters = sourceRuntimeReferences(root, "RechnungenClient", importTarget);
  if (disposition.import_scan?.target !== importTarget || disposition.import_scan?.declaration_only !== true) {
    findings.push("[delivery] PR113-Disposition Importscan ist nicht an die tote Altkomponente gebunden");
  }
  if (!sameStringSet(disposition.import_scan?.runtime_importers, actualRuntimeImporters) || actualRuntimeImporters.length !== 0) {
    findings.push(`[delivery] PR113-Disposition Runtime-Importer muessen leer sein, gefunden ${actualRuntimeImporters.join(", ") || "keine"}`);
  }

  const truth = disposition.delivery_truth ?? {};
  for (const key of ["main_delivered", "merge_performed", "production_authorized", "production_performed"]) {
    if (truth[key] !== false) findings.push(`[delivery] PR113-Disposition delivery_truth.${key} muss false sein`);
  }
}

function checkRollingConsistency(root, queue, mapping, mission, manifests, findings) {
  if (!queue || !mapping || !mission) return;
  const policy = queue.issuance_policy ?? {};
  const mapped = mapping.rolling_manifest_policy ?? {};
  const pairs = [
    ["one_materialized_contract_at_a_time", "one_materialized_contract_at_a_time"],
    ["exact_reviewed_parent_required", "exact_reviewed_parent_required"],
    ["remote_identity_required", "remote_identity_required"],
    ["candidate_chain_when_merge_unavailable", "candidate_chain_when_merge_unavailable"],
    ["candidate_is_not_main_delivery", "candidate_is_not_main_delivery"],
    ["rebase_and_reverify_after_real_main_change", "rebase_and_reverify_after_real_main_change"],
    ["halt_on_open_p0_p1_after_one_correction", "halt_on_open_p0_p1_after_one_correction"],
    ["no_periodic_build_automation", "no_periodic_build_automation"],
  ];
  for (const [queueKey, mappingKey] of pairs) {
    if (policy[queueKey] !== mapped[mappingKey]) {
      findings.push(`[delivery] Rolling-Policy-Drift: queue.${queueKey}=${String(policy[queueKey])}, mapping.${mappingKey}=${String(mapped[mappingKey])}`);
    }
  }
  if (policy.max_materialized_future_contracts !== mapped.materialized_future_contracts) {
    findings.push("[delivery] Rolling-Policy-Drift: materialized_future_contracts stimmt nicht ueberein");
  }

  const queueOrder = (queue.initial_horizon ?? []).map((entry) => entry.package_id);
  const mappingOrder = mapped.initial_pointer_order ?? [];
  if (JSON.stringify(queueOrder) !== JSON.stringify(mappingOrder)) {
    findings.push(`[delivery] Rolling-Policy-Drift: Queue-Reihenfolge ${queueOrder.join(" -> ")} != Mapping ${mappingOrder.join(" -> ")}`);
  }
  if (queue.next_contract_blueprint?.package_id !== queueOrder[0]) {
    findings.push("[delivery] next_contract_blueprint muss auf den ersten Queue-Zeiger zeigen");
  }
  const planned = queue.next_contract_blueprint?.planned_path;
  if (typeof planned === "string" && existsSync(path.join(root, planned))) {
    findings.push(`[delivery] ${planned}: Zukunftsmanifest ist vor Abschluss des Vorgaengers materialisiert`);
  }
  if ((queue.materialized_future_contracts ?? []).length !== 0) {
    findings.push("[delivery] materialized_future_contracts muss leer bleiben");
  }

  const activeId = mission.active_package;
  const active = manifests.filter(({ value }) => value?.package_id === activeId);
  if (active.length !== 1) findings.push(`[delivery] Mission active_package '${String(activeId)}' muss genau ein Manifest treffen`);
  if (active.length === 1) {
    if (active[0].rel !== ACTIVE_MANIFEST_BINDING.path || activeId !== ACTIVE_MANIFEST_BINDING.packageId) {
      findings.push("[delivery] Aktivmanifest stimmt nicht mit der expliziten Dateiname-/Paket-ID-Bindung ueberein");
    }
    if (active[0].value.schema_version !== 2) findings.push("[delivery] Mission active_package muss ein validiertes V2-Manifest sein");
    if (active[0].value.base_sha !== mission.base_sha) findings.push("[delivery] Mission base_sha stimmt nicht mit aktivem Manifest ueberein");
    if (active[0].value.branch !== mission.branch) findings.push("[delivery] Mission branch stimmt nicht mit aktivem Manifest ueberein");
    if (active[0].value.queue_parent_sha !== queue.parent_candidate?.candidate_sha) {
      findings.push("[delivery] Aktives Manifest ist nicht an den Queue-Parent gebunden");
    }
  }

  const canonicalHandoff = queue.effective_base_handoff;
  const expectedHandoff = handoffSignature(canonicalHandoff);
  const handoffCopies = [
    ["manifest", active[0]?.value?.base_handoff],
    ["queue", queue.effective_base_handoff],
    ["mission", mission.execution_program_20260928?.effective_base_handoff],
    ["mapping", mapping.workflow_facts_at_contract_parent?.base_handoff],
  ];
  for (const [label, value] of handoffCopies) {
    if (handoffSignature(value) !== expectedHandoff) {
      findings.push(`[delivery] Effective-Base-Handoff-Drift: ${label} stimmt nicht mit der geprueften Handoff-Kette ueberein`);
    }
  }
  if (
    queue.parent_candidate?.candidate_sha !== REVIEWED_QUEUE_PARENT_SHA ||
    canonicalHandoff?.queue_parent_sha !== REVIEWED_QUEUE_PARENT_SHA
  ) {
    findings.push("[delivery] Queue-Parent stimmt nicht mit dem Ausgang der Handoff-Kette ueberein");
  }

  const entries = Array.isArray(canonicalHandoff?.entries) ? canonicalHandoff.entries : [];
  let expectedParent = canonicalHandoff?.queue_parent_sha;
  const seenPrs = new Set();
  const seenCandidates = new Set();
  const seenMerges = new Set();
  for (const [index, entry] of entries.entries()) {
    const criticalShapeIsValid =
      Number.isInteger(entry?.pr) &&
      entry.pr > 0 &&
      SHA_PATTERN.test(entry?.parent_sha ?? "") &&
      SHA_PATTERN.test(entry?.candidate_sha ?? "") &&
      SHA_PATTERN.test(entry?.merge_sha ?? "") &&
      SHA_PATTERN.test(entry?.tree_sha ?? "") &&
      entry?.scope === "PROTECTED_CI_GOVERNANCE_ONLY" &&
      entry?.review_result === "PASS_NO_OPEN_P0_P1_P2_P3" &&
      Number.isInteger(entry?.post_main_agentur_gate_run) &&
      entry.post_main_agentur_gate_run > 0 &&
      Number.isInteger(entry?.post_main_quality_run) &&
      entry.post_main_quality_run > 0 &&
      entry?.vercel_status === "SUCCESS";
    if (!criticalShapeIsValid) {
      findings.push(`[delivery] Handoff-Eintrag ${index + 1} hat keine fail-closed PASS-Struktur`);
    }
    if (entry?.parent_sha !== expectedParent) {
      findings.push(`[delivery] Handoff-Kette ist vor Eintrag ${index + 1} unterbrochen`);
    }
    if (seenPrs.has(entry?.pr) || seenCandidates.has(entry?.candidate_sha) || seenMerges.has(entry?.merge_sha)) {
      findings.push(`[delivery] Handoff-Eintrag ${index + 1} verwendet PR oder SHA doppelt`);
    }
    seenPrs.add(entry?.pr);
    seenCandidates.add(entry?.candidate_sha);
    seenMerges.add(entry?.merge_sha);
    expectedParent = entry?.merge_sha;
  }

  const lastEntry = entries.at(-1);
  if (
    entries.length === 0 ||
    lastEntry?.merge_sha !== canonicalHandoff?.effective_base_sha ||
    lastEntry?.tree_sha !== canonicalHandoff?.effective_base_tree_sha
  ) {
    findings.push("[delivery] Letzter Handoff-Eintrag ist nicht die deklarierte effektive Base");
  }
  checkTrustedHandoff(canonicalHandoff, findings);

  if (active[0]?.value?.base_sha !== canonicalHandoff?.effective_base_sha) {
    findings.push("[delivery] Manifest base_sha stimmt nicht mit der effektiven Base ueberein");
  }
  if (active[0]?.value?.origin_main_sha !== canonicalHandoff?.effective_base_sha) {
    findings.push("[delivery] Manifest origin_main_sha stimmt nicht mit der effektiven Base ueberein");
  }
  if (mission.base_sha !== canonicalHandoff?.effective_base_sha) {
    findings.push("[delivery] Mission base_sha stimmt nicht mit der effektiven Base ueberein");
  }
  if (mission.execution_program_20260928?.origin_main_reference !== canonicalHandoff?.effective_base_sha) {
    findings.push("[delivery] Mission origin_main_reference stimmt nicht mit der effektiven Base ueberein");
  }
  if (mission.execution_program_20260928?.current_package_parent !== canonicalHandoff?.effective_base_sha) {
    findings.push("[delivery] Mission current_package_parent stimmt nicht mit der effektiven Base ueberein");
  }
  if (mapping.workflow_facts_at_contract_parent?.parent_sha !== canonicalHandoff?.effective_base_sha) {
    findings.push("[delivery] Gate-Mapping parent_sha stimmt nicht mit der effektiven Base ueberein");
  }
  if (mapping.workflow_facts_at_contract_parent?.queue_parent_sha !== canonicalHandoff?.queue_parent_sha) {
    findings.push("[delivery] Gate-Mapping queue_parent_sha stimmt nicht mit dem Queue-Parent ueberein");
  }
}

export function checkDeliveryContracts(root = process.cwd()) {
  root = path.resolve(root);
  const findings = [];
  const manifestSchema = readJson(root, DELIVERY_PATHS.manifestSchema, findings);
  const queueSchema = readJson(root, DELIVERY_PATHS.queueSchema, findings);
  const receiptSchema = readJson(root, DELIVERY_PATHS.operatingReceiptSchema, findings);
  const validateManifest = compileSchema(manifestSchema, DELIVERY_PATHS.manifestSchema, findings);
  const validateQueue = compileSchema(queueSchema, DELIVERY_PATHS.queueSchema, findings);
  const validateReceipt = compileSchema(receiptSchema, DELIVERY_PATHS.operatingReceiptSchema, findings);

  const manifests = manifestFiles(root).map((rel) => ({ rel, value: readYaml(root, rel, findings) }));
  for (const { rel, value } of manifests) {
    if (value?.schema_version === 2) {
      validateWith(validateManifest, value, rel, findings);
      resolveEvidenceRefs(value, rel, findings);
    } else if (value?.schema_version !== 1) {
      findings.push(`[delivery] ${rel}: unbekannte schema_version '${String(value?.schema_version)}'`);
    }
  }
  checkLegacyBindings(root, manifests, findings);
  checkLegacyV1Bindings(root, manifests, findings);

  const queue = readJson(root, DELIVERY_PATHS.queue, findings);
  const mapping = readYaml(root, DELIVERY_PATHS.mapping, findings);
  const mission = readYaml(root, DELIVERY_PATHS.mission, findings);
  const receipt = readJson(root, DELIVERY_PATHS.operatingReceipt, findings);
  const pr113Disposition = readJson(root, DELIVERY_PATHS.pr113Disposition, findings);
  validateWith(validateQueue, queue, DELIVERY_PATHS.queue, findings);
  validateWith(validateReceipt, receipt, DELIVERY_PATHS.operatingReceipt, findings);
  checkRollingConsistency(root, queue, mapping, mission, manifests, findings);
  checkOperatingTruth(receipt, mapping, findings);
  checkPr113Disposition(root, pr113Disposition, findings);

  return { ok: findings.length === 0, findings: findings.sort() };
}

function fixtureFrom(root) {
  const target = mkdtempSync(path.join(tmpdir(), "kreile-delivery-selftest-"));
  cpSync(path.join(root, "docs/delivery"), path.join(target, "docs/delivery"), { recursive: true });
  cpSync(path.join(root, "missions"), path.join(target, "missions"), { recursive: true });
  return target;
}

function mutateYaml(abs, mutate) {
  const value = yaml.load(readFileSync(abs, "utf8"));
  mutate(value);
  writeFileSync(abs, yaml.dump(value, { lineWidth: 120, noRefs: true }));
}

export function runSelftest(root = process.cwd()) {
  const cases = [];
  const runCase = (name, mutate, expected) => {
    const fixture = fixtureFrom(root);
    try {
      mutate(fixture);
      const result = checkDeliveryContracts(fixture);
      if (result.ok || !result.findings.some((entry) => entry.includes(expected))) {
        throw new Error(`${name}: erwarteter Befund '${expected}' fehlt; erhalten ${result.findings.join(" | ")}`);
      }
      cases.push(name);
    } finally {
      rmSync(fixture, { recursive: true, force: true });
    }
  };

  const baseline = checkDeliveryContracts(root);
  if (!baseline.ok) throw new Error(`baseline: ${baseline.findings.join(" | ")}`);
  cases.push("baseline");

  runCase("legacy-id-clone", (fixture) => {
    cpSync(
      path.join(fixture, LEGACY_MANIFEST_BINDINGS["KR-00E-DELIVERY-CONTRACT"].path),
      path.join(fixture, DELIVERY_PATHS.manifestDir, "FAKE-LEGACY.yaml"),
    );
  }, "Legacy-Ausnahme ist nur");

  runCase("legacy-v1-clone", (fixture) => {
    cpSync(
      path.join(fixture, "docs/delivery/packages/KR-00B0-GOVERNANCE-BOOTSTRAP.yaml"),
      path.join(fixture, DELIVERY_PATHS.manifestDir, "FAKE-V1.yaml"),
    );
  }, "ungebundenes V1-Manifest");

  runCase("legacy-v1-hash", (fixture) => {
    const abs = path.join(fixture, "docs/delivery/packages/KR-00B-TRUTH-SYNC.yaml");
    writeFileSync(abs, `${readFileSync(abs, "utf8")}\n# drift\n`);
  }, "V1-Legacy-Hash");

  runCase("unknown-evidence", (fixture) => {
    mutateYaml(path.join(fixture, ACTIVE_MANIFEST_BINDING.path), (value) => {
      value.register_gate_evidence.FUNCTIONAL_SLICE_PASS.evidence_ref = "acceptance:DOES-NOT-EXIST";
    });
  }, "loest nicht im eigenen Manifest auf");

  runCase("pr113-path-disposition", (fixture) => {
    const abs = path.join(fixture, DELIVERY_PATHS.pr113Disposition);
    const value = JSON.parse(readFileSync(abs, "utf8"));
    value.path_decisions[0].decision = "UNSAFE_DIRECT_IMPORT";
    writeFileSync(abs, `${JSON.stringify(value, null, 2)}\n`);
  }, "Disposition fuer");

  runCase("queue-order", (fixture) => {
    const abs = path.join(fixture, DELIVERY_PATHS.queue);
    const value = JSON.parse(readFileSync(abs, "utf8"));
    [value.initial_horizon[0], value.initial_horizon[1]] = [value.initial_horizon[1], value.initial_horizon[0]];
    writeFileSync(abs, `${JSON.stringify(value, null, 2)}\n`);
  }, "should be equal to constant");

  runCase("mapping-drift", (fixture) => {
    mutateYaml(path.join(fixture, DELIVERY_PATHS.mapping), (value) => {
      value.rolling_manifest_policy.candidate_is_not_main_delivery = false;
    });
  }, "Rolling-Policy-Drift");

  runCase("effective-base-handoff-drift", (fixture) => {
    const abs = path.join(fixture, DELIVERY_PATHS.queue);
    const value = JSON.parse(readFileSync(abs, "utf8"));
    value.effective_base_handoff.effective_base_sha = value.effective_base_handoff.queue_parent_sha;
    writeFileSync(abs, `${JSON.stringify(value, null, 2)}\n`);
  }, "Effective-Base-Handoff-Drift");

  runCase("effective-base-handoff-chain-break", (fixture) => {
    const abs = path.join(fixture, DELIVERY_PATHS.queue);
    const value = JSON.parse(readFileSync(abs, "utf8"));
    value.effective_base_handoff.entries[1].parent_sha = value.effective_base_handoff.queue_parent_sha;
    writeFileSync(abs, `${JSON.stringify(value, null, 2)}\n`);
  }, "Handoff-Kette ist vor Eintrag 2 unterbrochen");

  runCase("receipt-bypass", (fixture) => {
    const abs = path.join(fixture, DELIVERY_PATHS.operatingReceipt);
    const value = JSON.parse(readFileSync(abs, "utf8"));
    value.active_ruleset.bypass_actors.push("admin");
    writeFileSync(abs, `${JSON.stringify(value, null, 2)}\n`);
  }, "active_ruleset.bypass_actors muss leer sein");

  runCase("receipt-schema-self-weakening", (fixture) => {
    const schemaAbs = path.join(fixture, DELIVERY_PATHS.operatingReceiptSchema);
    const schema = JSON.parse(readFileSync(schemaAbs, "utf8"));
    schema.properties.delivery_truth.properties.main_delivered.const = true;
    writeFileSync(schemaAbs, `${JSON.stringify(schema, null, 2)}\n`);
    const receiptAbs = path.join(fixture, DELIVERY_PATHS.operatingReceipt);
    const receipt = JSON.parse(readFileSync(receiptAbs, "utf8"));
    receipt.delivery_truth.main_delivered = true;
    writeFileSync(receiptAbs, `${JSON.stringify(receipt, null, 2)}\n`);
  }, "delivery_truth.main_delivered muss false sein");

  runCase("required-check-mapping-drift", (fixture) => {
    mutateYaml(path.join(fixture, DELIVERY_PATHS.mapping), (value) => {
      value.required_check_truth.actual_required_names = ["quality"];
    });
  }, "actual_required_names stimmt nicht");

  runCase("resource-derived-drift", (fixture) => {
    const schemaAbs = path.join(fixture, DELIVERY_PATHS.operatingReceiptSchema);
    const schema = JSON.parse(readFileSync(schemaAbs, "utf8"));
    schema.properties.resource_calibration.properties.observed_min_available_ram_mb.const = 9999;
    writeFileSync(schemaAbs, `${JSON.stringify(schema, null, 2)}\n`);
    const receiptAbs = path.join(fixture, DELIVERY_PATHS.operatingReceipt);
    const receipt = JSON.parse(readFileSync(receiptAbs, "utf8"));
    receipt.resource_calibration.observed_min_available_ram_mb = 9999;
    writeFileSync(receiptAbs, `${JSON.stringify(receipt, null, 2)}\n`);
  }, "observed_min_available_ram_mb ist nicht aus samples abgeleitet");

  return cases;
}

function parseArgs(argv) {
  const options = { root: process.cwd(), selftest: false };
  for (let index = 0; index < argv.length; index++) {
    if (argv[index] === "--root") options.root = path.resolve(argv[++index]);
    else if (argv[index] === "--selftest") options.selftest = true;
    else throw new Error(`Unbekanntes Argument: ${argv[index]}`);
  }
  return options;
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  const options = parseArgs(process.argv.slice(2));
  if (options.selftest) {
    const cases = runSelftest(options.root);
    console.log(`delivery-contracts selftest: PASS (${cases.length}/${cases.length})`);
  } else {
    const result = checkDeliveryContracts(options.root);
    if (result.ok) {
      console.log("delivery-contracts: PASS (Manifeste, Evidenzzeiger, Legacy-Bindung, Alt-PR-Disposition, Queue, Mapping, Betriebsreceipt)");
    } else {
      console.error(`delivery-contracts: ${result.findings.length} Verstoss/Verstoesse`);
      for (const finding of result.findings) console.error(`  ${finding}`);
      process.exitCode = 1;
    }
  }
}
