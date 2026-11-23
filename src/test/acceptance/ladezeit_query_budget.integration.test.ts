// @vitest-environment node
// Native Loopback PostgreSQL; read-only TEST probes, no source/provider doubles.
import {afterAll,expect,it,vi} from 'vitest';
import postgres from 'postgres';
import {createServer} from 'node:http';
import {PageReadTimeout,expirePageReadBudget,withPageReadBudget,withPageReadQueryLimits,withPageReadSourcesReady,withPageReadSettingsSource,configurePageReadBudget,withAuthorizationReadBudget,pageReadFetchPort,observeNativePageReadQuery,pageReadQueryObservation,withPageReadPhase,logPageReadQueryObservation} from '@/db/readBudget';

const url=process.env.DATABASE_URL;
const testPort=process.env.GITHUB_ACTIONS==='true'?'54322':'54342';
if(!url||url!==process.env.H18_EXPECTED_DATABASE_URL||new URL(url).hostname!=='127.0.0.1'||new URL(url).port!==testPort)throw Error('TEST_OWN_LOOPBACK_REQUIRED');
const configured:number[]=[];
let inspectRollback:((text:string)=>void)|undefined;
let inspectWire:((text:string)=>void)|undefined;
const native=postgres(url,{prepare:false,max:1,debug:(_connection,text,parameters)=>{
 observeNativePageReadQuery(_connection,text);inspectWire?.(text);
 if(text.includes("set_config('statement_timeout'"))configured.push(Number(parameters[0]));
 inspectRollback?.(text);
}});
const client=withPageReadQueryLimits(native);
afterAll(()=>native.end({timeout:5}));

it('cancels a running native read when its bounded projector loses the lease',async()=>{
 const started=Date.now();
 await expect(withPageReadBudget(async()=>{
  const timer=setTimeout(expirePageReadBudget,40);
  try{await client.begin(async tx=>{await tx`SELECT pg_sleep(1)`;});}
  finally{clearTimeout(timer);}
 },2000)).rejects.toBeInstanceOf(PageReadTimeout);
 expect(Date.now()-started).toBeLessThan(1000);
 expect(await client`SELECT 1 AS ok`).toEqual([{ok:1}]);
});

it('counts executed native SQL including SET and queued BEGIN without mixing two request scopes',async()=>{
 await native`SELECT 1`;const wire:string[]=[];inspectWire=text=>wire.push(text);
 const observed:Array<ReturnType<typeof pageReadQueryObservation>>=[];
 try{
  await Promise.all(['today.orders','today.tasks'].map((phase,index)=>withPageReadBudget(()=>withPageReadPhase(phase,async()=>{
   const observation=pageReadQueryObservation();observed[index]=observation;
   await client.begin(async tx=>{
    if(index===0)await tx.savepoint(nested=>nested`SELECT 31`);
    else await tx`SELECT 32`;
   });
  }),2000)));
  expect(observed[0]).not.toBe(observed[1]);expect(observed[0].total).toBe(5);expect(observed[1].total).toBe(4);
  expect(observed.map(value=>value.total).reduce((sum,value)=>sum+value,0)).toBe(wire.length);
  expect(wire.filter(text=>text.includes("set_config('statement_timeout'")).length).toBe(2);
  expect(observed[0].phases).toEqual({'today.orders':5});expect(observed[1].phases).toEqual({'today.tasks':4});
  const output=vi.spyOn(console,'info').mockImplementation(()=>{});
  try{
   logPageReadQueryObservation(observed[0]);expect(output).toHaveBeenCalledOnce();
   const [marker,serialized]=output.mock.calls[0];expect(marker).toBe('[PAGE_READ_SQL]');
   expect(typeof serialized).toBe('string');expect(JSON.parse(String(serialized))).toEqual({route:'/',total:5,rights:0,page_settings:0,shipping_settings:0,phases:{'today.orders':5},db_ms:expect.any(Number),acquire_ms:expect.any(Number),tx:1,stations:{'today.orders':{db_ms:expect.any(Number),acquire_ms:expect.any(Number),tx:1}}});
   expect(String(serialized)).not.toContain('SELECT');
  }finally{output.mockRestore();}
 }finally{inspectWire=undefined;}
});

