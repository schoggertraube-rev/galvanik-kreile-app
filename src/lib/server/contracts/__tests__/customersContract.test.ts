import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  readAppSession: vi.fn(),
  withTenant: vi.fn(),
  execute: vi.fn(),
}));

vi.mock("@/lib/server/appSession", () => ({
  readAppSession: mocks.readAppSession,
}));

vi.mock("@/lib/server/db/withTenant", () => ({
  withTenant: mocks.withTenant,
}));

describe("customersContract.list", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.readAppSession.mockResolvedValue({
      ok: true,
      session: {
        uid: "user-1",
        role: "admin",
        tenant: "galvanik-kreile",
        initials: "MK",
        exp: Date.now() + 60_000,
      },
    });
    mocks.withTenant.mockImplementation(async (tenantId: string, fn: (tx: { execute: typeof mocks.execute }) => Promise<unknown>) => {
      expect(tenantId).toBe("galvanik-kreile");
      return fn({ execute: mocks.execute });
    });
    mocks.execute.mockResolvedValue([
      {
        id: "cust-2",
        customerNumber: "K-200",
        name: "Muster AG",
        type: "business",
        createdAt: new Date("2026-07-01T10:00:00.000Z"),
        updatedAt: new Date("2026-07-01T10:00:00.000Z"),
      },
      {
        id: "cust-1",
        customerNumber: "K-100",
        name: "Kreile GmbH",
        type: "business",
        createdAt: new Date("2026-07-02T10:00:00.000Z"),
        updatedAt: new Date("2026-07-02T10:00:00.000Z"),
      },
    ]);
  });

  it("liest die View ueber den Session-Mandanten und mappt Customer-Rows", async () => {
    const { list } = await import("../customersContract");
    const result = await list();

    expect(result).toEqual([
      expect.objectContaining({
        id: "cust-1",
        customerNumber: "K-100",
        name: "Kreile GmbH",
      }),
      expect.objectContaining({
        id: "cust-2",
        customerNumber: "K-200",
        name: "Muster AG",
      }),
    ]);
    expect(mocks.withTenant).toHaveBeenCalledTimes(1);
    expect(mocks.execute).toHaveBeenCalledTimes(1);
  });

  it("summarizes only-legacy, only-contract and shared records", async () => {
    const { summarizeCustomerShadowDiff } = await import("../customersContract");

    expect(
      summarizeCustomerShadowDiff(
        [{ id: "cust-1" }, { id: "cust-legacy" }],
        [{ id: "cust-1" }, { id: "cust-contract" }],
      ),
    ).toEqual({
      onlyLegacyCount: 1,
      onlyContractCount: 1,
      sharedCount: 1,
    });
  });
});
