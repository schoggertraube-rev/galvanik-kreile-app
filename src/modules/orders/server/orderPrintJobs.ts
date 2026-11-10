import 'server-only';
import {createHash,randomUUID} from 'node:crypto';
import {sql} from 'drizzle-orm';
import type {AuthorizationSnapshot} from '@/lib/server/authorization';
import {withPrivilegedTenantTransaction,type PrivilegedTenantTransaction} from '@/lib/server/privilegedDb';
import {hasAuthorizationArea} from '@/lib/server/authorization';
import {canonicalJson} from '@/lib/domain/canonicalJson';

function automaticKey(orderId:string,version:number){
 const h=createHash('sha256').update(JSON.stringify(['order-print',orderId,version])).digest('hex');
 return `${h.slice(0,8)}-${h.slice(8,12)}-5${h.slice(13,16)}-8${h.slice(17,20)}-${h.slice(20,32)}`;
}
type Position={id:string;name:string;quantity:string;unit:string|null;surface:string|null;execution:string};
type Order={id:string;number:string;customerId:string;customerName:string;dueDate:string|null;handover:string|null;version:number;slot:number|null;generation:number|null;active:boolean};

async function readInitialQueue(tx:PrivilegedTenantTransaction,auth:AuthorizationSnapshot,orderId:string,expectedCount?:number){
 const requestKey=automaticKey(orderId,1);
 const sources=await tx.execute<{user_id:string;valid:boolean;payload:{orderId:string;orderVersion:number;jobIds:string[];snapshotSha256:string;symbol:{slot:number;generation:number}}}>(sql`SELECT user_id::text,payload,(status='success' AND event_schema_version=1) AS valid FROM public.events WHERE tenant_id=${auth.tenantId} AND event_type='ORDER_PRINT_JOBS_QUEUED_V1' AND client_event_id=${requestKey}::uuid AND order_id=${orderId}`);
 const jobs=await tx.execute<{id:string;created_by:string;snapshot:{positions:Position[]};status:'wartet'|'gedruckt'|'fehlgeschlagen'|'storniert';attempts:number;sheet_kind:'gesamt'|'position';kind:string;item_id:string|null}>(sql`SELECT id::text,created_by::text,snapshot,status,attempts,sheet_kind,kind,item_id FROM public.print_jobs WHERE tenant_id=${auth.tenantId} AND order_id=${orderId} AND request_key=${requestKey}::uuid AND content_version=1 ORDER BY id`);
 if(!sources.length&&!jobs.length)return null;
 const source=sources[0];
 if(sources.length!==1||!source.valid||source.payload.orderId!==orderId||source.payload.orderVersion!==1||!Array.isArray(source.payload.jobIds)||!jobs.length||expectedCount!==undefined&&jobs.length!==expectedCount||jobs.some(job=>job.created_by!==source.user_id||createHash('sha256').update(canonicalJson(job.snapshot)).digest('hex')!==source.payload.snapshotSha256)||JSON.stringify(jobs.map(job=>job.id))!==JSON.stringify([...source.payload.jobIds].sort()))throw Error('ORDER_PRINT_INITIAL_RECEIPT_INVALID');
 const positions=jobs[0].snapshot.positions;
 if(!Array.isArray(positions)||jobs.some(job=>job.kind!=='laufzettel')||jobs.filter(job=>job.sheet_kind==='gesamt'&&job.item_id===null).length!==1||JSON.stringify(jobs.filter(job=>job.sheet_kind==='position').map(job=>job.item_id).sort())!==JSON.stringify(positions.map(position=>position.id).sort()))throw Error('ORDER_PRINT_SHEET_MEMBERS_INVALID');
 return {symbol:source.payload.symbol,jobs};
}

