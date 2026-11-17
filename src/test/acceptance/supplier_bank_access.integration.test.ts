// @vitest-environment node
// PL17Nov17:07: real actions/Auth/DB/Storage, only external OCR is doubled.
import {createElement} from 'react';
import {createHash,randomUUID} from 'node:crypto';
import {Document,Page,Text,renderToBuffer} from '@react-pdf/renderer';
import {expect,it,vi} from 'vitest';
const tenant=vi.hoisted(()=>'TEST-ablauf-'+globalThis.crypto.randomUUID());
vi.mock('@/lib/tenant',()=>({KREILE_TENANT_SLUG:tenant}));
import {sql,full,withSession,createFixture,nativeFetch} from '../../../e2e/ablauf/replayHarness';
import {createCustomerAction,updateCustomerAction} from '@/app/actions/customers.actions';
import {prepareIntakeFileAction,finishIntakeFileAction,getIncomingInvoiceAction,saveIncomingInvoiceAction,assignIntakeCustomerAction,getIntakeAssignmentAction} from '@/app/actions/eingang.actions';

const replayUrl=process.env.DATABASE_URL;
if(!replayUrl||replayUrl!==process.env.H18_EXPECTED_DATABASE_URL||new URL(replayUrl).hostname!=='127.0.0.1')throw Error('TEST_S21_FINANCIAL_DEDICATED_LOOPBACK_REQUIRED');

it('bookkeeping-only adopts the real supplier invoice IBAN atomically; customer payment changes stay forbidden',async()=>{
 const created=await withSession(full,()=>createCustomerAction({clientEventId:randomUUID(),customerType:'lieferant',companyName:'TEST Invoice bank supplier',country:'DE'}));
 if(created.code!=='OK')throw Error('TEST_BANK_SUPPLIER_CREATE:'+created.code);
 const customerId=created.receipt.customerId,bookkeeping=await createFixture(['buchhaltung']);
 const bytes=Buffer.from(await renderToBuffer(createElement(Document,null,createElement(Page,null,createElement(Text,null,'TEST Lieferantenrechnung 119,00 EUR')))));
 const itemId=randomUUID(),fileId=randomUUID(),sha256=createHash('sha256').update(bytes).digest('hex');
 const grant=await withSession(full,()=>prepareIntakeFileAction({itemId,fileId,name:'TEST-Lieferantenrechnung.pdf',mime:'application/pdf',bytes:bytes.length,sha256,captureOrigin:'dokument'}));
 if(grant.code!=='OK')throw Error('TEST_BANK_ORIGINAL_PREPARE:'+grant.code);
 if(grant.upload){const url=new URL('/storage/v1/object/upload/sign/'+grant.upload.bucket+'/'+grant.upload.path,process.env.NEXT_PUBLIC_SUPABASE_URL);if(url.hostname!=='127.0.0.1')throw Error('TEST_LOOPBACK_ONLY');url.searchParams.set('token',grant.upload.token);expect((await nativeFetch(url,{method:'PUT',headers:{'content-type':'application/pdf','x-upsert':'false'},body:new Uint8Array(bytes)})).ok).toBe(true);}
 const ocrHost=process.env.AZURE_DOCINTEL_ENDPOINT?new URL(process.env.AZURE_DOCINTEL_ENDPOINT).hostname:null;
 const provider=vi.spyOn(globalThis,'fetch').mockImplementation((request,init)=>{
  const url=new URL(typeof request==='string'?request:request instanceof URL?request.href:request.url);
  return ocrHost&&url.hostname===ocrHost?Promise.resolve(new Response('TEST OCR provider unavailable',{status:503})):nativeFetch(request,init);
 });
 const secured=await withSession(full,()=>finishIntakeFileAction(fileId)).finally(()=>provider.mockRestore());
 expect(secured).toMatchObject({code:'OK',capture:{files:expect.arrayContaining([expect.objectContaining({id:fileId,secured:true})])}});
 expect(await sql`SELECT sha256,bytes::int AS bytes FROM public.intake_file WHERE tenant_id=${tenant} AND id=${fileId}::uuid`).toEqual([{sha256,bytes:bytes.length}]);
 const assignment=await withSession(full,()=>getIntakeAssignmentAction({itemId,mode:'normal'}));if(assignment.code!=='OK')throw Error('TEST_BANK_ASSIGN_READ');
 expect(await withSession(full,()=>assignIntakeCustomerAction({itemId,version:assignment.view.version,clientEventId:randomUUID(),customerId,mode:'manual'}))).toMatchObject({code:'OK'});
 const view=await withSession(bookkeeping,()=>getIncomingInvoiceAction({id:itemId}));if(view.code!=='OK')throw Error('TEST_BANK_INVOICE_READ');
 const input={itemId,fileId,version:view.view.item.version,clientKey:randomUUID(),fields:{lieferantId:customerId,nummer:'TEST-BANK-'+itemId,datum:'2026-11-17',netto:'100,00',ust:'19,00',brutto:'119,00',faelligAm:'2026-11-30',iban:'DE02120300000000202051',ibanGeprueft:true},status:'offen' as const,paidDate:null,proofFileId:null,duplicateId:null,duplicateReason:null,unclearReason:null};
 const saved=await withSession(bookkeeping,()=>saveIncomingInvoiceAction(input));
 expect(saved).toMatchObject({code:'OK',replayed:false});if(saved.code!=='OK')throw Error('TEST_BANK_INVOICE_SAVE:'+JSON.stringify(saved));
 expect(await sql`SELECT iban FROM public.customers WHERE tenant_id=${tenant} AND id=${customerId}`).toEqual([{iban:input.fields.iban}]);
 expect(await withSession(bookkeeping,()=>saveIncomingInvoiceAction(JSON.parse(JSON.stringify(input))))).toMatchObject({code:'OK',replayed:true,invoice:{id:saved.invoice.id}});
 expect(await withSession(bookkeeping,()=>getIncomingInvoiceAction({id:itemId}))).toMatchObject({code:'OK',view:{invoice:{id:saved.invoice.id,iban:input.fields.iban},supplier:{iban:input.fields.iban}}});
 expect(await sql`SELECT count(*)::int AS n FROM public.events WHERE tenant_id=${tenant} AND user_id=${bookkeeping.actorId}::uuid AND client_event_id=${input.clientKey}::uuid AND event_type='CUSTOMER_UPDATED_V1'`).toEqual([{n:1}]);
 // Explicit SQL boundary probe: even a delegated server context cannot use
 // the supplier-bank scope to change an unrelated customer field.
 const forged={iban:'DE89370400440532013000',company_name:'TEST forbidden unrelated supplier rename'};
 await sql.begin(async tx=>{
  await tx`SELECT set_config('app.tenant_id',${tenant},true)`;
  const denied=await tx`SELECT result_code FROM private.update_customer_v1(${tenant},${bookkeeping.actorId}::uuid,${randomUUID()}::uuid,${customerId},${createHash('sha256').update(JSON.stringify(forged)).digest('hex')},${sql.json(forged)}::jsonb)`;
  expect(denied).toEqual([{result_code:'FORBIDDEN'}]);
 });
 expect(await sql`SELECT company_name,iban FROM public.customers WHERE tenant_id=${tenant} AND id=${customerId}`).toEqual([{company_name:'TEST Invoice bank supplier',iban:input.fields.iban}]);
 const customer=await withSession(full,()=>createCustomerAction({clientEventId:randomUUID(),customerType:'business',companyName:'TEST Customer stays payment-protected',paymentPreference:'vorkasse',phone:'+49711555012',country:'DE'}));if(customer.code!=='OK')throw Error('TEST_BANK_CUSTOMER_CREATE');
 for(const actor of [bookkeeping,await createFixture(['buchhaltung','kunden'])]){
  expect(await withSession(actor,()=>updateCustomerAction({customerId:customer.receipt.customerId,clientEventId:randomUUID(),paymentPreference:'bar'}))).toMatchObject({code:'FORBIDDEN'});
 }
 expect(await sql`SELECT payment_preference FROM public.customers WHERE tenant_id=${tenant} AND id=${customer.receipt.customerId}`).toEqual([{payment_preference:'vorkasse'}]);
});

