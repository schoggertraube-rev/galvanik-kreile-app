import "server-only";

import { sql } from "drizzle-orm";
import { isOrderIntakeFreeTextUnit, isOrderIntakeFreeTextPrice } from "@/lib/orderPositionContract";
import { orderPositionQuantityError, orderPositionUnitLabel, orderPositionSurfaceLabel } from "@/lib/orderPositionContract";
import type { AuthorizationSnapshot } from "@/lib/server/authorization";
import type { OrderIntakeExecutionRequested, OrderIntakeSource } from "@/lib/server/commands/orderIntakeCommand";
import type {
  OrderTaskAssigneeOption,
  OrderTaskAssignmentState,
} from "@/lib/server/orderTaskAssignmentRead";
import { withPrivilegedTenantTransaction } from "@/lib/server/privilegedDb";
import type { CustomerAgreementRecord } from "@/modules/customers/public";
import {
  readEffectiveCustomerAgreement,
  readInactiveCustomerAgreementHint,
  type InactiveCustomerAgreementHint,
} from "@/lib/server/effectiveCustomerAgreementRead";

const MAX_ID_LENGTH = 128;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const LEGACY_ITEM_KEYS = ["id", "position", "name", "quantity", "material", "surfaceRequested"] as const;
const CURRENT_ITEM_KEYS = ["catalogServiceId", "id", "material", "name", "position", "quantity", "surfaceRequested", "unit", "unitPriceCents", "vatRateBasisPoints"] as const;
const CURRENT_ITEM_WITH_EXECUTION_KEYS = [...CURRENT_ITEM_KEYS, "executionRequested"] as const;
const EXECUTION_REQUESTED_VALUES = ["hochglanz", "glaenzend", "matt", "gelb_passiviert", "blau_passiviert", "offen"] as const;

export type OrderCardExtraWork = {
  lineId: string;
  catalogPositionId: string;
  catalogPositionName: string;
  minutes: number;
  hourlyRateCents: number | null;
  amountCents: number | null;
  lineVersion: number;
  frozen: boolean;
  frozenAt: string | null;
};

export type OrderCardItem = {
  id: string;
  position: number;
  name: string;
  quantity: number;
  material: string | null;
  surfaceRequested: string;
  executionRequested?: OrderIntakeExecutionRequested | null;
  catalogServiceId: string | null;
  unit: string | null;
  unitPriceCents: number | null;
  vatRateBasisPoints: 0 | 700 | 1900 | null;
  finished: boolean;
  extraWork: OrderCardExtraWork[];
};

export type LiveOrderCard = {
  id: string;
  version: number;
  orderNumber: string;
  customerId: string;
  customerName: string;
  customerNumber?: string | null;
  customerPhone: string | null;
  title: string;
  note: string | null;
  station: string;
  status: string;
  dueAt: string | null;
  intakeAt: string;
  intakeSource?: OrderIntakeSource | null;
  handoverMode: "pickup" | "shipping" | null;
  assignment: OrderTaskAssignmentState | null;
  assignmentOptions: OrderTaskAssigneeOption[];
  dueDateChanges: Array<{
    eventId: string;
    changedTo: string;
    reason: string;
    changedAt: string;
    changedBy: string;
    aggregateVersion: number;
  }>;
  labelPrints: Array<{
    eventId: string;
    occurredAt: string;
  }>;
  items: OrderCardItem[];
  freeze: null | {
    freezeId: string;
    rateId: string;
    hourlyRateCents: number | null;
    totalAmountCents: number | null;
    lineCount: number;
    frozenAt: string;
  };
  agreement: CustomerAgreementRecord | null;
  agreementHint: InactiveCustomerAgreementHint | null;
};

export type ExtraWorkMasterData = {
  currentRate: null | {
    id: string;
    hourlyRateCents: number;
    version: number;
    effectiveAt: string;
  };
  catalog: Array<{
    id: string;
    name: string;
    standardMinutes: number;
    active: boolean;
    version: number;
    updatedAt: string;
  }>;
};

export type OrderCardReadResult<T> =
  | { code: "OK"; data: T }
  | { code: "FORBIDDEN"; message: string }
  | { code: "NOT_FOUND"; message: string }
  | { code: "VALIDATION_ERROR"; message: string }
  | { code: "UNAVAILABLE"; message: string; errorCode?: string };

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
  intake_date: Date | string | null;
  due_date: Date | string | null;
  created_at: Date | string;
  tenant_integrity_ok: boolean;
  intake_source: OrderIntakeSource | null;
  handover_mode: "pickup" | "shipping" | null;
};

