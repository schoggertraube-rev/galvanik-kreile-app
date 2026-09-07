import { KREILE_TENANT_SLUG } from "@/lib/tenant";
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
const mockNe = vi.fn((column: unknown, value: unknown) => ({
  kind: "ne",
  column,
  value,
}));
const mockSql = vi.fn(
  (strings: TemplateStringsArray, ...values: unknown[]) => ({
    strings: [...strings],
    values,
  }),
);
const selectResults: unknown[][] = [];

function handleFor(userId: string): string {
  return `handle-${userId}`;
}

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
  ne: mockNe,
  sql: mockSql,
}));

vi.mock("@/lib/server/appSession", () => ({
  APP_TENANT_ID: KREILE_TENANT_SLUG,
}));

vi.mock("@/lib/server/pinLoginHandle", () => ({
  isValidPinLoginHandle: (value: unknown) =>
    typeof value === "string" && value.startsWith("handle-"),
  resolvePinLoginCandidate: (
    handle: string,
    candidates: Array<{ id: string }>,
  ) => candidates.find((candidate) => handleFor(candidate.id) === handle),
}));

describe("public start actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    selectResults.length = 0;
    mockTransaction.mockImplementation(async (callback) => callback(tx));
    mockTxExecute.mockResolvedValue(undefined);
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

  it("returns the neutral response for an unknown valid login handle", async () => {
    selectResults.push([]);
    const { notifyAdminPinReset } = await import("@/app/actions/start.actions");

    await expect(
      notifyAdminPinReset("handle-unknown-user"),
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
      invokeLikeTransport(handleFor(canonicalUser.id), "Attacker Controlled Name"),
    ).resolves.toEqual({ success: true });

    expect(mockTxValues).toHaveBeenCalledOnce();
    expect(mockTxValues).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId: KREILE_TENANT_SLUG,
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
    expect(mockEq).toHaveBeenCalledWith("tenant_id", KREILE_TENANT_SLUG);
    expect(mockEq).toHaveBeenCalledWith("active", true);
    expect(mockNe).toHaveBeenCalledWith("role", "developer");
    expect(mockGte).toHaveBeenCalledWith("created_at", expect.any(Date));
    expect(mockTxExecute).toHaveBeenCalledOnce();
    expect(mockTxExecute.mock.calls[0][0].strings.join(" ")).toContain(
      "pg_advisory_xact_lock",
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

    await expect(notifyAdminPinReset(handleFor(userId))).resolves.toEqual({
      success: true,
    });

    expect(mockTxValues).not.toHaveBeenCalled();
  });
});
