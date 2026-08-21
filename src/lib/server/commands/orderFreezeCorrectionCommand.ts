import "server-only";

import { sql } from "drizzle-orm";
import { resolveAuthorization } from "@/lib/server/authorization";
import { withPrivilegedTenantTransaction } from "@/lib/server/privilegedDb";

const EVENT_TYPE = "ORDER_FREEZE_CORRECTED_V1";
const EVENT_SCHEMA_VERSION = 1 as const;
const SOURCE_STATION = "fertig" as const;
const TARGET_STATION = "galvanik" as const;
const CORRECTION_ROLES = ["meister", "admin"] as const;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

export type ReopenFrozenOrderInput = {
  orderId: string;
  expectedVersion: number;
  reason: string;
  clientEventId: string;
};

export type OrderFreezeCorrectionReceipt = {
  eventId: string;
  clientEventId: string;
  correlationId: string;
  eventSchemaVersion: 1;
  orderId: string;
  aggregateVersion: number;
  fromStation: "fertig";
  toStation: "galvanik";
  actorId: string;
  occurredAt: string;
  correctionId: string;
  freezeId: string;
  correctedFreezeVersion: number;
  reason: string;
  correctedAt: string;
};

export type ReopenFrozenOrderResult =
  | { code: "OK"; receipt: OrderFreezeCorrectionReceipt; replayed: boolean }
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

type LockedFreeze = { id: string; order_version: number };

type ReceiptRow = {
  event_id: string;
  tenant_id: string;
  order_id: string;
  client_event_id: string;
  correlation_id: string;
  event_schema_version: number;
  aggregate_version: number;
  from_station: string;
  to_station: string;
  actor_id: string;
  occurred_at: Date | string;
  correction_id: string;
  freeze_id: string;
  corrected_freeze_version: number;
  reason: string;
  corrected_at: Date | string;
  integrity_ok: boolean;
};

function normalizedReason(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length >= 5 && trimmed.length <= 500 ? trimmed : null;
}

function exactInput(value: unknown): value is ReopenFrozenOrderInput {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const input = value as Record<string, unknown>;
  const keys = Object.keys(input).sort();
  return keys.length === 4
    && keys[0] === "clientEventId"
    && keys[1] === "expectedVersion"
    && keys[2] === "orderId"
    && keys[3] === "reason"
    && typeof input.orderId === "string"
    && input.orderId === input.orderId.trim()
    && input.orderId.length >= 1
    && input.orderId.length <= 128
    && typeof input.expectedVersion === "number"
    && Number.isSafeInteger(input.expectedVersion)
    && input.expectedVersion > 0
    && typeof input.clientEventId === "string"
    && UUID_PATTERN.test(input.clientEventId)
    && normalizedReason(input.reason) !== null;
}

function toIso(value: unknown): string {
  const date = value instanceof Date ? value : new Date(value as string);
  if (!Number.isFinite(date.getTime())) throw new Error("ORDER_FREEZE_CORRECTION_TIME_INVALID");
  return date.toISOString();
}

function mapReceipt(row: ReceiptRow, tenantId: string): OrderFreezeCorrectionReceipt {
  if (
    row.integrity_ok !== true
    || row.tenant_id !== tenantId
    || row.event_schema_version !== EVENT_SCHEMA_VERSION
    || row.from_station !== SOURCE_STATION
    || row.to_station !== TARGET_STATION
    || !UUID_PATTERN.test(row.event_id)
    || !UUID_PATTERN.test(row.client_event_id)
    || !UUID_PATTERN.test(row.correlation_id)
    || !UUID_PATTERN.test(row.actor_id)
    || !UUID_PATTERN.test(row.correction_id)
    || !UUID_PATTERN.test(row.freeze_id)
    || !Number.isSafeInteger(row.aggregate_version)
    || !Number.isSafeInteger(row.corrected_freeze_version)
    || row.aggregate_version < 1
    || row.corrected_freeze_version < 1
    || row.corrected_freeze_version >= row.aggregate_version
    || normalizedReason(row.reason) !== row.reason
  ) throw new Error("ORDER_FREEZE_CORRECTION_RECEIPT_INVALID");

  return {
    eventId: row.event_id,
    clientEventId: row.client_event_id,
    correlationId: row.correlation_id,
    eventSchemaVersion: 1,
    orderId: row.order_id,
    aggregateVersion: row.aggregate_version,
    fromStation: "fertig",
    toStation: "galvanik",
    actorId: row.actor_id,
    occurredAt: toIso(row.occurred_at),
    correctionId: row.correction_id,
    freezeId: row.freeze_id,
    correctedFreezeVersion: row.corrected_freeze_version,
    reason: row.reason,
    correctedAt: toIso(row.corrected_at),
  };
}

