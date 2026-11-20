// @vitest-environment node
// A38a A2: only initial TEST customer facts are synthetic; invoice/action/Auth/DB/PDF are real.
import {createHash,randomUUID} from 'node:crypto';
import {mkdirSync,writeFileSync} from 'node:fs';
import path from 'node:path';
import type postgres from 'postgres';
import {expect,it,vi} from 'vitest';
const tenant=vi.hoisted(()=>'TEST-ablauf-'+globalThis.crypto.randomUUID());
vi.mock('@/lib/tenant',()=>({KREILE_TENANT_SLUG:tenant}));
import {sql,full,withSession} from '../../../e2e/ablauf/replayHarness';
import {customerFixture,readyOrderForInvoice} from '../../../e2e/ablauf/orderFixture';
import {issueInvoiceAction,getInvoiceReceiptAction} from '@/app/actions/invoices.actions';
import {saveCustomerAgreementAction,revokeCustomerAgreementAction} from '@/app/actions/customers.actions';
import {withRestoredTestSource} from '@/test/fixtures/restoredTestSource';

it('K2 keeps customer agreement 45 days through an order agreement without a payment target',async()=>{
 const customerId=await customerFixture('TEST K2 field precedence');
 const customerAgreement=await withSession(full,()=>saveCustomerAgreementAction({customerId,clientKey:randomUUID(),type:'zahlungsziel',targetDays:45,reason:'TEST K2 customer payment agreement'}));
 expect(customerAgreement.code).toBe('OK');
 const order=await readyOrderForInvoice('TEST K2 nonpayment order agreement','pickup',customerId);
 const orderAgreement=await withSession(full,()=>saveCustomerAgreementAction({customerId,orderId:order.orderId,clientKey:randomUUID(),type:'ausgabe_ohne_zahlung',reason:'TEST K2 physical release agreement'}));
 expect(orderAgreement.code).toBe('OK');
 const [current]=await sql`SELECT version FROM public.orders WHERE tenant_id=${tenant} AND id=${order.orderId}`;
 const input={orderId:order.orderId,expectedVersion:current.version,clientEventId:randomUUID()};
 const issued=await withSession(full,()=>issueInvoiceAction(input));expect(issued.code).toBe('OK');
 if(issued.code!=='OK')throw Error('TEST_K2_ISSUE:'+issued.code);
 const [stored]=await sql`SELECT snapshot,(due_date-(issued_at AT TIME ZONE 'Europe/Berlin')::date)::int AS days FROM public.invoices WHERE tenant_id=${tenant} AND id=${issued.receipt.invoiceId}::uuid`;
 expect(stored).toMatchObject({days:45,snapshot:{terms:{quelle:'absprache',ziel_tage:45}}});
 expect(await withSession(full,()=>issueInvoiceAction(JSON.parse(JSON.stringify(input))))).toMatchObject({code:'OK',replayed:true,receipt:{invoiceId:issued.receipt.invoiceId}});
});

it('A38a A1 freezes firm terms without a customer discount when credit terms are disabled',async()=>{
 const order=await readyOrderForInvoice('TEST S38a firm source');
 await sql`UPDATE public.customers SET ziel_freigeschaltet=false,ziel_tage=NULL,skonto_prozent=NULL,skonto_tage=NULL
  WHERE tenant_id=${tenant} AND id=${order.customerId}`;
 const issued=await withSession(full,()=>issueInvoiceAction({orderId:order.orderId,expectedVersion:order.version,clientEventId:randomUUID()}));
 expect(issued).toMatchObject({code:'OK'});
 if(issued.code!=='OK')throw Error('TEST_S38A_FIRM_ISSUE_REQUIRED');
 const [stored]=await sql`SELECT snapshot,payment_term_days FROM public.invoices WHERE tenant_id=${tenant} AND id=${issued.receipt.invoiceId}::uuid`;
 expect(stored).toMatchObject({payment_term_days:14,snapshot:{terms:{quelle:'firma',ziel_tage:14,skonto_prozent:null,skonto_tage:null}}});
});

it('K6 freezes the capped discount and its configured original duration',async()=>{
 const customerId=await customerFixture('TEST K6 capped discount');
 await sql`UPDATE public.customers SET ziel_freigeschaltet=true,ziel_tage=30,skonto_prozent=2,skonto_tage=8 WHERE tenant_id=${tenant} AND id=${customerId}`;
 const order=await readyOrderForInvoice('TEST K6 five day agreement','pickup',customerId);
 expect(await withSession(full,()=>saveCustomerAgreementAction({customerId,orderId:order.orderId,clientKey:randomUUID(),type:'zahlungsziel',targetDays:5,reason:'TEST K6 effective target'}))).toMatchObject({code:'OK'});
 const [current]=await sql`SELECT version FROM public.orders WHERE tenant_id=${tenant} AND id=${order.orderId}`;
 const input={orderId:order.orderId,expectedVersion:current.version,clientEventId:randomUUID()};
 const issued=await withSession(full,()=>issueInvoiceAction(input));expect(issued.code).toBe('OK');
 if(issued.code!=='OK')throw Error('TEST_K6_CAP_ISSUE:'+issued.code);
 const [stored]=await sql`SELECT snapshot FROM public.invoices WHERE tenant_id=${tenant} AND id=${issued.receipt.invoiceId}::uuid`;
 expect(stored.snapshot.terms).toEqual({quelle:'absprache',ziel_tage:5,skonto_prozent:2,skonto_tage:5,skonto_begrenzt_von:8});
 expect(await withSession(full,()=>issueInvoiceAction(JSON.parse(JSON.stringify(input))))).toMatchObject({code:'OK',replayed:true,receipt:{invoiceId:issued.receipt.invoiceId}});
});

