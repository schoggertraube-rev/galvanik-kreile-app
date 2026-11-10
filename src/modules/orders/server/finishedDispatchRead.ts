import 'server-only';
import type {AuthorizationSnapshot} from '@/lib/server/authorization';
import {hasAuthorizationArea} from '@/lib/server/authorization';
import {readOrderInformed} from '@/lib/server/orderReleaseRead';
import type {OperationalOrder} from '@/lib/types/operationalOrder';
import {berlinCalendarDay,workingDaysBetween,plusWorkingDays} from '@/lib/domain/workingDays';
import {readOrderPickupAppointment,pickupStorageDue} from '@/lib/server/pickupAppointmentPort';
import type {DispatchPolicy} from '@/modules/fundament/public';
import {planInitialDispatchReminder,type DispatchNoticeMember,type InitialDispatchReminderPlan,type PickupAppointmentProjection} from '../domain/outputEscalation';
import type {DispatchResponseCheck} from '@/lib/server/dispatchResponsePort';
import {readCollectionReminderHistory} from '@/lib/server/collectionReminderPort';
import {readDispatchCalls} from '@/lib/server/dispatchCallPort';
import {readRecordedDispatchReplies,replyDefersToAppointment,type DispatchReplyReceipt} from '@/lib/server/dispatchReplyPort';
import {storageEligibility,storageLetterKey,finalStorageStage,type StorageEligibility} from '../domain/storageEligibility';
import {COLLECTION_REMINDER_COPY,STORAGE_CHARGE_COPY} from '@/ui/situationCatalog';
import {readStorageFinalTaskState} from '@/lib/server/storageFinalStagePort';

export type FinishedDispatch={orderId:string;version:number;handover:'pickup'|'shipping'|null;color:'rot'|'gelb'|'gruen'|null;releaseAllowed:boolean;informedAt:string|null;channel:'mail'|'telefon'|null;blockReason:string|null;workingDays:number|null;gaps:string[];reminder?:InitialDispatchReminderPlan;storage?:StorageEligibility;pickupAppointment?:PickupAppointmentProjection;unavailable?:true};

