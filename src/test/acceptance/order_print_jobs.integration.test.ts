// @vitest-environment node
import {vi,it,expect} from 'vitest';
import {randomUUID} from 'node:crypto';
const tenant=vi.hoisted(()=>'TEST-ablauf-'+globalThis.crypto.randomUUID());
vi.mock('@/lib/tenant',()=>({KREILE_TENANT_SLUG:tenant}));
import {KREILE_TENANT_SLUG} from '@/lib/tenant';
import {sql,full,withSession} from '../../../e2e/ablauf/replayHarness';
import {customerFixture,readyInvoiceOrder} from '../../../e2e/ablauf/orderFixture';
import {createOrderIntakeAction} from '@/app/actions/eingang.actions';
import {recordGoodsOutAction} from '@/app/actions/goodsOut.actions';
if(!process.env.DATABASE_URL||process.env.DATABASE_URL!==process.env.H18_EXPECTED_DATABASE_URL||new URL(process.env.DATABASE_URL).hostname!=='127.0.0.1')throw Error('PRINT_JOBS_LOOPBACK_REQUIRED');
function request(customerId:string){return {geprueft:true,clientEventId:randomUUID(),customer:{mode:'EXISTING' as const,customerId},dueDate:'2027-05-15',termStatus:'bestaetigt' as const,intakeSource:'persoenlich' as const,handoverMode:'pickup' as const,paymentMode:'rechnung' as const,note:'TEST automatische Laufzettel',items:[1,2].map(quantity=>({catalogServiceId:null,name:'TEST Teil '+quantity,quantity,material:'Messing',surfaceRequested:'Verchromen',executionRequested:'offen' as const,unit:'Stück',unitPriceCents:10000,vatRateBasisPoints:1900 as const}))};}

it('DR-03/10 canonical order creation atomically queues overall and position sheets; retry and concurrent orders keep unique symbols',async()=>{
 const customerId=await customerFixture('Druckauftrag'),input=request(customerId);
 const attempts=await Promise.all([withSession(full,()=>createOrderIntakeAction(input)),withSession(full,()=>createOrderIntakeAction(structuredClone(input))),withSession(full,()=>createOrderIntakeAction(request(customerId)))]);
 for(const result of attempts)expect(result).toMatchObject({code:'OK'});
 const first=attempts[0];if(first.code!=='OK')throw Error('PRINT_CREATED');
 expect(attempts[1]).toMatchObject({receipt:{orderId:first.receipt.orderId}});
 const orders=await sql`SELECT id,print_symbol_slot,print_symbol_generation,print_symbol_active FROM public.orders WHERE tenant_id=${KREILE_TENANT_SLUG} AND customer_id=${customerId}`;
 expect(orders).toHaveLength(2);expect(new Set(orders.map(row=>row.print_symbol_slot+':'+row.print_symbol_generation)).size).toBe(2);
 for(const order of orders){
  expect(order.print_symbol_active).toBe(true);
  const jobs=await sql`SELECT id::text,item_id,sheet_kind,status,attempts,created_by::text,snapshot FROM public.print_jobs WHERE tenant_id=${KREILE_TENANT_SLUG} AND order_id=${order.id} ORDER BY sheet_kind,item_id`;
  expect(jobs).toHaveLength(3);expect(jobs.filter(job=>job.sheet_kind==='gesamt')).toHaveLength(1);
  expect(jobs.filter(job=>job.sheet_kind==='position').map(job=>job.item_id).sort()).toEqual((await sql`SELECT id FROM public.items WHERE tenant_id=${KREILE_TENANT_SLUG} AND order_id=${order.id} ORDER BY id`).map(item=>item.id));
  for(const job of jobs){expect(job).toMatchObject({status:'wartet',attempts:0,created_by:full.actorId,snapshot:{orderId:order.id,customerId,dueDate:input.dueDate,symbol:{slot:order.print_symbol_slot,generation:order.print_symbol_generation}}});expect(job.snapshot.positions.map((position:{quantity:string})=>Number(position.quantity))).toEqual([1,2]);}
  const receipts=await sql`SELECT user_id::text,payload FROM public.events WHERE tenant_id=${KREILE_TENANT_SLUG} AND order_id=${order.id} AND event_type='ORDER_PRINT_JOBS_QUEUED_V1'`;
  expect(receipts).toHaveLength(1);expect(receipts[0].user_id).toBe(full.actorId);expect(receipts[0].payload.jobIds.sort()).toEqual(jobs.map(job=>job.id).sort());
 }
 expect(await withSession(full,()=>createOrderIntakeAction(JSON.parse(JSON.stringify(input))))).toMatchObject({code:'OK',replayed:true});
 expect(await sql`SELECT count(*)::int AS n FROM public.print_jobs WHERE tenant_id=${KREILE_TENANT_SLUG} AND order_id=${first.receipt.orderId}`).toEqual([{n:3}]);
});

