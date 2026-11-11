import {randomUUID} from 'node:crypto';
import {expect,it} from 'vitest';
import {KREILE_TENANT_SLUG} from '@/lib/tenant';
import {sql,full,withSession,createFixture} from './replayHarness';
import {customerFixture,readyInvoiceOrder} from './orderFixture';

it('S20 search finds the actual contact person with a grounded match without changing data',async()=>{
 const customerId=await customerFixture('S20'),needle='TEST Buchhaltung '+randomUUID();
 const {updateCustomerAction}=await import('@/app/actions/customers.actions');
 expect(await withSession(full,()=>updateCustomerAction({customerId,clientEventId:randomUUID(),contactPerson:needle}))).toMatchObject({code:'OK'});
 const before=await sql`SELECT count(*)::integer AS n FROM public.events WHERE tenant_id=${KREILE_TENANT_SLUG}`;
 const {searchTenantAction}=await import('@/app/actions/search.actions');
 expect(await withSession(full,()=>searchTenantAction(needle))).toMatchObject({code:'OK',hits:expect.arrayContaining([expect.objectContaining({type:'CUSTOMER',id:customerId,matchField:'contactPerson',matchValue:needle})])});
 const worker=await createFixture(['auftraege'],'werkstatt');
 const restricted=await withSession(worker,()=>searchTenantAction(needle));
 // Operational search already permits customer lookup without Kunden editing rights.
 expect(restricted).toMatchObject({code:'OK',hits:expect.arrayContaining([expect.objectContaining({type:'CUSTOMER',id:customerId,matchField:'contactPerson',matchValue:needle})])});
 expect(await sql`SELECT count(*)::integer AS n FROM public.events WHERE tenant_id=${KREILE_TENANT_SLUG}`).toEqual(before);
});

async function searchOrderFixture(label:string,customerId:string){
 const {createOrderIntakeAction}=await import('@/app/actions/eingang.actions');
 const created=await withSession(full,()=>createOrderIntakeAction({geprueft:true,clientEventId:randomUUID(),customer:{mode:'EXISTING',customerId},dueDate:'2027-05-15',termStatus:'bestaetigt',intakeSource:'persoenlich',handoverMode:'pickup',paymentMode:'rechnung',note:'TEST '+label,items:[{catalogServiceId:null,name:'TEST '+label+' Teil',quantity:1,material:'Messing',surfaceRequested:'Verchromen',executionRequested:'offen',unit:'Stück',unitPriceCents:10000,vatRateBasisPoints:1900}]}));
 expect(created.code).toBe('OK');if(created.code!=='OK')throw Error('SEARCH_INITIAL_ORDER:'+created.code);
 return created;
}

it('S22 exact customer email remains a proven customer hit instead of disappearing after the read port',async()=>{
 const customerId=await customerFixture('S22');
 const email='TEST-'+customerId+'@example.invalid';
 const {searchTenantAction}=await import('@/app/actions/search.actions');
 const before=await sql`SELECT count(*)::integer AS n FROM public.events WHERE tenant_id=${KREILE_TENANT_SLUG}`;
 expect(await withSession(full,()=>searchTenantAction(email))).toMatchObject({code:'OK',hits:expect.arrayContaining([expect.objectContaining({type:'CUSTOMER',id:customerId,matchField:'email',matchValue:email})])});
 expect(await sql`SELECT email FROM public.customers WHERE tenant_id=${KREILE_TENANT_SLUG} AND id=${customerId}`).toEqual([{email}]);
 expect(await sql`SELECT count(*)::integer AS n FROM public.events WHERE tenant_id=${KREILE_TENANT_SLUG}`).toEqual(before);
});

it('S23/S31 actual order dates and surface prefixes stay grounded in the stored order',async()=>{
 const customerId=await customerFixture('S23-S31');
 const created=await searchOrderFixture('S23-S31',customerId);
 const {searchTenantAction}=await import('@/app/actions/search.actions');
 const before=await sql`SELECT count(*)::integer AS n FROM public.events WHERE tenant_id=${KREILE_TENANT_SLUG}`;
 for(const query of ['15.05.2027','2027-05-15'])expect(await withSession(full,()=>searchTenantAction(query))).toMatchObject({code:'OK',hits:expect.arrayContaining([expect.objectContaining({type:'ORDER',id:created.receipt.orderId,matchField:'dueDate',matchValue:query})])});
 expect(await withSession(full,()=>searchTenantAction('ver'))).toMatchObject({code:'OK',hits:expect.arrayContaining([expect.objectContaining({type:'ORDER',id:created.receipt.orderId,matchField:'surface',matchValue:'Verchromen'})])});
 expect(await sql`SELECT due_date::date::text AS due_date FROM public.orders WHERE tenant_id=${KREILE_TENANT_SLUG} AND id=${created.receipt.orderId}`).toEqual([{due_date:'2027-05-15'}]);
 expect(await sql`SELECT count(*)::integer AS n FROM public.events WHERE tenant_id=${KREILE_TENANT_SLUG}`).toEqual(before);
});

