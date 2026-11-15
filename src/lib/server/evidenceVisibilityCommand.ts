import 'server-only';

import {randomUUID} from 'node:crypto';
import {sql} from 'drizzle-orm';
import {canChangeEvidenceVisibility,type AuthorizationSnapshot} from '@/lib/server/authorization';
import {withPrivilegedTenantTransaction,type PrivilegedTenantTransaction} from '@/lib/server/privilegedDb';
import {mapEvidenceVisibility,type EvidenceVisibilityRow,type EvidenceVisibility} from '@/lib/domain/evidenceVisibility';
import {EVIDENCE_VISIBILITY_COPY as copy} from '@/ui/situationCatalog';

export type ChangeEvidenceVisibilityInput={evidenceKey:string;customerVisible:boolean;expectedVersion:number;clientEventId:string};
type Result={code:'OK';data:EvidenceVisibility;replayed:boolean}
 |{code:'FORBIDDEN'|'VALIDATION_ERROR'|'NOT_FOUND'|'CONFLICT'|'UNAVAILABLE';message:string;current?:EvidenceVisibility};
type Source=EvidenceVisibilityRow&{evidence_key:string;source_kind:string;integrity_ok:boolean;target_links:unknown};
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

function valid(input:unknown):input is ChangeEvidenceVisibilityInput{
 if(!input||typeof input!=='object'||Array.isArray(input))return false;
 const value=input as Record<string,unknown>;
 return Object.keys(value).sort().join(',')==='clientEventId,customerVisible,evidenceKey,expectedVersion'
  &&typeof value.evidenceKey==='string'&&value.evidenceKey.length>0&&value.evidenceKey.length<=256&&value.evidenceKey.trim()===value.evidenceKey
  &&typeof value.customerVisible==='boolean'&&Number.isSafeInteger(value.expectedVersion)&&(value.expectedVersion as number)>=0
  &&typeof value.clientEventId==='string'&&uuid.test(value.clientEventId);
}

async function source(tx:PrivilegedTenantTransaction,auth:AuthorizationSnapshot,key:string){
 const rows=await tx.execute<Source>(sql`SELECT evidence_key,source_kind,integrity_ok,target_links,
  customer_visible,visibility_version,visibility_event_id,visibility_actor_id,visibility_occurred_at
  FROM private.v_evidence_records_v3 WHERE tenant_id=${auth.tenantId} AND evidence_key=${key}`);
 if(rows.length>1)throw Error('EVIDENCE_VISIBILITY_SOURCE_AMBIGUOUS');
 return rows[0]??null;
}

function orderIds(row:Source):string[]{
 if(!Array.isArray(row.target_links))throw Error('EVIDENCE_VISIBILITY_TARGETS_INVALID');
 const ids:string[]=[];
 for(const value of row.target_links){
  if(!value||typeof value!=='object'||typeof value.targetType!=='string'||typeof value.targetId!=='string')throw Error('EVIDENCE_VISIBILITY_TARGETS_INVALID');
  if(value.targetType==='ORDER')ids.push(value.targetId);
 }
 return [...new Set(ids)].sort();
}

/** The only S11 flag setter. Original bytes and source ownership never change. */
export async function changeEvidenceVisibility(auth:AuthorizationSnapshot,input:unknown):Promise<Result>{
 if(!valid(input))return {code:'VALIDATION_ERROR',message:copy.invalid};
 try{return await withPrivilegedTenantTransaction(auth,tx=>changeEvidenceVisibilityInTransaction(tx,auth,input));}
 catch(error){console.error('[EVIDENCE_VISIBILITY_SAVE_UNAVAILABLE]',error instanceof Error?error.message:'unknown');return {code:'UNAVAILABLE',message:copy.save};}
}

