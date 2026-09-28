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
 * _MODULDOSSIERS/G04_AUFTRAEGE/02_FUNKTIONEN_ABLAEUFE.md Z.99 (F-G04-007) fordert
 * ein versioniertes Fakt mit Provenienz: `schemaVersion` (Form des Read-DTOs),
 * `orderVersion` (Aggregatversion der gelesenen Auftragszeile) und je belegtem
 * Zeitpunkt ein diskriminiertes `provenance`-Objekt (Spalte oder Ereignis).
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

const PICKUP_EVENT_SCHEMA_VERSION_V1 = 1 as const;
const PICKUP_EVENT_SCHEMA_VERSION_V2 = 2 as const;
const PICKUP_MODES = ["versand", "abholung"] as const;

/**
 * Zahlarten, die ein ORDER_PICKED_UP_V1-Payload tragen darf. Bewusst NICHT das
 * V2-Literal `"rechnung"`: events_order_picked_up_v1_contract_chk
 * (supabase/migrations/20260905100000_f1_5_payment_goods_out_contract.sql)
 * erlaubt fuer V1 ausdruecklich alle drei Werte
 * (`payload->>'paymentMode' IN ('vorkasse', 'abholung', 'rechnung')`), waehrend
 * private.validate_f15_v2_event_insert fuer V2 auf 'rechnung' festlegt.
 */
const PICKUP_PAYMENT_MODES_V1 = ["vorkasse", "abholung", "rechnung"] as const;

/**
 * Klassifikation des Legacy-Terminfelds `public.orders.promised_due_date`
 * gegenueber der einzigen schreibbaren Terminwahrheit `public.orders.due_date`
 * (A-G04-008: "Alle G04-Reads verwenden due_date"). Die Werte entstehen als
 * Spalte `promised_date_legacy_class` in
 * `v_order_timeliness_orders_v1` und sind read-only Diagnose
 * (K-G04-008: "read-only Diagnose ... keine automatische Wahl").
 */
const ORDER_PROMISED_DATE_LEGACY_CLASS = {
  /** Kein Legacy-Wert vorhanden; nichts zu melden. */
  DUE_DATE_ONLY: "nur_due_date",
  /** Nur das Legacy-Feld ist gesetzt, `due_date` fehlt. */
  PROMISED_ONLY: "nur_promised",
  /**
   * Beide gesetzt und derselbe Kalendertag in Europe/Berlin — der einzigen
   * kanonischen Zone (_MODULDOSSIERS/G04_AUFTRAEGE/02_FUNKTIONEN_ABLAEUFE.md:69
   * "Zeitzone Europe/Berlin"). Nicht mehr "in allen geprueften Zonen": die
   * frueher doppelt (UTC und Berlin) gepruefte Regel hat Termine als
   * widerspruechlich gemeldet, die in der kanonischen Zone derselbe Tag sind.
   */
  EQUAL: "gleich",
  /** Beide gesetzt, aber nicht derselbe Kalendertag (F-G04-007-Fehlerfall). */
  CONFLICTING: "widerspruechlich",
} as const;

/**
 * Schemaversion des KPI-Fakts (F-G04-007: "Versioniertes `OrderTimelinessFact`
 * mit Provenienz der Zeitpunkte; read-only"). Sie beschreibt die Form des
 * Read-DTOs, nicht den Stand des Auftrags: `orderVersion` traegt die
 * Aggregatversion der gelesenen Auftragszeile. Jede nicht rueckwaerts-
 * kompatible Feldaenderung erhoeht diese Zahl und das Modul-Manifest.
 */
