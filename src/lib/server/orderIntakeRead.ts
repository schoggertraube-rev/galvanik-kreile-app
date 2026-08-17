import "server-only";

import { sql } from "drizzle-orm";
import type { AuthorizationSnapshot } from "@/lib/server/authorization";
import type { OrderIntakeReceipt, OrderIntakeReceiptItem } from "@/lib/server/commands/orderIntakeCommand";
import { withPrivilegedTenantTransaction } from "@/lib/server/privilegedDb";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export type OrderIntakeCustomerSearchInput = { query: string };
export type OrderIntakeReceiptReadInput = { orderId: string; clientEventId: string };

export type OrderIntakeCustomerOption = {
  id: string;
  customerNumber: string | null;
  name: string;
  companyName: string | null;
  customerType: string;
  city: string | null;
  ordersCount: number;
};

type CustomerRow = {
  id: string;
  tenant_id: string;
  customer_number: string | null;
  name: string;
  company_name: string | null;
  customer_type: string;
  city: string | null;
  orders_count: number | string;
  integrity_ok: boolean;
};

type ReceiptRow = {
  receipt_id: string;
  event_id: string;
  tenant_id: string;
  order_id: string;
  customer_id: string;
  actor_id: string;
  client_event_id: string;
  correlation_id: string;
  customer_mode: string;
  order_number: string;
  customer_display_name: string;
  due_date: Date | string | null;
  note: string | null;
  items_snapshot: unknown;
  recorded_at: Date | string;
  current_order_version: number;
  current_station: string;
  current_status: string;
  integrity_ok: boolean;
};

function plainObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function exactKeys(value: Record<string, unknown>, expected: readonly string[]): boolean {
  const actual = Object.keys(value).sort();
  const wanted = [...expected].sort();
  return actual.length === wanted.length && actual.every((key, index) => key === wanted[index]);
}

function trimmed(value: unknown, min: number, max: number): value is string {
  return typeof value === "string" && value === value.trim() && value.length >= min && value.length <= max;
}

function optionalTrimmed(value: unknown, max: number): value is string | null {
  return value === null || trimmed(value, 1, max);
}

function validSearchInput(input: unknown): input is OrderIntakeCustomerSearchInput {
  return plainObject(input) && exactKeys(input, ["query"]) &&
    typeof input.query === "string" && input.query === input.query.trim() && input.query.length <= 80;
}

function validReceiptInput(input: unknown): input is OrderIntakeReceiptReadInput {
  return plainObject(input) && exactKeys(input, ["clientEventId", "orderId"]) &&
    trimmed(input.orderId, 1, 128) && typeof input.clientEventId === "string" && UUID_PATTERN.test(input.clientEventId);
}

function safeCount(value: number | string): number | null {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isSafeInteger(parsed) && parsed >= 0 ? parsed : null;
}

function mapCustomer(row: CustomerRow, tenantId: string): OrderIntakeCustomerOption | null {
  const ordersCount = safeCount(row.orders_count);
  if (
    row.tenant_id !== tenantId || row.integrity_ok !== true || !trimmed(row.id, 1, 128) ||
    !optionalTrimmed(row.customer_number, 50) || !trimmed(row.name, 2, 160) ||
    !optionalTrimmed(row.company_name, 160) || !trimmed(row.customer_type, 1, 50) ||
    !optionalTrimmed(row.city, 120) || ordersCount === null
  ) return null;
  return {
    id: row.id,
    customerNumber: row.customer_number,
    name: row.name,
    companyName: row.company_name,
    customerType: row.customer_type,
    city: row.city,
    ordersCount,
  };
}

function parseItems(value: unknown): OrderIntakeReceiptItem[] | null {
  if (!Array.isArray(value) || value.length < 1 || value.length > 20) return null;
  return value.map((candidate, index) => {
    if (!plainObject(candidate) || !exactKeys(candidate, [
      "id", "material", "name", "position", "quantity", "surfaceRequested",
    ])) throw new Error("ORDER_INTAKE_RECEIPT_INVALID");
    if (
      typeof candidate.id !== "string" || !UUID_PATTERN.test(candidate.id) || candidate.position !== index + 1 ||
      !trimmed(candidate.name, 2, 160) || typeof candidate.quantity !== "number" ||
      !Number.isSafeInteger(candidate.quantity) || candidate.quantity < 1 || candidate.quantity > 1_000_000 ||
      !optionalTrimmed(candidate.material, 120) || !trimmed(candidate.surfaceRequested, 2, 160)
    ) throw new Error("ORDER_INTAKE_RECEIPT_INVALID");
    return {
      id: candidate.id,
      position: candidate.position,
      name: candidate.name,
      quantity: candidate.quantity,
      material: candidate.material,
      surfaceRequested: candidate.surfaceRequested,
    };
  });
}

