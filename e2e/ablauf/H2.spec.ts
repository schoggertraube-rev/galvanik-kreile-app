import {randomUUID} from 'node:crypto';
import {expect,it} from 'vitest';
import {KREILE_TENANT_SLUG} from '@/lib/tenant';
import {sql,full,withSession} from './replayHarness';
import {requestMailStep} from './requestMailStep';
import {readyInvoiceOrder} from './orderFixture';

// H2 shares H1's mail-to-quote prefix before its cash/pickup branch.
it('H2 Abholung bar / step1 T25: actual request mail becomes kv_anfrage',async()=>{await requestMailStep('H2');});

// Payment and physical handover segment only; notification and a printable cash receipt are not proved here.
it('H2 cash pickup requires the actual payment receipt before release and both retries preserve the same records',async()=>{
 const order=await readyInvoiceOrder('H2-Bar');
 const {setPaymentModeAction,confirmPaymentAction,getOrderPaymentStateAction}=await import('@/app/actions/payments.actions');
 const mode={orderId:order.orderId,paymentMode:'abholung' as const,expectedVersion:0,clientEventId:randomUUID()};
 expect(await withSession(full,()=>setPaymentModeAction(mode))).toMatchObject({code:'OK'});
 expect(await withSession(full,()=>getOrderPaymentStateAction({orderId:order.orderId}))).toMatchObject({code:'OK',data:{goodsOutAllowed:false,payment:{mode:'abholung',status:'offen'}}});
 expect(await withSession(full,()=>setPaymentModeAction(structuredClone(mode)))).toMatchObject({code:'OK',replayed:true});
 const {getLiveOrderCardAction}=await import('@/app/actions/orders.actions');
 const card=await withSession(full,()=>getLiveOrderCardAction({orderId:order.orderId}));if(card.code!=='OK')throw Error('H2_CASH_CARD:'+card.code);
 const release={orderId:order.orderId,mode:'abholung' as const,expectedVersion:card.data.card.version,clientEventId:randomUUID()};
 const {recordGoodsOutAction}=await import('@/app/actions/goodsOut.actions');
 expect(await withSession(full,()=>recordGoodsOutAction(release))).toMatchObject({code:'CONFLICT',message:'Zahlung ist für den Warenausgang noch offen.'});
 expect(await sql`SELECT count(*)::integer AS n FROM public.events WHERE tenant_id=${KREILE_TENANT_SLUG} AND client_event_id=${release.clientEventId}::uuid`).toEqual([{n:0}]);
 const payment={invoiceId:order.invoice.invoiceId,amount:order.invoice.grossAmountCents,method:'bar' as const,expectedVersion:0,clientEventId:randomUUID()};
 const paid=await withSession(full,()=>confirmPaymentAction(payment));
 expect(paid.code).toBe('OK');if(paid.code!=='OK')throw Error('H2_CASH_PAY:'+paid.code);
 expect(await sql`SELECT payment_status,payment_method,payment_paid_amount_cents::integer AS paid,payment_open_amount_cents::integer AS open,payment_receipt_id FROM public.invoices WHERE tenant_id=${KREILE_TENANT_SLUG} AND id=${order.invoice.invoiceId}::uuid`).toEqual([{payment_status:'bezahlt',payment_method:'bar',paid:order.invoice.grossAmountCents,open:0,payment_receipt_id:paid.receipt.receiptId}]);
 expect(await withSession(full,()=>getOrderPaymentStateAction({orderId:order.orderId}))).toMatchObject({code:'OK',data:{goodsOutAllowed:true,payment:{status:'bezahlt',method:'bar',receiptId:paid.receipt.receiptId}}});
 expect(await withSession(full,()=>confirmPaymentAction(structuredClone(payment)))).toMatchObject({code:'OK',replayed:true,receipt:{receiptId:paid.receipt.receiptId}});
 const released=await withSession(full,()=>recordGoodsOutAction(structuredClone(release)));
 expect(released.code).toBe('OK');if(released.code!=='OK')throw Error('H2_CASH_RELEASE:'+released.code);
 expect(await withSession(full,()=>getLiveOrderCardAction({orderId:order.orderId}))).toMatchObject({code:'OK',data:{card:{station:'abgeholt',version:released.receipt.orderVersion}}});
 expect(await withSession(full,()=>recordGoodsOutAction(structuredClone(release)))).toMatchObject({code:'OK',replayed:true,receipt:{eventId:released.receipt.eventId}});
 for(const clientKey of [mode.clientEventId,payment.clientEventId,release.clientEventId])expect(await sql`SELECT user_id::text FROM public.events WHERE tenant_id=${KREILE_TENANT_SLUG} AND client_event_id=${clientKey}::uuid`).toEqual([{user_id:full.actorId}]);
});
