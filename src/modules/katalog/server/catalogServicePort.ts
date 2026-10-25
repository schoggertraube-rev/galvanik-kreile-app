import "server-only";

import { randomUUID } from "node:crypto";
import { sql } from "drizzle-orm";
import { withPrivilegedTenantTransaction } from "@/lib/server/privilegedDb";
import type { CatalogService, SaveCatalogServiceInput } from "../public";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
export type CatalogCommandContext = { tenantId: string; canRead: boolean; canManage: boolean };
type Row = { id: string; name: string; surface: string; unit: string; net_price_cents: number; vat_rate_basis_points: number; standard_lead_time_working_days: number; active: boolean };

function map(row: Row): CatalogService {
  if (!UUID.test(row.id) || ![0, 700, 1900].includes(row.vat_rate_basis_points)) throw new Error("CATALOG_READBACK_INVALID");
  return {
    id: row.id, name: row.name, surface: row.surface, unit: row.unit,
    netPriceCents: row.net_price_cents,
    vatRateBasisPoints: row.vat_rate_basis_points as 0 | 700 | 1900,
    standardLeadTimeWorkingDays: row.standard_lead_time_working_days,
    active: row.active,
  };
}

function normalize(input: unknown): SaveCatalogServiceInput | null {
  if (!input || typeof input !== "object" || Array.isArray(input)) return null;
  const value = input as Record<string, unknown>;
  const keys = Object.keys(value).sort().join(",");
  if (keys !== "active,id,name,netPriceCents,standardLeadTimeWorkingDays,surface,unit,vatRateBasisPoints") return null;
  const clean = (candidate: unknown, min: number, max: number) => typeof candidate === "string" && candidate.trim().length >= min && candidate.trim().length <= max ? candidate.trim().replace(/\s+/g, " ") : null;
  const name = clean(value.name, 2, 160); const surface = clean(value.surface, 2, 160); const unit = clean(value.unit, 1, 40);
  if ((value.id !== null && (typeof value.id !== "string" || !UUID.test(value.id))) || !name || !surface || !unit
    || typeof value.netPriceCents !== "number" || !Number.isSafeInteger(value.netPriceCents) || value.netPriceCents < 0 || value.netPriceCents > 999_999_999
    || ![0, 700, 1900].includes(Number(value.vatRateBasisPoints))
    || typeof value.standardLeadTimeWorkingDays !== "number" || !Number.isSafeInteger(value.standardLeadTimeWorkingDays) || value.standardLeadTimeWorkingDays < 0 || value.standardLeadTimeWorkingDays > 365
    || typeof value.active !== "boolean") return null;
  return { id: value.id as string | null, name, surface, unit, netPriceCents: value.netPriceCents, vatRateBasisPoints: value.vatRateBasisPoints as 0 | 700 | 1900, standardLeadTimeWorkingDays: value.standardLeadTimeWorkingDays, active: value.active };
}

export async function listCatalogServices(context: CatalogCommandContext, includeInactive = false) {
  if (!context.canRead) return { code: "FORBIDDEN" as const, message: "Leistungskatalog ist nicht erlaubt." };
  try {
    const services = await withPrivilegedTenantTransaction(context, async (tx) => {
      const rows = await tx.execute<Row>(sql`SELECT id, name, surface, unit, net_price_cents, vat_rate_basis_points, standard_lead_time_working_days, active FROM public.catalog_services WHERE tenant_id = ${context.tenantId} AND (${includeInactive} OR active) ORDER BY active DESC, name, surface`);
      return rows.map(map);
    });
    return { code: "OK" as const, services };
  } catch {
    return { code: "UNAVAILABLE" as const, message: "Leistungskatalog konnte nicht geladen werden." };
  }
}

export async function saveCatalogService(context: CatalogCommandContext, input: unknown) {
  if (!context.canManage) return { code: "FORBIDDEN" as const, message: "Leistungskatalog darf nicht geändert werden." };
  const value = normalize(input);
  if (!value) return { code: "VALIDATION_ERROR" as const, message: "Leistungsdaten sind unvollständig oder ungültig." };
  const id = value.id ?? randomUUID();
  try {
    const service = await withPrivilegedTenantTransaction(context, async (tx) => {
      const rows = await tx.execute<Row>(sql`
        INSERT INTO public.catalog_services (id, tenant_id, name, surface, unit, net_price_cents, vat_rate_basis_points, standard_lead_time_working_days, active)
        VALUES (${id}::uuid, ${context.tenantId}, ${value.name}, ${value.surface}, ${value.unit}, ${value.netPriceCents}, ${value.vatRateBasisPoints}, ${value.standardLeadTimeWorkingDays}, ${value.active})
        ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, surface = EXCLUDED.surface, unit = EXCLUDED.unit,
          net_price_cents = EXCLUDED.net_price_cents, vat_rate_basis_points = EXCLUDED.vat_rate_basis_points,
          standard_lead_time_working_days = EXCLUDED.standard_lead_time_working_days, active = EXCLUDED.active,
          updated_at = statement_timestamp()
        WHERE catalog_services.tenant_id = ${context.tenantId}
        RETURNING id, name, surface, unit, net_price_cents, vat_rate_basis_points, standard_lead_time_working_days, active
      `);
      if (rows.length !== 1 || !rows[0]) throw new Error("CATALOG_WRITE_FAILED");
      return map(rows[0]);
    });
    return { code: "OK" as const, service };
  } catch {
    return { code: "UNAVAILABLE" as const, message: "Leistung konnte nicht sicher gespeichert werden." };
  }
}
