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

describe("KR-04R delivery governance gate", () => {
  it("accepts the complete current contract set", () => {
    expect(check(process.cwd())).toEqual({ ok: true, findings: [] });
  });

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
      "evidence_ref: acceptance:KR04R-A4",
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
      readFileSync(manifestPath, "utf8").replace("planned_governance_files: 8", "planned_governance_files: 7"),
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
    queue.effective_base_handoff.effective_base_sha = queue.effective_base_handoff.queue_parent_sha;
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

  it("binds the effective base and every handoff merge to trusted commit facts", () => {
    const queue = json(process.cwd(), DELIVERY_PATHS.queue) as {
      effective_base_handoff: Record<string, unknown>;
    };
    const facts = new Map([
      [
        "47bc0e58990b1bff545111c990a715d4f72f5f37",
        {
          sha: "47bc0e58990b1bff545111c990a715d4f72f5f37",
          parents: [
            "0d5dd46bd8484ba3a5b7a97a762cd148b8bafff9",
            "bfc6e5737f9bc0b3e268dff535a8dc1a78053234",
          ],
          tree: "7cfd13f319bb4b936ce09de44ab6ca5fa255e5ce",
        },
      ],
      [
        "bc85ccc6b9e84a21947bcc1e648b847ef2d78ac5",
        {
          sha: "bc85ccc6b9e84a21947bcc1e648b847ef2d78ac5",
          parents: [
            "47bc0e58990b1bff545111c990a715d4f72f5f37",
            "e3ce9259bde35cbef843ec88628fb1faa53051b7",
          ],
          tree: "34e45157e821f847bd8f3d98735b3f93a8e53a89",
        },
      ],
      [
        "b58efdf546c05750d09f80adfbdd68d12ee9e3e5",
        {
          sha: "b58efdf546c05750d09f80adfbdd68d12ee9e3e5",
          parents: [
            "bc85ccc6b9e84a21947bcc1e648b847ef2d78ac5",
            "db29c6ff6c3724907f3a105763c127739f3da2f5",
          ],
          tree: "6b2e49719b785adf8b49e27a105d2beba521fb9c",
        },
      ],
      [
        "3fa208858ece10235394800a3a6ff48aae49568b",
        {
          sha: "3fa208858ece10235394800a3a6ff48aae49568b",
          parents: [
            "b58efdf546c05750d09f80adfbdd68d12ee9e3e5",
            "61f2ebef3876aecf2b36deb944e3a097c026a846",
          ],
          tree: "07e961e97199e66c5e3b854566341b625ce7dfea",
        },
      ],
      [
        "31da55b5fe04db9d3744d842297f904e28fc26a7",
        {
          sha: "31da55b5fe04db9d3744d842297f904e28fc26a7",
          parents: [
            "3fa208858ece10235394800a3a6ff48aae49568b",
            "dd983936a5a9931df54ecac3c4578bfe3915b2b3",
          ],
          tree: "271aef304f448b42bc07ca680dbb601ad5a09aa5",
        },
      ],
      [
        "ffa597937987d7abb7779a9d63303445e1ec92fc",
        {
          sha: "ffa597937987d7abb7779a9d63303445e1ec92fc",
          parents: [
            "31da55b5fe04db9d3744d842297f904e28fc26a7",
            "02dc063b2ed0731a658c5ed69af3a58b71fdaa9d",
          ],
          tree: "6570c9a58e9b144c573b0e3d2932d7fd6031a8f3",
        },
      ],
      [
        "53a5d52becc08394780583e4c3756b2d414311a6",
        {
          sha: "53a5d52becc08394780583e4c3756b2d414311a6",
          parents: [
            "ffa597937987d7abb7779a9d63303445e1ec92fc",
            "737e2af5261b06ea0bd74408995f4b732fb301b1",
          ],
          tree: "986b5552d662f11bacf2fe4e36f00d8e2ed7d9c1",
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
        "53a5d52becc08394780583e4c3756b2d414311a6",
        readFacts,
      ),
    ).toEqual([]);
    expect(
      validateTrustedHandoff(
        queue.effective_base_handoff,
        "47bc0e58990b1bff545111c990a715d4f72f5f37",
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
        "53a5d52becc08394780583e4c3756b2d414311a6",
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
