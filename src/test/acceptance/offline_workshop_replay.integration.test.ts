// @vitest-environment node
import {it,expect,vi} from 'vitest';
import {randomUUID} from 'node:crypto';
const tenant=vi.hoisted(()=>'TEST-ablauf-'+globalThis.crypto.randomUUID());
vi.mock('@/lib/tenant',()=>({KREILE_TENANT_SLUG:tenant}));
import {KREILE_TENANT_SLUG} from '@/lib/tenant';
import {sql,full,withSession,createFixture} from '../../../e2e/ablauf/replayHarness';
import {customerFixture,intakeOrderFixture} from '../../../e2e/ablauf/orderFixture';
import {transitionWareneingangToGalvanikAction,getLiveOrderCardAction,configureExtraWorkCatalogPositionAction,setOrderItemFinishedAction,changeOrderItemExtraWorkAction,getExtraWorkMasterDataAction,setExtraWorkHourlyRateAction} from '@/app/actions/orders.actions';
import {replayOfflineWorkshopAction} from '@/app/actions/offlineWorkshop.actions';
import {offlinePartition} from '@/lib/server/offlinePartition';
import type {PendingWorkshopOriginal} from '@/lib/offline/pendingStore';
if(!process.env.DATABASE_URL||process.env.DATABASE_URL!==process.env.H18_EXPECTED_DATABASE_URL||!['127.0.0.1','localhost'].includes(new URL(process.env.DATABASE_URL).hostname)||new URL(process.env.DATABASE_URL).pathname!=='/postgres'||!tenant.startsWith('TEST-'))throw Error('TEST_OWN_LOOPBACK_REQUIRED');

it('preserves a real rejected workshop command and one normal task atomically, then rereads the same original on fresh retry',async()=>{
 const customerId=await customerFixture('Offline Werkstatt'),created=await intakeOrderFixture('Offline Werkstatt',customerId),orderId=created.receipt.orderId,itemId=created.receipt.items[0].id;
 const moved=await withSession(full,()=>transitionWareneingangToGalvanikAction({orderId,expectedVersion:1,clientEventId:randomUUID()}));if(moved.code!=='OK')throw Error('TEST_MOVE');
 const key=randomUUID(),scope=offlinePartition({tenantId:KREILE_TENANT_SLUG,userId:full.actorId});
 const original:PendingWorkshopOriginal={kind:'workshop',id:key,itemId:orderId,command:'item.finished',deviceCapturedAt:'2026-11-11T05:00:00Z',input:{orderId,itemId,expectedVersion:1,clientEventId:key,finished:true}};
 // Actual SQL suppression proves that both the original and the task roll back.
 await sql.unsafe(`CREATE OR REPLACE FUNCTION public.test_offline_workshop_link_abort() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.tenant_id='${KREILE_TENANT_SLUG}' AND NEW.event_type='OFFLINE_WORKSHOP_REJECTED_TASK_V1' THEN RETURN NULL; END IF; RETURN NEW; END $$`);
 await sql.unsafe('CREATE TRIGGER test_offline_workshop_link_abort BEFORE INSERT ON public.events FOR EACH ROW EXECUTE FUNCTION public.test_offline_workshop_link_abort()');
 try{
  expect(await withSession(full,()=>replayOfflineWorkshopAction(scope,original))).toMatchObject({code:'UNAVAILABLE'});
  expect(await sql`SELECT count(*)::int AS n FROM public.events WHERE tenant_id=${KREILE_TENANT_SLUG} AND event_type='OFFLINE_WORKSHOP_REJECTED_V1'`).toEqual([{n:0}]);
  expect(await sql`SELECT count(*)::int AS n FROM public.tasks WHERE tenant_id=${KREILE_TENANT_SLUG} AND titel='Konflikt beim Abgleich'`).toEqual([{n:0}]);
 }finally{await sql.unsafe('DROP TRIGGER test_offline_workshop_link_abort ON public.events');await sql.unsafe('DROP FUNCTION public.test_offline_workshop_link_abort()');}
 const saved=await withSession(full,()=>replayOfflineWorkshopAction(scope,JSON.parse(JSON.stringify(original))));
 expect(saved).toMatchObject({code:'PRESERVED',replayed:false});if(saved.code!=='PRESERVED')throw Error('TEST_NOT_PRESERVED');
 const rows=await sql`SELECT event.user_id::text,event.payload,task.id::text AS task_id,task.erstellt_von::text,task.fuer_bereich FROM public.events event JOIN public.tasks task ON task.tenant_id=event.tenant_id AND task.id=${saved.taskId}::uuid WHERE event.tenant_id=${KREILE_TENANT_SLUG} AND event.id=${saved.eventId}`;
 expect(rows).toMatchObject([{user_id:full.actorId,erstellt_von:full.actorId,payload:{quelle:'offline_abgleich',original:{command:'item.finished',input:original.input,deviceCapturedAt:original.deviceCapturedAt},rejection:'CONFLICT'}}]);
 expect(rows[0].fuer_bereich).toBe('geld');
 expect(await withSession(full,()=>replayOfflineWorkshopAction(scope,JSON.parse(JSON.stringify(original))))).toEqual({...saved,replayed:true});
 expect(await withSession(full,()=>replayOfflineWorkshopAction(scope,{...original,input:{...original.input,finished:false}}))).toMatchObject({code:'UNAVAILABLE'});
 const foreign=await createFixture(['auftraege'],'werkstatt');expect(await withSession(foreign,()=>replayOfflineWorkshopAction(scope,original))).toEqual({code:'FORBIDDEN'});
 expect(await withSession(full,()=>getLiveOrderCardAction({orderId}))).toMatchObject({code:'OK',data:{card:{version:moved.receipt.aggregateVersion,items:[expect.objectContaining({id:itemId,finished:false})]}}});
 expect(await sql`SELECT count(*)::int AS n FROM public.tasks WHERE tenant_id=${KREILE_TENANT_SLUG} AND titel='Konflikt beim Abgleich'`).toEqual([{n:1}]);
 await expect(sql`UPDATE public.events SET payload='{}'::jsonb WHERE tenant_id=${KREILE_TENANT_SLUG} AND id=${saved.eventId}`).rejects.toMatchObject({code:'P0001',message:expect.stringContaining('GoBD: Audit-Log ist append-only')});
 await expect(sql`DELETE FROM public.events WHERE tenant_id=${KREILE_TENANT_SLUG} AND id=${saved.eventId}`).rejects.toMatchObject({code:'P0001',message:expect.stringContaining('GoBD: Audit-Log ist append-only')});
});

