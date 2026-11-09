import {randomUUID} from 'node:crypto';
import {expect,it} from 'vitest';
import {KREILE_TENANT_SLUG} from '@/lib/tenant';
import {sql,full,withSession,createFixture} from './replayHarness';
import {readyInvoiceOrder,customerFixture,intakeOrderFixture} from './orderFixture';

it('H4 overdue invoice of the same customer blocks a new release without recording goods out',async()=>{
 const order=await readyInvoiceOrder('H4');
 // Given historical debt: a separate synthetic issued invoice, not a mutation
 // of the current immutable invoice and not a second product invoice writer.
 const oldOrder=await intakeOrderFixture('H4-Alt',order.customerId);
 // Historical invoice is an isolated initial fixture. The payment itself below
 // goes through the real UI Action, not a fixture update or a second writer.
 // Prior-year history must not overtake the current year's real number counter.
 const oldInvoiceId=randomUUID(),oldNumber='R-2025-0001';
 await sql`INSERT INTO public.invoices(id,tenant_id,order_id,customer_id,invoice_number,amount_total,status,due_date,gross_amount_cents,payment_contract_version,payment_mode,payment_status,payment_open_amount_cents,payment_paid_amount_cents,payment_currency,payment_version)
 VALUES(${oldInvoiceId}::uuid,${KREILE_TENANT_SLUG},${oldOrder.receipt.orderId},${order.customerId},${oldNumber},119.00,'issued',(statement_timestamp() AT TIME ZONE 'Europe/Berlin')::date-1,11900,1,'rechnung','offen',11900,0,'EUR',0)`;
 const {recordGoodsOutAction}=await import('@/app/actions/goodsOut.actions');
 const {getOrderPaymentStateAction}=await import('@/app/actions/payments.actions');
 expect(await withSession(full,()=>getOrderPaymentStateAction({orderId:order.orderId}))).toMatchObject({code:'OK',data:{goodsOutAllowed:false}});
 const {getCustomerSummaryAction}=await import('@/app/actions/customers.actions');
 const customerBefore=await withSession(full,()=>getCustomerSummaryAction({customerId:order.customerId}));
 expect(customerBefore.code).toBe('OK');if(customerBefore.code!=='OK')throw Error('H4_CUSTOMER_BEFORE:'+customerBefore.code);
 expect(customerBefore.data.hints).toContainEqual({kind:'payment',text:'1 Rechnung überfällig',urgent:true});
 const key=randomUUID();
 const result=await withSession(full,()=>recordGoodsOutAction({orderId:order.orderId,mode:'abholung',expectedVersion:order.version,clientEventId:key}));
 expect(result.code,'H4: an overdue invoice of this customer must prevent the new release').not.toBe('OK');
 expect('message'in result?result.message:'').toContain(oldNumber);
 expect(await sql`SELECT station FROM public.orders WHERE tenant_id=${KREILE_TENANT_SLUG} AND id=${order.orderId}`).toEqual([{station:'fertig'}]);
 expect(await sql`SELECT count(*)::integer AS n FROM public.events WHERE tenant_id=${KREILE_TENANT_SLUG} AND order_id=${order.orderId} AND client_event_id=${key}`).toEqual([{n:0}]);
 const limited=await createFixture(['auftraege']);
 const limitedKey=randomUUID();
 const hidden=await withSession(limited,()=>recordGoodsOutAction({orderId:order.orderId,mode:'abholung',expectedVersion:order.version,clientEventId:limitedKey}));
 expect(hidden.code).toBe('CONFLICT');
 expect('message'in hidden?hidden.message:'').not.toContain(oldNumber);
 expect(await sql`SELECT count(*)::integer AS n FROM public.events WHERE tenant_id=${KREILE_TENANT_SLUG} AND client_event_id=${limitedKey}::uuid`).toEqual([{n:0}]);
 const {getLiveOrderCardAction}=await import('@/app/actions/orders.actions');
 expect(await withSession(full,()=>getLiveOrderCardAction({orderId:order.orderId}))).toMatchObject({code:'OK',data:{card:{station:'fertig',version:order.version}}});
 const {confirmPaymentAction}=await import('@/app/actions/payments.actions');
 const partial={invoiceId:oldInvoiceId,amount:5900,method:'bar' as const,expectedVersion:0,clientEventId:randomUUID()};
 const partialPaid=await withSession(full,()=>confirmPaymentAction(partial));
 expect(partialPaid.code).toBe('OK');if(partialPaid.code!=='OK')throw Error('H4_PARTIAL:'+partialPaid.code);
 expect(await sql`SELECT payment_status,payment_open_amount_cents FROM public.invoices WHERE tenant_id=${KREILE_TENANT_SLUG} AND id=${oldInvoiceId}::uuid`).toEqual([{payment_status:'teilbezahlt',payment_open_amount_cents:6000}]);
 expect(await withSession(full,()=>getOrderPaymentStateAction({orderId:oldOrder.receipt.orderId}))).toMatchObject({code:'OK',data:{payment:{status:'teilbezahlt',openAmountCents:6000}}});
 expect(await withSession(full,()=>confirmPaymentAction(partial))).toMatchObject({code:'OK',replayed:true});
 expect(await withSession(full,()=>recordGoodsOutAction({orderId:order.orderId,mode:'abholung',expectedVersion:order.version,clientEventId:key}))).toMatchObject({code:'CONFLICT'});
 expect(await sql`SELECT count(*)::integer AS n FROM public.events WHERE tenant_id=${KREILE_TENANT_SLUG} AND client_event_id=${key}::uuid`).toEqual([{n:0}]);
 const payment={invoiceId:oldInvoiceId,amount:6000,method:'bar' as const,expectedVersion:1,clientEventId:randomUUID()};
 const paid=await withSession(full,()=>confirmPaymentAction(payment));
 expect(paid.code).toBe('OK');if(paid.code!=='OK')throw Error('H4_PAY_OLD:'+paid.code);
 expect(await sql`SELECT payment_status,payment_open_amount_cents,payment_paid_amount_cents FROM public.invoices WHERE tenant_id=${KREILE_TENANT_SLUG} AND id=${oldInvoiceId}::uuid`).toEqual([{payment_status:'bezahlt',payment_open_amount_cents:0,payment_paid_amount_cents:11900}]);
 expect(await withSession(full,()=>getOrderPaymentStateAction({orderId:oldOrder.receipt.orderId}))).toMatchObject({code:'OK',data:{invoiceState:'issued'}});
 expect(await withSession(full,()=>confirmPaymentAction(payment))).toMatchObject({code:'OK',replayed:true});
 const customerAfter=await withSession(full,()=>getCustomerSummaryAction({customerId:order.customerId}));
 expect(customerAfter.code).toBe('OK');if(customerAfter.code!=='OK')throw Error('H4_CUSTOMER_AFTER:'+customerAfter.code);
 expect(customerAfter.data.hints?.filter(hint=>hint.kind==='payment')).toEqual([]);
 expect(await withSession(full,()=>getOrderPaymentStateAction({orderId:order.orderId}))).toMatchObject({code:'OK',data:{goodsOutAllowed:true}});
 const refreshed=await withSession(full,()=>getLiveOrderCardAction({orderId:order.orderId}));
 expect(refreshed.code).toBe('OK');if(refreshed.code!=='OK')throw Error('H4_REFRESH:'+refreshed.code);
 const out=await withSession(full,()=>recordGoodsOutAction({orderId:order.orderId,mode:'abholung',expectedVersion:refreshed.data.card.version,clientEventId:key}));
 expect(out.code).toBe('OK');if(out.code!=='OK')throw Error('H4_AFTER_PAYMENT:'+out.code);
 expect(await withSession(full,()=>getLiveOrderCardAction({orderId:order.orderId}))).toMatchObject({code:'OK',data:{card:{station:'abgeholt',version:out.receipt.orderVersion}}});
 expect(await sql`SELECT user_id::text FROM public.events WHERE tenant_id=${KREILE_TENANT_SLUG} AND client_event_id=${payment.clientEventId}::uuid`).toEqual([{user_id:full.actorId}]);
 expect(await sql`SELECT user_id::text FROM public.events WHERE tenant_id=${KREILE_TENANT_SLUG} AND client_event_id=${key}::uuid`).toEqual([{user_id:full.actorId}]);
});

