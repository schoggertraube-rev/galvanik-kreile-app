import { createHash } from "node:crypto";
import {
  existsSync,
  readFileSync,
  readdirSync,
  statSync,
} from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath, pathToFileURL } from "node:url";

const PLAN_PATH = "docs/delivery/KREILE_LIVE_PLAN_V1.json";
const SALES_STAGE_PLAN_PATH = "docs/delivery/KREILE_VERKAUFSSTUFE_1.md";
const MISSION_PATH = "missions/F1_ORDER_TO_CASH_PILOT_001.yml";
const CLAUDE_SETTINGS_PATH = ".claude/settings.json";
const EXPECTED_PLAN_KEYS = [
  "activationCondition",
  "authorizedBy",
  "bootstrap",
  "createdAt",
  "deferredAfterLive",
  "operatingRules",
  "packages",
  "planId",
  "planStatus",
  "productRepository",
  "retiredControlSources",
  "roles",
  "schema",
  "stateMachine",
  "title",
  "truth",
];
const EXPECTED_PAGE_REFERENCES = Object.freeze([
  ["docs/project/linie/ui/KREILE_STARTSEITE_PHILLIP_V4_2026-08-20.html", "B3370C79A0FDC02191735D5EA4FB6BC07F301F6A64C7532325A5063B949CBCE1"],
  ["docs/project/linie/ui/KREILE_STARTSEITE_ROLF_V8_2026-08-20.html", "878FAD35177808249A5FF4364775EC6253AE98A114D3B3EB3CC345A3CA90E532"],
  ["docs/project/linie/ui/KREILE_AUFTRAGSKARTE_MACHART_V8_2026-08-19.html", "C4F74528ED4D516A9FED958FECEE1CB7F52B324788B0AA927551647892F1F365"],
  ["docs/project/linie/ui/KREILE_KUNDENKARTE_MACHART_V2_2026-08-19.html", "8B655B19B5DBEBDB74F8F801991B83937FA23E0AA44241ADB37D829BF7AA193F"],
]);
const FLOW_REFERENCE = Object.freeze([
  "docs/project/linie/ui/KREILE_GESAMTMOCK_V5_2026-09-14.html",
  "75258FF3BD4CC212C8E989061708A29DC26EA44B851BD28E8F16E8509B0CC0AA",
]);
const DESIGN_PATH = "docs/project/linie/ui/designsystem_v1_1";
const DESIGN_MANIFEST = `${DESIGN_PATH}/SHA256SUMS.txt`;
const DESIGN_MANIFEST_SHA256 = "71B0CB01F484BEEF042CFD04D31F951D2DB2D441C427F8212F35A8D41A8041E5";
const PROTECTED_WRITER_PATHS = Object.freeze([
  ".claude/",
  ".github/",
  ".gitattributes",
  "eslint.config.mjs",
  "AGENTS.md",
  "package.json",
  "missions/",
  "docs/delivery/",
  "docs/project/",
  `${DESIGN_PATH}/`,
  "quality/authoritative-sources.json",
  "scripts/quality/check-authoritative-sources.mjs",
  "scripts/quality/check-delivery-contracts.mjs",
  "scripts/quality/check-live-package-scope.mjs",
  "scripts/quality/select-live-regression-specs.mjs",
  "scripts/quality/check-module-gates.mjs",
  "scripts/show-active-live-package.mjs",
  "scripts/advance-live-package.mjs",
  "scripts/close-live-line.mjs",
]);
const OVERBROAD_WRITER_PATHS = new Set([
  "src/**",
  "src/app/**",
  "src/components/**",
  "src/lib/**",
  "src/lib/server/**",
  "src/modules/**",
]);
const PHASES = new Set([
  "TODO",
  "PREFLIGHT",
  "WRITING",
  "REVIEW",
  "OWNER_VIEW",
  "CORRECTING",
  "READY_TO_MERGE",
  "DONE",
  "BLOCKED_EXTERNAL",
  "BLOCKED_PRODUCT_DECISION",
  "FAIL_FINAL",
]);
const NEXT_GATE_BY_PHASE = Object.freeze({
  TODO: "PL_CREATES_ASSERTIONS_RED_SPEC",
  PREFLIGHT: "PL_CREATES_ASSERTIONS_RED_SPEC",
  WRITING: "WRITER_COMPLETES_ACTIVE_SCOPE",
  REVIEW: "INDEPENDENT_EXACT_SHA_REVIEW",
  OWNER_VIEW: "OWNER_VISUAL_DECISION",
  CORRECTING: "ONE_CORRECTION_ROUND",
  READY_TO_MERGE: "OWNER_MERGE_AUTHORITY",
  DONE: "PL_STARTS_SUCCESSOR",
  BLOCKED_EXTERNAL: "PL_RECOVERS_ENVIRONMENT",
  BLOCKED_PRODUCT_DECISION: "OWNER_DECISION",
  FAIL_FINAL: "OWNER_REPLANS_SAME_PACKAGE",
});
const EXPECTED_TRANSITIONS = Object.freeze([
  "TODO->PREFLIGHT",
  "PREFLIGHT->WRITING",
  "PREFLIGHT->BLOCKED_EXTERNAL",
  "PREFLIGHT->BLOCKED_PRODUCT_DECISION",
  "WRITING->BLOCKED_EXTERNAL",
  "WRITING->BLOCKED_PRODUCT_DECISION",
  "WRITING->REVIEW",
  "REVIEW->BLOCKED_EXTERNAL",
  "REVIEW->BLOCKED_PRODUCT_DECISION",
  "REVIEW->OWNER_VIEW",
  "REVIEW->READY_TO_MERGE",
  "REVIEW->CORRECTING",
  "OWNER_VIEW->BLOCKED_EXTERNAL",
  "OWNER_VIEW->BLOCKED_PRODUCT_DECISION",
  "OWNER_VIEW->READY_TO_MERGE",
  "OWNER_VIEW->CORRECTING",
  "CORRECTING->BLOCKED_EXTERNAL",
  "CORRECTING->BLOCKED_PRODUCT_DECISION",
  "CORRECTING->REVIEW",
  "REVIEW->FAIL_FINAL",
  "OWNER_VIEW->FAIL_FINAL",
  "READY_TO_MERGE->DONE",
  "BLOCKED_EXTERNAL->RESUME_PHASE",
  "BLOCKED_PRODUCT_DECISION->RESUME_PHASE",
  "BLOCKED_PRODUCT_DECISION->PREFLIGHT_WITH_OWNER_AMENDMENT",
  "FAIL_FINAL->PREFLIGHT_WITH_OWNER_AMENDMENT",
]);

