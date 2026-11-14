// @vitest-environment node
// PL08:45: actual invoice/payment/cancel/reissue writers. Only TEST master data
// is synthetic; no external VAT verification or Settings audit is claimed.
import {randomUUID} from 'node:crypto';
import {beforeAll,expect,it,vi} from 'vitest';
const tenant=vi.hoisted(()=>'TEST-ablauf-'+globalThis.crypto.randomUUID());
vi.mock('@/lib/tenant',()=>({KREILE_TENANT_SLUG:tenant}));
import {sql,full,withSession} from '../../../e2e/ablauf/replayHarness';
import {customerFixture} from '../../../e2e/ablauf/orderFixture';
import {storeItemPhoto} from '../../../e2e/ablauf/photoFixture';
import {createOrderIntakeAction} from '@/app/actions/eingang.actions';
import {transitionWareneingangToGalvanikAction,setOrderItemFinishedAction,getExtraWorkMasterDataAction,setExtraWorkHourlyRateAction,freezeOrderAction,changeOrderPickupNoticeAction} from '@/app/actions/orders.actions';
import {issueInvoiceAction,cancelInvoiceAction,getCustomerCreditAction} from '@/app/actions/invoices.actions';
import {confirmPaymentAction} from '@/app/actions/payments.actions';
beforeAll(async()=>{
 const u=process.env.DATABASE_URL;if(!u||u!==process.env.H18_EXPECTED_DATABASE_URL||new URL(u).hostname!=='127.0.0.1')throw Error('TEST_S09_LOOPBACK_REQUIRED');
 await sql`INSERT INTO public.company_settings(id,tenant_id,company_name,street,zip,city,country,iban,bic,bank_name,tax_id,invoice_vat_rate_basis_points,invoice_payment_term_days) VALUES(${randomUUID()}::uuid,${tenant},'TEST S09 VAT Galvanik','TEST Weg 1','70176','Stuttgart','Deutschland','DE02120300000000202051','BYLADEM1001','TEST Bank','DE123456789',1900,14)`;
});
it.each([{name:'mixed 19 and 7',country:'DE',vatId:null,vat:2600},{name:'reverse charge',country:'AT',vatId:'ATU12345678',vat:0}])('A09-7 same original per-rate goods survive reissue: $name',async scenario=>{
 await sql`UPDATE public.company_settings SET invoice_vat_rate_basis_points=1900 WHERE tenant_id=${tenant}`;
 const customerId=await customerFixture('TEST S09 reissue '+scenario.name);
 await sql`UPDATE public.customers SET country=${scenario.country},zip_code=${scenario.country==='AT'?'1010':'70176'},city=${scenario.country==='AT'?'Wien':'Stuttgart'},vat_id=${scenario.vatId} WHERE tenant_id=${tenant} AND id=${customerId}`;
 const positions=[1900,700].map(rate=>({id:randomUUID(),rate}));
 for(const position of positions)await sql`INSERT INTO public.catalog_services(id,tenant_id,name,surface,unit,net_price_cents,vat_rate_basis_points,standard_lead_time_working_days) VALUES(${position.id}::uuid,${tenant},${'TEST S09 VAT '+scenario.name+' '+position.rate},'verchromen','stueck',10000,${position.rate},1)`;
 const created=await withSession(full,()=>createOrderIntakeAction({geprueft:true,clientEventId:randomUUID(),customer:{mode:'EXISTING',customerId},dueDate:'2027-05-15',termStatus:'bestaetigt',intakeSource:'persoenlich',handoverMode:'shipping',paymentMode:'rechnung',note:'TEST S09 original VAT',items:positions.map(position=>({catalogServiceId:position.id,name:'TEST S09 VAT '+scenario.name+' '+position.rate,quantity:1,material:'Messing',surfaceRequested:'verchromen',executionRequested:'offen',unit:'stueck',unitPriceCents:10000,vatRateBasisPoints:position.rate}))}));
 if(created.code!=='OK')throw Error('TEST_VAT_INTAKE:'+created.code);
 const orderId=created.receipt.orderId,moved=await withSession(full,()=>transitionWareneingangToGalvanikAction({orderId,expectedVersion:1,clientEventId:randomUUID()}));if(moved.code!=='OK')throw Error('TEST_VAT_HANDOFF');
 let version=moved.receipt.aggregateVersion;
 for(const item of created.receipt.items){await storeItemPhoto(orderId,item.id);const finished=await withSession(full,()=>setOrderItemFinishedAction({orderId,itemId:item.id,expectedVersion:version,finished:true,clientEventId:randomUUID()}));if(finished.code!=='OK')throw Error('TEST_VAT_FINISH');version=finished.receipt.aggregateVersion;}
 const master=await withSession(full,()=>getExtraWorkMasterDataAction());if(master.code!=='OK')throw Error('TEST_VAT_RATE');
 if(!master.data.currentRate)expect(await withSession(full,()=>setExtraWorkHourlyRateAction({rateId:randomUUID(),expectedVersion:0,hourlyRateCents:14000,clientEventId:randomUUID()}))).toMatchObject({code:'OK'});
 const frozen=await withSession(full,()=>freezeOrderAction({orderId,freezeId:randomUUID(),expectedVersion:version,clientEventId:randomUUID()}));if(frozen.code!=='OK')throw Error('TEST_VAT_FREEZE');
 const issued=await withSession(full,()=>issueInvoiceAction({orderId,expectedVersion:frozen.receipt.aggregateVersion,clientEventId:randomUUID()}));if(issued.code!=='OK')throw Error('TEST_VAT_ISSUE');
 const [original]=await sql`SELECT snapshot,pdf_sha256 FROM public.invoices WHERE tenant_id=${tenant} AND id=${issued.receipt.invoiceId}::uuid`;
 expect(await withSession(full,()=>confirmPaymentAction({invoiceId:issued.receipt.invoiceId,amount:issued.receipt.grossAmountCents,expectedVersion:0,expectedOpenAmountCents:issued.receipt.grossAmountCents,method:'ueberweisung',clientEventId:randomUUID()}))).toMatchObject({code:'OK'});
 const manual=await withSession(full,()=>changeOrderPickupNoticeAction({command:'handover_manual',orderId,expectedVersion:issued.receipt.orderVersion,handoverMode:'pickup',clientEventId:randomUUID()}));
 if(manual.code!=='OK'||!manual.receipt||typeof manual.receipt!=='object'||!('eventId'in manual.receipt)||typeof manual.receipt.eventId!=='string')throw Error('TEST_VAT_PICKUP');
 await sql`UPDATE public.company_settings SET invoice_vat_rate_basis_points=700 WHERE tenant_id=${tenant}`;
 const input={invoiceId:issued.receipt.invoiceId,expectedVersion:1,reason:'Übergabeart Versand → Abholung',clientEventId:randomUUID(),reissueWithoutShipping:{handoverEventId:manual.receipt.eventId,replacementClientEventId:randomUUID()}};
 const result=await withSession(full,()=>cancelInvoiceAction(input));expect(result).toMatchObject({code:'OK',replacementReceipt:{netAmountCents:20000,vatAmountCents:scenario.vat,grossAmountCents:20000+scenario.vat}});
 const [replacement]=await sql`SELECT snapshot FROM public.invoices WHERE tenant_id=${tenant} AND client_event_id=${input.reissueWithoutShipping.replacementClientEventId}::uuid`;
 expect(replacement.snapshot.lines).toEqual(original.snapshot.lines.filter((line:{type:string})=>line.type!=='SHIPPING'));
 expect(await withSession(full,()=>getCustomerCreditAction(customerId))).toMatchObject({code:'OK',credit:{balanceCents:issued.receipt.grossAmountCents}});
 expect(await withSession(full,()=>cancelInvoiceAction(JSON.parse(JSON.stringify(input))))).toEqual({...result,replayed:true});
});
