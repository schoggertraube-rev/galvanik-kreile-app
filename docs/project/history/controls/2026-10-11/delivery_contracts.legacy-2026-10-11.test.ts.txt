// @vitest-environment node

import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
  copyFileSync,
  cpSync,
  lstatSync,
  mkdtempSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  realpathSync,
  renameSync,
  rmSync,
  symlinkSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  DELIVERY_PATHS,
  LEGACY_MANIFEST_BINDINGS,
  LEGACY_V1_MANIFEST_BINDINGS,
  checkDeliveryContracts,
  checkerLocationFindings,
  deriveActiveBinding,
  fixtureFrom,
  isSymlinkUnavailable,
  openTrustedSession,
  replaceInputWithSymlink,
  parseArgs,
  parseStrictJson,
  resolveTrustedContext,
  runSelftest,
  trustedCommitFacts,
  validateProtectedBinding,
  validateTrustedGraph,
  validateTrustedHandoff,
  verifyCheckerBytes,
} from "../../scripts/quality/check-delivery-contracts.mjs";

const temps: string[] = [];

type CheckResult = { ok: boolean; findings: string[] };
type TrustedContext = {
  mode: string;
  anchorSha?: string;
  repo?: string;
  openSession?: (repo: string, root: string) => TrustedSession;
};
type TrustedSession = {
  commitFacts: (sha: string) => { sha: string; parents: string[]; tree: string };
  graph: {
    head: string;
    firstParentChain: string[];
    candidateHead: string;
    candidateDescendsFromHead: boolean;
  };
  readProtectedFile: (rel: string) => string;
};
type Handoff = {
  queue_parent_sha: string;
  effective_base_sha: string;
  effective_base_tree_sha: string;
  entries: Array<Record<string, string | number>>;
};
type ManifestEntry = { rel: string; value: Record<string, unknown> };

const runChecker = checkDeliveryContracts as unknown as (
  root?: string,
  sourceLockRepo?: string,
  trusted?: TrustedContext,
) => CheckResult;
const openSession = openTrustedSession as unknown as (repo: string, root: string) => TrustedSession;
const graphFindings = validateTrustedGraph as unknown as (handoff: unknown, anchor: string, graph: unknown) => string[];
const bindingFindings = validateProtectedBinding as unknown as (input: {
  candidate: unknown;
  protectedData: unknown;
  anchorSha: string;
}) => string[];
const deriveBinding = deriveActiveBinding as unknown as (
  mission: unknown,
  manifests: ManifestEntry[],
) => { findings: string[]; active: ManifestEntry | null };
const contextFromEnv = resolveTrustedContext as unknown as (env?: Record<string, string>) => TrustedContext;
const locationFindings = checkerLocationFindings as unknown as (script: string, root: string) => string[];
const bytesFindings = verifyCheckerBytes as unknown as (script: string, expected: string) => string[];
const parseCliArgs = parseArgs as unknown as (argv: string[]) => {
  root: string;
  selftest: boolean;
  expectSelfSha256: string | null;
};
const parseStrict = parseStrictJson as unknown as (text: string) => unknown;
const selftest = runSelftest as unknown as (root?: string, options?: { sourceLockRepo?: string }) => string[];
const replaceWithSymlink = replaceInputWithSymlink as unknown as (abs: string, ownedTemps: string[]) => string;
const symlinkUnavailable = isSymlinkUnavailable as unknown as (error: unknown) => boolean;
const selftestFixture = fixtureFrom as unknown as (root: string) => string;

function fixture(): string {
  const root = mkdtempSync(path.join(tmpdir(), "kreile-delivery-test-"));
  temps.push(root);
  cpSync(path.resolve("docs/delivery"), path.join(root, "docs/delivery"), { recursive: true });
  cpSync(path.resolve("missions"), path.join(root, "missions"), { recursive: true });
  return root;
}

function json(root: string, rel: string): Record<string, unknown> {
  return JSON.parse(readFileSync(path.join(root, rel), "utf8"));
}

function writeJson(root: string, rel: string, value: unknown): void {
  writeFileSync(path.join(root, rel), `${JSON.stringify(value, null, 2)}\n`);
}

function check(root: string) {
  return runChecker(root, process.cwd(), { mode: "off" });
}

function activePackageId(root: string): string {
  const match = /^active_package:\s*(\S+)\s*$/m.exec(readFileSync(path.join(root, DELIVERY_PATHS.mission), "utf8"));
  if (!match) throw new Error("mission active_package is missing");
  return match[1]!;
}

function activeManifestRel(root: string): string {
  return `${DELIVERY_PATHS.manifestDir}/${activePackageId(root)}.yaml`;
}

function sha256Hex(bytes: Buffer | string): string {
  return createHash("sha256").update(bytes).digest("hex");
}

function queueHandoff(root: string = process.cwd()): Handoff {
  return (json(root, DELIVERY_PATHS.queue) as { effective_base_handoff: Handoff }).effective_base_handoff;
}

function cloneJson<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

// Returns false only when the platform genuinely cannot create symlinks (permission or
// capability errors). Any other error is a real failure and propagates.
function trySymlink(target: string, link: string): boolean {
  try {
    symlinkSync(target, link);
    return true;
  } catch (error) {
    if (symlinkUnavailable(error)) return false;
    throw error;
  }
}

// Replaces a protected input of the fixture by a symlink to a byte-identical copy that lives
// in a fresh test-owned directory outside the fixture.
function symlinkInput(root: string, rel: string): boolean {
  const abs = path.join(root, rel);
  const real = path.join(tempDir("kreile-test-link-target-"), path.basename(abs));
  copyFileSync(abs, real);
  unlinkSync(abs);
  return trySymlink(real, abs);
}

afterEach(() => {
  for (const root of temps.splice(0)) rmSync(root, { recursive: true, force: true });
});

