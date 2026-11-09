import "server-only";
import { createHash } from "node:crypto";
import { sql } from "drizzle-orm";
import { withPrivilegedTenantTransaction, type PrivilegedTenantTransaction } from "@/lib/server/privilegedDb";
import { customerDatabaseFields, customerWriteDiagnostic, customerWriteObject, normaliseCustomerWrite, readCustomerProfile, CUSTOMER_UUID as UUID_PATTERN } from "./customerWriteContract";
import { readCustomerAddress } from "./customerAddressRead";
import type { CustomerCommandContext, CreateCustomerInput, CustomerCreateCommandResult, CustomerCreateReceipt, ReadCustomerCreateReceiptResult } from "./types";

const MONEY_REQUIRED_MESSAGE='Zahlungsangaben und Lieferanten benötigen den Bereich Geld.';

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
  street: string | null;
  zip_code: string | null;
  country: string | null;
  payment_preference: string | null;
  vat_id: string | null;
  notes: string | null;
  recorded_at: Date | string;
  integrity_ok: boolean;
};

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
    || !(["business", "privat", "lieferant"] as const).includes(row.customer_type as never)
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
    street: row.street,
    zipCode: row.zip_code,
    city: row.city,
    country: row.country,
    paymentPreference: row.payment_preference,
    vatId: row.vat_id,
    notes: row.notes,
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


async function prepare(tx: PrivilegedTenantTransaction, context: CustomerCommandContext, input: unknown) {
  const raw = customerWriteObject(input);
  if (!raw) return { code: "VALIDATION_ERROR" as const, message: "Kundendaten sind ungültig." };
  if (raw.vorrang === true && !context.capabilities.canDecide) return { code: "FORBIDDEN" as const, message: "Vorrang benötigt das Recht Entscheiden." };
  if (!context.capabilities.canManageMoney && (raw.customerType === "lieferant" || ["paymentPreference", "iban", "paymentTermDays"].some(key => raw[key] != null))) {
    return { code: "FORBIDDEN" as const, message: MONEY_REQUIRED_MESSAGE };
  }
  const normalized = await normaliseCustomerWrite(tx, raw);
  if (!context.capabilities.canManageMoney && !("paymentPreference" in raw) && normalized.value.customerType !== "lieferant") normalized.value.paymentPreference = "vorkasse";
  const error = Object.values(normalized.errors)[0];
  if (error) return { code: "VALIDATION_ERROR" as const, message: error, fields: normalized.errors };
  const address = await readCustomerAddress(tx, normalized.value);
  if (address.blocked) return { code: "VALIDATION_ERROR" as const, message: address.message };
  const fields = { ...customerDatabaseFields(normalized.value), address_status: address.status };
  if (fields.payment_preference === "rechnung") return { code: "VALIDATION_ERROR" as const, message: "Ziel nicht freigeschaltet." };
  const clientEventId = String(raw.clientEventId);
  const intentSha256 = createHash("sha256").update(JSON.stringify({ clientEventId, fields }), "utf8").digest("hex");
  return { code: "OK" as const, fields, expected: { tenantId: context.tenantId, userId: context.userId, clientEventId, intentSha256 } };
}

