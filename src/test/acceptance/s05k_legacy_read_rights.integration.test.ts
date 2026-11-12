// @vitest-environment node
// Explicit TEST tenant/legacy price rows; actual Auth, intake writer and read actions.
import {it,expect,vi} from 'vitest';
import {randomUUID} from 'node:crypto';
const tenant=vi.hoisted(()=>'TEST-ablauf-'+globalThis.crypto.randomUUID());
vi.mock('@/lib/tenant',()=>({KREILE_TENANT_SLUG:tenant}));
import {sql,full,withSession,createFixture} from '../../../e2e/ablauf/replayHarness';
import {customerFixture,intakeOrderFixture} from '../../../e2e/ablauf/orderFixture';
import {getItemsDb,getItemsByOrderDb} from '@/app/actions/items.actions';
import {getPriceLinesDb} from '@/app/actions/price-lines.actions';
import {getCustomerByIdDb,searchCustomersDb} from '@/app/actions/customers.actions';
it('S05K A10 existing legacy readers use canonical areas and resolved tenant',async()=>{
 const customerId=await customerFixture('A10 read'),order=await intakeOrderFixture('A10 read',customerId);
 const orderId=order.receipt.orderId,itemId=order.receipt.items[0].id;
 const operator=await createFixture(['auftraege']),money=await createFixture(['geld']),customer=await createFixture(['kunden']);
 expect(await withSession(money,()=>getItemsByOrderDb(orderId))).toMatchObject({ok:false,error:'FORBIDDEN'});
 const items=await withSession(operator,()=>getItemsByOrderDb(orderId));expect(items).toMatchObject({ok:true});if(!items.ok)throw Error('A10_ITEMS');expect(items.data.map(row=>row.id)).toEqual([itemId]);
 expect(await withSession(operator,()=>getItemsDb())).toMatchObject({ok:true,data:expect.arrayContaining([expect.objectContaining({id:itemId})])});
 expect(await withSession(operator,()=>getPriceLinesDb(orderId))).toMatchObject({ok:false,error:'FORBIDDEN'});
 const own=randomUUID(),foreign=randomUUID();
 // Synthetic legacy accounting rows, never claimed as an invoice or price writer proof.
 await sql`INSERT INTO public.price_lines(id,tenant_id,order_id,item_id,position_text,qty,unit_price_eur) VALUES(${own}::uuid,${tenant},${orderId},${itemId},'TEST A10 own',1,10),(${foreign}::uuid,${tenant+'-foreign'},${orderId},${itemId},'TEST A10 foreign',1,999)`;
 for(const selected of [undefined,itemId]){const prices=await withSession(money,()=>getPriceLinesDb(orderId,selected));expect(prices).toMatchObject({ok:true});if(!prices.ok)throw Error('A10_PRICES');expect(prices.data.map(row=>row.id)).toEqual([own]);}
 expect(await withSession(operator,()=>getCustomerByIdDb(customerId))).toMatchObject({ok:false,error:'FORBIDDEN'});
 expect(await withSession(customer,()=>getCustomerByIdDb(customerId))).toMatchObject({ok:true,data:{id:customerId}});
 expect(await withSession(customer,()=>searchCustomersDb('A10 read'))).toMatchObject({ok:true,data:expect.arrayContaining([expect.objectContaining({id:customerId})])});
 expect(await withSession(full,()=>getItemsByOrderDb(orderId))).toMatchObject({ok:true,data:expect.arrayContaining([expect.objectContaining({id:itemId})])});
});

it('S05K A10 maintenance statistics reject business-only rights and count only resolved tenant',async()=>{
 const {getSystemStats}=await import('@/app/actions/systemStats');
 const maintenance=await createFixture(['wartung'],'developer');
 await expect(withSession(full,()=>getSystemStats())).rejects.toThrow('Keine Berechtigung');
 process.env.NEXT_PUBLIC_DATA_PROVIDER='supabase';
 const [expected]=await sql`SELECT (SELECT count(*)::integer FROM public.orders WHERE tenant_id=${tenant}) AS orders,(SELECT count(*)::integer FROM public.customers WHERE tenant_id=${tenant}) AS customers,(SELECT count(*)::integer FROM public.app_users WHERE tenant_id=${tenant}) AS users`;
 const read=await withSession(maintenance,()=>getSystemStats());
 expect(read).toMatchObject({reachable:true,orders:expected.orders,customers:expected.customers,users:expected.users});
 expect(await withSession(maintenance,()=>getSystemStats())).toMatchObject({reachable:true,orders:expected.orders,customers:expected.customers,users:expected.users});
});

