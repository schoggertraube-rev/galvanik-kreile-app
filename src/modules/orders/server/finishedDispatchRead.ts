import 'server-only';
import type {AuthorizationSnapshot} from '@/lib/server/authorization';
import {hasAuthorizationArea} from '@/lib/server/authorization';
import {readOrderInformed} from '@/lib/server/orderReleaseRead';
import type {OperationalOrder} from '@/lib/types/operationalOrder';
import {berlinCalendarDay,workingDaysBetween} from '@/lib/domain/workingDays';
import type {DispatchPolicy} from '@/modules/fundament/public';
import {planInitialDispatchReminder,type DispatchNoticeMember,type InitialDispatchReminderPlan} from '../domain/outputEscalation';
import type {DispatchResponseCheck} from '@/lib/server/dispatchResponsePort';
import {readCollectionReminderHistory} from '@/lib/server/collectionReminderPort';
import {readDispatchCall} from '@/lib/server/dispatchCallPort';
import {storageEligibility,type StorageEligibility} from '../domain/storageEligibility';
import {COLLECTION_REMINDER_COPY} from '@/ui/situationCatalog';

export type FinishedDispatch={orderId:string;version:number;handover:'pickup'|'shipping'|null;color:'rot'|'gelb'|'gruen'|null;releaseAllowed:boolean;informedAt:string|null;channel:'mail'|'telefon'|null;blockReason:string|null;workingDays:number|null;gaps:string[];reminder?:InitialDispatchReminderPlan;storage?:StorageEligibility;unavailable?:true};

