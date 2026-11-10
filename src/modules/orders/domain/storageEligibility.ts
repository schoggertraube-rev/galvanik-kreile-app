import {berlinCalendarDay,plusWorkingDays} from '@/lib/domain/workingDays';
import type {DispatchPolicy} from '@/modules/fundament/public';
export {storageLetterKey} from '@/lib/server/storageLetterKey';

export type StorageEligibility={state:'NEEDS_SETTING'|'WAIT'|'DUE';eligibleOn:string|null;missingSettings:string[];callResultAt?:string;appointmentEventId?:string;replyEventId?:string;letter?:{state:'DUE'|'SENT'|'RECONCILE_MAIL'|'WAIT_FOR_POST';clientKey:string;orderIds:string[];due:string;sentAt:string|null;threadId:string|null;postalDocumentId?:string;postalTaskId?:string;callTaskId?:string;appointmentEventId?:string;replyEventId?:string;freezes:Array<{orderId:string;freezeId:string}>;finalStage:{state:'NEEDS_SETTING'|'WAIT'|'DUE'|'TASK_PENDING'|'COMPLETED';due:string|null;recipientId:string|null;missingSettings:string[];taskId?:string;pausedUntil?:string|null;positionProposal?:{name:string;unit:string;unitPriceCents:number;quantity:null;automatic:false}|null}}};
/** A final interval starts only at a qualified dispatch receipt, never draft creation or a call. */
export function finalStorageStage(sentAt:string|null,today:string,policy:DispatchPolicy|null,frozen?:{date:string;due:string|null}){
 if(frozen){
  const missingSettings=[...(frozen.due===null?['originalLetterDeadline']:[]),...(!policy?.finalStageRecipientId?['finalStageRecipientId']:[])];
  const recipientId=policy?.finalStageRecipientId??null;
  if(missingSettings.length||!sentAt)return {state:(missingSettings.length?'NEEDS_SETTING':'WAIT') as 'NEEDS_SETTING'|'WAIT',due:null,recipientId,missingSettings};
  if(!/^\d{4}-\d{2}-\d{2}$/.test(frozen.due!)||!Number.isFinite(Date.parse(frozen.due!)))throw Error('STORAGE_ORIGINAL_DEADLINE_INVALID');
  return {state:(frozen.due!>today?'WAIT':'DUE') as 'WAIT'|'DUE',due:frozen.due,recipientId,missingSettings};
 }
 const missingSettings=[...(policy?.finalStageAfterLetterDays==null?['finalStageAfterLetterDays']:[]),...(!policy?.finalStageRecipientId?['finalStageRecipientId']:[])];
 const recipientId=policy?.finalStageRecipientId??null;
 if(missingSettings.length||!sentAt)return {state:(missingSettings.length?'NEEDS_SETTING':'WAIT') as 'NEEDS_SETTING'|'WAIT',due:null,recipientId,missingSettings};
 if(!Number.isFinite(Date.parse(sentAt)))throw Error('STORAGE_LETTER_TIME_INVALID');
 const due=plusWorkingDays(berlinCalendarDay(new Date(sentAt)),policy!.finalStageAfterLetterDays!,policy!.holidays);
 if(!due)throw Error('STORAGE_LETTER_CALENDAR_INVALID');
 return {state:(due>today?'WAIT':'DUE') as 'WAIT'|'DUE',due,recipientId,missingSettings};
}
/** PL06:00: each order keeps its own complete notice-to-E4 interval. No storage fee/deadline is inferred. */
export function storageEligibility(noticeAt:string|null,callResultAt:string,today:string,policy:DispatchPolicy|null,noMail=false):StorageEligibility{
 if(noMail){
  if(policy?.storageAfterDays==null)return {state:'NEEDS_SETTING',eligibleOn:null,missingSettings:['storageAfterDays'],callResultAt};
  if(!Number.isFinite(Date.parse(callResultAt)))throw Error('STORAGE_CALL_TIME_INVALID');
  const eligibleOn=plusWorkingDays(berlinCalendarDay(new Date(callResultAt)),policy.storageAfterDays,policy.holidays);if(!eligibleOn)throw Error('STORAGE_ELIGIBILITY_CALENDAR_INVALID');
  return {state:eligibleOn>today?'WAIT':'DUE',eligibleOn,missingSettings:[],callResultAt};
 }
 const fields=['reminderDays','secondReminderDays','callAfterDays','storageAfterDays'] as const;
 const missing=fields.filter(key=>policy?.[key]===null||policy?.[key]===undefined);
 const base:StorageEligibility={state:'NEEDS_SETTING',eligibleOn:null,missingSettings:missing,callResultAt};
 if(!noticeAt)return {...base,missingSettings:[...missing,'NOTICE_MISSING']};
 if(missing.length||!policy)return base;
 const ownInterval=fields.reduce((sum,key)=>sum+policy[key]!,0);
 const ownDate=plusWorkingDays(berlinCalendarDay(new Date(noticeAt)),ownInterval,policy.holidays);
 const callDate=plusWorkingDays(berlinCalendarDay(new Date(callResultAt)),policy.storageAfterDays!,policy.holidays);
 if(!ownDate||!callDate)throw Error('STORAGE_ELIGIBILITY_CALENDAR_INVALID');
 const eligibleOn=ownDate>callDate?ownDate:callDate;
 return {state:eligibleOn>today?'WAIT':'DUE',eligibleOn,missingSettings:[],callResultAt};
}
