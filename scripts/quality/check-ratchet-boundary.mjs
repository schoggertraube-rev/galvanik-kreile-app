// Static ratchet boundary: trusted-base code compares Git objects only.
// It deliberately never imports, installs, or executes candidate code.

import { execFileSync, spawnSync } from "node:child_process";
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const SHA_PATTERN = /^[0-9a-f]{40}$/;
const POLICY_CONTRACT_ID = "KREILE_STATIC_RATCHET_BOUNDARY_V1";
const CANDIDATE_EXECUTION = "NEVER_EXECUTE_CANDIDATE";
const PROTECTED_TREES = Object.freeze([".github/workflows", "docs/delivery"]);
const PROTECTED_PATHS = Object.freeze([
  "missions/F1_ORDER_TO_CASH_PILOT_001.yml",
  "docs/project/CURRENT_STATE.md",
  "docs/project/DOCUMENT_AUTHORITY.md",
  "scripts/quality/check-delivery-contracts.mjs",
  "scripts/quality/check-ratchet-boundary.mjs",
  "quality/ratchet-boundary.json",
  "quality/ratchet-boundary.schema.json",
  "src/test/delivery_contracts.test.ts",
]);
const POLICY_KEYS = Object.freeze([
  "schema_version",
  "contract_id",
  "candidate_execution",
  "protected_trees",
  "protected_paths",
]);

function fail(message) {
  throw new Error(`[ratchet-boundary] ${message}`);
}

function git(root, args, encoding = "utf8") {
  try {
    return execFileSync("git", ["-C", root, ...args], {
      encoding,
      maxBuffer: 32 * 1024 * 1024,
      stdio: ["ignore", "pipe", "pipe"],
    });
  } catch (error) {
    const stderr = Buffer.isBuffer(error.stderr) ? error.stderr.toString("utf8") : String(error.stderr ?? "");
    fail(`Git command failed (${args.join(" ")}): ${stderr.trim() || error.message}`);
  }
}

function sameStringSet(actual, expected) {
  return (
    Array.isArray(actual) &&
    actual.every((value) => typeof value === "string") &&
    new Set(actual).size === actual.length &&
    actual.length === expected.length &&
    [...actual].sort().join("\0") === [...expected].sort().join("\0")
  );
}

function readJson(file, label) {
  try {
    const value = JSON.parse(readFileSync(file, "utf8"));
    if (!value || typeof value !== "object" || Array.isArray(value)) fail(`${label} must be a JSON object`);
    return value;
  } catch (error) {
    if (error.message?.startsWith("[ratchet-boundary]")) throw error;
    fail(`${label} is not valid JSON (${error.message})`);
  }
}

function validateSchema(schema) {
  const schemaKeys = ["$schema", "title", "type", "additionalProperties", "required", "properties"];
  if (!sameStringSet(Object.keys(schema), schemaKeys)) fail("policy schema keys are not exact");
  if (schema.$schema !== "https://json-schema.org/draft/2020-12/schema") fail("policy schema draft is not exact");
  if (schema.title !== "Kreile static ratchet boundary policy") fail("policy schema title is not exact");
  if (schema.type !== "object" || schema.additionalProperties !== false) {
    fail("policy schema must be a strict object with additionalProperties false");
  }
  if (!sameStringSet(schema.required, POLICY_KEYS)) fail("policy schema required keys are not exact");
  if (!schema.properties || typeof schema.properties !== "object" || Array.isArray(schema.properties)) {
    fail("policy schema properties are invalid");
  }
  if (!sameStringSet(Object.keys(schema.properties), POLICY_KEYS)) fail("policy schema property keys are not exact");
  if (schema.properties.schema_version?.const !== 1) fail("policy schema schema_version must be const 1");
  if (schema.properties.contract_id?.const !== POLICY_CONTRACT_ID) fail("policy schema contract_id is not exact");
  if (schema.properties.candidate_execution?.const !== CANDIDATE_EXECUTION) {
    fail("policy schema candidate execution guard is not exact");
  }
  for (const [key, count] of [["protected_trees", PROTECTED_TREES.length], ["protected_paths", PROTECTED_PATHS.length]]) {
    const property = schema.properties[key];
    if (
      !property ||
      property.type !== "array" ||
      property.minItems !== count ||
      property.maxItems !== count ||
      property.uniqueItems !== true ||
      property.items?.type !== "string"
    ) {
      fail(`policy schema ${key} is not strict`);
    }
  }
}

function validatePolicy(policy) {
  if (!sameStringSet(Object.keys(policy), POLICY_KEYS)) fail("policy keys are not exact");
  if (policy.schema_version !== 1 || policy.contract_id !== POLICY_CONTRACT_ID) fail("policy identity is not exact");
  if (policy.candidate_execution !== CANDIDATE_EXECUTION) fail("policy must forbid candidate execution");
  if (!sameStringSet(policy.protected_trees, PROTECTED_TREES)) fail("policy protected tree list is not exact");
  if (!sameStringSet(policy.protected_paths, PROTECTED_PATHS)) fail("policy protected path list is not exact");
}

