import { afterEach, describe, expect, it } from "vitest";

import {
  canAttemptPinLogin,
  clearPinLoginFailures,
  PIN_ATTEMPT_MAX_FAILURES,
  PIN_ATTEMPT_WINDOW_MS,
  recordPinLoginFailure,
  resetPinAttemptLimiterForTests,
} from "../pinAttemptLimiter";

afterEach(resetPinAttemptLimiterForTests);

describe("PIN attempt limiter", () => {
  it("locks a verified user after the bounded number of failures", () => {
    for (let attempt = 0; attempt < PIN_ATTEMPT_MAX_FAILURES; attempt += 1) {
      recordPinLoginFailure("user-1", 1_000);
    }

    expect(canAttemptPinLogin("user-1", 1_001)).toMatchObject({ allowed: false });
  });

  it("does not let a different user inherit a lock and expires the local window", () => {
    for (let attempt = 0; attempt < PIN_ATTEMPT_MAX_FAILURES; attempt += 1) {
      recordPinLoginFailure("user-1", 1_000);
    }

    expect(canAttemptPinLogin("user-2", 1_001)).toEqual({ allowed: true });
    expect(canAttemptPinLogin("user-1", 1_000 + PIN_ATTEMPT_WINDOW_MS)).toEqual({ allowed: true });
  });

  it("clears failures after a successful login", () => {
    recordPinLoginFailure("user-1", 1_000);
    clearPinLoginFailures("user-1");

    expect(canAttemptPinLogin("user-1", 1_001)).toEqual({ allowed: true });
  });
});
