// @vitest-environment node
// Explicit synthetic click facts; real Server Action/Auth/DB. Browser capture is a separate proof.
import {randomUUID,createHash} from 'node:crypto';
import {beforeAll,expect,it,vi} from 'vitest';
const tenant=vi.hoisted(()=>'TEST-ablauf-'+globalThis.crypto.randomUUID());
vi.mock('@/lib/tenant',()=>({KREILE_TENANT_SLUG:tenant}));
import {KREILE_TENANT_SLUG} from '@/lib/tenant';
import {sql,full,withSession,createFixture} from '../../../e2e/ablauf/replayHarness';
import {recordProtocolClicksAction,getProtocolLogAction} from '@/app/actions/logging.actions';
import type {ClickInput} from '@/modules/logging/public';
import {offlinePartition} from '@/lib/server/offlinePartition';
if(!process.env.DATABASE_URL||process.env.DATABASE_URL!==process.env.H18_EXPECTED_DATABASE_URL||new URL(process.env.DATABASE_URL).hostname!=='127.0.0.1'||!KREILE_TENANT_SLUG.startsWith('TEST-ablauf-'))throw Error('S20_DEDICATED_TEST_REPLAY_REQUIRED');
beforeAll(async()=>{await sql`INSERT INTO public.company_settings(id,tenant_id,company_name) VALUES(${randomUUID()},${KREILE_TENANT_SLUG},'TEST S20 clicks')`;});
const click=(patch:Partial<ClickInput>={}):ClickInput=>({id:randomUUID(),sessionId:randomUUID(),route:'/orders/'+randomUUID()+'?secret=DO_NOT_LOG',target:'auftrag.fertig',deviceClass:'tablet',outcome:'success',durationMs:80,clickCount:1,occurredAt:new Date().toISOString(),...patch});

it('L8 actual existing click source: one normal/hang/cancel/repeat row, server pseudonym and normalized route, byte-equivalent retry',async()=>{
 const entries=[click(),click({durationMs:3500}),click({outcome:'cancelled'}),click({clickCount:2})];
 expect(await withSession(full,()=>recordProtocolClicksAction(entries))).toEqual({code:'OK',accepted:entries.map(row=>row.id)});
 expect(await withSession(full,()=>recordProtocolClicksAction(JSON.parse(JSON.stringify(entries))))).toEqual({code:'OK',accepted:entries.map(row=>row.id)});
 const rows=await sql`SELECT client_event_id::text,actor_pseudonym,route,event_type,outcome,duration_ms,click_count FROM public.app_usage_events WHERE tenant_id=${KREILE_TENANT_SLUG}`;
 expect(rows).toHaveLength(4);
 for(const row of rows){expect(row.actor_pseudonym).toBe(createHash('sha256').update(full.actorId).digest('hex'));expect(row.route).toBe('/orders/:id');expect(row.event_type).toBe('action');}
 const reader=await createFixture(['protokoll']);
 const read=await withSession(reader,()=>getProtocolLogAction({userId:full.actorId}));
 expect(read).toMatchObject({code:'OK'});
 if(read.code!=='OK'||!read.clicks)throw Error('TEST_ACTUAL_CLICK_READ_REQUIRED');
 expect(read.clicks).toHaveLength(4);expect(read.clicks.filter(row=>row.hang)).toHaveLength(1);
 expect(read.clicks.filter(row=>row.outcome==='cancelled')).toHaveLength(1);expect(read.clicks.filter(row=>row.clickCount===2)).toHaveLength(1);
 const other=await createFixture(['protokoll']),filtered=await withSession(reader,()=>getProtocolLogAction({userId:other.actorId}));
 expect(filtered).toMatchObject({code:'OK',clicks:[]});
});

it('click conflict rolls the entire new batch back; a different actor cannot acknowledge an old click, invalid target is rejected',async()=>{
 const original=click();expect(await withSession(full,()=>recordProtocolClicksAction([original]))).toMatchObject({code:'OK'});
 const fresh=click();
 expect(await withSession(full,()=>recordProtocolClicksAction([fresh,{...original,durationMs:original.durationMs+1}]))).toEqual({code:'CONFLICT'});
 expect(await sql`SELECT id FROM public.app_usage_events WHERE tenant_id=${KREILE_TENANT_SLUG} AND client_event_id=${fresh.id}::uuid`).toHaveLength(0);
 const other=await createFixture(['auftraege']);
 expect(await withSession(other,()=>recordProtocolClicksAction([original]))).toEqual({code:'CONFLICT'});
 expect(await withSession(full,()=>recordProtocolClicksAction([click({target:'Bearer x'})]))).toEqual({code:'VALIDATION_ERROR'});
});

it('capture metadata reveals no restricted protocol; scoped unknown facts preserve NULL and cannot be transported by a different login',async()=>{
 const capture=await withSession(full,()=>getProtocolLogAction({capture:true})),partition=offlinePartition({tenantId:KREILE_TENANT_SLUG,userId:full.actorId});
 expect(capture).toEqual({code:'OK',enabled:true,scope:partition});
 const fact={...click(),outcome:null,durationMs:null};
 expect(await withSession(full,()=>recordProtocolClicksAction([fact],partition))).toMatchObject({code:'OK',accepted:[fact.id]});
 expect(await withSession(full,()=>recordProtocolClicksAction(JSON.parse(JSON.stringify([fact])),partition))).toMatchObject({code:'OK',accepted:[fact.id]});
 expect(await sql`SELECT outcome,duration_ms FROM public.app_usage_events WHERE tenant_id=${KREILE_TENANT_SLUG} AND client_event_id=${fact.id}::uuid`).toEqual([{outcome:null,duration_ms:null}]);
 const other=await createFixture(['auftraege']),fresh=click();
 expect(await withSession(other,()=>recordProtocolClicksAction([fresh],partition))).toEqual({code:'FORBIDDEN'});
 expect(await sql`SELECT id FROM public.app_usage_events WHERE tenant_id=${KREILE_TENANT_SLUG} AND client_event_id=${fresh.id}::uuid`).toHaveLength(0);
 expect(await withSession(other,()=>getProtocolLogAction())).toEqual({code:'FORBIDDEN'});
});