it('S05K A10 inventory hides money and filters tenant with the existing rights resolver',async()=>{
 const {getInventoryItemsAction,getInventoryItemAction}=await import('@/app/actions/inventory.actions');
 const operator=await createFixture(['auftraege']),moneyOnly=await createFixture(['geld']);
 const own='TEST-'+randomUUID(),foreign='TEST-'+randomUUID();
 // Explicit synthetic inventory master data; no inventory write-command claim.
 await sql`INSERT INTO public.inventory_items(id,tenant_id,name,category,current_stock,min_stock,unit,einkaufspreis_eur) VALUES(${own},${tenant},'TEST A10 stock','chemical',10,1,'kg',2.5),(${foreign},${tenant+'-foreign'},'TEST A10 foreign','chemical',20,1,'kg',999)`;
 expect(await withSession(moneyOnly,()=>getInventoryItemsAction())).toMatchObject({ok:false,error:'FORBIDDEN'});
 const read=await withSession(operator,()=>getInventoryItemsAction());expect(read).toMatchObject({ok:true});if(!read.ok)throw Error('A10_INVENTORY');expect(read.data.map(row=>row.id)).toEqual([own]);expect(read.data[0].pricePerUnit).toBeUndefined();
 expect(await withSession(operator,()=>getInventoryItemAction(foreign))).toMatchObject({ok:true,data:null});
 expect(await withSession(full,()=>getInventoryItemAction(own))).toMatchObject({ok:true,data:{id:own,pricePerUnit:2.5}});
 expect(await withSession(operator,()=>getInventoryItemAction(own))).toMatchObject({ok:true,data:{id:own}});
});

it('S05K A10 timeline readers keep tenant boundaries and customer rights',async()=>{
 const {getTimelineForOrderDb,getTimelineForCustomerDb,getGlobalTimelineDb}=await import('@/app/actions/timeline.actions');
 const customerId=await customerFixture('A10 timeline'),created=await intakeOrderFixture('A10 timeline',customerId),orderId=created.receipt.orderId;
 const operator=await createFixture(['auftraege']),money=await createFixture(['geld']);
 const own=randomUUID(),foreign=randomUUID(),foreignTenant='TEST-foreign-'+randomUUID();
 // Explicit synthetic legacy event rows isolate tenant filtering; intake events above are actual.
 await sql`INSERT INTO public.events(id,tenant_id,order_id,event_type,payload) VALUES(${own},${tenant},${orderId},'TEST_A10_TIMELINE','{}'::jsonb),(${foreign},${foreignTenant},NULL,'TEST_A10_TIMELINE_FOREIGN','{}'::jsonb)`;
 expect(await withSession(money,()=>getTimelineForOrderDb(orderId))).toMatchObject({ok:false,error:'FORBIDDEN'});
 expect(await withSession(operator,()=>getTimelineForCustomerDb(customerId))).toMatchObject({ok:false,error:'FORBIDDEN'});
 const orderRead=await withSession(operator,()=>getTimelineForOrderDb(orderId));expect(orderRead).toMatchObject({ok:true});if(!orderRead.ok)throw Error('A10_TIMELINE');expect(orderRead.data.map(row=>row.id)).toContain(own);expect(orderRead.data.map(row=>row.id)).not.toContain(foreign);
 const global=await withSession(operator,()=>getGlobalTimelineDb());expect(global).toMatchObject({ok:true});if(!global.ok)throw Error('A10_GLOBAL');expect(global.data.some(row=>row.type==='customer')).toBe(false);expect(global.data.map(row=>row.id)).not.toContain(foreign);
 const customerRead=await withSession(full,()=>getTimelineForCustomerDb(customerId));expect(customerRead).toMatchObject({ok:true});if(!customerRead.ok)throw Error('A10_CUSTOMER_TIMELINE');expect(customerRead.data.map(row=>row.id)).toContain(own);expect(customerRead.data.map(row=>row.id)).not.toContain(foreign);
 expect(await withSession(operator,()=>getTimelineForOrderDb(orderId))).toMatchObject({ok:true,data:expect.arrayContaining([expect.objectContaining({id:own})])});
});

