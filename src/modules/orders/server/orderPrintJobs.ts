import 'server-only';
import {createHash,randomUUID} from 'node:crypto';
import {sql} from 'drizzle-orm';
import type {AuthorizationSnapshot} from '@/lib/server/authorization';
import type {PrivilegedTenantTransaction} from '@/lib/server/privilegedDb';

function automaticKey(orderId:string,version:number){
 const h=createHash('sha256').update(JSON.stringify(['order-print',orderId,version])).digest('hex');
 return `${h.slice(0,8)}-${h.slice(8,12)}-5${h.slice(13,16)}-8${h.slice(17,20)}-${h.slice(20,32)}`;
}
type Position={id:string;name:string;quantity:string;unit:string|null;surface:string|null;execution:string};
type Order={id:string;number:string;customerId:string;customerName:string;dueDate:string|null;handover:string|null;version:number;slot:number|null;generation:number|null;active:boolean};

/** Part of the canonical order transaction. It queues real work; it never reports a print. */
export async function createInitialOrderPrintJobs(tx:PrivilegedTenantTransaction,auth:AuthorizationSnapshot,orderId:string,customerName:string){
 const orders=await tx.execute<Order>(sql`SELECT o.id,o.order_number AS number,o.customer_id AS "customerId",${customerName}::text AS "customerName",o.due_date::text AS "dueDate",o.handover_mode AS handover,o.version,o.print_symbol_slot AS slot,o.print_symbol_generation AS generation,o.print_symbol_active AS active
  FROM public.orders o WHERE o.tenant_id=${auth.tenantId} AND o.id=${orderId} FOR UPDATE OF o`);
 if(orders.length!==1)throw Error('ORDER_PRINT_ORDER_MISSING');
 const order=orders[0],requestKey=automaticKey(order.id,1);
 const existing=await tx.execute<{user_id:string;payload:{orderId:string;orderVersion:number;jobIds:string[]}}>(sql`SELECT user_id::text,payload FROM public.events WHERE tenant_id=${auth.tenantId} AND event_type='ORDER_PRINT_JOBS_QUEUED_V1' AND client_event_id=${requestKey}::uuid AND status='success' AND event_schema_version=1 AND order_id=${order.id}`);
 if(existing.length){
  const original=existing[0],jobs=await tx.execute<{id:string;created_by:string}>(sql`SELECT id::text,created_by::text FROM public.print_jobs WHERE tenant_id=${auth.tenantId} AND order_id=${order.id} AND request_key=${requestKey}::uuid AND content_version=1 ORDER BY id`);
  if(existing.length!==1||original.payload.orderId!==order.id||original.payload.orderVersion!==1||!Array.isArray(original.payload.jobIds)||!jobs.length||jobs.some(job=>job.created_by!==original.user_id)||JSON.stringify(jobs.map(job=>job.id))!==JSON.stringify([...original.payload.jobIds].sort()))throw Error('ORDER_PRINT_INITIAL_RECEIPT_INVALID');
  return;
 }
 if(order.version!==1)throw Error('ORDER_PRINT_INITIAL_VERSION_CHANGED');
 const positions=await tx.execute<Position>(sql`SELECT id,name,quantity::text,unit,surface_requested AS surface,execution_requested AS execution FROM public.items WHERE tenant_id=${auth.tenantId} AND order_id=${order.id} ORDER BY id`);
 if(!positions.length)throw Error('ORDER_PRINT_POSITIONS_MISSING');
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
 const eventId=randomUUID();
 const receipt=await tx.execute(sql`INSERT INTO public.events(id,tenant_id,order_id,event_type,status,user_id,client_event_id,correlation_id,event_schema_version,aggregate_version,payload)
  VALUES(${eventId},${auth.tenantId},${order.id},'ORDER_PRINT_JOBS_QUEUED_V1','success',${auth.userId}::uuid,${requestKey}::uuid,${requestKey}::uuid,1,${order.version},${JSON.stringify({orderId:order.id,orderVersion:order.version,symbol:{slot,generation},jobIds:jobs})}::jsonb) RETURNING id`);
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
