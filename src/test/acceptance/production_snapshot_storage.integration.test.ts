// @vitest-environment node
// Completion and reversal use the actual existing commands and persisted receipts.
// Historical reconstruction uses a separate pre-adoption tenant test.
import {vi,it,expect} from 'vitest';
import {randomUUID} from 'node:crypto';
const tenant=vi.hoisted(()=>'TEST-ablauf-'+globalThis.crypto.randomUUID());
vi.mock('@/lib/tenant',()=>({KREILE_TENANT_SLUG:tenant}));
import {KREILE_TENANT_SLUG} from '@/lib/tenant';
import {sql,full,withSession,createFixture} from '../../../e2e/ablauf/replayHarness';
import {customerFixture,intakeOrderFixture} from '../../../e2e/ablauf/orderFixture';
import {transitionWareneingangToGalvanikAction,setOrderItemFinishedAction,changeOrderContentAction,getLiveOrderCardAction,freezeOrderAction,reopenFrozenOrderAction,getExtraWorkMasterDataAction,setExtraWorkHourlyRateAction,configureExtraWorkCatalogPositionAction,changeOrderItemExtraWorkAction} from '@/app/actions/orders.actions';
import {storeItemPhoto} from '../../../e2e/ablauf/photoFixture';
import {getProductionWeekAction} from '@/app/actions/orders.actions';
import {setInvoiceItemPricesAction} from '@/app/actions/invoices.actions';
if(!process.env.DATABASE_URL||process.env.DATABASE_URL!==process.env.H18_EXPECTED_DATABASE_URL||new URL(process.env.DATABASE_URL).hostname!=='127.0.0.1')throw Error('PRODUCTION_SNAPSHOT_LOOPBACK_REQUIRED');

