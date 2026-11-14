// @vitest-environment node
// PL14Nov08:45: real cancellation/credit/reissue/TaskWriter Actions/Auth/DB/Storage.
import {randomUUID} from 'node:crypto';
import {beforeAll,expect,it,vi} from 'vitest';
const tenant=vi.hoisted(()=>'TEST-ablauf-'+globalThis.crypto.randomUUID());
vi.mock('@/lib/tenant',()=>({KREILE_TENANT_SLUG:tenant}));
import {sql,full,withSession,createFixture} from '../../../e2e/ablauf/replayHarness';
import {readyInvoiceOrder} from '../../../e2e/ablauf/orderFixture';
import {changeOrderPickupNoticeAction} from '@/app/actions/orders.actions';
import {cancelInvoiceAction,getCustomerCreditAction,getInvoiceCancellationReceiptAction} from '@/app/actions/invoices.actions';
import {confirmPaymentAction} from '@/app/actions/payments.actions';
import {getIntakeTaskAction,completeIntakeTaskAction} from '@/app/actions/eingang.actions';
import {offlinePartition} from '@/lib/server/offlinePartition';
import {replayOfflineWorkshopAction} from '@/app/actions/offlineWorkshop.actions';
import {isPendingWorkshopAcknowledgement} from '@/lib/offline/pendingStore';
import {SHIPPING_FEE_COPY,CUSTOMER_CREDIT_COPY} from '@/ui/situationCatalog';
beforeAll(()=>{const u=process.env.DATABASE_URL;if(!u||u!==process.env.H18_EXPECTED_DATABASE_URL||new URL(u).hostname!=='127.0.0.1')throw Error('TEST_S09_LOOPBACK_REQUIRED');});
async function source(title:string,paid=true){
 const order=await readyInvoiceOrder(title,'shipping',false,undefined,10000);
 if(paid)expect(await withSession(full,()=>confirmPaymentAction({invoiceId:order.invoice.invoiceId,amount:order.invoice.grossAmountCents,expectedVersion:0,expectedOpenAmountCents:order.invoice.grossAmountCents,method:'ueberweisung',clientEventId:randomUUID()}))).toMatchObject({code:'OK'});
 const manual=await withSession(full,()=>changeOrderPickupNoticeAction({command:'handover_manual',orderId:order.orderId,expectedVersion:order.version,handoverMode:'pickup',clientEventId:randomUUID()}));
 expect(manual).toMatchObject({code:'OK',receipt:{handoverMode:'pickup',outcome:'changed'}});
 if(manual.code!=='OK'||!manual.receipt||typeof manual.receipt!=='object'||!('eventId'in manual.receipt)||typeof manual.receipt.eventId!=='string')throw Error('TEST_MANUAL_PICKUP_REQUIRED');
 const [original]=await sql`SELECT snapshot,pdf_content,pdf_sha256 FROM public.invoices WHERE tenant_id=${tenant} AND id=${order.invoice.invoiceId}::uuid`;
 const input={invoiceId:order.invoice.invoiceId,expectedVersion:1,reason:'Übergabeart Versand → Abholung',clientEventId:randomUUID(),reissueWithoutShipping:{handoverEventId:manual.receipt.eventId,replacementClientEventId:randomUUID()}};
 return {order,original,input};
}