function resolveRepository(root, label) {
  const resolved = path.resolve(root);
  const topLevel = git(resolved, ["rev-parse", "--show-toplevel"]).trim();
  if (path.resolve(topLevel) !== resolved) fail(`${label} must be the Git worktree root`);
  return resolved;
}

function resolveHead(root, sha, label) {
  if (!SHA_PATTERN.test(sha)) fail(`${label} SHA must be a lowercase 40-character Git SHA`);
  const resolved = git(root, ["rev-parse", "--verify", `${sha}^{commit}`]).trim();
  if (resolved !== sha) fail(`${label} SHA does not resolve to the declared commit`);
  const head = git(root, ["rev-parse", "--verify", "HEAD"]).trim();
  if (head !== sha) fail(`${label} checkout HEAD does not equal the declared SHA`);
}

function assertAncestor(candidateRoot, baseSha, candidateSha) {
  const result = spawnSync("git", ["-C", candidateRoot, "merge-base", "--is-ancestor", baseSha, candidateSha], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });
  if (result.error || result.status !== 0) {
    fail(`candidate SHA is not a descendant of the protected base SHA${result.error ? ` (${result.error.message})` : ""}`);
  }
}

function parseTreeEntries(raw, label) {
  const entries = new Map();
  for (const record of raw.toString("utf8").split("\0")) {
    if (!record) continue;
    const separator = record.indexOf("\t");
    const header = separator >= 0 ? record.slice(0, separator).split(" ") : [];
    const entryPath = separator >= 0 ? record.slice(separator + 1) : "";
    if (header.length !== 3 || !entryPath || !SHA_PATTERN.test(header[2])) fail(`${label} contains an invalid Git tree entry`);
    if (entries.has(entryPath)) fail(`${label} contains duplicate Git tree entry '${entryPath}'`);
    entries.set(entryPath, { mode: header[0], type: header[1], sha: header[2] });
  }
  return entries;
}

function treeEntries(root, commit, protectedTree) {
  return parseTreeEntries(
    git(root, ["ls-tree", "-r", "-z", "--full-tree", commit, "--", protectedTree], null),
    `${protectedTree}@${commit}`,
  );
}

function exactPathEntry(root, commit, protectedPath) {
  const entries = parseTreeEntries(
    git(root, ["ls-tree", "-z", commit, "--", protectedPath], null),
    `${protectedPath}@${commit}`,
  );
  if (entries.size !== 1 || !entries.has(protectedPath)) fail(`${protectedPath}@${commit} must resolve to exactly one Git entry`);
  return entries.get(protectedPath);
}

function rawBlob(root, entry, label) {
  if (entry.type !== "blob" || !["100644", "100755", "120000"].includes(entry.mode)) {
    fail(`${label} must be a regular-file or symlink blob`);
  }
  return git(root, ["cat-file", "blob", entry.sha], null);
}

function compareEntry(baseRoot, candidateRoot, label, baseEntry, candidateEntry, findings) {
  if (!baseEntry || !candidateEntry) {
    findings.push(`${label}: Git entry added or deleted`);
    return;
  }
  if (baseEntry.mode !== candidateEntry.mode || baseEntry.type !== candidateEntry.type) {
    findings.push(`${label}: Git mode or type changed (${baseEntry.mode}/${baseEntry.type} -> ${candidateEntry.mode}/${candidateEntry.type})`);
    return;
  }
  try {
    const baseBlob = rawBlob(baseRoot, baseEntry, `base ${label}`);
    const candidateBlob = rawBlob(candidateRoot, candidateEntry, `candidate ${label}`);
    if (!baseBlob.equals(candidateBlob)) findings.push(`${label}: raw Git blob bytes changed`);
  } catch (error) {
    findings.push(error.message);
  }
}

function compareTree(baseRoot, candidateRoot, baseSha, candidateSha, protectedTree, findings) {
  const baseEntries = treeEntries(baseRoot, baseSha, protectedTree);
  const candidateEntries = treeEntries(candidateRoot, candidateSha, protectedTree);
  const paths = new Set([...baseEntries.keys(), ...candidateEntries.keys()]);
  for (const entryPath of [...paths].sort()) {
    compareEntry(
      baseRoot,
      candidateRoot,
      `${protectedTree}:${entryPath}`,
      baseEntries.get(entryPath),
      candidateEntries.get(entryPath),
      findings,
    );
  }
}