it('keeps the original actor after rights are revoked and selects active entscheiden, otherwise geld',async()=>{
 const customerId=await customerFixture('Offline Rechte'),created=await intakeOrderFixture('Offline Rechte',customerId),orderId=created.receipt.orderId,itemId=created.receipt.items[0].id;
 const operator=await createFixture(['auftraege','kunden'],'werkstatt'),decider=await createFixture(['entscheiden'],'meister');
 const scope=offlinePartition({tenantId:KREILE_TENANT_SLUG,userId:operator.actorId});
 const key=randomUUID(),original:PendingWorkshopOriginal={kind:'workshop',id:key,itemId:orderId,command:'item.finished',deviceCapturedAt:'2026-11-11T05:00:00Z',input:{orderId,itemId,expectedVersion:1,clientEventId:key,finished:true}};
 // Only the TEST actor's real current right changes; no auth or RLS double.
 await sql`DELETE FROM public.app_user_rights WHERE tenant_id=${KREILE_TENANT_SLUG} AND user_id=${operator.actorId}::uuid AND bereich='auftraege'`;
 const first=await withSession(operator,()=>replayOfflineWorkshopAction(scope,original));expect(first).toMatchObject({code:'PRESERVED'});if(first.code!=='PRESERVED')throw Error('TEST_REVOKED_NOT_PRESERVED');
 expect(await sql`SELECT erstellt_von::text,fuer_bereich FROM public.tasks WHERE tenant_id=${KREILE_TENANT_SLUG} AND id=${first.taskId}::uuid`).toEqual([{erstellt_von:operator.actorId,fuer_bereich:'entscheiden'}]);
 expect(await withSession(operator,()=>replayOfflineWorkshopAction(scope,JSON.parse(JSON.stringify(original))))).toEqual({...first,replayed:true});
 await sql`UPDATE public.app_users SET active=false WHERE tenant_id=${KREILE_TENANT_SLUG} AND id=${decider.actorId}::uuid`;
 const secondKey=randomUUID(),second=await withSession(operator,()=>replayOfflineWorkshopAction(scope,{...original,id:secondKey,input:{...original.input,clientEventId:secondKey}}));
 expect(second).toMatchObject({code:'PRESERVED'});if(second.code!=='PRESERVED')throw Error('TEST_FALLBACK_NOT_PRESERVED');
 expect(await sql`SELECT erstellt_von::text,fuer_bereich FROM public.tasks WHERE tenant_id=${KREILE_TENANT_SLUG} AND id=${second.taskId}::uuid`).toEqual([{erstellt_von:operator.actorId,fuer_bereich:'geld'}]);
 expect(await withSession(full,()=>getLiveOrderCardAction({orderId}))).toMatchObject({code:'OK',data:{card:{version:1,items:[expect.objectContaining({id:itemId,finished:false})]}}});
});

