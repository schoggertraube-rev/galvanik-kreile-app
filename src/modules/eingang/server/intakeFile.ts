import "server-only";
import { createHash } from "node:crypto";
import { sql } from "drizzle-orm";
import { withPrivilegedTenantTransaction } from "@/lib/server/privilegedDb";
import { createAdminClient } from "@/lib/supabase/admin";
import {hasAuthorizationArea,resolveAuthorization} from "@/lib/server/authorization";
import { analyzeWithAzureDocumentIntelligence } from "@/lib/server/azureDocumentIntelligence";
import {recognizeInvoiceFields,recognizeInvoiceXml} from './invoiceRecognition';
import type { IntakeCaptureResult, IntakeFileInput, IntakeFileGrant } from "../captureContract";
import { intakeCaptureSnapshot } from "./intakeCapture";
import { captureRecognition } from "../captureRecognition";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const BUCKET = "scans";
type Failure = Exclude<IntakeCaptureResult, { code: "OK" }>;
type FileRow = { id: string; item_id: string; dateiname: string; mime: string; bytes: string; sha256: string; speicherpfad: string; erkennung_status: string; aufgenommen_auf: string | null; aufnahme_herkunft: "warenfoto" | "dokument" };
async function fileAuthorization(){const result=await resolveAuthorization();if(!result.ok)return {code:'UNAUTHENTICATED' as const,message:'Sitzung ist nicht verfügbar.'};if(!hasAuthorizationArea(result.data,'eingang')&&!hasAuthorizationArea(result.data,'geld'))return {code:'FORBIDDEN' as const,message:'Originale benötigen Eingang oder einen Rechnungsbezug mit Geld.'};return result.data;}
function recognitionClaimKey(attempt:string){const bytes=createHash('sha1').update('intake-recognition-start-v1:'+attempt).digest();bytes[6]=(bytes[6]&15)|80;bytes[8]=(bytes[8]&63)|128;const hex=bytes.subarray(0,16).toString('hex');return `${hex.slice(0,8)}-${hex.slice(8,12)}-${hex.slice(12,16)}-${hex.slice(16,20)}-${hex.slice(20)}`;}
function inputFile(value: unknown): value is IntakeFileInput {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return false;
  const item = value as Record<string, unknown>;
  return Object.keys(item).every(key => ["itemId", "fileId", "name", "mime", "bytes", "sha256", "deviceId", "captureOrigin"].includes(key))
    && typeof item.itemId === "string" && UUID.test(item.itemId) && typeof item.fileId === "string" && UUID.test(item.fileId)
    && typeof item.name === "string" && item.name.trim().length > 0 && item.name.length <= 255 && !/[\u0000-\u001f]/.test(item.name)
    && typeof item.mime === "string" && /^[a-z0-9.+-]+\/[a-z0-9.+-]+$/i.test(item.mime) && item.mime.length <= 128
    && typeof item.bytes === "number" && Number.isSafeInteger(item.bytes) && item.bytes > 0 && item.bytes <= 150 * 1024 * 1024
    && typeof item.sha256 === "string" && /^[0-9a-f]{64}$/.test(item.sha256)
    && (item.deviceId === undefined || typeof item.deviceId === "string" && UUID.test(item.deviceId))
    && (item.captureOrigin === undefined || item.captureOrigin === "warenfoto" || item.captureOrigin === "dokument");
}
export async function prepareIntakeFile(input: unknown, ensureOriginal=false): Promise<IntakeFileGrant | Failure> {
  if (!inputFile(input)) return { code: "VALIDATION_ERROR", message: "Datei benötigt Name, Typ, SHA-256 und 1 bis 150 MB Inhalt." };
  const auth = await fileAuthorization();
  if ("code" in auth) return auth as Failure;
  if((input.mime==='message/rfc822'||input.name.toLowerCase().endsWith('.eml'))&&!hasAuthorizationArea(auth,'mails'))return {code:'FORBIDDEN',message:'Mail-Originale erfordern zusätzlich das Recht Mails.'};
  try {
    const pending = await withPrivilegedTenantTransaction(auth, async tx => {
      await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtextextended('intake:'||${auth.tenantId}||':'||${input.itemId},0))`);
      const items = await tx.execute<{ id: string;kanal:string;invoice_context:boolean }>(sql`SELECT id::text,kanal,(anliegen @> ARRAY['rechnung']::text[] OR vorgang_art='rechnung') AS invoice_context FROM public.intake_item WHERE tenant_id=${auth.tenantId} AND id=${input.itemId}::uuid FOR UPDATE`);
      const invoiceAccess=hasAuthorizationArea(auth,'geld')&&items[0]?.invoice_context===true&&input.mime!=='message/rfc822'&&!input.name.toLowerCase().endsWith('.eml');
      if(!hasAuthorizationArea(auth,'eingang')&&!invoiceAccess)return {code:'FORBIDDEN' as const,message:'Geld erlaubt Dateien ausschließlich am vorhandenen Rechnungseingang.'};
      if(items[0]?.kanal==='mail'&&!hasAuthorizationArea(auth,'mails')&&!invoiceAccess)return {code:'FORBIDDEN' as const,message:'Mail-Originale erfordern zusätzlich das Recht Mails.'};
      if (!items.length) {
        await tx.execute(sql`INSERT INTO public.intake_item(id,tenant_id,client_key,kanal,richtung,quelle,erstellt_von) VALUES
          (${input.itemId}::uuid,${auth.tenantId},${input.itemId},${input.mime.startsWith("image/") ? "foto" : "datei"},'rein','geraet',${auth.userId}::uuid)`);
        await tx.execute(sql`INSERT INTO public.intake_event(tenant_id,item_id,art,befehl_id,von,nachher) VALUES
          (${auth.tenantId},${input.itemId}::uuid,'angelegt',${input.itemId}::uuid,${auth.userId},${JSON.stringify({ kanal: input.mime.startsWith("image/") ? "foto" : "datei" })}::jsonb)`);
      }
      await tx.execute(sql`INSERT INTO public.intake_file(id,tenant_id,item_id,client_key,art,dateiname,mime,bytes,sha256,speicherpfad,aufgenommen_am,aufgenommen_von,aufgenommen_auf,reihenfolge,lesbar,erkennung_status,geoeffnet,aufnahme_herkunft)
        SELECT ${input.fileId}::uuid,${auth.tenantId},${input.itemId}::uuid,${input.fileId},${input.mime === "message/rfc822" ? "mime" : input.mime.startsWith("image/") ? "foto" : input.mime === "application/pdf" ? "pdf" : input.mime.includes("xml") ? "xml" : "anhang"},
          ${input.name},${input.mime},${input.bytes},${input.sha256},${auth.tenantId + "/" + input.sha256},statement_timestamp(),${auth.userId}::uuid,${input.deviceId ?? null},
          coalesce(max(reihenfolge),0)+1,false,'wartet',false,${input.captureOrigin ?? "dokument"} FROM public.intake_file WHERE tenant_id=${auth.tenantId} AND item_id=${input.itemId}::uuid
        ON CONFLICT (tenant_id,client_key) DO NOTHING`);
      const files = await tx.execute<FileRow>(sql`SELECT id::text,item_id::text,dateiname,mime,bytes::text,sha256,speicherpfad,erkennung_status,aufgenommen_auf,aufnahme_herkunft FROM public.intake_file
        WHERE tenant_id=${auth.tenantId} AND client_key=${input.fileId}`);
      const row = files[0];
      if (files.length !== 1 || row.item_id !== input.itemId || row.dateiname !== input.name || row.mime !== input.mime || Number(row.bytes) !== input.bytes || row.sha256 !== input.sha256 || row.aufgenommen_auf !== (input.deviceId ?? null) || row.aufnahme_herkunft !== (input.captureOrigin ?? "dokument")) throw new Error("INTAKE_FILE_CLIENT_KEY_CONFLICT");
      return row;
    });
    if('code' in pending)return pending;
    if (!ensureOriginal && ["fertig", "fehler"].includes(pending.erkennung_status)) return { code: "OK", upload: null };
    const existing = await createAdminClient().storage.from(BUCKET).info(pending.speicherpfad);
    if (!existing.error && existing.data) return { code: "OK", upload: null };
    const grant = await createAdminClient().storage.from(BUCKET).createSignedUploadUrl(pending.speicherpfad, { upsert: false });
    if (grant.error || !grant.data || grant.data.path !== pending.speicherpfad) throw new Error("INTAKE_FILE_UPLOAD_GRANT_UNAVAILABLE");
    return { code: "OK", upload: { bucket: BUCKET, path: grant.data.path, token: grant.data.token, url: grant.data.signedUrl } };
  } catch (error) {
    console.error("[INTAKE_FILE_PREPARE_FAILED]", { message: error instanceof Error ? error.message : "UnknownError" });
    return { code: "UNAVAILABLE", message: "Datei ist noch nicht vollständig gesichert. Eingaben bleiben erhalten. Fehlercode: INTAKE_FILE_PREPARE_FAILED." };
  }
}
export async function finishIntakeFile(fileId: string, retryKey?: string, originalOnly=false): Promise<IntakeCaptureResult> {
  if (!UUID.test(fileId)) return { code: "VALIDATION_ERROR", message: "Ungültige Dateikennung." };
  const auth = await fileAuthorization();
  if ("code" in auth) return auth;
  const claimKey=recognitionClaimKey(retryKey??fileId);let claimOwned=false;
  try {
    const files = await withPrivilegedTenantTransaction(auth, tx => tx.execute<FileRow&{kanal:string;invoice_context:boolean}>(sql`SELECT file.id::text,file.item_id::text,file.dateiname,file.mime,file.bytes::text,file.sha256,file.speicherpfad,file.erkennung_status,file.aufgenommen_auf,file.aufnahme_herkunft,source.kanal,(source.anliegen @> ARRAY['rechnung']::text[] OR source.vorgang_art='rechnung') AS invoice_context FROM public.intake_file file JOIN public.intake_item source ON source.tenant_id=file.tenant_id AND source.id=file.item_id WHERE file.tenant_id=${auth.tenantId} AND file.id=${fileId}::uuid`));
    if (files.length !== 1) return { code: "NOT_FOUND", message: "Datei wurde nicht gefunden." };
    const file = files[0];
    const mailOriginal=file.mime==='message/rfc822'||file.dateiname.toLowerCase().endsWith('.eml'),invoiceAccess=hasAuthorizationArea(auth,'geld')&&file.invoice_context===true&&!mailOriginal;
    if(!hasAuthorizationArea(auth,'eingang')&&!invoiceAccess)return {code:'FORBIDDEN',message:'Geld erlaubt Dateien ausschließlich am vorhandenen Rechnungseingang.'};
    if((file.kanal==='mail'&&!invoiceAccess||mailOriginal)&&!hasAuthorizationArea(auth,'mails'))return {code:'FORBIDDEN',message:'Mail-Originale erfordern zusätzlich das Recht Mails.'};
    const snapshot=()=>intakeCaptureSnapshot(auth,file.item_id,undefined,invoiceAccess&&(!hasAuthorizationArea(auth,'eingang')||file.kanal==='mail'&&!hasAuthorizationArea(auth,'mails')));
    if(retryKey){
      const retry=await withPrivilegedTenantTransaction(auth,async tx=>{
        await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtextextended('intake-file:'||${auth.tenantId}||':'||${fileId},0))`);
        const prior=await tx.execute(sql`SELECT id FROM public.intake_event WHERE tenant_id=${auth.tenantId} AND item_id=${file.item_id}::uuid AND art='erkannt' AND befehl_id=${retryKey}::uuid`);
        if(prior.length)return false;
        const rows=await tx.execute(sql`UPDATE public.intake_file file SET erkennung_status='wartet' WHERE tenant_id=${auth.tenantId} AND id=${fileId}::uuid AND
          (erkennung_status IN ('fehler','fertig') OR erkennung_status='laeuft' AND
            coalesce((SELECT max(event.zeit) FROM public.intake_event event WHERE event.tenant_id=file.tenant_id AND event.item_id=file.item_id AND event.nachher->>'fileId'=file.id::text
              AND (event.art='original_gespeichert' OR event.art='einsatz' AND event.nachher->>'action'='erkennung_gestartet')),file.aufgenommen_am)<statement_timestamp()-interval '2 minutes') RETURNING id`);
        return rows.length===1;
      });
      if(!retry)return snapshot();
      file.erkennung_status='wartet';
    }
    if (!originalOnly && ["fertig", "fehler"].includes(file.erkennung_status)) return snapshot();
    const stored = await createAdminClient().storage.from(BUCKET).download(file.speicherpfad);
    if (stored.error || !stored.data) throw new Error("INTAKE_FILE_UPLOAD_INCOMPLETE");
    const bytes = new Uint8Array(await stored.data.arrayBuffer());
    if (bytes.byteLength !== Number(file.bytes) || createHash("sha256").update(bytes).digest("hex") !== file.sha256) throw new Error("INTAKE_FILE_ORIGINAL_HASH_MISMATCH");
    if(originalOnly){
      await withPrivilegedTenantTransaction(auth,async tx=>{
        await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtextextended('intake-file:'||${auth.tenantId}||':'||${fileId},0))`);
        await tx.execute(sql`INSERT INTO public.intake_event(tenant_id,item_id,art,befehl_id,von,nachher)
        SELECT ${auth.tenantId},${file.item_id}::uuid,'original_gespeichert',${fileId}::uuid,${auth.userId},${JSON.stringify({fileId,sha256:file.sha256,bytes:bytes.byteLength})}::jsonb
        WHERE NOT EXISTS(SELECT 1 FROM public.intake_event WHERE tenant_id=${auth.tenantId} AND item_id=${file.item_id}::uuid AND art='original_gespeichert' AND befehl_id=${fileId}::uuid)`);
        // As with a goods photo, completion records secured bytes, not an OCR success.
        await tx.execute(sql`UPDATE public.intake_file SET erkennung_status='fertig',lesbar=false WHERE tenant_id=${auth.tenantId} AND id=${fileId}::uuid AND erkennung_status IN ('wartet','fehler')`);
      });
      return snapshot();
    }
    // The original is secured before recognition. A provider failure cannot undo this event.
    const claimed = await withPrivilegedTenantTransaction(auth, async tx => {
      await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtextextended('intake-file:'||${auth.tenantId}||':'||${fileId},0))`);
      await tx.execute(sql`INSERT INTO public.intake_event(tenant_id,item_id,art,befehl_id,von,nachher)
        SELECT ${auth.tenantId},${file.item_id}::uuid,'original_gespeichert',${fileId}::uuid,${auth.userId},${JSON.stringify({ fileId, sha256: file.sha256, bytes: bytes.byteLength })}::jsonb
        WHERE NOT EXISTS(SELECT 1 FROM public.intake_event WHERE tenant_id=${auth.tenantId} AND item_id=${file.item_id}::uuid AND art='original_gespeichert' AND befehl_id=${fileId}::uuid)`);
      if (file.aufgenommen_auf) await tx.execute(sql`UPDATE public.device_request SET status='fotos_da'
        WHERE tenant_id=${auth.tenantId} AND login_id=${auth.userId}::uuid AND item_id=${file.item_id}::uuid
          AND status='angenommen' AND angenommen_auf @> ARRAY[${file.aufgenommen_auf}]::text[]`);
      const updated = await tx.execute<{ id: string }>(sql`UPDATE public.intake_file SET erkennung_status='laeuft' WHERE tenant_id=${auth.tenantId} AND id=${fileId}::uuid AND erkennung_status='wartet' RETURNING id::text`);
      if(updated.length===1&&file.aufnahme_herkunft!=="warenfoto")await tx.execute(sql`INSERT INTO public.intake_event(tenant_id,item_id,art,befehl_id,von,nachher)
        VALUES(${auth.tenantId},${file.item_id}::uuid,'einsatz',${claimKey}::uuid,${auth.userId},${JSON.stringify({action:'erkennung_gestartet',fileId,attemptKey:retryKey??fileId})}::jsonb) ON CONFLICT DO NOTHING`);
      return updated.length === 1;
    });
    if (!claimed) return snapshot();
    if (file.aufnahme_herkunft === "warenfoto") {
      await withPrivilegedTenantTransaction(auth, tx => tx.execute(sql`UPDATE public.intake_file SET lesbar=false,erkennung_status='fertig'
        WHERE tenant_id=${auth.tenantId} AND id=${fileId}::uuid AND erkennung_status='laeuft'`));
      return snapshot();
    }
    claimOwned=true;
