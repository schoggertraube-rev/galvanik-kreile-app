// @vitest-environment node
// K2: native IndexedDB/browser, actual Actions/Auth/DB/Storage, TEST HTTP transport only.
import {createServer} from 'node:http';
import {randomUUID,createHash} from 'node:crypto';
import {build} from 'esbuild';
import {chromium,type Browser} from 'playwright';
import {expect,it,vi} from 'vitest';
const tenant=vi.hoisted(()=>'TEST-ablauf-'+globalThis.crypto.randomUUID());
vi.mock('@/lib/tenant',()=>({KREILE_TENANT_SLUG:tenant}));
import {KREILE_TENANT_SLUG} from '@/lib/tenant';
import {full,sql,withRequest,withSession} from '../../../e2e/ablauf/replayHarness';
import {TEST_PHOTO_BYTES} from '../../../e2e/ablauf/photoFixture';
import {offlinePartition} from '@/lib/server/offlinePartition';
import {COOKIE_NAME,getSecretKey,signAppSession} from '@/lib/server/appSession';
import {prepareIntakeFileAction,finishIntakeFileAction,getIntakeCaptureAction} from '@/app/actions/eingang.actions';
it('K2 retains a real goods photo through failed upload/reload and preserves quarantined goods metadata on adoption',async()=>{
 const scope=offlinePartition({tenantId:KREILE_TENANT_SLUG,userId:full.actorId}),deviceId=randomUUID(),fileId=randomUUID(),itemId=randomUUID();
 const context={orderId:randomUUID(),receiptId:randomUUID(),clientKey:randomUUID(),photoKind:'uebersicht' as const};
 const capturedAt=new Date(Date.now()-180000).toISOString();
 const bundle=await build({stdin:{contents:"export * from './src/lib/offline/pendingStore';export {syncPendingFiles} from './src/lib/offline/syncPendingFiles';export {uploadIntakeOriginal} from './src/modules/eingang/intakeOriginalUpload';",resolveDir:process.cwd()},bundle:true,write:false,format:'esm',platform:'browser',define:{'process.env.NEXT_PUBLIC_SUPABASE_URL':JSON.stringify(process.env.NEXT_PUBLIC_SUPABASE_URL),'process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY':JSON.stringify(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY??'')}});
 const server=createServer(async(req,res)=>{
  if(req.url==='/queue.mjs'){res.writeHead(200,{'content-type':'text/javascript'});res.end(bundle.outputFiles[0].text);return;}
  if(req.url==='/TEST/prepare'||req.url==='/TEST/finish'){
   try{const chunks:Buffer[]=[];for await(const chunk of req)chunks.push(Buffer.from(chunk));const value=JSON.parse(Buffer.concat(chunks).toString());
    const result=req.url==='/TEST/prepare'?await withRequest(req.headers.cookie??'',()=>prepareIntakeFileAction(value.input,value.scope)):await withRequest(req.headers.cookie??'',()=>finishIntakeFileAction(value.input,value.scope));
    res.writeHead(200,{'content-type':'application/json'});res.end(JSON.stringify(result));
   }catch{res.writeHead(503);res.end();}return;
  }
  const cookie=signAppSession({userId:full.actorId,tenantId:KREILE_TENANT_SLUG,role:full.role,displayName:'TEST K2 actor',issuedAt:full.actorIssuedAt,expiresAt:Date.now()+300000},getSecretKey());
  res.writeHead(200,{'content-type':'text/html','set-cookie':`${COOKIE_NAME}=${cookie}; HttpOnly; Path=/; SameSite=Lax`});res.end('<!doctype html><title>TEST K2 native original transport</title>');
 });
 await new Promise<void>(resolve=>server.listen(0,'127.0.0.1',resolve));const address=server.address();if(!address||typeof address==='string')throw Error('TEST_K2_LOOPBACK_REQUIRED');
 let browser:Browser|undefined;
 try{
  browser=await chromium.launch({headless:true});const page=await browser.newPage();await page.goto(`http://127.0.0.1:${address.port}/TEST`);
  const evaluate=(expression:string)=>page.evaluate('('+expression+')()');
  const setup=`async()=>{const p=await import('/queue.mjs');window.TESTq=p;window.TESTports={currentScope:()=>${JSON.stringify(scope)},prepare:async(input,scope)=>{const r=await fetch('/TEST/prepare',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({input,scope})});return r.ok?r.json():{code:'UNAVAILABLE'};},finish:async(input,scope)=>{const r=await fetch('/TEST/finish',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({input,scope})});return r.ok?r.json():{code:'UNAVAILABLE'};},upload:p.uploadIntakeOriginal};return true;}`;
  await evaluate(setup);
  await evaluate(`async()=>{const bytes=Uint8Array.from(atob(${JSON.stringify(TEST_PHOTO_BYTES.toString('base64'))}),x=>x.charCodeAt(0));await window.TESTq.retainPendingOriginal(${JSON.stringify(scope)},{id:${JSON.stringify(fileId)},itemId:${JSON.stringify(itemId)},kind:'file',file:new File([bytes],'TEST-K2.png',{type:'image/png'}),deviceId:${JSON.stringify(deviceId)},captureOrigin:'warenfoto',context:${JSON.stringify(context)}});return true;}`);
  // The first actual upload route fails; no original can be acknowledged or quarantined.
  await page.route('**/storage/v1/object/upload/sign/scans/**',route=>route.abort('failed'));
  const first=await evaluate(`async()=>window.TESTq.syncPendingFiles(${JSON.stringify(scope)},window.TESTports,{offline24h:true})`);
  expect(first).toMatchObject({secured:0,acknowledged:0,blocked:1});
  await page.reload();await evaluate(setup);
  expect(await evaluate(`async()=>{const rows=await window.TESTq.readPendingEntries(${JSON.stringify(scope)});return rows.map(row=>({kind:row.kind,captureOrigin:row.captureOrigin,deviceId:row.deviceId,context:row.context}));}`)).toEqual([{kind:'file',captureOrigin:'warenfoto',deviceId,context}]);
  await page.unroute('**/storage/v1/object/upload/sign/scans/**');
  expect(await evaluate(`async()=>window.TESTq.syncPendingFiles(${JSON.stringify(scope)},window.TESTports,{offline24h:true})`)).toMatchObject({secured:1,acknowledged:0,blocked:0});
  expect(await withSession(full,()=>getIntakeCaptureAction(itemId))).toMatchObject({code:'OK',capture:{files:[{id:fileId,secured:true,captureOrigin:'warenfoto'}]}});
  expect(await sql`SELECT sha256 FROM public.intake_file WHERE tenant_id=${KREILE_TENANT_SLUG} AND id=${fileId}::uuid`).toEqual([{sha256:createHash('sha256').update(TEST_PHOTO_BYTES).digest('hex')}]);
  // Still retained for the existing dialog's real receipt association; blob storage alone is not enough.
  expect(await evaluate(`async()=>(await window.TESTq.readPendingEntries(${JSON.stringify(scope)})).filter(x=>x.kind==='file').length`)).toBe(1);
  const result=await evaluate(`async()=>{const p=window.TESTq,scope=${JSON.stringify(scope)};await p.retainQuarantinedPending(scope,{id:'TEST-K2-quarantine',kind:'quarantine',capturedAt:${JSON.stringify(capturedAt)},payload:{reason:'FILE_SYNC_DEVICE_ID_MISSING',original:{kind:'file',file:new File(['TEST historical original'],'TEST-old.png',{type:'image/png'}),captureOrigin:'warenfoto',context:${JSON.stringify(context)},deviceCapturedAt:${JSON.stringify(capturedAt)}}}});const source=(await p.readPendingEntries(scope)).find(x=>x.kind==='quarantine'),before=JSON.stringify(source);const adopted=await p.adoptQuarantinedOriginal(scope,source.id,${JSON.stringify(deviceId)});const again=await p.adoptQuarantinedOriginal(scope,source.id,${JSON.stringify(deviceId)});const after=(await p.readPendingEntries(scope)).find(x=>x.kind==='quarantine');return {code:adopted.code,kind:adopted.original?.kind,origin:adopted.original?.captureOrigin,context:adopted.original?.context,capturedAt:adopted.original?.deviceCapturedAt,sameId:adopted.original?.id===again.original?.id,originalUnchanged:JSON.stringify(after)===before,originalRecord:adopted.original?.takeover?.originalRecord};}`);
  expect(result).toMatchObject({code:'OK',kind:'file',origin:'warenfoto',context,capturedAt,sameId:true,originalUnchanged:true});
  const fallback=await evaluate(`async()=>{const p=window.TESTq,scope=${JSON.stringify(scope)},before=Date.now();await p.retainQuarantinedPending(scope,{id:'TEST-K2-invalid',kind:'quarantine',capturedAt:'',payload:{original:{file:new File(['TEST malformed metadata'],'TEST-invalid.png',{type:'image/png'}),captureOrigin:'unknown',context:{orderId:3},deviceCapturedAt:'bad-clock'}}});const source=(await p.readPendingEntries(scope)).find(x=>x.kind==='quarantine'&&x.payload.original?.deviceCapturedAt==='bad-clock');const original=JSON.stringify(source),adopted=await p.adoptQuarantinedOriginal(scope,source.id,${JSON.stringify(deviceId)});return {code:adopted.code,origin:adopted.original?.captureOrigin,hasContext:Object.hasOwn(adopted.original??{},'context'),currentTime:Date.parse(adopted.original?.deviceCapturedAt)>=before,oldClockPreserved:adopted.original?.takeover?.originalRecord.includes('bad-clock'),originalUnchanged:JSON.stringify((await p.readPendingEntries(scope)).find(x=>x.id===source.id))===original};}`);
  expect(fallback).toEqual({code:'OK',origin:'dokument',hasContext:false,currentTime:true,oldClockPreserved:true,originalUnchanged:true});
 }finally{await browser?.close();await new Promise<void>(resolve=>server.close(()=>resolve()));}
},120000);