/** Enrich existing operational rows; never a second saved queue or release rule. */
export async function readFinishedDispatchQueue(auth:AuthorizationSnapshot,orders:readonly OperationalOrder[],policy:DispatchPolicy|null,ports?:{readHasMail?:(customerId:string)=>Promise<boolean>}){
 if(!hasAuthorizationArea(auth,'auftraege'))return {code:'FORBIDDEN' as const};
 const result:FinishedDispatch[]=[];
 const appointments=new Map<string,NonNullable<FinishedDispatch['pickupAppointment']>&{recordedAt:string}>();
 const replies=new Map<string,DispatchReplyReceipt>();
 const histories=new Map<string,Awaited<ReturnType<typeof readCollectionReminderHistory>>>();
 const groups=new Map<string,{customerId:string;handover:'pickup'|'shipping';members:DispatchNoticeMember[];threads:Set<string>;deliveryFailedAt:string|null;responseSince:string|null}>();
 for(const order of orders.filter(row=>row.station==='fertig')){
  const notification=await readOrderInformed(auth,order.id);
  if(notification.code!=='OK'||notification.orderVersion!==order.version){result.push({orderId:order.id,version:order.version,handover:null,color:null,releaseAllowed:false,informedAt:null,channel:null,blockReason:COLLECTION_REMINDER_COPY.proofUnavailable,workingDays:null,gaps:['INFORMED_RECEIPT_UNAVAILABLE'],unavailable:true});continue;}
  const workingDays=policy===null||!notification.frozenAt?null:workingDaysBetween(berlinCalendarDay(new Date(notification.frozenAt)),berlinCalendarDay(),policy.holidays);
  if(workingDays!==null&&workingDays<0){result.push({orderId:order.id,version:order.version,handover:null,color:null,releaseAllowed:false,informedAt:null,channel:null,blockReason:COLLECTION_REMINDER_COPY.proofUnavailable,workingDays:null,gaps:['DISPATCH_CALENDAR_INVALID'],unavailable:true});continue;}
  result.push({orderId:order.id,version:order.version,handover:notification.handover,color:notification.ampel,releaseAllowed:notification.releaseAllowed,
   informedAt:notification.informed?.recordedAt??null,channel:notification.informed?.channel??null,blockReason:notification.blockReason,
   workingDays,gaps:[...(!notification.handover?['HANDOVER_MISSING']:[]),...(policy===null?['BUSINESS_CALENDAR_SETTINGS_MISSING']:[])]});
  if(notification.handover==='pickup'){
   const read=await readOrderPickupAppointment(auth,order.id),row=result.at(-1)!;
   if(read.code!=='OK'){row.unavailable=true;row.gaps.push('PICKUP_APPOINTMENT_UNAVAILABLE');continue;}
   if(read.appointment){const resumeOn=policy===null?null:plusWorkingDays(read.appointment.date,1,policy.holidays);row.pickupAppointment={eventId:read.appointment.eventId,date:read.appointment.date,resumeOn,paused:resumeOn===null?null:resumeOn>berlinCalendarDay()};appointments.set(order.id,{...row.pickupAppointment,recordedAt:read.appointment.recordedAt});}
  }
  if(notification.handover){
   const key=JSON.stringify([order.customerId,notification.handover]);
   const group=groups.get(key)??{customerId:order.customerId,handover:notification.handover,members:[],threads:new Set<string>(),deliveryFailedAt:null,responseSince:null};
   group.members.push({orderId:order.id,orderNumber:order.orderNumber,noticeAt:notification.firstInformed?.recordedAt??null,noticeChannel:notification.firstInformed?.channel??null,readyAt:notification.frozenAt,deliveryFailedAt:notification.failedDelivery?.recordedAt??null,freezeId:notification.freezeId});
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
  histories.set(JSON.stringify([group.customerId,group.handover]),history);
  for(const row of history)if(row.sentAt&&row.threadId)group.threads.add(row.threadId);
  let noMail=false;
  try{if(ports?.readHasMail)noMail=!await ports.readHasMail(group.customerId);}catch(error){console.error('[DISPATCH_CUSTOMER_MAIL_READ_FAILED]',error instanceof Error?error.name:'UnknownError');failGroup();continue;}
  const pausedOrderIds=group.members.filter(member=>appointments.has(member.orderId)).map(member=>member.orderId);
  const initial=planInitialDispatchReminder({tenantId:auth.tenantId,...group,today:berlinCalendarDay(),noMail,pausedOrderIds},policy,history);
  let calls:Awaited<ReturnType<typeof readDispatchCalls>>;
  try{calls=await readDispatchCalls(auth,group.customerId,group.handover,initial.orderIds);}catch(error){console.error('[DISPATCH_CALL_READ_FAILED]',error instanceof Error?error.message:'UnknownError');failGroup();continue;}
  const answered=new Map<string,{call?:typeof calls[number];mail?:DispatchResponseCheck['proofs'][number]}>();
  for(const member of group.members){const call=calls.find(call=>call.result==='reached'&&member.freezeId&&call.freezes.some(proof=>proof.orderId===member.orderId&&proof.freezeId===member.freezeId));if(call)answered.set(member.orderId,{call});}
  try{
   const saved=await readRecordedDispatchReplies(auth,group.customerId,group.handover);
   for(const member of group.members){const reply=saved.filter(reply=>reply.proof.freezes.some(proof=>proof.orderId===member.orderId&&proof.freezeId===member.freezeId)&&Date.parse(reply.proof.receivedAt)>=Date.parse(member.noticeAt??member.readyAt??'')).sort((a,b)=>Date.parse(b.proof.receivedAt)-Date.parse(a.proof.receivedAt))[0];if(reply){replies.set(member.orderId,reply);if(!answered.has(member.orderId))answered.set(member.orderId,{mail:reply.proof});}}
  }catch(error){console.error('[DISPATCH_RECORDED_REPLY_UNAVAILABLE]',error instanceof Error?error.message:'UnknownError');failGroup();continue;}
  // Mail qualification belongs to its import/assignment command. This reader
  // consumes only the immutable recorded replies above, never Graph or a writer.
  const reaction:DispatchResponseCheck={state:'NONE',proofs:[]};
  for(const member of group.members){const answer=answered.get(member.orderId);if(!answer)continue;
   const row=result.find(item=>item.orderId===member.orderId);if(row)row.reminder={...initial,stage:answer.call?'E3':initial.stage,state:'STOPPED',needsNotice:[],orderIds:answer.call?.orderIds??answer.mail!.orderIds,orderNumbers:answer.call?.orderNumbers??group.members.filter(item=>answer.mail!.orderIds.includes(item.orderId)).map(item=>item.orderNumber),clientKey:answer.call?.stageKey??null,due:answer.call?.due??null,callTaskId:answer.call?.taskId,requiresResponseCheck:false,responseState:answer.mail?'REPLIED':'NONE'};
  }
  for(const member of group.members.filter(member=>pausedOrderIds.includes(member.orderId))){const row=result.find(item=>item.orderId===member.orderId);if(row&&!row.reminder)row.reminder={...initial,orderIds:[member.orderId],orderNumbers:[member.orderNumber]};}
  const pendingMembers=group.members.filter(member=>!answered.has(member.orderId)&&!pausedOrderIds.includes(member.orderId));if(!pendingMembers.length)continue;
  const activeCalls=calls.filter(call=>(call.result===null||call.result==='notReached')&&call.freezes.some(proof=>pendingMembers.some(member=>member.orderId===proof.orderId&&member.freezeId===proof.freezeId)));
  // A completed unsuccessful call covers its original ware only. New ware must not hide old letters.
  const assigned=new Set<string>();
  const cohorts:Array<{members:DispatchNoticeMember[];call:typeof calls[number]|undefined}>=[];
  for(const call of activeCalls.filter(call=>call.result==='notReached')){
   const members=pendingMembers.filter(member=>!assigned.has(member.orderId)&&call.freezes.some(proof=>proof.orderId===member.orderId&&proof.freezeId===member.freezeId));
   if(members.length){for(const member of members)assigned.add(member.orderId);cohorts.push({members,call});}
  }
  const fresh=pendingMembers.filter(member=>!assigned.has(member.orderId));
  if(fresh.length)cohorts.push({members:fresh,call:activeCalls.find(call=>call.result===null&&call.freezes.some(proof=>fresh.some(member=>proof.orderId===member.orderId&&proof.freezeId===member.freezeId)))});
  for(const {members,call} of cohorts){
  const activeHistory=history.filter(row=>members.some(member=>row.orderIds.includes(member.orderId)&&(row.postalDocumentId?row.storageOrigin?.freezes.some(proof=>proof.orderId===member.orderId&&proof.freezeId===member.freezeId):!row.sentAt||Date.parse(row.sentAt)>=Date.parse(member.noticeAt??member.readyAt??''))));
  const plan=planInitialDispatchReminder({tenantId:auth.tenantId,...group,members,deliveryFailedAt:members.flatMap(member=>member.deliveryFailedAt?[member.deliveryFailedAt]:[]).sort()[0]??null,today:berlinCalendarDay(),noMail,pausedOrderIds},policy,activeHistory);
  if(call){plan.callTaskId=call.taskId;plan.stage='E3';plan.clientKey=call.stageKey;plan.due=call.due;plan.state='DUE';}
  if(reaction){plan.responseState=reaction.state==='REPLIED'?'NONE':reaction.state;plan.requiresResponseCheck=plan.responseState!=='NONE';if(reaction.state==='UNAVAILABLE')plan.state='RECONCILE_RESPONSE';}
  if(noMail&&!group.threads.size){plan.requiresResponseCheck=false;plan.responseState='NONE';}
  if(call&&plan.state!=='RECONCILE_RESPONSE'){
   const changed=call.result===null&&JSON.stringify([...call.orderIds].sort())!==JSON.stringify(members.map(member=>member.orderId).sort());
   plan.state=changed&&call.result?'RECONCILE_RESPONSE':call.result==='notReached'?'CALL_NOT_REACHED':'CALL_PENDING';
   if(call.result==='notReached'&&call.recordedAt&&!changed){
    const unsent:FinishedDispatch[]=[];let storageUnavailable=false;
    for(const member of members){
     const row=result.find(item=>item.orderId===member.orderId);if(!row)continue;
     row.storage=storageEligibility(member.noticeAt,call.recordedAt,berlinCalendarDay(),policy,noMail);
     const letters=activeHistory.filter(item=>item.stage==='E4'&&!item.voidId&&item.orderIds.includes(member.orderId)&&item.storageOrigin?.callTaskId===call.taskId&&item.storageOrigin.freezes.some(proof=>proof.orderId===member.orderId&&proof.freezeId===member.freezeId));
     const letter=letters.at(-1);
     if(letter){
      row.storage.letter={state:letter.sentAt&&!letter.deliveryFailedAt?'SENT':letter.postalDocumentId?'WAIT_FOR_POST':'RECONCILE_MAIL',clientKey:letter.stageKey,orderIds:letter.orderIds,due:letter.dueDate,sentAt:letter.sentAt,threadId:letter.threadId,...(letter.postalDocumentId?{postalDocumentId:letter.postalDocumentId,postalTaskId:letter.postalTaskId}:{}),callTaskId:call.taskId,freezes:letter.storageOrigin!.freezes,finalStage:finalStorageStage(letter.deliveryFailedAt?null:letter.sentAt,berlinCalendarDay(),policy,letter.storageDeadline??{date:'',due:null})};
      try{const final=await readStorageFinalTaskState(auth,letter.stageKey);if(final)row.storage.letter.finalStage={state:final.status==='offen'?'TASK_PENDING':'COMPLETED',taskId:final.taskId,recipientId:final.recipientId,due:final.due,missingSettings:[]};}
      catch(error){console.error('[STORAGE_FINAL_READ_FAILED]',error instanceof Error?error.message:'UnknownError');failGroup();storageUnavailable=true;break;}

     }
     else if(row.storage.state==='DUE'&&!appointments.has(member.orderId))unsent.push(row);
    }
    if(!storageUnavailable&&unsent.length){
     const orderIds=unsent.map(row=>row.orderId).sort();
     const voidId=activeHistory.filter(row=>row.voidId&&row.storageOrigin?.callTaskId===call.taskId&&row.orderIds.some(id=>orderIds.includes(id))).at(-1)?.voidId;
     const clientKey=storageLetterKey(auth.tenantId,group.customerId,group.handover,call.stageKey+(voidId?':void:'+voidId:''),orderIds);
     const due=unsent.map(row=>row.storage!.eligibleOn!).sort().at(-1)!;
     const freezes=call.freezes.filter(proof=>orderIds.includes(proof.orderId));
     for(const row of unsent)row.storage!.letter={state:'DUE',clientKey,orderIds,due,sentAt:null,threadId:null,callTaskId:call.taskId,freezes,finalStage:finalStorageStage(null,berlinCalendarDay(),policy)};
    }
   }
  }
  for(const member of members){const row=result.find(item=>item.orderId===member.orderId);if(row&&!row.unavailable)row.reminder=plan;}
  }
 }
 // A qualified reply starts the next storage interval from that original, never from a fictitious call.
 const replyLeads=(orderId:string)=>{const reply=replies.get(orderId),appointment=appointments.get(orderId);return reply&&(!appointment||!replyDefersToAppointment(reply,appointment))?reply:null;};
 for(const row of result){
  const reply=replyLeads(row.orderId);if(!reply||row.unavailable||!row.reminder)continue;
  const members=result.filter(item=>!item.unavailable&&replyLeads(item.orderId)?.eventId===reply.eventId);
  const orderIds=members.map(item=>item.orderId).sort(),freezes=reply.proof.freezes.filter(proof=>orderIds.includes(proof.orderId));
  if(freezes.length!==orderIds.length){row.unavailable=true;row.gaps.push('REPLY_FREEZE_UNAVAILABLE');continue;}
  const due=pickupStorageDue(berlinCalendarDay(new Date(reply.proof.receivedAt)),policy);
  row.storage={state:due===null?'NEEDS_SETTING':due>berlinCalendarDay()?'WAIT':'DUE',eligibleOn:due,missingSettings:due===null?['storageAfterDays']:[],replyEventId:reply.eventId};
  const originals=(histories.get(JSON.stringify([reply.customerId,reply.handover]))??[]).filter(item=>item.stage==='E4'&&item.storageOrigin?.replyEventId===reply.eventId&&item.storageOrigin.freezes.some(proof=>proof.orderId===row.orderId&&freezes.some(actual=>actual.orderId===proof.orderId&&actual.freezeId===proof.freezeId)));
  const original=originals.filter(item=>!item.voidId).at(-1),voidId=originals.filter(item=>item.voidId).at(-1)?.voidId;
  if(original){
   row.storage.letter={state:original.sentAt&&!original.deliveryFailedAt?'SENT':original.postalDocumentId?'WAIT_FOR_POST':'RECONCILE_MAIL',clientKey:original.stageKey,orderIds:original.orderIds,due:original.dueDate,sentAt:original.sentAt,threadId:original.threadId,...(original.postalDocumentId?{postalDocumentId:original.postalDocumentId,postalTaskId:original.postalTaskId}:{}),replyEventId:reply.eventId,freezes:original.storageOrigin!.freezes,finalStage:finalStorageStage(original.deliveryFailedAt?null:original.sentAt,berlinCalendarDay(),policy,original.storageDeadline??{date:'',due:null})};
   try{const final=await readStorageFinalTaskState(auth,original.stageKey);if(final)row.storage.letter.finalStage={state:final.status==='offen'?'TASK_PENDING':'COMPLETED',taskId:final.taskId,recipientId:final.recipientId,due:final.due,missingSettings:[]};}catch(error){console.error('[REPLY_FINAL_READ_FAILED]',error instanceof Error?error.message:'UnknownError');row.unavailable=true;row.storage=undefined;}
  }else if(due&&due<=berlinCalendarDay())row.storage.letter={state:'DUE',clientKey:storageLetterKey(auth.tenantId,reply.customerId,reply.handover,reply.eventId+(voidId?':void:'+voidId:''),orderIds),orderIds,due,sentAt:null,threadId:null,replyEventId:reply.eventId,freezes,finalStage:finalStorageStage(null,berlinCalendarDay(),policy)};
 }
 for(const row of result){const appointment=appointments.get(row.orderId);if(!appointment||replyLeads(row.orderId)||row.unavailable||!row.reminder)continue;
  row.reminder={...row.reminder,state:appointment.paused===null?'NEEDS_SETTING':appointment.paused?'PAUSED':'APPOINTMENT_EXPIRED',due:appointment.resumeOn,clientKey:null,requiresResponseCheck:false,responseState:'NONE'};
  if(appointment.paused===false){
   const order=orders.find(item=>item.id===row.orderId)!,group=groups.get(JSON.stringify([order.customerId,'pickup'])),member=group?.members.find(item=>item.orderId===row.orderId);
   const due=pickupStorageDue(appointment.date,policy);
   if(!member?.freezeId){row.unavailable=true;row.gaps.push('PICKUP_APPOINTMENT_FREEZE_UNAVAILABLE');continue;}
   row.storage={state:due===null?'NEEDS_SETTING':due>berlinCalendarDay()?'WAIT':'DUE',eligibleOn:due,missingSettings:due===null?['storageAfterDays']:[],appointmentEventId:appointment.eventId};
   const originals=(histories.get(JSON.stringify([order.customerId,'pickup']))??[]).filter(item=>item.stage==='E4'&&item.storageOrigin?.appointmentEventId===appointment.eventId&&item.storageOrigin.freezes.some(proof=>proof.orderId===row.orderId&&proof.freezeId===member.freezeId));
   const original=originals.filter(item=>!item.voidId).at(-1),voidId=originals.filter(item=>item.voidId).at(-1)?.voidId;
   if(original){
    row.storage.letter={state:original.sentAt&&!original.deliveryFailedAt?'SENT':original.postalDocumentId?'WAIT_FOR_POST':'RECONCILE_MAIL',clientKey:original.stageKey,orderIds:original.orderIds,due:original.dueDate,sentAt:original.sentAt,threadId:original.threadId,...(original.postalDocumentId?{postalDocumentId:original.postalDocumentId,postalTaskId:original.postalTaskId}:{}),appointmentEventId:appointment.eventId,freezes:original.storageOrigin!.freezes,finalStage:finalStorageStage(original.deliveryFailedAt?null:original.sentAt,berlinCalendarDay(),policy,original.storageDeadline??{date:'',due:null})};
    try{const final=await readStorageFinalTaskState(auth,original.stageKey);if(final)row.storage.letter.finalStage={state:final.status==='offen'?'TASK_PENDING':'COMPLETED',taskId:final.taskId,recipientId:final.recipientId,due:final.due,missingSettings:[]};}catch(error){console.error('[APPOINTMENT_FINAL_READ_FAILED]',error);row.unavailable=true;row.storage=undefined;continue;}
   }else if(due&&due<=berlinCalendarDay())row.storage.letter={state:'DUE',clientKey:storageLetterKey(auth.tenantId,order.customerId,'pickup',appointment.eventId+(voidId?':void:'+voidId:''),[row.orderId]),orderIds:[row.orderId],due,sentAt:null,threadId:null,appointmentEventId:appointment.eventId,freezes:[{orderId:row.orderId,freezeId:member.freezeId}],finalStage:finalStorageStage(null,berlinCalendarDay(),policy)};
   continue;
  }
  if(row.storage){row.storage.state='WAIT';if(row.storage.letter){const original=row.storage.letter.finalStage;row.storage.letter.finalStage={...original,state:original.taskId?original.state:'WAIT',due:original.taskId?original.due:appointment.resumeOn,pausedUntil:appointment.resumeOn};if('positionProposal'in row.storage.letter.finalStage)row.storage.letter.finalStage.positionProposal=null;}}
 }
 for(const row of result){const stage=row.storage?.letter?.finalStage;if(stage&&hasAuthorizationArea(auth,'geld')&&['DUE','TASK_PENDING'].includes(stage.state))stage.positionProposal=policy?.storageWeeklyCents==null?null:{name:STORAGE_CHARGE_COPY.name,unit:STORAGE_CHARGE_COPY.unit,unitPriceCents:policy.storageWeeklyCents,quantity:null,automatic:false};}
 const due=new Map(orders.map(order=>[order.id,order.dueDate||'9999-12-31']));
 result.sort((a,b)=>Number(b.color==='gruen')-Number(a.color==='gruen')||(due.get(a.orderId)??'9999').localeCompare(due.get(b.orderId)??'9999')||a.orderId.localeCompare(b.orderId));
 return {code:'OK' as const,rows:result};
}
