import "server-only";

import { sql } from "drizzle-orm";
import { resolveAuthorization } from "@/lib/server/authorization";
import {
  withPrivilegedTenantTransaction,
  type PrivilegedTenantTransaction,
} from "@/lib/server/privilegedDb";
import {
  deriveOrderTimelinessFact,
  type OrderTimelinessFact,
  type OrderTimelinessOrderInput,
  type OrderTimelinessPickupEventInput,
} from "../domain/orderTimelinessFacts";

export type OrderTimelinessRange = Readonly<{
  from: string;
  to: string;
}>;

export type OrderTimelinessFacts = Readonly<{
  schemaVersion: 1;
  range: OrderTimelinessRange;
  generatedAt: string;
  facts: readonly OrderTimelinessFact[];
}>;

export type OrderTimelinessFactsResult =
  | { code: "OK"; data: OrderTimelinessFacts }
  | { code: "UNAUTHENTICATED"; message: string }
  | { code: "FORBIDDEN"; message: string }
  | { code: "VALIDATION_ERROR"; message: string }
  | { code: "UNAVAILABLE"; message: string };

type OrderContractRow = {
  id: string;
  tenant_id: string;
  order_number: string;
  status: string;
  version: number;
  confirmed_due_date: string | null;
  finished_at: string | null;
};

type PickupEventContractRow = {
  event_id: string;
  order_id: string;
  tenant_id: string;
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

const READ_PERMISSION = "perm_view_leitstand";
const CALENDAR_DAY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const UNAVAILABLE_MESSAGE = "Termintreue-Fakten konnten nicht sicher geladen werden.";

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function isCalendarDay(value: unknown): value is string {
  if (typeof value !== "string" || !CALENDAR_DAY_PATTERN.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

function normalizeRange(value: unknown): OrderTimelinessRange | null {
  if (!isPlainObject(value)) return null;
  const keys = Object.keys(value).sort();
  if (keys.length !== 2 || keys[0] !== "from" || keys[1] !== "to") return null;
  if (!isCalendarDay(value.from) || !isCalendarDay(value.to) || value.from > value.to) {
    return null;
  }
  return { from: value.from, to: value.to };
}

function diagnosticField(error: unknown, key: "message" | "details" | "hint"): string | null {
  if (!error || typeof error !== "object") return null;
  const record = error as Record<string, unknown>;
  const cause = record.cause && typeof record.cause === "object"
    ? record.cause as Record<string, unknown>
    : record;
  const value = cause[key] ?? (key === "details" ? cause.detail : null);
  if (typeof value !== "string" || value.length === 0) return null;
  if (/\b(?:select|insert|update|delete)\b|params:/i.test(value)) {
    return "DATABASE_OPERATION_FAILED";
  }
  return value.replace(/\s+/g, " ").slice(0, 500);
}

function orderInput(row: OrderContractRow): OrderTimelinessOrderInput {
  return {
    orderId: row.id,
    tenantId: row.tenant_id,
    orderNumber: row.order_number,
    orderVersion: row.version,
    lifecycleStatus: row.status,
    confirmedDueDate: row.confirmed_due_date,
    finishedAt: row.finished_at,
  };
}

function eventInput(row: PickupEventContractRow): OrderTimelinessPickupEventInput {
  return {
    eventId: row.event_id,
    tenantId: row.tenant_id,
    orderId: row.order_id,
    eventType: row.event_type,
    status: row.status,
    fromStation: row.from_station,
    station: row.station,
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
): Promise<readonly OrderTimelinessFact[]> {
  const orderRows = await tx.execute<OrderContractRow>(sql`
    SELECT
      contract.id,
      contract.tenant_id,
      contract.order_number,
      contract.status,
      contract.version,
      to_char(contract.due_date::date, 'YYYY-MM-DD') AS confirmed_due_date,
      CASE
        WHEN contract.completed_date IS NULL THEN NULL
        ELSE to_char(
          contract.completed_date AT TIME ZONE 'UTC',
          'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'
        )
      END AS finished_at
    FROM public.v_order_timeliness_orders_v1 contract
    WHERE contract.tenant_id = ${tenantId}
      AND contract.due_date::date >= (${range.from})::date
      AND contract.due_date::date <= (${range.to})::date
    ORDER BY contract.due_date, contract.id
  `);

  const seenOrderIds = new Set<string>();
  for (const row of orderRows) {
    if (seenOrderIds.has(row.id)) throw new Error("ORDER_TIMELINESS_ORDER_AMBIGUOUS");
    seenOrderIds.add(row.id);
  }
  if (orderRows.length === 0) return [];

  const orderIds = orderRows.map((row) => row.id);
  const orderIdList = sql.join(orderIds.map((id) => sql`${id}`), sql`, `);
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
      CASE
        WHEN contract.created_at IS NULL THEN NULL
        ELSE to_char(contract.created_at, 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')
      END AS created_at
    FROM public.v_order_timeliness_pickup_events_v1 contract
    WHERE contract.tenant_id = ${tenantId}
      AND contract.order_id IN (${orderIdList})
    ORDER BY contract.order_id, contract.created_at, contract.event_id
  `);

  const eventsByOrder = new Map<string, OrderTimelinessPickupEventInput[]>();
  for (const row of eventRows) {
    if (!seenOrderIds.has(row.order_id)) throw new Error("ORDER_TIMELINESS_EVENT_ORPHANED");
    const events = eventsByOrder.get(row.order_id) ?? [];
    events.push(eventInput(row));
    eventsByOrder.set(row.order_id, events);
  }

  return orderRows.map((row) => deriveOrderTimelinessFact({
    tenantId,
    order: orderInput(row),
    pickupEvents: eventsByOrder.get(row.id) ?? [],
  }));
}

export async function getOrderTimelinessFacts(
  input: unknown,
): Promise<OrderTimelinessFactsResult> {
  const range = normalizeRange(input);
  if (!range) {
    return { code: "VALIDATION_ERROR", message: "Der Auswertungszeitraum ist ungültig." };
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
  if (!authorization.data.permissions.includes(READ_PERMISSION)) {
    return { code: "FORBIDDEN", message: "Termintreue-Auswertung ist nicht erlaubt." };
  }

  try {
    const facts = await withPrivilegedTenantTransaction(
      authorization.data,
      (tx) => readFacts(tx, authorization.data.tenantId, range),
    );
    return {
      code: "OK",
      data: {
        schemaVersion: 1,
        range,
        generatedAt: new Date().toISOString(),
        facts,
      },
    };
  } catch (error) {
    console.error("order_timeliness_read_failed", {
      message: diagnosticField(error, "message"),
      details: diagnosticField(error, "details"),
      hint: diagnosticField(error, "hint"),
    });
    return { code: "UNAVAILABLE", message: UNAVAILABLE_MESSAGE };
  }
}
