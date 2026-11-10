import 'server-only';
import {randomUUID} from 'node:crypto';
import {sql} from 'drizzle-orm';
import {hasAuthorizationArea,type AuthorizationSnapshot} from './authorization';
import {withPrivilegedTenantTransaction,type PrivilegedTenantTransaction} from './privilegedDb';
import type {TaskCompleteInput,TaskRecord,TaskFailure} from '@/modules/tasks/public';
import type {InitialDispatchReminderPlan} from '@/modules/orders/public';
import {DISPATCH_CALL_COPY} from '@/ui/situationCatalog';
import {appendOrderInformed} from './orderReleaseRead';

type CallMeta={customerId:string;handover:'pickup'|'shipping';due:string;stageKey:string;orderIds:string[];orderNumbers:string[];freezes:Array<{orderId:string;freezeId:string}>};
type Created={payload:{meta:CallMeta;taskId:string};user_id:string;correlation_id:string;originalOrderIds?:string[]};
type CallTask={id:string;client_key:string;art:string;bezug_typ:string;bezug_id:string|null;status:string;erstellt_von:string;erledigt_von:string|null;erledigt_am:string|null;erledigt_notiz:string|null;version:number};
const failure=(code:TaskFailure['code'],message:string):TaskFailure=>({code,message});
async function source(tx:PrivilegedTenantTransaction,auth:AuthorizationSnapshot,taskId:string){
 const rows=await tx.execute<Created&{proof_ok:boolean;created_at:string}>(sql`SELECT payload,user_id::text,correlation_id::text,(created_at AT TIME ZONE 'UTC')::text AS created_at,(status='success' AND event_schema_version=1 AND client_event_id::text=payload->'meta'->>'stageKey' AND correlation_id IS NOT NULL) AS proof_ok FROM public.events WHERE tenant_id=${auth.tenantId} AND event_type='ORDER_COLLECTION_CALL_CREATED_V1' AND payload->>'taskId'=${taskId}`);
 if(rows.length>1)throw Error('DISPATCH_CALL_SOURCE_AMBIGUOUS');const created=rows[0];if(!created)return null;
 if(!created.proof_ok)throw Error('DISPATCH_CALL_SOURCE_INVALID');
 const originalOrderIds=[...created.payload.meta.orderIds];
 const updates=await tx.execute<{payload:{meta:CallMeta;taskId:string};correlation_id:string;proof_ok:boolean}>(sql`SELECT payload,correlation_id::text,(status='success' AND event_schema_version=1) AS proof_ok FROM public.events WHERE tenant_id=${auth.tenantId} AND event_type='ORDER_COLLECTION_CALL_UPDATED_V1' AND payload->>'taskId'=${taskId} ORDER BY created_at,id LIMIT 1001`);
 if(updates.length>1000)throw Error('DISPATCH_CALL_UPDATE_LIMIT');
 for(const update of updates){const meta=update.payload.meta;if(!update.proof_ok||update.correlation_id!==created.correlation_id||meta.customerId!==created.payload.meta.customerId||meta.handover!==created.payload.meta.handover||meta.stageKey!==created.payload.meta.stageKey||meta.due!==created.payload.meta.due)throw Error('DISPATCH_CALL_UPDATE_INVALID');created.payload=update.payload;}
 return {...created,originalOrderIds,startedAt:new Date(created.created_at).toISOString()};
}
async function task(tx:PrivilegedTenantTransaction,auth:AuthorizationSnapshot,id:string,lock=false){
 const rows=await tx.execute<CallTask>(sql`SELECT id::text,client_key::text,art,bezug_typ,bezug_id,status,erstellt_von::text,erledigt_von::text,erledigt_am::text,erledigt_notiz,version FROM public.tasks WHERE tenant_id=${auth.tenantId} AND id=${id}::uuid ${lock?sql`FOR UPDATE`:sql``}`);
 return rows.length===1?rows[0]:null;
}
function validTask(record:CallTask,created:Created){return record.client_key===created.payload.meta.stageKey&&record.art==='rueckruf'&&record.bezug_typ==='auftrag'&&record.bezug_id!==null&&(created.originalOrderIds??created.payload.meta.orderIds).includes(record.bezug_id)&&record.erstellt_von===created.user_id;}

