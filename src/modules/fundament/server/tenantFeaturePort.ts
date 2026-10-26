import "server-only";

import { sql } from "drizzle-orm";
import { withPrivilegedTenantTransaction } from "@/lib/server/privilegedDb";
import { SALES_STAGE_FEATURES, type SalesStageFeature, type SalesStageFeatureId } from "../featureCatalog";

export type TenantFeatureContext = { tenantId: string; actorId: string; canManage: boolean };
export type TenantFeatureRow = { feature_id: string; enabled: boolean };

const FEATURE_IDS = new Set<string>(SALES_STAGE_FEATURES.map((feature) => feature.id));

function featureId(value: unknown): SalesStageFeatureId | null {
  return typeof value === "string" && FEATURE_IDS.has(value) ? value as SalesStageFeatureId : null;
}

export function mapTenantFeatureRows(rows: TenantFeatureRow[]): SalesStageFeature[] {
  if (rows.length !== SALES_STAGE_FEATURES.length) throw new Error("TENANT_FEATURE_SET_INCOMPLETE");
  const mapped = new Map<SalesStageFeatureId, boolean>();
  for (const row of rows) {
    const id = featureId(row.feature_id);
    if (!id || typeof row.enabled !== "boolean" || mapped.has(id)) throw new Error("TENANT_FEATURE_ROW_INVALID");
    mapped.set(id, row.enabled);
  }
  return SALES_STAGE_FEATURES.map(({ id }) => ({ id, enabled: mapped.get(id) === true }));
}

export async function readTenantFeatures(context: TenantFeatureContext) {
  try {
    const features = await withPrivilegedTenantTransaction(context, async (tx) => {
      const rows = await tx.execute<TenantFeatureRow>(sql`
        SELECT feature_id, enabled
        FROM public.tenant_features
        WHERE tenant = ${context.tenantId}
        ORDER BY feature_id
      `);
      return mapTenantFeatureRows(rows);
    });
    return { code: "OK" as const, features };
  } catch {
    return { code: "UNAVAILABLE" as const, message: "Stufen-Schalter konnten nicht sicher gelesen werden." };
  }
}

export async function setTenantFeature(context: TenantFeatureContext, input: unknown) {
  if (!context.canManage) return { code: "FORBIDDEN" as const, message: "Stufen-Schalter dürfen mit dieser Rolle nicht geändert werden." };
  if (!input || typeof input !== "object" || Array.isArray(input)) return { code: "VALIDATION_ERROR" as const, message: "Stufen-Schalter ist ungültig." };
  const value = input as Record<string, unknown>;
  const id = featureId(value.featureId);
  if (Object.keys(value).sort().join(",") !== "enabled,featureId" || !id || typeof value.enabled !== "boolean") {
    return { code: "VALIDATION_ERROR" as const, message: "Stufen-Schalter ist ungültig." };
  }
  try {
    const updated = await withPrivilegedTenantTransaction(context, async (tx) => tx.execute<{ feature_id: string }>(sql`
      UPDATE public.tenant_features
      SET enabled = ${value.enabled}, updated_at = statement_timestamp()
      WHERE tenant = ${context.tenantId} AND feature_id = ${id}
      RETURNING feature_id
    `));
    if (updated.length !== 1) return { code: "NOT_FOUND" as const, message: "Stufen-Schalter ist nicht eingerichtet." };
    return { code: "OK" as const, feature: { id, enabled: value.enabled } as SalesStageFeature };
  } catch {
    return { code: "UNAVAILABLE" as const, message: "Stufen-Schalter konnte nicht sicher gespeichert werden." };
  }
}

export async function isFeatureEnabled(context: TenantFeatureContext, id: SalesStageFeatureId) {
  const result = await readTenantFeatures(context);
  if (result.code !== "OK") return result;
  return { code: "OK" as const, enabled: result.features.find((feature) => feature.id === id)?.enabled === true };
}
