import {randomUUID} from 'node:crypto';
import {expect,it} from 'vitest';
import {KREILE_TENANT_SLUG} from '@/lib/tenant';
import {sql,full,withSession,createFixture} from './replayHarness';
import {customerFixture,intakeOrderFixture} from './orderFixture';
import {storeItemPhoto} from './photoFixture';

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
