// @vitest-environment node
// Real commands/Auth/DB; only the device clock is an explicit test boundary.
import {it,expect,vi} from 'vitest';
import {randomUUID} from 'node:crypto';
const tenant=vi.hoisted(()=>'TEST-ablauf-'+globalThis.crypto.randomUUID());
vi.mock('@/lib/tenant',()=>({KREILE_TENANT_SLUG:tenant}));
import {KREILE_TENANT_SLUG} from '@/lib/tenant';
import {sql,full,withSession,createFixture} from '../../../e2e/ablauf/replayHarness';
import {customerFixture,intakeOrderFixture} from '../../../e2e/ablauf/orderFixture';
import {transitionWareneingangToGalvanikAction,setOrderItemFinishedAction,changeOrderContentAction,getProductionWeekAction} from '@/app/actions/orders.actions';
import {replayOfflineWorkshopAction} from '@/app/actions/offlineWorkshop.actions';
import {getIntakeTaskAction,completeIntakeTaskAction} from '@/app/actions/eingang.actions';
import {offlinePartition} from '@/lib/server/offlinePartition';
if(!process.env.DATABASE_URL||process.env.DATABASE_URL!==process.env.H18_EXPECTED_DATABASE_URL||!['127.0.0.1','localhost'].includes(new URL(process.env.DATABASE_URL).hostname)||new URL(process.env.DATABASE_URL).pathname!=='/postgres'||!tenant.startsWith('TEST-'))throw Error('OWN_LOOPBACK_REQUIRED');
async function setup(label:string){
 const customer=await customerFixture(label),created=await intakeOrderFixture(label,customer),orderId=created.receipt.orderId,itemId=created.receipt.items[0].id;
 const moved=await withSession(full,()=>transitionWareneingangToGalvanikAction({orderId,expectedVersion:1,clientEventId:randomUUID()}));if(moved.code!=='OK')throw Error('TEST_MOVE');
 return {created,orderId,itemId,version:moved.receipt.aggregateVersion};
}
async function finish(orderId:string,itemId:string,version:number,at:string){
 const key=randomUUID(),original={kind:'workshop' as const,command:'item.finished' as const,id:key,itemId:orderId,deviceCapturedAt:at,input:{orderId,itemId,expectedVersion:version,clientEventId:key,finished:true}};
 const result=await withSession(full,()=>replayOfflineWorkshopAction(offlinePartition({tenantId:KREILE_TENANT_SLUG,userId:full.actorId}),original));
 expect(result).toMatchObject({code:'OK'});if(result.code!=='OK')throw Error('TEST_OFFLINE_FINISH');
 expect(await withSession(full,()=>replayOfflineWorkshopAction(offlinePartition({tenantId:KREILE_TENANT_SLUG,userId:full.actorId}),JSON.parse(JSON.stringify(original))))).toMatchObject({code:'OK',replayed:true,receipt:{eventId:result.receipt.eventId}});
 return {...result,original};
}
it('does not backdate today’s price, supplements only on an actual pricing event and reverses original values',async()=>{
 const {created,orderId,itemId,version}=await setup('Offline KW unbewertet'),at=new Date(Date.now()-8*86400000).toISOString();
 const saved=await finish(orderId,itemId,version,at);
 // PL12:01: initial real price after device time is a pricing-week supplement.
 const [base]=await sql`SELECT net_cents,(extract(epoch FROM occurred_at AT TIME ZONE 'UTC')*1000)::double precision AS millis,price_source FROM private.order_production_snapshots WHERE event_id=${saved.receipt.eventId} AND item_id=${itemId}`;
 expect(base).toMatchObject({net_cents:null,millis:Date.parse(at),price_source:{offlineUnvalued:true}});
 expect(await withSession(full,()=>getProductionWeekAction({onDate:at.slice(0,10)}))).toMatchObject({code:'OK',data:{netCents:0,currentlyUnpricedItemCount:0}});
 const priced=await withSession(full,()=>changeOrderContentAction({orderId,expectedVersion:saved.receipt.aggregateVersion,clientEventId:randomUUID(),note:'TEST echte Bepreisung nach Abgleich',items:[{id:itemId,catalogServiceId:null,name:'TEST Offline Preis',quantity:1,material:'Messing',surface:'Verchromen',unit:'Stück',unitPriceCents:25000,vatRateBasisPoints:1900}]}));
 expect(priced.code).toBe('OK');if(priced.code!=='OK')throw Error('TEST_PRICE');
 expect(await sql`SELECT event_id,net_cents::int FROM private.order_production_snapshots WHERE origin_event_id=${saved.receipt.eventId} AND component='pricing' ORDER BY (SELECT created_at FROM public.events WHERE id=event_id)`).toEqual([{event_id:created.receipt.eventId,net_cents:10000},{event_id:priced.receipt.eventId,net_cents:15000}]);
 expect(await withSession(full,()=>getProductionWeekAction({onDate:new Date().toISOString().slice(0,10)}))).toMatchObject({code:'OK',data:{netCents:25000,currentlyUnpricedItemCount:0}});
 const input={orderId,itemId,expectedVersion:priced.receipt.aggregateVersion,clientEventId:randomUUID(),finished:false};
 const reopened=await withSession(full,()=>setOrderItemFinishedAction(input));expect(reopened.code).toBe('OK');
 expect(await withSession(full,()=>setOrderItemFinishedAction(JSON.parse(JSON.stringify(input))))).toMatchObject({code:'OK',replayed:true});
 expect(await sql`SELECT component,net_cents::int FROM private.order_production_snapshots WHERE order_id=${orderId} AND tenant_id=${KREILE_TENANT_SLUG} AND direction=-1 ORDER BY component,net_cents`).toEqual([{component:'base',net_cents:null},{component:'pricing',net_cents:10000},{component:'pricing',net_cents:15000}]);
 expect(await withSession(full,()=>getProductionWeekAction({onDate:new Date().toISOString().slice(0,10)}))).toMatchObject({code:'OK',data:{netCents:0}});
});
it('uses the real pre-existing price receipt and keeps booking order independent of a device clock ahead',async()=>{
 const {created,orderId,itemId,version}=await setup('Offline KW belegter Preis'),at=new Date(Date.now()+60000).toISOString();
 const saved=await finish(orderId,itemId,version,at);
 const [base]=await sql`SELECT net_cents::int,(extract(epoch FROM occurred_at AT TIME ZONE 'UTC')*1000)::double precision AS millis,price_source FROM private.order_production_snapshots WHERE event_id=${saved.receipt.eventId} AND item_id=${itemId}`;
 expect(base).toMatchObject({net_cents:10000,millis:Date.parse(at),price_source:{historicalPriceEventId:created.receipt.eventId,historicalQuantityEventId:created.receipt.eventId}});
 const reopened=await withSession(full,()=>setOrderItemFinishedAction({orderId,itemId,expectedVersion:saved.receipt.aggregateVersion,clientEventId:randomUUID(),finished:false}));
 expect(reopened.code).toBe('OK');if(reopened.code!=='OK')throw Error('TEST_REOPEN_AHEAD');
 expect(await sql`SELECT net_cents::int,reverses_event_id FROM private.order_production_snapshots WHERE event_id=${reopened.receipt.eventId} AND item_id=${itemId}`).toEqual([{net_cents:10000,reverses_event_id:saved.receipt.eventId}]);
 // Explicit synthetic INSERT attack against the real protected original source.
 await expect(sql`INSERT INTO private.order_production_snapshots SELECT (jsonb_populate_record(NULL::private.order_production_snapshots,to_jsonb(snapshot)||jsonb_build_object('occurred_at',(SELECT created_at FROM public.events WHERE id=${saved.receipt.eventId})))) .*
  FROM private.order_production_snapshots snapshot WHERE snapshot.event_id=${saved.receipt.eventId} AND snapshot.item_id=${itemId}`).rejects.toMatchObject({code:'P0001'});
});

