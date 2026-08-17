import "server-only";

import { createHash, randomUUID } from "node:crypto";
import { sql } from "drizzle-orm";
import type { AuthorizationSnapshot } from "@/lib/server/authorization";
import {
  withPrivilegedTenantTransaction,
  type PrivilegedTenantTransaction,
} from "@/lib/server/privilegedDb";

const BUCKET_ID = "item-photos";
const MAX_ID_LENGTH = 128;
const MAX_FILE_BYTES = 12 * 1024 * 1024;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const SHA256_PATTERN = /^[0-9a-f]{64}$/;
const MIME_EXTENSION = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
} as const;

type AttachmentWorkflow = {
  key: "HANDOFF" | "INTAKE";
  purpose: "GALVANIK_HANDOFF_ORIGINAL_V1" | "ORDER_INTAKE_ORIGINAL_V1";
  station: "galvanik" | "wareneingang";
  orderStatus: "ready" | "in_progress";
  eventType: "ORDER_STATION_MOVED_V1" | "ORDER_INTAKE_CREATED_V1";
  fromStation: "wareneingang" | null;
  pathPrefix: "order-station-evidence/v1" | "order-intake-evidence/v1";
  downloadName: "galvanik-uebergabe-original" | "wareneingang-original";
};

const HANDOFF_WORKFLOW: AttachmentWorkflow = {
  key: "HANDOFF",
  purpose: "GALVANIK_HANDOFF_ORIGINAL_V1",
  station: "galvanik",
  orderStatus: "ready",
  eventType: "ORDER_STATION_MOVED_V1",
  fromStation: "wareneingang",
  pathPrefix: "order-station-evidence/v1",
  downloadName: "galvanik-uebergabe-original",
};

const INTAKE_WORKFLOW: AttachmentWorkflow = {
  key: "INTAKE",
  purpose: "ORDER_INTAKE_ORIGINAL_V1",
  station: "wareneingang",
  orderStatus: "in_progress",
  eventType: "ORDER_INTAKE_CREATED_V1",
  fromStation: null,
  pathPrefix: "order-intake-evidence/v1",
  downloadName: "wareneingang-original",
};

export type OrderStationAttachmentMime = keyof typeof MIME_EXTENSION;
export type OrderStationAttachmentConflictReason =
  | "IDEMPOTENCY_MISMATCH"
  | "ORDER_CHANGED"
  | "UPLOAD_GRANT_EXPIRED"
  | "UPLOAD_NOT_READY"
  | "UPLOAD_MISMATCH"
  | "UPLOAD_OUTSIDE_WINDOW"
  | "STORAGE_CHANGED";

export type OrderStationAttachmentReceipt = {
  reservationId: string;
  receiptId: string | null;
  clientRequestId: string;
  customerId: string;
  orderId: string;
  itemId: string;
  transitionEventId: string;
  orderVersion: number;
  actorId: string;
  actorDisplayName: string;
  mimeType: OrderStationAttachmentMime;
  fileBytes: number;
  contentSha256: string;
  uploadExpiresAt: string;
  reservedAt: string;
  state: "PENDING" | "FINALIZED";
  verifiedAt: string | null;
};

export type OrderStationAttachmentResult<T> =
  | { code: "OK"; data: T }
  | { code: "UNAUTHENTICATED"; message: string }
  | { code: "FORBIDDEN"; message: string }
  | { code: "NOT_FOUND"; message: string }
  | { code: "CONFLICT"; reason: OrderStationAttachmentConflictReason; message: string }
  | { code: "VALIDATION_ERROR"; message: string }
  | { code: "UNAVAILABLE"; message: string };

export type GetOrderStationAttachmentsInput = { orderId: string; itemId: string };
export type ReserveOrderStationAttachmentInput = {
  orderId: string;
  itemId: string;
  expectedVersion: number;
  clientRequestId: string;
  mimeType: OrderStationAttachmentMime;
  fileBytes: number;
  contentSha256: string;
};
export type FinalizeOrderStationAttachmentInput = { reservationId: string };
export type GetOrderStationAttachmentOriginalInput = { receiptId: string };

export type OrderStationAttachmentUploadGrant = { path: string; token: string };

type ReserveAttachmentData = {
  receipt: OrderStationAttachmentReceipt;
  upload: OrderStationAttachmentUploadGrant | null;
  replayed: boolean;
};
type ReserveDecision =
  | { terminal: OrderStationAttachmentResult<ReserveAttachmentData> }
  | { reservation: InternalReservation; replayed: boolean };
type FinalizeAttachmentData = { receipt: OrderStationAttachmentReceipt; replayed: boolean };
type FinalizePhaseOne =
  | { terminal: OrderStationAttachmentResult<FinalizeAttachmentData> }
  | { reservation: InternalReservation };

type ReservationRow = {
  id: string;
  tenant_id: string;
  customer_id: string;
  order_id: string;
  item_id: string;
  transition_event_id: string;
  order_version: number;
  actor_id: string;
  client_request_id: string;
  purpose: string;
  station: string;
  bucket_id: string;
  object_path: string;
  mime_type: string;
  file_bytes: number | string;
  content_sha256: string;
  upload_expires_at: Date | string;
  created_at: Date | string;
};

type EvidenceRow = {
  id: string;
  reservation_id: string;
  tenant_id: string;
  actor_id: string;
  storage_object_id: string;
  storage_object_version: string;
  verified_mime_type: string;
  verified_file_bytes: number | string;
  verified_content_sha256: string;
  storage_created_at: Date | string;
  verified_at: Date | string;
};

type EvidenceExtractionRow = {
  id: string;
  evidence_id: string;
  tenant_id: string;
  extraction_state: string;
  provider: string | null;
  detected_type: string | null;
  detection_confidence: number | string | null;
  extracted_data: unknown;
  field_confidence: unknown;
  created_at: Date | string;
};

type EvidenceDomainLinkRow = {
  id: string;
  evidence_id: string;
  tenant_id: string;
  target_type: string;
  target_id: string;
  created_at: Date | string;
};

type ReceiptViewRow = {
  reservation_id: string;
  receipt_id: string | null;
  tenant_id: string;
  customer_id: string;
  order_id: string;
  item_id: string;
  transition_event_id: string;
  order_version: number;
  actor_id: string;
  actor_display_name: string;
  client_request_id: string;
  purpose: string;
  station: string;
  mime_type: string;
  file_bytes: number | string;
  content_sha256: string;
  upload_expires_at: Date | string;
  reserved_at: Date | string;
  verified_at: Date | string | null;
  receipt_state: string;
  integrity_ok: boolean;
};

type OriginalBindingRow = {
  reservation_id_value: string;
  reservation_tenant_id: string;
  reservation_customer_id: string;
  reservation_order_id: string;
  reservation_item_id: string;
  reservation_transition_event_id: string;
  reservation_order_version: number;
  reservation_actor_id: string;
  reservation_client_request_id: string;
  reservation_purpose: string;
  reservation_station: string;
  reservation_bucket_id: string;
  reservation_object_path: string;
  reservation_mime_type: string;
  reservation_file_bytes: number | string;
  reservation_content_sha256: string;
  reservation_upload_expires_at: Date | string;
  reservation_created_at: Date | string;
  evidence_id: string;
  evidence_reservation_id: string;
  evidence_tenant_id: string;
  evidence_actor_id: string;
  evidence_storage_object_id: string;
  evidence_storage_object_version: string;
  evidence_verified_mime_type: string;
  evidence_verified_file_bytes: number | string;
  evidence_verified_content_sha256: string;
  evidence_storage_created_at: Date | string;
  evidence_verified_at: Date | string;
};