/** Enrich existing operational rows; never a second saved queue or release rule. */
export async function readFinishedDispatchQueue(auth:AuthorizationSnapshot,orders:readonly OperationalOrder[],policy:DispatchPolicy|null,ports?:{readHasMail?:(customerId:string)=>Promise<boolean>;readResponses:(input:{customerId:string;noticeThreadIds:string[];oldestNoticeAt:string})=>Promise<DispatchResponseCheck>}){
 if(!hasAuthorizationArea(auth,'auftraege'))return {code:'FORBIDDEN' as const};
 const result:FinishedDispatch[]=[];
 const groups=new Map<string,{customerId:string;handover:'pickup'|'shipping';members:DispatchNoticeMember[];threads:Set<string>}>();
 for(const order of orders.filter(row=>row.station==='fertig')){
  const notification=await readOrderInformed(auth,order.id);
  if(notification.code!=='OK'||notification.orderVersion!==order.version){result.push({orderId:order.id,version:order.version,handover:null,color:null,releaseAllowed:false,informedAt:null,channel:null,blockReason:COLLECTION_REMINDER_COPY.proofUnavailable,workingDays:null,gaps:['INFORMED_RECEIPT_UNAVAILABLE'],unavailable:true});continue;}
  const workingDays=policy===null||!notification.frozenAt?null:workingDaysBetween(berlinCalendarDay(new Date(notification.frozenAt)),berlinCalendarDay(),policy.holidays);
  if(workingDays!==null&&workingDays<0){result.push({orderId:order.id,version:order.version,handover:null,color:null,releaseAllowed:false,informedAt:null,channel:null,blockReason:COLLECTION_REMINDER_COPY.proofUnavailable,workingDays:null,gaps:['DISPATCH_CALENDAR_INVALID'],unavailable:true});continue;}
  result.push({orderId:order.id,version:order.version,handover:notification.handover,color:notification.ampel,releaseAllowed:notification.releaseAllowed,
   informedAt:notification.informed?.recordedAt??null,channel:notification.informed?.channel??null,blockReason:notification.blockReason,
   workingDays,gaps:[...(!notification.handover?['HANDOVER_MISSING']:[]),...(policy===null?['BUSINESS_CALENDAR_SETTINGS_MISSING']:[])]});
  if(notification.handover){const key=JSON.stringify([order.customerId,notification.handover]);const group=groups.get(key)??{customerId:order.customerId,handover:notification.handover,members:[],threads:new Set<string>()};group.members.push({orderId:order.id,orderNumber:order.orderNumber,noticeAt:notification.firstInformed?.recordedAt??null,readyAt:notification.frozenAt});for(const id of notification.mailThreadIds)group.threads.add(id);groups.set(key,group);}
 }
 for(const group of groups.values()){
  const failGroup=()=>{for(const row of result.filter(item=>group.members.some(member=>member.orderId===item.orderId))){row.unavailable=true;row.reminder=undefined;row.storage=undefined;row.gaps.push('COLLECTION_PROOF_UNAVAILABLE');}};
  let history:Awaited<ReturnType<typeof readCollectionReminderHistory>>;
  try{history=await readCollectionReminderHistory(auth,group.customerId,group.handover,group.members.map(member=>member.orderId));}catch(error){console.error('[DISPATCH_HISTORY_UNAVAILABLE]',error instanceof Error?error.name:'UnknownError');failGroup();continue;}
  for(const row of history)if(row.sentAt)group.threads.add(row.threadId);
  let noMail=false;
  try{if(ports?.readHasMail)noMail=!await ports.readHasMail(group.customerId);}catch(error){console.error('[DISPATCH_CUSTOMER_MAIL_READ_FAILED]',error instanceof Error?error.name:'UnknownError');failGroup();continue;}
  const plan=planInitialDispatchReminder({tenantId:auth.tenantId,...group,today:berlinCalendarDay(),noMail},policy,history);
  let call:Awaited<ReturnType<typeof readDispatchCall>>;
  try{call=await readDispatchCall(auth,group.customerId,group.handover,plan.orderIds);}catch(error){console.error('[DISPATCH_CALL_READ_FAILED]',error instanceof Error?error.message:'UnknownError');failGroup();continue;}
  if(call){plan.callTaskId=call.taskId;plan.stage='E3';plan.clientKey=call.stageKey;plan.due=call.due;plan.state='DUE';}
  if(call?.result==='reached'&&!call.cohortChanged)plan.state='STOPPED';
  if(noMail&&!group.threads.size){plan.requiresResponseCheck=false;plan.responseState='NONE';}
  if(plan.state==='DUE'&&ports&&plan.oldestNoticeAt&&group.threads.size){
   const reaction=await ports.readResponses({customerId:group.customerId,noticeThreadIds:[...group.threads],oldestNoticeAt:plan.oldestNoticeAt});
   plan.responseState=reaction.state;plan.requiresResponseCheck=reaction.state!=='NONE';
   if(reaction.state==='REPLIED')plan.state='STOPPED';else if(reaction.state==='UNAVAILABLE')plan.state='RECONCILE_RESPONSE';
  }
   if(call&&plan.state!=='STOPPED'&&plan.state!=='RECONCILE_RESPONSE'){
    plan.state=call.cohortChanged&&call.result?'RECONCILE_RESPONSE':call.result==='reached'?'STOPPED':call.result==='notReached'?'CALL_NOT_REACHED':'CALL_PENDING';
    if(call.result==='notReached'&&call.recordedAt&&!call.cohortChanged)for(const member of group.members){
     const row=result.find(item=>item.orderId===member.orderId);if(row)row.storage=storageEligibility(member.noticeAt,call.recordedAt,berlinCalendarDay(),policy);
    }
   }
  for(const member of group.members){const row=result.find(row=>row.orderId===member.orderId);if(row)row.reminder=plan;}
 }
 const due=new Map(orders.map(order=>[order.id,order.dueDate||'9999-12-31']));
 result.sort((a,b)=>Number(b.color==='gruen')-Number(a.color==='gruen')||(due.get(a.orderId)??'9999').localeCompare(due.get(b.orderId)??'9999')||a.orderId.localeCompare(b.orderId));
 return {code:'OK' as const,rows:result};
}
