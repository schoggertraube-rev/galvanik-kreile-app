import "server-only";

import { createHash, randomUUID } from "node:crypto";
import { sql } from "drizzle-orm";
import { withPrivilegedTenantTransaction, type PrivilegedTenantTransaction } from "@/lib/server/privilegedDb";

const EVENT_TYPE = "CUSTOMER_CREATED_V1";
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export type CustomerCommandAuthorization = {
  tenantId: string;
  userId: string;
  permissions: readonly string[];
};

export type CreateCustomerInput = {
  clientEventId: string;
  name: string;
  customerType: "business" | "privat" | "institution";
  companyName: string | null;
  contactPerson: string | null;
  email: string | null;
  phone: string | null;
  city: string | null;
};

export type CustomerCreateReceipt = {
  receiptId: string;
  eventId: string;
  customerId: string;
  customerNumber: string;
  clientEventId: string;
  correlationId: string;
  actorId: string;
  name: string;
  customerType: CreateCustomerInput["customerType"];
  companyName: string | null;
  contactPerson: string | null;
  email: string | null;
  phone: string | null;
  city: string | null;
  recordedAt: string;
  aggregateVersion: 1;
};

export type CustomerCreateCommandResult =
  | { code: "OK"; receipt: CustomerCreateReceipt; replayed: boolean }
  | { code: "FORBIDDEN" | "CONFLICT" | "VALIDATION_ERROR" | "UNAVAILABLE"; message: string };

type ReceiptRow = {
  receipt_id: string;
  event_id: string;
  tenant_id: string;
  customer_id: string;
  customer_number: string;
  actor_id: string;
  client_event_id: string;
  correlation_id: string;
  intent_sha256: string;
  name: string;
  customer_type: string;
  company_name: string | null;
  contact_person: string | null;
  email: string | null;
  phone: string | null;
  city: string | null;
  recorded_at: Date | string;
  integrity_ok: boolean;
};

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function exactKeys(value: Record<string, unknown>, keys: readonly string[]): boolean {
  const actual = Object.keys(value).sort();
  const expected = [...keys].sort();
  return actual.length === expected.length && actual.every((key, index) => key === expected[index]);
}

function requiredText(value: unknown, min: number, max: number): string | null {
  if (typeof value !== "string") return null;
  const normalized = value.trim().replace(/\s+/g, " ");
  return normalized.length >= min && normalized.length <= max ? normalized : null;
}

function optionalText(value: unknown, min: number, max: number): string | null | undefined {
  if (value === null) return null;
  return requiredText(value, min, max) ?? undefined;
}

function normalizeInput(value: unknown): CreateCustomerInput | null {
  if (!isPlainObject(value) || !exactKeys(value, [
    "city", "clientEventId", "companyName", "contactPerson", "customerType", "email", "name", "phone",
  ])) return null;
  if (typeof value.clientEventId !== "string" || !UUID_PATTERN.test(value.clientEventId)) return null;
  if (!(["business", "privat", "institution"] as const).includes(value.customerType as never)) return null;
  const name = requiredText(value.name, 2, 160);
  const companyName = optionalText(value.companyName, 2, 160);
  const contactPerson = optionalText(value.contactPerson, 1, 160);
  const email = optionalText(value.email, 3, 254);
  const phone = optionalText(value.phone, 1, 80);
  const city = optionalText(value.city, 1, 120);
  if (!name || companyName === undefined || contactPerson === undefined || email === undefined || phone === undefined || city === undefined) return null;
  if (email !== null && !EMAIL_PATTERN.test(email)) return null;
  return {
    clientEventId: value.clientEventId,
    name,
    customerType: value.customerType as CreateCustomerInput["customerType"],
    companyName,
    contactPerson,
    email,
    phone,
    city,
  };
}

function intentHash(input: CreateCustomerInput): string {
  return createHash("sha256").update(JSON.stringify({
    city: input.city,
    clientEventId: input.clientEventId,
    companyName: input.companyName,
    contactPerson: input.contactPerson,
    customerType: input.customerType,
    email: input.email,
    name: input.name,
    phone: input.phone,
  }), "utf8").digest("hex");
}

function diagnosticField(error: unknown, key: "message" | "details" | "hint"): string | null {
  if (!error || typeof error !== "object") return null;
  const record = error as Record<string, unknown>;
  const source = record.cause && typeof record.cause === "object"
    ? record.cause as Record<string, unknown>
    : record;
  const value = source[key] ?? (key === "details" ? source.detail : null);
  if (typeof value !== "string") return null;
  if (/\b(?:select|insert|update|delete)\b|params:/i.test(value)) return "DATABASE_OPERATION_FAILED";
  return value.replace(/\s+/g, " ").slice(0, 500);
}

