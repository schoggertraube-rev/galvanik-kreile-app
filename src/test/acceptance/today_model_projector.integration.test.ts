// @vitest-environment node
// E-B worker contract with actual reader/Auth/DB/Storage results in an isolated TEST tenant.
// The unresolved App composition is NOT simulated as complete: unrelated list
// ports explicitly return TEST_PORT_NOT_COMPOSED rather than invented empty data.
import {randomUUID} from 'node:crypto';
import {beforeAll,expect,it,vi,expectTypeOf} from 'vitest';
const tenant=vi.hoisted(()=>'TEST-ablauf-'+globalThis.crypto.randomUUID());
vi.mock('@/lib/tenant',()=>({KREILE_TENANT_SLUG:tenant}));
import {sql,full,withSession,createFixture} from '../../../e2e/ablauf/replayHarness';
import {customerFixture,intakeOrderFixture,readyInvoiceOrder} from '../../../e2e/ablauf/orderFixture';
import {resolveAuthorization,type AuthorizationSnapshot} from '@/lib/server/authorization';
import {readLiveOrderCard,readTodayOrderCards} from '@/lib/server/orderCardRead';
import {readOrderEvidenceBatch} from '@/lib/server/evidenceRead';
import {getOperationalOrders} from '@/lib/server/operationalOrders';
import {readTodayReadSettings} from '@/modules/fundament/server-public';
import {changeOrderPromisedDueDateAction} from '@/app/actions/orders.actions';
import {refreshTodayModel,rebuildTodayModel,type ProjectorAuthorization} from '@/lib/server/todayProjection';
import {listeTodayMandanten} from '@/lib/server/todayProjectionSchedule';
import {APP_ROLES,canReadQuoteFollowups,canTransportInvoiceDocument,normalizeAccessAreasForRole} from '@/lib/auth/authorizationContract';
import {authorizationReadContext,canReadQuoteFollowupsForRead,type AuthorizedReadContext} from '@/lib/server/authorizationReadContext';
import {readInvoiceShippingConsequences,readInvoiceShippingConsequencesBatch} from '@/lib/server/commands/immutableInvoiceCommand';
import {readInvoiceVat} from '@/modules/accounting/server-public';
import {readShippingSettingsInTransaction} from '@/modules/fundament/server-public';
import {withRestoredTestSource} from '../fixtures/restoredTestSource';
import {withPageReadBudget} from '@/db/readBudget';
import {readTodayModelInTransaction} from '@/lib/server/todayDashboard';
import {readTodayCalendar} from '@/lib/today/todayDashboardPolicy';
import {withPrivilegedTenantTransaction} from '@/lib/server/privilegedDb';
import {sql as query} from 'drizzle-orm';
type TodayProjectionPorts=NonNullable<Parameters<typeof refreshTodayModel>[1]>;
type TodayProjectionResult=Awaited<ReturnType<TodayProjectionPorts['readSources']>> extends ReadonlyMap<string,infer Result>?Result:never;
const todaySourceKey=(key:Parameters<TodayProjectionPorts['readSources']>[1][number])=>key.kind+':'+key.sourceId;

let orderId:string;
async function auth(){const result=await withSession(full,()=>resolveAuthorization());if(!result.ok)throw Error('TEST_REAL_AUTH_REQUIRED');return result.data;}
const ports:TodayProjectionPorts={
 readSettings:readTodayReadSettings,
 listOrderIds:async()=>{const actor=await auth();return (await getOperationalOrders(actor,{purpose:'today'})).map(row=>row.id);},
 readSources:async(capability,keys)=>{
  expect(capability.tenantId).toBe(tenant);expect(capability).not.toHaveProperty('userId');
  const actor=await auth(),results=new Map<string,TodayProjectionResult>();
  for(const key of keys){
   if(key.kind==='order'){
    const source=await readLiveOrderCard(actor,{orderId:key.sourceId});
    if(source.code==='OK')results.set(todaySourceKey(key),{code:'OK',payload:{card:source.data},sourceVersion:source.data.version,listed:true});
    else results.set(todaySourceKey(key),{code:'SOURCE_INCOMPLETE',errorCode:'TEST_REAL_CARD_SOURCE_INCOMPLETE'});
   }else if(key.kind==='orders')results.set(todaySourceKey(key),{code:'OK',payload:await getOperationalOrders(actor,{purpose:'today'})});
   else results.set(todaySourceKey(key),{code:'SOURCE_INCOMPLETE',errorCode:'TEST_PORT_NOT_COMPOSED'});
  }
  return results;
 },
};
beforeAll(async()=>{orderId=(await readyInvoiceOrder('TEST Today worker source')).orderId;});

it('liest den TEST-Mandanten aus der einen geordneten Today-Tenant-Quelle',async()=>{
 const mandanten=await listeTodayMandanten();
 expect(mandanten).toContain(tenant);
 const rows=await sql`SELECT tenant_id FROM private.today_tenant_v1 ORDER BY tenant_id`;
 expect(mandanten).toEqual(rows.map(row=>row.tenant_id));
});

