import {randomUUID} from 'node:crypto';
import {expect,it} from 'vitest';
import {KREILE_TENANT_SLUG} from '@/lib/tenant';
import {sql,full,withSession,createFixture} from './replayHarness';
import {readyInvoiceOrder} from './orderFixture';

it('H8 same-key concurrent invoice, cash payment and pickup each commit once and replay after real readback',async()=>{
 const order=await readyInvoiceOrder('H8-same-key','pickup',true);
 expect(order.issuanceResults.map(row=>row.code)).toEqual(['OK','OK']);
 expect(order.issuanceResults.filter(row=>row.code==='OK'&&!row.replayed)).toHaveLength(1);
 expect(await sql`SELECT count(*)::integer AS n FROM public.invoices WHERE tenant_id=${KREILE_TENANT_SLUG} AND order_id=${order.orderId}`).toEqual([{n:1}]);
 const {getInvoiceReceiptAction,issueInvoiceAction}=await import('@/app/actions/invoices.actions');
 expect(await withSession(full,()=>getInvoiceReceiptAction({orderId:order.orderId,clientEventId:order.issueInput.clientEventId}))).toMatchObject({code:'OK'});
 expect(await withSession(full,()=>issueInvoiceAction(JSON.parse(JSON.stringify(order.issueInput))))).toMatchObject({code:'OK',replayed:true});
 const {confirmPaymentAction,getOrderPaymentStateAction}=await import('@/app/actions/payments.actions');
 const payment={invoiceId:order.invoice.invoiceId,amount:order.invoice.grossAmountCents,method:'bar' as const,expectedVersion:0,clientEventId:randomUUID()};
 const payments=await Promise.all([structuredClone(payment),JSON.parse(JSON.stringify(payment))].map(input=>withSession(full,()=>confirmPaymentAction(input))));
 expect(payments.map(row=>row.code)).toEqual(['OK','OK']);
 expect(payments.filter(row=>row.code==='OK'&&!row.replayed)).toHaveLength(1);
 expect(await withSession(full,()=>getOrderPaymentStateAction({orderId:order.orderId}))).toMatchObject({code:'OK',data:{payment:{status:'bezahlt',paymentVersion:1,paidAmountCents:order.invoice.grossAmountCents,openAmountCents:0}}});
 expect(await withSession(full,()=>confirmPaymentAction(structuredClone(payment)))).toMatchObject({code:'OK',replayed:true});
 const {getLiveOrderCardAction}=await import('@/app/actions/orders.actions');
 const card=await withSession(full,()=>getLiveOrderCardAction({orderId:order.orderId}));
 expect(card.code).toBe('OK');if(card.code!=='OK')throw Error('H8_PICKUP_READ:'+card.code);
 const {recordGoodsOutAction}=await import('@/app/actions/goodsOut.actions');
 const pickup={orderId:order.orderId,mode:'abholung' as const,expectedVersion:card.data.card.version,clientEventId:randomUUID()};
 const released=await Promise.all([structuredClone(pickup),JSON.parse(JSON.stringify(pickup))].map(input=>withSession(full,()=>recordGoodsOutAction(input))));
 expect(released.map(row=>row.code)).toEqual(['OK','OK']);
 expect(released.filter(row=>row.code==='OK'&&!row.replayed)).toHaveLength(1);
 expect(await withSession(full,()=>getLiveOrderCardAction({orderId:order.orderId}))).toMatchObject({code:'OK',data:{card:{station:'abgeholt'}}});
 expect(await withSession(full,()=>recordGoodsOutAction(structuredClone(pickup)))).toMatchObject({code:'OK',replayed:true});
 for(const key of [order.issueInput.clientEventId,payment.clientEventId,pickup.clientEventId])expect(await sql`SELECT user_id::text FROM public.events WHERE tenant_id=${KREILE_TENANT_SLUG} AND client_event_id=${key}::uuid`).toEqual([{user_id:full.actorId}]);
});

