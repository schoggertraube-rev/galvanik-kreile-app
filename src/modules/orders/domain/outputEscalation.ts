import {createHash} from 'node:crypto';
import {berlinCalendarDay,plusWorkingDays} from '@/lib/domain/workingDays';
import type {DispatchPolicy} from '@/modules/fundament/public';

export type DispatchNoticeMember={orderId:string;orderNumber:string;noticeAt:string|null};
export type InitialDispatchReminderPlan={stage:'E1';state:'WAIT_FOR_NOTICE'|'NEEDS_SETTING'|'WAIT'|'DUE'|'STOPPED'|'RECONCILE_RESPONSE';due:string|null;oldestNoticeAt:string|null;clientKey:string|null;orderIds:string[];orderNumbers:string[];needsNotice:string[];automaticSend:false;requiresResponseCheck:boolean;responseState?:'NONE'|'REPLIED'|'NOT_CHECKED'|'UNAVAILABLE'};

/** A proposal only. The sending command must verify replies and immutable prior dispatches. */
export function planInitialDispatchReminder(input:{tenantId:string;customerId:string;handover:'pickup'|'shipping';members:readonly DispatchNoticeMember[];today:string},policy:DispatchPolicy|null):InitialDispatchReminderPlan{
 const members=[...input.members].sort((a,b)=>a.orderId.localeCompare(b.orderId));
 if(!members.length||new Set(members.map(row=>row.orderId)).size!==members.length)throw Error('DISPATCH_COHORT_INVALID');
 const notices=members.flatMap(member=>member.noticeAt?[member.noticeAt]:[]);
 if(notices.some(at=>!Number.isFinite(Date.parse(at))))throw Error('DISPATCH_NOTICE_TIME_INVALID');
 const oldest=notices.sort((a,b)=>Date.parse(a)-Date.parse(b))[0]??null;
 const base:InitialDispatchReminderPlan={stage:'E1',state:'WAIT_FOR_NOTICE',due:null,oldestNoticeAt:oldest,clientKey:null,orderIds:members.map(row=>row.orderId),orderNumbers:members.map(row=>row.orderNumber),needsNotice:members.filter(row=>!row.noticeAt).map(row=>row.orderId),automaticSend:false,requiresResponseCheck:true};
 if(!oldest)return base;
 if(!policy||policy.reminderDays===null)return {...base,state:'NEEDS_SETTING'};
 const due=plusWorkingDays(berlinCalendarDay(new Date(oldest)),policy.reminderDays,policy.holidays);
 if(!due)throw Error('DISPATCH_REMINDER_CALENDAR_INVALID');
 const hex=createHash('sha256').update(JSON.stringify(['dispatch-reminder',input.tenantId,input.customerId,input.handover,'E1',due])).digest('hex');
 const clientKey=hex.slice(0,8)+'-'+hex.slice(8,12)+'-5'+hex.slice(13,16)+'-8'+hex.slice(17,20)+'-'+hex.slice(20,32);
 return {...base,due,clientKey,state:due>input.today?'WAIT':'DUE'};
}
