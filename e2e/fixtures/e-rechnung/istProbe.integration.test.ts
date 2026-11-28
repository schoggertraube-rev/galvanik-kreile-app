// @vitest-environment node
// S54a one-off observation, not a replacement parser or a format-compliance test.
// Official public samples and isolated TEST data; actions/Auth/Postgres/Storage are real.
import {createHash,randomUUID} from 'node:crypto';
import {readFileSync,writeFileSync} from 'node:fs';
import {afterAll,expect,it,vi} from 'vitest';
const tenant=vi.hoisted(()=>'TEST-ablauf-'+globalThis.crypto.randomUUID());
vi.mock('@/lib/tenant',()=>({KREILE_TENANT_SLUG:tenant}));
import {sql,full,withSession,nativeFetch} from '../../ablauf/replayHarness';
import {readyOrderForInvoice} from '../../ablauf/orderFixture';
import {prepareIntakeFileAction,finishIntakeFileAction,getIncomingInvoiceAction,saveIncomingInvoiceAction,getIntakeCaptureAction,openIntakeOriginalAction} from '@/app/actions/eingang.actions';
import {issueInvoiceAction} from '@/app/actions/invoices.actions';
import {GET as invoicePdf} from '@/app/api/invoices/[invoiceId]/pdf/route';

type Source={file:string;format:string;declaredProfile:string;sourceUrl:string;license:string;sha256:string;bytes:number};
const fixtureRoot='e2e/fixtures/e-rechnung/';
const manifest=JSON.parse(readFileSync(fixtureRoot+'SOURCES.json','utf8')) as {sources:Source[];derivedTestFixtures:Array<{file:string;sourceFile:string;sha256:string;bytes:number}>};
const inputs=manifest.sources.filter(row=>row.file.endsWith('.xml')||row.file.startsWith('TEST_zugferd_')&&row.file.endsWith('.pdf'));
const broken=manifest.derivedTestFixtures.find(row=>row.file==='TEST_xrechnung_broken.xml');
const brokenSource=manifest.sources.find(row=>row.file===broken?.sourceFile);
if(!broken||!brokenSource)throw Error('S54A_NEGATIVE_FIXTURE_PROVENANCE_REQUIRED');
inputs.push({...brokenSource,...broken});
const observations:Record<string,unknown>[]=[];
const sha=(bytes:Uint8Array)=>createHash('sha256').update(bytes).digest('hex');
afterAll(()=>writeFileSync('.git/kreile-s54a-actual-results.json',JSON.stringify({at:new Date().toISOString(),tenant,observations},null,2)+'\n'));

