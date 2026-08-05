import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  createPinLoginHandle,
  isValidPinLoginHandle,
  matchesPinLoginHandle,
  resolvePinLoginCandidate,
} from "@/lib/server/pinLoginHandle";

const originalSecret = process.env.APP_SESSION_SECRET;

describe("pinLoginHandle", () => {
  beforeEach(() => {
    process.env.APP_SESSION_SECRET = "unit-test-secret-not-for-production";
  });

  afterEach(() => {
    if (originalSecret === undefined) {
      delete process.env.APP_SESSION_SECRET;
    } else {
      process.env.APP_SESSION_SECRET = originalSecret;
    }
  });

  it("erzeugt einen opaken, stabilen Handle ohne interne Benutzer-ID", () => {
    const userId = "223e4567-e89b-12d3-a456-426614174001";
    const first = createPinLoginHandle(userId);
    const second = createPinLoginHandle(userId);

    expect(first).toBe(second);
    expect(first).toHaveLength(43);
    expect(first).not.toContain(userId);
    expect(isValidPinLoginHandle(first)).toBe(true);
  });

  it("ordnet nur den zum Handle gehörenden Kandidaten zu", () => {
    const candidates = [{ id: "user-1" }, { id: "user-2" }];
    const handle = createPinLoginHandle("user-2");

    expect(matchesPinLoginHandle(handle, "user-2")).toBe(true);
    expect(matchesPinLoginHandle(handle, "user-1")).toBe(false);
    expect(resolvePinLoginCandidate(handle, candidates)).toEqual({ id: "user-2" });
  });

  it("verwirft rohe IDs und missgebildete Handles", () => {
    expect(isValidPinLoginHandle("user-1")).toBe(false);
    expect(matchesPinLoginHandle("user-1", "user-1")).toBe(false);
    expect(resolvePinLoginCandidate("user-1", [{ id: "user-1" }])).toBeUndefined();
  });
});
