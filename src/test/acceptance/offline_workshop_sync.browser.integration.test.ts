// @vitest-environment node
// Native queue + real actions/Auth/DB. This bridge is not a Next/PIN/UI proof.
import {it,expect,vi} from 'vitest';
import {randomUUID} from 'node:crypto';
import {createServer} from 'node:http';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {build} from 'esbuild';
const tenant=vi.hoisted(()=>'TEST-ablauf-'+globalThis.crypto.randomUUID());
vi.mock('@/lib/tenant',()=>({KREILE_TENANT_SLUG:tenant}));
import {KREILE_TENANT_SLUG} from '@/lib/tenant';
import {sql,full,withSession,createFixture} from '../../../e2e/ablauf/replayHarness';
import {customerFixture,intakeOrderFixture} from '../../../e2e/ablauf/orderFixture';
import {transitionWareneingangToGalvanikAction,getLiveOrderCardAction} from '@/app/actions/orders.actions';
import {replayOfflineWorkshopAction} from '@/app/actions/offlineWorkshop.actions';
import {offlinePartition} from '@/lib/server/offlinePartition';
if(!process.env.DATABASE_URL||process.env.DATABASE_URL!==process.env.H18_EXPECTED_DATABASE_URL||new URL(process.env.DATABASE_URL).hostname!=='127.0.0.1'||new URL(process.env.DATABASE_URL).port!=='54342')throw Error('TEST_OWN_LOOPBACK_REQUIRED');