const posix = (value) => value.replaceAll("\\", "/");
const absolute = (root, rel) => path.resolve(root, rel);
const isSha = (value) => /^[0-9a-f]{40}$/i.test(value ?? "");
const isSha256 = (value) => /^[0-9a-f]{64}$/i.test(value ?? "");
const sorted = (items) => [...items].sort();
const sameSet = (left, right) => {
  const a = sorted(left);
  const b = sorted(right);
  return a.length === b.length && a.every((value, index) => value === b[index]);
};

function hashFile(file) {
  return createHash("sha256").update(readFileSync(file)).digest("hex").toUpperCase();
}

function readJson(root, rel, errors, code) {
  const file = absolute(root, rel);
  if (!existsSync(file)) {
    errors.push(`${code}_MISSING:${rel}`);
    return null;
  }
  try {
    return JSON.parse(readFileSync(file, "utf8"));
  } catch (error) {
    errors.push(`${code}_INVALID_JSON:${error.message}`);
    return null;
  }
}

function parseMission(text, errors) {
  const values = {};
  for (const [lineIndex, line] of text.split(/\r?\n/).entries()) {
    if (!line.trim() || line.trimStart().startsWith("#")) continue;
    const match = line.match(/^([a-z][a-z0-9_]*):\s*(.*?)\s*$/);
    if (!match) {
      errors.push(`MISSION_LINE_INVALID:${lineIndex + 1}`);
      continue;
    }
    const [, key, value] = match;
    if (key in values) errors.push(`MISSION_KEY_DUPLICATE:${key}`);
    values[key] = value;
  }
  return values;
}

function invalidRepositoryPath(value) {
  return typeof value !== "string"
    || value.length === 0
    || /^[A-Za-z]:[\\/]/.test(value)
    || value.startsWith("\\\\")
    || value.includes("\\")
    || value.split("/").includes("..")
    || value.includes("_delivery_control");
}

function collectStrings(value, at = "$", out = []) {
  if (typeof value === "string") out.push([at, value]);
  else if (Array.isArray(value)) value.forEach((item, index) => collectStrings(item, `${at}[${index}]`, out));
  else if (value && typeof value === "object") {
    Object.entries(value).forEach(([key, item]) => collectStrings(item, `${at}.${key}`, out));
  }
  return out;
}

function globRegex(pattern) {
  let source = posix(pattern).replace(/[.+^${}()|[\]\\]/g, "\\$&");
  source = source.replaceAll("**", "__DOUBLE_STAR__");
  source = source.replaceAll("*", "[^/]*");
  source = source.replaceAll("__DOUBLE_STAR__", ".*");
  return new RegExp(`^${source}$`);
}

function patternCovers(pattern, rel) {
  return globRegex(pattern).test(posix(rel));
}

function writerPathIsProtected(pattern) {
  const normalized = posix(pattern);
  return PROTECTED_WRITER_PATHS.some((blocked) => {
    if (blocked.endsWith("/")) {
      const prefix = blocked.slice(0, -1);
      return normalized === prefix || normalized.startsWith(blocked) || patternCovers(normalized, `${prefix}/sentinel`);
    }
    return normalized === blocked || patternCovers(normalized, blocked);
  });
}

function walkFiles(root) {
  const files = [];
  const visit = (directory) => {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      const full = path.join(directory, entry.name);
      if (entry.isDirectory()) visit(full);
      else if (entry.isFile()) files.push(posix(path.relative(root, full)));
    }
  };
  visit(root);
  return sorted(files);
}

function validateDesignManifest(root, errors) {
  const manifestFile = absolute(root, DESIGN_MANIFEST);
  if (!existsSync(manifestFile)) {
    errors.push(`DESIGN_MANIFEST_MISSING:${DESIGN_MANIFEST}`);
    return;
  }
  const manifestHash = hashFile(manifestFile);
  if (manifestHash !== DESIGN_MANIFEST_SHA256) errors.push(`DESIGN_MANIFEST_HASH:${manifestHash}`);
  const entries = [];
  for (const line of readFileSync(manifestFile, "utf8").split(/\r?\n/)) {
    if (!line.trim() || line.startsWith("#")) continue;
    const match = line.match(/^([A-F0-9]{64})\s{2}(.+)$/);
    if (!match) {
      errors.push(`DESIGN_MANIFEST_LINE:${line}`);
      continue;
    }
    const rel = posix(match[2]);
    if (invalidRepositoryPath(rel) || rel === "SHA256SUMS.txt") errors.push(`DESIGN_MANIFEST_PATH:${rel}`);
    entries.push([rel, match[1]]);
  }
  const names = entries.map(([rel]) => rel);
  if (new Set(names).size !== names.length) errors.push("DESIGN_MANIFEST_DUPLICATE");
  const actual = walkFiles(absolute(root, DESIGN_PATH)).filter((rel) => rel !== "SHA256SUMS.txt");
  if (!sameSet(actual, names)) errors.push(`DESIGN_MANIFEST_INVENTORY:${actual.length}:${names.length}`);
  for (const [rel, expected] of entries) {
    const full = absolute(root, `${DESIGN_PATH}/${rel}`);
    if (!existsSync(full)) errors.push(`DESIGN_FILE_MISSING:${rel}`);
    else if (hashFile(full) !== expected) errors.push(`DESIGN_FILE_HASH:${rel}`);
  }
}