function mapReceipt(
  row: ReceiptRow,
  authorization: Pick<AuthorizationSnapshot, "tenantId" | "userId">,
  input: OrderIntakeReceiptReadInput,
): OrderIntakeReceipt | null {
  const recorded = new Date(row.recorded_at);
  const dueDate = row.due_date instanceof Date ? row.due_date.toISOString().slice(0, 10) : row.due_date?.slice(0, 10);
  if (
    row.integrity_ok !== true || row.tenant_id !== authorization.tenantId || row.actor_id !== authorization.userId ||
    row.order_id !== input.orderId || row.client_event_id !== input.clientEventId ||
    !UUID_PATTERN.test(row.receipt_id) || !UUID_PATTERN.test(row.event_id) || !UUID_PATTERN.test(row.order_id) ||
    !trimmed(row.customer_id, 1, 128) || !UUID_PATTERN.test(row.correlation_id) ||
    (row.customer_mode !== "EXISTING" && row.customer_mode !== "NEW") ||
    !/^A-\d{4}-\d{4,}$/.test(row.order_number) || !trimmed(row.customer_display_name, 2, 160) ||
    !dueDate || !DATE_PATTERN.test(dueDate) || (row.note !== null && !trimmed(row.note, 1, 2000)) ||
    Number.isNaN(recorded.getTime()) || row.current_order_version !== 1 ||
    row.current_station !== "wareneingang" || row.current_status !== "in_progress"
  ) return null;
  const items = parseItems(row.items_snapshot);
  if (!items) return null;
  return {
    receiptId: row.receipt_id,
    eventId: row.event_id,
    orderId: row.order_id,
    orderNumber: row.order_number,
    customerId: row.customer_id,
    customerDisplayName: row.customer_display_name,
    customerMode: row.customer_mode,
    clientEventId: row.client_event_id,
    correlationId: row.correlation_id,
    actorId: row.actor_id,
    dueDate,
    note: row.note,
    items,
    recordedAt: recorded.toISOString(),
    orderVersion: 1,
    station: "wareneingang",
    status: "in_progress",
  };
}

export async function searchOrderIntakeCustomers(
  authorization: Pick<AuthorizationSnapshot, "tenantId">,
  input: unknown,
): Promise<OrderIntakeCustomerOption[]> {
  if (!validSearchInput(input)) throw new Error("ORDER_INTAKE_CUSTOMER_SEARCH_INPUT_INVALID");
  return withPrivilegedTenantTransaction(authorization, async (tx) => {
    const rows = await tx.execute<CustomerRow>(sql`
      SELECT id, tenant_id, customer_number, name, company_name, customer_type,
             city, orders_count, integrity_ok
      FROM private.v_order_intake_customers_v1
      WHERE ${input.query} = '' OR strpos(search_text, lower(${input.query})) > 0
      ORDER BY orders_count DESC, lower(coalesce(company_name, name)), id
      LIMIT 20
    `);
    return rows.map((row) => {
      const customer = mapCustomer(row, authorization.tenantId);
      if (!customer) throw new Error("ORDER_INTAKE_CUSTOMER_READMODEL_INVALID");
      return customer;
    });
  });
}

export async function readOrderIntakeReceipt(
  authorization: Pick<AuthorizationSnapshot, "tenantId" | "userId">,
  input: unknown,
): Promise<OrderIntakeReceipt | null> {
  if (!validReceiptInput(input)) throw new Error("ORDER_INTAKE_RECEIPT_INPUT_INVALID");
  return withPrivilegedTenantTransaction(authorization, async (tx) => {
    const rows = await tx.execute<ReceiptRow>(sql`
      SELECT receipt_id, event_id, tenant_id, order_id, customer_id, actor_id,
             client_event_id, correlation_id, customer_mode, order_number,
             customer_display_name, due_date, note, items_snapshot, recorded_at,
             current_order_version, current_station, current_status, integrity_ok
      FROM private.v_order_intake_receipts_v1
      WHERE order_id = ${input.orderId}
        AND actor_id = ${authorization.userId}
        AND client_event_id = ${input.clientEventId}
      LIMIT 2
    `);
    if (rows.length === 0) return null;
    if (rows.length !== 1 || !rows[0]) throw new Error("ORDER_INTAKE_RECEIPT_AMBIGUOUS");
    const receipt = mapReceipt(rows[0], authorization, input);
    if (!receipt) throw new Error("ORDER_INTAKE_RECEIPT_INVALID");
    return receipt;
  });
}