it('S17 stored part instructions are searchable with their original evidence',async()=>{
 const customerId=await customerFixture('S17');
 const {createOrderIntakeAction}=await import('@/app/actions/eingang.actions');
 const note='TEST Gewinde M6 abdecken '+randomUUID();
 const created=await withSession(full,()=>createOrderIntakeAction({geprueft:true,clientEventId:randomUUID(),customer:{mode:'EXISTING',customerId},dueDate:'2027-05-15',termStatus:'bestaetigt',intakeSource:'persoenlich',handoverMode:'pickup',paymentMode:'rechnung',note,items:[{catalogServiceId:null,name:'TEST Griffe',quantity:1,material:'Messing',surfaceRequested:'Verchromen',executionRequested:'offen',unit:'Stück',unitPriceCents:10000,vatRateBasisPoints:1900}]}));
 if(created.code!=='OK')throw Error('S17_INTAKE:'+created.code);
 const before=await sql`SELECT count(*)::integer AS n FROM public.events WHERE tenant_id=${KREILE_TENANT_SLUG}`;
 const {searchTenantAction}=await import('@/app/actions/search.actions');
 expect(await withSession(full,()=>searchTenantAction('Gewinde M6'))).toMatchObject({code:'OK',hits:expect.arrayContaining([expect.objectContaining({type:'ORDER',id:created.receipt.orderId,matchField:'partNote',matchValue:note})])});
 expect(await sql`SELECT internal_notes FROM public.items WHERE tenant_id=${KREILE_TENANT_SLUG} AND order_id=${created.receipt.orderId}`).toEqual([{internal_notes:note}]);
 expect(await sql`SELECT count(*)::integer AS n FROM public.events WHERE tenant_id=${KREILE_TENANT_SLUG}`).toEqual(before);
});

it('search preserves proven order hits when a separate customer source cannot read an isolated legacy row',async()=>{
 // Keep the intentional corrupt phone local to this probe: later 040/000000
 // searches must not randomly match zero-bearing clock digits in its fixture.
 const needle='49'+randomUUID().replace(/[^1-9]/g,'');
 const customerId=await customerFixture('PARTIAL');
 const order=await searchOrderFixture(needle,customerId);
 // Explicit malformed historical TEST data, not a DB/auth mock or production mutation.
 await sql`INSERT INTO public.customers(id,tenant_id,name,company_name,type,phone,source) VALUES(${'TEST-unreadable-'+randomUUID()},${KREILE_TENANT_SLUG},'',NULL,'business',${'+'+needle},'manual')`;
 const {searchTenantAction}=await import('@/app/actions/search.actions');
 const found=await withSession(full,()=>searchTenantAction(needle));
 expect(found).toMatchObject({code:'OK',hits:expect.arrayContaining([expect.objectContaining({type:'ORDER',id:order.receipt.orderId})]),failedSources:['Kundenstamm'],coverage:{truncated:true}});
 if(found.code!=='OK')throw Error('PARTIAL_SEARCH:'+found.code);
 expect(found.checkedSources).toContain('Auftragsbestand');
 expect(found.checkedSources).not.toContain('Kundenstamm');
 expect(found.hits.some(hit=>hit.type==='CUSTOMER')).toBe(false);
});

