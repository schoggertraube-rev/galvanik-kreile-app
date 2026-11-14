import {formatEuro} from '@/lib/domain/formatEuro';
import "server-only";
import {readOpenOrderComplaint} from './orderReleaseRead';

import { sql } from "drizzle-orm";
import type { AuthorizationSnapshot } from "@/lib/server/authorization";
import {
  canReadPaymentSummary,
  mapOrderPaymentStateRow,
  mapPaymentSummaryRow,
  overdueInvoiceCondition,
  type OrderPaymentState,
  type OrderPaymentStateRow,
  type PaymentSummary,
  type PaymentSummaryRow,
} from "@/lib/server/paymentContract";
import { withPrivilegedTenantTransaction,withTenantSavepoint,type PrivilegedTenantTransaction } from "@/lib/server/privilegedDb";
import type {CustomerCreditResult,CustomerCreditApplicationRead} from '@/modules/accounting/public';
import {CUSTOMER_CREDIT_COPY} from '@/ui/situationCatalog';

export type PaymentSummaryReadResult =
  | { code: "OK"; data: PaymentSummary[] }
  | { code: "FORBIDDEN"; message: string }
  | { code: "UNAVAILABLE"; message: string };

export type OrderPaymentStateReadResult =
  | { code: "OK"; data: OrderPaymentState & {creditApplication?:CustomerCreditApplicationRead;complaintHold:{blocked:boolean;reason:'open_complaint';complaintIds:string[]};customerDeliveryBlock:{blocked:boolean;reason:'overdue_invoice';invoiceIds:string[]}} }
  | { code: "NOT_FOUND"; message: string }
  | { code: "FORBIDDEN"; message: string }
  | { code: "VALIDATION_ERROR"; message: string }
  | { code: "UNAVAILABLE"; message: string };

const ORDER_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/;

function readDiagnostic(error: unknown, key: "message" | "details" | "hint"): string | null {
  if (!error || typeof error !== "object") return null;
  const value = (error as Record<string, unknown>)[key];
  return typeof value === "string" && value.trim() ? value.slice(0, 500) : null;
}

function logReadFailure(label: string, error: unknown): void {
  console.error(label, {
    message: readDiagnostic(error, "message"),
    details: readDiagnostic(error, "details"),
    hint: readDiagnostic(error, "hint"),
  });
}

export async function readPaymentSummary(
  authorization: AuthorizationSnapshot,
): Promise<PaymentSummaryReadResult> {
  if (!canReadPaymentSummary(authorization)) {
    return { code: "FORBIDDEN", message: "Zahlungsübersicht ist mit dieser Rolle nicht erlaubt." };
  }

  try {
    const data = await withPrivilegedTenantTransaction(authorization, async (tx) => {
      const rows = await tx.execute<PaymentSummaryRow>(sql`
        SELECT *
        FROM private.v_payment_summary_v1
        ORDER BY invoice_number DESC NULLS LAST, invoice_id
        LIMIT 251
      `);
      if (rows.length > 250) throw new Error("PAYMENT_SUMMARY_AMBIGUOUS");
      return rows.map((row) => mapPaymentSummaryRow(row, authorization));
    });
    return { code: "OK", data };
  } catch (error) {
    logReadFailure("readPaymentSummary database error", error);
    return { code: "UNAVAILABLE", message: "Zahlungsübersicht konnte nicht sicher geladen werden." };
  }
}

export async function getPaymentState(
  authorization: AuthorizationSnapshot,
  orderId: unknown,
  readCredit?:(tx:PrivilegedTenantTransaction,tenantId:string,customerId:string)=>Promise<CustomerCreditResult>,
): Promise<OrderPaymentStateReadResult> {
  if (
    typeof orderId !== "string"
    || !ORDER_ID_PATTERN.test(orderId)
  ) {
    return { code: "VALIDATION_ERROR", message: "Ungültige Zahlungsabfrage." };
  }
  if (!canReadPaymentSummary(authorization)) {
    return { code: "FORBIDDEN", message: "Zahlungs- und Warenausgangsdaten sind mit dieser Rolle nicht erlaubt." };
  }

  try {
    const data = await withPrivilegedTenantTransaction(authorization, async (tx) => {
      const rows = await tx.execute<OrderPaymentStateRow & { credit_customer_id:string;customer_overdue_invoice_ids: string[] }>(sql`
        SELECT state.*, parent.customer_id AS credit_customer_id, ARRAY (
          SELECT invoice.id::text FROM public.invoices invoice
          JOIN public.orders orders
            ON orders.tenant_id = invoice.tenant_id
            AND orders.customer_id = invoice.customer_id
          WHERE orders.tenant_id = state.tenant_id
            AND orders.id = state.order_id
            AND ${overdueInvoiceCondition()}
          ORDER BY invoice.due_date,invoice.id
        ) AS customer_overdue_invoice_ids
        FROM private.v_goods_out_ui_state_v1 state
        JOIN public.orders parent ON parent.tenant_id=state.tenant_id AND parent.id=state.order_id
        WHERE state.order_id = ${orderId}
        LIMIT 2
      `);
      if (rows.length === 0) return null;
      if (rows.length !== 1 || !rows[0]) throw new Error("ORDER_PAYMENT_STATE_AMBIGUOUS");
      if (!Array.isArray(rows[0].customer_overdue_invoice_ids) || rows[0].customer_overdue_invoice_ids.some(id=>typeof id!=='string'||!/^[0-9a-f-]{36}$/.test(id))) throw new Error("ORDER_CUSTOMER_DEBT_STATE_INVALID");
      const mapped = mapOrderPaymentStateRow(rows[0], authorization);
      const complaint=await readOpenOrderComplaint(tx,authorization.tenantId,mapped.orderId);
      let creditApplication:CustomerCreditApplicationRead|undefined;
      if(readCredit){
        try{creditApplication=await withTenantSavepoint(tx,async nested=>{
          const source=await readCredit(nested,authorization.tenantId,rows[0].credit_customer_id);
          if(source.code!=='OK')return {code:'SOURCE_INCOMPLETE' as const};
          const payment=mapped.payment,amount=payment?Math.min(source.credit.balanceCents,payment.openAmountCents):0;
          return {code:'OK' as const,credit:source.credit,proposal:payment&&amount>0?{label:CUSTOMER_CREDIT_COPY.applyLabel(formatEuro(amount),payment.invoiceNumber),command:'credit.apply' as const,input:{invoiceId:payment.invoiceId,amount,expectedVersion:payment.paymentVersion,expectedOpenAmountCents:payment.openAmountCents,expectedCreditVersion:source.credit.version}}:null};
        });}catch{creditApplication={code:'SOURCE_INCOMPLETE'};}
      }
      return { ...mapped,...(creditApplication?{creditApplication}:{}),complaintHold:{blocked:complaint!==null,reason:'open_complaint' as const,complaintIds:complaint?.complaintIds??[]}, customerDeliveryBlock:{blocked:rows[0].payment_mode!=="keiner"&&rows[0].customer_overdue_invoice_ids.length>0,reason:'overdue_invoice' as const,invoiceIds:rows[0].customer_overdue_invoice_ids} };
    });
    return data
      ? { code: "OK", data }
      : { code: "NOT_FOUND", message: "Zahlungs- und Warenausgangsdaten sind nicht verfügbar." };
  } catch (error) {
    logReadFailure("getPaymentState database error", error);
    return { code: "UNAVAILABLE", message: "Zahlungs- und Warenausgangsdaten konnten nicht sicher geladen werden." };
  }
}
