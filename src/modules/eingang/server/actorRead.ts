import 'server-only';
import {sql} from 'drizzle-orm';
import type {AuthorizationSnapshot} from '@/lib/server/authorization';
import type {PrivilegedTenantTransaction} from '@/lib/server/privilegedDb';
import {actorStatisticsScope,readActorNames,type ActorStatisticRow} from '@/lib/server/quoteJournalPort';
import type {CaseActorTrace,CaseActorEvidence} from '@/lib/server/quoteJournalPort';

/** Called after the owner has checked capture/invoice visibility; original audit rows stay here. */
export async function readIntakeActorTraces(tx:PrivilegedTenantTransaction,auth:AuthorizationSnapshot,ids:readonly string[],invoiceId?:string){
 if(ids.length>1000||ids.some(id=>!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id)))throw Error('INTAKE_ACTOR_IDS_INVALID');
 if(invoiceId!==undefined&&(ids.length!==1||!/[0-9a-f-]{36}/i.test(invoiceId)))throw Error('INVOICE_ACTOR_ID_INVALID');
 if(!ids.length)return new Map<string,CaseActorTrace>();
 const refs=sql.join(ids.map(id=>sql`(${id}::uuid)`),sql`, `);
 const edge=sql`SELECT jsonb_build_object('eventId',event.id::text,'userId',CASE WHEN event.von ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' THEN lower(event.von) END,'name',NULL,'at',event.zeit,'action',CASE WHEN event.nachher->>'command' IN ('rechnung.erfassen','rechnung.unklar','rechnung.status','rechnung.klaeren') THEN event.nachher->>'command' ELSE 'INTAKE:'||event.art END,'mailSender',NULL) AS value
  FROM public.intake_event event
  WHERE event.tenant_id=${auth.tenantId} AND event.item_id=target.id AND (${invoiceId??null}::text IS NULL OR event.nachher->>'invoiceId'=${invoiceId??null})`;
 const rows=await tx.execute<{id:string;createdBy:CaseActorEvidence|null;lastActor:CaseActorEvidence|null}>(sql`SELECT target.id::text,first.value AS "createdBy",last.value AS "lastActor" FROM (VALUES ${refs}) AS target(id)
  LEFT JOIN LATERAL(${edge} ORDER BY (event.art='angelegt') DESC,event.zeit,event.id LIMIT 1) first ON true
  LEFT JOIN LATERAL(${edge} ORDER BY event.zeit DESC,(event.nachher->>'command' IN ('rechnung.erfassen','rechnung.unklar','rechnung.status','rechnung.klaeren')) DESC NULLS LAST,(event.art='angelegt'),event.id DESC LIMIT 1) last ON true`);
 const names=await readActorNames(tx,auth.tenantId,rows.flatMap(row=>[row.createdBy?.userId,row.lastActor?.userId].filter((id):id is string=>!!id)));
 const named=(actor:CaseActorEvidence|null)=>actor?{...actor,name:actor.userId?names.get(actor.userId)??null:null}:null;
 return new Map(rows.map(row=>[row.id,{createdBy:named(row.createdBy),lastActor:named(row.lastActor)}]));
}

export async function readIntakeActorStatistics(tx:PrivilegedTenantTransaction,auth:AuthorizationSnapshot,input:unknown){
 const scope=actorStatisticsScope(auth,input);if(scope.code!=='OK')return scope;
 const rows=await tx.execute<ActorStatisticRow>(sql`SELECT CASE WHEN event.von ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' THEN lower(event.von) END AS "userId",NULL::text AS name,
  CASE WHEN event.nachher->>'invoiceId' IS NOT NULL THEN 'beleg' ELSE 'eingang' END AS kind,
  coalesce(event.nachher->>'command',event.nachher->>'action',event.art) AS action,count(*)::integer AS events,count(DISTINCT coalesce(event.nachher->>'invoiceId',event.item_id::text))::integer AS cases
  FROM public.intake_event event
  WHERE event.tenant_id=${auth.tenantId} AND (${scope.all} OR lower(event.von)=${auth.userId})
  AND event.zeit>=(${scope.from}::date::timestamp AT TIME ZONE 'Europe/Berlin') AND event.zeit<((${scope.through}::date+1)::timestamp AT TIME ZONE 'Europe/Berlin')
  GROUP BY "userId",kind,coalesce(event.nachher->>'command',event.nachher->>'action',event.art) ORDER BY "userId",kind,action`);
 const names=await readActorNames(tx,auth.tenantId,rows.flatMap(row=>row.userId?[row.userId]:[]));
 return {code:'OK' as const,rows:rows.map(row=>({...row,name:row.userId?names.get(row.userId)??null:null}))};
}
