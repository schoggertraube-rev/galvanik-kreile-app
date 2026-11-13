// @vitest-environment node
// PL A08: isolated TEST data, actual invoice/payment/cancellation Actions/Auth/DB/Storage.
import {randomUUID} from 'node:crypto';
import {beforeAll,expect,it,vi} from 'vitest';
const tenant=vi.hoisted(()=>'TEST-ablauf-'+globalThis.crypto.randomUUID());
vi.mock('@/lib/tenant',()=>({KREILE_TENANT_SLUG:tenant}));
import {KREILE_TENANT_SLUG} from '@/lib/tenant';
import {sql,full,withSession,withRequest,createFixture} from '../../../e2e/ablauf/replayHarness';
import {readyInvoiceOrder,customerFixture} from '../../../e2e/ablauf/orderFixture';
import {confirmPaymentAction,getOrderPaymentStateAction} from '@/app/actions/payments.actions';
import {cancelInvoiceAction,getInvoiceCancellationReceiptAction,getCustomerCreditAction} from '@/app/actions/invoices.actions';
import {getIntakeTaskAction,completeIntakeTaskAction} from '@/app/actions/eingang.actions';

beforeAll(()=>{
 const databaseUrl=process.env.DATABASE_URL;
 if(!databaseUrl||databaseUrl!==process.env.H18_EXPECTED_DATABASE_URL)throw Error('TEST_S08_EXPECTED_DATABASE_URL_REQUIRED');
 expect(new URL(databaseUrl).hostname).toBe('127.0.0.1');
});

it('A08 empty credit is proven zero only for an existing customer and the real money authorization',async()=>{
 const customerId=await customerFixture('S08 empty credit');
 expect(await withSession(full,()=>getCustomerCreditAction(customerId))).toMatchObject({code:'OK',credit:{customerId,balanceCents:0,version:0}});
 expect(await withSession(full,()=>getCustomerCreditAction('TEST-missing-'+randomUUID()))).toMatchObject({code:'NOT_FOUND'});
 const noMoney=await createFixture(['kunden'],'buero');
 const denied=await withSession(noMoney,()=>getCustomerCreditAction(customerId));
 expect(denied).toMatchObject({code:'FORBIDDEN'});expect('credit' in denied).toBe(false);
 expect(await withRequest('',()=>getCustomerCreditAction(customerId))).toMatchObject({code:'UNAUTHENTICATED'});
 expect(await withSession(full,()=>getCustomerCreditAction(customerId))).toMatchObject({code:'OK',credit:{balanceCents:0,version:0}});
});

it.each([4000,0])('A08-2/-6 cancellation retains actual paid %i, removes the active claim and rereads the exact credit',async(amount)=>{
 const order=await readyInvoiceOrder('S08 partial or unpaid '+amount,'pickup',false,undefined,8403);
 if(amount)expect(await withSession(full,()=>confirmPaymentAction({invoiceId:order.invoice.invoiceId,amount,method:'ueberweisung',expectedVersion:0,expectedOpenAmountCents:10000,clientEventId:randomUUID()}))).toMatchObject({code:'OK'});
 const input={invoiceId:order.invoice.invoiceId,expectedVersion:1,reason:'TEST S08 Teilzahlung bleibt erhalten',clientEventId:randomUUID()};
 const noMoney=await createFixture(['kunden'],'buero');
 expect(await withSession(noMoney,()=>cancelInvoiceAction(input))).toMatchObject({code:'FORBIDDEN'});
 expect(await withSession(full,()=>cancelInvoiceAction({...input,reason:''}))).toMatchObject({code:'VALIDATION_ERROR'});
 expect(await sql`SELECT status FROM public.invoices WHERE tenant_id=${KREILE_TENANT_SLUG} AND id=${input.invoiceId}::uuid`).toEqual([{status:'issued'}]);
 expect(await withSession(full,()=>cancelInvoiceAction(input))).toMatchObject({code:'OK'});
 expect(await withSession(full,()=>getCustomerCreditAction(order.customerId))).toMatchObject({code:'OK',credit:{balanceCents:amount,version:amount?1:0}});
 expect(await withSession(full,()=>getOrderPaymentStateAction({orderId:order.orderId}))).toMatchObject({code:'OK',data:{invoiceState:'not_issued',payment:null}});
 expect(await sql`SELECT payment_paid_amount_cents FROM public.invoices WHERE tenant_id=${KREILE_TENANT_SLUG} AND id=${input.invoiceId}::uuid`).toEqual([{payment_paid_amount_cents:amount}]);
 expect(await withSession(full,()=>cancelInvoiceAction(JSON.parse(JSON.stringify(input))))).toMatchObject({code:'OK',replayed:true});
 expect(await withSession(full,()=>getCustomerCreditAction(order.customerId))).toMatchObject({code:'OK',credit:{balanceCents:amount,version:amount?1:0}});
});

