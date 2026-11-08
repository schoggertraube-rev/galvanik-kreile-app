import 'server-only';
import {sql} from 'drizzle-orm';
import {withPrivilegedTenantTransaction,type PrivilegedTenantTransaction} from './privilegedDb';
import {hasAuthorizationArea,type AuthorizationSnapshot} from './authorization';
import type {CommunicationDocument} from './communicationDocumentPort';

type Actor={tenantId:string;userId:string};
export function actorStatisticsScope(actor:Actor&Pick<AuthorizationSnapshot,"role"|"areas">,input:unknown){
 if(!input||typeof input!=='object'||Array.isArray(input)||Object.keys(input).some(key=>!['from','through','all'].includes(key)))return {code:'VALIDATION_ERROR' as const,message:'Statistikzeitraum ist ungueltig.'};
 const value=input as {from?:unknown;through?:unknown;all?:unknown};
 if(typeof value.from!=='string'||typeof value.through!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(value.from)||!/^\d{4}-\d{2}-\d{2}$/.test(value.through)||value.all!==undefined&&typeof value.all!=='boolean')return {code:'VALIDATION_ERROR' as const,message:'Zeitraum oder Statistikbereich fehlt.'};
 const start=Date.parse(value.from),end=Date.parse(value.through);
 if(!Number.isFinite(start)||!Number.isFinite(end)||new Date(start).toISOString().slice(0,10)!==value.from||new Date(end).toISOString().slice(0,10)!==value.through||end<start||end-start>366*86400000)return {code:'VALIDATION_ERROR' as const,message:'Zeitraum muss zwischen einem und 367 Tagen liegen.'};
 if(value.all===true&&!hasAuthorizationArea(actor,'statistik_alle'))return {code:'FORBIDDEN' as const,message:'Personenuebergreifende Statistik benoetigt das Recht Statistik aller Personen.'};
 return {code:'OK' as const,from:value.from,through:value.through,all:value.all===true};
}
export type ActorStatisticRow={userId:string|null;name:string|null;kind:string;action:string;events:number;cases:number};
export async function readPublicCaseActorStatistics(tx:PrivilegedTenantTransaction,actor:Actor&Pick<AuthorizationSnapshot,"role"|"areas">,input:unknown){
 const scope=actorStatisticsScope(actor,input);if(scope.code!=='OK')return scope;
 const rows=await tx.execute<ActorStatisticRow>(sql`SELECT event.user_id::text AS "userId",person.full_name AS name,target.kind,${caseActorAction} AS action,count(*)::integer AS events,count(DISTINCT target.id)::integer AS cases
  FROM public.events event LEFT JOIN public.app_users person ON person.tenant_id=event.tenant_id AND person.id=event.user_id
  CROSS JOIN LATERAL(VALUES ('order',CASE WHEN event.event_type NOT LIKE 'COMPLAINT_%' THEN event.order_id END),('quote',CASE WHEN event.event_type LIKE 'QUOTE_%' THEN event.payload->>'quoteId' END),('complaint',CASE WHEN event.event_type LIKE 'COMPLAINT_%' THEN event.payload->>'complaintId' END)) target(kind,id)
  WHERE event.tenant_id=${actor.tenantId} AND event.status='success' AND target.id IS NOT NULL AND (${scope.all} OR event.user_id=${actor.userId}::uuid)
  AND event.created_at>=(${scope.from}::date::timestamp AT TIME ZONE 'Europe/Berlin') AND event.created_at<((${scope.through}::date+1)::timestamp AT TIME ZONE 'Europe/Berlin')
  GROUP BY event.user_id,person.full_name,target.kind,${caseActorAction} ORDER BY event.user_id,target.kind,action`);
 return {code:'OK' as const,rows:[...rows]};
}
const caseActorAction=sql`event.event_type||CASE WHEN event.payload->>'action' IN ('accept','sent','reject','extend','conditional','aufnehmen','entscheiden','bewerten','nacharbeit','gutschrift','abschliessen','zurueckziehen','wieder_oeffnen') THEN ':'||(event.payload->>'action') ELSE '' END`;
export type CaseActorEvidence={eventId:string;userId:string|null;name:string|null;at:string;action:string;mailSender:string|null};
export type CaseActorTrace={createdBy:CaseActorEvidence|null;lastActor:CaseActorEvidence|null};
/** Batched, value-free audit facts. Domain callers authorize and validate their own objects first. */
export async function readCaseActorTraces(tx:PrivilegedTenantTransaction,actor:Actor,targets:readonly {kind:'order'|'quote'|'complaint';id:string;version:number}[]){
 if(targets.length>1000||targets.some(row=>!['order','quote','complaint'].includes(row.kind)||typeof row.id!=='string'||!row.id||row.id.length>128||!Number.isSafeInteger(row.version)||row.version<1))throw Error('CASE_ACTOR_TARGET_INVALID');
 if(!targets.length)return new Map<string,CaseActorTrace>();
 const refs=sql.join(targets.map(row=>sql`(${row.kind}::text,${row.id}::text,${row.version}::integer)`),sql`, `);
 const edge=sql`SELECT jsonb_build_object('eventId',event.id::text,'userId',event.user_id::text,'name',person.full_name,'at',event.created_at,
  'action',${caseActorAction},
  'mailSender',CASE WHEN event.payload->'receipt'->'mailActor'->>'kind'='mail' THEN event.payload->'receipt'->'mailActor'->>'sender' END) AS value
  FROM public.events event LEFT JOIN public.app_users person ON person.tenant_id=event.tenant_id AND person.id=event.user_id
  WHERE event.tenant_id=${actor.tenantId} AND event.status='success' AND (event.aggregate_version IS NULL OR event.aggregate_version<=target.version)
  AND (target.kind='order' AND event.order_id=target.id AND event.event_type NOT LIKE 'COMPLAINT_%'
   OR target.kind='quote' AND event.payload->>'quoteId'=target.id AND event.event_type LIKE 'QUOTE_%'
   OR target.kind='complaint' AND event.payload->>'complaintId'=target.id AND event.event_type LIKE 'COMPLAINT_%')`;
 const rows=await tx.execute<{kind:string;id:string;createdBy:CaseActorEvidence|null;lastActor:CaseActorEvidence|null}>(sql`SELECT target.kind,target.id,first.value AS "createdBy",last.value AS "lastActor" FROM (VALUES ${refs}) AS target(kind,id,version)
  LEFT JOIN LATERAL(${edge} ORDER BY event.aggregate_version ASC NULLS LAST,(event.event_type IN ('QUOTE_CREATED_V1','ORDER_INTAKE_CREATED_V1')) DESC,event.created_at,event.id LIMIT 1) first ON true
  LEFT JOIN LATERAL(${edge} ORDER BY event.aggregate_version DESC NULLS LAST,(event.event_type='QUOTE_LIFECYCLE_V04') DESC,event.created_at DESC,event.id DESC LIMIT 1) last ON true`);
 return new Map(rows.map(row=>[row.kind+':'+row.id,{createdBy:row.createdBy,lastActor:row.lastActor}]));
}
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
export async function appendQuoteJournal(tx:PrivilegedTenantTransaction,actor:Actor,input:{id:string;type:'QUOTE_COMPLAINT_LINKED_V1'|'QUOTE_FOLLOWUP_COMPLETED_V1'|'QUOTE_ONSITE_REQUESTED_V04'|'QUOTE_LIFECYCLE_V04'|'QUOTE_SETTINGS_UPDATED_V04'|'QUOTE_CALCULATION_V04';clientEventId:string;correlationId:string;version:number|null;description:string;payload:Record<string,unknown>}) {
  if (!await quoteJournalActorIsActive(tx,actor)) throw Error('QUOTE_JOURNAL_ACTOR_INACTIVE');
  await tx.execute(sql`INSERT INTO public.events(id,tenant_id,event_type,user_id,client_event_id,event_schema_version,correlation_id,aggregate_version,status,description,payload)
    VALUES(${input.id},${actor.tenantId},${input.type},${actor.userId}::uuid,${input.clientEventId}::uuid,1,${input.correlationId}::uuid,${input.version},'success',${input.description},${JSON.stringify(input.payload)}::jsonb)`);
}
export async function readQuoteCurrentRate(tx:PrivilegedTenantTransaction,tenantId:string) {
  const rates=await tx.execute<{hourlyRateCents:number;integrity_ok:boolean}>(sql`SELECT hourly_rate_cents::float8 AS "hourlyRateCents",integrity_ok FROM private.v_extra_work_current_rate_v1 WHERE tenant_id=${tenantId} LIMIT 2`);
  if (rates.length>1||rates.some(rate=>rate.integrity_ok!==true||!Number.isSafeInteger(rate.hourlyRateCents)||rate.hourlyRateCents<1)) throw Error('QUOTE_RATE_INVALID');
  return rates[0]?.hourlyRateCents??null;
}

