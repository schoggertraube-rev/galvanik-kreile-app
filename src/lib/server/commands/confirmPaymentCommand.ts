import "server-only";

import { randomUUID } from "node:crypto";
import { sql } from "drizzle-orm";
import {
  isPaymentMode,
  type PaymentMethod,
  type PaymentMode,
  type PaymentStatus,
} from "@/lib/server/paymentContract";
import { resolveAuthorization } from "@/lib/server/authorization";
import { KREILE_TENANT_SLUG } from "@/lib/tenant";
import {
  withPrivilegedTenantTransaction,
  type PrivilegedTenantTransaction,
} from "@/lib/server/privilegedDb";

const EVENT_TYPE = "PAYMENT_CONFIRMED_V1" as const;
const EVENT_SCHEMA_VERSION = 1 as const;
const PAYMENT_CONTRACT_VERSION = 1 as const;
const PAYMENT_CURRENCY = "EUR" as const;
const PAYMENT_SOURCE = "manual" as const;
const PAYMENT_ROLES = ["buero", "meister", "admin"] as const;
const MAX_INT4 = 2_147_483_647;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const INVOICE_NUMBER_PATTERN = /^R-[0-9]{4}-[0-9]{4,}$/;
const ISO_INSTANT_PATTERN = /^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}\.[0-9]{3}Z$/;

export type ConfirmPaymentInput = {
  invoiceId: string;
  /** Positive integer amount in euro cents. */
  amount: number;
  method: PaymentMethod;
  expectedVersion: number;
  clientEventId: string;
};

export type ConfirmPaymentReceipt = {
  eventId: string;
  invoiceId: string;
  invoiceNumber: string;
  orderId: string;
  receiptId: string;
  clientEventId: string;
  correlationId: string;
  eventSchemaVersion: 1;
  expectedVersion: number;
  paymentVersion: number;
  amountCents: number;
  grossAmountCents: number;
  paidAmountCents: number;
  openAmountCents: number;
  currency: "EUR";
  paymentMode: PaymentMode;
  paymentStatus: Exclude<PaymentStatus, "offen">;
  method: PaymentMethod;
  confirmedAt: string;
  confirmedBy: string;
  source: "manual";
};

export type ConfirmPaymentResult =
  | { code: "OK"; receipt: ConfirmPaymentReceipt; replayed: boolean }
  | { code: "UNAUTHENTICATED"; message: string }
  | { code: "FORBIDDEN"; message: string }
  | { code: "NOT_FOUND"; message: string }
  | { code: "CONFLICT"; message: string }
  | { code: "VALIDATION_ERROR"; message: string }
  | { code: "UNAVAILABLE"; message: string };

type LockedInvoice = {
  id: string;
  tenant_id: string;
  order_id: string;
  invoice_number: string;
  status: string;
  gross_amount_cents: number | string | null;
  payment_contract_version: number | string | null;
  payment_mode: string | null;
  payment_status: string | null;
  payment_open_amount_cents: number | string | null;
  payment_paid_amount_cents: number | string | null;
  payment_currency: string | null;
  payment_method: string | null;
  payment_paid_at: Date | string | null;
  payment_receipt_id: string | null;
  payment_event_id: string | null;
  payment_correlation_id: string | null;
  payment_version: number | string | null;
};

type LockedPaymentOrder = {
  id: string;
  tenant_id: string;
  payment_mode: string;
  payment_mode_version: number | string;
};

type PaymentEventRow = {
  event_id: string;
  tenant_id: string | null;
  order_id: string | null;
  event_type: string;
  client_event_id: string | null;
  correlation_id: string | null;
  event_schema_version: number | string | null;
  aggregate_version: number | string | null;
  actor_id: string | null;
  occurred_at: Date | string | null;
  status: string | null;
  station: string | null;
  from_station: string | null;
  payload: unknown;
};

type ParsedInvoiceState = {
  grossAmountCents: number;
  paidAmountCents: number;
  openAmountCents: number;
  paymentVersion: number;
  mode: PaymentMode;
  status: PaymentStatus;
  method: PaymentMethod | null;
  paidAt: string | null;
};

type PaymentEventData = Omit<ConfirmPaymentReceipt, "invoiceNumber">;

function isPaymentMethod(value: unknown): value is PaymentMethod {
  return value === "bar" || value === "ueberweisung" || value === "karte";
}

