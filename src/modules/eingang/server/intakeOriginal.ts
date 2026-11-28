import {FINANCIAL_ACCESS_COPY} from '@/ui/financialAccessCopy';
import "server-only";
import {createHash} from "node:crypto";
import {sql} from "drizzle-orm";
import {hasAuthorizationArea,resolveAuthorization} from "@/lib/server/authorization";
import type {AuthorizationSnapshot} from "@/lib/server/authorization";
import {canSynchronizeIntakeMailbox} from "@/lib/auth/authorizationContract";
import {withPrivilegedTenantTransaction,type PrivilegedTenantTransaction} from "@/lib/server/privilegedDb";
import {createAdminClient} from "@/lib/supabase/admin";
import {recordIntakeFileBlocked} from "@/lib/server/intakeOriginalAudit";
import {readLiveOrderCard} from "@/lib/server/orderCardRead";
import {allowedOriginalExtension,automaticMimeReply,safeOriginalBytes} from "../originalSafety";
import type {IntakeCapture} from '../captureContract';

const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
type OriginalRow={id:string;item_id:string;art:string;kanal:string;dateiname:string;mime:string;bytes:string;sha256:string;speicherpfad:string;geoeffnet:boolean;kunde_id:string|null;vorgang_id:string|null;vorgang_art:string|null;invoice_context:boolean};

type IncomingMime={itemId:string;version:number};

async function readOriginalFile(auth:AuthorizationSnapshot,fileId:string,mime?:IncomingMime){
 const rows=await withPrivilegedTenantTransaction(auth,tx=>tx.execute<OriginalRow>(sql`
  SELECT file.id::text,file.item_id::text,file.art,source.kanal,file.dateiname,file.mime,file.bytes::text,file.sha256,file.speicherpfad,file.geoeffnet,source.kunde_id,source.vorgang_id,source.vorgang_art,
   (source.anliegen @> ARRAY['rechnung']::text[] OR source.vorgang_art='rechnung') AS invoice_context
  FROM public.intake_file file JOIN public.intake_item source ON source.tenant_id=file.tenant_id AND source.id=file.item_id
  WHERE file.tenant_id=${auth.tenantId} AND file.id=${fileId}::uuid
   ${mime?sql`AND source.id=${mime.itemId}::uuid AND source.version=${mime.version} AND source.kanal='mail' AND source.richtung='rein'
    AND file.mime='message/rfc822' AND file.art='mime'
    AND EXISTS(SELECT 1 FROM public.intake_event original WHERE original.tenant_id=file.tenant_id AND original.item_id=file.item_id
     AND original.art='original_gespeichert' AND original.nachher->>'fileId'=file.id::text AND original.nachher->>'sha256'=file.sha256)`:sql``}`));
 return rows.length===1?rows[0]:null;
}

export async function readSecuredIntakeMailOriginal(tx:PrivilegedTenantTransaction,auth:AuthorizationSnapshot,itemId:string){
 if(!canSynchronizeIntakeMailbox(auth))return null;
 const files=await tx.execute<{id:string;name:string;mime:string;sha256:string}>(sql`
  SELECT file.id::text,file.dateiname AS name,file.mime,file.sha256
  FROM public.intake_file file
  WHERE file.tenant_id=${auth.tenantId} AND file.item_id=${itemId}::uuid
   AND file.art='mime' AND file.mime='message/rfc822' AND lower(file.dateiname) LIKE '%.eml'
   AND EXISTS(SELECT 1 FROM public.intake_event stored WHERE stored.tenant_id=file.tenant_id
    AND stored.item_id=file.item_id AND stored.art='original_gespeichert'
    AND stored.nachher->>'fileId'=file.id::text AND stored.nachher->>'sha256'=file.sha256)
   AND EXISTS(SELECT 1 FROM public.intake_event imported WHERE imported.tenant_id=file.tenant_id
    AND imported.item_id=file.item_id AND imported.art='einsatz'
    AND imported.nachher->>'action'='mail_import_complete' AND imported.nachher->'fileIds' ? file.id::text)
  LIMIT 2`);
 return files.length===1?files[0]:null;
}

function originalStorage(){return createAdminClient().storage.from('scans');}

type OriginalStorageReference=Pick<OriginalRow,'bytes'|'sha256'|'speicherpfad'>;

async function verifiedOriginalBytes(storage:ReturnType<typeof originalStorage>,tenantId:string,file:OriginalStorageReference){
 const size=Number(file.bytes);
 if(!/^[0-9a-f]{64}$/.test(file.sha256)||file.speicherpfad!==tenantId+'/'+file.sha256||!Number.isSafeInteger(size)||size<1||size>150*1024*1024)throw Error('INTAKE_ORIGINAL_METADATA_INVALID');
 const original=await storage.download(file.speicherpfad);
 if(original.error||!original.data)throw Error('INTAKE_ORIGINAL_NOT_SECURED');
 const bytes=new Uint8Array(await original.data.arrayBuffer());
 if(bytes.byteLength!==size||createHash('sha256').update(bytes).digest('hex')!==file.sha256)throw Error('INTAKE_ORIGINAL_HASH_MISMATCH');
 return bytes;
}

