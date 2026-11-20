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
import type {DiagnosticFact} from '@/modules/logging/public';
if(!process.env.DATABASE_URL||process.env.DATABASE_URL!==process.env.H18_EXPECTED_DATABASE_URL||new URL(process.env.DATABASE_URL).hostname!=='127.0.0.1'||!KREILE_TENANT_SLUG.startsWith('TEST-ablauf-'))throw Error('S20_DEDICATED_TEST_REPLAY_REQUIRED');

it('L8 native command hang/repeat/abort and offline diagnostics reach the actual writer; a lost exact acknowledgement repeats no stored click',async()=>{
 await sql`INSERT INTO public.company_settings(id,tenant_id,company_name) VALUES(${randomUUID()},${KREILE_TENANT_SLUG},'TEST S20 native clicks')`;
 const customer=await customerFixture('S20 native click'),created=await intakeOrderFixture('S20 native click',customer);
 const [mode]=await sql`SELECT payment_mode_version AS version FROM public.orders WHERE tenant_id=${KREILE_TENANT_SLUG} AND id=${created.receipt.orderId}`;
 const command={orderId:created.receipt.orderId,paymentMode:'abholung' as const,expectedVersion:mode.version,clientEventId:randomUUID()};
 const compiled=await build({stdin:{contents:"export {installProtocolClickCapture} from './src/modules/logging/public';export {runServerAction} from './src/lib/client/runServerAction';",resolveDir:process.cwd(),loader:'ts'},bundle:true,write:false,format:'esm',platform:'browser'});
 const bootstrap=`import * as client from '/capture.mjs';
 const state=await(await fetch('/TEST/state')).json();if(state.code!=='OK'||!state.enabled)throw Error('TEST_REAL_CAPTURE_STATE_REQUIRED');
 window.TESToverflowAck=0;window.TESTlocalAck=0;
 client.installProtocolClickCapture(state.scope,async(entries,scope)=>{const result=await fetch('/TEST/clicks',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({entries,scope})});const receipt=result.ok?await result.json():{code:'UNAVAILABLE'};window.TESToverflowAck+=entries.filter(entry=>entry.target?.startsWith('test.overflow.')&&receipt.accepted?.includes(entry.id)).length;window.TESTlocalAck+=entries.filter(entry=>entry.target==='test.local'&&receipt.accepted?.includes(entry.id)).length;return receipt;});
 window.TESTpending=[];
 document.querySelector('#command').addEventListener('click',()=>{window.TESTpending.push(client.runServerAction(async()=>{const result=await fetch('/TEST/command',{method:'POST',headers:{'content-type':'application/json'},body:'{}'});return result.json();}));});
 document.querySelector('#abort').addEventListener('click',()=>{window.TESTpending.push(client.runServerAction(async()=>{const controller=new AbortController();controller.abort(new DOMException('TEST PRIVATE_BROWSER_FAULT Bearer x','AbortError'));return fetch('/TEST/command',{method:'POST',body:'{}',signal:controller.signal});}));});
 window.TESTready=true;`;
 let loseAck=false,commandCalls=0;const attempts:DiagnosticFact[][]=[];
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
  await expect.poll(async()=>Number((await sql`SELECT count(*)::int AS n FROM public.technical_protocol WHERE tenant_id=${KREILE_TENANT_SLUG} AND command='ACTION_REQUEST_FAILED'`)[0].n)).toBe(1);
  const errors=await sql`SELECT * FROM public.technical_protocol WHERE tenant_id=${KREILE_TENANT_SLUG} AND command='ACTION_REQUEST_FAILED'`;
  expect(errors[0].user_id).toBe(full.actorId);expect(JSON.stringify(errors)).not.toContain('PRIVATE_BROWSER_FAULT');expect(JSON.stringify(errors)).not.toContain('Bearer x');
  expect(commandCalls).toBe(2);expect(await sql`SELECT payment_mode FROM public.orders WHERE tenant_id=${KREILE_TENANT_SLUG} AND id=${command.orderId}`).toEqual([{payment_mode:'abholung'}]);
  expect(await sql`SELECT id FROM public.events WHERE tenant_id=${KREILE_TENANT_SLUG} AND order_id=${command.orderId} AND event_type='PAYMENT_MODE_SET_V1' AND client_event_id=${command.clientEventId}::uuid`).toHaveLength(1);
  await context.setOffline(true);await page.locator('#local').click();await page.evaluate(()=>new Promise<void>(resolve=>setTimeout(resolve,0)));
  expect(await sql`SELECT id FROM public.app_usage_events WHERE tenant_id=${KREILE_TENANT_SLUG} AND target='test.local'`).toHaveLength(0);
  loseAck=true;await context.setOffline(false);
  await expect.poll(async()=>Number((await sql`SELECT count(*)::int AS n FROM public.app_usage_events WHERE tenant_id=${KREILE_TENANT_SLUG} AND target='test.local'`)[0].n)).toBe(1);
  const first=attempts.find(batch=>batch.some(entry=>'target'in entry&&entry.target==='test.local'));expect(first).toBeDefined();
  await context.setOffline(true);await context.setOffline(false);
  await expect.poll(()=>attempts.filter(batch=>batch.some(entry=>'target'in entry&&entry.target==='test.local')).length).toBe(2);
  expect(attempts.filter(batch=>batch.some(entry=>'target'in entry&&entry.target==='test.local'))[1]).toEqual(first);
  expect(await sql`SELECT outcome,duration_ms FROM public.app_usage_events WHERE tenant_id=${KREILE_TENANT_SLUG} AND target='test.local'`).toEqual([{outcome:null,duration_ms:null}]);
  // A server-observed retry is not its browser-consumed ACK: finish that
  // actual reply before taking the network down for the separate 600-click case.
  await page.waitForFunction(()=>(window as unknown as {TESTlocalAck:number}).TESTlocalAck===1);
  // PL19:41 K1: actual browser buffer, same authenticated transport and DB.
  await context.setOffline(true);
  await page.evaluate(async()=>{
   const button=document.querySelector<HTMLButtonElement>('#local')!;
   for(let i=0;i<600;i++){button.setAttribute('data-spec-id','test.overflow.'+String(i).padStart(4,'0'));button.click();}
   await new Promise<void>(resolve=>setTimeout(resolve,0));
  });
  expect(await sql`SELECT id FROM public.app_usage_events WHERE tenant_id=${KREILE_TENANT_SLUG} AND target LIKE 'test.overflow.%'`).toHaveLength(0);
  await context.setOffline(false);
  await page.waitForFunction(()=>(window as unknown as {TESToverflowAck:number}).TESToverflowAck===500);
  const overflow=await sql`SELECT target FROM public.app_usage_events WHERE tenant_id=${KREILE_TENANT_SLUG} AND target LIKE 'test.overflow.%' ORDER BY target`;
  expect(overflow[0].target).toBe('test.overflow.0100');expect(overflow[499].target).toBe('test.overflow.0599');
  expect(await sql`SELECT verpasst FROM public.technical_protocol WHERE tenant_id=${KREILE_TENANT_SLUG} AND command='PROTOCOL_CLIENT_ENTRIES_MISSED'`).toEqual([{verpasst:100}]);
  const read=await withSession(full,()=>getProtocolLogAction({capture:true}));expect(read.code).toBe('OK');
 }finally{await context?.close();await browser?.close();await new Promise<void>((resolve,reject)=>server.close(error=>error?reject(error):resolve()));}
});
