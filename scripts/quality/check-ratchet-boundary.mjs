// Static ratchet boundary (KR A1, D-QA-001). The protected pull_request_target
// workflow runs the base copy of this file before any step that executes a
// candidate-located file. It compares base and candidate Git objects, binds the
// candidate data roots on disk to their Git blobs and never imports, installs or
// executes candidate files. Judge files stay byte-identical to the base unless the
// protected base mission preauthorizes their exact successor bytes (two-phase judge
// migration). On success it emits the verified delivery judge bytes, which the next
// protected step runs against the candidate data.

import { execFileSync, spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
  existsSync,
  lstatSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  realpathSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import yaml from "js-yaml";

const SHA_PATTERN = /^[0-9a-f]{40}$/;
const SHA256_PATTERN = /^[0-9A-F]{64}$/;
const REPOSITORY_PATTERN = /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/;
const REASON_PATTERN = /^[A-Z0-9_]{8,160}$/;
const RESERVED_PATH_CHARACTERS = /[\\:<>"|?*]/;
const GIT_ENV = Object.freeze({ GIT_NO_REPLACE_OBJECTS: "1", GIT_LITERAL_PATHSPECS: "1", GIT_TERMINAL_PROMPT: "0" });
const POLICY_PATH = "quality/ratchet-boundary.json";
const SCHEMA_PATH = "quality/ratchet-boundary.schema.json";
const WORKFLOW_PATH = ".github/workflows/eslint-ratchet.yml";
const MISSION_PATH = "missions/F1_ORDER_TO_CASH_PILOT_001.yml";
const DELIVERY_JUDGE_PATH = "scripts/quality/check-delivery-contracts.mjs";
const REGISTER_KEY = "judge_migration_preauthorizations";
const REGISTER_ENTRY_KEYS = Object.freeze(["path", "replaces_sha256", "successor_sha256", "reason"]);

export const JUDGE_PATHS = Object.freeze([
  ".github/workflows/eslint-ratchet.yml",
  "docs/delivery/EXACT_SHA_CLOSURE_RECEIPT_SCHEMA_V1.json",
  "docs/delivery/FINDINGS_LEDGER_SCHEMA_V1.json",
  "docs/delivery/KR-01_BRANCH_PROTECTION_AND_OPERATING_RECEIPT_SCHEMA_V1.json",
  "docs/delivery/ROLLING_MANIFEST_QUEUE_SCHEMA_V1.json",
  "docs/delivery/packages/PACKAGE_MANIFEST_SCHEMA_V2.json",
  "quality/ratchet-boundary.json",
  "quality/ratchet-boundary.schema.json",
  "scripts/quality/check-delivery-contracts.mjs",
  "scripts/quality/check-ratchet-boundary.mjs",
]);
export const DATA_ROOTS = Object.freeze(["docs/delivery", "missions", "src"]);

export const EXPECTED_POLICY = Object.freeze({
  schema_version: 1,
  contract_id: "KREILE_STATIC_RATCHET_BOUNDARY_V1",
  authority: "D-QA-001",
  judge_paths: JUDGE_PATHS,
  data_roots: DATA_ROOTS,
  path_hygiene: "ASCII_ONLY_NO_RESERVED_CHARACTERS_TRAVERSAL_DOT_GIT_CASE_OR_TRAILING_DOT_ALIASES_SYMLINKS_OR_GITLINKS",
  identity: "SAME_REPOSITORY_EXACT_EVENT_BASE_AND_HEAD_SHA_CANDIDATE_DESCENDS_FROM_EVENT_BASE",
  delivery_judge: Object.freeze({
    path: DELIVERY_JUDGE_PATH,
    source: "VERIFIED_CANDIDATE_GIT_BLOB_BASE_IDENTICAL_OR_EXACT_BASE_PREAUTHORIZED_SUCCESSOR",
  }),
  judge_migration: Object.freeze({
    mode: "TWO_PHASE_BASE_PREAUTHORIZED_EXACT_SHA256",
    register_path: MISSION_PATH,
    register_key: `execution_program_20260928.${REGISTER_KEY}`,
    entry_keys: REGISTER_ENTRY_KEYS,
    register_entries: "LIVE_ONLY_REPLACES_SHA256_EQUALS_CURRENT_CANDIDATE_BYTES",
  }),
  step_execution: Object.freeze({
    boundary: "PROTECTED_BASE_CODE_ONLY",
    delivery: "EMITTED_DELIVERY_JUDGE_ON_CANDIDATE_DATA",
    authority: "CANDIDATE_FILE_ONLY_AFTER_BASE_PINNED_SHA256_MATCH",
    module_gates: "PROTECTED_BASE_CODE_ONLY",
    eslint_ratchet: "LAST_STEP_LOADS_CANDIDATE_ESLINT_CONFIG",
  }),
});

const BOUNDARY_ARGUMENTS = Object.freeze([
  "--base-root",
  "--candidate-root",
  "--base-sha",
  "--candidate-sha",
  "--repository",
  "--base-repository",
  "--candidate-repository",
]);
const OPTIONAL_ARGUMENTS = Object.freeze(["--delivery-judge-out"]);
const PROTECTED_STEP_ORDER = Object.freeze([
  ["checkoutBase", "Checkout protected base"],
  ["checkoutCandidate", "Checkout candidate without credentials"],
  ["nodeVersion", "Determine protected Node version"],
  ["setupNode", "Setup protected Node"],
  ["install", "Install protected lint dependencies"],
  ["boundary", "Enforce protected static ratchet boundary"],
  ["delivery", "Enforce protected delivery contracts on candidate data"],
  ["authority", "Enforce D-GOV-001 authority contract on candidate"],
  ["moduleGates", "Enforce protected S1 module gates (Path 1 Naehte)"],
  ["eslint", "Enforce protected repository ratchet"],
]);
const BOUNDARY_ENV = Object.freeze({
  RATCHET_BASE_SHA: "${{ github.event.pull_request.base.sha }}",
  RATCHET_CANDIDATE_SHA: "${{ github.event.pull_request.head.sha }}",
  RATCHET_REPOSITORY: "${{ github.repository }}",
  RATCHET_BASE_REPOSITORY: "${{ github.event.pull_request.base.repo.full_name }}",
  RATCHET_CANDIDATE_REPOSITORY: "${{ github.event.pull_request.head.repo.full_name }}",
});
const DELIVERY_ENV = Object.freeze({
  GIT_NO_REPLACE_OBJECTS: "1",
  DELIVERY_REQUIRE_TRUSTED_BASE: "true",
  DELIVERY_TRUSTED_BASE_SHA: "${{ github.event.pull_request.base.sha }}",
  DELIVERY_TRUSTED_REPO: "${{ github.workspace }}/ratchet-base",
});
const BOUNDARY_RUN = Object.freeze([
  "set -euo pipefail",
  "node scripts/quality/check-ratchet-boundary.mjs --selftest",
  [
    "node scripts/quality/check-ratchet-boundary.mjs",
    '--base-root "$GITHUB_WORKSPACE/ratchet-base"',
    '--candidate-root "$GITHUB_WORKSPACE/candidate"',
    '--base-sha "$RATCHET_BASE_SHA"',
    '--candidate-sha "$RATCHET_CANDIDATE_SHA"',
    '--repository "$RATCHET_REPOSITORY"',
    '--base-repository "$RATCHET_BASE_REPOSITORY"',
    '--candidate-repository "$RATCHET_CANDIDATE_REPOSITORY"',
    '--delivery-judge-out "$RUNNER_TEMP/kreile-delivery-judge/check-delivery-contracts.mjs"',
  ].join(" "),
]);
const DELIVERY_RUN = Object.freeze([
  "set -euo pipefail",
  'judge_dir="$RUNNER_TEMP/kreile-delivery-judge"',
  'test -f "$judge_dir/check-delivery-contracts.mjs"',
  'test ! -L "$judge_dir/check-delivery-contracts.mjs"',
  'test ! -e "$judge_dir/node_modules"',
  'ln -s "$GITHUB_WORKSPACE/ratchet-base/node_modules" "$judge_dir/node_modules"',
  'sha256sum "$judge_dir/check-delivery-contracts.mjs"',
  'node "$judge_dir/check-delivery-contracts.mjs" --selftest --root "$GITHUB_WORKSPACE/candidate"',
  'node "$judge_dir/check-delivery-contracts.mjs" --root "$GITHUB_WORKSPACE/candidate"',
]);

class BoundaryError extends Error {}

function fail(message) {
  throw new BoundaryError(message);
}

function canonicalJson(value) {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonicalJson(value[key])}`).join(",")}}`;
  }
  return JSON.stringify(value) ?? "undefined";
}

function sha256(bytes) {
  return createHash("sha256").update(bytes).digest("hex").toUpperCase();
}

