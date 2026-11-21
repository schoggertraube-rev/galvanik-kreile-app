// @vitest-environment node
// Native Loopback PostgreSQL; read-only TEST probes, no source/provider doubles.
import {afterAll,expect,it} from 'vitest';
import postgres from 'postgres';
import {createServer} from 'node:http';
import {PageReadTimeout,withPageReadBudget,withPageReadQueryLimits,withPageReadSourcesReady,withPageReadSettingsSource,configurePageReadBudget,withAuthorizationReadBudget,pageReadFetchPort} from '@/db/readBudget';

const url=process.env.DATABASE_URL;
if(!url||url!==process.env.H18_EXPECTED_DATABASE_URL||new URL(url).hostname!=='127.0.0.1'||new URL(url).port!=='54342')throw Error('TEST_OWN_LOOPBACK_REQUIRED');
const configured:number[]=[];
const native=postgres(url,{prepare:false,max:1,debug:(_connection,text,parameters)=>{
 if(text.includes("set_config('statement_timeout'"))configured.push(Number(parameters[0]));
}});
const client=withPageReadQueryLimits(native);
afterAll(()=>native.end({timeout:5}));

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