function isSettledPaymentStatus(value: unknown): value is Exclude<PaymentStatus, "offen"> {
  return value === "teilbezahlt" || value === "bezahlt";
}

function isCanonicalTextId(value: unknown, maxLength = 128): value is string {
  return typeof value === "string"
    && value.trim() === value
    && value.length >= 1
    && value.length <= maxLength;
}

function toSafeInteger(value: unknown): number | null {
  if (typeof value !== "number" && typeof value !== "string") return null;
  if (typeof value === "string" && (value.length === 0 || value.trim() !== value)) return null;
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isSafeInteger(parsed) && parsed >= 0 && parsed <= MAX_INT4 ? parsed : null;
}

function toIsoInstant(value: unknown): string | null {
  if (!(value instanceof Date) && typeof value !== "string") return null;
  const parsed = value instanceof Date ? value : new Date(value);
  if (!Number.isFinite(parsed.getTime())) return null;
  return parsed.toISOString();
}

function isValidInput(input: unknown): input is ConfirmPaymentInput {
  if (!input || typeof input !== "object" || Array.isArray(input)) return false;
  const value = input as Record<string, unknown>;
  const expectedKeys = ["amount", "clientEventId", "expectedVersion", "invoiceId", "method"];
  const actualKeys = Object.keys(value).sort();
  return actualKeys.length === expectedKeys.length
    && actualKeys.every((key, index) => key === expectedKeys[index])
    && typeof value.invoiceId === "string"
    && UUID_PATTERN.test(value.invoiceId)
    && typeof value.clientEventId === "string"
    && UUID_PATTERN.test(value.clientEventId)
    && typeof value.amount === "number"
    && Number.isSafeInteger(value.amount)
    && value.amount > 0
    && value.amount <= MAX_INT4
    && typeof value.expectedVersion === "number"
    && Number.isSafeInteger(value.expectedVersion)
    && value.expectedVersion >= 0
    && value.expectedVersion < MAX_INT4
    && isPaymentMethod(value.method);
}

function parseInvoiceState(invoice: LockedInvoice, tenantId: string): ParsedInvoiceState | null {
  const grossAmountCents = toSafeInteger(invoice.gross_amount_cents);
  const paidAmountCents = toSafeInteger(invoice.payment_paid_amount_cents);
  const openAmountCents = toSafeInteger(invoice.payment_open_amount_cents);
  const paymentVersion = toSafeInteger(invoice.payment_version);
  const paidAt = invoice.payment_paid_at === null ? null : toIsoInstant(invoice.payment_paid_at);
  const mode = invoice.payment_mode;
  const status = invoice.payment_status;
  const method = invoice.payment_method;

  if (
    invoice.tenant_id !== tenantId
    || !UUID_PATTERN.test(invoice.id)
    || !isCanonicalTextId(invoice.order_id)
    || !INVOICE_NUMBER_PATTERN.test(invoice.invoice_number)
    || toSafeInteger(invoice.payment_contract_version) !== PAYMENT_CONTRACT_VERSION
    || grossAmountCents === null
    || grossAmountCents <= 0
    || paidAmountCents === null
    || openAmountCents === null
    || paymentVersion === null
    || paidAmountCents + openAmountCents !== grossAmountCents
    || !isPaymentMode(mode)
    || (status !== "offen" && !isSettledPaymentStatus(status))
    || invoice.payment_currency !== PAYMENT_CURRENCY
  ) return null;

  const openStateValid = status === "offen"
    && paidAmountCents === 0
    && openAmountCents === grossAmountCents
    && paymentVersion === 0
    && method === null
    && paidAt === null
    && invoice.payment_receipt_id === null
    && invoice.payment_event_id === null
    && invoice.payment_correlation_id === null;
  const settledStateValid = isSettledPaymentStatus(status)
    && paidAmountCents > 0
    && paymentVersion > 0
    && isPaymentMethod(method)
    && paidAt !== null
    && isCanonicalTextId(invoice.payment_receipt_id, 200)
    && typeof invoice.payment_event_id === "string"
    && UUID_PATTERN.test(invoice.payment_event_id)
    && typeof invoice.payment_correlation_id === "string"
    && UUID_PATTERN.test(invoice.payment_correlation_id)
    && (
      (status === "teilbezahlt" && openAmountCents > 0 && paidAmountCents < grossAmountCents)
      || (status === "bezahlt" && openAmountCents === 0 && paidAmountCents === grossAmountCents)
    );

  if (!openStateValid && !settledStateValid) return null;
  return {
    grossAmountCents,
    paidAmountCents,
    openAmountCents,
    paymentVersion,
    mode,
    status,
    method: method === null ? null : method,
    paidAt,
  };
}