it('search preserves the customer hit and reports incomplete coverage when an actual legacy order cannot be read',async()=>{
 const needle='TEST Altauftrag '+randomUUID();
 const customerId=await customerFixture(needle);
 const order=await searchOrderFixture('TEST beschädigtes Altdatum',customerId);
 const [original]=await sql`SELECT title FROM public.orders WHERE tenant_id=${KREILE_TENANT_SLUG} AND id=${order.receipt.orderId}`;
 // Isolated historical TEST state, with the real DB guards still enabled.
 try {
 await sql`UPDATE public.orders SET title='' WHERE tenant_id=${KREILE_TENANT_SLUG} AND id=${order.receipt.orderId}`;
 const before=await sql`SELECT count(*)::integer AS n FROM public.events WHERE tenant_id=${KREILE_TENANT_SLUG}`;
 const {searchTenantAction}=await import('@/app/actions/search.actions');
 const result=await withSession(full,()=>searchTenantAction(needle));
 expect(result).toMatchObject({code:'OK',hits:expect.arrayContaining([expect.objectContaining({type:'CUSTOMER',id:customerId})]),failedSources:['Auftragsbestand'],coverage:{truncated:true}});
 if(result.code!=='OK')throw Error('SEARCH_PARTIAL_ORDER:'+result.code);
 expect(result.checkedSources).toContain('Kundenstamm');
 expect(result.checkedSources).not.toContain('Auftragsbestand');
 expect(result.hits.some(hit=>hit.type==='ORDER')).toBe(false);
 expect(await sql`SELECT title FROM public.orders WHERE tenant_id=${KREILE_TENANT_SLUG} AND id=${order.receipt.orderId}`).toEqual([{title:''}]);
 expect(await sql`SELECT count(*)::integer AS n FROM public.events WHERE tenant_id=${KREILE_TENANT_SLUG}`).toEqual(before);
 } finally {
  await sql`UPDATE public.orders SET title=${original.title} WHERE tenant_id=${KREILE_TENANT_SLUG} AND id=${order.receipt.orderId}`;
 }
});

it('S5/S6 search exact stored order and customer numbers through the actual action without creating data',async()=>{
 const customerId=await customerFixture('S5-S6');
 const created=await searchOrderFixture('S5-S6',customerId);
 const {searchTenantAction}=await import('@/app/actions/search.actions');
 const {getCustomerSummaryAction}=await import('@/app/actions/customers.actions');
 const customer=await withSession(full,()=>getCustomerSummaryAction({customerId}));
 expect(customer.code).toBe('OK');if(customer.code!=='OK'||!customer.data.customerNumber)throw Error('S6_CUSTOMER_NUMBER');
 const before=await sql`SELECT (SELECT count(*)::integer FROM public.orders WHERE tenant_id=${KREILE_TENANT_SLUG}) AS orders,(SELECT count(*)::integer FROM public.events WHERE tenant_id=${KREILE_TENANT_SLUG}) AS events`;
 const order=await withSession(full,()=>searchTenantAction(created.receipt.orderNumber));
 expect(order).toMatchObject({code:'OK',hits:expect.arrayContaining([expect.objectContaining({type:'ORDER',id:created.receipt.orderId,matchField:'orderNumber'})])});
 const found=await withSession(full,()=>searchTenantAction(customer.data.customerNumber!));
 expect(found).toMatchObject({code:'OK',hits:expect.arrayContaining([expect.objectContaining({type:'CUSTOMER',id:customerId,matchField:'customerNumber'})])});
 expect(await sql`SELECT (SELECT count(*)::integer FROM public.orders WHERE tenant_id=${KREILE_TENANT_SLUG}) AS orders,(SELECT count(*)::integer FROM public.events WHERE tenant_id=${KREILE_TENANT_SLUG}) AS events`).toEqual(before);
});

it('S7 chrom is grounded in the actual stored part surface and never invents a customer relation',async()=>{
 const customerId=await customerFixture('S7');
 const created=await searchOrderFixture('S7',customerId);
 const {searchTenantAction}=await import('@/app/actions/search.actions');
 const result=await withSession(full,()=>searchTenantAction('chrom'));
 expect(result,JSON.stringify(result)).toMatchObject({code:'OK',hits:expect.arrayContaining([expect.objectContaining({type:'ORDER',id:created.receipt.orderId,matchField:'surface'})])});
 expect(await sql`SELECT surface_requested FROM public.items WHERE tenant_id=${KREILE_TENANT_SLUG} AND order_id=${created.receipt.orderId}`).toEqual([{surface_requested:'verchromen'}]);
});