it('A08 R2 real credit SQL failure preserves cancellation and one normal task, repaired by its authorized different actor',async()=>{
 const resolver=await createFixture(['entscheiden'],'buero');
 const order=await readyInvoiceOrder('S08 credit SQL follow-up','pickup',false,undefined,8403);
 const paid=await withSession(full,()=>confirmPaymentAction({invoiceId:order.invoice.invoiceId,amount:10000,method:'bar',expectedVersion:0,expectedOpenAmountCents:10000,clientEventId:randomUUID()}));
 expect(paid).toMatchObject({code:'OK'});
 const input={invoiceId:order.invoice.invoiceId,expectedVersion:1,reason:'TEST S08 SQL Folgefehler',clientEventId:randomUUID()};
 const fault='test_s08_credit_'+randomUUID().replaceAll('-','');
 if(!/^[A-Za-z0-9-]+$/.test(KREILE_TENANT_SLUG))throw Error('TEST_TENANT_LITERAL_INVALID');
 await sql.unsafe(`CREATE FUNCTION private.${fault}() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.tenant_id='${KREILE_TENANT_SLUG}' AND NEW.kind='storno_gutschrift' THEN RAISE EXCEPTION 'TEST_S08_CREDIT_SQL_FAILURE' USING ERRCODE='23514'; END IF; RETURN NEW; END $$`);
 await sql.unsafe(`CREATE TRIGGER ${fault} BEFORE INSERT ON public.customer_credit_entries FOR EACH ROW EXECUTE FUNCTION private.${fault}()`);
 let taskId:string,taskVersion:number;
 try{
  expect(await withSession(full,()=>cancelInvoiceAction(input))).toMatchObject({code:'UNAVAILABLE'});
  expect(await sql`SELECT status FROM public.invoices WHERE tenant_id=${KREILE_TENANT_SLUG} AND id=${input.invoiceId}::uuid`).toEqual([{status:'cancelled'}]);
  expect(await sql`SELECT count(*)::int AS n FROM public.customer_credit_entries WHERE tenant_id=${KREILE_TENANT_SLUG} AND invoice_id=${input.invoiceId}::uuid`).toEqual([{n:0}]);
  const tasks=await sql`SELECT id::text,version,client_key::text,status,bezug_id,erstellt_von::text,fuer_bereich FROM public.tasks WHERE tenant_id=${KREILE_TENANT_SLUG} AND client_key=${input.clientEventId}::uuid`;
  expect(tasks).toHaveLength(1);taskId=tasks[0].id;taskVersion=tasks[0].version;
  expect(tasks[0]).toMatchObject({status:'offen',bezug_id:order.orderId,erstellt_von:full.actorId,fuer_bereich:'entscheiden'});
  expect(await withSession(full,()=>getIntakeTaskAction({taskId}))).toMatchObject({code:'OK',task:{id:taskId,status:'offen'},creditSource:'KNOWN',canComplete:true});
  expect(await withSession(full,()=>cancelInvoiceAction(JSON.parse(JSON.stringify(input))))).toMatchObject({code:'UNAVAILABLE'});
  expect(await sql`SELECT count(*)::int AS n FROM public.tasks WHERE tenant_id=${KREILE_TENANT_SLUG} AND client_key=${input.clientEventId}::uuid`).toEqual([{n:1}]);
 }finally{
  await sql.unsafe(`DROP TRIGGER ${fault} ON public.customer_credit_entries`);
  await sql.unsafe(`DROP FUNCTION private.${fault}()`);
 }
 const complete={taskId:taskId!,version:taskVersion!,note:null};
 expect(await withSession(resolver,()=>completeIntakeTaskAction(complete))).toMatchObject({code:'OK',task:{status:'erledigt',erledigt_von:resolver.actorId}});
 expect(await withSession(resolver,()=>completeIntakeTaskAction(JSON.parse(JSON.stringify(complete))))).toMatchObject({code:'OK',replayed:true});
 expect(await sql`SELECT amount_cents::text,actor_user_id::text FROM public.customer_credit_entries WHERE tenant_id=${KREILE_TENANT_SLUG} AND invoice_id=${input.invoiceId}::uuid`).toEqual([{amount_cents:'10000',actor_user_id:full.actorId}]);
 expect(await withSession(full,()=>cancelInvoiceAction(JSON.parse(JSON.stringify(input))))).toMatchObject({code:'OK',replayed:true});
 expect(await sql`SELECT count(*)::int AS n FROM public.customer_credit_entries WHERE tenant_id=${KREILE_TENANT_SLUG} AND invoice_id=${input.invoiceId}::uuid`).toEqual([{n:1}]);
});

