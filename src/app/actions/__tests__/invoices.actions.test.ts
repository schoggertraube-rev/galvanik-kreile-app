import { KREILE_TENANT_SLUG } from "@/lib/tenant";
import { beforeEach, describe, expect, it, vi } from "vitest";

const ports = vi.hoisted(() => ({
  revalidatePath: vi.fn(),
  resolveAuthorization: vi.fn(),
  createInvoice: vi.fn(),
  cancelInvoice: vi.fn(),
  confirmPayment: vi.fn(),
  setPaymentMode: vi.fn(),
  readInvoiceReceipt: vi.fn(),
  readInvoiceCancellationReceipt: vi.fn(),
  readInvoiceCancellationState: vi.fn(),
  readInvoiceSummaries: vi.fn(),
  readOrderPaymentState: vi.fn(),
  readPaymentReceipt: vi.fn(),
  readPaymentSummary: vi.fn(),
}));

vi.mock("next/cache", () => ({ revalidatePath: ports.revalidatePath }));
vi.mock("@/lib/server/authorization", () => ({ resolveAuthorization: ports.resolveAuthorization }));
vi.mock("@/lib/server/privilegedDb", () => ({ withPrivilegedTenantTransaction: vi.fn() }));
vi.mock("@/lib/server/commands/immutableInvoiceCommand", () => ({
  createInvoice: ports.createInvoice,
  cancelInvoice: ports.cancelInvoice,
}));
vi.mock("@/lib/server/commands/confirmPaymentCommand", () => ({
  confirmPayment: ports.confirmPayment,
}));
vi.mock("@/lib/server/commands/setPaymentModeCommand", () => ({
  setPaymentMode: ports.setPaymentMode,
}));
vi.mock("@/lib/server/invoiceRead", () => ({
  readInvoiceReceipt: ports.readInvoiceReceipt,
  readInvoiceCancellationReceipt: ports.readInvoiceCancellationReceipt,
  readInvoiceCancellationState: ports.readInvoiceCancellationState,
  readInvoiceSummaries: ports.readInvoiceSummaries,
}));
vi.mock("@/lib/server/paymentSummaryRead", () => ({
  readOrderPaymentState: ports.readOrderPaymentState,
  readPaymentReceipt: ports.readPaymentReceipt,
  readPaymentSummary: ports.readPaymentSummary,
}));

const ACTOR_ID = "11111111-1111-4111-8111-111111111111";
const ORDER_ID = "22222222-2222-4222-8222-222222222222";
const ISSUE_EVENT_ID = "33333333-3333-4333-8333-333333333333";
const INVOICE_ID = "44444444-4444-4444-8444-444444444444";
const CANCEL_EVENT_ID = "55555555-5555-4555-8555-555555555555";
const CORRELATION_ID = "66666666-6666-4666-8666-666666666666";
const CANCEL_CORRELATION_ID = "77777777-7777-4777-8777-777777777777";
const AS_OF = "2026-09-17T08:00:00.000Z";
const CANCEL_REASON = "Doppelte Berechnung vollständig storniert";

const issueReceipt = {
  invoiceId: INVOICE_ID,
  invoiceNumber: "R-2026-0001",
  orderId: ORDER_ID,
  orderVersion: 3,
  status: "issued" as const,
  netAmountCents: 10_000,
  vatRateBasisPoints: 1900,
  vatAmountCents: 1_900,
  grossAmountCents: 11_900,
  serviceDate: "2026-09-17",
  dueDate: "2026-10-17",
  issuedAt: AS_OF,
  issuedBy: ACTOR_ID,
  pdfRef: `invoice://${INVOICE_ID}/original`,
  pdfSha256: "a".repeat(64),
  eventId: ISSUE_EVENT_ID,
  clientEventId: ISSUE_EVENT_ID,
  correlationId: CORRELATION_ID,
  aggregateVersion: 1 as const,
  eventSchemaVersion: 1 as const,
};

