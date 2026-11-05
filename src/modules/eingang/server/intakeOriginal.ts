import "server-only";
import {createHash} from "node:crypto";
import {sql} from "drizzle-orm";
import {hasAuthorizationArea,resolveAuthorization} from "@/lib/server/authorization";
import {withPrivilegedTenantTransaction} from "@/lib/server/privilegedDb";
import {createAdminClient} from "@/lib/supabase/admin";
import {recordIntakeFileBlocked} from "@/lib/server/intakeOriginalAudit";
import {allowedOriginalExtension,safeOriginalBytes} from "../originalSafety";
import type {IntakeCapture} from '../captureContract';

const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
type OriginalRow={id:string;item_id:string;art:string;kanal:string;dateiname:string;mime:string;bytes:string;sha256:string;speicherpfad:string;geoeffnet:boolean;kunde_id:string|null;vorgang_id:string|null;vorgang_art:string|null;invoice_context:boolean};
export async function openIntakeOriginal(input:unknown){
 if(!input||typeof input!=="object"||Array.isArray(input))return {code:"VALIDATION_ERROR" as const,message:"Dateikennung fehlt."};
 const value=input as Record<string,unknown>;
 if(Object.keys(value).sort().join(',')!=="clientEventId,fileId"||typeof value.fileId!=="string"||!UUID.test(value.fileId)||typeof value.clientEventId!=="string"||!UUID.test(value.clientEventId))return {code:"VALIDATION_ERROR" as const,message:"Dateikennung ist ungültig."};
 const auth=await resolveAuthorization();if(!auth.ok)return {code:"UNAUTHENTICATED" as const,message:auth.message};
  if(!hasAuthorizationArea(auth.data,'eingang')&&!hasAuthorizationArea(auth.data,'geld'))return {code:"FORBIDDEN" as const,message:"Originale erfordern Eingang oder im Rechnungskontext Geld."};
 try{
  const rows=await withPrivilegedTenantTransaction(auth.data,tx=>tx.execute<OriginalRow>(sql`SELECT file.id::text,file.item_id::text,file.art,source.kanal,file.dateiname,file.mime,file.bytes::text,file.sha256,file.speicherpfad,file.geoeffnet,source.kunde_id,source.vorgang_id,source.vorgang_art,
    (source.anliegen @> ARRAY['rechnung']::text[] OR source.vorgang_art='rechnung') AS invoice_context
    FROM public.intake_file file JOIN public.intake_item source ON source.tenant_id=file.tenant_id AND source.id=file.item_id WHERE file.tenant_id=${auth.data.tenantId} AND file.id=${value.fileId}::uuid`));
  if(rows.length!==1)return {code:"NOT_FOUND" as const,message:"Original wurde nicht gefunden."};
  const file=rows[0];
  const mailOriginal=file.art==='mime'||file.mime==='message/rfc822'||file.dateiname.toLowerCase().endsWith('.eml');
  const invoiceAccess=hasAuthorizationArea(auth.data,'geld')&&file.invoice_context===true&&!mailOriginal;
  if(!hasAuthorizationArea(auth.data,'eingang')&&!invoiceAccess)return {code:'FORBIDDEN' as const,message:'Dieses Original benötigt Eingang.'};
  const invoiceOnly=invoiceAccess&&(!hasAuthorizationArea(auth.data,'eingang')||file.kanal==='mail'&&!hasAuthorizationArea(auth.data,'mails'));
  const restricted=(file.kanal==='mail'&&!invoiceAccess||mailOriginal)&&!hasAuthorizationArea(auth.data,'mails');
  if(restricted)return {code:'OK' as const,original:{id:file.id,itemId:file.item_id,name:file.dateiname,mime:file.mime,bytes:Number(file.bytes),sha256:file.sha256,customerId:file.kunde_id,orderId:file.vorgang_art==='auftrag'?file.vorgang_id:null,previewable:false,url:null,downloadUrl:null,restricted:true}};
  if(!allowedOriginalExtension(file.dateiname)){await recordIntakeFileBlocked(auth.data,file.id,value.clientEventId,'Dateityp nicht freigegeben');return {code:"FILE_BLOCKED" as const,message:"Dateityp wird nicht geöffnet oder heruntergeladen. Fehlercode: FILE_BLOCKED."};}
  if(file.speicherpfad!==auth.data.tenantId+'/'+file.sha256||!Number.isSafeInteger(Number(file.bytes))||Number(file.bytes)<1||Number(file.bytes)>150*1024*1024)throw Error('INTAKE_ORIGINAL_METADATA_INVALID');
  const storage=createAdminClient().storage.from('scans');
  const original=await storage.download(file.speicherpfad);
  if(original.error||!original.data)throw Error('INTAKE_ORIGINAL_NOT_SECURED');
  const bytes=new Uint8Array(await original.data.arrayBuffer());
  if(bytes.byteLength!==Number(file.bytes)||createHash('sha256').update(bytes).digest('hex')!==file.sha256)throw Error('INTAKE_ORIGINAL_HASH_MISMATCH');
  if(!safeOriginalBytes(file.dateiname,bytes)){await recordIntakeFileBlocked(auth.data,file.id,value.clientEventId,'Dateiinhalt passt nicht zum sicheren Format');return {code:"FILE_BLOCKED" as const,message:"Dateiformat wurde nicht sicher bestätigt. Nicht geöffnet. Fehlercode: FILE_BLOCKED."};}
  const previewable=['image/jpeg','image/png','image/webp','application/pdf'].includes(file.mime);
  const [preview,download]=await Promise.all([storage.createSignedUrl(file.speicherpfad,300,previewable?{}:{download:file.dateiname}),storage.createSignedUrl(file.speicherpfad,300,{download:file.dateiname})]);
  if(preview.error||download.error||!preview.data?.signedUrl||!download.data?.signedUrl)throw Error('INTAKE_ORIGINAL_LINK_UNAVAILABLE');
  const saved=await withPrivilegedTenantTransaction(auth.data,async tx=>{
   await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtextextended('intake-original-open:'||${auth.data.tenantId}||':'||${value.clientEventId},0))`);
   const prior=await tx.execute<{nachher:{fileId:string;action:string}}>(sql`SELECT nachher FROM public.intake_event WHERE tenant_id=${auth.data.tenantId} AND art='einsatz' AND befehl_id=${value.clientEventId}::uuid AND von=${auth.data.userId}`);
   if(prior.length)return prior.length===1&&prior[0].nachher.fileId===file.id&&prior[0].nachher.action==='original_geoeffnet';
   const changed=await tx.execute(sql`UPDATE public.intake_file SET geoeffnet=true WHERE tenant_id=${auth.data.tenantId} AND id=${file.id}::uuid AND item_id=${file.item_id}::uuid RETURNING id`);
   if(changed.length!==1)return false;
   await tx.execute(sql`INSERT INTO public.intake_event(tenant_id,item_id,art,befehl_id,von,vorher,nachher)
    VALUES(${auth.data.tenantId},${file.item_id}::uuid,'einsatz',${value.clientEventId}::uuid,${auth.data.userId},${JSON.stringify({geoeffnet:file.geoeffnet})}::jsonb,${JSON.stringify({action:'original_geoeffnet',fileId:file.id,sha256:file.sha256,geoeffnet:true})}::jsonb)`);
   return true;
  });
  if(!saved)return {code:"CONFLICT" as const,message:"Originalzuordnung oder Anfrage wurde inzwischen geändert. Bitte erneut öffnen."};
  const invoiceSuggestions=invoiceOnly?await withPrivilegedTenantTransaction(auth.data,tx=>tx.execute<NonNullable<IntakeCapture['suggestions']>[number]>(sql`SELECT id::text,file_id::text AS "fileId",order_id AS "orderId",feld AS field,wert AS value,sicherheit AS confidence,regel AS rule,grund AS reason,
   fundstelle AS source,status,geprueft_von::text AS "verifiedBy",geprueft_am::text AS "verifiedAt" FROM public.intake_suggestion WHERE tenant_id=${auth.data.tenantId} AND file_id=${file.id}::uuid AND feld LIKE 'rechnung.%' AND status<>'verworfen' ORDER BY id`)):undefined;
  return {code:"OK" as const,original:{id:file.id,itemId:file.item_id,name:file.dateiname,mime:file.mime,bytes:bytes.byteLength,sha256:file.sha256,customerId:file.kunde_id,orderId:file.vorgang_art==='auftrag'?file.vorgang_id:null,invoiceId:file.vorgang_art==='rechnung'?file.vorgang_id:null,invoiceOnly,invoiceSuggestions:invoiceSuggestions?[...invoiceSuggestions]:undefined,previewable,url:preview.data.signedUrl,downloadUrl:download.data.signedUrl,restricted:false}};
 }catch(error){console.error('[INTAKE_ORIGINAL_OPEN_FAILED]',{fileId:value.fileId,message:error instanceof Error?error.message:'UnknownError'});return {code:"UNAVAILABLE" as const,message:"Original konnte nicht sicher geöffnet werden. Fehlercode: INTAKE_ORIGINAL_OPEN_FAILED."};}
}

/** Verification is an explicit action. Opening a file never confirms its suggestions. */
export async function confirmIntakeOriginal(input:unknown){
 if(!input||typeof input!=='object'||Array.isArray(input))return {code:'VALIDATION_ERROR' as const,message:'Originalkennung fehlt.'};
 const value=input as Record<string,unknown>;
 if(Object.keys(value).sort().join(',')!=='clientEventId,fileId'||typeof value.fileId!=='string'||!UUID.test(value.fileId)||typeof value.clientEventId!=='string'||!UUID.test(value.clientEventId))return {code:'VALIDATION_ERROR' as const,message:'Originalkennung ist ungültig.'};
 const auth=await resolveAuthorization();if(!auth.ok)return {code:'UNAUTHENTICATED' as const,message:auth.message};
 if(!hasAuthorizationArea(auth.data,'eingang')&&!hasAuthorizationArea(auth.data,'geld'))return {code:'FORBIDDEN' as const,message:'Originalprüfung erfordert Eingang oder im Rechnungskontext Geld.'};
 try{return await withPrivilegedTenantTransaction(auth.data,async tx=>{
  const files=await tx.execute<{item_id:string;geoeffnet:boolean;kanal:string;mime:string;dateiname:string;art:string;invoice_context:boolean}>(sql`SELECT file.item_id::text,file.geoeffnet,source.kanal,file.mime,file.dateiname,file.art,(source.anliegen @> ARRAY['rechnung']::text[] OR source.vorgang_art='rechnung') AS invoice_context FROM public.intake_file file
    JOIN public.intake_item source ON source.tenant_id=file.tenant_id AND source.id=file.item_id WHERE file.tenant_id=${auth.data.tenantId} AND file.id=${value.fileId}::uuid FOR UPDATE OF file`);
  if(files.length!==1)return {code:'NOT_FOUND' as const,message:'Original nicht verfügbar.'};
  const file=files[0];
  const mailOriginal=file.art==='mime'||file.mime==='message/rfc822'||file.dateiname.toLowerCase().endsWith('.eml');
  const invoiceAccess=hasAuthorizationArea(auth.data,'geld')&&file.invoice_context===true&&!mailOriginal;
  if(!hasAuthorizationArea(auth.data,'eingang')&&!invoiceAccess)return {code:'FORBIDDEN' as const,message:'Dieses Original benötigt Eingang.'};
  if((file.kanal==='mail'&&!invoiceAccess||mailOriginal)&&!hasAuthorizationArea(auth.data,'mails'))return {code:'FORBIDDEN' as const,message:'Mail · Inhalt nur fürs Büro'};
  if(!file.geoeffnet)return {code:'CONFLICT' as const,message:'Original zuerst öffnen und prüfen.'};
  const prior=await tx.execute<{nachher:{action:string;fileId:string;count:number}}>(sql`SELECT nachher FROM public.intake_event WHERE tenant_id=${auth.data.tenantId} AND item_id=${file.item_id}::uuid AND art='einsatz' AND befehl_id=${value.clientEventId}::uuid AND von=${auth.data.userId}`);
  if(prior.length)return prior.length===1&&prior[0].nachher.action==='original_geprueft'&&prior[0].nachher.fileId===value.fileId?{code:'OK' as const,count:prior[0].nachher.count,replayed:true}:{code:'CONFLICT' as const,message:'Anfrage wurde bereits anders verwendet.'};
  const changed=await tx.execute<{id:string}>(sql`UPDATE public.intake_suggestion SET geprueft_von=${auth.data.userId}::uuid,geprueft_am=statement_timestamp()
    WHERE tenant_id=${auth.data.tenantId} AND file_id=${value.fileId}::uuid AND status='offen' AND sicherheit='unsicher' AND geprueft_am IS NULL
    AND (${hasAuthorizationArea(auth.data,'eingang')&&hasAuthorizationArea(auth.data,'mails')||file.kanal!=='mail'&&hasAuthorizationArea(auth.data,'eingang')} OR feld LIKE 'rechnung.%') RETURNING id::text`);
  if(!changed.length)return {code:'OK' as const,count:0,replayed:true};
  await tx.execute(sql`INSERT INTO public.intake_event(tenant_id,item_id,art,befehl_id,von,nachher) VALUES(${auth.data.tenantId},${file.item_id}::uuid,'einsatz',${value.clientEventId}::uuid,${auth.data.userId},${JSON.stringify({action:'original_geprueft',fileId:value.fileId,count:changed.length,suggestionIds:changed.map(s=>s.id)})}::jsonb)`);
  return {code:'OK' as const,count:changed.length,replayed:false};
 });}catch(error){console.error('[INTAKE_ORIGINAL_CONFIRM_FAILED]',error);return {code:'UNAVAILABLE' as const,message:'Originalprüfung nicht gespeichert. Fehlercode: INTAKE_ORIGINAL_CONFIRM_FAILED.'};}
}