/** The existing order card reads the same stored queue and its original receipt. */
export async function readOrderPrintQueue(auth:AuthorizationSnapshot,orderId:string){
 if(!hasAuthorizationArea(auth,'auftraege'))return {code:'FORBIDDEN' as const};
 try{return await withPrivilegedTenantTransaction(auth,async tx=>{
  const queue=await readInitialQueue(tx,auth,orderId);
  if(!queue)return {code:'OK' as const,state:'NOT_QUEUED' as const,jobs:[]};
  const state=queue.jobs.every(job=>job.status==='storniert')?'RETIRED':queue.jobs.some(job=>job.status==='fehlgeschlagen')?'FAILED':queue.jobs.every(job=>job.status==='gedruckt')?'PRINTED':'WAITING';
  return {code:'OK' as const,state,symbol:queue.symbol,jobs:queue.jobs.map(job=>({id:job.id,itemId:job.item_id,sheetKind:job.sheet_kind,status:job.status,attempts:job.attempts}))};
 });}catch(error){console.error('[ORDER_PRINT_QUEUE_READ_FAILED]',error instanceof Error?error.message:'UnknownError');return {code:'UNAVAILABLE' as const};}
}

/** Part of the canonical order transaction. It queues real work; it never reports a print. */
export async function createInitialOrderPrintJobs(tx:PrivilegedTenantTransaction,auth:AuthorizationSnapshot,orderId:string,customerName:string,itemIds:readonly string[]){
 const orders=await tx.execute<Order>(sql`SELECT o.id,o.order_number AS number,o.customer_id AS "customerId",${customerName}::text AS "customerName",o.due_date::date::text AS "dueDate",o.handover_mode AS handover,o.version,o.print_symbol_slot AS slot,o.print_symbol_generation AS generation,o.print_symbol_active AS active
  FROM public.orders o WHERE o.tenant_id=${auth.tenantId} AND o.id=${orderId} FOR UPDATE OF o`);
 if(orders.length!==1)throw Error('ORDER_PRINT_ORDER_MISSING');
 const order=orders[0],requestKey=automaticKey(order.id,1);
 if(await readInitialQueue(tx,auth,order.id,itemIds.length+1))return;
 if(order.version!==1)throw Error('ORDER_PRINT_INITIAL_VERSION_CHANGED');
 const rows=await tx.execute<Position>(sql`SELECT id,name,quantity::text,unit,surface_requested AS surface,execution_requested AS execution FROM public.items WHERE tenant_id=${auth.tenantId} AND order_id=${order.id} ORDER BY id`);
 if(!rows.length||new Set(itemIds).size!==itemIds.length||rows.length!==itemIds.length||itemIds.some(id=>!rows.some(row=>row.id===id)))throw Error('ORDER_PRINT_POSITIONS_MISSING');
 // Sheet numbering follows the canonical intake receipt, never random UUID sorting.
 const positions=itemIds.map(id=>rows.find(row=>row.id===id)!);
 // One tenant lock also protects the exhausted-pool symbol+letter namespace.
 await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtextextended(${auth.tenantId+':order-print-symbol'},0))`);
 if(order.slot!==null||order.generation!==null||order.active)throw Error('ORDER_PRINT_SYMBOL_ALREADY_BOUND');
 const occupied=await tx.execute<{slot:number;generation:number}>(sql`SELECT print_symbol_slot AS slot,print_symbol_generation AS generation FROM public.orders WHERE tenant_id=${auth.tenantId} AND print_symbol_active ORDER BY print_symbol_generation,print_symbol_slot`);
 const used=new Set(occupied.map(row=>row.generation*40+row.slot));
 let candidate=0;while(used.has(candidate))candidate++;
 const slot=candidate%40,generation=Math.floor(candidate/40);
 const changed=await tx.execute(sql`UPDATE public.orders SET print_symbol_slot=${slot},print_symbol_generation=${generation},print_symbol_active=true WHERE tenant_id=${auth.tenantId} AND id=${order.id} AND print_symbol_slot IS NULL AND NOT print_symbol_active RETURNING id`);
 if(changed.length!==1)throw Error('ORDER_PRINT_SYMBOL_NOT_SAVED');
 const snapshot={orderId:order.id,orderNumber:order.number,customerId:order.customerId,customerName:order.customerName,dueDate:order.dueDate,handover:order.handover,symbol:{slot,generation},positions};
 const sheets=[{itemId:null as string|null,kind:'gesamt'},...positions.map(position=>({itemId:position.id,kind:'position'}))];
 const jobs:string[]=[];
 for(const sheet of sheets){
  const id=randomUUID();
  const saved=await tx.execute<{id:string}>(sql`INSERT INTO public.print_jobs(id,tenant_id,order_id,item_id,kind,sheet_kind,content_version,request_key,created_by,snapshot)
   VALUES(${id}::uuid,${auth.tenantId},${order.id},${sheet.itemId},'laufzettel',${sheet.kind},${order.version},${requestKey}::uuid,${auth.userId}::uuid,${JSON.stringify(snapshot)}::jsonb) RETURNING id::text`);
  if(saved.length!==1||saved[0].id!==id)throw Error('ORDER_PRINT_JOB_NOT_SAVED');
  jobs.push(id);
 }
 const eventId=randomUUID(),snapshotSha256=createHash('sha256').update(canonicalJson(snapshot)).digest('hex');
 const receipt=await tx.execute(sql`INSERT INTO public.events(id,tenant_id,order_id,event_type,status,user_id,client_event_id,correlation_id,event_schema_version,aggregate_version,payload)
  VALUES(${eventId},${auth.tenantId},${order.id},'ORDER_PRINT_JOBS_QUEUED_V1','success',${auth.userId}::uuid,${requestKey}::uuid,${requestKey}::uuid,1,${order.version},${JSON.stringify({orderId:order.id,orderVersion:order.version,symbol:{slot,generation},jobIds:jobs,snapshotSha256})}::jsonb) RETURNING id`);
 if(receipt.length!==1)throw Error('ORDER_PRINT_RECEIPT_NOT_SAVED');
}

/** Physical handover frees the symbol and cancels waiting sheets in the same order transaction. */
export async function retireOrderPrintJobsAfterGoodsOut(tx:PrivilegedTenantTransaction,auth:AuthorizationSnapshot,input:{orderId:string;clientEventId:string}){
 const rows=await tx.execute<{slot:number|null;generation:number|null;active:boolean;eligible:boolean;version:number}>(sql`SELECT print_symbol_slot AS slot,print_symbol_generation AS generation,print_symbol_active AS active,version,(station='abgeholt' AND status='abgeholt' AND current_station='abgeholt' AND current_station_id='abgeholt') AS eligible FROM public.orders WHERE tenant_id=${auth.tenantId} AND id=${input.orderId} FOR UPDATE`);
 if(rows.length!==1)throw Error('ORDER_PRINT_RETIRE_ORDER_INVALID');
 const order=rows[0];if(!order.active)return;if(!order.eligible)throw Error('ORDER_PRINT_RETIRE_ORDER_INVALID');
 const proof=await tx.execute<{id:string}>(sql`SELECT id FROM public.events WHERE tenant_id=${auth.tenantId} AND client_event_id=${input.clientEventId}::uuid AND order_id=${input.orderId} AND user_id=${auth.userId}::uuid AND event_type IN ('ORDER_PICKED_UP_V1','ORDER_PICKED_UP_V2','ORDER_PICKED_UP_V3','ORDER_PICKED_UP_V4') AND status='success' AND aggregate_version=${order.version}`);
 if(proof.length!==1)throw Error('ORDER_PRINT_RETIRE_PROOF_MISSING');
 await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtextextended(${auth.tenantId+':order-print-symbol'},0))`);
 const jobs=await tx.execute<{id:string}>(sql`UPDATE public.print_jobs SET status='storniert' WHERE tenant_id=${auth.tenantId} AND order_id=${input.orderId} AND status IN ('wartet','fehlgeschlagen') RETURNING id::text`);
 const changed=await tx.execute(sql`UPDATE public.orders SET print_symbol_active=false WHERE tenant_id=${auth.tenantId} AND id=${input.orderId} AND print_symbol_active RETURNING id`);
 if(changed.length!==1)throw Error('ORDER_PRINT_RETIRE_SYMBOL_NOT_SAVED');
 const receipt=await tx.execute(sql`INSERT INTO public.events(id,tenant_id,order_id,event_type,status,user_id,client_event_id,event_schema_version,aggregate_version,payload)
  VALUES(${randomUUID()},${auth.tenantId},${input.orderId},'ORDER_PRINT_JOBS_RETIRED_V1','success',${auth.userId}::uuid,${randomUUID()}::uuid,1,${order.version},${JSON.stringify({goodsOutEventId:proof[0].id,symbol:{slot:order.slot,generation:order.generation},jobIds:jobs.map(job=>job.id)})}::jsonb) RETURNING id`);
 if(receipt.length!==1)throw Error('ORDER_PRINT_RETIRE_RECEIPT_NOT_SAVED');
}
