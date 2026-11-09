import {randomUUID} from 'node:crypto';
import {expect,it} from 'vitest';
import {KREILE_TENANT_SLUG} from '@/lib/tenant';
import {sql,full,withSession} from './replayHarness';
import {readyInvoiceOrder} from './orderFixture';

it('H4 overdue invoice of the same customer blocks a new release without recording goods out',async()=>{
 const order=await readyInvoiceOrder('H4');
 // Given historical debt: a separate synthetic issued invoice, not a mutation
 // of the current immutable invoice and not a second product invoice writer.
 const oldInvoiceId=randomUUID(),oldNumber='TEST-H4-ALT-'+randomUUID();
 await sql`INSERT INTO public.invoices(id,tenant_id,customer_id,invoice_number,amount_total,status,due_date,gross_amount_cents,payment_contract_version,payment_mode,payment_status,payment_open_amount_cents,payment_paid_amount_cents,payment_currency,payment_version)
 VALUES(${oldInvoiceId}::uuid,${KREILE_TENANT_SLUG},${order.customerId},${oldNumber},119.00,'issued',current_date-1,11900,1,'rechnung','offen',11900,0,'EUR',0)`;
 const {recordGoodsOutAction}=await import('@/app/actions/goodsOut.actions');
 const key=randomUUID();
 const result=await withSession(full,()=>recordGoodsOutAction({orderId:order.orderId,mode:'abholung',expectedVersion:order.version,clientEventId:key}));
 expect(result.code,'H4: an overdue invoice of this customer must prevent the new release').not.toBe('OK');
 expect('message'in result?result.message:'').toContain(oldNumber);
 expect(await sql`SELECT station FROM public.orders WHERE tenant_id=${KREILE_TENANT_SLUG} AND id=${order.orderId}`).toEqual([{station:'fertig'}]);
 expect(await sql`SELECT count(*)::integer AS n FROM public.events WHERE tenant_id=${KREILE_TENANT_SLUG} AND order_id=${order.orderId} AND client_event_id=${key}`).toEqual([{n:0}]);
});
