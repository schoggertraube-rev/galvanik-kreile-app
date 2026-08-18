import "server-only";

import { sql } from "drizzle-orm";
import { resolveAuthorization } from "@/lib/server/authorization";
import { withPrivilegedTenantTransaction } from "@/lib/server/privilegedDb";
import {
  ORDER_LIFECYCLE_STATUS,
  ORDER_STATION_FORWARD_ROLES,
} from "@/lib/orders/orderLifecycleContract";

const SOURCE_STATION = "wareneingang";
const TARGET_STATION = "galvanik";
const EVENT_TYPE = "ORDER_STATION_MOVED_V1";
const CORRECTION_EVENT_TYPE = "ORDER_STATION_CORRECTED_V1";
const EVENT_SCHEMA_VERSION = 1 as const;
const MAX_ORDER_ID_LENGTH = 128;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const REASON_MIN_LENGTH = 5;
const REASON_MAX_LENGTH = 500;

export type OrderStationCommandInput = {
  orderId: string;
  expectedVersion: number;
  clientEventId: string;
};

export type OrderStationCorrectionCommandInput = {
  orderId: string;
  expectedVersion: number;
  clientEventId: string;
  reason: string;
};

export type OrderStationTransitionReceipt = {
  eventId: string;
  clientEventId: string;
  correlationId: string;
  eventSchemaVersion: typeof EVENT_SCHEMA_VERSION;
  orderId: string;
  aggregateVersion: number;
  fromStation: typeof SOURCE_STATION;
  toStation: typeof TARGET_STATION;
  actorId: string;
  occurredAt: string;
};

export type OrderStationCommandResult =
  | { code: "OK"; receipt: OrderStationTransitionReceipt; replayed: boolean }
  | { code: "UNAUTHENTICATED"; message: string }
  | { code: "FORBIDDEN"; message: string }
  | { code: "NOT_FOUND"; message: string }
  | { code: "CONFLICT"; message: string }
  | { code: "VALIDATION_ERROR"; message: string }
  | { code: "UNAVAILABLE"; message: string };

/** D-F12-004: the reversal receipt for galvanik -> wareneingang/angenommen. Never a delete. */
export type OrderStationCorrectionReceipt = {
  eventId: string;
  clientEventId: string;
  correlationId: string;
  eventSchemaVersion: typeof EVENT_SCHEMA_VERSION;
  orderId: string;
  aggregateVersion: number;
  fromStation: typeof TARGET_STATION;
  toStation: typeof SOURCE_STATION;
  actorId: string;
  occurredAt: string;
  reason: string;
};

export type OrderStationCorrectionCommandResult =
  | { code: "OK"; receipt: OrderStationCorrectionReceipt; replayed: boolean }
  | { code: "UNAUTHENTICATED"; message: string }
  | { code: "FORBIDDEN"; message: string }
  | { code: "NOT_FOUND"; message: string }
  | { code: "CONFLICT"; message: string }
  | { code: "VALIDATION_ERROR"; message: string }
  | { code: "UNAVAILABLE"; message: string };

type LockedOrder = {
  id: string;
  tenant_id: string | null;
  customer_id: string | null;
  station: string | null;
  current_station: string | null;
  current_station_id: string | null;
  status: string | null;
  version: number;
};

type LockedCustomer = {
  id: string;
  tenant_id: string | null;
};

type LockedItem = {
  id: string;
  tenant_id: string | null;
  customer_id: string | null;
  current_station_id: string | null;
};

type UpdatedOrder = { id: string; version: number };
type UpdatedItem = { id: string };

type EventReceiptRow = {
  event_id: string;
  tenant_id: string | null;
  order_id: string | null;
  client_event_id: string | null;
  correlation_id: string | null;
  event_schema_version: number | null;
  aggregate_version: number | null;
  from_station: string | null;
  to_station: string | null;
  actor_id: string | null;
  status: string | null;
  occurred_at: Date | string;
  event_type: string;
};

function invalidInput(input: unknown): boolean {
  if (input === null || typeof input !== "object") {
    return true;
  }

  const candidate = input as Partial<OrderStationCommandInput>;
  const keys = Object.keys(input).sort();
  return (
    keys.length !== 3 ||
    keys[0] !== "clientEventId" ||
    keys[1] !== "expectedVersion" ||
    keys[2] !== "orderId" ||
    typeof candidate.orderId !== "string" ||
    candidate.orderId.trim().length === 0 ||
    candidate.orderId.length > MAX_ORDER_ID_LENGTH ||
    typeof candidate.expectedVersion !== "number" ||
    !Number.isSafeInteger(candidate.expectedVersion) ||
    candidate.expectedVersion <= 0 ||
    typeof candidate.clientEventId !== "string" ||
    !UUID_PATTERN.test(candidate.clientEventId)
  );
}