it('cancels a stalled native projector source before the platform runtime limit without publishing a false result',async()=>{
 const actor=await auth();
 const current=await withSession(full,()=>readLiveOrderCard(actor,{orderId}));
 if(current.code!=='OK')throw Error('TEST_MODEL_CARD_REQUIRED');
 const changed=await withSession(full,()=>changeOrderPromisedDueDateAction({orderId,expectedVersion:current.data.version,dueDate:'2027-09-02',reason:'TEST stalled native projector',clientEventId:randomUUID()}));
 expect(changed.code).toBe('OK');
 const started=Date.now();
 try{
  await expect(withPageReadBudget(()=>refreshTodayModel(tenant,{...ports,readSources:async()=>{
   await withPrivilegedTenantTransaction({tenantId:tenant},tx=>tx.execute(query`SELECT pg_sleep(1)`));
   throw Error('TEST_STALLED_SOURCE_NOT_CANCELLED');
  }}),200)).rejects.toThrow();
  expect(Date.now()-started).toBeLessThan(3000);
  expect(await sql`SELECT source_seq>built_seq AS pending FROM private.today_source_v1 WHERE tenant_id=${tenant} AND kind='order' AND source_id=${orderId}`).toEqual([{pending:true}]);
 }finally{
  // Restore only this isolated TEST tenant after a deliberately interrupted lease.
  await sql`UPDATE private.today_tenant_v1 SET refresh_lease_until=NULL WHERE tenant_id=${tenant}`;
 }
});

it('continues a bounded rebuild on the same tenant generation without rebuilding completed rows',async()=>{
 const customerId=await customerFixture('TEST resumable model');
 for(let index=0;index<7;index++)await intakeOrderFixture('TEST resumable model '+String(index),customerId);
 let groups=0;
 await expect(withPageReadBudget(()=>rebuildTodayModel(tenant,{...ports,readSources:async(...args)=>{
  groups++;
  if(groups===2)await withPrivilegedTenantTransaction({tenantId:tenant},tx=>tx.execute(query`SELECT pg_sleep(3)`));
  return ports.readSources(...args);
 }}),1800)).rejects.toThrow();
 const completed=await sql`SELECT kind,source_id,source_seq::text AS seq FROM private.today_source_v1
  WHERE tenant_id=${tenant} AND built_seq=source_seq AND built_tenant_seq=(SELECT tenant_seq FROM private.today_tenant_v1 WHERE tenant_id=${tenant})`;
 expect(completed.length).toBeGreaterThan(0);
 expect(await sql`SELECT refresh_lease_until FROM private.today_tenant_v1 WHERE tenant_id=${tenant}`).toEqual([{refresh_lease_until:null}]);
 const next=await rebuildTodayModel(tenant,ports);
 expect(next.code).toBe('OK');
 for(const row of completed)expect(await sql`SELECT source_seq::text AS seq FROM private.today_source_v1 WHERE tenant_id=${tenant} AND kind=${row.kind} AND source_id=${row.source_id}`).toEqual([{seq:row.seq}]);
 const day=readTodayCalendar(new Date()).today;
 const model=await withPrivilegedTenantTransaction({tenantId:tenant},tx=>readTodayModelInTransaction(tx,{tenantId:tenant},day));
 expect(model.needsRebuild).toBe(false);
});

it('PL11:36 renews a real short lease across a longer native source read and retains single ownership',async()=>{
 const read=async()=>{const [company]=await sql`SELECT to_jsonb(company) AS row FROM public.company_settings company WHERE tenant_id=${tenant}`;if(!company)throw Error('TEST_LEASE_SETTINGS_REQUIRED');return company.row;};
 await withRestoredTestSource({label:'TEST full short lease settings',read,restore:async original=>{
  const columns=Object.keys(original);if(columns.some(column=>!/^[a-z_][a-z0-9_]*$/.test(column)))throw Error('TEST_LEASE_COLUMN_INVALID');
  const names=columns.map(column=>'"'+column+'"').join(',');
  await sql`UPDATE public.company_settings SET (${sql.unsafe(names)})=(SELECT ${sql.unsafe(names)} FROM jsonb_populate_record(NULL::public.company_settings,${sql.json(original)}::jsonb)) WHERE tenant_id=${tenant} AND id=${String(original.id)}`;
 }},async()=>{
  await sql`UPDATE public.company_settings SET today_refresh_lease_seconds=1 WHERE tenant_id=${tenant}`;
  let delayed=false;
  const result=await rebuildTodayModel(tenant,{...ports,readSources:async(...args)=>{
   if(!delayed){
    delayed=true;
    const [initial]=await sql`SELECT refresh_lease_until::text AS token FROM private.today_tenant_v1 WHERE tenant_id=${tenant}`;
    await sql`SELECT pg_sleep(1.4)`;
    expect(await sql`SELECT refresh_lease_until>${initial.token}::timestamptz AS renewed,refresh_lease_until>statement_timestamp() AS valid FROM private.today_tenant_v1 WHERE tenant_id=${tenant}`).toEqual([{renewed:true,valid:true}]);
    expect(await refreshTodayModel(tenant,ports)).toEqual({code:'BUSY',built:0,stale:0});
   }
   return ports.readSources(...args);
  }});
  expect(result.code).toBe('OK');expect(result.built).toBeGreaterThan(0);expect(result.stale).toBe(0);
  expect(await sql`SELECT refresh_lease_until FROM private.today_tenant_v1 WHERE tenant_id=${tenant}`).toEqual([{refresh_lease_until:null}]);
 });
});