function receiptFromRow(
  row: ReceiptRow,
  expected: { tenantId: string; userId: string; clientEventId: string; intentSha256: string },
): CustomerCreateReceipt | null {
  const recordedAt = row.recorded_at instanceof Date ? row.recorded_at : new Date(row.recorded_at);
  if (
    row.integrity_ok !== true
    || row.tenant_id !== expected.tenantId
    || row.actor_id !== expected.userId
    || row.client_event_id !== expected.clientEventId
    || row.intent_sha256 !== expected.intentSha256
    || !UUID_PATTERN.test(row.receipt_id)
    || !UUID_PATTERN.test(row.event_id)
    || !UUID_PATTERN.test(row.customer_id)
    || !UUID_PATTERN.test(row.correlation_id)
    || !/^K-\d{4}-\d{4,}$/.test(row.customer_number)
    || !(["business", "privat", "institution"] as const).includes(row.customer_type as never)
    || !Number.isFinite(recordedAt.getTime())
  ) return null;
  return {
    receiptId: row.receipt_id,
    eventId: row.event_id,
    customerId: row.customer_id,
    customerNumber: row.customer_number,
    clientEventId: row.client_event_id,
    correlationId: row.correlation_id,
    actorId: row.actor_id,
    name: row.name,
    customerType: row.customer_type as CreateCustomerInput["customerType"],
    companyName: row.company_name,
    contactPerson: row.contact_person,
    email: row.email,
    phone: row.phone,
    city: row.city,
    recordedAt: recordedAt.toISOString(),
    aggregateVersion: 1,
  };
}

async function readReceipt(
  tx: PrivilegedTenantTransaction,
  expected: { tenantId: string; userId: string; clientEventId: string; intentSha256: string },
): Promise<CustomerCreateReceipt | null> {
  const rows = await tx.execute<ReceiptRow>(sql`
    SELECT *
    FROM private.v_customer_create_receipts_v1
    WHERE actor_id = ${expected.userId}::uuid
      AND client_event_id = ${expected.clientEventId}::uuid
    LIMIT 2
  `);
  if (rows.length === 0) return null;
  if (rows.length !== 1 || !rows[0]) throw new Error("CUSTOMER_CREATE_RECEIPT_AMBIGUOUS");
  return receiptFromRow(rows[0], expected);
}

