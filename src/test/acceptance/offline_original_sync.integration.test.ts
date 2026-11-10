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
import {prepareIntakeFileAction,finishIntakeFileAction} from '@/app/actions/eingang.actions';
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
 const api={prepare:0,finish:0};
 const server=createServer(async(req,res)=>{try{
  if(req.url==='/module.mjs'){res.setHeader('Content-Type','text/javascript');res.end(compiled.outputFiles[0].text);return;}
  if(req.url==='/api'&&req.method==='POST'){
   let body='';for await(const chunk of req)body+=chunk;
   const input=JSON.parse(body);let result;
   if(input.kind==='prepare'){api.prepare++;result=await withSession(actor,()=>prepareIntakeFileAction(input.input,input.scope));}
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
 const ids={item:randomUUID(),document:randomUUID(),photo:randomUUID(),legacy:randomUUID(),switched:randomUUID()};
 try{
  await cli(['open',`http://127.0.0.1:${address.port}/TEST-u10`]);
  const result=await evaluate(`async()=>{
   const p=await import('/module.mjs'),scope='${scope}';
   const call=async(data)=>(await fetch('/api',{method:'POST',body:JSON.stringify(data)})).json();
   window.TESTports={prepare:(input,s)=>call({kind:'prepare',input,scope:s}),finish:(id,s)=>call({kind:'finish',id,scope:s}),upload:p.uploadIntakeOriginal,currentScope:()=>scope};
   await p.retainPendingOriginal(scope,{id:'${ids.document}',itemId:'${ids.item}',kind:'file',file:new File(['TEST immutable bytes'],'TEST.bin',{type:'application/octet-stream'}),captureOrigin:'dokument',deviceId:null});
   const png=Uint8Array.from(atob('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+j6p0AAAAASUVORK5CYII='),c=>c.charCodeAt(0));
   await p.retainPendingOriginal(scope,{id:'${ids.photo}',itemId:'${ids.item}',kind:'file',file:new File([png],'TEST.png',{type:'image/png'}),captureOrigin:'warenfoto',deviceId:null});
   await new Promise((resolve,reject)=>{const r=indexedDB.open('kreile-pending-originals-v1-'+scope,1);r.onerror=()=>reject(r.error);r.onsuccess=()=>{const db=r.result,t=db.transaction('originals','readwrite');t.objectStore('originals').put({id:'${ids.legacy}',oldCommand:'TEST unknown',payload:{keep:'TEST unchanged'}});t.oncomplete=()=>{db.close();resolve();};};});
   const [a,b]=await Promise.all([p.syncPendingFiles(scope,window.TESTports),p.syncPendingFiles(scope,window.TESTports)]);
   const rows=await p.readPendingEntries(scope);
   if(a.secured!==2||a.acknowledged!==1||b.acknowledged!==1||rows.length!==2||rows.some(x=>x.id==='${ids.document}')||!rows.some(x=>x.id==='${ids.legacy}'&&x.kind==='quarantine'))throw Error('TEST_SYNC_ACK_OR_PHOTO');
   return {secured:a.secured,acknowledged:a.acknowledged,retained:rows.length};
  }`);
  expect(result).toContain('"secured": 2');expect(api).toEqual({prepare:2,finish:2});
  expect(await sql`SELECT id::text FROM public.intake_file WHERE tenant_id=${KREILE_TENANT_SLUG} AND item_id=${ids.item}::uuid ORDER BY id`).toHaveLength(2);
  actor=other;
  const denied=await evaluate(`async()=>{const p=await import('/module.mjs'),scope='${scope}';await p.retainPendingOriginal(scope,{id:'${ids.switched}',itemId:'${ids.item}',kind:'file',file:new File(['TEST actor changed'],'TEST-switched.bin',{type:'application/octet-stream'}),deviceId:null});const result=await p.syncPendingFiles(scope,window.TESTports);const rows=await p.readPendingEntries(scope);if(result.acknowledged!==0||!rows.some(x=>x.id==='${ids.switched}'))throw Error('TEST_FOREIGN_ACK');return {acknowledged:result.acknowledged};}`);
  expect(denied).toContain('"acknowledged": 0');
  expect(await sql`SELECT id FROM public.intake_file WHERE tenant_id=${KREILE_TENANT_SLUG} AND id=${ids.switched}::uuid`).toHaveLength(0);
 }finally{await cli(['close']).catch(()=>{});await new Promise<void>(resolve=>server.close(()=>resolve()));}
},180000);
