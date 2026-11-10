import {berlinCalendarDay,plusWorkingDays} from '@/lib/domain/workingDays';
import type {DispatchPolicy} from '@/modules/fundament/public';
import {createHash} from 'node:crypto';

export type StorageEligibility={state:'NEEDS_SETTING'|'WAIT'|'DUE';eligibleOn:string|null;missingSettings:string[];callResultAt:string;letter?:{state:'DUE'|'SENT'|'RECONCILE_MAIL'|'WAIT_FOR_POST';clientKey:string;orderIds:string[];due:string;sentAt:string|null;threadId:string|null;postalDocumentId?:string;postalTaskId?:string;callTaskId:string;freezes:Array<{orderId:string;freezeId:string}>;finalStage:{state:'NEEDS_SETTING'|'WAIT'|'DUE'|'TASK_PENDING'|'COMPLETED';due:string|null;recipientId:string|null;missingSettings:string[];taskId?:string;pausedUntil?:string|null;positionProposal?:{name:string;unit:string;unitPriceCents:number;quantity:null;automatic:false}|null}}};
/** A final interval starts only at a qualified dispatch receipt, never draft creation or a call. */
export function finalStorageStage(sentAt:string|null,today:string,policy:DispatchPolicy|null){
 const missingSettings=[...(policy?.finalStageAfterLetterDays==null?['finalStageAfterLetterDays']:[]),...(!policy?.finalStageRecipientId?['finalStageRecipientId']:[])];
 const recipientId=policy?.finalStageRecipientId??null;
 if(missingSettings.length||!sentAt)return {state:(missingSettings.length?'NEEDS_SETTING':'WAIT') as 'NEEDS_SETTING'|'WAIT',due:null,recipientId,missingSettings};
 if(!Number.isFinite(Date.parse(sentAt)))throw Error('STORAGE_LETTER_TIME_INVALID');
 const due=plusWorkingDays(berlinCalendarDay(new Date(sentAt)),policy!.finalStageAfterLetterDays!,policy!.holidays);
 if(!due)throw Error('STORAGE_LETTER_CALENDAR_INVALID');
 return {state:(due>today?'WAIT':'DUE') as 'WAIT'|'DUE',due,recipientId,missingSettings};
}
export function storageLetterKey(tenantId:string,customerId:string,handover:string,callKey:string,orderIds:readonly string[]){
 const hex=createHash('sha256').update(JSON.stringify(['storage-letter',tenantId,customerId,handover,callKey,[...orderIds].sort()])).digest('hex');
 return hex.slice(0,8)+'-'+hex.slice(8,12)+'-5'+hex.slice(13,16)+'-8'+hex.slice(17,20)+'-'+hex.slice(20,32);
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