export async function countVerifiedIntakePdfPages(tenantId:string,file:OriginalStorageReference){
 const bytes=await verifiedOriginalBytes(originalStorage(),tenantId,file);
 const {PDFDocument}=await import('pdf-lib');
 return (await PDFDocument.load(bytes,{updateMetadata:false})).getPageCount();
}

/** Classify the exact stored MIME without opening, signing or changing the file. */
export async function readIntakeAutomaticReply(auth:AuthorizationSnapshot,input:IncomingMime&{fileId:string}){
 if(!auth.active||!hasAuthorizationArea(auth,'mails')||!UUID.test(input.fileId)||!UUID.test(input.itemId)||!Number.isSafeInteger(input.version)||input.version<1)return null;
 const file=await readOriginalFile(auth,input.fileId,input);
 if(!file||!/\.eml$/i.test(file.dateiname))return null;
 const bytes=await verifiedOriginalBytes(originalStorage(),auth.tenantId,file);
 return automaticMimeReply(bytes);
}

/** P103: project the same stored originals onto their associated order, without copying. */
export async function readOrderIntakeOriginals(orderId:unknown){
 if(typeof orderId!=='string'||!UUID.test(orderId))return {code:'VALIDATION_ERROR' as const,message:'Auftragskennung ist ungültig.'};
 const auth=await resolveAuthorization();if(!auth.ok)return {code:'UNAUTHENTICATED' as const,message:auth.message};
 if(!auth.data.permissions.includes('perm_view_leitstand'))return {code:'FORBIDDEN' as const,message:'Auftragskarte ist nicht erlaubt.'};
 const order=await readLiveOrderCard(auth.data,{orderId});if(order.code!=='OK')return {code:order.code,message:order.message};
 try{return await withPrivilegedTenantTransaction(auth.data,async tx=>{
  const rows=await tx.execute<{id:string;itemId:string;name:string;mime:string;bytes:string;at:string;part:number;total:number;secured:boolean}>(sql`
   WITH RECURSIVE chain AS (
    SELECT id,tenant_id,id AS root,1 AS part FROM public.intake_item WHERE tenant_id=${auth.data.tenantId} AND fortsetzung_von IS NULL
    UNION ALL SELECT child.id,child.tenant_id,chain.root,chain.part+1 FROM public.intake_item child JOIN chain
      ON child.tenant_id=chain.tenant_id AND child.fortsetzung_von=chain.id
   ), totals AS (SELECT root,max(part)::integer AS total FROM chain GROUP BY root)
   SELECT file.id::text,source.id::text AS "itemId",file.dateiname AS name,file.mime,file.bytes::text,source.erstellt_am::text AS at,chain.part,totals.total,
    EXISTS(SELECT 1 FROM public.intake_event original WHERE original.tenant_id=file.tenant_id AND original.item_id=file.item_id
      AND original.art='original_gespeichert' AND original.nachher->>'fileId'=file.id::text) AS secured
   FROM public.intake_item source JOIN chain ON chain.tenant_id=source.tenant_id AND chain.id=source.id
    JOIN totals ON totals.root=chain.root JOIN public.intake_file file ON file.tenant_id=source.tenant_id AND (
      file.item_id=source.id OR EXISTS(SELECT 1 FROM public.intake_event created WHERE created.tenant_id=source.tenant_id
        AND created.item_id=source.id AND created.art='angelegt' AND jsonb_exists(created.nachher->'originalFileIds',file.id::text)))
   WHERE source.tenant_id=${auth.data.tenantId} AND source.vorgang_art='auftrag' AND source.vorgang_id=${orderId}
   ORDER BY source.erstellt_am,source.id,file.reihenfolge,file.id`);
  return {code:'OK' as const,originals:rows.map(row=>({...row,bytes:Number(row.bytes)}))};
 });}catch(error){console.error('[ORDER_INTAKE_ORIGINALS_READ_FAILED]',error);return {code:'UNAVAILABLE' as const,message:'Eingangsoriginale konnten nicht geladen werden. Code: ORDER_INTAKE_ORIGINALS_READ_FAILED.'};}
}

