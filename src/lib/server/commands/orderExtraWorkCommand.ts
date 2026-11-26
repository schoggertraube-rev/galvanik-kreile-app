import "server-only";

import { sql } from "drizzle-orm";
import { hasAuthorizationArea } from "@/lib/auth/authorizationContract";
import { resolveAuthorization, type AuthorizationSnapshot } from "@/lib/server/authorization";
import { canViewOrderCard } from "@/lib/server/orderCardRead";
import { leseMehrarbeitsfreigabe, ORDER_LIFECYCLE_STATUS } from "@/modules/orders/public";
import { withPrivilegedTenantTransaction } from "@/lib/server/privilegedDb";
import { ORDER_CONTENT_COPY } from "@/ui/ordersCopy";
import { readOrderInvoiceNumberInTransaction, readOrderScrapInvoiceNumberInTransaction } from "./immutableInvoiceCommand";
import type {PrivilegedTenantTransaction} from '@/lib/server/privilegedDb';
import {isOfflineOriginal,normalizeOfflineOriginal,offlineOccurrenceTime,type OfflineOriginal} from '@/lib/domain/offlineOriginal';
import {canonicalJson} from '@/lib/domain/canonicalJson';

const EVENT_TYPE = "ORDER_ITEM_EXTRA_WORK_CHANGED_V1";
const APPROVAL_EVENT_TYPE = "ORDER_EXTRA_WORK_APPROVED_V1";
const EVENT_SCHEMA_VERSION = 1 as const;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

export type ChangeOrderItemExtraWorkInput = {
  offlineOriginal?:OfflineOriginal;
  lineId: string;
  orderId: string;
  itemId: string;
  catalogPositionId: string;
  minutes: number;
  active: boolean;
  expectedLineVersion: number;
  expectedOrderVersion: number;
  clientEventId: string;
};

export type OrderItemExtraWorkReceipt = {
  eventId: string;
  clientEventId: string;
  correlationId: string;
  eventSchemaVersion: 1;
  orderId: string;
  itemId: string;
  lineId: string;
  catalogPositionId: string;
  minutes: number;
  active: boolean;
  lineVersion: number;
  aggregateVersion: number;
  actorId: string;
  occurredAt: string;
};

export type ChangeOrderItemExtraWorkResult =
  | { code: "OK"; receipt: OrderItemExtraWorkReceipt; replayed: boolean }
  | { code: "UNAUTHENTICATED"; message: string }
  | { code: "FORBIDDEN"; message: string }
  | { code: "NOT_FOUND"; message: string }
  | { code: "CONFLICT"; message: string }
  | { code: "VALIDATION_ERROR"; message: string }
  | { code: "UNAVAILABLE"; message: string };

export type RecordPhoneExtraWorkApprovalInput = Pick<
  NonNullable<ReturnType<typeof leseMehrarbeitsfreigabe>>, "approvedNetAmountCents" | "positions" | "confirmationText"
> & {
  orderId: string;
  clientEventId: string;
};

export type RecordExtraWorkApprovalInput = RecordPhoneExtraWorkApprovalInput & (
  | { channel: "telefon" }
  | { channel: "mail"; intakeItemId: string }
);

export type ReadLinkedApprovalMail = (
  tx: PrivilegedTenantTransaction, auth: AuthorizationSnapshot, intakeItemId: string,
) => Promise<{ id: string; orderId: string; customerId: string } | null>;

export type RecordExtraWorkApprovalResult =
  | { code: "OK"; eventId: string; replayed: boolean }
  | { code: "INVOICE_ISSUED"; invoiceNumber: string }
  | { code: "UNAVAILABLE"; message: string; next: { label: string; kind: "retry" } }
  | { code: "FORBIDDEN"; message: string }
  | { code: "NOT_FOUND" | "CONFLICT"; message: string; next: { label: string; href: string } }
  | { code: "VALIDATION_ERROR" | "UNAUTHENTICATED" };

export type RecordPhoneExtraWorkApprovalResult = RecordExtraWorkApprovalResult;