for(const input of inputs)it('S54a actual incoming original: '+input.file,async()=>{
 const observation:Record<string,unknown>={...input,profile:input.declaredProfile,sourceFixture:input.file};observations.push(observation);
 let bytes:Uint8Array=readFileSync(fixtureRoot+input.file);expect(sha(bytes)).toBe(input.sha256);expect(bytes.length).toBe(input.bytes);
 let name=input.file;
 if(input.file.endsWith('.pdf')){
  // Test preparation only. The application's current incoming path receives XML,
  // not a new PDF-container parser. Preserve the exact public embedded bytes.
  const pdfjs=await import('pdfjs-dist/legacy/build/pdf.mjs');
  const task=pdfjs.getDocument({data:new Uint8Array(bytes)});
  try{const doc=await task.promise,attachments=await doc.getAttachments();expect(attachments?.size).toBe(1);
   if(!attachments||attachments.size!==1)throw Error('S54A_ONE_PUBLIC_XML_REQUIRED');
   const [id]=attachments.keys();const embedded=await doc.getAttachmentContent(id);if(!embedded)throw Error('S54A_EMBEDDED_BYTES_MISSING');
   bytes=embedded;name=input.file.replace(/\.pdf$/,'.xml');
  }finally{await task.destroy();}
  observation.limit='Exact embedded XML tested directly; no hybrid PDF-container recognition claim.';
 }
 const originalSha256=sha(bytes);observation.testedXmlSha256=originalSha256;observation.testedXmlBytes=bytes.length;
 const itemId=randomUUID(),fileId=randomUUID();Object.assign(observation,{itemId,fileId});
 const request={itemId,fileId,name,mime:'application/xml',bytes:bytes.length,sha256:originalSha256,captureOrigin:'dokument' as const};
 const grant=await withSession(full,()=>prepareIntakeFileAction(request));observation.prepareCode=grant.code;
 expect(grant.code).toBe('OK');if(grant.code!=='OK')throw Error('S54A_PREPARE:'+grant.code);
 if(grant.upload){
  const url=new URL('/storage/v1/object/upload/sign/'+grant.upload.bucket+'/'+grant.upload.path,process.env.NEXT_PUBLIC_SUPABASE_URL);
  if(url.hostname!=='127.0.0.1')throw Error('S54A_STORAGE_LOOPBACK_REQUIRED');url.searchParams.set('token',grant.upload.token);
  const upload=await nativeFetch(url,{method:'PUT',headers:{'content-type':'application/xml','x-upsert':'false'},body:new Uint8Array(bytes)});
  observation.uploadStatus=upload.status;expect(upload.ok).toBe(true);
 }
 const finished=await withSession(full,()=>finishIntakeFileAction(fileId),true);observation.finishCode=finished.code;
 expect(finished.code).toBe('OK');if(finished.code!=='OK')throw Error('S54A_FINISH:'+finished.code);
 const reread=await withSession(full,()=>getIntakeCaptureAction(itemId));expect(reread.code).toBe('OK');
 if(reread.code!=='OK')throw Error('S54A_REREAD:'+reread.code);
 const file=reread.capture.files.find(value=>value.id===fileId);observation.file=file;observation.recognition=reread.capture.recognition;
 expect(file?.secured).toBe(true);
 const invoice=await withSession(full,()=>getIncomingInvoiceAction({id:itemId}));observation.readCode=invoice.code;
 expect(invoice.code).toBe('OK');if(invoice.code!=='OK')throw Error('S54A_INVOICE_READ:'+invoice.code);
 observation.fields=invoice.view.fields;observation.sender=invoice.view.item.sender;observation.suggestions=reread.capture.suggestions;
 expect(invoice.view.originals).toEqual(expect.arrayContaining([expect.objectContaining({id:fileId,sha256:originalSha256})]));
 const original=await withSession(full,()=>openIntakeOriginalAction({fileId,clientEventId:randomUUID()}));observation.openCode=original.code;
 if(original.code==='OK'){
  if(!original.original.downloadUrl)throw Error('S54A_ORIGINAL_DOWNLOAD_UNAVAILABLE');
  const url=new URL(original.original.downloadUrl);if(url.hostname!=='127.0.0.1')throw Error('S54A_DOWNLOAD_LOOPBACK_REQUIRED');
  const response=await nativeFetch(url);expect(response.ok).toBe(true);expect(sha(new Uint8Array(await response.arrayBuffer()))).toBe(originalSha256);observation.originalDownloadHashVerified=true;
 }
 // Use the existing manual "unclear" path, retaining recognized values verbatim.
 // No supplier or missing field is invented to improve the observation.
 const save={itemId,fileId,version:invoice.view.item.version,clientKey:randomUUID(),fields:invoice.view.fields,status:'unklar' as const,paidDate:null,proofFileId:null,duplicateId:null,duplicateReason:null,unclearReason:'TEST S54a Ist-Probe: offizielle Beispieldatei, Felder manuell prüfen'};
 const saved=await withSession(full,()=>saveIncomingInvoiceAction(save));observation.manualSaveCode=saved.code;
 if(saved.code!=='OK'){observation.manualSaveResult=saved;throw Error('S54A_MANUAL_SAVE:'+saved.code);}
 const retry=await withSession(full,()=>saveIncomingInvoiceAction(JSON.parse(JSON.stringify(save))));
 expect(retry).toMatchObject({code:'OK',replayed:true,invoice:{id:saved.invoice.id}});observation.manualRetry=true;
 const final=await withSession(full,()=>getIncomingInvoiceAction({id:itemId}));expect(final).toMatchObject({code:'OK',view:{invoice:{id:saved.invoice.id},originals:expect.arrayContaining([expect.objectContaining({id:fileId,sha256:originalSha256})])}});
 observation.manualReadback=true;
});

it('S54a actual outgoing TEST invoice and authenticated immutable PDF',async()=>{
 const observation:Record<string,unknown>={case:'E4'};observations.push(observation);
 const prepared=await readyOrderForInvoice('TEST S54a Pflichtangaben');
 const input={orderId:prepared.orderId,expectedVersion:prepared.version,clientEventId:randomUUID()};
 const issued=await withSession(full,()=>issueInvoiceAction(input));observation.issueCode=issued.code;expect(issued.code).toBe('OK');if(issued.code!=='OK')throw Error('S54A_ISSUE:'+issued.code);
 observation.receipt=issued.receipt;
 expect(await withSession(full,()=>issueInvoiceAction(JSON.parse(JSON.stringify(input))))).toMatchObject({code:'OK',replayed:true,receipt:{invoiceId:issued.receipt.invoiceId}});
 const response=await withSession(full,()=>invoicePdf(new Request('http://127.0.0.1/api/invoices/'+issued.receipt.invoiceId+'/pdf'),{params:Promise.resolve({invoiceId:issued.receipt.invoiceId})}));
 expect(response.status).toBe(200);const bytes=new Uint8Array(await response.arrayBuffer());expect(sha(bytes)).toBe(issued.receipt.pdfSha256);
 observation.pdfSha256=sha(bytes);observation.pdfBytes=bytes.length;
 writeFileSync('.git/kreile-s54a-actual-outgoing.pdf',bytes);
 const rows=await sql`SELECT snapshot FROM public.invoices WHERE id=${issued.receipt.invoiceId}::uuid AND tenant_id=${tenant}`;
 expect(rows).toHaveLength(1);observation.snapshot=rows[0].snapshot;
});