/** U250 read foundation; owner-specific intake facts are injected, not queried across boundaries. */
export async function readActorStatistics(auth:AuthorizationSnapshot,input:unknown,readIntake:(tx:PrivilegedTenantTransaction,auth:AuthorizationSnapshot,input:unknown)=>Promise<{code:'OK';rows:ActorStatisticRow[]}|{code:'FORBIDDEN'|'VALIDATION_ERROR';message:string}>){
 const scope=actorStatisticsScope(auth,input);if(scope.code!=='OK')return scope;
 try{return await withPrivilegedTenantTransaction(auth,async tx=>{
  const cases=await readPublicCaseActorStatistics(tx,auth,input),intake=await readIntake(tx,auth,input);
  if(cases.code!=='OK')return cases;if(intake.code!=='OK')return intake;
  return {code:'OK' as const,scope:scope.all?'all' as const:'own' as const,userId:scope.all?null:auth.userId,from:scope.from,through:scope.through,rows:[...cases.rows,...intake.rows]};
 });}catch(error){console.error('[ACTOR_STATISTICS_FAILED]',error);return {code:'UNAVAILABLE' as const,message:'Akteurstatistik konnte nicht sicher gelesen werden.'};}
}

export async function readActorNames(tx:PrivilegedTenantTransaction,tenantId:string,ids:readonly string[]){
 const valid=[...new Set(ids)].filter(id=>/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id));
 if(!valid.length)return new Map<string,string>();
 const rows=await tx.execute<{id:string;name:string}>(sql`SELECT id::text,full_name AS name FROM public.app_users WHERE tenant_id=${tenantId} AND id IN (${sql.join(valid.map(id=>sql`${id}::uuid`),sql`, `)})`);
 return new Map(rows.map(row=>[row.id,row.name]));
}
export async function readQuoteComplaintSource(tx:PrivilegedTenantTransaction,tenantId:string,complaintId:string){
 await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtextextended('ein4b:rework:'||${tenantId}||':'||${complaintId},0))`);
 const rows=await tx.execute<{id:string;customerId:string;number:string;assessment:string|null}>(sql`SELECT complaint_id AS id,customer_id AS "customerId",nummer AS number,bewertung AS assessment FROM public.v_complaint_rework_context_v1 WHERE tenant_id=${tenantId} AND complaint_id=${complaintId}`);
 if(rows.length>1)throw Error('QUOTE_COMPLAINT_SOURCE_AMBIGUOUS');return rows[0]??null;
}

export type QuoteReplyProof={quoteId:string;edition:number;sha256:string;sourceItemId:string;sourceVersion:number;originalSha256:string;inReplyTo:string;sentGraphId:string;dispatchEventId:string;automaticOrder?:true};
export async function readQuoteReplyDocuments(tx:PrivilegedTenantTransaction,actor:Actor,quoteId:string,customerId:string){
 return [...await tx.execute<{eventId:string;document:CommunicationDocument}>(sql`SELECT event.id AS "eventId",event.payload->'document' AS document FROM public.events event JOIN public.communication_threads thread ON thread.tenant_id=event.tenant_id AND thread.id::text=event.payload->>'threadId' AND thread.source='MS_GRAPH_OUT:'||event.correlation_id::text AND thread.status='sent' AND thread.customer_id=${customerId}
 WHERE event.tenant_id=${actor.tenantId} AND event.event_type='COMMUNICATION_DOCUMENT_SENT_V1' AND event.payload->'document'->>'kind'='QUOTE' AND event.payload->'document'->>'id'=${quoteId} ORDER BY event.created_at,event.id LIMIT 101`)];
}

export function quoteReplyEditionMessage(replyEdition:number,currentEdition:number){return "Zusage galt Fassung "+replyEdition+" · Fassung "+currentEdition+" bestätigen lassen.";}