/** Shared by direct edits, upload savepoints and the existing task repair. */
export async function changeEvidenceVisibilityInTransaction(tx:PrivilegedTenantTransaction,auth:AuthorizationSnapshot,input:ChangeEvidenceVisibilityInput):Promise<Result>{
 if(!valid(input))return {code:'VALIDATION_ERROR',message:copy.invalid};
   await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtextextended(${'evidence-visibility-request:'+auth.tenantId+':'+input.clientEventId},0))`);
   const previous=await tx.execute<{evidence_key:string;version:number;customer_visible:boolean;actor_id:string;id:string;occurred_at:Date|string}>(sql`
    SELECT evidence_key,version,customer_visible,actor_id::text,id::text,occurred_at
    FROM private.evidence_visibility_events WHERE tenant_id=${auth.tenantId} AND client_event_id=${input.clientEventId}::uuid AND record_kind='change'`);
   if(previous.length>1)throw Error('EVIDENCE_VISIBILITY_REQUEST_AMBIGUOUS');
   if(previous[0]){
    const event=previous[0];
    if(event.evidence_key!==input.evidenceKey||event.actor_id!==auth.userId||event.customer_visible!==input.customerVisible||event.version!==input.expectedVersion+1)
     return {code:'CONFLICT',message:copy.conflict};
    return {code:'OK',data:mapEvidenceVisibility({customer_visible:event.customer_visible,visibility_version:event.version,
     visibility_event_id:event.id,visibility_actor_id:event.actor_id,visibility_occurred_at:event.occurred_at}),replayed:true};
   }
   const initial=await source(tx,auth,input.evidenceKey);
   if(!initial)return {code:'NOT_FOUND',message:copy.missing};
   if(!canChangeEvidenceVisibility(auth,initial.source_kind))return {code:'FORBIDDEN',message:copy.forbidden};
   const ids=orderIds(initial);
   // Match existing order writers: order first, then the original's flag lock.
   for(const id of ids){
    const orders=await tx.execute<{status:string;order_number:string|null}>(sql`SELECT status,order_number FROM public.orders
     WHERE tenant_id=${auth.tenantId} AND id=${id} FOR UPDATE`);
    if(orders.length!==1)throw Error('EVIDENCE_VISIBILITY_ORDER_MISSING');
    if(input.customerVisible&&orders[0].status==='storniert')return {code:'CONFLICT',message:copy.cancelled(orders[0].order_number??id)};
   }
   await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtextextended(${'evidence-visibility:'+auth.tenantId+':'+input.evidenceKey},0))`);
   const current=await source(tx,auth,input.evidenceKey);
   if(!current||current.integrity_ok!==true||JSON.stringify(orderIds(current))!==JSON.stringify(ids))throw Error('EVIDENCE_VISIBILITY_SOURCE_CHANGED');
   const visibility=mapEvidenceVisibility(current);
   if(visibility.version!==input.expectedVersion)return {code:'CONFLICT',message:copy.conflict,current:visibility};
   if(visibility.customerVisible===input.customerVisible)return {code:'OK',data:visibility,replayed:false};
   const id=randomUUID();
   const inserted=await tx.execute<{id:string}>(sql`INSERT INTO private.evidence_visibility_events
    (id,tenant_id,evidence_key,version,customer_visible,actor_id,client_event_id,previous_visible)
    VALUES (${id}::uuid,${auth.tenantId},${input.evidenceKey},${visibility.version+1},${input.customerVisible},${auth.userId}::uuid,${input.clientEventId}::uuid,${visibility.customerVisible}) RETURNING id::text`);
   if(inserted.length!==1||inserted[0].id!==id)throw Error('EVIDENCE_VISIBILITY_RECEIPT_MISSING');
   const readback=await source(tx,auth,input.evidenceKey);
   if(!readback)throw Error('EVIDENCE_VISIBILITY_READBACK_MISSING');
   const saved=mapEvidenceVisibility(readback);
   if(saved.eventId!==id||saved.actorId!==auth.userId||saved.version!==visibility.version+1||saved.customerVisible!==input.customerVisible)throw Error('EVIDENCE_VISIBILITY_READBACK_INVALID');
   return {code:'OK',data:saved,replayed:false};
}
