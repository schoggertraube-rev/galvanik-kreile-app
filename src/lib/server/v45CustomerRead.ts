import 'server-only';
import {hasAuthorizationArea} from '@/lib/auth/authorizationContract';
import type {AuthorizationSnapshot} from './authorization';
import type {CustomerSummary} from './customerSummaryRead';
import {readAuthorizedV45Rule} from './v45RuleRead';

type ContactFacts=Pick<CustomerSummary,'email'|'billingEmail'|'invoiceUnsentCount'>;
const knownCount=(value:unknown):value is number=>typeof value==='number'&&Number.isSafeInteger(value)&&value>=0;
function missing(value:unknown){return value===null?true:typeof value==='string'?value.trim().length===0:undefined;}
/** Only already qualified customer/financial read facts. PL12:01 leaves the
 * reminder/dunning facts unknown until S08b; pickup/quote work is not guessed. */
export function v45CustomerFacts(customer:ContactFacts,money:boolean,overdueCount?:number):Readonly<Record<string,unknown>>{
 const facts:Record<string,unknown>={};
 const unsent=money&&knownCount(customer.invoiceUnsentCount)?customer.invoiceUnsentCount>0:undefined;
 const overdue=money&&knownCount(overdueCount)?overdueCount>0:undefined;
 if(unsent!==undefined)facts.unsentInvoice=unsent;
 if(overdue!==undefined)facts.overdue=overdue;
 if(unsent===true||overdue===true)facts.hasAction=true;
 const emailMissing=missing(customer.email),billingMissing=missing(customer.billingEmail);
 if(emailMissing===false)facts.emailMissing=false;
 else if(emailMissing===true){
  if(billingMissing===true)facts.emailMissing=true;
  else if(billingMissing===false&&(unsent===true||overdue===true))facts.emailMissing=false;
  else if(billingMissing===false&&unsent===false&&overdue===false)facts.emailMissing=true;
 }
 return facts;
}
/** The customer's rule seam uses the same summary/metrics snapshot, not a
 * second customer or revenue query. This is not the full U2 presentation. */
export function readV45CustomerRule(auth:AuthorizationSnapshot,customer:Pick<CustomerSummary,'id'|'updatedAt'|'email'|'billingEmail'|'invoiceUnsentCount'|'kennzahlen'>){
 const facts=v45CustomerFacts(customer,hasAuthorizationArea(auth,'geld'),customer.kennzahlen?.overdue?.invoiceCount);
 return {...readAuthorizedV45Rule(auth,'kunde',facts),source:{kind:'customer' as const,id:customer.id,updatedAt:customer.updatedAt}};
}
