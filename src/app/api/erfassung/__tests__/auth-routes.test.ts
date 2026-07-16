import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockResolveAuthorization, mockFetch } = vi.hoisted(() => ({
  mockResolveAuthorization: vi.fn(),
  mockFetch: vi.fn(),
}));

vi.mock("@/lib/server/authorization", () => ({ resolveAuthorization: mockResolveAuthorization }));
vi.mock("@/db", () => ({ db: {} }));
vi.mock("@/db/schema", () => ({
  customers: {},
  orders: {},
  scanUploads: {},
  items: {},
}));
vi.mock("drizzle-orm", () => ({
  and: vi.fn(),
  eq: vi.fn(),
  ilike: vi.fn(),
  or: vi.fn(),
  sql: Object.assign(vi.fn(), { raw: vi.fn() }),
}));
vi.mock("@supabase/supabase-js", () => ({ createClient: vi.fn() }));
vi.mock("@/lib/ocr/geminiOcr", () => ({ extractDocumentData: vi.fn() }));

describe("erfassung route authorization boundary", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockResolveAuthorization.mockResolvedValue({
      ok: false,
      reason: "NO_SESSION",
      message: "Unauthorized",
    });
    vi.stubGlobal("fetch", mockFetch);
  });

  it("rejects every POST route before body parsing or external calls", async () => {
    const modules = await Promise.all([
      import("@/app/api/erfassung/customer-enrich/route"),
      import("@/app/api/erfassung/freetext-extract/route"),
      import("@/app/api/erfassung/inquiry-extract/route"),
      import("@/app/api/erfassung/notes-extract/route"),
      import("@/app/api/erfassung/item-photo-upload/route"),
      import("@/app/api/erfassung/scan-upload/route"),
    ]);
    for (const route of modules) {
      const response = await route.POST(new Request("http://localhost/api", { method: "POST" }));
      expect(response.status).toBe(401);
    }
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("rejects customer search and scan status before database access", async () => {
    const search = await import("@/app/api/erfassung/customer-search/route");
    const status = await import("@/app/api/erfassung/scan-status/[id]/route");
    expect((await search.GET(new Request("http://localhost/api?q=Ma"))).status).toBe(401);
    expect((await status.GET(new Request("http://localhost/api"), {
      params: Promise.resolve({ id: "foreign" }),
    })).status).toBe(401);
  });
});
