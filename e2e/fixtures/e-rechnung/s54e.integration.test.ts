// @vitest-environment node
// Actual incoming Actions/Auth/DB/Storage. Only the external Azure boundary is doubled.
import {createHash,randomUUID} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {expect,it,vi} from 'vitest';
const tenant=vi.hoisted(()=>'TEST-ablauf-'+globalThis.crypto.randomUUID());
const azure=vi.hoisted(()=>vi.fn(async()=>({code:'IN_KLAERUNG' as const,message:'TEST external Azure boundary unavailable'})));
vi.mock('@/lib/tenant',()=>({KREILE_TENANT_SLUG:tenant}));
vi.mock('@/lib/server/azureDocumentIntelligence',async importOriginal=>({...await importOriginal<object>(),analyzeWithAzureDocumentIntelligence:azure}));
import {sql,full,withSession,nativeFetch,createFixture} from '../../ablauf/replayHarness';
import {prepareIntakeFileAction,finishIntakeFileAction,getIncomingInvoiceAction,getIntakeCaptureAction,openIntakeOriginalAction,saveIncomingInvoiceAction} from '@/app/actions/eingang.actions';
import {createCustomerAction} from '@/app/actions/customers.actions';

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

it('E1 the official CII source persists its real supplier and tax suggestions through the existing intake reader',async()=>{
 const input=await receive('TEST_xrechnung_cii.xml','application/xml',readFileSync(root+'TEST_xrechnung_cii.xml'));
 expect(input.reread).toMatchObject({code:'OK',capture:{suggestions:expect.arrayContaining([
  expect.objectContaining({field:'rechnung.absender',value:{name:'[Seller name]',ustId:'DE 123456789'}}),
  expect.objectContaining({field:'rechnung.steuersaetze',value:[{satz:'7.00',netto:'314.86',ust:'22.04'}]}),
 ])}});
 expect(await withSession(full,()=>getIncomingInvoiceAction({id:input.itemId}))).toMatchObject({code:'OK',view:{supplierPrefill:{name:'[Seller name]',vatId:'DE123456789'},fields:{netto:'314.86',ust:'22.04',brutto:'336.90'},taxRateWarning:null}});
});

it('E3 the unstructured official PDF retains the existing external-adapter/manual path',async()=>{
 azure.mockClear();
 const input=await receive('TEST_invoice_plain.pdf','application/pdf',readFileSync(root+'TEST_invoice_plain.pdf'));
 expect(azure).toHaveBeenCalledTimes(1);
 const read=await withSession(full,()=>getIncomingInvoiceAction({id:input.itemId}));expect(read).toMatchObject({code:'OK',view:{invoice:null,originals:expect.arrayContaining([expect.objectContaining({id:input.fileId})])}});
});

/** Explicit synthetic TEST containers; the six official PDF fixtures stay byte-identical. */
function embeddedXmlPdf(attachments:Array<{name:string;xml:Uint8Array}>){
 const names=attachments.map((value,index)=>'('+value.name+') '+(5+index*2)+' 0 R').join(' ');
 const objects=[Buffer.from('<< /Type /Catalog /Pages 2 0 R /Names << /EmbeddedFiles << /Names ['+names+'] >> >> >>'),
  Buffer.from('<< /Type /Pages /Kids [3 0 R] /Count 1 >>'),
  Buffer.from('<< /Type /Page /Parent 2 0 R /MediaBox [0 0 100 100] /Resources << >> /Contents 4 0 R >>'),
  Buffer.from('<< /Length 0 >>\nstream\n\nendstream')];
 for(const [index,{name,xml}] of attachments.entries())objects.push(
  Buffer.from('<< /Type /Filespec /F ('+name+') /EF << /F '+(6+index*2)+' 0 R >> >>'),
  Buffer.concat([Buffer.from('<< /Type /EmbeddedFile /Length '+xml.length+' >>\nstream\n'),xml,Buffer.from('\nendstream')]));
 const chunks=[Buffer.from('%PDF-1.7\n')],offsets:number[]=[];let length=chunks[0].length;
 for(const [index,object] of objects.entries()){
  offsets.push(length);const chunk=Buffer.concat([Buffer.from((index+1)+' 0 obj\n'),object,Buffer.from('\nendobj\n')]);chunks.push(chunk);length+=chunk.length;
 }
 const size=objects.length+1;
 chunks.push(Buffer.from('xref\n0 '+size+'\n0000000000 65535 f \n'+offsets.map(value=>String(value).padStart(10,'0')+' 00000 n \n').join('')+'trailer\n<< /Size '+size+' /Root 1 0 R >>\nstartxref\n'+length+'\n%%EOF\n'));
 return Buffer.concat(chunks);
}
it('E7 a synthetic corrupt-XML PDF preserves its original and the existing manual fallback',async()=>{
 azure.mockClear();
 const input=await receive('TEST_broken_embedded_invoice.pdf','application/pdf',embeddedXmlPdf([{name:'factur-x.xml',xml:Buffer.from('<Invoice>')} ]));
 expect(azure).toHaveBeenCalledTimes(1);
 const read=await withSession(full,()=>getIncomingInvoiceAction({id:input.itemId}));expect(read).toMatchObject({code:'OK',view:{invoice:null,fileId:input.fileId,fields:{nummer:'',datum:''}}});
});

