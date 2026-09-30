import {
  isOrderLifecycleStatus,
  ORDER_LIFECYCLE_STATUS,
  type OrderLifecycleStatus,
} from "./orderLifecycleContract";

export const ORDER_PICKUP_EVENT_TYPE = {
  V1: "ORDER_PICKED_UP_V1",
  V2: "ORDER_PICKED_UP_V2",
} as const;

export type OrderPickupEventType =
  (typeof ORDER_PICKUP_EVENT_TYPE)[keyof typeof ORDER_PICKUP_EVENT_TYPE];

export const ORDER_TIMELINESS_MISSING_REASON = {
  CONFIRMED_DUE_DATE_MISSING: "confirmed_due_date_missing",
  CONFIRMED_DUE_DATE_INVALID: "confirmed_due_date_invalid",
  FINISHED_AT_MISSING: "finished_at_missing",
  FINISHED_AT_INVALID: "finished_at_invalid",
  PICKUP_EVENT_MISSING: "pickup_event_missing",
  PICKUP_EVENT_INVALID: "pickup_event_invalid",
  PICKUP_EVENT_AMBIGUOUS: "pickup_event_ambiguous",
  CANCELLATION_CONTRACT_MISSING: "cancellation_contract_missing",
} as const;

export type OrderTimelinessMissingReason =
  (typeof ORDER_TIMELINESS_MISSING_REASON)[keyof typeof ORDER_TIMELINESS_MISSING_REASON];

export const ORDER_TIMELINESS_CONSISTENCY = {
  FINISHED_AT_WITHOUT_FINISHED_STATUS: "finished_at_without_finished_status",
  FINISHED_STATUS_WITHOUT_FINISHED_AT: "finished_status_without_finished_at",
  PICKED_UP_STATUS_WITHOUT_PICKUP_EVENT: "picked_up_status_without_pickup_event",
  PICKUP_EVENT_WITHOUT_FINISHED_AT: "pickup_event_without_finished_at",
  PICKUP_EVENT_BEFORE_FINISHED_AT: "pickup_event_before_finished_at",
} as const;

export type OrderTimelinessConsistency =
  (typeof ORDER_TIMELINESS_CONSISTENCY)[keyof typeof ORDER_TIMELINESS_CONSISTENCY];

export const ORDER_TIMELINESS_FACT_SCHEMA_VERSION = 1 as const;

export type OrderTimelinessColumnProvenance = {
  kind: "column";
  relation: "public.orders";
  column: "due_date" | "completed_date";
};

export type OrderTimelinessEventProvenance = {
  kind: "event";
  relation: "public.events";
  eventId: string;
  eventType: OrderPickupEventType;
  eventSchemaVersion: 1 | 2;
  aggregateVersion: number;
};

export type OrderTimelinessProvenance =
  | OrderTimelinessColumnProvenance
  | OrderTimelinessEventProvenance;

export type OrderTimelinessSource =
  | "orders.due_date"
  | "orders.completed_date"
  | "events.created_at";

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

/** Auftragsfakten nach tenantgebundenem Read; keine DB-Abfrage in dieser Domaene. */
export type OrderTimelinessOrderInput = {
  orderId: string;
  tenantId: string;
  orderNumber: string;
  orderVersion: number;
  lifecycleStatus: string;
  /** Kanonischer, zonenloser Kalendertag aus orders.due_date. */
  confirmedDueDate: string | null;
  /** UTC- oder Offset-Instant aus orders.completed_date. */
  finishedAt: string | null;
};

/**
 * Projektion der nicht-finanziellen Abholfelder. V1-Zahlungsstatus und
 * V1-Betragsfelder sind absichtlich kein Teil dieses Vertrags.
 */
export type OrderTimelinessPickupEventInput = {
  eventId: string;
  tenantId: string;
  orderId: string;
  eventType: string;
  status: string | null;
  fromStation: string | null;
  station: string | null;
  eventSchemaVersion: number | null;
  aggregateVersion: number | null;
  payloadOrderId: string | null;
  payloadMode: string | null;
  payloadPaymentMode: string | null;
  payloadInvoiceState: string | null;
  payloadGateAllowed: boolean | null;
  createdAt: string | null;
};

export type OrderTimelinessFact = {
  schemaVersion: typeof ORDER_TIMELINESS_FACT_SCHEMA_VERSION;
  orderId: string;
  orderNumber: string;
  orderVersion: number;
  lifecycleStatus: OrderLifecycleStatus;
  /** Dokumentierter Portname; die Quelle bleibt strikt orders.due_date. */
  promisedDate: OrderTimelinessValue<string>;
  finishedAt: OrderTimelinessValue<string>;
  pickedUpAt: OrderTimelinessValue<string>;
  /** Storno bleibt bis zum ratifizierten G04-Stornovertrag absichtlich missing. */
  cancellationClass: OrderTimelinessValue<never>;
  consistency: readonly OrderTimelinessConsistency[];
};