function validatePlanShape(plan, errors) {
  if (!plan || typeof plan !== "object" || Array.isArray(plan)) {
    errors.push("PLAN_NOT_OBJECT");
    return;
  }
  if (!sameSet(Object.keys(plan), EXPECTED_PLAN_KEYS)) errors.push(`PLAN_CLOSED_SCHEMA:${Object.keys(plan).sort().join(",")}`);
  if (plan.schema !== "kreile-live-plan/1") errors.push("PLAN_SCHEMA");
  if (plan.planId !== "KREILE-LIVE-V1") errors.push("PLAN_ID");
  if (plan.planStatus !== "AUTHORIZED_FOR_ACTIVATION") errors.push("PLAN_STATUS");
  if (plan.activationCondition !== "THIS_EXACT_CANDIDATE_IS_PRESENT_ON_ORIGIN_MAIN") errors.push("PLAN_ACTIVATION_CONDITION");

  const repo = plan.productRepository ?? {};
  if ("root" in repo) errors.push("PLAN_ABSOLUTE_ROOT_FORBIDDEN");
  if (repo.remote !== "git@github.com:schoggertraube-rev/galvanik-kreile-app.git") errors.push("PLAN_REMOTE");
  if (!isSha(repo.initialOriginMain)) errors.push("PLAN_INITIAL_MAIN_SHA");
  if (repo.deliveryTruth !== "origin/main") errors.push("PLAN_DELIVERY_TRUTH");
  if (repo.packageBranchPattern !== "codex/kreile-kr-lNN") errors.push("PLAN_BRANCH_PATTERN");
  if (repo.integrationBranchForbidden !== true) errors.push("PLAN_INTEGRATION_BRANCH");
  if (repo.mergeToMain !== "OWNER_EXPLICIT_AUTHORITY_ONLY") errors.push("PLAN_MERGE_RULE");
  if (repo.production !== "CONTINUOUS_OWNER_AUTHORIZED_MAIN_DEPLOYMENTS_FINAL_LIVE_DECLARATION_AT_KR_L20") {
    errors.push("PLAN_PRODUCTION_RULE");
  }

  const rules = plan.operatingRules ?? {};
  if (rules.exactlyOneActivePackage !== true) errors.push("PLAN_ONE_ACTIVE_PACKAGE");
  if (rules.maxCorrectionRounds !== 1) errors.push("PLAN_CORRECTION_ROUNDS");
  if (rules.replacementIdAfterFinalFailForbidden !== true) errors.push("PLAN_REPLACEMENT_ID_RULE");
  if (!sameSet(rules.packageKinds ?? [], ["BUILD", "GATE"])) errors.push("PLAN_PACKAGE_KINDS");
  if (rules.planMutationAfterActivation !== "OWNER_AUTHORIZED_SAME_PACKAGE_AMENDMENT_ONLY") errors.push("PLAN_MUTATION_RULE");
  if (rules.amendmentLane !== "SAME_PACKAGE_ID_NO_TOPOLOGY_CHANGE_OWNER_RECEIPT_AND_BASE_PLAN_HASH_REQUIRED") errors.push("PLAN_AMENDMENT_LANE");
  if (rules.amendmentRecovery !== "FAIL_FINAL_OR_BLOCKED_PRODUCT_DECISION_AT_PREFLIGHT_ONE_SPEC_REWRITE_IN_AMENDMENT_COMMIT_GATE_TO_BUILD_ONLY") {
    errors.push("PLAN_AMENDMENT_RECOVERY");
  }
  if (rules.focusedSpecOwner !== "PL_ONLY_WRITER_FORBIDDEN") errors.push("PLAN_SPEC_OWNER");
  if (rules.missionStateOwner !== "PL_ONLY_WRITER_FORBIDDEN") errors.push("PLAN_MISSION_OWNER");
  if (rules.deliveredStateOwner !== "PL_ONLY_WRITER_FORBIDDEN") errors.push("PLAN_DELIVERED_STATE_OWNER");
  if (rules.evidenceReceiptPattern !== "docs/evidence/live-line/{packageIdLower}/**") errors.push("PLAN_EVIDENCE_PATTERN");
  if (rules.commitSeparation !== "FIRST_COMMIT_PL_SPEC_MISSION_AND_PREFLIGHT_ONLY_THEN_WRITER_PRODUCT_ONLY_THEN_PL_CLOSURE_ONLY") {
    errors.push("PLAN_COMMIT_SEPARATION");
  }
  if (rules.externalOracleForbidden !== true || rules.absoluteCheckPathForbidden !== true) errors.push("PLAN_EXTERNAL_ORACLE_RULE");
  if (rules.claudeActiveSurface !== "SETTINGS_ONLY_NO_AUTO_AGENT_NO_HOOKS_NO_PROJECT_SKILLS") errors.push("PLAN_CLAUDE_ACTIVE_SURFACE");
  if (rules.legacySourceAccess !== "DENIED_BY_PROJECT_SETTINGS_AND_EXCLUDED_FROM_ACTIVE_CONTEXT") errors.push("PLAN_LEGACY_ACCESS_RULE");
  if (rules.packageScopeEnforcement !== "PROTECTED_BASE_CHECKER_PLUS_COMMIT_ROLE_SEPARATION") errors.push("PLAN_SCOPE_ENFORCEMENT");
  if (rules.regressionLane !== "MERGED_BUILD_SPECS_WITHOUT_EXTERNAL_PREREQUISITE_RUN_ON_FRESH_LOCAL_SUPABASE_EXTERNAL_AND_GATE_USE_BOUND_RECEIPTS_NO_SKIP_FIXME") {
    errors.push("PLAN_REGRESSION_LANE");
  }
  if (rules.postLiveRepository !== "NORMAL_NON_CONTROL_HOTFIXES_ALLOWED_AFTER_LIVE_COMPLETE") errors.push("PLAN_POST_LIVE_REPOSITORY");
  if (rules.successorActivation !== "ATOMIC_REPO_LOCAL_ADVANCE_AFTER_CANDIDATE_IS_ANCESTOR_OF_ORIGIN_MAIN") errors.push("PLAN_SUCCESSOR_ACTIVATION");
  if (rules.activationBranchReuse !== "FORBIDDEN_AFTER_INITIAL_ORIGIN_MAIN_MOVES") errors.push("PLAN_ACTIVATION_REUSE");
  if (rules.finalClosure !== "KR_L20_READY_ON_MAIN_THEN_OWNER_AUTHORIZED_PRODUCTION_SMOKE_AND_LIVE_CLOSE_BRANCH") errors.push("PLAN_FINAL_CLOSURE");
  if (rules.preflightScopeResolution !== "MEASURE_FIRST_AND_BLOCK_FOR_OWNER_DECISION_BEFORE_WRITER_WHEN_THE_REQUIRED_PATH_IS_OUTSIDE_EDITABLE_PATHS") {
    errors.push("PLAN_PREFLIGHT_SCOPE_RESOLUTION");
  }
  if (!sameSet(rules.visualViewports ?? [], ["1914x917", "1220x880", "390x844"])) errors.push("PLAN_VIEWPORTS");

  const bootstrap = plan.bootstrap ?? {};
  if (bootstrap.firstPackageId !== "KR-L01" || bootstrap.firstPhase !== "PREFLIGHT" || bootstrap.runtimeTruth !== MISSION_PATH) {
    errors.push("PLAN_BOOTSTRAP");
  }

  const machine = plan.stateMachine ?? {};
  if (!sameSet(machine.states ?? [], [...PHASES])) errors.push("PLAN_STATE_MACHINE_STATES");
  if (!sameSet(machine.transitions ?? [], EXPECTED_TRANSITIONS)) errors.push("PLAN_STATE_MACHINE_TRANSITIONS");
  if (machine.terminalFailure !== "FAIL_FINAL" || machine.noSuccessorAfterTerminalFailure !== true
      || machine.onlyRecovery !== "OWNER_AUTHORIZED_AMENDMENT_OF_THE_SAME_ACTIVE_PACKAGE") {
    errors.push("PLAN_STATE_MACHINE_RECOVERY");
  }

  for (const [at, value] of collectStrings(plan)) {
    if (/^[A-Za-z]:[\\/]/.test(value) || value.startsWith("\\\\") || value.includes("_delivery_control")) {
      errors.push(`PLAN_EXTERNAL_PATH:${at}`);
    }
  }

  const retired = Array.isArray(plan.retiredControlSources) ? plan.retiredControlSources : [];
  for (const [index, item] of retired.entries()) {
    if (!sameSet(Object.keys(item ?? {}), ["id", "sha256", "disposition"])) errors.push(`PLAN_RETIRED_SCHEMA:${index}`);
    if (!isSha256(item?.sha256)) errors.push(`PLAN_RETIRED_HASH:${index}`);
    if ("path" in (item ?? {})) errors.push(`PLAN_RETIRED_PATH_FORBIDDEN:${index}`);
  }

  const packages = Array.isArray(plan.packages) ? plan.packages : [];
  if (packages.length !== 20) errors.push(`PLAN_PACKAGE_COUNT:${packages.length}`);
  const ids = packages.map((item) => item?.id);
  const specs = packages.map((item) => item?.focusedSpec);
  if (new Set(ids).size !== ids.length) errors.push("PLAN_PACKAGE_ID_DUPLICATE");
  if (new Set(specs).size !== specs.length) errors.push("PLAN_PACKAGE_SPEC_DUPLICATE");

  for (let index = 0; index < packages.length; index += 1) {
    const item = packages[index] ?? {};
    const position = index + 1;
    const id = `KR-L${String(position).padStart(2, "0")}`;
    const predecessor = position === 1 ? null : `KR-L${String(position - 1).padStart(2, "0")}`;
    const successor = position === packages.length ? null : `KR-L${String(position + 1).padStart(2, "0")}`;
    const packageKeys = [
      "acceptance", "editablePaths", "focusedSpec", "id", "kind", "maxEditablePaths",
      "ownerView", "position", "predecessor", "routes", "scopeOut", "successor",
      "title", "userValue",
    ];
    if ("externalPrerequisite" in item) packageKeys.push("externalPrerequisite");
    if (!sameSet(Object.keys(item), packageKeys)) errors.push(`PLAN_PACKAGE_CLOSED_SCHEMA:${id}`);
    if (item.position !== position || item.id !== id) errors.push(`PLAN_PACKAGE_POSITION:${item.id ?? index}`);
    if (item.predecessor !== predecessor || item.successor !== successor) errors.push(`PLAN_PACKAGE_CHAIN:${id}`);
    if (!["BUILD", "GATE"].includes(item.kind)) errors.push(`PLAN_PACKAGE_KIND:${id}`);
    if (!Array.isArray(item.routes) || item.routes.length === 0 || item.routes.some((route) => !route.startsWith("/"))) errors.push(`PLAN_PACKAGE_ROUTES:${id}`);
    if (!Array.isArray(item.acceptance) || item.acceptance.length < 3) errors.push(`PLAN_PACKAGE_ACCEPTANCE:${id}`);
    if (!Array.isArray(item.scopeOut) || item.scopeOut.length === 0) errors.push(`PLAN_PACKAGE_SCOPE_OUT:${id}`);
    if ("externalPrerequisite" in item && (typeof item.externalPrerequisite !== "string" || item.externalPrerequisite.trim().length < 10)) {
      errors.push(`PLAN_PACKAGE_EXTERNAL_PREREQUISITE:${id}`);
    }
    if (typeof item.ownerView !== "boolean") errors.push(`PLAN_PACKAGE_OWNER_VIEW:${id}`);
    if (typeof item.focusedSpec !== "string" || invalidRepositoryPath(item.focusedSpec) || !item.focusedSpec.startsWith("e2e/kr-l")) {
      errors.push(`PLAN_PACKAGE_SPEC:${id}`);
    }
    const editable = Array.isArray(item.editablePaths) ? item.editablePaths : [];
    if (!Number.isInteger(item.maxEditablePaths) || item.maxEditablePaths < editable.length || item.maxEditablePaths > 12) {
      errors.push(`PLAN_PACKAGE_EDIT_LIMIT:${id}`);
    }
    if (item.kind === "BUILD" && editable.length === 0) errors.push(`PLAN_BUILD_EDIT_PATHS:${id}`);
    if (item.kind === "GATE" && (editable.length !== 0 || item.maxEditablePaths !== 0)) errors.push(`PLAN_GATE_WRITER_SCOPE:${id}`);
    if (new Set(editable).size !== editable.length) errors.push(`PLAN_PACKAGE_EDIT_PATHS:${id}`);
    for (const rel of editable) {
      if (invalidRepositoryPath(rel)) errors.push(`PLAN_PACKAGE_EDIT_PATH_INVALID:${id}:${rel}`);
      if (OVERBROAD_WRITER_PATHS.has(posix(rel))) errors.push(`PLAN_PACKAGE_EDIT_PATH_OVERBROAD:${id}:${rel}`);
      if (writerPathIsProtected(rel)) errors.push(`PLAN_PACKAGE_CONTROL_PATH:${id}:${rel}`);
      if (patternCovers(rel, item.focusedSpec)) errors.push(`PLAN_PACKAGE_SPEC_WRITER_LEAK:${id}:${rel}`);
    }
  }
}

