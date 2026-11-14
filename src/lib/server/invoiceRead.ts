import {mapInvoiceIssueReceipt,readCreateInvoiceReceipts,mapInvoiceCancellationReceipt,readCancellationInvoiceReceipts} from '@/lib/server/commands/immutableInvoiceCommand';
import type {InvoiceVatGroup,InvoiceVatReader} from '@/modules/accounting/public';
import {readInvoiceVat} from '@/modules/accounting/public';
import "server-only";

import { sql } from "drizzle-orm";
import type { AuthorizationSnapshot } from "@/lib/server/authorization";
import type {
  ImmutableInvoiceCancellationReceipt,
  ImmutableInvoiceReceipt,
} from "@/lib/server/commands/immutableInvoiceCommand";
import { withPrivilegedTenantTransaction } from "@/lib/server/privilegedDb";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const INVOICE_NUMBER_PATTERN = /^R-[0-9]{4}-[0-9]{4,}$/;
const HEX64_PATTERN = /^[a-f0-9]{64}$/;

export type ReadInvoiceReceiptInput = {
  orderId: string;
  clientEventId: string;
};

export type ReadInvoiceCancellationReceiptInput = {
  invoiceId: string;
  clientEventId: string;
};

export type ReadInvoiceReceiptResult =
  | { code: "OK"; data: ImmutableInvoiceReceipt | null }
  | { code: "FORBIDDEN"; message: string }
  | { code: "VALIDATION_ERROR"; message: string }
  | { code: "UNAVAILABLE"; message: string };

export type ReadInvoiceCancellationReceiptResult =
  | { code: "OK"; data: ImmutableInvoiceCancellationReceipt | null }
  | { code: "FORBIDDEN"; message: string }
  | { code: "VALIDATION_ERROR"; message: string }
  | { code: "UNAVAILABLE"; message: string };

export type InvoicePdfKind = "original" | "cancellation";

export type ReadInvoicePdfResult =
  | {
      code: "OK";
      data: {
        pdf: Buffer;
        invoiceNumber: string;
        pdfSha256: string;
        kind: InvoicePdfKind;
      };
    }
  | { code: "FORBIDDEN"; message: string }
  | { code: "NOT_FOUND"; message: string }
  | { code: "VALIDATION_ERROR"; message: string }
  | { code: "UNAVAILABLE"; message: string };

export type ImmutableInvoiceSummary = {
  invoiceId: string;
  invoiceNumber: string;
  orderId: string;
  orderNumber: string;
  customerId: string;
  customerName: string;
  status: "issued" | "cancelled";
  aggregateVersion: 1 | 2;
  orderVersion: number;
  netAmountCents: number;
  vatRateBasisPoints: number|null;
  vatGroups:InvoiceVatGroup[];
  vatAmountCents: number;
  grossAmountCents: number;
  serviceDate: string;
  dueDate: string;
  issuedAt: string;
  originalPdfRef: string;
  originalPdfSha256: string;
  cancelledAt: string | null;
  cancelledBy: string | null;
  cancelReason: string | null;
  cancellationPdfRef: string | null;
  cancellationPdfSha256: string | null;
};

export type ReadInvoiceSummariesResult =
  | { code: "OK"; data: ImmutableInvoiceSummary[] }
  | { code: "FORBIDDEN"; message: string }
  | { code: "UNAVAILABLE"; message: string };

type PdfRow = {
  id: string;
  tenant_id: string;
  invoice_number: string;
  status: string;
  pdf_sha256: string | null;
  pdf_content: Buffer | Uint8Array | null;
  integrity_ok: boolean;
};

type SummaryRow = {
  id: string;
  tenant_id: string;
  order_id: string;
  customer_id: string;
  invoice_number: string;
  status: string;
  net_amount_cents: number | string;
  vat_rate_basis_points: number | string | null;
  snapshot: unknown;
  vat_amount_cents: number | string;
  gross_amount_cents: number | string;
  service_date: Date | string;
  order_version: number | string;
  due_date: Date | string;
  issued_at: Date | string;
  aggregate_version: number | string;
  pdf_ref: string;
  pdf_sha256: string;
  cancelled_by: string | null;
  cancel_reason: string | null;
  cancelled_at: Date | string | null;
  cancellation_pdf_ref: string | null;
  cancellation_pdf_sha256: string | null;
  order_number: string;
  customer_name: string;
  integrity_ok: boolean;
};

