// @vitest-environment node
import {it,expect} from 'vitest';
import {createServer} from 'node:http';
import {readFileSync} from 'node:fs';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {randomUUID} from 'node:crypto';
const execute=promisify(execFile);
it.skipIf(!process.env.KREILE_PLAYWRIGHT_CLI_JS)('real service worker preserves public build assets offline without caching API or login responses',async()=>{
 const session='TEST-sw-'+randomUUID();
 const server=createServer((req,res)=>{
  if(req.url==='/sw.js'){res.setHeader('Content-Type','text/javascript');res.end(readFileSync('public/sw.js'));return;}
  if(req.url==='/_next/static/TEST.js'){res.setHeader('Content-Type','text/javascript');res.end('/* TEST public compiled asset */');return;}
  if(req.url==='/api/TEST-private'){res.setHeader('Content-Type','application/json');res.end('{"TESTbalance":123}');return;}
  if(req.url==='/manifest.webmanifest'){res.setHeader('Content-Type','application/manifest+json');res.end('{}');return;}
  if(req.url?.startsWith('/icons/')){res.setHeader('Content-Type','image/png');res.end(Buffer.from([1]));return;}
  res.setHeader('Content-Type','text/html');res.end('<!doctype html><title>TEST service worker</title>');
 });
 await new Promise<void>(resolve=>server.listen(0,'127.0.0.1',resolve));const address=server.address();if(!address||typeof address==='string')throw Error('TEST_ORIGIN');
 const cli=async(args:string[])=>{try{return await execute(process.execPath,[process.env.KREILE_PLAYWRIGHT_CLI_JS!,`-s=${session}`,...args],{maxBuffer:1024*1024,timeout:60000});}catch(error){const detail=error as {stdout?:string;stderr?:string};throw Error('TEST_BROWSER_CLI:'+String(detail.stdout??detail.stderr??'failed').slice(0,500));}};
 const evaluate=async(code:string)=>{const encoded=Buffer.from('('+code+')').toString('base64');const r=await cli(['eval',`async()=>await(eval(atob('${encoded}')))()`]);if(r.stdout.includes('### Error'))throw Error(r.stdout.slice(0,300));return r.stdout;};
 try{
  await cli(['open',`http://127.0.0.1:${address.port}/TEST-sw`]);
  const online=await evaluate(`async()=>{
   await navigator.serviceWorker.register('/sw.js');await navigator.serviceWorker.ready;
   if(!navigator.serviceWorker.controller)await new Promise(resolve=>navigator.serviceWorker.addEventListener('controllerchange',resolve,{once:true}));
   await(await fetch('/_next/static/TEST.js')).text();await(await fetch('/api/TEST-private')).text();await(await fetch('/login')).text();
   for(let i=0;i<20&&!await caches.match('/_next/static/TEST.js',{cacheName:'kreile-static-assets-v1'});i++)await new Promise(r=>setTimeout(r,25));
   if(!await caches.match('/_next/static/TEST.js',{cacheName:'kreile-static-assets-v1'})||await caches.match('/api/TEST-private')||await caches.match('/login'))throw Error('TEST_CACHE_ADMISSION');
   return {publicAssetCached:true,privateCached:false};
  }`);expect(online).toContain('"publicAssetCached": true');
  await cli(['run-code','async(page)=>{await page.context().setOffline(true);}']);
  const offline=await evaluate(`async()=>{const text=await(await fetch('/_next/static/TEST.js')).text();let privateFailed=false;try{await fetch('/api/TEST-private');}catch{privateFailed=true;}if(text!=='/* TEST public compiled asset */'||!privateFailed)throw Error('TEST_OFFLINE_BOUNDARY');return {offlineAsset:true,privateUnavailable:true};}`);
  expect(offline).toContain('"offlineAsset": true');
 }finally{await cli(['close']).catch(()=>{});await new Promise<void>(resolve=>server.close(()=>resolve()));}
},120000);