it('DR-03 missing queue receipt rolls back order, symbol, jobs and intake receipt; same-key recovery remains possible',async()=>{
 const customerId=await customerFixture('Druck-Rollback'),input=request(customerId),name='test_print_'+randomUUID().replaceAll('-','');
 await sql.unsafe(`CREATE FUNCTION private.${name}() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.tenant_id = '${KREILE_TENANT_SLUG}' AND NEW.event_type = 'ORDER_PRINT_JOBS_QUEUED_V1' THEN RETURN NULL; END IF; RETURN NEW; END $$`);
 try{
  await sql.unsafe(`CREATE TRIGGER ${name} BEFORE INSERT ON public.events FOR EACH ROW EXECUTE FUNCTION private.${name}()`);
  expect(await withSession(full,()=>createOrderIntakeAction(input))).toMatchObject({code:'UNAVAILABLE'});
  expect(await sql`SELECT id FROM public.orders WHERE tenant_id=${KREILE_TENANT_SLUG} AND customer_id=${customerId}`).toHaveLength(0);
  expect(await sql`SELECT job.id FROM public.print_jobs job JOIN public.orders o ON o.id=job.order_id AND o.tenant_id=job.tenant_id WHERE job.tenant_id=${KREILE_TENANT_SLUG} AND o.customer_id=${customerId}`).toHaveLength(0);
  expect(await sql`SELECT id FROM public.events WHERE tenant_id=${KREILE_TENANT_SLUG} AND client_event_id=${input.clientEventId}::uuid`).toHaveLength(0);
 }finally{
  await sql.unsafe(`DROP TRIGGER IF EXISTS ${name} ON public.events`);
  await sql.unsafe(`DROP FUNCTION private.${name}()`);
 }
 const recovered=await withSession(full,()=>createOrderIntakeAction(JSON.parse(JSON.stringify(input))));expect(recovered).toMatchObject({code:'OK',replayed:false});if(recovered.code!=='OK')throw Error('PRINT_RECOVERY');
 expect(await sql`SELECT count(*)::int AS n FROM public.print_jobs WHERE tenant_id=${KREILE_TENANT_SLUG} AND order_id=${recovered.receipt.orderId}`).toEqual([{n:3}]);
});

