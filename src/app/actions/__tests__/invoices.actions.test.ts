import { beforeEach, describe, expect, it, vi } from "vitest";

const ports = vi.hoisted(() => ({
  revalidatePath: vi.fn(),
  resolveAuthorization: vi.fn(),
  createInvoice: vi.fn(),
  cancelInvoice: vi.fn(),
  readInvoiceReceipt: vi.fn(),
  readInvoiceCancellationReceipt: vi.fn(),
  readInvoiceSummaries: vi.fn(),
}));

vi.mock("next/cache", () => ({ revalidatePath: ports.revalidatePath }));
vi.mock("@/lib/server/authorization", () => ({ resolveAuthorization: ports.resolveAuthorization }));
vi.mock("@/lib/server/commands/immutableInvoiceCommand", () => ({
  createInvoice: ports.createInvoice,
  cancelInvoice: ports.cancelInvoice,
}));
vi.mock("@/lib/server/invoiceRead", () => ({
  readInvoiceReceipt: ports.readInvoiceReceipt,
  readInvoiceCancellationReceipt: ports.readInvoiceCancellationReceipt,
  readInvoiceSummaries: ports.readInvoiceSummaries,
}));

const authorization = {
  ok: true as const,
  data: {
    tenantId: "galvanik-kreile",
    userId: "11111111-1111-4111-8111-111111111111",
    displayName: "Meister",
    role: "meister" as const,
    permissions: [] as const,
    active: true as const,
  },
};

describe("F1.4 invoice server actions", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    ports.resolveAuthorization.mockResolvedValue(authorization);
  });

  it("revalidates invoice and work routes only after a successful issue or cancellation", async () => {
    ports.createInvoice.mockResolvedValueOnce({ code: "OK", receipt: {}, replayed: false });
    ports.cancelInvoice.mockResolvedValueOnce({ code: "OK", receipt: {}, replayed: false });
    const { issueInvoiceAction, cancelInvoiceAction } = await import("../invoices.actions");

    await issueInvoiceAction({
      orderId: "22222222-2222-4222-8222-222222222222",
      expectedVersion: 3,
      clientEventId: "33333333-3333-4333-8333-333333333333",
    });
    await cancelInvoiceAction({
      invoiceId: "44444444-4444-4444-8444-444444444444",
      expectedVersion: 1,
      reason: "Doppelte Berechnung vollständig storniert",
      clientEventId: "55555555-5555-4555-8555-555555555555",
    });

    expect(ports.revalidatePath.mock.calls).toEqual([
      ["/buchhaltung/rechnungen"], ["/warendurchlauf"],
      ["/buchhaltung/rechnungen"], ["/warendurchlauf"],
    ]);
  });

  it("does not revalidate after a command conflict", async () => {
    ports.cancelInvoice.mockResolvedValueOnce({ code: "CONFLICT", message: "stale" });
    const { cancelInvoiceAction } = await import("../invoices.actions");
    await cancelInvoiceAction({
      invoiceId: "44444444-4444-4444-8444-444444444444",
      expectedVersion: 1,
      reason: "Doppelte Berechnung vollständig storniert",
      clientEventId: "55555555-5555-4555-8555-555555555555",
    });
    expect(ports.revalidatePath).not.toHaveBeenCalled();
  });

  it("resolves authorization before receipt and summary reads and fails closed without a session", async () => {
    ports.readInvoiceReceipt.mockResolvedValueOnce({ code: "OK", data: null });
    ports.readInvoiceCancellationReceipt.mockResolvedValueOnce({ code: "OK", data: null });
    ports.readInvoiceSummaries.mockResolvedValueOnce({ code: "OK", data: [] });
    const {
      getInvoiceReceiptAction,
      getInvoiceCancellationReceiptAction,
      getInvoiceSummariesAction,
    } = await import("../invoices.actions");

    await getInvoiceReceiptAction({
      orderId: "22222222-2222-4222-8222-222222222222",
      clientEventId: "33333333-3333-4333-8333-333333333333",
    });
    await getInvoiceCancellationReceiptAction({
      invoiceId: "44444444-4444-4444-8444-444444444444",
      clientEventId: "55555555-5555-4555-8555-555555555555",
    });
    await getInvoiceSummariesAction();
    expect(ports.readInvoiceReceipt).toHaveBeenCalledWith(authorization.data, expect.any(Object));
    expect(ports.readInvoiceCancellationReceipt).toHaveBeenCalledWith(authorization.data, expect.any(Object));
    expect(ports.readInvoiceSummaries).toHaveBeenCalledWith(authorization.data);

    ports.resolveAuthorization.mockResolvedValueOnce({ ok: false, reason: "NO_SESSION", message: "no" });
    await expect(getInvoiceSummariesAction()).resolves.toMatchObject({ code: "UNAUTHENTICATED" });
  });
});
