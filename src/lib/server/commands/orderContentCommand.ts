import {isOrderCommandBase as validBase,isManualHandoverInput} from '@/lib/domain/orderHandoverContract';
import "server-only";

import { createHash, randomUUID } from "node:crypto";
import { sql } from "drizzle-orm";
import { normaliseOrderPositionSurface, normaliseOrderPositionUnit, orderPositionQuantityError, orderPositionSurfaceLabel, orderPositionUnitLabel, isOrderContentPrice } from "@/lib/orderPositionContract";
import {
  getAuthorizationActionGrants,
  hasAuthorizationArea,
  resolveAuthorization,
  type AuthorizationSnapshot,
} from "@/lib/server/authorization";
import { type PrivilegedTenantTransaction, withPrivilegedTenantTransaction,withTenantSavepoint } from "@/lib/server/privilegedDb";
import {intakeHandoverDirective} from '@/modules/eingang/public';
import {ORDER_HANDOVER_COPY, ORDER_ITEM_COMPLETION_COPY,PRODUCTION_PRICING_RETRY_COPY,ORDER_REQUEST_COPY} from '@/ui/situationCatalog';
import {appendProductionCompletion,appendProductionPricing,appendProductionReversals,ProductionPricingRetryNeeded,recordProductionPricingRetry,readProductionPricingRetrySource,repairProductionCompletionPricing} from '@/lib/server/productionSnapshotPort';
import {canChangeOrderHandover} from '@/lib/auth/authorizationContract';
import {readManualHandoverReceipt,type ManualHandoverReceipt} from '@/lib/server/orderHandoverSourcePort';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

export type OrderContentItemInput = {
  id: string;
  catalogServiceId: string | null;
  name: string;
  quantity: number;
  material: string | null;
  surface: string;
  unit: string | null;
  unitPriceCents: number | null;
  vatRateBasisPoints: 0 | 700 | 1900 | null;
};

export type ChangeOrderContentInput = {
  orderId: string;
  expectedVersion: number;
  clientEventId: string;
  note: string | null;
  items: OrderContentItemInput[];
};

export type SetOrderItemFinishedInput = {
  offlineOriginal?:import('@/lib/domain/offlineOriginal').OfflineOriginal;
  orderId: string;
  itemId: string;
  expectedVersion: number;
  clientEventId: string;
  finished: boolean;
};

export type OrderContentResult =
  | { code: "OK"; receipt: { eventId: string; aggregateVersion: number; actorId: string; occurredAt: string }; replayed: boolean }
  | { code: "UNAUTHENTICATED" | "FORBIDDEN" | "NOT_FOUND" | "CONFLICT" | "VALIDATION_ERROR" | "UNAVAILABLE"; message: string };

type OrderRow = { id: string; customer_id: string; version: number; station: string; status: string };
type ItemRow = { id: string; catalog_service_id: string | null };
type CatalogRow = { id: string; name: string; surface: string; unit: string; net_price_cents: number; vat_rate_basis_points: number; active: boolean };
type EventRow = { id: string; user_id: string; aggregate_version: number; created_at: Date | string; payload: unknown; event_type: string; order_id: string };

type PickupRow={id:string;version:number;station:string;status:string;pickup_by_name:string|null;pickup_by_note:string|null;pickup_by_source:string|null;pickup_by_at:Date|string|null;pickup_by_login:string|null;ausgabe_frei:boolean};

export async function readOrderPickupNotice(input:unknown){
  if(!input||typeof input!=="object"||Array.isArray(input)||typeof (input as Record<string,unknown>).orderId!=="string")return {code:"VALIDATION_ERROR" as const,message:"Auftragskennung fehlt."};
  const orderId=(input as {orderId:string}).orderId;
  const auth=await resolveAuthorization();
  if(!auth.ok)return {code:"UNAUTHENTICATED" as const,message:auth.message};
  if(!hasAuthorizationArea(auth.data,"eingang")&&!hasAuthorizationArea(auth.data,"auftraege"))return {code:"FORBIDDEN" as const,message:"Abholmitteilung ist nicht freigegeben."};
  try{
    const rows=await withPrivilegedTenantTransaction(auth.data,tx=>tx.execute<PickupRow>(sql`SELECT id,version,station,status,pickup_by_name,pickup_by_note,pickup_by_source,pickup_by_at,pickup_by_login::text,private.order_release_allowed_v1(tenant_id,id) AS ausgabe_frei
      FROM public.orders WHERE tenant_id=${auth.data.tenantId} AND id=${orderId}`));
    if(rows.length!==1)return {code:"NOT_FOUND" as const,message:"Auftrag nicht verfügbar."};
    return {code:"OK" as const,data:rows[0]};
  }catch(error){console.error("[ORDER_PICKUP_READ_FAILED]",error);return {code:"UNAVAILABLE" as const,message:"Abholmitteilung konnte nicht geladen werden. Fehlercode: ORDER_PICKUP_READ_FAILED."};}
}

