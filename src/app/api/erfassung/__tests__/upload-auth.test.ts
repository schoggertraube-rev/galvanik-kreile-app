import { beforeEach, describe, expect, it, vi } from "vitest";

// Negative authorization tests for B4 (OCR/photo upload routes).
// Prove fail-closed: an unauthorized caller gets 401 and never reaches storage.

const mockCheckAppAuthorization = vi.fn();
const mockUpload = vi.fn();
const mockCreateSignedUrl = vi.fn();

vi.mock("@supabase/supabase-js", () => ({
  createClient: vi.fn(() => ({
    storage: {
      from: vi.fn(() => ({
        upload: mockUpload,
        createSignedUrl: mockCreateSignedUrl,
      })),
    },
  })),
}));

vi.mock("@/lib/server/authHelper", () => ({
  checkAppAuthorization: mockCheckAppAuthorization,
}));

vi.mock("@/db", () => ({ db: { insert: vi.fn(), select: vi.fn(), update: vi.fn() } }));
vi.mock("@/db/schema", () => ({ scanUploads: { id: "scan_uploads.id" } }));
vi.mock("drizzle-orm", () => ({ eq: vi.fn((c: unknown, v: unknown) => ({ c, v })) }));
vi.mock("@/lib/ocr/geminiOcr", () => ({ extractDocumentData: vi.fn() }));

const unauthorized = { ok: false as const, error: "UNAUTHORIZED", message: "Nicht angemeldet" };

function postRequest(url: string) {
  return new Request(url, { method: "POST" });
}

describe("erfassung upload routes — fail-closed authorization", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCheckAppAuthorization.mockResolvedValue(unauthorized);
  });

  it("scan-upload returns 401 and never touches storage without a write role", async () => {
    const { POST } = await import("@/app/api/erfassung/scan-upload/route");

    const res = await POST(postRequest("http://test/api/erfassung/scan-upload"));

    expect(res.status).toBe(401);
    await expect(res.json()).resolves.toEqual({ error: "UNAUTHORIZED" });
    expect(mockCheckAppAuthorization).toHaveBeenCalledWith("write");
    expect(mockUpload).not.toHaveBeenCalled();
  });

  it("item-photo-upload returns 401 and never touches storage without a write role", async () => {
    const { POST } = await import("@/app/api/erfassung/item-photo-upload/route");

    const res = await POST(postRequest("http://test/api/erfassung/item-photo-upload"));

    expect(res.status).toBe(401);
    await expect(res.json()).resolves.toEqual({ error: "UNAUTHORIZED" });
    expect(mockCheckAppAuthorization).toHaveBeenCalledWith("write");
    expect(mockUpload).not.toHaveBeenCalled();
  });
});