it('A09-7/-8 preserves the immutable original, cancels once and reissues the original goods without shipping, fully open with credit kept separate',async()=>{
 const {order,original,input}=await source('TEST S09 real no-shipping reissue');
 const result=await withSession(full,()=>cancelInvoiceAction(input));
 expect(result).toMatchObject({code:'OK',receipt:{invoiceId:order.invoice.invoiceId,status:'cancelled'},replacementReceipt:{status:'issued',netAmountCents:10000,grossAmountCents:11900}});
 const rows=await sql`SELECT id::text,status,snapshot,pdf_sha256,payment_open_amount_cents,payment_paid_amount_cents,issued_by::text,client_event_id::text FROM public.invoices WHERE tenant_id=${tenant} AND order_id=${order.orderId} ORDER BY invoice_number`;
 expect(rows).toHaveLength(2);expect(rows[0]).toMatchObject({id:order.invoice.invoiceId,status:'cancelled',snapshot:original.snapshot,pdf_sha256:original.pdf_sha256});
 expect(rows[1]).toMatchObject({status:'issued',payment_open_amount_cents:11900,payment_paid_amount_cents:0,issued_by:full.actorId,client_event_id:input.reissueWithoutShipping.replacementClientEventId});
 expect(rows[1].snapshot.lines).toEqual(original.snapshot.lines.filter((line:{type:string})=>line.type!=='SHIPPING'));
 expect(rows[1].snapshot.seller).toEqual(original.snapshot.seller);expect(rows[1].snapshot.customer).toEqual(original.snapshot.customer);
 expect(rows[1].snapshot.paymentTermDays).toBe(original.snapshot.paymentTermDays);expect(rows[1].snapshot.serviceDate).toBe(original.snapshot.serviceDate);
 expect(await withSession(full,()=>getCustomerCreditAction(order.customerId))).toMatchObject({code:'OK',credit:{balanceCents:order.invoice.grossAmountCents}});
 expect(await withSession(full,()=>cancelInvoiceAction(JSON.parse(JSON.stringify(input))))).toEqual({...result,replayed:true});
 expect(await withSession(full,()=>cancelInvoiceAction({...input,reissueWithoutShipping:{...input.reissueWithoutShipping,replacementClientEventId:randomUUID()}}))).toMatchObject({code:'CONFLICT'});
 expect(await sql`SELECT pdf_content,pdf_sha256 FROM public.invoices WHERE tenant_id=${tenant} AND id=${order.invoice.invoiceId}::uuid`).toEqual([{pdf_content:original.pdf_content,pdf_sha256:original.pdf_sha256}]);
});

it('A09-7 R2 real replacement SQL failure preserves cancellation and credit, then a second money-only login repairs one invoice through the same normal task',async()=>{
 const {order,input}=await source('TEST S09 reissue SQL failure');
 await createFixture(['entscheiden'],'buero');
 const repair=await createFixture(['geld'],'buero'),noMoney=await createFixture(['auftraege'],'werkstatt');
 const fault='test_s09_reissue_'+randomUUID().replaceAll('-','');
 await sql.unsafe(`CREATE FUNCTION private.${fault}() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.tenant_id='${tenant}' AND NEW.client_event_id='${input.reissueWithoutShipping.replacementClientEventId}'::uuid THEN PERFORM 1/0; END IF; RETURN NEW; END $$`);
 await sql.unsafe(`CREATE TRIGGER ${fault} BEFORE INSERT ON public.invoices FOR EACH ROW EXECUTE FUNCTION private.${fault}()`);
 try{
  expect(await withSession(full,()=>cancelInvoiceAction(input))).toMatchObject({code:'UNAVAILABLE'});
  expect(await sql`SELECT status FROM public.invoices WHERE tenant_id=${tenant} AND id=${order.invoice.invoiceId}::uuid`).toEqual([{status:'cancelled'}]);
  expect(await withSession(full,()=>getCustomerCreditAction(order.customerId))).toMatchObject({code:'OK',credit:{balanceCents:order.invoice.grossAmountCents}});
 }finally{await sql.unsafe(`DROP TRIGGER ${fault} ON public.invoices`);await sql.unsafe(`DROP FUNCTION private.${fault}()`);}
 const tasks=await sql`SELECT id::text,status,version,fuer_bereich FROM public.tasks WHERE tenant_id=${tenant} AND client_key=${input.clientEventId}::uuid`;
 expect(tasks).toHaveLength(1);expect(tasks[0]).toMatchObject({status:'offen',fuer_bereich:'entscheiden'});
 const completion={taskId:tasks[0].id,version:tasks[0].version,note:null};
 expect(await withSession(noMoney,()=>completeIntakeTaskAction(completion))).toMatchObject({code:'FORBIDDEN'});
 expect(await withSession(noMoney,()=>cancelInvoiceAction(JSON.parse(JSON.stringify(input))))).toMatchObject({code:'FORBIDDEN'});
 expect(await withSession(repair,()=>getIntakeTaskAction({taskId:tasks[0].id}))).toMatchObject({code:'OK',canComplete:true});
 expect(await withSession(repair,()=>completeIntakeTaskAction(completion))).toMatchObject({code:'OK',task:{status:'erledigt',erledigt_von:repair.actorId}});
 expect(await withSession(repair,()=>completeIntakeTaskAction(JSON.parse(JSON.stringify(completion))))).toMatchObject({code:'OK',replayed:true});
 expect(await sql`SELECT count(*)::int AS n FROM public.invoices WHERE tenant_id=${tenant} AND order_id=${order.orderId}`).toEqual([{n:2}]);
 expect(await sql`SELECT issued_by::text,payment_open_amount_cents,payment_paid_amount_cents FROM public.invoices WHERE tenant_id=${tenant} AND client_event_id=${input.reissueWithoutShipping.replacementClientEventId}::uuid`).toEqual([{issued_by:repair.actorId,payment_open_amount_cents:11900,payment_paid_amount_cents:0}]);
 expect(await withSession(full,()=>cancelInvoiceAction(JSON.parse(JSON.stringify(input))))).toMatchObject({code:'OK',replayed:true,replacementReceipt:{issuedBy:repair.actorId}});
 expect(await sql`SELECT count(*)::int AS n,sum(amount_cents)::int AS total FROM public.customer_credit_entries WHERE tenant_id=${tenant} AND invoice_id=${order.invoice.invoiceId}::uuid`).toEqual([{n:1,total:order.invoice.grossAmountCents}]);
});