export async function handedOverProofs(tx:PrivilegedTenantTransaction,auth:AuthorizationSnapshot,orderIds:readonly string[]){
 const rows=await tx.execute<{orderId:string;eventId:string}>(sql`SELECT orders.id AS "orderId",proof.id::text AS "eventId" FROM public.orders orders
  JOIN LATERAL(SELECT event.id FROM public.events event WHERE event.tenant_id=orders.tenant_id AND event.order_id=orders.id
   AND event.event_type IN ('ORDER_PICKED_UP_V1','ORDER_PICKED_UP_V2','ORDER_PICKED_UP_V3','ORDER_PICKED_UP_V4') AND event.status='success' AND event.user_id IS NOT NULL
   AND event.from_station='fertig' AND event.station='abgeholt' AND event.payload->>'orderId'=orders.id
   AND event.payload->>'orderVersion'=event.aggregate_version::text AND event.aggregate_version<=orders.version ORDER BY event.created_at DESC,event.id DESC LIMIT 1) proof ON true
  WHERE orders.tenant_id=${auth.tenantId} AND orders.id=ANY(ARRAY[${sql.join(orderIds.map(id=>sql`${id}`),sql`, `)}]::text[])
   AND orders.station='abgeholt' AND orders.status='abgeholt' AND orders.current_station='abgeholt' AND orders.current_station_id='abgeholt' ORDER BY orders.id`);
 return rows.length===orderIds.length?rows:null;
}

/** The goods-out composition locks tasks before orders, matching completion lock order. */
export async function lockDispatchCallsForGoodsOut(tx:PrivilegedTenantTransaction,auth:AuthorizationSnapshot,orderId:string){
 const rows=await tx.execute<{id:string}>(sql`SELECT id::text FROM public.tasks task WHERE tenant_id=${auth.tenantId} AND status='offen' AND EXISTS(
  SELECT 1 FROM public.events event WHERE event.tenant_id=task.tenant_id AND event.event_type IN ('ORDER_COLLECTION_CALL_CREATED_V1','ORDER_COLLECTION_CALL_UPDATED_V1')
   AND event.payload->>'taskId'=task.id::text AND event.payload->'meta'->'orderIds' @> ${JSON.stringify([orderId])}::jsonb) ORDER BY id FOR UPDATE`);
 return rows.map(row=>row.id);
}
export async function finishDispatchCallsAfterGoodsOut(tx:PrivilegedTenantTransaction,auth:AuthorizationSnapshot,taskIds:readonly string[],complete:(id:string,note:string)=>Promise<void>){
 for(const taskId of taskIds){const created=await source(tx,auth,taskId);if(!created)throw Error('DISPATCH_CALL_SOURCE_MISSING');
  const state=await qualifiedTaskState(tx,auth,created);if(state.result!==null)continue;
  if(await handedOverProofs(tx,auth,created.payload.meta.orderIds))await complete(taskId,DISPATCH_CALL_COPY.goodsGone);
 }
}

