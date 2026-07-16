"use server";

import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { companySettingsTable } from "@/db/schema";
import {
  EMPTY_COMPANY_SETTINGS,
  type CompanySettings,
} from "@/lib/repositories/companySettingsRepository";
import { resolveAuthorization } from "@/lib/server/authorization";

const TENANT_ID = "galvanik-kreile";
const EDITABLE_FIELDS = [
  "companyName",
  "tagline",
  "street",
  "zip",
  "city",
  "country",
  "phone",
  "email",
  "website",
  "iban",
  "bic",
  "bankName",
  "taxId",
  "logoUrl",
  "emailGreeting",
  "emailPickupInfo",
  "emailPaymentInfo",
  "emailAgbText",
  "emailFooter",
  "emailAdditionalNotes",
] as const;

type EditableField = typeof EDITABLE_FIELDS[number];

const FIELD_LIMITS: Record<EditableField, number> = {
  companyName: 200,
  tagline: 300,
  street: 200,
  zip: 20,
  city: 120,
  country: 120,
  phone: 80,
  email: 254,
  website: 500,
  iban: 80,
  bic: 40,
  bankName: 160,
  taxId: 80,
  logoUrl: 500,
  emailGreeting: 500,
  emailPickupInfo: 2_000,
  emailPaymentInfo: 2_000,
  emailAgbText: 10_000,
  emailFooter: 2_000,
  emailAdditionalNotes: 2_000,
};

function mapSettings(row: typeof companySettingsTable.$inferSelect): CompanySettings {
  return {
    id: row.id,
    tenantId: row.tenantId,
    configured: true,
    companyName: row.companyName,
    tagline: row.tagline || "",
    street: row.street || "",
    zip: row.zip || "",
    city: row.city || "",
    country: row.country || "",
    phone: row.phone || "",
    email: row.email || "",
    website: row.website || "",
    iban: row.iban || "",
    bic: row.bic || "",
    bankName: row.bankName || "",
    taxId: row.taxId || "",
    logoUrl: row.logoUrl || "",
    emailGreeting: row.emailGreeting || "",
    emailPickupInfo: row.emailPickupInfo || "",
    emailPaymentInfo: row.emailPaymentInfo || "",
    emailAgbText: row.emailAgbText || "",
    emailFooter: row.emailFooter || "",
    emailAdditionalNotes: row.emailAdditionalNotes || "",
  };
}

function safeLogoUrl(value: string): boolean {
  if (!value) return true;
  if (/^\/assets\/[A-Za-z0-9_./-]+$/.test(value)) return true;
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" || url.username || url.password || url.port) return false;
    const host = url.hostname.toLowerCase();
    return host !== "localhost"
      && host !== "127.0.0.1"
      && host !== "::1"
      && !/^10\./.test(host)
      && !/^192\.168\./.test(host)
      && !/^169\.254\./.test(host)
      && !/^172\.(1[6-9]|2\d|3[01])\./.test(host);
  } catch {
    return false;
  }
}

function parseSettings(input: Partial<CompanySettings>, current: CompanySettings): CompanySettings {
  if (!input || typeof input !== "object" || Array.isArray(input)) throw new Error("INVALID_SETTINGS");
  const allowed = new Set<string>([...EDITABLE_FIELDS, "id", "tenantId", "configured"]);
  if (Object.keys(input).some((key) => !allowed.has(key))) throw new Error("INVALID_SETTINGS");

  const merged: CompanySettings = { ...current };
  for (const field of EDITABLE_FIELDS) {
    if (input[field] === undefined) continue;
    if (typeof input[field] !== "string") throw new Error("INVALID_SETTINGS");
    const normalized = input[field].trim();
    if (normalized.length > FIELD_LIMITS[field] || /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/.test(normalized)) {
      throw new Error("INVALID_SETTINGS");
    }
    merged[field] = normalized;
  }

  if (!merged.companyName || (merged.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(merged.email))) {
    throw new Error("INVALID_SETTINGS");
  }
  if (!safeLogoUrl(merged.logoUrl)) throw new Error("INVALID_SETTINGS");
  return merged;
}

export async function getCompanySettings(): Promise<CompanySettings> {
  const auth = await resolveAuthorization();
  if (!auth.ok || auth.data.tenantId !== TENANT_ID) throw new Error("AUTH_ERROR: Anmeldung erforderlich.");
  try {
    const [row] = await db
      .select()
      .from(companySettingsTable)
      .where(and(eq(companySettingsTable.id, "default"), eq(companySettingsTable.tenantId, auth.data.tenantId)))
      .limit(1);
    if (!row) return { ...EMPTY_COMPANY_SETTINGS, tenantId: auth.data.tenantId, configured: false };
    return mapSettings(row);
  } catch (error) {
    console.error("Company settings read failed", error);
    throw new Error("DATA_ERROR: Firmendaten konnten nicht geladen werden.");
  }
}

export async function updateCompanySettings(data: Partial<CompanySettings>): Promise<CompanySettings> {
  const auth = await resolveAuthorization();
  if (!auth.ok || auth.data.tenantId !== TENANT_ID) throw new Error("AUTH_ERROR: Anmeldung erforderlich.");
  if (!auth.data.permissions.includes("perm_sys_users")) throw new Error("AUTH_ERROR: Keine Berechtigung für Firmendaten.");

  const current = await getCompanySettings();
  const parsed = parseSettings(data, current);
  const values = {
    tenantId: auth.data.tenantId,
    companyName: parsed.companyName,
    tagline: parsed.tagline,
    street: parsed.street,
    zip: parsed.zip,
    city: parsed.city,
    country: parsed.country,
    phone: parsed.phone,
    email: parsed.email,
    website: parsed.website,
    iban: parsed.iban,
    bic: parsed.bic,
    bankName: parsed.bankName,
    taxId: parsed.taxId,
    logoUrl: parsed.logoUrl,
    emailGreeting: parsed.emailGreeting,
    emailPickupInfo: parsed.emailPickupInfo,
    emailPaymentInfo: parsed.emailPaymentInfo,
    emailAgbText: parsed.emailAgbText,
    emailFooter: parsed.emailFooter,
    emailAdditionalNotes: parsed.emailAdditionalNotes,
    updatedAt: new Date(),
  };

  try {
    const [rowWithId] = await db
      .select({ tenantId: companySettingsTable.tenantId })
      .from(companySettingsTable)
      .where(eq(companySettingsTable.id, "default"))
      .limit(1);
    if (rowWithId && rowWithId.tenantId !== auth.data.tenantId) throw new Error("TENANT_CONFLICT");

    const [saved] = rowWithId
      ? await db
          .update(companySettingsTable)
          .set(values)
          .where(and(eq(companySettingsTable.id, "default"), eq(companySettingsTable.tenantId, auth.data.tenantId)))
          .returning()
      : await db
          .insert(companySettingsTable)
          .values({ id: "default", ...values })
          .returning();
    if (!saved) throw new Error("NO_RECEIPT");
    return mapSettings(saved);
  } catch (error) {
    console.error("Company settings write failed", error);
    throw new Error("DATA_ERROR: Firmendaten konnten nicht gespeichert werden.");
  }
}
