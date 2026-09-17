import { KREILE_TENANT_SLUG } from "@/lib/tenant";
import { beforeEach, describe, expect, it, vi } from "vitest";

const ports = vi.hoisted(() => ({
  confirmPayment: vi.fn(),
  createInvoice: vi.fn(),
  cancelInvoice: vi.fn(),
  readInvoiceCancellationReceipt: vi.fn(),
  readInvoiceCancellationState: vi.fn(),
  readInvoiceReceipt: vi.fn(),
  readInvoiceSummaries: vi.fn(),
  readOrderPaymentState: vi.fn(),
  readPaymentReceipt: vi.fn(),
  readPaymentSummary: vi.fn(),
  revalidatePath: vi.fn(),
  resolveAuthorization: vi.fn(),
  setPaymentMode: vi.fn(),
}));

vi.mock("next/cache", () => ({ revalidatePath: ports.revalidatePath }));
vi.mock("@/lib/server/authorization", () => ({ resolveAuthorization: ports.resolveAuthorization }));
vi.mock("@/lib/server/privilegedDb", () => ({ withPrivilegedTenantTransaction: vi.fn() }));
vi.mock("@/lib/server/commands/confirmPaymentCommand", () => ({ confirmPayment: ports.confirmPayment }));
vi.mock("@/lib/server/commands/immutableInvoiceCommand", () => ({
  createInvoice: ports.createInvoice,
  cancelInvoice: ports.cancelInvoice,
}));
vi.mock("@/lib/server/commands/setPaymentModeCommand", () => ({ setPaymentMode: ports.setPaymentMode }));
vi.mock("@/lib/server/paymentSummaryRead", () => ({
  readOrderPaymentState: ports.readOrderPaymentState,
  readPaymentReceipt: ports.readPaymentReceipt,
  readPaymentSummary: ports.readPaymentSummary,
}));
vi.mock("@/lib/server/invoiceRead", () => ({
  readInvoiceCancellationReceipt: ports.readInvoiceCancellationReceipt,
  readInvoiceCancellationState: ports.readInvoiceCancellationState,
  readInvoiceReceipt: ports.readInvoiceReceipt,
  readInvoiceSummaries: ports.readInvoiceSummaries,
}));

const ACTOR_ID = "11111111-1111-4111-8111-111111111111";
const INVOICE_ID = "22222222-2222-4222-8222-222222222222";
const CLIENT_EVENT_ID = "33333333-3333-4333-8333-333333333333";
const EVENT_ID = "44444444-4444-4444-8444-444444444444";
const CORRELATION_ID = "55555555-5555-4555-8555-555555555555";
const ORDER_ID = "f15-payment-action-order";
const AS_OF = "2026-09-17T08:00:00.000Z";

const confirmInput = {
  invoiceId: INVOICE_ID,
  amount: 1_000,
  method: "ueberweisung" as const,
  expectedVersion: 0,
  clientEventId: CLIENT_EVENT_ID,
};

const modeInput = {
  orderId: ORDER_ID,
  paymentMode: "rechnung" as const,
  expectedVersion: 0,
  clientEventId: "66666666-6666-4666-8666-666666666666",
};

const paymentReceipt = {
  eventId: EVENT_ID,
  invoiceId: INVOICE_ID,
  invoiceNumber: "R-2026-0001",
  orderId: ORDER_ID,
  receiptId: EVENT_ID,
  clientEventId: CLIENT_EVENT_ID,
  correlationId: CORRELATION_ID,
  eventSchemaVersion: 1 as const,
  expectedVersion: 0,
  paymentVersion: 1,
  amountCents: 1_000,
  grossAmountCents: 10_000,
  paidAmountCents: 1_000,
  openAmountCents: 9_000,
  currency: "EUR" as const,
  paymentMode: "rechnung" as const,
  paymentStatus: "teilbezahlt" as const,
  method: "ueberweisung" as const,
  confirmedAt: AS_OF,
  confirmedBy: ACTOR_ID,
  source: "manual" as const,
};

