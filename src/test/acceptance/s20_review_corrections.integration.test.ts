// @vitest-environment node
// PL19:41 K1-K5: explicitly synthetic facts, real Actions/Auth/DB/business effects.
import {randomUUID,createHash} from 'node:crypto';
import {beforeAll,expect,it,vi} from 'vitest';
const tenant=vi.hoisted(()=>'TEST-ablauf-'+globalThis.crypto.randomUUID());
vi.mock('@/lib/tenant',()=>({KREILE_TENANT_SLUG:tenant}));
import {KREILE_TENANT_SLUG} from '@/lib/tenant';
import {sql,full,withSession,createFixture} from '../../../e2e/ablauf/replayHarness';
import {customerFixture,intakeOrderFixture} from '../../../e2e/ablauf/orderFixture';
import {recordProtocolClicksAction,getProtocolLogAction} from '@/app/actions/logging.actions';
import {setPaymentModeAction} from '@/app/actions/payments.actions';
import {offlinePartition} from '@/lib/server/offlinePartition';
import {resolveAuthorization} from '@/lib/server/authorization';
import {logTechnical,taktJobs as loggingTaktJobs} from '@/modules/logging/server-public';
import {readLoggingSettings} from '@/modules/fundament/server-public';
import type {ClickFact,ClientMissedFact} from '@/modules/logging/public';
if(!process.env.DATABASE_URL||process.env.DATABASE_URL!==process.env.H18_EXPECTED_DATABASE_URL||new URL(process.env.DATABASE_URL).hostname!=='127.0.0.1'||!KREILE_TENANT_SLUG.startsWith('TEST-ablauf-'))throw Error('S20_DEDICATED_TEST_REPLAY_REQUIRED');
beforeAll(async()=>{await sql`INSERT INTO public.company_settings(id,tenant_id,company_name) VALUES(${randomUUID()},${KREILE_TENANT_SLUG},'TEST S20 corrections')`;});
const scope=()=>offlinePartition({tenantId:KREILE_TENANT_SLUG,userId:full.actorId});
const click=(patch:Partial<ClickFact>={}):ClickFact=>({id:randomUUID(),sessionId:randomUUID(),route:'/orders/:id',target:'auftrag.fertig',deviceClass:'desktop',outcome:null,durationMs:null,clickCount:1,occurredAt:new Date().toISOString(),...patch});
async function auth(){const result=await withSession(full,()=>resolveAuthorization());if(!result.ok)throw Error('TEST_REAL_AUTH_REQUIRED');return result.data;}

it('K1 future-clock CHECK rejects only the offending click; following receipts and deserialized retries remain exact',async()=>{
 const bad=click({occurredAt:new Date(Date.now()+600000).toISOString()}),good=click();
 const expected={code:'OK',accepted:[good.id],rejected:[{id:bad.id,code:'VALIDATION_ERROR'}]};
 expect(await withSession(full,()=>recordProtocolClicksAction([bad,good],scope()))).toEqual(expected);
 expect(await withSession(full,()=>recordProtocolClicksAction(JSON.parse(JSON.stringify([bad,good])),scope()))).toEqual(expected);
 expect(await sql`SELECT client_event_id::text FROM public.app_usage_events WHERE tenant_id=${KREILE_TENANT_SLUG} AND client_event_id IN (${bad.id}::uuid,${good.id}::uuid)`).toEqual([{client_event_id:good.id}]);
});

it('K1 client overflow count is stored once; receipt identity includes the immutable count, and a terminal reject cannot block a later fact',async()=>{
 const loss:ClientMissedFact={kind:'missed',id:randomUUID(),count:100,occurredAt:new Date().toISOString()},clear={kind:'error',id:randomUUID(),command:'ACTION_REQUEST_FAILED',occurredAt:new Date().toISOString()};
 await withSession(full,()=>recordProtocolClicksAction([clear],scope()));
 const expected={code:'OK',accepted:[loss.id],rejected:[]};
 expect(await withSession(full,()=>recordProtocolClicksAction([loss],scope()))).toEqual(expected);
 expect(await withSession(full,()=>recordProtocolClicksAction(JSON.parse(JSON.stringify([loss])),scope()))).toEqual(expected);
 const before=await sql`SELECT * FROM public.technical_protocol WHERE tenant_id=${KREILE_TENANT_SLUG} AND id=${loss.id}::uuid`;
 expect(before).toHaveLength(1);expect(before[0]).toMatchObject({verpasst:100,user_id:full.actorId,command:'PROTOCOL_CLIENT_ENTRIES_MISSED'});
 const next={...clear,id:randomUUID()};
 expect(await withSession(full,()=>recordProtocolClicksAction([{...loss,count:101},next],scope()))).toEqual({code:'OK',accepted:[next.id],rejected:[{id:loss.id,code:'CONFLICT'}]});
 expect(await sql`SELECT * FROM public.technical_protocol WHERE tenant_id=${KREILE_TENANT_SLUG} AND id=${loss.id}::uuid`).toEqual(before);
});

