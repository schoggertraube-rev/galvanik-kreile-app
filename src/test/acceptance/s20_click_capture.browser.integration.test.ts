// @vitest-environment node
// TEST controls, native browser/network, actual capture module + Actions/Auth/DB.
// This is not the full Next page, durable-buffer/reload, tablet, or 24h acceptance.
import {expect,it,vi} from 'vitest';
import {randomUUID} from 'node:crypto';
import {createServer} from 'node:http';
import {build} from 'esbuild';
import {chromium,type Browser,type BrowserContext} from 'playwright';
const tenant=vi.hoisted(()=>'TEST-ablauf-'+globalThis.crypto.randomUUID());
vi.mock('@/lib/tenant',()=>({KREILE_TENANT_SLUG:tenant}));
import {KREILE_TENANT_SLUG} from '@/lib/tenant';
import {sql,full,withSession,withRequest} from '../../../e2e/ablauf/replayHarness';
import {customerFixture,intakeOrderFixture} from '../../../e2e/ablauf/orderFixture';
import {getProtocolLogAction,recordProtocolClicksAction} from '@/app/actions/logging.actions';
import {setPaymentModeAction} from '@/app/actions/payments.actions';
import {COOKIE_NAME,signAppSession,getSecretKey} from '@/lib/server/appSession';
import type {ClickFact} from '@/modules/logging/public';
if(!process.env.DATABASE_URL||process.env.DATABASE_URL!==process.env.H18_EXPECTED_DATABASE_URL||new URL(process.env.DATABASE_URL).hostname!=='127.0.0.1'||!KREILE_TENANT_SLUG.startsWith('TEST-ablauf-'))throw Error('S20_DEDICATED_TEST_REPLAY_REQUIRED');