for(const scenario of ['not-due','due-today','paid','other-customer'] as const){
 it(`W22 ${scenario} invoice does not become an overdue customer block`,async()=>{
  const order=await readyInvoiceOrder('H4-'+scenario);
  const customerId=scenario==='other-customer'?await customerFixture('H4-other'):order.customerId;
  const invoiceId=randomUUID();
  const paymentStatus=scenario==='paid'?'bezahlt':'offen';
  const open=scenario==='paid'?0:11900;
  const dueOffset=scenario==='not-due'?7:scenario==='due-today'?0:-1;
  const paid=scenario==='paid';
  await sql`INSERT INTO public.invoices(id,tenant_id,customer_id,invoice_number,amount_total,status,due_date,gross_amount_cents,payment_contract_version,payment_mode,payment_status,payment_open_amount_cents,payment_paid_amount_cents,payment_currency,payment_version,payment_method,payment_paid_at,payment_receipt_id,payment_event_id,payment_correlation_id)
  VALUES(${invoiceId}::uuid,${KREILE_TENANT_SLUG},${customerId},${'TEST-H4-'+scenario+'-'+invoiceId},119.00,'issued',(statement_timestamp() AT TIME ZONE 'Europe/Berlin')::date+${dueOffset}::integer,11900,1,'rechnung',${paymentStatus},${open},${11900-open},'EUR',${paid?1:0},${paid?'ueberweisung':null},${paid?new Date():null},${paid?'TEST-historical-receipt-'+invoiceId:null},${paid?'TEST-historical-event-'+invoiceId:null},${paid?randomUUID():null}::uuid)`;
  const {recordGoodsOutAction}=await import('@/app/actions/goodsOut.actions');
  const {getLiveOrderCardAction}=await import('@/app/actions/orders.actions');
  const input={orderId:order.orderId,mode:'abholung' as const,expectedVersion:order.version,clientEventId:randomUUID()};
  const released=await withSession(full,()=>recordGoodsOutAction(input));
  expect(released.code).toBe('OK');if(released.code!=='OK')throw Error('H4_POSITIVE:'+released.code);
  expect(await sql`SELECT station,version FROM public.orders WHERE tenant_id=${KREILE_TENANT_SLUG} AND id=${order.orderId}`).toEqual([{station:'abgeholt',version:released.receipt.orderVersion}]);
  expect(await withSession(full,()=>getLiveOrderCardAction({orderId:order.orderId}))).toMatchObject({code:'OK',data:{card:{station:'abgeholt',version:released.receipt.orderVersion}}});
  expect(await withSession(full,()=>recordGoodsOutAction(input))).toMatchObject({code:'OK',replayed:true});
  expect(await sql`SELECT user_id::text FROM public.events WHERE tenant_id=${KREILE_TENANT_SLUG} AND client_event_id=${input.clientEventId}::uuid`).toEqual([{user_id:full.actorId}]);
 });
}
