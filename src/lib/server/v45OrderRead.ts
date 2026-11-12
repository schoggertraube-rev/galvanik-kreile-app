import 'server-only';
import type {LiveOrderCard} from './orderCardRead';
import type {AuthorizationSnapshot} from './authorization';
import type {readOrderInformed} from './orderReleaseRead';
import {readAuthorizedV45Rule} from './v45RuleRead';
import {readV45FirstLook} from './v45FirstLookRead';
import {readV45ActionValues} from './v45ActionValuesRead';
import {readV45ObjectActionAbsence} from './v45ObjectActionsRead';

/** Facts exposed by the existing versioned card. Missing shipment, financial
 * and approval evidence deliberately stays unknown, never a false calm state.
 * This is the rule seam for U2, not its complete presentation contract. */
export function v45OrderFacts(card:Pick<LiveOrderCard,'station'|'handoverMode'|'items'|'operationalFacts'>):Readonly<Record<string,unknown>>{
 const shipping=card.handoverMode===null?{}:{shipping:card.handoverMode==='shipping'};
 // The persisted 'abgeholt' station is shared by pickup and carrier handover.
 // It proves customer receipt only for a known pickup, never for shipping.
 const transportUnknown=card.station==='versendet'||card.station==='abgeholt'&&card.handoverMode!=='pickup';
 // Existing start command consumes the persisted angenommen station; V45 names it wareneingang.
 return {station:card.station==='angenommen'?'wareneingang':card.station,...shipping,...(card.operationalFacts&&typeof card.operationalFacts.pricesMissing==='boolean'&&typeof card.operationalFacts.rework==='boolean'?card.operationalFacts:{}),
  ...(!transportUnknown?{closed:card.station==='abgeholt',inTransit:false,returning:false}:{}),
  allDone:card.items.length>0&&card.items.every(item=>item.finished)};
}
type ReleaseSource={orderId:string;value:Awaited<ReturnType<typeof readOrderInformed>>};
/** Reuse the already-qualified release reader from the very same card version.
 * A failed or stale read supplies no negative facts and no money is projected. */
export function v45OrderReleaseFacts(card:{id:string;version:number},source?:ReleaseSource):Readonly<Record<string,unknown>>{
 if(!source||source.orderId!==card.id||source.value.code!=='OK'||source.value.orderVersion!==card.version)return {};
 const value=source.value,facts:Record<string,unknown>={};
 if(value.invoiceState==='issued'||value.invoiceState==='not_issued')facts.invoiceIssued=value.invoiceState==='issued';
 if(typeof value.paymentReady==='boolean')facts.paymentReady=value.paymentReady;
 if(value.informed===null)facts.noticeSent=false;
 else if(value.informed.orderId===card.id&&value.informed.freezeId===value.freezeId)facts.noticeSent=true;
 if(Array.isArray(value.complaintIds)&&value.complaintIds.every(id=>typeof id==='string'))facts.complaint=value.complaintIds.length>0;
 return facts;
}
export function readV45OrderRule(auth:AuthorizationSnapshot,card:Pick<LiveOrderCard,'id'|'version'|'orderNumber'|'dueAt'|'station'|'handoverMode'|'items'|'operationalFacts'>,release?:ReleaseSource){
 const source={kind:'order' as const,id:card.id,version:card.version};
 const rule=readAuthorizedV45Rule(auth,'auftrag',{...v45OrderFacts(card),...v45OrderReleaseFacts(card,release)},undefined,['workProblem','deliveryRequest','termUpdatePending','workUpdatePending','extraPending']);
 if(rule.code!=='OK')return {...rule,source};
 const first=readV45FirstLook('auftrag',{
  'auftrag.lage':{nummer:card.orderNumber,station:card.station},
  'auftrag.termin':{datum:card.dueAt},
  'auftrag.teile':{teile:card.items.map(item=>({id:item.id,name:item.name,menge:item.quantity,material:item.material,oberflaeche:item.surfaceRequested,fertig:item.finished,einheit:item.unit}))},
  'auftrag.hauptaktion':{elementId:rule.hauptaktion}
 },[],rule.zustand);
 // A state requiring an as-yet unbound blocker stays incomplete, never calm.
 if(first.code!=='OK')return {...first,source};
 const actions=readV45ObjectActionAbsence('auftrag',rule.zustand);
 let hauptaktion:null|{elementId:string;textKey:string;werte:Record<string,string|number>;recht:string|null;befehl:{datei:string;funktion:keyof typeof import('@/app/actions/orders.actions');argumente:Readonly<Record<string,unknown>>}}=null;
 if(rule.hauptaktion!==null){
  if(rule.hauptaktion!=='order.start'||!('textKey'in rule)||typeof rule.textKey!=='string'||!('recht'in rule))return {code:'SOURCE_INCOMPLETE' as const,missing:['ORDER_ACTION_BINDING'],erstblick:first.erstblick,source};
  const parameters=readV45ActionValues(rule.textKey,{number:card.orderNumber});if(parameters.code!=='OK')return {...parameters,erstblick:first.erstblick,source};
  hauptaktion={elementId:rule.hauptaktion,textKey:rule.textKey,werte:parameters.werte,recht:rule.recht,befehl:{datei:'src/app/actions/orders.actions.ts',funktion:'transitionWareneingangToGalvanikAction',argumente:{orderId:card.id,expectedVersion:card.version}}};
 }
 return {...rule,hauptaktion,erstblick:first.erstblick,weitere:actions.code==='OK'?actions.weitere:null,...(actions.code!=='OK'?{datenluecken:[...(rule.datenluecken??[]),...actions.missing]}:{}),quelle:{...rule.quelle,elementeSha256:first.quelle.sha256,...(actions.code==='OK'?{erwartungSha256:actions.quelle.sha256}:{})},source};
}