type IntakeRow = {
  tenant_id: string;
  order_id: string;
  customer_id: string;
  items_snapshot: unknown;
  current_order_version: number;
  current_station: string;
  current_status: string;
  integrity_ok: boolean;
};

type CurrentItemRow = {
  id: string;
  name: string;
  quantity: number;
  material: string | null;
  surface_requested: string | null;
  execution_requested: OrderIntakeExecutionRequested | null;
  catalog_service_id: string | null;
  unit: string | null;
  unit_price_cents: number | string | null;
  vat_rate_basis_points: number | null;
  current_station_id: string | null;
};

type ContentEventRow = {
  tenant_id: string;
  order_id: string;
  event_type: string;
  event_schema_version: number;
  aggregate_version: number;
  status: string;
  payload: unknown;
};

type ExtraWorkRow = {
  tenant_id: string;
  order_id: string;
  item_id: string;
  line_id: string;
  catalog_position_id: string;
  catalog_position_name: string;
  minutes: number;
  hourly_rate_cents: number | null;
  amount_cents: number | string | null;
  frozen: boolean;
  line_version: number;
  frozen_at: Date | string | null;
  integrity_ok: boolean;
};

type FreezeRow = {
  tenant_id: string;
  order_id: string;
  aggregate_version: number;
  freeze_id: string;
  rate_id: string;
  hourly_rate_cents: number;
  total_amount_cents: number | string;
  line_count: number;
  frozen_at: Date | string;
  integrity_ok: boolean;
};

type AssignmentRow = {
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

type AssigneeOptionRow = {
  tenant_id: string;
  user_id: string;
  full_name: string;
  role: string;
  active: boolean;
  integrity_ok: boolean;
};

type RateRow = {
  id: string;
  tenant_id: string;
  hourly_rate_cents: number;
  version: number;
  effective_at: Date | string;
  integrity_ok: boolean;
};

type CatalogRow = {
  id: string;
  tenant_id: string;
  name: string;
  standard_minutes: number;
  active: boolean;
  version: number;
  updated_at: Date | string;
  integrity_ok: boolean;
};

type DueDateChangeRow = {
  event_id: string;
  tenant_id: string;
  order_id: string;
  changed_to: string;
  reason: string;
  changed_at: Date | string;
  changed_by: string;
  actor_id: string;
  aggregate_version: number;
  event_schema_version: number;
};

type LabelPrintRow = {
  event_id: string;
  tenant_id: string;
  order_id: string;
  client_event_id: string;
  correlation_id: string;
  event_schema_version: number;
  aggregate_version: number;
  actor_id: string;
  occurred_at: Date | string;
  event_type: string;
  status: string;
  description: string | null;
};

function validId(value: unknown): value is string {
  return typeof value === "string"
    && value.length >= 1
    && value.length <= MAX_ID_LENGTH
    && value.trim() === value;
}

function hasExactKeys(value: unknown, keys: readonly string[]): value is Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const actual = Object.keys(value).sort();
  const expected = [...keys].sort();
  return actual.length === expected.length && actual.every((key, index) => key === expected[index]);
}

function toIso(value: unknown): string {
  const date = value instanceof Date ? value : new Date(value as string);
  if (!Number.isFinite(date.getTime())) throw new Error("ORDER_CARD_TIME_INVALID");
  return date.toISOString();
}

function toNullableIso(value: unknown): string | null {
  return value === null ? null : toIso(value);
}

function toSafeInteger(value: unknown, error: string): number {
  const parsed = typeof value === "number" ? value : Number(value);
  if (!Number.isSafeInteger(parsed)) throw new Error(error);
  return parsed;
}