it('keeps a proven historical price and books a later real pricing receipt in its pricing week',async()=>{
 const {orderId,itemId,version}=await setup('Offline Preis zwischen Ereignis und Abgleich'),at=new Date().toISOString();
 const priced=await withSession(full,()=>changeOrderContentAction({orderId,expectedVersion:version,clientEventId:randomUUID(),note:'TEST spaeterer echter Preisbeleg',items:[{id:itemId,catalogServiceId:null,name:'TEST Preisfolge',quantity:1,material:'Messing',surface:'Verchromen',unit:'Stück',unitPriceCents:25000,vatRateBasisPoints:1900}]}));
 if(priced.code!=='OK')throw Error('TEST_LATER_PRICE');
 // Explicit device-time/version boundary: the recorded physical event predates
 // this supplied current version. No server event or price is backdated.
 const saved=await finish(orderId,itemId,priced.receipt.aggregateVersion,at);
 expect(await sql`SELECT net_cents::int FROM private.order_production_snapshots WHERE event_id=${saved.receipt.eventId} AND component='base'`).toEqual([{net_cents:10000}]);
 expect(await sql`SELECT event_id,net_cents::int FROM private.order_production_snapshots WHERE origin_event_id=${saved.receipt.eventId} AND component='pricing'`).toEqual([{event_id:priced.receipt.eventId,net_cents:15000}]);
});

