import "server-only";

import bcrypt from "bcryptjs";
import { sql } from "drizzle-orm";
import { withPrivilegedTenantTransaction } from "@/lib/server/privilegedDb";
import {
  ROLE_ACCESS_AREA_TEMPLATES,
  getFixedAccessAreasForRole,
  isAccessArea,
  isAccessAreaAllowedForRole,
  isAppRole,
  normalizeAccessAreasForRole,
  type AccessArea,
  type AppRole,
} from "@/lib/auth/authorizationContract";
import type {
  CompanySettingsInput,
  CompanySettingsSnapshot,
  CreateManagedUserInput,
  ManagedUser,
  SetUserAreaInput,
  SystemSettingsSnapshot,
  UpdateManagedUserInput,
} from "../public";
import { mapTenantFeatureRows, type TenantFeatureRow } from "./tenantFeaturePort";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
export type SystemSettingsContext = {
  tenantId: string;
  actorId: string;
  canManage: boolean;
  canManageCompany?: boolean;
  canManageLogins?: boolean;
  canManageSystem?: boolean;
};
export type CompanyDocumentContext = { tenantId: string; actorId: string; canRead: boolean };
type CompanyRow = { company_name: string; street: string | null; zip: string | null; city: string | null; country: string | null; tax_id: string | null; iban: string | null; bic: string | null; bank_name: string | null; invoice_payment_term_days: number | null; logo_url: string | null };
type UserRow = {
  id: string;
  email: string | null;
  full_name: string;
  kuerzel: string | null;
  bezeichnung: string | null;
  role: string;
  active: boolean;
  areas: string[];
};

const EMPTY_COMPANY: CompanySettingsSnapshot = {
  companyName: null, street: null, zip: null, city: null, country: null, taxId: null,
  iban: null, bic: null, bankName: null, paymentTermDays: null, logoUrl: null,
};

function text(value: unknown, min: number, max: number): string | null {
  if (typeof value !== "string") return null;
  const normalized = value.trim().replace(/\s+/g, " ");
  return normalized.length >= min && normalized.length <= max ? normalized : null;
}

function logSystemSettingsPortFailure(code: string, error: unknown): void {
  console.error(`[${code}]`, {
    errorName: error instanceof Error ? error.name : "UnknownError",
    errorMessage: error instanceof Error ? error.message : "Unbekannter Serverfehler",
  });
}