async function qualifiedTaskState(tx:PrivilegedTenantTransaction,auth:AuthorizationSnapshot,created:Created){
 const record=await task(tx,auth,created.payload.taskId);
 if(!record||!validTask(record,created))throw Error('DISPATCH_CALL_TASK_INVALID');
 const results=await tx.execute<{payload:{result:'reached'|'notReached'|'noLongerNeeded';version:number;note:string|null;goodsOutProofs?:Array<{orderId:string;eventId:string}>};user_id:string;proof_ok:boolean}>(sql`SELECT payload,user_id::text,
  (status='success' AND event_schema_version=1 AND payload->'meta'=${JSON.stringify(created.payload.meta)}::jsonb AND correlation_id=${created.correlation_id}::uuid) AS proof_ok FROM public.events WHERE tenant_id=${auth.tenantId} AND event_type='ORDER_COLLECTION_CALL_RESULT_V1' AND payload->>'taskId'=${record.id}`);
 const clock={stageKey:created.payload.meta.stageKey,due:created.payload.meta.due};
 if(record.status==='offen'){if(results.length)throw Error('DISPATCH_CALL_OPEN_WITH_RESULT');return {taskId:record.id,result:null,recordedAt:null,...clock};}
 const result=results[0];
 if(record.status!=='erledigt'||results.length!==1||!result.proof_ok||!['reached','notReached','noLongerNeeded'].includes(result.payload.result)||result.user_id!==record.erledigt_von||result.payload.version!==record.version||result.payload.note!==record.erledigt_notiz||!record.erledigt_am)throw Error('DISPATCH_CALL_RESULT_INVALID');
 if(result.payload.result==='noLongerNeeded'){
  const actual=await handedOverProofs(tx,auth,created.payload.meta.orderIds),stored=result.payload.goodsOutProofs;
  if(!actual||!Array.isArray(stored)||JSON.stringify(actual.map(row=>[row.orderId,row.eventId]))!==JSON.stringify(stored.map(row=>[row.orderId,row.eventId])))throw Error('DISPATCH_CALL_CLOSE_PROOF_INVALID');
 }
 return {taskId:record.id,result:result.payload.result,recordedAt:new Date(record.erledigt_am).toISOString(),...clock};
}

/** Runs inside the existing task completion transaction, including retries. */
export async function recordDispatchCallResult(tx:PrivilegedTenantTransaction,auth:AuthorizationSnapshot,record:TaskRecord,input:TaskCompleteInput,answered:ReadonlyArray<{id:string;version:number}>=[]):Promise<void|TaskFailure>{
 const created=await source(tx,auth,record.id);
 if(!created)return input.callResult===undefined?undefined:failure('VALIDATION_ERROR',DISPATCH_CALL_COPY.notCall);
 if(!hasAuthorizationArea(auth,'auftraege'))return failure('FORBIDDEN',DISPATCH_CALL_COPY.forbidden);
 if(!validTask(record,created))throw Error('DISPATCH_CALL_TASK_INVALID');
 const results=await tx.execute<{payload:{result:string;version:number;note:string|null};user_id:string}>(sql`SELECT payload,user_id::text FROM public.events WHERE tenant_id=${auth.tenantId} AND event_type='ORDER_COLLECTION_CALL_RESULT_V1' AND payload->>'taskId'=${record.id}`);
 if(record.status==='erledigt'){
  await qualifiedTaskState(tx,auth,created);
  if(results.length!==1||results[0].user_id!==auth.userId||results[0].payload.result!==(input.callResult??'noLongerNeeded')||results[0].payload.version!==input.version+1||results[0].payload.note!==(input.note?.trim()||null))return failure('CONFLICT',DISPATCH_CALL_COPY.resultConflict);
  return;
 }
 if(results.length)throw Error('DISPATCH_CALL_RESULT_WITHOUT_COMPLETION');
 if(record.version!==input.version)return failure('CONFLICT',DISPATCH_CALL_COPY.changed);
 const goodsOutProofs=await handedOverProofs(tx,auth,created.payload.meta.orderIds);
 if(input.callResult===undefined&&!goodsOutProofs)return failure('VALIDATION_ERROR',DISPATCH_CALL_COPY.resultMissing);
 if(input.callResult!==undefined&&goodsOutProofs)return failure('CONFLICT',DISPATCH_CALL_COPY.cohortChanged);
 const current=await tx.execute<{id:string;version:number;freeze_id:string|null}>(sql`SELECT o.id,o.version,f.freeze_id::text FROM public.orders o LEFT JOIN private.v_order_freeze_state_v1 f ON f.tenant_id=o.tenant_id AND f.order_id=o.id AND f.active AND f.integrity_ok WHERE o.tenant_id=${auth.tenantId} AND o.customer_id=${created.payload.meta.customerId} AND o.handover_mode=${created.payload.meta.handover} AND o.station='fertig' AND o.status='fertig' AND o.current_station='fertig' AND o.current_station_id='fertig' ORDER BY o.id FOR UPDATE OF o`);
 const pending=current.filter(row=>!answered.some(covered=>covered.id===row.id&&covered.version===row.version));
 if(!goodsOutProofs&&JSON.stringify(pending.map(row=>row.id).sort())!==JSON.stringify([...created.payload.meta.orderIds].sort()))return failure('CONFLICT',DISPATCH_CALL_COPY.cohortChanged);
 if(!goodsOutProofs&&pending.some(row=>!row.freeze_id||!created.payload.meta.freezes?.some(proof=>proof.orderId===row.id&&proof.freezeId===row.freeze_id)))return failure('CONFLICT',DISPATCH_CALL_COPY.changed);
 if(input.callResult==='reached')for(const orderId of [...created.payload.meta.orderIds].sort()){
  await appendOrderInformed(tx,auth,{orderId,clientEventId:randomUUID(),channel:'telefon',intent:'dispatch-call:'+record.id+':'+(record.version+1)});
 }
 await tx.execute(sql`INSERT INTO public.events(id,tenant_id,event_type,description,status,user_id,client_event_id,correlation_id,event_schema_version,payload,created_at)
 VALUES(${randomUUID()},${auth.tenantId},'ORDER_COLLECTION_CALL_RESULT_V1',${DISPATCH_CALL_COPY.resultRecorded},'success',${auth.userId}::uuid,${randomUUID()}::uuid,${created.correlation_id}::uuid,1,${JSON.stringify({taskId:record.id,result:input.callResult??'noLongerNeeded',version:record.version+1,note:input.note?.trim()||null,meta:created.payload.meta,...(goodsOutProofs?{goodsOutProofs}:{})})}::jsonb,statement_timestamp())`);
}