it('A09-8 rejects a real foreign-order pickup source without partial effects, then two parallel confirmations share one immutable compound receipt',async()=>{
 const a=await source('TEST S09 parallel original'),b=await source('TEST S09 foreign source');
 expect(await withSession(full,()=>cancelInvoiceAction({...a.input,reissueWithoutShipping:{...a.input.reissueWithoutShipping,handoverEventId:b.input.reissueWithoutShipping.handoverEventId}}))).toMatchObject({code:'CONFLICT'});
 expect(await sql`SELECT status FROM public.invoices WHERE tenant_id=${tenant} AND id=${a.order.invoice.invoiceId}::uuid`).toEqual([{status:'issued'}]);
 const results=await Promise.all([a.input,JSON.parse(JSON.stringify(a.input))].map(input=>withSession(full,()=>cancelInvoiceAction(input))));
 expect(results.map(result=>result.code)).toEqual(['OK','OK']);expect(results.map(result=>result.code==='OK'?result.replayed:null).sort()).toEqual([false,true]);
 expect(await sql`SELECT count(*)::int AS n FROM public.invoices WHERE tenant_id=${tenant} AND order_id=${a.order.orderId}`).toEqual([{n:2}]);
 const read=await withSession(full,()=>getInvoiceCancellationReceiptAction({invoiceId:a.input.invoiceId,clientEventId:a.input.clientEventId}));
 expect(read).toMatchObject({code:'OK',data:{reissueWithoutShipping:{...a.input.reissueWithoutShipping,confirmedBy:full.actorId,originalPdfSha256:a.original.pdf_sha256}}});
 await expect(sql`UPDATE public.events SET payload=jsonb_set(payload,'{reissue,confirmedBy}',to_jsonb(${b.order.orderId}::text)) WHERE tenant_id=${tenant} AND client_event_id=${a.input.clientEventId}::uuid`).rejects.toBeTruthy();
 expect(await withSession(full,()=>getInvoiceCancellationReceiptAction({invoiceId:a.input.invoiceId,clientEventId:a.input.clientEventId}))).toEqual(read);
});