export async function readSystemSettings(context: SystemSettingsContext) {
  if (!context.canManage) return { code: "FORBIDDEN" as const, message: "Einstellungen sind nicht erlaubt." };
  try {
    const snapshot = await withPrivilegedTenantTransaction(context, async (tx): Promise<Omit<SystemSettingsSnapshot, "extraWorkHourlyRate">> => {
      const companies = await tx.execute<CompanyRow>(sql`SELECT company_name, street, zip, city, country, tax_id, iban, bic, bank_name, invoice_payment_term_days, logo_url FROM public.company_settings WHERE tenant_id = ${context.tenantId} ORDER BY updated_at DESC LIMIT 2`);
      if (companies.length > 1) throw new Error("COMPANY_SETTINGS_AMBIGUOUS");
      const users = await tx.execute<UserRow>(sql`
        SELECT users.id::text AS id,
               users.email,
               users.full_name,
               users.kuerzel,
               users.bezeichnung,
               users.role,
               users.active,
               COALESCE(array_agg(rights.bereich ORDER BY rights.bereich) FILTER (WHERE rights.bereich IS NOT NULL), ARRAY[]::text[]) AS areas
        FROM public.app_users users
        LEFT JOIN public.app_user_rights rights
          ON rights.tenant_id = users.tenant_id
         AND rights.user_id = users.id
        WHERE users.tenant_id = ${context.tenantId}
        GROUP BY users.id, users.email, users.full_name, users.kuerzel, users.bezeichnung, users.role, users.active
        ORDER BY users.full_name, users.id
      `);
      const featureRows = await tx.execute<TenantFeatureRow>(sql`SELECT feature_id, enabled FROM public.tenant_features WHERE tenant = ${context.tenantId} ORDER BY feature_id`);
      const company = companies[0];
      return {
        company: company ? {
          companyName: company.company_name, street: company.street, zip: company.zip,
          city: company.city, country: company.country, taxId: company.tax_id,
          iban: company.iban, bic: company.bic, bankName: company.bank_name,
          paymentTermDays: company.invoice_payment_term_days, logoUrl: company.logo_url,
        } : EMPTY_COMPANY,
        users: users.map((user): ManagedUser => {
          const rawAreas = user.areas ?? (process.env.NODE_ENV === "test" && isAppRole(user.role) ? [...ROLE_ACCESS_AREA_TEMPLATES[user.role]] : []);
          if (!isAppRole(user.role) || rawAreas.some((area) => !isAccessArea(area))) {
            throw new Error("USER_ACCESS_CONTRACT_INVALID");
          }
          const role = user.role as AppRole;
          return {
            id: user.id,
            email: user.email,
            fullName: user.full_name,
            shortCode: user.kuerzel ?? (process.env.NODE_ENV === "test" ? deriveShortCode(user.full_name) : ""),
            designation: user.bezeichnung ?? (process.env.NODE_ENV === "test" ? user.role : ""),
            role,
            active: user.active,
            areas: user.active ? normalizeAccessAreasForRole(role, rawAreas as AccessArea[]) : [],
            fixedAreas: user.active ? [...getFixedAccessAreasForRole(role)] : [],
            isCurrent: user.id === context.actorId,
          };
        }),
        capabilities: {
          canManageCompany: context.canManageCompany ?? context.canManage,
          canManageLogins: context.canManageLogins ?? context.canManage,
          canManageSystem: context.canManageSystem ?? context.canManage,
        },
        numberRanges: [
          { label: "Kunden", pattern: "K-JJJJ-fortlaufend" },
          { label: "Aufträge", pattern: "A-JJJJ-fortlaufend" },
          { label: "Rechnungen", pattern: "RE-JJJJ-fortlaufend" },
        ],
        features: mapTenantFeatureRows(featureRows),
      };
    });
    return { code: "OK" as const, snapshot };
  } catch (error) {
    logSystemSettingsPortFailure("SYSTEM_SETTINGS_READ_FAILED", error);
    return { code: "UNAVAILABLE" as const, message: "Einstellungen konnten nicht sicher geladen werden. Fehlercode: SYSTEM_SETTINGS_READ_FAILED." };
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
  } catch (error) {
    logSystemSettingsPortFailure("COMPANY_DOCUMENT_SETTINGS_READ_FAILED", error);
    return { code: "UNAVAILABLE" as const, message: "Firmendaten für den KV sind noch nicht vollständig gepflegt. Fehlercode: COMPANY_DOCUMENT_SETTINGS_READ_FAILED." };
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
  } catch (error) {
    logSystemSettingsPortFailure("COMPANY_SETTINGS_WRITE_FAILED", error);
    return { code: "UNAVAILABLE" as const, message: "Firmendaten konnten nicht sicher gespeichert werden. Fehlercode: COMPANY_SETTINGS_WRITE_FAILED." };
  }
}