export function recordPhoneExtraWorkApproval(input: unknown): Promise<RecordExtraWorkApprovalResult> {
  return recordExtraWorkApproval(
    input && typeof input === "object" && !Array.isArray(input) ? { ...input, channel: "telefon", intakeItemId: undefined } : input,
  );
}

export async function recordExtraWorkApproval(
  input: unknown,
  readLinkedApprovalMail?: ReadLinkedApprovalMail,
): Promise<RecordExtraWorkApprovalResult> {
  if (!input || typeof input !== "object" || Array.isArray(input)) return { code: "VALIDATION_ERROR" };
  const { orderId, clientEventId, approvedNetAmountCents, positions: requestedPositions, confirmationText, channel, intakeItemId } =
    input as Record<string, unknown>;
  if (typeof clientEventId !== "string" || !UUID_PATTERN.test(clientEventId)
    || typeof orderId !== "string" || orderId !== orderId.trim() || !orderId || orderId.length > 128) {
    return { code: "VALIDATION_ERROR" };
  }
  const nichtVerfuegbar = {
    code: "UNAVAILABLE" as const, message: ORDER_CONTENT_COPY.extraWorkApprovalUnavailable,
    next: { kind: "retry" as const, label: ORDER_CONTENT_COPY.extraWorkApprovalRetry },
  };
  try {
    const konflikt = {
      code: "CONFLICT" as const, message: ORDER_CONTENT_COPY.extraWorkApprovalConflict,
      next: { label: ORDER_CONTENT_COPY.extraWorkApprovalReopen, href: `/orders/${encodeURIComponent(orderId)}` },
    };
    const authorization = await resolveAuthorization();
    if (!authorization.ok) {
      return authorization.reason === "AUTHORIZATION_UNAVAILABLE"
        ? nichtVerfuegbar
        : { code: "UNAUTHENTICATED" };
    }
    const auth = authorization.data;
    if (!canViewOrderCard(auth) || !hasAuthorizationArea(auth, "preise") || auth.packageSwitches?.p3_werkstatt !== true
      || (channel === "mail" && (!hasAuthorizationArea(auth, "mails") || !hasAuthorizationArea(auth, "auftraege")))) {
      return { code: "FORBIDDEN", message: ORDER_CONTENT_COPY.extraWorkApprovalForbidden };
    }

    const approval = leseMehrarbeitsfreigabe({
      approvedNetAmountCents, positions: requestedPositions, confirmationText,
      channel, intakeItemId, approvedBy: auth.userId, approvedAt: new Date().toISOString(),
    });
    if (!approval) return { code: "VALIDATION_ERROR" };
    const payload = {
      ...approval,
      positions: approval.positions.map(({ lineId, lineVersion }) => ({ lineId, lineVersion }))
        .sort((links, rechts) => links.lineId.localeCompare(rechts.lineId)),
    };

    return await withPrivilegedTenantTransaction(auth, async tx => {
      await tx.execute(sql`
        SELECT pg_advisory_xact_lock(hashtextextended('f1:client-event:' || ${auth.tenantId} || ':' || ${clientEventId}, 0))
      `);
      const events = await tx.execute<{
        id: string; order_id: string; user_id: string; event_type: string; status: string; payload: unknown;
      }>(sql`
        SELECT id, order_id, user_id, event_type, status, payload FROM public.events
        WHERE tenant_id = ${auth.tenantId} AND client_event_id = ${clientEventId}::uuid
        LIMIT 2
      `);
      if (events.length) {
        const [event] = events;
        const recorded = leseMehrarbeitsfreigabe(event.payload);
        if (events.length === 1 && event.order_id === orderId && event.user_id === auth.userId
          && event.event_type === APPROVAL_EVENT_TYPE && event.status === "success"
          && recorded && canonicalJson(recorded) === canonicalJson({ ...payload, approvedAt: recorded.approvedAt })) {
          return { code: "OK", eventId: event.id, replayed: true };
        }
        return konflikt;
      }

      const [order] = await tx.execute<{ version: number; station: string; customer_id: string }>(sql`
        SELECT version, station, customer_id FROM public.orders
        WHERE tenant_id = ${auth.tenantId} AND id = ${orderId}
        FOR UPDATE
      `);
      if (!order) return {
        code: "NOT_FOUND", message: ORDER_CONTENT_COPY.extraWorkApprovalNotFound,
        next: { label: ORDER_CONTENT_COPY.extraWorkApprovalOpenList, href: "/orders" },
      };
      if (payload.channel === "mail") {
        if (!readLinkedApprovalMail) throw Error("ORDER_EXTRA_WORK_APPROVAL_MAIL_PORT_MISSING");
        const original = await readLinkedApprovalMail(tx, auth, payload.intakeItemId);
        if (!original || original.id !== payload.intakeItemId
          || original.orderId !== orderId || original.customerId !== order.customer_id) return konflikt;
      }
      const invoiceNumber = await readOrderScrapInvoiceNumberInTransaction(tx, auth.tenantId, orderId);
      if (invoiceNumber) return { code: "INVOICE_ISSUED", invoiceNumber };

      const positions = await tx.execute<{ line_id: string; line_version: number; integrity_ok: boolean }>(sql`
        SELECT line_id::text, line_version, integrity_ok FROM private.v_order_extra_work_live_v1
        WHERE tenant_id = ${auth.tenantId} AND order_id = ${orderId}
          AND line_id IN (${sql.join(payload.positions.map(position => sql`${position.lineId}::uuid`), sql`, `)})
      `);
      const versions = new Map(positions.filter(position => position.integrity_ok)
        .map(position => [position.line_id, position.line_version]));
      if (positions.length !== payload.positions.length
        || payload.positions.some(position => versions.get(position.lineId) !== position.lineVersion)) {
        return konflikt;
      }

      const [written] = await tx.execute<{ id: string }>(sql`
        INSERT INTO public.events (
          id, tenant_id, order_id, event_type, description, payload, status, user_id, station, created_at,
          client_event_id, event_schema_version, correlation_id, aggregate_version
        ) VALUES (
          gen_random_uuid()::text, ${auth.tenantId}, ${orderId}, ${APPROVAL_EVENT_TYPE}, '',
          ${JSON.stringify(payload)}::jsonb, 'success', ${auth.userId}::uuid, ${order.station},
          clock_timestamp() AT TIME ZONE 'UTC', ${clientEventId}::uuid, ${EVENT_SCHEMA_VERSION},
          gen_random_uuid(), ${order.version}
        ) RETURNING id
      `);
      if (!written) throw Error("ORDER_EXTRA_WORK_APPROVAL_WRITE_FAILED");
      return { code: "OK", eventId: written.id, replayed: false };
    });
  } catch (error) {
    console.error("[ORDER_EXTRA_WORK_APPROVAL_FAILED]", error instanceof Error ? error.name : "UnknownError");
    return nichtVerfuegbar;
  }
}