export const ORDER_TIMELINESS_FACT_SCHEMA_VERSION = 1 as const;

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
  /**
   * Legacy-Terminfeld `orders.promised_due_date` widerspricht dem bestaetigten
   * Termin `orders.due_date` (F-G04-007 Fehlerfall "Legacy-Terminfelder
   * widersprechen sich"; A-G04-008 "Abweichungen zum Legacy-Feld werden vor
   * Migration als Konflikt ausgewiesen"). Reiner Hinweis: K-G04-008 verlangt
   * "read-only Diagnose ... keine automatische Wahl", `promisedDate` bleibt
   * deshalb unveraendert aus `due_date` belegt.
   */
  PROMISED_DATE_LEGACY_CONFLICT: "promised_date_legacy_conflict",
  /** Nur das Legacy-Feld traegt einen Termin, `orders.due_date` ist leer. */
  PROMISED_DATE_ONLY_LEGACY: "promised_date_only_legacy",
} as const;

export type OrderTimelinessConsistency =
  (typeof ORDER_TIMELINESS_CONSISTENCY)[keyof typeof ORDER_TIMELINESS_CONSISTENCY];

/**
 * Storno-Klassifikation ist bis Q-G04-002 nicht gebaut. `never` macht das im
 * Typsystem verbindlich: ein Wert kann nicht gesetzt werden, nur die
 * Missing-Reason-Variante ist konstruierbar.
 */
export type OrderCancellationClass = never;

/**
 * Provenienz eines belegten Zeitpunkts: die exakte Herkunft, aus der der Wert
 * stammt. Die Union ist nach `kind` diskriminiert, damit ein Spaltenwert nie
 * als Ereignisbeleg gelesen werden kann und umgekehrt.
 */
export type OrderTimelinessColumnProvenance = {
  kind: "column";
  relation: "public.orders";
  column: "due_date" | "completed_date";
};

export type OrderTimelinessEventProvenance = {
  kind: "event";
  relation: "public.events";
  eventId: string;
  eventType: typeof ORDER_PICKUP_EVENT_TYPE_V2;
  eventSchemaVersion: typeof PICKUP_EVENT_SCHEMA_VERSION_V2;
  aggregateVersion: number;
};

export type OrderTimelinessProvenance =
  | OrderTimelinessColumnProvenance
  | OrderTimelinessEventProvenance;

export type OrderTimelinessValue<T> =
  | {
      value: T;
      source: OrderTimelinessSource;
      provenance: OrderTimelinessProvenance;
      missingReason: null;
    }
  | {
      value: null;
      source: null;
      provenance: null;
      missingReason: OrderTimelinessMissingReason;
    };

/** Auswertungsfenster, Kalendertage in Europe/Berlin, beide Grenzen inklusiv. */
export type OrderTimelinessRange = {
  from: string;
  to: string;
};

export type OrderTimelinessFact = {
  /** Form des Read-DTOs, nicht der Stand des Auftrags. */
  schemaVersion: typeof ORDER_TIMELINESS_FACT_SCHEMA_VERSION;
  orderId: string;
  orderNumber: string;
  /** Aggregatversion der gelesenen Auftragszeile (`orders.version`). */
  orderVersion: number;
  lifecycleStatus: string;
  /**
   * Bestaetigter Auftragstermin als Europe/Berlin-Kalendertag (`YYYY-MM-DD`),
   * der einzigen kanonischen Zone. `orders.due_date` ist
   * `timestamp without time zone`, traegt den Tag also schon zonenlos; es wird
   * deshalb nichts umgerechnet, nur der Tag abgelesen.
   */
  promisedDate: OrderTimelinessValue<string>;
  /** Fertig-Zeitpunkt als UTC-Instant, aktueller Wert aus `completed_date`. */
  finishedAt: OrderTimelinessValue<string>;
  /** Abhol-Zeitpunkt als UTC-Instant aus genau einem validen V2-Ereignis. */
  pickedUpAt: OrderTimelinessValue<string>;
  cancellationClass: OrderTimelinessValue<OrderCancellationClass>;
  consistency: readonly OrderTimelinessConsistency[];
};

