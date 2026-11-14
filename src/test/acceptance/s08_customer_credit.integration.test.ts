// @vitest-environment node
// PL A08: isolated TEST data, actual invoice/payment/cancellation Actions/Auth/DB/Storage.
import {randomUUID} from 'node:crypto';
import {sql as statement} from 'drizzle-orm';
import {beforeAll,expect,it,vi} from 'vitest';
const tenant=vi.hoisted(()=>'TEST-ablauf-'+globalThis.crypto.randomUUID());
vi.mock('@/lib/tenant',()=>({KREILE_TENANT_SLUG:tenant}));
import {KREILE_TENANT_SLUG} from '@/lib/tenant';
import {sql,full,withSession,withRequest,createFixture} from '../../../e2e/ablauf/replayHarness';
import {readyInvoiceOrder,customerFixture} from '../../../e2e/ablauf/orderFixture';
import {confirmPaymentAction,getOrderPaymentStateAction} from '@/app/actions/payments.actions';
import {cancelInvoiceAction,getInvoiceCancellationReceiptAction,getCustomerCreditAction,applyCustomerCreditAction} from '@/app/actions/invoices.actions';
import {getIntakeTaskAction,completeIntakeTaskAction} from '@/app/actions/eingang.actions';

beforeAll(()=>{
 const databaseUrl=process.env.DATABASE_URL;
 if(!databaseUrl||databaseUrl!==process.env.H18_EXPECTED_DATABASE_URL)throw Error('TEST_S08_EXPECTED_DATABASE_URL_REQUIRED');
 expect(new URL(databaseUrl).hostname).toBe('127.0.0.1');
});

it('A08 a real SQL failure in the credit subsource preserves the existing invoice read as incomplete, never zero',async()=>{
 const order=await readyInvoiceOrder('S08 real credit read failure','pickup',false,undefined,5042);
 const result=await withSession(full,async()=>{
  const [{resolveAuthorization},{getPaymentState}]=await Promise.all([import('@/lib/server/authorization'),import('@/lib/server/paymentSummaryRead')]);
  const auth=await resolveAuthorization();if(!auth.ok)throw Error('TEST_ACTUAL_CREDIT_READ_AUTH');
  return getPaymentState(auth.data,order.orderId,async tx=>{await tx.execute(statement`SELECT 1/0 AS test_credit_source_unavailable`);throw Error('TEST_SQL_MUST_FAIL');});
 });
 expect(result).toMatchObject({code:'OK',data:{payment:{invoiceId:order.invoice.invoiceId,openAmountCents:6000,paidAmountCents:0},creditApplication:{code:'SOURCE_INCOMPLETE'}}});
 if(result.code!=='OK')throw Error('TEST_MAIN_PAYMENT_READ_LOST');
 expect(result.data.creditApplication).toEqual({code:'SOURCE_INCOMPLETE'});
 expect(await withSession(full,()=>getOrderPaymentStateAction({orderId:order.orderId}))).toMatchObject({code:'OK',data:{creditApplication:{code:'OK',credit:{balanceCents:0,version:0},proposal:null}}});
});

