// @vitest-environment node
import {it,expect} from 'vitest';
import {createServer} from 'node:http';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {randomUUID} from 'node:crypto';
import {build} from 'esbuild';

it.skipIf(!process.env.KREILE_PLAYWRIGHT_CLI_JS)('revokes native reading state despite cache failure and preserves queued original bytes and actor partition',async()=>{
 const compiled=await build({stdin:{contents:`export * from './src/lib/offline/pendingStore.ts';export * from './src/lib/offline/logoutReadState.ts';export {clearPrivateReadStateBeforeLogin} from './src/lib/offline/privateReadCache.ts';`,resolveDir:process.cwd()},bundle:true,write:false,format:'esm',platform:'browser'});
 const server=createServer((req,res)=>{res.setHeader('Content-Type',req.url==='/queue.mjs'?'text/javascript':'text/html');res.end(req.url==='/queue.mjs'?compiled.outputFiles[0].text:'<!doctype html><title>TEST native logout cache cleanup; not an app-start proof</title>');});
 await new Promise<void>(resolve=>server.listen(0,'127.0.0.1',resolve));const address=server.address();if(!address||typeof address==='string')throw Error('TEST_LOOPBACK');
 const execute=promisify(execFile),session='TEST-logout-'+randomUUID();
 const cli=(args:string[])=>execute(process.execPath,[process.env.KREILE_PLAYWRIGHT_CLI_JS!,`-s=${session}`,...args],{maxBuffer:1024*1024,timeout:90000});
 try{
  await cli(['open',`http://127.0.0.1:${address.port}/TEST`]);
  const code=`async()=>{
   const p=await import('/queue.mjs'),scope='${'a'.repeat(64)}',other='${'b'.repeat(64)}',login='${'c'.repeat(64)}';
   await p.changePendingShellMetadata(scope,login,null,true);
   await p.retainPendingOriginal(scope,{id:'TEST-original',itemId:'TEST-item',kind:'file',file:new File(['TEST immutable bytes'],'TEST.bin'),deviceCapturedAt:'2026-11-10T10:00:00.000Z'});
   await p.retainPendingOriginal(other,{id:'TEST-other',itemId:'TEST-other-item',kind:'note',text:'TEST foreign actor',textstand:'TEST',dismissed:[]});
   const capturedAt=(await p.readPendingEntries(scope))[0].deviceCapturedAt;
   const own=p.privateReadCachePrefix(scope)+'1',foreign=p.privateReadCachePrefix(other)+'1';
   await (await caches.open(own)).put('/TEST-private',new Response('TEST own read data'));
   await (await caches.open(foreign)).put('/TEST-private',new Response('TEST foreign read data'));
   const nativeKeys=CacheStorage.prototype.keys;CacheStorage.prototype.keys=async function(){throw Error('TEST cache failure');};
   let result;try{result=await p.clearLoggedOutReadState(scope);}finally{CacheStorage.prototype.keys=nativeKeys;}
   if(result.cacheCleared||result.pendingCount!==1)throw Error('TEST_FALSE_CLEANUP_SUCCESS');
   const metadata=await p.readPendingShellMetadata(scope,login);
   if(metadata.code!=='OK'||metadata.metadata.scope!==null)throw Error('TEST_LATE_CACHE_STILL_ALLOWED');
   // Retry uses the same canonical cleanup, never creates a second queue.
   await p.deletePrivateReadCaches(scope);
   if((await caches.keys()).includes(own)||!(await caches.keys()).includes(foreign))throw Error('TEST_CACHE_PARTITION_DELETE');
   const originals=await p.readPendingEntries(scope),foreignOriginals=await p.readPendingEntries(other);
   if(originals.length!==1||await originals[0].file.text()!=='TEST immutable bytes'||originals[0].deviceCapturedAt!==capturedAt||foreignOriginals.length!==1)throw Error('TEST_ORIGINAL_LOST_OR_REASSIGNED');
   const pendingCache=p.privateReadCachePrefix(scope)+login+'-2';
   await (await caches.open(pendingCache)).put('/TEST-pending-read',new Response('TEST retained until cleanup'));
   document.cookie='kreile_offline_cache_scope='+login+'; Path=/';
   let nextLogin=0,failed=false;
   CacheStorage.prototype.keys=async function(){throw Error('TEST next-start deletion failure');};
   try{await p.clearPrivateReadStateBeforeLogin();nextLogin++;}catch{failed=true;}finally{CacheStorage.prototype.keys=nativeKeys;}
   if(!failed||nextLogin!==0||!(await caches.keys()).includes(pendingCache))throw Error('TEST_LOGIN_PASSED_PENDING_CLEANUP');
   await p.clearPrivateReadStateBeforeLogin();nextLogin++;
   if(nextLogin!==1||(await caches.keys()).includes(pendingCache))throw Error('TEST_LOGIN_CLEANUP_RETRY_NOT_FINISHED');
   const afterCleanup=await p.readPendingEntries(scope),otherAfterCleanup=await p.readPendingEntries(other);
   if(afterCleanup.length!==1||await afterCleanup[0].file.text()!=='TEST immutable bytes'||otherAfterCleanup.length!==1)throw Error('TEST_LOGIN_CLEANUP_DELETED_ORIGINAL');
   return {nativeRevocation:true,cacheFailureVisible:true,originalBytesPreserved:true,foreignActorPreserved:true};
  }`;
  const encoded=Buffer.from('('+code+')').toString('base64');
  const result=await cli(['eval',`async()=>await(eval(atob('${encoded}')))()`]).catch(error=>{throw Error('TEST_BROWSER: '+String(error.stdout??error.message).slice(0,1500));});
  expect(result.stdout).not.toContain('### Error');expect(result.stdout).toContain('"originalBytesPreserved": true');
 }finally{await cli(['close']).catch(()=>{});await new Promise<void>(resolve=>server.close(()=>resolve()));}
},120000);