function validateBoundFiles(root, plan, errors) {
  const design = plan?.truth?.designSystem ?? {};
  if (design.path !== DESIGN_PATH || design.manifestPath !== DESIGN_MANIFEST || design.manifestSha256 !== DESIGN_MANIFEST_SHA256) {
    errors.push("PLAN_DESIGN_BINDING");
  }
  if (design.role !== "TOKENS_TYPOGRAPHY_COMPONENTS_RESPONSIVE") errors.push("PLAN_DESIGN_ROLE");
  if (!sameSet(design.forbiddenAlternatives ?? [], ["designsystem_v1", "designsystem_v2"])) errors.push("PLAN_DESIGN_ALTERNATIVES");
  validateDesignManifest(root, errors);

  const flow = plan?.truth?.flow ?? {};
  if (flow.path !== FLOW_REFERENCE[0] || flow.sha256 !== FLOW_REFERENCE[1] || flow.role !== "FLOW_AND_INTERMEDIATE_STEPS_ONLY") {
    errors.push("PLAN_FLOW_BINDING");
  } else if (!existsSync(absolute(root, flow.path)) || hashFile(absolute(root, flow.path)) !== flow.sha256) {
    errors.push("PLAN_FLOW_HASH");
  }

  const pages = Array.isArray(plan?.truth?.pageComposition) ? plan.truth.pageComposition : [];
  if (pages.length !== EXPECTED_PAGE_REFERENCES.length) errors.push(`PLAN_PAGE_BINDING_COUNT:${pages.length}`);
  for (const [rel, expected] of EXPECTED_PAGE_REFERENCES) {
    const item = pages.find((entry) => entry?.path === rel);
    if (!item || item.sha256 !== expected) errors.push(`PLAN_PAGE_BINDING:${rel}`);
    else if (!existsSync(absolute(root, rel)) || hashFile(absolute(root, rel)) !== expected) errors.push(`PLAN_PAGE_HASH:${rel}`);
  }
}

