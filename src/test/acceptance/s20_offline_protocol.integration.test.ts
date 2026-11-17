// @vitest-environment node
// Actual original/rejection/task writers and Actions/Auth/DB. No browser/quarantine proof here.
import {randomUUID} from 'node:crypto';
import {beforeAll,expect,it,vi} from 'vitest';
const tenant=vi.hoisted(()=>'TEST-ablauf-'+globalThis.crypto.randomUUID());
vi.mock('@/lib/tenant',()=>({KREILE_TENANT_SLUG:tenant}));
import {KREILE_TENANT_SLUG} from '@/lib/tenant';
import {sql,full,withSession,createFixture} from '../../../e2e/ablauf/replayHarness';
import {transitionWareneingangToGalvanikAction,getLiveOrderCardAction} from '@/app/actions/orders.actions';
import {customerFixture,intakeOrderFixture} from '../../../e2e/ablauf/orderFixture';
import {replayOfflineWorkshopAction} from '@/app/actions/offlineWorkshop.actions';
import {offlinePartition} from '@/lib/server/offlinePartition';
if(!process.env.DATABASE_URL||process.env.DATABASE_URL!==process.env.H18_EXPECTED_DATABASE_URL||new URL(process.env.DATABASE_URL).hostname!=='127.0.0.1'||!KREILE_TENANT_SLUG.startsWith('TEST-ablauf-'))throw Error('S20_DEDICATED_TEST_REPLAY_REQUIRED');
beforeAll(async()=>{await sql`INSERT INTO public.company_settings(id,tenant_id,company_name) VALUES(${randomUUID()},${KREILE_TENANT_SLUG},'TEST S20 offline protocol')`;});

it('L11 conflict uses the committed original receipt/device time/actor; fresh retry preserves one task and a modified source is never logged as that original',async()=>{
 const customer=await customerFixture('S20 offline'),created=await intakeOrderFixture('S20 offline',customer),operator=await createFixture(['eingang','kunden']);
 const capturedAt=new Date(Date.now()-300000).toISOString(),key=randomUUID();
 const original={kind:'workshop' as const,command:'item.finished' as const,id:key,itemId:created.receipt.orderId,deviceCapturedAt:capturedAt,input:{orderId:created.receipt.orderId,itemId:created.receipt.items[0].id,expectedVersion:1,clientEventId:key,finished:true}};
 const scope=offlinePartition({tenantId:KREILE_TENANT_SLUG,userId:operator.actorId});
 const first=await withSession(operator,()=>replayOfflineWorkshopAction(scope,original));
 expect(first).toMatchObject({code:'PRESERVED',replayed:false,rejectionReceipt:{actorId:operator.actorId,deviceCapturedAt:capturedAt}});
 if(first.code!=='PRESERVED')throw Error('TEST_QUALIFIED_ORIGINAL_REQUIRED');
 const read=await sql`SELECT user_id::text,subject_id,occurred_at FROM public.technical_protocol WHERE tenant_id=${KREILE_TENANT_SLUG} AND event_type='offline_conflict' AND subject_id=${first.eventId}`;
 expect(read).toHaveLength(1);expect(read[0].user_id).toBe(operator.actorId);expect(new Date(read[0].occurred_at).toISOString()).toBe(capturedAt);
 const source=await sql`SELECT payload->'original'->>'deviceCapturedAt' AS device_time,user_id::text FROM public.events WHERE tenant_id=${KREILE_TENANT_SLUG} AND id=${first.eventId}`;
 expect(source).toEqual([{device_time:capturedAt,user_id:operator.actorId}]);
 expect(await withSession(operator,()=>replayOfflineWorkshopAction(scope,JSON.parse(JSON.stringify(original))))).toMatchObject({code:'PRESERVED',eventId:first.eventId,taskId:first.taskId,replayed:true});
 expect(await sql`SELECT id FROM public.tasks WHERE tenant_id=${KREILE_TENANT_SLUG} AND id::text=${first.taskId}`).toHaveLength(1);
 const beforeCorruption=await sql`SELECT id FROM public.technical_protocol WHERE tenant_id=${KREILE_TENANT_SLUG} AND event_type='offline_conflict' AND subject_id=${first.eventId}`;
 expect(await withSession(operator,()=>replayOfflineWorkshopAction(scope,{...original,deviceCapturedAt:new Date().toISOString()}))).toMatchObject({code:'UNAVAILABLE'});
 expect(await sql`SELECT id FROM public.technical_protocol WHERE tenant_id=${KREILE_TENANT_SLUG} AND event_type='offline_conflict' AND subject_id=${first.eventId}`).toEqual(beforeCorruption);
 const errors=await sql`SELECT command FROM public.technical_protocol WHERE tenant_id=${KREILE_TENANT_SLUG} AND event_type='server_error' AND subject_id=${created.receipt.orderId}`;
 expect(errors).toEqual([{command:'OFFLINE_WORKSHOP_RECONCILIATION_FAILED'}]);
});

