import { describe, expect, it, vi, beforeEach } from "vitest";
import { withTenant } from "../withTenant";
import { db } from "@/db";

const mocks = vi.hoisted(() => ({
  transaction: vi.fn(),
  execute: vi.fn(),
  sql: vi.fn((strings: TemplateStringsArray, ...values: unknown[]) => ({
    strings: Array.from(strings),
    values,
  })),
}));

vi.mock("@/db", () => ({
  db: {
    transaction: mocks.transaction,
  },
}));

vi.mock("drizzle-orm", () => ({
  sql: mocks.sql,
}));

describe("withTenant", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.transaction.mockImplementation(async (callback: (tx: { execute: typeof mocks.execute }) => Promise<string>) => {
      return callback({ execute: mocks.execute });
    });
    mocks.execute.mockResolvedValue(undefined);
  });

  it("setzt app.tenant_id in der Transaktion und gibt das Callback-Ergebnis zurueck", async () => {
    const result = await withTenant("tenant-a", async () => "ok");

    expect(result).toBe("ok");
    expect(mocks.transaction).toHaveBeenCalledTimes(1);
    expect(mocks.execute).toHaveBeenCalledTimes(1);
    expect(mocks.execute).toHaveBeenCalledWith(
      expect.objectContaining({
        strings: ["select set_config('app.tenant_id', ", ", true)"],
        values: ["tenant-a"],
      }),
    );
  });

  it("wirft fuer leeren Tenant fail-closed", async () => {
    const fn = vi.fn();

    await expect(withTenant("   ", fn)).rejects.toThrow("TENANT_ID_REQUIRED");
    expect(fn).not.toHaveBeenCalled();
    expect(mocks.transaction).not.toHaveBeenCalled();
  });
});
