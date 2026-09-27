import "server-only";

import { sql } from "drizzle-orm";
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
 * Fenster filtert den bestaetigten Auftragstermin und damit die Bezugsgroesse der
 * Termintreue. Auftraege ohne bestaetigten Termin liegen in keinem Fenster und
 * erscheinen deshalb nicht in der Auswertung.
 *
 * Der Tenant kommt ausschliesslich aus der Session; es gibt keinen
 * tenantId-Parameter und damit keine Client-Autorisierung.
 *
 * Readvertrag entschieden (Review PR #115 Runde 2/3): dieser Port liest
 * ausschliesslich ueber die im Modul-Manifest deklarierten `public.v_*`-Views
 * `public.v_order_timeliness_orders_v1` und
 * `public.v_order_timeliness_pickup_events_v1`
 * (supabase/migrations/20260927120000_b2_order_timeliness_read_contract.sql) statt
 * ueber Drizzle-Tabellenobjekte. Damit laeuft der Zugriff sichtbar durch Naht 4
 * (ARCHITEKTUR_MODULE_PATH1.md) und ist vom S1-Gate pruefbar. Das Schema ist
 * public, weil `ownsTables` leer ist: beide Views lesen Fremdfakten aus
 * public.orders/public.events, und Fremdfakten laufen nach Naht 4 ueber
 * public.v_*. Die Views bleiben trotzdem gehaertet (REVOKE ALL gegen PUBLIC,
 * anon, authenticated; SELECT nur fuer service_role; security_invoker = true).
 *
 * Die Eigentumsfrage an den beiden Basistabellen bleibt davon unberuehrt und
 * offen (Q-G04-008, _MODULDOSSIERS/G04_AUFTRAEGE/08_OFFENE_FRAGEN.md, Optionen
 * A/B/C; Owner PL/Architektur): die Ereignistabelle ist cross-modular und darf
 * niemandem exklusiv gehoeren, und die Auftragstabelle wird heute ausschliesslich
 * ausserhalb dieses Moduls geschrieben (`src/lib/server/commands/*` sowie
 * `src/lib/server/operationalOrders.ts`). `ownsTables` bleibt im Modul-Manifest
 * deshalb bewusst leer: das Feld wuerde Exklusivitaet behaupten, die es nicht gibt.
 * Entschieden ist nur der Readvertrag-Mechanismus, nicht das Eigentum.
 *
 * Defense in Depth: die Views filtern selbst fail-closed ueber die
 * Transaktions-GUC `app.tenant_id`, und dieser Port setzt seinen expliziten
 * Tenant-, Fenster- und Auftragsfilter zusaetzlich davor. Die Domaene prueft die
 * Tenantbindung jeder Zeile danach ein drittes Mal.
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

/** Vertragszeile der Auftrags-View, snake_case wie in SQL. */
type OrderContractRow = {
  id: string;
  tenant_id: string | null;
  order_number: string;
  status: string;
  version: number | null;
  due_date: string | null;
  completed_date: string | null;
};

/** Vertragszeile der Abholereignis-View, snake_case wie in SQL. */
type PickupEventContractRow = {
  event_id: string;
  order_id: string;
  tenant_id: string | null;
  event_type: string;
  status: string | null;
  station: string | null;
  from_station: string | null;
  event_schema_version: number | null;
  aggregate_version: number | null;
  payload_order_id: string | null;
  payload_mode: string | null;
  payload_payment_mode: string | null;
  payload_invoice_state: string | null;
  payload_gate_allowed: boolean | null;
  created_at: string | null;
};

function toOrderRow(row: OrderContractRow): OrderTimelinessOrderRow {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    orderNumber: row.order_number,
    status: row.status,
    version: row.version,
    dueDate: row.due_date,
    completedDate: row.completed_date,
  };
}

function toPickupEventRow(row: PickupEventContractRow): OrderTimelinessPickupEventRow {
  return {
    // Ereigniskennung ist Teil der Provenienz des Fakts
    // (OrderTimelinessEventProvenance.eventId, F-G04-007), nicht optional.
    eventId: row.event_id,
    orderId: row.order_id,
    tenantId: row.tenant_id,
    eventType: row.event_type,
    status: row.status,
    station: row.station,
    fromStation: row.from_station,
    eventSchemaVersion: row.event_schema_version,
    aggregateVersion: row.aggregate_version,
    payloadOrderId: row.payload_order_id,
    payloadMode: row.payload_mode,
    payloadPaymentMode: row.payload_payment_mode,
    payloadInvoiceState: row.payload_invoice_state,
    payloadGateAllowed: row.payload_gate_allowed,
    createdAt: row.created_at,
  };
}

async function readFacts(
  tx: PrivilegedTenantTransaction,
  tenantId: string,
  range: OrderTimelinessRange,
): Promise<OrderTimelinessFacts> {
  // Zeitstempel werden ausdruecklich als UTC-ISO-Text projiziert. Roh-SQL liefert
  // ueber den postgres-js-Treiber unkonvertierte Zeitstempeltexte; ein
  // `timestamp without time zone` wuerde sonst als Lokalzeit und ein
  // `timestamp with time zone` als Text mit zweistelligem Offset gelesen. Die
  // Projektion aendert keinen Wert, sie macht die Ablesung eindeutig.
  const orderRows = await tx.execute<OrderContractRow>(sql`
    SELECT
      contract.id,
      contract.tenant_id,
      contract.order_number,
      contract.status,
      contract.version,
      to_char(contract.due_date, 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"') AS due_date,
      to_char(contract.completed_date AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"')
        AS completed_date
    FROM public.v_order_timeliness_orders_v1 contract
    WHERE contract.tenant_id = ${tenantId}
      AND contract.due_date >= (${range.from})::date
      AND contract.due_date < ((${range.to})::date + 1)
  `);

  const orders = orderRows.map(toOrderRow);
  const orderIds = orders.map((row) => row.id);
  let pickupEvents: OrderTimelinessPickupEventRow[] = [];
  if (orderIds.length > 0) {
    const orderIdList = sql.join(orderIds.map((id) => sql`${id}`), sql`, `);
    const eventTypeList = sql.join(
      ORDER_PICKUP_EVENT_TYPES.map((eventType) => sql`${eventType}`),
      sql`, `,
    );
    const eventRows = await tx.execute<PickupEventContractRow>(sql`
      SELECT
        contract.event_id,
        contract.order_id,
        contract.tenant_id,
        contract.event_type,
        contract.status,
        contract.station,
        contract.from_station,
        contract.event_schema_version,
        contract.aggregate_version,
        contract.payload_order_id,
        contract.payload_mode,
        contract.payload_payment_mode,
        contract.payload_invoice_state,
        contract.payload_gate_allowed,
        to_char(contract.created_at, 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"') AS created_at
      FROM public.v_order_timeliness_pickup_events_v1 contract
      WHERE contract.tenant_id = ${tenantId}
        AND contract.order_id IN (${orderIdList})
        AND contract.event_type IN (${eventTypeList})
    `);
    pickupEvents = eventRows.map(toPickupEventRow);
  }

  return buildOrderTimelinessFacts({
    tenantId,
    range,
    generatedAt: new Date(),
    orders,
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
