// @vitest-environment node
import {it,expect} from 'vitest';
import {createServer} from 'node:http';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {randomUUID} from 'node:crypto';
import {build} from 'esbuild';

it.skipIf(!process.env.KREILE_PLAYWRIGHT_CLI_JS)('retains actual native-IDB workshop originals with the existing queue sequence and immutable N5 intent',async()=>{
 const compiled=await build({stdin:{contents:`export * from './src/lib/offline/pendingStore.ts';`,resolveDir:process.cwd()},bundle:true,write:false,format:'esm',platform:'browser'});
 const server=createServer((req,res)=>{res.setHeader('Content-Type',req.url==='/queue.mjs'?'text/javascript':'text/html');res.end(req.url==='/queue.mjs'?compiled.outputFiles[0].text:'<!doctype html><title>TEST workshop queue</title>');});
 await new Promise<void>(resolve=>server.listen(0,'127.0.0.1',resolve));const address=server.address();if(!address||typeof address==='string')throw Error('TEST_LOOPBACK');
 const execute=promisify(execFile),session='TEST-workshop-queue-'+randomUUID();
 const cli=(args:string[])=>execute(process.execPath,[process.env.KREILE_PLAYWRIGHT_CLI_JS!,`-s=${session}`,...args],{maxBuffer:1024*1024,timeout:90000});
 const ids={order:randomUUID(),item:randomUUID(),key:randomUUID(),extraKey:randomUUID(),invalid:randomUUID(),line:randomUUID(),catalog:randomUUID()};
 try{
  await cli(['open',`http://127.0.0.1:${address.port}/TEST`]);
  const result=await cli(['eval',`async()=>{
   const p=await import('/queue.mjs'),scope='${'d'.repeat(64)}',ids=${JSON.stringify(ids)};
   await p.retainPendingOriginal(scope,{id:'TEST-note',itemId:'TEST-intake',kind:'note',text:'TEST first original',textstand:'TEST-stand',dismissed:[]});
   const original={kind:'workshop',id:ids.key,itemId:ids.order,command:'item.finished',input:{orderId:ids.order,itemId:ids.item,expectedVersion:7,clientEventId:ids.key,finished:true}};
   await p.retainPendingWorkshopOriginal(scope,original);
   await p.retainPendingOriginal(scope,{id:'TEST-file',itemId:'TEST-intake',kind:'file',file:new File(['TEST exact bytes'],'TEST.bin')});
   const first=(await p.readPendingEntries(scope)).find(row=>row.id===ids.key);
   if(!first||first.queueSequence!==2||!first.deviceCapturedAt)throw Error('TEST_NOT_ONE_QUEUE');
   await p.retainPendingWorkshopOriginal(scope,{...original,input:{finished:true,clientEventId:ids.key,expectedVersion:7,itemId:ids.item,orderId:ids.order},deviceCapturedAt:'2099-01-01T00:00:00Z'});
   let changed=false;try{await p.retainPendingWorkshopOriginal(scope,{...original,input:{...original.input,finished:false}});}catch{changed=true;}
   if(!changed)throw Error('TEST_N5_INTENT_REPLACED');
   await p.acknowledgePendingOriginal(scope,ids.key);
   const held=(await p.readPendingEntries(scope)).find(row=>row.id===ids.key);
   if(JSON.stringify(held)!==JSON.stringify(first))throw Error('TEST_ORIGINAL_OR_TIMESTAMP_CHANGED');
   const extra={kind:'workshop',id:ids.extraKey,itemId:ids.order,command:'item.extraWork',input:{orderId:ids.order,itemId:ids.item,clientEventId:ids.extraKey,lineId:ids.line,catalogPositionId:ids.catalog,minutes:25,active:true,expectedLineVersion:0,expectedOrderVersion:7}};
   await p.retainPendingWorkshopOriginal(scope,extra);
   const raw=await new Promise((resolve,reject)=>{const r=indexedDB.open('kreile-pending-originals-v1-'+scope,2);r.onerror=()=>reject(r.error);r.onsuccess=()=>resolve(r.result);});
   await new Promise((resolve,reject)=>{const tx=raw.transaction('originals','readwrite');tx.objectStore('originals').put({...original,id:'TEST-unknown-command',command:'unapproved.command'});tx.objectStore('originals').put({...original,id:ids.invalid,input:{...original.input,clientEventId:ids.invalid},deviceCapturedAt:'not-a-device-time'});tx.objectStore('originals').put({...extra,unapprovedAuthority:'TEST must stay quarantined'});tx.oncomplete=()=>resolve();tx.onabort=()=>reject(tx.error);});raw.close();
   const rows=await p.readPendingEntries(scope);
   if(rows.filter(row=>row.kind==='workshop').length!==1||rows.filter(row=>row.kind==='quarantine').length!==3)throw Error('TEST_UNKNOWN_COMMAND_OR_METADATA_EXECUTABLE');
   if((await p.readPendingOriginals(scope)).length!==2)throw Error('TEST_INTAKE_RESUME_CAPTURED_WORKSHOP');
   if((await p.readPendingEntries('${'e'.repeat(64)}')).length)throw Error('TEST_OTHER_SCOPE_DISCLOSED');
   return {oneNativeQueue:true,immutableIntent:true,receiptRequired:true,quarantinePreserved:true};
  }`]);
  expect(result.stdout).not.toContain('### Error');for(const key of ['oneNativeQueue','immutableIntent','receiptRequired','quarantinePreserved'])expect(result.stdout).toContain('"'+key+'": true');
 }finally{await cli(['close']).catch(()=>{});await new Promise<void>(resolve=>server.close(()=>resolve()));}
},120000);
