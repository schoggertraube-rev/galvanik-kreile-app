import {randomUUID} from 'node:crypto';
import {expect,it} from 'vitest';
import {KREILE_TENANT_SLUG} from '@/lib/tenant';
import {sql,full,withSession,createFixture} from './replayHarness';
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

it('search exposes the operational quote but no money without Geld, while the authorized login sees its amount',async()=>{
 const customerId=await customerFixture('S-money');
 const {createQuoteAction}=await import('@/app/actions/quotes.actions');
 const created=await withSession(full,()=>createQuoteAction({clientEventId:randomUUID(),customerId,dueDate:'2027-05-15',note:'TEST price visibility',positions:[{name:'TEST confidential quote part',quantity:1,material:'Messing',surfaceRequested:'verchromen',unitPriceCents:137019,lineTotalCents:137019}]}));
 expect(created.code).toBe('OK');if(created.code!=='OK')throw Error('SEARCH_QUOTE_CREATE:'+created.code);
 const {searchTenantAction}=await import('@/app/actions/search.actions');
 const authorized=await withSession(full,()=>searchTenantAction(created.quote.quoteNumber));
 expect(authorized).toMatchObject({code:'OK',hits:expect.arrayContaining([expect.objectContaining({type:'QUOTE',id:created.quote.quoteId,context:expect.stringContaining('137019')})])});
 const worker=await createFixture(['auftraege'],'werkstatt');
 const restricted=await withSession(worker,()=>searchTenantAction(created.quote.quoteNumber));
 expect(restricted).toMatchObject({code:'OK',hits:expect.arrayContaining([expect.objectContaining({type:'QUOTE',id:created.quote.quoteId})])});
 expect(JSON.stringify(restricted)).not.toContain('137019');
});

it('search reads mail text only for a login with Mails',async()=>{
 const customerId=await customerFixture('S-mail'),threadId=randomUUID(),messageId=randomUUID(),needle='TEST-privat-'+randomUUID();
 // Explicit synthetic initial correspondence; the tested boundary is the real search Action/Auth/DB.
 await sql`INSERT INTO public.communication_threads(id,tenant_id,customer_id,source,subject,status,priority,category,created_by) VALUES(${threadId}::uuid,${KREILE_TENANT_SLUG},${customerId},'manual',${needle},'open','normal','general',${full.actorId}::uuid)`;
 await sql`INSERT INTO public.communication_messages(id,tenant_id,thread_id,direction,channel,body,created_by) VALUES(${messageId}::uuid,${KREILE_TENANT_SLUG},${threadId}::uuid,'incoming','email',${needle},${full.actorId}::uuid)`;
 const {searchTenantAction}=await import('@/app/actions/search.actions');
 expect(await withSession(full,()=>searchTenantAction(needle))).toMatchObject({code:'OK',hits:expect.arrayContaining([expect.objectContaining({type:'MAIL',id:threadId})])});
 const worker=await createFixture(['auftraege'],'werkstatt');
 const hidden=await withSession(worker,()=>searchTenantAction(needle));
 expect(hidden).toMatchObject({code:'OK',hits:[]});
 if(hidden.code==='OK')expect(JSON.stringify(hidden.hits)).not.toContain(needle);
});