it('A09-7 R2 missing real task-history proof never acknowledges the cancellation intent; same-key retry restores one task then one replacement',async()=>{
 const {order,input}=await source('TEST S09 missing reissue task proof');
 const fault='test_s09_reissue_'+randomUUID().replaceAll('-',''),history='test_s09_history_'+randomUUID().replaceAll('-','');
 await sql.unsafe(`CREATE FUNCTION private.${fault}() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.tenant_id='${tenant}' AND NEW.client_event_id='${input.reissueWithoutShipping.replacementClientEventId}'::uuid THEN PERFORM 1/0; END IF; RETURN NEW; END $$`);
 await sql.unsafe(`CREATE TRIGGER ${fault} BEFORE INSERT ON public.invoices FOR EACH ROW EXECUTE FUNCTION private.${fault}()`);
 await sql.unsafe(`CREATE FUNCTION private.${history}() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.tenant_id='${tenant}' AND NEW.nachher->>'action'='aufgabe.angelegt' THEN RETURN NULL; END IF; RETURN NEW; END $$`);
 await sql.unsafe(`CREATE TRIGGER ${history} BEFORE INSERT ON public.intake_event FOR EACH ROW EXECUTE FUNCTION private.${history}()`);
 try{
  expect(await withSession(full,()=>cancelInvoiceAction(input))).toMatchObject({code:'UNAVAILABLE',message:SHIPPING_FEE_COPY.reissueTaskPending});
  expect(await sql`SELECT status FROM public.invoices WHERE tenant_id=${tenant} AND id=${order.invoice.invoiceId}::uuid`).toEqual([{status:'cancelled'}]);
  expect(await sql`SELECT count(*)::int AS n FROM public.tasks WHERE tenant_id=${tenant} AND client_key=${input.clientEventId}::uuid`).toEqual([{n:0}]);
  expect(await withSession(full,()=>getCustomerCreditAction(order.customerId))).toMatchObject({code:'OK',credit:{balanceCents:order.invoice.grossAmountCents}});
  await sql.unsafe(`DROP TRIGGER ${history} ON public.intake_event`);
  expect(await withSession(full,()=>cancelInvoiceAction(JSON.parse(JSON.stringify(input))))).toMatchObject({code:'UNAVAILABLE',message:SHIPPING_FEE_COPY.reissuePending});
  expect(await sql`SELECT count(*)::int AS n FROM public.tasks WHERE tenant_id=${tenant} AND client_key=${input.clientEventId}::uuid`).toEqual([{n:1}]);
  await sql.unsafe(`DROP TRIGGER ${fault} ON public.invoices`);
  expect(await withSession(full,()=>cancelInvoiceAction(JSON.parse(JSON.stringify(input))))).toMatchObject({code:'OK',replayed:true,replacementReceipt:{netAmountCents:10000}});
  expect(await sql`SELECT status FROM public.tasks WHERE tenant_id=${tenant} AND client_key=${input.clientEventId}::uuid`).toEqual([{status:'erledigt'}]);
 }finally{await sql.unsafe(`DROP TRIGGER IF EXISTS ${history} ON public.intake_event`);await sql.unsafe(`DROP FUNCTION private.${history}()`);await sql.unsafe(`DROP TRIGGER IF EXISTS ${fault} ON public.invoices`);await sql.unsafe(`DROP FUNCTION private.${fault}()`);}
});

it('A09-7 a real credit SQL failure never claims credit already exists; another money actor repairs the same original and actual task',async()=>{
 const {order,input}=await source('TEST S09 actual credit pending');
 const fault='test_s09_credit_'+randomUUID().replaceAll('-','');
 await sql.unsafe(`CREATE FUNCTION private.${fault}() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.tenant_id='${tenant}' AND NEW.invoice_id='${input.invoiceId}'::uuid THEN PERFORM 1/0; END IF; RETURN NEW; END $$`);
 await sql.unsafe(`CREATE TRIGGER ${fault} BEFORE INSERT ON public.customer_credit_entries FOR EACH ROW EXECUTE FUNCTION private.${fault}()`);
 try{
  expect(await withSession(full,()=>cancelInvoiceAction(input))).toMatchObject({code:'UNAVAILABLE',message:CUSTOMER_CREDIT_COPY.pending});
  expect(await sql`SELECT status FROM public.invoices WHERE tenant_id=${tenant} AND id=${input.invoiceId}::uuid`).toEqual([{status:'cancelled'}]);
  expect(await sql`SELECT count(*)::int AS n FROM public.customer_credit_entries WHERE tenant_id=${tenant} AND invoice_id=${input.invoiceId}::uuid`).toEqual([{n:0}]);
  expect(await sql`SELECT count(*)::int AS n FROM public.tasks WHERE tenant_id=${tenant} AND client_key=${input.clientEventId}::uuid`).toEqual([{n:1}]);
 }finally{await sql.unsafe(`DROP TRIGGER ${fault} ON public.customer_credit_entries`);await sql.unsafe(`DROP FUNCTION private.${fault}()`);}
 const repair=await createFixture(['geld'],'buero');
 expect(await withSession(repair,()=>cancelInvoiceAction(JSON.parse(JSON.stringify(input))))).toMatchObject({code:'OK',replayed:true,replacementReceipt:{issuedBy:repair.actorId}});
 expect(await withSession(full,()=>getCustomerCreditAction(order.customerId))).toMatchObject({code:'OK',credit:{balanceCents:order.invoice.grossAmountCents}});
 expect(await sql`SELECT actor_user_id::text FROM public.customer_credit_entries WHERE tenant_id=${tenant} AND invoice_id=${input.invoiceId}::uuid`).toEqual([{actor_user_id:full.actorId}]);
});

