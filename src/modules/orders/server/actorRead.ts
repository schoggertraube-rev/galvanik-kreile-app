import 'server-only';
import {sql} from 'drizzle-orm';
import {hasAuthorizationArea,type AuthorizationSnapshot} from '@/lib/server/authorization';
import {withPrivilegedTenantTransaction} from '@/lib/server/privilegedDb';
import {readOrderTaskAssignment} from '@/lib/server/orderTaskAssignmentRead';
import type {OrderActorEvidence,OrderActorSummary} from './types';

type Failure={code:'FORBIDDEN'|'VALIDATION_ERROR'|'NOT_FOUND'|'CONFLICT'|'UNAVAILABLE';message:string};
type ActorRow={eventId:string;userId:string|null;name:string|null;at:Date|string;action:string;mailSender:string|null};
const evidence=(row:ActorRow|undefined):OrderActorEvidence|null=>row?{...row,at:new Date(row.at).toISOString()}:null;

/** Read-only event projection. Existing order assignment remains the only override. */
export async function readOrderActors(auth:AuthorizationSnapshot,input:{orderId:string;version:number}):Promise<{code:'OK';actors:OrderActorSummary}|Failure>{
 if(!hasAuthorizationArea(auth,'auftraege'))return {code:'FORBIDDEN',message:'Auftragsakteure benötigen Aufträge.'};
 if(!input||typeof input.orderId!=='string'||!input.orderId||input.orderId.length>128||!Number.isSafeInteger(input.version)||input.version<1)return {code:'VALIDATION_ERROR',message:'Auftragskennung oder Stand fehlt.'};
 try{
  const trace=await withPrivilegedTenantTransaction(auth,async tx=>{
   const [order]=await tx.execute<{version:number}>(sql`SELECT version FROM public.orders WHERE tenant_id=${auth.tenantId} AND id=${input.orderId}`);
   if(!order)return {code:'NOT_FOUND' as const,message:'Auftrag ist nicht vorhanden.'};
   if(order.version!==input.version)return {code:'CONFLICT' as const,message:'Auftrag wurde inzwischen geändert. Neu lesen.'};
   const projection=sql`SELECT event.id::text AS "eventId",event.user_id::text AS "userId",actor.full_name AS name,event.created_at AS at,event.event_type AS action,
    CASE WHEN event.payload->'receipt'->'mailActor'->>'kind'='mail' THEN event.payload->'receipt'->'mailActor'->>'sender' END AS "mailSender"
    FROM public.events event LEFT JOIN public.app_users actor ON actor.tenant_id=event.tenant_id AND actor.id=event.user_id
    WHERE event.tenant_id=${auth.tenantId} AND event.order_id=${input.orderId} AND event.status='success'
    AND (event.aggregate_version IS NULL OR event.aggregate_version<=${input.version})`;
   const [first]=await tx.execute<ActorRow>(sql`${projection} ORDER BY event.created_at,event.id LIMIT 1`);
   const [last]=await tx.execute<ActorRow>(sql`${projection} ORDER BY event.created_at DESC,event.id DESC LIMIT 1`);
   return {code:'OK' as const,createdBy:evidence(first),lastActor:evidence(last)};
  });
  if(trace.code!=='OK')return trace;
  const assignment=await readOrderTaskAssignment(auth,{orderId:input.orderId});
  if(assignment.code==='OK'&&assignment.data&&assignment.data.assignmentVersion>input.version)return {code:'CONFLICT',message:'Auftragszuständigkeit wurde inzwischen geändert. Neu lesen.'};
  const active=assignment.code==='OK'&&assignment.data?.active?assignment.data:null;
  const responsible=assignment.code!=='OK'?null:active?{userId:active.assignedTo,name:active.assignedToName,at:active.assignedAt,source:'assignment' as const}:trace.createdBy?.userId?{userId:trace.createdBy.userId,name:trace.createdBy.name,at:trace.createdBy.at,source:'first-event' as const}:null;
  return {code:'OK',actors:{currentLoginId:auth.userId,createdBy:trace.createdBy,lastActor:trace.lastActor,responsible,assignmentUnavailable:assignment.code!=='OK'}};
 }catch(error){console.error('[ORDER_ACTORS_READ_FAILED]',{code:error instanceof Error?error.name:'UNKNOWN'});return {code:'UNAVAILABLE',message:'Auftragsakteure konnten nicht sicher gelesen werden.'};}
}

/** Own activity only: a broader personnel report needs its explicit read permission. */
export async function readOwnOrderActorStatistics(auth:AuthorizationSnapshot,input:{from:string;through:string}){
 if(!hasAuthorizationArea(auth,'auftraege'))return {code:'FORBIDDEN' as const,message:'Auftragsstatistik benötigt Aufträge.'};
 const day=/^\d{4}-\d{2}-\d{2}$/;
 const start=typeof input?.from==='string'&&day.test(input.from)?Date.parse(input.from):NaN;
 const end=typeof input?.through==='string'&&day.test(input.through)?Date.parse(input.through):NaN;
 if(!Number.isFinite(start)||!Number.isFinite(end)||new Date(start).toISOString().slice(0,10)!==input.from||new Date(end).toISOString().slice(0,10)!==input.through||end<start||end-start>366*86400000)return {code:'VALIDATION_ERROR' as const,message:'Zeitraum muss zwischen einem und 367 Tagen liegen.'};
 try{
  const rows=await withPrivilegedTenantTransaction(auth,tx=>tx.execute<{action:string;events:number;orders:number}>(sql`SELECT event.event_type AS action,count(*)::integer AS events,count(DISTINCT event.order_id)::integer AS orders
   FROM public.events event JOIN public.orders orders ON orders.tenant_id=event.tenant_id AND orders.id=event.order_id
   WHERE event.tenant_id=${auth.tenantId} AND event.user_id=${auth.userId}::uuid AND event.status='success'
   AND event.created_at>=(${input.from}::date::timestamp AT TIME ZONE 'Europe/Berlin')
   AND event.created_at<((${input.through}::date+1)::timestamp AT TIME ZONE 'Europe/Berlin')
   GROUP BY event.event_type ORDER BY event.event_type`));
  return {code:'OK' as const,userId:auth.userId,from:input.from,through:input.through,rows};
 }catch(error){console.error('[ORDER_ACTOR_STATISTICS_FAILED]',{code:error instanceof Error?error.name:'UNKNOWN'});return {code:'UNAVAILABLE' as const,message:'Eigene Auftragsstatistik konnte nicht gelesen werden.'};}
}
