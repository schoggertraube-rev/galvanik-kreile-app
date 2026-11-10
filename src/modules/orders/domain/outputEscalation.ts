import {createHash} from 'node:crypto';
import {berlinCalendarDay,plusWorkingDays} from '@/lib/domain/workingDays';
import type {DispatchPolicy} from '@/modules/fundament/public';

export type DispatchNoticeMember={orderId:string;orderNumber:string;noticeAt:string|null;readyAt?:string|null};
export type InitialDispatchReminderPlan={stage:'E1'|'E2'|'E3';state:'WAIT_FOR_NOTICE'|'NEEDS_SETTING'|'WAIT'|'DUE'|'STOPPED'|'RECONCILE_RESPONSE'|'RECONCILE_MAIL'|'CALL_PENDING'|'CALL_NOT_REACHED';due:string|null;oldestNoticeAt:string|null;anchorOrderId?:string;callTaskId?:string;clientKey:string|null;orderIds:string[];orderNumbers:string[];needsNotice:string[];automaticSend:false;requiresResponseCheck:boolean;responseState?:'NONE'|'REPLIED'|'NOT_CHECKED'|'UNAVAILABLE'};

/** A proposal only. The sending command must verify replies and immutable prior dispatches. */
export function planInitialDispatchReminder(input:{tenantId:string;customerId:string;handover:'pickup'|'shipping';members:readonly DispatchNoticeMember[];today:string;noMail?:boolean;deliveryFailedAt?:string|null},policy:DispatchPolicy|null,history:ReadonlyArray<{stage:'E1'|'E2';sentAt:string|null;deliveryFailedAt?:string|null}>=[]):InitialDispatchReminderPlan{
 const members=[...input.members].sort((a,b)=>a.orderId.localeCompare(b.orderId));
 if(!members.length||new Set(members.map(row=>row.orderId)).size!==members.length)throw Error('DISPATCH_COHORT_INVALID');
 const notices=members.flatMap(member=>member.noticeAt?[member.noticeAt]:[]);
 if(notices.some(at=>!Number.isFinite(Date.parse(at))))throw Error('DISPATCH_NOTICE_TIME_INVALID');
 const oldest=notices.sort((a,b)=>Date.parse(a)-Date.parse(b))[0]??null;
 const base:InitialDispatchReminderPlan={stage:'E1',state:'WAIT_FOR_NOTICE',due:null,oldestNoticeAt:oldest,clientKey:null,orderIds:members.map(row=>row.orderId),orderNumbers:members.map(row=>row.orderNumber),needsNotice:members.filter(row=>!row.noticeAt).map(row=>row.orderId),automaticSend:false,requiresResponseCheck:true};
 const failedAt=input.deliveryFailedAt??history.filter(row=>row.deliveryFailedAt).at(-1)?.deliveryFailedAt;
 if(input.noMail||failedAt){
  const ready=members.filter(member=>member.readyAt).sort((a,b)=>Date.parse(a.readyAt!)-Date.parse(b.readyAt!)||a.orderId.localeCompare(b.orderId))[0];
  const start=failedAt??oldest??ready?.readyAt;
  if(!start)return {...base,stage:'E3'};
  if(!Number.isFinite(Date.parse(start)))throw Error('DISPATCH_READY_TIME_INVALID');
  const due=berlinCalendarDay(new Date(start));
  return {...base,stage:'E3',state:'DUE',due,anchorOrderId:members.find(member=>member.noticeAt===oldest&&oldest!==null)?.orderId??ready?.orderId,needsNotice:[],clientKey:dispatchReminderKey(input.tenantId,input.customerId,input.handover,'E3',due)};
 }
 if(!oldest)return base;
 base.anchorOrderId=members.find(member=>member.noticeAt===oldest)?.orderId;
 const unclear=history.find(row=>!row.sentAt);if(unclear)return {...base,stage:unclear.stage,state:'RECONCILE_MAIL'};
 const first=history.filter(row=>row.stage==='E1'&&row.sentAt).at(-1),second=history.filter(row=>row.stage==='E2'&&row.sentAt).at(-1);
 const stage=second?'E3':first?'E2':'E1',start=second?.sentAt??first?.sentAt??oldest;
 const interval=policy?.[stage==='E1'?'reminderDays':stage==='E2'?'secondReminderDays':'callAfterDays'];
 if(interval===undefined||interval===null)return {...base,stage,state:'NEEDS_SETTING'};
 const due=plusWorkingDays(berlinCalendarDay(new Date(start)),interval,policy!.holidays);
 if(!due)throw Error('DISPATCH_REMINDER_CALENDAR_INVALID');
 const clientKey=dispatchReminderKey(input.tenantId,input.customerId,input.handover,stage,due);
 return {...base,stage,due,clientKey,state:due>input.today?'WAIT':'DUE'};
}

function dispatchReminderKey(tenantId:string,customerId:string,handover:string,stage:string,due:string){
 const hex=createHash('sha256').update(JSON.stringify(['dispatch-reminder',tenantId,customerId,handover,stage,due])).digest('hex');
 return hex.slice(0,8)+'-'+hex.slice(8,12)+'-5'+hex.slice(13,16)+'-8'+hex.slice(17,20)+'-'+hex.slice(20,32);
}
