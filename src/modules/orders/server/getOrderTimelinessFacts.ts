import "server-only";

import { and, eq, gte, inArray, lt } from "drizzle-orm";
import { events, orders } from "@/db/schema";
import { resolveAuthorization } from "@/lib/server/authorization";
import {
  withPrivilegedTenantTransaction,
  type PrivilegedTenantTransaction,
} from "@/lib/server/privilegedDb";
import {
  ORDER_PICKUP_EVENT_TYPES,
  buildOrderTimelinessFacts,
  isOrderTimelinessRange,
  type OrderTimelinessFacts,
  type OrderTimelinessOrderRow,
  type OrderTimelinessPickupEventRow,
  type OrderTimelinessRange,
} from "../domain/orderTimelinessFacts";

/**
 * G04-Read-Port `getOrderTimelinessFacts(range)` fuer M02
 * (_MODULDOSSIERS/G04_AUFTRAEGE/04_SCHNITTSTELLEN_DATEN.md Z.14/Z.91/Z.98).
 *
 * Reiner Read: kein Command, kein Schreibweg, keine zweite Tabelle. Die
 * Ableitung samt Missing-Reason und Anomaliefall liegt in
 * ../domain/orderTimelinessFacts.ts; hier liegt nur Autorisierung, das
 * tenantgebundene Lesen und die Fehlerabbildung.
 *
 * Annahme zum `range`-Parameter (im Dossier nur als SPEZ markiert): `from` und
 * `to` sind Kalendertage `YYYY-MM-DD` in UTC, beide Grenzen inklusiv, und das
 * Fenster filtert `orders.due_date` — den bestaetigten Auftragstermin und damit
 * die Bezugsgroesse der Termintreue. Auftraege ohne bestaetigten Termin liegen
 * in keinem Fenster und erscheinen deshalb nicht in der Auswertung.
 *
 * Der Tenant kommt ausschliesslich aus der Session; es gibt keinen
 * tenantId-Parameter und damit keine Client-Autorisierung.
 */
export type OrderTimelinessFactsResult =
  | { code: "OK"; data: OrderTimelinessFacts }
  | { code: "UNAUTHENTICATED"; message: string }
  | { code: "FORBIDDEN"; message: string }
  | { code: "VALIDATION_ERROR"; message: string }
  | { code: "UNAVAILABLE"; message: string };

const READ_PERMISSION = "perm_view_leitstand";
const UNAVAILABLE_MESSAGE = "Termintreue-Fakten konnten nicht sicher geladen werden.";

function readDiagnostic(error: unknown, key: "message" | "details" | "hint"): string | null {
  if (!error || typeof error !== "object") {
    return key === "message" && error instanceof Error ? error.message : null;
  }
  const value = (error as Record<string, unknown>)[key];
  return typeof value === "string" && value.length > 0 ? value : null;
}

function logDatabaseFailure(error: unknown): void {
  console.error("getOrderTimelinessFacts database error", {
    message: readDiagnostic(error, "message"),
    details: readDiagnostic(error, "details"),
    hint: readDiagnostic(error, "hint"),
  });
}

/** Exklusive Obergrenze des Fensters: Kalendertag `to` zaehlt vollstaendig mit. */
function exclusiveUpperBound(to: string): Date {
  const bound = new Date(`${to}T00:00:00.000Z`);
  bound.setUTCDate(bound.getUTCDate() + 1);
  return bound;
}

async function readFacts(
  tx: PrivilegedTenantTransaction,
  tenantId: string,
  range: OrderTimelinessRange,
): Promise<OrderTimelinessFacts> {
  const orderRows: OrderTimelinessOrderRow[] = await tx
    .select({
      id: orders.id,
      tenantId: orders.tenantId,
      orderNumber: orders.orderNumber,
      status: orders.status,
      dueDate: orders.dueDate,
      completedDate: orders.completedDate,
    })
    .from(orders)
    .where(and(
      eq(orders.tenantId, tenantId),
      gte(orders.dueDate, new Date(`${range.from}T00:00:00.000Z`)),
      lt(orders.dueDate, exclusiveUpperBound(range.to)),
    ));

  const orderIds = orderRows.map((row) => row.id);
  const pickupEvents: OrderTimelinessPickupEventRow[] = orderIds.length === 0 ? [] : await tx
    .select({
      orderId: events.orderId,
      tenantId: events.tenantId,
      eventType: events.eventType,
      status: events.status,
      station: events.station,
      fromStation: events.fromStation,
      eventSchemaVersion: events.eventSchemaVersion,
      aggregateVersion: events.aggregateVersion,
      payload: events.payload,
      createdAt: events.createdAt,
    })
    .from(events)
    .where(and(
      eq(events.tenantId, tenantId),
      inArray(events.orderId, orderIds),
      inArray(events.eventType, [...ORDER_PICKUP_EVENT_TYPES]),
    ));

  return buildOrderTimelinessFacts({
    tenantId,
    range,
    generatedAt: new Date(),
    orders: orderRows,
    pickupEvents,
  });
}

export async function getOrderTimelinessFacts(range: unknown): Promise<OrderTimelinessFactsResult> {
  if (!isOrderTimelinessRange(range)) {
    return { code: "VALIDATION_ERROR", message: "Ungültiger Auswertungszeitraum." };
  }

  let authorization;
  try {
    authorization = await resolveAuthorization();
  } catch {
    return { code: "UNAVAILABLE", message: UNAVAILABLE_MESSAGE };
  }
  if (!authorization.ok) {
    return authorization.reason === "AUTHORIZATION_UNAVAILABLE"
      ? { code: "UNAVAILABLE", message: UNAVAILABLE_MESSAGE }
      : { code: "UNAUTHENTICATED", message: "Sitzung oder Berechtigung ist nicht verfügbar." };
  }
  const snapshot = authorization.data;
  if (!snapshot.permissions.includes(READ_PERMISSION)) {
    return { code: "FORBIDDEN", message: "Termintreue-Auswertung ist nicht erlaubt." };
  }

  try {
    const data = await withPrivilegedTenantTransaction(
      snapshot,
      async (tx) => readFacts(tx, snapshot.tenantId, range),
    );
    return { code: "OK", data };
  } catch (error: unknown) {
    logDatabaseFailure(error);
    return { code: "UNAVAILABLE", message: UNAVAILABLE_MESSAGE };
  }
}
