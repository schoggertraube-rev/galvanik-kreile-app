import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockResolveAuthorization } = vi.hoisted(() => ({
  mockResolveAuthorization: vi.fn(),
}));

vi.mock("@/lib/server/authorization", () => ({ resolveAuthorization: mockResolveAuthorization }));
vi.mock("@/db", () => ({ db: {} }));
vi.mock("@/db/schema", () => ({ items: {}, scanUploads: {} }));
vi.mock("drizzle-orm", () => ({ and: vi.fn(), eq: vi.fn() }));
vi.mock("@supabase/supabase-js", () => ({ createClient: vi.fn() }));
vi.mock("@/lib/ocr/geminiOcr", () => ({ extractDocumentData: vi.fn() }));

import { POST as itemPhotoPost } from "@/app/api/erfassung/item-photo-upload/route";
import { POST as scanPost } from "@/app/api/erfassung/scan-upload/route";

const readonly = {
  userId: "readonly-user",
  tenantId: "galvanik-kreile",
  displayName: "Nur Lesen",
  role: "readonly",
  permissions: ["perm_view_leitstand", "perm_view_customers"],
  active: true,
};

describe("capture route authorization", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockResolveAuthorization.mockResolvedValue({ ok: true, data: readonly });
  });

  it("denies photo upload without perm_op_photos before multipart parsing", async () => {
    const formData = vi.fn();
    const response = await itemPhotoPost({ formData } as unknown as Request);
    expect(response.status).toBe(403);
    expect(formData).not.toHaveBeenCalled();
  });

  it("denies scan capture without perm_data_orders before multipart parsing", async () => {
    const formData = vi.fn();
    const response = await scanPost({ formData } as unknown as Request);
    expect(response.status).toBe(403);
    expect(formData).not.toHaveBeenCalled();
  });
});
