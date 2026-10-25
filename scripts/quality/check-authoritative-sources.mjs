import { createHash } from "node:crypto";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import process from "node:process";
import { pathToFileURL } from "node:url";

import { checkDeliveryRepository } from "./check-delivery-contracts.mjs";

const CONFIG_PATH = "quality/authoritative-sources.json";
const AUTHORITY_CHECKER_PATH = "scripts/quality/check-authoritative-sources.mjs";
const RATCHET_WORKFLOW_PATH = ".github/workflows/eslint-ratchet.yml";
const TRUTH_SOURCE_CONTRACT = Object.freeze({
  project_rules: "AGENTS.md",
  product_decisions: "docs/project/linie/KREILE_LINIE_ENTSCHEIDUNGSREGISTER_2026-08-28.md",
  scope_modules: "docs/project/linie/MODULKARTE_KANON.md",
  architecture: "docs/project/linie/ARCHITEKTUR_MODULE_PATH1.md",
  live_plan: "docs/delivery/KREILE_VERKAUFSSTUFE_1.md",
  active_execution: "missions/F1_ORDER_TO_CASH_PILOT_001.yml",
  delivered_main: "docs/project/CURRENT_STATE.md",
  ui_truth: "docs/project/linie/00_UI_REFERENZEN_PFADE.md",
});
const UI_REFERENCES = Object.freeze([
  "docs/project/linie/ui/KREILE_STARTSEITE_PHILLIP_V4_2026-08-20.html",
  "docs/project/linie/ui/KREILE_STARTSEITE_ROLF_V8_2026-08-20.html",
  "docs/project/linie/ui/KREILE_AUFTRAGSKARTE_MACHART_V8_2026-08-19.html",
  "docs/project/linie/ui/KREILE_KUNDENKARTE_MACHART_V2_2026-08-19.html",
]);
const DESIGN_SYSTEM = Object.freeze({
  path: "docs/project/linie/ui/designsystem_v1_1",
  manifestPath: "docs/project/linie/ui/designsystem_v1_1/SHA256SUMS.txt",
  manifestSha256: "71B0CB01F484BEEF042CFD04D31F951D2DB2D441C427F8212F35A8D41A8041E5",
  role: "TOKENS_TYPOGRAPHY_COMPONENTS_RESPONSIVE",
  pageCompositionRole: "FOUR_UI_REFERENCES_ONLY",
  flowPath: "docs/project/linie/ui/KREILE_GESAMTMOCK_V5_2026-09-14.html",
  flowSha256: "75258FF3BD4CC212C8E989061708A29DC26EA44B851BD28E8F16E8509B0CC0AA",
  flowRole: "FLOW_AND_INTERMEDIATE_STEPS_ONLY",
});
const REQUIRED_DECISIONS = Object.freeze([
  "D-GOV-001",
  "D-ARCH-011",
  "D-UI-CORE-001",
  "D-UI-CORE-002",
  "D-UI-DS-001",
  "D-GOV-004",
]);
const ACTIVE_ENTRY_DOCS = Object.freeze([
  "AGENTS.md",
  "docs/project/DOCUMENT_AUTHORITY.md",
  "docs/project/MASTERPLAN.md",
  "docs/project/linie/00_ABC_INDEX.md",
  "docs/project/linie/00_BIBEL_INDEX.md",
  "docs/project/linie/00_JETZT_UND_LEITPLANKEN.md",
]);
const FORBIDDEN_ACTIVE_TOKENS = Object.freeze([
  "ROLLING_MANIFEST_QUEUE_V1",
  "KR-22R",
  "KR-00F-ROLLING-MANIFESTS",
  "PATH1_UI_CONVERGENCE_A",
  "KREILE_LIVE_TRAIN_V5",
  "kreile-package-plan.v4.proposed.json",
]);
const ACTIVE_SURFACE = Object.freeze({
  rootMarkdown: ["AGENTS.md", "CLAUDE.md", "README.md"],
  docsFiles: [],
  projectFiles: ["CURRENT_STATE.md", "DOCUMENT_AUTHORITY.md", "MASTERPLAN.md"],
  lineFiles: [
    "00_ABC_INDEX.md",
    "00_BIBEL_INDEX.md",
    "00_JETZT_UND_LEITPLANKEN.md",
    "00_UI_REFERENZEN_PFADE.md",
    "ARCHITEKTUR_MODULE_PATH1.md",
    "KREILE_LINIE_ENTSCHEIDUNGSREGISTER_2026-08-28.md",
    "MODULKARTE_KANON.md",
  ],
  uiFiles: [
    "CURRENT_DESIGN_REFERENCE.json",
    "KREILE_AUFTRAGSKARTE_MACHART_V8_2026-08-19.html",
    "KREILE_GESAMTMOCK_V5_2026-09-14.html",
    "KREILE_KUNDENKARTE_MACHART_V2_2026-08-19.html",
    "KREILE_STARTSEITE_PHILLIP_V4_2026-08-20.html",
    "KREILE_STARTSEITE_ROLF_V8_2026-08-20.html",
  ],
});