it('A08-1 paid invoice cancellation retains actual payment and one customer credit on fresh retry',async()=>{
 const order=await readyInvoiceOrder('S08 paid credit','pickup',false,undefined,8403);
 expect(order.invoice.grossAmountCents).toBe(10000);
 const payment={invoiceId:order.invoice.invoiceId,amount:10000,method:'ueberweisung' as const,expectedVersion:0,expectedOpenAmountCents:10000,clientEventId:randomUUID()};
 const paid=await withSession(full,()=>confirmPaymentAction(payment));
 expect(paid).toMatchObject({code:'OK',receipt:{paidAmountCents:10000,openAmountCents:0}});
 if(paid.code!=='OK')throw Error('TEST_S08_ACTUAL_PAYMENT_REQUIRED');
 const [before]=await sql`SELECT payment_status,payment_paid_amount_cents,payment_open_amount_cents,payment_version,payment_event_id,payment_receipt_id,pdf_sha256 FROM public.invoices WHERE tenant_id=${KREILE_TENANT_SLUG} AND id=${order.invoice.invoiceId}::uuid`;
 const input={invoiceId:order.invoice.invoiceId,expectedVersion:1,reason:'TEST S08 vollständige Stornierung',clientEventId:randomUUID()};
 const cancelled=await withSession(full,()=>cancelInvoiceAction(input));
 expect(cancelled).toMatchObject({code:'OK',receipt:{status:'cancelled',cancelledBy:full.actorId}});
 if(cancelled.code!=='OK')throw Error('TEST_S08_CANCEL_REQUIRED:'+cancelled.code);
 const [after]=await sql`SELECT status,payment_status,payment_paid_amount_cents,payment_open_amount_cents,payment_version,payment_event_id,payment_receipt_id,pdf_sha256 FROM public.invoices WHERE tenant_id=${KREILE_TENANT_SLUG} AND id=${order.invoice.invoiceId}::uuid`;
 expect(after).toEqual({...before,status:'cancelled'});
 expect(await withSession(full,()=>getInvoiceCancellationReceiptAction({invoiceId:order.invoice.invoiceId,clientEventId:input.clientEventId}))).toMatchObject({code:'OK',data:{eventId:cancelled.receipt.eventId}});
 const entries=await sql`SELECT customer_id,kind,amount_cents::text,invoice_id::text,actor_user_id::text,idempotency_key FROM public.customer_credit_entries WHERE tenant_id=${KREILE_TENANT_SLUG} AND customer_id=${order.customerId}`;
 expect(entries).toEqual([{customer_id:order.customerId,kind:'storno_gutschrift',amount_cents:'10000',invoice_id:order.invoice.invoiceId,actor_user_id:full.actorId,idempotency_key:input.clientEventId}]);
 const retry=JSON.parse(JSON.stringify(input));
 expect(await withSession(full,()=>cancelInvoiceAction(retry))).toMatchObject({code:'OK',replayed:true,receipt:{eventId:cancelled.receipt.eventId}});
 expect(await sql`SELECT count(*)::int AS n FROM public.customer_credit_entries WHERE tenant_id=${KREILE_TENANT_SLUG} AND customer_id=${order.customerId}`).toEqual([{n:1}]);
 expect(await sql`SELECT count(*)::int AS n FROM public.events WHERE tenant_id=${KREILE_TENANT_SLUG} AND event_type='PAYMENT_CONFIRMED_V1' AND client_event_id=${payment.clientEventId}::uuid`).toEqual([{n:1}]);
});

