// @vitest-environment node
import {it,expect,vi} from 'vitest';
const tenant=vi.hoisted(()=>'TEST-ablauf-'+globalThis.crypto.randomUUID());
vi.mock('@/lib/tenant',()=>({KREILE_TENANT_SLUG:tenant}));
import {randomUUID} from 'node:crypto';
import {sql as query} from 'drizzle-orm';
import {sql,full,withSession} from '../../../e2e/ablauf/replayHarness';
import {customerFixture,intakeOrderFixture} from '../../../e2e/ablauf/orderFixture';
import {withPrivilegedTenantTransaction} from '@/lib/server/privilegedDb';
import {allocateOrderNumber} from '@/lib/server/orderNumberAllocation';

const counter=(number:string)=>Number(number.split('-').at(-1));

it('K13K-9 actual parallel intakes persist distinct consecutive global numbers and fresh retries keep both originals',async()=>{
 const customerId=await customerFixture('K13K parallel number');
 const orders=await Promise.all([0,1].map(index=>intakeOrderFixture('K13K parallel '+index,customerId)));
 const numbers=orders.map(order=>order.receipt.orderNumber).sort();
 expect(new Set(numbers).size).toBe(2);expect(counter(numbers[1])-counter(numbers[0])).toBe(1);
 const {getLiveOrderCardAction}=await import('@/app/actions/orders.actions');
 for(const order of orders){
  expect(await withSession(full,()=>getLiveOrderCardAction({orderId:order.receipt.orderId}))).toMatchObject({code:'OK',data:{card:{orderNumber:order.receipt.orderNumber}}});
  const {createOrderIntakeAction}=await import('@/app/actions/eingang.actions');
  const receipt=order.receipt;
  const input={geprueft:receipt.geprueft,clientEventId:receipt.clientEventId,customer:{mode:'EXISTING' as const,customerId},dueDate:receipt.dueDate,termStatus:receipt.termStatus,intakeSource:receipt.intakeSource,handoverMode:receipt.handoverMode,paymentMode:receipt.paymentMode,note:receipt.note,
   items:receipt.items.map(item=>({catalogServiceId:item.catalogServiceId,name:item.name,quantity:item.quantity,material:item.material,surfaceRequested:item.surfaceRequested,executionRequested:item.executionRequested,unit:item.unit,unitPriceCents:item.unitPriceCents,vatRateBasisPoints:item.vatRateBasisPoints}))};
  expect(await withSession(full,()=>createOrderIntakeAction(JSON.parse(JSON.stringify(input))))).toMatchObject({code:'OK',replayed:true,receipt:{orderId:receipt.orderId,orderNumber:receipt.orderNumber}});
 }
 expect(await sql`SELECT order_number FROM public.orders WHERE tenant_id=${tenant} AND id IN (${orders[0].receipt.orderId},${orders[1].receipt.orderId}) ORDER BY order_number`).toEqual(numbers.map(order_number=>({order_number})));
});

it('K13K-9 shared production allocator reserves globally consecutive numbers across two real TEST transaction scopes',async()=>{
 const scopes=[tenant,'TEST-ablauf-'+randomUUID()];
 const customers=scopes.map(()=>randomUUID());
 // Explicit synthetic rows isolate the global SQL/transaction boundary. This
 // is not an Auth or second intake-writer claim; the Action case above is real.
 for(let index=0;index<scopes.length;index++)await sql`INSERT INTO public.customers(id,tenant_id,name,customer_number,type)
  VALUES(${customers[index]},${scopes[index]},'TEST K13K global numbering',${'TEST-K13K-'+randomUUID()},'business')`;
 const results=await Promise.all(scopes.map((tenantId,index)=>withPrivilegedTenantTransaction({tenantId},async tx=>{
  const orderNumber=await allocateOrderNumber(tx,'ORDER_INTAKE_NUMBER_INVALID'),id=randomUUID();
  const saved=await tx.execute<{id:string;order_number:string}>(query`INSERT INTO public.orders(id,tenant_id,order_number,customer_id,title,station,current_station,current_station_id,status,handover_mode,payment_mode,ware)
   VALUES(${id},${tenantId},${orderNumber},${customers[index]},'TEST K13K allocator SQL boundary','angenommen','angenommen','angenommen','angenommen','pickup','vorkasse','da') RETURNING id,order_number`);
  expect(saved).toMatchObject([{id,order_number:orderNumber}]);
  return {id,tenantId,orderNumber};
 })));
 const numbers=results.map(result=>result.orderNumber).sort();
 expect(new Set(numbers).size).toBe(2);expect(counter(numbers[1])-counter(numbers[0])).toBe(1);
 for(const result of results)expect(await sql`SELECT order_number FROM public.orders WHERE tenant_id=${result.tenantId} AND id=${result.id}`).toEqual([{order_number:result.orderNumber}]);
 const unique=await sql`SELECT pg_get_constraintdef(oid) AS definition FROM pg_constraint WHERE conrelid='public.orders'::regclass AND conname='orders_order_number_key'`;
 expect(unique).toEqual([{definition:'UNIQUE (order_number)'}]);
});
