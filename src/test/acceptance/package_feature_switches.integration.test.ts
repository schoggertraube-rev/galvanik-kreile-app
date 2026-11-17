// @vitest-environment node
// S21: real signed requests, authorization, config rows and mandatory ui_events.
import {randomUUID} from 'node:crypto';
import {expect,it,vi} from 'vitest';
const tenant=vi.hoisted(()=>'TEST-ablauf-'+globalThis.crypto.randomUUID());
vi.mock('@/lib/tenant',()=>({KREILE_TENANT_SLUG:tenant}));
import {KREILE_TENANT_SLUG} from '@/lib/tenant';
import {sql,full,withSession,createFixture} from '../../../e2e/ablauf/replayHarness';
import {readPackageSwitchesAction,setPackageSwitchAction} from '@/app/actions/settings.actions';
import {getAuthorizationSnapshotAction} from '@/app/actions/auth.actions';
import {saveIntakeNoteAction} from '@/app/actions/eingang.actions';

const replayUrl=process.env.DATABASE_URL;
if(!replayUrl||replayUrl!==process.env.H18_EXPECTED_DATABASE_URL||new URL(replayUrl).hostname!=='127.0.0.1')throw Error('TEST_S21_FINANCIAL_DEDICATED_LOOPBACK_REQUIRED');

it('S21 F1/F3/F5-F8: existing rights, one N5 audit, fresh reread and real domain write while off',async()=>{
 const initial=await withSession(full,()=>readPackageSwitchesAction());
 expect(initial.code).toBe('OK');if(initial.code!=='OK')throw Error('TEST_S21_INITIAL');
 expect(Object.keys(initial.switches)).toHaveLength(17);
 expect(initial.switches).toMatchObject({tag_anordnen:false,tag_notizen:false});
 const denied=await createFixture(['auftraege']),other=await createFixture(['einstellungen']);
 const input={id:'p2_eingang',enabled:true,clientKey:randomUUID()};
 expect(await withSession(denied,()=>setPackageSwitchAction(input))).toMatchObject({code:'FORBIDDEN'});
 expect(await withSession(denied,()=>readPackageSwitchesAction())).toMatchObject({code:'FORBIDDEN'});
 expect(await sql`SELECT id FROM public.ui_events WHERE tenant_id=${KREILE_TENANT_SLUG} AND payload->>'clientKey'=${input.clientKey}`).toHaveLength(0);
 try{
  const two=await Promise.all([withSession(full,()=>setPackageSwitchAction(input)),withSession(full,()=>setPackageSwitchAction(JSON.parse(JSON.stringify(input))))]);
  expect(two.map(result=>result.code)).toEqual(['OK','OK']);
  expect(two.filter(result=>result.code==='OK'&&result.replayed)).toHaveLength(1);
  const events=await sql`SELECT payload FROM public.ui_events WHERE tenant_id=${KREILE_TENANT_SLUG} AND event_type='package_switch_updated' AND payload->>'clientKey'=${input.clientKey}`;
  expect(events).toHaveLength(1);
  expect(events[0].payload).toMatchObject({actorId:full.actorId,clientKey:input.clientKey,source:'settings',before:{id:input.id,enabled:initial.switches.p2_eingang},after:{id:input.id,enabled:true}});
  expect(await withSession(full,()=>setPackageSwitchAction(JSON.parse(JSON.stringify(input))))).toMatchObject({code:'OK',replayed:true});
  expect(await withSession(full,()=>setPackageSwitchAction({...input,clientKey:input.clientKey.toUpperCase()}))).toMatchObject({code:'OK',replayed:true});
  expect(await withSession(other,()=>setPackageSwitchAction(input))).toMatchObject({code:'CONFLICT'});
  expect(await withSession(full,()=>setPackageSwitchAction({...input,enabled:false}))).toMatchObject({code:'CONFLICT'});
  expect(await withSession(full,()=>readPackageSwitchesAction())).toMatchObject({code:'OK',switches:{p2_eingang:true}});
  const auth=await withSession(full,()=>getAuthorizationSnapshotAction());
  expect(auth).toMatchObject({ok:true,data:{packageSwitches:{p2_eingang:true}}});
  if(!auth.ok||!auth.data.packageSwitches)throw Error('TEST_S21_PROJECTION');
  expect(Object.values(auth.data.packageSwitches).every(value=>typeof value==='boolean')).toBe(true);
  expect(auth.data.offline24h).toBe(auth.data.packageSwitches.offline_24h);
  expect(JSON.stringify(auth.data.packageSwitches)).not.toContain('roles_allowed');
  expect(await withSession(full,()=>setPackageSwitchAction({id:'p2_eingang',enabled:false,clientKey:randomUUID()}))).toMatchObject({code:'OK'});
  const itemId=randomUUID(),textstand=randomUUID(),note={itemId,textstand,text:'TEST S21 off does not block the existing intake writer'};
  expect(await withSession(full,()=>saveIntakeNoteAction(note))).toMatchObject({code:'OK'});
  expect(await withSession(full,()=>saveIntakeNoteAction(JSON.parse(JSON.stringify(note))))).toMatchObject({code:'OK'});
  expect(await sql`SELECT text FROM public.intake_item WHERE tenant_id=${KREILE_TENANT_SLUG} AND id=${itemId}::uuid`).toEqual([{text:note.text}]);
 }finally{
  expect(await withSession(full,()=>setPackageSwitchAction({id:'p2_eingang',enabled:initial.switches.p2_eingang,clientKey:randomUUID()}))).toMatchObject({code:'OK'});
 }
});

