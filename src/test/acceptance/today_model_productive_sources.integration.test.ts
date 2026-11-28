// @vitest-environment node
// Actual productive default composition, Actions/Auth/DB/Storage in an isolated TEST tenant.
import {afterEach,expect,it,vi} from 'vitest';
type Dispatcher={getCacheForType:<T>(factory:()=>T)=>T};
const rsc=vi.hoisted(()=>({server:null as null|{__SERVER_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE:{A:Dispatcher|null}}}));
const tenant=vi.hoisted(()=>'TEST-ablauf-'+globalThis.crypto.randomUUID());
vi.mock('@/lib/tenant',()=>({KREILE_TENANT_SLUG:tenant}));
vi.mock('react',async original=>{
 const {createRequire}=await import('node:module'),{join}=await import('node:path');
 const require=createRequire(import.meta.url),server=require(join(process.cwd(),'node_modules/react/cjs/react.react-server.development.js'));
 rsc.server=server;return {...await original<typeof import('react')>(),cache:server.cache};
});
import {sql,full,withSession,withRequest,createFixture} from '../../../e2e/ablauf/replayHarness';
import {readyInvoiceOrder} from '../../../e2e/ablauf/orderFixture';
import {rebuildTodayModel,refreshTodayModel} from '@/lib/server/todayProjection';
import {getOperationalOrders} from '@/lib/server/operationalOrders';
import {resolveAuthorization} from '@/lib/server/authorization';
import {readLiveOrderCard} from '@/lib/server/orderCardRead';
import {changeOrderPromisedDueDateAction} from '@/app/actions/orders.actions';
import {getComplaints} from '@/app/actions/complaints.actions';
import {getQuoteFollowupsForTodayAction} from '@/app/actions/quotes.actions';
import {readTodayDashboard,todayDashboardListKinds} from '@/lib/server/todayDashboard';
import {withRestoredTestSource} from '../fixtures/restoredTestSource';
import {GET as rebuildRoute} from '@/app/api/heute/neuaufbau/route';
import {GET as taktRoute} from '@/app/api/takt/route';
import {NextRequest} from 'next/server';
import {proxy} from '@/proxy';
import {pruefeTaktZugriff} from '@/modules/takt/server-public';
import {berlinCalendarDay} from '@/lib/domain/workingDays';
import {readBetriebsruheInTransaction, readPageReadSettings,readCompanyLetterSettings} from '@/modules/fundament/server-public';



