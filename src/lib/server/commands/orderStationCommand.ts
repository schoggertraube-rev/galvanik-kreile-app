import "server-only";

import { sql } from "drizzle-orm";
import { resolveAuthorization } from "@/lib/server/authorization";
import { withPrivilegedTenantTransaction } from "@/lib/server/privilegedDb";

const SOURCE_STATION = "wareneingang";
const TARGET_STATION = "galvanik";
const MAX_ORDER_ID_LENGTH = 128;
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
};

export type OrderStationCommandResult =
  | { code: "OK"; orderId: string; version: number }
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

function invalidInput(input: unknown): boolean {
  if (input === null || typeof input !== "object") {
    return true;
  }

  const candidate = input as Partial<OrderStationCommandInput>;
  return (
    typeof candidate.orderId !== "string" ||
    candidate.orderId.trim().length === 0 ||
    candidate.orderId.length > MAX_ORDER_ID_LENGTH ||
    typeof candidate.expectedVersion !== "number" ||
    !Number.isSafeInteger(candidate.expectedVersion) ||
    candidate.expectedVersion <= 0
  );
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

      return { code: "OK", orderId: updatedOrder.id, version: updatedOrder.version };
    });
  } catch {
    return { code: "UNAVAILABLE", message: "Stationswechsel ist derzeit nicht verfügbar." };
  }
}
