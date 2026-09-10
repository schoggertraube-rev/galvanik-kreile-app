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

const orderPaidRow = {
  ...paidRow,
  order_version: 4,
  station: "fertig",
  current_station: "fertig",
  current_station_id: "fertig",
  order_status: "fertig",
  invoice_state: "issued",
  active_invoice_count: 1,
  payment_goods_out_allowed: true,
  payment_integrity_ok: true,
  payment_actor_id: admin.userId,
  goods_out_event_count: 0,
  goods_out_event_id: null,
  goods_out_client_event_id: null,
  goods_out_correlation_id: null,
  goods_out_event_schema_version: null,
  goods_out_order_version: null,
  goods_out_actor_id: null,
  goods_out_occurred_at: null,
  goods_out_mode: null,
};

const orderWithoutInvoiceRow = {
  ...orderPaidRow,
  payment_mode: "rechnung",
  invoice_state: "not_issued",
  active_invoice_count: 0,
  invoice_id: null,
  invoice_number: null,
  total_amount_cents: null,
  payment_contract_version: null,
  payment_status: null,
  payment_open_amount_cents: null,
  payment_paid_amount_cents: null,
  payment_currency: null,
  payment_method: null,
  payment_paid_at: null,
  payment_receipt_id: null,
  payment_event_id: null,
  payment_correlation_id: null,
  payment_version: null,
  payment_goods_out_allowed: null,
  payment_integrity_ok: null,
  payment_actor_id: null,
  goods_out_allowed: true,
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

  it("reads one order-bound paid state through the dedicated UI view", async () => {
    execute.mockResolvedValueOnce([orderPaidRow]);
    const { readOrderPaymentState } = await import("../paymentSummaryRead");
    await expect(readOrderPaymentState(admin, { orderId: paidRow.order_id })).resolves.toMatchObject({
      code: "OK",
      data: {
        orderId: paidRow.order_id,
        orderVersion: 4,
        physicalStatus: "fertig",
        mode: "vorkasse",
        invoiceState: "issued",
        payment: { status: "bezahlt", openAmountCents: 0, eventId: paidRow.payment_event_id },
        paymentActorId: admin.userId,
        goodsOut: null,
        goodsOutAllowed: true,
      },
    });
    expect(execute.mock.calls[0]?.[0].text).toContain("private.v_goods_out_ui_state_v1");
    expect(execute.mock.calls[0]?.[0].values).toEqual([paidRow.order_id]);
  });

  it("returns Rechnung without an invoice and without inventing payment values", async () => {
    execute.mockResolvedValueOnce([orderWithoutInvoiceRow]);
    const { readOrderPaymentState } = await import("../paymentSummaryRead");
    await expect(readOrderPaymentState(werkstatt, { orderId: paidRow.order_id })).resolves.toEqual({
      code: "OK",
      data: {
        orderId: paidRow.order_id,
        orderNumber: paidRow.order_number,
        orderVersion: 4,
        physicalStatus: "fertig",
        mode: "rechnung",
        paymentModeVersion: 0,
        invoiceState: "not_issued",
        payment: null,
        paymentActorId: null,
        goodsOut: null,
        goodsOutAllowed: true,
      },
    });
  });

  it("fails closed for invalid input, denial, missing, ambiguous or corrupt order state", async () => {
    const { readOrderPaymentState } = await import("../paymentSummaryRead");
    await expect(readOrderPaymentState(admin, { orderId: " bad " })).resolves.toMatchObject({ code: "VALIDATION_ERROR" });
    await expect(readOrderPaymentState(readonlyUser, { orderId: paidRow.order_id })).resolves.toMatchObject({ code: "FORBIDDEN" });
    expect(withTransaction).not.toHaveBeenCalled();

    execute.mockResolvedValueOnce([]);
    await expect(readOrderPaymentState(admin, { orderId: paidRow.order_id })).resolves.toMatchObject({ code: "NOT_FOUND" });
    execute.mockResolvedValueOnce([orderPaidRow, orderPaidRow]);
    await expect(readOrderPaymentState(admin, { orderId: paidRow.order_id })).resolves.toMatchObject({ code: "UNAVAILABLE" });
    execute.mockResolvedValueOnce([{ ...orderPaidRow, integrity_ok: false }]);
    await expect(readOrderPaymentState(admin, { orderId: paidRow.order_id })).resolves.toMatchObject({ code: "UNAVAILABLE" });
  });

  it("logs available database diagnostics while returning only a generic error", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => undefined);
    execute.mockRejectedValueOnce({ message: "relation failed", details: "internal detail", hint: "retry later" });
    const { readOrderPaymentState } = await import("../paymentSummaryRead");
    const result = await readOrderPaymentState(admin, { orderId: paidRow.order_id });
    expect(log).toHaveBeenCalledWith("readOrderPaymentState database error", {
      message: "relation failed",
      details: "internal detail",
      hint: "retry later",
    });
    expect(result).toEqual({ code: "UNAVAILABLE", message: "Zahlungs- und Warenausgangsdaten konnten nicht sicher geladen werden." });
    expect(JSON.stringify(result)).not.toContain("internal detail");
    log.mockRestore();
  });
});
