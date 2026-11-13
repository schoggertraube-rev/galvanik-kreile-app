import {mailImportFailureProjection} from './intakeMailFailureRead';
import type {MailImportFailure} from '../mailSelectionContract';
import {MAIL_IMPORT_COPY} from '@/ui/situationCatalog';
import {canSynchronizeIntakeMailbox} from "@/lib/auth/authorizationContract";
import 'server-only';
import {createHash} from 'node:crypto';
import {sql} from 'drizzle-orm';
import {hasAuthorizationArea,type AuthorizationSnapshot} from '@/lib/server/authorization';
import {withPrivilegedTenantTransaction,withTenantSavepoint,type PrivilegedTenantTransaction} from '@/lib/server/privilegedDb';
import {createAdminClient} from '@/lib/supabase/admin';
import {recognizeNoteConcerns} from '../captureContract';
import {prepareIntakeFile,finishIntakeFile} from './intakeFile';
import {bindIntakeOriginalToOrder} from './intakeOrderBinding';
import {assignInTransaction,assignIntakeCustomer} from './intakeAssignment';
import {deliveryReportFromOriginal,type DeliveryReport} from '../deliveryReport';

type ReplyChain={source:'original_mime';originalSha256:string;status:'present'|'missing'|'invalid';inReplyTo:string[];references:string[]};
type Mail={id:string;internetMessageId:string|null;subject:string;senderName:string;senderAddress:string;receivedAt:string;body:string;replyChain?:ReplyChain;deliveryReport?:DeliveryReport};
type Original={key:string;name:string;mime:string;bytes:Uint8Array};
export function intakeMailIdentity(value:string){const b=createHash('sha256').update(value).digest().subarray(0,16);b[6]=(b[6]&15)|80;b[8]=(b[8]&63)|128;const h=b.toString('hex');return `${h.slice(0,8)}-${h.slice(8,12)}-${h.slice(12,16)}-${h.slice(16,20)}-${h.slice(20)}`;}

/** A reply header is evidence from the secured original, never a guessed quote edition. */
function replyChainFromOriginal(bytes:Uint8Array):ReplyChain{
 const chain:ReplyChain={source:'original_mime',originalSha256:createHash('sha256').update(bytes).digest('hex'),status:'missing',inReplyTo:[],references:[]};
 const prefix=Buffer.from(bytes.subarray(0,65536)).toString('latin1'),boundary=prefix.search(/\r?\n\r?\n/);
 if(boundary<0)return {...chain,status:'invalid'};
 const lines=prefix.slice(0,boundary).replace(/\r?\n[ \t]+/g,' ').split(/\r?\n/);
 for(const line of lines){
  const colon=line.indexOf(':');if(colon<1)continue;const name=line.slice(0,colon).toLowerCase();if(name!=='in-reply-to'&&name!=='references')continue;
  const value=line.slice(colon+1).trim(),ids=value.match(/<[^<>\s]{1,998}>/g)??[];
  if(value.length>16000||!ids.length||ids.length>30)return {...chain,status:'invalid',inReplyTo:[],references:[]};
  const target=name==='in-reply-to'?chain.inReplyTo:chain.references;for(const id of ids)if(!target.includes(id))target.push(id);
 }
 chain.status=chain.inReplyTo.length||chain.references.length?'present':'missing';return chain;
}

