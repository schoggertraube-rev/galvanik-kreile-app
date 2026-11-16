// @vitest-environment node
// Explicit synthetic diagnostic facts; actual existing Action/Auth/DB and immutable sink.
import {randomUUID} from 'node:crypto';
import {expect,it,vi} from 'vitest';
const tenant=vi.hoisted(()=>'TEST-ablauf-'+globalThis.crypto.randomUUID());
vi.mock('@/lib/tenant',()=>({KREILE_TENANT_SLUG:tenant}));
import {KREILE_TENANT_SLUG} from '@/lib/tenant';
import {sql,full,withSession,withRequest,createFixture} from '../../../e2e/ablauf/replayHarness';
import {recordProtocolClicksAction} from '@/app/actions/logging.actions';
import {offlinePartition} from '@/lib/server/offlinePartition';
import type {ClientDiagnosticFact} from '@/modules/logging/public';
if(!process.env.DATABASE_URL||process.env.DATABASE_URL!==process.env.H18_EXPECTED_DATABASE_URL||new URL(process.env.DATABASE_URL).hostname!=='127.0.0.1'||!KREILE_TENANT_SLUG.startsWith('TEST-ablauf-'))throw Error('S20_DEDICATED_TEST_REPLAY_REQUIRED');
const partition=()=>offlinePartition({tenantId:KREILE_TENANT_SLUG,userId:full.actorId});
const fact=():ClientDiagnosticFact=>({kind:'error',id:randomUUID(),command:'OFFLINE_PENDING_READ_FAILED',occurredAt:new Date(Date.now()-180000).toISOString()});

it('known error codes persist without available click settings; exact retries reread the same immutable actor/time receipt and reject altered data or foreign logins',async()=>{
 expect(await sql`SELECT id FROM public.company_settings WHERE tenant_id=${KREILE_TENANT_SLUG}`).toHaveLength(0);
 const original=fact(),scope=partition();
 expect(await withSession(full,()=>recordProtocolClicksAction([original],scope))).toEqual({code:'OK',accepted:[original.id],rejected:[]});
 const first=await sql`SELECT * FROM public.technical_protocol WHERE tenant_id=${KREILE_TENANT_SLUG} AND id=${original.id}::uuid`;
 expect(first).toHaveLength(1);expect(first[0]).toMatchObject({user_id:full.actorId,event_type:'server_error',command:original.command,reason:'UNKNOWN'});expect(new Date(first[0].occurred_at).toISOString()).toBe(original.occurredAt);
 expect(await withSession(full,()=>recordProtocolClicksAction(JSON.parse(JSON.stringify([original])),scope))).toEqual({code:'OK',accepted:[original.id],rejected:[]});
 expect(await sql`SELECT * FROM public.technical_protocol WHERE tenant_id=${KREILE_TENANT_SLUG} AND id=${original.id}::uuid`).toEqual(first);
 expect(await withSession(full,()=>recordProtocolClicksAction([{...original,command:'OFFLINE_SYNC_UNAVAILABLE'}],scope))).toEqual({code:'CONFLICT',accepted:[],rejected:[{id:original.id,code:'CONFLICT'}]});
 const foreign=await createFixture(['auftraege']),foreignScope=offlinePartition({tenantId:KREILE_TENANT_SLUG,userId:foreign.actorId});
 expect(await withSession(foreign,()=>recordProtocolClicksAction([original],scope))).toEqual({code:'FORBIDDEN'});
 expect(await withSession(foreign,()=>recordProtocolClicksAction([original],foreignScope))).toEqual({code:'CONFLICT',accepted:[],rejected:[{id:original.id,code:'CONFLICT'}]});
 expect(await sql`SELECT * FROM public.technical_protocol WHERE tenant_id=${KREILE_TENANT_SLUG} AND id=${original.id}::uuid`).toEqual(first);
 const rejected={...fact(),pin:'1234',error:'Bearer TEST_PRIVATE_TOKEN',mail:'TEST_PRIVATE_MAIL_BODY'};
 expect(await withSession(full,()=>recordProtocolClicksAction([rejected],scope))).toEqual({code:'VALIDATION_ERROR',accepted:[],rejected:[{id:rejected.id,code:'VALIDATION_ERROR'}]});
 expect(await sql`SELECT id FROM public.technical_protocol WHERE tenant_id=${KREILE_TENANT_SLUG} AND id=${rejected.id}::uuid`).toHaveLength(0);
});