it('rebuilds all nine real list sources and both real order sources without any session or injected source port',async()=>{
 const pickup=await readyInvoiceOrder('TEST productive projector pickup');
 const shipping=await readyInvoiceOrder('TEST productive projector shipping','shipping');
 const before=await sql`SELECT id::text,event_type,payload FROM public.events WHERE tenant_id=${tenant} ORDER BY id`;
 const actors=await sql`SELECT id::text,role,active FROM public.app_users WHERE tenant_id=${tenant} ORDER BY id`;
 const result=await rebuildTodayModel(tenant);
 expect(result).toMatchObject({code:'OK',built:11,stale:0});
 const rows=await sql`SELECT kind,source_id,status,payload,source_seq=built_seq AS fresh,source_version FROM private.today_source_v1 WHERE tenant_id=${tenant} ORDER BY kind,source_id`;
 expect(rows).toHaveLength(11);
 expect(rows.filter(row=>row.source_id==='*').map(row=>row.kind).sort()).toEqual([...todayDashboardListKinds].sort());
 expect([...new Set(rows.map(row=>row.kind))]).toEqual([
  'quelle:accounting.geld','quelle:complaints.liste','quelle:eingang.nachrichten',
  'quelle:fundament.firma','quelle:orders.auftrag','quelle:orders.liste',
  'quelle:quotes.liste','quelle:quotes.nachfassen','quelle:takt.ausfall','quelle:tasks.aufgabe',
 ]);
 for(const row of rows)expect(row,`${row.kind}:${row.source_id}`).toMatchObject({status:'OK',fresh:true});
 const resolved=await withSession(full,()=>resolveAuthorization());if(!resolved.ok)throw Error('TEST_REAL_AUTH_REQUIRED');
 const orders=await getOperationalOrders(resolved.data,{purpose:'today'}, readBetriebsruheInTransaction);
 expect(rows.find(row=>row.kind==='quelle:orders.liste')?.payload).toEqual(JSON.parse(JSON.stringify(orders)));
 for(const order of [pickup,shipping]){
  const live=await readLiveOrderCard(resolved.data,{orderId:order.orderId});if(live.code!=='OK')throw Error('TEST_LIVE_CARD_REQUIRED');
  const {assignment,...facts}=live.data;
  const raw=assignment?((({isAssignedToCurrentUser,...value})=>{void isAssignedToCurrentUser;return value;})(assignment)):null;
  const saved=rows.find(row=>row.kind==='quelle:orders.auftrag'&&row.source_id===order.orderId)!;
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
  const [company]=await sql`SELECT status,payload FROM private.today_source_v1 WHERE tenant_id=${tenant} AND kind='quelle:fundament.firma'`;
  expect(company).toMatchObject({status:'SOURCE_INCOMPLETE',payload:{code:'VALIDATION_ERROR',missingFields:['street']}});
  expect(await sql`SELECT count(*)::integer AS count FROM private.today_source_v1 WHERE tenant_id=${tenant} AND kind<>'quelle:fundament.firma' AND status='OK'`).toEqual([{count:10}]);
 });
 expect((await rebuildTodayModel(tenant)).code).toBe('OK');
 expect(await sql`SELECT status,payload->>'code' AS code FROM private.today_source_v1 WHERE tenant_id=${tenant} AND kind='quelle:fundament.firma'`).toEqual([{status:'OK',code:'OK'}]);
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
  expect(rows).toHaveLength(11);
  for(const row of rows)expect(row).toMatchObject({status:'SOURCE_INCOMPLETE',error_code:'TODAY_PROJECTOR_ACTIVE_PROFILE_MISSING',payload:null});
  await sql`UPDATE public.app_users SET active=true WHERE tenant_id=${tenant} AND id=${readonly.actorId}::uuid`;
  expect((await rebuildTodayModel(tenant)).code).toBe('OK');
  const unavailable=await sql`SELECT status,error_code FROM private.today_source_v1 WHERE tenant_id=${tenant} AND kind='quelle:orders.auftrag' ORDER BY source_id`;
  expect(unavailable).toHaveLength(2);
  for(const row of unavailable)expect(row).toEqual({status:'SOURCE_INCOMPLETE',error_code:'TODAY_PROJECTOR_ORDER_LIST_UNAVAILABLE'});
  const denied=await sql`SELECT kind,payload FROM private.today_source_v1 WHERE tenant_id=${tenant} AND kind IN ('quelle:orders.liste','quelle:quotes.liste','quelle:tasks.aufgabe') ORDER BY kind`;
  expect(denied).toEqual([
   {kind:'quelle:orders.liste',payload:{code:'FORBIDDEN'}},
   {kind:'quelle:quotes.liste',payload:{list:{code:'FORBIDDEN',message:'Offene KVs dürfen mit dieser Rolle nicht gelesen werden.'}}},
   {kind:'quelle:tasks.aufgabe',payload:{code:'OK',tenantId:tenant,aufgaben:[],kalender:expect.objectContaining({code:'FORBIDDEN'})}},
  ]);
 });
 expect((await rebuildTodayModel(tenant)).code).toBe('OK');
 expect(await sql`SELECT count(*)::integer AS count FROM private.today_source_v1 WHERE tenant_id=${tenant} AND status='OK'`).toEqual([{count:11}]);
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
   expect(await sql`SELECT payload->'company'->>'companyName' AS name FROM private.today_source_v1 WHERE tenant_id=${tenant} AND kind='quelle:fundament.firma'`).toEqual([{name:'TEST current background sender'}]);
  }finally{internals.A=previous;}
 });
});