export type OrderTimelinessFacts = {
  /** Form des Read-DTOs; identisch mit der Version jedes einzelnen Fakts. */
  schemaVersion: typeof ORDER_TIMELINESS_FACT_SCHEMA_VERSION;
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
  version: number | null;
  dueDate: Date | string | null;
  completedDate: Date | string | null;
  /**
   * Read-only Diagnose des Legacy-Terminfelds, berechnet in
   * `v_order_timeliness_orders_v1` als
   * `promised_date_legacy_class`. `string | null` spiegelt die nullbare
   * SQL-Spalte, genau wie `version: number | null`; die Domaene laesst
   * fail-closed nur die vier deklarierten Klassen durch und wirft sonst
   * (`ORDER_TIMELINESS_LEGACY_CLASS_INVALID`).
   */
  promisedDateLegacyClass: string | null;
};

/**
 * Abhol-Ereigniszeile, wie der Port sie tenantgebunden liest.
 *
 * Der Readvertrag reicht das rohe `events.payload` bewusst NICHT durch: ein
 * `ORDER_PICKED_UP_V1`-Payload traegt `paymentStatus` und `openAmountCents`, also
 * Finanzfakten, die an anderer Stelle hinter einer Finanzgatterung liegen. Der
 * Vertrag projiziert deshalb genau die fuenf Skalarfelder, die ein Abholereignis
 * belastbar machen. Ein Feld mit falschem JSON-Typ kommt als `null` an und macht
 * das Ereignis damit ungueltig — dasselbe Ergebnis wie vorher bei einem
 * unbrauchbaren Payload-Objekt.
 */
export type OrderTimelinessPickupEventRow = {
  eventId: string;
  orderId: string;
  tenantId: string | null;
  eventType: string;
  status: string | null;
  station: string | null;
  fromStation: string | null;
  eventSchemaVersion: number | null;
  aggregateVersion: number | null;
  payloadOrderId: string | null;
  payloadMode: string | null;
  payloadPaymentMode: string | null;
  payloadInvoiceState: string | null;
  payloadGateAllowed: boolean | null;
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

/**
 * Liest den Kalendertag ab. Der Name sagt UTC, weil hier wirklich der UTC-Tag
 * des normalisierten Instants gelesen wird — fuer den einzigen Aufrufer
 * (`derivePromisedDate` auf `orders.due_date`) ist das dennoch der
 * Europe/Berlin-Kalendertag und keine Umrechnung: die Spalte ist
 * `timestamp without time zone`, der Port projiziert sie mit einem literalen
 * `Z`-Suffix, und `toInstant` liest sie deshalb unverschoben. Was hier
 * herauskommt, ist damit exakt der gespeicherte Tag. Die Umbenennung dieser
 * Funktion ist eine reine Namenskorrektur und bleibt bewusst ausserhalb dieses
 * Pakets (Kommentar-Scope).
 */
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
  provenance: OrderTimelinessProvenance,
): OrderTimelinessValue<string> {
  return { value, source, provenance, missingReason: null };
}

/** Die fehlende Variante ist fuer jedes `OrderTimelinessValue<T>` gueltig. */
type OrderTimelinessMissingValue = {
  value: null;
  source: null;
  provenance: null;
  missingReason: OrderTimelinessMissingReason;
};

function missing(missingReason: OrderTimelinessMissingReason): OrderTimelinessMissingValue {
  return { value: null, source: null, provenance: null, missingReason };
}

function isPickupMode(value: unknown): boolean {
  return typeof value === "string" && (PICKUP_MODES as readonly string[]).includes(value);
}

/**
 * Ein Abhol-Ereignis, das den Lesevertrag erfuellt: Ereigniskennung,
 * Aggregatversion und Zeitstempel sind belegt und koennen als Provenienz
 * ausgewiesen werden.
 */
type ValidPickupEventV2Row = OrderTimelinessPickupEventRow & {
  eventId: string;
  eventType: typeof ORDER_PICKUP_EVENT_TYPE_V2;
  eventSchemaVersion: typeof PICKUP_EVENT_SCHEMA_VERSION_V2;
  aggregateVersion: number;
};

/**
 * Lesevertrag fuer ein valides Abhol-Ereignis. Geprueft wird die Teilmenge, die
 * den Zeitpunkt belastbar macht: Ereigniskennung, Tenant, Auftragsbezug,
 * Erfolgsstatus, Stationsuebergang, Ereignis-Schemaversion, Aggregatversion,
 * Gate-Beleg und Zeitstempel. Ein Ereignis, das das nicht erfuellt, wird nie
 * als Abholzeit verwendet.
 */
