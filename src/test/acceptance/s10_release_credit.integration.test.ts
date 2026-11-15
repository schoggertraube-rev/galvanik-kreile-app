// @vitest-environment node
// Synthetic prior-year debt is the same explicitly isolated historical starting
// fact as H4. Credit creation, proposal, application and output are real writers.
import {randomUUID} from 'node:crypto';
import {expect,it,vi} from 'vitest';
const tenant=vi.hoisted(()=>'TEST-ablauf-'+globalThis.crypto.randomUUID());
vi.mock('@/lib/tenant',()=>({KREILE_TENANT_SLUG:tenant}));
import {KREILE_TENANT_SLUG} from '@/lib/tenant';
import {sql,full,withSession,createFixture} from '../../../e2e/ablauf/replayHarness';
import {readyInvoiceOrder,intakeOrderFixture} from '../../../e2e/ablauf/orderFixture';
import {confirmPaymentAction,getOrderPaymentStateAction} from '@/app/actions/payments.actions';
import {cancelInvoiceAction,applyCustomerCreditAction} from '@/app/actions/invoices.actions';
import {recordGoodsOutAction} from '@/app/actions/goodsOut.actions';
for(const creditAmount of [6000,4000])it(`A10-7 real credit ${creditAmount} is offered against the actual blocking debt before a release override`,async()=>{
 const source=await readyInvoiceOrder('TEST S10 original credit '+creditAmount);
 expect(await withSession(full,()=>confirmPaymentAction({invoiceId:source.invoice.invoiceId,amount:creditAmount,expectedVersion:0,method:'bar',clientEventId:randomUUID()}))).toMatchObject({code:'OK'});
 expect(await withSession(full,()=>cancelInvoiceAction({invoiceId:source.invoice.invoiceId,expectedVersion:1,reason:'TEST S10 existing credit',clientEventId:randomUUID()}))).toMatchObject({code:'OK'});
 const target=await readyInvoiceOrder('TEST S10 release with credit '+creditAmount,'pickup',false,source.customerId);
 expect(await withSession(full,()=>confirmPaymentAction({invoiceId:target.invoice.invoiceId,amount:target.invoice.grossAmountCents,expectedVersion:0,method:'bar',clientEventId:randomUUID()}))).toMatchObject({code:'OK'});
 const oldOrder=await intakeOrderFixture('TEST S10 historical debt '+creditAmount,source.customerId),debtId=randomUUID(),number=creditAmount===6000?'R-2025-0001':'R-2025-0002';
 await sql`INSERT INTO public.invoices(id,tenant_id,order_id,customer_id,invoice_number,amount_total,status,due_date,gross_amount_cents,payment_contract_version,payment_mode,payment_status,payment_open_amount_cents,payment_paid_amount_cents,payment_currency,payment_version)
 VALUES(${debtId}::uuid,${KREILE_TENANT_SLUG},${oldOrder.receipt.orderId},${source.customerId},${number},60,'issued',(statement_timestamp() AT TIME ZONE 'Europe/Berlin')::date-1,6000,1,'rechnung','offen',6000,0,'EUR',0)`;
 const input={orderId:target.orderId,expectedVersion:target.version,clientEventId:randomUUID(),mode:'abholung' as const};
 const blocked=await withSession(full,()=>recordGoodsOutAction(input));
 expect(blocked).toMatchObject({code:'CONFLICT',creditApplication:{code:'OK',proposal:{command:'credit.apply',input:{invoiceId:debtId,amount:creditAmount,expectedOpenAmountCents:6000}}}});
 if(blocked.code!=='CONFLICT'||!('creditApplication'in blocked))throw Error('TEST_S10_DEBT_CREDIT_SOURCE');
 const application=blocked.creditApplication as {code:string;proposal:{label:string;input:{invoiceId:string;amount:number;expectedVersion:number;expectedOpenAmountCents:number;expectedCreditVersion:number}}};
 expect(application.proposal.label).toContain(number);
 expect(await withSession(full,()=>getOrderPaymentStateAction({orderId:target.orderId}))).toMatchObject({code:'OK',data:{customerDeliveryBlock:{blocked:true}}});
 const goods=await createFixture(['auftraege'],'werkstatt');
 const noMoney=await withSession(goods,()=>recordGoodsOutAction({...input,clientEventId:randomUUID()}));
 expect(noMoney).toMatchObject({code:'CONFLICT'});expect(noMoney).not.toHaveProperty('creditApplication');expect(noMoney).not.toHaveProperty('paymentSource');
 const apply={...application.proposal.input,clientEventId:randomUUID()};
 expect(await withSession(full,()=>applyCustomerCreditAction(apply))).toMatchObject({code:'OK'});
 expect(await withSession(full,()=>applyCustomerCreditAction(JSON.parse(JSON.stringify(apply))))).toMatchObject({code:'OK',replayed:true});
 expect(await sql`SELECT payment_open_amount_cents FROM public.invoices WHERE tenant_id=${KREILE_TENANT_SLUG} AND id=${debtId}::uuid`).toEqual([{payment_open_amount_cents:6000-creditAmount}]);
 const released=await withSession(full,()=>recordGoodsOutAction(JSON.parse(JSON.stringify(input))));
 expect(released).toMatchObject({code:creditAmount===6000?'OK':'CONFLICT'});
 expect(await sql`SELECT count(*)::int AS n FROM public.events WHERE tenant_id=${KREILE_TENANT_SLUG} AND order_id=${target.orderId} AND event_type='ORDER_GOODS_OUT_DEBT_OVERRIDE_V1'`).toEqual([{n:0}]);
 if(released.code==='OK')expect(await withSession(full,()=>recordGoodsOutAction(JSON.parse(JSON.stringify(input))))).toMatchObject({code:'OK',replayed:true});
});