function validateClaudeSettings(root, errors) {
  const settings = readJson(root, CLAUDE_SETTINGS_PATH, errors, "CLAUDE_SETTINGS");
  if (!settings) return;
  if (!sameSet(Object.keys(settings), ["$schema", "permissions"])) errors.push("CLAUDE_SETTINGS_CLOSED_SCHEMA");
  const permissions = settings.permissions ?? {};
  if (!sameSet(Object.keys(permissions), ["blockReadsOutsideWorkingDirectories", "defaultMode", "deny", "disableBypassPermissionsMode"])) {
    errors.push("CLAUDE_PERMISSIONS_CLOSED_SCHEMA");
  }
  if (permissions.defaultMode !== "default") errors.push("CLAUDE_DEFAULT_MODE");
  if (permissions.disableBypassPermissionsMode !== "disable") errors.push("CLAUDE_BYPASS_MODE");
  if (permissions.blockReadsOutsideWorkingDirectories !== true) errors.push("CLAUDE_OUTSIDE_READS");
  const deny = Array.isArray(permissions.deny) ? permissions.deny : [];
  if (!sameSet(deny, ["Read(/docs/project/history/**)"])) errors.push("CLAUDE_DENY_SURFACE");
  if (deny.includes("Read(/docs/project/linie/KREILE_LINIE_ENTSCHEIDUNGSREGISTER_2026-08-28.md)")) {
    errors.push("CLAUDE_CANONICAL_DECISION_REGISTER_DENIED");
  }
  const activeClaudeFiles = walkFiles(absolute(root, ".claude"));
  if (!sameSet(activeClaudeFiles, ["settings.json"])) {
    errors.push(`CLAUDE_ACTIVE_SURFACE:${activeClaudeFiles.join(",")}`);
  }
  const claudePointer = absolute(root, "CLAUDE.md");
  if (!existsSync(claudePointer) || readFileSync(claudePointer, "utf8") !== "@AGENTS.md\n") {
    errors.push("CLAUDE_ROOT_POINTER");
  }
}

