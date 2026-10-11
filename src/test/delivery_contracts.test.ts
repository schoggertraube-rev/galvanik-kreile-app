import { describe, expect, it } from "vitest";

import {
  checkDeliveryRepository,
  runSelftest,
} from "../../scripts/quality/check-delivery-contracts.mjs";

describe("Kreile live delivery contract", () => {
  it("accepts the repository's single live plan and mission", () => {
    expect(checkDeliveryRepository(process.cwd())).toEqual([]);
  });

  it("fails closed for representative plan drift", () => {
    expect(runSelftest(process.cwd())).toBe(true);
  });
});
