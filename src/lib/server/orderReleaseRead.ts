import 'server-only';
import {sql} from 'drizzle-orm';
import type {PrivilegedTenantTransaction} from './privilegedDb';
import {withPrivilegedTenantTransaction} from './privilegedDb';
import type {AuthorizationSnapshot} from './authorization';
import {hasAuthorizationArea,canTransportInvoiceDocument} from '@/lib/auth/authorizationContract';
import {createHash,randomUUID} from 'node:crypto';
import {overdueInvoiceCondition} from './paymentContract';
import {readCommunicationDeliveryFailures} from './communicationDeliveryPort';

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

export async function readOrderInformed(auth:AuthorizationSnapshot,orderId:string){
 if(!hasAuthorizationArea(auth,'auftraege'))return {code:'FORBIDDEN' as const};
 try{return await withPrivilegedTenantTransaction(auth,async tx=>{
  const rows=await tx.execute<{payload:{receipt:InformedReceipt};proof_ok:boolean}>(sql`SELECT event.payload,
    (event.payload->'receipt'->>'actorId'=event.user_id::text AND event.payload->'receipt'->>'orderId'=event.order_id
    AND event.payload->'receipt'->>'eventId'=event.id::text AND event.event_schema_version=1
    AND (event.payload->'receipt'->>'channel'='telefon' AND event.payload->'receipt'->'threadId'='null'::jsonb OR
     event.payload->'receipt'->>'channel'='mail' AND EXISTS(SELECT 1 FROM public.communication_threads thread
      JOIN public.communication_messages message ON message.tenant_id=thread.tenant_id AND message.thread_id=thread.id AND message.direction='outgoing' AND message.channel='email'
      JOIN public.events sent ON sent.tenant_id=thread.tenant_id AND sent.event_type='COMMUNICATION_DOCUMENT_SENT_V1' AND sent.payload->>'threadId'=thread.id::text
      WHERE thread.tenant_id=event.tenant_id AND thread.id::text=event.payload->'receipt'->>'threadId' AND thread.status='sent'
       AND sent.payload->'document'->>'kind'='INVOICE'
       AND (sent.payload->'document'->>'orderId'=event.order_id OR EXISTS(SELECT 1 FROM jsonb_array_elements(coalesce(sent.payload->'document'->'bundle','[]'::jsonb)) member WHERE member->>'orderId'=event.order_id))
       AND sent.payload->>'intent'=event.payload->>'intent'))) AS proof_ok
   FROM public.events event JOIN private.v_order_freeze_state_v1 freeze_state ON freeze_state.tenant_id=event.tenant_id AND freeze_state.order_id=event.order_id
   WHERE event.tenant_id=${auth.tenantId} AND event.order_id=${orderId} AND event.event_type='ORDER_CUSTOMER_INFORMED_V1' AND event.status='success'
    AND freeze_state.active AND freeze_state.integrity_ok AND event.payload->'receipt'->>'freezeId'=freeze_state.freeze_id::text
   ORDER BY event.created_at ASC,event.id ASC LIMIT 1001`);
  if(rows.length>1000||rows.some(row=>row.proof_ok!==true||!Number.isFinite(Date.parse(row.payload.receipt.recordedAt))))throw Error('ORDER_NOTIFICATION_PROOF_INVALID');
  const order=await tx.execute<{customer_id:string;station:string;version:number;handover_mode:'pickup'|'shipping'|null;allowed:boolean;invoice_state:string;payment_allowed:boolean|null;frozen_at:string|null;freeze_id:string|null;debt_ids:string[]}>(sql`SELECT orders.customer_id,orders.station,orders.version,orders.handover_mode,private.order_release_allowed_v1(orders.tenant_id,orders.id) AS allowed,
   state.invoice_state,state.payment_goods_out_allowed AS payment_allowed,freeze_state.frozen_at::text,freeze_state.freeze_id::text,
   ARRAY(SELECT invoice.id::text FROM public.invoices invoice WHERE invoice.tenant_id=orders.tenant_id AND invoice.customer_id=orders.customer_id AND ${overdueInvoiceCondition()} ORDER BY invoice.id) AS debt_ids
   FROM public.orders orders JOIN private.v_goods_out_ui_state_v1 state ON state.tenant_id=orders.tenant_id AND state.order_id=orders.id AND state.integrity_ok
   LEFT JOIN private.v_order_frozen_receipts_v1 freeze_state ON freeze_state.tenant_id=orders.tenant_id AND freeze_state.order_id=orders.id AND freeze_state.active AND freeze_state.integrity_ok
   WHERE orders.tenant_id=${auth.tenantId} AND orders.id=${orderId}`);
  if(order.length!==1)return {code:'NOT_FOUND' as const};
  const failures=await readCommunicationDeliveryFailures(tx,auth,rows.flatMap(row=>row.payload.receipt.threadId?[row.payload.receipt.threadId]:[]));
  const failedThreads=new Set(failures.map(proof=>proof.threadId));
  const delivered=rows.filter(row=>row.payload.receipt.channel==='telefon'||!row.payload.receipt.threadId||!failedThreads.has(row.payload.receipt.threadId));
  const informed=delivered.at(-1)?.payload.receipt??null,firstInformed=delivered[0]?.payload.receipt??null;
  const latest=rows.at(-1)?.payload.receipt;
  const failedDelivery=latest?.threadId?failures.find(proof=>proof.threadId===latest.threadId)??null:null;
  const current=order[0],complaint=await readOpenOrderComplaint(tx,auth.tenantId,orderId);
  const invoiceMailOriginals=canTransportInvoiceDocument(auth)&&current.station==='fertig'?(await (await import('./communicationDocumentPort')).readInvoiceMailCohort(tx,auth.tenantId,current.customer_id,current.handover_mode)).map(row=>({id:row.id,orderId:row.order_id,version:row.aggregate_version})):undefined;
  const blockReason=current.allowed?null:!current.frozen_at?'not_frozen':complaint?'open_complaint':current.debt_ids.length?'overdue_invoice':!current.payment_allowed?'payment':null;
  const ampel:'rot'|'gelb'|'gruen'|null=current.station==='fertig'?(!informed||complaint||!current.allowed&&current.debt_ids.length?'rot':current.allowed?'gruen':'gelb'):null;
  return {code:'OK' as const,informed,firstInformed,mailThreadIds:[...new Set(rows.flatMap(row=>row.payload.receipt.channel==='mail'&&row.payload.receipt.threadId?[row.payload.receipt.threadId]:[]))],ampel,
   orderVersion:current.version,invoiceMailOriginals,handover:current.handover_mode,releaseAllowed:current.allowed,frozenAt:current.frozen_at,freezeId:current.freeze_id,invoiceState:current.invoice_state,paymentReady:typeof current.payment_allowed==='boolean'?current.payment_allowed:undefined,responseSince:rows[0]?.payload.receipt.recordedAt??null,failedDelivery:failedDelivery?{threadId:failedDelivery.threadId,recordedAt:failedDelivery.recordedAt}:null,
   blockReason,complaintIds:complaint?.complaintIds??[],overdueInvoiceIds:hasAuthorizationArea(auth,'geld')?current.debt_ids:undefined};
 });}catch(error){console.error('[ORDER_NOTIFICATION_READ_FAILED]',error);return {code:'UNAVAILABLE' as const};}
}

/** Existing complaint rows are the release block; no stored second flag. */
export async function readOpenOrderComplaint(tx:PrivilegedTenantTransaction,tenantId:string,orderId:string){
 const rows=await tx.execute<{id:string;number:string|null}>(sql`
  SELECT id,nummer AS number FROM public.complaints
  WHERE tenant_id=${tenantId} AND order_id=${orderId}
    AND stand IS DISTINCT FROM 'abgeschlossen'
  ORDER BY created_at,id
 `);
 return rows[0]?{...rows[0],complaintIds:rows.map(row=>row.id)}:null;
}