const absolute = (root, rel) => path.resolve(root, rel);
const sorted = (values) => [...values].sort();
const sameSet = (left, right) => {
  const a = sorted(left);
  const b = sorted(right);
  return a.length === b.length && a.every((value, index) => value === b[index]);
};

function hashFile(file) {
  return createHash("sha256").update(readFileSync(file)).digest("hex").toUpperCase();
}

export function checkAuthorityHashPins({ checkerBytes, schemaBytes, workflowText }) {
  const errors = [];
  const checkerPin = workflowText.match(/AUTHORITY_CHECKER_SHA256:\s*["']([0-9a-f]{64})["']/i)?.[1];
  const schemaPin = workflowText.match(/AUTHORITY_SCHEMA_SHA256:\s*["']([0-9a-f]{64})["']/i)?.[1];
  if (!checkerPin) errors.push("AUTHORITY_CHECKER_PIN_MISSING");
  if (!schemaPin) errors.push("AUTHORITY_SCHEMA_PIN_MISSING");
  const checkerHash = createHash("sha256").update(checkerBytes).digest("hex");
  const schemaHash = createHash("sha256").update(schemaBytes).digest("hex");
  if (checkerPin && checkerPin.toLowerCase() !== checkerHash) errors.push(`AUTHORITY_CHECKER_PIN_MISMATCH:${checkerHash}`);
  if (schemaPin && schemaPin.toLowerCase() !== schemaHash) errors.push(`AUTHORITY_SCHEMA_PIN_MISMATCH:${schemaHash}`);
  return errors;
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

function validateConfigShape(config, errors) {
  if (!config || typeof config !== "object" || Array.isArray(config)) {
    errors.push("AUTHORITY_CONFIG_NOT_OBJECT");
    return;
  }
  const expectedKeys = ["designSystem", "schemaVersion", "truthTypes", "uiReferences"];
  if (!sameSet(Object.keys(config), expectedKeys)) errors.push(`AUTHORITY_CONFIG_CLOSED_SCHEMA:${Object.keys(config).sort().join(",")}`);
  if (config.schemaVersion !== 4) errors.push("AUTHORITY_CONFIG_SCHEMA_VERSION");

  const truthTypes = Array.isArray(config.truthTypes) ? config.truthTypes : [];
  if (truthTypes.length !== Object.keys(TRUTH_SOURCE_CONTRACT).length) errors.push(`TRUTH_TYPE_TOTAL:${truthTypes.length}`);
  const ids = [];
  const sources = [];
  for (const entry of truthTypes) {
    if (!entry || !sameSet(Object.keys(entry), ["id", "source"])) {
      errors.push(`TRUTH_TYPE_SCHEMA:${entry?.id ?? "UNKNOWN"}`);
      continue;
    }
    ids.push(entry.id);
    sources.push(entry.source);
    if (TRUTH_SOURCE_CONTRACT[entry.id] !== entry.source) errors.push(`TRUTH_SOURCE_CONTRACT:${entry.id}`);
  }
  if (new Set(ids).size !== ids.length) errors.push("TRUTH_TYPE_DUPLICATE_ID");
  if (new Set(sources).size !== sources.length) errors.push("TRUTH_SOURCE_REUSED");
  for (const id of Object.keys(TRUTH_SOURCE_CONTRACT)) {
    if (ids.filter((value) => value === id).length !== 1) errors.push(`TRUTH_TYPE_COUNT:${id}`);
  }
  if (!sameSet(config.uiReferences ?? [], UI_REFERENCES)) errors.push("UI_REFERENCE_CONFIG_CONTRACT");
  if (JSON.stringify(config.designSystem) !== JSON.stringify(DESIGN_SYSTEM)) errors.push("DESIGN_SYSTEM_CONFIG_CONTRACT");
}

function validateDecisionAndUiTruth(root, errors) {
  const decisionPath = TRUTH_SOURCE_CONTRACT.product_decisions;
  const decision = readFileSync(absolute(root, decisionPath), "utf8");
  const ids = [...decision.matchAll(/^##\s+(D-[A-Z0-9-]+)\b/gm)].map((match) => match[1]);
  for (const id of new Set(ids)) if (ids.filter((value) => value === id).length !== 1) errors.push(`DECISION_ID_DUPLICATE:${id}`);
  for (const id of REQUIRED_DECISIONS) if (ids.filter((value) => value === id).length !== 1) errors.push(`REQUIRED_DECISION_COUNT:${id}`);

  const uiIndex = readFileSync(absolute(root, TRUTH_SOURCE_CONTRACT.ui_truth), "utf8");
  for (const rel of UI_REFERENCES) if (!uiIndex.includes(path.basename(rel))) errors.push(`UI_INDEX_REFERENCE_MISSING:${rel}`);
  for (const token of [DESIGN_SYSTEM.path, DESIGN_SYSTEM.role, DESIGN_SYSTEM.flowRole, "V1.1"]) {
    if (!uiIndex.includes(token)) errors.push(`UI_INDEX_LAYER_MISSING:${token}`);
  }

  const pointer = readJson(root, "docs/project/linie/ui/CURRENT_DESIGN_REFERENCE.json", errors, "DESIGN_POINTER");
  if (pointer) {
    if (pointer.designSystem?.path !== DESIGN_SYSTEM.path
      || pointer.designSystem?.manifestPath !== DESIGN_SYSTEM.manifestPath
      || pointer.designSystem?.manifestSha256 !== DESIGN_SYSTEM.manifestSha256
      || pointer.designSystem?.role !== DESIGN_SYSTEM.role) errors.push("DESIGN_POINTER_SYSTEM_BINDING");
    if (pointer.current?.path !== DESIGN_SYSTEM.flowPath
      || pointer.current?.sha256 !== DESIGN_SYSTEM.flowSha256
      || pointer.current?.role !== DESIGN_SYSTEM.flowRole) errors.push("DESIGN_POINTER_FLOW_BINDING");
    if (!sameSet(pointer.pageTruth ?? [], UI_REFERENCES)) errors.push("DESIGN_POINTER_PAGE_BINDING");
  }
}

function validateActiveEntryDocs(root, errors) {
  for (const rel of ACTIVE_ENTRY_DOCS) {
    const file = absolute(root, rel);
    if (!existsSync(file)) {
      errors.push(`ACTIVE_ENTRY_MISSING:${rel}`);
      continue;
    }
    const text = readFileSync(file, "utf8");
    if (rel === "AGENTS.md" && !text.includes("docs/delivery/KREILE_VERKAUFSSTUFE_1.md")) {
      errors.push(`ACTIVE_ENTRY_PLAN_POINTER_MISSING:${rel}`);
    }
    for (const token of FORBIDDEN_ACTIVE_TOKENS) if (text.includes(token)) errors.push(`ACTIVE_ENTRY_LEGACY_TOKEN:${rel}:${token}`);
  }
}

function directFiles(root, rel, predicate = () => true) {
  const directory = absolute(root, rel);
  if (!existsSync(directory)) return [];
  return readdirSync(directory, { withFileTypes: true })
    .filter((entry) => entry.isFile() && predicate(entry.name))
    .map((entry) => entry.name);
}

function recursiveFileCount(root, rel) {
  const directory = absolute(root, rel);
  if (!existsSync(directory)) return 0;
  return readdirSync(directory, { recursive: true, withFileTypes: true }).filter((entry) => entry.isFile()).length;
}

function recursiveFiles(root, rel) {
  const directory = absolute(root, rel);
  if (!existsSync(directory)) return [];
  const files = [];
  const visit = (current) => {
    for (const entry of readdirSync(current, { withFileTypes: true })) {
      const full = path.join(current, entry.name);
      if (entry.isDirectory()) visit(full);
      else if (entry.isFile()) files.push(path.relative(directory, full).replaceAll("\\", "/"));
    }
  };
  visit(directory);
  return files.sort();
}

function validateAuthorityPins(root, errors) {
  const files = [AUTHORITY_CHECKER_PATH, CONFIG_PATH, RATCHET_WORKFLOW_PATH];
  for (const rel of files) {
    if (!existsSync(absolute(root, rel))) errors.push(`AUTHORITY_PIN_SOURCE_MISSING:${rel}`);
  }
  if (files.some((rel) => !existsSync(absolute(root, rel)))) return;
  errors.push(...checkAuthorityHashPins({
    checkerBytes: readFileSync(absolute(root, AUTHORITY_CHECKER_PATH)),
    schemaBytes: readFileSync(absolute(root, CONFIG_PATH)),
    workflowText: readFileSync(absolute(root, RATCHET_WORKFLOW_PATH), "utf8"),
  }));
}

function validateActiveSurface(root, errors) {
  if (!sameSet(directFiles(root, ".", (name) => name.endsWith(".md")), ACTIVE_SURFACE.rootMarkdown)) errors.push("ACTIVE_ROOT_MARKDOWN_SURFACE");
  if (!sameSet(directFiles(root, "docs"), ACTIVE_SURFACE.docsFiles)) errors.push("ACTIVE_DOCS_ROOT_SURFACE");
  if (!sameSet(directFiles(root, "docs/project"), ACTIVE_SURFACE.projectFiles)) errors.push("ACTIVE_PROJECT_SURFACE");
  if (!sameSet(directFiles(root, "docs/project/linie"), ACTIVE_SURFACE.lineFiles)) errors.push("ACTIVE_LINE_SURFACE");
  if (!sameSet(directFiles(root, "docs/project/linie/ui"), ACTIVE_SURFACE.uiFiles)) errors.push("ACTIVE_UI_SURFACE");
  const deliveryFiles = recursiveFiles(root, "docs/delivery");
  for (const rel of deliveryFiles) {
    if (!["KREILE_LIVE_PLAN_V1.json", "KREILE_VERKAUFSSTUFE_1.md", "AENDERUNGEN_B1.md"].includes(rel)
        && !/^amendments\/KR-AMEND-\d{4}\.json$/.test(rel)) {
      errors.push(`ACTIVE_DELIVERY_SURFACE:${rel}`);
    }
  }
  if (!deliveryFiles.includes("KREILE_VERKAUFSSTUFE_1.md")) errors.push("ACTIVE_DELIVERY_PLAN_MISSING");
  if (!sameSet(recursiveFiles(root, "missions"), ["F1_ORDER_TO_CASH_PILOT_001.yml"])) errors.push("ACTIVE_MISSION_SURFACE");
  for (const rel of [
    "scripts/quality/resolve-delivery-trust-anchor.mjs",
    "scripts/quality/check-f0-independent-review-package.mjs",
  ]) {
    if (existsSync(absolute(root, rel))) errors.push(`ACTIVE_LEGACY_CONTROL_SCRIPT:${rel}`);
  }
  if (recursiveFileCount(root, "docs/module") !== 0) errors.push("ACTIVE_LEGACY_MODULE_FILES");
  if (recursiveFileCount(root, "docs/project/history/legacy-sources/2026-10-11") < 277) errors.push("LEGACY_ARCHIVE_INCOMPLETE");
}

export function checkAuthorityRepository(root = process.cwd(), configRel = CONFIG_PATH) {
  const errors = [];
  const config = readJson(root, configRel, errors, "AUTHORITY_CONFIG");
  if (!config) return errors;
  validateConfigShape(config, errors);
  for (const source of Object.values(TRUTH_SOURCE_CONTRACT)) if (!existsSync(absolute(root, source))) errors.push(`TRUTH_SOURCE_PATH_MISSING:${source}`);
  for (const rel of UI_REFERENCES) if (!existsSync(absolute(root, rel))) errors.push(`UI_REFERENCE_PATH_MISSING:${rel}`);
  if (existsSync(absolute(root, DESIGN_SYSTEM.manifestPath))
      && hashFile(absolute(root, DESIGN_SYSTEM.manifestPath)) !== DESIGN_SYSTEM.manifestSha256) errors.push("DESIGN_SYSTEM_MANIFEST_HASH");
  validateDecisionAndUiTruth(root, errors);
  validateActiveEntryDocs(root, errors);
  validateActiveSurface(root, errors);
  validateAuthorityPins(root, errors);
  for (const error of checkDeliveryRepository(root)) errors.push(`DELIVERY:${error}`);
  if (!existsSync(absolute(root, "docs/project/history/controls/2026-10-11/check-authoritative-sources.legacy-2026-10-11.mjs.txt"))) {
    errors.push("AUTHORITY_LEGACY_ARCHIVE_MISSING");
  }
  return errors;
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function expectConfigMutation(config, mutate, code) {
  const changed = clone(config);
  mutate(changed);
  const errors = [];
  validateConfigShape(changed, errors);
  if (!errors.some((error) => error.startsWith(code))) throw new Error(`selftest did not fail closed: ${code}; got ${errors.join(" | ")}`);
}

export function runSelftest(root = process.cwd()) {
  const config = JSON.parse(readFileSync(absolute(root, CONFIG_PATH), "utf8"));
  const errors = [];
  validateConfigShape(config, errors);
  if (errors.length > 0) throw new Error(`selftest baseline invalid: ${errors.join(" | ")}`);
  expectConfigMutation(config, (value) => { value.truthTypes.push({ id: "shadow", source: "shadow.md" }); }, "TRUTH_TYPE_TOTAL");
  expectConfigMutation(config, (value) => { value.truthTypes[0].source = "docs/project/CURRENT_STATE.md"; }, "TRUTH_SOURCE_CONTRACT");
  expectConfigMutation(config, (value) => { value.designSystem.role = "PAGE_COMPOSITION"; }, "DESIGN_SYSTEM_CONFIG_CONTRACT");
  expectConfigMutation(config, (value) => { value.uiReferences.pop(); }, "UI_REFERENCE_CONFIG_CONTRACT");
  expectConfigMutation(config, (value) => { value.schemaVersion = 2; }, "AUTHORITY_CONFIG_SCHEMA_VERSION");
  return true;
}

function parseArgs(argv) {
  const args = { root: process.cwd(), config: CONFIG_PATH, selftest: false };
  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index];
    if (value === "--root") args.root = path.resolve(argv[++index]);
    else if (value === "--config") args.config = argv[++index];
    else if (value === "--selftest") args.selftest = true;
    else if (value !== "--check") throw new Error(`Unknown argument: ${value}`);
  }
  return args;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.selftest) {
    runSelftest(args.root);
    console.log("AUTHORITY_GATE_SELFTEST=PASS");
    return;
  }
  const errors = checkAuthorityRepository(args.root, args.config);
  if (errors.length > 0) {
    errors.forEach((error) => console.error(error));
    process.exitCode = 1;
    return;
  }
  console.log(`AUTHORITY_GATE=PASS truth_types=${Object.keys(TRUTH_SOURCE_CONTRACT).length} ui_references=${UI_REFERENCES.length} design=V1.1`);
}

if (import.meta.url === pathToFileURL(path.resolve(process.argv[1] ?? "")).href) await main();
