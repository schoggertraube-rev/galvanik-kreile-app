import 'server-only';
import {withPageReadPhase} from '@/db/readBudget';
import type {AuthorizationSnapshot} from './authorization';
import {authorizationReadContext,canReadOrderPaymentCredit,type AuthorizedReadContext} from './authorizationReadContext';
import type {PaymentReadAuthorization} from './paymentContract';
import type {PrivilegedTenantTransaction} from './privilegedDb';
import type {InvoiceVatReader,CustomerCreditResult} from '@/modules/accounting/public';
import type {ShippingSettings} from '@/modules/fundament/public';
import type {ManualShippingReadResult} from '@/modules/orders/public';
import {canTransportInvoiceDocument} from '@/lib/auth/authorizationContract';
import {maskTodayOrderCard} from './orderCardRead';
import {maskOrderPaymentCredit} from './paymentSummaryRead';
import {readV45OrderRule} from './v45OrderRead';

type ShippingRead=(tx:PrivilegedTenantTransaction,tenantId:string)=>Promise<ShippingSettings|null>;
/** Only the authorized App/approved projector composition binds module readers. */
export type TodayOrderReadPorts={
 readVat:InvoiceVatReader;
 readSettings:ShippingRead;
 readCredit:(tx:PrivilegedTenantTransaction,tenantId:string,customerId:string)=>Promise<CustomerCreditResult>;
 readShipments:(auth:AuthorizationSnapshot|AuthorizedReadContext,ids:readonly string[],readSettings:ShippingRead)=>Promise<Map<string,ManualShippingReadResult>>;
};

/** Complete existing Today source composition, before actor-bound V45 rules. */
export type TodayOrderReadAuthorization=AuthorizedReadContext&Readonly<{payment:PaymentReadAuthorization}>;
/** One actor projection for the live source and the qualified stored source.
 * This performs no SQL and never returns the unmasked projector card. */
