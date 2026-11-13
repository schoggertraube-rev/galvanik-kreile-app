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
    executeResults.push([], [], [makeRow(1,0)]);
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

  it("blockiert nach zehn frischen Fehlversuchen vor dem PIN-Vergleich", async () => {
    executeResults.push([], [makeRow(10, 5)]);
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

  it("sperrt nach zwanzig Fehlversuchen fuer dreissig Minuten, niemals dauerhaft", async () => {
    executeResults.push([], [makeRow(20, 29)]);
    const verifyPin = vi.fn().mockResolvedValue(true);
    const { runPinAttempt } = await import("@/lib/server/pinRateLimit");

    await expect(runPinAttempt("operator-1", verifyPin)).resolves.toMatchObject({status:"blocked",retryAtMs:expect.any(Number),retryAfterMinutes:1});
    expect(verifyPin).not.toHaveBeenCalled();
  });

  it("lässt nach Ablauf der temporären Sperre genau den serialisierten Versuch zu", async () => {
    executeResults.push([], [makeRow(10, 15)], []);
    const verifyPin = vi.fn().mockResolvedValue(true);
    const { runPinAttempt } = await import("@/lib/server/pinRateLimit");

    await expect(runPinAttempt("operator-1", verifyPin)).resolves.toEqual({
      status: "valid",
    });
    expect(verifyPin).toHaveBeenCalledOnce();
  });
  it.each([11,19,21,99])("startet zwischen Zehnergrenzen keine neue Sperre (%s)",async count=>{
    executeResults.push([],[makeRow(count,0)],[makeRow(count+1,0)]);
    const {runPinAttempt}=await import("@/lib/server/pinRateLimit");
    const verifyPin=vi.fn().mockResolvedValue(false);
    const result=await runPinAttempt("operator-1",verifyPin);
    expect(result.status).toBe((count+1)%10===0?"blocked":"invalid");
    expect(verifyPin).toHaveBeenCalledOnce();
  });
  it.each([[20,31],[100,1441]])("laesst abgelaufene Sperren wieder frei (%s)",async(count,minutes)=>{
    executeResults.push([],[makeRow(count,minutes)],[]);
    const {runPinAttempt}=await import("@/lib/server/pinRateLimit");
    expect(await runPinAttempt("operator-1",async()=>true)).toEqual({status:"valid"});
  });
  it("quittiert fehlenden echten Zaehlerbeleg nicht als Fehlversuch",async()=>{
    executeResults.push([],[],[]);
    const {runPinAttempt}=await import("@/lib/server/pinRateLimit");
    await expect(runPinAttempt("operator-1",async()=>false)).rejects.toThrow("PIN_RATE_LIMIT_RECEIPT_REQUIRED");
  });

});


it("PL19:45 trusts only Vercel provider headers and ignores the client forwarding chain",async()=>{
  const original=process.env.VERCEL;
  const {trustedPinClientIp}=await import("@/lib/server/pinRateLimit");
  try{
    process.env.VERCEL='1';
    expect(trustedPinClientIp(new Headers({'x-vercel-forwarded-for':'198.51.100.6, 203.0.113.1','x-real-ip':'203.0.113.2'}))).toBe('198.51.100.6');
    expect(trustedPinClientIp(new Headers({'x-real-ip':'203.0.113.2, 203.0.113.3'}))).toBe('203.0.113.2');
    expect(trustedPinClientIp(new Headers({'x-forwarded-for':'198.51.100.6'}))).toBeNull();
    expect(()=>trustedPinClientIp(new Headers({'x-vercel-forwarded-for':'not-an-ip'}))).toThrow('PIN_IP_SOURCE_INVALID');
    delete process.env.VERCEL;
    expect(trustedPinClientIp(new Headers({'x-vercel-forwarded-for':'198.51.100.6'}))).toBeNull();
  }finally{if(original===undefined)delete process.env.VERCEL;else process.env.VERCEL=original;}
});