export function mapOrderCardIntakeItems(value: unknown): OrderCardItem[] {
  if (!Array.isArray(value) || value.length < 1 || value.length > 20) {
    throw new Error("ORDER_CARD_INTAKE_ITEMS_INVALID");
  }
  const items = value.map((entry) => {
    const currentShape = hasExactKeys(entry, CURRENT_ITEM_KEYS);
    const currentShapeWithExecution = hasExactKeys(entry, CURRENT_ITEM_WITH_EXECUTION_KEYS);
    const supportedCurrentShape = currentShape || currentShapeWithExecution;
    if (!hasExactKeys(entry, LEGACY_ITEM_KEYS) && !supportedCurrentShape) {
      throw new Error("ORDER_CARD_INTAKE_ITEM_SHAPE_INVALID");
    }
    const position = toSafeInteger(entry.position, "ORDER_CARD_ITEM_POSITION_INVALID");
    const quantity = typeof entry.quantity === "number" ? entry.quantity : Number.NaN;
    const currentCatalogItem = supportedCurrentShape
      && typeof entry.catalogServiceId === "string"
      && UUID_PATTERN.test(entry.catalogServiceId)
      && typeof entry.unit === "string"
      && entry.unit.trim() === entry.unit
      && entry.unit.length >= 1
      && entry.unit.length <= 40
      && Number.isSafeInteger(entry.unitPriceCents)
      && Number(entry.unitPriceCents) >= 0
      && [0, 700, 1900].includes(Number(entry.vatRateBasisPoints));
    const currentFreeTextItem = supportedCurrentShape
      && entry.catalogServiceId === null
      && (entry.unit === null || (
        typeof entry.unit === "string"
        && isOrderIntakeFreeTextUnit(entry.unit)
      ))
      && isOrderIntakeFreeTextPrice(entry.unitPriceCents, entry.vatRateBasisPoints);
    if (
      typeof entry.id !== "string"
      || !UUID_PATTERN.test(entry.id)
      || position < 1
      || position > 20
      || typeof entry.name !== "string"
      || entry.name.trim() !== entry.name
      || entry.name.length < 1
      || entry.name.length > 200
      || orderPositionQuantityError(quantity, entry.unit as string|null) !== null
      || !(entry.material === null || (
        typeof entry.material === "string"
        && entry.material.trim() === entry.material
        && entry.material.length >= 1
        && entry.material.length <= 120
      ))
      || typeof entry.surfaceRequested !== "string"
      || entry.surfaceRequested.trim() !== entry.surfaceRequested
      || entry.surfaceRequested.length < 2
      || entry.surfaceRequested.length > 160
      || (currentShapeWithExecution && (
        typeof entry.executionRequested !== "string"
        || !EXECUTION_REQUESTED_VALUES.includes(entry.executionRequested as typeof EXECUTION_REQUESTED_VALUES[number])
      ))
      || (supportedCurrentShape && !currentCatalogItem && !currentFreeTextItem)
    ) throw new Error("ORDER_CARD_INTAKE_ITEM_INVALID");

    return {
      id: entry.id,
      position,
      name: entry.name,
      quantity,
      material: entry.material,
      surfaceRequested: orderPositionSurfaceLabel(entry.surfaceRequested),
      ...(currentShapeWithExecution ? { executionRequested: entry.executionRequested as OrderIntakeExecutionRequested } : {}),
      catalogServiceId: currentCatalogItem ? entry.catalogServiceId as string : null,
      unit: currentCatalogItem || currentFreeTextItem ? entry.unit===null?null:orderPositionUnitLabel(entry.unit as string) : null,
      unitPriceCents: entry.unitPriceCents == null ? null : toSafeInteger(entry.unitPriceCents, "ORDER_CARD_ITEM_PRICE_INVALID"),
      vatRateBasisPoints: entry.vatRateBasisPoints == null ? null : toSafeInteger(entry.vatRateBasisPoints, "ORDER_CARD_ITEM_VAT_INVALID") as 0 | 700 | 1900,
      finished: false,
      extraWork: [],
    } satisfies OrderCardItem;
  });
  if (new Set(items.map((item) => item.id)).size !== items.length) {
    throw new Error("ORDER_CARD_ITEM_DUPLICATE");
  }
  return items.sort((left, right) => left.position - right.position);
}

function mapCurrentOrderItems(rows: CurrentItemRow[], positions: Map<string, number>): OrderCardItem[] {
  if (rows.length < 1 || rows.length > 20) throw new Error("ORDER_CARD_CURRENT_ITEMS_INVALID");
  const mapped = rows.map((row) => {
    const position = positions.get(row.id);
    const quantity = Number(row.quantity);
    const price = row.unit_price_cents === null ? null : toSafeInteger(row.unit_price_cents, "ORDER_CARD_ITEM_PRICE_INVALID");
    if (!position || !UUID_PATTERN.test(row.id) || row.name.trim() !== row.name || row.name.length < 1 || row.name.length > 200
      || orderPositionQuantityError(quantity, row.unit) !== null || !row.surface_requested || row.surface_requested.trim() !== row.surface_requested
      || row.surface_requested.length < 2 || row.surface_requested.length > 160
      || (row.catalog_service_id !== null && !UUID_PATTERN.test(row.catalog_service_id))
      || (row.catalog_service_id === null && row.unit !== null && !isOrderIntakeFreeTextUnit(row.unit))
      || (row.vat_rate_basis_points !== null && ![0, 700, 1900].includes(row.vat_rate_basis_points))) throw new Error("ORDER_CARD_CURRENT_ITEM_INVALID");
    return {
      id: row.id, position, name: row.name, quantity, material: row.material,
      surfaceRequested: orderPositionSurfaceLabel(row.surface_requested), catalogServiceId: row.catalog_service_id,
      executionRequested: row.execution_requested,
      unit: row.unit===null?null:orderPositionUnitLabel(row.unit), unitPriceCents: price,
      vatRateBasisPoints: row.vat_rate_basis_points as 0 | 700 | 1900 | null,
      finished: row.current_station_id === "fertig",
      extraWork: [],
    } satisfies OrderCardItem;
  });
  return mapped.sort((left, right) => left.position - right.position);
}

