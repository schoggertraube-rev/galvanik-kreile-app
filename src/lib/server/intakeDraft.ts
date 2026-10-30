import "server-only";

import { sql } from "drizzle-orm";
import type { AuthorizationSnapshot } from "@/lib/server/authorization";
import { withPrivilegedTenantTransaction } from "@/lib/server/privilegedDb";

type DraftRow = { payload: unknown; updated_at: Date | string };
type DraftResult<T> = { code: "OK"; data: T } | { code: "FORBIDDEN" | "VALIDATION_ERROR" | "UNAVAILABLE"; message: string };

function canUseDraft(auth: AuthorizationSnapshot) {
  return auth.permissions.includes("perm_view_leitstand");
}

function validPayload(payload: unknown): payload is Record<string, unknown> {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) return false;
  const value = payload as Record<string, unknown>;
  if (value.version !== 1 || value.kind !== "INTAKE") return false;
  try {
    return JSON.stringify(value).length <= 100_000;
  } catch {
    return false;
  }
}

export async function saveIntakeDraft(auth: AuthorizationSnapshot, payload: unknown): Promise<DraftResult<{ updatedAt: string }>> {
  if (!canUseDraft(auth)) return { code: "FORBIDDEN", message: "Entwürfe sind für dieses Profil nicht freigegeben." };
  if (!validPayload(payload)) return { code: "VALIDATION_ERROR", message: "Der Entwurf ist unvollständig oder ungültig." };
  try {
    const rows = await withPrivilegedTenantTransaction(auth, (tx) => tx.execute<DraftRow>(sql`
      INSERT INTO private.intake_drafts (tenant_id, actor_id, payload, status)
      VALUES (${auth.tenantId}, ${auth.userId}::uuid, ${JSON.stringify(payload)}::jsonb, 'open')
      ON CONFLICT (tenant_id, actor_id) DO UPDATE
      SET payload = EXCLUDED.payload, status = 'open', updated_at = statement_timestamp()
      RETURNING payload, updated_at
    `));
    if (rows.length !== 1 || !rows[0]) throw new Error("INTAKE_DRAFT_WRITE_INVALID");
    return { code: "OK", data: { updatedAt: new Date(rows[0].updated_at).toISOString() } };
  } catch {
    return { code: "UNAVAILABLE", message: "Der Entwurf konnte nicht sicher gespeichert werden." };
  }
}

export async function readIntakeDraft(auth: AuthorizationSnapshot): Promise<DraftResult<{ payload: Record<string, unknown>; updatedAt: string } | null>> {
  if (!canUseDraft(auth)) return { code: "FORBIDDEN", message: "Entwürfe sind für dieses Profil nicht freigegeben." };
  try {
    const rows = await withPrivilegedTenantTransaction(auth, (tx) => tx.execute<DraftRow>(sql`
      SELECT payload, updated_at
      FROM private.intake_drafts
      WHERE tenant_id = ${auth.tenantId} AND actor_id = ${auth.userId}::uuid AND status = 'open'
      LIMIT 2
    `));
    if (rows.length > 1) throw new Error("INTAKE_DRAFT_AMBIGUOUS");
    const row = rows[0];
    if (!row) return { code: "OK", data: null };
    if (!validPayload(row.payload)) throw new Error("INTAKE_DRAFT_INVALID");
    return { code: "OK", data: { payload: row.payload, updatedAt: new Date(row.updated_at).toISOString() } };
  } catch {
    return { code: "UNAVAILABLE", message: "Der Entwurf konnte nicht sicher gelesen werden." };
  }
}

export async function discardIntakeDraft(auth: AuthorizationSnapshot): Promise<DraftResult<{ discarded: boolean }>> {
  if (!canUseDraft(auth)) return { code: "FORBIDDEN", message: "Entwürfe sind für dieses Profil nicht freigegeben." };
  try {
    const rows = await withPrivilegedTenantTransaction(auth, (tx) => tx.execute<{ id: string }>(sql`
      UPDATE private.intake_drafts
      SET status = 'discarded', updated_at = statement_timestamp()
      WHERE tenant_id = ${auth.tenantId} AND actor_id = ${auth.userId}::uuid AND status = 'open'
      RETURNING id
    `));
    if (rows.length > 1) throw new Error("INTAKE_DRAFT_DISCARD_AMBIGUOUS");
    return { code: "OK", data: { discarded: rows.length === 1 } };
  } catch {
    return { code: "UNAVAILABLE", message: "Der Entwurf konnte nicht sicher verworfen werden." };
  }
}
