// @vitest-environment node
// TEST HTTP bridge for actual Action/Auth/DB and native IndexedDB. No Next/UI/matrix claim.
import {it,vi,expect} from 'vitest';
import {randomUUID,createHash} from 'node:crypto';
import {createServer} from 'node:http';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {build} from 'esbuild';
const tenant=vi.hoisted(()=>'TEST-ablauf-'+globalThis.crypto.randomUUID());
vi.mock('@/lib/tenant',()=>({KREILE_TENANT_SLUG:tenant}));
import {sql,full,withSession,withRequest} from '../../../e2e/ablauf/replayHarness';
import {KREILE_TENANT_SLUG} from '@/lib/tenant';
import {offlinePartition} from '@/lib/server/offlinePartition';
import {COOKIE_NAME,signAppSession,getSecretKey} from '@/lib/server/appSession';
import {saveIntakeNoteAction,getIntakeCaptureAction,prepareIntakeFileAction,finishIntakeFileAction} from '@/app/actions/eingang.actions';
it.skipIf(!process.env.KREILE_PLAYWRIGHT_CLI_JS)('keeps a real quarantined note until the existing writer receipt, across double takeover and lost response/reload',async()=>{
 const scope=offlinePartition({tenantId:KREILE_TENANT_SLUG,userId:full.actorId}),deviceId=randomUUID(),text='TEST retained note bytes '+randomUUID(),sourceId='TEST-legacy-'+randomUUID();
 const bundle=await build({stdin:{contents:"export * from './src/lib/offline/pendingStore';export {syncPendingFiles} from './src/lib/offline/syncPendingFiles';export {uploadIntakeOriginal} from './src/modules/eingang/intakeOriginalUpload';",resolveDir:process.cwd()},bundle:true,write:false,format:'esm',platform:'browser',define:{'process.env.NEXT_PUBLIC_SUPABASE_URL':JSON.stringify(process.env.NEXT_PUBLIC_SUPABASE_URL),'process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY':JSON.stringify(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)}});
 let loseResponse=true,calls=0,itemId='';
 let fileItemId='',loseFileResponse=true;
 const server=createServer(async(req,res)=>{
  if(req.url==='/queue.mjs'){res.writeHead(200,{'content-type':'text/javascript'});res.end(bundle.outputFiles[0].text);return;}
  if(req.url==='/TEST/prepare'||req.url==='/TEST/finish'){
   try{const chunks:Buffer[]=[];for await(const chunk of req)chunks.push(Buffer.from(chunk));const body=JSON.parse(Buffer.concat(chunks).toString());
    const result=req.url==='/TEST/prepare'?await withRequest(req.headers.cookie??'',()=>prepareIntakeFileAction(body.input,body.scope)):await withRequest(req.headers.cookie??'',()=>finishIntakeFileAction(body.input,body.scope));
    if(req.url==='/TEST/prepare')fileItemId=body.input.itemId;
    if(req.url==='/TEST/finish'&&result.code==='OK'&&loseFileResponse){loseFileResponse=false;res.writeHead(503);res.end();return;}
    res.writeHead(200,{'content-type':'application/json'});res.end(JSON.stringify(result));
   }catch{res.writeHead(503);res.end();}return;
  }
  if(req.url==='/TEST/note'){
   try{
    calls++;const chunks:Buffer[]=[];for await(const chunk of req)chunks.push(Buffer.from(chunk));
    const body=JSON.parse(Buffer.concat(chunks).toString()),result=await withRequest(req.headers.cookie??'',()=>saveIntakeNoteAction(body.input,body.scope));
    if(result.code==='OK')itemId=result.capture.id;
    if(loseResponse&&result.code==='OK'){loseResponse=false;res.writeHead(503,{'content-type':'application/json'});res.end(JSON.stringify({code:'UNAVAILABLE'}));return;}
    res.writeHead(200,{'content-type':'application/json'});res.end(JSON.stringify(result));
   }catch{res.writeHead(503);res.end();}return;
  }
  const token=signAppSession({userId:full.actorId,tenantId:KREILE_TENANT_SLUG,role:full.role,displayName:'TEST native actor',issuedAt:full.actorIssuedAt,expiresAt:Date.now()+300000},getSecretKey());
  res.writeHead(200,{'content-type':'text/html','set-cookie':`${COOKIE_NAME}=${token}; HttpOnly; Path=/; SameSite=Lax`});res.end('<!doctype html><title>TEST native takeover bridge</title>');
 });
 await new Promise<void>(resolve=>server.listen(0,'127.0.0.1',resolve));const address=server.address();if(!address||typeof address==='string')throw Error('TEST_LOOPBACK');
 const execute=promisify(execFile),session='TEST-takeover-'+randomUUID();
 const cli=async(args:string[])=>{const result=await execute(process.execPath,[process.env.KREILE_PLAYWRIGHT_CLI_JS!,`-s=${session}`,...args],{timeout:90000,maxBuffer:1024*1024}).catch(error=>{throw Error('TEST_BROWSER:'+String(error.stdout??error.message).slice(0,2000));});if(result.stdout.includes('### Error'))throw Error(result.stdout.slice(0,1800));return result;};
 const setup=`async()=>{window.TESTq=await import('/queue.mjs');window.TESTports={currentScope:()=>'${scope}',saveNote:async(input,scope)=>{const r=await fetch('/TEST/note',{method:'POST',credentials:'same-origin',headers:{'content-type':'application/json'},body:JSON.stringify({input,scope})});return r.ok?r.json():{code:'UNAVAILABLE'};}};return true;}`;
 try{
  await cli(['open',`http://127.0.0.1:${address.port}/TEST`]);await cli(['eval',setup]);
  await cli(['eval',`async()=>{const p=window.TESTq;await p.retainQuarantinedPending('${scope}',{id:'${sourceId}',kind:'quarantine',capturedAt:'',payload:{reason:'NOTE_SYNC_METADATA_MISSING',original:{kind:'note',text:${JSON.stringify(text)}}}});const source=(await p.readPendingEntries('${scope}'))[0];window.TESTsource=JSON.stringify(source);const copies=await Promise.all([p.adoptQuarantinedOriginal('${scope}',source.id,'${deviceId}'),p.adoptQuarantinedOriginal('${scope}',source.id,'${deviceId}')]);if(copies.some(x=>x.code!=='OK')||copies[0].original.id!==copies[1].original.id)throw Error('TEST_DOUBLE_TAKEOVER');const result=await p.syncPendingFiles('${scope}',window.TESTports);const retained=await p.readPendingEntries('${scope}');if(result.acknowledged!==0||result.blocked!==1||retained.length!==2||JSON.stringify(retained.find(x=>x.kind==='quarantine'))!==window.TESTsource)throw Error('TEST_ORIGINAL_LOST_WITH_RESPONSE');return true;}`]);
  const physical=await withSession(full,()=>getIntakeCaptureAction(itemId));expect(physical).toMatchObject({code:'OK',capture:{text,takeovers:[{actorId:full.actorId,deviceId}]}});
  await cli(['goto',`http://127.0.0.1:${address.port}/TEST`]);await cli(['eval',setup]);
  await cli(['eval',`async()=>{const p=window.TESTq,result=await p.syncPendingFiles('${scope}',window.TESTports);if(result.acknowledged!==1||(await p.readPendingEntries('${scope}')).length!==0)throw Error('TEST_TAKEOVER_RETRY_ACK');return true;}`]);
  expect(await withSession(full,()=>getIntakeCaptureAction(itemId))).toEqual(physical);expect(calls).toBe(2);
  expect(await sql`SELECT id FROM public.intake_event WHERE tenant_id=${KREILE_TENANT_SLUG} AND item_id=${itemId}::uuid AND nachher->>'action'='original_adopted'`).toHaveLength(1);
  const fileSource='TEST-file-'+randomUUID(),fileText='TEST immutable native takeover bytes '+randomUUID();
  const setupFile=`async()=>{window.TESTq=await import('/queue.mjs');window.TESTports={currentScope:()=>'${scope}',prepare:async(input,scope)=>{const r=await fetch('/TEST/prepare',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({input,scope})});return r.ok?r.json():{code:'UNAVAILABLE'};},finish:async(input,scope)=>{const r=await fetch('/TEST/finish',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({input,scope})});return r.ok?r.json():{code:'UNAVAILABLE'};},upload:window.TESTq.uploadIntakeOriginal};return true;}`;
  await cli(['eval',setupFile]);
  await cli(['eval',`async()=>{const p=window.TESTq;await p.retainQuarantinedPending('${scope}',{id:'${fileSource}',kind:'quarantine',capturedAt:'',payload:{original:{file:new File([${JSON.stringify(fileText)}],'TEST-original.txt',{type:'text/plain'})}}});const source=(await p.readPendingEntries('${scope}'))[0];const adopted=await p.adoptQuarantinedOriginal('${scope}',source.id,'${deviceId}');if(adopted.code!=='OK'||adopted.original.kind!=='file')throw Error('TEST_FILE_TAKEOVER');await p.retainQuarantinedPending('${scope}',{id:'${fileSource}',kind:'quarantine',capturedAt:'',payload:{original:{file:new File(['TEST changed'],'TEST-original.txt',{type:'text/plain'})}}});const first=await p.syncPendingFiles('${scope}',window.TESTports);const kept=await p.readPendingEntries('${scope}');if(first.acknowledged!==0||kept.length!==2||await kept.find(x=>x.kind==='quarantine').payload.original.file.text()!==${JSON.stringify(fileText)})throw Error('TEST_FILE_REMOVED_OR_REPLACED');return true;}`]);
  await cli(['goto',`http://127.0.0.1:${address.port}/TEST`]);await cli(['eval',setupFile]);
  await cli(['eval',`async()=>{const result=await window.TESTq.syncPendingFiles('${scope}',window.TESTports);if(result.acknowledged!==1||(await window.TESTq.readPendingEntries('${scope}')).length!==0)throw Error('TEST_FILE_RETRY_NOT_ACKNOWLEDGED');return true;}`]);
  const fileRead=await withSession(full,()=>getIntakeCaptureAction(fileItemId));expect(fileRead).toMatchObject({code:'OK',capture:{files:[{secured:true}],takeovers:[{actorId:full.actorId,deviceId}]}});
  expect(await sql`SELECT sha256 FROM public.intake_file WHERE tenant_id=${KREILE_TENANT_SLUG} AND item_id=${fileItemId}::uuid`).toEqual([{sha256:createHash('sha256').update(fileText).digest('hex')}]);
 }finally{await execute(process.execPath,[process.env.KREILE_PLAYWRIGHT_CLI_JS!,`-s=${session}`,'close'],{timeout:30000}).catch(()=>{});await new Promise<void>(resolve=>server.close(()=>resolve()));}
},120000);
