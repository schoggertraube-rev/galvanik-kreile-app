import "server-only";

import { createHash, randomUUID } from "node:crypto";
import { sql } from "drizzle-orm";
import { resolveAuthorization } from "@/lib/server/authorization";
import { withPrivilegedTenantTransaction, type PrivilegedTenantTransaction } from "@/lib/server/privilegedDb";
import { intakePaymentContract, type PaymentMode } from "@/lib/server/paymentContract";
import { ORDER_LIFECYCLE_STATUS } from "@/modules/orders/public";

const EVENT_TYPE = "ORDER_INTAKE_CREATED_V1";
const EVENT_SCHEMA_VERSION = 1 as const;
const STATION = "angenommen" as const;
const EVENT_STATION = "wareneingang" as const;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const EXECUTION_REQUESTED_VALUES = ["hochglanz", "glaenzend", "matt", "gelb_passiviert", "blau_passiviert", "offen"] as const;
const TERM_STATUS_VALUES = ["wunsch", "bestaetigt", "verschoben"] as const;
const INTAKE_SOURCE_VALUES = ["persoenlich", "versand", "abholung_firma", "anfrage_mail", "anfrage_telefon"] as const;

export type OrderIntakeExecutionRequested = typeof EXECUTION_REQUESTED_VALUES[number];
export type OrderIntakeTermStatus = typeof TERM_STATUS_VALUES[number];
export type OrderIntakeSource = typeof INTAKE_SOURCE_VALUES[number];

export type OrderIntakeItemInput = {
  catalogServiceId?: string | null;
  name: string;
  quantity: number;
  material: string | null;
  surfaceRequested: string;
  executionRequested?: OrderIntakeExecutionRequested;
  unit?: string | null;
  unitPriceCents?: number | null;
  vatRateBasisPoints?: 0 | 700 | 1900 | null;
};

export type OrderIntakeCustomerInput =
  | { mode: "EXISTING"; customerId: string }
  | {
      mode: "NEW"; name: string; customerType: "business" | "privat" | "institution";
      companyName: string | null; contactPerson: string | null; email: string | null;
      phone: string | null; street?: string; zipCode?: string; city: string | null;
      country?: string; paymentPreference?: string; vatId?: string | null;
    };

export type CreateOrderIntakeInput = {
  clientEventId: string;
  customer: OrderIntakeCustomerInput;
  dueDate: string;
  termStatus?: OrderIntakeTermStatus | null;
  intakeSource?: OrderIntakeSource | null;
  handoverMode?: "pickup" | "shipping";
  paymentMode?: PaymentMode;
  note: string | null;
  items: OrderIntakeItemInput[];
};

export type OrderIntakeReceiptItem = Required<OrderIntakeItemInput> & {
  id: string;
  position: number;
};

export type OrderIntakeReceipt = {
  receiptId: string;
  eventId: string;
  orderId: string;
  orderNumber: string;
  customerId: string;
  customerDisplayName: string;
  customerMode: "EXISTING" | "NEW";
  clientEventId: string;
  correlationId: string;
  actorId: string;
  dueDate: string;
  termStatus: OrderIntakeTermStatus | null;
  intakeSource: OrderIntakeSource | null;
  handoverMode: "pickup" | "shipping";
  paymentMode: PaymentMode;
  note: string | null;
  items: OrderIntakeReceiptItem[];
  recordedAt: string;
  orderVersion: 1;
  station: typeof STATION;
  status: typeof ORDER_LIFECYCLE_STATUS.ANGENOMMEN;
};

export type OrderIntakeCommandResult =
  | { code: "OK"; receipt: OrderIntakeReceipt; replayed: boolean }
  | { code: "UNAUTHENTICATED"; message: string }
  | { code: "FORBIDDEN"; message: string }
  | { code: "NOT_FOUND"; message: string }
  | { code: "CONFLICT"; message: string }
  | { code: "VALIDATION_ERROR"; message: string }
  | { code: "UNAVAILABLE"; message: string };

type NormalizedItem = Required<OrderIntakeItemInput>;
type NormalizedCustomer = OrderIntakeCustomerInput;
type NormalizedInput = Omit<CreateOrderIntakeInput, "customer"|"handoverMode"|"items"|"paymentMode"> & {
  customer: NormalizedCustomer;
  handoverMode: "pickup" | "shipping";
  items: NormalizedItem[];
  paymentMode: PaymentMode | null;
};