/** DA01/DA02: one explicit confirmation replaces the notice; the event preserves its predecessor. */
export async function changeOrderPickupNotice(input:unknown,handover?:MailHandoverDependencies){
  if(input&&typeof input==='object'&&'command'in input&&input.command==='handover_manual')return handover?changeHandoverManually(input,handover):{code:'UNAVAILABLE' as const,message:ORDER_HANDOVER_COPY.unavailable};
  if(input&&typeof input==='object'&&'command'in input&&input.command==='handover_from_mail')return handover?changeHandoverFromMail(input,handover):{code:'UNAVAILABLE' as const,message:'Mail-Übergabevertrag ist nicht angebunden.'};
  if(!input||typeof input!=="object"||Array.isArray(input))return {code:"VALIDATION_ERROR" as const,message:"Abholmitteilung ist ungültig."};
  const value=input as Record<string,unknown>;
  if(Object.keys(value).sort().join(",")!=="clientEventId,expectedVersion,name,note,orderId,source"
    ||!validBase({orderId:value.orderId,expectedVersion:value.expectedVersion,clientEventId:value.clientEventId})
    ||!(value.name===null||typeof value.name==="string"&&value.name===value.name.trim()&&value.name.length>=1&&value.name.length<=160)
    ||!(value.note===null||typeof value.note==="string"&&value.note===value.note.trim()&&value.note.length<=120)
    ||!['mail','telefon','persoenlich','notiz'].includes(value.source as string))return {code:"VALIDATION_ERROR" as const,message:"Abholmitteilung ist unvollständig oder ungültig."};
  const auth=await resolveAuthorization();if(!auth.ok)return {code:"UNAUTHENTICATED" as const,message:auth.message};
  if(!hasAuthorizationArea(auth.data,"eingang")&&!hasAuthorizationArea(auth.data,"auftraege"))return {code:"FORBIDDEN" as const,message:"Abholmitteilung darf nicht geändert werden."};
  const requestHash=hash({orderId:value.orderId,expectedVersion:value.expectedVersion,name:value.name,note:value.note,source:value.source});
  try{
    return await withPrivilegedTenantTransaction(auth.data,async tx=>{
      await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtextextended('order-pickup:'||${auth.data.tenantId}||':'||${value.clientEventId},0))`);
      const prior=await tx.execute<EventRow>(sql`SELECT id,user_id::text,aggregate_version,created_at,payload,event_type,order_id FROM public.events
        WHERE tenant_id=${auth.data.tenantId} AND client_event_id=${value.clientEventId}::uuid LIMIT 2`);
      if(prior.length){const row=prior[0];return prior.length===1&&row.user_id===auth.data.userId&&row.event_type==='ORDER_PICKUP_NOTICE_CHANGED_V1'&&row.order_id===value.orderId
        &&(row.payload as {requestHash?:unknown})?.requestHash===requestHash?{code:"OK" as const,receipt:receipt(row),replayed:true}
        :{code:"CONFLICT" as const,message:"Diese Kennung wurde bereits anders verwendet."};}
      const rows=await tx.execute<PickupRow>(sql`SELECT id,version,station,status,pickup_by_name,pickup_by_note,pickup_by_source,pickup_by_at,pickup_by_login::text,private.order_release_allowed_v1(tenant_id,id) AS ausgabe_frei
        FROM public.orders WHERE tenant_id=${auth.data.tenantId} AND id=${value.orderId} FOR UPDATE`);
      const row=rows[0];if(rows.length!==1||!row)return {code:"NOT_FOUND" as const,message:"Auftrag nicht verfügbar."};
      if(row.version!==value.expectedVersion)return {code:"CONFLICT" as const,message:"Abholmitteilung wurde inzwischen geändert. Bitte abgleichen und erneut bestätigen.",current:row};
      if(row.station==='abgeholt'||row.status==='storniert')return {code:"CONFLICT" as const,message:"Dieser Auftrag ist bereits abgeschlossen."};
      const updated=await tx.execute<{version:number}>(sql`UPDATE public.orders SET pickup_by_name=${value.name},pickup_by_note=${value.note},pickup_by_source=${value.source},
        pickup_by_at=statement_timestamp(),pickup_by_login=${auth.data.userId}::uuid,version=version+1
        WHERE tenant_id=${auth.data.tenantId} AND id=${value.orderId} AND version=${value.expectedVersion} RETURNING version`);
      if(updated.length!==1)throw Error('ORDER_PICKUP_VERSION_CONFLICT');
      const events=await tx.execute<EventRow>(sql`INSERT INTO public.events(id,tenant_id,order_id,event_type,description,payload,status,user_id,client_event_id,event_schema_version,aggregate_version,correlation_id)
        VALUES(gen_random_uuid()::text,${auth.data.tenantId},${value.orderId},'ORDER_PICKUP_NOTICE_CHANGED_V1','Abholmitteilung geändert',
          ${JSON.stringify({requestHash,before:{name:row.pickup_by_name,note:row.pickup_by_note,source:row.pickup_by_source},after:{name:value.name,note:value.note,source:value.source}})}::jsonb,
          'success',${auth.data.userId}::uuid,${value.clientEventId}::uuid,1,${updated[0].version},gen_random_uuid())
        RETURNING id,user_id::text,aggregate_version,created_at,payload,event_type,order_id`);
      if(events.length!==1)throw Error('ORDER_PICKUP_EVENT_MISSING');
      return {code:"OK" as const,receipt:receipt(events[0]),replayed:false};
    });
  }catch(error){console.error("[ORDER_PICKUP_WRITE_FAILED]",error);return {code:"UNAVAILABLE" as const,message:"Abholmitteilung konnte nicht sicher gespeichert werden. Fehlercode: ORDER_PICKUP_WRITE_FAILED."};}
}

type MailHandoverInput={command:'handover_from_mail';sourceItemId:string;sourceVersion:number;clientEventId:string;orderId?:string;expectedVersion?:number};
type MailHandoverOrder={id:string;order_number:string|null;customer_id:string;version:number;handover_mode:'pickup'|'shipping'|null;station:string;status:string};
type MailProof={id:string;version:number;customerId:string;orderId:string|null;otherReference:boolean;sender:string;text:string;receivedAt:string;graphMessageId:string;originalSha256:string};
type MailHandoverDependencies={
 readMail:(tx:PrivilegedTenantTransaction,auth:AuthorizationSnapshot,input:{itemId:string;version:number;lock?:boolean})=>Promise<{code:'OK';mail:MailProof}|{code:'FORBIDDEN'|'NOT_FOUND'|'CONFLICT'|'VALIDATION_ERROR';message:string}>;
 recordEffect:(tx:PrivilegedTenantTransaction,auth:AuthorizationSnapshot,input:{itemId:string;version:number;orderId:string;clientEventId:string;taskId:string|null;mode:'pickup'|'shipping';requestedMode:'pickup'|'shipping'})=>Promise<void>;
 readCustomer:(tx:PrivilegedTenantTransaction,tenant:string,id:string)=>Promise<{id:string;name:string;phone:string|null;email:string|null;billingEmail:string|null}|null>;
 updateDefault:(tx:PrivilegedTenantTransaction,auth:AuthorizationSnapshot,input:{customerId:string;clientEventId:string;mode:'pickup'|'shipping'})=>Promise<{code:string}>;
 createTask:(tx:PrivilegedTenantTransaction,auth:AuthorizationSnapshot,input:{orderId:string;clientKey:string;title:string;note:string;manualEventId?:string},effect?: (id:string)=>Promise<void>)=>Promise<string>;
};

/** The sole handover-mode UPDATE and event INSERT for mail and login sources. */
async function writeOrderHandover<R>(tx:PrivilegedTenantTransaction,auth:AuthorizationSnapshot,input:{order:MailHandoverOrder;mode:'pickup'|'shipping';passed:boolean;clientEventId:string;eventId:string;eventType:'ORDER_HANDOVER_MAIL_V1'|'ORDER_HANDOVER_CHANGED_V1';requestHash:string;message:string;receipt:(version:number,at:string)=>R}){
 const {order}=input;
 const updated=input.passed?[{version:order.version}]:await tx.execute<{version:number}>(sql`UPDATE public.orders SET handover_mode=${input.mode},version=version+1
  WHERE tenant_id=${auth.tenantId} AND id=${order.id} AND version=${order.version} RETURNING version`);
 if(updated.length!==1)throw Error('HANDOVER_ORDER_VERSION_CONFLICT');
 const clocks=await tx.execute<{at:string}>(sql`SELECT to_char(statement_timestamp() AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') AS at`);
 if(clocks.length!==1)throw Error('HANDOVER_CLOCK_MISSING');
 const result=input.receipt(updated[0].version,clocks[0].at),payload={requestHash:input.requestHash,before:{handoverMode:order.handover_mode},receipt:result};
 await tx.execute(sql`INSERT INTO public.events(id,tenant_id,order_id,event_type,description,payload,status,user_id,client_event_id,event_schema_version,aggregate_version,correlation_id,created_at)
  VALUES(${input.eventId},${auth.tenantId},${order.id},${input.eventType},${input.message},${JSON.stringify(payload)}::jsonb,'success',${auth.userId}::uuid,${input.clientEventId}::uuid,1,${updated[0].version},gen_random_uuid(),${clocks[0].at}::timestamptz AT TIME ZONE 'UTC')`);
 const proof=await tx.execute(sql`SELECT id FROM public.events WHERE tenant_id=${auth.tenantId} AND id=${input.eventId}
  AND order_id=${order.id} AND user_id=${auth.userId}::uuid AND client_event_id=${input.clientEventId}::uuid
  AND event_type=${input.eventType} AND status='success' AND event_schema_version=1 AND aggregate_version=${updated[0].version}
  AND payload=${JSON.stringify(payload)}::jsonb`);
 if(proof.length!==1)throw Error('HANDOVER_EVENT_READBACK_MISSING');
 return result;
}

async function readHandoverBoundary(tx:PrivilegedTenantTransaction,auth:AuthorizationSnapshot,order:MailHandoverOrder){
 const shipments=await tx.execute<{carrier:string|null;label_url:string|null;status:string;shipped_at:unknown;delivered_at:unknown}>(sql`SELECT carrier,label_url,status,shipped_at,delivered_at FROM public.shipments WHERE tenant_id=${auth.tenantId} AND order_id=${order.id} ORDER BY created_at,id FOR UPDATE`);
 const shipped=shipments.find(row=>row.shipped_at||row.delivered_at||!['pending','created','cancelled','canceled'].includes(row.status));
 const label=shipments.some(row=>Boolean(row.label_url?.trim())),passed=['abgeholt','versendet'].includes(order.station)||order.status==='storniert';
 return {late:Boolean(shipped||label||passed),label,passed,carrier:shipped?.carrier??null};
}

async function changeHandoverManually(raw:unknown,deps:MailHandoverDependencies){
 if(!isManualHandoverInput(raw))return {code:'VALIDATION_ERROR' as const,message:ORDER_HANDOVER_COPY.invalid};
 const value=raw;
 const authorization=await resolveAuthorization();if(!authorization.ok)return {code:'UNAUTHENTICATED' as const,message:authorization.message};
 const auth=authorization.data;if(!canChangeOrderHandover(auth,'login'))return {code:'FORBIDDEN' as const,message:ORDER_HANDOVER_COPY.permission};
 const requestHash=hash({command:value.command,orderId:value.orderId,expectedVersion:value.expectedVersion,clientEventId:value.clientEventId,handoverMode:value.handoverMode});
 try{return await withPrivilegedTenantTransaction(auth,async tx=>{
  await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtextextended('order-mail-handover:'||${auth.tenantId}||':'||${value.clientEventId},0))`);
  const prior=await tx.execute<{id:string;event_type:string;user_id:string;payload:{requestHash:string}}>(sql`SELECT id,event_type,user_id::text,payload FROM public.events WHERE tenant_id=${auth.tenantId} AND client_event_id=${value.clientEventId}::uuid LIMIT 2`);
  if(prior.length){
   if(prior.length!==1||prior[0].event_type!=='ORDER_HANDOVER_CHANGED_V1'||prior[0].user_id!==auth.userId||prior[0].payload.requestHash!==requestHash)return {code:'CONFLICT' as const,message:ORDER_HANDOVER_COPY.conflict};
   return {code:'OK' as const,receipt:await readManualHandoverReceipt(tx,auth.tenantId,prior[0].id),replayed:true};
  }
  await tx.execute(sql`SELECT private.lock_shipping_customer_v1(${auth.tenantId},(SELECT customer_id FROM public.orders WHERE tenant_id=${auth.tenantId} AND id=${value.orderId}))`);
  const orders=await tx.execute<MailHandoverOrder>(sql`SELECT id,order_number,customer_id,version,handover_mode,station,status FROM public.orders WHERE tenant_id=${auth.tenantId} AND id=${value.orderId} FOR UPDATE`);
  const order=orders[0];if(orders.length!==1||!order)return {code:'NOT_FOUND' as const,message:ORDER_HANDOVER_COPY.missing};
  if(order.version!==value.expectedVersion)return {code:'CONFLICT' as const,message:ORDER_HANDOVER_COPY.conflict};
  if(order.handover_mode!=='pickup'&&order.handover_mode!=='shipping')return {code:'VALIDATION_ERROR' as const,message:ORDER_HANDOVER_COPY.invalid};
  const customer=await deps.readCustomer(tx,auth.tenantId,order.customer_id);if(!customer)return {code:'NOT_FOUND' as const,message:ORDER_HANDOVER_COPY.missing};
  const boundary=await readHandoverBoundary(tx,auth,order),eventId=randomUUID(),mode=boundary.late?order.handover_mode:value.handoverMode;
  const message=boundary.late?ORDER_HANDOVER_COPY.late(order.order_number??order.id,customer.name,customer.phone,boundary.carrier,value.handoverMode,boundary.label,boundary.passed):ORDER_HANDOVER_COPY.manualChanged(order.order_number??order.id,value.handoverMode);
  const taskTitle=boundary.late?ORDER_HANDOVER_COPY.call(customer.name,customer.phone):null;
  await writeOrderHandover<ManualHandoverReceipt>(tx,auth,{order,mode,passed:boundary.passed,clientEventId:value.clientEventId,eventId,eventType:'ORDER_HANDOVER_CHANGED_V1',requestHash,message,
   receipt:(version,at)=>({eventId,orderId:order.id,orderNumber:order.order_number,customerId:customer.id,expectedVersion:order.version,orderVersion:version,
    handoverMode:mode,requestedHandoverMode:value.handoverMode,outcome:boundary.late?'call_customer':'changed',message,taskClientKey:boundary.late?value.clientEventId:null,taskTitle,passed:boundary.passed,actor:{kind:'login',id:auth.userId,at}})});
  if(boundary.late&&taskTitle)await deps.createTask(tx,auth,{orderId:order.id,clientKey:value.clientEventId,title:taskTitle,note:message,manualEventId:eventId});
  return {code:'OK' as const,receipt:await readManualHandoverReceipt(tx,auth.tenantId,eventId),replayed:false};
 });}catch(error){console.error('[ORDER_MANUAL_HANDOVER_FAILED]',error instanceof Error?error.message:'UnknownError');return {code:'UNAVAILABLE' as const,message:ORDER_HANDOVER_COPY.unavailable};}
}
async function changeHandoverFromMail(raw:unknown,deps:MailHandoverDependencies){
 const value=raw as MailHandoverInput;
 if(Object.keys(value).sort().join(',')!==['command','sourceItemId','sourceVersion','clientEventId',...(value.orderId!==undefined?['orderId','expectedVersion']:[])].sort().join(',')||![value.sourceItemId,value.clientEventId].every(id=>typeof id==='string'&&UUID.test(id))||!Number.isSafeInteger(value.sourceVersion)||value.sourceVersion<1||value.orderId!==undefined&&(typeof value.orderId!=='string'||!value.orderId.trim()||value.orderId.length>128||!Number.isSafeInteger(value.expectedVersion)||value.expectedVersion!<1))return {code:'VALIDATION_ERROR' as const,message:'Original-Mail, Version und eindeutiger Auftrag fehlen.'};
 const authorization=await resolveAuthorization();if(!authorization.ok)return {code:'UNAUTHENTICATED' as const,message:authorization.message};
 const auth=authorization.data;if(!canChangeOrderHandover(auth,'mail'))return {code:'FORBIDDEN' as const,message:'Mail-Übergabe benötigt Mails und Aufträge.'};
 const requestHash=hash(value);
 try{return await withPrivilegedTenantTransaction(auth,async tx=>{
  await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtextextended('order-mail-handover:'||${auth.tenantId}||':'||${value.clientEventId},0))`);
  const prior=await tx.execute<{id:string;event_type:string;user_id:string;payload:{requestHash:string;receipt:unknown}}>(sql`SELECT id,event_type,user_id::text,payload FROM public.events WHERE tenant_id=${auth.tenantId} AND client_event_id=${value.clientEventId}::uuid LIMIT 2`);
  if(prior.length)return prior.length===1&&prior[0].event_type==='ORDER_HANDOVER_MAIL_V1'&&prior[0].user_id===auth.userId&&prior[0].payload.requestHash===requestHash?{code:'OK' as const,receipt:prior[0].payload.receipt,replayed:true}:{code:'CONFLICT' as const,message:'Diese Mail-Anweisung wurde bereits anders gespeichert.'};
  const first=await deps.readMail(tx,auth,{itemId:value.sourceItemId,version:value.sourceVersion,lock:false});if(first.code!=='OK')return first;
  if(first.mail.otherReference)return {code:'CONFLICT' as const,message:'Die Mail ist einem anderen Vorgang zugeordnet.'};
  const directive=intakeHandoverDirective(first.mail.text);if(!directive)return {code:'VALIDATION_ERROR' as const,message:'Abholen oder Versenden ist im Mailtext nicht eindeutig. Original prüfen.'};
  const customer=await deps.readCustomer(tx,auth.tenantId,first.mail.customerId);if(!customer)return {code:'NOT_FOUND' as const,message:'Kunde der Original-Mail ist nicht verfügbar.'};
  if(![customer.email,customer.billingEmail].some(email=>email?.trim().toLowerCase()===first.mail.sender.trim().toLowerCase()))return {code:'VALIDATION_ERROR' as const,message:'Absender gehört nicht zu einer gespeicherten Mailadresse dieses Kunden. Zuordnung prüfen.'};
  if(first.mail.orderId&&value.orderId&&first.mail.orderId!==value.orderId)return {code:'CONFLICT' as const,message:'Die Mail gehört zu einem anderen Auftrag.'};
  const target=first.mail.orderId??value.orderId;
  const candidates=target?await tx.execute<{id:string;number:string|null;version:number}>(sql`SELECT id,order_number AS number,version FROM public.orders WHERE tenant_id=${auth.tenantId} AND id=${target} AND customer_id=${customer.id}`):await tx.execute<{id:string;number:string|null;version:number}>(sql`SELECT id,order_number AS number,version FROM public.orders WHERE tenant_id=${auth.tenantId} AND customer_id=${customer.id} AND station IN ('angenommen','galvanik','fertig') AND status<>'storniert' ORDER BY created_at,id LIMIT 101`);
  if(candidates.length!==1)return {code:'VALIDATION_ERROR' as const,message:candidates.length?'Wähle den Auftrag zu dieser Original-Mail.':'Kein passender Auftrag zu dieser Original-Mail.',choices:candidates.map(row=>({id:row.id,number:row.number,version:row.version}))};
  await tx.execute(sql`SELECT private.lock_shipping_customer_v1(${auth.tenantId},${customer.id})`);
  const [order]=await tx.execute<MailHandoverOrder>(sql`SELECT id,order_number,customer_id,version,handover_mode,station,status FROM public.orders WHERE tenant_id=${auth.tenantId} AND id=${candidates[0].id} FOR UPDATE`);
  if(!order||order.customer_id!==customer.id)return {code:'NOT_FOUND' as const,message:'Auftrag gehört nicht zu diesem Kunden.'};
  if(!['pickup','shipping'].includes(order.handover_mode??''))return {code:'VALIDATION_ERROR' as const,message:'Übergabeart im bestehenden Auftrag fehlt. Auftrag zuerst prüfen.'};
  if(value.expectedVersion!==undefined&&value.expectedVersion!==order.version)return {code:'CONFLICT' as const,message:'Auftrag wurde inzwischen geändert. Neu lesen.'};
  const source=await deps.readMail(tx,auth,{itemId:value.sourceItemId,version:value.sourceVersion});if(source.code!=='OK')return source;
  const {late,label,passed,carrier}=await readHandoverBoundary(tx,auth,order);
  if(directive.forFuture){
   const changed=await deps.updateDefault(tx,auth,{customerId:customer.id,clientEventId:handoverCustomerEventKey(value.clientEventId),mode:directive.mode});
   if(changed.code!=='OK')throw Error('HANDOVER_CUSTOMER_DEFAULT_'+changed.code);
  }
  const eventId=randomUUID();let taskId:string|null=null;
  const message=late?ORDER_HANDOVER_COPY.late(order.order_number??order.id,customer.name,customer.phone,carrier,directive.mode,label,passed):ORDER_HANDOVER_COPY.changed(order.order_number??order.id,directive.mode,source.mail.sender,source.mail.receivedAt);
  const effect={itemId:source.mail.id,version:source.mail.version,orderId:order.id,clientEventId:value.clientEventId,mode:late?order.handover_mode!:directive.mode,requestedMode:directive.mode};
  if(late)taskId=await deps.createTask(tx,auth,{orderId:order.id,clientKey:value.clientEventId,title:ORDER_HANDOVER_COPY.call(customer.name,customer.phone),note:message},id=>deps.recordEffect(tx,auth,{...effect,taskId:id}));
  else await deps.recordEffect(tx,auth,{...effect,taskId:null});
  const mode=late?order.handover_mode!:directive.mode;
  // A callback about completed handover is a task, not another physical order mutation.
  // Keep the immutable goods-out receipt and its current order version valid.
  const result=await writeOrderHandover(tx,auth,{order,mode,passed,clientEventId:value.clientEventId,eventId,eventType:'ORDER_HANDOVER_MAIL_V1',requestHash,message,
   receipt:version=>({eventId,orderId:order.id,orderNumber:order.order_number,customerId:customer.id,orderVersion:version,handoverMode:mode,requestedHandoverMode:directive.mode,taskId,outcome:late?'call_customer':'changed',message,mailActor:{kind:'mail',sender:source.mail.sender,at:source.mail.receivedAt,originalItemId:source.mail.id,originalVersion:source.mail.version,graphMessageId:source.mail.graphMessageId,originalSha256:source.mail.originalSha256}})});
  return {code:'OK' as const,receipt:result,replayed:false};
 });}catch(error){console.error('[ORDER_MAIL_HANDOVER_FAILED]',error instanceof Error?error.message:'UnknownError');return {code:'UNAVAILABLE' as const,message:'Übergabe-Anweisung nicht gespeichert. Original und dieselbe Kennung behalten.'};}
}

function text(value: unknown, min: number, max: number): string | null {
  if (typeof value !== "string") return null;
  const normalized = value.trim().replace(/\s+/g, " ");
  return normalized.length >= min && normalized.length <= max ? normalized : null;
}

function optionalText(value: unknown, max: number): string | null | undefined {
  if (value === null || value === "") return null;
  const normalized = text(value, 1, max);
  return normalized ?? undefined;
}



function normalizeItems(value: unknown): OrderContentItemInput[] | null {
  if (!Array.isArray(value) || value.length < 1 || value.length > 20) return null;
  const items: OrderContentItemInput[] = [];
  for (const raw of value) {
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
    const item = raw as Record<string, unknown>;
    if (Object.keys(item).sort().join(",") !== "catalogServiceId,id,material,name,quantity,surface,unit,unitPriceCents,vatRateBasisPoints") return null;
    const name = text(item.name, 2, 160);
    const material = optionalText(item.material, 120);
    const surface = normaliseOrderPositionSurface(item.surface);
    const unit = item.unit===null?null:normaliseOrderPositionUnit(item.unit);
    if (!UUID.test(String(item.id)) || (item.catalogServiceId !== null && !UUID.test(String(item.catalogServiceId)))
      || !name || material === undefined || !surface
      || typeof item.quantity !== "number" || orderPositionQuantityError(item.quantity,unit)!==null
      || item.unit!==null&&unit===null
      || !isOrderContentPrice(item.unitPriceCents,item.vatRateBasisPoints)) return null;
    items.push({
      id: String(item.id), catalogServiceId: item.catalogServiceId === null ? null : String(item.catalogServiceId),
      name, quantity: item.quantity, material, surface, unit,
      unitPriceCents: item.unitPriceCents as number | null,
      vatRateBasisPoints: item.vatRateBasisPoints as 0 | 700 | 1900 | null,
    });
  }
  return new Set(items.map((item) => item.id)).size === items.length ? items : null;
}

function hash(value: unknown) {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

function iso(value: Date | string) {
  const parsed = value instanceof Date ? value : new Date(value);
  if (!Number.isFinite(parsed.getTime())) throw new Error("ORDER_CONTENT_EVENT_TIME_INVALID");
  return parsed.toISOString();
}

async function authorization(permission: "content" | "status") {
  const result = await resolveAuthorization();
  if (!result.ok) return { ok: false as const, result: result.reason === "AUTHORIZATION_UNAVAILABLE"
    ? { code: "UNAVAILABLE" as const, message: result.message }
    : { code: "UNAUTHENTICATED" as const, message: result.message } };
  const allowed = permission === "content"
    ? getAuthorizationActionGrants(result.data).editOrderContent
    : result.data.permissions.includes("perm_op_status");
  if (!allowed) return { ok: false as const, result: { code: "FORBIDDEN" as const, message: permission === "content" ? "Diese Rolle darf Auftragsdaten nicht ändern." : "Diese Rolle darf den Teilstatus nicht ändern." } };
  return { ok: true as const, data: result.data };
}

function receipt(row: EventRow) {
  return { eventId: row.id, aggregateVersion: row.aggregate_version, actorId: row.user_id, occurredAt: iso(row.created_at) };
}

export async function changeOrderContent(input: ChangeOrderContentInput): Promise<OrderContentResult> {
  if (!validBase(input)) return { code: "VALIDATION_ERROR", message: "Auftrag und Änderungsstand sind ungültig." };
  const note = optionalText(input.note, 2000);
  const items = normalizeItems(input.items);
  if (note === undefined || !items) return { code: "VALIDATION_ERROR", message: "Notiz oder Positionen sind unvollständig oder ungültig." };
  const auth = await authorization("content");
  if (!auth.ok) return auth.result;
  const requestHash = hash({ orderId: input.orderId, expectedVersion: input.expectedVersion, note,
    items:items.map(item=>({...item,surface:orderPositionSurfaceLabel(item.surface),unit:item.unit===null?null:orderPositionUnitLabel(item.unit)})) });

  try {
    return await withPrivilegedTenantTransaction(auth.data, async (tx) => {
      await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtextextended('order-content:' || ${auth.data.tenantId} || ':' || ${input.clientEventId}, 0))`);
      const replay = await tx.execute<EventRow>(sql`SELECT id, user_id::text AS user_id, aggregate_version, created_at, payload, event_type, order_id FROM public.events WHERE tenant_id=${auth.data.tenantId} AND client_event_id=${input.clientEventId}::uuid LIMIT 2`);
      if (replay.length) {
        const row = replay[0];
        const payload = row?.payload as { requestHash?: unknown } | null;
        return replay.length === 1 && row && row.event_type === "ORDER_CONTENT_CHANGED_V1" && row.order_id === input.orderId && payload?.requestHash === requestHash
          ? { code: "OK" as const, receipt: receipt(row), replayed: true }
          : { code: "CONFLICT" as const, message: ORDER_REQUEST_COPY.intentConflict };
      }

      const orders = await tx.execute<OrderRow>(sql`SELECT id, customer_id, version, station, status FROM public.orders WHERE tenant_id=${auth.data.tenantId} AND id=${input.orderId} FOR UPDATE`);
      const order = orders[0];
      if (orders.length !== 1 || !order) return { code: "NOT_FOUND" as const, message: "Auftrag nicht verfügbar." };
      if (order.version !== input.expectedVersion) return { code: "CONFLICT" as const, message: "Auftrag wurde bereits geändert." };
      if (order.status === "fertig" || order.station === "abgeholt") return { code: "CONFLICT" as const, message: "Ein abgeschlossener Auftrag kann nicht inhaltlich geändert werden." };

      const existing = await tx.execute<ItemRow>(sql`SELECT id, catalog_service_id::text AS catalog_service_id FROM public.items WHERE tenant_id=${auth.data.tenantId} AND order_id=${input.orderId} FOR UPDATE`);
      if (existing.some((row) => !items.some((item) => item.id === row.id))) return { code: "VALIDATION_ERROR" as const, message: "Positionen dürfen hier nicht gelöscht werden." };
      const catalogIds = [...new Set(items.flatMap((item) => item.catalogServiceId ? [item.catalogServiceId] : []))];
      const catalog = catalogIds.length ? await tx.execute<CatalogRow>(sql`SELECT id::text AS id, name, surface, unit, net_price_cents, vat_rate_basis_points, active FROM public.catalog_services WHERE tenant_id=${auth.data.tenantId} AND id = ANY(${catalogIds}::uuid[])`) : [];
      if (catalog.length !== catalogIds.length) return { code: "VALIDATION_ERROR" as const, message: "Eine gewählte Katalogleistung ist nicht verfügbar." };
      const services = new Map(catalog.map((service) => [service.id, service]));
      const normalized = items.map((item) => {
        const service = item.catalogServiceId ? services.get(item.catalogServiceId) : null;
        if (item.catalogServiceId && (!service || (!service.active && !existing.some((row) => row.id === item.id && row.catalog_service_id === service.id)))) throw new Error("ORDER_CONTENT_CATALOG_INVALID");
        return service ? { ...item, name: service.name, surface: service.surface, unit: service.unit, unitPriceCents: service.net_price_cents, vatRateBasisPoints: service.vat_rate_basis_points as 0 | 700 | 1900 } : item;
      });

      for (const item of normalized) {
        if (existing.some((row) => row.id === item.id)) {
          await tx.execute(sql`UPDATE public.items SET name=${item.name}, quantity=${item.quantity}, material=${item.material}, surface_requested=${item.surface}, catalog_service_id=${item.catalogServiceId}::uuid, unit=${item.unit}, preis_netto=${item.unitPriceCents === null ? null : item.unitPriceCents / 100}, vat_rate_basis_points=${item.vatRateBasisPoints} WHERE tenant_id=${auth.data.tenantId} AND order_id=${input.orderId} AND id=${item.id}`);
        } else {
          await tx.execute(sql`INSERT INTO public.items (id, tenant_id, order_id, customer_id, name, quantity, material, surface_requested, catalog_service_id, unit, preis_netto, vat_rate_basis_points, current_station_id) VALUES (${item.id}, ${auth.data.tenantId}, ${input.orderId}, ${order.customer_id}, ${item.name}, ${item.quantity}, ${item.material}, ${item.surface}, ${item.catalogServiceId}::uuid, ${item.unit}, ${item.unitPriceCents === null ? null : item.unitPriceCents / 100}, ${item.vatRateBasisPoints}, ${order.station})`);
        }
      }
      const updated = await tx.execute<{ version: number }>(sql`UPDATE public.orders SET task=${note}, version=version+1 WHERE tenant_id=${auth.data.tenantId} AND id=${input.orderId} AND version=${input.expectedVersion} RETURNING version`);
      if (updated.length !== 1 || updated[0]?.version !== input.expectedVersion + 1) throw new Error("ORDER_CONTENT_VERSION_INVALID");
      const eventId = randomUUID();
      const payload = JSON.stringify({ requestHash, note, items: normalized.map(({ surface, ...item }, index) => ({ ...item, surfaceRequested: surface, position: index + 1 })) });
      const events = await tx.execute<EventRow>(sql`INSERT INTO public.events (id, tenant_id, order_id, event_type, description, payload, status, user_id, station, client_event_id, event_schema_version, aggregate_version) VALUES (${eventId}, ${auth.data.tenantId}, ${input.orderId}, 'ORDER_CONTENT_CHANGED_V1', 'Auftragsinhalt geändert', ${payload}::jsonb, 'success', ${auth.data.userId}::uuid, ${order.station}, ${input.clientEventId}::uuid, 1, ${updated[0]!.version}) RETURNING id, user_id::text AS user_id, aggregate_version, created_at, payload, event_type, order_id`);
      if (events.length !== 1 || !events[0]) throw new Error("ORDER_CONTENT_EVENT_MISSING");
      await appendProductionPricing(tx,auth.data.tenantId,input.orderId,events[0].id);
      return { code: "OK" as const, receipt: receipt(events[0]), replayed: false };
    });
  } catch {
    return { code: "UNAVAILABLE", message: "Auftragsinhalt konnte nicht sicher gespeichert werden." };
  }
}

type ProductionPricingComposition={failed:(tx:PrivilegedTenantTransaction,auth:AuthorizationSnapshot,markerId:string)=>Promise<void>;settled:(tx:PrivilegedTenantTransaction,auth:AuthorizationSnapshot,eventId:string)=>Promise<void>};
export async function setOrderItemFinished(input: SetOrderItemFinishedInput,composition?:ProductionPricingComposition): Promise<OrderContentResult> {
  if (!validBase(input) || !UUID.test(input.itemId) || typeof input.finished !== "boolean") return { code: "VALIDATION_ERROR", message: "Teilstatus ist ungültig." };
  const {isOfflineOriginal,normalizeOfflineOriginal}=await import('@/lib/domain/offlineOriginal');
  if(input.offlineOriginal!==undefined&&!isOfflineOriginal(input.offlineOriginal))return {code:'VALIDATION_ERROR',message:'Teilstatus ist ungültig.'};
  const auth = await authorization("status");
  if (!auth.ok) return auth.result;
  if(input.offlineOriginal&&(input.offlineOriginal.actorId!==auth.data.userId||input.offlineOriginal.clientEventId!==input.clientEventId))return {code:'CONFLICT',message:ORDER_REQUEST_COPY.intentConflict};
  if(input.offlineOriginal)input={...input,offlineOriginal:normalizeOfflineOriginal(input.offlineOriginal)};
  const requestHash = hash(input);
  let followupMessage:string|null=null;
  const pricing=async(tx:PrivilegedTenantTransaction,eventId:string,work:()=>Promise<void>)=>{
   try{await work();}
   catch(error){
    if(!(error instanceof ProductionPricingRetryNeeded))throw error;
    const markerId=await recordProductionPricingRetry(tx,auth.data,error.source);
    const source=await readProductionPricingRetrySource(tx,auth.data,markerId);
    try{if(!composition)throw Error('PRODUCTION_PRICING_TASK_PORT_MISSING');await withTenantSavepoint(tx,nested=>composition.failed(nested,auth.data,markerId));}
    catch{followupMessage=source?.title??PRODUCTION_PRICING_RETRY_COPY.taskPending;}
    return;
   }
   if(composition){try{await withTenantSavepoint(tx,nested=>composition.settled(nested,auth.data,eventId));}catch{followupMessage=PRODUCTION_PRICING_RETRY_COPY.taskPending;}}
  };
  try {
    const result=await withPrivilegedTenantTransaction(auth.data, async (tx) => {
      await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtextextended('order-item-finished:' || ${auth.data.tenantId} || ':' || ${input.clientEventId}, 0))`);
      const replay = await tx.execute<EventRow>(sql`SELECT id, user_id::text AS user_id, aggregate_version, created_at, payload, event_type, order_id FROM public.events WHERE tenant_id=${auth.data.tenantId} AND client_event_id=${input.clientEventId}::uuid LIMIT 2`);
      if (replay.length) {
        const row = replay[0]; const payload = row?.payload as { requestHash?: unknown } | null;
        if(!(replay.length===1&&row&&row.user_id===auth.data.userId&&row.event_type==="ORDER_ITEM_FINISHED_CHANGED_V1"&&row.order_id===input.orderId&&payload?.requestHash===requestHash))return {code:"CONFLICT" as const,message:ORDER_REQUEST_COPY.intentConflict};
        if(input.offlineOriginal&&input.finished)await pricing(tx,row.id,()=>repairProductionCompletionPricing(tx,auth.data,input.orderId,row.id));
        return {code:"OK" as const,receipt:receipt(row),replayed:true};
      }
      const orders = await tx.execute<OrderRow>(sql`SELECT id, customer_id, version, station, status FROM public.orders WHERE tenant_id=${auth.data.tenantId} AND id=${input.orderId} FOR UPDATE`);
      const order = orders[0];
      if (orders.length !== 1 || !order) return { code: "NOT_FOUND" as const, message: "Auftrag nicht verfügbar." };
      if (order.version !== input.expectedVersion) return { code: "CONFLICT" as const, message: "Auftrag wurde bereits geändert." };
      if (order.status === "fertig" || order.station === "abgeholt") return { code: "CONFLICT" as const, message: "Der Teilstatus ist bereits abgeschlossen." };
      // A fresh request identifier is not a new completion edge. The order lock
      // serializes competing requests; genuine same-key retries returned above.
      const current = await tx.execute<{ current_station_id: string }>(sql`SELECT current_station_id FROM public.items WHERE tenant_id=${auth.data.tenantId} AND order_id=${input.orderId} AND id=${input.itemId} FOR UPDATE`);
      if (current.length !== 1) return { code: "NOT_FOUND" as const, message: "Teil nicht verfügbar." };
      if ((current[0]!.current_station_id === "fertig") === input.finished) return { code: "CONFLICT" as const, message: ORDER_ITEM_COMPLETION_COPY.alreadyChanged };
      const changed = await tx.execute<{ id: string }>(sql`UPDATE public.items SET current_station_id=${input.finished ? "fertig" : order.station} WHERE tenant_id=${auth.data.tenantId} AND order_id=${input.orderId} AND id=${input.itemId} RETURNING id`);
      if (changed.length !== 1) return { code: "NOT_FOUND" as const, message: "Teil nicht verfügbar." };
      const updated = await tx.execute<{ version: number }>(sql`UPDATE public.orders SET version=version+1 WHERE tenant_id=${auth.data.tenantId} AND id=${input.orderId} AND version=${input.expectedVersion} RETURNING version`);
      if (updated.length !== 1 || updated[0]?.version !== input.expectedVersion + 1) throw new Error("ORDER_ITEM_FINISHED_VERSION_INVALID");
      const eventId = randomUUID(); const payload = JSON.stringify({ requestHash, itemId: input.itemId, finished: input.finished,...(input.offlineOriginal?{offlineOriginal:input.offlineOriginal}:{}) });
      const events = await tx.execute<EventRow>(sql`INSERT INTO public.events (id, tenant_id, order_id, item_id, event_type, description, payload, status, user_id, station, client_event_id, event_schema_version, aggregate_version) VALUES (${eventId}, ${auth.data.tenantId}, ${input.orderId}, ${input.itemId}, 'ORDER_ITEM_FINISHED_CHANGED_V1', ${input.finished ? "Teil fertig gemeldet" : "Teil wieder geöffnet"}, ${payload}::jsonb, 'success', ${auth.data.userId}::uuid, ${order.station}, ${input.clientEventId}::uuid, 1, ${updated[0]!.version}) RETURNING id, user_id::text AS user_id, aggregate_version, created_at, payload, event_type, order_id`);
      if (events.length !== 1 || !events[0]) throw new Error("ORDER_ITEM_FINISHED_EVENT_MISSING");
      if(input.finished)await pricing(tx,events[0].id,()=>appendProductionCompletion(tx,auth.data.tenantId,input.orderId,events[0].id,[input.itemId]));
      else await appendProductionReversals(tx,auth.data.tenantId,events[0].id,[input.itemId]);
      return { code: "OK" as const, receipt: receipt(events[0]), replayed: false };
    });
    return result.code==='OK'&&followupMessage?{code:'UNAVAILABLE',message:followupMessage}:result;
  } catch(error) {
    console.error('[ORDER_ITEM_FINISHED_WRITE_FAILED]',error instanceof Error?error.message:'UnknownError');
    return { code: "UNAVAILABLE", message: "Teilstatus konnte nicht sicher gespeichert werden." };
  }
}

function handoverCustomerEventKey(id:string){const h=createHash('sha256').update('mail-handover-customer:'+id).digest().subarray(0,16);h[6]=(h[6]&15)|80;h[8]=(h[8]&63)|128;const s=h.toString('hex');return `${s.slice(0,8)}-${s.slice(8,12)}-${s.slice(12,16)}-${s.slice(16,20)}-${s.slice(20)}`;}
