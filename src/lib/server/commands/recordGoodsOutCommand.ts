import "server-only";
import {normalizeOfflineOriginal,offlineOccurrenceTime} from '@/lib/domain/offlineOriginal';
import {canonicalJson} from '@/lib/domain/canonicalJson';
import type {InvoiceCollectionPlanInput,InvoiceCollectionPlanReceipt,InvoiceCollectionRemoveInput,InvoiceCollectionRemoveReceipt} from '@/lib/domain/invoiceCollectionContract';
import {readReadyNotificationContext} from '@/lib/server/orderReleaseRead';
import {COLLECTION_PENDING_EVENT,COLLECTION_REPAIRED_EVENT,readCollectionFollowup,collectionFollowupDigest,type CollectionFollowupReceipt} from '@/lib/server/invoiceCollectionFollowupRead';
import {E_INVOICE_COPY,FINANCIAL_ACCESS_COPY,V45_TEXT,COLLECTION_FOLLOWUP_COPY} from '@/ui/situationCatalog';
import {isShipmentGroupInput,isShipmentGroupReceipt,type ShipmentGroupInput,type ShipmentGroupResult,type ShipmentGroupReceipt} from '@/lib/domain/shipmentGroupContract';
import type {ManualShipmentGroupState} from '@/modules/orders/public';
import type {CustomerCreditResult,CustomerCreditApplicationRead} from '@/modules/accounting/public';
import {buildCustomerCreditApplication} from '@/lib/server/paymentSummaryRead';
import {SHIPMENT_GROUP_COPY} from '@/ui/situationCatalog';
import {readOpenOrderComplaint} from '@/lib/server/orderReleaseRead';
import {COMPLAINT_ORDER_COPY,MANUAL_SHIPPING_COPY,MANUAL_SHIPPING_HANDOVER_LABEL,SHIPPING_FEE_COPY} from '@/ui/situationCatalog';

import { createHash, randomUUID } from "node:crypto";
import { GOODS_OUT_DEBT_COPY } from "@/ui/situationCatalog";
import { sql,type SQL } from "drizzle-orm";
import { readEffectiveCustomerAgreement,readEffectiveCustomerAgreements } from "@/lib/server/effectiveCustomerAgreementRead";
import { ORDER_LIFECYCLE_STATUS } from "@/modules/orders/public";
import {
  PAYMENT_CONTRACT_VERSION,
  isOrderPaymentMode,
  isPaymentMode,
  mapPaymentSummaryRow,
  readOrderPaymentSummaries,
  classifyOverdue,
  type OrderPaymentMode,
  type PaymentStatus,
} from "@/lib/server/paymentContract";
import { hasAuthorizationArea, resolveAuthorization, type AuthorizationSnapshot } from "@/lib/server/authorization";
import {
  withPrivilegedTenantTransaction,
  withTenantSavepoint,
  type PrivilegedTenantTransaction,
} from "@/lib/server/privilegedDb";
import { KREILE_TENANT_SLUG } from "@/lib/tenant";
import { createDomainAttachmentUploadGrant, DomainAttachmentStorageError, goodsOutSignaturePath } from '@/lib/server/domainAttachmentStorage';
import { isGoodsOutCollector, readGoodsOutCollector, verifyCollectorSignature, writeGoodsOutCollector, type GoodsOutCollector } from '@/lib/server/goodsOutCollector';

const EVENT_TYPE_V1 = "ORDER_PICKED_UP_V1" as const;
const EVENT_TYPE_V2 = "ORDER_PICKED_UP_V2" as const;
const EVENT_TYPE_V3 = "ORDER_PICKED_UP_V3" as const;
const EVENT_TYPE_V4 = "ORDER_PICKED_UP_V4" as const;
const SOURCE_STATION = ORDER_LIFECYCLE_STATUS.FERTIG;
const TARGET_STATION = ORDER_LIFECYCLE_STATUS.ABGEHOLT;
const GOODS_OUT_MODES = ["versand", "abholung"] as const;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

/** One qualification for the pre-write gate and the actual shipment update.
 * Labels and arbitrary parcel numbers are not a secured tracking receipt. */
function manualTrackingParcelPredicate(){return sql`
 shipment.status='created' AND shipment.shipped_at IS NULL
 AND length(btrim(shipment.tracking_number))>0
 AND EXISTS(SELECT 1 FROM public.events proof
   WHERE proof.tenant_id=shipment.tenant_id AND proof.order_id=shipment.order_id
     AND proof.event_type='SHIPMENT_MANUAL_TRACKING_SET_V1' AND proof.status='success'
     AND proof.user_id IS NOT NULL AND proof.payload->'receipt'->>'shipmentId'=shipment.id::text
     AND proof.payload->'receipt'->>'trackingNumber'=shipment.tracking_number
     AND proof.payload->'receipt'->>'carrier'=shipment.carrier)
`;}

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
  overdueReleaseReason?: string;
  collector?: GoodsOutCollector;
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
  overdueReleaseReason?: string;
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
  | { code: "ORDER_IN_COLLECTION"; message: string }
  | { code: "CONFLICT"; message: string; creditApplication?:CustomerCreditApplicationRead }
  | { code: "VALIDATION_ERROR"; message: string;source?:import('@/lib/domain/invoiceElectronicFields').InvoiceElectronicSourceLocation }
  | { code: "UNAVAILABLE"; message: string };

type LockedOrder = {
  release_ready:boolean;
  id: string;
  tenant_id: string;
  customer_id: string | null;
  station: string | null;
  current_station: string | null;
  current_station_id: string | null;
  status: string | null;
  version: number | string;
  payment_mode: string | null;
  handover_mode: string | null;
  nacharbeit_zu: string | null;
};

type ReworkComplaint = {
  complaint_id: string;
  stand: string | null;
  nacharbeit_auftrag_id: string | null;
  version: number | string | null;
};

type LockedInvoice = {
  belegart:'auftrag'|'versandkosten';
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
  const allowedKeys = [...expectedKeys, "agreement", "overdueReleaseReason", "collector"];
  return expectedKeys.every(key => Object.hasOwn(value, key))
    && Object.keys(value).every(key => allowedKeys.includes(key))
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
    && (!Object.hasOwn(value, "agreement") || isGoodsOutAgreement(value.agreement))
    && (!Object.hasOwn(value, "overdueReleaseReason") || validOverdueReleaseReason(value.overdueReleaseReason))
    && (!Object.hasOwn(value, 'collector') || (value.mode === 'abholung' && isGoodsOutCollector(value.collector)));
}

