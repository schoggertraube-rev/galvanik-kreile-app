// @vitest-environment node
// TEST native file queue -> actual Actions/Auth/DB/Storage. Not a Next/UI/24h proof.
import {vi,it,expect} from 'vitest';
import {randomUUID} from 'node:crypto';
import {createServer} from 'node:http';
import {execFileSync} from 'node:child_process';
import path from 'node:path';
import {readFileSync} from 'node:fs';
import {build} from 'esbuild';
import {chromium} from 'playwright';
const tenant=vi.hoisted(()=>'TEST-ablauf-'+globalThis.crypto.randomUUID());
vi.mock('@/lib/tenant',()=>({KREILE_TENANT_SLUG:tenant}));
import {KREILE_TENANT_SLUG} from '@/lib/tenant';
import {sql,full,withSession,createFixture} from '../../../e2e/ablauf/replayHarness';
import {TEST_PHOTO_BYTES} from '../../../e2e/ablauf/photoFixture';
import {getIntakePendingScopeAction,prepareIntakeFileAction,finishIntakeFileAction} from '@/app/actions/eingang.actions';
import {setEvidenceVisibilityAction} from '@/app/actions/domainAttachments.actions';
if(!process.env.DATABASE_URL||process.env.DATABASE_URL!==process.env.H18_EXPECTED_DATABASE_URL
 ||new URL(process.env.DATABASE_URL).hostname!=='127.0.0.1')throw Error('S11_LOOPBACK_TEST_REQUIRED');