function comparePath(baseRoot, candidateRoot, baseSha, candidateSha, protectedPath, findings) {
  try {
    compareEntry(
      baseRoot,
      candidateRoot,
      protectedPath,
      exactPathEntry(baseRoot, baseSha, protectedPath),
      exactPathEntry(candidateRoot, candidateSha, protectedPath),
      findings,
    );
  } catch (error) {
    findings.push(error.message);
  }
}

export function checkRatchetBoundary(options) {
  const baseRoot = resolveRepository(options.baseRoot, "base root");
  const candidateRoot = resolveRepository(options.candidateRoot, "candidate root");
  const policy = readJson(options.policy, "policy");
  const schema = readJson(options.schema, "policy schema");
  validateSchema(schema);
  validatePolicy(policy);
  resolveHead(baseRoot, options.baseSha, "base");
  resolveHead(candidateRoot, options.candidateSha, "candidate");
  assertAncestor(candidateRoot, options.baseSha, options.candidateSha);
  const findings = [];
  for (const protectedTree of PROTECTED_TREES) {
    compareTree(baseRoot, candidateRoot, options.baseSha, options.candidateSha, protectedTree, findings);
  }
  for (const protectedPath of PROTECTED_PATHS) {
    comparePath(baseRoot, candidateRoot, options.baseSha, options.candidateSha, protectedPath, findings);
  }
  return { ok: findings.length === 0, findings };
}

function parseArgs(argv) {
  const names = new Map();
  for (let index = 0; index < argv.length; index += 2) {
    const key = argv[index];
    const value = argv[index + 1];
    if (!key?.startsWith("--") || value === undefined || names.has(key)) fail("arguments must be unique --name value pairs");
    names.set(key, value);
  }
  const required = ["--base-root", "--candidate-root", "--base-sha", "--candidate-sha", "--policy", "--schema"];
  if (names.size !== required.length || required.some((name) => !names.has(name))) fail("required boundary arguments are incomplete");
  return Object.fromEntries(required.map((name) => [name.slice(2).replace(/-([a-z])/g, (_all, char) => char.toUpperCase()), names.get(name)]));
}

function runGit(root, args, input) {
  return execFileSync("git", ["-C", root, ...args], { encoding: "utf8", input, stdio: ["ignore", "pipe", "pipe"] }).trim();
}

function writeFixture(root, rel, value) {
  const target = path.join(root, rel);
  mkdirSync(path.dirname(target), { recursive: true });
  writeFileSync(target, value);
}

function commitFixture(root, message) {
  runGit(root, ["add", "-A"]);
  runGit(root, ["-c", "user.name=Ratchet Boundary", "-c", "user.email=ratchet-boundary@example.invalid", "commit", "-m", message]);
  return runGit(root, ["rev-parse", "HEAD"]);
}

function createFixtureBase(root, policyBytes, schemaBytes) {
  runGit(root, ["init", "-q"]);
  writeFixture(root, ".github/workflows/ratchet.yml", "name: fixture-ratchet\n");
  writeFixture(root, ".github/workflows/legacy.yml", "name: fixture-legacy\n");
  writeFixture(root, "docs/delivery/manifest.yml", "fixture: delivery\n");
  writeFixture(root, "missions/F1_ORDER_TO_CASH_PILOT_001.yml", "fixture: mission\n");
  writeFixture(root, "docs/project/CURRENT_STATE.md", "fixture state\n");
  writeFixture(root, "docs/project/DOCUMENT_AUTHORITY.md", "fixture authority\n");
  writeFixture(root, "scripts/quality/check-delivery-contracts.mjs", "export default 'fixture';\n");
  writeFixture(root, "scripts/quality/check-ratchet-boundary.mjs", "export default 'fixture-boundary';\n");
  writeFixture(root, "quality/ratchet-boundary.json", policyBytes);
  writeFixture(root, "quality/ratchet-boundary.schema.json", schemaBytes);
  writeFixture(root, "src/test/delivery_contracts.test.ts", "export {};\n");
  runGit(root, ["add", "-A"]);
  const symlinkBlob = runGit(root, ["hash-object", "-w", "--stdin"], "manifest.yml\n");
  runGit(root, ["update-index", "--add", "--cacheinfo", `120000,${symlinkBlob},docs/delivery/manifest-link`]);
  runGit(root, ["-c", "user.name=Ratchet Boundary", "-c", "user.email=ratchet-boundary@example.invalid", "commit", "-m", "fixture base"]);
  return runGit(root, ["rev-parse", "HEAD"]);
}

function createFixtureCandidate(root, baseRoot, baseSha, mutate) {
  runGit(root, ["init", "-q"]);
  runGit(root, ["fetch", "-q", baseRoot, baseSha]);
  runGit(root, ["checkout", "-q", "--detach", "FETCH_HEAD"]);
  writeFixture(root, "candidate-never-execute.mjs", "throw new Error('candidate code must never execute');\n");
  mutate?.(root);
  return commitFixture(root, "fixture candidate");
}