it('retains the pending original when the real task history fails, then repairs via the same N5 original',async()=>{
 const {orderId,itemId,version}=await setup('Offline '+ 'Ä'.repeat(80)+' 🔧'.repeat(6)),key=randomUUID();
 const original={kind:'workshop' as const,command:'item.finished' as const,id:key,itemId:orderId,deviceCapturedAt:new Date(Date.now()-8*86400000).toISOString(),input:{orderId,itemId,expectedVersion:version,clientEventId:key,finished:true}};
 const replay=()=>withSession(full,()=>replayOfflineWorkshopAction(offlinePartition({tenantId:KREILE_TENANT_SLUG,userId:full.actorId}),JSON.parse(JSON.stringify(original))));
 const fault='test_r2_'+randomUUID().replaceAll('-',''),history=fault+'_history';
 await sql.unsafe(`CREATE FUNCTION private.${fault}() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.tenant_id='${KREILE_TENANT_SLUG}' AND NEW.order_id='${orderId}' AND NEW.component='pricing' THEN RAISE EXCEPTION 'TEST_REAL_PRICE_SQL_FAILURE'; END IF; RETURN NEW; END $$`);
 await sql.unsafe(`CREATE TRIGGER ${fault} BEFORE INSERT ON private.order_production_snapshots FOR EACH ROW EXECUTE FUNCTION private.${fault}()`);
 await sql.unsafe(`CREATE FUNCTION private.${history}() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.tenant_id='${KREILE_TENANT_SLUG}' AND NEW.nachher->>'action'='aufgabe.angelegt' THEN RAISE EXCEPTION 'TEST_REAL_TASK_HISTORY_FAILURE'; END IF; RETURN NEW; END $$`);
 await sql.unsafe(`CREATE TRIGGER ${history} BEFORE INSERT ON public.intake_event FOR EACH ROW EXECUTE FUNCTION private.${history}()`);
 try{
  expect(await replay()).toMatchObject({code:'UNAVAILABLE'});
  expect(await sql`SELECT current_station_id FROM public.items WHERE tenant_id=${KREILE_TENANT_SLUG} AND id=${itemId}`).toEqual([{current_station_id:'fertig'}]);
  expect(await sql`SELECT id FROM public.tasks WHERE tenant_id=${KREILE_TENANT_SLUG} AND bezug_id=${orderId}`).toHaveLength(0);
  const [marker]=await sql`SELECT id FROM public.events WHERE tenant_id=${KREILE_TENANT_SLUG} AND order_id=${orderId} AND event_type='ORDER_PRODUCTION_PRICING_RETRY_REQUIRED_V1'`;
  expect(marker).toBeDefined();
  // Real immutable source, not a synthetic successful pricing receipt.
  await expect(sql`UPDATE public.events SET description='TEST changed' WHERE id=${marker.id}`).rejects.toMatchObject({code:'P0001'});
  await expect(sql`DELETE FROM public.events WHERE id=${marker.id}`).rejects.toMatchObject({code:'P0001'});
  await sql.unsafe(`DROP TRIGGER ${history} ON public.intake_event`);
  expect(await replay()).toMatchObject({code:'OK',replayed:true});
  const [task]=await sql`SELECT id::text,status,fuer_bereich,titel,notiz FROM public.tasks WHERE tenant_id=${KREILE_TENANT_SLUG} AND bezug_id=${orderId}`;
  expect(task.titel.length).toBeLessThanOrEqual(120);expect(task.titel).toContain('…');expect(task.notiz).toContain('Ä'.repeat(80)+' 🔧'.repeat(6));
  expect(task).toMatchObject({status:'offen',fuer_bereich:'geld'}); // No active entscheiden login in this tenant yet.
  await sql.unsafe(`DROP TRIGGER ${fault} ON private.order_production_snapshots`);
  expect(await replay()).toMatchObject({code:'OK',replayed:true});
  expect(await sql`SELECT status FROM public.tasks WHERE id=${task.id}::uuid AND tenant_id=${KREILE_TENANT_SLUG}`).toEqual([{status:'erledigt'}]);
  expect(await sql`SELECT id FROM public.events WHERE tenant_id=${KREILE_TENANT_SLUG} AND client_event_id=${key}::uuid`).toHaveLength(1);
  expect(await sql`SELECT id FROM public.tasks WHERE tenant_id=${KREILE_TENANT_SLUG} AND bezug_id=${orderId}`).toHaveLength(1);
 }finally{
  await sql.unsafe(`DROP TRIGGER IF EXISTS ${history} ON public.intake_event`);await sql.unsafe(`DROP FUNCTION IF EXISTS private.${history}()`);
  await sql.unsafe(`DROP TRIGGER IF EXISTS ${fault} ON private.order_production_snapshots`);await sql.unsafe(`DROP FUNCTION IF EXISTS private.${fault}()`);
 }
});

