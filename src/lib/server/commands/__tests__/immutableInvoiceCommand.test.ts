import { KREILE_TENANT_SLUG } from "@/lib/tenant";
import { createHash } from "node:crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { resolveAuthorization, withTransaction, execute, renderToBuffer } = vi.hoisted(() => ({
  resolveAuthorization: vi.fn(),
  withTransaction: vi.fn(),
  execute: vi.fn(),
  renderToBuffer: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/server/authorization", () => ({ resolveAuthorization }));
vi.mock("@/lib/server/privilegedDb", () => ({ withPrivilegedTenantTransaction: withTransaction }));
vi.mock("@react-pdf/renderer", () => ({ renderToBuffer }));
vi.mock("@/lib/pdf/ImmutableInvoiceDocument", () => ({
  createImmutableInvoicePdfDocument: vi.fn(() => ({ type: "Document" })),
  createImmutableInvoiceCancellationPdfDocument: vi.fn(() => ({ type: "Document" })),
}));
vi.mock("drizzle-orm", () => ({
  sql: (parts: TemplateStringsArray, ...values: unknown[]) => ({ text: parts.join("?"), values }),
}));

const ACTOR = "11111111-1111-4111-8111-111111111111";
const CLIENT = "22222222-2222-4222-8222-222222222222";
const ORDER = "33333333-3333-4333-8333-333333333333";
const EVENT = "44444444-4444-4444-8444-444444444444";
const CORRELATION = "55555555-5555-4555-8555-555555555555";
const INVOICE = "66666666-6666-4666-8666-666666666666";
const FREEZE = "77777777-7777-4777-8777-777777777777";
const PDF_SHA256 = "a".repeat(64);
const ORIGINAL_PDF = Buffer.from("f1.4-original-invoice-pdf");
const ORIGINAL_PDF_SHA256 = createHash("sha256").update(ORIGINAL_PDF).digest("hex");

const validInput = {
  orderId: ORDER,
  expectedVersion: 3,
  clientEventId: CLIENT,
};

const validCancelInput = {
  invoiceId: INVOICE,
  expectedVersion: 1,
  reason: "Doppelte Berechnung vollständig storniert",
  clientEventId: CLIENT,
};

const authorization = {
  ok: true as const,
  data: {
    userId: ACTOR,
    tenantId: KREILE_TENANT_SLUG,
    displayName: "Büro",
    role: "buero" as const,
    permissions: ["perm_data_orders"] as const,
    active: true as const,
  },
};

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
  invoice_number: "R-2026-0007",
  order_version: 3,
  intent_expected_version: 3,
  current_status: "issued",
  current_version: 1,
  net_amount_cents: 10000,
  vat_rate_basis_points: 1900,
  vat_amount_cents: 1900,
  gross_amount_cents: 11900,
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
  pdf_sha256: "b".repeat(64),
  cancel_reason: validCancelInput.reason,
};

const validLockedInvoice = {
  id: INVOICE,
  tenant_id: KREILE_TENANT_SLUG,
  order_id: ORDER,
  invoice_number: "R-2026-0007",
  status: "issued",
  aggregate_version: 1,
  snapshot: {},
  due_date: "2026-09-10",
  pdf_ref: `invoice://${INVOICE}/original`,
  pdf_sha256: ORIGINAL_PDF_SHA256,
  pdf_content: ORIGINAL_PDF,
  gross_amount_cents: 11_900,
  payment_contract_version: 1,
  payment_mode: "vorkasse",
  payment_status: "offen",
  payment_open_amount_cents: 11_900,
  payment_paid_amount_cents: 0,
  payment_currency: "EUR",
  payment_method: null,
  payment_paid_at: null,
  payment_receipt_id: null,
  payment_event_id: null,
  payment_correlation_id: null,
  payment_version: 0,
};

