import { KREILE_TENANT_SLUG } from "@/lib/tenant";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { withTransaction, execute } = vi.hoisted(() => ({ withTransaction: vi.fn(), execute: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/server/privilegedDb", () => ({ withPrivilegedTenantTransaction: withTransaction }));
vi.mock("drizzle-orm", () => ({ sql: (parts: TemplateStringsArray, ...values: unknown[]) => ({ text: parts.join("?"), values }) }));

const ORDER = "11111111-1111-4111-8111-111111111111";
const CLIENT = "22222222-2222-4222-8222-222222222222";
const INVOICE = "33333333-3333-4333-8333-333333333333";
const EVENT = "44444444-4444-4444-8444-444444444444";
const CORRELATION = "55555555-5555-4555-8555-555555555555";
const ACTOR = "66666666-6666-4666-8666-666666666666";
const PDF_SHA256 = "b".repeat(64);

const buero = {
  tenantId: KREILE_TENANT_SLUG,
  userId: ACTOR,
  displayName: "Büro",
  role: "buero" as const,
  permissions: ["perm_data_orders"] as const,
  active: true as const,
};
const werkstatt = { ...buero, role: "werkstatt" as const };

const validReceiptRow = {
  event_id: EVENT,
  tenant_id: KREILE_TENANT_SLUG,
  order_id: ORDER,
  event_type: "INVOICE_CREATED_V1",
  client_event_id: CLIENT,
  correlation_id: CORRELATION,
  event_schema_version: 1,
  aggregate_version: 1,
  actor_id: ACTOR,
  occurred_at: "2026-08-21T09:00:00.000Z",
  invoice_id: INVOICE,
  invoice_number: "R-2026-0009",
  order_version: 3,
  intent_expected_version: 3,
  current_status: "issued",
  current_version: 1,
  net_amount_cents: 5000,
  vat_rate_basis_points: 1900,
  vat_amount_cents: 950,
  gross_amount_cents: 5950,
  service_date: "2026-08-20",
  due_date: "2026-09-10",
  pdf_ref: `invoice://${INVOICE}/original`,
  pdf_sha256: PDF_SHA256,
  cancel_reason: null,
  original_pdf_sha256: PDF_SHA256,
  integrity_ok: true,
};

const validCancellationReceiptRow = {
  ...validReceiptRow,
  event_type: "INVOICE_CANCELLED_V1",
  intent_expected_version: 1,
  aggregate_version: 2,
  current_status: "cancelled",
  current_version: 2,
  pdf_ref: `invoice://${INVOICE}/cancellation`,
  pdf_sha256: "c".repeat(64),
  cancel_reason: "Auftrag wurde doppelt berechnet",
};

describe("readInvoiceReceipt", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    withTransaction.mockImplementation(async (_authorization, work) => work({ execute }));
  });

  it("rejects malformed input before opening a transaction", async () => {
    const { readInvoiceReceipt } = await import("../invoiceRead");
    await expect(readInvoiceReceipt(buero, null)).resolves.toMatchObject({ code: "VALIDATION_ERROR" });
    await expect(readInvoiceReceipt(buero, { orderId: ORDER })).resolves.toMatchObject({ code: "VALIDATION_ERROR" });
    await expect(readInvoiceReceipt(buero, { orderId: ORDER, clientEventId: "not-a-uuid" })).resolves.toMatchObject({ code: "VALIDATION_ERROR" });
    expect(withTransaction).not.toHaveBeenCalled();
  });

  it("forbids roles outside the invoice-read allowlist without a transaction", async () => {
    const { readInvoiceReceipt } = await import("../invoiceRead");
    await expect(readInvoiceReceipt(werkstatt, { orderId: ORDER, clientEventId: CLIENT }))
      .resolves.toMatchObject({ code: "FORBIDDEN" });
    expect(withTransaction).not.toHaveBeenCalled();
  });

  it("uses the tenant-scoped privileged transaction port and returns null when nothing matches", async () => {
    execute.mockResolvedValueOnce([]);
    const { readInvoiceReceipt } = await import("../invoiceRead");
    await expect(readInvoiceReceipt(buero, { orderId: ORDER, clientEventId: CLIENT })).resolves.toEqual({ code: "OK", data: null });
    expect(withTransaction).toHaveBeenCalledWith(buero, expect.any(Function));
    expect(execute.mock.calls[0]?.[0].text).toContain("private.v_invoice_receipt_v1");
  });

  it("returns the exact stored receipt bytes unchanged for a valid contract row", async () => {
    execute.mockResolvedValueOnce([validReceiptRow]);
    const { readInvoiceReceipt } = await import("../invoiceRead");
    await expect(readInvoiceReceipt(buero, { orderId: ORDER, clientEventId: CLIENT })).resolves.toEqual({
      code: "OK",
      data: {
        invoiceId: INVOICE,
        invoiceNumber: "R-2026-0009",
        orderId: ORDER,
        orderVersion: 3,
        status: "issued",
        netAmountCents: 5000,
        vatRateBasisPoints: 1900,
        vatAmountCents: 950,
        grossAmountCents: 5950,
        serviceDate: "2026-08-20",
        dueDate: "2026-09-10",
        issuedAt: "2026-08-21T09:00:00.000Z",
        issuedBy: ACTOR,
        pdfRef: `invoice://${INVOICE}/original`,
        pdfSha256: PDF_SHA256,
        eventId: EVENT,
        clientEventId: CLIENT,
        correlationId: CORRELATION,
        aggregateVersion: 1,
        eventSchemaVersion: 1,
      },
    });
  });

  it("fails closed to UNAVAILABLE on an ambiguous match, an integrity-broken row, or a database error", async () => {
    const { readInvoiceReceipt } = await import("../invoiceRead");

    execute.mockResolvedValueOnce([validReceiptRow, { ...validReceiptRow, event_id: CORRELATION }]);
    await expect(readInvoiceReceipt(buero, { orderId: ORDER, clientEventId: CLIENT })).resolves.toMatchObject({ code: "UNAVAILABLE" });

    execute.mockResolvedValueOnce([{ ...validReceiptRow, integrity_ok: false }]);
    await expect(readInvoiceReceipt(buero, { orderId: ORDER, clientEventId: CLIENT })).resolves.toMatchObject({ code: "UNAVAILABLE" });

    execute.mockRejectedValueOnce(new Error("db down"));
    await expect(readInvoiceReceipt(buero, { orderId: ORDER, clientEventId: CLIENT })).resolves.toEqual({
      code: "UNAVAILABLE",
      message: "Rechnungsbeleg konnte nicht sicher geladen werden.",
    });
  });
});

