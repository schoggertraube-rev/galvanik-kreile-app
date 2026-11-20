// @vitest-environment node
// A38a A10: actual issue/payment/auth/DB readers. Only the calendar read day is
// controlled; immutable originals and real issuer/auth/session time never change.
import {randomUUID} from 'node:crypto';
import {expect,it,vi} from 'vitest';
const tenant=vi.hoisted(()=>'TEST-ablauf-'+globalThis.crypto.randomUUID());
vi.mock('@/lib/tenant',()=>({KREILE_TENANT_SLUG:tenant}));
import {sql,full,withSession,createFixture} from '../../../e2e/ablauf/replayHarness';
import {customerFixture,readyOrderForInvoice} from '../../../e2e/ablauf/orderFixture';
import {issueInvoiceAction,issueCollectionInvoiceAction} from '@/app/actions/invoices.actions';
import {historicalCollection} from '../../../e2e/ablauf/invoiceCollectionFixture';
import {confirmPaymentAction} from '@/app/actions/payments.actions';
import {resolveAuthorization} from '@/lib/server/authorization';
import {readInvoiceVat} from '@/modules/accounting/public';
import type {ImmutableInvoiceReceipt} from '@/lib/server/commands/immutableInvoiceCommand';
import {readInvoiceTruth} from '@/lib/server/invoiceTruthRead';
import {readTodayDashboard} from '@/lib/server/todayDashboard';
import {readCustomerKennzahlen} from '@/lib/server/customerSummaryRead';
import {withPrivilegedTenantTransaction} from '@/lib/server/privilegedDb';
import {getComplaints} from '@/app/actions/complaints.actions';
import {getQuoteFollowupsForTodayAction} from '@/app/actions/quotes.actions';
import {listOffenePostenAction} from '@/app/buchhaltung/actions';
import {getAgingDaten} from '@/app/cockpit/actions';

it('K1 includes the real native collection original in Today reminders and both money totals',async()=>{
 // Only historical initial records are synthetic; original issuance and every reader are real.
 const source=await historicalCollection([1900,1900,1900]);
 const [clock]=await sql`SELECT ((statement_timestamp() AT TIME ZONE 'Europe/Berlin')::date+agreement.ziel_tage+1)::text AS today FROM public.customer_agreements agreement WHERE agreement.tenant_id=${tenant} AND agreement.id=${source.agreementId}::uuid`;
 const auth=await withSession(full,()=>resolveAuthorization());if(!auth.ok)throw Error('TEST_K1_AUTH');
 const read=()=>withSession(full,()=>readTodayDashboard(auth.data,getComplaints,getQuoteFollowupsForTodayAction,new Date(clock.today+'T12:00:00Z')));
 const before=await read();expect(before.invoiceMoney?.code).toBe('OK');
 const issued=await withSession(full,()=>issueCollectionInvoiceAction({collectionId:source.collectionId,expectedVersion:1,clientEventId:randomUUID()}));
 expect(issued.code).toBe('OK');if(issued.code!=='OK')throw Error('TEST_K1_COLLECTION_ISSUE:'+issued.code);
 expect(issued.receipt.grossAmountCents).toBe(11900);
 const after=await read();expect(after.invoiceMoney?.code).toBe('OK');
 if(before.invoiceMoney?.code!=='OK'||after.invoiceMoney?.code!=='OK')throw Error('TEST_K1_TODAY_SOURCE');
 expect(after.invoiceMoney.openCents-before.invoiceMoney.openCents).toBe(11900);
 expect(after.invoiceMoney.overdueCents-before.invoiceMoney.overdueCents).toBe(11900);
 const item=after.items.find(row=>row.invoiceId===issued.receipt.invoiceId);
 expect(item).toMatchObject({primaryActionLabel:'Erinnern'});expect(item).not.toHaveProperty('orderId');
 const list=await withSession(full,()=>readInvoiceTruth(auth.data,{customerId:source.customerId},readInvoiceVat,clock.today));
 expect(list.code).toBe('OK');if(list.code!=='OK')throw Error('TEST_K1_LIST');
 expect(list.data.find(row=>row.invoiceId===issued.receipt.invoiceId)).toMatchObject({overdue:true,openAmountCents:11900});
 const sum=await withPrivilegedTenantTransaction(auth.data,tx=>readCustomerKennzahlen(tx,auth.data,source.customerId,clock.today));
 expect(sum.overdue).toEqual({invoiceCount:1,openAmountCents:11900});
});

