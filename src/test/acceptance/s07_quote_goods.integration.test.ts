// @vitest-environment node
// TEST only: actual Actions/Auth/Replay/Storage; no product writer is doubled.
import {randomUUID} from 'node:crypto';
import {expect,it,vi} from 'vitest';
const tenant=vi.hoisted(()=>'TEST-ablauf-'+globalThis.crypto.randomUUID());
vi.mock('@/lib/tenant',()=>({KREILE_TENANT_SLUG:tenant}));
import {KREILE_TENANT_SLUG} from '@/lib/tenant';
import {sql,full,withSession,createFixture} from '../../../e2e/ablauf/replayHarness';
import {customerFixture} from '../../../e2e/ablauf/orderFixture';
import {storeIntakeGoodsPhoto} from '../../../e2e/ablauf/photoFixture';

it.each([{name:'full',operational:false,missingReceipt:false},{name:'operational',operational:true,missingReceipt:false},{name:'missing-task-receipt',operational:true,missingReceipt:true}])('A07-5 $name retains actual photographed goods after order SQL failure and recovers exactly once',async scenario=>{
 const actor=scenario.operational?await createFixture(['eingang'],'werkstatt'):full;
 const customerId=await customerFixture('S07 real retained goods');
 const {createQuoteAction,changeQuoteLifecycleAction,readQuoteAction,convertQuoteToOrderAction}=await import('@/app/actions/quotes.actions');
 const created=await withSession(full,()=>createQuoteAction({clientEventId:randomUUID(),customerId,dueDate:'2027-05-15',note:'TEST S07 goods survive order failure',positions:[{name:'TEST S07 original quote part',quantity:10,material:'Messing',surfaceRequested:'verchromen',unitPriceCents:400,lineTotalCents:4000}]}));
 expect(created).toMatchObject({code:'OK'});if(created.code!=='OK')throw Error('TEST_S07_QUOTE_CREATE');
 const quoteId=created.quote.quoteId;
 expect(await withSession(full,()=>changeQuoteLifecycleAction({quoteId,expectedVersion:1,edition:1,action:'sent',channel:'druck',evidence:'TEST S07 handed over original',clientEventId:randomUUID()}))).toMatchObject({code:'OK'});
 expect(await withSession(full,()=>changeQuoteLifecycleAction({quoteId,expectedVersion:2,edition:1,action:'accept',evidence:'TEST S07 customer accepted',clientEventId:randomUUID()}))).toMatchObject({code:'OK'});
 const overview=await storeIntakeGoodsPhoto(undefined,actor),parts=await storeIntakeGoodsPhoto(overview.itemId,actor);
 const {getIntakeCaptureAction}=await import('@/app/actions/eingang.actions');
 const capture=await withSession(actor,()=>getIntakeCaptureAction(overview.itemId));if(capture.code!=='OK')throw Error('TEST_S07_CAPTURE');
 const read=await withSession(full,()=>readQuoteAction({quoteId}));if(read.code!=='OK')throw Error('TEST_S07_QUOTE_READ');
 const goods={id:randomUUID(),clientKey:randomUUID(),clientEventId:randomUUID(),itemId:overview.itemId,quoteId,expectedQuoteVersion:read.quote.version,sourceVersion:capture.capture.version,expectedVersion:0,mode:'erfassung' as const,command:'accept' as const,card:1,packagesReceived:1,packagesTotal:1,condition:'unauffaellig' as const,deviations:[],foundUnattended:false,foundAt:null,procedure:'stimmt' as const,procedureNote:null,photos:[{fileId:overview.fileId,kind:'uebersicht' as const},{fileId:parts.fileId,kind:'teile' as const}],quantities:read.quote.positions.map(row=>({itemId:row.id,expected:row.quantity,received:null,confirmed:true,note:null})),location:'TEST S07 retained shelf'};
 const award={quoteId,clientEventId:randomUUID(),expectedVersion:read.quote.version,confirmedAward:true as const,confirmedOrderDueDate:read.quote.dueDate,handoverMode:'pickup' as const,paymentMode:'rechnung' as const,goodsReceiptId:goods.id};
 const fault='test_s07_order_'+randomUUID().replaceAll('-','');
 await sql.unsafe(`CREATE FUNCTION private.${fault}() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.tenant_id='${KREILE_TENANT_SLUG}' AND NEW.customer_id='${customerId}' THEN RAISE EXCEPTION 'TEST_S07_ORDER_INSERT_FAILED'; END IF; RETURN NEW; END $$`);
 await sql.unsafe(`CREATE TRIGGER ${fault} BEFORE INSERT ON public.orders FOR EACH ROW EXECUTE FUNCTION private.${fault}()`);
 try{
  if(scenario.missingReceipt){
   const receiptFault='test_s07_task_'+randomUUID().replaceAll('-','');
   await sql.unsafe(`CREATE FUNCTION private.${receiptFault}() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.tenant_id='${KREILE_TENANT_SLUG}' AND NEW.event_type='QUOTE_ORDER_TASK_V1' AND NEW.payload->>'quoteId'='${quoteId}' THEN RETURN NULL; END IF; RETURN NEW; END $$`);
   await sql.unsafe(`CREATE TRIGGER ${receiptFault} BEFORE INSERT ON public.events FOR EACH ROW EXECUTE FUNCTION private.${receiptFault}()`);
   try{
    expect(await withSession(actor,()=>convertQuoteToOrderAction(award,goods))).toMatchObject({code:'UNAVAILABLE'});
    expect(await sql`SELECT id::text,auftrag_id FROM public.goods_receipt WHERE tenant_id=${KREILE_TENANT_SLUG} AND id=${goods.id}::uuid`).toEqual([{id:goods.id,auftrag_id:null}]);
    expect(await sql`SELECT count(*)::integer AS n FROM public.tasks WHERE tenant_id=${KREILE_TENANT_SLUG} AND bezug_typ='kv' AND bezug_id=${quoteId}`).toEqual([{n:0}]);
    expect(await sql`SELECT count(*)::integer AS n FROM public.events WHERE tenant_id=${KREILE_TENANT_SLUG} AND event_type='QUOTE_ORDER_TASK_V1' AND payload->>'quoteId'=${quoteId}`).toEqual([{n:0}]);
   }finally{await sql.unsafe(`DROP TRIGGER ${receiptFault} ON public.events`);await sql.unsafe(`DROP FUNCTION private.${receiptFault}()`);}
  }
  const failed=await withSession(actor,()=>convertQuoteToOrderAction(award,goods));
  expect(failed.code).not.toBe('OK');
  expect(await sql`SELECT id::text,auftrag_id,lagerort FROM public.goods_receipt WHERE tenant_id=${KREILE_TENANT_SLUG} AND id=${goods.id}::uuid`).toEqual([{id:goods.id,auftrag_id:null,lagerort:goods.location}]);
  expect(failed).toMatchObject({code:'UNAVAILABLE',message:expect.stringContaining('Auftrag aus KV '+created.quote.quoteNumber+' anlegen')});
  expect(await sql`SELECT count(*)::integer AS n FROM public.orders WHERE tenant_id=${KREILE_TENANT_SLUG} AND customer_id=${customerId}`).toEqual([{n:0}]);
  const tasks=await sql`SELECT id::text,titel,status,fuer_bereich FROM public.tasks WHERE tenant_id=${KREILE_TENANT_SLUG} AND bezug_typ='kv' AND bezug_id=${quoteId}`;
  expect(tasks).toEqual([{id:expect.any(String),titel:'Auftrag aus KV '+created.quote.quoteNumber+' anlegen',status:'offen',fuer_bereich:'geld'}]);
  const {getIntakeTaskAction}=await import('@/app/actions/eingang.actions');
  expect(await withSession(full,()=>getIntakeTaskAction({taskId:tasks[0].id}))).toMatchObject({code:'OK',task:{titel:tasks[0].titel,status:'offen'},reference:{type:'kv',id:quoteId}});
  expect((await withSession(actor,()=>convertQuoteToOrderAction(JSON.parse(JSON.stringify(award)),JSON.parse(JSON.stringify(goods))))).code).not.toBe('OK');
  expect(await sql`SELECT count(*)::integer AS n FROM public.tasks WHERE tenant_id=${KREILE_TENANT_SLUG} AND bezug_typ='kv' AND bezug_id=${quoteId}`).toEqual([{n:1}]);
  expect(await withSession(full,()=>readQuoteAction({quoteId}))).toMatchObject({code:'OK',quote:{linkedOrderId:null,lifecycle:{goods:[expect.objectContaining({id:goods.id,orderId:null})]}}});
 }finally{await sql.unsafe(`DROP TRIGGER ${fault} ON public.orders`);await sql.unsafe(`DROP FUNCTION private.${fault}()`);}
 const recovered=await withSession(actor,()=>convertQuoteToOrderAction(JSON.parse(JSON.stringify(award)),JSON.parse(JSON.stringify(goods))));
 expect(recovered).toMatchObject({code:'OK'});if(recovered.code!=='OK')throw Error('TEST_S07_ORDER_RECOVERY');
 expect(await withSession(actor,()=>convertQuoteToOrderAction(JSON.parse(JSON.stringify(award)),JSON.parse(JSON.stringify(goods))))).toMatchObject({code:'OK',replayed:true,orderReceipt:{orderId:recovered.orderReceipt.orderId}});
 expect(await sql`SELECT count(*)::integer AS n FROM public.orders WHERE tenant_id=${KREILE_TENANT_SLUG} AND customer_id=${customerId}`).toEqual([{n:1}]);
 expect(await sql`SELECT auftrag_id FROM public.goods_receipt WHERE tenant_id=${KREILE_TENANT_SLUG} AND id=${goods.id}::uuid`).toEqual([{auftrag_id:recovered.orderReceipt.orderId}]);
 expect(await sql`SELECT count(*)::integer AS n FROM public.intake_event WHERE tenant_id=${KREILE_TENANT_SLUG} AND befehl_id=${goods.clientEventId}::uuid AND art='ware'`).toEqual([{n:1}]);
 expect(await sql`SELECT status,erledigt_von::text FROM public.tasks WHERE tenant_id=${KREILE_TENANT_SLUG} AND bezug_typ='kv' AND bezug_id=${quoteId}`).toEqual([{status:'erledigt',erledigt_von:actor.actorId}]);
 expect(await sql`SELECT payload->>'action' AS action,count(*)::integer AS n FROM public.events WHERE tenant_id=${KREILE_TENANT_SLUG} AND event_type='QUOTE_ORDER_TASK_V1' AND payload->>'quoteId'=${quoteId} GROUP BY payload->>'action' ORDER BY action`).toEqual([{action:'angelegt',n:1},{action:'erledigt',n:1}]);
});
