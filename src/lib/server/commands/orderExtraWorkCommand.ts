import "server-only";

import { sql } from "drizzle-orm";
import { resolveAuthorization } from "@/lib/server/authorization";
import { ORDER_LIFECYCLE_STATUS, ORDER_STATION_FORWARD_ROLES } from "@/lib/orders/orderLifecycleContract";
import { withPrivilegedTenantTransaction } from "@/lib/server/privilegedDb";

const EVENT_TYPE = "ORDER_ITEM_EXTRA_WORK_CHANGED_V1";
const EVENT_SCHEMA_VERSION = 1 as const;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

export type ChangeOrderItemExtraWorkInput = {
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
  const actual = Object.keys(value).sort();
  return actual.length === expected.length && actual.every((key, index) => key === expected[index]);
}

function isValidInput(input: unknown): input is ChangeOrderItemExtraWorkInput {
  return hasExactKeys(input)
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
  if (!ORDER_STATION_FORWARD_ROLES.includes(
    authorization.data.role as (typeof ORDER_STATION_FORWARD_ROLES)[number],
  )) {
    return { code: "FORBIDDEN", message: "Mehrarbeit darf mit dieser Rolle nicht geändert werden." };
  }

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
        return receiptMatchesIntent(receipt, input)
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
      if (!receiptMatchesIntent(receipt, input)) throw new Error("ORDER_EXTRA_WORK_RECEIPT_MISMATCH");
      return { code: "OK", receipt, replayed: false };
    });
  } catch {
    return { code: "UNAVAILABLE", message: "Mehrarbeit konnte nicht sicher gespeichert werden." };
  }
}
