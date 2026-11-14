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
