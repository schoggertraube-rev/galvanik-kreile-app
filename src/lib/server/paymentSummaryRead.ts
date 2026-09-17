import "server-only";

import { sql } from "drizzle-orm";
import type { AuthorizationSnapshot } from "@/lib/server/authorization";
import {
  canReadPaymentSummary,
  mapOrderPaymentStateRow,
  mapPaymentSummaryRow,
  type OrderPaymentState,
  type OrderPaymentStateRow,
  type PaymentSummary,
  type PaymentSummaryRow,
} from "@/lib/server/paymentContract";
import {
  withPrivilegedTenantTransaction,
  type PrivilegedTenantTransaction,
} from "@/lib/server/privilegedDb";
import type { ConfirmPaymentReceipt } from "@/lib/server/commands/confirmPaymentCommand";

export type PaymentSummaryReadResult =
  | { code: "OK"; data: PaymentSummary[]; asOf: string }
  | { code: "FORBIDDEN"; message: string }
  | { code: "UNAVAILABLE"; message: string };

export type ReadOrderPaymentStateInput = { orderId: string };

export type OrderPaymentStateReadResult =
  | { code: "OK"; data: OrderPaymentState }
  | { code: "NOT_FOUND"; message: string }
  | { code: "FORBIDDEN"; message: string }
  | { code: "VALIDATION_ERROR"; message: string }
  | { code: "UNAVAILABLE"; message: string };

export type ReadPaymentReceiptInput = { invoiceId: string; clientEventId: string };

export type ReadPaymentReceiptResult =
  | { code: "OK"; data: ConfirmPaymentReceipt | null; asOf: string }
  | { code: "FORBIDDEN"; message: string }
  | { code: "VALIDATION_ERROR"; message: string }
  | { code: "UNAVAILABLE"; message: string };

const ORDER_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const INVOICE_NUMBER_PATTERN = /^R-[0-9]{4}-[0-9]{4,}$/;

type PaymentReceiptRow = {
  event_id: string;
  tenant_id: string;
  order_id: string;
  event_type: string;
  client_event_id: string;
  correlation_id: string;
  event_schema_version: number | string;
  aggregate_version: number | string;
  actor_id: string;
  occurred_at: string;
  status: string;
  station: string | null;
  from_station: string | null;
  payload: unknown;
  invoice_id: string;
  invoice_number: string;
  invoice_order_id: string;
  invoice_status: string;
  invoice_gross_amount_cents: number | string;
};

function safeNonNegativeInteger(value: unknown): number | null {
  if (typeof value !== "number" && typeof value !== "string") return null;
  if (typeof value === "string" && (value.length === 0 || value.trim() !== value)) return null;
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isSafeInteger(parsed) && parsed >= 0 && parsed <= 2_147_483_647 ? parsed : null;
}