describe("readInvoicePdf", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    withTransaction.mockImplementation(async (_authorization, work) => work({ execute }));
  });

  it("rejects a malformed invoice id before opening a transaction", async () => {
    const { readInvoicePdf } = await import("../invoiceRead");
    await expect(readInvoicePdf(buero, "not-a-uuid")).resolves.toMatchObject({ code: "VALIDATION_ERROR" });
    expect(withTransaction).not.toHaveBeenCalled();
  });

  it("forbids roles outside the invoice-read allowlist without a transaction", async () => {
    const { readInvoicePdf } = await import("../invoiceRead");
    await expect(readInvoicePdf(werkstatt, INVOICE)).resolves.toMatchObject({ code: "FORBIDDEN" });
    expect(withTransaction).not.toHaveBeenCalled();
  });

  it("returns NOT_FOUND when no row matches the tenant-scoped id", async () => {
    execute.mockResolvedValueOnce([]);
    const { readInvoicePdf } = await import("../invoiceRead");
    await expect(readInvoicePdf(buero, INVOICE)).resolves.toMatchObject({ code: "NOT_FOUND" });
  });

  it("returns the exact stored pdf_content byte sequence unchanged, wrapped in a Buffer", async () => {
    const storedBytes = Buffer.from([1, 2, 3, 4, 250, 251, 252]);
    execute.mockResolvedValueOnce([{
      id: INVOICE,
      tenant_id: KREILE_TENANT_SLUG,
      invoice_number: "R-2026-0009",
      status: "issued",
      pdf_sha256: PDF_SHA256,
      pdf_content: storedBytes,
      integrity_ok: true,
    }]);
    const { readInvoicePdf } = await import("../invoiceRead");
    const result = await readInvoicePdf(buero, INVOICE);
    expect(result.code).toBe("OK");
    if (result.code !== "OK") throw new Error("unreachable");
    expect(Buffer.isBuffer(result.data.pdf)).toBe(true);
    expect(result.data.pdf.equals(storedBytes)).toBe(true);
    expect(result.data.invoiceNumber).toBe("R-2026-0009");
    expect(result.data.pdfSha256).toBe(PDF_SHA256);
    expect(result.data.kind).toBe("original");
  });

  it("fails closed to UNAVAILABLE on ambiguous rows, integrity failure, missing bytes, or a database error", async () => {
    const { readInvoicePdf } = await import("../invoiceRead");

    execute.mockResolvedValueOnce([
      { id: INVOICE, tenant_id: KREILE_TENANT_SLUG, invoice_number: "R-2026-0009", status: "issued", pdf_sha256: PDF_SHA256, pdf_content: Buffer.from([1]), integrity_ok: true },
      { id: INVOICE, tenant_id: KREILE_TENANT_SLUG, invoice_number: "R-2026-0009", status: "issued", pdf_sha256: PDF_SHA256, pdf_content: Buffer.from([1]), integrity_ok: true },
    ]);
    await expect(readInvoicePdf(buero, INVOICE)).resolves.toMatchObject({ code: "UNAVAILABLE" });

    execute.mockResolvedValueOnce([{
      id: INVOICE, tenant_id: KREILE_TENANT_SLUG, invoice_number: "R-2026-0009", status: "issued",
      pdf_sha256: PDF_SHA256, pdf_content: Buffer.from([1]), integrity_ok: false,
    }]);
    await expect(readInvoicePdf(buero, INVOICE)).resolves.toMatchObject({ code: "UNAVAILABLE" });

    execute.mockResolvedValueOnce([{
      id: INVOICE, tenant_id: KREILE_TENANT_SLUG, invoice_number: "R-2026-0009", status: "issued",
      pdf_sha256: PDF_SHA256, pdf_content: null, integrity_ok: true,
    }]);
    await expect(readInvoicePdf(buero, INVOICE)).resolves.toMatchObject({ code: "UNAVAILABLE" });

    execute.mockRejectedValueOnce(new Error("db down"));
    await expect(readInvoicePdf(buero, INVOICE)).resolves.toEqual({
      code: "UNAVAILABLE",
      message: "Rechnungs-PDF konnte nicht sicher geladen werden.",
    });
  });

  it("returns the exact stored cancellation bytes only for a cancelled invoice", async () => {
    const storedBytes = Buffer.from([37, 80, 68, 70, 9, 8, 7]);
    execute.mockResolvedValueOnce([{
      id: INVOICE,
      tenant_id: KREILE_TENANT_SLUG,
      invoice_number: "R-2026-0009",
      status: "cancelled",
      pdf_sha256: "c".repeat(64),
      pdf_content: storedBytes,
      integrity_ok: true,
    }]);
    const { readInvoicePdf } = await import("../invoiceRead");
    const result = await readInvoicePdf(buero, INVOICE, "cancellation");
    expect(result.code).toBe("OK");
    if (result.code !== "OK") throw new Error("unreachable");
    expect(result.data.kind).toBe("cancellation");
    expect(result.data.pdf.equals(storedBytes)).toBe(true);
  });
});

