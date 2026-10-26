import "server-only";

import bcrypt from "bcryptjs";
import { sql } from "drizzle-orm";
import { withPrivilegedTenantTransaction } from "@/lib/server/privilegedDb";
import type { CompanySettingsInput, ManagedUser, SystemSettingsSnapshot, UpdateManagedUserInput } from "../public";
import { mapTenantFeatureRows, type TenantFeatureRow } from "./tenantFeaturePort";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const ROLES = ["admin", "meister", "buero", "werkstatt"] as const;
export type SystemSettingsContext = { tenantId: string; actorId: string; canManage: boolean };
type CompanyRow = { company_name: string; street: string | null; zip: string | null; city: string | null; country: string | null; tax_id: string | null; iban: string | null; bic: string | null; bank_name: string | null; invoice_payment_term_days: number | null; logo_url: string | null };
type UserRow = { id: string; email: string; full_name: string; role: string; active: boolean };

function text(value: unknown, min: number, max: number): string | null {
  if (typeof value !== "string") return null;
  const normalized = value.trim().replace(/\s+/g, " ");
  return normalized.length >= min && normalized.length <= max ? normalized : null;
}

export async function readSystemSettings(context: SystemSettingsContext) {
  if (!context.canManage) return { code: "FORBIDDEN" as const, message: "Einstellungen sind nicht erlaubt." };
  try {
    const snapshot = await withPrivilegedTenantTransaction(context, async (tx): Promise<SystemSettingsSnapshot> => {
      const companies = await tx.execute<CompanyRow>(sql`SELECT company_name, street, zip, city, country, tax_id, iban, bic, bank_name, invoice_payment_term_days, logo_url FROM public.company_settings WHERE tenant_id = ${context.tenantId} ORDER BY updated_at DESC LIMIT 2`);
      if (companies.length !== 1 || !companies[0]) throw new Error("COMPANY_SETTINGS_AMBIGUOUS");
      const users = await tx.execute<UserRow>(sql`SELECT id, email, full_name, role, active FROM public.app_users WHERE tenant_id = ${context.tenantId} ORDER BY full_name, id`);
      const featureRows = await tx.execute<TenantFeatureRow>(sql`SELECT feature_id, enabled FROM public.tenant_features WHERE tenant = ${context.tenantId} ORDER BY feature_id`);
      const company = companies[0];
      return {
        company: {
          companyName: company.company_name, street: company.street ?? "", zip: company.zip ?? "",
          city: company.city ?? "", country: company.country ?? "", taxId: company.tax_id ?? "",
          iban: company.iban ?? "", bic: company.bic ?? "", bankName: company.bank_name ?? "",
          paymentTermDays: company.invoice_payment_term_days ?? 14, logoUrl: company.logo_url ?? "",
        },
        users: users.map((user): ManagedUser => ({ id: user.id, email: user.email, fullName: user.full_name, role: user.role, active: user.active })),
        numberRanges: [
          { label: "Kunden", pattern: "K-JJJJ-fortlaufend" },
          { label: "Aufträge", pattern: "A-JJJJ-fortlaufend" },
          { label: "Rechnungen", pattern: "RE-JJJJ-fortlaufend" },
        ],
        features: mapTenantFeatureRows(featureRows),
      };
    });
    return { code: "OK" as const, snapshot };
  } catch {
    return { code: "UNAVAILABLE" as const, message: "Einstellungen konnten nicht sicher geladen werden." };
  }
}