export type DeriveOrderTimelinessFactInput = {
  tenantId: string;
  order: OrderTimelinessOrderInput;
  pickupEvents: readonly OrderTimelinessPickupEventInput[];
};

const CALENDAR_DAY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const EXPLICIT_OFFSET_PATTERN = /(?:Z|[+-]\d{2}:\d{2})$/;
const PICKUP_MODES = new Set(["versand", "abholung"]);
const V1_PAYMENT_MODES = new Set(["vorkasse", "abholung", "rechnung"]);

function isCalendarDay(value: string): boolean {
  if (!CALENDAR_DAY_PATTERN.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

function normalizeInstant(value: string | null): string | null {
  if (value === null || !EXPLICIT_OFFSET_PATTERN.test(value)) return null;
  const parsed = new Date(value);
  return Number.isFinite(parsed.getTime()) ? parsed.toISOString() : null;
}

function missing<T>(missingReason: OrderTimelinessMissingReason): OrderTimelinessValue<T> {
  return { value: null, source: null, provenance: null, missingReason };
}

function present<T>(
  value: T,
  source: OrderTimelinessSource,
  provenance: OrderTimelinessProvenance,
): OrderTimelinessValue<T> {
  return { value, source, provenance, missingReason: null };
}

function deriveConfirmedDueDate(value: string | null): OrderTimelinessValue<string> {
  if (value === null) {
    return missing(ORDER_TIMELINESS_MISSING_REASON.CONFIRMED_DUE_DATE_MISSING);
  }
  if (!isCalendarDay(value)) {
    return missing(ORDER_TIMELINESS_MISSING_REASON.CONFIRMED_DUE_DATE_INVALID);
  }
  return present(value, "orders.due_date", {
    kind: "column",
    relation: "public.orders",
    column: "due_date",
  });
}

function deriveFinishedAt(value: string | null): OrderTimelinessValue<string> {
  if (value === null) return missing(ORDER_TIMELINESS_MISSING_REASON.FINISHED_AT_MISSING);
  const normalized = normalizeInstant(value);
  if (normalized === null) return missing(ORDER_TIMELINESS_MISSING_REASON.FINISHED_AT_INVALID);
  return present(normalized, "orders.completed_date", {
    kind: "column",
    relation: "public.orders",
    column: "completed_date",
  });
}

function isPositiveInteger(value: number | null): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value > 0;
}

function hasCommonPickupContract(
  event: OrderTimelinessPickupEventInput,
  tenantId: string,
  orderId: string,
): boolean {
  return event.eventId.trim().length > 0
    && event.tenantId === tenantId
    && event.orderId === orderId
    && event.status === "success"
    && event.fromStation === ORDER_LIFECYCLE_STATUS.FERTIG
    && event.station === ORDER_LIFECYCLE_STATUS.ABGEHOLT
    && isPositiveInteger(event.aggregateVersion)
    && event.payloadOrderId === orderId
    && event.payloadGateAllowed === true
    && event.payloadMode !== null
    && PICKUP_MODES.has(event.payloadMode)
    && normalizeInstant(event.createdAt) !== null;
}

function isValidPickupEvent(
  event: OrderTimelinessPickupEventInput,
  tenantId: string,
  orderId: string,
): boolean {
  if (!hasCommonPickupContract(event, tenantId, orderId)) return false;
  if (event.eventType === ORDER_PICKUP_EVENT_TYPE.V1) {
    return event.eventSchemaVersion === 1
      && event.payloadPaymentMode !== null
      && V1_PAYMENT_MODES.has(event.payloadPaymentMode)
      && event.payloadInvoiceState === null;
  }
  if (event.eventType === ORDER_PICKUP_EVENT_TYPE.V2) {
    return event.eventSchemaVersion === 2
      && event.payloadPaymentMode === "rechnung"
      && event.payloadInvoiceState === "not_issued";
  }
  return false;
}

function derivePickedUpAt(
  events: readonly OrderTimelinessPickupEventInput[],
  tenantId: string,
  orderId: string,
): OrderTimelinessValue<string> {
  for (const event of events) {
    if (event.tenantId !== tenantId) throw new Error("ORDER_TIMELINESS_EVENT_TENANT_MISMATCH");
    if (event.orderId !== orderId) throw new Error("ORDER_TIMELINESS_EVENT_ORDER_MISMATCH");
    if (event.eventType !== ORDER_PICKUP_EVENT_TYPE.V1 && event.eventType !== ORDER_PICKUP_EVENT_TYPE.V2) {
      throw new Error("ORDER_TIMELINESS_EVENT_TYPE_UNEXPECTED");
    }
  }

  const valid = events.filter((event) => isValidPickupEvent(event, tenantId, orderId));
  if (valid.length > 1) {
    return missing(ORDER_TIMELINESS_MISSING_REASON.PICKUP_EVENT_AMBIGUOUS);
  }
  const event = valid[0];
  if (!event) {
    return missing(events.length === 0
      ? ORDER_TIMELINESS_MISSING_REASON.PICKUP_EVENT_MISSING
      : ORDER_TIMELINESS_MISSING_REASON.PICKUP_EVENT_INVALID);
  }
  const createdAt = normalizeInstant(event.createdAt);
  if (createdAt === null || !isPositiveInteger(event.aggregateVersion)) {
    return missing(ORDER_TIMELINESS_MISSING_REASON.PICKUP_EVENT_INVALID);
  }
  const eventType = event.eventType === ORDER_PICKUP_EVENT_TYPE.V1
    ? ORDER_PICKUP_EVENT_TYPE.V1
    : ORDER_PICKUP_EVENT_TYPE.V2;
  const eventSchemaVersion = eventType === ORDER_PICKUP_EVENT_TYPE.V1 ? 1 : 2;
  return present(createdAt, "events.created_at", {
    kind: "event",
    relation: "public.events",
    eventId: event.eventId,
    eventType,
    eventSchemaVersion,
    aggregateVersion: event.aggregateVersion,
  });
}

function deriveConsistency(
  lifecycleStatus: OrderLifecycleStatus,
  finishedAt: OrderTimelinessValue<string>,
  pickedUpAt: OrderTimelinessValue<string>,
): readonly OrderTimelinessConsistency[] {
  const findings: OrderTimelinessConsistency[] = [];
  const isFinishedStatus = lifecycleStatus === ORDER_LIFECYCLE_STATUS.FERTIG
    || lifecycleStatus === ORDER_LIFECYCLE_STATUS.ABGEHOLT;

  if (finishedAt.value !== null && !isFinishedStatus) {
    findings.push(ORDER_TIMELINESS_CONSISTENCY.FINISHED_AT_WITHOUT_FINISHED_STATUS);
  }
  if (finishedAt.value === null && isFinishedStatus) {
    findings.push(ORDER_TIMELINESS_CONSISTENCY.FINISHED_STATUS_WITHOUT_FINISHED_AT);
  }
  if (lifecycleStatus === ORDER_LIFECYCLE_STATUS.ABGEHOLT && pickedUpAt.value === null) {
    findings.push(ORDER_TIMELINESS_CONSISTENCY.PICKED_UP_STATUS_WITHOUT_PICKUP_EVENT);
  }
  if (pickedUpAt.value !== null && finishedAt.value === null) {
    findings.push(ORDER_TIMELINESS_CONSISTENCY.PICKUP_EVENT_WITHOUT_FINISHED_AT);
  }
  if (
    pickedUpAt.value !== null
    && finishedAt.value !== null
    && pickedUpAt.value < finishedAt.value
  ) {
    findings.push(ORDER_TIMELINESS_CONSISTENCY.PICKUP_EVENT_BEFORE_FINISHED_AT);
  }
  return findings;
}

export function deriveOrderTimelinessFact(
  input: DeriveOrderTimelinessFactInput,
): OrderTimelinessFact {
  const { order, pickupEvents, tenantId } = input;
  if (tenantId.trim().length === 0) throw new Error("ORDER_TIMELINESS_TENANT_INVALID");
  if (order.tenantId !== tenantId) throw new Error("ORDER_TIMELINESS_ORDER_TENANT_MISMATCH");
  if (order.orderId.trim().length === 0 || order.orderNumber.trim().length === 0) {
    throw new Error("ORDER_TIMELINESS_ORDER_INVALID");
  }
  if (!Number.isSafeInteger(order.orderVersion) || order.orderVersion <= 0) {
    throw new Error("ORDER_TIMELINESS_ORDER_INVALID");
  }
  if (!isOrderLifecycleStatus(order.lifecycleStatus)) {
    throw new Error("ORDER_TIMELINESS_LIFECYCLE_INVALID");
  }
  if (!Array.isArray(pickupEvents)) throw new Error("ORDER_TIMELINESS_EVENTS_INVALID");

  const confirmedDueDate = deriveConfirmedDueDate(order.confirmedDueDate);
  const finishedAt = deriveFinishedAt(order.finishedAt);
  const pickedUpAt = derivePickedUpAt(pickupEvents, tenantId, order.orderId);

  return {
    schemaVersion: ORDER_TIMELINESS_FACT_SCHEMA_VERSION,
    orderId: order.orderId,
    orderNumber: order.orderNumber,
    orderVersion: order.orderVersion,
    lifecycleStatus: order.lifecycleStatus,
    promisedDate: confirmedDueDate,
    finishedAt,
    pickedUpAt,
    cancellationClass: missing(
      ORDER_TIMELINESS_MISSING_REASON.CANCELLATION_CONTRACT_MISSING,
    ),
    consistency: deriveConsistency(order.lifecycleStatus, finishedAt, pickedUpAt),
  };
}
