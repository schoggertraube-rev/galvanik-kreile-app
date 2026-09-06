import "server-only";

import { randomUUID } from "node:crypto";
import { sql } from "drizzle-orm";
import { resolveAuthorization } from "@/lib/server/authorization";
import { KREILE_TENANT_SLUG } from "@/lib/tenant";
import {
  isPaymentMode,
  type PaymentMode,
} from "@/lib/server/paymentContract";
import {
  withPrivilegedTenantTransaction,
  type PrivilegedTenantTransaction,
} from "@/lib/server/privilegedDb";

const EVENT_TYPE = "PAYMENT_MODE_SET_V1" as const;
const EVENT_SCHEMA_VERSION = 1 as const;
const PAYMENT_MODE_ROLES = ["buero", "meister", "admin"] as const;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const ISO_INSTANT_PATTERN = /^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}\.[0-9]{3}Z$/;
const MAX_INT4 = 2_147_483_647;

export type SetPaymentModeInput = {
  orderId: string;
  paymentMode: PaymentMode;
  expectedVersion: number;
  clientEventId: string;
};

export type SetPaymentModeReceipt = {
  eventId: string;
  orderId: string;
  receiptId: string;
  clientEventId: string;
  correlationId: string;
  eventSchemaVersion: 1;
  expectedVersion: number;
  paymentModeVersion: number;
  previousPaymentMode: PaymentMode;
  paymentMode: PaymentMode;
  changedAt: string;
  changedBy: string;
};

export type SetPaymentModeResult =
  | { code: "OK"; receipt: SetPaymentModeReceipt; replayed: boolean }
  | { code: "UNAUTHENTICATED"; message: string }
  | { code: "FORBIDDEN"; message: string }
  | { code: "NOT_FOUND"; message: string }
  | { code: "CONFLICT"; message: string }
  | { code: "VALIDATION_ERROR"; message: string }
  | { code: "UNAVAILABLE"; message: string };

type PaymentModeOrderRow = {
  id: string;
  tenant_id: string;
  station: string | null;
  current_station: string | null;
  current_station_id: string | null;
  status: string | null;
  payment_mode: string;
  payment_mode_version: number | string;
};

type PaymentModeEventRow = {
  event_id: string;
  tenant_id: string | null;
  order_id: string | null;
  event_type: string;
  client_event_id: string | null;
  correlation_id: string | null;
  event_schema_version: number | string | null;
  aggregate_version: number | string | null;
  actor_id: string | null;
  occurred_at: Date | string | null;
  status: string | null;
  station: string | null;
  from_station: string | null;
  payload: unknown;
};

function isCanonicalTextId(value: unknown): value is string {
  return typeof value === "string"
    && value.trim() === value
    && value.length >= 1
    && value.length <= 128;
}

function toNonNegativeInteger(value: unknown): number | null {
  if (typeof value !== "number" && typeof value !== "string") return null;
  if (typeof value === "string" && (value.length === 0 || value.trim() !== value)) return null;
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isSafeInteger(parsed) && parsed >= 0 && parsed <= MAX_INT4 ? parsed : null;
}

function toIsoInstant(value: unknown): string | null {
  if (!(value instanceof Date) && typeof value !== "string") return null;
  const parsed = value instanceof Date ? value : new Date(value);
  if (!Number.isFinite(parsed.getTime())) return null;
  return parsed.toISOString();
}

function exactKeys(value: Record<string, unknown>, expected: readonly string[]): boolean {
  const actual = Object.keys(value).sort();
  const wanted = [...expected].sort();
  return actual.length === wanted.length && actual.every((key, index) => key === wanted[index]);
}

function isValidInput(input: unknown): input is SetPaymentModeInput {
  if (!input || typeof input !== "object" || Array.isArray(input)) return false;
  const value = input as Record<string, unknown>;
  return exactKeys(value, ["clientEventId", "expectedVersion", "orderId", "paymentMode"])
    && isCanonicalTextId(value.orderId)
    && typeof value.clientEventId === "string"
    && UUID_PATTERN.test(value.clientEventId)
    && isPaymentMode(value.paymentMode)
    && typeof value.expectedVersion === "number"
    && Number.isSafeInteger(value.expectedVersion)
    && value.expectedVersion >= 0
    && value.expectedVersion < MAX_INT4;
}

