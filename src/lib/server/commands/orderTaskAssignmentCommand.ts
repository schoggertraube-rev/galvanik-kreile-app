import "server-only";

import { sql } from "drizzle-orm";
import { resolveAuthorization } from "@/lib/server/authorization";
import {
  withPrivilegedTenantTransaction,
  type PrivilegedTenantTransaction,
} from "@/lib/server/privilegedDb";

const ASSIGNED_EVENT = "ORDER_TASK_ASSIGNED_V1" as const;
const HANDED_BACK_EVENT = "ORDER_TASK_HANDED_BACK_V1" as const;
const EVENT_SCHEMA_VERSION = 1 as const;
const ASSIGN_ROLES = ["meister", "admin"] as const;
const ASSIGNEE_ROLES = ["buero", "werkstatt", "meister", "admin"] as const;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

export type AssignOrderTaskInput = {
  orderId: string;
  assigneeUserId: string;
  expectedVersion: number;
  clientEventId: string;
};

export type HandBackOrderTaskInput = {
  orderId: string;
  expectedVersion: number;
  clientEventId: string;
};

export type OrderTaskAssignmentReceipt = {
  eventId: string;
  eventType: typeof ASSIGNED_EVENT | typeof HANDED_BACK_EVENT;
  clientEventId: string;
  correlationId: string;
  eventSchemaVersion: 1;
  orderId: string;
  aggregateVersion: number;
  station: string;
  actorId: string;
  occurredAt: string;
  assignmentStateId: string;
  assignedTo: string;
};

export type OrderTaskAssignmentResult =
  | { code: "OK"; receipt: OrderTaskAssignmentReceipt; replayed: boolean }
  | { code: "UNAUTHENTICATED"; message: string }
  | { code: "FORBIDDEN"; message: string }
  | { code: "NOT_FOUND"; message: string }
  | { code: "CONFLICT"; message: string }
  | { code: "VALIDATION_ERROR"; message: string }
  | { code: "UNAVAILABLE"; message: string };

type LockedOrder = {
  id: string;
  tenant_id: string;
  station: string;
  current_station: string | null;
  current_station_id: string | null;
  status: string;
  version: number;
};

type AssignmentStateRow = {
  id: string;
  assigned_to: string;
  active: boolean;
};

type ReceiptRow = {
  event_id: string;
  tenant_id: string;
  order_id: string;
  event_type: string;
  client_event_id: string;
  correlation_id: string;
  event_schema_version: number;
  aggregate_version: number;
  from_station: string;
  station: string;
  actor_id: string;
  occurred_at: Date | string;
  assignment_state_id: string;
  assigned_to: string;
  integrity_ok: boolean;
};

function validId(value: unknown): value is string {
  return typeof value === "string"
    && value === value.trim()
    && value.length >= 1
    && value.length <= 128;
}

function validVersion(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value > 0;
}

function exactAssignInput(value: unknown): value is AssignOrderTaskInput {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const input = value as Record<string, unknown>;
  const keys = Object.keys(input).sort();
  return keys.length === 4
    && keys[0] === "assigneeUserId"
    && keys[1] === "clientEventId"
    && keys[2] === "expectedVersion"
    && keys[3] === "orderId"
    && validId(input.orderId)
    && typeof input.assigneeUserId === "string"
    && UUID_PATTERN.test(input.assigneeUserId)
    && validVersion(input.expectedVersion)
    && typeof input.clientEventId === "string"
    && UUID_PATTERN.test(input.clientEventId);
}

function exactHandBackInput(value: unknown): value is HandBackOrderTaskInput {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const input = value as Record<string, unknown>;
  const keys = Object.keys(input).sort();
  return keys.length === 3
    && keys[0] === "clientEventId"
    && keys[1] === "expectedVersion"
    && keys[2] === "orderId"
    && validId(input.orderId)
    && validVersion(input.expectedVersion)
    && typeof input.clientEventId === "string"
    && UUID_PATTERN.test(input.clientEventId);
}

function toIso(value: unknown): string {
  const date = value instanceof Date ? value : new Date(value as string);
  if (!Number.isFinite(date.getTime())) throw new Error("ORDER_TASK_RECEIPT_TIME_INVALID");
  return date.toISOString();
}

