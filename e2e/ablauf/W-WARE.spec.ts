import {randomUUID} from 'node:crypto';
import {expect,it} from 'vitest';
import {KREILE_TENANT_SLUG} from '@/lib/tenant';
import {sql,full,withSession,createFixture} from './replayHarness';
import {customerFixture,intakeOrderFixture,readyInvoiceOrder} from './orderFixture';
import {storeItemPhoto,storeIntakeGoodsPhoto} from './photoFixture';

it('W-WARE W1 retains the real label original once and blocks goods/order booking until the secured content photo exists',async()=>{
 const customerId=await customerFixture('S12 W1 label');
 const {createQuoteAction,readQuoteAction}=await import('@/app/actions/quotes.actions');
 const {getIntakeCaptureAction,saveGoodsReceiptAction}=await import('@/app/actions/eingang.actions');
 const created=await withSession(full,()=>createQuoteAction({clientEventId:randomUUID(),customerId,dueDate:'2027-05-15',note:'TEST S12 label before contents',positions:[{name:'TEST S12 label part',quantity:2,material:'Messing',surfaceRequested:'verchromen',unitPriceCents:400,lineTotalCents:800}]}));
 expect(created.code).toBe('OK');if(created.code!=='OK')throw Error('S12_W1_QUOTE:'+created.code);
 const quoteId=created.quote.quoteId,overview=await storeIntakeGoodsPhoto();
 const readCapture=()=>withSession(full,()=>getIntakeCaptureAction(overview.itemId));
 const captured=await readCapture();if(captured.code!=='OK')throw Error('S12_W1_CAPTURE:'+captured.code);
 const input={id:randomUUID(),clientKey:randomUUID(),clientEventId:randomUUID(),itemId:overview.itemId,quoteId,expectedQuoteVersion:created.quote.version,sourceVersion:captured.capture.version,expectedVersion:0,mode:'erfassung' as const,command:'accept' as const,card:1,packagesReceived:1,packagesTotal:1,condition:'unauffaellig' as const,deviations:[],foundUnattended:false,foundAt:null,procedure:'stimmt' as const,procedureNote:null,photos:[{fileId:overview.fileId,kind:'uebersicht' as const}],quantities:created.quote.positions.map(row=>({itemId:row.id,expected:row.quantity,received:null,confirmed:true,note:null})),location:'TEST S12 label shelf'};
 expect(await withSession(full,()=>saveGoodsReceiptAction(input))).toMatchObject({code:'VALIDATION_ERROR',message:expect.stringContaining('Inhaltsfoto')});
 expect(await sql`SELECT count(*)::int AS n FROM public.orders WHERE tenant_id=${KREILE_TENANT_SLUG} AND customer_id=${customerId}`).toEqual([{n:0}]);
 expect(await sql`SELECT count(*)::int AS n FROM public.goods_receipt WHERE tenant_id=${KREILE_TENANT_SLUG} AND kv_id=${quoteId}::uuid`).toEqual([{n:0}]);
 expect(await readCapture()).toMatchObject({code:'OK',capture:{files:[expect.objectContaining({id:overview.fileId,secured:true})]}});
 const parts=await storeIntakeGoodsPhoto(overview.itemId),updated=await readCapture();if(updated.code!=='OK')throw Error('S12_W1_CONTENTS:'+updated.code);
 const complete={...input,sourceVersion:updated.capture.version,photos:[...input.photos,{fileId:parts.fileId,kind:'teile' as const}]};
 expect(await withSession(full,()=>saveGoodsReceiptAction(complete))).toMatchObject({code:'OK',receipt:{id:input.id,auftrag_id:null,kv_id:quoteId}});
 expect(await withSession(full,()=>saveGoodsReceiptAction(JSON.parse(JSON.stringify(complete))))).toMatchObject({code:'OK',replayed:true});
 const reread=await withSession(full,()=>readQuoteAction({quoteId}));expect(reread.code).toBe('OK');if(reread.code!=='OK')throw Error('S12_W1_READ:'+reread.code);
 expect(reread.quote.linkedOrderId).toBeNull();
 expect(reread.quote.lifecycle?.goods).toEqual([expect.objectContaining({id:input.id,orderId:null})]);
 expect(reread.nextActionRule.source).toMatchObject({kind:'quote',id:quoteId,version:reread.quote.version});
 expect(await sql`SELECT count(*)::int AS n FROM public.goods_receipt WHERE tenant_id=${KREILE_TENANT_SLUG} AND kv_id=${quoteId}::uuid`).toEqual([{n:1}]);
 expect(await sql`SELECT count(*)::int AS n FROM public.intake_file WHERE tenant_id=${KREILE_TENANT_SLUG} AND item_id=${overview.itemId}::uuid`).toEqual([{n:2}]);
});
it.each([0,1,3])('W-WARE W4 accepts %i unpriced parts only when real parts exist and exposes the price step without inventing zero',async count=>{
 const {createOrderIntakeAction}=await import('@/app/actions/eingang.actions');
 const {getLiveOrderCardAction}=await import('@/app/actions/orders.actions');
 const customerId=await customerFixture('S12 W4 '+count);
 const input={geprueft:true,clientEventId:randomUUID(),customer:{mode:'EXISTING' as const,customerId},dueDate:'2027-05-15',termStatus:'bestaetigt',intakeSource:'persoenlich',handoverMode:'pickup',paymentMode:'rechnung',note:'TEST S12 Ware ohne Preis',items:Array.from({length:count},(_,index)=>({catalogServiceId:null,name:'TEST Unbewertet '+index,quantity:index+1,material:'Messing',surfaceRequested:'Verchromen',executionRequested:'offen',unit:'Stück',unitPriceCents:null,vatRateBasisPoints:null}))};
 const created=await withSession(full,()=>createOrderIntakeAction(input));
 if(count===0){
  expect(created).toMatchObject({code:'VALIDATION_ERROR'});
  expect(await sql`SELECT count(*)::int AS n FROM public.orders WHERE tenant_id=${KREILE_TENANT_SLUG} AND customer_id=${customerId}`).toEqual([{n:0}]);
  return;
 }
 expect(created,JSON.stringify(created)).toMatchObject({code:'OK'});if(created.code!=='OK')throw Error('S12_W4_CREATE:'+created.code);
 const orderId=created.receipt.orderId,read=await withSession(full,()=>getLiveOrderCardAction({orderId}));
 expect(read.code).toBe('OK');if(read.code!=='OK')throw Error('S12_W4_READ:'+read.code);
 expect(read.data.card.items).toHaveLength(count);
 expect(read.data.card.items.every(item=>item.unitPriceCents===null)).toBe(true);
 expect(read.data.card.operationalFacts).toMatchObject({pricesMissing:true});
 expect(read.data.nextActionRule).toMatchObject({hauptaktion:{elementId:'order.prices',befehl:{funktion:'setInvoiceItemPricesAction',argumente:{orderId,expectedVersion:1}}}});
 expect(await withSession(full,()=>createOrderIntakeAction(JSON.parse(JSON.stringify(input))))).toMatchObject({code:'OK',replayed:true,receipt:{orderId}});
 expect(await sql`SELECT count(*)::int AS n FROM public.orders WHERE tenant_id=${KREILE_TENANT_SLUG} AND customer_id=${customerId}`).toEqual([{n:1}]);
});

