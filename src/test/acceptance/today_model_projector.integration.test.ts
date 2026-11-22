// @vitest-environment node
// E-B worker contract with actual reader/Auth/DB/Storage results in an isolated TEST tenant.
// The unresolved App composition is NOT simulated as complete: unrelated list
// ports explicitly return TEST_PORT_NOT_COMPOSED rather than invented empty data.
import {randomUUID} from 'node:crypto';
import {beforeAll,expect,it,vi,expectTypeOf} from 'vitest';
const tenant=vi.hoisted(()=>'TEST-ablauf-'+globalThis.crypto.randomUUID());
vi.mock('@/lib/tenant',()=>({KREILE_TENANT_SLUG:tenant}));
import {sql,full,withSession} from '../../../e2e/ablauf/replayHarness';
import {readyInvoiceOrder} from '../../../e2e/ablauf/orderFixture';
import {resolveAuthorization,type AuthorizationSnapshot} from '@/lib/server/authorization';
import {readLiveOrderCard,readTodayOrderCards} from '@/lib/server/orderCardRead';
import {readOrderEvidenceBatch} from '@/lib/server/evidenceRead';
import {getOperationalOrders} from '@/lib/server/operationalOrders';
import {readTodayReadSettings} from '@/modules/fundament/server-public';
import {changeOrderPromisedDueDateAction} from '@/app/actions/orders.actions';
import {refreshTodayModel,rebuildTodayModel,type ProjectorAuthorization} from '@/lib/server/todayProjection';
type TodayProjectionPorts=Parameters<typeof refreshTodayModel>[1];
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
 const result=await refreshTodayModel(tenant,{...ports,readSources:async(capability,keys)=>{
  if(keys.some(key=>key.kind==='money'))await sql`SELECT 1/0 AS test_strict_source_failure`;
  return ports.readSources(capability,keys);
 }});
 expect(result.code).toBe('OK');
 expect(await sql`SELECT status,error_code FROM private.today_source_v1 WHERE tenant_id=${tenant} AND kind='money'`).toEqual([{status:'SOURCE_INCOMPLETE',error_code:'TODAY_PROJECTOR_SOURCE_FAILED'}]);
 expect(await sql`SELECT status,source_seq=built_seq AS fresh FROM private.today_source_v1 WHERE tenant_id=${tenant} AND kind='order' AND source_id=${orderId}`).toEqual([{status:'OK',fresh:true}]);
});

it('does not let an expired worker publish or clear the replacement worker lease',async()=>{
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
 expect((await refreshTodayModel(tenant,ports)).code).toBe('OK');
 expect(await sql`SELECT status,error_code FROM private.today_source_v1 WHERE tenant_id=${tenant} AND kind='orders'`).toEqual([{status:'OK',error_code:null}]);
});

it('reads the persisted single-row batch limit and does not let one incomplete list starve all other sources',async()=>{
 // Explicit schema configuration probe in this isolated TEST tenant.
 await sql`UPDATE public.company_settings SET today_refresh_batch_limit=1 WHERE tenant_id=${tenant}`;
 expect((await readTodayReadSettings({tenantId:tenant})).todayRefreshBatchLimit).toBe(1);
 const visits:string[]=[];
 const bounded:TodayProjectionPorts={...ports,readSources:async(capability,keys)=>{
  expect(keys).toHaveLength(1);visits.push(todaySourceKey(keys[0]));return ports.readSources(capability,keys);
 }};
 for(let attempt=0;attempt<9;attempt++)expect((await refreshTodayModel(tenant,bounded)).code).toBe('OK');
 expect(new Set(visits).size).toBe(9);
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