it('PL11:36 skips incomplete rows without a changed source key while changed sources still refresh',async()=>{
 expect((await rebuildTodayModel(tenant,ports)).code).toBe('OK');
 const incomplete=await sql`SELECT kind||':'||source_id AS key FROM private.today_source_v1 WHERE tenant_id=${tenant} AND status='SOURCE_INCOMPLETE'`;
 expect(incomplete.length).toBeGreaterThan(0);
 const visits:string[]=[];
 const counted:TodayProjectionPorts={...ports,readSources:async(...args)=>{visits.push(...args[1].map(todaySourceKey));return ports.readSources(...args);}};
 expect(await refreshTodayModel(tenant,counted)).toMatchObject({code:'OK',built:0,stale:0});
 expect(visits).toEqual([]);
 const source=await readLiveOrderCard(await auth(),{orderId});if(source.code!=='OK')throw Error('TEST_KNOWN_CARD_REQUIRED');
 expect(await withSession(full,()=>changeOrderPromisedDueDateAction({orderId,expectedVersion:source.data.version,dueDate:'2027-08-02',reason:'TEST incomplete rows stay for rebuild',clientEventId:randomUUID()}))).toMatchObject({code:'OK'});
 const unchanged=await sql`SELECT kind||':'||source_id AS key FROM private.today_source_v1
  WHERE tenant_id=${tenant} AND status='SOURCE_INCOMPLETE' AND source_seq=built_seq`;
 expect(unchanged.length).toBeGreaterThan(0);
 expect((await refreshTodayModel(tenant,counted)).code).toBe('OK');
 expect(visits).toContain('order:'+orderId);
 expect(visits.some(key=>unchanged.some(row=>row.key===key))).toBe(false);
 visits.length=0;
 expect((await rebuildTodayModel(tenant,counted)).code).toBe('OK');
 expect(visits).toEqual(expect.arrayContaining(incomplete.map(row=>row.key)));
});

