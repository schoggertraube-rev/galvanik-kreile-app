import "server-only";

import bcrypt from "bcryptjs";
import { sql } from "drizzle-orm";
import { withPrivilegedTenantTransaction } from "@/lib/server/privilegedDb";
import type { CompanySettingsInput, ManagedUser, SystemSettingsSnapshot, UpdateManagedUserInput } from "../public";
import { mapTenantFeatureRows, type TenantFeatureRow } from "./tenantFeaturePort";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const ROLES = ["developer", "admin", "meister", "buero", "werkstatt"] as const;
const MANAGER_ROLES = new Set(["developer", "admin", "meister"]);
export type SystemSettingsContext = { tenantId: string; actorId: string; canManage: boolean };
export type CompanyDocumentContext = { tenantId: string; actorId: string; canRead: boolean };
type CompanyRow = { company_name: string; street: string | null; zip: string | null; city: string | null; country: string | null; tax_id: string | null; iban: string | null; bic: string | null; bank_name: string | null; invoice_payment_term_days: number | null; logo_url: string | null };
type UserRow = { id: string; email: string; full_name: string; role: string; active: boolean };

const EMPTY_COMPANY: CompanySettingsInput = {
  companyName: "", street: "", zip: "", city: "", country: "Deutschland", taxId: "",
  iban: "", bic: "", bankName: "", paymentTermDays: 14, logoUrl: "/logo.png",
};

function text(value: unknown, min: number, max: number): string | null {
  if (typeof value !== "string") return null;
  const normalized = value.trim().replace(/\s+/g, " ");
  return normalized.length >= min && normalized.length <= max ? normalized : null;
}

