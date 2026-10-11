import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import process from "node:process";
import { pathToFileURL } from "node:url";

const PLAN_PATH = "docs/delivery/KREILE_LIVE_PLAN_V1.json";
const MISSION_PATH = "missions/F1_ORDER_TO_CASH_PILOT_001.yml";
const ACTIVATION_BRANCH = "codex/kreile-live-plan-v1-activation";
const CLOSE_BRANCH = "codex/kreile-live-close";
const AMENDMENT_PATTERN = /^docs\/delivery\/amendments\/KR-AMEND-\d{4}\.json$/;
const ACTIVATION_ALLOWLIST = Object.freeze([
  ".claude/**",
  ".gitattributes",
  ".github/workflows/eslint-ratchet.yml",
  ".github/workflows/quality.yml",
  "eslint.config.mjs",
  "AGENTS.md",
  "CLAUDE.md",
  "README.md",
  "*.md",
  "package.json",
  "quality/eslint-baseline.json",
  "quality/authoritative-sources.json",
  "scripts/quality/check-authoritative-sources.mjs",
  "scripts/quality/check-delivery-contracts.mjs",
  "scripts/quality/check-live-package-scope.mjs",
  "scripts/quality/eslint-ratchet-core.ts",
  "scripts/quality/select-live-regression-specs.mjs",
  "scripts/quality/check-module-gates.mjs",
  "scripts/quality/resolve-delivery-trust-anchor.mjs",
  "scripts/quality/check-f0-independent-review-package.mjs",
  "scripts/show-active-live-package.mjs",
  "scripts/advance-live-package.mjs",
  "scripts/close-live-line.mjs",
  "src/test/delivery_contracts.test.ts",
  "src/test/eslint_ratchet_reference_contract.test.ts",
  "src/test/authority_gate.test.ts",
  "src/test/live_package_scope.test.ts",
  "src/test/s1_module_gates.test.ts",
  "missions/**",
  "docs/delivery/**",
  "docs/project/DOCUMENT_AUTHORITY.md",
  "docs/project/MASTERPLAN.md",
  "docs/project/CURRENT_STATE.md",
  "docs/project/linie/00_ABC_INDEX.md",
  "docs/project/linie/00_BIBEL_INDEX.md",
  "docs/project/linie/00_JETZT_UND_LEITPLANKEN.md",
  "docs/project/linie/00_UI_REFERENZEN_PFADE.md",
  "docs/project/linie/KREILE_LINIE_ENTSCHEIDUNGSREGISTER_2026-08-28.md",
  "docs/project/linie/ui/CURRENT_DESIGN_REFERENCE.json",
  "docs/project/linie/ui/designsystem_v1_1/**",
  "docs/project/history/controls/2026-10-11/**",
  "docs/project/history/legacy-sources/2026-10-11/**",
  "docs/evidence/live-line/activation/**",
  "docs/*.md",
  "docs/*.sql",
  "docs/module/**",
  "docs/project/*.md",
  "docs/project/*.json",
  "docs/project/linie/*.md",
  "docs/project/linie/ui/00_UI_REFERENZ_KANONISCH.md",
]);
const POST_LIVE_CONTROL_PATTERNS = Object.freeze([
  ".claude/**",
  ".github/workflows/**",
  ".gitattributes",
  "AGENTS.md",
  "CLAUDE.md",
  "package.json",
  "quality/authoritative-sources.json",
  "docs/delivery/**",
  "docs/evidence/live-line/**",
  "docs/project/CURRENT_STATE.md",
  "docs/project/DOCUMENT_AUTHORITY.md",
  "docs/project/MASTERPLAN.md",
  "docs/project/linie/00_UI_REFERENZEN_PFADE.md",
  "docs/project/linie/ui/CURRENT_DESIGN_REFERENCE.json",
  "docs/project/linie/ui/designsystem_v1_1/**",
  "missions/**",
  "e2e/kr-l*.spec.ts",
  "scripts/advance-live-package.mjs",
  "scripts/close-live-line.mjs",
  "scripts/show-active-live-package.mjs",
  "scripts/quality/check-authoritative-sources.mjs",
  "scripts/quality/check-delivery-contracts.mjs",
  "scripts/quality/check-live-package-scope.mjs",
  "scripts/quality/select-live-regression-specs.mjs",
]);

const posix = (value) => value.replaceAll("\\", "/");
const isSha = (value) => /^[0-9a-f]{40}$/i.test(value ?? "");
const hash = (value) => createHash("sha256").update(value).digest("hex").toUpperCase();

function globRegex(pattern) {
  let source = posix(pattern).replace(/[.+^${}()|[\]\\]/g, "\\$&");
  source = source.replaceAll("**", "__DOUBLE_STAR__");
  source = source.replaceAll("*", "[^/]*");
  source = source.replaceAll("__DOUBLE_STAR__", ".*");
  return new RegExp(`^${source}$`);
}

function covered(rel, patterns) {
  return patterns.some((pattern) => globRegex(pattern).test(posix(rel)));
}

function git(root, args) {
  return execFileSync("git", ["-C", root, ...args], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  }).trim();
}

function gitFile(root, revision, rel) {
  return git(root, ["show", `${revision}:${rel}`]);
}

function parseMission(text) {
  const values = {};
  for (const line of text.split(/\r?\n/)) {
    const match = line.match(/^([a-z][a-z0-9_]*):\s*(.*?)\s*$/);
    if (match) values[match[1]] = match[2];
  }
  return values;
}

function parseFacts(text) {
  const values = {};
  for (const line of text.split(/\r?\n/)) {
    const match = line.match(/^([A-Z][A-Z0-9_]*?)=(.*)$/);
    if (match) values[match[1]] = match[2].trim();
  }
  return values;
}

function changedFiles(root, base, head) {
  const output = git(root, ["diff", "--name-only", "--diff-filter=ACMRD", base, head]);
  return output ? output.split(/\r?\n/).map(posix) : [];
}

function commitFiles(root, commit) {
  const output = git(root, ["diff-tree", "--no-commit-id", "--name-only", "-r", "--root", commit]);
  return output ? output.split(/\r?\n/).map(posix) : [];
}

function commitList(root, base, head) {
  const output = git(root, ["rev-list", "--reverse", `${base}..${head}`]);
  return output ? output.split(/\r?\n/) : [];
}

function resolved(root, revision) {
  return git(root, ["rev-parse", revision]);
}