function validOverdueReleaseReason(value: unknown): value is string {
  return typeof value === "string" && value === value.trim() && value.length >= 3 && value.length <= 2000;
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

const GOODS_OUT_EVENT_COLUMNS=sql`id AS event_id, tenant_id, order_id, client_event_id::text,
 correlation_id::text, event_schema_version, aggregate_version, user_id::text AS actor_id,
 to_char(created_at, 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') AS occurred_at,
 status, station, from_station, event_type, payload`;
async function readEventsByClientId(
  tx: PrivilegedTenantTransaction,
  tenantId: string,
  clientEventId: string,
): Promise<GoodsOutEventRow[]> {
  return tx.execute<GoodsOutEventRow>(sql`
    SELECT ${GOODS_OUT_EVENT_COLUMNS}
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
      current_station_id, status, version, payment_mode, handover_mode, nacharbeit_zu,
      private.order_release_allowed_v1(tenant_id,id,true,true) AS release_ready
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
    SELECT id::text, tenant_id, order_id, status, contract_version, payment_contract_version,belegart
    FROM public.invoices
    WHERE tenant_id = ${tenantId}
      AND order_id = ${orderId}
      AND contract_version = 1
      AND status = 'issued'
    ORDER BY id
    FOR UPDATE
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

async function readReleaseAudit(tx: PrivilegedTenantTransaction, tenantId: string, receipt: GoodsOutReceipt): Promise<GoodsOutReceipt> {
  const rows = await tx.execute<{actor: string; payload: Record<string, unknown>}>(sql`
    SELECT audit.user_id::text AS actor, audit.payload
    FROM public.events audit
    WHERE audit.tenant_id = ${tenantId} AND audit.order_id = ${receipt.orderId}
      AND audit.correlation_id = ${receipt.correlationId}::uuid
      AND audit.event_type = 'ORDER_GOODS_OUT_DEBT_OVERRIDE_V1'
    LIMIT 2
  `);
  if (rows.length === 0) return receipt;
  const row = rows[0], payload = row?.payload;
  if (rows.length !== 1 || row.actor !== receipt.actorId || !payload
    || Object.keys(payload).sort().join(',') !== 'goodsOutEventId,invoiceId,reason'
    || payload.goodsOutEventId !== receipt.eventId
    || typeof payload.invoiceId !== 'string' || !UUID_PATTERN.test(payload.invoiceId)
    || !validOverdueReleaseReason(payload.reason)) throw new Error('GOODS_OUT_OVERRIDE_RECEIPT_INVALID');
  return {...receipt, overdueReleaseReason: payload.reason};
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
    && receipt.overdueReleaseReason === input.overdueReleaseReason
    && (input.agreement === undefined
      ? receiptAgreement === undefined
      : receiptAgreement !== undefined
        && receiptAgreement.id === input.agreement.id
        && receiptAgreement.version === input.agreement.version
        && receiptAgreement.type === input.agreement.type);
}

async function orderMatchesReceipt(tx:PrivilegedTenantTransaction,order: LockedOrder, receipt: GoodsOutReceipt, tenantId: string): Promise<boolean> {
  const currentVersion=toNonNegativeInteger(order.version);
  const physicalMatches=order.tenant_id === tenantId
    && order.id === receipt.orderId
    && order.station === TARGET_STATION
    && order.current_station === TARGET_STATION
    && order.current_station_id === TARGET_STATION
    && order.status === TARGET_STATION;
  if(!physicalMatches||currentVersion===null||currentVersion<receipt.orderVersion)return false;
  if(currentVersion===receipt.orderVersion)return true;
  // The existing canonical port proves every historical callback-only advance.
  // Never accept a changed version just because the order still looks released.
  const verified=await tx.execute<{order_id:string}>(sql`SELECT order_id FROM private.v_goods_out_ui_state_v1 WHERE tenant_id=${tenantId} AND order_id=${order.id} AND order_version=${currentVersion} AND goods_out_order_version=${receipt.orderVersion} AND goods_out_event_id=${receipt.eventId} AND integrity_ok=true LIMIT 2`);
  return verified.length===1&&verified[0]?.order_id===order.id;
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
const COLLECTION_PLAN_EVENT='ORDER_COLLECTION_PLANNED_V1';
const collectionPlanDigest=(value:unknown)=>createHash('sha256').update(canonicalJson(value)).digest('hex');
function collectionPlanInput(value:unknown):value is InvoiceCollectionPlanInput{
 if(!value||typeof value!=='object'||Array.isArray(value))return false;
 const input=value as InvoiceCollectionPlanInput;
 return Object.keys(input).sort().join(',')==='clientEventId,expectedVersion,orderId'
  &&isCanonicalTextId(input.orderId)&&typeof input.clientEventId==='string'&&UUID_PATTERN.test(input.clientEventId)
  &&Number.isSafeInteger(input.expectedVersion)&&input.expectedVersion>0;
}
function collectionPlanReceipt(row:GoodsOutEventRow,tenantId:string):InvoiceCollectionPlanReceipt{
 const payload=row.payload as {receipt?:InvoiceCollectionPlanReceipt;receiptSha256?:unknown;intent?:unknown};
 const receipt=payload?.receipt;
 if(!receipt||row.event_type!==COLLECTION_PLAN_EVENT||row.tenant_id!==tenantId||row.status!=='success'
  ||row.event_schema_version!==1||receipt.collectionPlanned!==true||receipt.eventId!==row.event_id
  ||receipt.orderId!==row.order_id||receipt.actorId!==row.actor_id||receipt.clientEventId!==row.client_event_id
  ||row.correlation_id!==receipt.clientEventId||row.aggregate_version!==receipt.orderVersion
  ||!isCanonicalTextId(receipt.customerId)||!UUID_PATTERN.test(receipt.freezeId)||!UUID_PATTERN.test(receipt.agreementId)
  ||!Number.isSafeInteger(receipt.agreementVersion)||receipt.agreementVersion<1
  ||toIso(receipt.recordedAt)!==receipt.recordedAt||toIso(row.occurred_at)!==receipt.recordedAt
  ||!collectionPlanInput({orderId:receipt.orderId,expectedVersion:receipt.orderVersion,clientEventId:receipt.clientEventId})
  ||payload.receiptSha256!==collectionPlanDigest(receipt)
  ||payload.intent!==collectionPlanDigest({orderId:receipt.orderId,expectedVersion:receipt.orderVersion,clientEventId:receipt.clientEventId}))throw Error('COLLECTION_PLAN_RECEIPT_INVALID');
 return receipt;
}

/** Read-only projection of the same immutable preparation and actual membership.
 * PL22:11 / N-Fakt-01: agreement plans; only a real receipt/member prepares. */
type OrderCollectionReadInput={orderId:string;orderVersion:number;customerId:string;freezeId:string|null;goodsOutEventId:string|null};
type CollectionMemberReadRow={collection_id:string;customer_id:string;source_valid:boolean};
function collectionPlansQuery(tenantId:string,orderId:string|SQL){return sql`SELECT ${GOODS_OUT_EVENT_COLUMNS} FROM public.events
  WHERE tenant_id=${tenantId} AND order_id=${orderId} AND event_type=${COLLECTION_PLAN_EVENT}
  ORDER BY created_at,id LIMIT 1001`;}
function collectionMembersQuery(tenantId:string,orderId:string|SQL,goodsOutEventId:string|SQL|null){return sql`
  SELECT member.collection_id::text,collection.customer_id,
   EXISTS(SELECT 1 FROM public.events physical WHERE physical.tenant_id=member.tenant_id AND physical.order_id=member.order_id
    AND physical.id=${goodsOutEventId} AND physical.event_type='ORDER_PICKED_UP_V3' AND physical.event_schema_version=3
    AND physical.status='success' AND physical.payload->>'settlement'='collection'
    AND to_char(physical.created_at AT TIME ZONE 'UTC' AT TIME ZONE 'Europe/Berlin','YYYY-MM-01')=to_char(collection.monat,'YYYY-MM-01')) AS source_valid
  FROM public.invoice_collection_orders member JOIN public.invoice_collections collection ON collection.tenant_id=member.tenant_id AND collection.id=member.collection_id
  WHERE member.tenant_id=${tenantId} AND member.order_id=${orderId} LIMIT 2`;}
function qualifyCollectionState(tenantId:string,input:OrderCollectionReadInput,agreement:Awaited<ReturnType<typeof readEffectiveCustomerAgreement>>,rows:GoodsOutEventRow[],members:CollectionMemberReadRow[]){
 if(rows.length>1000)throw Error('COLLECTION_PLAN_READ_LIMIT');
 const plans=rows.map(row=>collectionPlanReceipt(row,tenantId));
 if(plans.some(plan=>plan.orderId!==input.orderId||plan.orderVersion>input.orderVersion))throw Error('COLLECTION_PLAN_ORDER_VERSION_INVALID');
 const active=plans.filter(plan=>plan.freezeId===input.freezeId);
 if(active.length>1||active.some(plan=>plan.customerId!==input.customerId))throw Error('COLLECTION_PLAN_ACTIVE_SOURCE_INVALID');
 if(members.length>1||members.some(member=>member.customer_id!==input.customerId||member.source_valid!==true))throw Error('COLLECTION_MEMBER_READ_SOURCE_INVALID');
 const prepared=active.length===1||members.length===1;
 return {orderId:input.orderId,orderVersion:input.orderVersion,collectionPlanned:agreement?.type==='sammelrechnung'||prepared,
  collectionPrepared:prepared,preparationEventId:active[0]?.eventId??null,collectionId:members[0]?.collection_id??null};
}
export async function readOrderCollectionStateInTransaction(tx:PrivilegedTenantTransaction,auth:Pick<AuthorizationSnapshot,'tenantId'>,input:OrderCollectionReadInput){
 const states=await readOrderCollectionStatesInTransaction(tx,auth,[input]);
 const state=states.get(input.orderId);if(state===undefined)throw Error("COLLECTION_PLAN_SOURCE_MISSING");return state;
}

/** Every receipt, freeze and physical member is qualified by the same single/set reader. */
export async function readOrderCollectionStatesInTransaction(tx:PrivilegedTenantTransaction,auth:Pick<AuthorizationSnapshot,'tenantId'>,inputs:readonly OrderCollectionReadInput[]):Promise<Map<string,ReturnType<typeof qualifyCollectionState>>>{
 const requested=new Map<string,OrderCollectionReadInput>(),result=new Map<string,ReturnType<typeof qualifyCollectionState>>();
 for(const input of inputs){const prior=requested.get(input.orderId);if(prior&&canonicalJson(prior)!==canonicalJson(input))throw Error('COLLECTION_PLAN_ORDER_VERSION_INVALID');requested.set(input.orderId,input);}
 if(!requested.size)return result;
 const values=[...requested.values()],agreements=await readEffectiveCustomerAgreements(tx,auth.tenantId,values);
 const plans=await tx.execute<{order_id:string;records:GoodsOutEventRow[]}>(sql`SELECT requested.order_id,ARRAY(SELECT to_jsonb(source) FROM (${collectionPlansQuery(auth.tenantId,sql`requested.order_id`)}) source) AS records
  FROM unnest(ARRAY[${sql.join(values.map(input=>sql`${input.orderId}`),sql`, `)}]::text[]) requested(order_id)`);
 const members=await tx.execute<{order_id:string;records:CollectionMemberReadRow[]}>(sql`SELECT requested.order_id,ARRAY(SELECT to_jsonb(source) FROM (${collectionMembersQuery(auth.tenantId,sql`requested.order_id`,sql`requested.goods_out_event_id`)}) source) AS records
  FROM unnest(ARRAY[${sql.join(values.map(input=>sql`${input.orderId}`),sql`, `)}]::text[],ARRAY[${sql.join(values.map(input=>sql`${input.goodsOutEventId}`),sql`, `)}]::text[]) requested(order_id,goods_out_event_id)`);
 const planRows=new Map<string,GoodsOutEventRow[]>(),memberRows=new Map<string,CollectionMemberReadRow[]>();
 for(const row of plans){if(!requested.has(row.order_id)||planRows.has(row.order_id)||!Array.isArray(row.records))throw Error('COLLECTION_PLAN_SOURCE_MISSING');planRows.set(row.order_id,row.records);}
 for(const row of members){if(!requested.has(row.order_id)||memberRows.has(row.order_id)||!Array.isArray(row.records))throw Error('COLLECTION_MEMBER_READ_SOURCE_INVALID');memberRows.set(row.order_id,row.records);}
 for(const input of values){
  const agreement=agreements.get(input.orderId),plans=planRows.get(input.orderId),members=memberRows.get(input.orderId);
  if(agreement===undefined||!plans||!members)throw Error('COLLECTION_PLAN_SOURCE_MISSING');
  result.set(input.orderId,qualifyCollectionState(auth.tenantId,input,agreement,plans,members));
 }
 return result;
}

/** Same collection writer, preparation phase only; actual attachment stays in physical completion. */
export async function addOrderToCollection(input:unknown){
 if(!collectionPlanInput(input))return {code:'VALIDATION_ERROR' as const,message:E_INVOICE_COPY.collectionInvalid};
 const authorization=await resolveAuthorization();
 if(!authorization.ok)return {code:authorization.reason==='AUTHORIZATION_UNAVAILABLE'?'UNAVAILABLE' as const:'UNAUTHENTICATED' as const,message:E_INVOICE_COPY.collectionChangeUnavailable};
 const auth=authorization.data;
 if(!hasAuthorizationArea(auth,'preise'))return {code:'FORBIDDEN' as const,message:FINANCIAL_ACCESS_COPY.pricesMissing};
 try{return await withPrivilegedTenantTransaction(auth,async tx=>{
  await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtextextended('f1:goods-out:client-event:'||${auth.tenantId}||':'||${input.clientEventId},0))`);
  const prior=await readEventsByClientId(tx,auth.tenantId,input.clientEventId);
  if(prior.length){
   if(prior.length!==1||prior[0].event_type!==COLLECTION_PLAN_EVENT)return {code:'CONFLICT' as const,message:E_INVOICE_COPY.collectionConflict};
   const receipt=collectionPlanReceipt(prior[0],auth.tenantId);
   if(receipt.actorId!==auth.userId||collectionPlanDigest(input)!==(prior[0].payload as {intent:string}).intent)return {code:'CONFLICT' as const,message:E_INVOICE_COPY.collectionConflict};
   return {code:'OK' as const,receipt,replayed:true};
  }
  const orders=await readOrder(tx,auth.tenantId,input.orderId,true),order=orders[0];
  if(orders.length!==1||!order||order.tenant_id!==auth.tenantId||!order.customer_id||order.nacharbeit_zu!==null)return {code:'CONFLICT' as const,message:E_INVOICE_COPY.collectionConflict};
  const context=await readReadyNotificationContext(tx,auth.tenantId,input.orderId);
  if(!context||context.version!==input.expectedVersion)return {code:'CONFLICT' as const,message:E_INVOICE_COPY.collectionConflict};
  const agreement=await readEffectiveCustomerAgreement(tx,{tenantId:auth.tenantId,customerId:order.customer_id,orderId:order.id,lock:true});
  if(agreement?.type!=='sammelrechnung'||agreement.targetDays===null)return {code:'CONFLICT' as const,message:E_INVOICE_COPY.collectionConflict};
  const existing=await tx.execute<{client_event_id:string}>(sql`SELECT client_event_id::text FROM public.events WHERE tenant_id=${auth.tenantId} AND order_id=${order.id} AND event_type=${COLLECTION_PLAN_EVENT} AND payload#>>'{receipt,freezeId}'=${context.freeze_id} ORDER BY created_at,id LIMIT 2`);
  if(existing.length){
   if(existing.length!==1)throw Error('COLLECTION_PLAN_AMBIGUOUS');
   const rows=await readEventsByClientId(tx,auth.tenantId,existing[0].client_event_id);
   if(rows.length!==1)throw Error('COLLECTION_PLAN_SOURCE_MISSING');
   return {code:'OK' as const,receipt:collectionPlanReceipt(rows[0],auth.tenantId),replayed:true};
  }
  const receipt=await attachOpenInvoiceCollection(tx,{tenantId:auth.tenantId,customerId:order.customer_id,orderId:order.id,actorId:auth.userId,targetDays:agreement.targetDays,plan:{input,freezeId:context.freeze_id,agreementId:agreement.id,agreementVersion:agreement.version}});
  if(!receipt)throw Error('COLLECTION_PLAN_NOT_SAVED');
  const rows=await readEventsByClientId(tx,auth.tenantId,input.clientEventId);
  if(rows.length!==1||canonicalJson(collectionPlanReceipt(rows[0],auth.tenantId))!==canonicalJson(receipt))throw Error('COLLECTION_PLAN_PROOF_MISSING');
  return {code:'OK' as const,receipt,replayed:false};
 });}catch(error){console.error('[COLLECTION_PLAN_FAILED]',error instanceof Error?error.message:'UnknownError');return {code:'UNAVAILABLE' as const,message:E_INVOICE_COPY.collectionChangeUnavailable};}
}