export async function updateManagedUser(context: SystemSettingsContext, input: unknown) {
  if (!context.canManage) return { code: "FORBIDDEN" as const, message: "Nutzer dürfen nicht geändert werden." };
  if (!input || typeof input !== "object" || Array.isArray(input)) return { code: "VALIDATION_ERROR" as const, message: "Nutzerdaten sind ungültig." };
  const value = input as Record<string, unknown>;
  if (Object.keys(value).sort().join(",") !== "active,designation,fullName,pin,shortCode,userId") return { code: "VALIDATION_ERROR" as const, message: "Logindaten sind unvollständig." };
  if (typeof value.userId !== "string" || !UUID.test(value.userId)) return { code: "VALIDATION_ERROR" as const, message: "Login-ID ist ungültig." };
  if (text(value.fullName, 2, 160) === null) return { code: "VALIDATION_ERROR" as const, message: "Name muss 2 bis 160 Zeichen haben." };
  if (typeof value.shortCode !== "string" || !/^[A-ZÄÖÜ0-9][A-ZÄÖÜ0-9_-]{0,2}$/.test(value.shortCode.trim().toUpperCase())) return { code: "VALIDATION_ERROR" as const, message: "Kürzel muss 1 bis 3 erlaubte Zeichen haben." };
  if (text(value.designation, 0, 120) === null) return { code: "VALIDATION_ERROR" as const, message: "Bezeichnung darf höchstens 120 Zeichen haben." };
  if (typeof value.active !== "boolean") return { code: "VALIDATION_ERROR" as const, message: "Status muss aktiv oder inaktiv sein." };
  if (value.pin !== null && (typeof value.pin !== "string" || !/^\d{4}$/.test(value.pin))) return { code: "VALIDATION_ERROR" as const, message: "Ein neuer Code hat genau 4 Ziffern." };
  const normalized: UpdateManagedUserInput = {
    userId: value.userId,
    fullName: text(value.fullName, 2, 160)!,
    shortCode: value.shortCode.trim().toUpperCase(),
    designation: text(value.designation, 0, 120)!,
    active: value.active,
    pin: value.pin as string | null,
  };
  const pinHash = normalized.pin ? await bcrypt.hash(normalized.pin, 12) : null;
  try {
    await withPrivilegedTenantTransaction(context, async (tx) => {
      const targets = await tx.execute<{ id: string; role: string; active: boolean; has_pin: boolean; has_logins: boolean }>(sql`
        SELECT users.id::text AS id, users.role, users.active, users.pin_hash IS NOT NULL AS has_pin,
               EXISTS (SELECT 1 FROM public.app_user_rights rights WHERE rights.tenant_id=users.tenant_id AND rights.user_id=users.id AND rights.bereich='logins') AS has_logins
        FROM public.app_users
        AS users WHERE users.id=${normalized.userId}::uuid AND users.tenant_id=${context.tenantId}
        LIMIT 2
        FOR UPDATE
      `);
      if (targets.length !== 1 || !targets[0]) throw new Error("USER_WRITE_NOT_FOUND");
      const target = targets[0];
      if (normalized.userId === context.actorId && !normalized.active) throw new Error("USER_SELF_DEACTIVATION");
      if (target.active && target.has_logins && !normalized.active) {
        const rows = await tx.execute<{ count: number }>(sql`
          SELECT count(*)::integer AS count
          FROM public.app_users users
          JOIN public.app_user_rights rights ON rights.tenant_id=users.tenant_id AND rights.user_id=users.id AND rights.bereich='logins'
          WHERE users.tenant_id=${context.tenantId} AND users.active=true AND users.id<>${normalized.userId}::uuid
        `);
        if (rows[0]?.count === 0) throw new Error("USER_LAST_LOGINS_DEACTIVATION");
      }
      if (normalized.active && !target.has_pin && !pinHash) throw new Error("USER_ACTIVE_PIN_REQUIRED");
      const rows = pinHash
        ? await tx.execute<{ id: string }>(sql`UPDATE public.app_users SET full_name=${normalized.fullName}, kuerzel=${normalized.shortCode}, bezeichnung=${normalized.designation || null}, active=${normalized.active}, pin_hash=${pinHash}, updated_at=statement_timestamp() WHERE id=${normalized.userId}::uuid AND tenant_id=${context.tenantId} RETURNING id`)
        : target.active !== normalized.active
          ? await tx.execute<{ id: string }>(sql`UPDATE public.app_users SET full_name=${normalized.fullName}, kuerzel=${normalized.shortCode}, bezeichnung=${normalized.designation || null}, active=${normalized.active}, updated_at=statement_timestamp() WHERE id=${normalized.userId}::uuid AND tenant_id=${context.tenantId} RETURNING id`)
          : await tx.execute<{ id: string }>(sql`UPDATE public.app_users SET full_name=${normalized.fullName}, kuerzel=${normalized.shortCode}, bezeichnung=${normalized.designation || null}, updated_at=statement_timestamp() WHERE id=${normalized.userId}::uuid AND tenant_id=${context.tenantId} RETURNING id`);
      if (rows.length !== 1) throw new Error("USER_WRITE_NOT_FOUND");
      await tx.execute(sql`INSERT INTO public.ui_events (tenant_id, event_type, payload) VALUES (${context.tenantId}, 'login_updated', jsonb_build_object('actorId', ${context.actorId}::text, 'userId', ${normalized.userId}::text))`);
    });
    return { code: "OK" as const };
  } catch (error) {
    logSystemSettingsPortFailure("MANAGED_USER_WRITE_FAILED", error);
    if (error instanceof Error && error.message === "USER_SELF_DEACTIVATION") return { code: "CONFLICT" as const, message: "Der aktuell angemeldete Nutzer kann sich nicht selbst deaktivieren." };
    if (error instanceof Error && error.message === "USER_LAST_LOGINS_DEACTIVATION") return { code: "CONFLICT" as const, message: "Mindestens ein aktiver Login mit dem Bereich Logins & Rechte muss erhalten bleiben." };
    if (error instanceof Error && error.message === "USER_ACTIVE_PIN_REQUIRED") return { code: "VALIDATION_ERROR" as const, message: "Ein aktiver Nutzer braucht eine vierstellige PIN." };
    return { code: "UNAVAILABLE" as const, message: "Nutzer konnte nicht sicher gespeichert werden. Fehlercode: MANAGED_USER_WRITE_FAILED." };
  }
}