it.each([4000,10000])('A08-3/-4/-5 applies actual credit %i through one payment writer with double-click and fresh retry, not cash income',async(paidAmount)=>{
 const source=await readyInvoiceOrder('S08 application source '+paidAmount,'pickup',false,undefined,8403);
 expect(await withSession(full,()=>confirmPaymentAction({invoiceId:source.invoice.invoiceId,amount:paidAmount,method:'bar',expectedVersion:0,expectedOpenAmountCents:10000,clientEventId:randomUUID()}))).toMatchObject({code:'OK'});
 expect(await withSession(full,()=>cancelInvoiceAction({invoiceId:source.invoice.invoiceId,expectedVersion:1,reason:'TEST S08 Guthaben zur Verrechnung',clientEventId:randomUUID()}))).toMatchObject({code:'OK'});
 const target=await readyInvoiceOrder('S08 application target '+paidAmount,'pickup',false,source.customerId,5042);
 expect(target.invoice.grossAmountCents).toBe(6000);
 expect(await withSession(full,()=>getOrderPaymentStateAction({orderId:target.orderId}))).toMatchObject({code:'OK',data:{payment:{openAmountCents:6000,paidAmountCents:0,paymentVersion:0}}});
 const proposed=await withSession(full,()=>getOrderPaymentStateAction({orderId:target.orderId}));
 if(proposed.code!=='OK'||proposed.data.creditApplication?.code!=='OK'||!proposed.data.creditApplication.proposal)throw Error('TEST_REAL_CREDIT_PROPOSAL_REQUIRED');
 const proposal=proposed.data.creditApplication.proposal;
 expect(proposal).toMatchObject({command:'credit.apply',input:{invoiceId:target.invoice.invoiceId,amount:Math.min(paidAmount,6000),expectedVersion:0,expectedOpenAmountCents:6000,expectedCreditVersion:1}});
 expect(proposal.label).toBe(`Guthaben ${paidAmount===4000?'40,00':'60,00'} € mit Rechnung ${target.invoice.invoiceNumber} verrechnen`);
 const input={...JSON.parse(JSON.stringify(proposal.input)),clientEventId:randomUUID()};
 const {expectedCreditVersion:creditVersion,...ordinaryPayment}=input;
 expect(creditVersion).toBe(1);
 expect(await withSession(full,()=>confirmPaymentAction({...ordinaryPayment,method:'guthaben'}))).toMatchObject({code:'FORBIDDEN'});
 const noMoney=await createFixture(['kunden','auftraege'],'buero');
 const denied=await withSession(noMoney,()=>applyCustomerCreditAction(input));
 expect(denied).toMatchObject({code:'FORBIDDEN'});expect('currentCreditBalanceCents' in denied).toBe(false);
 const hidden=await withSession(noMoney,()=>getOrderPaymentStateAction({orderId:target.orderId}));expect(hidden).toMatchObject({code:'FORBIDDEN'});expect('data'in hidden).toBe(false);
 expect(await withSession(full,()=>getCustomerCreditAction(source.customerId))).toMatchObject({code:'OK',credit:{balanceCents:paidAmount,version:1}});
 const results=await Promise.all([withSession(full,()=>applyCustomerCreditAction(input)),withSession(full,()=>applyCustomerCreditAction(JSON.parse(JSON.stringify(input))))]);
 for(const result of results)expect(result).toMatchObject({code:'OK',receipt:{method:'guthaben',amountCents:input.amount,paidAmountCents:input.amount,openAmountCents:6000-input.amount,creditVersion:1,confirmedBy:full.actorId}});
 expect(results.filter(result=>result.code==='OK'&&!result.replayed)).toHaveLength(1);
 expect(await withSession(full,()=>applyCustomerCreditAction(JSON.parse(JSON.stringify(input))))).toMatchObject({code:'OK',replayed:true});
 expect(await withSession(full,()=>applyCustomerCreditAction({...input,expectedCreditVersion:2}))).toMatchObject({code:'CONFLICT'});
 expect(await withSession(full,()=>getCustomerCreditAction(source.customerId))).toMatchObject({code:'OK',credit:{balanceCents:paidAmount-input.amount,version:2}});
 expect(await withSession(full,()=>getOrderPaymentStateAction({orderId:target.orderId}))).toMatchObject({code:'OK',data:{payment:{method:'guthaben',openAmountCents:6000-input.amount,paidAmountCents:input.amount,paymentVersion:1}}});
 expect(await withSession(full,()=>getOrderPaymentStateAction({orderId:target.orderId}))).toMatchObject({code:'OK',data:{creditApplication:{code:'OK',proposal:null}}});
 expect(await sql`SELECT count(*)::int AS n FROM public.events WHERE tenant_id=${KREILE_TENANT_SLUG} AND event_type='PAYMENT_CONFIRMED_V1' AND client_event_id=${input.clientEventId}::uuid`).toEqual([{n:1}]);
 expect(await sql`SELECT amount_cents::text,actor_user_id::text FROM public.customer_credit_entries WHERE tenant_id=${KREILE_TENANT_SLUG} AND kind='verrechnung' AND invoice_id=${input.invoiceId}::uuid`).toEqual([{amount_cents:String(-input.amount),actor_user_id:full.actorId}]);
 expect(await sql`SELECT count(*)::int AS n FROM public.payments WHERE tenant_id=${KREILE_TENANT_SLUG} AND invoice_id=${input.invoiceId}::uuid`).toEqual([{n:0}]);
});

