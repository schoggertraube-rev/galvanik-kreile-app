// @vitest-environment node
import {it,expect,vi} from 'vitest';
import {randomUUID} from 'node:crypto';
const tenant=vi.hoisted(()=>'TEST-ablauf-'+globalThis.crypto.randomUUID());
vi.mock('@/lib/tenant',()=>({KREILE_TENANT_SLUG:tenant}));
import {KREILE_TENANT_SLUG} from '@/lib/tenant';
import {sql,full,withSession,createFixture} from '../../../e2e/ablauf/replayHarness';
import {customerFixture,intakeOrderFixture} from '../../../e2e/ablauf/orderFixture';
import {transitionWareneingangToGalvanikAction,getLiveOrderCardAction} from '@/app/actions/orders.actions';
import {replayOfflineWorkshopAction} from '@/app/actions/offlineWorkshop.actions';
import {offlinePartition} from '@/lib/server/offlinePartition';
import type {PendingWorkshopOriginal} from '@/lib/offline/pendingStore';
if(!process.env.DATABASE_URL||process.env.DATABASE_URL!==process.env.H18_EXPECTED_DATABASE_URL||new URL(process.env.DATABASE_URL).hostname!=='127.0.0.1'||new URL(process.env.DATABASE_URL).port!=='54342')throw Error('TEST_OWN_LOOPBACK_REQUIRED');

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