export function isValidPickupEventV2(
  row: OrderTimelinessPickupEventRow,
  tenantId: string,
  orderId: string,
): row is ValidPickupEventV2Row {
  return row.eventType === ORDER_PICKUP_EVENT_TYPE_V2
    && typeof row.eventId === "string"
    && row.eventId.length > 0
    && row.tenantId === tenantId
    && row.orderId === orderId
    && row.status === "success"
    && row.fromStation === ORDER_LIFECYCLE_STATUS.FERTIG
    && row.station === ORDER_LIFECYCLE_STATUS.ABGEHOLT
    && row.eventSchemaVersion === PICKUP_EVENT_SCHEMA_VERSION_V2
    && typeof row.aggregateVersion === "number"
    && Number.isSafeInteger(row.aggregateVersion)
    && row.aggregateVersion > 0
    && row.payloadOrderId === orderId
    && row.payloadGateAllowed === true
    && row.payloadPaymentMode === "rechnung"
    && row.payloadInvoiceState === "not_issued"
    && isPickupMode(row.payloadMode)
    && toIsoInstant(row.createdAt) !== null;
}

/**
 * Ein ORDER_PICKED_UP_V1-Ereignis, das seinen eigenen Schreibvertrag erfuellt.
 * Die Typverengung sagt NICHT, dass daraus ein Abholzeitpunkt wird — sie sagt,
 * dass das Ereignis strukturell heil ist.
 */
type ValidPickupEventV1Row = OrderTimelinessPickupEventRow & {
  eventId: string;
  eventType: typeof ORDER_PICKUP_EVENT_TYPE_V1;
  eventSchemaVersion: typeof PICKUP_EVENT_SCHEMA_VERSION_V1;
  aggregateVersion: number;
};

/**
 * Lesevertrag fuer ein strukturell gueltiges ORDER_PICKED_UP_V1-Ereignis.
 *
 * V1 ist KEIN Altschema: src/lib/server/commands/recordGoodsOutCommand.ts
 * schreibt V1 fuer "Rechnung bereits gestellt" und V2 fuer "Rechnung noch nicht
 * gestellt" — beide Zweige sind heute aktiv. Ohne diese Pruefung waere ein
 * strukturell KAPUTTES V1 nicht von einem heilen zu unterscheiden und wuerde
 * faelschlich als `PICKUP_CONTRACT_V1_ONLY` (also als gueltiger, nur nicht
 * verwendbarer Vertrag) statt als `INVALID_PICKUP_EVENT` gemeldet.
 *
 * Geprueft wird exakt die Teilmenge von
 * `events_order_picked_up_v1_contract_chk`
 * (supabase/migrations/20260905100000_f1_5_payment_goods_out_contract.sql), die
 * der Readvertrag ueberhaupt projiziert. Bewusst NICHT geprueft werden
 * `paymentStatus` und `openAmountCents`: die View laesst sie aus
 * (Finanzgatterung, siehe 20260927120000), und Finanzfakten duerfen die
 * Gueltigkeit eines ZEITPUNKTS nicht gattern.
 *
 * `payloadInvoiceState === null` ist eine positive Abgrenzung, keine Laxheit:
 * der V1-Check schreibt den Payload per `payload = jsonb_build_object(...)` auf
 * genau sieben Schluessel fest, `invoiceState` ist keiner davon. Ein V1-Ereignis
 * MIT invoiceState waere ein falsch getyptes V2.
 */
