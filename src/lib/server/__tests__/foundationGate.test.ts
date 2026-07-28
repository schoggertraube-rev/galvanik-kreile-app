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

  it("rejects supplied input without exposing its value", async () => {
    const sensitiveInput = "do-not-persist-or-display";
    const response = foundationUnavailableResponse("OCR", sensitiveInput);
    const body = await response.json();

    expect(body.message).toContain("Übergebene Eingaben wurden nicht verarbeitet");
    expect(body.message).not.toContain(sensitiveInput);
    expect(() => foundationUnavailableAction("OCR", sensitiveInput)).toThrow(/nicht verarbeitet/);
  });
});
