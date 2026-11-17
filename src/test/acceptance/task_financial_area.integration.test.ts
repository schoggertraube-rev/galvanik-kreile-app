// @vitest-environment node
// K3/K6: real original, signed actors, task writer and invoice composition.
import {createElement} from 'react';
import {createHash,randomUUID} from 'node:crypto';
import {Document,Page,Text,renderToBuffer} from '@react-pdf/renderer';
import {expect,it,vi} from 'vitest';
const tenant=vi.hoisted(()=>'TEST-ablauf-'+globalThis.crypto.randomUUID());
vi.mock('@/lib/tenant',()=>({KREILE_TENANT_SLUG:tenant}));
import {sql,full,withSession,createFixture,nativeFetch} from '../../../e2e/ablauf/replayHarness';
import {createCustomerAction,saveCustomerAgreementAction} from '@/app/actions/customers.actions';
import {prepareIntakeFileAction,finishIntakeFileAction,getIncomingInvoiceAction,saveIncomingInvoiceAction,clarifyIncomingInvoiceAction,getIntakeTaskAction,completeIntakeTaskAction,getIntakeAssignmentAction,assignIntakeCustomerAction} from '@/app/actions/eingang.actions';
const replayUrl=process.env.DATABASE_URL;
if(!replayUrl||replayUrl!==process.env.H18_EXPECTED_DATABASE_URL||new URL(replayUrl).hostname!=='127.0.0.1')throw Error('TEST_TASK_FINANCE_LOOPBACK_REQUIRED');

it('K1 payments-only writes and rereads the original agreement; prices-only stays forbidden',async()=>{
 const created=await withSession(full,()=>createCustomerAction({clientEventId:randomUUID(),customerType:'business',companyName:'TEST K1 payment agreement',country:'DE',phone:'+49711555041'}));
 if(created.code!=='OK')throw Error('TEST_K1_CUSTOMER:'+JSON.stringify(created));
 const payments=await createFixture(['zahlungen']),prices=await createFixture(['preise']);
 const input={clientKey:randomUUID(),customerId:created.receipt.customerId,type:'zahlungsziel' as const,targetDays:14,reason:'TEST K1 vereinbart'};
 expect(await withSession(prices,()=>saveCustomerAgreementAction(input))).toMatchObject({code:'FORBIDDEN'});
 expect(await withSession(payments,()=>saveCustomerAgreementAction(input))).toMatchObject({code:'OK',replayed:false,agreement:{customerId:input.customerId,targetDays:14}});
 expect(await withSession(payments,()=>saveCustomerAgreementAction(JSON.parse(JSON.stringify(input))))).toMatchObject({code:'OK',replayed:true});
 expect(await sql`SELECT ziel_tage,created_by::text FROM public.customer_agreements WHERE tenant_id=${tenant} AND customer_id=${input.customerId} AND client_key=${input.clientKey}::uuid`).toEqual([{ziel_tage:14,created_by:payments.actorId}]);
});

