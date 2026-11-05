import "server-only";
import { createHash } from "node:crypto";
import { sql } from "drizzle-orm";
import {type PrivilegedTenantTransaction, withPrivilegedTenantTransaction } from "@/lib/server/privilegedDb";
import { customerDatabaseFields, customerWriteDiagnostic, customerWriteObject, normaliseCustomerWrite, readCustomerProfile } from "./customerWriteContract";
import type { CustomerCommandContext } from "./types";
import { readCustomerAddress } from "./customerAddressRead";

export async function updateCustomerInTransaction(tx:PrivilegedTenantTransaction,context: CustomerCommandContext, input: unknown) {
  if (!context.capabilities.canEditCustomer) return { code: "FORBIDDEN" as const, message: "Kunden bearbeiten ist nicht erlaubt." };
  const raw = customerWriteObject(input, true);
  if (!raw) return { code: "VALIDATION_ERROR" as const, message: "Kundendaten sind ungültig." };
  if (!context.capabilities.canManageMoney && ["paymentPreference", "iban", "paymentTermDays"].some(key => raw[key] != null)) {
    return { code: "FORBIDDEN" as const, message: "Zahlungsangaben benötigen den Bereich Geld." };
  }
  const writable = { ...raw };
  if (!context.capabilities.canManageMoney) for (const field of ["paymentPreference", "iban", "paymentTermDays"]) delete writable[field];

      const customerId = String(raw.customerId);
      const current = await readCustomerProfile(tx, context.tenantId, customerId, true);
      if (!current) return { code: "NOT_FOUND" as const, message: "Kunde ist nicht verfügbar." };
      if (typeof raw.vorrang === "boolean" && raw.vorrang !== current.vorrang && !context.capabilities.canDecide) return { code: "FORBIDDEN" as const, message: "Vorrang benötigt das Recht Entscheiden." };
      if (!context.capabilities.canManageMoney && (current.customerType === "lieferant" || raw.customerType === "lieferant")) {
        return { code: "FORBIDDEN" as const, message: "Lieferanten benötigen den Bereich Geld." };
      }
      const normalized = await normaliseCustomerWrite(tx, writable, current);
      const error = Object.values(normalized.errors)[0];
      if (error) return { code: "VALIDATION_ERROR" as const, message: error, fields: normalized.errors };
      const addressChanged = (["country","zipCode","city","street","houseNumber"] as const).some(key => (current[key] ?? "") !== normalized.value[key]);
      const address = addressChanged ? await readCustomerAddress(tx,normalized.value) : null;
      if(address?.blocked)return {code:"VALIDATION_ERROR" as const,message:address.message};
      const fields = {...customerDatabaseFields(normalized.value),address_status:address ? address.status : current.addressStatus};
      if (fields.payment_preference === "rechnung" && !current.invoiceTermsEnabled) return { code: "VALIDATION_ERROR" as const, message: "Ziel nicht freigeschaltet." };
      const intentSha256 = createHash("sha256").update(JSON.stringify({ customerId, fields }), "utf8").digest("hex");
      const rows = await tx.execute<{ result_code: string; replayed: boolean }>(sql`
        SELECT * FROM private.update_customer_v1(${context.tenantId},${context.userId}::uuid,${String(raw.clientEventId)}::uuid,
          ${customerId},${intentSha256},${JSON.stringify(fields)}::jsonb)
      `);
      const result = rows.length === 1 ? rows[0] : null;
      if (!result) throw new Error("CUSTOMER_UPDATE_RESULT_INVALID");
      if (result.result_code === "FORBIDDEN") return { code: "FORBIDDEN" as const, message: "Diese Änderung ist nicht erlaubt." };
      if (result.result_code === "CONFLICT") return { code: "CONFLICT" as const, message: "Anfragekennung wurde bereits anders verwendet." };
      if (result.result_code === "VALIDATION_ERROR") return { code: "VALIDATION_ERROR" as const, message: "Kundendaten sind ungültig." };
      if (result.result_code === "NOT_FOUND") return { code: "NOT_FOUND" as const, message: "Kunde ist nicht verfügbar." };
      if (result.result_code !== "OK") throw new Error("CUSTOMER_UPDATE_RESULT_INVALID");
      const customer = await readCustomerProfile(tx, context.tenantId, customerId);
      if (!customer) throw new Error("CUSTOMER_UPDATE_READBACK_INVALID");
      return { code: "OK" as const, customer, replayed: result.replayed };
}

export async function updateCustomerCommand(context: CustomerCommandContext, input: unknown) {
  try {return await withPrivilegedTenantTransaction(context,tx=>updateCustomerInTransaction(tx,context,input));}
  catch (error) {
    console.error("[CUSTOMER_UPDATE_FAILED]", customerWriteDiagnostic(error));
    return { code: "UNAVAILABLE" as const, message: "Kunde konnte nicht sicher gespeichert werden. Code: CUSTOMER_UPDATE_FAILED." };
  }
}
