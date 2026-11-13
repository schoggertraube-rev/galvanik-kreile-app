// @vitest-environment node
// Native browser storage faults + actual PIN Action/Auth/DB. Not an app-start proof.
import {it,expect,vi} from 'vitest';
import {build} from 'esbuild';
import {createServer} from 'node:http';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {randomUUID} from 'node:crypto';
const tenant=vi.hoisted(()=>'TEST-ablauf-'+globalThis.crypto.randomUUID());
vi.mock('@/lib/tenant',()=>({KREILE_TENANT_SLUG:tenant}));
import {withSession,createFixture} from '../../../e2e/ablauf/replayHarness';
import {saveManagedUserAction} from '@/app/actions/settings.actions';
import {getAuthorizationSnapshotAction,loginWithPin} from '@/app/actions/auth.actions';
import {createPinLoginHandle} from '@/lib/server/pinLoginHandle';
import {COOKIE_NAME,readAppSession} from '@/lib/server/appSession';
import {cookies} from 'next/headers';

it.skipIf(!process.env.KREILE_PLAYWRIGHT_CLI_JS)('S06a B1 keeps actual PIN login available with missing or failed native stores and fences old reads',async()=>{
 const manager=await createFixture(['einstellungen','logins']),actor=await createFixture(['auftraege']);
 expect(await withSession(manager,()=>saveManagedUserAction({userId:actor.actorId,fullName:'TEST storage PIN',shortCode:'SP',designation:'TEST storage',active:true,pin:'7654'}))).toMatchObject({code:'OK'});
 actor.actorIssuedAt=Date.now();
 const handle=createPinLoginHandle(actor.actorId),auth=await withSession(actor,()=>getAuthorizationSnapshotAction());
 if(!auth.ok||!auth.data.offlineScope)throw Error('TEST_SCOPE');
 const compiled=await build({stdin:{contents:"export * from './src/lib/offline/pendingStore';export {clearPrivateReadStateBeforeLogin,qualifiedPrivateCacheName,readScopedPrivateResponse} from './src/lib/offline/privateReadCache';",resolveDir:process.cwd()},bundle:true,write:false,format:'esm',platform:'browser'});
 let successfulLogins=0;
 const server=createServer((req,res)=>{void(async()=>{
  if(req.url==='/module.mjs'){res.setHeader('content-type','text/javascript');res.end(compiled.outputFiles[0].text);return;}
  if(req.url==='/TEST-login'&&req.method==='POST'){
   const result=await withSession(actor,async()=>{
    (await cookies()).delete(COOKIE_NAME);
    if((await readAppSession()).ok)throw Error('TEST_PIN_STARTED_AUTHENTICATED');
    const login=await loginWithPin(handle,'7654'),session=await readAppSession();
    if(login.ok&&session.ok&&session.session.userId===actor.actorId)successfulLogins++;
    return {ok:login.ok&&session.ok&&session.session.userId===actor.actorId};
   });res.setHeader('content-type','application/json');res.end(JSON.stringify(result));return;
  }
  res.setHeader('content-type','text/html');res.end('<!doctype html><title>TEST native storage/PIN bridge; not an application page</title>');
 })().catch(error=>{console.error('[TEST_STORAGE_PIN_BRIDGE]',error);res.statusCode=500;res.end('TEST bridge failed');});});
 await new Promise<void>(resolve=>server.listen(0,'127.0.0.1',resolve));const address=server.address();if(!address||typeof address==='string')throw Error('TEST_LOOPBACK');
 const execute=promisify(execFile),session='TEST-storage-pin-'+randomUUID();
 const cli=(args:string[])=>execute(process.execPath,[process.env.KREILE_PLAYWRIGHT_CLI_JS!,`-s=${session}`,...args],{timeout:90_000,maxBuffer:1024*1024});
 try{
  await cli(['open',`http://127.0.0.1:${address.port}/TEST`]);
  const code=`async()=>{
   const p=await import('/module.mjs'),scope='${auth.data.offlineScope}';
   const nativeDescriptor=Object.getOwnPropertyDescriptor(window,'indexedDB'),nativeKeys=CacheStorage.prototype.keys;
   for(const [index,kind] of ['missing','throwing','cache-delete'].entries()){
    const login=String(index+1).repeat(64);document.cookie='kreile_offline_cache_scope='+login+'; Path=/';
    await p.changePendingShellMetadata(scope,login,null,true);
    await p.retainPendingOriginal(scope,{id:'TEST-retained-'+index,itemId:'TEST-item-'+index,kind:'note',text:'TEST immutable original '+index,textstand:'TEST-'+index,dismissed:[]});
    const cache=p.qualifiedPrivateCacheName(scope,login,1);await(await caches.open(cache)).put('/TEST-private',new Response('TEST old private HTML',{headers:{'content-type':'text/html'}}));
    if(kind==='missing')Object.defineProperty(window,'indexedDB',{configurable:true,value:undefined});
    if(kind==='throwing')Object.defineProperty(window,'indexedDB',{configurable:true,get(){throw new DOMException('TEST unavailable','SecurityError');}});
    if(kind==='cache-delete')CacheStorage.prototype.keys=async()=>{throw Error('TEST cache deletion');};
    try{
     if((await p.clearPrivateReadStateBeforeLogin()).code!=='UNAVAILABLE')throw Error('TEST_FALSE_CLEANUP_SUCCESS');
     if(await p.readScopedPrivateResponse(scope,login,new URL('/TEST-private',location.href))!==null)throw Error('TEST_OLD_PRIVATE_READ');
     const logged=await(await fetch('/TEST-login',{method:'POST'})).json();if(!logged.ok)throw Error('TEST_PIN_BLOCKED_BY_STORAGE');
    }finally{if(nativeDescriptor)Object.defineProperty(window,'indexedDB',nativeDescriptor);else Reflect.deleteProperty(window,'indexedDB');CacheStorage.prototype.keys=nativeKeys;}
    await p.clearPrivateReadStateBeforeLogin();
    const originals=await p.readPendingEntries(scope);if(originals.length!==index+1||originals.some(row=>row.kind!=='note'||!row.text.startsWith('TEST immutable original ')))throw Error('TEST_ORIGINAL_LOST');
   }
   return {actualPinLogins:3,oldReadsFenced:true,originalsPreserved:true};
  }`;
  const result=await cli(['eval',`async()=>await(eval(atob('${Buffer.from('('+code+')').toString('base64')}')))()`]);
  expect(result.stdout).not.toContain('### Error');expect(result.stdout).toContain('"actualPinLogins": 3');expect(successfulLogins).toBe(3);
 }finally{await cli(['close']).catch(()=>{});await new Promise<void>(resolve=>server.close(()=>resolve()));}
},120_000);