it('K6 identifies the missing firm target before allocation and retains the same command after exact source restoration',async()=>{
 const order=await readyOrderForInvoice('TEST K6 missing firm target');
 await sql`UPDATE public.customers SET ziel_freigeschaltet=false,ziel_tage=NULL,skonto_prozent=NULL,skonto_tage=NULL WHERE tenant_id=${tenant} AND id=${order.customerId}`;
 const read=async()=>{const [row]=await sql`SELECT to_jsonb(setting) AS original FROM public.company_settings setting WHERE tenant_id=${tenant}`;if(!row)throw Error('TEST_K6_FIRM_SOURCE');return row.original as Record<string,postgres.JSONValue>;};
 mkdirSync('.git/kreile-s38a-k6-firm-originals',{recursive:true});
 writeFileSync('.git/kreile-s38a-k6-firm-originals/'+order.orderId+'.json',JSON.stringify({tenant,original:await read()}));
 const input={orderId:order.orderId,expectedVersion:order.version,clientEventId:randomUUID()};
 await withRestoredTestSource({label:'TEST K6 complete company settings row',read,restore:async original=>{
  const columns=Object.keys(original);if(columns.some(column=>!/^[a-z_][a-z0-9_]*$/.test(column)))throw Error('TEST_K6_COLUMN_INVALID');
  const names=columns.map(column=>'"'+column+'"').join(',');
  await sql`UPDATE public.company_settings SET (${sql.unsafe(names)})=(SELECT ${sql.unsafe(names)} FROM jsonb_populate_record(NULL::public.company_settings,${sql.json(original)}::jsonb)) WHERE tenant_id=${tenant} AND id=${String(original.id)}`;
 }},async()=>{
  await sql`UPDATE public.company_settings SET invoice_payment_term_days=NULL WHERE tenant_id=${tenant}`;
  expect(await withSession(full,()=>issueInvoiceAction(input))).toMatchObject({code:'VALIDATION_ERROR',source:{kind:'settings',field:'paymentTermDays'},message:'Zahlungsziel fehlt oder ist ungültig. Öffne die Firmeneinstellungen.'});
  expect(await sql`SELECT id FROM public.invoices WHERE tenant_id=${tenant} AND order_id=${order.orderId}`).toHaveLength(0);
 });
 expect(await withSession(full,()=>issueInvoiceAction(JSON.parse(JSON.stringify(input))))).toMatchObject({code:'OK'});
});

