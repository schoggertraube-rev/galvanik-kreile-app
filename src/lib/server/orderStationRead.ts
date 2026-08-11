import "server-only";

import { sql } from "drizzle-orm";
import { evaluateOrderPriority } from "@/lib/priority";
import type { OperationalOrder, OperationalOrderItem } from "@/lib/types/operationalOrder";
import type { AuthorizationSnapshot } from "@/lib/server/authorization";
import type { OrderStationTransitionReceipt } from "@/lib/server/commands/orderStationCommand";
import { withPrivilegedTenantTransaction } from "@/lib/server/privilegedDb";

type Station = "wareneingang" | "galvanik";
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

type QueueRow = {
  id: string;
  tenant_id: string;
  version: number;
  order_number: string;
  customer_id: string;
  customer_name: string | null;
  title: string;
  task: string | null;
  station: string;
  current_station: string | null;
  current_station_id: string | null;
  status: string;
  risk: string | null;
  intake_date: Date | string | null;
  due_date: Date | string | null;
  created_at: Date | string | null;
  tenant_integrity_ok: boolean;
  parts: unknown;
};

type QueueCountRow = {
  order_count: number | string;
  invalid_count: number | string;
};

type ReceiptRow = {
  event_id: string;
  tenant_id: string;
  order_id: string;
  client_event_id: string;
  correlation_id: string;
  event_schema_version: number;
  aggregate_version: number;
  from_station: string;
  to_station: string;
  actor_id: string;
  occurred_at: Date | string;
};

export type OrderStationReceiptReadInput = {
  orderId: string;
  clientEventId: string;
};

function toSafeIsoDate(value: Date | string | null | undefined): string {
  if (value === null || value === undefined) return "";
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? "" : parsed.toISOString();
}

function isPositiveVersion(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value > 0;
}

function isNullableString(value: unknown): value is string | null {
  return value === null || typeof value === "string";
}

function isNullableNonBlankString(value: unknown): value is string | null {
  return value === null || (typeof value === "string" && value.trim().length > 0);
}

function parseParts(value: unknown, row: QueueRow): OperationalOrderItem[] {
  if (!Array.isArray(value)) {
    throw new Error("ORDER_ITEM_READMODEL_INVALID");
  }

  return value.map((candidate) => {
    if (candidate === null || typeof candidate !== "object") {
      throw new Error("ORDER_ITEM_READMODEL_INVALID");
    }
    const item = candidate as Record<string, unknown>;
    const createdAt = new Date(String(item.createdAt ?? ""));
    if (
      typeof item.id !== "string" ||
      item.tenantId !== row.tenant_id ||
      item.orderId !== row.id ||
      item.customerId !== row.customer_id ||
      typeof item.name !== "string" ||
      typeof item.quantity !== "number" ||
      Number.isNaN(createdAt.getTime())
    ) {
      throw new Error("ORDER_ITEM_OWNERSHIP_INVALID");
    }

    return {
      id: item.id,
      tenantId: item.tenantId,
      orderId: item.orderId,
      customerId: item.customerId,
      name: item.name,
      quantity: item.quantity,
      currentStationId: typeof item.currentStationId === "string" ? item.currentStationId : null,
      material: typeof item.material === "string" ? item.material : null,
      surfaceRequested: typeof item.surfaceRequested === "string" ? item.surfaceRequested : null,
      photoIds: Array.isArray(item.photoIds) && item.photoIds.every((id) => typeof id === "string")
        ? item.photoIds
        : null,
      photo: typeof item.photo === "string" ? item.photo : null,
      repairTypes: Array.isArray(item.repairTypes) && item.repairTypes.every((entry) => typeof entry === "string")
        ? item.repairTypes
        : null,
      stationSequence: item.stationSequence,
      currentStep: typeof item.currentStep === "number" ? item.currentStep : null,
      internalNotes: typeof item.internalNotes === "string" ? item.internalNotes : null,
      createdAt,
    };
  });
}