it.skipIf(!process.env.KREILE_PLAYWRIGHT_CLI_JS)('replays native workshop originals after a lost response and preserves a rejected original before acknowledging it',async()=>{
 const customerId=await customerFixture('Browser Werkstatt'),created=await intakeOrderFixture('Browser Werkstatt',customerId),orderId=created.receipt.orderId,itemId=created.receipt.items[0].id;
 const moved=await withSession(full,()=>transitionWareneingangToGalvanikAction({orderId,expectedVersion:1,clientEventId:randomUUID()}));if(moved.code!=='OK')throw Error('TEST_MOVE');
 const scope=offlinePartition({tenantId:KREILE_TENANT_SLUG,userId:full.actorId}),key=randomUUID(),rejectedKey=randomUUID();
 const compiled=await build({stdin:{contents:`export * from './src/lib/offline/pendingStore.ts';export {syncPendingFiles} from './src/lib/offline/syncPendingFiles.ts';`,resolveDir:process.cwd()},bundle:true,write:false,format:'esm',platform:'browser'});
 let loseFirstResponse=true,actor=full;
 const server=createServer(async(req,res)=>{
  if(req.url!=='/api'){res.setHeader('Content-Type',req.url==='/queue.mjs'?'text/javascript':'text/html');res.end(req.url==='/queue.mjs'?compiled.outputFiles[0].text:'<!doctype html><title>TEST actual workshop transport</title>');return;}
  try{const chunks:Buffer[]=[];for await(const chunk of req)chunks.push(Buffer.from(chunk));const body=JSON.parse(Buffer.concat(chunks).toString('utf8'));const result=await withSession(actor,()=>replayOfflineWorkshopAction(body.scope,body.original));
   res.setHeader('Content-Type','application/json');if(loseFirstResponse){loseFirstResponse=false;res.statusCode=503;res.end(JSON.stringify({code:'UNAVAILABLE'}));}else res.end(JSON.stringify(result));
  }catch{res.statusCode=500;res.end(JSON.stringify({code:'UNAVAILABLE'}));}
 });
 await new Promise<void>(resolve=>server.listen(0,'127.0.0.1',resolve));const address=server.address();if(!address||typeof address==='string')throw Error('TEST_LOOPBACK');
 const execute=promisify(execFile),session='TEST-workshop-sync-'+randomUUID();
 const cli=async(args:string[])=>{const result=await execute(process.execPath,[process.env.KREILE_PLAYWRIGHT_CLI_JS!,`-s=${session}`,...args],{timeout:90000,maxBuffer:1024*1024});if(result.stdout.includes('### Error'))throw Error('TEST_BROWSER_FAILED:'+result.stdout.slice(0,700));return result;};
 const setup=`async()=>{const p=await import('/queue.mjs');window.TESTqueue=p;window.TESTports={currentScope:()=>'${scope}',workshop:async(scope,original)=>(await fetch('/api',{method:'POST',body:JSON.stringify({scope,original})})).json()};return true;}`;
 try{
  await cli(['open',`http://127.0.0.1:${address.port}/TEST`]);await cli(['eval',setup]);
  await cli(['run-code',`async(page)=>{await page.context().setOffline(true);}`]);
  await cli(['eval',`async()=>{const p=window.TESTqueue;await p.retainPendingWorkshopOriginal('${scope}',{kind:'workshop',id:'${key}',itemId:'${orderId}',command:'item.finished',input:{orderId:'${orderId}',itemId:'${itemId}',expectedVersion:${moved.receipt.aggregateVersion},clientEventId:'${key}',finished:true}});const result=await p.syncPendingFiles('${scope}',window.TESTports);if(result.acknowledged||!(await p.readPendingEntries('${scope}')).some(row=>row.id==='${key}'))throw Error('TEST_OFFLINE_CAPTURE_LOST');return true;}`]);
  await cli(['run-code',`async(page)=>{await page.context().setOffline(false);}`]);
  await cli(['eval',`async()=>{const p=window.TESTqueue,result=await p.syncPendingFiles('${scope}',window.TESTports);if(result.acknowledged||!(await p.readPendingEntries('${scope}')).some(row=>row.id==='${key}'))throw Error('TEST_LOST_RESPONSE_FALSE_ACK');return true;}`]);
  expect(await withSession(full,()=>getLiveOrderCardAction({orderId}))).toMatchObject({code:'OK',data:{card:{version:moved.receipt.aggregateVersion+1,items:[expect.objectContaining({id:itemId,finished:true})]}}});
  await cli(['reload']);await cli(['eval',setup]);
  await cli(['eval',`async()=>{const p=window.TESTqueue,result=await p.syncPendingFiles('${scope}',window.TESTports);if(result.acknowledged!==1||(await p.readPendingEntries('${scope}')).some(row=>row.id==='${key}'))throw Error('TEST_RELOAD_RETRY_NOT_ACKNOWLEDGED');return true;}`]);
  expect(await sql`SELECT count(*)::int AS n FROM public.events WHERE tenant_id=${KREILE_TENANT_SLUG} AND client_event_id=${key}::uuid AND event_type='ORDER_ITEM_FINISHED_CHANGED_V1'`).toEqual([{n:1}]);
  await cli(['eval',`async()=>{await window.TESTqueue.retainPendingWorkshopOriginal('${scope}',{kind:'workshop',id:'${rejectedKey}',itemId:'${orderId}',command:'item.finished',input:{orderId:'${orderId}',itemId:'${itemId}',expectedVersion:1,clientEventId:'${rejectedKey}',finished:true}});return true;}`]);
  actor=await createFixture(['auftraege'],'werkstatt');
  await cli(['eval',`async()=>{const p=window.TESTqueue,result=await p.syncPendingFiles('${scope}',window.TESTports);if(result.acknowledged||!(await p.readPendingEntries('${scope}')).some(row=>row.id==='${rejectedKey}'))throw Error('TEST_FOREIGN_LOGIN_ERASED_ORIGINAL');return true;}`]);
  actor=full;
  const proof=await cli(['eval',`async()=>{const p=window.TESTqueue,result=await p.syncPendingFiles('${scope}',window.TESTports);if(result.acknowledged!==1||(await p.readPendingEntries('${scope}')).length)throw Error('TEST_REJECTED_ORIGINAL_NOT_SECURED');return {reloaded:true,oneBusinessEffect:true,rejectedOriginalPreserved:true};}`]);
  expect(proof.stdout).toContain('"rejectedOriginalPreserved": true');
  expect(await sql`SELECT count(*)::int AS n FROM public.tasks WHERE tenant_id=${KREILE_TENANT_SLUG} AND titel='Konflikt beim Abgleich'`).toEqual([{n:1}]);
  expect(await sql`SELECT count(*)::int AS n FROM public.events WHERE tenant_id=${KREILE_TENANT_SLUG} AND event_type='OFFLINE_WORKSHOP_REJECTED_V1' AND payload->'original'->'input'->>'clientEventId'=${rejectedKey}`).toEqual([{n:1}]);
 }finally{await cli(['close']).catch(()=>{});server.closeAllConnections();await new Promise<void>(resolve=>server.close(()=>resolve()));}
},120000);
