// @vitest-environment node
import {it,expect} from 'vitest';
import {createServer} from 'node:http';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {randomUUID} from 'node:crypto';
import {build} from 'esbuild';

it.skipIf(!process.env.KREILE_PLAYWRIGHT_CLI_JS)('upgrades the existing native queue without losing originals and rejects stale or corrupt shell metadata',async()=>{
 const compiled=await build({stdin:{contents:`export * from './src/lib/offline/pendingStore.ts';`,resolveDir:process.cwd()},bundle:true,write:false,format:'esm',platform:'browser'});
 const server=createServer((req,res)=>{res.setHeader('Content-Type',req.url==='/queue.mjs'?'text/javascript':'text/html');res.end(req.url==='/queue.mjs'?compiled.outputFiles[0].text:'<!doctype html><title>TEST queue upgrade</title>');});
 await new Promise<void>(resolve=>server.listen(0,'127.0.0.1',resolve));const address=server.address();if(!address||typeof address==='string')throw Error('TEST_LOOPBACK');
 const execute=promisify(execFile),session='TEST-shell-'+randomUUID();
 const cli=(args:string[])=>execute(process.execPath,[process.env.KREILE_PLAYWRIGHT_CLI_JS!,`-s=${session}`,...args],{maxBuffer:1024*1024,timeout:90000});
 try{
  await cli(['open',`http://127.0.0.1:${address.port}/TEST`]);
  const code=`async()=>{
   let login='1111111111111111111111111111111111111111111111111111111111111111';const scope='${'e'.repeat(64)}',name='kreile-pending-originals-v1-'+scope;
   const raw=async(version,work)=>new Promise((resolve,reject)=>{const r=version?indexedDB.open(name,version):indexedDB.open(name);r.onupgradeneeded=()=>{r.result.createObjectStore('originals',{keyPath:'id'});if(version===2)r.result.createObjectStore('shellMetadata');};r.onerror=()=>reject(r.error);r.onsuccess=()=>{const db=r.result;work(db,resolve,reject);};});
   await raw(2,(db,resolve,reject)=>{const tx=db.transaction('originals','readwrite');tx.objectStore('originals').put({id:'TEST-original',kind:'file',itemId:'TEST-item',file:new File(['TEST immutable legacy bytes'],'TEST.bin')});tx.objectStore('originals').put({id:7,legacy:'TEST unknown must survive'});tx.oncomplete=()=>{db.close();resolve();};tx.onabort=()=>reject(tx.error);});
   const p=await import('/queue.mjs');if((await p.readPendingShellMetadata(scope,login)).code!=='EMPTY')throw Error('TEST_UPGRADE_NOT_EMPTY');
   const a=await p.changePendingShellMetadata(scope,login,null,true);if(a.code!=='OK'||a.metadata.cacheGeneration!==1||a.metadata.scope!==login)throw Error('TEST_ACTIVATE');
   document.cookie='kreile_offline_cache_scope='+login+'; Path=/';
   const syntheticResponse={code:'OK',zustand:'TEST-open',farbe:null,erstblick:[],hauptaktion:null,weitere:[],gesperrt:[],datenluecken:[],quelle:{test:'TEST synthetic U2 boundary'}};
   const device={port:'order.u2',portVersion:1,objectId:'TEST-order',serverReadAt:'2026-11-13T01:00:00.000Z',response:syntheticResponse};
   if((await p.retainPendingDeviceRead(scope,login,1,device)).code!=='STORED')throw Error('TEST_DEVICE_WRITE');
   const reread=await p.readPendingDeviceRead(scope,login,1,device);if(reread.code!=='OK'||JSON.stringify(reread.value)!==JSON.stringify(device))throw Error('TEST_DEVICE_RESPONSE_CHANGED');
   const logout=await p.changePendingShellMetadata(scope,login,1,false);if(logout.code!=='OK'||logout.metadata.scope!==null||logout.metadata.cacheGeneration!==2)throw Error('TEST_DEACTIVATE');
   if((await p.retainPendingDeviceRead(scope,login,1,device)).code!=='STALE'||(await p.readPendingDeviceRead(scope,login,1,device)).code!=='STALE')throw Error('TEST_DEVICE_STALE_GENERATION_ACCEPTED');
   if((await p.changePendingShellMetadata(scope,login,1,true)).code!=='STALE')throw Error('TEST_LATE_RESPONSE_REACTIVATED');
   if((await p.changePendingShellMetadata(scope,login,2,true)).code!=='REVOKED')throw Error('TEST_OLD_LOGIN_REACTIVATED_WITH_FRESH_GENERATION');
   login='${'2'.repeat(64)}';if((await p.changePendingShellMetadata(scope,login,null,true)).code!=='OK')throw Error('TEST_NEW_LOGIN_NOT_ALLOWED');
   const competing=await Promise.all([p.changePendingShellMetadata(scope,login,1,true),p.changePendingShellMetadata(scope,login,1,true)]);if(competing.filter(x=>x.code==='OK').length!==1||competing.filter(x=>x.code==='STALE').length!==1)throw Error('TEST_CAS_NOT_SERIALIZED');
   const nativePut=IDBObjectStore.prototype.put;IDBObjectStore.prototype.put=function(...args){const request=nativePut.apply(this,args);if(this.name==='shellMetadata')request.addEventListener('success',()=>this.transaction.abort());return request;};
   let aborted=false;try{await p.changePendingShellMetadata(scope,login,2,false);}catch{aborted=true;}finally{IDBObjectStore.prototype.put=nativePut;}
   const afterAbort=await p.readPendingShellMetadata(scope,login);if(!aborted||afterAbort.code!=='OK'||afterAbort.metadata.scope!==login||afterAbort.metadata.cacheGeneration!==2)throw Error('TEST_ABORT_FALSE_SUCCESS');
   const thirdLogin='${'3'.repeat(64)}';await p.changePendingShellMetadata(scope,thirdLogin,null,true);
   if((await p.readPendingShellInventory(scope)).entries.filter(entry=>entry.metadata.scope!==null).length!==2)throw Error('TEST_ACTIVE_LOGIN_INVENTORY');
   IDBObjectStore.prototype.put=function(...args){const request=nativePut.apply(this,args);if(this.name==='shellMetadata')request.addEventListener('success',()=>this.transaction.abort());return request;};
   let revokeAborted=false;try{await p.revokePendingShells(scope);}catch{revokeAborted=true;}finally{IDBObjectStore.prototype.put=nativePut;}
   if(!revokeAborted||(await p.readPendingShellInventory(scope)).entries.filter(entry=>entry.metadata.scope!==null).length!==2)throw Error('TEST_PARTIAL_REVOCATION');
   const revoked=await p.revokePendingShells(scope);if(revoked.loginScopes.length!==3||(await p.readPendingShellInventory(scope)).entries.some(entry=>entry.metadata.scope!==null))throw Error('TEST_ATOMIC_PRIVACY_FENCE');
   if((await p.changePendingShellMetadata(scope,thirdLogin,2,true)).code!=='REVOKED')throw Error('TEST_REVOKED_TAB_REACTIVATED');
   await raw(null,(db,resolve,reject)=>{if(db.version!==3||db.objectStoreNames.length!==3)throw Error('TEST_SECOND_DATABASE_OR_WRONG_UPGRADE');const tx=db.transaction(['shellMetadata','deviceReads'],'readwrite');const remaining=tx.objectStore('deviceReads').count();remaining.onsuccess=()=>{if(remaining.result!==0)throw Error('TEST_REVOKE_RETAINED_DEVICE_READS');};tx.objectStore('shellMetadata').put({scope:login,cacheGeneration:'TEST unknown generation',updatedAt:'TEST legacy',keep:'TEST unchanged'},'login:'+login);tx.oncomplete=()=>{db.close();resolve();};tx.onabort=()=>reject(tx.error);});
   if((await p.readPendingShellMetadata(scope,login)).code!=='QUARANTINE'||(await p.changePendingShellMetadata(scope,login,null,true)).code!=='QUARANTINE')throw Error('TEST_UNKNOWN_GENERATION_OVERWRITTEN');
   if((await p.readPendingShellInventory(scope)).quarantined!==1||(await p.revokePendingShells(scope)).quarantined!==1)throw Error('TEST_UNKNOWN_GENERATION_NOT_QUARANTINED');
   const evidence=await raw(null,(db,resolve,reject)=>{const tx=db.transaction(['originals','shellMetadata'],'readonly'),original=tx.objectStore('originals').get('TEST-original'),unknown=tx.objectStore('originals').get(7),metadata=tx.objectStore('shellMetadata').get('login:'+login);tx.oncomplete=async()=>{db.close();resolve({bytes:await original.result.file.text(),unknown:unknown.result,metadata:metadata.result});};tx.onabort=()=>reject(tx.error);});
   if(evidence.bytes!=='TEST immutable legacy bytes'||evidence.unknown.legacy!=='TEST unknown must survive'||evidence.metadata.keep!=='TEST unchanged')throw Error('TEST_UPGRADE_LOST_DATA');
   const blockedScope='${'f'.repeat(64)}',blockedName='kreile-pending-originals-v1-'+blockedScope;
   const blocker=await new Promise((resolve,reject)=>{const r=indexedDB.open(blockedName,1);r.onupgradeneeded=()=>r.result.createObjectStore('originals',{keyPath:'id'});r.onerror=()=>reject(r.error);r.onsuccess=()=>resolve(r.result);});
   const nativeOpen=indexedDB.open.bind(indexedDB),nativeClose=IDBDatabase.prototype.close;let lateClosed=false,finishLate;const late=new Promise(resolve=>{finishLate=resolve;});
   indexedDB.open=(...args)=>{const r=nativeOpen(...args);if(args[0]===blockedName&&args[1]===3)r.addEventListener('success',()=>setTimeout(finishLate,0));return r;};
   IDBDatabase.prototype.close=function(){if(this.name===blockedName&&this.version===3)lateClosed=true;return nativeClose.call(this);};
   try{let blocked=false;try{await p.readPendingShellMetadata(blockedScope,login);}catch(error){blocked=error.message==='INTAKE_PENDING_STORAGE_BLOCKED';}blocker.close();await late;if(!blocked||!lateClosed)throw Error('TEST_BLOCKED_UPGRADE_LEAKED_CONNECTION');}finally{blocker.close();indexedDB.open=nativeOpen;IDBDatabase.prototype.close=nativeClose;}
   return {nativeUpgrade:true,originalsPreserved:true,staleRefused:true,abortRolledBack:true,quarantinePreserved:true,blockedUpgradeClosed:true};
  }`;
  const encoded=Buffer.from('('+code+')').toString('base64');
  const result=await cli(['eval',`async()=>await(eval(atob('${encoded}')))()`]).catch(error=>{throw Error('TEST_BROWSER: '+String(error.stdout??error.message).slice(0,1500));});
  expect(result.stdout).not.toContain('### Error');expect(result.stdout).toContain('"nativeUpgrade": true');expect(result.stdout).toContain('"quarantinePreserved": true');
 }finally{await cli(['close']).catch(()=>{});await new Promise<void>(resolve=>server.close(()=>resolve()));}
},120000);
