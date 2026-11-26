import 'server-only';

import {canChangeOrderHandover,hasAuthorizationArea} from '@/lib/auth/authorizationContract';
import {formatEuro} from '@/lib/domain/formatEuro';
import type {IntakeSuggestionsInput,IntakeTermSuggestion} from '@/lib/intakeSuggestionsContract';
import type {AuthorizationSnapshot} from '@/lib/server/authorization';
import {readPendingInvoiceReissue} from '@/lib/server/commands/immutableInvoiceCommand';
import {readLiveOrderCard} from '@/lib/server/orderCardRead';
import {readOpenOrderComplaint} from '@/lib/server/orderReleaseRead';
import {getPaymentState,readCustomerDeliveryBlock} from '@/lib/server/paymentSummaryRead';
import {withPrivilegedTenantTransaction} from '@/lib/server/privilegedDb';
import {normaliseOrderPositionUnit,orderPositionQuantityError,orderPositionUnitLabel} from '@/lib/orderPositionContract';
import type {QuoteReadback} from '@/modules/quotes/public';
import {MAIL_PROMISE_COPY} from '@/ui/eingangMailCopy';
import {COMPLAINT_ORDER_COPY,SHIPPING_FEE_COPY} from '@/ui/situationCatalog';

export type ZusageInput={
  art:'herausgabe'|'termin'|'menge'|'auftrag_aus_kv'|'preis_im_text'|'storno'|'stammdaten'|'kanal_versand';
  customerId?:string;
  orderId?:string;
  menge?:number;
  termin?:string;
};
export type ZusageGrund='unbekannt'|'recht'|'preisrecht'|'liefersperre'|'vorkasse'|'reklamation'|'neuausstellung'|'termin'|
  'menge'|'kv_abgelaufen'|'kv_schon_auftrag';
export type ZusageErgebnis={frei:true}|{
  frei:false;
  grund:ZusageGrund;
  text:string;
  ausweg?:{befehl:string;text:string};
  ausnahme?:{recht:'entscheiden'};
};
export type ZusageLeser={
  termin:(auth:AuthorizationSnapshot,input:IntakeSuggestionsInput)=>Promise<{term:IntakeTermSuggestion|null}>;
  kv:(auth:AuthorizationSnapshot,quoteId:string)=>Promise<QuoteReadback|null>;
};

const unavailable={frei:false,grund:'unbekannt',text:MAIL_PROMISE_COPY.unavailable} as const;
const permission={frei:false,grund:'recht',text:MAIL_PROMISE_COPY.handoverRight} as const;

async function readPromiseOrder(auth:AuthorizationSnapshot,input:ZusageInput){
  if(!input.orderId)return null;
  const source=await readLiveOrderCard(auth,{orderId:input.orderId});
  return source.code==='OK'&&(!input.customerId||input.customerId===source.data.customerId)?source.data:null;
}

async function pruefeTermin(auth:AuthorizationSnapshot,input:ZusageInput,readTerm:ZusageLeser['termin']):Promise<ZusageErgebnis>{
  if(!input.termin)return unavailable;
  const card=await readPromiseOrder(auth,input);
  if(!card)return unavailable;
  if(!card.handoverMode||card.items.some(item=>item.unitPriceCents===null))return unavailable;
  const suggested=await readTerm(auth,{kind:'ORDER',customerId:card.customerId,wishDate:input.termin,
    handoverMode:card.handoverMode,positions:card.items.map(item=>({
      key:item.id,catalogServiceId:item.catalogServiceId,name:item.name,quantity:item.quantity,
      surfaceRequested:item.surfaceRequested,unit:item.unit,unitPriceCents:item.unitPriceCents,
    }))});
  const term=suggested.term;
  if(!term?.achievableDate||!term.rating)return unavailable;
  if(term.rating==='nicht_machbar'||term.rating==='unmoeglich')return {
    frei:false,grund:'termin',text:MAIL_PROMISE_COPY.earliestTerm(input.termin,term.achievableDate),
  };
  return {frei:true};
}

type PromisePosition={quantity:number;unit?:string|null};
// The existing position contract admits up to three decimal places.
const quantityMilli=(quantity:number)=>Math.round(quantity*1000);

function requestedQuantityBlock(requested:number|undefined,positions:readonly PromisePosition[]):ZusageErgebnis|null{
  if(requested===undefined)return null;
  const unit=normaliseOrderPositionUnit(positions[0]?.unit);
  if(!unit||orderPositionQuantityError(requested,unit)||positions.some(position=>normaliseOrderPositionUnit(position.unit)!==unit))return unavailable;
  const total=positions.reduce((sum,position)=>sum+quantityMilli(position.quantity),0);
  return quantityMilli(requested)===total?null:{frei:false,grund:'menge',text:MAIL_PROMISE_COPY.quantityMismatch(requested,total/1000)};
}

