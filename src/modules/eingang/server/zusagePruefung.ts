import 'server-only';

import {canChangeOrderHandover,hasAuthorizationArea} from '@/lib/auth/authorizationContract';
import {formatEuro} from '@/lib/domain/formatEuro';
import type {AuthorizationSnapshot} from '@/lib/server/authorization';
import {readPendingInvoiceReissue} from '@/lib/server/commands/immutableInvoiceCommand';
import {readOpenOrderComplaint} from '@/lib/server/orderReleaseRead';
import {getPaymentState,readCustomerDeliveryBlock} from '@/lib/server/paymentSummaryRead';
import {withPrivilegedTenantTransaction} from '@/lib/server/privilegedDb';
import {MAIL_PROMISE_COPY} from '@/ui/eingangMailCopy';
import {COMPLAINT_ORDER_COPY,SHIPPING_FEE_COPY} from '@/ui/situationCatalog';

export type ZusageInput={
  art:'herausgabe'|'termin'|'menge'|'auftrag_aus_kv'|'preis_im_text'|'storno'|'stammdaten'|'kanal_versand';
  customerId?:string;
  orderId?:string;
  menge?:number;
  termin?:string;
};
export type ZusageGrund='unbekannt'|'recht'|'preisrecht'|'liefersperre'|'vorkasse'|'reklamation'|'neuausstellung';
export type ZusageErgebnis={frei:true}|{
  frei:false;
  grund:ZusageGrund;
  text:string;
  ausweg?:{befehl:string;text:string};
  ausnahme?:{recht:'entscheiden'};
};

const unavailable={frei:false,grund:'unbekannt',text:MAIL_PROMISE_COPY.unavailable} as const;
const permission={frei:false,grund:'recht',text:MAIL_PROMISE_COPY.handoverRight} as const;

/** Mail uses the established payment and goods-out evidence before making a promise. */
export async function pruefeZusage(auth:AuthorizationSnapshot,input:ZusageInput):Promise<ZusageErgebnis>{
  if(!hasAuthorizationArea(auth,'mails'))return permission;
  if(input.art==='preis_im_text')return hasAuthorizationArea(auth,'preise')?{frei:true}:
    {frei:false,grund:'preisrecht',text:MAIL_PROMISE_COPY.priceRight};
  if(input.art!=='herausgabe')return unavailable;
  if(!canChangeOrderHandover(auth,'mail'))return permission;
  if(!input.customerId||!input.orderId)return unavailable;
  const {customerId,orderId}=input;
  try{
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