type LockedOrder = {
  id: string;
  tenant_id: string | null;
  customer_id: string | null;
  version: number;
  station: string | null;
  current_station: string | null;
  current_station_id: string | null;
  status: string | null;
};

type LockedItem = {
  id: string;
  order_id: string;
  tenant_id: string | null;
  customer_id: string | null;
  current_station_id: string | null;
};

type TransitionEventRow = {
  id: string;
  tenant_id: string | null;
  order_id: string | null;
  item_id: string | null;
  event_type: string;
  client_event_id: string | null;
  correlation_id: string | null;
  event_schema_version: number | null;
  aggregate_version: number | null;
  from_station: string | null;
  station: string | null;
  status: string | null;
  actor_id: string | null;
  actor_tenant_id: string | null;
};

type InternalReservation = Omit<ReservationRow, "file_bytes" | "upload_expires_at" | "created_at"> & {
  file_bytes: number;
  upload_expires_at: string;
  created_at: string;
};

function hasExactKeys(value: unknown, keys: readonly string[]): value is Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const actual = Object.keys(value).sort();
  const expected = [...keys].sort();
  return actual.length === expected.length && actual.every((key, index) => key === expected[index]);
}

function validTextId(value: unknown): value is string {
  return typeof value === "string"
    && value === value.trim()
    && value.length > 0
    && value.length <= MAX_ID_LENGTH;
}

function validUuid(value: unknown): value is string {
  return typeof value === "string" && UUID_PATTERN.test(value);
}

function validVersion(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value > 0;
}

function validMime(value: unknown): value is OrderStationAttachmentMime {
  return typeof value === "string" && Object.hasOwn(MIME_EXTENSION, value);
}

function validBytes(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 1 && value <= MAX_FILE_BYTES;
}

function parseBytes(value: number | string): number {
  const parsed = typeof value === "number" ? value : Number(value);
  if (!validBytes(parsed)) throw new Error("ORDER_STATION_ATTACHMENT_BYTES_INVALID");
  return parsed;
}

function toIso(value: unknown): string {
  if (!(value instanceof Date) && (typeof value !== "string" || value.trim().length === 0)) {
    throw new Error("ORDER_STATION_ATTACHMENT_TIME_INVALID");
  }
  const parsed = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(parsed.getTime())) throw new Error("ORDER_STATION_ATTACHMENT_TIME_INVALID");
  return parsed.toISOString();
}

function invalidReadInput(input: unknown): boolean {
  return !hasExactKeys(input, ["orderId", "itemId"])
    || !validTextId(input.orderId)
    || !validTextId(input.itemId);
}

function invalidReserveInput(input: unknown): boolean {
  return !hasExactKeys(input, [
    "orderId", "itemId", "expectedVersion", "clientRequestId",
    "mimeType", "fileBytes", "contentSha256",
  ])
    || !validTextId(input.orderId)
    || !validTextId(input.itemId)
    || !validVersion(input.expectedVersion)
    || !validUuid(input.clientRequestId)
    || !validMime(input.mimeType)
    || !validBytes(input.fileBytes)
    || typeof input.contentSha256 !== "string"
    || !SHA256_PATTERN.test(input.contentSha256);
}

function invalidSingleUuidInput(input: unknown, key: "reservationId" | "receiptId"): boolean {
  return !hasExactKeys(input, [key]) || !validUuid(input[key]);
}

function objectPath(
  workflow: AttachmentWorkflow,
  reservationId: string,
  mimeType: OrderStationAttachmentMime,
): string {
  return `${workflow.pathPrefix}/${reservationId}.${MIME_EXTENSION[mimeType]}`;
}

function normalizeReservation(
  workflow: AttachmentWorkflow,
  row: ReservationRow,
  authorization: AuthorizationSnapshot,
): InternalReservation {
  const fileBytes = parseBytes(row.file_bytes);
  const createdAt = toIso(row.created_at);
  const uploadExpiresAt = toIso(row.upload_expires_at);
  if (
    !validUuid(row.id)
    || row.tenant_id !== authorization.tenantId
    || !validTextId(row.customer_id)
    || !validTextId(row.order_id)
    || !validTextId(row.item_id)
    || !validUuid(row.transition_event_id)
    || !validVersion(row.order_version)
    || !validUuid(row.actor_id)
    || !validUuid(row.client_request_id)
    || row.purpose !== workflow.purpose
    || row.station !== workflow.station
    || row.bucket_id !== BUCKET_ID
    || !validMime(row.mime_type)
    || !SHA256_PATTERN.test(row.content_sha256)
    || row.object_path !== objectPath(workflow, row.id, row.mime_type)
    || new Date(uploadExpiresAt).getTime() - new Date(createdAt).getTime() !== 2 * 60 * 60 * 1000
  ) {
    throw new Error("ORDER_STATION_ATTACHMENT_RESERVATION_INVALID");
  }
  return { ...row, file_bytes: fileBytes, created_at: createdAt, upload_expires_at: uploadExpiresAt };
}

function sameReservation(left: InternalReservation, right: InternalReservation): boolean {
  return left.id === right.id
    && left.tenant_id === right.tenant_id
    && left.customer_id === right.customer_id
    && left.order_id === right.order_id
    && left.item_id === right.item_id
    && left.transition_event_id === right.transition_event_id
    && left.order_version === right.order_version
    && left.actor_id === right.actor_id
    && left.client_request_id === right.client_request_id
    && left.purpose === right.purpose
    && left.station === right.station
    && left.bucket_id === right.bucket_id
    && left.object_path === right.object_path
    && left.mime_type === right.mime_type
    && left.file_bytes === right.file_bytes
    && left.content_sha256 === right.content_sha256
    && left.upload_expires_at === right.upload_expires_at
    && left.created_at === right.created_at;
}

function reservationMatchesCreateIntent(
  workflow: AttachmentWorkflow,
  reservation: InternalReservation,
  authorization: AuthorizationSnapshot,
  input: ReserveOrderStationAttachmentInput,
  reservationId: string,
  customerId: string,
  transitionEventId: string,
): boolean {
  return reservation.id === reservationId
    && reservation.tenant_id === authorization.tenantId
    && reservation.customer_id === customerId
    && reservation.order_id === input.orderId
    && reservation.item_id === input.itemId
    && reservation.transition_event_id === transitionEventId
    && reservation.order_version === input.expectedVersion
    && reservation.actor_id === authorization.userId
    && reservation.client_request_id === input.clientRequestId
    && reservation.purpose === workflow.purpose
    && reservation.station === workflow.station
    && reservation.bucket_id === BUCKET_ID
    && reservation.object_path === objectPath(workflow, reservationId, input.mimeType)
    && reservation.mime_type === input.mimeType
    && reservation.file_bytes === input.fileBytes
    && reservation.content_sha256 === input.contentSha256;
}