it('A08-9 rejects a stale invoice with the actual zero remainder without consuming customer credit',async()=>{
 const source=await readyInvoiceOrder('S08 stale credit source','pickup',false,undefined,8403);
 expect(await withSession(full,()=>confirmPaymentAction({invoiceId:source.invoice.invoiceId,amount:4000,method:'bar',expectedVersion:0,expectedOpenAmountCents:10000,clientEventId:randomUUID()}))).toMatchObject({code:'OK'});
 expect(await withSession(full,()=>cancelInvoiceAction({invoiceId:source.invoice.invoiceId,expectedVersion:1,reason:'TEST S08 stale invoice credit',clientEventId:randomUUID()}))).toMatchObject({code:'OK'});
 const target=await readyInvoiceOrder('S08 stale credit target','pickup',false,source.customerId,5042);
 const input={invoiceId:target.invoice.invoiceId,amount:4000,expectedVersion:0,expectedOpenAmountCents:6000,expectedCreditVersion:1,clientEventId:randomUUID()};
 expect(await withSession(full,()=>getOrderPaymentStateAction({orderId:target.orderId}))).toMatchObject({code:'OK',data:{creditApplication:{code:'OK',proposal:{command:'credit.apply',input:{expectedOpenAmountCents:6000}}}}});
 expect(await withSession(full,()=>confirmPaymentAction({invoiceId:target.invoice.invoiceId,amount:6000,method:'ueberweisung',expectedVersion:0,expectedOpenAmountCents:6000,clientEventId:randomUUID()}))).toMatchObject({code:'OK'});
 expect(await withSession(full,()=>getOrderPaymentStateAction({orderId:target.orderId}))).toMatchObject({code:'OK',data:{creditApplication:{code:'OK',proposal:null}}});
 expect(await withSession(full,()=>applyCustomerCreditAction(input))).toMatchObject({code:'CONFLICT',currentOpenAmountCents:0});
 expect(await withSession(full,()=>applyCustomerCreditAction(JSON.parse(JSON.stringify(input))))).toMatchObject({code:'CONFLICT',currentOpenAmountCents:0});
 expect(await withSession(full,()=>getCustomerCreditAction(source.customerId))).toMatchObject({code:'OK',credit:{balanceCents:4000,version:1}});
 expect(await sql`SELECT count(*)::int AS n FROM public.events WHERE tenant_id=${KREILE_TENANT_SLUG} AND client_event_id=${input.clientEventId}::uuid`).toEqual([{n:0}]);
 expect(await sql`SELECT count(*)::int AS n FROM public.customer_credit_entries WHERE tenant_id=${KREILE_TENANT_SLUG} AND invoice_id=${target.invoice.invoiceId}::uuid`).toEqual([{n:0}]);
});

