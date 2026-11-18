// @vitest-environment node
// Initial TEST catalog/customer/settings facts are synthetic. Order, extra
// work, freeze, invoice, Auth, original retrieval and retries use real writers.
import {createHash,randomUUID} from 'node:crypto';
import {mkdirSync,writeFileSync} from 'node:fs';
import path from 'node:path';
import {beforeAll,expect,it,vi} from 'vitest';
const tenant=vi.hoisted(()=>'TEST-ablauf-'+globalThis.crypto.randomUUID());
vi.mock('@/lib/tenant',()=>({KREILE_TENANT_SLUG:tenant}));
import {sql,full,withSession} from '../../ablauf/replayHarness';
import {customerFixture} from '../../ablauf/orderFixture';
import {storeItemPhoto} from '../../ablauf/photoFixture';
import {createOrderIntakeAction} from '@/app/actions/eingang.actions';
import {transitionWareneingangToGalvanikAction,setOrderItemFinishedAction,freezeOrderAction,getExtraWorkMasterDataAction,setExtraWorkHourlyRateAction,configureExtraWorkCatalogPositionAction,changeOrderItemExtraWorkAction} from '@/app/actions/orders.actions';
import {issueInvoiceAction} from '@/app/actions/invoices.actions';
import {GET as invoicePdf} from '@/app/api/invoices/[invoiceId]/pdf/route';
import {readInvoiceVat} from '@/modules/accounting/public';

beforeAll(async()=>{
 const url=process.env.DATABASE_URL;if(!url||url!==process.env.H18_EXPECTED_DATABASE_URL||new URL(url).hostname!=='127.0.0.1')throw Error('TEST_S54O_LOOPBACK_REQUIRED');
 await sql`INSERT INTO public.company_settings(id,tenant_id,company_name,street,zip,city,country,iban,bic,bank_name,tax_id,invoice_vat_rate_basis_points,invoice_payment_term_days,versand_pauschale_netto_cents)
 VALUES(${randomUUID()}::uuid,${tenant},'TEST S54o Hybrid','TEST Weg 1','70176','Stuttgart','Deutschland','DE02120300000000202051','BYLADEM1001','TEST Bank','DE123456789',1900,14,1000)`;
});