function mapReceipt(
  workflow: AttachmentWorkflow,
  row: ReceiptViewRow,
  authorization: Pick<AuthorizationSnapshot, "tenantId">,
): OrderStationAttachmentReceipt {
  const fileBytes = parseBytes(row.file_bytes);
  const uploadExpiresAt = toIso(row.upload_expires_at);
  const reservedAt = toIso(row.reserved_at);
  const verifiedAt = row.verified_at === null ? null : toIso(row.verified_at);
  if (
    row.integrity_ok !== true
    || (row.receipt_state !== "PENDING" && row.receipt_state !== "FINALIZED")
    || row.tenant_id !== authorization.tenantId
    || row.purpose !== workflow.purpose
    || row.station !== workflow.station
    || !validUuid(row.reservation_id)
    || (row.receipt_state === "PENDING" ? row.receipt_id !== null : !validUuid(row.receipt_id))
    || !validUuid(row.client_request_id)
    || !validTextId(row.customer_id)
    || !validTextId(row.order_id)
    || !validTextId(row.item_id)
    || !validUuid(row.transition_event_id)
    || !validVersion(row.order_version)
    || !validUuid(row.actor_id)
    || typeof row.actor_display_name !== "string"
    || row.actor_display_name.trim().length === 0
    || !validMime(row.mime_type)
    || !SHA256_PATTERN.test(row.content_sha256)
    || (row.receipt_state === "FINALIZED" ? verifiedAt === null : verifiedAt !== null)
  ) {
    throw new Error("ORDER_STATION_ATTACHMENT_RECEIPT_INVALID");
  }
  return {
    reservationId: row.reservation_id,
    receiptId: row.receipt_id,
    clientRequestId: row.client_request_id,
    customerId: row.customer_id,
    orderId: row.order_id,
    itemId: row.item_id,
    transitionEventId: row.transition_event_id,
    orderVersion: row.order_version,
    actorId: row.actor_id,
    actorDisplayName: row.actor_display_name,
    mimeType: row.mime_type,
    fileBytes,
    contentSha256: row.content_sha256,
    uploadExpiresAt,
    reservedAt,
    state: row.receipt_state,
    verifiedAt,
  };
}

function receiptMatchesReservation(
  receipt: OrderStationAttachmentReceipt,
  reservation: InternalReservation,
): boolean {
  return receipt.reservationId === reservation.id
    && receipt.clientRequestId === reservation.client_request_id
    && receipt.customerId === reservation.customer_id
    && receipt.orderId === reservation.order_id
    && receipt.itemId === reservation.item_id
    && receipt.transitionEventId === reservation.transition_event_id
    && receipt.orderVersion === reservation.order_version
    && receipt.actorId === reservation.actor_id
    && receipt.mimeType === reservation.mime_type
    && receipt.fileBytes === reservation.file_bytes
    && receipt.contentSha256 === reservation.content_sha256
    && receipt.uploadExpiresAt === reservation.upload_expires_at
    && receipt.reservedAt === reservation.created_at
    && (
      (receipt.state === "PENDING" && receipt.receiptId === null && receipt.verifiedAt === null)
      || (receipt.state === "FINALIZED" && validUuid(receipt.receiptId) && receipt.verifiedAt !== null)
    );
}

function evidenceMatchesReservation(evidence: EvidenceRow, reservation: InternalReservation): boolean {
  const storageCreatedAt = toIso(evidence.storage_created_at);
  const verifiedAt = toIso(evidence.verified_at);
  return validUuid(evidence.id)
    && evidence.reservation_id === reservation.id
    && evidence.tenant_id === reservation.tenant_id
    && evidence.actor_id === reservation.actor_id
    && validUuid(evidence.storage_object_id)
    && validTextId(evidence.storage_object_version)
    && evidence.verified_mime_type === reservation.mime_type
    && parseBytes(evidence.verified_file_bytes) === reservation.file_bytes
    && evidence.verified_content_sha256 === reservation.content_sha256
    && new Date(storageCreatedAt).getTime() >= new Date(reservation.created_at).getTime()
    && new Date(storageCreatedAt).getTime() <= new Date(reservation.upload_expires_at).getTime()
    && new Date(verifiedAt).getTime() >= new Date(storageCreatedAt).getTime();
}

function canView(authorization: AuthorizationSnapshot): boolean {
  return authorization.permissions.includes("perm_view_leitstand");
}

function canManage(authorization: AuthorizationSnapshot): boolean {
  return authorization.permissions.includes("perm_op_photos");
}

async function lockFinalizeMutex(
  tx: PrivilegedTenantTransaction,
  authorization: AuthorizationSnapshot,
  reservationId: string,
  workflow: AttachmentWorkflow,
): Promise<void> {
  await tx.execute(sql`
    SELECT pg_advisory_xact_lock(
      hashtextextended(
        'order-attachment:' || ${workflow.key} || ':finalize:' || ${authorization.tenantId} || ':' || ${reservationId},
        0
      )
    )
  `);
}

async function loadOwnedReservation(
  tx: PrivilegedTenantTransaction,
  authorization: AuthorizationSnapshot,
  reservationId: string,
  workflow: AttachmentWorkflow,
): Promise<InternalReservation | null> {
  const rows = await tx.execute<ReservationRow>(sql`
    SELECT *
    FROM private.order_station_evidence_reservations
    WHERE id = ${reservationId}
      AND tenant_id = ${authorization.tenantId}
      AND actor_id = ${authorization.userId}
      AND purpose = ${workflow.purpose}
    FOR UPDATE
  `);
  if (rows.length === 0) return null;
  if (rows.length !== 1 || !rows[0]) throw new Error("ORDER_STATION_ATTACHMENT_RESERVATION_INVALID");
  const reservation = normalizeReservation(workflow, rows[0], authorization);
  if (reservation.id !== reservationId || reservation.actor_id !== authorization.userId) {
    throw new Error("ORDER_STATION_ATTACHMENT_RESERVATION_INVALID");
  }
  return reservation;
}

async function loadEvidence(
  tx: PrivilegedTenantTransaction,
  reservation: InternalReservation,
): Promise<EvidenceRow | null> {
  const rows = await tx.execute<EvidenceRow>(sql`
    SELECT *
    FROM private.order_station_evidence
    WHERE reservation_id = ${reservation.id}
    LIMIT 2
  `);
  if (rows.length === 0) return null;
  if (rows.length !== 1 || !rows[0]) throw new Error("ORDER_STATION_ATTACHMENT_EVIDENCE_INVALID");
  if (!evidenceMatchesReservation(rows[0], reservation)) {
    throw new Error("ORDER_STATION_ATTACHMENT_EVIDENCE_INVALID");
  }
  return rows[0];
}

async function readReceiptByReservation(
  tx: PrivilegedTenantTransaction,
  authorization: AuthorizationSnapshot,
  reservation: InternalReservation,
  workflow: AttachmentWorkflow,
): Promise<OrderStationAttachmentReceipt> {
  const rows = await tx.execute<ReceiptViewRow>(sql`
    SELECT * FROM private.v_order_evidence_attachment_receipts_v1
    WHERE reservation_id = ${reservation.id}
      AND purpose = ${workflow.purpose}
    LIMIT 2
  `);
  if (rows.length !== 1 || !rows[0]) throw new Error("ORDER_STATION_ATTACHMENT_RECEIPT_INVALID");
  const receipt = mapReceipt(workflow, rows[0], authorization);
  if (!receiptMatchesReservation(receipt, reservation)) {
    throw new Error("ORDER_STATION_ATTACHMENT_RECEIPT_INVALID");
  }
  return receipt;
}

