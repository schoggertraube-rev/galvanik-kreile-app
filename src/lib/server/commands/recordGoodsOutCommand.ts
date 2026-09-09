import "server-only";

import { randomUUID } from "node:crypto";
import { sql } from "drizzle-orm";
import { ORDER_LIFECYCLE_STATUS } from "@/lib/orders/orderLifecycleContract";
import {
  PAYMENT_CONTRACT_VERSION,
  isPaymentMode,
  mapPaymentSummaryRow,
  type PaymentMode,
  type PaymentStatus,
  type PaymentSummaryRow,
} from "@/lib/server/paymentContract";
import { resolveAuthorization, type AuthorizationSnapshot } from "@/lib/server/authorization";
import {
  withPrivilegedTenantTransaction,
  type PrivilegedTenantTransaction,
} from "@/lib/server/privilegedDb";
import { KREILE_TENANT_SLUG } from "@/lib/tenant";

const EVENT_TYPE_V1 = "ORDER_PICKED_UP_V1" as const;
const EVENT_TYPE_V2 = "ORDER_PICKED_UP_V2" as const;
const SOURCE_STATION = ORDER_LIFECYCLE_STATUS.FERTIG;
const TARGET_STATION = ORDER_LIFECYCLE_STATUS.ABGEHOLT;
const GOODS_OUT_ROLES = ["werkstatt", "meister", "admin"] as const;
const GOODS_OUT_MODES = ["versand", "abholung"] as const;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

export type GoodsOutMode = (typeof GOODS_OUT_MODES)[number];

export type RecordGoodsOutInput = {
  orderId: string;
  mode: GoodsOutMode;
  expectedVersion: number;
  clientEventId: string;
};

type GoodsOutReceiptBase = {
  eventId: string;
  clientEventId: string;
  correlationId: string;
  orderId: string;
  expectedVersion: number;
  orderVersion: number;
  fromStation: "fertig";
  toStation: "abgeholt";
  mode: GoodsOutMode;
  paymentMode: PaymentMode;
  actorId: string;
  occurredAt: string;
};

export type GoodsOutReceiptV1 = GoodsOutReceiptBase & {
  eventSchemaVersion: 1;
  paymentStatus: PaymentStatus;
  openAmountCents: number;
};

export type GoodsOutReceiptV2 = GoodsOutReceiptBase & {
  eventSchemaVersion: 2;
  paymentMode: "rechnung";
  invoiceState: "not_issued";
};

export type GoodsOutReceipt = GoodsOutReceiptV1 | GoodsOutReceiptV2;

export type RecordGoodsOutResult =
  | { code: "OK"; receipt: GoodsOutReceipt; replayed: boolean }
  | { code: "UNAUTHENTICATED"; message: string }
  | { code: "FORBIDDEN"; message: string }
  | { code: "NOT_FOUND"; message: string }
  | { code: "CONFLICT"; message: string }
  | { code: "VALIDATION_ERROR"; message: string }
  | { code: "UNAVAILABLE"; message: string };

type LockedOrder = {
  id: string;
  tenant_id: string;
  customer_id: string | null;
  station: string | null;
  current_station: string | null;
  current_station_id: string | null;
  status: string | null;
  version: number | string;
  payment_mode: string | null;
};

type LockedInvoice = {
  id: string;
  tenant_id: string;
  order_id: string;
  status: string;
  contract_version: number | string | null;
  payment_contract_version: number | string | null;
};

type LockedItem = {
  id: string;
  tenant_id: string | null;
  customer_id: string | null;
  current_station_id: string | null;
};

type GoodsOutEventRow = {
  event_id: string;
  tenant_id: string | null;
  order_id: string | null;
  client_event_id: string | null;
  correlation_id: string | null;
  event_schema_version: number | string | null;
  aggregate_version: number | string | null;
  actor_id: string | null;
  occurred_at: Date | string | null;
  status: string | null;
  station: string | null;
  from_station: string | null;
  event_type: string;
  payload: unknown;
};

