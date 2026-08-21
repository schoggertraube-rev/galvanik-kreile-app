import "server-only";

import { sql } from "drizzle-orm";
import type { AuthorizationSnapshot } from "@/lib/server/authorization";
import type { OrderTaskAssignmentReceipt } from "@/lib/server/commands/orderTaskAssignmentCommand";
import { withPrivilegedTenantTransaction } from "@/lib/server/privilegedDb";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

export type OrderTaskAssignmentState = {
  assignmentStateId: string;
  assignedTo: string;
  assignedToName: string;
  assignedToActive: boolean;
  assignedBy: string;
  assignedByName: string;
  assignedAt: string;
  active: boolean;
  handedBackBy: string | null;
  handedBackByName: string | null;
  handedBackAt: string | null;
  assignmentVersion: number;
  dueAt: string | null;
  isAssignedToCurrentUser: boolean;
};

export type OrderTaskAssigneeOption = {
  userId: string;
  fullName: string;
  role: string;
};

export type OrderTaskAssignmentReadResult<T> =
  | { code: "OK"; data: T }
  | { code: "FORBIDDEN"; message: string }
  | { code: "NOT_FOUND"; message: string }
  | { code: "VALIDATION_ERROR"; message: string }
  | { code: "UNAVAILABLE"; message: string };

type StateRow = {
  id: string;
  tenant_id: string;
  order_id: string;
  assigned_to: string;
  assigned_to_name: string;
  assigned_to_active: boolean;
  assigned_by: string;
  assigned_by_name: string;
  assigned_at: Date | string;
  active: boolean;
  handed_back_by: string | null;
  handed_back_by_name: string | null;
  handed_back_at: Date | string | null;
  order_version: number;
  current_order_version: number;
  due_date: Date | string | null;
  integrity_ok: boolean;
};

type OptionRow = {
  tenant_id: string;
  user_id: string;
  full_name: string;
  role: string;
  active: boolean;
  integrity_ok: boolean;
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

function exactInput(value: unknown, keys: readonly string[]): value is Record<string, string> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const input = value as Record<string, unknown>;
  const actual = Object.keys(input).sort();
  const expected = [...keys].sort();
  return actual.length === expected.length
    && actual.every((key, index) => key === expected[index])
    && expected.every((key) => typeof input[key] === "string");
}

function validOrderId(value: unknown): value is string {
  return typeof value === "string"
    && value === value.trim()
    && value.length >= 1
    && value.length <= 128;
}

function toIso(value: unknown): string {
  const date = value instanceof Date ? value : new Date(value as string);
  if (!Number.isFinite(date.getTime())) throw new Error("ORDER_TASK_READ_TIME_INVALID");
  return date.toISOString();
}

function toNullableIso(value: unknown): string | null {
  return value === null ? null : toIso(value);
}

function mapState(row: StateRow, authorization: AuthorizationSnapshot): OrderTaskAssignmentState {
  if (
    row.integrity_ok !== true
    || row.tenant_id !== authorization.tenantId
    || !UUID_PATTERN.test(row.id)
    || !UUID_PATTERN.test(row.assigned_to)
    || !UUID_PATTERN.test(row.assigned_by)
    || (row.handed_back_by !== null && !UUID_PATTERN.test(row.handed_back_by))
    || row.assigned_to_name.trim().length < 1
    || row.assigned_by_name.trim().length < 1
    || (row.handed_back_by_name !== null && row.handed_back_by_name.trim().length < 1)
    || !Number.isSafeInteger(row.order_version)
    || !Number.isSafeInteger(row.current_order_version)
    || row.order_version < 1
    || row.current_order_version < row.order_version
    || (row.active && (row.handed_back_by !== null || row.handed_back_at !== null))
    || (!row.active && (row.handed_back_by === null || row.handed_back_at === null))
  ) throw new Error("ORDER_TASK_STATE_INVALID");

  return {
    assignmentStateId: row.id,
    assignedTo: row.assigned_to,
    assignedToName: row.assigned_to_name,
    assignedToActive: row.assigned_to_active,
    assignedBy: row.assigned_by,
    assignedByName: row.assigned_by_name,
    assignedAt: toIso(row.assigned_at),
    active: row.active,
    handedBackBy: row.handed_back_by,
    handedBackByName: row.handed_back_by_name,
    handedBackAt: toNullableIso(row.handed_back_at),
    assignmentVersion: row.order_version,
    dueAt: toNullableIso(row.due_date),
    isAssignedToCurrentUser: row.active && row.assigned_to === authorization.userId,
  };
}

function mapOption(row: OptionRow, tenantId: string): OrderTaskAssigneeOption {
  if (
    row.integrity_ok !== true
    || row.tenant_id !== tenantId
    || row.active !== true
    || !UUID_PATTERN.test(row.user_id)
    || row.full_name !== row.full_name.trim()
    || row.full_name.length < 1
    || !["buero", "werkstatt", "meister", "admin"].includes(row.role)
  ) throw new Error("ORDER_TASK_OPTION_INVALID");
  return { userId: row.user_id, fullName: row.full_name, role: row.role };
}

