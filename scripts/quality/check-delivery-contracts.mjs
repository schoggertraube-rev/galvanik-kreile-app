// Delivery-Governance-Gate: prueft Paketmanifeste, rollende Queue,
// Evidenzzeiger, Alt-PR-Dispositionen und das Betriebsreceipt als eine fail-closed Wahrheit.
// Keine Netzwerkzugriffe und keine Mutation des geprueften Baums.
//
// KR-GOV-FIXPOINT-EXIT-C graph checker (seed bytes, single file).
//
// Trust model. The protected workflow resolves the frozen delivery anchor from
// protected-base resolver bytes and passes it in DELIVERY_TRUSTED_BASE_SHA together
// with DELIVERY_REQUIRE_TRUSTED_BASE=true and DELIVERY_TRUSTED_REPO (the protected
// base checkout). This checker never accepts an anchor, base, head, parent, tree or
// checker hash from the candidate tree or from the command line. In trusted mode it
//   - reads every Git fact from the protected checkout with --no-replace-objects,
//   - requires the anchor and every handoff merge on the first-parent chain of the
//     protected base HEAD (second-parent-only reachability is rejected),
//   - requires the candidate checkout to descend from the protected base HEAD,
//   - requires the candidate queue handoff to equal the protected-base handoff, so the
//     anchor is frozen and a candidate can neither move nor weaken it,
//   - only accepts the protected active package or its single queue successor pointer,
//   - refuses to run when its own bytes live inside the candidate checkout.
// The active package binding is derived from the mission, the manifest set and the
// queue; no package id is hard-coded in this file.

import {
  closeSync,
  constants as fsConstants,
  cpSync,
  existsSync,
  fstatSync,
  lstatSync,
  mkdtempSync,
  mkdirSync,
  openSync,
  readFileSync,
  readdirSync,
  realpathSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { execFileSync, spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { tmpdir } from "node:os";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import Ajv from "ajv";
import ts from "typescript";
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

const PR113_DISPOSITION_PACKAGE_ID = "KR-04-PR113-DISPOSITION";

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
const REVIEWED_QUEUE_PARENT_SHA = "16888ccc1f0c97064af3d1552538c6975440b1fb";
const SHA_PATTERN = /^[0-9a-f]{40}$/;
const SHA256_HEX_PATTERN = /^[0-9a-fA-F]{64}$/;
const PACKAGE_ID_PATTERN = /^KR-[0-9]{2}[A-Za-z0-9-]*$/;

function toPosix(value) {
  return value.replaceAll("\\", "/");
}

function sha256(bytes) {
  return createHash("sha256").update(bytes).digest("hex").toUpperCase();
}

// ------------------------------------------------------------- strict JSON

// JSON.parse silently keeps the last duplicate key; the protected queue is therefore
// parsed with a strict parser that rejects duplicate and prototype keys.
export function parseStrictJson(text) {
  let i = 0;
  const err = (message) => {
    throw new Error(`strict JSON ungueltig bei Offset ${i}: ${message}`);
  };
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
    if (i >= text.length) err("unterminierter String");
    i += 1;
    try {
      return JSON.parse(text.slice(start, i));
    } catch {
      return err("fehlerhafter String");
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
      if (text[i] !== '"') err("Objekt-Key erwartet");
      const key = string();
      if (key === "__proto__" || Object.hasOwn(out, key)) err(`doppelter oder verbotener Key '${key}'`);
      skip();
      if (text[i] !== ":") err("':' erwartet");
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
      err("',' oder '}' erwartet");
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
      err("',' oder ']' erwartet");
    }
  };
  function value() {
    skip();
    if (text[i] === "{") return object();
    if (text[i] === "[") return array();
    if (text[i] === '"') return string();
    literal.lastIndex = i;
    const match = literal.exec(text);
    if (!match) err("unerwartetes Token");
    i += match[0].length;
    return JSON.parse(match[0]);
  }
  const result = value();
  skip();
  if (i !== text.length) err("nachfolgende Daten");
  return result;
}

// ------------------------------------------------------- protected inputs

// Walks every path component without following links. Protected inputs must be
// regular files below real directories; a link of any kind is never read.
function inspectPath(root, rel, kind = "file") {
  let current = root;
  const parts = rel.split("/");
  for (const [index, part] of parts.entries()) {
    current = path.join(current, part);
    let stat;
    try {
      stat = lstatSync(current);
    } catch {
      return "missing";
    }
    if (stat.isSymbolicLink()) return "symlink";
    const last = index === parts.length - 1;
    const expectFile = last && kind === "file";
    if (expectFile ? !stat.isFile() : !stat.isDirectory()) return "type";
  }
  return null;
}

function protectedInputFinding(problem, label) {
  if (problem === "missing") return `[delivery] ${label}: Datei fehlt`;
  if (problem === "symlink") return `[delivery] ${label}: Symlink ist als geschuetzte Eingabe verboten`;
  return `[delivery] ${label}: unerwarteter Dateityp (kein regulaeres File)`;
}

function existsNoFollow(abs) {
  try {
    lstatSync(abs);
    return true;
  } catch {
    return false;
  }
}

function trustedRepoBlobSha256(repo, commit, source) {
  if (!SHA_PATTERN.test(commit)) throw new Error("ungueltiger Repo-Commit-SHA");
  if (
    typeof source !== "string" ||
    source.length === 0 ||
    source !== toPosix(source) ||
    source.includes(":") ||
    source.includes("\0") ||
    source.includes("\n") ||
    source.includes("\r") ||
    path.posix.isAbsolute(source) ||
    source.split("/").some((segment) => segment === "" || segment === "." || segment === "..")
  ) {
    throw new Error("ungueltiger Repo-Quellpfad");
  }
  const blob = execFileSync(
    "git",
    ["-C", repo, "rev-parse", "--verify", `${commit}:${source}`],
    { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] },
  ).trim();
  if (!SHA_PATTERN.test(blob)) throw new Error("Quellpfad ist kein aufloesbarer Blob");
  const bytes = execFileSync(
    "git",
    ["-C", repo, "cat-file", "blob", blob],
    { encoding: null, maxBuffer: 32 * 1024 * 1024, stdio: ["ignore", "pipe", "pipe"] },
  );
  return sha256(bytes);
}

