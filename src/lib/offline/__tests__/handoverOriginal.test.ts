import {expect,it} from 'vitest';
import {isPendingWorkshopOriginal,isPendingWorkshopAcknowledgement} from '../pendingStore';
// Explicit synthetic transport-contract probes only. Real writer/TaskWriter
// proof is in acceptance/s09_manual_handover and the native queue roundtrip.
const key='11111111-1111-4111-8111-111111111111',order='22222222-2222-4222-8222-222222222222',event='33333333-3333-4333-8333-333333333333',actor='44444444-4444-4444-8444-444444444444';
const scope='a'.repeat(64),at='2026-11-14T08:00:00.000Z';
const original={kind:'workshop',command:'order.handover',id:key,itemId:order,deviceCapturedAt:at,input:{command:'handover_manual',orderId:order,expectedVersion:5,clientEventId:key,handoverMode:'shipping'}};
const receipt={eventId:event,orderId:order,orderNumber:'A-2026-0001',customerId:order,expectedVersion:5,orderVersion:6,handoverMode:'shipping',requestedHandoverMode:'shipping',outcome:'changed',message:'TEST confirmed source',taskClientKey:null,passed:false,taskTitle:null,actor:{kind:'login',id:actor,at},taskId:null};
const response={code:'OK',handoverCommand:'order.handover',receipt,offlineReceipt:{scope,clientEventId:key,deviceCapturedAt:at,eventId:event,actorId:actor}};
it('retains a manual handover in the same queue, bound to the exact order/version/key and only the existing manual command',()=>{
 expect(isPendingWorkshopOriginal(original)).toBe(true);
 expect(isPendingWorkshopOriginal({...original,itemId:key})).toBe(false);
 expect(isPendingWorkshopOriginal({...original,input:{...original.input,command:'handover_from_mail'}})).toBe(false);
 expect(isPendingWorkshopOriginal({...original,input:{...original.input,handoverMode:'unknown'}})).toBe(false);
});
it('requires the actual matching handover/actor/version receipt rather than preservation, generic OK or a lost response',()=>{
 if(!isPendingWorkshopOriginal(original))throw Error('TEST_MANUAL_ORIGINAL_REQUIRED');
 expect(isPendingWorkshopAcknowledgement(scope,original,response)).toBe(true);
 expect(isPendingWorkshopAcknowledgement(scope,original,{...response,code:'PRESERVED'})).toBe(false);
 expect(isPendingWorkshopAcknowledgement(scope,original,{...response,receipt:undefined})).toBe(false);
 expect(isPendingWorkshopAcknowledgement(scope,original,{...response,receipt:{...receipt,orderVersion:5}})).toBe(false);
 expect(isPendingWorkshopAcknowledgement(scope,original,{...response,receipt:{...receipt,actor:{...receipt.actor,id:key}}})).toBe(false);
});
it('a late unchanged physical handover is final only with its own qualified real callback task',()=>{
 if(!isPendingWorkshopOriginal(original))throw Error('TEST_MANUAL_ORIGINAL_REQUIRED');
 const late={...receipt,handoverMode:'pickup',outcome:'call_customer',passed:true,orderVersion:5,taskClientKey:key,taskTitle:'TEST callback',taskId:event};
 expect(isPendingWorkshopAcknowledgement(scope,original,{...response,receipt:late})).toBe(true);
 expect(isPendingWorkshopAcknowledgement(scope,original,{...response,receipt:{...late,taskId:null}})).toBe(false);
 expect(isPendingWorkshopAcknowledgement(scope,original,{...response,receipt:{...late,taskId:order}})).toBe(false);
});
