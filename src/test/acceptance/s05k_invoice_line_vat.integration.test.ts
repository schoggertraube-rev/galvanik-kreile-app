// @vitest-environment node
// Isolated TEST master data; actual intake, completion, invoice and original readback.
import {beforeAll,it,expect,vi} from 'vitest';
import {randomUUID} from 'node:crypto';
const tenant=vi.hoisted(()=>'TEST-ablauf-'+globalThis.crypto.randomUUID());
vi.mock('@/lib/tenant',()=>({KREILE_TENANT_SLUG:tenant}));
import {sql,full,withSession} from '../../../e2e/ablauf/replayHarness';
import {customerFixture} from '../../../e2e/ablauf/orderFixture';
import {storeItemPhoto} from '../../../e2e/ablauf/photoFixture';
import {createOrderIntakeAction} from '@/app/actions/eingang.actions';
import {transitionWareneingangToGalvanikAction,setOrderItemFinishedAction,freezeOrderAction,getExtraWorkMasterDataAction,setExtraWorkHourlyRateAction} from '@/app/actions/orders.actions';
import {getDocument} from 'pdfjs-dist/legacy/build/pdf.mjs';
import {getInvoiceTruthAction,getInvoiceReceiptAction,getInvoiceSummariesAction,setInvoiceItemPricesAction,issueInvoiceAction} from '@/app/actions/invoices.actions';

beforeAll(()=>{
 const url=process.env.DATABASE_URL;
 if(!url||url!==process.env.H18_EXPECTED_DATABASE_URL||new URL(url).hostname!=='127.0.0.1')throw Error('TEST_EXACT_LOOPBACK_DATABASE_REQUIRED');
});

