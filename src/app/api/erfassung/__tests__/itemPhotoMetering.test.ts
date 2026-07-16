import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const {
  mockResolveAuthorization,
  mockDbSelect,
  mockCreateClient,
  mockStorageFrom,
  mockUpload,
  mockSignedUrl,
  mockReserve,
  mockValidate,
  mockBind,
  mockMark,
  mockFetch,
} = vi.hoisted(() => ({
  mockResolveAuthorization: vi.fn(),
  mockDbSelect: vi.fn(),
  mockCreateClient: vi.fn(),
  mockStorageFrom: vi.fn(),
  mockUpload: vi.fn(),
  mockSignedUrl: vi.fn(),
  mockReserve: vi.fn(),
  mockValidate: vi.fn(),
  mockBind: vi.fn(),
  mockMark: vi.fn(),
  mockFetch: vi.fn(),
}));

vi.mock("@/lib/server/authorization", () => ({ resolveAuthorization: mockResolveAuthorization }));
vi.mock("@/db", () => ({ db: { select: mockDbSelect } }));
vi.mock("@/db/schema", () => ({ items: { id: "id", orderId: "order", tenantId: "tenant" } }));
vi.mock("drizzle-orm", () => ({ and: vi.fn(), eq: vi.fn() }));
vi.mock("@supabase/supabase-js", () => ({ createClient: mockCreateClient }));
vi.mock("@/lib/server/itemPhotoJobs", () => ({
  reserveItemPhotoJob: mockReserve,
  validateItemPhoto: mockValidate,
  bindItemPhotoUpload: mockBind,
  markItemPhotoUncertain: mockMark,
}));

import { POST } from "@/app/api/erfassung/item-photo-upload/route";

const authorized = {
  userId: "user-42",
  tenantId: "galvanik-kreile",
  displayName: "Werkstatt",
  role: "werkstatt",
  permissions: ["perm_op_photos"],
  active: true,
};
const jobId = "123e4567-e89b-42d3-a456-426614174000";
const storagePath = `galvanik-kreile/order-42/item-42/${jobId}.jpg`;

function request() {
  const body = new FormData();
  body.set("file", new File([new Uint8Array(12)], "photo.jpg", { type: "image/jpeg" }));
  body.set("itemId", "item-42");
  return {
    headers: new Headers(),
    formData: vi.fn(async () => body),
  } as unknown as Request;
}

describe("item photo durable metering boundary", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("SUPABASE_URL", "https://tenant.supabase.co");
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "service-role-key");
    vi.stubGlobal("fetch", mockFetch);
    mockResolveAuthorization.mockResolvedValue({ ok: true, data: authorized });
    mockDbSelect.mockReturnValue({
      from: vi.fn(() => ({
        where: vi.fn(() => ({ limit: vi.fn(async () => [{ id: "item-42", orderId: "order-42" }]) })),
      })),
    });
    mockValidate.mockResolvedValue({
      bytes: new Uint8Array([0xff, 0xd8, 0xff, ...Array(9).fill(0)]),
      mimeType: "image/jpeg",
      extension: "jpg",
      contentSha256: "a".repeat(64),
    });
    mockStorageFrom.mockReturnValue({ upload: mockUpload, createSignedUrl: mockSignedUrl });
    mockCreateClient.mockReturnValue({ storage: { from: mockStorageFrom } });
    mockUpload.mockResolvedValue({ data: { path: storagePath }, error: null });
    mockSignedUrl.mockResolvedValue({ data: { signedUrl: "https://signed.test/photo" }, error: null });
    mockBind.mockResolvedValue(undefined);
    mockFetch.mockResolvedValue(new Response(JSON.stringify({ material: "Stahl", schaeden: null, masse: null, confidence: 0.9 }), { status: 200 }));
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("rejects quota before storage and provider work", async () => {
    mockReserve.mockResolvedValue({ kind: "rejected", retryAfterSeconds: 60, terminal: false });
    const response = await POST(request());
    expect(response.status).toBe(429);
    expect(mockUpload).not.toHaveBeenCalled();
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("uploads once, binds accounting, and sends only the opaque job ID", async () => {
    mockReserve.mockResolvedValue({ kind: "accepted", jobId, storagePath, uploadRequired: true });
    const response = await POST(request());
    expect(response.status).toBe(200);
    expect(mockUpload).toHaveBeenCalledTimes(1);
    expect(mockBind).toHaveBeenCalledWith(expect.anything(), jobId, "galvanik-kreile", "user-42");
    const init = mockFetch.mock.calls[0][1] as RequestInit;
    expect(JSON.parse(String(init.body))).toEqual({ jobId });
  });

  it("replays settled analysis without storage or provider work", async () => {
    mockReserve.mockResolvedValue({
      kind: "replay",
      jobId,
      storagePath,
      result: { material: "Stahl", confidence: 0.9 },
    });
    const response = await POST(request());
    expect(response.status).toBe(200);
    expect(response.headers.get("X-Item-Photo-Replay")).toBe("1");
    expect(mockUpload).not.toHaveBeenCalled();
    expect(mockFetch).not.toHaveBeenCalled();
  });
});