export async function openIntakeOriginal(input:unknown){
 if(!input||typeof input!=="object"||Array.isArray(input))return {code:"VALIDATION_ERROR" as const,message:"Dateikennung fehlt."};
 const value=input as Record<string,unknown>;
 if(!['clientEventId,fileId','clientEventId,fileId,orderId'].includes(Object.keys(value).sort().join(','))||typeof value.fileId!=="string"||!UUID.test(value.fileId)||typeof value.clientEventId!=="string"||!UUID.test(value.clientEventId)||value.orderId!==undefined&&(typeof value.orderId!=='string'||!UUID.test(value.orderId)))return {code:"VALIDATION_ERROR" as const,message:"Dateikennung ist ungültig."};
 const auth=await resolveAuthorization();if(!auth.ok)return {code:"UNAUTHENTICATED" as const,message:auth.message};
  if(!hasAuthorizationArea(auth.data,'eingang')&&!hasAuthorizationArea(auth.data,'buchhaltung')&&!(value.orderId&&auth.data.permissions.includes('perm_view_leitstand')))return {code:"FORBIDDEN" as const,message:FINANCIAL_ACCESS_COPY.bookkeepingMissing};
 if(typeof value.orderId==='string'){
  const order=await readLiveOrderCard(auth.data,{orderId:value.orderId});if(order.code!=='OK')return {code:order.code,message:order.message};
 }
 try{
  const file=await readOriginalFile(auth.data,value.fileId);
  if(!file)return {code:"NOT_FOUND" as const,message:"Original wurde nicht gefunden."};
  const orderAccess=value.orderId&&auth.data.permissions.includes('perm_view_leitstand')?await withPrivilegedTenantTransaction(auth.data,async tx=>{
   const linked=await tx.execute(sql`SELECT source.id FROM public.intake_item source
    WHERE source.tenant_id=${auth.data.tenantId} AND source.vorgang_art='auftrag' AND source.vorgang_id=${value.orderId}
     AND (source.id=${file.item_id}::uuid OR EXISTS(SELECT 1 FROM public.intake_event created WHERE created.tenant_id=source.tenant_id
       AND created.item_id=source.id AND created.art='angelegt' AND jsonb_exists(created.nachher->'originalFileIds',${file.id}))) LIMIT 1`);
   return linked.length===1;
  }):false;
  if(value.orderId&&!orderAccess)return {code:'FORBIDDEN' as const,message:'Original gehört nicht zu diesem sichtbaren Auftrag.'};
  const mailOriginal=file.art==='mime'||file.mime==='message/rfc822'||file.dateiname.toLowerCase().endsWith('.eml');
  const invoiceAccess=hasAuthorizationArea(auth.data,'buchhaltung')&&file.invoice_context===true&&!mailOriginal;
  if(!hasAuthorizationArea(auth.data,'eingang')&&!invoiceAccess&&!orderAccess)return {code:'FORBIDDEN' as const,message:'Dieses Original benötigt Eingang oder einen sichtbaren Auftrag.'};
  const invoiceOnly=!orderAccess&&invoiceAccess&&(!hasAuthorizationArea(auth.data,'eingang')||file.kanal==='mail'&&!hasAuthorizationArea(auth.data,'mails'));
  const restricted=!orderAccess&&(file.kanal==='mail'&&!invoiceAccess||mailOriginal)&&!hasAuthorizationArea(auth.data,'mails');
  if(restricted)return {code:'OK' as const,original:{id:file.id,itemId:file.item_id,name:file.dateiname,mime:file.mime,bytes:Number(file.bytes),sha256:file.sha256,customerId:file.kunde_id,orderId:file.vorgang_art==='auftrag'?file.vorgang_id:null,previewable:false,url:null,downloadUrl:null,restricted:true}};
  if(!allowedOriginalExtension(file.dateiname)){await recordIntakeFileBlocked(auth.data,file.id,value.clientEventId,'Dateityp nicht freigegeben');return {code:"FILE_BLOCKED" as const,message:"Dateityp wird nicht geöffnet oder heruntergeladen. Fehlercode: FILE_BLOCKED."};}
  const storage=originalStorage(),bytes=await verifiedOriginalBytes(storage,auth.data.tenantId,file);
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
 if(!hasAuthorizationArea(auth.data,'eingang')&&!hasAuthorizationArea(auth.data,'buchhaltung'))return {code:'FORBIDDEN' as const,message:FINANCIAL_ACCESS_COPY.bookkeepingMissing};
 try{return await withPrivilegedTenantTransaction(auth.data,async tx=>{
  const files=await tx.execute<{item_id:string;geoeffnet:boolean;kanal:string;mime:string;dateiname:string;art:string;invoice_context:boolean}>(sql`SELECT file.item_id::text,file.geoeffnet,source.kanal,file.mime,file.dateiname,file.art,(source.anliegen @> ARRAY['rechnung']::text[] OR source.vorgang_art='rechnung') AS invoice_context FROM public.intake_file file
    JOIN public.intake_item source ON source.tenant_id=file.tenant_id AND source.id=file.item_id WHERE file.tenant_id=${auth.data.tenantId} AND file.id=${value.fileId}::uuid FOR UPDATE OF file`);
  if(files.length!==1)return {code:'NOT_FOUND' as const,message:'Original nicht verfügbar.'};
  const file=files[0];
  const mailOriginal=file.art==='mime'||file.mime==='message/rfc822'||file.dateiname.toLowerCase().endsWith('.eml');
  const invoiceAccess=hasAuthorizationArea(auth.data,'buchhaltung')&&file.invoice_context===true&&!mailOriginal;
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
