// @vitest-environment node
// Explicitly synthetic immutable TEST timestamp, real DB and the actual fixture reader.
// This proves test-source interpretation, not a reminder product writer.
import {randomUUID} from 'node:crypto';
import {expect,it,vi} from 'vitest';
const tenant=vi.hoisted(()=>'TEST-ablauf-'+globalThis.crypto.randomUUID());
vi.mock('@/lib/tenant',()=>({KREILE_TENANT_SLUG:tenant}));
import {KREILE_TENANT_SLUG} from '@/lib/tenant';
import {full,sql} from '../../../e2e/ablauf/replayHarness';
import {readHistoricalDispatchClock} from '../../../e2e/ablauf/historicalDispatchFixture';

it('reads an actual stored UTC reminder timestamp in its Berlin calendar day regardless of local timestamp parsing',async()=>{
 const key=randomUUID(),eventId=randomUUID(),previousZone=process.env.TZ;
 await sql`INSERT INTO public.events(id,tenant_id,event_type,description,payload,status,user_id,client_event_id,correlation_id,event_schema_version,created_at)
 VALUES(${eventId},${KREILE_TENANT_SLUG},'ORDER_COLLECTION_REMINDER_SENT_V1','TEST synthetic UTC fixture boundary','{}'::jsonb,'success',${full.actorId}::uuid,${randomUUID()}::uuid,${key}::uuid,1,'2026-11-16 23:30:00'::timestamp)`;
 const original=await sql`SELECT created_at::text AS raw FROM public.events WHERE tenant_id=${KREILE_TENANT_SLUG} AND id=${eventId}`;
 try{
  process.env.TZ='Europe/Berlin';
  const clock=await readHistoricalDispatchClock(sql,KREILE_TENANT_SLUG,full.actorId);
  expect(await clock.readSentFollowup(key,0)).toEqual({due:'2026-11-17',state:'DUE'});
  expect(await sql`SELECT created_at::text AS raw FROM public.events WHERE tenant_id=${KREILE_TENANT_SLUG} AND id=${eventId}`).toEqual(original);
 }finally{if(previousZone===undefined)delete process.env.TZ;else process.env.TZ=previousZone;}
});
