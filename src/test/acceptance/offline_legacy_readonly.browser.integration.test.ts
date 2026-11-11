// @vitest-environment node
import {it,expect} from 'vitest';
import {createServer} from 'node:http';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {randomUUID} from 'node:crypto';
import {build} from 'esbuild';

it.skipIf(!process.env.KREILE_PLAYWRIGHT_CLI_JS)('preserves native legacy stores and unknown owners without a second writer or silent fallback',async()=>{
 const compiled=await build({stdin:{contents:`export {offlineOutbox} from './src/lib/offline/OfflineOutbox.ts';export {IndexedDBHelper} from './src/lib/offline/IndexedDBHelper.ts';export {syncQueue} from './src/lib/offline/idbSync.ts';`,resolveDir:process.cwd()},bundle:true,write:false,format:'esm',platform:'browser'});
 const server=createServer((req,res)=>{res.setHeader('Content-Type',req.url==='/legacy.mjs'?'text/javascript':'text/html');res.end(req.url==='/legacy.mjs'?compiled.outputFiles[0].text:'<!doctype html><title>TEST legacy storage preservation</title>');});
 await new Promise<void>(resolve=>server.listen(0,'127.0.0.1',resolve));const address=server.address();if(!address||typeof address==='string')throw Error('TEST_LOOPBACK');
 const execute=promisify(execFile),session='TEST-legacy-'+randomUUID();
 const cli=(args:string[])=>execute(process.execPath,[process.env.KREILE_PLAYWRIGHT_CLI_JS!,`-s=${session}`,...args],{maxBuffer:1024*1024,timeout:90000});
 try{
  await cli(['open',`http://127.0.0.1:${address.port}/TEST`]);
  const result=await cli(['eval',`async()=>{
   const seed=(name,store,row,cache=false)=>new Promise((resolve,reject)=>{const r=indexedDB.open(name,1);r.onupgradeneeded=()=>{r.result.createObjectStore(store,{keyPath:'id'});if(cache)r.result.createObjectStore('read_cache');};r.onsuccess=()=>{const db=r.result,tx=db.transaction(cache?[store,'read_cache']:[store],'readwrite');tx.objectStore(store).put(row);if(cache)tx.objectStore('read_cache').put('TEST retain unknown cached bytes','original');tx.oncomplete=()=>{db.close();resolve();};tx.onabort=()=>reject(tx.error);};});
   await seed('KreileOfflineOutboxDB','outbox',{id:7,userId:'TEST other actor',payload:{text:'TEST unassigned original'}});
   await seed('kreile_offline_db','write_queue',{id:'TEST old action',payload:{keep:true}},true);
   await seed('kreile_sync_db','mutations',{id:'TEST old mutation',payload:{keep:true}});
   const raw='[{"id":"TEST fallback","payload":{"keep":true}}]';localStorage.setItem('kreile_sync_fallback',raw);
   const p=await import('/legacy.mjs');
   if((await p.offlineOutbox.getAllItems())[0].userId!=='TEST other actor'||(await p.IndexedDBHelper.getQueue())[0].id!=='TEST old action'||(await p.syncQueue.getAll()).length!==2)throw Error('TEST_LEGACY_READ_LOSS');
   for(const write of [()=>p.offlineOutbox.clearAll(),()=>p.IndexedDBHelper.pushToQueue('ORDER_STATUS_UPDATE',{}),()=>p.syncQueue.add('order','TEST-id','UPDATE',{}),()=>p.syncQueue.remove('TEST old mutation')]){let blocked=false;try{await write();}catch(e){blocked=e.message==='OFFLINE_LEGACY_READ_ONLY';}if(!blocked)throw Error('TEST_LEGACY_WRITER_SURVIVED');}
   if(localStorage.getItem('kreile_sync_fallback')!==raw)throw Error('TEST_FALLBACK_CHANGED');
   const cached=await new Promise((resolve,reject)=>{const r=indexedDB.open('kreile_offline_db');r.onsuccess=()=>{const db=r.result,tx=db.transaction('read_cache','readonly'),v=tx.objectStore('read_cache').get('original');tx.oncomplete=()=>{db.close();resolve(v.result);};tx.onabort=()=>reject(tx.error);};});
   if(cached!=='TEST retain unknown cached bytes')throw Error('TEST_LEGACY_CACHE_ERASED');
   localStorage.setItem('kreile_sync_fallback','TEST malformed original');let blocked=false;try{await p.syncQueue.getAll();}catch{blocked=true;}if(!blocked||localStorage.getItem('kreile_sync_fallback')!=='TEST malformed original')throw Error('TEST_SILENT_EMPTY_FALLBACK');
   return 'TEST_LEGACY_READONLY_OK';
  }`]);
  expect(result.stdout).toContain('TEST_LEGACY_READONLY_OK');
 }finally{await cli(['close']).catch(()=>{});await new Promise<void>(resolve=>server.close(()=>resolve()));}
},120000);
