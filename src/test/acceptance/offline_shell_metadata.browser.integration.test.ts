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
   const scope='${'e'.repeat(64)}',name='kreile-pending-originals-v1-'+scope;
   const raw=async(version,work)=>new Promise((resolve,reject)=>{const r=version?indexedDB.open(name,version):indexedDB.open(name);r.onupgradeneeded=()=>r.result.createObjectStore('originals',{keyPath:'id'});r.onerror=()=>reject(r.error);r.onsuccess=()=>{const db=r.result;work(db,resolve,reject);};});
   await raw(1,(db,resolve,reject)=>{const tx=db.transaction('originals','readwrite');tx.objectStore('originals').put({id:'TEST-original',kind:'file',itemId:'TEST-item',file:new File(['TEST immutable legacy bytes'],'TEST.bin')});tx.objectStore('originals').put({id:7,legacy:'TEST unknown must survive'});tx.oncomplete=()=>{db.close();resolve();};tx.onabort=()=>reject(tx.error);});
   const p=await import('/queue.mjs');if((await p.readPendingShellMetadata(scope)).code!=='EMPTY')throw Error('TEST_UPGRADE_NOT_EMPTY');
   const a=await p.changePendingShellMetadata(scope,null,true);if(a.code!=='OK'||a.metadata.cacheGeneration!==1||a.metadata.scope!==scope)throw Error('TEST_ACTIVATE');
   const logout=await p.changePendingShellMetadata(scope,1,false);if(logout.code!=='OK'||logout.metadata.scope!==null||logout.metadata.cacheGeneration!==2)throw Error('TEST_DEACTIVATE');
   if((await p.changePendingShellMetadata(scope,1,true)).code!=='STALE')throw Error('TEST_LATE_RESPONSE_REACTIVATED');
   const competing=await Promise.all([p.changePendingShellMetadata(scope,2,true),p.changePendingShellMetadata(scope,2,true)]);if(competing.filter(x=>x.code==='OK').length!==1||competing.filter(x=>x.code==='STALE').length!==1)throw Error('TEST_CAS_NOT_SERIALIZED');
   const nativePut=IDBObjectStore.prototype.put;IDBObjectStore.prototype.put=function(...args){const request=nativePut.apply(this,args);if(this.name==='shellMetadata')request.addEventListener('success',()=>this.transaction.abort());return request;};
   let aborted=false;try{await p.changePendingShellMetadata(scope,3,false);}catch{aborted=true;}finally{IDBObjectStore.prototype.put=nativePut;}
   const afterAbort=await p.readPendingShellMetadata(scope);if(!aborted||afterAbort.code!=='OK'||afterAbort.metadata.scope!==scope||afterAbort.metadata.cacheGeneration!==3)throw Error('TEST_ABORT_FALSE_SUCCESS');
   await raw(null,(db,resolve,reject)=>{if(db.version!==2||db.objectStoreNames.length!==2)throw Error('TEST_SECOND_DATABASE_OR_WRONG_UPGRADE');const tx=db.transaction('shellMetadata','readwrite');tx.objectStore('shellMetadata').put({scope,cacheGeneration:'TEST unknown generation',updatedAt:'TEST legacy',keep:'TEST unchanged'},'active');tx.oncomplete=()=>{db.close();resolve();};tx.onabort=()=>reject(tx.error);});
   if((await p.readPendingShellMetadata(scope)).code!=='QUARANTINE'||(await p.changePendingShellMetadata(scope,null,true)).code!=='QUARANTINE')throw Error('TEST_UNKNOWN_GENERATION_OVERWRITTEN');
   const evidence=await raw(null,(db,resolve,reject)=>{const tx=db.transaction(['originals','shellMetadata'],'readonly'),original=tx.objectStore('originals').get('TEST-original'),unknown=tx.objectStore('originals').get(7),metadata=tx.objectStore('shellMetadata').get('active');tx.oncomplete=async()=>{db.close();resolve({bytes:await original.result.file.text(),unknown:unknown.result,metadata:metadata.result});};tx.onabort=()=>reject(tx.error);});
   if(evidence.bytes!=='TEST immutable legacy bytes'||evidence.unknown.legacy!=='TEST unknown must survive'||evidence.metadata.keep!=='TEST unchanged')throw Error('TEST_UPGRADE_LOST_DATA');
   const blockedScope='${'f'.repeat(64)}',blockedName='kreile-pending-originals-v1-'+blockedScope;
   const blocker=await new Promise((resolve,reject)=>{const r=indexedDB.open(blockedName,1);r.onupgradeneeded=()=>r.result.createObjectStore('originals',{keyPath:'id'});r.onerror=()=>reject(r.error);r.onsuccess=()=>resolve(r.result);});
   const nativeOpen=indexedDB.open.bind(indexedDB),nativeClose=IDBDatabase.prototype.close;let lateClosed=false,finishLate;const late=new Promise(resolve=>{finishLate=resolve;});
   indexedDB.open=(...args)=>{const r=nativeOpen(...args);if(args[0]===blockedName&&args[1]===2)r.addEventListener('success',()=>setTimeout(finishLate,0));return r;};
   IDBDatabase.prototype.close=function(){if(this.name===blockedName&&this.version===2)lateClosed=true;return nativeClose.call(this);};
   try{let blocked=false;try{await p.readPendingShellMetadata(blockedScope);}catch(error){blocked=error.message==='INTAKE_PENDING_STORAGE_BLOCKED';}blocker.close();await late;if(!blocked||!lateClosed)throw Error('TEST_BLOCKED_UPGRADE_LEAKED_CONNECTION');}finally{blocker.close();indexedDB.open=nativeOpen;IDBDatabase.prototype.close=nativeClose;}
   return {nativeUpgrade:true,originalsPreserved:true,staleRefused:true,abortRolledBack:true,quarantinePreserved:true,blockedUpgradeClosed:true};
  }`;
  const encoded=Buffer.from('('+code+')').toString('base64');
  const result=await cli(['eval',`async()=>await(eval(atob('${encoded}')))()`]).catch(error=>{throw Error('TEST_BROWSER: '+String(error.stdout??error.message).slice(0,1500));});
  expect(result.stdout).not.toContain('### Error');expect(result.stdout).toContain('"nativeUpgrade": true');expect(result.stdout).toContain('"quarantinePreserved": true');
 }finally{await cli(['close']).catch(()=>{});await new Promise<void>(resolve=>server.close(()=>resolve()));}
},120000);
