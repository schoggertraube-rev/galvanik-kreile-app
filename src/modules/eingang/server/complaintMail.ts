import 'server-only';
import {sql} from 'drizzle-orm';
import {hasAuthorizationArea,type AuthorizationSnapshot} from '@/lib/server/authorization';
import type {PrivilegedTenantTransaction} from '@/lib/server/privilegedDb';

export async function readComplaintPhotoMailSource(tx:PrivilegedTenantTransaction,auth:AuthorizationSnapshot,input:{itemId:string;version:number;clientRequestId?:string}){
 if(!['eingang','mails','kunden'].every(area=>hasAuthorizationArea(auth,area as 'eingang'|'mails'|'kunden')))throw Error('COMPLAINT_PHOTO_MAIL_FORBIDDEN');
 const [source]=await tx.execute<{id:string;version:number;customerId:string|null;graphId:string|null;sender:string|null;channel:string;direction:string;open:string[];usage:string}>(sql`SELECT id::text,version,kunde_id AS "customerId",graph_message_id AS "graphId",absender_adresse AS sender,kanal AS channel,richtung AS direction,anliegen_offen AS open,einsatz AS usage FROM public.intake_item WHERE tenant_id=${auth.tenantId} AND id=${input.itemId}::uuid FOR UPDATE`);
 if(!source||source.channel!=='mail'||source.direction!=='rein'||!source.customerId||!source.graphId||!source.sender||source.usage!=='offen'||!source.open.includes('reklamation'))throw Error('COMPLAINT_PHOTO_MAIL_SOURCE_INVALID');
 const originals=await tx.execute<{sha256:string}>(sql`SELECT file.sha256 FROM public.intake_file file WHERE file.tenant_id=${auth.tenantId} AND file.item_id=${input.itemId}::uuid AND file.art='mime'
 AND EXISTS(SELECT 1 FROM public.intake_event receipt WHERE receipt.tenant_id=file.tenant_id AND receipt.item_id=file.item_id AND receipt.art='original_gespeichert' AND receipt.nachher->>'fileId'=file.id::text AND receipt.nachher->>'sha256'=file.sha256)
 AND EXISTS(SELECT 1 FROM public.intake_event imported WHERE imported.tenant_id=file.tenant_id AND imported.item_id=file.item_id AND imported.nachher->>'action'='mail_import_complete' AND imported.nachher->'fileIds' ? file.id::text)`);
 if(originals.length!==1)throw Error('COMPLAINT_PHOTO_MAIL_ORIGINAL_MISSING');
 const photos=await tx.execute(sql`SELECT file.id FROM public.intake_file file WHERE file.tenant_id=${auth.tenantId} AND file.item_id=${input.itemId}::uuid AND file.mime LIKE 'image/%'
 AND EXISTS(SELECT 1 FROM public.intake_event receipt WHERE receipt.tenant_id=file.tenant_id AND receipt.item_id=file.item_id AND receipt.art='original_gespeichert' AND receipt.nachher->>'fileId'=file.id::text AND receipt.nachher->>'sha256'=file.sha256) LIMIT 1`);
 if(photos.length)throw Error('COMPLAINT_PHOTO_MAIL_PHOTOS_ALREADY_PRESENT');
 const prior=await tx.execute(sql`SELECT id FROM public.intake_event WHERE tenant_id=${auth.tenantId} AND item_id=${input.itemId}::uuid AND art='anliegen' AND nachher->>'action' IN ('reklamation.fotos_angefordert','reklamation.fotoanfrage_vorbereitet') AND nachher->>'customerId'=${source.customerId} AND nachher->>'sourceGraphId'=${source.graphId} AND (${input.clientRequestId??null}::uuid IS NULL OR befehl_id<>${input.clientRequestId??null}::uuid) LIMIT 1`);
 if(prior.length)throw Error('COMPLAINT_PHOTO_MAIL_ALREADY_REQUESTED');

 return {...source,originalSha256:originals[0].sha256};
}
export async function complaintPhotoMailReplay(tx:PrivilegedTenantTransaction,auth:AuthorizationSnapshot,input:{itemId:string;clientRequestId:string;intent:string;threadId:string}){
 const rows=await tx.execute(sql`SELECT id FROM public.intake_event WHERE tenant_id=${auth.tenantId} AND item_id=${input.itemId}::uuid AND art='anliegen' AND befehl_id=${input.clientRequestId}::uuid AND von=${auth.userId} AND nachher->>'action'='reklamation.fotos_angefordert' AND nachher->>'intent'=${input.intent} AND nachher->>'threadId'=${input.threadId}`);
 return rows.length===1;
}
export async function completeComplaintPhotoMail(tx:PrivilegedTenantTransaction,auth:AuthorizationSnapshot,input:{itemId:string;version:number;clientRequestId:string;intent:string;threadId:string;customerId:string;originalSha256:string}){
 const source=await readComplaintPhotoMailSource(tx,auth,input);if(source.version!==input.version||source.customerId!==input.customerId||source.originalSha256!==input.originalSha256)throw Error('COMPLAINT_PHOTO_MAIL_VERSION_CONFLICT');
 const changed=await tx.execute(sql`UPDATE public.intake_item SET version=version+1,geaendert_von=${auth.userId}::uuid,geaendert_am=statement_timestamp(),updated_at=statement_timestamp() WHERE tenant_id=${auth.tenantId} AND id=${input.itemId}::uuid AND version=${input.version} RETURNING id`);
 if(changed.length!==1)throw Error('COMPLAINT_PHOTO_MAIL_VERSION_CONFLICT');
 await tx.execute(sql`INSERT INTO public.intake_event(tenant_id,item_id,art,befehl_id,von,vorher,nachher) VALUES(${auth.tenantId},${input.itemId}::uuid,'anliegen',${input.clientRequestId}::uuid,${auth.userId},${JSON.stringify({version:input.version})}::jsonb,${JSON.stringify({action:'reklamation.fotos_angefordert',version:input.version+1,threadId:input.threadId,customerId:input.customerId,sourceGraphId:source.graphId,originalSha256:input.originalSha256,intent:input.intent})}::jsonb)`);
}

/** Reserve the same original under its row lock before the provider call. Different keys cannot send twice. */
export async function prepareComplaintPhotoMail(tx:PrivilegedTenantTransaction,auth:AuthorizationSnapshot,input:{itemId:string;version:number;clientRequestId:string;customerId:string;originalSha256:string;graphId:string;sender:string;intent:string}){
 const source=await readComplaintPhotoMailSource(tx,auth,input);
 if(source.version!==input.version||source.customerId!==input.customerId||source.originalSha256!==input.originalSha256||source.graphId!==input.graphId||source.sender!==input.sender)return false;
 await tx.execute(sql`INSERT INTO public.intake_event(tenant_id,item_id,art,befehl_id,von,nachher) VALUES(${auth.tenantId},${input.itemId}::uuid,'anliegen',${input.clientRequestId}::uuid,${auth.userId},${JSON.stringify({action:'reklamation.fotoanfrage_vorbereitet',customerId:source.customerId,sourceGraphId:source.graphId,intent:input.intent})}::jsonb)`);
 return true;
}
