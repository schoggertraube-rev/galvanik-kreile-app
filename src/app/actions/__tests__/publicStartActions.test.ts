import { beforeEach, describe, expect, it, vi } from "vitest";

const mockDirectValues = vi.fn();
const mockTransaction = vi.fn();
const mockTxExecute = vi.fn();
const mockTxValues = vi.fn();
const mockAnd = vi.fn((...conditions: unknown[]) => conditions);
const mockEq = vi.fn((column: unknown, value: unknown) => ({
  kind: "eq",
  column,
  value,
}));
const mockGte = vi.fn((column: unknown, value: unknown) => ({
  kind: "gte",
  column,
  value,
}));
const mockInArray = vi.fn((column: unknown, value: unknown) => ({
  kind: "inArray",
  column,
  value,
}));
const mockIsNotNull = vi.fn((column: unknown) => ({ kind: "isNotNull", column }));
const mockSql = vi.fn(
  (strings: TemplateStringsArray, ...values: unknown[]) => ({
    strings: [...strings],
    values,
  }),
);
const selectResults: unknown[][] = [];

const mockTxSelect = vi.fn(() => {
  const result = selectResults.shift() ?? [];
  return {
    from: vi.fn(() => ({
      where: vi.fn(() => ({
        limit: vi.fn().mockResolvedValue(result),
      })),
    })),
  };
});

const tx = {
  execute: mockTxExecute,
  select: mockTxSelect,
  insert: vi.fn(() => ({ values: mockTxValues })),
};

vi.mock("@/db", () => ({
  db: {
    insert: vi.fn(() => ({ values: mockDirectValues })),
    transaction: mockTransaction,
  },
}));

vi.mock("@/db/schema", () => ({
  appUsers: {
    id: "id",
    tenantId: "tenant_id",
    fullName: "full_name",
    role: "role",
    active: "active",
    pinHash: "pin_hash",
  },
  uiEventsTable: {
    tenantId: "tenant_id",
    eventType: "event_type",
    payload: "payload",
    createdAt: "created_at",
  },
}));

vi.mock("drizzle-orm", () => ({
  and: mockAnd,
  eq: mockEq,
  gte: mockGte,
  inArray: mockInArray,
  isNotNull: mockIsNotNull,
  sql: mockSql,
}));

describe("public start actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    selectResults.length = 0;
    mockTransaction.mockImplementation(async (callback) => callback(tx));
    mockTxExecute.mockResolvedValue([{ acquired: true }]);
    mockTxValues.mockResolvedValue(undefined);
    mockDirectValues.mockResolvedValue(undefined);
  });

  it("does not export an anonymous order-priority reader", async () => {
    const actions = await import("@/app/actions/start.actions");

    expect(actions).not.toHaveProperty("getTodayTopPriority");
  });

  it("ignores malformed reset targets without touching the database", async () => {
    const { notifyAdminPinReset } = await import("@/app/actions/start.actions");

    await expect(notifyAdminPinReset("not-a-user-id")).resolves.toEqual({
      success: true,
    });

    expect(mockTransaction).not.toHaveBeenCalled();
    expect(mockDirectValues).not.toHaveBeenCalled();

    const invokeLikeTransport = notifyAdminPinReset as unknown as (
      userId: unknown,
    ) => Promise<{ success: boolean }>;
    await expect(
      invokeLikeTransport(["223e4567-e89b-42d3-a456-426614174001"]),
    ).resolves.toEqual({ success: true });
    expect(mockTransaction).not.toHaveBeenCalled();
  });

  it("returns the neutral response for an unknown valid user id", async () => {
    selectResults.push([]);
    const { notifyAdminPinReset } = await import("@/app/actions/start.actions");

    await expect(
      notifyAdminPinReset("323e4567-e89b-42d3-a456-426614174002"),
    ).resolves.toEqual({ success: true });

    expect(mockTransaction).toHaveBeenCalledOnce();
    expect(mockTxValues).not.toHaveBeenCalled();
  });

  it("resolves the reset user canonically and ignores a forged client name", async () => {
    const canonicalUser = {
      id: "223e4567-e89b-12d3-a456-426614174001",
      fullName: "Max Kreile",
    };
    selectResults.push([canonicalUser], []);

    const { notifyAdminPinReset } = await import("@/app/actions/start.actions");
    const invokeLikeTransport = notifyAdminPinReset as unknown as (
      userId: string,
      forgedName: string,
    ) => Promise<{ success: boolean }>;

    await expect(
      invokeLikeTransport(canonicalUser.id, "Attacker Controlled Name"),
    ).resolves.toEqual({ success: true });

    expect(mockTxValues).toHaveBeenCalledOnce();
    expect(mockTxValues).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId: "galvanik-kreile",
        eventType: "pin_reset_requested",
        payload: expect.objectContaining({
          userId: canonicalUser.id,
          userName: canonicalUser.fullName,
        }),
      }),
    );
    expect(JSON.stringify(mockTxValues.mock.calls)).not.toContain(
      "Attacker Controlled Name",
    );
    expect(mockEq).toHaveBeenCalledWith("id", canonicalUser.id);
    expect(mockEq).toHaveBeenCalledWith("tenant_id", "galvanik-kreile");
    expect(mockEq).toHaveBeenCalledWith("active", true);
    expect(mockInArray).toHaveBeenCalledWith(
      "role",
      ["meister", "buero", "werkstatt", "readonly"],
    );
    expect(mockIsNotNull).toHaveBeenCalledWith("pin_hash");
    expect(mockGte).toHaveBeenCalledWith("created_at", expect.any(Date));
    expect(mockTxExecute).toHaveBeenCalledOnce();
    expect(mockTxExecute.mock.calls[0][0].strings.join(" ")).toContain(
      "pg_try_advisory_xact_lock",
    );
    expect(mockTxExecute.mock.invocationCallOrder[0]).toBeLessThan(
      mockTxValues.mock.invocationCallOrder[0],
    );
  });

  it("returns the same success response while suppressing repeated reset writes", async () => {
    const userId = "223e4567-e89b-12d3-a456-426614174001";
    selectResults.push(
      [{ id: userId, fullName: "Max Kreile" }],
      [
        { payload: { userId } },
        { payload: { userId } },
        { payload: { userId } },
      ],
    );

    const { notifyAdminPinReset } = await import("@/app/actions/start.actions");

    await expect(notifyAdminPinReset(userId)).resolves.toEqual({
      success: true,
    });

    expect(mockTxValues).not.toHaveBeenCalled();
  });
});
