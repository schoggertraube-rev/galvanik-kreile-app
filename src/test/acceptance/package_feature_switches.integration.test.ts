// @vitest-environment node
// S21: real signed requests, authorization, config rows and mandatory ui_events.
import {randomUUID} from 'node:crypto';
import {mkdirSync,writeFileSync} from 'node:fs';
import {expect,it,vi} from 'vitest';
const tenant=vi.hoisted(()=>'TEST-ablauf-'+globalThis.crypto.randomUUID());
vi.mock('@/lib/tenant',()=>({KREILE_TENANT_SLUG:tenant}));
import {KREILE_TENANT_SLUG} from '@/lib/tenant';
import {sql,full,withSession,createFixture} from '../../../e2e/ablauf/replayHarness';
import {readPackageSwitchesAction,setPackageSwitchAction} from '@/app/actions/settings.actions';
import {getAuthorizationSnapshotAction,getAuthBootstrapAction} from '@/app/actions/auth.actions';
import {saveIntakeNoteAction} from '@/app/actions/eingang.actions';
import {readRootStyle} from '@/ui/vorfinalStyle';

const replayUrl=process.env.DATABASE_URL;
if(!replayUrl||replayUrl!==process.env.H18_EXPECTED_DATABASE_URL||new URL(replayUrl).hostname!=='127.0.0.1')throw Error('TEST_S21_FINANCIAL_DEDICATED_LOOPBACK_REQUIRED');

type OriginalFlag={id:string;name:string;description:string|null;enabled:boolean;roles_allowed:string[]|null;created_at:string;updated_at:string};
async function originalFlag(id:string):Promise<OriginalFlag>{
 const rows=await sql<{original:OriginalFlag}[]>`SELECT to_jsonb(flag) AS original FROM public.feature_flags flag WHERE id=${id}`;
 if(rows.length!==1)throw Error('TEST_KORR233_FLAG_SOURCE_MISSING');
 // PL19.11 R24b: non-secret full source survives a failed process, at exact precision.
 const directory='.git/kreile-r24-flag-originals';mkdirSync(directory,{recursive:true});
 writeFileSync(directory+'/'+id.replace(/[^a-z0-9_-]/giu,'_')+'-'+randomUUID()+'.json',JSON.stringify({at:new Date().toISOString(),source:'public.feature_flags',original:rows[0].original},null,2));
 return rows[0].original;
}
async function restoreFlag(original:OriginalFlag){
 await sql`INSERT INTO public.feature_flags SELECT * FROM jsonb_populate_record(NULL::public.feature_flags,${sql.json(original)}::jsonb)
  ON CONFLICT(id) DO UPDATE SET enabled=EXCLUDED.enabled,roles_allowed=EXCLUDED.roles_allowed,updated_at=EXCLUDED.updated_at`;
 expect(await originalFlag(String(original.id))).toEqual(original);
}

it('S18 uses the real root bootstrap switch, rereads both styles and restores the TEST setting exactly',async()=>{
 const original=await originalFlag('ui_v45');
 try{
  for(const enabled of [false,true,false]){
   expect(await withSession(full,()=>setPackageSwitchAction({id:'ui_v45',enabled,clientKey:randomUUID()}))).toMatchObject({code:'OK'});
   const bootstrap=await withSession(full,()=>getAuthBootstrapAction());
   expect(bootstrap.status).toBe('authenticated');
   if(bootstrap.status!=='authenticated')throw Error('TEST_S18_BOOTSTRAP_REQUIRED');
   const style=readRootStyle(bootstrap.status,bootstrap.user.packageSwitches);
   expect(style).toMatchObject({enabled,dataUi:enabled?'v45':undefined});
   expect(style.css).toContain(enabled?'--ground:#f3f6f5':'--ground:#EFE6D6');
  }
 }finally{await restoreFlag(original);}
});

it('KORR-233 K1: missing visibility source keeps the real login and records one content-free diagnostic',async()=>{
 const original=await originalFlag('p2_kv');
 const before=await sql`SELECT id FROM public.technical_protocol WHERE tenant_id=${KREILE_TENANT_SLUG} AND user_id=${full.actorId}::uuid AND command='PACKAGE_SWITCH_VISIBILITY_FAILED'`;
 try{
  // Explicit isolated TEST fault from the PL case; no permission or guard changed.
  await sql`DELETE FROM public.feature_flags WHERE id='p2_kv'`;
  const login=await withSession(full,()=>getAuthBootstrapAction());
  expect(login).toMatchObject({status:'authenticated',user:{offline24h:false}});
  if(login.status!=='authenticated'||!login.user.packageSwitches)throw Error('TEST_KORR233_LOGIN_FAILED');
  expect(Object.keys(login.user.packageSwitches)).toHaveLength(19);
  expect(Object.values(login.user.packageSwitches)).toEqual(Array(19).fill(false));
  const records=await sql`SELECT id,event_type,command,subject_type,subject_id,reason,original_ref,original_sha256 FROM public.technical_protocol
   WHERE tenant_id=${KREILE_TENANT_SLUG} AND user_id=${full.actorId}::uuid AND command='PACKAGE_SWITCH_VISIBILITY_FAILED' ORDER BY recorded_at,id`;
  expect(records).toHaveLength(before.length+1);
  expect(records.at(-1)).toMatchObject({event_type:'server_error',command:'PACKAGE_SWITCH_VISIBILITY_FAILED',subject_type:'action',subject_id:'resolveAuthorization',reason:'UNAVAILABLE',original_ref:null,original_sha256:null});
 }finally{await restoreFlag(original);}
});

