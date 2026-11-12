// @vitest-environment node
import {it,expect,vi} from 'vitest';
import {randomUUID} from 'node:crypto';
const tenant=vi.hoisted(()=>'TEST-ablauf-'+globalThis.crypto.randomUUID());
vi.mock('@/lib/tenant',()=>({KREILE_TENANT_SLUG:tenant}));
import {sql,full,withSession,createFixture} from '../../../e2e/ablauf/replayHarness';
import {customerFixture,intakeOrderFixture} from '../../../e2e/ablauf/orderFixture';
import {resolveAuthorization} from '@/lib/server/authorization';
import {sql as query} from 'drizzle-orm';
import {withPrivilegedTenantTransaction} from '@/lib/server/privilegedDb';
import {readTodayDashboard,readTodaySource} from '@/lib/server/todayDashboard';
import {setPaymentModeAction} from '@/app/actions/payments.actions';
import {getComplaints} from '@/app/actions/complaints.actions';
import {getQuoteFollowupsForTodayAction} from '@/app/actions/quotes.actions';

it('T05-3 counts all 25 historical invoice fixtures while limiting the list and applying money rights before aggregation',async()=>{
 const customerId=await customerFixture('TEST S05 historische Rechnungen');
 const ids:string[]=[];
 for(let index=0;index<25;index++){
  const order=await intakeOrderFixture('TEST S05 historisch '+index,customerId),id=randomUUID();ids.push(id);
  if(index===24)expect(await withSession(full,()=>setPaymentModeAction({orderId:order.receipt.orderId,paymentMode:'vorkasse',expectedVersion:0,clientEventId:randomUUID()}))).toMatchObject({code:'OK'});
  // Explicit synthetic historical invoice boundary, not an invoice-writer proof.
  // The order uses its real intake command; the read/auth/DB are real.
  await sql`INSERT INTO public.invoices(id,tenant_id,order_id,customer_id,invoice_number,amount_total,status,due_date,gross_amount_cents,payment_contract_version,payment_mode,payment_status,payment_open_amount_cents,payment_paid_amount_cents,payment_currency,payment_version)
   VALUES(${id}::uuid,${tenant},${order.receipt.orderId},${customerId},${'TEST-S05-'+String(index).padStart(3,'0')},119.00,'issued',(statement_timestamp() AT TIME ZONE 'Europe/Berlin')::date-1,11900,1,${index===24?'vorkasse':'rechnung'},'offen',11900,0,'EUR',0)`;
 }
 const read=async(fixture:typeof full)=>withSession(fixture,async()=>{const auth=await resolveAuthorization();if(!auth.ok)throw Error('TEST_S05_AUTH');return readTodayDashboard(auth.data,getComplaints,getQuoteFollowupsForTodayAction);});
 const first=await read(full),again=await read(full);
 expect(first.moneyMetric).toMatchObject({code:'OK',count:25});
 expect(first.moneySources).toEqual({invoices:{code:'OK',count:25},prepayments:{code:'OK',count:0},collections:{code:'OK',count:0}});
 expect(first.moneyMetric?.code==='OK'?first.moneyMetric.sources.map(row=>row.id).sort():null).toEqual(ids.sort());
 expect(first.items.filter(row=>row.kind==='invoice')).toHaveLength(20);
 expect(again.moneyMetric).toEqual(first.moneyMetric);
 const restricted=await createFixture(['auftraege'],'werkstatt'),hidden=await read(restricted);
 expect(hidden).not.toHaveProperty('moneyMetric');expect(hidden).not.toHaveProperty('moneySources');expect(hidden.allowedFields).not.toContain('money');
 expect(hidden.items.some(row=>row.invoiceId||row.kind==='invoice')).toBe(false);
 expect(JSON.stringify(hidden)).not.toContain('119,00');
});

// Explicit native SQL-error boundary, not a simulated product database.
it('keeps the next real daily query readable after a failed source savepoint and after reread',async()=>{
 const customerId=await customerFixture('TEST S05 SQL Fehler');
 const order=await intakeOrderFixture('TEST S05 Ware bleibt',customerId);
 const auth=await withSession(full,()=>resolveAuthorization());if(!auth.ok)throw Error('TEST_S05_AUTH');
 const read=()=>withPrivilegedTenantTransaction(auth.data,async tx=>{
  expect(await readTodaySource(tx,nested=>nested.execute(query`SELECT 1/0 AS fail`))).toEqual({code:'SOURCE_INCOMPLETE'});
  const retained=await readTodaySource(tx,nested=>nested.execute<{id:string}>(query`SELECT id FROM public.orders WHERE tenant_id=${tenant} AND id=${order.receipt.orderId}`));
  expect(retained).toMatchObject({code:'OK',data:[{id:order.receipt.orderId}]});return retained;
 });
 expect(await read()).toEqual(await read());
});