const authorization = {
  ok: true as const,
  data: {
    tenantId: KREILE_TENANT_SLUG,
    userId: ACTOR_ID,
    displayName: "Meister",
    role: "meister" as const,
    permissions: ["perm_view_leitstand"] as const,
    active: true as const,
  },
};

describe("Accounting payment server actions", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    ports.resolveAuthorization.mockResolvedValue(authorization);
    ports.confirmPayment.mockResolvedValue({ code: "OK", receipt: paymentReceipt, replayed: false });
    ports.createInvoice.mockResolvedValue({ code: "UNAVAILABLE", message: "unused" });
    ports.cancelInvoice.mockResolvedValue({ code: "UNAVAILABLE", message: "unused" });
    ports.setPaymentMode.mockResolvedValue({ code: "OK", receipt: {}, replayed: false });
    ports.readPaymentReceipt.mockResolvedValue({ code: "OK", data: paymentReceipt, asOf: AS_OF });
    ports.readPaymentSummary.mockResolvedValue({ code: "OK", data: [], asOf: AS_OF });
    ports.readOrderPaymentState.mockResolvedValue({ code: "OK", data: null });
    ports.readInvoiceReceipt.mockResolvedValue({ code: "OK", data: null, asOf: AS_OF });
    ports.readInvoiceCancellationReceipt.mockResolvedValue({ code: "OK", data: null, asOf: AS_OF });
    ports.readInvoiceCancellationState.mockResolvedValue({ code: "OK", data: null, asOf: AS_OF });
    ports.readInvoiceSummaries.mockResolvedValue({ code: "OK", data: [], asOf: AS_OF });
  });

  it("uses only the accounting server facade and revalidates real consumers only after success", async () => {
    const { confirmPaymentAction, setPaymentModeAction } = await import("../payments.actions");
    await expect(confirmPaymentAction(confirmInput)).resolves.toMatchObject({ code: "OK", receipt: paymentReceipt });
    await setPaymentModeAction(modeInput);

    expect(ports.confirmPayment).toHaveBeenCalledWith(confirmInput);
    expect(ports.setPaymentMode).toHaveBeenCalledWith(modeInput);
    expect(ports.revalidatePath.mock.calls).toEqual([
      ["/buchhaltung/rechnungen"], ["/warendurchlauf"],
      ["/buchhaltung/rechnungen"], ["/warendurchlauf"],
    ]);
  });

  it("does not revalidate failures and uses the receipt read for recovery", async () => {
    ports.confirmPayment.mockResolvedValueOnce({ code: "CONFLICT", message: "stale" });
    ports.setPaymentMode.mockResolvedValueOnce({ code: "FORBIDDEN", message: "denied" });
    const actions = await import("../payments.actions");

    await actions.confirmPaymentAction(confirmInput);
    await actions.setPaymentModeAction(modeInput);
    await expect(actions.getPaymentReceiptAction({
      invoiceId: INVOICE_ID,
      clientEventId: CLIENT_EVENT_ID,
    })).resolves.toMatchObject({ code: "OK", data: paymentReceipt, asOf: AS_OF });
    await expect(actions.recoverPaymentConfirmationAction({
      kind: "payment_confirmed",
      intentId: CLIENT_EVENT_ID,
      idempotencyKey: CLIENT_EVENT_ID,
      aggregateId: INVOICE_ID,
      expectedVersion: 0,
      expectedAmount: { amountCents: 1_000, currency: "EUR" },
      expectedMethod: "bank_transfer",
      expectedReason: null,
    })).resolves.toMatchObject({ state: "resolved", receipt: { invoiceId: INVOICE_ID } });
    expect(ports.readPaymentReceipt).toHaveBeenCalled();

    expect(ports.revalidatePath).not.toHaveBeenCalled();
  });
});
