/**
 * Process-local interim throttle for the legacy four-digit PIN flow.
 *
 * It is intentionally keyed by the verified user id, not by a browser value,
 * so reloading the public selector list cannot reset the failure counter. A
 * durable multi-instance lockout/audit trail requires the approved W3 schema
 * and credential migration; this guard reduces the current online guessing
 * surface without pretending to be that final contract.
 */
export const PIN_ATTEMPT_WINDOW_MS = 15 * 60 * 1000;
export const PIN_ATTEMPT_MAX_FAILURES = 5;

type AttemptState = {
  failures: number;
  windowStartedAt: number;
};

const attempts = new Map<string, AttemptState>();

function getCurrentState(userId: string, now: number): AttemptState | null {
  const state = attempts.get(userId);
  if (!state) return null;
  if (now - state.windowStartedAt >= PIN_ATTEMPT_WINDOW_MS) {
    attempts.delete(userId);
    return null;
  }
  return state;
}

export function canAttemptPinLogin(userId: string, now = Date.now()): {
  allowed: boolean;
  retryAfterMs?: number;
} {
  const state = getCurrentState(userId, now);
  if (!state || state.failures < PIN_ATTEMPT_MAX_FAILURES) return { allowed: true };

  return {
    allowed: false,
    retryAfterMs: Math.max(0, PIN_ATTEMPT_WINDOW_MS - (now - state.windowStartedAt)),
  };
}

export function recordPinLoginFailure(userId: string, now = Date.now()): void {
  const state = getCurrentState(userId, now);
  if (!state) {
    attempts.set(userId, { failures: 1, windowStartedAt: now });
    return;
  }
  state.failures += 1;
}

export function clearPinLoginFailures(userId: string): void {
  attempts.delete(userId);
}

/** Test-only reset; no product caller uses this. */
export function resetPinAttemptLimiterForTests(): void {
  attempts.clear();
}