it('S11 actual issued invoice is searchable with Geld and absent from hits and searched sources without Geld',async()=>{
 const ready=await readyInvoiceOrder('S11');
 const {searchTenantAction}=await import('@/app/actions/search.actions');
 expect(await withSession(full,()=>searchTenantAction(ready.invoice.invoiceNumber)))
  .toMatchObject({code:'OK',hits:expect.arrayContaining([expect.objectContaining({type:'INVOICE',id:ready.invoice.invoiceId})])});
 const worker=await createFixture(['auftraege'],'werkstatt');
 const restricted=await withSession(worker,()=>searchTenantAction(ready.invoice.invoiceNumber));
 expect(restricted).toMatchObject({code:'OK',hits:[]});
 if(restricted.code!=='OK')throw Error('S11_RESTRICTED_SEARCH:'+restricted.code);
 expect(restricted.checkedSources).not.toContain('Rechnungen');
 expect(restricted.checkedSources).not.toContain('Mails');
 expect(JSON.stringify(restricted.hits)).not.toContain(ready.invoice.invoiceId);
});

it('S10 no match returns an honest empty result and writes no order or event',async()=>{
 const {searchTenantAction}=await import('@/app/actions/search.actions');
 const before=await sql`SELECT (SELECT count(*)::integer FROM public.orders WHERE tenant_id=${KREILE_TENANT_SLUG}) AS orders,(SELECT count(*)::integer FROM public.events WHERE tenant_id=${KREILE_TENANT_SLUG}) AS events`;
 expect(await withSession(full,()=>searchTenantAction('TEST-Zylinder-'+randomUUID())))
  .toMatchObject({code:'OK',hits:[],coverage:{returnedHits:0,matchingHitsAtLeast:0,truncated:false}});
 expect(await sql`SELECT (SELECT count(*)::integer FROM public.orders WHERE tenant_id=${KREILE_TENANT_SLUG}) AS orders,(SELECT count(*)::integer FROM public.events WHERE tenant_id=${KREILE_TENANT_SLUG}) AS events`).toEqual(before);
});

it('S9 city matches only actual customers of this tenant',async()=>{
 const own=[await customerFixture('S9-N'),await customerFixture('S9-C')];
 const other=await customerFixture('S9-B');
 const foreign=randomUUID();
 const {updateCustomerAction}=await import('@/app/actions/customers.actions');
 for(const customerId of own)expect(await withSession(full,()=>updateCustomerAction({customerId,clientEventId:randomUUID(),city:'Hamburg'}))).toMatchObject({code:'OK'});
 // A separate synthetic initial fixture, never a tenant change to an existing row.
 await sql`INSERT INTO public.customers(id,tenant_id,customer_number,name,company_name,type,contact_person,email,phone,street,house_number,zip_code,city,country,payment_preference,ziel_freigeschaltet,ziel_tage,source,first_name,last_name,salutation)
 SELECT ${foreign},${'TEST-foreign-'+foreign.slice(0,18)},customer_number,name,company_name,type,contact_person,${'TEST-'+foreign+'@example.invalid'},phone,street,house_number,zip_code,'Hamburg',country,payment_preference,ziel_freigeschaltet,ziel_tage,source,first_name,last_name,salutation FROM public.customers WHERE tenant_id=${KREILE_TENANT_SLUG} AND id=${own[0]}`;
 const {searchTenantAction}=await import('@/app/actions/search.actions');
 const found=await withSession(full,()=>searchTenantAction('Hamburg'));
 expect(found.code).toBe('OK');if(found.code!=='OK')throw Error('S9_SEARCH:'+found.code);
 expect(found.hits.filter(row=>row.type==='CUSTOMER').map(row=>row.id).sort()).toEqual([...own].sort());
 expect(found.hits.some(row=>row.id===foreign||row.id===other)).toBe(false);
});

const goldenCustomers=new Map<string,string>();

it('S34 actual customer search normalizes the stored German phone prefix without writing a record',async()=>{
 const customerId=await customerFixture('S34');
 const {updateCustomerAction}=await import('@/app/actions/customers.actions');
 expect(await withSession(full,()=>updateCustomerAction({customerId,clientEventId:randomUUID(),companyName:'TEST Nord GmbH',phone:'+49 40 000000'}))).toMatchObject({code:'OK'});
 const {searchTenantAction}=await import('@/app/actions/search.actions');
 const before=await sql`SELECT count(*)::integer AS n FROM public.events WHERE tenant_id=${KREILE_TENANT_SLUG}`;
 const found=await withSession(full,()=>searchTenantAction('040 000000'));
 expect(found,JSON.stringify(found)).toMatchObject({code:'OK',hits:expect.arrayContaining([expect.objectContaining({type:'CUSTOMER',id:customerId,matchField:'phone'})])});
 expect(await sql`SELECT count(*)::integer AS n FROM public.events WHERE tenant_id=${KREILE_TENANT_SLUG}`).toEqual(before);
});