function checkActivation(files, baseSha, plan) {
  const errors = [];
  if (baseSha !== plan.productRepository.initialOriginMain) {
    errors.push(`ACTIVATION_BASE_MOVED:${baseSha}:${plan.productRepository.initialOriginMain}`);
  }
  for (const rel of files) if (!covered(rel, ACTIVATION_ALLOWLIST)) errors.push(`ACTIVATION_SCOPE:${rel}`);
  if (files.some((rel) => rel.startsWith("src/") && !rel.startsWith("src/test/"))) {
    errors.push("ACTIVATION_PRODUCT_CODE_FORBIDDEN");
  }
  return errors;
}

function checkAmendment(root, base, commits, files, plan, mission, item) {
  const errors = [];
  const amendmentFiles = files.filter((rel) => AMENDMENT_PATTERN.test(rel));
  if (!files.includes(PLAN_PATH)) {
    if (amendmentFiles.length > 0) errors.push("AMENDMENT_PLAN_MISSING");
    return { errors, patterns: amendmentFiles, commit: null };
  }
  if (amendmentFiles.length !== 1) {
    errors.push(`AMENDMENT_RECEIPT_COUNT:${amendmentFiles.length}`);
    return { errors, patterns: [PLAN_PATH, "docs/delivery/amendments/*.json"], commit: null };
  }
  let baseRaw;
  let basePlan;
  try {
    baseRaw = gitFile(root, base, PLAN_PATH);
    basePlan = JSON.parse(baseRaw);
  } catch {
    errors.push("AMENDMENT_BASE_PLAN_UNREADABLE");
    return { errors, patterns: [PLAN_PATH, amendmentFiles[0]], commit: null };
  }
  const before = basePlan.packages?.find((entry) => entry.id === item.id);
  const after = plan.packages?.find((entry) => entry.id === item.id);
  if (!before || !after) errors.push("AMENDMENT_ACTIVE_PACKAGE_MISSING");
  const allowed = new Set(["kind", "editablePaths", "maxEditablePaths", "scopeOut", "acceptance", "externalPrerequisite"]);
  const beforeStable = JSON.parse(JSON.stringify(basePlan));
  const afterStable = JSON.parse(JSON.stringify(plan));
  const beforeIndex = beforeStable.packages.findIndex((entry) => entry.id === item.id);
  const afterIndex = afterStable.packages.findIndex((entry) => entry.id === item.id);
  let changedFields = [];
  if (beforeIndex !== afterIndex || beforeIndex < 0) {
    errors.push("AMENDMENT_TOPOLOGY");
  } else {
    changedFields = Object.keys({ ...before, ...after }).filter(
      (key) => JSON.stringify(before[key]) !== JSON.stringify(after[key]),
    );
    for (const key of changedFields) if (!allowed.has(key)) errors.push(`AMENDMENT_FIELD_FORBIDDEN:${key}`);
    if (changedFields.includes("kind") && !(before.kind === "GATE" && after.kind === "BUILD")) {
      errors.push(`AMENDMENT_KIND_TRANSITION:${before.kind}->${after.kind}`);
    }
    beforeStable.packages[beforeIndex] = afterStable.packages[afterIndex];
    if (JSON.stringify(beforeStable) !== JSON.stringify(afterStable)) errors.push("AMENDMENT_OUTSIDE_ACTIVE_PACKAGE");
    let receipt;
    try {
      receipt = JSON.parse(readFileSync(path.join(root, amendmentFiles[0]), "utf8"));
    } catch {
      errors.push("AMENDMENT_RECEIPT_INVALID_JSON");
    }
    if (receipt) {
      const expectedKeys = ["activePackage", "authorizedBy", "basePlanSha256", "changedFields", "reason", "requestedAt"];
      if (JSON.stringify(Object.keys(receipt).sort()) !== JSON.stringify(expectedKeys.sort())) errors.push("AMENDMENT_RECEIPT_SCHEMA");
      if (receipt.activePackage !== item.id) errors.push("AMENDMENT_PACKAGE");
      if (receipt.basePlanSha256 !== hash(baseRaw)) errors.push("AMENDMENT_BASE_HASH");
      if (receipt.authorizedBy !== "OWNER_EXPLICIT_CURRENT_TASK") errors.push("AMENDMENT_AUTHORITY");
      if (typeof receipt.reason !== "string" || receipt.reason.trim().length < 20) errors.push("AMENDMENT_REASON");
      if (JSON.stringify([...(receipt.changedFields ?? [])].sort()) !== JSON.stringify(changedFields.sort())) {
        errors.push("AMENDMENT_CHANGED_FIELDS");
      }
      if (Number.isNaN(Date.parse(receipt.requestedAt ?? ""))) errors.push("AMENDMENT_TIMESTAMP");
    }
  }

  const amendmentCommits = commits.filter((commit) => {
    const paths = commitFiles(root, commit);
    return paths.includes(PLAN_PATH) || paths.includes(amendmentFiles[0]);
  });
  const amendmentCommit = amendmentCommits.length === 1 ? amendmentCommits[0] : null;
  if (!amendmentCommit) {
    errors.push(`AMENDMENT_COMMIT_COUNT:${amendmentCommits.length}`);
  } else {
    const amendmentPaths = commitFiles(root, amendmentCommit);
    for (const required of [PLAN_PATH, amendmentFiles[0], MISSION_PATH, item.focusedSpec, `docs/evidence/live-line/${item.id.toLowerCase()}/PREFLIGHT.md`]) {
      if (!amendmentPaths.includes(required)) errors.push(`AMENDMENT_COMMIT_FILE_MISSING:${required}`);
    }
  }

  const amendmentIndex = amendmentCommit ? commits.indexOf(amendmentCommit) : commits.length;
  const recoveryEvidence = commits.slice(0, amendmentIndex).some((commit) => {
    try {
      const prior = parseMission(gitFile(root, commit, MISSION_PATH));
      return prior.phase === "FAIL_FINAL"
        || (prior.phase === "BLOCKED_PRODUCT_DECISION" && prior.resume_phase === "PREFLIGHT");
    } catch {
      return false;
    }
  });
  if (!recoveryEvidence) errors.push("AMENDMENT_RECOVERY_EVIDENCE_MISSING");
  if (amendmentCommit) {
    try {
      const atAmendment = parseMission(gitFile(root, amendmentCommit, MISSION_PATH));
      const expectedWriterCount = after?.kind === "BUILD" ? "1" : "0";
      const expectedScope = after?.kind === "BUILD" ? "ACTIVE_PACKAGE_EDITABLE_PATHS_ONLY" : "NO_WRITER_GATE";
      if (atAmendment.phase !== "PREFLIGHT" || atAmendment.attempt !== "1"
          || atAmendment.candidate_sha !== "none" || atAmendment.resume_phase !== "none"
          || atAmendment.block_reason !== "none" || atAmendment.writer_count !== expectedWriterCount
          || atAmendment.writer_scope_source !== expectedScope) {
        errors.push("AMENDMENT_MISSION_NOT_RESET_TO_PREFLIGHT");
      }
    } catch {
      errors.push("AMENDMENT_MISSION_UNREADABLE");
    }
  }
  if (mission.attempt !== "1") errors.push("AMENDMENT_ATTEMPT_NOT_ONE");
  return { errors, patterns: [PLAN_PATH, amendmentFiles[0]], commit: amendmentCommit };
}