type LockedOrder = {
  id: string;
  tenant_id: string;
  customer_id: string;
  station: string;
  current_station: string | null;
  current_station_id: string | null;
  status: string;
  version: number;
};

type LockedItem = {
  id: string;
  tenant_id: string;
  order_id: string;
  customer_id: string;
  current_station_id: string | null;
};

type CatalogRow = {
  id: string;
  tenant_id: string;
  active: boolean;
};

type LineRow = {
  id: string;
  tenant_id: string;
  order_id: string;
  item_id: string;
  catalog_position_id: string;
  minutes: number;
  active: boolean;
  version: number;
};

type ReceiptRow = {
  event_id: string;
  tenant_id: string;
  order_id: string;
  item_id: string;
  client_event_id: string;
  correlation_id: string;
  event_schema_version: number;
  aggregate_version: number;
  actor_id: string;
  line_id: string;
  catalog_position_id: string;
  minutes: number;
  active: boolean;
  line_version: number;
  occurred_at: Date | string;
  integrity_ok: boolean;
};

function hasExactKeys(value: unknown): value is Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const expected = [
    "active", "catalogPositionId", "clientEventId", "expectedLineVersion",
    "expectedOrderVersion", "itemId", "lineId", "minutes", "orderId",
  ].sort();
  if(Object.hasOwn(value,'offlineOriginal'))expected.push('offlineOriginal');expected.sort();
  const actual = Object.keys(value).sort();
  return actual.length === expected.length && actual.every((key, index) => key === expected[index]);
}

