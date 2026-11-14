// @vitest-environment node
// A09 N1: actual order/freeze/Settings/invoice/PDF/receipt source, no synthetic invoice.
import {createHash,randomUUID} from 'node:crypto';
import {beforeAll,expect,it,vi} from 'vitest';
const tenant=vi.hoisted(()=>'TEST-ablauf-'+globalThis.crypto.randomUUID());
vi.mock('@/lib/tenant',()=>({KREILE_TENANT_SLUG:tenant}));
import {KREILE_TENANT_SLUG} from '@/lib/tenant';
import {sql,full,withSession} from '../../../e2e/ablauf/replayHarness';
import {readyInvoiceOrder,customerFixture} from '../../../e2e/ablauf/orderFixture';
import {storeItemPhoto} from '../../../e2e/ablauf/photoFixture';
import {issueInvoiceAction,getInvoiceReceiptAction,cancelInvoiceAction} from '@/app/actions/invoices.actions';
import {readShippingSettingsAction,saveShippingSettingsAction} from '@/app/actions/settings.actions';
import {createOrderIntakeAction} from '@/app/actions/eingang.actions';
import {transitionWareneingangToGalvanikAction,setOrderItemFinishedAction,freezeOrderAction,getExtraWorkMasterDataAction,setExtraWorkHourlyRateAction} from '@/app/actions/orders.actions';
import {readInvoiceVat} from '@/modules/accounting/public';

beforeAll(async()=>{
 const url=process.env.DATABASE_URL;if(!url||url!==process.env.H18_EXPECTED_DATABASE_URL||new URL(url).hostname!=='127.0.0.1')throw Error('TEST_S09_LOOPBACK_REQUIRED');
 // Explicit synthetic TEST issuer master data; no synthetic invoice or VAT verification.
 await sql`INSERT INTO public.company_settings(id,tenant_id,company_name,street,zip,city,country,iban,bic,bank_name,tax_id,invoice_vat_rate_basis_points,invoice_payment_term_days)
 VALUES(${randomUUID()}::uuid,${KREILE_TENANT_SLUG},'TEST S09 Galvanik','TEST Weg 1','70176','Stuttgart','Deutschland','DE02120300000000202051','BYLADEM1001','TEST Bank','DE123456789',1900,14)`;
});
async function fee(value:number|null){
 const read=await withSession(full,()=>readShippingSettingsAction());if(read.code!=='OK')throw Error('TEST_S09_ACTUAL_FEE_SETTINGS');
 expect(await withSession(full,()=>saveShippingSettingsAction({service:read.settings.service,numberPattern:read.settings.numberPattern,numberHint:read.settings.numberHint,trackingUrl:read.settings.trackingUrl,expectedUpdatedAt:read.settings.updatedAt,shippingFeeCents:value}))).toMatchObject({code:'OK'});
}

it('A09-1/-9 one real individual shipping invoice contains the configured fee exactly once with firm VAT and immutable PDF retry',async()=>{
 const url=process.env.DATABASE_URL;if(!url||url!==process.env.H18_EXPECTED_DATABASE_URL||new URL(url).hostname!=='127.0.0.1')throw Error('TEST_S09_LOOPBACK_REQUIRED');
 const order=await readyInvoiceOrder('TEST S09 one shipment fee','shipping',false,undefined,10000);
 expect(await withSession(full,()=>readShippingSettingsAction())).toMatchObject({code:'OK',settings:{shippingFeeCents:1000}});
 const rows=await sql`SELECT snapshot,pdf_content,pdf_sha256,net_amount_cents,vat_amount_cents,gross_amount_cents,vat_rate_basis_points FROM public.invoices WHERE tenant_id=${KREILE_TENANT_SLUG} AND id=${order.invoice.invoiceId}::uuid`;
 expect(rows).toHaveLength(1);const original=rows[0];
 expect(original.snapshot.lines.filter((line:{name?:string})=>line.name==='Versand')).toEqual([expect.objectContaining({name:'Versand',amountCents:1000,vat_rate_basis_points:1900})]);
 expect(readInvoiceVat(original)).toMatchObject({netAmountCents:11000,vatAmountCents:2090,grossAmountCents:13090,groups:[{rateBp:1900,netCents:11000,vatCents:2090,grossCents:13090}]});
 expect(createHash('sha256').update(original.pdf_content).digest('hex')).toBe(original.pdf_sha256);
 expect(await sql`SELECT count(*)::int AS n FROM public.items WHERE tenant_id=${KREILE_TENANT_SLUG} AND order_id=${order.orderId} AND name='Versand'`).toEqual([{n:0}]);
 expect(await withSession(full,()=>getInvoiceReceiptAction({orderId:order.orderId,clientEventId:order.issueInput.clientEventId}))).toMatchObject({code:'OK',data:{invoiceId:order.invoice.invoiceId,grossAmountCents:13090}});
 expect(await withSession(full,()=>issueInvoiceAction(JSON.parse(JSON.stringify(order.issueInput))))).toMatchObject({code:'OK',replayed:true,receipt:{invoiceId:order.invoice.invoiceId,grossAmountCents:13090}});
 expect(await sql`SELECT pdf_sha256 FROM public.invoices WHERE tenant_id=${KREILE_TENANT_SLUG} AND id=${order.invoice.invoiceId}::uuid`).toEqual([{pdf_sha256:original.pdf_sha256}]);
});

