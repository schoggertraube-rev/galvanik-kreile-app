import { createHash } from "node:crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { execute, withTransaction } = vi.hoisted(() => ({ execute: vi.fn(), withTransaction: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/server/privilegedDb", () => ({ withPrivilegedTenantTransaction: withTransaction }));
vi.mock("drizzle-orm", () => ({ sql: (parts: TemplateStringsArray, ...values: unknown[]) => ({ text: parts.join("?"), values }) }));

const TENANT = "tenant-quote-command";
const ACTOR = "11111111-1111-4111-8111-111111111111";
const CLIENT = "22222222-2222-4222-8222-222222222222";
const CUSTOMER = "33333333-3333-4333-8333-333333333333";
const QUOTE = "44444444-4444-4444-8444-444444444444";
const RECEIPT = "55555555-5555-4555-8555-555555555555";
const EVENT = "66666666-6666-4666-8666-666666666666";
const CORRELATION = "77777777-7777-4777-8777-777777777777";
const input = {
  clientEventId: CLIENT,
  customerId: CUSTOMER,
  dueDate: "2026-10-15",
  note: "Synthetischer KV",
  positions: [{ name: "Flansch", quantity: 2, material: "Stahl", surfaceRequested: "Verzinken", unitPriceCents: 12500 }],
};
const intent = createHash("sha256").update(JSON.stringify(input), "utf8").digest("hex");
const authorization = { tenantId: TENANT, userId: ACTOR, permissions: ["perm_data_orders", "perm_view_leitstand"] };
const quoteRow = {
  quote_id: QUOTE, tenant_id: TENANT, quote_number: "KV-2026-0042", customer_id: CUSTOMER,
  customer_number: "K-2026-0041", customer_display_name: "Synthetischer Kunde", status: "draft",
  version: 1, currency: "EUR", due_date: input.dueDate, note: input.note, total_net_cents: "25000",
  linked_order_id: null, created_by: ACTOR, actor_display_name: "Test Büro",
  created_at: "2026-09-14T10:00:00.000Z", converted_at: null,
  positions: [{ id: "88888888-8888-4888-8888-888888888888", position: 1, name: "Flansch", quantity: 2, material: "Stahl", surfaceRequested: "Verzinken", unitPriceCents: 12500, lineTotalCents: 25000 }],
  integrity_ok: true,
};

describe("quotes command boundary", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    withTransaction.mockImplementation(async (_authorization, work) => work({ execute }));
  });

  it("validates exact input and permission before database access", async () => {
    const { createQuoteCommand } = await import("../server/quoteCommands");
    await expect(createQuoteCommand(authorization, { ...input, tenantId: TENANT })).resolves.toMatchObject({ code: "VALIDATION_ERROR" });
    await expect(createQuoteCommand(authorization, { ...input, positions: [] })).resolves.toMatchObject({ code: "VALIDATION_ERROR" });
    await expect(createQuoteCommand({ ...authorization, permissions: ["perm_view_leitstand"] }, input)).resolves.toMatchObject({ code: "FORBIDDEN" });
    expect(withTransaction).not.toHaveBeenCalled();
  });

  it("returns success only after canonical quote and immutable receipt readback", async () => {
    execute.mockImplementation((query: { text: string }) => {
      if (query.text.includes("private.create_quote_v1")) return Promise.resolve([{ result_code: "OK", result_quote_id: QUOTE, replayed: false }]);
      if (query.text.includes("private.v_quotes_v1")) return Promise.resolve([quoteRow]);
      if (query.text.includes("private.v_quote_create_receipts_v1")) return Promise.resolve([{
        receipt_id: RECEIPT, event_id: EVENT, tenant_id: TENANT, quote_id: QUOTE, customer_id: CUSTOMER,
        actor_id: ACTOR, client_event_id: CLIENT, correlation_id: CORRELATION, intent_sha256: intent,
        recorded_at: "2026-09-14T10:00:01.000Z", integrity_ok: true,
      }]);
      throw new Error(`unexpected SQL: ${query.text}`);
    });
    const { createQuoteCommand } = await import("../server/quoteCommands");
    await expect(createQuoteCommand(authorization, input)).resolves.toMatchObject({
      code: "OK", replayed: false,
      quote: { quoteId: QUOTE, totalNetCents: 25000, status: "draft", version: 1 },
      receipt: { receiptId: RECEIPT, eventId: EVENT, aggregateVersion: 1 },
    });
  });

  it("keeps stale version and intent conflicts fail-closed", async () => {
    execute.mockResolvedValueOnce([{ result_code: "CONFLICT", order_input: null, replayed: false }]);
    const { prepareQuoteConversionCommand } = await import("../server/quoteCommands");
    await expect(prepareQuoteConversionCommand(authorization, {
      quoteId: QUOTE, clientEventId: CLIENT, expectedVersion: 2, confirmedAward: true,
    })).resolves.toMatchObject({ code: "CONFLICT" });
  });

  it("does not turn corrupt tenant or integrity readback into success or not-found", async () => {
    execute.mockResolvedValueOnce([{ ...quoteRow, integrity_ok: false }]);
    const { readQuoteCommand } = await import("../server/quoteCommands");
    await expect(readQuoteCommand(authorization, { quoteId: QUOTE })).resolves.toMatchObject({ code: "UNAVAILABLE" });
  });
});
