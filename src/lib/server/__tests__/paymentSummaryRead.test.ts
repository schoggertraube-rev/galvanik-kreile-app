import { KREILE_TENANT_SLUG } from "@/lib/tenant";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { withTransaction, execute } = vi.hoisted(() => ({
  withTransaction: vi.fn(),
  execute: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/server/privilegedDb", () => ({ withPrivilegedTenantTransaction: withTransaction }));
vi.mock("drizzle-orm", () => ({
  sql: (parts: TemplateStringsArray, ...values: unknown[]) => ({ text: parts.join("?"), values }),
}));

const INVOICE = "33333333-3333-4333-8333-333333333333";
const CORRELATION = "55555555-5555-4555-8555-555555555555";

const admin = {
  tenantId: KREILE_TENANT_SLUG,
  userId: "66666666-6666-4666-8666-666666666666",
  displayName: "Administrator",
  role: "admin" as const,
  permissions: ["perm_view_leitstand"] as const,
  active: true as const,
};
const buero = { ...admin, role: "buero" as const };
const werkstatt = { ...admin, role: "werkstatt" as const };
const readonlyUser = { ...admin, role: "readonly" as const };
const developer = { ...admin, role: "developer" as const };

const paidRow = {
  invoice_id: INVOICE,
  tenant_id: KREILE_TENANT_SLUG,
  order_id: "order-2026-0009",
  order_number: "A-2026-0009",
  invoice_number: "R-2026-0009",
  total_amount_cents: 10000,
  payment_contract_version: 1,
  payment_mode: "vorkasse",
  payment_status: "bezahlt",
  payment_open_amount_cents: 0,
  payment_paid_amount_cents: 10000,
  payment_currency: "EUR",
  payment_method: "ueberweisung",
  payment_paid_at: "2026-09-05T08:00:00.000Z",
  payment_receipt_id: "bank-receipt-0009",
  payment_event_id: "payment-event-0009",
  payment_correlation_id: CORRELATION,
  payment_mode_version: 0,
  payment_version: 1,
  goods_out_allowed: true,
  integrity_ok: true,
};

const openRow = {
  ...paidRow,
  payment_mode: "vorkasse",
  payment_status: "offen",
  payment_open_amount_cents: 10000,
  payment_paid_amount_cents: 0,
  payment_method: null,
  payment_paid_at: null,
  payment_receipt_id: null,
  payment_event_id: null,
  payment_correlation_id: null,
  payment_version: 0,
  goods_out_allowed: false,
};

describe("readPaymentSummary", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    withTransaction.mockImplementation(async (_authorization, work) => work({ execute }));
  });

  it("returns the canonical paid summary through the tenant transaction and private view", async () => {
    execute.mockResolvedValueOnce([paidRow]);
    const { readPaymentSummary } = await import("../paymentSummaryRead");

    await expect(readPaymentSummary(admin)).resolves.toEqual({
      code: "OK",
      data: [{
        invoiceId: INVOICE,
        invoiceNumber: "R-2026-0009",
        orderId: "order-2026-0009",
        orderNumber: "A-2026-0009",
        totalAmountCents: 10000,
        paidAmountCents: 10000,
        openAmountCents: 0,
        mode: "vorkasse",
        status: "bezahlt",
        currency: "EUR",
        method: "ueberweisung",
        paidAt: "2026-09-05T08:00:00.000Z",
        receiptId: "bank-receipt-0009",
        eventId: "payment-event-0009",
        correlationId: CORRELATION,
        paymentModeVersion: 0,
        paymentVersion: 1,
        goodsOutAllowed: true,
      }],
    });
    expect(withTransaction).toHaveBeenCalledWith(admin, expect.any(Function));
    expect(execute.mock.calls[0]?.[0].text).toContain("private.v_payment_summary_v1");
  });

  it("preserves a genuine empty result and the invoice payment state", async () => {
    execute.mockResolvedValueOnce([]);
    const { readPaymentSummary } = await import("../paymentSummaryRead");
    await expect(readPaymentSummary(buero)).resolves.toEqual({ code: "OK", data: [] });

    execute.mockResolvedValueOnce([openRow]);
    await expect(readPaymentSummary(werkstatt)).resolves.toMatchObject({
      code: "OK",
      data: [{ status: "offen", mode: "vorkasse", openAmountCents: 10000, goodsOutAllowed: false }],
    });
  });

  it("forbids readonly and developer before any transaction", async () => {
    const { readPaymentSummary } = await import("../paymentSummaryRead");
    await expect(readPaymentSummary(readonlyUser)).resolves.toMatchObject({ code: "FORBIDDEN" });
    await expect(readPaymentSummary(developer)).resolves.toMatchObject({ code: "FORBIDDEN" });
    expect(withTransaction).not.toHaveBeenCalled();
  });

  it("fails closed for a foreign tenant, malformed row, ambiguous list, or read error", async () => {
    const { readPaymentSummary } = await import("../paymentSummaryRead");

    execute.mockResolvedValueOnce([{ ...paidRow, tenant_id: "other-tenant" }]);
    await expect(readPaymentSummary(admin)).resolves.toMatchObject({ code: "UNAVAILABLE" });

    execute.mockResolvedValueOnce([{ ...paidRow, integrity_ok: false }]);
    await expect(readPaymentSummary(admin)).resolves.toMatchObject({ code: "UNAVAILABLE" });

    execute.mockResolvedValueOnce([{ ...paidRow, payment_mode_version: -1 }]);
    await expect(readPaymentSummary(admin)).resolves.toMatchObject({ code: "UNAVAILABLE" });

    execute.mockResolvedValueOnce(Array.from({ length: 251 }, () => paidRow));
    await expect(readPaymentSummary(admin)).resolves.toMatchObject({ code: "UNAVAILABLE" });

    execute.mockRejectedValueOnce(new Error("database unavailable"));
    await expect(readPaymentSummary(admin)).resolves.toEqual({
      code: "UNAVAILABLE",
      message: "Zahlungsübersicht konnte nicht sicher geladen werden.",
    });
  });

  it("rejects an invalid payment date without exposing a partial DTO", async () => {
    execute.mockResolvedValueOnce([{ ...paidRow, payment_paid_at: "not-a-date" }]);
    const { readPaymentSummary } = await import("../paymentSummaryRead");
    await expect(readPaymentSummary(admin)).resolves.toMatchObject({ code: "UNAVAILABLE" });
  });
});