export async function readDispatchCallRequirement(auth:AuthorizationSnapshot,taskId:string){
 if(!hasAuthorizationArea(auth,'auftraege'))return null;
 return withPrivilegedTenantTransaction(auth,async tx=>{
  const created=await source(tx,auth,taskId);if(!created)return null;
  const state=await qualifiedTaskState(tx,auth,created);
  return {required:state.result===null,result:state.result,recordedAt:state.recordedAt,orderIds:created.payload.meta.orderIds,orderNumbers:created.payload.meta.orderNumbers};
 });
}

/** Generic task editing must not erase the cohort or convert a mandatory-result call. */
export async function protectDispatchCallTask(tx:PrivilegedTenantTransaction,auth:AuthorizationSnapshot,input:{taskId:string;action:string;kind:string;title:string;note:string|null}):Promise<void|TaskFailure>{
 if(input.action!=='geaendert')return;
 const created=await source(tx,auth,input.taskId);if(!created)return;
 if(input.kind!=='rueckruf'||input.title!==DISPATCH_CALL_COPY.title||input.note!==DISPATCH_CALL_COPY.note+created.payload.meta.orderNumbers.join(', '))return failure('CONFLICT',DISPATCH_CALL_COPY.preserve);
}

/** Only real tasks/results qualify; their state is never inferred from free text. */
export async function readDispatchCalls(auth:AuthorizationSnapshot,customerId:string,handover:'pickup'|'shipping',orderIds:readonly string[]){
 return withPrivilegedTenantTransaction(auth,async tx=>{
  const rows=await tx.execute<Created>(sql`SELECT created.payload,created.user_id::text,created.correlation_id::text FROM public.events created WHERE created.tenant_id=${auth.tenantId} AND created.event_type='ORDER_COLLECTION_CALL_CREATED_V1' AND created.payload->'meta'->>'customerId'=${customerId} AND created.payload->'meta'->>'handover'=${handover}
   AND (created.payload->'meta'->'orderIds' ?| ARRAY[${sql.join(orderIds.map(id=>sql`${id}`),sql`, `)}]::text[] OR EXISTS(SELECT 1 FROM public.events updated WHERE updated.tenant_id=created.tenant_id AND updated.event_type='ORDER_COLLECTION_CALL_UPDATED_V1' AND updated.payload->>'taskId'=created.payload->>'taskId' AND updated.payload->'meta'->'orderIds' ?| ARRAY[${sql.join(orderIds.map(id=>sql`${id}`),sql`, `)}]::text[])) ORDER BY created.created_at DESC,created.id DESC LIMIT 1001`);
  if(rows.length>1000)throw Error('DISPATCH_CALL_HISTORY_LIMIT');
  const result=[];
  for(const row of rows){
   const created=await source(tx,auth,row.payload.taskId);if(!created)throw Error('DISPATCH_CALL_SOURCE_MISSING');
   if(!created.payload.meta.orderIds.some(id=>orderIds.includes(id)))continue;
   const cohortChanged=JSON.stringify([...created.payload.meta.orderIds].sort())!==JSON.stringify([...orderIds].sort());
   if(!Array.isArray(created.payload.meta.freezes)||created.payload.meta.freezes.length!==created.payload.meta.orderIds.length)throw Error('DISPATCH_CALL_FREEZE_PROOF_MISSING');
   result.push({...await qualifiedTaskState(tx,auth,created),cohortChanged,orderIds:created.payload.meta.orderIds,orderNumbers:created.payload.meta.orderNumbers,startedAt:created.startedAt,freezes:created.payload.meta.freezes});
  }
  return result;
 });
}