async function pruefeMenge(auth:AuthorizationSnapshot,input:ZusageInput):Promise<ZusageErgebnis>{
  const card=await readPromiseOrder(auth,input);
  if(!card?.items.length)return unavailable;
  const groups=new Map<string,{ware:string;fertig:number;gesamt:number}>();
  for(const item of card.items){
    if(orderPositionQuantityError(item.quantity,item.unit))return unavailable;
    const unit=normaliseOrderPositionUnit(item.unit);
    const key=JSON.stringify([item.name,unit]);
    const group=groups.get(key)??{ware:unit?`${orderPositionUnitLabel(unit)} ${item.name}`:item.name,fertig:0,gesamt:0};
    const amount=quantityMilli(item.quantity);
    group.gesamt+=amount;
    if(item.finished)group.fertig+=amount;
    groups.set(key,group);
  }
  const notReady=[...groups.values()].filter(group=>group.fertig<group.gesamt);
  if(notReady.length)return {frei:false,grund:'menge',text:MAIL_PROMISE_COPY.quantityNotReady(notReady.map(group=>({
    ...group,fertig:group.fertig/1000,gesamt:group.gesamt/1000,
  })))};
  return requestedQuantityBlock(input.menge,card.items)??{frei:true};
}

async function pruefeKVAuftrag(auth:AuthorizationSnapshot,input:ZusageInput,readQuote:ZusageLeser['kv']):Promise<ZusageErgebnis>{
  if(!input.orderId)return unavailable;
  const quote=await readQuote(auth,input.orderId);
  if(!quote||input.customerId&&input.customerId!==quote.customerId)return unavailable;
  if(quote.linkedOrderId){
    const linked=await readPromiseOrder(auth,{...input,orderId:quote.linkedOrderId,customerId:quote.customerId});
    return linked?{frei:false,grund:'kv_schon_auftrag',text:MAIL_PROMISE_COPY.quoteAlreadyOrder(quote.quoteNumber,linked.orderNumber)}:unavailable;
  }
  const lifecycle=quote.lifecycle;
  if(lifecycle?.stage==='abgelaufen')return {frei:false,grund:'kv_abgelaufen',text:MAIL_PROMISE_COPY.quoteExpired(quote.quoteNumber)};
  if(!quote.positions.length||quote.positions.some(position=>orderPositionQuantityError(position.quantity,position.unit??null)))return unavailable;
  const difference=requestedQuantityBlock(input.menge,quote.positions);
  if(difference)return difference;
  return lifecycle?.stage==='zugesagt'&&lifecycle.acceptedEdition===lifecycle.edition?{frei:true}:unavailable;
}

/** Mail uses the established payment and goods-out evidence before making a promise. */
export async function pruefeZusage(auth:AuthorizationSnapshot,input:ZusageInput,leser:ZusageLeser):Promise<ZusageErgebnis>{
  if(!hasAuthorizationArea(auth,'mails'))return permission;
  if(input.art==='preis_im_text')return hasAuthorizationArea(auth,'preise')?{frei:true}:
    {frei:false,grund:'preisrecht',text:MAIL_PROMISE_COPY.priceRight};
  if(input.art!=='herausgabe'&&input.art!=='termin'&&input.art!=='menge'&&input.art!=='auftrag_aus_kv')return unavailable;
  if(!canChangeOrderHandover(auth,'mail'))return permission;
  try{
    if(input.art==='termin')return await pruefeTermin(auth,input,leser.termin);
    if(input.art==='menge')return await pruefeMenge(auth,input);
    if(input.art==='auftrag_aus_kv')return await pruefeKVAuftrag(auth,input,leser.kv);
    if(!input.customerId||!input.orderId)return unavailable;
    const {customerId,orderId}=input;
    const debt=await readCustomerDeliveryBlock(auth,customerId,orderId);
    if(debt.code!=='OK')return unavailable;
    const stop=await withPrivilegedTenantTransaction(auth,async tx=>{
      const reissue=await readPendingInvoiceReissue(tx,auth.tenantId,orderId);
      if(reissue!==null)return {frei:false,grund:'neuausstellung',text:SHIPPING_FEE_COPY.reissueReleaseBlocked(reissue)} as const;
      const complaint=await readOpenOrderComplaint(tx,auth.tenantId,orderId);
      return complaint?{frei:false,grund:'reklamation',text:COMPLAINT_ORDER_COPY.releaseBlocked(complaint.number)} as const:null;
    });
    if(stop)return stop;
    const ausnahme=hasAuthorizationArea(auth,'entscheiden')?{ausnahme:{recht:'entscheiden' as const}}:{};
    if(debt.data.blocked){
      const invoice=debt.oldest;
      return {frei:false,grund:'liefersperre',text:invoice?MAIL_PROMISE_COPY.overdue(invoice.number,formatEuro(invoice.openAmountCents),invoice.daysOverdue):MAIL_PROMISE_COPY.overdueWithoutAmounts,
        ...(invoice?{ausweg:{befehl:'confirmPaymentAction',text:MAIL_PROMISE_COPY.collectAtPickup(invoice.number)}}:{}),...ausnahme};
    }
    if(debt.paymentMode==='rechnung'||debt.paymentMode==='keiner')return {frei:true};
    if(!debt.handover)return unavailable;
    const payment=await getPaymentState(auth,orderId);
    if(payment.code!=='OK'||payment.data.mode!==debt.paymentMode||!payment.data.payment)return unavailable;
    if(payment.data.goodsOutAllowed)return {frei:true};
    const amount=hasAuthorizationArea(auth,'zahlungen')?formatEuro(payment.data.payment.openAmountCents):null;
    return {frei:false,grund:'vorkasse',text:MAIL_PROMISE_COPY.prepayment(amount,debt.handover),...ausnahme};
  }catch(error){
    console.error('[MAIL_PROMISE_SOURCE_UNAVAILABLE]',error instanceof Error?error.name:'UnknownError');
    return unavailable;
  }
}
