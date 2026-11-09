import {randomUUID} from 'node:crypto';
import {expect,it} from 'vitest';
import {KREILE_TENANT_SLUG} from '@/lib/tenant';
import {sql,full,withSession,createFixture} from './replayHarness';

it('L3 real customer actions authenticate from the cookie and withhold billing values before serialization',async()=>{
 const {createCustomerAction,getCustomerSummaryAction}=await import('@/app/actions/customers.actions');
 const input={clientEventId:randomUUID(),customerType:'business' as const,companyName:'TEST L3 Rechte '+randomUUID().slice(0,8),phone:'+49 711 5550190'};
 const created=await withSession(full,()=>createCustomerAction(input));
 expect(created,JSON.stringify(created)).toMatchObject({code:'OK'});if(created.code!=='OK')throw Error('L3_CUSTOMER_CREATE:'+created.code);
 const customerId=created.receipt.customerId;
 expect(await sql`SELECT name FROM public.customers WHERE tenant_id=${KREILE_TENANT_SLUG} AND id=${customerId}`).toEqual([{name:input.companyName}]);
 expect(await sql`SELECT user_id::text FROM public.events WHERE tenant_id=${KREILE_TENANT_SLUG} AND client_event_id=${input.clientEventId}::uuid`).toEqual([{user_id:full.actorId}]);
 const money=await withSession(full,()=>getCustomerSummaryAction({customerId}));
 expect(money).toMatchObject({code:'OK',data:{id:customerId,invoiceRevenueCents:0,invoiceOpenCents:0}});
 expect(await withSession(full,()=>createCustomerAction(structuredClone(input)))).toMatchObject({code:'OK',replayed:true,receipt:{customerId}});
 const operational=await createFixture(['kunden'],'werkstatt');
 const hidden=await withSession(operational,()=>getCustomerSummaryAction({customerId}));
 expect(hidden.code).toBe('OK');if(hidden.code!=='OK')throw Error('L3_OPERATIONAL_READ:'+hidden.code);
 expect(hidden.data.id).toBe(customerId);
 expect(hidden.data).not.toHaveProperty('invoiceRevenueCents');
 expect(hidden.data).not.toHaveProperty('invoiceOpenCents');
 expect(JSON.stringify(hidden)).not.toMatch(/invoiceRevenueCents|invoiceOpenCents/);
 const denied=await createFixture([],'readonly');
 expect(await withSession(denied,()=>getCustomerSummaryAction({customerId}))).toMatchObject({code:'FORBIDDEN'});
 expect(await sql`SELECT count(*)::integer AS n FROM public.customers WHERE tenant_id=${KREILE_TENANT_SLUG} AND id=${customerId}`).toEqual([{n:1}]);
});
