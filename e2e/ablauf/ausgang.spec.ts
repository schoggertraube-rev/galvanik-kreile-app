import {randomUUID} from 'node:crypto';
import {expect,it} from 'vitest';
import {KREILE_TENANT_SLUG} from '@/lib/tenant';
import {sql,full,withSession,createFixture} from './replayHarness';
import {readyInvoiceOrder} from './orderFixture';

it('S0 release readers and the actual writer use live payment facts instead of a stale stored ausgabe_frei flag',async()=>{
 const order=await readyInvoiceOrder('S0-Eine-Freigabe');
 const {setPaymentModeAction,confirmPaymentAction,getOrderPaymentStateAction}=await import('@/app/actions/payments.actions');
 const {getLiveOrderCardAction}=await import('@/app/actions/orders.actions');
 const {recordGoodsOutAction}=await import('@/app/actions/goodsOut.actions');
 const {resolveAuthorization}=await import('@/lib/server/authorization');
 const {readTenantOperationalOrders}=await import('@/lib/server/orderStationRead');
 const read=()=>withSession(full,async()=>{const auth=await resolveAuthorization();if(!auth.ok)throw Error('S0_AUTH');return readTenantOperationalOrders(auth.data);});
 expect(await withSession(full,()=>setPaymentModeAction({orderId:order.orderId,paymentMode:'abholung',expectedVersion:0,clientEventId:randomUUID()}))).toMatchObject({code:'OK'});
 expect((await read()).find(row=>row.id===order.orderId)).toMatchObject({ausgabeFrei:false});
 expect(await withSession(full,()=>getOrderPaymentStateAction({orderId:order.orderId}))).toMatchObject({code:'OK',data:{goodsOutAllowed:false}});
 // Isolated stale legacy TEST cache: this is never a product write path.
 await sql`UPDATE public.orders SET ausgabe_frei=true WHERE tenant_id=${KREILE_TENANT_SLUG} AND id=${order.orderId}`;
 expect((await read()).find(row=>row.id===order.orderId)).toMatchObject({ausgabeFrei:false});
 const card=await withSession(full,()=>getLiveOrderCardAction({orderId:order.orderId}));if(card.code!=='OK')throw Error('S0_CARD:'+card.code);
 const release={orderId:order.orderId,mode:'abholung' as const,expectedVersion:card.data.card.version,clientEventId:randomUUID()};
 expect(await withSession(full,()=>recordGoodsOutAction(release))).toMatchObject({code:'CONFLICT'});
 expect(await sql`SELECT count(*)::integer AS n FROM public.events WHERE tenant_id=${KREILE_TENANT_SLUG} AND client_event_id=${release.clientEventId}::uuid`).toEqual([{n:0}]);
 const payment={invoiceId:order.invoice.invoiceId,amount:order.invoice.grossAmountCents,method:'bar' as const,expectedVersion:0,clientEventId:randomUUID()};
 expect(await withSession(full,()=>confirmPaymentAction(payment))).toMatchObject({code:'OK'});
 await sql`UPDATE public.orders SET ausgabe_frei=false WHERE tenant_id=${KREILE_TENANT_SLUG} AND id=${order.orderId}`;
 expect((await read()).find(row=>row.id===order.orderId)).toMatchObject({ausgabeFrei:true});
 const out=await withSession(full,()=>recordGoodsOutAction(structuredClone(release)));
 expect(out).toMatchObject({code:'OK'});if(out.code!=='OK')throw Error('S0_RELEASE:'+out.code);
 expect((await read()).find(row=>row.id===order.orderId)).toMatchObject({ausgabeFrei:false,station:'abgeholt'});
 expect(await withSession(full,()=>recordGoodsOutAction(structuredClone(release)))).toMatchObject({code:'OK',replayed:true,receipt:{eventId:out.receipt.eventId}});
 expect(await sql`SELECT user_id::text FROM public.events WHERE tenant_id=${KREILE_TENANT_SLUG} AND client_event_id=${release.clientEventId}::uuid`).toEqual([{user_id:full.actorId}]);
 const afterReleaseKey=randomUUID();
 expect(await withSession(full,()=>recordGoodsOutAction({...release,expectedVersion:out.receipt.orderVersion,clientEventId:afterReleaseKey}))).toMatchObject({code:'VALIDATION_ERROR'});
 expect(await sql`SELECT count(*)::integer AS n FROM public.events WHERE tenant_id=${KREILE_TENANT_SLUG} AND client_event_id=${afterReleaseKey}::uuid`).toEqual([{n:0}]);
});

it('AF-A9 two actual logins releasing the same version produce one release and one version conflict',async()=>{
 const order=await readyInvoiceOrder('AF-A9');
 const other=await createFixture(['auftraege','geld']);
 const {recordGoodsOutAction}=await import('@/app/actions/goodsOut.actions');
 const {getLiveOrderCardAction}=await import('@/app/actions/orders.actions');
 const inputs=[randomUUID(),randomUUID()].map(clientEventId=>({orderId:order.orderId,mode:'abholung' as const,expectedVersion:order.version,clientEventId}));
 const results=await Promise.all([withSession(full,()=>recordGoodsOutAction(inputs[0])),withSession(other,()=>recordGoodsOutAction(inputs[1]))]);
 expect(results.map(result=>result.code).sort()).toEqual(['CONFLICT','OK']);
 const [winner]=results.filter(result=>result.code==='OK');
 if(winner.code!=='OK')throw Error('AF_A9_NO_WINNER');
 expect(await sql`SELECT station,version FROM public.orders WHERE tenant_id=${KREILE_TENANT_SLUG} AND id=${order.orderId}`).toEqual([{station:'abgeholt',version:winner.receipt.orderVersion}]);
 const events=await sql`SELECT client_event_id::text,user_id::text FROM public.events WHERE tenant_id=${KREILE_TENANT_SLUG} AND order_id=${order.orderId} AND client_event_id=ANY(${sql.array(inputs.map(input=>input.clientEventId))}::uuid[])`;
 expect(events).toHaveLength(1);
 expect(events[0].user_id).toBe(results[0].code==='OK'?full.actorId:other.actorId);
 // Both observers read the one winning state, not their local attempted state.
 for(const actor of [full,other])expect(await withSession(actor,()=>getLiveOrderCardAction({orderId:order.orderId}))).toMatchObject({code:'OK',data:{card:{station:'abgeholt',version:winner.receipt.orderVersion}}});
});