it('S55 actual multiword search combines customer and part as AND instead of unrelated OR hits',async()=>{
 const nord=await customerFixture('Nord'),other=await customerFixture('Ost');
 const matched=await searchOrderFixture('Leisten',nord);
 const wrongPart=await searchOrderFixture('Schrauben',nord);
 const wrongCustomer=await searchOrderFixture('Leisten',other);
 const {searchTenantAction}=await import('@/app/actions/search.actions');
 const found=await withSession(full,()=>searchTenantAction('Nord Leisten'));
 expect(found.code).toBe('OK');if(found.code!=='OK')throw Error('S55_SEARCH:'+found.code);
 const orders=found.hits.filter(hit=>hit.type==='ORDER');
 expect(orders.map(hit=>hit.id)).toEqual([matched.receipt.orderId]);
 expect(orders.some(hit=>hit.id===wrongPart.receipt.orderId||hit.id===wrongCustomer.receipt.orderId)).toBe(false);
});
it.each([
 ['S1','Schmitt',['TEST Reiner Schmitt','TEST Sabrina Schmidt','TEST Schmied Metallbau GmbH']],
 ['S2','Schmdit',['TEST Reiner Schmitt','TEST Sabrina Schmidt','TEST Schmied Metallbau GmbH']],
 ['S3','Mayr',['TEST Maier Oberflächen AG']],
] as const)('%s actual customer search finds the specified phonetic or spelling alternatives for %s',async(caseId,query,names)=>{
 const ids:string[]=[];
 const {updateCustomerAction}=await import('@/app/actions/customers.actions');
 for(const [index,name] of names.entries()){
  let customerId=goldenCustomers.get(name);
  if(!customerId){
   customerId=await customerFixture(caseId+'-'+index);
   expect(await withSession(full,()=>updateCustomerAction({customerId:customerId!,clientEventId:randomUUID(),companyName:name}))).toMatchObject({code:'OK'});
   goldenCustomers.set(name,customerId);
  }
  ids.push(customerId);
 }
 const {searchTenantAction}=await import('@/app/actions/search.actions');
 const found=await withSession(full,()=>searchTenantAction(query));
 expect(found.code).toBe('OK');if(found.code!=='OK')throw Error(caseId+'_SEARCH:'+found.code);
 expect(found.hits.filter(hit=>hit.type==='CUSTOMER').map(hit=>hit.id).sort()).toEqual([...ids].sort());
});

it('S4 actual search finds Kunde Süd from Sued and ignores the legal form without inventing a customer',async()=>{
 const customerId=await customerFixture('S4');
 const {updateCustomerAction,getCustomerSummaryAction}=await import('@/app/actions/customers.actions');
 const changed=await withSession(full,()=>updateCustomerAction({customerId,clientEventId:randomUUID(),companyName:'TEST Kunde Süd KG'}));
 expect(changed).toMatchObject({code:'OK'});
 expect(await sql`SELECT company_name FROM public.customers WHERE tenant_id=${KREILE_TENANT_SLUG} AND id=${customerId}`).toEqual([{company_name:'TEST Kunde Süd KG'}]);
 expect(await withSession(full,()=>getCustomerSummaryAction({customerId}))).toMatchObject({code:'OK'});
 const {searchTenantAction}=await import('@/app/actions/search.actions');
 const beforeSearch=await sql`SELECT count(*)::integer AS n FROM public.customers WHERE tenant_id=${KREILE_TENANT_SLUG}`;
 const searched=await withSession(full,()=>searchTenantAction('Kunde Sued'));
 expect(searched,JSON.stringify(searched)).toMatchObject({code:'OK',hits:expect.arrayContaining([expect.objectContaining({type:'CUSTOMER',id:customerId})])});
 expect(await sql`SELECT count(*)::integer AS n FROM public.customers WHERE tenant_id=${KREILE_TENANT_SLUG} AND id=${customerId}`).toEqual([{n:1}]);
 expect(await sql`SELECT count(*)::integer AS n FROM public.customers WHERE tenant_id=${KREILE_TENANT_SLUG}`).toEqual(beforeSearch);
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