it('keeps a TEST-only order outside canonical Today membership without a page-triggered rebuild',async()=>{
 const order=await readyInvoiceOrder('TEST canonical excluded source');
 expect((await rebuildTodayModel(tenant)).code).toBe('OK');
 // Existing U288 fixture metadata: the canonical view excludes source=test.
 // A picked-up order is still in that view, so its membership is not invented.
 await sql`UPDATE public.orders SET source='test' WHERE tenant_id=${tenant} AND id=${order.orderId}`;
 const input={orderId:order.orderId,expectedVersion:order.version,dueDate:'2027-07-23',reason:'TEST command on a hidden TEST fixture',clientEventId:globalThis.crypto.randomUUID()};
 expect(await withSession(full,()=>changeOrderPromisedDueDateAction(input))).toMatchObject({code:'OK'});
 expect(await withSession(full,()=>changeOrderPromisedDueDateAction(JSON.parse(JSON.stringify(input))))).toMatchObject({code:'OK',replayed:true});
 const resolved=await withSession(full,()=>resolveAuthorization());if(!resolved.ok)throw Error('TEST_MEMBERSHIP_AUTH');
 const listed=await getOperationalOrders(resolved.data,{purpose:'today'}, readBetriebsruheInTransaction);
 expect(listed.some(row=>row.id===order.orderId)).toBe(false);
 expect((await refreshTodayModel(tenant)).code).toBe('OK');
 expect(await sql`SELECT status,listed,payload FROM private.today_source_v1 WHERE tenant_id=${tenant} AND kind='quelle:orders.auftrag' AND source_id=${order.orderId}`).toEqual([{status:'GONE',listed:false,payload:null}]);
 const output=vi.spyOn(console,'info');
 try{
  await withSession(full,()=>readTodayDashboard(resolved.data,getComplaints,getQuoteFollowupsForTodayAction, readBetriebsruheInTransaction),true);
  const records=output.mock.calls.filter(call=>call[0]==='[TODAY_MODEL_SHADOW]').map(call=>JSON.parse(String(call[1])));
  expect(records).toEqual([]);
  expect(await sql`SELECT status,listed,payload FROM private.today_source_v1 WHERE tenant_id=${tenant} AND kind='quelle:orders.auftrag' AND source_id=${order.orderId}`).toEqual([{status:'GONE',listed:false,payload:null}]);
 }finally{output.mockRestore();}
});

// Own unmerged route cases share the real productive TEST cohort.
const request=(headers:Record<string,string>={})=>new Request('http://127.0.0.1/api/heute/neuaufbau',{headers});
afterEach(()=>vi.unstubAllEnvs());

it('rejects anonymous/header claims and a real non-diagnostic login without computing a model',async()=>{
 vi.stubEnv('CRON_SECRET','');
 const before=await sql`SELECT to_jsonb(source) AS row FROM private.today_source_v1 source WHERE tenant_id=${tenant} ORDER BY kind,source_id`;
 const anonymous=await withRequest('',()=>rebuildRoute(request({'user-agent':'vercel-cron/1.0','x-vercel-cron':'1'})));
 expect(anonymous.status).toBe(401);expect(await anonymous.text()).toBe('');
 const reader=await createFixture(['auftraege']);
 const denied=await withSession(reader,()=>rebuildRoute(request()));
 expect(denied.status).toBe(403);expect(await denied.text()).toBe('');
 expect(await sql`SELECT to_jsonb(source) AS row FROM private.today_source_v1 source WHERE tenant_id=${tenant} ORDER BY kind,source_id`).toEqual(before);
});

