import "server-only";
import {readOpenOrderComplaint} from '@/lib/server/orderReleaseRead';
import {COMPLAINT_ORDER_COPY} from '@/ui/situationCatalog';

import { randomUUID } from "node:crypto";
import { sql } from "drizzle-orm";
import { readEffectiveCustomerAgreement } from "@/lib/server/effectiveCustomerAgreementRead";
import { ORDER_LIFECYCLE_STATUS } from "@/modules/orders/public";
import {
  PAYMENT_CONTRACT_VERSION,
  isOrderPaymentMode,
  isPaymentMode,
  mapPaymentSummaryRow,
  type OrderPaymentMode,
  type PaymentStatus,
  type PaymentSummaryRow,
} from "@/lib/server/paymentContract";
import { hasAuthorizationArea, resolveAuthorization, type AuthorizationSnapshot } from "@/lib/server/authorization";
import {
  withPrivilegedTenantTransaction,
  type PrivilegedTenantTransaction,
} from "@/lib/server/privilegedDb";
import { KREILE_TENANT_SLUG } from "@/lib/tenant";

const EVENT_TYPE_V1 = "ORDER_PICKED_UP_V1" as const;
const EVENT_TYPE_V2 = "ORDER_PICKED_UP_V2" as const;
const EVENT_TYPE_V3 = "ORDER_PICKED_UP_V3" as const;
const EVENT_TYPE_V4 = "ORDER_PICKED_UP_V4" as const;
const SOURCE_STATION = ORDER_LIFECYCLE_STATUS.FERTIG;
const TARGET_STATION = ORDER_LIFECYCLE_STATUS.ABGEHOLT;
const GOODS_OUT_MODES = ["versand", "abholung"] as const;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

export type GoodsOutMode = (typeof GOODS_OUT_MODES)[number];

export type GoodsOutAgreement = {
  id: string;
  version: number;
  type: "ausgabe_ohne_zahlung" | "sammelrechnung" | "zahlungsziel";
};