it('PL11:36 locks the tenant before source keys when rebuild and a real command overlap in both start orders',async()=>{
 const waitFor=async(kind:'writer'|'projector')=>{
  for(let attempt=0;attempt<100;attempt++){
   const rows=await sql`SELECT activity.pid,pg_blocking_pids(activity.pid) AS blockers,
    EXISTS(SELECT 1 FROM pg_locks held WHERE held.pid=activity.pid AND held.locktype='tuple' AND held.granted AND held.relation='private.today_tenant_v1'::regclass) AS "waitingOnTenant"
    FROM pg_stat_activity activity
    WHERE wait_event_type='Lock' AND pid<>pg_backend_pid() AND
     CASE WHEN ${kind}='writer' THEN query LIKE '%FROM private.update_order_promised_due_date_v1%'
      ELSE query LIKE 'UPDATE private.today_source_v1 source%' OR query LIKE 'SELECT 1 FROM private.today_tenant_v1%' OR query LIKE 'SELECT source.kind,%' END`;
   if(rows.length===1)return rows[0] as {pid:number;blockers:number[];waitingOnTenant:boolean};
   await new Promise(resolve=>setTimeout(resolve,10));
  }
  throw Error('TEST_ACTUAL_LOCK_NOT_OBSERVED_'+kind);
 };
 for(const writerFirst of [true,false]){
  const order=await readyInvoiceOrder('TEST projector writer '+String(writerFirst));
  expect((await rebuildTodayModel(tenant,ports)).code).toBe('OK');
  await sql`UPDATE private.today_source_v1 SET built_at=statement_timestamp() WHERE tenant_id=${tenant}`;
  await sql`UPDATE private.today_source_v1 SET built_at='2000-01-01'::timestamptz WHERE tenant_id=${tenant} AND kind='order' AND source_id=${order.orderId}`;
  await sql`UPDATE private.today_source_v1 SET built_at='2001-01-01'::timestamptz WHERE tenant_id=${tenant} AND kind='money' AND source_id='*'`;
  let entered!:()=>void,publish!:()=>void,probeReady!:()=>void,releaseProbe!:()=>void;
  const reading=new Promise<void>(resolve=>{entered=resolve;}),gate=new Promise<void>(resolve=>{publish=resolve;});
  const locked=new Promise<void>(resolve=>{probeReady=resolve;}),unlock=new Promise<void>(resolve=>{releaseProbe=resolve;});
  const build=rebuildTodayModel(tenant,{...ports,readSources:async(...args)=>{
   const values=await ports.readSources(...args);
   if(args[1].some(key=>key.kind==='order'&&key.sourceId===order.orderId)){entered();await gate;}
   return values;
  }});
  await reading;
  let probePid=0;
  // Lock-only TEST probe; no business value or invalidation rule is changed.
  const probe=sql.begin(async tx=>{
   const [backend]=await tx`SELECT pg_backend_pid() AS pid`;probePid=backend.pid;
   await tx`SELECT 1 FROM private.today_source_v1 WHERE tenant_id=${tenant} AND kind='money' AND source_id='*' FOR UPDATE`;
   probeReady();await unlock;
  });
  await locked;
  const input={orderId:order.orderId,expectedVersion:order.version,dueDate:'2027-07-22',reason:'TEST actual projector lock order',clientEventId:randomUUID()};
  let command:ReturnType<typeof changeOrderPromisedDueDateAction>|undefined;
  try{
   if(writerFirst){
    command=withSession(full,()=>changeOrderPromisedDueDateAction(input));
    const writer=await waitFor('writer');publish();
    const projector=await waitFor('projector');
    expect(projector.waitingOnTenant).toBe(true);
    expect(projector.blockers).toContain(writer.pid);
    expect(projector.blockers).not.toContain(probePid);
   }else{
    publish();const projector=await waitFor('projector');
    command=withSession(full,()=>changeOrderPromisedDueDateAction(input));
    const writer=await waitFor('writer');
    expect(writer.waitingOnTenant).toBe(true);
    expect(writer.blockers).toContain(projector.pid);
    expect(writer.blockers).not.toContain(probePid);
   }
   releaseProbe();
   const [projected,written]=await Promise.all([build,command]);
   expect(projected.code).toBe('OK');expect(written.code).toBe('OK');
   expect(await sql`SELECT count(*)::integer AS count FROM public.events WHERE tenant_id=${tenant} AND client_event_id=${input.clientEventId} AND event_type='ORDER_PROMISED_DUE_DATE_CHANGED_V1'`).toEqual([{count:1}]);
   const [state]=await sql`SELECT source.source_seq>source.built_seq AS stale,source.source_version=orders.version AS current FROM private.today_source_v1 source JOIN public.orders orders ON orders.tenant_id=source.tenant_id AND orders.id=source.source_id WHERE source.tenant_id=${tenant} AND source.kind='order' AND source.source_id=${order.orderId}`;
   expect(state.stale||state.current).toBe(true);
   expect(await sql`SELECT refresh_lease_until FROM private.today_tenant_v1 WHERE tenant_id=${tenant}`).toEqual([{refresh_lease_until:null}]);
  }finally{publish();releaseProbe();await Promise.allSettled([build,probe,...(command?[command]:[])]);}
 }
});

it('uses read-only union capabilities and publishes actual card versions with count-only refresh diagnostics',async()=>{
 expectTypeOf<ProjectorAuthorization>().not.toExtend<AuthorizationSnapshot>();
 const before=await sql`SELECT id::text FROM public.app_users WHERE tenant_id=${tenant} ORDER BY id`;
 const observed:ProjectorAuthorization[]=[];
 const output=vi.spyOn(console,'info');
 try{
  const built=await rebuildTodayModel(tenant,{...ports,readSources:async(capability,keys)=>{observed.push(capability);return ports.readSources(capability,keys);}});expect(built.code).toBe('OK');expect(built.built).toBeGreaterThanOrEqual(2);
  expect(observed[0].areas).toEqual(expect.arrayContaining(['auftraege','preise','zahlungen']));
  const [source]=await sql`SELECT payload,source_version,status,source_seq=built_seq AS fresh,build_ms FROM private.today_source_v1 WHERE tenant_id=${tenant} AND kind='order' AND source_id=${orderId}`;
  const live=await readLiveOrderCard(await auth(),{orderId});expect(live.code).toBe('OK');if(live.code!=='OK')throw Error('TEST_REAL_CARD_REQUIRED');
  expect(source).toMatchObject({payload:JSON.parse(JSON.stringify({card:live.data})),source_version:live.data.version,status:'OK',fresh:true,build_ms:expect.any(Number)});
  const phases=output.mock.calls.filter(call=>call[0]==='[PAGE_READ_PHASE]').map(call=>JSON.parse(String(call[1]))).filter(row=>row.phase==='today.refresh');
  expect(phases.at(-1).counts).toEqual({rows:built.built+built.stale,built:built.built,stale:built.stale});
  expect(JSON.stringify(phases)).not.toContain(orderId);
 }finally{output.mockRestore();}
 expect(await sql`SELECT id::text FROM public.app_users WHERE tenant_id=${tenant} ORDER BY id`).toEqual(before);
});