it('KORR-233 K2: nullable logging role metadata keeps the actual login and flag values',async()=>{
 const original=await originalFlag('logging');
 const before=await withSession(full,()=>getAuthorizationSnapshotAction());
 if(!before.ok)throw Error('TEST_KORR233_BEFORE_LOGIN');
 try{
  await sql`UPDATE public.feature_flags SET roles_allowed=NULL WHERE id='logging'`;
  expect(await withSession(full,()=>getAuthorizationSnapshotAction())).toMatchObject({ok:true,data:{packageSwitches:before.data.packageSwitches,offline24h:before.data.offline24h}});
  expect(await withSession(full,()=>readPackageSwitchesAction())).toMatchObject({code:'OK',switches:{logging:original.enabled}});
 }finally{await restoreFlag(original);}
});

it('KORR-233 K2: enabled offline pilot with null roles never enables offline for the real login',async()=>{
 const original=await originalFlag('offline_24h');
 const before=await withSession(full,()=>getAuthorizationSnapshotAction());
 if(!before.ok||!before.data.packageSwitches)throw Error('TEST_KORR233_OFFLINE_BEFORE_LOGIN');
 const diagnostics=await sql`SELECT id FROM public.technical_protocol WHERE tenant_id=${KREILE_TENANT_SLUG} AND user_id=${full.actorId}::uuid AND command='PACKAGE_SWITCH_VISIBILITY_FAILED'`;
 try{
  await sql`UPDATE public.feature_flags SET enabled=true,roles_allowed=NULL WHERE id='offline_24h'`;
  expect(await withSession(full,()=>getAuthorizationSnapshotAction())).toMatchObject({ok:true,data:{offline24h:false,packageSwitches:{...before.data.packageSwitches,offline_24h:false}}});
  expect(await sql`SELECT id FROM public.technical_protocol WHERE tenant_id=${KREILE_TENANT_SLUG} AND user_id=${full.actorId}::uuid AND command='PACKAGE_SWITCH_VISIBILITY_FAILED'`).toHaveLength(diagnostics.length);
 }finally{await restoreFlag(original);}
});

it('S21 F1/F3/F5-F8: existing rights, one N5 audit, fresh reread and real domain write while off',async()=>{
 const initial=await withSession(full,()=>readPackageSwitchesAction());
 expect(initial.code).toBe('OK');if(initial.code!=='OK')throw Error('TEST_S21_INITIAL');
 expect(Object.keys(initial.switches)).toHaveLength(19);
 expect(initial.switches).toMatchObject({tag_anordnen:false,tag_notizen:false});
 const original=await originalFlag('p2_eingang');
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
  await restoreFlag(original);
 }
});

it('S21 keeps the existing offline pilot filter in the real rights query only',async()=>{
 const initial=await originalFlag('offline_24h');
 const excluded=await createFixture(['einstellungen'],'admin');
 try{
  // Explicit TEST-only pilot configuration, restored below; no new role rule.
  await sql`UPDATE public.feature_flags SET roles_allowed=ARRAY['meister']::text[] WHERE id='offline_24h'`;
  expect(await withSession(full,()=>setPackageSwitchAction({id:'offline_24h',enabled:true,clientKey:randomUUID()}))).toMatchObject({code:'OK'});
  expect(await withSession(full,()=>getAuthorizationSnapshotAction())).toMatchObject({ok:true,data:{offline24h:true,packageSwitches:{offline_24h:true}}});
  expect(await withSession(excluded,()=>getAuthorizationSnapshotAction())).toMatchObject({ok:true,data:{offline24h:false,packageSwitches:{offline_24h:false}}});
  expect(await withSession(excluded,()=>readPackageSwitchesAction())).toMatchObject({code:'OK',switches:{offline_24h:true}});
 }finally{
  await restoreFlag(initial);
 }
});

it('S21 F9: a genuinely suppressed audit rolls the config back; the same key succeeds after repair',async()=>{
 const initial=await withSession(full,()=>readPackageSwitchesAction());
 if(initial.code!=='OK')throw Error('TEST_S21_INITIAL_AUDIT');
 const original=await originalFlag('p2_kv');
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
  await restoreFlag(original);
 }
});