function isGoodsOutMode(value: unknown): value is GoodsOutMode {
  return GOODS_OUT_MODES.includes(value as GoodsOutMode);
}

function toNonNegativeInteger(value: unknown): number | null {
  if (typeof value !== "number" && typeof value !== "string") return null;
  if (typeof value === "string" && (value.length === 0 || value.trim() !== value)) return null;
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isSafeInteger(parsed) && parsed >= 0 ? parsed : null;
}

function toIso(value: unknown): string | null {
  if (!(value instanceof Date) && typeof value !== "string") return null;
  const parsed = value instanceof Date ? value : new Date(value);
  return Number.isFinite(parsed.getTime()) ? parsed.toISOString() : null;
}

function isValidInput(input: unknown): input is RecordGoodsOutInput {
  if (!input || typeof input !== "object" || Array.isArray(input)) return false;
  const value = input as Record<string, unknown>;
  const expectedKeys = ["clientEventId", "expectedVersion", "mode", "orderId"];
  const actualKeys = Object.keys(value).sort();
  return actualKeys.length === expectedKeys.length
    && actualKeys.every((key, index) => key === expectedKeys[index])
    && typeof value.orderId === "string"
    && value.orderId.trim() === value.orderId
    && value.orderId.length > 0
    && value.orderId.length <= 128
    && isGoodsOutMode(value.mode)
    && typeof value.expectedVersion === "number"
    && Number.isSafeInteger(value.expectedVersion)
    && value.expectedVersion > 0
    && typeof value.clientEventId === "string"
    && UUID_PATTERN.test(value.clientEventId);
}

function readDiagnostic(error: unknown, key: "message" | "details" | "hint"): string | null {
  if (!error || typeof error !== "object") return key === "message" && error instanceof Error ? error.message : null;
  const value = (error as Record<string, unknown>)[key];
  return typeof value === "string" && value.length > 0 ? value : null;
}

function logDatabaseFailure(error: unknown): void {
  console.error("recordGoodsOut database error", {
    message: readDiagnostic(error, "message"),
    details: readDiagnostic(error, "details"),
    hint: readDiagnostic(error, "hint"),
  });
}

async function readEventsByClientId(
  tx: PrivilegedTenantTransaction,
  tenantId: string,
  clientEventId: string,
): Promise<GoodsOutEventRow[]> {
  return tx.execute<GoodsOutEventRow>(sql`
    SELECT
      id AS event_id, tenant_id, order_id, client_event_id::text,
      correlation_id::text, event_schema_version, aggregate_version,
      user_id::text AS actor_id,
      to_char(created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') AS occurred_at,
      status, station, from_station, event_type, payload
    FROM public.events
    WHERE tenant_id = ${tenantId}
      AND client_event_id = ${clientEventId}::uuid
    LIMIT 2
  `);
}

async function readOrder(
  tx: PrivilegedTenantTransaction,
  tenantId: string,
  orderId: string,
  lock: boolean,
): Promise<LockedOrder[]> {
  const query = sql`
    SELECT id, tenant_id, customer_id, station, current_station,
      current_station_id, status, version, payment_mode
    FROM public.orders
    WHERE id = ${orderId} AND tenant_id = ${tenantId}
    LIMIT 2
  `;
  return lock
    ? tx.execute<LockedOrder>(sql`${query} FOR UPDATE`)
    : tx.execute<LockedOrder>(query);
}

async function readActiveInvoice(
  tx: PrivilegedTenantTransaction,
  tenantId: string,
  orderId: string,
): Promise<LockedInvoice[]> {
  return tx.execute<LockedInvoice>(sql`
    SELECT id::text, tenant_id, order_id, status, contract_version, payment_contract_version
    FROM public.invoices
    WHERE tenant_id = ${tenantId}
      AND order_id = ${orderId}
      AND contract_version = 1
      AND status = 'issued'
    LIMIT 2
    FOR UPDATE
  `);
}

