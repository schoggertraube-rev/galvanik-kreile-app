import {randomUUID} from 'node:crypto';
import {expect,it} from 'vitest';
import {KREILE_TENANT_SLUG} from '@/lib/tenant';
import {sql,full,withSession} from './replayHarness';
import {readyInvoiceOrder} from './orderFixture';

it('H8 active order still accepts a due date change with actor, readback and the same retry receipt',async()=>{
 const order=await readyInvoiceOrder('H8-aktiv');
 const {changeOrderPromisedDueDateAction,getLiveOrderCardAction}=await import('@/app/actions/orders.actions');
 const input={orderId:order.orderId,expectedVersion:order.version,dueDate:'2027-05-26',reason:'TEST bestätigter Abholtermin vor Übergabe',clientEventId:randomUUID()};
 const changed=await withSession(full,()=>changeOrderPromisedDueDateAction(input));
 expect(changed.code).toBe('OK');if(changed.code!=='OK')throw Error('H8_ACTIVE_PROMISE:'+changed.code);
 expect(await sql`SELECT promised_due_date::date::text AS due,version FROM public.orders WHERE tenant_id=${KREILE_TENANT_SLUG} AND id=${order.orderId}`).toEqual([{due:input.dueDate,version:changed.receipt.aggregateVersion}]);
 expect(await withSession(full,()=>getLiveOrderCardAction({orderId:order.orderId}))).toMatchObject({code:'OK',data:{card:{station:'fertig',version:changed.receipt.aggregateVersion}}});
 expect(await withSession(full,()=>changeOrderPromisedDueDateAction(input))).toMatchObject({code:'OK',replayed:true,receipt:{eventId:changed.receipt.eventId}});
 expect(await sql`SELECT user_id::text,notes FROM public.events WHERE tenant_id=${KREILE_TENANT_SLUG} AND client_event_id=${input.clientEventId}::uuid`).toEqual([{user_id:full.actorId,notes:input.reason}]);
});

// Invoice, payment and goods-out retry plus the post-release guard.
// Quote conversion/rework/concurrent-tab/undo branches still need coverage.
it('H8 real reread/retry creates one invoice, one payment and one release; release then blocks a new due date',async()=>{
 const order=await readyInvoiceOrder('H8');
 const {issueInvoiceAction,getInvoiceReceiptAction}=await import('@/app/actions/invoices.actions');
 expect(await withSession(full,()=>getInvoiceReceiptAction({orderId:order.orderId,clientEventId:order.issueInput.clientEventId}))).toMatchObject({code:'OK'});
 expect(await withSession(full,()=>issueInvoiceAction(order.issueInput))).toMatchObject({code:'OK',replayed:true,receipt:{invoiceId:order.invoice.invoiceId}});
 expect(await sql`SELECT count(*)::integer AS n FROM public.invoices WHERE tenant_id=${KREILE_TENANT_SLUG} AND order_id=${order.orderId}`).toEqual([{n:1}]);
 const {confirmPaymentAction,getOrderPaymentStateAction}=await import('@/app/actions/payments.actions');
 const paymentInput={invoiceId:order.invoice.invoiceId,amount:order.invoice.grossAmountCents,method:'ueberweisung' as const,expectedVersion:0,clientEventId:randomUUID()};
 const paid=await withSession(full,()=>confirmPaymentAction(paymentInput));
 expect(paid.code).toBe('OK');if(paid.code!=='OK')throw Error('H8_PAYMENT:'+paid.code);
 expect(await sql`SELECT payment_status,payment_paid_amount_cents::integer AS paid,payment_open_amount_cents::integer AS open,payment_version FROM public.invoices WHERE tenant_id=${KREILE_TENANT_SLUG} AND id=${order.invoice.invoiceId}::uuid`).toEqual([{payment_status:'bezahlt',paid:order.invoice.grossAmountCents,open:0,payment_version:1}]);
 expect(await withSession(full,()=>getOrderPaymentStateAction({orderId:order.orderId}))).toMatchObject({code:'OK',data:{invoiceState:'issued',goodsOutAllowed:true}});
 expect(await withSession(full,()=>confirmPaymentAction(paymentInput))).toMatchObject({code:'OK',replayed:true,receipt:{receiptId:paid.receipt.receiptId}});
 expect(await sql`SELECT count(*)::integer AS n FROM public.events WHERE tenant_id=${KREILE_TENANT_SLUG} AND client_event_id=${paymentInput.clientEventId}::uuid`).toEqual([{n:1}]);
 const {recordGoodsOutAction}=await import('@/app/actions/goodsOut.actions');
 const {getLiveOrderCardAction,changeOrderPromisedDueDateAction}=await import('@/app/actions/orders.actions');
 const outInput={orderId:order.orderId,mode:'abholung' as const,expectedVersion:order.version,clientEventId:randomUUID()};
 const out=await withSession(full,()=>recordGoodsOutAction(outInput));
 expect(out.code).toBe('OK');if(out.code!=='OK')throw Error('H8_OUT:'+out.code);
 expect(await withSession(full,()=>getLiveOrderCardAction({orderId:order.orderId}))).toMatchObject({code:'OK',data:{card:{id:order.orderId,station:'abgeholt'}}});
 expect(await withSession(full,()=>recordGoodsOutAction(outInput))).toMatchObject({code:'OK',replayed:true});
 expect(await sql`SELECT count(*)::integer AS n FROM public.events WHERE tenant_id=${KREILE_TENANT_SLUG} AND client_event_id=${outInput.clientEventId}::uuid`).toEqual([{n:1}]);
 const before=await sql`SELECT promised_due_date::text,version FROM public.orders WHERE tenant_id=${KREILE_TENANT_SLUG} AND id=${order.orderId}`;
 const dateKey=randomUUID();
 const changed=await withSession(full,()=>changeOrderPromisedDueDateAction({orderId:order.orderId,expectedVersion:out.receipt.orderVersion,dueDate:'2027-05-25',reason:'TEST nach Abholung darf kein neuer Termin entstehen',clientEventId:dateKey}));
 const after=await sql`SELECT promised_due_date::text,version FROM public.orders WHERE tenant_id=${KREILE_TENANT_SLUG} AND id=${order.orderId}`;
 expect(changed,'L5: already released order must reject due date change; actual DB '+JSON.stringify(after)).toMatchObject({code:'CONFLICT',message:'Der Auftrag wurde bereits herausgegeben. Du kannst den Liefertermin nicht mehr ändern.'});
 expect(after).toEqual(before);
 expect(await sql`SELECT count(*)::integer AS n FROM public.events WHERE tenant_id=${KREILE_TENANT_SLUG} AND client_event_id=${dateKey}::uuid`).toEqual([{n:0}]);
});