it('allows only one live lease and releases it after the actual reader completes',async()=>{
 await sql`UPDATE public.orders SET title=title WHERE tenant_id=${tenant} AND id=${orderId}`;
 let entered!:()=>void,release!:()=>void;const started=new Promise<void>(resolve=>{entered=resolve;}),gate=new Promise<void>(resolve=>{release=resolve;});
 const first=refreshTodayModel(tenant,{...ports,readSources:async(...args)=>{entered();await gate;return ports.readSources(...args);}});
 try{await started;expect(await refreshTodayModel(tenant,ports)).toEqual({code:'BUSY',built:0,stale:0});}
 finally{release();await first;}
 expect(await sql`SELECT refresh_lease_until FROM private.today_tenant_v1 WHERE tenant_id=${tenant}`).toEqual([{refresh_lease_until:null}]);
});

it('does not publish an old card when a real promised-date command commits between reading and publishing',async()=>{
 let changed=false;
 // Schema-only mark, without changing any business value, requests this row.
 await sql`UPDATE public.orders SET title=title WHERE tenant_id=${tenant} AND id=${orderId}`;
 const raced=await refreshTodayModel(tenant,{...ports,readSources:async(capability,keys)=>{
  const values=await ports.readSources(capability,keys);
  const original=values.get('order:'+orderId);
  if(!changed&&original?.code==='OK'){
   changed=true;
   const result=await withSession(full,()=>changeOrderPromisedDueDateAction({orderId,expectedVersion:original.sourceVersion!,dueDate:'2027-06-15',reason:'TEST writer races projection',clientEventId:randomUUID()}));
   expect(result).toMatchObject({code:'OK'});
  }
  return values;
 }});
 expect(changed).toBe(true);expect(raced.stale).toBeGreaterThanOrEqual(1);
 expect(await sql`SELECT source_seq>built_seq AS stale FROM private.today_source_v1 WHERE tenant_id=${tenant} AND kind='order' AND source_id=${orderId}`).toEqual([{stale:true}]);
 expect((await refreshTodayModel(tenant,ports)).code).toBe('OK');
 expect(await sql`SELECT source.source_seq=source.built_seq AND source.source_version=orders.version AS fresh FROM private.today_source_v1 source JOIN public.orders orders ON orders.tenant_id=source.tenant_id AND orders.id=source.source_id WHERE source.tenant_id=${tenant} AND source.kind='order' AND source.source_id=${orderId}`).toEqual([{fresh:true}]);
});

it('contains a real SQL group failure, splits it and retains the other actual reader result',async()=>{
 await sql`UPDATE public.orders SET title=title WHERE tenant_id=${tenant} AND id=${orderId}`;
 const result=await rebuildTodayModel(tenant,{...ports,readSources:async(capability,keys)=>{
  if(keys.some(key=>key.kind==='money'))await sql`SELECT 1/0 AS test_strict_source_failure`;
  return ports.readSources(capability,keys);
 }});
 expect(result.code).toBe('OK');
 expect(await sql`SELECT status,error_code FROM private.today_source_v1 WHERE tenant_id=${tenant} AND kind='money'`).toEqual([{status:'SOURCE_INCOMPLETE',error_code:'TODAY_PROJECTOR_SOURCE_FAILED'}]);
 expect(await sql`SELECT status,source_seq=built_seq AS fresh FROM private.today_source_v1 WHERE tenant_id=${tenant} AND kind='order' AND source_id=${orderId}`).toEqual([{status:'OK',fresh:true}]);
});

it('does not let an expired worker publish or clear the replacement worker lease',async()=>{
 await sql`UPDATE public.orders SET title=title WHERE tenant_id=${tenant} AND id=${orderId}`;
 let firstEntered!:()=>void,firstRelease!:()=>void,secondEntered!:()=>void,secondRelease!:()=>void;
 const firstStarted=new Promise<void>(resolve=>{firstEntered=resolve;}),firstGate=new Promise<void>(resolve=>{firstRelease=resolve;});
 const secondStarted=new Promise<void>(resolve=>{secondEntered=resolve;}),secondGate=new Promise<void>(resolve=>{secondRelease=resolve;});
 const first=refreshTodayModel(tenant,{...ports,readSources:async(...args)=>{firstEntered();await firstGate;return ports.readSources(...args);}});
 let second:ReturnType<typeof refreshTodayModel>|undefined;
 try{
  await firstStarted;
  await sql`UPDATE private.today_tenant_v1 SET refresh_lease_until=statement_timestamp()-interval '1 second' WHERE tenant_id=${tenant}`;
  second=refreshTodayModel(tenant,{...ports,readSources:async(...args)=>{secondEntered();await secondGate;return ports.readSources(...args);}});
  await secondStarted;firstRelease();expect((await first).built).toBe(0);
  expect(await sql`SELECT refresh_lease_until IS NOT NULL AS replacement_alive FROM private.today_tenant_v1 WHERE tenant_id=${tenant}`).toEqual([{replacement_alive:true}]);
 }finally{firstRelease();secondRelease();await first;if(second)await second;}
 expect(await sql`SELECT refresh_lease_until FROM private.today_tenant_v1 WHERE tenant_id=${tenant}`).toEqual([{refresh_lease_until:null}]);
});

