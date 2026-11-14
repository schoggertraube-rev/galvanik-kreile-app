import 'server-only';
import {createHash,randomUUID} from 'node:crypto';
import {isDeepStrictEqual} from 'node:util';
import {sql} from 'drizzle-orm';
import {hasAuthorizationArea} from '@/lib/auth/authorizationContract';
import type {AuthorizationSnapshot} from '@/lib/server/authorization';
import {withPrivilegedTenantTransaction,type PrivilegedTenantTransaction} from '@/lib/server/privilegedDb';
import type {CustomerStoredProfile} from '@/modules/customers/public';
import type {ShippingSettings} from '@/modules/fundament/public';
import {MANUAL_SHIPPING_COPY,MANUAL_SHIPPING_FIELDS} from '@/ui/situationCatalog';

const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const id=(value:unknown):value is string=>typeof value==='string'&&/^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/.test(value);
export type ManualShippingPorts={
 readCustomer:(tx:PrivilegedTenantTransaction,tenantId:string,customerId:string)=>Promise<CustomerStoredProfile|null>;
 readSettings:(tx:PrivilegedTenantTransaction,tenantId:string)=>Promise<ShippingSettings|null>;
};
type Order={id:string;customer_id:string;order_number:string;handover_mode:string|null;station:string;version:number;allowed:boolean};
type Shipment={id:string;order_id:string;sendungId:string|null;carrier:string|null;trackingNumber:string|null;updatedAt:string;status:string;weightKg:string|null;labelUrl:string|null};
export type SaveManualTrackingInput={orderId:string;shipmentId:string;expectedUpdatedAt:string|null;trackingNumber:string;allowFormatMismatch:boolean;reason:string|null;clientEventId:string;withOrder?:{orderId:string;shipmentId:string|null;expectedUpdatedAt:string|null}};
type Receipt={shipmentId:string;orderId:string;trackingNumber:string;carrier:string;updatedAt:string;eventId:string;actorId:string;formatOverride:boolean;sendungId?:string};
const error=(code:'FORBIDDEN'|'VALIDATION_ERROR'|'NOT_FOUND'|'CONFLICT'|'UNAVAILABLE',reason:keyof typeof MANUAL_SHIPPING_COPY)=>({code,reason,message:MANUAL_SHIPPING_COPY[reason]});
function authorized(auth:AuthorizationSnapshot){return auth.active===true&&hasAuthorizationArea(auth,'auftraege');}
function trackingLink(settings:ShippingSettings,tracking:string|null){
 if(!settings.trackingUrl||!tracking)return null;
 const url=settings.trackingUrl.replace('{nr}',encodeURIComponent(tracking));
 try{const parsed=new URL(url);return parsed.protocol==='https:'&&settings.trackingUrl.includes('{nr}')?url:null;}catch{return null;}
}
async function readOrder(tx:PrivilegedTenantTransaction,auth:AuthorizationSnapshot,orderId:string,lock=false){
 const rows=await tx.execute<Order>(sql`SELECT id,customer_id,order_number,handover_mode,station,version,
  private.order_release_allowed_v1(tenant_id,id) AS allowed FROM public.orders
  WHERE tenant_id=${auth.tenantId} AND id=${orderId} ${lock?sql`FOR UPDATE`:sql``}`);
 if(rows.length>1)throw Error('SHIPPING_ORDER_AMBIGUOUS');return rows[0]??null;
}
async function readShipments(tx:PrivilegedTenantTransaction,tenantId:string,filter:{orderId:string}|{shipmentId:string},lock=false){
 const rows=await tx.execute<Shipment>(sql`SELECT id::text,order_id,sendung_id::text AS "sendungId",carrier,tracking_number AS "trackingNumber",status,label_url AS "labelUrl",
  weight_kg::text AS "weightKg",to_char(updated_at AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"') AS "updatedAt"
  FROM public.shipments WHERE tenant_id=${tenantId} AND ${'orderId'in filter?sql`order_id=${filter.orderId}`:sql`id=${filter.shipmentId}::uuid`}
  ORDER BY created_at,id LIMIT 101 ${lock?sql`FOR UPDATE`:sql``}`);
 if(rows.length>100)throw Error('SHIPPING_LIMIT');return rows;
}
export async function readManualShipping(auth:AuthorizationSnapshot,orderId:unknown,ports:ManualShippingPorts){
 if(!authorized(auth))return error('FORBIDDEN','SHIPPING_FORBIDDEN');
 if(!id(orderId))return error('VALIDATION_ERROR','ORDER_ID_INVALID');
 try{return await withPrivilegedTenantTransaction(auth,async tx=>{
  const order=await readOrder(tx,auth,orderId);if(!order)return error('NOT_FOUND','ORDER_NOT_FOUND');
  if(order.handover_mode!=='shipping')return error('VALIDATION_ERROR','ORDER_NOT_SHIPPING');
  const customer=await ports.readCustomer(tx,auth.tenantId,order.customer_id);
  if(!customer)throw Error('SHIPPING_CUSTOMER_MISSING');
  const settings=await ports.readSettings(tx,auth.tenantId);
  const shipments=await readShipments(tx,auth.tenantId,{orderId});
  const fields={name:customer.companyName??customer.name,street:customer.street,houseNumber:customer.houseNumber,
   zipCode:customer.zipCode,city:customer.city,country:customer.country,phone:customer.phone,email:customer.email,
   reference:customer.customerNumber};
  const missing=Object.entries(fields).filter(([key,value])=>['name','street','houseNumber','zipCode','city','country'].includes(key)&&!value?.trim()).map(([key])=>key);
  const copyText=Object.entries(fields).map(([key,value])=>`${MANUAL_SHIPPING_FIELDS[key as keyof typeof MANUAL_SHIPPING_FIELDS]}: ${value??''}`).join('\n');
  return {code:'OK' as const,data:{orderId,orderVersion:order.version,fields,copyText,missing,
   releaseAllowed:order.allowed,service:settings?.service??null,numberHint:settings?.numberHint??null,
   shipments:shipments.map(shipment=>({id:shipment.id,sendungId:shipment.sendungId,carrier:shipment.carrier,trackingNumber:shipment.trackingNumber,updatedAt:shipment.updatedAt,status:shipment.status,weightKg:shipment.weightKg,labelUrl:shipment.labelUrl,trackingUrl:settings&&shipment.carrier===settings.service?trackingLink(settings,shipment.trackingNumber):null})),
   gaps:[...(!settings?['SHIPPING_SETTINGS_MISSING']:[]),'SERVICE_BROWSER_URL_NOT_CONFIGURED','DIMENSIONS_NOT_RECORDED']}};
 });}catch(cause){console.error('MANUAL_SHIPPING_READ_FAILED',cause);return error('UNAVAILABLE','MANUAL_SHIPPING_READ_FAILED');}
}
export async function saveManualTracking(auth:AuthorizationSnapshot,input:unknown,ports:ManualShippingPorts){
 if(!authorized(auth))return error('FORBIDDEN','SHIPPING_FORBIDDEN');
 if(!input||typeof input!=='object'||Array.isArray(input))return error('VALIDATION_ERROR','TRACKING_INPUT_INVALID');
 const value=input as SaveManualTrackingInput;
 if(Object.keys(value).sort().join(',')!==['allowFormatMismatch','clientEventId','expectedUpdatedAt','orderId','reason','shipmentId','trackingNumber',...('withOrder'in value?['withOrder']:[])].sort().join(',')
  ||!id(value.orderId)||typeof value.shipmentId!=='string'||!uuid.test(value.shipmentId)||typeof value.clientEventId!=='string'||!uuid.test(value.clientEventId)
  ||typeof value.trackingNumber!=='string'||value.trackingNumber!==value.trackingNumber.trim()||value.trackingNumber.length<1||value.trackingNumber.length>120
  ||/[\u0000-\u001f\u007f]/.test(value.trackingNumber)
  ||typeof value.allowFormatMismatch!=='boolean'||!(value.reason===null||typeof value.reason==='string'&&value.reason===value.reason.trim()&&value.reason.length>=1&&value.reason.length<=300)
  ||!(value.expectedUpdatedAt===null||typeof value.expectedUpdatedAt==='string'&&/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{6}Z$/.test(value.expectedUpdatedAt)))return error('VALIDATION_ERROR','TRACKING_INPUT_INVALID');
 if('withOrder'in value){
  const target=value.withOrder;
  if(!target||typeof target!=='object'||Array.isArray(target)||Object.keys(target).sort().join(',')!=='expectedUpdatedAt,orderId,shipmentId'||!id(target.orderId)||target.orderId===value.orderId||!(target.shipmentId===null||typeof target.shipmentId==='string'&&uuid.test(target.shipmentId))||!(target.shipmentId===null?target.expectedUpdatedAt===null:typeof target.expectedUpdatedAt==='string'&&/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{6}Z$/.test(target.expectedUpdatedAt)))return error('VALIDATION_ERROR','TRACKING_INPUT_INVALID');
 }
 const hash=createHash('sha256').update(JSON.stringify({orderId:value.orderId,shipmentId:value.shipmentId,expectedUpdatedAt:value.expectedUpdatedAt,
  trackingNumber:value.trackingNumber,allowFormatMismatch:value.allowFormatMismatch,reason:value.reason,clientEventId:value.clientEventId,...(value.withOrder?{withOrder:{orderId:value.withOrder.orderId,shipmentId:value.withOrder.shipmentId,expectedUpdatedAt:value.withOrder.expectedUpdatedAt}}:{})})).digest('hex');
 try{return await withPrivilegedTenantTransaction(auth,async tx=>{
  await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtextextended('manual-shipping-key:'||${auth.tenantId}||':'||${value.clientEventId},0))`);
  const prior=await tx.execute<{id:string;order_id:string;event_type:string;status:string;user_id:string;payload:{hash:string;receipt:Receipt}}>(sql`SELECT id,order_id,event_type,status,user_id::text,payload FROM public.events
   WHERE tenant_id=${auth.tenantId} AND client_event_id=${value.clientEventId}::uuid LIMIT 2`);
  if(prior.length)return prior.length===1&&prior[0].user_id===auth.userId&&prior[0].event_type==='SHIPMENT_MANUAL_TRACKING_SET_V1'
   &&prior[0].status==='success'&&prior[0].order_id===value.orderId&&prior[0].payload?.hash===hash
   &&prior[0].payload.receipt?.eventId===prior[0].id&&prior[0].payload.receipt.shipmentId===value.shipmentId
   &&prior[0].payload.receipt.trackingNumber===value.trackingNumber&&prior[0].payload.receipt.actorId===auth.userId
   ?{code:'OK' as const,receipt:prior[0].payload.receipt,replayed:true}:error('CONFLICT','TRACKING_KEY_CONFLICT');
  const settings=await ports.readSettings(tx,auth.tenantId);if(!settings)return error('VALIDATION_ERROR','SHIPPING_SETTINGS_MISSING');
  if(!settings.numberPattern.trim())return error('VALIDATION_ERROR','TRACKING_PATTERN_MISSING');
  let matches:boolean;try{matches=new RegExp(settings.numberPattern).test(value.trackingNumber);}catch{return error('VALIDATION_ERROR','TRACKING_PATTERN_INVALID');}
  if(!matches&&!value.allowFormatMismatch)return error('VALIDATION_ERROR','TRACKING_FORMAT_CONFIRMATION_REQUIRED');
  const unlocked=await readOrder(tx,auth,value.orderId);if(!unlocked)return error('NOT_FOUND','ORDER_NOT_FOUND');
  await tx.execute(sql`SELECT private.lock_shipping_customer_v1(${auth.tenantId},${unlocked.customer_id})`);
  // The same configured carrier/number cannot be claimed concurrently by two parcels.
  await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtextextended('manual-tracking:'||${auth.tenantId}||':'||lower(${settings.service})||':'||upper(${value.trackingNumber}),0))`);
  const order=await readOrder(tx,auth,value.orderId,true);if(!order)return error('NOT_FOUND','ORDER_NOT_FOUND');
  if(order.customer_id!==unlocked.customer_id)return error('CONFLICT','SHIPMENT_CHANGED');
  if(order.handover_mode!=='shipping')return error('VALIDATION_ERROR','ORDER_NOT_SHIPPING');
  if(!order.allowed)return error('CONFLICT','SHIPPING_RELEASE_BLOCKED');
  const customer=await ports.readCustomer(tx,auth.tenantId,order.customer_id);
  if(!customer)throw Error('SHIPPING_CUSTOMER_MISSING');
  if([customer.street,customer.houseNumber,customer.zipCode,customer.city,customer.country].some(field=>!field?.trim()))return error('VALIDATION_ERROR','SHIPPING_ADDRESS_INCOMPLETE');
  const rows=await readShipments(tx,auth.tenantId,{shipmentId:value.shipmentId},true);
  const old=rows[0];
  if(old&&(old.order_id!==order.id||old.updatedAt!==value.expectedUpdatedAt))return error('CONFLICT','SHIPMENT_CHANGED');
  if(!old&&value.expectedUpdatedAt!==null)return error('CONFLICT','SHIPMENT_CHANGED');
  if(old&&!['pending','created'].includes(old.status))return error('CONFLICT','SHIPMENT_ALREADY_RELEASED');
  if(old?.labelUrl)return error('CONFLICT','SHIPMENT_PROVIDER_LABEL_EXISTS');
  if(old?.carrier&&old.carrier!==settings.service)return error('CONFLICT','SHIPMENT_CARRIER_CHANGED');
  if(old?.trackingNumber&&old.trackingNumber!==value.trackingNumber&&!value.reason)return error('VALIDATION_ERROR','TRACKING_CHANGE_REASON_REQUIRED');
  let groupId=old?.sendungId??null;
  let groupTarget:{orderId:string;shipmentId:string;old:Shipment|null}|null=null;
  if(value.withOrder){
   const targetBefore=await readOrder(tx,auth,value.withOrder.orderId);
   if(!targetBefore)return error('NOT_FOUND','ORDER_NOT_FOUND');
   if(targetBefore.customer_id!==order.customer_id||targetBefore.handover_mode!=='shipping')return error('CONFLICT','SHIPMENT_CHANGED');
   const targetOrder=await readOrder(tx,auth,value.withOrder.orderId,true);
   if(!targetOrder||targetOrder.customer_id!==order.customer_id||targetOrder.handover_mode!=='shipping')return error('CONFLICT','SHIPMENT_CHANGED');
   const candidates=await readShipments(tx,auth.tenantId,{orderId:targetOrder.id},true);
   const selected=value.withOrder.shipmentId===null?null:candidates.find(row=>row.id===value.withOrder!.shipmentId);
   if(value.withOrder.shipmentId===null&&candidates.length||value.withOrder.shipmentId!==null&&!selected||selected&&selected.updatedAt!==value.withOrder.expectedUpdatedAt)return {...error('CONFLICT','SHIPMENT_CHANGED'),candidates:candidates.map(row=>({shipmentId:row.id,updatedAt:row.updatedAt,carrier:row.carrier,trackingNumber:row.trackingNumber,status:row.status}))};
   if(selected&&!['pending','created'].includes(selected.status))return error('CONFLICT','SHIPMENT_ALREADY_RELEASED');
   if(selected?.labelUrl)return error('CONFLICT','SHIPMENT_PROVIDER_LABEL_EXISTS');
   if(selected?.carrier&&selected.carrier!==settings.service)return error('CONFLICT','SHIPMENT_CARRIER_CHANGED');
   if(selected?.trackingNumber&&selected.trackingNumber!==value.trackingNumber)return {...error('CONFLICT','TRACKING_ALREADY_ASSIGNED'),shipmentId:selected.id,orderId:targetOrder.id};
   groupId=selected?.sendungId??randomUUID();
   groupTarget={orderId:targetOrder.id,shipmentId:selected?.id??randomUUID(),old:selected??null};
  }
  const duplicate=await tx.execute<{id:string;order_id:string}>(sql`SELECT id::text,order_id FROM public.shipments WHERE tenant_id=${auth.tenantId}
   AND lower(carrier)=lower(${settings.service}) AND upper(tracking_number)=upper(${value.trackingNumber}) AND id<>${value.shipmentId}::uuid
   AND (${groupTarget?.shipmentId??null}::uuid IS NULL OR id<>${groupTarget?.shipmentId??null}::uuid)
   AND (${groupId}::uuid IS NULL OR sendung_id IS DISTINCT FROM ${groupId}::uuid) LIMIT 1`);
  if(duplicate[0])return {...error('CONFLICT','TRACKING_ALREADY_ASSIGNED'),shipmentId:duplicate[0].id,orderId:duplicate[0].order_id};
  const saved=await tx.execute<{updatedAt:string}>(old?sql`UPDATE public.shipments SET carrier=${settings.service},tracking_number=${value.trackingNumber},sendung_id=${groupId}::uuid,status='created',updated_at=statement_timestamp()
   WHERE tenant_id=${auth.tenantId} AND id=${value.shipmentId}::uuid RETURNING to_char(updated_at AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"') AS "updatedAt"`
   :sql`INSERT INTO public.shipments(id,tenant_id,order_id,carrier,tracking_number,sendung_id,status) VALUES(${value.shipmentId}::uuid,${auth.tenantId},${order.id},${settings.service},${value.trackingNumber},${groupId}::uuid,'created')
    RETURNING to_char(updated_at AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"') AS "updatedAt"`);
  if(saved.length!==1)throw Error('MANUAL_TRACKING_WRITE_FAILED');
  if(groupTarget){
   const targetWrite=groupTarget.old?groupTarget.old.sendungId===groupId?null:await tx.execute(sql`UPDATE public.shipments SET sendung_id=${groupId}::uuid,updated_at=statement_timestamp()
    WHERE tenant_id=${auth.tenantId} AND id=${groupTarget.shipmentId}::uuid AND updated_at=${groupTarget.old.updatedAt}::timestamptz RETURNING id`)
    :await tx.execute(sql`INSERT INTO public.shipments(id,tenant_id,order_id,sendung_id,status) VALUES(${groupTarget.shipmentId}::uuid,${auth.tenantId},${groupTarget.orderId},${groupId}::uuid,'pending') RETURNING id`);
   if(targetWrite&&targetWrite.length!==1)throw Error('SHIPMENT_GROUP_TARGET_NOT_SAVED');
  }
  const receipt:Receipt={shipmentId:value.shipmentId,orderId:order.id,trackingNumber:value.trackingNumber,carrier:settings.service,
   updatedAt:saved[0].updatedAt,eventId:randomUUID(),actorId:auth.userId,formatOverride:!matches,...(groupId?{sendungId:groupId}:{})};
  const eventWrite=await tx.execute<{id:string}>(sql`INSERT INTO public.events(id,tenant_id,order_id,event_type,description,user_id,payload,status,client_event_id,event_schema_version,correlation_id,aggregate_version)
   VALUES(${receipt.eventId},${auth.tenantId},${order.id},'SHIPMENT_MANUAL_TRACKING_SET_V1','Sendungsnummer manuell übernommen',${auth.userId}::uuid,
    ${JSON.stringify({hash,receipt,before:old?.trackingNumber??null,reason:value.reason,...(groupTarget?{group:{id:groupId,withOrderId:groupTarget.orderId,targetShipmentId:groupTarget.shipmentId,targetBeforeGroup:groupTarget.old?.sendungId??null,ownBeforeGroup:old?.sendungId??null}}:{})})}::jsonb,'success',${value.clientEventId}::uuid,1,${randomUUID()}::uuid,${order.version}) RETURNING id`);
  if(eventWrite.length!==1||eventWrite[0].id!==receipt.eventId)throw Error('MANUAL_TRACKING_EVENT_NOT_SAVED');
  const proof=await tx.execute<{payload:{hash:string;receipt:Receipt}}>(sql`SELECT payload FROM public.events WHERE tenant_id=${auth.tenantId} AND id=${receipt.eventId} AND user_id=${auth.userId}::uuid AND client_event_id=${value.clientEventId}::uuid AND event_type='SHIPMENT_MANUAL_TRACKING_SET_V1'`);
  const ownProof=await readShipments(tx,auth.tenantId,{shipmentId:value.shipmentId});
  if(proof.length!==1||proof[0].payload.hash!==hash||!isDeepStrictEqual(proof[0].payload.receipt,receipt)||ownProof.length!==1||ownProof[0].trackingNumber!==receipt.trackingNumber||ownProof[0].updatedAt!==receipt.updatedAt||ownProof[0].sendungId!==groupId)throw Error('MANUAL_TRACKING_RECEIPT_NOT_PROVEN');
  if(groupTarget){const targetProof=await readShipments(tx,auth.tenantId,{shipmentId:groupTarget.shipmentId});if(targetProof.length!==1||targetProof[0].order_id!==groupTarget.orderId||targetProof[0].sendungId!==groupId)throw Error('SHIPMENT_GROUP_TARGET_NOT_PROVEN');}
  return {code:'OK' as const,receipt,replayed:false};
 });}catch(cause){console.error('MANUAL_TRACKING_WRITE_FAILED',cause);return error('UNAVAILABLE','MANUAL_TRACKING_WRITE_FAILED');}
}