// Structured XML uses the existing parser; images and PDF use the existing OCR adapter.
    const prefix=Buffer.from(bytes.subarray(0,512)).toString('utf8').replace(/^\uFEFF/u,'').trimStart();
    const isXml=/xml(?:$|[;+])/iu.test(file.mime)||/\.xml$/iu.test(file.dateiname)||prefix.startsWith('<');
    const xmlResult=isXml?recognizeInvoiceXml(bytes):null;
    const canRead = isXml ? xmlResult?.code==='OK' : bytes.byteLength <= 20 * 1024 * 1024 && ["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif", "application/pdf"].includes(file.mime);
    const deadline = AbortSignal.timeout(30_000);
    const recognized = !isXml && canRead ? await analyzeWithAzureDocumentIntelligence(bytes, file.mime, process.env,
      (url, options) => fetch(url, { ...options, signal: AbortSignal.any([deadline, AbortSignal.timeout(12_000)]) })) : null;
    if (recognized && recognized.code !== "OK") console.error("[INTAKE_FILE_RECOGNITION_UNAVAILABLE]", { fileId, code: recognized.code });
    const kind = xmlResult?.code === "OK" ? "rechnung" : recognized?.code === "OK" ? captureRecognition({ text: null, suggestions: recognized.data.suggestions }).kind : null;
    await withPrivilegedTenantTransaction(auth, async tx => {
      await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtextextended('intake-file:'||${auth.tenantId}||':'||${fileId},0))`);
      const active=await tx.execute<{befehl_id:string}>(sql`SELECT befehl_id::text FROM public.intake_event WHERE tenant_id=${auth.tenantId} AND item_id=${file.item_id}::uuid
        AND art='einsatz' AND nachher->>'action'='erkennung_gestartet' AND nachher->>'fileId'=${fileId} ORDER BY zeit DESC,id DESC LIMIT 1`);
      if(active[0]?.befehl_id!==claimKey){console.info('[INTAKE_RECOGNITION_SUPERSEDED]',{fileId});return;}
      const successful=recognized?.code==='OK'||xmlResult?.code==='OK';
      await tx.execute(sql`UPDATE public.intake_file SET lesbar=${canRead},erkennung_status=${successful ? "fertig" : "fehler"}
        WHERE tenant_id=${auth.tenantId} AND id=${fileId}::uuid`);
      if(successful)await tx.execute(sql`UPDATE public.intake_suggestion SET status='verworfen' WHERE tenant_id=${auth.tenantId} AND file_id=${fileId}::uuid AND status='offen' AND geprueft_am IS NULL`);
      const suggestions=xmlResult?.code==='OK'?xmlResult.suggestions:recognized?.code==='OK'?[...recognized.data.suggestions,...recognizeInvoiceFields(recognized.data.suggestions)]:[];
      for (const suggestion of suggestions) {
        await tx.execute(sql`INSERT INTO public.intake_suggestion(tenant_id,item_id,file_id,feld,wert,sicherheit,regel,grund,fundstelle,status)
            SELECT ${auth.tenantId},${file.item_id}::uuid,${fileId}::uuid,${suggestion.field},${JSON.stringify(suggestion.value)}::jsonb,${suggestion.field.startsWith('rechnung.')?(suggestion.confidence>=0.9?'sicher':'unsicher'):'vorschlag'},'datei',${isXml?'Strukturiertes XML':'Dokumenterkennung'},${JSON.stringify(suggestion.source)}::jsonb,'offen'
          WHERE NOT EXISTS(SELECT 1 FROM public.intake_suggestion WHERE tenant_id=${auth.tenantId} AND file_id=${fileId}::uuid AND feld=${suggestion.field} AND geprueft_am IS NOT NULL AND status<>'verworfen')`);
      }
      if (kind === "rechnung") await tx.execute(sql`UPDATE public.intake_item
        SET anliegen=array_append(anliegen,'rechnung'), anliegen_offen=CASE WHEN 'rechnung'=ANY(anliegen_offen) THEN anliegen_offen ELSE array_append(anliegen_offen,'rechnung') END,
          version=version+1, geaendert_von=${auth.userId}::uuid, geaendert_am=statement_timestamp(), updated_at=statement_timestamp()
        WHERE tenant_id=${auth.tenantId} AND id=${file.item_id}::uuid AND NOT ('rechnung'=ANY(anliegen))`);
      await tx.execute(sql`INSERT INTO public.intake_event(tenant_id,item_id,art,befehl_id,von,nachher)
        SELECT ${auth.tenantId},${file.item_id}::uuid,'erkannt',${retryKey??fileId}::uuid,${auth.userId},${JSON.stringify({ fileId, kind, code: xmlResult?.code==='OK'?'OK':isXml?'UNSUPPORTED_XML':recognized?.code ?? (bytes.byteLength>20*1024*1024?"INTAKE_RECOGNITION_TOO_LARGE":"UNSUPPORTED_DOCUMENT_TYPE") })}::jsonb
        WHERE NOT EXISTS(SELECT 1 FROM public.intake_event WHERE tenant_id=${auth.tenantId} AND item_id=${file.item_id}::uuid AND art='erkannt' AND befehl_id=${retryKey??fileId}::uuid)`);
    });
    return snapshot();
  } catch (error) {
    console.error("[INTAKE_FILE_FINISH_FAILED]", { message: error instanceof Error ? error.message : "UnknownError", fileId });
    try {
      await withPrivilegedTenantTransaction(auth,async tx=>{
        await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtextextended('intake-file:'||${auth.tenantId}||':'||${fileId},0))`);
        const changed=await tx.execute(sql`UPDATE public.intake_file file SET erkennung_status='fehler' WHERE tenant_id=${auth.tenantId} AND id=${fileId}::uuid
          AND (erkennung_status='wartet' OR erkennung_status='laeuft' AND ${claimOwned} AND (SELECT event.befehl_id FROM public.intake_event event
            WHERE event.tenant_id=file.tenant_id AND event.item_id=file.item_id AND event.art='einsatz' AND event.nachher->>'action'='erkennung_gestartet' AND event.nachher->>'fileId'=file.id::text ORDER BY event.zeit DESC,event.id DESC LIMIT 1)=${claimKey}::uuid) RETURNING id`);
        if(changed.length)await tx.execute(sql`INSERT INTO public.intake_event(tenant_id,item_id,art,befehl_id,von,nachher)
          SELECT ${auth.tenantId},item_id,'erkannt',${retryKey??fileId}::uuid,${auth.userId},${JSON.stringify({fileId,code:"INTAKE_FILE_FINISH_FAILED"})}::jsonb
          FROM public.intake_file WHERE tenant_id=${auth.tenantId} AND id=${fileId}::uuid
          ON CONFLICT DO NOTHING`);
      });
    } catch(recordError){console.error("[INTAKE_FILE_FAILURE_RECORD_FAILED]",recordError);}
    return { code: "UNAVAILABLE", message: "Datei konnte nicht vollständig geprüft werden. Erneut versuchen; die Kennung bleibt gleich. Fehlercode: INTAKE_FILE_FINISH_FAILED." };
  }
}

export async function retryIntakeRecognition(input:unknown):Promise<IntakeCaptureResult>{
  if(!input||typeof input!=="object"||Array.isArray(input))return {code:"VALIDATION_ERROR",message:"Ungültiger Erkennungsversuch."};
  const value=input as Record<string,unknown>;
  if(Object.keys(value).sort().join(",")!=="clientEventId,fileId"||typeof value.fileId!=="string"||!UUID.test(value.fileId)
    ||typeof value.clientEventId!=="string"||!UUID.test(value.clientEventId))return {code:"VALIDATION_ERROR",message:"Ungültiger Erkennungsversuch."};
  return finishIntakeFile(value.fileId,value.clientEventId);
}
