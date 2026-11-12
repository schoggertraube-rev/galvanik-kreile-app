import {completeU2Read} from '@/lib/domain/u2ReadContract';
import 'server-only';
import {hasAuthorizationArea} from '@/lib/auth/authorizationContract';
import type {AuthorizationSnapshot} from './authorization';
import type {CustomerSummary} from './customerSummaryRead';
import {readAuthorizedV45Rule} from './v45RuleRead';
import {readV45ActionValues} from './v45ActionValuesRead';
import {readV45FirstLook} from './v45FirstLookRead';
import {readV45ObjectActionAbsence} from './v45ObjectActionsRead';
import {CUSTOMER_INVOICE_ACTION_COPY} from '@/ui/situationCatalog';
import type {CustomerListSignals} from '@/modules/customers/public';

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
function readV45CustomerRuleRaw(auth:AuthorizationSnapshot,customer:Pick<CustomerSummary,'id'|'updatedAt'|'email'|'billingEmail'|'invoiceUnsentCount'|'invoiceUnsentOriginals'|'kennzahlen'|'name'|'invoiceOpenCents'>,signals?:CustomerListSignals){
 const facts=v45CustomerFacts(customer,hasAuthorizationArea(auth,'geld'),customer.kennzahlen?.overdue?.invoiceCount);
 const source={kind:'customer' as const,id:customer.id,updatedAt:customer.updatedAt,...(signals?.asOf?{signalsAt:signals.asOf}:{})};
 const rule=readAuthorizedV45Rule(auth,'kunde',facts);

 const money=hasAuthorizationArea(auth,'geld'),mails=hasAuthorizationArea(auth,'mails');
 const values:Record<string,Readonly<Record<string,unknown>>>={'kunde.hauptaktion':{elementId:rule.code==='OK'?rule.hauptaktion:null}};
 if(customer.kennzahlen?.classification)values['kunde.einstufung']={einstufung:customer.kennzahlen.classification};
 if(signals&&knownCount(signals.activeOrderCount)&&knownCount(signals.activeQuoteCount))values['kunde.kachel.orders']={offeneAuftraege:signals.activeOrderCount,offeneKv:signals.activeQuoteCount};
 if(signals&&knownCount(signals.openComplaintCount))values['kunde.kachel.complaints']={offeneReklamationen:signals.openComplaintCount};
 if(money&&knownCount(customer.invoiceOpenCents)&&knownCount(customer.kennzahlen?.overdue?.invoiceCount))values['kunde.kachel.debt']={offeneForderungenCents:customer.invoiceOpenCents,ueberfaelligeRechnungen:customer.kennzahlen!.overdue!.invoiceCount};
 if(mails&&signals&&knownCount(signals.openMessageCount))values['kunde.kachel.messages']={offeneNachrichten:signals.openMessageCount};
 // R12 / PL20:00: debt owns the single alternative tile when both rights exist.
 // The allowed message information is still returned for its existing next view.
 const hidden=[...(!money?['kunde.kachel.debt']:[]),...(!mails||money?['kunde.kachel.messages']:[])];
 // Customer overview fields use the declared domain layout; S16 owns the later
 // state-specific golden capture (invoice has no captured reference case yet).
 const first=readV45FirstLook('kunde',values,hidden,undefined,true);if(first.code!=='OK')return {...first,source};
 // The customer overview has a single footer action in kunde.js. Require all
 // existing domain references to agree before projecting an empty alternative list.
 const alternatives=readV45ObjectActionAbsence('kunde');if(alternatives.code!=='OK')return {...alternatives,source,erstblick:first.erstblick,datenluecken:first.datenluecken};
 const weitereInformationen=money&&mails&&values['kunde.kachel.messages']?[{key:'kunde.kachel.messages',werte:values['kunde.kachel.messages']}]:[];
 const presentation={datenluecken:first.datenluecken,erstblick:first.erstblick,weitere:alternatives.weitere,weitereInformationen,source};
 const withheld={...presentation,erstblick:first.erstblick.map(field=>field.key==='kunde.hauptaktion'?{...field,werte:{elementId:null}}:field)};
 if(rule.code!=='OK')return {...rule,...withheld,hauptaktion:null};
 if(rule.hauptaktion===null)return {...rule,...withheld,hauptaktion:null};
 if(!('textKey' in rule)||typeof rule.textKey!=='string'||!('recht' in rule))return {code:'SOURCE_INCOMPLETE' as const,missing:['ACTION_METADATA'],...withheld,hauptaktion:null};
 let befehl:{datei:string;funktion:keyof typeof import('@/app/actions/communications.actions')|keyof typeof import('@/app/actions/customers.actions');argumente:Readonly<Record<string,unknown>>};
 let number:string|undefined;
 if(rule.hauptaktion==='customer.invoice'){
  const originals=customer.invoiceUnsentOriginals;
  if(!Array.isArray(originals)||!originals.length||originals.length!==customer.invoiceUnsentCount||originals.some(original=>typeof original.id!=='string'||typeof original.number!=='string'||!Number.isSafeInteger(original.version)))return {code:'SOURCE_INCOMPLETE' as const,missing:['CUSTOMER_INVOICE_ORIGINAL'],...withheld,hauptaktion:null};
  const original=originals[0];
  number=CUSTOMER_INVOICE_ACTION_COPY.numbers(originals.map(row=>row.number));
  befehl={datei:'src/app/actions/communications.actions.ts',funktion:'sendCustomerMailAction',argumente:{targetType:'CUSTOMER',targetId:customer.id,attachment:{kind:'INVOICE',documentId:original.id},expectedInvoiceIds:originals.map(row=>row.id)}};
 }else if(rule.hauptaktion==='customer.edit')befehl={datei:'src/app/actions/customers.actions.ts',funktion:'updateCustomerAction',argumente:{customerId:customer.id}};
 else return {code:'SOURCE_INCOMPLETE' as const,missing:['CUSTOMER_ACTION_BINDING'],...withheld,hauptaktion:null};
 const parameters=readV45ActionValues(rule.textKey,{name:customer.name,...(number?{number}:{})});if(parameters.code!=='OK')return {...parameters,...withheld,hauptaktion:null};

 return {...rule,...presentation,hauptaktion:{elementId:rule.hauptaktion,textKey:rule.textKey,werte:parameters.werte,befehl,recht:rule.recht},quelle:{...rule.quelle,elementeSha256:first.quelle.sha256,erstblickRegel:'R12/PL20:00',erwartungSha256:alternatives.quelle.sha256},source};
}

export function readV45CustomerRule(...args:Parameters<typeof readV45CustomerRuleRaw>){return completeU2Read(readV45CustomerRuleRaw(...args));}
