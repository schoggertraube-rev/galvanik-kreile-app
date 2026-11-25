// @vitest-environment node
// PLAN_LADEZEIT E-B/E1: isolated TEST tenant, actual commands/Auth/DB/Storage.
// Direct no-op SQL below is explicitly a schema/rollback probe, not a command proof.
import {expect,it,vi} from 'vitest';
import {readFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
const tenant=vi.hoisted(()=>'TEST-ablauf-'+globalThis.crypto.randomUUID());
vi.mock('@/lib/tenant',()=>({KREILE_TENANT_SLUG:tenant}));
import {sql,full,createFixture,withSession} from '../../../e2e/ablauf/replayHarness';
import {recordUserLastSeenForLogin} from '@/lib/server/userLastSeen';
import {sql as sqlDrizzle} from 'drizzle-orm';
import {readyInvoiceOrder} from '../../../e2e/ablauf/orderFixture';
import {randomUUID} from 'node:crypto';
import {withPrivilegedTenantTransaction} from '@/lib/server/privilegedDb';

it('creates only private tenant-keyed derived sources with no public read or delete privilege',async()=>{
 const tables=await sql`SELECT c.relname,c.relrowsecurity FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='private' AND c.relname IN ('today_source_v1','today_tenant_v1') ORDER BY c.relname`;
 expect(tables).toEqual([{relname:'today_source_v1',relrowsecurity:true},{relname:'today_tenant_v1',relrowsecurity:true}]);
 expect(await sql`SELECT has_table_privilege('anon','private.today_source_v1','SELECT') AS anon_read,has_table_privilege('authenticated','private.today_source_v1','SELECT') AS authenticated_read,has_table_privilege('service_role','private.today_source_v1','DELETE') AS can_delete,has_table_privilege('service_role','private.today_source_v1','UPDATE') AS can_refresh`).toEqual([{anon_read:false,authenticated_read:false,can_delete:false,can_refresh:true}]);
 const triggers=await sql`SELECT n.nspname AS schema,c.relname AS name,count(*)::integer AS operations FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid JOIN pg_namespace n ON n.oid=c.relnamespace WHERE NOT t.tgisinternal AND t.tgname IN ('today_mark_insert_v1','today_mark_update_v1','today_mark_delete_v1') GROUP BY n.nspname,c.relname ORDER BY n.nspname,c.relname`;
 expect(triggers).toHaveLength(51);expect(triggers.every(row=>row.operations===3)).toBe(true);
 expect(triggers).toEqual(expect.arrayContaining([{schema:'public',name:'events',operations:3},{schema:'public',name:'orders',operations:3},{schema:'public',name:'intake_item',operations:3},{schema:'private',name:'evidence_domain_links',operations:3}]));
 expect(triggers).toEqual(expect.arrayContaining([
  {schema:'public',name:'stock_movements',operations:3},
  {schema:'public',name:'material_prices',operations:3},
  {schema:'public',name:'inventory_sessions',operations:3},
  {schema:'public',name:'inventory_counts',operations:3},
  {schema:'public',name:'inventory_lines',operations:3},
  {schema:'public',name:'lager_material_nachbewertungen',operations:3},
 ]));
});

it('marks actual intake, completion, freeze, invoice and settings writes in the same tenant without caching invented payloads',async()=>{
 const result=await readyInvoiceOrder('TEST Today actual invalidation');
 const [source]=await sql`SELECT source_seq::integer,built_seq::integer,status,payload,source_version FROM private.today_source_v1 WHERE tenant_id=${tenant} AND kind='order' AND source_id=${result.orderId}`;
 expect(source).toMatchObject({built_seq:0,status:'PENDING',payload:null,source_version:null});
 expect(source.source_seq).toBeGreaterThan(1);
 const lists=await sql`SELECT kind,source_id FROM private.today_source_v1 WHERE tenant_id=${tenant} AND kind<>'order' ORDER BY kind`;
 expect(lists).toEqual(expect.arrayContaining([{kind:'orders',source_id:'*'},{kind:'money',source_id:'*'}]));
 const [settings]=await sql`SELECT today_read_source,today_refresh_batch_limit,today_refresh_lease_seconds,today_stale_poll_ms,nav_prefetch_max_age_seconds FROM public.company_settings WHERE tenant_id=${tenant}`;
 expect(settings).toEqual({today_read_source:'modell',today_refresh_batch_limit:20,today_refresh_lease_seconds:30,today_stale_poll_ms:1500,nav_prefetch_max_age_seconds:60});
 expect(await sql`SELECT tenant_seq::integer FROM private.today_tenant_v1 WHERE tenant_id=${tenant}`).toEqual([{tenant_seq:expect.any(Number)}]);
});

it('rolls source marks back with the original write and deduplicates old/new statement keys',async()=>{
 const [source]=await sql`SELECT source_id,source_seq::integer FROM private.today_source_v1 WHERE tenant_id=${tenant} AND kind='order' ORDER BY source_id LIMIT 1`;
 expect(source).toBeDefined();
 const original=await sql`SELECT to_jsonb(o) AS row FROM public.orders o WHERE tenant_id=${tenant} AND id=${source.source_id}`;
 const rollback=new Error('TEST_ABORT_TODAY_SOURCE_AND_BUSINESS_WRITE');
 await expect(sql.begin(async tx=>{
  await tx`UPDATE public.orders SET title=title WHERE tenant_id=${tenant} AND id=${source.source_id}`;
  expect(await tx`SELECT source_seq::integer FROM private.today_source_v1 WHERE tenant_id=${tenant} AND kind='order' AND source_id=${source.source_id}`).toEqual([{source_seq:source.source_seq+1}]);
  throw rollback;
 })).rejects.toBe(rollback);
 expect(await sql`SELECT source_seq::integer FROM private.today_source_v1 WHERE tenant_id=${tenant} AND kind='order' AND source_id=${source.source_id}`).toEqual([{source_seq:source.source_seq}]);
 expect(await sql`SELECT to_jsonb(o) AS row FROM public.orders o WHERE tenant_id=${tenant} AND id=${source.source_id}`).toEqual(original);
});

it('ignores unchanged role/name/active fields during a PIN-only app-user update',async()=>{
 const before=await sql`SELECT tenant_seq FROM private.today_tenant_v1 WHERE tenant_id=${tenant}`;
 await sql`UPDATE public.app_users SET pin_hash=pin_hash WHERE tenant_id=${tenant}`;
 expect(await sql`SELECT tenant_seq FROM private.today_tenant_v1 WHERE tenant_id=${tenant}`).toEqual(before);
});

it('PL11:36 completes the actual login-seen writer and PIN-only update while the Today tenant is locked',async()=>{
 const before=await sql`SELECT tenant_seq::text FROM private.today_tenant_v1 WHERE tenant_id=${tenant}`;
 const sources=await sql`SELECT kind,source_id,source_seq::text FROM private.today_source_v1 WHERE tenant_id=${tenant} ORDER BY kind,source_id`;
 let entered!:()=>void,release!:()=>void;
 const started=new Promise<void>(resolve=>{entered=resolve;}),gate=new Promise<void>(resolve=>{release=resolve;});
 const holder=sql.begin(async tx=>{await tx`SELECT 1 FROM private.today_tenant_v1 WHERE tenant_id=${tenant} FOR UPDATE`;entered();await gate;});
 await started;
 const login=withSession(full,()=>recordUserLastSeenForLogin());
 try{
  const outcome=await Promise.race([login,new Promise<'TEST_WAITED_ON_MODEL'>(resolve=>setTimeout(()=>resolve('TEST_WAITED_ON_MODEL'),750))]);
  expect(outcome).toMatchObject({code:'OK'});
  await sql`UPDATE public.app_users SET pin_hash=pin_hash WHERE tenant_id=${tenant}`;
 }finally{release();await holder;await login;}
 expect(await sql`SELECT tenant_seq::text FROM private.today_tenant_v1 WHERE tenant_id=${tenant}`).toEqual(before);
 expect(await sql`SELECT kind,source_id,source_seq::text FROM private.today_source_v1 WHERE tenant_id=${tenant} ORDER BY kind,source_id`).toEqual(sources);
});

it('explicitly classifies every production versioned constant and keeps unknown event types tenant-stale',async()=>{
 const [definition]=await sql`SELECT pg_get_functiondef('private.today_event_scope_v1(text)'::regprocedure) AS source`;
 const files=execFileSync('git',['ls-files','src'],{encoding:'utf8'}).trim().split('\n').filter(path=>/\.[cm]?[jt]sx?$/.test(path)&&!/(?:^|\/)(?:test|__tests__)\/|\.(?:test|spec)\.|v45\.generated/.test(path));
 const types=new Set<string>();
 for(const file of files)for(const match of readFileSync(file,'utf8').matchAll(/['"`]([A-Z][A-Z0-9_]*_V\d+)['"`]/g))types.add(match[1]);
 // Exact names read without payloads from Dev on22.11; legacy types may no
 // longer have a current producer. This is an inventory, never a Dev write.
 const devTypes=['CUSTOMER_COMMERCIAL_UPDATED_V1','CUSTOMER_CREATED_V1','CUSTOMER_NOTE_CHANGED_V1','CUSTOMER_UPDATED_V1','EXTRA_WORK_RATE_SET_V1','INVOICE_CREATED_V1','ORDER_FROZEN_V1','ORDER_INTAKE_CREATED_V1','ORDER_INVOICE_PRICES_SET_V1','ORDER_ITEM_FINISHED_CHANGED_V1','ORDER_PICKED_UP_V1','ORDER_PROMISED_DUE_DATE_CHANGED_V1','ORDER_STATION_MOVED_V1','ORDER_TASK_ASSIGNED_V1','PAYMENT_CONFIRMED_V1','QUOTE_AWARDED_V1','QUOTE_CREATED_V1','USER_LAST_SEEN_RECORDED_V1'];
 for(const type of devTypes)types.add(type);
 for(const type of types)expect(definition.source,`missing explicit event scope: ${type}`).toContain("'"+type+"'");
 expect(await sql`SELECT private.today_event_scope_v1('TEST_UNKNOWN_FUTURE_V999') AS unknown_scope,private.today_event_scope_v1('USER_LAST_SEEN_RECORDED_V1') AS seen_scope,private.today_event_scope_v1(NULL) AS null_scope`).toEqual([{unknown_scope:'tenant',seen_scope:'none',null_scope:'tenant'}]);
});


it('invalidates the tenant epoch for actual right-row insert/update/delete without changing another tenant',async()=>{
 // Explicit schema/invalidation probe in this isolated TEST tenant. These SQL
 // operations do not claim to be the administrative Action/permission writer.
 const actor=await createFixture(['auftraege']);
 const other=tenant+'-rights-isolation';await sql`INSERT INTO private.today_tenant_v1(tenant_id) VALUES(${other})`;
 const [before]=await sql`SELECT tenant_seq::integer AS seq FROM private.today_tenant_v1 WHERE tenant_id=${tenant}`;
 const otherBefore=await sql`SELECT to_jsonb(model) AS row FROM private.today_tenant_v1 model WHERE tenant_id=${other}`;
 await sql`INSERT INTO public.app_user_rights(tenant_id,user_id,bereich,granted_by) VALUES(${tenant},${actor.actorId}::uuid,'mails',${full.actorId}::uuid)`;
 expect(await sql`SELECT tenant_seq::integer AS seq FROM private.today_tenant_v1 WHERE tenant_id=${tenant}`).toEqual([{seq:before.seq+1}]);
 await sql`UPDATE public.app_user_rights SET bereich='kunden' WHERE tenant_id=${tenant} AND user_id=${actor.actorId}::uuid AND bereich='mails'`;
 expect(await sql`SELECT tenant_seq::integer AS seq FROM private.today_tenant_v1 WHERE tenant_id=${tenant}`).toEqual([{seq:before.seq+2}]);
 await sql`DELETE FROM public.app_user_rights WHERE tenant_id=${tenant} AND user_id=${actor.actorId}::uuid AND bereich='kunden'`;
 expect(await sql`SELECT tenant_seq::integer AS seq FROM private.today_tenant_v1 WHERE tenant_id=${tenant}`).toEqual([{seq:before.seq+3}]);
 expect(await sql`SELECT to_jsonb(model) AS row FROM private.today_tenant_v1 model WHERE tenant_id=${other}`).toEqual(otherBefore);
 expect(await sql`SELECT bereich FROM public.app_user_rights WHERE tenant_id=${tenant} AND user_id=${actor.actorId}::uuid ORDER BY bereich`).toEqual([{bereich:'auftraege'}]);
});


it('invalidates actual app-user name and active changes while retaining the existing role source',async()=>{
 // Isolated TEST schema probe, not a new identity, role or administrative writer.
 const actor=await createFixture(['mails']);
 const [before]=await sql`SELECT tenant_seq::integer AS seq FROM private.today_tenant_v1 WHERE tenant_id=${tenant}`;
 await sql`UPDATE public.app_users SET full_name='TEST actual changed name' WHERE tenant_id=${tenant} AND id=${actor.actorId}::uuid`;
 expect(await sql`SELECT tenant_seq::integer AS seq FROM private.today_tenant_v1 WHERE tenant_id=${tenant}`).toEqual([{seq:before.seq+1}]);
 await sql`UPDATE public.app_users SET active=false WHERE tenant_id=${tenant} AND id=${actor.actorId}::uuid`;
 expect(await sql`SELECT tenant_seq::integer AS seq FROM private.today_tenant_v1 WHERE tenant_id=${tenant}`).toEqual([{seq:before.seq+2}]);
 await sql`UPDATE public.app_users SET active=true WHERE tenant_id=${tenant} AND id=${actor.actorId}::uuid`;
 expect(await sql`SELECT tenant_seq::integer AS seq FROM private.today_tenant_v1 WHERE tenant_id=${tenant}`).toEqual([{seq:before.seq+3}]);
 expect(await sql`SELECT role,full_name,active FROM public.app_users WHERE tenant_id=${tenant} AND id=${actor.actorId}::uuid`).toEqual([{role:actor.role,full_name:'TEST actual changed name',active:true}]);
});

it('marks two actual order sources in a fixed order under concurrent reversed input and rolls both schema probes back',async()=>{
 // Explicit no-op schema/concurrency boundary, not an unrecorded product command.
 const first=await readyInvoiceOrder('TEST sorted trigger first'),second=await readyInvoiceOrder('TEST sorted trigger second');
 const ids=[first.orderId,second.orderId];
 const original=await sql`SELECT to_jsonb(orders) AS row FROM public.orders orders WHERE tenant_id=${tenant} AND id IN (${ids[0]},${ids[1]}) ORDER BY id`;
 const source=await sql`SELECT to_jsonb(model) AS row FROM private.today_source_v1 model WHERE tenant_id=${tenant} ORDER BY kind,source_id`;
 const rollback=Symbol('TEST rollback concurrent invalidation probe');
 const probe=async(orderIds:string[])=>{
  try{await sql.begin(async tx=>{
   const before=await tx`SELECT source_id,source_seq::text AS seq FROM private.today_source_v1 WHERE tenant_id=${tenant} AND kind='order' AND source_id IN (${orderIds[0]},${orderIds[1]}) ORDER BY source_id`;
   await tx`UPDATE public.orders SET title=title WHERE tenant_id=${tenant} AND id=ANY(ARRAY[${orderIds[0]},${orderIds[1]}]::text[])`;
   await tx`SELECT pg_sleep(0.03)`;
   const marked=await tx`SELECT source_id,source_seq::text AS seq FROM private.today_source_v1 WHERE tenant_id=${tenant} AND kind='order' AND source_id IN (${orderIds[0]},${orderIds[1]}) ORDER BY source_id`;
   expect(marked).toHaveLength(2);
   expect(marked.map(row=>({id:row.source_id,seq:BigInt(row.seq)}))).toEqual(before.map(row=>({id:row.source_id,seq:BigInt(row.seq)+BigInt(1)})));
   throw rollback;
  });}catch(error){if(error!==rollback)throw error;}
 };
 await Promise.all([probe(ids),probe([...ids].reverse())]);
 expect(await sql`SELECT to_jsonb(orders) AS row FROM public.orders orders WHERE tenant_id=${tenant} AND id IN (${ids[0]},${ids[1]}) ORDER BY id`).toEqual(original);
 expect(await sql`SELECT to_jsonb(model) AS row FROM private.today_source_v1 model WHERE tenant_id=${tenant} ORDER BY kind,source_id`).toEqual(source);
});

it('does not invert model locks between disjoint order and configuration source transactions',async()=>{
 // Rollback-only schema probe: all business rows touched by the two writers
 // are disjoint. Any cycle below belongs to the derived invalidation locks.
 const first=await readyInvoiceOrder('TEST order config lock first'),second=await readyInvoiceOrder('TEST order config lock second');
 const snapshot=async()=>({
  orders:await sql`SELECT to_jsonb(orders) AS row FROM public.orders orders WHERE tenant_id=${tenant} ORDER BY id`,
  users:await sql`SELECT to_jsonb(actor) AS row FROM public.app_users actor WHERE tenant_id=${tenant} ORDER BY id`,
  firm:await sql`SELECT to_jsonb(firm) AS row FROM public.company_settings firm WHERE tenant_id=${tenant} ORDER BY id`,
  sources:await sql`SELECT to_jsonb(source) AS row FROM private.today_source_v1 source WHERE tenant_id=${tenant} ORDER BY kind,source_id`,
  epochs:await sql`SELECT to_jsonb(epoch) AS row FROM private.today_tenant_v1 epoch WHERE tenant_id=${tenant}`,
 });
 const original=await snapshot(),rollback=Symbol('TEST rollback disjoint source locks'),application='TEST_today_lock_'+randomUUID();
 let beginSecond!:()=>void,secondStarted!:()=>void,secondFirstDone=false;
 const firstReady=new Promise<void>(resolve=>{beginSecond=resolve;}),secondReady=new Promise<void>(resolve=>{secondStarted=resolve;});
 const a=sql.begin(async tx=>{
  await tx`UPDATE public.orders SET title=title WHERE tenant_id=${tenant} AND id=${first.orderId}`;
  beginSecond();await secondReady;
  let observed=false;
  for(let attempt=0;attempt<100;attempt++){
   if(secondFirstDone){observed=true;break;}
   const state=await withPrivilegedTenantTransaction({tenantId:tenant},observer=>observer.execute<{waiting:boolean}>(sqlDrizzle`SELECT wait_event_type='Lock' AS waiting FROM pg_stat_activity WHERE application_name=${application}`));
   if(state.some(row=>row.waiting)){observed=true;break;}
   await new Promise(resolve=>setTimeout(resolve,10));
  }
  if(!observed)throw Error('TEST_SECOND_SOURCE_LOCK_NOT_OBSERVED');
  await tx`UPDATE public.company_settings SET company_name=company_name WHERE tenant_id=${tenant}`;
  throw rollback;
 });
 const b=sql.begin(async tx=>{
  await firstReady;
  await tx`SELECT set_config('application_name',${application},true)`;secondStarted();
  await tx`UPDATE public.app_users SET full_name='TEST disjoint source lock probe' WHERE tenant_id=${tenant} AND id=${full.actorId}::uuid`;
  secondFirstDone=true;
  await tx`UPDATE public.orders SET title=title WHERE tenant_id=${tenant} AND id=${second.orderId}`;
  throw rollback;
 });
 const outcomes=await Promise.allSettled([a,b]);
 try{for(const outcome of outcomes){if(outcome.status!=='rejected')throw Error('TEST_PROBE_MUST_ROLL_BACK');if(outcome.reason!==rollback)throw outcome.reason;}}
 finally{expect(await snapshot()).toEqual(original);}
});

// Existing two E1 feature-scope cases relocated byte-for-byte; no assertion removed.
it('uses the existing tenant_features.tenant key for insert/update/delete invalidation',async()=>{
 const [before]=await sql`SELECT tenant_seq::integer AS seq FROM private.today_tenant_v1 WHERE tenant_id=${tenant}`;
 await sql`INSERT INTO public.tenant_features(tenant,feature_id,enabled) VALUES(${tenant},'E01',true)`;
 expect(await sql`SELECT tenant_seq::integer AS seq FROM private.today_tenant_v1 WHERE tenant_id=${tenant}`).toEqual([{seq:before.seq+1}]);
 await sql`UPDATE public.tenant_features SET enabled=false WHERE tenant=${tenant} AND feature_id='E01'`;
 expect(await sql`SELECT tenant_seq::integer AS seq FROM private.today_tenant_v1 WHERE tenant_id=${tenant}`).toEqual([{seq:before.seq+2}]);
 await sql`DELETE FROM public.tenant_features WHERE tenant=${tenant} AND feature_id='E01'`;
 expect(await sql`SELECT tenant_seq::integer AS seq FROM private.today_tenant_v1 WHERE tenant_id=${tenant}`).toEqual([{seq:before.seq+3}]);
});

it('invalidates every already built tenant for the existing global feature_flags source and rolls all changes back',async()=>{
 const other=tenant+'-secondary';
 await sql`INSERT INTO private.today_tenant_v1(tenant_id) VALUES(${other})`;
 const before=await sql`SELECT tenant_id,tenant_seq::integer AS seq FROM private.today_tenant_v1 WHERE tenant_id IN (${tenant},${other}) ORDER BY tenant_id`;
 const flags=await sql`SELECT to_jsonb(flag) AS row FROM public.feature_flags flag ORDER BY id`;
 expect(flags.length).toBeGreaterThan(0);
 const rollback=new Error('TEST_ROLLBACK_GLOBAL_FLAG_AND_ALL_MARKS');
 await expect(sql.begin(async tx=>{
  await tx`UPDATE public.feature_flags SET enabled=enabled WHERE id=(SELECT id FROM public.feature_flags ORDER BY id LIMIT 1)`;
  expect(await tx`SELECT tenant_id,tenant_seq::integer AS seq FROM private.today_tenant_v1 WHERE tenant_id IN (${tenant},${other}) ORDER BY tenant_id`).toEqual(before.map(row=>({...row,seq:row.seq+1})));
  throw rollback;
 })).rejects.toBe(rollback);
 expect(await sql`SELECT to_jsonb(flag) AS row FROM public.feature_flags flag ORDER BY id`).toEqual(flags);
 expect(await sql`SELECT tenant_id,tenant_seq::integer AS seq FROM private.today_tenant_v1 WHERE tenant_id IN (${tenant},${other}) ORDER BY tenant_id`).toEqual(before);
});