it('S05K A10 analysis consumes every denied auth result before any provider read',async()=>{
 const {getAnalyseOverview,getAnalyseTileDetail,getAnalyseLinkedEntities}=await import('@/features/analyse/analyse.actions');
 const denied=await createFixture([]),fetches=vi.spyOn(globalThis,'fetch');
 expect(await withSession(denied,()=>getAnalyseOverview('month'))).toMatchObject({data:[],error:'Keine Berechtigung für diese Aktion.'});
 expect(await withSession(denied,()=>getAnalyseTileDetail('werkstatt_puls','month'))).toMatchObject({data:null,error:'Keine Berechtigung für diese Aktion.'});
 expect(await withSession(denied,()=>getAnalyseLinkedEntities('werkstatt_puls'))).toMatchObject({data:[],error:'Keine Berechtigung für diese Aktion.'});
 expect(fetches).not.toHaveBeenCalled();fetches.mockRestore();
});

it('S05K A10 PL0014 deferred tenantless sources deny after canonical rights without data effects',async()=>{
 const {getBathsDb,createBathMeasurementDb}=await import('@/app/actions/baths.actions');
 const {getBaederListAction}=await import('@/app/baeder/actions');
 const {getBesteAktionAction}=await import('@/app/marketing/marketing.actions');
 const {getUstvaAnalysisAction}=await import('@/app/buchhaltung/analysis.actions');
 const {searchBelegeByOcrTextAction}=await import('@/app/buchhaltung/search-actions');
 const {createAktion}=await import('@/app/marketing/aktion/actions');
 const operator=await createFixture(['auftraege']),money=await createFixture(['geld']);
 const text='Kommt nach dem Start dazu - bis dahin ausgeschaltet.';
 expect(await withSession(operator,()=>getBathsDb())).toMatchObject({ok:false,error:'CONFLICT',message:text});
 expect(await withSession(money,()=>getBathsDb())).toMatchObject({ok:false,error:'FORBIDDEN'});
 expect(await withSession(operator,()=>getBaederListAction())).toMatchObject({ok:false,message:text});
 expect(await withSession(operator,()=>createBathMeasurementDb({bathId:'TEST-no-write',temperature:20}))).toMatchObject({ok:false,message:text});
 await expect(withSession(operator,()=>getBesteAktionAction())).rejects.toThrow('Keine Berechtigung');
 for(const work of [()=>getBesteAktionAction(),()=>getUstvaAnalysisAction('2026-01-01','2026-12-31'),()=>searchBelegeByOcrTextAction('TEST'),()=>createAktion(new FormData())]){
  await expect(withSession<unknown>(money,work)).rejects.toThrow(text);
 }
 expect(await withSession(operator,()=>getBathsDb())).toMatchObject({ok:false,message:text});
});

it('S05K A10 generic data context requires its actual canonical area and keeps original identity',async()=>{
 const {createAuthorizedDataContext}=await import('@/lib/supabase/server');
 const operator=await createFixture(['auftraege']),money=await createFixture(['geld']);
 await expect(withSession(operator,()=>createAuthorizedDataContext('geld'))).rejects.toThrow('Keine Berechtigung');
 const context=await withSession(operator,()=>createAuthorizedDataContext('auftraege'));
 expect(context.authorization).toMatchObject({tenantId:tenant,userId:operator.actorId});
 const moneyContext=await withSession(money,()=>createAuthorizedDataContext('geld'));
 expect(moneyContext.authorization).toMatchObject({tenantId:tenant,userId:money.actorId});
 expect((await withSession(operator,()=>createAuthorizedDataContext('auftraege'))).authorization.userId).toBe(operator.actorId);
});