type ExistingReceiptRow = {
  receipt_id: string;
  event_id: string;
  tenant_id: string;
  order_id: string;
  customer_id: string;
  actor_id: string;
  client_event_id: string;
  correlation_id: string;
  intent_sha256: string;
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

type CustomerRow = {
  id: string;
  tenant_id: string;
  name: string;
  company_name: string | null;
  customer_number: string | null;
  contact_person: string | null;
  email: string | null;
  phone: string | null;
  street: string | null;
  zip_code: string | null;
  city: string | null;
  country: string | null;
  payment_preference: string | null;
};

type CountRow = { next_number: number | string; current_year: number | string };

function plainObject(value: unknown): value is Record<string, unknown> {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function exactKeys(value: Record<string, unknown>, expected: readonly string[]): boolean {
  const actual = Object.keys(value).sort();
  const wanted = [...expected].sort();
  return actual.length === wanted.length && actual.every((key, index) => key === wanted[index]);
}

function normalizedText(value: unknown, min: number, max: number): string | null {
  if (typeof value !== "string") return null;
  const normalized = value.trim().replace(/\s+/g, " ");
  return normalized.length >= min && normalized.length <= max ? normalized : null;
}

function normalizedOptionalText(value: unknown, max: number, min = 1): string | null | undefined {
  if (value === null) return null;
  const normalized = normalizedText(value, min, max);
  return normalized ?? undefined;
}

function validDate(value: unknown): value is string {
  if (typeof value !== "string" || !DATE_PATTERN.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

function normalizeNewCustomer(value: Record<string, unknown>): Extract<NormalizedCustomer, { mode: "NEW" }> | null {
  if (!exactKeys(value, [
    "city", "companyName", "contactPerson", "country", "customerType", "email", "mode", "name",
    "paymentPreference", "phone", "street", "vatId", "zipCode",
  ]) || value.mode !== "NEW" || !(value.customerType === "business" || value.customerType === "privat" || value.customerType === "institution")) return null;
  const name = normalizedText(value.name, 2, 160);
  const companyName = normalizedOptionalText(value.companyName, 160, 2);
  const contactPerson = normalizedText(value.contactPerson, 1, 160);
  const email = normalizedText(value.email, 3, 254);
  const phone = normalizedText(value.phone, 1, 80);
  const street = normalizedText(value.street, 2, 160);
  const zipCode = normalizedText(value.zipCode, 2, 20);
  const city = normalizedText(value.city, 1, 120);
  const country = normalizedText(value.country, 2, 120);
  const paymentPreference = normalizedText(value.paymentPreference, 3, 24);
  const vatId = normalizedOptionalText(value.vatId, 40, 4);
  if (!name || companyName === undefined || !contactPerson || !email || !/^\S+@\S+\.\S+$/.test(email) || !phone || !street || !zipCode || !city || !country
    || !paymentPreference || !/^(?:rechnung_[1-9][0-9]{0,2}|vorkasse|bar)$/.test(paymentPreference) || vatId === undefined) return null;
  return {
    mode: "NEW", name, customerType: value.customerType, companyName, contactPerson, email, phone,
    street, zipCode, city, country, paymentPreference, vatId,
  };
}

function normalizeInput(input: unknown): NormalizedInput | null {
  if (!plainObject(input)) return null;
  const hasPaymentMode = Object.hasOwn(input, "paymentMode");
  const hasTermStatus = Object.hasOwn(input, "termStatus");
  const hasIntakeSource = Object.hasOwn(input, "intakeSource");
  if (!exactKeys(input, ["clientEventId", "customer", "dueDate", "handoverMode", "items", "note",
    ...(hasPaymentMode ? ["paymentMode"] : []), ...(hasTermStatus ? ["termStatus"] : []), ...(hasIntakeSource ? ["intakeSource"] : [])])) {
    return null;
  }
  if (typeof input.clientEventId !== "string" || !UUID_PATTERN.test(input.clientEventId)) return null;
  if (!validDate(input.dueDate) || !Array.isArray(input.items) || input.items.length < 1 || input.items.length > 20) {
    return null;
  }
  if ((input.handoverMode !== "pickup" && input.handoverMode !== "shipping")
    || (hasPaymentMode && input.paymentMode !== "vorkasse" && input.paymentMode !== "abholung" && input.paymentMode !== "rechnung")) return null;
  if ((hasTermStatus && input.termStatus !== null && !TERM_STATUS_VALUES.includes(input.termStatus as OrderIntakeTermStatus))
    || (hasIntakeSource && input.intakeSource !== null && !INTAKE_SOURCE_VALUES.includes(input.intakeSource as OrderIntakeSource))) return null;
  const note = normalizedOptionalText(input.note, 2000);
  if (note === undefined) return null;

  const items: NormalizedItem[] = [];
  for (const candidate of input.items) {
    const hasExecutionRequested = plainObject(candidate) && Object.hasOwn(candidate, "executionRequested");
    if (!plainObject(candidate) || !exactKeys(candidate, [
      "catalogServiceId", ...(hasExecutionRequested ? ["executionRequested"] : []), "material", "name", "quantity", "surfaceRequested", "unit", "unitPriceCents", "vatRateBasisPoints",
    ])) {
      return null;
    }
    const name = normalizedText(candidate.name, 2, 160);
    const surfaceRequested = normalizedText(candidate.surfaceRequested, 2, 160);
    const material = normalizedOptionalText(candidate.material, 120);
    const executionRequested = hasExecutionRequested && typeof candidate.executionRequested === "string"
      && EXECUTION_REQUESTED_VALUES.includes(candidate.executionRequested as OrderIntakeExecutionRequested)
      ? candidate.executionRequested as OrderIntakeExecutionRequested
      : hasExecutionRequested ? null : "offen";
    const catalogServiceId = candidate.catalogServiceId === null ? null : normalizedText(candidate.catalogServiceId, 1, 128);
    const unit = candidate.unit === null ? null : normalizedText(candidate.unit, 1, 40);
    const unitPriceCents = typeof candidate.unitPriceCents === "number" ? candidate.unitPriceCents : null;
    const vatRateBasisPoints = typeof candidate.vatRateBasisPoints === "number" ? candidate.vatRateBasisPoints : null;
    const catalogFieldsValid = catalogServiceId !== null && UUID_PATTERN.test(catalogServiceId)
      && unit !== null
      && typeof unitPriceCents === "number" && Number.isSafeInteger(unitPriceCents) && unitPriceCents >= 0 && unitPriceCents <= 999_999_999
      && ([0, 700, 1900] as const).includes(vatRateBasisPoints as never);
    const freeTextFieldsValid = candidate.catalogServiceId === null && candidate.unit === null
      && candidate.unitPriceCents === null && candidate.vatRateBasisPoints === null;
    if (
      !name || !surfaceRequested || material === undefined || !executionRequested || (!catalogFieldsValid && !freeTextFieldsValid) ||
      typeof candidate.quantity !== "number" || !Number.isSafeInteger(candidate.quantity) ||
      candidate.quantity < 1 || candidate.quantity > 1_000_000
    ) return null;
    items.push({
      catalogServiceId,
      name, quantity: candidate.quantity, material, surfaceRequested, executionRequested, unit,
      unitPriceCents,
      vatRateBasisPoints: vatRateBasisPoints as 0 | 700 | 1900 | null,
    });
  }

  if (!plainObject(input.customer)) return null;
  let customer: NormalizedCustomer | null = null;
  if (input.customer.mode === "EXISTING" && exactKeys(input.customer, ["customerId", "mode"])) {
    const customerId = normalizedText(input.customer.customerId, 1, 128);
    if (customerId) customer = { mode: "EXISTING", customerId };
  } else if (input.customer.mode === "NEW") {
    customer = normalizeNewCustomer(input.customer);
  }
  if (!customer) return null;

  return {
    clientEventId: input.clientEventId,
    customer,
    dueDate: input.dueDate,
    termStatus: hasTermStatus ? input.termStatus as OrderIntakeTermStatus | null : null,
    intakeSource: hasIntakeSource ? input.intakeSource as OrderIntakeSource | null : null,
    handoverMode: input.handoverMode,
    paymentMode: hasPaymentMode ? input.paymentMode as PaymentMode : null,
    note,
    items,
  };
}

function canonicalIntent(input: NormalizedInput): string {
  return JSON.stringify({
    clientEventId: input.clientEventId,
    customer: input.customer,
    dueDate: input.dueDate,
    termStatus: input.termStatus,
    intakeSource: input.intakeSource,
    handoverMode: input.handoverMode,
    items: input.items,
    note: input.note,
    paymentMode: input.paymentMode,
  });
}

function intentHash(input: NormalizedInput): string {
  return createHash("sha256").update(canonicalIntent(input), "utf8").digest("hex");
}

function safeIso(value: Date | string): string | null {
  const parsed = value instanceof Date ? value : new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

function parseReceiptItems(value: unknown): OrderIntakeReceiptItem[] | null {
  if (!Array.isArray(value) || value.length < 1 || value.length > 20) return null;
  const parsed: OrderIntakeReceiptItem[] = [];
  for (let index = 0; index < value.length; index += 1) {
    const item = value[index];
    const hasExecutionRequested = plainObject(item) && Object.hasOwn(item, "executionRequested");
    if (!plainObject(item) || !exactKeys(item, [
      "catalogServiceId", ...(hasExecutionRequested ? ["executionRequested"] : []), "id", "material", "name", "position", "quantity", "surfaceRequested", "unit", "unitPriceCents", "vatRateBasisPoints",
    ])) {
      return null;
    }
    const executionRequested = hasExecutionRequested ? item.executionRequested : "offen";
    if (
      typeof item.id !== "string" || !UUID_PATTERN.test(item.id) ||
      !(item.catalogServiceId === null || (typeof item.catalogServiceId === "string" && UUID_PATTERN.test(item.catalogServiceId))) ||
      item.position !== index + 1 ||
      typeof item.name !== "string" || !normalizedText(item.name, 2, 160) ||
      typeof item.quantity !== "number" || !Number.isSafeInteger(item.quantity) || item.quantity < 1 || item.quantity > 1_000_000 ||
      (item.material !== null && (typeof item.material !== "string" || !normalizedText(item.material, 1, 120))) ||
      typeof item.surfaceRequested !== "string" || !normalizedText(item.surfaceRequested, 2, 160) ||
      typeof executionRequested !== "string" || !EXECUTION_REQUESTED_VALUES.includes(executionRequested as OrderIntakeExecutionRequested) ||
      !(item.unit === null || (typeof item.unit === "string" && normalizedText(item.unit, 1, 40))) ||
      !(item.unitPriceCents === null || (typeof item.unitPriceCents === "number" && Number.isSafeInteger(item.unitPriceCents) && item.unitPriceCents >= 0)) ||
      !(item.vatRateBasisPoints === null || ([0, 700, 1900] as const).includes(item.vatRateBasisPoints as never)) ||
      ((item.catalogServiceId === null) !== (item.unit === null && item.unitPriceCents === null && item.vatRateBasisPoints === null))
    ) return null;
    parsed.push({
      id: item.id,
      position: item.position,
      name: item.name,
      quantity: item.quantity,
      material: item.material as string | null,
      surfaceRequested: item.surfaceRequested,
      executionRequested: executionRequested as OrderIntakeExecutionRequested,
      catalogServiceId: item.catalogServiceId,
      unit: item.unit,
      unitPriceCents: item.unitPriceCents,
      vatRateBasisPoints: item.vatRateBasisPoints as 0 | 700 | 1900 | null,
    });
  }
  return parsed;
}

function toReceipt(
  row: ExistingReceiptRow,
  expected: { tenantId: string; actorId: string; clientEventId: string; intentSha256: string },
): OrderIntakeReceipt | null {
  const items = parseReceiptItems(row.items_snapshot);
  const recordedAt = safeIso(row.recorded_at);
  const dueDate = row.due_date instanceof Date
    ? row.due_date.toISOString().slice(0, 10)
    : typeof row.due_date === "string" ? row.due_date.slice(0, 10) : null;
  if (
    row.integrity_ok !== true || row.tenant_id !== expected.tenantId || row.actor_id !== expected.actorId ||
    row.client_event_id !== expected.clientEventId || row.intent_sha256 !== expected.intentSha256 ||
    !UUID_PATTERN.test(row.receipt_id) || !UUID_PATTERN.test(row.event_id) || !UUID_PATTERN.test(row.order_id) ||
    !normalizedText(row.customer_id, 1, 128) || !UUID_PATTERN.test(row.correlation_id) ||
    (row.customer_mode !== "EXISTING" && row.customer_mode !== "NEW") ||
    !/^A-\d{4}-\d{4,}$/.test(row.order_number) || !normalizedText(row.customer_display_name, 2, 160) ||
    !dueDate || !validDate(dueDate) || (row.note !== null && !normalizedText(row.note, 1, 2000)) ||
    (row.intake_term_status !== null && !TERM_STATUS_VALUES.includes(row.intake_term_status as OrderIntakeTermStatus)) ||
    (row.intake_source !== null && !INTAKE_SOURCE_VALUES.includes(row.intake_source as OrderIntakeSource)) ||
    !items || !recordedAt || row.current_order_version !== 1 || row.current_station !== STATION ||
    (row.handover_mode !== "pickup" && row.handover_mode !== "shipping") ||
    (row.payment_mode !== "vorkasse" && row.payment_mode !== "abholung" && row.payment_mode !== "rechnung") ||
    row.current_status !== ORDER_LIFECYCLE_STATUS.ANGENOMMEN
  ) return null;
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
    recordedAt,
    orderVersion: 1,
    station: STATION,
    status: ORDER_LIFECYCLE_STATUS.ANGENOMMEN,
  };
}

async function readReceipt(
  tx: PrivilegedTenantTransaction,
  expected: { tenantId: string; actorId: string; clientEventId: string; intentSha256: string },
): Promise<OrderIntakeReceipt | null> {
  const rows = await tx.execute<ExistingReceiptRow>(sql`
    SELECT *
    FROM private.v_order_intake_receipts_v1
    WHERE actor_id = ${expected.actorId}
      AND client_event_id = ${expected.clientEventId}
    LIMIT 2
  `);
  if (rows.length === 0) return null;
  if (rows.length !== 1 || !rows[0]) throw new Error("ORDER_INTAKE_RECEIPT_AMBIGUOUS");
  const receipt = toReceipt(rows[0], expected);
  if (!receipt) throw new Error("ORDER_INTAKE_RECEIPT_INVALID");
  return receipt;
}

async function resolveCustomer(
  tx: PrivilegedTenantTransaction,
  tenantId: string,
  actorId: string,
  customer: NormalizedCustomer,
): Promise<CustomerRow | null> {
  if (customer.mode === "NEW") {
    const clientEventId = randomUUID();
    const customerIntentSha256 = createHash("sha256").update(JSON.stringify({
      city: customer.city,
      clientEventId,
      companyName: customer.companyName,
      contactPerson: customer.contactPerson,
      customerType: customer.customerType,
      email: customer.email,
      name: customer.name,
      phone: customer.phone,
      street: customer.street,
      zipCode: customer.zipCode,
      country: customer.country,
      paymentPreference: customer.paymentPreference,
      vatId: customer.vatId,
    }), "utf8").digest("hex");
    const outcomes = await tx.execute<{ result_code: string; result_receipt_id: string | null }>(sql`
      SELECT * FROM private.create_customer_v1(
        ${tenantId}, ${actorId}::uuid, ${clientEventId}::uuid, ${customerIntentSha256},
        ${customer.name}, ${customer.customerType}, ${customer.companyName}, ${customer.contactPerson},
        ${customer.email}, ${customer.phone}, ${customer.street}, ${customer.zipCode}, ${customer.city},
        ${customer.country}, ${customer.paymentPreference}, ${customer.vatId}, NULL::text
      )
    `);
    const outcome = outcomes.length === 1 ? outcomes[0] : null;
    if (!outcome || outcome.result_code !== "OK" || !outcome.result_receipt_id) return null;
    const receipts = await tx.execute<{ customer_id: string }>(sql`
      SELECT customer_id FROM private.v_customer_create_receipts_v1
      WHERE receipt_id = ${outcome.result_receipt_id}::uuid
        AND tenant_id = ${tenantId}
        AND actor_id = ${actorId}::uuid
      LIMIT 2
    `);
    if (receipts.length !== 1 || !receipts[0]) return null;
    const rows = await tx.execute<CustomerRow>(sql`
      SELECT id, tenant_id, customer_number, name, company_name, contact_person, email, phone,
        street, zip_code, city, country, payment_preference
      FROM public.customers
      WHERE id = ${receipts[0].customer_id} AND tenant_id = ${tenantId}
      FOR SHARE
    `);
    return rows.length === 1 ? rows[0] ?? null : null;
  }
  const rows = await tx.execute<CustomerRow>(sql`
    SELECT id, tenant_id, customer_number, name, company_name, contact_person, email, phone,
      street, zip_code, city, country, payment_preference
    FROM public.customers
    WHERE id = ${customer.customerId} AND tenant_id = ${tenantId}
    FOR SHARE
  `);
  const row = rows.length === 1 ? rows[0] : null;
  if (!row || !row.customer_number || !row.contact_person || !row.email || !row.phone || !row.street ||
    !row.zip_code || !row.city || !row.country) return null;
  return row;
}

async function allocateOrderNumber(tx: PrivilegedTenantTransaction): Promise<string> {
  await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtextextended('f1:order-number', 0))`);
  const rows = await tx.execute<CountRow>(sql`
    WITH current_clock AS (
      SELECT extract(year FROM statement_timestamp() AT TIME ZONE 'Europe/Berlin')::int AS current_year
    )
    SELECT
      clock.current_year,
      coalesce(max(substring(orders.order_number FROM '[0-9]+$')::int), 0) + 1 AS next_number
    FROM current_clock clock
    LEFT JOIN public.orders orders
      ON orders.order_number ~ ('^A-' || clock.current_year::text || '-[0-9]{4,}$')
    GROUP BY clock.current_year
  `);
  const row = rows[0];
  const year = Number(row?.current_year);
  const next = Number(row?.next_number);
  if (rows.length !== 1 || !Number.isSafeInteger(year) || year < 2000 || year > 9999 || !Number.isSafeInteger(next) || next < 1) {
    throw new Error("ORDER_INTAKE_NUMBER_INVALID");
  }
  return `A-${year}-${String(next).padStart(4, "0")}`;
}

export async function createOrderIntake(input: unknown): Promise<OrderIntakeCommandResult> {
  const normalized = normalizeInput(input);
  if (!normalized) return { code: "VALIDATION_ERROR", message: "Wareneingangsdaten sind unvollständig oder ungültig." };

  const authorization = await resolveAuthorization();
  if (!authorization.ok) {
    return authorization.reason === "AUTHORIZATION_UNAVAILABLE"
      ? { code: "UNAVAILABLE", message: authorization.message }
      : { code: "UNAUTHENTICATED", message: authorization.message };
  }
  if (!authorization.data.permissions.includes("perm_data_orders")) {
    return { code: "FORBIDDEN", message: "Aufträge dürfen mit dieser Rolle nicht angelegt werden." };
  }
  if (normalized.customer.mode === "NEW" && !authorization.data.permissions.includes("perm_data_customers")) {
    return { code: "FORBIDDEN", message: "Kunden dürfen mit dieser Rolle nicht angelegt werden." };
  }
  const canManageMoney = authorization.data.areas?.includes("geld") === true;
  if (canManageMoney && normalized.paymentMode === null) {
    return { code: "VALIDATION_ERROR", message: "Zahlungsmodus ist erforderlich." };
  }
  if (!canManageMoney && normalized.paymentMode !== null) {
    return { code: "FORBIDDEN", message: "Zahlungsmodus darf ohne Geld-Recht nicht vorgegeben werden." };
  }
  if (!canManageMoney && normalized.items.some((item) => item.unitPriceCents !== null || item.vatRateBasisPoints !== null)) {
    return { code: "FORBIDDEN", message: "Preise dürfen ohne Geld-Recht nicht vorgegeben werden." };
  }
  const expected = {
    tenantId: authorization.data.tenantId,
    actorId: authorization.data.userId,
    clientEventId: normalized.clientEventId,
    intentSha256: intentHash(normalized),
  };

  try {
    return await withPrivilegedTenantTransaction(authorization.data, async (tx) => {
      await tx.execute(sql`
        SELECT pg_advisory_xact_lock(hashtextextended(
          'f1:order-intake:' || ${expected.tenantId} || ':' || ${expected.actorId} || ':' || ${expected.clientEventId}, 0
        ))
      `);

      const existingRows = await tx.execute<{ intent_sha256: string }>(sql`
        SELECT intent_sha256
        FROM private.order_intake_receipts
        WHERE tenant_id = ${expected.tenantId}
          AND actor_id = ${expected.actorId}
          AND client_event_id = ${expected.clientEventId}
        LIMIT 2
      `);
      if (existingRows.length > 0) {
        if (existingRows.length !== 1 || existingRows[0]?.intent_sha256 !== expected.intentSha256) {
          return { code: "CONFLICT", message: "Anfragekennung wurde bereits anders verwendet." };
        }
        const receipt = await readReceipt(tx, expected);
        if (!receipt) throw new Error("ORDER_INTAKE_REPLAY_MISSING");
        return { code: "OK", receipt, replayed: true };
      }

      for (const item of normalized.items) {
        if (item.catalogServiceId === null) continue;
        const services = await tx.execute<{
          id: string; name: string; surface: string; unit: string;
          net_price_cents: number; vat_rate_basis_points: number;
        }>(sql`
          SELECT id, name, surface, unit, net_price_cents, vat_rate_basis_points
          FROM public.catalog_services
          WHERE id = ${item.catalogServiceId}::uuid
            AND tenant_id = ${expected.tenantId}
            AND active = true
          FOR SHARE
        `);
        const service = services.length === 1 ? services[0] : null;
        if (!service || service.name !== item.name || service.surface !== item.surfaceRequested
          || service.unit !== item.unit || service.net_price_cents !== item.unitPriceCents
          || service.vat_rate_basis_points !== item.vatRateBasisPoints) {
          return { code: "VALIDATION_ERROR", message: "Leistung oder Preis ist nicht mehr aktuell." };
        }
      }

      let paymentContract = normalized.customer.mode === "NEW"
        ? intakePaymentContract({
            customerMode: "NEW",
            paymentPreference: normalized.customer.paymentPreference,
            handoverMode: normalized.handoverMode,
            requestedMode: normalized.paymentMode ?? undefined,
          })
        : null;
      if (paymentContract && !paymentContract.ok) {
        return { code: "VALIDATION_ERROR", message: paymentContract.message };
      }

      const customer = await resolveCustomer(tx, expected.tenantId, expected.actorId, normalized.customer);
      if (!customer || customer.tenant_id !== expected.tenantId) {
        if (normalized.customer.mode === "NEW") throw new Error("ORDER_INTAKE_NEW_CUSTOMER_INVALID");
        return { code: "VALIDATION_ERROR", message: "Der Kunde ist für einen Auftrag noch nicht vollständig." };
      }
      paymentContract ??= intakePaymentContract({
        customerMode: "EXISTING",
        paymentPreference: customer.payment_preference,
        handoverMode: normalized.handoverMode,
        requestedMode: normalized.paymentMode ?? undefined,
      });
      if (!paymentContract.ok) {
        return { code: "VALIDATION_ERROR", message: paymentContract.message };
      }
      const paymentMode = paymentContract.mode;

      const orderId = randomUUID();
      const eventId = randomUUID();
      const correlationId = randomUUID();
      const orderNumber = await allocateOrderNumber(tx);
      const customerDisplayName = normalizedText(customer.company_name, 2, 160)
        ?? normalizedText(customer.name, 2, 160);
      if (!customerDisplayName) {
        if (normalized.customer.mode === "NEW") throw new Error("ORDER_INTAKE_NEW_CUSTOMER_DISPLAY_INVALID");
        return { code: "VALIDATION_ERROR", message: "Kundenzuordnung ist ungültig." };
      }
      const items: OrderIntakeReceiptItem[] = normalized.items.map((item, index) => ({
        id: randomUUID(), position: index + 1, ...item,
      }));
      const title = `${customerDisplayName} · ${items[0]?.name ?? "Wareneingang"}`.slice(0, 240);
      const task = items.map((item) => `${item.quantity}× ${item.name} · ${item.surfaceRequested}`).join("; ").slice(0, 2000);

      const insertedOrders = await tx.execute<{
        id: string;
        tenant_id: string;
        order_number: string;
        version: number;
        payment_mode: string;
        payment_mode_version: number;
      }>(sql`
        INSERT INTO public.orders (
          id, tenant_id, order_number, customer_id, title, task, station,
          current_station, current_station_id, version, status, risk, priority_computed,
          intake_date, due_date, promised_due_date, intake_term_status, intake_source, source, source_ref, freetext_original,
          handover_mode, payment_mode, payment_mode_version, created_at
        ) VALUES (
          ${orderId}, ${expected.tenantId}, ${orderNumber}, ${customer.id}, ${title}, ${task}, ${STATION},
          ${STATION}, ${STATION}, 1, ${ORDER_LIFECYCLE_STATUS.ANGENOMMEN}, 'green', 'green',
          statement_timestamp() AT TIME ZONE 'UTC', ${normalized.dueDate}::date, ${normalized.dueDate}::date,
          ${normalized.termStatus}, ${normalized.intakeSource},
          'F1_ORDER_INTAKE', ${normalized.clientEventId}, ${normalized.note},
          ${normalized.handoverMode}, ${paymentMode}, 0, statement_timestamp() AT TIME ZONE 'UTC'
        )
        RETURNING id, tenant_id, order_number, version, payment_mode, payment_mode_version
      `);
      const insertedOrder = insertedOrders[0];
      if (
        insertedOrders.length !== 1 || !insertedOrder || insertedOrder.id !== orderId ||
        insertedOrder.tenant_id !== expected.tenantId || insertedOrder.order_number !== orderNumber ||
        insertedOrder.version !== 1 || insertedOrder.payment_mode !== paymentMode ||
        insertedOrder.payment_mode_version !== 0
      ) throw new Error("ORDER_INTAKE_ORDER_INSERT_FAILED");

      for (const item of items) {
        const insertedItems = await tx.execute<{ id: string; tenant_id: string; order_id: string; customer_id: string }>(sql`
          INSERT INTO public.items (
            id, tenant_id, order_id, customer_id, name, quantity, current_station_id,
            material, surface_requested, execution_requested, catalog_service_id, unit, preis_netto, vat_rate_basis_points,
            internal_notes, created_at
          ) VALUES (
            ${item.id}, ${expected.tenantId}, ${orderId}, ${customer.id}, ${item.name}, ${item.quantity}, ${STATION},
            ${item.material}, ${item.surfaceRequested}, ${item.executionRequested}, ${item.catalogServiceId}::uuid, ${item.unit},
            ${item.unitPriceCents === null ? null : (item.unitPriceCents / 100).toFixed(2)}, ${item.vatRateBasisPoints},
            ${normalized.note}, statement_timestamp() AT TIME ZONE 'UTC'
          )
          RETURNING id, tenant_id, order_id, customer_id
        `);
        const insertedItem = insertedItems[0];
        if (
          insertedItems.length !== 1 || !insertedItem || insertedItem.id !== item.id ||
          insertedItem.tenant_id !== expected.tenantId || insertedItem.order_id !== orderId ||
          insertedItem.customer_id !== customer.id
        ) throw new Error("ORDER_INTAKE_ITEM_INSERT_FAILED");
      }

      const insertedEvents = await tx.execute<{ id: string; tenant_id: string; order_id: string; user_id: string; client_event_id: string }>(sql`
        INSERT INTO public.events (
          id, tenant_id, order_id, item_id, event_type, description, notes, payload,
          status, user_id, station, client_event_id, event_schema_version,
          correlation_id, aggregate_version, from_station, created_at
        ) VALUES (
          ${eventId}, ${expected.tenantId}, ${orderId}, NULL, ${EVENT_TYPE},
          'Digitaler Wareneingang angelegt', ${normalized.note},
          ${JSON.stringify({
            intentSha256: expected.intentSha256,
            handoverMode: normalized.handoverMode,
            paymentMode,
          })}::jsonb,
          'success', ${expected.actorId}, ${EVENT_STATION}, ${expected.clientEventId}, ${EVENT_SCHEMA_VERSION},
          ${correlationId}, 1, NULL, statement_timestamp() AT TIME ZONE 'UTC'
        )
        RETURNING id, tenant_id, order_id, user_id, client_event_id
      `);
      const insertedEvent = insertedEvents[0];
      if (
        insertedEvents.length !== 1 || !insertedEvent || insertedEvent.id !== eventId ||
        insertedEvent.tenant_id !== expected.tenantId || insertedEvent.order_id !== orderId ||
        insertedEvent.user_id !== expected.actorId || insertedEvent.client_event_id !== expected.clientEventId
      ) throw new Error("ORDER_INTAKE_EVENT_INSERT_FAILED");

      const receiptId = randomUUID();
      const insertedReceipts = await tx.execute<{ id: string; event_id: string; order_id: string; intent_sha256: string }>(sql`
        INSERT INTO private.order_intake_receipts (
          id, event_id, tenant_id, order_id, customer_id, actor_id, client_event_id,
          correlation_id, intent_sha256, customer_mode, order_number, customer_display_name,
          due_date, intake_term_status, intake_source, note, items_snapshot, created_at
        ) VALUES (
          ${receiptId}, ${eventId}, ${expected.tenantId}, ${orderId}, ${customer.id}, ${expected.actorId},
          ${expected.clientEventId}, ${correlationId}, ${expected.intentSha256}, ${normalized.customer.mode},
          ${orderNumber}, ${customerDisplayName}, ${normalized.dueDate}::date,
          ${normalized.termStatus}, ${normalized.intakeSource}, ${normalized.note},
          ${JSON.stringify(items)}::jsonb, statement_timestamp()
        )
        RETURNING id, event_id, order_id, intent_sha256
      `);
      const insertedReceipt = insertedReceipts[0];
      if (
        insertedReceipts.length !== 1 || !insertedReceipt || insertedReceipt.id !== receiptId ||
        insertedReceipt.event_id !== eventId || insertedReceipt.order_id !== orderId ||
        insertedReceipt.intent_sha256 !== expected.intentSha256
      ) throw new Error("ORDER_INTAKE_RECEIPT_INSERT_FAILED");

      const receipt = await readReceipt(tx, expected);
      if (!receipt || receipt.orderId !== orderId || receipt.eventId !== eventId || receipt.receiptId !== receiptId) {
        throw new Error("ORDER_INTAKE_READBACK_INVALID");
      }
      return { code: "OK", receipt, replayed: false };
    });
  } catch (error) {
    console.error("[ORDER_INTAKE_WRITE_FAILED]", {
      errorName: error instanceof Error ? error.name : "UnknownError",
      errorMessage: error instanceof Error ? error.message : "Unbekannter Serverfehler",
    });
    return { code: "UNAVAILABLE", message: "Wareneingang konnte nicht sicher gespeichert werden. Fehlercode: ORDER_INTAKE_WRITE_FAILED." };
  }
}
