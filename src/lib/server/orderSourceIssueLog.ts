import 'server-only';
import {warnOncePerPageRead} from '@/db/readBudget';

const knownCodes=new Set(['ORDER_CARD_QUOTE_PRICE_INVALID','SHIPPING_PROPOSAL_ORDER_SOURCE_INVALID']);

/** One qualified source hint per order and request; unexpected faults stay errors. */
export function reportOrderSourceIssue(tag:string,orderId:string,reason:string):void{
 const detail={orderId,code:reason};
 if(knownCodes.has(reason))warnOncePerPageRead('order:'+orderId,()=>console.warn(tag,detail));
 else console.error(tag,detail);
}
