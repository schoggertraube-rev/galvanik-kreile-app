import { beforeEach, describe, expect, it, vi } from "vitest";
import { ACCOUNTING_CAPABILITIES_V1 } from "../core/version";

const ports = vi.hoisted(() => ({
  resolveAuthorization: vi.fn(),
  createInvoice: vi.fn(),
  cancelInvoice: vi.fn(),
  confirmPayment: vi.fn(),
  setPaymentMode: vi.fn(),
  readInvoiceCancellationReceipt: vi.fn(),
  readInvoiceCancellationState: vi.fn(),
  readInvoiceReceipt: vi.fn(),
  readInvoiceSummaries: vi.fn(),
  readOrderPaymentState: vi.fn(),
  readPaymentReceipt: vi.fn(),
  readPaymentSummary: vi.fn(),
}));

vi.mock("@/lib/server/authorization", () => ({ resolveAuthorization: ports.resolveAuthorization }));
vi.mock("@/lib/server/commands/immutableInvoiceCommand", () => ({
  createInvoice: ports.createInvoice,
  cancelInvoice: ports.cancelInvoice,
}));
vi.mock("@/lib/server/commands/confirmPaymentCommand", () => ({ confirmPayment: ports.confirmPayment }));
vi.mock("@/lib/server/commands/setPaymentModeCommand", () => ({ setPaymentMode: ports.setPaymentMode }));
vi.mock("@/lib/server/invoiceRead", () => ({
  readInvoiceCancellationReceipt: ports.readInvoiceCancellationReceipt,
  readInvoiceCancellationState: ports.readInvoiceCancellationState,
  readInvoiceReceipt: ports.readInvoiceReceipt,
  readInvoiceSummaries: ports.readInvoiceSummaries,
}));
vi.mock("@/lib/server/paymentSummaryRead", () => ({
  readOrderPaymentState: ports.readOrderPaymentState,
  readPaymentReceipt: ports.readPaymentReceipt,
  readPaymentSummary: ports.readPaymentSummary,
}));

const authorization = {
  ok: true as const,
  data: {
    tenantId: "tenant-a",
    userId: "11111111-1111-4111-8111-111111111111",
    displayName: "Rolf",
    role: "meister" as const,
    permissions: ["perm_view_leitstand"] as const,
    active: true as const,
  },
};

const context = {
  tenantId: authorization.data.tenantId,
  actorId: authorization.data.userId,
  authenticated: true as const,
  active: true as const,
  capabilities: Object.values(ACCOUNTING_CAPABILITIES_V1),
};

const issueReceipt = {
  invoiceId: "22222222-2222-4222-8222-222222222222",
  invoiceNumber: "R-2026-0001",
  orderId: "order-a",
  orderVersion: 4,
  status: "issued" as const,
  netAmountCents: 10_000,
  vatRateBasisPoints: 1_900,
  vatAmountCents: 1_900,
  grossAmountCents: 11_900,
  serviceDate: "2026-09-17",
  dueDate: "2026-10-17",
  issuedAt: "2026-09-17T08:00:00.000Z",
  issuedBy: authorization.data.userId,
  pdfRef: "invoice://22222222-2222-4222-8222-222222222222/original",
  pdfSha256: "a".repeat(64),
  eventId: "33333333-3333-4333-8333-333333333333",
  clientEventId: "44444444-4444-4444-8444-444444444444",
  correlationId: "55555555-5555-4555-8555-555555555555",
  aggregateVersion: 1 as const,
  eventSchemaVersion: 2 as const,
  invoiceSourceState: "after_goods_out" as const,
};

describe("Accounting host adapter", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    ports.resolveAuthorization.mockResolvedValue(authorization);
  });

  it("binds capability, tenant and actor to the current server session", async () => {
    const { accountingHostAdapter } = await import("../server/hostAdapter");
    await expect(accountingHostAdapter.resolveContext({
      requestId: "66666666-6666-4666-8666-666666666666",
      correlationId: "77777777-7777-4777-8777-777777777777",
      locale: "de-DE",
      timeZone: "Europe/Berlin",
    }, ACCOUNTING_CAPABILITIES_V1.INVOICE_CANCEL)).resolves.toMatchObject({
      state: "authorized",
      context: { tenantId: "tenant-a", actorId: authorization.data.userId },
    });

    ports.resolveAuthorization.mockResolvedValueOnce({ ok: false, reason: "NO_SESSION", message: "no" });
    await expect(accountingHostAdapter.resolveContext({} as never, ACCOUNTING_CAPABILITIES_V1.INVOICE_READ))
      .resolves.toMatchObject({ state: "denied", error: { code: "UNAUTHENTICATED" } });
  });

  it("delegates issuance to the one existing command and returns its durable receipt", async () => {
    ports.createInvoice.mockResolvedValueOnce({ code: "OK", receipt: issueReceipt, replayed: false });
    const { accountingHostAdapter } = await import("../server/hostAdapter");
    const result = await accountingHostAdapter.commands.issueInvoice(context, {
      contractVersion: "1.0.0-candidate.1",
      intentId: issueReceipt.clientEventId,
      idempotencyKey: issueReceipt.clientEventId,
      expectedVersion: 4,
      confirmation: {
        kind: "explicit",
        scope: "issue_invoice",
        confirmedBy: authorization.data.userId,
      },
      payload: { orderId: "order-a" },
    });

    expect(ports.createInvoice).toHaveBeenCalledWith({
      orderId: "order-a",
      expectedVersion: 4,
      clientEventId: issueReceipt.clientEventId,
    });
    expect(result).toMatchObject({
      state: "succeeded",
      receipt: { eventType: "INVOICE_CREATED_V2", tenantId: "tenant-a", actorId: authorization.data.userId },
    });
  });

  it("never invents recovery identity for an unknown host outcome", async () => {
    ports.createInvoice.mockResolvedValueOnce({ code: "UNAVAILABLE", message: "unknown" });
    const { accountingHostAdapter } = await import("../server/hostAdapter");
    const result = await accountingHostAdapter.commands.issueInvoice(context, {
      contractVersion: "1.0.0-candidate.1",
      intentId: issueReceipt.clientEventId,
      idempotencyKey: issueReceipt.clientEventId,
      expectedVersion: 4,
      confirmation: {
        kind: "explicit",
        scope: "issue_invoice",
        confirmedBy: authorization.data.userId,
      },
      payload: { orderId: "order-a" },
    });
    expect(result).toMatchObject({
      state: "unknown",
      recovery: {
        tenantId: "tenant-a",
        aggregateId: "order-a",
        idempotencyKey: issueReceipt.clientEventId,
      },
    });
  });

  it("fails closed when a host success violates the current issuance proof policy", async () => {
    const { issueInvoiceCommand } = await import("../server/service");
    for (const receipt of [
      {
        ...issueReceipt,
        vatRateBasisPoints: 700,
        vatAmountCents: 700,
        grossAmountCents: 10_700,
      },
      {
        ...issueReceipt,
        netAmountCents: 0,
        vatAmountCents: 0,
        grossAmountCents: 0,
      },
    ]) {
      ports.createInvoice.mockResolvedValueOnce({ code: "OK", receipt, replayed: false });
      await expect(issueInvoiceCommand({
        orderId: "order-a",
        expectedVersion: 4,
        clientEventId: issueReceipt.clientEventId,
      })).resolves.toMatchObject({ code: "UNAVAILABLE" });
    }
  });
});