function mapReceipt(row: ReceiptRow, tenantId: string): OrderTaskAssignmentReceipt {
  if (
    row.integrity_ok !== true
    || row.tenant_id !== tenantId
    || !["ORDER_TASK_ASSIGNED_V1", "ORDER_TASK_HANDED_BACK_V1"].includes(row.event_type)
    || row.event_schema_version !== 1
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
    eventType: row.event_type as OrderTaskAssignmentReceipt["eventType"],
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

function canView(authorization: AuthorizationSnapshot): boolean {
  return authorization.permissions.includes("perm_view_leitstand");
}

export async function readOrderTaskAssignment(
  authorization: AuthorizationSnapshot,
  input: { orderId: string },
): Promise<OrderTaskAssignmentReadResult<OrderTaskAssignmentState | null>> {
  if (!exactInput(input, ["orderId"]) || !validOrderId(input.orderId)) {
    return { code: "VALIDATION_ERROR", message: "Ungültige Auftragskennung." };
  }
  if (!canView(authorization)) {
    return { code: "FORBIDDEN", message: "Zuweisung ist nicht erlaubt." };
  }
  try {
    const data = await withPrivilegedTenantTransaction(authorization, async (tx) => {
      const orderRows = await tx.execute<{ id: string }>(sql`
        SELECT id
        FROM private.v_operational_station_queue_v1
        WHERE id = ${input.orderId}
        LIMIT 2
      `);
      if (orderRows.length === 0) return undefined;
      if (orderRows.length !== 1) throw new Error("ORDER_TASK_ORDER_AMBIGUOUS");

      const rows = await tx.execute<StateRow>(sql`
        SELECT id::text AS id, tenant_id, order_id,
               assigned_to::text AS assigned_to, assigned_to_name, assigned_to_active,
               assigned_by::text AS assigned_by, assigned_by_name, assigned_at,
               active, handed_back_by::text AS handed_back_by, handed_back_by_name,
               handed_back_at, order_version, current_order_version,
               due_date::date::text AS due_date, integrity_ok
        FROM private.v_order_task_assignment_v1
        WHERE order_id = ${input.orderId}
        LIMIT 2
      `);
      if (rows.length > 1) throw new Error("ORDER_TASK_STATE_AMBIGUOUS");
      return rows[0] ? mapState(rows[0], authorization) : null;
    });
    return data === undefined
      ? { code: "NOT_FOUND", message: "Auftrag nicht verfügbar." }
      : { code: "OK", data };
  } catch {
    return { code: "UNAVAILABLE", message: "Zuweisung konnte nicht sicher geladen werden." };
  }
}

export async function readOrderTaskAssigneeOptions(
  authorization: AuthorizationSnapshot,
): Promise<OrderTaskAssignmentReadResult<OrderTaskAssigneeOption[]>> {
  if (!canView(authorization) || !["meister", "admin"].includes(authorization.role)) {
    return { code: "FORBIDDEN", message: "Zuweisungsziele sind nicht erlaubt." };
  }
  try {
    const data = await withPrivilegedTenantTransaction(authorization, async (tx) => {
      const rows = await tx.execute<OptionRow>(sql`
        SELECT tenant_id, user_id::text AS user_id, full_name, role, active, integrity_ok
        FROM private.v_order_task_assignee_options_v1
        ORDER BY lower(full_name), user_id
      `);
      return rows.map((row) => mapOption(row, authorization.tenantId));
    });
    return { code: "OK", data };
  } catch {
    return { code: "UNAVAILABLE", message: "Zuweisungsziele konnten nicht sicher geladen werden." };
  }
}

export async function readOrderTaskAssignmentReceipt(
  authorization: AuthorizationSnapshot,
  input: { orderId: string; clientEventId: string },
): Promise<OrderTaskAssignmentReadResult<OrderTaskAssignmentReceipt | null>> {
  if (
    !exactInput(input, ["orderId", "clientEventId"])
    || !validOrderId(input.orderId)
    || !UUID_PATTERN.test(input.clientEventId)
  ) return { code: "VALIDATION_ERROR", message: "Ungültige Belegabfrage." };
  if (!canView(authorization)) {
    return { code: "FORBIDDEN", message: "Zuweisungsbeleg ist nicht erlaubt." };
  }
  try {
    const data = await withPrivilegedTenantTransaction(authorization, async (tx) => {
      const rows = await tx.execute<ReceiptRow>(sql`
        SELECT *
        FROM private.v_order_task_assignment_receipts_v1
        WHERE order_id = ${input.orderId}
          AND client_event_id = ${input.clientEventId}
        LIMIT 2
      `);
      if (rows.length > 1) throw new Error("ORDER_TASK_RECEIPT_AMBIGUOUS");
      return rows[0] ? mapReceipt(rows[0], authorization.tenantId) : null;
    });
    return { code: "OK", data };
  } catch {
    return { code: "UNAVAILABLE", message: "Zuweisungsbeleg konnte nicht sicher geladen werden." };
  }
}