it('splits a failed set-based SQL publish and marks only the affected source incomplete',async()=>{
 const guard='test_today_publish_'+randomUUID().replaceAll('-','');
 await sql`UPDATE public.orders SET title=title WHERE tenant_id=${tenant} AND id=${orderId}`;
 try{
  // TEST-only stricter cache write fault; no business guard or reader is bypassed.
  await sql.unsafe(`CREATE FUNCTION private.${guard}() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.tenant_id='${tenant}' AND NEW.kind='orders' AND NEW.status='OK' THEN RAISE EXCEPTION 'TEST strict source publish fault' USING ERRCODE='22000'; END IF; RETURN NEW; END $$`);
  await sql.unsafe(`CREATE TRIGGER ${guard} BEFORE UPDATE ON private.today_source_v1 FOR EACH ROW EXECUTE FUNCTION private.${guard}()`);
  expect((await refreshTodayModel(tenant,ports)).code).toBe('OK');
  expect(await sql`SELECT status,error_code FROM private.today_source_v1 WHERE tenant_id=${tenant} AND kind='orders'`).toEqual([{status:'SOURCE_INCOMPLETE',error_code:'TODAY_PROJECTOR_ROW_FAILED'}]);
  expect(await sql`SELECT status,source_seq=built_seq AS fresh FROM private.today_source_v1 WHERE tenant_id=${tenant} AND kind='order' AND source_id=${orderId}`).toEqual([{status:'OK',fresh:true}]);
 }finally{await sql.unsafe(`DROP TRIGGER IF EXISTS ${guard} ON private.today_source_v1`);await sql.unsafe(`DROP FUNCTION IF EXISTS private.${guard}()`);}
 expect((await rebuildTodayModel(tenant,ports)).code).toBe('OK');
 expect(await sql`SELECT status,error_code FROM private.today_source_v1 WHERE tenant_id=${tenant} AND kind='orders'`).toEqual([{status:'OK',error_code:null}]);
});

it('reads the persisted single-row batch limit and skips incomplete rows until rebuild',async()=>{
 expect((await rebuildTodayModel(tenant,ports)).code).toBe('OK');
 // Explicit schema configuration probe in this isolated TEST tenant.
 await sql`UPDATE public.company_settings SET today_refresh_batch_limit=1 WHERE tenant_id=${tenant}`;
 expect((await readTodayReadSettings({tenantId:tenant})).todayRefreshBatchLimit).toBe(1);
 const visits:string[]=[];
 const bounded:TodayProjectionPorts={...ports,readSources:async(capability,keys)=>{
  expect(keys).toHaveLength(1);visits.push(todaySourceKey(keys[0]));return ports.readSources(capability,keys);
 }};
 const [pending]=await sql`SELECT count(*)::integer AS count FROM private.today_source_v1 WHERE tenant_id=${tenant} AND status<>'SOURCE_INCOMPLETE'`;
 expect(pending.count).toBeGreaterThan(1);
 for(let attempt=0;attempt<pending.count;attempt++)expect((await refreshTodayModel(tenant,bounded)).code).toBe('OK');
 expect(new Set(visits).size).toBe(pending.count);
 expect(await refreshTodayModel(tenant,bounded)).toMatchObject({code:'OK',built:0,stale:0});
 expect(visits).toHaveLength(pending.count);
 expect(await sql`SELECT status,source_seq=built_seq AS fresh FROM private.today_source_v1 WHERE tenant_id=${tenant} AND kind='order' AND source_id=${orderId}`).toEqual([{status:'OK',fresh:true}]);
});