function isReceiptInput(value: unknown): value is ReadInvoiceReceiptInput {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const input = value as Record<string, unknown>;
  const keys = Object.keys(input).sort();
  return keys.length === 2
    && keys[0] === "clientEventId"
    && keys[1] === "orderId"
    && typeof input.orderId === "string"
    && input.orderId.trim() === input.orderId
    && input.orderId.length >= 1
    && input.orderId.length <= 128
    && typeof input.clientEventId === "string"
    && UUID_PATTERN.test(input.clientEventId);
}

function isCancellationReceiptInput(value: unknown): value is ReadInvoiceCancellationReceiptInput {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const input = value as Record<string, unknown>;
  const keys = Object.keys(input).sort();
  return keys.length === 2
    && keys[0] === "clientEventId"
    && keys[1] === "invoiceId"
    && typeof input.invoiceId === "string"
    && UUID_PATTERN.test(input.invoiceId)
    && typeof input.clientEventId === "string"
    && UUID_PATTERN.test(input.clientEventId);
}

function canReadInvoices(authorization: AuthorizationSnapshot): boolean {
  return authorization.permissions.includes("perm_view_prices");
}

function isCanonicalTextId(value: unknown): value is string {
  return typeof value === "string"
    && value.trim() === value
    && value.length >= 1
    && value.length <= 128;
}

function toIso(value: unknown): string {
  const parsed = value instanceof Date ? value : new Date(value as string);
  if (!Number.isFinite(parsed.getTime())) throw new Error("INVOICE_READ_TIME_INVALID");
  return parsed.toISOString();
}

function toDateOnly(value: unknown): string {
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  if (typeof value === "string" && value.length >= 10) return value.slice(0, 10);
  throw new Error("INVOICE_READ_DATE_INVALID");
}

function toSafeInteger(value: unknown, error: string): number {
  const parsed = typeof value === "number" ? value : Number(value);
  if (!Number.isSafeInteger(parsed)) throw new Error(error);
  return parsed;
}

function mapSummary(row: SummaryRow, authorization: AuthorizationSnapshot,readVat:InvoiceVatReader): ImmutableInvoiceSummary {
  const aggregateVersion = toSafeInteger(row.aggregate_version, "INVOICE_SUMMARY_VERSION_INVALID");
  const orderVersion = toSafeInteger(row.order_version, "INVOICE_SUMMARY_ORDER_VERSION_INVALID");
  const {netAmountCents,vatAmountCents,grossAmountCents,headRate:vatRateBasisPoints,groups:vatGroups}=readVat(row);
  const commonValid = row.integrity_ok === true
    && row.tenant_id === authorization.tenantId
    && UUID_PATTERN.test(row.id)
    && isCanonicalTextId(row.order_id)
    && isCanonicalTextId(row.customer_id)
    && INVOICE_NUMBER_PATTERN.test(row.invoice_number)
    && row.pdf_ref === `invoice://${row.id}/original`
    && HEX64_PATTERN.test(row.pdf_sha256)
    && orderVersion > 0
    && netAmountCents >= 0
    && vatAmountCents >= 0
    && grossAmountCents === netAmountCents + vatAmountCents
    && row.order_number.trim().length > 0
    && row.customer_name.trim().length > 0;
  const issuedValid = row.status === "issued"
    && aggregateVersion === 1
    && row.cancelled_by === null
    && row.cancel_reason === null
    && row.cancelled_at === null
    && row.cancellation_pdf_ref === null
    && row.cancellation_pdf_sha256 === null;
  const cancelledValid = row.status === "cancelled"
    && aggregateVersion === 2
    && typeof row.cancelled_by === "string"
    && UUID_PATTERN.test(row.cancelled_by)
    && typeof row.cancel_reason === "string"
    && row.cancel_reason === row.cancel_reason.trim()
    && row.cancel_reason.length >= 5
    && row.cancel_reason.length <= 500
    && row.cancelled_at !== null
    && row.cancellation_pdf_ref === `invoice://${row.id}/cancellation`
    && typeof row.cancellation_pdf_sha256 === "string"
    && HEX64_PATTERN.test(row.cancellation_pdf_sha256);
  if (!commonValid || (!issuedValid && !cancelledValid)) {
    throw new Error("INVOICE_SUMMARY_INTEGRITY_INVALID");
  }

  return {
    invoiceId: row.id,
    invoiceNumber: row.invoice_number,
    orderId: row.order_id,
    orderNumber: row.order_number,
    customerId: row.customer_id,
    customerName: row.customer_name,
    status: row.status as "issued" | "cancelled",
    aggregateVersion: aggregateVersion as 1 | 2,
    orderVersion,
    netAmountCents,
    vatRateBasisPoints,
    vatGroups,
    vatAmountCents,
    grossAmountCents,
    serviceDate: toDateOnly(row.service_date),
    dueDate: toDateOnly(row.due_date),
    issuedAt: toIso(row.issued_at),
    originalPdfRef: row.pdf_ref,
    originalPdfSha256: row.pdf_sha256,
    cancelledAt: row.cancelled_at === null ? null : toIso(row.cancelled_at),
    cancelledBy: row.cancelled_by,
    cancelReason: row.cancel_reason,
    cancellationPdfRef: row.cancellation_pdf_ref,
    cancellationPdfSha256: row.cancellation_pdf_sha256,
  };
}