it('PL09:21 PDF XML originals deduplicate identical bytes but never choose among different valid invoices',async()=>{
 const original=readFileSync(root+'TEST_xrechnung_ubl.xml');
 azure.mockClear();
 const duplicate=await receive('TEST_identical_embedded_xml.pdf','application/pdf',embeddedXmlPdf([{name:'FACTUR-X.XML',xml:original},{name:'xrechnung.xml',xml:original}]));
 expect(azure).not.toHaveBeenCalled();
 expect(await withSession(full,()=>getIncomingInvoiceAction({id:duplicate.itemId}))).toMatchObject({code:'OK',view:{fields:{nummer:'123456XX'}}});
 const different=Buffer.from(original.toString('utf8').replace('<cbc:ID>123456XX</cbc:ID>','<cbc:ID>TEST-OTHER-INVOICE</cbc:ID>'));
 const multiple=await receive('TEST_different_embedded_xml.pdf','application/pdf',embeddedXmlPdf([{name:'factur-x.xml',xml:original},{name:'xrechnung.xml',xml:different}]));
 expect(azure).toHaveBeenCalledTimes(1);
 expect(await withSession(full,()=>getIncomingInvoiceAction({id:multiple.itemId}))).toMatchObject({code:'OK',view:{fields:{nummer:''},invoice:null}});
});

it('E4 exact normalized VAT proposes an existing supplier read-only; the real save links it once',async()=>{
 const creator=await createFixture(['eingang','kunden']);
 const supplier=await withSession(creator,()=>createCustomerAction({clientEventId:randomUUID(),customerType:'lieferant',companyName:'TEST S54e existing VAT supplier',vatId:'DE123456789',country:'DE'}));
 expect(supplier.code).toBe('OK');if(supplier.code!=='OK')throw Error('TEST_SUPPLIER_CREATE:'+supplier.code);
 const input=await receive('TEST_xrechnung_ubl.xml','application/xml',readFileSync(root+'TEST_xrechnung_ubl.xml'));
 const bookkeeping=await createFixture(['buchhaltung']),reader=()=>withSession(bookkeeping,()=>getIncomingInvoiceAction({id:input.itemId}));
 const read=await reader();expect(read).toMatchObject({code:'OK',view:{invoice:null,supplier:{id:supplier.receipt.customerId},fields:{lieferantId:supplier.receipt.customerId},supplierPrefill:{name:'[Seller name]',vatId:'DE123456789'}}});
 if(read.code!=='OK')throw Error('TEST_INVOICE_READ:'+read.code);
 expect(await sql`SELECT kunde_id FROM public.intake_item WHERE tenant_id=${tenant} AND id=${input.itemId}::uuid`).toEqual([{kunde_id:null}]);
 expect(await sql`SELECT count(*)::int AS n FROM public.supplier_invoice WHERE tenant_id=${tenant} AND item_id=${input.itemId}::uuid`).toEqual([{n:0}]);
 const save={itemId:input.itemId,fileId:input.fileId,version:read.view.item.version,clientKey:randomUUID(),fields:{...read.view.fields,faelligAm:'2026-12-01',iban:''},status:'offen' as const,paidDate:null,proofFileId:null,duplicateId:null,duplicateReason:null,unclearReason:null};
 const saved=await withSession(bookkeeping,()=>saveIncomingInvoiceAction(save));expect(saved.code).toBe('OK');if(saved.code!=='OK')throw Error('TEST_INVOICE_SAVE:'+JSON.stringify(saved));
 expect(await withSession(bookkeeping,()=>saveIncomingInvoiceAction(JSON.parse(JSON.stringify(save))))).toMatchObject({code:'OK',replayed:true,invoice:{id:saved.invoice.id}});
 expect(await reader()).toMatchObject({code:'OK',view:{invoice:{id:saved.invoice.id,lieferant_id:supplier.receipt.customerId,ust_saetze:[{satz:'7.00',netto:'314.86',ust:'22.04'}]},taxRateWarning:null}});
 expect(await sql`SELECT kunde_id FROM public.intake_item WHERE tenant_id=${tenant} AND id=${input.itemId}::uuid`).toEqual([{kunde_id:supplier.receipt.customerId}]);
 expect(await withSession(await createFixture(['eingang']),()=>getIncomingInvoiceAction({id:input.itemId}))).toMatchObject({code:'FORBIDDEN'});
});