it('PL09:00 binds successful extra-work and completion originals to their existing immutable receipts without changing server time',async()=>{
 const customerId=await customerFixture('Offline Originalzeit'),created=await intakeOrderFixture('Offline Originalzeit',customerId),orderId=created.receipt.orderId,itemId=created.receipt.items[0].id;
 const moved=await withSession(full,()=>transitionWareneingangToGalvanikAction({orderId,expectedVersion:1,clientEventId:randomUUID()}));if(moved.code!=='OK')throw Error('TEST_MOVE');
 const scope=offlinePartition({tenantId:KREILE_TENANT_SLUG,userId:full.actorId}),catalogPositionId=randomUUID(),deviceCapturedAt=new Date(Date.now()-300000).toISOString();
 expect(await withSession(full,()=>configureExtraWorkCatalogPositionAction({positionId:catalogPositionId,expectedVersion:0,name:'TEST Offline Mehrarbeit',standardMinutes:25,active:true,clientEventId:randomUUID()}))).toMatchObject({code:'OK'});
 const master=await withSession(full,()=>getExtraWorkMasterDataAction());if(master.code!=='OK')throw Error('TEST_RATE_READ');
 // Explicit TEST configuration through its actual writer, not a product fallback.
 if(!master.data.currentRate)expect(await withSession(full,()=>setExtraWorkHourlyRateAction({rateId:randomUUID(),expectedVersion:0,hourlyRateCents:14000,clientEventId:randomUUID()}))).toMatchObject({code:'OK'});
 const lineId=randomUUID(),legacy={lineId,orderId,itemId,catalogPositionId,minutes:15,active:true,expectedLineVersion:0,expectedOrderVersion:moved.receipt.aggregateVersion,clientEventId:randomUUID()};
 const legacySaved=await withSession(full,()=>changeOrderItemExtraWorkAction(legacy));expect(legacySaved.code).toBe('OK');if(legacySaved.code!=='OK')throw Error('TEST_LEGACY_EXTRA');
 expect(await withSession(full,()=>changeOrderItemExtraWorkAction(JSON.parse(JSON.stringify(legacy))))).toMatchObject({code:'OK',replayed:true});
 const extraKey=randomUUID(),extra:PendingWorkshopOriginal={kind:'workshop',id:extraKey,itemId:orderId,command:'item.extraWork',deviceCapturedAt,input:{lineId,orderId,itemId,catalogPositionId,minutes:25,active:true,expectedLineVersion:1,expectedOrderVersion:legacySaved.receipt.aggregateVersion,clientEventId:extraKey}};
 const savedExtra=await withSession(full,()=>replayOfflineWorkshopAction(scope,extra));expect(savedExtra).toMatchObject({code:'OK'});if(savedExtra.code!=='OK')throw Error('TEST_EXTRA_ORIGINAL');
 expect(await withSession(full,()=>replayOfflineWorkshopAction(scope,JSON.parse(JSON.stringify(extra))))).toMatchObject({code:'OK',replayed:true,receipt:{eventId:savedExtra.receipt.eventId}});
 const metadata={deviceCapturedAt,actorId:full.actorId,clientEventId:extraKey};
 expect(await withSession(full,()=>changeOrderItemExtraWorkAction({...extra.input,offlineOriginal:{...metadata,deviceCapturedAt:new Date(Date.now()-600000).toISOString()}}))).toMatchObject({code:'CONFLICT'});
 const key=randomUUID(),finished:PendingWorkshopOriginal={kind:'workshop',id:key,itemId:orderId,command:'item.finished',deviceCapturedAt,input:{orderId,itemId,expectedVersion:savedExtra.receipt.aggregateVersion,clientEventId:key,finished:true}};
 const saved=await withSession(full,()=>replayOfflineWorkshopAction(scope,finished));expect(saved).toMatchObject({code:'OK'});if(saved.code!=='OK')throw Error('TEST_FINISHED_ORIGINAL');
 expect(await withSession(full,()=>replayOfflineWorkshopAction(scope,JSON.parse(JSON.stringify(finished))))).toMatchObject({code:'OK',replayed:true,receipt:{eventId:saved.receipt.eventId}});
 expect(await withSession(full,()=>setOrderItemFinishedAction({...finished.input,offlineOriginal:{deviceCapturedAt,actorId:randomUUID(),clientEventId:key}}))).toMatchObject({code:'CONFLICT'});
 for(const [id,clientEventId] of [[savedExtra.receipt.eventId,extraKey],[saved.receipt.eventId,key]]){
  const [event]=await sql`SELECT payload,user_id::text,(extract(epoch FROM created_at AT TIME ZONE 'UTC')*1000)::double precision AS server_millis FROM public.events WHERE tenant_id=${KREILE_TENANT_SLUG} AND id=${id}`;
  expect(event).toMatchObject({user_id:full.actorId,payload:{offlineOriginal:{deviceCapturedAt,actorId:full.actorId,clientEventId}}});
  // events stores UTC timestamp without zone; compare the database's explicit
  // UTC instant rather than asking the host-local Date parser to infer a zone.
  expect(event.server_millis).toBeGreaterThan(Date.parse(deviceCapturedAt));
 }
 const [source]=await sql`SELECT payload FROM public.events WHERE tenant_id=${KREILE_TENANT_SLUG} AND id=${savedExtra.receipt.eventId}`;
 for(const kind of ['extra_core','actor','key','time','extra_metadata']){
  const newId=randomUUID(),newKey=randomUUID();
  const proof={...source.payload.offlineOriginal,clientEventId:newKey,...(kind==='actor'?{actorId:randomUUID()}:kind==='key'?{clientEventId:randomUUID()}:kind==='time'?{deviceCapturedAt:'2026-99-99T05:00:00Z'}:kind==='extra_metadata'?{roles:['TEST unapproved authority']}:{})};
  const payload={...source.payload,offlineOriginal:proof,...(kind==='extra_core'?{unexpected:'TEST forbidden payload key'}:{})};
  await expect(sql`INSERT INTO public.events SELECT (jsonb_populate_record(NULL::public.events,to_jsonb(event)||jsonb_build_object('id',${newId}::text,'client_event_id',${newKey}::text,'correlation_id',${randomUUID()}::text,'payload',${sql.json(payload)}::jsonb))).*
   FROM public.events event WHERE tenant_id=${KREILE_TENANT_SLUG} AND id=${savedExtra.receipt.eventId}`,kind).rejects.toMatchObject({code:'23514',constraint_name:kind==='extra_core'?'events_order_item_extra_work_set_v1_contract_chk':'events_offline_original_v1_contract_chk'});
 }
 expect(await withSession(full,()=>getLiveOrderCardAction({orderId}))).toMatchObject({code:'OK',data:{nextActionRule:{code:'SOURCE_INCOMPLETE',source:{kind:'order',id:orderId,version:saved.receipt.aggregateVersion}},card:{version:saved.receipt.aggregateVersion,items:[expect.objectContaining({id:itemId,finished:true,extraWork:[expect.objectContaining({minutes:25})]})]}}});
});
