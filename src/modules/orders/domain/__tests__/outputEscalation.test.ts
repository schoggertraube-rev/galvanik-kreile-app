import {expect,it} from 'vitest';
import {planInitialDispatchReminder} from '../outputEscalation';
import type {DispatchPolicy} from '@/modules/fundament/public';
it('E06 keeps the oldest open notice clock and every member when a later order joins or is notified',()=>{
 const input={tenantId:'TEST-tenant',customerId:'TEST-customer',handover:'pickup' as const,today:'2026-11-12',members:[{orderId:'TEST-old',orderNumber:'TEST-A1',noticeAt:'2026-11-09T10:00:00Z'},{orderId:'TEST-new',orderNumber:'TEST-A2',noticeAt:'2026-11-11T10:00:00Z'}]};
 const policy:DispatchPolicy={reminderDays:2,secondReminderDays:null,callAfterDays:null,storageAfterDays:null,blockAfterDueDays:null,unconfirmedDeliveryDays:null,holdMinutes:null,pickupWindows:[],holidays:[],carrierCutoffs:[],fallbackService:null};
 const single=planInitialDispatchReminder({...input,members:[input.members[0]]},policy),group=planInitialDispatchReminder(input,policy);
 expect(group).toMatchObject({state:'DUE',due:'2026-11-11',oldestNoticeAt:'2026-11-09T10:00:00Z',automaticSend:false,requiresResponseCheck:true});
 expect(group.clientKey).toBe(single.clientKey);expect(group.orderNumbers.sort()).toEqual(['TEST-A1','TEST-A2']);
 expect(planInitialDispatchReminder({...input,members:[input.members[0],{...input.members[1],noticeAt:null}]},policy)).toMatchObject({due:single.due,clientKey:single.clientKey,needsNotice:['TEST-new']});
 expect(planInitialDispatchReminder(input,null)).toMatchObject({state:'NEEDS_SETTING',due:null});
 expect(planInitialDispatchReminder({...input,today:'2026-11-10'},policy)).toMatchObject({state:'WAIT'});
});
