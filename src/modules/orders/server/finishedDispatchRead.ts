import 'server-only';
import type {AuthorizationSnapshot} from '@/lib/server/authorization';
import {hasAuthorizationArea} from '@/lib/server/authorization';
import {readOrderInformed} from '@/lib/server/orderReleaseRead';
import type {OperationalOrder} from '@/lib/types/operationalOrder';
import {berlinCalendarDay,workingDaysBetween} from '@/lib/domain/workingDays';

export type FinishedDispatch={orderId:string;version:number;handover:'pickup'|'shipping'|null;color:'rot'|'gelb'|'gruen'|null;releaseAllowed:boolean;informedAt:string|null;channel:'mail'|'telefon'|null;blockReason:string|null;workingDays:number|null;gaps:string[]};

/** Enrich existing operational rows; never a second saved queue or release rule. */
export async function readFinishedDispatchQueue(auth:AuthorizationSnapshot,orders:readonly OperationalOrder[],holidays:readonly string[]|null){
 if(!hasAuthorizationArea(auth,'auftraege'))return {code:'FORBIDDEN' as const};
 const result:FinishedDispatch[]=[];
 for(const order of orders.filter(row=>row.station==='fertig')){
  const notification=await readOrderInformed(auth,order.id);
  if(notification.code!=='OK'||notification.orderVersion!==order.version)return {code:'UNAVAILABLE' as const};
  const workingDays=holidays===null||!notification.frozenAt?null:workingDaysBetween(berlinCalendarDay(new Date(notification.frozenAt)),berlinCalendarDay(),holidays);
  if(workingDays!==null&&workingDays<0)return {code:'UNAVAILABLE' as const};
  result.push({orderId:order.id,version:order.version,handover:notification.handover,color:notification.ampel,releaseAllowed:notification.releaseAllowed,
   informedAt:notification.informed?.recordedAt??null,channel:notification.informed?.channel??null,blockReason:notification.blockReason,
   workingDays,gaps:[...(!notification.handover?['HANDOVER_MISSING']:[]),...(holidays===null?['BUSINESS_CALENDAR_SETTINGS_MISSING']:[])]});
 }
 const due=new Map(orders.map(order=>[order.id,order.dueDate||'9999-12-31']));
 result.sort((a,b)=>Number(b.color==='gruen')-Number(a.color==='gruen')||(due.get(a.orderId)??'9999').localeCompare(due.get(b.orderId)??'9999')||a.orderId.localeCompare(b.orderId));
 return {code:'OK' as const,rows:result};
}
