import "server-only";

import { sql } from "drizzle-orm";
import { resolveAuthorization } from "@/lib/server/authorization";
import { withPrivilegedTenantTransaction } from "@/lib/server/privilegedDb";

const SOURCE_STATION = "wareneingang";
const TARGET_STATION = "galvanik";
const EVENT_TYPE = "ORDER_STATION_MOVED_V1";
const EVENT_SCHEMA_VERSION = 1 as const;
const MAX_ORDER_ID_LENGTH = 128;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const TERMINAL_OR_BLOCKED_STATUSES = new Set([
  "blocked",
  "quality_check",
  "completed",
  "abgeschlossen",
  "fertig",
  "done",
  "storniert",
  "cancelled",
  "canceled",
  "shipped",
  "dispatched",
  "delivered",
  "warenausgang",
]);

export type OrderStationCommandInput = {
  orderId: string;
  expectedVersion: number;
  clientEventId: string;
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

function hasOnlySourceStationValues(order: LockedOrder): boolean {
  return order.station === SOURCE_STATION && [order.current_station, order.current_station_id].every(
    (value) => value === null || value === SOURCE_STATION,
  );
}

function hasBlockedOrTerminalStatus(status: string | null): boolean {
  return status === null || TERMINAL_OR_BLOCKED_STATUSES.has(status.trim().toLowerCase());
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

  if (!authorization.data.permissions.includes("perm_op_status")) {
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

      if (!hasOnlySourceStationValues(order) || hasBlockedOrTerminalStatus(order.status)) {
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
            status = 'ready',
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