it('keeps a real physical completion when its later pricing supplement hits an SQL error',async()=>{
 const decider=await createFixture(['entscheiden']); // Real recipient, without money or order permission.
 const {created,orderId,itemId,version}=await setup('Offline Nachtrag SQL-Fehler'),at=new Date(Date.now()-8*86400000).toISOString();
 const [source]=await sql`SELECT item.name,to_char(event.created_at AT TIME ZONE 'UTC' AT TIME ZONE 'Europe/Berlin','DD.MM.YYYY') AS day FROM public.items item JOIN public.events event ON event.id=${created.receipt.eventId} WHERE item.tenant_id=${KREILE_TENANT_SLUG} AND item.id=${itemId}`;
 const title=`Wochenwert für ${source.name} nachtragen – Preisbuchung vom ${source.day} ist gescheitert`;
 const fault='test_offline_price_'+randomUUID().replaceAll('-','');
 await sql.unsafe(`CREATE FUNCTION private.${fault}() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.tenant_id='${KREILE_TENANT_SLUG}' AND NEW.order_id='${orderId}' AND NEW.component='pricing' THEN RAISE EXCEPTION 'TEST_REAL_PRICE_SQL_FAILURE'; END IF; RETURN NEW; END $$`);
 await sql.unsafe(`CREATE TRIGGER ${fault} BEFORE INSERT ON private.order_production_snapshots FOR EACH ROW EXECUTE FUNCTION private.${fault}()`);
 let saved:Awaited<ReturnType<typeof finish>>|undefined,taskId:string|undefined;
 try{
  saved=await finish(orderId,itemId,version,at);
  expect(await sql`SELECT current_station_id FROM public.items WHERE tenant_id=${KREILE_TENANT_SLUG} AND id=${itemId}`).toEqual([{current_station_id:'fertig'}]);
  expect(await sql`SELECT net_cents FROM private.order_production_snapshots WHERE event_id=${saved.receipt.eventId} AND item_id=${itemId} AND component='base'`).toEqual([{net_cents:null}]);
  const tasks=await sql`SELECT id::text,version,titel,status,erstellt_von::text,fuer_bereich FROM public.tasks WHERE tenant_id=${KREILE_TENANT_SLUG} AND bezug_id=${orderId} AND titel=${title}`;
  expect(tasks).toHaveLength(1);if(tasks.length!==1)throw Error('TEST_REAL_PRICING_TASK_MISSING');
  expect(tasks[0]).toMatchObject({titel:title,status:'offen',erstellt_von:full.actorId,fuer_bereich:'entscheiden'});taskId=tasks[0].id;if(typeof taskId!=='string')throw Error('TEST_TASK_ID_MISSING');
  // The existing task command must retry the actual posting, never just close it.
  expect(await withSession(decider,()=>completeIntakeTaskAction({taskId,version:tasks[0].version,note:null}))).toMatchObject({code:'UNAVAILABLE'});
  expect(await sql`SELECT status FROM public.tasks WHERE tenant_id=${KREILE_TENANT_SLUG} AND id=${taskId}::uuid`).toEqual([{status:'offen'}]);
 }finally{await sql.unsafe(`DROP TRIGGER IF EXISTS ${fault} ON private.order_production_snapshots`);await sql.unsafe(`DROP FUNCTION IF EXISTS private.${fault}()`);}
 if(!saved||!taskId)throw Error('TEST_PRICING_FOLLOWUP_NOT_PRESERVED');
 const task=await withSession(decider,()=>getIntakeTaskAction({taskId:taskId!}));expect(task).toMatchObject({code:'OK',pricingSource:'KNOWN',canComplete:true,completeLabel:'Nachtrag erneut auslösen'});if(task.code!=='OK'||!task.task)throw Error('TEST_TASK_READER');
 const retry={taskId,version:task.task.version,note:null};
 expect(await withSession(decider,()=>completeIntakeTaskAction(retry))).toMatchObject({code:'OK'});
 expect(await withSession(decider,()=>completeIntakeTaskAction(JSON.parse(JSON.stringify(retry))))).toMatchObject({code:'OK',replayed:true});
 expect(await withSession(full,()=>replayOfflineWorkshopAction(offlinePartition({tenantId:KREILE_TENANT_SLUG,userId:full.actorId}),JSON.parse(JSON.stringify(saved!.original))))).toMatchObject({code:'OK',replayed:true,receipt:{eventId:saved.receipt.eventId}});
 expect(await sql`SELECT event_id,net_cents::int FROM private.order_production_snapshots WHERE tenant_id=${KREILE_TENANT_SLUG} AND origin_event_id=${saved.receipt.eventId} AND item_id=${itemId} AND component='pricing'`).toEqual([{event_id:created.receipt.eventId,net_cents:10000}]);
 expect(await sql`SELECT id FROM public.events WHERE tenant_id=${KREILE_TENANT_SLUG} AND client_event_id=${saved.original.input.clientEventId}::uuid`).toHaveLength(1);
 expect(await sql`SELECT status FROM public.tasks WHERE tenant_id=${KREILE_TENANT_SLUG} AND id=${taskId}::uuid`).toEqual([{status:'erledigt'}]);
 expect(await sql`SELECT erledigt_von::text,erstellt_von::text FROM public.tasks WHERE tenant_id=${KREILE_TENANT_SLUG} AND id=${taskId}::uuid`).toEqual([{erledigt_von:decider.actorId,erstellt_von:full.actorId}]);
});

