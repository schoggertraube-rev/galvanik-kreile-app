import 'server-only';

import {formatEuro} from '@/lib/domain/formatEuro';
import type {AuthorizationSnapshot} from '@/lib/server/authorization';
import {readOpenOrderComplaint} from '@/lib/server/orderReleaseRead';
import {readCustomerDeliveryBlockInTransaction,readMailPaymentReleaseInTransaction} from '@/lib/server/paymentSummaryRead';
import type {PrivilegedTenantTransaction} from '@/lib/server/privilegedDb';
import {MAIL_PROMISE_COPY} from '@/ui/eingangMailCopy';
import {COMPLAINT_ORDER_COPY} from '@/ui/situationCatalog';
import {readPendingInvoiceReissue} from './immutableInvoiceCommand';
import {readMailHandoverForPromise,type MailShippingSettingsReader} from './orderContentCommand';
export type {MailShippingSettingsReader} from './orderContentCommand';

export type ZusageGrund='unbekannt'|'unbekannt_zahlung'|'recht'|'preisrecht'|'liefersperre'|'vorkasse'|'abholzahlung'|'reklamation'|'neuausstellung'|'termin'|
  'unbekannt_termin'|'unbekannt_kv'|'unbekannt_kanal'|'absender_fremd'|'zu_spaet'|'etikett'|
  'menge'|'kv_abgelaufen'|'kv_schon_auftrag'|'storno'|'stammdaten'|'abwesenheit'|'dublette'|'beleg_dublette'|'zahlungsavis'|'kein_vorschlag';
export type ZusageErgebnis={frei:true}|{
  frei:false;
  grund:ZusageGrund;
  text:string;
  ausweg?:{befehl:string;text:string};
  hinweis?:string;
};

const unavailable={frei:false,grund:'unbekannt_zahlung',text:MAIL_PROMISE_COPY.unknownPayment} as const;

export async function pruefeVersand(
  tx:PrivilegedTenantTransaction,auth:AuthorizationSnapshot,
  input:{customerId:string;orderId:string;art:'zu_spaet'|'etikett';wiedervorlage:boolean;fromPickup:boolean},
  readSettings:MailShippingSettingsReader,
):Promise<ZusageErgebnis>{
  const boundary=await readMailHandoverForPromise(tx,auth,input,readSettings);
  if(boundary?.handedOver||boundary?.beforeCutoff===false)return {frei:false,grund:'zu_spaet',text:MAIL_PROMISE_COPY.tooLate};
  if(boundary?.labelBooked&&!input.wiedervorlage)return {frei:false,grund:'etikett',text:MAIL_PROMISE_COPY.labelBooked};
  if(boundary?.beforeCutoff===true||boundary?.pickupChangeAllowed===true)return {frei:true};
  return {frei:false,grund:'unbekannt',text:MAIL_PROMISE_COPY.pending[input.art]};
}

export async function pruefeHerausgabe(
  tx:PrivilegedTenantTransaction,auth:AuthorizationSnapshot,input:{customerId:string;orderId:string;antwortBis?:string},
):Promise<ZusageErgebnis>{
  const {customerId,orderId}=input;
  const debt=await readCustomerDeliveryBlockInTransaction(tx,auth,customerId,orderId);
  if(debt.code!=='OK')return unavailable;
  const reissue=await readPendingInvoiceReissue(tx,auth.tenantId,orderId);
  if(reissue!==null)return {frei:false,grund:'neuausstellung',
    text:MAIL_PROMISE_COPY.reissue(reissue,debt.handover,input.antwortBis),hinweis:MAIL_PROMISE_COPY.reissueHint(debt.handover)};
  const complaint=await readOpenOrderComplaint(tx,auth.tenantId,orderId);
  if(complaint)return {frei:false,grund:'reklamation',text:COMPLAINT_ORDER_COPY.releaseBlocked(complaint.number)};

  if(debt.data.blocked){
    const invoice=debt.oldest;
    if(!invoice||!debt.handover)return {frei:false,grund:'liefersperre',text:MAIL_PROMISE_COPY.overdueWithoutAmounts(debt.handover)};
    const older={number:invoice.number,amount:formatEuro(invoice.openAmountCents)};
    const payment=debt.paymentMode==='rechnung'?null:await readMailPaymentReleaseInTransaction(tx,auth,orderId);
    const current=payment&&payment.invoiceId&&payment.invoiceId!==invoice.id&&
      payment.mode===debt.paymentMode&&!payment.paid&&payment.amount!==null&&payment.amount>0
      ? {number:payment.orderNumber,amount:formatEuro(payment.amount),total:formatEuro(invoice.openAmountCents+payment.amount)}:null;
    return {frei:false,grund:'liefersperre',text:MAIL_PROMISE_COPY.overdue(debt.handover,older,current),
      hinweis:MAIL_PROMISE_COPY.overdueHint(debt.handover,older,current)};
  }
  if(debt.paymentMode==='rechnung'||debt.paymentMode==='keiner')return {frei:true};
  if(!debt.handover||debt.paymentMode!=='vorkasse'&&debt.paymentMode!=='abholung')return unavailable;
  const payment=await readMailPaymentReleaseInTransaction(tx,auth,orderId);
  if(!payment||payment.mode!==debt.paymentMode)return unavailable;
  if(payment.paid)return payment.ready?{frei:true}:unavailable;
  const amount=payment.amount===null?null:formatEuro(payment.amount);
  const text=MAIL_PROMISE_COPY.prepayment(amount,debt.handover,debt.paymentMode);
  return {frei:false,grund:debt.paymentMode==='vorkasse'?'vorkasse':'abholzahlung',text};
}
