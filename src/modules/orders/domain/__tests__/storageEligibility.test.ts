import {expect,it} from 'vitest';
import {storageEligibility,finalStorageStage,storageLetterKey} from '../storageEligibility';
import {emptyDispatchPolicy} from '@/modules/fundament/public';
it('keeps the full individual notice interval for later orders as well as the interval after the actual call result',()=>{
 const policy={...emptyDispatchPolicy(),reminderDays:1,secondReminderDays:1,callAfterDays:1,storageAfterDays:1,holidays:['2026-11-11']};
 const old=storageEligibility('2026-11-09T10:00:00Z','2026-11-12T10:00:00Z','2026-11-16',policy);
 const later=storageEligibility('2026-11-12T10:00:00Z','2026-11-12T10:00:00Z','2026-11-16',policy);
 expect(old).toMatchObject({state:'DUE',eligibleOn:'2026-11-16'});
 expect(later).toMatchObject({state:'WAIT',eligibleOn:'2026-11-18'});
 expect(storageEligibility('2026-11-12T10:00:00Z','2026-11-12T10:00:00Z','2026-11-18',policy)).toMatchObject({state:'DUE'});
 expect(storageEligibility('2026-11-09T10:00:00Z','2026-11-20T10:00:00Z','2026-11-20',policy)).toMatchObject({state:'WAIT',eligibleOn:'2026-11-23'});
 expect(storageEligibility('2026-11-09T10:00:00Z','2026-11-12T10:00:00Z','2026-11-16',{...policy,storageAfterDays:null})).toMatchObject({state:'NEEDS_SETTING',eligibleOn:null,missingSettings:['storageAfterDays']});
 expect(storageEligibility(null,'2026-11-12T10:00:00Z','2026-11-16',policy)).toMatchObject({state:'NEEDS_SETTING',eligibleOn:null});
});
it('final storage stage requires the actual letter dispatch, an explicit interval and a configured login',()=>{
 const policy={...emptyDispatchPolicy(),finalStageAfterLetterDays:2,finalStageRecipientId:'TEST-login',holidays:['2026-11-11']};
 expect(finalStorageStage(null,'2026-11-20',policy)).toMatchObject({state:'WAIT',due:null});
 expect(finalStorageStage('2026-11-10T10:00:00Z','2026-11-12',policy)).toMatchObject({state:'WAIT',due:'2026-11-13'});
 expect(finalStorageStage('2026-11-10T10:00:00Z','2026-11-13',policy)).toMatchObject({state:'DUE',due:'2026-11-13'});
 expect(finalStorageStage('2026-11-10T10:00:00Z','2026-11-20',emptyDispatchPolicy())).toMatchObject({state:'NEEDS_SETTING',due:null,missingSettings:['finalStageAfterLetterDays','finalStageRecipientId']});
 expect(finalStorageStage('2026-11-10T10:00:00Z','2026-11-10',{...policy,finalStageAfterLetterDays:0})).toMatchObject({state:'DUE',due:'2026-11-10'});
 expect(storageLetterKey('TEST-tenant','TEST-customer','pickup','TEST-call',['a','b'])).toBe(storageLetterKey('TEST-tenant','TEST-customer','pickup','TEST-call',['b','a']));
 expect(storageLetterKey('TEST-tenant','TEST-customer','pickup','TEST-call',['a'])).not.toBe(storageLetterKey('TEST-tenant','TEST-customer','pickup','TEST-call',['a','b']));
});
