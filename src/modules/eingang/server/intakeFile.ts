import "server-only";
import {FINANCIAL_ACCESS_COPY} from '@/ui/financialAccessCopy';
import {INTAKE_FILE_CONTEXT_COPY} from '@/ui/eingangCopy';
import {intakeFileContextEvidence,intakeFileHandoffEvidence,isOrderStationPhoto,readHandoffIntakePhotoTarget} from '@/lib/server/orderStationAttachment';
import {recordObservedFailure} from '@/lib/server/actionObservation';
import {offlineOccurrenceTime} from '@/lib/domain/offlineOriginal';
import { createHash } from "node:crypto";
import { isDeepStrictEqual } from 'node:util';
import { sql } from "drizzle-orm";
import { withPrivilegedTenantTransaction, withTenantSavepoint } from "@/lib/server/privilegedDb";
import { createAdminClient } from "@/lib/supabase/admin";
import {hasAuthorizationArea,resolveAuthorization,type AuthorizationSnapshot} from "@/lib/server/authorization";
import type { IntakeCaptureResult, IntakeFileInput, IntakeFileGrant } from "../captureContract";
import { intakeCaptureSnapshot,validIntakeOriginalTakeover } from "./intakeCapture";
import {isIntakeFileContext,isIntakeOriginalTakeover} from '../captureContract';
import {mayCaptureContextFile,qualifyIntakeFileContext,
  type IntakeFileCustomerReader,type StoredIntakeFileContext} from './intakeFileContext';

import { erkenneOriginal, recordIntakeRecognitionFailure, type ReadRecognitionSettings } from "./erkennung";
import type { KandidatenPorts } from "./kandidaten";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const BUCKET = "scans";
type Failure = Exclude<IntakeCaptureResult, { code: "OK" }>;
type FinishedFile = Failure | (Extract<IntakeCaptureResult,{code:'OK'}>&{kontextSichtbarkeit?:boolean});
const {contextMismatch,contextForbidden}=INTAKE_FILE_CONTEXT_COPY;
class StationContextRejected extends Error {constructor(readonly failure:Failure){super(failure.code);}}
type FileRow = { id: string; item_id: string; dateiname: string; mime: string; bytes: string; sha256: string; speicherpfad: string; erkennung_status: string; aufgenommen_auf: string | null; aufnahme_herkunft: "warenfoto" | "dokument"; aufgenommen_von:string; reihenfolge:number };
type IntakeFileCompletion = { retryKey?: string; readSettings: ReadRecognitionSettings;
  scheduleRecognition?: (work: () => Promise<void>) => void; importingMail?: true;
  secureOnly?: true; authorization?: AuthorizationSnapshot; kandidaten?: KandidatenPorts };