it('AF-A4 cash payment remains booked when goods-out conflicts; reread then releases once',async()=>{
 const order=await readyInvoiceOrder('AF-A4');
 const {confirmPaymentAction,getOrderPaymentStateAction,setPaymentModeAction}=await import('@/app/actions/payments.actions');
 const {recordGoodsOutAction}=await import('@/app/actions/goodsOut.actions');
 const {getLiveOrderCardAction}=await import('@/app/actions/orders.actions');
 const payment={invoiceId:order.invoice.invoiceId,amount:order.invoice.grossAmountCents,method:'bar' as const,expectedVersion:0,clientEventId:randomUUID()};
 const paid=await withSession(full,()=>confirmPaymentAction(payment));
 expect(paid.code).toBe('OK');if(paid.code!=='OK')throw Error('AF_A4_PAY:'+paid.code);
 const outKey=randomUUID();
 expect(await withSession(full,()=>recordGoodsOutAction({orderId:order.orderId,mode:'abholung',expectedVersion:order.version-1,clientEventId:outKey}))).toMatchObject({code:'CONFLICT'});
 expect(await sql`SELECT payment_status,payment_open_amount_cents,payment_paid_amount_cents,payment_method FROM public.invoices WHERE tenant_id=${KREILE_TENANT_SLUG} AND id=${order.invoice.invoiceId}::uuid`).toEqual([{payment_status:'bezahlt',payment_open_amount_cents:0,payment_paid_amount_cents:order.invoice.grossAmountCents,payment_method:'bar'}]);
 expect(await sql`SELECT count(*)::integer AS n FROM public.events WHERE tenant_id=${KREILE_TENANT_SLUG} AND client_event_id=${outKey}::uuid`).toEqual([{n:0}]);
 expect(await withSession(full,()=>getOrderPaymentStateAction({orderId:order.orderId}))).toMatchObject({code:'OK',data:{payment:{status:'bezahlt',openAmountCents:0},goodsOutAllowed:true}});
 expect(await withSession(full,()=>confirmPaymentAction(structuredClone(payment)))).toMatchObject({code:'OK',replayed:true});
 const card=await withSession(full,()=>getLiveOrderCardAction({orderId:order.orderId}));
 expect(card.code).toBe('OK');if(card.code!=='OK')throw Error('AF_A4_CARD:'+card.code);
 const out={orderId:order.orderId,mode:'abholung' as const,expectedVersion:card.data.card.version,clientEventId:outKey};
 const released=await withSession(full,()=>recordGoodsOutAction(out));
 expect(released.code).toBe('OK');if(released.code!=='OK')throw Error('AF_A4_OUT:'+released.code);
 expect(await withSession(full,()=>getOrderPaymentStateAction({orderId:order.orderId}))).toMatchObject({code:'OK',data:{physicalStatus:'abgeholt',payment:{status:'bezahlt'},goodsOutAllowed:false}});
 expect(await withSession(full,()=>recordGoodsOutAction(structuredClone(out)))).toMatchObject({code:'OK',replayed:true});
 const modeKey=randomUUID();
 expect(await withSession(full,()=>setPaymentModeAction({orderId:order.orderId,paymentMode:'vorkasse',expectedVersion:0,clientEventId:modeKey}))).toMatchObject({code:'CONFLICT'});
 expect(await sql`SELECT payment_mode,payment_mode_version FROM public.orders WHERE tenant_id=${KREILE_TENANT_SLUG} AND id=${order.orderId}`).toEqual([{payment_mode:'rechnung',payment_mode_version:0}]);
 for(const key of [payment.clientEventId,outKey])expect(await sql`SELECT user_id::text FROM public.events WHERE tenant_id=${KREILE_TENANT_SLUG} AND client_event_id=${key}::uuid`).toEqual([{user_id:full.actorId}]);
 expect(await sql`SELECT count(*)::integer AS n FROM public.events WHERE tenant_id=${KREILE_TENANT_SLUG} AND client_event_id=${modeKey}::uuid`).toEqual([{n:0}]);
});