it('DR-05/09 physical output retires waiting sheets with its real receipt and releases the symbol without deleting history',async()=>{
 const ready=await readyInvoiceOrder('Zeichen-freigeben');
 const [before]=await sql`SELECT print_symbol_slot,print_symbol_generation,print_symbol_active FROM public.orders WHERE tenant_id=${KREILE_TENANT_SLUG} AND id=${ready.orderId}`;
 expect(before.print_symbol_active).toBe(true);
 const input={orderId:ready.orderId,mode:'abholung' as const,expectedVersion:ready.version,clientEventId:randomUUID()};
 const result=await withSession(full,()=>recordGoodsOutAction(input));expect(result).toMatchObject({code:'OK'});if(result.code!=='OK')throw Error('PRINT_GOODS_OUT');
 expect(await sql`SELECT status FROM public.print_jobs WHERE tenant_id=${KREILE_TENANT_SLUG} AND order_id=${ready.orderId}`).toEqual([{status:'storniert'},{status:'storniert'}]);
 expect(await sql`SELECT print_symbol_slot,print_symbol_generation,print_symbol_active FROM public.orders WHERE tenant_id=${KREILE_TENANT_SLUG} AND id=${ready.orderId}`).toEqual([{...before,print_symbol_active:false}]);
 expect(await sql`SELECT user_id::text,payload->>'goodsOutEventId' AS proof FROM public.events WHERE tenant_id=${KREILE_TENANT_SLUG} AND order_id=${ready.orderId} AND event_type='ORDER_PRINT_JOBS_RETIRED_V1'`).toEqual([{user_id:full.actorId,proof:result.receipt.eventId}]);
 expect(await withSession(full,()=>recordGoodsOutAction(JSON.parse(JSON.stringify(input))))).toMatchObject({code:'OK',replayed:true});
 const next=await withSession(full,()=>createOrderIntakeAction(request(ready.customerId)));if(next.code!=='OK')throw Error('PRINT_SYMBOL_REUSE');
 expect(await sql`SELECT print_symbol_slot,print_symbol_generation,print_symbol_active FROM public.orders WHERE tenant_id=${KREILE_TENANT_SLUG} AND id=${next.receipt.orderId}`).toEqual([before]);
 expect(await sql`SELECT count(*)::int AS n FROM public.events WHERE tenant_id=${KREILE_TENANT_SLUG} AND order_id=${ready.orderId} AND event_type='ORDER_PRINT_JOBS_RETIRED_V1'`).toEqual([{n:1}]);
});

it('DR-08 the forty-first active order receives a symbol-letter generation without changing any existing order',async()=>{
 const customerId=await customerFixture('Zeichen-Pool');
 const before=await sql`SELECT id,print_symbol_slot AS slot,print_symbol_generation AS generation FROM public.orders WHERE tenant_id=${KREILE_TENANT_SLUG} AND print_symbol_active ORDER BY id`;
 for(let count=before.length;count<41;count++){
  expect(await withSession(full,()=>createOrderIntakeAction(request(customerId)))).toMatchObject({code:'OK'});
 }
 const after=await sql`SELECT id,print_symbol_slot AS slot,print_symbol_generation AS generation FROM public.orders WHERE tenant_id=${KREILE_TENANT_SLUG} AND print_symbol_active ORDER BY id`;
 expect(after).toHaveLength(41);expect(new Set(after.map(row=>row.slot+':'+row.generation)).size).toBe(41);
 expect(after.filter(row=>row.generation===0)).toHaveLength(40);expect(after.filter(row=>row.generation===1)).toHaveLength(1);
 for(const original of before)expect(after.find(row=>row.id===original.id)).toEqual(original);
},120000);

it('a corrupted sheet original blocks intake replay rather than replacing or duplicating its print source',async()=>{
 const customerId=await customerFixture('Druck-Original'),input=request(customerId),created=await withSession(full,()=>createOrderIntakeAction(input));if(created.code!=='OK')throw Error('PRINT_ORIGINAL_FIXTURE');
 const [source]=await sql`SELECT payload FROM public.events WHERE tenant_id=${KREILE_TENANT_SLUG} AND order_id=${created.receipt.orderId} AND event_type='ORDER_PRINT_JOBS_QUEUED_V1'`;
 const [job]=await sql`SELECT id::text FROM public.print_jobs WHERE tenant_id=${KREILE_TENANT_SLUG} AND order_id=${created.receipt.orderId} ORDER BY id LIMIT 1`;
 await sql`UPDATE public.print_jobs SET snapshot=jsonb_set(snapshot,'{customerName}',to_jsonb(${'TEST manipulierter Name'}::text)) WHERE tenant_id=${KREILE_TENANT_SLUG} AND id=${job.id}::uuid`;
 expect(await withSession(full,()=>createOrderIntakeAction(JSON.parse(JSON.stringify(input))))).toMatchObject({code:'UNAVAILABLE'});
 expect(await sql`SELECT payload FROM public.events WHERE tenant_id=${KREILE_TENANT_SLUG} AND order_id=${created.receipt.orderId} AND event_type='ORDER_PRINT_JOBS_QUEUED_V1'`).toEqual([source]);
 expect(await sql`SELECT count(*)::int AS n FROM public.print_jobs WHERE tenant_id=${KREILE_TENANT_SLUG} AND order_id=${created.receipt.orderId}`).toEqual([{n:3}]);
});