async function reservationGraphIsCurrent(
  tx: PrivilegedTenantTransaction,
  authorization: AuthorizationSnapshot,
  reservation: InternalReservation,
  workflow: AttachmentWorkflow,
): Promise<boolean> {
  const rows = await tx.execute<{ integrity_ok: boolean }>(sql`
    SELECT (
      EXISTS (
        SELECT 1 FROM public.orders o
        WHERE o.id = ${reservation.order_id}
          AND o.tenant_id = ${authorization.tenantId}
          AND o.customer_id = ${reservation.customer_id}
          AND o.version = ${reservation.order_version}
          AND o.station = ${workflow.station}
          AND o.current_station = ${workflow.station}
          AND o.current_station_id = ${workflow.station}
          AND o.status = ${workflow.orderStatus}
      )
      AND EXISTS (
        SELECT 1 FROM public.customers c
        WHERE c.id = ${reservation.customer_id}
          AND c.tenant_id = ${authorization.tenantId}
      )
      AND EXISTS (
        SELECT 1 FROM public.items i
        WHERE i.id = ${reservation.item_id}
          AND i.order_id = ${reservation.order_id}
          AND i.tenant_id = ${authorization.tenantId}
          AND i.customer_id = ${reservation.customer_id}
          AND i.current_station_id = ${workflow.station}
      )
      AND NOT EXISTS (
        SELECT 1 FROM public.items corrupt_item
        WHERE corrupt_item.order_id = ${reservation.order_id}
          AND (
            corrupt_item.tenant_id IS DISTINCT FROM ${authorization.tenantId}
            OR corrupt_item.customer_id IS DISTINCT FROM ${reservation.customer_id}
            OR corrupt_item.current_station_id IS DISTINCT FROM ${workflow.station}
          )
      )
      AND EXISTS (
        SELECT 1
        FROM public.events event
        JOIN public.app_users event_actor
          ON event_actor.id = event.user_id
         AND event_actor.tenant_id = event.tenant_id
        WHERE event.id = ${reservation.transition_event_id}
          AND event.tenant_id = ${authorization.tenantId}
          AND event.order_id = ${reservation.order_id}
          AND event.item_id IS NULL
          AND event.event_type = ${workflow.eventType}
          AND event.client_event_id IS NOT NULL
          AND event.correlation_id IS NOT NULL
          AND event.event_schema_version = 1
          AND event.aggregate_version = ${reservation.order_version}
          AND event.from_station IS NOT DISTINCT FROM ${workflow.fromStation}
          AND event.station = ${workflow.station}
          AND event.status = 'success'
      )
    ) AS integrity_ok
  `);
  return rows.length === 1 && rows[0]?.integrity_ok === true;
}

async function lockReservationGraphIsCurrent(
  tx: PrivilegedTenantTransaction,
  authorization: AuthorizationSnapshot,
  reservation: InternalReservation,
  workflow: AttachmentWorkflow,
): Promise<boolean> {
  // This lock order mirrors the W3 station command (order -> customer -> all
  // order items), so a transition cannot pass between final validation and the
  // immutable evidence insert.
  const orders = await tx.execute<LockedOrder>(sql`
    SELECT id, tenant_id, customer_id, version, station, current_station, current_station_id, status
    FROM public.orders
    WHERE id = ${reservation.order_id} AND tenant_id = ${authorization.tenantId}
    FOR UPDATE
  `);
  const order = orders[0];
  if (
    orders.length !== 1 || !order || order.id !== reservation.order_id
    || order.tenant_id !== authorization.tenantId
    || order.customer_id !== reservation.customer_id
    || order.version !== reservation.order_version || order.station !== workflow.station
    || order.current_station !== workflow.station || order.current_station_id !== workflow.station
    || order.status !== workflow.orderStatus
  ) return false;

  const customers = await tx.execute<{ id: string; tenant_id: string | null }>(sql`
    SELECT id, tenant_id FROM public.customers
    WHERE id = ${reservation.customer_id}
      AND tenant_id = ${authorization.tenantId}
    FOR SHARE
  `);
  if (
    customers.length !== 1 || customers[0]?.id !== reservation.customer_id
    || customers[0]?.tenant_id !== authorization.tenantId
  ) return false;

  const items = await tx.execute<LockedItem>(sql`
    SELECT id, order_id, tenant_id, customer_id, current_station_id
    FROM public.items
    WHERE order_id = ${reservation.order_id}
    FOR SHARE
  `);
  if (
    items.filter((item) => item.id === reservation.item_id).length !== 1
    || items.some((item) => item.order_id !== reservation.order_id
      || item.tenant_id !== authorization.tenantId
      || item.customer_id !== reservation.customer_id
      || item.current_station_id !== workflow.station)
  ) return false;

  return reservationGraphIsCurrent(tx, authorization, reservation, workflow);
}

function evidenceMatchesStableObject(
  evidence: EvidenceRow,
  reservation: InternalReservation,
  object: { id: string; version: string; createdAt: string },
): boolean {
  return evidenceMatchesReservation(evidence, reservation)
    && evidence.storage_object_id === object.id
    && evidence.storage_object_version === object.version
    && toIso(evidence.storage_created_at) === toIso(object.createdAt);
}

function detectMime(bytes: Uint8Array): OrderStationAttachmentMime | null {
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "image/jpeg";
  if (
    bytes.length >= 8
    && [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a].every((value, index) => bytes[index] === value)
  ) return "image/png";
  if (
    bytes.length >= 12
    && String.fromCharCode(...bytes.slice(0, 4)) === "RIFF"
    && String.fromCharCode(...bytes.slice(8, 12)) === "WEBP"
  ) return "image/webp";
  return null;
}

async function readAttachmentsForWorkflow(
  workflow: AttachmentWorkflow,
  authorization: AuthorizationSnapshot,
  input: GetOrderStationAttachmentsInput,
): Promise<OrderStationAttachmentResult<OrderStationAttachmentReceipt[]>> {
  if (invalidReadInput(input)) return { code: "VALIDATION_ERROR", message: "Ungültige Auftrags- oder Teilekennung." };
  if (!canView(authorization)) return { code: "FORBIDDEN", message: "Übergabebelege sind nicht erlaubt." };
  try {
    const data = await withPrivilegedTenantTransaction(authorization, async (tx) => {
      const rows = await tx.execute<ReceiptViewRow>(sql`
        SELECT * FROM private.v_order_evidence_attachment_receipts_v1
        WHERE order_id = ${input.orderId} AND item_id = ${input.itemId}
          AND purpose = ${workflow.purpose}
        ORDER BY reserved_at DESC, reservation_id
      `);
      return rows.map((row) => {
        if (row.order_id !== input.orderId || row.item_id !== input.itemId) {
          throw new Error("ORDER_STATION_ATTACHMENT_RECEIPT_INVALID");
        }
        return mapReceipt(workflow, row, authorization);
      });
    });
    return { code: "OK", data };
  } catch {
    return { code: "UNAVAILABLE", message: "Übergabebelege konnten nicht sicher geladen werden." };
  }
}