it('H8 concurrent partial payments on one version book once; real reread pays the remaining balance once',async()=>{
 const order=await readyInvoiceOrder('Zahlung-parallel');
 const other=await createFixture(['auftraege','geld']);
 const {confirmPaymentAction,getOrderPaymentStateAction}=await import('@/app/actions/payments.actions');
 const half=Math.floor(order.invoice.grossAmountCents/2);
 const inputs=[randomUUID(),randomUUID()].map(clientEventId=>({invoiceId:order.invoice.invoiceId,amount:half,method:'ueberweisung' as const,expectedVersion:0,clientEventId}));
 const results=await Promise.all([withSession(full,()=>confirmPaymentAction(inputs[0])),withSession(other,()=>confirmPaymentAction(inputs[1]))]);
 expect(results.map(result=>result.code).sort()).toEqual(['CONFLICT','OK']);
 expect(await sql`SELECT payment_status,payment_open_amount_cents,payment_paid_amount_cents,payment_version FROM public.invoices WHERE tenant_id=${KREILE_TENANT_SLUG} AND id=${order.invoice.invoiceId}::uuid`).toEqual([{payment_status:'teilbezahlt',payment_open_amount_cents:order.invoice.grossAmountCents-half,payment_paid_amount_cents:half,payment_version:1}]);
 const event=await sql`SELECT user_id::text FROM public.events WHERE tenant_id=${KREILE_TENANT_SLUG} AND client_event_id=ANY(${sql.array(inputs.map(input=>input.clientEventId))}::uuid[])`;
 expect(event).toEqual([{user_id:results[0].code==='OK'?full.actorId:other.actorId}]);
 const read=await withSession(full,()=>getOrderPaymentStateAction({orderId:order.orderId}));
 expect(read.code).toBe('OK');if(read.code!=='OK'||!read.data.payment)throw Error('PAYMENT_REREAD:'+read.code);
 const remainder={invoiceId:order.invoice.invoiceId,amount:read.data.payment.openAmountCents,method:'ueberweisung' as const,expectedVersion:read.data.payment.paymentVersion,clientEventId:randomUUID()};
 expect(await withSession(full,()=>confirmPaymentAction(remainder))).toMatchObject({code:'OK'});
 expect(await withSession(full,()=>getOrderPaymentStateAction({orderId:order.orderId}))).toMatchObject({code:'OK',data:{payment:{status:'bezahlt',paidAmountCents:order.invoice.grossAmountCents,paymentVersion:2}}});
 expect(await withSession(full,()=>confirmPaymentAction(structuredClone(remainder)))).toMatchObject({code:'OK',replayed:true});
 expect(await sql`SELECT user_id::text FROM public.events WHERE tenant_id=${KREILE_TENANT_SLUG} AND client_event_id=${remainder.clientEventId}::uuid`).toEqual([{user_id:full.actorId}]);
});

it('payment rejection paths do not change the invoice: missing right, overpayment, stale version, zero and negative',async()=>{
 const order=await readyInvoiceOrder('Zahlung-Ablehnung');
 const limited=await createFixture(['auftraege']);
 const {confirmPaymentAction,getOrderPaymentStateAction}=await import('@/app/actions/payments.actions');
 const before=await sql`SELECT payment_status,payment_version,payment_open_amount_cents,payment_paid_amount_cents FROM public.invoices WHERE tenant_id=${KREILE_TENANT_SLUG} AND id=${order.invoice.invoiceId}::uuid`;
 const base={invoiceId:order.invoice.invoiceId,amount:order.invoice.grossAmountCents,method:'bar' as const,expectedVersion:0};
 const attempts=[{actor:limited,patch:{},code:'FORBIDDEN'},{actor:full,patch:{amount:order.invoice.grossAmountCents+1},code:'VALIDATION_ERROR'},{actor:full,patch:{expectedVersion:1},code:'CONFLICT'},{actor:full,patch:{amount:0},code:'VALIDATION_ERROR'},{actor:full,patch:{amount:-1},code:'VALIDATION_ERROR'}];
 const keys:string[]=[];
 for(const attempt of attempts){const key=randomUUID();keys.push(key);expect(await withSession(attempt.actor,()=>confirmPaymentAction({...base,...attempt.patch,clientEventId:key}))).toMatchObject({code:attempt.code});}
 expect(await sql`SELECT payment_status,payment_version,payment_open_amount_cents,payment_paid_amount_cents FROM public.invoices WHERE tenant_id=${KREILE_TENANT_SLUG} AND id=${order.invoice.invoiceId}::uuid`).toEqual(before);
 expect(await sql`SELECT count(*)::integer AS n FROM public.events WHERE tenant_id=${KREILE_TENANT_SLUG} AND client_event_id=ANY(${sql.array(keys)}::uuid[])`).toEqual([{n:0}]);
 expect(await withSession(full,()=>getOrderPaymentStateAction({orderId:order.orderId}))).toMatchObject({code:'OK',data:{payment:{status:'offen',openAmountCents:order.invoice.grossAmountCents,paymentVersion:0}}});
});
