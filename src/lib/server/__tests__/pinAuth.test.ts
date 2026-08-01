import { beforeEach, describe, expect, it, vi } from "vitest";

process.env.APP_SESSION_SECRET = "pin-auth-test-secret-with-enough-entropy";

const mockHeaderGet = vi.fn((name: string): string | null => {
  if (name === "x-vercel-forwarded-for") return "203.0.113.44";
  return null;
});
const mockTxExecute = vi.fn();
const mockTxInsertValues = vi.fn();
const mockTransaction = vi.fn();
const selectResults: unknown[][] = [];

const mockTxSelect = vi.fn(() => {
  const result = selectResults.shift() ?? [];
  const limit = vi.fn().mockResolvedValue(result);
  return {
    from: vi.fn(() => ({
      where: vi.fn(() => ({
        orderBy: vi.fn(() => ({ limit })),
        limit,
      })),
    })),
  };
});

const tx = {
  execute: mockTxExecute,
  select: mockTxSelect,
  insert: vi.fn(() => ({ values: mockTxInsertValues })),
};

vi.mock("next/headers", () => ({
  headers: vi.fn().mockResolvedValue({ get: mockHeaderGet }),
}));

vi.mock("@/db", () => ({
  db: {
    transaction: mockTransaction,
  },
}));

vi.mock("@/db/schema", () => ({
  appUsers: {
    id: "user_id",
    tenantId: "tenant_id",
    role: "role",
    fullName: "full_name",
    pinHash: "pin_hash",
    active: "active",
  },
  uiEventsTable: {
    tenantId: "tenant_id",
    eventType: "event_type",
    payload: "payload",
    createdAt: "created_at",
  },
}));

const mockSql = vi.fn(
  (strings: TemplateStringsArray, ...values: unknown[]) => ({
    strings: [...strings],
    values,
  }),
);
const mockInArray = vi.fn((column: unknown, value: unknown) => ({
  kind: "inArray",
  column,
  value,
}));

vi.mock("drizzle-orm", () => ({
  and: vi.fn((...conditions: unknown[]) => conditions),
  desc: vi.fn((column: unknown) => ({ kind: "desc", column })),
  eq: vi.fn((column: unknown, value: unknown) => ({ kind: "eq", column, value })),
  gte: vi.fn((column: unknown, value: unknown) => ({ kind: "gte", column, value })),
  inArray: mockInArray,
  sql: mockSql,
}));

