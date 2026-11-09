import type {LiveOrderCard} from '@/lib/server/orderCardRead';
import type {OrderPaymentState} from '@/lib/server/paymentContract';
import type {InvoiceTruthRow} from '@/lib/server/invoiceTruthRead';
export type FinishedDispatchFacts={evidenceGaps?:string[];card:LiveOrderCard;payment:OrderPaymentState;invoices:InvoiceTruthRow[];today:string;now:string;customerEmail:string|null;invoiceSentAt:string|null;packed:boolean;labelReady:boolean;delivered:boolean};
export type FinishedDispatch={orderId:string;version:number;orderNumber:string;customerId:string;customerNumber:string|null;customerName:string;handover:'pickup'|'shipping'|null;stage:'workshop'|'S0'|'S1'|'S2'|'S3'|'S4'|'S5'|'ended';color:'neutral'|'red'|'yellow'|'green';group:'ready'|'action'|'waiting'|'archive';action:'workshop'|'releaseInvoice'|'sendInvoice'|'callCustomer'|'collectPayment'|'prepareParcel'|'handOver'|'waitForDelivery'|'complete';blocked:boolean;blockingInvoiceIds:string[];informationAllowed:true;partial:boolean;overdue:boolean;gaps:string[];goodsOutEventId:string|null;asOf:string};
/** A projection only: no UI flags, saved station, payment override or inferred provider success. */
export function deriveFinishedDispatch(facts:FinishedDispatchFacts):FinishedDispatch{
 const {card,payment}=facts,active=facts.invoices.filter(invoice=>invoice.status==='issued'),own=active.filter(invoice=>invoice.orderId===card.id);
 const debts=active.filter(invoice=>invoice.orderId!==card.id&&invoice.paymentStatus!==null&&invoice.paymentStatus!=='bezahlt'&&invoice.openAmountCents>0&&invoice.dueDate<facts.today);
 const gaps:string[]=[...(facts.evidenceGaps??[])];if(active.some(invoice=>invoice.paymentStatus===null))gaps.push('PAYMENT_PROOF_MISSING');if(!card.handoverMode)gaps.push('HANDOVER_MISSING');if(!own.length)gaps.push('INVOICE_NOT_ISSUED');
 const partial=card.items.some(item=>item.finished)&&!card.items.every(item=>item.finished),finished=card.station==='fertig'||card.items.length>0&&card.items.every(item=>item.finished);
 const overdue=!payment.goodsOut&&Boolean(card.dueAt&&card.dueAt.slice(0,10)<facts.today),blocked=debts.length>0,unknown=gaps.includes('PAYMENT_PROOF_MISSING');
 let stage:FinishedDispatch['stage']='workshop',action:FinishedDispatch['action']='workshop',group:FinishedDispatch['group']='action';
 if(payment.goodsOut){if(payment.goodsOut.mode==='abholung'||facts.delivered){stage='ended';action=own.length?'complete':'releaseInvoice';group=own.length?'archive':'action';}else{stage='S5';action='waitForDelivery';group='waiting';gaps.push('DELIVERY_NOT_CONFIRMED');}}
 else if(finished||partial){
  if(!own.length){stage='S0';action='releaseInvoice';}
  else if(!facts.invoiceSentAt){stage='S1';action=facts.customerEmail?'sendInvoice':'callCustomer';gaps.push('INVOICE_COMMUNICATION_NOT_PROVEN');}
  else if(blocked||unknown||!payment.goodsOutAllowed){stage='S2';action='collectPayment';}
  else if(card.handoverMode==='shipping'&&(!facts.packed||!facts.labelReady)){stage='S3';action='prepareParcel';}
  else{stage='S4';action='handOver';group='ready';}
 }
 if(partial)gaps.push('PARTIAL_FINISHED_GOODS');
 const contactFailure=stage==='S1'&&!facts.customerEmail;
 const color:FinishedDispatch['color']=blocked||unknown||overdue||contactFailure?'red':stage==='S2'?'yellow':group==='ready'?'green':'neutral';
 if(color!=='green'&&group==='ready')group='action';
 return {orderId:card.id,version:card.version,orderNumber:card.orderNumber,customerId:card.customerId,customerNumber:card.customerNumber??null,customerName:card.customerName,handover:card.handoverMode,stage,color,group,action,blocked,blockingInvoiceIds:debts.map(invoice=>invoice.invoiceId),informationAllowed:true,partial,overdue,gaps,goodsOutEventId:payment.goodsOut?.eventId??null,asOf:facts.now};
}
export function sortFinishedDispatch(rows:readonly FinishedDispatch[],dueDates:Readonly<Record<string,string|null>>){const rank={red:0,yellow:1,neutral:2,green:3},groups={ready:0,action:1,waiting:2,archive:3};return [...rows].sort((a,b)=>groups[a.group]-groups[b.group]||rank[a.color]-rank[b.color]||(dueDates[a.orderId]??'9999').localeCompare(dueDates[b.orderId]??'9999')||a.orderNumber.localeCompare(b.orderNumber));}
