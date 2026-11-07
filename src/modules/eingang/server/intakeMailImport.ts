import 'server-only';
import {createHash} from 'node:crypto';
import {sql} from 'drizzle-orm';
import {hasAuthorizationArea,type AuthorizationSnapshot} from '@/lib/server/authorization';
import {withPrivilegedTenantTransaction,type PrivilegedTenantTransaction} from '@/lib/server/privilegedDb';
import {createAdminClient} from '@/lib/supabase/admin';
import {recognizeNoteConcerns} from '../captureContract';
import {prepareIntakeFile,finishIntakeFile} from './intakeFile';
import {bindIntakeOriginalToOrder} from './intakeOrderBinding';
import {assignInTransaction,assignIntakeCustomer} from './intakeAssignment';

type Mail={id:string;internetMessageId:string|null;subject:string;senderName:string;senderAddress:string;receivedAt:string;body:string};
type Original={key:string;name:string;mime:string;bytes:Uint8Array};
export function intakeMailIdentity(value:string){const b=createHash('sha256').update(value).digest().subarray(0,16);b[6]=(b[6]&15)|80;b[8]=(b[8]&63)|128;const h=b.toString('hex');return `${h.slice(0,8)}-${h.slice(8,12)}-${h.slice(12,16)}-${h.slice(16,20)}-${h.slice(20)}`;}

/** One Graph identity, one existing intake, and the existing original-file writer. */
export async function importIntakeGraphMail(auth:AuthorizationSnapshot,mail:Mail,originals:Original[],readPrevious?:(tx:PrivilegedTenantTransaction,auth:AuthorizationSnapshot,graphId:string)=>Promise<{customerId:string|null;orderId:string|null}|null>){
 if(!hasAuthorizationArea(auth,'eingang')||!hasAuthorizationArea(auth,'mails'))return {code:'FORBIDDEN' as const,message:'Mail-Import benötigt Eingang und Mails.'};
 if(!mail.id||mail.id.length>1024||!Number.isFinite(Date.parse(mail.receivedAt))||mail.body.length>20000||!originals.length)return {code:'VALIDATION_ERROR' as const,message:'Mail oder unverändertes Original fehlt.'};
 try{
  const result=await withPrivilegedTenantTransaction(auth,async tx=>{
   const identity=mail.internetMessageId??mail.id;
   await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtextextended('mail-import:'||${auth.tenantId}||':'||${identity},0))`);
   const existing=await tx.execute<{id:string}>(sql`SELECT id::text FROM public.intake_item WHERE tenant_id=${auth.tenantId} AND (graph_message_id=${mail.id} OR (${mail.internetMessageId}::text IS NOT NULL AND internet_message_id=${mail.internetMessageId})) FOR UPDATE`);
   if(existing.length>1)throw Error('INTAKE_MAIL_IDENTITY_AMBIGUOUS');
   if(existing[0])return {itemId:existing[0].id,replayed:true};
   const previous=readPrevious?await readPrevious(tx,auth,mail.id):null;
   const id=intakeMailIdentity(auth.tenantId+':graph:'+mail.id),concerns=recognizeNoteConcerns(mail.subject+'\n'+mail.body).map(row=>row.id);
   const concernArray=sql`ARRAY[${sql.join(concerns.map(value=>sql`${value}`),sql`, `)}]::text[]`;
   await tx.execute(sql`INSERT INTO public.intake_item(id,tenant_id,client_key,kanal,richtung,quelle,erstellt_von,empfangen_am,absender_name,absender_adresse,betreff,text,gruppe_adresse,graph_message_id,internet_message_id,anliegen,anliegen_offen,kunde_id,vorgang_art,vorgang_id,zuordnung)
    VALUES(${id}::uuid,${auth.tenantId},${'graph:'+mail.id},'mail','rein','mailabruf',${auth.userId}::uuid,${mail.receivedAt}::timestamptz,${mail.senderName},${mail.senderAddress},${mail.subject},${mail.body},${mail.senderAddress.trim().toLowerCase()},${mail.id},${mail.internetMessageId},${concernArray},${concernArray},${previous?.customerId??null},${previous?.orderId?'auftrag':null},${previous?.orderId??null},${previous?.customerId?'hand':'offen'})`);
   await tx.execute(sql`INSERT INTO public.intake_event(tenant_id,item_id,art,befehl_id,von,nachher) VALUES(${auth.tenantId},${id}::uuid,'angelegt',${id}::uuid,${auth.userId},${JSON.stringify({kanal:'mail',graphMessageId:mail.id,text:mail.body,...(previous?.customerId?{importedCorrespondence:previous}:{})})}::jsonb)`);
   return {itemId:id,replayed:false};
  });
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
  return {code:'OK' as const,...result};
 }catch(error){const cause=error instanceof Error&&error.cause&&typeof error.cause==='object'?error.cause as Record<string,unknown>:null;console.error('[INTAKE_MAIL_IMPORT_FAILED]',{code:typeof cause?.code==='string'?cause.code:'INTAKE_MAIL_IMPORT_FAILED',constraint:typeof cause?.constraint_name==='string'?cause.constraint_name:undefined});return {code:'UNAVAILABLE' as const,message:'Mail-Original noch nicht vollständig gesichert · beim erneuten Abruf wird derselbe Eingang fortgesetzt.'};}
}

/** Old Outlook buttons adapt to the same assignment writers; originals are never copied. */
export async function linkImportedMail(auth:AuthorizationSnapshot,input:{itemId:string;targetType:'CUSTOMER'|'ORDER';targetId:string},readTarget:(tx:PrivilegedTenantTransaction,auth:AuthorizationSnapshot,type:'CUSTOMER'|'ORDER',id:string)=>Promise<{customerId:string;orderId:string|null}|null>,readCustomer:Parameters<typeof assignIntakeCustomer>[1]){
 if(!hasAuthorizationArea(auth,'eingang')||!hasAuthorizationArea(auth,'mails')||!['CUSTOMER','ORDER'].includes(input.targetType)||!input.targetId||input.targetId.length>128)return {code:'FORBIDDEN' as const,message:'Zuordnen benötigt Eingang, Mails und ein gültiges Ziel.'};
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
