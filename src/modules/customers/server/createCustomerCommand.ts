import "server-only";

import { createHash } from "node:crypto";
import { sql } from "drizzle-orm";
import { withPrivilegedTenantTransaction, type PrivilegedTenantTransaction } from "@/lib/server/privilegedDb";
import type {
  CreateCustomerInput,
  CustomerCommandContext,
  CustomerCreateCommandResult,
  CustomerCreateReceipt,
  ReadCustomerCreateReceiptResult,
} from "./types";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

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
  authorization: CustomerCommandContext,
  input: unknown,
): Promise<CustomerCreateCommandResult> {
  const normalized = normalizeInput(input);
  if (!normalized) return { code: "VALIDATION_ERROR", message: "Kundendaten sind unvollständig oder ungültig." };
  if (!authorization.capabilities.canCreateCustomer) {
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
      const outcomes = await tx.execute<{ result_code: string; result_receipt_id: string | null; replayed: boolean }>(sql`
        SELECT * FROM private.create_customer_v1(
          ${expected.tenantId}, ${expected.userId}::uuid, ${expected.clientEventId}::uuid,
          ${expected.intentSha256}, ${normalized.name}, ${normalized.customerType},
          ${normalized.companyName}, ${normalized.contactPerson}, ${normalized.email},
          ${normalized.phone}, ${normalized.city}
        )
      `);
      const outcome = outcomes.length === 1 ? outcomes[0] : null;
      if (!outcome || outcome.result_code !== "OK" || !outcome.result_receipt_id) {
        if (outcome?.result_code === "CONFLICT") {
          return { code: "CONFLICT", message: "Anfragekennung wurde bereits anders verwendet." };
        }
        if (outcome?.result_code === "VALIDATION_ERROR") {
          return { code: "VALIDATION_ERROR", message: "Kundendaten sind unvollständig oder ungültig." };
        }
        throw new Error("CUSTOMER_CREATE_RESULT_INVALID");
      }
      const receipt = await readReceipt(tx, expected);
      if (!receipt || receipt.receiptId !== outcome.result_receipt_id) {
        throw new Error("CUSTOMER_CREATE_READBACK_INVALID");
      }
      return { code: "OK", receipt, replayed: outcome.replayed };
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

/** Read-only recovery path for an interrupted create with the original intent. */
export async function readCustomerCreateReceiptCommand(
  authorization: CustomerCommandContext,
  input: unknown,
): Promise<ReadCustomerCreateReceiptResult> {
  const normalized = normalizeInput(input);
  if (!normalized) return { code: "VALIDATION_ERROR", message: "Die gespeicherte Anfrage kann nicht sicher geprüft werden." };
  if (!authorization.capabilities.canCreateCustomer) return { code: "FORBIDDEN", message: "Der gespeicherte Kundenstand darf mit dieser Rolle nicht gelesen werden." };
  const expected = {
    tenantId: authorization.tenantId,
    userId: authorization.userId,
    clientEventId: normalized.clientEventId,
    intentSha256: intentHash(normalized),
  };
  try {
    return await withPrivilegedTenantTransaction(authorization, async (tx) => {
      const receipt = await readReceipt(tx, expected);
      return receipt ? { code: "OK", receipt } : { code: "NOT_FOUND", message: "Zu dieser Anfrage wurde noch kein sicherer Kundenstand gefunden." };
    });
  } catch (error) {
    console.error("customer_create_receipt_read_failed", {
      message: diagnosticField(error, "message"), details: diagnosticField(error, "details"), hint: diagnosticField(error, "hint"),
    });
    return { code: "UNAVAILABLE", message: "Der gespeicherte Kundenstand konnte nicht sicher gelesen werden." };
  }
}
