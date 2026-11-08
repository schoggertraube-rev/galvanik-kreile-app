import 'server-only';
import {hasAuthorizationArea,type AuthorizationSnapshot} from '@/lib/server/authorization';
import type {PrivilegedTenantTransaction} from '@/lib/server/privilegedDb';
import {readPackageOrderCustomers,packagePartWords,type PackageCustomerHistory} from '@/lib/server/packageIntakeContextPort';
import type {QuoteReadback} from '@/modules/quotes/public';
import type {IntakeCapture} from '../captureContract';

/** Existing orders and quote lifecycle are authoritative; this is only a read projection. */
export async function readPackageExpectation(tx:PrivilegedTenantTransaction,auth:AuthorizationSnapshot,capture:IntakeCapture,quotes:{code:'OK';quotes:QuoteReadback[]}|{code:string}|null){
 const canOrders=hasAuthorizationArea(auth,'auftraege'),canCustomers=hasAuthorizationArea(auth,'kunden');
 if(quotes&&quotes.code!=='OK')throw Error('PACKAGE_QUOTE_CONTEXT_UNAVAILABLE');
 const text=capture.recognition?.text??capture.text??'';
 const history:PackageCustomerHistory[]=!capture.customerId&&canCustomers?await readPackageOrderCustomers(tx,auth,text):[];
 const words=packagePartWords(text);
 if(!capture.customerId&&canCustomers&&quotes&&'quotes'in quotes)for(const quote of quotes.quotes){
  if(!quote.positions.some(position=>packagePartWords(position.name).some(word=>words.includes(word))))continue;
  history.push({customerId:quote.customerId,customerName:quote.customerDisplayName,lastAt:quote.createdAt,source:'quote'});
 }
 const distinct=new Map<string,PackageCustomerHistory>();for(const row of history.sort((a,b)=>Date.parse(b.lastAt)-Date.parse(a.lastAt)||a.customerId.localeCompare(b.customerId)))if(!distinct.has(row.customerId))distinct.set(row.customerId,row);
 const customers=[...distinct.values()].slice(0,3);
 const candidates:Array<{kind:'quote'|'order';id:string;number:string;state:'accepted'|'pending'|'waiting';customerId:string;customerName?:string;edition?:number;goodsHere?:boolean;location?:string|null}>=[];
 if(capture.customerId&&quotes&&'quotes'in quotes)for(const quote of quotes.quotes){
  if(quote.customerId!==capture.customerId||quote.linkedOrderId||!quote.lifecycle?.sentAt&&!quote.lifecycle?.acceptedAt||quote.lifecycle?.stage==='abgesagt')continue;
  const accepted=quote.lifecycle?.acceptedEdition===quote.lifecycle?.edition&&!!quote.lifecycle?.acceptedAt;
  candidates.push({kind:'quote',id:quote.quoteId,number:quote.quoteNumber,state:accepted?'accepted':'pending',customerId:quote.customerId,customerName:quote.customerDisplayName,edition:quote.lifecycle?.edition??1,goodsHere:!!quote.lifecycle?.goods?.some(row=>!row.orderId),location:quote.lifecycle?.goods?.find(row=>!row.orderId)?.location??null});
 }
 if(capture.customerId&&canOrders)for(const order of capture.expectedOrders??[])if(order.customerId===capture.customerId)candidates.push({kind:'order',id:order.id,number:order.number,state:'waiting',customerId:order.customerId});
 return {status:'OK' as const,customers,candidates:candidates.slice(0,3),ambiguous:candidates.length>1,moreCandidates:candidates.length>3};
}
