import "server-only";

import { randomUUID } from "node:crypto";
import { sql } from "drizzle-orm";
import { normaliseOrderPositionSurface, normaliseOrderPositionUnit } from "@/lib/orderPositionContract";
import { withPrivilegedTenantTransaction, type PrivilegedTenantTransaction } from "@/lib/server/privilegedDb";
import { UMSATZSTEUER_EINSTELLUNG_COPY } from "@/ui/situationCatalog";
import { AUFTRAGS_KATALOG_STEUERSAETZE, type AuftragsKatalogSteuersatz, type CatalogService,
  type CatalogServiceChoice, type SaveCatalogServiceInput } from "../public";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
export type CatalogCommandContext = { tenantId: string; actorId: string; canRead: boolean; canManage: boolean;
  readVat?: (tx: PrivilegedTenantTransaction, tenantId: string) => Promise<{ regelsatzBasispunkte:number|null; ermaessigtBasispunkte:number }|null> };
type Row = { id: string; name: string; surface: string; unit: string; net_price_cents: number; vat_rate_basis_points: number; standard_lead_time_working_days: number | null; active: boolean };

function gueltigerSteuersatz(wert: unknown): wert is number {
  return typeof wert === "number" && Number.isSafeInteger(wert) && wert >= 0 && wert <= 10000;
}

function map(row: Row): CatalogService {
  if (!UUID.test(row.id) || !gueltigerSteuersatz(row.vat_rate_basis_points)) throw new Error("CATALOG_READBACK_INVALID");
  return {
    id: row.id, name: row.name, surface: row.surface, unit: row.unit,
    netPriceCents: row.net_price_cents,
    vatRateBasisPoints: row.vat_rate_basis_points,
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
  const name = clean(value.name, 2, 160); const surface = normaliseOrderPositionSurface(value.surface); const unit = normaliseOrderPositionUnit(value.unit);
  if ((value.id !== null && (typeof value.id !== "string" || !UUID.test(value.id))) || !name || !surface || !unit
    || typeof value.netPriceCents !== "number" || !Number.isSafeInteger(value.netPriceCents) || value.netPriceCents < 0 || value.netPriceCents > 999_999_999
    || !gueltigerSteuersatz(value.vatRateBasisPoints)
    || (value.standardLeadTimeWorkingDays !== null && (typeof value.standardLeadTimeWorkingDays !== "number"
      || !Number.isSafeInteger(value.standardLeadTimeWorkingDays) || value.standardLeadTimeWorkingDays < 0 || value.standardLeadTimeWorkingDays > 365))
    || typeof value.active !== "boolean") return null;
  return { id: value.id as string | null, name, surface, unit, netPriceCents: value.netPriceCents, vatRateBasisPoints: value.vatRateBasisPoints, standardLeadTimeWorkingDays: value.standardLeadTimeWorkingDays, active: value.active };
}

type Auftragsleistung = Omit<CatalogService, "vatRateBasisPoints"> & { vatRateBasisPoints: AuftragsKatalogSteuersatz };

type CatalogReadFailure = { code: "FORBIDDEN" | "UNAVAILABLE"; message: string };
export function listCatalogServices(context: CatalogCommandContext, includeInactive?: boolean): Promise<{ code: "OK"; services: CatalogService[] } | CatalogReadFailure>;
export function listCatalogServices(context: CatalogCommandContext, includeInactive: boolean, visibility: "order-prices"): Promise<{ code: "OK"; services: Auftragsleistung[] } | CatalogReadFailure>;
export function listCatalogServices(context: CatalogCommandContext, includeInactive: boolean, visibility: "metadata"): Promise<{ code: "OK"; services: CatalogServiceChoice[] } | CatalogReadFailure>;
export async function listCatalogServices(context: CatalogCommandContext, includeInactive = false, visibility: "prices" | "order-prices" | "metadata" = "prices") {
  if (!context.canRead) return { code: "FORBIDDEN" as const, message: "Leistungskatalog ist nicht erlaubt." };
  try {
    const services = await withPrivilegedTenantTransaction(context, async (tx) => {
      const preise = visibility === "metadata" ? sql`` : sql`, net_price_cents, vat_rate_basis_points`;
      const auftragswerte = visibility === "prices" ? sql`` : sql`AND vat_rate_basis_points IN (
        ${AUFTRAGS_KATALOG_STEUERSAETZE[0]}, ${AUFTRAGS_KATALOG_STEUERSAETZE[1]}, ${AUFTRAGS_KATALOG_STEUERSAETZE[2]})`;
      const rows = await tx.execute<Row>(sql`
        SELECT id, name, surface, unit, standard_lead_time_working_days, active ${preise}
        FROM public.catalog_services
        WHERE tenant_id = ${context.tenantId} AND (${includeInactive} OR active) ${auftragswerte}
        ORDER BY active DESC, name, surface
      `);
      return rows.map(row => {
        if (visibility !== "metadata") return map(row);
        if (!UUID.test(row.id)) throw new Error("CATALOG_READBACK_INVALID");
        return {id:row.id,name:row.name,surface:row.surface,unit:row.unit,standardLeadTimeWorkingDays:row.standard_lead_time_working_days,active:row.active};
      });
    });
    return { code: "OK" as const, services };
  } catch (error) {
    console.error("[CATALOG_READ_ERROR]", {
      message: error instanceof Error ? error.message.slice(0, 200) : "UNKNOWN",
    });
    return { code: "UNAVAILABLE" as const, message: "Leistungskatalog konnte nicht geladen werden." };
  }
}

export async function saveCatalogService(context: CatalogCommandContext, input: unknown) {
  if (!context.canManage) return { code: "FORBIDDEN" as const, message: "Leistungskatalog darf nicht geändert werden." };
  const value = normalize(input);
  if (!value) return { code: "VALIDATION_ERROR" as const, message: "Leistungsdaten sind unvollständig oder ungültig." };
  if (value.vatRateBasisPoints !== 0 && !context.readVat) return { code: "UNAVAILABLE" as const, message: "Leistung konnte nicht sicher gespeichert werden." };
  const id = value.id ?? randomUUID();
  try {
    const service = await withPrivilegedTenantTransaction(context, async (tx) => {
      if (value.vatRateBasisPoints !== 0) {
        const saetze = await context.readVat!(tx, context.tenantId);
        if (value.vatRateBasisPoints !== saetze?.regelsatzBasispunkte
          && value.vatRateBasisPoints !== saetze?.ermaessigtBasispunkte) {
          const bestand = value.id ? await tx.execute<{ vat_rate_basis_points: number }>(sql`
            SELECT vat_rate_basis_points FROM public.catalog_services
            WHERE tenant_id = ${context.tenantId} AND id = ${id}::uuid FOR UPDATE
          `) : [];
          if (bestand[0]?.vat_rate_basis_points !== value.vatRateBasisPoints) return null;
        }
      }
      await tx.execute(sql`SELECT set_config('app.actor_id', ${context.actorId}, true)`);
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
    if (!service) return { code: "VALIDATION_ERROR" as const, message: UMSATZSTEUER_EINSTELLUNG_COPY.katalogSatzUngueltig };
    return { code: "OK" as const, service };
  } catch (error) {
    console.error("[CATALOG_WRITE_ERROR]", {
      message: error instanceof Error ? error.message.slice(0, 200) : "UNKNOWN",
    });
    return { code: "UNAVAILABLE" as const, message: "Leistung konnte nicht sicher gespeichert werden." };
  }
}
