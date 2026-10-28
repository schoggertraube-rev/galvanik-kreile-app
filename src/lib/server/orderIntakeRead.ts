import "server-only";

import { sql } from "drizzle-orm";
import { ORDER_LIFECYCLE_STATUS } from "@/modules/orders/public";
import type { AuthorizationSnapshot } from "@/lib/server/authorization";
import type { OrderIntakeExecutionRequested, OrderIntakeReceipt, OrderIntakeReceiptItem, OrderIntakeSource, OrderIntakeTermStatus } from "@/lib/server/commands/orderIntakeCommand";
import { withPrivilegedTenantTransaction } from "@/lib/server/privilegedDb";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const EXECUTION_REQUESTED_VALUES: readonly OrderIntakeExecutionRequested[] = ["hochglanz", "glaenzend", "matt", "gelb_passiviert", "blau_passiviert", "offen"];
const TERM_STATUS_VALUES: readonly OrderIntakeTermStatus[] = ["wunsch", "bestaetigt", "verschoben"];
const INTAKE_SOURCE_VALUES: readonly OrderIntakeSource[] = ["persoenlich", "versand", "abholung_firma", "anfrage_mail", "anfrage_telefon"];

export type OrderIntakeCustomerSearchInput = { query: string };
export type OrderIntakeReceiptReadInput = { orderId: string; clientEventId: string };

export type OrderIntakeCustomerOption = {
  id: string;
  customerNumber: string | null;
  name: string;
  companyName: string | null;
  customerType: string;
  contactPerson: string | null;
  phone: string | null;
  email: string | null;
  street: string | null;
  zipCode: string | null;
  city: string | null;
  country: string | null;
  paymentPreference: string | null;
  vatId: string | null;
  lastHandoverMode: "pickup" | "shipping" | null;
  ordersCount: number;
};

type CustomerRow = {
  id: string;
  tenant_id: string;
  customer_number: string | null;
  name: string;
  company_name: string | null;
  customer_type: string;
  contact_person: string | null;
  phone: string | null;
  email: string | null;
  street: string | null;
  zip_code: string | null;
  city: string | null;
  country: string | null;
  payment_preference: string | null;
  vat_id: string | null;
  last_handover_mode: string | null;
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
  intake_term_status: string | null;
  intake_source: string | null;
  note: string | null;
  items_snapshot: unknown;
  recorded_at: Date | string;
  current_order_version: number;
  current_station: string;
  current_status: string;
  handover_mode: string | null;
  payment_mode: string;
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
    !optionalTrimmed(row.contact_person, 160) || !optionalTrimmed(row.phone, 80) ||
    !optionalTrimmed(row.email, 254) || !optionalTrimmed(row.street, 160) ||
    !optionalTrimmed(row.zip_code, 20) || !optionalTrimmed(row.city, 120) ||
    !optionalTrimmed(row.country, 120) || !optionalTrimmed(row.payment_preference, 24) ||
    !optionalTrimmed(row.vat_id, 40) ||
    (row.last_handover_mode !== null && row.last_handover_mode !== "pickup" && row.last_handover_mode !== "shipping") ||
    ordersCount === null
  ) return null;
  return {
    id: row.id,
    customerNumber: row.customer_number,
    name: row.name,
    companyName: row.company_name,
    customerType: row.customer_type,
    contactPerson: row.contact_person,
    phone: row.phone,
    email: row.email,
    street: row.street,
    zipCode: row.zip_code,
    city: row.city,
    country: row.country,
    paymentPreference: row.payment_preference,
    vatId: row.vat_id,
    lastHandoverMode: row.last_handover_mode,
    ordersCount,
  };
}

