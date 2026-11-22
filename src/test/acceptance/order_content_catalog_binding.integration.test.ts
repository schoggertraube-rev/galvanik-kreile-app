// @vitest-environment node
// Real Action/Auth/DB round trips in an isolated TEST tenant. Catalog rows are
// explicitly synthetic test inputs; the existing content writer is unchanged.
import {randomUUID} from 'node:crypto';
import {expect,it,vi} from 'vitest';
const tenant=vi.hoisted(()=>'TEST-ablauf-'+globalThis.crypto.randomUUID());
vi.mock('@/lib/tenant',()=>({KREILE_TENANT_SLUG:tenant}));
import {sql,full,withSession} from '../../../e2e/ablauf/replayHarness';
import {customerFixture,intakeOrderFixture} from '../../../e2e/ablauf/orderFixture';
import {changeOrderContentAction,getLiveOrderCardAction} from '@/app/actions/orders.actions';

if(!process.env.DATABASE_URL||process.env.DATABASE_URL!==process.env.H18_EXPECTED_DATABASE_URL||new URL(process.env.DATABASE_URL).hostname!=='127.0.0.1')throw Error('TEST_CATALOG_BINDING_LOOPBACK_REQUIRED');

it.each([0,1,3])('saves %i selected catalog IDs, reads the actual order and replays the same receipt once',async count=>{
 const customer=await customerFixture('TEST catalog binding '+count);
 const created=await intakeOrderFixture('TEST catalog binding '+count,customer);
 const services=Array.from({length:count},(_,index)=>({id:randomUUID(),name:'TEST catalog service '+count+' '+index,price:12000+index*1000}));
 for(const service of services)await sql`INSERT INTO public.catalog_services(id,tenant_id,name,surface,unit,net_price_cents,vat_rate_basis_points,standard_lead_time_working_days) VALUES(${service.id}::uuid,${tenant},${service.name},'verchromen','stueck',${service.price},1900,1)`;
 const items=Array.from({length:Math.max(1,count)},(_,index)=>({id:index===0?created.receipt.items[0].id:randomUUID(),catalogServiceId:services[index]?.id??null,name:'TEST supplied content '+index,quantity:1,material:'Messing',surface:'Verchromen',unit:'Stück',unitPriceCents:10000,vatRateBasisPoints:1900 as const}));
 const input={orderId:created.receipt.orderId,expectedVersion:created.receipt.orderVersion,clientEventId:randomUUID(),note:'TEST actual catalog content '+count,items};
 const saved=await withSession(full,()=>changeOrderContentAction(input));
 expect(saved.code).toBe('OK');
 if(saved.code!=='OK')throw Error('TEST_CATALOG_CONTENT:'+saved.code);
 expect(saved.receipt).toMatchObject({aggregateVersion:input.expectedVersion+1,actorId:full.actorId});
 const stored=await sql`SELECT id,catalog_service_id::text AS catalog_id,name,round(preis_netto*100)::int AS cents FROM public.items WHERE tenant_id=${tenant} AND order_id=${input.orderId}`;
 expect(stored).toHaveLength(items.length);
 for(const [index,item] of items.entries())expect(stored.find(row=>row.id===item.id)).toMatchObject({catalog_id:services[index]?.id??null,name:services[index]?.name??item.name,cents:services[index]?.price??10000});
 const card=await withSession(full,()=>getLiveOrderCardAction({orderId:input.orderId}));
 expect(card.code).toBe('OK');
 if(card.code!=='OK')throw Error('TEST_CATALOG_CARD:'+card.code);
 expect(card.data.card.version).toBe(saved.receipt.aggregateVersion);
 expect(card.data.card.items.map(item=>item.id).sort()).toEqual(items.map(item=>item.id).sort());
 const replay=await withSession(full,()=>changeOrderContentAction(JSON.parse(JSON.stringify(input))));
 expect(replay).toEqual({...saved,replayed:true});
 expect(await sql`SELECT count(*)::int AS count FROM public.events WHERE tenant_id=${tenant} AND order_id=${input.orderId} AND client_event_id=${input.clientEventId}::uuid`).toEqual([{count:1}]);
 expect(await sql`SELECT version FROM public.orders WHERE tenant_id=${tenant} AND id=${input.orderId}`).toEqual([{version:saved.receipt.aggregateVersion}]);
});

it.each(['inactive','foreign'] as const)('rejects the %s catalog selection with exact copy and no order or event change',async kind=>{
 const customer=await customerFixture('TEST catalog rejected '+kind);
 const created=await intakeOrderFixture('TEST catalog rejected '+kind,customer);
 const catalogId=randomUUID();
 const name='TEST inactive catalog '+kind;
 await sql`INSERT INTO public.catalog_services(id,tenant_id,name,surface,unit,net_price_cents,vat_rate_basis_points,standard_lead_time_working_days,active) VALUES(${catalogId}::uuid,${kind==='foreign'?tenant+'-foreign':tenant},${name},'verchromen','stueck',12000,1900,1,${kind==='foreign'})`;
 const input={orderId:created.receipt.orderId,expectedVersion:created.receipt.orderVersion,clientEventId:randomUUID(),note:'TEST reject invalid catalog',items:[{id:created.receipt.items[0].id,catalogServiceId:catalogId,name:'TEST supplied item',quantity:1,material:'Messing',surface:'Verchromen',unit:'Stück',unitPriceCents:10000,vatRateBasisPoints:1900 as const}]};
 const before=await sql`SELECT to_jsonb(o) AS row FROM public.orders o WHERE tenant_id=${tenant} AND id=${input.orderId}`;
 const itemsBefore=await sql`SELECT to_jsonb(i) AS row FROM public.items i WHERE tenant_id=${tenant} AND order_id=${input.orderId} ORDER BY id`;
 const eventsBefore=await sql`SELECT to_jsonb(e) AS row FROM public.events e WHERE tenant_id=${tenant} AND order_id=${input.orderId} ORDER BY id`;
 const expected={code:'VALIDATION_ERROR',message:kind==='inactive'?`Die Katalogleistung ${name} ist nicht mehr aktiv · wähl eine andere.`:'Diese Katalogleistung gibt es nicht mehr · wähl eine aus der Liste.'};
 expect(await withSession(full,()=>changeOrderContentAction(input))).toEqual(expected);
 expect(await withSession(full,()=>changeOrderContentAction(JSON.parse(JSON.stringify(input))))).toEqual(expected);
 expect(await sql`SELECT to_jsonb(o) AS row FROM public.orders o WHERE tenant_id=${tenant} AND id=${input.orderId}`).toEqual(before);
 expect(await sql`SELECT to_jsonb(i) AS row FROM public.items i WHERE tenant_id=${tenant} AND order_id=${input.orderId} ORDER BY id`).toEqual(itemsBefore);
 expect(await sql`SELECT to_jsonb(e) AS row FROM public.events e WHERE tenant_id=${tenant} AND order_id=${input.orderId} ORDER BY id`).toEqual(eventsBefore);
});