export function projectTodayOrderSources(auth:AuthorizationSnapshot,sources:Awaited<ReturnType<typeof readTodayOrderSources>>){
 return sources.map(({orderId,result})=>{
  if(result.code!=='OK')return {orderId,result};
  const raw=result.data,card=maskTodayOrderCard(auth,raw.card);
  const shipping=canTransportInvoiceDocument(auth)?raw.shipping:undefined;
  const payment=raw.payment===undefined?undefined:maskOrderPaymentCredit(auth,raw.payment);
  try{
   const nextActionRule=readV45OrderRule(auth,card,raw.informed?{orderId:card.id,value:raw.informed}:undefined,{orderId:card.id,records:raw.records},{shipping,payment,shipment:raw.shipment});
   return {orderId,result:{code:'OK' as const,data:{card,handoverConsequences:shipping,pickupAppointment:raw.appointment,nextActionRule}}};
  }catch(error){console.error('[TODAY_ORDER_RULE_SOURCE_FAILED]',{orderId,name:error instanceof Error?error.name:'UnknownError'});return {orderId,result:{code:'UNAVAILABLE' as const,message:'Auftragskarte konnte nicht sicher geladen werden.'}};}
 });
}
export async function readTodayOrderSources(auth:AuthorizationSnapshot|TodayOrderReadAuthorization,orderIds:string[],ports:TodayOrderReadPorts){
  const [{readTodayOrderCards},{readOrderEvidenceBatch}]=await Promise.all([import('@/lib/server/orderCardRead'),import('@/lib/server/evidenceRead')]);
  const [cards,evidence]=await Promise.all([withPageReadPhase('action.cards',()=>readTodayOrderCards(auth,orderIds)),withPageReadPhase('action.evidence',()=>readOrderEvidenceBatch(auth,orderIds))]);
  const [{readInvoiceShippingConsequencesBatch},{readOrdersInformed},{readOrderPickupAppointment},{getPaymentStatesBatch,maskOrderPaymentCredit}]=await Promise.all([
   import('@/lib/server/commands/immutableInvoiceCommand'),import('@/lib/server/orderReleaseRead'),import('@/lib/server/pickupAppointmentPort'),import('@/lib/server/paymentSummaryRead')]);
  const readAuth='canReadArea'in auth?auth:authorizationReadContext(auth);
  const readCredit=canReadOrderPaymentCredit(readAuth)?ports.readCredit:undefined;
  // One qualified settings snapshot for both read branches in this Action only;
  // writers and later requests still use the fresh canonical reader.
  let shippingSettings:ReturnType<TodayOrderReadPorts['readSettings']>|undefined;
  const readShippingSettings:TodayOrderReadPorts['readSettings']=(tx,tenantId)=>shippingSettings??=ports.readSettings(tx,tenantId);
  const shippingReads=withPageReadPhase('action.shipping',()=>readInvoiceShippingConsequencesBatch(auth,orderIds.flatMap(orderId=>{const card=cards.get(orderId),proof=evidence.get(orderId);return card?.code==='OK'&&proof?.code==='OK'?[{orderId:card.data.id,expectedVersion:card.data.version,manualHandoverEventId:card.data.handoverNotice?.manualEventId}]:[];}),ports.readVat,readShippingSettings));
  const qualifiedCards=orderIds.flatMap(orderId=>{const source=cards.get(orderId),proof=evidence.get(orderId);return source?.code==='OK'&&proof?.code==='OK'?[source.data]:[];});
  const finishedIds=qualifiedCards.filter(card=>card.station==='fertig').map(card=>card.id);
  const shipmentIds=qualifiedCards.filter(card=>card.handoverMode==='shipping').map(card=>card.id);
  const informedReads=withPageReadPhase('action.informed',()=>readOrdersInformed(auth,finishedIds));
  const paymentReads=withPageReadPhase('action.payment',()=>getPaymentStatesBatch('canReadArea'in auth?auth.payment:auth,finishedIds,readCredit));
  const shipmentReads=shipmentIds.length?withPageReadPhase('action.shipment',()=>ports.readShipments(auth,shipmentIds,readShippingSettings)):Promise.resolve(new Map<string,ManualShippingReadResult>());
  const rows=await Promise.all(orderIds.map(async orderId=>{
   const source=cards.get(orderId),proof=evidence.get(orderId);
   if(!source||source.code!=='OK')return {orderId,result:source??{code:'UNAVAILABLE' as const,message:'Auftrag nicht verfügbar.'}};
   if(!proof||proof.code!=='OK')return {orderId,result:proof??{code:'UNAVAILABLE' as const,message:'Nachweise konnten nicht sicher geladen werden.'}};
   const card=source.data;
   try{
    const [shipping,informed,payment,shipment,appointment]=await Promise.all([
     shippingReads.then(rows=>{if(!rows.has(card.id))throw Error('SHIPPING_PROPOSAL_BATCH_SOURCE_MISSING');return rows.get(card.id);}),
     card.station==='fertig'?informedReads.then(rows=>{const value=rows.get(card.id);if(!value)throw Error('ORDER_NOTIFICATION_BATCH_SOURCE_MISSING');return value;}):Promise.resolve(undefined),
     card.station==='fertig'?paymentReads.then(rows=>{const value=rows.get(card.id);if(!value)throw Error('ORDER_PAYMENT_BATCH_SOURCE_MISSING');return maskOrderPaymentCredit(readAuth,value);}):Promise.resolve(undefined),
     card.handoverMode==='shipping'?shipmentReads.then(rows=>{const value=rows.get(card.id);if(!value)throw Error('MANUAL_SHIPPING_BATCH_SOURCE_MISSING');return value;}):Promise.resolve(undefined),
     card.station==='fertig'&&card.handoverMode==='pickup'?withPageReadPhase('action.appointment',()=>readOrderPickupAppointment(auth,card.id)):Promise.resolve(undefined),
    ]);
    if(informed?.code==='OK'&&informed.orderVersion!==card.version)return {orderId,result:{code:'UNAVAILABLE' as const,message:'Der Auftrag wurde während des Lesens geändert. Lade die Auftragskarte erneut.'}};
    return {orderId,result:{code:'OK' as const,data:{card,records:proof.data,shipping,informed,payment,shipment,appointment}}};
   }catch(error){console.error('[TODAY_ORDER_RULE_SOURCE_FAILED]',{orderId,name:error instanceof Error?error.name:'UnknownError'});return {orderId,result:{code:'UNAVAILABLE' as const,message:'Auftragskarte konnte nicht sicher geladen werden.'}};}
  }));
  return rows;
}
