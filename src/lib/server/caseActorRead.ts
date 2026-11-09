import 'server-only';
import {sql} from 'drizzle-orm';
import type {PrivilegedTenantTransaction} from './privilegedDb';
type Actor={tenantId:string;userId:string};

const caseActorAction=sql`event.event_type||CASE WHEN event.payload->>'action' IN ('accept','sent','reject','extend','conditional','aufnehmen','entscheiden','bewerten','nacharbeit','gutschrift','abschliessen','zurueckziehen','wieder_oeffnen') THEN ':'||(event.payload->>'action') ELSE '' END`;
import type {CaseActorEvidence,CaseActorTrace} from '@/lib/domain/caseActorContract';
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
export async function readActorNames(tx:PrivilegedTenantTransaction,tenantId:string,ids:readonly string[]){
 const valid=[...new Set(ids)].filter(id=>/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id));
 if(!valid.length)return new Map<string,string>();
 const rows=await tx.execute<{id:string;name:string}>(sql`SELECT id::text,full_name AS name FROM public.app_users WHERE tenant_id=${tenantId} AND id IN (${sql.join(valid.map(id=>sql`${id}::uuid`),sql`, `)})`);
 return new Map(rows.map(row=>[row.id,row.name]));
}