it.each([false,true])('S54o A2/A4: mixed rates plus real extra work and shipping, reverseCharge=%s',async reverseCharge=>{
 const customerId=await customerFixture('S54o A2/A4 '+reverseCharge);
 if(reverseCharge)await sql`UPDATE public.customers SET country='AT',zip_code='1010',city='Wien',vat_id='ATU12345678' WHERE tenant_id=${tenant} AND id=${customerId}`;
 const catalogIds=[randomUUID(),randomUUID()],rates=[1900,700];
 for(const [index,rate] of rates.entries())await sql`INSERT INTO public.catalog_services(id,tenant_id,name,surface,unit,net_price_cents,vat_rate_basis_points,standard_lead_time_working_days) VALUES(${catalogIds[index]}::uuid,${tenant},${'TEST S54o '+reverseCharge+' '+rate},'verchromen','stueck',10000,${rate},1)`;
 const created=await withSession(full,()=>createOrderIntakeAction({geprueft:true,clientEventId:randomUUID(),customer:{mode:'EXISTING',customerId},dueDate:'2027-05-15',termStatus:'bestaetigt',intakeSource:'persoenlich',handoverMode:'shipping',paymentMode:'rechnung',note:'TEST Hybrid A2/A4',items:rates.map((rate,index)=>({catalogServiceId:catalogIds[index],name:'TEST S54o '+reverseCharge+' '+rate,quantity:1,material:'Messing',surfaceRequested:'verchromen',executionRequested:'offen',unit:'stueck',unitPriceCents:10000,vatRateBasisPoints:rate}))}));
 if(created.code!=='OK')throw Error('TEST_S54O_INTAKE:'+created.code+':'+created.message);expect(created.code).toBe('OK');
 const orderId=created.receipt.orderId;
 const moved=await withSession(full,()=>transitionWareneingangToGalvanikAction({orderId,expectedVersion:1,clientEventId:randomUUID()}));
 expect(moved.code).toBe('OK');if(moved.code!=='OK')throw Error('TEST_S54O_MOVE');
 const positionId=randomUUID();
 expect(await withSession(full,()=>configureExtraWorkCatalogPositionAction({positionId,expectedVersion:0,name:'TEST Hybrid Zusatzarbeit '+reverseCharge,standardMinutes:30,active:true,clientEventId:randomUUID()}))).toMatchObject({code:'OK'});
 const master=await withSession(full,()=>getExtraWorkMasterDataAction());if(master.code!=='OK')throw Error('TEST_S54O_RATE_READ');
 expect(await withSession(full,()=>setExtraWorkHourlyRateAction({rateId:randomUUID(),expectedVersion:master.data.currentRate?.version??0,hourlyRateCents:6000,clientEventId:randomUUID()}))).toMatchObject({code:'OK'});
 const extra=await withSession(full,()=>changeOrderItemExtraWorkAction({lineId:randomUUID(),orderId,itemId:created.receipt.items[0].id,catalogPositionId:positionId,minutes:30,active:true,expectedLineVersion:0,expectedOrderVersion:moved.receipt.aggregateVersion,clientEventId:randomUUID()}));
 expect(extra.code).toBe('OK');if(extra.code!=='OK')throw Error('TEST_S54O_EXTRA:'+extra.code);
 let version=extra.receipt.aggregateVersion;
 for(const item of created.receipt.items){await storeItemPhoto(orderId,item.id);const finished=await withSession(full,()=>setOrderItemFinishedAction({orderId,itemId:item.id,expectedVersion:version,clientEventId:randomUUID(),finished:true}));if(finished.code!=='OK')throw Error('TEST_S54O_FINISH');version=finished.receipt.aggregateVersion;}
 const frozen=await withSession(full,()=>freezeOrderAction({orderId,freezeId:randomUUID(),expectedVersion:version,clientEventId:randomUUID()}));
 expect(frozen.code).toBe('OK');if(frozen.code!=='OK')throw Error('TEST_S54O_FREEZE:'+frozen.code);
 const input={orderId,expectedVersion:frozen.receipt.aggregateVersion,clientEventId:randomUUID()};
 const result=await withSession(full,()=>issueInvoiceAction(input));
 expect(result).toMatchObject({code:'OK',receipt:{netAmountCents:24000,vatAmountCents:reverseCharge?0:3360,grossAmountCents:reverseCharge?24000:27360}});
 if(result.code!=='OK')throw Error('TEST_S54O_ISSUE:'+result.code+':'+result.message);
 const [stored]=await sql`SELECT snapshot,pdf_sha256 FROM public.invoices WHERE tenant_id=${tenant} AND id=${result.receipt.invoiceId}::uuid`;
 expect(stored.snapshot).toMatchObject({schemaVersion:3,lines:expect.arrayContaining([expect.objectContaining({type:'EXTRA_WORK',unit:'HUR',minutes:30,amountCents:3000}),expect.objectContaining({type:'SHIPPING',unit:'C62',amountCents:1000})])});
 expect(readInvoiceVat(stored.snapshot)).toMatchObject({netAmountCents:24000,vatAmountCents:reverseCharge?0:3360});
 const response=await withSession(full,()=>invoicePdf(new Request('http://127.0.0.1/api/invoices/'+result.receipt.invoiceId+'/pdf'),{params:Promise.resolve({invoiceId:result.receipt.invoiceId})}));
 expect(response.status).toBe(200);const bytes=new Uint8Array(await response.arrayBuffer());
 expect(createHash('sha256').update(bytes).digest('hex')).toBe(result.receipt.pdfSha256);
 const {getDocument}=await import('pdfjs-dist/legacy/build/pdf.mjs');const task=getDocument({data:bytes.slice(),verbosity:0});
 try{
  const document=await task.promise,attachments=await document.getAttachments();expect(attachments?.size).toBe(1);if(!attachments)throw Error('TEST_S54O_ATTACHMENT');
  const [key]=[...attachments][0];const xml=await document.getAttachmentContent(key);if(!xml)throw Error('TEST_S54O_XML');
  const xmlText=new TextDecoder().decode(xml);expect(xmlText).toContain('<ram:BilledQuantity unitCode="HUR">0.5000</ram:BilledQuantity>');
  expect(xmlText).toContain('<ram:GrandTotalAmount>'+(reverseCharge?'240.00':'273.60')+'</ram:GrandTotalAmount>');
  let text='';for(let page=1;page<=document.numPages;page++){const content=await(await document.getPage(page)).getTextContent();text+=content.items.filter((row):row is Extract<typeof row,{str:string}>=>'str'in row).map(row=>row.str).join(' ');}
  expect(text).toContain(reverseCharge?'240,00':'273,60');
  if(reverseCharge){expect(xmlText).toContain('<ram:CategoryCode>AE</ram:CategoryCode>');expect(xmlText).toContain('VATEX-EU-AE');expect(text).toContain('Steuerschuldnerschaft des Leistungsempfängers');}
  else{expect(xmlText).toContain('<ram:RateApplicablePercent>7.00</ram:RateApplicablePercent>');expect(xmlText).toContain('<ram:RateApplicablePercent>19.00</ram:RateApplicablePercent>');}
  const output=process.env.S54O_EVIDENCE_DIR??'.git';mkdirSync(output,{recursive:true});const name='kreile-s54o-'+(reverseCharge?'a4':'a2');
  writeFileSync(path.join(output,name+'.pdf'),bytes);writeFileSync(path.join(output,name+'.xml'),xml);
  writeFileSync(path.join(output,name+'.json'),JSON.stringify({invoiceId:result.receipt.invoiceId,pdfSha256:result.receipt.pdfSha256,actualWriter:true,reverseCharge,snapshot:stored.snapshot},null,2)+'\n');
 }finally{await task.destroy();}
 expect(await withSession(full,()=>issueInvoiceAction(JSON.parse(JSON.stringify(input))))).toMatchObject({code:'OK',replayed:true,receipt:{invoiceId:result.receipt.invoiceId,pdfSha256:result.receipt.pdfSha256}});
 expect(await sql`SELECT pdf_sha256 FROM public.invoices WHERE tenant_id=${tenant} AND id=${result.receipt.invoiceId}::uuid`).toEqual([{pdf_sha256:stored.pdf_sha256}]);
});
