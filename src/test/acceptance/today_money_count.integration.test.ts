// @vitest-environment node
import {it,expect,vi} from 'vitest';
import {randomUUID} from 'node:crypto';
const tenant=vi.hoisted(()=>'TEST-ablauf-'+globalThis.crypto.randomUUID());
vi.mock('@/lib/tenant',()=>({KREILE_TENANT_SLUG:tenant}));
import {sql,full,withSession,createFixture} from '../../../e2e/ablauf/replayHarness';
import {customerFixture,intakeOrderFixture} from '../../../e2e/ablauf/orderFixture';
import {resolveAuthorization} from '@/lib/server/authorization';
import {readTodayDashboard} from '@/lib/server/todayDashboard';
import {getComplaints} from '@/app/actions/complaints.actions';
import {getQuoteFollowupsForTodayAction} from '@/app/actions/quotes.actions';

it('T05-3 counts all 25 historical invoice fixtures while limiting the list and applying money rights before aggregation',async()=>{
 const customerId=await customerFixture('TEST S05 historische Rechnungen');
 const ids:string[]=[];
 for(let index=0;index<25;index++){
  const order=await intakeOrderFixture('TEST S05 historisch '+index,customerId),id=randomUUID();ids.push(id);
  // Explicit synthetic historical invoice boundary, not an invoice-writer proof.
  // The order uses its real intake command; the read/auth/DB are real.
  await sql`INSERT INTO public.invoices(id,tenant_id,order_id,customer_id,invoice_number,amount_total,status,due_date,gross_amount_cents,payment_contract_version,payment_mode,payment_status,payment_open_amount_cents,payment_paid_amount_cents,payment_currency,payment_version)
   VALUES(${id}::uuid,${tenant},${order.receipt.orderId},${customerId},${'TEST-S05-'+String(index).padStart(3,'0')},119.00,'issued',(statement_timestamp() AT TIME ZONE 'Europe/Berlin')::date-1,11900,1,'rechnung','offen',11900,0,'EUR',0)`;
 }
 const read=async(fixture:typeof full)=>withSession(fixture,async()=>{const auth=await resolveAuthorization();if(!auth.ok)throw Error('TEST_S05_AUTH');return readTodayDashboard(auth.data,getComplaints,getQuoteFollowupsForTodayAction);});
 const first=await read(full),again=await read(full);
 expect(first.moneyMetric).toMatchObject({code:'OK',count:25});
 expect(first.moneyMetric?.code==='OK'?first.moneyMetric.sources.map(row=>row.id).sort():null).toEqual(ids.sort());
 expect(first.items.filter(row=>row.kind==='invoice')).toHaveLength(20);
 expect(again.moneyMetric).toEqual(first.moneyMetric);
 const restricted=await createFixture(['auftraege'],'werkstatt'),hidden=await read(restricted);
 expect(hidden).not.toHaveProperty('moneyMetric');expect(hidden.allowedFields).not.toContain('money');
 expect(hidden.items.some(row=>row.invoiceId||row.kind==='invoice')).toBe(false);
 expect(JSON.stringify(hidden)).not.toContain('119,00');
});
