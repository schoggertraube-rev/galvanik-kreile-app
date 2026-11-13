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
import {getCustomerSummaryAction} from '@/app/actions/customers.actions';
import {createQuoteAction,readQuoteAction} from '@/app/actions/quotes.actions';
import {offlinePartition} from '@/lib/server/offlinePartition';
if(!process.env.DATABASE_URL||process.env.DATABASE_URL!==process.env.H18_EXPECTED_DATABASE_URL||!['127.0.0.1','localhost'].includes(new URL(process.env.DATABASE_URL).hostname)||new URL(process.env.DATABASE_URL).pathname!=='/postgres'||!tenant.startsWith('TEST-'))throw Error('TEST_OWN_LOOPBACK_REQUIRED');

it.skipIf(!process.env.KREILE_PLAYWRIGHT_CLI_JS)('KORR S03 offline restart exactly-once conflict task and actual logout retain pending originals',async()=>{
 const customerId=await customerFixture('Browser Werkstatt'),created=await intakeOrderFixture('Browser Werkstatt',customerId),orderId=created.receipt.orderId,itemId=created.receipt.items[0].id;
 const quoteCreated=await withSession(full,()=>createQuoteAction({clientEventId:randomUUID(),customerId,dueDate:'2027-05-15',validUntil:'2027-05-31',note:'TEST device metadata source',positions:[{name:'TEST device part',quantity:2,material:'Messing',surfaceRequested:'verchromen',unitPriceCents:12345,lineTotalCents:24690}]}));if(quoteCreated.code!=='OK')throw Error('TEST_DEVICE_QUOTE');
 const moved=await withSession(full,()=>transitionWareneingangToGalvanikAction({orderId,expectedVersion:1,clientEventId:randomUUID()}));if(moved.code!=='OK')throw Error('TEST_MOVE');
 const scope=offlinePartition({tenantId:KREILE_TENANT_SLUG,userId:full.actorId}),key=randomUUID(),rejectedKey=randomUUID();
 const compiled=await build({stdin:{contents:`export * from './src/lib/offline/pendingStore.ts';export * from './src/lib/offline/devicePortRead.ts';export {syncPendingFiles} from './src/lib/offline/syncPendingFiles.ts';export {clearLoggedOutReadState} from './src/lib/offline/logoutReadState.ts';export {removeCacheScopeMarker} from './src/lib/offline/cacheScopeMarker.ts';`,resolveDir:process.cwd()},bundle:true,write:false,format:'esm',platform:'browser'});
 let loseFirstResponse=true,actor=full;
 const server=createServer(async(req,res)=>{
  if(req.url==='/read-other-u2'){const customer=await withSession(actor,()=>getCustomerSummaryAction({customerId}));const quote=await withSession(actor,()=>readQuoteAction({quoteId:quoteCreated.quote.quoteId,purpose:'operations'}));res.setHeader('Content-Type','application/json');res.end(JSON.stringify({customer,quote}));return;}
  if(req.url==='/read-u2'){const result=await withSession(actor,()=>getLiveOrderCardAction({orderId}));res.setHeader('Content-Type','application/json');res.end(JSON.stringify(result));return;}
  if(req.url==='/logout'){try{const {logout}=await import('@/app/actions/auth');const {readAppSession}=await import('@/lib/server/appSession');const result=await withSession(full,async()=>{const before=await readAppSession();const ended=await logout();const after=await readAppSession();return {...ended,wasAuthenticated:before.ok,sessionCleared:!after.ok};});res.setHeader('Content-Type','application/json');res.end(JSON.stringify(result));}catch{res.statusCode=500;res.end('{}');}return;}
  if(req.url!=='/api'){res.setHeader('Content-Type',req.url==='/queue.mjs'?'text/javascript':'text/html');res.end(req.url==='/queue.mjs'?compiled.outputFiles[0].text:'<!doctype html><title>TEST actual workshop transport</title>');return;}
  try{const chunks:Buffer[]=[];for await(const chunk of req)chunks.push(Buffer.from(chunk));const body=JSON.parse(Buffer.concat(chunks).toString('utf8'));const result=await withSession(actor,()=>replayOfflineWorkshopAction(body.scope,body.original));
   res.setHeader('Content-Type','application/json');if(loseFirstResponse){loseFirstResponse=false;res.statusCode=503;res.end(JSON.stringify({code:'UNAVAILABLE'}));}else res.end(JSON.stringify(result));
  }catch{res.statusCode=500;res.end(JSON.stringify({code:'UNAVAILABLE'}));}
 });
 await new Promise<void>(resolve=>server.listen(0,'127.0.0.1',resolve));const address=server.address();if(!address||typeof address==='string')throw Error('TEST_LOOPBACK');
 const execute=promisify(execFile),session='TEST-workshop-sync-'+randomUUID();
 const cli=async(args:string[])=>{const result=await execute(process.execPath,[process.env.KREILE_PLAYWRIGHT_CLI_JS!,`-s=${session}`,...args],{timeout:90000,maxBuffer:1024*1024});if(result.stdout.includes('### Error'))throw Error('TEST_BROWSER_FAILED:'+result.stdout.slice(0,700));return result;};
 const setup=`async()=>{const p=await import('/queue.mjs');window.TESTqueue=p;window.TESTacks=[];window.TESTports={workshopAcknowledged:proof=>window.TESTacks.push(proof),currentScope:()=>'${scope}',workshop:async(scope,original)=>(await fetch('/api',{method:'POST',body:JSON.stringify({scope,original})})).json()};return true;}`;
 try{
  await cli(['open',`http://127.0.0.1:${address.port}/TEST`]);await cli(['eval',setup]);
  const deviceRead=await cli(['eval',`async()=>{const p=window.TESTqueue;document.cookie='kreile_offline_cache_scope=${scope}; Path=/';await p.changePendingShellMetadata('${scope}','${scope}',null,true);const response=await(await fetch('/read-u2')).json();if(response.code!=='OK'||!response.data.serverReadAt||!response.data.nextActionRule)throw Error('TEST_CANONICAL_U2_SOURCE');window.TESTdevice={port:'order.u2',portVersion:1,objectId:'${orderId}',serverReadAt:response.data.serverReadAt,response:response.data.nextActionRule};if((await p.retainDevicePortResponse('${scope}',true,window.TESTdevice)).code!=='STORED')throw Error('TEST_DEVICE_PORT_NOT_STORED');return {canonicalU2:true};}`]);
  expect(deviceRead.stdout).toContain('"canonicalU2": true');
  await cli(['eval',`async()=>{const p=window.TESTqueue,sources=await(await fetch('/read-other-u2')).json();if(sources.customer.code!=='OK'||sources.quote.code!=='OK')throw Error('TEST_DEVICE_DOMAIN_SOURCES');window.TESTotherDevices=[{port:'customer.u2',portVersion:1,objectId:'${customerId}',serverReadAt:sources.customer.serverReadAt,response:sources.customer.data.nextActionRule},{port:'quote.u2',portVersion:1,objectId:'${quoteCreated.quote.quoteId}',serverReadAt:sources.quote.serverReadAt,response:sources.quote.nextActionRule}];for(const value of window.TESTotherDevices)if((await p.retainDevicePortResponse('${scope}',true,value)).code!=='STORED')throw Error('TEST_OTHER_U2_NOT_STORED');return true;}`]);

  await cli(['run-code',`async(page)=>{await page.context().setOffline(true);}`]);
  await cli(['eval',`async()=>{for(const original of window.TESTotherDevices){const read=await window.TESTqueue.readDevicePortResponse('${scope}',true,original);if(read.code!=='OK'||JSON.stringify(read.value)!==JSON.stringify(original))throw Error('TEST_OFFLINE_CUSTOMER_QUOTE_NOT_EXACT');}return true;}`]);
  await cli(['eval',`async()=>{const p=window.TESTqueue,read=await p.readDevicePortResponse('${scope}',true,{port:'order.u2',objectId:'${orderId}'});if(read.code!=='OK'||JSON.stringify(read.value)!==JSON.stringify(window.TESTdevice))throw Error('TEST_OFFLINE_U2_NOT_EXACT');document.cookie='kreile_offline_cache_scope=${'f'.repeat(64)}; Path=/';if((await p.readDevicePortResponse('${scope}',true,{port:'order.u2',objectId:'${orderId}'})).code!=='STALE')throw Error('TEST_OTHER_LOGIN_READ_U2');document.cookie='kreile_offline_cache_scope=${scope}; Path=/';return {exactOfflineU2:true};}`]);
  await cli(['eval',`async()=>{const p=window.TESTqueue;await p.retainPendingWorkshopOriginal('${scope}',{kind:'workshop',id:'${key}',itemId:'${orderId}',command:'item.finished',input:{orderId:'${orderId}',itemId:'${itemId}',expectedVersion:${moved.receipt.aggregateVersion},clientEventId:'${key}',finished:true}});const result=await p.syncPendingFiles('${scope}',window.TESTports);if(result.acknowledged||!(await p.readPendingEntries('${scope}')).some(row=>row.id==='${key}'))throw Error('TEST_OFFLINE_CAPTURE_LOST');return true;}`]);
  await cli(['run-code',`async(page)=>{await page.context().setOffline(false);}`]);
  await cli(['eval',`async()=>{const p=window.TESTqueue,result=await p.syncPendingFiles('${scope}',window.TESTports);if(window.TESTacks.length||result.acknowledged||!(await p.readPendingEntries('${scope}')).some(row=>row.id==='${key}'))throw Error('TEST_LOST_RESPONSE_FALSE_ACK');return true;}`]);
  expect(await withSession(full,()=>getLiveOrderCardAction({orderId}))).toMatchObject({code:'OK',data:{card:{version:moved.receipt.aggregateVersion+1,items:[expect.objectContaining({id:itemId,finished:true})]}}});
  await cli(['reload']);await cli(['eval',setup]);
  await cli(['eval',`async()=>{const p=window.TESTqueue,result=await p.syncPendingFiles('${scope}',window.TESTports);if(window.TESTacks.length!==1||window.TESTacks[0].result.code!=='OK'||result.acknowledged!==1||(await p.readPendingEntries('${scope}')).some(row=>row.id==='${key}'))throw Error('TEST_RELOAD_RETRY_NOT_ACKNOWLEDGED');return true;}`]);
  expect(await sql`SELECT count(*)::int AS n FROM public.events WHERE tenant_id=${KREILE_TENANT_SLUG} AND client_event_id=${key}::uuid AND event_type='ORDER_ITEM_FINISHED_CHANGED_V1'`).toEqual([{n:1}]);
  await cli(['eval',`async()=>{await window.TESTqueue.retainPendingWorkshopOriginal('${scope}',{kind:'workshop',id:'${rejectedKey}',itemId:'${orderId}',command:'item.finished',input:{orderId:'${orderId}',itemId:'${itemId}',expectedVersion:1,clientEventId:'${rejectedKey}',finished:true}});return true;}`]);
  actor=await createFixture(['auftraege'],'werkstatt');
  await cli(['eval',`async()=>{const p=window.TESTqueue,result=await p.syncPendingFiles('${scope}',window.TESTports);if(result.acknowledged||!(await p.readPendingEntries('${scope}')).some(row=>row.id==='${rejectedKey}'))throw Error('TEST_FOREIGN_LOGIN_ERASED_ORIGINAL');return true;}`]);
  actor=full;
  const proof=await cli(['eval',`async()=>{const p=window.TESTqueue,result=await p.syncPendingFiles('${scope}',window.TESTports);if(result.acknowledged!==1||(await p.readPendingEntries('${scope}')).length)throw Error('TEST_REJECTED_ORIGINAL_NOT_SECURED');return {reloaded:true,oneBusinessEffect:true,rejectedOriginalPreserved:true};}`]);
  expect(proof.stdout).toContain('"rejectedOriginalPreserved": true');
  expect(await sql`SELECT count(*)::int AS n FROM public.tasks WHERE tenant_id=${KREILE_TENANT_SLUG} AND titel='Konflikt beim Abgleich'`).toEqual([{n:1}]);
  expect(await sql`SELECT count(*)::int AS n FROM public.events WHERE tenant_id=${KREILE_TENANT_SLUG} AND event_type='OFFLINE_WORKSHOP_REJECTED_V1' AND payload->'original'->'input'->>'clientEventId'=${rejectedKey}`).toEqual([{n:1}]);
  const legacyId=randomUUID(),pendingId=randomUUID(),textstand=randomUUID();
  const ended=await cli(['eval',`async()=>{const p=window.TESTqueue;await p.retainPendingOriginal('${scope}',{id:'${legacyId}',itemId:'${legacyId}',kind:'note',text:'TEST unveraenderte alte Notiz',textstand:'${legacyId}',dismissed:[]});const blocked=await p.syncPendingFiles('${scope}',window.TESTports);const rows=await p.readPendingEntries('${scope}');const kept=rows.find(row=>row.kind==='quarantine'&&row.payload.reason==='NOTE_SYNC_METADATA_MISSING');if(!blocked.blocked||!kept||kept.payload.original.text!=='TEST unveraenderte alte Notiz')throw Error('TEST_NOTE_NOT_QUARANTINED');await p.retainPendingOriginal('${scope}',{id:'${pendingId}',itemId:'${pendingId}',kind:'note',text:'TEST verbleibt nach Logout',textstand:'${textstand}',dismissed:[],expectedVersion:0,deviceCapturedAt:new Date().toISOString()});await p.changePendingShellMetadata('${scope}','${scope}',null,true);document.cookie='kreile_offline_cache_scope=${scope}; Path=/';const response=await fetch('/logout',{method:'POST'}),result=await response.json();if(!result.ok||!result.wasAuthenticated||!result.sessionCleared)throw Error('TEST_ACTUAL_LOGOUT_FAILED');p.removeCacheScopeMarker();const cleared=await p.clearLoggedOutReadState('${scope}');const metadata=await p.readPendingShellMetadata('${scope}','${scope}'),after=await p.readPendingEntries('${scope}');if(!cleared.cacheCleared||metadata.code!=='OK'||metadata.metadata.scope!==null||after.length!==2||!after.some(row=>row.id==='${pendingId}'))throw Error('TEST_LOGOUT_ORIGINAL_OR_FENCE');return {offlineRestart:true,exactlyOnce:true,conflictTask:true,serverLogout:true,originalsRetained:true};}`]);
  expect(ended.stdout).toContain('"serverLogout": true');expect(ended.stdout).toContain('"originalsRetained": true');

 }finally{await cli(['close']).catch(()=>{});server.closeAllConnections();await new Promise<void>(resolve=>server.close(()=>resolve()));}
},120000);