function validateMission(root, plan, errors) {
  const file = absolute(root, MISSION_PATH);
  if (!existsSync(file)) {
    errors.push(`MISSION_MISSING:${MISSION_PATH}`);
    return;
  }
  const mission = parseMission(readFileSync(file, "utf8"), errors);
  const expectedKeys = [
    "schema_version", "mission_id", "status", "plan_path", "activation_condition",
    "active_package", "active_package_position", "next_package", "phase", "branch",
    "base_ref", "focused_spec", "spec_owner", "writer_count", "writer_scope_source",
    "reviewer", "attempt", "last_completed_package", "candidate_sha",
    "owner_visual_required", "block_reason", "resume_phase", "next_gate_after_active_package",
    "merge_rule", "production_rule", "updated_at",
  ];
  if (!sameSet(Object.keys(mission), expectedKeys)) errors.push(`MISSION_CLOSED_SCHEMA:${Object.keys(mission).sort().join(",")}`);
  if (mission.schema_version !== "1" || mission.mission_id !== "KREILE-LIVE-V1" || mission.status !== "active") errors.push("MISSION_IDENTITY");
  if (mission.plan_path !== PLAN_PATH || mission.activation_condition !== plan.activationCondition) errors.push("MISSION_PLAN_BINDING");
  if (mission.base_ref !== "origin/main") errors.push("MISSION_BASE_REF");
  if (mission.spec_owner !== "PL_ONLY_WRITER_FORBIDDEN" || mission.reviewer !== "INDEPENDENT_EXACT_SHA") errors.push("MISSION_REVIEW_SEPARATION");
  if (mission.merge_rule !== "OWNER_EXPLICIT_AUTHORITY_ONLY") errors.push("MISSION_MERGE_RULE");
  if (mission.production_rule !== "OWNER_AUTHORIZES_EACH_MAIN_DEPLOYMENT_FINAL_LIVE_DECLARATION_ONLY_AT_KR_L20") errors.push("MISSION_PRODUCTION_RULE");
  if (!PHASES.has(mission.phase)) errors.push(`MISSION_PHASE:${mission.phase}`);
  if (!/^[01]$/.test(mission.attempt ?? "")) errors.push(`MISSION_ATTEMPT:${mission.attempt}`);
  if (mission.candidate_sha !== "none" && !isSha(mission.candidate_sha)) errors.push("MISSION_CANDIDATE_SHA");
  if (!/^(true|false)$/.test(mission.owner_visual_required ?? "")) errors.push("MISSION_OWNER_VISUAL");

  const item = plan.packages.find((entry) => entry.id === mission.active_package);
  if (!item) {
    errors.push(`MISSION_ACTIVE_PACKAGE:${mission.active_package}`);
    return;
  }
  if (mission.active_package_position !== String(item.position)) errors.push("MISSION_PACKAGE_POSITION");
  const expectedWriters = item.kind === "BUILD" ? "1" : "0";
  const expectedScope = item.kind === "BUILD" ? "ACTIVE_PACKAGE_EDITABLE_PATHS_ONLY" : "NO_WRITER_GATE";
  if (mission.writer_count !== expectedWriters || mission.writer_scope_source !== expectedScope) errors.push("MISSION_WRITER_SEPARATION");
  if (mission.focused_spec !== item.focusedSpec) errors.push("MISSION_FOCUSED_SPEC");
  const packageBranch = `codex/kreile-${item.id.toLowerCase()}`;
  if (mission.branch !== packageBranch
      && !(mission.phase === "DONE" && item.successor === null && mission.branch === "codex/kreile-live-close")) {
    errors.push("MISSION_BRANCH");
  }
  if (mission.next_package !== (item.successor ?? "none")) errors.push("MISSION_SUCCESSOR");
  if (mission.owner_visual_required !== String(item.ownerView)) errors.push("MISSION_VISUAL_BINDING");
  if (NEXT_GATE_BY_PHASE[mission.phase] !== mission.next_gate_after_active_package
    && !(mission.phase === "DONE" && item.successor === null && mission.next_gate_after_active_package === "LIVE_COMPLETE")) {
    errors.push("MISSION_NEXT_GATE");
  }
  const expectedCompleted = mission.phase === "DONE" ? item.id : (item.predecessor ?? "none");
  if (mission.last_completed_package !== expectedCompleted) errors.push(`MISSION_LAST_COMPLETED:${expectedCompleted}`);
  const resumable = new Set(["PREFLIGHT", "WRITING", "REVIEW", "OWNER_VIEW", "CORRECTING"]);
  if (mission.phase === "BLOCKED_EXTERNAL" || mission.phase === "BLOCKED_PRODUCT_DECISION") {
    if (!resumable.has(mission.resume_phase)) errors.push("MISSION_RESUME_PHASE");
    if (mission.block_reason === "none" || !mission.block_reason) errors.push("MISSION_BLOCK_REASON");
  } else if (mission.resume_phase !== "none" || mission.block_reason !== "none") {
    errors.push("MISSION_NONBLOCKED_RECOVERY_FIELDS");
  }

  const activeMissions = readdirSync(absolute(root, "missions"), { withFileTypes: true })
    .filter((entry) => entry.isFile() && /\.ya?ml$/i.test(entry.name))
    .filter((entry) => /^status:\s*active\s*$/m.test(readFileSync(path.join(absolute(root, "missions"), entry.name), "utf8")));
  if (activeMissions.length !== 1 || activeMissions[0].name !== path.basename(MISSION_PATH)) {
    errors.push(`MISSION_ACTIVE_COUNT:${activeMissions.length}`);
  }
}

