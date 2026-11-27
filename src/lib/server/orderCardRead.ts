import {withPageReadPhase,logPageReadPhase} from '@/db/readBudget';
import {reportOrderSourceIssue} from './orderSourceIssueLog';
import type {OrderActorSummary, zeigeFertigtermin} from "@/modules/orders/public";
import "server-only";
import {readManualHandoverReceipt,readInvoiceHandoverSource} from './orderHandoverSourcePort';

import { sql } from "drizzle-orm";
import {readOrderCommercialQuote,readOrderCommercialQuotes,type OrderCommercialQuote} from "./orderQuoteReadPort";
import { isOrderIntakeFreeTextUnit, isOrderIntakeFreeTextPrice, isOrderContentPrice } from "@/lib/orderPositionContract";
import { orderPositionQuantityError, orderPositionUnitLabel, orderPositionSurfaceLabel, normaliseOrderPositionSurface } from "@/lib/orderPositionContract";
import type { AuthorizationSnapshot } from "@/lib/server/authorization";
import type { OrderIntakeExecutionRequested, OrderIntakeSource } from "@/lib/server/commands/orderIntakeCommand";
import type {
  OrderTaskAssigneeOption,
  OrderTaskAssignmentState,
} from "@/lib/server/orderTaskAssignmentRead";
import { withPrivilegedTenantTransaction,withTenantSavepoint } from "@/lib/server/privilegedDb";
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
  /** Unresolved original vocabulary, not a canonical surface or a corrected receipt. */
  surfaceAssignmentRequired?: string;
  executionRequested?: OrderIntakeExecutionRequested | null;
  catalogServiceId: string | null;
  unit: string | null;
  unitPriceCents: number | null;
  vatRateBasisPoints: 0 | 700 | 1900 | null;
  finished: boolean;
  extraWork: OrderCardExtraWork[];
};