// R2 transport boundary: HTML here is only the native queue test harness.
it.skipIf(!process.env.KREILE_PLAYWRIGHT_CLI_JS)('keeps the native original through missing pricing-task evidence and acknowledges only its real follow-up',async()=>{
 const customerId=await customerFixture('Browser R2'),created=await intakeOrderFixture('Browser R2',customerId),orderId=created.receipt.orderId,itemId=created.receipt.items[0].id;
 const moved=await withSession(full,()=>transitionWareneingangToGalvanikAction({orderId,expectedVersion:1,clientEventId:randomUUID()}));if(moved.code!=='OK')throw Error('TEST_MOVE');
 const scope=offlinePartition({tenantId:KREILE_TENANT_SLUG,userId:full.actorId}),key=randomUUID();
 const compiled=await build({stdin:{contents:`export * from './src/lib/offline/pendingStore.ts';export {syncPendingFiles} from './src/lib/offline/syncPendingFiles.ts';`,resolveDir:process.cwd()},bundle:true,write:false,format:'esm',platform:'browser'});
 const server=createServer(async(req,res)=>{
  if(req.url!=='/api'){res.setHeader('Content-Type',req.url==='/queue.mjs'?'text/javascript':'text/html');res.end(req.url==='/queue.mjs'?compiled.outputFiles[0].text:'<!doctype html><title>TEST native R2 queue</title>');return;}
  try{const chunks:Buffer[]=[];for await(const chunk of req)chunks.push(Buffer.from(chunk));const body=JSON.parse(Buffer.concat(chunks).toString('utf8'));const result=await withSession(full,()=>replayOfflineWorkshopAction(body.scope,body.original));res.setHeader('Content-Type','application/json');res.end(JSON.stringify(result));}
  catch{res.statusCode=500;res.end(JSON.stringify({code:'UNAVAILABLE'}));}
 });
 await new Promise<void>(resolve=>server.listen(0,'127.0.0.1',resolve));const address=server.address();if(!address||typeof address==='string')throw Error('TEST_LOOPBACK');
 const execute=promisify(execFile),session='TEST-r2-'+randomUUID();
 const cli=async(args:string[])=>{const result=await execute(process.execPath,[process.env.KREILE_PLAYWRIGHT_CLI_JS!,`-s=${session}`,...args],{timeout:90000,maxBuffer:1024*1024});if(result.stdout.includes('### Error'))throw Error('TEST_BROWSER_FAILED:'+result.stdout.slice(0,700));return result;};
 const setup=`async()=>{const p=await import('/queue.mjs');window.TESTqueue=p;window.TESTacks=[];window.TESTports={workshopAcknowledged:proof=>window.TESTacks.push(proof),currentScope:()=>'${scope}',workshop:async(scope,original)=>(await fetch('/api',{method:'POST',body:JSON.stringify({scope,original})})).json()};return true;}`;
 const fault='test_browser_r2_'+randomUUID().replaceAll('-',''),history=fault+'_history';
 await sql.unsafe(`CREATE FUNCTION private.${fault}() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.tenant_id='${KREILE_TENANT_SLUG}' AND NEW.order_id='${orderId}' AND NEW.component='pricing' THEN RAISE EXCEPTION 'TEST_REAL_PRICE_FAILURE'; END IF; RETURN NEW; END $$`);
 await sql.unsafe(`CREATE TRIGGER ${fault} BEFORE INSERT ON private.order_production_snapshots FOR EACH ROW EXECUTE FUNCTION private.${fault}()`);
 await sql.unsafe(`CREATE FUNCTION private.${history}() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.tenant_id='${KREILE_TENANT_SLUG}' AND NEW.nachher->>'action'='aufgabe.angelegt' THEN RAISE EXCEPTION 'TEST_REAL_TASK_HISTORY_FAILURE'; END IF; RETURN NEW; END $$`);
 await sql.unsafe(`CREATE TRIGGER ${history} BEFORE INSERT ON public.intake_event FOR EACH ROW EXECUTE FUNCTION private.${history}()`);
 try{
  await cli(['open',`http://127.0.0.1:${address.port}/TEST`]);await cli(['eval',setup]);
  const original={kind:'workshop',id:key,itemId:orderId,command:'item.finished',deviceCapturedAt:new Date(Date.now()-8*86400000).toISOString(),input:{orderId,itemId,expectedVersion:moved.receipt.aggregateVersion,clientEventId:key,finished:true}};
  await cli(['eval',`async()=>{await window.TESTqueue.retainPendingWorkshopOriginal('${scope}',${JSON.stringify(original)});const result=await window.TESTqueue.syncPendingFiles('${scope}',window.TESTports);if(result.acknowledged||window.TESTacks.length||!(await window.TESTqueue.readPendingEntries('${scope}')).some(row=>row.id==='${key}'))throw Error('TEST_TASK_FAILURE_FALSE_ACK');return true;}`]);
  expect(await sql`SELECT current_station_id FROM public.items WHERE tenant_id=${KREILE_TENANT_SLUG} AND id=${itemId}`).toEqual([{current_station_id:'fertig'}]);
  expect(await sql`SELECT id FROM public.tasks WHERE tenant_id=${KREILE_TENANT_SLUG} AND bezug_id=${orderId}`).toHaveLength(0);
  await sql.unsafe(`DROP TRIGGER ${history} ON public.intake_event`);
  await cli(['reload']);await cli(['eval',setup]);
  await cli(['eval',`async()=>{const result=await window.TESTqueue.syncPendingFiles('${scope}',window.TESTports);if(result.acknowledged!==1||window.TESTacks.length!==1||(await window.TESTqueue.readPendingEntries('${scope}')).length)throw Error('TEST_REAL_TASK_NOT_ACKNOWLEDGED');return true;}`]);
  expect(await sql`SELECT id FROM public.tasks WHERE tenant_id=${KREILE_TENANT_SLUG} AND bezug_id=${orderId}`).toHaveLength(1);
  expect(await sql`SELECT id FROM public.events WHERE tenant_id=${KREILE_TENANT_SLUG} AND client_event_id=${key}::uuid`).toHaveLength(1);
  expect(await sql`SELECT id FROM public.events WHERE tenant_id=${KREILE_TENANT_SLUG} AND event_type='OFFLINE_WORKSHOP_REJECTED_V1' AND payload->'original'->'input'->>'clientEventId'=${key}`).toHaveLength(0);
 }finally{
  await cli(['close']).catch(()=>{});server.closeAllConnections();await new Promise<void>(resolve=>server.close(()=>resolve()));
  await sql.unsafe(`DROP TRIGGER IF EXISTS ${history} ON public.intake_event`);await sql.unsafe(`DROP FUNCTION IF EXISTS private.${history}()`);
  await sql.unsafe(`DROP TRIGGER IF EXISTS ${fault} ON private.order_production_snapshots`);await sql.unsafe(`DROP FUNCTION IF EXISTS private.${fault}()`);
 }
},120000);
