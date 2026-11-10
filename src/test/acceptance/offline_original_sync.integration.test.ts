// @vitest-environment node
import {it,expect,vi} from 'vitest';
import {createServer} from 'node:http';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {randomUUID} from 'node:crypto';
import {build} from 'esbuild';
const tenant=vi.hoisted(()=> 'TEST-ablauf-'+globalThis.crypto.randomUUID());
vi.mock('@/lib/tenant',()=>({KREILE_TENANT_SLUG:tenant}));
import {sql,full,withSession,createFixture} from '../../../e2e/ablauf/replayHarness';
import {getAuthorizationSnapshotAction} from '@/app/actions/auth.actions';
import {prepareIntakeFileAction,finishIntakeFileAction,saveIntakeNoteAction} from '@/app/actions/eingang.actions';
import {KREILE_TENANT_SLUG} from '@/lib/tenant';
const execute=promisify(execFile);
// Test-only loopback bridge preserves real Actions/Auth/DB/Storage; it is not an application route.
it.skipIf(!process.env.KREILE_PLAYWRIGHT_CLI_JS)('resumes real scoped originals through the existing writers and Storage, retaining photos and refusing a switched actor',async()=>{
 const auth=await withSession(full,()=>getAuthorizationSnapshotAction());if(!auth.ok||!auth.data.offlineScope)throw Error('TEST_SCOPE');
 const scope=auth.data.offlineScope,session='TEST-u10-'+randomUUID();let actor=full;
 const other=await createFixture(['eingang'],'buero');
 const status=await execute(process.execPath,['node_modules/supabase/dist/supabase.js','status','-o','json']);const local=JSON.parse(status.stdout);
 if(new URL(local.API_URL).hostname!=='127.0.0.1')throw Error('TEST_STORAGE_LOOPBACK');
 const root=process.cwd().replaceAll('\\','/');
 const compiled=await build({stdin:{contents:`export {syncPendingFiles} from '${root}/src/lib/offline/syncPendingFiles.ts';export {retainPendingOriginal,readPendingEntries} from '${root}/src/lib/offline/pendingStore.ts';export {uploadIntakeOriginal} from '${root}/src/modules/eingang/intakeOriginalUpload.ts';`,resolveDir:process.cwd()},bundle:true,write:false,format:'esm',platform:'browser',define:{'process.env.NEXT_PUBLIC_SUPABASE_URL':JSON.stringify(local.API_URL),'process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY':JSON.stringify(local.ANON_KEY)}});
 const api={prepare:0,finish:0,note:0};
 const server=createServer(async(req,res)=>{try{
  if(req.url==='/module.mjs'){res.setHeader('Content-Type','text/javascript');res.end(compiled.outputFiles[0].text);return;}
  if(req.url==='/api'&&req.method==='POST'){
   let body='';for await(const chunk of req)body+=chunk;
   const input=JSON.parse(body);let result;
   if(input.kind==='prepare'){api.prepare++;result=await withSession(actor,()=>prepareIntakeFileAction(input.input,input.scope));}
   else if(input.kind==='note'){api.note++;result=await withSession(actor,()=>saveIntakeNoteAction(input.input,input.scope));}
   else if(input.kind==='finish'){api.finish++;result=await withSession(actor,()=>finishIntakeFileAction(input.id,input.scope));}
   else throw Error('TEST_UNKNOWN_COMMAND');
   res.setHeader('Content-Type','application/json');res.end(JSON.stringify(result));return;
  }
  res.setHeader('Content-Type','text/html');res.end('<!doctype html><title>TEST real original queue</title>');
 }catch{res.statusCode=500;res.end('TEST_BRIDGE_ERROR');}});
 await new Promise<void>(resolve=>server.listen(0,'127.0.0.1',resolve));const address=server.address();if(!address||typeof address==='string')throw Error('TEST_ORIGIN');
 const cli=async(args:string[])=>execute(process.execPath,[process.env.KREILE_PLAYWRIGHT_CLI_JS!,`-s=${session}`,...args],{maxBuffer:1024*1024,timeout:90000});
 const evaluate=async(code:string)=>{
  const encoded=Buffer.from('('+code+')').toString('base64');
  const result=await cli(['eval',`async()=>await(eval(atob('${encoded}')))()`]);
  if(result.stdout.includes('### Error'))throw Error('TEST_BROWSER:'+result.stdout.slice(0,250));
  return result.stdout;
 };
 const ids={item:randomUUID(),noteItem:randomUUID(),note:randomUUID(),staleNote:randomUUID(),document:randomUUID(),photo:randomUUID(),legacy:randomUUID(),switched:randomUUID()};
 try{
  await cli(['open',`http://127.0.0.1:${address.port}/TEST-u10`]);
  const result=await evaluate(`async()=>{
   const p=await import('/module.mjs'),scope='${scope}';
   const call=async(data)=>(await fetch('/api',{method:'POST',body:JSON.stringify(data)})).json();
   window.TESTports={saveNote:(input,s)=>call({kind:'note',input,scope:s}),prepare:(input,s)=>call({kind:'prepare',input,scope:s}),finish:(id,s)=>call({kind:'finish',id,scope:s}),upload:p.uploadIntakeOriginal,currentScope:()=>scope};
   await p.retainPendingOriginal(scope,{id:'${ids.document}',itemId:'${ids.item}',kind:'file',file:new File(['TEST immutable bytes'],'TEST.bin',{type:'application/octet-stream'}),captureOrigin:'dokument',deviceId:null});
   const png=Uint8Array.from(atob('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+j6p0AAAAASUVORK5CYII='),c=>c.charCodeAt(0));
   await p.retainPendingOriginal(scope,{id:'${ids.photo}',itemId:'${ids.item}',kind:'file',file:new File([png],'TEST.png',{type:'image/png'}),captureOrigin:'warenfoto',deviceId:null});
   await new Promise((resolve,reject)=>{const r=indexedDB.open('kreile-pending-originals-v1-'+scope,1);r.onerror=()=>reject(r.error);r.onsuccess=()=>{const db=r.result,t=db.transaction('originals','readwrite');t.objectStore('originals').put({id:'${ids.legacy}',oldCommand:'TEST unknown',payload:{keep:'TEST unchanged'}});t.oncomplete=()=>{db.close();resolve();};};});
   await p.retainPendingOriginal(scope,{id:'${ids.noteItem}',itemId:'${ids.noteItem}',kind:'note',text:'TEST bitte anrufen',textstand:'${ids.note}',dismissed:['rueckruf'],expectedVersion:0});
   const [a,b]=await Promise.all([p.syncPendingFiles(scope,window.TESTports),p.syncPendingFiles(scope,window.TESTports)]);
   const rows=await p.readPendingEntries(scope);
   if(a.secured!==3||a.acknowledged!==2||b.acknowledged!==2||rows.length!==2||rows.some(x=>x.id==='${ids.document}')||!rows.some(x=>x.id==='${ids.legacy}'&&x.kind==='quarantine'))throw Error('TEST_SYNC_ACK_OR_PHOTO');
   return {secured:a.secured,acknowledged:a.acknowledged,retained:rows.length};
  }`);
  expect(result).toContain('"secured": 3');expect(api).toEqual({prepare:2,finish:2,note:1});
  expect(await sql`SELECT id::text FROM public.intake_file WHERE tenant_id=${KREILE_TENANT_SLUG} AND item_id=${ids.item}::uuid ORDER BY id`).toHaveLength(2);
  await evaluate(`async()=>{const p=await import('/module.mjs'),scope='${scope}';const before=(await p.readPendingEntries(scope)).find(x=>x.id==='${ids.photo}');await p.retainPendingOriginal(scope,{...before,file:new File(['TEST replacement must not destroy original'],before.file.name,{type:before.file.type}),deviceId:'11111111-1111-4111-8111-111111111111',deviceCapturedAt:'2000-01-01T00:00:00.000Z'});const after=(await p.readPendingEntries(scope)).find(x=>x.id==='${ids.photo}');if(after.deviceId!==before.deviceId||after.deviceCapturedAt!==before.deviceCapturedAt||await after.file.text()!==await before.file.text())throw Error('TEST_CAPTURE_IDENTITY_REPLACED');return {identityStable:true};}`);
  await evaluate(`async()=>{const p=await import('/module.mjs');const outcome=await p.syncPendingFiles('${scope}',{...window.TESTports});if(outcome.secured!==1||outcome.acknowledged!==0)throw Error('TEST_FRESH_RETRY');return {freshRetry:true};}`);
  expect(await sql`SELECT text,anliegen FROM public.intake_item WHERE tenant_id=${KREILE_TENANT_SLUG} AND id=${ids.noteItem}::uuid`).toEqual([{text:'TEST bitte anrufen',anliegen:[]}]);
  const noteSources=await sql`SELECT nachher FROM public.intake_event WHERE tenant_id=${KREILE_TENANT_SLUG} AND item_id=${ids.noteItem}::uuid AND art='original_gespeichert' AND befehl_id=${ids.note}::uuid`;
  expect(noteSources).toHaveLength(1);expect(noteSources[0].nachher).toMatchObject({expectedVersion:0,deviceCapturedAt:expect.stringMatching(/^\d{4}-/)});
  const deviceOrigins=await sql`SELECT nachher FROM public.intake_event WHERE tenant_id=${KREILE_TENANT_SLUG} AND item_id=${ids.item}::uuid AND art='einsatz' AND nachher->>'action'='offline_original_captured'`;
  expect(deviceOrigins).toHaveLength(2);for(const source of deviceOrigins)expect(source.nachher.deviceCapturedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  const [photo]=await sql`SELECT dateiname,mime,bytes::integer AS bytes,sha256 FROM public.intake_file WHERE tenant_id=${KREILE_TENANT_SLUG} AND id=${ids.photo}::uuid`;
  expect(await withSession(full,()=>prepareIntakeFileAction({itemId:ids.item,fileId:ids.photo,name:photo.dateiname,mime:photo.mime,bytes:photo.bytes,sha256:photo.sha256,captureOrigin:'warenfoto',deviceCapturedAt:'2000-01-01T00:00:00.000Z'},scope))).toMatchObject({code:'CONFLICT'});
  expect(await sql`SELECT nachher FROM public.intake_event WHERE tenant_id=${KREILE_TENANT_SLUG} AND item_id=${ids.item}::uuid AND art='einsatz' AND nachher->>'action'='offline_original_captured'`).toEqual(deviceOrigins);
  const otherAuth=await withSession(other,()=>getAuthorizationSnapshotAction());if(!otherAuth.ok)throw Error('TEST_OTHER_SCOPE');
  expect(await withSession(other,()=>saveIntakeNoteAction({itemId:ids.noteItem,textstand:ids.note,text:'TEST bitte anrufen',concerns:[],expectedVersion:0,deviceCapturedAt:noteSources[0].nachher.deviceCapturedAt},otherAuth.data.offlineScope))).toMatchObject({code:'CONFLICT'});
  const photoOrigin=deviceOrigins.find(source=>source.nachher.fileId===ids.photo)!;
  expect(await withSession(other,()=>prepareIntakeFileAction({itemId:ids.item,fileId:ids.photo,name:photo.dateiname,mime:photo.mime,bytes:photo.bytes,sha256:photo.sha256,captureOrigin:'warenfoto',deviceCapturedAt:photoOrigin.nachher.deviceCapturedAt},otherAuth.data.offlineScope))).toMatchObject({code:'FORBIDDEN'});
  expect(await withSession(full,()=>saveIntakeNoteAction({itemId:ids.noteItem,textstand:randomUUID(),text:'TEST server newer'}))).toMatchObject({code:'OK'});
  await evaluate(`async()=>{const p=await import('/module.mjs'),scope='${scope}';await p.retainPendingOriginal(scope,{id:'${ids.noteItem}',itemId:'${ids.noteItem}',kind:'note',text:'TEST offline older',textstand:'${ids.staleNote}',dismissed:[],expectedVersion:1});const result=await p.syncPendingFiles(scope,window.TESTports);const rows=await p.readPendingEntries(scope);if(result.blocked!==1||!rows.some(x=>x.kind==='note'&&x.textstand==='${ids.staleNote}'))throw Error('TEST_STALE_NOTE_DISCARDED');return {staleHeld:true};}`);
  expect(await sql`SELECT text FROM public.intake_item WHERE tenant_id=${KREILE_TENANT_SLUG} AND id=${ids.noteItem}::uuid`).toEqual([{text:'TEST server newer'}]);
  expect(await sql`SELECT id FROM public.intake_event WHERE tenant_id=${KREILE_TENANT_SLUG} AND item_id=${ids.noteItem}::uuid AND befehl_id=${ids.staleNote}::uuid`).toHaveLength(0);
  // IDB key order is UUID order, not capture order: the note must create the
  // intake before its later file, otherwise the expected base version conflicts.
  const orderedItem='ffffffff'+randomUUID().slice(8),orderedFile='00000000'+randomUUID().slice(8),orderedStand=randomUUID();
  await evaluate(`async()=>{const p=await import('/module.mjs'),scope='${scope}';await p.retainPendingOriginal(scope,{id:'${orderedItem}',itemId:'${orderedItem}',kind:'note',text:'TEST original first',textstand:'${orderedStand}',dismissed:[],expectedVersion:0});await new Promise(resolve=>setTimeout(resolve,5));await p.retainPendingOriginal(scope,{id:'${orderedFile}',itemId:'${orderedItem}',kind:'file',file:new File(['TEST later document'],'TEST-later.bin',{type:'application/octet-stream'}),deviceId:null});await p.syncPendingFiles(scope,window.TESTports);const rows=await p.readPendingEntries(scope);if(rows.some(x=>x.id==='${orderedItem}'||x.id==='${orderedFile}'))throw Error('TEST_CAPTURE_ORDER_LOST');return {captureOrder:true};}`);
  expect(await sql`SELECT text FROM public.intake_item WHERE tenant_id=${KREILE_TENANT_SLUG} AND id=${orderedItem}::uuid`).toEqual([{text:'TEST original first'}]);
  actor=other;
  const denied=await evaluate(`async()=>{const p=await import('/module.mjs'),scope='${scope}';await p.retainPendingOriginal(scope,{id:'${ids.switched}',itemId:'${ids.item}',kind:'file',file:new File(['TEST actor changed'],'TEST-switched.bin',{type:'application/octet-stream'}),deviceId:null});const result=await p.syncPendingFiles(scope,window.TESTports);const rows=await p.readPendingEntries(scope);if(result.acknowledged!==0||!rows.some(x=>x.id==='${ids.switched}'))throw Error('TEST_FOREIGN_ACK');return {acknowledged:result.acknowledged};}`);
  expect(denied).toContain('"acknowledged": 0');
  expect(await sql`SELECT id FROM public.intake_file WHERE tenant_id=${KREILE_TENANT_SLUG} AND id=${ids.switched}::uuid`).toHaveLength(0);
 }finally{await cli(['close']).catch(()=>{});await new Promise<void>(resolve=>server.close(()=>resolve()));}
},180000);
