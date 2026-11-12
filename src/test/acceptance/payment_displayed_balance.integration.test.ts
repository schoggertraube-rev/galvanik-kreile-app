// @vitest-environment node
import {it,expect,vi} from 'vitest';
import {randomUUID} from 'node:crypto';
const tenant=vi.hoisted(()=> 'TEST-ablauf-'+globalThis.crypto.randomUUID());
vi.mock('@/lib/tenant',()=>({KREILE_TENANT_SLUG:tenant}));
import {sql,full,withSession,createFixture} from '../../../e2e/ablauf/replayHarness';
import {readyInvoiceOrder} from '../../../e2e/ablauf/orderFixture';
import {confirmPaymentAction,getOrderPaymentStateAction} from '@/app/actions/payments.actions';
import {KREILE_TENANT_SLUG} from '@/lib/tenant';
it('N4 rejects a changed displayed balance without booking, binds retries to the original balance and reads the true remainder',async()=>{
 const order=await readyInvoiceOrder('N4-Rest');
 const [initial]=await sql`SELECT payment_open_amount_cents AS amount,payment_version AS version FROM public.invoices WHERE tenant_id=${KREILE_TENANT_SLUG} AND id=${order.invoice.invoiceId}::uuid`;
 const {readTodayDashboard}=await import('@/lib/server/todayDashboard'),{resolveAuthorization}=await import('@/lib/server/authorization');
 const {getComplaints}=await import('@/app/actions/complaints.actions'),{getQuoteFollowupsForTodayAction}=await import('@/app/actions/quotes.actions');
 const day=()=>withSession(full,async()=>{const auth=await resolveAuthorization();if(!auth.ok)throw Error('TEST S05 payment auth');return readTodayDashboard(auth.data,getComplaints,getQuoteFollowupsForTodayAction);});
 expect((await day()).invoiceMoney).toMatchObject({code:'OK',openCount:1,openCents:initial.amount,sources:[{id:order.invoice.invoiceId,version:initial.version}]});

 const input={invoiceId:order.invoice.invoiceId,amount:4000,method:'ueberweisung' as const,expectedVersion:initial.version,expectedOpenAmountCents:initial.amount,clientEventId:randomUUID()};
 const bad={...input,expectedOpenAmountCents:initial.amount-1};
 expect(await withSession(full,()=>confirmPaymentAction(bad))).toMatchObject({code:'CONFLICT',currentOpenAmountCents:initial.amount});
 expect(await sql`SELECT id FROM public.events WHERE tenant_id=${KREILE_TENANT_SLUG} AND client_event_id=${input.clientEventId}::uuid`).toHaveLength(0);
 const saved=await withSession(full,()=>confirmPaymentAction(input));expect(saved).toMatchObject({code:'OK',replayed:false,receipt:{source:'manual',openAmountCents:initial.amount-4000}});if(saved.code!=='OK')throw Error('N4_PAYMENT');
 const current=await withSession(full,()=>getOrderPaymentStateAction({orderId:order.orderId}));expect(current).toMatchObject({code:'OK',data:{payment:{openAmountCents:initial.amount-4000,paymentVersion:saved.receipt.paymentVersion}}});
 expect(await withSession(full,()=>confirmPaymentAction(JSON.parse(JSON.stringify(input))))).toMatchObject({code:'OK',replayed:true,receipt:{eventId:saved.receipt.eventId}});
 expect(await withSession(full,()=>confirmPaymentAction({...input,expectedOpenAmountCents:initial.amount-4000}))).toMatchObject({code:'CONFLICT'});
 expect(await withSession(full,()=>confirmPaymentAction({...input,clientEventId:randomUUID(),expectedVersion:saved.receipt.paymentVersion}))).toMatchObject({code:'CONFLICT',currentOpenAmountCents:initial.amount-4000});
 expect(await sql`SELECT payment_open_amount_cents AS amount,payment_version AS version FROM public.invoices WHERE tenant_id=${KREILE_TENANT_SLUG} AND id=${order.invoice.invoiceId}::uuid`).toEqual([{amount:initial.amount-4000,version:saved.receipt.paymentVersion}]);

 const part=await day();expect(part.invoiceMoney).toMatchObject({code:'OK',openCount:1,openCents:initial.amount-4000,sources:[{id:order.invoice.invoiceId,version:saved.receipt.paymentVersion}]});
 const remainder={invoiceId:order.invoice.invoiceId,amount:initial.amount-4000,method:'ueberweisung' as const,expectedVersion:saved.receipt.paymentVersion,expectedOpenAmountCents:initial.amount-4000,clientEventId:randomUUID()};
 const settled=await withSession(full,()=>confirmPaymentAction(remainder));expect(settled).toMatchObject({code:'OK',replayed:false,receipt:{openAmountCents:0}});if(settled.code!=='OK')throw Error('TEST S05 settlement');
 const zero=await day();expect(zero.invoiceMoney).toMatchObject({code:'OK',openCount:0,openCents:0,overdueCount:0,sources:[]});expect(zero.items.some(row=>row.invoiceId===order.invoice.invoiceId)).toBe(false);
 expect(await withSession(full,()=>confirmPaymentAction(JSON.parse(JSON.stringify(remainder))))).toMatchObject({code:'OK',replayed:true,receipt:{eventId:settled.receipt.eventId}});
 expect((await day()).invoiceMoney).toEqual(zero.invoiceMoney);
 const denied=await createFixture(['auftraege'],'werkstatt');
 const rejection=await withSession(denied,()=>confirmPaymentAction({...input,clientEventId:randomUUID()}));expect(rejection.code).toBe('FORBIDDEN');expect(rejection).not.toHaveProperty('currentOpenAmountCents');
});