function mapOperationalQueueRow(row: QueueRow, tenantId: string): OperationalOrder {
  const stationValues = [row.station, row.current_station, row.current_station_id]
    .filter((value): value is string => typeof value === "string");

  if (row.tenant_id !== tenantId || row.tenant_integrity_ok !== true) {
    throw new Error("ORDER_OWNERSHIP_INVALID");
  }

  if (
    typeof row.id !== "string" ||
    row.id.length === 0 ||
    !isPositiveVersion(row.version) ||
    typeof row.order_number !== "string" ||
    row.order_number.length === 0 ||
    typeof row.customer_id !== "string" ||
    row.customer_id.length === 0 ||
    !isNullableString(row.customer_name) ||
    typeof row.title !== "string" ||
    row.title.length === 0 ||
    !isNullableString(row.task) ||
    typeof row.station !== "string" ||
    row.station.trim().length === 0 ||
    !isNullableNonBlankString(row.current_station) ||
    !isNullableNonBlankString(row.current_station_id) ||
    stationValues.some((value) => value !== stationValues[0]) ||
    typeof row.status !== "string" ||
    row.status.length === 0 ||
    !isNullableString(row.risk)
  ) {
    throw new Error("ORDER_READMODEL_INVALID");
  }

  const parts = parseParts(row.parts, row);
  const dueDate = toSafeIsoDate(row.due_date);
  const priority = evaluateOrderPriority({
    dueDate,
    risk: row.risk || undefined,
    isBlocked: row.status === "blocked" || row.risk === "blocked",
  });
  const currentStationId = row.station;

  return {
    id: row.id,
    version: row.version,
    orderNumber: row.order_number,
    customerId: row.customer_id,
    customerName: row.customer_name,
    title: row.title,
    task: row.task,
    itemDescription: row.task || parts[0]?.name || null,
    surfaceRequested: parts[0]?.surfaceRequested || null,
    station: currentStationId,
    status: row.status,
    statusText: priority.statusText,
    risk: priority.risk,
    currentStationId,
    parts,
    intakeDate: toSafeIsoDate(row.intake_date),
    dueDate,
    dueLabel: priority.dueLabel,
    dueValue: priority.dueValue,
    createdAt: toSafeIsoDate(row.created_at) || undefined,
  };
}

function mapOperationalQueueRows(rows: QueueRow[], tenantId: string): OperationalOrder[] {
  return rows.map((row) => mapOperationalQueueRow(row, tenantId));
}

function parseSafeCount(value: number | string): number {
  const parsed = typeof value === "number" ? value : Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < 0) {
    throw new Error("ORDER_COUNT_READMODEL_INVALID");
  }
  return parsed;
}

/** Fresh per invocation, tenant-bound full operational read port. */
export async function readTenantOperationalOrders(
  authorization: Pick<AuthorizationSnapshot, "tenantId">,
): Promise<OperationalOrder[]> {
  return withPrivilegedTenantTransaction(authorization, async (tx) => {
    const rows = await tx.execute<QueueRow>(sql`
      SELECT *
      FROM private.v_operational_station_queue_v1
      ORDER BY created_at DESC, id
    `);
    return mapOperationalQueueRows(rows, authorization.tenantId);
  });
}

/** Count from the same tenant-bound v1 read port; any corrupt aggregate fails closed. */
export async function readTenantOperationalOrderCount(
  authorization: Pick<AuthorizationSnapshot, "tenantId">,
): Promise<number> {
  return withPrivilegedTenantTransaction(authorization, async (tx) => {
    const rows = await tx.execute<QueueCountRow>(sql`
      SELECT
        count(*)::int AS order_count,
        count(*) FILTER (
          WHERE tenant_id IS DISTINCT FROM ${authorization.tenantId}
             OR tenant_integrity_ok IS NOT TRUE
             OR version IS NULL
             OR version <= 0
             OR nullif(btrim(id), '') IS NULL
             OR nullif(btrim(order_number), '') IS NULL
             OR nullif(btrim(customer_id), '') IS NULL
             OR nullif(btrim(title), '') IS NULL
             OR nullif(btrim(station), '') IS NULL
             OR nullif(btrim(status), '') IS NULL
             OR (current_station IS NOT NULL AND nullif(btrim(current_station), '') IS NULL)
             OR (current_station_id IS NOT NULL AND nullif(btrim(current_station_id), '') IS NULL)
             OR (current_station IS NOT NULL AND current_station IS DISTINCT FROM station)
             OR (current_station_id IS NOT NULL AND current_station_id IS DISTINCT FROM station)
        )::int AS invalid_count
      FROM private.v_operational_station_queue_v1
    `);
    if (rows.length !== 1 || !rows[0]) {
      throw new Error("ORDER_COUNT_READMODEL_INVALID");
    }
    const count = parseSafeCount(rows[0].order_count);
    if (parseSafeCount(rows[0].invalid_count) !== 0) {
      throw new Error("ORDER_OWNERSHIP_INVALID");
    }
    return count;
  });
}

