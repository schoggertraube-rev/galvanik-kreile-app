import 'server-only';
import type {LiveOrderCard} from './orderCardRead';
import type {AuthorizationSnapshot} from './authorization';
import type {readOrderInformed} from './orderReleaseRead';
import {readAuthorizedV45Rule} from './v45RuleRead';
import {readV45FirstLook} from './v45FirstLookRead';

/** Facts exposed by the existing versioned card. Missing shipment, financial
 * and approval evidence deliberately stays unknown, never a false calm state.
 * This is the rule seam for U2, not its complete presentation contract. */
export function v45OrderFacts(card:Pick<LiveOrderCard,'station'|'handoverMode'|'items'>):Readonly<Record<string,unknown>>{
 const shipping=card.handoverMode===null?{}:{shipping:card.handoverMode==='shipping'};
 // The persisted 'abgeholt' station is shared by pickup and carrier handover.
 // It proves customer receipt only for a known pickup, never for shipping.
 const transportUnknown=card.station==='versendet'||card.station==='abgeholt'&&card.handoverMode!=='pickup';
 return {station:card.station,...shipping,
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
export function readV45OrderRule(auth:AuthorizationSnapshot,card:Pick<LiveOrderCard,'id'|'version'|'orderNumber'|'dueAt'|'station'|'handoverMode'|'items'>,release?:ReleaseSource){
 const source={kind:'order' as const,id:card.id,version:card.version};
 const rule=readAuthorizedV45Rule(auth,'auftrag',{...v45OrderFacts(card),...v45OrderReleaseFacts(card,release)});
 if(rule.code!=='OK')return {...rule,source};
 const first=readV45FirstLook('auftrag',{
  'auftrag.lage':{nummer:card.orderNumber,station:card.station},
  'auftrag.termin':{datum:card.dueAt},
  'auftrag.teile':{teile:card.items.map(item=>({id:item.id,name:item.name,menge:item.quantity,material:item.material,oberflaeche:item.surfaceRequested,fertig:item.finished,einheit:item.unit}))},
  'auftrag.hauptaktion':{elementId:rule.hauptaktion}
 },[],rule.zustand);
 // A state requiring an as-yet unbound blocker stays incomplete, never calm.
 if(first.code!=='OK')return {...first,source};
 return {...rule,erstblick:first.erstblick,quelle:{...rule.quelle,elementeSha256:first.quelle.sha256},source};
}