it('A09-7 an unpaid original with a failed replacement never claims a positive credit',async()=>{
 const {order,input}=await source('TEST S09 unpaid pending',false),fault='test_s09_unpaid_'+randomUUID().replaceAll('-','');
 await sql.unsafe(`CREATE FUNCTION private.${fault}() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.tenant_id='${tenant}' AND NEW.client_event_id='${input.reissueWithoutShipping.replacementClientEventId}'::uuid THEN PERFORM 1/0; END IF; RETURN NEW; END $$`);
 await sql.unsafe(`CREATE TRIGGER ${fault} BEFORE INSERT ON public.invoices FOR EACH ROW EXECUTE FUNCTION private.${fault}()`);
 try{expect(await withSession(full,()=>cancelInvoiceAction(input))).toMatchObject({code:'UNAVAILABLE',message:SHIPPING_FEE_COPY.reissueUnpaidPending});}
 finally{await sql.unsafe(`DROP TRIGGER ${fault} ON public.invoices`);await sql.unsafe(`DROP FUNCTION private.${fault}()`);}
 expect(await sql`SELECT count(*)::int AS n FROM public.customer_credit_entries WHERE tenant_id=${tenant} AND invoice_id=${input.invoiceId}::uuid`).toEqual([{n:0}]);
 expect(await withSession(full,()=>cancelInvoiceAction(JSON.parse(JSON.stringify(input))))).toMatchObject({code:'OK',replacementReceipt:{grossAmountCents:11900}});
 expect(await withSession(full,()=>getCustomerCreditAction(order.customerId))).toMatchObject({code:'OK',credit:{balanceCents:0}});
});

it('A09-7 R2 failed task completion preserves the actual replacement instead of falsely saying it is missing',async()=>{
 const {order,input}=await source('TEST S09 task completion pending'),fault='test_s09_reissue_'+randomUUID().replaceAll('-',''),history='test_s09_done_'+randomUUID().replaceAll('-','');
 await sql.unsafe(`CREATE FUNCTION private.${fault}() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.tenant_id='${tenant}' AND NEW.client_event_id='${input.reissueWithoutShipping.replacementClientEventId}'::uuid THEN PERFORM 1/0; END IF; RETURN NEW; END $$`);
 await sql.unsafe(`CREATE TRIGGER ${fault} BEFORE INSERT ON public.invoices FOR EACH ROW EXECUTE FUNCTION private.${fault}()`);
 await sql.unsafe(`CREATE FUNCTION private.${history}() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.tenant_id='${tenant}' AND NEW.nachher->>'action'='aufgabe.erledigt' THEN RETURN NULL; END IF; RETURN NEW; END $$`);
 try{
  expect(await withSession(full,()=>cancelInvoiceAction(input))).toMatchObject({code:'UNAVAILABLE'});
  await sql.unsafe(`DROP TRIGGER ${fault} ON public.invoices`);
  await sql.unsafe(`CREATE TRIGGER ${history} BEFORE INSERT ON public.intake_event FOR EACH ROW EXECUTE FUNCTION private.${history}()`);
  expect(await withSession(full,()=>cancelInvoiceAction(JSON.parse(JSON.stringify(input))))).toMatchObject({code:'UNAVAILABLE',message:SHIPPING_FEE_COPY.reissueTaskCompletionPending});
  expect(await sql`SELECT count(*)::int AS n FROM public.invoices WHERE tenant_id=${tenant} AND order_id=${order.orderId}`).toEqual([{n:2}]);
  expect(await sql`SELECT status FROM public.tasks WHERE tenant_id=${tenant} AND client_key=${input.clientEventId}::uuid`).toEqual([{status:'offen'}]);
  await sql.unsafe(`DROP TRIGGER ${history} ON public.intake_event`);
  expect(await withSession(full,()=>cancelInvoiceAction(JSON.parse(JSON.stringify(input))))).toMatchObject({code:'OK',replayed:true});
  expect(await sql`SELECT count(*)::int AS n FROM public.invoices WHERE tenant_id=${tenant} AND order_id=${order.orderId}`).toEqual([{n:2}]);
  expect(await sql`SELECT status FROM public.tasks WHERE tenant_id=${tenant} AND client_key=${input.clientEventId}::uuid`).toEqual([{status:'erledigt'}]);
 }finally{await sql.unsafe(`DROP TRIGGER IF EXISTS ${fault} ON public.invoices`);await sql.unsafe(`DROP FUNCTION private.${fault}()`);await sql.unsafe(`DROP TRIGGER IF EXISTS ${history} ON public.intake_event`);await sql.unsafe(`DROP FUNCTION private.${history}()`);}
});

