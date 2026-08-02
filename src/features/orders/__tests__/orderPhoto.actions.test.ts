import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  const eqCalls: Array<[unknown, unknown]> = [];
  const insertedValues: unknown[] = [];
  const selectedRows: unknown[][] = [];
  const updateReturningRows: unknown[][] = [];
  const updateReturning = vi.fn(async () => updateReturningRows.shift() ?? []);
  const updateWhere = vi.fn(() => ({ returning: updateReturning }));
  const updateSet = vi.fn(() => ({ where: updateWhere }));
  const update = vi.fn(() => ({ set: updateSet }));
  const deleteWhere = vi.fn(async () => undefined);
  const deleteRow = vi.fn(() => ({ where: deleteWhere }));
  const insertReturning = vi.fn(async () => [{ id: "upload-1" }]);
  const insertValues = vi.fn((values: unknown) => {
    insertedValues.push(values);
    return { returning: insertReturning };
  });
  const insert = vi.fn(() => ({ values: insertValues }));
  const transaction = vi.fn(async (callback: (tx: unknown) => Promise<void>) =>
    callback({ insert, update }),
  );
  const createSignedUploadUrl = vi.fn(async (path: string) => ({
    data: { path, token: "signed-token", signedUrl: "https://signed.example" },
    error: null,
  }));
  const list = vi.fn();
  const remove = vi.fn();
  const revalidatePath = vi.fn();
  const storageFrom = vi.fn(() => ({ createSignedUploadUrl, list, remove }));
  const createStorageAdmin = vi.fn(() => ({
    storage: { from: storageFrom },
  }));

  return {
    createSignedUploadUrl,
    createStorageAdmin,
    deleteRow,
    eqCalls,
    insertedValues,
    list,
    remove,
    revalidatePath,
    resolveAuthorization: vi.fn(),
    selectedRows,
    transaction,
    updateReturningRows,
    updateSet,
  };
});

vi.mock("@/db", () => ({
  db: {
    delete: mocks.deleteRow,
    insert: vi.fn(() => ({
      values: vi.fn((values: unknown) => {
        mocks.insertedValues.push(values);
        return { returning: vi.fn(async () => [{ id: "upload-1" }]) };
      }),
    })),
    select: vi.fn(() => {
      const query = {
        where: vi.fn(() => query),
        limit: vi.fn(async () => mocks.selectedRows.shift() ?? []),
      };
      return { from: vi.fn(() => query) };
    }),
    transaction: mocks.transaction,
    update: vi.fn(() => ({
      set: vi.fn(() => ({
        where: vi.fn(() => ({
          returning: vi.fn(async () => mocks.updateReturningRows.shift() ?? []),
        })),
      })),
    })),
  },
}));

vi.mock("@/db/schema", () => {
  const table = (name: string) =>
    new Proxy(
      { __table: name },
      {
        get(target, property) {
          if (property === "__table") return target.__table;
          return `${name}.${String(property)}`;
        },
      },
    );

  return {
    events: table("events"),
    orders: table("orders"),
    scanUploads: table("scanUploads"),
  };
});

vi.mock("@/lib/server/authorization", () => ({
  resolveAuthorization: mocks.resolveAuthorization,
}));

vi.mock("@supabase/supabase-js", () => ({
  createClient: mocks.createStorageAdmin,
}));

vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));

vi.mock("drizzle-orm", () => ({
  and: vi.fn((...conditions: unknown[]) => conditions),
  eq: vi.fn((left: unknown, right: unknown) => {
    mocks.eqCalls.push([left, right]);
    return [left, right];
  }),
  inArray: vi.fn((left: unknown, right: unknown) => [left, right]),
  lte: vi.fn((left: unknown, right: unknown) => [left, right]),
}));

const PHOTO_AUTH = {
  ok: true as const,
  data: {
    userId: "00000000-0000-0000-0000-000000000001",
    tenantId: "galvanik-kreile",
    displayName: "Philipp",
    role: "werkstatt" as const,
    permissions: ["perm_op_photos" as const],
    active: true as const,
  },
};

const claimedUpload = {
  id: "upload-1",
  fileUrl: "galvanik-kreile/order-1/photo.jpg",
  fileType: "image/jpeg",
  status: "finalizing",
};

