import 'server-only';
import type {LiveOrderCard} from './orderCardRead';
import type {AuthorizationSnapshot} from './authorization';
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
export function readV45OrderRule(auth:AuthorizationSnapshot,card:Pick<LiveOrderCard,'id'|'version'|'station'|'handoverMode'|'items'>){
 return {...readAuthorizedV45Rule(auth,'auftrag',v45OrderFacts(card)),source:{kind:'order' as const,id:card.id,version:card.version}};
}
