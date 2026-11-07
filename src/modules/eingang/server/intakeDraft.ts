import "server-only";
import { createHash } from "node:crypto";
import { sql } from "drizzle-orm";
import { hasAuthorizationArea, resolveAuthorization, type AuthorizationSnapshot } from "@/lib/server/authorization";
import { readIntakeDraftEvent, appendIntakeDraftEvent } from "@/lib/server/intakeDraftEvents";
import { withPrivilegedTenantTransaction, type PrivilegedTenantTransaction } from "@/lib/server/privilegedDb";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
type DraftRow = { id: string; art: "eingang" | "kunde" | null; payload: Record<string, unknown>; zuletzt_feld: string | null; version: number; updated_at: string };
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
      SELECT id::text,art,payload,zuletzt_feld,version,to_char(updated_at AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"') AS updated_at FROM private.intake_drafts
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
    || !(input.expectedVersion === null || typeof input.expectedVersion === "number" && Number.isSafeInteger(input.expectedVersion) && input.expectedVersion >= 0)) {
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
    || typeof input.expectedVersion !== "number" || !Number.isSafeInteger(input.expectedVersion) || input.expectedVersion < 0) {
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
        AND actor_id=${auth.userId}::uuid AND id=${input.id}::uuid AND version=${input.expectedVersion}::integer RETURNING id::text`);
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

export type DraftWriteInput={id:string;clientEventId:string;art:'eingang'|'kunde';payload:Record<string,unknown>;lastField:string|null;expectedVersion:number|null};
/** The existing X12 writer, also used inside the prospect transaction. */
export async function writeIntakeDraftInTransaction(tx:PrivilegedTenantTransaction,auth:AuthorizationSnapshot,input:DraftWriteInput){
  const serialized=JSON.stringify(input.payload);
  if(serialized.length>250_000)return {code:'VALIDATION_ERROR' as const,message:'Entwurf ist zu groß.'};
  const intent = createHash("sha256").update(JSON.stringify([input.id,input.art,input.payload,input.lastField,input.expectedVersion])).digest("hex");
  await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtextextended('intake-draft:'||${auth.tenantId}||':'||${auth.userId},0))`);
  const prior = await readIntakeDraftEvent(tx,auth,input.clientEventId as string,"INTAKE_DRAFT_SAVED_V1");
  if (prior.length) return prior.length===1 && prior[0].payload.intent===intent ? null : { code: "CONFLICT" as const, message: "Diese Speicherung wurde bereits anders verwendet." };
  const current = await tx.execute<DraftRow>(sql`SELECT id::text,art,payload,zuletzt_feld,version,to_char(updated_at AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"') AS updated_at FROM private.intake_drafts
    WHERE tenant_id=${auth.tenantId} AND actor_id=${auth.userId}::uuid AND id=${input.id}::uuid FOR UPDATE`);
  if (!current.length && input.expectedVersion!==null) return {code:"CONFLICT" as const,message:"Dieser Entwurf wurde bereits gebucht oder verworfen. Eingaben bleiben erhalten."};
  if (current.length && current[0]!.version!==input.expectedVersion) return {code:"CONFLICT" as const,message:"Entwurf wurde inzwischen geändert · Eingaben bleiben erhalten."};
  if (current.length) await tx.execute(sql`UPDATE private.intake_drafts SET art=${input.art},payload=${serialized}::jsonb,
    zuletzt_feld=${input.lastField},status='open',version=version+1,updated_at=statement_timestamp()
    WHERE tenant_id=${auth.tenantId} AND actor_id=${auth.userId}::uuid AND id=${input.id}::uuid`);
  else await tx.execute(sql`INSERT INTO private.intake_drafts(id,tenant_id,actor_id,art,payload,zuletzt_feld)
    VALUES(${input.id}::uuid,${auth.tenantId},${auth.userId}::uuid,${input.art},${serialized}::jsonb,${input.lastField})`);
  await appendIntakeDraftEvent(tx,auth,{kind:"INTAKE_DRAFT_SAVED_V1",clientEventId:input.clientEventId as string,draftId:input.id as string,intent});
  return null;
}

