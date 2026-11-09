import {randomUUID} from 'node:crypto';
import {expect,it} from 'vitest';
import {KREILE_TENANT_SLUG} from '@/lib/tenant';
import {sql,full,withSession,createFixture} from './replayHarness';
import {readyInvoiceOrder} from './orderFixture';

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
 expect(await withSession(full,()=>recordGoodsOutAction(input))).toMatchObject({code:'OK',replayed:true,receipt:{eventId:released.receipt.eventId}});
});
