import { describe, expect, it } from "vitest";

import {
  checkSalesStageB2ScopeForTest,
  checkTaB2bScopeForTest,
  checkTaB2c2ScopeForTest,
  checkTaB2cScopeForTest,
  runSelftest,
} from "../../scripts/quality/check-live-package-scope.mjs";

const b2Mission = {
  active_block: "B2",
  branch: "kreile/b2-eingang",
};

const b2AnchorMission = {
  ...b2Mission,
  phase: "WRITING",
  started_from_sha: "ae79c12fb6bea83b8ac68fa065af4671f4bf09b5",
  desktop_due_at: "2026-11-08",
  tablet_mobile_due_at: "2026-11-08",
  handoff_path: "docs/delivery/ABGABE_B2.md",
  next_block: "B3",
};

const b2cAnchorMission = {
  ...b2AnchorMission,
};

const ap01ExactPaths = [
  "docs/delivery/ABGABE_AP-01.md",
  "docs/evidence/f1/F1_R0_CAPABILITY_REGISTRY.json",
  "e2e/f1-4-immutable-invoice.real.spec.ts",
  "e2e/path1-ui-convergence-v5-global-create.spec.ts",
  "e2e/path1-ui-convergence-v5-p3.real.spec.ts",
  "scripts/quality/h18-server-actions.json",
  "src/app/GlobalCreateAppAdapter.tsx",
  "src/app/actions/eingang.actions.ts",
  "src/app/actions/intakeDraft.actions.ts",
  "src/app/orders/OrdersAppAdapter.tsx",
  "src/app/warendurchlauf/__tests__/w2cB2m5j.unavailable.realRender.test.tsx",
  "src/components/home/OfficeHome.tsx",
  "src/components/home/OfficeHomeClient.tsx",
  "src/components/home/__tests__/RolfHome.realRender.test.tsx",
  "src/components/layout/GlobalCreateFlow.tsx",
  "src/components/layout/KreileHeader.tsx",
  "src/components/layout/MoreMenu.tsx",
  "src/components/layout/TargetShell.module.css",
  "src/components/layout/__tests__/path1GlobalCreateFlow.realRender.test.tsx",
  "src/components/layout/__tests__/w2cHeaderTruth.realRender.test.tsx",
  "src/components/layout/globalCreateRequest.ts",
  "src/lib/auth/authorizationContract.ts",
  "src/lib/server/commands/orderIntakeCommand.ts",
  "src/lib/server/commands/__tests__/orderIntakeCommand.test.ts",
  "src/lib/server/intakeDraft.ts",
  "src/lib/server/todayDashboard.ts",
  "src/modules/fundament/featureCatalog.ts",
  "src/modules/suche/ui/SearchDialog.tsx",
  "src/modules/werkstatt/ui/WerkstattView.singleProjection.test.tsx",
  "src/modules/werkstatt/ui/WerkstattView.tsx",
  "src/test/acceptance/ap01_eingang_paket_persoenlich.integration.test.ts",
  "src/ui/kr/AppShell.tsx",
  "src/ui/kr/GlobalesPlus.tsx",
  "supabase/migrations/20261031212320_ap01_intake_item.sql",
] as const;

