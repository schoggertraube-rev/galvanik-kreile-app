import {FINANCIAL_ACCESS_COPY} from '@/ui/financialAccessCopy';
import {ohneGeldAnker} from './geldAnker';
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
import type {InvoicePageRange} from '../invoiceContract';
import {intakeFileContextEvidence,intakeFileHandoffEvidence} from '@/lib/server/orderStationAttachment';

const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export const gespeichertesBelegoriginal = sql`file.art<>'mime' AND file.mime<>'message/rfc822' AND lower(file.dateiname) NOT LIKE '%.eml'
 AND EXISTS(SELECT 1 FROM public.intake_event event WHERE event.tenant_id=file.tenant_id AND event.item_id=file.item_id
  AND event.art='original_gespeichert' AND event.nachher->>'fileId'=file.id::text
  AND (event.nachher->>'sha256' IS NULL OR event.nachher->>'sha256'=file.sha256))`;
type OriginalRow={id:string;item_id:string;art:string;kanal:string;dateiname:string;mime:string;bytes:string;sha256:string;speicherpfad:string;geoeffnet:boolean;kunde_id:string|null;vorgang_id:string|null;vorgang_art:string|null;zuordnung_regel:string|null;invoice_context:boolean;handoff_context:boolean;handoff_proven:boolean};

type IncomingMime={itemId:string;version:number};

async function readOriginalFileInTransaction(
  tx: PrivilegedTenantTransaction,
  auth: AuthorizationSnapshot,
  fileId: string,
  mime?: IncomingMime,
  nurGespeicherterBeleg = false,
) {
 const rows=await tx.execute<OriginalRow>(sql`
  SELECT file.id::text,file.item_id::text,file.art,source.kanal,file.dateiname,file.mime,file.bytes::text,file.sha256,file.speicherpfad,file.geoeffnet,source.kunde_id,source.vorgang_id,source.vorgang_art,source.zuordnung_regel,
   (source.anliegen @> ARRAY['rechnung']::text[] OR source.vorgang_art='rechnung') AS invoice_context,
   coalesce(${intakeFileContextEvidence} ? 'uebergabeVersion',false) AS handoff_context,${intakeFileHandoffEvidence} AS handoff_proven
  FROM public.intake_file file JOIN public.intake_item source ON source.tenant_id=file.tenant_id AND source.id=file.item_id
  WHERE file.tenant_id=${auth.tenantId} AND file.id=${fileId}::uuid
   ${nurGespeicherterBeleg?sql`AND ${gespeichertesBelegoriginal}`:sql``}
   ${mime?sql`AND source.id=${mime.itemId}::uuid AND source.version=${mime.version} AND source.kanal='mail' AND source.richtung='rein'
    AND file.mime='message/rfc822' AND file.art='mime'
    AND EXISTS(SELECT 1 FROM public.intake_event original WHERE original.tenant_id=file.tenant_id AND original.item_id=file.item_id
     AND original.art='original_gespeichert' AND original.nachher->>'fileId'=file.id::text AND original.nachher->>'sha256'=file.sha256)`:sql``}`);
 return rows.length===1?rows[0]:null;
}

