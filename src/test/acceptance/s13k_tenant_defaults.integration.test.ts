// @vitest-environment node
import {beforeAll,it,expect,vi} from 'vitest';
const tenant=vi.hoisted(()=>'TEST-ablauf-'+globalThis.crypto.randomUUID());
vi.mock('@/lib/tenant',()=>({KREILE_TENANT_SLUG:tenant}));
import {randomUUID} from 'node:crypto';
import {sql} from '../../../e2e/ablauf/replayHarness';
import {customerFixture,intakeOrderFixture} from '../../../e2e/ablauf/orderFixture';
let source:Awaited<ReturnType<typeof intakeOrderFixture>>;
let customerId:string;
beforeAll(async()=>{
 customerId=await customerFixture('K13K tenant guard');
 source=await intakeOrderFixture('K13K actual tenant source',customerId);
});

it('K13K-4 no public tenant default remains; five new-row checks are NOT VALID rather than a backfill',async()=>{
 expect(await sql`SELECT table_name FROM information_schema.columns WHERE table_schema='public' AND column_name='tenant_id' AND column_default IS NOT NULL ORDER BY table_name`).toEqual([]);
 const checks=await sql`SELECT rel.relname AS table_name,c.convalidated,pg_get_constraintdef(c.oid) AS definition
  FROM pg_constraint c JOIN pg_class rel ON rel.oid=c.conrelid JOIN pg_namespace n ON n.oid=rel.relnamespace
  WHERE n.nspname='public' AND c.conname LIKE 's13k_%_tenant_required' ORDER BY rel.relname`;
 expect(checks).toEqual(['complaints','events','inquiries','items','orders'].map(table_name=>({table_name,convalidated:false,definition:'CHECK ((tenant_id IS NOT NULL)) NOT VALID'})));
});

it.each(['complaints','events','inquiries','items','orders'] as const)('K13K-4 %s refuses an omitted tenant at its named constraint without retaining a probe row',async table=>{
 const id=randomUUID();
 // Clearly synthetic schema-boundary inserts, always rolled back. The source
 // order above is created by the real Action/Auth/DB intake writer.
 await expect(sql.begin(async tx=>{
  switch(table){
   case 'orders':await tx`INSERT INTO public.orders(id,order_number,customer_id,title,payment_mode,station,current_station,current_station_id,status)
    VALUES(${id},${'TEST-K13K-'+id},${customerId},'TEST K13K omitted tenant','vorkasse','angenommen','angenommen','angenommen','angenommen')`;break;
   case 'items':await tx`INSERT INTO public.items(id,order_id,customer_id,name) VALUES(${id},${source.receipt.orderId},${customerId},'TEST K13K omitted tenant')`;break;
   case 'events':await tx`INSERT INTO public.events(id,order_id,event_type,description) VALUES(${id},${source.receipt.orderId},'TEST_K13K_TENANT','TEST K13K omitted tenant')`;break;
   case 'complaints':await tx`INSERT INTO public.complaints(id,order_id,customer_id,reason,description) VALUES(${id},${source.receipt.orderId},${customerId},'TEST K13K tenant boundary','TEST K13K omitted tenant')`;break;
   case 'inquiries':await tx`INSERT INTO public.inquiries(id,customer_name) VALUES(${id},'TEST K13K omitted tenant')`;break;
  }
  throw Error('TEST_UNEXPECTED_INSERT_ACCEPTED_ROLLBACK');
 })).rejects.toMatchObject({code:'23514',constraint_name:'s13k_'+table+'_tenant_required'});
});