describe("order photo actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.eqCalls.length = 0;
    mocks.insertedValues.length = 0;
    mocks.selectedRows.length = 0;
    mocks.updateReturningRows.length = 0;
    mocks.resolveAuthorization.mockResolvedValue(PHOTO_AUTH);
    mocks.list.mockResolvedValue({
      data: [{
        name: "photo.jpg",
        metadata: { size: 1024, mimetype: "image/jpeg" },
      }],
      error: null,
    });
    mocks.remove.mockResolvedValue({ data: [], error: null });
    process.env.SUPABASE_URL = "https://example.supabase.co";
    process.env.SUPABASE_SERVICE_ROLE_KEY = "service-role-key";
  });

  it("denies readonly before querying an order or signing an upload", async () => {
    mocks.resolveAuthorization.mockResolvedValue({
      ok: true,
      data: {
        ...PHOTO_AUTH.data,
        role: "readonly",
        permissions: ["perm_view_leitstand"],
      },
    });

    const { prepareOrderPhotoUpload } = await import("../orderPhoto.actions");
    const result = await prepareOrderPhotoUpload({
      orderId: "order-1",
      fileType: "image/jpeg",
      fileSize: 1024,
    });

    expect(result).toMatchObject({ success: false });
    expect(mocks.createSignedUploadUrl).not.toHaveBeenCalled();
    expect(mocks.transaction).not.toHaveBeenCalled();
  });

  it("issues a signed token only after a tenant-bound order check", async () => {
    mocks.selectedRows.push([{ id: "order-1" }]);

    const { prepareOrderPhotoUpload } = await import("../orderPhoto.actions");
    const result = await prepareOrderPhotoUpload({
      orderId: "order-1",
      fileType: "image/jpeg",
      fileSize: 1024,
    });

    expect(result).toMatchObject({
      success: true,
      data: { uploadId: "upload-1", token: "signed-token" },
    });
    expect(mocks.eqCalls).toEqual(
      expect.arrayContaining([
        ["orders.id", "order-1"],
        ["orders.tenantId", "galvanik-kreile"],
      ]),
    );
    expect(mocks.createSignedUploadUrl).toHaveBeenCalledWith(
      expect.stringMatching(/^galvanik-kreile\/order-1\/.+\.jpg$/),
      { upsert: false },
    );
    expect(mocks.insertedValues).toContainEqual(
      expect.objectContaining({
        status: "pending_upload",
        uploadedBy: "00000000-0000-0000-0000-000000000001",
      }),
    );
  });

  it("rejects an oversized photo before issuing a signed token", async () => {
    mocks.selectedRows.push([{ id: "order-1" }]);

    const { prepareOrderPhotoUpload } = await import("../orderPhoto.actions");
    const result = await prepareOrderPhotoUpload({
      orderId: "order-1",
      fileType: "image/jpeg",
      fileSize: 10 * 1024 * 1024 + 1,
    });

    expect(result).toMatchObject({ success: false });
    expect(mocks.createSignedUploadUrl).not.toHaveBeenCalled();
  });

  it("atomically completes an actor-bound upload after metadata verification", async () => {
    mocks.selectedRows.push([{ id: "order-1" }]);
    mocks.updateReturningRows.push([claimedUpload], [{ id: "upload-1" }]);

    const { completeOrderPhotoUpload } = await import("../orderPhoto.actions");
    const result = await completeOrderPhotoUpload({
      orderId: "order-1",
      uploadId: "upload-1",
    });

    expect(result).toEqual({ success: true });
    expect(mocks.eqCalls).toEqual(
      expect.arrayContaining([
        ["scanUploads.tenantId", "galvanik-kreile"],
        ["scanUploads.uploadedBy", "00000000-0000-0000-0000-000000000001"],
        ["scanUploads.status", "pending_upload"],
        ["scanUploads.status", "finalizing"],
      ]),
    );
    expect(mocks.list).toHaveBeenCalledWith(
      "galvanik-kreile/order-1",
      { limit: 2, search: "photo.jpg" },
    );
    expect(mocks.insertedValues).toContainEqual(
      expect.objectContaining({ eventType: "PHOTO_ADDED" }),
    );
  });

  it("allows only one completion claim and emits one event", async () => {
    mocks.selectedRows.push([{ id: "order-1" }], [{ id: "order-1" }]);
    mocks.updateReturningRows.push([claimedUpload], [{ id: "upload-1" }], []);

    const { completeOrderPhotoUpload } = await import("../orderPhoto.actions");
    const first = await completeOrderPhotoUpload({ orderId: "order-1", uploadId: "upload-1" });
    const second = await completeOrderPhotoUpload({ orderId: "order-1", uploadId: "upload-1" });

    expect(first).toEqual({ success: true });
    expect(second).toMatchObject({ success: false });
    expect(mocks.insertedValues.filter((value) =>
      (value as { eventType?: string }).eventType === "PHOTO_ADDED",
    )).toHaveLength(1);
  });

  it("does not compensate a committed upload when cache revalidation fails", async () => {
    mocks.selectedRows.push([{ id: "order-1" }]);
    mocks.updateReturningRows.push([claimedUpload], [{ id: "upload-1" }]);
    mocks.revalidatePath.mockImplementationOnce(() => {
      throw new Error("cache unavailable");
    });

    const { completeOrderPhotoUpload } = await import("../orderPhoto.actions");
    const result = await completeOrderPhotoUpload({ orderId: "order-1", uploadId: "upload-1" });

    expect(result).toEqual({ success: true });
    expect(mocks.remove).not.toHaveBeenCalled();
  });

  it("removes a claimed object when its authoritative metadata is invalid", async () => {
    mocks.selectedRows.push([{ id: "order-1" }]);
    mocks.updateReturningRows.push([claimedUpload]);
    mocks.list.mockResolvedValue({
      data: [{
        name: "photo.jpg",
        metadata: { size: 1024, mimetype: "application/octet-stream" },
      }],
      error: null,
    });

    const { completeOrderPhotoUpload } = await import("../orderPhoto.actions");
    const result = await completeOrderPhotoUpload({ orderId: "order-1", uploadId: "upload-1" });

    expect(result).toMatchObject({ success: false });
    expect(mocks.remove).toHaveBeenCalledWith([claimedUpload.fileUrl]);
    expect(mocks.insertedValues).not.toContainEqual(
      expect.objectContaining({ eventType: "PHOTO_ADDED" }),
    );
  });

  it("atomically claims cancellation before removing the object", async () => {
    mocks.selectedRows.push([{ id: "order-1" }]);
    mocks.updateReturningRows.push([{ ...claimedUpload, status: "cancelling" }]);

    const { cancelOrderPhotoUpload } = await import("../orderPhoto.actions");
    const result = await cancelOrderPhotoUpload({
      orderId: "order-1",
      uploadId: "upload-1",
    });

    expect(result).toEqual({ success: true });
    expect(mocks.remove).toHaveBeenCalledWith([claimedUpload.fileUrl]);
    expect(mocks.deleteRow).toHaveBeenCalled();
  });
});
