// @vitest-environment node

import { cpSync, mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
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
    ]);
    const readFacts = (sha: string) => {
      const value = facts.get(sha);
      if (!value) throw new Error(`synthetic commit fact missing: ${sha}`);
      return value;
    };
    expect(
      validateTrustedHandoff(
        queue.effective_base_handoff,
        "427d51c6d372fc4e6e29646a16f74b79c6508fb7",
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
