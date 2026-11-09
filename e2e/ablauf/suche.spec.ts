import {randomUUID} from 'node:crypto';
import {expect,it} from 'vitest';
import {KREILE_TENANT_SLUG} from '@/lib/tenant';
import {sql,full,withSession} from './replayHarness';
import {customerFixture} from './orderFixture';

it('S4 actual search finds Kunde Süd from Sued and ignores the legal form without inventing a customer',async()=>{
 const customerId=await customerFixture('S4');
 const {updateCustomerAction,getCustomerSummaryAction}=await import('@/app/actions/customers.actions');
 const changed=await withSession(full,()=>updateCustomerAction({customerId,clientEventId:randomUUID(),companyName:'TEST Kunde Süd KG'}));
 expect(changed).toMatchObject({code:'OK'});
 expect(await sql`SELECT company_name FROM public.customers WHERE tenant_id=${KREILE_TENANT_SLUG} AND id=${customerId}`).toEqual([{company_name:'TEST Kunde Süd KG'}]);
 expect(await withSession(full,()=>getCustomerSummaryAction({customerId}))).toMatchObject({code:'OK'});
 const {searchTenantAction}=await import('@/app/actions/search.actions');
 const searched=await withSession(full,()=>searchTenantAction('Kunde Sued'));
 expect(searched,JSON.stringify(searched)).toMatchObject({code:'OK',hits:expect.arrayContaining([expect.objectContaining({type:'CUSTOMER',id:customerId})])});
 expect(await sql`SELECT count(*)::integer AS n FROM public.customers WHERE tenant_id=${KREILE_TENANT_SLUG}`).toEqual([{n:1}]);
});