export async function leseBelegoriginalFuerHandbuchungInTransaction(
  tx: PrivilegedTenantTransaction,
  auth: AuthorizationSnapshot,
  fileId: string,
) {
  if (!auth.active || !hasAuthorizationArea(auth, 'zahlungen') || !UUID.test(fileId)) return null;
  const file = await readOriginalFileInTransaction(tx, auth, fileId, undefined, true);
  return file ? { id: file.id, itemId: file.item_id, sha256: file.sha256 } : null;
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

async function invoiceLink(tx:PrivilegedTenantTransaction,tenantId:string,itemId:string,fileId:string,invoiceId?:string){
 const rows=await tx.execute<{id:string;seite_von:number|null;seite_bis:number|null}>(sql`SELECT id::text,seite_von,seite_bis
  FROM public.supplier_invoice WHERE tenant_id=${tenantId} AND item_id=${itemId}::uuid AND file_id=${fileId}::uuid
  ${invoiceId?sql`AND id=${invoiceId}::uuid`:sql``} LIMIT 2`);
 if(rows.length!==1)return null;
 const row=rows[0];
 const pages=row.seite_von!==null&&row.seite_bis!==null?{from:row.seite_von,to:row.seite_bis}:null;
 return {id:row.id,pages};
}

export function invoicePageFilter(pages:InvoicePageRange|null){
 return pages?sql`CASE WHEN jsonb_typeof(fundstelle->'page')='number'
  THEN (fundstelle->>'page')::numeric BETWEEN ${pages.from} AND ${pages.to} ELSE false END`:sql`true`;
}

function readOriginalFile(auth:AuthorizationSnapshot,fileId:string,mime?:IncomingMime){
 return withPrivilegedTenantTransaction(auth,tx=>readOriginalFileInTransaction(tx,auth,fileId,mime));
}

const originalAccessRequired='Dieses Original benötigt Eingang oder einen sichtbaren Auftrag.';
const mailAccessRequired='Mail · Inhalt nur fürs Büro';

function isMailOriginal(file:Pick<OriginalRow,'art'|'mime'|'dateiname'>){
 return file.art==='mime'||file.mime==='message/rfc822'||file.dateiname.toLowerCase().endsWith('.eml');
}

function originalAccess(auth:AuthorizationSnapshot,file:Pick<OriginalRow,'art'|'mime'|'dateiname'|'kanal'|'invoice_context'>,orderAccess=false,linkedInvoice=false){
 const mailOriginal=isMailOriginal(file);
 const intake=hasAuthorizationArea(auth,'eingang'),mail=hasAuthorizationArea(auth,'mails');
 const invoiceAccess=hasAuthorizationArea(auth,'buchhaltung')&&(file.invoice_context===true||linkedInvoice)&&!mailOriginal;
 return {
  permitted:intake||invoiceAccess||orderAccess,
  invoiceOnly:!orderAccess&&invoiceAccess&&(!intake||file.kanal==='mail'&&!mail),
  restricted:!orderAccess&&(file.kanal==='mail'&&!invoiceAccess||mailOriginal)&&!mail,
 };
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

export async function readIntakeInvoicePageSource(tx:PrivilegedTenantTransaction,auth:AuthorizationSnapshot,itemId:string,fileId:string){
 const file=await readOriginalFileInTransaction(tx,auth,fileId);
 if(!file||file.item_id!==itemId)return {code:'INVALID_FILE' as const};
 const access=originalAccess(auth,file);
 if(!access.permitted||access.restricted)return {code:'FORBIDDEN' as const,message:access.permitted?mailAccessRequired:originalAccessRequired};
 return {code:'OK' as const,mime:file.mime,async countPages(){
  const bytes=await verifiedOriginalBytes(originalStorage(),auth.tenantId,file);
  const {PDFDocument}=await import('pdf-lib');
  return (await PDFDocument.load(bytes,{updateMetadata:false})).getPageCount();
 }};
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
const validCustomerId=(id:unknown):id is string=>typeof id==='string'&&id.trim()===id&&id.length>0&&id.length<=128;

export async function readOrderIntakeOriginals(orderId:unknown){
 return readDomainIntakeOriginals('ORDER',orderId);
}

export async function readDomainIntakeOriginals(target:'ORDER'|'CUSTOMER',id:unknown){
 if(target==='ORDER'?(typeof id!=='string'||!UUID.test(id)):!validCustomerId(id))return {code:'VALIDATION_ERROR' as const,message:target==='ORDER'?'Auftragskennung ist ungültig.':'Kundenkennung ist ungültig.'};
 const targetId=id as string;
 const auth=await resolveAuthorization();if(!auth.ok)return {code:'UNAUTHENTICATED' as const,message:auth.message};
 if(!auth.data.permissions.includes('perm_view_leitstand'))return {code:'FORBIDDEN' as const,message:'Auftragskarte ist nicht erlaubt.'};
 if(target==='ORDER'){
  const order=await readLiveOrderCard(auth.data,{orderId:targetId});if(order.code!=='OK')return {code:order.code,message:order.message};
 }else if(!hasAuthorizationArea(auth.data,'kunden'))return {code:'FORBIDDEN' as const,message:'Kundenkarte ist nicht erlaubt.'};
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
   WHERE source.tenant_id=${auth.data.tenantId} AND ${target==='ORDER'?sql`source.vorgang_art='auftrag' AND source.vorgang_id=${targetId}`:
    sql`source.kunde_id=${targetId} AND source.zuordnung_regel='kontext' AND source.vorgang_art IS NULL AND source.kanal<>'mail'`}
   ORDER BY source.erstellt_am,source.id,file.reihenfolge,file.id`);
  return {code:'OK' as const,originals:rows.map(row=>({...row,bytes:Number(row.bytes)}))};
 });}catch(error){console.error('[ORDER_INTAKE_ORIGINALS_READ_FAILED]',error);return {code:'UNAVAILABLE' as const,message:'Eingangsoriginale konnten nicht geladen werden. Code: ORDER_INTAKE_ORIGINALS_READ_FAILED.'};}
}

export async function openIntakeOriginal(input:unknown){
 if(!input||typeof input!=="object"||Array.isArray(input))return {code:"VALIDATION_ERROR" as const,message:"Dateikennung fehlt."};
 const value=input as Record<string,unknown>;
 const keys=Object.keys(value).sort().join(',');
 if(!['clientEventId,fileId','clientEventId,fileId,orderId','clientEventId,fileId,invoiceId','clientEventId,customerId,fileId'].includes(keys)
  ||typeof value.fileId!=='string'||!UUID.test(value.fileId)
  ||typeof value.clientEventId!=='string'||!UUID.test(value.clientEventId)
  ||value.orderId!==undefined&&(typeof value.orderId!=='string'||!UUID.test(value.orderId))
  ||value.invoiceId!==undefined&&(typeof value.invoiceId!=='string'||!UUID.test(value.invoiceId))
  ||value.customerId!==undefined&&!validCustomerId(value.customerId)) {
  return {code:'VALIDATION_ERROR' as const,message:'Dateikennung ist ungültig.'};
 }
 const requestedInvoice=typeof value.invoiceId==='string'?value.invoiceId:undefined;
 const auth=await resolveAuthorization();if(!auth.ok)return {code:"UNAUTHENTICATED" as const,message:auth.message};
 const bookkeeping=hasAuthorizationArea(auth.data,'buchhaltung');
 const customerVisible=typeof value.customerId==='string'&&auth.data.permissions.includes('perm_view_leitstand')&&hasAuthorizationArea(auth.data,'kunden');
 if(!bookkeeping&&(requestedInvoice||!hasAuthorizationArea(auth.data,'eingang')&&!customerVisible&&!(value.orderId&&auth.data.permissions.includes('perm_view_leitstand')))) {
  return {code:'FORBIDDEN' as const,message:FINANCIAL_ACCESS_COPY.bookkeepingMissing};
 }
 if(typeof value.orderId==='string'){
  const order=await readLiveOrderCard(auth.data,{orderId:value.orderId});if(order.code!=='OK')return {code:order.code,message:order.message};
 }
 try{
  const file=await readOriginalFile(auth.data,value.fileId);
  if(!file)return {code:"NOT_FOUND" as const,message:"Original wurde nicht gefunden."};
  if(file.handoff_context&&(!value.orderId||!file.handoff_proven||!auth.data.permissions.includes('perm_op_photos'))){
   return {code:'FORBIDDEN' as const,message:'Original gehört nicht zu diesem sichtbaren Auftrag.'};
  }
  const orderAccess=value.orderId&&auth.data.permissions.includes('perm_view_leitstand')?await withPrivilegedTenantTransaction(auth.data,async tx=>{
   const linked=await tx.execute(sql`SELECT source.id FROM public.intake_item source
    WHERE source.tenant_id=${auth.data.tenantId} AND source.vorgang_art='auftrag' AND source.vorgang_id=${value.orderId}
     AND (source.id=${file.item_id}::uuid OR EXISTS(SELECT 1 FROM public.intake_event created WHERE created.tenant_id=source.tenant_id
       AND created.item_id=source.id AND created.art='angelegt' AND jsonb_exists(created.nachher->'originalFileIds',${file.id}))) LIMIT 1`);
   return linked.length===1;
  }):false;
  if(value.orderId&&!orderAccess)return {code:'FORBIDDEN' as const,message:'Original gehört nicht zu diesem sichtbaren Auftrag.'};
  const customerAccess=customerVisible&&file.kunde_id===value.customerId&&file.vorgang_art===null&&file.zuordnung_regel==='kontext'&&file.kanal!=='mail'&&!isMailOriginal(file);
  if(value.customerId&&!customerAccess)return {code:'FORBIDDEN' as const,message:'Original gehört nicht zu diesem Kunden.'};
  const invoice=bookkeeping&&!isMailOriginal(file)&&(requestedInvoice||file.invoice_context)?await withPrivilegedTenantTransaction(auth.data,
   tx=>invoiceLink(tx,auth.data.tenantId,file.item_id,file.id,requestedInvoice)):null;
  if(requestedInvoice&&!invoice)return {code:'NOT_FOUND' as const,message:'Original wurde nicht gefunden.'};
  const {permitted,invoiceOnly,restricted}=originalAccess(auth.data,file,orderAccess||customerAccess,invoice!==null);
  if(!permitted)return {code:'FORBIDDEN' as const,message:originalAccessRequired};
  if(restricted)return {code:'OK' as const,original:{id:file.id,itemId:file.item_id,name:file.dateiname,mime:file.mime,bytes:Number(file.bytes),sha256:file.sha256,customerId:file.kunde_id,orderId:file.vorgang_art==='auftrag'?file.vorgang_id:null,previewable:false,url:null,downloadUrl:null,restricted:true}};
  if(!allowedOriginalExtension(file.dateiname)){await recordIntakeFileBlocked(auth.data,file.id,value.clientEventId,'Dateityp nicht freigegeben');return {code:"FILE_BLOCKED" as const,message:"Dateityp wird nicht geöffnet oder heruntergeladen. Fehlercode: FILE_BLOCKED."};}
  const storage=originalStorage(),bytes=await verifiedOriginalBytes(storage,auth.data.tenantId,file);
  if(!safeOriginalBytes(file.dateiname,bytes)){await recordIntakeFileBlocked(auth.data,file.id,value.clientEventId,'Dateiinhalt passt nicht zum sicheren Format');return {code:"FILE_BLOCKED" as const,message:"Dateiformat wurde nicht sicher bestätigt. Nicht geöffnet. Fehlercode: FILE_BLOCKED."};}
  const previewable=['image/jpeg','image/png','image/webp','application/pdf'].includes(file.mime);
  const [preview,download]=await Promise.all([storage.createSignedUrl(file.speicherpfad,300,previewable?{}:{download:file.dateiname}),storage.createSignedUrl(file.speicherpfad,300,{download:file.dateiname})]);
  if(preview.error||download.error||!preview.data?.signedUrl||!download.data?.signedUrl)throw Error('INTAKE_ORIGINAL_LINK_UNAVAILABLE');
  const saved=await withPrivilegedTenantTransaction(auth.data,async tx=>{
   await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtextextended('intake-original-open:'||${auth.data.tenantId}||':'||${value.clientEventId},0))`);
   const prior=await tx.execute<{nachher:{fileId:string;action:string;invoiceId?:string}}>(sql`SELECT nachher FROM public.intake_event WHERE tenant_id=${auth.data.tenantId} AND art='einsatz' AND befehl_id=${value.clientEventId}::uuid AND von=${auth.data.userId}`);
   if(prior.length)return prior.length===1&&prior[0].nachher.fileId===file.id&&prior[0].nachher.action==='original_geoeffnet'&&prior[0].nachher.invoiceId===requestedInvoice;
   const changed=await tx.execute(sql`UPDATE public.intake_file SET geoeffnet=true WHERE tenant_id=${auth.data.tenantId} AND id=${file.id}::uuid AND item_id=${file.item_id}::uuid RETURNING id`);
   if(changed.length!==1)return false;
   await tx.execute(sql`INSERT INTO public.intake_event(tenant_id,item_id,art,befehl_id,von,vorher,nachher)
    VALUES(${auth.data.tenantId},${file.item_id}::uuid,'einsatz',${value.clientEventId}::uuid,${auth.data.userId},${JSON.stringify({geoeffnet:file.geoeffnet})}::jsonb,${JSON.stringify({action:'original_geoeffnet',fileId:file.id,sha256:file.sha256,geoeffnet:true,...(requestedInvoice?{invoiceId:requestedInvoice}: {})})}::jsonb)`);
   return true;
  });
  if(!saved)return {code:"CONFLICT" as const,message:"Originalzuordnung oder Anfrage wurde inzwischen geändert. Bitte erneut öffnen."};
  const pages=requestedInvoice?invoice?.pages??null:null;
  const invoiceSuggestions=invoiceOnly||requestedInvoice?await withPrivilegedTenantTransaction(auth.data,tx=>tx.execute<NonNullable<IntakeCapture['suggestions']>[number]>(sql`SELECT id::text,file_id::text AS "fileId",order_id AS "orderId",feld AS field,wert AS value,sicherheit AS confidence,regel AS rule,grund AS reason,
   fundstelle AS source,status,geprueft_von::text AS "verifiedBy",geprueft_am::text AS "verifiedAt" FROM public.intake_suggestion WHERE tenant_id=${auth.data.tenantId} AND file_id=${file.id}::uuid AND feld LIKE 'rechnung.%' AND status<>'verworfen' AND ${invoicePageFilter(pages)} ORDER BY id`)):undefined;
  const url=pages&&file.mime==='application/pdf'?`${preview.data.signedUrl}#page=${pages.from}`:preview.data.signedUrl;
  return {code:"OK" as const,original:{id:file.id,itemId:file.item_id,name:file.dateiname,mime:file.mime,bytes:bytes.byteLength,sha256:file.sha256,customerId:file.kunde_id,orderId:file.vorgang_art==='auftrag'?file.vorgang_id:null,invoiceId:invoice?.id??null,invoicePages:invoice?.pages??null,invoiceOnly,invoiceSuggestions:invoiceSuggestions?[...invoiceSuggestions]:undefined,previewable,url,downloadUrl:download.data.signedUrl,restricted:false}};
 }catch(error){console.error('[INTAKE_ORIGINAL_OPEN_FAILED]',{fileId:value.fileId,message:error instanceof Error?error.message:'UnknownError'});return {code:"UNAVAILABLE" as const,message:"Original konnte nicht sicher geöffnet werden. Fehlercode: INTAKE_ORIGINAL_OPEN_FAILED."};}
}

