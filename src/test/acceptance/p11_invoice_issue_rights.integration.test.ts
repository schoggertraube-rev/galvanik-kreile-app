// @vitest-environment node
import {randomUUID} from 'node:crypto';
import {expect,it,vi} from 'vitest';
const tenant=vi.hoisted(()=>'TEST-ablauf-'+globalThis.crypto.randomUUID());
vi.mock('@/lib/tenant',()=>({KREILE_TENANT_SLUG:tenant}));
import {createFixture,full,sql,withSession} from '../../../e2e/ablauf/replayHarness';
import {readyOrderForInvoice} from '../../../e2e/ablauf/orderFixture';
import {issueInvoiceAction} from '@/app/actions/invoices.actions';
import {saveCustomerAgreementAction} from '@/app/actions/customers.actions';

it('P11 permits agreement-based issuance and only returns the original amounts to a price-authorized actor',async()=>{
 const order=await readyOrderForInvoice('TEST P11 Ausstellen mit Absprache');
 const delegated=await createFixture(['auftraege'],'werkstatt');
 const priced=await createFixture(['preise']);
 const agreement=await withSession(full,()=>saveCustomerAgreementAction({
  customerId:order.customerId,orderId:order.orderId,clientKey:randomUUID(),type:'zahlungsziel',targetDays:14,reason:'TEST P11 vereinbartes Zahlungsziel',
 }));
 if(agreement.code!=='OK')throw Error('TEST_P11_AGREEMENT');
 const input={
  orderId:order.orderId,expectedVersion:order.version,clientEventId:randomUUID(),
  agreement:{id:agreement.agreement.id,type:'zahlungsziel' as const,version:agreement.agreement.version},
 };
 const issued=await withSession(delegated,()=>issueInvoiceAction(input));
 expect(issued).toMatchObject({code:'OK',receipt:{orderId:order.orderId,issuedBy:delegated.actorId,status:'issued',invoiceNumber:expect.any(String),pdfRef:expect.any(String)}});
 if(issued.code!=='OK')throw Error('TEST_P11_DELEGATED_INVOICE');
 for(const field of ['netAmountCents','vatAmountCents','grossAmountCents'])expect(issued.receipt).not.toHaveProperty(field);
 const retry=await withSession(delegated,()=>issueInvoiceAction(structuredClone(input)));
 expect(retry).toEqual({...issued,replayed:true});
 const [persisted]=await sql`SELECT id::text,net_amount_cents::int,vat_amount_cents::int,gross_amount_cents::int FROM public.invoices WHERE tenant_id=${tenant} AND order_id=${order.orderId}`;
 expect(persisted).toMatchObject({id:issued.receipt.invoiceId,net_amount_cents:10000,vat_amount_cents:1900,gross_amount_cents:11900});
 const separate=await readyOrderForInvoice('TEST P11 Ausstellen mit Preisrecht');
 expect(await withSession(priced,()=>issueInvoiceAction({
  orderId:separate.orderId,expectedVersion:separate.version,clientEventId:randomUUID(),
 }))).toMatchObject({code:'OK',receipt:{netAmountCents:10000,vatAmountCents:1900,grossAmountCents:11900}});
});