describe("delivery governance gate (retained contract checks)", () => {
  it("accepts the complete current contract set", () => {
    expect(check(process.cwd())).toEqual({ ok: true, findings: [] });
  }, 10_000);

  it("rejects a hidden alias between the active filename and package id", () => {
    const root = fixture();
    const activeId = activePackageId(root);
    const manifestPath = path.join(root, activeManifestRel(root));
    writeFileSync(
      manifestPath,
      readFileSync(manifestPath, "utf8").replace(`package_id: ${activeId}`, "package_id: KR-04-HIDDEN-ALIAS"),
    );
    const missionPath = path.join(root, DELIVERY_PATHS.mission);
    writeFileSync(missionPath, readFileSync(missionPath, "utf8").replaceAll(activeId, "KR-04-HIDDEN-ALIAS"));
    expect(check(root).findings).toContainEqual(
      expect.stringContaining("expliziten Dateiname-/Paket-ID-Bindung"),
    );
  });

  it("rejects a copied legacy package id outside its frozen path", () => {
    const root = fixture();
    cpSync(
      path.join(root, LEGACY_MANIFEST_BINDINGS["KR-00E-DELIVERY-CONTRACT"].path),
      path.join(root, DELIVERY_PATHS.manifestDir, "FAKE-LEGACY.yaml"),
    );
    expect(check(root).findings).toContainEqual(expect.stringContaining("Legacy-Ausnahme ist nur"));
  });

  it("rejects every V1 manifest outside the four frozen path-and-hash bindings", () => {
    const root = fixture();
    const legacyPath = Object.keys(LEGACY_V1_MANIFEST_BINDINGS)[0]!;
    cpSync(path.join(root, legacyPath), path.join(root, DELIVERY_PATHS.manifestDir, "FAKE-V1.yaml"));
    expect(check(root).findings).toContainEqual(expect.stringContaining("ungebundenes V1-Manifest"));
  });

  it("rejects a structured evidence reference that does not resolve", () => {
    const root = fixture();
    const manifestPath = path.join(root, activeManifestRel(root));
    writeFileSync(
      manifestPath,
      readFileSync(manifestPath, "utf8").replace(/evidence_ref:\s*\S+/, "evidence_ref: acceptance:DOES-NOT-EXIST"),
    );
    expect(check(root).findings).toContainEqual(expect.stringContaining("loest nicht im eigenen Manifest auf"));
  });

  it("rejects drift in any PR #113 path disposition", () => {
    const root = fixture();
    const disposition = json(root, DELIVERY_PATHS.pr113Disposition) as {
      path_decisions: Array<{ decision: string }>;
    };
    disposition.path_decisions[0].decision = "UNSAFE_DIRECT_IMPORT";
    writeJson(root, DELIVERY_PATHS.pr113Disposition, disposition);
    expect(check(root).findings).toContainEqual(expect.stringContaining("Disposition fuer"));
  });

  it("rejects a missing PR #113 path disposition", () => {
    const root = fixture();
    const disposition = json(root, DELIVERY_PATHS.pr113Disposition) as {
      path_decisions: Array<Record<string, unknown>>;
    };
    disposition.path_decisions.pop();
    writeJson(root, DELIVERY_PATHS.pr113Disposition, disposition);
    expect(check(root).findings).toContainEqual(
      expect.stringContaining("muss exakt 7 Pfadentscheidungen enthalten"),
    );
  });

  it("rejects PR #113 blob drift", () => {
    const root = fixture();
    const disposition = json(root, DELIVERY_PATHS.pr113Disposition) as {
      path_decisions: Array<{ parent_blob_sha: string }>;
    };
    disposition.path_decisions[0]!.parent_blob_sha = "0000000000000000000000000000000000000000";
    writeJson(root, DELIVERY_PATHS.pr113Disposition, disposition);
    expect(check(root).findings).toContainEqual(expect.stringContaining("Blobbindung fuer"));
  });

  it("rejects a PR #113 delivery claim", () => {
    const root = fixture();
    const disposition = json(root, DELIVERY_PATHS.pr113Disposition) as {
      delivery_truth: { main_delivered: boolean };
    };
    disposition.delivery_truth.main_delivered = true;
    writeJson(root, DELIVERY_PATHS.pr113Disposition, disposition);
    expect(check(root).findings).toContainEqual(
      expect.stringContaining("delivery_truth.main_delivered muss false sein"),
    );
  });

  it("rejects unknown PR #113 disposition fields", () => {
    const root = fixture();
    const disposition = json(root, DELIVERY_PATHS.pr113Disposition);
    disposition.hidden_claim = true;
    writeJson(root, DELIVERY_PATHS.pr113Disposition, disposition);
    expect(check(root).findings).toContainEqual(
      expect.stringContaining("enthaelt unerwarteten Key 'hidden_claim'"),
    );
  });

  it.each([
    ["static", 'import "./app/buchhaltung/rechnungen/RechnungenClient";'],
    ["dynamic", 'void import("@/app/buchhaltung/rechnungen/RechnungenClient");'],
    ["CommonJS", 'require("./app/buchhaltung/rechnungen/RechnungenClient");'],
  ])("rejects a real %s importer of the dead component", (_kind, source) => {
    const root = fixture();
    const probePath = path.join(root, "src/probe.ts");
    mkdirSync(path.dirname(probePath), { recursive: true });
    writeFileSync(probePath, `${source}\n`);
    expect(check(root).findings).toContainEqual(
      expect.stringContaining("Runtime-Importer muessen leer sein, gefunden src/probe.ts"),
    );
  });

  it("rejects a manifest whose planned file counts do not cover the exact allowlist", () => {
    const root = fixture();
    const manifestPath = path.join(root, activeManifestRel(root));
    writeFileSync(
      manifestPath,
      readFileSync(manifestPath, "utf8").replace(
        /planned_governance_files:\s*(\d+)/,
        (_match, count: string) => `planned_governance_files: ${Number(count) - 1}`,
      ),
    );
    expect(check(root).findings).toContainEqual(
      expect.stringContaining("nicht fuer jeden Allowlist-Pfad exakt eine geplante Datei"),
    );
  });

  it("rejects a repo source lock whose declared parent hash does not match Git", () => {
    const root = fixture();
    const manifestPath = path.join(root, activeManifestRel(root));
    const manifest = readFileSync(manifestPath, "utf8");
    const firstRepoSourceHash = manifest.match(
      /source_locks:[\s\S]*?kind: REPO_FILE[\s\S]*?sha256: ([A-F0-9]{64})/,
    )?.[1];
    expect(firstRepoSourceHash).toBeDefined();
    writeFileSync(manifestPath, manifest.replace(firstRepoSourceHash!, "0".repeat(64)));
    expect(check(root).findings).toContainEqual(expect.stringContaining("Repo-Source-Lock[0]"));
  });

  it("rejects queue and gate-mapping drift", () => {
    const root = fixture();
    const queue = json(root, DELIVERY_PATHS.queue) as { issuance_policy: { candidate_is_not_main_delivery: boolean } };
    queue.issuance_policy.candidate_is_not_main_delivery = false;
    writeJson(root, DELIVERY_PATHS.queue, queue);
    expect(check(root).findings).toContainEqual(expect.stringContaining("Rolling-Policy-Drift"));
  });

  it("rejects drift between the reviewed queue parent and the effective main handoff base", () => {
    const root = fixture();
    const queue = json(root, DELIVERY_PATHS.queue) as {
      effective_base_handoff: { queue_parent_sha: string; effective_base_sha: string };
    };
    queue.effective_base_handoff.effective_base_sha = "0000000000000000000000000000000000000001";
    writeJson(root, DELIVERY_PATHS.queue, queue);
    expect(check(root).findings).toContainEqual(expect.stringContaining("Effective-Base-Handoff-Drift"));
  });

  it("rejects a broken protected handoff parent chain", () => {
    const root = fixture();
    const queue = json(root, DELIVERY_PATHS.queue) as {
      effective_base_handoff: { entries: Array<{ parent_sha: string }> };
    };
    queue.effective_base_handoff.entries[0]!.parent_sha = "0000000000000000000000000000000000000001";
    writeJson(root, DELIVERY_PATHS.queue, queue);
    expect(check(root).findings).toContainEqual(
      expect.stringContaining("Handoff-Kette ist vor Eintrag 1 unterbrochen"),
    );
  });

  it("rejects a queue-parent reset that is not the reviewed predecessor", () => {
    const root = fixture();
    const queue = json(root, DELIVERY_PATHS.queue) as {
      effective_base_handoff: { queue_parent_sha: string };
    };
    queue.effective_base_handoff.queue_parent_sha = "0000000000000000000000000000000000000001";
    writeJson(root, DELIVERY_PATHS.queue, queue);
    expect(check(root).findings).toContainEqual(
      expect.stringContaining("Queue-Parent stimmt nicht mit dem Ausgang der Handoff-Kette ueberein"),
    );
  });

  it("binds the effective base and governance handoff to trusted commit facts", () => {
    const handoff = queueHandoff();
    const readFacts = syntheticFacts(handoff);
    expect(validateTrustedHandoff(handoff, handoff.effective_base_sha, readFacts)).toEqual([]);
    expect(validateTrustedHandoff(handoff, String(handoff.entries[0]!.merge_sha), readFacts)).toContainEqual(
      expect.stringContaining("Effective Base stimmt nicht mit dem geschuetzten Git-Checkout ueberein"),
    );
  });

  it("fails closed when the trusted Git graph cannot resolve the declared base", () => {
    expect(
      validateTrustedHandoff(queueHandoff(), queueHandoff().entries[1]!.merge_sha as string, () => {
        throw new Error("synthetic trusted graph unavailable");
      }),
    ).toContainEqual(expect.stringContaining("Geschuetzter Git-Graph konnte nicht geprueft werden"));
  });

  it("rejects option-shaped commit input before invoking Git", () => {
    expect(() => trustedCommitFacts(process.cwd(), "--help")).toThrow("ungueltiger Trusted-Commit-SHA");
  });

  it("rejects any branch-protection bypass actor", () => {
    const root = fixture();
    const receipt = json(root, DELIVERY_PATHS.operatingReceipt) as { active_ruleset: { bypass_actors: string[] } };
    receipt.active_ruleset.bypass_actors.push("admin");
    writeJson(root, DELIVERY_PATHS.operatingReceipt, receipt);
    expect(check(root).findings).toContainEqual(expect.stringContaining("should NOT have more than 0 items"));
  });

  it("keeps false delivery truth in script code even if candidate schema and receipt collude", () => {
    const root = fixture();
    const schema = json(root, DELIVERY_PATHS.operatingReceiptSchema) as {
      properties: { delivery_truth: { properties: { main_delivered: { const: boolean } } } };
    };
    schema.properties.delivery_truth.properties.main_delivered.const = true;
    writeJson(root, DELIVERY_PATHS.operatingReceiptSchema, schema);
    const receipt = json(root, DELIVERY_PATHS.operatingReceipt) as {
      delivery_truth: { main_delivered: boolean };
    };
    receipt.delivery_truth.main_delivered = true;
    writeJson(root, DELIVERY_PATHS.operatingReceipt, receipt);
    expect(check(root).findings).toContainEqual(
      expect.stringContaining("delivery_truth.main_delivered muss false sein"),
    );
  });
});

// --------------------------------------------------------- synthetic facts

const SYNTHETIC_HEAD = "a".repeat(40);
const SYNTHETIC_CANDIDATE_HEAD = "b".repeat(40);

function syntheticFacts(handoff: Handoff) {
  const facts = new Map(
    handoff.entries.map((entry) => [
      String(entry.merge_sha),
      { sha: String(entry.merge_sha), parents: [String(entry.parent_sha), String(entry.candidate_sha)], tree: String(entry.tree_sha) },
    ]),
  );
  return (sha: string) => {
    const value = facts.get(sha);
    if (!value) throw new Error(`synthetic commit fact missing: ${sha}`);
    return value;
  };
}

function syntheticGraph(handoff: Handoff, overrides: Record<string, unknown> = {}) {
  return {
    head: SYNTHETIC_HEAD,
    firstParentChain: [SYNTHETIC_HEAD, ...handoff.entries.map((entry) => String(entry.merge_sha)).reverse(), "9".repeat(40)],
    candidateHead: SYNTHETIC_CANDIDATE_HEAD,
    candidateDescendsFromHead: true,
    ...overrides,
  };
}

// A synthetic protected session: Git facts come from the declared handoff, protected
// files come from the repository under test. It lets the whole contract run in trusted
// mode without forging real commit objects.
function syntheticContext(handoff: Handoff, overrides: Partial<TrustedSession> = {}): TrustedContext {
  const session: TrustedSession = {
    commitFacts: syntheticFacts(handoff),
    graph: syntheticGraph(handoff) as TrustedSession["graph"],
    readProtectedFile: (rel) => readFileSync(path.resolve(rel), "utf8"),
    ...overrides,
  };
  return { mode: "on", anchorSha: handoff.effective_base_sha, repo: "synthetic-protected-base", openSession: () => session };
}