/** A completed immutable capture is the primary source, even if Outlook is now unavailable. */
export async function readIntakeMailImportReceipt(auth:AuthorizationSnapshot,identity:{graphMessageId:string}|{itemId:string}){
 if(!canSynchronizeIntakeMailbox(auth))return {code:'FORBIDDEN' as const,message:'Mail-Original benötigt Eingang und Mails.'};
 try{
  const rows=await withPrivilegedTenantTransaction(auth,tx=>tx.execute<Mail&{itemId:string;receipt:{fileIds:string[];originalCount:number;filteredAttachments:number}}>(sql`
   SELECT source.id::text AS "itemId",source.graph_message_id AS id,source.internet_message_id AS "internetMessageId",source.betreff AS subject,source.absender_name AS "senderName",source.absender_adresse AS "senderAddress",source.empfangen_am::text AS "receivedAt",source.text AS body,complete.nachher AS receipt,(SELECT original.nachher->'replyChain' FROM public.intake_event original WHERE original.tenant_id=source.tenant_id AND original.item_id=source.id AND original.art='angelegt' ORDER BY original.zeit,original.id LIMIT 1) AS "replyChain",
    (SELECT original.nachher->'deliveryReport' FROM public.intake_event original WHERE original.tenant_id=source.tenant_id AND original.item_id=source.id AND original.art='angelegt' ORDER BY original.zeit,original.id LIMIT 1) AS "deliveryReport"
   FROM public.intake_item source JOIN LATERAL (SELECT nachher FROM public.intake_event event WHERE event.tenant_id=source.tenant_id AND event.item_id=source.id AND event.art='einsatz' AND event.nachher->>'action'='mail_import_complete' ORDER BY event.zeit,event.id LIMIT 1) complete ON true
   WHERE source.tenant_id=${auth.tenantId} AND source.kanal='mail' AND ${'itemId'in identity?sql`source.id::text=${identity.itemId}`:sql`source.graph_message_id=${identity.graphMessageId}`}
    AND (SELECT count(*) FROM public.intake_file file WHERE file.tenant_id=source.tenant_id AND file.item_id=source.id AND complete.nachher->'fileIds' ? file.id::text
      AND EXISTS(SELECT 1 FROM public.intake_event original WHERE original.tenant_id=file.tenant_id AND original.item_id=file.item_id AND original.art='original_gespeichert' AND original.nachher->>'fileId'=file.id::text))=jsonb_array_length(complete.nachher->'fileIds')`));
  const row=rows[0];if(!row)return {code:'NOT_FOUND' as const,message:'Mail-Original noch nicht vollständig gesichert.'};
  const receipt=row.receipt;
  if(rows.length!==1||!Array.isArray(receipt.fileIds)||receipt.fileIds.length!==receipt.originalCount+1||new Set(receipt.fileIds).size!==receipt.fileIds.length||!Number.isSafeInteger(receipt.originalCount)||receipt.originalCount<0||!Number.isSafeInteger(receipt.filteredAttachments)||receipt.filteredAttachments<0||!row.id||typeof row.subject!=='string'||typeof row.senderName!=='string'||typeof row.senderAddress!=='string'||typeof row.body!=='string'||!Number.isFinite(Date.parse(row.receivedAt)))throw Error('INTAKE_MAIL_RECEIPT_INVALID');
  return {code:'OK' as const,itemId:row.itemId,originalCount:receipt.originalCount,filteredAttachments:receipt.filteredAttachments,replayed:true,message:{id:row.id,internetMessageId:row.internetMessageId,subject:row.subject,senderName:row.senderName,senderAddress:row.senderAddress,receivedAt:new Date(row.receivedAt).toISOString(),body:row.body,preview:row.body.slice(0,1000),hasAttachments:receipt.originalCount>0,...(row.replyChain?{replyChain:row.replyChain}:{}),...(row.deliveryReport?{deliveryReport:row.deliveryReport}:{})}};
 }catch(error){console.error('[INTAKE_MAIL_RECEIPT_FAILED]',error instanceof Error?error.name:'UnknownError');return {code:'UNAVAILABLE' as const,message:'Gesichertes Mail-Original konnte nicht bestätigt werden.'};}
}

type MailCandidate=Partial<Mail>&{id:string};
type PreviousMailReader=(tx:PrivilegedTenantTransaction,auth:AuthorizationSnapshot,graphId:string)=>Promise<{customerId:string|null;orderId:string|null}|null>;
type FailureTaskSource={itemId:string;key:string;graphId:string;actors:string[];reason:string};
type FailureTaskWriter=(tx:PrivilegedTenantTransaction,auth:AuthorizationSnapshot,source:FailureTaskSource)=>Promise<string>;

/** The one existing mail-row writer also parks failed metadata. No original-source
 * event is created until actual MIME has been received by the existing importer. */
