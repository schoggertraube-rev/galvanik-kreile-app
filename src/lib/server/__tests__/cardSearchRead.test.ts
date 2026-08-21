import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { withTransactionSpy, executeSpy } = vi.hoisted(() => ({
  withTransactionSpy: vi.fn(),
  executeSpy: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/server/privilegedDb", () => ({
  withPrivilegedTenantTransaction: withTransactionSpy,
}));
vi.mock("drizzle-orm", () => ({
  sql: (parts: TemplateStringsArray, ...values: unknown[]) => ({ text: parts.join("?"), values }),
}));

const authorization = {
  userId: "11111111-1111-4111-8111-111111111111",
  tenantId: "tenant-a",
  displayName: "Werkstatt",
  role: "werkstatt" as const,
  permissions: ["perm_view_leitstand"] as const,
  active: true as const,
};

describe("F1.3 L4 derived card search documents", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    withTransactionSpy.mockImplementation(async (_authorization, work) => work({ execute: executeSpy }));
  });

  it("returns a real empty tenant projection", async () => {
    executeSpy.mockResolvedValueOnce([]);
    const { readCardSearchDocuments } = await import("../cardSearchRead");
    await expect(readCardSearchDocuments(authorization)).resolves.toEqual({ code: "OK", data: [] });
  });

  it("maps filled order and customer documents from the one private view", async () => {
    executeSpy.mockResolvedValueOnce([
      {
        document_type: "CUSTOMER",
        record_id: "customer-1",
        tenant_id: authorization.tenantId,
        title: "Kunde Eins",
        subtitle: "Berlin",
        status: null,
        search_document: "kunde eins berlin",
        integrity_ok: true,
      },
      {
        document_type: "ORDER",
        record_id: "order-1",
        tenant_id: authorization.tenantId,
        title: "A-2026-0001",
        subtitle: "Kunde Eins",
        status: "angenommen",
        search_document: "a-2026-0001 kunde eins stahl notiz",
        integrity_ok: true,
      },
    ]);
    const { readCardSearchDocuments } = await import("../cardSearchRead");
    await expect(readCardSearchDocuments(authorization)).resolves.toEqual({
      code: "OK",
      data: [
        {
          type: "CUSTOMER",
          id: "customer-1",
          title: "Kunde Eins",
          subtitle: "Berlin",
          status: null,
          searchDocument: "kunde eins berlin",
        },
        {
          type: "ORDER",
          id: "order-1",
          title: "A-2026-0001",
          subtitle: "Kunde Eins",
          status: "angenommen",
          searchDocument: "a-2026-0001 kunde eins stahl notiz",
        },
      ],
    });
  });

  it("denies missing permission without opening a database transaction", async () => {
    const { readCardSearchDocuments } = await import("../cardSearchRead");
    await expect(readCardSearchDocuments({ ...authorization, permissions: [] })).resolves.toMatchObject({ code: "FORBIDDEN" });
    expect(withTransactionSpy).not.toHaveBeenCalled();
  });

  it("fails closed for foreign, corrupt, or duplicate records", async () => {
    const { readCardSearchDocuments } = await import("../cardSearchRead");
    const base = {
      document_type: "ORDER",
      record_id: "order-1",
      tenant_id: authorization.tenantId,
      title: "A-2026-0001",
      subtitle: "Kunde Eins",
      status: "angenommen",
      search_document: "a-2026-0001 kunde eins",
      integrity_ok: true,
    };
    for (const rows of [
      [{ ...base, tenant_id: "tenant-b" }],
      [{ ...base, integrity_ok: false }],
      [base, { ...base }],
    ]) {
      executeSpy.mockResolvedValueOnce(rows);
      await expect(readCardSearchDocuments(authorization)).resolves.toMatchObject({ code: "UNAVAILABLE" });
    }
  });

  it("reads cross-module text only through the private v_* contract", async () => {
    const sourcePath = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../cardSearchRead.ts");
    const source = await readFile(sourcePath, "utf8");
    expect(source).toContain("FROM private.v_card_search_documents_v1");
    expect(source).not.toMatch(/FROM public\./);
    expect(source).not.toMatch(/createClient|supabase|rpc\(/i);
  });
});