function expectSelftestFailure(label, action) {
  try {
    const result = action();
    if (result?.ok === false) return;
  } catch {
    return;
  }
  fail(`selftest '${label}' did not fail closed`);
}

export function selftest() {
  const temp = mkdtempSync(path.join(tmpdir(), "kreile-ratchet-boundary-"));
  try {
    const scriptDir = path.dirname(fileURLToPath(import.meta.url));
    const policyBytes = readFileSync(path.resolve(scriptDir, "../../quality/ratchet-boundary.json"));
    const schemaBytes = readFileSync(path.resolve(scriptDir, "../../quality/ratchet-boundary.schema.json"));
    const baseRoot = path.join(temp, "base");
    mkdirSync(baseRoot);
    const baseSha = createFixtureBase(baseRoot, policyBytes, schemaBytes);
    const policy = path.join(baseRoot, "quality/ratchet-boundary.json");
    const schema = path.join(baseRoot, "quality/ratchet-boundary.schema.json");
    const optionsFor = (candidateRoot, candidateSha, overrides = {}) => ({
      baseRoot,
      candidateRoot,
      baseSha,
      candidateSha,
      policy,
      schema,
      ...overrides,
    });
    const positiveRoot = path.join(temp, "positive");
    mkdirSync(positiveRoot);
    const positiveSha = createFixtureCandidate(positiveRoot, baseRoot, baseSha);
    const positive = checkRatchetBoundary(optionsFor(positiveRoot, positiveSha));
    if (!positive.ok || positive.findings.length) fail(`selftest positive case failed: ${positive.findings.join("; ")}`);

    const negativeCases = [
      ["workflow", ".github/workflows/ratchet.yml"],
      ["script", "scripts/quality/check-delivery-contracts.mjs"],
      ["policy", "quality/ratchet-boundary.json"],
      ["schema", "quality/ratchet-boundary.schema.json"],
      ["legacy path", "docs/delivery/legacy-handoff.yml"],
    ];
    for (const [label, rel] of negativeCases) {
      const candidateRoot = path.join(temp, `negative-${label.replaceAll(" ", "-")}`);
      mkdirSync(candidateRoot);
      const candidateSha = createFixtureCandidate(candidateRoot, baseRoot, baseSha, (root) => {
        writeFixture(root, rel, `mutated ${label}\n`);
      });
      expectSelftestFailure(label, () => checkRatchetBoundary(optionsFor(candidateRoot, candidateSha)));
    }

    const newWorkflowRoot = path.join(temp, "negative-new-workflow");
    mkdirSync(newWorkflowRoot);
    const newWorkflowSha = createFixtureCandidate(newWorkflowRoot, baseRoot, baseSha, (root) => {
      writeFixture(root, ".github/workflows/new-workflow.yml", "name: untrusted\n");
    });
    expectSelftestFailure("new workflow", () => checkRatchetBoundary(optionsFor(newWorkflowRoot, newWorkflowSha)));
    expectSelftestFailure("wrong SHA", () => checkRatchetBoundary(optionsFor(positiveRoot, "0".repeat(40))));

    const unrelatedRoot = path.join(temp, "unrelated");
    mkdirSync(unrelatedRoot);
    runGit(unrelatedRoot, ["init", "-q"]);
    writeFixture(unrelatedRoot, "README.md", "unrelated\n");
    const unrelatedSha = commitFixture(unrelatedRoot, "unrelated candidate");
    expectSelftestFailure("not ancestor", () => checkRatchetBoundary(optionsFor(unrelatedRoot, unrelatedSha)));

    const relaxedSchema = path.join(temp, "relaxed.schema.json");
    const relaxedValue = JSON.parse(schemaBytes.toString("utf8"));
    relaxedValue.additionalProperties = true;
    writeFileSync(relaxedSchema, `${JSON.stringify(relaxedValue, null, 2)}\n`);
    expectSelftestFailure("relaxed schema", () =>
      checkRatchetBoundary(optionsFor(positiveRoot, positiveSha, { schema: relaxedSchema })),
    );
    return { ok: true, findings: [] };
  } finally {
    rmSync(temp, { recursive: true, force: true });
  }
}

function main() {
  if (process.argv.slice(2).length === 1 && process.argv[2] === "--selftest") {
    selftest();
    process.stdout.write("ratchet boundary selftest passed\n");
    return;
  }
  const result = checkRatchetBoundary(parseArgs(process.argv.slice(2)));
  if (!result.ok) {
    for (const finding of result.findings) process.stderr.write(`${finding}\n`);
    process.exitCode = 1;
    return;
  }
  process.stdout.write("ratchet boundary passed\n");
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
