import "server-only";
import { createHash } from "node:crypto";
import { sql } from "drizzle-orm";
import { hasAuthorizationArea, resolveAuthorization, type AuthorizationSnapshot } from "@/lib/server/authorization";
import { readIntakeDraftEvent, appendIntakeDraftEvent } from "@/lib/server/intakeDraftEvents";
import { withPrivilegedTenantTransaction, type PrivilegedTenantTransaction } from "@/lib/server/privilegedDb";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
type DraftRow = { id: string; art: "eingang" | "kunde" | null; payload: Record<string, unknown>; zuletzt_feld: string | null; updated_at: string };
function object(value: unknown): value is Record<string, unknown> { return value !== null && typeof value === "object" && !Array.isArray(value); }
async function authorizeDraft(art?: "eingang" | "kunde") {
  const auth=await resolveAuthorization();
  if(!auth.ok)return {code:"UNAUTHENTICATED" as const,message:"Sitzung konnte nicht geprüft werden."};
  if(art ? !hasAuthorizationArea(auth.data,art==="kunde"?"kunden":"eingang")
    : !hasAuthorizationArea(auth.data,"kunden")&&!hasAuthorizationArea(auth.data,"eingang"))
    return {code:"FORBIDDEN" as const,message:"Erfassung ist nicht freigegeben."};
  return auth.data;
}

export async function readIntakeDrafts() {
  const auth = await authorizeDraft();
  if ("code" in auth) return auth;
  try {
    const drafts = await withPrivilegedTenantTransaction(auth, tx => tx.execute<DraftRow>(sql`
      SELECT id::text,art,payload,zuletzt_feld,to_char(updated_at AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"') AS updated_at FROM private.intake_drafts
      WHERE tenant_id=${auth.tenantId} AND actor_id=${auth.userId}::uuid AND status='open'
      ORDER BY updated_at DESC,id`));
    return { code: "OK" as const, drafts };
  } catch (error) {
    console.error("[INTAKE_DRAFT_READ_FAILED]", error);
    return { code: "UNAVAILABLE" as const, message: "Entwürfe konnten nicht geladen werden. Fehlercode: INTAKE_DRAFT_READ_FAILED." };
  }
}

export async function writeIntakeDraft(input: unknown) {
  if (!object(input) || typeof input.id !== "string" || !UUID.test(input.id)
    || typeof input.clientEventId !== "string" || !UUID.test(input.clientEventId)
    || (input.art !== "eingang" && input.art !== "kunde") || !object(input.payload)
    || typeof input.payload.clientKey !== "string" || !UUID.test(input.payload.clientKey)
    || !(input.lastField === null || typeof input.lastField === "string" && /^[a-zA-Z0-9_.:[\]-]{1,160}$/.test(input.lastField))
    || !(input.expectedUpdatedAt === null || typeof input.expectedUpdatedAt === "string" && Number.isFinite(Date.parse(input.expectedUpdatedAt)))) {
    return { code: "VALIDATION_ERROR" as const, message: "Entwurfsdaten sind ungültig." };
  }
  const serialized = JSON.stringify(input.payload);
  if (serialized.length > 250_000) return { code: "VALIDATION_ERROR" as const, message: "Entwurf ist zu groß." };
  const auth = await authorizeDraft(input.art);
  if ("code" in auth) return auth;

  try {
    const result = await withPrivilegedTenantTransaction(auth, tx => writeIntakeDraftInTransaction(tx,auth,input as DraftWriteInput));
    return result ?? await readIntakeDrafts();
  } catch (error) {
    console.error("[INTAKE_DRAFT_WRITE_FAILED]", error);
    return { code: "UNAVAILABLE" as const, message: "Entwurf wurde nicht sicher gespeichert. Alle Eingaben behalten. Fehlercode: INTAKE_DRAFT_WRITE_FAILED." };
  }
}