async function captureGraphMailRow(tx:PrivilegedTenantTransaction,auth:AuthorizationSnapshot,mail:MailCandidate,proof?:{replyChain:ReplyChain;deliveryReport:DeliveryReport|null},readPrevious?:PreviousMailReader){
 const identity=mail.internetMessageId??mail.id;
 await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtextextended('mail-import:'||${auth.tenantId}||':'||${identity},0))`);
 const existing=await tx.execute<{id:string;kunde_id:string|null;vorgang_id:string|null;vorgang_art:string|null;zuordnung:string}>(sql`SELECT id::text,kunde_id,vorgang_id,vorgang_art,zuordnung FROM public.intake_item WHERE tenant_id=${auth.tenantId} AND (graph_message_id=${mail.id} OR (${mail.internetMessageId??null}::text IS NOT NULL AND internet_message_id=${mail.internetMessageId??null})) FOR UPDATE`);
 if(existing.length>1)throw Error('INTAKE_MAIL_IDENTITY_AMBIGUOUS');
 const id=existing[0]?.id??intakeMailIdentity(auth.tenantId+':graph:'+mail.id);
 const [created]=await tx.execute<{n:number}>(sql`SELECT count(*)::integer AS n FROM public.intake_event WHERE tenant_id=${auth.tenantId} AND item_id=${id}::uuid AND art='angelegt'`);
 if(created.n>1)throw Error('INTAKE_MAIL_SOURCE_AMBIGUOUS');
 if(!existing.length){
  const received=typeof mail.receivedAt==='string'&&Number.isFinite(Date.parse(mail.receivedAt))?mail.receivedAt:null;
  await tx.execute(sql`INSERT INTO public.intake_item(id,tenant_id,client_key,kanal,richtung,quelle,erstellt_von,empfangen_am,absender_name,absender_adresse,betreff,text,gruppe_adresse,graph_message_id,internet_message_id)
   VALUES(${id}::uuid,${auth.tenantId},${'graph:'+mail.id},'mail','rein','mailabruf',${auth.userId}::uuid,${received}::timestamptz,${mail.senderName??null},${mail.senderAddress??null},${mail.subject??null},${mail.body??null},${mail.senderAddress?.trim().toLowerCase()??null},${mail.id},${mail.internetMessageId??null})`);
 }
 if(proof&&created.n===0){
  const current=existing[0],legacyEligible=!current||current.kunde_id===null&&current.vorgang_id===null&&current.vorgang_art===null&&current.zuordnung==='offen';
  const actual=mail as Mail,previous=readPrevious&&legacyEligible?await readPrevious(tx,auth,mail.id):null;
  const concerns=recognizeNoteConcerns(actual.subject+'\n'+actual.body,'mail').map(row=>row.id),values=sql`ARRAY[${sql.join(concerns.map(value=>sql`${value}`),sql`, `)}]::text[]`;
  // A parked row has no original yet. Fill it from the actual provider original,
  // preserving any real assignment already made through the assignment writer.
  await tx.execute(sql`UPDATE public.intake_item SET empfangen_am=${actual.receivedAt}::timestamptz,absender_name=${actual.senderName},absender_adresse=${actual.senderAddress},betreff=${actual.subject},text=${actual.body},gruppe_adresse=${actual.senderAddress.trim().toLowerCase()},
   anliegen=${values},anliegen_offen=${values},kunde_id=coalesce(kunde_id,${previous?.customerId??null}),vorgang_art=coalesce(vorgang_art,${previous?.orderId?'auftrag':null}),vorgang_id=coalesce(vorgang_id,${previous?.orderId??null}),
   zuordnung=CASE WHEN kunde_id IS NOT NULL THEN zuordnung ELSE ${previous?.customerId?'hand':'offen'} END,version=version+${existing.length?1:0} WHERE tenant_id=${auth.tenantId} AND id=${id}::uuid`);
  await tx.execute(sql`INSERT INTO public.intake_event(tenant_id,item_id,art,befehl_id,von,nachher) VALUES(${auth.tenantId},${id}::uuid,'angelegt',${id}::uuid,${auth.userId},${JSON.stringify({kanal:'mail',graphMessageId:mail.id,text:actual.body,replyChain:proof.replyChain,...(proof.deliveryReport?{deliveryReport:proof.deliveryReport}:{}),...(previous?.customerId?{importedCorrespondence:previous}:{})})}::jsonb)`);
 }
 return {itemId:id,replayed:existing.length===1};
}

/** One Graph identity, one existing intake, and the existing original-file writer. */
export async function importIntakeGraphMail(auth:AuthorizationSnapshot,mail:Mail,originals:Original[],readPrevious?:PreviousMailReader,filteredAttachments=0){
 if(!canSynchronizeIntakeMailbox(auth))return {code:'FORBIDDEN' as const,message:'Mail-Import benötigt Eingang und Mails.'};
 if(!mail.id||mail.id.length>1024||!Number.isFinite(Date.parse(mail.receivedAt))||mail.body.length>20000||originals.filter(file=>file.mime==='message/rfc822').length!==1||new Set(originals.map(file=>file.key)).size!==originals.length||!Number.isSafeInteger(filteredAttachments)||filteredAttachments<0)return {code:'VALIDATION_ERROR' as const,message:'Mail oder unverändertes Original fehlt.'};
 try{
  const replyChain=replyChainFromOriginal(originals.find(file=>file.mime==='message/rfc822')!.bytes);
  const deliveryReport=deliveryReportFromOriginal(originals.find(file=>file.mime==='message/rfc822')!.bytes);
  const result=await withPrivilegedTenantTransaction(auth,tx=>captureGraphMailRow(tx,auth,mail,{replyChain,deliveryReport},readPrevious));
  const prior=await readIntakeMailImportReceipt(auth,{itemId:result.itemId});
  if(prior.code==='OK')return {code:'OK' as const,itemId:result.itemId,replayed:true};
  if(prior.code!=='NOT_FOUND')return prior;
  for(const original of originals){
   const fileId=intakeMailIdentity(result.itemId+':original:'+original.key),sha256=createHash('sha256').update(original.bytes).digest('hex');
   const grant=await prepareIntakeFile({itemId:result.itemId,fileId,name:original.name,mime:original.mime,bytes:original.bytes.byteLength,sha256},true);
   if(grant.code!=='OK')return grant;
   if(grant.upload){
    const saved=await createAdminClient().storage.from(grant.upload.bucket).uploadToSignedUrl(grant.upload.path,grant.upload.token,original.bytes,{contentType:original.mime,upsert:false});
    if(saved.error)throw Error('INTAKE_MAIL_ORIGINAL_UPLOAD_FAILED');
   }
   const secured=await finishIntakeFile(fileId,undefined,true);
   if(secured.code!=='OK')return secured;
   if(!secured.capture.files.some(file=>file.id===fileId&&file.secured))throw Error('INTAKE_MAIL_ORIGINAL_NOT_CONFIRMED');
  }
  const completeKey=intakeMailIdentity(result.itemId+':mail-import-complete');
  await withPrivilegedTenantTransaction(auth,async tx=>{
   await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtextextended('intake:'||${auth.tenantId}||':'||${result.itemId},0))`);
   await tx.execute(sql`INSERT INTO public.intake_event(tenant_id,item_id,art,befehl_id,von,nachher)
    SELECT ${auth.tenantId},${result.itemId}::uuid,'einsatz',${completeKey}::uuid,${auth.userId},${JSON.stringify({action:'mail_import_complete',fileIds:originals.map(file=>intakeMailIdentity(result.itemId+':original:'+file.key)),originalCount:originals.filter(file=>file.mime!=='message/rfc822').length,filteredAttachments})}::jsonb
    WHERE NOT EXISTS(SELECT 1 FROM public.intake_event WHERE tenant_id=${auth.tenantId} AND item_id=${result.itemId}::uuid AND art='einsatz' AND befehl_id=${completeKey}::uuid)`);
  });
  const secured=await readIntakeMailImportReceipt(auth,{itemId:result.itemId});
  if(secured.code!=='OK')return secured;
  await withPrivilegedTenantTransaction(auth,tx=>clearMailFailureFlag(tx,auth,result.itemId));
  return {code:'OK' as const,...result};
 }catch(error){const cause=error instanceof Error&&error.cause&&typeof error.cause==='object'?error.cause as Record<string,unknown>:null;console.error('[INTAKE_MAIL_IMPORT_FAILED]',{code:typeof cause?.code==='string'?cause.code:'INTAKE_MAIL_IMPORT_FAILED',constraint:typeof cause?.constraint_name==='string'?cause.constraint_name:undefined});return {code:'UNAVAILABLE' as const,message:'Mail-Original noch nicht vollständig gesichert · beim erneuten Abruf wird derselbe Eingang fortgesetzt.'};}
}

