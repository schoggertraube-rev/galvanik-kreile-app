// @vitest-environment node
// Synthetic labelled TEST document; actual Actions/Auth/DB/immutable Storage/OCR adapter.
// Only the external Azure HTTP boundary is doubled. No Azure connection claim.
import {createHash,randomUUID} from 'node:crypto';
import {expect,it,vi} from 'vitest';
const tenant=vi.hoisted(()=>'TEST-ablauf-'+globalThis.crypto.randomUUID());
vi.mock('@/lib/tenant',()=>({KREILE_TENANT_SLUG:tenant}));
import {KREILE_TENANT_SLUG} from '@/lib/tenant';
import {sql,full,withSession} from '../../../e2e/ablauf/replayHarness';
import {customerFixture} from '../../../e2e/ablauf/orderFixture';
import {TEST_PHOTO_BYTES} from '../../../e2e/ablauf/photoFixture';
import {reserveDomainAttachmentAction,finalizeDomainAttachmentAction,analyzeDomainAttachmentAction,getDomainAttachmentOriginalAction} from '@/app/actions/domainAttachments.actions';
import {prepareIntakeFileAction,finishIntakeFileAction,getIntakeCaptureAction} from '@/app/actions/eingang.actions';
import {uploadIntakeOriginal} from '@/modules/eingang/public';
if(!process.env.DATABASE_URL||process.env.DATABASE_URL!==process.env.H18_EXPECTED_DATABASE_URL||new URL(process.env.DATABASE_URL).hostname!=='127.0.0.1'||!KREILE_TENANT_SLUG.startsWith('TEST-ablauf-'))throw Error('S20_DEDICATED_TEST_REPLAY_REQUIRED');

it('records actual OCR provider OK/HTTP failure/timeout and secured original hash, not document/key/content; fresh finish retry never invents another provider attempt',async()=>{
 await sql`INSERT INTO public.company_settings(id,tenant_id,company_name) VALUES(${randomUUID()},${KREILE_TENANT_SLUG},'TEST S20 recognition')`;
 const originalFetch=globalThis.fetch;
 let mode:'ok'|'fehler'|'zeitueberschreitung'='ok',attempts=0;
 vi.stubEnv('AZURE_DOCINTEL_ENDPOINT','https://test-s20-ocr.invalid/');vi.stubEnv('AZURE_DOCINTEL_KEY','TEST_PRIVATE_PROVIDER_KEY');
 const provider=vi.spyOn(globalThis,'fetch').mockImplementation(async(input,init)=>{
  const url=new URL(typeof input==='string'?input:input instanceof URL?input.href:input.url);
  if(url.hostname!=='test-s20-ocr.invalid')return originalFetch(input,init);
  if(init?.method==='POST'){
   attempts++;
   if(mode==='zeitueberschreitung')throw new DOMException('TEST PRIVATE_TIMEOUT Bearer x','TimeoutError');
   if(mode==='fehler')return new Response('TEST PRIVATE_PROVIDER_BODY',{status:503});
   return new Response(null,{status:202,headers:{'operation-location':'https://test-s20-ocr.invalid/documentintelligence/documentModels/prebuilt-layout/analyzeResults/TEST'}});
  }
  return Response.json({status:'succeeded',analyzeResult:{content:'TEST PRIVATE_RECOGNIZED_DOCUMENT'}});
 });
 try{
  for(const expected of ['ok','fehler','zeitueberschreitung'] as const){
   mode=expected;
   const file=new File(['%PDF-1.4\nTEST PRIVATE_DOCUMENT '+randomUUID()],'TEST-S20.pdf',{type:'application/pdf'});
   const sha256=createHash('sha256').update(Buffer.from(await file.arrayBuffer())).digest('hex');
   const input={itemId:randomUUID(),fileId:randomUUID(),name:file.name,mime:file.type,bytes:file.size,sha256};
   const prepared=await withSession(full,()=>prepareIntakeFileAction(input));if(prepared.code!=='OK'||!prepared.upload)throw Error('TEST_REAL_UPLOAD_GRANT_REQUIRED');
   await uploadIntakeOriginal(prepared.upload,file);
   expect(await sql`SELECT id FROM public.technical_protocol WHERE tenant_id=${KREILE_TENANT_SLUG} AND original_ref=${input.fileId}`).toHaveLength(0);
   const before=attempts;
   expect(await withSession(full,()=>finishIntakeFileAction(input.fileId))).toMatchObject({code:'OK',capture:{files:[{id:input.fileId,secured:true}]}});
   expect(attempts).toBe(before+1);
   const entries=await sql`SELECT * FROM public.technical_protocol WHERE tenant_id=${KREILE_TENANT_SLUG} AND dienst='belegerkennung' AND original_ref=${input.fileId}`;
   expect(entries).toHaveLength(1);expect(entries[0]).toMatchObject({user_id:full.actorId,event_type:'external',ergebnis:expected,subject_id:input.itemId,original_sha256:sha256});
   for(const secret of ['PRIVATE_DOCUMENT','PRIVATE_RECOGNIZED','PRIVATE_PROVIDER','Bearer x','PRIVATE_TIMEOUT'])expect(JSON.stringify(entries)).not.toContain(secret);
   expect(await withSession(full,()=>getIntakeCaptureAction(input.itemId))).toMatchObject({code:'OK',capture:{files:[{id:input.fileId,secured:true}]}});
   expect(await withSession(full,()=>finishIntakeFileAction(JSON.parse(JSON.stringify(input.fileId))))).toMatchObject({code:'OK'});
   expect(attempts).toBe(before+1);
   expect(await sql`SELECT id FROM public.technical_protocol WHERE tenant_id=${KREILE_TENANT_SLUG} AND dienst='belegerkennung' AND original_ref=${input.fileId}`).toHaveLength(1);
  }
 }finally{provider.mockRestore();vi.unstubAllEnvs();}
});