function parsePaymentModeEvent(row: PaymentModeEventRow, tenantId: string): SetPaymentModeReceipt {
  if (!row.payload || typeof row.payload !== "object" || Array.isArray(row.payload)) {
    throw new Error("PAYMENT_MODE_RECEIPT_PAYLOAD_INVALID");
  }
  const payload = row.payload as Record<string, unknown>;
  const expectedVersion = toNonNegativeInteger(payload.expectedVersion);
  const paymentModeVersion = toNonNegativeInteger(payload.paymentModeVersion);
  const aggregateVersion = toNonNegativeInteger(row.aggregate_version);
  const eventSchemaVersion = toNonNegativeInteger(row.event_schema_version);
  const occurredAt = toIsoInstant(row.occurred_at);
  if (
    row.event_type !== EVENT_TYPE || row.tenant_id !== tenantId || row.status !== "success" ||
    row.station !== null || row.from_station !== null || eventSchemaVersion !== EVENT_SCHEMA_VERSION ||
    aggregateVersion === null || paymentModeVersion === null || expectedVersion === null ||
    aggregateVersion !== paymentModeVersion || expectedVersion + 1 !== paymentModeVersion ||
    !UUID_PATTERN.test(row.event_id) || typeof row.client_event_id !== "string" ||
    !UUID_PATTERN.test(row.client_event_id) || typeof row.correlation_id !== "string" ||
    !UUID_PATTERN.test(row.correlation_id) || typeof row.actor_id !== "string" ||
    !UUID_PATTERN.test(row.actor_id) || !exactKeys(payload, [
      "expectedVersion", "occurredAt", "orderId", "paymentMode", "paymentModeVersion",
      "previousPaymentMode", "receiptId",
    ]) || !isCanonicalTextId(payload.orderId) || payload.orderId !== row.order_id ||
    !isPaymentMode(payload.previousPaymentMode) || !isPaymentMode(payload.paymentMode) ||
    payload.receiptId !== `payment-mode://${payload.orderId}/${paymentModeVersion}` ||
    typeof payload.occurredAt !== "string" || !ISO_INSTANT_PATTERN.test(payload.occurredAt) ||
    occurredAt !== payload.occurredAt
  ) {
    throw new Error("PAYMENT_MODE_RECEIPT_INVALID");
  }

  return {
    eventId: row.event_id,
    orderId: payload.orderId,
    receiptId: payload.receiptId,
    clientEventId: row.client_event_id,
    correlationId: row.correlation_id,
    eventSchemaVersion: EVENT_SCHEMA_VERSION,
    expectedVersion,
    paymentModeVersion,
    previousPaymentMode: payload.previousPaymentMode,
    paymentMode: payload.paymentMode,
    changedAt: payload.occurredAt,
    changedBy: row.actor_id,
  };
}

function receiptMatchesIntent(
  receipt: SetPaymentModeReceipt,
  input: SetPaymentModeInput,
  actorId: string,
): boolean {
  return receipt.orderId === input.orderId
    && receipt.paymentMode === input.paymentMode
    && receipt.expectedVersion === input.expectedVersion
    && receipt.clientEventId === input.clientEventId
    && receipt.changedBy === actorId;
}

async function readEventsByClientId(
  tx: PrivilegedTenantTransaction,
  tenantId: string,
  clientEventId: string,
): Promise<PaymentModeEventRow[]> {
  return tx.execute<PaymentModeEventRow>(sql`
    SELECT
      id AS event_id,
      tenant_id,
      order_id,
      event_type,
      client_event_id::text,
      correlation_id::text,
      event_schema_version,
      aggregate_version,
      user_id::text AS actor_id,
      to_char(created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') AS occurred_at,
      status,
      station,
      from_station,
      payload
    FROM public.events
    WHERE tenant_id = ${tenantId}
      AND client_event_id = ${clientEventId}::uuid
    LIMIT 2
  `);
}

async function readOrder(
  tx: PrivilegedTenantTransaction,
  tenantId: string,
  orderId: string,
  lock: boolean,
): Promise<PaymentModeOrderRow[]> {
  const base = sql`
    SELECT
      id,
      tenant_id,
      station,
      current_station,
      current_station_id,
      status,
      payment_mode,
      payment_mode_version
    FROM public.orders
    WHERE id = ${orderId}
      AND tenant_id = ${tenantId}
    LIMIT 2
  `;
  if (!lock) return tx.execute<PaymentModeOrderRow>(base);
  return tx.execute<PaymentModeOrderRow>(sql`${base} FOR UPDATE`);
}

