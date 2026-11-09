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
