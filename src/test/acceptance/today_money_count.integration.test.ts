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
import {changeOrderPromisedDueDateAction} from '@/app/actions/orders.actions';
import {setPaymentModeAction} from '@/app/actions/payments.actions';
import {getComplaints} from '@/app/actions/complaints.actions';
import {getQuoteFollowupsForTodayAction} from '@/app/actions/quotes.actions';

it('W-TAG T05-3 counts all 25 historical invoice fixtures while limiting the list and applying money rights before aggregation',async()=>{
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
 // Additional explicit historical fixtures: future receivables must count as
 // open money while staying out of the overdue metric/challenges.
 for(const days of [7,8]){
  const order=await intakeOrderFixture('TEST S05 kommende Rechnung '+days,customerId),id=randomUUID();
  await sql`INSERT INTO public.invoices(id,tenant_id,order_id,customer_id,invoice_number,amount_total,status,due_date,gross_amount_cents,payment_contract_version,payment_mode,payment_status,payment_open_amount_cents,payment_paid_amount_cents,payment_currency,payment_version)
   VALUES(${id}::uuid,${tenant},${order.receipt.orderId},${customerId},${'TEST-S05-FUTURE-'+days},30.00,'issued',(statement_timestamp() AT TIME ZONE 'Europe/Berlin')::date+${days}::integer,3000,1,'rechnung','offen',3000,0,'EUR',0)`;
 }
 const read=async(fixture:typeof full)=>withSession(fixture,async()=>{const auth=await resolveAuthorization();if(!auth.ok)throw Error('TEST_S05_AUTH');return readTodayDashboard(auth.data,getComplaints,getQuoteFollowupsForTodayAction);});
 const first=await read(full),again=await read(full);
 const [serverDay]=await sql`SELECT (statement_timestamp() AT TIME ZONE 'Europe/Berlin')::date::text AS today`;expect(first.calendar?.today).toBe(serverDay.today);expect(Number.isFinite(Date.parse(first.calendar?.readStartedAt??''))).toBe(true);
 expect(first.moneyMetric).toMatchObject({code:'OK',count:24});
 expect(first.invoiceMoney).toMatchObject({code:'OK',openCount:27,openCents:303500,overdueCount:24,overdueCents:285600,today:24,upcoming:1});
 expect(again.invoiceMoney).toEqual(first.invoiceMoney);
 expect(first.moneySources).toEqual({invoices:{code:'OK',count:27},prepayments:{code:'OK',count:0},collections:{code:'OK',count:0}});
 expect(first.moneyMetric?.code==='OK'?first.moneyMetric.sources.map(row=>row.id).sort():null).toEqual(ids.slice(0,24).sort());
 expect(first.items.filter(row=>row.kind==='invoice')).toHaveLength(20);
 expect(again.moneyMetric).toEqual(first.moneyMetric);
 const restricted=await createFixture(['auftraege'],'werkstatt'),hidden=await read(restricted);
 expect(hidden).not.toHaveProperty('invoiceMoney');expect(hidden).not.toHaveProperty('moneyMetric');expect(hidden).not.toHaveProperty('moneySources');expect(hidden.allowedFields).not.toContain('money');
 expect(hidden.items.some(row=>row.invoiceId||row.kind==='invoice')).toBe(false);
 expect(JSON.stringify(hidden)).not.toContain('119,00');expect(JSON.stringify(hidden.challenges)).not.toContain('day.challenge_debt');
});

// Explicit native SQL-error boundary, not a simulated product database.
it('W-TAG keeps the next real daily query readable after a failed source savepoint and after reread',async()=>{
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

it('W-TAG T05-6 combines a real overdue order and an explicit historical invoice fixture in one source-bound challenge',async()=>{
 const customerId=await customerFixture('TEST S05 Doppelgrund'),order=await intakeOrderFixture('TEST S05 Doppelgrund',customerId);
 const [clock]=await sql`SELECT ((statement_timestamp() AT TIME ZONE 'Europe/Berlin')::date-1)::text AS yesterday`;
 expect(await withSession(full,()=>changeOrderPromisedDueDateAction({orderId:order.receipt.orderId,expectedVersion:1,dueDate:clock.yesterday,reason:'TEST dokumentierter historischer Termin',clientEventId:randomUUID()}))).toMatchObject({code:'OK'});
 const invoiceId=randomUUID();
 // Explicit synthetic historical invoice, never an invoice-writer proof.
 await sql`INSERT INTO public.invoices(id,tenant_id,order_id,customer_id,invoice_number,amount_total,status,due_date,gross_amount_cents,payment_contract_version,payment_mode,payment_status,payment_open_amount_cents,payment_paid_amount_cents,payment_currency,payment_version)
 VALUES(${invoiceId}::uuid,${tenant},${order.receipt.orderId},${customerId},${'TEST-S05-LATE-'+invoiceId},119,'issued',${clock.yesterday}::date,11900,1,'rechnung','offen',11900,0,'EUR',0)`;
 const read=()=>withSession(full,async()=>{const auth=await resolveAuthorization();if(!auth.ok)throw Error('TEST_S05_AUTH');return readTodayDashboard(auth.data,getComplaints,getQuoteFollowupsForTodayAction);});
 const first=await read(),groups=first.challenges?.groups.filter(row=>row.orderId===order.receipt.orderId);
 expect(groups).toHaveLength(1);expect(groups?.[0].reasons.map(reason=>reason.textKey)).toEqual(['day.challenge_late','day.challenge_debt']);
 expect(groups?.[0].action).toBeNull();expect(first.challenges?.missing).toContain('CHALLENGE_PAYMENT_ACTION:'+invoiceId);
 expect((await read()).challenges?.groups.filter(row=>row.orderId===order.receipt.orderId)).toEqual(groups);
});