function mapPaymentReceipt(row: PaymentReceiptRow, authorization: AuthorizationSnapshot): ConfirmPaymentReceipt {
  if (!row.payload || typeof row.payload !== "object" || Array.isArray(row.payload)) {
    throw new Error("PAYMENT_RECEIPT_PAYLOAD_INVALID");
  }
  const payload = row.payload as Record<string, unknown>;
  const expectedKeys = [
    "amountCents", "currency", "grossAmountCents", "invoiceId", "method", "occurredAt",
    "openAmountCents", "orderId", "paidAmountCents", "paymentMode", "paymentStatus",
    "paymentVersion", "receiptId", "source",
  ];
  const actualKeys = Object.keys(payload).sort();
  const amountCents = safeNonNegativeInteger(payload.amountCents);
  const grossAmountCents = safeNonNegativeInteger(payload.grossAmountCents);
  const paidAmountCents = safeNonNegativeInteger(payload.paidAmountCents);
  const openAmountCents = safeNonNegativeInteger(payload.openAmountCents);
  const paymentVersion = safeNonNegativeInteger(payload.paymentVersion);
  const invoiceGross = safeNonNegativeInteger(row.invoice_gross_amount_cents);
  if (
    row.tenant_id !== authorization.tenantId
    || row.event_type !== "PAYMENT_CONFIRMED_V1"
    || row.status !== "success"
    || row.station !== null
    || row.from_station !== null
    || safeNonNegativeInteger(row.event_schema_version) !== 1
    || safeNonNegativeInteger(row.aggregate_version) !== paymentVersion
    || !UUID_PATTERN.test(row.event_id)
    || !UUID_PATTERN.test(row.client_event_id)
    || !UUID_PATTERN.test(row.correlation_id)
    || !UUID_PATTERN.test(row.actor_id)
    || !UUID_PATTERN.test(row.invoice_id)
    || !INVOICE_NUMBER_PATTERN.test(row.invoice_number)
    || row.invoice_status !== "issued"
    || row.order_id !== row.invoice_order_id
    || actualKeys.length !== expectedKeys.length
    || !actualKeys.every((key, index) => key === expectedKeys[index])
    || payload.invoiceId !== row.invoice_id
    || payload.orderId !== row.order_id
    || typeof payload.receiptId !== "string"
    || payload.receiptId.trim() !== payload.receiptId
    || payload.receiptId.length < 1
    || payload.receiptId.length > 200
    || amountCents === null || amountCents <= 0
    || grossAmountCents === null || grossAmountCents <= 0 || grossAmountCents !== invoiceGross
    || paidAmountCents === null || paidAmountCents <= 0
    || openAmountCents === null
    || paymentVersion === null || paymentVersion <= 0
    || amountCents > paidAmountCents
    || paidAmountCents + openAmountCents !== grossAmountCents
    || payload.currency !== "EUR"
    || (payload.paymentMode !== "vorkasse" && payload.paymentMode !== "abholung" && payload.paymentMode !== "rechnung")
    || (payload.paymentStatus !== "teilbezahlt" && payload.paymentStatus !== "bezahlt")
    || (payload.paymentStatus === "teilbezahlt" && (openAmountCents <= 0 || paidAmountCents >= grossAmountCents))
    || (payload.paymentStatus === "bezahlt" && (openAmountCents !== 0 || paidAmountCents !== grossAmountCents))
    || (payload.method !== "bar" && payload.method !== "ueberweisung" && payload.method !== "karte")
    || payload.source !== "manual"
    || typeof payload.occurredAt !== "string"
    || payload.occurredAt !== row.occurred_at
    || !Number.isFinite(new Date(payload.occurredAt).getTime())
  ) throw new Error("PAYMENT_RECEIPT_INVALID");
  return {
    eventId: row.event_id,
    invoiceId: row.invoice_id,
    invoiceNumber: row.invoice_number,
    orderId: row.order_id,
    receiptId: payload.receiptId,
    clientEventId: row.client_event_id,
    correlationId: row.correlation_id,
    eventSchemaVersion: 1,
    expectedVersion: paymentVersion - 1,
    paymentVersion,
    amountCents,
    grossAmountCents,
    paidAmountCents,
    openAmountCents,
    currency: "EUR",
    paymentMode: payload.paymentMode,
    paymentStatus: payload.paymentStatus,
    method: payload.method,
    confirmedAt: payload.occurredAt,
    confirmedBy: row.actor_id,
    source: "manual",
  };
}

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

async function readAuthoritativeAsOf(tx: PrivilegedTenantTransaction): Promise<string> {
  const rows = await tx.execute<{ read_as_of: string }>(sql`
    SELECT to_char(statement_timestamp() AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') AS read_as_of
  `);
  if (rows.length !== 1 || !rows[0]) throw new Error("PAYMENT_READ_CLOCK_INVALID");
  const parsed = new Date(rows[0].read_as_of);
  if (!Number.isFinite(parsed.getTime()) || parsed.toISOString() !== rows[0].read_as_of) {
    throw new Error("PAYMENT_READ_CLOCK_NON_CANONICAL");
  }
  return rows[0].read_as_of;
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
      const data = rows.map((row) => mapPaymentSummaryRow(row, authorization));
      return { data, asOf: await readAuthoritativeAsOf(tx) };
    });
    return { code: "OK", data: data.data, asOf: data.asOf };
  } catch (error) {
    logReadFailure("readPaymentSummary database error", error);
    return { code: "UNAVAILABLE", message: "Zahlungsübersicht konnte nicht sicher geladen werden." };
  }
}