function mapReceipt(row: ReceiptRow, tenantId: string): OrderTaskAssignmentReceipt {
  if (
    row.integrity_ok !== true
    || row.tenant_id !== tenantId
    || ![ASSIGNED_EVENT, HANDED_BACK_EVENT].includes(
      row.event_type as typeof ASSIGNED_EVENT | typeof HANDED_BACK_EVENT,
    )
    || row.event_schema_version !== EVENT_SCHEMA_VERSION
    || row.from_station !== row.station
    || !UUID_PATTERN.test(row.event_id)
    || !UUID_PATTERN.test(row.client_event_id)
    || !UUID_PATTERN.test(row.correlation_id)
    || !UUID_PATTERN.test(row.actor_id)
    || !UUID_PATTERN.test(row.assignment_state_id)
    || !UUID_PATTERN.test(row.assigned_to)
    || !Number.isSafeInteger(row.aggregate_version)
    || row.aggregate_version < 1
  ) throw new Error("ORDER_TASK_RECEIPT_INVALID");

  return {
    eventId: row.event_id,
    eventType: row.event_type as typeof ASSIGNED_EVENT | typeof HANDED_BACK_EVENT,
    clientEventId: row.client_event_id,
    correlationId: row.correlation_id,
    eventSchemaVersion: 1,
    orderId: row.order_id,
    aggregateVersion: row.aggregate_version,
    station: row.station,
    actorId: row.actor_id,
    occurredAt: toIso(row.occurred_at),
    assignmentStateId: row.assignment_state_id,
    assignedTo: row.assigned_to,
  };
}

function orderStateIsConsistent(order: LockedOrder): boolean {
  return order.station.length > 0
    && order.station === order.current_station
    && order.station === order.current_station_id
    && order.station === order.status;
}

async function lockClientEvent(
  tx: PrivilegedTenantTransaction,
  tenantId: string,
  clientEventId: string,
) {
  await tx.execute(sql`
    SELECT pg_advisory_xact_lock(
      hashtextextended('f1:client-event:' || ${tenantId} || ':' || ${clientEventId}, 0)
    )
  `);
}

async function readReceipt(
  tx: PrivilegedTenantTransaction,
  clientEventId: string,
): Promise<ReceiptRow[]> {
  return tx.execute<ReceiptRow>(sql`
    SELECT *
    FROM private.v_order_task_assignment_receipts_v1
    WHERE client_event_id = ${clientEventId}
    LIMIT 2
  `);
}

async function clientEventWasUsed(
  tx: PrivilegedTenantTransaction,
  tenantId: string,
  clientEventId: string,
): Promise<boolean> {
  const rows = await tx.execute<{ id: string }>(sql`
    SELECT id
    FROM public.events
    WHERE tenant_id = ${tenantId}
      AND client_event_id = ${clientEventId}
    LIMIT 1
  `);
  return rows.length > 0;
}