/** Old Outlook buttons adapt to the same assignment writers; originals are never copied. */
export async function linkImportedMail(auth:AuthorizationSnapshot,input:{itemId:string;targetType:'CUSTOMER'|'ORDER';targetId:string},readTarget:(tx:PrivilegedTenantTransaction,auth:AuthorizationSnapshot,type:'CUSTOMER'|'ORDER',id:string)=>Promise<{customerId:string;orderId:string|null}|null>,readCustomer:Parameters<typeof assignIntakeCustomer>[1]){
 if(!canSynchronizeIntakeMailbox(auth)||!['CUSTOMER','ORDER'].includes(input.targetType)||!input.targetId||input.targetId.length>128)return {code:'FORBIDDEN' as const,message:'Zuordnen benötigt Eingang, Mails und ein gültiges Ziel.'};
 if(input.targetType==='ORDER'&&!hasAuthorizationArea(auth,'auftraege')&&!hasAuthorizationArea(auth,'kunden'))return {code:'FORBIDDEN' as const,message:'Auftrag zuordnen benötigt Aufträge oder Kunden.'};
 try{return await withPrivilegedTenantTransaction(auth,async tx=>{
  await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtextextended('intake-assignment:'||${auth.tenantId},0))`);
  const target=await readTarget(tx,auth,input.targetType,input.targetId);if(!target)return {code:'NOT_FOUND' as const,message:'Zuordnungsziel nicht verfügbar.'};
  const rows=await tx.execute<{version:number;kunde_id:string|null;vorgang_id:string|null;zuordnung:string}>(sql`SELECT version,kunde_id,vorgang_id,zuordnung FROM public.intake_item WHERE tenant_id=${auth.tenantId} AND id=${input.itemId}::uuid AND kanal='mail' FOR UPDATE`);
  const row=rows[0];if(!row)return {code:'NOT_FOUND' as const,message:'Mail-Eingang nicht verfügbar.'};
  if(row.zuordnung!=='offen'&&(row.kunde_id!==target.customerId||row.vorgang_id!==null&&row.vorgang_id!==target.orderId))return {code:'CONFLICT' as const,message:'Diese Mail ist bereits einem anderen Vorgang zugeordnet.'};
  if(row.kunde_id===target.customerId&&row.vorgang_id===target.orderId)return {code:'OK' as const};
  const clientEventId=intakeMailIdentity(input.itemId+':assignment:'+input.targetType+':'+input.targetId);
  if(target.orderId){await bindIntakeOriginalToOrder(tx,auth,{itemId:input.itemId,orderId:target.orderId,customerId:target.customerId,clientEventId,complete:false});return {code:'OK' as const};}
  const assigned=await assignInTransaction(tx,auth,{itemId:input.itemId,version:row.version,customerId:target.customerId,clientEventId,mode:'manual'},readCustomer);
  return assigned.code==='ALREADY_ASSIGNED'?{code:'CONFLICT' as const,message:'Diese Mail wurde inzwischen zugeordnet.'}:assigned;
 });}catch(error){console.error('[INTAKE_MAIL_LINK_FAILED]',error instanceof Error?error.name:'UnknownError');return {code:'UNAVAILABLE' as const,message:'Mail-Zuordnung nicht sicher bestätigt · Eingang und Originale bleiben erhalten.'};}
}


/** Mailbox provenance is observed by the existing server Graph import, never guessed for old originals. */
export async function observeIntakeMailboxImport(auth:AuthorizationSnapshot,input:{mailbox:string;graphMessageId:string}){
 if(!canSynchronizeIntakeMailbox(auth))return {code:'FORBIDDEN' as const};
 if(!input.mailbox||input.mailbox.length>320||input.mailbox!==input.mailbox.trim()||!input.graphMessageId)return {code:'VALIDATION_ERROR' as const};
 const receipt=await readIntakeMailImportReceipt(auth,{graphMessageId:input.graphMessageId});
 if(receipt.code!=='OK')return receipt;
 const mailbox=input.mailbox.toLowerCase(),key=intakeMailIdentity('mailbox-observed:'+mailbox+':'+input.graphMessageId);
 try{return await withPrivilegedTenantTransaction(auth,async tx=>{
  await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtextextended('intake-mailbox:'||${auth.tenantId}||':'||${key},0))`);
  await tx.execute(sql`INSERT INTO public.intake_event(tenant_id,item_id,art,befehl_id,von,nachher) SELECT ${auth.tenantId},${receipt.itemId}::uuid,'einsatz',${key}::uuid,${auth.userId},jsonb_build_object('action','mailbox_observed','mailbox',${mailbox}::text,'graphMessageId',${input.graphMessageId}::text) WHERE NOT EXISTS(SELECT 1 FROM public.intake_event WHERE tenant_id=${auth.tenantId} AND befehl_id=${key}::uuid)`);
  const rows=await tx.execute(sql`SELECT id FROM public.intake_event WHERE tenant_id=${auth.tenantId} AND item_id=${receipt.itemId}::uuid AND befehl_id=${key}::uuid AND art='einsatz' AND nachher->>'action'='mailbox_observed' AND nachher->>'mailbox'=${mailbox} AND nachher->>'graphMessageId'=${input.graphMessageId}`);
  if(rows.length!==1)throw Error('INTAKE_MAILBOX_OBSERVATION_NOT_SAVED');
  await clearMailFailureFlag(tx,auth,receipt.itemId);
  return {code:'OK' as const};
 });}catch(error){console.error('[INTAKE_MAILBOX_OBSERVATION_FAILED]',error instanceof Error?error.name:'UnknownError');return {code:'UNAVAILABLE' as const};}
}
/** Candidate lookup only; the existing immutable-original receipt remains the sole qualifier. */
export async function readIntakeMailboxWatermark(auth:AuthorizationSnapshot,mailbox:string){
 if(!canSynchronizeIntakeMailbox(auth))return {code:'FORBIDDEN' as const};
 try{
  const rows=await withPrivilegedTenantTransaction(auth,tx=>tx.execute<{graph_id:string}>(sql`SELECT source.graph_message_id AS graph_id FROM public.intake_item source WHERE source.tenant_id=${auth.tenantId} AND source.kanal='mail' AND source.graph_message_id IS NOT NULL AND EXISTS(SELECT 1 FROM public.intake_event observed WHERE observed.tenant_id=source.tenant_id AND observed.item_id=source.id AND observed.art='einsatz' AND observed.nachher->>'action'='mailbox_observed' AND observed.nachher->>'mailbox'=${mailbox.toLowerCase()} AND observed.nachher->>'graphMessageId'=source.graph_message_id) ORDER BY source.empfangen_am DESC NULLS LAST,source.id DESC LIMIT 1`));
  if(rows.length===0)return {code:'OK' as const,watermark:null};
  const receipt=await readIntakeMailImportReceipt(auth,{graphMessageId:rows[0].graph_id});
  if(receipt.code!=='OK')return {code:'UNAVAILABLE' as const};
  return {code:'OK' as const,watermark:receipt.message.receivedAt};
 }catch(error){console.error('[INTAKE_MAILBOX_WATERMARK_FAILED]',error instanceof Error?error.name:'UnknownError');return {code:'UNAVAILABLE' as const};}
}