describe("EXIT-C trusted ancestry over synthetic Git facts", () => {
  it("accepts the declared handoff when the frozen anchor sits on the first-parent chain", () => {
    const handoff = queueHandoff();
    expect(validateTrustedHandoff(handoff, handoff.effective_base_sha, syntheticFacts(handoff))).toEqual([]);
    expect(graphFindings(handoff, handoff.effective_base_sha, syntheticGraph(handoff))).toEqual([]);
  });

  it("accepts the complete contract in trusted mode with consistent protected facts", () => {
    const handoff = queueHandoff();
    expect(runChecker(process.cwd(), process.cwd(), syntheticContext(handoff))).toEqual({ ok: true, findings: [] });
  }, 20_000);

  it("rejects an anchor reachable only through a second parent", () => {
    const handoff = queueHandoff();
    const chain = [SYNTHETIC_HEAD, "9".repeat(40)];
    expect(graphFindings(handoff, handoff.effective_base_sha, syntheticGraph(handoff, { firstParentChain: chain }))).toContainEqual(
      expect.stringContaining("First-Parent-Kette"),
    );
  });

  it("rejects a handoff merge that is missing from the first-parent chain", () => {
    const handoff = queueHandoff();
    const chain = (syntheticGraph(handoff).firstParentChain as string[]).filter(
      (sha) => sha !== String(handoff.entries[1]!.merge_sha),
    );
    expect(graphFindings(handoff, handoff.effective_base_sha, syntheticGraph(handoff, { firstParentChain: chain }))).toContainEqual(
      expect.stringContaining("Handoff-Eintrag 2: Merge liegt nicht auf der First-Parent-Kette"),
    );
  });

  it("rejects a stale candidate head", () => {
    const handoff = queueHandoff();
    expect(
      graphFindings(handoff, handoff.effective_base_sha, syntheticGraph(handoff, { candidateDescendsFromHead: false })),
    ).toContainEqual(expect.stringContaining("Veralteter Kandidaten-Head"));
  });

  it("rejects wrong parents in a handoff entry", () => {
    const handoff = cloneJson(queueHandoff());
    handoff.entries[0]!.parent_sha = "1".repeat(40);
    expect(validateTrustedHandoff(handoff, handoff.effective_base_sha, syntheticFacts(queueHandoff()))).toContainEqual(
      expect.stringContaining("Handoff-Eintrag 1: Parents stimmen nicht"),
    );
  });

  it("rejects a wrong candidate parent in a handoff entry", () => {
    const handoff = cloneJson(queueHandoff());
    handoff.entries[2]!.candidate_sha = "1".repeat(40);
    expect(validateTrustedHandoff(handoff, handoff.effective_base_sha, syntheticFacts(queueHandoff()))).toContainEqual(
      expect.stringContaining("Handoff-Eintrag 3: Parents stimmen nicht"),
    );
  });

  it("rejects a wrong merge tree in a handoff entry", () => {
    const handoff = cloneJson(queueHandoff());
    handoff.entries[1]!.tree_sha = "2".repeat(40);
    expect(validateTrustedHandoff(handoff, handoff.effective_base_sha, syntheticFacts(queueHandoff()))).toContainEqual(
      expect.stringContaining("Handoff-Eintrag 2: Tree stimmt nicht"),
    );
  });

  it("rejects a wrong effective base tree", () => {
    const handoff = cloneJson(queueHandoff());
    handoff.effective_base_tree_sha = "2".repeat(40);
    expect(validateTrustedHandoff(handoff, handoff.effective_base_sha, syntheticFacts(queueHandoff()))).toContainEqual(
      expect.stringContaining("Effective Base stimmt nicht"),
    );
  });

  it("rejects an altered frozen anchor", () => {
    const handoff = queueHandoff();
    expect(validateTrustedHandoff(handoff, String(handoff.entries[0]!.merge_sha), syntheticFacts(handoff))).toContainEqual(
      expect.stringContaining("Effective Base stimmt nicht"),
    );
  });

  it.each([
    ["undefined graph", undefined],
    ["null graph", null],
    ["empty chain", { head: SYNTHETIC_HEAD, firstParentChain: [], candidateHead: SYNTHETIC_CANDIDATE_HEAD, candidateDescendsFromHead: true }],
    ["head not first in chain", { head: SYNTHETIC_HEAD, firstParentChain: ["9".repeat(40)], candidateHead: SYNTHETIC_CANDIDATE_HEAD, candidateDescendsFromHead: true }],
    ["malformed head", { head: "nope", firstParentChain: ["nope"], candidateHead: SYNTHETIC_CANDIDATE_HEAD, candidateDescendsFromHead: true }],
    ["malformed candidate head", { head: SYNTHETIC_HEAD, firstParentChain: [SYNTHETIC_HEAD], candidateHead: "nope", candidateDescendsFromHead: true }],
    ["non-boolean ancestry", { head: SYNTHETIC_HEAD, firstParentChain: [SYNTHETIC_HEAD], candidateHead: SYNTHETIC_CANDIDATE_HEAD, candidateDescendsFromHead: "yes" }],
    ["non-array chain", { head: SYNTHETIC_HEAD, firstParentChain: SYNTHETIC_HEAD, candidateHead: SYNTHETIC_CANDIDATE_HEAD, candidateDescendsFromHead: true }],
  ])("fails closed on missing or malformed trusted graph facts: %s", (_name, graph) => {
    const handoff = queueHandoff();
    expect(graphFindings(handoff, handoff.effective_base_sha, graph)).toEqual([
      "[delivery] Trusted-Git-Graph-Fakten fehlen oder sind ungueltig",
    ]);
  });

  it("fails closed on a malformed anchor", () => {
    expect(graphFindings(queueHandoff(), "not-a-sha", syntheticGraph(queueHandoff()))).toEqual([
      "[delivery] Trusted-Git-Graph-Fakten fehlen oder sind ungueltig",
    ]);
  });

  it("fails closed when the trusted session cannot be opened", () => {
    const handoff = queueHandoff();
    const context: TrustedContext = {
      mode: "on",
      anchorSha: handoff.effective_base_sha,
      repo: "synthetic-protected-base",
      openSession: () => {
        throw new Error("synthetic session unavailable");
      },
    };
    expect(runChecker(process.cwd(), process.cwd(), context).findings).toContainEqual(
      expect.stringContaining("Geschuetzter Git-Graph konnte nicht geprueft werden"),
    );
  });

  it("fails closed when protected queue bytes cannot be read", () => {
    const handoff = queueHandoff();
    const context = syntheticContext(handoff, {
      readProtectedFile: () => {
        throw new Error("synthetic protected file unavailable");
      },
    });
    expect(runChecker(process.cwd(), process.cwd(), context).findings).toContainEqual(
      expect.stringContaining("Geschuetzte Queue oder Mission konnte nicht gelesen werden"),
    );
  });

  it("rejects stale head, second-parent-only anchor and wrong facts through the full contract", () => {
    const handoff = queueHandoff();
    const stale = runChecker(process.cwd(), process.cwd(), syntheticContext(handoff, { graph: syntheticGraph(handoff, { candidateDescendsFromHead: false }) as TrustedSession["graph"] }));
    expect(stale.ok).toBe(false);
    expect(stale.findings).toContainEqual(expect.stringContaining("Veralteter Kandidaten-Head"));
    const secondParent = runChecker(
      process.cwd(),
      process.cwd(),
      syntheticContext(handoff, { graph: syntheticGraph(handoff, { firstParentChain: [SYNTHETIC_HEAD] }) as TrustedSession["graph"] }),
    );
    expect(secondParent.findings).toContainEqual(expect.stringContaining("First-Parent-Kette"));
  }, 20_000);
});

describe("EXIT-C trust context from the protected environment", () => {
  it("is off without any trust variables", () => {
    expect(contextFromEnv({})).toEqual({ mode: "off" });
    expect(contextFromEnv({ DELIVERY_REQUIRE_TRUSTED_BASE: "false" })).toEqual({ mode: "off" });
  });

  it("accepts a complete context", () => {
    const sha = "c".repeat(40);
    expect(
      contextFromEnv({ DELIVERY_REQUIRE_TRUSTED_BASE: "true", DELIVERY_TRUSTED_BASE_SHA: sha, DELIVERY_TRUSTED_REPO: "/protected" }),
    ).toEqual({ mode: "on", anchorSha: sha, repo: "/protected" });
  });

  it.each([
    ["required without anchor or repo", { DELIVERY_REQUIRE_TRUSTED_BASE: "true" }],
    ["required without repo", { DELIVERY_REQUIRE_TRUSTED_BASE: "true", DELIVERY_TRUSTED_BASE_SHA: "c".repeat(40) }],
    ["required without anchor", { DELIVERY_REQUIRE_TRUSTED_BASE: "true", DELIVERY_TRUSTED_REPO: "/protected" }],
    ["malformed anchor", { DELIVERY_REQUIRE_TRUSTED_BASE: "true", DELIVERY_TRUSTED_BASE_SHA: "C".repeat(40), DELIVERY_TRUSTED_REPO: "/protected" }],
    ["short anchor", { DELIVERY_REQUIRE_TRUSTED_BASE: "true", DELIVERY_TRUSTED_BASE_SHA: "abc", DELIVERY_TRUSTED_REPO: "/protected" }],
    ["anchor without require flag but no repo", { DELIVERY_TRUSTED_BASE_SHA: "c".repeat(40) }],
    ["unknown require flag", { DELIVERY_REQUIRE_TRUSTED_BASE: "yes" }],
  ])("is invalid for %s", (_name, env) => {
    expect(contextFromEnv(env)).toEqual({ mode: "invalid" });
  });

  it("makes the full contract fail closed on an invalid context", () => {
    expect(runChecker(process.cwd(), process.cwd(), { mode: "invalid" }).findings).toContainEqual(
      expect.stringContaining("Geschuetzter Base-Kontext ist unvollstaendig oder ungueltig"),
    );
  });

  it("makes the full contract fail closed when the protected repository does not exist", () => {
    const handoff = queueHandoff();
    const missing = path.join(tmpdir(), "kreile-no-such-protected-repo");
    expect(
      runChecker(process.cwd(), process.cwd(), { mode: "on", anchorSha: handoff.effective_base_sha, repo: missing }).findings,
    ).toContainEqual(expect.stringContaining("Geschuetzter Git-Graph konnte nicht geprueft werden"));
  });
});

// ------------------------------------------------- queue integrity (#6, #7)

describe("EXIT-C duplicate and altered queue entries", () => {
  it("rejects a duplicated handoff entry", () => {
    const root = fixture();
    const queue = json(root, DELIVERY_PATHS.queue) as { effective_base_handoff: Handoff };
    queue.effective_base_handoff.entries.push({ ...queue.effective_base_handoff.entries[0]! });
    writeJson(root, DELIVERY_PATHS.queue, queue);
    expect(check(root).findings).toContainEqual(expect.stringContaining("verwendet PR oder SHA doppelt"));
  });

  it("rejects a reused PR number", () => {
    const root = fixture();
    const queue = json(root, DELIVERY_PATHS.queue) as { effective_base_handoff: Handoff };
    queue.effective_base_handoff.entries[1]!.pr = queue.effective_base_handoff.entries[0]!.pr;
    writeJson(root, DELIVERY_PATHS.queue, queue);
    expect(check(root).findings).toContainEqual(expect.stringContaining("verwendet PR oder SHA doppelt"));
  });

  it("rejects a reused candidate commit", () => {
    const root = fixture();
    const queue = json(root, DELIVERY_PATHS.queue) as { effective_base_handoff: Handoff };
    queue.effective_base_handoff.entries[1]!.candidate_sha = queue.effective_base_handoff.entries[0]!.candidate_sha;
    writeJson(root, DELIVERY_PATHS.queue, queue);
    expect(check(root).findings).toContainEqual(expect.stringContaining("verwendet PR oder SHA doppelt"));
  });

  it("rejects an altered entry because the manifest, mission and mapping copies drift", () => {
    const root = fixture();
    const queue = json(root, DELIVERY_PATHS.queue) as { effective_base_handoff: Handoff };
    queue.effective_base_handoff.entries[2]!.candidate_sha = "1".repeat(40);
    writeJson(root, DELIVERY_PATHS.queue, queue);
    expect(check(root).findings).toContainEqual(expect.stringContaining("Effective-Base-Handoff-Drift: mission"));
  });

  it("rejects an altered last-entry tree", () => {
    const root = fixture();
    const queue = json(root, DELIVERY_PATHS.queue) as { effective_base_handoff: Handoff };
    queue.effective_base_handoff.entries.at(-1)!.tree_sha = "3".repeat(40);
    writeJson(root, DELIVERY_PATHS.queue, queue);
    expect(check(root).findings).toContainEqual(
      expect.stringContaining("Letzter Handoff-Eintrag ist nicht die deklarierte effektive Base"),
    );
  });

  it("rejects reordered entries", () => {
    const root = fixture();
    const queue = json(root, DELIVERY_PATHS.queue) as { effective_base_handoff: Handoff };
    const entries = queue.effective_base_handoff.entries;
    [entries[0], entries[1]] = [entries[1]!, entries[0]!];
    writeJson(root, DELIVERY_PATHS.queue, queue);
    expect(check(root).findings).toContainEqual(expect.stringContaining("Handoff-Kette ist vor Eintrag 1 unterbrochen"));
  });

  it("rejects an entry without the fail-closed PASS structure", () => {
    const root = fixture();
    const queue = json(root, DELIVERY_PATHS.queue) as { effective_base_handoff: Handoff };
    queue.effective_base_handoff.entries[0]!.review_result = "PASS_WITH_OPEN_FINDINGS";
    writeJson(root, DELIVERY_PATHS.queue, queue);
    expect(check(root).findings).toContainEqual(expect.stringContaining("Handoff-Eintrag 1 hat keine fail-closed PASS-Struktur"));
  });

  it("rejects a duplicate JSON key in the queue", () => {
    const root = fixture();
    const abs = path.join(root, DELIVERY_PATHS.queue);
    writeFileSync(abs, readFileSync(abs, "utf8").replace('"schema_version": 1,', '"schema_version": 1,\n  "schema_version": 1,'));
    expect(check(root).findings).toContainEqual(expect.stringContaining("doppelter oder verbotener Key"));
  });

  it("parses strictly: duplicate, prototype and trailing data are rejected", () => {
    expect(() => parseStrict('{"a":1,"a":2}')).toThrow("doppelter oder verbotener Key");
    expect(() => parseStrict('{"__proto__":1}')).toThrow("doppelter oder verbotener Key");
    expect(() => parseStrict('{"a":1} 2')).toThrow("nachfolgende Daten");
    expect(parseStrict('{"a":[1,{"b":null}],"c":"x"}')).toEqual({ a: [1, { b: null }], c: "x" });
  });

  it("rejects a queue entry that the protected binding does not know", () => {
    const protectedQueue = json(process.cwd(), DELIVERY_PATHS.queue) as { effective_base_handoff: Handoff };
    const candidateQueue = cloneJson(protectedQueue);
    candidateQueue.effective_base_handoff.entries.push({ ...candidateQueue.effective_base_handoff.entries[0]!, pr: 9_999 });
    expect(
      bindingFindings({
        candidate: { queue: candidateQueue, mission: { active_package: activePackageId(process.cwd()) } },
        protectedData: { queue: protectedQueue, mission: { active_package: activePackageId(process.cwd()) } },
        anchorSha: protectedQueue.effective_base_handoff.effective_base_sha,
      }),
    ).toContainEqual(expect.stringContaining("Frozen-Handoff des Kandidaten"));
  });
});

