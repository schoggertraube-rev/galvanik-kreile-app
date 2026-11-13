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
   if(failed||nextLogin!==1||document.cookie.includes('kreile_offline_cache_scope=')||!(await caches.keys()).includes(pendingCache))throw Error('TEST_LOGIN_BLOCKED_BY_PENDING_CLEANUP');
   await p.clearPrivateReadStateBeforeLogin();nextLogin++;
   if(nextLogin!==2||(await caches.keys()).includes(pendingCache))throw Error('TEST_LOGIN_CLEANUP_RETRY_NOT_FINISHED');
   const afterCleanup=await p.readPendingEntries(scope),otherAfterCleanup=await p.readPendingEntries(other);
   if(afterCleanup.length!==1||await afterCleanup[0].file.text()!=='TEST immutable bytes'||otherAfterCleanup.length!==1)throw Error('TEST_LOGIN_CLEANUP_DELETED_ORIGINAL');
   const pendingLogin='${'d'.repeat(64)}';document.cookie='kreile_offline_cache_scope='+pendingLogin+'; Path=/';await p.changePendingShellMetadata(scope,pendingLogin,null,true);
   const device={port:'order.u2',portVersion:1,objectId:'TEST-cache-only',serverReadAt:'2026-11-13T01:00:00.000Z',sourceLoginScope:pendingLogin,response:{code:'OK',zustand:'TEST synthetic metadata',farbe:null,erstblick:[],hauptaktion:null,weitere:[],gesperrt:[],datenluecken:[],quelle:{test:'TEST storage boundary'}}};
   if((await p.retainPendingDeviceRead(scope,pendingLogin,1,device)).code!=='STORED')throw Error('TEST_DEVICE_SETUP');
   const rawCount=()=>new Promise((resolve,reject)=>{const r=indexedDB.open('kreile-pending-originals-v1-'+scope);r.onerror=()=>reject(r.error);r.onsuccess=()=>{const db=r.result,tx=db.transaction('deviceReads','readonly'),count=tx.objectStore('deviceReads').count();tx.oncomplete=()=>{db.close();resolve(count.result);};tx.onabort=()=>reject(tx.error);};});
   document.cookie='kreile_offline_cache_scope=; Path=/; Max-Age=0';const nativeTransaction=IDBDatabase.prototype.transaction;
   IDBDatabase.prototype.transaction=function(names,mode,...rest){const tx=nativeTransaction.call(this,names,mode,...rest);if(this.name==='kreile-pending-originals-v1-'+scope&&mode==='readwrite'&&Array.from(names).includes('deviceReads'))queueMicrotask(()=>tx.abort());return tx;};
   let blockedDeviceLogin=false;
   try{const aborted=await p.clearLoggedOutReadState(scope);if(aborted.cacheCleared)throw Error('TEST_ABORTED_DEVICE_DELETE_CLAIMED');blockedDeviceLogin=(await p.clearPrivateReadStateBeforeLogin()).code==='UNAVAILABLE';}finally{IDBDatabase.prototype.transaction=nativeTransaction;}
   if(!blockedDeviceLogin||await rawCount()!==1)throw Error('TEST_DEVICE_DELETE_FAILURE_NOT_RETAINED');
   await p.clearPrivateReadStateBeforeLogin();if(await rawCount()!==0)throw Error('TEST_DEVICE_DELETE_NOT_RETRIED_BEFORE_LOGIN');
   const revoked=await p.readPendingShellMetadata(scope,pendingLogin);if(revoked.code!=='OK'||revoked.metadata.scope!==null)throw Error('TEST_SCOPE_NOT_ATOMIC_WITH_DEVICE_DELETE');
   const finalOwn=await p.readPendingEntries(scope),finalOther=await p.readPendingEntries(other);if(finalOwn.length!==1||await finalOwn[0].file.text()!=='TEST immutable bytes'||finalOther.length!==1)throw Error('TEST_DEVICE_RETRY_LOST_ORIGINALS');
   const raceLogin='${'e'.repeat(64)}';document.cookie='kreile_offline_cache_scope='+raceLogin+'; Path=/';await p.changePendingShellMetadata(scope,raceLogin,null,true);await p.retainPendingDeviceRead(scope,raceLogin,1,{...device,sourceLoginScope:raceLogin});
   const nativeGetAll=IDBObjectStore.prototype.getAll;IDBObjectStore.prototype.getAll=function(...args){const req=nativeGetAll.apply(this,args);if(this.name==='shellMetadata'&&this.transaction.db.name==='kreile-pending-originals-v1-'+scope&&this.transaction.mode==='readwrite')req.addEventListener('success',()=>{document.cookie='kreile_offline_cache_scope='+raceLogin+'; Path=/';});return req;};
   let concurrentLoginPreserved=false;try{concurrentLoginPreserved=(await p.clearPrivateReadStateBeforeLogin()).code==='UNAVAILABLE';}finally{IDBObjectStore.prototype.getAll=nativeGetAll;}
   const raceState=await p.readPendingShellMetadata(scope,raceLogin);if(!concurrentLoginPreserved||await rawCount()!==1||raceState.code!=='OK'||raceState.metadata.scope!==raceLogin)throw Error('TEST_LATE_START_CLEANUP_ERASED_ACTIVE_LOGIN');
   await p.clearPrivateReadStateBeforeLogin();if(await rawCount()!==0||await (await p.readPendingEntries(scope))[0].file.text()!=='TEST immutable bytes')throw Error('TEST_RACE_RETRY_ORIGINAL_LOST');
   return {nativeRevocation:true,cacheFailureVisible:true,originalBytesPreserved:true,foreignActorPreserved:true};
  }`;
  const encoded=Buffer.from('('+code+')').toString('base64');
  const result=await cli(['eval',`async()=>await(eval(atob('${encoded}')))()`]).catch(error=>{throw Error('TEST_BROWSER: '+String(error.stdout??error.message).slice(0,1500));});
  expect(result.stdout).not.toContain('### Error');expect(result.stdout).toContain('"originalBytesPreserved": true');
 }finally{await cli(['close']).catch(()=>{});await new Promise<void>(resolve=>server.close(()=>resolve()));}
},120000);
