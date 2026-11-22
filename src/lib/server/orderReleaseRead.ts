import 'server-only';
import {sql,type SQL} from 'drizzle-orm';
import type {PrivilegedTenantTransaction} from './privilegedDb';
import {withPrivilegedTenantTransaction} from './privilegedDb';
import type {AuthorizationSnapshot} from './authorization';
import {authorizationReadContext,type AuthorizedReadContext} from './authorizationReadContext';
import {hasAuthorizationArea} from '@/lib/auth/authorizationContract';
import {createHash,randomUUID} from 'node:crypto';
import {readCommunicationDeliveryFailures} from './communicationDeliveryPort';
import {invoiceAlreadySent} from './communicationDocumentPort';

type ReadyContext={id:string;version:number;freeze_id:string};
export async function readReadyNotificationContext(tx:PrivilegedTenantTransaction,tenantId:string,orderId:string){
 const rows=await tx.execute<ReadyContext>(sql`SELECT orders.id,orders.version,freeze_state.freeze_id::text
  FROM public.orders orders JOIN private.v_order_freeze_state_v1 freeze_state ON freeze_state.tenant_id=orders.tenant_id AND freeze_state.order_id=orders.id
  WHERE orders.tenant_id=${tenantId} AND orders.id=${orderId} AND orders.station='fertig'
   AND orders.current_station='fertig' AND orders.current_station_id='fertig' AND orders.status='fertig'
   AND freeze_state.active AND freeze_state.integrity_ok FOR UPDATE OF orders`);
 return rows.length===1?rows[0]:null;
}

type InformedReceipt={eventId:string;orderId:string;freezeId:string;actorId:string;channel:'mail'|'telefon';recordedAt:string;threadId:string|null};
/** One immutable source for customer notification, separate from financial release. */
export async function appendOrderInformed(tx:PrivilegedTenantTransaction,auth:AuthorizationSnapshot,input:{orderId:string;clientEventId:string;channel:'mail'|'telefon';threadId?:string;intent:string}){
 const context=await readReadyNotificationContext(tx,auth.tenantId,input.orderId);
 if(!context)throw Error('ORDER_NOTIFICATION_NOT_READY');
 const receipt:InformedReceipt={eventId:randomUUID(),orderId:input.orderId,freezeId:context.freeze_id,actorId:auth.userId,channel:input.channel,recordedAt:new Date().toISOString(),threadId:input.threadId??null};
 const saved=await tx.execute<{id:string}>(sql`INSERT INTO public.events(id,tenant_id,order_id,event_type,description,payload,status,user_id,client_event_id,correlation_id,event_schema_version,created_at)
 VALUES(${receipt.eventId},${auth.tenantId},${input.orderId},'ORDER_CUSTOMER_INFORMED_V1','Kunde informiert',${JSON.stringify({intent:input.intent,receipt})}::jsonb,'success',${auth.userId}::uuid,${input.clientEventId}::uuid,${input.clientEventId}::uuid,1,${receipt.recordedAt}::timestamptz) RETURNING id`);
 if(saved.length!==1||saved[0].id!==receipt.eventId)throw Error('ORDER_NOTIFICATION_RECEIPT_NOT_SAVED');
 return receipt;
}