/** A2: failure metadata and its actual attempts stay on the existing intake source. */
export async function parkIntakeMailImportFailure(auth:AuthorizationSnapshot,input:{mail:MailCandidate;mailbox:string;reason:string;attemptKey:string},createTask:FailureTaskWriter){
 if(!canSynchronizeIntakeMailbox(auth))return {code:'FORBIDDEN' as const};
 if(!input.mail.id||input.mail.id.length>1024||!input.mailbox||!input.reason||!input.attemptKey)throw Error('INTAKE_MAIL_FAILURE_SOURCE_REQUIRED');
 try{return await withPrivilegedTenantTransaction(auth,async tx=>{
  const source=await captureGraphMailRow(tx,auth,input.mail),key=intakeMailIdentity(input.attemptKey+':'+input.mail.id+':failure');
  const complete=await tx.execute(sql`SELECT id FROM public.intake_event WHERE tenant_id=${auth.tenantId} AND item_id=${source.itemId}::uuid AND art='einsatz' AND nachher->>'action'='mail_import_complete'`);
  if(complete.length)return {code:'SECURED' as const,itemId:source.itemId};
  const added=await tx.execute(sql`INSERT INTO public.intake_event(tenant_id,item_id,art,befehl_id,von,nachher)
   SELECT ${auth.tenantId},${source.itemId}::uuid,'einsatz',${key}::uuid,${auth.userId},${JSON.stringify({action:'mail_import_failed',mailbox:input.mailbox.toLowerCase(),graphMessageId:input.mail.id,reason:input.reason})}::jsonb
   WHERE NOT EXISTS(SELECT 1 FROM public.intake_event WHERE tenant_id=${auth.tenantId} AND befehl_id=${key}::uuid) RETURNING id`);
  if(added.length)await tx.execute(sql`UPDATE public.intake_item SET kennzeichen=CASE WHEN ${MAIL_IMPORT_COPY.failed}=ANY(kennzeichen) THEN kennzeichen ELSE array_append(kennzeichen,${MAIL_IMPORT_COPY.failed}) END,version=version+1 WHERE tenant_id=${auth.tenantId} AND id=${source.itemId}::uuid`);
  const failures=await tx.execute<{von:string}>(sql`SELECT von FROM public.intake_event WHERE tenant_id=${auth.tenantId} AND item_id=${source.itemId}::uuid AND art='einsatz' AND nachher->>'action'='mail_import_failed' ORDER BY zeit,id`);
  if(!failures.length)throw Error('INTAKE_MAIL_FAILURE_RECEIPT_REQUIRED');
  let taskMissing=false;
  if(failures.length>=3){try{await withTenantSavepoint(tx,async nested=>{
   const taskId=await createTask(nested,auth,{itemId:source.itemId,key:intakeMailIdentity(source.itemId+':mail-import-failure-task'),graphId:input.mail.id,actors:failures.map(row=>row.von),reason:input.reason}),bindKey=intakeMailIdentity(source.itemId+':mail-import-failure-task-binding');
   await nested.execute(sql`INSERT INTO public.intake_event(tenant_id,item_id,art,befehl_id,von,nachher) SELECT ${auth.tenantId},${source.itemId}::uuid,'einsatz',${bindKey}::uuid,${auth.userId},${JSON.stringify({action:'mail_import_failure_task',taskId})}::jsonb WHERE NOT EXISTS(SELECT 1 FROM public.intake_event WHERE tenant_id=${auth.tenantId} AND befehl_id=${bindKey}::uuid)`);
   const bound=await nested.execute(sql`SELECT id FROM public.intake_event WHERE tenant_id=${auth.tenantId} AND item_id=${source.itemId}::uuid AND befehl_id=${bindKey}::uuid AND nachher->>'action'='mail_import_failure_task' AND nachher->>'taskId'=${taskId}`);
   if(bound.length!==1)throw Error('INTAKE_MAIL_FAILURE_TASK_RECEIPT_REQUIRED');
  });}catch(error){console.error('[INTAKE_MAIL_FAILURE_TASK_PENDING]',error instanceof Error?error.name:'UnknownError');taskMissing=true;}}
  return {code:'OK' as const,itemId:source.itemId,attempts:failures.length,taskMissing};
 });}catch(error){console.error('[INTAKE_MAIL_FAILURE_PARK_FAILED]',error instanceof Error?error.name:'UnknownError');return {code:'UNAVAILABLE' as const};}
}

