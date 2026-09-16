import { beforeEach, describe, expect, it, vi } from "vitest";

const { execute, withTransaction } = vi.hoisted(() => ({ execute: vi.fn(), withTransaction: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/server/privilegedDb", () => ({ withPrivilegedTenantTransaction: withTransaction }));
vi.mock("drizzle-orm", () => ({ sql: (parts: TemplateStringsArray, ...values: unknown[]) => ({ text: parts.join("?"), values }) }));

const authorization = {
  tenantId: "tenant-quote-read",
  userId: "11111111-1111-4111-8111-111111111111",
  capabilities: { canCreateQuote: false, canReadQuote: true, canUpdateQuote: false, canConvertQuote: false },
};
const row = {
  quote_id: "44444444-4444-4444-8444-444444444444", tenant_id: authorization.tenantId, quote_number: "KV-2026-0042",
  customer_id: "33333333-3333-4333-8333-333333333333", customer_number: "K-2026-0041", customer_display_name: "Synthetischer Kunde",
  status: "draft", version: 3, currency: "EUR", due_date: "2026-10-15", note: "Notiz", total_net_cents: 25000,
  linked_order_id: null, created_by: authorization.userId, actor_display_name: "Synthetische Person",
  created_at: "2026-09-16T10:00:00.000Z", updated_at: "2026-09-16T10:01:00.000Z", converted_at: null,
  positions: [{ id: "88888888-8888-4888-8888-888888888888", position: 1, name: "Flansch", quantity: 2, material: "Stahl", surfaceRequested: "Verzinken", unitPriceCents: 12500, lineTotalCents: 25000 }], integrity_ok: true,
};

describe("quote read ports", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    withTransaction.mockImplementation(async (_authorization, work) => work({ execute }));
  });

  it("lists only validated open quote readbacks", async () => {
    execute.mockResolvedValue([row]);
    const { listOpenQuotesCommand } = await import("../server/quoteReads");
    await expect(listOpenQuotesCommand(authorization)).resolves.toMatchObject({ code: "OK", quotes: [{ quoteId: row.quote_id, version: 3 }] });
    expect(execute.mock.calls[0]?.[0].text).toContain("private.v_open_quotes_v1");
  });

  it("fails closed for denied or invalid list rows", async () => {
    const { listOpenQuotesCommand } = await import("../server/quoteReads");
    await expect(listOpenQuotesCommand({ ...authorization, capabilities: { ...authorization.capabilities, canReadQuote: false } })).resolves.toMatchObject({ code: "FORBIDDEN" });
    execute.mockResolvedValue([{ ...row, integrity_ok: false }]);
    await expect(listOpenQuotesCommand(authorization)).resolves.toMatchObject({ code: "UNAVAILABLE" });
  });
});
