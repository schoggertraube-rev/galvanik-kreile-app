import "server-only";

import { sql } from "drizzle-orm";
import type { AuthorizationSnapshot } from "@/lib/server/authorization";
import type {
  OrderTaskAssigneeOption,
  OrderTaskAssignmentState,
} from "@/lib/server/orderTaskAssignmentRead";
import { withPrivilegedTenantTransaction } from "@/lib/server/privilegedDb";

const MAX_ID_LENGTH = 128;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

export type OrderCardExtraWork = {
  lineId: string;
  catalogPositionId: string;
  catalogPositionName: string;
  minutes: number;
  hourlyRateCents: number;
  amountCents: number;
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
  extraWork: OrderCardExtraWork[];
};

export type LiveOrderCard = {
  id: string;
  version: number;
  orderNumber: string;
  customerId: string;
  customerName: string;
  title: string;
  note: string | null;
  station: string;
  status: string;
  dueAt: string | null;
  intakeAt: string;
  assignment: OrderTaskAssignmentState | null;
  assignmentOptions: OrderTaskAssigneeOption[];
  items: OrderCardItem[];
  freeze: null | {
    freezeId: string;
    rateId: string;
    hourlyRateCents: number;
    totalAmountCents: number;
    lineCount: number;
    frozenAt: string;
  };
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
  | { code: "UNAVAILABLE"; message: string };

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

function mapIntakeItems(value: unknown): OrderCardItem[] {
  if (!Array.isArray(value) || value.length < 1 || value.length > 20) {
    throw new Error("ORDER_CARD_INTAKE_ITEMS_INVALID");
  }
  const items = value.map((entry) => {
    if (!hasExactKeys(entry, ["id", "position", "name", "quantity", "material", "surfaceRequested"])) {
      throw new Error("ORDER_CARD_INTAKE_ITEM_SHAPE_INVALID");
    }
    const position = toSafeInteger(entry.position, "ORDER_CARD_ITEM_POSITION_INVALID");
    const quantity = toSafeInteger(entry.quantity, "ORDER_CARD_ITEM_QUANTITY_INVALID");
    if (
      typeof entry.id !== "string"
      || !UUID_PATTERN.test(entry.id)
      || position < 1
      || position > 20
      || typeof entry.name !== "string"
      || entry.name.trim() !== entry.name
      || entry.name.length < 2
      || entry.name.length > 160
      || quantity < 1
      || quantity > 1_000_000
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
    ) throw new Error("ORDER_CARD_INTAKE_ITEM_INVALID");

    return {
      id: entry.id,
      position,
      name: entry.name,
      quantity,
      material: entry.material,
      surfaceRequested: entry.surfaceRequested,
      extraWork: [],
    } satisfies OrderCardItem;
  });
  if (new Set(items.map((item) => item.id)).size !== items.length) {
    throw new Error("ORDER_CARD_ITEM_DUPLICATE");
  }
  return items.sort((left, right) => left.position - right.position);
}

function mapExtraWork(row: ExtraWorkRow, tenantId: string): OrderCardExtraWork {
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
    || !["buero", "werkstatt", "meister", "admin"].includes(row.role)
  ) throw new Error("ORDER_CARD_ASSIGNMENT_OPTION_INVALID");
  return { userId: row.user_id, fullName: row.full_name, role: row.role };
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
               intake_date, due_date::date::text AS due_date, created_at, tenant_integrity_ok
        FROM private.v_operational_station_queue_v1
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
        || queue.status !== queue.station
        || !validId(queue.customer_id)
        || typeof queue.customer_name !== "string"
        || queue.customer_name.trim().length === 0
        || !Number.isSafeInteger(queue.version)
        || queue.version < 1
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
        || intake.integrity_ok !== true
      ) throw new Error("ORDER_CARD_INTAKE_RECEIPT_INVALID");
      const items = mapIntakeItems(intake.items_snapshot);

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

      const assignmentOptions = ["meister", "admin"].includes(authorization.role)
        ? (await tx.execute<AssigneeOptionRow>(sql`
            SELECT tenant_id, user_id::text AS user_id, full_name, role, active, integrity_ok
            FROM private.v_order_task_assignee_options_v1
            ORDER BY lower(full_name), user_id
          `)).map((row) => mapAssigneeOption(row, authorization.tenantId))
        : [];

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
      for (const row of extraRows) {
        if (row.order_id !== queue.id) throw new Error("ORDER_CARD_EXTRA_WORK_ORDER_INVALID");
        const item = itemById.get(row.item_id);
        if (!item) throw new Error("ORDER_CARD_EXTRA_WORK_ITEM_INVALID");
        item.extraWork.push(mapExtraWork(row, authorization.tenantId));
      }

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
      const frozenFlag = queue.status === "fertig";
      if ((freeze !== null) !== frozenFlag) throw new Error("ORDER_CARD_FREEZE_STATE_INVALID");

      let mappedFreeze: LiveOrderCard["freeze"] = null;
      if (freeze) {
        const hourlyRateCents = toSafeInteger(freeze.hourly_rate_cents, "ORDER_CARD_FREEZE_RATE_INVALID");
        const totalAmountCents = toSafeInteger(freeze.total_amount_cents, "ORDER_CARD_FREEZE_TOTAL_INVALID");
        const lineCount = toSafeInteger(freeze.line_count, "ORDER_CARD_FREEZE_COUNT_INVALID");
        const actualLines = items.flatMap((item) => item.extraWork);
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

      return {
        id: queue.id,
        version: queue.version,
        orderNumber: queue.order_number,
        customerId: queue.customer_id,
        customerName: queue.customer_name,
        title: queue.title,
        note: queue.task,
        station: queue.station,
        status: queue.status,
        dueAt: toNullableIso(queue.due_date),
        intakeAt: toIso(queue.intake_date ?? queue.created_at),
        assignment,
        assignmentOptions,
        items,
        freeze: mappedFreeze,
      } satisfies LiveOrderCard;
    });
    return data === null
      ? { code: "NOT_FOUND", message: "Auftrag nicht verfügbar." }
      : { code: "OK", data };
  } catch {
    return { code: "UNAVAILABLE", message: "Auftragskarte konnte nicht sicher geladen werden." };
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
  } catch {
    return { code: "UNAVAILABLE", message: "Mehrarbeitsstammdaten konnten nicht sicher geladen werden." };
  }
}
