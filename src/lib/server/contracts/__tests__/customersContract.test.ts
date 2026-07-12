import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  readAppSession: vi.fn(),
  withTenant: vi.fn(),
  getCustomersDb: vi.fn(),
  execute: vi.fn(),
  info: vi.fn(),
}));

vi.mock("@/lib/server/appSession", () => ({
  readAppSession: mocks.readAppSession,
}));

vi.mock("@/lib/server/db/withTenant", () => ({
  withTenant: mocks.withTenant,
}));

vi.mock("@/app/actions/customers.actions", () => ({
  getCustomersDb: mocks.getCustomersDb,
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
      { id: "cust-1", name: "Kreile GmbH" },
      { id: "cust-2", name: "Muster AG" },
    ]);
    mocks.getCustomersDb.mockResolvedValue({
      ok: true,
      data: [
        { id: "cust-1" },
        { id: "cust-3" },
      ],
    });
  });

  it("liest die View ueber den Session-Mandanten und meldet nur die Shadow-Diff-Zusammenfassung", async () => {
    const infoSpy = vi.spyOn(console, "info").mockImplementation(() => undefined);

    const { list } = await import("../customersContract");
    const result = await list();

    expect(result).toEqual([
      { id: "cust-1", name: "Kreile GmbH" },
      { id: "cust-2", name: "Muster AG" },
    ]);
    expect(mocks.withTenant).toHaveBeenCalledTimes(1);
    expect(mocks.execute).toHaveBeenCalledTimes(1);
    expect(mocks.getCustomersDb).toHaveBeenCalledTimes(1);
    expect(infoSpy).toHaveBeenCalledWith("[customersContract] shadow diff", {
      newCount: 1,
      missingCount: 1,
    });
  });
});
