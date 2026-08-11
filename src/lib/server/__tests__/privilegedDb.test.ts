import { beforeEach, describe, expect, it, vi } from "vitest";

const { transactionSpy, executeSpy } = vi.hoisted(() => ({
  transactionSpy: vi.fn(),
  executeSpy: vi.fn(),
}));

vi.mock("server-only", () => ({}));

vi.mock("@/db", () => ({
  db: {
    transaction: transactionSpy,
  },
}));

vi.mock("drizzle-orm", () => ({
  sql: (parts: TemplateStringsArray, ...values: unknown[]) => ({
    text: parts.join("?"),
    values,
  }),
}));

describe("withPrivilegedTenantTransaction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    transactionSpy.mockImplementation(async (work) => work({ execute: executeSpy }));
    executeSpy.mockResolvedValue([]);
  });

  it("installs the transaction-local tenant before command work", async () => {
    const { withPrivilegedTenantTransaction } = await import("../privilegedDb");
    const work = vi.fn().mockResolvedValue("done");

    await expect(
      withPrivilegedTenantTransaction({ tenantId: "tenant-a" }, work),
    ).resolves.toBe("done");

    expect(transactionSpy).toHaveBeenCalledTimes(1);
    expect(executeSpy).toHaveBeenCalledTimes(1);
    expect(executeSpy.mock.invocationCallOrder[0]).toBeLessThan(
      work.mock.invocationCallOrder[0],
    );
    expect(executeSpy.mock.calls[0][0]).toEqual({
      text: "SELECT set_config('app.tenant_id', ?, true)",
      values: ["tenant-a"],
    });
  });

  it("propagates a work failure through the database transaction callback", async () => {
    const { withPrivilegedTenantTransaction } = await import("../privilegedDb");
    const failure = new Error("post-update item write failed");

    await expect(
      withPrivilegedTenantTransaction({ tenantId: "tenant-a" }, async () => {
        throw failure;
      }),
    ).rejects.toBe(failure);

    expect(transactionSpy).toHaveBeenCalledTimes(1);
    expect(executeSpy).toHaveBeenCalledTimes(1);
  });
});