export async function createCustomerCommand(
  authorization: CustomerCommandAuthorization,
  input: unknown,
): Promise<CustomerCreateCommandResult> {
  const normalized = normalizeInput(input);
  if (!normalized) return { code: "VALIDATION_ERROR", message: "Kundendaten sind unvollständig oder ungültig." };
  if (!authorization.permissions.includes("perm_data_customers")) {
    return { code: "FORBIDDEN", message: "Kunden dürfen mit dieser Rolle nicht angelegt werden." };
  }
  const expected = {
    tenantId: authorization.tenantId,
    userId: authorization.userId,
    clientEventId: normalized.clientEventId,
    intentSha256: intentHash(normalized),
  };

  try {
    return await withPrivilegedTenantTransaction(authorization, async (tx) => {
      await tx.execute(sql`
        SELECT pg_advisory_xact_lock(hashtextextended(
          'path1:customer-create:' || ${expected.tenantId} || ':' || ${expected.userId} || ':' || ${expected.clientEventId}, 0
        ))
      `);
      const prior = await tx.execute<{ intent_sha256: string }>(sql`
        SELECT intent_sha256
        FROM private.customer_create_receipts
        WHERE tenant_id = ${expected.tenantId}
          AND actor_id = ${expected.userId}::uuid
          AND client_event_id = ${expected.clientEventId}::uuid
        LIMIT 2
      `);
      if (prior.length > 0) {
        if (prior.length !== 1 || prior[0]?.intent_sha256 !== expected.intentSha256) {
          return { code: "CONFLICT", message: "Anfragekennung wurde bereits anders verwendet." };
        }
        const receipt = await readReceipt(tx, expected);
        if (!receipt) throw new Error("CUSTOMER_CREATE_REPLAY_READBACK_INVALID");
        return { code: "OK", receipt, replayed: true };
      }

      const customerId = randomUUID();
      const eventId = randomUUID();
      const receiptId = randomUUID();
      const correlationId = randomUUID();
      const numberRows = await tx.execute<{ customer_number: string }>(sql`
        SELECT private.allocate_customer_number(${expected.tenantId}) AS customer_number
      `);
      const customerNumber = numberRows.length === 1 ? numberRows[0]?.customer_number : null;
      if (!customerNumber || !/^K-\d{4}-\d{4,}$/.test(customerNumber)) throw new Error("CUSTOMER_NUMBER_READBACK_INVALID");

      const customers = await tx.execute<{ id: string; tenant_id: string; customer_number: string }>(sql`
        INSERT INTO public.customers (
          id, tenant_id, customer_number, name, type, company_name, contact_person,
          email, phone, city, source, source_ref, created_at, updated_at
        ) VALUES (
          ${customerId}, ${expected.tenantId}, ${customerNumber}, ${normalized.name}, ${normalized.customerType},
          ${normalized.companyName}, ${normalized.contactPerson}, ${normalized.email}, ${normalized.phone}, ${normalized.city},
          'PATH1_CUSTOMER_COMMAND', ${normalized.clientEventId},
          statement_timestamp() AT TIME ZONE 'UTC', statement_timestamp()
        )
        RETURNING id, tenant_id, customer_number
      `);
      if (customers.length !== 1 || customers[0]?.id !== customerId || customers[0]?.tenant_id !== expected.tenantId || customers[0]?.customer_number !== customerNumber) {
        throw new Error("CUSTOMER_CREATE_INSERT_INVALID");
      }

      const payload = JSON.stringify({
        customerId,
        customerNumber,
        intentSha256: expected.intentSha256,
      });
      const events = await tx.execute<{ id: string; tenant_id: string; user_id: string; client_event_id: string }>(sql`
        INSERT INTO public.events (
          id, tenant_id, order_id, item_id, event_type, description, notes, payload,
          status, user_id, station, client_event_id, event_schema_version,
          correlation_id, aggregate_version, from_station, created_at
        ) VALUES (
          ${eventId}, ${expected.tenantId}, NULL, NULL, ${EVENT_TYPE}, 'Kunde angelegt', NULL, ${payload}::jsonb,
          'success', ${expected.userId}::uuid, NULL, ${normalized.clientEventId}::uuid, 1,
          ${correlationId}::uuid, 1, NULL, statement_timestamp() AT TIME ZONE 'UTC'
        )
        RETURNING id, tenant_id, user_id::text AS user_id, client_event_id::text AS client_event_id
      `);
      if (events.length !== 1 || events[0]?.id !== eventId || events[0]?.tenant_id !== expected.tenantId || events[0]?.user_id !== expected.userId || events[0]?.client_event_id !== normalized.clientEventId) {
        throw new Error("CUSTOMER_CREATE_EVENT_INVALID");
      }

      const receipts = await tx.execute<{ id: string; event_id: string; customer_id: string; intent_sha256: string }>(sql`
        INSERT INTO private.customer_create_receipts (
          id, event_id, tenant_id, customer_id, customer_number, actor_id,
          client_event_id, correlation_id, intent_sha256, name, customer_type,
          company_name, contact_person, email, phone, city, created_at
        ) VALUES (
          ${receiptId}::uuid, ${eventId}, ${expected.tenantId}, ${customerId}, ${customerNumber}, ${expected.userId}::uuid,
          ${normalized.clientEventId}::uuid, ${correlationId}::uuid, ${expected.intentSha256}, ${normalized.name},
          ${normalized.customerType}, ${normalized.companyName}, ${normalized.contactPerson}, ${normalized.email},
          ${normalized.phone}, ${normalized.city}, statement_timestamp()
        )
        RETURNING id::text, event_id, customer_id, intent_sha256
      `);
      if (receipts.length !== 1 || receipts[0]?.id !== receiptId || receipts[0]?.event_id !== eventId || receipts[0]?.customer_id !== customerId || receipts[0]?.intent_sha256 !== expected.intentSha256) {
        throw new Error("CUSTOMER_CREATE_RECEIPT_INSERT_INVALID");
      }

      const receipt = await readReceipt(tx, expected);
      if (!receipt || receipt.receiptId !== receiptId || receipt.eventId !== eventId || receipt.customerId !== customerId || receipt.customerNumber !== customerNumber) {
        throw new Error("CUSTOMER_CREATE_READBACK_INVALID");
      }
      return { code: "OK", receipt, replayed: false };
    });
  } catch (error) {
    console.error("customer_create_command_failed", {
      message: diagnosticField(error, "message"),
      details: diagnosticField(error, "details"),
      hint: diagnosticField(error, "hint"),
    });
    return { code: "UNAVAILABLE", message: "Kunde konnte nicht sicher gespeichert werden." };
  }
}