async function fileAuthorization(takeover=false){const result=await resolveAuthorization();if(!result.ok)return {code:'UNAUTHENTICATED' as const,message:'Sitzung ist nicht verfügbar.'};if(!hasAuthorizationArea(result.data,'eingang')&&(takeover||!hasAuthorizationArea(result.data,'buchhaltung')&&!mayCaptureContextFile(result.data)))return {code:'FORBIDDEN' as const,message:FINANCIAL_ACCESS_COPY.bookkeepingMissing};return result.data;}
function inputFile(value: unknown): value is IntakeFileInput {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return false;
  const item = value as Record<string, unknown>;
  return Object.keys(item).every(key => ["itemId", "fileId", "name", "mime", "bytes", "sha256", "deviceId", "captureOrigin", "deviceCapturedAt", "takeover","kontext"].includes(key))
    && (item.kontext===undefined||isIntakeFileContext(item.kontext))
    && (item.takeover===undefined||item.kontext===undefined&&validIntakeOriginalTakeover(item.takeover)&&item.takeover.deviceId===item.deviceId&&item.deviceCapturedAt!==undefined)
    && typeof item.itemId === "string" && UUID.test(item.itemId) && typeof item.fileId === "string" && UUID.test(item.fileId)
    && typeof item.name === "string" && item.name.trim().length > 0 && item.name.length <= 255 && !/[\u0000-\u001f]/.test(item.name)
    && typeof item.mime === "string" && /^[a-z0-9.+-]+\/[a-z0-9.+-]+$/i.test(item.mime) && item.mime.length <= 128
    && typeof item.bytes === "number" && Number.isSafeInteger(item.bytes) && item.bytes > 0 && item.bytes <= 150 * 1024 * 1024
    && typeof item.sha256 === "string" && /^[0-9a-f]{64}$/.test(item.sha256)
    && (item.deviceCapturedAt===undefined||typeof item.deviceCapturedAt==="string"&&/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(item.deviceCapturedAt)&&Number.isFinite(Date.parse(item.deviceCapturedAt))&&new Date(item.deviceCapturedAt).toISOString()===item.deviceCapturedAt)
    && (item.deviceId === undefined || typeof item.deviceId === "string" && UUID.test(item.deviceId))
    && (item.captureOrigin === undefined || item.captureOrigin === "warenfoto" || item.captureOrigin === "dokument");
}
export async function prepareIntakeFile(input: unknown, ensureOriginal=false, readCustomer?:IntakeFileCustomerReader): Promise<IntakeFileGrant | Failure> {
  if (!inputFile(input)) return { code: "VALIDATION_ERROR", message: "Datei benötigt Name, Typ, SHA-256 und 1 bis 150 MB Inhalt." };
  if(input.kontext?.uebergabeVersion!==undefined&&!isOrderStationPhoto(input.mime,input.bytes))
    return {code:'VALIDATION_ERROR',message:INTAKE_FILE_CONTEXT_COPY.stationPhoto};
  const auth = await fileAuthorization(input.takeover!==undefined);
  if ("code" in auth) return auth as Failure;
  if(input.kontext&&!mayCaptureContextFile(auth,input.kontext))return {code:'FORBIDDEN',message:contextForbidden};
  if((input.mime==='message/rfc822'||input.name.toLowerCase().endsWith('.eml'))&&!hasAuthorizationArea(auth,'mails'))return {code:'FORBIDDEN',message:'Mail-Originale erfordern zusätzlich das Recht Mails.'};
  try {
    const pending = await withPrivilegedTenantTransaction(auth, async tx => {
      const kontext=input.kontext?await qualifyIntakeFileContext(tx,auth,input.kontext,readCustomer):null;
      if(input.kontext&&!kontext)return {code:'FORBIDDEN' as const,message:contextMismatch};
      await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtextextended('intake:'||${auth.tenantId}||':'||${input.itemId},0))`);
      const items = await tx.execute<{ id: string;kanal:string;invoice_context:boolean;kunde_id:string|null;vorgang_id:string|null;vorgang_art:string|null;zuordnung_regel:string|null }>(sql`SELECT id::text,kanal,kunde_id,vorgang_id,vorgang_art,zuordnung_regel,(anliegen @> ARRAY['rechnung']::text[] OR vorgang_art='rechnung') AS invoice_context FROM public.intake_item WHERE tenant_id=${auth.tenantId} AND id=${input.itemId}::uuid FOR UPDATE`);
      const invoiceAccess=hasAuthorizationArea(auth,'buchhaltung')&&items[0]?.invoice_context===true&&input.mime!=='message/rfc822'&&!input.name.toLowerCase().endsWith('.eml');
      if(!kontext&&!hasAuthorizationArea(auth,'eingang')&&!invoiceAccess)return {code:'FORBIDDEN' as const,message:FINANCIAL_ACCESS_COPY.bookkeepingMissing};
      if(items[0]?.kanal==='mail'&&!hasAuthorizationArea(auth,'mails')&&!invoiceAccess)return {code:'FORBIDDEN' as const,message:'Mail-Originale erfordern zusätzlich das Recht Mails.'};
      const stand=items[0];
      if(stand&&(kontext?stand.zuordnung_regel!=='kontext'||stand.kunde_id!==kontext.kundeId||
        stand.vorgang_id!==(kontext.auftragId??null)||stand.vorgang_art!==(kontext.auftragId?'auftrag':null):stand.zuordnung_regel==='kontext'))
        return {code:'CONFLICT' as const,message:contextMismatch};
      if (!items.length) {
        await tx.execute(sql`INSERT INTO public.intake_item(id,tenant_id,client_key,kanal,richtung,quelle,erstellt_von,wartet_seit,
            kunde_id,vorgang_art,vorgang_id,zuordnung,zuordnung_regel) VALUES
          (${input.itemId}::uuid,${auth.tenantId},${input.itemId},${input.mime.startsWith("image/") ? "foto" : "datei"},'rein','geraet',${auth.userId}::uuid,statement_timestamp(),
           ${kontext?.kundeId??null},${kontext?.auftragId?'auftrag':null},${kontext?.auftragId??null},${kontext?'bestaetigt':'offen'},${kontext?'kontext':null})`);
        await tx.execute(sql`INSERT INTO public.intake_event(tenant_id,item_id,art,befehl_id,von,nachher) VALUES
          (${auth.tenantId},${input.itemId}::uuid,'angelegt',${input.itemId}::uuid,${auth.userId},${JSON.stringify({ kanal: input.mime.startsWith("image/") ? "foto" : "datei" })}::jsonb)`);
      }
      const inserted=await tx.execute(sql`INSERT INTO public.intake_file(id,tenant_id,item_id,client_key,art,dateiname,mime,bytes,sha256,speicherpfad,aufgenommen_am,aufgenommen_von,aufgenommen_auf,reihenfolge,lesbar,erkennung_status,geoeffnet,aufnahme_herkunft,foto_art,phase)
        SELECT ${input.fileId}::uuid,${auth.tenantId},${input.itemId}::uuid,${input.fileId},${input.mime === "message/rfc822" ? "mime" : input.mime.startsWith("image/") ? "foto" : input.mime === "application/pdf" ? "pdf" : input.mime.includes("xml") ? "xml" : "anhang"},
          ${input.name},${input.mime},${input.bytes},${input.sha256},${auth.tenantId + "/" + input.sha256},statement_timestamp(),${auth.userId}::uuid,${input.deviceId ?? null},
          coalesce(max(reihenfolge),0)+1,false,'wartet',false,${input.captureOrigin ?? "dokument"},${kontext?.fotoArt??null},${kontext?.phase??null}
          FROM public.intake_file WHERE tenant_id=${auth.tenantId} AND item_id=${input.itemId}::uuid
        ON CONFLICT (tenant_id,client_key) DO NOTHING RETURNING id`);
      const files = await tx.execute<FileRow&{kontext:unknown}>(sql`SELECT id::text,item_id::text,dateiname,mime,bytes::text,sha256,speicherpfad,erkennung_status,aufgenommen_auf,aufnahme_herkunft,aufgenommen_von::text,reihenfolge,
        ${intakeFileContextEvidence} AS kontext FROM public.intake_file file WHERE tenant_id=${auth.tenantId} AND client_key=${input.fileId}`);
      const row = files[0];
      if (files.length !== 1 || row.item_id !== input.itemId || row.dateiname !== input.name || row.mime !== input.mime || Number(row.bytes) !== input.bytes || row.sha256 !== input.sha256 || row.aufgenommen_auf !== (input.deviceId ?? null) || row.aufnahme_herkunft !== (input.captureOrigin ?? "dokument")) throw new Error("INTAKE_FILE_CLIENT_KEY_CONFLICT");
      if(inserted.length===1&&kontext){
        const station=kontext.uebergabeVersion===undefined?null:await readHandoffIntakePhotoTarget(tx,auth,{
          orderId:kontext.auftragId!,itemId:kontext.teilId!,expectedVersion:kontext.uebergabeVersion,
        });
        if(station&&station.code!=='OK')throw new StationContextRejected(station);
        if(station&&station.customerId!==kontext.kundeId)throw new StationContextRejected({code:'CONFLICT',message:contextMismatch});
        const belege=await tx.execute(sql`INSERT INTO public.intake_event(tenant_id,item_id,art,befehl_id,von,nachher)
          VALUES(${auth.tenantId},${input.itemId}::uuid,'zugeordnet',${input.fileId}::uuid,${auth.userId},
          ${JSON.stringify({action:'original_kontext',fileId:input.fileId,sha256:input.sha256,kontext,
            ...(station?{uebergabeEreignisId:station.transitionEventId}:{})})}::jsonb) RETURNING id`);
        if(belege.length!==1)throw Error('INTAKE_FILE_CONTEXT_NOT_SAVED');
      }else if(!isDeepStrictEqual(kontext,row.kontext)||kontext&&row.aufgenommen_von!==auth.userId)throw Error('INTAKE_FILE_CONTEXT_CONFLICT');
      if(input.deviceCapturedAt!==undefined){
        if(row.aufgenommen_von!==auth.userId)return {code:"FORBIDDEN" as const,message:"Anfragekennung wurde bereits anders verwendet."};
        const origin={action:"offline_original_captured",fileId:input.fileId,sha256:input.sha256,deviceCapturedAt:input.deviceCapturedAt,deviceId:input.deviceId??null,...(offlineOccurrenceTime(input.deviceCapturedAt).geraetezeit_abweichend?{geraetezeit_abweichend:true}:{}),...(input.takeover?{takeover:input.takeover,takeoverLogin:auth.displayName}:{})};
        const prior=await tx.execute<{nachher:typeof origin}>(sql`SELECT nachher FROM public.intake_event WHERE tenant_id=${auth.tenantId} AND item_id=${input.itemId}::uuid AND art='einsatz' AND befehl_id=${input.fileId}::uuid`);
        if(prior.length){const previous=prior[0].nachher.takeover;if(prior.length!==1||prior[0].nachher.action!==origin.action||prior[0].nachher.fileId!==origin.fileId||prior[0].nachher.sha256!==origin.sha256||prior[0].nachher.deviceCapturedAt!==origin.deviceCapturedAt||prior[0].nachher.deviceId!==origin.deviceId||input.takeover&&(!isIntakeOriginalTakeover(previous)||previous.sourceId!==input.takeover.sourceId||previous.deviceId!==input.takeover.deviceId||previous.sha256!==input.takeover.sha256))return {code:"CONFLICT" as const,message:"Anfragekennung wurde bereits anders verwendet."};}
        else{const saved=await tx.execute(sql`INSERT INTO public.intake_event(tenant_id,item_id,art,befehl_id,von,nachher) VALUES(${auth.tenantId},${input.itemId}::uuid,'einsatz',${input.fileId}::uuid,${auth.userId},${JSON.stringify(origin)}::jsonb) RETURNING id`);if(saved.length!==1)throw Error("INTAKE_DEVICE_ORIGIN_NOT_SAVED");}
      }
      return row;
    });
    if('code' in pending)return pending;
    if (!ensureOriginal && ["fertig", "fehler"].includes(pending.erkennung_status)) return { code: "OK", upload: null };
    const existing = await createAdminClient().storage.from(BUCKET).info(pending.speicherpfad);
    if (!existing.error && existing.data) return { code: "OK", upload: null };
    const grant = await createAdminClient().storage.from(BUCKET).createSignedUploadUrl(pending.speicherpfad, { upsert: false });
    if (grant.error || !grant.data || grant.data.path !== pending.speicherpfad) throw new Error("INTAKE_FILE_UPLOAD_GRANT_UNAVAILABLE");
    return { code: "OK", upload: { bucket: BUCKET, path: grant.data.path, token: grant.data.token, url: grant.data.signedUrl } };
  } catch(error){
    if(error instanceof StationContextRejected)return error.failure;
    if(error instanceof Error&&error.message==='INTAKE_FILE_CONTEXT_CONFLICT')return {code:'CONFLICT',message:contextMismatch};
    recordObservedFailure('INTAKE_FILE_PREPARE_FAILED');
    return { code: "UNAVAILABLE", message: "Datei ist noch nicht vollständig gesichert. Eingaben bleiben erhalten. Fehlercode: INTAKE_FILE_PREPARE_FAILED." };
  }
}
export async function finishIntakeFile(fileId: string, options: IntakeFileCompletion): Promise<FinishedFile> {
  const { retryKey } = options;
  if (!UUID.test(fileId)) return { code: "VALIDATION_ERROR", message: "Ungültige Dateikennung." };
  const auth = options.authorization ?? await fileAuthorization();
  if ("code" in auth) return auth;
  let recognitionStarted=false;
  try {
    const files = await withPrivilegedTenantTransaction(auth, tx => tx.execute<FileRow&{kanal:string;invoice_context:boolean;kontext:unknown;uebergabe:boolean;kunde_id:string|null;vorgang_id:string|null;vorgang_art:string|null;zuordnung_regel:string|null}>(sql`SELECT file.id::text,file.item_id::text,file.dateiname,file.mime,file.bytes::text,file.sha256,file.speicherpfad,file.erkennung_status,file.aufgenommen_auf,file.aufnahme_herkunft,file.aufgenommen_von::text,file.reihenfolge,source.kanal,source.kunde_id,source.vorgang_id,source.vorgang_art,source.zuordnung_regel,
      ${intakeFileContextEvidence} AS kontext,${intakeFileHandoffEvidence} AS uebergabe,(source.anliegen @> ARRAY['rechnung']::text[] OR source.vorgang_art='rechnung') AS invoice_context FROM public.intake_file file JOIN public.intake_item source ON source.tenant_id=file.tenant_id AND source.id=file.item_id WHERE file.tenant_id=${auth.tenantId} AND file.id=${fileId}::uuid`));
    if (files.length !== 1) return { code: "NOT_FOUND", message: "Datei wurde nicht gefunden." };
    const file = files[0];
    const kontext=isIntakeFileContext(file.kontext)&&file.kontext.kundeId?file.kontext as StoredIntakeFileContext:null;
    if((file.kontext!==null||file.zuordnung_regel==='kontext')&&(!kontext||!mayCaptureContextFile(auth,kontext)||
      !retryKey&&file.aufgenommen_von!==auth.userId||kontext.kundeId!==file.kunde_id||kontext.uebergabeVersion!==undefined&&!file.uebergabe||
      (kontext.auftragId??null)!==file.vorgang_id||(kontext.auftragId?'auftrag':null)!==file.vorgang_art))return {code:'FORBIDDEN',message:contextForbidden};
    const mailOriginal=file.mime==='message/rfc822'||file.dateiname.toLowerCase().endsWith('.eml'),invoiceAccess=hasAuthorizationArea(auth,'buchhaltung')&&file.invoice_context===true&&!mailOriginal;
    if(!kontext&&!hasAuthorizationArea(auth,'eingang')&&!invoiceAccess)return {code:'FORBIDDEN',message:FINANCIAL_ACCESS_COPY.bookkeepingMissing};
    if((file.kanal==='mail'&&!invoiceAccess||mailOriginal)&&!hasAuthorizationArea(auth,'mails'))return {code:'FORBIDDEN',message:'Mail-Originale erfordern zusätzlich das Recht Mails.'};
    const onlyInvoiceAccess=!kontext&&invoiceAccess&&(!hasAuthorizationArea(auth,'eingang')||file.kanal==='mail'&&!hasAuthorizationArea(auth,'mails'));
    const snapshot=async()=>{
      const result=await intakeCaptureSnapshot(auth,file.item_id,kontext?{customerId:kontext.kundeId,orderId:kontext.auftragId}:undefined,onlyInvoiceAccess,options.importingMail===true);
      return result.code==='OK'&&kontext?.fuerKunde!==undefined?{...result,kontextSichtbarkeit:kontext.fuerKunde}:result;
    };
    if(retryKey){
      const retry=await withPrivilegedTenantTransaction(auth,async tx=>{
        await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtextextended('intake-file:'||${auth.tenantId}||':'||${fileId},0))`);
        const prior=await tx.execute(sql`SELECT id FROM public.intake_event WHERE tenant_id=${auth.tenantId} AND item_id=${file.item_id}::uuid AND art='erkannt' AND befehl_id=${retryKey}::uuid`);
        if(prior.length)return false;
        const rows=await tx.execute(sql`UPDATE public.intake_file file SET erkennung_status='wartet' WHERE tenant_id=${auth.tenantId} AND id=${fileId}::uuid AND
          (erkennung_status IN ('wartet','fehler','fertig') OR erkennung_status='laeuft' AND
            coalesce((SELECT max(event.zeit) FROM public.intake_event event WHERE event.tenant_id=file.tenant_id AND event.item_id=file.item_id AND event.nachher->>'fileId'=file.id::text
              AND (event.art='original_gespeichert' OR event.art='einsatz' AND event.nachher->>'action'='erkennung_gestartet')),file.aufgenommen_am)<statement_timestamp()-interval '2 minutes') RETURNING id`);
        return rows.length===1;
      });
      if(!retry)return snapshot();
      file.erkennung_status='wartet';
    }
    const terminalStatus = ["fertig", "fehler"].includes(file.erkennung_status);
    if (terminalStatus) {
      const current = await snapshot();
      if (current.code !== "OK" || current.capture.files.some(entry => entry.id === fileId && entry.secured)) return current;
    }
    const stored = await createAdminClient().storage.from(BUCKET).download(file.speicherpfad);
    if (stored.error || !stored.data) throw new Error("INTAKE_FILE_UPLOAD_INCOMPLETE");
    const bytes = new Uint8Array(await stored.data.arrayBuffer());
    if (bytes.byteLength !== Number(file.bytes) || createHash("sha256").update(bytes).digest("hex") !== file.sha256) throw new Error("INTAKE_FILE_ORIGINAL_HASH_MISMATCH");
    // The original is secured before recognition. A provider failure cannot undo this event.
    await withPrivilegedTenantTransaction(auth, async tx => {
      await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtextextended('intake-file:'||${auth.tenantId}||':'||${fileId},0))`);
      const saved = await tx.execute(sql`INSERT INTO public.intake_event(tenant_id,item_id,art,befehl_id,von,nachher)
        SELECT ${auth.tenantId},${file.item_id}::uuid,'original_gespeichert',${fileId}::uuid,${auth.userId},${JSON.stringify({ fileId, sha256: file.sha256, bytes: bytes.byteLength })}::jsonb
        WHERE NOT EXISTS(SELECT 1 FROM public.intake_event WHERE tenant_id=${auth.tenantId} AND item_id=${file.item_id}::uuid AND art='original_gespeichert' AND befehl_id=${fileId}::uuid)
        RETURNING id`);
      if (terminalStatus && saved.length === 1) await tx.execute(sql`UPDATE public.intake_file SET erkennung_status='wartet'
        WHERE tenant_id=${auth.tenantId} AND id=${fileId}::uuid AND erkennung_status IN ('fertig','fehler')`);
      if (saved.length === 1 && file.mime.startsWith('image/')) {
        try {
          await withTenantSavepoint(tx, nested => nested.execute(sql`UPDATE public.intake_file SET phase='eingang'
            WHERE tenant_id=${auth.tenantId} AND id=${fileId}::uuid AND phase IS NULL`));
        } catch {
          recordObservedFailure('INTAKE_PHOTO_PHASE_FAILED');
        }
      }
      if (file.aufgenommen_auf) await tx.execute(sql`UPDATE public.device_request SET status='fotos_da'
        WHERE tenant_id=${auth.tenantId} AND login_id=${auth.userId}::uuid AND item_id=${file.item_id}::uuid
          AND status='angenommen' AND angenommen_auf @> ARRAY[${file.aufgenommen_auf}]::text[]`);
    });
    const readSettings=options.readSettings;
    const recognize=()=>erkenneOriginal({ tenantId: auth.tenantId, akteur: auth.userId, file, bytes, onlyInvoiceAccess,
      retryKey, kandidaten: onlyInvoiceAccess ? undefined : options.kandidaten }, fileId, readSettings);
    if(options.secureOnly)return snapshot();
    if(options.scheduleRecognition){
      const secured=await snapshot();
      if(secured.code==='OK'&&secured.capture.files.some(entry=>entry.id===fileId&&entry.secured&&entry.status==='wartet')){
        options.scheduleRecognition(recognize);
      }
      return secured;
    }
    recognitionStarted=true;
    await recognize();
    return snapshot();
  } catch {
    if(!recognitionStarted)await recordIntakeRecognitionFailure(auth, auth.userId, fileId, retryKey);
    return { code: "UNAVAILABLE", message: "Datei konnte nicht vollständig geprüft werden. Erneut versuchen; die Kennung bleibt gleich. Fehlercode: INTAKE_FILE_FINISH_FAILED." };
  }
}

export async function retryIntakeRecognition(input:unknown, readSettings: ReadRecognitionSettings, kandidaten?: KandidatenPorts):Promise<IntakeCaptureResult>{
  if(!input||typeof input!=="object"||Array.isArray(input))return {code:"VALIDATION_ERROR",message:"Ungültiger Erkennungsversuch."};
  const value=input as Record<string,unknown>;
  if(Object.keys(value).sort().join(",")!=="clientEventId,fileId"||typeof value.fileId!=="string"||!UUID.test(value.fileId)
    ||typeof value.clientEventId!=="string"||!UUID.test(value.clientEventId))return {code:"VALIDATION_ERROR",message:"Ungültiger Erkennungsversuch."};
  return finishIntakeFile(value.fileId,{retryKey:value.clientEventId,readSettings,kandidaten});
}