it('A38a A2 captures customer target and discount in one real original; later changes never replace them',async()=>{
 const customerId=await customerFixture('TEST S38a customer terms');
 await sql`UPDATE public.customers SET ziel_tage=30,skonto_prozent=2,skonto_tage=8
  WHERE tenant_id=${tenant} AND id=${customerId}`;
 const order=await readyOrderForInvoice('TEST S38a original terms','pickup',customerId);
 const input={orderId:order.orderId,expectedVersion:order.version,clientEventId:randomUUID()};
 const issued=await withSession(full,()=>issueInvoiceAction(input));
 expect(issued).toMatchObject({code:'OK'});
 if(issued.code!=='OK')throw Error('TEST_S38A_ISSUE_REQUIRED:'+issued.code);
 const [original]=await sql`SELECT snapshot,pdf_sha256,payment_term_days,(due_date-(issued_at AT TIME ZONE 'Europe/Berlin')::date)::int AS days
  FROM public.invoices WHERE tenant_id=${tenant} AND id=${issued.receipt.invoiceId}::uuid`;
 expect(original).toMatchObject({payment_term_days:30,days:30,snapshot:{paymentTermDays:30,terms:{quelle:'kunde',ziel_tage:30,skonto_prozent:2,skonto_tage:8}}});
 // A2b: inspect the actual immutable container, not an independently rendered XML sample.
 const [stored]=await sql`SELECT pdf_content,to_char((issued_at AT TIME ZONE 'Europe/Berlin')::date+8,'DD.MM.YYYY') AS skonto_date FROM public.invoices WHERE tenant_id=${tenant} AND id=${issued.receipt.invoiceId}::uuid`;
 const bytes=new Uint8Array(stored.pdf_content);
 expect(createHash('sha256').update(bytes).digest('hex')).toBe(issued.receipt.pdfSha256);
 const {getDocument}=await import('pdfjs-dist/legacy/build/pdf.mjs');
 const task=getDocument({data:bytes.slice(),verbosity:0});
 try{
  const document=await task.promise,attachments=await document.getAttachments();
  expect(attachments?.size).toBe(1);
  if(!attachments)throw Error('TEST_S38A_XML_ORIGINAL_REQUIRED');
  const [id,attachment]=[...attachments][0];expect(attachment.filename).toBe('factur-x.xml');
  const xml=await document.getAttachmentContent(id);if(!xml)throw Error('TEST_S38A_XML_BYTES_REQUIRED');
  expect(new TextDecoder().decode(xml)).toContain('#SKONTO#TAGE=8#PROZENT=2.00#\n');
  let visible='';for(let page=1;page<=document.numPages;page++){
   const content=await(await document.getPage(page)).getTextContent();
   visible+=content.items.filter((row):row is Extract<typeof row,{str:string}>=>'str'in row).map(row=>row.str).join(' ');
  }
  expect(visible).toContain('Bei Zahlung bis '+stored.skonto_date+' (8 Tage) erhalten Sie 2 % Skonto.');
  const output=path.resolve('.git/kreile-s38a-skonto-evidence');mkdirSync(output,{recursive:true});
  writeFileSync(path.join(output,'kreile-s54o-a2.pdf'),bytes);
  writeFileSync(path.join(output,'kreile-s54o-a2.xml'),xml);
  writeFileSync(path.join(output,'kreile-s54o-a2.json'),JSON.stringify({invoiceId:issued.receipt.invoiceId,pdfSha256:issued.receipt.pdfSha256,tenant,source:'actual S38a A2 action/Auth/DB original'},null,2));
 }finally{await task.destroy();}
 await sql`UPDATE public.customers SET ziel_tage=45,skonto_prozent=3,skonto_tage=10 WHERE tenant_id=${tenant} AND id=${customerId}`;
 expect(await withSession(full,()=>getInvoiceReceiptAction({orderId:order.orderId,clientEventId:input.clientEventId}))).toMatchObject({code:'OK',data:{invoiceId:issued.receipt.invoiceId}});
 expect(await withSession(full,()=>issueInvoiceAction(JSON.parse(JSON.stringify(input))))).toMatchObject({code:'OK',replayed:true,receipt:{invoiceId:issued.receipt.invoiceId}});
 const [after]=await sql`SELECT snapshot,pdf_sha256,payment_term_days,(due_date-(issued_at AT TIME ZONE 'Europe/Berlin')::date)::int AS days
  FROM public.invoices WHERE tenant_id=${tenant} AND id=${issued.receipt.invoiceId}::uuid`;
 expect(after).toEqual(original);
});

it('A38a A3/A4 uses the active agreement ahead of customer terms and retains the original after revocation',async()=>{
 const customerId=await customerFixture('TEST S38a agreement source');
 await sql`UPDATE public.customers SET ziel_tage=30,skonto_prozent=2,skonto_tage=8 WHERE tenant_id=${tenant} AND id=${customerId}`;
 const order=await readyOrderForInvoice('TEST S38a agreement original','pickup',customerId);
 const agreement=await withSession(full,()=>saveCustomerAgreementAction({customerId,orderId:order.orderId,clientKey:randomUUID(),type:'zahlungsziel',targetDays:45,reason:'TEST S38a A3 actual agreement'}));
 expect(agreement).toMatchObject({code:'OK'});
 if(agreement.code!=='OK')throw Error('TEST_S38A_AGREEMENT_REQUIRED');
 const [current]=await sql`SELECT version FROM public.orders WHERE tenant_id=${tenant} AND id=${order.orderId}`;
 const input={orderId:order.orderId,expectedVersion:current.version,clientEventId:randomUUID()};
 const issued=await withSession(full,()=>issueInvoiceAction(input));
 expect(issued).toMatchObject({code:'OK'});
 if(issued.code!=='OK')throw Error('TEST_S38A_AGREEMENT_INVOICE_REQUIRED');
 const [original]=await sql`SELECT snapshot,pdf_sha256 FROM public.invoices WHERE tenant_id=${tenant} AND id=${issued.receipt.invoiceId}::uuid`;
 expect(original.snapshot.terms).toEqual({quelle:'absprache',ziel_tage:45,skonto_prozent:2,skonto_tage:8});
 expect(await withSession(full,()=>revokeCustomerAgreementAction({agreementId:agreement.agreement.id,version:agreement.agreement.version,clientKey:randomUUID(),reason:'TEST S38a A4 revoked after issue'}))).toMatchObject({code:'OK'});
 expect(await withSession(full,()=>issueInvoiceAction(JSON.parse(JSON.stringify(input))))).toMatchObject({code:'OK',replayed:true,receipt:{invoiceId:issued.receipt.invoiceId}});
 expect(await sql`SELECT snapshot,pdf_sha256 FROM public.invoices WHERE tenant_id=${tenant} AND id=${issued.receipt.invoiceId}::uuid`).toEqual([original]);
});
