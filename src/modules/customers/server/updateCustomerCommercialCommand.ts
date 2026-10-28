import "server-only";

import { sql } from "drizzle-orm";
import { withPrivilegedTenantTransaction } from "@/lib/server/privilegedDb";
import type { CustomerCommandContext, UpdateCustomerCommercialInput } from "./types";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
function normalize(input: unknown): UpdateCustomerCommercialInput | null {
  if (!input || typeof input !== "object" || Array.isArray(input)) return null;
  const value = input as Record<string, unknown>;
  if (Object.keys(value).sort().join(",") !== "city,clientEventId,companyName,contactPerson,country,customerId,email,name,paymentPreference,phone,street,vatId,zipCode") return null;
  const clean = (candidate: unknown, min: number, max: number) => typeof candidate === "string" && candidate.trim().length >= min && candidate.trim().length <= max ? candidate.trim().replace(/\s+/g, " ") : null;
  const optional = (candidate: unknown, min: number, max: number) => candidate === null ? null : clean(candidate, min, max);
  const name = clean(value.name, 2, 160); const companyName = optional(value.companyName, 2, 160);
  const contactPerson = optional(value.contactPerson, 1, 160); const email = optional(value.email, 3, 254);
  const phone = optional(value.phone, 1, 80);
  const street = clean(value.street, 2, 160); const zipCode = clean(value.zipCode, 2, 20); const city = clean(value.city, 1, 120); const country = clean(value.country, 2, 120);
  const vatId = value.vatId === null ? null : clean(value.vatId, 4, 40);
  if (typeof value.clientEventId !== "string" || !UUID.test(value.clientEventId) || typeof value.customerId !== "string" || value.customerId.length < 1 ||
    !name || (value.companyName !== null && !companyName) || (value.contactPerson !== null && !contactPerson) ||
    (value.email !== null && (!email || !EMAIL.test(email))) || (value.phone !== null && !phone) ||
    !street || !zipCode || !city || !country || (value.vatId !== null && !vatId)
    || typeof value.paymentPreference !== "string" || !/^(?:rechnung_[1-9][0-9]{0,2}|vorkasse|bar)$/.test(value.paymentPreference)) return null;
  return { clientEventId: value.clientEventId, customerId: value.customerId, name, companyName, contactPerson, email, phone, street, zipCode, city, country, paymentPreference: value.paymentPreference, vatId };
}

export async function updateCustomerCommercialCommand(context: CustomerCommandContext, input: unknown) {
  const value = normalize(input);
  if (!value) return { code: "VALIDATION_ERROR" as const, message: "Adresse oder Zahlungsbedingung ist unvollständig." };
  if (!context.capabilities.canCreateCustomer) return { code: "FORBIDDEN" as const, message: "Kundendaten dürfen nicht geändert werden." };
  try {
    return await withPrivilegedTenantTransaction(context, async (tx) => {
      const existing = await tx.execute<{ payment_preference: string | null }>(sql`
        SELECT customer.payment_preference
        FROM public.customers customer
        WHERE customer.tenant_id = ${context.tenantId}
          AND customer.id = ${value.customerId}
        FOR UPDATE
      `);
      const current = existing.length === 1 ? existing[0] : null;
      if (!current) return { code: "NOT_FOUND" as const, message: "Kunde ist nicht verfÃ¼gbar." };
      if (!context.capabilities.canManageMoney) {
        if (current.payment_preference === null || current.payment_preference !== value.paymentPreference) {
          return { code: "FORBIDDEN" as const, message: "Zahlungsbedingungen dÃ¼rfen nur mit dem Bereich Geld geÃ¤ndert werden." };
        }
      } else if (current.payment_preference !== value.paymentPreference
        && (/^rechnung_/.test(value.paymentPreference) || /^rechnung_/.test(current.payment_preference ?? ""))) {
        return { code: "FORBIDDEN" as const, message: "Ziel nicht freigeschaltet. Zahlungsziel nur Ã¼ber die eigene Freischaltung Ã¤ndern." };
      }
      const rows = await tx.execute<{ result_code: string; replayed: boolean }>(sql`SELECT * FROM private.update_customer_commercial_v1(${context.tenantId}, ${context.userId}::uuid, ${value.clientEventId}::uuid, ${value.customerId}, ${value.name}, ${value.companyName}, ${value.contactPerson}, ${value.email}, ${value.phone}, ${value.street}, ${value.zipCode}, ${value.city}, ${value.country}, ${value.paymentPreference}, ${value.vatId})`);
      const row = rows.length === 1 ? rows[0] : null;
      if (!row || !["OK", "NOT_FOUND", "VALIDATION_ERROR"].includes(row.result_code)) throw new Error("CUSTOMER_UPDATE_RESULT_INVALID");
      return row.result_code === "OK" ? { code: "OK" as const, replayed: row.replayed } : { code: row.result_code as "NOT_FOUND"|"VALIDATION_ERROR", message: row.result_code === "NOT_FOUND" ? "Kunde ist nicht verfügbar." : "Kundendaten sind ungültig." };
    });
  } catch {
    return { code: "UNAVAILABLE" as const, message: "Kundendaten konnten nicht sicher gespeichert werden." };
  }
}
