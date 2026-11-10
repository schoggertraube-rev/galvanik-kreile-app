import {randomUUID} from 'node:crypto';
import {expect,it} from 'vitest';
import {KREILE_TENANT_SLUG} from '@/lib/tenant';
import {sql,full,withSession} from './replayHarness';
import {readyInvoiceOrder} from './orderFixture';

it('H8 released orders remain reachable through search, customer history and their immutable invoice receipt',async()=>{
 const order=await readyInvoiceOrder('H8-Verknuepfung');
 const {recordGoodsOutAction}=await import('@/app/actions/goodsOut.actions');
 const request={orderId:order.orderId,mode:'abholung' as const,expectedVersion:order.version,clientEventId:randomUUID()};
 const released=await withSession(full,()=>recordGoodsOutAction(request));
 if(released.code!=='OK')throw Error('H8_LINK_RELEASE:'+released.code);
 const events=await sql`SELECT count(*)::integer AS n FROM public.events WHERE tenant_id=${KREILE_TENANT_SLUG}`;
 const {getCustomerSummaryAction}=await import('@/app/actions/customers.actions');
 const {searchTenantAction}=await import('@/app/actions/search.actions');
 const {getInvoiceReceiptAction}=await import('@/app/actions/invoices.actions');
 const {getLiveOrderCardAction}=await import('@/app/actions/orders.actions');
 expect(await withSession(full,()=>getCustomerSummaryAction({customerId:order.customerId}))).toMatchObject({code:'OK',data:{wareImHaus:false,wareImHausCount:0,orders:expect.arrayContaining([expect.objectContaining({id:order.orderId,station:'abgeholt',version:released.receipt.orderVersion})])}});
 const [stored]=await sql`SELECT order_number FROM public.orders WHERE tenant_id=${KREILE_TENANT_SLUG} AND id=${order.orderId}`;
 expect(await withSession(full,()=>searchTenantAction(stored.order_number))).toMatchObject({code:'OK',hits:expect.arrayContaining([expect.objectContaining({type:'ORDER',id:order.orderId,href:'/orders/'+order.orderId})])});
 expect(await withSession(full,()=>getLiveOrderCardAction({orderId:order.orderId}))).toMatchObject({code:'OK',data:{card:{station:'abgeholt',version:released.receipt.orderVersion}}});
 expect(await withSession(full,()=>getInvoiceReceiptAction({orderId:order.orderId,clientEventId:order.issueInput.clientEventId}))).toMatchObject({code:'OK',data:{invoiceId:order.invoice.invoiceId,invoiceNumber:order.invoice.invoiceNumber}});
 expect(await sql`SELECT count(*)::integer AS n FROM public.events WHERE tenant_id=${KREILE_TENANT_SLUG}`).toEqual(events);
 expect(await withSession(full,()=>recordGoodsOutAction(JSON.parse(JSON.stringify(request))))).toMatchObject({code:'OK',replayed:true,receipt:{eventId:released.receipt.eventId}});
 expect(await sql`SELECT customer_id,station,version FROM public.orders WHERE tenant_id=${KREILE_TENANT_SLUG} AND id=${order.orderId}`).toEqual([{customer_id:order.customerId,station:'abgeholt',version:released.receipt.orderVersion}]);
});

it('H8 L5 a physically released order cannot be finished again, returned to Galvanik or invoiced twice',async()=>{
 const order=await readyInvoiceOrder('H8-Folgesperren');
 const {recordGoodsOutAction}=await import('@/app/actions/goodsOut.actions');
 const released=await withSession(full,()=>recordGoodsOutAction({orderId:order.orderId,mode:'abholung',expectedVersion:order.version,clientEventId:randomUUID()}));
 expect(released.code).toBe('OK');if(released.code!=='OK')throw Error('H8_TERMINAL_RELEASE:'+released.code);
 const {getLiveOrderCardAction,setOrderItemFinishedAction,freezeOrderAction,transitionWareneingangToGalvanikAction}=await import('@/app/actions/orders.actions');
 expect(await withSession(full,()=>getLiveOrderCardAction({orderId:order.orderId}))).toMatchObject({code:'OK',data:{card:{station:'abgeholt',version:released.receipt.orderVersion}}});
 const before=await sql`SELECT station,version,promised_due_date::text FROM public.orders WHERE tenant_id=${KREILE_TENANT_SLUG} AND id=${order.orderId}`;
 const keys={part:randomUUID(),finish:randomUUID(),move:randomUUID(),invoice:randomUUID()};
 const {issueInvoiceAction}=await import('@/app/actions/invoices.actions');
 const results=[
  await withSession(full,()=>setOrderItemFinishedAction({orderId:order.orderId,itemId:order.items[0].id,expectedVersion:released.receipt.orderVersion,clientEventId:keys.part,finished:false})),
  await withSession(full,()=>freezeOrderAction({orderId:order.orderId,freezeId:randomUUID(),expectedVersion:released.receipt.orderVersion,clientEventId:keys.finish})),
  await withSession(full,()=>transitionWareneingangToGalvanikAction({orderId:order.orderId,expectedVersion:released.receipt.orderVersion,clientEventId:keys.move})),
  await withSession(full,()=>issueInvoiceAction({orderId:order.orderId,expectedVersion:released.receipt.orderVersion,clientEventId:keys.invoice})),
 ];
 for(const result of results)expect(result.code).not.toBe('OK');
 expect(await sql`SELECT station,version,promised_due_date::text FROM public.orders WHERE tenant_id=${KREILE_TENANT_SLUG} AND id=${order.orderId}`).toEqual(before);
 expect(await sql`SELECT count(*)::integer AS n FROM public.events WHERE tenant_id=${KREILE_TENANT_SLUG} AND client_event_id=ANY(${sql.array(Object.values(keys))}::uuid[])`).toEqual([{n:0}]);
 expect(await sql`SELECT id::text FROM public.invoices WHERE tenant_id=${KREILE_TENANT_SLUG} AND order_id=${order.orderId}`).toEqual([{id:order.invoice.invoiceId}]);
 expect(await withSession(full,()=>getLiveOrderCardAction({orderId:order.orderId}))).toMatchObject({code:'OK',data:{card:{station:'abgeholt',version:released.receipt.orderVersion}}});
});