export async function markOrderInformedByPhone(auth:AuthorizationSnapshot,input:{orderId:string;expectedVersion:number;clientEventId:string}){
 if(!hasAuthorizationArea(auth,'auftraege'))return {code:'FORBIDDEN' as const,message:'Aufträge sind nicht freigegeben.'};
 const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
 if(!input||typeof input!=='object'||Array.isArray(input)||Object.keys(input).sort().join(',')!=='clientEventId,expectedVersion,orderId'||!uuid.test(input.orderId)||!uuid.test(input.clientEventId)||!Number.isSafeInteger(input.expectedVersion)||input.expectedVersion<1)return {code:'VALIDATION_ERROR' as const,message:'Auftragsstand oder Kennung ungültig.'};
 const intent=createHash('sha256').update(JSON.stringify([input.orderId,input.expectedVersion,'telefon'])).digest('hex');
 try{return await withPrivilegedTenantTransaction(auth,async tx=>{
  await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtextextended(${auth.tenantId+':'+input.clientEventId},0))`);
  const prior=await tx.execute<{id:string;event_type:string;user_id:string;order_id:string;payload:{intent:string;receipt:InformedReceipt}}>(sql`SELECT id::text,event_type,user_id::text,order_id,payload FROM public.events WHERE tenant_id=${auth.tenantId} AND client_event_id=${input.clientEventId}::uuid`);
  if(prior.length){
   const event=prior[0];if(prior.length!==1||event.event_type!=='ORDER_CUSTOMER_INFORMED_V1'||event.user_id!==auth.userId||event.order_id!==input.orderId||event.payload.intent!==intent)return {code:'CONFLICT' as const,message:'Diese Kennung wurde bereits anders verwendet.'};
   const receipt=event.payload.receipt;
   if(!receipt||receipt.eventId!==event.id||receipt.actorId!==event.user_id||receipt.orderId!==event.order_id||receipt.channel!=='telefon'||receipt.threadId!==null||!uuid.test(receipt.freezeId)||!Number.isFinite(Date.parse(receipt.recordedAt)))throw Error('ORDER_PHONE_NOTIFICATION_RECEIPT_INVALID');
   return {code:'OK' as const,receipt,replayed:true};
  }
  const context=await readReadyNotificationContext(tx,auth.tenantId,input.orderId);
  if(!context||context.version!==input.expectedVersion)return {code:'CONFLICT' as const,message:'Der Auftrag ist nicht mehr in diesem Fertig-Stand.'};
  const receipt=await appendOrderInformed(tx,auth,{...input,channel:'telefon',intent});
  return {code:'OK' as const,receipt,replayed:false};
 });}catch(error){console.error('[ORDER_PHONE_NOTIFICATION_FAILED]',error);return {code:'UNAVAILABLE' as const,message:'Telefonbescheid konnte nicht sicher gespeichert werden.'};}
}

type InformedSourceRow={payload:{receipt:InformedReceipt};proof_ok:boolean};
type InformedOrderRow={customer_id:string;station:string;version:number;handover_mode:'pickup'|'shipping'|null;allowed:boolean;invoice_state:string;invoice_id:string|null;payment_allowed:boolean|null;frozen_at:string|null;freeze_id:string|null;goods_out_event_id:string|null;debt_ids:string[]};
type InformedComplaint=Awaited<ReturnType<typeof readOpenOrderComplaint>>;
async function readInformedCohort(tx:PrivilegedTenantTransaction,auth:Pick<AuthorizationSnapshot,'tenantId'>,customerId:string,handover:'pickup'|'shipping'|null){
 return (await import('./communicationDocumentPort')).readInvoiceMailCohort(tx,auth.tenantId,customerId,handover);
}
type InformedCohort=Awaited<ReturnType<typeof readInformedCohort>>;


async function qualifyOrderInformed(tx:PrivilegedTenantTransaction,auth:AuthorizedReadContext,orderId:string,rows:InformedSourceRow[],order:InformedOrderRow[],complaint:InformedComplaint,readCohort:(customerId:string,handover:'pickup'|'shipping'|null)=>Promise<InformedCohort>,failures:Awaited<ReturnType<typeof readCommunicationDeliveryFailures>>,collectionState:Awaited<ReturnType<typeof import('./commands/recordGoodsOutCommand').readOrderCollectionStateInTransaction>>|undefined){
  if(rows.length>1000||rows.some(row=>row.proof_ok!==true||!Number.isFinite(Date.parse(row.payload.receipt.recordedAt))))throw Error('ORDER_NOTIFICATION_PROOF_INVALID');
  if(order.length!==1)return {code:'NOT_FOUND' as const};
  const failedThreads=new Set(failures.map(proof=>proof.threadId));
  const delivered=rows.filter(row=>row.payload.receipt.channel==='telefon'||!row.payload.receipt.threadId||!failedThreads.has(row.payload.receipt.threadId));
  const informed=delivered.at(-1)?.payload.receipt??null,firstInformed=delivered[0]?.payload.receipt??null;
  const latest=rows.at(-1)?.payload.receipt;
  const failedDelivery=latest?.threadId?failures.find(proof=>proof.threadId===latest.threadId)??null:null;
  const current=order[0];
  if(collectionState===undefined)throw Error('COLLECTION_PLAN_SOURCE_MISSING');
  const invoiceMailOriginals=auth.canReadArea('preise')&&current.station==='fertig'?(await readCohort(current.customer_id,current.handover_mode)).map(row=>({id:row.id,orderId:row.order_id,version:row.aggregate_version})):undefined;
  let invoiceMailQueued=invoiceMailOriginals===undefined?undefined:false;
  if(invoiceMailOriginals?.length===101&&current.invoice_id!==null&&!invoiceMailOriginals.some(row=>row.id===current.invoice_id)){
   const proof=await tx.execute<{unsent:boolean}>(sql`SELECT NOT ${invoiceAlreadySent(auth.tenantId,sql`${current.invoice_id}::uuid`)} AS unsent`);
   if(proof.length!==1||typeof proof[0].unsent!=='boolean')throw Error('INVOICE_MAIL_QUEUE_SOURCE_INVALID');
   invoiceMailQueued=proof[0].unsent;
  }
  const blockReason=current.allowed?null:!current.frozen_at?'not_frozen':complaint?'open_complaint':current.debt_ids.length?'overdue_invoice':!current.payment_allowed?'payment':null;
  const ampel:'rot'|'gelb'|'gruen'|null=current.station==='fertig'?(!informed||complaint||!current.allowed&&current.debt_ids.length?'rot':current.allowed?'gruen':'gelb'):null;
  return {code:'OK' as const,informed,firstInformed,mailThreadIds:[...new Set(rows.flatMap(row=>row.payload.receipt.channel==='mail'&&row.payload.receipt.threadId?[row.payload.receipt.threadId]:[]))],ampel,
   orderVersion:current.version,collectionState,invoiceMailOriginals,invoiceMailQueued,handover:current.handover_mode,releaseAllowed:current.allowed,frozenAt:current.frozen_at,freezeId:current.freeze_id,invoiceState:current.invoice_state,paymentReady:typeof current.payment_allowed==='boolean'?current.payment_allowed:undefined,responseSince:rows[0]?.payload.receipt.recordedAt??null,failedDelivery:failedDelivery?{threadId:failedDelivery.threadId,recordedAt:failedDelivery.recordedAt}:null,
   blockReason,complaintIds:complaint?.complaintIds??[],overdueInvoiceIds:auth.canReadArea('zahlungen')?current.debt_ids:undefined};

}
type InformedRead=Awaited<ReturnType<typeof qualifyOrderInformed>>|{code:'UNAVAILABLE'}|{code:'FORBIDDEN'};
/** One native transaction for a qualified set. A SQL error is rolled back before isolating that set. */
async function readOrderInformedGroup(auth:AuthorizedReadContext,orderIds:string[]){
 return withPrivilegedTenantTransaction(auth,async tx=>{
  const receipts=new Map<string,InformedSourceRow[]>(orderIds.map(id=>[id,[]]));
  const orders=new Map<string,InformedOrderRow[]>(orderIds.map(id=>[id,[]]));
  const complaints=await readOpenOrderComplaintsBatch(tx,auth.tenantId,orderIds);
  {
   const requested=sql`ARRAY[${sql.join(orderIds.map(id=>sql`${id}`),sql`, `)}]::text[]`;
   // ARRAY preserves each canonical source's ORDER BY and per-object LIMIT.
   const receiptRecords=await tx.execute<{batch_order_id:string;records:InformedSourceRow[]}>(sql`SELECT * FROM private.read_order_informed_receipts_v1(${auth.tenantId},${requested})`);
   const orderRecords=await tx.execute<InformedOrderRow & {batch_order_id:string}>(sql`SELECT * FROM private.read_order_informed_orders_v1(${auth.tenantId},${requested})`);
   const seenReceipts=new Set<string>();
   for(const {batch_order_id,records} of receiptRecords){if(!receipts.has(batch_order_id)||seenReceipts.has(batch_order_id)||!Array.isArray(records))throw Error('ORDER_NOTIFICATION_PROOF_INVALID');seenReceipts.add(batch_order_id);receipts.set(batch_order_id,records);}
   if(seenReceipts.size!==orderIds.length)throw Error('ORDER_NOTIFICATION_PROOF_INVALID');
   for(const {batch_order_id,...source} of orderRecords){const rows=orders.get(batch_order_id);if(!rows)throw Error('ORDER_NOTIFICATION_PROOF_INVALID');rows.push(source);}

  }
  const cohorts=new Map<string,InformedCohort>();
  const readCohort=async(customerId:string,handover:'pickup'|'shipping'|null)=>{
   const key=JSON.stringify([customerId,handover]);const prior=cohorts.get(key);if(prior)return prior;
   const value=await readInformedCohort(tx,auth,customerId,handover);cohorts.set(key,value);return value;
  };
  const threadIds=[...new Set([...receipts.values()].flatMap(rows=>rows.flatMap(row=>row.payload.receipt.threadId?[row.payload.receipt.threadId]:[])))];
  const failures=await readCommunicationDeliveryFailures(tx,auth,threadIds);
  const {readOrderCollectionStatesInTransaction}=await import('./commands/recordGoodsOutCommand');
  const collectionInputs=orderIds.flatMap(orderId=>{
   const source=orders.get(orderId);if(!source)throw Error('ORDER_NOTIFICATION_PROOF_INVALID');
   if(source.length!==1)return []; // same per-order NOT_FOUND result below
   const current=source[0];return [{orderId,orderVersion:current.version,customerId:current.customer_id,freezeId:current.freeze_id,goodsOutEventId:current.goods_out_event_id}];
  });
  const collections=await readOrderCollectionStatesInTransaction(tx,auth,collectionInputs);
  const result=new Map<string,InformedRead>();
  for(const id of orderIds){
   const rows=receipts.get(id),order=orders.get(id),complaint=complaints.get(id);
   if(!rows||!order||complaint===undefined)throw Error('ORDER_NOTIFICATION_PROOF_INVALID');
   const ownThreads=new Set(rows.flatMap(row=>row.payload.receipt.threadId?[row.payload.receipt.threadId]:[]));
   result.set(id,await qualifyOrderInformed(tx,auth,id,rows,order,complaint,readCohort,failures.filter(proof=>ownThreads.has(proof.threadId)),collections.get(id)));
  }
  return result;
 });
}
export async function readOrdersInformed(auth:AuthorizationSnapshot|AuthorizedReadContext,orderIds:readonly string[]):Promise<Map<string,InformedRead>>{
 const readAuth='canReadArea'in auth?auth:authorizationReadContext(auth);
 const result=new Map<string,InformedRead>(),ids=[...new Set(orderIds)];
 if(!readAuth.canReadArea('auftraege')){for(const id of ids)result.set(id,{code:'FORBIDDEN'});return result;}
 const read=async(group:string[]):Promise<void>=>{
  if(!group.length)return;
  try{const rows=await readOrderInformedGroup(readAuth,group);for(const id of group){const value=rows.get(id);if(!value)throw Error('ORDER_NOTIFICATION_PROOF_INVALID');result.set(id,value);}}
  catch(error){if(group.length===1){console.error('[ORDER_NOTIFICATION_READ_FAILED]',error);result.set(group[0],{code:'UNAVAILABLE'});return;}const half=Math.ceil(group.length/2);await read(group.slice(0,half));await read(group.slice(half));}
 };
 await read(ids);return result;
}
export async function readOrderInformed(auth:AuthorizationSnapshot|AuthorizedReadContext,orderId:string){
 const result=await readOrdersInformed(auth,[orderId]);return result.get(orderId)??{code:'UNAVAILABLE' as const};
}


/** Existing complaint rows are the release block; no stored second flag. */
type OpenComplaintRow={id:string;number:string|null};
function openComplaintQuery(tenantId:string,orderId:string|SQL){return sql`
  SELECT id,nummer AS number FROM public.complaints
  WHERE tenant_id=${tenantId} AND order_id=${orderId}
    AND stand IS DISTINCT FROM 'abgeschlossen'
  ORDER BY created_at,id
 `;}
function qualifyOpenComplaint(rows:OpenComplaintRow[]){return rows[0]?{...rows[0],complaintIds:rows.map(row=>row.id)}:null;}
export async function readOpenOrderComplaint(tx:PrivilegedTenantTransaction,tenantId:string,orderId:string){
 const result=await readOpenOrderComplaintsBatch(tx,tenantId,[orderId]);
 const complaint=result.get(orderId);
 if(complaint===undefined)throw Error('ORDER_NOTIFICATION_PROOF_INVALID');
 return complaint;
}
/** The same canonical predicate/order and qualifier, once for the requested set. */
export async function readOpenOrderComplaintsBatch(tx:PrivilegedTenantTransaction,tenantId:string,orderIds:readonly string[]):Promise<Map<string,ReturnType<typeof qualifyOpenComplaint>>>{
 const ids=[...new Set(orderIds)],result=new Map<string,ReturnType<typeof qualifyOpenComplaint>>();
 if(!ids.length)return result;
 const records=await tx.execute<{batch_order_id:string;records:OpenComplaintRow[]}>(sql`SELECT requested.order_id AS batch_order_id,ARRAY(SELECT to_jsonb(source) FROM (${openComplaintQuery(tenantId,sql`requested.order_id`)}) source) AS records FROM unnest(ARRAY[${sql.join(ids.map(id=>sql`${id}`),sql`, `)}]::text[]) requested(order_id)`);
 const requested=new Set(ids);
 for(const row of records){
  if(!requested.has(row.batch_order_id)||result.has(row.batch_order_id)||!Array.isArray(row.records))throw Error('ORDER_NOTIFICATION_PROOF_INVALID');
  result.set(row.batch_order_id,qualifyOpenComplaint(row.records));
 }
 if(result.size!==ids.length)throw Error('ORDER_NOTIFICATION_PROOF_INVALID');
 return result;
}
