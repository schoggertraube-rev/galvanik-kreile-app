import "server-only";

import { sql } from "drizzle-orm";
import { withPrivilegedTenantTransaction, type PrivilegedTenantTransaction } from "@/lib/server/privilegedDb";
import { SALES_STAGE_FEATURES, type SalesStageFeature, type SalesStageFeatureId } from "../featureCatalog";

export type TenantFeatureContext = { tenantId: string; actorId: string; canManage: boolean };
export type TenantFeatureRow = { feature_id: string; enabled: boolean };

const FEATURE_IDS = new Set<string>(SALES_STAGE_FEATURES.map((feature) => feature.id));

function logTenantFeatureFailure(code: string, error: unknown) {
  console.error(`[${code}]`, error instanceof Error ? error.message : "UNKNOWN_ERROR");
}

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

export function readTenantFeatureRows(tx: PrivilegedTenantTransaction, tenantId: string) {
  return tx.execute<TenantFeatureRow>(sql`
    SELECT feature_id, enabled
    FROM public.tenant_features
    WHERE tenant = ${tenantId}
    ORDER BY feature_id
  `);
}

export async function readTenantFeatures(context: TenantFeatureContext) {
  try {
    const features = await withPrivilegedTenantTransaction(context, async tx =>
      mapTenantFeatureRows(await readTenantFeatureRows(tx, context.tenantId)));
    return { code: "OK" as const, features };
  } catch (error) {
    logTenantFeatureFailure("TENANT_FEATURE_READ_FAILED", error);
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
  } catch (error) {
    logTenantFeatureFailure("TENANT_FEATURE_WRITE_FAILED", error);
    return { code: "UNAVAILABLE" as const, message: "Stufen-Schalter konnte nicht sicher gespeichert werden." };
  }
}

export async function isFeatureEnabled(context: Pick<TenantFeatureContext, "tenantId">, id: SalesStageFeatureId) {
  try {
    const rows = await withPrivilegedTenantTransaction(context, tx => readTenantFeatureRows(tx, context.tenantId));
    const feature = rows.find(row => row.feature_id === id);
    if (typeof feature?.enabled !== "boolean") throw Error("TENANT_FEATURE_MISSING");
    return { code: "OK" as const, enabled: feature.enabled };
  } catch (error) {
    logTenantFeatureFailure("TENANT_FEATURE_READ_FAILED", error);
    return { code: "UNAVAILABLE" as const, message: "Stufen-Schalter konnten nicht sicher gelesen werden." };
  }
}