describe("PIN authentication boundary", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    selectResults.length = 0;
    mockTransaction.mockImplementation(async (callback) => callback(tx));
    mockTxExecute.mockResolvedValue([{ acquired: true }]);
    mockTxInsertValues.mockResolvedValue(undefined);
    mockHeaderGet.mockImplementation((name: string) => {
      if (name === "x-vercel-forwarded-for") return "203.0.113.44";
      return null;
    });
  });

  it("derives a stable, non-reversible source identifier", async () => {
    const { hashPinLoginSource } = await import("@/lib/server/pinAuth");
    const first = hashPinLoginSource(
      "secret",
      "203.0.113.44, 10.0.0.1",
    );
    const same = hashPinLoginSource("secret", "203.0.113.44");
    const other = hashPinLoginSource("secret", "203.0.113.45");

    expect(first).toMatch(/^[a-f0-9]{64}$/);
    expect(first).toBe(same);
    expect(first).not.toBe(other);
    expect(first).not.toContain("203.0.113.44");
  });

  it("cannot bypass the source limit by rotating the user-agent", async () => {
    const userId = "123e4567-e89b-42d3-a456-426614174000";
    const createdAt = new Date();
    selectResults.push(Array.from({ length: 5 }, () => ({
      payload: { userId, sourceHash: "stored-hash" },
      createdAt,
    })));
    mockHeaderGet.mockImplementation((name: string) => {
      if (name === "x-vercel-forwarded-for") return "203.0.113.44";
      if (name === "user-agent") return "rotated-user-agent";
      return null;
    });

    const { verifyPinLogin } = await import("@/lib/server/pinAuth");
    const result = await verifyPinLogin(userId, "6147");

    expect(result.ok).toBe(false);
    expect(mockHeaderGet).not.toHaveBeenCalledWith("user-agent");
    expect(mockTxSelect).toHaveBeenCalledOnce();
    expect(mockTxInsertValues).not.toHaveBeenCalled();
  });

  it("verifies a bcrypt or transitional legacy PIN inside Postgres without returning the hash", async () => {
    const userId = "223e4567-e89b-42d3-a456-426614174001";
    selectResults.push([], [{
      id: userId,
      tenantId: "galvanik-kreile",
      role: "werkstatt",
      fullName: "Max Mustermann",
      pinMatches: true,
    }]);

    const { verifyPinLogin } = await import("@/lib/server/pinAuth");
    await expect(verifyPinLogin(userId, "6147")).resolves.toEqual({
      ok: true,
      identity: {
        id: userId,
        tenantId: "galvanik-kreile",
        role: "werkstatt",
        displayName: "Max Mustermann",
      },
    });

    const sqlText = mockSql.mock.calls
      .map((call) => call[0].join(" "))
      .join("\n");
    expect(sqlText).toContain("extensions.crypt");
    expect(sqlText).toContain("^[0-9]{4}$");
    expect(mockInArray).toHaveBeenCalledWith(
      "role",
      ["meister", "buero", "werkstatt", "readonly"],
    );
    expect(mockTxInsertValues).not.toHaveBeenCalled();
  });

  it("records a failed attempt with a hashed source and a neutral response", async () => {
    const userId = "323e4567-e89b-42d3-a456-426614174002";
    selectResults.push([], [{
      id: userId,
      tenantId: "galvanik-kreile",
      role: "meister",
      fullName: "Mira Meister",
      pinMatches: false,
    }]);

    const { verifyPinLogin } = await import("@/lib/server/pinAuth");
    await expect(verifyPinLogin(userId, "6147")).resolves.toEqual({
      ok: false,
      message: "Ungültige PIN oder inaktiver Benutzer.",
    });

    expect(mockTxInsertValues).toHaveBeenCalledOnce();
    const inserted = mockTxInsertValues.mock.calls[0][0];
    expect(inserted).toMatchObject({
      tenantId: "galvanik-kreile",
      eventType: "pin_login_failed",
      payload: { userId },
    });
    expect(inserted.payload.sourceHash).toMatch(/^[a-f0-9]{64}$/);
    expect(JSON.stringify(inserted)).not.toContain("203.0.113.44");
    expect(JSON.stringify(inserted)).not.toContain("6147");
  });

  it("rate-limits one user/source after five failures without a global account lock", async () => {
    const userId = "423e4567-e89b-42d3-a456-426614174003";
    const createdAt = new Date();
    selectResults.push(Array.from({ length: 5 }, () => ({
      payload: { userId, sourceHash: "stored-hash" },
      createdAt,
    })));

    const { verifyPinLogin } = await import("@/lib/server/pinAuth");
    const result = await verifyPinLogin(userId, "6147");

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.retryAfterSeconds).toBeGreaterThan(0);
    expect(mockTxSelect).toHaveBeenCalledOnce();
    expect(mockTxInsertValues).not.toHaveBeenCalled();
  });

  it("rate-limits one abusive source across user ids after twenty failures", async () => {
    const createdAt = new Date();
    selectResults.push(Array.from({ length: 20 }, (_, index) => ({
      payload: {
        userId: `source-target-${index}`,
        sourceHash: "stored-hash",
      },
      createdAt,
    })));

    const { verifyPinLogin } = await import("@/lib/server/pinAuth");
    const result = await verifyPinLogin(
      "523e4567-e89b-42d3-a456-426614174004",
      "6147",
    );

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.retryAfterSeconds).toBeGreaterThan(0);
    expect(mockTxSelect).toHaveBeenCalledOnce();
    expect(mockTxInsertValues).not.toHaveBeenCalled();
  });

  it("counts malformed transport input as a failure without querying app_users", async () => {
    selectResults.push([]);

    const { verifyPinLogin } = await import("@/lib/server/pinAuth");
    await expect(verifyPinLogin(["forged-user"], { pin: "6147" })).resolves.toEqual({
      ok: false,
      message: "Ungültige PIN oder inaktiver Benutzer.",
    });

    expect(mockTxSelect).toHaveBeenCalledOnce();
    expect(mockTxInsertValues).toHaveBeenCalledOnce();
  });

  it("does not turn malformed targets into a five-attempt account lock", async () => {
    const createdAt = new Date();
    selectResults.push(Array.from({ length: 5 }, () => ({
      payload: { userId: null, sourceHash: "stored-hash" },
      createdAt,
    })));

    const { verifyPinLogin } = await import("@/lib/server/pinAuth");
    await expect(verifyPinLogin("not-a-uuid", "6147")).resolves.toEqual({
      ok: false,
      message: "Ungültige PIN oder inaktiver Benutzer.",
    });

    expect(mockTxSelect).toHaveBeenCalledOnce();
    expect(mockTxInsertValues).toHaveBeenCalledOnce();
  });

  it("canonicalizes UUID case before applying the per-user failure bucket", async () => {
    const canonicalUserId = "a23e4567-e89b-42d3-a456-426614174006";
    const createdAt = new Date();
    selectResults.push(Array.from({ length: 5 }, () => ({
      payload: { userId: canonicalUserId, sourceHash: "stored-hash" },
      createdAt,
    })));

    const { verifyPinLogin } = await import("@/lib/server/pinAuth");
    const result = await verifyPinLogin(canonicalUserId.toUpperCase(), "6147");

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.retryAfterSeconds).toBeGreaterThan(0);
    expect(mockTxSelect).toHaveBeenCalledOnce();
    expect(mockTxInsertValues).not.toHaveBeenCalled();
  });

  it("serializes the read-check-write sequence before recording a failure", async () => {
    const userId = "623e4567-e89b-42d3-a456-426614174005";
    selectResults.push([], []);

    const { verifyPinLogin } = await import("@/lib/server/pinAuth");
    await verifyPinLogin(userId, "6147");

    expect(mockTxExecute).toHaveBeenCalledOnce();
    expect(mockTxExecute.mock.calls[0][0].strings.join(" ")).toContain(
      "pg_try_advisory_xact_lock",
    );
    expect(mockTxExecute.mock.invocationCallOrder[0]).toBeLessThan(
      mockTxInsertValues.mock.invocationCallOrder[0],
    );
  });

  it("fails fast when another request already owns the source lock", async () => {
    mockTxExecute.mockResolvedValueOnce([{ acquired: false }]);

    const { verifyPinLogin } = await import("@/lib/server/pinAuth");
    await expect(
      verifyPinLogin("623e4567-e89b-42d3-a456-426614174005", "6147"),
    ).resolves.toEqual({
      ok: false,
      message: "Anmeldung wird bereits geprüft. Bitte kurz erneut versuchen.",
      retryAfterSeconds: 1,
    });

    expect(mockTxSelect).not.toHaveBeenCalled();
    expect(mockTxInsertValues).not.toHaveBeenCalled();
  });
});