it.skipIf(!process.env.KREILE_PLAYWRIGHT_CLI_JS)('KORR S11 2 native offline capture retains its visibility and original time through real response loss; later switches never enter the queue',async()=>{
 const scopeRead=await withSession(full,()=>getIntakePendingScopeAction());if(scopeRead.code!=='OK')throw Error('TEST_S11_REAL_SCOPE');
 const scope=scopeRead.scope,itemId=randomUUID(),fileId=randomUUID(),defaultFileId=randomUUID(),deviceId=randomUUID();
 const foreign=await createFixture(['eingang']);let actor=full,loseFinish=true,visibilityCalls=0;
 const local=JSON.parse(execFileSync(process.execPath,[path.resolve('node_modules/supabase/dist/supabase.js'),'status','-o','json'],{encoding:'utf8',stdio:['ignore','pipe','pipe']})) as Record<string,string>;
 if(new URL(local.API_URL).hostname!=='127.0.0.1')throw Error('TEST_S11_LOOPBACK_STORAGE');
 const publicFile=path.resolve('src/modules/eingang/public.ts');
 const selected=/export\s*\{\s*uploadIntakeOriginal\s*\}\s*from\s*["']([^"']+)["']/.exec(readFileSync(publicFile,'utf8'));
 if(!selected)throw Error('TEST_S11_PUBLIC_UPLOAD_EXPORT_MISSING');
 const realPublicUpload=path.resolve(path.dirname(publicFile),selected[1]+'.ts');
 const compiled=await build({stdin:{resolveDir:process.cwd(),loader:'ts',contents:`
  import {retainPendingOriginal,readPendingEntries,adoptQuarantinedOriginal} from './src/lib/offline/pendingStore';
  import {syncPendingFiles} from './src/lib/offline/syncPendingFiles';
  import {uploadIntakeOriginal} from './src/modules/eingang/public';
  import {changeEvidenceVisibilityOnline} from './src/lib/offline/evidenceVisibilityClient';
  const scope=${JSON.stringify(scope)};
  window.s11Rpc=async(op,args)=>{const response=await fetch('/rpc',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({op,args})});return response.json();};
  window.s11={
   capture:async()=>{
    const bytes=Uint8Array.from(atob(${JSON.stringify(TEST_PHOTO_BYTES.toString('base64'))}),ch=>ch.charCodeAt(0));
    const first={id:${JSON.stringify(fileId)},itemId:${JSON.stringify(itemId)},kind:'file',file:new File([bytes],'TEST-S11-offline.png',{type:'image/png'}),captureOrigin:'warenfoto',deviceId:${JSON.stringify(deviceId)},customerVisible:true};
    await retainPendingOriginal(scope,first);
    await retainPendingOriginal(scope,{...first,customerVisible:false,file:new File(['TEST replaced bytes'],'TEST-replaced.png',{type:'image/png'})});
    await retainPendingOriginal(scope,{id:${JSON.stringify(defaultFileId)},itemId:${JSON.stringify(itemId)},kind:'file',file:new File([bytes],'TEST-S11-default.png',{type:'image/png'}),captureOrigin:'warenfoto',deviceId:${JSON.stringify(deviceId)}});
    return window.s11.inventory();
   },
   inventory:async()=>Promise.all((await readPendingEntries(scope)).map(async entry=>({id:entry.id,kind:entry.kind,customerVisible:entry.customerVisible,deviceCapturedAt:entry.deviceCapturedAt,sequence:entry.queueSequence,name:entry.file?.name,sha256:entry.file?Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',await entry.file.arrayBuffer())),b=>b.toString(16).padStart(2,'0')).join(''):null}))),
   sync:()=>syncPendingFiles(scope,{currentScope:()=>scope,prepare:(...args)=>window.s11Rpc('prepare',args),finish:(...args)=>window.s11Rpc('finish',args),upload:uploadIntakeOriginal,saveNote:()=>{throw Error('TEST_S11_UNEXPECTED_NOTE');}},{offline24h:true}),
   change:input=>changeEvidenceVisibilityOnline(input),
   poison:async()=>{
    const raw=await new Promise((resolve,reject)=>{const opening=indexedDB.open('kreile-pending-originals-v1-'+scope,3);opening.onerror=()=>reject(opening.error);opening.onsuccess=()=>{const db=opening.result,tx=db.transaction('originals','readwrite'),store=tx.objectStore('originals'),read=store.get(${JSON.stringify(fileId)});let row;read.onsuccess=()=>{row=read.result;row.customerVisible='TEST-invalid-visibility';store.put(row);};tx.oncomplete=()=>{db.close();resolve(row);};tx.onabort=()=>{db.close();reject(tx.error);};};});
    return {inventory:await window.s11.inventory(),rawFlag:raw.customerVisible,rawHash:Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',await raw.file.arrayBuffer())),b=>b.toString(16).padStart(2,'0')).join('')};
   },
   adopt:id=>adoptQuarantinedOriginal(scope,id,${JSON.stringify(deviceId)},()=>scope),
  };`},bundle:true,write:false,format:'esm',platform:'browser',
  define:{'process.env.NEXT_PUBLIC_SUPABASE_URL':JSON.stringify(local.API_URL),'process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY':JSON.stringify(local.ANON_KEY)},
  plugins:[{name:'TEST-real-action-transport',setup(builder){
   // Select the actual named client export. Unrelated Next UI exports need
   // their app compiler; no uploader implementation or guard is replaced.
   builder.onResolve({filter:/^\.\/src\/modules\/eingang\/public$/},()=>({path:realPublicUpload}));
   builder.onResolve({filter:/^@\/app\/actions\/domainAttachments\.actions$/},()=>({path:'visibility-action',namespace:'TEST-action-transport'}));
   builder.onLoad({filter:/.*/,namespace:'TEST-action-transport'},()=>({contents:`export const setEvidenceVisibilityAction=input=>window.s11Rpc('visibility',[input]);`,loader:'js'}));
  }}]});
 const server=createServer(async(req,res)=>{
  res.setHeader('Cache-Control','no-store');res.setHeader('Connection','close');
  try{
   if(req.url==='/queue.js'){res.setHeader('Content-Type','text/javascript');res.end(compiled.outputFiles[0].text);return;}
   if(req.url!=='/rpc'){res.setHeader('Content-Type','text/html');res.end('<!doctype html><title>TEST S11 native queue bridge</title><script type="module" src="/queue.js"></script>');return;}
   const chunks:Buffer[]=[];for await(const chunk of req)chunks.push(Buffer.from(chunk));
   const body=JSON.parse(Buffer.concat(chunks).toString('utf8')) as {op:string;args:unknown[]};
   let result:unknown;
   if(body.op==='prepare')result=await withSession(actor,()=>prepareIntakeFileAction(body.args[0],body.args[1] as string));
   else if(body.op==='finish'){
    result=await withSession(actor,()=>finishIntakeFileAction(body.args[0] as string,body.args[1] as string,body.args[2] as boolean|undefined));
    if(loseFinish){loseFinish=false;req.socket.destroy();return;}
   }else if(body.op==='visibility'){visibilityCalls++;result=await withSession(actor,()=>setEvidenceVisibilityAction(body.args[0]));}
   else throw Error('TEST_S11_UNKNOWN_RPC');
   res.setHeader('Content-Type','application/json');res.end(JSON.stringify(result));
  }catch(error){res.statusCode=500;res.end(JSON.stringify({code:'UNAVAILABLE',error:error instanceof Error?error.name:'unknown'}));}
 });
 await new Promise<void>(resolve=>server.listen(0,'127.0.0.1',resolve));
 const address=server.address();if(!address||typeof address==='string')throw Error('TEST_S11_SERVER_ADDRESS');
 const browser=await chromium.launch({headless:true});
 try{
  const context=await browser.newContext(),page=await context.newPage();
  await page.goto('http://127.0.0.1:'+address.port);await page.waitForFunction('Boolean(window.s11)');
  await context.setOffline(true);
  const captured=await page.evaluate<Array<{id:string;customerVisible?:boolean;deviceCapturedAt:string;name:string;sha256:string}>>('window.s11.capture()');
  const original=captured.find(row=>row.id===fileId);expect(original).toMatchObject({customerVisible:true,name:'TEST-S11-offline.png'});expect(captured).toHaveLength(2);
  const change={evidenceKey:'intake-file:'+fileId,customerVisible:false,expectedVersion:1,clientEventId:randomUUID()};
  expect(await page.evaluate(input=>(window as unknown as {s11:{change:(value:unknown)=>Promise<unknown>}}).s11.change(input),change)).toMatchObject({code:'UNAVAILABLE',message:'Geht nur mit Netz'});
  expect(visibilityCalls).toBe(0);expect(await page.evaluate('window.s11.inventory()')).toEqual(captured);
  await context.setOffline(false);actor=foreign;
  expect(await page.evaluate('window.s11.sync()')).toMatchObject({secured:0,acknowledged:0,blocked:2});
  expect(await sql`SELECT id FROM public.intake_file WHERE tenant_id=${KREILE_TENANT_SLUG}`).toHaveLength(0);
  actor=full;
  expect(await page.evaluate('window.s11.sync()')).toMatchObject({secured:0,acknowledged:0,blocked:2});
  const read=()=>sql.begin(async tx=>{await tx`SELECT set_config('app.tenant_id',${KREILE_TENANT_SLUG},true)`;return tx`SELECT source_id,original_hash,customer_visible,visibility_version,visibility_occurred_at FROM private.v_evidence_records_v3 WHERE tenant_id=${KREILE_TENANT_SLUG} AND source_id=${fileId}`;});
  expect(await read()).toEqual([expect.objectContaining({source_id:fileId,original_hash:original!.sha256,customer_visible:true,visibility_version:1,visibility_occurred_at:new Date(original!.deviceCapturedAt)})]);
  await page.reload();await page.waitForFunction('Boolean(window.s11)');
  expect(await page.evaluate('window.s11.inventory()')).toEqual(captured);
  expect(await page.evaluate('window.s11.sync()')).toMatchObject({secured:2,acknowledged:0,blocked:0});
  expect(await page.evaluate('window.s11.inventory()')).toEqual(captured); // Goods association is still genuinely outstanding.
  const defaults=await sql.begin(async tx=>{await tx`SELECT set_config('app.tenant_id',${KREILE_TENANT_SLUG},true)`;return tx`SELECT customer_visible,visibility_version FROM private.v_evidence_records_v3 WHERE source_id=${defaultFileId}`;});
  expect(defaults).toEqual([{customer_visible:false,visibility_version:0}]);
  expect(await sql`SELECT version,actor_id::text FROM private.evidence_visibility_events WHERE tenant_id=${KREILE_TENANT_SLUG} AND evidence_key=${'intake-file:'+fileId} AND record_kind='change'`).toEqual([{version:1,actor_id:full.actorId}]);
  expect(await page.evaluate(input=>(window as unknown as {s11:{change:(value:unknown)=>Promise<unknown>}}).s11.change(input),change)).toMatchObject({code:'OK',data:{customerVisible:false,version:2}});
  expect(visibilityCalls).toBe(1);
  expect(await page.evaluate('window.s11.sync()')).toMatchObject({secured:2,acknowledged:0,blocked:0});
  expect(await read()).toEqual([expect.objectContaining({customer_visible:false,visibility_version:2})]);
  // Explicit local metadata corruption: project quarantine, retain the bytes,
  // and refuse an adoption that would silently replace unknown with internal.
  const poisoned=await page.evaluate<{inventory:Array<{id:string;kind:string}>;rawFlag:string;rawHash:string}>('window.s11.poison()');
  expect(poisoned).toMatchObject({rawFlag:'TEST-invalid-visibility',rawHash:original!.sha256});
  const quarantine=poisoned.inventory.filter(row=>row.kind==='quarantine');expect(quarantine).toHaveLength(1);
  expect(await page.evaluate(id=>(window as unknown as {s11:{adopt:(value:string)=>Promise<unknown>}}).s11.adopt(id),quarantine[0].id)).toMatchObject({code:'SOURCE_INCOMPLETE'});
  expect(await page.evaluate('window.s11.inventory()')).toEqual(poisoned.inventory);
  await context.close();
 }finally{await browser.close();server.closeAllConnections();await new Promise<void>(resolve=>server.close(()=>resolve()));}
});