it('S21 keeps the existing offline pilot filter in the real rights query only',async()=>{
 const [initial]=await sql`SELECT enabled,roles_allowed FROM public.feature_flags WHERE id='offline_24h'`;
 if(!initial)throw Error('TEST_S21_OFFLINE_SOURCE_MISSING');
 const excluded=await createFixture(['einstellungen'],'admin');
 try{
  // Explicit TEST-only pilot configuration, restored below; no new role rule.
  await sql`UPDATE public.feature_flags SET roles_allowed=ARRAY['meister']::text[] WHERE id='offline_24h'`;
  expect(await withSession(full,()=>setPackageSwitchAction({id:'offline_24h',enabled:true,clientKey:randomUUID()}))).toMatchObject({code:'OK'});
  expect(await withSession(full,()=>getAuthorizationSnapshotAction())).toMatchObject({ok:true,data:{offline24h:true,packageSwitches:{offline_24h:true}}});
  expect(await withSession(excluded,()=>getAuthorizationSnapshotAction())).toMatchObject({ok:true,data:{offline24h:false,packageSwitches:{offline_24h:false}}});
  expect(await withSession(excluded,()=>readPackageSwitchesAction())).toMatchObject({code:'OK',switches:{offline_24h:true}});
 }finally{
  await sql`UPDATE public.feature_flags SET roles_allowed=${initial.roles_allowed}::text[] WHERE id='offline_24h'`;
  expect(await withSession(full,()=>setPackageSwitchAction({id:'offline_24h',enabled:initial.enabled,clientKey:randomUUID()}))).toMatchObject({code:'OK'});
 }
});

it('S21 F9: a genuinely suppressed audit rolls the config back; the same key succeeds after repair',async()=>{
 const initial=await withSession(full,()=>readPackageSwitchesAction());
 if(initial.code!=='OK')throw Error('TEST_S21_INITIAL_AUDIT');
 const input={id:'p2_kv',enabled:!initial.switches.p2_kv,clientKey:randomUUID()};
 const name='test_s21_audit_'+randomUUID().replaceAll('-','');
 // Synthetic local TEST fault only: no product policy/trigger is removed or disabled.
 await sql.unsafe(`CREATE FUNCTION private.${name}() RETURNS trigger LANGUAGE plpgsql AS $fault$ BEGIN
  IF NEW.tenant_id='${KREILE_TENANT_SLUG}' AND NEW.event_type='package_switch_updated' AND NEW.payload->>'clientKey'='${input.clientKey}' THEN RETURN NULL; END IF; RETURN NEW; END; $fault$`);
 try{
  await sql.unsafe(`CREATE TRIGGER ${name} BEFORE INSERT ON public.ui_events FOR EACH ROW EXECUTE FUNCTION private.${name}()`);
  try{
   expect(await withSession(full,()=>setPackageSwitchAction(input))).toMatchObject({code:'UNAVAILABLE'});
   expect(await withSession(full,()=>readPackageSwitchesAction())).toMatchObject({code:'OK',switches:{p2_kv:initial.switches.p2_kv}});
   expect(await sql`SELECT id FROM public.ui_events WHERE tenant_id=${KREILE_TENANT_SLUG} AND payload->>'clientKey'=${input.clientKey}`).toHaveLength(0);
  }finally{await sql.unsafe(`DROP TRIGGER ${name} ON public.ui_events`);}
  expect(await withSession(full,()=>setPackageSwitchAction(JSON.parse(JSON.stringify(input))))).toMatchObject({code:'OK',replayed:false});
  expect(await withSession(full,()=>setPackageSwitchAction(JSON.parse(JSON.stringify(input))))).toMatchObject({code:'OK',replayed:true});
  expect(await sql`SELECT id FROM public.ui_events WHERE tenant_id=${KREILE_TENANT_SLUG} AND payload->>'clientKey'=${input.clientKey}`).toHaveLength(1);
 }finally{
  await sql.unsafe(`DROP FUNCTION private.${name}()`);
  expect(await withSession(full,()=>setPackageSwitchAction({id:'p2_kv',enabled:initial.switches.p2_kv,clientKey:randomUUID()}))).toMatchObject({code:'OK'});
 }
});
