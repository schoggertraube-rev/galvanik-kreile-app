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