it('W-WARE W4/W5/Q1/Q2 executes the reread U2 station command and preserves rights, stale rejection and correction retries',async()=>{
 const {getLiveOrderCardAction,transitionWareneingangToGalvanikAction,correctGalvanikToWareneingangAction}=await import('@/app/actions/orders.actions');
 const customerId=await customerFixture('S12 W5'),created=await intakeOrderFixture('S12 W5',customerId),orderId=created.receipt.orderId;
 const before=await withSession(full,()=>getLiveOrderCardAction({orderId}));
 expect(before.code).toBe('OK');if(before.code!=='OK')throw Error('S12_W5_BEFORE:'+before.code);
 expect(before.data.nextActionRule).toMatchObject({hauptaktion:{elementId:'order.start',befehl:{funktion:'transitionWareneingangToGalvanikAction',argumente:{orderId,expectedVersion:1}}}});
 const action=before.data.nextActionRule?.hauptaktion;if(!action)throw Error('S12_W5_COMMAND');
 const input:Parameters<typeof transitionWareneingangToGalvanikAction>[0]={...JSON.parse(JSON.stringify(action.befehl.argumente)),clientEventId:randomUUID()};
 const noOrders=await createFixture(['mails'],'werkstatt');
 const denied=await withSession(noOrders,()=>getLiveOrderCardAction({orderId}));
 expect(denied.code).toBe('FORBIDDEN');
 expect(await withSession(noOrders,()=>transitionWareneingangToGalvanikAction(input))).toMatchObject({code:'FORBIDDEN'});
 const moved=await withSession(full,()=>transitionWareneingangToGalvanikAction(input));
 expect(moved.code).toBe('OK');if(moved.code!=='OK')throw Error('S12_W5_MOVE:'+moved.code);
 const after=await withSession(full,()=>getLiveOrderCardAction({orderId}));
 expect(after.code).toBe('OK');if(after.code!=='OK')throw Error('S12_W5_AFTER:'+after.code);
 expect(after.data.card).toMatchObject({station:'galvanik',version:moved.receipt.aggregateVersion});
 expect(after.data.nextActionRule?.hauptaktion?.elementId).not.toBe('order.start');
 expect(after.data.nextActionRule?.source).toMatchObject({id:orderId,version:moved.receipt.aggregateVersion});
 expect(await withSession(full,()=>transitionWareneingangToGalvanikAction(JSON.parse(JSON.stringify(input))))).toMatchObject({code:'OK',replayed:true,receipt:{eventId:moved.receipt.eventId}});
 expect(await withSession(full,()=>transitionWareneingangToGalvanikAction({...input,clientEventId:randomUUID()}))).toMatchObject({code:'CONFLICT'});
 const correction={orderId,expectedVersion:moved.receipt.aggregateVersion,reason:'TEST Ware noch nicht bearbeitet',clientEventId:randomUUID()};
 const corrected=await withSession(full,()=>correctGalvanikToWareneingangAction(correction));
 expect(corrected.code).toBe('OK');if(corrected.code!=='OK')throw Error('S12_W5_CORRECTION:'+corrected.code);
 expect(await withSession(full,()=>getLiveOrderCardAction({orderId}))).toMatchObject({code:'OK',data:{card:{station:'angenommen',version:corrected.receipt.aggregateVersion},nextActionRule:{hauptaktion:{elementId:'order.start',befehl:{argumente:{orderId,expectedVersion:corrected.receipt.aggregateVersion}}}}}});
 expect(await withSession(full,()=>correctGalvanikToWareneingangAction(JSON.parse(JSON.stringify(correction))))).toMatchObject({code:'OK',replayed:true});
 expect(await sql`SELECT count(*)::int AS n FROM public.events WHERE tenant_id=${KREILE_TENANT_SLUG} AND client_event_id=${input.clientEventId}::uuid`).toEqual([{n:1}]);
});

