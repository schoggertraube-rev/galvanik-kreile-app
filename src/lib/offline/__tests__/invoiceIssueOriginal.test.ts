import {expect,it} from 'vitest';
import {isPendingWorkshopOriginal,isPendingWorkshopAcknowledgement} from '../pendingStore';
// Explicit synthetic contract probes only; real invoice writer proof is in
// acceptance/s09_shipping_cost_invoice and the native financial queue case.
const order='11111111-1111-4111-8111-111111111111',key='22222222-2222-4222-8222-222222222222',invoice='33333333-3333-4333-8333-333333333333',event='44444444-4444-4444-8444-444444444444',actor='55555555-5555-4555-8555-555555555555';
const scope='a'.repeat(64),at='2026-11-14T06:00:00.000Z';
const entry={kind:'workshop',command:'invoice.issue',id:key,itemId:order,deviceCapturedAt:at,input:{orderId:order,expectedVersion:4,clientEventId:key,shippingCosts:{invoiceId:invoice,expectedVersion:1,scope:'order:'+order,expectedFeeCents:1000}}};
it('retains the existing invoice intent with its exact original key/order and selected scope, including explicit zero',()=>{
 expect(isPendingWorkshopOriginal(entry)).toBe(true);
 expect(isPendingWorkshopOriginal({...entry,input:{...entry.input,shippingCosts:{...entry.input.shippingCosts,expectedFeeCents:0}}})).toBe(true);
 expect(isPendingWorkshopOriginal({...entry,id:invoice})).toBe(false);
 expect(isPendingWorkshopOriginal({...entry,itemId:invoice})).toBe(false);
 expect(isPendingWorkshopOriginal({...entry,input:{...entry.input,shippingCosts:{...entry.input.shippingCosts,scope:'order:'+invoice}}})).toBe(false);
 expect(isPendingWorkshopOriginal({...entry,input:{...entry.input,shippingCosts:{...entry.input.shippingCosts,expectedFeeCents:null}}})).toBe(false);
});
it('only an actual invoice-shaped financial receipt can acknowledge an invoice; preservation and incomplete OK never do',()=>{
 if(!isPendingWorkshopOriginal(entry))throw Error('TEST_INVOICE_ORIGINAL_NOT_RECOGNIZED');
 const offlineReceipt={scope,clientEventId:key,deviceCapturedAt:at,eventId:event,actorId:actor};
 const receipt={eventId:event,clientEventId:key,orderId:order,issuedBy:actor,invoiceId:invoice,pdfSha256:'b'.repeat(64)};
 const valid={code:'OK',financialCommand:'invoice.issue',offlineReceipt,receipt};
 expect(isPendingWorkshopAcknowledgement(scope,entry,valid)).toBe(true);
 expect(isPendingWorkshopAcknowledgement(scope,entry,{...valid,code:'PRESERVED'})).toBe(false);
 expect(isPendingWorkshopAcknowledgement(scope,entry,{...valid,receipt:undefined})).toBe(false);
 expect(isPendingWorkshopAcknowledgement(scope,entry,{...valid,receipt:{...receipt,issuedBy:invoice}})).toBe(false);
 expect(isPendingWorkshopAcknowledgement(scope,entry,{...valid,receipt:{...receipt,clientEventId:invoice}})).toBe(false);
 expect(isPendingWorkshopAcknowledgement(scope,entry,{...valid,receipt:{...receipt,pdfSha256:''}})).toBe(false);
});
it('a cancellation that requested reissue cannot acknowledge without the exact bound replacement and both actual actors',()=>{
 const replacementKey='66666666-6666-4666-8666-666666666666',replacementId='77777777-7777-4777-8777-777777777777',repairActor='88888888-8888-4888-8888-888888888888';
 const original={kind:'workshop',command:'invoice.cancel',id:key,itemId:invoice,deviceCapturedAt:at,input:{invoiceId:invoice,expectedVersion:1,reason:'TEST shipping removed',clientEventId:key,reissueWithoutShipping:{handoverEventId:event,replacementClientEventId:replacementKey}}};
 if(!isPendingWorkshopOriginal(original))throw Error('TEST_REISSUE_ORIGINAL_REQUIRED');
 const receipt={invoiceId:invoice,orderId:order,status:'cancelled',eventId:event,clientEventId:key,cancelledBy:actor,originalPdfSha256:'c'.repeat(64),reissueWithoutShipping:{...original.input.reissueWithoutShipping,confirmedBy:actor,originalPdfSha256:'c'.repeat(64),orderVersion:5}};
 const result={code:'OK',financialCommand:'invoice.cancel',offlineReceipt:{scope,clientEventId:key,deviceCapturedAt:at,eventId:event,actorId:actor},receipt};
 expect(isPendingWorkshopAcknowledgement(scope,original,result)).toBe(false);
 const replacementReceipt={invoiceId:replacementId,orderId:order,status:'issued',orderVersion:5,eventId:replacementId,clientEventId:replacementKey,issuedBy:repairActor,pdfSha256:'d'.repeat(64),reissue:{cancellationEventId:event,confirmedBy:actor,repairActorId:repairActor}};
 expect(isPendingWorkshopAcknowledgement(scope,original,{...result,replacementReceipt})).toBe(true);
 expect(isPendingWorkshopAcknowledgement(scope,original,{...result,replacementReceipt:{...replacementReceipt,clientEventId:key}})).toBe(false);
 expect(isPendingWorkshopAcknowledgement(scope,original,{...result,replacementReceipt:{...replacementReceipt,reissue:{...replacementReceipt.reissue,repairActorId:actor}}})).toBe(false);
});