async function readPaymentSummary(
  tx: PrivilegedTenantTransaction,
  tenantId: string,
  orderId: string,
): Promise<PaymentSummaryRow[]> {
  return tx.execute<PaymentSummaryRow>(sql`
    SELECT
      invoice_id::text, tenant_id, order_id, order_number, invoice_number,
      total_amount_cents, payment_contract_version, payment_mode, payment_status,
      payment_open_amount_cents, payment_paid_amount_cents, payment_currency,
      payment_method,
      to_char(payment_paid_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') AS payment_paid_at,
      payment_receipt_id, payment_event_id, payment_correlation_id::text,
      payment_mode_version, payment_version, goods_out_allowed, integrity_ok
    FROM private.v_payment_summary_v1
    WHERE tenant_id = ${tenantId} AND order_id = ${orderId}
    LIMIT 2
  `);
}

function parseEvent(row: GoodsOutEventRow, tenantId: string): GoodsOutReceipt {
  if (!row.payload || typeof row.payload !== "object" || Array.isArray(row.payload)) {
    throw new Error("GOODS_OUT_RECEIPT_PAYLOAD_INVALID");
  }
  const payload = row.payload as Record<string, unknown>;
  const actualKeys = Object.keys(payload).sort();
  const orderVersion = toNonNegativeInteger(payload.orderVersion);
  const eventVersion = toNonNegativeInteger(row.aggregate_version);
  const eventSchemaVersion = toNonNegativeInteger(row.event_schema_version);
  const occurredAt = toIso(row.occurred_at);
  if (
    (row.event_type !== EVENT_TYPE_V1 && row.event_type !== EVENT_TYPE_V2)
    || row.tenant_id !== tenantId
    || row.status !== "success"
    || row.from_station !== SOURCE_STATION
    || row.station !== TARGET_STATION
    || eventSchemaVersion === null
    || (row.event_type === EVENT_TYPE_V1 ? eventSchemaVersion !== 1 : eventSchemaVersion !== 2)
    || eventVersion === null
    || orderVersion === null
    || orderVersion !== eventVersion
    || orderVersion <= 0
    || typeof row.event_id !== "string"
    || row.event_id.length === 0
    || typeof row.client_event_id !== "string"
    || !UUID_PATTERN.test(row.client_event_id)
    || typeof row.correlation_id !== "string"
    || !UUID_PATTERN.test(row.correlation_id)
    || typeof row.actor_id !== "string"
    || !UUID_PATTERN.test(row.actor_id)
    || typeof row.order_id !== "string"
    || row.order_id.length === 0
    || occurredAt === null
    || payload.orderId !== row.order_id
    || !isGoodsOutMode(payload.mode)
    || !isPaymentMode(payload.paymentMode)
    || payload.gateAllowed !== true
  ) throw new Error("GOODS_OUT_RECEIPT_INVALID");

  const base = {
    eventId: row.event_id,
    clientEventId: row.client_event_id,
    correlationId: row.correlation_id,
    orderId: row.order_id,
    expectedVersion: orderVersion - 1,
    orderVersion,
    fromStation: SOURCE_STATION,
    toStation: TARGET_STATION,
    mode: payload.mode,
    paymentMode: payload.paymentMode,
    actorId: row.actor_id,
    occurredAt,
  };

  if (row.event_type === EVENT_TYPE_V2) {
    const expectedKeys = ["gateAllowed", "invoiceState", "mode", "orderId", "orderVersion", "paymentMode"];
    if (
      actualKeys.length !== expectedKeys.length
      || !actualKeys.every((key, index) => key === expectedKeys[index])
      || payload.paymentMode !== "rechnung"
      || payload.invoiceState !== "not_issued"
    ) throw new Error("GOODS_OUT_RECEIPT_INVALID");
    return { ...base, eventSchemaVersion: 2, paymentMode: "rechnung", invoiceState: "not_issued" };
  }

  const expectedKeys = [
    "gateAllowed", "mode", "openAmountCents", "orderId", "orderVersion",
    "paymentMode", "paymentStatus",
  ];
  const openAmountCents = toNonNegativeInteger(payload.openAmountCents);
  if (
    actualKeys.length !== expectedKeys.length
    || !actualKeys.every((key, index) => key === expectedKeys[index])
    || openAmountCents === null
    || (payload.paymentStatus !== "offen" && payload.paymentStatus !== "teilbezahlt" && payload.paymentStatus !== "bezahlt")
    || (payload.paymentMode !== "rechnung" && (payload.paymentStatus !== "bezahlt" || openAmountCents !== 0))
  ) throw new Error("GOODS_OUT_RECEIPT_INVALID");
  return {
    ...base,
    eventSchemaVersion: 1,
    paymentStatus: payload.paymentStatus,
    openAmountCents,
  };
}