function validatePreflight(root, item, evidenceRoot, baseSha, required, errors) {
  if (!required) return;
  const rel = `${evidenceRoot}/PREFLIGHT.md`;
  if (!existsSync(path.join(root, rel))) {
    errors.push(`PACKAGE_PREFLIGHT_RECEIPT_MISSING:${item.id}`);
    return;
  }
  const facts = parseFacts(readFileSync(path.join(root, rel), "utf8"));
  const marker = item.kind === "BUILD" ? "ASSERTIONS_RED" : "GATE_BASELINE";
  if (facts.PACKAGE !== item.id || facts.BASE_SHA !== baseSha || facts[marker] !== "PASS") {
    errors.push(`PACKAGE_PREFLIGHT_RECEIPT_INVALID:${item.id}`);
  }
  if (item.kind === "BUILD") {
    if (!facts.RED_RUN_ID || facts.RED_EXIT_NONZERO !== "PASS" || !facts.RED_FAILURE_ASSERTION) {
      errors.push(`PACKAGE_RED_EVIDENCE_INVALID:${item.id}`);
    }
  }
}

function validateReview(root, item, evidenceRoot, candidate, errors) {
  const receiptRel = `${evidenceRoot}/REVIEW.md`;
  const outputRel = `${evidenceRoot}/REVIEW_OUTPUT.md`;
  if (!existsSync(path.join(root, receiptRel)) || !existsSync(path.join(root, outputRel))) {
    errors.push(`PACKAGE_REVIEW_EVIDENCE_MISSING:${item.id}`);
    return;
  }
  const output = readFileSync(path.join(root, outputRel));
  const facts = parseFacts(readFileSync(path.join(root, receiptRel), "utf8"));
  const required = {
    PACKAGE: item.id,
    CANDIDATE_SHA: candidate,
    REVIEW: "PASS",
    REVIEWER_INDEPENDENT: "PASS",
    GATES: "PASS",
    REVIEW_EXIT: "0",
    REVIEW_OUTPUT_SHA256: hash(output),
  };
  for (const [key, value] of Object.entries(required)) if (facts[key] !== value) errors.push(`PACKAGE_REVIEW_RECEIPT_INVALID:${item.id}:${key}`);
  if (!/^[A-Za-z0-9._:-]{8,}$/.test(facts.REVIEW_RUN_ID ?? "")) errors.push(`PACKAGE_REVIEW_RUN_ID:${item.id}`);
  if (!facts.REVIEW_MODEL) errors.push(`PACKAGE_REVIEW_MODEL:${item.id}`);
  if (Number.isNaN(Date.parse(facts.REVIEW_STARTED_AT ?? "")) || Number.isNaN(Date.parse(facts.REVIEW_ENDED_AT ?? ""))) {
    errors.push(`PACKAGE_REVIEW_TIMESTAMPS:${item.id}`);
  }
}

