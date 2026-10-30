import "server-only";

import { sql } from "drizzle-orm";
import type { AuthorizationSnapshot } from "@/lib/server/authorization";
import { withPrivilegedTenantTransaction } from "@/lib/server/privilegedDb";

export type InvoiceTruthRow = {
  invoiceId: string;
  invoiceNumber: string;
  customerId: string;
  orderId: string;
  status: "issued" | "cancelled";
  netAmountCents: number;
  vatRateBasisPoints: number;
  vatAmountCents: number;
  grossAmountCents: number;
  dueDate: string;
  issuedAt: string;
  paymentStatus: "offen" | "teilbezahlt" | "bezahlt" | null;
  paidAmountCents: number;
  openAmountCents: number;
};

export type InvoiceTruthReadResult =
  | { code: "OK"; data: InvoiceTruthRow[] }
  | { code: "FORBIDDEN" | "VALIDATION_ERROR" | "UNAVAILABLE"; message: string };

type InvoiceTruthDbRow = {
  id: string;
  invoice_number: string;
  customer_id: string;
  order_id: string;
  status: string;
  net_amount_cents: number | string;
  vat_rate_basis_points: number | string;
  vat_amount_cents: number | string;
  gross_amount_cents: number | string;
  due_date: Date | string;
  issued_at: Date | string;
  payment_status: string | null;
  payment_paid_amount_cents: number | string | null;
  payment_open_amount_cents: number | string | null;
};

function cents(value: unknown, code: string): number {
  const parsed = typeof value === "number" ? value : Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < 0) throw new Error(code);
  return parsed;
}

function dateOnly(value: Date | string): string {
  const parsed = value instanceof Date ? value : new Date(value);
  if (!Number.isFinite(parsed.getTime())) throw new Error("INVOICE_TRUTH_DATE_INVALID");
  return parsed.toISOString().slice(0, 10);
}

function instant(value: Date | string): string {
  const parsed = value instanceof Date ? value : new Date(value);
  if (!Number.isFinite(parsed.getTime())) throw new Error("INVOICE_TRUTH_TIME_INVALID");
  return parsed.toISOString();
}

function mapRow(row: InvoiceTruthDbRow): InvoiceTruthRow {
  if (
    (row.status !== "issued" && row.status !== "cancelled")
    || (row.payment_status !== null && !["offen", "teilbezahlt", "bezahlt"].includes(row.payment_status))
  ) throw new Error("INVOICE_TRUTH_STATUS_INVALID");
  return {
    invoiceId: row.id,
    invoiceNumber: row.invoice_number,
    customerId: row.customer_id,
    orderId: row.order_id,
    status: row.status,
    netAmountCents: cents(row.net_amount_cents, "INVOICE_TRUTH_NET_INVALID"),
    vatRateBasisPoints: cents(row.vat_rate_basis_points, "INVOICE_TRUTH_RATE_INVALID"),
    vatAmountCents: cents(row.vat_amount_cents, "INVOICE_TRUTH_VAT_INVALID"),
    grossAmountCents: cents(row.gross_amount_cents, "INVOICE_TRUTH_GROSS_INVALID"),
    dueDate: dateOnly(row.due_date),
    issuedAt: instant(row.issued_at),
    paymentStatus: row.payment_status as InvoiceTruthRow["paymentStatus"],
    paidAmountCents: row.payment_paid_amount_cents === null ? 0 : cents(row.payment_paid_amount_cents, "INVOICE_TRUTH_PAID_INVALID"),
    openAmountCents: row.payment_open_amount_cents === null ? 0 : cents(row.payment_open_amount_cents, "INVOICE_TRUTH_OPEN_INVALID"),
  };
}

function validDate(value: unknown): value is string {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value);
}

export async function readInvoiceTruth(
  authorization: AuthorizationSnapshot,
  filter: { from?: string; to?: string; customerId?: string } = {},
): Promise<InvoiceTruthReadResult> {
  if (!authorization.permissions.includes("perm_view_prices")) {
    return { code: "FORBIDDEN", message: "Rechnungsdaten sind mit diesem Login nicht erlaubt." };
  }
  if (
    (filter.from !== undefined && !validDate(filter.from))
    || (filter.to !== undefined && !validDate(filter.to))
    || (filter.customerId !== undefined && (filter.customerId.trim() !== filter.customerId || filter.customerId.length < 1 || filter.customerId.length > 128))
  ) return { code: "VALIDATION_ERROR", message: "Rechnungsfilter ist ungültig." };

  try {
    const data = await withPrivilegedTenantTransaction(authorization, async (tx) => {
      const rows = await tx.execute<InvoiceTruthDbRow>(sql`
        SELECT invoice.id::text,
               invoice.invoice_number,
               invoice.customer_id,
               invoice.order_id,
               invoice.status,
               invoice.net_amount_cents,
               invoice.vat_rate_basis_points,
               invoice.vat_amount_cents,
               invoice.gross_amount_cents,
               invoice.due_date,
               invoice.issued_at,
               invoice.payment_status,
               invoice.payment_paid_amount_cents,
               invoice.payment_open_amount_cents
        FROM public.invoices invoice
        WHERE invoice.tenant_id = ${authorization.tenantId}
          AND invoice.status IN ('issued', 'cancelled')
          AND (${filter.from ?? null}::date IS NULL OR invoice.issued_at::date >= ${filter.from ?? null}::date)
          AND (${filter.to ?? null}::date IS NULL OR invoice.issued_at::date <= ${filter.to ?? null}::date)
          AND (${filter.customerId ?? null}::text IS NULL OR invoice.customer_id = ${filter.customerId ?? null})
        ORDER BY invoice.issued_at DESC, invoice.invoice_number DESC
        LIMIT 1001
      `);
      if (rows.length > 1000) throw new Error("INVOICE_TRUTH_LIMIT_EXCEEDED");
      return rows.map(mapRow);
    });
    return { code: "OK", data };
  } catch (error) {
    console.error("readInvoiceTruth database error", error);
    return { code: "UNAVAILABLE", message: "Rechnungsdaten konnten nicht sicher geladen werden." };
  }
}