const COLLECTION_REMOVED_EVENT='ORDER_COLLECTION_MEMBER_REMOVED_V1';
function collectionRemoveInput(value:unknown):value is InvoiceCollectionRemoveInput{
 if(!value||typeof value!=='object'||Array.isArray(value))return false;
 const input=value as InvoiceCollectionRemoveInput;
 return Object.keys(input).sort().join(',')==='clientEventId,collectionId,expectedVersion,orderId'
  &&isCanonicalTextId(input.orderId)&&typeof input.collectionId==='string'&&UUID_PATTERN.test(input.collectionId)
  &&typeof input.clientEventId==='string'&&UUID_PATTERN.test(input.clientEventId)&&Number.isSafeInteger(input.expectedVersion)&&input.expectedVersion>0;
}
function collectionRemovalReceipt(row:GoodsOutEventRow,tenantId:string):InvoiceCollectionRemoveReceipt{
 const payload=row.payload as {receipt?:InvoiceCollectionRemoveReceipt;receiptSha256?:unknown;intent?:unknown},r=payload?.receipt;
 if(!r||row.event_type!==COLLECTION_REMOVED_EVENT||row.tenant_id!==tenantId||row.status!=='success'
  ||row.event_schema_version!==1||r.eventId!==row.event_id||r.orderId!==row.order_id||r.actorId!==row.actor_id
  ||r.clientEventId!==row.client_event_id||row.correlation_id!==r.clientEventId||row.aggregate_version!==r.orderVersion
  ||!Number.isSafeInteger(r.orderVersion)||r.orderVersion<1||!isCanonicalTextId(r.customerId)||!UUID_PATTERN.test(r.goodsOutEventId)
  ||r.collectionVersionAfter!==r.collectionVersion+1||!Number.isFinite(Date.parse(r.memberCreatedAt))
  ||toIso(r.recordedAt)!==r.recordedAt||toIso(row.occurred_at)!==r.recordedAt
  ||!collectionRemoveInput({collectionId:r.collectionId,orderId:r.orderId,expectedVersion:r.collectionVersion,clientEventId:r.clientEventId})
  ||payload.receiptSha256!==collectionPlanDigest(r)
  ||payload.intent!==collectionPlanDigest({collectionId:r.collectionId,orderId:r.orderId,expectedVersion:r.collectionVersion,clientEventId:r.clientEventId}))throw Error('COLLECTION_REMOVAL_RECEIPT_INVALID');
 return r;
}

/** A14/E14: remove only from an open collection; preserve the real physical source and full relation history. */
export async function removeOrderFromCollection(input:unknown){
 if(!collectionRemoveInput(input))return {code:'VALIDATION_ERROR' as const,message:E_INVOICE_COPY.collectionInvalid};
 const authorization=await resolveAuthorization();
 if(!authorization.ok)return {code:authorization.reason==='AUTHORIZATION_UNAVAILABLE'?'UNAVAILABLE' as const:'UNAUTHENTICATED' as const,message:E_INVOICE_COPY.collectionChangeUnavailable};
 const auth=authorization.data;
 if(!hasAuthorizationArea(auth,'preise'))return {code:'FORBIDDEN' as const,message:FINANCIAL_ACCESS_COPY.pricesMissing};
 try{return await withPrivilegedTenantTransaction(auth,async tx=>{
  await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtextextended('f1:goods-out:client-event:'||${auth.tenantId}||':'||${input.clientEventId},0))`);
  const prior=await readEventsByClientId(tx,auth.tenantId,input.clientEventId);
  if(prior.length){
   if(prior.length!==1||prior[0].event_type!==COLLECTION_REMOVED_EVENT)return {code:'CONFLICT' as const,message:E_INVOICE_COPY.collectionConflict};
   const receipt=collectionRemovalReceipt(prior[0],auth.tenantId);
   if(receipt.actorId!==auth.userId||collectionPlanDigest(input)!==(prior[0].payload as {intent:string}).intent)return {code:'CONFLICT' as const,message:E_INVOICE_COPY.collectionConflict};
   return {code:'OK' as const,receipt,replayed:true};
  }
  const selected=await tx.execute<{customer_id:string}>(sql`SELECT customer_id FROM public.invoice_collections WHERE tenant_id=${auth.tenantId} AND id=${input.collectionId}::uuid LIMIT 2`);
  if(selected.length!==1)return {code:'NOT_FOUND' as const,message:E_INVOICE_COPY.collectionInvalid};
  const customerId=selected[0].customer_id;
  // Same customer -> order -> collection order as native issuance.
  await tx.execute(sql`SELECT private.lock_shipping_customer_v1(${auth.tenantId},${customerId})`);
  const orders=await readOrder(tx,auth.tenantId,input.orderId,true),order=orders[0];
  if(orders.length!==1||!order||order.customer_id!==customerId||order.station!==TARGET_STATION||order.current_station!==TARGET_STATION||order.current_station_id!==TARGET_STATION||order.status!==TARGET_STATION||order.payment_mode!=='rechnung')return {code:'CONFLICT' as const,message:E_INVOICE_COPY.collectionConflict};
  const collections=await tx.execute<{customer_id:string;version:number;status:string;invoice_id:string|null}>(sql`SELECT customer_id,version,status,invoice_id::text FROM public.invoice_collections WHERE tenant_id=${auth.tenantId} AND id=${input.collectionId}::uuid FOR UPDATE`),collection=collections[0];
  if(collections.length!==1||!collection||collection.customer_id!==customerId||collection.version!==input.expectedVersion)return {code:'CONFLICT' as const,message:E_INVOICE_COPY.collectionConflict};
  if(collection.status!=='offen'||collection.invoice_id!==null)return {code:'CONFLICT' as const,message:E_INVOICE_COPY.collectionNotDue};
  const member=await tx.execute<{created_at:string}>(sql`SELECT created_at::text FROM public.invoice_collection_orders WHERE tenant_id=${auth.tenantId} AND collection_id=${input.collectionId}::uuid AND order_id=${order.id} FOR UPDATE`);
  if(member.length!==1)return {code:'CONFLICT' as const,message:E_INVOICE_COPY.collectionConflict};
  const physical=await tx.execute<{client_event_id:string}>(sql`SELECT client_event_id::text FROM public.events WHERE tenant_id=${auth.tenantId} AND order_id=${order.id} AND event_type='ORDER_PICKED_UP_V3' AND aggregate_version=${order.version} LIMIT 2`);
  if(physical.length!==1)throw Error('COLLECTION_REMOVAL_PHYSICAL_SOURCE_MISSING');
  const physicalRows=await readEventsByClientId(tx,auth.tenantId,physical[0].client_event_id);
  if(physicalRows.length!==1)throw Error('COLLECTION_REMOVAL_PHYSICAL_SOURCE_AMBIGUOUS');
  const goods=parseEvent(physicalRows[0],auth.tenantId);
  if(goods.eventSchemaVersion!==3||goods.settlement!=='collection'||goods.orderId!==order.id||goods.orderVersion!==order.version)throw Error('COLLECTION_REMOVAL_PHYSICAL_SOURCE_INVALID');
  const [clock]=await tx.execute<{recorded_at:string}>(sql`SELECT to_char(statement_timestamp() AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') AS recorded_at`);
  if(!clock||toIso(clock.recorded_at)!==clock.recorded_at)throw Error('COLLECTION_REMOVAL_CLOCK_INVALID');
  const receipt:InvoiceCollectionRemoveReceipt={eventId:randomUUID(),orderId:order.id,orderVersion:goods.orderVersion,customerId,collectionId:input.collectionId,collectionVersion:collection.version,collectionVersionAfter:collection.version+1,goodsOutEventId:goods.eventId,memberCreatedAt:member[0].created_at,actorId:auth.userId,clientEventId:input.clientEventId,recordedAt:clock.recorded_at};
  const saved=await tx.execute<{id:string}>(sql`INSERT INTO public.events(id,tenant_id,order_id,event_type,description,user_id,client_event_id,correlation_id,event_schema_version,status,aggregate_version,payload,created_at)
   VALUES(${receipt.eventId},${auth.tenantId},${order.id},${COLLECTION_REMOVED_EVENT},${E_INVOICE_COPY.collectionRemoved},${auth.userId}::uuid,${input.clientEventId}::uuid,${input.clientEventId}::uuid,1,'success',${order.version},${JSON.stringify({intent:collectionPlanDigest(input),receipt,receiptSha256:collectionPlanDigest(receipt)})}::jsonb,${receipt.recordedAt}::timestamptz) RETURNING id`);
  if(saved.length!==1||saved[0].id!==receipt.eventId)throw Error('COLLECTION_REMOVAL_NOT_SAVED');
  await tx.execute(sql`SELECT set_config('app.collection_member_command','remove-v1',true)`);
  const removed=await tx.execute<{order_id:string}>(sql`DELETE FROM public.invoice_collection_orders WHERE tenant_id=${auth.tenantId} AND collection_id=${input.collectionId}::uuid AND order_id=${order.id} RETURNING order_id`);
  if(removed.length!==1||removed[0].order_id!==order.id)throw Error('COLLECTION_REMOVAL_MEMBER_NOT_SAVED');
  const updated=await tx.execute<{version:number}>(sql`UPDATE public.invoice_collections SET version=version+1 WHERE tenant_id=${auth.tenantId} AND id=${input.collectionId}::uuid AND version=${input.expectedVersion} AND status='offen' AND invoice_id IS NULL RETURNING version`);
  if(updated.length!==1||updated[0].version!==receipt.collectionVersionAfter)throw Error('COLLECTION_REMOVAL_VERSION_NOT_SAVED');
  const rows=await readEventsByClientId(tx,auth.tenantId,input.clientEventId);
  if(rows.length!==1||canonicalJson(collectionRemovalReceipt(rows[0],auth.tenantId))!==canonicalJson(receipt))throw Error('COLLECTION_REMOVAL_PROOF_MISSING');
  return {code:'OK' as const,receipt,replayed:false};
 });}catch(error){console.error('[COLLECTION_REMOVAL_FAILED]',error instanceof Error?error.message:'UnknownError');return {code:'UNAVAILABLE' as const,message:E_INVOICE_COPY.collectionChangeUnavailable};}
}