it('L8 native command hang/repeat/abort and offline diagnostics reach the actual writer; a lost exact acknowledgement repeats no stored click',async()=>{
 await sql`INSERT INTO public.company_settings(id,tenant_id,company_name) VALUES(${randomUUID()},${KREILE_TENANT_SLUG},'TEST S20 native clicks')`;
 const customer=await customerFixture('S20 native click'),created=await intakeOrderFixture('S20 native click',customer);
 const [mode]=await sql`SELECT payment_mode_version AS version FROM public.orders WHERE tenant_id=${KREILE_TENANT_SLUG} AND id=${created.receipt.orderId}`;
 const command={orderId:created.receipt.orderId,paymentMode:'abholung' as const,expectedVersion:mode.version,clientEventId:randomUUID()};
 const compiled=await build({stdin:{contents:"export {installProtocolClickCapture} from './src/modules/logging/public';export {runServerAction} from './src/lib/client/runServerAction';",resolveDir:process.cwd(),loader:'ts'},bundle:true,write:false,format:'esm',platform:'browser'});
 const bootstrap=`import * as client from '/capture.mjs';
 const state=await(await fetch('/TEST/state')).json();if(state.code!=='OK'||!state.enabled)throw Error('TEST_REAL_CAPTURE_STATE_REQUIRED');
 client.installProtocolClickCapture(state.scope,async(entries,scope)=>{const result=await fetch('/TEST/clicks',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({entries,scope})});return result.ok?result.json():{code:'UNAVAILABLE'};});
 window.TESTpending=[];
 document.querySelector('#command').addEventListener('click',()=>{window.TESTpending.push(client.runServerAction(async()=>{const result=await fetch('/TEST/command',{method:'POST',headers:{'content-type':'application/json'},body:'{}'});return result.json();}));});
 document.querySelector('#abort').addEventListener('click',()=>{window.TESTpending.push(client.runServerAction(async()=>{const controller=new AbortController();controller.abort();return fetch('/TEST/command',{method:'POST',body:'{}',signal:controller.signal});}));});
 window.TESTready=true;`;
 let loseAck=false,commandCalls=0;const attempts:ClickFact[][]=[];
 const server=createServer(async(req,res)=>{
  if(req.url==='/capture.mjs'){res.writeHead(200,{'content-type':'text/javascript'});res.end(compiled.outputFiles[0].text);return;}
  if(req.url==='/bootstrap.mjs'){res.writeHead(200,{'content-type':'text/javascript'});res.end(bootstrap);return;}
  if(req.url==='/TEST/state'||req.url==='/TEST/clicks'||req.url==='/TEST/command'){
   try{
    if(req.url==='/TEST/state'){const state=await withRequest(req.headers.cookie??'',()=>getProtocolLogAction({capture:true}));res.writeHead(200,{'content-type':'application/json'});res.end(JSON.stringify(state));return;}
    const chunks:Buffer[]=[];for await(const part of req)chunks.push(Buffer.from(part));const body=JSON.parse(Buffer.concat(chunks).toString());
    if(req.url==='/TEST/command'){
     commandCalls++;await new Promise(resolve=>setTimeout(resolve,3500));
     const result=await withRequest(req.headers.cookie??'',()=>setPaymentModeAction(command));res.writeHead(200,{'content-type':'application/json'});res.end(JSON.stringify(result));return;
    }
    attempts.push(body.entries);
    const result=await withRequest(req.headers.cookie??'',()=>recordProtocolClicksAction(body.entries,body.scope));
    if(result.code==='OK'&&loseAck){loseAck=false;res.writeHead(503);res.end();return;}
    res.writeHead(200,{'content-type':'application/json'});res.end(JSON.stringify(result));return;
   }catch{res.writeHead(503);res.end();return;}
  }
  const token=signAppSession({userId:full.actorId,tenantId:KREILE_TENANT_SLUG,role:full.role,displayName:'TEST capture actor',issuedAt:full.actorIssuedAt,expiresAt:Date.now()+300000},getSecretKey());
  res.writeHead(200,{'content-type':'text/html','set-cookie':`${COOKIE_NAME}=${token}; HttpOnly; Path=/; SameSite=Lax`});
  res.end('<!doctype html><title>TEST diagnostic controls</title><button data-spec-id="test.command" id="command">TEST command</button><button data-spec-id="test.abort" id="abort">TEST abort</button><button data-spec-id="test.local" id="local">TEST local</button><script type="module" src="/bootstrap.mjs"></script>');
 });
 await new Promise<void>(resolve=>server.listen(0,'127.0.0.1',resolve));const address=server.address();if(!address||typeof address==='string')throw Error('TEST_LOOPBACK_REQUIRED');
 let browser:Browser|undefined,context:BrowserContext|undefined;
 try{
  browser=await chromium.launch({headless:true});context=await browser.newContext();const page=await context.newPage();
  await page.goto(`http://127.0.0.1:${address.port}/test`);
  await page.waitForFunction(()=>(window as unknown as {TESTready?:boolean}).TESTready===true);
  await page.locator('#command').dblclick();
  await page.evaluate(async()=>{await Promise.all((window as unknown as {TESTpending:Promise<unknown>[]}).TESTpending);});
  await page.locator('#abort').click();
  await page.waitForFunction(()=>document.querySelector('#abort')!==null);
  await expect.poll(async()=>Number((await sql`SELECT count(*)::int AS n FROM public.app_usage_events WHERE tenant_id=${KREILE_TENANT_SLUG} AND target IN('test.command','test.abort')`)[0].n)).toBe(3);
  const native=await sql`SELECT target,duration_ms,click_count,outcome FROM public.app_usage_events WHERE tenant_id=${KREILE_TENANT_SLUG}`;
  expect(native.filter(row=>row.target==='test.command')).toHaveLength(2);expect(native.filter(row=>row.target==='test.command').every(row=>row.outcome==='success')).toBe(true);expect(native.some(row=>row.click_count===2&&row.duration_ms>=3500)).toBe(true);expect(native.find(row=>row.target==='test.abort')?.outcome).toBe('cancelled');
  expect(commandCalls).toBe(2);expect(await sql`SELECT payment_mode FROM public.orders WHERE tenant_id=${KREILE_TENANT_SLUG} AND id=${command.orderId}`).toEqual([{payment_mode:'abholung'}]);
  expect(await sql`SELECT id FROM public.events WHERE tenant_id=${KREILE_TENANT_SLUG} AND order_id=${command.orderId} AND event_type='PAYMENT_MODE_SET_V1' AND client_event_id=${command.clientEventId}::uuid`).toHaveLength(1);
  await context.setOffline(true);await page.locator('#local').click();await page.evaluate(()=>new Promise<void>(resolve=>setTimeout(resolve,0)));
  expect(await sql`SELECT id FROM public.app_usage_events WHERE tenant_id=${KREILE_TENANT_SLUG} AND target='test.local'`).toHaveLength(0);
  loseAck=true;await context.setOffline(false);
  await expect.poll(async()=>Number((await sql`SELECT count(*)::int AS n FROM public.app_usage_events WHERE tenant_id=${KREILE_TENANT_SLUG} AND target='test.local'`)[0].n)).toBe(1);
  const first=attempts.find(batch=>batch.some(entry=>entry.target==='test.local'));expect(first).toBeDefined();
  await context.setOffline(true);await context.setOffline(false);
  await expect.poll(()=>attempts.filter(batch=>batch.some(entry=>entry.target==='test.local')).length).toBe(2);
  expect(attempts.filter(batch=>batch.some(entry=>entry.target==='test.local'))[1]).toEqual(first);
  expect(await sql`SELECT outcome,duration_ms FROM public.app_usage_events WHERE tenant_id=${KREILE_TENANT_SLUG} AND target='test.local'`).toEqual([{outcome:null,duration_ms:null}]);
  const read=await withSession(full,()=>getProtocolLogAction({capture:true}));expect(read.code).toBe('OK');
 }finally{await context?.close();await browser?.close();await new Promise<void>((resolve,reject)=>server.close(error=>error?reject(error):resolve()));}
});
