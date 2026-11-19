// @vitest-environment node
// Independent real-current TEST source plus explicitly synthetic historical members.
import {randomUUID} from 'node:crypto';
import {beforeAll,it,expect,vi} from 'vitest';
const tenant=vi.hoisted(()=>'TEST-ablauf-'+globalThis.crypto.randomUUID());
vi.mock('@/lib/tenant',()=>({KREILE_TENANT_SLUG:tenant}));
import {full,withSession} from '../../../e2e/ablauf/replayHarness';
import {customerFixture,readyInvoiceOrder} from '../../../e2e/ablauf/orderFixture';
import {historicalCollection} from '../../../e2e/ablauf/invoiceCollectionFixture';
import {issueCollectionInvoiceAction} from '@/app/actions/invoices.actions';
import {getCustomerSummaryAction,saveCustomerAgreementAction} from '@/app/actions/customers.actions';
import {sendCustomerMailAction} from '@/app/actions/communications.actions';
import {requestMailStep} from '../../../e2e/ablauf/requestMailStep';
beforeAll(()=>{const url=process.env.DATABASE_URL;if(!url||url!==process.env.H18_EXPECTED_DATABASE_URL||new URL(url).hostname!=='127.0.0.1'||new URL(url).pathname!=='/postgres')throw Error('TEST_MIXED_COHORT_LOOPBACK_REQUIRED');});

it('mixed ordinary and native originals keep their real sender cohorts reachable from the customer command without losing either original',async()=>{
 await requestMailStep('S38-mixed-real-fiscal-cohorts');
 const customerId=await customerFixture('TEST S38 mixed fiscal cohorts');
 const ordinary=await readyInvoiceOrder('TEST S38 ordinary first','pickup',false,customerId);
 const agreement=await withSession(full,()=>saveCustomerAgreementAction({customerId,orderId:null,clientKey:randomUUID(),type:'sammelrechnung',targetDays:30,reason:'TEST distinct existing fiscal mail groups'}));
 if(agreement.code!=='OK')throw Error('TEST_MIXED_NATIVE_AGREEMENT_REQUIRED');
 const source=await historicalCollection([1900,1900,1900],{customerId,agreementId:agreement.agreement.id});
 const native=await withSession(full,()=>issueCollectionInvoiceAction({collectionId:source.collectionId,expectedVersion:1,clientEventId:randomUUID()}));
 if(native.code!=='OK')throw Error('TEST_MIXED_NATIVE_ORIGINAL_REQUIRED');
 const before=await withSession(full,()=>getCustomerSummaryAction({customerId}));
 if(before.code!=='OK')throw Error('TEST_MIXED_CUSTOMER_SOURCE_REQUIRED');
 expect(before.data.invoiceUnsentCount).toBe(2);expect(before.data.invoiceUnsentOriginals?.map(row=>row.id)).toEqual([ordinary.invoice.invoiceId,native.receipt.invoiceId]);
 const first=before.data.nextActionRule?.hauptaktion;
 if(!first||!('befehl'in first))throw Error('TEST_MIXED_FIRST_COMMAND_REQUIRED');
 const firstArgs=JSON.parse(JSON.stringify(first.befehl.argumente)) as Pick<Parameters<typeof sendCustomerMailAction>[0],'targetType'|'targetId'|'attachment'|'expectedInvoiceIds'>;
 expect(firstArgs).toMatchObject({attachment:{kind:'INVOICE',documentId:ordinary.invoice.invoiceId},expectedInvoiceIds:[ordinary.invoice.invoiceId]});
 const firstInput={...firstArgs,clientRequestId:randomUUID(),subject:'TEST actual ordinary cohort',body:'TEST gespeichertes Einzeloriginal'};
 expect(await withSession(full,()=>sendCustomerMailAction(firstInput))).toMatchObject({code:'OK'});
 expect(await withSession(full,()=>sendCustomerMailAction(JSON.parse(JSON.stringify(firstInput))))).toMatchObject({code:'OK',data:{replayed:true}});
 const remaining=await withSession(full,()=>getCustomerSummaryAction({customerId}));
 if(remaining.code!=='OK')throw Error('TEST_MIXED_REMAINING_SOURCE_REQUIRED');
 expect(remaining.data.invoiceUnsentCount).toBe(1);expect(remaining.data.invoiceUnsentOriginals?.map(row=>row.id)).toEqual([native.receipt.invoiceId]);
 const next=remaining.data.nextActionRule?.hauptaktion;
 if(!next||!('befehl'in next))throw Error('TEST_MIXED_NEXT_COMMAND_REQUIRED');
 const nextArgs=JSON.parse(JSON.stringify(next.befehl.argumente)) as typeof firstArgs;
 expect(nextArgs).toMatchObject({attachment:{kind:'INVOICE',documentId:native.receipt.invoiceId},expectedInvoiceIds:[native.receipt.invoiceId]});
 expect(await withSession(full,()=>sendCustomerMailAction({...nextArgs,clientRequestId:randomUUID(),subject:'TEST actual native cohort',body:'TEST gespeichertes Sammeloriginal'}))).toMatchObject({code:'OK'});
 expect(await withSession(full,()=>getCustomerSummaryAction({customerId}))).toMatchObject({code:'OK',data:{invoiceUnsentCount:0,invoiceUnsentOriginals:[]}});
 const sends=vi.mocked(globalThis.fetch).mock.calls.filter(([url,init])=>String(url).includes('graph.microsoft.com')&&String(url).endsWith('/sendMail')&&init?.method==='POST');
 expect(sends).toHaveLength(2);expect(sends.every(([,init])=>JSON.parse(String(init?.body)).message.attachments.length===1)).toBe(true);
});
