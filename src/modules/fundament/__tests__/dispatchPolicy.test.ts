import {expect,it} from 'vitest';
import {dispatchPolicyValid,emptyDispatchPolicy} from '../dispatchPolicy';

it('historical rules keep the final stage off; only explicit valid intervals and recipient IDs are accepted',()=>{
 const old=emptyDispatchPolicy();
 expect(dispatchPolicyValid(old)).toBe(true);
 expect(old.finalStageAfterLetterDays).toBeUndefined();
 expect(old.finalStageRecipientId).toBeUndefined();
 const configured={...old,finalStageAfterLetterDays:0,finalStageRecipientId:'7b2d1953-b806-4f45-a03f-40a5cb9a53eb'};
 expect(dispatchPolicyValid(configured)).toBe(true);
 expect(dispatchPolicyValid({...configured,finalStageAfterLetterDays:null,finalStageRecipientId:null})).toBe(true);
 for(const value of [-1,0.5,3651,'2',undefined])expect(dispatchPolicyValid({...configured,finalStageAfterLetterDays:value})).toBe(false);
 for(const value of ['', 'meister', undefined])expect(dispatchPolicyValid({...configured,finalStageRecipientId:value})).toBe(false);
 expect(dispatchPolicyValid({...configured,unexpected:true})).toBe(false);
});