async function reserveAttachmentForWorkflow(
  workflow: AttachmentWorkflow,
  authorization: AuthorizationSnapshot,
  input: ReserveOrderStationAttachmentInput,
): Promise<OrderStationAttachmentResult<ReserveAttachmentData>> {
  if (invalidReserveInput(input)) return { code: "VALIDATION_ERROR", message: "Ungültige Dateimetadaten oder Auftragsversion." };
  if (!canManage(authorization)) return { code: "FORBIDDEN", message: "Übergabeoriginale sind nicht erlaubt." };

  try {
    const decision = await withPrivilegedTenantTransaction<ReserveDecision>(authorization, async (tx) => {
      await tx.execute(sql`
        SELECT pg_advisory_xact_lock(
          hashtextextended(
            'order-attachment:' || ${workflow.key} || ':reserve:' || ${authorization.tenantId} || ':' ||
              ${authorization.userId} || ':' || ${input.clientRequestId},
            0
          )
        )
      `);

      const existingRows = await tx.execute<ReservationRow & { upload_grantable: boolean }>(sql`
        SELECT reservation.*,
               statement_timestamp() < reservation.upload_expires_at AS upload_grantable
        FROM private.order_station_evidence_reservations reservation
        WHERE reservation.tenant_id = ${authorization.tenantId}
          AND reservation.actor_id = ${authorization.userId}
          AND reservation.client_request_id = ${input.clientRequestId}
          AND reservation.purpose = ${workflow.purpose}
        LIMIT 2
      `);
      if (existingRows.length > 0) {
        if (existingRows.length !== 1 || !existingRows[0]) throw new Error("ORDER_STATION_ATTACHMENT_RESERVATION_INVALID");
        const existing = normalizeReservation(workflow, existingRows[0], authorization);
        if (
          existing.tenant_id !== authorization.tenantId
          || existing.client_request_id !== input.clientRequestId
          || existing.order_id !== input.orderId
          || existing.item_id !== input.itemId
          || existing.order_version !== input.expectedVersion
          || existing.mime_type !== input.mimeType
          || existing.file_bytes !== input.fileBytes
          || existing.content_sha256 !== input.contentSha256
          || existing.actor_id !== authorization.userId
        ) {
          return { terminal: { code: "CONFLICT", reason: "IDEMPOTENCY_MISMATCH", message: "Anfragekennung wurde bereits anders verwendet." } as const };
        }
        const existingEvidence = await loadEvidence(tx, existing);
        if (existingEvidence) {
          const receipt = await readReceiptByReservation(tx, authorization, existing, workflow);
          if (
            receipt.state !== "FINALIZED"
            || receipt.receiptId !== existingEvidence.id
            || receipt.verifiedAt !== toIso(existingEvidence.verified_at)
          ) {
            throw new Error("ORDER_STATION_ATTACHMENT_RECEIPT_INVALID");
          }
          return {
            terminal: {
              code: "OK",
              data: { receipt, upload: null, replayed: true },
            } as const,
          };
        }
        if (typeof existingRows[0].upload_grantable !== "boolean") {
          throw new Error("ORDER_STATION_ATTACHMENT_DB_TIME_INVALID");
        }
        if (!(await reservationGraphIsCurrent(tx, authorization, existing, workflow))) {
          return { terminal: { code: "CONFLICT", reason: "ORDER_CHANGED", message: "Auftragsstand hat sich geändert." } as const };
        }
        if (existingRows[0].upload_grantable !== true) {
          return { terminal: { code: "CONFLICT", reason: "UPLOAD_GRANT_EXPIRED", message: "Uploadfreigabe ist abgelaufen." } as const };
        }
        return { reservation: existing, replayed: true as const };
      }

      const orders = await tx.execute<LockedOrder>(sql`
        SELECT id, tenant_id, customer_id, version, station, current_station, current_station_id, status
        FROM public.orders
        WHERE id = ${input.orderId} AND tenant_id = ${authorization.tenantId}
        FOR UPDATE
      `);
      const order = orders[0];
      if (!order) return { terminal: { code: "NOT_FOUND", message: "Auftrag nicht verfügbar." } as const };
      if (orders.length !== 1 || order.version !== input.expectedVersion) {
        return { terminal: { code: "CONFLICT", reason: "ORDER_CHANGED", message: "Auftrag wurde bereits geändert." } as const };
      }
      if (
        order.id !== input.orderId
        || order.tenant_id !== authorization.tenantId
        || !order.customer_id
        || order.station !== workflow.station
        || order.current_station !== workflow.station
        || order.current_station_id !== workflow.station
        || order.status !== workflow.orderStatus
      ) return { terminal: { code: "VALIDATION_ERROR", message: "Auftrag ist nicht übergabebereit." } as const };

      const customers = await tx.execute<{ id: string; tenant_id: string }>(sql`
        SELECT id, tenant_id FROM public.customers
        WHERE id = ${order.customer_id} AND tenant_id = ${authorization.tenantId}
        FOR SHARE
      `);
      if (
        customers.length !== 1 || customers[0]?.id !== order.customer_id
        || customers[0]?.tenant_id !== authorization.tenantId
      ) return { terminal: { code: "VALIDATION_ERROR", message: "Kundenzuordnung ist ungültig." } as const };

      const items = await tx.execute<LockedItem>(sql`
        SELECT id, order_id, tenant_id, customer_id, current_station_id
        FROM public.items WHERE order_id = ${order.id} FOR UPDATE
      `);
      if (
        items.some((item) => item.order_id !== order.id
          || item.tenant_id !== authorization.tenantId
          || item.customer_id !== order.customer_id
          || item.current_station_id !== workflow.station)
        || items.filter((item) => item.id === input.itemId).length !== 1
      ) return { terminal: { code: "VALIDATION_ERROR", message: "Teilezuordnung ist ungültig." } as const };

      const events = await tx.execute<TransitionEventRow>(sql`
        SELECT event.id, event.tenant_id, event.order_id, event.item_id, event.event_type,
               event.client_event_id, event.correlation_id, event.event_schema_version,
               event.aggregate_version, event.from_station, event.station, event.status,
               event.user_id AS actor_id, actor.tenant_id AS actor_tenant_id
        FROM public.events event
        LEFT JOIN public.app_users actor ON actor.id = event.user_id
        WHERE event.tenant_id = ${authorization.tenantId}
          AND event.order_id = ${order.id}
          AND event.aggregate_version = ${input.expectedVersion}
          AND event.event_type = ${workflow.eventType}
        LIMIT 2
      `);
      const event = events[0];
      if (
        events.length !== 1 || !event || !validUuid(event.id)
        || event.tenant_id !== authorization.tenantId
        || event.order_id !== order.id || event.item_id !== null
        || !validUuid(event.client_event_id) || !validUuid(event.correlation_id)
        || event.event_schema_version !== 1 || event.aggregate_version !== input.expectedVersion
        || event.from_station !== workflow.fromStation || event.station !== workflow.station
        || event.status !== "success" || !validUuid(event.actor_id)
        || event.actor_tenant_id !== authorization.tenantId
      ) return { terminal: { code: "VALIDATION_ERROR", message: "Übergabeereignis ist ungültig." } as const };

      const reservationId = randomUUID();
      const inserted = await tx.execute<ReservationRow>(sql`
        INSERT INTO private.order_station_evidence_reservations (
          id, tenant_id, customer_id, order_id, item_id, transition_event_id,
          order_version, actor_id, client_request_id, purpose, station, bucket_id,
          object_path, mime_type, file_bytes, content_sha256
        ) VALUES (
          ${reservationId}, ${authorization.tenantId}, ${order.customer_id}, ${order.id},
          ${input.itemId}, ${event.id}, ${input.expectedVersion}, ${authorization.userId},
          ${input.clientRequestId}, ${workflow.purpose}, ${workflow.station}, ${BUCKET_ID},
          ${objectPath(workflow, reservationId, input.mimeType)}, ${input.mimeType}, ${input.fileBytes},
          ${input.contentSha256}
        ) RETURNING *
      `);
      if (inserted.length !== 1 || !inserted[0]) throw new Error("ORDER_STATION_ATTACHMENT_INSERT_FAILED");
      const reservation = normalizeReservation(workflow, inserted[0], authorization);
      if (!reservationMatchesCreateIntent(
        workflow,
        reservation,
        authorization,
        input,
        reservationId,
        order.customer_id,
        event.id,
      )) {
        throw new Error("ORDER_STATION_ATTACHMENT_INSERT_FAILED");
      }
      return { reservation, replayed: false as const };
    });

    if ("terminal" in decision) return decision.terminal;
    const receipt = await withPrivilegedTenantTransaction(authorization, async (tx) => {
      const current = await readReceiptByReservation(tx, authorization, decision.reservation, workflow);
      if (current.state === "FINALIZED") {
        const evidence = await loadEvidence(tx, decision.reservation);
        if (
          !evidence
          || current.receiptId !== evidence.id
          || current.verifiedAt !== toIso(evidence.verified_at)
        ) {
          throw new Error("ORDER_STATION_ATTACHMENT_RECEIPT_INVALID");
        }
      }
      return current;
    });
    if (receipt.state === "FINALIZED") {
      return { code: "OK", data: { receipt, upload: null, replayed: true } };
    }
    if (receipt.state !== "PENDING") return { code: "CONFLICT", reason: "ORDER_CHANGED", message: "Übergabeoriginal ist bereits bestätigt." };
    const storage = await import("@/lib/server/orderStationAttachmentStorage");
    const upload = await storage.createOrderStationAttachmentUploadGrant(decision.reservation.object_path);
    return { code: "OK", data: { receipt, upload, replayed: decision.replayed } };
  } catch {
    return { code: "UNAVAILABLE", message: "Uploadfreigabe konnte nicht sicher erstellt werden." };
  }
}