export async function updateCompanySettings(context: SystemSettingsContext, input: unknown) {
  if (!context.canManage) return { code: "FORBIDDEN" as const, message: "Firmendaten dürfen nicht geändert werden." };
  if (!input || typeof input !== "object" || Array.isArray(input)) return { code: "VALIDATION_ERROR" as const, message: "Firmendaten sind ungültig." };
  const value = input as Record<string, unknown>;
  if (Object.keys(value).sort().join(",") !== "bankName,bic,city,companyName,country,iban,logoUrl,paymentTermDays,street,taxId,zip") return { code: "VALIDATION_ERROR" as const, message: "Firmendaten sind unvollständig." };
  const normalized: CompanySettingsInput = {
    companyName: text(value.companyName, 2, 160) ?? "", street: text(value.street, 2, 160) ?? "",
    zip: text(value.zip, 2, 20) ?? "", city: text(value.city, 1, 120) ?? "", country: text(value.country, 2, 120) ?? "",
    taxId: text(value.taxId, 4, 40) ?? "", iban: text(value.iban, 8, 40) ?? "", bic: text(value.bic, 6, 20) ?? "",
    bankName: text(value.bankName, 2, 160) ?? "", logoUrl: text(value.logoUrl, 1, 500) ?? "",
    paymentTermDays: typeof value.paymentTermDays === "number" ? value.paymentTermDays : 0,
  };
  if (Object.values(normalized).some((field) => field === "") || !Number.isSafeInteger(normalized.paymentTermDays) || normalized.paymentTermDays < 1 || normalized.paymentTermDays > 365) return { code: "VALIDATION_ERROR" as const, message: "Alle Firmendaten einschließlich Zahlungsziel sind erforderlich." };
  try {
    await withPrivilegedTenantTransaction(context, async (tx) => {
      const rows = await tx.execute<{ id: string }>(sql`UPDATE public.company_settings SET company_name=${normalized.companyName}, street=${normalized.street}, zip=${normalized.zip}, city=${normalized.city}, country=${normalized.country}, tax_id=${normalized.taxId}, iban=${normalized.iban}, bic=${normalized.bic}, bank_name=${normalized.bankName}, invoice_payment_term_days=${normalized.paymentTermDays}, logo_url=${normalized.logoUrl}, updated_at=statement_timestamp() WHERE tenant_id=${context.tenantId} RETURNING id`);
      if (rows.length !== 1) throw new Error("COMPANY_SETTINGS_WRITE_AMBIGUOUS");
    });
    return { code: "OK" as const };
  } catch {
    return { code: "UNAVAILABLE" as const, message: "Firmendaten konnten nicht sicher gespeichert werden." };
  }
}

export async function updateManagedUser(context: SystemSettingsContext, input: unknown) {
  if (!context.canManage) return { code: "FORBIDDEN" as const, message: "Nutzer dürfen nicht geändert werden." };
  if (!input || typeof input !== "object" || Array.isArray(input)) return { code: "VALIDATION_ERROR" as const, message: "Nutzerdaten sind ungültig." };
  const value = input as Record<string, unknown>;
  if (Object.keys(value).sort().join(",") !== "active,pin,role,userId" || typeof value.userId !== "string" || !UUID.test(value.userId)
    || typeof value.role !== "string" || !ROLES.includes(value.role as typeof ROLES[number]) || typeof value.active !== "boolean"
    || (value.pin !== null && (typeof value.pin !== "string" || !/^\d{4,12}$/.test(value.pin)))) return { code: "VALIDATION_ERROR" as const, message: "Rolle, Status oder PIN ist ungültig." };
  const normalized = value as unknown as UpdateManagedUserInput;
  const pinHash = normalized.pin ? await bcrypt.hash(normalized.pin, 12) : null;
  try {
    await withPrivilegedTenantTransaction(context, async (tx) => {
      const rows = pinHash
        ? await tx.execute<{ id: string }>(sql`UPDATE public.app_users SET role=${normalized.role}, active=${normalized.active}, pin_hash=${pinHash}, updated_at=statement_timestamp() WHERE id=${normalized.userId}::uuid AND tenant_id=${context.tenantId} RETURNING id`)
        : await tx.execute<{ id: string }>(sql`UPDATE public.app_users SET role=${normalized.role}, active=${normalized.active}, updated_at=statement_timestamp() WHERE id=${normalized.userId}::uuid AND tenant_id=${context.tenantId} RETURNING id`);
      if (rows.length !== 1) throw new Error("USER_WRITE_NOT_FOUND");
    });
    return { code: "OK" as const };
  } catch {
    return { code: "UNAVAILABLE" as const, message: "Nutzer konnte nicht sicher gespeichert werden." };
  }
}
