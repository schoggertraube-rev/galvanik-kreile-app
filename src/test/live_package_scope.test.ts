import { describe, expect, it } from "vitest";

import {
  checkSalesStageB2ScopeForTest,
  runSelftest,
} from "../../scripts/quality/check-live-package-scope.mjs";

const b2Mission = {
  active_block: "B2",
  branch: "kreile/b2-eingang",
};

describe("Kreile live package scope", () => {
  it("keeps the PR154 contract green while proving the B2 scope contract", () => {
    expect(runSelftest()).toBe(true);
  }, 60_000);

  it("accepts the narrow B2 branch allowlist", () => {
    expect(checkSalesStageB2ScopeForTest({
      files: ["src/modules/eingang/index.ts", "docs/delivery/ABGABE_AP-01.md"],
      mission: b2Mission,
      branch: "kreile/b2-eingang",
    })).toEqual([]);
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
