// @vitest-environment node
// Actual incoming Actions/Auth/DB/Storage. Only the external Azure boundary is doubled.
import {createHash,randomUUID} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {expect,it,vi} from 'vitest';
const tenant=vi.hoisted(()=>'TEST-ablauf-'+globalThis.crypto.randomUUID());
const azure=vi.hoisted(()=>vi.fn(async()=>({code:'IN_KLAERUNG' as const,message:'TEST external Azure boundary unavailable'})));
vi.mock('@/lib/tenant',()=>({KREILE_TENANT_SLUG:tenant}));
vi.mock('@/lib/server/azureDocumentIntelligence',async importOriginal=>({...await importOriginal<object>(),analyzeWithAzureDocumentIntelligence:azure}));
import {sql,full,withSession,nativeFetch} from '../../ablauf/replayHarness';
import {prepareIntakeFileAction,finishIntakeFileAction,getIncomingInvoiceAction,getIntakeCaptureAction,openIntakeOriginalAction} from '@/app/actions/eingang.actions';

const root='e2e/fixtures/e-rechnung/';
const hash=(bytes:Uint8Array)=>createHash('sha256').update(bytes).digest('hex');
async function receive(name:string,mime:string,bytes:Uint8Array){
 const itemId=randomUUID(),fileId=randomUUID(),sha256=hash(bytes);
 const grant=await withSession(full,()=>prepareIntakeFileAction({itemId,fileId,name,mime,bytes:bytes.length,sha256,captureOrigin:'dokument'}));
 expect(grant.code).toBe('OK');if(grant.code!=='OK')throw Error('TEST_PREPARE:'+grant.code);
 if(grant.upload){
  const url=new URL('/storage/v1/object/upload/sign/'+grant.upload.bucket+'/'+grant.upload.path,process.env.NEXT_PUBLIC_SUPABASE_URL);
  expect(url.hostname).toBe('127.0.0.1');url.searchParams.set('token',grant.upload.token);
  const upload=await nativeFetch(url,{method:'PUT',headers:{'content-type':mime,'x-upsert':'false'},body:new Uint8Array(bytes)});expect(upload.ok).toBe(true);
 }
 const finish=await withSession(full,()=>finishIntakeFileAction(fileId));expect(finish.code).toBe('OK');
 const reread=await withSession(full,()=>getIntakeCaptureAction(itemId));expect(reread).toMatchObject({code:'OK',capture:{files:expect.arrayContaining([expect.objectContaining({id:fileId,secured:true})])}});
 const original=await withSession(full,()=>openIntakeOriginalAction({fileId,clientEventId:randomUUID()}));expect(original.code).toBe('OK');
 if(original.code!=='OK'||!original.original.downloadUrl)throw Error('TEST_ORIGINAL_MISSING');
 const url=new URL(original.original.downloadUrl);expect(url.hostname).toBe('127.0.0.1');
 expect(hash(new Uint8Array(await (await nativeFetch(url)).arrayBuffer()))).toBe(sha256);
 const retry=await withSession(full,()=>finishIntakeFileAction(fileId));expect(retry.code).toBe('OK');
 const events=await sql`SELECT count(*)::int AS n FROM public.intake_event WHERE tenant_id=${tenant} AND item_id=${itemId}::uuid AND art='erkannt'`;
 expect(events[0].n).toBe(1);
 return {itemId,fileId,reread};
}

for(const profile of ['minimum','basic_wl','basic','en16931','extended','xrechnung'])it('E2 actual '+profile+' PDF original is recognized without Azure and remains byte-identical on retry',async()=>{
 azure.mockClear();
 const name='TEST_zugferd_'+profile+'.pdf',input=await receive(name,'application/pdf',readFileSync(root+name));
 expect(azure).not.toHaveBeenCalled();
 expect(input.reread).toMatchObject({code:'OK',capture:{suggestions:expect.arrayContaining([expect.objectContaining({field:'rechnung.nummer'}),expect.objectContaining({field:'rechnung.datum'})])}});
 const invoice=await withSession(full,()=>getIncomingInvoiceAction({id:input.itemId}));
 expect(invoice.code).toBe('OK');if(invoice.code!=='OK')throw Error('TEST_INVOICE_READ:'+invoice.code);
 expect(invoice.view.fields.nummer).not.toBe('');expect(invoice.view.fields.datum).not.toBe('');
 if(profile==='minimum'&&input.reread.code==='OK'){
  const suggestions=input.reread.capture.suggestions;expect(suggestions).toBeDefined();if(!suggestions)throw Error('TEST_SUGGESTION_SOURCE_MISSING');
  expect(suggestions.some(value=>value.field==='rechnung.steuersaetze')).toBe(false);
 }
});

it('E3 the unstructured official PDF retains the existing external-adapter/manual path',async()=>{
 azure.mockClear();
 const input=await receive('TEST_invoice_plain.pdf','application/pdf',readFileSync(root+'TEST_invoice_plain.pdf'));
 expect(azure).toHaveBeenCalledTimes(1);
 const read=await withSession(full,()=>getIncomingInvoiceAction({id:input.itemId}));expect(read).toMatchObject({code:'OK',view:{invoice:null,originals:expect.arrayContaining([expect.objectContaining({id:input.fileId})])}});
});

/** Explicit synthetic TEST container: valid PDF, deliberately malformed embedded XML. */
function brokenEmbeddedXmlPdf(){
 const xml=Buffer.from('<Invoice>','utf8');
 const objects=[Buffer.from('<< /Type /Catalog /Pages 2 0 R /Names << /EmbeddedFiles << /Names [(factur-x.xml) 5 0 R] >> >> >>'),
  Buffer.from('<< /Type /Pages /Kids [3 0 R] /Count 1 >>'),
  Buffer.from('<< /Type /Page /Parent 2 0 R /MediaBox [0 0 100 100] /Resources << >> /Contents 4 0 R >>'),
  Buffer.from('<< /Length 0 >>\nstream\n\nendstream'),
  Buffer.from('<< /Type /Filespec /F (factur-x.xml) /EF << /F 6 0 R >> >>'),
  Buffer.concat([Buffer.from('<< /Type /EmbeddedFile /Length '+xml.length+' >>\nstream\n'),xml,Buffer.from('\nendstream')])];
 const chunks=[Buffer.from('%PDF-1.7\n')],offsets:number[]=[];let length=chunks[0].length;
 for(const [index,object] of objects.entries()){
  offsets.push(length);const chunk=Buffer.concat([Buffer.from((index+1)+' 0 obj\n'),object,Buffer.from('\nendobj\n')]);chunks.push(chunk);length+=chunk.length;
 }
 chunks.push(Buffer.from('xref\n0 7\n0000000000 65535 f \n'+offsets.map(value=>String(value).padStart(10,'0')+' 00000 n \n').join('')+'trailer\n<< /Size 7 /Root 1 0 R >>\nstartxref\n'+length+'\n%%EOF\n'));
 return Buffer.concat(chunks);
}
it('E7 a synthetic corrupt-XML PDF preserves its original and the existing manual fallback',async()=>{
 azure.mockClear();
 const input=await receive('TEST_broken_embedded_invoice.pdf','application/pdf',brokenEmbeddedXmlPdf());
 expect(azure).toHaveBeenCalledTimes(1);
 const read=await withSession(full,()=>getIncomingInvoiceAction({id:input.itemId}));expect(read).toMatchObject({code:'OK',view:{invoice:null,fileId:input.fileId,fields:{nummer:'',datum:''}}});
});