function checkRepoSourceLocks(repo, manifest, rel, findings) {
  const seen = new Set();
  for (const [index, lock] of (manifest.source_locks ?? []).entries()) {
    if (lock?.kind !== "REPO_FILE") continue;
    const label = `${rel}: Repo-Source-Lock[${index}]`;
    if (lock.repo_commit !== manifest.base_sha) {
      findings.push(`${label} repo_commit muss dem Manifest-base_sha entsprechen`);
    }
    if (seen.has(lock.source)) {
      findings.push(`${label} dupliziert '${String(lock.source)}'`);
      continue;
    }
    seen.add(lock.source);
    try {
      const actual = trustedRepoBlobSha256(repo, lock.repo_commit, lock.source);
      if (actual !== lock.sha256) {
        findings.push(`${label} '${lock.source}' SHA256 ${actual}, erwartet ${String(lock.sha256)}`);
      }
    } catch (error) {
      findings.push(`${label} '${String(lock.source)}' konnte nicht geprueft werden (${error.message})`);
    }
  }
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

// ------------------------------------------------------------- Git facts

export function trustedCommitFacts(repo, sha) {
  if (!SHA_PATTERN.test(sha)) {
    throw new Error("ungueltiger Trusted-Commit-SHA");
  }
  const output = execFileSync(
    "git",
    ["--no-replace-objects", "-C", repo, "show", "-s", "--format=%H%n%P%n%T", "--end-of-options", sha],
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
  if (result.error) throw new Error(`git konnte nicht gestartet werden: ${result.error.message}`);
  return result;
}

function gitText(repo, args) {
  const result = runGit(repo, args);
  if (result.status !== 0) throw new Error(`git ${args[0]} schlug fehl: ${String(result.stderr).trim()}`);
  return result.stdout;
}

function repoTopLevel(repo, label) {
  if (typeof repo !== "string" || repo === "") throw new Error(`${label} fehlt`);
  let real;
  try {
    real = realpathSync(path.resolve(repo));
  } catch {
    throw new Error(`${label} existiert nicht`);
  }
  if (gitText(real, ["rev-parse", "--is-inside-work-tree"]).trim() !== "true") throw new Error(`${label} ist kein Git-Work-Tree`);
  if (gitText(real, ["rev-parse", "--show-prefix"]).trim() !== "") throw new Error(`${label} ist nicht die Repository-Wurzel`);
  return real;
}

function samePath(left, right) {
  const normalize = (value) => (process.platform === "win32" ? value.toLowerCase() : value);
  return normalize(left) === normalize(right);
}

// Identity of two path spellings by resolved real path (links resolved, Windows case folded).
// A path that cannot be resolved is never identical to anything.
function sameRealPath(left, right) {
  try {
    return samePath(realpathSync(path.resolve(left)), realpathSync(path.resolve(right)));
  } catch {
    return false;
  }
}

function readProtectedFile(repo, commit, rel) {
  const listing = gitText(repo, ["ls-tree", "-z", commit, "--", rel]);
  const match = /^(\d{6}) (\w+) ([0-9a-f]{40})\t([^\0]+)\0$/.exec(listing);
  if (!match || match[4] !== rel) throw new Error(`${rel} fehlt im geschuetzten Base-Tree`);
  if (match[1] === "120000") throw new Error(`Symlink verboten im geschuetzten Base-Tree: ${rel}`);
  if (match[2] !== "blob" || !["100644", "100755"].includes(match[1])) {
    throw new Error(`${rel} ist kein regulaerer Blob im geschuetzten Base-Tree`);
  }
  return gitText(repo, ["cat-file", "blob", match[3]]);
}

// Opens the trusted Git facts: protected checkout HEAD, its first-parent chain, the
// candidate HEAD and whether the candidate descends from the protected HEAD. Any
// missing or ambiguous fact throws.
export function openTrustedSession(trustedRepo, candidateRoot) {
  const trusted = repoTopLevel(trustedRepo, "Geschuetztes Repository");
  const candidate = repoTopLevel(candidateRoot, "Kandidaten-Checkout");
  if (samePath(trusted, candidate)) {
    throw new Error("Geschuetztes Repository und Kandidaten-Checkout muessen verschiedene Checkouts sein");
  }
  const head = gitText(trusted, ["rev-parse", "--verify", "HEAD^{commit}"]).trim();
  const candidateHead = gitText(candidate, ["rev-parse", "--verify", "HEAD^{commit}"]).trim();
  if (!SHA_PATTERN.test(head) || !SHA_PATTERN.test(candidateHead)) throw new Error("HEAD-Fakten sind keine gueltigen SHAs");
  const firstParentChain = gitText(trusted, ["rev-list", "--first-parent", head]).split("\n").filter(Boolean);
  const ancestry = runGit(candidate, ["merge-base", "--is-ancestor", head, candidateHead]);
  if (ancestry.status !== 0 && ancestry.status !== 1) {
    throw new Error(`Kandidaten-Ancestry nicht pruefbar: ${String(ancestry.stderr).trim()}`);
  }
  return {
    commitFacts: (sha) => trustedCommitFacts(trusted, sha),
    graph: { head, firstParentChain, candidateHead, candidateDescendsFromHead: ancestry.status === 0 },
    readProtectedFile: (rel) => readProtectedFile(trusted, head, rel),
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
      const label = `[delivery] Handoff-Eintrag ${index + 1}`;
      if (commit.sha !== entry.merge_sha) {
        findings.push(`${label}: Merge-Commit ist im geschuetzten Git-Graph nicht aufloesbar`);
      }
      if (JSON.stringify(commit.parents) !== JSON.stringify([entry.parent_sha, entry.candidate_sha])) {
        findings.push(`${label}: Parents stimmen nicht mit dem geschuetzten Git-Graph ueberein`);
      }
      if (commit.tree !== entry.tree_sha) {
        findings.push(`${label}: Tree stimmt nicht mit dem geschuetzten Git-Graph ueberein`);
      }
    }
  } catch (error) {
    findings.push(`[delivery] Geschuetzter Git-Graph konnte nicht geprueft werden (${error.message})`);
  }
  return findings;
}

// Ancestry rules over trusted graph facts. `graph` carries the protected HEAD, its
// first-parent chain (HEAD first), the candidate HEAD and the candidate ancestry bit.
export function validateTrustedGraph(handoff, anchorSha, graph) {
  const chainList = graph && typeof graph === "object" && Array.isArray(graph.firstParentChain) ? graph.firstParentChain : null;
  if (
    chainList === null ||
    chainList.length === 0 ||
    chainList.some((sha) => typeof sha !== "string" || !SHA_PATTERN.test(sha)) ||
    !SHA_PATTERN.test(graph.head ?? "") ||
    chainList[0] !== graph.head ||
    !SHA_PATTERN.test(graph.candidateHead ?? "") ||
    typeof graph.candidateDescendsFromHead !== "boolean" ||
    !SHA_PATTERN.test(anchorSha ?? "")
  ) {
    return ["[delivery] Trusted-Git-Graph-Fakten fehlen oder sind ungueltig"];
  }
  const findings = [];
  const chain = new Set(chainList);
  if (!chain.has(anchorSha)) {
    findings.push("[delivery] Frozen Anchor liegt nicht auf der First-Parent-Kette der geschuetzten Base (Second-Parent-Erreichbarkeit genuegt nicht)");
  }
  for (const [index, entry] of (Array.isArray(handoff?.entries) ? handoff.entries : []).entries()) {
    if (!chain.has(entry?.merge_sha)) {
      findings.push(`[delivery] Handoff-Eintrag ${index + 1}: Merge liegt nicht auf der First-Parent-Kette der geschuetzten Base`);
    }
  }
  if (!graph.candidateDescendsFromHead) {
    findings.push("[delivery] Veralteter Kandidaten-Head: der Kandidat stammt nicht vom aktuellen geschuetzten Base-HEAD ab");
  }
  return findings;
}

// The candidate may not select its own trust facts: its handoff must equal the
// protected-base handoff (frozen anchor), and the active package must be the protected
// active package or its single queue successor pointer.
export function validateProtectedBinding({ candidate, protectedData, anchorSha }) {
  const protectedQueue = protectedData?.queue;
  const protectedMission = protectedData?.mission;
  if (
    !protectedQueue ||
    typeof protectedQueue !== "object" ||
    !protectedMission ||
    typeof protectedMission !== "object"
  ) {
    return ["[delivery] Geschuetzte Queue- oder Mission-Daten fehlen oder sind ungueltig"];
  }
  const findings = [];
  const protectedHandoff = protectedQueue.effective_base_handoff;
  if (protectedHandoff?.effective_base_sha !== anchorSha) {
    findings.push("[delivery] Aufgeloester Frozen Anchor weicht von der Queue der geschuetzten Base ab");
  }
  if (handoffSignature(candidate?.queue?.effective_base_handoff) !== handoffSignature(protectedHandoff)) {
    findings.push("[delivery] Frozen-Handoff des Kandidaten weicht von der geschuetzten Base ab (Anker, Parent, Tree oder Eintraege veraendert)");
  }
  if (
    candidate?.queue?.parent_candidate?.candidate_sha !== protectedQueue.parent_candidate?.candidate_sha ||
    candidate?.queue?.parent_candidate?.tree_sha !== protectedQueue.parent_candidate?.tree_sha
  ) {
    findings.push("[delivery] Queue-Parent des Kandidaten weicht von der geschuetzten Base ab");
  }
  const allowedActive = new Set(
    [protectedMission.active_package, protectedQueue.next_contract_blueprint?.package_id].filter(
      (value) => typeof value === "string",
    ),
  );
  if (!allowedActive.has(candidate?.mission?.active_package)) {
    findings.push("[delivery] Aktives Paket des Kandidaten ist weder das geschuetzte aktive Paket noch dessen einziger Nachfolger-Zeiger");
  }
  return findings;
}

// ----------------------------------------------------------- trust context

// Trusted context comes only from the environment of the protected workflow.
export function resolveTrustedContext(env = process.env) {
  const requireFlag = env.DELIVERY_REQUIRE_TRUSTED_BASE;
  const sha = env.DELIVERY_TRUSTED_BASE_SHA;
  const repo = env.DELIVERY_TRUSTED_REPO;
  if (requireFlag === undefined && sha === undefined && repo === undefined) return { mode: "off" };
  if (requireFlag !== undefined && requireFlag !== "true" && requireFlag !== "false") return { mode: "invalid" };
  if (requireFlag !== "true" && sha === undefined && repo === undefined) return { mode: "off" };
  if (!SHA_PATTERN.test(sha ?? "") || !repo) return { mode: "invalid" };
  return { mode: "on", anchorSha: sha, repo };
}

function checkTrustedState(context, root, queue, mission, findings) {
  if (context?.mode === "off") return;
  if (context?.mode !== "on") {
    findings.push("[delivery] Geschuetzter Base-Kontext ist unvollstaendig oder ungueltig");
    return;
  }
  // `openSession` is a programmatic seam for hermetic tests; the environment never sets it.
  const open = typeof context.openSession === "function" ? context.openSession : openTrustedSession;
  let session;
  try {
    session = open(context.repo, root);
  } catch (error) {
    findings.push(`[delivery] Geschuetzter Git-Graph konnte nicht geprueft werden (${error.message})`);
    return;
  }
  const handoff = queue.effective_base_handoff;
  findings.push(...validateTrustedHandoff(handoff, context.anchorSha, session.commitFacts));
  findings.push(...validateTrustedGraph(handoff, context.anchorSha, session.graph));
  let protectedData;
  try {
    protectedData = {
      queue: parseStrictJson(session.readProtectedFile(DELIVERY_PATHS.queue)),
      mission: yaml.load(session.readProtectedFile(DELIVERY_PATHS.mission)),
    };
  } catch (error) {
    findings.push(`[delivery] Geschuetzte Queue oder Mission konnte nicht gelesen werden (${error.message})`);
    return;
  }
  findings.push(...validateProtectedBinding({ candidate: { queue, mission }, protectedData, anchorSha: context.anchorSha }));
}

// ------------------------------------------------------ checker identity

export function verifyCheckerBytes(scriptPath, expectedSha256) {
  if (typeof expectedSha256 !== "string" || !SHA256_HEX_PATTERN.test(expectedSha256)) {
    return ["[delivery] Erwarteter Checker-SHA-256 ist ungueltig"];
  }
  try {
    if (lstatSync(scriptPath).isSymbolicLink()) return ["[delivery] Checker-Datei ist ein Symlink"];
    const actual = sha256(readFileSync(scriptPath));
    if (actual !== expectedSha256.toUpperCase()) {
      return [`[delivery] Checker-Bytes ${actual} stimmen nicht mit dem erwarteten Hash ${expectedSha256.toUpperCase()} ueberein`];
    }
    return [];
  } catch (error) {
    return [`[delivery] Checker-Bytes konnten nicht geprueft werden (${error.message})`];
  }
}

// In trusted mode the checker bytes must not be executed from the candidate checkout.
export function checkerLocationFindings(scriptPath, root) {
  const findings = [];
  try {
    if (lstatSync(scriptPath).isSymbolicLink()) findings.push("[delivery] Checker-Datei ist ein Symlink");
    const relative = path.relative(realpathSync(root), realpathSync(scriptPath));
    const inside =
      relative === "" || (relative !== ".." && !relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative));
    if (inside) {
      findings.push("[delivery] Checker-Bytes stammen aus dem Kandidaten-Checkout; erlaubt ist nur eine isolierte Kopie ausserhalb von --root");
    }
  } catch (error) {
    findings.push(`[delivery] Checker-Pfad konnte nicht geprueft werden (${error.message})`);
  }
  return findings;
}