function validateSalesStageRepository(root, errors) {
  const planFile = absolute(root, SALES_STAGE_PLAN_PATH);
  const missionFile = absolute(root, MISSION_PATH);
  if (!existsSync(planFile)) {
    errors.push(`SALES_STAGE_PLAN_MISSING:${SALES_STAGE_PLAN_PATH}`);
    return;
  }
  if (!existsSync(missionFile)) {
    errors.push(`MISSION_MISSING:${MISSION_PATH}`);
    return;
  }

  const planText = readFileSync(planFile, "utf8");
  for (const token of [
    "OWNER_AUTHORIZED",
    "Siglinder, 25.10.2026",
    "KREILE_LIVE_PLAN_V1.json",
    "D-GOV-004",
    "kreile/b1-shell",
    "AENDERUNGEN_B1.md",
    "OWNER_EXPLICIT_AUTHORITY_ONLY",
  ]) {
    if (!planText.includes(token)) errors.push(`SALES_STAGE_PLAN_TOKEN:${token}`);
  }

  const missionErrors = [];
  const mission = parseMission(readFileSync(missionFile, "utf8"), missionErrors);
  errors.push(...missionErrors);
  const expectedKeys = [
    "schema_version", "mission_id", "status", "authorized_by", "authorized_at",
    "plan_path", "supersedes", "active_block", "phase", "branch", "base_ref",
    "started_from_sha", "desktop_due_at", "tablet_mobile_due_at", "handoff_path",
    "next_block", "writer_count", "reviewer", "merge_rule", "production_rule",
    "cost_rule",
  ];
  if (!sameSet(Object.keys(mission), expectedKeys)) {
    errors.push(`MISSION_CLOSED_SCHEMA:${Object.keys(mission).sort().join(",")}`);
  }
  if (mission.schema_version !== "2" || mission.mission_id !== "KREILE-VERKAUFSSTUFE-1"
      || mission.status !== "active") errors.push("MISSION_IDENTITY");
  if (mission.plan_path !== SALES_STAGE_PLAN_PATH
      || mission.supersedes !== "docs/delivery/KREILE_LIVE_PLAN_V1.json;D-GOV-004") {
    errors.push("MISSION_PLAN_BINDING");
  }
  if (mission.active_block !== "B1" || mission.phase !== "WRITING" || mission.branch !== "kreile/b1-shell") {
    errors.push("MISSION_ACTIVE_BLOCK");
  }
  if (mission.base_ref !== "origin/main" || !isSha(mission.started_from_sha)) errors.push("MISSION_BASE_REF");
  if (mission.writer_count !== "1" || mission.reviewer !== "INDEPENDENT_EXACT_SHA") errors.push("MISSION_REVIEW_SEPARATION");
  if (mission.handoff_path !== "docs/delivery/AENDERUNGEN_B1.md" || mission.next_block !== "B2") {
    errors.push("MISSION_HANDOFF");
  }
  for (const key of ["merge_rule", "production_rule", "cost_rule"]) {
    if (mission[key] !== "OWNER_EXPLICIT_AUTHORITY_ONLY") errors.push(`MISSION_OWNER_RULE:${key}`);
  }
  validateClaudeSettings(root, errors);
}