it('H8 active order still accepts a due date change with actor, readback and the same retry receipt',async()=>{
 const order=await readyInvoiceOrder('H8-aktiv');
 const {changeOrderPromisedDueDateAction,getLiveOrderCardAction}=await import('@/app/actions/orders.actions');
 const input={orderId:order.orderId,expectedVersion:order.version,dueDate:'2027-05-26',reason:'TEST bestätigter Abholtermin vor Übergabe',clientEventId:randomUUID()};
 const changed=await withSession(full,()=>changeOrderPromisedDueDateAction(input));
 expect(changed.code).toBe('OK');if(changed.code!=='OK')throw Error('H8_ACTIVE_PROMISE:'+changed.code);
 expect(await sql`SELECT promised_due_date::date::text AS due,version FROM public.orders WHERE tenant_id=${KREILE_TENANT_SLUG} AND id=${order.orderId}`).toEqual([{due:input.dueDate,version:changed.receipt.aggregateVersion}]);
 expect(await withSession(full,()=>getLiveOrderCardAction({orderId:order.orderId}))).toMatchObject({code:'OK',data:{card:{station:'fertig',version:changed.receipt.aggregateVersion}}});
 expect(await withSession(full,()=>changeOrderPromisedDueDateAction(structuredClone(input)))).toMatchObject({code:'OK',replayed:true,receipt:{eventId:changed.receipt.eventId}});
 expect(await sql`SELECT user_id::text,notes FROM public.events WHERE tenant_id=${KREILE_TENANT_SLUG} AND client_event_id=${input.clientEventId}::uuid`).toEqual([{user_id:full.actorId,notes:input.reason}]);
});