// --------------------------------------------------------- file readers

function checkExactKeys(value, expectedKeys, label, findings) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    findings.push(`[delivery] ${label} muss ein Objekt sein`);
    return;
  }
  const expected = new Set(expectedKeys);
  for (const key of expectedKeys) {
    if (!Object.prototype.hasOwnProperty.call(value, key)) {
      findings.push(`[delivery] ${label} fehlt Pflicht-Key '${key}'`);
    }
  }
  for (const key of Object.keys(value)) {
    if (!expected.has(key)) findings.push(`[delivery] ${label} enthaelt unerwarteten Key '${key}'`);
  }
}

function readJson(root, rel, findings, label = rel, { strict = false } = {}) {
  const problem = inspectPath(root, rel);
  if (problem) {
    findings.push(protectedInputFinding(problem, label));
    return null;
  }
  try {
    const text = readFileSync(path.join(root, rel), "utf8");
    return strict ? parseStrictJson(text) : JSON.parse(text);
  } catch (error) {
    findings.push(`[delivery] ${label}: ungueltiges JSON (${error.message})`);
    return null;
  }
}

function readYaml(root, rel, findings, label = rel) {
  const problem = inspectPath(root, rel);
  if (problem) {
    findings.push(protectedInputFinding(problem, label));
    return null;
  }
  try {
    const value = yaml.load(readFileSync(path.join(root, rel), "utf8"));
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

function manifestFiles(root, findings) {
  const dirProblem = inspectPath(root, DELIVERY_PATHS.manifestDir, "dir");
  if (dirProblem === "missing") return [];
  if (dirProblem) {
    findings.push(`[delivery] ${DELIVERY_PATHS.manifestDir}: ${dirProblem === "symlink" ? "Symlink ist als geschuetzte Eingabe verboten" : "unerwarteter Dateityp (kein Verzeichnis)"}`);
    return [];
  }
  const files = [];
  for (const entry of readdirSync(path.join(root, DELIVERY_PATHS.manifestDir), { withFileTypes: true })) {
    if (!entry.name.endsWith(".yaml")) continue;
    const rel = toPosix(path.join(DELIVERY_PATHS.manifestDir, entry.name));
    if (entry.isFile()) files.push(rel);
    else findings.push(`[delivery] ${rel}: Manifest ist kein regulaeres File (Symlink verboten)`);
  }
  return files.sort();
}

function importedSpecifiers(source, fileName) {
  const kind = fileName.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS;
  const sourceFile = ts.createSourceFile(fileName, source, ts.ScriptTarget.Latest, true, kind);
  const specifiers = new Set();
  const addStringLiteral = (node) => {
    if (node && ts.isStringLiteralLike(node)) specifiers.add(node.text);
  };
  const visit = (node) => {
    if (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) {
      addStringLiteral(node.moduleSpecifier);
    } else if (ts.isImportEqualsDeclaration(node) && ts.isExternalModuleReference(node.moduleReference)) {
      addStringLiteral(node.moduleReference.expression);
    } else if (ts.isCallExpression(node) && node.arguments.length === 1) {
      const isDynamicImport = node.expression.kind === ts.SyntaxKind.ImportKeyword;
      const isRequire = ts.isIdentifier(node.expression) && node.expression.text === "require";
      if (isDynamicImport || isRequire) addStringLiteral(node.arguments[0]);
    }
    ts.forEachChild(node, visit);
  };
  visit(sourceFile);
  return [...specifiers];
}

function importTargetsFile(root, importerRel, specifier, targetRel) {
  let candidate;
  if (specifier.startsWith("@/")) {
    candidate = path.resolve(root, "src", specifier.slice(2));
  } else if (specifier.startsWith(".")) {
    candidate = path.resolve(root, path.dirname(importerRel), specifier);
  } else {
    return false;
  }
  const withoutScriptExtension = (value) => value.replace(/\.(?:[cm]?[jt]sx?)$/i, "");
  return withoutScriptExtension(candidate) === withoutScriptExtension(path.resolve(root, targetRel));
}

function sourceRuntimeImporters(root, targetRel, excludedRel) {
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
      const source = readFileSync(absolute, "utf8");
      if (importedSpecifiers(source, rel).some((specifier) => importTargetsFile(root, rel, specifier, targetRel))) {
        matches.push(rel);
      }
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
    if (inspectPath(root, binding.path) !== null) continue;
    const actual = sha256(readFileSync(path.join(root, binding.path)));
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
  checkExactKeys(
    disposition,
    [
      "schema_version",
      "contract_id",
      "package_id",
      "recorded_at",
      "parent_candidate_sha",
      "origin_main_sha_at_disposition",
      "pull_request",
      "path_decisions",
      "import_scan",
      "summary",
      "delivery_truth",
    ],
    "PR113-Disposition",
    findings,
  );
  if (disposition.schema_version !== 1 || disposition.contract_id !== "KR-04_PR113_DISPOSITION_2026-09-29") {
    findings.push("[delivery] PR113-Disposition hat falsche Schema- oder Vertragskennung");
  }
  if (disposition.package_id !== PR113_DISPOSITION_PACKAGE_ID) {
    findings.push("[delivery] PR113-Disposition ist nicht an das historische KR-04-Paket gebunden");
  }
  if (disposition.parent_candidate_sha !== "da8c352d91a694d9c72551a245805386bbf7efdc") {
    findings.push("[delivery] PR113-Disposition hat nicht den geprueften KR-01R-Parent");
  }
  if (disposition.origin_main_sha_at_disposition !== "fa1a989fa5844305e6a8200832ed43e2fc230751") {
    findings.push("[delivery] PR113-Disposition hat nicht den belegten origin/main-Stand");
  }

  const pr = disposition.pull_request ?? {};
  checkExactKeys(
    pr,
    [
      "number",
      "url",
      "base_ref",
      "base_sha",
      "head_ref",
      "head_sha",
      "tree_sha",
      "archive_ref",
      "archive_head_sha",
      "state_before_closure",
      "state_after_closure",
      "merged",
      "source_branch_preserved",
      "archive_ref_preserved",
      "closure_comment_url",
      "closed_at",
    ],
    "PR113-Disposition pull_request",
    findings,
  );
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
  for (const [index, entry] of decisions.entries()) {
    checkExactKeys(
      entry,
      ["path", "parent_blob_sha", "pr_blob_sha", "decision", "reason", "follow_up_package"],
      `PR113-Disposition path_decisions[${index}]`,
      findings,
    );
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
  checkExactKeys(disposition.summary, Object.keys(expectedSummary), "PR113-Disposition summary", findings);
  for (const [key, expected] of Object.entries(expectedSummary)) {
    if (disposition.summary?.[key] !== expected) {
      findings.push(`[delivery] PR113-Disposition summary.${key} muss ${expected} sein`);
    }
  }

  const importTarget = "src/app/buchhaltung/rechnungen/RechnungenClient.tsx";
  checkExactKeys(
    disposition.import_scan,
    ["target", "scope", "runtime_importers", "declaration_only"],
    "PR113-Disposition import_scan",
    findings,
  );
  const actualRuntimeImporters = sourceRuntimeImporters(root, importTarget, importTarget);
  if (disposition.import_scan?.target !== importTarget || disposition.import_scan?.declaration_only !== true) {
    findings.push("[delivery] PR113-Disposition Importscan ist nicht an die tote Altkomponente gebunden");
  }
  if (!sameStringSet(disposition.import_scan?.runtime_importers, actualRuntimeImporters) || actualRuntimeImporters.length !== 0) {
    findings.push(`[delivery] PR113-Disposition Runtime-Importer muessen leer sein, gefunden ${actualRuntimeImporters.join(", ") || "keine"}`);
  }

  const truth = disposition.delivery_truth ?? {};
  checkExactKeys(
    truth,
    ["main_delivered", "merge_performed", "production_authorized", "production_performed"],
    "PR113-Disposition delivery_truth",
    findings,
  );
  for (const key of ["main_delivered", "merge_performed", "production_authorized", "production_performed"]) {
    if (truth[key] !== false) findings.push(`[delivery] PR113-Disposition delivery_truth.${key} muss false sein`);
  }
}

// ----------------------------------------------- active package binding

// The active package is whatever the mission declares, provided exactly one V2
// manifest carries that package id, its file name is `<package_id>.yaml`, the mission
// repeats the id as current_package and the id is not a frozen legacy package.
export function deriveActiveBinding(mission, manifests) {
  const findings = [];
  const activeId = mission?.active_package;
  if (typeof activeId !== "string" || !PACKAGE_ID_PATTERN.test(activeId)) {
    findings.push(`[delivery] Mission active_package '${String(activeId)}' ist keine gueltige Paket-ID`);
    return { findings, active: null };
  }
  const matches = (Array.isArray(manifests) ? manifests : []).filter(({ value }) => value?.package_id === activeId);
  if (matches.length !== 1) {
    findings.push(`[delivery] Mission active_package '${activeId}' muss genau ein Manifest treffen`);
    return { findings, active: null };
  }
  const active = matches[0];
  const expectedPath = `${DELIVERY_PATHS.manifestDir}/${activeId}.yaml`;
  if (active.rel !== expectedPath) {
    findings.push(`[delivery] Aktivmanifest stimmt nicht mit der expliziten Dateiname-/Paket-ID-Bindung ueberein (erwartet ${expectedPath}, gefunden ${active.rel})`);
  }
  if (Object.hasOwn(LEGACY_MANIFEST_BINDINGS, activeId)) {
    findings.push(`[delivery] Mission active_package '${activeId}' ist ein eingefrorenes Legacy-Paket`);
  }
  const current = mission?.execution_program_20260928?.current_package;
  if (current !== activeId) {
    findings.push(`[delivery] Mission current_package '${String(current)}' stimmt nicht mit active_package '${activeId}' ueberein`);
  }
  return { findings, active };
}

// -------------------------------------------------------- rolling queue

function checkRollingConsistency(root, queue, mapping, mission, active, trustedContext, findings) {
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
  if (typeof planned === "string" && existsNoFollow(path.join(root, planned))) {
    findings.push(`[delivery] ${planned}: Zukunftsmanifest ist vor Abschluss des Vorgaengers materialisiert`);
  }
  if ((queue.materialized_future_contracts ?? []).length !== 0) {
    findings.push("[delivery] materialized_future_contracts muss leer bleiben");
  }

  const activeId = mission.active_package;
  if (queueOrder.includes(activeId)) {
    findings.push("[delivery] Aktives Paket wird in der Queue noch als nicht materialisierter Zukunftszeiger gefuehrt");
  }
  if (active) {
    if (queue.next_contract_blueprint?.predecessor !== activeId) {
      findings.push("[delivery] Queue-Nachfolgerzeiger ist nicht an das aktive Paket gebunden");
    }
    if (active.value.schema_version !== 2) findings.push("[delivery] Mission active_package muss ein validiertes V2-Manifest sein");
    if (active.value.base_sha !== mission.base_sha) findings.push("[delivery] Mission base_sha stimmt nicht mit aktivem Manifest ueberein");
    if (active.value.branch !== mission.branch) findings.push("[delivery] Mission branch stimmt nicht mit aktivem Manifest ueberein");
    if (active.value.queue_parent_sha !== queue.parent_candidate?.candidate_sha) {
      findings.push("[delivery] Aktives Manifest ist nicht an den Queue-Parent gebunden");
    }
    const budget = active.value.scope_budget ?? {};
    const allowlist = Array.isArray(active.value.repo_allowlist) ? active.value.repo_allowlist : [];
    if (budget.planned_product_files + budget.planned_governance_files !== allowlist.length) {
      findings.push("[delivery] Aktives Manifest weist nicht fuer jeden Allowlist-Pfad exakt eine geplante Datei aus");
    }
  }

  const canonicalHandoff = queue.effective_base_handoff;
  const expectedHandoff = handoffSignature(canonicalHandoff);
  const handoffCopies = [
    ["manifest", active?.value?.base_handoff],
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
  const seenParents = new Set();
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
    if (
      seenPrs.has(entry?.pr) ||
      seenParents.has(entry?.parent_sha) ||
      seenCandidates.has(entry?.candidate_sha) ||
      seenMerges.has(entry?.merge_sha)
    ) {
      findings.push(`[delivery] Handoff-Eintrag ${index + 1} verwendet PR oder SHA doppelt`);
    }
    seenPrs.add(entry?.pr);
    seenParents.add(entry?.parent_sha);
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
  checkTrustedState(trustedContext, root, queue, mission, findings);

  if (active?.value?.base_sha !== canonicalHandoff?.effective_base_sha) {
    findings.push("[delivery] Manifest base_sha stimmt nicht mit der effektiven Base ueberein");
  }
  if (active?.value?.origin_main_sha !== canonicalHandoff?.effective_base_sha) {
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

export function checkDeliveryContracts(root = process.cwd(), sourceLockRepo = root, trustedContext = resolveTrustedContext(process.env)) {
  root = path.resolve(root);
  sourceLockRepo = path.resolve(sourceLockRepo);
  const findings = [];
  const manifestSchema = readJson(root, DELIVERY_PATHS.manifestSchema, findings);
  const queueSchema = readJson(root, DELIVERY_PATHS.queueSchema, findings);
  const receiptSchema = readJson(root, DELIVERY_PATHS.operatingReceiptSchema, findings);
  const validateManifest = compileSchema(manifestSchema, DELIVERY_PATHS.manifestSchema, findings);
  const validateQueue = compileSchema(queueSchema, DELIVERY_PATHS.queueSchema, findings);
  const validateReceipt = compileSchema(receiptSchema, DELIVERY_PATHS.operatingReceiptSchema, findings);

  const manifests = manifestFiles(root, findings).map((rel) => ({ rel, value: readYaml(root, rel, findings) }));
  for (const { rel, value } of manifests) {
    if (value?.schema_version === 2) {
      validateWith(validateManifest, value, rel, findings);
      resolveEvidenceRefs(value, rel, findings);
    } else if (value?.schema_version !== 1) {
      findings.push(`[delivery] ${rel}: unbekannte schema_version '${String(value?.schema_version)}'`);
    }
  }

  const mission = readYaml(root, DELIVERY_PATHS.mission, findings);
  const binding = mission ? deriveActiveBinding(mission, manifests) : { findings: [], active: null };
  findings.push(...binding.findings);
  const activeManifest = binding.active;
  if (activeManifest?.value?.schema_version === 2) {
    checkRepoSourceLocks(sourceLockRepo, activeManifest.value, activeManifest.rel, findings);
  }
  checkLegacyBindings(root, manifests, findings);
  checkLegacyV1Bindings(root, manifests, findings);

  const queue = readJson(root, DELIVERY_PATHS.queue, findings, DELIVERY_PATHS.queue, { strict: true });
  const mapping = readYaml(root, DELIVERY_PATHS.mapping, findings);
  const receipt = readJson(root, DELIVERY_PATHS.operatingReceipt, findings);
  const pr113Disposition = readJson(root, DELIVERY_PATHS.pr113Disposition, findings);
  validateWith(validateQueue, queue, DELIVERY_PATHS.queue, findings);
  validateWith(validateReceipt, receipt, DELIVERY_PATHS.operatingReceipt, findings);
  checkRollingConsistency(root, queue, mapping, mission, activeManifest, trustedContext, findings);
  checkOperatingTruth(receipt, mapping, findings);
  checkPr113Disposition(root, pr113Disposition, findings);

  return { ok: findings.length === 0, findings: findings.sort() };
}

// ------------------------------------------------------------- self-test

export class SkipCase extends Error {
  constructor(message) {
    super(message);
    this.name = "SkipCase";
  }
}

// Only a genuine "symlinks are not available here" condition may skip a symlink case.
// Every other error is a real failure and must propagate.
export function isSymlinkUnavailable(error) {
  return Boolean(error) && ["EPERM", "EACCES", "ENOTSUP", "ENOSYS"].includes(error.code);
}

const SELFTEST_SOURCE_TREES = Object.freeze(["docs/delivery", "missions"]);
const NO_FOLLOW_FLAG = fsConstants.O_NOFOLLOW ?? 0;

// The self-test source is candidate-controlled. Every entry is examined with lstat before it
// can be read; a link of any kind, a special file or an unreadable entry is fatal. Nothing is
// skipped. With `target === null` the tree is only verified.
function copyTreeNoFollow(source, target, label) {
  let stat;
  try {
    stat = lstatSync(source);
  } catch (error) {
    throw new Error(`Self-Test-Quelle nicht lesbar: ${label} (${error.message})`);
  }
  if (stat.isSymbolicLink()) throw new Error(`Self-Test-Quelle enthaelt einen Symlink: ${label}`);
  if (stat.isDirectory()) {
    if (target !== null) mkdirSync(target);
    for (const name of readdirSync(source).sort()) {
      copyTreeNoFollow(path.join(source, name), target === null ? null : path.join(target, name), `${label}/${name}`);
    }
    return;
  }
  if (!stat.isFile()) throw new Error(`Self-Test-Quelle hat einen nicht unterstuetzten Dateityp: ${label}`);
  let bytes;
  let fd;
  try {
    fd = openSync(source, fsConstants.O_RDONLY | NO_FOLLOW_FLAG);
    if (!fstatSync(fd).isFile()) throw new Error("geoeffneter Eintrag ist kein regulaeres File");
    bytes = readFileSync(fd);
  } catch (error) {
    throw new Error(`Self-Test-Quelle nicht lesbar: ${label} (${error.message})`);
  } finally {
    if (fd !== undefined) closeSync(fd);
  }
  if (target !== null) writeFileSync(target, bytes, { flag: "wx" });
}

// Every component below `root` on the way to a source tree must be a real directory.
function assertNoSymlinkComponents(root, rel) {
  let current = root;
  for (const part of rel.split("/")) {
    current = path.join(current, part);
    let stat;
    try {
      stat = lstatSync(current);
    } catch (error) {
      throw new Error(`Self-Test-Quelle nicht lesbar: ${rel} (${error.message})`);
    }
    if (stat.isSymbolicLink()) throw new Error(`Self-Test-Quelle enthaelt einen Symlink: ${rel}`);
    if (!stat.isDirectory()) throw new Error(`Self-Test-Quelle ist kein Verzeichnis: ${rel}`);
  }
}

function verifySelftestSources(root) {
  for (const rel of SELFTEST_SOURCE_TREES) {
    assertNoSymlinkComponents(root, rel);
    copyTreeNoFollow(path.join(root, rel), null, rel);
  }
}

export function fixtureFrom(root) {
  const target = mkdtempSync(path.join(tmpdir(), "kreile-delivery-selftest-"));
  try {
    for (const rel of SELFTEST_SOURCE_TREES) {
      assertNoSymlinkComponents(root, rel);
      mkdirSync(path.dirname(path.join(target, rel)), { recursive: true });
      copyTreeNoFollow(path.join(root, rel), path.join(target, rel), rel);
    }
  } catch (error) {
    rmSync(target, { recursive: true, force: true });
    throw error;
  }
  return target;
}

function mutateYaml(abs, mutate) {
  const value = yaml.load(readFileSync(abs, "utf8"));
  mutate(value);
  writeFileSync(abs, yaml.dump(value, { lineWidth: 120, noRefs: true }));
}

function mutateJson(abs, mutate) {
  const value = JSON.parse(readFileSync(abs, "utf8"));
  mutate(value);
  writeFileSync(abs, `${JSON.stringify(value, null, 2)}\n`);
}

// Replaces `abs` (a file inside a fresh, symlink-free self-test fixture) by a symlink to a
// byte-identical copy. The copy lives in a new self-test-owned directory outside every copied
// source tree, is created exclusively and is never derived from the candidate-side path, so no
// pre-placed name can be written through. The directory is registered for cleanup first.
export function replaceInputWithSymlink(abs, ownedTemps) {
  if (lstatSync(abs).isSymbolicLink()) throw new Error(`Self-Test-Eingabe ist bereits ein Symlink: ${abs}`);
  const bytes = readFileSync(abs);
  const dir = mkdtempSync(path.join(tmpdir(), "kreile-delivery-selftest-link-"));
  ownedTemps.push(dir);
  const real = path.join(dir, path.basename(abs));
  writeFileSync(real, bytes, { flag: "wx" });
  rmSync(abs);
  linkOrSkip(real, abs);
  return real;
}

function linkOrSkip(target, link) {
  try {
    symlinkSync(target, link);
  } catch (error) {
    if (isSymlinkUnavailable(error)) throw new SkipCase("symlink creation is not permitted on this platform");
    throw error;
  }
}

function missionActivePackage(root) {
  const mission = yaml.load(readFileSync(path.join(root, DELIVERY_PATHS.mission), "utf8"));
  if (typeof mission?.active_package !== "string") throw new Error("Mission active_package fehlt");
  return mission.active_package;
}

// `sourceLockRepo` only selects the Git checkout used to verify repo source locks; it defaults
// to the checked tree and exists so hermetic tests can supply a real checkout for a bare fixture.
export function runSelftest(root = process.cwd(), { sourceLockRepo = root } = {}) {
  const ownedTemps = [];
  try {
    return runSelftestWith(path.resolve(root), path.resolve(sourceLockRepo), ownedTemps);
  } finally {
    for (const dir of ownedTemps) rmSync(dir, { recursive: true, force: true });
  }
}

function runSelftestWith(root, sourceLockRepo, ownedTemps) {
  // Fail closed before any case runs: both approved source trees must be free of links.
  verifySelftestSources(root);
  const cases = [];
  const off = { mode: "off" };
  const activeId = missionActivePackage(root);
  const activePath = `${DELIVERY_PATHS.manifestDir}/${activeId}.yaml`;

  const runCase = (name, mutate, expected) => {
    const fixture = fixtureFrom(root);
    try {
      try {
        mutate(fixture);
      } catch (error) {
        if (error instanceof SkipCase) return;
        throw error;
      }
      const result = checkDeliveryContracts(fixture, sourceLockRepo, off);
      if (result.ok || !result.findings.some((entry) => entry.includes(expected))) {
        throw new Error(`${name}: erwarteter Befund '${expected}' fehlt; erhalten ${result.findings.join(" | ")}`);
      }
      cases.push(name);
    } finally {
      rmSync(fixture, { recursive: true, force: true });
    }
  };
  const expectFinding = (name, findings, expected) => {
    if (!findings.some((entry) => entry.includes(expected))) {
      throw new Error(`${name}: erwarteter Befund '${expected}' fehlt; erhalten ${findings.join(" | ")}`);
    }
    cases.push(name);
  };
  const expectClean = (name, findings) => {
    if (findings.length !== 0) throw new Error(`${name}: unerwartete Befunde ${findings.join(" | ")}`);
    cases.push(name);
  };
  const expectThrows = (name, action, expected) => {
    try {
      action();
    } catch (error) {
      if (String(error.message).includes(expected)) {
        cases.push(name);
        return;
      }
      throw new Error(`${name}: unerwartete Ausnahme '${error.message}'`);
    }
    throw new Error(`${name}: erwartete Ablehnung '${expected}' blieb aus`);
  };

  const baseline = checkDeliveryContracts(root, sourceLockRepo, off);
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
    mutateYaml(path.join(fixture, activePath), (value) => {
      value.register_gate_evidence.FUNCTIONAL_SLICE_PASS.evidence_ref = "acceptance:DOES-NOT-EXIST";
    });
  }, "loest nicht im eigenen Manifest auf");

  runCase("pr113-path-disposition", (fixture) => {
    mutateJson(path.join(fixture, DELIVERY_PATHS.pr113Disposition), (value) => {
      value.path_decisions[0].decision = "UNSAFE_DIRECT_IMPORT";
    });
  }, "Disposition fuer");

  runCase("pr113-missing-path", (fixture) => {
    mutateJson(path.join(fixture, DELIVERY_PATHS.pr113Disposition), (value) => {
      value.path_decisions.pop();
    });
  }, "muss exakt 7 Pfadentscheidungen enthalten");

  runCase("pr113-blob-drift", (fixture) => {
    mutateJson(path.join(fixture, DELIVERY_PATHS.pr113Disposition), (value) => {
      value.path_decisions[0].parent_blob_sha = "0000000000000000000000000000000000000000";
    });
  }, "Blobbindung fuer");

  runCase("pr113-delivery-claim", (fixture) => {
    mutateJson(path.join(fixture, DELIVERY_PATHS.pr113Disposition), (value) => {
      value.delivery_truth.main_delivered = true;
    });
  }, "delivery_truth.main_delivered muss false sein");

  runCase("pr113-unknown-key", (fixture) => {
    mutateJson(path.join(fixture, DELIVERY_PATHS.pr113Disposition), (value) => {
      value.hidden_claim = true;
    });
  }, "enthaelt unerwarteten Key 'hidden_claim'");

  runCase("pr113-runtime-importer", (fixture) => {
    const abs = path.join(fixture, "src/probe.ts");
    mkdirSync(path.dirname(abs), { recursive: true });
    writeFileSync(abs, 'import "./app/buchhaltung/rechnungen/RechnungenClient";\n');
  }, "Runtime-Importer muessen leer sein");

  runCase("active-manifest-file-count", (fixture) => {
    mutateYaml(path.join(fixture, activePath), (value) => {
      value.scope_budget.planned_governance_files -= 1;
    });
  }, "nicht fuer jeden Allowlist-Pfad exakt eine geplante Datei");

  runCase("active-manifest-repo-source-lock-hash", (fixture) => {
    mutateYaml(path.join(fixture, activePath), (value) => {
      value.source_locks.find((lock) => lock.kind === "REPO_FILE").sha256 = "0".repeat(64);
    });
  }, "Repo-Source-Lock[0]");

  runCase("queue-order", (fixture) => {
    mutateJson(path.join(fixture, DELIVERY_PATHS.queue), (value) => {
      [value.initial_horizon[0], value.initial_horizon[1]] = [value.initial_horizon[1], value.initial_horizon[0]];
    });
  }, "should be equal to constant");

  runCase("mapping-drift", (fixture) => {
    mutateYaml(path.join(fixture, DELIVERY_PATHS.mapping), (value) => {
      value.rolling_manifest_policy.candidate_is_not_main_delivery = false;
    });
  }, "Rolling-Policy-Drift");

  runCase("effective-base-handoff-drift", (fixture) => {
    mutateJson(path.join(fixture, DELIVERY_PATHS.queue), (value) => {
      value.effective_base_handoff.effective_base_sha = "0000000000000000000000000000000000000001";
    });
  }, "Effective-Base-Handoff-Drift");

  runCase("effective-base-handoff-chain-break", (fixture) => {
    mutateJson(path.join(fixture, DELIVERY_PATHS.queue), (value) => {
      value.effective_base_handoff.entries[0].parent_sha = "0000000000000000000000000000000000000001";
    });
  }, "Handoff-Kette ist vor Eintrag 1 unterbrochen");

  runCase("queue-parent-reset", (fixture) => {
    mutateJson(path.join(fixture, DELIVERY_PATHS.queue), (value) => {
      value.effective_base_handoff.queue_parent_sha = "0000000000000000000000000000000000000001";
    });
  }, "Queue-Parent stimmt nicht mit dem Ausgang der Handoff-Kette ueberein");

  runCase("duplicate-queue-entry", (fixture) => {
    mutateJson(path.join(fixture, DELIVERY_PATHS.queue), (value) => {
      value.effective_base_handoff.entries.push({ ...value.effective_base_handoff.entries[0] });
    });
  }, "verwendet PR oder SHA doppelt");

  runCase("altered-queue-entry", (fixture) => {
    mutateJson(path.join(fixture, DELIVERY_PATHS.queue), (value) => {
      value.effective_base_handoff.entries[1].candidate_sha = "1".repeat(40);
    });
  }, "Effective-Base-Handoff-Drift");

  runCase("duplicate-queue-json-key", (fixture) => {
    const abs = path.join(fixture, DELIVERY_PATHS.queue);
    writeFileSync(abs, readFileSync(abs, "utf8").replace('"schema_version": 1,', '"schema_version": 1,\n  "schema_version": 1,'));
  }, "doppelter oder verbotener Key");

  runCase("receipt-bypass", (fixture) => {
    mutateJson(path.join(fixture, DELIVERY_PATHS.operatingReceipt), (value) => {
      value.active_ruleset.bypass_actors.push("admin");
    });
  }, "active_ruleset.bypass_actors muss leer sein");

  runCase("receipt-schema-self-weakening", (fixture) => {
    mutateJson(path.join(fixture, DELIVERY_PATHS.operatingReceiptSchema), (schema) => {
      schema.properties.delivery_truth.properties.main_delivered.const = true;
    });
    mutateJson(path.join(fixture, DELIVERY_PATHS.operatingReceipt), (receipt) => {
      receipt.delivery_truth.main_delivered = true;
    });
  }, "delivery_truth.main_delivered muss false sein");

  runCase("required-check-mapping-drift", (fixture) => {
    mutateYaml(path.join(fixture, DELIVERY_PATHS.mapping), (value) => {
      value.required_check_truth.actual_required_names = ["quality"];
    });
  }, "actual_required_names stimmt nicht");

  runCase("resource-derived-drift", (fixture) => {
    mutateJson(path.join(fixture, DELIVERY_PATHS.operatingReceiptSchema), (schema) => {
      schema.properties.resource_calibration.properties.observed_min_available_ram_mb.const = 9999;
    });
    mutateJson(path.join(fixture, DELIVERY_PATHS.operatingReceipt), (receipt) => {
      receipt.resource_calibration.observed_min_available_ram_mb = 9999;
    });
  }, "observed_min_available_ram_mb ist nicht aus samples abgeleitet");

  // Active package binding is derived from data, never from a constant.
  runCase("active-binding-alias", (fixture) => {
    const manifestAbs = path.join(fixture, activePath);
    writeFileSync(manifestAbs, readFileSync(manifestAbs, "utf8").replace(`package_id: ${activeId}`, "package_id: KR-04-HIDDEN-ALIAS"));
    const missionAbs = path.join(fixture, DELIVERY_PATHS.mission);
    writeFileSync(missionAbs, readFileSync(missionAbs, "utf8").replaceAll(activeId, "KR-04-HIDDEN-ALIAS"));
  }, "expliziten Dateiname-/Paket-ID-Bindung");

  runCase("active-binding-current-package", (fixture) => {
    const missionAbs = path.join(fixture, DELIVERY_PATHS.mission);
    writeFileSync(
      missionAbs,
      readFileSync(missionAbs, "utf8").replace(/^(\s*current_package:\s*)\S+/m, "$1KR-04-OTHER-PACKAGE"),
    );
  }, "Mission current_package");

  runCase("active-binding-queue-predecessor", (fixture) => {
    mutateJson(path.join(fixture, DELIVERY_PATHS.queue), (value) => {
      value.next_contract_blueprint.predecessor = "KR-04-OTHER-PACKAGE";
    });
  }, "Queue-Nachfolgerzeiger");

  // Protected inputs may never be links.
  for (const [name, rel] of [
    ["symlink-queue", DELIVERY_PATHS.queue],
    ["symlink-mission", DELIVERY_PATHS.mission],
    ["symlink-mapping", DELIVERY_PATHS.mapping],
    ["symlink-receipt", DELIVERY_PATHS.operatingReceipt],
  ]) {
    runCase(name, (fixture) => replaceInputWithSymlink(path.join(fixture, rel), ownedTemps), "Symlink ist als geschuetzte Eingabe verboten");
  }
  runCase("symlink-manifest-alias", (fixture) => {
    linkOrSkip(path.join(fixture, activePath), path.join(fixture, DELIVERY_PATHS.manifestDir, "ALIAS.yaml"));
  }, "Manifest ist kein regulaeres File");

  // Trusted ancestry over synthetic Git facts.
  const handoff = JSON.parse(readFileSync(path.join(root, DELIVERY_PATHS.queue), "utf8")).effective_base_handoff;
  const anchor = handoff.effective_base_sha;
  const factsMap = new Map(
    handoff.entries.map((entry) => [entry.merge_sha, { sha: entry.merge_sha, parents: [entry.parent_sha, entry.candidate_sha], tree: entry.tree_sha }]),
  );
  const readFacts = (sha) => {
    const value = factsMap.get(sha);
    if (!value) throw new Error(`synthetic commit fact missing: ${sha}`);
    return value;
  };
  const head = "a".repeat(40);
  const graph = (overrides = {}) => ({
    head,
    firstParentChain: [head, ...handoff.entries.map((entry) => entry.merge_sha).reverse(), "9".repeat(40)],
    candidateHead: "b".repeat(40),
    candidateDescendsFromHead: true,
    ...overrides,
  });
  const clone = (value) => JSON.parse(JSON.stringify(value));

  expectClean("graph-positive", [...validateTrustedHandoff(handoff, anchor, readFacts), ...validateTrustedGraph(handoff, anchor, graph())]);
  const wrongParents = clone(handoff);
  wrongParents.entries[0].candidate_sha = "1".repeat(40);
  expectFinding("graph-wrong-parents", validateTrustedHandoff(wrongParents, anchor, readFacts), "Parents stimmen nicht");
  const wrongTree = clone(handoff);
  wrongTree.entries[0].tree_sha = "2".repeat(40);
  expectFinding("graph-wrong-tree", validateTrustedHandoff(wrongTree, anchor, readFacts), "Tree stimmt nicht");
  expectFinding("graph-altered-anchor", validateTrustedHandoff(handoff, handoff.entries[0].merge_sha, readFacts), "Effective Base stimmt nicht");
  expectFinding(
    "graph-second-parent-only",
    validateTrustedGraph(handoff, anchor, graph({ firstParentChain: [head, "9".repeat(40)] })),
    "First-Parent-Kette",
  );
  expectFinding("graph-stale-head", validateTrustedGraph(handoff, anchor, graph({ candidateDescendsFromHead: false })), "Veralteter Kandidaten-Head");
  expectFinding("graph-missing-facts", validateTrustedGraph(handoff, anchor, undefined), "fehlen oder sind ungueltig");
  expectFinding("graph-malformed-head", validateTrustedGraph(handoff, anchor, graph({ head: "nope" })), "fehlen oder sind ungueltig");
  expectFinding(
    "graph-malformed-ancestry",
    validateTrustedGraph(handoff, anchor, graph({ candidateDescendsFromHead: "yes" })),
    "fehlen oder sind ungueltig",
  );
  expectFinding(
    "graph-unreadable",
    validateTrustedHandoff(handoff, anchor, () => {
      throw new Error("synthetic graph unavailable");
    }),
    "konnte nicht geprueft werden",
  );

  // Candidate-selected trust facts.
  const protectedData = { queue: JSON.parse(readFileSync(path.join(root, DELIVERY_PATHS.queue), "utf8")), mission: { active_package: activeId } };
  const candidate = { queue: clone(protectedData.queue), mission: { active_package: activeId } };
  expectClean("binding-positive", validateProtectedBinding({ candidate, protectedData, anchorSha: anchor }));
  const selfAnchor = clone(candidate);
  selfAnchor.queue.effective_base_handoff.effective_base_sha = "c".repeat(40);
  expectFinding(
    "binding-candidate-selected-anchor",
    validateProtectedBinding({ candidate: selfAnchor, protectedData, anchorSha: anchor }),
    "Frozen-Handoff des Kandidaten",
  );
  expectFinding(
    "binding-resolver-anchor-mismatch",
    validateProtectedBinding({ candidate, protectedData, anchorSha: "d".repeat(40) }),
    "Aufgeloester Frozen Anchor",
  );
  expectFinding(
    "binding-candidate-selected-active-package",
    validateProtectedBinding({ candidate: { ...candidate, mission: { active_package: "KR-99Z-SELF-SELECTED" } }, protectedData, anchorSha: anchor }),
    "Aktives Paket des Kandidaten",
  );
  expectFinding("binding-missing-protected-data", validateProtectedBinding({ candidate, protectedData: null, anchorSha: anchor }), "fehlen oder sind ungueltig");

  // Trust context, arguments and checker identity.
  expectFinding("context-incomplete", checkDeliveryContracts(root, sourceLockRepo, resolveTrustedContext({ DELIVERY_REQUIRE_TRUSTED_BASE: "true" })).findings, "unvollstaendig");
  expectThrows("args-candidate-selected-head", () => parseArgs(["--head-sha", "a".repeat(40)]), "Unbekanntes Argument");
  expectThrows("args-candidate-selected-anchor", () => parseArgs(["--trusted-base-sha", "a".repeat(40)]), "Unbekanntes Argument");
  expectThrows("args-duplicate", () => parseArgs(["--root", "a", "--root", "b"]), "Doppeltes Argument");
  expectThrows("strict-json-duplicate-key", () => parseStrictJson('{"a":1,"a":2}'), "doppelter oder verbotener Key");
  const scriptPath = fileURLToPath(import.meta.url);
  expectClean("checker-bytes-self", verifyCheckerBytes(scriptPath, sha256(readFileSync(scriptPath))));
  expectFinding("checker-bytes-wrong-hash", verifyCheckerBytes(scriptPath, "0".repeat(64)), "stimmen nicht");
  expectFinding("checker-bytes-malformed-hash", verifyCheckerBytes(scriptPath, "xyz"), "ungueltig");
  expectFinding(
    "checker-location-in-candidate",
    checkerLocationFindings(path.join(root, DELIVERY_PATHS.queue), root),
    "Kandidaten-Checkout",
  );

  return cases;
}

// ------------------------------------------------------------------ CLI

export function parseArgs(argv, cwd = process.cwd()) {
  const options = { root: path.resolve(cwd), selftest: false, expectSelfSha256: null };
  const seen = new Set();
  for (let index = 0; index < argv.length; index++) {
    const flag = argv[index];
    if (seen.has(flag)) throw new Error(`Doppeltes Argument: ${flag}`);
    seen.add(flag);
    if (flag === "--selftest") {
      options.selftest = true;
    } else if (flag === "--root" || flag === "--expect-self-sha256") {
      const value = argv[++index];
      if (value === undefined || value === "" || value.startsWith("--")) throw new Error(`Argument ${flag} braucht einen Wert`);
      if (flag === "--root") options.root = path.resolve(value);
      else options.expectSelfSha256 = value;
    } else {
      throw new Error(`Unbekanntes Argument: ${flag}`);
    }
  }
  return options;
}

function reportFindings(findings) {
  console.error(`delivery-contracts: ${findings.length} Verstoss/Verstoesse`);
  for (const finding of findings) console.error(`  ${finding}`);
  process.exitCode = 1;
}

function main(argv) {
  try {
    const options = parseArgs(argv);
    const scriptPath = fileURLToPath(import.meta.url);
    const trustedContext = resolveTrustedContext(process.env);
    const preflight = [];
    if (options.expectSelfSha256 !== null) preflight.push(...verifyCheckerBytes(scriptPath, options.expectSelfSha256));
    if (!options.selftest && trustedContext.mode !== "off") preflight.push(...checkerLocationFindings(scriptPath, options.root));
    if (preflight.length > 0) {
      reportFindings(preflight);
      return;
    }
    if (options.selftest) {
      const cases = runSelftest(options.root);
      console.log(`delivery-contracts selftest: PASS (${cases.length}/${cases.length})`);
      return;
    }
    const result = checkDeliveryContracts(options.root, process.env.DELIVERY_TRUSTED_REPO || options.root, trustedContext);
    if (result.ok) {
      console.log("delivery-contracts: PASS (Manifeste, Evidenzzeiger, Legacy-Bindung, Alt-PR-Disposition, Queue, Mapping, Betriebsreceipt)");
    } else {
      reportFindings(result.findings);
    }
  } catch (error) {
    console.error(`delivery-contracts: ${error instanceof Error ? error.message : String(error)}`);
    process.exitCode = 1;
  }
}

const isMain = Boolean(process.argv[1]) && sameRealPath(process.argv[1], fileURLToPath(import.meta.url));
if (isMain) main(process.argv.slice(2));
