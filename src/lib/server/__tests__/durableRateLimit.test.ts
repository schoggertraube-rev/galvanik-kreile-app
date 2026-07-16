import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockExecute } = vi.hoisted(() => ({
  mockExecute: vi.fn(),
}));

vi.mock("@/db", () => ({
  db: { execute: mockExecute },
}));

import {
  consumeDurableRateLimit,
  readRateLimitInteger,
  resetDurableRateLimit,
} from "@/lib/server/durableRateLimit";
import { getPinLoginAttemptPolicy } from "@/lib/server/pinLoginAttempts";

describe("durableRateLimit", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.unstubAllEnvs();
    vi.stubEnv("KREILE_SESSION_SECRET", "unit-test-rate-limit-secret-32-bytes");
  });

  it("consumes an allowed attempt through the atomic database function", async () => {
    mockExecute.mockResolvedValueOnce([{
      allowed: true,
      remaining: 2,
      retry_after_seconds: 0,
    }]);

    await expect(consumeDurableRateLimit({
      namespace: "pin-login",
      subject: "galvanik-kreile:user-abc",
      actorId: "user-abc",
      limit: 5,
      windowSeconds: 900,
      metadata: { tenantId: "galvanik-kreile" },
    })).resolves.toEqual({ allowed: true, remaining: 2 });

    expect(mockExecute).toHaveBeenCalledTimes(1);
  });

  it("returns the database function's denial without running a protected operation", async () => {
    mockExecute.mockResolvedValueOnce([{
      allowed: false,
      remaining: 0,
      retry_after_seconds: 451,
    }]);

    await expect(consumeDurableRateLimit({
      namespace: "pin-login",
      subject: "galvanik-kreile:user-abc",
      limit: 5,
      windowSeconds: 900,
    })).resolves.toEqual({
      allowed: false,
      remaining: 0,
      retryAfterSeconds: 451,
    });

    expect(mockExecute).toHaveBeenCalledTimes(1);
  });

  it("resets through the atomic database function", async () => {
    mockExecute.mockResolvedValueOnce([{ reset: true }]);

    await resetDurableRateLimit({
      namespace: "pin-login",
      subject: "galvanik-kreile:user-abc",
      actorId: "user-abc",
    });

    expect(mockExecute).toHaveBeenCalledTimes(1);
  });

  it("rejects malformed policies before opening a transaction", async () => {
    await expect(consumeDurableRateLimit({
      namespace: "PIN LOGIN!",
      subject: "user-abc",
      limit: 0,
      windowSeconds: 0,
    })).rejects.toThrow(/namespace/);
    expect(mockExecute).not.toHaveBeenCalled();
  });

  it("uses bounded environment values and stronger admin defaults", () => {
    expect(getPinLoginAttemptPolicy("werkstatt")).toEqual({
      limit: 5,
      windowSeconds: 900,
    });
    expect(getPinLoginAttemptPolicy("admin")).toEqual({
      limit: 3,
      windowSeconds: 900,
    });

    vi.stubEnv("PIN_LOGIN_ATTEMPT_LIMIT", "8");
    vi.stubEnv("PIN_LOGIN_ADMIN_ATTEMPT_LIMIT", "4");
    vi.stubEnv("PIN_LOGIN_ATTEMPT_WINDOW_SECONDS", "1200");
    expect(getPinLoginAttemptPolicy("werkstatt")).toEqual({
      limit: 8,
      windowSeconds: 1200,
    });
    expect(getPinLoginAttemptPolicy("admin")).toEqual({
      limit: 4,
      windowSeconds: 1200,
    });

    vi.stubEnv("PIN_LOGIN_ATTEMPT_LIMIT", "not-a-number");
    expect(readRateLimitInteger("PIN_LOGIN_ATTEMPT_LIMIT", 5, 2, 20)).toBe(5);
  });
});