export async function discardIntakeDraft(input: unknown) {
  if (!object(input) || typeof input.id !== "string" || !UUID.test(input.id)
    || typeof input.clientEventId !== "string" || !UUID.test(input.clientEventId)
    || typeof input.expectedUpdatedAt !== "string" || !Number.isFinite(Date.parse(input.expectedUpdatedAt))) {
    return { code: "VALIDATION_ERROR" as const, message: "Entwurfskennung ist ungültig." };
  }
  const auth = await authorizeDraft();
  if ("code" in auth) return auth;
  try {
    const result = await withPrivilegedTenantTransaction(auth, async tx => {
      await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtextextended('intake-draft:'||${auth.tenantId}||':'||${auth.userId},0))`);
      const prior=await readIntakeDraftEvent(tx,auth,input.clientEventId as string,"INTAKE_DRAFT_DISCARDED_V1");
      if(prior.length)return prior.length===1&&prior[0].payload.draftId===input.id?null:{code:"CONFLICT" as const,message:"Diese Kennung wurde für einen anderen Entwurf verwendet."};
      const deleted = await tx.execute<{ id:string }>(sql`DELETE FROM private.intake_drafts WHERE tenant_id=${auth.tenantId}
        AND actor_id=${auth.userId}::uuid AND id=${input.id}::uuid AND updated_at=${input.expectedUpdatedAt}::timestamptz RETURNING id::text`);
      if(deleted.length!==1)return {code:"CONFLICT" as const,message:"Entwurf wurde inzwischen geändert oder ist nicht mehr vorhanden."};
      await appendIntakeDraftEvent(tx,auth,{kind:"INTAKE_DRAFT_DISCARDED_V1",clientEventId:input.clientEventId as string,draftId:input.id as string});
      return null;
    });
    return result ?? await readIntakeDrafts();
  } catch(error) {
    console.error("[INTAKE_DRAFT_DISCARD_FAILED]",error);
    return {code:"UNAVAILABLE" as const,message:"Entwurf konnte nicht sicher verworfen werden. Fehlercode: INTAKE_DRAFT_DISCARD_FAILED."};
  }
}

export type DraftWriteInput={id:string;clientEventId:string;art:'eingang'|'kunde';payload:Record<string,unknown>;lastField:string|null;expectedUpdatedAt:string|null};
/** The existing X12 writer, also used inside the prospect transaction. */
export async function writeIntakeDraftInTransaction(tx:PrivilegedTenantTransaction,auth:AuthorizationSnapshot,input:DraftWriteInput){
  const serialized=JSON.stringify(input.payload);
  if(serialized.length>250_000)return {code:'VALIDATION_ERROR' as const,message:'Entwurf ist zu groß.'};
  const intent = createHash("sha256").update(JSON.stringify([input.id,input.art,input.payload,input.lastField])).digest("hex");
  await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtextextended('intake-draft:'||${auth.tenantId}||':'||${auth.userId},0))`);
  const prior = await readIntakeDraftEvent(tx,auth,input.clientEventId as string,"INTAKE_DRAFT_SAVED_V1");
  if (prior.length) return prior.length===1 && prior[0].payload.intent===intent ? null : { code: "CONFLICT" as const, message: "Diese Speicherung wurde bereits anders verwendet." };
  const current = await tx.execute<DraftRow>(sql`SELECT id::text,art,payload,zuletzt_feld,to_char(updated_at AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"') AS updated_at FROM private.intake_drafts
    WHERE tenant_id=${auth.tenantId} AND actor_id=${auth.userId}::uuid AND id=${input.id}::uuid FOR UPDATE`);
  // X12 explicitly uses last-save-wins for the same capture, never merging fields.
  if (!current.length && input.expectedUpdatedAt!==null) return {code:"CONFLICT" as const,message:"Dieser Entwurf wurde bereits gebucht oder verworfen."};
  if (current.length) await tx.execute(sql`UPDATE private.intake_drafts SET art=${input.art},payload=${serialized}::jsonb,
    zuletzt_feld=${input.lastField},status='open',updated_at=statement_timestamp()
    WHERE tenant_id=${auth.tenantId} AND actor_id=${auth.userId}::uuid AND id=${input.id}::uuid`);
  else await tx.execute(sql`INSERT INTO private.intake_drafts(id,tenant_id,actor_id,art,payload,zuletzt_feld)
    VALUES(${input.id}::uuid,${auth.tenantId},${auth.userId}::uuid,${input.art},${serialized}::jsonb,${input.lastField})`);
  await appendIntakeDraftEvent(tx,auth,{kind:"INTAKE_DRAFT_SAVED_V1",clientEventId:input.clientEventId as string,draftId:input.id as string,intent});
  return null;
}