function parsePaymentEvent(row: PaymentEventRow, tenantId: string): PaymentEventData {
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
  const amountCents = toSafeInteger(payload.amountCents);
  const grossAmountCents = toSafeInteger(payload.grossAmountCents);
  const paidAmountCents = toSafeInteger(payload.paidAmountCents);
  const openAmountCents = toSafeInteger(payload.openAmountCents);
  const paymentVersion = toSafeInteger(payload.paymentVersion);
  const occurredAt = toIsoInstant(row.occurred_at);
  if (
    row.event_type !== EVENT_TYPE
    || row.tenant_id !== tenantId
    || row.status !== "success"
    || row.station !== null
    || row.from_station !== null
    || toSafeInteger(row.event_schema_version) !== EVENT_SCHEMA_VERSION
    || toSafeInteger(row.aggregate_version) !== paymentVersion
    || !UUID_PATTERN.test(row.event_id)
    || typeof row.client_event_id !== "string"
    || !UUID_PATTERN.test(row.client_event_id)
    || typeof row.correlation_id !== "string"
    || !UUID_PATTERN.test(row.correlation_id)
    || typeof row.actor_id !== "string"
    || !UUID_PATTERN.test(row.actor_id)
    || actualKeys.length !== expectedKeys.length
    || !actualKeys.every((key, index) => key === expectedKeys[index])
    || typeof payload.invoiceId !== "string"
    || !UUID_PATTERN.test(payload.invoiceId)
    || !isCanonicalTextId(payload.orderId)
    || payload.orderId !== row.order_id
    || !isCanonicalTextId(payload.receiptId, 200)
    || amountCents === null
    || amountCents <= 0
    || grossAmountCents === null
    || grossAmountCents <= 0
    || paidAmountCents === null
    || paidAmountCents <= 0
    || openAmountCents === null
    || paymentVersion === null
    || paymentVersion <= 0
    || amountCents > paidAmountCents
    || paidAmountCents + openAmountCents !== grossAmountCents
    || payload.currency !== PAYMENT_CURRENCY
    || !isPaymentMode(payload.paymentMode)
    || !isSettledPaymentStatus(payload.paymentStatus)
    || (payload.paymentStatus === "teilbezahlt" && (openAmountCents <= 0 || paidAmountCents >= grossAmountCents))
    || (payload.paymentStatus === "bezahlt" && (openAmountCents !== 0 || paidAmountCents !== grossAmountCents))
    || !isPaymentMethod(payload.method)
    || payload.source !== PAYMENT_SOURCE
    || typeof payload.occurredAt !== "string"
    || !ISO_INSTANT_PATTERN.test(payload.occurredAt)
    || occurredAt !== payload.occurredAt
  ) throw new Error("PAYMENT_RECEIPT_INVALID");

  return {
    eventId: row.event_id,
    invoiceId: payload.invoiceId,
    orderId: payload.orderId,
    receiptId: payload.receiptId,
    clientEventId: row.client_event_id,
    correlationId: row.correlation_id,
    eventSchemaVersion: EVENT_SCHEMA_VERSION,
    expectedVersion: paymentVersion - 1,
    paymentVersion,
    amountCents,
    grossAmountCents,
    paidAmountCents,
    openAmountCents,
    currency: PAYMENT_CURRENCY,
    paymentMode: payload.paymentMode,
    paymentStatus: payload.paymentStatus,
    method: payload.method,
    confirmedAt: payload.occurredAt,
    confirmedBy: row.actor_id,
    source: PAYMENT_SOURCE,
  };
}

function receiptMatchesIntent(
  receipt: PaymentEventData,
  input: ConfirmPaymentInput,
  actorId: string,
): boolean {
  return receipt.invoiceId === input.invoiceId
    && receipt.amountCents === input.amount
    && receipt.method === input.method
    && receipt.expectedVersion === input.expectedVersion
    && receipt.clientEventId === input.clientEventId
    && receipt.confirmedBy === actorId;
}