export function isValidPickupEventV1(
  row: OrderTimelinessPickupEventRow,
  tenantId: string,
  orderId: string,
): row is ValidPickupEventV1Row {
  return row.eventType === ORDER_PICKUP_EVENT_TYPE_V1
    && typeof row.eventId === "string"
    && row.eventId.length > 0
    && row.tenantId === tenantId
    && row.orderId === orderId
    && row.status === "success"
    && row.fromStation === ORDER_LIFECYCLE_STATUS.FERTIG
    && row.station === ORDER_LIFECYCLE_STATUS.ABGEHOLT
    && row.eventSchemaVersion === PICKUP_EVENT_SCHEMA_VERSION_V1
    && typeof row.aggregateVersion === "number"
    && Number.isSafeInteger(row.aggregateVersion)
    && row.aggregateVersion > 0
    && row.payloadOrderId === orderId
    && row.payloadGateAllowed === true
    && typeof row.payloadPaymentMode === "string"
    && (PICKUP_PAYMENT_MODES_V1 as readonly string[]).includes(row.payloadPaymentMode)
    && row.payloadInvoiceState === null
    && isPickupMode(row.payloadMode)
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

/**
 * Abholzeitpunkt aus genau einem validen V2-Ereignis
 * (_MODULDOSSIERS/G04_AUFTRAEGE/04_SCHNITTSTELLEN_DATEN.md §Soll-Ist Punkt 3,
 * Abnahmetest T-G04-021). V1 und V2 sind gleichrangige, heute beide aktive
 * Ausgaenge desselben Commands, aber nur V2 belegt einen Wert; ein valides V1
 * bleibt read-only Diagnose (`PICKUP_CONTRACT_V1_ONLY`).
 *
 * Deshalb wird zuerst partitioniert und danach GEZAEHLT: ohne eine eigene
 * V1-Gueltigkeitspruefung waere (i) ein kaputtes V1 nicht von einem heilen zu
 * unterscheiden, (ii) der gemischte Fall V1+V2 ein stilles Ignorieren des V1 und
 * (iii) ein zweites V1 unsichtbar — fuer V1 existiert kein Unique-Index, nur
 * events_goods_out_order_version_v2_uidx deckt V2 ab.
 */
function derivePickedUpAt(
  orderId: string,
  tenantId: string,
  bucket: { v1: OrderTimelinessPickupEventRow[]; v2: OrderTimelinessPickupEventRow[] } | undefined,
): OrderTimelinessValue<string> {
  const rawV1 = bucket?.v1 ?? [];
  const rawV2 = bucket?.v2 ?? [];
  const validV1 = rawV1.filter((row) => isValidPickupEventV1(row, tenantId, orderId));
  const validV2 = rawV2.filter((row) => isValidPickupEventV2(row, tenantId, orderId));

  // Datenanomalie: mehr als ein gueltiges Abholereignis, egal in welcher
  // Vertragsversion. Nie das erste oder letzte waehlen.
  if (validV1.length + validV2.length > 1) {
    return missing(ORDER_TIMELINESS_MISSING_REASON.AMBIGUOUS_PICKUP_EVENTS);
  }

  const single = validV2[0];
  if (single) {
    const occurredAt = toIsoInstant(single.createdAt);
    return occurredAt === null
      ? missing(ORDER_TIMELINESS_MISSING_REASON.INVALID_PICKUP_EVENT)
      : present(occurredAt, ORDER_TIMELINESS_SOURCE.PICKED_UP_AT, {
        kind: "event",
        relation: "public.events",
        eventId: single.eventId,
        eventType: ORDER_PICKUP_EVENT_TYPE_V2,
        eventSchemaVersion: PICKUP_EVENT_SCHEMA_VERSION_V2,
        aggregateVersion: single.aggregateVersion,
      });
  }

  // Genau ein gueltiges V1 und kein gueltiges V2: benannter Altvertrag, kein
  // Wert. Der Grund greift ab hier nur noch fuer ein WIRKLICH gueltiges V1.
  if (validV1.length === 1) {
    return missing(ORDER_TIMELINESS_MISSING_REASON.PICKUP_CONTRACT_V1_ONLY);
  }
  // Ereignisse vorhanden, aber keines haelt seinen Vertrag.
  if (rawV1.length + rawV2.length > 0) {
    return missing(ORDER_TIMELINESS_MISSING_REASON.INVALID_PICKUP_EVENT);
  }
  return missing(ORDER_TIMELINESS_MISSING_REASON.NO_PICKUP_EVENT);
}

function derivePromisedDate(row: OrderTimelinessOrderRow): OrderTimelinessValue<string> {
  const day = toUtcCalendarDay(row.dueDate);
  return day === null
    ? missing(ORDER_TIMELINESS_MISSING_REASON.INVALID_PROMISED_DATE)
    : present(day, ORDER_TIMELINESS_SOURCE.PROMISED_DATE, {
      kind: "column",
      relation: "public.orders",
      column: "due_date",
    });
}

function deriveFinishedAt(row: OrderTimelinessOrderRow): OrderTimelinessValue<string> {
  if (row.completedDate === null || row.completedDate === undefined) {
    return missing(ORDER_TIMELINESS_MISSING_REASON.NOT_FINISHED_YET);
  }
  const finishedAt = toIsoInstant(row.completedDate);
  return finishedAt === null
    ? missing(ORDER_TIMELINESS_MISSING_REASON.INVALID_FINISHED_AT)
    : present(finishedAt, ORDER_TIMELINESS_SOURCE.FINISHED_AT, {
      kind: "column",
      relation: "public.orders",
      column: "completed_date",
    });
}

/**
 * Read-only Diagnose des Legacy-Terminfelds. Gibt genau einen Hinweis oder
 * keinen zurueck und trifft NIE eine Wahl zwischen den beiden Feldern
 * (K-G04-008). Ein unbekannter Klassenwert wird fail-closed abgelehnt, analog zu
 * `ORDER_TIMELINESS_EVENT_TYPE_UNEXPECTED`: eine nicht deklarierte Klasse hiesse,
 * die View liefert etwas anderes als der Vertrag behauptet, und ein stiller
 * "kein Hinweis" wuerde genau den Konflikt verstecken, den A-G04-008 ausweisen
 * will. Dasselbe gilt fuer `null`/`undefined` — die Spalte kann keinen der vier
 * Werte verfehlen, also ist ein fehlender Wert ein Vertragsbruch.
 */
function derivePromisedDateLegacyHint(
  row: OrderTimelinessOrderRow,
): OrderTimelinessConsistency | null {
  switch (row.promisedDateLegacyClass) {
    case ORDER_PROMISED_DATE_LEGACY_CLASS.DUE_DATE_ONLY:
    case ORDER_PROMISED_DATE_LEGACY_CLASS.EQUAL:
      return null;
    case ORDER_PROMISED_DATE_LEGACY_CLASS.PROMISED_ONLY:
      return ORDER_TIMELINESS_CONSISTENCY.PROMISED_DATE_ONLY_LEGACY;
    case ORDER_PROMISED_DATE_LEGACY_CLASS.CONFLICTING:
      return ORDER_TIMELINESS_CONSISTENCY.PROMISED_DATE_LEGACY_CONFLICT;
    default:
      throw new Error("ORDER_TIMELINESS_LEGACY_CLASS_INVALID");
  }
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
  const legacyHint = derivePromisedDateLegacyHint(row);
  if (legacyHint !== null) hints.push(legacyHint);
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
  // Fail-closed: die Aggregatversion ist Teil der Provenienz des Fakts. Eine
  // fehlende, unganze oder nicht positive Version wird nicht ersetzt.
  if (
    typeof row.version !== "number"
    || !Number.isSafeInteger(row.version)
    || row.version <= 0
  ) {
    throw new Error("ORDER_TIMELINESS_ORDER_INVALID");
  }
  const finishedAt = deriveFinishedAt(row);
  const pickedUpAt = derivePickedUpAt(row.id, tenantId, bucket);
  return {
    schemaVersion: ORDER_TIMELINESS_FACT_SCHEMA_VERSION,
    orderId: row.id,
    orderNumber: row.orderNumber,
    orderVersion: row.version,
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
    schemaVersion: ORDER_TIMELINESS_FACT_SCHEMA_VERSION,
    range: { from: input.range.from, to: input.range.to },
    generatedAt,
    facts,
  };
}
