import 'server-only';
import {readComplaintPhotoWaiting,readAbsentCommunicationSendKeys} from '@/lib/server/communicationPort';
import {sql} from 'drizzle-orm';
import {hasAuthorizationArea,type AuthorizationSnapshot} from '@/lib/server/authorization';
import type {PrivilegedTenantTransaction} from '@/lib/server/privilegedDb';

/** A new send key is allowed only after the common Sent Items writer proved the old send absent. */
async function unresolvedPreparation(tx:PrivilegedTenantTransaction,auth:AuthorizationSnapshot){
 const keys=await readAbsentCommunicationSendKeys(tx,auth);
 return sql`prepared.befehl_id::text <> ALL(ARRAY[${sql.join(keys.map(key=>sql`${key}`),sql`, `)}]::text[])`;
}

async function readComplaintMailBase(tx:PrivilegedTenantTransaction,auth:AuthorizationSnapshot,input:{itemId:string;version:number;clientRequestId?:string}){
 if(!['eingang','mails','kunden'].every(area=>hasAuthorizationArea(auth,area as 'eingang'|'mails'|'kunden')))throw Error('COMPLAINT_PHOTO_MAIL_FORBIDDEN');
 const [source]=await tx.execute<{id:string;version:number;customerId:string|null;graphId:string|null;sender:string|null;channel:string;direction:string;open:string[];usage:string}>(sql`SELECT id::text,version,kunde_id AS "customerId",graph_message_id AS "graphId",absender_adresse AS sender,kanal AS channel,richtung AS direction,anliegen_offen AS open,einsatz AS usage FROM public.intake_item WHERE tenant_id=${auth.tenantId} AND id=${input.itemId}::uuid FOR UPDATE`);
 if(!source||source.channel!=='mail'||source.direction!=='rein'||!source.customerId||!source.graphId||!source.sender)throw Error('COMPLAINT_PHOTO_MAIL_SOURCE_INVALID');
 const originals=await tx.execute<{sha256:string}>(sql`SELECT file.sha256 FROM public.intake_file file WHERE file.tenant_id=${auth.tenantId} AND file.item_id=${input.itemId}::uuid AND file.art='mime'
 AND EXISTS(SELECT 1 FROM public.intake_event receipt WHERE receipt.tenant_id=file.tenant_id AND receipt.item_id=file.item_id AND receipt.art='original_gespeichert' AND receipt.nachher->>'fileId'=file.id::text AND receipt.nachher->>'sha256'=file.sha256)
 AND EXISTS(SELECT 1 FROM public.intake_event imported WHERE imported.tenant_id=file.tenant_id AND imported.item_id=file.item_id AND imported.nachher->>'action'='mail_import_complete' AND imported.nachher->'fileIds' ? file.id::text)`);
 if(originals.length!==1)throw Error('COMPLAINT_PHOTO_MAIL_ORIGINAL_MISSING');
 return {...source,originalSha256:originals[0].sha256};
}
export async function readComplaintPhotoMailSource(tx:PrivilegedTenantTransaction,auth:AuthorizationSnapshot,input:{itemId:string;version:number;clientRequestId?:string}){
 const source=await readComplaintMailBase(tx,auth,input);if(source.usage!=='offen'||!source.open.includes('reklamation'))throw Error('COMPLAINT_PHOTO_MAIL_SOURCE_INVALID');
 const photos=await tx.execute(sql`SELECT file.id FROM public.intake_file file WHERE file.tenant_id=${auth.tenantId} AND file.item_id=${input.itemId}::uuid AND file.mime LIKE 'image/%'
 AND EXISTS(SELECT 1 FROM public.intake_event receipt WHERE receipt.tenant_id=file.tenant_id AND receipt.item_id=file.item_id AND receipt.art='original_gespeichert' AND receipt.nachher->>'fileId'=file.id::text AND receipt.nachher->>'sha256'=file.sha256) LIMIT 1`);
 if(photos.length)throw Error('COMPLAINT_PHOTO_MAIL_PHOTOS_ALREADY_PRESENT');
 const prior=await tx.execute(sql`SELECT prepared.id FROM public.intake_event prepared WHERE prepared.tenant_id=${auth.tenantId} AND prepared.item_id=${input.itemId}::uuid AND prepared.art='anliegen' AND prepared.nachher->>'action' IN ('reklamation.fotos_angefordert','reklamation.fotoanfrage_vorbereitet') AND prepared.nachher->>'customerId'=${source.customerId} AND prepared.nachher->>'sourceGraphId'=${source.graphId} AND (${input.clientRequestId??null}::uuid IS NULL OR prepared.befehl_id<>${input.clientRequestId??null}::uuid) AND (prepared.nachher->>'action'='reklamation.fotos_angefordert' OR ${await unresolvedPreparation(tx,auth)}) LIMIT 1`);
 if(prior.length)throw Error('COMPLAINT_PHOTO_MAIL_ALREADY_REQUESTED');

 return source;
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

/** Exact secured MIME references, not subject similarity or guessed customer matches. Read-only. */
export async function readComplaintPhotoReplyRelations(tx:PrivilegedTenantTransaction,auth:AuthorizationSnapshot,ids:readonly string[],includeCompleted=false){
 if(!ids.length||!hasAuthorizationArea(auth,'mails')||!hasAuthorizationArea(auth,'eingang'))return [];
 const rows=await tx.execute<{rootId:string;rootVersion:number;replyId:string;replyVersion:number;customerId:string;orderId:string|null;photoIds:string[]}>(sql`
 SELECT root.id::text AS "rootId",root.version AS "rootVersion",reply.id::text AS "replyId",reply.version AS "replyVersion",root.kunde_id AS "customerId",CASE WHEN root.vorgang_art='auftrag' THEN root.vorgang_id ELSE NULL END AS "orderId",
 ARRAY(SELECT photo.id::text FROM public.intake_file photo WHERE photo.tenant_id=reply.tenant_id AND photo.item_id=reply.id AND photo.mime LIKE 'image/%'
  AND EXISTS(SELECT 1 FROM public.intake_event secured WHERE secured.tenant_id=photo.tenant_id AND secured.item_id=photo.item_id AND secured.art='original_gespeichert' AND secured.nachher->>'fileId'=photo.id::text AND secured.nachher->>'sha256'=photo.sha256)
  AND EXISTS(SELECT 1 FROM public.intake_event complete WHERE complete.tenant_id=photo.tenant_id AND complete.item_id=photo.item_id AND complete.nachher->>'action'='mail_import_complete' AND complete.nachher->'fileIds' ? photo.id::text) ORDER BY photo.reihenfolge,photo.id) AS "photoIds"
 FROM public.intake_item root JOIN public.intake_item reply ON reply.tenant_id=root.tenant_id AND reply.id<>root.id AND reply.kunde_id=root.kunde_id
 JOIN public.intake_event original ON original.tenant_id=reply.tenant_id AND original.item_id=reply.id AND original.art='angelegt'
 WHERE root.tenant_id=${auth.tenantId} AND root.kanal='mail' AND reply.kanal='mail' AND root.richtung='rein' AND reply.richtung='rein' AND (${includeCompleted} OR root.einsatz='offen' AND root.anliegen_offen @> ARRAY['reklamation']::text[])
 AND root.internet_message_id IS NOT NULL AND original.nachher->'replyChain'->>'source'='original_mime' AND original.nachher->'replyChain'->>'status'='present'
 AND (original.nachher->'replyChain'->'inReplyTo' ? root.internet_message_id OR original.nachher->'replyChain'->'references' ? root.internet_message_id)
 AND EXISTS(SELECT 1 FROM public.intake_file mime JOIN public.intake_event secured ON secured.tenant_id=mime.tenant_id AND secured.item_id=mime.item_id AND secured.art='original_gespeichert' AND secured.nachher->>'fileId'=mime.id::text AND secured.nachher->>'sha256'=mime.sha256
   WHERE mime.tenant_id=reply.tenant_id AND mime.item_id=reply.id AND mime.art='mime' AND mime.sha256=original.nachher->'replyChain'->>'originalSha256'
   AND EXISTS(SELECT 1 FROM public.intake_event complete WHERE complete.tenant_id=mime.tenant_id AND complete.item_id=mime.item_id AND complete.nachher->>'action'='mail_import_complete' AND complete.nachher->'fileIds' ? mime.id::text))
 AND (reply.vorgang_id IS NULL OR reply.vorgang_art='auftrag' AND root.vorgang_art='auftrag' AND reply.vorgang_id=root.vorgang_id)
 AND (root.id=ANY(ARRAY[${sql.join(ids.map(id=>sql`${id}::uuid`),sql`, `)}]) OR reply.id=ANY(ARRAY[${sql.join(ids.map(id=>sql`${id}::uuid`),sql`, `)}]))
 ORDER BY reply.empfangen_am,reply.id,root.id`);
 const waiting=await readComplaintPhotoWaiting(tx,auth,[...new Set(rows.map(row=>row.rootId))]);
 const eligible=rows.filter(row=>row.photoIds.length>0&&waiting.has(row.rootId));
 // Ambiguous roots stay unassigned; every original remains accessible in its existing intake.
 return eligible.filter(row=>eligible.filter(other=>other.replyId===row.replyId).length===1);
}

/** A new mail inherits context only from one proven photo-request thread, never its subject. */
export async function readComplaintPhotoParentForMail(tx:PrivilegedTenantTransaction,auth:AuthorizationSnapshot,sender:string,chain:{source:string;status:string;inReplyTo:string[];references:string[]}){
 if(chain.source!=='original_mime'||chain.status!=='present')return null;
 const refs=[...new Set([...chain.inReplyTo,...chain.references])];if(!refs.length)return null;
 const roots=await tx.execute<{id:string;customerId:string;orderId:string|null}>(sql`SELECT id::text,kunde_id AS "customerId",CASE WHEN vorgang_art='auftrag' THEN vorgang_id ELSE NULL END AS "orderId" FROM public.intake_item WHERE tenant_id=${auth.tenantId} AND kanal='mail' AND richtung='rein' AND einsatz='offen' AND kunde_id IS NOT NULL AND lower(absender_adresse)=lower(${sender}) AND internet_message_id=ANY(ARRAY[${sql.join(refs.map(ref=>sql`${ref}`),sql`, `)}]::text[]) AND anliegen_offen @> ARRAY['reklamation']::text[]`);
 const waiting=await readComplaintPhotoWaiting(tx,auth,roots.map(row=>row.id));const unique=roots.filter(row=>waiting.has(row.id));return unique.length===1?unique[0]:null;
}

export async function readComplaintRejectionSource(tx:PrivilegedTenantTransaction,auth:AuthorizationSnapshot,input:{itemId:string;version:number;clientRequestId:string}){
 const source=await readComplaintMailBase(tx,auth,input);
 const proof=await tx.execute(sql`SELECT id FROM public.intake_event WHERE tenant_id=${auth.tenantId} AND item_id=${input.itemId}::uuid AND art='anliegen' AND befehl_id=${input.clientRequestId}::uuid AND von=${auth.userId} AND nachher->>'action'='reklamation.keine_reklamation'`);
 if(!proof.length&&(source.usage!=='offen'||!source.open.includes('reklamation')||source.version!==input.version))throw Error('COMPLAINT_RESPONSE_SOURCE_CHANGED');
 if(!proof.length){const parents=await readComplaintPhotoReplyRelations(tx,auth,[input.itemId],true);for(const parent of parents.filter(row=>row.replyId===input.itemId)){const [root]=await tx.execute<{usage:string;open:string[]}>(sql`SELECT einsatz AS usage,anliegen_offen AS open FROM public.intake_item WHERE tenant_id=${auth.tenantId} AND id=${parent.rootId}::uuid FOR UPDATE`);if(!root||root.usage!=='offen'||!root.open.includes('reklamation'))throw Error('COMPLAINT_RESPONSE_ROOT_COMPLETED');}}
 const photos=await tx.execute(sql`SELECT file.id FROM public.intake_file file WHERE file.tenant_id=${auth.tenantId} AND file.item_id=${input.itemId}::uuid AND file.mime LIKE 'image/%' AND EXISTS(SELECT 1 FROM public.intake_event receipt WHERE receipt.tenant_id=file.tenant_id AND receipt.item_id=file.item_id AND receipt.art='original_gespeichert' AND receipt.nachher->>'fileId'=file.id::text AND receipt.nachher->>'sha256'=file.sha256)`);
 if(!photos.length)throw Error('COMPLAINT_RESPONSE_PHOTOS_MISSING');
 return source;
}
export async function prepareComplaintRejection(tx:PrivilegedTenantTransaction,auth:AuthorizationSnapshot,input:{itemId:string;version:number;clientRequestId:string;intent:string}){
 const source=await readComplaintRejectionSource(tx,auth,input);
 const prior=await tx.execute(sql`SELECT prepared.id FROM public.intake_event prepared WHERE prepared.tenant_id=${auth.tenantId} AND prepared.item_id=${input.itemId}::uuid AND prepared.nachher->>'action'='reklamation.antwort_vorbereitet' AND prepared.befehl_id<>${input.clientRequestId}::uuid AND ${await unresolvedPreparation(tx,auth)} LIMIT 1`);if(prior.length)throw Error('COMPLAINT_RESPONSE_ALREADY_PENDING');
 await tx.execute(sql`INSERT INTO public.intake_event(tenant_id,item_id,art,befehl_id,von,nachher) VALUES(${auth.tenantId},${input.itemId}::uuid,'anliegen',${input.clientRequestId}::uuid,${auth.userId},${JSON.stringify({action:'reklamation.antwort_vorbereitet',intent:input.intent,customerId:source.customerId,sourceGraphId:source.graphId})}::jsonb)`);return true;
}
export async function complaintRejectionReplay(tx:PrivilegedTenantTransaction,auth:AuthorizationSnapshot,input:{itemId:string;clientRequestId:string;intent:string;threadId:string}){
 const rows=await tx.execute(sql`SELECT id FROM public.intake_event WHERE tenant_id=${auth.tenantId} AND item_id=${input.itemId}::uuid AND befehl_id=${input.clientRequestId}::uuid AND von=${auth.userId} AND nachher->>'action'='reklamation.keine_reklamation' AND nachher->>'intent'=${input.intent} AND nachher->>'threadId'=${input.threadId}`);return rows.length===1;
}
