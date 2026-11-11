import 'server-only';
import type {LiveOrderCard} from './orderCardRead';
import type {AuthorizationSnapshot} from './authorization';
import type {readOrderInformed} from './orderReleaseRead';
import {readAuthorizedV45Rule} from './v45RuleRead';

/** Facts exposed by the existing versioned card. Missing shipment, financial
 * and approval evidence deliberately stays unknown, never a false calm state.
 * This is the rule seam for U2, not its complete presentation contract. */
export function v45OrderFacts(card:Pick<LiveOrderCard,'station'|'handoverMode'|'items'>):Readonly<Record<string,unknown>>{
 const shipping=card.handoverMode===null?{}:{shipping:card.handoverMode==='shipping'};
 return {station:card.station,...shipping,
  ...(card.station!=='versendet'?{closed:card.station==='abgeholt',inTransit:false,returning:false}:{}),
  allDone:card.items.length>0&&card.items.every(item=>item.finished)};
}
type ReleaseSource={orderId:string;value:Awaited<ReturnType<typeof readOrderInformed>>};
/** Reuse the already-qualified release reader from the very same card version.
 * A failed or stale read supplies no negative facts and no money is projected. */
export function v45OrderReleaseFacts(card:{id:string;version:number},source?:ReleaseSource):Readonly<Record<string,unknown>>{
 if(!source||source.orderId!==card.id||source.value.code!=='OK'||source.value.orderVersion!==card.version)return {};
 const value=source.value,facts:Record<string,unknown>={};
 if(value.informed===null)facts.noticeSent=false;
 else if(value.informed.orderId===card.id&&value.informed.freezeId===value.freezeId)facts.noticeSent=true;
 if(Array.isArray(value.complaintIds)&&value.complaintIds.every(id=>typeof id==='string'))facts.complaint=value.complaintIds.length>0;
 return facts;
}
export function readV45OrderRule(auth:AuthorizationSnapshot,card:Pick<LiveOrderCard,'id'|'version'|'station'|'handoverMode'|'items'>,release?:ReleaseSource){
 return {...readAuthorizedV45Rule(auth,'auftrag',{...v45OrderFacts(card),...v45OrderReleaseFacts(card,release)}),source:{kind:'order' as const,id:card.id,version:card.version}};
}
