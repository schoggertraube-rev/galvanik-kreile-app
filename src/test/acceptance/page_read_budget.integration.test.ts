// @vitest-environment node
import {afterAll,expect,it,vi} from 'vitest';
import postgres from 'postgres';
import {drizzle} from 'drizzle-orm/postgres-js';
import {sql} from 'drizzle-orm';
import {PageReadTimeout,withPageReadBudget,withPageReadQueryLimits,pageReadFetchPort} from '@/db/readBudget';
import {createServer} from 'node:http';
import {readMicrosoftGraphSentMailByRequest,readMicrosoftGraphSentMailReference,readMicrosoftGraphSentDocumentEvidence} from '@/lib/server/microsoftGraph';

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


it.each(['request','reference','document'] as const)('keeps the same actual deadline through the existing Graph %s reader and its response body',async(kind)=>{
 // Explicitly synthetic external provider only; actual reader, token path,
 // fetch implementation, native HTTP socket and cancellation remain real.
 const environment={MS_GRAPH_TENANT_ID:'TEST-tenant',MS_GRAPH_CLIENT_ID:'TEST-client',MS_GRAPH_CLIENT_SECRET:'TEST-no-real-secret',MS_GRAPH_MAILBOX:'TEST@example.invalid'};
 let aborted=0;
 const timers=new Set<ReturnType<typeof setTimeout>>();
 const server=createServer((request,response)=>{
  if(request.url==='/TEST-token'){response.setHeader('content-type','application/json');response.end(JSON.stringify({access_token:'TEST-provider-boundary-token'}));return;}
  response.writeHead(200,{'content-type':'application/json'});response.flushHeaders();response.write('{"value":[');
  const timer=setTimeout(()=>response.end(']}'),750);timers.add(timer);
  response.on('close',()=>{if(!response.writableEnded)aborted++;clearTimeout(timer);timers.delete(timer);});
 });
 await new Promise<void>(resolve=>server.listen(0,'127.0.0.1',resolve));
 const address=server.address();if(!address||typeof address==='string')throw Error('TEST_L1_GRAPH_HTTP_ADDRESS');
 const base='http://127.0.0.1:'+address.port;
 const transport:typeof fetch=(input,init)=>fetch(base+(String(input).includes('login.microsoftonline.com')?'/TEST-token':'/TEST-sent'),init);
 const logger=vi.spyOn(console,'error').mockImplementation(()=>undefined);
 try{
  const warm=await transport('https://login.microsoftonline.com/TEST');expect(await warm.json()).toHaveProperty('access_token');
  const started=Date.now();
  const result=await withPageReadBudget<{code:string}>(()=>kind==='request'
   ?readMicrosoftGraphSentMailByRequest({clientRequestId:'11111111-1111-4111-8111-111111111111',recipient:'TEST-recipient@example.invalid',preparedAt:new Date().toISOString()},environment,transport)
   :kind==='reference'?readMicrosoftGraphSentMailReference('<TEST@example.invalid>','TEST-recipient@example.invalid',environment,transport)
   :readMicrosoftGraphSentDocumentEvidence('<TEST@example.invalid>','TEST-recipient@example.invalid',environment,transport),80);
  expect(result.code).toBe('UNAVAILABLE');
  expect(Date.now()-started).toBeLessThan(400);
  // Native close is delivered asynchronously after fetch rejects.
  for(let attempt=0;attempt<20&&aborted===0;attempt++)await new Promise(resolve=>setTimeout(resolve,5));
  expect(aborted).toBe(1);
  const outside=await transport('https://login.microsoftonline.com/TEST');expect(await outside.json()).toHaveProperty('access_token');
 }finally{
  logger.mockRestore();for(const timer of timers)clearTimeout(timer);
  server.closeAllConnections();await new Promise<void>((resolve,reject)=>server.close(error=>error?reject(error):resolve()));
 }
});