it('E6 inconsistent TEST subtotals are visible, retain the checked total and write one amount-free technical record',async()=>{
 const supplier=await withSession(await createFixture(['eingang','kunden']),()=>createCustomerAction({clientEventId:randomUUID(),customerType:'lieferant',companyName:'TEST S54e tax mismatch supplier',vatId:'DE987654321',country:'DE'}));
 expect(supplier.code).toBe('OK');
 const xml=readFileSync(root+'TEST_xrechnung_ubl.xml','utf8').replace('DE 123456789','DE 987654321').replace('<cbc:ID>123456XX</cbc:ID>','<cbc:ID>TEST-E6-'+randomUUID()+'</cbc:ID>')
  .replace(/(<cac:TaxSubtotal>[\s\S]*?<cbc:TaxAmount[^>]*>)22\.04(<\/cbc:TaxAmount>)/u,(_match,before,after)=>before+'19.00'+after);
 const input=await receive('TEST_synthetic_mismatched_tax.xml','application/xml',new TextEncoder().encode(xml));
 const read=await withSession(full,()=>getIncomingInvoiceAction({id:input.itemId}));
 expect(read).toMatchObject({code:'OK',view:{taxRateWarning:'Steuersätze passen nicht zur Gesamt-USt · prüf die Rechnung',fields:{ust:'22.04'}}});if(read.code!=='OK')throw Error('TEST_E6_READ');
 const save={itemId:input.itemId,fileId:input.fileId,version:read.view.item.version,clientKey:randomUUID(),fields:{...read.view.fields,faelligAm:'2026-12-01',iban:''},status:'offen' as const,paidDate:null,proofFileId:null,duplicateId:null,duplicateReason:null,unclearReason:null};
 const saved=await withSession(full,()=>saveIncomingInvoiceAction(save));expect(saved).toMatchObject({code:'OK',replayed:false,invoice:{ust:'22.04',ust_saetze:null}});if(saved.code!=='OK')throw Error('TEST_E6_SAVE');
 expect(await withSession(full,()=>saveIncomingInvoiceAction(JSON.parse(JSON.stringify(save))))).toMatchObject({code:'OK',replayed:true,invoice:{id:saved.invoice.id,ust_saetze:null}});
 expect(await sql`SELECT ust::text,ust_saetze FROM public.supplier_invoice WHERE tenant_id=${tenant} AND id=${saved.invoice.id}::uuid`).toEqual([{ust:'22.04',ust_saetze:null}]);
 const logs=await sql`SELECT * FROM public.technical_protocol WHERE tenant_id=${tenant} AND command='INCOMING_INVOICE_TAX_BREAKDOWN_MISMATCH'`;
 expect(logs).toHaveLength(1);expect(logs[0].user_id).toBe(full.actorId);
 expect(JSON.stringify(logs)).not.toContain('314.86');expect(JSON.stringify(logs)).not.toContain('336.90');
 expect(await withSession(full,()=>getIncomingInvoiceAction({id:input.itemId}))).toMatchObject({code:'OK',view:{invoice:{id:saved.invoice.id,ust_saetze:null},taxRateWarning:'Steuersätze passen nicht zur Gesamt-USt · prüf die Rechnung'}});
});

it('E5 zero, one and multiple exact supplier names preserve the actual prefill and never choose an arbitrary supplier',async()=>{
 const name='TEST S54e A & B '+randomUUID(),xml=readFileSync(root+'TEST_xrechnung_ubl.xml','utf8').replace('[Seller name]',name.replace(/&/gu,'&amp;')).replace(/<cac:PartyTaxScheme>[\s\S]*?<\/cac:PartyTaxScheme>/gu,'');
 const input=await receive('TEST_synthetic_supplier_name.xml','application/xml',new TextEncoder().encode(xml));
 const reader=()=>withSession(full,()=>getIncomingInvoiceAction({id:input.itemId}));
 expect(await reader()).toMatchObject({code:'OK',view:{invoice:null,supplier:null,fields:{lieferantId:''},supplierPrefill:{name}}});
 const first=await withSession(full,()=>createCustomerAction({clientEventId:randomUUID(),customerType:'lieferant',companyName:name,country:'DE'}));expect(first.code).toBe('OK');if(first.code!=='OK')throw Error('TEST_FIRST_SUPPLIER_CREATE');
 expect(await reader()).toMatchObject({code:'OK',view:{supplier:{id:first.receipt.customerId}}});
 const second=await withSession(full,()=>createCustomerAction({clientEventId:randomUUID(),customerType:'lieferant',companyName:name,country:'DE'}));expect(second.code).toBe('OK');
 const multiple=await reader();expect(multiple).toMatchObject({code:'OK',view:{supplier:null,fields:{lieferantId:''},supplierPrefill:{name}}});
 if(multiple.code==='OK')expect(multiple.view.supplierPrefill).not.toHaveProperty('vatId');
 expect(await sql`SELECT kunde_id FROM public.intake_item WHERE tenant_id=${tenant} AND id=${input.itemId}::uuid`).toEqual([{kunde_id:null}]);
});
