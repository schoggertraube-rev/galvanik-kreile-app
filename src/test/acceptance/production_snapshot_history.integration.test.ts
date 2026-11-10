// @vitest-environment node
// Isolated pre-adoption tenant: legacy source rows are explicitly synthetic.
import {vi,it,expect} from 'vitest';
import {randomUUID} from 'node:crypto';
const tenant=vi.hoisted(()=>'TEST-ablauf-'+globalThis.crypto.randomUUID());
vi.mock('@/lib/tenant',()=>({KREILE_TENANT_SLUG:tenant}));
import {KREILE_TENANT_SLUG} from '@/lib/tenant';
import {sql,full,withSession,createFixture} from '../../../e2e/ablauf/replayHarness';
import {customerFixture,intakeOrderFixture} from '../../../e2e/ablauf/orderFixture';
import {transitionWareneingangToGalvanikAction,setOrderItemFinishedAction,changeOrderContentAction,getProductionWeekAction} from '@/app/actions/orders.actions';
if(!process.env.DATABASE_URL||process.env.DATABASE_URL!==process.env.H18_EXPECTED_DATABASE_URL||new URL(process.env.DATABASE_URL).hostname!=='127.0.0.1')throw Error('PRODUCTION_HISTORY_LOOPBACK_REQUIRED');

it('the real weekly action reconstructs explicitly synthetic legacy history once, preserves later captured facts and is readable without money rights',async()=>{
 const customer=await customerFixture('Altbestand-KW'),created=await intakeOrderFixture('Altbestand-KW',customer),orderId=created.receipt.orderId,itemId=created.receipt.items[0].id;
 const moved=await withSession(full,()=>transitionWareneingangToGalvanikAction({orderId,expectedVersion:1,clientEventId:randomUUID()}));if(moved.code!=='OK')throw Error('HISTORY_MOVE');
 const historicalId=randomUUID(),oldDate='2026-10-25T23:30:00.000Z',berlinDate='2026-10-26';
 // Explicit synthetic pre-adoption state. The tested reconstruction and all
 // subsequent reopen/finish/content/read actions are actual product code.
 await sql`INSERT INTO public.events(id,tenant_id,order_id,item_id,event_type,status,user_id,event_schema_version,payload,created_at) VALUES(${historicalId},${KREILE_TENANT_SLUG},${orderId},${itemId},'ORDER_ITEM_FINISHED_CHANGED_V1','success',${full.actorId}::uuid,1,'{"finished":true,"test":"synthetic-legacy-source"}'::jsonb,${oldDate}::timestamptz)`;
 await sql`UPDATE public.items SET current_station_id='fertig' WHERE tenant_id=${KREILE_TENANT_SLUG} AND id=${itemId}`;
 const reopened=await withSession(full,()=>setOrderItemFinishedAction({orderId,itemId,expectedVersion:moved.receipt.aggregateVersion,clientEventId:randomUUID(),finished:false}));if(reopened.code!=='OK')throw Error('HISTORY_REOPEN');
 const finished=await withSession(full,()=>setOrderItemFinishedAction({orderId,itemId,expectedVersion:reopened.receipt.aggregateVersion,clientEventId:randomUUID(),finished:true}));if(finished.code!=='OK')throw Error('HISTORY_FINISH');
 const changed=await withSession(full,()=>changeOrderContentAction({orderId,expectedVersion:finished.receipt.aggregateVersion,clientEventId:randomUUID(),note:'TEST heutiger Preis für historische Nachberechnung',items:[{id:itemId,catalogServiceId:null,name:'TEST Altbestand Teil',quantity:1,material:'Messing',surface:'Verchromen',unit:'Stück',unitPriceCents:20000,vatRateBasisPoints:1900}]}));if(changed.code!=='OK')throw Error('HISTORY_PRICE');
 const reader=await createFixture(['auftraege'],'werkstatt');
 const fault='test_history_receipt_'+randomUUID().replaceAll('-','');
 await sql.unsafe(`CREATE FUNCTION private.${fault}() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.tenant_id='${KREILE_TENANT_SLUG}' AND NEW.event_type='ORDER_PRODUCTION_HISTORY_REBUILT_V1' THEN RETURN NULL; END IF; RETURN NEW; END $$`);
 await sql.unsafe(`CREATE TRIGGER ${fault} BEFORE INSERT ON public.events FOR EACH ROW EXECUTE FUNCTION private.${fault}()`);
 try{
  expect(await withSession(reader,()=>getProductionWeekAction({onDate:berlinDate}))).toMatchObject({code:'UNAVAILABLE'});
  expect(await sql`SELECT id FROM public.events WHERE tenant_id=${KREILE_TENANT_SLUG} AND event_type='ORDER_PRODUCTION_HISTORY_REBUILT_V1'`).toHaveLength(0);
 }finally{await sql.unsafe(`DROP TRIGGER ${fault} ON public.events`);await sql.unsafe(`DROP FUNCTION private.${fault}()`);}
 const old=await withSession(reader,()=>getProductionWeekAction({onDate:berlinDate}));
 expect(old).toMatchObject({code:'OK',data:{weekStart:berlinDate,weekEndExclusive:'2026-11-02',netCents:10000,reconstructed:true,currentlyUnpricedItemCount:0}});
 expect(await withSession(reader,()=>getProductionWeekAction({onDate:'2026-10-25'}))).toMatchObject({code:'OK',data:{netCents:0}});
 expect(await sql`SELECT event_id,net_cents::int,valuation FROM private.order_production_snapshots WHERE tenant_id=${KREILE_TENANT_SLUG} AND order_id=${orderId} AND direction=1 ORDER BY occurred_at`).toEqual([{event_id:historicalId,net_cents:10000,valuation:'nachberechnet'},{event_id:finished.receipt.eventId,net_cents:10000,valuation:'captured'}]);
 expect(await withSession(reader,()=>getProductionWeekAction({onDate:new Date().toISOString().slice(0,10)}))).toMatchObject({code:'OK',data:{netCents:0}});
 expect(await withSession(reader,()=>getProductionWeekAction(JSON.parse(JSON.stringify({onDate:berlinDate}))))).toEqual(old);
 expect(await sql`SELECT id FROM public.events WHERE tenant_id=${KREILE_TENANT_SLUG} AND event_type='ORDER_PRODUCTION_HISTORY_REBUILT_V1'`).toHaveLength(1);
});