export async function assignOrderTask(input: AssignOrderTaskInput): Promise<OrderTaskAssignmentResult> {
  if (!exactAssignInput(input)) {
    return { code: "VALIDATION_ERROR", message: "Ungültige Zuweisung." };
  }

  let authorization;
  try {
    authorization = await resolveAuthorization();
  } catch {
    return { code: "UNAVAILABLE", message: "Zuweisung ist derzeit nicht verfügbar." };
  }
  if (!authorization.ok) {
    return authorization.reason === "AUTHORIZATION_UNAVAILABLE"
      ? { code: "UNAVAILABLE", message: "Zuweisung ist derzeit nicht verfügbar." }
      : { code: "UNAUTHENTICATED", message: "Sitzung oder Berechtigung ist nicht verfügbar." };
  }
  if (!ASSIGN_ROLES.includes(authorization.data.role as (typeof ASSIGN_ROLES)[number])) {
    return { code: "FORBIDDEN", message: "Zuweisung ist mit dieser Rolle nicht erlaubt." };
  }

  try {
    return await withPrivilegedTenantTransaction(authorization.data, async (tx) => {
      await lockClientEvent(tx, authorization.data.tenantId, input.clientEventId);

      const replayRows = await readReceipt(tx, input.clientEventId);
      if (replayRows.length > 0) {
        if (replayRows.length !== 1 || !replayRows[0]) {
          return { code: "CONFLICT", message: "Anfragekennung wurde bereits anders verwendet." };
        }
        const receipt = mapReceipt(replayRows[0], authorization.data.tenantId);
        return receipt.eventType === ASSIGNED_EVENT
          && receipt.orderId === input.orderId
          && receipt.assignedTo === input.assigneeUserId
          && receipt.actorId === authorization.data.userId
          && receipt.aggregateVersion === input.expectedVersion + 1
          ? { code: "OK", receipt, replayed: true }
          : { code: "CONFLICT", message: "Anfragekennung wurde bereits anders verwendet." };
      }
      if (await clientEventWasUsed(tx, authorization.data.tenantId, input.clientEventId)) {
        return { code: "CONFLICT", message: "Anfragekennung wurde bereits anders verwendet." };
      }

      const orderRows = await tx.execute<LockedOrder>(sql`
        SELECT id, tenant_id, station, current_station, current_station_id, status, version
        FROM public.orders
        WHERE tenant_id = ${authorization.data.tenantId}
          AND id = ${input.orderId}
        FOR UPDATE
      `);
      const order = orderRows[0];
      if (orderRows.length !== 1 || !order) {
        return { code: "NOT_FOUND", message: "Auftrag nicht verfügbar." };
      }
      if (order.version !== input.expectedVersion) {
        return { code: "CONFLICT", message: "Auftrag wurde bereits geändert." };
      }
      if (!orderStateIsConsistent(order)) {
        return { code: "VALIDATION_ERROR", message: "Auftragszustand ist nicht zuweisbar." };
      }

      const assigneeRows = await tx.execute<{
        id: string;
        tenant_id: string;
        role: string;
        active: boolean;
      }>(sql`
        SELECT id::text AS id, tenant_id, role, active
        FROM public.app_users
        WHERE tenant_id = ${authorization.data.tenantId}
          AND id = ${input.assigneeUserId}::uuid
        FOR SHARE
      `);
      const assignee = assigneeRows[0];
      if (
        assigneeRows.length !== 1
        || !assignee
        || assignee.active !== true
        || !ASSIGNEE_ROLES.includes(assignee.role as (typeof ASSIGNEE_ROLES)[number])
      ) {
        return { code: "VALIDATION_ERROR", message: "Zielperson ist nicht zuweisbar." };
      }

      const stateRows = await tx.execute<AssignmentStateRow>(sql`
        SELECT id::text AS id, assigned_to::text AS assigned_to, active
        FROM private.order_task_assignment_state
        WHERE tenant_id = ${authorization.data.tenantId}
          AND order_id = ${order.id}
        FOR UPDATE
      `);
      const state = stateRows[0];
      if (stateRows.length > 1) throw new Error("ORDER_TASK_STATE_AMBIGUOUS");
      if (state?.active === true && state.assigned_to === input.assigneeUserId) {
        return { code: "CONFLICT", message: "Auftrag ist dieser Person bereits zugewiesen." };
      }

      const stateIdRows = state ? [{ id: state.id }] : await tx.execute<{ id: string }>(sql`
        SELECT gen_random_uuid()::text AS id
      `);
      const stateId = stateIdRows[0]?.id;
      if (!stateId || !UUID_PATTERN.test(stateId)) throw new Error("ORDER_TASK_STATE_ID_INVALID");
      const nextVersion = input.expectedVersion + 1;

      const updatedOrders = await tx.execute<{ id: string; version: number }>(sql`
        UPDATE public.orders
        SET version = version + 1
        WHERE tenant_id = ${authorization.data.tenantId}
          AND id = ${order.id}
          AND version = ${input.expectedVersion}
        RETURNING id, version
      `);
      if (updatedOrders.length !== 1 || updatedOrders[0]?.version !== nextVersion) {
        return { code: "CONFLICT", message: "Auftrag wurde bereits geändert." };
      }

      const eventRows = await tx.execute<{ event_id: string }>(sql`
        INSERT INTO public.events (
          id, tenant_id, order_id, item_id, event_type, description, payload,
          status, user_id, station, created_at, client_event_id,
          event_schema_version, correlation_id, aggregate_version, from_station
        ) VALUES (
          gen_random_uuid()::text, ${authorization.data.tenantId}, ${order.id}, NULL,
          ${ASSIGNED_EVENT}, 'Order task assigned',
          ${JSON.stringify({
            assignmentStateId: stateId,
            assignedTo: input.assigneeUserId,
          })}::jsonb,
          'success', ${authorization.data.userId}::uuid, ${order.station},
          clock_timestamp() AT TIME ZONE 'UTC', ${input.clientEventId}::uuid,
          ${EVENT_SCHEMA_VERSION}, gen_random_uuid(), ${nextVersion}, ${order.station}
        )
        RETURNING id AS event_id
      `);
      const eventId = eventRows[0]?.event_id;
      if (eventRows.length !== 1 || !eventId || !UUID_PATTERN.test(eventId)) {
        throw new Error("ORDER_TASK_ASSIGNED_EVENT_INVALID");
      }

      const stateWrite = await tx.execute<{ id: string; order_version: number }>(sql`
        INSERT INTO private.order_task_assignment_state (
          id, tenant_id, order_id, assigned_to, assigned_by, assigned_at,
          active, handed_back_by, handed_back_at, order_version, last_event_id,
          created_at, updated_at
        ) VALUES (
          ${stateId}::uuid, ${authorization.data.tenantId}, ${order.id},
          ${input.assigneeUserId}::uuid, ${authorization.data.userId}::uuid,
          clock_timestamp(), true, NULL, NULL, ${nextVersion}, ${eventId},
          statement_timestamp(), clock_timestamp()
        )
        ON CONFLICT (tenant_id, order_id) DO UPDATE SET
          assigned_to = EXCLUDED.assigned_to,
          assigned_by = EXCLUDED.assigned_by,
          assigned_at = EXCLUDED.assigned_at,
          active = true,
          handed_back_by = NULL,
          handed_back_at = NULL,
          order_version = EXCLUDED.order_version,
          last_event_id = EXCLUDED.last_event_id,
          updated_at = EXCLUDED.updated_at
        RETURNING id::text AS id, order_version
      `);
      if (
        stateWrite.length !== 1
        || stateWrite[0]?.id !== stateId
        || stateWrite[0]?.order_version !== nextVersion
      ) throw new Error("ORDER_TASK_STATE_WRITE_INVALID");

      const receiptRows = await readReceipt(tx, input.clientEventId);
      if (receiptRows.length !== 1 || !receiptRows[0]) throw new Error("ORDER_TASK_RECEIPT_MISSING");
      const receipt = mapReceipt(receiptRows[0], authorization.data.tenantId);
      if (
        receipt.eventType !== ASSIGNED_EVENT
        || receipt.orderId !== input.orderId
        || receipt.assignedTo !== input.assigneeUserId
        || receipt.assignmentStateId !== stateId
        || receipt.actorId !== authorization.data.userId
        || receipt.aggregateVersion !== nextVersion
      ) throw new Error("ORDER_TASK_RECEIPT_MISMATCH");
      return { code: "OK", receipt, replayed: false };
    });
  } catch {
    return { code: "UNAVAILABLE", message: "Zuweisung ist derzeit nicht verfügbar." };
  }
}