function toIsoString(value: unknown): string | null {
  if (!(value instanceof Date) && typeof value !== "string") return null;
  if (typeof value === "string" && value.trim().length === 0) return null;
  const parsed = value instanceof Date ? value : new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

function receiptMatchesIntent(
  row: EventReceiptRow,
  input: OrderStationCommandInput,
  tenantId: string,
  actorId: string,
): boolean {
  return (
    row.event_type === EVENT_TYPE &&
    row.tenant_id === tenantId &&
    row.order_id === input.orderId &&
    row.client_event_id === input.clientEventId &&
    row.actor_id === actorId &&
    row.event_schema_version === EVENT_SCHEMA_VERSION &&
    row.aggregate_version === input.expectedVersion + 1 &&
    row.from_station === SOURCE_STATION &&
    row.to_station === TARGET_STATION &&
    row.status === "success" &&
    typeof row.event_id === "string" &&
    row.event_id.length > 0 &&
    typeof row.correlation_id === "string" &&
    UUID_PATTERN.test(row.correlation_id) &&
    toIsoString(row.occurred_at) !== null
  );
}

function toReceipt(row: EventReceiptRow): OrderStationTransitionReceipt {
  const occurredAt = toIsoString(row.occurred_at);
  if (
    !occurredAt ||
    !row.order_id ||
    !row.client_event_id ||
    !row.correlation_id ||
    !row.aggregate_version ||
    !row.actor_id
  ) {
    throw new Error("ORDER_STATION_RECEIPT_INVALID");
  }

  return {
    eventId: row.event_id,
    clientEventId: row.client_event_id,
    correlationId: row.correlation_id,
    eventSchemaVersion: EVENT_SCHEMA_VERSION,
    orderId: row.order_id,
    aggregateVersion: row.aggregate_version,
    fromStation: SOURCE_STATION,
    toStation: TARGET_STATION,
    actorId: row.actor_id,
    occurredAt,
  };
}

function hasExactStationValues(order: LockedOrder, station: string): boolean {
  return (
    order.station === station &&
    order.current_station === station &&
    order.current_station_id === station
  );
}

export async function transitionWareneingangToGalvanik(
  input: OrderStationCommandInput,
): Promise<OrderStationCommandResult> {
  if (invalidInput(input)) {
    return { code: "VALIDATION_ERROR", message: "Ungültige Auftragskennung oder Version." };
  }

  let authorization;
  try {
    authorization = await resolveAuthorization();
  } catch {
    return { code: "UNAVAILABLE", message: "Stationswechsel ist derzeit nicht verfügbar." };
  }

  if (!authorization.ok) {
    if (authorization.reason === "AUTHORIZATION_UNAVAILABLE") {
      return { code: "UNAVAILABLE", message: "Stationswechsel ist derzeit nicht verfügbar." };
    }
    return {
      code: "UNAUTHENTICATED",
      message: "Sitzung oder Berechtigung ist nicht verfügbar.",
    };
  }

  // D-F12-003: exactly buero, werkstatt, meister, admin — a narrow explicit role
  // gate, deliberately not the generic operational-status permission (which
  // developer holds and buero does not).
  if (!ORDER_STATION_FORWARD_ROLES.includes(authorization.data.role as (typeof ORDER_STATION_FORWARD_ROLES)[number])) {
    return { code: "FORBIDDEN", message: "Stationswechsel ist nicht erlaubt." };
  }

  try {
    return await withPrivilegedTenantTransaction(authorization.data, async (tx) => {
      // One namespaced transaction mutex serializes every use of this tenant-scoped
      // client event id, including adversarial reuse for a different order.
      await tx.execute(sql`
        SELECT pg_advisory_xact_lock(
          hashtextextended(
            'w4:order-station:client-event:' || ${authorization.data.tenantId} || ':' || ${input.clientEventId},
            0
          )
        )
      `);

      const existingReceipts = await tx.execute<EventReceiptRow>(sql`
        SELECT
          id AS event_id,
          tenant_id,
          order_id,
          client_event_id,
          correlation_id,
          event_schema_version,
          aggregate_version,
          from_station,
          station AS to_station,
          user_id AS actor_id,
          status,
          created_at AS occurred_at,
          event_type
        FROM public.events
        WHERE tenant_id = ${authorization.data.tenantId}
          AND client_event_id = ${input.clientEventId}
        LIMIT 2
      `);

      if (existingReceipts.length > 0) {
        const existingReceipt = existingReceipts[0];
        if (
          existingReceipts.length !== 1 ||
          !existingReceipt ||
          !receiptMatchesIntent(
            existingReceipt,
            input,
            authorization.data.tenantId,
            authorization.data.userId,
          )
        ) {
          return { code: "CONFLICT", message: "Anfragekennung wurde bereits anders verwendet." };
        }

        return { code: "OK", receipt: toReceipt(existingReceipt), replayed: true };
      }

      const lockedOrders = await tx.execute<LockedOrder>(sql`
        SELECT id, tenant_id, customer_id, station, current_station, current_station_id, status, version
        FROM public.orders
        WHERE id = ${input.orderId} AND tenant_id = ${authorization.data.tenantId}
        FOR UPDATE
      `);
      const order = lockedOrders[0];

      // Missing and foreign orders deliberately share one externally visible outcome.
      if (!order) {
        return { code: "NOT_FOUND", message: "Auftrag nicht verfügbar." };
      }

      if (order.version !== input.expectedVersion) {
        return { code: "CONFLICT", message: "Auftrag wurde bereits geändert." };
      }

      if (!hasExactStationValues(order, SOURCE_STATION) || order.status !== ORDER_LIFECYCLE_STATUS.ANGENOMMEN) {
        return { code: "VALIDATION_ERROR", message: "Auftrag kann nicht aus dem Wareneingang übergeben werden." };
      }

      if (!order.customer_id) {
        return { code: "VALIDATION_ERROR", message: "Auftragszuordnung ist ungültig." };
      }

      const lockedCustomers = await tx.execute<LockedCustomer>(sql`
        SELECT id, tenant_id
        FROM public.customers
        WHERE id = ${order.customer_id}
          AND tenant_id = ${authorization.data.tenantId}
        FOR SHARE
      `);
      const customer = lockedCustomers[0];

      if (
        lockedCustomers.length !== 1 ||
        !customer ||
        customer.id !== order.customer_id ||
        customer.tenant_id !== authorization.data.tenantId
      ) {
        return { code: "VALIDATION_ERROR", message: "Auftragszuordnung ist ungültig." };
      }

      const lockedItems = await tx.execute<LockedItem>(sql`
        SELECT id, tenant_id, customer_id, current_station_id
        FROM public.items
        WHERE order_id = ${order.id}
        FOR UPDATE
      `);

      if (
        lockedItems.some(
          (item) =>
            item.tenant_id !== authorization.data.tenantId ||
            item.customer_id !== order.customer_id ||
            item.current_station_id !== SOURCE_STATION,
        )
      ) {
        return { code: "VALIDATION_ERROR", message: "Auftragsteile sind nicht übergabefähig." };
      }

      const updatedOrders = await tx.execute<UpdatedOrder>(sql`
        UPDATE public.orders
        SET station = ${TARGET_STATION},
            current_station = ${TARGET_STATION},
            current_station_id = ${TARGET_STATION},
            status = ${ORDER_LIFECYCLE_STATUS.GALVANIK},
            version = version + 1
        WHERE id = ${order.id}
          AND tenant_id = ${authorization.data.tenantId}
          AND version = ${input.expectedVersion}
        RETURNING id, version
      `);

      const updatedOrder = updatedOrders[0];
      if (!updatedOrder || updatedOrders.length !== 1) {
        return { code: "CONFLICT", message: "Auftrag wurde bereits geändert." };
      }

      if (lockedItems.length > 0) {
        const updatedItems = await tx.execute<UpdatedItem>(sql`
          UPDATE public.items
          SET current_station_id = ${TARGET_STATION}
          WHERE order_id = ${order.id}
            AND tenant_id = ${authorization.data.tenantId}
            AND current_station_id = ${SOURCE_STATION}
          RETURNING id
        `);

        if (updatedItems.length !== lockedItems.length) {
          throw new Error("ORDER_ITEM_UPDATE_MISMATCH");
        }
      }

      const insertedReceipts = await tx.execute<EventReceiptRow>(sql`
        INSERT INTO public.events (
          id,
          tenant_id,
          order_id,
          item_id,
          event_type,
          description,
          status,
          user_id,
          station,
          created_at,
          client_event_id,
          event_schema_version,
          correlation_id,
          aggregate_version,
          from_station
        ) VALUES (
          gen_random_uuid()::text,
          ${authorization.data.tenantId},
          ${updatedOrder.id},
          NULL,
          ${EVENT_TYPE},
          'Order handed from wareneingang to galvanik',
          'success',
          ${authorization.data.userId},
          ${TARGET_STATION},
          clock_timestamp() AT TIME ZONE 'UTC',
          ${input.clientEventId},
          ${EVENT_SCHEMA_VERSION},
          gen_random_uuid(),
          ${updatedOrder.version},
          ${SOURCE_STATION}
        )
        RETURNING
          id AS event_id,
          tenant_id,
          order_id,
          client_event_id,
          correlation_id,
          event_schema_version,
          aggregate_version,
          from_station,
          station AS to_station,
          user_id AS actor_id,
          status,
          created_at AS occurred_at,
          event_type
      `);

      const insertedReceipt = insertedReceipts[0];
      if (
        insertedReceipts.length !== 1 ||
        !insertedReceipt ||
        !receiptMatchesIntent(
          insertedReceipt,
          input,
          authorization.data.tenantId,
          authorization.data.userId,
        )
      ) {
        throw new Error("ORDER_STATION_EVENT_INSERT_FAILED");
      }

      return { code: "OK", receipt: toReceipt(insertedReceipt), replayed: false };
    });
  } catch {
    return { code: "UNAVAILABLE", message: "Stationswechsel ist derzeit nicht verfügbar." };
  }
}

// ── D-F12-004: correction command (galvanik -> wareneingang/angenommen) ────────
//
// A reversal is never silent and never a delete: it requires a mandatory reason,
// produces its own immutable ORDER_STATION_CORRECTED_V1 event, and shares the
// exact same tenant, ownership, lock, version, and role contract as the forward
// transition. A stale version writes nothing; identical retries replay the same
// receipt; reusing the same clientEventId for a different intent is a CONFLICT.

type CorrectionEventReceiptRow = EventReceiptRow & { description: string | null };

/** Row shape of the post-insert readback from private.v_order_station_correction_receipts_v1. */
type CorrectionReceiptViewRow = {
  event_id: string;
  tenant_id: string | null;
  order_id: string | null;
  client_event_id: string | null;
  correlation_id: string | null;
  event_schema_version: number | null;
  aggregate_version: number | null;
  from_station: string | null;
  to_station: string | null;
  actor_id: string | null;
  occurred_at: Date | string;
  reason: string | null;
};

function normalizedReason(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length >= REASON_MIN_LENGTH && trimmed.length <= REASON_MAX_LENGTH ? trimmed : null;
}

function invalidCorrectionInput(input: unknown): boolean {
  if (input === null || typeof input !== "object") {
    return true;
  }

  const candidate = input as Partial<OrderStationCorrectionCommandInput>;
  const keys = Object.keys(input).sort();
  return (
    keys.length !== 4 ||
    keys[0] !== "clientEventId" ||
    keys[1] !== "expectedVersion" ||
    keys[2] !== "orderId" ||
    keys[3] !== "reason" ||
    typeof candidate.orderId !== "string" ||
    candidate.orderId.trim().length === 0 ||
    candidate.orderId.length > MAX_ORDER_ID_LENGTH ||
    typeof candidate.expectedVersion !== "number" ||
    !Number.isSafeInteger(candidate.expectedVersion) ||
    candidate.expectedVersion <= 0 ||
    typeof candidate.clientEventId !== "string" ||
    !UUID_PATTERN.test(candidate.clientEventId) ||
    normalizedReason(candidate.reason) === null
  );
}

function receiptMatchesCorrectionIntent(
  row: CorrectionEventReceiptRow,
  input: OrderStationCorrectionCommandInput,
  reason: string,
  tenantId: string,
  actorId: string,
): boolean {
  return (
    row.event_type === CORRECTION_EVENT_TYPE &&
    row.tenant_id === tenantId &&
    row.order_id === input.orderId &&
    row.client_event_id === input.clientEventId &&
    row.actor_id === actorId &&
    row.event_schema_version === EVENT_SCHEMA_VERSION &&
    row.aggregate_version === input.expectedVersion + 1 &&
    row.from_station === TARGET_STATION &&
    row.to_station === SOURCE_STATION &&
    row.status === "success" &&
    row.description === reason &&
    typeof row.event_id === "string" &&
    row.event_id.length > 0 &&
    typeof row.correlation_id === "string" &&
    UUID_PATTERN.test(row.correlation_id) &&
    toIsoString(row.occurred_at) !== null
  );
}

function toCorrectionReceipt(row: CorrectionEventReceiptRow): OrderStationCorrectionReceipt {
  const occurredAt = toIsoString(row.occurred_at);
  if (
    !occurredAt ||
    !row.order_id ||
    !row.client_event_id ||
    !row.correlation_id ||
    !row.aggregate_version ||
    !row.actor_id ||
    !row.description
  ) {
    throw new Error("ORDER_STATION_CORRECTION_RECEIPT_INVALID");
  }

  return {
    eventId: row.event_id,
    clientEventId: row.client_event_id,
    correlationId: row.correlation_id,
    eventSchemaVersion: EVENT_SCHEMA_VERSION,
    orderId: row.order_id,
    aggregateVersion: row.aggregate_version,
    fromStation: TARGET_STATION,
    toStation: SOURCE_STATION,
    actorId: row.actor_id,
    occurredAt,
    reason: row.description,
  };
}

/**
 * The mandatory post-insert readback (never the bare INSERT ... RETURNING row)
 * for the correction receipt: it must exactly match this command's intent
 * against the persisted, tenant-bound view projection.
 */
function readbackMatchesCorrectionIntent(
  row: CorrectionReceiptViewRow,
  input: OrderStationCorrectionCommandInput,
  reason: string,
  tenantId: string,
  actorId: string,
): boolean {
  return (
    row.tenant_id === tenantId &&
    row.order_id === input.orderId &&
    row.client_event_id === input.clientEventId &&
    row.actor_id === actorId &&
    row.event_schema_version === EVENT_SCHEMA_VERSION &&
    row.aggregate_version === input.expectedVersion + 1 &&
    row.from_station === TARGET_STATION &&
    row.to_station === SOURCE_STATION &&
    row.reason === reason &&
    typeof row.event_id === "string" &&
    row.event_id.length > 0 &&
    typeof row.correlation_id === "string" &&
    UUID_PATTERN.test(row.correlation_id) &&
    toIsoString(row.occurred_at) !== null
  );
}

function toReadbackCorrectionReceipt(row: CorrectionReceiptViewRow): OrderStationCorrectionReceipt {
  const occurredAt = toIsoString(row.occurred_at);
  if (
    !occurredAt ||
    !row.order_id ||
    !row.client_event_id ||
    !row.correlation_id ||
    !row.aggregate_version ||
    !row.actor_id ||
    !row.reason
  ) {
    throw new Error("ORDER_STATION_CORRECTION_RECEIPT_READBACK_INVALID");
  }

  return {
    eventId: row.event_id,
    clientEventId: row.client_event_id,
    correlationId: row.correlation_id,
    eventSchemaVersion: EVENT_SCHEMA_VERSION,
    orderId: row.order_id,
    aggregateVersion: row.aggregate_version,
    fromStation: TARGET_STATION,
    toStation: SOURCE_STATION,
    actorId: row.actor_id,
    occurredAt,
    reason: row.reason,
  };
}

export async function correctGalvanikToWareneingang(
  input: OrderStationCorrectionCommandInput,
): Promise<OrderStationCorrectionCommandResult> {
  if (invalidCorrectionInput(input)) {
    return { code: "VALIDATION_ERROR", message: "Ungültige Auftragskennung, Version oder Begründung." };
  }

  const reason = normalizedReason(input.reason);
  if (reason === null) {
    return { code: "VALIDATION_ERROR", message: "Ungültige Auftragskennung, Version oder Begründung." };
  }

  let authorization;
  try {
    authorization = await resolveAuthorization();
  } catch {
    return { code: "UNAVAILABLE", message: "Rücknahme ist derzeit nicht verfügbar." };
  }

  if (!authorization.ok) {
    if (authorization.reason === "AUTHORIZATION_UNAVAILABLE") {
      return { code: "UNAVAILABLE", message: "Rücknahme ist derzeit nicht verfügbar." };
    }
    return {
      code: "UNAUTHENTICATED",
      message: "Sitzung oder Berechtigung ist nicht verfügbar.",
    };
  }

  // D-F12-003/004: identical explicit role gate as the forward transition.
  if (!ORDER_STATION_FORWARD_ROLES.includes(authorization.data.role as (typeof ORDER_STATION_FORWARD_ROLES)[number])) {
    return { code: "FORBIDDEN", message: "Rücknahme ist nicht erlaubt." };
  }

  try {
    return await withPrivilegedTenantTransaction(authorization.data, async (tx) => {
      // Exactly the same namespaced transaction mutex as the forward command:
      // both commands share one tenant-scoped client-event-id serialization
      // point, so cross-command reuse of the same clientEventId is always
      // serialized into a clean CONFLICT instead of racing into a unique-index
      // failure on public.events (UNAVAILABLE).
      await tx.execute(sql`
        SELECT pg_advisory_xact_lock(
          hashtextextended(
            'w4:order-station:client-event:' || ${authorization.data.tenantId} || ':' || ${input.clientEventId},
            0
          )
        )
      `);

      const existingReceipts = await tx.execute<CorrectionEventReceiptRow>(sql`
        SELECT
          id AS event_id,
          tenant_id,
          order_id,
          client_event_id,
          correlation_id,
          event_schema_version,
          aggregate_version,
          from_station,
          station AS to_station,
          user_id AS actor_id,
          status,
          description,
          created_at AS occurred_at,
          event_type
        FROM public.events
        WHERE tenant_id = ${authorization.data.tenantId}
          AND client_event_id = ${input.clientEventId}
        LIMIT 2
      `);

      if (existingReceipts.length > 0) {
        const existingReceipt = existingReceipts[0];
        if (
          existingReceipts.length !== 1 ||
          !existingReceipt ||
          !receiptMatchesCorrectionIntent(
            existingReceipt,
            input,
            reason,
            authorization.data.tenantId,
            authorization.data.userId,
          )
        ) {
          return { code: "CONFLICT", message: "Anfragekennung wurde bereits anders verwendet." };
        }

        return { code: "OK", receipt: toCorrectionReceipt(existingReceipt), replayed: true };
      }

      const lockedOrders = await tx.execute<LockedOrder>(sql`
        SELECT id, tenant_id, customer_id, station, current_station, current_station_id, status, version
        FROM public.orders
        WHERE id = ${input.orderId} AND tenant_id = ${authorization.data.tenantId}
        FOR UPDATE
      `);
      const order = lockedOrders[0];

      // Missing and foreign orders deliberately share one externally visible outcome.
      if (!order) {
        return { code: "NOT_FOUND", message: "Auftrag nicht verfügbar." };
      }

      if (order.version !== input.expectedVersion) {
        return { code: "CONFLICT", message: "Auftrag wurde bereits geändert." };
      }

      if (!hasExactStationValues(order, TARGET_STATION) || order.status !== ORDER_LIFECYCLE_STATUS.GALVANIK) {
        return { code: "VALIDATION_ERROR", message: "Auftrag kann nicht aus der Galvanik zurückgenommen werden." };
      }

      if (!order.customer_id) {
        return { code: "VALIDATION_ERROR", message: "Auftragszuordnung ist ungültig." };
      }

      const lockedCustomers = await tx.execute<LockedCustomer>(sql`
        SELECT id, tenant_id
        FROM public.customers
        WHERE id = ${order.customer_id}
          AND tenant_id = ${authorization.data.tenantId}
        FOR SHARE
      `);
      const customer = lockedCustomers[0];

      if (
        lockedCustomers.length !== 1 ||
        !customer ||
        customer.id !== order.customer_id ||
        customer.tenant_id !== authorization.data.tenantId
      ) {
        return { code: "VALIDATION_ERROR", message: "Auftragszuordnung ist ungültig." };
      }

      const lockedItems = await tx.execute<LockedItem>(sql`
        SELECT id, tenant_id, customer_id, current_station_id
        FROM public.items
        WHERE order_id = ${order.id}
        FOR UPDATE
      `);

      if (
        lockedItems.some(
          (item) =>
            item.tenant_id !== authorization.data.tenantId ||
            item.customer_id !== order.customer_id ||
            item.current_station_id !== TARGET_STATION,
        )
      ) {
        return { code: "VALIDATION_ERROR", message: "Auftragsteile sind nicht rücknahmefähig." };
      }

      const updatedOrders = await tx.execute<UpdatedOrder>(sql`
        UPDATE public.orders
        SET station = ${SOURCE_STATION},
            current_station = ${SOURCE_STATION},
            current_station_id = ${SOURCE_STATION},
            status = ${ORDER_LIFECYCLE_STATUS.ANGENOMMEN},
            version = version + 1
        WHERE id = ${order.id}
          AND tenant_id = ${authorization.data.tenantId}
          AND version = ${input.expectedVersion}
        RETURNING id, version
      `);

      const updatedOrder = updatedOrders[0];
      if (!updatedOrder || updatedOrders.length !== 1) {
        return { code: "CONFLICT", message: "Auftrag wurde bereits geändert." };
      }

      if (lockedItems.length > 0) {
        const updatedItems = await tx.execute<UpdatedItem>(sql`
          UPDATE public.items
          SET current_station_id = ${SOURCE_STATION}
          WHERE order_id = ${order.id}
            AND tenant_id = ${authorization.data.tenantId}
            AND current_station_id = ${TARGET_STATION}
          RETURNING id
        `);

        if (updatedItems.length !== lockedItems.length) {
          throw new Error("ORDER_ITEM_UPDATE_MISMATCH");
        }
      }

      const insertedReceipts = await tx.execute<CorrectionEventReceiptRow>(sql`
        INSERT INTO public.events (
          id,
          tenant_id,
          order_id,
          item_id,
          event_type,
          description,
          status,
          user_id,
          station,
          created_at,
          client_event_id,
          event_schema_version,
          correlation_id,
          aggregate_version,
          from_station
        ) VALUES (
          gen_random_uuid()::text,
          ${authorization.data.tenantId},
          ${updatedOrder.id},
          NULL,
          ${CORRECTION_EVENT_TYPE},
          ${reason},
          'success',
          ${authorization.data.userId},
          ${SOURCE_STATION},
          clock_timestamp() AT TIME ZONE 'UTC',
          ${input.clientEventId},
          ${EVENT_SCHEMA_VERSION},
          gen_random_uuid(),
          ${updatedOrder.version},
          ${TARGET_STATION}
        )
        RETURNING
          id AS event_id,
          tenant_id,
          order_id,
          client_event_id,
          correlation_id,
          event_schema_version,
          aggregate_version,
          from_station,
          station AS to_station,
          user_id AS actor_id,
          status,
          description,
          created_at AS occurred_at,
          event_type
      `);

      const insertedReceipt = insertedReceipts[0];
      if (
        insertedReceipts.length !== 1 ||
        !insertedReceipt ||
        !receiptMatchesCorrectionIntent(
          insertedReceipt,
          input,
          reason,
          authorization.data.tenantId,
          authorization.data.userId,
        )
      ) {
        throw new Error("ORDER_STATION_CORRECTION_EVENT_INSERT_FAILED");
      }

      // The bare INSERT ... RETURNING row is never the returned truth: within
      // this same tenant-bound transaction, read the freshly persisted receipt
      // back from private.v_order_station_correction_receipts_v1, exactly by
      // tenant/order/clientEvent, and require it to match this command's exact
      // intent before returning only that readback.
      const readbackReceipts = await tx.execute<CorrectionReceiptViewRow>(sql`
        SELECT
          event_id,
          tenant_id,
          order_id,
          client_event_id,
          correlation_id,
          event_schema_version,
          aggregate_version,
          from_station,
          to_station,
          actor_id,
          occurred_at,
          reason
        FROM private.v_order_station_correction_receipts_v1
        WHERE order_id = ${updatedOrder.id}
          AND client_event_id = ${input.clientEventId}
        LIMIT 2
      `);

      const readbackReceipt = readbackReceipts[0];
      if (
        readbackReceipts.length !== 1 ||
        !readbackReceipt ||
        !readbackMatchesCorrectionIntent(
          readbackReceipt,
          input,
          reason,
          authorization.data.tenantId,
          authorization.data.userId,
        )
      ) {
        throw new Error("ORDER_STATION_CORRECTION_RECEIPT_READBACK_INVALID");
      }

      return { code: "OK", receipt: toReadbackCorrectionReceipt(readbackReceipt), replayed: false };
    });
  } catch {
    return { code: "UNAVAILABLE", message: "Rücknahme ist derzeit nicht verfügbar." };
  }
}