async function finalizeAttachmentForWorkflow(
  workflow: AttachmentWorkflow,
  authorization: AuthorizationSnapshot,
  input: FinalizeOrderStationAttachmentInput,
): Promise<OrderStationAttachmentResult<FinalizeAttachmentData>> {
  if (invalidSingleUuidInput(input, "reservationId")) return { code: "VALIDATION_ERROR", message: "Ungültige Reservierung." };
  if (!canManage(authorization)) return { code: "FORBIDDEN", message: "Übergabeoriginale sind nicht erlaubt." };

  try {
    const first = await withPrivilegedTenantTransaction<FinalizePhaseOne>(authorization, async (tx) => {
      await lockFinalizeMutex(tx, authorization, input.reservationId, workflow);
      const reservation = await loadOwnedReservation(tx, authorization, input.reservationId, workflow);
      if (!reservation) return { terminal: { code: "NOT_FOUND", message: "Reservierung nicht verfügbar." } as const };
      const evidence = await loadEvidence(tx, reservation);
      if (evidence) {
        const receipt = await readReceiptByReservation(tx, authorization, reservation, workflow);
        if (
          receipt.state !== "FINALIZED"
          || receipt.receiptId !== evidence.id
          || receipt.verifiedAt !== toIso(evidence.verified_at)
        ) {
          throw new Error("ORDER_STATION_ATTACHMENT_RECEIPT_INVALID");
        }
        return { terminal: { code: "OK", data: { receipt, replayed: true } } as const };
      }
      if (!(await reservationGraphIsCurrent(tx, authorization, reservation, workflow))) {
        return { terminal: { code: "CONFLICT", reason: "ORDER_CHANGED", message: "Auftragsstand hat sich geändert." } as const };
      }
      return { reservation };
    });
    if ("terminal" in first) return first.terminal;

    const storage = await import("@/lib/server/orderStationAttachmentStorage");
    let stable;
    try {
      stable = await storage.readStableOrderStationAttachment(first.reservation.object_path, {
        fileBytes: first.reservation.file_bytes,
        mimeType: first.reservation.mime_type as OrderStationAttachmentMime,
      });
    } catch (error) {
      if (
        error instanceof storage.OrderStationAttachmentStorageError
        && error.kind === "NOT_READY"
      ) return { code: "CONFLICT", reason: "UPLOAD_NOT_READY", message: "Upload ist noch nicht vollständig verfügbar." };
      if (
        error instanceof storage.OrderStationAttachmentStorageError
        && error.kind === "MISMATCH"
      ) return { code: "CONFLICT", reason: "UPLOAD_MISMATCH", message: "Upload stimmt nicht mit der Reservierung überein." };
      return { code: "UNAVAILABLE", message: "Storage-Prüfung ist derzeit nicht verfügbar." };
    }
    const { before, after, bytes } = stable;
    if (
      before.id !== after.id || before.version !== after.version || before.path !== after.path
      || before.bucketId !== after.bucketId || before.createdAt !== after.createdAt
      || before.size !== after.size || before.contentType !== after.contentType
      || !validUuid(before.id) || before.bucketId !== BUCKET_ID
      || before.path !== first.reservation.object_path
      || before.contentType !== first.reservation.mime_type
      || before.size !== first.reservation.file_bytes
      || bytes.byteLength !== first.reservation.file_bytes
      || detectMime(bytes) !== first.reservation.mime_type
      || createHash("sha256").update(bytes).digest("hex") !== first.reservation.content_sha256
    ) return { code: "CONFLICT", reason: "UPLOAD_MISMATCH", message: "Upload stimmt nicht mit der Reservierung überein." };

    const storageCreatedAt = toIso(before.createdAt);
    if (
      new Date(storageCreatedAt).getTime() < new Date(first.reservation.created_at).getTime()
      || new Date(storageCreatedAt).getTime() > new Date(first.reservation.upload_expires_at).getTime()
    ) return { code: "CONFLICT", reason: "UPLOAD_OUTSIDE_WINDOW", message: "Upload liegt außerhalb der Freigabefrist." };

    return await withPrivilegedTenantTransaction(authorization, async (tx) => {
      await lockFinalizeMutex(tx, authorization, input.reservationId, workflow);
      const reservation = await loadOwnedReservation(tx, authorization, input.reservationId, workflow);
      if (!reservation) return { code: "NOT_FOUND", message: "Reservierung nicht verfügbar." };
      if (!sameReservation(reservation, first.reservation)) {
        throw new Error("ORDER_STATION_ATTACHMENT_RESERVATION_CHANGED");
      }
      const existing = await loadEvidence(tx, reservation);
      if (existing) {
        if (!evidenceMatchesStableObject(existing, reservation, before)) {
          throw new Error("ORDER_STATION_ATTACHMENT_EVIDENCE_INVALID");
        }
        const receipt = await readReceiptByReservation(tx, authorization, reservation, workflow);
        if (
          receipt.state !== "FINALIZED"
          || receipt.receiptId !== existing.id
          || receipt.verifiedAt !== toIso(existing.verified_at)
        ) {
          throw new Error("ORDER_STATION_ATTACHMENT_RECEIPT_INVALID");
        }
        return { code: "OK", data: { receipt, replayed: true } };
      }
      if (!(await lockReservationGraphIsCurrent(tx, authorization, reservation, workflow))) {
        return { code: "CONFLICT", reason: "ORDER_CHANGED", message: "Auftragsstand hat sich geändert." };
      }
      const evidenceId = randomUUID();
      const inserted = await tx.execute<EvidenceRow>(sql`
        INSERT INTO private.order_station_evidence (
          id, reservation_id, tenant_id, actor_id, storage_object_id,
          storage_object_version, verified_mime_type, verified_file_bytes,
          verified_content_sha256, storage_created_at
        ) VALUES (
          ${evidenceId}, ${reservation.id}, ${authorization.tenantId}, ${authorization.userId},
          ${before.id}, ${before.version}, ${reservation.mime_type}, ${reservation.file_bytes},
          ${reservation.content_sha256}, ${storageCreatedAt}
        ) RETURNING *
      `);
      if (inserted.length !== 1 || !inserted[0]
        || inserted[0].id !== evidenceId
        || !evidenceMatchesStableObject(inserted[0], reservation, before)) {
        throw new Error("ORDER_STATION_ATTACHMENT_EVIDENCE_INSERT_FAILED");
      }

      const extractionId = randomUUID();
      const extractionRows = await tx.execute<EvidenceExtractionRow>(sql`
        INSERT INTO private.evidence_extraction_metadata (
          id, evidence_id, tenant_id, extraction_state
        ) VALUES (
          ${extractionId}, ${evidenceId}, ${authorization.tenantId}, 'NOT_REQUESTED'
        ) RETURNING *
      `);
      const extraction = extractionRows[0];
      if (
        extractionRows.length !== 1
        || !extraction
        || extraction.id !== extractionId
        || extraction.evidence_id !== evidenceId
        || extraction.tenant_id !== authorization.tenantId
        || extraction.extraction_state !== "NOT_REQUESTED"
        || extraction.provider !== null
        || extraction.detected_type !== null
        || extraction.detection_confidence !== null
        || extraction.extracted_data !== null
        || !extraction.field_confidence
        || typeof extraction.field_confidence !== "object"
        || Array.isArray(extraction.field_confidence)
        || Object.keys(extraction.field_confidence).length !== 0
        || new Date(toIso(extraction.created_at)).getTime() < new Date(toIso(inserted[0].verified_at)).getTime()
      ) throw new Error("ORDER_STATION_ATTACHMENT_EXTRACTION_INSERT_FAILED");

      const orderLinkId = randomUUID();
      const itemLinkId = randomUUID();
      const linkRows = await tx.execute<EvidenceDomainLinkRow>(sql`
        INSERT INTO private.evidence_domain_links (
          id, evidence_id, tenant_id, target_type, target_id
        ) VALUES
          (${orderLinkId}, ${evidenceId}, ${authorization.tenantId}, 'ORDER', ${reservation.order_id}),
          (${itemLinkId}, ${evidenceId}, ${authorization.tenantId}, 'ORDER_ITEM', ${reservation.item_id})
        RETURNING *
      `);
      const expectedLinks = new Map([
        [`ORDER\u0000${reservation.order_id}`, orderLinkId],
        [`ORDER_ITEM\u0000${reservation.item_id}`, itemLinkId],
      ]);
      if (
        linkRows.length !== 2
        || linkRows.some((link) =>
          !validUuid(link.id)
          || expectedLinks.get(`${link.target_type}\u0000${link.target_id}`) !== link.id
          || link.evidence_id !== evidenceId
          || link.tenant_id !== authorization.tenantId
          || new Date(toIso(link.created_at)).getTime() < new Date(toIso(inserted[0].verified_at)).getTime())
      ) throw new Error("ORDER_STATION_ATTACHMENT_LINKS_INSERT_FAILED");

      const receipt = await readReceiptByReservation(tx, authorization, reservation, workflow);
      if (
        receipt.state !== "FINALIZED"
        || receipt.receiptId !== evidenceId
        || receipt.verifiedAt !== toIso(inserted[0].verified_at)
      ) throw new Error("ORDER_STATION_ATTACHMENT_FINALIZE_READBACK_INVALID");
      return { code: "OK", data: { receipt, replayed: false } };
    });
  } catch {
    return { code: "UNAVAILABLE", message: "Übergabeoriginal konnte nicht sicher bestätigt werden." };
  }
}