export async function attachOpenInvoiceCollection(
  tx: PrivilegedTenantTransaction,
  input: {
    tenantId: string;
    customerId: string;
    orderId: string;
    actorId: string;
    targetDays: number;
    physicalMonth?:string;
    plan?:{input:InvoiceCollectionPlanInput;freezeId:string;agreementId:string;agreementVersion:number};
  },
): Promise<InvoiceCollectionPlanReceipt|undefined> {
  if(input.plan){
    const plan=input.plan;
    const [clock]=await tx.execute<{recorded_at:string}>(sql`SELECT to_char(statement_timestamp() AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') AS recorded_at`);
    if(!clock||toIso(clock.recorded_at)!==clock.recorded_at)throw Error('COLLECTION_PLAN_CLOCK_INVALID');
    const receipt:InvoiceCollectionPlanReceipt={eventId:randomUUID(),orderId:input.orderId,orderVersion:plan.input.expectedVersion,customerId:input.customerId,freezeId:plan.freezeId,agreementId:plan.agreementId,agreementVersion:plan.agreementVersion,actorId:input.actorId,clientEventId:plan.input.clientEventId,recordedAt:clock.recorded_at,collectionPlanned:true};
    const saved=await tx.execute<{id:string}>(sql`INSERT INTO public.events(id,tenant_id,order_id,event_type,description,user_id,client_event_id,correlation_id,event_schema_version,status,aggregate_version,payload,created_at)
      VALUES(${receipt.eventId},${input.tenantId},${input.orderId},${COLLECTION_PLAN_EVENT},${V45_TEXT.collection$prepared},${input.actorId}::uuid,${receipt.clientEventId}::uuid,${receipt.clientEventId}::uuid,1,'success',${receipt.orderVersion},${JSON.stringify({intent:collectionPlanDigest(plan.input),receipt,receiptSha256:collectionPlanDigest(receipt)})}::jsonb,${receipt.recordedAt}::timestamptz) RETURNING id`);
    if(saved.length!==1||saved[0].id!==receipt.eventId)throw Error('COLLECTION_PLAN_WRITE_FAILED');
    return receipt;
  }
  const monthRows = await tx.execute<BerlinMonthRow>(sql`
    SELECT to_char(
      coalesce(${input.physicalMonth??null}::date,date_trunc('month', timezone('Europe/Berlin', clock_timestamp()))::date),
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
    SELECT id::text, tenant_id, customer_id, status
    FROM public.invoice_collections
    WHERE tenant_id = ${input.tenantId}
      AND customer_id = ${input.customerId}
      AND monat = ${month}::date
      AND status = 'offen'
    FOR UPDATE
  `);
  if (collections.length === 0) {
    collections = await tx.execute<InvoiceCollectionRow>(sql`
      INSERT INTO public.invoice_collections (
        tenant_id, customer_id, monat, status, created_by
      ) VALUES (
        ${input.tenantId}, ${input.customerId}, ${month}::date, 'offen', ${input.actorId}::uuid
      )
      RETURNING id::text, tenant_id, customer_id, status
    `);
  }
  const collection = collections[0];
  if (
    collections.length !== 1
    || !collection
    || collection.tenant_id !== input.tenantId
    || collection.customer_id !== input.customerId
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

/** Only this existing attach writer repairs the real physical source/month. */
async function repairCollectionFollowup(tx:PrivilegedTenantTransaction,auth:AuthorizationSnapshot,markerId:string){
 let source=await readCollectionFollowup(tx,auth.tenantId,{markerId});
 if(!source)throw Error('COLLECTION_FOLLOWUP_SOURCE_MISSING');
 if(!source.pending)return;
 await tx.execute(sql`SELECT id FROM public.customers WHERE tenant_id=${auth.tenantId} AND id=${source.customerId} FOR UPDATE NOWAIT`);
 await tx.execute(sql`SELECT id FROM public.orders WHERE tenant_id=${auth.tenantId} AND id=${source.orderId} FOR UPDATE NOWAIT`);
 source=await readCollectionFollowup(tx,auth.tenantId,{markerId});
 if(!source)throw Error('COLLECTION_FOLLOWUP_SOURCE_MISSING');
 if(!source.pending)return;
 await attachOpenInvoiceCollection(tx,{tenantId:auth.tenantId,customerId:source.customerId,orderId:source.orderId,actorId:source.actorId,targetDays:source.targetDays,physicalMonth:source.month});
 const members=await tx.execute<{id:string;version:number}>(sql`SELECT collection.id::text,collection.version FROM public.invoice_collection_orders member JOIN public.invoice_collections collection ON collection.tenant_id=member.tenant_id AND collection.id=member.collection_id
 WHERE member.tenant_id=${auth.tenantId} AND member.order_id=${source.orderId} AND collection.customer_id=${source.customerId} AND collection.monat=${source.month}::date AND collection.status='offen'`);
 if(members.length!==1)throw Error('COLLECTION_FOLLOWUP_REPAIR_MEMBERSHIP_MISSING');
 const id=randomUUID(),payload={markerId,goodsOutEventId:source.goodsOutEventId,collectionId:members[0].id,collectionVersion:members[0].version,originalActorId:source.actorId,actorId:auth.userId};
 const saved=await tx.execute<{id:string}>(sql`INSERT INTO public.events(id,tenant_id,order_id,event_type,description,user_id,client_event_id,correlation_id,event_schema_version,status,aggregate_version,payload,created_at)
  VALUES(${id},${auth.tenantId},${source.orderId},${COLLECTION_REPAIRED_EVENT},${COLLECTION_FOLLOWUP_COPY.repairedHistory},${auth.userId}::uuid,${id}::uuid,${source.correlationId}::uuid,1,'success',${source.orderVersion},${JSON.stringify(payload)}::jsonb,clock_timestamp() AT TIME ZONE 'UTC') RETURNING id`);
 const proof=await readCollectionFollowup(tx,auth.tenantId,{markerId});
 if(saved.length!==1||saved[0].id!==id||!proof||proof.pending)throw Error('COLLECTION_FOLLOWUP_REPAIR_RECEIPT_MISSING');
}
/** Called by the normal TaskWriter after its existing completion authority. */
export async function repairCollectionFollowupTask(tx:PrivilegedTenantTransaction,auth:AuthorizationSnapshot,task:{client_key:string;bezug_typ:string;bezug_id:string|null;erstellt_von:string}){
 const source=await readCollectionFollowup(tx,auth.tenantId,{markerId:task.client_key});
 if(!source)return;
 if(task.bezug_typ!=='auftrag'||task.bezug_id!==source.orderId||task.erstellt_von!==source.actorId)throw Error('COLLECTION_FOLLOWUP_TASK_SOURCE_CHANGED');
 await repairCollectionFollowup(tx,auth,source.eventId);
}

export async function authorizeGoodsOutInput(input: unknown): Promise<
  {code: 'AUTHORIZED'; input: RecordGoodsOutInput; authorization: {data: AuthorizationSnapshot}}
  | Exclude<RecordGoodsOutResult, {code: 'OK'}>
> {
  if (!isValidInput(input)) {
    const reasonInvalid = input !== null && typeof input === "object" && Object.hasOwn(input, "overdueReleaseReason")
      && !validOverdueReleaseReason((input as Record<string, unknown>).overdueReleaseReason);
    return { code: "VALIDATION_ERROR", message: reasonInvalid ? GOODS_OUT_DEBT_COPY.reasonMissing : "Ungültiger Warenausgang." };
  }

  const actor = await authorizeGoodsOutActor();
  if (actor.code !== 'AUTHORIZED') return actor;
  if (input.overdueReleaseReason !== undefined && !hasAuthorizationArea(actor.authorization.data, "entscheiden")) {
    return { code: "FORBIDDEN", message: GOODS_OUT_DEBT_COPY.overrideForbidden };
  }
  return { ...actor, input };
}

async function authorizeGoodsOutActor(): Promise<
  { code: 'AUTHORIZED'; authorization: { data: AuthorizationSnapshot } } | Exclude<RecordGoodsOutResult, {code:'OK'}>
> {
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

  return {code: 'AUTHORIZED', authorization};
}

export async function prepareGoodsOutSignatureUpload(input: Pick<RecordGoodsOutInput, 'orderId' | 'expectedVersion' | 'clientEventId'>) {
  if (!input || !isCanonicalTextId(input.orderId) || !Number.isSafeInteger(input.expectedVersion) || input.expectedVersion < 1
    || typeof input.clientEventId !== 'string' || !UUID_PATTERN.test(input.clientEventId)) {
    return { code: 'VALIDATION_ERROR' as const, message: 'Ungültiger Warenausgang.' };
  }
  const actor = await authorizeGoodsOutActor();
  if (actor.code !== 'AUTHORIZED') return actor;
  const auth = actor.authorization.data;
  try {
    const [order] = await withPrivilegedTenantTransaction(auth, tx => readOrder(tx, auth.tenantId, input.orderId, false));
    if (!order) return { code: 'NOT_FOUND' as const, message: 'Auftrag nicht verfügbar.' };
    if (order.handover_mode !== 'pickup' || order.station !== SOURCE_STATION || toNonNegativeInteger(order.version) !== input.expectedVersion) {
      return { code: 'CONFLICT' as const, message: 'Auftrag wurde bereits geändert.' };
    }
    const grant = await createDomainAttachmentUploadGrant(goodsOutSignaturePath(auth.tenantId, input.clientEventId));
    return { code: 'OK' as const, storagePath: grant.path, token: grant.token };
  } catch {
    return { code: 'UNAVAILABLE' as const, message: 'Warenausgang konnte nicht sicher gebucht werden.' };
  }
}

export type GoodsOutComposition={
  synchronizeCollectionFollowup?:(tx:PrivilegedTenantTransaction,auth:AuthorizationSnapshot,markerId:string)=>Promise<void>;
  readCredit?:(tx:PrivilegedTenantTransaction,auth:AuthorizationSnapshot,customerId:string)=>Promise<CustomerCreditResult>;
  beforeOrderLock?:(tx:PrivilegedTenantTransaction,auth:AuthorizationSnapshot)=>Promise<void>;
  beforeWrite?:(tx:PrivilegedTenantTransaction,auth:AuthorizationSnapshot)=>Promise<Exclude<RecordGoodsOutResult,{code:'OK'}>|null>;
  afterWrite?:(tx:PrivilegedTenantTransaction,auth:AuthorizationSnapshot)=>Promise<void>;
  afterWriteFailure?:(tx:PrivilegedTenantTransaction,auth:AuthorizationSnapshot,receipt:GoodsOutReceipt)=>Promise<void>;
};
class GoodsOutRejected extends Error{
  constructor(readonly result:Exclude<RecordGoodsOutResult,{code:'OK'}>){super('GOODS_OUT_REJECTED');}
}

type ShipmentSelection={ids:string[];groupEventId:string;trackingNumber:string;carrier:string;partial:boolean;deviceCapturedAt?:string};
type PreparedGoodsOut={code:'PREPARED';partialOverride?:{invoiceId:string;reason:string};complete:()=>Promise<GoodsOutReceipt|null>};
type GoodsOutAuthorization=Extract<Awaited<ReturnType<typeof authorizeGoodsOutInput>>,{code:'AUTHORIZED'}>;
/** One canonical gate/physical writer. The group composition prepares every
 * member in its outer transaction before invoking any physical completion. */
async function prepareGoodsOut(tx:PrivilegedTenantTransaction,authorized:GoodsOutAuthorization,composition?:GoodsOutComposition,selection?:ShipmentSelection):Promise<RecordGoodsOutResult|PreparedGoodsOut>{
 const {input,authorization}=authorized,tenantId=authorization.data.tenantId,actorId=authorization.data.userId;
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
        const receipt = await readReleaseAudit(tx, tenantId, parseEvent(existingEvents[0], tenantId));
        if (!receiptMatchesIntent(receipt, input, actorId)) {
          return { code: "CONFLICT", message: "Anfragekennung wurde bereits anders verwendet." };
        }
        const orders = await readOrder(tx, tenantId, receipt.orderId, false);
        if (orders.length !== 1 || !orders[0] || !await orderMatchesReceipt(tx,orders[0], receipt, tenantId)) {
          throw new Error("GOODS_OUT_REPLAY_READBACK_INVALID");
        }
        if (input.mode === 'abholung') {
          const saved = await readGoodsOutCollector(tx, tenantId, receipt.orderId, receipt.eventId);
          if (canonicalJson(saved?.collector ?? null) !== canonicalJson(input.collector ?? null)) {
            return { code: 'CONFLICT', message: 'Anfragekennung wurde bereits anders verwendet.' };
          }
        }
        return { code: "OK", receipt, replayed: true };
      }

      // Invoice advisory locks must precede the shared order-row lock to avoid
      // deadlock with a simultaneous standalone invoice action.
      if(!selection)await composition?.beforeOrderLock?.(tx,authorization.data);
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

      const {readPendingInvoiceReissue}=await import('./immutableInvoiceCommand');
      const pendingReissue=await readPendingInvoiceReissue(tx,tenantId,order.id);
      if(pendingReissue!==null)return {code:'CONFLICT',message:SHIPPING_FEE_COPY.reissueReleaseBlocked(pendingReissue)};

      // This decision uses invoice facts even when the actor cannot see money.
      // Do not use the visibility-filtered customer-hints projection as a gate.
      const overdueInvoices = isRework ? [] : await tx.execute<{ id: string; invoice_number: string }>(sql`
        SELECT invoice.id::text, invoice.invoice_number
        FROM public.invoices invoice
        WHERE invoice.tenant_id = ${tenantId}
          AND invoice.customer_id = ${order.customer_id}
          AND ${classifyOverdue()}
        ORDER BY invoice.due_date, invoice.id
        LIMIT 1
        FOR SHARE
      `);
      if (overdueInvoices.length > 0 && input.overdueReleaseReason === undefined) {
        let creditApplication:CustomerCreditApplicationRead|undefined;
        if(hasAuthorizationArea(authorization.data,'zahlungen')&&composition?.readCredit){
          const customerId=order.customer_id;
          try{creditApplication=await withTenantSavepoint(tx,async nested=>{
            const source=await readOrderPaymentSummaries(nested,tenantId,{invoiceId:overdueInvoices[0].id});
            if(source.length!==1)return {code:'SOURCE_INCOMPLETE' as const};
            const payment=mapPaymentSummaryRow(source[0],authorization.data);
            if(payment.invoiceId!==overdueInvoices[0].id)throw Error('GOODS_OUT_CREDIT_INVOICE_SOURCE_MISMATCH');
            return buildCustomerCreditApplication(await composition.readCredit!(nested,authorization.data,customerId),payment);
          });}catch{creditApplication={code:'SOURCE_INCOMPLETE'};}
        }
        return {
          code: "CONFLICT",
          ...(creditApplication?{creditApplication}:{}),
          message: GOODS_OUT_DEBT_COPY.blocked(
            hasAuthorizationArea(authorization.data, "zahlungen")
              ? overdueInvoices[0].invoice_number
              : undefined,
          ),
        };
      }
      if (overdueInvoices.length === 0 && input.overdueReleaseReason !== undefined) {
        return { code: "CONFLICT", message: GOODS_OUT_DEBT_COPY.noLongerBlocked };
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
      // Payment and debt are checked by the existing validated contracts below
      // and above (including explicit agreement/override). Never trust the cache.
      if (order.release_ready !== true) {
        return { code: "CONFLICT", message: "Ausgabe ist noch nicht freigegeben. Zahlung oder Abschluss fehlt." };
      }

      if (input.collector) {
        if (order.handover_mode !== 'pickup') return { code: 'VALIDATION_ERROR', message: 'Ungültiger Warenausgang.' };
        try {
          if (!await verifyCollectorSignature(tenantId, input.clientEventId, input.collector.unterschrift)) {
            return { code: 'VALIDATION_ERROR', message: 'Ungültiger Warenausgang.' };
          }
        } catch (error) {
          if (!(error instanceof DomainAttachmentStorageError) || error.kind === 'UNAVAILABLE') throw error;
          return { code: 'VALIDATION_ERROR', message: 'Ungültiger Warenausgang.' };
        }
      }

      if(input.mode==='versand'){
        if(!selection){
          const tracked=await tx.execute<{id:string}>(sql`SELECT shipment.id::text
            FROM public.shipments shipment WHERE shipment.tenant_id=${tenantId}
              AND shipment.order_id=${order.id} AND ${manualTrackingParcelPredicate()}
            ORDER BY shipment.id FOR UPDATE OF shipment`);
          if(!tracked.length)return {code:'VALIDATION_ERROR',message:MANUAL_SHIPPING_COPY.TRACKING_NUMBER_MISSING};
          // Legacy whole-order release must never hide an unproven second parcel.
          const outstanding=await tx.execute<{id:string}>(sql`SELECT shipment.id::text FROM public.shipments shipment
            WHERE shipment.tenant_id=${tenantId} AND shipment.order_id=${order.id} AND shipment.status<>'cancelled'
              AND shipment.shipped_at IS NULL AND NOT (${manualTrackingParcelPredicate()}) LIMIT 1`);
          if(outstanding.length)return {code:'VALIDATION_ERROR',message:MANUAL_SHIPPING_COPY.TRACKING_NUMBER_MISSING};
          const shared=await tx.execute<{id:string}>(sql`SELECT other.id::text FROM public.shipments own JOIN public.shipments other
            ON other.tenant_id=own.tenant_id AND other.sendung_id=own.sendung_id AND other.order_id<>own.order_id
            WHERE own.tenant_id=${tenantId} AND own.order_id=${order.id} AND own.status<>'cancelled' AND other.status<>'cancelled' LIMIT 1`);
          if(tracked.length>1||shared.length)return {code:'CONFLICT',message:SHIPMENT_GROUP_COPY.confirmGroup};
        }
      }
      // A partial parcel passes every gate but cannot create the final invoice.
      const preparation=selection?.partial ? null : await composition?.beforeWrite?.(tx,authorization.data);
      if(preparation)return preparation;
      const invoices = await readActiveInvoice(tx, tenantId, order.id);
      const mainInvoices=invoices.filter(invoice=>invoice.belegart==='auftrag');
      if ((invoices.length>0&&mainInvoices.length!==1)||invoices.some(invoice=>invoice.belegart!=='auftrag'&&invoice.belegart!=='versandkosten')) {
        return { code: "CONFLICT", message: "Warenausgang erfordert eine gültige Rechnung." };
      }
      const invoice = mainInvoices[0];
      const invoiceNotIssued = invoices.length === 0;
      let summary: ReturnType<typeof mapPaymentSummaryRow> | null = null;
      const checked:ReturnType<typeof mapPaymentSummaryRow>[]=[];
      if(invoices.length){
        const summaryRows=await readOrderPaymentSummaries(tx,tenantId,order.id);
        const invoiceIds=new Set(invoices.map(invoice=>invoice.id));
        if(summaryRows.length!==invoices.length||summaryRows.some(row=>!invoiceIds.has(row.invoice_id))||new Set(summaryRows.map(row=>row.invoice_id)).size!==invoices.length){
          return {code:'CONFLICT',message:'Zahlungsfreigabe ist nicht verfügbar.'};
        }
        checked.push(...summaryRows.map(row=>mapPaymentSummaryRow(row,paymentAuthorization(authorization.data))));
      }
      if (agreement?.type === "sammelrechnung") {
        if (!invoiceNotIssued) {
          return { code: "CONFLICT", message: "Sammelrechnung darf keine Einzelrechnung enthalten." };
        }
        if (agreement.targetDays === null) {
          throw new Error("GOODS_OUT_COLLECTION_TERMS_INVALID");
        }
      } else if (agreement !== null && !(selection?.partial && invoiceNotIssued)) {
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
        if (agreement === null && !isRework && order.payment_mode !== "rechnung") {
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

        const main=checked.filter(row=>row.invoiceId===invoice.id);
        if(main.length!==1)throw Error('GOODS_OUT_MAIN_PAYMENT_MISSING');
        summary=main[0];
        if (checked.some(payment=>payment.mode!==order.payment_mode||!payment.goodsOutAllowed)) {
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

      const customerId=order.customer_id;
      return {code:'PREPARED',...(selection?.partial && input.overdueReleaseReason!==undefined ? {partialOverride:{invoiceId:overdueInvoices[0].id,reason:input.overdueReleaseReason}}:{}),complete:async()=>{
      if(selection?.partial){await handOverGroupParcels(tx,authorization.data,input,selection,null);return null;}
      const physicalId=randomUUID(),correlationId=randomUUID();
      let physicalClock:{at:string;month:string}|null=null;
      let pending:CollectionFollowupReceipt|null=null;
      if (agreement?.type === "sammelrechnung") {
        const clocks=await tx.execute<{at:string;month:string}>(sql`WITH clock AS MATERIALIZED (SELECT clock_timestamp() AS at) SELECT to_char(clock.at AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') AS at,to_char(date_trunc('month',clock.at AT TIME ZONE 'Europe/Berlin'),'YYYY-MM-DD') AS month FROM clock`);
        physicalClock=clocks[0];
        if(clocks.length!==1||!physicalClock||toIso(physicalClock.at)!==physicalClock.at||!/^\d{4}-\d{2}-01$/.test(physicalClock.month))throw Error('GOODS_OUT_CLOCK_INVALID');
        const physicalMonth=physicalClock.month;
        const context=await readReadyNotificationContext(tx,tenantId,order.id);
        if(!context||context.version!==input.expectedVersion)throw Error('GOODS_OUT_COLLECTION_FREEZE_INVALID');
        try{await withTenantSavepoint(tx,nested=>attachOpenInvoiceCollection(nested, {
          tenantId,
          customerId,
          orderId: order.id,
          actorId,
          targetDays: agreement.targetDays!,
          physicalMonth,
        }));}catch(error){
          console.error('[GOODS_OUT_COLLECTION_FOLLOWUP_REQUIRED]',{message:error instanceof Error?error.message:'UnknownError'});
          pending={eventId:randomUUID(),goodsOutEventId:physicalId,orderId:order.id,customerId,actorId,clientEventId:input.clientEventId,correlationId,expectedVersion:input.expectedVersion,orderVersion:input.expectedVersion+1,freezeId:context.freeze_id,agreementId:agreement.id,agreementVersion:agreement.version,targetDays:agreement.targetDays!,month:physicalClock.month,occurredAt:physicalClock.at};
        }
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

      if(pending){
        const saved=await tx.execute<{id:string}>(sql`INSERT INTO public.events(id,tenant_id,order_id,event_type,description,user_id,client_event_id,correlation_id,event_schema_version,status,aggregate_version,payload,created_at)
          VALUES(${pending.eventId},${tenantId},${order.id},${COLLECTION_PENDING_EVENT},${COLLECTION_FOLLOWUP_COPY.pendingHistory},${actorId}::uuid,${pending.eventId}::uuid,${correlationId}::uuid,1,'success',${nextVersion},${JSON.stringify({receipt:pending,receiptSha256:collectionFollowupDigest(pending)})}::jsonb,${pending.occurredAt}::timestamptz AT TIME ZONE 'UTC') RETURNING id`);
        if(saved.length!==1||saved[0].id!==pending.eventId)throw Error('GOODS_OUT_COLLECTION_PENDING_RECEIPT_MISSING');
      }
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
          ${physicalId}, ${tenantId}, ${order.id}, NULL, ${eventType},
          'Warenausgang gebucht', ${actorId}::uuid, ${JSON.stringify(payload)}::jsonb,
          'success', ${TARGET_STATION}, ${input.clientEventId}::uuid,
          ${eventSchemaVersion}, ${correlationId}::uuid, ${nextVersion},
          ${SOURCE_STATION}, ${physicalClock?sql`${physicalClock.at}::timestamptz AT TIME ZONE 'UTC'`:sql`clock_timestamp() AT TIME ZONE 'UTC'`}
        )
        RETURNING id AS event_id
      `);
      if (inserted.length !== 1 || typeof inserted[0]?.event_id !== "string") {
        throw new Error("GOODS_OUT_EVENT_INSERT_FAILED");
      }
      if (input.overdueReleaseReason !== undefined) {
        // The physical receipt keeps its protected exact V1–V4 schema. The
        // approval is its own linked audit event in the same transaction.
        await tx.execute(sql`
          INSERT INTO public.events (id, tenant_id, order_id, event_type, description,
            user_id, payload, notes, status, client_event_id, correlation_id,
            event_schema_version, aggregate_version, station, from_station, created_at)
          VALUES (gen_random_uuid()::text, ${tenantId}, ${order.id}, 'ORDER_GOODS_OUT_DEBT_OVERRIDE_V1',
            ${GOODS_OUT_DEBT_COPY.overrideRecorded}, ${actorId}::uuid,
            ${JSON.stringify({goodsOutEventId: inserted[0].event_id, invoiceId: overdueInvoices[0].id, reason: input.overdueReleaseReason})}::jsonb,
            ${input.overdueReleaseReason}, 'success', gen_random_uuid(), ${correlationId}::uuid,
            1, ${nextVersion}, ${TARGET_STATION}, ${SOURCE_STATION}, clock_timestamp() AT TIME ZONE 'UTC')
        `);
      }

      if (reworkComplaint) {
        const expectedComplaintVersion = toNonNegativeInteger(reworkComplaint.version);
        if (expectedComplaintVersion === null) throw new Error("REWORK_GOODS_OUT_COMPLAINT_VERSION_INVALID");
        const closed = await tx.execute<{ complaint_id: string; version: number | string }>(sql`
          UPDATE public.v_complaint_rework_context_v1
          SET stand = 'abgeschlossen',
              abschluss_art = 'nacharbeit_raus',
              abschluss_notiz = NULL,
              abgeschlossen_am = statement_timestamp(),
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
      const receipt = await readReleaseAudit(tx, tenantId, parseEvent(persistedEvents[0], tenantId));
      if (
        !receiptMatchesIntent(receipt, input, actorId)
        || !await orderMatchesReceipt(tx,persistedOrders[0], receipt, tenantId)
      ) throw new Error("GOODS_OUT_READBACK_INVALID");

      if (input.collector) await writeGoodsOutCollector(tx, authorization.data, receipt, input.collector);

      if(selection)await handOverGroupParcels(tx,authorization.data,input,selection,receipt);
      else if(input.mode==='versand'){
        // A typed manual-tracking receipt proves which parcels this real
        // physical release hands over. A label alone never reaches this code.
        const parcels=await tx.execute<{id:string;tracking_number:string;carrier:string}>(sql`
          UPDATE public.shipments shipment SET status='shipped',shipped_at=${receipt.occurredAt}::timestamptz,
            updated_at=${receipt.occurredAt}::timestamptz
          WHERE shipment.tenant_id=${tenantId} AND shipment.order_id=${order.id}
            AND ${manualTrackingParcelPredicate()}
          RETURNING shipment.id::text,shipment.tracking_number,shipment.carrier
        `);
        for(const parcel of parcels)await tx.execute(sql`
          INSERT INTO public.events(id,tenant_id,order_id,event_type,description,user_id,payload,status,
            client_event_id,event_schema_version,correlation_id,aggregate_version,station,created_at)
          VALUES(${randomUUID()},${tenantId},${order.id},'SHIPMENT_HANDED_OVER_V1',${MANUAL_SHIPPING_HANDOVER_LABEL},${actorId}::uuid,
            ${JSON.stringify({shipmentId:parcel.id,trackingNumber:parcel.tracking_number,carrier:parcel.carrier,goodsOutEventId:receipt.eventId,source:'manual_tracking'})}::jsonb,
            'success',${randomUUID()}::uuid,1,${receipt.correlationId}::uuid,${receipt.orderVersion},'abgeholt',${receipt.occurredAt}::timestamptz AT TIME ZONE 'UTC')
        `);
      }
      return receipt;
      }};
}
async function finishGoodsOutFollowups(tx:PrivilegedTenantTransaction,auth:AuthorizationSnapshot,composition:GoodsOutComposition|undefined,receipt:GoodsOutReceipt){
 if(composition?.afterWrite){
  try{await withTenantSavepoint(tx,nested=>composition.afterWrite!(nested,auth));}
  catch(error){console.error('[GOODS_OUT_FOLLOWUP_FAILED]',{name:error instanceof Error?error.name:'UnknownError'});if(!composition.afterWriteFailure)throw error;await composition.afterWriteFailure(tx,auth,receipt);}
 }
}
async function retryCollectionFollowup(tx:PrivilegedTenantTransaction,auth:AuthorizationSnapshot,receipt:GoodsOutReceipt){
 if(receipt.eventSchemaVersion!==3||receipt.settlement!=='collection')return;
 const source=await readCollectionFollowup(tx,auth.tenantId,{goodsOutEventId:receipt.eventId});
 if(source?.pending){try{await withTenantSavepoint(tx,nested=>repairCollectionFollowup(nested,auth,source.eventId));}catch(error){console.error('[COLLECTION_FOLLOWUP_RETRY_PENDING]',{message:error instanceof Error?error.message:'UnknownError'});}}
}
async function verifyCollectionFollowupTask(auth:AuthorizationSnapshot,composition:GoodsOutComposition|undefined,goodsOutEventId:string){
 await withPrivilegedTenantTransaction(auth,async tx=>{
  const source=await readCollectionFollowup(tx,auth.tenantId,{goodsOutEventId});
  if(!source)return;
  if(!composition?.synchronizeCollectionFollowup)throw Error('COLLECTION_FOLLOWUP_TASK_PORT_MISSING');
  await composition.synchronizeCollectionFollowup(tx,auth,source.eventId);
 });
}
export async function recordGoodsOut(candidate:unknown,composition?:GoodsOutComposition):Promise<RecordGoodsOutResult>{
 const authorized=await authorizeGoodsOutInput(candidate);if(authorized.code!=='AUTHORIZED')return authorized;
 try{const result:RecordGoodsOutResult=await withPrivilegedTenantTransaction(authorized.authorization.data,async tx=>{
  const prepared=await prepareGoodsOut(tx,authorized,composition);
  if(prepared.code!=='PREPARED'){
   if(prepared.code!=='OK')throw new GoodsOutRejected(prepared);
   await retryCollectionFollowup(tx,authorized.authorization.data,prepared.receipt);
   await finishGoodsOutFollowups(tx,authorized.authorization.data,composition,prepared.receipt);return prepared;
  }
  const receipt=await prepared.complete();if(!receipt)throw Error('GOODS_OUT_PHYSICAL_RECEIPT_MISSING');
  await finishGoodsOutFollowups(tx,authorized.authorization.data,composition,receipt);
  return {code:'OK',receipt,replayed:false};
 });
 if(result.code==='OK'&&result.receipt.eventSchemaVersion===3&&result.receipt.settlement==='collection'){
  // Task receipt is required before ACK, but can never roll back the committed
  // physical handover. The same original N5 request remains its repair path.
  await verifyCollectionFollowupTask(authorized.authorization.data,composition,result.receipt.eventId);
 }
 return result;
 }catch(error){if(error instanceof GoodsOutRejected)return error.result;logDatabaseFailure(error);return {code:'UNAVAILABLE',message:'Warenausgang konnte nicht sicher gebucht werden.'};}
}
async function handOverGroupParcels(tx:PrivilegedTenantTransaction,auth:AuthorizationSnapshot,input:RecordGoodsOutInput,selection:ShipmentSelection,physical:GoodsOutReceipt|null){
 const handed=await tx.execute<{id:string;at:string}>(sql`UPDATE public.shipments shipment SET status='shipped',shipped_at=COALESCE(${selection.deviceCapturedAt??null}::timestamptz,clock_timestamp()),updated_at=clock_timestamp(),
  carrier=${selection.carrier},tracking_number=${selection.trackingNumber}
  WHERE shipment.tenant_id=${auth.tenantId} AND shipment.order_id=${input.orderId} AND shipment.id IN (${sql.join(selection.ids.map(id=>sql`${id}::uuid`),sql`,`)})
    AND shipment.status IN ('pending','created') AND shipment.shipped_at IS NULL
  RETURNING id::text,to_char(shipped_at AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') AS at`);
 if(handed.length!==selection.ids.length||handed.some(row=>!selection.ids.includes(row.id)))throw Error('SHIPMENT_GROUP_PHYSICAL_WRITE_MISSING');
 for(const parcel of handed){
  const id=randomUUID();
  const written=await tx.execute<{id:string}>(sql`INSERT INTO public.events(id,tenant_id,order_id,event_type,description,user_id,payload,status,client_event_id,event_schema_version,correlation_id,aggregate_version,station,created_at)
   VALUES(${id},${auth.tenantId},${input.orderId},'SHIPMENT_HANDED_OVER_V1',${MANUAL_SHIPPING_HANDOVER_LABEL},${auth.userId}::uuid,
    ${JSON.stringify({shipmentId:parcel.id,trackingNumber:selection.trackingNumber,carrier:selection.carrier,goodsOutEventId:physical?.eventId??null,groupEventId:selection.groupEventId,source:'manual_tracking'})}::jsonb,
    'success',${randomUUID()}::uuid,1,${selection.groupEventId}::uuid,${physical?.orderVersion??input.expectedVersion},${physical?'abgeholt':'fertig'},${parcel.at}::timestamptz AT TIME ZONE 'UTC') RETURNING id`);
  if(written.length!==1||written[0].id!==id)throw Error('SHIPMENT_GROUP_PHYSICAL_RECEIPT_MISSING');
 }
}

function groupMemberKey(groupKey:string,orderId:string){const h=createHash('sha256').update('shipment-group:'+groupKey+':'+orderId).digest('hex');return h.slice(0,8)+'-'+h.slice(8,12)+'-5'+h.slice(13,16)+'-8'+h.slice(17,20)+'-'+h.slice(20,32);}
/** Same existing writer/transaction: validate every current group member before
 * any physical completion, then preserve partial-order state until the last
 * active parcel is actually handed over. No parallel dispatch truth exists. */
export async function recordShipmentGroupGoodsOut(candidate:unknown,compositionFor:(input:RecordGoodsOutInput)=>Promise<GoodsOutComposition>,readGroup:(tx:PrivilegedTenantTransaction,auth:AuthorizationSnapshot,orderId:string,groupId:string,lock?:boolean)=>Promise<ManualShipmentGroupState>):Promise<ShipmentGroupResult>{
 if(!isShipmentGroupInput(candidate))return {code:'VALIDATION_ERROR',message:SHIPMENT_GROUP_COPY.invalid};
 const input:ShipmentGroupInput={...candidate,...(candidate.offlineOriginal?{offlineOriginal:normalizeOfflineOriginal(candidate.offlineOriginal)}:{})},intent=canonicalJson(input);
 const members: {authorized:GoodsOutAuthorization;composition:GoodsOutComposition}[]=[];
 for(const member of [...input.members].sort((a,b)=>a.orderId.localeCompare(b.orderId))){
  const child={...member,mode:'versand' as const,clientEventId:groupMemberKey(input.clientEventId,member.orderId)};
  const authorized=await authorizeGoodsOutInput(child);if(authorized.code!=='AUTHORIZED')return authorized;
  members.push({authorized,composition:await compositionFor(child)});
 }
 const auth=members[0].authorized.authorization.data,groupEventId=groupMemberKey(members[0].authorized.authorization.data.tenantId+':'+input.clientEventId,'original');
 const occurrence=input.offlineOriginal?offlineOccurrenceTime(input.offlineOriginal.deviceCapturedAt):null;
 try{const result:ShipmentGroupResult=await withPrivilegedTenantTransaction(auth,async tx=>{
  await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtextextended('shipment-group-key:'||${auth.tenantId}||':'||${input.clientEventId},0))`);
  if(input.offlineOriginal){
   const qualified=await tx.execute<{ok:boolean}>(sql`SELECT private.valid_offline_original_event_v1(${JSON.stringify(input.offlineOriginal)}::jsonb,${auth.userId}::uuid,${input.clientEventId}::uuid) AS ok`);
   if(qualified.length!==1||qualified[0].ok!==true)throw new GoodsOutRejected({code:'CONFLICT',message:SHIPMENT_GROUP_COPY.changed});
  }
  async function readOriginal():Promise<ShipmentGroupReceipt|null>{
   const rows=await tx.execute<{id:string;user_id:string;event_type:string;status:string;payload:{intent:string;receipt:ShipmentGroupReceipt}}>(sql`SELECT id,user_id::text,event_type,status,payload FROM public.events WHERE tenant_id=${auth.tenantId} AND client_event_id=${input.clientEventId}::uuid`);
   if(!rows.length)return null;
   const row=rows[0];
   if(rows.length!==1||row.id!==groupEventId||row.user_id!==auth.userId||row.event_type!=='SHIPMENT_GROUP_HANDED_OVER_V1'||row.status!=='success'||row.payload.intent!==intent)throw new GoodsOutRejected({code:'CONFLICT',message:SHIPMENT_GROUP_COPY.changed});
   const receipt=row.payload.receipt;
   if(!isShipmentGroupReceipt(receipt,input,auth.userId)||canonicalJson(receipt.offlineOriginal??null)!==canonicalJson(input.offlineOriginal??null)||receipt.eventId!==row.id||receipt.actorId!==auth.userId||receipt.clientEventId!==input.clientEventId||receipt.groupId!==input.groupId||receipt.groupVersion!==input.expectedGroupVersion||!Array.isArray(receipt.shipments)||!receipt.shipments.length)throw Error('SHIPMENT_GROUP_ORIGINAL_INVALID');
   for(const parcel of receipt.shipments){
    const facts=await tx.execute<{n:number}>(sql`SELECT count(*)::int AS n FROM public.shipments shipment JOIN public.events proof ON proof.tenant_id=shipment.tenant_id AND proof.order_id=shipment.order_id
      AND proof.event_type='SHIPMENT_HANDED_OVER_V1' AND proof.status='success' AND proof.user_id=${auth.userId}::uuid
      AND proof.payload->>'shipmentId'=shipment.id::text AND proof.payload->>'groupEventId'=${groupEventId}
      AND proof.payload->>'trackingNumber'=${receipt.trackingNumber} AND proof.payload->>'carrier'=${receipt.carrier}
      AND proof.payload->>'goodsOutEventId' IS NOT DISTINCT FROM ${parcel.goodsOutEventId}
     WHERE shipment.tenant_id=${auth.tenantId} AND shipment.id=${parcel.shipmentId}::uuid AND shipment.order_id=${parcel.orderId}
      AND shipment.shipped_at IS NOT NULL AND shipment.tracking_number=${receipt.trackingNumber} AND shipment.carrier=${receipt.carrier}`);
    if(facts.length!==1||facts[0].n!==1)throw Error('SHIPMENT_GROUP_PHYSICAL_PROOF_INVALID');
   }
   // A partial release has no full goods-out receipt. Its immutable approval
   // must instead name this actual group and exactly its selected parcels.
   for(const member of members){
    const selected=receipt.shipments.filter(parcel=>parcel.orderId===member.authorized.input.orderId);
    if(selected.some(parcel=>parcel.goodsOutEventId!==null)||member.authorized.input.overdueReleaseReason===undefined)continue;
    const audits=await tx.execute<{payload:{groupEventId:string;invoiceId:string;reason:string;shipmentIds:string[]};actor_id:string;version:number;notes:string;schema:number}>(sql`
     SELECT audit.payload,audit.user_id::text AS actor_id,audit.aggregate_version AS version,audit.notes,audit.event_schema_version AS schema
     FROM public.events audit JOIN public.orders own ON own.tenant_id=audit.tenant_id AND own.id=audit.order_id
     JOIN public.invoices debt ON debt.tenant_id=audit.tenant_id AND debt.customer_id=own.customer_id AND debt.id::text=audit.payload->>'invoiceId'
     WHERE audit.tenant_id=${auth.tenantId} AND audit.order_id=${member.authorized.input.orderId}
       AND audit.event_type='ORDER_GOODS_OUT_DEBT_OVERRIDE_V1' AND audit.status='success'
       AND audit.correlation_id=${groupEventId}::uuid`);
    const audit=audits[0],reason=member.authorized.input.overdueReleaseReason;
    if(audits.length!==1||audit.actor_id!==auth.userId||audit.schema!==2||Number(audit.version)!==member.authorized.input.expectedVersion||audit.notes!==reason
      ||typeof audit.payload.invoiceId!=='string'||canonicalJson(audit.payload)!==canonicalJson({groupEventId,invoiceId:audit.payload.invoiceId,reason,shipmentIds:selected.map(parcel=>parcel.shipmentId).sort()}))throw Error('SHIPMENT_GROUP_OVERRIDE_PROOF_INVALID');
   }
   return receipt;
  }
  const prior=await readOriginal();if(prior){
   // A secured group must also retain the existing physical writer's R2 retry
   // path. Only actual final goods-out receipts may close their follow-up tasks.
   for(const member of members){
    const physicalIds=new Set(prior.shipments.filter(row=>row.orderId===member.authorized.input.orderId).map(row=>row.goodsOutEventId).filter((id):id is string=>id!==null));
    if(physicalIds.size>1)throw Error('SHIPMENT_GROUP_PHYSICAL_SOURCE_AMBIGUOUS');
    if(physicalIds.size){
     const physical=await prepareGoodsOut(tx,member.authorized,member.composition);
     if(physical.code!=='OK'||!physicalIds.has(physical.receipt.eventId))throw Error('SHIPMENT_GROUP_PHYSICAL_RETRY_INVALID');
     await retryCollectionFollowup(tx,auth,physical.receipt);
     await finishGoodsOutFollowups(tx,auth,member.composition,physical.receipt);
    }
   }
   return {code:'OK',receipt:prior,replayed:true};
  }
  const first=await readGroup(tx,auth,input.orderId,input.groupId);
  if(!first)return {code:'NOT_FOUND',message:SHIPMENT_GROUP_COPY.changed};
  const expectedOrders=[...new Set(first.group.members.map(row=>row.orderId))].sort();
  if(canonicalJson(expectedOrders)!==canonicalJson(members.map(row=>row.authorized.input.orderId)))return {code:'CONFLICT',message:SHIPMENT_GROUP_COPY.changed};
  const customers=await tx.execute<{customer_id:string}>(sql`SELECT DISTINCT customer_id FROM public.orders WHERE tenant_id=${auth.tenantId} AND id IN (${sql.join(expectedOrders.map(id=>sql`${id}`),sql`,`)})`);
  if(customers.length!==1)throw new GoodsOutRejected({code:'CONFLICT',message:SHIPMENT_GROUP_COPY.changed});
  // Same customer/advisory lock as the existing manual group writer. Invoice
  // and task locks still precede order rows, preserving the existing lock order.
  await tx.execute(sql`SELECT private.lock_shipping_customer_v1(${auth.tenantId},${customers[0].customer_id})`);
  for(const member of members)await member.composition.beforeOrderLock?.(tx,auth);
  await tx.execute(sql`SELECT id FROM public.orders WHERE tenant_id=${auth.tenantId} AND id IN (${sql.join(expectedOrders.map(id=>sql`${id}`),sql`,`)}) ORDER BY id FOR UPDATE`);
  const current=await readGroup(tx,auth,input.orderId,input.groupId,true);
  if(!current||current.group.version!==input.expectedGroupVersion||current.group.members.some(row=>!['pending','created'].includes(row.status)))throw new GoodsOutRejected({code:'CONFLICT',message:SHIPMENT_GROUP_COPY.changed});
  // A pending second member is qualified only by the exact group link in a
  // real manual-tracking original whose primary parcel still matches it.
  const proofs=await tx.execute<{shipmentId:string;groupTarget:string|null;trackingNumber:string;carrier:string}>(sql`SELECT primary_shipment.id::text AS "shipmentId",proof.payload->'group'->>'targetShipmentId' AS "groupTarget",
    primary_shipment.tracking_number AS "trackingNumber",primary_shipment.carrier
   FROM public.events proof JOIN public.shipments primary_shipment ON primary_shipment.tenant_id=proof.tenant_id AND primary_shipment.order_id=proof.order_id
    AND primary_shipment.id::text=proof.payload->'receipt'->>'shipmentId'
    AND primary_shipment.tracking_number=proof.payload->'receipt'->>'trackingNumber' AND primary_shipment.carrier=proof.payload->'receipt'->>'carrier'
   WHERE proof.tenant_id=${auth.tenantId} AND proof.event_type='SHIPMENT_MANUAL_TRACKING_SET_V1' AND proof.status='success' AND proof.user_id IS NOT NULL
    AND proof.payload->'receipt'->>'actorId'=proof.user_id::text AND length(btrim(primary_shipment.tracking_number))>0
    AND (primary_shipment.sendung_id=${input.groupId}::uuid OR primary_shipment.sendung_id IS NULL AND primary_shipment.id=${input.groupId}::uuid)
    AND (proof.payload->'group'->>'id' IS NULL OR proof.payload->'group'->>'id'=${input.groupId})`);
  const numbers=[...new Map(proofs.map(row=>[canonicalJson([row.carrier,row.trackingNumber]),row])).values()];
  if(numbers.length!==1)throw new GoodsOutRejected({code:'VALIDATION_ERROR',message:MANUAL_SHIPPING_COPY.TRACKING_NUMBER_MISSING});
  const tracking=numbers[0];
  if(current.group.members.some(row=>row.trackingNumber!==null&&row.trackingNumber!==tracking.trackingNumber||row.carrier!==null&&row.carrier!==tracking.carrier
    ||!proofs.some(proof=>proof.shipmentId===row.shipmentId||proof.groupTarget===row.shipmentId)))throw new GoodsOutRejected({code:'VALIDATION_ERROR',message:MANUAL_SHIPPING_COPY.TRACKING_NUMBER_MISSING});
  const prepared:{member:typeof members[number];completion:PreparedGoodsOut;ids:string[]}[]=[];
  for(const member of members){
   const orderId=member.authorized.input.orderId,ids=current.group.members.filter(row=>row.orderId===orderId).map(row=>row.shipmentId);
   const result=await prepareGoodsOut(tx,member.authorized,member.composition,{ids,groupEventId,trackingNumber:tracking.trackingNumber,carrier:tracking.carrier,...(occurrence?{deviceCapturedAt:occurrence.occurredAt}:{}),partial:current.remainingOrderIds.includes(orderId)});
   if(result.code!=='PREPARED'){
    if(result.code==='OK')throw Error('SHIPMENT_GROUP_CHILD_WITHOUT_ORIGINAL');
    const number=current.group.members.find(row=>row.orderId===orderId)!.orderNumber;
    const blocked={...result,blockedOrderId:orderId,blockedOrderNumber:number,message:SHIPMENT_GROUP_COPY.blocked(number,result.message)};
    throw new GoodsOutRejected(blocked);
   }
   prepared.push({member,completion:result,ids});
  }
  const shipments:ShipmentGroupReceipt['shipments']=[];
  for(const row of prepared){
   const physical=await row.completion.complete();
   if(physical)await finishGoodsOutFollowups(tx,auth,row.member.composition,physical);
   for(const shipmentId of row.ids)shipments.push({shipmentId,orderId:row.member.authorized.input.orderId,goodsOutEventId:physical?.eventId??null});
  }
  const clocks=await tx.execute<{at:string}>(sql`SELECT to_char(clock_timestamp() AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') AS at`);
  if(clocks.length!==1)throw Error('SHIPMENT_GROUP_CLOCK_MISSING');
  const receipt:ShipmentGroupReceipt={eventId:groupEventId,clientEventId:input.clientEventId,groupId:input.groupId,groupVersion:input.expectedGroupVersion,actorId:auth.userId,occurredAt:clocks[0].at,trackingNumber:tracking.trackingNumber,carrier:tracking.carrier,shipments,...(input.offlineOriginal?{offlineOriginal:input.offlineOriginal}:{})};
  const written=await tx.execute<{id:string}>(sql`INSERT INTO public.events(id,tenant_id,order_id,event_type,description,user_id,payload,status,client_event_id,event_schema_version,aggregate_version,created_at)
   VALUES(${groupEventId},${auth.tenantId},${input.orderId},'SHIPMENT_GROUP_HANDED_OVER_V1',${MANUAL_SHIPPING_HANDOVER_LABEL},${auth.userId}::uuid,${JSON.stringify({intent,receipt,...(occurrence?.geraetezeit_abweichend?{geraetezeit_abweichend:true}:{})})}::jsonb,'success',${input.clientEventId}::uuid,1,1,${receipt.occurredAt}::timestamptz AT TIME ZONE 'UTC') RETURNING id`);
  if(written.length!==1||written[0].id!==groupEventId)throw Error('SHIPMENT_GROUP_ORIGINAL_MISSING');
  for(const row of prepared){
   const override=row.completion.partialOverride;if(!override)continue;
   const written=await tx.execute<{id:string}>(sql`INSERT INTO public.events(id,tenant_id,order_id,event_type,description,user_id,payload,notes,status,client_event_id,correlation_id,event_schema_version,aggregate_version,station,from_station,created_at)
    VALUES(gen_random_uuid()::text,${auth.tenantId},${row.member.authorized.input.orderId},'ORDER_GOODS_OUT_DEBT_OVERRIDE_V1',${GOODS_OUT_DEBT_COPY.overrideRecorded},${auth.userId}::uuid,
      ${JSON.stringify({groupEventId,invoiceId:override.invoiceId,reason:override.reason,shipmentIds:[...row.ids].sort()})}::jsonb,${override.reason},'success',gen_random_uuid(),${groupEventId}::uuid,2,${row.member.authorized.input.expectedVersion},${SOURCE_STATION},${SOURCE_STATION},clock_timestamp() AT TIME ZONE 'UTC') RETURNING id`);
   if(written.length!==1)throw Error('SHIPMENT_GROUP_OVERRIDE_PROOF_MISSING');
  }
  const proof=await readOriginal();if(!proof||canonicalJson(proof)!==canonicalJson(receipt))throw Error('SHIPMENT_GROUP_READBACK_MISMATCH');
  return {code:'OK',receipt,replayed:false};
 });
 if(result.code==='OK')for(const member of members){
  const physicalIds=[...new Set(result.receipt.shipments.filter(parcel=>parcel.orderId===member.authorized.input.orderId).flatMap(parcel=>parcel.goodsOutEventId?[parcel.goodsOutEventId]:[]))];
  for(const physicalId of physicalIds)await verifyCollectionFollowupTask(auth,member.composition,physicalId);
 }
 return result;
 }catch(error){if(error instanceof GoodsOutRejected)return error.result;logDatabaseFailure(error);return {code:'UNAVAILABLE',message:SHIPMENT_GROUP_COPY.unavailable};}
}
