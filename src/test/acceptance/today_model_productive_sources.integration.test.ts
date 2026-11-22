// @vitest-environment node
// Actual productive default composition, Actions/Auth/DB/Storage in an isolated TEST tenant.
import {expect,it,vi} from 'vitest';
type Dispatcher={getCacheForType:<T>(factory:()=>T)=>T};
const rsc=vi.hoisted(()=>({server:null as null|{__SERVER_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE:{A:Dispatcher|null}}}));
const tenant=vi.hoisted(()=>'TEST-ablauf-'+globalThis.crypto.randomUUID());
vi.mock('@/lib/tenant',()=>({KREILE_TENANT_SLUG:tenant}));
vi.mock('react',async original=>{
 const {createRequire}=await import('node:module'),{join}=await import('node:path');
 const require=createRequire(import.meta.url),server=require(join(process.cwd(),'node_modules/react/cjs/react.react-server.development.js'));
 rsc.server=server;return {...await original<typeof import('react')>(),cache:server.cache};
});
import {sql,full,withSession,createFixture} from '../../../e2e/ablauf/replayHarness';
import {readyInvoiceOrder} from '../../../e2e/ablauf/orderFixture';
import {rebuildTodayModel,refreshTodayModel} from '@/lib/server/todayProjection';
import {getOperationalOrders} from '@/lib/server/operationalOrders';
import {resolveAuthorization} from '@/lib/server/authorization';
import {readLiveOrderCard} from '@/lib/server/orderCardRead';
import {withRestoredTestSource} from '../fixtures/restoredTestSource';
import {readPageReadSettings,readCompanyLetterSettings} from '@/modules/fundament/server-public';

it('rebuilds all eight real list sources and both real order sources without any session or injected source port',async()=>{
 const pickup=await readyInvoiceOrder('TEST productive projector pickup');
 const shipping=await readyInvoiceOrder('TEST productive projector shipping','shipping');
 const before=await sql`SELECT id::text,event_type,payload FROM public.events WHERE tenant_id=${tenant} ORDER BY id`;
 const actors=await sql`SELECT id::text,role,active FROM public.app_users WHERE tenant_id=${tenant} ORDER BY id`;
 const result=await rebuildTodayModel(tenant);
 expect(result).toMatchObject({code:'OK',built:10,stale:0});
 const rows=await sql`SELECT kind,source_id,status,payload,source_seq=built_seq AS fresh,source_version FROM private.today_source_v1 WHERE tenant_id=${tenant} ORDER BY kind,source_id`;
 expect(rows).toHaveLength(10);
 for(const row of rows)expect(row,`${row.kind}:${row.source_id}`).toMatchObject({status:'OK',fresh:true});
 const resolved=await withSession(full,()=>resolveAuthorization());if(!resolved.ok)throw Error('TEST_REAL_AUTH_REQUIRED');
 const orders=await getOperationalOrders(resolved.data,{purpose:'today'});
 expect(rows.find(row=>row.kind==='orders')?.payload).toEqual(JSON.parse(JSON.stringify(orders)));
 for(const order of [pickup,shipping]){
  const live=await readLiveOrderCard(resolved.data,{orderId:order.orderId});if(live.code!=='OK')throw Error('TEST_LIVE_CARD_REQUIRED');
  const {assignment,...facts}=live.data;
  const raw=assignment?((({isAssignedToCurrentUser,...value})=>{void isAssignedToCurrentUser;return value;})(assignment)):null;
  const saved=rows.find(row=>row.kind==='order'&&row.source_id===order.orderId)!;
  expect(saved.source_version).toBe(live.data.version);
  expect(saved.payload.liveCardStatus).toEqual(JSON.parse(JSON.stringify({code:'OK',data:{...facts,assignment:raw}})));
  expect(saved.payload.result.data.card.id).toBe(order.orderId);
 }
 expect((await refreshTodayModel(tenant))).toMatchObject({code:'OK',built:0,stale:0});
 expect(await sql`SELECT id::text,event_type,payload FROM public.events WHERE tenant_id=${tenant} ORDER BY id`).toEqual(before);
 expect(await sql`SELECT id::text,role,active FROM public.app_users WHERE tenant_id=${tenant} ORDER BY id`).toEqual(actors);
});

it('keeps the real partial company result retryable while all other known sources remain available',async()=>{
 const read=async()=>{const [source]=await sql`SELECT to_jsonb(company) AS row FROM public.company_settings company WHERE tenant_id=${tenant}`;if(!source)throw Error('TEST_COMPANY_REQUIRED');return source.row;};
 await withRestoredTestSource({label:'TEST productive projector complete company source',read,restore:async original=>{
  const columns=Object.keys(original);if(columns.some(column=>!/^[a-z_][a-z0-9_]*$/.test(column)))throw Error('TEST_COMPANY_COLUMN_INVALID');
  const names=columns.map(column=>'"'+column+'"').join(',');
  await sql`UPDATE public.company_settings SET (${sql.unsafe(names)})=(SELECT ${sql.unsafe(names)} FROM jsonb_populate_record(NULL::public.company_settings,${sql.json(original)}::jsonb)) WHERE tenant_id=${tenant} AND id=${String(original.id)}`;
 }},async()=>{
  await sql`UPDATE public.company_settings SET street='' WHERE tenant_id=${tenant}`;
  expect((await refreshTodayModel(tenant)).code).toBe('OK');
  const [company]=await sql`SELECT status,payload FROM private.today_source_v1 WHERE tenant_id=${tenant} AND kind='company'`;
  expect(company).toMatchObject({status:'SOURCE_INCOMPLETE',payload:{code:'VALIDATION_ERROR',missingFields:['street']}});
  expect(await sql`SELECT count(*)::integer AS count FROM private.today_source_v1 WHERE tenant_id=${tenant} AND kind<>'company' AND status='OK'`).toEqual([{count:9}]);
 });
 expect((await refreshTodayModel(tenant)).code).toBe('OK');
 expect(await sql`SELECT status,payload->>'code' AS code FROM private.today_source_v1 WHERE tenant_id=${tenant} AND kind='company'`).toEqual([{status:'OK',code:'OK'}]);
});

