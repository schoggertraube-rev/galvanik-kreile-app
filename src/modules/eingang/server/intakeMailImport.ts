import 'server-only';
import {createHash} from 'node:crypto';
import {sql} from 'drizzle-orm';
import {hasAuthorizationArea,type AuthorizationSnapshot} from '@/lib/server/authorization';
import {withPrivilegedTenantTransaction} from '@/lib/server/privilegedDb';
import {createAdminClient} from '@/lib/supabase/admin';
import {recognizeNoteConcerns} from '../captureContract';
import {prepareIntakeFile,finishIntakeFile} from './intakeFile';

type Mail={id:string;internetMessageId:string|null;subject:string;senderName:string;senderAddress:string;receivedAt:string;body:string};
type Original={key:string;name:string;mime:string;bytes:Uint8Array};
export function intakeMailIdentity(value:string){const b=createHash('sha256').update(value).digest().subarray(0,16);b[6]=(b[6]&15)|80;b[8]=(b[8]&63)|128;const h=b.toString('hex');return `${h.slice(0,8)}-${h.slice(8,12)}-${h.slice(12,16)}-${h.slice(16,20)}-${h.slice(20)}`;}

/** One Graph identity, one existing intake, and the existing original-file writer. */
export async function importIntakeGraphMail(auth:AuthorizationSnapshot,mail:Mail,originals:Original[]){
 if(!hasAuthorizationArea(auth,'eingang')||!hasAuthorizationArea(auth,'mails'))return {code:'FORBIDDEN' as const,message:'Mail-Import benötigt Eingang und Mails.'};
 if(!mail.id||mail.id.length>1024||!Number.isFinite(Date.parse(mail.receivedAt))||mail.body.length>20000||!originals.length)return {code:'VALIDATION_ERROR' as const,message:'Mail oder unverändertes Original fehlt.'};
 try{
  const result=await withPrivilegedTenantTransaction(auth,async tx=>{
   const identity=mail.internetMessageId??mail.id;
   await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtextextended('mail-import:'||${auth.tenantId}||':'||${identity},0))`);
   const existing=await tx.execute<{id:string}>(sql`SELECT id::text FROM public.intake_item WHERE tenant_id=${auth.tenantId} AND (graph_message_id=${mail.id} OR (${mail.internetMessageId}::text IS NOT NULL AND internet_message_id=${mail.internetMessageId})) FOR UPDATE`);
   if(existing.length>1)throw Error('INTAKE_MAIL_IDENTITY_AMBIGUOUS');
   if(existing[0])return {itemId:existing[0].id,replayed:true};
   const id=intakeMailIdentity(auth.tenantId+':graph:'+mail.id),concerns=recognizeNoteConcerns(mail.subject+'\n'+mail.body).map(row=>row.id);
   const concernArray=sql`ARRAY[${sql.join(concerns.map(value=>sql`${value}`),sql`, `)}]::text[]`;
   await tx.execute(sql`INSERT INTO public.intake_item(id,tenant_id,client_key,kanal,richtung,quelle,erstellt_von,empfangen_am,absender_name,absender_adresse,betreff,text,gruppe_adresse,graph_message_id,internet_message_id,anliegen,anliegen_offen)
    VALUES(${id}::uuid,${auth.tenantId},${'graph:'+mail.id},'mail','rein','mailabruf',${auth.userId}::uuid,${mail.receivedAt}::timestamptz,${mail.senderName},${mail.senderAddress},${mail.subject},${mail.body},${mail.senderAddress.trim().toLowerCase()},${mail.id},${mail.internetMessageId},${concernArray},${concernArray})`);
   await tx.execute(sql`INSERT INTO public.intake_event(tenant_id,item_id,art,befehl_id,von,nachher) VALUES(${auth.tenantId},${id}::uuid,'angelegt',${id}::uuid,${auth.userId},${JSON.stringify({kanal:'mail',graphMessageId:mail.id,text:mail.body})}::jsonb)`);
   return {itemId:id,replayed:false};
  });
  for(const original of originals){
   const fileId=intakeMailIdentity(result.itemId+':original:'+original.key),sha256=createHash('sha256').update(original.bytes).digest('hex');
   const grant=await prepareIntakeFile({itemId:result.itemId,fileId,name:original.name,mime:original.mime,bytes:original.bytes.byteLength,sha256});
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