function mapExtraWork(row: ExtraWorkRow, tenantId: string): OrderCardExtraWork & { hourlyRateCents: number; amountCents: number } {
  const minutes = toSafeInteger(row.minutes, "ORDER_CARD_EXTRA_WORK_MINUTES_INVALID");
  const rate = toSafeInteger(row.hourly_rate_cents, "ORDER_CARD_EXTRA_WORK_RATE_INVALID");
  const amount = toSafeInteger(row.amount_cents, "ORDER_CARD_EXTRA_WORK_AMOUNT_INVALID");
  const lineVersion = toSafeInteger(row.line_version, "ORDER_CARD_EXTRA_WORK_VERSION_INVALID");
  if (
    row.integrity_ok !== true
    || row.tenant_id !== tenantId
    || !UUID_PATTERN.test(row.line_id)
    || !UUID_PATTERN.test(row.catalog_position_id)
    || row.catalog_position_name.trim() !== row.catalog_position_name
    || row.catalog_position_name.length < 2
    || row.catalog_position_name.length > 100
    || minutes < 1
    || minutes > 1440
    || rate < 1
    || amount !== Math.floor((minutes * rate + 30) / 60)
    || lineVersion < 1
  ) throw new Error("ORDER_CARD_EXTRA_WORK_INVALID");
  return {
    lineId: row.line_id,
    catalogPositionId: row.catalog_position_id,
    catalogPositionName: row.catalog_position_name,
    minutes,
    hourlyRateCents: rate,
    amountCents: amount,
    lineVersion,
    frozen: row.frozen,
    frozenAt: toNullableIso(row.frozen_at),
  };
}

function mapAssignment(
  row: AssignmentRow,
  authorization: AuthorizationSnapshot,
): OrderTaskAssignmentState {
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
  ) throw new Error("ORDER_CARD_ASSIGNMENT_INVALID");

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

function mapAssigneeOption(row: AssigneeOptionRow, tenantId: string): OrderTaskAssigneeOption {
  if (
    row.integrity_ok !== true
    || row.tenant_id !== tenantId
    || row.active !== true
    || !UUID_PATTERN.test(row.user_id)
    || row.full_name !== row.full_name.trim()
    || row.full_name.length < 1
  ) throw new Error("ORDER_CARD_ASSIGNMENT_OPTION_INVALID");
  return { userId: row.user_id, fullName: row.full_name, role: row.role };
}

function mapDueDateChange(row: DueDateChangeRow, tenantId: string, orderId: string) {
  if (
    row.tenant_id !== tenantId
    || row.order_id !== orderId
    || !UUID_PATTERN.test(row.event_id)
    || !UUID_PATTERN.test(row.actor_id)
    || row.event_schema_version !== 1
    || typeof row.changed_to !== "string"
    || !/^\d{4}-\d{2}-\d{2}$/.test(row.changed_to)
    || typeof row.reason !== "string"
    || row.reason !== row.reason.trim()
    || row.reason.length < 3
    || row.reason.length > 500
    || typeof row.changed_by !== "string"
    || row.changed_by !== row.changed_by.trim()
    || row.changed_by.length < 1
    || !Number.isSafeInteger(row.aggregate_version)
    || row.aggregate_version < 1
  ) throw new Error("ORDER_CARD_DUE_DATE_CHANGE_INVALID");
  return {
    eventId: row.event_id,
    changedTo: row.changed_to,
    reason: row.reason,
    changedAt: toIso(row.changed_at),
    changedBy: row.changed_by,
    aggregateVersion: row.aggregate_version,
  };
}