/** Reused by the order command in its existing transaction: one RPC writer. */
export async function createCustomerInTransaction(
  tx: PrivilegedTenantTransaction, context: CustomerCommandContext, input: unknown,
): Promise<CustomerCreateCommandResult> {
  if (!context.capabilities.canCreateCustomer) return { code: "FORBIDDEN", message: "Kundenanlage ist nicht erlaubt." };
  const prepared = await prepare(tx, context, input);
  if (prepared.code !== "OK") return prepared;
  const { fields, expected } = prepared;
  const outcomes = await tx.execute<{ result_code: string; result_receipt_id: string | null; replayed: boolean }>(sql`
    SELECT * FROM private.create_customer_v2(
      ${expected.tenantId},${expected.userId}::uuid,${expected.clientEventId}::uuid,${expected.intentSha256},${JSON.stringify(fields)}::jsonb
    )
  `);
  const outcome = outcomes.length === 1 ? outcomes[0] : null;
  if (!outcome || outcome.result_code !== "OK" || !outcome.result_receipt_id) {
    if (outcome?.result_code === "CONFLICT") return { code: "CONFLICT", message: "Anfragekennung wurde bereits anders verwendet." };
    if (outcome?.result_code === "FORBIDDEN") return { code: "FORBIDDEN", message: "Kundenanlage ist nicht erlaubt." };
    if (outcome?.result_code === "VALIDATION_ERROR") return { code: "VALIDATION_ERROR", message: "Kundendaten sind ungültig." };
    throw new Error("CUSTOMER_CREATE_RESULT_INVALID");
  }
  const receipt = await readReceipt(tx, expected);
  if (!receipt || receipt.receiptId !== outcome.result_receipt_id) throw new Error("CUSTOMER_CREATE_READBACK_INVALID");
  const customer = await readCustomerProfile(tx, context.tenantId, receipt.customerId);
  if (!customer || customer.customerNumber !== receipt.customerNumber) throw new Error("CUSTOMER_CREATE_PROFILE_INVALID");
  if (customer.customerType === 'lieferant' && !context.capabilities.canManageMoney) return {code:'FORBIDDEN',message:MONEY_REQUIRED_MESSAGE};
  return { code: "OK", receipt, customer, replayed: outcome.replayed };
}

export async function createCustomerCommand(context: CustomerCommandContext, input: unknown): Promise<CustomerCreateCommandResult> {
  if (!context.capabilities.canCreateCustomer) return {code:"FORBIDDEN",message:"Kundenanlage ist nicht erlaubt."};
  if (!customerWriteObject(input)) return {code:"VALIDATION_ERROR",message:"Kundendaten sind ungültig."};
  try { return await withPrivilegedTenantTransaction(context, tx => createCustomerInTransaction(tx, context, input)); }
  catch (error) {
    console.error("[CUSTOMER_CREATE_FAILED]", customerWriteDiagnostic(error));
    return { code: "UNAVAILABLE", message: "Kunde konnte nicht sicher gespeichert werden. Code: CUSTOMER_CREATE_FAILED." };
  }
}

/** Read-only recovery using the original idempotency key and intent. */
export async function readCustomerCreateReceiptCommand(context: CustomerCommandContext, input: unknown): Promise<ReadCustomerCreateReceiptResult> {
  if (!context.capabilities.canCreateCustomer) return { code: "FORBIDDEN", message: "Kundenanlage ist nicht erlaubt." };
  try {
    return await withPrivilegedTenantTransaction(context, async tx => {
      const prepared = await prepare(tx, context, input);
      if (prepared.code !== "OK") return prepared;
      const receipt = await readReceipt(tx, prepared.expected);
      if (!receipt) return { code: "NOT_FOUND", message: "Kein sicherer Kundenbeleg gefunden." };
      const customer = await readCustomerProfile(tx, context.tenantId, receipt.customerId);
      if (!customer || customer.customerNumber !== receipt.customerNumber) throw new Error("CUSTOMER_CREATE_PROFILE_INVALID");
      if (customer.customerType === 'lieferant' && !context.capabilities.canManageMoney) return {code:'FORBIDDEN',message:MONEY_REQUIRED_MESSAGE};
      return { code: "OK", receipt, customer };
    });
  } catch (error) {
    console.error("[CUSTOMER_CREATE_RECEIPT_READ_FAILED]", customerWriteDiagnostic(error));
    return { code: "UNAVAILABLE", message: "Kundenbeleg konnte nicht sicher gelesen werden. Code: CUSTOMER_CREATE_RECEIPT_READ_FAILED." };
  }
}