it('feeds the identical Today card/list kernels with the real actor-free capability and keeps permission denial',async()=>{
 const actor=await auth(),expected=(await readTodayOrderCards(actor,[orderId])).get(orderId);
 expect(expected?.code).toBe('OK');if(expected?.code!=='OK')throw Error('TEST_REAL_TODAY_CARD_REQUIRED');
 const before=await sql`SELECT id::text FROM public.app_users WHERE tenant_id=${tenant} ORDER BY id`;
 let actualCapability:ProjectorAuthorization|undefined;
 const readOnly:TodayProjectionPorts={
  readSettings:readTodayReadSettings,
  listOrderIds:async capability=>(await getOperationalOrders(capability,{purpose:'today'})).map(row=>row.id),
  readSources:async(capability,keys)=>{
   actualCapability=capability;
   const cards=await readTodayOrderCards(capability,keys.filter(key=>key.kind==='order').map(key=>key.sourceId));
   const results=new Map<string,TodayProjectionResult>();
   for(const key of keys){
    if(key.kind==='orders')results.set(todaySourceKey(key),{code:'OK',payload:await getOperationalOrders(capability,{purpose:'today'})});
    else if(key.kind==='order'){
     const card=cards.get(key.sourceId);
     if(card?.code==='OK')results.set(todaySourceKey(key),{code:'OK',payload:{card:card.data},sourceVersion:card.data.version,listed:true});
     else results.set(todaySourceKey(key),{code:'SOURCE_INCOMPLETE',errorCode:'TEST_REAL_TODAY_CARD_INCOMPLETE'});
    }else results.set(todaySourceKey(key),{code:'SOURCE_INCOMPLETE',errorCode:'TEST_PORT_NOT_COMPOSED'});
   }
   return results;
  },
 };
 expect((await rebuildTodayModel(tenant,readOnly)).code).toBe('OK');
 expect(actualCapability).toBeDefined();if(!actualCapability)throw Error('TEST_PROJECTOR_CAPABILITY_REQUIRED');
 expect(actualCapability).not.toHaveProperty('userId');expect(actualCapability).not.toHaveProperty('role');expect(actualCapability).not.toHaveProperty('active');
 const [saved]=await sql`SELECT payload,source_version,status,source_seq=built_seq AS fresh FROM private.today_source_v1 WHERE tenant_id=${tenant} AND kind='order' AND source_id=${orderId}`;
 expect(saved).toEqual({payload:JSON.parse(JSON.stringify({card:expected.data})),source_version:expected.data.version,status:'OK',fresh:true});
 const denied=await readTodayOrderCards({...actualCapability,permissions:[]},[orderId]);
 expect(denied.get(orderId)).toMatchObject({code:'FORBIDDEN'});
 expect(await sql`SELECT id::text FROM public.app_users WHERE tenant_id=${tenant} ORDER BY id`).toEqual(before);
});


it('projects the same secured order-photo evidence without an actor and retains the existing evidence gate',async()=>{
 const actor=await auth(),expected=(await readOrderEvidenceBatch(actor,[orderId])).get(orderId);
 expect(expected?.code).toBe('OK');if(expected?.code!=='OK')throw Error('TEST_SECURED_EVIDENCE_REQUIRED');
 expect(expected.data.some(row=>row.source==='ORDER_STATION_ATTACHMENT'&&row.original.state==='VERIFIED'&&row.original.hashAlgorithm==='SHA256'&&row.original.mimeType==='image/png')).toBe(true);
 let used:ProjectorAuthorization|undefined;
 const readOnly:TodayProjectionPorts={...ports,readSources:async(capability,keys)=>{
  used=capability;
  const ids=keys.filter(key=>key.kind==='order').map(key=>key.sourceId);
  const [cards,evidence]=await Promise.all([readTodayOrderCards(capability,ids),readOrderEvidenceBatch(capability,ids)]);
  const result=new Map<string,TodayProjectionResult>();
  for(const key of keys){
   const card=cards.get(key.sourceId),proof=evidence.get(key.sourceId);
   if(key.kind==='order'&&card?.code==='OK'&&proof?.code==='OK')result.set(todaySourceKey(key),{code:'OK',payload:{evidence:proof.data},sourceVersion:card.data.version,listed:true});
   else result.set(todaySourceKey(key),{code:'SOURCE_INCOMPLETE',errorCode:'TEST_PORT_NOT_COMPOSED'});
  }
  return result;
 }};
 expect((await rebuildTodayModel(tenant,readOnly)).code).toBe('OK');
 expect(used).toBeDefined();if(!used)throw Error('TEST_READONLY_EVIDENCE_CAPABILITY_REQUIRED');
 const [saved]=await sql`SELECT payload,status,source_seq=built_seq AS fresh FROM private.today_source_v1 WHERE tenant_id=${tenant} AND kind='order' AND source_id=${orderId}`;
 expect(saved).toEqual({payload:JSON.parse(JSON.stringify({evidence:expected.data})),status:'OK',fresh:true});
 expect((await readOrderEvidenceBatch({...used,permissions:[]},[orderId])).get(orderId)).toMatchObject({code:'FORBIDDEN'});
 expect((await readOrderEvidenceBatch(used,[orderId])).get(orderId)).toEqual(expected);
});
it('PL07:32 keeps the canonical invoice transport gate and both source-reader gates equal for every actual role',async()=>{
 const original=await readyInvoiceOrder('TEST canonical invoice read gates','shipping');
 const input={orderId:original.orderId,expectedVersion:original.version};
 const events=await sql`SELECT id::text,payload FROM public.events WHERE tenant_id=${tenant} ORDER BY id`;
 for(const role of APP_ROLES){
  for(const requested of [[],['preise','auftraege','mails']] as const){
   const rights=normalizeAccessAreasForRole(role,[...requested]);
   const fixture=await createFixture([...rights],role);
   const resolved=await withSession(fixture,()=>resolveAuthorization());if(!resolved.ok)throw Error('TEST_INVOICE_GATE_REAL_AUTH');
   const canonical=canTransportInvoiceDocument(resolved.data),session=authorizationReadContext(resolved.data),areas=new Set(resolved.data.areas);
   const projection:AuthorizedReadContext={tenantId:resolved.data.tenantId,permissions:resolved.data.permissions,canReadArea:area=>areas.has(area)};
   expect(session.canReadArea('mails'),role).toBe(canReadQuoteFollowups(resolved.data));
   expect(canReadQuoteFollowupsForRead(resolved.data),role).toBe(canReadQuoteFollowups(resolved.data));
   expect(canReadQuoteFollowupsForRead(projection),role).toBe(canReadQuoteFollowups(resolved.data));
   expect(session.canReadArea('preise'),role).toBe(canonical);expect(projection.canReadArea('preise'),role).toBe(canonical);
   const single=await readInvoiceShippingConsequences(projection,input,readInvoiceVat,readShippingSettingsInTransaction);
   const batch=await readInvoiceShippingConsequencesBatch(projection,[input],readInvoiceVat,readShippingSettingsInTransaction);
   expect(single!==undefined,role).toBe(canonical);expect(batch.get(original.orderId)!==undefined,role).toBe(canonical);
   expect(batch.get(original.orderId),role).toEqual(single);
   expect(await readInvoiceShippingConsequences(resolved.data,JSON.parse(JSON.stringify(input)),readInvoiceVat,readShippingSettingsInTransaction),role).toEqual(single);
   expect(await readInvoiceShippingConsequencesBatch(session,[input],readInvoiceVat,readShippingSettingsInTransaction),role).toEqual(batch);
  }
 }
 expect(await sql`SELECT id::text,payload FROM public.events WHERE tenant_id=${tenant} ORDER BY id`).toEqual(events);
});

