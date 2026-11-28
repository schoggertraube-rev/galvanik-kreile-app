// @vitest-environment node
// Synthetic labelled TEST document; actual Actions/Auth/DB/immutable Storage/OCR adapter.
// Only the external Azure HTTP boundary is doubled. No Azure connection claim.
import {createHash,randomUUID} from 'node:crypto';
import {expect,it,vi} from 'vitest';
const tenant=vi.hoisted(()=>'TEST-ablauf-'+globalThis.crypto.randomUUID());
vi.mock('@/lib/tenant',()=>({KREILE_TENANT_SLUG:tenant}));
import {KREILE_TENANT_SLUG} from '@/lib/tenant';
import {sql,full,withSession} from '../../../e2e/ablauf/replayHarness';
import {prepareIntakeFileAction,finishIntakeFileAction,getIntakeCaptureAction} from '@/app/actions/eingang.actions';
import {uploadIntakeOriginal} from '@/modules/eingang/public';
if(!process.env.DATABASE_URL||process.env.DATABASE_URL!==process.env.H18_EXPECTED_DATABASE_URL||new URL(process.env.DATABASE_URL).hostname!=='127.0.0.1'||!KREILE_TENANT_SLUG.startsWith('TEST-ablauf-'))throw Error('S20_DEDICATED_TEST_REPLAY_REQUIRED');

it('records actual OCR provider OK/HTTP failure/timeout and secured original hash, not document/key/content; fresh finish retry never invents another provider attempt',async()=>{
 await sql`INSERT INTO public.tenant_features (tenant,feature_id,enabled) VALUES (${KREILE_TENANT_SLUG},'E04',true)`;
 await sql`INSERT INTO public.company_settings(id,tenant_id,company_name,material_aufschlag_prozent,lager_regelversion)
  VALUES(${randomUUID()},${KREILE_TENANT_SLUG},'TEST S20 recognition',0,'TEST-S20')`;
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
   expect(await withSession(full,()=>finishIntakeFileAction(input.fileId),true)).toMatchObject({code:'OK',capture:{files:[{id:input.fileId,secured:true,status:'wartet'}]}});
   expect(attempts).toBe(before+1);
   const entries=await sql`SELECT * FROM public.technical_protocol WHERE tenant_id=${KREILE_TENANT_SLUG} AND dienst='belegerkennung' AND original_ref=${input.fileId}`;
   expect(entries).toHaveLength(1);expect(entries[0]).toMatchObject({user_id:full.actorId,event_type:'external',ergebnis:expected,subject_id:input.itemId,original_sha256:sha256});
   for(const secret of ['PRIVATE_DOCUMENT','PRIVATE_RECOGNIZED','PRIVATE_PROVIDER','Bearer x','PRIVATE_TIMEOUT'])expect(JSON.stringify(entries)).not.toContain(secret);
   expect(await withSession(full,()=>getIntakeCaptureAction(input.itemId))).toMatchObject({code:'OK',capture:{files:[{id:input.fileId,secured:true}]}});
   expect(await withSession(full,()=>finishIntakeFileAction(JSON.parse(JSON.stringify(input.fileId))))).toMatchObject({code:'OK'});
   expect(attempts).toBe(before+1);
   expect(await sql`SELECT id FROM public.technical_protocol WHERE tenant_id=${KREILE_TENANT_SLUG} AND dienst='belegerkennung' AND original_ref=${input.fileId}`).toHaveLength(1);
  }
  vi.stubEnv('AZURE_DOCINTEL_ENDPOINT','');
  const unconfigured=new File(['%PDF-1.4\nTEST without OCR configuration '+randomUUID()],'TEST-OCR-offen.pdf',{type:'application/pdf'});
  const sha256=createHash('sha256').update(Buffer.from(await unconfigured.arrayBuffer())).digest('hex');
  const input={itemId:randomUUID(),fileId:randomUUID(),name:unconfigured.name,mime:unconfigured.type,bytes:unconfigured.size,sha256};
  const prepared=await withSession(full,()=>prepareIntakeFileAction(input));
  if(prepared.code!=='OK'||!prepared.upload)throw Error('TEST_UNCONFIGURED_OCR_UPLOAD_REQUIRED');
  expect((await uploadIntakeOriginal(prepared.upload,unconfigured)).ok).toBe(true);
  const attempted=attempts;
  expect(await withSession(full,()=>finishIntakeFileAction(input.fileId),true)).toMatchObject({code:'OK',capture:{files:[{id:input.fileId,secured:true}]}});
  expect(await withSession(full,()=>getIntakeCaptureAction(input.itemId))).toMatchObject({code:'OK',capture:{files:[{id:input.fileId,secured:true}]}});
  expect(attempts).toBe(attempted);
  expect(await sql`SELECT id FROM public.technical_protocol WHERE tenant_id=${KREILE_TENANT_SLUG}
    AND dienst='belegerkennung' AND original_ref=${input.fileId} AND event_type='external' AND ergebnis='ok'`).toEqual([]);
 }finally{provider.mockRestore();vi.unstubAllEnvs();}
});