/** P101: create a continuation and its existing draft atomically, without copying an original. */
export async function createIntakeContinuation(input: unknown) {
  if (!object(input) || Object.keys(input).sort().join(",") !== "childId,clientEventId,draftId,fileId,parentId,parentVersion,payload,textSourceId"
    || ![input.childId, input.clientEventId, input.draftId, input.parentId, input.textSourceId].every(value => typeof value === "string" && UUID.test(value))
    || !(input.fileId === null || typeof input.fileId === "string" && UUID.test(input.fileId))
    || !Number.isSafeInteger(input.parentVersion) || (input.parentVersion as number) < 1
    || !object(input.payload) || input.payload.clientKey !== input.childId
    || !Array.isArray(input.payload.items) || input.payload.items.length < 1 || input.payload.items.length > 20
    || !Array.isArray(input.payload.documents) || input.payload.documents.length !== 1 || input.payload.documents[0] !== input.childId
    || typeof input.payload.text !== "string" || JSON.stringify(input.payload).length > 250_000) {
    return { code: "VALIDATION_ERROR" as const, message: "Fortsetzung ist unvollständig oder ungültig." };
  }
  const auth = await authorizeDraft("eingang");
  if ("code" in auth) return auth;
  const value = input as { childId:string; clientEventId:string; draftId:string; fileId:string|null; parentId:string; parentVersion:number; payload:Record<string,unknown>; textSourceId:string };
  const intent = createHash("sha256").update(JSON.stringify(value)).digest("hex");
  try {
    return await withPrivilegedTenantTransaction(auth, async tx => {
      await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtextextended('intake-continuation:'||${auth.tenantId}||':'||${value.childId},0))`);
      const prior = await tx.execute<{ intent:string; draftId:string }>(sql`SELECT nachher->>'intent' AS intent,nachher->>'draftId' AS "draftId" FROM public.intake_event
        WHERE tenant_id=${auth.tenantId} AND item_id=${value.childId}::uuid AND art='angelegt' AND befehl_id=${value.clientEventId}::uuid`);
      if (prior.length) return prior.length === 1 && prior[0]!.intent === intent && prior[0]!.draftId === value.draftId
        ? { code:"OK" as const, childId:value.childId, draftId:value.draftId, replayed:true }
        : { code:"CONFLICT" as const, message:"Diese Fortsetzung wurde bereits anders verwendet." };
      const parents = await tx.execute<{kanal:string; version:number; text:string|null}>(sql`SELECT kanal,version,text FROM public.intake_item
        WHERE tenant_id=${auth.tenantId} AND id=${value.parentId}::uuid FOR UPDATE`);
      const parent = parents[0];
      if (!parent) return { code:"NOT_FOUND" as const, message:"Der ursprüngliche Eingang wurde nicht gefunden." };
      if (parent.kanal === "mail" && !hasAuthorizationArea(auth,"mails")) return { code:"FORBIDDEN" as const, message:"Mail-Inhalte benötigen das Recht Mails." };
      if (parent.version !== value.parentVersion) return { code:"CONFLICT" as const, message:"Das Original wurde geändert · bitte erneut laden." };
      const siblings=await tx.execute(sql`SELECT id FROM public.intake_item WHERE tenant_id=${auth.tenantId} AND fortsetzung_von=${value.parentId}::uuid LIMIT 1`);
      if(siblings.length)return {code:"CONFLICT" as const,message:"Eine Fortsetzung ist bereits vorhanden · ursprünglichen Eingang erneut öffnen."};
      const textSources = await tx.execute<{kanal:string; text:string|null}>(sql`SELECT kanal,text FROM public.intake_item
        WHERE tenant_id=${auth.tenantId} AND id=${value.textSourceId}::uuid FOR SHARE`);
      const textSource = textSources[0];
      if (!textSource || textSource.text !== value.payload.text) return { code:"CONFLICT" as const, message:"Der Originaltext wurde geändert · bitte erneut laden." };
      if (textSource.kanal === "mail" && !hasAuthorizationArea(auth,"mails")) return { code:"FORBIDDEN" as const, message:"Mail-Inhalte benötigen das Recht Mails." };
      const files = await tx.execute<{id:string;secured:boolean}>(sql`SELECT file.id::text,EXISTS(
        SELECT 1 FROM public.intake_event original WHERE original.tenant_id=file.tenant_id AND original.item_id=file.item_id
          AND original.art='original_gespeichert' AND original.nachher->>'fileId'=file.id::text) AS secured
        FROM public.intake_file file WHERE file.tenant_id=${auth.tenantId} AND file.item_id=${value.parentId}::uuid ORDER BY file.reihenfolge,file.id`);
      if(files.some(file=>!file.secured))return {code:"CONFLICT" as const,message:"Ein Original ist noch nicht sicher gespeichert · bitte erneut versuchen."};
      if(files.length && !value.fileId || value.fileId && !files.some(file=>file.id===value.fileId))
        return {code:"VALIDATION_ERROR" as const,message:"Das Original gehört nicht zum ursprünglichen Eingang."};
      const event = await tx.execute<{id:string}>(sql`SELECT id::text FROM public.intake_event WHERE tenant_id=${auth.tenantId}
        AND item_id=${value.textSourceId}::uuid AND art='original_gespeichert' AND nachher->>'text'=${textSource.text}
        ORDER BY zeit DESC,id DESC LIMIT 1`);
      if (!event.length) return { code:"CONFLICT" as const, message:"Der unveränderte Originaltext ist nicht nachgewiesen." };
      const existing = await tx.execute(sql`SELECT id FROM public.intake_item WHERE tenant_id=${auth.tenantId} AND (id=${value.childId}::uuid OR client_key=${value.childId})`);
      if (existing.length) return { code:"CONFLICT" as const, message:"Die Eingangskennung wird bereits verwendet." };
      const draftResult = await writeIntakeDraftInTransaction(tx,auth,{id:value.draftId,clientEventId:value.clientEventId,art:"eingang",payload:value.payload,lastField:null,expectedVersion:null});
      if (draftResult) return draftResult;
      await tx.execute(sql`INSERT INTO public.intake_item(id,tenant_id,client_key,kanal,richtung,quelle,erstellt_von,fortsetzung_von,file_id)
        VALUES(${value.childId}::uuid,${auth.tenantId},${value.childId},${parent.kanal === "mail" || textSource.kanal === "mail" ? "mail" : parent.kanal},'intern','app',${auth.userId}::uuid,${value.parentId}::uuid,${value.fileId}::uuid)`);
      await tx.execute(sql`INSERT INTO public.intake_event(tenant_id,item_id,art,befehl_id,von,nachher)
        VALUES(${auth.tenantId},${value.childId}::uuid,'angelegt',${value.clientEventId}::uuid,${auth.userId},${JSON.stringify({fortsetzungVon:value.parentId,fileId:value.fileId,draftId:value.draftId,textSourceId:value.textSourceId,originalTextEventId:event[0]!.id,originalFileIds:files.map(file=>file.id),intent})}::jsonb)`);
      return { code:"OK" as const, childId:value.childId, draftId:value.draftId, replayed:false };
    });
  } catch (error) {
    console.error("[INTAKE_CONTINUATION_CREATE_FAILED]",error);
    return { code:"UNAVAILABLE" as const, message:"Fortsetzung nicht sicher gespeichert · Original und Eingaben bleiben erhalten. Code: INTAKE_CONTINUATION_CREATE_FAILED." };
  }
}
