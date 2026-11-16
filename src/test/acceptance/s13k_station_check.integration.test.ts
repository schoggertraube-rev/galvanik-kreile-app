// @vitest-environment node
// Real intake is the source; SQL changes below are isolated constraint probes,
// rolled back. They are not a product cancellation or handover proof.
import {it,expect,vi} from 'vitest';
import {randomUUID} from 'node:crypto';
const tenant=vi.hoisted(()=>'TEST-ablauf-'+globalThis.crypto.randomUUID());
vi.mock('@/lib/tenant',()=>({KREILE_TENANT_SLUG:tenant}));
import {sql} from '../../../e2e/ablauf/replayHarness';
import {customerFixture,intakeOrderFixture} from '../../../e2e/ablauf/orderFixture';

it('NB-S13K-1 rejects invalid new combinations without validating history or rewriting cancellation',async()=>{
 const customerId=await customerFixture('S13K station CHECK');
 const source=await intakeOrderFixture('TEST S13K station CHECK '+randomUUID(),customerId);
 const orderId=source.receipt.orderId;
 expect(await sql`SELECT convalidated FROM pg_constraint WHERE conrelid='public.orders'::regclass AND conname='s13k_orders_station_combination'`).toEqual([{convalidated:false}]);
 const read=()=>sql`SELECT status,station,current_station,current_station_id FROM public.orders WHERE tenant_id=${tenant} AND id=${orderId}`;
 const before=await read();
 expect(before).toEqual([{status:'angenommen',station:'angenommen',current_station:'angenommen',current_station_id:'angenommen'}]);
 await expect(sql.begin(async tx=>{
  await tx`UPDATE public.orders SET current_station_id='galvanik',status='fertig' WHERE tenant_id=${tenant} AND id=${orderId}`;
  throw Error('TEST_INVALID_COMBINATION_ACCEPTED');
 })).rejects.toMatchObject({code:'23514',constraint_name:'s13k_orders_station_combination'});
 expect(await read()).toEqual(before);
 const rollback=Error('TEST_SYNTHETIC_STORNO_ROLLBACK');
 try{
  await sql.begin(async tx=>{
   await tx`UPDATE public.orders SET current_station_id='angenommen',station='galvanik',current_station='fertig',status='storniert' WHERE tenant_id=${tenant} AND id=${orderId}`;
   expect(await tx`SELECT status,station,current_station,current_station_id FROM public.orders WHERE tenant_id=${tenant} AND id=${orderId}`).toEqual([{status:'storniert',station:'angenommen',current_station:'angenommen',current_station_id:'angenommen'}]);
   throw rollback;
  });
 }catch(error){if(error!==rollback)throw error;}
 expect(await read()).toEqual(before);
});