it('retains the existing online source guard and amount without granting the offline supplement exception',async()=>{
 const {created,orderId,itemId,version}=await setup('Online kein Offline-Guard');
 const saved=await withSession(full,()=>setOrderItemFinishedAction({orderId,itemId,expectedVersion:version,clientEventId:randomUUID(),finished:true}));
 if(saved.code!=='OK')throw Error('TEST_ONLINE_FINISH');
 await expect(sql`INSERT INTO private.order_production_snapshots SELECT (jsonb_populate_record(NULL::private.order_production_snapshots,to_jsonb(snapshot)||jsonb_build_object('event_id',${created.receipt.eventId}::text,'component','pricing','origin_event_id',snapshot.event_id,'occurred_at',(SELECT created_at FROM public.events WHERE id=${created.receipt.eventId})))) .*
 FROM private.order_production_snapshots snapshot WHERE snapshot.event_id=${saved.receipt.eventId} AND snapshot.item_id=${itemId}`).rejects.toMatchObject({code:'P0001'});
 expect(await sql`SELECT net_cents::int FROM private.order_production_snapshots WHERE event_id=${saved.receipt.eventId} AND item_id=${itemId}`).toEqual([{net_cents:10000}]);
});

it('retains an unvalued physical completion and a real clarification task for a price receipt without cents',async()=>{
 const {createOrderIntakeAction}=await import('@/app/actions/eingang.actions');
 const customerId=await customerFixture('TEST CB17 unbelegt'),created=await withSession(full,()=>createOrderIntakeAction({geprueft:true,clientEventId:randomUUID(),customer:{mode:'EXISTING',customerId},dueDate:'2027-05-15',termStatus:'bestaetigt',intakeSource:'persoenlich',handoverMode:'pickup',paymentMode:'rechnung',note:'TEST CB17 unbewertet',items:[{catalogServiceId:null,name:'TEST CB17 ohne Cent',quantity:1,material:'Messing',surfaceRequested:'Verchromen',executionRequested:'offen',unit:'Stück',unitPriceCents:null,vatRateBasisPoints:null}]}));
 expect(created.code).toBe('OK');if(created.code!=='OK')throw Error('TEST_UNPRICED_INTAKE');
 const orderId=created.receipt.orderId,itemId=created.receipt.items[0].id;
 const moved=await withSession(full,()=>transitionWareneingangToGalvanikAction({orderId,expectedVersion:1,clientEventId:randomUUID()}));
 expect(moved.code).toBe('OK');if(moved.code!=='OK')throw Error('TEST_UNPRICED_MOVE');
 const saved=await finish(orderId,itemId,moved.receipt.aggregateVersion,new Date(Date.now()-8*86400000).toISOString());
 expect(await sql`SELECT current_station_id FROM public.items WHERE tenant_id=${KREILE_TENANT_SLUG} AND id=${itemId}`).toEqual([{current_station_id:'fertig'}]);
 expect(await sql`SELECT net_cents FROM private.order_production_snapshots WHERE tenant_id=${KREILE_TENANT_SLUG} AND order_id=${orderId} AND item_id=${itemId} AND component='base'`).toEqual([{net_cents:null}]);
 const tasks=await sql`SELECT id,titel,status FROM public.tasks WHERE tenant_id=${KREILE_TENANT_SLUG} AND bezug_id=${orderId}`;
 expect(tasks).toHaveLength(1);expect(tasks[0]).toMatchObject({status:'offen'});
 const taskId=String(tasks[0].id),before=await withSession(full,()=>getIntakeTaskAction({taskId}));
 expect(before).toMatchObject({code:'OK',pricingSource:'KNOWN',completeLabel:'Nachtrag erneut auslösen'});
 const priced=await withSession(full,()=>changeOrderContentAction({orderId,expectedVersion:saved.receipt.aggregateVersion,clientEventId:randomUUID(),note:'TEST echte spaetere Bepreisung',items:[{id:itemId,catalogServiceId:null,name:'TEST CB17 ohne Cent',quantity:1,material:'Messing',surface:'Verchromen',unit:'Stück',unitPriceCents:10000,vatRateBasisPoints:1900}]}));
 expect(priced.code).toBe('OK');
 const read=await withSession(full,()=>getIntakeTaskAction({taskId}));if(read.code!=='OK'||!read.task)throw Error('TEST_UNPRICED_TASK_READ');
 const retry={taskId,version:read.task.version,note:null};
 expect(await withSession(full,()=>completeIntakeTaskAction(retry))).toMatchObject({code:'OK'});
 expect(await withSession(full,()=>completeIntakeTaskAction(JSON.parse(JSON.stringify(retry))))).toMatchObject({code:'OK',replayed:true});

});