function orderStateMatchesReceipt(order: PaymentModeOrderRow, receipt: SetPaymentModeReceipt): boolean {
  const version = toNonNegativeInteger(order.payment_mode_version);
  if (order.id !== receipt.orderId || !isPaymentMode(order.payment_mode) || version === null) return false;
  return version === receipt.paymentModeVersion
    ? order.payment_mode === receipt.paymentMode
    : version > receipt.paymentModeVersion;
}

async function hasGoodsOut(
  tx: PrivilegedTenantTransaction,
  tenantId: string,
  order: PaymentModeOrderRow,
): Promise<boolean> {
  if (
    order.station === "abgeholt" || order.current_station === "abgeholt" ||
    order.current_station_id === "abgeholt" || order.status === "abgeholt"
  ) return true;
  const rows = await tx.execute<{ has_goods_out: boolean }>(sql`
    SELECT EXISTS (
      SELECT 1
      FROM public.events
      WHERE tenant_id = ${tenantId}
        AND order_id = ${order.id}
        AND event_type = 'ORDER_PICKED_UP_V1'
    ) AS has_goods_out
  `);
  if (rows.length !== 1 || typeof rows[0]?.has_goods_out !== "boolean") {
    throw new Error("PAYMENT_MODE_GOODS_OUT_READBACK_INVALID");
  }
  return rows[0].has_goods_out;
}