it('AP Fehlerweg fehlendes Recht: rejected release leaves the order and events unchanged',async()=>{
 const order=await readyInvoiceOrder('AF-Recht');
 const reader=await createFixture(['kunden']);
 const {recordGoodsOutAction}=await import('@/app/actions/goodsOut.actions');
 const key=randomUUID();
 expect(await withSession(reader,()=>recordGoodsOutAction({orderId:order.orderId,mode:'abholung',expectedVersion:order.version,clientEventId:key}))).toMatchObject({code:'FORBIDDEN'});
 expect(await sql`SELECT station,version FROM public.orders WHERE tenant_id=${KREILE_TENANT_SLUG} AND id=${order.orderId}`).toEqual([{station:'fertig',version:order.version}]);
 expect(await sql`SELECT count(*)::integer AS n FROM public.events WHERE tenant_id=${KREILE_TENANT_SLUG} AND client_event_id=${key}::uuid`).toEqual([{n:0}]);
 const {getLiveOrderCardAction}=await import('@/app/actions/orders.actions');
 expect(await withSession(full,()=>getLiveOrderCardAction({orderId:order.orderId}))).toMatchObject({code:'OK',data:{card:{station:'fertig',version:order.version}}});
});

it('W17 stale release writes nothing; rereading permits the unchanged intent with the current version',async()=>{
 const order=await readyInvoiceOrder('AF-Konflikt');
 const {recordGoodsOutAction}=await import('@/app/actions/goodsOut.actions');
 const {getLiveOrderCardAction}=await import('@/app/actions/orders.actions');
 const key=randomUUID();
 expect(await withSession(full,()=>recordGoodsOutAction({orderId:order.orderId,mode:'abholung',expectedVersion:order.version-1,clientEventId:key}))).toMatchObject({code:'CONFLICT'});
 expect(await sql`SELECT count(*)::integer AS n FROM public.events WHERE tenant_id=${KREILE_TENANT_SLUG} AND client_event_id=${key}::uuid`).toEqual([{n:0}]);
 const read=await withSession(full,()=>getLiveOrderCardAction({orderId:order.orderId}));
 expect(read.code).toBe('OK');if(read.code!=='OK')throw Error('AF_READBACK:'+read.code);
 const released=await withSession(full,()=>recordGoodsOutAction({orderId:order.orderId,mode:'abholung',expectedVersion:read.data.card.version,clientEventId:key}));
 expect(released.code).toBe('OK');if(released.code!=='OK')throw Error('AF_RELEASE:'+released.code);
 expect(await withSession(full,()=>getLiveOrderCardAction({orderId:order.orderId}))).toMatchObject({code:'OK',data:{card:{station:'abgeholt',version:released.receipt.orderVersion}}});
 expect(await sql`SELECT user_id::text FROM public.events WHERE tenant_id=${KREILE_TENANT_SLUG} AND client_event_id=${key}::uuid`).toEqual([{user_id:full.actorId}]);
});

it('L5 released order cannot be released again with a fresh key and current version',async()=>{
 const order=await readyInvoiceOrder('AF-Endzustand');
 const {recordGoodsOutAction}=await import('@/app/actions/goodsOut.actions');
 const {getLiveOrderCardAction}=await import('@/app/actions/orders.actions');
 const input={orderId:order.orderId,mode:'abholung' as const,expectedVersion:order.version,clientEventId:randomUUID()};
 const released=await withSession(full,()=>recordGoodsOutAction(input));
 expect(released.code).toBe('OK');if(released.code!=='OK')throw Error('AF_RELEASE:'+released.code);
 const read=await withSession(full,()=>getLiveOrderCardAction({orderId:order.orderId}));
 expect(read.code).toBe('OK');if(read.code!=='OK')throw Error('AF_READBACK:'+read.code);
 const secondKey=randomUUID();
 expect(await withSession(full,()=>recordGoodsOutAction({...input,expectedVersion:read.data.card.version,clientEventId:secondKey}))).toMatchObject({code:'VALIDATION_ERROR'});
 expect(await sql`SELECT station,version FROM public.orders WHERE tenant_id=${KREILE_TENANT_SLUG} AND id=${order.orderId}`).toEqual([{station:'abgeholt',version:released.receipt.orderVersion}]);
 expect(await sql`SELECT count(*)::integer AS n FROM public.events WHERE tenant_id=${KREILE_TENANT_SLUG} AND client_event_id=${secondKey}::uuid`).toEqual([{n:0}]);
 expect(await withSession(full,()=>recordGoodsOutAction(structuredClone(input)))).toMatchObject({code:'OK',replayed:true,receipt:{eventId:released.receipt.eventId}});
});