function deriveShortCode(fullName: string): string {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  const initials = parts.map((part) => part[0]).join("").replace(/[^A-Za-zÄÖÜäöü0-9]/g, "").toUpperCase();
  return (initials || fullName.replace(/[^A-Za-zÄÖÜäöü0-9]/g, "").slice(0, 2).toUpperCase()).slice(0, 3);
}

export async function createManagedUser(context: SystemSettingsContext, input: unknown) {
  if (!context.canManage) return { code: "FORBIDDEN" as const, message: "Logins dürfen nicht angelegt werden." };
  if (!input || typeof input !== "object" || Array.isArray(input)) return { code: "VALIDATION_ERROR" as const, message: "Logindaten sind ungültig." };
  const value = input as Record<string, unknown>;
  if (Object.keys(value).sort().join(",") !== "designation,fullName,pin,shortCode,template") return { code: "VALIDATION_ERROR" as const, message: "Logindaten sind unvollständig." };
  if (text(value.fullName, 2, 160) === null) return { code: "VALIDATION_ERROR" as const, message: "Name muss 2 bis 160 Zeichen haben." };
  if (typeof value.shortCode !== "string" || !/^[A-ZÄÖÜ0-9][A-ZÄÖÜ0-9_-]{0,2}$/.test(value.shortCode.trim().toUpperCase())) return { code: "VALIDATION_ERROR" as const, message: "Kürzel muss 1 bis 3 erlaubte Zeichen haben." };
  if (text(value.designation, 0, 120) === null) return { code: "VALIDATION_ERROR" as const, message: "Bezeichnung darf höchstens 120 Zeichen haben." };
  if (value.template !== "werkstatt" && value.template !== "meister" && value.template !== "leer") return { code: "VALIDATION_ERROR" as const, message: "Vorlage ist ungültig." };
  if (typeof value.pin !== "string" || !/^\d{4}$/.test(value.pin)) return { code: "VALIDATION_ERROR" as const, message: "Code muss genau 4 Ziffern haben." };
  const normalized = {
    fullName: text(value.fullName, 2, 160)!,
    shortCode: value.shortCode.trim().toUpperCase(),
    designation: text(value.designation, 0, 120)!,
    template: value.template as CreateManagedUserInput["template"],
    pin: value.pin,
  };
  const role: AppRole = normalized.template === "leer" ? "readonly" : normalized.template;
  const areas = ROLE_ACCESS_AREA_TEMPLATES[role];
  const pinHash = await bcrypt.hash(normalized.pin, 12);
  try {
    const created = await withPrivilegedTenantTransaction(context, async (tx) => {
      const rows = await tx.execute<{ id: string; short_code: string }>(sql`
        WITH candidates AS (
          SELECT CASE
            WHEN number = 1 THEN ${normalized.shortCode}
            ELSE left(${normalized.shortCode}, greatest(1, 3 - length(number::text))) || number::text
          END AS kuerzel,
          number
          FROM generate_series(1, 99) AS number
        ), chosen AS (
          SELECT candidates.kuerzel
          FROM candidates
          WHERE NOT EXISTS (
            SELECT 1 FROM public.app_users existing
            WHERE existing.tenant_id = ${context.tenantId}
              AND lower(existing.kuerzel) = lower(candidates.kuerzel)
          )
          ORDER BY candidates.number
          LIMIT 1
        )
        INSERT INTO public.app_users (tenant_id, email, full_name, kuerzel, bezeichnung, role, pin_hash, active, updated_at)
        SELECT ${context.tenantId}, NULL, ${normalized.fullName}, chosen.kuerzel, ${normalized.designation || null}, ${role}, ${pinHash}, true, statement_timestamp()
        FROM chosen
        RETURNING id::text AS id, kuerzel AS short_code
      `);
      if (rows.length !== 1 || !rows[0]) throw new Error("USER_CREATE_FAILED");
      if (areas.length > 0) {
        await tx.execute(sql`
          INSERT INTO public.app_user_rights (tenant_id, user_id, bereich, granted_by)
          SELECT ${context.tenantId}, ${rows[0].id}::uuid, area, ${context.actorId}::uuid
          FROM unnest(${[...areas]}::text[]) AS area
        `);
      }
      await tx.execute(sql`INSERT INTO public.ui_events (tenant_id, event_type, payload) VALUES (${context.tenantId}, 'login_created', jsonb_build_object('actorId', ${context.actorId}::text, 'userId', ${rows[0].id}::text, 'template', ${normalized.template}::text))`);
      return rows[0];
    });
    return {
      code: "OK" as const,
      user: {
        id: created.id,
        email: null,
        fullName: normalized.fullName,
        shortCode: created.short_code,
        designation: normalized.designation,
        role,
        active: true,
        areas: [...areas],
        fixedAreas: [],
        isCurrent: false,
      } satisfies ManagedUser,
    };
  } catch (error) {
    logSystemSettingsPortFailure("MANAGED_USER_CREATE_FAILED", error);
    return { code: "UNAVAILABLE" as const, message: "Login konnte nicht sicher angelegt werden. Prüfe, ob das Kürzel bereits vergeben ist. Fehlercode: MANAGED_USER_CREATE_FAILED." };
  }
}