function isValidInput(input: unknown): input is ChangeOrderItemExtraWorkInput {
  return hasExactKeys(input)
    && (input.offlineOriginal===undefined||isOfflineOriginal(input.offlineOriginal))
    && typeof input.lineId === "string"
    && UUID_PATTERN.test(input.lineId)
    && typeof input.catalogPositionId === "string"
    && UUID_PATTERN.test(input.catalogPositionId)
    && typeof input.clientEventId === "string"
    && UUID_PATTERN.test(input.clientEventId)
    && typeof input.orderId === "string"
    && input.orderId.trim().length > 0
    && input.orderId.length <= 128
    && typeof input.itemId === "string"
    && input.itemId.trim().length > 0
    && input.itemId.length <= 128
    && typeof input.minutes === "number"
    && Number.isSafeInteger(input.minutes)
    && input.minutes >= 1
    && input.minutes <= 1440
    && typeof input.active === "boolean"
    && typeof input.expectedLineVersion === "number"
    && Number.isSafeInteger(input.expectedLineVersion)
    && input.expectedLineVersion >= 0
    && typeof input.expectedOrderVersion === "number"
    && Number.isSafeInteger(input.expectedOrderVersion)
    && input.expectedOrderVersion > 0;
}

function toIso(value: unknown): string {
  const parsed = value instanceof Date ? value : new Date(value as string);
  if (!Number.isFinite(parsed.getTime())) throw new Error("ORDER_EXTRA_WORK_RECEIPT_TIME_INVALID");
  return parsed.toISOString();
}

function mapReceipt(row: ReceiptRow, tenantId: string, actorId: string): OrderItemExtraWorkReceipt {
  if (
    row.integrity_ok !== true
    || row.tenant_id !== tenantId
    || row.actor_id !== actorId
    || row.event_schema_version !== EVENT_SCHEMA_VERSION
    || !UUID_PATTERN.test(row.client_event_id)
    || !UUID_PATTERN.test(row.correlation_id)
    || !UUID_PATTERN.test(row.line_id)
    || !UUID_PATTERN.test(row.catalog_position_id)
    || !Number.isSafeInteger(row.aggregate_version)
    || row.aggregate_version <= 0
    || !Number.isSafeInteger(row.line_version)
    || row.line_version <= 0
    || !Number.isSafeInteger(row.minutes)
    || row.minutes < 1
    || row.minutes > 1440
    || typeof row.active !== "boolean"
  ) throw new Error("ORDER_EXTRA_WORK_RECEIPT_INVALID");

  return {
    eventId: row.event_id,
    clientEventId: row.client_event_id,
    correlationId: row.correlation_id,
    eventSchemaVersion: 1,
    orderId: row.order_id,
    itemId: row.item_id,
    lineId: row.line_id,
    catalogPositionId: row.catalog_position_id,
    minutes: row.minutes,
    active: row.active,
    lineVersion: row.line_version,
    aggregateVersion: row.aggregate_version,
    actorId: row.actor_id,
    occurredAt: toIso(row.occurred_at),
  };
}

function receiptMatchesIntent(
  receipt: OrderItemExtraWorkReceipt,
  input: ChangeOrderItemExtraWorkInput,
): boolean {
  return receipt.orderId === input.orderId
    && receipt.itemId === input.itemId
    && receipt.lineId === input.lineId
    && receipt.catalogPositionId === input.catalogPositionId
    && receipt.minutes === input.minutes
    && receipt.active === input.active
    && receipt.lineVersion === input.expectedLineVersion + 1
    && receipt.aggregateVersion === input.expectedOrderVersion + 1;
}
async function offlineOriginalMatches(tx:PrivilegedTenantTransaction,tenantId:string,eventId:string,original:OfflineOriginal|undefined){
 const rows=await tx.execute<{original:unknown}>(sql`SELECT payload->'offlineOriginal' AS original FROM public.events WHERE tenant_id=${tenantId} AND id=${eventId} AND event_type=${EVENT_TYPE} AND status='success'`);
 return rows.length===1&&canonicalJson(rows[0].original??null)===canonicalJson(original??null);
}