// Invoice, payment and goods-out retry plus the post-release guard.
// Quote conversion/rework/concurrent-tab/undo branches still need coverage.
it.each([['abholung','pickup'],['versand','shipping']] as const)('H8 %s: real reread/retry creates one invoice/payment/release, then rejects a new due date',async(mode,handoverMode)=>{
 const order=await readyInvoiceOrder('H8',handoverMode);
 const {issueInvoiceAction,getInvoiceReceiptAction}=await import('@/app/actions/invoices.actions');
 expect(await withSession(full,()=>getInvoiceReceiptAction({orderId:order.orderId,clientEventId:order.issueInput.clientEventId}))).toMatchObject({code:'OK'});
 expect(await withSession(full,()=>issueInvoiceAction(structuredClone(order.issueInput)))).toMatchObject({code:'OK',replayed:true,receipt:{invoiceId:order.invoice.invoiceId}});
 expect(await sql`SELECT count(*)::integer AS n FROM public.invoices WHERE tenant_id=${KREILE_TENANT_SLUG} AND order_id=${order.orderId}`).toEqual([{n:1}]);
 const {confirmPaymentAction,getOrderPaymentStateAction}=await import('@/app/actions/payments.actions');
 const paymentInput={invoiceId:order.invoice.invoiceId,amount:order.invoice.grossAmountCents,method:'ueberweisung' as const,expectedVersion:0,clientEventId:randomUUID()};
 const paid=await withSession(full,()=>confirmPaymentAction(paymentInput));
 expect(paid.code).toBe('OK');if(paid.code!=='OK')throw Error('H8_PAYMENT:'+paid.code);
 expect(await sql`SELECT payment_status,payment_paid_amount_cents::integer AS paid,payment_open_amount_cents::integer AS open,payment_version FROM public.invoices WHERE tenant_id=${KREILE_TENANT_SLUG} AND id=${order.invoice.invoiceId}::uuid`).toEqual([{payment_status:'bezahlt',paid:order.invoice.grossAmountCents,open:0,payment_version:1}]);
 expect(await withSession(full,()=>getOrderPaymentStateAction({orderId:order.orderId}))).toMatchObject({code:'OK',data:{invoiceState:'issued',goodsOutAllowed:true}});
 expect(await withSession(full,()=>confirmPaymentAction(structuredClone(paymentInput)))).toMatchObject({code:'OK',replayed:true,receipt:{receiptId:paid.receipt.receiptId}});
 expect(await sql`SELECT count(*)::integer AS n FROM public.events WHERE tenant_id=${KREILE_TENANT_SLUG} AND client_event_id=${paymentInput.clientEventId}::uuid`).toEqual([{n:1}]);
 const {recordGoodsOutAction}=await import('@/app/actions/goodsOut.actions');
 const {getLiveOrderCardAction,changeOrderPromisedDueDateAction}=await import('@/app/actions/orders.actions');
 const outInput={orderId:order.orderId,mode,expectedVersion:order.version,clientEventId:randomUUID()};
 const out=await withSession(full,()=>recordGoodsOutAction(outInput));
 expect(out.code).toBe('OK');if(out.code!=='OK')throw Error('H8_OUT:'+out.code);
 expect(await withSession(full,()=>getLiveOrderCardAction({orderId:order.orderId}))).toMatchObject({code:'OK',data:{card:{id:order.orderId,station:'abgeholt'}}});
 expect(await withSession(full,()=>recordGoodsOutAction(structuredClone(outInput)))).toMatchObject({code:'OK',replayed:true});
 expect(await sql`SELECT count(*)::integer AS n FROM public.events WHERE tenant_id=${KREILE_TENANT_SLUG} AND client_event_id=${outInput.clientEventId}::uuid`).toEqual([{n:1}]);
 const before=await sql`SELECT promised_due_date::text,version FROM public.orders WHERE tenant_id=${KREILE_TENANT_SLUG} AND id=${order.orderId}`;
 const dateKey=randomUUID();
 const changed=await withSession(full,()=>changeOrderPromisedDueDateAction({orderId:order.orderId,expectedVersion:out.receipt.orderVersion,dueDate:'2027-05-25',reason:'TEST nach Abholung darf kein neuer Termin entstehen',clientEventId:dateKey}));
 const after=await sql`SELECT promised_due_date::text,version FROM public.orders WHERE tenant_id=${KREILE_TENANT_SLUG} AND id=${order.orderId}`;
 expect(changed,'L5: already released order must reject due date change; actual DB '+JSON.stringify(after)).toMatchObject({code:'CONFLICT',message:'Der Auftrag wurde bereits herausgegeben. Du kannst den Liefertermin nicht mehr ändern.'});
 expect(after).toEqual(before);
 expect(await sql`SELECT count(*)::integer AS n FROM public.events WHERE tenant_id=${KREILE_TENANT_SLUG} AND client_event_id=${dateKey}::uuid`).toEqual([{n:0}]);
});

it('H8 a due date written before handover still replays when its retry arrives after handover',async()=>{
 const order=await readyInvoiceOrder('H8-spät');
 const {getLiveOrderCardAction,changeOrderPromisedDueDateAction}=await import('@/app/actions/orders.actions');
 const input={orderId:order.orderId,expectedVersion:order.version,dueDate:'2027-05-24',reason:'TEST vor Ausgabe bestätigt, Wiederholung kommt später',clientEventId:randomUUID()};
 const changed=await withSession(full,()=>changeOrderPromisedDueDateAction(input));
 expect(changed.code).toBe('OK');if(changed.code!=='OK')throw Error('H8_EARLY_DATE:'+changed.code);
 expect(await withSession(full,()=>getLiveOrderCardAction({orderId:order.orderId}))).toMatchObject({code:'OK',data:{card:{station:'fertig',version:changed.receipt.aggregateVersion}}});
 const {recordGoodsOutAction}=await import('@/app/actions/goodsOut.actions');
 const out=await withSession(full,()=>recordGoodsOutAction({orderId:order.orderId,mode:'abholung',expectedVersion:changed.receipt.aggregateVersion,clientEventId:randomUUID()}));
 expect(out.code).toBe('OK');if(out.code!=='OK')throw Error('H8_LATE_RETRY_OUT:'+out.code);
 expect(await withSession(full,()=>getLiveOrderCardAction({orderId:order.orderId}))).toMatchObject({code:'OK',data:{card:{station:'abgeholt',version:out.receipt.orderVersion}}});
 const before=await sql`SELECT promised_due_date::date::text AS due,version FROM public.orders WHERE tenant_id=${KREILE_TENANT_SLUG} AND id=${order.orderId}`;
 expect(await withSession(full,()=>changeOrderPromisedDueDateAction(structuredClone(input)))).toMatchObject({code:'OK',replayed:true,receipt:{eventId:changed.receipt.eventId}});
 expect(await sql`SELECT promised_due_date::date::text AS due,version FROM public.orders WHERE tenant_id=${KREILE_TENANT_SLUG} AND id=${order.orderId}`).toEqual(before);
 expect(before).toEqual([{due:input.dueDate,version:out.receipt.orderVersion}]);
 expect(await sql`SELECT user_id::text FROM public.events WHERE tenant_id=${KREILE_TENANT_SLUG} AND client_event_id=${input.clientEventId}::uuid`).toEqual([{user_id:full.actorId}]);
});