it('A08 application rolls debit and payment back when the actual payment receipt is suppressed, then retries one effect',async()=>{
 const source=await readyInvoiceOrder('S08 atomic credit source','pickup',false,undefined,8403);
 expect(await withSession(full,()=>confirmPaymentAction({invoiceId:source.invoice.invoiceId,amount:4000,method:'bar',expectedVersion:0,expectedOpenAmountCents:10000,clientEventId:randomUUID()}))).toMatchObject({code:'OK'});
 expect(await withSession(full,()=>cancelInvoiceAction({invoiceId:source.invoice.invoiceId,expectedVersion:1,reason:'TEST S08 missing payment receipt',clientEventId:randomUUID()}))).toMatchObject({code:'OK'});
 const target=await readyInvoiceOrder('S08 atomic credit target','pickup',false,source.customerId,5042);
 const input={invoiceId:target.invoice.invoiceId,amount:4000,expectedVersion:0,expectedOpenAmountCents:6000,expectedCreditVersion:1,clientEventId:randomUUID()};
 const fault='test_s08_apply_'+randomUUID().replaceAll('-','');
 if(!/^[A-Za-z0-9-]+$/.test(KREILE_TENANT_SLUG))throw Error('TEST_TENANT_LITERAL_INVALID');
 await sql.unsafe(`CREATE FUNCTION private.${fault}() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.tenant_id='${KREILE_TENANT_SLUG}' AND NEW.event_type='PAYMENT_CONFIRMED_V1' AND NEW.client_event_id='${input.clientEventId}'::uuid THEN RETURN NULL; END IF; RETURN NEW; END $$`);
 await sql.unsafe(`CREATE TRIGGER ${fault} BEFORE INSERT ON public.events FOR EACH ROW EXECUTE FUNCTION private.${fault}()`);
 try{
  expect(await withSession(full,()=>applyCustomerCreditAction(input))).toMatchObject({code:'UNAVAILABLE'});
  expect(await withSession(full,()=>getCustomerCreditAction(source.customerId))).toMatchObject({code:'OK',credit:{balanceCents:4000,version:1}});
  expect(await withSession(full,()=>getOrderPaymentStateAction({orderId:target.orderId}))).toMatchObject({code:'OK',data:{payment:{openAmountCents:6000,paidAmountCents:0,paymentVersion:0}}});
  expect(await sql`SELECT count(*)::int AS n FROM public.customer_credit_entries WHERE tenant_id=${KREILE_TENANT_SLUG} AND invoice_id=${target.invoice.invoiceId}::uuid`).toEqual([{n:0}]);
 }finally{
  await sql.unsafe(`DROP TRIGGER ${fault} ON public.events`);await sql.unsafe(`DROP FUNCTION private.${fault}()`);
 }
 expect(await withSession(full,()=>applyCustomerCreditAction(JSON.parse(JSON.stringify(input))))).toMatchObject({code:'OK',replayed:false});
 expect(await withSession(full,()=>applyCustomerCreditAction(JSON.parse(JSON.stringify(input))))).toMatchObject({code:'OK',replayed:true});
 expect(await withSession(full,()=>getCustomerCreditAction(source.customerId))).toMatchObject({code:'OK',credit:{balanceCents:0,version:2}});
 expect(await sql`SELECT count(*)::int AS n FROM public.events WHERE tenant_id=${KREILE_TENANT_SLUG} AND client_event_id=${input.clientEventId}::uuid`).toEqual([{n:1}]);
});

