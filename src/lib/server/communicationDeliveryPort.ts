import 'server-only';
import {createHash,randomUUID} from 'node:crypto';
import {sql} from 'drizzle-orm';
import {hasAuthorizationArea,type AuthorizationSnapshot} from './authorization';
import {withPrivilegedTenantTransaction,type PrivilegedTenantTransaction} from './privilegedDb';
import {readMicrosoftGraphSentMailReference} from './microsoftGraph';
import {DELIVERY_FAILURE_COPY} from '@/ui/situationCatalog';

type DeliveryFailure={itemId:string;threadId:string;graphMessageId:string;sentGraphMessageId:string;clientRequestId:string;originalMessageId:string;recipient:string;originalSha256:string};
type DeliveryEvidence={customerId:string|null;graphMessageId:string;report:{source:string;status:string;originalSha256:string;originalMessageId:string|null;recipient:string|null}|null;proof_ok:boolean};
async function readIntakeDeliveryEvidence(tx:PrivilegedTenantTransaction,auth:AuthorizationSnapshot,itemId:string){
 const rows=await tx.execute<DeliveryEvidence>(sql`SELECT customer_id AS "customerId",graph_message_id AS "graphMessageId",report,proof_ok FROM private.v_intake_delivery_evidence_v1 WHERE tenant_id=${auth.tenantId} AND item_id=${itemId}`);
 if(!rows.length)return null;if(rows.length!==1)throw Error('DELIVERY_ORIGINAL_AMBIGUOUS');const row=rows[0];
 if(!row.report)return null;
 if(!row.proof_ok||row.report.source!=='original_mime'||!['failed','other','invalid'].includes(row.report.status)||!/^[a-f0-9]{64}$/.test(row.report.originalSha256)||!row.graphMessageId)throw Error('DELIVERY_ORIGINAL_PROOF_INVALID');
 return row;
}
function eventKey(tenantId:string,itemId:string,threadId:string){const h=createHash('sha256').update(JSON.stringify(['delivery-failure',tenantId,itemId,threadId])).digest('hex');return h.slice(0,8)+'-'+h.slice(8,12)+'-5'+h.slice(13,16)+'-8'+h.slice(17,20)+'-'+h.slice(20,32);}
const intent=(proof:DeliveryFailure)=>JSON.stringify([proof.itemId,proof.threadId,proof.graphMessageId,proof.sentGraphMessageId,proof.clientRequestId,proof.originalMessageId,proof.recipient,proof.originalSha256]);