it('N0 records three real delayed queries in two native transactions and the request phase offset',async()=>{
 const output=vi.spyOn(console,'info').mockImplementation(()=>{});
 try{await withPageReadBudget(async()=>{
  const observation=pageReadQueryObservation();await new Promise(resolve=>setTimeout(resolve,15));
  await withPageReadPhase('action.shipping',async()=>{
   await client.begin(async tx=>{await tx`SELECT pg_sleep(0.02)`;await tx`SELECT 71 AS n`;});
   await client.begin(tx=>tx`SELECT pg_sleep(0.02)`);
  });
  expect(observation.tx).toBe(2);expect(observation.total).toBe(9);expect(observation.db_ms).toBeGreaterThanOrEqual(40);
  expect(observation.stations['action.shipping']).toEqual({tx:2,db_ms:observation.db_ms,acquire_ms:observation.acquire_ms});
  const phase=output.mock.calls.filter(call=>call[0]==='[PAGE_READ_PHASE]').map(call=>JSON.parse(String(call[1]))).find(value=>value.phase==='action.shipping');
  expect(phase.offsetMs).toBeGreaterThanOrEqual(10);expect(phase.counts).toEqual({});
 },2000);}finally{output.mockRestore();}
});

it('N0 observes actual waiting for the sole native connection without sharing another request timing',async()=>{
 let entered!:()=>void,release!:()=>void;const acquired=new Promise<void>(resolve=>{entered=resolve;}),held=new Promise<void>(resolve=>{release=resolve;});
 const holder=native.begin(async()=>{entered();await held;});await acquired;
 try{await withPageReadBudget(()=>withPageReadPhase('today.orders',async()=>{
  const observation=pageReadQueryObservation(),read=client.begin(tx=>tx`SELECT 72 AS n`);
  await new Promise(resolve=>setTimeout(resolve,40));release();expect(await read).toMatchObject([{n:72}]);
  expect(observation.tx).toBe(1);expect(observation.acquire_ms).toBeGreaterThanOrEqual(30);expect(observation.stations['today.orders'].acquire_ms).toBe(observation.acquire_ms);
 }),2000);}finally{release();await holder;}
});

it('sets one native timeout for four fast statements and refreshes it only after 250ms',async()=>{
 await client`SELECT 1`;configured.length=0;
 await withPageReadBudget(()=>client.begin(async tx=>{
  for(let index=0;index<4;index++)expect(await tx`SELECT ${index}::integer AS n`).toMatchObject([{n:index}]);
  expect(configured).toHaveLength(1);
  await tx.savepoint(async nested=>{expect(await nested`SELECT 5 AS n`).toMatchObject([{n:5}]);});
  expect(configured).toHaveLength(1);
  await new Promise(resolve=>setTimeout(resolve,300));
  expect(await tx`SELECT 6 AS n`).toMatchObject([{n:6}]);
  expect(configured).toHaveLength(2);expect(configured[1]).toBeLessThan(configured[0]);
 }),2000);
});

it('counts the canonical rights row in its existing authorization scope without conflating a roster read',async()=>{
 await native`SELECT 1`;
 await withPageReadBudget(async()=>{
  const observation=pageReadQueryObservation();
  const read=()=>client.begin(tx=>tx`SELECT app_user.id,(SELECT count(*) FROM public.app_user_rights rights WHERE rights.user_id=app_user.id) AS rights FROM public.app_users app_user WHERE false`);
  await withAuthorizationReadBudget(read);
  expect(observation.rights).toBe(1);
  await read();expect(observation.rights).toBe(1);expect(observation.total).toBe(8);
 },2000);
});

it('attributes lazy and async native source queries to their real caller station',async()=>{
 await native`SELECT 1`;
 await withPageReadBudget(async()=>{
  const observation=pageReadQueryObservation();
  await withPageReadPhase('today.responsibility',()=>withPageReadPhase('today.source',()=>client`SELECT 42`));
  await withPageReadPhase('today.responsibility',()=>withPageReadPhase('today.source',async()=>await client`SELECT 43`));
  expect(observation.total).toBe(2);expect(observation.phases).toEqual({'today.responsibility':2});
 },1000);
});

it('still cancels a real slow query at its page deadline and returns the native connection intact',async()=>{
 await client`SELECT 1`;configured.length=0;
 const failure=await withPageReadBudget(()=>client.begin(async tx=>{
  await tx`SELECT pg_sleep(1)`;
 }),100).then(()=>null,error=>error);
 expect(failure).toBeInstanceOf(PageReadTimeout);
 expect(configured).toHaveLength(1);
 expect(await withPageReadBudget(()=>client.begin(tx=>tx`SELECT 7 AS n`),1000)).toMatchObject([{n:7}]);
});