export async function readInvoiceReceipt(
  authorization: AuthorizationSnapshot,
  input: unknown,
  readVat?: InvoiceVatReader,
): Promise<ReadInvoiceReceiptResult> {
  if (!isReceiptInput(input)) {
    return { code: "VALIDATION_ERROR", message: "Ungültige Belegabfrage." };
  }
  if (!canReadInvoices(authorization)) {
    return { code: "FORBIDDEN", message: "Rechnungsbeleg ist mit dieser Rolle nicht erlaubt." };
  }
  try {
    const data = await withPrivilegedTenantTransaction(authorization, async (tx) => {
      const rows = await readCreateInvoiceReceipts(tx,input.clientEventId);
      if (rows.length > 1) throw new Error("INVOICE_READ_AMBIGUOUS");
      if(rows[0]&&rows[0].order_id!==input.orderId)throw Error('INVOICE_READ_ORDER_MISMATCH');
      return rows[0] ? mapInvoiceIssueReceipt(rows[0],authorization.tenantId,rows[0].actor_id,requireVat(readVat)) : null;
    });
    return { code: "OK", data };
  } catch {
    return { code: "UNAVAILABLE", message: "Rechnungsbeleg konnte nicht sicher geladen werden." };
  }
}

export async function readInvoiceCancellationReceipt(
  authorization: AuthorizationSnapshot,
  input: unknown,
): Promise<ReadInvoiceCancellationReceiptResult> {
  if (!isCancellationReceiptInput(input)) {
    return { code: "VALIDATION_ERROR", message: "Ungültige Stornobelegabfrage." };
  }
  if (!canReadInvoices(authorization)) {
    return { code: "FORBIDDEN", message: "Stornobeleg ist mit dieser Rolle nicht erlaubt." };
  }
  try {
    const data = await withPrivilegedTenantTransaction(authorization, async (tx) => {
      const rows=await readCancellationInvoiceReceipts(tx,input.clientEventId,input.invoiceId);
      if (rows.length > 1) throw new Error("INVOICE_CANCEL_READ_AMBIGUOUS");
      return rows[0] ? mapInvoiceCancellationReceipt(rows[0],authorization.tenantId,rows[0].actor_id) : null;
    });
    return { code: "OK", data };
  } catch {
    return { code: "UNAVAILABLE", message: "Stornobeleg konnte nicht sicher geladen werden." };
  }
}

