// @vitest-environment node
// Schema-boundary proof only: the production writer/read port is not implemented here.
import {vi,it,expect} from 'vitest';
import {randomUUID} from 'node:crypto';
const tenant=vi.hoisted(()=>'TEST-ablauf-'+globalThis.crypto.randomUUID());
vi.mock('@/lib/tenant',()=>({KREILE_TENANT_SLUG:tenant}));
import {KREILE_TENANT_SLUG} from '@/lib/tenant';
import {sql,full,withSession} from '../../../e2e/ablauf/replayHarness';
import {customerFixture,intakeOrderFixture} from '../../../e2e/ablauf/orderFixture';
import {transitionWareneingangToGalvanikAction,setOrderItemFinishedAction} from '@/app/actions/orders.actions';
if(!process.env.DATABASE_URL||process.env.DATABASE_URL!==process.env.H18_EXPECTED_DATABASE_URL||new URL(process.env.DATABASE_URL).hostname!=='127.0.0.1')throw Error('PRODUCTION_SNAPSHOT_LOOPBACK_REQUIRED');

it('snapshot storage accepts an actual finish source, rejects mutation/foreign source/double counting and reverses its exact original facts',async()=>{
 const customer=await customerFixture('Produktionsbeleg'),created=await intakeOrderFixture('Produktionsbeleg',customer),orderId=created.receipt.orderId,itemId=created.receipt.items[0].id;
 const moved=await withSession(full,()=>transitionWareneingangToGalvanikAction({orderId,expectedVersion:1,clientEventId:randomUUID()}));if(moved.code!=='OK')throw Error('PRODUCTION_MOVE');
 const finish=await withSession(full,()=>setOrderItemFinishedAction({orderId,itemId,expectedVersion:moved.receipt.aggregateVersion,clientEventId:randomUUID(),finished:true}));if(finish.code!=='OK')throw Error('PRODUCTION_FINISH');
 const eventId=finish.receipt.eventId;
 await sql`INSERT INTO private.order_production_snapshots(event_id,tenant_id,order_id,item_id,occurred_at,direction,quantity,unit,net_cents,rework,valuation,price_source) SELECT id,tenant_id,order_id,item_id,created_at,1,1,'Stück',10000,false,'captured','{"test":"schema-only"}'::jsonb FROM public.events WHERE tenant_id=${KREILE_TENANT_SLUG} AND id=${eventId}`;
 expect(await sql`SELECT quantity::text,net_cents::int,direction FROM private.order_production_snapshots WHERE event_id=${eventId}`).toEqual([{quantity:'1.000',net_cents:10000,direction:1}]);
 await expect(sql`UPDATE private.order_production_snapshots SET net_cents=20000 WHERE event_id=${eventId}`).rejects.toThrow();
 await expect(sql`DELETE FROM private.order_production_snapshots WHERE event_id=${eventId}`).rejects.toThrow();
 await expect(sql`INSERT INTO private.order_production_snapshots SELECT event_id,'TEST-wrong-tenant',order_id,item_id,occurred_at,direction,quantity,unit,net_cents,rework,valuation,price_source,reverses_event_id FROM private.order_production_snapshots WHERE event_id=${eventId}`).rejects.toThrow('ORDER_PRODUCTION_EVENT_SOURCE_INVALID');
 await expect(sql`INSERT INTO private.order_production_snapshots SELECT * FROM private.order_production_snapshots WHERE event_id=${eventId}`).rejects.toThrow('ORDER_PRODUCTION_ALREADY_COUNTED');
 const reopen=await withSession(full,()=>setOrderItemFinishedAction({orderId,itemId,expectedVersion:finish.receipt.aggregateVersion,clientEventId:randomUUID(),finished:false}));if(reopen.code!=='OK')throw Error('PRODUCTION_REOPEN');
 await expect(sql`INSERT INTO private.order_production_snapshots(event_id,tenant_id,order_id,item_id,occurred_at,direction,quantity,unit,net_cents,rework,valuation,price_source,reverses_event_id) SELECT e.id,e.tenant_id,e.order_id,e.item_id,e.created_at,-1,p.quantity,p.unit,9999,p.rework,p.valuation,p.price_source,p.event_id FROM public.events e JOIN private.order_production_snapshots p ON p.event_id=${eventId} WHERE e.id=${reopen.receipt.eventId}`).rejects.toThrow('ORDER_PRODUCTION_REVERSAL_SOURCE_INVALID');
 await sql`INSERT INTO private.order_production_snapshots(event_id,tenant_id,order_id,item_id,occurred_at,direction,quantity,unit,net_cents,rework,valuation,price_source,reverses_event_id) SELECT e.id,e.tenant_id,e.order_id,e.item_id,e.created_at,-1,p.quantity,p.unit,p.net_cents,p.rework,p.valuation,p.price_source,p.event_id FROM public.events e JOIN private.order_production_snapshots p ON p.event_id=${eventId} WHERE e.id=${reopen.receipt.eventId}`;
 expect(await sql`SELECT sum(direction*net_cents)::int AS net FROM private.order_production_snapshots WHERE tenant_id=${KREILE_TENANT_SLUG} AND order_id=${orderId}`).toEqual([{net:0}]);
});