const cancellationReceipt = {
  invoiceId: INVOICE_ID,
  invoiceNumber: issueReceipt.invoiceNumber,
  orderId: ORDER_ID,
  orderVersion: 3,
  status: "cancelled" as const,
  reason: CANCEL_REASON,
  cancelledAt: "2026-09-17T09:00:00.000Z",
  cancelledBy: ACTOR_ID,
  originalPdfSha256: issueReceipt.pdfSha256,
  cancellationPdfRef: `invoice://${INVOICE_ID}/cancellation`,
  cancellationPdfSha256: "b".repeat(64),
  eventId: CANCEL_EVENT_ID,
  clientEventId: CANCEL_EVENT_ID,
  correlationId: CANCEL_CORRELATION_ID,
  expectedVersion: 1 as const,
  aggregateVersion: 2 as const,
  eventSchemaVersion: 1 as const,
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

describe("Accounting invoice server actions", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    ports.resolveAuthorization.mockResolvedValue(authorization);
    ports.createInvoice.mockResolvedValue({ code: "OK", receipt: issueReceipt, replayed: false });
    ports.cancelInvoice.mockResolvedValue({ code: "OK", receipt: cancellationReceipt, replayed: false });
    ports.confirmPayment.mockResolvedValue({ code: "UNAVAILABLE", message: "unused" });
    ports.setPaymentMode.mockResolvedValue({ code: "UNAVAILABLE", message: "unused" });
    ports.readInvoiceReceipt.mockResolvedValue({ code: "OK", data: issueReceipt, asOf: AS_OF });
    ports.readInvoiceCancellationReceipt.mockResolvedValue({ code: "OK", data: cancellationReceipt, asOf: AS_OF });
    ports.readInvoiceCancellationState.mockResolvedValue({
      code: "OK",
      asOf: AS_OF,
      data: {
        invoiceId: INVOICE_ID,
        tenantId: KREILE_TENANT_SLUG,
        lifecycleStatus: "issued",
        aggregateVersion: 1,
        paymentContractVersion: 1,
        grossAmountCents: 11_900,
        paidAmountCents: 0,
        openAmountCents: 11_900,
        paymentStatus: "offen",
        paymentVersion: 0,
        paymentMethod: null,
        paymentReceiptId: null,
        paymentEventId: null,
        paymentCorrelationId: null,
        paymentPaidAt: null,
        paymentEvidenceCount: 0,
      },
    });
    ports.readInvoiceSummaries.mockResolvedValue({ code: "OK", data: [], asOf: AS_OF });
    ports.readOrderPaymentState.mockResolvedValue({ code: "OK", data: null });
    ports.readPaymentReceipt.mockResolvedValue({ code: "OK", data: null, asOf: AS_OF });
    ports.readPaymentSummary.mockResolvedValue({ code: "OK", data: [], asOf: AS_OF });
  });

  it("uses only the accounting server facade and revalidates only proven success", async () => {
    const { issueInvoiceAction, cancelInvoiceAction } = await import("../invoices.actions");
    const issue = { orderId: ORDER_ID, expectedVersion: 3, clientEventId: ISSUE_EVENT_ID };
    const cancel = {
      invoiceId: INVOICE_ID,
      expectedVersion: 1,
      reason: CANCEL_REASON,
      clientEventId: CANCEL_EVENT_ID,
    };

    await expect(issueInvoiceAction(issue)).resolves.toMatchObject({ code: "OK", receipt: issueReceipt });
    await expect(cancelInvoiceAction(cancel)).resolves.toMatchObject({ code: "OK", receipt: cancellationReceipt });

    expect(ports.createInvoice).toHaveBeenCalledWith(issue);
    expect(ports.cancelInvoice).toHaveBeenCalledWith(cancel);
    expect(ports.revalidatePath.mock.calls).toEqual([
      ["/buchhaltung/rechnungen"], ["/warendurchlauf"],
      ["/buchhaltung/rechnungen"], ["/warendurchlauf"],
    ]);
  });

  it("does not revalidate after a command conflict", async () => {
    const conflict = { code: "CONFLICT" as const, message: "Zahlungsstand sperrt die Stornierung." };
    ports.cancelInvoice.mockResolvedValueOnce(conflict);
    const { cancelInvoiceAction } = await import("../invoices.actions");
    await expect(cancelInvoiceAction({
      invoiceId: INVOICE_ID,
      expectedVersion: 1,
      reason: CANCEL_REASON,
      clientEventId: CANCEL_EVENT_ID,
    })).resolves.toEqual({
      code: "CONFLICT",
      message: "Der gespeicherte Stand hat sich geändert. Bitte neu laden und erneut prüfen.",
    });
    expect(ports.revalidatePath).not.toHaveBeenCalled();
  });

  it("returns user language and never calls the writer when confirmed payment evidence blocks cancellation", async () => {
    ports.readInvoiceCancellationState.mockResolvedValueOnce({
      code: "OK",
      asOf: AS_OF,
      data: {
        invoiceId: INVOICE_ID,
        tenantId: KREILE_TENANT_SLUG,
        lifecycleStatus: "issued",
        aggregateVersion: 1,
        paymentContractVersion: 1,
        grossAmountCents: 11_900,
        paidAmountCents: 1,
        openAmountCents: 11_899,
        paymentStatus: "teilbezahlt",
        paymentVersion: 1,
        paymentMethod: "ueberweisung",
        paymentReceiptId: "payment://receipt-1",
        paymentEventId: "11111111-1111-4111-8111-111111111119",
        paymentCorrelationId: "11111111-1111-4111-8111-111111111120",
        paymentPaidAt: AS_OF,
        paymentEvidenceCount: 1,
      },
    });
    const { cancelInvoiceAction } = await import("../invoices.actions");
    await expect(cancelInvoiceAction({
      invoiceId: INVOICE_ID,
      expectedVersion: 1,
      reason: CANCEL_REASON,
      clientEventId: CANCEL_EVENT_ID,
    })).resolves.toEqual({
      code: "CONFLICT",
      message: "Eine Rechnung mit bestätigter Zahlung kann nicht storniert werden.",
    });
    expect(ports.cancelInvoice).not.toHaveBeenCalled();
    expect(ports.revalidatePath).not.toHaveBeenCalled();
  });

  it("uses independent receipt reads for read-before-retry recovery", async () => {
    const actions = await import("../invoices.actions");
    await expect(actions.getInvoiceReceiptAction({
      orderId: ORDER_ID,
      clientEventId: ISSUE_EVENT_ID,
    })).resolves.toMatchObject({ code: "OK", data: issueReceipt, asOf: AS_OF });
    await expect(actions.getInvoiceCancellationReceiptAction({
      invoiceId: INVOICE_ID,
      clientEventId: CANCEL_EVENT_ID,
    })).resolves.toMatchObject({ code: "OK", data: cancellationReceipt, asOf: AS_OF });
    await expect(actions.getInvoiceSummariesAction()).resolves.toMatchObject({ code: "OK", data: [] });
    await expect(actions.recoverInvoiceIssueAction({
      kind: "invoice_issued",
      intentId: ISSUE_EVENT_ID,
      idempotencyKey: ISSUE_EVENT_ID,
      aggregateId: ORDER_ID,
      expectedVersion: 3,
      expectedAmount: null,
      expectedMethod: null,
      expectedReason: null,
    })).resolves.toMatchObject({ state: "resolved", receipt: { invoiceId: INVOICE_ID } });
    expect(ports.readInvoiceReceipt).toHaveBeenCalled();
  });
});