function receiptMatchesCurrentInvoice(
  receipt: PaymentEventData,
  invoice: LockedInvoice,
  tenantId: string,
): boolean {
  const state = parseInvoiceState(invoice, tenantId);
  return state !== null
    && invoice.id === receipt.invoiceId
    && invoice.order_id === receipt.orderId
    && state.grossAmountCents === receipt.grossAmountCents
    && state.mode === receipt.paymentMode
    && state.paymentVersion === receipt.paymentVersion
    && state.paidAmountCents === receipt.paidAmountCents
    && state.openAmountCents === receipt.openAmountCents
    && state.status === receipt.paymentStatus
    && state.method === receipt.method
    && state.paidAt === receipt.confirmedAt
    && invoice.payment_receipt_id === receipt.receiptId
    && invoice.payment_event_id === receipt.eventId
    && invoice.payment_correlation_id === receipt.correlationId;
}

function replayReceiptMatchesInvoice(
  receipt: PaymentEventData,
  invoice: LockedInvoice,
  tenantId: string,
): boolean {
  const state = parseInvoiceState(invoice, tenantId);
  if (!state) return false;
  if (state.paymentVersion === receipt.paymentVersion) {
    return receiptMatchesCurrentInvoice(receipt, invoice, tenantId);
  }
  return invoice.id === receipt.invoiceId
    && invoice.order_id === receipt.orderId
    && state.grossAmountCents === receipt.grossAmountCents
    && state.mode === receipt.paymentMode
    && state.paymentVersion > receipt.paymentVersion
    && state.paidAmountCents >= receipt.paidAmountCents
    && state.openAmountCents <= receipt.openAmountCents;
}

async function readEventsByClientId(
  tx: PrivilegedTenantTransaction,
  tenantId: string,
  clientEventId: string,
): Promise<PaymentEventRow[]> {
  return tx.execute<PaymentEventRow>(sql`
    SELECT
      id AS event_id,
      tenant_id,
      order_id,
      event_type,
      client_event_id::text,
      correlation_id::text,
      event_schema_version,
      aggregate_version,
      user_id::text AS actor_id,
      to_char(created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') AS occurred_at,
      status,
      station,
      from_station,
      payload
    FROM public.events
    WHERE tenant_id = ${tenantId}
      AND client_event_id = ${clientEventId}::uuid
    LIMIT 2
  `);
}

async function readInvoice(
  tx: PrivilegedTenantTransaction,
  tenantId: string,
  invoiceId: string,
  lock: boolean,
): Promise<LockedInvoice[]> {
  const base = sql`
    SELECT
      id::text,
      tenant_id,
      order_id,
      invoice_number,
      status,
      gross_amount_cents,
      payment_contract_version,
      payment_mode,
      payment_status,
      payment_open_amount_cents,
      payment_paid_amount_cents,
      payment_currency,
      payment_method,
      payment_paid_at,
      payment_receipt_id,
      payment_event_id,
      payment_correlation_id::text,
      payment_version
    FROM public.invoices
    WHERE id = ${invoiceId}::uuid
      AND tenant_id = ${tenantId}
    LIMIT 2
  `;
  if (!lock) return tx.execute<LockedInvoice>(base);
  return tx.execute<LockedInvoice>(sql`${base} FOR UPDATE`);
}

async function lockInvoiceOrder(
  tx: PrivilegedTenantTransaction,
  tenantId: string,
  invoiceId: string,
): Promise<LockedPaymentOrder[]> {
  return tx.execute<LockedPaymentOrder>(sql`
    SELECT
      orders.id,
      orders.tenant_id,
      orders.payment_mode,
      orders.payment_mode_version
    FROM public.invoices invoice
    JOIN public.orders orders
      ON orders.id = invoice.order_id
     AND orders.tenant_id = invoice.tenant_id
    WHERE invoice.id = ${invoiceId}::uuid
      AND invoice.tenant_id = ${tenantId}
    LIMIT 2
    FOR UPDATE OF orders
  `);
}

