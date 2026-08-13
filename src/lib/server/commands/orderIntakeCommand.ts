import "server-only";

import { createHash, randomUUID } from "node:crypto";
import { sql } from "drizzle-orm";
import { resolveAuthorization } from "@/lib/server/authorization";
import { withPrivilegedTenantTransaction, type PrivilegedTenantTransaction } from "@/lib/server/privilegedDb";

const EVENT_TYPE = "ORDER_INTAKE_CREATED_V1";
const EVENT_SCHEMA_VERSION = 1 as const;
const STATION = "wareneingang" as const;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export type OrderIntakeItemInput = {
  name: string;
  quantity: number;
  material: string | null;
  surfaceRequested: string;
};

export type OrderIntakeCustomerInput =
  | { mode: "EXISTING"; customerId: string }
  | {
      mode: "NEW";
      name: string;
      customerType: "business" | "privat" | "institution";
      companyName: string | null;
      contactPerson: string | null;
      email: string | null;
      phone: string | null;
      city: string | null;
    };

export type CreateOrderIntakeInput = {
  clientEventId: string;
  customer: OrderIntakeCustomerInput;
  dueDate: string;
  note: string | null;
  items: OrderIntakeItemInput[];
};

export type OrderIntakeReceiptItem = OrderIntakeItemInput & {
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
  note: string | null;
  items: OrderIntakeReceiptItem[];
  recordedAt: string;
  orderVersion: 1;
  station: typeof STATION;
  status: "in_progress";
};

export type OrderIntakeCommandResult =
  | { code: "OK"; receipt: OrderIntakeReceipt; replayed: boolean }
  | { code: "UNAUTHENTICATED"; message: string }
  | { code: "FORBIDDEN"; message: string }
  | { code: "NOT_FOUND"; message: string }
  | { code: "CONFLICT"; message: string }
  | { code: "VALIDATION_ERROR"; message: string }
  | { code: "UNAVAILABLE"; message: string };

type NormalizedInput = CreateOrderIntakeInput;

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
  note: string | null;
  items_snapshot: unknown;
  recorded_at: Date | string;
  current_order_version: number;
  current_station: string;
  current_status: string;
  integrity_ok: boolean;
};