it('does not publish the old active-role union as fresh when the tenant epoch changes before source snapshots',async()=>{
 expect((await rebuildTodayModel(tenant)).code).toBe('OK');
 const read=()=>sql`SELECT to_jsonb(actor) AS row FROM public.app_users actor WHERE tenant_id=${tenant} ORDER BY id`;
 await withRestoredTestSource({label:'TEST complete profiles in pre-snapshot epoch race',read,restore:async originals=>{
  for(const {row} of originals){
   const columns=Object.keys(row);if(columns.some(column=>!/^[a-z_][a-z0-9_]*$/.test(column)))throw Error('TEST_PROFILE_COLUMN_INVALID');
   const names=columns.map(column=>'"'+column+'"').join(',');
   await sql`UPDATE public.app_users SET (${sql.unsafe(names)})=(SELECT ${sql.unsafe(names)} FROM jsonb_populate_record(NULL::public.app_users,${sql.json(row)}::jsonb)) WHERE tenant_id=${tenant} AND id=${String(row.id)}::uuid`;
  }
 }},async()=>{
  let sourceReads=0;
  await rebuildTodayModel(tenant,{...ports,
   listOrderIds:async capability=>{
    expect(capability.hasActiveProfiles).toBe(true);
    // Explicit isolated source race, after the real profile query and before
    // pending(). No actor, role, card or permission result is fabricated.
    await sql`UPDATE public.app_users SET active=false WHERE tenant_id=${tenant}`;
    return (await getOperationalOrders(capability,{purpose:'today'})).map(row=>row.id);
   },
   readSources:async(capability,keys)=>{
    sourceReads++;
    const ids=keys.filter(key=>key.kind==='order').map(key=>key.sourceId),cards=await readTodayOrderCards(capability,ids);
    const result=new Map<string,TodayProjectionResult>();
    for(const key of keys){
     const card=cards.get(key.sourceId);
     result.set(todaySourceKey(key),key.kind==='order'&&card?.code==='OK'?{code:'OK',payload:{card:card.data},sourceVersion:card.data.version,listed:true}:{code:'SOURCE_INCOMPLETE',errorCode:'TEST_PORT_NOT_COMPOSED'});
    }
    return result;
   },
  });
  expect(sourceReads).toBe(0);
  expect(await sql`SELECT source.built_tenant_seq=tenant.tenant_seq AS fresh FROM private.today_source_v1 source JOIN private.today_tenant_v1 tenant USING(tenant_id) WHERE source.tenant_id=${tenant} AND source.kind='order' AND source.source_id=${orderId}`).toEqual([{fresh:false}]);
 });
});