it('A09-7 R2 an intervening real pickup-person note does not strand the immutable reissue intent; repair uses the current order version and the old goods',async()=>{
 const {order,input,original}=await source('TEST S09 current-version repair');
 const fault='test_s09_reissue_'+randomUUID().replaceAll('-','');
 await sql.unsafe(`CREATE FUNCTION private.${fault}() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.tenant_id='${tenant}' AND NEW.client_event_id='${input.reissueWithoutShipping.replacementClientEventId}'::uuid THEN PERFORM 1/0; END IF; RETURN NEW; END $$`);
 await sql.unsafe(`CREATE TRIGGER ${fault} BEFORE INSERT ON public.invoices FOR EACH ROW EXECUTE FUNCTION private.${fault}()`);
 try{expect(await withSession(full,()=>cancelInvoiceAction(input))).toMatchObject({code:'UNAVAILABLE'});}
 finally{await sql.unsafe(`DROP TRIGGER ${fault} ON public.invoices`);await sql.unsafe(`DROP FUNCTION private.${fault}()`);}
 const [before]=await sql`SELECT version FROM public.orders WHERE tenant_id=${tenant} AND id=${order.orderId}`;
 expect(await withSession(full,()=>changeOrderPickupNoticeAction({orderId:order.orderId,expectedVersion:before.version,clientEventId:randomUUID(),name:'TEST bestaetigte Abholperson',note:null,source:'persoenlich'}))).toMatchObject({code:'OK'});
 const [current]=await sql`SELECT version FROM public.orders WHERE tenant_id=${tenant} AND id=${order.orderId}`;expect(current.version).toBe(before.version+1);
 const repair=await createFixture(['geld'],'buero');
 expect(await withSession(repair,()=>cancelInvoiceAction(JSON.parse(JSON.stringify(input))))).toMatchObject({code:'OK',replayed:true,replacementReceipt:{orderVersion:current.version,issuedBy:repair.actorId,netAmountCents:10000}});
 const [replacement]=await sql`SELECT snapshot,order_version FROM public.invoices WHERE tenant_id=${tenant} AND client_event_id=${input.reissueWithoutShipping.replacementClientEventId}::uuid`;
 expect(replacement.order_version).toBe(current.version);expect(replacement.snapshot.lines).toEqual(original.snapshot.lines.filter((line:{type:string})=>line.type!=='SHIPPING'));
 expect(await sql`SELECT status FROM public.tasks WHERE tenant_id=${tenant} AND client_key=${input.clientEventId}::uuid`).toEqual([{status:'erledigt'}]);
 const scope=offlinePartition({tenantId:tenant,userId:full.actorId}),captured=new Date().toISOString();
 const originalRequest={kind:'workshop' as const,command:'invoice.cancel' as const,id:input.clientEventId,itemId:input.invoiceId,deviceCapturedAt:captured,input};
 const acknowledged=await withSession(full,()=>replayOfflineWorkshopAction(scope,JSON.parse(JSON.stringify(originalRequest))));
 expect(acknowledged).toMatchObject({code:'OK',replayed:true,replacementReceipt:{orderVersion:current.version,issuedBy:repair.actorId}});
 expect(isPendingWorkshopAcknowledgement(scope,originalRequest,JSON.parse(JSON.stringify(acknowledged)))).toBe(true);
});