type CustomerRow = {
  id: string;
  tenant_id: string;
  name: string;
  company_name: string | null;
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

function normalizeInput(input: unknown): NormalizedInput | null {
  if (!plainObject(input) || !exactKeys(input, ["clientEventId", "customer", "dueDate", "items", "note"])) {
    return null;
  }
  if (typeof input.clientEventId !== "string" || !UUID_PATTERN.test(input.clientEventId)) return null;
  if (!validDate(input.dueDate) || !Array.isArray(input.items) || input.items.length < 1 || input.items.length > 20) {
    return null;
  }
  const note = normalizedOptionalText(input.note, 2000);
  if (note === undefined) return null;

  const items: OrderIntakeItemInput[] = [];
  for (const candidate of input.items) {
    if (!plainObject(candidate) || !exactKeys(candidate, ["material", "name", "quantity", "surfaceRequested"])) {
      return null;
    }
    const name = normalizedText(candidate.name, 2, 160);
    const surfaceRequested = normalizedText(candidate.surfaceRequested, 2, 160);
    const material = normalizedOptionalText(candidate.material, 120);
    if (
      !name || !surfaceRequested || material === undefined ||
      typeof candidate.quantity !== "number" || !Number.isSafeInteger(candidate.quantity) ||
      candidate.quantity < 1 || candidate.quantity > 1_000_000
    ) return null;
    items.push({ name, quantity: candidate.quantity, material, surfaceRequested });
  }

  if (!plainObject(input.customer) || typeof input.customer.mode !== "string") return null;
  let customer: OrderIntakeCustomerInput;
  if (input.customer.mode === "EXISTING") {
    if (!exactKeys(input.customer, ["customerId", "mode"])) return null;
    const customerId = normalizedText(input.customer.customerId, 1, 128);
    if (!customerId) return null;
    customer = { mode: "EXISTING", customerId };
  } else if (input.customer.mode === "NEW") {
    if (!exactKeys(input.customer, [
      "city", "companyName", "contactPerson", "customerType", "email", "mode", "name", "phone",
    ])) return null;
    const name = normalizedText(input.customer.name, 2, 160);
    const companyName = normalizedOptionalText(input.customer.companyName, 160, 2);
    const contactPerson = normalizedOptionalText(input.customer.contactPerson, 160);
    const email = normalizedOptionalText(input.customer.email, 254);
    const phone = normalizedOptionalText(input.customer.phone, 80);
    const city = normalizedOptionalText(input.customer.city, 120);
    if (
      !name || companyName === undefined || contactPerson === undefined || email === undefined ||
      phone === undefined || city === undefined ||
      !["business", "privat", "institution"].includes(String(input.customer.customerType)) ||
      (email !== null && !EMAIL_PATTERN.test(email))
    ) return null;
    customer = {
      mode: "NEW",
      name,
      customerType: input.customer.customerType as "business" | "privat" | "institution",
      companyName,
      contactPerson,
      email,
      phone,
      city,
    };
  } else {
    return null;
  }

  return { clientEventId: input.clientEventId, customer, dueDate: input.dueDate, note, items };
}

function canonicalIntent(input: NormalizedInput): string {
  return JSON.stringify({
    clientEventId: input.clientEventId,
    customer: input.customer,
    dueDate: input.dueDate,
    items: input.items,
    note: input.note,
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
    if (!plainObject(item) || !exactKeys(item, ["id", "material", "name", "position", "quantity", "surfaceRequested"])) {
      return null;
    }
    if (
      typeof item.id !== "string" || !UUID_PATTERN.test(item.id) ||
      item.position !== index + 1 ||
      typeof item.name !== "string" || !normalizedText(item.name, 2, 160) ||
      typeof item.quantity !== "number" || !Number.isSafeInteger(item.quantity) || item.quantity < 1 || item.quantity > 1_000_000 ||
      (item.material !== null && (typeof item.material !== "string" || !normalizedText(item.material, 1, 120))) ||
      typeof item.surfaceRequested !== "string" || !normalizedText(item.surfaceRequested, 2, 160)
    ) return null;
    parsed.push({
      id: item.id,
      position: item.position,
      name: item.name,
      quantity: item.quantity,
      material: item.material as string | null,
      surfaceRequested: item.surfaceRequested,
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
    !items || !recordedAt || row.current_order_version !== 1 || row.current_station !== STATION ||
    row.current_status !== "in_progress"
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
    note: row.note,
    items,
    recordedAt,
    orderVersion: 1,
    station: STATION,
    status: "in_progress",
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
  customer: OrderIntakeCustomerInput,
): Promise<CustomerRow | null> {
  if (customer.mode === "EXISTING") {
    const rows = await tx.execute<CustomerRow>(sql`
      SELECT id, tenant_id, name, company_name
      FROM public.customers
      WHERE id = ${customer.customerId}
        AND tenant_id = ${tenantId}
      FOR SHARE
    `);
    return rows.length === 1 && rows[0] ? rows[0] : null;
  }
  const id = randomUUID();
  const rows = await tx.execute<CustomerRow>(sql`
    INSERT INTO public.customers (
      id, tenant_id, customer_number, name, type, company_name,
      contact_person, email, phone, city, source, source_ref, created_at, updated_at
    ) VALUES (
      ${id}, ${tenantId}, NULL, ${customer.name}, ${customer.customerType}, ${customer.companyName},
      ${customer.contactPerson}, ${customer.email}, ${customer.phone}, ${customer.city},
      'F1_ORDER_INTAKE', ${id}, statement_timestamp() AT TIME ZONE 'UTC', statement_timestamp() AT TIME ZONE 'UTC'
    )
    RETURNING id, tenant_id, name, company_name
  `);
  return rows.length === 1 && rows[0] ? rows[0] : null;
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

  const authorization = await resolveAuthorization().catch(() => null);
  if (!authorization) return { code: "UNAVAILABLE", message: "Wareneingang ist derzeit nicht verfügbar." };
  if (!authorization.ok) {
    return authorization.reason === "AUTHORIZATION_UNAVAILABLE"
      ? { code: "UNAVAILABLE", message: "Wareneingang ist derzeit nicht verfügbar." }
      : { code: "UNAUTHENTICATED", message: "Sitzung oder Berechtigung ist nicht verfügbar." };
  }
  if (!authorization.data.permissions.includes("perm_data_orders")) {
    return { code: "FORBIDDEN", message: "Aufträge dürfen mit dieser Rolle nicht angelegt werden." };
  }
  if (normalized.customer.mode === "NEW" && !authorization.data.permissions.includes("perm_data_customers")) {
    return { code: "FORBIDDEN", message: "Neue Kunden dürfen mit dieser Rolle nicht angelegt werden." };
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

      const customer = await resolveCustomer(tx, expected.tenantId, normalized.customer);
      if (!customer || customer.tenant_id !== expected.tenantId) {
        if (normalized.customer.mode === "EXISTING") {
          return { code: "NOT_FOUND", message: "Kunde ist nicht verfügbar." };
        }
        throw new Error("ORDER_INTAKE_CUSTOMER_INSERT_FAILED");
      }

      const orderId = randomUUID();
      const eventId = randomUUID();
      const correlationId = randomUUID();
      const orderNumber = await allocateOrderNumber(tx);
      const customerDisplayName = normalizedText(customer.company_name, 2, 160)
        ?? normalizedText(customer.name, 2, 160);
      if (!customerDisplayName) {
        return { code: "VALIDATION_ERROR", message: "Kundenzuordnung ist ungültig." };
      }
      const items: OrderIntakeReceiptItem[] = normalized.items.map((item, index) => ({
        id: randomUUID(), position: index + 1, ...item,
      }));
      const title = `${customerDisplayName} · ${items[0]?.name ?? "Wareneingang"}`.slice(0, 240);
      const task = items.map((item) => `${item.quantity}× ${item.name} · ${item.surfaceRequested}`).join("; ").slice(0, 2000);

      const insertedOrders = await tx.execute<{ id: string; tenant_id: string; order_number: string; version: number }>(sql`
        INSERT INTO public.orders (
          id, tenant_id, order_number, customer_id, title, task, station,
          current_station, current_station_id, version, status, risk, priority_computed,
          intake_date, due_date, source, source_ref, freetext_original, created_at
        ) VALUES (
          ${orderId}, ${expected.tenantId}, ${orderNumber}, ${customer.id}, ${title}, ${task}, ${STATION},
          ${STATION}, ${STATION}, 1, 'in_progress', 'green', 'green',
          statement_timestamp() AT TIME ZONE 'UTC', ${normalized.dueDate}::date,
          'F1_ORDER_INTAKE', ${normalized.clientEventId}, ${normalized.note}, statement_timestamp() AT TIME ZONE 'UTC'
        )
        RETURNING id, tenant_id, order_number, version
      `);
      const insertedOrder = insertedOrders[0];
      if (
        insertedOrders.length !== 1 || !insertedOrder || insertedOrder.id !== orderId ||
        insertedOrder.tenant_id !== expected.tenantId || insertedOrder.order_number !== orderNumber || insertedOrder.version !== 1
      ) throw new Error("ORDER_INTAKE_ORDER_INSERT_FAILED");

      for (const item of items) {
        const insertedItems = await tx.execute<{ id: string; tenant_id: string; order_id: string; customer_id: string }>(sql`
          INSERT INTO public.items (
            id, tenant_id, order_id, customer_id, name, quantity, current_station_id,
            material, surface_requested, internal_notes, created_at
          ) VALUES (
            ${item.id}, ${expected.tenantId}, ${orderId}, ${customer.id}, ${item.name}, ${item.quantity}, ${STATION},
            ${item.material}, ${item.surfaceRequested}, ${normalized.note}, statement_timestamp() AT TIME ZONE 'UTC'
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
          ${JSON.stringify({ intentSha256: expected.intentSha256 })}::jsonb,
          'success', ${expected.actorId}, ${STATION}, ${expected.clientEventId}, ${EVENT_SCHEMA_VERSION},
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
          due_date, note, items_snapshot, created_at
        ) VALUES (
          ${receiptId}, ${eventId}, ${expected.tenantId}, ${orderId}, ${customer.id}, ${expected.actorId},
          ${expected.clientEventId}, ${correlationId}, ${expected.intentSha256}, ${normalized.customer.mode},
          ${orderNumber}, ${customerDisplayName}, ${normalized.dueDate}::date, ${normalized.note},
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
  } catch {
    return { code: "UNAVAILABLE", message: "Wareneingang konnte nicht sicher gespeichert werden." };
  }
}