/** Called after the one canonical import; the existing assignment writer links the proven customer. */
export async function qualifyImportedDeliveryFailure(auth:AuthorizationSnapshot,itemId:string,bind:(customerId:string)=>Promise<{code:string}>){
 if(!hasAuthorizationArea(auth,'mails')||!hasAuthorizationArea(auth,'eingang'))return {code:'FORBIDDEN' as const,message:DELIVERY_FAILURE_COPY.forbidden};
 try{
  const original=await withPrivilegedTenantTransaction(auth,tx=>readIntakeDeliveryEvidence(tx,auth,itemId));
  if(!original||original.report?.status==='other')return {code:'OK' as const,replayed:true};
  const report=original.report;
  if(!report||report.status!=='failed'||!report.originalMessageId||!report.recipient)return {code:'IN_KLAERUNG' as const,message:DELIVERY_FAILURE_COPY.unclear};
  const existing=await withPrivilegedTenantTransaction(auth,tx=>tx.execute<{threadId:string}>(sql`SELECT payload->>'threadId' AS "threadId" FROM public.events WHERE tenant_id=${auth.tenantId} AND event_type='COMMUNICATION_DELIVERY_FAILED_V1' AND payload->>'itemId'=${itemId}`));
  if(existing.length){const proofs=await withPrivilegedTenantTransaction(auth,tx=>readCommunicationDeliveryFailures(tx,auth,existing.map(row=>row.threadId)));if(proofs.length!==1||proofs[0].itemId!==itemId)throw Error('DELIVERY_PROOF_AMBIGUOUS');return {code:'OK' as const,replayed:true};}
  const sent=await readMicrosoftGraphSentMailReference(report.originalMessageId,report.recipient);
  if(sent.code!=='OK'||!sent.data.clientRequestId)return {code:'IN_KLAERUNG' as const,message:DELIVERY_FAILURE_COPY.unclear};
  const threads=await withPrivilegedTenantTransaction(auth,tx=>tx.execute<{id:string;customer_id:string}>(sql`SELECT id::text,customer_id FROM public.communication_threads WHERE tenant_id=${auth.tenantId} AND source=${'MS_GRAPH_OUT:'+sent.data.clientRequestId} AND status='sent'`));
  if(threads.length!==1)return {code:'IN_KLAERUNG' as const,message:DELIVERY_FAILURE_COPY.unclear};
  const thread=threads[0],linked=await bind(thread.customer_id);
  if(linked.code!=='OK')return {code:'CONFLICT' as const,message:DELIVERY_FAILURE_COPY.assignment};
  const proof:DeliveryFailure={itemId,threadId:thread.id,graphMessageId:original.graphMessageId,sentGraphMessageId:sent.data.graphMessageId,clientRequestId:sent.data.clientRequestId,originalMessageId:report.originalMessageId,recipient:report.recipient,originalSha256:report.originalSha256};
  return await withPrivilegedTenantTransaction(auth,async tx=>{
   const key=eventKey(auth.tenantId,itemId,thread.id);await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtextextended(${auth.tenantId+':delivery:'+key},0))`);
   const current=await readIntakeDeliveryEvidence(tx,auth,itemId);
   if(!current||current.customerId!==thread.customer_id||current.graphMessageId!==proof.graphMessageId||current.report?.status!=='failed'||current.report.originalSha256!==proof.originalSha256||current.report.originalMessageId!==proof.originalMessageId||current.report.recipient!==proof.recipient)throw Error('DELIVERY_ORIGINAL_CHANGED');
   const prior=await tx.execute<{payload:DeliveryFailure;status:string;event_type:string}>(sql`SELECT payload,status,event_type FROM public.events WHERE tenant_id=${auth.tenantId} AND client_event_id=${key}::uuid`);
   if(prior.length){if(prior.length!==1||prior[0].status!=='success'||prior[0].event_type!=='COMMUNICATION_DELIVERY_FAILED_V1'||intent(prior[0].payload)!==intent(proof))throw Error('DELIVERY_PROOF_KEY_CONFLICT');return {code:'OK' as const,replayed:true};}
   await tx.execute(sql`INSERT INTO public.events(id,tenant_id,event_type,description,status,user_id,client_event_id,correlation_id,event_schema_version,payload,created_at)
    VALUES(${randomUUID()},${auth.tenantId},'COMMUNICATION_DELIVERY_FAILED_V1',${DELIVERY_FAILURE_COPY.recorded},'success',${auth.userId}::uuid,${key}::uuid,${proof.clientRequestId}::uuid,1,${JSON.stringify(proof)}::jsonb,statement_timestamp())`);
   return {code:'OK' as const,replayed:false};
  });
 }catch(error){console.error('[COMMUNICATION_DELIVERY_QUALIFICATION_FAILED]',error instanceof Error?error.message:'UnknownError');return {code:'UNAVAILABLE' as const,message:DELIVERY_FAILURE_COPY.unavailable};}
}

/** One durable evidence reader used by notification, reminder and response projections. */
export async function readCommunicationDeliveryFailures(tx:PrivilegedTenantTransaction,auth:AuthorizationSnapshot,threadIds:readonly string[]){
 if(!threadIds.length)return [];
 const rows=await tx.execute<{payload:DeliveryFailure;status:string;event_schema_version:number;correlation_id:string;user_id:string|null;customer_id:string|null;source:string|null;thread_status:string|null;created_at:string}>(sql`
  SELECT event.payload,event.status,event.event_schema_version,event.correlation_id::text,event.user_id::text,thread.customer_id,thread.source,thread.status AS thread_status,(event.created_at AT TIME ZONE 'UTC')::text AS created_at
  FROM public.events event LEFT JOIN public.communication_threads thread ON thread.tenant_id=event.tenant_id AND thread.id::text=event.payload->>'threadId'
  WHERE event.tenant_id=${auth.tenantId} AND event.event_type='COMMUNICATION_DELIVERY_FAILED_V1' AND event.payload->>'threadId'=ANY(ARRAY[${sql.join(threadIds.map(id=>sql`${id}`),sql`, `)}]::text[]) ORDER BY event.created_at,event.id LIMIT 1001`);
 if(rows.length>1000)throw Error('DELIVERY_PROOF_LIMIT');
 if(!rows.length)return [];
 for(const row of rows){const proof=row.payload,original=await readIntakeDeliveryEvidence(tx,auth,proof.itemId);
  if(row.status!=='success'||row.event_schema_version!==1||!row.user_id||row.correlation_id!==proof.clientRequestId||row.source!=='MS_GRAPH_OUT:'+proof.clientRequestId||row.thread_status!=='sent'||!original||original.customerId!==row.customer_id||original.graphMessageId!==proof.graphMessageId||original.report?.status!=='failed'||original.report.originalSha256!==proof.originalSha256||original.report.originalMessageId!==proof.originalMessageId||original.report.recipient!==proof.recipient)throw Error('DELIVERY_FAILURE_PROOF_INVALID');
 }
 return rows.map(row=>({...row.payload,recordedAt:new Date(row.created_at).toISOString()}));
}
