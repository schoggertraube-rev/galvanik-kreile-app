import "server-only";

import { sql } from "drizzle-orm";
import { resolveAuthorization } from "@/lib/server/authorization";
import { withPrivilegedTenantTransaction } from "@/lib/server/privilegedDb";

const EVENT_TYPE = "ORDER_PROMISED_DUE_DATE_CHANGED_V1" as const;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export type ChangeOrderPromisedDueDateInput = {
  orderId: string;
  expectedVersion: number;
  dueDate: string;
  reason: string;
  clientEventId: string;
};

export type OrderPromisedDueDateReceipt = {
  eventId: string;
  clientEventId: string;
  orderId: string;
  aggregateVersion: number;
  actorId: string;
  occurredAt: string;
  dueDate: string;
  reason: string;
};

export type ChangeOrderPromisedDueDateResult =
  | { code: "OK"; receipt: OrderPromisedDueDateReceipt; replayed: boolean }
  | { code: "UNAUTHENTICATED" | "FORBIDDEN" | "NOT_FOUND" | "CONFLICT" | "VALIDATION_ERROR" | "UNAVAILABLE"; message: string };

type ReceiptRow = {
  event_id: string;
  tenant_id: string;
  order_id: string;
  event_type: string;
  client_event_id: string;
  event_schema_version: number;
  aggregate_version: number;
  actor_id: string;
  occurred_at: Date | string;
  due_date: string;
  reason: string;
};

