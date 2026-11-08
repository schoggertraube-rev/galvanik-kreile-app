import 'server-only';
import {readComplaintPhotoReplyRelations} from './complaintMail';
import { sql } from 'drizzle-orm';
import { hasAuthorizationArea, type AuthorizationSnapshot } from '@/lib/server/authorization';
import type { PrivilegedTenantTransaction } from '@/lib/server/privilegedDb';

/** The complaint command calls this existing-module effect in its own transaction. */
async function completeComplaintSource(tx:PrivilegedTenantTransaction,auth:AuthorizationSnapshot,input:{itemId:string;version:number;clientKey:string;complaintId?:string;number?:string;customerId:string;orderId:string|null;threadId?:string;reason?:string;intent?:string}) {
  await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtextextended('intake:'||${auth.tenantId}||':'||${input.itemId},0))`);
  const rows=await tx.execute<{version:number;kanal:string;erstellt_von:string;kunde_id:string|null;vorgang_id:string|null;vorgang_art:string|null;einsatz:string;anliegen_offen:string[]}>(sql`SELECT version,kanal,erstellt_von::text,kunde_id,vorgang_id,vorgang_art,einsatz,anliegen_offen FROM public.intake_item WHERE tenant_id=${auth.tenantId} AND id=${input.itemId}::uuid FOR UPDATE`);
  const row=rows[0];
  if(rows.length!==1)throw Error('COMPLAINT_SOURCE_NOT_FOUND');
  if(!hasAuthorizationArea(auth,'mails')&&(row.kanal==='mail'||row.erstellt_von!==auth.userId||!hasAuthorizationArea(auth,'eingang')))throw Error('COMPLAINT_SOURCE_FORBIDDEN');
  if(row.version!==input.version||row.einsatz!=='offen'||!row.anliegen_offen.includes('reklamation'))throw Error('COMPLAINT_SOURCE_CHANGED');
  if(row.kunde_id&&row.kunde_id!==input.customerId||input.complaintId&&row.vorgang_id&&(row.vorgang_art!=='auftrag'||row.vorgang_id!==input.orderId))throw Error('COMPLAINT_SOURCE_TARGET_MISMATCH');
  const relations=await readComplaintPhotoReplyRelations(tx,auth,[input.itemId],true);
  const parent=relations.find(value=>value.replyId===input.itemId);
  const [origin]=await tx.execute<{parentId:string|null}>(sql`SELECT nachher->>'complaintThreadParent' AS "parentId" FROM public.intake_event WHERE tenant_id=${auth.tenantId} AND item_id=${input.itemId}::uuid AND art='angelegt' ORDER BY zeit,id LIMIT 1`);
  if(origin?.parentId&&parent?.rootId!==origin.parentId)throw Error('COMPLAINT_REPLY_THREAD_CHANGED');
  if(parent){
   if(parent.customerId!==input.customerId||input.complaintId&&parent.orderId&&parent.orderId!==input.orderId)throw Error('COMPLAINT_REPLY_TARGET_MISMATCH');
   const changed=await tx.execute(sql`UPDATE public.intake_item SET anliegen_offen=array_remove(anliegen_offen,'reklamation'),einsatz=CASE WHEN cardinality(array_remove(anliegen_offen,'reklamation'))>0 OR EXISTS(SELECT 1 FROM public.intake_item pending WHERE pending.tenant_id=${auth.tenantId} AND pending.antwort_auf_item=${parent.rootId}::uuid AND pending.sendestatus IN ('entwurf','sendet','unklar','fehler')) THEN 'offen' ELSE 'erledigt' END,kunde_id=${input.customerId},vorgang_art=CASE WHEN ${input.orderId}::text IS NOT NULL THEN 'auftrag' ELSE vorgang_art END,vorgang_id=coalesce(${input.orderId}::text,vorgang_id),zuordnung='hand',version=version+1,geaendert_von=${auth.userId}::uuid,geaendert_am=statement_timestamp(),updated_at=statement_timestamp() WHERE tenant_id=${auth.tenantId} AND id=${parent.rootId}::uuid AND version=${parent.rootVersion} AND einsatz='offen' AND anliegen_offen @> ARRAY['reklamation']::text[] RETURNING id`);
   if(changed.length!==1)throw Error('COMPLAINT_REPLY_ALREADY_COMPLETED');
   await tx.execute(sql`INSERT INTO public.intake_event(tenant_id,item_id,art,befehl_id,von,nachher) VALUES(${auth.tenantId},${parent.rootId}::uuid,'anliegen',${input.clientKey}::uuid,${auth.userId},${JSON.stringify({action:input.complaintId?'reklamation.aufgenommen_aus_fotoantwort':'reklamation.keine_reklamation_aus_fotoantwort',complaintId:input.complaintId,number:input.number,replyItemId:input.itemId,threadId:input.threadId,reason:input.reason})}::jsonb)`);
  }
  const concerns=row.anliegen_offen.filter(value=>value!=='reklamation');
  const waiting=await tx.execute(sql`SELECT id FROM public.intake_item WHERE tenant_id=${auth.tenantId} AND antwort_auf_item=${input.itemId}::uuid AND sendestatus IN ('entwurf','sendet','unklar','fehler') LIMIT 1`);
  const usage=concerns.length||waiting.length?'offen':'erledigt';
  await tx.execute(sql`UPDATE public.intake_item SET anliegen_offen=ARRAY[${sql.join(concerns.map(value=>sql`${value}`),sql`, `)}]::text[],einsatz=${usage},
    kunde_id=${input.customerId},vorgang_art=CASE WHEN ${input.orderId}::text IS NOT NULL THEN 'auftrag' ELSE vorgang_art END,vorgang_id=coalesce(${input.orderId}::text,vorgang_id),zuordnung='hand',geaendert_von=${auth.userId}::uuid,geaendert_am=statement_timestamp(),updated_at=statement_timestamp(),version=version+1
    WHERE tenant_id=${auth.tenantId} AND id=${input.itemId}::uuid AND version=${input.version}`);
  await tx.execute(sql`INSERT INTO public.intake_event(tenant_id,item_id,art,befehl_id,von,vorher,nachher)
    VALUES(${auth.tenantId},${input.itemId}::uuid,'anliegen',${input.clientKey}::uuid,${auth.userId},${JSON.stringify(row)}::jsonb,
    ${JSON.stringify({action:input.complaintId?'reklamation.aufgenommen':'reklamation.keine_reklamation',complaintId:input.complaintId,number:input.number,anliegenOffen:concerns,einsatz:usage,threadId:input.threadId,reason:input.reason,intent:input.intent})}::jsonb)`);
}

export async function recordIntakeComplaintEffect(tx:PrivilegedTenantTransaction,auth:AuthorizationSnapshot,input:{itemId:string;version:number;clientKey:string;complaintId:string;number:string;customerId:string;orderId:string}){return completeComplaintSource(tx,auth,input);}
export async function completeIntakeComplaintRejection(tx:PrivilegedTenantTransaction,auth:AuthorizationSnapshot,input:{itemId:string;version:number;clientKey:string;customerId:string;orderId:string|null;threadId:string;reason:string;intent:string}){return completeComplaintSource(tx,auth,input);}