it('PL08:59 refuses to manufacture payment or task facts when no actual active profile remains',async()=>{
 const readonly=await createFixture([],'readonly');
 const read=()=>sql`SELECT to_jsonb(actor) AS row FROM public.app_users actor WHERE tenant_id=${tenant} ORDER BY id`;
 await withRestoredTestSource({label:'TEST productive projector complete active profiles',read,restore:async originals=>{
  for(const {row} of originals){
   const columns=Object.keys(row);if(columns.some(column=>!/^[a-z_][a-z0-9_]*$/.test(column)))throw Error('TEST_PROFILE_COLUMN_INVALID');
   const names=columns.map(column=>'"'+column+'"').join(',');
   await sql`UPDATE public.app_users SET (${sql.unsafe(names)})=(SELECT ${sql.unsafe(names)} FROM jsonb_populate_record(NULL::public.app_users,${sql.json(row)}::jsonb)) WHERE tenant_id=${tenant} AND id=${String(row.id)}::uuid`;
  }
 }},async()=>{
  // Explicit isolated TEST source boundary; no alternate identity or auth path.
  await sql`UPDATE public.app_users SET active=false WHERE tenant_id=${tenant}`;
  expect((await refreshTodayModel(tenant)).code).toBe('OK');
  const rows=await sql`SELECT kind,status,error_code,payload FROM private.today_source_v1 WHERE tenant_id=${tenant} ORDER BY kind,source_id`;
  expect(rows).toHaveLength(10);
  for(const row of rows)expect(row).toMatchObject({status:'SOURCE_INCOMPLETE',error_code:'TODAY_PROJECTOR_ACTIVE_PROFILE_MISSING',payload:null});
  await sql`UPDATE public.app_users SET active=true WHERE tenant_id=${tenant} AND id=${readonly.actorId}::uuid`;
  expect((await refreshTodayModel(tenant)).code).toBe('OK');
  const denied=await sql`SELECT kind,payload FROM private.today_source_v1 WHERE tenant_id=${tenant} AND kind IN ('orders','quotes','tasks') ORDER BY kind`;
  expect(denied).toEqual([
   {kind:'orders',payload:{code:'FORBIDDEN'}},
   {kind:'quotes',payload:{list:{code:'FORBIDDEN',message:'Offene KVs dürfen mit dieser Rolle nicht gelesen werden.'}}},
   {kind:'tasks',payload:expect.objectContaining({code:'FORBIDDEN'})},
  ]);
 });
 expect((await refreshTodayModel(tenant)).code).toBe('OK');
 expect(await sql`SELECT count(*)::integer AS count FROM private.today_source_v1 WHERE tenant_id=${tenant} AND status='OK'`).toEqual([{count:10}]);
});

it('uses fresh background firm settings after the real RSC cache already read their previous values',async()=>{
 await readyInvoiceOrder('TEST background versus foreground cache');
 expect((await rebuildTodayModel(tenant)).code).toBe('OK');
 const read=async()=>{const [source]=await sql`SELECT to_jsonb(company) AS row FROM public.company_settings company WHERE tenant_id=${tenant}`;if(!source)throw Error('TEST_COMPANY_REQUIRED');return source.row;};
 await withRestoredTestSource({label:'TEST complete background firm settings',read,restore:async original=>{
  const columns=Object.keys(original);if(columns.some(column=>!/^[a-z_][a-z0-9_]*$/.test(column)))throw Error('TEST_COMPANY_COLUMN_INVALID');
  const names=columns.map(column=>'"'+column+'"').join(',');
  await sql`UPDATE public.company_settings SET (${sql.unsafe(names)})=(SELECT ${sql.unsafe(names)} FROM jsonb_populate_record(NULL::public.company_settings,${sql.json(original)}::jsonb)) WHERE tenant_id=${tenant} AND id=${String(original.id)}`;
 }},async()=>{
  if(!rsc.server)throw Error('TEST_REAL_REACT_CACHE_REQUIRED');
  // Explicit synthetic RSC dispatcher, exactly as the existing M2 cache contract;
  // React's cache, firm SQL, actual model writer and invalidation remain real.
  const internals=rsc.server.__SERVER_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE,previous=internals.A;
  const cache=new Map<()=>unknown,unknown>();
  internals.A={getCacheForType<T>(factory:()=>T):T{if(!cache.has(factory))cache.set(factory,factory());return cache.get(factory) as T;}};
  try{
   await readPageReadSettings({tenantId:tenant});
   const prior=await readCompanyLetterSettings({tenantId:tenant,canRead:true});expect(prior.code).toBe('OK');
   await sql`UPDATE public.company_settings SET company_name='TEST current background sender',today_refresh_batch_limit=1 WHERE tenant_id=${tenant}`;
   expect(await refreshTodayModel(tenant)).toMatchObject({code:'OK',built:1,stale:0});
   expect(await sql`SELECT payload->'company'->>'companyName' AS name FROM private.today_source_v1 WHERE tenant_id=${tenant} AND kind='company'`).toEqual([{name:'TEST current background sender'}]);
  }finally{internals.A=previous;}
 });
});
