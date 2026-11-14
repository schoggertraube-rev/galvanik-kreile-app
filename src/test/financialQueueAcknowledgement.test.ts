import {describe,expect,it} from 'vitest';
import {isPendingWorkshopAcknowledgement,isPendingWorkshopOriginal,type PendingWorkshopOriginal} from '@/lib/offline/pendingStore';

// Isolated synthetic protocol envelopes, never a product writer proof.
const scope='a'.repeat(64),id='11111111-1111-4111-8111-111111111111',invoiceId='22222222-2222-4222-8222-222222222222',deviceCapturedAt='2026-11-14T00:00:00.000Z';
const financial:PendingWorkshopOriginal={kind:'workshop',command:'invoice.cancel',id,itemId:invoiceId,deviceCapturedAt,input:{invoiceId,clientEventId:id,expectedVersion:1,reason:'TEST protocol envelope'}};
const receipt={scope,clientEventId:id,deviceCapturedAt,eventId:'33333333-3333-4333-8333-333333333333',actorId:'44444444-4444-4444-8444-444444444444'};
describe('financial queue acknowledgement protocol',()=>{
 it('keeps payout customer identity and requires actual financial acknowledgement, never physical preservation',()=>{
  const payout:PendingWorkshopOriginal={kind:'workshop',command:'credit.payout',id,itemId:'TEST-customer',deviceCapturedAt,input:{customerId:'TEST-customer',clientEventId:id,amount:4000,expectedCreditVersion:1,method:'bar',reference:null,note:null}};
  expect(isPendingWorkshopOriginal(payout)).toBe(true);
  expect(isPendingWorkshopOriginal({...payout,itemId:invoiceId})).toBe(false);
  expect(isPendingWorkshopAcknowledgement(scope,payout,{code:'PRESERVED',financialCommand:'credit.payout',offlineReceipt:receipt})).toBe(false);
  expect(isPendingWorkshopAcknowledgement(scope,payout,{code:'OK',financialCommand:'credit.apply',offlineReceipt:receipt})).toBe(false);
  expect(isPendingWorkshopAcknowledgement(scope,payout,{code:'OK',financialCommand:'credit.payout',offlineReceipt:receipt})).toBe(true);
 });
 it('never acknowledges preserved originals as successful money commands',()=>{
  expect(isPendingWorkshopAcknowledgement(scope,financial,{code:'PRESERVED',financialCommand:financial.command,offlineReceipt:receipt})).toBe(false);
 });
 it('requires the exact money command and original receipt',()=>{
  expect(isPendingWorkshopAcknowledgement(scope,financial,{code:'OK',offlineReceipt:receipt})).toBe(false);
  expect(isPendingWorkshopAcknowledgement(scope,financial,{code:'OK',financialCommand:'credit.apply',offlineReceipt:receipt})).toBe(false);
  expect(isPendingWorkshopAcknowledgement(scope,financial,{code:'OK',financialCommand:financial.command,offlineReceipt:{...receipt,clientEventId:invoiceId}})).toBe(false);
  expect(isPendingWorkshopAcknowledgement(scope,financial,{code:'OK',financialCommand:financial.command,offlineReceipt:receipt})).toBe(true);
 });
 it('retains the existing physical conflict-preservation contract',()=>{
  const physical:PendingWorkshopOriginal={kind:'workshop',command:'item.finished',id,itemId:invoiceId,deviceCapturedAt,input:{orderId:invoiceId,itemId:invoiceId,clientEventId:id,expectedVersion:1,finished:true}};
  expect(isPendingWorkshopAcknowledgement(scope,physical,{code:'PRESERVED',offlineReceipt:receipt})).toBe(true);
 });
});
