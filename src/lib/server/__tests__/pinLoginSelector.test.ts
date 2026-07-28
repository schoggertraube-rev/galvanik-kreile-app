import { afterEach, describe, expect, it } from "vitest";

import {
  createPinLoginSelector,
  PIN_LOGIN_SELECTOR_TTL_MS,
  verifyPinLoginSelector,
} from "../pinLoginSelector";

const originalSecret = process.env.APP_SESSION_SECRET;

afterEach(() => {
  if (originalSecret === undefined) {
    delete process.env.APP_SESSION_SECRET;
  } else {
    process.env.APP_SESSION_SECRET = originalSecret;
  }
});

describe("PIN login selectors", () => {
  it("encrypts a user id and validates the unmodified short-lived selector", () => {
    process.env.APP_SESSION_SECRET = "unit-test-secret";
    const selector = createPinLoginSelector("user-123", 10_000);

    expect(selector).not.toContain("user-123");
    expect(verifyPinLoginSelector(selector, 10_001)).toEqual({ ok: true, userId: "user-123" });
  });

  it("rejects a tampered selector", () => {
    process.env.APP_SESSION_SECRET = "unit-test-secret";
    const selector = createPinLoginSelector("user-123", 10_000);
    const tampered = `${selector.slice(0, -1)}${selector.endsWith("A") ? "B" : "A"}`;

    expect(verifyPinLoginSelector(tampered, 10_001)).toEqual({ ok: false });
  });

  it("rejects an expired selector", () => {
    process.env.APP_SESSION_SECRET = "unit-test-secret";
    const selector = createPinLoginSelector("user-123", 10_000);

    expect(verifyPinLoginSelector(selector, 10_000 + PIN_LOGIN_SELECTOR_TTL_MS + 1)).toEqual({ ok: false });
  });
});