function receiptMatchesIntent(
  receipt: OrderFreezeCorrectionReceipt,
  input: ReopenFrozenOrderInput,
  actorId: string,
  reason: string,
): boolean {
  return receipt.orderId === input.orderId
    && receipt.actorId === actorId
    && receipt.reason === reason
    && receipt.aggregateVersion === input.expectedVersion + 1;
}

export async function reopenFrozenOrder(
  input: ReopenFrozenOrderInput,
): Promise<ReopenFrozenOrderResult> {
  if (!exactInput(input)) {
    return { code: "VALIDATION_ERROR", message: "Ungültige Freeze-Korrektur." };
  }
  const reason = normalizedReason(input.reason);
  if (reason === null) {
    return { code: "VALIDATION_ERROR", message: "Begründung muss 5 bis 500 Zeichen enthalten." };
  }

  let authorization;
  try {
    authorization = await resolveAuthorization();
  } catch {
    return { code: "UNAVAILABLE", message: "Freeze-Korrektur ist derzeit nicht verfügbar." };
  }
  if (!authorization.ok) {
    return authorization.reason === "AUTHORIZATION_UNAVAILABLE"
      ? { code: "UNAVAILABLE", message: "Freeze-Korrektur ist derzeit nicht verfügbar." }
      : { code: "UNAUTHENTICATED", message: "Sitzung oder Berechtigung ist nicht verfügbar." };
  }
  if (!CORRECTION_ROLES.includes(authorization.data.role as (typeof CORRECTION_ROLES)[number])) {
    return { code: "FORBIDDEN", message: "Freeze-Korrektur ist mit dieser Rolle nicht erlaubt." };
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
        SELECT *
        FROM private.v_order_freeze_correction_receipts_v1
        WHERE client_event_id = ${input.clientEventId}
        LIMIT 2
      `);
      if (replayRows.length > 0) {
        if (replayRows.length !== 1 || !replayRows[0]) {
          return { code: "CONFLICT", message: "Anfragekennung wurde bereits anders verwendet." };
        }
        const receipt = mapReceipt(replayRows[0], authorization.data.tenantId);
        return receiptMatchesIntent(receipt, input, authorization.data.userId, reason)
          ? { code: "OK", receipt, replayed: true }
          : { code: "CONFLICT", message: "Anfragekennung wurde bereits anders verwendet." };
      }

      const reusedEvents = await tx.execute<{ id: string }>(sql`
        SELECT id
        FROM public.events
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
        WHERE tenant_id = ${authorization.data.tenantId}
          AND id = ${input.orderId}
        FOR UPDATE
      `);
      const order = orderRows[0];
      if (orderRows.length !== 1 || !order) {
        return { code: "NOT_FOUND", message: "Auftrag nicht verfügbar." };
      }
      if (order.version !== input.expectedVersion) {
        return { code: "CONFLICT", message: "Auftrag wurde bereits geändert." };
      }
      if (
        order.station !== SOURCE_STATION
        || order.current_station !== SOURCE_STATION
        || order.current_station_id !== SOURCE_STATION
        || order.status !== SOURCE_STATION
      ) {
        return { code: "VALIDATION_ERROR", message: "Nur ein fertig eingefrorener Auftrag kann korrigiert werden." };
      }

      const customerRows = await tx.execute<{ id: string; tenant_id: string }>(sql`
        SELECT id, tenant_id
        FROM public.customers
        WHERE tenant_id = ${authorization.data.tenantId}
          AND id = ${order.customer_id}
        FOR SHARE
      `);
      if (customerRows.length !== 1 || customerRows[0]?.tenant_id !== authorization.data.tenantId) {
        return { code: "VALIDATION_ERROR", message: "Auftragszuordnung ist ungültig." };
      }

      const freezeRows = await tx.execute<LockedFreeze>(sql`
        SELECT frozen_order.id::text AS id, frozen_order.order_version
        FROM private.order_freezes frozen_order
        WHERE frozen_order.tenant_id = ${authorization.data.tenantId}
          AND frozen_order.order_id = ${order.id}
          AND NOT EXISTS (
            SELECT 1
            FROM private.order_freeze_corrections correction
            WHERE correction.tenant_id = frozen_order.tenant_id
              AND correction.freeze_id = frozen_order.id
          )
        FOR UPDATE OF frozen_order
      `);
      const activeFreeze = freezeRows[0];
      if (freezeRows.length !== 1 || !activeFreeze || !UUID_PATTERN.test(activeFreeze.id)) {
        return { code: "VALIDATION_ERROR", message: "Aktiver Freeze ist nicht eindeutig verfügbar." };
      }

      const freezeStateRows = await tx.execute<{ active: boolean; integrity_ok: boolean }>(sql`
        SELECT active, integrity_ok
        FROM private.v_order_freeze_state_v1
        WHERE order_id = ${order.id}
          AND freeze_id = ${activeFreeze.id}::uuid
        LIMIT 2
      `);
      if (
        freezeStateRows.length !== 1
        || freezeStateRows[0]?.active !== true
        || freezeStateRows[0]?.integrity_ok !== true
      ) throw new Error("ORDER_FREEZE_ACTIVE_STATE_INVALID");

      const invoiceRows = await tx.execute<{
        invoice_exists: boolean;
        invoice_count: number;
        integrity_ok: boolean;
      }>(sql`
        SELECT invoice_exists, invoice_count, integrity_ok
        FROM private.v_order_invoice_presence_v1
        WHERE order_id = ${order.id}
        LIMIT 2
      `);
      const invoice = invoiceRows[0];
      if (invoiceRows.length !== 1 || !invoice || invoice.integrity_ok !== true) {
        throw new Error("ORDER_INVOICE_PRESENCE_INVALID");
      }
      if (invoice.invoice_exists || invoice.invoice_count > 0) {
        return { code: "CONFLICT", message: "Freeze kann nach Rechnungserstellung nicht korrigiert werden." };
      }

      const itemRows = await tx.execute<{
        id: string;
        tenant_id: string;
        customer_id: string;
        current_station_id: string | null;
      }>(sql`
        SELECT id, tenant_id, customer_id, current_station_id
        FROM public.items
        WHERE order_id = ${order.id}
        FOR UPDATE
      `);
      if (itemRows.some((item) =>
        item.tenant_id !== authorization.data.tenantId
        || item.customer_id !== order.customer_id
        || item.current_station_id !== SOURCE_STATION
      )) {
        return { code: "VALIDATION_ERROR", message: "Auftragsteile sind nicht korrekturfähig." };
      }

      const nextVersion = input.expectedVersion + 1;
      const updatedOrders = await tx.execute<{ id: string; version: number }>(sql`
        UPDATE public.orders
        SET station = ${TARGET_STATION},
            current_station = ${TARGET_STATION},
            current_station_id = ${TARGET_STATION},
            status = ${TARGET_STATION},
            completed_date = NULL,
            version = version + 1
        WHERE tenant_id = ${authorization.data.tenantId}
          AND id = ${order.id}
          AND version = ${input.expectedVersion}
          AND station = ${SOURCE_STATION}
          AND current_station = ${SOURCE_STATION}
          AND current_station_id = ${SOURCE_STATION}
          AND status = ${SOURCE_STATION}
        RETURNING id, version
      `);
      if (updatedOrders.length !== 1 || updatedOrders[0]?.version !== nextVersion) {
        return { code: "CONFLICT", message: "Auftrag wurde bereits geändert." };
      }

      if (itemRows.length > 0) {
        const updatedItems = await tx.execute<{ id: string }>(sql`
          UPDATE public.items
          SET current_station_id = ${TARGET_STATION}
          WHERE tenant_id = ${authorization.data.tenantId}
            AND order_id = ${order.id}
            AND current_station_id = ${SOURCE_STATION}
          RETURNING id
        `);
        if (updatedItems.length !== itemRows.length) throw new Error("ORDER_FREEZE_CORRECTION_ITEM_MISMATCH");
      }

      const eventRows = await tx.execute<{ event_id: string }>(sql`
        INSERT INTO public.events (
          id, tenant_id, order_id, item_id, event_type, description, payload,
          status, user_id, station, created_at, client_event_id,
          event_schema_version, correlation_id, aggregate_version, from_station
        ) VALUES (
          gen_random_uuid()::text, ${authorization.data.tenantId}, ${order.id}, NULL,
          ${EVENT_TYPE}, ${reason},
          ${JSON.stringify({
            freezeId: activeFreeze.id,
            correctedFreezeVersion: activeFreeze.order_version,
          })}::jsonb,
          'success', ${authorization.data.userId}::uuid, ${TARGET_STATION},
          clock_timestamp() AT TIME ZONE 'UTC', ${input.clientEventId}::uuid,
          ${EVENT_SCHEMA_VERSION}, gen_random_uuid(), ${nextVersion}, ${SOURCE_STATION}
        )
        RETURNING id AS event_id
      `);
      const eventId = eventRows[0]?.event_id;
      if (eventRows.length !== 1 || !eventId || !UUID_PATTERN.test(eventId)) {
        throw new Error("ORDER_FREEZE_CORRECTION_EVENT_INVALID");
      }

      const correctionRows = await tx.execute<{ id: string }>(sql`
        INSERT INTO private.order_freeze_corrections (
          id, tenant_id, order_id, freeze_id, event_id, reason,
          order_version, corrected_by, corrected_at
        ) VALUES (
          gen_random_uuid(), ${authorization.data.tenantId}, ${order.id},
          ${activeFreeze.id}::uuid, ${eventId}, ${reason}, ${nextVersion},
          ${authorization.data.userId}::uuid, clock_timestamp()
        )
        RETURNING id::text AS id
      `);
      if (correctionRows.length !== 1 || !UUID_PATTERN.test(correctionRows[0]?.id ?? "")) {
        throw new Error("ORDER_FREEZE_CORRECTION_ROW_INVALID");
      }

      const receiptRows = await tx.execute<ReceiptRow>(sql`
        SELECT *
        FROM private.v_order_freeze_correction_receipts_v1
        WHERE order_id = ${order.id}
          AND client_event_id = ${input.clientEventId}
        LIMIT 2
      `);
      if (receiptRows.length !== 1 || !receiptRows[0]) {
        throw new Error("ORDER_FREEZE_CORRECTION_RECEIPT_MISSING");
      }
      const receipt = mapReceipt(receiptRows[0], authorization.data.tenantId);
      if (
        !receiptMatchesIntent(receipt, input, authorization.data.userId, reason)
        || receipt.freezeId !== activeFreeze.id
        || receipt.correctedFreezeVersion !== activeFreeze.order_version
      ) throw new Error("ORDER_FREEZE_CORRECTION_RECEIPT_MISMATCH");
      return { code: "OK", receipt, replayed: false };
    });
  } catch {
    return { code: "UNAVAILABLE", message: "Freeze-Korrektur ist derzeit nicht verfügbar." };
  }
}