it.each([1,3])('W-WARE W6/W7/W9 rereads %i real parts through photo gates, completion retries and one snapshot per part',async count=>{
 const {createOrderIntakeAction}=await import('@/app/actions/eingang.actions');
 const {getLiveOrderCardAction,transitionWareneingangToGalvanikAction,setOrderItemFinishedAction,freezeOrderAction,getExtraWorkMasterDataAction,setExtraWorkHourlyRateAction}=await import('@/app/actions/orders.actions');
 const customerId=await customerFixture('S12 W7 '+count);
 const input={geprueft:true,clientEventId:randomUUID(),customer:{mode:'EXISTING' as const,customerId},dueDate:'2027-05-15',termStatus:'bestaetigt',intakeSource:'persoenlich',handoverMode:'pickup',paymentMode:'rechnung',note:'TEST S12 Fertigkanten',items:Array.from({length:count},(_,index)=>({catalogServiceId:null,name:'TEST S12 Teil '+index,quantity:index+1,material:'Messing',surfaceRequested:'Verchromen',executionRequested:'offen',unit:'Stück',unitPriceCents:1000,vatRateBasisPoints:1900}))};
 const created=await withSession(full,()=>createOrderIntakeAction(input));
 expect(created.code).toBe('OK');if(created.code!=='OK')throw Error('S12_W7_CREATE:'+created.code);
 const orderId=created.receipt.orderId;
 expect(await withSession(full,()=>createOrderIntakeAction(JSON.parse(JSON.stringify(input))))).toMatchObject({code:'OK',replayed:true,receipt:{orderId}});
 const moved=await withSession(full,()=>transitionWareneingangToGalvanikAction({orderId,expectedVersion:1,clientEventId:randomUUID()}));
 expect(moved.code).toBe('OK');if(moved.code!=='OK')throw Error('S12_W7_MOVE:'+moved.code);
 let version=moved.receipt.aggregateVersion;
 for(const item of created.receipt.items){
  const finish={orderId,itemId:item.id,expectedVersion:version,clientEventId:randomUUID(),finished:true};
  const finished=await withSession(full,()=>setOrderItemFinishedAction(finish));
  expect(finished.code).toBe('OK');if(finished.code!=='OK')throw Error('S12_W7_FINISH:'+finished.code);
  version=finished.receipt.aggregateVersion;
  const read=await withSession(full,()=>getLiveOrderCardAction({orderId}));
  expect(read).toMatchObject({code:'OK',data:{card:{version,items:expect.arrayContaining([expect.objectContaining({id:item.id,finished:true})])},nextActionRule:{hauptaktion:{elementId:'order.photo'}}}});
  expect(await withSession(full,()=>setOrderItemFinishedAction(JSON.parse(JSON.stringify(finish))))).toMatchObject({code:'OK',replayed:true,receipt:{eventId:finished.receipt.eventId}});
  expect(await sql`SELECT count(*)::int AS n FROM private.order_production_snapshots WHERE tenant_id=${KREILE_TENANT_SLUG} AND event_id=${finished.receipt.eventId} AND component='base' AND direction=1`).toEqual([{n:1}]);
 }
 const master=await withSession(full,()=>getExtraWorkMasterDataAction());if(master.code!=='OK')throw Error('S12_W9_MASTER');
 if(!master.data.currentRate)expect(await withSession(full,()=>setExtraWorkHourlyRateAction({rateId:randomUUID(),expectedVersion:0,hourlyRateCents:14000,clientEventId:randomUUID()}))).toMatchObject({code:'OK'});
 const freeze={orderId,expectedVersion:version,freezeId:randomUUID(),clientEventId:randomUUID()};
 expect(await withSession(full,()=>freezeOrderAction(freeze))).toMatchObject({code:'VALIDATION_ERROR'});
 for(const item of created.receipt.items)await storeItemPhoto(orderId,item.id);
 const ready=await withSession(full,()=>getLiveOrderCardAction({orderId}));
 expect(ready).toMatchObject({code:'OK',data:{nextActionRule:{hauptaktion:{elementId:'order.finish',befehl:{argumente:{orderId,expectedVersion:version}}}}}});
 const frozen=await withSession(full,()=>freezeOrderAction(JSON.parse(JSON.stringify(freeze))));
 expect(frozen.code).toBe('OK');if(frozen.code!=='OK')throw Error('S12_W9_FREEZE:'+frozen.code);
 const after=await withSession(full,()=>getLiveOrderCardAction({orderId}));
 expect(after.code).toBe('OK');if(after.code!=='OK')throw Error('S12_W9_READ:'+after.code);
 expect(after.data.card).toMatchObject({station:'fertig',version:frozen.receipt.aggregateVersion});
 expect(after.data.nextActionRule?.hauptaktion?.elementId).not.toBe('order.finish');
 expect(await withSession(full,()=>freezeOrderAction(JSON.parse(JSON.stringify(freeze))))).toMatchObject({code:'OK',replayed:true,receipt:{eventId:frozen.receipt.eventId}});
 expect(await sql`SELECT count(*)::int AS n,sum(quantity)::int AS quantity FROM private.order_production_snapshots WHERE tenant_id=${KREILE_TENANT_SLUG} AND order_id=${orderId} AND component='base' AND direction=1`).toEqual([{n:count,quantity:count*(count+1)/2}]);
});