function validateOwnerView(root, item, evidenceRoot, candidate, errors) {
  const receiptRel = `${evidenceRoot}/OWNER_VIEW.md`;
  if (!existsSync(path.join(root, receiptRel))) {
    errors.push(`PACKAGE_OWNER_VIEW_RECEIPT_MISSING:${item.id}`);
    return;
  }
  const facts = parseFacts(readFileSync(path.join(root, receiptRel), "utf8"));
  if (facts.PACKAGE !== item.id || facts.CANDIDATE_SHA !== candidate || facts.OWNER_VISUAL !== "PASS"
      || !/^https:\/\//.test(facts.PREVIEW_URL ?? "")) errors.push(`PACKAGE_OWNER_VIEW_RECEIPT_INVALID:${item.id}`);
  for (const viewport of ["1914x917", "1220x880", "390x844"]) {
    const rel = facts[`SCREENSHOT_${viewport}`];
    const full = rel ? path.join(root, rel) : "";
    if (!rel || !posix(rel).startsWith(`${evidenceRoot}/`) || !existsSync(full) || statSync(full).size === 0) {
      errors.push(`PACKAGE_OWNER_SCREENSHOT:${item.id}:${viewport}`);
    }
  }
}

function checkPackage(root, branch, base, baseSha, head, files, plan, mission) {
  const errors = [];
  const match = branch.match(/^codex\/kreile-(kr-l\d{2})$/);
  if (!match) return [`PACKAGE_BRANCH_INVALID:${branch}`];
  const packageId = match[1].toUpperCase();
  const item = plan.packages.find((entry) => entry.id === packageId);
  if (!item) return [`PACKAGE_BRANCH_UNKNOWN:${packageId}`];
  if (mission.active_package !== packageId) errors.push(`PACKAGE_MISSION_MISMATCH:${mission.active_package}:${packageId}`);
  if (mission.branch !== branch) errors.push(`PACKAGE_MISSION_BRANCH:${mission.branch}`);

  const evidencePattern = plan.operatingRules.evidenceReceiptPattern.replace("{packageIdLower}", packageId.toLowerCase());
  const evidenceRoot = evidencePattern.replace(/\/\*\*$/, "");
  const preflightReceipt = `${evidenceRoot}/PREFLIGHT.md`;
  const controlPatterns = [MISSION_PATH, "docs/project/CURRENT_STATE.md", item.focusedSpec, evidencePattern];
  const productPatterns = item.editablePaths;
  const commits = commitList(root, base, head);
  const amendment = checkAmendment(root, base, commits, files, plan, mission, item);
  errors.push(...amendment.errors);
  const allPatterns = [...controlPatterns, ...productPatterns, ...amendment.patterns];
  for (const rel of files) if (!covered(rel, allPatterns)) errors.push(`PACKAGE_SCOPE:${packageId}:${rel}`);

  if (commits.length === 0) errors.push(`PACKAGE_NO_COMMITS:${packageId}`);
  if (commits.length > 0) {
    const firstFiles = commitFiles(root, commits[0]);
    if (!firstFiles.includes(item.focusedSpec)) errors.push(`PACKAGE_FIRST_COMMIT_SPEC_MISSING:${packageId}`);
    if (!firstFiles.includes(MISSION_PATH)) errors.push(`PACKAGE_FIRST_COMMIT_MISSION_MISSING:${packageId}`);
    if (!firstFiles.includes(preflightReceipt)) errors.push(`PACKAGE_FIRST_COMMIT_PREFLIGHT_MISSING:${packageId}`);
    if (firstFiles.some((rel) => covered(rel, productPatterns))) errors.push(`PACKAGE_FIRST_COMMIT_PRODUCT_MIX:${packageId}`);
    const firstCommitPatterns = [MISSION_PATH, "docs/project/CURRENT_STATE.md", item.focusedSpec, preflightReceipt];
    if (firstFiles.some((rel) => !covered(rel, firstCommitPatterns))) errors.push(`PACKAGE_FIRST_COMMIT_CONTROL_SCOPE:${packageId}`);
    for (const [index, commit] of commits.entries()) {
      const paths = commitFiles(root, commit);
      if (index > 0 && paths.includes(item.focusedSpec) && commit !== amendment.commit) {
        errors.push(`PACKAGE_SPEC_CHANGED_AFTER_PREFLIGHT:${packageId}:${commit}`);
      }
      const hasControl = paths.some((rel) => covered(rel, [...controlPatterns, ...amendment.patterns]));
      const hasProduct = paths.some((rel) => covered(rel, productPatterns));
      if (hasControl && hasProduct) errors.push(`PACKAGE_COMMIT_ROLE_MIX:${packageId}:${commit}`);
    }
  }

  try {
    git(root, ["cat-file", "-e", `${base}:${item.focusedSpec}`]);
    errors.push(`PACKAGE_SPEC_PREEXISTED:${packageId}`);
  } catch {
    // Expected: every package introduces its own immutable focused spec.
  }
  validatePreflight(root, item, evidenceRoot, baseSha, !["TODO", "PREFLIGHT"].includes(mission.phase), errors);

  const candidatePhases = new Set(["REVIEW", "OWNER_VIEW", "CORRECTING", "READY_TO_MERGE", "DONE", "FAIL_FINAL"]);
  const resumeCandidate = ["REVIEW", "OWNER_VIEW", "CORRECTING"].includes(mission.resume_phase);
  const candidateRequired = candidatePhases.has(mission.phase)
    || (["BLOCKED_EXTERNAL", "BLOCKED_PRODUCT_DECISION"].includes(mission.phase) && resumeCandidate);
  const productCommits = commits.filter((commit) => commitFiles(root, commit).some((rel) => covered(rel, productPatterns)));
  if (item.kind === "BUILD" && candidateRequired && productCommits.length === 0) errors.push(`PACKAGE_PRODUCT_DELTA_MISSING:${packageId}`);
  if (item.kind === "GATE" && productCommits.length > 0) errors.push(`PACKAGE_GATE_PRODUCT_DELTA:${packageId}`);

  if (candidateRequired) {
    if (item.kind === "BUILD") {
      if (!isSha(mission.candidate_sha) || !commits.includes(mission.candidate_sha)) {
        errors.push(`PACKAGE_CANDIDATE_NOT_IN_RANGE:${packageId}:${mission.candidate_sha}`);
      } else {
        const lastProductCommit = productCommits.at(-1);
        if (lastProductCommit !== mission.candidate_sha) errors.push(`PACKAGE_CANDIDATE_NOT_LAST_PRODUCT_COMMIT:${packageId}`);
        const candidateIndex = commits.indexOf(mission.candidate_sha);
        for (const commit of commits.slice(candidateIndex + 1)) {
          if (commitFiles(root, commit).some((rel) => covered(rel, productPatterns))) {
            errors.push(`PACKAGE_PRODUCT_AFTER_CANDIDATE:${packageId}:${commit}`);
          }
        }
      }
    } else if (mission.candidate_sha !== baseSha) {
      errors.push(`PACKAGE_GATE_CANDIDATE_NOT_BASE:${packageId}:${mission.candidate_sha}:${baseSha}`);
    }
  } else if (mission.candidate_sha !== "none") {
    errors.push(`PACKAGE_EARLY_CANDIDATE_SHA:${packageId}:${mission.phase}`);
  }
  if (["OWNER_VIEW", "READY_TO_MERGE", "DONE"].includes(mission.phase)) {
    validateReview(root, item, evidenceRoot, mission.candidate_sha, errors);
  }
  if (["READY_TO_MERGE", "DONE"].includes(mission.phase) && item.ownerView) {
    validateOwnerView(root, item, evidenceRoot, mission.candidate_sha, errors);
  }
  return errors;
}

function checkClosure(root, baseSha, files, mission) {
  const errors = [];
  const evidence = "docs/evidence/live-line/kr-l20/LIVE_COMPLETE.md";
  const allowed = new Set([MISSION_PATH, "docs/project/CURRENT_STATE.md", evidence]);
  for (const rel of files) if (!allowed.has(rel)) errors.push(`CLOSE_SCOPE:${rel}`);
  if (mission.active_package !== "KR-L20" || mission.phase !== "DONE" || mission.branch !== CLOSE_BRANCH
      || mission.candidate_sha !== baseSha || mission.writer_count !== "0"
      || mission.last_completed_package !== "KR-L20" || mission.next_package !== "none"
      || mission.next_gate_after_active_package !== "LIVE_COMPLETE") errors.push("CLOSE_MISSION_INVALID");
  const full = path.join(root, evidence);
  if (!existsSync(full)) errors.push("CLOSE_EVIDENCE_MISSING");
  else {
    const facts = parseFacts(readFileSync(full, "utf8"));
    if (facts.DEPLOYMENT_SHA !== baseSha || facts.PRODUCTION_SMOKE !== "PASS"
        || !/^https:\/\//.test(facts.PRODUCTION_URL ?? "")
        || facts.MONITORING_HANDOFF !== "PASS" || facts.ROLLBACK_HANDOFF !== "PASS") {
      errors.push("CLOSE_EVIDENCE_INVALID");
    }
  }
  return errors;
}

export function checkLivePackageScope({ root, base, head, branch }) {
  const files = changedFiles(root, base, head);
  if (branch === "main") return [];
  try {
    const baseMission = parseMission(gitFile(root, base, MISSION_PATH));
    if (baseMission.phase === "DONE" && baseMission.next_gate_after_active_package === "LIVE_COMPLETE") {
      const protectedChanges = files.filter((rel) => covered(rel, POST_LIVE_CONTROL_PATTERNS));
      return protectedChanges.map((rel) => `POST_LIVE_CONTROL_MUTATION:${rel}`);
    }
  } catch {
    // Before activation or in an isolated selftest, the normal package rules remain authoritative.
  }
  const baseSha = resolved(root, base);
  const plan = JSON.parse(readFileSync(path.join(root, PLAN_PATH), "utf8"));
  const mission = parseMission(readFileSync(path.join(root, MISSION_PATH), "utf8"));
  if (branch === ACTIVATION_BRANCH) return checkActivation(files, baseSha, plan);
  if (branch === CLOSE_BRANCH) return checkClosure(root, baseSha, files, mission);
  return checkPackage(root, branch, base, baseSha, head, files, plan, mission);
}

function write(root, rel, content) {
  const file = path.join(root, rel);
  mkdirSync(path.dirname(file), { recursive: true });
  writeFileSync(file, content, "utf8");
}

function setMission(text, values) {
  let next = text;
  for (const [key, value] of Object.entries(values)) next = next.replace(new RegExp(`^${key}:.*$`, "m"), `${key}: ${value}`);
  return next;
}

function missionFixture(plan, item) {
  return [
    "schema_version: 1",
    "mission_id: KREILE-LIVE-V1",
    "status: active",
    `plan_path: ${PLAN_PATH}`,
    `activation_condition: ${plan.activationCondition}`,
    `active_package: ${item.id}`,
    `active_package_position: ${item.position}`,
    `next_package: ${item.successor ?? "none"}`,
    "phase: PREFLIGHT",
    `branch: codex/kreile-${item.id.toLowerCase()}`,
    "base_ref: origin/main",
    `focused_spec: ${item.focusedSpec}`,
    "spec_owner: PL_ONLY_WRITER_FORBIDDEN",
    `writer_count: ${item.kind === "BUILD" ? "1" : "0"}`,
    `writer_scope_source: ${item.kind === "BUILD" ? "ACTIVE_PACKAGE_EDITABLE_PATHS_ONLY" : "NO_WRITER_GATE"}`,
    "reviewer: INDEPENDENT_EXACT_SHA",
    "attempt: 0",
    `last_completed_package: ${item.predecessor ?? "none"}`,
    "candidate_sha: none",
    `owner_visual_required: ${item.ownerView}`,
    "block_reason: none",
    "resume_phase: none",
    "next_gate_after_active_package: PL_CREATES_ASSERTIONS_RED_SPEC",
    "merge_rule: OWNER_EXPLICIT_AUTHORITY_ONLY",
    "production_rule: OWNER_AUTHORIZES_EACH_MAIN_DEPLOYMENT_FINAL_LIVE_DECLARATION_ONLY_AT_KR_L20",
    "updated_at: 2026-10-11T00:00:00.000Z",
    "",
  ].join("\n");
}

function commit(root, message) {
  git(root, ["add", "."]);
  git(root, ["commit", "-qm", message]);
}

function reviewEvidence(item, candidate) {
  const output = `Independent review PASS for ${item.id} at ${candidate}\n`;
  return {
    output,
    receipt: [
      `PACKAGE=${item.id}`,
      `CANDIDATE_SHA=${candidate}`,
      "REVIEW=PASS",
      "REVIEWER_INDEPENDENT=PASS",
      "GATES=PASS",
      "REVIEW_RUN_ID=selftest-review-001",
      "REVIEW_MODEL=selftest-independent",
      "REVIEW_STARTED_AT=2026-10-11T00:00:00.000Z",
      "REVIEW_ENDED_AT=2026-10-11T00:01:00.000Z",
      "REVIEW_EXIT=0",
      `REVIEW_OUTPUT_SHA256=${hash(output)}`,
      "",
    ].join("\n"),
  };
}

function selftestPackage(fixture, plan, item) {
  write(fixture, PLAN_PATH, JSON.stringify(plan, null, 2));
  const baseMission = missionFixture(plan, item);
  write(fixture, MISSION_PATH, baseMission);
  commit(fixture, "base");
  const base = git(fixture, ["rev-parse", "HEAD"]);
  const branch = `codex/kreile-${item.id.toLowerCase()}`;
  git(fixture, ["checkout", "-qb", branch]);
  write(fixture, item.focusedSpec, "// immutable focused spec selftest\n");
  const preflight = item.kind === "BUILD"
    ? `PACKAGE=${item.id}\nASSERTIONS_RED=PASS\nBASE_SHA=${base}\nRED_RUN_ID=selftest-red-001\nRED_EXIT_NONZERO=PASS\nRED_FAILURE_ASSERTION=expected product assertion\n`
    : `PACKAGE=${item.id}\nGATE_BASELINE=PASS\nBASE_SHA=${base}\n`;
  write(fixture, `docs/evidence/live-line/${item.id.toLowerCase()}/PREFLIGHT.md`, preflight);
  write(fixture, MISSION_PATH, setMission(baseMission, {
    phase: item.kind === "BUILD" ? "WRITING" : "REVIEW",
    candidate_sha: item.kind === "BUILD" ? "none" : base,
    next_gate_after_active_package: item.kind === "BUILD" ? "WRITER_COMPLETES_ACTIVE_SCOPE" : "INDEPENDENT_EXACT_SHA_REVIEW",
  }));
  commit(fixture, "PL preflight");
  let candidate = base;
  if (item.kind === "BUILD") {
    const product = item.editablePaths.find((rel) => !rel.includes("*"));
    if (!product) throw new Error(`Selftest package needs one exact editable path: ${item.id}`);
    write(fixture, product, "export const built = true;\n");
    commit(fixture, "writer product");
    candidate = git(fixture, ["rev-parse", "HEAD"]);
  }
  const evidence = reviewEvidence(item, candidate);
  write(fixture, `docs/evidence/live-line/${item.id.toLowerCase()}/REVIEW_OUTPUT.md`, evidence.output);
  write(fixture, `docs/evidence/live-line/${item.id.toLowerCase()}/REVIEW.md`, evidence.receipt);
  write(fixture, MISSION_PATH, setMission(baseMission, {
    phase: "READY_TO_MERGE",
    candidate_sha: candidate,
    next_gate_after_active_package: "OWNER_MERGE_AUTHORITY",
  }));
  commit(fixture, "PL closure");
  const head = git(fixture, ["rev-parse", "HEAD"]);
  return { base, branch, head, candidate };
}

function selftestAmendment(fixture, plan, item) {
  write(fixture, PLAN_PATH, JSON.stringify(plan, null, 2));
  const baseMission = missionFixture(plan, item);
  write(fixture, MISSION_PATH, baseMission);
  commit(fixture, "base");
  const base = git(fixture, ["rev-parse", "HEAD"]);
  const branch = `codex/kreile-${item.id.toLowerCase()}`;
  git(fixture, ["checkout", "-qb", branch]);
  write(fixture, item.focusedSpec, "// immutable focused spec selftest\n");
  write(fixture, `docs/evidence/live-line/${item.id.toLowerCase()}/PREFLIGHT.md`, [
    `PACKAGE=${item.id}`,
    "ASSERTIONS_RED=PASS",
    `BASE_SHA=${base}`,
    "RED_RUN_ID=selftest-red-001",
    "RED_EXIT_NONZERO=PASS",
    "RED_FAILURE_ASSERTION=expected product assertion",
    "",
  ].join("\n"));
  write(fixture, MISSION_PATH, setMission(baseMission, {
    phase: "WRITING",
    next_gate_after_active_package: "WRITER_COMPLETES_ACTIVE_SCOPE",
  }));
  commit(fixture, "PL preflight");
  const product = item.editablePaths.find((rel) => !rel.includes("*"));
  write(fixture, product, "export const failedAttempt = true;\n");
  commit(fixture, "writer failed attempt");
  const failedCandidate = git(fixture, ["rev-parse", "HEAD"]);
  write(fixture, MISSION_PATH, setMission(baseMission, {
    phase: "FAIL_FINAL",
    attempt: "1",
    candidate_sha: failedCandidate,
    next_gate_after_active_package: "OWNER_REPLANS_SAME_PACKAGE",
  }));
  commit(fixture, "PL final failure");

  const amended = JSON.parse(JSON.stringify(plan));
  amended.packages[0].acceptance = [...amended.packages[0].acceptance, "owner-authorized selftest clarification"];
  write(fixture, PLAN_PATH, JSON.stringify(amended, null, 2));
  write(fixture, item.focusedSpec, "// owner-authorized amended focused spec selftest\n");
  write(fixture, `docs/evidence/live-line/${item.id.toLowerCase()}/PREFLIGHT.md`, [
    `PACKAGE=${item.id}`,
    "ASSERTIONS_RED=PASS",
    `BASE_SHA=${base}`,
    "RED_RUN_ID=selftest-red-amended-001",
    "RED_EXIT_NONZERO=PASS",
    "RED_FAILURE_ASSERTION=amended expected product assertion",
    "",
  ].join("\n"));
  const baseRaw = gitFile(fixture, base, PLAN_PATH);
  write(fixture, "docs/delivery/amendments/KR-AMEND-0001.json", `${JSON.stringify({
    activePackage: item.id,
    authorizedBy: "OWNER_EXPLICIT_CURRENT_TASK",
    basePlanSha256: hash(baseRaw),
    changedFields: ["acceptance"],
    reason: "Selftest proves the only legal same-package recovery lane.",
    requestedAt: "2026-10-11T00:02:00.000Z",
  }, null, 2)}\n`);
  write(fixture, MISSION_PATH, setMission(baseMission, {
    phase: "PREFLIGHT",
    attempt: "1",
    candidate_sha: "none",
    next_gate_after_active_package: "PL_CREATES_ASSERTIONS_RED_SPEC",
  }));
  commit(fixture, "owner-authorized same-package amendment");
  return { base, branch, head: git(fixture, ["rev-parse", "HEAD"]) };
}

function selftestBlockedPreflightAmendment(fixture, plan, item) {
  write(fixture, PLAN_PATH, JSON.stringify(plan, null, 2));
  const baseMission = missionFixture(plan, item);
  write(fixture, MISSION_PATH, baseMission);
  commit(fixture, "base");
  const base = git(fixture, ["rev-parse", "HEAD"]);
  const branch = `codex/kreile-${item.id.toLowerCase()}`;
  git(fixture, ["checkout", "-qb", branch]);
  write(fixture, item.focusedSpec, "// blocked preflight focused spec selftest\n");
  write(fixture, `docs/evidence/live-line/${item.id.toLowerCase()}/PREFLIGHT.md`, [
    `PACKAGE=${item.id}`,
    "ASSERTIONS_RED=PASS",
    `BASE_SHA=${base}`,
    "RED_RUN_ID=selftest-red-blocked-001",
    "RED_EXIT_NONZERO=PASS",
    "RED_FAILURE_ASSERTION=required path is outside package scope",
    "",
  ].join("\n"));
  write(fixture, MISSION_PATH, setMission(baseMission, {
    phase: "BLOCKED_PRODUCT_DECISION",
    block_reason: "required_path_outside_scope",
    resume_phase: "PREFLIGHT",
    next_gate_after_active_package: "OWNER_DECISION",
  }));
  commit(fixture, "PL blocks before writer start");

  const amended = JSON.parse(JSON.stringify(plan));
  amended.packages[0].acceptance = [...amended.packages[0].acceptance, "owner-authorized blocked-preflight clarification"];
  write(fixture, PLAN_PATH, JSON.stringify(amended, null, 2));
  write(fixture, item.focusedSpec, "// owner-authorized blocked-preflight spec rewrite\n");
  write(fixture, `docs/evidence/live-line/${item.id.toLowerCase()}/PREFLIGHT.md`, [
    `PACKAGE=${item.id}`,
    "ASSERTIONS_RED=PASS",
    `BASE_SHA=${base}`,
    "RED_RUN_ID=selftest-red-blocked-amended-001",
    "RED_EXIT_NONZERO=PASS",
    "RED_FAILURE_ASSERTION=amended required product assertion",
    "",
  ].join("\n"));
  const baseRaw = gitFile(fixture, base, PLAN_PATH);
  write(fixture, "docs/delivery/amendments/KR-AMEND-0001.json", `${JSON.stringify({
    activePackage: item.id,
    authorizedBy: "OWNER_EXPLICIT_CURRENT_TASK",
    basePlanSha256: hash(baseRaw),
    changedFields: ["acceptance"],
    reason: "Selftest proves blocked preflight can resume without a replacement package.",
    requestedAt: "2026-10-11T00:03:00.000Z",
  }, null, 2)}\n`);
  write(fixture, MISSION_PATH, setMission(baseMission, {
    phase: "PREFLIGHT",
    attempt: "1",
    candidate_sha: "none",
    next_gate_after_active_package: "PL_CREATES_ASSERTIONS_RED_SPEC",
  }));
  commit(fixture, "owner-authorized blocked-preflight amendment");
  return { base, branch, head: git(fixture, ["rev-parse", "HEAD"]) };
}

function selftestGateToBuildAmendment(fixture, plan, item) {
  write(fixture, PLAN_PATH, JSON.stringify(plan, null, 2));
  const baseMission = missionFixture(plan, item);
  write(fixture, MISSION_PATH, baseMission);
  commit(fixture, "base");
  const base = git(fixture, ["rev-parse", "HEAD"]);
  const branch = `codex/kreile-${item.id.toLowerCase()}`;
  git(fixture, ["checkout", "-qb", branch]);
  write(fixture, item.focusedSpec, "// gate focused spec selftest\n");
  write(fixture, `docs/evidence/live-line/${item.id.toLowerCase()}/PREFLIGHT.md`, `PACKAGE=${item.id}\nGATE_BASELINE=PASS\nBASE_SHA=${base}\n`);
  write(fixture, MISSION_PATH, setMission(baseMission, {
    phase: "REVIEW",
    candidate_sha: base,
    next_gate_after_active_package: "INDEPENDENT_EXACT_SHA_REVIEW",
  }));
  commit(fixture, "PL gate preflight");
  write(fixture, MISSION_PATH, setMission(baseMission, {
    phase: "FAIL_FINAL",
    attempt: "1",
    candidate_sha: base,
    next_gate_after_active_package: "OWNER_REPLANS_SAME_PACKAGE",
  }));
  commit(fixture, "PL gate final failure");

  const amended = JSON.parse(JSON.stringify(plan));
  const index = amended.packages.findIndex((entry) => entry.id === item.id);
  amended.packages[index].kind = "BUILD";
  amended.packages[index].editablePaths = ["src/app/live-gate-repair.tsx"];
  amended.packages[index].maxEditablePaths = 1;
  amended.packages[index].acceptance = [...amended.packages[index].acceptance, "owner-authorized bounded gate repair"];
  write(fixture, PLAN_PATH, JSON.stringify(amended, null, 2));
  write(fixture, item.focusedSpec, "// owner-authorized gate-to-build spec rewrite\n");
  write(fixture, `docs/evidence/live-line/${item.id.toLowerCase()}/PREFLIGHT.md`, [
    `PACKAGE=${item.id}`,
    "ASSERTIONS_RED=PASS",
    `BASE_SHA=${base}`,
    "RED_RUN_ID=selftest-gate-to-build-001",
    "RED_EXIT_NONZERO=PASS",
    "RED_FAILURE_ASSERTION=bounded gate repair assertion",
    "",
  ].join("\n"));
  const baseRaw = gitFile(fixture, base, PLAN_PATH);
  write(fixture, "docs/delivery/amendments/KR-AMEND-0001.json", `${JSON.stringify({
    activePackage: item.id,
    authorizedBy: "OWNER_EXPLICIT_CURRENT_TASK",
    basePlanSha256: hash(baseRaw),
    changedFields: ["acceptance", "editablePaths", "kind", "maxEditablePaths"],
    reason: "Selftest proves one failed gate can become one bounded build without a new package.",
    requestedAt: "2026-10-11T00:04:00.000Z",
  }, null, 2)}\n`);
  write(fixture, MISSION_PATH, setMission(baseMission, {
    phase: "PREFLIGHT",
    attempt: "1",
    candidate_sha: "none",
    writer_count: "1",
    writer_scope_source: "ACTIVE_PACKAGE_EDITABLE_PATHS_ONLY",
    next_gate_after_active_package: "PL_CREATES_ASSERTIONS_RED_SPEC",
  }));
  commit(fixture, "owner-authorized gate-to-build amendment");
  return { base, branch, head: git(fixture, ["rev-parse", "HEAD"]) };
}

export function runSelftest(root = process.cwd()) {
  if (!covered("src/modules/orders/server/get.ts", ["src/modules/orders/**"])) throw new Error("glob positive failed");
  if (covered("src/modules/customers/server/get.ts", ["src/modules/orders/**"])) throw new Error("glob negative failed");
  const plan = JSON.parse(readFileSync(path.join(root, PLAN_PATH), "utf8"));
  const fixture = mkdtempSync(path.join(tmpdir(), "kreile-live-scope-"));
  try {
    git(fixture, ["init", "-q"]);
    git(fixture, ["config", "user.email", "scope-selftest@example.invalid"]);
    git(fixture, ["config", "user.name", "Scope Selftest"]);
    git(fixture, ["config", "commit.gpgsign", "false"]);
    const build = selftestPackage(fixture, plan, plan.packages[0]);
    const valid = checkLivePackageScope({ root: fixture, base: build.base, head: build.head, branch: build.branch });
    if (valid.length > 0) throw new Error(`valid build package rejected: ${valid.join(" | ")}`);
    write(fixture, plan.packages[0].editablePaths[0], "export const built = false;\n");
    commit(fixture, "late unreviewed product");
    const late = git(fixture, ["rev-parse", "HEAD"]);
    const invalid = checkLivePackageScope({ root: fixture, base: build.base, head: late, branch: build.branch });
    if (!invalid.some((error) => error.startsWith("PACKAGE_CANDIDATE_NOT_LAST_PRODUCT_COMMIT"))) {
      throw new Error(`late product mutation not rejected: ${invalid.join(" | ")}`);
    }
  } finally {
    rmSync(fixture, { recursive: true, force: true });
  }

  const gateFixture = mkdtempSync(path.join(tmpdir(), "kreile-live-gate-"));
  try {
    git(gateFixture, ["init", "-q"]);
    git(gateFixture, ["config", "user.email", "gate-selftest@example.invalid"]);
    git(gateFixture, ["config", "user.name", "Gate Selftest"]);
    git(gateFixture, ["config", "commit.gpgsign", "false"]);
    const gate = selftestPackage(gateFixture, plan, plan.packages[16]);
    const validGate = checkLivePackageScope({ root: gateFixture, base: gate.base, head: gate.head, branch: gate.branch });
    if (validGate.length > 0) throw new Error(`valid gate package rejected: ${validGate.join(" | ")}`);
  } finally {
    rmSync(gateFixture, { recursive: true, force: true });
  }

  const amendmentFixture = mkdtempSync(path.join(tmpdir(), "kreile-live-amendment-"));
  try {
    git(amendmentFixture, ["init", "-q"]);
    git(amendmentFixture, ["config", "user.email", "amendment-selftest@example.invalid"]);
    git(amendmentFixture, ["config", "user.name", "Amendment Selftest"]);
    git(amendmentFixture, ["config", "commit.gpgsign", "false"]);
    const amendment = selftestAmendment(amendmentFixture, plan, plan.packages[0]);
    const validAmendment = checkLivePackageScope({
      root: amendmentFixture,
      base: amendment.base,
      head: amendment.head,
      branch: amendment.branch,
    });
    if (validAmendment.length > 0) throw new Error(`valid amendment rejected: ${validAmendment.join(" | ")}`);
  } finally {
    rmSync(amendmentFixture, { recursive: true, force: true });
  }

  const blockedAmendmentFixture = mkdtempSync(path.join(tmpdir(), "kreile-live-blocked-amendment-"));
  try {
    git(blockedAmendmentFixture, ["init", "-q"]);
    git(blockedAmendmentFixture, ["config", "user.email", "blocked-amendment-selftest@example.invalid"]);
    git(blockedAmendmentFixture, ["config", "user.name", "Blocked Amendment Selftest"]);
    git(blockedAmendmentFixture, ["config", "commit.gpgsign", "false"]);
    const amendment = selftestBlockedPreflightAmendment(blockedAmendmentFixture, plan, plan.packages[0]);
    const validAmendment = checkLivePackageScope({
      root: blockedAmendmentFixture,
      base: amendment.base,
      head: amendment.head,
      branch: amendment.branch,
    });
    if (validAmendment.length > 0) throw new Error(`valid blocked-preflight amendment rejected: ${validAmendment.join(" | ")}`);
  } finally {
    rmSync(blockedAmendmentFixture, { recursive: true, force: true });
  }

  const gateAmendmentFixture = mkdtempSync(path.join(tmpdir(), "kreile-live-gate-amendment-"));
  try {
    git(gateAmendmentFixture, ["init", "-q"]);
    git(gateAmendmentFixture, ["config", "user.email", "gate-amendment-selftest@example.invalid"]);
    git(gateAmendmentFixture, ["config", "user.name", "Gate Amendment Selftest"]);
    git(gateAmendmentFixture, ["config", "commit.gpgsign", "false"]);
    const amendment = selftestGateToBuildAmendment(gateAmendmentFixture, plan, plan.packages[16]);
    const validAmendment = checkLivePackageScope({
      root: gateAmendmentFixture,
      base: amendment.base,
      head: amendment.head,
      branch: amendment.branch,
    });
    if (validAmendment.length > 0) throw new Error(`valid gate-to-build amendment rejected: ${validAmendment.join(" | ")}`);
  } finally {
    rmSync(gateAmendmentFixture, { recursive: true, force: true });
  }

  const closeFixture = mkdtempSync(path.join(tmpdir(), "kreile-live-close-"));
  try {
    git(closeFixture, ["init", "-q"]);
    git(closeFixture, ["config", "user.email", "close-selftest@example.invalid"]);
    git(closeFixture, ["config", "user.name", "Close Selftest"]);
    git(closeFixture, ["config", "commit.gpgsign", "false"]);
    const final = plan.packages.at(-1);
    write(closeFixture, PLAN_PATH, JSON.stringify(plan, null, 2));
    const readyMission = setMission(missionFixture(plan, final), {
      phase: "READY_TO_MERGE",
      candidate_sha: "a".repeat(40),
      next_gate_after_active_package: "OWNER_MERGE_AUTHORITY",
    });
    write(closeFixture, MISSION_PATH, readyMission);
    commit(closeFixture, "merged KR-L20 gate");
    const base = git(closeFixture, ["rev-parse", "HEAD"]);
    git(closeFixture, ["checkout", "-qb", CLOSE_BRANCH]);
    write(closeFixture, "docs/evidence/live-line/kr-l20/LIVE_COMPLETE.md", [
      `DEPLOYMENT_SHA=${base}`,
      "PRODUCTION_SMOKE=PASS",
      "PRODUCTION_URL=https://example.invalid",
      "MONITORING_HANDOFF=PASS",
      "ROLLBACK_HANDOFF=PASS",
      "",
    ].join("\n"));
    write(closeFixture, MISSION_PATH, setMission(readyMission, {
      phase: "DONE",
      branch: CLOSE_BRANCH,
      candidate_sha: base,
      last_completed_package: "KR-L20",
      next_gate_after_active_package: "LIVE_COMPLETE",
    }));
    commit(closeFixture, "close live line");
    const head = git(closeFixture, ["rev-parse", "HEAD"]);
    const validClose = checkLivePackageScope({ root: closeFixture, base, head, branch: CLOSE_BRANCH });
    if (validClose.length > 0) throw new Error(`valid close rejected: ${validClose.join(" | ")}`);

    git(closeFixture, ["checkout", "-qb", "hotfix/post-live-product"]);
    write(closeFixture, "src/app/post-live-health.tsx", "export const postLiveHealth = true;\n");
    commit(closeFixture, "normal post-live product hotfix");
    const hotfixHead = git(closeFixture, ["rev-parse", "HEAD"]);
    const validHotfix = checkLivePackageScope({ root: closeFixture, base: head, head: hotfixHead, branch: "hotfix/post-live-product" });
    if (validHotfix.length > 0) throw new Error(`valid post-live product hotfix rejected: ${validHotfix.join(" | ")}`);

    git(closeFixture, ["checkout", "-q", head]);
    git(closeFixture, ["checkout", "-qb", "hotfix/post-live-control"]);
    write(closeFixture, "AGENTS.md", "unauthorized live-line control mutation\n");
    commit(closeFixture, "mutate post-live control");
    const controlHead = git(closeFixture, ["rev-parse", "HEAD"]);
    const invalidControl = checkLivePackageScope({ root: closeFixture, base: head, head: controlHead, branch: "hotfix/post-live-control" });
    if (!invalidControl.includes("POST_LIVE_CONTROL_MUTATION:AGENTS.md")) {
      throw new Error(`post-live control mutation not rejected: ${invalidControl.join(" | ")}`);
    }
  } finally {
    rmSync(closeFixture, { recursive: true, force: true });
  }
  return true;
}

function parseArgs(argv) {
  const values = { root: process.cwd(), base: null, head: "HEAD", branch: null, selftest: false };
  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index];
    if (value === "--root") values.root = path.resolve(argv[++index]);
    else if (value === "--base") values.base = argv[++index];
    else if (value === "--head") values.head = argv[++index];
    else if (value === "--branch") values.branch = argv[++index];
    else if (value === "--selftest") values.selftest = true;
    else throw new Error(`Unknown argument: ${value}`);
  }
  return values;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.selftest) {
    runSelftest(args.root);
    console.log("KREILE_LIVE_PACKAGE_SCOPE_SELFTEST=PASS");
    return;
  }
  args.base ??= "origin/main";
  args.branch ??= git(args.root, ["branch", "--show-current"]);
  const errors = checkLivePackageScope(args);
  if (errors.length > 0) {
    errors.forEach((error) => console.error(error));
    process.exitCode = 1;
    return;
  }
  console.log(`KREILE_LIVE_PACKAGE_SCOPE=PASS branch=${args.branch}`);
}

if (import.meta.url === pathToFileURL(path.resolve(process.argv[1] ?? "")).href) await main();