it('a suppressed actual sink receipt yields no false acknowledgement; the same original retries once and carries exactly one lost attempt',async()=>{
 const scope=partition(),clear=fact();expect(await withSession(full,()=>recordProtocolClicksAction([clear],scope))).toMatchObject({code:'OK'});
 const original=fact(),fault='test_s20_client_'+randomUUID().replaceAll('-','');
 await sql.unsafe(`CREATE FUNCTION private.${fault}() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.tenant_id='${KREILE_TENANT_SLUG}' AND NEW.id='${original.id}'::uuid THEN RETURN NULL; END IF; RETURN NEW; END $$`);
 await sql.unsafe(`CREATE TRIGGER ${fault} BEFORE INSERT ON public.technical_protocol FOR EACH ROW EXECUTE FUNCTION private.${fault}()`);
 try{
  expect(await withSession(full,()=>recordProtocolClicksAction([original],scope))).toEqual({code:'UNAVAILABLE',accepted:[],rejected:[]});
  expect(await sql`SELECT id FROM public.technical_protocol WHERE tenant_id=${KREILE_TENANT_SLUG} AND id=${original.id}::uuid`).toHaveLength(0);
 }finally{await sql.unsafe(`DROP TRIGGER ${fault} ON public.technical_protocol`);await sql.unsafe(`DROP FUNCTION private.${fault}()`);}
 expect(await withSession(full,()=>recordProtocolClicksAction(JSON.parse(JSON.stringify([original])),scope))).toEqual({code:'OK',accepted:[original.id],rejected:[]});
 const stored=await sql`SELECT verpasst,user_id::text,occurred_at FROM public.technical_protocol WHERE tenant_id=${KREILE_TENANT_SLUG} AND id=${original.id}::uuid`;
 expect(stored).toHaveLength(1);expect(stored[0].verpasst).toBe(1);expect(stored[0].user_id).toBe(full.actorId);expect(new Date(stored[0].occurred_at).toISOString()).toBe(original.occurredAt);
});

it('unknown-origin errors remain instance-only even during another real login; no-session reports keep their original scope for a later qualified retry',async()=>{
 const scope=partition(),clear=fact();expect(await withSession(full,()=>recordProtocolClicksAction([clear],scope))).toMatchObject({code:'OK'});
 const unknown=fact(),known=fact(),before=await sql`SELECT id FROM public.technical_protocol WHERE tenant_id=${KREILE_TENANT_SLUG}`;
 expect(await withSession(full,()=>recordProtocolClicksAction([unknown],null))).toEqual({code:'COUNTED',accepted:[unknown.id],rejected:[]});
 expect(await withRequest('',()=>recordProtocolClicksAction([known],scope))).toEqual({code:'UNAUTHENTICATED'});
 expect(await sql`SELECT id FROM public.technical_protocol WHERE tenant_id=${KREILE_TENANT_SLUG}`).toEqual(before);
 expect(await withSession(full,()=>recordProtocolClicksAction([known],scope))).toEqual({code:'OK',accepted:[known.id],rejected:[]});
 expect(await sql`SELECT user_id::text,verpasst FROM public.technical_protocol WHERE tenant_id=${KREILE_TENANT_SLUG} AND id=${known.id}::uuid`).toEqual([{user_id:full.actorId,verpasst:2}]);
 expect(await sql`SELECT id FROM public.technical_protocol WHERE tenant_id=${KREILE_TENANT_SLUG} AND id=${unknown.id}::uuid`).toHaveLength(0);
});

it('partial real receipts survive retry and a replay never consumes the new loss count meant for the next inserted fact',async()=>{
 const scope=partition(),clear=fact();expect(await withSession(full,()=>recordProtocolClicksAction([clear],scope))).toMatchObject({code:'OK'});
 const first=fact(),second=fact(),fault='test_s20_partial_'+randomUUID().replaceAll('-','');
 await sql.unsafe(`CREATE FUNCTION private.${fault}() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.tenant_id='${KREILE_TENANT_SLUG}' AND NEW.id='${second.id}'::uuid THEN RETURN NULL; END IF; RETURN NEW; END $$`);
 await sql.unsafe(`CREATE TRIGGER ${fault} BEFORE INSERT ON public.technical_protocol FOR EACH ROW EXECUTE FUNCTION private.${fault}()`);
 try{expect(await withSession(full,()=>recordProtocolClicksAction([first,second],scope))).toEqual({code:'UNAVAILABLE',accepted:[first.id],rejected:[]});}
 finally{await sql.unsafe(`DROP TRIGGER ${fault} ON public.technical_protocol`);await sql.unsafe(`DROP FUNCTION private.${fault}()`);}
 const original=await sql`SELECT * FROM public.technical_protocol WHERE tenant_id=${KREILE_TENANT_SLUG} AND id=${first.id}::uuid`;
 expect(original).toHaveLength(1);expect(original[0].verpasst).toBe(0);
 expect(await withSession(full,()=>recordProtocolClicksAction(JSON.parse(JSON.stringify([first,second])),scope))).toEqual({code:'OK',accepted:[first.id,second.id],rejected:[]});
 expect(await sql`SELECT * FROM public.technical_protocol WHERE tenant_id=${KREILE_TENANT_SLUG} AND id=${first.id}::uuid`).toEqual(original);
 expect(await sql`SELECT verpasst FROM public.technical_protocol WHERE tenant_id=${KREILE_TENANT_SLUG} AND id=${second.id}::uuid`).toEqual([{verpasst:1}]);
});
