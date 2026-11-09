import 'server-only';
import {hasAuthorizationArea,type AuthorizationSnapshot} from '@/lib/server/authorization';
import type {PrivilegedTenantTransaction} from '@/lib/server/privilegedDb';
import type {PackageCustomerHistory} from '@/lib/server/packageIntakeContextPort';
import {packagePartWords} from '@/lib/domain/packagePartWords';
import type {QuoteReadback} from '@/modules/quotes/public';
import type {IntakeCapture} from '../captureContract';

/** Existing orders and quote lifecycle are authoritative; this is only a read projection. */
export async function readPackageExpectation(_tx:PrivilegedTenantTransaction,auth:AuthorizationSnapshot,capture:IntakeCapture,quotes:{code:'OK';quotes:QuoteReadback[]}|{code:string}|null,quoteHistory:PackageCustomerHistory[]=[],orderHistory:PackageCustomerHistory[]=[]){
 const canOrders=hasAuthorizationArea(auth,'auftraege'),canCustomers=hasAuthorizationArea(auth,'kunden');
 if(quotes&&quotes.code!=='OK')throw Error('PACKAGE_QUOTE_CONTEXT_UNAVAILABLE');
 const text=capture.recognition?.text??capture.text??'';
 const history:PackageCustomerHistory[]=!capture.customerId&&canCustomers?[...orderHistory]:[];
 if(!capture.customerId&&canCustomers)history.push(...quoteHistory);
 const distinct=new Map<string,PackageCustomerHistory>();for(const row of history.sort((a,b)=>Date.parse(b.lastAt)-Date.parse(a.lastAt)||a.customerId.localeCompare(b.customerId)))if(!distinct.has(row.customerId))distinct.set(row.customerId,row);
 const customers=[...distinct.values()].slice(0,3);
 const candidates:Array<{kind:'quote'|'order';id:string;number:string;state:'accepted'|'pending'|'waiting'|'rework';customerId:string;customerName?:string;edition?:number;goodsHere?:boolean;location?:string|null}>=[];
 const words=packagePartWords(text);
 if(quotes&&'quotes'in quotes)for(const quote of quotes.quotes){
  const matched=capture.customerId?quote.customerId===capture.customerId:canCustomers&&words.some(word=>packagePartWords([quote.customerDisplayName,...quote.positions.map(row=>row.name)].join(' ')).includes(word));
  if(!matched||quote.linkedOrderId||!quote.lifecycle?.sentAt&&!quote.lifecycle?.acceptedAt||quote.lifecycle?.stage==='abgesagt')continue;
  const accepted=quote.lifecycle?.acceptedEdition===quote.lifecycle?.edition&&!!quote.lifecycle?.acceptedAt;
  candidates.push({kind:'quote',id:quote.quoteId,number:quote.quoteNumber,state:accepted?'accepted':'pending',customerId:quote.customerId,customerName:quote.customerDisplayName,edition:quote.lifecycle?.edition??1,goodsHere:!!quote.lifecycle?.goods?.some(row=>!row.orderId),location:quote.lifecycle?.goods?.find(row=>!row.orderId)?.location??null});
 }
 if(capture.customerId&&canOrders)for(const order of capture.expectedOrders??[])if(order.customerId===capture.customerId)candidates.push({kind:'order',id:order.id,number:order.number,state:order.reason==='rework'?'rework':'waiting',customerId:order.customerId});
 return {status:'OK' as const,customers,candidates:candidates.slice(0,3),ambiguous:candidates.length>1,moreCandidates:candidates.length>3};
}