it('keeps the real physical edge and a strict basis-phase task when base pricing fails before its snapshot',async()=>{
 const decider=await createFixture(['entscheiden']);
 const {orderId,itemId,version}=await setup('CB17 Basis-Savepoint');
 const fault='test_base_price_'+randomUUID().replaceAll('-','');
 await sql.unsafe(`CREATE FUNCTION private.${fault}() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.tenant_id='${KREILE_TENANT_SLUG}' AND NEW.order_id='${orderId}' AND NEW.component='base' THEN RAISE EXCEPTION 'TEST_BASE_PRICE_FAILURE'; END IF; RETURN NEW; END $$`);
 await sql.unsafe(`CREATE TRIGGER ${fault} BEFORE INSERT ON private.order_production_snapshots FOR EACH ROW EXECUTE FUNCTION private.${fault}()`);
 let original:Awaited<ReturnType<typeof finish>>|undefined,taskId:string|undefined;
 try{
  original=await finish(orderId,itemId,version,new Date(Date.now()-8*86400000).toISOString());
  expect(await sql`SELECT current_station_id FROM public.items WHERE tenant_id=${KREILE_TENANT_SLUG} AND id=${itemId}`).toEqual([{current_station_id:'fertig'}]);
  expect(await sql`SELECT event_id FROM private.order_production_snapshots WHERE tenant_id=${KREILE_TENANT_SLUG} AND event_id=${original.receipt.eventId}`).toHaveLength(0);
  const markers=await sql`SELECT id,payload,user_id::text FROM public.events WHERE tenant_id=${KREILE_TENANT_SLUG} AND event_type='ORDER_PRODUCTION_PRICING_RETRY_REQUIRED_V1' AND order_id=${orderId}`;
  expect(markers).toHaveLength(1);expect(markers[0]).toMatchObject({user_id:full.actorId,payload:{phase:'basis',productionEventId:original.receipt.eventId,itemId}});
  expect(markers[0].payload).not.toHaveProperty('pricingEventId');
  const forged=randomUUID();await expect(sql`INSERT INTO public.events(id,tenant_id,order_id,item_id,event_type,description,payload,status,user_id,client_event_id,event_schema_version) VALUES(${forged},${KREILE_TENANT_SLUG},${orderId},${itemId},'ORDER_PRODUCTION_PRICING_RETRY_REQUIRED_V1','TEST synthetic invalid actor proof',${JSON.stringify(markers[0].payload)}::jsonb,'success',${decider.actorId}::uuid,${forged}::uuid,1)`).rejects.toMatchObject({code:'P0001'});
  const [task]=await sql`SELECT id::text,version,fuer_bereich FROM public.tasks WHERE tenant_id=${KREILE_TENANT_SLUG} AND client_key=${markers[0].id}::uuid`;expect(task.fuer_bereich).toBe('entscheiden');taskId=task.id;
  expect(await withSession(decider,()=>getIntakeTaskAction({taskId:task.id}))).toMatchObject({code:'OK',pricingSource:'KNOWN',canComplete:true});
  expect(await withSession(decider,()=>completeIntakeTaskAction({taskId:task.id,version:task.version,note:null}))).toMatchObject({code:'UNAVAILABLE'});
  expect(await sql`SELECT status FROM public.tasks WHERE tenant_id=${KREILE_TENANT_SLUG} AND id=${task.id}::uuid`).toEqual([{status:'offen'}]);
 }finally{await sql.unsafe(`DROP TRIGGER IF EXISTS ${fault} ON private.order_production_snapshots`);await sql.unsafe(`DROP FUNCTION IF EXISTS private.${fault}()`);}
 if(!original||!taskId)throw Error('TEST_BASE_FOLLOWUP_MISSING');
 const read=await withSession(decider,()=>getIntakeTaskAction({taskId}));if(read.code!=='OK'||!read.task)throw Error('TEST_BASE_TASK_READ');
 const input={taskId,version:read.task.version,note:null};
 expect(await withSession(decider,()=>completeIntakeTaskAction(input))).toMatchObject({code:'OK'});
 expect(await withSession(decider,()=>completeIntakeTaskAction(JSON.parse(JSON.stringify(input))))).toMatchObject({code:'OK',replayed:true});
 expect(await withSession(full,()=>replayOfflineWorkshopAction(offlinePartition({tenantId:KREILE_TENANT_SLUG,userId:full.actorId}),JSON.parse(JSON.stringify(original!.original))))).toMatchObject({code:'OK',replayed:true});
 expect(await sql`SELECT net_cents::int FROM private.order_production_snapshots WHERE tenant_id=${KREILE_TENANT_SLUG} AND origin_event_id=${original.receipt.eventId} AND component='pricing'`).toEqual([{net_cents:10000}]);
 expect(await sql`SELECT id FROM public.tasks WHERE tenant_id=${KREILE_TENANT_SLUG} AND bezug_id=${orderId}`).toHaveLength(1);
});
