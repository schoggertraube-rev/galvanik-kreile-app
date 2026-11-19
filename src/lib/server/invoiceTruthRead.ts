import type {InvoiceVatGroup,InvoiceVatReader} from '@/modules/accounting/public';
import {parseInvoiceCollectionOriginal,type InvoiceCollectionOriginal} from '@/lib/domain/invoiceCollectionContract';
import "server-only";
import {classifyOverdue} from "./paymentContract";
import {berlinCalendarDay} from "@/lib/domain/workingDays";

import { sql } from "drizzle-orm";
import type { AuthorizationSnapshot } from "@/lib/server/authorization";
import { withPrivilegedTenantTransaction } from "@/lib/server/privilegedDb";

type InvoiceTruthSource={orderId:string;collection?:never}|{orderId:null;collection:InvoiceCollectionOriginal};
export type InvoiceTruthRow = InvoiceTruthSource & {
  invoiceId: string;
  invoiceNumber: string;
  customerId: string;
  customerName:string|null;
  status: "issued" | "cancelled";
  netAmountCents: number;
  vatRateBasisPoints: number|null;
  vatGroups:InvoiceVatGroup[];
  vatAmountCents: number;
  grossAmountCents: number;
  dueDate: string;
  overdue: boolean;
  overdueAsOf: string;
  overdueDays:number;
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
  order_id: string|null;
  status: string;
  net_amount_cents: number | string;
  vat_rate_basis_points: number | string | null;
  snapshot:unknown;
  vat_amount_cents: number | string;
  gross_amount_cents: number | string;
  due_date: Date | string;
  overdue: boolean;
  overdue_as_of: string;
  overdue_days:number;
  issued_at: Date | string;
  payment_status: string | null;
  payment_paid_amount_cents: number | string | null;
  payment_open_amount_cents: number | string | null;
};

function cents(value: unknown, code: string): number {
  const parsed = typeof value === "number" ? value : Number(value);
  if (value===null||value===undefined||!Number.isSafeInteger(parsed) || parsed < 0) throw new Error(code);
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

function mapRow(row: InvoiceTruthDbRow,readVat:InvoiceVatReader): InvoiceTruthRow {
  if(typeof row.overdue!=="boolean"||!validDate(row.overdue_as_of))throw Error("INVOICE_TRUTH_OVERDUE_SOURCE_INVALID");
  if(!Number.isSafeInteger(row.overdue_days)||row.overdue_days<0||(row.overdue?row.overdue_days<1:row.overdue_days!==0))throw Error("INVOICE_TRUTH_OVERDUE_DAY_INVALID");
  const snapshot=row.snapshot as {customer?:{name?:unknown};collection?:unknown};
  const name=snapshot?.customer?.name;
  // One fiscal row; native collections expose all frozen members, never a representative order.
  const source:InvoiceTruthSource=row.order_id===null
    ?{orderId:null,collection:parseInvoiceCollectionOriginal(snapshot?.collection)}
    :{orderId:row.order_id};
  const vat=readVat(row);
  if (
    (row.status !== "issued" && row.status !== "cancelled")
    || (row.payment_status !== null && !["offen", "teilbezahlt", "bezahlt"].includes(row.payment_status))
  ) throw new Error("INVOICE_TRUTH_STATUS_INVALID");
  return {
    invoiceId: row.id,
    invoiceNumber: row.invoice_number,
    customerId: row.customer_id,
    customerName:typeof name==='string'&&name.trim()?name:null,
    ...source,
    status: row.status,
    netAmountCents:vat.netAmountCents,
    vatRateBasisPoints:vat.headRate,
    vatGroups:vat.groups,
    vatAmountCents:vat.vatAmountCents,
    grossAmountCents:vat.grossAmountCents,
    dueDate: dateOnly(row.due_date),
    overdue: row.overdue,
    overdueAsOf: row.overdue_as_of,
    overdueDays:row.overdue_days,
    issuedAt: instant(row.issued_at),
    paymentStatus: row.payment_status as InvoiceTruthRow["paymentStatus"],
    paidAmountCents: cents(row.payment_paid_amount_cents, "INVOICE_TRUTH_PAID_INVALID"),
    openAmountCents: cents(row.payment_open_amount_cents, "INVOICE_TRUTH_OPEN_INVALID"),
  };
}

function validDate(value: unknown): value is string {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value);
}

export async function readInvoiceTruth(
  authorization: AuthorizationSnapshot,
  filter: { from?: string; to?: string; customerId?: string } = {},
  readVat?:InvoiceVatReader,
  readDay=berlinCalendarDay(),
): Promise<InvoiceTruthReadResult> {
  if (!authorization.permissions.includes("perm_view_prices")) {
    return { code: "FORBIDDEN", message: "Rechnungsdaten sind mit diesem Login nicht erlaubt." };
  }
  if (
    !validDate(readDay)||!filter||typeof filter!=='object'||Array.isArray(filter)
    ||Object.keys(filter).some(key=>!['from','to','customerId'].includes(key))
    ||(filter.from !== undefined && !validDate(filter.from))
    || (filter.to !== undefined && !validDate(filter.to))
    || (filter.customerId !== undefined && (typeof filter.customerId!=="string" || filter.customerId.trim() !== filter.customerId || filter.customerId.length < 1 || filter.customerId.length > 128))
  ) return { code: "VALIDATION_ERROR", message: "Rechnungsfilter ist ungültig." };

  try {
    const data = await withPrivilegedTenantTransaction(authorization, async (tx) => {
      const rows = await tx.execute<InvoiceTruthDbRow>(sql`
        SELECT invoice.id::text,
               invoice.invoice_number,
               invoice.customer_id,
               invoice.order_id,
               invoice.status,
               invoice.snapshot,
               invoice.net_amount_cents,
               invoice.vat_rate_basis_points,
               invoice.vat_amount_cents,
               invoice.gross_amount_cents,
               invoice.due_date,
               ${classifyOverdue(readDay)} AS overdue,
               ${readDay}::text AS overdue_as_of,
               CASE WHEN ${classifyOverdue(readDay)} THEN ${readDay}::date-invoice.due_date ELSE 0 END AS overdue_days,
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
      return rows.map(row=>{if(!readVat)throw Error("INVOICE_VAT_READER_REQUIRED");return mapRow(row,readVat);});
    });
    return { code: "OK", data };
  } catch (error) {
    console.error("readInvoiceTruth database error", error);
    return { code: "UNAVAILABLE", message: "Rechnungsdaten konnten nicht sicher geladen werden." };
  }
}