it('A38a A10 classifies yesterday-open/today-open/yesterday-paid identically in the real list, Today and customer sum',async()=>{
 const customerId=await customerFixture('TEST S38a overdue day');
 const invoices:ImmutableInvoiceReceipt[]=[];
 for(const [index,days] of [1,2,1].entries()){
  await sql`UPDATE public.customers SET ziel_freigeschaltet=true,ziel_tage=${days},skonto_prozent=NULL,skonto_tage=NULL WHERE tenant_id=${tenant} AND id=${customerId}`;
  const order=await readyOrderForInvoice('TEST S38a overdue '+index,'pickup',customerId);
  const issued=await withSession(full,()=>issueInvoiceAction({orderId:order.orderId,expectedVersion:order.version,clientEventId:randomUUID()}));
  if(issued.code!=='OK')throw Error('TEST_S38A_OVERDUE_ISSUE:'+issued.code);
  invoices.push(issued.receipt);
 }
 const paid=await withSession(full,()=>confirmPaymentAction({invoiceId:invoices[2].invoiceId,amount:invoices[2].grossAmountCents,method:'bar',expectedVersion:0,clientEventId:randomUUID()}));
 expect(paid).toMatchObject({code:'OK'});
 const [clock]=await sql`SELECT ((statement_timestamp() AT TIME ZONE 'Europe/Berlin')::date+2)::text AS today`;
 const auth=await withSession(full,()=>resolveAuthorization());if(!auth.ok)throw Error('TEST_S38A_OVERDUE_AUTH');
 const read=()=>withSession(full,async()=>{
  const list=await readInvoiceTruth(auth.data,{customerId},readInvoiceVat,clock.today);
  const today=await readTodayDashboard(auth.data,getComplaints,getQuoteFollowupsForTodayAction,new Date(clock.today+'T12:00:00Z'));
  const sum=await withPrivilegedTenantTransaction(auth.data,tx=>readCustomerKennzahlen(tx,auth.data,customerId,clock.today));
  return {list,today,sum};
 });
 const first=await read();expect(first.list).toMatchObject({code:'OK'});if(first.list.code!=='OK')throw Error('TEST_S38A_OVERDUE_LIST');
 expect(first.list.data.filter(row=>row.overdue).map(row=>row.invoiceId)).toEqual([invoices[0].invoiceId]);
 expect(first.list.data.find(row=>row.invoiceId===invoices[1].invoiceId)).toMatchObject({overdue:false,dueDate:clock.today});
 expect(first.list.data.find(row=>row.invoiceId===invoices[2].invoiceId)).toMatchObject({overdue:false,paymentStatus:'bezahlt',openAmountCents:0});
 expect(first.today.moneyMetric).toMatchObject({code:'OK',count:1,sources:[{id:invoices[0].invoiceId}]});
 expect(first.today.invoiceMoney).toMatchObject({code:'OK',overdueCount:1,overdueCents:invoices[0].grossAmountCents});
 expect(first.sum.overdue).toEqual({invoiceCount:1,openAmountCents:invoices[0].grossAmountCents});
 const again=await read();expect(again.list).toEqual(first.list);expect(again.today.moneyMetric).toEqual(first.today.moneyMetric);expect(again.sum.overdue).toEqual(first.sum.overdue);
 const partialAmount=Math.min(4000,invoices[0].grossAmountCents-1);
 expect(partialAmount).toBeGreaterThan(0);
 expect(await withSession(full,()=>confirmPaymentAction({invoiceId:invoices[0].invoiceId,amount:partialAmount,method:'bar',expectedVersion:0,clientEventId:randomUUID()}))).toMatchObject({code:'OK'});
 const partial=await read();if(partial.list.code!=='OK')throw Error('TEST_S38A_PARTIAL_LIST');
 const remaining=invoices[0].grossAmountCents-partialAmount;
 expect(partial.list.data.find(row=>row.invoiceId===invoices[0].invoiceId)).toMatchObject({overdue:true,paymentStatus:'teilbezahlt',openAmountCents:remaining,grossAmountCents:invoices[0].grossAmountCents});
 expect(partial.today.invoiceMoney).toMatchObject({code:'OK',overdueCount:1,overdueCents:remaining});
 expect(partial.sum.overdue).toEqual({invoiceCount:1,openAmountCents:remaining});
 expect(await withSession(full,()=>listOffenePostenAction())).toEqual(expect.arrayContaining([expect.objectContaining({id:invoices[0].invoiceId,brutto:invoices[0].grossAmountCents/100,openAmountCents:remaining,mahnstufe:null})]));
 const noMoney=await createFixture(['wartung'],'developer');
 const deniedAuth=await withSession(noMoney,()=>resolveAuthorization());if(!deniedAuth.ok)throw Error('TEST_S38A_DENIED_AUTH');
 expect(deniedAuth.data.areas).toContain('wartung');expect(deniedAuth.data.permissions).not.toContain('perm_view_prices');
 const before=await sql`SELECT id,payment_version,payment_paid_amount_cents,payment_open_amount_cents,pdf_sha256 FROM public.invoices WHERE tenant_id=${tenant} ORDER BY id`;
 expect(await withSession(noMoney,()=>readInvoiceTruth(deniedAuth.data,{customerId},readInvoiceVat,clock.today))).toMatchObject({code:'FORBIDDEN'});
 await expect(withSession(noMoney,()=>getAgingDaten())).rejects.toThrow('Rechnungsdaten sind mit diesem Login nicht erlaubt.');
 expect(await sql`SELECT id,payment_version,payment_paid_amount_cents,payment_open_amount_cents,pdf_sha256 FROM public.invoices WHERE tenant_id=${tenant} ORDER BY id`).toEqual(before);

});
