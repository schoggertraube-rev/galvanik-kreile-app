import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockResolveAuthorization, mockProxy } = vi.hoisted(() => ({
  mockResolveAuthorization: vi.fn(),
  mockProxy: vi.fn(),
}));

vi.mock("@/lib/server/authorization", () => ({ resolveAuthorization: mockResolveAuthorization }));
vi.mock("@/lib/server/aiUsage", () => ({ proxyMeteredAiRequest: mockProxy }));

import { POST as customerPost } from "@/app/api/erfassung/customer-enrich/route";
import { POST as freetextPost } from "@/app/api/erfassung/freetext-extract/route";
import { POST as inquiryPost } from "@/app/api/erfassung/inquiry-extract/route";
import { POST as notesPost } from "@/app/api/erfassung/notes-extract/route";

const baseUser = {
  userId: "user-42",
  tenantId: "galvanik-kreile",
  displayName: "Mitarbeiter",
  role: "mitarbeiter",
  permissions: [] as string[],
  active: true,
};

describe("AI proxy authorization boundaries", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockProxy.mockResolvedValue(Response.json({ ok: true }));
  });

  it("denies readonly before body parsing or delegation", async () => {
    mockResolveAuthorization.mockResolvedValue({ ok: true, data: { ...baseUser, role: "readonly" } });
    for (const post of [customerPost, freetextPost, inquiryPost, notesPost]) {
      const json = vi.fn(() => {
        throw new Error("must not parse");
      });
      const response = await post({ json } as unknown as Request);
      expect(response.status).toBe(403);
      expect(json).not.toHaveBeenCalled();
    }
    expect(mockProxy).not.toHaveBeenCalled();
  });

  it("requires the feature-specific permission and keeps entitled paths operational", async () => {
    mockResolveAuthorization
      .mockResolvedValueOnce({ ok: true, data: { ...baseUser, permissions: ["perm_data_customers"] } })
      .mockResolvedValue({ ok: true, data: { ...baseUser, permissions: ["perm_data_orders"] } });

    expect((await customerPost(new Request("http://localhost", { method: "POST", body: JSON.stringify({ company_name: "Kreile" }) }))).status).toBe(200);
    expect((await freetextPost(new Request("http://localhost", { method: "POST", body: JSON.stringify({ text: "Auftrag" }) }))).status).toBe(200);
    expect((await inquiryPost(new Request("http://localhost", { method: "POST", body: JSON.stringify({ text: "Anfrage" }) }))).status).toBe(200);
    expect((await notesPost(new Request("http://localhost", { method: "POST", body: JSON.stringify({ text: "Rückruf" }) }))).status).toBe(200);
    expect(mockProxy).toHaveBeenCalledTimes(4);
  });

  it("rejects oversized or schema-expanded input before reservation", async () => {
    mockResolveAuthorization.mockResolvedValue({ ok: true, data: { ...baseUser, permissions: ["perm_data_orders"] } });
    const oversized = await notesPost(new Request("http://localhost", {
      method: "POST",
      body: JSON.stringify({ text: "x".repeat(12_001) }),
    }));
    const expanded = await inquiryPost(new Request("http://localhost", {
      method: "POST",
      body: JSON.stringify({ text: "Anfrage", userId: "admin" }),
    }));
    expect(oversized.status).toBe(400);
    expect(expanded.status).toBe(400);
    expect(mockProxy).not.toHaveBeenCalled();
  });
});