/** Explicit retries include failed originals older than the mailbox watermark. */
export async function readFailedIntakeMailImports(auth:AuthorizationSnapshot,mailbox:string){
 if(!canSynchronizeIntakeMailbox(auth))return {code:'FORBIDDEN' as const};
 try{return await withPrivilegedTenantTransaction(auth,async tx=>{
  const rows=await tx.execute<{id:string;failure:MailImportFailure}>(sql`WITH projected AS MATERIALIZED (
   SELECT source.graph_message_id AS id,source.empfangen_am AS at,source.id AS item_id,${mailImportFailureProjection()} AS failure FROM public.intake_item source
   WHERE source.tenant_id=${auth.tenantId} AND source.kanal='mail' AND ${MAIL_IMPORT_COPY.failed}=ANY(source.kennzeichen))
   SELECT id,failure FROM projected WHERE failure->>'mailbox'=${mailbox.toLowerCase()} OR failure->>'state'='SOURCE_INCOMPLETE' ORDER BY at NULLS LAST,item_id LIMIT 500`);
  if(rows.some(row=>!row.id||!row.failure||row.failure.state!=='FAILED'||row.failure.graphMessageId!==row.id||!row.failure.reason||row.failure.attempts===null||row.failure.attempts<1))throw Error('INTAKE_MAIL_FAILURE_SOURCE_INCOMPLETE');
  return {code:'OK' as const,data:rows.map(row=>({id:row.id}))};
 });}catch(error){console.error('[INTAKE_MAIL_FAILURES_READ_FAILED]',error instanceof Error?error.name:'UnknownError');return {code:'UNAVAILABLE' as const};}
}

async function clearMailFailureFlag(tx:PrivilegedTenantTransaction,auth:AuthorizationSnapshot,itemId:string){
 await tx.execute(sql`UPDATE public.intake_item SET kennzeichen=array_remove(kennzeichen,${MAIL_IMPORT_COPY.failed}),version=version+1 WHERE tenant_id=${auth.tenantId} AND id=${itemId}::uuid AND ${MAIL_IMPORT_COPY.failed}=ANY(kennzeichen)`);
}