describe("readInvoiceCancellationReceipt", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    withTransaction.mockImplementation(async (_authorization, work) => work({ execute }));
  });

  it("returns the exact cancellation receipt and fails closed on changed integrity", async () => {
    execute.mockResolvedValueOnce([validCancellationReceiptRow]);
    const { readInvoiceCancellationReceipt } = await import("../invoiceRead");
    await expect(readInvoiceCancellationReceipt(buero, { invoiceId: INVOICE, clientEventId: CLIENT }))
      .resolves.toMatchObject({
        code: "OK",
        data: {
          invoiceId: INVOICE,
          expectedVersion: 1,
          aggregateVersion: 2,
          reason: "Auftrag wurde doppelt berechnet",
          originalPdfSha256: PDF_SHA256,
          cancellationPdfSha256: "c".repeat(64),
        },
      });

    execute.mockResolvedValueOnce([{ ...validCancellationReceiptRow, intent_expected_version: 2 }]);
    await expect(readInvoiceCancellationReceipt(buero, { invoiceId: INVOICE, clientEventId: CLIENT }))
      .resolves.toMatchObject({ code: "UNAVAILABLE" });
  });
});

describe("readInvoiceSummaries", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    withTransaction.mockImplementation(async (_authorization, work) => work({ execute }));
  });

  it("maps issued and cancelled tenant summaries without payment truth", async () => {
    const base = {
      id: INVOICE,
      tenant_id: KREILE_TENANT_SLUG,
      order_id: "f1-4-order-text-id",
      customer_id: "f1-4-customer-text-id",
      invoice_number: "R-2026-0009",
      status: "issued",
      net_amount_cents: 5000,
      vat_rate_basis_points: 1900,
      vat_amount_cents: 950,
      gross_amount_cents: 5950,
      service_date: "2026-08-20",
      order_version: 3,
      due_date: "2026-09-10",
      issued_at: "2026-08-21T09:00:00.000Z",
      aggregate_version: 1,
      pdf_ref: `invoice://${INVOICE}/original`,
      pdf_sha256: PDF_SHA256,
      cancelled_by: null,
      cancel_reason: null,
      cancelled_at: null,
      cancellation_pdf_ref: null,
      cancellation_pdf_sha256: null,
      order_number: "A-2026-0012",
      customer_name: "Synthetischer Testkunde",
      integrity_ok: true,
    };
    execute.mockResolvedValueOnce([base]);
    const { readInvoiceSummaries } = await import("../invoiceRead");
    const issued = await readInvoiceSummaries(buero);
    expect(issued).toMatchObject({
      code: "OK",
      data: [{
        orderId: "f1-4-order-text-id",
        customerId: "f1-4-customer-text-id",
        status: "issued",
        aggregateVersion: 1,
      }],
    });
    expect(JSON.stringify(issued)).not.toMatch(/open|balance|payment/i);

    execute.mockResolvedValueOnce([{
      ...base,
      status: "cancelled",
      aggregate_version: 2,
      cancelled_by: ACTOR,
      cancel_reason: "Auftrag wurde doppelt berechnet",
      cancelled_at: "2026-08-21T10:00:00.000Z",
      cancellation_pdf_ref: `invoice://${INVOICE}/cancellation`,
      cancellation_pdf_sha256: "c".repeat(64),
    }]);
    await expect(readInvoiceSummaries(buero)).resolves.toMatchObject({
      code: "OK",
      data: [{ status: "cancelled", aggregateVersion: 2 }],
    });
  });
});
