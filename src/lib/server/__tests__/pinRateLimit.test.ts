import { beforeEach, describe, expect, it, vi } from "vitest";

const mockDbExecute = vi.fn();
const mockSql = vi.fn(
  (strings: TemplateStringsArray, ...values: unknown[]) => ({ strings, values }),
);

vi.mock("@/db", () => ({
  db: {
    execute: mockDbExecute,
  },
}));

vi.mock("drizzle-orm", () => ({
  sql: mockSql,
}));

type RateLimitRow = {
  failed_attempts: number;
  last_failed_at: Date;
};

function makeRow(
  failedAttempts: number,
  minutesAgo: number,
): RateLimitRow {
  return {
    failed_attempts: failedAttempts,
    last_failed_at: new Date(Date.now() - minutesAgo * 60_000),
  };
}

describe("pinRateLimit", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockDbExecute.mockResolvedValue([]);
  });

  it("erlaubt einen Operator ohne Fehlversuche", async () => {
    const { checkPinRateLimit } = await import("@/lib/server/pinRateLimit");

    await expect(checkPinRateLimit("operator-1")).resolves.toEqual({
      allowed: true,
    });
  });

  it("blockiert nach fünf frischen Fehlversuchen für 15 Minuten", async () => {
    mockDbExecute.mockResolvedValue([makeRow(5, 5)]);
    const { checkPinRateLimit } = await import("@/lib/server/pinRateLimit");

    const result = await checkPinRateLimit("operator-1");

    expect(result.allowed).toBe(false);
    expect(result.retryAfterMinutes).toBeGreaterThan(0);
    expect(result.retryAfterMinutes).toBeLessThanOrEqual(10);
  });

  it("sperrt ab zwanzig Fehlversuchen dauerhaft", async () => {
    mockDbExecute.mockResolvedValue([makeRow(20, 120)]);
    const { checkPinRateLimit } = await import("@/lib/server/pinRateLimit");

    await expect(checkPinRateLimit("operator-1")).resolves.toEqual({
      allowed: false,
      locked: true,
    });
  });

  it("lässt nach Ablauf der temporären Sperre wieder einen Versuch zu", async () => {
    mockDbExecute.mockResolvedValue([makeRow(5, 15)]);
    const { checkPinRateLimit } = await import("@/lib/server/pinRateLimit");

    await expect(checkPinRateLimit("operator-1")).resolves.toEqual({
      allowed: true,
    });
  });

  it("schreibt Fehlversuche atomar und löscht sie nach Erfolg", async () => {
    const { recordFailedPinAttempt, resetPinRateLimit } = await import(
      "@/lib/server/pinRateLimit"
    );

    await recordFailedPinAttempt("operator-1");
    await resetPinRateLimit("operator-1");

    expect(mockDbExecute).toHaveBeenCalledTimes(2);
  });
});
