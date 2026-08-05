import { beforeEach, describe, expect, it, vi } from "vitest";

const mockDbTransaction = vi.fn();
const mockTxExecute = vi.fn();
const mockSql = vi.fn(
  (strings: TemplateStringsArray, ...values: unknown[]) => ({
    strings: [...strings],
    values,
  }),
);
const executeResults: unknown[][] = [];

const tx = {
  execute: mockTxExecute,
};

vi.mock("@/db", () => ({
  db: {
    transaction: mockDbTransaction,
  },
}));

vi.mock("drizzle-orm", () => ({
  sql: mockSql,
}));

type RateLimitRow = {
  failed_attempts: number;
  last_failed_at: Date;
};

function makeRow(failedAttempts: number, minutesAgo: number): RateLimitRow {
  return {
    failed_attempts: failedAttempts,
    last_failed_at: new Date(Date.now() - minutesAgo * 60_000),
  };
}

describe("runPinAttempt", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    executeResults.length = 0;
    mockDbTransaction.mockImplementation(async (callback) => callback(tx));
    mockTxExecute.mockImplementation(async () => executeResults.shift() ?? []);
  });

  it("serialisiert bereits den ersten Versuch mit einem transaktionalen Advisory-Lock", async () => {
    executeResults.push([], [], []);
    const verifyPin = vi.fn().mockResolvedValue(true);
    const { runPinAttempt } = await import("@/lib/server/pinRateLimit");

    await expect(runPinAttempt("operator-1", verifyPin)).resolves.toEqual({
      status: "valid",
    });

    expect(mockDbTransaction).toHaveBeenCalledOnce();
    expect(mockTxExecute).toHaveBeenCalledTimes(3);
    expect(mockTxExecute.mock.calls[0][0].strings.join(" ")).toContain(
      "pg_advisory_xact_lock",
    );
    expect(mockTxExecute.mock.calls[1][0].strings.join(" ")).toContain(
      "FROM pin_rate_limits",
    );
    expect(mockTxExecute.mock.calls[2][0].strings.join(" ")).toContain(
      "DELETE FROM pin_rate_limits",
    );
    expect(verifyPin).toHaveBeenCalledOnce();
  });

  it("zählt einen falschen PIN innerhalb derselben Transaktion", async () => {
    executeResults.push([], [], []);
    const verifyPin = vi.fn().mockResolvedValue(false);
    const { runPinAttempt } = await import("@/lib/server/pinRateLimit");

    await expect(runPinAttempt("operator-1", verifyPin)).resolves.toEqual({
      status: "invalid",
    });

    expect(mockTxExecute).toHaveBeenCalledTimes(3);
    expect(mockTxExecute.mock.calls[2][0].strings.join(" ")).toContain(
      "ON CONFLICT (operator_id)",
    );
  });

  it("blockiert nach fünf frischen Fehlversuchen vor dem PIN-Vergleich", async () => {
    executeResults.push([], [makeRow(5, 5)]);
    const verifyPin = vi.fn().mockResolvedValue(true);
    const { runPinAttempt } = await import("@/lib/server/pinRateLimit");

    const result = await runPinAttempt("operator-1", verifyPin);

    expect(result.status).toBe("blocked");
    expect(result).toEqual(
      expect.objectContaining({ retryAfterMinutes: expect.any(Number) }),
    );
    expect(verifyPin).not.toHaveBeenCalled();
    expect(mockTxExecute).toHaveBeenCalledTimes(2);
  });

  it("sperrt ab zwanzig Fehlversuchen dauerhaft", async () => {
    executeResults.push([], [makeRow(20, 120)]);
    const verifyPin = vi.fn().mockResolvedValue(true);
    const { runPinAttempt } = await import("@/lib/server/pinRateLimit");

    await expect(runPinAttempt("operator-1", verifyPin)).resolves.toEqual({
      status: "blocked",
      locked: true,
    });
    expect(verifyPin).not.toHaveBeenCalled();
  });

  it("lässt nach Ablauf der temporären Sperre genau den serialisierten Versuch zu", async () => {
    executeResults.push([], [makeRow(5, 15)], []);
    const verifyPin = vi.fn().mockResolvedValue(true);
    const { runPinAttempt } = await import("@/lib/server/pinRateLimit");

    await expect(runPinAttempt("operator-1", verifyPin)).resolves.toEqual({
      status: "valid",
    });
    expect(verifyPin).toHaveBeenCalledOnce();
  });
});