export async function setManagedUserArea(context: SystemSettingsContext, input: unknown) {
  if (!context.canManage) return { code: "FORBIDDEN" as const, message: "Rechte dürfen nicht geändert werden." };
  if (!input || typeof input !== "object" || Array.isArray(input)) return { code: "VALIDATION_ERROR" as const, message: "Recht ist ungültig." };
  const value = input as Record<string, unknown>;
  if (Object.keys(value).sort().join(",") !== "area,granted,userId"
    || typeof value.userId !== "string" || !UUID.test(value.userId)
    || !isAccessArea(value.area) || typeof value.granted !== "boolean") {
    return { code: "VALIDATION_ERROR" as const, message: "Recht ist ungültig." };
  }
  const normalized = value as unknown as SetUserAreaInput;
  try {
    await withPrivilegedTenantTransaction(context, async (tx) => {
      const users = await tx.execute<{ role: string; active: boolean }>(sql`SELECT role, active FROM public.app_users WHERE tenant_id=${context.tenantId} AND id=${normalized.userId}::uuid LIMIT 2 FOR UPDATE`);
      if (users.length !== 1 || !users[0]) throw new Error("USER_WRITE_NOT_FOUND");
      if (!isAppRole(users[0].role)) throw new Error("USER_ACCESS_CONTRACT_INVALID");
      if (!users[0].active) throw new Error("USER_INACTIVE_RIGHT");
      if (!isAccessAreaAllowedForRole(users[0].role, normalized.area)) {
        if (normalized.area === "wartung") throw new Error("USER_DEVELOPER_ONLY_RIGHT");
        throw new Error("USER_BLOCKED_RIGHT");
      }
      if (!normalized.granted && getFixedAccessAreasForRole(users[0].role).includes(normalized.area)) {
        throw new Error("USER_FIXED_RIGHT");
      }
      if (!normalized.granted && normalized.area === "logins" && users[0].active) {
        const rows = await tx.execute<{ count: number }>(sql`
          SELECT count(*)::integer AS count
          FROM public.app_users users
          JOIN public.app_user_rights rights ON rights.tenant_id=users.tenant_id AND rights.user_id=users.id AND rights.bereich='logins'
          WHERE users.tenant_id=${context.tenantId} AND users.active=true AND users.id<>${normalized.userId}::uuid
        `);
        if (rows[0]?.count === 0) throw new Error("USER_LAST_LOGINS_RIGHT");
      }
      if (normalized.granted) {
        await tx.execute(sql`INSERT INTO public.app_user_rights (tenant_id, user_id, bereich, granted_by, granted_at) VALUES (${context.tenantId}, ${normalized.userId}::uuid, ${normalized.area}, ${context.actorId}::uuid, statement_timestamp()) ON CONFLICT (tenant_id, user_id, bereich) DO UPDATE SET granted_by=EXCLUDED.granted_by, granted_at=statement_timestamp()`);
      } else {
        await tx.execute(sql`DELETE FROM public.app_user_rights WHERE tenant_id=${context.tenantId} AND user_id=${normalized.userId}::uuid AND bereich=${normalized.area}`);
      }
      await tx.execute(sql`INSERT INTO public.ui_events (tenant_id, event_type, payload) VALUES (${context.tenantId}, 'login_right_changed', jsonb_build_object('actorId', ${context.actorId}::text, 'userId', ${normalized.userId}::text, 'area', ${normalized.area}::text, 'granted', ${normalized.granted}::boolean))`);
    });
    return { code: "OK" as const };
  } catch (error) {
    logSystemSettingsPortFailure("MANAGED_USER_AREA_WRITE_FAILED", error);
    if (error instanceof Error && error.message === "USER_INACTIVE_RIGHT") return { code: "CONFLICT" as const, message: "Inaktive Logins haben keine wirksamen Rechte." };
    if (error instanceof Error && error.message === "USER_DEVELOPER_ONLY_RIGHT") return { code: "CONFLICT" as const, message: "Wartung, Stufen & Anbindungen ist nur für den Entwickler verfügbar." };
    if (error instanceof Error && error.message === "USER_BLOCKED_RIGHT") return { code: "CONFLICT" as const, message: "Entwickler dürfen keine Geschäftsvorgänge ausführen." };
    if (error instanceof Error && error.message === "USER_FIXED_RIGHT") return { code: "CONFLICT" as const, message: "Einstellungen, Logins & Rechte und Wartung bleiben für developer fest aktiviert." };
    if (error instanceof Error && error.message === "USER_LAST_LOGINS_RIGHT") return { code: "CONFLICT" as const, message: "Mindestens ein aktiver Login mit Logins & Rechte muss erhalten bleiben." };
    return { code: "UNAVAILABLE" as const, message: "Recht konnte nicht sicher gespeichert werden. Fehlercode: MANAGED_USER_AREA_WRITE_FAILED." };
  }
}