// ------------------------------------------------ symlinked inputs (#8)

describe("EXIT-C symlinked protected inputs", () => {
  const protectedInputs: Array<[string, string]> = [
    ["queue", DELIVERY_PATHS.queue],
    ["mission", DELIVERY_PATHS.mission],
    ["gate mapping", DELIVERY_PATHS.mapping],
    ["operating receipt", DELIVERY_PATHS.operatingReceipt],
    ["PR #113 disposition", DELIVERY_PATHS.pr113Disposition],
    ["queue schema", DELIVERY_PATHS.queueSchema],
    ["manifest schema", DELIVERY_PATHS.manifestSchema],
  ];
  for (const [name, rel] of protectedInputs) {
    it(`rejects a symlinked ${name}`, (context) => {
      const root = fixture();
      if (!symlinkInput(root, rel)) context.skip();
      expect(check(root).findings).toContainEqual(expect.stringContaining("Symlink ist als geschuetzte Eingabe verboten"));
    });
  }

  it("rejects a symlinked manifest file", (context) => {
    const root = fixture();
    if (!trySymlink(path.join(root, activeManifestRel(root)), path.join(root, DELIVERY_PATHS.manifestDir, "ALIAS.yaml"))) {
      context.skip();
    }
    expect(check(root).findings).toContainEqual(expect.stringContaining("Manifest ist kein regulaeres File"));
  });

  it("rejects a symlinked active manifest", (context) => {
    const root = fixture();
    if (!symlinkInput(root, activeManifestRel(root))) context.skip();
    expect(check(root).findings).toContainEqual(expect.stringContaining("Manifest ist kein regulaeres File"));
  });

  it("rejects a symlinked manifest directory", (context) => {
    const root = fixture();
    const dir = path.join(root, DELIVERY_PATHS.manifestDir);
    const real = `${dir}-real`;
    renameSync(dir, real);
    if (!trySymlink(real, dir)) context.skip();
    expect(check(root).findings).toContainEqual(expect.stringContaining("Symlink ist als geschuetzte Eingabe verboten"));
  });
});

// ------------------------------------- active package binding (#13)

describe("EXIT-C data-driven active package binding", () => {
  const synthetic = (id: string, overrides: Partial<ManifestEntry> = {}): ManifestEntry => ({
    rel: `${DELIVERY_PATHS.manifestDir}/${id}.yaml`,
    value: { package_id: id, schema_version: 2 },
    ...overrides,
  });
  const mission = (id: string, current: string = id) => ({ active_package: id, execution_program_20260928: { current_package: current } });

  it("derives the binding for an arbitrary package id from canonical data", () => {
    const binding = deriveBinding(mission("KR-77Z-SYNTHETIC"), [synthetic("KR-77Z-SYNTHETIC"), synthetic("KR-78A-OTHER")]);
    expect(binding.findings).toEqual([]);
    expect(binding.active?.rel).toBe(`${DELIVERY_PATHS.manifestDir}/KR-77Z-SYNTHETIC.yaml`);
  });

  it("rejects a manifest whose file name differs from its package id", () => {
    const binding = deriveBinding(mission("KR-77Z-SYNTHETIC"), [
      synthetic("KR-77Z-SYNTHETIC", { rel: `${DELIVERY_PATHS.manifestDir}/KR-77Z-ALIAS.yaml` }),
    ]);
    expect(binding.findings).toContainEqual(expect.stringContaining("expliziten Dateiname-/Paket-ID-Bindung"));
  });

  it("rejects a mission whose current_package disagrees with active_package", () => {
    const binding = deriveBinding(mission("KR-77Z-SYNTHETIC", "KR-78A-OTHER"), [synthetic("KR-77Z-SYNTHETIC")]);
    expect(binding.findings).toContainEqual(expect.stringContaining("current_package"));
  });

  it("rejects zero and duplicate manifests for the active package", () => {
    expect(deriveBinding(mission("KR-77Z-SYNTHETIC"), [synthetic("KR-78A-OTHER")]).findings).toContainEqual(
      expect.stringContaining("muss genau ein Manifest treffen"),
    );
    const twice = deriveBinding(mission("KR-77Z-SYNTHETIC"), [
      synthetic("KR-77Z-SYNTHETIC"),
      synthetic("KR-77Z-SYNTHETIC", { rel: `${DELIVERY_PATHS.manifestDir}/COPY.yaml` }),
    ]);
    expect(twice.findings).toContainEqual(expect.stringContaining("muss genau ein Manifest treffen"));
    expect(twice.active).toBeNull();
  });

  it.each([undefined, null, "", "not-a-package", "KR-1-SHORT", 42])("rejects an invalid active_package value %j", (value) => {
    const binding = deriveBinding({ active_package: value }, []);
    expect(binding.findings).toContainEqual(expect.stringContaining("ist keine gueltige Paket-ID"));
    expect(binding.active).toBeNull();
  });

  it("rejects a frozen legacy package as the active package", () => {
    const binding = deriveBinding(mission("KR-00E-DELIVERY-CONTRACT"), [
      synthetic("KR-00E-DELIVERY-CONTRACT"),
    ]);
    expect(binding.findings).toContainEqual(expect.stringContaining("eingefrorenes Legacy-Paket"));
  });

  it("rejects an active package that is still a queue pointer", () => {
    const root = fixture();
    const queue = json(root, DELIVERY_PATHS.queue) as { initial_horizon: Array<{ package_id: string }> };
    const pointer = queue.initial_horizon[0]!.package_id;
    const missionPath = path.join(root, DELIVERY_PATHS.mission);
    writeFileSync(missionPath, readFileSync(missionPath, "utf8").replace(/^active_package:\s*\S+/m, `active_package: ${pointer}`));
    expect(check(root).findings).toContainEqual(expect.stringContaining("muss genau ein Manifest treffen"));
  });

  it("rejects a renamed active manifest file", () => {
    const root = fixture();
    renameSync(path.join(root, activeManifestRel(root)), path.join(root, DELIVERY_PATHS.manifestDir, "RENAMED-ACTIVE.yaml"));
    expect(check(root).findings).toContainEqual(expect.stringContaining("expliziten Dateiname-/Paket-ID-Bindung"));
  });

  it("rejects a copied active manifest", () => {
    const root = fixture();
    copyFileSync(path.join(root, activeManifestRel(root)), path.join(root, DELIVERY_PATHS.manifestDir, "COPY.yaml"));
    expect(check(root).findings).toContainEqual(expect.stringContaining("muss genau ein Manifest treffen"));
  });

  it("rejects a mission current_package that differs from active_package", () => {
    const root = fixture();
    const missionPath = path.join(root, DELIVERY_PATHS.mission);
    writeFileSync(missionPath, readFileSync(missionPath, "utf8").replace(/^(\s*current_package:\s*)\S+/m, "$1KR-04-OTHER-PACKAGE"));
    expect(check(root).findings).toContainEqual(expect.stringContaining("Mission current_package"));
  });

  it("rejects a queue successor pointer that is not bound to the active package", () => {
    const root = fixture();
    const queue = json(root, DELIVERY_PATHS.queue) as { next_contract_blueprint: { predecessor: string } };
    queue.next_contract_blueprint.predecessor = "KR-04-OTHER-PACKAGE";
    writeJson(root, DELIVERY_PATHS.queue, queue);
    expect(check(root).findings).toContainEqual(expect.stringContaining("Queue-Nachfolgerzeiger"));
  });

  it("rejects a candidate-selected active package in trusted mode", () => {
    const handoff = queueHandoff();
    const root = fixture();
    const queue = json(root, DELIVERY_PATHS.queue) as { initial_horizon: Array<{ package_id: string }> };
    const nonAdjacent = queue.initial_horizon[1]!.package_id;
    const protectedQueue = json(process.cwd(), DELIVERY_PATHS.queue);
    expect(
      bindingFindings({
        candidate: { queue: protectedQueue, mission: { active_package: nonAdjacent } },
        protectedData: { queue: protectedQueue, mission: { active_package: activePackageId(process.cwd()) } },
        anchorSha: handoff.effective_base_sha,
      }),
    ).toContainEqual(expect.stringContaining("Aktives Paket des Kandidaten"));
  });

  it("allows the protected active package and its single successor pointer", () => {
    const handoff = queueHandoff();
    const protectedQueue = json(process.cwd(), DELIVERY_PATHS.queue) as { next_contract_blueprint: { package_id: string } };
    for (const allowed of [activePackageId(process.cwd()), protectedQueue.next_contract_blueprint.package_id]) {
      expect(
        bindingFindings({
          candidate: { queue: protectedQueue, mission: { active_package: allowed } },
          protectedData: { queue: protectedQueue, mission: { active_package: activePackageId(process.cwd()) } },
          anchorSha: handoff.effective_base_sha,
        }),
      ).toEqual([]);
    }
  });

  it("keeps every concrete package id out of the checker bytes", () => {
    const source = readFileSync(CHECKER_SOURCE, "utf8");
    const queue = json(process.cwd(), DELIVERY_PATHS.queue) as { initial_horizon: Array<{ package_id: string }> };
    const ids = [activePackageId(process.cwd()), ...queue.initial_horizon.map((entry) => entry.package_id)];
    for (const id of ids) expect(source).not.toContain(id);
    expect(source).not.toContain("ACTIVE_MANIFEST_BINDING");
  });
});

// ------------------------------------------------------ resolver (retained)

const RESOLVER_SOURCE = path.resolve("scripts/quality/resolve-delivery-trust-anchor.mjs");
const RESOLVER_REL = "scripts/quality/resolve-delivery-trust-anchor.mjs";
const QUEUE_REL = "docs/delivery/ROLLING_MANIFEST_QUEUE_V1.json";
const CHECKER_SOURCE = path.resolve("scripts/quality/check-delivery-contracts.mjs");
const IDENTITY = [
  "-c",
  "user.name=Resolver Test",
  "-c",
  "user.email=resolver-test@example.invalid",
  "-c",
  "commit.gpgsign=false",
  "-c",
  "core.autocrlf=false",
];

type QueueDoc = {
  schema_version: number;
  effective_base_handoff: {
    queue_parent_sha: string;
    effective_base_sha: string;
    effective_base_tree_sha: string;
    entries: Array<Record<string, unknown>>;
  };
};

type Graph = { repo: string; base: string; anchor: string; parent: string; tree: string };
type Candidate = { repo: string; head: string };
type CandidateKind = "merge" | "squash" | "rebase" | "stale";

