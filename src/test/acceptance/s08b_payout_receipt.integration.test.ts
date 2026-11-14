// @vitest-environment node
// Real TEST payout; mutation attempts always abort their own transaction.
import {randomUUID} from 'node:crypto';
import {expect,it,vi} from 'vitest';
const tenant=vi.hoisted(()=>'TEST-ablauf-'+globalThis.crypto.randomUUID());
vi.mock('@/lib/tenant',()=>({KREILE_TENANT_SLUG:tenant}));
import {KREILE_TENANT_SLUG} from '@/lib/tenant';
import {sql,full,withSession} from '../../../e2e/ablauf/replayHarness';
import {readyInvoiceOrder} from '../../../e2e/ablauf/orderFixture';
import {confirmPaymentAction} from '@/app/actions/payments.actions';
import {cancelInvoiceAction,payoutCustomerCreditAction,getCustomerCreditAction} from '@/app/actions/invoices.actions';

it('A08b original payout event cannot be changed or removed and remains readable by fresh retry',async()=>{
 const url=process.env.DATABASE_URL;if(!url||url!==process.env.H18_EXPECTED_DATABASE_URL||new URL(url).hostname!=='127.0.0.1')throw Error('TEST_S08B_LOOPBACK_REQUIRED');
 const source=await readyInvoiceOrder('TEST S08b immutable payout receipt','pickup',false,undefined,8403);
 expect(await withSession(full,()=>confirmPaymentAction({invoiceId:source.invoice.invoiceId,amount:4000,method:'bar',expectedVersion:0,expectedOpenAmountCents:10000,clientEventId:randomUUID()}))).toMatchObject({code:'OK'});
 expect(await withSession(full,()=>cancelInvoiceAction({invoiceId:source.invoice.invoiceId,expectedVersion:1,reason:'TEST S08b immutable receipt source',clientEventId:randomUUID()}))).toMatchObject({code:'OK'});
 const input={customerId:source.customerId,amount:4000,expectedCreditVersion:1,clientEventId:randomUUID(),method:'bar' as const,reference:null,note:null};
 const paid=await withSession(full,()=>payoutCustomerCreditAction(input));if(paid.code!=='OK')throw Error('TEST_ACTUAL_PAYOUT_REQUIRED');
 const failures:string[]=[];
 for(const mutation of ['update','delete']){
  try{await sql.begin(async tx=>{
   if(mutation==='update')await tx`UPDATE public.events SET description='TEST forbidden payout rewrite' WHERE tenant_id=${KREILE_TENANT_SLUG} AND id=${paid.receipt.eventId}`;
   else await tx`DELETE FROM public.events WHERE tenant_id=${KREILE_TENANT_SLUG} AND id=${paid.receipt.eventId}`;
   throw Error('TEST_MUTATION_WAS_ALLOWED_ROLLBACK');
  });}catch(error){failures.push(error instanceof Error?error.message:'UNKNOWN');}
 }
 expect(failures).toHaveLength(2);
 for(const error of failures)expect(error).toMatch(/Audit-Log ist append-only/);
 expect(await withSession(full,()=>payoutCustomerCreditAction(JSON.parse(JSON.stringify(input))))).toEqual({...paid,replayed:true});
 expect(await withSession(full,()=>getCustomerCreditAction(input.customerId))).toMatchObject({code:'OK',credit:{balanceCents:0,version:2},payoutHistory:{code:'OK',entries:[paid.receipt]}});
});