/**
 * Fresh, tenant-bound W3 station read. Its station is internal and selected only
 * by a server action after authorization; it is never a client supplied route value.
 */
export async function readTenantStationOrders(
  authorization: Pick<AuthorizationSnapshot, "tenantId">,
  station: Station,
): Promise<OperationalOrder[]> {
  const { tenantId } = authorization;
  return withPrivilegedTenantTransaction({ tenantId }, async (tx) => {
    const rows = await tx.execute<QueueRow>(station === "galvanik" ? sql`
      SELECT *
      FROM private.v_operational_station_queue_v1
      WHERE station = 'galvanik'
        AND current_station = 'galvanik'
        AND current_station_id = 'galvanik'
      ORDER BY created_at DESC
    ` : sql`
      SELECT *
      FROM private.v_operational_station_queue_v1
      WHERE station = 'wareneingang'
        AND (current_station = 'wareneingang' OR current_station IS NULL)
        AND (current_station_id = 'wareneingang' OR current_station_id IS NULL)
      ORDER BY created_at DESC
    `);

    return mapOperationalQueueRows(rows, tenantId);
  });
}

export async function readTenantOrderStationReceipt(
  authorization: Pick<AuthorizationSnapshot, "tenantId">,
  input: OrderStationReceiptReadInput,
): Promise<OrderStationTransitionReceipt | null> {
  if (
    !input ||
    typeof input.orderId !== "string" ||
    input.orderId.trim().length === 0 ||
    typeof input.clientEventId !== "string" ||
    !UUID_PATTERN.test(input.clientEventId)
  ) {
    throw new Error("ORDER_STATION_RECEIPT_INPUT_INVALID");
  }

  return withPrivilegedTenantTransaction(authorization, async (tx) => {
    const rows = await tx.execute<ReceiptRow>(sql`
      SELECT *
      FROM private.v_order_station_receipts_v1
      WHERE order_id = ${input.orderId}
        AND client_event_id = ${input.clientEventId}
      LIMIT 2
    `);

    if (rows.length === 0) return null;
    const row = rows[0];
    const occurredAt = row ? toSafeIsoDate(row.occurred_at) : "";
    if (
      rows.length !== 1 ||
      !row ||
      row.tenant_id !== authorization.tenantId ||
      row.order_id !== input.orderId ||
      row.client_event_id !== input.clientEventId ||
      !UUID_PATTERN.test(row.correlation_id) ||
      row.event_schema_version !== 1 ||
      !isPositiveVersion(row.aggregate_version) ||
      row.from_station !== "wareneingang" ||
      row.to_station !== "galvanik" ||
      !UUID_PATTERN.test(row.actor_id) ||
      !occurredAt
    ) {
      throw new Error("ORDER_STATION_RECEIPT_INVALID");
    }

    return {
      eventId: row.event_id,
      clientEventId: row.client_event_id,
      correlationId: row.correlation_id,
      eventSchemaVersion: 1,
      orderId: row.order_id,
      aggregateVersion: row.aggregate_version,
      fromStation: "wareneingang",
      toStation: "galvanik",
      actorId: row.actor_id,
      occurredAt,
    };
  });
}