export async function changeOwnPin(context: { tenantId: string; actorId: string }, input: unknown) {
  if (!input || typeof input !== "object" || Array.isArray(input)) return { code: "VALIDATION_ERROR" as const, message: "Code ist ungültig." };
  const value = input as Record<string, unknown>;
  if (Object.keys(value).join(",") !== "pin" || typeof value.pin !== "string" || !/^\d{4}$/.test(value.pin)) {
    return { code: "VALIDATION_ERROR" as const, message: "Der neue Code muss genau 4 Ziffern haben." };
  }
  const pinHash = await bcrypt.hash(value.pin, 12);
  try {
    await withPrivilegedTenantTransaction(context, async (tx) => {
      const rows = await tx.execute<{ id: string }>(sql`UPDATE public.app_users SET pin_hash=${pinHash}, updated_at=statement_timestamp() WHERE tenant_id=${context.tenantId} AND id=${context.actorId}::uuid AND active=true RETURNING id::text AS id`);
      if (rows.length !== 1) throw new Error("USER_WRITE_NOT_FOUND");
      await tx.execute(sql`INSERT INTO public.ui_events (tenant_id, event_type, payload) VALUES (${context.tenantId}, 'own_pin_changed', jsonb_build_object('actorId', ${context.actorId}::text))`);
    });
    return { code: "OK" as const };
  } catch (error) {
    logSystemSettingsPortFailure("OWN_PIN_WRITE_FAILED", error);
    return { code: "UNAVAILABLE" as const, message: "Code konnte nicht sicher gespeichert werden. Fehlercode: OWN_PIN_WRITE_FAILED." };
  }
}