export async function handBackOrderTask(input: HandBackOrderTaskInput): Promise<OrderTaskAssignmentResult> {
  if (!exactHandBackInput(input)) {
    return { code: "VALIDATION_ERROR", message: "Ungültige Rückgabe." };
  }

  let authorization;
  try {
    authorization = await resolveAuthorization();
  } catch {
    return { code: "UNAVAILABLE", message: "Rückgabe ist derzeit nicht verfügbar." };
  }
  if (!authorization.ok) {
    return authorization.reason === "AUTHORIZATION_UNAVAILABLE"
      ? { code: "UNAVAILABLE", message: "Rückgabe ist derzeit nicht verfügbar." }
      : { code: "UNAUTHENTICATED", message: "Sitzung oder Berechtigung ist nicht verfügbar." };
  }

  try {
    return await withPrivilegedTenantTransaction(authorization.data, async (tx) => {
      await lockClientEvent(tx, authorization.data.tenantId, input.clientEventId);

      const replayRows = await readReceipt(tx, input.clientEventId);
      if (replayRows.length > 0) {
        if (replayRows.length !== 1 || !replayRows[0]) {
          return { code: "CONFLICT", message: "Anfragekennung wurde bereits anders verwendet." };
        }
        const receipt = mapReceipt(replayRows[0], authorization.data.tenantId);
        return receipt.eventType === HANDED_BACK_EVENT
          && receipt.orderId === input.orderId
          && receipt.assignedTo === authorization.data.userId
          && receipt.actorId === authorization.data.userId
          && receipt.aggregateVersion === input.expectedVersion + 1
          ? { code: "OK", receipt, replayed: true }
          : { code: "CONFLICT", message: "Anfragekennung wurde bereits anders verwendet." };
      }
      if (await clientEventWasUsed(tx, authorization.data.tenantId, input.clientEventId)) {
        return { code: "CONFLICT", message: "Anfragekennung wurde bereits anders verwendet." };
      }

      const orderRows = await tx.execute<LockedOrder>(sql`
        SELECT id, tenant_id, station, current_station, current_station_id, status, version
        FROM public.orders
        WHERE tenant_id = ${authorization.data.tenantId}
          AND id = ${input.orderId}
        FOR UPDATE
      `);
      const order = orderRows[0];
      if (orderRows.length !== 1 || !order) {
        return { code: "NOT_FOUND", message: "Auftrag nicht verfügbar." };
      }
      if (order.version !== input.expectedVersion) {
        return { code: "CONFLICT", message: "Auftrag wurde bereits geändert." };
      }
      if (!orderStateIsConsistent(order)) {
        return { code: "VALIDATION_ERROR", message: "Auftragszustand ist nicht rückgabefähig." };
      }

      const stateRows = await tx.execute<AssignmentStateRow>(sql`
        SELECT id::text AS id, assigned_to::text AS assigned_to, active
        FROM private.order_task_assignment_state
        WHERE tenant_id = ${authorization.data.tenantId}
          AND order_id = ${order.id}
        FOR UPDATE
      `);
      const state = stateRows[0];
      if (stateRows.length !== 1 || !state || state.active !== true) {
        return { code: "VALIDATION_ERROR", message: "Keine aktive Zuweisung vorhanden." };
      }
      if (state.assigned_to !== authorization.data.userId) {
        return { code: "FORBIDDEN", message: "Nur die zugewiesene Person darf zurückgeben." };
      }
      const nextVersion = input.expectedVersion + 1;

      const updatedOrders = await tx.execute<{ id: string; version: number }>(sql`
        UPDATE public.orders
        SET version = version + 1
        WHERE tenant_id = ${authorization.data.tenantId}
          AND id = ${order.id}
          AND version = ${input.expectedVersion}
        RETURNING id, version
      `);
      if (updatedOrders.length !== 1 || updatedOrders[0]?.version !== nextVersion) {
        return { code: "CONFLICT", message: "Auftrag wurde bereits geändert." };
      }

      const eventRows = await tx.execute<{ event_id: string }>(sql`
        INSERT INTO public.events (
          id, tenant_id, order_id, item_id, event_type, description, payload,
          status, user_id, station, created_at, client_event_id,
          event_schema_version, correlation_id, aggregate_version, from_station
        ) VALUES (
          gen_random_uuid()::text, ${authorization.data.tenantId}, ${order.id}, NULL,
          ${HANDED_BACK_EVENT}, 'Order task handed back',
          ${JSON.stringify({
            assignmentStateId: state.id,
            assignedTo: state.assigned_to,
          })}::jsonb,
          'success', ${authorization.data.userId}::uuid, ${order.station},
          clock_timestamp() AT TIME ZONE 'UTC', ${input.clientEventId}::uuid,
          ${EVENT_SCHEMA_VERSION}, gen_random_uuid(), ${nextVersion}, ${order.station}
        )
        RETURNING id AS event_id
      `);
      const eventId = eventRows[0]?.event_id;
      if (eventRows.length !== 1 || !eventId || !UUID_PATTERN.test(eventId)) {
        throw new Error("ORDER_TASK_HANDBACK_EVENT_INVALID");
      }

      const stateWrite = await tx.execute<{ id: string; order_version: number }>(sql`
        UPDATE private.order_task_assignment_state
        SET active = false,
            handed_back_by = ${authorization.data.userId}::uuid,
            handed_back_at = clock_timestamp(),
            order_version = ${nextVersion},
            last_event_id = ${eventId},
            updated_at = clock_timestamp()
        WHERE tenant_id = ${authorization.data.tenantId}
          AND order_id = ${order.id}
          AND id = ${state.id}::uuid
          AND active = true
          AND assigned_to = ${authorization.data.userId}::uuid
        RETURNING id::text AS id, order_version
      `);
      if (
        stateWrite.length !== 1
        || stateWrite[0]?.id !== state.id
        || stateWrite[0]?.order_version !== nextVersion
      ) throw new Error("ORDER_TASK_HANDBACK_STATE_INVALID");

      const receiptRows = await readReceipt(tx, input.clientEventId);
      if (receiptRows.length !== 1 || !receiptRows[0]) throw new Error("ORDER_TASK_RECEIPT_MISSING");
      const receipt = mapReceipt(receiptRows[0], authorization.data.tenantId);
      if (
        receipt.eventType !== HANDED_BACK_EVENT
        || receipt.orderId !== input.orderId
        || receipt.assignedTo !== authorization.data.userId
        || receipt.assignmentStateId !== state.id
        || receipt.actorId !== authorization.data.userId
        || receipt.aggregateVersion !== nextVersion
      ) throw new Error("ORDER_TASK_RECEIPT_MISMATCH");
      return { code: "OK", receipt, replayed: false };
    });
  } catch {
    return { code: "UNAVAILABLE", message: "Rückgabe ist derzeit nicht verfügbar." };
  }
}
