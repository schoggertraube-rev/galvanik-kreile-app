import {afterEach,expect,it,vi} from 'vitest';
import {canonicalJson} from '@/lib/domain/canonicalJson';
import type {PendingWorkshopOriginal} from '@/lib/offline/pendingStore';
import {queueFinancialCommand} from '@/lib/offline/queueFinancialCommand';

const ports=vi.hoisted(()=>({retain:vi.fn(),sync:vi.fn()}));
vi.mock('@/lib/offline/pendingStore',async(importOriginal)=>({...await importOriginal<object>(),retainPendingWorkshopOriginal:ports.retain}));
vi.mock('@/lib/offline/syncOriginals',()=>({syncOriginals:ports.sync}));
afterEach(()=>vi.resetAllMocks());
const scope='a'.repeat(64),id='11111111-1111-4111-8111-111111111111';
const input={invoiceId:'22222222-2222-4222-8222-222222222222',clientEventId:id,expectedVersion:1,reason:'TEST rejected original'};

it.each(['valid','changed-input','invalid-receipt'] as const)('exposes only a bound terminal receipt: %s',async(mode)=>{
 // Isolated synthetic transport envelope, exercising the actual producer consumer.
 ports.sync.mockImplementation(async()=>{
  const retained=ports.retain.mock.calls[0][1] as PendingWorkshopOriginal;
  const entry=mode==='changed-input'&&retained.command==='invoice.cancel'?{...retained,input:{...retained.input,reason:'TEST other original'}}:retained;
  const rejectionReceipt={scope,clientEventId:id,deviceCapturedAt:entry.deviceCapturedAt,actorId:'33333333-3333-4333-8333-333333333333',eventId:'44444444-4444-4444-8444-444444444444',taskId:mode==='invalid-receipt'?'invalid':'55555555-5555-4555-8555-555555555555',rejection:'CONFLICT',originalCanonical:canonicalJson({command:entry.command,input:entry.input,deviceCapturedAt:entry.deviceCapturedAt})};
  window.dispatchEvent(new CustomEvent('kreile-workshop-rejected',{detail:{scope,entry,result:{code:'PRESERVED',message:'TEST stored rejection',currentCreditBalanceCents:1234,rejectionReceipt}}}));
 });
 const result=await queueFinancialCommand(scope,{command:'invoice.cancel',input},()=>scope);
 if(mode==='valid')expect(result).toMatchObject({code:'CONFLICT',message:'TEST stored rejection',currentCreditBalanceCents:1234,rejectionReceipt:{clientEventId:id}});
 else{expect(result.code).toBe('UNAVAILABLE');expect(result).not.toHaveProperty('rejectionReceipt');}
 expect(ports.retain).toHaveBeenCalledTimes(1);
});
