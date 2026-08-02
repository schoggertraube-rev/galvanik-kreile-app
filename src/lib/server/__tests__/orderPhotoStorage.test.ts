import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  const selectedRows: unknown[][] = [];
  const updateReturningRows: unknown[][] = [];
  const deleteWhere = vi.fn(async () => undefined);
  const remove = vi.fn();

  return {
    deleteWhere,
    remove,
    selectedRows,
    updateReturningRows,
  };
});

vi.mock("@/db", () => ({
  db: {
    delete: vi.fn(() => ({ where: mocks.deleteWhere })),
    select: vi.fn(() => {
      const query = {
        where: vi.fn(() => query),
        limit: vi.fn(async () => mocks.selectedRows.shift() ?? []),
      };
      return { from: vi.fn(() => query) };
    }),
    update: vi.fn(() => ({
      set: vi.fn(() => ({
        where: vi.fn(() => ({
          returning: vi.fn(async () => mocks.updateReturningRows.shift() ?? []),
        })),
      })),
    })),
  },
}));

vi.mock("@/db/schema", () => ({
  scanUploads: new Proxy(
    { __table: "scanUploads" },
    {
      get(target, property) {
        if (property === "__table") return target.__table;
        return `scanUploads.${String(property)}`;
      },
    },
  ),
}));

vi.mock("@supabase/supabase-js", () => ({
  createClient: vi.fn(() => ({
    storage: {
      from: vi.fn(() => ({ remove: mocks.remove })),
    },
  })),
}));

vi.mock("drizzle-orm", () => ({
  and: vi.fn((...conditions: unknown[]) => conditions),
  eq: vi.fn((left: unknown, right: unknown) => [left, right]),
  inArray: vi.fn((left: unknown, right: unknown) => [left, right]),
  lte: vi.fn((left: unknown, right: unknown) => [left, right]),
  or: vi.fn((...conditions: unknown[]) => conditions),
}));

describe("expired order photo cleanup", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.selectedRows.length = 0;
    mocks.updateReturningRows.length = 0;
    mocks.remove.mockResolvedValue({ data: [], error: null });
    process.env.SUPABASE_URL = "https://example.supabase.co";
    process.env.SUPABASE_SERVICE_ROLE_KEY = "service-role-key";
  });

  it("claims and removes a stale pending object and row", async () => {
    const candidate = {
      id: "upload-1",
      fileUrl: "galvanik-kreile/order-1/photo.jpg",
      status: "pending_upload",
      claimToken: null,
    };
    mocks.selectedRows.push([candidate]);
    mocks.updateReturningRows.push([{ ...candidate, claimToken: "claim-1" }]);

    const { cleanupExpiredOrderPhotoUploads } = await import("../orderPhotoStorage");
    const result = await cleanupExpiredOrderPhotoUploads(new Date("2026-08-02T12:00:00Z"));

    expect(result).toEqual({ cleaned: 1, failed: 0 });
    expect(mocks.remove).toHaveBeenCalledWith([candidate.fileUrl]);
    expect(mocks.deleteWhere).toHaveBeenCalledOnce();
  });

  it("does nothing when another state transition wins the cleanup claim", async () => {
    mocks.selectedRows.push([{
      id: "upload-1",
      fileUrl: "galvanik-kreile/order-1/photo.jpg",
      status: "pending_upload",
      claimToken: null,
    }]);
    mocks.updateReturningRows.push([]);

    const { cleanupExpiredOrderPhotoUploads } = await import("../orderPhotoStorage");
    const result = await cleanupExpiredOrderPhotoUploads(new Date("2026-08-02T12:00:00Z"));

    expect(result).toEqual({ cleaned: 0, failed: 0 });
    expect(mocks.remove).not.toHaveBeenCalled();
    expect(mocks.deleteWhere).not.toHaveBeenCalled();
  });

  it("cannot re-claim an unexpired cleanup lease", async () => {
    mocks.selectedRows.push([{
      id: "upload-1",
      fileUrl: "galvanik-kreile/order-1/photo.jpg",
      status: "cleanup_claimed",
      claimToken: "existing-claim",
    }]);
    mocks.updateReturningRows.push([]);

    const { cleanupExpiredOrderPhotoUploads } = await import("../orderPhotoStorage");
    const result = await cleanupExpiredOrderPhotoUploads(new Date("2026-08-02T12:00:00Z"));

    expect(result).toEqual({ cleaned: 0, failed: 0 });
    expect(mocks.remove).not.toHaveBeenCalled();
    expect(mocks.deleteWhere).not.toHaveBeenCalled();
  });
});