it.each([
 {name:'19 percent',rates:[1900],country:'DE',vatId:null,vat:1900,valid:true},
 {name:'7 percent',rates:[700],country:'DE',vatId:null,vat:700,valid:true},
 {name:'mixed 19 and 7',rates:[1900,700],country:'DE',vatId:null,vat:2600,valid:true},
 {name:'round whole rate group',rates:[1900,1900,1900],country:'DE',vatId:null,vat:1,valid:true,unitNet:1},
 {name:'EU overrides positive rates',rates:[1900,700],country:'AT',vatId:'ATU12345678',vat:0,valid:true},
 {name:'EU reverse charge',rates:[0],country:'AT',vatId:'ATU12345678',vat:0,valid:true},
 {name:'EU without customer VAT ID',rates:[0],country:'AT',vatId:null,vat:0,valid:false},
 {name:'free text inherits company VAT',rates:[1900],country:'DE',vatId:null,vat:1900,valid:true,freeText:true},
 {name:'free text without company VAT',rates:[1900],country:'DE',vatId:null,vat:0,valid:false,freeText:true,missingCompany:true},
])('S05K A4 immutable per-line VAT: $name',async scenario=>{
 const unitNetCents='unitNet' in scenario&&typeof scenario.unitNet==='number'?scenario.unitNet:10000;
 const expectedRates=scenario.country==='AT'&&scenario.vatId?scenario.rates.map(()=>0):scenario.rates;
 const freeText='freeText' in scenario&&scenario.freeText===true;
 const missingCompany='missingCompany' in scenario&&scenario.missingCompany===true;
 const customerId=await customerFixture('S05K A4 '+scenario.name);
 // Explicit synthetic company/customer master data, never an external VAT verification claim.
 await sql`UPDATE public.customers SET country=${scenario.country},zip_code=${scenario.country==='AT'?'1010':'70176'},city=${scenario.country==='AT'?'Wien':'Stuttgart'},vat_id=${scenario.vatId} WHERE tenant_id=${tenant} AND id=${customerId}`;
 await sql`INSERT INTO public.company_settings(id,tenant_id,company_name,street,zip,city,country,iban,bic,bank_name,tax_id,invoice_vat_rate_basis_points,invoice_payment_term_days)
 SELECT ${randomUUID()},${tenant},'TEST A4 Galvanik','TEST Weg 1','70176','Stuttgart','Deutschland','DE02120300000000202051','BYLADEM1001','TEST Bank','DE123456789',1900,14
 WHERE NOT EXISTS(SELECT 1 FROM public.company_settings WHERE tenant_id=${tenant})`;
 await sql`UPDATE public.company_settings SET invoice_vat_rate_basis_points=${missingCompany?null:1900} WHERE tenant_id=${tenant}`;
 const catalogIds=scenario.rates.map(()=>randomUUID());
 for(const [index,rate] of scenario.rates.entries())await sql`INSERT INTO public.catalog_services(id,tenant_id,name,surface,unit,net_price_cents,vat_rate_basis_points,standard_lead_time_working_days) VALUES(${catalogIds[index]},${tenant},${'TEST A4 '+scenario.name+' '+index},'verchromen','stueck',${unitNetCents},${rate},1)`;
 const created=await withSession(full,()=>createOrderIntakeAction({geprueft:true,clientEventId:randomUUID(),customer:{mode:'EXISTING',customerId},dueDate:'2027-05-15',termStatus:'bestaetigt',intakeSource:'persoenlich',handoverMode:'pickup',paymentMode:'rechnung',note:'TEST A4',items:scenario.rates.map((rate,index)=>({catalogServiceId:freeText?null:catalogIds[index],name:'TEST A4 '+scenario.name+' '+index,quantity:1,material:'Messing',surfaceRequested:'verchromen',executionRequested:'offen',unit:'stueck',unitPriceCents:freeText?null:unitNetCents,vatRateBasisPoints:freeText?null:rate}))}));
 if(created.code!=='OK')throw Error('TEST_A4_INTAKE:'+created.code+':'+created.message);
 const orderId=created.receipt.orderId;
 const moved=await withSession(full,()=>transitionWareneingangToGalvanikAction({orderId,expectedVersion:1,clientEventId:randomUUID()}));
 if(moved.code!=='OK')throw Error('TEST_A4_HANDOFF:'+moved.code);
 let version=moved.receipt.aggregateVersion;
 for(const item of created.receipt.items){
  await storeItemPhoto(orderId,item.id);
  const finished=await withSession(full,()=>setOrderItemFinishedAction({orderId,itemId:item.id,expectedVersion:version,clientEventId:randomUUID(),finished:true}));
  if(finished.code!=='OK')throw Error('TEST_A4_FINISH:'+finished.code);
  version=finished.receipt.aggregateVersion;
 }
 const master=await withSession(full,()=>getExtraWorkMasterDataAction());
 if(master.code!=='OK')throw Error('TEST_A4_RATE_READ');
 if(!master.data.currentRate){const rate=await withSession(full,()=>setExtraWorkHourlyRateAction({rateId:randomUUID(),expectedVersion:0,hourlyRateCents:14000,clientEventId:randomUUID()}));if(rate.code!=='OK')throw Error('TEST_A4_RATE');}
 const frozen=await withSession(full,()=>freezeOrderAction({orderId,freezeId:randomUUID(),expectedVersion:version,clientEventId:randomUUID()}));
 if(frozen.code!=='OK')throw Error('TEST_A4_FREEZE:'+frozen.code);
 let invoiceVersion=frozen.receipt.aggregateVersion;
 if(freeText){
  const [nulls]=await sql`SELECT bool_and(vat_rate_basis_points IS NULL) AS only_null FROM public.items WHERE tenant_id=${tenant} AND order_id=${orderId}`;
  expect(nulls.only_null).toBe(true);
  const priced=await withSession(full,()=>setInvoiceItemPricesAction({orderId,expectedVersion:invoiceVersion,clientEventId:randomUUID(),prices:created.receipt.items.map(item=>({itemId:item.id,unitPriceCents:unitNetCents}))}));
  if(priced.code!=='OK')throw Error('TEST_A4_FREE_TEXT_PRICE:'+priced.code);invoiceVersion=priced.receipt.aggregateVersion;
 }
 const input={orderId,expectedVersion:invoiceVersion,clientEventId:randomUUID()};
 const result=await withSession(full,()=>issueInvoiceAction(input));
 if(!scenario.valid){
  expect(result).toMatchObject({code:'VALIDATION_ERROR'});
  if(missingCompany)expect(result).toMatchObject({message:expect.stringContaining('Einstellungen unter Firmendaten')});
  const [count]=await sql`SELECT count(*)::integer AS n FROM public.invoices WHERE tenant_id=${tenant} AND order_id=${orderId}`;
  expect(count.n).toBe(0);
  return;
 }
 expect(result).toMatchObject({code:'OK',receipt:{vatAmountCents:scenario.vat,grossAmountCents:scenario.rates.length*unitNetCents+scenario.vat}});
 if(result.code!=='OK')throw Error('TEST_A4_ISSUE:'+result.code);
 const [original]=await sql`SELECT snapshot,pdf_sha256,pdf_content FROM public.invoices WHERE tenant_id=${tenant} AND id=${result.receipt.invoiceId}::uuid`;
 const baseLines=original.snapshot.lines.filter((line:{type:string})=>line.type==='BASE') as {itemId:string;name:string;vat_rate_basis_points:number}[];
 expect(baseLines.map(line=>line.itemId)).toEqual(created.receipt.items.map(item=>item.id).sort());
 const expectedByName=new Map(scenario.rates.map((_rate,index)=>['TEST A4 '+scenario.name+' '+index,expectedRates[index]]));
 for(const line of baseLines)expect(line.vat_rate_basis_points).toBe(expectedByName.get(line.name));
 expect(original.snapshot.schemaVersion).toBe(2);
 expect(original.snapshot.totals.vatRateBasisPoints).toBeNull();
 expect(original.snapshot.totals.vatBreakdown).toHaveLength(new Set(expectedRates).size);
 expect(original.pdf_sha256).toMatch(/^[0-9a-f]{64}$/);
 expect(await withSession(full,()=>getInvoiceReceiptAction({orderId,clientEventId:input.clientEventId}))).toMatchObject({code:'OK',data:{invoiceId:result.receipt.invoiceId,vatRateBasisPoints:null}});
 const truth=await withSession(full,()=>getInvoiceTruthAction({customerId}));
 expect(truth).toMatchObject({code:'OK',data:[expect.objectContaining({invoiceId:result.receipt.invoiceId,vatRateBasisPoints:null,vatGroups:expect.any(Array)})]});
 expect(await withSession(full,()=>getInvoiceTruthAction(JSON.parse(JSON.stringify({customerId}))))).toEqual(truth);
 const summaries=await withSession(full,()=>getInvoiceSummariesAction());
 expect(summaries).toMatchObject({code:'OK'});
 if(summaries.code!=='OK')throw Error('TEST_A4_SUMMARIES');
 expect(summaries.data.find(row=>row.invoiceId===result.receipt.invoiceId)).toMatchObject({vatRateBasisPoints:null,vatGroups:expect.arrayContaining([...new Set(expectedRates)].map(rateBp=>expect.objectContaining({rateBp})))});
 if(new Set(expectedRates).size>1||scenario.vat===0){
  const pdf=await getDocument({data:new Uint8Array(original.pdf_content),useSystemFonts:true}).promise;
  const text=[];for(let page=1;page<=pdf.numPages;page++){const content=await(await pdf.getPage(page)).getTextContent();text.push(content.items.map(item=>'str' in item?item.str:'').join(' '));}
  const rendered=text.join(' ');
  if(new Set(expectedRates).size>1){expect(rendered).toMatch(/Netto.*19.*%/);expect(rendered).toMatch(/Netto.*7.*%/);expect(rendered).toContain('226,00');}
  else {expect(rendered).toContain('Steuerschuldnerschaft des Leistungsempfängers');expect(rendered).toContain('ATU12345678');expect(rendered).toContain('DE123456789');}
 }
 expect(await withSession(full,()=>issueInvoiceAction(JSON.parse(JSON.stringify(input))))).toMatchObject({code:'OK',replayed:true,receipt:{invoiceId:result.receipt.invoiceId}});
});