it('W-WARE Q3 a real finish-event SQL failure leaves the part and U2 unchanged, then the same click succeeds once',async()=>{
 const {transitionWareneingangToGalvanikAction,setOrderItemFinishedAction,getLiveOrderCardAction}=await import('@/app/actions/orders.actions');
 const customerId=await customerFixture('S12 Q3'),created=await intakeOrderFixture('S12 Q3',customerId),orderId=created.receipt.orderId,itemId=created.receipt.items[0].id;
 const moved=await withSession(full,()=>transitionWareneingangToGalvanikAction({orderId,expectedVersion:1,clientEventId:randomUUID()}));
 expect(moved.code).toBe('OK');if(moved.code!=='OK')throw Error('S12_Q3_MOVE:'+moved.code);
 const before=await withSession(full,()=>getLiveOrderCardAction({orderId}));
 expect(before.code).toBe('OK');if(before.code!=='OK')throw Error('S12_Q3_BEFORE:'+before.code);
 const input={orderId,itemId,expectedVersion:moved.receipt.aggregateVersion,clientEventId:randomUUID(),finished:true};
 if(!KREILE_TENANT_SLUG.startsWith('TEST-ablauf-'))throw Error('S12_TEST_TRIGGER_ONLY');
 const trigger='test_s12_finish_'+randomUUID().replaceAll('-','');
 await sql.unsafe(`CREATE FUNCTION private.${trigger}() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.tenant_id='${KREILE_TENANT_SLUG}' AND NEW.order_id='${orderId}' AND NEW.event_type='ORDER_ITEM_FINISHED_CHANGED_V1' THEN RAISE EXCEPTION 'TEST_S12_FINISH_EVENT_WRITE_FAILED'; END IF; RETURN NEW; END $$`);
 await sql.unsafe(`CREATE TRIGGER ${trigger} BEFORE INSERT ON public.events FOR EACH ROW EXECUTE FUNCTION private.${trigger}()`);
 try{
  expect(await withSession(full,()=>setOrderItemFinishedAction(input))).toMatchObject({code:'UNAVAILABLE'});
  const failed=await withSession(full,()=>getLiveOrderCardAction({orderId}));
  expect(failed.code).toBe('OK');if(failed.code!=='OK')throw Error('S12_Q3_FAILED_READ:'+failed.code);
  expect(failed.data.card).toMatchObject({version:moved.receipt.aggregateVersion,items:[{id:itemId,finished:false}]});
  expect(failed.data.nextActionRule).toEqual(before.data.nextActionRule);
  expect(await sql`SELECT count(*)::int AS n FROM public.events WHERE tenant_id=${KREILE_TENANT_SLUG} AND client_event_id=${input.clientEventId}::uuid`).toEqual([{n:0}]);
  expect(await sql`SELECT count(*)::int AS n FROM private.order_production_snapshots WHERE tenant_id=${KREILE_TENANT_SLUG} AND order_id=${orderId}`).toEqual([{n:0}]);
 }finally{
  await sql.unsafe(`DROP TRIGGER ${trigger} ON public.events`);
  await sql.unsafe(`DROP FUNCTION private.${trigger}()`);
 }
 const recovered=await withSession(full,()=>setOrderItemFinishedAction(JSON.parse(JSON.stringify(input))));
 expect(recovered.code).toBe('OK');if(recovered.code!=='OK')throw Error('S12_Q3_RETRY:'+recovered.code);
 expect(await withSession(full,()=>getLiveOrderCardAction({orderId}))).toMatchObject({code:'OK',data:{card:{version:recovered.receipt.aggregateVersion,items:[{id:itemId,finished:true}]}}});
 expect(await withSession(full,()=>setOrderItemFinishedAction(JSON.parse(JSON.stringify(input))))).toMatchObject({code:'OK',replayed:true,receipt:{eventId:recovered.receipt.eventId}});
 expect(await sql`SELECT count(*)::int AS n FROM private.order_production_snapshots WHERE tenant_id=${KREILE_TENANT_SLUG} AND order_id=${orderId} AND direction=1 AND component='base'`).toEqual([{n:1}]);
});

