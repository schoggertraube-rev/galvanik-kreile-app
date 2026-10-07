// @vitest-environment node

import { spawnSync } from "node:child_process";
import {
  copyFileSync,
  cpSync,
  mkdtempSync,
  mkdirSync,
  readFileSync,
  rmSync,
  symlinkSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  ACTIVE_MANIFEST_BINDING,
  DELIVERY_PATHS,
  LEGACY_MANIFEST_BINDINGS,
  LEGACY_V1_MANIFEST_BINDINGS,
  checkDeliveryContracts,
  trustedCommitFacts,
  validateTrustedHandoff,
} from "../../scripts/quality/check-delivery-contracts.mjs";

const temps: string[] = [];

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
  return checkDeliveryContracts(root, process.cwd());
}

afterEach(() => {
  for (const root of temps.splice(0)) rmSync(root, { recursive: true, force: true });
});

describe("KR-22R delivery governance gate", () => {
  it("accepts the complete current contract set", () => {
    expect(check(process.cwd())).toEqual({ ok: true, findings: [] });
  }, 10_000);

  it("rejects a hidden alias between the active filename and package id", () => {
    const root = fixture();
    const manifestPath = path.join(root, ACTIVE_MANIFEST_BINDING.path);
    writeFileSync(
      manifestPath,
      readFileSync(manifestPath, "utf8").replace(
        `package_id: ${ACTIVE_MANIFEST_BINDING.packageId}`,
        "package_id: KR-04-HIDDEN-ALIAS",
      ),
    );
    const missionPath = path.join(root, DELIVERY_PATHS.mission);
    writeFileSync(
      missionPath,
      readFileSync(missionPath, "utf8").replaceAll(
        ACTIVE_MANIFEST_BINDING.packageId,
        "KR-04-HIDDEN-ALIAS",
      ),
    );
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
    cpSync(
      path.join(root, legacyPath),
      path.join(root, DELIVERY_PATHS.manifestDir, "FAKE-V1.yaml"),
    );
    expect(check(root).findings).toContainEqual(
      expect.stringContaining("ungebundenes V1-Manifest"),
    );
  });

  it("rejects a structured evidence reference that does not resolve", () => {
    const root = fixture();
    const rel = ACTIVE_MANIFEST_BINDING.path;
    const source = readFileSync(path.join(root, rel), "utf8").replace(
      "evidence_ref: acceptance:KR22R-A4",
      "evidence_ref: acceptance:DOES-NOT-EXIST",
    );
    writeFileSync(path.join(root, rel), source);
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
    const manifestPath = path.join(root, ACTIVE_MANIFEST_BINDING.path);
    writeFileSync(
      manifestPath,
      readFileSync(manifestPath, "utf8").replace("planned_governance_files: 9", "planned_governance_files: 8"),
    );
    expect(check(root).findings).toContainEqual(
      expect.stringContaining("nicht fuer jeden Allowlist-Pfad exakt eine geplante Datei"),
    );
  });

  it("rejects a repo source lock whose declared parent hash does not match Git", () => {
    const root = fixture();
    const manifestPath = path.join(root, ACTIVE_MANIFEST_BINDING.path);
    const manifest = readFileSync(manifestPath, "utf8");
    const firstRepoSourceHash = manifest.match(
      /source_locks:[\s\S]*?kind: REPO_FILE[\s\S]*?sha256: ([A-F0-9]{64})/,
    )?.[1];
    expect(firstRepoSourceHash).toBeDefined();
    writeFileSync(
      manifestPath,
      manifest.replace(firstRepoSourceHash!, "0".repeat(64)),
    );
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
    expect(check(root).findings).toContainEqual(
      expect.stringContaining("Effective-Base-Handoff-Drift"),
    );
  });

  it("rejects a broken protected handoff parent chain", () => {
    const root = fixture();
    const queue = json(root, DELIVERY_PATHS.queue) as {
      effective_base_handoff: {
        queue_parent_sha: string;
        entries: Array<{ parent_sha: string }>;
      };
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
    const queue = json(process.cwd(), DELIVERY_PATHS.queue) as {
      effective_base_handoff: Record<string, unknown>;
    };
    const facts = new Map([
      [
        "16888ccc1f0c97064af3d1552538c6975440b1fb",
        {
          sha: "16888ccc1f0c97064af3d1552538c6975440b1fb",
          parents: [
            "53a5d52becc08394780583e4c3756b2d414311a6",
            "b0b55353143fc50eda7f3833270ff4cfd1402e2f",
          ],
          tree: "4ccfbc0f01c7bb92de8e8a198b43a79a0cd543f2",
        },
      ],
      [
        "a56b5c8845efb5814a970cf739b7fab82217ce28",
        {
          sha: "a56b5c8845efb5814a970cf739b7fab82217ce28",
          parents: [
            "16888ccc1f0c97064af3d1552538c6975440b1fb",
            "5e02605d23f4b65bd69e16509fbd9debcd4de7ae",
          ],
          tree: "5f6cd3a6958a169df32c935999f8db0eb1ddb440",
        },
      ],
      [
        "4ca3abe7e0c44075b0cb30804ba56d85f683d7cf",
        {
          sha: "4ca3abe7e0c44075b0cb30804ba56d85f683d7cf",
          parents: [
            "a56b5c8845efb5814a970cf739b7fab82217ce28",
            "00c43bd7c0995d7ab9b680623c98e5df215bbd72",
          ],
          tree: "2d2b99613f86f892a135c0de9c0c080fd93d5f81",
        },
      ],
      [
        "427d51c6d372fc4e6e29646a16f74b79c6508fb7",
        {
          sha: "427d51c6d372fc4e6e29646a16f74b79c6508fb7",
          parents: [
            "4ca3abe7e0c44075b0cb30804ba56d85f683d7cf",
            "ec2f84bcefacc9292169d9841df2691e0e0ffbc4",
          ],
          tree: "b1927a7641ef49fe38be89dd3e109e6b09960443",
        },
      ],
      [
        "0486ff2f71d921fb9284b45c9a440d6dc0fc6f0f",
        {
          sha: "0486ff2f71d921fb9284b45c9a440d6dc0fc6f0f",
          parents: [
            "427d51c6d372fc4e6e29646a16f74b79c6508fb7",
            "7bd261f879097991e7725f479236c68448af193d",
          ],
          tree: "1ceff359a5b48a808a67304bd702e4db37fe1178",
        },
      ],
      [
        "b617e12fcb028eeb18e06a413874a558cee27cad",
        {
          sha: "b617e12fcb028eeb18e06a413874a558cee27cad",
          parents: [
            "0486ff2f71d921fb9284b45c9a440d6dc0fc6f0f",
            "eca0d5d4d6f831cd52031b943b1d9ef4516ad5a9",
          ],
          tree: "b87a4079ef4aa92e5ac28dd19d356e0f599cb13f",
        },
      ],
    ]);
    const readFacts = (sha: string) => {
      const value = facts.get(sha);
      if (!value) throw new Error(`synthetic commit fact missing: ${sha}`);
      return value;
    };
    expect(
      validateTrustedHandoff(
        queue.effective_base_handoff,
        "b617e12fcb028eeb18e06a413874a558cee27cad",
        readFacts,
      ),
    ).toEqual([]);
    expect(
      validateTrustedHandoff(
        queue.effective_base_handoff,
        "16888ccc1f0c97064af3d1552538c6975440b1fb",
        readFacts,
      ),
    ).toContainEqual(
      expect.stringContaining("Effective Base stimmt nicht mit dem geschuetzten Git-Checkout ueberein"),
    );
  });

  it("fails closed when the trusted Git graph cannot resolve the declared base", () => {
    const queue = json(process.cwd(), DELIVERY_PATHS.queue) as {
      effective_base_handoff: Record<string, unknown>;
    };
    expect(
      validateTrustedHandoff(
        queue.effective_base_handoff,
        "4ca3abe7e0c44075b0cb30804ba56d85f683d7cf",
        () => {
          throw new Error("synthetic trusted graph unavailable");
        },
      ),
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

const RESOLVER_SOURCE = path.resolve("scripts/quality/resolve-delivery-trust-anchor.mjs");
const RESOLVER_REL = "scripts/quality/resolve-delivery-trust-anchor.mjs";
const QUEUE_REL = "docs/delivery/ROLLING_MANIFEST_QUEUE_V1.json";
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
    try {
      unlinkSync(queuePath);
      symlinkSync(path.join(candidate.repo, QUEUE_REL), queuePath);
    } catch {
      context.skip();
    }
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