describe("Kreile live package scope", () => {
  it("keeps the PR154 contract green while proving the B2 scope contract", () => {
    expect(runSelftest()).toBe(true);
  }, 60_000);

  it("accepts the complete AP-01 diff and every exact B2 path individually", () => {
    expect(checkSalesStageB2ScopeForTest({
      files: [
        "src/modules/eingang/index.ts",
        ...ap01ExactPaths,
      ],
      entries: [{ status: "A", path: "supabase/migrations/20261031212320_ap01_intake_item.sql" }],
      mission: b2Mission,
      branch: "kreile/b2-eingang",
    })).toEqual([]);
    for (const file of ap01ExactPaths) {
      expect(checkSalesStageB2ScopeForTest({
        files: [file],
        entries: file.startsWith("supabase/migrations/") ? [{ status: "A", path: file }] : [],
        mission: b2Mission,
        branch: "kreile/b2-eingang",
      }), file).toEqual([]);
    }
  });

  it("accepts only the TA-B2b anchor paths on the pinned main base", () => {
    expect(checkTaB2bScopeForTest({
      files: [
        ".github/workflows/agentur-gate.yml",
        "docs/project/arbeitspakete/TRUST_ANCHOR_B2B.md",
        "docs/project/endversion/codex/BAUPLAN.json",
        "docs/evidence/live-line/b2/TRUST_ANCHOR_B2B.json",
      ],
      mission: b2AnchorMission,
      branch: "codex/ta-b2b",
      baseSha: "ac6c1d2a7eb652dc5e64219a24eed8d4065fbc4e",
    })).toEqual([]);
  });

  it("rejects AP-01's H18 inventory mutation from the TA-B2b anchor itself", () => {
    expect(checkTaB2bScopeForTest({
      files: ["scripts/quality/h18-server-actions.json"],
      mission: b2AnchorMission,
      branch: "codex/ta-b2b",
      baseSha: "ac6c1d2a7eb652dc5e64219a24eed8d4065fbc4e",
    })).toContain("TA_B2B_SCOPE:scripts/quality/h18-server-actions.json");
  });

  it("allows only the TA-B2c anchor paths on its pinned main base", () => {
    expect(checkTaB2cScopeForTest({
      files: [
        "docs/project/arbeitspakete/TRUST_ANCHOR_B2C.md",
        "docs/project/endversion/codex/BAUPLAN.json",
        "docs/evidence/live-line/b2/TRUST_ANCHOR_B2C.json",
      ],
      mission: b2cAnchorMission,
      branch: "codex/ta-b2c",
      baseSha: "11091c0be7b2c58ef7b009d4ad5664ad3e9db01d",
    })).toEqual([]);
    expect(checkTaB2cScopeForTest({
      files: ["src/app/page.tsx"],
      mission: b2cAnchorMission,
      branch: "codex/ta-b2c",
      baseSha: "11091c0be7b2c58ef7b009d4ad5664ad3e9db01d",
    })).toContain("TA_B2C_SCOPE:src/app/page.tsx");
  });

  it("allows only the TA-B2c2 anchor paths and its two exact product paths", () => {
    expect(checkTaB2c2ScopeForTest({
      files: [
        "docs/project/arbeitspakete/TRUST_ANCHOR_B2C2.md",
        "docs/evidence/live-line/b2/TRUST_ANCHOR_B2C2.json",
      ],
      mission: b2cAnchorMission,
      branch: "codex/ta-b2c2",
      baseSha: "8e1e03f567278d24d5f3a468f6cbef3729db96b9",
    })).toEqual([]);
    expect(checkTaB2c2ScopeForTest({
      files: ["src/app/page.tsx"],
      mission: b2cAnchorMission,
      branch: "codex/ta-b2c2",
      baseSha: "8e1e03f567278d24d5f3a468f6cbef3729db96b9",
    })).toContain("TA_B2C2_SCOPE:src/app/page.tsx");
    for (const path of [
      "src/lib/server/commands/orderIntakeCommand.ts",
      "src/lib/server/commands/__tests__/orderIntakeCommand.test.ts",
    ]) {
      expect(checkSalesStageB2ScopeForTest({ files: [path], mission: b2Mission, branch: "kreile/b2-eingang" }), path).toEqual([]);
    }
    const adjacent = "src/lib/server/commands/quoteCommand.ts";
    expect(checkSalesStageB2ScopeForTest({ files: [adjacent], mission: b2Mission, branch: "kreile/b2-eingang" }))
      .toContain(`SALES_STAGE_B2_SCOPE:${adjacent}`);
  });

  it("allows the narrow AP acceptance and delivery patterns only", () => {
    for (const path of [
      "src/test/acceptance/ap01b_eingang_bestandskunde_unvollstaendig.integration.test.ts",
      "docs/delivery/ABGABE_AP-K1.md",
    ]) {
      expect(checkSalesStageB2ScopeForTest({ files: [path], mission: b2Mission, branch: "kreile/b2-eingang" }), path).toEqual([]);
    }
    for (const path of [
      "src/test/acceptance/x.test.ts",
      "src/test/x.integration.test.ts",
      "docs/delivery/ABGABE_B3.md",
      "docs/project/endversion/codex/BAUPLAN.json",
    ]) {
      expect(checkSalesStageB2ScopeForTest({ files: [path], mission: b2Mission, branch: "kreile/b2-eingang" }), path)
        .toContain(`SALES_STAGE_B2_SCOPE:${path}`);
    }
  });

  it("rejects paths outside B2 and the former B1 branch", () => {
    expect(checkSalesStageB2ScopeForTest({
      files: ["src/modules/orders/server/get.ts"],
      mission: b2Mission,
      branch: "kreile/b1-shell",
    })).toEqual(expect.arrayContaining([
      "SALES_STAGE_BRANCH_INVALID:kreile/b1-shell",
      "SALES_STAGE_B2_SCOPE:src/modules/orders/server/get.ts",
    ]));
  });

  it("rejects a second or changed AP-01 migration", () => {
    const first = "supabase/migrations/20261031212320_ap01_intake_item.sql";
    const second = "supabase/migrations/20261102080100_ap01_intake_item.sql";
    expect(checkSalesStageB2ScopeForTest({
      files: [first, second],
      entries: [{ status: "A", path: first }, { status: "A", path: second }],
      mission: b2Mission,
      branch: "kreile/b2-eingang",
    })).toContain("SALES_STAGE_B2_MIGRATION_COUNT:2");
    expect(checkSalesStageB2ScopeForTest({
      files: [first],
      entries: [{ status: "M", path: first }],
      mission: b2Mission,
      branch: "kreile/b2-eingang",
    })).toContain(`SALES_STAGE_B2_MIGRATION_NOT_NEW:${first}`);
  });
});
