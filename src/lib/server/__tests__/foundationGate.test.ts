import { describe, expect, it } from "vitest";

import {
  FOUNDATION_CAPABILITIES,
  foundationUnavailableAction,
  foundationUnavailableResponse,
  isFoundationAreaEnabled,
} from "../foundationGate";

describe("foundation capability allowlist", () => {
  it("defaults every named capability to deny instead of using one global switch", () => {
    expect(FOUNDATION_CAPABILITIES).toContain("Auftragsprozess");
    expect(FOUNDATION_CAPABILITIES).toContain("OCR");
    expect(FOUNDATION_CAPABILITIES.every((capability) => !isFoundationAreaEnabled(capability))).toBe(true);
  });

  it("keeps unavailable API and action contracts explicit", async () => {
    const response = foundationUnavailableResponse("OCR");
    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toMatchObject({ error: "NOT_CONFIGURED" });
    expect(() => foundationUnavailableAction("OCR")).toThrow(/NOT_CONFIGURED/);
  });
});
