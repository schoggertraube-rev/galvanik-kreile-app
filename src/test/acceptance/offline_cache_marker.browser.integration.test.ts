// @vitest-environment node
// Native reader-fence proof with explicitly synthetic HTML, not an app-start proof.
import {it,expect} from 'vitest';
import {createServer} from 'node:http';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {randomUUID} from 'node:crypto';
import {build} from 'esbuild';
it.skipIf(!process.env.KREILE_PLAYWRIGHT_CLI_JS)('a missing login marker prevents old cache reads after both deletion stores fail and the browser reloads',async()=>{
 const compiled=await build({stdin:{contents:`export * from './src/lib/offline/pendingStore.ts';export * from './src/lib/offline/logoutReadState.ts';export * from './src/lib/offline/cacheScopeMarker.ts';export * from './src/lib/offline/privateReadCache.ts';`,resolveDir:process.cwd()},bundle:true,write:false,format:'esm',platform:'browser'});
 const server=createServer((req,res)=>{res.setHeader('Content-Type',req.url==='/queue.mjs'?'text/javascript':'text/html');res.end(req.url==='/queue.mjs'?compiled.outputFiles[0].text:'<!doctype html><title>TEST synthetic cache fence only</title>');});
 await new Promise<void>(resolve=>server.listen(0,'127.0.0.1',resolve));const address=server.address();if(!address||typeof address==='string')throw Error('TEST_LOOPBACK');
 const execute=promisify(execFile),session='TEST-marker-'+randomUUID();const cli=(args:string[])=>execute(process.execPath,[process.env.KREILE_PLAYWRIGHT_CLI_JS!,`-s=${session}`,...args],{maxBuffer:1024*1024,timeout:90000});
 const evaluate=async(code:string)=>{const encoded=Buffer.from('('+code+')').toString('base64');const result=await cli(['eval',`async()=>await(eval(atob('${encoded}')))()`]).catch(error=>{throw Error('TEST_BROWSER: '+String(error.stdout??error.message).slice(0,1500));});expect(result.stdout).not.toContain('### Error');return result.stdout;};
 try{
  await cli(['open',`http://127.0.0.1:${address.port}/TEST`]);
  await evaluate(`async()=>{
   const p=await import('/queue.mjs'),scope='${'a'.repeat(64)}',login='${'b'.repeat(64)}';
   document.cookie=p.CACHE_SCOPE_COOKIE+'='+login+'; Path=/';
   await p.changePendingShellMetadata(scope,login,null,true);
   if(await p.readScopedPrivateResponse(scope,login,'/TEST-private')!==null||(await caches.keys()).includes(p.qualifiedPrivateCacheName(scope,login,1)))throw Error('TEST_READER_CREATED_MISSING_CACHE');
   await p.retainPendingOriginal(scope,{id:'TEST-original',itemId:'TEST-item',kind:'file',file:new File(['TEST original bytes'],'TEST.bin')});
   const cache=await caches.open(p.qualifiedPrivateCacheName(scope,login,1));
   await cache.put('/TEST-private',new Response('<p>TEST private content</p>',{headers:{'Content-Type':'text/html'}}));
   await cache.put('/api/TEST',new Response('<p>TEST poisoned API</p>',{headers:{'Content-Type':'text/html'}}));
   if(!await p.readScopedPrivateResponse(scope,login,'/TEST-private')||await p.readScopedPrivateResponse(scope,login,'/api/TEST'))throw Error('TEST_READER_BOUNDARY');
   const nativeKeys=CacheStorage.prototype.keys,nativeOpen=indexedDB.open;
   CacheStorage.prototype.keys=async()=>{throw Error('TEST cache unavailable');};indexedDB.open=()=>{throw Error('TEST IDB unavailable');};
   try{p.removeCacheScopeMarker();const result=await p.clearLoggedOutReadState(scope);if(result.cacheCleared)throw Error('TEST_FALSE_DELETE_SUCCESS');}finally{CacheStorage.prototype.keys=nativeKeys;indexedDB.open=nativeOpen;}
   if(p.readCacheScopeMarker()!==null)throw Error('TEST_MARKER_SURVIVED_LOGOUT');return true;
  }`);
  await cli(['reload']);
  const proof=await evaluate(`async()=>{
   const p=await import('/queue.mjs'),scope='${'a'.repeat(64)}',login='${'b'.repeat(64)}';
   const originalMatch=Cache.prototype.match;let reads=0;Cache.prototype.match=function(...args){reads++;return originalMatch.apply(this,args);};
   try{if(await p.readScopedPrivateResponse(scope,login,'/TEST-private')!==null||reads!==0)throw Error('TEST_OLD_CONTENT_READ_BEFORE_DELETE');}finally{Cache.prototype.match=originalMatch;}
   if((await caches.keys()).includes(p.qualifiedPrivateCacheName(scope,login,1)))throw Error('TEST_START_DELETE_NOT_RETRIED');
   const originals=await p.readPendingEntries(scope);if(originals.length!==1||await originals[0].file.text()!=='TEST original bytes')throw Error('TEST_ORIGINAL_LOST');
   return {reloaded:true,oldContentNeverRead:true,deleteRetried:true,originalBytesRetained:true};
  }`);
  expect(proof).toContain('"oldContentNeverRead": true');expect(proof).toContain('"originalBytesRetained": true');
 }finally{await cli(['close']).catch(()=>{});await new Promise<void>(resolve=>server.close(()=>resolve()));}
},120000);