export type RecordGoodsOutInput = {
  orderId: string;
  mode: GoodsOutMode;
  expectedVersion: number;
  clientEventId: string;
  agreement?: GoodsOutAgreement;
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
  paymentMode: OrderPaymentMode;
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

export type GoodsOutReceiptV3 = GoodsOutReceiptBase & {
  eventSchemaVersion: 3;
  agreement: GoodsOutAgreement;
  settlement: "invoice" | "collection";
};

export type GoodsOutReceiptV4 = GoodsOutReceiptBase & {
  eventSchemaVersion: 4;
  paymentMode: "keiner";
  invoiceState: "not_issued";
  reworkComplaintId: string;
};

export type GoodsOutReceipt = GoodsOutReceiptV1 | GoodsOutReceiptV2 | GoodsOutReceiptV3 | GoodsOutReceiptV4;

export type RecordGoodsOutResult =
  | { code: "OK"; receipt: GoodsOutReceipt; replayed: boolean }
  | { code: "UNAUTHENTICATED"; message: string }
  | { code: "FORBIDDEN"; message: string }
  | { code: "NOT_FOUND"; message: string }
  | { code: "CONFLICT"; message: string }
  | { code: "VALIDATION_ERROR"; message: string }
  | { code: "UNAVAILABLE"; message: string };

type LockedOrder = {
  ausgabe_frei:boolean;
  id: string;
  tenant_id: string;
  customer_id: string | null;
  station: string | null;
  current_station: string | null;
  current_station_id: string | null;
  status: string | null;
  version: number | string;
  payment_mode: string | null;
  nacharbeit_zu: string | null;
};

type ReworkComplaint = {
  complaint_id: string;
  stand: string | null;
  nacharbeit_auftrag_id: string | null;
  version: number | string | null;
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

type InvoiceCollectionRow = {
  id: string;
  tenant_id: string;
  customer_id: string;
  ziel_tage: number | string;
  status: string;
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

function isGoodsOutAgreement(value: unknown): value is GoodsOutAgreement {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const agreement = value as Record<string, unknown>;
  const keys = Object.keys(agreement).sort();
  return keys.length === 3
    && keys[0] === "id"
    && keys[1] === "type"
    && keys[2] === "version"
    && typeof agreement.id === "string"
    && UUID_PATTERN.test(agreement.id)
    && typeof agreement.version === "number"
    && Number.isSafeInteger(agreement.version)
    && agreement.version > 0
    && (agreement.type === "ausgabe_ohne_zahlung"
      || agreement.type === "sammelrechnung"
      || agreement.type === "zahlungsziel");
}

function isCanonicalTextId(value: unknown): value is string {
  return typeof value === "string"
    && value.trim() === value
    && value.length >= 1
    && value.length <= 128;
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
  const expectedWithAgreement = ["agreement", ...expectedKeys].sort();
  const actualKeys = Object.keys(value).sort();
  const hasAgreement = actualKeys.length === expectedWithAgreement.length
    && actualKeys.every((key, index) => key === expectedWithAgreement[index]);
  return ((actualKeys.length === expectedKeys.length
      && actualKeys.every((key, index) => key === expectedKeys[index]))
      || hasAgreement)
    && typeof value.orderId === "string"
    && value.orderId.trim() === value.orderId
    && value.orderId.length > 0
    && value.orderId.length <= 128
    && isGoodsOutMode(value.mode)
    && typeof value.expectedVersion === "number"
    && Number.isSafeInteger(value.expectedVersion)
    && value.expectedVersion > 0
    && typeof value.clientEventId === "string"
    && UUID_PATTERN.test(value.clientEventId)
    && (!hasAgreement || isGoodsOutAgreement(value.agreement));
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
      current_station_id, status, version, payment_mode, nacharbeit_zu, ausgabe_frei
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
    (row.event_type !== EVENT_TYPE_V1 && row.event_type !== EVENT_TYPE_V2 && row.event_type !== EVENT_TYPE_V3 && row.event_type !== EVENT_TYPE_V4)
    || row.tenant_id !== tenantId
    || row.status !== "success"
    || row.from_station !== SOURCE_STATION
    || row.station !== TARGET_STATION
    || eventSchemaVersion === null
    || (row.event_type === EVENT_TYPE_V1 && eventSchemaVersion !== 1)
    || (row.event_type === EVENT_TYPE_V2 && eventSchemaVersion !== 2)
    || (row.event_type === EVENT_TYPE_V3 && eventSchemaVersion !== 3)
    || (row.event_type === EVENT_TYPE_V4 && eventSchemaVersion !== 4)
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
    || !isOrderPaymentMode(payload.paymentMode)
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

  if (row.event_type === EVENT_TYPE_V4) {
    const expectedKeys = [
      "complaintStateAfter", "complaintStateBefore", "gateAllowed", "invoiceState", "mode",
      "orderId", "orderVersion", "paymentMode", "reworkComplaintId",
    ];
    if (
      actualKeys.length !== expectedKeys.length
      || !actualKeys.every((key, index) => key === expectedKeys[index])
      || payload.paymentMode !== "keiner"
      || payload.invoiceState !== "not_issued"
      || payload.complaintStateBefore !== "massnahme_nacharbeit"
      || payload.complaintStateAfter !== "abgeschlossen"
      || !isCanonicalTextId(payload.reworkComplaintId)
    ) throw new Error("GOODS_OUT_RECEIPT_INVALID");
    return {
      ...base,
      eventSchemaVersion: 4,
      paymentMode: "keiner",
      invoiceState: "not_issued",
      reworkComplaintId: payload.reworkComplaintId,
    };
  }

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

  if (row.event_type === EVENT_TYPE_V3) {
    const expectedKeys = [
      "agreementId", "agreementType", "agreementVersion", "gateAllowed", "mode",
      "orderId", "orderVersion", "paymentMode", "settlement",
    ];
    const agreementVersion = toNonNegativeInteger(payload.agreementVersion);
    const agreementType = payload.agreementType;
    const settlement = payload.settlement;
    if (
      actualKeys.length !== expectedKeys.length
      || !actualKeys.every((key, index) => key === expectedKeys[index])
      || typeof payload.agreementId !== "string"
      || !UUID_PATTERN.test(payload.agreementId)
      || agreementVersion === null
      || agreementVersion < 1
      || (agreementType !== "ausgabe_ohne_zahlung" && agreementType !== "sammelrechnung" && agreementType !== "zahlungsziel")
      || (settlement !== "invoice" && settlement !== "collection")
      || (agreementType === "sammelrechnung") !== (settlement === "collection")
    ) throw new Error("GOODS_OUT_RECEIPT_INVALID");
    return {
      ...base,
      eventSchemaVersion: 3,
      agreement: {
        id: payload.agreementId,
        version: agreementVersion,
        type: agreementType,
      },
      settlement,
    };
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
    || !isPaymentMode(payload.paymentMode)
    || (payload.paymentStatus !== "offen" && payload.paymentStatus !== "teilbezahlt" && payload.paymentStatus !== "bezahlt")
    || (payload.paymentMode !== "rechnung" && payload.paymentMode !== "abholung"
      && (payload.paymentStatus !== "bezahlt" || openAmountCents !== 0))
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
  const receiptAgreement = receipt.eventSchemaVersion === 3 ? receipt.agreement : undefined;
  return receipt.orderId === input.orderId
    && receipt.mode === input.mode
    && receipt.expectedVersion === input.expectedVersion
    && receipt.clientEventId === input.clientEventId
    && receipt.actorId === actorId
    && (input.agreement === undefined
      ? receiptAgreement === undefined
      : receiptAgreement !== undefined
        && receiptAgreement.id === input.agreement.id
        && receiptAgreement.version === input.agreement.version
        && receiptAgreement.type === input.agreement.type);
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
  // Goods-out needs the canonical payment integrity mapper to evaluate its
  // payment gate. That internal read does not grant the actor a finance UI or
  // a finance mutation; the command itself remains guarded by perm_op_status.
  return {
    ...authorization,
    permissions: [...new Set([...authorization.permissions, "perm_view_prices" as const])],
  };
}

type BerlinMonthRow = { monat: string };
type CollectionLinkRow = { collection_id: string };

async function attachOpenInvoiceCollection(
  tx: PrivilegedTenantTransaction,
  input: {
    tenantId: string;
    customerId: string;
    orderId: string;
    actorId: string;
    targetDays: number;
  },
): Promise<void> {
  const monthRows = await tx.execute<BerlinMonthRow>(sql`
    SELECT to_char(
      date_trunc('month', timezone('Europe/Berlin', clock_timestamp())),
      'YYYY-MM-DD'
    ) AS monat
  `);
  const month = monthRows[0]?.monat;
  if (monthRows.length !== 1 || typeof month !== "string" || !/^\d{4}-\d{2}-01$/.test(month)) {
    throw new Error("GOODS_OUT_COLLECTION_MONTH_INVALID");
  }
  await tx.execute(sql`
    SELECT pg_advisory_xact_lock(
      hashtextextended(
        'abs:invoice-collection:' || ${input.tenantId} || ':' || ${input.customerId} || ':' || ${month},
        0
      )
    )
  `);
  let collections = await tx.execute<InvoiceCollectionRow>(sql`
    SELECT id::text, tenant_id, customer_id, ziel_tage, status
    FROM public.invoice_collections
    WHERE tenant_id = ${input.tenantId}
      AND customer_id = ${input.customerId}
      AND monat = ${month}::date
    FOR UPDATE
  `);
  if (collections.length === 0) {
    collections = await tx.execute<InvoiceCollectionRow>(sql`
      INSERT INTO public.invoice_collections (
        tenant_id, customer_id, monat, ziel_tage, status, created_by
      ) VALUES (
        ${input.tenantId}, ${input.customerId}, ${month}::date, ${input.targetDays}, 'offen', ${input.actorId}::uuid
      )
      RETURNING id::text, tenant_id, customer_id, ziel_tage, status
    `);
  }
  const collection = collections[0];
  if (
    collections.length !== 1
    || !collection
    || collection.tenant_id !== input.tenantId
    || collection.customer_id !== input.customerId
    || toNonNegativeInteger(collection.ziel_tage) !== input.targetDays
    || collection.status !== "offen"
    || !UUID_PATTERN.test(collection.id)
  ) {
    throw new Error("GOODS_OUT_COLLECTION_INVALID");
  }

  const linked = await tx.execute<CollectionLinkRow>(sql`
    INSERT INTO public.invoice_collection_orders (collection_id, tenant_id, order_id)
    VALUES (${collection.id}::uuid, ${input.tenantId}, ${input.orderId})
    ON CONFLICT (order_id) DO NOTHING
    RETURNING collection_id::text
  `);
  if (linked.length === 0) {
    const existingLinks = await tx.execute<CollectionLinkRow>(sql`
      SELECT collection_id::text
      FROM public.invoice_collection_orders
      WHERE tenant_id = ${input.tenantId}
        AND order_id = ${input.orderId}
      LIMIT 2
      FOR UPDATE
    `);
    if (
      existingLinks.length !== 1
      || existingLinks[0]?.collection_id !== collection.id
    ) {
      throw new Error("GOODS_OUT_COLLECTION_ORDER_ALREADY_LINKED");
    }
  } else if (linked.length !== 1 || linked[0]?.collection_id !== collection.id) {
    throw new Error("GOODS_OUT_COLLECTION_LINK_INVALID");
  }
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
    || !hasAuthorizationArea(authorization.data, "auftraege")
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
          || (
            existingEvents[0].event_type !== EVENT_TYPE_V1
            && existingEvents[0].event_type !== EVENT_TYPE_V2
            && existingEvents[0].event_type !== EVENT_TYPE_V3
            && existingEvents[0].event_type !== EVENT_TYPE_V4
          )
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
      const isRework = order.payment_mode === "keiner";
      if (
        !order.customer_id
        || (!isPaymentMode(order.payment_mode) && !isRework)
        || (isRework && !isCanonicalTextId(order.nacharbeit_zu))
        || (isRework && input.agreement !== undefined)
      ) {
        return { code: "VALIDATION_ERROR", message: "Auftragsvertrag ist nicht verfügbar." };
      }

      const pendingComplaint=await readOpenOrderComplaint(tx,tenantId,order.id);
      if(pendingComplaint)return {code:'CONFLICT',message:COMPLAINT_ORDER_COPY.releaseBlocked(pendingComplaint.number)};
      const agreement = input.agreement === undefined
        ? null
        : await readEffectiveCustomerAgreement(tx, {
            tenantId,
            customerId: order.customer_id,
            orderId: order.id,
            lock: true,
          });
      if (
        input.agreement !== undefined
        && (
          agreement === null
          || agreement.id !== input.agreement.id
          || agreement.version !== input.agreement.version
          || agreement.type !== input.agreement.type
        )
      ) {
        return { code: "VALIDATION_ERROR", message: "Zahlung fehlt." };
      }
      if (order.ausgabe_frei !== true && agreement === null) {
        return { code: "CONFLICT", message: "Ausgabe ist noch nicht freigegeben. Zahlung oder Abschluss fehlt." };
      }

      const invoices = await readActiveInvoice(tx, tenantId, order.id);
      if (invoices.length > 1) {
        return { code: "CONFLICT", message: "Warenausgang erfordert eine gültige Rechnung." };
      }
      const invoice = invoices[0];
      const invoiceNotIssued = invoices.length === 0;
      let summary: ReturnType<typeof mapPaymentSummaryRow> | null = null;
      if (agreement?.type === "sammelrechnung") {
        if (!invoiceNotIssued) {
          return { code: "CONFLICT", message: "Sammelrechnung darf keine Einzelrechnung enthalten." };
        }
        if (agreement.targetDays === null) {
          throw new Error("GOODS_OUT_COLLECTION_TERMS_INVALID");
        }
      } else if (agreement !== null) {
        if (
          invoiceNotIssued
          || !invoice
          || invoice.tenant_id !== tenantId
          || invoice.order_id !== order.id
          || invoice.status !== "issued"
          || toNonNegativeInteger(invoice.contract_version) !== 1
          || toNonNegativeInteger(invoice.payment_contract_version) !== PAYMENT_CONTRACT_VERSION
        ) {
          return { code: "VALIDATION_ERROR", message: "Rechnung fehlt." };
        }
      } else if (invoiceNotIssued) {
        if (!isRework && order.payment_mode !== "rechnung") {
          return { code: "CONFLICT", message: "Warenausgang erfordert eine gültige Rechnung." };
        }
      } else {
        if (
          isRework
          ||
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

      let reworkComplaint: ReworkComplaint | null = null;
      if (isRework) {
        const complaintRows = await tx.execute<ReworkComplaint>(sql`
          SELECT complaint_id, stand, nacharbeit_auftrag_id, version
          FROM public.v_complaint_rework_context_v1
          WHERE complaint_id = ${order.nacharbeit_zu}
          LIMIT 2
        `);
        const complaint = complaintRows[0];
        if (
          complaintRows.length !== 1 || !complaint
          || complaint.complaint_id !== order.nacharbeit_zu
          || complaint.stand !== "massnahme_nacharbeit"
          || complaint.nacharbeit_auftrag_id !== order.id
          || toNonNegativeInteger(complaint.version) === null
        ) {
          return { code: "CONFLICT", message: "Nacharbeit ist nicht ausgabefähig." };
        }
        reworkComplaint = complaint;
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

      if (agreement?.type === "sammelrechnung") {
        await attachOpenInvoiceCollection(tx, {
          tenantId,
          customerId: order.customer_id,
          orderId: order.id,
          actorId,
          targetDays: agreement.targetDays!,
        });
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
      const eventType = isRework ? EVENT_TYPE_V4 : agreement === null
        ? invoiceNotIssued ? EVENT_TYPE_V2 : EVENT_TYPE_V1
        : EVENT_TYPE_V3;
      const eventSchemaVersion = isRework ? 4 : agreement === null
        ? invoiceNotIssued ? 2 : 1
        : 3;
      const payload = isRework ? {
        complaintStateAfter: "abgeschlossen" as const,
        complaintStateBefore: "massnahme_nacharbeit" as const,
        gateAllowed: true,
        invoiceState: "not_issued" as const,
        mode: input.mode,
        orderId: order.id,
        orderVersion: nextVersion,
        paymentMode: "keiner" as const,
        reworkComplaintId: reworkComplaint!.complaint_id,
      } : agreement !== null ? {
        orderId: order.id,
        mode: input.mode,
        orderVersion: nextVersion,
        paymentMode: order.payment_mode,
        agreementId: agreement.id,
        agreementType: agreement.type,
        agreementVersion: agreement.version,
        settlement: agreement.type === "sammelrechnung" ? "collection" as const : "invoice" as const,
        gateAllowed: true,
      } : invoiceNotIssued ? {
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

      if (reworkComplaint) {
        const expectedComplaintVersion = toNonNegativeInteger(reworkComplaint.version);
        if (expectedComplaintVersion === null) throw new Error("REWORK_GOODS_OUT_COMPLAINT_VERSION_INVALID");
        const closed = await tx.execute<{ complaint_id: string; version: number | string }>(sql`
          UPDATE public.v_complaint_rework_context_v1
          SET stand = 'abgeschlossen',
              abschluss_art = 'nacharbeit_raus',
              abschluss_notiz = NULL,
              abgeschlossen_am = statement_timestamp() AT TIME ZONE 'UTC',
              abgeschlossen_von = ${actorId}::uuid,
              version = version + 1
          WHERE complaint_id = ${reworkComplaint.complaint_id}
            AND stand = 'massnahme_nacharbeit'
            AND nacharbeit_auftrag_id = ${order.id}
            AND version = ${expectedComplaintVersion}
          RETURNING complaint_id, version
        `);
        if (
          closed.length !== 1
          || closed[0]?.complaint_id !== reworkComplaint.complaint_id
          || toNonNegativeInteger(closed[0]?.version) !== expectedComplaintVersion + 1
        ) throw new Error("REWORK_GOODS_OUT_COMPLAINT_CLOSE_FAILED");
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