export async function readSystemSettings(context: SystemSettingsContext) {
  if (!context.canManage) return { code: "FORBIDDEN" as const, message: "Einstellungen sind nicht erlaubt." };
  try {
    const snapshot = await withPrivilegedTenantTransaction(context, async (tx): Promise<Omit<SystemSettingsSnapshot, "extraWorkHourlyRate">> => {
      const companies = await tx.execute<CompanyRow>(sql`SELECT company_name, street, zip, city, country, tax_id, iban, bic, bank_name, invoice_payment_term_days, logo_url FROM public.company_settings WHERE tenant_id = ${context.tenantId} ORDER BY updated_at DESC LIMIT 2`);
      if (companies.length > 1) throw new Error("COMPANY_SETTINGS_AMBIGUOUS");
      const users = await tx.execute<UserRow>(sql`SELECT id, email, full_name, role, active FROM public.app_users WHERE tenant_id = ${context.tenantId} ORDER BY full_name, id`);
      const featureRows = await tx.execute<TenantFeatureRow>(sql`SELECT feature_id, enabled FROM public.tenant_features WHERE tenant = ${context.tenantId} ORDER BY feature_id`);
      const company = companies[0];
      return {
        company: company ? {
          companyName: company.company_name, street: company.street ?? "", zip: company.zip ?? "",
          city: company.city ?? "", country: company.country ?? "", taxId: company.tax_id ?? "",
          iban: company.iban ?? "", bic: company.bic ?? "", bankName: company.bank_name ?? "",
          paymentTermDays: company.invoice_payment_term_days ?? 14, logoUrl: company.logo_url ?? "",
        } : EMPTY_COMPANY,
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

export async function readCompanyDocumentSettings(context: CompanyDocumentContext) {
  if (!context.canRead) return { code: "FORBIDDEN" as const, message: "Firmendaten sind nicht erlaubt." };
  try {
    const company = await withPrivilegedTenantTransaction(context, async (tx) => {
      const rows = await tx.execute<CompanyRow>(sql`SELECT company_name, street, zip, city, country, tax_id, iban, bic, bank_name, invoice_payment_term_days, logo_url FROM public.company_settings WHERE tenant_id = ${context.tenantId} ORDER BY updated_at DESC LIMIT 2`);
      if (rows.length !== 1) throw new Error("COMPANY_DOCUMENT_SETTINGS_MISSING_OR_AMBIGUOUS");
      const row = rows[0];
      const mapped: CompanySettingsInput = {
        companyName: row.company_name,
        street: row.street ?? "",
        zip: row.zip ?? "",
        city: row.city ?? "",
        country: row.country ?? "",
        taxId: row.tax_id ?? "",
        iban: row.iban ?? "",
        bic: row.bic ?? "",
        bankName: row.bank_name ?? "",
        paymentTermDays: row.invoice_payment_term_days ?? 0,
        logoUrl: row.logo_url ?? "",
      };
      if (Object.values(mapped).some((field) => field === "") || !Number.isSafeInteger(mapped.paymentTermDays) || mapped.paymentTermDays < 1) {
        throw new Error("COMPANY_DOCUMENT_SETTINGS_INCOMPLETE");
      }
      return mapped;
    });
    return { code: "OK" as const, company };
  } catch {
    return { code: "UNAVAILABLE" as const, message: "Firmendaten für den KV sind noch nicht vollständig gepflegt." };
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
      const rows = await tx.execute<{ id: string }>(sql`
        INSERT INTO public.company_settings (id, tenant_id, company_name, street, zip, city, country, tax_id, iban, bic, bank_name, invoice_payment_term_days, logo_url, updated_at)
        VALUES (${`company:${context.tenantId}`}, ${context.tenantId}, ${normalized.companyName}, ${normalized.street}, ${normalized.zip}, ${normalized.city}, ${normalized.country}, ${normalized.taxId}, ${normalized.iban}, ${normalized.bic}, ${normalized.bankName}, ${normalized.paymentTermDays}, ${normalized.logoUrl}, statement_timestamp())
        ON CONFLICT (id) DO UPDATE SET company_name=EXCLUDED.company_name, street=EXCLUDED.street, zip=EXCLUDED.zip, city=EXCLUDED.city, country=EXCLUDED.country, tax_id=EXCLUDED.tax_id, iban=EXCLUDED.iban, bic=EXCLUDED.bic, bank_name=EXCLUDED.bank_name, invoice_payment_term_days=EXCLUDED.invoice_payment_term_days, logo_url=EXCLUDED.logo_url, updated_at=statement_timestamp()
        WHERE company_settings.tenant_id=${context.tenantId}
        RETURNING id
      `);
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
    || (value.pin !== null && (typeof value.pin !== "string" || !/^\d{4}$/.test(value.pin)))) return { code: "VALIDATION_ERROR" as const, message: "Rolle, Status oder PIN ist ungültig. Eine neue PIN hat genau 4 Ziffern." };
  const normalized = value as unknown as UpdateManagedUserInput;
  const pinHash = normalized.pin ? await bcrypt.hash(normalized.pin, 12) : null;
  try {
    await withPrivilegedTenantTransaction(context, async (tx) => {
      const targets = await tx.execute<{ id: string; role: string; active: boolean; has_pin: boolean }>(sql`
        SELECT id::text AS id, role, active, pin_hash IS NOT NULL AS has_pin
        FROM public.app_users
        WHERE id=${normalized.userId}::uuid AND tenant_id=${context.tenantId}
        LIMIT 2
        FOR UPDATE
      `);
      if (targets.length !== 1 || !targets[0]) throw new Error("USER_WRITE_NOT_FOUND");
      const target = targets[0];
      const counts = await tx.execute<{ active_count: number; manager_count: number }>(sql`
        SELECT count(*) FILTER (WHERE active)::integer AS active_count,
               count(*) FILTER (WHERE active AND role IN ('developer', 'admin', 'meister'))::integer AS manager_count
        FROM public.app_users
        WHERE tenant_id=${context.tenantId}
      `);
      if (counts.length !== 1 || !counts[0]) throw new Error("USER_COUNTS_UNAVAILABLE");
      if (normalized.userId === context.actorId && !normalized.active) throw new Error("USER_SELF_DEACTIVATION");
      if (target.active && !normalized.active && counts[0].active_count <= 1) throw new Error("USER_LAST_ACTIVE_DEACTIVATION");
      if (target.active && MANAGER_ROLES.has(target.role) && (!normalized.active || !MANAGER_ROLES.has(normalized.role)) && counts[0].manager_count <= 1) throw new Error("USER_LAST_MANAGER_DEMOTION");
      if (normalized.active && !target.has_pin && !pinHash) throw new Error("USER_ACTIVE_PIN_REQUIRED");
      const rows = pinHash
        ? await tx.execute<{ id: string }>(sql`UPDATE public.app_users SET role=${normalized.role}, active=${normalized.active}, pin_hash=${pinHash}, updated_at=statement_timestamp() WHERE id=${normalized.userId}::uuid AND tenant_id=${context.tenantId} RETURNING id`)
        : await tx.execute<{ id: string }>(sql`UPDATE public.app_users SET role=${normalized.role}, active=${normalized.active}, updated_at=statement_timestamp() WHERE id=${normalized.userId}::uuid AND tenant_id=${context.tenantId} RETURNING id`);
      if (rows.length !== 1) throw new Error("USER_WRITE_NOT_FOUND");
    });
    return { code: "OK" as const };
  } catch (error) {
    if (error instanceof Error && error.message === "USER_SELF_DEACTIVATION") return { code: "CONFLICT" as const, message: "Der aktuell angemeldete Nutzer kann sich nicht selbst deaktivieren." };
    if (error instanceof Error && error.message === "USER_LAST_ACTIVE_DEACTIVATION") return { code: "CONFLICT" as const, message: "Mindestens ein aktiver Nutzer muss erhalten bleiben." };
    if (error instanceof Error && error.message === "USER_LAST_MANAGER_DEMOTION") return { code: "CONFLICT" as const, message: "Mindestens ein aktiver Meister, Administrator oder Entwickler muss erhalten bleiben." };
    if (error instanceof Error && error.message === "USER_ACTIVE_PIN_REQUIRED") return { code: "VALIDATION_ERROR" as const, message: "Ein aktiver Nutzer braucht eine vierstellige PIN." };
    return { code: "UNAVAILABLE" as const, message: "Nutzer konnte nicht sicher gespeichert werden." };
  }
}