it('intake/customer/bookkeeping creates and edits a supplier bank account without acquiring customer payment rights',async()=>{
 const actor=await createFixture(['eingang','kunden','buchhaltung']);
 const input={clientEventId:randomUUID(),customerType:'lieferant' as const,companyName:'TEST Supplier bank form',country:'DE',iban:'DE02120300000000202051'};
 const created=await withSession(actor,()=>createCustomerAction(input));expect(created).toMatchObject({code:'OK'});if(created.code!=='OK')throw Error('TEST_BANK_FORM_CREATE');
 expect(await withSession(actor,()=>createCustomerAction(JSON.parse(JSON.stringify(input))))).toMatchObject({code:'OK',replayed:true});
 const update={customerId:created.receipt.customerId,clientEventId:randomUUID(),iban:'DE89370400440532013000'};
 expect(await withSession(actor,()=>updateCustomerAction(update))).toMatchObject({code:'OK'});
 expect(await withSession(actor,()=>updateCustomerAction(JSON.parse(JSON.stringify(update))))).toMatchObject({code:'OK',replayed:true});
 expect(await sql`SELECT iban FROM public.customers WHERE tenant_id=${tenant} AND id=${created.receipt.customerId}`).toEqual([{iban:update.iban}]);
 expect(await withSession(actor,()=>updateCustomerAction({...update,clientEventId:randomUUID(),paymentTermDays:30}))).toMatchObject({code:'FORBIDDEN'});
});
