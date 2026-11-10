import {berlinCalendarDay,plusWorkingDays} from '@/lib/domain/workingDays';
import type {DispatchPolicy} from '@/modules/fundament/public';

export type StorageEligibility={state:'NEEDS_SETTING'|'WAIT'|'DUE';eligibleOn:string|null;missingSettings:string[];callResultAt:string};
/** PL06:00: each order keeps its own complete notice-to-E4 interval. No storage fee/deadline is inferred. */
export function storageEligibility(noticeAt:string|null,callResultAt:string,today:string,policy:DispatchPolicy|null):StorageEligibility{
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
