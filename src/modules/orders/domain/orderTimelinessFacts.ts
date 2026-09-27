/**
 * G04 KPI-Fakten (Termintreue) fuer M02 — reine Ableitung, keine zweite Tabelle.
 *
 * Quelle: _MODULDOSSIERS/G04_AUFTRAEGE/04_SCHNITTSTELLEN_DATEN.md
 *  - Z.14  Port `getOrderTimelinessFacts(range)`: bestaetigter Termin, Fertigzeit,
 *          Abholzeit, Storno-Klassifikation, Provenienz/Missing-Reason.
 *  - Z.69  `orders.due_date` ist die einzige schreibbare Wahrheit fuer den
 *          bestaetigten Auftragstermin -> `promisedDate`.
 *  - Z.91  KPI-Fakt ist ein Read-DTO, abgeleitet, nicht als zweite Tabelle.
 *  - Z.98  Fertig-Zeitpunkt ist `completed_date`; Abholzeitpunkt kommt aus genau
 *          einem validen `ORDER_PICKED_UP_V2`-Ereignis. Kein `updated_at` als Ersatz.
 *  - Z.51  `ORDER_CANCELLED_V1` FEHLT; nicht implementieren -> `cancellationClass`
 *          bleibt bis Q-G04-002 immer `null` mit Missing-Reason.
 *
 * Diese Datei ist bewusst frei von Datenbank- und Serverabhaengigkeiten: die
 * gesamte Ableitungs-, Missing-Reason- und Anomalielogik ist dadurch als echte
 * Funktionslogik testbar. Der serverseitige Port liegt in
 * ../server/getOrderTimelinessFacts.ts.
 */

import { ORDER_LIFECYCLE_STATUS } from "./orderLifecycleContract";

/**
 * Schreibseitige Wahrheit der Abholung: src/lib/server/commands/recordGoodsOutCommand.ts
 * schreibt `ORDER_PICKED_UP_V2` (Rechnung noch nicht gestellt) beziehungsweise
 * `ORDER_PICKED_UP_V1` (Rechnung gestellt und bezahlt). Die Konstanten dort sind
 * modulintern; hier stehen sie als Lesevertrag, nicht als zweite Wahrheit.
 */
export const ORDER_PICKUP_EVENT_TYPE_V1 = "ORDER_PICKED_UP_V1" as const;
export const ORDER_PICKUP_EVENT_TYPE_V2 = "ORDER_PICKED_UP_V2" as const;
export const ORDER_PICKUP_EVENT_TYPES = [
  ORDER_PICKUP_EVENT_TYPE_V1,
  ORDER_PICKUP_EVENT_TYPE_V2,
] as const;

const PICKUP_EVENT_SCHEMA_VERSION_V2 = 2;
const PICKUP_MODES = ["versand", "abholung"] as const;

/** Genau ein Grund pro fehlendem Wert; Strings sind Teil des M02-Vertrags. */
export const ORDER_TIMELINESS_MISSING_REASON = {
  /** PL-Entscheidung: Storno bleibt bis Q-G04-002 ungebaut. */
  CANCELLATION_CLASS_OPEN: "Q-G04-002 In Klaerung",
  INVALID_PROMISED_DATE: "invalid_promised_date",
  NOT_FINISHED_YET: "not_finished_yet",
  INVALID_FINISHED_AT: "invalid_finished_at",
  NO_PICKUP_EVENT: "no_pickup_event",
  INVALID_PICKUP_EVENT: "invalid_pickup_event",
  AMBIGUOUS_PICKUP_EVENTS: "ambiguous_pickup_events",
  PICKUP_CONTRACT_V1_ONLY: "pickup_event_contract_v1_only",
} as const;

export type OrderTimelinessMissingReason =
  (typeof ORDER_TIMELINESS_MISSING_REASON)[keyof typeof ORDER_TIMELINESS_MISSING_REASON];

/** Provenienz: welche Spalte beziehungsweise welches Ereignis den Wert belegt. */
export const ORDER_TIMELINESS_SOURCE = {
  PROMISED_DATE: "orders.due_date",
  FINISHED_AT: "orders.completed_date",
  PICKED_UP_AT: "events.ORDER_PICKED_UP_V2.created_at",
} as const;