export async function readPaymentReceipt(
  authorization: AuthorizationSnapshot,
  input: unknown,
): Promise<ReadPaymentReceiptResult> {
  if (
    !input || typeof input !== "object" || Array.isArray(input)
    || Object.keys(input).sort().join(",") !== "clientEventId,invoiceId"
    || typeof (input as { invoiceId?: unknown }).invoiceId !== "string"
    || !UUID_PATTERN.test((input as { invoiceId: string }).invoiceId)
    || typeof (input as { clientEventId?: unknown }).clientEventId !== "string"
    || !UUID_PATTERN.test((input as { clientEventId: string }).clientEventId)
  ) return { code: "VALIDATION_ERROR", message: "Ungültige Abfrage des technischen Ausführungsnachweises der Zahlung." };
  if (!canReadPaymentSummary(authorization)) {
    return { code: "FORBIDDEN", message: "Der technische Ausführungsnachweis der Zahlung ist mit dieser Rolle nicht erlaubt." };
  }
  const query = input as ReadPaymentReceiptInput;
  try {
    const data = await withPrivilegedTenantTransaction(authorization, async (tx) => {
      const rows = await tx.execute<PaymentReceiptRow>(sql`
        SELECT
          event.id AS event_id,
          event.tenant_id,
          event.order_id,
          event.event_type,
          event.client_event_id::text,
          event.correlation_id::text,
          event.event_schema_version,
          event.aggregate_version,
          event.user_id::text AS actor_id,
          to_char(event.created_at, 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') AS occurred_at,
          event.status,
          event.station,
          event.from_station,
          event.payload,
          invoice.id::text AS invoice_id,
          invoice.invoice_number,
          invoice.order_id AS invoice_order_id,
          invoice.status AS invoice_status,
          invoice.gross_amount_cents AS invoice_gross_amount_cents
        FROM public.events event
        JOIN public.invoices invoice
          ON invoice.tenant_id = event.tenant_id
         AND invoice.id::text = event.payload->>'invoiceId'
        WHERE event.tenant_id = ${authorization.tenantId}
          AND event.client_event_id = ${query.clientEventId}::uuid
          AND event.event_type = 'PAYMENT_CONFIRMED_V1'
          AND invoice.id = ${query.invoiceId}::uuid
        LIMIT 2
      `);
      if (rows.length > 1) throw new Error("PAYMENT_RECEIPT_AMBIGUOUS");
      const data = rows[0] ? mapPaymentReceipt(rows[0], authorization) : null;
      return { data, asOf: await readAuthoritativeAsOf(tx) };
    });
    return { code: "OK", data: data.data, asOf: data.asOf };
  } catch (error) {
    logReadFailure("readPaymentReceipt database error", error);
    return { code: "UNAVAILABLE", message: "Der technische Ausführungsnachweis der Zahlung konnte nicht sicher geladen werden." };
  }
}

export async function readOrderPaymentState(
  authorization: AuthorizationSnapshot,
  input: unknown,
): Promise<OrderPaymentStateReadResult> {
  if (
    !input
    || typeof input !== "object"
    || Array.isArray(input)
    || Object.keys(input).length !== 1
    || typeof (input as { orderId?: unknown }).orderId !== "string"
    || !ORDER_ID_PATTERN.test((input as { orderId: string }).orderId)
  ) {
    return { code: "VALIDATION_ERROR", message: "Ungültige Zahlungsabfrage." };
  }
  if (!canReadPaymentSummary(authorization)) {
    return { code: "FORBIDDEN", message: "Zahlungs- und Warenausgangsdaten sind mit dieser Rolle nicht erlaubt." };
  }

  const orderId = (input as ReadOrderPaymentStateInput).orderId;
  try {
    const data = await withPrivilegedTenantTransaction(authorization, async (tx) => {
      const rows = await tx.execute<OrderPaymentStateRow>(sql`
        SELECT *
        FROM private.v_goods_out_ui_state_v1
        WHERE order_id = ${orderId}
        LIMIT 2
      `);
      if (rows.length === 0) return null;
      if (rows.length !== 1 || !rows[0]) throw new Error("ORDER_PAYMENT_STATE_AMBIGUOUS");
      return mapOrderPaymentStateRow(rows[0], authorization);
    });
    return data
      ? { code: "OK", data }
      : { code: "NOT_FOUND", message: "Zahlungs- und Warenausgangsdaten sind nicht verfügbar." };
  } catch (error) {
    logReadFailure("readOrderPaymentState database error", error);
    return { code: "UNAVAILABLE", message: "Zahlungs- und Warenausgangsdaten konnten nicht sicher geladen werden." };
  }
}
