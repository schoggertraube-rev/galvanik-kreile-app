import {
  existsSync,
  mkdtempSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import os from "node:os";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const DEFAULT_CONFIG = "quality/authoritative-sources.json";
const STANDARD_ENTRY = "docs/project/DOCUMENT_AUTHORITY.md";
const TRUTH_SOURCE_CONTRACT = Object.freeze({
  project_rules: "AGENTS.md",
  product_decisions: "docs/project/linie/KREILE_LINIE_ENTSCHEIDUNGSREGISTER_2026-08-28.md",
  scope_modules: "docs/project/linie/MODULKARTE_KANON.md",
  architecture: "docs/project/linie/ARCHITEKTUR_MODULE_PATH1.md",
  active_execution: "missions/F1_ORDER_TO_CASH_PILOT_001.yml",
  delivered_main: "docs/project/CURRENT_STATE.md",
  ui_truth: "docs/project/linie/00_UI_REFERENZEN_PFADE.md",
});
const UI_REFERENCE_CONTRACT = Object.freeze([
  "docs/project/linie/ui/KREILE_STARTSEITE_PHILLIP_V4_2026-08-20.html",
  "docs/project/linie/ui/KREILE_STARTSEITE_ROLF_V8_2026-08-20.html",
  "docs/project/linie/ui/KREILE_AUFTRAGSKARTE_MACHART_V8_2026-08-19.html",
  "docs/project/linie/ui/KREILE_KUNDENKARTE_MACHART_V2_2026-08-19.html",
]);
const REQUIRED_DECISIONS = Object.freeze(["D-GOV-001", "D-ARCH-011", "D-UI-CORE-001", "D-UI-CORE-002"]);
const REQUIRED_CLASSIFICATIONS = Object.freeze([
  "docs/project/DOCUMENT_AUTHORITY.md",
  "docs/project/MASTERPLAN.md",
  "docs/project/NON_LOSS_REGISTER.md",
  "docs/project/MODULARITY_STRATEGY.md",
  "docs/project/PROVIDER_CAPABILITY_MATRIX.md",
  "docs/project/linie/00_JETZT_UND_LEITPLANKEN.md",
  "docs/project/linie/00_ABC_INDEX.md",
  "docs/project/linie/00_BIBEL_INDEX.md",
  "docs/project/linie/ui/00_UI_REFERENZ_KANONISCH.md",
]);
const BANNER_EXEMPTIONS = new Set(["audit_results.md", "CLAUDE.md", "README.md"]);
const ALLOWED_DOCUMENT_STATUS = new Set(["HISTORICAL_NON_AUTHORITATIVE", "REFERENCE_ONLY_NON_EXECUTABLE"]);
const LEGACY_CALENDAR_CONTRACT = Object.freeze({
  finding: "src/app/kalender/page.tsx",
  registry: "docs/evidence/f1/F1_R0_CAPABILITY_REGISTRY.json",
  registryId: "page.kalender",
  sourceClaim: "Google Kalender",
  matrix: "docs/project/PROVIDER_CAPABILITY_MATRIX.md",
  disposition: "PATH1_UI_CONVERGENCE_A_REMOVE_OR_404",
});
const REQUIRED_MODULE_IDS = Object.freeze([
  "module.fundament",
  "module.suche",
  "module.intake",
  "module.orders",
  "module.customers",
  "module.calendar",
  "module.accounting-minimal",
]);
const CONFIG_KEYS = Object.freeze(["schemaVersion", "truthTypes", "uiReferences", "documentClassifications"]);
const AUTHORITY_CLAIM = /(?:EINZIGE(?:\s+GÜLTIGE)?\s+(?:UI-)?WAHRHEIT|HÖCHSTE\s+PRIORITÄT|SCHLÄGT\s+ALLES|VORRANGAUTORITÄT)/iu;

const posix = (value) => value.replaceAll("\\", "/");
const absolute = (root, rel) => path.resolve(root, rel);
const exists = (root, rel) => typeof rel === "string" && existsSync(absolute(root, rel));
const read = (root, rel) => readFileSync(absolute(root, rel), "utf8");

function parseJson(root, rel, errors, code) {
  if (!exists(root, rel)) {
    errors.push(`${code}_PATH_MISSING:${rel ?? "UNKNOWN"}`);
    return null;
  }
  try {
    return JSON.parse(read(root, rel));
  } catch (error) {
    errors.push(`${code}_JSON_INVALID:${rel}:${error.message}`);
    return null;
  }
}

function yamlScalar(text, key, errors) {
  const matches = [...text.matchAll(new RegExp(`^${key}:\\s*(.+?)\\s*$`, "gm"))];
  if (matches.length !== 1) {
    errors.push(`ACTIVE_EXECUTION_KEY_COUNT:${key}:${matches.length}`);
    return null;
  }
  return matches[0][1].replace(/\s+#.*$/, "").trim();
}

function sameSet(left, right) {
  const a = [...left].sort();
  const b = [...right].sort();
  return a.length === b.length && a.every((value, index) => value === b[index]);
}

function uiNames(text) {
  return [...new Set([...text.matchAll(/KREILE_(?:STARTSEITE_(?:PHILLIP_V4|ROLF_V8)|AUFTRAGSKARTE_MACHART_V8|KUNDENKARTE_MACHART_V2)_2026-08-\d{2}\.html/g)].map((match) => match[0]))];
}

function markdownFiles(root) {
  const result = [];
  const visit = (directory) => {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      if (entry.name === ".git" || entry.name === ".next" || entry.name === "node_modules") continue;
      const full = path.join(directory, entry.name);
      if (entry.isDirectory()) visit(full);
      else if (entry.isFile() && entry.name.toLowerCase().endsWith(".md")) result.push(posix(path.relative(root, full)));
    }
  };
  visit(root);
  return result;
}

function checkBanner(root, item, errors) {
  if (!item || Object.keys(item).sort().join(",") !== "path,status") {
    errors.push(`DOCUMENT_CLASSIFICATION_SCHEMA:${item?.path ?? "UNKNOWN"}`);
    return;
  }
  if (!exists(root, item.path)) {
    errors.push(`DOCUMENT_CLASSIFICATION_PATH_MISSING:${item.path}`);
    return;
  }
  if (!ALLOWED_DOCUMENT_STATUS.has(item.status)) errors.push(`DOCUMENT_CLASSIFICATION_STATUS:${item.path}`);
  if (BANNER_EXEMPTIONS.has(item.path)) return;
  const first = read(root, item.path).split(/\r?\n/, 1)[0];
  const expected = `<!-- STATUS: ${item.status} | CANONICAL_ENTRY: ${STANDARD_ENTRY} -->`;
  if (first !== expected) errors.push(`DOCUMENT_BANNER_MISSING:${item.path}`);
}

export function checkAuthorityRepository(root = process.cwd(), configRel = DEFAULT_CONFIG) {
  const errors = [];
  const config = parseJson(root, configRel, errors, "AUTHORITY_CONFIG");
  if (!config) return errors;

  if (config.schemaVersion !== 2) errors.push("AUTHORITY_CONFIG_SCHEMA_VERSION");
  const configKeys = Object.keys(config).sort();
  if (!sameSet(configKeys, CONFIG_KEYS)) errors.push(`AUTHORITY_CONFIG_CLOSED_SCHEMA:${configKeys.join(",")}`);

  const truthTypes = Array.isArray(config.truthTypes) ? config.truthTypes : [];
  if (truthTypes.length !== Object.keys(TRUTH_SOURCE_CONTRACT).length) errors.push(`TRUTH_TYPE_TOTAL:${truthTypes.length}`);
  const ids = [];
  const sources = [];
  for (const entry of truthTypes) {
    if (!entry || Object.keys(entry).sort().join(",") !== "id,source") {
      errors.push(`TRUTH_TYPE_SCHEMA:${entry?.id ?? "UNKNOWN"}`);
      continue;
    }
    ids.push(entry.id);
    sources.push(entry.source);
    if (!(entry.id in TRUTH_SOURCE_CONTRACT)) errors.push(`TRUTH_TYPE_UNKNOWN:${entry.id}`);
    else if (TRUTH_SOURCE_CONTRACT[entry.id] !== entry.source) errors.push(`TRUTH_SOURCE_CONTRACT:${entry.id}`);
    if (!exists(root, entry.source)) errors.push(`TRUTH_SOURCE_PATH_MISSING:${entry.source}`);
  }
  for (const id of Object.keys(TRUTH_SOURCE_CONTRACT)) {
    if (ids.filter((value) => value === id).length !== 1) errors.push(`TRUTH_TYPE_COUNT:${id}`);
  }
  if (new Set(ids).size !== ids.length) errors.push("TRUTH_TYPE_DUPLICATE_ID");
  if (new Set(sources).size !== sources.length) errors.push("TRUTH_SOURCE_REUSED");

  const configuredRefs = Array.isArray(config.uiReferences) ? config.uiReferences.map(posix) : [];
  if (!sameSet(configuredRefs, UI_REFERENCE_CONTRACT)) errors.push("UI_REFERENCE_CONFIG_CONTRACT");
  if (new Set(configuredRefs).size !== configuredRefs.length) errors.push("UI_REFERENCE_CONFIG_DUPLICATE");
  for (const rel of UI_REFERENCE_CONTRACT) if (!exists(root, rel)) errors.push(`UI_REFERENCE_PATH_MISSING:${rel}`);

  const classifications = Array.isArray(config.documentClassifications) ? config.documentClassifications : [];
  if (classifications.length === 0) errors.push("DOCUMENT_CLASSIFICATIONS_EMPTY");
  const classifiedPaths = classifications.map((item) => item?.path).filter(Boolean);
  if (new Set(classifiedPaths).size !== classifiedPaths.length) errors.push("DOCUMENT_CLASSIFICATION_DUPLICATE");
  for (const item of classifications) checkBanner(root, item, errors);
  for (const rel of REQUIRED_CLASSIFICATIONS) {
    if (classifiedPaths.filter((value) => value === rel).length !== 1) errors.push(`REQUIRED_DOCUMENT_CLASSIFICATION:${rel}`);
  }

  const decisionPath = TRUTH_SOURCE_CONTRACT.product_decisions;
  const decision = exists(root, decisionPath) ? read(root, decisionPath) : "";
  const decisions = [...decision.matchAll(/^##\s+(D-[A-Z0-9-]+)\b/gm)].map((match) => match[1]);
  for (const id of new Set(decisions)) {
    const count = decisions.filter((value) => value === id).length;
    if (count > 1) errors.push(`DECISION_ID_DUPLICATE:${id}`);
  }
  for (const id of REQUIRED_DECISIONS) {
    const count = decisions.filter((value) => value === id).length;
    if (count !== 1) errors.push(`REQUIRED_DECISION_COUNT:${id}:${count}`);
  }

  const uiIndex = read(root, TRUTH_SOURCE_CONTRACT.ui_truth);
  const indexedRefs = [...uiIndex.matchAll(/^- `([^`]+\.html)`/gm)]
    .map((match) => posix(path.join("docs/project/linie/ui", match[1])));
  if (!sameSet(indexedRefs, UI_REFERENCE_CONTRACT)) errors.push("UI_REFERENCE_INDEX_CONTRACT");
  if (new Set(indexedRefs).size !== indexedRefs.length) errors.push("UI_REFERENCE_INDEX_DUPLICATE");
  const expectedUiNames = UI_REFERENCE_CONTRACT.map((rel) => path.basename(rel));
  for (const [kind, rel] of [["DECISION", decisionPath], ["SCOPE", TRUTH_SOURCE_CONTRACT.scope_modules]]) {
    if (!sameSet(uiNames(read(root, rel)), expectedUiNames)) errors.push(`UI_REFERENCE_${kind}_CONTRACT`);
  }

  const missionPath = TRUTH_SOURCE_CONTRACT.active_execution;
  const mission = read(root, missionPath);
  for (const key of ["mission_id", "status", "branch", "base_sha", "active_package", "next_gate_after_active_package"]) {
    const value = yamlScalar(mission, key, errors);
    if (!value || value === "none") errors.push(`ACTIVE_EXECUTION_VALUE_EMPTY:${key}`);
  }
  if (yamlScalar(mission, "status", errors) !== "active") errors.push("CONFIGURED_MISSION_NOT_ACTIVE");
  if (yamlScalar(mission, "next_product_priority", errors) !== "PATH1_UI_CONVERGENCE") errors.push("UI_PROGRAM_NOT_CANONICAL");
  if (yamlScalar(mission, "path1_s5_search_status", errors) !== "CANDIDATE_PR_84_NOT_ACCEPTED_NOT_MERGED") errors.push("SEARCH_CANDIDATE_STATUS_DRIFT");
  if (yamlScalar(mission, "path1_calendar_status", errors) !== "NOT_STARTED_BLOCKED_EXTERNAL_PERMISSION") errors.push("CALENDAR_START_STATUS_DRIFT");
  if (yamlScalar(mission, "f1_6_status", errors) !== "NOT_STARTED") errors.push("F1_6_STATUS_DRIFT");
  const activeMissions = readdirSync(absolute(root, "missions"), { withFileTypes: true })
    .filter((entry) => entry.isFile() && /\.ya?ml$/i.test(entry.name))
    .filter((entry) => /^status:\s*active\s*$/m.test(readFileSync(path.join(absolute(root, "missions"), entry.name), "utf8")));
  if (activeMissions.length !== 1 || activeMissions[0]?.name !== path.basename(missionPath)) errors.push(`ACTIVE_MISSION_COUNT_OR_SOURCE:${activeMissions.length}`);

  const current = read(root, TRUTH_SOURCE_CONTRACT.delivered_main);
  for (const token of ["OWNER_UX_FAIL / NOT_DELIVERED", "FULLY_REJECTED_AS_DELIVERY_BASE", "kein Zielscreen-PASS"]) {
    if (!current.includes(token)) errors.push(`CURRENT_STATE_UI_TRUTH_MISSING:${token}`);
  }
  if (!/main@[0-9a-f]{40}/.test(current.slice(0, 1000))) errors.push("CURRENT_STATE_MAIN_SHA_MISSING");
  const scope = read(root, TRUTH_SOURCE_CONTRACT.scope_modules);
  const architecture = read(root, TRUTH_SOURCE_CONTRACT.architecture);
  for (const [kind, content] of [["DECISION", decision], ["SCOPE", scope], ["ARCHITECTURE", architecture]]) {
    for (const token of ["PATH1_UI_CONVERGENCE", "vollständig als Lieferbasis verworfen", "UX-Lieferfortschritt"]) {
      if (!content.includes(token)) errors.push(`UI_REPLACEMENT_${kind}_MISSING:${token}`);
    }
  }

  const forbiddenExecutionKeys = /^(?:branch|base_sha|active_package|next_gate_after_active_package):\s*/m;
  for (const item of classifications) {
    if (exists(root, item?.path) && forbiddenExecutionKeys.test(read(root, item.path))) errors.push(`CLASSIFIED_DOCUMENT_ACTIVE_EXECUTION:${item.path}`);
  }
  const knownDocs = new Set([...sources, ...classifiedPaths]);
  for (const rel of markdownFiles(root)) {
    if (!knownDocs.has(rel) && AUTHORITY_CLAIM.test(read(root, rel))) errors.push(`UNCLASSIFIED_COMPETING_AUTHORITY:${rel}`);
  }

  const registry = parseJson(root, LEGACY_CALENDAR_CONTRACT.registry, errors, "CAPABILITY_REGISTRY");
  const matrix = exists(root, LEGACY_CALENDAR_CONTRACT.matrix) ? read(root, LEGACY_CALENDAR_CONTRACT.matrix) : "";
  const legacySource = exists(root, LEGACY_CALENDAR_CONTRACT.finding) ? read(root, LEGACY_CALENDAR_CONTRACT.finding) : "";
  if (!legacySource.includes(LEGACY_CALENDAR_CONTRACT.sourceClaim)) errors.push("LEGACY_CALENDAR_SOURCE_CLAIM_NOT_DETECTED");
  const calendarCapability = registry?.capabilities?.find((item) => item.stable_id === LEGACY_CALENDAR_CONTRACT.registryId);
  if (!calendarCapability || calendarCapability.entry_point !== LEGACY_CALENDAR_CONTRACT.finding || calendarCapability.visible !== true || calendarCapability.reachable !== true) {
    errors.push("LEGACY_CALENDAR_REGISTRY_STATE_NOT_DETECTED");
  }
  const calendarLine = matrix.split(/\r?\n/).find((line) => line.includes(`\`${LEGACY_CALENDAR_CONTRACT.registryId}\``)) ?? "";
  for (const token of ["ACTIVE_VISIBLE_PROVIDER_DEFECT", "QUARANTINE", LEGACY_CALENDAR_CONTRACT.finding, LEGACY_CALENDAR_CONTRACT.disposition]) {
    if (!calendarLine.includes(token)) errors.push(`LEGACY_CALENDAR_MATRIX_BLOCKER_MISSING:${token}`);
  }
  for (const id of REQUIRED_MODULE_IDS) if (!matrix.includes(`\`${id}\``)) errors.push(`PROVIDER_MATRIX_MODULE_MISSING:${id}`);
  const pageRows = matrix.split(/\r?\n/).filter((line) => /^\| `page\./.test(line));
  const matrixPageIds = pageRows.map((row) => row.split("|")[1].trim().replaceAll("`", ""));
  for (const row of pageRows) {
    const cells = row.split("|").slice(1, -1).map((cell) => cell.trim());
    if (cells.length !== 7 || cells.some((cell) => cell.length === 0)) errors.push(`PROVIDER_MATRIX_ROUTE_COLUMNS:${cells[0] ?? "UNKNOWN"}`);
  }
  for (const capability of registry?.capabilities?.filter((item) => item.kind === "PAGE_ROUTE") ?? []) {
    const count = matrixPageIds.filter((id) => id === capability.stable_id).length;
    if (count !== 1) errors.push(`PROVIDER_MATRIX_ROUTE_COUNT:${capability.stable_id}:${count}`);
  }
  for (const id of new Set(matrixPageIds)) {
    if (!registry?.capabilities?.some((item) => item.kind === "PAGE_ROUTE" && item.stable_id === id)) errors.push(`PROVIDER_MATRIX_UNKNOWN_ROUTE:${id}`);
  }
  return errors;
}

function writeFixture(root) {
  const banner = (status, title) => `<!-- STATUS: ${status} | CANONICAL_ENTRY: ${STANDARD_ENTRY} -->\n# ${title}\n`;
  const files = {
    "AGENTS.md": "# Rules\n",
    "docs/project/linie/KREILE_LINIE_ENTSCHEIDUNGSREGISTER_2026-08-28.md": `## D-GOV-001 — one\n## D-ARCH-011 — provider\n## D-UI-CORE-001 — route\n## D-UI-CORE-002 — PATH1_UI_CONVERGENCE\nvollständig als Lieferbasis verworfen; kein UX-Lieferfortschritt\n${UI_REFERENCE_CONTRACT.map((rel) => `\`${path.basename(rel)}\``).join("\n")}\n`,
    "docs/project/linie/MODULKARTE_KANON.md": `PATH1_UI_CONVERGENCE\nvollständig als Lieferbasis verworfen; kein UX-Lieferfortschritt\n${UI_REFERENCE_CONTRACT.map((rel) => `\`${path.basename(rel)}\``).join("\n")}\n`,
    "docs/project/linie/ARCHITEKTUR_MODULE_PATH1.md": "PATH1_UI_CONVERGENCE\nvollständig als Lieferbasis verworfen; kein UX-Lieferfortschritt\n",
    "missions/F1_ORDER_TO_CASH_PILOT_001.yml": "mission_id: F1\nstatus: active\nbranch: gov\nbase_sha: aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa\nactive_package: GOV\nnext_gate_after_active_package: REVIEW\nnext_product_priority: PATH1_UI_CONVERGENCE\npath1_s5_search_status: CANDIDATE_PR_84_NOT_ACCEPTED_NOT_MERGED\npath1_calendar_status: NOT_STARTED_BLOCKED_EXTERNAL_PERMISSION\nf1_6_status: NOT_STARTED\n",
    "docs/project/CURRENT_STATE.md": "# Current main@aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa\nOWNER_UX_FAIL / NOT_DELIVERED\nFULLY_REJECTED_AS_DELIVERY_BASE\nkein Zielscreen-PASS\n",
    "docs/project/linie/00_UI_REFERENZEN_PFADE.md": `# UI truth\n${UI_REFERENCE_CONTRACT.map((rel) => `- \`${path.basename(rel)}\``).join("\n")}\n`,
    "docs/evidence/f1/F1_R0_CAPABILITY_REGISTRY.json": JSON.stringify({ capabilities: [
      { stable_id: "page.real", kind: "PAGE_ROUTE", visible: true },
      { stable_id: "page.kalender", kind: "PAGE_ROUTE", entry_point: LEGACY_CALENDAR_CONTRACT.finding, visible: true, reachable: true },
    ] }),
    "src/app/kalender/page.tsx": "Google Kalender vorbereitet\n",
    "docs/project/PROVIDER_CAPABILITY_MATRIX.md": `${banner("REFERENCE_ONLY_NON_EXECUTABLE", "Matrix")}${REQUIRED_MODULE_IDS.map((id) => `\`${id}\``).join("\n")}\n| \`page.real\` | /real | own | none | PENDING | evidence | next |\n| \`page.kalender\` | /kalender | ACTIVE_VISIBLE_PROVIDER_DEFECT at src/app/kalender/page.tsx | Google Kalender | QUARANTINE | source+registry | PATH1_UI_CONVERGENCE_A_REMOVE_OR_404 |\n`,
  };
  const classified = [
    ["docs/project/DOCUMENT_AUTHORITY.md", "Authority"],
    ["docs/project/MASTERPLAN.md", "Master"],
    ["docs/project/NON_LOSS_REGISTER.md", "Non loss"],
    ["docs/project/MODULARITY_STRATEGY.md", "Modularity"],
    ["docs/project/linie/00_JETZT_UND_LEITPLANKEN.md", "Now"],
    ["docs/project/linie/00_ABC_INDEX.md", "ABC"],
    ["docs/project/linie/00_BIBEL_INDEX.md", "Bible"],
    ["docs/project/linie/ui/00_UI_REFERENZ_KANONISCH.md", "UI manifest"],
  ];
  for (const [rel, title] of classified) files[rel] = banner("REFERENCE_ONLY_NON_EXECUTABLE", title);
  for (const rel of UI_REFERENCE_CONTRACT) files[rel] = "<!doctype html>\n";
  for (const [rel, content] of Object.entries(files)) {
    mkdirSync(path.dirname(absolute(root, rel)), { recursive: true });
    writeFileSync(absolute(root, rel), content, "utf8");
  }
  const config = {
    schemaVersion: 2,
    truthTypes: Object.entries(TRUTH_SOURCE_CONTRACT).map(([id, source]) => ({ id, source })),
    uiReferences: [...UI_REFERENCE_CONTRACT],
    documentClassifications: [
      ...REQUIRED_CLASSIFICATIONS.map((rel) => ({ path: rel, status: "REFERENCE_ONLY_NON_EXECUTABLE" })),
    ],
  };
  mkdirSync(absolute(root, "quality"), { recursive: true });
  writeFileSync(absolute(root, DEFAULT_CONFIG), `${JSON.stringify(config, null, 2)}\n`, "utf8");
}

