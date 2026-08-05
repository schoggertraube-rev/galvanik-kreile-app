import { beforeEach, describe, expect, it, vi } from "vitest";

const mockRequireAdminOrDeveloper = vi.fn();
const mockBcryptHash = vi.fn();
const mockCreateSupabaseClient = vi.fn();
const mockCreateAuthUser = vi.fn();
const mockDeleteAuthUser = vi.fn();
const mockDbInsert = vi.fn();
const mockDbInsertValues = vi.fn();
const mockDbTransaction = vi.fn();
const mockTxUpdate = vi.fn();
const mockTxSet = vi.fn();
const mockTxWhere = vi.fn();
const mockTxReturning = vi.fn();
const mockTxDelete = vi.fn();
const mockTxDeleteWhere = vi.fn();
const mockAnd = vi.fn((...conditions: unknown[]) => conditions);
const mockEq = vi.fn((column: unknown, value: unknown) => ({
  kind: "eq",
  column,
  value,
}));

const tx = {
  update: mockTxUpdate,
  delete: mockTxDelete,
};

vi.mock("@/lib/auth/permissions", () => ({
  requireAdminOrDeveloper: mockRequireAdminOrDeveloper,
}));

vi.mock("bcryptjs", () => ({
  default: {
    hash: mockBcryptHash,
  },
}));

vi.mock("@supabase/supabase-js", () => ({
  createClient: mockCreateSupabaseClient,
}));

vi.mock("@/db", () => ({
  db: {
    insert: mockDbInsert,
    transaction: mockDbTransaction,
  },
}));

vi.mock("@/db/schema", () => ({
  appUsers: {
    id: "app_users.id",
    tenantId: "app_users.tenant_id",
  },
  featureFlags: {},
  pinRateLimits: {
    operatorId: "pin_rate_limits.operator_id",
  },
}));

vi.mock("drizzle-orm", () => ({
  and: mockAnd,
  eq: mockEq,
}));

vi.mock("@/lib/auth/authorizationContract", () => ({
  isAppRole: (role: unknown) =>
    ["developer", "admin", "meister", "buero", "werkstatt", "readonly"].includes(
      String(role),
    ),
}));

vi.mock("@/lib/server/appSession", () => ({
  APP_TENANT_ID: "galvanik-kreile",
}));

describe("admin PIN writes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://example.supabase.co");
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "service-role-test-key");
    mockRequireAdminOrDeveloper.mockResolvedValue(undefined);
    mockBcryptHash.mockResolvedValue("$2b$12$server-generated-hash");
    mockCreateAuthUser.mockResolvedValue({
      data: { user: { id: "223e4567-e89b-12d3-a456-426614174001" } },
      error: null,
    });
    mockDeleteAuthUser.mockResolvedValue({ error: null });
    mockCreateSupabaseClient.mockReturnValue({
      auth: {
        admin: {
          createUser: mockCreateAuthUser,
          deleteUser: mockDeleteAuthUser,
        },
      },
    });
    mockDbInsert.mockReturnValue({ values: mockDbInsertValues });
    mockDbInsertValues.mockResolvedValue(undefined);
    mockDbTransaction.mockImplementation(async (callback) => callback(tx));
    mockTxReturning.mockResolvedValue([
      { id: "223e4567-e89b-12d3-a456-426614174001" },
    ]);
    mockTxWhere.mockReturnValue({ returning: mockTxReturning });
    mockTxSet.mockReturnValue({ where: mockTxWhere });
    mockTxUpdate.mockReturnValue({ set: mockTxSet });
    mockTxDeleteWhere.mockResolvedValue(undefined);
    mockTxDelete.mockReturnValue({ where: mockTxDeleteWhere });
  });

  it("hashes a new user's PIN before any database write", async () => {
    const { createUser } = await import("@/app/actions/admin.actions");

    await expect(
      createUser({
        email: "max@example.test",
        fullName: "Max Mustermann",
        role: "werkstatt",
        pin: "4827",
      }),
    ).resolves.toEqual({
      success: true,
      userId: "223e4567-e89b-12d3-a456-426614174001",
    });

    expect(mockBcryptHash).toHaveBeenCalledWith("4827", 12);
    expect(mockDbInsertValues).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId: "galvanik-kreile",
        pinHash: "$2b$12$server-generated-hash",
      }),
    );
    expect(JSON.stringify(mockDbInsertValues.mock.calls)).not.toContain("4827");
  });

  it("hashes a reset PIN and clears the operator's lock in one transaction", async () => {
    const { updateUserPin } = await import("@/app/actions/admin.actions");

    await expect(
      updateUserPin("223e4567-e89b-12d3-a456-426614174001", "5938"),
    ).resolves.toEqual({ success: true });

    expect(mockBcryptHash).toHaveBeenCalledWith("5938", 12);
    expect(mockTxSet).toHaveBeenCalledWith({
      pinHash: "$2b$12$server-generated-hash",
      updatedAt: expect.any(Date),
    });
    expect(mockTxDelete).toHaveBeenCalledOnce();
    expect(JSON.stringify(mockTxSet.mock.calls)).not.toContain("5938");
  });

  it("rejects malformed PINs before hashing or external writes", async () => {
    const { createUser } = await import("@/app/actions/admin.actions");

    await expect(
      createUser({
        email: "max@example.test",
        fullName: "Max Mustermann",
        role: "werkstatt",
        pin: "12ab",
      }),
    ).rejects.toThrow("PIN muss aus genau vier Ziffern bestehen.");

    expect(mockBcryptHash).not.toHaveBeenCalled();
    expect(mockCreateAuthUser).not.toHaveBeenCalled();
    expect(mockDbInsert).not.toHaveBeenCalled();
  });
});