it('K2 technical rows reject UPDATE and ordinary DELETE, and the transaction-local retention capability cannot leak',async()=>{
 const id=randomUUID(),authorization=await auth();
 expect(await logTechnical(authorization,{type:'server_error',command:'testImmutable',subject:{type:'action',id},reason:'UNKNOWN'},id)).toBe(true);
 await expect(sql`UPDATE public.technical_protocol SET command='changed' WHERE tenant_id=${KREILE_TENANT_SLUG} AND id=${id}::uuid`).rejects.toMatchObject({code:'23514'});
 await expect(sql`DELETE FROM public.technical_protocol WHERE tenant_id=${KREILE_TENANT_SLUG} AND id=${id}::uuid`).rejects.toMatchObject({code:'23514'});
 await sql.begin(async tx=>{await tx`SET LOCAL app.protocol_retention='on'`;await tx`DELETE FROM public.technical_protocol WHERE tenant_id=${KREILE_TENANT_SLUG} AND id=${id}::uuid`;});
 expect(await sql`SELECT id FROM public.technical_protocol WHERE tenant_id=${KREILE_TENANT_SLUG} AND id=${id}::uuid`).toHaveLength(0);
 const next=randomUUID();expect(await logTechnical(authorization,{type:'server_error',command:'testImmutable',subject:{type:'action',id:next},reason:'UNKNOWN'},next)).toBe(true);
 await expect(sql`DELETE FROM public.technical_protocol WHERE tenant_id=${KREILE_TENANT_SLUG} AND id=${next}::uuid`).rejects.toMatchObject({code:'23514'});
});

it('K3 retention removes old S20 actions only; K5 equal-threshold is not a hang, strictly greater is',async()=>{
 const oldAction=randomUUID(),oldView=randomUUID(),equal=click({durationMs:3000}),greater=click({durationMs:3001});
 for(const [id,type] of [[oldAction,'action'],[oldView,'page_view']])await sql`INSERT INTO public.app_usage_events(tenant_id,client_event_id,actor_pseudonym,actor_role,session_id,event_type,route,device_class,occurred_at,received_at)
 VALUES(${KREILE_TENANT_SLUG},${id}::uuid,${createHash('sha256').update(full.actorId).digest('hex')},'meister',${randomUUID()}::uuid,${type},'/orders','desktop',now()-interval '31 days',now()-interval '31 days')`;
 expect(await withSession(full,()=>recordProtocolClicksAction([equal,greater],scope()))).toMatchObject({code:'OK',accepted:[equal.id,greater.id]});
 await sql`UPDATE public.company_settings SET protokoll_aufbewahrung_tage=30 WHERE tenant_id=${KREILE_TENANT_SLUG}`;
 try{
  const reader=await createFixture(['protokoll']),read=await withSession(reader,()=>getProtocolLogAction({userId:full.actorId}));
  if(read.code!=='OK'||!read.clicks)throw Error('TEST_ACTUAL_PROTOCOL_READ_REQUIRED');
  expect(read.clicks.find(row=>row.id===equal.id)?.hang).toBe(false);expect(read.clicks.find(row=>row.id===greater.id)?.hang).toBe(true);
  expect(await sql`SELECT client_event_id::text FROM public.app_usage_events WHERE tenant_id=${KREILE_TENANT_SLUG} AND client_event_id=${oldAction}::uuid`).toHaveLength(1);
  await loggingTaktJobs[0].ausfuehren(KREILE_TENANT_SLUG,new AbortController().signal,{protokollAufbewahrungTage:async()=>{const setting=await readLoggingSettings({tenantId:KREILE_TENANT_SLUG});if(!setting)throw Error('TEST_LOG_SETTINGS_REQUIRED');return setting.retentionDays;}});
  expect(await sql`SELECT client_event_id::text FROM public.app_usage_events WHERE tenant_id=${KREILE_TENANT_SLUG} AND client_event_id IN (${oldAction}::uuid,${oldView}::uuid)`).toEqual([{client_event_id:oldView}]);
 }finally{await sql`UPDATE public.company_settings SET protokoll_aufbewahrung_tage=NULL WHERE tenant_id=${KREILE_TENANT_SLUG}`;}
});

