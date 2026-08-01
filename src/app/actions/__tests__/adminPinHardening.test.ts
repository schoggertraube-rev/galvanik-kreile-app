import { beforeEach, describe, expect, it, vi } from "vitest";

const mockRequireAdminOrDeveloper = vi.fn();
const mockTransaction = vi.fn();
const mockTxExecute = vi.fn();
const mockTxUpdateSet = vi.fn();
const mockCreateClient = vi.fn();
const selectResults: unknown[][] = [];

const mockTxSelect = vi.fn(() => {
  const result = selectResults.shift() ?? [];
  const limit = vi.fn().mockResolvedValue(result);
  return {
    from: vi.fn(() => ({
      where: vi.fn(() => ({ limit })),
    })),
  };
});

const tx = {
  execute: mockTxExecute,
  select: mockTxSelect,
  update: vi.fn(() => ({
    set: mockTxUpdateSet,
  })),
};

vi.mock("@/lib/auth/permissions", () => ({
  requireAdminOrDeveloper: mockRequireAdminOrDeveloper,
}));

vi.mock("@/db", () => ({
  db: {
    transaction: mockTransaction,
  },
}));

vi.mock("@/db/schema", () => ({
  appUsers: {
    id: "id",
    tenantId: "tenant_id",
    pinHash: "pin_hash",
    role: "role",
    active: "active",
    updatedAt: "updated_at",
  },
  featureFlags: {},
}));

const mockEq = vi.fn((column: unknown, value: unknown) => ({ column, value }));
const mockSql = vi.fn(
  (strings: TemplateStringsArray, ...values: unknown[]) => ({
    strings: [...strings],
    values,
  }),
);

vi.mock("drizzle-orm", () => ({
  and: vi.fn((...conditions: unknown[]) => conditions),
  eq: mockEq,
  ne: vi.fn((column: unknown, value: unknown) => ({ column, value, kind: "ne" })),
  sql: mockSql,
}));

vi.mock("@supabase/supabase-js", () => ({
  createClient: mockCreateClient,
}));