export async function setPaymentMode(input: unknown): Promise<SetPaymentModeResult> {
  if (!isValidInput(input)) {
    return { code: "VALIDATION_ERROR", message: "Ungültige Zahlungsmodus-Anfrage." };
  }

  let authorization;
  try {
    authorization = await resolveAuthorization();
  } catch {
    return { code: "UNAVAILABLE", message: "Zahlungsmodus konnte nicht sicher geändert werden." };
  }
  if (!authorization.ok) {
    return authorization.reason === "AUTHORIZATION_UNAVAILABLE"
      ? { code: "UNAVAILABLE", message: "Zahlungsmodus konnte nicht sicher geändert werden." }
      : { code: "UNAUTHENTICATED", message: "Sitzung oder Berechtigung ist nicht verfügbar." };
  }
  if (
    authorization.data.tenantId !== KREILE_TENANT_SLUG ||
    !PAYMENT_MODE_ROLES.includes(authorization.data.role as (typeof PAYMENT_MODE_ROLES)[number])
  ) {
    return { code: "FORBIDDEN", message: "Zahlungsmodus darf mit dieser Rolle nicht geändert werden." };
  }

  const tenantId = authorization.data.tenantId;
  const actorId = authorization.data.userId;
  try {
    return await withPrivilegedTenantTransaction(authorization.data, async (tx) => {
      await tx.execute(sql`
        SELECT pg_advisory_xact_lock(
          hashtextextended('f1:payment-mode:client-event:' || ${tenantId} || ':' || ${input.clientEventId}, 0)
        )
      `);

      const existingEvents = await readEventsByClientId(tx, tenantId, input.clientEventId);
      if (existingEvents.length > 0) {
        if (existingEvents.length !== 1 || existingEvents[0]?.event_type !== EVENT_TYPE) {
          return { code: "CONFLICT", message: "Anfragekennung wurde bereits anders verwendet." };
        }
        const receipt = parsePaymentModeEvent(existingEvents[0], tenantId);
        if (!receiptMatchesIntent(receipt, input, actorId)) {
          return { code: "CONFLICT", message: "Anfragekennung wurde bereits anders verwendet." };
        }
        const orderRows = await readOrder(tx, tenantId, input.orderId, false);
        if (orderRows.length !== 1 || !orderRows[0] || !orderStateMatchesReceipt(orderRows[0], receipt)) {
          throw new Error("PAYMENT_MODE_REPLAY_READBACK_INVALID");
        }
        return { code: "OK", receipt, replayed: true };
      }

      const orderRows = await readOrder(tx, tenantId, input.orderId, true);
      const order = orderRows[0];
      if (orderRows.length !== 1 || !order) {
        return { code: "NOT_FOUND", message: "Auftrag nicht verfügbar." };
      }
      if (!isPaymentMode(order.payment_mode) || toNonNegativeInteger(order.payment_mode_version) === null) {
        throw new Error("PAYMENT_MODE_ORDER_STATE_INVALID");
      }
      if (await hasGoodsOut(tx, tenantId, order)) {
        return { code: "CONFLICT", message: "Nach dem Warenausgang kann der Zahlungsmodus nicht geändert werden." };
      }
      const currentVersion = toNonNegativeInteger(order.payment_mode_version);
      if (currentVersion === null) {
        throw new Error("PAYMENT_MODE_ORDER_VERSION_INVALID");
      }
      if (currentVersion !== input.expectedVersion) {
        return { code: "CONFLICT", message: "Zahlungsmodus wurde bereits geändert." };
      }

      if (order.payment_mode === input.paymentMode) {
        return { code: "CONFLICT", message: "Zahlungsmodus ist bereits gesetzt." };
      }

      const paymentModeVersion = currentVersion + 1;
      const receiptId = `payment-mode://${order.id}/${paymentModeVersion}`;
      const correlationId = randomUUID();
      const timeRows = await tx.execute<{ occurred_at: string }>(sql`
        SELECT to_char(clock_timestamp() AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')
          AS occurred_at
      `);
      const changedAt = timeRows.length === 1 ? timeRows[0]?.occurred_at : null;
      if (typeof changedAt !== "string" || !ISO_INSTANT_PATTERN.test(changedAt)) {
        throw new Error("PAYMENT_MODE_TIME_INVALID");
      }

      await tx.execute(sql`SELECT set_config('app.payment_mode_command', 'v1', true)`);
      const updatedRows = await tx.execute<{
        id: string;
        payment_mode: string;
        payment_mode_version: number;
      }>(sql`
        UPDATE public.orders
        SET
          payment_mode = ${input.paymentMode},
          payment_mode_version = ${paymentModeVersion}
        WHERE id = ${order.id}
          AND tenant_id = ${tenantId}
          AND payment_mode = ${order.payment_mode}
          AND payment_mode_version = ${input.expectedVersion}
        RETURNING id, payment_mode, payment_mode_version
      `);
      if (
        updatedRows.length !== 1 || updatedRows[0]?.id !== order.id ||
        updatedRows[0].payment_mode !== input.paymentMode ||
        updatedRows[0].payment_mode_version !== paymentModeVersion
      ) {
        throw new Error("PAYMENT_MODE_UPDATE_FAILED");
      }

      const payload = {
        orderId: order.id,
        receiptId,
        previousPaymentMode: order.payment_mode,
        paymentMode: input.paymentMode,
        expectedVersion: input.expectedVersion,
        paymentModeVersion,
        occurredAt: changedAt,
      };
      const eventRows = await tx.execute<{ event_id: string }>(sql`
        INSERT INTO public.events (
          id, tenant_id, order_id, item_id, event_type, description, user_id,
          payload, status, station, client_event_id, event_schema_version,
          correlation_id, aggregate_version, from_station, created_at
        ) VALUES (
          gen_random_uuid()::text, ${tenantId}, ${order.id}, NULL,
          ${EVENT_TYPE}, 'Zahlungsmodus geändert', ${actorId}::uuid,
          ${JSON.stringify(payload)}::jsonb, 'success', NULL, ${input.clientEventId}::uuid,
          ${EVENT_SCHEMA_VERSION}, ${correlationId}::uuid, ${paymentModeVersion}, NULL,
          ${changedAt}::timestamptz AT TIME ZONE 'UTC'
        )
        RETURNING id AS event_id
      `);
      if (eventRows.length !== 1 || !eventRows[0] || !UUID_PATTERN.test(eventRows[0].event_id)) {
        throw new Error("PAYMENT_MODE_EVENT_INSERT_FAILED");
      }

      const persistedEvents = await readEventsByClientId(tx, tenantId, input.clientEventId);
      if (persistedEvents.length !== 1 || !persistedEvents[0]) {
        throw new Error("PAYMENT_MODE_EVENT_READBACK_MISSING");
      }
      const receipt = parsePaymentModeEvent(persistedEvents[0], tenantId);
      const persistedOrders = await readOrder(tx, tenantId, input.orderId, false);
      if (
        persistedOrders.length !== 1 || !persistedOrders[0] ||
        !receiptMatchesIntent(receipt, input, actorId) ||
        !orderStateMatchesReceipt(persistedOrders[0], receipt) ||
        toNonNegativeInteger(persistedOrders[0].payment_mode_version) !== paymentModeVersion
      ) {
        throw new Error("PAYMENT_MODE_RECEIPT_READBACK_MISMATCH");
      }

      return { code: "OK", receipt, replayed: false };
    });
  } catch {
    return { code: "UNAVAILABLE", message: "Zahlungsmodus konnte nicht sicher geändert werden." };
  }
}
