// @vitest-environment node
// K6: all 21 TEST orders use actual intake/production/payment writers; no synthetic aggregate.
import {beforeAll,expect,it,vi} from 'vitest';
const tenant=vi.hoisted(()=>'TEST-ablauf-'+globalThis.crypto.randomUUID());
vi.mock('@/lib/tenant',()=>({KREILE_TENANT_SLUG:tenant}));
import {KREILE_TENANT_SLUG} from '@/lib/tenant';
import {full,sql,withSession,createFixture} from '../../../e2e/ablauf/replayHarness';
import {customerFixture,readyOrderForInvoice} from '../../../e2e/ablauf/orderFixture';
import {setPaymentModeAction} from '@/app/actions/payments.actions';
import {resolveAuthorization} from '@/lib/server/authorization';
import {readTodayDashboard} from '@/lib/server/todayDashboard';
import {getComplaints} from '@/app/actions/complaints.actions';
import {getQuoteFollowupsForTodayAction} from '@/app/actions/quotes.actions';
let foreignCustomer='';
async function prepayment(label:string,customerId?:string){
 const order=await readyOrderForInvoice(label,'pickup',customerId);
 expect(await withSession(full,()=>setPaymentModeAction({orderId:order.orderId,paymentMode:'vorkasse',expectedVersion:0,clientEventId:crypto.randomUUID()}))).toMatchObject({code:'OK'});
 return order;
}
// Separate bounded fixture batches keep the existing per-hook time limits unchanged.
beforeAll(async()=>{foreignCustomer=await customerFixture('TEST K6 foreign');for(let i=0;i<10;i++)await prepayment('TEST K6 foreign '+i,foreignCustomer);});
beforeAll(async()=>{for(let i=10;i<20;i++)await prepayment('TEST K6 foreign '+i,foreignCustomer);await sql`UPDATE public.customers SET country='AT' WHERE tenant_id=${KREILE_TENANT_SLUG} AND id=${foreignCustomer}`;});
it('K6 twenty excluded foreign prepayments cannot hide the next real domestic prepayment before or after reread',async()=>{
 const target=await prepayment('TEST K6 domestic last');
 const actor=await createFixture(['preise','zahlungen','buchhaltung'],'buero');
 const read=()=>withSession(actor,async()=>{const auth=await resolveAuthorization();if(!auth.ok)throw Error('TEST_K6_AUTH_REQUIRED');return readTodayDashboard(auth.data,getComplaints,getQuoteFollowupsForTodayAction);});
 const result=await read(),again=await read();
 expect(result.moneySources?.prepayments).toEqual({code:'OK',count:21});
 const entries=result.items.filter(row=>row.key.startsWith('prepayment:'));
 expect(entries.map(row=>row.orderId)).toEqual([target.orderId]);
 expect(again.items.filter(row=>row.key.startsWith('prepayment:'))).toEqual(entries);
});
