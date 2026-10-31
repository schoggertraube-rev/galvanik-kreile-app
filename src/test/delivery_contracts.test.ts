import { describe, expect, it } from "vitest";

import {
  checkDeliveryRepository,
  checkSalesStageMissionRoute,
  runSelftest,
} from "../../scripts/quality/check-delivery-contracts.mjs";

describe("Kreile live delivery contract", () => {
  it("accepts the repository's single live plan and mission", () => {
    expect(checkDeliveryRepository(process.cwd())).toEqual([]);
  });

  it("fails closed for representative plan drift", () => {
    expect(runSelftest(process.cwd())).toBe(true);
  });

  it("accepts only the bound B2 mission route", () => {
    expect(checkSalesStageMissionRoute({
      active_block: "B2",
      phase: "WRITING",
      branch: "kreile/b2-eingang",
      handoff_path: "docs/delivery/ABGABE_B2.md",
      next_block: "B3",
    })).toEqual([]);
    expect(checkSalesStageMissionRoute({
      active_block: "B1",
      phase: "WRITING",
      branch: "kreile/b1-shell",
      handoff_path: "docs/delivery/AENDERUNGEN_B1.md",
      next_block: "B2",
    })).toEqual(["MISSION_ACTIVE_BLOCK", "MISSION_HANDOFF"]);
  });
});