function validDate(value: unknown): value is string {
  if (typeof value !== "string" || !DATE_PATTERN.test(value)) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

function normalizeReason(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const reason = value.trim();
  return reason.length >= 3 && reason.length <= 500 ? reason : null;
}

function exactInput(value: unknown): value is ChangeOrderPromisedDueDateInput {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const input = value as Record<string, unknown>;
  const keys = Object.keys(input).sort();
  return keys.length === 5
    && keys[0] === "clientEventId"
    && keys[1] === "dueDate"
    && keys[2] === "expectedVersion"
    && keys[3] === "orderId"
    && keys[4] === "reason"
    && typeof input.orderId === "string"
    && input.orderId === input.orderId.trim()
    && input.orderId.length >= 1
    && input.orderId.length <= 128
    && typeof input.expectedVersion === "number"
    && Number.isSafeInteger(input.expectedVersion)
    && input.expectedVersion > 0
    && validDate(input.dueDate)
    && normalizeReason(input.reason) !== null
    && typeof input.clientEventId === "string"
    && UUID_PATTERN.test(input.clientEventId);
}

function toIso(value: Date | string): string {
  const date = value instanceof Date ? value : new Date(value);
  if (!Number.isFinite(date.getTime())) throw new Error("ORDER_PROMISE_TIME_INVALID");
  return date.toISOString();
}

function mapReceipt(row: ReceiptRow, tenantId: string): OrderPromisedDueDateReceipt {
  if (
    row.tenant_id !== tenantId
    || row.event_type !== EVENT_TYPE
    || row.event_schema_version !== 1
    || !UUID_PATTERN.test(row.event_id)
    || !UUID_PATTERN.test(row.client_event_id)
    || !UUID_PATTERN.test(row.actor_id)
    || !Number.isSafeInteger(row.aggregate_version)
    || row.aggregate_version < 1
    || !validDate(row.due_date)
    || typeof row.reason !== "string"
    || normalizeReason(row.reason) !== row.reason
  ) throw new Error("ORDER_PROMISE_RECEIPT_INVALID");
  return {
    eventId: row.event_id,
    clientEventId: row.client_event_id,
    orderId: row.order_id,
    aggregateVersion: row.aggregate_version,
    actorId: row.actor_id,
    occurredAt: toIso(row.occurred_at),
    dueDate: row.due_date,
    reason: row.reason,
  };
}

function receiptMatches(
  receipt: OrderPromisedDueDateReceipt,
  input: ChangeOrderPromisedDueDateInput,
  actorId: string,
  reason: string,
): boolean {
  return receipt.orderId === input.orderId
    && receipt.actorId === actorId
    && receipt.dueDate === input.dueDate
    && receipt.reason === reason
    && receipt.aggregateVersion === input.expectedVersion + 1;
}

export async function changeOrderPromisedDueDate(
  input: ChangeOrderPromisedDueDateInput,
): Promise<ChangeOrderPromisedDueDateResult> {
  if (!exactInput(input)) {
    return { code: "VALIDATION_ERROR", message: "Liefertermin und Grund sind nicht gültig." };
  }
  const reason = normalizeReason(input.reason)!;

  let authorization;
  try {
    authorization = await resolveAuthorization();
  } catch {
    return { code: "UNAVAILABLE", message: "Liefertermin kann derzeit nicht geändert werden." };
  }
  if (!authorization.ok) {
    return authorization.reason === "AUTHORIZATION_UNAVAILABLE"
      ? { code: "UNAVAILABLE", message: "Liefertermin kann derzeit nicht geändert werden." }
      : { code: "UNAUTHENTICATED", message: "Sitzung oder Berechtigung ist nicht verfügbar." };
  }
  if (!authorization.data.permissions.includes("perm_op_status")) {
    return { code: "FORBIDDEN", message: "Der Bereich Aufträge & Werkstatt ist nicht freigegeben." };
  }

  try {
    return await withPrivilegedTenantTransaction(authorization.data, async (tx) => {
      await tx.execute(sql`
        SELECT pg_advisory_xact_lock(
          hashtextextended('f1:client-event:' || ${authorization.data.tenantId} || ':' || ${input.clientEventId}, 0)
        )
      `);

      const readReceipt = () => tx.execute<ReceiptRow>(sql`
        SELECT event.id AS event_id, event.tenant_id, event.order_id, event.event_type,
               event.client_event_id::text AS client_event_id,
               event.event_schema_version, event.aggregate_version,
               event.user_id::text AS actor_id, event.created_at AS occurred_at,
               event.payload ->> 'promisedDueDate' AS due_date, event.notes AS reason
        FROM public.events event
        WHERE event.tenant_id = ${authorization.data.tenantId}
          AND event.client_event_id = ${input.clientEventId}::uuid
        LIMIT 2
      `);
      const replayRows = await readReceipt();
      if (replayRows.length > 0) {
        if (replayRows.length !== 1 || !replayRows[0]) {
          return { code: "CONFLICT" as const, message: "Anfragekennung wurde bereits anders verwendet." };
        }
        let receipt;
        try {
          receipt = mapReceipt(replayRows[0], authorization.data.tenantId);
        } catch {
          return { code: "CONFLICT" as const, message: "Anfragekennung wurde bereits anders verwendet." };
        }
        return receiptMatches(receipt, input, authorization.data.userId, reason)
          ? { code: "OK" as const, receipt, replayed: true }
          : { code: "CONFLICT" as const, message: "Anfragekennung wurde bereits anders verwendet." };
      }

      const orders = await tx.execute<{ id: string; version: number }>(sql`
        SELECT id, version
        FROM public.orders
        WHERE tenant_id = ${authorization.data.tenantId}
          AND id = ${input.orderId}
        FOR UPDATE
      `);
      const order = orders[0];
      if (orders.length !== 1 || !order) {
        return { code: "NOT_FOUND" as const, message: "Auftrag nicht verfügbar." };
      }
      if (order.version !== input.expectedVersion) {
        return { code: "CONFLICT" as const, message: "Auftrag wurde bereits geändert." };
      }

      const resultRows = await tx.execute<{
        result_code: string;
        result_version: number | null;
        replayed: boolean;
      }>(sql`
        SELECT result_code, result_version, replayed
        FROM private.update_order_promised_due_date_v1(
          ${authorization.data.tenantId}, ${authorization.data.userId}::uuid,
          ${input.clientEventId}::uuid, ${input.orderId}, ${input.dueDate}::date, ${reason}
        )
      `);
      const result = resultRows[0];
      if (resultRows.length !== 1 || !result) throw new Error("ORDER_PROMISE_RESULT_INVALID");
      if (result.result_code === "NOT_FOUND") {
        return { code: "NOT_FOUND" as const, message: "Auftrag nicht verfügbar." };
      }
      if (result.result_code !== "OK" || result.result_version !== input.expectedVersion + 1 || result.replayed) {
        return { code: "CONFLICT" as const, message: "Liefertermin konnte nicht eindeutig gespeichert werden." };
      }

      const receiptRows = await readReceipt();
      if (receiptRows.length !== 1 || !receiptRows[0]) throw new Error("ORDER_PROMISE_RECEIPT_MISSING");
      const receipt = mapReceipt(receiptRows[0], authorization.data.tenantId);
      if (!receiptMatches(receipt, input, authorization.data.userId, reason)) {
        throw new Error("ORDER_PROMISE_RECEIPT_MISMATCH");
      }
      return { code: "OK" as const, receipt, replayed: false };
    });
  } catch {
    return { code: "UNAVAILABLE", message: "Liefertermin kann derzeit nicht geändert werden." };
  }
}
