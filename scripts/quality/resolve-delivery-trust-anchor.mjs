// KR-GOV-FIXPOINT-EXIT-A protected-base frozen-anchor resolver.
//
// The protected workflow runs this file from the protected-base checkout only.
// The frozen delivery anchor is read from the rolling manifest queue of that
// protected base and nowhere else; candidate bytes can neither select nor weaken
// it. Every Git fact is read locally, any missing or ambiguous fact is fatal and
// the only output is `trusted_base_sha=<anchor>` appended to the output file.
import { spawnSync } from "node:child_process";
import {
  appendFileSync,
  cpSync,
  lstatSync,
  mkdirSync,
  mkdtempSync,
  realpathSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const SHA = /^[0-9a-f]{40}$/;
const QUEUE_PATH = "docs/delivery/ROLLING_MANIFEST_QUEUE_V1.json";
const RESOLVER_PATH = "scripts/quality/resolve-delivery-trust-anchor.mjs";
const HANDOFF_KEYS = ["effective_base_sha", "effective_base_tree_sha", "entries", "queue_parent_sha"].sort();
const ENTRY_KEYS = [
  "candidate_sha",
  "merge_sha",
  "parent_sha",
  "post_main_agentur_gate_run",
  "post_main_quality_run",
  "pr",
  "review_result",
  "scope",
  "tree_sha",
  "vercel_status",
].sort();
const VALUE_FLAGS = ["--trusted-repo", "--candidate-repo", "--base-sha", "--head-sha", "--github-output"];

class ResolverError extends Error {}

function fail(message) {
  throw new ResolverError(message);
}

// ---------------------------------------------------------------- strict JSON

export function parseStrictJson(text) {
  let i = 0;
  const err = (message) => fail(`queue JSON invalid at offset ${i}: ${message}`);
  const skip = () => {
    while (i < text.length && " \t\n\r".includes(text[i])) i += 1;
  };
  const literal = /-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?|true|false|null/y;
  const string = () => {
    const start = i;
    i += 1;
    while (i < text.length && text[i] !== '"') {
      if (text[i] === "\\") i += 1;
      i += 1;
    }
    if (i >= text.length) err("unterminated string");
    i += 1;
    try {
      return JSON.parse(text.slice(start, i));
    } catch {
      return err("malformed string");
    }
  };
  const object = () => {
    i += 1;
    const out = {};
    skip();
    if (text[i] === "}") {
      i += 1;
      return out;
    }
    for (;;) {
      skip();
      if (text[i] !== '"') err("object key expected");
      const key = string();
      if (key === "__proto__" || Object.hasOwn(out, key)) fail(`duplicate or forbidden key '${key}' in queue JSON`);
      skip();
      if (text[i] !== ":") err("':' expected");
      i += 1;
      out[key] = value();
      skip();
      if (text[i] === ",") {
        i += 1;
        continue;
      }
      if (text[i] === "}") {
        i += 1;
        return out;
      }
      err("',' or '}' expected");
    }
  };
  const array = () => {
    i += 1;
    const out = [];
    skip();
    if (text[i] === "]") {
      i += 1;
      return out;
    }
    for (;;) {
      out.push(value());
      skip();
      if (text[i] === ",") {
        i += 1;
        continue;
      }
      if (text[i] === "]") {
        i += 1;
        return out;
      }
      err("',' or ']' expected");
    }
  };
  function value() {
    skip();
    if (text[i] === "{") return object();
    if (text[i] === "[") return array();
    if (text[i] === '"') return string();
    literal.lastIndex = i;
    const match = literal.exec(text);
    if (!match) err("unexpected token");
    i += match[0].length;
    return JSON.parse(match[0]);
  }
  const result = value();
  skip();
  if (i !== text.length) err("trailing data");
  return result;
}

// ------------------------------------------------------------- queue contract

function exactKeys(value, keys, label) {
  if (value === null || typeof value !== "object" || Array.isArray(value)) fail(`${label} must be an object`);
  const actual = Object.keys(value).sort();
  if (actual.length !== keys.length || actual.some((key, index) => key !== keys[index])) {
    fail(`${label} keys must be exactly ${keys.join(",")}`);
  }
}

function requireSha(value, label) {
  if (typeof value !== "string" || !SHA.test(value)) fail(`${label} must be a lowercase 40-hex SHA`);
}

export function validateQueue(queue) {
  if (queue === null || typeof queue !== "object" || Array.isArray(queue)) fail("queue must be an object");
  const handoff = queue.effective_base_handoff;
  exactKeys(handoff, HANDOFF_KEYS, "effective_base_handoff");
  requireSha(handoff.queue_parent_sha, "queue_parent_sha");
  requireSha(handoff.effective_base_sha, "effective_base_sha");
  requireSha(handoff.effective_base_tree_sha, "effective_base_tree_sha");
  if (!Array.isArray(handoff.entries) || handoff.entries.length === 0) fail("handoff entries must be a non-empty array");
  const seen = { pr: new Set(), parent_sha: new Set(), candidate_sha: new Set(), merge_sha: new Set() };
  handoff.entries.forEach((entry, index) => {
    const label = `entries[${index}]`;
    exactKeys(entry, ENTRY_KEYS, label);
    for (const key of ["parent_sha", "candidate_sha", "merge_sha", "tree_sha"]) requireSha(entry[key], `${label}.${key}`);
    if (!Number.isInteger(entry.pr) || entry.pr <= 0) fail(`${label}.pr must be a positive integer`);
    for (const key of Object.keys(seen)) {
      if (seen[key].has(entry[key])) fail(`duplicate handoff entry value ${key}=${entry[key]} at ${label}`);
      seen[key].add(entry[key]);
    }
  });
  const entries = handoff.entries;
  if (entries[0].parent_sha !== handoff.queue_parent_sha) fail("handoff chain is broken before entry 0");
  for (let index = 1; index < entries.length; index += 1) {
    if (entries[index].parent_sha !== entries[index - 1].merge_sha) fail(`handoff chain is broken before entry ${index}`);
  }
  const last = entries[entries.length - 1];
  if (last.merge_sha !== handoff.effective_base_sha) fail("last handoff merge is not the effective base");
  if (last.tree_sha !== handoff.effective_base_tree_sha) fail("last handoff tree is not the effective base tree");
  return { anchor: handoff.effective_base_sha, anchorTree: handoff.effective_base_tree_sha, entries };
}

// ------------------------------------------------------------------ Git facts

function runGit(repo, args) {
  const result = spawnSync(
    "git",
    ["--no-replace-objects", "-c", "core.fsmonitor=false", "-C", repo, ...args],
    {
      encoding: "utf8",
      maxBuffer: 256 * 1024 * 1024,
      windowsHide: true,
      env: { ...process.env, GIT_TERMINAL_PROMPT: "0", GIT_OPTIONAL_LOCKS: "0", GIT_CONFIG_NOSYSTEM: "1" },
    },
  );
  if (result.error) fail(`git could not be started: ${result.error.message}`);
  return result;
}

function git(repo, args) {
  const result = runGit(repo, args);
  if (result.status !== 0) fail(`git ${args[0]} failed in ${repo}: ${String(result.stderr).trim()}`);
  return result.stdout;
}

function repoRoot(repo, label) {
  if (typeof repo !== "string" || repo === "") fail(`${label} is missing`);
  const resolved = path.resolve(repo);
  let real;
  try {
    real = realpathSync(resolved);
  } catch {
    return fail(`${label} does not exist`);
  }
  if (git(real, ["rev-parse", "--is-inside-work-tree"]).trim() !== "true") fail(`${label} is not a Git work tree`);
  if (git(real, ["rev-parse", "--show-prefix"]).trim() !== "") fail(`${label} is not the repository top level`);
  return real;
}

function commitFacts(repo, sha) {
  requireSha(sha, "commit SHA");
  if (git(repo, ["cat-file", "-t", sha]).trim() !== "commit") fail(`${sha} is not a commit`);
  const [self, ...parents] = git(repo, ["rev-list", "--parents", "-n", "1", sha]).trim().split(" ");
  if (self !== sha || !parents.every((parent) => SHA.test(parent))) fail(`unreadable parents for ${sha}`);
  const tree = git(repo, ["rev-parse", `${sha}^{tree}`]).trim();
  requireSha(tree, `tree of ${sha}`);
  return { sha, parents, tree };
}

function assertNoSymlinkPath(root, relative, label) {
  let current = root;
  const parts = relative.split("/");
  parts.forEach((part, index) => {
    current = path.join(current, part);
    let stat;
    try {
      stat = lstatSync(current);
    } catch {
      return fail(`${label} is missing: ${relative}`);
    }
    if (stat.isSymbolicLink()) fail(`symlink forbidden for ${label}: ${relative}`);
    if (index === parts.length - 1 ? !stat.isFile() : !stat.isDirectory()) fail(`${label} has an unexpected file type: ${relative}`);
  });
}

function readProtectedQueue(trusted, baseSha) {
  assertNoSymlinkPath(trusted, QUEUE_PATH, "queue");
  const listing = git(trusted, ["ls-tree", "-z", baseSha, "--", QUEUE_PATH]);
  const match = /^(\d{6}) (\w+) ([0-9a-f]{40})\t([^\0]+)\0$/.exec(listing);
  if (!match || match[4] !== QUEUE_PATH) fail("queue is not present in the protected base tree");
  if (match[1] === "120000") fail("symlink forbidden for queue in the protected base tree");
  if (match[2] !== "blob" || !["100644", "100755"].includes(match[1])) fail("queue is not a regular blob in the protected base tree");
  return git(trusted, ["cat-file", "blob", match[3]]);
}

// ------------------------------------------------------------------- resolver

export function resolveTrustAnchor({ trustedRepo, candidateRepo, baseSha, headSha }) {
  requireSha(baseSha, "--base-sha");
  requireSha(headSha, "--head-sha");
  const trusted = repoRoot(trustedRepo, "--trusted-repo");
  const candidate = repoRoot(candidateRepo, "--candidate-repo");
  if (trusted === candidate) fail("trusted and candidate repositories must be different checkouts");

  if (git(trusted, ["rev-parse", "HEAD"]).trim() !== baseSha) fail("trusted repository HEAD is not the protected PR base");
  if (git(candidate, ["rev-parse", "HEAD"]).trim() !== headSha) fail("candidate repository HEAD is not the PR head");
  commitFacts(trusted, baseSha);
  commitFacts(candidate, headSha);

  const { anchor, anchorTree, entries } = validateQueue(parseStrictJson(readProtectedQueue(trusted, baseSha)));

  for (const [index, entry] of entries.entries()) {
    const facts = commitFacts(trusted, entry.merge_sha);
    if (facts.parents.length !== 2) fail(`handoff entry ${index} merge does not have exactly two parents`);
    if (facts.parents[0] !== entry.parent_sha) fail(`handoff entry ${index} wrong parent: first parent differs from the declared parent`);
    if (facts.parents[1] !== entry.candidate_sha) fail(`handoff entry ${index} wrong parent: second parent differs from the declared candidate`);
    if (facts.tree !== entry.tree_sha) fail(`handoff entry ${index} wrong tree: tree differs from Git`);
  }
  if (commitFacts(trusted, anchor).tree !== anchorTree) fail("anchor wrong tree: effective base tree differs from Git");

  const firstParentChain = new Set(git(trusted, ["rev-list", "--first-parent", baseSha]).split("\n").filter(Boolean));
  if (!firstParentChain.has(anchor)) fail("anchor is not on the first-parent chain of the protected base");

  const ancestry = runGit(candidate, ["merge-base", "--is-ancestor", baseSha, headSha]);
  if (ancestry.status === 1) fail("stale candidate head: head does not descend from the current PR base");
  if (ancestry.status !== 0) fail(`candidate ancestry could not be verified: ${String(ancestry.stderr).trim()}`);
  return anchor;
}

function assertResolverLocation(trustedRepo) {
  const trusted = repoRoot(trustedRepo, "--trusted-repo");
  const script = fileURLToPath(import.meta.url);
  assertNoSymlinkPath(trusted, RESOLVER_PATH, "resolver");
  const normalize = (value) => (process.platform === "win32" ? value.toLowerCase() : value);
  if (normalize(realpathSync(script)) !== normalize(realpathSync(path.join(trusted, RESOLVER_PATH)))) {
    fail("resolver bytes must come from the protected-base checkout only");
  }
  if (lstatSync(script).isSymbolicLink()) fail("symlink forbidden for the resolver script");
}

// ------------------------------------------------------------------------ CLI

export function parseArgs(argv) {
  if (argv.length === 1 && argv[0] === "--self-test") return { selfTest: true };
  const values = {};
  for (let index = 0; index < argv.length; index += 2) {
    const flag = argv[index];
    const value = argv[index + 1];
    if (!VALUE_FLAGS.includes(flag)) fail(`unknown argument ${flag}`);
    if (value === undefined || value === "" || value.startsWith("--")) fail(`${flag} requires a value`);
    if (Object.hasOwn(values, flag)) fail(`duplicate argument ${flag}`);
    values[flag] = value;
  }
  for (const flag of VALUE_FLAGS) if (!Object.hasOwn(values, flag)) fail(`missing required argument ${flag}`);
  return {
    selfTest: false,
    trustedRepo: values["--trusted-repo"],
    candidateRepo: values["--candidate-repo"],
    baseSha: values["--base-sha"],
    headSha: values["--head-sha"],
    githubOutput: values["--github-output"],
  };
}

function writeOutput(target, anchor) {
  const resolved = path.resolve(target);
  try {
    if (lstatSync(resolved).isSymbolicLink()) fail("symlink forbidden for the GitHub output file");
  } catch (error) {
    if (error instanceof ResolverError) throw error;
  }
  appendFileSync(resolved, `trusted_base_sha=${anchor}\n`);
}

// ------------------------------------------------------------------ self-test

function selfTest() {
  const expectFailure = (action, pattern, label) => {
    try {
      action();
    } catch (error) {
      if (error instanceof ResolverError && pattern.test(error.message)) return;
      throw new Error(`self-test ${label}: unexpected failure: ${error.message}`);
    }
    throw new Error(`self-test ${label}: expected rejection but the resolver accepted`);
  };

  expectFailure(() => parseStrictJson('{"a":1,"a":2}'), /duplicate/, "duplicate JSON key");
  expectFailure(() => parseStrictJson('{"a":1} 2'), /trailing/, "trailing JSON data");
  expectFailure(() => parseArgs([]), /missing required/, "missing arguments");
  expectFailure(() => parseArgs(["--base-sha", "a", "--base-sha", "b"]), /duplicate/, "duplicate argument");
  expectFailure(() => parseArgs(["--other", "a"]), /unknown/, "unknown argument");

  const root = mkdtempSync(path.join(tmpdir(), "kreile-anchor-selftest-"));
  const id = ["-c", "user.name=Resolver Self Test", "-c", "user.email=self-test@example.invalid", "-c", "commit.gpgsign=false", "-c", "core.autocrlf=false"];
  const commit = (repo, file, text) => {
    writeFileSync(path.join(repo, file), text);
    git(repo, [...id, "add", "--", file]);
    git(repo, [...id, "commit", "-q", "-m", `change ${file}`]);
    return git(repo, ["rev-parse", "HEAD"]).trim();
  };
  const fixture = (name, shape, mutate) => {
    const repo = path.join(root, name);
    mkdirSync(path.join(repo, "docs/delivery"), { recursive: true });
    git(repo, ["init", "-q"]);
    git(repo, ["symbolic-ref", "HEAD", "refs/heads/main"]);
    const parent = commit(repo, "root.txt", "root\n");
    git(repo, [...id, "checkout", "-q", "-b", "feature"]);
    const candidate = commit(repo, "feature.txt", "feature\n");
    git(repo, [...id, "checkout", "-q", "-b", "anchorline", parent]);
    git(repo, [...id, "merge", "--no-ff", "-q", "-m", "merge feature", candidate]);
    const merge = git(repo, ["rev-parse", "HEAD"]).trim();
    const tree = git(repo, ["rev-parse", "HEAD^{tree}"]).trim();
    if (shape === "second-parent") {
      git(repo, [...id, "checkout", "-q", "-b", "mainline", parent]);
      commit(repo, "side.txt", "side\n");
      git(repo, [...id, "merge", "--no-ff", "-q", "-m", "merge anchor line", "anchorline"]);
    }
    const queue = {
      schema_version: 1,
      effective_base_handoff: {
        queue_parent_sha: parent,
        effective_base_sha: merge,
        effective_base_tree_sha: tree,
        entries: [
          {
            pr: 1,
            parent_sha: parent,
            candidate_sha: candidate,
            merge_sha: merge,
            tree_sha: tree,
            scope: "PROTECTED_CI_GOVERNANCE_ONLY",
            review_result: "PASS_NO_OPEN_P0_P1_P2_P3",
            post_main_agentur_gate_run: 1,
            post_main_quality_run: 2,
            vercel_status: "SUCCESS",
          },
        ],
      },
    };
    mutate?.(queue);
    writeFileSync(path.join(repo, QUEUE_PATH), `${JSON.stringify(queue, null, 2)}\n`);
    git(repo, [...id, "add", "--", QUEUE_PATH]);
    git(repo, [...id, "commit", "-q", "-m", "queue"]);
    return { repo, base: git(repo, ["rev-parse", "HEAD"]).trim(), anchor: merge };
  };
  const candidateOf = (trusted, name, startPoint) => {
    const repo = path.join(root, name);
    cpSync(trusted, repo, { recursive: true });
    git(repo, [...id, "checkout", "-q", "-b", name, startPoint]);
    return { repo, head: commit(repo, `${name}.txt`, `${name}\n`) };
  };
  const resolve = (trusted, candidate, base) =>
    resolveTrustAnchor({ trustedRepo: trusted, candidateRepo: candidate.repo, baseSha: base, headSha: candidate.head });

  try {
    const good = fixture("good", "linear");
    const descendant = candidateOf(good.repo, "descendant", good.base);
    if (resolve(good.repo, descendant, good.base) !== good.anchor) throw new Error("self-test: anchor mismatch");

    const stale = candidateOf(good.repo, "stale", good.anchor);
    expectFailure(() => resolve(good.repo, stale, good.base), /stale candidate head/, "stale candidate head");

    const second = fixture("second", "second-parent");
    const secondCandidate = candidateOf(second.repo, "secondcand", second.base);
    expectFailure(() => resolve(second.repo, secondCandidate, second.base), /first-parent/, "second-parent-only anchor");

    const altered = fixture("altered", "linear", (queue) => {
      queue.effective_base_handoff.entries[0].tree_sha = "0".repeat(40);
      queue.effective_base_handoff.effective_base_tree_sha = "0".repeat(40);
    });
    const alteredCandidate = candidateOf(altered.repo, "alteredcand", altered.base);
    expectFailure(() => resolve(altered.repo, alteredCandidate, altered.base), /wrong tree/, "wrong tree");
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
  process.stdout.write("RESOLVER_SELF_TEST_PASS\n");
}

function main() {
  try {
    const args = parseArgs(process.argv.slice(2));
    if (args.selfTest) {
      selfTest();
      return;
    }
    assertResolverLocation(args.trustedRepo);
    const anchor = resolveTrustAnchor(args);
    writeOutput(args.githubOutput, anchor);
    process.stdout.write(`delivery trust anchor resolved: ${anchor}\n`);
  } catch (error) {
    process.stderr.write(`resolve-delivery-trust-anchor: ${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  }
}

main();