export function runAuthoritySelftest() {
  const cases = [
    ["missing-section", (root) => { const p = absolute(root, DEFAULT_CONFIG); const c = JSON.parse(readFileSync(p, "utf8")); delete c.documentClassifications; writeFileSync(p, JSON.stringify(c), "utf8"); }, "AUTHORITY_CONFIG_CLOSED_SCHEMA"],
    ["empty-section", (root) => { const p = absolute(root, DEFAULT_CONFIG); const c = JSON.parse(readFileSync(p, "utf8")); c.documentClassifications = []; writeFileSync(p, JSON.stringify(c), "utf8"); }, "DOCUMENT_CLASSIFICATIONS_EMPTY"],
    ["shadow-truth", (root) => { const p = absolute(root, DEFAULT_CONFIG); const c = JSON.parse(readFileSync(p, "utf8")); c.activeExecution = { branch: "shadow" }; writeFileSync(p, JSON.stringify(c), "utf8"); }, "AUTHORITY_CONFIG_CLOSED_SCHEMA"],
    ["extra-truth-type", (root) => { const p = absolute(root, DEFAULT_CONFIG); const c = JSON.parse(readFileSync(p, "utf8")); c.truthTypes.push({ id: "shadow", source: "AGENTS.md" }); writeFileSync(p, JSON.stringify(c), "utf8"); }, "TRUTH_TYPE_UNKNOWN"],
    ["source-relabeled", (root) => { const p = absolute(root, DEFAULT_CONFIG); const c = JSON.parse(readFileSync(p, "utf8")); c.truthTypes[0].source = "docs/project/CURRENT_STATE.md"; writeFileSync(p, JSON.stringify(c), "utf8"); }, "TRUTH_SOURCE_CONTRACT"],
    ["ui-wrong-date", (root) => { const p = absolute(root, DEFAULT_CONFIG); const c = JSON.parse(readFileSync(p, "utf8")); c.uiReferences[2] = c.uiReferences[2].replace("08-19", "08-20"); writeFileSync(p, JSON.stringify(c), "utf8"); }, "UI_REFERENCE_CONFIG_CONTRACT"],
    ["ui-index-asymmetric", (root) => { const p = absolute(root, TRUTH_SOURCE_CONTRACT.ui_truth); writeFileSync(p, readFileSync(p, "utf8").replace("08-19.html", "08-18.html"), "utf8"); }, "UI_REFERENCE_INDEX_CONTRACT"],
    ["ui-decision-asymmetric", (root) => { const p = absolute(root, TRUTH_SOURCE_CONTRACT.product_decisions); writeFileSync(p, readFileSync(p, "utf8").replace("08-19.html", "08-18.html"), "utf8"); }, "UI_REFERENCE_DECISION_CONTRACT"],
    ["ui-scope-asymmetric", (root) => { const p = absolute(root, TRUTH_SOURCE_CONTRACT.scope_modules); writeFileSync(p, readFileSync(p, "utf8").replace("08-19.html", "08-18.html"), "utf8"); }, "UI_REFERENCE_SCOPE_CONTRACT"],
    ["missing-banner", (root) => { const p = absolute(root, "docs/project/DOCUMENT_AUTHORITY.md"); writeFileSync(p, "# no banner\n", "utf8"); }, "DOCUMENT_BANNER_MISSING"],
    ["banner-self-weaken", (root) => { const p = absolute(root, DEFAULT_CONFIG); const c = JSON.parse(readFileSync(p, "utf8")); c.documentClassifications[0].bannerRequired = false; writeFileSync(p, JSON.stringify(c), "utf8"); }, "DOCUMENT_CLASSIFICATION_SCHEMA"],
    ["nested-authority-claim", (root) => { const p = absolute(root, "docs/project/deep/claim.md"); mkdirSync(path.dirname(p), { recursive: true }); writeFileSync(p, "# DIE EINZIGE GÜLTIGE UI-WAHRHEIT\n", "utf8"); }, "UNCLASSIFIED_COMPETING_AUTHORITY"],
    ["mission-inactive", (root) => { const p = absolute(root, TRUTH_SOURCE_CONTRACT.active_execution); writeFileSync(p, readFileSync(p, "utf8").replace("status: active", "status: paused"), "utf8"); }, "CONFIGURED_MISSION_NOT_ACTIVE"],
    ["program-shadow", (root) => { const p = absolute(root, TRUTH_SOURCE_CONTRACT.active_execution); writeFileSync(p, readFileSync(p, "utf8").replace("PATH1_UI_CONVERGENCE", "PATH1_UI_CONVERGENCE_A"), "utf8"); }, "UI_PROGRAM_NOT_CANONICAL"],
    ["duplicate-decision", (root) => { const p = absolute(root, TRUTH_SOURCE_CONTRACT.product_decisions); writeFileSync(p, `${readFileSync(p, "utf8")}## D-UI-CORE-002 — shadow\n`, "utf8"); }, "DECISION_ID_DUPLICATE"],
    ["provider-source-masked", (root) => { const p = absolute(root, LEGACY_CALENDAR_CONTRACT.finding); writeFileSync(p, "Provider nicht konfiguriert\n", "utf8"); }, "LEGACY_CALENDAR_SOURCE_CLAIM_NOT_DETECTED"],
    ["candidate-checker-weakened", (root) => { const p = absolute(root, "scripts/quality/check-authoritative-sources.mjs"); mkdirSync(path.dirname(p), { recursive: true }); writeFileSync(p, "process.exit(0)\n", "utf8"); const c = absolute(root, DEFAULT_CONFIG); const value = JSON.parse(readFileSync(c, "utf8")); value.shadowTruth = true; writeFileSync(c, JSON.stringify(value), "utf8"); }, "AUTHORITY_CONFIG_CLOSED_SCHEMA"],
  ];
  let passed = 0;
  for (const [name, mutate, expected] of cases) {
    const root = mkdtempSync(path.join(os.tmpdir(), "authority-gate-"));
    try {
      writeFixture(root);
      const clean = checkAuthorityRepository(root);
      if (clean.length > 0) throw new Error(`selftest ${name} invalid clean fixture: ${clean.join(" | ")}`);
      mutate(root);
      const errors = checkAuthorityRepository(root);
      if (!errors.some((entry) => entry.includes(expected))) throw new Error(`selftest ${name} expected ${expected}, got: ${errors.join(" | ")}`);
      passed += 1;
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  }
  return { passed, total: cases.length };
}

function parseArgs(argv) {
  let root = process.cwd();
  let config = DEFAULT_CONFIG;
  let selftest = false;
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (token === "--selftest") selftest = true;
    else if (token === "--check") continue;
    else if (token === "--root" || token === "--config") {
      const value = argv[index + 1];
      if (!value) throw new Error(`${token} requires a value`);
      if (token === "--root") root = value;
      else config = value;
      index += 1;
    } else throw new Error(`Unknown argument: ${token}`);
  }
  return { root: path.resolve(root), config, selftest };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = parseArgs(process.argv.slice(2));
  if (args.selftest) {
    const result = runAuthoritySelftest();
    console.log(`AUTHORITY_GATE_SELFTEST=PASS cases=${result.passed}/${result.total}`);
  } else {
    const errors = checkAuthorityRepository(args.root, args.config);
    if (errors.length > 0) {
      console.error("AUTHORITY_GATE=FAIL");
      for (const error of errors) console.error(`- ${error}`);
      process.exitCode = 1;
    } else {
      console.log(`AUTHORITY_GATE=PASS truth_types=${Object.keys(TRUTH_SOURCE_CONTRACT).length} ui_references=${UI_REFERENCE_CONTRACT.length}`);
    }
  }
}
