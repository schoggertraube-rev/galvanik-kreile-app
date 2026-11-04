import "server-only";
import { sql } from "drizzle-orm";
import type { PrivilegedTenantTransaction } from "@/lib/server/privilegedDb";
import { EMPTY_CUSTOMER_FORM, kundeValidierung, normaliseIban, type CustomerFormValue } from "../customerFormContract";
import type { CustomerStoredProfile } from "./types";

export const CUSTOMER_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const fieldNames = Object.keys(EMPTY_CUSTOMER_FORM);
const legacyNames = ["name", "contactPerson"];
export function customerWriteDiagnostic(error: unknown) {
  const outer = error && typeof error === "object" ? error as Record<string, unknown> : {};
  const cause = outer.cause && typeof outer.cause === "object" ? outer.cause as Record<string, unknown> : outer;
  const message = typeof cause.message === "string" && !/params:|\b(?:select|insert|update|delete)\b/i.test(cause.message) ? cause.message.slice(0,300) : "DATABASE_OPERATION_FAILED";
  return { code: typeof cause.code === "string" ? cause.code : "CUSTOMER_WRITE_FAILED", message,
    constraint: typeof cause.constraint_name === "string" ? cause.constraint_name : null };
}
export function customerWriteObject(input: unknown, update = false): Record<string, unknown> | null {
  if (!input || typeof input !== "object" || Array.isArray(input)) return null;
  const value = input as Record<string, unknown>;
  if (Object.keys(value).some(key => ![...fieldNames, ...legacyNames, "clientEventId", ...(update ? ["customerId"] : [])].includes(key))) return null;
  if (typeof value.clientEventId !== "string" || !CUSTOMER_UUID.test(value.clientEventId)) return null;
  if (update && (typeof value.customerId !== "string" || !value.customerId.trim() || value.customerId.length > 128)) return null;
  for (const [key, candidate] of Object.entries(value)) {
    if (key === "autoInfo" || key === "vorrang") { if (typeof candidate !== "boolean") return null; }
    else if (key === "paymentTermDays") { if (candidate !== null && (!Number.isInteger(candidate) || Number(candidate) < 0 || Number(candidate) > 120)) return null; }
    else if (candidate !== null && typeof candidate !== "string") return null;
  }
  return value;
}

export function customerProfileForm(profile: CustomerStoredProfile): CustomerFormValue {
  const value = { ...EMPTY_CUSTOMER_FORM };
  for (const key of fieldNames as Array<keyof CustomerFormValue>) {
    const current = profile[key];
    Object.assign(value, { [key]: current === null ? "" : key === "paymentTermDays" ? String(current) : current });
  }
  return value;
}

/** The only legacy-input boundary. It reuses the migration's SQL split rules. */
export async function normaliseCustomerWrite(
  tx: PrivilegedTenantTransaction, input: Record<string, unknown>, previous?: CustomerStoredProfile,
) {
  const prior = previous ? customerProfileForm(previous) : undefined;
  const value = prior ? { ...prior } : { ...EMPTY_CUSTOMER_FORM, country: "", paymentPreference: "" };
  for (const key of fieldNames) {
    if (!(key in input)) continue;
    const candidate = input[key];
    Object.assign(value, { [key]: candidate === null ? "" : key === "paymentTermDays" ? String(candidate) : typeof candidate === "string" ? candidate.trim().replace(/\s+/g, " ") : candidate });
  }
  if ("name" in input || "contactPerson" in input) {
    const person = value.customerType === "privat" ? input.name : input.contactPerson;
    const rows = await tx.execute<{ salutation: "frau" | "herr" | "ohne" | null; first_name: string | null; last_name: string | null; street: string | null; house_number: string | null; country: string | null }>(sql`
      SELECT person.salutation,person.first_name,person.last_name,address.street,address.house_number,
             private.kunde_land_schluessel(${typeof input.country === "string" ? input.country : null}) AS country
      FROM private.kunde_split_name(${typeof person === "string" ? person : null}) person
      CROSS JOIN private.kunde_split_street(${typeof input.street === "string" ? input.street : null}) address
    `);
    if (rows.length !== 1 || !rows[0]) throw new Error("CUSTOMER_LEGACY_NORMALIZATION_INVALID");
    const legacy = rows[0];
    if (value.customerType !== "privat") value.companyName = String(input.companyName ?? input.name ?? value.companyName).trim();
    value.salutation = legacy.salutation ?? ""; value.firstName = legacy.first_name ?? ""; value.lastName = legacy.last_name ?? "";
    if ("street" in input) { value.street = legacy.street ?? ""; value.houseNumber = legacy.house_number ?? ""; }
    if ("country" in input) value.country = legacy.country ?? "";
  }
  value.iban = normaliseIban(value.iban);
  return { value, errors: kundeValidierung(value, prior, { invoiceTermsEnabled: previous?.invoiceTermsEnabled }) };
}

export function customerDatabaseFields(value: CustomerFormValue) {
  const optional = (text: string) => text || null;
  return {
    type: value.customerType, company_name: optional(value.companyName), salutation: optional(value.salutation),
    first_name: optional(value.firstName), last_name: optional(value.lastName), contact_role: optional(value.contactRole),
    phone: optional(value.phone), email: optional(value.email), billing_email: optional(value.billingEmail), website: optional(value.website),
    street: optional(value.street), house_number: optional(value.houseNumber), zip_code: optional(value.zipCode), city: optional(value.city),
    country: optional(value.country), payment_preference: optional(value.paymentPreference), vat_id: optional(value.vatId), notes: optional(value.notes),
    handover_preference: optional(value.handoverPreference), iban: optional(value.iban),
    zahlungsziel_tage: value.paymentTermDays ? Number(value.paymentTermDays) : null, auto_info: value.autoInfo, vorrang: value.vorrang,
  };
}

export {readCustomerProfile} from "@/lib/server/customerSummaryRead";