export async function readInvoiceSummaries(
  authorization: AuthorizationSnapshot,
  readVat?:InvoiceVatReader,
): Promise<ReadInvoiceSummariesResult> {
  if (!canReadInvoices(authorization)) {
    return { code: "FORBIDDEN", message: "Rechnungsliste ist mit dieser Rolle nicht erlaubt." };
  }
  try {
    const data = await withPrivilegedTenantTransaction(authorization, async (tx) => {
      const rows = await tx.execute<SummaryRow>(sql`
        SELECT *
        FROM private.v_invoice_summary_v1
        ORDER BY issued_at DESC, invoice_number DESC
        LIMIT 250
      `);
      return rows.map((row) => mapSummary(row, authorization,requireVat(readVat)));
    });
    return { code: "OK", data };
  } catch {
    return { code: "UNAVAILABLE", message: "Rechnungsliste konnte nicht sicher geladen werden." };
  }
}

/** Returns exact persisted PDF bytes; no document is regenerated on read. */
export async function readInvoicePdf(
  authorization: AuthorizationSnapshot,
  invoiceId: string,
  kind: InvoicePdfKind = "original",
): Promise<ReadInvoicePdfResult> {
  if (typeof invoiceId !== "string" || !UUID_PATTERN.test(invoiceId)
    || (kind !== "original" && kind !== "cancellation")) {
    return { code: "VALIDATION_ERROR", message: "Ungültige Rechnungskennung oder Belegart." };
  }
  if (!canReadInvoices(authorization)) {
    return { code: "FORBIDDEN", message: "Rechnungs-PDF ist mit dieser Rolle nicht erlaubt." };
  }
  try {
    const result = await withPrivilegedTenantTransaction(authorization, async (tx) => {
      const rows = kind === "original"
        ? await tx.execute<PdfRow>(sql`
            SELECT
              invoice.id,
              invoice.tenant_id,
              invoice.invoice_number,
              invoice.status,
              invoice.pdf_sha256,
              invoice.pdf_content,
              encode(sha256(invoice.pdf_content), 'hex') = invoice.pdf_sha256 AS integrity_ok
            FROM public.invoices invoice
            WHERE invoice.id = ${invoiceId}::uuid
              AND invoice.tenant_id = ${authorization.tenantId}
              AND invoice.contract_version = 1
            LIMIT 2
          `)
        : await tx.execute<PdfRow>(sql`
            SELECT
              invoice.id,
              invoice.tenant_id,
              invoice.invoice_number,
              invoice.status,
              invoice.cancellation_pdf_sha256 AS pdf_sha256,
              invoice.cancellation_pdf_content AS pdf_content,
              invoice.status = 'cancelled'
                AND encode(sha256(invoice.cancellation_pdf_content), 'hex')
                  = invoice.cancellation_pdf_sha256 AS integrity_ok
            FROM public.invoices invoice
            WHERE invoice.id = ${invoiceId}::uuid
              AND invoice.tenant_id = ${authorization.tenantId}
              AND invoice.contract_version = 1
              AND invoice.status = 'cancelled'
            LIMIT 2
          `);
      if (rows.length > 1) throw new Error("INVOICE_READ_PDF_AMBIGUOUS");
      const row = rows[0];
      if (!row) return null;
      if (
        row.integrity_ok !== true
        || row.tenant_id !== authorization.tenantId
        || typeof row.pdf_sha256 !== "string"
        || !HEX64_PATTERN.test(row.pdf_sha256)
        || !row.pdf_content
        || !INVOICE_NUMBER_PATTERN.test(row.invoice_number)
        || (kind === "cancellation" && row.status !== "cancelled")
      ) throw new Error("INVOICE_READ_PDF_INVALID");
      const pdf = Buffer.isBuffer(row.pdf_content) ? row.pdf_content : Buffer.from(row.pdf_content);
      return { pdf, invoiceNumber: row.invoice_number, pdfSha256: row.pdf_sha256, kind };
    });
    if (!result) return { code: "NOT_FOUND", message: "Rechnung nicht verfügbar." };
    return { code: "OK", data: result };
  } catch {
    return { code: "UNAVAILABLE", message: "Rechnungs-PDF konnte nicht sicher geladen werden." };
  }
}

function requireVat(reader:InvoiceVatReader|undefined):InvoiceVatReader{return reader??readInvoiceVat;}