it('snapshot storage accepts an actual finish source, rejects mutation/foreign source/double counting and reverses its exact original facts',async()=>{
 const customer=await customerFixture('Produktionsbeleg'),created=await intakeOrderFixture('Produktionsbeleg',customer),orderId=created.receipt.orderId,itemId=created.receipt.items[0].id;
 const moved=await withSession(full,()=>transitionWareneingangToGalvanikAction({orderId,expectedVersion:1,clientEventId:randomUUID()}));if(moved.code!=='OK')throw Error('PRODUCTION_MOVE');
 const finish=await withSession(full,()=>setOrderItemFinishedAction({orderId,itemId,expectedVersion:moved.receipt.aggregateVersion,clientEventId:randomUUID(),finished:true}));if(finish.code!=='OK')throw Error('PRODUCTION_FINISH');
 const eventId=finish.receipt.eventId;
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

it('pricing through the existing invoice route after full freeze updates the weekly source and the actual order card',async()=>{
 const customer=await customerFixture('Preis-nach-Freeze'),created=await intakeOrderFixture('Preis-nach-Freeze',customer),orderId=created.receipt.orderId,itemId=created.receipt.items[0].id;
 const changed=await withSession(full,()=>changeOrderContentAction({orderId,expectedVersion:1,clientEventId:randomUUID(),note:'TEST Preis wird nach Fertig ergänzt',items:[{id:itemId,catalogServiceId:null,name:'TEST Ware ohne Preis',quantity:2,material:'Messing',surface:'Verchromen',unit:'Stück',unitPriceCents:null,vatRateBasisPoints:null}]}));if(changed.code!=='OK')throw Error('INVOICE_WEEK_CONTENT');
 const moved=await withSession(full,()=>transitionWareneingangToGalvanikAction({orderId,expectedVersion:changed.receipt.aggregateVersion,clientEventId:randomUUID()}));if(moved.code!=='OK')throw Error('INVOICE_WEEK_MOVE');
 const master=await withSession(full,()=>getExtraWorkMasterDataAction());if(master.code!=='OK')throw Error('INVOICE_WEEK_MASTER');
 if(!master.data.currentRate)expect(await withSession(full,()=>setExtraWorkHourlyRateAction({rateId:randomUUID(),expectedVersion:0,hourlyRateCents:12000,clientEventId:randomUUID()}))).toMatchObject({code:'OK'});
 await storeItemPhoto(orderId,itemId);
 const frozen=await withSession(full,()=>freezeOrderAction({orderId,freezeId:randomUUID(),expectedVersion:moved.receipt.aggregateVersion,clientEventId:randomUUID()}));if(frozen.code!=='OK')throw Error('INVOICE_WEEK_FREEZE');
 const before=await withSession(full,()=>getProductionWeekAction());if(before.code!=='OK')throw Error('INVOICE_WEEK_BEFORE');
 expect(before.data.currentlyUnpricedItemCount).toBe(1);
 const input={orderId,expectedVersion:frozen.receipt.aggregateVersion,clientEventId:randomUUID(),prices:[{itemId,unitPriceCents:5000}]};
 const priced=await withSession(full,()=>setInvoiceItemPricesAction(input));if(priced.code!=='OK')throw Error('INVOICE_WEEK_PRICE');
 expect(await withSession(full,()=>setInvoiceItemPricesAction(JSON.parse(JSON.stringify(input))))).toMatchObject({code:'OK',replayed:true});
 const other=await createFixture(['geld']);
 expect(await withSession(other,()=>setInvoiceItemPricesAction(JSON.parse(JSON.stringify(input))))).toMatchObject({code:'CONFLICT'});
 expect(await withSession(full,()=>getLiveOrderCardAction({orderId}))).toMatchObject({code:'OK',data:{card:{items:[expect.objectContaining({id:itemId,unitPriceCents:5000,finished:true})]}}});
 const after=await withSession(full,()=>getProductionWeekAction());if(after.code!=='OK')throw Error('INVOICE_WEEK_AFTER');
 expect(after.data.netCents-before.data.netCents).toBe(10000);
 expect(after.data.currentlyUnpricedItemCount).toBe(0);
 expect(await sql`SELECT event_id,net_cents::int FROM private.order_production_snapshots WHERE tenant_id=${KREILE_TENANT_SLUG} AND order_id=${orderId} AND component='pricing'`).toEqual([{event_id:priced.receipt.eventId,net_cents:10000}]);
});

it('extra work counts only from the real frozen line and reversal keeps that amount after a rate change',async()=>{
 const customer=await customerFixture('Mehrarbeit-KW'),created=await intakeOrderFixture('Mehrarbeit-KW',customer),orderId=created.receipt.orderId,itemId=created.receipt.items[0].id;
 const moved=await withSession(full,()=>transitionWareneingangToGalvanikAction({orderId,expectedVersion:1,clientEventId:randomUUID()}));if(moved.code!=='OK')throw Error('EXTRA_MOVE');
 const positionId=randomUUID();
 expect(await withSession(full,()=>configureExtraWorkCatalogPositionAction({positionId,expectedVersion:0,name:'TEST Zusatzarbeit',standardMinutes:60,active:true,clientEventId:randomUUID()}))).toMatchObject({code:'OK'});
 const initialMaster=await withSession(full,()=>getExtraWorkMasterDataAction());if(initialMaster.code!=='OK')throw Error('EXTRA_INITIAL_MASTER');
 expect(await withSession(full,()=>setExtraWorkHourlyRateAction({rateId:randomUUID(),expectedVersion:initialMaster.data.currentRate?.version??0,hourlyRateCents:5000,clientEventId:randomUUID()}))).toMatchObject({code:'OK'});
 const extra=await withSession(full,()=>changeOrderItemExtraWorkAction({lineId:randomUUID(),orderId,itemId,catalogPositionId:positionId,minutes:60,active:true,expectedLineVersion:0,expectedOrderVersion:moved.receipt.aggregateVersion,clientEventId:randomUUID()}));if(extra.code!=='OK')throw Error('EXTRA_WRITE');
 await storeItemPhoto(orderId,itemId);
 const finished=await withSession(full,()=>setOrderItemFinishedAction({orderId,itemId,expectedVersion:extra.receipt.aggregateVersion,clientEventId:randomUUID(),finished:true}));if(finished.code!=='OK')throw Error('EXTRA_FINISH');
 expect(await sql`SELECT component,net_cents::int FROM private.order_production_snapshots WHERE tenant_id=${KREILE_TENANT_SLUG} AND order_id=${orderId}`).toEqual([{component:'base',net_cents:10000}]);
 const master=await withSession(full,()=>getExtraWorkMasterDataAction());if(master.code!=='OK')throw Error('EXTRA_MASTER');
 const rate=await withSession(full,()=>setExtraWorkHourlyRateAction({rateId:randomUUID(),expectedVersion:master.data.currentRate?.version??0,hourlyRateCents:6000,clientEventId:randomUUID()}));if(rate.code!=='OK')throw Error('EXTRA_RATE');
 const freezeInput={orderId,freezeId:randomUUID(),expectedVersion:finished.receipt.aggregateVersion,clientEventId:randomUUID()};
 const fault='test_extra_capture_'+randomUUID().replaceAll('-','');
 await sql.unsafe(`CREATE FUNCTION private.${fault}() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.tenant_id='${KREILE_TENANT_SLUG}' AND NEW.order_id='${orderId}' AND NEW.component='extra' THEN RETURN NULL; END IF; RETURN NEW; END $$`);
 await sql.unsafe(`CREATE TRIGGER ${fault} BEFORE INSERT ON private.order_production_snapshots FOR EACH ROW EXECUTE FUNCTION private.${fault}()`);
 try{
  expect(await withSession(full,()=>freezeOrderAction(freezeInput))).toMatchObject({code:'UNAVAILABLE'});
  expect(await sql`SELECT version,station FROM public.orders WHERE tenant_id=${KREILE_TENANT_SLUG} AND id=${orderId}`).toEqual([{version:finished.receipt.aggregateVersion,station:'galvanik'}]);
  expect(await sql`SELECT id FROM private.order_freezes WHERE tenant_id=${KREILE_TENANT_SLUG} AND id=${freezeInput.freezeId}::uuid`).toHaveLength(0);
 }finally{await sql.unsafe(`DROP TRIGGER ${fault} ON private.order_production_snapshots`);await sql.unsafe(`DROP FUNCTION private.${fault}()`);}
 const frozen=await withSession(full,()=>freezeOrderAction(JSON.parse(JSON.stringify(freezeInput))));if(frozen.code!=='OK')throw Error('EXTRA_FREEZE');
 expect(await sql`SELECT component,net_cents::int,origin_event_id FROM private.order_production_snapshots WHERE tenant_id=${KREILE_TENANT_SLUG} AND order_id=${orderId} AND component='extra'`).toEqual([{component:'extra',net_cents:6000,origin_event_id:finished.receipt.eventId}]);
 expect(await withSession(full,()=>setExtraWorkHourlyRateAction({rateId:randomUUID(),expectedVersion:rate.receipt.aggregateVersion,hourlyRateCents:9000,clientEventId:randomUUID()}))).toMatchObject({code:'OK'});
 const request={orderId,expectedVersion:frozen.receipt.aggregateVersion,reason:'TEST eingefrorene Mehrarbeit zurücknehmen',clientEventId:randomUUID()};
 const reopened=await withSession(full,()=>reopenFrozenOrderAction(request));if(reopened.code!=='OK')throw Error('EXTRA_REOPEN');
 expect(await withSession(full,()=>reopenFrozenOrderAction(JSON.parse(JSON.stringify(request))))).toMatchObject({code:'OK',replayed:true});
 expect(await sql`SELECT component,net_cents::int FROM private.order_production_snapshots WHERE tenant_id=${KREILE_TENANT_SLUG} AND event_id=${reopened.receipt.eventId} ORDER BY component`).toEqual([{component:'base',net_cents:10000},{component:'extra',net_cents:6000}]);
 expect(await withSession(full,()=>getLiveOrderCardAction({orderId}))).toMatchObject({code:'OK',data:{card:{station:'galvanik'}}});
});
it('the actual full-freeze correction reverses a prior item completion once without pricing it again',async()=>{
 const customer=await customerFixture('Gesamt-Ruecknahme'),created=await intakeOrderFixture('Gesamt-Ruecknahme',customer),orderId=created.receipt.orderId,itemId=created.receipt.items[0].id;
 const moved=await withSession(full,()=>transitionWareneingangToGalvanikAction({orderId,expectedVersion:1,clientEventId:randomUUID()}));if(moved.code!=='OK')throw Error('FULL_REVERSE_MOVE');
 await storeItemPhoto(orderId,itemId);
 const finished=await withSession(full,()=>setOrderItemFinishedAction({orderId,itemId,expectedVersion:moved.receipt.aggregateVersion,clientEventId:randomUUID(),finished:true}));if(finished.code!=='OK')throw Error('FULL_REVERSE_FINISH');
 const master=await withSession(full,()=>getExtraWorkMasterDataAction());if(master.code!=='OK')throw Error('FULL_REVERSE_MASTER');
 if(!master.data.currentRate)expect(await withSession(full,()=>setExtraWorkHourlyRateAction({rateId:randomUUID(),expectedVersion:0,hourlyRateCents:14000,clientEventId:randomUUID()}))).toMatchObject({code:'OK'});
 const frozen=await withSession(full,()=>freezeOrderAction({orderId,freezeId:randomUUID(),expectedVersion:finished.receipt.aggregateVersion,clientEventId:randomUUID()}));if(frozen.code!=='OK')throw Error('FULL_REVERSE_FREEZE');
 expect(await sql`SELECT event_id FROM private.order_production_snapshots WHERE tenant_id=${KREILE_TENANT_SLUG} AND order_id=${orderId} AND direction=1`).toEqual([{event_id:finished.receipt.eventId}]);
 const request={orderId,expectedVersion:frozen.receipt.aggregateVersion,reason:'TEST Gesamtfertig mit Originalwert zurücknehmen',clientEventId:randomUUID()};
 const reopened=await withSession(full,()=>reopenFrozenOrderAction(request));expect(reopened.code).toBe('OK');if(reopened.code!=='OK')throw Error('FULL_REVERSE_REOPEN');
 expect(await withSession(full,()=>reopenFrozenOrderAction(JSON.parse(JSON.stringify(request))))).toMatchObject({code:'OK',replayed:true,receipt:{eventId:reopened.receipt.eventId}});
 expect(await sql`SELECT direction,net_cents::int,reverses_event_id FROM private.order_production_snapshots WHERE tenant_id=${KREILE_TENANT_SLUG} AND event_id=${reopened.receipt.eventId}`).toEqual([{direction:-1,net_cents:10000,reverses_event_id:finished.receipt.eventId}]);
 expect(await withSession(full,()=>getLiveOrderCardAction({orderId}))).toMatchObject({code:'OK',data:{card:{station:'galvanik',version:reopened.receipt.aggregateVersion,items:[expect.objectContaining({id:itemId,finished:false})]}}});
});

it('completion without a price remains possible; a missing snapshot receipt rolls the real finish back and fresh retry saves exactly once',async()=>{
 const customer=await customerFixture('Ohne-Preis'),created=await intakeOrderFixture('Ohne-Preis',customer),orderId=created.receipt.orderId,itemId=created.receipt.items[0].id;
 const changed=await withSession(full,()=>changeOrderContentAction({orderId,expectedVersion:1,clientEventId:randomUUID(),note:'TEST noch ohne Preis',items:[{id:itemId,catalogServiceId:null,name:'TEST Preis offen',quantity:3,material:'Messing',surface:'Verchromen',unit:'Stück',unitPriceCents:null,vatRateBasisPoints:null}]}));if(changed.code!=='OK')throw Error('UNPRICED_CONTENT');
 const moved=await withSession(full,()=>transitionWareneingangToGalvanikAction({orderId,expectedVersion:changed.receipt.aggregateVersion,clientEventId:randomUUID()}));if(moved.code!=='OK')throw Error('UNPRICED_MOVE');
 const input={orderId,itemId,expectedVersion:moved.receipt.aggregateVersion,clientEventId:randomUUID(),finished:true};
 const name='test_production_capture_'+randomUUID().replaceAll('-','');
 await sql.unsafe(`CREATE FUNCTION private.${name}() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.tenant_id='${KREILE_TENANT_SLUG}' AND NEW.order_id='${orderId}' THEN RETURN NULL; END IF; RETURN NEW; END $$`);
 await sql.unsafe(`CREATE TRIGGER ${name} BEFORE INSERT ON private.order_production_snapshots FOR EACH ROW EXECUTE FUNCTION private.${name}()`);
 try{
  expect(await withSession(full,()=>setOrderItemFinishedAction(input))).toMatchObject({code:'UNAVAILABLE'});
  expect(await sql`SELECT version FROM public.orders WHERE tenant_id=${KREILE_TENANT_SLUG} AND id=${orderId}`).toEqual([{version:moved.receipt.aggregateVersion}]);
  expect(await sql`SELECT id FROM public.events WHERE tenant_id=${KREILE_TENANT_SLUG} AND client_event_id=${input.clientEventId}::uuid`).toHaveLength(0);
 }finally{await sql.unsafe(`DROP TRIGGER ${name} ON private.order_production_snapshots`);await sql.unsafe(`DROP FUNCTION private.${name}()`);}
 const finished=await withSession(full,()=>setOrderItemFinishedAction(JSON.parse(JSON.stringify(input))));if(finished.code!=='OK')throw Error('UNPRICED_FINISH');
 expect(await withSession(full,()=>setOrderItemFinishedAction(JSON.parse(JSON.stringify(input))))).toMatchObject({code:'OK',replayed:true});
 expect(await sql`SELECT quantity::text,net_cents,valuation FROM private.order_production_snapshots WHERE tenant_id=${KREILE_TENANT_SLUG} AND order_id=${orderId}`).toEqual([{quantity:'3.000',net_cents:null,valuation:'captured'}]);
 const card=await withSession(full,()=>getLiveOrderCardAction({orderId})); if(card.code!=='OK')throw Error(JSON.stringify(card)); expect(card).toMatchObject({code:'OK',data:{card:{items:[expect.objectContaining({id:itemId,finished:true})]}}});
 const beforePricing=await withSession(full,()=>getProductionWeekAction());if(beforePricing.code!=='OK')throw Error('UNPRICED_WEEK_READ');
 expect(beforePricing.data.currentlyUnpricedItemCount).toBe(1);
 const priceInput={orderId,expectedVersion:finished.receipt.aggregateVersion,clientEventId:randomUUID(),note:'TEST Preis nach Fertig erfasst',items:[{id:itemId,catalogServiceId:null,name:'TEST Preis offen',quantity:3,material:'Messing',surface:'Verchromen',unit:'Stück',unitPriceCents:2000,vatRateBasisPoints:1900 as const}]};
 const priced=await withSession(full,()=>changeOrderContentAction(priceInput));if(priced.code!=='OK')throw Error('LATE_PRICE');
 expect(await withSession(full,()=>changeOrderContentAction(JSON.parse(JSON.stringify(priceInput))))).toMatchObject({code:'OK',replayed:true});
 expect(await sql`SELECT event_id,net_cents::int,origin_event_id FROM private.order_production_snapshots WHERE tenant_id=${KREILE_TENANT_SLUG} AND order_id=${orderId} AND component='pricing'`).toEqual([{event_id:priced.receipt.eventId,net_cents:6000,origin_event_id:finished.receipt.eventId}]);
 const afterPricing=await withSession(full,()=>getProductionWeekAction());if(afterPricing.code!=='OK')throw Error('PRICED_WEEK_READ');
 expect(afterPricing.data.currentlyUnpricedItemCount).toBe(0);
 expect(afterPricing.data.netCents-beforePricing.data.netCents).toBe(6000);
 const reopened=await withSession(full,()=>setOrderItemFinishedAction({orderId,itemId,expectedVersion:priced.receipt.aggregateVersion,clientEventId:randomUUID(),finished:false}));if(reopened.code!=='OK')throw Error('LATE_PRICE_REOPEN');
 expect(await sql`SELECT component,net_cents::int FROM private.order_production_snapshots WHERE tenant_id=${KREILE_TENANT_SLUG} AND event_id=${reopened.receipt.eventId} ORDER BY component`).toEqual([{component:'base',net_cents:null},{component:'pricing',net_cents:6000}]);
 expect(await withSession(full,()=>getProductionWeekAction())).toMatchObject({code:'OK',data:{netCents:beforePricing.data.netCents,currentlyUnpricedItemCount:0}});
});