function mapLabelPrint(row: LabelPrintRow, tenantId: string, orderId: string) {
  if (
    row.tenant_id !== tenantId
    || row.order_id !== orderId
    || row.event_type !== "laufzettel_gedruckt"
    || row.status !== "success"
    || row.description !== "Laufzettel gedruckt"
    || row.event_schema_version !== 1
    || !UUID_PATTERN.test(row.event_id)
    || !UUID_PATTERN.test(row.client_event_id)
    || !UUID_PATTERN.test(row.correlation_id)
    || !UUID_PATTERN.test(row.actor_id)
    || !Number.isSafeInteger(row.aggregate_version)
    || row.aggregate_version < 0
  ) throw new Error("ORDER_CARD_LABEL_PRINT_INVALID");
  return { eventId: row.event_id, occurredAt: toIso(row.occurred_at) };
}

function canView(authorization: AuthorizationSnapshot): boolean {
  return authorization.permissions.includes("perm_view_leitstand");
}

export async function readLiveOrderCard(
  authorization: AuthorizationSnapshot,
  input: { orderId: string },
): Promise<OrderCardReadResult<LiveOrderCard>> {
  if (!hasExactKeys(input, ["orderId"]) || !validId(input.orderId)) {
    return { code: "VALIDATION_ERROR", message: "Ungültige Auftragskennung." };
  }
  if (!canView(authorization)) {
    return { code: "FORBIDDEN", message: "Auftragskarte ist nicht erlaubt." };
  }

  try {
    const data = await withPrivilegedTenantTransaction(authorization, async (tx) => {
      const queueRows = await tx.execute<QueueRow>(sql`
        SELECT id, tenant_id, version, order_number, customer_id, customer_name,
               title, task, station, current_station, current_station_id, status,
               intake_date, due_date::date::text AS due_date, created_at, tenant_integrity_ok,
               (SELECT source.intake_source FROM public.orders source
                WHERE source.id = queue.id AND source.tenant_id = queue.tenant_id) AS intake_source,
               (SELECT source.handover_mode FROM public.orders source
                WHERE source.id = queue.id AND source.tenant_id = queue.tenant_id) AS handover_mode
        FROM private.v_operational_station_queue_v1 queue
        WHERE id = ${input.orderId}
        LIMIT 2
      `);
      const queue = queueRows[0];
      if (queueRows.length === 0) return null;
      if (
        queueRows.length !== 1
        || !queue
        || queue.tenant_id !== authorization.tenantId
        || queue.tenant_integrity_ok !== true
        || queue.station !== queue.current_station
        || queue.station !== queue.current_station_id
        || !validId(queue.customer_id)
        || typeof queue.customer_name !== "string"
        || queue.customer_name.trim().length === 0
        || !Number.isSafeInteger(queue.version)
        || queue.version < 1
        || (queue.handover_mode !== null
          && queue.handover_mode !== "pickup"
          && queue.handover_mode !== "shipping")
      ) throw new Error("ORDER_CARD_QUEUE_INVALID");

      const intakeRows = await tx.execute<IntakeRow>(sql`
        SELECT tenant_id, order_id, customer_id, items_snapshot,
               current_order_version, current_station, current_status, integrity_ok
        FROM private.v_order_intake_receipts_v1
        WHERE order_id = ${input.orderId}
        ORDER BY recorded_at DESC
        LIMIT 2
      `);
      const intake = intakeRows[0];
      if (
        intakeRows.length !== 1
        || !intake
        || intake.tenant_id !== authorization.tenantId
        || intake.order_id !== queue.id
        || intake.customer_id !== queue.customer_id
        || intake.current_order_version !== queue.version
        || intake.current_station !== queue.station
        || intake.current_status !== queue.status
      ) throw new Error("ORDER_CARD_INTAKE_RECEIPT_INVALID");
      const intakeItems = mapOrderCardIntakeItems(intake.items_snapshot);
      const contentEvents = await tx.execute<ContentEventRow>(sql`
        SELECT tenant_id, order_id, event_type, event_schema_version,
               aggregate_version, status, payload
        FROM public.events
        WHERE tenant_id = ${authorization.tenantId}
          AND order_id = ${input.orderId}
          AND event_type = 'ORDER_CONTENT_CHANGED_V1'
        ORDER BY aggregate_version DESC, created_at DESC
        LIMIT 1
      `);
      const contentEvent = contentEvents[0] ?? null;
      const eventPayload = contentEvent?.payload as { note?: unknown; items?: unknown } | null;
      const eventItems = contentEvent ? mapOrderCardIntakeItems(eventPayload?.items) : null;
      if (contentEvent && (
        contentEvent.tenant_id !== authorization.tenantId
        || contentEvent.order_id !== queue.id
        || contentEvent.event_schema_version !== 1
        || contentEvent.status !== "success"
        || contentEvent.aggregate_version > queue.version
        || !(eventPayload?.note === null || typeof eventPayload?.note === "string")
      )) throw new Error("ORDER_CARD_CONTENT_EVENT_INVALID");
      if (!contentEvent && intake.integrity_ok !== true) throw new Error("ORDER_CARD_INTAKE_RECEIPT_INVALID");
      const positions = new Map((eventItems ?? intakeItems).map((item) => [item.id, item.position]));
      const currentRows = await tx.execute<CurrentItemRow>(sql`
        SELECT id, name, quantity, material, surface_requested, execution_requested,
               catalog_service_id::text AS catalog_service_id, unit,
               CASE WHEN preis_netto IS NULL THEN NULL ELSE round(preis_netto * 100)::bigint END AS unit_price_cents,
               vat_rate_basis_points, current_station_id
        FROM public.items
        WHERE tenant_id = ${authorization.tenantId}
          AND order_id = ${input.orderId}
        ORDER BY created_at, id
      `);
      const items = mapCurrentOrderItems(currentRows, positions);
      if (eventItems) {
        const shape = (item: OrderCardItem) => ({
          id: item.id, position: item.position, name: item.name, quantity: item.quantity,
          material: item.material, surfaceRequested: item.surfaceRequested,
          catalogServiceId: item.catalogServiceId, unit: item.unit,
          unitPriceCents: item.unitPriceCents, vatRateBasisPoints: item.vatRateBasisPoints,
        });
        const currentShape = items.map(shape);
        const eventShape = eventItems.map(shape);
        if (JSON.stringify(currentShape) !== JSON.stringify(eventShape) || eventPayload?.note !== (queue.task ?? null)) {
          throw new Error("ORDER_CARD_CONTENT_READBACK_INVALID");
        }
      }

      const customerRows = await tx.execute<{ phone: string | null; customer_number: string | null }>(sql`
        SELECT phone, customer_number FROM public.customers
        WHERE tenant_id = ${authorization.tenantId} AND id = ${queue.customer_id}
        LIMIT 2
      `);
      if (customerRows.length !== 1 || !customerRows[0]) throw new Error("ORDER_CARD_CUSTOMER_INVALID");

      // The valid typed agreement is operational state, not a money amount:
      // 10.1 must still be able to offer the goods-out route to users without
      // the `geld` area. Money-specific controls remain gated in the adapter.
      const agreement = await readEffectiveCustomerAgreement(tx, {
        tenantId: authorization.tenantId,
        customerId: queue.customer_id,
        orderId: queue.id,
      });
      const agreementHint = agreement === null
        ? await readInactiveCustomerAgreementHint(tx, {
            tenantId: authorization.tenantId,
            customerId: queue.customer_id,
            orderId: queue.id,
          })
        : null;

      const assignmentRows = await tx.execute<AssignmentRow>(sql`
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
      if (assignmentRows.length > 1) throw new Error("ORDER_CARD_ASSIGNMENT_AMBIGUOUS");
      const assignment = assignmentRows[0]
        ? mapAssignment(assignmentRows[0], authorization)
        : null;

      const assignmentOptions = authorization.permissions.includes("perm_op_status")
        ? (await tx.execute<AssigneeOptionRow>(sql`
            SELECT tenant_id, user_id::text AS user_id, full_name, role, active, integrity_ok
            FROM private.v_order_task_assignee_options_v1
            ORDER BY lower(full_name), user_id
          `)).map((row) => mapAssigneeOption(row, authorization.tenantId))
        : [];

      const dueDateChanges = (await tx.execute<DueDateChangeRow>(sql`
        SELECT event.id AS event_id, event.tenant_id, event.order_id,
               event.payload ->> 'promisedDueDate' AS changed_to,
               event.notes AS reason, event.created_at AS changed_at,
               coalesce(nullif(btrim(actor.full_name), ''), event.user_id::text) AS changed_by,
               event.user_id::text AS actor_id, event.aggregate_version,
               event.event_schema_version
        FROM public.events event
        LEFT JOIN public.app_users actor
          ON actor.tenant_id = event.tenant_id AND actor.id = event.user_id
        WHERE event.tenant_id = ${authorization.tenantId}
          AND event.order_id = ${input.orderId}
          AND event.event_type = 'ORDER_PROMISED_DUE_DATE_CHANGED_V1'
        ORDER BY event.created_at DESC, event.id DESC
        LIMIT 50
      `)).map((row) => mapDueDateChange(row, authorization.tenantId, queue.id));

      const labelPrints = (await tx.execute<LabelPrintRow>(sql`
        SELECT
          event.id AS event_id,
          event.tenant_id,
          event.order_id,
          event.client_event_id,
          event.correlation_id::text AS correlation_id,
          event.event_schema_version,
          event.aggregate_version,
          event.user_id::text AS actor_id,
          event.created_at AS occurred_at,
          event.event_type,
          event.status,
          event.description
        FROM public.events event
        WHERE event.tenant_id = ${authorization.tenantId}
          AND event.order_id = ${input.orderId}
          AND event.event_type = 'laufzettel_gedruckt'
          AND event.status = 'success'
        ORDER BY event.created_at DESC, event.id DESC
        LIMIT 50
      `)).map((row) => mapLabelPrint(row, authorization.tenantId, queue.id));

      const extraRows = await tx.execute<ExtraWorkRow>(sql`
        SELECT tenant_id, order_id, item_id, line_id::text AS line_id,
               catalog_position_id::text AS catalog_position_id,
               catalog_position_name, minutes, hourly_rate_cents, amount_cents,
               frozen, line_version, frozen_at, integrity_ok
        FROM private.v_order_extra_work_live_v1
        WHERE order_id = ${input.orderId}
        ORDER BY item_id, catalog_position_name, catalog_position_id
      `);
      const itemById = new Map(items.map((item) => [item.id, item]));
      const extraLines = extraRows.map((row) => {
        if (row.order_id !== queue.id) throw new Error("ORDER_CARD_EXTRA_WORK_ORDER_INVALID");
        const item = itemById.get(row.item_id);
        if (!item) throw new Error("ORDER_CARD_EXTRA_WORK_ITEM_INVALID");
        const line = mapExtraWork(row, authorization.tenantId);
        item.extraWork.push(line);
        return line;
      });

      const freezeRows = await tx.execute<FreezeRow>(sql`
        SELECT tenant_id, order_id, aggregate_version, freeze_id::text AS freeze_id,
               rate_id::text AS rate_id, hourly_rate_cents, total_amount_cents,
               line_count, frozen_at, integrity_ok
        FROM private.v_order_frozen_receipts_v1
        WHERE order_id = ${input.orderId}
          AND active = true
        ORDER BY occurred_at DESC
        LIMIT 2
      `);
      if (freezeRows.length > 1) throw new Error("ORDER_CARD_FREEZE_AMBIGUOUS");
      const freeze = freezeRows[0] ?? null;
      // The immutable completion freeze remains active after goods-out. A
      // collected/shipped order must therefore still carry the same freeze.
      const frozenFlag = queue.status === "fertig" || queue.station === "abgeholt";
      if ((freeze !== null) !== frozenFlag) throw new Error("ORDER_CARD_FREEZE_STATE_INVALID");

      let mappedFreeze: LiveOrderCard["freeze"] = null;
      if (freeze) {
        const hourlyRateCents = toSafeInteger(freeze.hourly_rate_cents, "ORDER_CARD_FREEZE_RATE_INVALID");
        const totalAmountCents = toSafeInteger(freeze.total_amount_cents, "ORDER_CARD_FREEZE_TOTAL_INVALID");
        const lineCount = toSafeInteger(freeze.line_count, "ORDER_CARD_FREEZE_COUNT_INVALID");
        const actualLines = extraLines;
        if (
          freeze.integrity_ok !== true
          || freeze.tenant_id !== authorization.tenantId
          || freeze.order_id !== queue.id
          || freeze.aggregate_version > queue.version
          || !UUID_PATTERN.test(freeze.freeze_id)
          || !UUID_PATTERN.test(freeze.rate_id)
          || hourlyRateCents < 1
          || lineCount !== actualLines.length
          || totalAmountCents !== actualLines.reduce((sum, line) => sum + line.amountCents, 0)
          || actualLines.some((line) => !line.frozen || line.hourlyRateCents !== hourlyRateCents)
        ) throw new Error("ORDER_CARD_FREEZE_INVALID");
        mappedFreeze = {
          freezeId: freeze.freeze_id,
          rateId: freeze.rate_id,
          hourlyRateCents,
          totalAmountCents,
          lineCount,
          frozenAt: toIso(freeze.frozen_at),
        };
      }

      const canReadMoney = authorization.permissions.includes("perm_view_prices");
      return {
        id: queue.id,
        version: queue.version,
        orderNumber: queue.order_number,
        customerId: queue.customer_id,
        customerName: queue.customer_name,
        customerNumber: customerRows[0].customer_number,
        customerPhone: customerRows[0].phone,
        title: queue.title,
        note: queue.task,
        station: queue.station,
        status: queue.status,
        dueAt: toNullableIso(queue.due_date),
        intakeAt: toIso(queue.intake_date ?? queue.created_at),
        intakeSource: queue.intake_source,
        handoverMode: queue.handover_mode,
        assignment,
        assignmentOptions,
        dueDateChanges,
        labelPrints,
        items: canReadMoney ? items : items.map((item) => ({ ...item, unitPriceCents: null, vatRateBasisPoints: null,
          extraWork: item.extraWork.map((line) => ({ ...line, hourlyRateCents: null, amountCents: null })) })),
        freeze: canReadMoney || !mappedFreeze ? mappedFreeze : { ...mappedFreeze, hourlyRateCents: null, totalAmountCents: null },
        agreement,
        agreementHint,
      } satisfies LiveOrderCard;
    });
    return data === null
      ? { code: "NOT_FOUND", message: "Auftrag nicht verfügbar." }
      : { code: "OK", data };
  } catch (error) {
    const errorCode = error instanceof Error && /^ORDER_CARD_[A-Z0-9_]+$/.test(error.message)
      ? error.message
      : "ORDER_CARD_READ_FAILED";
    console.error("[ORDER_CARD_READ_ERROR]", {
      orderId: input.orderId,
      code: errorCode,
    });
    return {
      code: "UNAVAILABLE",
      message: `Auftragskarte konnte nicht sicher geladen werden. Fehlercode: ${errorCode}.`,
      errorCode,
    };
  }
}

export async function readExtraWorkMasterData(
  authorization: AuthorizationSnapshot,
): Promise<OrderCardReadResult<ExtraWorkMasterData>> {
  if (!canView(authorization)) {
    return { code: "FORBIDDEN", message: "Mehrarbeitsstammdaten sind nicht erlaubt." };
  }
  try {
    const data = await withPrivilegedTenantTransaction(authorization, async (tx) => {
      const rateRows = await tx.execute<RateRow>(sql`
        SELECT id::text AS id, tenant_id, hourly_rate_cents, version, effective_at, integrity_ok
        FROM private.v_extra_work_current_rate_v1
        LIMIT 2
      `);
      if (rateRows.length > 1) throw new Error("EXTRA_WORK_CURRENT_RATE_AMBIGUOUS");
      const rate = rateRows[0] ?? null;
      const currentRate = rate === null ? null : (() => {
        if (
          rate.integrity_ok !== true
          || rate.tenant_id !== authorization.tenantId
          || !UUID_PATTERN.test(rate.id)
          || !Number.isSafeInteger(rate.hourly_rate_cents)
          || rate.hourly_rate_cents < 1
          || !Number.isSafeInteger(rate.version)
          || rate.version < 1
        ) throw new Error("EXTRA_WORK_CURRENT_RATE_INVALID");
        return {
          id: rate.id,
          hourlyRateCents: rate.hourly_rate_cents,
          version: rate.version,
          effectiveAt: toIso(rate.effective_at),
        };
      })();

      const catalogRows = await tx.execute<CatalogRow>(sql`
        SELECT id::text AS id, tenant_id, name, standard_minutes,
               active, version, updated_at, integrity_ok
        FROM private.v_extra_work_catalog_v1
        ORDER BY active DESC, lower(name), id
      `);
      const catalog = catalogRows.map((row) => {
        if (
          row.integrity_ok !== true
          || row.tenant_id !== authorization.tenantId
          || !UUID_PATTERN.test(row.id)
          || row.name.trim() !== row.name
          || row.name.length < 2
          || row.name.length > 100
          || !Number.isSafeInteger(row.standard_minutes)
          || row.standard_minutes < 1
          || row.standard_minutes > 1440
          || !Number.isSafeInteger(row.version)
          || row.version < 1
        ) throw new Error("EXTRA_WORK_CATALOG_INVALID");
        return {
          id: row.id,
          name: row.name,
          standardMinutes: row.standard_minutes,
          active: row.active,
          version: row.version,
          updatedAt: toIso(row.updated_at),
        };
      });
      return { currentRate, catalog } satisfies ExtraWorkMasterData;
    });
    return { code: "OK", data };
  } catch (error) {
    console.error("[ORDER_CARD_EXTRA_WORK_READ_ERROR]", {
      message: error instanceof Error ? error.message.slice(0, 200) : "UNKNOWN",
    });
    return { code: "UNAVAILABLE", message: "Mehrarbeitsstammdaten konnten nicht sicher geladen werden." };
  }
}