it('does not reserve the sole connection before settings and preserves a longer configured company deadline',async()=>{
 await client`SELECT 1`;
 await withPageReadBudget(async()=>{
  let release!:()=>void;
  const settingsReady=new Promise<void>(resolve=>{release=resolve;}).then(()=>configurePageReadBudget(1500));
  await withPageReadSourcesReady(settingsReady,async()=>{
   let dataEntered=false;
   const data=client.begin(async tx=>{dataEntered=true;return tx`SELECT pg_sleep(0.15), 8 AS n`;});
   // This is the same exception used by the actual cached settings source.
   expect(await withPageReadSettingsSource(()=>client.begin(tx=>tx`SELECT 9 AS n`))).toMatchObject([{n:9}]);
   expect(await withAuthorizationReadBudget(()=>client.begin(tx=>tx`SELECT 10 AS n`))).toMatchObject([{n:10}]);
   expect(dataEntered).toBe(false);
   await new Promise(resolve=>setTimeout(resolve,180));
   release();
   expect(await data).toMatchObject([{n:8}]);
  });
 },120);
 expect(await client`SELECT 11 AS n`).toMatchObject([{n:11}]);
});

it('still enforces a shorter company deadline after the gate and releases a cancelled transaction',async()=>{
 const failure=await withPageReadBudget(async()=>{
  const ready=Promise.resolve().then(()=>configurePageReadBudget(80));
  return withPageReadSourcesReady(ready,()=>client.begin(tx=>tx`SELECT pg_sleep(1)`));
 },2000).then(()=>null,error=>error);
 expect(failure).toBeInstanceOf(PageReadTimeout);
 expect(await client`SELECT 12 AS n`).toMatchObject([{n:12}]);
});

it('starts the real provider request only after the same settings promise',async()=>{
 let requests=0;
 const server=createServer((_req,res)=>{requests++;res.end('settings-ready');});
 await new Promise<void>(resolve=>server.listen(0,'127.0.0.1',resolve));
 try{
  const address=server.address();if(!address||typeof address==='string')throw Error('TEST_LOOPBACK_ADDRESS_REQUIRED');
  await withPageReadBudget(async()=>{
   let release!:()=>void;
   const ready=new Promise<void>(resolve=>{release=resolve;}).then(()=>configurePageReadBudget(2000));
   await withPageReadSourcesReady(ready,async()=>{
    const request=pageReadFetchPort(fetch)(`http://127.0.0.1:${address.port}`);
    expect(await withPageReadSettingsSource(()=>client.begin(tx=>tx`SELECT 13 AS n`))).toMatchObject([{n:13}]);
    expect(requests).toBe(0);release();
    expect(await (await request).text()).toBe('settings-ready');expect(requests).toBe(1);
   });
  },2000);
 }finally{await new Promise<void>((resolve,reject)=>server.close(error=>error?reject(error):resolve()));}
});

it('drains the actual native cancellation acknowledgement before rollback or connection reuse',async()=>{
 await client`SELECT 1`;
 let acknowledged=false,started=false,drained:Promise<unknown>|undefined;
 const rollbacks:boolean[]=[];
 inspectRollback=text=>{if(text.trim().toLowerCase()==='rollback'&&started)rollbacks.push(acknowledged);};
 try{
  const failure=await withPageReadBudget(()=>client.begin(async tx=>{
   // Exercise client cancellation deterministically. PostgreSQL retains the
   // initial transaction bound; the request's existing configurator makes its
   // client deadline earlier. The independent server deadline cannot win first.
   configurePageReadBudget(100);
   const query=tx`SELECT pg_sleep(1)`;
   const cancellable=query as unknown as {canceller:((query:unknown)=>Promise<unknown>)|null};
   const cancel=cancellable.canceller;if(!cancel)throw Error('TEST_NATIVE_CANCELLER_REQUIRED');
   // The native query and cancellation remain real. Only the observed transport
   // acknowledgement is delayed, making the cleanup race deterministic.
   cancellable.canceller=input=>{started=true;drained=Promise.resolve(cancel(input)).then(async()=>{await new Promise(resolve=>setTimeout(resolve,25));acknowledged=true;});return drained;};
   return await query;
  }),2000).then(()=>null,error=>error);
  expect(failure).toBeInstanceOf(PageReadTimeout);expect(started).toBe(true);
  expect(rollbacks).toEqual([true]);
  expect(await withPageReadBudget(()=>client.begin(tx=>tx`SELECT 14 AS n`),1000)).toMatchObject([{n:14}]);
 }finally{await drained;inspectRollback=undefined;}
});