it('W-WARE W8 records thirty minutes, keeps invoice issue off an unfinished order and rereads the same line',async()=>{
 const {transitionWareneingangToGalvanikAction,configureExtraWorkCatalogPositionAction,changeOrderItemExtraWorkAction,getLiveOrderCardAction,getExtraWorkMasterDataAction,setExtraWorkHourlyRateAction}=await import('@/app/actions/orders.actions');
 const customerId=await customerFixture('S12 W8'),created=await intakeOrderFixture('S12 W8',customerId),orderId=created.receipt.orderId,itemId=created.receipt.items[0].id;
 const moved=await withSession(full,()=>transitionWareneingangToGalvanikAction({orderId,expectedVersion:1,clientEventId:randomUUID()}));
 expect(moved.code).toBe('OK');if(moved.code!=='OK')throw Error('S12_W8_MOVE:'+moved.code);
 await storeItemPhoto(orderId,itemId);
 const catalogPositionId=randomUUID();
 const master=await withSession(full,()=>getExtraWorkMasterDataAction());if(master.code!=='OK')throw Error('S12_W8_MASTER');
 if(!master.data.currentRate)expect(await withSession(full,()=>setExtraWorkHourlyRateAction({rateId:randomUUID(),expectedVersion:0,hourlyRateCents:14000,clientEventId:randomUUID()}))).toMatchObject({code:'OK'});
 expect(await withSession(full,()=>configureExtraWorkCatalogPositionAction({positionId:catalogPositionId,expectedVersion:0,name:'TEST S12 Mehrarbeit',standardMinutes:30,active:true,clientEventId:randomUUID()}))).toMatchObject({code:'OK'});
 const input={lineId:randomUUID(),orderId,itemId,catalogPositionId,minutes:30,active:true,expectedLineVersion:0,expectedOrderVersion:moved.receipt.aggregateVersion,clientEventId:randomUUID()};
 const changed=await withSession(full,()=>changeOrderItemExtraWorkAction(input));
 expect(changed.code).toBe('OK');if(changed.code!=='OK')throw Error('S12_W8_EXTRA:'+changed.code);
 const after=await withSession(full,()=>getLiveOrderCardAction({orderId}));
 expect(after.code).toBe('OK');if(after.code!=='OK')throw Error('S12_W8_READ:'+after.code);
 expect(after.data.card).toMatchObject({version:changed.receipt.aggregateVersion,station:'galvanik',items:[{id:itemId,finished:false,extraWork:expect.arrayContaining([expect.objectContaining({lineId:input.lineId,minutes:30,frozen:false})])}]});
 expect(after.data.nextActionRule).toMatchObject({hauptaktion:{elementId:'order.parts'}});
 expect(await sql`SELECT count(*)::int AS n FROM public.invoices WHERE tenant_id=${KREILE_TENANT_SLUG} AND order_id=${orderId}`).toEqual([{n:0}]);
 expect(await withSession(full,()=>changeOrderItemExtraWorkAction(JSON.parse(JSON.stringify(input))))).toMatchObject({code:'OK',replayed:true,receipt:{eventId:changed.receipt.eventId}});
 expect(await sql`SELECT count(*)::int AS n FROM public.events WHERE tenant_id=${KREILE_TENANT_SLUG} AND client_event_id=${input.clientEventId}::uuid`).toEqual([{n:1}]);
});