/** Verification is an explicit action. Opening a file never confirms its suggestions. */
export async function confirmIntakeOriginal(input:unknown){
 if(!input||typeof input!=='object'||Array.isArray(input))return {code:'VALIDATION_ERROR' as const,message:'Originalkennung fehlt.'};
 const value=input as Record<string,unknown>;
 const keys=Object.keys(value).sort().join(',');
 if(!['clientEventId,fileId','clientEventId,fileId,invoiceId'].includes(keys)
  ||typeof value.fileId!=='string'||!UUID.test(value.fileId)
  ||typeof value.clientEventId!=='string'||!UUID.test(value.clientEventId)
  ||value.invoiceId!==undefined&&(typeof value.invoiceId!=='string'||!UUID.test(value.invoiceId))) {
  return {code:'VALIDATION_ERROR' as const,message:'Originalkennung ist ungültig.'};
 }
 const fileId=value.fileId;
 const requestedInvoice=typeof value.invoiceId==='string'?value.invoiceId:undefined;
 const auth=await resolveAuthorization();if(!auth.ok)return {code:'UNAUTHENTICATED' as const,message:auth.message};
 const bookkeeping=hasAuthorizationArea(auth.data,'buchhaltung');
 if(!bookkeeping&&(requestedInvoice||!hasAuthorizationArea(auth.data,'eingang')))return {code:'FORBIDDEN' as const,message:FINANCIAL_ACCESS_COPY.bookkeepingMissing};
 try{return await withPrivilegedTenantTransaction(auth.data,async tx=>{
  const files=await tx.execute<{item_id:string;geoeffnet:boolean;kanal:string;mime:string;dateiname:string;art:string;invoice_context:boolean}>(sql`SELECT file.item_id::text,file.geoeffnet,source.kanal,file.mime,file.dateiname,file.art,(source.anliegen @> ARRAY['rechnung']::text[] OR source.vorgang_art='rechnung') AS invoice_context FROM public.intake_file file
    JOIN public.intake_item source ON source.tenant_id=file.tenant_id AND source.id=file.item_id WHERE file.tenant_id=${auth.data.tenantId} AND file.id=${value.fileId}::uuid FOR UPDATE OF file`);
  if(files.length!==1)return {code:'NOT_FOUND' as const,message:'Original nicht verfügbar.'};
  const file=files[0];
  const invoice=requestedInvoice&&!isMailOriginal(file)?await invoiceLink(tx,auth.data.tenantId,file.item_id,fileId,requestedInvoice):null;
  if(requestedInvoice&&!invoice)return {code:'NOT_FOUND' as const,message:'Original nicht verfügbar.'};
  const {permitted,restricted}=originalAccess(auth.data,file,false,invoice!==null);
  if(!permitted)return {code:'FORBIDDEN' as const,message:'Dieses Original benötigt Eingang.'};
  if(restricted)return {code:'FORBIDDEN' as const,message:mailAccessRequired};
  if(!file.geoeffnet)return {code:'CONFLICT' as const,message:'Original zuerst öffnen und prüfen.'};
  const prior=await tx.execute<{nachher:{action:string;fileId:string;count:number;invoiceId?:string}}>(sql`SELECT nachher FROM public.intake_event WHERE tenant_id=${auth.data.tenantId} AND item_id=${file.item_id}::uuid AND art='einsatz' AND befehl_id=${value.clientEventId}::uuid AND von=${auth.data.userId}`);
  if(prior.length)return prior.length===1&&prior[0].nachher.action==='original_geprueft'&&prior[0].nachher.fileId===value.fileId&&prior[0].nachher.invoiceId===requestedInvoice?{code:'OK' as const,count:prior[0].nachher.count,replayed:true}:{code:'CONFLICT' as const,message:'Anfrage wurde bereits anders verwendet.'};
  if(requestedInvoice){
   const opened=await tx.execute(sql`SELECT 1 FROM public.intake_event WHERE tenant_id=${auth.data.tenantId} AND item_id=${file.item_id}::uuid
    AND art='einsatz' AND von=${auth.data.userId} AND nachher->>'action'='original_geoeffnet'
    AND nachher->>'fileId'=${value.fileId} AND nachher->>'invoiceId'=${requestedInvoice} LIMIT 1`);
   if(!opened.length)return {code:'CONFLICT' as const,message:'Original zuerst öffnen und prüfen.'};
  }
  const changed=await tx.execute<{id:string}>(sql`UPDATE public.intake_suggestion SET geprueft_von=${auth.data.userId}::uuid,geprueft_am=statement_timestamp()
    WHERE tenant_id=${auth.data.tenantId} AND file_id=${value.fileId}::uuid AND status='offen' AND sicherheit='unsicher' AND geprueft_am IS NULL AND ${ohneGeldAnker}
    AND (${!requestedInvoice&&(hasAuthorizationArea(auth.data,'eingang')&&hasAuthorizationArea(auth.data,'mails')||file.kanal!=='mail'&&hasAuthorizationArea(auth.data,'eingang'))} OR feld LIKE 'rechnung.%')
    AND ${invoicePageFilter(invoice?.pages??null)} RETURNING id::text`);
  if(!changed.length)return {code:'OK' as const,count:0,replayed:true};
  await tx.execute(sql`INSERT INTO public.intake_event(tenant_id,item_id,art,befehl_id,von,nachher) VALUES(${auth.data.tenantId},${file.item_id}::uuid,'einsatz',${value.clientEventId}::uuid,${auth.data.userId},${JSON.stringify({action:'original_geprueft',fileId:value.fileId,count:changed.length,suggestionIds:changed.map(s=>s.id),...(requestedInvoice?{invoiceId:requestedInvoice}:{})})}::jsonb)`);
  return {code:'OK' as const,count:changed.length,replayed:false};
 });}catch(error){console.error('[INTAKE_ORIGINAL_CONFIRM_FAILED]',error);return {code:'UNAVAILABLE' as const,message:'Originalprüfung nicht gespeichert. Fehlercode: INTAKE_ORIGINAL_CONFIRM_FAILED.'};}
}