export async function confirmPayment(input: unknown): Promise<ConfirmPaymentResult> {
  if (!isValidInput(input)) {
    return { code: "VALIDATION_ERROR", message: "Ungültige Zahlungsbestätigung." };
  }

  let authorization;
  try {
    authorization = await resolveAuthorization();
  } catch {
    return { code: "UNAVAILABLE", message: "Zahlung konnte nicht sicher bestätigt werden." };
  }
  if (!authorization.ok) {
    return authorization.reason === "AUTHORIZATION_UNAVAILABLE"
      ? { code: "UNAVAILABLE", message: "Zahlung konnte nicht sicher bestätigt werden." }
      : { code: "UNAUTHENTICATED", message: "Sitzung oder Berechtigung ist nicht verfügbar." };
  }
  if (
    authorization.data.tenantId !== KREILE_TENANT_SLUG
    || !PAYMENT_ROLES.includes(authorization.data.role as (typeof PAYMENT_ROLES)[number])
  ) {
    return { code: "FORBIDDEN", message: "Zahlungsbestätigung ist mit dieser Rolle nicht erlaubt." };
  }

  const tenantId = authorization.data.tenantId;
  const actorId = authorization.data.userId;

  try {
    return await withPrivilegedTenantTransaction(authorization.data, async (tx) => {
      await tx.execute(sql`
        SELECT pg_advisory_xact_lock(
          hashtextextended('f1:payment:client-event:' || ${tenantId} || ':' || ${input.clientEventId}, 0)
        )
      `);

      const existingEvents = await readEventsByClientId(tx, tenantId, input.clientEventId);
      if (existingEvents.length > 0) {
        if (existingEvents.length !== 1 || existingEvents[0]?.event_type !== EVENT_TYPE) {
          return { code: "CONFLICT", message: "Anfragekennung wurde bereits anders verwendet." };
        }
        const replayedReceipt = parsePaymentEvent(existingEvents[0], tenantId);
        if (!receiptMatchesIntent(replayedReceipt, input, actorId)) {
          return { code: "CONFLICT", message: "Anfragekennung wurde bereits anders verwendet." };
        }
        const replayInvoices = await readInvoice(tx, tenantId, replayedReceipt.invoiceId, false);
        if (
          replayInvoices.length !== 1
          || !replayInvoices[0]
          || !replayReceiptMatchesInvoice(replayedReceipt, replayInvoices[0], tenantId)
        ) throw new Error("PAYMENT_REPLAY_READBACK_INVALID");
        return {
          code: "OK",
          receipt: { ...replayedReceipt, invoiceNumber: replayInvoices[0].invoice_number },
          replayed: true,
        };
      }

      // All payment-axis commands lock the order first. That serializes mode
      // changes, invoice issuance and payment confirmation without reversing
      // the createInvoice lock order.
      const orderRows = await lockInvoiceOrder(tx, tenantId, input.invoiceId);
      const order = orderRows[0];
      if (
        orderRows.length !== 1 || !order || order.tenant_id !== tenantId ||
        !isPaymentMode(order.payment_mode) || toSafeInteger(order.payment_mode_version) === null
      ) {
        return { code: "NOT_FOUND", message: "Rechnung nicht verfügbar." };
      }

      const invoiceRows = await readInvoice(tx, tenantId, input.invoiceId, true);
      const invoice = invoiceRows[0];
      if (invoiceRows.length !== 1 || !invoice || invoice.order_id !== order.id) {
        return { code: "NOT_FOUND", message: "Rechnung nicht verfügbar." };
      }
      if (invoice.status !== "issued") {
        return { code: "CONFLICT", message: "Rechnung ist nicht zur Zahlungsbestätigung freigegeben." };
      }
      const current = parseInvoiceState(invoice, tenantId);
      if (!current) {
        return { code: "VALIDATION_ERROR", message: "Zahlungsvertrag der Rechnung ist nicht verfügbar." };
      }
      if (current.paymentVersion !== input.expectedVersion) {
        return { code: "CONFLICT", message: "Zahlungsstand wurde bereits geändert." };
      }
      if (input.amount > current.openAmountCents) {
        return { code: "VALIDATION_ERROR", message: "Zahlungsbetrag übersteigt den offenen Betrag." };
      }

      const paymentVersion = current.paymentVersion + 1;
      const paidAmountCents = current.paidAmountCents + input.amount;
      const openAmountCents = current.openAmountCents - input.amount;
      const paymentStatus = openAmountCents === 0 ? "bezahlt" : "teilbezahlt";
      const receiptId = `payment://${invoice.id}/${paymentVersion}`;
      const correlationId = randomUUID();
      const timeRows = await tx.execute<{ occurred_at: string }>(sql`
        SELECT to_char(clock_timestamp() AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')
          AS occurred_at
      `);
      const confirmedAt = timeRows.length === 1 ? timeRows[0]?.occurred_at : null;
      if (typeof confirmedAt !== "string" || !ISO_INSTANT_PATTERN.test(confirmedAt)) {
        throw new Error("PAYMENT_TIME_INVALID");
      }

      const payload = {
        invoiceId: invoice.id,
        orderId: invoice.order_id,
        receiptId,
        amountCents: input.amount,
        grossAmountCents: current.grossAmountCents,
        paidAmountCents,
        openAmountCents,
        currency: PAYMENT_CURRENCY,
        paymentMode: current.mode,
        paymentStatus,
        method: input.method,
        occurredAt: confirmedAt,
        paymentVersion,
        source: PAYMENT_SOURCE,
      };
      const eventRows = await tx.execute<{ event_id: string }>(sql`
        INSERT INTO public.events (
          id, tenant_id, order_id, item_id, event_type, description, user_id,
          payload, status, station, client_event_id, event_schema_version,
          correlation_id, aggregate_version, from_station, created_at
        ) VALUES (
          gen_random_uuid()::text, ${tenantId}, ${invoice.order_id}, NULL,
          ${EVENT_TYPE}, 'Zahlung manuell bestätigt', ${actorId}::uuid,
          ${JSON.stringify(payload)}::jsonb, 'success', NULL, ${input.clientEventId}::uuid,
          ${EVENT_SCHEMA_VERSION}, ${correlationId}::uuid, ${paymentVersion}, NULL,
          ${confirmedAt}::timestamptz
        )
        RETURNING id AS event_id
      `);
      const eventId = eventRows[0]?.event_id;
      if (eventRows.length !== 1 || typeof eventId !== "string" || !UUID_PATTERN.test(eventId)) {
        throw new Error("PAYMENT_EVENT_INSERT_FAILED");
      }

      await tx.execute(sql`SELECT set_config('app.payment_command', 'v1', true)`);
      const updatedRows = await tx.execute<{ id: string }>(sql`
        UPDATE public.invoices
        SET
          payment_status = ${paymentStatus},
          payment_open_amount_cents = ${openAmountCents},
          payment_paid_amount_cents = ${paidAmountCents},
          payment_method = ${input.method},
          payment_paid_at = ${confirmedAt}::timestamptz,
          payment_receipt_id = ${receiptId},
          payment_event_id = ${eventId},
          payment_correlation_id = ${correlationId}::uuid,
          payment_version = ${paymentVersion}
        WHERE id = ${invoice.id}::uuid
          AND tenant_id = ${tenantId}
          AND status = 'issued'
          AND payment_contract_version = ${PAYMENT_CONTRACT_VERSION}
          AND payment_version = ${input.expectedVersion}
          AND payment_open_amount_cents = ${current.openAmountCents}
          AND payment_paid_amount_cents = ${current.paidAmountCents}
        RETURNING id::text
      `);
      if (updatedRows.length !== 1 || updatedRows[0]?.id !== invoice.id) {
        throw new Error("PAYMENT_INVOICE_UPDATE_FAILED");
      }

      const persistedEvents = await readEventsByClientId(tx, tenantId, input.clientEventId);
      if (persistedEvents.length !== 1 || !persistedEvents[0]) {
        throw new Error("PAYMENT_EVENT_READBACK_MISSING");
      }
      const persistedReceipt = parsePaymentEvent(persistedEvents[0], tenantId);
      const persistedInvoices = await readInvoice(tx, tenantId, input.invoiceId, false);
      if (
        persistedInvoices.length !== 1
        || !persistedInvoices[0]
        || !receiptMatchesIntent(persistedReceipt, input, actorId)
        || !receiptMatchesCurrentInvoice(persistedReceipt, persistedInvoices[0], tenantId)
      ) throw new Error("PAYMENT_RECEIPT_READBACK_MISMATCH");

      return {
        code: "OK",
        receipt: { ...persistedReceipt, invoiceNumber: persistedInvoices[0].invoice_number },
        replayed: false,
      };
    });
  } catch {
    return { code: "UNAVAILABLE", message: "Zahlung konnte nicht sicher bestätigt werden." };
  }
}