async function getAttachmentOriginalForWorkflow(
  workflow: AttachmentWorkflow,
  authorization: AuthorizationSnapshot,
  input: GetOrderStationAttachmentOriginalInput,
): Promise<OrderStationAttachmentResult<{
  downloadUrl: string;
  expiresInSeconds: number;
  mimeType: OrderStationAttachmentMime;
}>> {
  if (invalidSingleUuidInput(input, "receiptId")) return { code: "VALIDATION_ERROR", message: "Ungültiger Beleg." };
  if (!canManage(authorization)) return { code: "FORBIDDEN", message: "Originaldownload ist nicht erlaubt." };
  try {
    const owned = await withPrivilegedTenantTransaction(authorization, async (tx) => {
      const viewRows = await tx.execute<ReceiptViewRow>(sql`
        SELECT * FROM private.v_order_evidence_attachment_receipts_v1
        WHERE receipt_id = ${input.receiptId}
          AND purpose = ${workflow.purpose}
        LIMIT 2
      `);
      if (viewRows.length === 0) return null;
      if (viewRows.length !== 1 || !viewRows[0]) throw new Error("ORDER_STATION_ATTACHMENT_RECEIPT_INVALID");
      const receipt = mapReceipt(workflow, viewRows[0], authorization);
      if (receipt.receiptId !== input.receiptId || receipt.state !== "FINALIZED") {
        throw new Error("ORDER_STATION_ATTACHMENT_RECEIPT_INVALID");
      }
      const rows = await tx.execute<OriginalBindingRow>(sql`
        SELECT
          reservation.id AS reservation_id_value,
          reservation.tenant_id AS reservation_tenant_id,
          reservation.customer_id AS reservation_customer_id,
          reservation.order_id AS reservation_order_id,
          reservation.item_id AS reservation_item_id,
          reservation.transition_event_id AS reservation_transition_event_id,
          reservation.order_version AS reservation_order_version,
          reservation.actor_id AS reservation_actor_id,
          reservation.client_request_id AS reservation_client_request_id,
          reservation.purpose AS reservation_purpose,
          reservation.station AS reservation_station,
          reservation.bucket_id AS reservation_bucket_id,
          reservation.object_path AS reservation_object_path,
          reservation.mime_type AS reservation_mime_type,
          reservation.file_bytes AS reservation_file_bytes,
          reservation.content_sha256 AS reservation_content_sha256,
          reservation.upload_expires_at AS reservation_upload_expires_at,
          reservation.created_at AS reservation_created_at,
          evidence.id AS evidence_id,
          evidence.reservation_id AS evidence_reservation_id,
          evidence.tenant_id AS evidence_tenant_id,
          evidence.actor_id AS evidence_actor_id,
          evidence.storage_object_id AS evidence_storage_object_id,
          evidence.storage_object_version AS evidence_storage_object_version,
          evidence.verified_mime_type AS evidence_verified_mime_type,
          evidence.verified_file_bytes AS evidence_verified_file_bytes,
          evidence.verified_content_sha256 AS evidence_verified_content_sha256,
          evidence.storage_created_at AS evidence_storage_created_at,
          evidence.verified_at AS evidence_verified_at
        FROM private.order_station_evidence evidence
        JOIN private.order_station_evidence_reservations reservation
          ON reservation.id = evidence.reservation_id
        WHERE evidence.id = ${input.receiptId}
          AND evidence.tenant_id = ${authorization.tenantId}
        FOR SHARE
      `);
      if (rows.length !== 1 || !rows[0]) throw new Error("ORDER_STATION_ATTACHMENT_RECEIPT_INVALID");
      const row = rows[0];
      const reservation = normalizeReservation(workflow, {
        id: row.reservation_id_value,
        tenant_id: row.reservation_tenant_id,
        customer_id: row.reservation_customer_id,
        order_id: row.reservation_order_id,
        item_id: row.reservation_item_id,
        transition_event_id: row.reservation_transition_event_id,
        order_version: row.reservation_order_version,
        actor_id: row.reservation_actor_id,
        client_request_id: row.reservation_client_request_id,
        purpose: row.reservation_purpose,
        station: row.reservation_station,
        bucket_id: row.reservation_bucket_id,
        object_path: row.reservation_object_path,
        mime_type: row.reservation_mime_type,
        file_bytes: row.reservation_file_bytes,
        content_sha256: row.reservation_content_sha256,
        upload_expires_at: row.reservation_upload_expires_at,
        created_at: row.reservation_created_at,
      }, authorization);
      const evidence: EvidenceRow = {
        id: row.evidence_id,
        reservation_id: row.evidence_reservation_id,
        tenant_id: row.evidence_tenant_id,
        actor_id: row.evidence_actor_id,
        storage_object_id: row.evidence_storage_object_id,
        storage_object_version: row.evidence_storage_object_version,
        verified_mime_type: row.evidence_verified_mime_type,
        verified_file_bytes: row.evidence_verified_file_bytes,
        verified_content_sha256: row.evidence_verified_content_sha256,
        storage_created_at: row.evidence_storage_created_at,
        verified_at: row.evidence_verified_at,
      };
      if (
        evidence.id !== input.receiptId
        || reservation.id !== receipt.reservationId
        || !receiptMatchesReservation(receipt, reservation)
        || receipt.state !== "FINALIZED"
        || receipt.receiptId !== evidence.id
        || receipt.verifiedAt !== toIso(evidence.verified_at)
        || !evidenceMatchesStableObject(evidence, reservation, {
        id: evidence.storage_object_id,
        version: evidence.storage_object_version,
        createdAt: toIso(evidence.storage_created_at),
      })) throw new Error("ORDER_STATION_ATTACHMENT_EVIDENCE_INVALID");
      return { reservation, evidence };
    });
    if (!owned) return { code: "NOT_FOUND", message: "Beleg nicht verfügbar." };

    const storage = await import("@/lib/server/orderStationAttachmentStorage");
    const info = await storage.readOrderStationAttachmentInfo(owned.reservation.object_path);
    if (
      info.id !== owned.evidence.storage_object_id
      || info.version !== owned.evidence.storage_object_version
      || info.path !== owned.reservation.object_path
      || info.bucketId !== BUCKET_ID
      || info.contentType !== owned.reservation.mime_type
      || info.size !== owned.reservation.file_bytes
      || toIso(info.createdAt) !== toIso(owned.evidence.storage_created_at)
    ) return { code: "CONFLICT", reason: "STORAGE_CHANGED", message: "Gespeichertes Original hat sich verändert." };
    const signed = await storage.createOrderStationAttachmentOriginalUrl(
      owned.reservation.object_path,
      MIME_EXTENSION[owned.reservation.mime_type as OrderStationAttachmentMime],
      workflow.downloadName,
    );
    return { code: "OK", data: { ...signed, mimeType: owned.reservation.mime_type as OrderStationAttachmentMime } };
  } catch {
    return { code: "UNAVAILABLE", message: "Originaldownload konnte nicht sicher erstellt werden." };
  }
}

