import 'server-only';
import {sql} from 'drizzle-orm';
import type {PrivilegedTenantTransaction} from './privilegedDb';
import type {CommunicationDocument} from './communicationDocumentPort';

type Actor={tenantId:string;userId:string};
export async function quoteHasPreparedDocument(tx:PrivilegedTenantTransaction,tenantId:string,quoteId:string,edition:number){
 const rows=await tx.execute(sql`SELECT id FROM public.events WHERE tenant_id=${tenantId} AND event_type='COMMUNICATION_DOCUMENT_PREPARED_V1' AND payload->'document'->>'id'=${quoteId} AND payload->'document'->>'edition'=${String(edition)} LIMIT 1`);return rows.length===1;
}
export async function readQuoteSentDocument(tx:PrivilegedTenantTransaction,actor:Actor,requestId:string,quoteId:string){
 const rows=await tx.execute<{document:CommunicationDocument;sentAt:string;threadId:string}>(sql`SELECT sent.payload->'document' AS document,sent.created_at::text AS "sentAt",thread.id::text AS "threadId" FROM public.events sent
 JOIN public.communication_threads thread ON thread.tenant_id=sent.tenant_id AND thread.id::text=sent.payload->>'threadId' AND thread.source=${'MS_GRAPH_OUT:'+requestId} AND thread.status='sent' AND thread.created_by=${actor.userId}::uuid
 WHERE sent.tenant_id=${actor.tenantId} AND sent.user_id=${actor.userId}::uuid AND sent.event_type='COMMUNICATION_DOCUMENT_SENT_V1' AND sent.correlation_id=${requestId}::uuid AND sent.payload->'document'->>'id'=${quoteId}`);
 return rows.length===1?rows[0]:null;
}
/** Shared audit/rate facts stay behind the core port; modules retain their own rows. */
export async function readQuoteJournal<T>(tx:PrivilegedTenantTransaction,actor:Actor,clientEventId:string) {
  return tx.execute<{id:string;eventType:string;payload:T}>(sql`SELECT id,event_type AS "eventType",payload FROM public.events WHERE tenant_id=${actor.tenantId} AND user_id=${actor.userId}::uuid AND client_event_id=${clientEventId}::uuid`);
}
export async function quoteJournalActorIsActive(tx:PrivilegedTenantTransaction,actor:Actor) {
  const rows=await tx.execute(sql`SELECT id FROM public.app_users WHERE tenant_id=${actor.tenantId} AND id=${actor.userId}::uuid AND active IS TRUE FOR SHARE`);
  return rows.length===1;
}
export async function appendQuoteJournal(tx:PrivilegedTenantTransaction,actor:Actor,input:{id:string;type:'QUOTE_LIFECYCLE_V04'|'QUOTE_SETTINGS_UPDATED_V04'|'QUOTE_CALCULATION_V04';clientEventId:string;correlationId:string;version:number|null;description:string;payload:Record<string,unknown>}) {
  if (!await quoteJournalActorIsActive(tx,actor)) throw Error('QUOTE_JOURNAL_ACTOR_INACTIVE');
  await tx.execute(sql`INSERT INTO public.events(id,tenant_id,event_type,user_id,client_event_id,event_schema_version,correlation_id,aggregate_version,status,description,payload)
    VALUES(${input.id},${actor.tenantId},${input.type},${actor.userId}::uuid,${input.clientEventId}::uuid,1,${input.correlationId}::uuid,${input.version},'success',${input.description},${JSON.stringify(input.payload)}::jsonb)`);
}
export async function readQuoteCurrentRate(tx:PrivilegedTenantTransaction,tenantId:string) {
  const rates=await tx.execute<{hourlyRateCents:number;integrity_ok:boolean}>(sql`SELECT hourly_rate_cents::float8 AS "hourlyRateCents",integrity_ok FROM private.v_extra_work_current_rate_v1 WHERE tenant_id=${tenantId} LIMIT 2`);
  if (rates.length>1||rates.some(rate=>rate.integrity_ok!==true||!Number.isSafeInteger(rate.hourlyRateCents)||rate.hourlyRateCents<1)) throw Error('QUOTE_RATE_INVALID');
  return rates[0]?.hourlyRateCents??null;
}
