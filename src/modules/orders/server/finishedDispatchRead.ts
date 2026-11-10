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
import {readDispatchCalls} from '@/lib/server/dispatchCallPort';
import {storageEligibility,storageLetterKey,finalStorageStage,type StorageEligibility} from '../domain/storageEligibility';
import {COLLECTION_REMINDER_COPY} from '@/ui/situationCatalog';

export type FinishedDispatch={orderId:string;version:number;handover:'pickup'|'shipping'|null;color:'rot'|'gelb'|'gruen'|null;releaseAllowed:boolean;informedAt:string|null;channel:'mail'|'telefon'|null;blockReason:string|null;workingDays:number|null;gaps:string[];reminder?:InitialDispatchReminderPlan;storage?:StorageEligibility;unavailable?:true};

/** Enrich existing operational rows; never a second saved queue or release rule. */
export async function readFinishedDispatchQueue(auth:AuthorizationSnapshot,orders:readonly OperationalOrder[],policy:DispatchPolicy|null,ports?:{readHasMail?:(customerId:string)=>Promise<boolean>;readResponses:(input:{customerId:string;noticeThreadIds:string[];oldestNoticeAt:string})=>Promise<DispatchResponseCheck>}){
 if(!hasAuthorizationArea(auth,'auftraege'))return {code:'FORBIDDEN' as const};
 const result:FinishedDispatch[]=[];
 const groups=new Map<string,{customerId:string;handover:'pickup'|'shipping';members:DispatchNoticeMember[];threads:Set<string>;deliveryFailedAt:string|null;responseSince:string|null}>();
 for(const order of orders.filter(row=>row.station==='fertig')){
  const notification=await readOrderInformed(auth,order.id);
  if(notification.code!=='OK'||notification.orderVersion!==order.version){result.push({orderId:order.id,version:order.version,handover:null,color:null,releaseAllowed:false,informedAt:null,channel:null,blockReason:COLLECTION_REMINDER_COPY.proofUnavailable,workingDays:null,gaps:['INFORMED_RECEIPT_UNAVAILABLE'],unavailable:true});continue;}
  const workingDays=policy===null||!notification.frozenAt?null:workingDaysBetween(berlinCalendarDay(new Date(notification.frozenAt)),berlinCalendarDay(),policy.holidays);
  if(workingDays!==null&&workingDays<0){result.push({orderId:order.id,version:order.version,handover:null,color:null,releaseAllowed:false,informedAt:null,channel:null,blockReason:COLLECTION_REMINDER_COPY.proofUnavailable,workingDays:null,gaps:['DISPATCH_CALENDAR_INVALID'],unavailable:true});continue;}
  result.push({orderId:order.id,version:order.version,handover:notification.handover,color:notification.ampel,releaseAllowed:notification.releaseAllowed,
   informedAt:notification.informed?.recordedAt??null,channel:notification.informed?.channel??null,blockReason:notification.blockReason,
   workingDays,gaps:[...(!notification.handover?['HANDOVER_MISSING']:[]),...(policy===null?['BUSINESS_CALENDAR_SETTINGS_MISSING']:[])]});
  if(notification.handover){
   const key=JSON.stringify([order.customerId,notification.handover]);
   const group=groups.get(key)??{customerId:order.customerId,handover:notification.handover,members:[],threads:new Set<string>(),deliveryFailedAt:null,responseSince:null};
   group.members.push({orderId:order.id,orderNumber:order.orderNumber,noticeAt:notification.firstInformed?.recordedAt??null,readyAt:notification.frozenAt,deliveryFailedAt:notification.failedDelivery?.recordedAt??null,freezeId:notification.freezeId});
   for(const id of notification.mailThreadIds)group.threads.add(id);
   if(notification.failedDelivery&&(!group.deliveryFailedAt||notification.failedDelivery.recordedAt<group.deliveryFailedAt))group.deliveryFailedAt=notification.failedDelivery.recordedAt;
   if(notification.responseSince&&(!group.responseSince||notification.responseSince<group.responseSince))group.responseSince=notification.responseSince;
   groups.set(key,group);
  }
 }
 for(const group of groups.values()){
  const failGroup=()=>{for(const row of result.filter(item=>group.members.some(member=>member.orderId===item.orderId))){row.unavailable=true;row.reminder=undefined;row.storage=undefined;row.gaps.push('COLLECTION_PROOF_UNAVAILABLE');}};
  let history:Awaited<ReturnType<typeof readCollectionReminderHistory>>;
  try{history=await readCollectionReminderHistory(auth,group.customerId,group.handover,group.members.map(member=>member.orderId));}catch(error){console.error('[DISPATCH_HISTORY_UNAVAILABLE]',error instanceof Error?error.name:'UnknownError');failGroup();continue;}
  for(const row of history)if(row.sentAt)group.threads.add(row.threadId);
  let noMail=false;
  try{if(ports?.readHasMail)noMail=!await ports.readHasMail(group.customerId);}catch(error){console.error('[DISPATCH_CUSTOMER_MAIL_READ_FAILED]',error instanceof Error?error.name:'UnknownError');failGroup();continue;}
  const initial=planInitialDispatchReminder({tenantId:auth.tenantId,...group,today:berlinCalendarDay(),noMail},policy,history);
  let calls:Awaited<ReturnType<typeof readDispatchCalls>>;
  try{calls=await readDispatchCalls(auth,group.customerId,group.handover,initial.orderIds);}catch(error){console.error('[DISPATCH_CALL_READ_FAILED]',error instanceof Error?error.message:'UnknownError');failGroup();continue;}
  const answered=new Map<string,{call?:typeof calls[number];mail?:DispatchResponseCheck['proofs'][number]}>();
  for(const member of group.members){const call=calls.find(call=>call.result==='reached'&&member.freezeId&&call.freezes.some(proof=>proof.orderId===member.orderId&&proof.freezeId===member.freezeId));if(call)answered.set(member.orderId,{call});}
  let reaction:DispatchResponseCheck|undefined;
  const responseSince=group.responseSince??initial.oldestNoticeAt??group.deliveryFailedAt??history.filter(row=>row.deliveryFailedAt).at(-1)?.deliveryFailedAt;
  if(answered.size<group.members.length&&ports&&responseSince&&group.threads.size){
   reaction=await ports.readResponses({customerId:group.customerId,noticeThreadIds:[...group.threads],oldestNoticeAt:responseSince});
   if(reaction.state==='REPLIED')for(const member of group.members){
    const proof=reaction.proofs.find(proof=>proof.orderIds.includes(member.orderId)&&Date.parse(proof.receivedAt)>=Date.parse(member.noticeAt??member.readyAt??''));
    if(proof&&!answered.has(member.orderId))answered.set(member.orderId,{mail:proof});
   }
  }
  for(const member of group.members){const answer=answered.get(member.orderId);if(!answer)continue;
   const row=result.find(item=>item.orderId===member.orderId);if(row)row.reminder={...initial,stage:answer.call?'E3':initial.stage,state:'STOPPED',needsNotice:[],orderIds:answer.call?.orderIds??answer.mail!.orderIds,orderNumbers:answer.call?.orderNumbers??group.members.filter(item=>answer.mail!.orderIds.includes(item.orderId)).map(item=>item.orderNumber),clientKey:answer.call?.stageKey??null,due:answer.call?.due??null,callTaskId:answer.call?.taskId,requiresResponseCheck:false,responseState:answer.mail?'REPLIED':'NONE'};
  }
  const members=group.members.filter(member=>!answered.has(member.orderId));if(!members.length)continue;
  const activeHistory=history.filter(row=>members.some(member=>row.orderIds.includes(member.orderId)&&(!row.sentAt||Date.parse(row.sentAt)>=Date.parse(member.noticeAt??member.readyAt??''))));
  const plan=planInitialDispatchReminder({tenantId:auth.tenantId,...group,members,deliveryFailedAt:members.flatMap(member=>member.deliveryFailedAt?[member.deliveryFailedAt]:[]).sort()[0]??null,today:berlinCalendarDay(),noMail},policy,activeHistory);
  const activeCalls=calls.filter(call=>call.result!=='reached'&&call.freezes.some(proof=>members.some(member=>member.orderId===proof.orderId&&member.freezeId===proof.freezeId)));
  const call=activeCalls[0];
  if(call){plan.callTaskId=call.taskId;plan.stage='E3';plan.clientKey=call.stageKey;plan.due=call.due;plan.state='DUE';}
  if(reaction){plan.responseState=reaction.state==='REPLIED'?'NONE':reaction.state;plan.requiresResponseCheck=plan.responseState!=='NONE';if(reaction.state==='UNAVAILABLE')plan.state='RECONCILE_RESPONSE';}
  if(noMail&&!group.threads.size){plan.requiresResponseCheck=false;plan.responseState='NONE';}
  if(call&&plan.state!=='RECONCILE_RESPONSE'){
   const changed=JSON.stringify([...call.orderIds].sort())!==JSON.stringify(members.map(member=>member.orderId).sort());
   plan.state=changed&&call.result?'RECONCILE_RESPONSE':call.result==='notReached'?'CALL_NOT_REACHED':'CALL_PENDING';
   if(call.result==='notReached'&&call.recordedAt&&!changed){
    const unsent:FinishedDispatch[]=[];
    for(const member of members){
     const row=result.find(item=>item.orderId===member.orderId);if(!row)continue;
     row.storage=storageEligibility(member.noticeAt,call.recordedAt,berlinCalendarDay(),policy);
     const letters=activeHistory.filter(item=>item.stage==='E4'&&item.orderIds.includes(member.orderId)&&item.storageOrigin?.callTaskId===call.taskId&&item.storageOrigin.freezes.some(proof=>proof.orderId===member.orderId&&proof.freezeId===member.freezeId));
     const letter=letters.at(-1);
     if(letter){row.storage.letter={state:letter.sentAt&&!letter.deliveryFailedAt?'SENT':'RECONCILE_MAIL',clientKey:letter.stageKey,orderIds:letter.orderIds,due:letter.dueDate,sentAt:letter.sentAt,threadId:letter.threadId,callTaskId:call.taskId,freezes:letter.storageOrigin!.freezes,finalStage:finalStorageStage(letter.deliveryFailedAt?null:letter.sentAt,berlinCalendarDay(),policy)};}
     else if(row.storage.state==='DUE')unsent.push(row);
    }
    if(unsent.length){
     const orderIds=unsent.map(row=>row.orderId).sort(),clientKey=storageLetterKey(auth.tenantId,group.customerId,group.handover,call.stageKey,orderIds);
     const due=unsent.map(row=>row.storage!.eligibleOn!).sort().at(-1)!;
     const freezes=call.freezes.filter(proof=>orderIds.includes(proof.orderId));
     for(const row of unsent)row.storage!.letter={state:'DUE',clientKey,orderIds,due,sentAt:null,threadId:null,callTaskId:call.taskId,freezes,finalStage:finalStorageStage(null,berlinCalendarDay(),policy)};
    }
   }
  }
  for(const member of members){const row=result.find(item=>item.orderId===member.orderId);if(row)row.reminder=plan;}
 }
 const due=new Map(orders.map(order=>[order.id,order.dueDate||'9999-12-31']));
 result.sort((a,b)=>Number(b.color==='gruen')-Number(a.color==='gruen')||(due.get(a.orderId)??'9999').localeCompare(due.get(b.orderId)??'9999')||a.orderId.localeCompare(b.orderId));
 return {code:'OK' as const,rows:result};
}