it('W-WARE Q4 C-74 rereads a terminal pickup and refuses later completion, date and invoice-price changes without effects',async()=>{
 const order=await readyInvoiceOrder('S12 C74');
 const {recordGoodsOutAction}=await import('@/app/actions/goodsOut.actions');
 const {getLiveOrderCardAction,freezeOrderAction,setOrderItemFinishedAction,changeOrderPromisedDueDateAction}=await import('@/app/actions/orders.actions');
 const {setInvoiceItemPricesAction}=await import('@/app/actions/invoices.actions');
 const released=await withSession(full,()=>recordGoodsOutAction({orderId:order.orderId,mode:'abholung',expectedVersion:order.version,clientEventId:randomUUID()}));
 expect(released.code).toBe('OK');if(released.code!=='OK')throw Error('S12_C74_RELEASE:'+released.code);
 const version=released.receipt.orderVersion;
 const before=await withSession(full,()=>getLiveOrderCardAction({orderId:order.orderId}));
 expect(before).toMatchObject({code:'OK',data:{card:{station:'abgeholt',version},nextActionRule:{zustand:'closed',hauptaktion:null}}});
 const eventsBefore=await sql`SELECT id::text FROM public.events WHERE tenant_id=${KREILE_TENANT_SLUG} AND order_id=${order.orderId} ORDER BY id`;
 expect(await withSession(full,()=>freezeOrderAction({orderId:order.orderId,expectedVersion:version,freezeId:randomUUID(),clientEventId:randomUUID()}))).toMatchObject({code:'VALIDATION_ERROR'});
 expect(await withSession(full,()=>setOrderItemFinishedAction({orderId:order.orderId,itemId:order.items[0].id,expectedVersion:version,finished:true,clientEventId:randomUUID()}))).toMatchObject({code:'CONFLICT'});
 expect(await withSession(full,()=>changeOrderPromisedDueDateAction({orderId:order.orderId,expectedVersion:version,dueDate:'2027-06-01',reason:'TEST nach Abholung nicht ändern',clientEventId:randomUUID()}))).toMatchObject({code:'CONFLICT'});
 expect(await withSession(full,()=>setInvoiceItemPricesAction({orderId:order.orderId,expectedVersion:version,prices:[{itemId:order.items[0].id,unitPriceCents:99999}],clientEventId:randomUUID()}))).toMatchObject({code:'VALIDATION_ERROR'});
 expect(await sql`SELECT id::text FROM public.events WHERE tenant_id=${KREILE_TENANT_SLUG} AND order_id=${order.orderId} ORDER BY id`).toEqual(eventsBefore);
 const after=await withSession(full,()=>getLiveOrderCardAction({orderId:order.orderId}));
 expect(after.code).toBe('OK');if(after.code!=='OK'||before.code!=='OK')throw Error('S12_C74_REREAD');
 expect(after.data.card).toEqual(before.data.card);
 expect(after.data.nextActionRule).toEqual(before.data.nextActionRule);
});