function receiptMatchesIntent(
  receipt: GoodsOutReceipt,
  input: RecordGoodsOutInput,
  actorId: string,
): boolean {
  return receipt.orderId === input.orderId
    && receipt.mode === input.mode
    && receipt.expectedVersion === input.expectedVersion
    && receipt.clientEventId === input.clientEventId
    && receipt.actorId === actorId;
}

function orderMatchesReceipt(order: LockedOrder, receipt: GoodsOutReceipt, tenantId: string): boolean {
  return order.tenant_id === tenantId
    && order.id === receipt.orderId
    && toNonNegativeInteger(order.version) === receipt.orderVersion
    && order.station === TARGET_STATION
    && order.current_station === TARGET_STATION
    && order.current_station_id === TARGET_STATION
    && order.status === TARGET_STATION;
}

function paymentAuthorization(authorization: AuthorizationSnapshot): AuthorizationSnapshot {
  // The command role is narrower than the shared read-port role. Every allowed
  // goods-out role already owns the established read permission; this explicit
  // snapshot keeps the canonical row mapper as the integrity boundary.
  return authorization;
}

export async function recordGoodsOut(input: unknown): Promise<RecordGoodsOutResult> {
  if (!isValidInput(input)) {
    return { code: "VALIDATION_ERROR", message: "Ungültiger Warenausgang." };
  }

  let authorization;
  try {
    authorization = await resolveAuthorization();
  } catch {
    return { code: "UNAVAILABLE", message: "Warenausgang konnte nicht sicher gebucht werden." };
  }
  if (!authorization.ok) {
    return authorization.reason === "AUTHORIZATION_UNAVAILABLE"
      ? { code: "UNAVAILABLE", message: "Warenausgang konnte nicht sicher gebucht werden." }
      : { code: "UNAUTHENTICATED", message: "Sitzung oder Berechtigung ist nicht verfügbar." };
  }
  if (
    authorization.data.tenantId !== KREILE_TENANT_SLUG
    || !GOODS_OUT_ROLES.includes(authorization.data.role as (typeof GOODS_OUT_ROLES)[number])
  ) {
    return { code: "FORBIDDEN", message: "Warenausgang ist mit dieser Rolle nicht erlaubt." };
  }

  const tenantId = authorization.data.tenantId;
  const actorId = authorization.data.userId;

  try {
    return await withPrivilegedTenantTransaction(authorization.data, async (tx) => {
      await tx.execute(sql`
        SELECT pg_advisory_xact_lock(
          hashtextextended('f1:goods-out:client-event:' || ${tenantId} || ':' || ${input.clientEventId}, 0)
        )
      `);

      const existingEvents = await readEventsByClientId(tx, tenantId, input.clientEventId);
      if (existingEvents.length > 0) {
        if (
          existingEvents.length !== 1
          || !existingEvents[0]
          || (existingEvents[0].event_type !== EVENT_TYPE_V1 && existingEvents[0].event_type !== EVENT_TYPE_V2)
        ) {
          return { code: "CONFLICT", message: "Anfragekennung wurde bereits anders verwendet." };
        }
        const receipt = parseEvent(existingEvents[0], tenantId);
        if (!receiptMatchesIntent(receipt, input, actorId)) {
          return { code: "CONFLICT", message: "Anfragekennung wurde bereits anders verwendet." };
        }
        const orders = await readOrder(tx, tenantId, receipt.orderId, false);
        if (orders.length !== 1 || !orders[0] || !orderMatchesReceipt(orders[0], receipt, tenantId)) {
          throw new Error("GOODS_OUT_REPLAY_READBACK_INVALID");
        }
        return { code: "OK", receipt, replayed: true };
      }

      const orders = await readOrder(tx, tenantId, input.orderId, true);
      const order = orders[0];
      if (orders.length !== 1 || !order || order.tenant_id !== tenantId) {
        return { code: "NOT_FOUND", message: "Auftrag nicht verfügbar." };
      }
      const orderVersion = toNonNegativeInteger(order.version);
      if (orderVersion !== input.expectedVersion) {
        return { code: "CONFLICT", message: "Auftrag wurde bereits geändert." };
      }
      if (
        order.station !== SOURCE_STATION
        || order.current_station !== SOURCE_STATION
        || order.current_station_id !== SOURCE_STATION
        || order.status !== SOURCE_STATION
      ) {
        return { code: "VALIDATION_ERROR", message: "Nur fertige Ware kann ausgegeben werden." };
      }
      if (!order.customer_id || !isPaymentMode(order.payment_mode)) {
        return { code: "VALIDATION_ERROR", message: "Auftragsvertrag ist nicht verfügbar." };
      }

      const invoices = await readActiveInvoice(tx, tenantId, order.id);
      if (invoices.length > 1) {
        return { code: "CONFLICT", message: "Warenausgang erfordert eine gültige Rechnung." };
      }
      const invoice = invoices[0];
      const invoiceNotIssued = invoices.length === 0;
      let summary: ReturnType<typeof mapPaymentSummaryRow> | null = null;
      if (invoiceNotIssued) {
        if (order.payment_mode !== "rechnung") {
          return { code: "CONFLICT", message: "Warenausgang erfordert eine gültige Rechnung." };
        }
      } else {
        if (
          !invoice
          || invoice.tenant_id !== tenantId
          || invoice.order_id !== order.id
          || invoice.status !== "issued"
          || toNonNegativeInteger(invoice.contract_version) !== 1
          || toNonNegativeInteger(invoice.payment_contract_version) !== PAYMENT_CONTRACT_VERSION
        ) {
          return { code: "CONFLICT", message: "Warenausgang erfordert eine gültige Rechnung." };
        }

        const summaryRows = await readPaymentSummary(tx, tenantId, order.id);
        if (summaryRows.length !== 1 || !summaryRows[0] || summaryRows[0].invoice_id !== invoice.id) {
          return { code: "CONFLICT", message: "Zahlungsfreigabe ist nicht verfügbar." };
        }
        summary = mapPaymentSummaryRow(summaryRows[0], paymentAuthorization(authorization.data));
        if (summary.mode !== order.payment_mode || !summary.goodsOutAllowed) {
          return { code: "CONFLICT", message: "Zahlung ist für den Warenausgang noch offen." };
        }
      }

      const items = await tx.execute<LockedItem>(sql`
        SELECT id, tenant_id, customer_id, current_station_id
        FROM public.items
        WHERE order_id = ${order.id}
        FOR UPDATE
      `);
      if (items.some((item) => (
        item.tenant_id !== tenantId
        || item.customer_id !== order.customer_id
        || item.current_station_id !== SOURCE_STATION
      ))) {
        return { code: "VALIDATION_ERROR", message: "Auftragsteile sind nicht ausgabefähig." };
      }

      const nextVersion = input.expectedVersion + 1;
      const updatedOrders = await tx.execute<{ id: string; version: number | string }>(sql`
        UPDATE public.orders
        SET station = ${TARGET_STATION},
            current_station = ${TARGET_STATION},
            current_station_id = ${TARGET_STATION},
            status = ${TARGET_STATION},
            version = version + 1
        WHERE id = ${order.id}
          AND tenant_id = ${tenantId}
          AND version = ${input.expectedVersion}
          AND station = ${SOURCE_STATION}
          AND current_station = ${SOURCE_STATION}
          AND current_station_id = ${SOURCE_STATION}
          AND status = ${SOURCE_STATION}
        RETURNING id, version
      `);
      if (
        updatedOrders.length !== 1
        || updatedOrders[0]?.id !== order.id
        || toNonNegativeInteger(updatedOrders[0]?.version) !== nextVersion
      ) throw new Error("GOODS_OUT_ORDER_UPDATE_FAILED");

      if (items.length > 0) {
        const updatedItems = await tx.execute<{ id: string }>(sql`
          UPDATE public.items
          SET current_station_id = ${TARGET_STATION}
          WHERE tenant_id = ${tenantId}
            AND order_id = ${order.id}
            AND current_station_id = ${SOURCE_STATION}
          RETURNING id
        `);
        if (updatedItems.length !== items.length) throw new Error("GOODS_OUT_ITEM_UPDATE_FAILED");
      }

      const correlationId = randomUUID();
      const eventType = invoiceNotIssued ? EVENT_TYPE_V2 : EVENT_TYPE_V1;
      const eventSchemaVersion = invoiceNotIssued ? 2 : 1;
      const payload = invoiceNotIssued ? {
        orderId: order.id,
        mode: input.mode,
        orderVersion: nextVersion,
        paymentMode: "rechnung" as const,
        invoiceState: "not_issued" as const,
        gateAllowed: true,
      } : {
        orderId: order.id,
        mode: input.mode,
        orderVersion: nextVersion,
        paymentMode: summary!.mode,
        paymentStatus: summary!.status,
        openAmountCents: summary!.openAmountCents,
        gateAllowed: true,
      };
      const inserted = await tx.execute<{ event_id: string }>(sql`
        INSERT INTO public.events (
          id, tenant_id, order_id, item_id, event_type, description, user_id,
          payload, status, station, client_event_id, event_schema_version,
          correlation_id, aggregate_version, from_station, created_at
        ) VALUES (
          gen_random_uuid()::text, ${tenantId}, ${order.id}, NULL, ${eventType},
          'Warenausgang gebucht', ${actorId}::uuid, ${JSON.stringify(payload)}::jsonb,
          'success', ${TARGET_STATION}, ${input.clientEventId}::uuid,
          ${eventSchemaVersion}, ${correlationId}::uuid, ${nextVersion},
          ${SOURCE_STATION}, clock_timestamp() AT TIME ZONE 'UTC'
        )
        RETURNING id AS event_id
      `);
      if (inserted.length !== 1 || typeof inserted[0]?.event_id !== "string") {
        throw new Error("GOODS_OUT_EVENT_INSERT_FAILED");
      }

      const persistedEvents = await readEventsByClientId(tx, tenantId, input.clientEventId);
      const persistedOrders = await readOrder(tx, tenantId, order.id, false);
      if (persistedEvents.length !== 1 || !persistedEvents[0] || persistedOrders.length !== 1 || !persistedOrders[0]) {
        throw new Error("GOODS_OUT_READBACK_MISSING");
      }
      const receipt = parseEvent(persistedEvents[0], tenantId);
      if (
        !receiptMatchesIntent(receipt, input, actorId)
        || !orderMatchesReceipt(persistedOrders[0], receipt, tenantId)
      ) throw new Error("GOODS_OUT_READBACK_INVALID");

      return { code: "OK", receipt, replayed: false };
    });
  } catch (error: unknown) {
    logDatabaseFailure(error);
    return { code: "UNAVAILABLE", message: "Warenausgang konnte nicht sicher gebucht werden." };
  }
}
