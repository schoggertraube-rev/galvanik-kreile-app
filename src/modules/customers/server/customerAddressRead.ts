import "server-only";
import { sql } from "drizzle-orm";
import type { PrivilegedTenantTransaction } from "@/lib/server/privilegedDb";
import { customerCountryLabel } from "../customerFormContract";
import type { CustomerAddressInput, CustomerAddressResult } from "../customerAddress";

export async function readCustomerAddress(tx: PrivilegedTenantTransaction, input: CustomerAddressInput): Promise<CustomerAddressResult> {
  const result = (kind: CustomerAddressResult["kind"], message: string, status: CustomerAddressResult["status"] = null, blocked = false,
    suggestions: CustomerAddressResult["suggestions"] = []): CustomerAddressResult => ({kind,message,status,blocked,suggestions});
  if (!input.country || !input.zipCode || !input.city || !input.street || !input.houseNumber) return result("incomplete","Anschrift unvollständig");
  if (input.country === "andere") return result("not-checked",`Land ${customerCountryLabel(input.country)} wird nicht geprüft`,"nicht_pruefbar");
  const available = await tx.execute<{ country: string }>(sql`SELECT country FROM public.address_directory WHERE country=${input.country} LIMIT 1`);
  if (!available.length) return result("unavailable","Prüfung gerade nicht möglich – wird beim Speichern geprüft");
  const rows = await tx.execute<{ zipCode: string; city: string; street: string | null }>(sql`
    SELECT zip_code AS "zipCode",city,street FROM public.address_directory WHERE country=${input.country} AND zip_code=${input.zipCode}
    ORDER BY city,street LIMIT 100
  `);
  const equal = (left: string | null,right: string) => left?.trim().toLocaleLowerCase("de-DE") === right.trim().toLocaleLowerCase("de-DE");
  if (!rows.length) return result("review",`PLZ ${input.zipCode} gibt es in ${customerCountryLabel(input.country)} nicht`,null,true);
  const cityRows=rows.filter(row=>equal(row.city,input.city));
  if (!cityRows.length) return result("review",`PLZ ${input.zipCode} gehört zu ${rows[0]!.city} – nicht zu „${input.city}“`,null,true,rows.slice(0,3));
  if (!cityRows.some(row=>equal(row.street,input.street))) return result("review",`${input.street} gibt es in ${input.zipCode} ${input.city} nicht`,null,true,cityRows.slice(0,3));
  return result("found","Adresse gefunden","gefunden");
}