it('A08 two actual invoices with distinct N5 keys cannot overdraw the same customer credit',async()=>{
 const source=await readyInvoiceOrder('S08 parallel credit source','pickup',false,undefined,8403);
 expect(await withSession(full,()=>confirmPaymentAction({invoiceId:source.invoice.invoiceId,amount:4000,method:'bar',expectedVersion:0,expectedOpenAmountCents:10000,clientEventId:randomUUID()}))).toMatchObject({code:'OK'});
 expect(await withSession(full,()=>cancelInvoiceAction({invoiceId:source.invoice.invoiceId,expectedVersion:1,reason:'TEST S08 shared credit lock',clientEventId:randomUUID()}))).toMatchObject({code:'OK'});
 const targets=[await readyInvoiceOrder('S08 parallel credit target A','pickup',false,source.customerId,5042),await readyInvoiceOrder('S08 parallel credit target B','pickup',false,source.customerId,5042)];
 const requests=targets.map(target=>({invoiceId:target.invoice.invoiceId,amount:4000,expectedVersion:0,expectedOpenAmountCents:6000,expectedCreditVersion:1,clientEventId:randomUUID()}));
 expect(await withSession(full,()=>applyCustomerCreditAction({...requests[0],amount:5000,clientEventId:randomUUID()}))).toMatchObject({code:'CONFLICT',currentCreditBalanceCents:4000});
 const results=await Promise.all(requests.map(request=>withSession(full,()=>applyCustomerCreditAction(request))));
 expect(results.map(result=>result.code).sort()).toEqual(['CONFLICT','OK']);
 const winning=results.findIndex(result=>result.code==='OK');
 expect(await withSession(full,()=>applyCustomerCreditAction(JSON.parse(JSON.stringify(requests[winning]))))).toMatchObject({code:'OK',replayed:true});
 expect(await withSession(full,()=>getCustomerCreditAction(source.customerId))).toMatchObject({code:'OK',credit:{balanceCents:0,version:2}});
 for(let index=0;index<targets.length;index++)expect(await withSession(full,()=>getOrderPaymentStateAction({orderId:targets[index].orderId}))).toMatchObject({code:'OK',data:{payment:{openAmountCents:index===winning?2000:6000,paidAmountCents:index===winning?4000:0}}});
 expect(await sql`SELECT count(*)::int AS n FROM public.customer_credit_entries WHERE tenant_id=${KREILE_TENANT_SLUG} AND customer_id=${source.customerId} AND kind='verrechnung'`).toEqual([{n:1}]);
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
 const resolver=await createFixture(['geld'],'buero'),originalActor=await createFixture(['entscheiden','geld'],'buero');
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
  expect(await withSession(originalActor,()=>cancelInvoiceAction(input))).toMatchObject({code:'UNAVAILABLE'});
  expect(await sql`SELECT status FROM public.invoices WHERE tenant_id=${KREILE_TENANT_SLUG} AND id=${input.invoiceId}::uuid`).toEqual([{status:'cancelled'}]);
  expect(await sql`SELECT count(*)::int AS n FROM public.customer_credit_entries WHERE tenant_id=${KREILE_TENANT_SLUG} AND invoice_id=${input.invoiceId}::uuid`).toEqual([{n:0}]);
  const tasks=await sql`SELECT id::text,version,client_key::text,status,bezug_id,erstellt_von::text,fuer_bereich FROM public.tasks WHERE tenant_id=${KREILE_TENANT_SLUG} AND client_key=${input.clientEventId}::uuid`;
  expect(tasks).toHaveLength(1);taskId=tasks[0].id;taskVersion=tasks[0].version;
  expect(tasks[0]).toMatchObject({status:'offen',bezug_id:order.orderId,erstellt_von:originalActor.actorId,fuer_bereich:'geld'});
  expect(await withSession(full,()=>getIntakeTaskAction({taskId}))).toMatchObject({code:'OK',task:{id:taskId,status:'offen'},creditSource:'KNOWN',canComplete:true});
  expect(await withSession(originalActor,()=>cancelInvoiceAction(JSON.parse(JSON.stringify(input))))).toMatchObject({code:'UNAVAILABLE'});
  expect(await sql`SELECT count(*)::int AS n FROM public.tasks WHERE tenant_id=${KREILE_TENANT_SLUG} AND client_key=${input.clientEventId}::uuid`).toEqual([{n:1}]);
 }finally{
  await sql.unsafe(`DROP TRIGGER ${fault} ON public.customer_credit_entries`);
  await sql.unsafe(`DROP FUNCTION private.${fault}()`);
 }
  const complete={taskId:taskId!,version:taskVersion!,note:null};
 await sql`DELETE FROM public.app_user_rights WHERE tenant_id=${KREILE_TENANT_SLUG} AND user_id=${originalActor.actorId}::uuid AND bereich='geld'`;
 expect(await withSession(originalActor,()=>getIntakeTaskAction({taskId:taskId!}))).toMatchObject({code:'OK',canComplete:false});
 expect(await withSession(originalActor,()=>completeIntakeTaskAction(complete))).toMatchObject({code:'FORBIDDEN'});
 expect(await sql`SELECT id FROM public.customer_credit_entries WHERE tenant_id=${KREILE_TENANT_SLUG} AND invoice_id=${input.invoiceId}::uuid`).toEqual([]);
 expect(await withSession(resolver,()=>completeIntakeTaskAction(complete))).toMatchObject({code:'OK',task:{status:'erledigt',erledigt_von:resolver.actorId}});
 expect(await withSession(resolver,()=>completeIntakeTaskAction(JSON.parse(JSON.stringify(complete))))).toMatchObject({code:'OK',replayed:true});
 expect(await sql`SELECT amount_cents::text,actor_user_id::text FROM public.customer_credit_entries WHERE tenant_id=${KREILE_TENANT_SLUG} AND invoice_id=${input.invoiceId}::uuid`).toEqual([{amount_cents:'10000',actor_user_id:originalActor.actorId}]);
 expect(await withSession(originalActor,()=>cancelInvoiceAction(JSON.parse(JSON.stringify(input))))).toMatchObject({code:'FORBIDDEN'});
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