export function checkDeliveryRepository(root = process.cwd()) {
  const errors = [];
  const missionFile = absolute(root, MISSION_PATH);
  if (existsSync(missionFile)
      && /^mission_id:\s*KREILE-VERKAUFSSTUFE-1\s*$/m.test(readFileSync(missionFile, "utf8"))) {
    validateSalesStageRepository(root, errors);
    return errors;
  }
  const plan = readJson(root, PLAN_PATH, errors, "PLAN");
  if (!plan) return errors;
  validatePlanShape(plan, errors);
  validateBoundFiles(root, plan, errors);
  validateClaudeSettings(root, errors);
  validateMission(root, plan, errors);
  for (const rel of [
    "docs/project/history/controls/2026-10-11/F1_ORDER_TO_CASH_PILOT_001.legacy-2026-10-11.yml",
    "docs/project/history/controls/2026-10-11/check-delivery-contracts.legacy-2026-10-11.mjs.txt",
    "docs/project/history/controls/2026-10-11/delivery_contracts.legacy-2026-10-11.test.ts.txt",
    "docs/project/history/controls/2026-10-11/claude-legacy/settings.legacy-2026-10-11.json",
    "docs/project/history/controls/2026-10-11/claude-legacy/agents/chief-conductor.md",
    "docs/project/history/controls/2026-10-11/claude-legacy/skills/orchestrate-project/SKILL.md",
    "docs/project/history/controls/2026-10-11/claude-legacy/hooks/guard-destructive.mjs",
  ]) {
    if (!existsSync(absolute(root, rel)) || !statSync(absolute(root, rel)).isFile()) errors.push(`LEGACY_ARCHIVE_MISSING:${rel}`);
  }
  return errors;
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function expectMutation(plan, mutate, expectedCode) {
  const changed = clone(plan);
  mutate(changed);
  const errors = [];
  validatePlanShape(changed, errors);
  if (!errors.some((error) => error.startsWith(expectedCode))) {
    throw new Error(`selftest mutation did not fail closed: ${expectedCode}; got ${errors.join(" | ")}`);
  }
}

export function runSelftest(root = process.cwd()) {
  const plan = JSON.parse(readFileSync(absolute(root, PLAN_PATH), "utf8"));
  const validErrors = [];
  validatePlanShape(plan, validErrors);
  if (validErrors.length > 0) throw new Error(`selftest baseline invalid: ${validErrors.join(" | ")}`);
  expectMutation(plan, (value) => { value.packages[2].editablePaths.push(value.packages[2].focusedSpec); }, "PLAN_PACKAGE_SPEC_WRITER_LEAK");
  expectMutation(plan, (value) => { value.packages[5].predecessor = "KR-L01"; }, "PLAN_PACKAGE_CHAIN");
  expectMutation(plan, (value) => { value.productRepository.root = "C:\\shadow"; }, "PLAN_ABSOLUTE_ROOT_FORBIDDEN");
  expectMutation(plan, (value) => { value.operatingRules.maxCorrectionRounds = 2; }, "PLAN_CORRECTION_ROUNDS");
  expectMutation(plan, (value) => { value.operatingRules.amendmentRecovery = "FAIL_FINAL_ONLY"; }, "PLAN_AMENDMENT_RECOVERY");
  expectMutation(plan, (value) => { value.operatingRules.legacySourceAccess = "PROMPT_ONLY"; }, "PLAN_LEGACY_ACCESS_RULE");
  expectMutation(plan, (value) => { value.operatingRules.packageScopeEnforcement = "DOCUMENT_ONLY"; }, "PLAN_SCOPE_ENFORCEMENT");
  expectMutation(plan, (value) => { value.operatingRules.regressionLane = "ALL_SPECS_ON_DUMMY_BACKEND"; }, "PLAN_REGRESSION_LANE");
  expectMutation(plan, (value) => { value.operatingRules.postLiveRepository = "LOCKED_FOREVER"; }, "PLAN_POST_LIVE_REPOSITORY");
  expectMutation(plan, (value) => { value.operatingRules.successorActivation = "MANUAL_FREE_TEXT"; }, "PLAN_SUCCESSOR_ACTIVATION");
  expectMutation(plan, (value) => { value.packages[0].editablePaths.push("missions/**"); }, "PLAN_PACKAGE_CONTROL_PATH");
  expectMutation(plan, (value) => { value.packages[0].editablePaths.push("src/app/**"); }, "PLAN_PACKAGE_EDIT_PATH_OVERBROAD");
  expectMutation(plan, (value) => { value.planStatus = "DRAFT_VALIDATING"; }, "PLAN_STATUS");
  return true;
}

function argsOf(argv) {
  const result = { root: process.cwd(), selftest: false, expectedSelfHash: null };
  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index];
    if (value === "--root") result.root = path.resolve(argv[++index]);
    else if (value === "--selftest") result.selftest = true;
    else if (value === "--expect-self-sha256") result.expectedSelfHash = argv[++index];
    else if (value !== "--check") throw new Error(`Unknown argument: ${value}`);
  }
  return result;
}

async function main() {
  const args = argsOf(process.argv.slice(2));
  if (args.expectedSelfHash) {
    const actual = hashFile(fileURLToPath(import.meta.url));
    if (actual !== args.expectedSelfHash.toUpperCase()) throw new Error(`SELF_SHA256_MISMATCH:${actual}`);
  }
  if (args.selftest) {
    runSelftest(args.root);
    console.log("KREILE_LIVE_DELIVERY_SELFTEST=PASS");
    return;
  }
  const errors = checkDeliveryRepository(args.root);
  if (errors.length > 0) {
    for (const error of errors) console.error(error);
    process.exitCode = 1;
    return;
  }
  const mission = parseMission(readFileSync(absolute(args.root, MISSION_PATH), "utf8"), []);
  if (mission.mission_id === "KREILE-VERKAUFSSTUFE-1") {
    console.log(`KREILE_SALES_STAGE_DELIVERY_CONTRACT=PASS active=${mission.active_block} phase=${mission.phase}`);
  } else {
    const plan = JSON.parse(readFileSync(absolute(args.root, PLAN_PATH), "utf8"));
    console.log(`KREILE_LIVE_DELIVERY_CONTRACT=PASS packages=${plan.packages.length} active=${mission.active_package} phase=${mission.phase}`);
  }
}

if (import.meta.url === pathToFileURL(path.resolve(process.argv[1] ?? "")).href) {
  await main();
}
