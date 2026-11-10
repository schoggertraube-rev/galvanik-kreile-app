// @vitest-environment node
// Positive capture is synthetic schema setup; reversal uses the actual existing command.
// Positive production capture, historical backfill and the weekly reader remain unfinished.
import {vi,it,expect} from 'vitest';
import {randomUUID} from 'node:crypto';
const tenant=vi.hoisted(()=>'TEST-ablauf-'+globalThis.crypto.randomUUID());
vi.mock('@/lib/tenant',()=>({KREILE_TENANT_SLUG:tenant}));
import {KREILE_TENANT_SLUG} from '@/lib/tenant';
import {sql,full,withSession} from '../../../e2e/ablauf/replayHarness';
import {customerFixture,intakeOrderFixture} from '../../../e2e/ablauf/orderFixture';
import {transitionWareneingangToGalvanikAction,setOrderItemFinishedAction,changeOrderContentAction,getLiveOrderCardAction,freezeOrderAction,reopenFrozenOrderAction,getExtraWorkMasterDataAction,setExtraWorkHourlyRateAction} from '@/app/actions/orders.actions';
import {storeItemPhoto} from '../../../e2e/ablauf/photoFixture';
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
 const changed=await withSession(full,()=>changeOrderContentAction({orderId,expectedVersion:finish.receipt.aggregateVersion,clientEventId:randomUUID(),note:'TEST heutige Menge/Preis sind anders',items:[{id:itemId,catalogServiceId:null,name:'TEST Produktionsbeleg Teil',quantity:2,material:'Messing',surface:'Verchromen',unit:'Stück',unitPriceCents:20000,vatRateBasisPoints:1900}]}));if(changed.code!=='OK')throw Error('PRODUCTION_CONTENT_CHANGED');
 const reopenInput={orderId,itemId,expectedVersion:changed.receipt.aggregateVersion,clientEventId:randomUUID(),finished:false};
 const name='test_production_reverse_'+randomUUID().replaceAll('-','');
 await sql.unsafe(`CREATE FUNCTION private.${name}() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.tenant_id='${KREILE_TENANT_SLUG}' AND NEW.direction=-1 THEN RETURN NULL; END IF; RETURN NEW; END $$`);
 await sql.unsafe(`CREATE TRIGGER ${name} BEFORE INSERT ON private.order_production_snapshots FOR EACH ROW EXECUTE FUNCTION private.${name}()`);
 try{
  expect(await withSession(full,()=>setOrderItemFinishedAction(reopenInput))).toMatchObject({code:'UNAVAILABLE'});
  expect(await sql`SELECT version FROM public.orders WHERE tenant_id=${KREILE_TENANT_SLUG} AND id=${orderId}`).toEqual([{version:changed.receipt.aggregateVersion}]);
  expect(await sql`SELECT current_station_id FROM public.items WHERE tenant_id=${KREILE_TENANT_SLUG} AND id=${itemId}`).toEqual([{current_station_id:'fertig'}]);
  expect(await sql`SELECT id FROM public.events WHERE tenant_id=${KREILE_TENANT_SLUG} AND client_event_id=${reopenInput.clientEventId}::uuid`).toHaveLength(0);
 }finally{await sql.unsafe(`DROP TRIGGER ${name} ON private.order_production_snapshots`);await sql.unsafe(`DROP FUNCTION private.${name}()`);}
 const reopen=await withSession(full,()=>setOrderItemFinishedAction(reopenInput));if(reopen.code!=='OK')throw Error('PRODUCTION_REOPEN');
 expect(await withSession(full,()=>setOrderItemFinishedAction(JSON.parse(JSON.stringify(reopenInput))))).toMatchObject({code:'OK',replayed:true,receipt:{eventId:reopen.receipt.eventId}});
 expect(await withSession(full,()=>getLiveOrderCardAction({orderId}))).toMatchObject({code:'OK',data:{card:{version:reopen.receipt.aggregateVersion,items:[expect.objectContaining({id:itemId,finished:false})]}}});
 expect(await sql`SELECT quantity::text,net_cents::int,direction,reverses_event_id FROM private.order_production_snapshots WHERE event_id=${reopen.receipt.eventId}`).toEqual([{quantity:'1.000',net_cents:10000,direction:-1,reverses_event_id:eventId}]);
 await expect(sql`INSERT INTO private.order_production_snapshots(event_id,tenant_id,order_id,item_id,occurred_at,direction,quantity,unit,net_cents,rework,valuation,price_source,reverses_event_id) SELECT e.id,e.tenant_id,e.order_id,e.item_id,e.created_at,-1,p.quantity,p.unit,9999,p.rework,p.valuation,p.price_source,p.event_id FROM public.events e JOIN private.order_production_snapshots p ON p.event_id=${eventId} WHERE e.id=${reopen.receipt.eventId}`).rejects.toThrow('ORDER_PRODUCTION_REVERSAL_SOURCE_INVALID');

 expect(await sql`SELECT sum(direction*net_cents)::int AS net FROM private.order_production_snapshots WHERE tenant_id=${KREILE_TENANT_SLUG} AND order_id=${orderId}`).toEqual([{net:0}]);
});
it('the actual full-freeze correction reverses a prior item completion once without pricing it again',async()=>{
 const customer=await customerFixture('Gesamt-Ruecknahme'),created=await intakeOrderFixture('Gesamt-Ruecknahme',customer),orderId=created.receipt.orderId,itemId=created.receipt.items[0].id;
 const moved=await withSession(full,()=>transitionWareneingangToGalvanikAction({orderId,expectedVersion:1,clientEventId:randomUUID()}));if(moved.code!=='OK')throw Error('FULL_REVERSE_MOVE');
 await storeItemPhoto(orderId,itemId);
 const finished=await withSession(full,()=>setOrderItemFinishedAction({orderId,itemId,expectedVersion:moved.receipt.aggregateVersion,clientEventId:randomUUID(),finished:true}));if(finished.code!=='OK')throw Error('FULL_REVERSE_FINISH');
 // Explicit schema setup while positive capture awaits the valuation decision.
 await sql`INSERT INTO private.order_production_snapshots(event_id,tenant_id,order_id,item_id,occurred_at,direction,quantity,unit,net_cents,rework,valuation,price_source) SELECT id,tenant_id,order_id,item_id,created_at,1,1,'Stück',10000,false,'captured','{"test":"schema-only"}'::jsonb FROM public.events WHERE tenant_id=${KREILE_TENANT_SLUG} AND id=${finished.receipt.eventId}`;
 const master=await withSession(full,()=>getExtraWorkMasterDataAction());if(master.code!=='OK')throw Error('FULL_REVERSE_MASTER');
 if(!master.data.currentRate)expect(await withSession(full,()=>setExtraWorkHourlyRateAction({rateId:randomUUID(),expectedVersion:0,hourlyRateCents:14000,clientEventId:randomUUID()}))).toMatchObject({code:'OK'});
 const frozen=await withSession(full,()=>freezeOrderAction({orderId,freezeId:randomUUID(),expectedVersion:finished.receipt.aggregateVersion,clientEventId:randomUUID()}));if(frozen.code!=='OK')throw Error('FULL_REVERSE_FREEZE');
 const request={orderId,expectedVersion:frozen.receipt.aggregateVersion,reason:'TEST Gesamtfertig mit Originalwert zurücknehmen',clientEventId:randomUUID()};
 const reopened=await withSession(full,()=>reopenFrozenOrderAction(request));expect(reopened.code).toBe('OK');if(reopened.code!=='OK')throw Error('FULL_REVERSE_REOPEN');
 expect(await withSession(full,()=>reopenFrozenOrderAction(JSON.parse(JSON.stringify(request))))).toMatchObject({code:'OK',replayed:true,receipt:{eventId:reopened.receipt.eventId}});
 expect(await sql`SELECT direction,net_cents::int,reverses_event_id FROM private.order_production_snapshots WHERE tenant_id=${KREILE_TENANT_SLUG} AND event_id=${reopened.receipt.eventId}`).toEqual([{direction:-1,net_cents:10000,reverses_event_id:finished.receipt.eventId}]);
 expect(await withSession(full,()=>getLiveOrderCardAction({orderId}))).toMatchObject({code:'OK',data:{card:{station:'galvanik',version:reopened.receipt.aggregateVersion,items:[expect.objectContaining({id:itemId,finished:false})]}}});
});