export type OrderTimelinessSource =
  (typeof ORDER_TIMELINESS_SOURCE)[keyof typeof ORDER_TIMELINESS_SOURCE];

/** Konsistenzhinweise; belegt ausschliesslich aus Auftrag und Ereignis. */
export const ORDER_TIMELINESS_CONSISTENCY = {
  COMPLETED_DATE_WITHOUT_FINISHED_STATUS: "completed_date_without_finished_status",
  FINISHED_STATUS_WITHOUT_COMPLETED_DATE: "finished_status_without_completed_date",
  PICKED_UP_STATUS_WITHOUT_PICKUP_EVENT: "picked_up_status_without_pickup_event",
  PICKUP_EVENT_WITHOUT_COMPLETED_DATE: "pickup_event_without_completed_date",
  PICKUP_BEFORE_FINISH: "pickup_before_finish",
} as const;

export type OrderTimelinessConsistency =
  (typeof ORDER_TIMELINESS_CONSISTENCY)[keyof typeof ORDER_TIMELINESS_CONSISTENCY];

/**
 * Storno-Klassifikation ist bis Q-G04-002 nicht gebaut. `never` macht das im
 * Typsystem verbindlich: ein Wert kann nicht gesetzt werden, nur die
 * Missing-Reason-Variante ist konstruierbar.
 */
export type OrderCancellationClass = never;

export type OrderTimelinessValue<T> =
  | { value: T; source: OrderTimelinessSource; missingReason: null }
  | { value: null; source: null; missingReason: OrderTimelinessMissingReason };

/** Auswertungsfenster, Kalendertage in UTC, beide Grenzen inklusiv. */
export type OrderTimelinessRange = {
  from: string;
  to: string;
};

export type OrderTimelinessFact = {
  orderId: string;
  orderNumber: string;
  lifecycleStatus: string;
  /** Bestaetigter Auftragstermin als UTC-Kalendertag (`YYYY-MM-DD`). */
  promisedDate: OrderTimelinessValue<string>;
  /** Fertig-Zeitpunkt als UTC-Instant, aktueller Wert aus `completed_date`. */
  finishedAt: OrderTimelinessValue<string>;
  /** Abhol-Zeitpunkt als UTC-Instant aus genau einem validen V2-Ereignis. */
  pickedUpAt: OrderTimelinessValue<string>;
  cancellationClass: OrderTimelinessValue<OrderCancellationClass>;
  consistency: readonly OrderTimelinessConsistency[];
};

export type OrderTimelinessFacts = {
  range: OrderTimelinessRange;
  generatedAt: string;
  facts: readonly OrderTimelinessFact[];
};

/** Auftragszeile, wie der Port sie tenantgebunden liest. */
export type OrderTimelinessOrderRow = {
  id: string;
  tenantId: string | null;
  orderNumber: string;
  status: string;
  dueDate: Date | string | null;
  completedDate: Date | string | null;
};

/** Abhol-Ereigniszeile, wie der Port sie tenantgebunden liest. */
export type OrderTimelinessPickupEventRow = {
  orderId: string;
  tenantId: string | null;
  eventType: string;
  status: string | null;
  station: string | null;
  fromStation: string | null;
  eventSchemaVersion: number | null;
  aggregateVersion: number | null;
  payload: unknown;
  createdAt: Date | string | null;
};

export type OrderTimelinessFactsInput = {
  tenantId: string;
  range: OrderTimelinessRange;
  generatedAt: Date | string;
  orders: readonly OrderTimelinessOrderRow[];
  pickupEvents: readonly OrderTimelinessPickupEventRow[];
};

const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const TIMEZONE_SUFFIX_PATTERN = /(?:Z|[+-]\d{2}:?\d{2})$/;