describe("admin PIN mutation boundary", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    selectResults.length = 0;
    mockRequireAdminOrDeveloper.mockResolvedValue(undefined);
    mockTransaction.mockImplementation(async (callback) => callback(tx));
    mockTxExecute.mockResolvedValue(undefined);
    mockTxUpdateSet.mockReturnValue({ where: vi.fn().mockResolvedValue(undefined) });
  });

  it("rejects the former public default before touching the database", async () => {
    const { updateUserPin } = await import("@/app/actions/admin.actions");

    await expect(
      updateUserPin("223e4567-e89b-42d3-a456-426614174001", "1234"),
    ).rejects.toThrow(/leicht zu erraten/i);
    expect(mockTransaction).not.toHaveBeenCalled();
  });

  it("requires an explicit PIN for every new non-developer user", async () => {
    const { createUser } = await import("@/app/actions/admin.actions");

    await expect(createUser({
      email: "neu@kreile.de",
      fullName: "Neue Person",
      role: "werkstatt",
    })).rejects.toThrow(/vier Ziffern/i);

    expect(mockCreateClient).not.toHaveBeenCalled();
    expect(mockTransaction).not.toHaveBeenCalled();
  });

  it("rejects a PIN already used by another tenant user", async () => {
    const userId = "223e4567-e89b-42d3-a456-426614174001";
    selectResults.push([{ id: userId, role: "werkstatt" }], [{ id: "other-user" }]);

    const { updateUserPin } = await import("@/app/actions/admin.actions");
    await expect(updateUserPin(userId, "6147")).rejects.toThrow(/bereits verwendet/i);
    expect(mockTxUpdateSet).not.toHaveBeenCalled();
  });

  it("serializes uniqueness and stores only a bcrypt expression", async () => {
    const userId = "223e4567-e89b-42d3-a456-426614174001";
    selectResults.push([{ id: userId, role: "werkstatt" }], []);

    const { updateUserPin } = await import("@/app/actions/admin.actions");
    await expect(updateUserPin(userId, "6147")).resolves.toEqual({ success: true });

    expect(mockTxExecute).toHaveBeenCalledOnce();
    expect(mockTxExecute.mock.calls[0][0].strings.join(" ")).toContain(
      "pg_advisory_xact_lock",
    );
    expect(mockTxUpdateSet).toHaveBeenCalledOnce();
    const update = mockTxUpdateSet.mock.calls[0][0];
    expect(update.pinHash.strings.join(" ")).toContain("extensions.crypt");
    expect(update.pinHash.strings.join(" ")).toContain("extensions.gen_salt('bf', 12)");
    expect(update.pinHash.values).toContain("6147");
    expect(update.pinHash).not.toBe("6147");
    expect(mockEq).toHaveBeenCalledWith("tenant_id", "galvanik-kreile");
  });

  it("refuses to assign a PIN to a developer account", async () => {
    const userId = "223e4567-e89b-42d3-a456-426614174001";
    selectResults.push([{ id: userId, role: "developer" }]);

    const { updateUserPin } = await import("@/app/actions/admin.actions");
    await expect(updateUserPin(userId, "6147")).rejects.toThrow(/E-Mail-Login/i);
    expect(mockTxUpdateSet).not.toHaveBeenCalled();
  });

  it("refuses to assign a PIN to an admin account", async () => {
    const userId = "323e4567-e89b-42d3-a456-426614174002";
    selectResults.push([{ id: userId, role: "admin" }]);

    const { updateUserPin } = await import("@/app/actions/admin.actions");
    await expect(updateUserPin(userId, "6147")).rejects.toThrow(/E-Mail-Login/i);
    expect(mockTxUpdateSet).not.toHaveBeenCalled();
  });

  it("serializes an email-to-PIN role change and clears any hidden legacy PIN", async () => {
    const userId = "423e4567-e89b-42d3-a456-426614174003";
    selectResults.push([{ id: userId, role: "developer", pinHash: "1234" }]);

    const { updateUserRole } = await import("@/app/actions/admin.actions");
    await expect(updateUserRole(userId, "werkstatt")).resolves.toEqual({ success: true });

    expect(mockTxExecute).toHaveBeenCalledOnce();
    expect(mockTxExecute.mock.calls[0][0].strings.join(" ")).toContain(
      "pg_advisory_xact_lock",
    );
    expect(mockTxUpdateSet).toHaveBeenCalledWith(
      expect.objectContaining({
        role: "werkstatt",
        pinHash: null,
        updatedAt: expect.any(Date),
      }),
    );
  });

  it("retains a protected PIN across two operational roles", async () => {
    const userId = "423e4567-e89b-42d3-a456-426614174003";
    selectResults.push([{ id: userId, role: "buero" }]);

    const { updateUserRole } = await import("@/app/actions/admin.actions");
    await expect(updateUserRole(userId, "werkstatt")).resolves.toEqual({ success: true });

    expect(mockTxUpdateSet.mock.calls[0][0]).not.toHaveProperty("pinHash");
  });

  it("clears a PIN when a user moves to an email-only role", async () => {
    const userId = "523e4567-e89b-42d3-a456-426614174004";
    selectResults.push([{ id: userId, role: "werkstatt" }]);

    const { updateUserRole } = await import("@/app/actions/admin.actions");
    await expect(updateUserRole(userId, "admin")).resolves.toEqual({ success: true });

    expect(mockTxUpdateSet).toHaveBeenCalledWith(
      expect.objectContaining({ role: "admin", pinHash: null }),
    );
  });

  it("does not propagate a database error object containing the submitted PIN", async () => {
    const databaseError = Object.assign(new Error("query failed"), {
      params: ["223e4567-e89b-42d3-a456-426614174001", "6147"],
    });
    mockTransaction.mockRejectedValue(databaseError);

    const { updateUserPin } = await import("@/app/actions/admin.actions");
    let thrown: unknown;
    try {
      await updateUserPin("223e4567-e89b-42d3-a456-426614174001", "6147");
    } catch (error) {
      thrown = error;
    }

    expect(thrown).toBeInstanceOf(Error);
    expect(thrown).not.toBe(databaseError);
    expect((thrown as Error).message).toBe("PIN konnte nicht sicher gespeichert werden.");
    expect(JSON.stringify(thrown)).not.toContain("6147");
  });
});