describe("createInvoice", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    resolveAuthorization.mockResolvedValue(authorization);
    withTransaction.mockImplementation(async (_authorization, work) => work({ execute }));
  });

  it("rejects malformed runtime input before auth or database access", async () => {
    const { createInvoice } = await import("../immutableInvoiceCommand");
    await expect(createInvoice(null)).resolves.toMatchObject({ code: "VALIDATION_ERROR" });
    await expect(createInvoice({ ...validInput, orderId: "" })).resolves.toMatchObject({ code: "VALIDATION_ERROR" });
    await expect(createInvoice({ ...validInput, clientEventId: "not-a-uuid" })).resolves.toMatchObject({ code: "VALIDATION_ERROR" });
    await expect(createInvoice({ ...validInput, expectedVersion: 0 })).resolves.toMatchObject({ code: "VALIDATION_ERROR" });
    await expect(createInvoice({ ...validInput, extra: true })).resolves.toMatchObject({ code: "VALIDATION_ERROR" });
    expect(resolveAuthorization).not.toHaveBeenCalled();
    expect(withTransaction).not.toHaveBeenCalled();
  });

  it("fails closed on missing session, unavailable authorization and forbidden roles without opening a transaction", async () => {
    const { createInvoice } = await import("../immutableInvoiceCommand");

    resolveAuthorization.mockResolvedValueOnce({ ok: false, reason: "NO_SESSION", message: "no" });
    await expect(createInvoice(validInput)).resolves.toMatchObject({ code: "UNAUTHENTICATED" });

    resolveAuthorization.mockResolvedValueOnce({ ok: false, reason: "AUTHORIZATION_UNAVAILABLE", message: "n/a" });
    await expect(createInvoice(validInput)).resolves.toMatchObject({ code: "UNAVAILABLE" });

    resolveAuthorization.mockResolvedValueOnce({ ...authorization, data: { ...authorization.data, role: "werkstatt" } });
    await expect(createInvoice(validInput)).resolves.toMatchObject({ code: "FORBIDDEN" });

    resolveAuthorization.mockRejectedValueOnce(new Error("resolve failed"));
    await expect(createInvoice(validInput)).resolves.toMatchObject({ code: "UNAVAILABLE" });

    expect(withTransaction).not.toHaveBeenCalled();
  });

  it("maps any database error inside the transaction to UNAVAILABLE, never a success or NOT_AVAILABLE result", async () => {
    execute.mockRejectedValueOnce(new Error("db unreachable"));
    const { createInvoice } = await import("../immutableInvoiceCommand");
    await expect(createInvoice(validInput)).resolves.toEqual({
      code: "UNAVAILABLE",
      message: "Rechnung konnte nicht sicher ausgestellt werden.",
    });
  });

  it("replays an exact, contract-valid existing receipt without simulating the full issuance path", async () => {
    execute.mockImplementation((query: { text: string }) => {
      if (query.text.includes("pg_advisory_xact_lock")) return Promise.resolve([]);
      if (query.text.includes("private.v_invoice_receipt_v1")) return Promise.resolve([validReceiptRow]);
      throw new Error(`unexpected SQL in replay test: ${query.text}`);
    });
    const { createInvoice } = await import("../immutableInvoiceCommand");
    const result = await createInvoice(validInput);
    expect(result).toEqual({
      code: "OK",
      replayed: true,
      receipt: {
        invoiceId: INVOICE,
        invoiceNumber: "R-2026-0007",
        orderId: ORDER,
        orderVersion: 3,
        status: "issued",
        netAmountCents: 10000,
        vatRateBasisPoints: 1900,
        vatAmountCents: 1900,
        grossAmountCents: 11900,
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
    expect(renderToBuffer).not.toHaveBeenCalled();
    const sqlText = execute.mock.calls.map(([query]) => query.text).join("\n");
    expect(sqlText).not.toContain("INSERT INTO public.invoices");
    expect(sqlText).not.toMatch(/createClient|supabase|rpc\(/i);
  });

  it("replays the additive after-goods-out invoice receipt without changing the V1 receipt", async () => {
    const v2ReceiptRow = {
      ...validReceiptRow,
      event_type: "INVOICE_CREATED_V2",
      event_schema_version: 2,
    };
    execute.mockImplementation((query: { text: string }) => {
      if (query.text.includes("pg_advisory_xact_lock")) return Promise.resolve([]);
      if (query.text.includes("private.v_invoice_receipt_v1")) return Promise.resolve([v2ReceiptRow]);
      throw new Error(`unexpected SQL in V2 replay test: ${query.text}`);
    });
    const { createInvoice } = await import("../immutableInvoiceCommand");
    await expect(createInvoice(validInput)).resolves.toMatchObject({
      code: "OK",
      replayed: true,
      receipt: {
        eventSchemaVersion: 2,
        invoiceSourceState: "after_goods_out",
      },
    });
  });

  it("rejects a replayed row that fails the integrity/tenant/actor contract as CONFLICT, never OK", async () => {
    execute.mockImplementation((query: { text: string }) => {
      if (query.text.includes("pg_advisory_xact_lock")) return Promise.resolve([]);
      if (query.text.includes("private.v_invoice_receipt_v1")) {
        return Promise.resolve([{ ...validReceiptRow, integrity_ok: false }]);
      }
      throw new Error(`unexpected SQL: ${query.text}`);
    });
    const { createInvoice } = await import("../immutableInvoiceCommand");
    await expect(createInvoice(validInput)).resolves.toMatchObject({ code: "UNAVAILABLE" });
  });

  it("rejects reuse of a client event id when expectedVersion differs from the immutable receipt intent", async () => {
    execute.mockImplementation((query: { text: string }) => {
      if (query.text.includes("pg_advisory_xact_lock")) return Promise.resolve([]);
      if (query.text.includes("private.v_invoice_receipt_v1")) return Promise.resolve([validReceiptRow]);
      throw new Error(`unexpected SQL in intent collision test: ${query.text}`);
    });
    const { createInvoice } = await import("../immutableInvoiceCommand");
    await expect(createInvoice({ ...validInput, expectedVersion: 4 })).resolves.toEqual({
      code: "CONFLICT",
      message: "Anfragekennung wurde bereits anders verwendet.",
    });
    expect(renderToBuffer).not.toHaveBeenCalled();
    const sqlText = execute.mock.calls.map(([query]) => query.text).join("\n");
    expect(sqlText).not.toContain("INSERT INTO public.invoices");
  });

  it("treats more than one client-event-id match as CONFLICT rather than picking one", async () => {
    execute.mockImplementation((query: { text: string }) => {
      if (query.text.includes("pg_advisory_xact_lock")) return Promise.resolve([]);
      if (query.text.includes("private.v_invoice_receipt_v1")) {
        return Promise.resolve([validReceiptRow, { ...validReceiptRow, event_id: FREEZE }]);
      }
      throw new Error(`unexpected SQL: ${query.text}`);
    });
    const { createInvoice } = await import("../immutableInvoiceCommand");
    await expect(createInvoice(validInput)).resolves.toMatchObject({ code: "CONFLICT" });
  });
});

describe("cancelInvoice", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    resolveAuthorization.mockResolvedValue({
      ...authorization,
      data: { ...authorization.data, role: "meister" },
    });
    withTransaction.mockImplementation(async (_authorization, work) => work({ execute }));
  });

  it("rejects malformed input and non-cancellation roles before opening a transaction", async () => {
    const { cancelInvoice } = await import("../immutableInvoiceCommand");
    await expect(cancelInvoice({ ...validCancelInput, reason: "kurz" })).resolves.toMatchObject({ code: "VALIDATION_ERROR" });
    await expect(cancelInvoice({ ...validCancelInput, reason: ` ${validCancelInput.reason}` })).resolves.toMatchObject({ code: "VALIDATION_ERROR" });
    await expect(cancelInvoice({ ...validCancelInput, expectedVersion: 0 })).resolves.toMatchObject({ code: "VALIDATION_ERROR" });
    expect(withTransaction).not.toHaveBeenCalled();

    resolveAuthorization.mockResolvedValueOnce(authorization);
    await expect(cancelInvoice(validCancelInput)).resolves.toMatchObject({ code: "FORBIDDEN" });
    expect(withTransaction).not.toHaveBeenCalled();
  });

  it("replays only the exact immutable cancellation intent without a second write", async () => {
    execute.mockImplementation((query: { text: string }) => {
      if (query.text.includes("pg_advisory_xact_lock")) return Promise.resolve([]);
      if (query.text.includes("private.v_invoice_receipt_v1")) {
        return Promise.resolve([validCancellationReceiptRow]);
      }
      throw new Error(`unexpected SQL in cancellation replay: ${query.text}`);
    });
    const { cancelInvoice } = await import("../immutableInvoiceCommand");
    await expect(cancelInvoice(validCancelInput)).resolves.toEqual({
      code: "OK",
      replayed: true,
      receipt: {
        invoiceId: INVOICE,
        invoiceNumber: "R-2026-0007",
        orderId: ORDER,
        orderVersion: 3,
        status: "cancelled",
        reason: validCancelInput.reason,
        cancelledAt: "2026-08-21T09:00:00.000Z",
        cancelledBy: ACTOR,
        originalPdfSha256: PDF_SHA256,
        cancellationPdfRef: `invoice://${INVOICE}/cancellation`,
        cancellationPdfSha256: "b".repeat(64),
        eventId: EVENT,
        clientEventId: CLIENT,
        correlationId: CORRELATION,
        expectedVersion: 1,
        aggregateVersion: 2,
        eventSchemaVersion: 1,
      },
    });
    const sqlText = execute.mock.calls.map(([query]) => query.text).join("\n");
    expect(sqlText).not.toContain("UPDATE public.invoices");
    expect(renderToBuffer).not.toHaveBeenCalled();
  });

  it("rejects changed version or reason for the same cancellation client event id", async () => {
    execute.mockImplementation((query: { text: string }) => {
      if (query.text.includes("pg_advisory_xact_lock")) return Promise.resolve([]);
      if (query.text.includes("private.v_invoice_receipt_v1")) {
        return Promise.resolve([validCancellationReceiptRow]);
      }
      throw new Error(`unexpected SQL in cancellation intent test: ${query.text}`);
    });
    const { cancelInvoice } = await import("../immutableInvoiceCommand");
    await expect(cancelInvoice({ ...validCancelInput, expectedVersion: 2 })).resolves.toMatchObject({ code: "CONFLICT" });
    await expect(cancelInvoice({ ...validCancelInput, reason: "Anderer zulässiger Stornogrund" })).resolves.toMatchObject({ code: "CONFLICT" });
    const sqlText = execute.mock.calls.map(([query]) => query.text).join("\n");
    expect(sqlText).not.toContain("UPDATE public.invoices");
  });

  it.each([
    ["a one-cent partial payment", {
      payment_status: "teilbezahlt",
      payment_open_amount_cents: 11_899,
      payment_paid_amount_cents: 1,
      payment_method: "ueberweisung",
      payment_paid_at: "2026-09-16T08:00:00.000Z",
      payment_receipt_id: "receipt:partial",
      payment_event_id: EVENT,
      payment_correlation_id: CORRELATION,
      payment_version: 1,
    }],
    ["a full payment", {
      payment_status: "bezahlt",
      payment_open_amount_cents: 0,
      payment_paid_amount_cents: 11_900,
      payment_method: "bar",
      payment_paid_at: "2026-09-16T09:00:00.000Z",
      payment_receipt_id: "receipt:paid",
      payment_event_id: EVENT,
      payment_correlation_id: CORRELATION,
      payment_version: 1,
    }],
    ["an internally inconsistent payment state", {
      payment_contract_version: null,
    }],
  ])("fails closed before PDF, event or invoice mutation for %s", async (_label, paymentDelta) => {
    execute.mockImplementation((query: { text: string }) => {
      if (query.text.includes("pg_advisory_xact_lock")) return Promise.resolve([]);
      if (query.text.includes("private.v_invoice_receipt_v1")) return Promise.resolve([]);
      if (query.text.includes("SELECT id") && query.text.includes("FROM public.events")) {
        return Promise.resolve([]);
      }
      if (query.text.includes("FOR UPDATE OF orders")) {
        return Promise.resolve([{ id: ORDER, tenant_id: KREILE_TENANT_SLUG }]);
      }
      if (query.text.includes("FROM public.invoices") && query.text.includes("FOR UPDATE")) {
        return Promise.resolve([{ ...validLockedInvoice, ...paymentDelta }]);
      }
      throw new Error(`unexpected SQL in paid cancellation test: ${query.text}`);
    });

    const { cancelInvoice } = await import("../immutableInvoiceCommand");
    await expect(cancelInvoice(validCancelInput)).resolves.toEqual({
      code: "CONFLICT",
      message: "Die Rechnung kann nicht storniert werden, weil bereits eine Zahlung vorliegt oder der Zahlungsstand nicht eindeutig ist.",
    });

    const sqlText = execute.mock.calls.map(([query]) => query.text).join("\n");
    expect(sqlText).toContain("payment_status");
    expect(sqlText).toContain("payment_paid_amount_cents");
    expect(sqlText).toContain("payment_open_amount_cents");
    expect(sqlText).toContain("payment_version");
    expect(sqlText).toContain("FOR UPDATE");
    expect(sqlText).toContain("FOR UPDATE OF orders");
    expect(sqlText).not.toContain("INSERT INTO public.events");
    expect(sqlText).not.toContain("UPDATE public.invoices");
    expect(renderToBuffer).not.toHaveBeenCalled();
  });
});
