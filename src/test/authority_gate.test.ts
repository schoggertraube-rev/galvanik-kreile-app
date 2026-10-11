import { describe, expect, it } from "vitest";

import {
  checkAuthorityRepository,
  runSelftest,
} from "../../scripts/quality/check-authoritative-sources.mjs";

describe("D-GOV-001 authority gate", () => {
  it("accepts the repository authority and provider contract", () => {
    expect(checkAuthorityRepository(process.cwd())).toEqual([]);
  });

  it("fails closed for every isolated negative contract class", () => {
    expect(runSelftest()).toBe(true);
  });
});