export function readOrderStationAttachments(
  authorization: AuthorizationSnapshot,
  input: GetOrderStationAttachmentsInput,
): Promise<OrderStationAttachmentResult<OrderStationAttachmentReceipt[]>> {
  return readAttachmentsForWorkflow(HANDOFF_WORKFLOW, authorization, input);
}

export function readOrderIntakeAttachments(
  authorization: AuthorizationSnapshot,
  input: GetOrderStationAttachmentsInput,
): Promise<OrderStationAttachmentResult<OrderStationAttachmentReceipt[]>> {
  return readAttachmentsForWorkflow(INTAKE_WORKFLOW, authorization, input);
}

export function reserveOrderStationAttachment(
  authorization: AuthorizationSnapshot,
  input: ReserveOrderStationAttachmentInput,
): Promise<OrderStationAttachmentResult<ReserveAttachmentData>> {
  return reserveAttachmentForWorkflow(HANDOFF_WORKFLOW, authorization, input);
}

export function reserveOrderIntakeAttachment(
  authorization: AuthorizationSnapshot,
  input: ReserveOrderStationAttachmentInput,
): Promise<OrderStationAttachmentResult<ReserveAttachmentData>> {
  return reserveAttachmentForWorkflow(INTAKE_WORKFLOW, authorization, input);
}

export function finalizeOrderStationAttachment(
  authorization: AuthorizationSnapshot,
  input: FinalizeOrderStationAttachmentInput,
): Promise<OrderStationAttachmentResult<FinalizeAttachmentData>> {
  return finalizeAttachmentForWorkflow(HANDOFF_WORKFLOW, authorization, input);
}

export function finalizeOrderIntakeAttachment(
  authorization: AuthorizationSnapshot,
  input: FinalizeOrderStationAttachmentInput,
): Promise<OrderStationAttachmentResult<FinalizeAttachmentData>> {
  return finalizeAttachmentForWorkflow(INTAKE_WORKFLOW, authorization, input);
}

export function getOrderStationAttachmentOriginal(
  authorization: AuthorizationSnapshot,
  input: GetOrderStationAttachmentOriginalInput,
): Promise<OrderStationAttachmentResult<{
  downloadUrl: string;
  expiresInSeconds: number;
  mimeType: OrderStationAttachmentMime;
}>> {
  return getAttachmentOriginalForWorkflow(HANDOFF_WORKFLOW, authorization, input);
}

export function getOrderIntakeAttachmentOriginal(
  authorization: AuthorizationSnapshot,
  input: GetOrderStationAttachmentOriginalInput,
): Promise<OrderStationAttachmentResult<{
  downloadUrl: string;
  expiresInSeconds: number;
  mimeType: OrderStationAttachmentMime;
}>> {
  return getAttachmentOriginalForWorkflow(INTAKE_WORKFLOW, authorization, input);
}