it('successful reconciliation logs only after the physical writer receipt committed, with original device time; fresh retry keeps one physical effect and a corrupted original is never acknowledged',async()=>{
 const customer=await customerFixture('S20 successful offline'),created=await intakeOrderFixture('S20 successful offline',customer),orderId=created.receipt.orderId;
 const moved=await withSession(full,()=>transitionWareneingangToGalvanikAction({orderId,expectedVersion:1,clientEventId:randomUUID()}));if(moved.code!=='OK')throw Error('TEST_REAL_MOVE_REQUIRED');
 const capturedAt=new Date(Date.now()-300000).toISOString(),key=randomUUID();
 const original={kind:'workshop' as const,command:'item.finished' as const,id:key,itemId:orderId,deviceCapturedAt:capturedAt,input:{orderId,itemId:created.receipt.items[0].id,expectedVersion:moved.receipt.aggregateVersion,clientEventId:key,finished:true}};
 const scope=offlinePartition({tenantId:KREILE_TENANT_SLUG,userId:full.actorId});
 const first=await withSession(full,()=>replayOfflineWorkshopAction(scope,original));
 expect(first).toMatchObject({code:'OK',offlineReceipt:{actorId:full.actorId,deviceCapturedAt:capturedAt}});if(first.code!=='OK')throw Error('TEST_REAL_COMPLETION_REQUIRED');
 const eventId=first.receipt.eventId;
 const stored=await sql`SELECT user_id::text,subject_id,occurred_at FROM public.technical_protocol WHERE tenant_id=${KREILE_TENANT_SLUG} AND event_type='offline_sync' AND subject_id=${eventId}`;
 expect(stored).toHaveLength(1);expect(stored[0].user_id).toBe(full.actorId);expect(new Date(stored[0].occurred_at).toISOString()).toBe(capturedAt);
 expect(await sql`SELECT user_id::text,payload->'offlineOriginal'->>'deviceCapturedAt' AS captured FROM public.events WHERE tenant_id=${KREILE_TENANT_SLUG} AND id=${eventId}`).toEqual([{user_id:full.actorId,captured:capturedAt}]);
 const card=await withSession(full,()=>getLiveOrderCardAction({orderId}));expect(card).toMatchObject({code:'OK'});
 expect(await withSession(full,()=>replayOfflineWorkshopAction(scope,JSON.parse(JSON.stringify(original))))).toMatchObject({code:'OK',replayed:true,receipt:{eventId}});
 expect(await sql`SELECT id FROM public.events WHERE tenant_id=${KREILE_TENANT_SLUG} AND id=${eventId}`).toHaveLength(1);
 const before=await sql`SELECT id FROM public.technical_protocol WHERE tenant_id=${KREILE_TENANT_SLUG} AND event_type='offline_sync' AND subject_id=${eventId}`;
 expect(await withSession(full,()=>replayOfflineWorkshopAction(scope,{...original,deviceCapturedAt:new Date().toISOString()}))).not.toMatchObject({code:'OK'});
 expect(await sql`SELECT id FROM public.technical_protocol WHERE tenant_id=${KREILE_TENANT_SLUG} AND event_type='offline_sync' AND subject_id=${eventId}`).toEqual(before);
});