export async function changeOrderItemExtraWork(
  input: ChangeOrderItemExtraWorkInput,
): Promise<ChangeOrderItemExtraWorkResult> {
  if (!isValidInput(input)) {
    return { code: "VALIDATION_ERROR", message: "Ungültige Mehrarbeitsänderung." };
  }

  let authorization;
  try {
    authorization = await resolveAuthorization();
  } catch {
    return { code: "UNAVAILABLE", message: "Mehrarbeit konnte nicht gespeichert werden." };
  }
  if (!authorization.ok) {
    return authorization.reason === "AUTHORIZATION_UNAVAILABLE"
      ? { code: "UNAVAILABLE", message: "Mehrarbeit konnte nicht gespeichert werden." }
      : { code: "UNAUTHENTICATED", message: "Sitzung oder Berechtigung ist nicht verfügbar." };
  }
  if (!authorization.data.permissions.includes("perm_op_status")) {
    return { code: "FORBIDDEN", message: "Mehrarbeit darf mit dieser Rolle nicht geändert werden." };
  }
  if(input.offlineOriginal&&(input.offlineOriginal.actorId!==authorization.data.userId||input.offlineOriginal.clientEventId!==input.clientEventId))return {code:'CONFLICT',message:'Anfragekennung wurde bereits anders verwendet.'};
  if(input.offlineOriginal)input={...input,offlineOriginal:normalizeOfflineOriginal(input.offlineOriginal)};

  try {
    return await withPrivilegedTenantTransaction(authorization.data, async (tx) => {
      await tx.execute(sql`
        SELECT pg_advisory_xact_lock(
          hashtextextended(
            'f1:client-event:' || ${authorization.data.tenantId} || ':' || ${input.clientEventId},
            0
          )
        )
      `);
      const replayRows = await tx.execute<ReceiptRow>(sql`
        SELECT * FROM private.v_order_item_extra_work_receipts_v1
        WHERE client_event_id = ${input.clientEventId}
        LIMIT 2
      `);
      if (replayRows.length > 0) {
        if (replayRows.length !== 1 || !replayRows[0]) {
          return { code: "CONFLICT", message: "Anfragekennung wurde bereits anders verwendet." };
        }
        const receipt = mapReceipt(
          replayRows[0], authorization.data.tenantId, authorization.data.userId,
        );
        return receiptMatchesIntent(receipt, input)&&await offlineOriginalMatches(tx,authorization.data.tenantId,receipt.eventId,input.offlineOriginal)
          ? { code: "OK", receipt, replayed: true }
          : { code: "CONFLICT", message: "Anfragekennung wurde bereits anders verwendet." };
      }

      const reusedEvents = await tx.execute<{ id: string }>(sql`
        SELECT id FROM public.events
        WHERE tenant_id = ${authorization.data.tenantId}
          AND client_event_id = ${input.clientEventId}
        LIMIT 1
      `);
      if (reusedEvents.length > 0) {
        return { code: "CONFLICT", message: "Anfragekennung wurde bereits anders verwendet." };
      }

      const orderRows = await tx.execute<LockedOrder>(sql`
        SELECT id, tenant_id, customer_id, station, current_station,
               current_station_id, status, version
        FROM public.orders
        WHERE id = ${input.orderId}
          AND tenant_id = ${authorization.data.tenantId}
        FOR UPDATE
      `);
      const order = orderRows[0];
      if (orderRows.length !== 1 || !order) {
        return { code: "NOT_FOUND", message: "Auftrag oder Teil nicht verfügbar." };
      }
      if (order.version !== input.expectedOrderVersion) {
        return { code: "CONFLICT", message: "Auftrag wurde bereits geändert." };
      }
      const invoiceNumber = await readOrderInvoiceNumberInTransaction(
        tx, authorization.data.tenantId, order.id, "issued",
      );
      if (invoiceNumber) {
        return { code: "CONFLICT", message: ORDER_CONTENT_COPY.invoiceAlreadyIssued(invoiceNumber) };
      }
      if (
        order.station !== ORDER_LIFECYCLE_STATUS.GALVANIK
        || order.current_station !== ORDER_LIFECYCLE_STATUS.GALVANIK
        || order.current_station_id !== ORDER_LIFECYCLE_STATUS.GALVANIK
        || order.status !== ORDER_LIFECYCLE_STATUS.GALVANIK
      ) {
        return { code: "VALIDATION_ERROR", message: "Mehrarbeit ist nur in Galvanik änderbar." };
      }

      const activeFreezeRows = await tx.execute<{ id: string; integrity_ok: boolean }>(sql`
        SELECT freeze_id::text AS id, integrity_ok
        FROM private.v_order_freeze_state_v1
        WHERE tenant_id = ${authorization.data.tenantId}
          AND order_id = ${order.id}
          AND active = true
        LIMIT 2
      `);
      if (activeFreezeRows.length > 1 || activeFreezeRows.some((row) => row.integrity_ok !== true)) {
        throw new Error("ORDER_ACTIVE_FREEZE_STATE_INVALID");
      }
      if (activeFreezeRows.length === 1) {
        return { code: "VALIDATION_ERROR", message: "Fertiger Auftrag ist unveränderlich." };
      }

      const itemRows = await tx.execute<LockedItem>(sql`
        SELECT id, tenant_id, order_id, customer_id, current_station_id
        FROM public.items
        WHERE id = ${input.itemId} AND order_id = ${order.id}
        FOR UPDATE
      `);
      const item = itemRows[0];
      if (
        itemRows.length !== 1
        || !item
        || item.tenant_id !== authorization.data.tenantId
        || item.customer_id !== order.customer_id
        || item.current_station_id !== ORDER_LIFECYCLE_STATUS.GALVANIK
      ) {
        return { code: "NOT_FOUND", message: "Auftrag oder Teil nicht verfügbar." };
      }

      const catalogRows = await tx.execute<CatalogRow>(sql`
        SELECT id::text AS id, tenant_id, active
        FROM private.extra_work_catalog_positions
        WHERE tenant_id = ${authorization.data.tenantId}
          AND id = ${input.catalogPositionId}::uuid
        FOR SHARE
      `);
      const catalog = catalogRows[0];
      if (catalogRows.length !== 1 || !catalog) {
        return { code: "NOT_FOUND", message: "Katalogposition nicht verfügbar." };
      }
      if (input.active && !catalog.active) {
        return { code: "VALIDATION_ERROR", message: "Inaktive Katalogposition kann nicht gewählt werden." };
      }

      const lineRows = await tx.execute<LineRow>(sql`
        SELECT id::text AS id, tenant_id, order_id, item_id,
               catalog_position_id::text AS catalog_position_id,
               minutes, active, version
        FROM private.order_item_extra_work
        WHERE tenant_id = ${authorization.data.tenantId}
          AND item_id = ${item.id}
          AND catalog_position_id = ${input.catalogPositionId}::uuid
        FOR UPDATE
      `);
      if (lineRows.length > 1) throw new Error("ORDER_EXTRA_WORK_LINE_AMBIGUOUS");
      const line = lineRows[0];
      if (line && line.id !== input.lineId) {
        return { code: "CONFLICT", message: "Mehrarbeitszeile besitzt eine andere Kennung." };
      }
      if ((line?.version ?? 0) !== input.expectedLineVersion) {
        return { code: "CONFLICT", message: "Mehrarbeitszeile wurde bereits geändert." };
      }
      if (!line && !input.active) {
        return { code: "VALIDATION_ERROR", message: "Nicht vorhandene Mehrarbeit kann nicht deaktiviert werden." };
      }

      const nextLineVersion = input.expectedLineVersion + 1;
      const nextOrderVersion = input.expectedOrderVersion + 1;
      const changedOrders = await tx.execute<{ id: string; version: number }>(sql`
        UPDATE public.orders
        SET version = version + 1
        WHERE id = ${order.id}
          AND tenant_id = ${authorization.data.tenantId}
          AND version = ${input.expectedOrderVersion}
          AND status = ${ORDER_LIFECYCLE_STATUS.GALVANIK}
        RETURNING id, version
      `);
      if (changedOrders.length !== 1 || changedOrders[0]?.version !== nextOrderVersion) {
        return { code: "CONFLICT", message: "Auftrag wurde bereits geändert." };
      }

      const changedLines = line
        ? await tx.execute<LineRow>(sql`
            UPDATE private.order_item_extra_work
            SET minutes = ${input.minutes},
                active = ${input.active},
                version = ${nextLineVersion},
                updated_by = ${authorization.data.userId}::uuid,
                updated_at = clock_timestamp()
            WHERE tenant_id = ${authorization.data.tenantId}
              AND id = ${input.lineId}::uuid
              AND version = ${input.expectedLineVersion}
            RETURNING id::text AS id, tenant_id, order_id, item_id,
                      catalog_position_id::text AS catalog_position_id,
                      minutes, active, version
          `)
        : await tx.execute<LineRow>(sql`
            INSERT INTO private.order_item_extra_work (
              id, tenant_id, order_id, item_id, catalog_position_id,
              minutes, active, version, created_by, updated_by, created_at, updated_at
            ) VALUES (
              ${input.lineId}::uuid, ${authorization.data.tenantId}, ${order.id}, ${item.id},
              ${input.catalogPositionId}::uuid, ${input.minutes}, true, 1,
              ${authorization.data.userId}::uuid, ${authorization.data.userId}::uuid,
              clock_timestamp(), clock_timestamp()
            )
            RETURNING id::text AS id, tenant_id, order_id, item_id,
                      catalog_position_id::text AS catalog_position_id,
                      minutes, active, version
          `);
      if (
        changedLines.length !== 1
        || changedLines[0]?.id !== input.lineId
        || changedLines[0]?.version !== nextLineVersion
      ) throw new Error("ORDER_EXTRA_WORK_LINE_WRITE_FAILED");

      await tx.execute(sql`
        INSERT INTO public.events (
          id, tenant_id, order_id, item_id, event_type, description, payload,
          status, user_id, station, created_at, client_event_id,
          event_schema_version, correlation_id, aggregate_version, from_station
        ) VALUES (
          gen_random_uuid()::text, ${authorization.data.tenantId}, ${order.id}, ${item.id},
          ${EVENT_TYPE}, 'Order item extra work changed',
          ${JSON.stringify({
            lineId: input.lineId,
            catalogPositionId: input.catalogPositionId,
            minutes: input.minutes,
            active: input.active,
            lineVersion: nextLineVersion,
            ...(input.offlineOriginal?{offlineOriginal:input.offlineOriginal,...(offlineOccurrenceTime(input.offlineOriginal.deviceCapturedAt).geraetezeit_abweichend?{geraetezeit_abweichend:true}:{})}:{}),
          })}::jsonb,
          'success', ${authorization.data.userId}::uuid,
          ${ORDER_LIFECYCLE_STATUS.GALVANIK},
          clock_timestamp() AT TIME ZONE 'UTC', ${input.clientEventId}::uuid,
          ${EVENT_SCHEMA_VERSION}, gen_random_uuid(), ${nextOrderVersion},
          ${ORDER_LIFECYCLE_STATUS.GALVANIK}
        )
      `);
      const receiptRows = await tx.execute<ReceiptRow>(sql`
        SELECT * FROM private.v_order_item_extra_work_receipts_v1
        WHERE client_event_id = ${input.clientEventId}
        LIMIT 2
      `);
      if (receiptRows.length !== 1 || !receiptRows[0]) throw new Error("ORDER_EXTRA_WORK_RECEIPT_MISSING");
      const receipt = mapReceipt(
        receiptRows[0], authorization.data.tenantId, authorization.data.userId,
      );
      if (!receiptMatchesIntent(receipt, input)||!await offlineOriginalMatches(tx,authorization.data.tenantId,receipt.eventId,input.offlineOriginal)) throw new Error("ORDER_EXTRA_WORK_RECEIPT_MISMATCH");
      return { code: "OK", receipt, replayed: false };
    });
  } catch {
    return { code: "UNAVAILABLE", message: "Mehrarbeit konnte nicht sicher gespeichert werden." };
  }
}
