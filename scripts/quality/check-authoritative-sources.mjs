import {
  cpSync,
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
const REQUIRED_TRUTH_TYPES = [
  "project_rules",
  "product_decisions",
  "scope_modules",
  "architecture",
  "active_execution",
  "delivered_main",
  "ui_truth",
];

const posix = (value) => value.replaceAll("\\", "/");
const read = (root, rel) => readFileSync(path.join(root, rel), "utf8");
const exists = (root, rel) => existsSync(path.join(root, rel));

function parseJson(root, rel, errors, code) {
  if (!exists(root, rel)) {
    errors.push(`${code}_PATH_MISSING:${rel}`);
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

function directMarkdownFiles(root, relDir) {
  const abs = path.join(root, relDir);
  if (!existsSync(abs)) return [];
  return readdirSync(abs, { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.toLowerCase().endsWith(".md"))
    .map((entry) => posix(path.join(relDir, entry.name)).replace(/^\.\//, ""));
}

export function checkAuthorityRepository(root = process.cwd(), configRel = DEFAULT_CONFIG) {
  const errors = [];
  const config = parseJson(root, configRel, errors, "AUTHORITY_CONFIG");
  if (!config) return errors;
  if (config.schemaVersion !== 1) errors.push("AUTHORITY_CONFIG_SCHEMA_VERSION");

  const truthTypes = Array.isArray(config.truthTypes) ? config.truthTypes : [];
  const ids = truthTypes.map((entry) => entry?.id);
  for (const id of REQUIRED_TRUTH_TYPES) {
    if (ids.filter((value) => value === id).length !== 1) errors.push(`TRUTH_TYPE_COUNT:${id}`);
  }
  if (new Set(ids).size !== ids.length) errors.push("TRUTH_TYPE_DUPLICATE_ID");
  const sources = [];
  for (const entry of truthTypes) {
    if (!entry || typeof entry.source !== "string" || !entry.source) {
      errors.push(`TRUTH_SOURCE_NOT_SINGLE:${entry?.id ?? "UNKNOWN"}`);
      continue;
    }
    sources.push(entry.source);
    if (!exists(root, entry.source)) errors.push(`TRUTH_SOURCE_PATH_MISSING:${entry.source}`);
  }
  if (new Set(sources).size !== sources.length) errors.push("TRUTH_SOURCE_REUSED");

  for (const rel of config.uiReferences ?? []) {
    if (!exists(root, rel)) errors.push(`UI_REFERENCE_PATH_MISSING:${rel}`);
  }
  for (const rel of config.pointerDocuments ?? []) {
    if (!exists(root, rel)) errors.push(`POINTER_PATH_MISSING:${rel}`);
  }
  for (const item of config.historicalDocuments ?? []) {
    if (!item || typeof item.path !== "string" || !exists(root, item.path)) {
      errors.push(`HISTORICAL_PATH_MISSING:${item?.path ?? "UNKNOWN"}`);
      continue;
    }
    if (!new Set(["HISTORICAL_NON_AUTHORITATIVE", "REFERENCE_ONLY_NON_EXECUTABLE"]).has(item.status)) {
      errors.push(`HISTORICAL_STATUS_INVALID:${item.path}`);
    }
    if (item.bannerRequired) {
      const head = read(root, item.path).split(/\r?\n/).slice(0, 3).join("\n");
      if (!head.includes(`STATUS: ${item.status}`) || !head.includes("CANONICAL_ENTRY: docs/project/DOCUMENT_AUTHORITY.md")) {
        errors.push(`HISTORICAL_BANNER_MISSING:${item.path}`);
      }
    }
  }

  const decisionSource = truthTypes.find((entry) => entry.id === "product_decisions")?.source;
  if (typeof decisionSource === "string" && exists(root, decisionSource)) {
    const headings = [...read(root, decisionSource).matchAll(/^##\s+(D-[A-Z0-9-]+)\b/gm)].map((match) => match[1]);
    const counts = new Map();
    for (const id of headings) counts.set(id, (counts.get(id) ?? 0) + 1);
    for (const [id, count] of counts) if (count > 1) errors.push(`DECISION_ID_DUPLICATE:${id}`);
    for (const id of config.governanceDecisions ?? []) {
      if ((counts.get(id) ?? 0) !== 1) errors.push(`DECISION_ID_COUNT:${id}:${counts.get(id) ?? 0}`);
    }
  }

  const active = config.activeExecution ?? {};
  if (typeof active.mission === "string" && exists(root, active.mission)) {
    const mission = read(root, active.mission);
    const expected = [
      ["mission_id", active.expectedMissionId],
      ["branch", active.expectedBranch],
      ["base_sha", active.expectedBaseSha],
      ["active_package", active.expectedActivePackage],
      ["next_gate_after_active_package", active.expectedNextGate],
    ];
    for (const [key, value] of expected) {
      if (yamlScalar(mission, key, errors) !== value) errors.push(`ACTIVE_EXECUTION_MISMATCH:${key}`);
    }
  } else {
    errors.push(`ACTIVE_MISSION_PATH_MISSING:${active.mission ?? "UNKNOWN"}`);
  }

  const missionsDir = path.join(root, "missions");
  const activeMissions = existsSync(missionsDir)
    ? readdirSync(missionsDir, { withFileTypes: true })
        .filter((entry) => entry.isFile() && /\.ya?ml$/i.test(entry.name))
        .filter((entry) => /^status:\s*active\s*$/m.test(readFileSync(path.join(missionsDir, entry.name), "utf8")))
    : [];
  if (activeMissions.length !== 1) errors.push(`ACTIVE_MISSION_COUNT:${activeMissions.length}`);

  const forbiddenExecutionKeys = /^(?:branch|base_sha|active_package|next_gate_after_active_package):\s*/m;
  for (const rel of config.pointerDocuments ?? []) {
    if (exists(root, rel) && forbiddenExecutionKeys.test(read(root, rel))) errors.push(`POINTER_ACTIVE_EXECUTION:${rel}`);
  }
  if (typeof active.currentState === "string" && exists(root, active.currentState)) {
    const current = read(root, active.currentState);
    if (!current.includes(active.expectedMainSha)) errors.push("CURRENT_STATE_MAIN_SHA_MISSING");
    for (const value of active.forbiddenCurrentStateRefs ?? []) {
      if (current.includes(value)) errors.push(`CURRENT_STATE_CANDIDATE_LEAK:${value}`);
    }
  }

  const knownDocs = new Set([
    ...sources,
    ...(config.pointerDocuments ?? []),
    ...(config.historicalDocuments ?? []).map((item) => item.path),
    config.providerPolicy?.matrix,
  ].filter(Boolean));
  for (const dir of config.steeringScanDirectories ?? []) {
    for (const rel of directMarkdownFiles(root, dir)) {
      if (!knownDocs.has(rel)) errors.push(`UNCLASSIFIED_STEERING_DOCUMENT:${rel}`);
    }
  }

  const provider = config.providerPolicy ?? {};
  const matrix = typeof provider.matrix === "string" && exists(root, provider.matrix) ? read(root, provider.matrix) : "";
  const registry = parseJson(root, provider.registry, errors, "CAPABILITY_REGISTRY");
  if (registry && Array.isArray(registry.capabilities)) {
    const requiredIds = registry.capabilities
      .filter((item) => (item.kind === "PAGE_ROUTE" && item.visible === true) || item.kind === "PROVIDER_CONNECTION")
      .map((item) => item.stable_id);
    for (const id of requiredIds) if (!matrix.includes(`\`${id}\``)) errors.push(`PROVIDER_MATRIX_CAPABILITY_MISSING:${id}`);
  }
  for (const id of provider.requiredModuleIds ?? []) {
    if (!matrix.includes(`\`${id}\``)) errors.push(`PROVIDER_MATRIX_MODULE_MISSING:${id}`);
  }
  if (provider.calendarTarget !== "Microsoft 365/Graph") errors.push("CALENDAR_TARGET_NOT_M365_GRAPH");
  if (provider.calendarState !== "NOT_STARTED_BLOCKED_EXTERNAL_PERMISSION") errors.push("CALENDAR_STATE_NOT_BLOCKED_EXTERNAL");
  if (provider.calendarAccessModel !== "DELEGATED_NAMED_OFFICE_USER") errors.push("CALENDAR_ACCESS_MODEL_INVALID");
  if (provider.legacyCalendarStatus !== "QUARANTINE") errors.push("LEGACY_GOOGLE_CALENDAR_ACTIVE");
  if (!exists(root, provider.legacyCalendarFinding ?? "")) errors.push("LEGACY_CALENDAR_FINDING_MISSING");
  const googleLines = matrix.split(/\r?\n/).filter((line) => /Google Kalender/i.test(line));
  if (googleLines.length === 0 || googleLines.some((line) => !/QUARANTINE/i.test(line))) errors.push("LEGACY_GOOGLE_CALENDAR_NOT_QUARANTINED");

  return errors;
}

function writeFixture(root) {
  const files = {
    "AGENTS.md": "# Rules\n",
    "decisions.md": "## D-GOV-001 — one\n## D-ARCH-011 — provider\n",
    "scope.md": "# Scope\n",
    "architecture.md": "# Architecture\n",
    "ui-index.md": "# UI\n",
    "ui/ref.html": "ok\n",
    "pointer.md": "# Pointer\n",
    "current.md": "main@aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa\n",
    "calendar.tsx": "Google Kalender vorbereitet\n",
    "registry.json": JSON.stringify({ capabilities: [
      { stable_id: "page.real", kind: "PAGE_ROUTE", visible: true },
      { stable_id: "provider.real", kind: "PROVIDER_CONNECTION" },
    ] }),
    "matrix.md": "`module.one` REAL\n`page.real` REAL\n`provider.real` REAL\nGoogle Kalender QUARANTINE\n",
    "missions/main.yml": "mission_id: M\nstatus: active\nbase_sha: aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa\nbranch: gov\nactive_package: GOV\nnext_gate_after_active_package: REVIEW\n",
  };
  for (const [rel, content] of Object.entries(files)) {
    mkdirSync(path.dirname(path.join(root, rel)), { recursive: true });
    writeFileSync(path.join(root, rel), content, "utf8");
  }
  const config = {
    schemaVersion: 1,
    governanceDecisions: ["D-GOV-001", "D-ARCH-011"],
    truthTypes: [
      ["project_rules", "AGENTS.md"], ["product_decisions", "decisions.md"],
      ["scope_modules", "scope.md"], ["architecture", "architecture.md"],
      ["active_execution", "missions/main.yml"], ["delivered_main", "current.md"],
      ["ui_truth", "ui-index.md"],
    ].map(([id, source]) => ({ id, source })),
    uiReferences: ["ui/ref.html"],
    pointerDocuments: ["pointer.md"],
    historicalDocuments: [],
    steeringScanDirectories: ["."],
    activeExecution: {
      mission: "missions/main.yml", expectedMissionId: "M", expectedBranch: "gov",
      expectedBaseSha: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa", expectedActivePackage: "GOV",
      expectedNextGate: "REVIEW", currentState: "current.md",
      expectedMainSha: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa", forbiddenCurrentStateRefs: ["candidate"],
    },
    providerPolicy: {
      matrix: "matrix.md", registry: "registry.json", requiredModuleIds: ["module.one"],
      calendarTarget: "Microsoft 365/Graph", calendarState: "NOT_STARTED_BLOCKED_EXTERNAL_PERMISSION",
      calendarAccessModel: "DELEGATED_NAMED_OFFICE_USER", legacyCalendarProvider: "Google Kalender",
      legacyCalendarStatus: "QUARANTINE", legacyCalendarFinding: "calendar.tsx",
    },
  };
  mkdirSync(path.join(root, "quality"), { recursive: true });
  writeFileSync(path.join(root, DEFAULT_CONFIG), JSON.stringify(config, null, 2), "utf8");
}

export function runAuthoritySelftest() {
  const cases = [
    ["missing-source", (root) => rmSync(path.join(root, "AGENTS.md")), "TRUTH_SOURCE_PATH_MISSING"],
    ["multiple-source", (root) => {
      const p = path.join(root, DEFAULT_CONFIG); const c = JSON.parse(readFileSync(p, "utf8"));
      c.truthTypes[0].source = ["AGENTS.md", "scope.md"]; writeFileSync(p, JSON.stringify(c), "utf8");
    }, "TRUTH_SOURCE_NOT_SINGLE"],
    ["missing-path", (root) => rmSync(path.join(root, "ui", "ref.html")), "UI_REFERENCE_PATH_MISSING"],
    ["duplicate-decision", (root) => writeFileSync(path.join(root, "decisions.md"), "## D-GOV-001 — one\n## D-GOV-001 — two\n## D-ARCH-011 — provider\n"), "DECISION_ID_DUPLICATE"],
    ["two-active-missions", (root) => cpSync(path.join(root, "missions", "main.yml"), path.join(root, "missions", "second.yml")), "ACTIVE_MISSION_COUNT"],
    ["two-active-packages", (root) => {
      const p = path.join(root, "missions", "main.yml");
      writeFileSync(p, `${readFileSync(p, "utf8")}active_package: SHADOW\n`, "utf8");
    }, "ACTIVE_EXECUTION_KEY_COUNT:active_package"],
    ["pointer-conflict", (root) => writeFileSync(path.join(root, "pointer.md"), "branch: shadow\n"), "POINTER_ACTIVE_EXECUTION"],
    ["current-conflict", (root) => writeFileSync(path.join(root, "current.md"), "main@aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa candidate\n"), "CURRENT_STATE_CANDIDATE_LEAK"],
    ["unclassified-steering", (root) => writeFileSync(path.join(root, "rogue.md"), "MAIN_HANDOFF build now\n"), "UNCLASSIFIED_STEERING_DOCUMENT"],
    ["active-google-calendar", (root) => {
      const p = path.join(root, DEFAULT_CONFIG); const c = JSON.parse(readFileSync(p, "utf8"));
      c.providerPolicy.legacyCalendarStatus = "PENDING"; writeFileSync(p, JSON.stringify(c), "utf8");
    }, "LEGACY_GOOGLE_CALENDAR_ACTIVE"],
  ];
  let passed = 0;
  for (const [name, mutate, expected] of cases) {
    const root = mkdtempSync(path.join(os.tmpdir(), "kreile-authority-"));
    try {
      writeFixture(root);
      const baseline = checkAuthorityRepository(root);
      if (baseline.length) throw new Error(`${name}: fixture invalid: ${baseline.join(" | ")}`);
      mutate(root);
      const errors = checkAuthorityRepository(root);
      if (!errors.some((error) => error.startsWith(expected))) throw new Error(`${name}: expected ${expected}, got ${errors.join(" | ")}`);
      passed += 1;
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  }
  return { passed, total: cases.length };
}

function cli() {
  const args = process.argv.slice(2);
  if (args.includes("--selftest")) {
    const result = runAuthoritySelftest();
    console.log(`AUTHORITY_GATE_SELFTEST=PASS cases=${result.passed}/${result.total}`);
    return;
  }
  const rootIndex = args.indexOf("--root");
  const configIndex = args.indexOf("--config");
  const root = rootIndex >= 0 ? path.resolve(args[rootIndex + 1]) : process.cwd();
  const config = configIndex >= 0 ? args[configIndex + 1] : DEFAULT_CONFIG;
  const errors = checkAuthorityRepository(root, config);
  if (errors.length) {
    for (const error of errors) console.error(`AUTHORITY_GATE_ERROR:${error}`);
    console.error(`AUTHORITY_GATE=FAIL findings=${errors.length}`);
    process.exitCode = 1;
    return;
  }
  console.log(`AUTHORITY_GATE=PASS truth_types=${REQUIRED_TRUTH_TYPES.length}`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) cli();