function git(repo: string, args: string[]): string {
  const result = spawnSync("git", ["-C", repo, ...IDENTITY, ...args], {
    encoding: "utf8",
    env: { ...process.env, GIT_CONFIG_NOSYSTEM: "1", GIT_TERMINAL_PROMPT: "0" },
  });
  if (result.status !== 0) throw new Error(`git ${args.join(" ")} failed: ${result.stderr}`);
  return result.stdout.trim();
}

function tempDir(prefix: string): string {
  const dir = mkdtempSync(path.join(tmpdir(), prefix));
  temps.push(dir);
  return dir;
}

function commitFile(repo: string, rel: string, text: string): string {
  writeFileSync(path.join(repo, rel), text);
  git(repo, ["add", "--", rel]);
  git(repo, ["commit", "-q", "-m", `change ${rel}`]);
  return git(repo, ["rev-parse", "HEAD"]);
}

function buildTrusted(
  shape: "linear" | "second-parent",
  options: {
    mutate?: (queue: QueueDoc) => void;
    rawQueue?: (text: string) => string;
    symlinkQueueInTree?: boolean;
  } = {},
): Graph {
  const repo = tempDir("kreile-resolver-trusted-");
  mkdirSync(path.join(repo, "docs/delivery"), { recursive: true });
  mkdirSync(path.join(repo, "scripts/quality"), { recursive: true });
  git(repo, ["init", "-q"]);
  git(repo, ["symbolic-ref", "HEAD", "refs/heads/main"]);
  const parent = commitFile(repo, "root.txt", "root\n");
  git(repo, ["checkout", "-q", "-b", "feature"]);
  const candidate = commitFile(repo, "feature.txt", "feature\n");
  git(repo, ["checkout", "-q", "-b", "anchorline", parent]);
  git(repo, ["merge", "--no-ff", "-q", "-m", "merge feature", candidate]);
  const anchor = git(repo, ["rev-parse", "HEAD"]);
  const tree = git(repo, ["rev-parse", "HEAD^{tree}"]);
  if (shape === "second-parent") {
    git(repo, ["checkout", "-q", "-b", "mainline", parent]);
    commitFile(repo, "side.txt", "side\n");
    git(repo, ["merge", "--no-ff", "-q", "-m", "merge anchor line", "anchorline"]);
  }
  const queue: QueueDoc = {
    schema_version: 1,
    effective_base_handoff: {
      queue_parent_sha: parent,
      effective_base_sha: anchor,
      effective_base_tree_sha: tree,
      entries: [
        {
          pr: 1,
          parent_sha: parent,
          candidate_sha: candidate,
          merge_sha: anchor,
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
  options.mutate?.(queue);
  const text = `${JSON.stringify(queue, null, 2)}\n`;
  writeFileSync(path.join(repo, QUEUE_REL), options.rawQueue ? options.rawQueue(text) : text);
  copyFileSync(RESOLVER_SOURCE, path.join(repo, RESOLVER_REL));
  git(repo, ["add", "--", RESOLVER_REL]);
  if (options.symlinkQueueInTree) {
    const target = path.join(tempDir("kreile-resolver-link-"), "target.txt");
    writeFileSync(target, "other-queue.json");
    const blob = git(repo, ["hash-object", "-w", target]);
    git(repo, ["update-index", "--add", "--cacheinfo", `120000,${blob},${QUEUE_REL}`]);
  } else {
    git(repo, ["add", "--", QUEUE_REL]);
  }
  git(repo, ["commit", "-q", "-m", "queue and resolver"]);
  return { repo, base: git(repo, ["rev-parse", "HEAD"]), anchor, parent, tree };
}

function buildCandidate(trusted: Graph, kind: CandidateKind): Candidate {
  const repo = tempDir("kreile-resolver-candidate-");
  cpSync(trusted.repo, repo, { recursive: true });
  if (kind === "squash") {
    git(repo, ["checkout", "-q", "-b", "cand", trusted.base]);
    commitFile(repo, "squash.txt", "squash\n");
  } else if (kind === "merge") {
    git(repo, ["checkout", "-q", "-b", "cand", trusted.anchor]);
    commitFile(repo, "merge-side.txt", "side\n");
    git(repo, ["merge", "--no-ff", "-q", "-m", "merge current base", trusted.base]);
  } else if (kind === "rebase") {
    git(repo, ["checkout", "-q", "-b", "cand", trusted.anchor]);
    commitFile(repo, "rebase-1.txt", "1\n");
    commitFile(repo, "rebase-2.txt", "2\n");
    git(repo, ["rebase", "-q", "--onto", trusted.base, trusted.anchor]);
  } else {
    git(repo, ["checkout", "-q", "-b", "cand", trusted.anchor]);
    commitFile(repo, "stale.txt", "stale\n");
  }
  return { repo, head: git(repo, ["rev-parse", "HEAD"]) };
}

function runResolver(
  trusted: Graph,
  candidate: Candidate,
  options: { script?: string; base?: string; head?: string } = {},
) {
  const output = path.join(tempDir("kreile-resolver-output-"), "github-output");
  writeFileSync(output, "");
  const result = spawnSync(
    process.execPath,
    [
      options.script ?? path.join(trusted.repo, RESOLVER_REL),
      "--trusted-repo",
      trusted.repo,
      "--candidate-repo",
      candidate.repo,
      "--base-sha",
      options.base ?? trusted.base,
      "--head-sha",
      options.head ?? candidate.head,
      "--github-output",
      output,
    ],
    { encoding: "utf8" },
  );
  return { status: result.status, stderr: result.stderr, output: readFileSync(output, "utf8") };
}

function expectRejected(result: ReturnType<typeof runResolver>, reason: RegExp): void {
  expect(result.stderr).toMatch(reason);
  expect(result.status).toBe(1);
  expect(result.output).toBe("");
}

describe("KR-GOV-FIXPOINT-EXIT-A protected-base anchor resolver", () => {
  it("passes its own hermetic self-test without network", () => {
    const result = spawnSync(process.execPath, [RESOLVER_SOURCE, "--self-test"], { encoding: "utf8" });
    expect(result.stderr).toBe("");
    expect(result.status).toBe(0);
    expect(result.stdout).toContain("RESOLVER_SELF_TEST_PASS");
  }, 120_000);

  it.each(["merge", "squash", "rebase"] as const)(
    "resolves the frozen anchor for a %s descendant of the current base",
    (kind) => {
      const trusted = buildTrusted("linear");
      const candidate = buildCandidate(trusted, kind);
      const result = runResolver(trusted, candidate);
      expect(result.stderr).toBe("");
      expect(result.status).toBe(0);
      expect(result.output).toBe(`trusted_base_sha=${trusted.anchor}\n`);
    },
    60_000,
  );

  it("rejects an anchor reachable only through a second-parent, requiring first-parent ancestry", () => {
    const trusted = buildTrusted("second-parent");
    const candidate = buildCandidate(trusted, "squash");
    expectRejected(runResolver(trusted, candidate), /first-parent chain/);
  }, 60_000);

  it("rejects a stale candidate head that does not descend from the current base", () => {
    const trusted = buildTrusted("linear");
    const candidate = buildCandidate(trusted, "stale");
    expectRejected(runResolver(trusted, candidate), /stale candidate head/);
  }, 60_000);

  it("rejects a handoff entry with a wrong parent", () => {
    const bogus = "1".repeat(40);
    const trusted = buildTrusted("linear", {
      mutate: (queue) => {
        queue.effective_base_handoff.queue_parent_sha = bogus;
        queue.effective_base_handoff.entries[0]!.parent_sha = bogus;
      },
    });
    expectRejected(runResolver(trusted, buildCandidate(trusted, "squash")), /wrong parent/);
  }, 60_000);

  it("rejects a handoff entry with a wrong tree", () => {
    const bogus = "2".repeat(40);
    const trusted = buildTrusted("linear", {
      mutate: (queue) => {
        queue.effective_base_handoff.effective_base_tree_sha = bogus;
        queue.effective_base_handoff.entries[0]!.tree_sha = bogus;
      },
    });
    expectRejected(runResolver(trusted, buildCandidate(trusted, "squash")), /wrong tree/);
  }, 60_000);

  it("rejects an altered entry whose merge commit is not a two-parent handoff merge", () => {
    const altered = buildTrusted("linear", {
      mutate: (queue) => {
        const entry = queue.effective_base_handoff.entries[0]!;
        queue.effective_base_handoff.effective_base_sha = entry.parent_sha as string;
        entry.merge_sha = entry.parent_sha;
      },
    });
    expectRejected(runResolver(altered, buildCandidate(altered, "squash")), /exactly two parents/);
  }, 60_000);

  it("rejects duplicate handoff entries", () => {
    const trusted = buildTrusted("linear", {
      mutate: (queue) => {
        queue.effective_base_handoff.entries.push({ ...queue.effective_base_handoff.entries[0]! });
      },
    });
    expectRejected(runResolver(trusted, buildCandidate(trusted, "squash")), /duplicate handoff entry/);
  }, 60_000);

  it("rejects a duplicate JSON key in the protected queue", () => {
    const trusted = buildTrusted("linear", {
      rawQueue: (text) => text.replace('"schema_version": 1,', '"schema_version": 1,\n  "schema_version": 1,'),
    });
    expectRejected(runResolver(trusted, buildCandidate(trusted, "squash")), /duplicate or forbidden key/);
  }, 60_000);

  it("rejects a queue stored as a symlink in the protected base tree", () => {
    const trusted = buildTrusted("linear", { symlinkQueueInTree: true });
    expectRejected(runResolver(trusted, buildCandidate(trusted, "squash")), /symlink forbidden for queue/);
  }, 60_000);

  it("rejects a queue symlink in the protected work tree", (context) => {
    const trusted = buildTrusted("linear");
    const candidate = buildCandidate(trusted, "squash");
    const queuePath = path.join(trusted.repo, QUEUE_REL);
    unlinkSync(queuePath);
    if (!trySymlink(path.join(candidate.repo, QUEUE_REL), queuePath)) context.skip();
    expectRejected(runResolver(trusted, candidate), /symlink forbidden for queue/);
  }, 60_000);

  it("never lets candidate bytes select the anchor", () => {
    const trusted = buildTrusted("linear");
    const candidate = buildCandidate(trusted, "squash");
    const queue = JSON.parse(readFileSync(path.join(candidate.repo, QUEUE_REL), "utf8")) as QueueDoc;
    queue.effective_base_handoff.effective_base_sha = trusted.base;
    writeFileSync(path.join(candidate.repo, QUEUE_REL), `${JSON.stringify(queue, null, 2)}\n`);
    git(candidate.repo, ["add", "--", QUEUE_REL]);
    git(candidate.repo, ["commit", "-q", "-m", "candidate selects its own anchor"]);
    const head = git(candidate.repo, ["rev-parse", "HEAD"]);
    const result = runResolver(trusted, { repo: candidate.repo, head });
    expect(result.status).toBe(0);
    expect(result.output).toBe(`trusted_base_sha=${trusted.anchor}\n`);
  }, 60_000);

  it("refuses to run resolver bytes that live in the candidate checkout", () => {
    const trusted = buildTrusted("linear");
    const candidate = buildCandidate(trusted, "squash");
    const hostile = path.join(candidate.repo, RESOLVER_REL);
    copyFileSync(RESOLVER_SOURCE, hostile);
    expectRejected(runResolver(trusted, candidate, { script: hostile }), /protected-base checkout only/);
  }, 60_000);

  it("rejects a candidate checkout whose HEAD is not the declared head", () => {
    const trusted = buildTrusted("linear");
    const candidate = buildCandidate(trusted, "squash");
    expectRejected(
      runResolver(trusted, candidate, { head: trusted.anchor }),
      /candidate repository HEAD is not the PR head/,
    );
  }, 60_000);

  it("fails closed on missing, unknown and duplicate arguments", () => {
    const run = (args: string[]) => spawnSync(process.execPath, [RESOLVER_SOURCE, ...args], { encoding: "utf8" });
    expect(run([])).toMatchObject({ status: 1, stderr: expect.stringContaining("missing required argument") });
    expect(run(["--other", "x"])).toMatchObject({ status: 1, stderr: expect.stringContaining("unknown argument") });
    expect(run(["--base-sha", "a", "--base-sha", "b"])).toMatchObject({
      status: 1,
      stderr: expect.stringContaining("duplicate argument"),
    });
  });
});

// ------------------------------------------- real Git facts for the checker

function trustedQueueHandoff(trusted: Graph): Handoff {
  return (JSON.parse(readFileSync(path.join(trusted.repo, QUEUE_REL), "utf8")) as { effective_base_handoff: Handoff })
    .effective_base_handoff;
}

describe("EXIT-C trusted ancestry over real Git facts", () => {
  it.each(["merge", "squash", "rebase"] as const)(
    "accepts a %s descendant of the current protected base",
    (kind) => {
      const trusted = buildTrusted("linear");
      const candidate = buildCandidate(trusted, kind);
      const session = openSession(trusted.repo, candidate.repo);
      const handoff = trustedQueueHandoff(trusted);
      expect(session.graph.head).toBe(trusted.base);
      expect(session.graph.candidateHead).toBe(candidate.head);
      expect(validateTrustedHandoff(handoff, trusted.anchor, session.commitFacts)).toEqual([]);
      expect(graphFindings(handoff, trusted.anchor, session.graph)).toEqual([]);
    },
    60_000,
  );

  it("rejects an anchor reachable only through a second parent", () => {
    const trusted = buildTrusted("second-parent");
    const session = openSession(trusted.repo, buildCandidate(trusted, "squash").repo);
    expect(graphFindings(trustedQueueHandoff(trusted), trusted.anchor, session.graph)).toContainEqual(
      expect.stringContaining("First-Parent-Kette"),
    );
  }, 60_000);

  it("rejects a stale candidate head", () => {
    const trusted = buildTrusted("linear");
    const session = openSession(trusted.repo, buildCandidate(trusted, "stale").repo);
    expect(session.graph.candidateDescendsFromHead).toBe(false);
    expect(graphFindings(trustedQueueHandoff(trusted), trusted.anchor, session.graph)).toContainEqual(
      expect.stringContaining("Veralteter Kandidaten-Head"),
    );
  }, 60_000);

  it("rejects wrong parents and wrong trees against real commit objects", () => {
    const trusted = buildTrusted("linear");
    const session = openSession(trusted.repo, buildCandidate(trusted, "squash").repo);

    const wrongParent = cloneJson(trustedQueueHandoff(trusted));
    wrongParent.entries[0]!.parent_sha = "1".repeat(40);
    expect(validateTrustedHandoff(wrongParent, trusted.anchor, session.commitFacts)).toContainEqual(
      expect.stringContaining("Parents stimmen nicht"),
    );

    const wrongCandidate = cloneJson(trustedQueueHandoff(trusted));
    wrongCandidate.entries[0]!.candidate_sha = trusted.base;
    expect(validateTrustedHandoff(wrongCandidate, trusted.anchor, session.commitFacts)).toContainEqual(
      expect.stringContaining("Parents stimmen nicht"),
    );

    const wrongTree = cloneJson(trustedQueueHandoff(trusted));
    wrongTree.entries[0]!.tree_sha = "2".repeat(40);
    expect(validateTrustedHandoff(wrongTree, trusted.anchor, session.commitFacts)).toContainEqual(
      expect.stringContaining("Tree stimmt nicht"),
    );

    const notAMerge = cloneJson(trustedQueueHandoff(trusted));
    notAMerge.entries[0]!.merge_sha = trusted.parent;
    expect(validateTrustedHandoff(notAMerge, trusted.anchor, session.commitFacts)).toContainEqual(
      expect.stringContaining("Parents stimmen nicht"),
    );
  }, 60_000);

  it("rejects the moving protected base as the anchor", () => {
    const trusted = buildTrusted("linear");
    const session = openSession(trusted.repo, buildCandidate(trusted, "squash").repo);
    const selfSelected = cloneJson(trustedQueueHandoff(trusted));
    selfSelected.effective_base_sha = trusted.base;
    expect(validateTrustedHandoff(selfSelected, trusted.anchor, session.commitFacts)).toContainEqual(
      expect.stringContaining("Effective Base stimmt nicht"),
    );
    const protectedQueue = parseStrict(session.readProtectedFile(QUEUE_REL));
    const candidateQueue = cloneJson(protectedQueue) as QueueDoc;
    candidateQueue.effective_base_handoff.effective_base_sha = trusted.base;
    expect(
      bindingFindings({
        candidate: { queue: candidateQueue, mission: { active_package: "KR-77Z-SYNTHETIC" } },
        protectedData: { queue: protectedQueue, mission: { active_package: "KR-77Z-SYNTHETIC" } },
        anchorSha: trusted.anchor,
      }),
    ).toContainEqual(expect.stringContaining("Frozen-Handoff des Kandidaten"));
  }, 60_000);

  it("reads protected files only from the protected base tree and refuses links", () => {
    const trusted = buildTrusted("linear");
    const candidate = buildCandidate(trusted, "squash");
    const session = openSession(trusted.repo, candidate.repo);
    expect(parseStrict(session.readProtectedFile(QUEUE_REL))).toEqual(JSON.parse(readFileSync(path.join(trusted.repo, QUEUE_REL), "utf8")));
    expect(() => session.readProtectedFile("docs/delivery/DOES_NOT_EXIST.json")).toThrow("fehlt im geschuetzten Base-Tree");
    const linked = buildTrusted("linear", { symlinkQueueInTree: true });
    expect(() => openSession(linked.repo, buildCandidate(linked, "squash").repo).readProtectedFile(QUEUE_REL)).toThrow(
      "Symlink verboten",
    );
  }, 60_000);

  it("fails closed when real Git facts are missing or ambiguous", () => {
    const trusted = buildTrusted("linear");
    const candidate = buildCandidate(trusted, "squash");
    expect(() => openSession(path.join(tmpdir(), "kreile-no-such-trusted-repo"), candidate.repo)).toThrow("existiert nicht");
    expect(() => openSession(trusted.repo, tempDir("kreile-not-a-repo-"))).toThrow();
    expect(() => openSession(trusted.repo, trusted.repo)).toThrow("verschiedene Checkouts");
    expect(() => openSession("", candidate.repo)).toThrow("fehlt");
    expect(() => trustedCommitFacts(trusted.repo, "f".repeat(40))).toThrow();
  }, 60_000);
});

// --------------------------------- candidate-selected inputs (#9, #10)

describe("EXIT-C candidate-selected checker, anchor, base and head", () => {
  it.each(["--trusted-base-sha", "--base-sha", "--head-sha", "--anchor", "--checker-sha256", "--trusted-repo", "--candidate-repo"])(
    "does not accept %s as an input",
    (flag) => {
      expect(() => parseCliArgs([flag, "a".repeat(40)])).toThrow("Unbekanntes Argument");
    },
  );

  it("rejects duplicate and valueless arguments", () => {
    expect(() => parseCliArgs(["--root", "a", "--root", "b"])).toThrow("Doppeltes Argument");
    expect(() => parseCliArgs(["--selftest", "--selftest"])).toThrow("Doppeltes Argument");
    expect(() => parseCliArgs(["--root"])).toThrow("braucht einen Wert");
    expect(() => parseCliArgs(["--root", "--selftest"])).toThrow("braucht einen Wert");
    expect(() => parseCliArgs(["--expect-self-sha256"])).toThrow("braucht einen Wert");
  });

  it("parses the supported arguments", () => {
    const parsed = parseCliArgs(["--root", "x", "--selftest", "--expect-self-sha256", "a".repeat(64)]);
    expect(parsed).toEqual({ root: path.resolve("x"), selftest: true, expectSelfSha256: "a".repeat(64) });
  });

  it("refuses to run checker bytes that live in the candidate checkout", () => {
    expect(locationFindings(CHECKER_SOURCE, process.cwd())).toContainEqual(expect.stringContaining("Kandidaten-Checkout"));
    const outside = path.join(tempDir("kreile-isolated-checker-"), "check-delivery-contracts.mjs");
    copyFileSync(CHECKER_SOURCE, outside);
    expect(locationFindings(outside, process.cwd())).toEqual([]);
  });

  it("refuses a symlinked checker file", (context) => {
    const dir = tempDir("kreile-linked-checker-");
    const real = path.join(dir, "real.mjs");
    copyFileSync(CHECKER_SOURCE, real);
    const link = path.join(dir, "check-delivery-contracts.mjs");
    if (!trySymlink(real, link)) context.skip();
    expect(locationFindings(link, process.cwd())).toContainEqual(expect.stringContaining("Symlink"));
    expect(bytesFindings(link, sha256Hex(readFileSync(real)))).toContainEqual(expect.stringContaining("Symlink"));
  });

  it("exits non-zero when trusted mode runs the checker from the candidate checkout", () => {
    const result = spawnSync(process.execPath, [CHECKER_SOURCE, "--root", process.cwd()], {
      encoding: "utf8",
      env: {
        ...process.env,
        DELIVERY_REQUIRE_TRUSTED_BASE: "true",
        DELIVERY_TRUSTED_BASE_SHA: "c".repeat(40),
        DELIVERY_TRUSTED_REPO: tempDir("kreile-protected-"),
      },
    });
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("Kandidaten-Checkout");
  }, 60_000);

  it("exits non-zero on an unknown, candidate-selected argument", () => {
    const result = spawnSync(process.execPath, [CHECKER_SOURCE, "--head-sha", "a".repeat(40)], { encoding: "utf8" });
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("Unbekanntes Argument");
  }, 60_000);

  it("ignores candidate data that names a different anchor, parent or tree", () => {
    const handoff = queueHandoff();
    const protectedQueue = json(process.cwd(), DELIVERY_PATHS.queue) as {
      effective_base_handoff: Handoff;
      parent_candidate: { candidate_sha: string; tree_sha: string };
    };
    const activeId = activePackageId(process.cwd());
    const mutate = (change: (queue: typeof protectedQueue) => void) => {
      const candidateQueue = cloneJson(protectedQueue);
      change(candidateQueue);
      return bindingFindings({
        candidate: { queue: candidateQueue, mission: { active_package: activeId } },
        protectedData: { queue: protectedQueue, mission: { active_package: activeId } },
        anchorSha: handoff.effective_base_sha,
      });
    };
    expect(mutate((queue) => (queue.effective_base_handoff.effective_base_sha = "e".repeat(40)))).toContainEqual(
      expect.stringContaining("Frozen-Handoff des Kandidaten"),
    );
    expect(mutate((queue) => (queue.effective_base_handoff.effective_base_tree_sha = "e".repeat(40)))).toContainEqual(
      expect.stringContaining("Frozen-Handoff des Kandidaten"),
    );
    expect(mutate((queue) => (queue.effective_base_handoff.queue_parent_sha = "e".repeat(40)))).toContainEqual(
      expect.stringContaining("Frozen-Handoff des Kandidaten"),
    );
    expect(mutate((queue) => (queue.parent_candidate.candidate_sha = "e".repeat(40)))).toContainEqual(
      expect.stringContaining("Queue-Parent des Kandidaten"),
    );
    expect(mutate((queue) => (queue.parent_candidate.tree_sha = "e".repeat(40)))).toContainEqual(
      expect.stringContaining("Queue-Parent des Kandidaten"),
    );
    expect(mutate(() => undefined)).toEqual([]);
  });

  it("rejects a resolver anchor that the protected queue does not declare", () => {
    const protectedQueue = json(process.cwd(), DELIVERY_PATHS.queue);
    const activeId = activePackageId(process.cwd());
    expect(
      bindingFindings({
        candidate: { queue: protectedQueue, mission: { active_package: activeId } },
        protectedData: { queue: protectedQueue, mission: { active_package: activeId } },
        anchorSha: "e".repeat(40),
      }),
    ).toContainEqual(expect.stringContaining("Aufgeloester Frozen Anchor"));
  });

  it("rejects unreadable protected data", () => {
    const activeId = activePackageId(process.cwd());
    for (const protectedData of [null, undefined, { queue: null, mission: {} }, { queue: {}, mission: null }]) {
      expect(
        bindingFindings({ candidate: { queue: {}, mission: { active_package: activeId } }, protectedData, anchorSha: "e".repeat(40) }),
      ).toEqual(["[delivery] Geschuetzte Queue- oder Mission-Daten fehlen oder sind ungueltig"]);
    }
  });
});

// ------------------------------------------- seed bytes and hash (#11)

function isolatedChecker(content: Buffer | string): string | null {
  const dir = tempDir("kreile-isolated-run-");
  const target = path.join(dir, "check-delivery-contracts.mjs");
  writeFileSync(target, content);
  return trySymlink(path.resolve("node_modules"), path.join(dir, "node_modules")) ? target : null;
}

describe("EXIT-C seed checker bytes and hash", () => {
  it("accepts exactly the expected bytes, in either hex case", () => {
    const hash = sha256Hex(readFileSync(CHECKER_SOURCE));
    expect(bytesFindings(CHECKER_SOURCE, hash)).toEqual([]);
    expect(bytesFindings(CHECKER_SOURCE, hash.toUpperCase())).toEqual([]);
  });

  it("rejects any other bytes", () => {
    const original = readFileSync(CHECKER_SOURCE);
    const hash = sha256Hex(original);
    const dir = tempDir("kreile-tampered-checker-");
    const tampered = path.join(dir, "check-delivery-contracts.mjs");
    writeFileSync(tampered, Buffer.concat([original, Buffer.from("\n// tampered\n")]));
    expect(bytesFindings(tampered, hash)).toContainEqual(expect.stringContaining("stimmen nicht mit dem erwarteten Hash"));
    writeFileSync(tampered, original.subarray(0, original.length - 1));
    expect(bytesFindings(tampered, hash)).toContainEqual(expect.stringContaining("stimmen nicht mit dem erwarteten Hash"));
  });

  it.each(["", "abc", "g".repeat(64), "a".repeat(63), "a".repeat(65)])("rejects the malformed expected hash %j", (hash) => {
    expect(bytesFindings(CHECKER_SOURCE, hash)).toEqual(["[delivery] Erwarteter Checker-SHA-256 ist ungueltig"]);
  });

  it("rejects a missing checker file", () => {
    expect(bytesFindings(path.join(tempDir("kreile-missing-checker-"), "absent.mjs"), "a".repeat(64))).toContainEqual(
      expect.stringContaining("konnten nicht geprueft werden"),
    );
  });

  it("makes the checker CLI refuse tampered bytes", (context) => {
    const original = readFileSync(CHECKER_SOURCE);
    const tampered = isolatedChecker(Buffer.concat([original, Buffer.from("\n// tampered\n")]));
    if (!tampered) context.skip();
    const result = spawnSync(
      process.execPath,
      [tampered!, "--selftest", "--root", process.cwd(), "--expect-self-sha256", sha256Hex(original)],
      { encoding: "utf8" },
    );
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("stimmen nicht mit dem erwarteten Hash");
    expect(result.stdout).not.toContain("PASS");
  }, 60_000);

  it("makes the checker CLI refuse a malformed expected hash", (context) => {
    const isolated = isolatedChecker(readFileSync(CHECKER_SOURCE));
    if (!isolated) context.skip();
    const result = spawnSync(process.execPath, [isolated!, "--selftest", "--root", process.cwd(), "--expect-self-sha256", "abc"], {
      encoding: "utf8",
    });
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("ungueltig");
  }, 60_000);

  it("runs the hermetic self-test through the CLI when the bytes match", (context) => {
    const original = readFileSync(CHECKER_SOURCE);
    const isolated = isolatedChecker(original);
    if (!isolated) context.skip();
    const result = spawnSync(
      process.execPath,
      [isolated!, "--selftest", "--root", process.cwd(), "--expect-self-sha256", sha256Hex(original)],
      { encoding: "utf8", env: { ...process.env, DELIVERY_REQUIRE_TRUSTED_BASE: undefined, DELIVERY_TRUSTED_BASE_SHA: undefined, DELIVERY_TRUSTED_REPO: undefined } },
    );
    expect(result.stderr).toBe("");
    expect(result.status).toBe(0);
    expect(result.stdout).toMatch(/delivery-contracts selftest: PASS \((\d+)\/\1\)/);
  }, 180_000);

  // The coordinator binds the reviewed seed hash outside this repository and passes it
  // here, so that the installed bytes cannot differ from the independently reviewed seed.
  it.skipIf(!process.env.KR_EXIT_C_SEED_CHECKER_SHA256)("installs exactly the externally bound seed bytes", () => {
    expect(bytesFindings(CHECKER_SOURCE, process.env.KR_EXIT_C_SEED_CHECKER_SHA256!)).toEqual([]);
  });
});

// -------------------------------- self-test source boundary (no write-through)

const SELFTEST_TMP_PREFIXES = ["kreile-delivery-selftest-", "kreile-delivery-selftest-link-"];

function selftestTempEntries(): Set<string> {
  return new Set(readdirSync(tmpdir()).filter((name) => SELFTEST_TMP_PREFIXES.some((prefix) => name.startsWith(prefix))));
}

function canaryFile(): { file: string; bytes: Buffer } {
  const file = path.join(tempDir("kreile-canary-"), "canary.txt");
  writeFileSync(file, "CANARY-MUST-NOT-CHANGE\n");
  return { file, bytes: readFileSync(file) };
}

describe("EXIT-C self-test never follows, preserves or writes through candidate symlinks", () => {
  const selftestOptions = () => ({ sourceLockRepo: process.cwd() });
  const SYMLINK_ERROR = /Self-Test-Quelle enthaelt einen Symlink/;

  it("fails closed on a pre-placed GATE_MAPPING_V1.yaml.real symlink and leaves the canary untouched", (context) => {
    const root = fixture();
    const canary = canaryFile();
    if (!trySymlink(canary.file, path.join(root, `${DELIVERY_PATHS.mapping}.real`))) context.skip();
    expect(() => selftest(root, selftestOptions())).toThrow(SYMLINK_ERROR);
    expect(readFileSync(canary.file).equals(canary.bytes)).toBe(true);
  }, 60_000);

  const hiddenLinks: Array<[string, string, "file" | "dir" | "dangling"]> = [
    ["a file symlink in docs/delivery", "docs/delivery/zz-hidden-link.txt", "file"],
    ["a file symlink in the packages directory", `${DELIVERY_PATHS.manifestDir}/zz-hidden-link.txt`, "file"],
    ["a directory symlink in docs/delivery", "docs/delivery/zz-dir-link", "dir"],
    ["a file symlink in missions", "missions/zz-hidden-link.yml", "file"],
    ["a deeply nested symlink in missions", "missions/zz-a/zz-b/zz-link.yml", "file"],
    ["a dangling symlink in missions", "missions/zz-dangling.yml", "dangling"],
  ];
  for (const [name, rel, kind] of hiddenLinks) {
    it(`fails closed on ${name}`, (context) => {
      const root = fixture();
      const canary = canaryFile();
      const link = path.join(root, rel);
      mkdirSync(path.dirname(link), { recursive: true });
      const target =
        kind === "dir" ? tempDir("kreile-dir-target-") : kind === "dangling" ? path.join(tempDir("kreile-gone-"), "absent") : canary.file;
      if (!trySymlink(target, link)) context.skip();
      expect(() => selftest(root, selftestOptions())).toThrow(SYMLINK_ERROR);
      expect(readFileSync(canary.file).equals(canary.bytes)).toBe(true);
    }, 60_000);
  }

  it("fails closed when a source tree itself is reached through a symlink", (context) => {
    const root = fixture();
    const real = path.join(root, "missions-real");
    renameSync(path.join(root, "missions"), real);
    if (!trySymlink(real, path.join(root, "missions"))) context.skip();
    expect(() => selftest(root, selftestOptions())).toThrow(SYMLINK_ERROR);
  }, 60_000);

  it("fails closed on a source tree that is missing", () => {
    const root = fixture();
    rmSync(path.join(root, "missions"), { recursive: true, force: true });
    expect(() => selftest(root, selftestOptions())).toThrow(/Self-Test-Quelle nicht lesbar/);
  }, 60_000);

  it("removes its fixture directory when the copy boundary rejects the source", (context) => {
    const root = fixture();
    const canary = canaryFile();
    if (!trySymlink(canary.file, path.join(root, "missions/zz-link.yml"))) context.skip();
    const before = selftestTempEntries();
    expect(() => selftestFixture(root)).toThrow(SYMLINK_ERROR);
    expect([...selftestTempEntries()].filter((name) => !before.has(name))).toEqual([]);
  }, 60_000);

  it("copies a symlink-free source tree byte for byte, with real files only", () => {
    const root = fixture();
    const copy = selftestFixture(root);
    temps.push(copy);
    for (const rel of ["docs/delivery", "missions"]) {
      const walk = (dir: string): string[] =>
        readdirSync(path.join(root, dir), { withFileTypes: true }).flatMap((entry) => {
          const child = `${dir}/${entry.name}`;
          return entry.isDirectory() ? walk(child) : [child];
        });
      for (const file of walk(rel)) {
        expect(lstatSync(path.join(copy, file)).isFile()).toBe(true);
        expect(readFileSync(path.join(copy, file)).equals(readFileSync(path.join(root, file)))).toBe(true);
      }
    }
  }, 60_000);

  it("still completes the self-test on a normal symlink-free source tree", () => {
    const root = fixture();
    const before = selftestTempEntries();
    const cases = selftest(root, selftestOptions());
    expect(cases).toContain("baseline");
    expect(cases.length).toBeGreaterThan(40);
    expect([...selftestTempEntries()].filter((name) => !before.has(name))).toEqual([]);
  }, 180_000);

  it("creates the symlink target exclusively in a new directory, never as a sibling", (context) => {
    const root = fixture();
    const abs = path.join(root, DELIVERY_PATHS.mapping);
    const original = readFileSync(abs);
    const sibling = `${abs}.real`;
    const canary = canaryFile();
    if (!trySymlink(canary.file, sibling)) context.skip();
    const owned: string[] = [];
    try {
      let real = "";
      try {
        real = replaceWithSymlink(abs, owned);
      } catch (error) {
        if (error instanceof Error && error.name === "SkipCase") context.skip();
        throw error;
      }
      expect(real).not.toBe(sibling);
      expect(path.relative(root, real).startsWith("..")).toBe(true);
      expect(owned).toEqual([path.dirname(real)]);
      expect(path.basename(path.dirname(real))).toMatch(/^kreile-delivery-selftest-link-/);
      expect(lstatSync(abs).isSymbolicLink()).toBe(true);
      expect(realpathSync(abs)).toBe(realpathSync(real));
      expect(readFileSync(real).equals(original)).toBe(true);
      expect(readFileSync(canary.file).equals(canary.bytes)).toBe(true);
      expect(lstatSync(sibling).isSymbolicLink()).toBe(true);
    } finally {
      for (const dir of owned) rmSync(dir, { recursive: true, force: true });
    }
  });

  it("registers the external target directory so cleanup removes it", () => {
    const root = fixture();
    const owned: string[] = [];
    try {
      replaceWithSymlink(path.join(root, DELIVERY_PATHS.queue), owned);
    } catch (error) {
      if (!(error instanceof Error && error.name === "SkipCase")) throw error;
    }
    expect(owned).toHaveLength(1);
    for (const dir of owned) rmSync(dir, { recursive: true, force: true });
    expect(() => lstatSync(owned[0]!)).toThrow();
  });

  it("propagates unexpected errors instead of skipping", () => {
    const root = fixture();
    const owned: string[] = [];
    expect(() => replaceWithSymlink(path.join(root, "docs/delivery/DOES_NOT_EXIST.json"), owned)).toThrow(/ENOENT/);
    expect(owned).toEqual([]);
  });

  it("treats only permission and capability errors as an unavailable symlink capability", () => {
    for (const code of ["EPERM", "EACCES", "ENOTSUP", "ENOSYS"]) expect(symlinkUnavailable({ code })).toBe(true);
    for (const code of ["EEXIST", "ENOENT", "EISDIR", "EINVAL", undefined]) expect(symlinkUnavailable({ code })).toBe(false);
    expect(symlinkUnavailable(undefined)).toBe(false);
    expect(symlinkUnavailable(null)).toBe(false);
  });

  it("recognises its own entry point through a symlinked path", (context) => {
    const dir = tempDir("kreile-entry-link-");
    const link = path.join(dir, "check-delivery-contracts.mjs");
    if (!trySymlink(CHECKER_SOURCE, link)) context.skip();
    const result = spawnSync(process.execPath, [link, "--selftest", "--expect-self-sha256", "not-a-hash"], { encoding: "utf8" });
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("ungueltig");
  }, 60_000);

  it.skipIf(process.platform !== "win32")("recognises its own entry point under a different path case on Windows", () => {
    const recased = path.join(path.dirname(CHECKER_SOURCE).toUpperCase(), path.basename(CHECKER_SOURCE));
    const result = spawnSync(process.execPath, [recased, "--selftest", "--expect-self-sha256", "not-a-hash"], {
      encoding: "utf8",
    });
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("ungueltig");
  }, 60_000);
});

// ---------------------------------------------------- self-test and shape

describe("EXIT-C hermetic checker self-test and file shape", () => {
  it("passes the in-process self-test and covers the negative matrix", () => {
    const cases = selftest(process.cwd());
    for (const name of [
      "baseline",
      "duplicate-queue-entry",
      "altered-queue-entry",
      "symlink-queue",
      "graph-second-parent-only",
      "graph-stale-head",
      "graph-wrong-parents",
      "graph-wrong-tree",
      "graph-altered-anchor",
      "graph-missing-facts",
      "binding-candidate-selected-anchor",
      "binding-candidate-selected-active-package",
      "checker-bytes-wrong-hash",
      "active-binding-alias",
    ]) {
      // symlink cases are skipped on platforms that forbid symlink creation
      if (name.startsWith("symlink-") && !cases.includes(name)) continue;
      expect(cases).toContain(name);
    }
  }, 180_000);

  it("is one .mjs file that uses only Node built-ins and the existing dependencies", () => {
    const source = readFileSync(CHECKER_SOURCE, "utf8");
    const specifiers = [...source.matchAll(/(?:from|import\()\s*"([^"]+)"/g)].map((match) => match[1]!);
    expect(specifiers.length).toBeGreaterThan(5);
    const allowedPackages = new Set(["ajv", "typescript", "js-yaml"]);
    const packageJson = JSON.parse(readFileSync(path.resolve("package.json"), "utf8")) as {
      dependencies: Record<string, string>;
      devDependencies: Record<string, string>;
    };
    for (const specifier of specifiers) {
      if (specifier.startsWith("node:")) continue;
      expect(specifier.startsWith(".")).toBe(false);
      expect(allowedPackages.has(specifier)).toBe(true);
      expect({ ...packageJson.dependencies, ...packageJson.devDependencies }).toHaveProperty(specifier);
    }
  });

  it("does not read the network, the environment of the candidate or any unlisted input", () => {
    const source = readFileSync(CHECKER_SOURCE, "utf8");
    for (const forbidden of ["fetch(", "node:http", "node:https", "node:net", "XMLHttpRequest", "WebSocket"]) {
      expect(source).not.toContain(forbidden);
    }
    const envReads = [...source.matchAll(/\benv\.([A-Z][A-Z0-9_]+)/g)].map((match) => match[1]!);
    expect(new Set(envReads)).toEqual(
      new Set(["DELIVERY_REQUIRE_TRUSTED_BASE", "DELIVERY_TRUSTED_BASE_SHA", "DELIVERY_TRUSTED_REPO"]),
    );
  });
});

// --------------------------- retained or growing exception allowlist (#12)

// The delivery step of the protected workflow may compare the candidate checker only
// against the protected-base checker. Any pinned hash, historical exception or extra
// comparison is a retained or growing allowlist.
function deliveryStep(workflow: string): string {
  const start = workflow.indexOf("- name: Enforce protected delivery contracts and rolling queue");
  if (start < 0) throw new Error("delivery step is missing from the workflow");
  const next = workflow.indexOf("\n      - name:", start + 10);
  return next < 0 ? workflow.slice(start) : workflow.slice(start, next);
}

function findCheckerAllowlist(workflow: string): string[] {
  const step = deliveryStep(workflow);
  const found: string[] = [];
  for (const match of step.matchAll(/^\s*([A-Z0-9_]*CHECKER_SHA256)\s*:/gm)) found.push(`pin:${match[1]}`);
  for (const match of step.matchAll(/\b[0-9a-fA-F]{64}\b/g)) found.push(`literal:${match[0]}`);
  const comparisons = step.match(/"\$candidate_sha"\s*!=/g) ?? [];
  if (comparisons.length !== 1) found.push(`comparisons:${comparisons.length}`);
  if (!/\[\[\s*"\$candidate_sha"\s*!=\s*"\$protected_sha"\s*\]\]/.test(step)) found.push("missing-protected-equality");
  return found;
}

function workflowStep(extraEnv: string[], condition: string): string {
  return [
    "jobs:",
    "  ratchet:",
    "    steps:",
    "      - name: Enforce protected delivery contracts and rolling queue",
    "        working-directory: ratchet-base",
    "        env:",
    ...extraEnv.map((line) => `          ${line}`),
    '          DELIVERY_REQUIRE_TRUSTED_BASE: "true"',
    "        run: |",
    `          if ${condition}; then`,
    '            echo "mismatch" >&2',
    "            exit 1",
    "          fi",
    "      - name: Later step",
    `        run: echo ${"f".repeat(64)}`,
    "",
  ].join("\n");
}

describe("EXIT-C no retained or growing checker exception allowlist", () => {
  const equality = '[[ "$candidate_sha" != "$protected_sha" ]]';

  it("finds no allowlist in the current protected workflow", () => {
    expect(findCheckerAllowlist(readFileSync(path.resolve(".github/workflows/eslint-ratchet.yml"), "utf8"))).toEqual([]);
  });

  it("accepts a workflow that only compares against the protected checker", () => {
    expect(findCheckerAllowlist(workflowStep([], equality))).toEqual([]);
  });

  it("rejects a single retained pin", () => {
    const pin = `KR22R_DELIVERY_CHECKER_SHA256: "${"a".repeat(64)}"`;
    expect(findCheckerAllowlist(workflowStep([pin], `${equality.slice(0, -2)} && "$candidate_sha" != "$KR22R_DELIVERY_CHECKER_SHA256" ]]`))).toEqual(
      expect.arrayContaining([`pin:KR22R_DELIVERY_CHECKER_SHA256`, `literal:${"a".repeat(64)}`, "comparisons:2"]),
    );
  });

  it("rejects the three historical exception hashes", () => {
    const hashes = [
      "9281d67e944b28553030090097d29d4ac3b8f204c396a056a3d66461ebf5471c",
      "3b92ca7e7d839fd22af699df71012ea4d9c243a917449707c4fc3ac9926e2a27",
      "2ab91ae1fcb15bd9986edd166e86240b39509210454aa3d48146e1720500f11e",
    ];
    const pins = hashes.map((hash, index) => `LEGACY${index}_DELIVERY_CHECKER_SHA256: "${hash}"`);
    const found = findCheckerAllowlist(workflowStep(pins, equality));
    for (const hash of hashes) expect(found).toContain(`literal:${hash}`);
    expect(found.filter((entry) => entry.startsWith("pin:"))).toHaveLength(3);
  });

  it("rejects a growing allowlist of any size", () => {
    for (let count = 1; count <= 4; count += 1) {
      const pins = Array.from({ length: count }, (_value, index) => `PIN${index}_CHECKER_SHA256: "${String(index).repeat(64)}"`);
      const found = findCheckerAllowlist(workflowStep(pins, equality));
      expect(found.filter((entry) => entry.startsWith("pin:"))).toHaveLength(count);
    }
  });

  it("rejects a workflow that does not compare against the protected checker", () => {
    expect(findCheckerAllowlist(workflowStep([], '[[ "$candidate_sha" != "$other_sha" ]]'))).toContain("missing-protected-equality");
    expect(findCheckerAllowlist(workflowStep([], "true"))).toEqual(expect.arrayContaining(["comparisons:0", "missing-protected-equality"]));
  });

  it("rejects an inline literal hash comparison", () => {
    const found = findCheckerAllowlist(workflowStep([], `${equality.slice(0, -2)} && "$candidate_sha" != "${"b".repeat(64)}" ]]`));
    expect(found).toEqual(expect.arrayContaining([`literal:${"b".repeat(64)}`, "comparisons:2"]));
  });

  it("fails closed when the delivery step is absent", () => {
    expect(() => findCheckerAllowlist("jobs:\n  ratchet:\n    steps: []\n")).toThrow("delivery step is missing");
  });
});