it('the existing secured domain attachment/OCR writer reports its own actual original, and missing provider configuration never produces an external success',async()=>{
 const customerId=await customerFixture('TEST S20 existing document');
 const hash=createHash('sha256').update(TEST_PHOTO_BYTES).digest('hex');
 const reserved=await withSession(full,()=>reserveDomainAttachmentAction({targetType:'CUSTOMER',targetId:customerId,clientRequestId:randomUUID(),mimeType:'image/png',fileBytes:TEST_PHOTO_BYTES.length,contentSha256:hash}));
 if(reserved.code!=='OK'||!reserved.data.upload)throw Error('TEST_REAL_DOMAIN_GRANT_REQUIRED');
 const attachmentId=reserved.data.receipt.attachmentId;
 const url=new URL('/storage/v1/object/upload/sign/scans/'+reserved.data.upload.path,process.env.NEXT_PUBLIC_SUPABASE_URL);if(url.hostname!=='127.0.0.1')throw Error('TEST_STORAGE_LOOPBACK_REQUIRED');
 url.searchParams.set('token',reserved.data.upload.token);
 expect((await fetch(url,{method:'PUT',headers:{'content-type':'image/png','x-upsert':'false'},body:new Blob([new Uint8Array(TEST_PHOTO_BYTES).buffer],{type:'image/png'})})).ok).toBe(true);
 const finish={attachmentId,fileBytes:TEST_PHOTO_BYTES.length,contentSha256:hash};
 expect(await withSession(full,()=>finalizeDomainAttachmentAction(finish))).toMatchObject({code:'OK'});
 // The existing download reader accepts secured originals. Read its real grant
 // before the existing OCR writer transitions the row to ocr_review.
 const original=await withSession(full,()=>getDomainAttachmentOriginalAction({attachmentId}));expect(original).toMatchObject({code:'OK'});
 if(original.code!=='OK')throw Error('TEST_REAL_ORIGINAL_READ_REQUIRED');
 const input={attachmentId,targetType:'CUSTOMER' as const,targetId:customerId};
 vi.stubEnv('AZURE_DOCINTEL_ENDPOINT','');vi.stubEnv('AZURE_DOCINTEL_KEY','');
 try{
  expect(await withSession(full,()=>analyzeDomainAttachmentAction(input))).toMatchObject({code:'IN_KLAERUNG'});
  expect(await sql`SELECT id FROM public.technical_protocol WHERE tenant_id=${KREILE_TENANT_SLUG} AND dienst='belegerkennung' AND original_ref=${attachmentId}`).toHaveLength(0);
 }finally{vi.unstubAllEnvs();}
 vi.stubEnv('AZURE_DOCINTEL_ENDPOINT','https://test-s20-domain-ocr.invalid/');vi.stubEnv('AZURE_DOCINTEL_KEY','TEST_PRIVATE_PROVIDER_KEY');
 const originalFetch=globalThis.fetch;let attempts=0;
 const provider=vi.spyOn(globalThis,'fetch').mockImplementation(async(source,init)=>{
  const request=new URL(typeof source==='string'?source:source instanceof URL?source.href:source.url);
  if(request.hostname!=='test-s20-domain-ocr.invalid')return originalFetch(source,init);
  if(init?.method==='POST'){attempts++;return new Response(null,{status:202,headers:{'operation-location':'https://test-s20-domain-ocr.invalid/documentintelligence/documentModels/prebuilt-layout/analyzeResults/TEST'}});}
  return Response.json({status:'succeeded',analyzeResult:{content:'TEST PRIVATE_DOMAIN_DOCUMENT'}});
 });
 try{
  expect(await withSession(full,()=>analyzeDomainAttachmentAction(JSON.parse(JSON.stringify(input))))).toMatchObject({code:'OK'});
  expect(attempts).toBe(1);
  const entries=await sql`SELECT * FROM public.technical_protocol WHERE tenant_id=${KREILE_TENANT_SLUG} AND dienst='belegerkennung' AND original_ref=${attachmentId}`;
  expect(entries).toHaveLength(1);expect(entries[0]).toMatchObject({user_id:full.actorId,subject_id:attachmentId,original_sha256:hash,ergebnis:'ok'});
  expect(JSON.stringify(entries)).not.toContain('PRIVATE_DOMAIN_DOCUMENT');expect(JSON.stringify(entries)).not.toContain('PRIVATE_PROVIDER_KEY');
  expect(await sql`SELECT status,original_hash FROM public.scan_uploads WHERE tenant_id=${KREILE_TENANT_SLUG} AND id=${attachmentId}`).toEqual([{status:'ocr_review',original_hash:hash}]);
  const reread=await fetch(original.data.downloadUrl);expect(reread.ok).toBe(true);
  expect(createHash('sha256').update(Buffer.from(await reread.arrayBuffer())).digest('hex')).toBe(hash);
  // An analyzed original is not silently analyzed again on a fresh command.
  expect(await withSession(full,()=>analyzeDomainAttachmentAction(JSON.parse(JSON.stringify(input))))).toMatchObject({code:'NOT_FOUND'});expect(attempts).toBe(1);
 }finally{provider.mockRestore();vi.unstubAllEnvs();}
});
