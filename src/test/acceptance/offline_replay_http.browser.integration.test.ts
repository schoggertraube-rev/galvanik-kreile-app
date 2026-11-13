// @vitest-environment node
// TEST bridge only: actual browser fetch/IDB, route/Auth/DB and existing writer.
// Network response loss is controlled; no Next UI/cold-start/24h claim.
import {it,expect,vi} from 'vitest';
import {randomUUID} from 'node:crypto';
import {createServer} from 'node:http';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {build} from 'esbuild';
const tenant=vi.hoisted(()=>'TEST-ablauf-'+globalThis.crypto.randomUUID());
vi.mock('@/lib/tenant',()=>({KREILE_TENANT_SLUG:tenant}));
import {KREILE_TENANT_SLUG} from '@/lib/tenant';
import {full,createFixture,withRequest,withSession} from '../../../e2e/ablauf/replayHarness';
import {customerFixture,intakeOrderFixture} from '../../../e2e/ablauf/orderFixture';
import {getLiveOrderCardAction,transitionWareneingangToGalvanikAction} from '@/app/actions/orders.actions';
import {COOKIE_NAME,signAppSession,getSecretKey} from '@/lib/server/appSession';
import {offlinePartition} from '@/lib/server/offlinePartition';
import {POST} from '@/app/api/offline/replay/route';
it.skipIf(!process.env.KREILE_PLAYWRIGHT_CLI_JS)('U291 actual HTTP receipt survives lost response, foreign login and fresh native retry',async()=>{
 const customerId=await customerFixture('TEST HTTP queue'),created=await intakeOrderFixture('TEST HTTP queue',customerId),orderId=created.receipt.orderId;
 const before=await withSession(full,()=>getLiveOrderCardAction({orderId}));if(before.code!=='OK')throw Error('TEST_CARD_SOURCE');
 const moved=await withSession(full,()=>transitionWareneingangToGalvanikAction({orderId,expectedVersion:before.data.card.version,clientEventId:randomUUID()}));if(moved.code!=='OK')throw Error('TEST_REAL_GALVANIK');
 const foreign=await createFixture(['auftraege'],'werkstatt'),scope=offlinePartition({tenantId:KREILE_TENANT_SLUG,userId:full.actorId}),key=randomUUID();
 const original={id:key,itemId:orderId,kind:'workshop',command:'item.finished',deviceCapturedAt:new Date().toISOString(),input:{orderId,itemId:created.receipt.items[0].id,expectedVersion:moved.receipt.aggregateVersion,clientEventId:key,finished:true}};
 const compiled=await build({stdin:{contents:"export * from './src/lib/offline/pendingStore';export {syncPendingFiles} from './src/lib/offline/syncPendingFiles';export {replayOfflineWorkshopHttp} from './src/lib/offline/replayWorkshopHttp';",resolveDir:process.cwd()},bundle:true,write:false,format:'esm',platform:'browser'});
 let actor=full,loseResponse=true,calls=0;const receipts:string[]=[];
 const server=createServer(async(req,res)=>{
  if(req.url==='/api/offline/replay'){
   try{
    calls++;const chunks:Buffer[]=[];for await(const chunk of req)chunks.push(Buffer.from(chunk));
    const headers=Object.fromEntries(Object.entries(req.headers).filter((row):row is [string,string|string[]]=>row[1]!==undefined).map(([name,value])=>[name,Array.isArray(value)?value.join(','):value]));
    const request=new Request('http://'+req.headers.host+req.url,{method:'POST',headers,body:Buffer.concat(chunks)});
    const response=await withRequest(headers.cookie??'',()=>POST(request),false,headers),body=await response.text();
    if(response.status===200){const saved=JSON.parse(body);receipts.push(saved.offlineReceipt.eventId);if(loseResponse){loseResponse=false;res.writeHead(503,{'content-type':'application/json','cache-control':'no-store'});res.end(JSON.stringify({code:'UNAVAILABLE'}));return;}}
    res.writeHead(response.status,{'content-type':'application/json','cache-control':'no-store'});res.end(body);
   }catch{res.writeHead(503,{'content-type':'application/json'});res.end(JSON.stringify({code:'UNAVAILABLE'}));}return;
  }
  if(req.url==='/queue.mjs'){res.writeHead(200,{'content-type':'text/javascript','cache-control':'no-store'});res.end(compiled.outputFiles[0].text);return;}
  const token=signAppSession({userId:actor.actorId,tenantId:KREILE_TENANT_SLUG,role:actor.role,displayName:'TEST HTTP actor',issuedAt:actor.actorIssuedAt,expiresAt:Date.now()+5*60_000},getSecretKey());
  res.writeHead(200,{'content-type':'text/html','set-cookie':`${COOKIE_NAME}=${token}; HttpOnly; Path=/; SameSite=Lax`,'cache-control':'no-store'});res.end('<!doctype html><title>TEST native HTTP transport</title>');
 });
 await new Promise<void>(resolve=>server.listen(0,'127.0.0.1',resolve));const address=server.address();if(!address||typeof address==='string')throw Error('TEST_LOOPBACK');
 const execute=promisify(execFile),session='TEST-http-replay-'+randomUUID();
 const cli=async(args:string[])=>{const result=await execute(process.execPath,[process.env.KREILE_PLAYWRIGHT_CLI_JS!,`-s=${session}`,...args],{timeout:90000,maxBuffer:1024*1024}).catch(error=>{throw Error('TEST_BROWSER_COMMAND:'+String(error.stdout??error.message).slice(0,2000));});if(result.stdout.includes('### Error'))throw Error('TEST_BROWSER_FAILED:'+result.stdout.slice(0,1600));return result;};
 const setup=`async()=>{window.TESThttp=await import('/queue.mjs');window.TESTacks=[];window.TESTports={currentScope:()=>'${scope}',workshop:(scope,entry)=>window.TESThttp.replayOfflineWorkshopHttp(scope,entry,{keepalive:true}),workshopAcknowledged:proof=>window.TESTacks.push(proof)};return true;}`;
 try{
  await cli(['open',`http://127.0.0.1:${address.port}/TEST`]);await cli(['eval',setup]);
  await cli(['eval',`async()=>{const p=window.TESThttp,original={...${JSON.stringify(original)},notBefore:new Date(Date.now()+600000).toISOString()};await p.retainPendingWorkshopOriginal('${scope}',original);const deferred=await p.syncPendingFiles('${scope}',window.TESTports);if(deferred.secured!==0||deferred.acknowledged!==0)throw Error('TEST_DELAY_IGNORED');if(!await p.withdrawPendingWorkshop('${scope}',original.id)||(await p.readPendingEntries('${scope}')).length!==0)throw Error('TEST_UNDO_NOT_ATOMIC');await p.retainPendingWorkshopOriginal('${scope}',original);const result=await p.syncPendingFiles('${scope}',window.TESTports,{flushDelayed:true});const pending=await p.readPendingEntries('${scope}');if(result.acknowledged!==0||result.blocked!==1||pending.length!==1||JSON.stringify(pending[0].input)!==JSON.stringify(original.input)||pending[0].deviceCapturedAt!==original.deviceCapturedAt||!pending[0].dispatchStartedAt||await p.withdrawPendingWorkshop('${scope}',original.id))throw Error('TEST_LOST_RESPONSE_OR_UNDO_REOPENED');window.TESToriginal=JSON.stringify(pending);return true;}`]);
  const physical=await withSession(full,()=>getLiveOrderCardAction({orderId}));expect(physical).toMatchObject({code:'OK',data:{card:{version:moved.receipt.aggregateVersion+1,items:[expect.objectContaining({id:original.input.itemId,finished:true})]}}});
  actor=foreign;await cli(['goto',`http://127.0.0.1:${address.port}/TEST`]);await cli(['eval',setup]);
  await cli(['eval',`async()=>{const p=window.TESThttp,entries=await p.readPendingEntries('${scope}'),result=await p.syncPendingFiles('${scope}',window.TESTports);if(result.acknowledged!==0||result.blocked!==1||JSON.stringify(await p.readPendingEntries('${scope}'))!==JSON.stringify(entries))throw Error('TEST_FOREIGN_LOGIN_ACKED_OR_CHANGED');return true;}`]);
  actor=full;await cli(['goto',`http://127.0.0.1:${address.port}/TEST`]);await cli(['eval',setup]);
  await cli(['eval',`async()=>{const p=window.TESThttp,result=await p.syncPendingFiles('${scope}',window.TESTports);if(result.acknowledged!==1||result.secured!==1||(await p.readPendingEntries('${scope}')).length!==0||window.TESTacks.length!==1||window.TESTacks[0].result.offlineReceipt.actorId!=='${full.actorId}')throw Error('TEST_REAL_HTTP_RETRY_NOT_ACKED');return true;}`]);
  const fresh=await withSession(full,()=>getLiveOrderCardAction({orderId}));if(physical.code!=='OK'||fresh.code!=='OK')throw Error('TEST_REAL_FRESH_CARD');expect(fresh.data.card).toEqual(physical.data.card);expect(calls).toBe(3);expect(receipts).toHaveLength(2);expect(receipts[1]).toBe(receipts[0]);
 }finally{await execute(process.execPath,[process.env.KREILE_PLAYWRIGHT_CLI_JS!,`-s=${session}`,'close'],{timeout:30000}).catch(()=>{});await new Promise<void>(resolve=>server.close(()=>resolve()));}
},120000);