function parseItems(value: unknown): OrderIntakeReceiptItem[] | null {
  if (!Array.isArray(value) || value.length < 1 || value.length > 20) return null;
  return value.map((candidate, index) => {
    const hasExecutionRequested = plainObject(candidate) && Object.hasOwn(candidate, "executionRequested");
    if (!plainObject(candidate) || !exactKeys(candidate, [
      "catalogServiceId", ...(hasExecutionRequested ? ["executionRequested"] : []), "id", "material", "name", "position", "quantity", "surfaceRequested", "unit", "unitPriceCents", "vatRateBasisPoints",
    ])) throw new Error("ORDER_INTAKE_RECEIPT_INVALID");
    const executionRequested = hasExecutionRequested ? candidate.executionRequested : "offen";
    if (
      typeof candidate.id !== "string" || !UUID_PATTERN.test(candidate.id) || candidate.position !== index + 1 ||
      !trimmed(candidate.name, 2, 160) || typeof candidate.quantity !== "number" ||
      !Number.isSafeInteger(candidate.quantity) || candidate.quantity < 1 || candidate.quantity > 1_000_000 ||
      !(candidate.catalogServiceId === null || (typeof candidate.catalogServiceId === "string" && UUID_PATTERN.test(candidate.catalogServiceId))) ||
      !optionalTrimmed(candidate.material, 120) || !trimmed(candidate.surfaceRequested, 2, 160) ||
      typeof executionRequested !== "string" || !EXECUTION_REQUESTED_VALUES.includes(executionRequested as OrderIntakeExecutionRequested) ||
      !(candidate.unit === null || trimmed(candidate.unit, 1, 40)) ||
      !(candidate.unitPriceCents === null || (typeof candidate.unitPriceCents === "number" && Number.isSafeInteger(candidate.unitPriceCents) && candidate.unitPriceCents >= 0)) ||
      !(candidate.vatRateBasisPoints === null || (typeof candidate.vatRateBasisPoints === "number" && [0,700,1900].includes(candidate.vatRateBasisPoints))) ||
      ((candidate.catalogServiceId === null) !== (candidate.unit === null && candidate.unitPriceCents === null && candidate.vatRateBasisPoints === null))
    ) throw new Error("ORDER_INTAKE_RECEIPT_INVALID");
    return {
      id: candidate.id,
      position: candidate.position,
      name: candidate.name,
      quantity: candidate.quantity,
      material: candidate.material,
      surfaceRequested: candidate.surfaceRequested,
      executionRequested: executionRequested as OrderIntakeExecutionRequested,
      catalogServiceId: candidate.catalogServiceId,
      unit: candidate.unit,
      unitPriceCents: candidate.unitPriceCents,
      vatRateBasisPoints: candidate.vatRateBasisPoints as 0|700|1900|null,
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
    (row.intake_term_status !== null && !TERM_STATUS_VALUES.includes(row.intake_term_status as OrderIntakeTermStatus)) ||
    (row.intake_source !== null && !INTAKE_SOURCE_VALUES.includes(row.intake_source as OrderIntakeSource)) ||
    Number.isNaN(recorded.getTime()) || row.current_order_version !== 1 ||
    (row.handover_mode !== "pickup" && row.handover_mode !== "shipping") ||
    (row.payment_mode !== "vorkasse" && row.payment_mode !== "abholung" && row.payment_mode !== "rechnung") ||
    row.current_station !== "angenommen" || row.current_status !== ORDER_LIFECYCLE_STATUS.ANGENOMMEN
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
    termStatus: row.intake_term_status as OrderIntakeTermStatus | null,
    intakeSource: row.intake_source as OrderIntakeSource | null,
    handoverMode: row.handover_mode,
    paymentMode: row.payment_mode,
    note: row.note,
    items,
    recordedAt: recorded.toISOString(),
    orderVersion: 1,
    station: "angenommen",
    status: ORDER_LIFECYCLE_STATUS.ANGENOMMEN,
  };
}

export async function searchOrderIntakeCustomers(
  authorization: Pick<AuthorizationSnapshot, "tenantId">,
  input: unknown,
): Promise<OrderIntakeCustomerOption[]> {
  if (!validSearchInput(input)) throw new Error("ORDER_INTAKE_CUSTOMER_SEARCH_INPUT_INVALID");
  return withPrivilegedTenantTransaction(authorization, async (tx) => {
    const rows = await tx.execute<CustomerRow>(sql`
      SELECT customer.*, (
        SELECT intake_order.handover_mode
        FROM public.orders intake_order
        WHERE intake_order.tenant_id = customer.tenant_id
          AND intake_order.customer_id = customer.id
          AND intake_order.handover_mode IN ('pickup', 'shipping')
          AND coalesce(intake_order.source, '') NOT IN ('seed', 'test', 'demo', 'integration-test')
        ORDER BY coalesce(intake_order.intake_date, intake_order.created_at) DESC,
                 intake_order.created_at DESC,
                 intake_order.id DESC
        LIMIT 1
      ) AS last_handover_mode
      FROM private.v_order_intake_customers_v1 customer
      WHERE ${input.query} = '' OR strpos(customer.search_text, lower(${input.query})) > 0
      ORDER BY customer.orders_count DESC, lower(coalesce(customer.company_name, customer.name)), customer.id
      LIMIT 10
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
             current_order_version, current_station, current_status,
             handover_mode, payment_mode, integrity_ok
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