it('A08 R2 missing real task-history receipt preserves cancellation, retries the task and later settles one credit',async()=>{
 const order=await readyInvoiceOrder('S08 task receipt missing','pickup',false,undefined,8403);
 expect(await withSession(full,()=>confirmPaymentAction({invoiceId:order.invoice.invoiceId,amount:10000,method:'bar',expectedVersion:0,expectedOpenAmountCents:10000,clientEventId:randomUUID()}))).toMatchObject({code:'OK'});
 const input={invoiceId:order.invoice.invoiceId,expectedVersion:1,reason:'TEST S08 Aufgabenbeleg fehlt',clientEventId:randomUUID()};
 const fault='test_s08_credit_'+randomUUID().replaceAll('-',''),history='test_s08_task_'+randomUUID().replaceAll('-','');
 if(!/^[A-Za-z0-9-]+$/.test(KREILE_TENANT_SLUG))throw Error('TEST_TENANT_LITERAL_INVALID');
 await sql.unsafe(`CREATE FUNCTION private.${fault}() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.tenant_id='${KREILE_TENANT_SLUG}' THEN RAISE EXCEPTION 'TEST_S08_CREDIT_SQL_FAILURE'; END IF; RETURN NEW; END $$`);
 await sql.unsafe(`CREATE TRIGGER ${fault} BEFORE INSERT ON public.customer_credit_entries FOR EACH ROW EXECUTE FUNCTION private.${fault}()`);
 await sql.unsafe(`CREATE FUNCTION private.${history}() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.tenant_id='${KREILE_TENANT_SLUG}' AND NEW.nachher->>'action'='aufgabe.angelegt' THEN RETURN NULL; END IF; RETURN NEW; END $$`);
 await sql.unsafe(`CREATE TRIGGER ${history} BEFORE INSERT ON public.intake_event FOR EACH ROW EXECUTE FUNCTION private.${history}()`);
 try{
  expect(await withSession(full,()=>cancelInvoiceAction(input))).toMatchObject({code:'UNAVAILABLE'});
  expect(await sql`SELECT status FROM public.invoices WHERE tenant_id=${KREILE_TENANT_SLUG} AND id=${input.invoiceId}::uuid`).toEqual([{status:'cancelled'}]);
  expect(await sql`SELECT count(*)::int AS n FROM public.tasks WHERE tenant_id=${KREILE_TENANT_SLUG} AND client_key=${input.clientEventId}::uuid`).toEqual([{n:0}]);
  const original=await withSession(full,()=>getInvoiceCancellationReceiptAction({invoiceId:input.invoiceId,clientEventId:input.clientEventId}));
  expect(original).toMatchObject({code:'OK',data:{invoiceId:input.invoiceId}});
  await sql.unsafe(`DROP TRIGGER ${history} ON public.intake_event`);
  expect(await withSession(full,()=>cancelInvoiceAction(JSON.parse(JSON.stringify(input))))).toMatchObject({code:'UNAVAILABLE'});
  expect(await sql`SELECT count(*)::int AS n FROM public.tasks WHERE tenant_id=${KREILE_TENANT_SLUG} AND client_key=${input.clientEventId}::uuid`).toEqual([{n:1}]);
  await sql.unsafe(`DROP TRIGGER ${fault} ON public.customer_credit_entries`);
  expect(await withSession(full,()=>cancelInvoiceAction(JSON.parse(JSON.stringify(input))))).toMatchObject({code:'OK',replayed:true});
  expect(await sql`SELECT status FROM public.tasks WHERE tenant_id=${KREILE_TENANT_SLUG} AND client_key=${input.clientEventId}::uuid`).toEqual([{status:'erledigt'}]);
  expect(await withSession(full,()=>getInvoiceCancellationReceiptAction({invoiceId:input.invoiceId,clientEventId:input.clientEventId}))).toEqual(original);
  expect(await sql`SELECT count(*)::int AS n FROM public.customer_credit_entries WHERE tenant_id=${KREILE_TENANT_SLUG} AND invoice_id=${input.invoiceId}::uuid`).toEqual([{n:1}]);
 }finally{
  await sql.unsafe(`DROP TRIGGER IF EXISTS ${history} ON public.intake_event`);await sql.unsafe(`DROP FUNCTION private.${history}()`);
  await sql.unsafe(`DROP TRIGGER IF EXISTS ${fault} ON public.customer_credit_entries`);await sql.unsafe(`DROP FUNCTION private.${fault}()`);
 }
});
