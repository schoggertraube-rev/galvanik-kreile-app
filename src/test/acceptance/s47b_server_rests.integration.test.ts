// @vitest-environment node
// Actual Actions/Auth/DB/Storage; tenant-filtered TEST fault triggers only.
import {it,expect,vi} from 'vitest';
import {randomUUID} from 'node:crypto';
const tenant=vi.hoisted(()=>'TEST-ablauf-'+globalThis.crypto.randomUUID());
vi.mock('@/lib/tenant',()=>({KREILE_TENANT_SLUG:tenant}));
import {sql,full,withSession} from '../../../e2e/ablauf/replayHarness';
import {customerFixture} from '../../../e2e/ablauf/orderFixture';
import {storeIntakeGoodsPhoto} from '../../../e2e/ablauf/photoFixture';

it('S47b 1 reports the actual missing retry task once and preserves goods for a fresh successful retry',async()=>{
 const customerId=await customerFixture('S47b retry');
 const {createQuoteAction,changeQuoteLifecycleAction,readQuoteAction,convertQuoteToOrderAction}=await import('@/app/actions/quotes.actions');
 const created=await withSession(full,()=>createQuoteAction({clientEventId:randomUUID(),customerId,dueDate:'2027-05-15',note:'TEST S47b retry task',positions:[{name:'TEST S47b Teil',quantity:1,material:'Messing',surfaceRequested:'verchromen',unitPriceCents:2500,lineTotalCents:2500}]}));
 if(created.code!=='OK')throw Error('TEST_S47B_QUOTE:'+created.code);
 const quoteId=created.quote.quoteId;
 expect(await withSession(full,()=>changeQuoteLifecycleAction({quoteId,expectedVersion:1,edition:1,action:'sent',channel:'druck',evidence:'TEST ausgehaendigt',clientEventId:randomUUID()}))).toMatchObject({code:'OK'});
 expect(await withSession(full,()=>changeQuoteLifecycleAction({quoteId,expectedVersion:2,edition:1,action:'accept',evidence:'TEST zugesagt',clientEventId:randomUUID()}))).toMatchObject({code:'OK'});
 const photo=await storeIntakeGoodsPhoto(),parts=await storeIntakeGoodsPhoto(photo.itemId);
 const [source]=await sql`SELECT version FROM public.intake_item WHERE tenant_id=${tenant} AND id=${photo.itemId}::uuid`;
 const current=await withSession(full,()=>readQuoteAction({quoteId}));if(current.code!=='OK')throw Error('TEST_S47B_QUOTE_READ');
 const goods={id:randomUUID(),clientKey:randomUUID(),clientEventId:randomUUID(),itemId:photo.itemId,quoteId,expectedQuoteVersion:current.quote.version,sourceVersion:source.version,expectedVersion:0,mode:'erfassung' as const,command:'accept' as const,card:1,packagesReceived:1,packagesTotal:1,condition:'unauffaellig' as const,deviations:[],foundUnattended:false,foundAt:null,procedure:'stimmt' as const,procedureNote:null,photos:[{fileId:photo.fileId,kind:'uebersicht' as const},{fileId:parts.fileId,kind:'teile' as const}],quantities:current.quote.positions.map(position=>({itemId:position.id,expected:position.quantity,received:null,confirmed:true,note:null})),location:'TEST S47b Regal'};
 const award={quoteId,clientEventId:randomUUID(),expectedVersion:current.quote.version,confirmedAward:true as const,confirmedOrderDueDate:'2027-05-15',handoverMode:'pickup' as const,paymentMode:'rechnung' as const,goodsReceiptId:goods.id};
 const beforeTasks=await sql`SELECT id::text,status FROM public.tasks WHERE tenant_id=${tenant} AND bezug_typ='kv' AND bezug_id=${quoteId} ORDER BY id`;
 const suffix=randomUUID().replaceAll('-',''),fault='test_s47b_'+suffix;
 // Add faults, never remove/disable a business constraint or trigger.
 await sql.unsafe(`CREATE FUNCTION public.${fault}() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.tenant_id='${tenant}' THEN RAISE EXCEPTION 'TEST_S47B_WRITE_FAILED_%',TG_TABLE_NAME; END IF; RETURN NEW; END $$`);
 try{
  await sql.unsafe(`CREATE TRIGGER ${fault} BEFORE INSERT ON public.orders FOR EACH ROW EXECUTE FUNCTION public.${fault}()`);
  await sql.unsafe(`CREATE TRIGGER ${fault} BEFORE INSERT ON public.tasks FOR EACH ROW EXECUTE FUNCTION public.${fault}()`);
  const result=await withSession(full,()=>convertQuoteToOrderAction(award,goods));
  expect(result).toMatchObject({code:'UNAVAILABLE',message:'Die Erinnerung zum KV konnte nicht angelegt werden · erneut anlegen'});
  expect(await sql`SELECT id::text FROM public.goods_receipt WHERE tenant_id=${tenant} AND id=${goods.id}::uuid AND auftrag_id IS NULL`).toEqual([{id:goods.id}]);
  expect(await sql`SELECT id FROM public.orders WHERE tenant_id=${tenant} AND customer_id=${customerId}`).toHaveLength(0);
  expect(await sql`SELECT id::text,status FROM public.tasks WHERE tenant_id=${tenant} AND bezug_typ='kv' AND bezug_id=${quoteId} ORDER BY id`).toEqual(beforeTasks);
  expect(await sql`SELECT command,user_id::text FROM public.technical_protocol WHERE tenant_id=${tenant} AND command='QUOTE_ORDER_RETRY_TASK_FAILED'`).toEqual([{command:'QUOTE_ORDER_RETRY_TASK_FAILED',user_id:full.actorId}]);
 }finally{
  await sql.unsafe(`DROP TRIGGER IF EXISTS ${fault} ON public.orders; DROP TRIGGER IF EXISTS ${fault} ON public.tasks; DROP FUNCTION public.${fault}()`);
 }
 const retried=await withSession(full,()=>convertQuoteToOrderAction(JSON.parse(JSON.stringify(award)),JSON.parse(JSON.stringify(goods))));
 expect(retried).toMatchObject({code:'OK'});if(retried.code!=='OK')throw Error('TEST_S47B_RETRY:'+retried.code);
 expect(await withSession(full,()=>readQuoteAction({quoteId}))).toMatchObject({code:'OK',quote:{linkedOrderId:retried.orderReceipt.orderId}});
 expect(await withSession(full,()=>convertQuoteToOrderAction(JSON.parse(JSON.stringify(award)),JSON.parse(JSON.stringify(goods))))).toMatchObject({code:'OK',replayed:true,orderReceipt:{orderId:retried.orderReceipt.orderId}});
 expect(await sql`SELECT id FROM public.orders WHERE tenant_id=${tenant} AND customer_id=${customerId}`).toHaveLength(1);
});