function toInstant(value: Date | string | null | undefined): Date | null {
  if (value === null || value === undefined) return null;
  if (value instanceof Date) return Number.isFinite(value.getTime()) ? value : null;
  if (typeof value !== "string" || value.trim().length === 0) return null;
  // Zeitstempel ohne Zonenangabe werden serverseitig in UTC geschrieben.
  const normalized = TIMEZONE_SUFFIX_PATTERN.test(value) ? value : `${value.replace(" ", "T")}Z`;
  const parsed = new Date(normalized);
  return Number.isFinite(parsed.getTime()) ? parsed : null;
}

function toIsoInstant(value: Date | string | null | undefined): string | null {
  return toInstant(value)?.toISOString() ?? null;
}

function toUtcCalendarDay(value: Date | string | null | undefined): string | null {
  return toIsoInstant(value)?.slice(0, 10) ?? null;
}

function isCalendarDay(value: unknown): value is string {
  if (typeof value !== "string" || !ISO_DATE_PATTERN.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

/** Fail-closed Eingabepruefung des Auswertungsfensters. */
export function isOrderTimelinessRange(value: unknown): value is OrderTimelinessRange {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const candidate = value as Record<string, unknown>;
  const keys = Object.keys(candidate).sort();
  return keys.length === 2
    && keys[0] === "from"
    && keys[1] === "to"
    && isCalendarDay(candidate.from)
    && isCalendarDay(candidate.to)
    && (candidate.from as string) <= (candidate.to as string);
}

function present(
  value: string,
  source: OrderTimelinessSource,
): OrderTimelinessValue<string> {
  return { value, source, missingReason: null };
}

/** Die fehlende Variante ist fuer jedes `OrderTimelinessValue<T>` gueltig. */
type OrderTimelinessMissingValue = {
  value: null;
  source: null;
  missingReason: OrderTimelinessMissingReason;
};

function missing(missingReason: OrderTimelinessMissingReason): OrderTimelinessMissingValue {
  return { value: null, source: null, missingReason };
}

function isPickupMode(value: unknown): boolean {
  return typeof value === "string" && (PICKUP_MODES as readonly string[]).includes(value);
}

/**
 * Lesevertrag fuer ein valides Abhol-Ereignis. Geprueft wird die Teilmenge, die
 * den Zeitpunkt belastbar macht: Tenant, Auftragsbezug, Erfolgsstatus,
 * Stationsuebergang, Ereignis-Schemaversion, Aggregatversion, Gate-Beleg und
 * Zeitstempel. Ein Ereignis, das das nicht erfuellt, wird nie als Abholzeit
 * verwendet.
 */
export function isValidPickupEventV2(
  row: OrderTimelinessPickupEventRow,
  tenantId: string,
  orderId: string,
): boolean {
  if (!row.payload || typeof row.payload !== "object" || Array.isArray(row.payload)) return false;
  const payload = row.payload as Record<string, unknown>;
  return row.eventType === ORDER_PICKUP_EVENT_TYPE_V2
    && row.tenantId === tenantId
    && row.orderId === orderId
    && row.status === "success"
    && row.fromStation === ORDER_LIFECYCLE_STATUS.FERTIG
    && row.station === ORDER_LIFECYCLE_STATUS.ABGEHOLT
    && row.eventSchemaVersion === PICKUP_EVENT_SCHEMA_VERSION_V2
    && typeof row.aggregateVersion === "number"
    && Number.isSafeInteger(row.aggregateVersion)
    && row.aggregateVersion > 0
    && payload.orderId === orderId
    && payload.gateAllowed === true
    && payload.paymentMode === "rechnung"
    && payload.invoiceState === "not_issued"
    && isPickupMode(payload.mode)
    && toIsoInstant(row.createdAt) !== null;
}

type PickupEventsByOrder = Map<string, {
  v1: OrderTimelinessPickupEventRow[];
  v2: OrderTimelinessPickupEventRow[];
}>;

function groupPickupEvents(
  rows: readonly OrderTimelinessPickupEventRow[],
  tenantId: string,
): PickupEventsByOrder {
  const grouped: PickupEventsByOrder = new Map();
  for (const row of rows) {
    if (row.tenantId !== tenantId) throw new Error("ORDER_TIMELINESS_EVENT_TENANT_MISMATCH");
    if (row.eventType !== ORDER_PICKUP_EVENT_TYPE_V1 && row.eventType !== ORDER_PICKUP_EVENT_TYPE_V2) {
      throw new Error("ORDER_TIMELINESS_EVENT_TYPE_UNEXPECTED");
    }
    const bucket = grouped.get(row.orderId) ?? { v1: [], v2: [] };
    if (row.eventType === ORDER_PICKUP_EVENT_TYPE_V2) bucket.v2.push(row);
    else bucket.v1.push(row);
    grouped.set(row.orderId, bucket);
  }
  return grouped;
}

function derivePickedUpAt(
  orderId: string,
  tenantId: string,
  bucket: { v1: OrderTimelinessPickupEventRow[]; v2: OrderTimelinessPickupEventRow[] } | undefined,
): OrderTimelinessValue<string> {
  const v2 = bucket?.v2 ?? [];
  // Datenanomalie: mehr als ein V2-Ereignis. Nie das erste oder letzte waehlen.
  if (v2.length > 1) return missing(ORDER_TIMELINESS_MISSING_REASON.AMBIGUOUS_PICKUP_EVENTS);
  const single = v2[0];
  if (!single) {
    return (bucket?.v1.length ?? 0) > 0
      ? missing(ORDER_TIMELINESS_MISSING_REASON.PICKUP_CONTRACT_V1_ONLY)
      : missing(ORDER_TIMELINESS_MISSING_REASON.NO_PICKUP_EVENT);
  }
  if (!isValidPickupEventV2(single, tenantId, orderId)) {
    return missing(ORDER_TIMELINESS_MISSING_REASON.INVALID_PICKUP_EVENT);
  }
  const occurredAt = toIsoInstant(single.createdAt);
  return occurredAt === null
    ? missing(ORDER_TIMELINESS_MISSING_REASON.INVALID_PICKUP_EVENT)
    : present(occurredAt, ORDER_TIMELINESS_SOURCE.PICKED_UP_AT);
}

function derivePromisedDate(row: OrderTimelinessOrderRow): OrderTimelinessValue<string> {
  const day = toUtcCalendarDay(row.dueDate);
  return day === null
    ? missing(ORDER_TIMELINESS_MISSING_REASON.INVALID_PROMISED_DATE)
    : present(day, ORDER_TIMELINESS_SOURCE.PROMISED_DATE);
}

function deriveFinishedAt(row: OrderTimelinessOrderRow): OrderTimelinessValue<string> {
  if (row.completedDate === null || row.completedDate === undefined) {
    return missing(ORDER_TIMELINESS_MISSING_REASON.NOT_FINISHED_YET);
  }
  const finishedAt = toIsoInstant(row.completedDate);
  return finishedAt === null
    ? missing(ORDER_TIMELINESS_MISSING_REASON.INVALID_FINISHED_AT)
    : present(finishedAt, ORDER_TIMELINESS_SOURCE.FINISHED_AT);
}

function deriveConsistency(
  row: OrderTimelinessOrderRow,
  finishedAt: OrderTimelinessValue<string>,
  pickedUpAt: OrderTimelinessValue<string>,
): readonly OrderTimelinessConsistency[] {
  const hints: OrderTimelinessConsistency[] = [];
  const finishedStatus = row.status === ORDER_LIFECYCLE_STATUS.FERTIG
    || row.status === ORDER_LIFECYCLE_STATUS.ABGEHOLT;
  if (row.completedDate !== null && row.completedDate !== undefined && !finishedStatus) {
    hints.push(ORDER_TIMELINESS_CONSISTENCY.COMPLETED_DATE_WITHOUT_FINISHED_STATUS);
  }
  if ((row.completedDate === null || row.completedDate === undefined) && finishedStatus) {
    hints.push(ORDER_TIMELINESS_CONSISTENCY.FINISHED_STATUS_WITHOUT_COMPLETED_DATE);
  }
  if (row.status === ORDER_LIFECYCLE_STATUS.ABGEHOLT && pickedUpAt.value === null) {
    hints.push(ORDER_TIMELINESS_CONSISTENCY.PICKED_UP_STATUS_WITHOUT_PICKUP_EVENT);
  }
  if (pickedUpAt.value !== null && finishedAt.value === null) {
    hints.push(ORDER_TIMELINESS_CONSISTENCY.PICKUP_EVENT_WITHOUT_COMPLETED_DATE);
  }
  if (
    pickedUpAt.value !== null
    && finishedAt.value !== null
    && pickedUpAt.value < finishedAt.value
  ) {
    hints.push(ORDER_TIMELINESS_CONSISTENCY.PICKUP_BEFORE_FINISH);
  }
  return hints;
}

function buildFact(
  row: OrderTimelinessOrderRow,
  tenantId: string,
  bucket: { v1: OrderTimelinessPickupEventRow[]; v2: OrderTimelinessPickupEventRow[] } | undefined,
): OrderTimelinessFact {
  if (row.tenantId !== tenantId) throw new Error("ORDER_TIMELINESS_ORDER_TENANT_MISMATCH");
  if (typeof row.id !== "string" || row.id.length === 0) throw new Error("ORDER_TIMELINESS_ORDER_INVALID");
  if (typeof row.orderNumber !== "string" || row.orderNumber.length === 0) {
    throw new Error("ORDER_TIMELINESS_ORDER_INVALID");
  }
  if (typeof row.status !== "string" || row.status.length === 0) {
    throw new Error("ORDER_TIMELINESS_ORDER_INVALID");
  }
  const finishedAt = deriveFinishedAt(row);
  const pickedUpAt = derivePickedUpAt(row.id, tenantId, bucket);
  return {
    orderId: row.id,
    orderNumber: row.orderNumber,
    lifecycleStatus: row.status,
    promisedDate: derivePromisedDate(row),
    finishedAt,
    pickedUpAt,
    // Q-G04-002 ist offen: keine Klassifikation, kein Ereignis, kein Feld.
    cancellationClass: missing(ORDER_TIMELINESS_MISSING_REASON.CANCELLATION_CLASS_OPEN),
    consistency: deriveConsistency(row, finishedAt, pickedUpAt),
  };
}

/**
 * Leitet die KPI-Fakten aus bereits tenantgebunden gelesenen Zeilen ab.
 * Jeder Aufruf rechnet neu: der Fertig-Zeitpunkt ist immer der aktuelle Wert aus
 * `completed_date`, auch nach einer Freeze-Korrektur.
 */
export function buildOrderTimelinessFacts(
  input: OrderTimelinessFactsInput,
): OrderTimelinessFacts {
  if (typeof input.tenantId !== "string" || input.tenantId.length === 0) {
    throw new Error("ORDER_TIMELINESS_TENANT_INVALID");
  }
  if (!isOrderTimelinessRange(input.range)) throw new Error("ORDER_TIMELINESS_RANGE_INVALID");
  const generatedAt = toIsoInstant(input.generatedAt);
  if (generatedAt === null) throw new Error("ORDER_TIMELINESS_GENERATED_AT_INVALID");
  if (!Array.isArray(input.orders) || !Array.isArray(input.pickupEvents)) {
    throw new Error("ORDER_TIMELINESS_ROWS_INVALID");
  }
  const grouped = groupPickupEvents(input.pickupEvents, input.tenantId);
  const seen = new Set<string>();
  const facts = input.orders.map((row) => {
    if (seen.has(row.id)) throw new Error("ORDER_TIMELINESS_ORDER_DUPLICATE");
    seen.add(row.id);
    return buildFact(row, input.tenantId, grouped.get(row.id));
  });
  facts.sort((left, right) => {
    const leftDay = left.promisedDate.value ?? "";
    const rightDay = right.promisedDate.value ?? "";
    if (leftDay !== rightDay) return leftDay < rightDay ? -1 : 1;
    return left.orderNumber.localeCompare(right.orderNumber, "de");
  });
  return {
    range: { from: input.range.from, to: input.range.to },
    generatedAt,
    facts,
  };
}