type Request={customerId:string;handover:'pickup'|'shipping';dueDate:string;clientKey:string};
export async function readCompletedDispatchCallReceipt(auth:AuthorizationSnapshot,input:Request){
 try{return await withPrivilegedTenantTransaction(auth,async tx=>{
  const rows=await tx.execute<Created&{event_type:string}>(sql`SELECT payload,user_id::text,correlation_id::text,event_type FROM public.events WHERE tenant_id=${auth.tenantId} AND client_event_id=${input.clientKey}::uuid`);
  if(!rows.length)return {code:'NOT_FOUND' as const};
  const row=rows[0];if(rows.length!==1||row.event_type!=='ORDER_COLLECTION_CALL_CREATED_V1'||row.payload.meta.customerId!==input.customerId||row.payload.meta.handover!==input.handover||row.payload.meta.due!==input.dueDate)return {code:'CONFLICT' as const,message:DISPATCH_CALL_COPY.changed};
  const created=await source(tx,auth,row.payload.taskId);if(!created)throw Error('DISPATCH_CALL_SOURCE_MISSING');
  const state=await qualifiedTaskState(tx,auth,created);
  return state.result===null?{code:'NOT_FOUND' as const}:{code:'OK' as const,taskId:state.taskId,replayed:true};
 });}catch(error){console.error('[DISPATCH_CALL_RECEIPT_FAILED]',error instanceof Error?error.message:'UnknownError');return {code:'UNAVAILABLE' as const,message:DISPATCH_CALL_COPY.unavailable};}
}
export async function createDispatchCall(auth:AuthorizationSnapshot,input:Request,plan:InitialDispatchReminderPlan,versions:ReadonlyArray<{id:string;version:number}>,createTask:(tx:PrivilegedTenantTransaction,meta:{orderId:string;clientKey:string;title:string;note:string;taskId?:string;version?:number})=>Promise<string>){
 if(!hasAuthorizationArea(auth,'auftraege')||!hasAuthorizationArea(auth,'mails'))return {code:'FORBIDDEN' as const,message:DISPATCH_CALL_COPY.forbidden};
 if(plan.stage!=='E3'||plan.due!==input.dueDate||!plan.clientKey||plan.clientKey!==input.clientKey||!plan.anchorOrderId)return {code:'CONFLICT' as const,message:DISPATCH_CALL_COPY.changed};
 const stageKey=plan.clientKey,anchorOrderId=plan.anchorOrderId;
 try{return await withPrivilegedTenantTransaction(auth,async tx=>{
  await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtextextended(${auth.tenantId+':collection:'+stageKey},0))`);
  await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtextextended(${'task:'+auth.tenantId+':'+stageKey},0))`);
  const prior=await tx.execute<Created>(sql`SELECT payload,user_id::text,correlation_id::text FROM public.events WHERE tenant_id=${auth.tenantId} AND event_type='ORDER_COLLECTION_CALL_CREATED_V1' AND client_event_id=${stageKey}::uuid`);
  const existing=prior.length===1?await source(tx,auth,prior[0].payload.taskId):null;
  const record=existing?await task(tx,auth,existing.payload.taskId,true):null;
  if(prior.length&&(!existing||!record||!validTask(record,existing)||existing.payload.meta.customerId!==input.customerId||existing.payload.meta.handover!==input.handover))return {code:'CONFLICT' as const,message:DISPATCH_CALL_COPY.changed};
  if(existing&&record&&JSON.stringify([...existing.payload.meta.orderIds].sort())===JSON.stringify([...plan.orderIds].sort()))return {code:'OK' as const,taskId:record.id,replayed:true};
  if(existing&&record?.status!=='offen')return {code:'CONFLICT' as const,message:DISPATCH_CALL_COPY.cohortChanged};
  if(!['DUE','CALL_PENDING'].includes(plan.state)||plan.requiresResponseCheck||plan.needsNotice.length)return {code:'CONFLICT' as const,message:DISPATCH_CALL_COPY.changed};
  const occupied=await tx.execute(sql`SELECT id FROM public.tasks WHERE tenant_id=${auth.tenantId} AND client_key=${stageKey}::uuid`);
  if(occupied.length&&!existing)return {code:'CONFLICT' as const,message:DISPATCH_CALL_COPY.changed};
  const orders=await tx.execute<{id:string;version:number;customer_id:string;handover_mode:string;station:string;current_station:string;current_station_id:string;status:string;freeze_id:string}>(sql`SELECT o.id,o.version,o.customer_id,o.handover_mode,o.station,o.current_station,o.current_station_id,o.status,f.freeze_id::text FROM public.orders o JOIN private.v_order_freeze_state_v1 f ON f.tenant_id=o.tenant_id AND f.order_id=o.id AND f.active AND f.integrity_ok WHERE o.tenant_id=${auth.tenantId} AND o.id=ANY(ARRAY[${sql.join(plan.orderIds.map(id=>sql`${id}`),sql`, `)}]::text[]) ORDER BY o.id FOR UPDATE OF o`);
  if(orders.length!==plan.orderIds.length||orders.some(row=>row.customer_id!==input.customerId||row.handover_mode!==input.handover||[row.station,row.current_station,row.current_station_id,row.status].some(state=>state!=='fertig')||versions.find(order=>order.id===row.id)?.version!==row.version))return {code:'CONFLICT' as const,message:DISPATCH_CALL_COPY.changed};
  const meta:CallMeta={customerId:input.customerId,handover:input.handover,due:input.dueDate,stageKey,orderIds:plan.orderIds,orderNumbers:plan.orderNumbers,freezes:orders.map(row=>({orderId:row.id,freezeId:row.freeze_id}))};
  const taskId=await createTask(tx,{orderId:record?.bezug_id??anchorOrderId,clientKey:stageKey,title:DISPATCH_CALL_COPY.title,note:DISPATCH_CALL_COPY.note+plan.orderNumbers.join(', '),...(record?{taskId:record.id,version:record.version}:{})});
  await tx.execute(sql`INSERT INTO public.events(id,tenant_id,event_type,description,status,user_id,client_event_id,correlation_id,event_schema_version,payload,created_at)
   VALUES(${randomUUID()},${auth.tenantId},${existing?'ORDER_COLLECTION_CALL_UPDATED_V1':'ORDER_COLLECTION_CALL_CREATED_V1'},${DISPATCH_CALL_COPY.created},'success',${auth.userId}::uuid,${existing?randomUUID():stageKey}::uuid,${existing?.correlation_id??randomUUID()}::uuid,1,${JSON.stringify({meta,taskId})}::jsonb,statement_timestamp())`);
  return {code:'OK' as const,taskId,replayed:false};
 });}catch(error){console.error('[DISPATCH_CALL_CREATE_FAILED]',error instanceof Error?error.message:'UnknownError');return {code:'UNAVAILABLE' as const,message:DISPATCH_CALL_COPY.unavailable};}
}
