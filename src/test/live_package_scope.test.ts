import { describe, expect, it } from "vitest";

import { runSelftest } from "../../scripts/quality/check-live-package-scope.mjs";

describe("Kreile live package scope", () => {
  it("separates activation, PL-control and writer product paths", () => {
    expect(runSelftest()).toBe(true);
  });
});
