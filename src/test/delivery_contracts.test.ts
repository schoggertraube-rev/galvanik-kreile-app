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

afterEach(() => {
  for (const root of temps.splice(0)) rmSync(root, { recursive: true, force: true });
});

describe("KR-05 delivery governance gate", () => {
  it("accepts the complete current contract set", () => {
    expect(checkDeliveryContracts(process.cwd())).toEqual({ ok: true, findings: [] });
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
    expect(checkDeliveryContracts(root).findings).toContainEqual(
      expect.stringContaining("expliziten Dateiname-/Paket-ID-Bindung"),
    );
  });

  it("rejects a copied legacy package id outside its frozen path", () => {
    const root = fixture();
    cpSync(
      path.join(root, LEGACY_MANIFEST_BINDINGS["KR-00E-DELIVERY-CONTRACT"].path),
      path.join(root, DELIVERY_PATHS.manifestDir, "FAKE-LEGACY.yaml"),
    );
    expect(checkDeliveryContracts(root).findings).toContainEqual(expect.stringContaining("Legacy-Ausnahme ist nur"));
  });

  it("rejects every V1 manifest outside the four frozen path-and-hash bindings", () => {
    const root = fixture();
    const legacyPath = Object.keys(LEGACY_V1_MANIFEST_BINDINGS)[0]!;
    cpSync(
      path.join(root, legacyPath),
      path.join(root, DELIVERY_PATHS.manifestDir, "FAKE-V1.yaml"),
    );
    expect(checkDeliveryContracts(root).findings).toContainEqual(
      expect.stringContaining("ungebundenes V1-Manifest"),
    );
  });

  it("rejects a structured evidence reference that does not resolve", () => {
    const root = fixture();
    const rel = ACTIVE_MANIFEST_BINDING.path;
    const source = readFileSync(path.join(root, rel), "utf8").replace(
      "evidence_ref: acceptance:KR05-A8",
      "evidence_ref: acceptance:DOES-NOT-EXIST",
    );
    writeFileSync(path.join(root, rel), source);
    expect(checkDeliveryContracts(root).findings).toContainEqual(expect.stringContaining("loest nicht im eigenen Manifest auf"));
  });

  it("rejects drift in any PR #113 path disposition", () => {
    const root = fixture();
    const disposition = json(root, DELIVERY_PATHS.pr113Disposition) as {
      path_decisions: Array<{ decision: string }>;
    };
    disposition.path_decisions[0].decision = "UNSAFE_DIRECT_IMPORT";
    writeJson(root, DELIVERY_PATHS.pr113Disposition, disposition);
    expect(checkDeliveryContracts(root).findings).toContainEqual(expect.stringContaining("Disposition fuer"));
  });

  it("rejects a missing PR #113 path disposition", () => {
    const root = fixture();
    const disposition = json(root, DELIVERY_PATHS.pr113Disposition) as {
      path_decisions: Array<Record<string, unknown>>;
    };
    disposition.path_decisions.pop();
    writeJson(root, DELIVERY_PATHS.pr113Disposition, disposition);
    expect(checkDeliveryContracts(root).findings).toContainEqual(
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
    expect(checkDeliveryContracts(root).findings).toContainEqual(expect.stringContaining("Blobbindung fuer"));
  });

  it("rejects a PR #113 delivery claim", () => {
    const root = fixture();
    const disposition = json(root, DELIVERY_PATHS.pr113Disposition) as {
      delivery_truth: { main_delivered: boolean };
    };
    disposition.delivery_truth.main_delivered = true;
    writeJson(root, DELIVERY_PATHS.pr113Disposition, disposition);
    expect(checkDeliveryContracts(root).findings).toContainEqual(
      expect.stringContaining("delivery_truth.main_delivered muss false sein"),
    );
  });

  it("rejects unknown PR #113 disposition fields", () => {
    const root = fixture();
    const disposition = json(root, DELIVERY_PATHS.pr113Disposition);
    disposition.hidden_claim = true;
    writeJson(root, DELIVERY_PATHS.pr113Disposition, disposition);
    expect(checkDeliveryContracts(root).findings).toContainEqual(
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
    expect(checkDeliveryContracts(root).findings).toContainEqual(
      expect.stringContaining("Runtime-Importer muessen leer sein, gefunden src/probe.ts"),
    );
  });

  it("rejects drift in any PR #84 path reconciliation", () => {
    const root = fixture();
    const reconciliation = json(root, DELIVERY_PATHS.pr84Reconciliation) as {
      path_decisions: Array<{ decision: string }>;
    };
    reconciliation.path_decisions[0]!.decision = "UNSAFE_DIRECT_IMPORT";
    writeJson(root, DELIVERY_PATHS.pr84Reconciliation, reconciliation);
    expect(checkDeliveryContracts(root).findings).toContainEqual(
      expect.stringContaining("PR84-Reconciliation fuer"),
    );
  });

  it("rejects a missing PR #84 path reconciliation", () => {
    const root = fixture();
    const reconciliation = json(root, DELIVERY_PATHS.pr84Reconciliation) as {
      path_decisions: Array<Record<string, unknown>>;
    };
    reconciliation.path_decisions.pop();
    writeJson(root, DELIVERY_PATHS.pr84Reconciliation, reconciliation);
    expect(checkDeliveryContracts(root).findings).toContainEqual(
      expect.stringContaining("muss exakt 32 Pfadentscheidungen enthalten"),
    );
  });

  it("rejects PR #84 blob drift", () => {
    const root = fixture();
    const reconciliation = json(root, DELIVERY_PATHS.pr84Reconciliation) as {
      path_decisions: Array<{ current_blob_sha: string }>;
    };
    reconciliation.path_decisions[0]!.current_blob_sha = "0000000000000000000000000000000000000000";
    writeJson(root, DELIVERY_PATHS.pr84Reconciliation, reconciliation);
    expect(checkDeliveryContracts(root).findings).toContainEqual(
      expect.stringContaining("PR84-Reconciliation Blobbindung fuer"),
    );
  });

  it("rejects an invented valid PR #84 product remainder", () => {
    const root = fixture();
    const reconciliation = json(root, DELIVERY_PATHS.pr84Reconciliation) as {
      summary: { valid_missing_product_paths: number };
    };
    reconciliation.summary.valid_missing_product_paths = 1;
    writeJson(root, DELIVERY_PATHS.pr84Reconciliation, reconciliation);
    expect(checkDeliveryContracts(root).findings).toContainEqual(
      expect.stringContaining("summary.valid_missing_product_paths muss 0 sein"),
    );
  });

  it("rejects a PR #84 delivery claim", () => {
    const root = fixture();
    const reconciliation = json(root, DELIVERY_PATHS.pr84Reconciliation) as {
      delivery_truth: { main_delivered: boolean };
    };
    reconciliation.delivery_truth.main_delivered = true;
    writeJson(root, DELIVERY_PATHS.pr84Reconciliation, reconciliation);
    expect(checkDeliveryContracts(root).findings).toContainEqual(
      expect.stringContaining("PR84-Reconciliation delivery_truth.main_delivered muss false sein"),
    );
  });

  it("rejects a production importer of the old PR #84 header", () => {
    const root = fixture();
    const probePath = path.join(root, "src/probe.ts");
    mkdirSync(path.dirname(probePath), { recursive: true });
    writeFileSync(probePath, 'import "./components/layout/KreileHeader";\n');
    expect(checkDeliveryContracts(root).findings).toContainEqual(
      expect.stringContaining("alter Header muss importerlos bleiben"),
    );
  });

  it("rejects a manifest whose planned file counts do not cover the exact allowlist", () => {
    const root = fixture();
    const manifestPath = path.join(root, ACTIVE_MANIFEST_BINDING.path);
    writeFileSync(
      manifestPath,
      readFileSync(manifestPath, "utf8").replace("planned_governance_files: 11", "planned_governance_files: 10"),
    );
    expect(checkDeliveryContracts(root).findings).toContainEqual(
      expect.stringContaining("nicht fuer jeden Allowlist-Pfad exakt eine geplante Datei"),
    );
  });

  it("rejects direct queue and gate-mapping order drift", () => {
    const root = fixture();
    const mappingPath = path.join(root, DELIVERY_PATHS.mapping);
    writeFileSync(
      mappingPath,
      readFileSync(mappingPath, "utf8").replace(
        "    - KR-10A-UI-TRUTH-BINDING",
        "    - KR-99-DRIFT",
      ),
    );
    expect(checkDeliveryContracts(root).findings).toContainEqual(
      expect.stringContaining("Rolling-Policy-Drift: Queue-Reihenfolge"),
    );
  });

  it("rejects any branch-protection bypass actor", () => {
    const root = fixture();
    const receipt = json(root, DELIVERY_PATHS.operatingReceipt) as { active_ruleset: { bypass_actors: string[] } };
    receipt.active_ruleset.bypass_actors.push("admin");
    writeJson(root, DELIVERY_PATHS.operatingReceipt, receipt);
    expect(checkDeliveryContracts(root).findings).toContainEqual(expect.stringContaining("should NOT have more than 0 items"));
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
    expect(checkDeliveryContracts(root).findings).toContainEqual(
      expect.stringContaining("delivery_truth.main_delivered muss false sein"),
    );
  });
});
