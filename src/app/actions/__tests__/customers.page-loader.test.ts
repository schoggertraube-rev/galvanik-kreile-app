import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  resolveAuthorization: vi.fn(),
  checkAppAuth: vi.fn(),
  isServerFeatureEnabled: vi.fn(),
  listCustomersContract: vi.fn(),
  logCustomerShadowDiff: vi.fn(),
  select: vi.fn(),
  from: vi.fn(),
  where: vi.fn(),
  orderBy: vi.fn(),
}));

vi.mock("@/db", () => ({
  db: {
    select: mocks.select,
  },
}));

vi.mock("@/lib/server/authorization", () => ({
  resolveAuthorization: mocks.resolveAuthorization,
}));

vi.mock("@/lib/server/authHelper", () => ({
  checkAppAuth: mocks.checkAppAuth,
}));

vi.mock("@/lib/server/featureFlags", () => ({
  isServerFeatureEnabled: mocks.isServerFeatureEnabled,
}));

vi.mock("@/lib/server/contracts/customersContract", () => ({
  list: mocks.listCustomersContract,
  logCustomerShadowDiff: mocks.logCustomerShadowDiff,
}));

describe("getCustomersPageCustomers", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mocks.checkAppAuth.mockResolvedValue({ ok: true, data: "admin" });
    mocks.resolveAuthorization.mockResolvedValue({
      ok: true,
      data: {
        userId: "user-1",
        tenantId: "tenant-a",
        displayName: "Test User",
        initials: "TU",
        role: "admin",
        permissions: [],
        active: true,
      },
    });
    mocks.isServerFeatureEnabled.mockImplementation(async (flag: string) => flag === "KREILE_CONTRACT_CUSTOMERS" ? false : false);
    mocks.listCustomersContract.mockResolvedValue([
      { id: "shared-1", name: "Shared" },
      { id: "contract-1", name: "Contract" },
    ]);
    mocks.select.mockReturnValue({ from: mocks.from });
    mocks.from.mockReturnValue({ where: mocks.where });
    mocks.where.mockReturnValue({ orderBy: mocks.orderBy });
    mocks.orderBy.mockResolvedValue([
      { id: "shared-1", name: "Shared" },
      { id: "legacy-1", name: "Legacy" },
    ]);
  });

  it("uses only the legacy path when the contract flag is off", async () => {
    const { getCustomersPageCustomers } = await import("../customers.actions");

    const result = await getCustomersPageCustomers();

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data).toEqual([
        expect.objectContaining({ id: "legacy-1", name: "Legacy" }),
        expect.objectContaining({ id: "shared-1", name: "Shared" }),
      ]);
    }
    expect(mocks.select).toHaveBeenCalledTimes(1);
    expect(mocks.listCustomersContract).not.toHaveBeenCalled();
    expect(mocks.logCustomerShadowDiff).not.toHaveBeenCalled();
  });

  it("uses only the contract path when the contract flag is on", async () => {
    mocks.isServerFeatureEnabled.mockImplementation(async (flag: string) => flag === "KREILE_CONTRACT_CUSTOMERS");
    const { getCustomersPageCustomers } = await import("../customers.actions");

    const result = await getCustomersPageCustomers();

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data).toEqual([
        expect.objectContaining({ id: "shared-1", name: "Shared" }),
        expect.objectContaining({ id: "contract-1", name: "Contract" }),
      ]);
    }
    expect(mocks.listCustomersContract).toHaveBeenCalledTimes(1);
    expect(mocks.select).not.toHaveBeenCalled();
  });

  it("falls back to legacy when the contract path fails", async () => {
    mocks.isServerFeatureEnabled.mockImplementation(async (flag: string) => flag === "KREILE_CONTRACT_CUSTOMERS");
    mocks.listCustomersContract.mockRejectedValue(new Error("contract down"));
    const { getCustomersPageCustomers } = await import("../customers.actions");

    const result = await getCustomersPageCustomers();

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data).toEqual([
        expect.objectContaining({ id: "legacy-1", name: "Legacy" }),
        expect.objectContaining({ id: "shared-1", name: "Shared" }),
      ]);
    }
    expect(mocks.listCustomersContract).toHaveBeenCalledTimes(1);
    expect(mocks.select).toHaveBeenCalledTimes(1);
  });

  it("runs the shadow diff only behind the dedicated diagnostics flag", async () => {
    mocks.isServerFeatureEnabled.mockImplementation(
      async (flag: string) => flag === "KREILE_SHADOW_CUSTOMERS"
    );
    const { getCustomersPageCustomers } = await import("../customers.actions");

    const result = await getCustomersPageCustomers();

    expect(result.ok).toBe(true);
    expect(mocks.select).toHaveBeenCalledTimes(1);
    expect(mocks.listCustomersContract).toHaveBeenCalledTimes(1);
    expect(mocks.logCustomerShadowDiff).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({ id: "legacy-1", name: "Legacy" }),
      ]),
      expect.arrayContaining([
        expect.objectContaining({ id: "contract-1", name: "Contract" }),
      ])
    );
  });
});