it('requires the exact runtime bearer proof even for a diagnostic session and never returns the credential',async()=>{
 vi.stubEnv('CRON_SECRET','TEST-today-cron-provider-boundary');
 const operator=await createFixture(['wartung'],'developer');
 const rejectedHeaders:Record<string,string>[]=[{},{authorization:'Bearer TEST-wrong-boundary'}];
 for(const headers of rejectedHeaders){
  const arrival=await proxy(new NextRequest('http://127.0.0.1/api/takt',{headers}));
  expect(arrival.status).toBe(401);
  const denied=await withSession(operator,()=>taktRoute(new Request('http://127.0.0.1/api/takt',{headers})));
  expect(denied.status).toBe(401);expect(await denied.text()).toBe('');
 }
 const headers={authorization:'Bearer TEST-today-cron-provider-boundary'};
 const authorized=new NextRequest('http://127.0.0.1/api/takt',{headers});
 expect((await proxy(authorized)).headers.get('x-middleware-next')).toBe('1');
 expect((await proxy(new NextRequest('http://127.0.0.1/api/takt/hilfe',{headers}))).status).toBe(401);
 expect((await proxy(new NextRequest('http://127.0.0.1/api/takt',{method:'POST',headers}))).status).toBe(401);
 // Qualify the real credential without invoking the Cron's all-tenant workload.
 expect(await pruefeTaktZugriff(authorized)).toEqual({code:'CRON'});
 const hand=await withRequest('',()=>rebuildRoute(request(headers)));
 expect(hand.status).toBe(401);expect(await hand.text()).toBe('');
});

it('uses only the real existing diagnostic permission when no Cron credential is configured',async()=>{
 vi.stubEnv('CRON_SECRET','');
 const operator=await createFixture(['wartung'],'developer');
 await readyInvoiceOrder('TEST eigener Diagnoseaufbau');
 const now=Date.now(),nachZweiUhr=Date.parse(berlinCalendarDay(new Date(now))+'T06:00:00Z');
 vi.useFakeTimers({toFake:['Date']});
 try{
  vi.setSystemTime(Math.max(now,nachZweiUhr));
  const accepted=await withSession(operator,()=>rebuildRoute(request()));
  expect(accepted.status).toBe(204);expect(await accepted.text()).toBe('');
  expect(accepted.headers.get('Cache-Control')).toBe('private, no-store');
 }finally{vi.useRealTimers();}
 expect(await sql`SELECT count(*)::integer AS count FROM private.today_source_v1 WHERE tenant_id=${tenant} AND kind<>'quelle:orders.auftrag'`).toEqual([{count:9}]);
 expect(await sql`SELECT refresh_lease_until FROM private.today_tenant_v1 WHERE tenant_id=${tenant}`).toEqual([{refresh_lease_until:null}]);
});

it('PL11:36 returns an empty 409 while the actual tenant lease is occupied',async()=>{
 vi.stubEnv('CRON_SECRET','');
 const operator=await createFixture(['wartung'],'developer');
 const read=async()=>{const [row]=await sql`SELECT to_jsonb(tenant_row) AS row FROM private.today_tenant_v1 tenant_row WHERE tenant_id=${tenant}`;if(!row)throw Error('TEST_ROUTE_TENANT_REQUIRED');return row.row;};
 await withRestoredTestSource({label:'TEST full route tenant lease',read,restore:async original=>{
  const columns=Object.keys(original);if(columns.some(column=>!/^[a-z_][a-z0-9_]*$/.test(column)))throw Error('TEST_ROUTE_COLUMN_INVALID');
  const names=columns.map(column=>'"'+column+'"').join(',');
  await sql`UPDATE private.today_tenant_v1 SET (${sql.unsafe(names)})=(SELECT ${sql.unsafe(names)} FROM jsonb_populate_record(NULL::private.today_tenant_v1,${sql.json(original)}::jsonb)) WHERE tenant_id=${tenant}`;
 }},async()=>{
  await sql`UPDATE private.today_tenant_v1 SET refresh_lease_until=statement_timestamp()+interval '1 hour' WHERE tenant_id=${tenant}`;
  const before=await sql`SELECT to_jsonb(source) AS row FROM private.today_source_v1 source WHERE tenant_id=${tenant} ORDER BY kind,source_id`;
  const response=await withSession(operator,()=>rebuildRoute(request()));
  expect(response.status).toBe(409);expect(await response.text()).toBe('');
  expect(await sql`SELECT to_jsonb(source) AS row FROM private.today_source_v1 source WHERE tenant_id=${tenant} ORDER BY kind,source_id`).toEqual(before);
 });
});
