import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  resolveAuthorization: vi.fn(),
  select: vi.fn(),
  selectFrom: vi.fn(),
  selectWhere: vi.fn(),
  update: vi.fn(),
  updateSet: vi.fn(),
  updateWhere: vi.fn(),
  returning: vi.fn(),
}));

vi.mock("@/lib/server/authorization", () => ({
  resolveAuthorization: mocks.resolveAuthorization,
}));

vi.mock("@/lib/auth/permissions", () => ({
  requireAdminOrDeveloper: vi.fn(),
}));

vi.mock("@/db", () => ({
  db: {
    select: mocks.select,
    update: mocks.update,
  },
}));

vi.mock("@/db/schema", () => ({
  appUsers: {
    id: "app_users.id",
    tenantId: "app_users.tenant_id",
    role: "app_users.role",
  },
  featureFlags: {},
}));

vi.mock("drizzle-orm", () => ({
  eq: (left: unknown, right: unknown) => ({ kind: "eq", left, right }),
  and: (...conditions: unknown[]) => ({ kind: "and", conditions }),
}));

function authorized(role: "admin" | "developer" = "admin") {
  return {
    ok: true,
    data: {
      tenantId: "galvanik-kreile",
      role,
      permissions: ["perm_sys_users"],
    },
  };
}

describe("admin user tenant and privilege boundary", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.resolveAuthorization.mockResolvedValue(authorized());
    mocks.select.mockReturnValue({ from: mocks.selectFrom });
    mocks.selectFrom.mockReturnValue({ where: mocks.selectWhere });
    mocks.update.mockReturnValue({ set: mocks.updateSet });
    mocks.updateSet.mockReturnValue({ where: mocks.updateWhere });
    mocks.updateWhere.mockReturnValue({ returning: mocks.returning });
    mocks.selectWhere.mockResolvedValue([]);
    mocks.returning.mockResolvedValue([]);
  });

  it("scopes the user list to the authenticated tenant", async () => {
    const { getUsers } = await import("@/app/actions/admin.actions");
    await getUsers();

    expect(mocks.selectWhere).toHaveBeenCalledWith({
      kind: "eq",
      left: "app_users.tenant_id",
      right: "galvanik-kreile",
    });
  });

  it("scopes role updates by tenant and current role and rejects a missing receipt", async () => {
    mocks.selectWhere.mockResolvedValue([{ role: "admin" }]);
    const { updateUserRole } = await import("@/app/actions/admin.actions");

    await expect(updateUserRole("target-user", "meister"))
      .rejects.toThrow("USER_MUTATION_RECEIPT_MISSING");

    expect(mocks.updateWhere).toHaveBeenCalledWith({
      kind: "and",
      conditions: [
        { kind: "eq", left: "app_users.id", right: "target-user" },
        { kind: "eq", left: "app_users.tenant_id", right: "galvanik-kreile" },
        { kind: "eq", left: "app_users.role", right: "admin" },
      ],
    });
  });

  it("does not let an admin create or assign the developer role", async () => {
    const { updateUserRole } = await import("@/app/actions/admin.actions");

    await expect(updateUserRole("target-user", "developer"))
      .rejects.toThrow("Entwicklerkonten");
    expect(mocks.select).not.toHaveBeenCalled();
    expect(mocks.update).not.toHaveBeenCalled();
  });

  it("does not let an admin deactivate an existing developer", async () => {
    mocks.selectWhere.mockResolvedValue([{ role: "developer" }]);
    const { toggleUserStatus } = await import("@/app/actions/admin.actions");

    await expect(toggleUserStatus("developer-user", false))
      .rejects.toThrow("Entwicklerkonten");
    expect(mocks.update).not.toHaveBeenCalled();
  });

  it("returns success only after exactly one matching mutation receipt", async () => {
    mocks.selectWhere.mockResolvedValue([{ role: "admin" }]);
    mocks.returning.mockResolvedValue([{ id: "target-user" }]);
    const { toggleUserStatus } = await import("@/app/actions/admin.actions");

    await expect(toggleUserStatus("target-user", false))
      .resolves.toEqual({ success: true });
  });
});