it('K4 actual 3s logging stall times out at 2s while the real payment-mode effect and retry stay intact; missed count follows',async()=>{
 const order=await intakeOrderFixture('S20 timeout',await customerFixture('S20 timeout')),orderId=order.receipt.orderId;
 const [{payment_mode_version:version}]=await sql`SELECT payment_mode_version FROM public.orders WHERE tenant_id=${KREILE_TENANT_SLUG} AND id=${orderId}`;
 const input={orderId,paymentMode:'abholung' as const,expectedVersion:version,clientEventId:randomUUID()},fault='test_s20_timeout_'+randomUUID().replaceAll('-','');
 await sql.unsafe(`CREATE FUNCTION private.${fault}() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.tenant_id='${KREILE_TENANT_SLUG}' THEN PERFORM pg_sleep(3); END IF; RETURN NEW; END $$`);
 await sql.unsafe(`CREATE TRIGGER ${fault} BEFORE INSERT ON public.technical_protocol FOR EACH ROW EXECUTE FUNCTION private.${fault}()`);
 await sql`UPDATE public.company_settings SET protokoll_langsam_ms=1 WHERE tenant_id=${KREILE_TENANT_SLUG}`;
 try{
  const start=performance.now();expect(await withSession(full,()=>setPaymentModeAction(input))).toMatchObject({code:'OK',receipt:{paymentMode:'abholung'}});
  expect(performance.now()-start).toBeLessThan(3000);
  expect(await sql`SELECT payment_mode FROM public.orders WHERE tenant_id=${KREILE_TENANT_SLUG} AND id=${orderId}`).toEqual([{payment_mode:'abholung'}]);
  expect(await sql`SELECT id FROM public.technical_protocol WHERE tenant_id=${KREILE_TENANT_SLUG} AND subject_id=${orderId}`).toHaveLength(0);
 }finally{await sql.unsafe(`DROP TRIGGER ${fault} ON public.technical_protocol`);await sql.unsafe(`DROP FUNCTION private.${fault}()`);await sql`UPDATE public.company_settings SET protokoll_langsam_ms=1000 WHERE tenant_id=${KREILE_TENANT_SLUG}`;}
 expect(await withSession(full,()=>setPaymentModeAction(JSON.parse(JSON.stringify(input))))).toMatchObject({code:'OK',replayed:true});
 const id=randomUUID();expect(await logTechnical(await auth(),{type:'server_error',command:'testAfterTimeout',subject:{type:'action',id},reason:'UNKNOWN'},id)).toBe(true);
 expect((await sql`SELECT verpasst FROM public.technical_protocol WHERE tenant_id=${KREILE_TENANT_SLUG} AND id=${id}::uuid`)[0].verpasst).toBeGreaterThanOrEqual(1);
});

it('K4 one real click timeout is retriable, does not block its following click, and records exactly one missing attempt',async()=>{
 const delayed=click(),following=click(),fault='test_s20_click_timeout_'+randomUUID().replaceAll('-','');
 const clear={kind:'error',id:randomUUID(),command:'ACTION_REQUEST_FAILED',occurredAt:new Date().toISOString()};await withSession(full,()=>recordProtocolClicksAction([clear],scope()));
 await sql.unsafe(`CREATE FUNCTION private.${fault}() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.tenant_id='${KREILE_TENANT_SLUG}' AND NEW.client_event_id='${delayed.id}'::uuid THEN PERFORM pg_sleep(3); END IF; RETURN NEW; END $$`);
 await sql.unsafe(`CREATE TRIGGER ${fault} BEFORE INSERT ON public.app_usage_events FOR EACH ROW EXECUTE FUNCTION private.${fault}()`);
 try{expect(await withSession(full,()=>recordProtocolClicksAction([delayed,following],scope()))).toEqual({code:'UNAVAILABLE',accepted:[following.id],rejected:[]});}
 finally{await sql.unsafe(`DROP TRIGGER ${fault} ON public.app_usage_events`);await sql.unsafe(`DROP FUNCTION private.${fault}()`);}
 expect(await withSession(full,()=>recordProtocolClicksAction(JSON.parse(JSON.stringify([delayed,following])),scope()))).toEqual({code:'OK',accepted:[delayed.id,following.id],rejected:[]});
 const after={...clear,id:randomUUID()};expect(await withSession(full,()=>recordProtocolClicksAction([after],scope()))).toMatchObject({code:'OK'});
 expect(await sql`SELECT verpasst FROM public.technical_protocol WHERE tenant_id=${KREILE_TENANT_SLUG} AND id=${after.id}::uuid`).toEqual([{verpasst:1}]);
});