it.each([null,0])('A09-4 explicit shipping setting %s is retained in the actual invoice, never replaced by1000',async value=>{
 await fee(value);
 const order=await readyInvoiceOrder('TEST S09 nullable fee '+String(value),'shipping',false,undefined,10000);
 const [stored]=await sql`SELECT snapshot,net_amount_cents,vat_amount_cents,gross_amount_cents,vat_rate_basis_points FROM public.invoices WHERE tenant_id=${KREILE_TENANT_SLUG} AND id=${order.invoice.invoiceId}::uuid`;
 const lines=stored.snapshot.lines.filter((line:{type:string})=>line.type==='SHIPPING');
 expect(lines).toEqual(value===null?[]:[expect.objectContaining({amountCents:0,name:'Versand'})]);
 expect(readInvoiceVat(stored)).toMatchObject({netAmountCents:10000,vatAmountCents:1900,grossAmountCents:11900});
 expect(await withSession(full,()=>issueInvoiceAction(JSON.parse(JSON.stringify(order.issueInput))))).toMatchObject({code:'OK',replayed:true,receipt:{grossAmountCents:11900}});
});

it.each([false,true])('A09-9 actual mixed19/7 shipping uses firm VAT, reverseCharge=%s; cancellation reads the same typed original',async reverseCharge=>{
 await fee(1000);
 const customerId=await customerFixture('TEST S09 mixed shipping '+reverseCharge);
 // Synthetic initial customer/catalog facts; actual order/freeze/invoice/cancellation writers below.
 if(reverseCharge)await sql`UPDATE public.customers SET country='AT',zip_code='1010',city='Wien',vat_id='ATU12345678' WHERE tenant_id=${KREILE_TENANT_SLUG} AND id=${customerId}`;
 const catalogIds=[randomUUID(),randomUUID()],rates=[1900,700];
 for(const [index,rate] of rates.entries())await sql`INSERT INTO public.catalog_services(id,tenant_id,name,surface,unit,net_price_cents,vat_rate_basis_points,standard_lead_time_working_days) VALUES(${catalogIds[index]}::uuid,${KREILE_TENANT_SLUG},${'TEST S09 mixed '+reverseCharge+' '+index},'verchromen','stueck',10000,${rate},1)`;
 const created=await withSession(full,()=>createOrderIntakeAction({geprueft:true,clientEventId:randomUUID(),customer:{mode:'EXISTING',customerId},dueDate:'2027-05-15',termStatus:'bestaetigt',intakeSource:'persoenlich',handoverMode:'shipping',paymentMode:'rechnung',note:'TEST S09 mixed shipping',items:rates.map((rate,index)=>({catalogServiceId:catalogIds[index],name:'TEST S09 mixed '+reverseCharge+' '+index,quantity:1,material:'Messing',surfaceRequested:'verchromen',executionRequested:'offen',unit:'stueck',unitPriceCents:10000,vatRateBasisPoints:rate}))}));
 if(created.code!=='OK')throw Error('TEST_S09_MIXED_INTAKE:'+created.code+':'+created.message);
 const orderId=created.receipt.orderId,moved=await withSession(full,()=>transitionWareneingangToGalvanikAction({orderId,expectedVersion:1,clientEventId:randomUUID()}));if(moved.code!=='OK')throw Error('TEST_S09_MIXED_HANDOFF');
 let version=moved.receipt.aggregateVersion;
 for(const item of created.receipt.items){await storeItemPhoto(orderId,item.id);const finished=await withSession(full,()=>setOrderItemFinishedAction({orderId,itemId:item.id,expectedVersion:version,clientEventId:randomUUID(),finished:true}));if(finished.code!=='OK')throw Error('TEST_S09_MIXED_FINISH');version=finished.receipt.aggregateVersion;}
 const master=await withSession(full,()=>getExtraWorkMasterDataAction());if(master.code!=='OK')throw Error('TEST_S09_RATE_SOURCE');if(!master.data.currentRate)expect(await withSession(full,()=>setExtraWorkHourlyRateAction({rateId:randomUUID(),expectedVersion:0,hourlyRateCents:14000,clientEventId:randomUUID()}))).toMatchObject({code:'OK'});
 const frozen=await withSession(full,()=>freezeOrderAction({orderId,freezeId:randomUUID(),expectedVersion:version,clientEventId:randomUUID()}));if(frozen.code!=='OK')throw Error('TEST_S09_MIXED_FREEZE');
 const input={orderId,expectedVersion:frozen.receipt.aggregateVersion,clientEventId:randomUUID()},issued=await withSession(full,()=>issueInvoiceAction(input));
 expect(issued).toMatchObject({code:'OK',receipt:{netAmountCents:21000,vatAmountCents:reverseCharge?0:2790,grossAmountCents:reverseCharge?21000:23790}});if(issued.code!=='OK')throw Error('TEST_S09_MIXED_ISSUE');
 const [original]=await sql`SELECT snapshot,pdf_sha256 FROM public.invoices WHERE tenant_id=${KREILE_TENANT_SLUG} AND id=${issued.receipt.invoiceId}::uuid`;
 expect(original.snapshot.lines.filter((line:{type:string})=>line.type==='SHIPPING')).toEqual([expect.objectContaining({name:'Versand',amountCents:1000,vat_rate_basis_points:reverseCharge?0:1900})]);
 const cancelInput={invoiceId:issued.receipt.invoiceId,expectedVersion:1,reason:'TEST S09 typed shipping original cancellation',clientEventId:randomUUID()};
 expect(await withSession(full,()=>cancelInvoiceAction(cancelInput))).toMatchObject({code:'OK'});
 expect(await withSession(full,()=>cancelInvoiceAction(JSON.parse(JSON.stringify(cancelInput))))).toMatchObject({code:'OK',replayed:true});
 expect(await sql`SELECT snapshot,pdf_sha256 FROM public.invoices WHERE tenant_id=${KREILE_TENANT_SLUG} AND id=${issued.receipt.invoiceId}::uuid`).toEqual([original]);
});
