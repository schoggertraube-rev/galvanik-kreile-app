// @vitest-environment node
// Actual customer Action/Auth/DB behind a delayed TEST HTTP bridge. Not an app-start proof.
import {it,expect,vi} from 'vitest';
import {createServer} from 'node:http';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {randomUUID} from 'node:crypto';
import {build} from 'esbuild';
const tenant=vi.hoisted(()=>'TEST-ablauf-'+globalThis.crypto.randomUUID());
vi.mock('@/lib/tenant',()=>({KREILE_TENANT_SLUG:tenant}));
import {createFixture,withSession} from '../../../e2e/ablauf/replayHarness';
import {getCustomersDb} from '@/app/actions/customers.actions';
import {GET} from '@/app/api/offline/heartbeat/route';

it.skipIf(!process.env.KREILE_PLAYWRIGHT_CLI_JS)('CB18:25 preserves twelve-second real Actions with successful and failed independent heartbeats',async()=>{
 const actor=await createFixture(['kunden']);
 const compiled=await build({stdin:{contents:"export {installServerReachability,readServerReachability} from './src/lib/offline/serverReachability';",resolveDir:process.cwd()},bundle:true,write:false,format:'esm',platform:'browser'});
 let blocked=false,reads=0,heartbeats=0;
 const server=createServer((req,res)=>{void(async()=>{
  if(req.url==='/module.mjs'){res.setHeader('content-type','text/javascript');res.end(compiled.outputFiles[0].text);return;}
  if(req.url==='/TEST-503'){res.writeHead(503);res.end('TEST server unavailable');return;}
  if(req.url==='/api/offline/heartbeat'){
   heartbeats++;if(blocked){req.socket.destroy();return;}
   const reply=await GET();res.writeHead(reply.status,Object.fromEntries(reply.headers));res.end(await reply.text());return;
  }
  if(req.url?.startsWith('/slow-read')){
   blocked=req.url.includes('blocked');
   await new Promise(resolve=>setTimeout(resolve,12_000));
   const result=await withSession(actor,()=>getCustomersDb());reads++;
   res.setHeader('content-type','application/json');res.end(JSON.stringify(result));return;
  }
  res.setHeader('content-type','text/html');res.end('<!doctype html><title>TEST actual delayed Action transport; not an app page</title>');
 })().catch(error=>{console.error('[TEST_LONG_ACTION_BRIDGE]',error);res.statusCode=500;res.end('TEST bridge failed');});});
 await new Promise<void>(resolve=>server.listen(0,'127.0.0.1',resolve));const address=server.address();if(!address||typeof address==='string')throw Error('TEST_LOOPBACK');
 const execute=promisify(execFile),session='TEST-long-action-'+randomUUID();
 const cli=(args:string[])=>execute(process.execPath,[process.env.KREILE_PLAYWRIGHT_CLI_JS!,`-s=${session}`,...args],{timeout:90_000,maxBuffer:1024*1024});
 try{
  await cli(['open',`http://127.0.0.1:${address.port}/TEST`]);
  const code=`async()=>{
   const p=await import('/module.mjs'),originalFetch=window.fetch;
   if((await fetch('/TEST-503')).status!==503||!p.readServerReachability()||window.fetch!==originalFetch)throw Error('TEST_FLAG_OFF_CHANGED_NAVIGATOR_BEHAVIOR');
   const offAction=await(await fetch('/slow-read?flagoff=1',{method:'POST',body:'TEST flag OFF original Action'})).json();
   if(!offAction.ok||!p.readServerReachability()||window.fetch!==originalFetch)throw Error('TEST_FLAG_OFF_BLOCKED_REAL_ACTION');
   const stop=p.installServerReachability();
   try{
    for(const blocked of [false,true]){
     const controller=new AbortController(),started=Date.now();
     const pending=fetch('/slow-read'+(blocked?'?blocked=1':''),{method:'POST',body:'TEST unchanged Action body',signal:controller.signal});
     await new Promise(resolve=>setTimeout(resolve,8500));
     if(p.readServerReachability()===blocked||controller.signal.aborted)throw Error('TEST_HEALTH_FACT_OR_ORIGINAL_ABORT');
     const response=await pending,result=await response.json();
     if(Date.now()-started<12_000||!result.ok||!Array.isArray(result.data)||controller.signal.aborted||p.readServerReachability()===blocked)throw Error('TEST_REAL_LONG_ACTION_DID_NOT_FINISH');
    }
    return {realLongActions:3,flagOff503Unchanged:true,originalsNeverAborted:true,independentHeartbeat:true};
   }finally{stop();}
  }`;
  const result=await cli(['eval',`async()=>await(eval(atob('${Buffer.from('('+code+')').toString('base64')}')))()`]);
  expect(result.stdout).not.toContain('### Error');expect(result.stdout).toContain('"realLongActions": 3');expect(result.stdout).toContain('"flagOff503Unchanged": true');expect(reads).toBe(3);expect(heartbeats).toBe(2);
 }finally{await cli(['close']).catch(()=>{});await new Promise<void>(resolve=>server.close(()=>resolve()));}
},120_000);