function sameStringSet(actual, expected) {
  return (
    Array.isArray(actual) &&
    actual.every((value) => typeof value === "string") &&
    new Set(actual).size === actual.length &&
    [...actual].sort().join("\0") === [...expected].sort().join("\0")
  );
}

function isMapping(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function git(root, args, { encoding = "utf8", input } = {}) {
  try {
    return execFileSync("git", ["-C", root, ...args], {
      encoding,
      input,
      env: { ...process.env, ...GIT_ENV },
      maxBuffer: 64 * 1024 * 1024,
      stdio: [input === undefined ? "ignore" : "pipe", "pipe", "pipe"],
    });
  } catch (error) {
    const stderr = Buffer.isBuffer(error.stderr) ? error.stderr.toString("utf8") : String(error.stderr ?? "");
    fail(`Git command failed (git ${args.join(" ")}): ${stderr.trim() || error.message}`);
  }
}

export function expectedSchema() {
  return {
    $schema: "https://json-schema.org/draft/2020-12/schema",
    title: "Kreile static ratchet boundary policy",
    type: "object",
    additionalProperties: false,
    required: Object.keys(EXPECTED_POLICY),
    properties: Object.fromEntries(Object.entries(EXPECTED_POLICY).map(([key, value]) => [key, { const: value }])),
  };
}

export function policyFileFindings(policyBytes, schemaBytes) {
  const findings = [];
  for (const [bytes, expected, label] of [
    [policyBytes, EXPECTED_POLICY, "policy"],
    [schemaBytes, expectedSchema(), "policy schema"],
  ]) {
    let value;
    try {
      value = JSON.parse(Buffer.isBuffer(bytes) ? bytes.toString("utf8") : String(bytes));
    } catch (error) {
      findings.push(`${label} is not valid JSON (${error.message})`);
      continue;
    }
    if (canonicalJson(value) !== canonicalJson(expected)) findings.push(`${label} does not match the boundary contract`);
  }
  return findings;
}

function foldSegment(segment) {
  return segment.replace(/[. ]+$/, "").toLowerCase();
}

function foldPath(entryPath) {
  return entryPath.split("/").map(foldSegment).join("/");
}

export function pathSyntaxFindings(entryPath) {
  if (typeof entryPath !== "string" || entryPath.length === 0) return ["empty path"];
  const problems = new Set();
  if (!/^[\x20-\x7e]+$/.test(entryPath)) {
    problems.add("non-ASCII or control characters are not allowed (case/Unicode alias guard)");
  }
  if (RESERVED_PATH_CHARACTERS.test(entryPath)) problems.add("reserved path characters are not allowed");
  for (const segment of entryPath.split("/")) {
    if (segment === "" || foldSegment(segment) === "") {
      problems.add("empty, current or parent path segments are not allowed (traversal guard)");
    } else if (foldSegment(segment) === ".git" || /^git~[0-9]+$/i.test(segment)) {
      problems.add("reserved .git path segments are not allowed");
    }
  }
  return [...problems];
}

export function registerShapeFindings(value) {
  if (!Array.isArray(value)) return ["judge migration register must be a list"];
  const findings = [];
  const seen = new Set();
  value.forEach((entry, index) => {
    const label = `judge migration register[${index}]`;
    if (!isMapping(entry)) {
      findings.push(`${label} must be a mapping`);
      return;
    }
    if (!sameStringSet(Object.keys(entry), REGISTER_ENTRY_KEYS)) findings.push(`${label} keys must be exactly ${REGISTER_ENTRY_KEYS.join(", ")}`);
    if (!JUDGE_PATHS.includes(entry.path)) findings.push(`${label} path is not a judge path`);
    if (seen.has(entry.path)) findings.push(`${label} duplicates the pending migration for ${entry.path}`);
    seen.add(entry.path);
    for (const key of ["replaces_sha256", "successor_sha256"]) {
      if (typeof entry[key] !== "string" || !SHA256_PATTERN.test(entry[key])) findings.push(`${label} ${key} must be an uppercase SHA-256`);
    }
    if (entry.replaces_sha256 === entry.successor_sha256) findings.push(`${label} successor must differ from the replaced bytes`);
    if (typeof entry.reason !== "string" || !REASON_PATTERN.test(entry.reason)) findings.push(`${label} reason must be an uppercase token`);
  });
  return findings;
}

export function missionRegister(text) {
  let mission;
  try {
    mission = yaml.load(Buffer.isBuffer(text) ? text.toString("utf8") : String(text));
  } catch (error) {
    return { present: false, entries: [], problems: [`mission is not parseable YAML (${error.message})`] };
  }
  const program = isMapping(mission) ? mission.execution_program_20260928 : undefined;
  if (!isMapping(program) || !Object.prototype.hasOwnProperty.call(program, REGISTER_KEY)) {
    return { present: false, entries: [], problems: [] };
  }
  const problems = registerShapeFindings(program[REGISTER_KEY]);
  return { present: true, entries: problems.length > 0 ? [] : program[REGISTER_KEY], problems };
}

function runCommands(run) {
  return String(run ?? "")
    .replace(/\\\r?\n/g, " ")
    .split(/\r?\n/)
    .map((line) => line.trim().replace(/\s+/g, " "))
    .filter(Boolean);
}

function sameCommands(run, expected) {
  return canonicalJson(runCommands(run)) === canonicalJson([...expected]);
}

export function protectedWorkflowFindings(source) {
  let workflow = source;
  if (typeof source === "string" || Buffer.isBuffer(source)) {
    const text = String(source);
    if (/\$\{\{\s*secrets\./.test(text)) return ["protected workflow must not reference repository secrets"];
    try {
      workflow = yaml.load(text);
    } catch (error) {
      return [`protected workflow is not parseable YAML (${error.message})`];
    }
  }
  const findings = [];
  if (!isMapping(workflow) || !sameStringSet(Object.keys(workflow), ["name", "on", "permissions", "jobs"])) {
    return ["protected workflow must contain exactly name, on, permissions and jobs"];
  }
  const triggers = workflow.on;
  if (!isMapping(triggers) || Object.keys(triggers).join() !== "pull_request_target") {
    findings.push("protected workflow must be triggered only by pull_request_target");
  } else if (canonicalJson(triggers.pull_request_target?.branches) !== canonicalJson(["main"])) {
    findings.push("protected workflow must judge pull requests into main only");
  }
  if (canonicalJson(workflow.permissions) !== canonicalJson({ contents: "read" })) {
    findings.push("protected workflow permissions must be exactly contents: read");
  }
  const job = workflow.jobs?.ratchet;
  if (!isMapping(workflow.jobs) || Object.keys(workflow.jobs).join() !== "ratchet" || !isMapping(job)) {
    return [...findings, "protected workflow must define exactly the ratchet job"];
  }
  if (!sameStringSet(Object.keys(job), ["runs-on", "steps"]) || job["runs-on"] !== "ubuntu-latest") {
    findings.push("the ratchet job may only define runs-on: ubuntu-latest and steps (no job-level overrides)");
  }
  const steps = Array.isArray(job.steps) ? job.steps : [];
  const names = steps.map((step) => step?.name);
  if (canonicalJson(names) !== canonicalJson(PROTECTED_STEP_ORDER.map(([, name]) => name))) {
    return [
      ...findings,
      `protected workflow steps must be exactly, in order: ${PROTECTED_STEP_ORDER.map(([, name]) => name).join(" -> ")}`,
    ];
  }
  const step = Object.fromEntries(PROTECTED_STEP_ORDER.map(([key], index) => [key, steps[index]]));
  steps.forEach((entry) => {
    const label = `step '${entry.name}'`;
    if ("if" in entry || "continue-on-error" in entry) findings.push(`${label} must not be conditional or continue on error`);
    if ("shell" in entry && entry.shell !== "bash") findings.push(`${label} may only use the bash shell`);
    const run = typeof entry.run === "string" ? entry.run : "";
    if (run.includes("${{")) findings.push(`${label} must pass event values through env, not inline expressions`);
    if (/candidate\/scripts\/quality\/check-(?:delivery-contracts|ratchet-boundary)\.mjs/.test(run)) {
      findings.push(`${label} must not execute a candidate copy of a judge script`);
    }
    if (entry !== step.eslint && run.includes("candidate/node_modules")) {
      findings.push(`${label} must not prepare candidate module resolution; only the last ESLint step may`);
    }
    if (typeof entry.uses === "string" && entry.uses.startsWith("actions/checkout@") && entry.with?.["persist-credentials"] !== false) {
      findings.push(`${label} must not persist credentials`);
    }
  });
  const checkout = (entry, expected) =>
    typeof entry.uses === "string" &&
    entry.uses.startsWith("actions/checkout@") &&
    canonicalJson(entry.with) === canonicalJson({ ...expected, "fetch-depth": 0, "persist-credentials": false });
  if (!checkout(step.checkoutBase, { ref: "${{ github.event.pull_request.base.sha }}", path: "ratchet-base" })) {
    findings.push("the base checkout must check out exactly the event base SHA into ratchet-base");
  }
  if (
    !checkout(step.checkoutCandidate, {
      repository: "${{ github.event.pull_request.head.repo.full_name }}",
      ref: "${{ github.event.pull_request.head.sha }}",
      path: "candidate",
    })
  ) {
    findings.push("the candidate checkout must check out exactly the event head SHA into candidate");
  }
  for (const key of ["nodeVersion", "install", "boundary", "delivery", "authority", "moduleGates", "eslint"]) {
    if (step[key]["working-directory"] !== "ratchet-base") findings.push(`step '${step[key].name}' must run from ratchet-base`);
  }
  if (!sameCommands(step.install.run, ["npm ci --ignore-scripts"])) {
    findings.push("protected dependencies must be installed from ratchet-base without lifecycle scripts");
  }
  if (!sameCommands(step.boundary.run, BOUNDARY_RUN)) {
    findings.push("the boundary step must run the base selftest and check with all identity arguments and the delivery judge output");
  }
  if (canonicalJson(step.boundary.env) !== canonicalJson(BOUNDARY_ENV)) {
    findings.push("the boundary step must bind base, head and repository identities exactly to the pull request event");
  }
  if (!sameCommands(step.delivery.run, DELIVERY_RUN)) {
    findings.push("the delivery step must run only the emitted delivery judge on the candidate data");
  }
  if (canonicalJson(step.delivery.env) !== canonicalJson(DELIVERY_ENV)) {
    findings.push("the delivery step must require the trusted Git graph of the event base");
  }
  const authorityRun = typeof step.authority.run === "string" ? step.authority.run : "";
  const execution = authorityRun.indexOf('node "$checker"');
  const pins = ['"$checker_sha" != "$AUTHORITY_CHECKER_SHA256"', '"$schema_sha" != "$AUTHORITY_SCHEMA_SHA256"'].map((pin) =>
    authorityRun.indexOf(pin),
  );
  if (
    !/^[0-9a-f]{64}$/.test(step.authority.env?.AUTHORITY_CHECKER_SHA256 ?? "") ||
    !/^[0-9a-f]{64}$/.test(step.authority.env?.AUTHORITY_SCHEMA_SHA256 ?? "") ||
    execution < 0 ||
    pins.some((index) => index < 0 || index > execution)
  ) {
    findings.push("the authority step may execute the candidate checker only after both base-pinned SHA-256 checks");
  }
  const moduleCommand = runCommands(step.moduleGates.run).join(" ");
  if (!moduleCommand.startsWith("node scripts/quality/check-module-gates.mjs ") || !moduleCommand.includes('--root "$GITHUB_WORKSPACE/candidate"')) {
    findings.push("the module gates must run the base script against the candidate root");
  }
  const eslintCommand = runCommands(step.eslint.run).join(" ");
  for (const fragment of [
    "node --import tsx scripts/quality/check-eslint-ratchet.ts",
    '--config "$GITHUB_WORKSPACE/ratchet-base/eslint.config.mjs"',
    '--base-baseline "$GITHUB_WORKSPACE/ratchet-base/quality/eslint-baseline.json"',
  ]) {
    if (!eslintCommand.includes(fragment)) findings.push(`the last ESLint step must judge debt with the base contract (${fragment})`);
  }
  return findings;
}

function resolveRepository(root, label) {
  const resolved = path.resolve(root);
  const topLevel = git(resolved, ["rev-parse", "--show-toplevel"]).trim();
  if (realpathSync.native(path.resolve(topLevel)) !== realpathSync.native(resolved)) fail(`${label} must be the Git worktree root`);
  return resolved;
}

function resolveHead(root, sha, label) {
  if (typeof sha !== "string" || !SHA_PATTERN.test(sha)) fail(`${label} SHA must be a lowercase 40-character Git SHA`);
  const commit = git(root, ["rev-parse", "--verify", `${sha}^{commit}`]).trim();
  if (commit !== sha) fail(`${label} SHA does not resolve to the declared commit`);
  const head = git(root, ["rev-parse", "--verify", "HEAD^{commit}"]).trim();
  if (head !== sha) fail(`${label} checkout HEAD does not equal the declared SHA`);
}

function assertDescendant(candidateRoot, baseSha, candidateSha) {
  const result = spawnSync("git", ["-C", candidateRoot, "merge-base", "--is-ancestor", baseSha, candidateSha], {
    encoding: "utf8",
    env: { ...process.env, ...GIT_ENV },
    stdio: ["ignore", "pipe", "pipe"],
  });
  if (result.status === 0) return;
  if (result.status === 1) fail("ancestry: candidate SHA is not a descendant of the protected base SHA");
  fail(`ancestry: protected base SHA is not available in the candidate repository (${(result.stderr || result.error?.message || "").trim()})`);
}

function repositoryFindings(options) {
  const repositories = [options.repository, options.baseRepository, options.candidateRepository];
  if (!repositories.every((value) => typeof value === "string" && REPOSITORY_PATTERN.test(value))) {
    return ["repository identity is malformed"];
  }
  if (new Set(repositories).size !== 1) return [`cross-repository candidates are not allowed (${repositories.join(" / ")})`];
  return [];
}

function listTree(root, sha, label) {
  const raw = git(root, ["ls-tree", "-r", "-t", "-z", "--full-tree", sha], { encoding: "buffer" });
  const entries = new Map();
  const duplicates = [];
  for (const record of raw.toString("utf8").split("\0")) {
    if (!record) continue;
    const separator = record.indexOf("\t");
    const header = separator >= 0 ? record.slice(0, separator).split(" ") : [];
    const entryPath = separator >= 0 ? record.slice(separator + 1) : "";
    if (header.length !== 3 || !entryPath || !SHA_PATTERN.test(header[2])) fail(`${label} contains an unparseable Git tree entry`);
    if (entries.has(entryPath)) {
      duplicates.push(entryPath);
      continue;
    }
    entries.set(entryPath, { mode: header[0], type: header[1], sha: header[2] });
  }
  return { entries, duplicates };
}

function treeFindings(entries, duplicates) {
  const findings = [];
  for (const entryPath of duplicates) findings.push(`${JSON.stringify(entryPath)}: duplicate Git tree entry`);
  const folded = new Map();
  for (const [entryPath, entry] of entries) {
    const label = JSON.stringify(entryPath);
    for (const problem of pathSyntaxFindings(entryPath)) findings.push(`${label}: ${problem}`);
    if (entry.type === "tree") {
      if (entry.mode !== "040000") findings.push(`${label}: unsupported tree mode ${entry.mode}`);
    } else if (entry.mode === "120000") {
      findings.push(`${label}: symlink entries are not allowed`);
    } else if (entry.mode === "160000" || entry.type === "commit") {
      findings.push(`${label}: gitlink entries are not allowed`);
    } else if (entry.type !== "blob" || !["100644", "100755"].includes(entry.mode)) {
      findings.push(`${label}: unsupported Git entry ${entry.mode}/${entry.type}`);
    }
    const key = foldPath(entryPath);
    const previous = folded.get(key);
    if (previous === undefined) folded.set(key, entryPath);
    else findings.push(`${JSON.stringify(previous)} and ${label}: case or trailing-dot/space alias paths are not allowed`);
  }
  return findings;
}

function readBlob(root, entry, encoding = "utf8") {
  return git(root, ["cat-file", "blob", entry.sha], { encoding });
}

function basePolicyFindings(baseRoot, baseEntries) {
  const policy = baseEntries.get(POLICY_PATH);
  const schema = baseEntries.get(SCHEMA_PATH);
  if (policy?.type !== "blob" || schema?.type !== "blob") return ["protected base policy or policy schema is missing"];
  return policyFileFindings(readBlob(baseRoot, policy), readBlob(baseRoot, schema)).map((finding) => `protected base ${finding}`);
}

function registerFromTree(root, entries, label) {
  const entry = entries.get(MISSION_PATH);
  if (entry?.type !== "blob") return { present: false, entries: [], problems: [`${label} mission ${MISSION_PATH} is missing`] };
  return missionRegister(readBlob(root, entry));
}

function describeGrant(entry) {
  return `${entry.path} ${entry.replaces_sha256} -> ${entry.successor_sha256} (${entry.reason})`;
}

function registerChangeNotices(baseEntries, candidateEntries) {
  const baseKeys = new Set(baseEntries.map(canonicalJson));
  const candidateKeys = new Set(candidateEntries.map(canonicalJson));
  return [
    ...candidateEntries
      .filter((entry) => !baseKeys.has(canonicalJson(entry)))
      .map((entry) => `candidate announces judge migration preauthorization ${describeGrant(entry)}`),
    ...baseEntries
      .filter((entry) => !candidateKeys.has(canonicalJson(entry)))
      .map((entry) => `candidate removes judge migration preauthorization ${describeGrant(entry)}`),
  ];
}

function isRegularJudgeEntry(entry) {
  return entry?.type === "blob" && entry.mode === "100644";
}

function judgeFindings(context) {
  const { baseRoot, candidateRoot, baseEntries, candidateEntries, grants, notices, verified } = context;
  const findings = [];
  for (const judgePath of JUDGE_PATHS) {
    const baseEntry = baseEntries.get(judgePath);
    const candidateEntry = candidateEntries.get(judgePath);
    if (!isRegularJudgeEntry(baseEntry)) {
      findings.push(`${judgePath}: protected base entry is missing or not a regular 100644 blob`);
      continue;
    }
    if (!candidateEntry) {
      findings.push(`${judgePath}: judge file deleted in candidate`);
      continue;
    }
    if (!isRegularJudgeEntry(candidateEntry)) {
      findings.push(`${judgePath}: Git mode or type changed (${baseEntry.mode}/${baseEntry.type} -> ${candidateEntry.mode}/${candidateEntry.type})`);
      continue;
    }
    const bytes = readBlob(candidateRoot, candidateEntry, "buffer");
    const candidateSha256 = sha256(bytes);
    if (candidateEntry.sha === baseEntry.sha) {
      verified.set(judgePath, { bytes, sha256: candidateSha256, source: "BASE_IDENTICAL" });
      continue;
    }
    const replaces = sha256(readBlob(baseRoot, baseEntry, "buffer"));
    const grant = grants.find(
      (entry) => entry.path === judgePath && entry.replaces_sha256 === replaces && entry.successor_sha256 === candidateSha256,
    );
    if (!grant) {
      findings.push(`${judgePath}: raw Git blob bytes changed without an exact base-preauthorized successor (${replaces} -> ${candidateSha256})`);
      continue;
    }
    notices.push(`judge migration ${judgePath}: ${replaces} -> ${candidateSha256} preauthorized by the protected base register (${grant.reason})`);
    verified.set(judgePath, { bytes, sha256: candidateSha256, source: "BASE_PREAUTHORIZED_SUCCESSOR" });
  }
  return findings;
}

function registerLivenessFindings(candidateRegister, verified) {
  return candidateRegister.entries
    .filter((entry) => verified.get(entry.path)?.sha256 !== entry.replaces_sha256)
    .map(
      (entry) =>
        `candidate judge migration register entry for ${entry.path} is not live: replaces_sha256 must equal the candidate's current bytes (remove consumed or stale entries)`,
    );
}

function walkWorktree(candidateRoot, rel, files, findings) {
  const absolute = path.join(candidateRoot, ...rel.split("/"));
  let stat;
  try {
    stat = lstatSync(absolute);
  } catch {
    return;
  }
  if (!stat.isDirectory()) {
    findings.push(`${rel}: candidate worktree entry is not a regular directory`);
    return;
  }
  for (const entry of readdirSync(absolute, { withFileTypes: true })) {
    const childRel = `${rel}/${entry.name}`;
    if (entry.isDirectory()) walkWorktree(candidateRoot, childRel, files, findings);
    else if (entry.isFile()) files.push(childRel);
    else findings.push(`${JSON.stringify(childRel)}: candidate worktree entry is not a regular file or directory`);
  }
}

function dataRootFindings(candidateRoot, candidateEntries) {
  const findings = [];
  for (const root of DATA_ROOTS) {
    const rootEntry = candidateEntries.get(root);
    if (rootEntry?.type !== "tree" || rootEntry.mode !== "040000") {
      findings.push(`${root}: data root must be a Git tree in the candidate`);
      continue;
    }
    const expected = new Map();
    for (const [entryPath, entry] of candidateEntries) {
      if (
        entryPath.startsWith(`${root}/`) &&
        entry.type === "blob" &&
        ["100644", "100755"].includes(entry.mode) &&
        pathSyntaxFindings(entryPath).length === 0
      ) {
        expected.set(entryPath, entry.sha);
      }
    }
    const files = [];
    walkWorktree(candidateRoot, root, files, findings);
    const onDisk = new Set(files);
    for (const entryPath of expected.keys()) {
      if (!onDisk.has(entryPath)) findings.push(`${entryPath}: tracked data file is missing from the candidate worktree`);
    }
    const hashable = [];
    for (const file of files) {
      if (expected.has(file)) hashable.push(file);
      else findings.push(`${JSON.stringify(file)}: untracked file in a candidate data root worktree`);
    }
    if (hashable.length === 0) continue;
    const hashes = git(candidateRoot, ["hash-object", "--no-filters", "--stdin-paths"], { input: `${hashable.join("\n")}\n` })
      .trim()
      .split(/\r?\n/);
    if (hashes.length !== hashable.length) fail(`${root}: worktree hashing returned an unexpected result`);
    hashable.forEach((file, index) => {
      if (hashes[index] !== expected.get(file)) findings.push(`${file}: candidate worktree bytes differ from the Git blob`);
    });
  }
  return findings;
}

function emitDeliveryJudge(target, judge) {
  if (typeof target !== "string" || !path.isAbsolute(target)) fail("the delivery judge output must be an absolute path");
  if (!judge) fail("no verified delivery judge bytes are available");
  mkdirSync(path.dirname(target), { recursive: true });
  try {
    writeFileSync(target, judge.bytes, { flag: "wx", mode: 0o444 });
  } catch (error) {
    fail(`the delivery judge could not be emitted to a fresh file (${error.code ?? error.message})`);
  }
  return { path: target, sha256: judge.sha256, source: judge.source };
}

export function checkRatchetBoundary(options) {
  const findings = repositoryFindings(options);
  const notices = [];
  let deliveryJudge = null;
  try {
    const baseRoot = resolveRepository(options.baseRoot, "base root");
    const candidateRoot = resolveRepository(options.candidateRoot, "candidate root");
    resolveHead(baseRoot, options.baseSha, "base");
    resolveHead(candidateRoot, options.candidateSha, "candidate");
    assertDescendant(candidateRoot, options.baseSha, options.candidateSha);
    const base = listTree(baseRoot, options.baseSha, "protected base tree");
    const candidate = listTree(candidateRoot, options.candidateSha, "candidate tree");
    findings.push(...basePolicyFindings(baseRoot, base.entries));
    findings.push(...treeFindings(candidate.entries, candidate.duplicates));
    const baseRegister = registerFromTree(baseRoot, base.entries, "protected base");
    if (baseRegister.problems.length > 0) {
      notices.push(`protected base judge migration register is unusable, no migration is preauthorized: ${baseRegister.problems.join("; ")}`);
    }
    const candidateRegister = registerFromTree(candidateRoot, candidate.entries, "candidate");
    findings.push(...candidateRegister.problems.map((problem) => `candidate ${problem}`));
    notices.push(...registerChangeNotices(baseRegister.entries, candidateRegister.entries));
    const verified = new Map();
    findings.push(
      ...judgeFindings({
        baseRoot,
        candidateRoot,
        baseEntries: base.entries,
        candidateEntries: candidate.entries,
        grants: baseRegister.entries,
        notices,
        verified,
      }),
    );
    findings.push(...registerLivenessFindings(candidateRegister, verified));
    findings.push(...dataRootFindings(candidateRoot, candidate.entries));
    if (findings.length === 0 && options.deliveryJudgeOut !== undefined) {
      deliveryJudge = emitDeliveryJudge(options.deliveryJudgeOut, verified.get(DELIVERY_JUDGE_PATH));
    }
  } catch (error) {
    if (!(error instanceof BoundaryError)) throw error;
    findings.push(error.message);
  }
  return { ok: findings.length === 0, findings, notices, deliveryJudge };
}

function parseArgs(argv) {
  const names = new Map();
  for (let index = 0; index < argv.length; index += 2) {
    const key = argv[index];
    const value = argv[index + 1];
    if (!key?.startsWith("--") || value === undefined || value === "" || names.has(key)) fail("arguments must be unique --name value pairs");
    names.set(key, value);
  }
  const unknown = [...names.keys()].filter((name) => !BOUNDARY_ARGUMENTS.includes(name) && !OPTIONAL_ARGUMENTS.includes(name));
  if (unknown.length > 0 || BOUNDARY_ARGUMENTS.some((name) => !names.has(name))) {
    fail(`required boundary arguments are exactly ${BOUNDARY_ARGUMENTS.join(" ")} (optional: ${OPTIONAL_ARGUMENTS.join(" ")})`);
  }
  return Object.fromEntries(
    [...names].map(([name, value]) => [name.slice(2).replace(/-([a-z])/g, (_all, char) => char.toUpperCase()), value]),
  );
}

const FIXTURE_IDENTITY = Object.freeze([
  "-c",
  "user.name=Ratchet Boundary",
  "-c",
  "user.email=ratchet-boundary@example.invalid",
  "-c",
  "commit.gpgsign=false",
]);
const FIXTURE_REPOSITORY = "fixture-owner/fixture-repository";
const FIXTURE_CHECKER = "export default 'fixture-delivery';\n";
const FIXTURE_SUCCESSOR = "export default 'fixture-delivery-successor';\n";

function fixtureGit(root, args, input, raw = false) {
  const output = execFileSync(
    "git",
    ["-C", root, "-c", "core.autocrlf=false", "-c", "core.safecrlf=false", "-c", "core.ignorecase=false", ...args],
    {
      encoding: "utf8",
      input,
      env: { ...process.env, ...GIT_ENV, GIT_CONFIG_NOSYSTEM: "1" },
      maxBuffer: 64 * 1024 * 1024,
      stdio: [input === undefined ? "ignore" : "pipe", "pipe", "pipe"],
    },
  );
  return raw ? output : output.trim();
}

function writeFixture(root, rel, value) {
  const target = path.join(root, ...rel.split("/"));
  mkdirSync(path.dirname(target), { recursive: true });
  writeFileSync(target, value);
}

function removeFixture(root, rel) {
  rmSync(path.join(root, ...rel.split("/")), { recursive: true, force: true });
}

function commitFixture(root, message) {
  fixtureGit(root, ["add", "-A"]);
  fixtureGit(root, [...FIXTURE_IDENTITY, "commit", "-q", "--allow-empty", "-m", message]);
  return fixtureGit(root, ["rev-parse", "HEAD"]);
}

function cacheFixture(root, mode, object, rel) {
  fixtureGit(root, ["update-index", "--add", "--cacheinfo", `${mode},${object},${rel}`]);
}

function blobFixture(root, content) {
  return fixtureGit(root, ["hash-object", "-w", "--stdin"], content);
}

function craftFixture(root, parentSha, dir, entry) {
  const listing = (treeish) => fixtureGit(root, ["ls-tree", "-z", treeish], undefined, true).split("\0").filter(Boolean);
  let rootLines = listing(parentSha);
  if (dir) {
    const subtree = fixtureGit(root, ["mktree", "-z"], [...listing(`${parentSha}:${dir}`), entry, ""].join("\0"));
    rootLines = rootLines.map((line) => (line.endsWith(`\t${dir}`) ? `040000 tree ${subtree}\t${dir}` : line));
  } else {
    rootLines = [...rootLines, entry];
  }
  const tree = fixtureGit(root, ["mktree", "-z"], [...rootLines, ""].join("\0"));
  const commit = fixtureGit(root, [...FIXTURE_IDENTITY, "commit-tree", tree, "-p", parentSha, "-m", "crafted fixture"]);
  fixtureGit(root, ["update-ref", "--no-deref", "HEAD", commit]);
  return commit;
}

function missionFixture(entries, extra = {}) {
  return yaml.dump(
    { mission_id: "FIXTURE", status: "active", ...extra, execution_program_20260928: { [REGISTER_KEY]: entries } },
    { lineWidth: -1 },
  );
}

function fixtureFiles(policyBytes, schemaBytes) {
  return {
    ".github/workflows/eslint-ratchet.yml": "name: fixture-protected-ratchet\n",
    ".github/workflows/quality.yml": "name: fixture-quality\n",
    "README.md": "fixture repository\n",
    "docs/delivery/EXACT_SHA_CLOSURE_RECEIPT_SCHEMA_V1.json": "{\"fixture\":\"closure-receipt-schema\"}\n",
    "docs/delivery/FINDINGS_LEDGER_SCHEMA_V1.json": "{\"fixture\":\"findings-ledger-schema\"}\n",
    "docs/delivery/GATE_MAPPING_V1.yaml": "fixture: gate-mapping\n",
    "docs/delivery/KR-01_BRANCH_PROTECTION_AND_OPERATING_RECEIPT_SCHEMA_V1.json": "{\"fixture\":\"receipt-schema\"}\n",
    "docs/delivery/ROLLING_MANIFEST_QUEUE_SCHEMA_V1.json": "{\"fixture\":\"queue-schema\"}\n",
    "docs/delivery/ROLLING_MANIFEST_QUEUE_V1.json": "{\"fixture\":\"queue\"}\n",
    "docs/delivery/packages/KR-FIXTURE.yaml": "package_id: KR-FIXTURE\n",
    "docs/delivery/packages/PACKAGE_MANIFEST_SCHEMA_V2.json": "{\"fixture\":\"manifest-schema\"}\n",
    "docs/project/CURRENT_STATE.md": "fixture current state\n",
    "docs/project/DOCUMENT_AUTHORITY.md": "fixture document authority\n",
    [MISSION_PATH]: missionFixture([]),
    [POLICY_PATH]: policyBytes,
    [SCHEMA_PATH]: schemaBytes,
    [DELIVERY_JUDGE_PATH]: FIXTURE_CHECKER,
    "scripts/quality/check-ratchet-boundary.mjs": "export default 'fixture-boundary';\n",
    "src/app/page.ts": "export const page = 'fixture';\n",
  };
}

function preauthorization(replacesBytes, reason = "FIXTURE_CHECKER_SUCCESSOR") {
  return {
    path: DELIVERY_JUDGE_PATH,
    replaces_sha256: sha256(replacesBytes),
    successor_sha256: sha256(FIXTURE_SUCCESSOR),
    reason,
  };
}

function expectCase(testCase, result, judgeTarget) {
  if (testCase.expect === "pass") {
    if (!result.ok || result.findings.length > 0) fail(`selftest '${testCase.label}' should pass: ${result.findings.join("; ")}`);
  } else if (result.ok || !result.findings.some((finding) => finding.includes(testCase.expect))) {
    fail(`selftest '${testCase.label}' did not fail closed with '${testCase.expect}': ${result.findings.join("; ") || "no findings"}`);
  }
  if (testCase.notice && !result.notices.some((notice) => notice.includes(testCase.notice))) {
    fail(`selftest '${testCase.label}' did not report notice '${testCase.notice}': ${result.notices.join("; ") || "no notices"}`);
  }
  if (testCase.judge === undefined) return;
  if (testCase.judge === null) {
    if (result.deliveryJudge !== null || (judgeTarget && !testCase.precreate && existsSync(judgeTarget))) {
      fail(`selftest '${testCase.label}' must not emit a delivery judge`);
    }
    return;
  }
  const emitted = existsSync(judgeTarget) ? readFileSync(judgeTarget, "utf8") : null;
  if (emitted !== testCase.judge || result.deliveryJudge?.sha256 !== sha256(testCase.judge)) {
    fail(`selftest '${testCase.label}' emitted the wrong delivery judge bytes`);
  }
}

function livingUpdateCases() {
  const updates = [
    ["mission active package and status", MISSION_PATH, missionFixture([], { active_package: "KR-FIXTURE-NEXT" })],
    ["CURRENT_STATE sync", "docs/project/CURRENT_STATE.md", "fixture current state after merge\n"],
    ["DOCUMENT_AUTHORITY update", "docs/project/DOCUMENT_AUTHORITY.md", "fixture document authority update\n"],
    ["rolling queue update", "docs/delivery/ROLLING_MANIFEST_QUEUE_V1.json", "{\"fixture\":\"queue-next\"}\n"],
    ["gate mapping update", "docs/delivery/GATE_MAPPING_V1.yaml", "fixture: gate-mapping-next\n"],
    ["existing package manifest update", "docs/delivery/packages/KR-FIXTURE.yaml", "package_id: KR-FIXTURE\nstate: CLOSED\n"],
    ["next package manifest", "docs/delivery/packages/KR-FIXTURE-NEXT.yaml", "package_id: KR-FIXTURE-NEXT\n"],
    ["quality workflow wiring", ".github/workflows/quality.yml", "name: fixture-quality-wiring\n"],
    ["new non-judge workflow", ".github/workflows/fixture-new.yml", "name: fixture-new\n"],
    ["new composite action", ".github/actions/fixture/action.yml", "name: fixture-action\n"],
    ["product source change", "src/app/page.ts", "export const page = 'fixture-next';\n"],
    ["living truth deletion is left to the semantic gates", "docs/project/CURRENT_STATE.md", null],
  ];
  return [
    ...updates.map(([label, rel, content]) => ({
      label: `living single path: ${label}`,
      files: (root) => (content === null ? removeFixture(root, rel) : writeFixture(root, rel, content)),
      expect: "pass",
    })),
    {
      label: "living single path: executable tooling script",
      files: (root) => writeFixture(root, "scripts/tools/fixture.sh", "#!/bin/sh\nexit 0\n"),
      index: (root) => fixtureGit(root, ["update-index", "--chmod=+x", "scripts/tools/fixture.sh"]),
      expect: "pass",
    },
  ];
}

function judgeCases(files, shas) {
  const mode = ["100644", "100755"];
  const representative = [
    ".github/workflows/eslint-ratchet.yml",
    "docs/delivery/ROLLING_MANIFEST_QUEUE_SCHEMA_V1.json",
    POLICY_PATH,
    DELIVERY_JUDGE_PATH,
  ];
  return [
    ...JUDGE_PATHS.map((judgePath) => ({
      label: `judge single path mutation ${judgePath}`,
      files: (root) => writeFixture(root, judgePath, `${files[judgePath]}mutated\n`),
      expect: "raw Git blob bytes changed without an exact base-preauthorized successor",
    })),
    ...JUDGE_PATHS.map((judgePath) => ({
      label: `judge single path deletion ${judgePath}`,
      files: (root) => removeFixture(root, judgePath),
      expect: "judge file deleted in candidate",
    })),
    ...representative.map((judgePath) => ({
      label: `judge mode change ${judgePath}`,
      index: (root) => fixtureGit(root, ["update-index", "--chmod=+x", judgePath]),
      expect: `Git mode or type changed (${mode[0]}/blob -> ${mode[1]}/blob)`,
    })),
    ...representative.map((judgePath) => ({
      label: `judge symlink swap ${judgePath}`,
      index: (root) => cacheFixture(root, "120000", blobFixture(root, "../../README.md"), judgePath),
      expect: "symlink entries are not allowed",
    })),
    ...representative.map((judgePath) => ({
      label: `judge replaced by gitlink ${judgePath}`,
      index: (root) => cacheFixture(root, "160000", shas.base, judgePath),
      expect: "gitlink entries are not allowed",
    })),
  ];
}

function migrationCases(shas) {
  const withoutConsumedGrant = (root) => writeFixture(root, MISSION_PATH, missionFixture([]));
  return [
    {
      label: "phase 1 announces an exact judge migration preauthorization",
      files: (root) => writeFixture(root, MISSION_PATH, missionFixture([preauthorization(FIXTURE_CHECKER)])),
      expect: "pass",
      notice: "candidate announces judge migration preauthorization",
      judge: FIXTURE_CHECKER,
    },
    {
      label: "phase 2 installs the exact preauthorized successor and becomes the delivery judge",
      base: shas.registered,
      files: (root) => {
        writeFixture(root, DELIVERY_JUDGE_PATH, FIXTURE_SUCCESSOR);
        withoutConsumedGrant(root);
      },
      expect: "pass",
      notice: "preauthorized by the protected base register",
      judge: FIXTURE_SUCCESSOR,
    },
    {
      label: "phase 2 must remove the consumed preauthorization",
      base: shas.registered,
      files: (root) => writeFixture(root, DELIVERY_JUDGE_PATH, FIXTURE_SUCCESSOR),
      expect: "is not live",
      judge: null,
    },
    {
      label: "a pending preauthorization stays live while the judge is unchanged",
      base: shas.registered,
      files: (root) => writeFixture(root, "src/app/page.ts", "export const page = 'pending';\n"),
      expect: "pass",
    },
    {
      label: "stale candidate register entry",
      files: (root) => writeFixture(root, MISSION_PATH, missionFixture([preauthorization("other replaced bytes\n", "FIXTURE_STALE_SUCCESSOR")])),
      expect: "is not live",
    },
    {
      label: "malformed base register grants nothing but does not block unchanged judges",
      base: shas.malformedRegister,
      files: withoutConsumedGrant,
      expect: "pass",
      notice: "protected base judge migration register is unusable",
    },
    {
      label: "install a successor without base preauthorization",
      files: (root) => writeFixture(root, DELIVERY_JUDGE_PATH, FIXTURE_SUCCESSOR),
      expect: "without an exact base-preauthorized successor",
      judge: null,
    },
    {
      label: "announce and install in the same candidate",
      files: (root) => {
        writeFixture(root, MISSION_PATH, missionFixture([preauthorization(FIXTURE_CHECKER)]));
        writeFixture(root, DELIVERY_JUDGE_PATH, FIXTURE_SUCCESSOR);
      },
      expect: "without an exact base-preauthorized successor",
    },
    {
      label: "install bytes other than the preauthorized successor",
      base: shas.registered,
      files: (root) => {
        writeFixture(root, DELIVERY_JUDGE_PATH, "export default 'other-successor';\n");
        withoutConsumedGrant(root);
      },
      expect: "without an exact base-preauthorized successor",
    },
    {
      label: "preauthorization bound to other replaced bytes",
      base: shas.staleRegistered,
      files: (root) => {
        writeFixture(root, DELIVERY_JUDGE_PATH, FIXTURE_SUCCESSOR);
        withoutConsumedGrant(root);
      },
      expect: "without an exact base-preauthorized successor",
    },
    {
      label: "malformed base register cannot authorize an install",
      base: shas.malformedRegister,
      files: (root) => {
        writeFixture(root, DELIVERY_JUDGE_PATH, FIXTURE_SUCCESSOR);
        withoutConsumedGrant(root);
      },
      expect: "without an exact base-preauthorized successor",
    },
    ...[
      ["lowercase hash", { successor_sha256: sha256(FIXTURE_SUCCESSOR).toLowerCase() }, "must be an uppercase SHA-256"],
      ["living path", { path: MISSION_PATH }, "path is not a judge path"],
      ["extra key", { bypass: true }, "keys must be exactly"],
      ["successor equal to the replaced bytes", { successor_sha256: sha256(FIXTURE_CHECKER) }, "successor must differ"],
      ["free-text reason", { reason: "because" }, "reason must be an uppercase token"],
    ].map(([label, override, expect]) => ({
      label: `candidate register with ${label}`,
      files: (root) => writeFixture(root, MISSION_PATH, missionFixture([{ ...preauthorization(FIXTURE_CHECKER), ...override }])),
      expect,
    })),
    {
      label: "candidate register with two pending migrations for one judge",
      files: (root) =>
        writeFixture(
          root,
          MISSION_PATH,
          missionFixture([preauthorization(FIXTURE_CHECKER), preauthorization(FIXTURE_CHECKER, "FIXTURE_SECOND_SUCCESSOR")]),
        ),
      expect: "duplicates the pending migration",
    },
    {
      label: "candidate register that is not a list",
      files: (root) => writeFixture(root, MISSION_PATH, missionFixture({ grant: "everything" })),
      expect: "judge migration register must be a list",
    },
    {
      label: "unparseable candidate mission",
      files: (root) => writeFixture(root, MISSION_PATH, "mission_id: [unterminated\n"),
      expect: "mission is not parseable YAML",
    },
    {
      label: "existing delivery judge output is never overwritten",
      precreate: true,
      expect: "could not be emitted to a fresh file",
      judge: null,
    },
  ];
}

function hygieneCases(shas) {
  const crafted = (label, dir, name, expect) => ({
    label,
    craft: (root, head) => craftFixture(root, head, dir, `100644 blob ${blobFixture(root, "crafted\n")}\t${name}`),
    expect,
    judge: null,
  });
  return [
    {
      label: "symlink inside a data root",
      index: (root) => cacheFixture(root, "120000", blobFixture(root, "../README.md"), "missions/alias.yml"),
      expect: "symlink entries are not allowed",
    },
    {
      label: "gitlink inside a data root",
      index: (root) => cacheFixture(root, "160000", shas.base, "src/vendor"),
      expect: "gitlink entries are not allowed",
    },
    {
      label: "symlink outside the data roots",
      index: (root) => cacheFixture(root, "120000", blobFixture(root, "../README.md"), "docs/alias.md"),
      expect: "symlink entries are not allowed",
    },
    {
      label: "data root replaced by a file",
      files: (root) => {
        removeFixture(root, "missions");
        writeFixture(root, "missions", "not a directory\n");
      },
      expect: "missions: data root must be a Git tree in the candidate",
    },
    {
      label: "data root deleted",
      files: (root) => removeFixture(root, "src"),
      expect: "src: data root must be a Git tree in the candidate",
    },
    {
      label: "case alias of the protected workflow directory",
      index: (root) => cacheFixture(root, "100644", blobFixture(root, "name: evil\n"), ".github/Workflows/evil.yml"),
      expect: "case or trailing-dot/space alias paths are not allowed",
    },
    {
      label: "case alias of the mission",
      index: (root) => cacheFixture(root, "100644", blobFixture(root, "mission_id: SHADOW\n"), "missions/f1_order_to_cash_pilot_001.yml"),
      expect: "case or trailing-dot/space alias paths are not allowed",
    },
    {
      label: "zero-width Unicode alias of a judge script",
      index: (root) => cacheFixture(root, "100644", blobFixture(root, "shadow\n"), "scripts/quality/check-delivery-contracts\u200b.mjs"),
      expect: "non-ASCII or control characters are not allowed",
    },
    {
      label: "fullwidth Unicode alias of a judge directory",
      index: (root) => cacheFixture(root, "100644", blobFixture(root, "shadow\n"), "\uff53cripts/quality/check-delivery-contracts.mjs"),
      expect: "non-ASCII or control characters are not allowed",
    },
    crafted("trailing-dot alias of the policy", "quality", "ratchet-boundary.json.", "case or trailing-dot/space alias paths are not allowed"),
    crafted("backslash path smuggling", "", "docs\\delivery\\evil.yml", "reserved path characters are not allowed"),
    crafted("colon path smuggling", "", "missions:shadow.yml", "reserved path characters are not allowed"),
    crafted("parent traversal entry", "", "..", "traversal guard"),
    crafted("uppercase .git entry", "", ".GIT", "reserved .git path segments are not allowed"),
    crafted("NTFS short .git entry", "", "git~1", "reserved .git path segments are not allowed"),
    crafted("duplicate tree entry", "", "README.md", "duplicate Git tree entry"),
    {
      label: "uncommitted data change in the candidate worktree",
      after: (root) => writeFixture(root, MISSION_PATH, "mission_id: TAMPERED\n"),
      expect: "candidate worktree bytes differ from the Git blob",
      judge: null,
    },
    {
      label: "untracked file in a candidate data root",
      after: (root) => writeFixture(root, "docs/delivery/packages/KR-SHADOW.yaml", "package_id: KR-SHADOW\n"),
      expect: "untracked file in a candidate data root worktree",
    },
  ];
}

function identityCases(shas) {
  return [
    {
      label: "declared candidate SHA differs from the checked-out HEAD",
      options: () => ({ candidateSha: shas.base }),
      expect: "candidate checkout HEAD does not equal the declared SHA",
      judge: null,
    },
    {
      label: "declared base SHA differs from the base checkout HEAD",
      options: () => ({ baseSha: shas.next }),
      expect: "base checkout HEAD does not equal the declared SHA",
    },
    {
      label: "declared base SHA does not exist",
      options: () => ({ baseSha: "0".repeat(40) }),
      expect: "Git command failed",
    },
    {
      label: "uppercase base SHA",
      options: () => ({ baseSha: shas.base.toUpperCase() }),
      expect: "lowercase 40-character Git SHA",
    },
    {
      label: "base and head checkouts and SHAs swapped",
      options: (ctx) => ({
        baseRoot: ctx.candidateRoot,
        candidateRoot: ctx.baseRoot,
        baseSha: ctx.candidateSha,
        candidateSha: shas.base,
      }),
      expect: "ancestry:",
    },
    {
      label: "stale candidate that does not contain the event base",
      base: shas.next,
      start: shas.base,
      expect: "ancestry: candidate SHA is not a descendant",
    },
    {
      label: "unrelated candidate history",
      options: () => ({ candidateRoot: shas.unrelatedRoot, candidateSha: shas.unrelated }),
      expect: "ancestry:",
    },
    {
      label: "cross-repository candidate",
      options: () => ({ candidateRepository: "attacker/fork" }),
      expect: "cross-repository candidates are not allowed",
      judge: null,
    },
    {
      label: "malformed repository identity",
      options: () => ({ repository: "not a repository" }),
      expect: "repository identity is malformed",
    },
    {
      label: "base root below the worktree root",
      options: (ctx) => ({ baseRoot: path.join(ctx.baseRoot, "docs") }),
      expect: "base root must be the Git worktree root",
    },
    {
      label: "relative delivery judge output",
      options: () => ({ deliveryJudgeOut: "kreile-delivery-judge/check-delivery-contracts.mjs" }),
      expect: "the delivery judge output must be an absolute path",
    },
    {
      label: "base policy widened with a traversal path",
      base: shas.tamperedPolicy,
      expect: "protected base policy does not match the boundary contract",
    },
    {
      label: "base policy schema relaxed",
      base: shas.relaxedSchema,
      expect: "protected base policy schema does not match the boundary contract",
    },
  ];
}

function workflowSelftest(workflowText) {
  const committed = protectedWorkflowFindings(workflowText);
  if (committed.length > 0) fail(`selftest committed protected workflow: ${committed.join("; ")}`);
  const parsed = yaml.load(workflowText);
  const stepIndex = (name) => parsed.jobs.ratchet.steps.findIndex((step) => step.name === name);
  const mutations = [
    ["ESLint before the boundary", (workflow) => {
      const steps = workflow.jobs.ratchet.steps;
      steps.splice(stepIndex("Enforce protected static ratchet boundary"), 0, steps.pop());
    }, "steps must be exactly, in order"],
    ["boundary step removed", (workflow) => workflow.jobs.ratchet.steps.splice(stepIndex("Enforce protected static ratchet boundary"), 1), "steps must be exactly, in order"],
    ["extra step", (workflow) => workflow.jobs.ratchet.steps.push({ name: "Run candidate code", run: "node candidate/x.mjs" }), "steps must be exactly, in order"],
    ["delivery runs the candidate checker", (workflow) => {
      workflow.jobs.ratchet.steps[stepIndex("Enforce protected delivery contracts on candidate data")].run =
        'node "$GITHUB_WORKSPACE/candidate/scripts/quality/check-delivery-contracts.mjs" --root "$GITHUB_WORKSPACE/candidate"\n';
    }, "must not execute a candidate copy of a judge script"],
    ["boundary without delivery judge output", (workflow) => {
      const step = workflow.jobs.ratchet.steps[stepIndex("Enforce protected static ratchet boundary")];
      step.run = step.run.replace(/ \\\n\s*--delivery-judge-out "[^"]+"/, "");
    }, "the boundary step must run the base selftest and check"],
    ["boundary without selftest", (workflow) => {
      const step = workflow.jobs.ratchet.steps[stepIndex("Enforce protected static ratchet boundary")];
      step.run = step.run.replace("node scripts/quality/check-ratchet-boundary.mjs --selftest\n", "");
    }, "the boundary step must run the base selftest and check"],
    ["boundary identity from the candidate", (workflow) => {
      workflow.jobs.ratchet.steps[stepIndex("Enforce protected static ratchet boundary")].env.RATCHET_BASE_SHA =
        "${{ github.event.pull_request.head.sha }}";
    }, "bind base, head and repository identities exactly"],
    ["delivery without trusted base", (workflow) => {
      delete workflow.jobs.ratchet.steps[stepIndex("Enforce protected delivery contracts on candidate data")].env.DELIVERY_REQUIRE_TRUSTED_BASE;
    }, "must require the trusted Git graph"],
    ["boundary may continue on error", (workflow) => {
      workflow.jobs.ratchet.steps[stepIndex("Enforce protected static ratchet boundary")]["continue-on-error"] = true;
    }, "must not be conditional or continue on error"],
    ["inline event expression in a run block", (workflow) => {
      workflow.jobs.ratchet.steps[stepIndex("Enforce protected S1 module gates (Path 1 Naehte)")].run += "echo ${{ github.event.pull_request.title }}\n";
    }, "must pass event values through env"],
    ["candidate checkout keeps credentials", (workflow) => {
      workflow.jobs.ratchet.steps[stepIndex("Checkout candidate without credentials")].with["persist-credentials"] = true;
    }, "must not persist credentials"],
    ["candidate module resolution before ESLint", (workflow) => {
      workflow.jobs.ratchet.steps[stepIndex("Enforce D-GOV-001 authority contract on candidate")].run =
        `ln -s "$GITHUB_WORKSPACE/ratchet-base/node_modules" "$GITHUB_WORKSPACE/candidate/node_modules"\n${
          workflow.jobs.ratchet.steps[stepIndex("Enforce D-GOV-001 authority contract on candidate")].run
        }`;
    }, "must not prepare candidate module resolution"],
    ["authority executes before the pin check", (workflow) => {
      const step = workflow.jobs.ratchet.steps[stepIndex("Enforce D-GOV-001 authority contract on candidate")];
      step.run = `node "$checker" --selftest\n${step.run}`;
    }, "only after both base-pinned SHA-256 checks"],
    ["ESLint judged with the candidate config", (workflow) => {
      const step = workflow.jobs.ratchet.steps[stepIndex("Enforce protected repository ratchet")];
      step.run = step.run.replace("ratchet-base/eslint.config.mjs", "candidate/eslint.config.mjs");
    }, "must judge debt with the base contract"],
    ["write permission", (workflow) => {
      workflow.permissions = { contents: "write" };
    }, "permissions must be exactly contents: read"],
    ["additional trigger", (workflow) => {
      workflow.on.pull_request = { branches: ["main"] };
    }, "triggered only by pull_request_target"],
    ["second job", (workflow) => {
      workflow.jobs.helper = { "runs-on": "ubuntu-latest", steps: [{ run: "true" }] };
    }, "exactly the ratchet job"],
    ["job-level permission override", (workflow) => {
      workflow.jobs.ratchet.permissions = { contents: "write" };
    }, "no job-level overrides"],
  ];
  for (const [label, mutate, expected] of mutations) {
    const copy = structuredClone(parsed);
    mutate(copy);
    const findings = protectedWorkflowFindings(copy);
    if (!findings.some((finding) => finding.includes(expected))) {
      fail(`selftest workflow mutation '${label}' did not fail closed with '${expected}': ${findings.join("; ") || "no findings"}`);
    }
  }
  if (!protectedWorkflowFindings(`${workflowText}# \${{ secrets.TOKEN }}\n`).some((finding) => finding.includes("secrets"))) {
    fail("selftest workflow secret reference was not rejected");
  }
  return mutations.length + 2;
}

export function selftest() {
  for (const [entryPath, rejected] of [
    ["docs/delivery/packages/KR-22R.yaml", false],
    [".github/workflows/eslint-ratchet.yml", false],
    ["a//b", true],
    ["./a", true],
    ["a/../b", true],
    ["a/ /b", true],
    ["a/.git/config", true],
    ["a/.Git./config", true],
  ]) {
    if ((pathSyntaxFindings(entryPath).length > 0) !== rejected) fail(`selftest path syntax '${entryPath}' is not classified correctly`);
  }
  const scriptDir = path.dirname(fileURLToPath(import.meta.url));
  const repositoryRoot = path.resolve(scriptDir, "../..");
  const policyBytes = readFileSync(path.join(repositoryRoot, POLICY_PATH));
  const schemaBytes = readFileSync(path.join(repositoryRoot, SCHEMA_PATH));
  const fileFindings = policyFileFindings(policyBytes, schemaBytes);
  if (fileFindings.length > 0) fail(`selftest committed policy files: ${fileFindings.join("; ")}`);
  const workflowCases = workflowSelftest(readFileSync(path.join(repositoryRoot, WORKFLOW_PATH), "utf8"));

  const temp = mkdtempSync(path.join(tmpdir(), "kreile-ratchet-boundary-"));
  try {
    const files = fixtureFiles(policyBytes, schemaBytes);
    const baseRoot = path.join(temp, "base");
    mkdirSync(baseRoot);
    fixtureGit(baseRoot, ["init", "-q"]);
    for (const [rel, value] of Object.entries(files)) writeFixture(baseRoot, rel, value);
    const shas = { base: commitFixture(baseRoot, "fixture base") };
    const variant = (name, mutate) => {
      fixtureGit(baseRoot, ["checkout", "-q", "-f", "-B", name, shas.base]);
      mutate(baseRoot);
      return commitFixture(baseRoot, name);
    };
    shas.next = variant("fixture-next", (root) => writeFixture(root, "README.md", "fixture repository next\n"));
    shas.registered = variant("fixture-registered", (root) =>
      writeFixture(root, MISSION_PATH, missionFixture([preauthorization(FIXTURE_CHECKER)])),
    );
    shas.staleRegistered = variant("fixture-stale-registered", (root) =>
      writeFixture(root, MISSION_PATH, missionFixture([preauthorization("other replaced bytes\n", "FIXTURE_STALE_SUCCESSOR")])),
    );
    shas.malformedRegister = variant("fixture-malformed-register", (root) =>
      writeFixture(root, MISSION_PATH, missionFixture([{ ...preauthorization(FIXTURE_CHECKER), replaces_sha256: "not-a-sha" }])),
    );
    shas.tamperedPolicy = variant("fixture-tampered-policy", (root) => {
      const policy = JSON.parse(policyBytes.toString("utf8"));
      policy.judge_paths = [...policy.judge_paths, "../escape.mjs"];
      writeFixture(root, POLICY_PATH, `${JSON.stringify(policy, null, 2)}\n`);
    });
    shas.relaxedSchema = variant("fixture-relaxed-schema", (root) => {
      const schema = JSON.parse(schemaBytes.toString("utf8"));
      schema.additionalProperties = true;
      writeFixture(root, SCHEMA_PATH, `${JSON.stringify(schema, null, 2)}\n`);
    });
    fixtureGit(baseRoot, ["checkout", "-q", "-f", "-B", "fixture-main", shas.base]);

    const candidateRoot = path.join(temp, "candidate");
    fixtureGit(temp, ["clone", "-q", "--no-hardlinks", baseRoot, candidateRoot]);
    const unrelatedRoot = path.join(temp, "unrelated");
    mkdirSync(unrelatedRoot);
    fixtureGit(unrelatedRoot, ["init", "-q"]);
    writeFixture(unrelatedRoot, "README.md", "unrelated\n");
    shas.unrelated = commitFixture(unrelatedRoot, "unrelated candidate");
    shas.unrelatedRoot = unrelatedRoot;

    const cases = [
      {
        label: "unchanged candidate with never-executed code emits the base-identical delivery judge",
        files: (root) => writeFixture(root, "candidate-never-execute.mjs", "throw new Error('candidate code must never execute');\n"),
        expect: "pass",
        judge: FIXTURE_CHECKER,
      },
      ...livingUpdateCases(),
      ...migrationCases(shas),
      ...judgeCases(files, shas),
      ...hygieneCases(shas),
      ...identityCases(shas),
    ];
    cases.forEach((testCase, caseIndex) => {
      const baseSha = testCase.base ?? shas.base;
      fixtureGit(baseRoot, ["checkout", "-q", "-f", "--detach", baseSha]);
      fixtureGit(candidateRoot, ["checkout", "-q", "-f", "--detach", testCase.start ?? baseSha]);
      fixtureGit(candidateRoot, ["clean", "-q", "-f", "-d", "-x"]);
      testCase.files?.(candidateRoot);
      fixtureGit(candidateRoot, ["add", "-A"]);
      testCase.index?.(candidateRoot);
      fixtureGit(candidateRoot, [...FIXTURE_IDENTITY, "commit", "-q", "--allow-empty", "-m", testCase.label]);
      let candidateSha = fixtureGit(candidateRoot, ["rev-parse", "HEAD"]);
      if (testCase.craft) candidateSha = testCase.craft(candidateRoot, candidateSha);
      testCase.after?.(candidateRoot);
      const judgeTarget = testCase.judge === undefined ? undefined : path.join(temp, "judges", `${caseIndex}`, "check-delivery-contracts.mjs");
      if (testCase.precreate) writeFixture(temp, `judges/${caseIndex}/check-delivery-contracts.mjs`, "occupied\n");
      const result = checkRatchetBoundary({
        baseRoot,
        candidateRoot,
        baseSha,
        candidateSha,
        repository: FIXTURE_REPOSITORY,
        baseRepository: FIXTURE_REPOSITORY,
        candidateRepository: FIXTURE_REPOSITORY,
        ...(judgeTarget === undefined ? {} : { deliveryJudgeOut: judgeTarget }),
        ...(testCase.options?.({ baseRoot, candidateRoot, candidateSha }) ?? {}),
      });
      expectCase(testCase, result, judgeTarget);
    });
    return { ok: true, cases: cases.length + workflowCases };
  } finally {
    rmSync(temp, { recursive: true, force: true });
  }
}

function main() {
  const args = process.argv.slice(2);
  try {
    if (args.length === 1 && args[0] === "--selftest") {
      const result = selftest();
      process.stdout.write(`ratchet boundary selftest passed (${result.cases} cases)\n`);
      return;
    }
    const result = checkRatchetBoundary(parseArgs(args));
    for (const notice of result.notices) process.stdout.write(`NOTICE [ratchet-boundary] ${notice}\n`);
    if (!result.ok) {
      for (const finding of result.findings) process.stderr.write(`[ratchet-boundary] ${finding}\n`);
      process.exitCode = 1;
      return;
    }
    const judge = result.deliveryJudge
      ? `; delivery judge ${result.deliveryJudge.source} sha256 ${result.deliveryJudge.sha256} emitted`
      : "";
    process.stdout.write(
      `ratchet boundary passed (${JUDGE_PATHS.length} judge paths byte-bound, data roots ${DATA_ROOTS.join(", ")} bound to candidate Git blobs${judge})\n`,
    );
  } catch (error) {
    const message = error instanceof BoundaryError ? error.message : `unexpected error: ${error?.stack ?? error}`;
    process.stderr.write(`[ratchet-boundary] ${message}\n`);
    process.exitCode = 1;
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