export type LiveOrderCard = {
  operationalFacts?:{rework:boolean;pricesMissing:boolean|null;complaint?:boolean;reworkComplaintId?:string};
  actors?:OrderActorSummary;
  actorReadError?:string;
  shippingService?:string|null;
  shippingServiceError?:string;
  handoverNotice?:{message:string;taskId:string|null;originalItemId:string|null;manualEventId?:string;taskState?:'offen'|'erledigt'|'nicht_verfuegbar'};
  cancellation?:{reason:string;at:string;actor:string;quoteId:string|null;quoteNumber:string|null};
  commercialQuote?:OrderCommercialQuote;
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
  terminAnzeige?: ReturnType<typeof zeigeFertigtermin>;
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

export type LiveOrderCardSource=Omit<LiveOrderCard,'assignment'>&{assignment:Omit<OrderTaskAssignmentState,'isAssignedToCurrentUser'>|null};

export type ExtraWorkMasterData = {
  currentRate: null | {
    id: string;
    hourlyRateCents: number | null;
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
  surface_mapping_readable?: boolean;
};

type OrderOriginRow = {
  has_commercial_quote:boolean;
  tenant_id: string;
  source: string | null;
  nacharbeit_zu: string | null;
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

export function mapOrderCardIntakeItems(value: unknown,source:'intake'|'content'='intake'): OrderCardItem[] {
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
      && (source==='content'?isOrderContentPrice(entry.unitPriceCents, entry.vatRateBasisPoints):isOrderIntakeFreeTextPrice(entry.unitPriceCents, entry.vatRateBasisPoints));
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
      surfaceRequested: normaliseOrderPositionSurface(entry.surfaceRequested) === null
        ? entry.surfaceRequested : orderPositionSurfaceLabel(entry.surfaceRequested),
      ...(normaliseOrderPositionSurface(entry.surfaceRequested) === null
        ? {surfaceAssignmentRequired:entry.surfaceRequested} : {}),
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
  authorization: Pick<AuthorizationSnapshot,'tenantId'>,
): Omit<OrderTaskAssignmentState,'isAssignedToCurrentUser'> {
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

export function canViewOrderCard(authorization: Pick<AuthorizationSnapshot,'permissions'>): boolean {
  return authorization.permissions.includes("perm_view_leitstand");
}

type OrderPriceEvent={aggregate_version:number;payload:{prices:unknown}};
function qualifyCurrentOrderItems(authorization:Pick<AuthorizationSnapshot,'tenantId'>,queue:QueueRow,isReworkOrder:boolean,intakeRows:IntakeRow[],currentRows:CurrentItemRow[],contentEvent:ContentEventRow|null,priceEvents:OrderPriceEvent[]){
      const intake = intakeRows[0];
      if (
        (isReworkOrder && intakeRows.length !== 0)
        || (!isReworkOrder && (
          intakeRows.length !== 1
          || !intake
          || intake.tenant_id !== authorization.tenantId
          || intake.order_id !== queue.id
          || intake.customer_id !== queue.customer_id
          || intake.current_order_version !== queue.version
          || intake.current_station !== queue.station
          || intake.current_status !== queue.status
        ))
      ) throw new Error("ORDER_CARD_INTAKE_RECEIPT_INVALID");
      const intakeItems = isReworkOrder ? null : mapOrderCardIntakeItems(intake!.items_snapshot);
      const eventPayload = contentEvent?.payload as { note?: unknown; items?: unknown } | null;
      const eventItems = contentEvent ? mapOrderCardIntakeItems(eventPayload?.items,'content') : null;
      if (contentEvent && (
        contentEvent.tenant_id !== authorization.tenantId
        || contentEvent.order_id !== queue.id
        || contentEvent.event_schema_version !== 1
        || contentEvent.status !== "success"
        || contentEvent.aggregate_version > queue.version
        || !(eventPayload?.note === null || typeof eventPayload?.note === "string")
      )) throw new Error("ORDER_CARD_CONTENT_EVENT_INVALID");
      // A PL-approved vocabulary gap is visible, but never excuses any other
      // broken receipt predicate. Other consumers still see integrity_ok=false.
      if (!isReworkOrder && !contentEvent && intake!.integrity_ok !== true
        && !(intake!.surface_mapping_readable === true && intakeItems!.some(item=>item.surfaceAssignmentRequired))) {
        throw new Error("ORDER_CARD_INTAKE_RECEIPT_INVALID");
      }
      const sourcePositions = eventItems ?? intakeItems ?? currentRows.map((item, index) => ({ id: item.id, position: index + 1 }));
      const positions = new Map(sourcePositions.map((item) => [item.id, item.position]));
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
        // The existing invoice-price command may fill an unpriced position
        // after this content receipt. Only its real later receipt can explain
        // that price change; copying the current value would hide corruption.

        for(const priceEvent of priceEvents.filter(event=>event.aggregate_version>contentEvent!.aggregate_version&&event.aggregate_version<=queue.version)){
          const prices=priceEvent.payload?.prices;
          if(!Array.isArray(prices)||!prices.length||new Set(prices.map(price=>price?.itemId)).size!==prices.length)throw Error('ORDER_CARD_INVOICE_PRICE_RECEIPT_INVALID');
          for(const price of prices){
            if(!price||typeof price!=='object'||Object.keys(price).sort().join(',')!=='itemId,unitPriceCents'||typeof price.itemId!=='string'||!UUID_PATTERN.test(price.itemId)||!Number.isSafeInteger(price.unitPriceCents)||price.unitPriceCents<0)throw Error('ORDER_CARD_INVOICE_PRICE_RECEIPT_INVALID');
            const expected=eventShape.find(item=>item.id===price.itemId);
            if(!expected||expected.catalogServiceId!==null||expected.unitPriceCents!==null)throw Error('ORDER_CARD_INVOICE_PRICE_RECEIPT_INVALID');
            expected.unitPriceCents=price.unitPriceCents;
          }
        }
        if (JSON.stringify(currentShape) !== JSON.stringify(eventShape) || eventPayload?.note !== (queue.task ?? null)) {
          throw new Error("ORDER_CARD_CONTENT_READBACK_INVALID");
        }
      }

 if (!contentEvent && intakeItems) for (const original of intakeItems) {
  if (!original.surfaceAssignmentRequired) continue;
  const current=items.find(item=>item.id===original.id);
  if (!current) throw new Error("ORDER_CARD_INTAKE_RECEIPT_INVALID");
  current.surfaceRequested=original.surfaceAssignmentRequired;
  current.surfaceAssignmentRequired=original.surfaceAssignmentRequired;
 }
 return items;
}

function qualifyOrderFreeze(authorization:Pick<AuthorizationSnapshot,'tenantId'>,queue:QueueRow,items:OrderCardItem[],extraRows:ExtraWorkRow[],freezeRows:FreezeRow[]){
      const itemById = new Map(items.map((item) => [item.id, item]));
      const extraLines = extraRows.map((row) => {
        if (row.order_id !== queue.id) throw new Error("ORDER_CARD_EXTRA_WORK_ORDER_INVALID");
        const item = itemById.get(row.item_id);
        if (!item) throw new Error("ORDER_CARD_EXTRA_WORK_ITEM_INVALID");
        const line = mapExtraWork(row, authorization.tenantId);
        item.extraWork.push(line);
        return line;
      });

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

 return mappedFreeze;
}

function qualifyOrderQueue(authorization:Pick<AuthorizationSnapshot,'tenantId'>,queueRows:QueueRow[]){
 const queue=queueRows[0];
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
 return {...queue,customer_name:queue.customer_name};
}

function qualifyOrderOrigin(authorization:Pick<AuthorizationSnapshot,'tenantId'>,originRows:OrderOriginRow[]){
      const origin = originRows[0];
      if (
        originRows.length !== 1
        || !origin
        || origin.tenant_id !== authorization.tenantId||typeof origin.has_commercial_quote!=="boolean"
      ) throw new Error("ORDER_CARD_ORIGIN_INVALID");
      const isReworkOrder = origin.source === "REKLAMATION_NACHARBEIT";
      if (isReworkOrder && !validId(origin.nacharbeit_zu)) {
        throw new Error("ORDER_CARD_REWORK_LINK_INVALID");
      }
 return origin;
}

type CardHandoverEvent={id:string;event_type:string;payload:{receipt:{orderId:string;orderVersion:number;message:string;taskId:string|null;mailActor:{originalItemId:string}}}};
async function qualifyHandoverNotice(tx:import('./privilegedDb').PrivilegedTenantTransaction,authorization:Pick<AuthorizationSnapshot,'tenantId'>,queue:QueueRow,handoverEvent:CardHandoverEvent|undefined){
      let handoverNotice:LiveOrderCard['handoverNotice'];
      if(handoverEvent?.event_type==='ORDER_HANDOVER_CHANGED_V1'){
        const source=await readManualHandoverReceipt(tx,authorization.tenantId,handoverEvent.id);
        if(source.orderId!==queue.id||source.orderVersion>queue.version)throw Error('ORDER_CARD_MANUAL_HANDOVER_INVALID');
        handoverNotice={message:source.message,taskId:source.taskId,originalItemId:null,manualEventId:source.eventId};
      }else if(handoverEvent){
        await readInvoiceHandoverSource(tx,authorization.tenantId,handoverEvent.id);
        const handover=handoverEvent.payload?.receipt;
        if(handoverEvent.event_type!=='ORDER_HANDOVER_MAIL_V1'||!handover||handover.orderId!==queue.id||!Number.isSafeInteger(handover.orderVersion)||handover.orderVersion>queue.version||typeof handover.message!=='string'||!handover.message.trim()||!UUID_PATTERN.test(handover.mailActor?.originalItemId)||handover.taskId!==null&&!UUID_PATTERN.test(handover.taskId))throw Error('ORDER_CARD_HANDOVER_EVENT_INVALID');
        handoverNotice={message:handover.message,taskId:handover.taskId,originalItemId:handover.mailActor.originalItemId,manualEventId:handoverEvent.id};
      }
 return handoverNotice;
}

function qualifiedOperationalFacts(origin:OrderOriginRow,items:OrderCardItem[],awardedQuote:OrderCommercialQuote|undefined,awardedQuoteUnavailable:boolean,activeComplaint:{id:string}|null|undefined):NonNullable<LiveOrderCard['operationalFacts']>{
 const isReworkOrder=origin.source==='REKLAMATION_NACHARBEIT';
 return {rework:isReworkOrder,...(isReworkOrder?{reworkComplaintId:origin.nacharbeit_zu!}:{}),pricesMissing:awardedQuoteUnavailable?null:!isReworkOrder&&items.some(item=>item.unitPriceCents===null&&!awardedQuote?.positions.some(position=>position.itemId===item.id)),...(activeComplaint!==undefined?{complaint:activeComplaint!==null}:{})};
}
function qualifiedItemUnits(items:OrderCardItem[],awardedQuote:OrderCommercialQuote|undefined){
 return items.map(item=>{const awarded=awardedQuote?.positions.find(position=>position.itemId===item.id);return awarded?{...item,unit:awarded.unit==null?null:orderPositionUnitLabel(awarded.unit)}:item;});
}

/** The Today snapshot never reads a login identity or role. The same live
 * permission and tenant checks apply to both a session and the read-only union. */
type TodayOrderReadAuthorization=Pick<AuthorizationSnapshot,'tenantId'|'permissions'>;
export type TodayOrderCard=Pick<LiveOrderCard,'id'|'version'|'orderNumber'|'customerId'|'customerName'|'title'|'station'|'dueAt'|'handoverMode'|'items'|'freeze'|'handoverNotice'|'operationalFacts'>;
function maskOrderPriceFields(authorization:Pick<AuthorizationSnapshot,'permissions'>,card:Pick<LiveOrderCard,'items'|'freeze'>):Pick<LiveOrderCard,'items'|'freeze'>{
 if(authorization.permissions.includes('perm_view_prices'))return {items:card.items,freeze:card.freeze};
 return {
  items:card.items.map(item=>({...item,unitPriceCents:null,vatRateBasisPoints:null,extraWork:item.extraWork.map(line=>({...line,hourlyRateCents:null,amountCents:null}))})),
  freeze:card.freeze?{...card.freeze,hourlyRateCents:null,totalAmountCents:null}:card.freeze,
 };
}
/** Same price mask as the existing live readers, without a database read. */
export function maskTodayOrderCard(authorization:Pick<AuthorizationSnapshot,'permissions'>,card:TodayOrderCard):TodayOrderCard{
 return {...card,...maskOrderPriceFields(authorization,card)};
}
type TodayCardRow={kind:string;order_id:string;position:number;data:unknown};
/** One snapshot query for the displayed order facts. Both projections use
 * the same current-item, intake/content/price, freeze and handover validators.
 * No actor list, agreement hints, timeline, print queue or assignment menu. */
export async function readTodayOrderCards(authorization:TodayOrderReadAuthorization,orderIds:readonly string[]):Promise<Map<string,OrderCardReadResult<TodayOrderCard>>>{
 const diagnosticStarted=Date.now();
 const results=new Map<string,OrderCardReadResult<TodayOrderCard>>();
 if(!canViewOrderCard(authorization)||new Set(orderIds).size!==orderIds.length||orderIds.some(id=>!validId(id))){
  logPageReadPhase('cards.denied',diagnosticStarted,{requested:orderIds.length,failed:1});
  for(const id of orderIds)results.set(id,{code:'FORBIDDEN',message:'Auftragskarte ist nicht erlaubt.'});
  return results;
 }
 if(orderIds.length===0)return results;
 try{
  const {db}=await withPageReadPhase('cards.import',()=>import('@/db'));
  const readRows=(nested:import('./privilegedDb').PrivilegedTenantTransaction,selectedIds:readonly string[])=>{
   const ids=sql`ARRAY[${sql.join(selectedIds.map(id=>sql`${id}`),sql`, `)}]::text[]`;
   return nested.execute<TodayCardRow>(sql`SELECT * FROM private.read_today_card_snapshot_v1(${authorization.tenantId},${ids})`);
   };
   let rows:TodayCardRow[];
   try{rows=Array.from(await withPageReadPhase('cards.snapshot',()=>withPrivilegedTenantTransaction(authorization,tx=>withTenantSavepoint(tx,nested=>readRows(nested,orderIds)))));}
   catch{
    rows=[];
    // The parent transaction has finished before acquiring child connections.
    // Even one available pool slot must suffice; never hold it while awaiting
    // another transaction. The same SQL still has an order-local savepoint.
    const readIsolated=async(selectedIds:readonly string[]):Promise<void>=>{
     try{
      // Keep the identical SQL and native tenant/savepoint contract. A valid
      // group stays one snapshot; only the failing group is divided further.
      // This avoids re-planning every UNION/view for every unaffected order.
      rows.push(...await withPageReadPhase(selectedIds.length===1?'cards.one_snapshot':'cards.snapshot',()=>withPrivilegedTenantTransaction(authorization,isolated=>withTenantSavepoint(isolated,nested=>readRows(nested,selectedIds)))));
     }catch(error){
      if(selectedIds.length===1){
       const id=selectedIds[0];
       console.error('[TODAY_ORDER_SOURCE_FAILED]',{orderId:id,name:error instanceof Error?error.name:'UnknownError'});
       const errorCode=error instanceof Error&&/^ORDER_CARD_[A-Z0-9_]+$/.test(error.message)?error.message:'ORDER_CARD_READ_FAILED';
       results.set(id,{code:'UNAVAILABLE',message:`Auftragskarte konnte nicht sicher geladen werden. Fehlercode: ${errorCode}.`,errorCode});
       return;
      }
      const middle=Math.ceil(selectedIds.length/2);
      await Promise.all([readIsolated(selectedIds.slice(0,middle)),readIsolated(selectedIds.slice(middle))]);
     }
    };
    // The failed parent transaction is already released. The existing native
    // pool remains the connection limit, including a single available slot.
    const middle=Math.ceil(orderIds.length/2);
    await withPageReadPhase('cards.fallback',async()=>{if(orderIds.length===1)await readIsolated(orderIds);else await Promise.all([readIsolated(orderIds.slice(0,middle)),readIsolated(orderIds.slice(middle))]);});
   }
   const byOrder=new Map<string,TodayCardRow[]>();
   for(const row of rows){const group=byOrder.get(row.order_id);if(group)group.push(row);else byOrder.set(row.order_id,[row]);}
   type PreparedCard={queue:ReturnType<typeof qualifyOrderQueue>;origin:ReturnType<typeof qualifyOrderOrigin>;items:OrderCardItem[];freeze:LiveOrderCard['freeze'];handover:CardHandoverEvent|undefined};
   const prepared=new Map<string,PreparedCard>();
   const failCard=(orderId:string,error:unknown)=>{
    console.error('[TODAY_ORDER_SOURCE_FAILED]',{orderId,name:error instanceof Error?error.name:'UnknownError'});
    const errorCode=error instanceof Error&&/^ORDER_CARD_[A-Z0-9_]+$/.test(error.message)?error.message:'ORDER_CARD_READ_FAILED';
    results.set(orderId,{code:'UNAVAILABLE',message:`Auftragskarte konnte nicht sicher geladen werden. Fehlercode: ${errorCode}.`,errorCode});
   };
   for(const orderId of orderIds){
    if(results.has(orderId))continue;
    try{
     const group=byOrder.get(orderId)??[];
     const records=<T>(kind:string)=>group.filter(row=>row.kind===kind).map(row=>row.data as T);
     const queues=records<QueueRow&OrderOriginRow>('queue');
     if(!queues.length){results.set(orderId,{code:'NOT_FOUND',message:'Auftrag nicht verfügbar.'});continue;}
     const queue=qualifyOrderQueue(authorization,queues),origin=qualifyOrderOrigin(authorization,queues),isReworkOrder=origin.source==='REKLAMATION_NACHARBEIT';
     const content=records<ContentEventRow>('content');if(content.length>1)throw Error('ORDER_CARD_CONTENT_EVENT_INVALID');
     const items=qualifyCurrentOrderItems(authorization,queue,isReworkOrder,records<IntakeRow>('intake'),records<CurrentItemRow>('item'),content[0]??null,records<OrderPriceEvent>('price'));
     const freeze=qualifyOrderFreeze(authorization,queue,items,records<ExtraWorkRow>('extra'),records<FreezeRow>('freeze'));
     const handover=records<CardHandoverEvent>('handover');if(handover.length>1)throw Error('ORDER_CARD_HANDOVER_EVENT_INVALID');
     prepared.set(orderId,{queue,origin,items,freeze,handover:handover[0]});
    }catch(error){failCard(orderId,error);}
   }
   await withPageReadPhase('cards.qualify',()=>withPrivilegedTenantTransaction(authorization,async tx=>{
    const quoteValues=new Map<string,OrderCommercialQuote|Error>();
    type Complaint=Awaited<ReturnType<typeof import('./orderReleaseRead').readOpenOrderComplaint>>;
    const complaintValues=new Map<string,Complaint|Error>();
    const readQuotes=async(ids:string[]):Promise<void>=>{
     if(!ids.length)return;
     try{
      const values=await withTenantSavepoint(tx,nested=>readOrderCommercialQuotes(nested,authorization.tenantId,ids));
      for(const id of ids){const value=values.get(id);if(value===undefined)throw Error('ORDER_CARD_QUOTE_PRICE_INVALID');quoteValues.set(id,value);}
     }catch(error){
      if(ids.length===1){quoteValues.set(ids[0],error instanceof Error?error:new Error('ORDER_CARD_QUOTE_PRICE_INVALID',{cause:error}));return;}
      const half=Math.ceil(ids.length/2);await readQuotes(ids.slice(0,half));await readQuotes(ids.slice(half));
     }
    };
    const {readOpenOrderComplaintsBatch}=await import('./orderReleaseRead');
    const readComplaints=async(ids:string[]):Promise<void>=>{
     if(!ids.length)return;
     try{
      const values=await withTenantSavepoint(tx,nested=>readOpenOrderComplaintsBatch(nested,authorization.tenantId,ids));
      for(const id of ids){const value=values.get(id);if(value===undefined)throw Error('ORDER_NOTIFICATION_PROOF_INVALID');complaintValues.set(id,value);}
     }catch(error){
      if(ids.length===1){complaintValues.set(ids[0],error instanceof Error?error:new Error('ORDER_NOTIFICATION_PROOF_INVALID',{cause:error}));return;}
      const half=Math.ceil(ids.length/2);await readComplaints(ids.slice(0,half));await readComplaints(ids.slice(half));
     }
    };
    const entries=[...prepared.entries()];
    await readQuotes(entries.filter(([,value])=>value.origin.has_commercial_quote&&value.queue.status!=='storniert').map(([id])=>id));
    await readComplaints(entries.filter(([,value])=>value.queue.station!=='fertig').map(([id])=>id));
    for(const [orderId,{queue,origin,items,freeze,handover}] of prepared){
     try{
      const quote=quoteValues.get(orderId),awardedQuote=quote instanceof Error?undefined:quote,awardedQuoteUnavailable=quote instanceof Error;
      if(awardedQuoteUnavailable)reportOrderSourceIssue('[ORDER_CARD_COMMERCIAL_QUOTE_FAILED]',orderId,quote.message);
      const activeComplaint=complaintValues.get(orderId);
      if(queue.station!=='fertig'&&activeComplaint===undefined)throw Error('ORDER_NOTIFICATION_PROOF_INVALID');
      if(activeComplaint instanceof Error)throw activeComplaint;
      const handoverNotice=handover?await withTenantSavepoint(tx,nested=>qualifyHandoverNotice(nested,authorization,queue,handover)):undefined;
      const cardItems=qualifiedItemUnits(items,awardedQuote);
      results.set(orderId,{code:'OK',data:maskTodayOrderCard(authorization,{id:queue.id,version:queue.version,orderNumber:queue.order_number,customerId:queue.customer_id,customerName:queue.customer_name,title:queue.title,station:queue.station,dueAt:toNullableIso(queue.due_date),handoverMode:queue.handover_mode,
       items:cardItems,freeze,...(handoverNotice?{handoverNotice}:{}),
       operationalFacts:qualifiedOperationalFacts(origin,items,awardedQuote,awardedQuoteUnavailable,activeComplaint)})});
     }catch(error){failCard(orderId,error);}
    }
   }));
   logPageReadPhase('cards.model',diagnosticStarted,{requested:orderIds.length,ok:[...results.values()].filter(value=>value.code==='OK').length,failed:[...results.values()].filter(value=>value.code!=='OK').length,pool_size:db.$client.options.max});
   return results;
 }catch(error){
  logPageReadPhase('cards.outer_error',diagnosticStarted,{failed:1,requested:orderIds.length},error);
  console.error('[TODAY_ORDER_BATCH_FAILED]',{name:error instanceof Error?error.name:'UnknownError'});
  for(const id of orderIds)results.set(id,{code:'UNAVAILABLE',message:'Auftragskarte konnte nicht sicher geladen werden.'});
  return results;
 }
}

/** Keep personal assignment derived only from the actual logged-in actor. */
export async function readLiveOrderCard(authorization:AuthorizationSnapshot,input:{orderId:string}):Promise<OrderCardReadResult<LiveOrderCard>>{
 const source=await readLiveOrderCardSource(authorization,input);
 if(source.code!=='OK')return source;
 const assignment=source.data.assignment;
 return {code:'OK',data:{...source.data,assignment:assignment?{...assignment,isAssignedToCurrentUser:assignment.active&&assignment.assignedTo===authorization.userId}:null}};
}

export async function readLiveOrderCardSource(
  authorization: Pick<AuthorizationSnapshot,'tenantId'|'permissions'>,
  input: { orderId: string },
): Promise<OrderCardReadResult<LiveOrderCardSource>> {
  if (!hasExactKeys(input, ["orderId"]) || !validId(input.orderId)) {
    return { code: "VALIDATION_ERROR", message: "Ungültige Auftragskennung." };
  }
  if (!canViewOrderCard(authorization)) {
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
      if (queueRows.length === 0) return null;
      const queue=qualifyOrderQueue(authorization,queueRows);

      const originRows = await tx.execute<OrderOriginRow>(sql`
        SELECT tenant_id, source, nacharbeit_zu,EXISTS(SELECT 1 FROM private.quote_conversion_receipts quote WHERE quote.tenant_id=orders.tenant_id AND quote.order_id=orders.id) AS has_commercial_quote
        FROM public.orders orders
        WHERE tenant_id = ${authorization.tenantId}
          AND id = ${input.orderId}
        LIMIT 2
      `);
      const origin=qualifyOrderOrigin(authorization,originRows);
      const isReworkOrder=origin.source==='REKLAMATION_NACHARBEIT';

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

      const intakeRows = await tx.execute<IntakeRow>(sql`
        SELECT tenant_id, order_id, customer_id, items_snapshot,
               current_order_version, current_station, current_status, integrity_ok, surface_mapping_readable
        FROM private.v_order_intake_receipts_v1
        WHERE order_id = ${input.orderId}
        ORDER BY recorded_at DESC
        LIMIT 2
      `);
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
      const contentEvent=contentEvents[0]??null;
      let priceEvents:OrderPriceEvent[]=[];
      if(contentEvent){
        priceEvents=await tx.execute<OrderPriceEvent>(sql`SELECT aggregate_version,payload FROM public.events WHERE tenant_id=${authorization.tenantId} AND order_id=${input.orderId}
          AND event_type='ORDER_INVOICE_PRICES_SET_V1' AND status='success' AND event_schema_version=1 AND user_id IS NOT NULL
          AND aggregate_version>${contentEvent!.aggregate_version} AND aggregate_version<=${queue.version} ORDER BY aggregate_version,created_at,id`);
      }
      const items=qualifyCurrentOrderItems(authorization,queue,isReworkOrder,intakeRows,currentRows,contentEvent,priceEvents);

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
      const mappedFreeze=qualifyOrderFreeze(authorization,queue,items,extraRows,freezeRows);

      const canReadMoney = authorization.permissions.includes("perm_view_prices");
      const cancellationRows=queue.status==='storniert'?await tx.execute<{reason:string;at:string;actor:string;quoteId:string|null;quoteNumber:string|null}>(sql`SELECT event.notes AS reason,event.created_at::text AS at,coalesce(actor.full_name,'Name fehlt') AS actor,event.payload->>'quoteId' AS "quoteId",quote.quote_number AS "quoteNumber" FROM public.events event LEFT JOIN public.app_users actor ON actor.tenant_id=event.tenant_id AND actor.id=event.user_id LEFT JOIN private.quotes quote ON quote.tenant_id=event.tenant_id AND quote.id::text=event.payload->>'quoteId' WHERE event.tenant_id=${authorization.tenantId} AND event.order_id=${input.orderId} AND event.event_type='ORDER_CANCELLED_V1' AND event.status='success' ORDER BY event.created_at DESC,event.id DESC LIMIT 1`):[];
      // The awarded edition also owns operational unit facts. Read it once on
      // the server; monetary fields still leave this reader only with geld.
      let awardedQuote:OrderCommercialQuote|undefined,awardedQuoteUnavailable=false;
      if(origin.has_commercial_quote&&queue.status!=='storniert'){
        try{awardedQuote=await withTenantSavepoint(tx,nested=>readOrderCommercialQuote(nested,authorization.tenantId,input.orderId));}
        catch(error){awardedQuoteUnavailable=true;reportOrderSourceIssue('[ORDER_CARD_COMMERCIAL_QUOTE_FAILED]',queue.id,error instanceof Error?error.message:'UnknownError');}
      }
      const commercialQuote=canReadMoney?awardedQuote:undefined;
      const cardItems=qualifiedItemUnits(items,awardedQuote);
      const [handoverEvent]=await tx.execute<{id:string;event_type:string;payload:{receipt:{orderId:string;orderVersion:number;message:string;taskId:string|null;mailActor:{originalItemId:string}}}}>(sql`SELECT id,event_type,payload FROM public.events WHERE tenant_id=${authorization.tenantId} AND order_id=${input.orderId} AND event_type IN ('ORDER_HANDOVER_MAIL_V1','ORDER_HANDOVER_CHANGED_V1') AND event_schema_version=1 AND status='success' ORDER BY aggregate_version DESC,created_at DESC,id DESC LIMIT 1`);
      const handoverNotice=await qualifyHandoverNotice(tx,authorization,queue,handoverEvent);
      const activeComplaint=queue.station!=='fertig'?await (await import('./orderReleaseRead')).readOpenOrderComplaint(tx,authorization.tenantId,input.orderId):undefined;
      return {
        ...(handoverNotice?{handoverNotice}:{}),
        ...(commercialQuote?{commercialQuote}:{}),
        ...(cancellationRows[0]?{cancellation:cancellationRows[0]}:{}),
        operationalFacts:qualifiedOperationalFacts(origin,items,awardedQuote,awardedQuoteUnavailable,activeComplaint),
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
        ...maskOrderPriceFields(authorization,{items:cardItems,freeze:mappedFreeze}),
        agreement,
        agreementHint,
      } satisfies LiveOrderCardSource;
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
  if (!canViewOrderCard(authorization)) {
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
          hourlyRateCents: authorization.permissions.includes("perm_view_prices") ? rate.hourly_rate_cents : null,
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