it.each([[true,true],[false,false],[true,false]] as const)('task recipient completes its own area; missing supplier=%s; already done=%s',async(missingSupplier,supplierDone)=>{
 const bookkeeping=await createFixture(['buchhaltung']),incoming=await createFixture(['eingang']),denied=await createFixture(['auftraege']),invoiceActor=await createFixture(['buchhaltung']);
 const created=await withSession(full,()=>createCustomerAction({clientEventId:randomUUID(),customerType:'lieferant',companyName:'TEST K3 K6 supplier',country:'DE'}));
 if(created.code!=='OK')throw Error('TEST_K36_SUPPLIER');
 const supplierId=created.receipt.customerId,itemId=randomUUID(),fileId=randomUUID();
 const bytes=Buffer.from(await renderToBuffer(createElement(Document,null,createElement(Page,null,createElement(Text,null,'TEST K3 K6 original invoice')))));
 const prepared=await withSession(full,()=>prepareIntakeFileAction({itemId,fileId,name:'TEST-K36.pdf',mime:'application/pdf',bytes:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex'),captureOrigin:'dokument'}));
 if(prepared.code!=='OK')throw Error('TEST_K36_ORIGINAL');
 if(prepared.upload){const url=new URL('/storage/v1/object/upload/sign/'+prepared.upload.bucket+'/'+prepared.upload.path,process.env.NEXT_PUBLIC_SUPABASE_URL);if(url.hostname!=='127.0.0.1')throw Error('TEST_LOOPBACK_ONLY');url.searchParams.set('token',prepared.upload.token);expect((await nativeFetch(url,{method:'PUT',headers:{'content-type':'application/pdf','x-upsert':'false'},body:new Uint8Array(bytes)})).ok).toBe(true);}
 const ocrHost=process.env.AZURE_DOCINTEL_ENDPOINT?new URL(process.env.AZURE_DOCINTEL_ENDPOINT).hostname:null;
 const provider=vi.spyOn(globalThis,'fetch').mockImplementation((request,init)=>{const url=new URL(typeof request==='string'?request:request instanceof URL?request.href:request.url);return ocrHost&&url.hostname===ocrHost?Promise.resolve(new Response('TEST OCR unavailable',{status:503})):nativeFetch(request,init);});
 expect(await withSession(full,()=>finishIntakeFileAction(fileId)).finally(()=>provider.mockRestore())).toMatchObject({code:'OK'});
 if(!missingSupplier){const assignment=await withSession(full,()=>getIntakeAssignmentAction({itemId,mode:'normal'}));if(assignment.code!=='OK')throw Error('TEST_K36_ASSIGNMENT');expect(await withSession(full,()=>assignIntakeCustomerAction({itemId,version:assignment.view.version,clientEventId:randomUUID(),customerId:supplierId,mode:'manual'}))).toMatchObject({code:'OK'});}
 const view=await withSession(bookkeeping,()=>getIncomingInvoiceAction({id:itemId}));if(view.code!=='OK')throw Error('TEST_K36_READ');
 const fields={lieferantId:missingSupplier?'':supplierId,nummer:'TEST-'+itemId,datum:'2026-11-17',netto:'100,00',ust:'19,00',brutto:'119,00',faelligAm:'2026-11-30',iban:'',ibanGeprueft:false};
 const saved=await withSession(bookkeeping,()=>saveIncomingInvoiceAction({itemId,fileId,version:view.view.item.version,clientKey:randomUUID(),fields,status:'unklar',paidDate:null,proofFileId:null,duplicateId:null,duplicateReason:null,unclearReason:missingSupplier?'Lieferant fehlt':'TEST Betrag prüfen'}));
 expect(saved).toMatchObject({code:'OK'});if(saved.code!=='OK')throw Error('TEST_K36_SAVE:'+JSON.stringify(saved));
 const [task]=await sql`SELECT id::text,version,art,fuer_bereich FROM public.tasks WHERE tenant_id=${tenant} AND bezug_typ='eingangsrechnung' AND bezug_id=${saved.invoice.id}`;
 expect(task).toMatchObject({art:missingSupplier?'aufgabe':'rechnung',fuer_bereich:missingSupplier?'eingang':'buchhaltung'});
 expect(await withSession(denied,()=>getIntakeTaskAction({taskId:task.id}))).toMatchObject(missingSupplier?{code:'OK',canComplete:false}:{code:'FORBIDDEN'});
 if(missingSupplier){
  expect(await withSession(incoming,()=>getIntakeTaskAction({taskId:task.id}))).toMatchObject({code:'OK',canComplete:true,canOpenReference:false});
  const complete={taskId:task.id,version:task.version,note:'TEST Lieferant ergänzen erledigt'};
  expect(await withSession(denied,()=>completeIntakeTaskAction(complete))).toMatchObject({code:'FORBIDDEN'});
  if(supplierDone){
   expect(await withSession(incoming,()=>completeIntakeTaskAction(complete))).toMatchObject({code:'OK',task:{status:'erledigt',erledigt_von:incoming.actorId}});
   expect(await withSession(incoming,()=>completeIntakeTaskAction(JSON.parse(JSON.stringify(complete))))).toMatchObject({code:'OK',replayed:true});
  }
  expect(await withSession(incoming,()=>getIncomingInvoiceAction({id:itemId}))).toMatchObject({code:'FORBIDDEN'});
 }
 const clarify={invoiceId:saved.invoice.id,version:saved.invoice.version,clientKey:randomUUID(),result:'offen',paidDate:null,proofFileId:null,duplicateId:null,reason:null,fields:{...fields,lieferantId:supplierId}};
 expect(await withSession(incoming,()=>clarifyIncomingInvoiceAction(clarify))).toMatchObject({code:'FORBIDDEN'});
 expect(await withSession(bookkeeping,()=>getIntakeTaskAction({taskId:task.id}))).toMatchObject({code:'OK'});
 expect(await withSession(invoiceActor,()=>clarifyIncomingInvoiceAction(clarify))).toMatchObject({code:'OK'});
 expect(await withSession(invoiceActor,()=>clarifyIncomingInvoiceAction(JSON.parse(JSON.stringify(clarify))))).toMatchObject({code:'OK',replayed:true});
 expect(await sql`SELECT status,erledigt_von::text FROM public.tasks WHERE tenant_id=${tenant} AND id=${task.id}::uuid`).toEqual([{status:'erledigt',erledigt_von:missingSupplier&&supplierDone?incoming.actorId:invoiceActor.actorId}]);
});
