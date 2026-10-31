import { describe, expect, it } from "vitest";

import {
  checkSalesStageB2ScopeForTest,
  checkTaB2bScopeForTest,
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

describe("Kreile live package scope", () => {
  it("keeps the PR154 contract green while proving the B2 scope contract", () => {
    expect(runSelftest()).toBe(true);
  }, 60_000);

  it("accepts the narrow B2 branch allowlist", () => {
    expect(checkSalesStageB2ScopeForTest({
      files: [
        "src/modules/eingang/index.ts",
        "docs/delivery/ABGABE_AP-01.md",
        "scripts/quality/h18-server-actions.json",
      ],
      mission: b2Mission,
      branch: "kreile/b2-eingang",
    })).toEqual([]);
  });

  it("accepts only the TA-B2b anchor paths on the pinned main base", () => {
    expect(checkTaB2bScopeForTest({
      files: [
        ".github/workflows/agentur-gate.yml",
        "docs/project/arbeitspakete/TRUST_ANCHOR_B2B.md",
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
    const first = "supabase/migrations/20261102080000_ap01_intake_item.sql";
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
