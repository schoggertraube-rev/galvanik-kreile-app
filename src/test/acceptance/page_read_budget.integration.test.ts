// @vitest-environment node
import {afterAll,expect,it} from 'vitest';
import postgres from 'postgres';
import {drizzle} from 'drizzle-orm/postgres-js';
import {sql} from 'drizzle-orm';
import {PageReadTimeout,withPageReadBudget,withPageReadQueryLimits,pageReadFetchPort} from '@/db/readBudget';
import {createServer} from 'node:http';

const url=process.env.DATABASE_URL;
if(!url||url!==process.env.H18_EXPECTED_DATABASE_URL||new URL(url).hostname!=='127.0.0.1')throw Error('TEST_LOOPBACK_REPLAY_REQUIRED');
const native=postgres(url,{prepare:false,max:1});
const client=withPageReadQueryLimits(native);
const db=drizzle(client);
afterAll(()=>native.end({timeout:5}));

it('cancels a real active query and frees the existing connection for the next read',async()=>{
  await db.execute(sql`SELECT 1`);
  const started=Date.now();
  await expect(withPageReadBudget(()=>db.execute(sql`SELECT pg_sleep(1)`),100)).rejects.toMatchObject({cause:expect.any(PageReadTimeout)});
  expect(Date.now()-started).toBeLessThan(800);
  expect(await withPageReadBudget(()=>db.execute<{ok:number}>(sql`SELECT 1 AS ok`),1000)).toMatchObject([{ok:1}]);
});

it('cancels a queued read without cancelling a different request or altering unscoped commands',async()=>{
  const outside=db.execute<{ok:number}>(sql`SELECT 2 AS ok, pg_sleep(0.3)`);
  const active=Promise.resolve(outside);
  // Queue order is deterministic: the unscoped query reserves the sole connection first.
  await new Promise(resolve=>setTimeout(resolve,25));
  await expect(withPageReadBudget(()=>db.execute(sql`SELECT 3`),50)).rejects.toMatchObject({cause:expect.any(PageReadTimeout)});
  expect(await active).toMatchObject([{ok:2}]);
  expect(await db.execute<{ok:number}>(sql`SELECT 4 AS ok`)).toMatchObject([{ok:4}]);
});

it('bounds native nested transactions, rolls back timed-out reads and retains a usable pool',async()=>{
  await expect(withPageReadBudget(()=>db.transaction(tx=>tx.transaction(nested=>nested.execute(sql`SELECT pg_sleep(1)`))),100)).rejects.toMatchObject({cause:expect.any(PageReadTimeout)});
  expect(await withPageReadBudget(()=>db.transaction(tx=>tx.execute<{ok:number}>(sql`SELECT 5 AS ok`)),1000)).toMatchObject([{ok:5}]);
});

it('rejects an already expired read without executing it or leaving an unobserved cancellation',async()=>{
 await expect(withPageReadBudget(async()=>{
  await new Promise(resolve=>setTimeout(resolve,30));
  return db.execute(sql`SELECT pg_sleep(1)`);
 },10)).rejects.toMatchObject({cause:expect.any(PageReadTimeout)});
 expect(await db.execute<{ok:number}>(sql`SELECT 6 AS ok`)).toMatchObject([{ok:6}]);
});

it('aborts actual provider HTTP before headers and during a slow body, retaining unrelated unscoped reads',async()=>{
 // Only the external provider boundary is doubled by this local TEST server.
 // No app route, server action, Auth, DB, or successful send is simulated.
 let aborted=0;
 let bothAborted:(()=>void)|undefined;
 const closed=new Promise<void>(resolve=>{bothAborted=resolve;});
 const timers=new Set<ReturnType<typeof setTimeout>>();
 const server=createServer((request,response)=>{
  if(request.url==='/TEST-fast'){response.end('TEST boundary OK');return;}
  if(request.url==='/TEST-body'){response.writeHead(200,{'content-type':'text/plain'});response.flushHeaders();response.write('TEST original prefix');}
  const timer=setTimeout(()=>response.end('TEST delayed boundary'),500);timers.add(timer);
  response.on('close',()=>{if(!response.writableEnded)aborted++;if(aborted===2)bothAborted?.();clearTimeout(timer);timers.delete(timer);});
 });
 await new Promise<void>(resolve=>server.listen(0,'127.0.0.1',resolve));
 const address=server.address();if(!address||typeof address==='string')throw Error('TEST_L1_HTTP_ADDRESS');
 const base='http://127.0.0.1:'+address.port,read=pageReadFetchPort(fetch);
 try{
  const connected=await read(base+'/TEST-fast');expect(await connected.text()).toBe('TEST boundary OK');
  const started=Date.now();
  const headerError=await withPageReadBudget(()=>read(base+'/TEST-headers'),50).then(()=>{throw Error('TEST_EXPECTED_DEADLINE');},error=>error);
  expect(headerError instanceof PageReadTimeout||headerError?.name==='TimeoutError').toBe(true);
  await expect(withPageReadBudget(async()=>{const response=await read(base+'/TEST-body');return response.text();},50)).rejects.toMatchObject({name:'TimeoutError'});
  await closed;
  expect(Date.now()-started).toBeLessThan(1000);
  const unchanged=await read(base+'/TEST-fast');expect(await unchanged.text()).toBe('TEST boundary OK');
  expect(aborted).toBe(2);
 }finally{
  for(const timer of timers)clearTimeout(timer);
  server.closeAllConnections();await new Promise<void>((resolve,reject)=>server.close(error=>error?reject(error):resolve()));
 }
});
