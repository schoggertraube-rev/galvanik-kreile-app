import {randomUUID} from 'node:crypto';
import {expect,it} from 'vitest';
import {KREILE_TENANT_SLUG} from '@/lib/tenant';
import {sql,full,withSession,createFixture} from './replayHarness';

it('customer metrics read actual paid invoices once, isolate customers and hide finance without Geld',async()=>{
 const {readyInvoiceOrder}=await import('./orderFixture');
 const {getCustomerSummaryAction}=await import('@/app/actions/customers.actions');
 const {confirmPaymentAction}=await import('@/app/actions/payments.actions');
 const first=await readyInvoiceOrder('Kennzahl-1');
 expect(await withSession(full,()=>getCustomerSummaryAction({customerId:first.customerId}))).toMatchObject({code:'OK',data:{classification:null,kennzahlen:{averagePaymentDays:{id:'KZ-ZAHLUNGSDAUER',value:null,invoiceCount:0},classification:{value:null,state:'missing_thresholds',reason:'Grenzen für die Einstufung eintragen'}}}});
 const payment={invoiceId:first.invoice.invoiceId,amount:first.invoice.grossAmountCents,method:'bar' as const,expectedVersion:0,clientEventId:randomUUID()};
 expect(await withSession(full,()=>confirmPaymentAction(payment))).toMatchObject({code:'OK'});
 const second=await readyInvoiceOrder('Kennzahl-2');
 expect(await withSession(full,()=>confirmPaymentAction({...payment,invoiceId:second.invoice.invoiceId,amount:second.invoice.grossAmountCents,clientEventId:randomUUID()}))).toMatchObject({code:'OK'});
 const operational=await createFixture(['kunden'],'werkstatt');
 const events=await sql`SELECT count(*)::integer AS n FROM public.events WHERE tenant_id=${KREILE_TENANT_SLUG}`;
 expect(await withSession(full,()=>getCustomerSummaryAction({customerId:first.customerId}))).toMatchObject({code:'OK',data:{kennzahlen:{period:{timeZone:'Europe/Berlin'},revenue:{id:'KZ-UMSATZ',netAmountCents:10000},openInvoices:{amountCents:0},averagePaymentDays:{value:0,invoiceCount:1},overdue:{invoiceCount:0,openAmountCents:0}}}});
 const restricted=await withSession(operational,()=>getCustomerSummaryAction({customerId:first.customerId}));
 expect(restricted.code).toBe('OK');if(restricted.code!=='OK')throw Error('METRIC_READ:'+restricted.code);
 expect(restricted.data.kennzahlen).not.toHaveProperty('averagePaymentDays');
 expect(restricted.data.kennzahlen).not.toHaveProperty('overdue');
 expect(restricted.data.kennzahlen).not.toHaveProperty('revenue');
 expect(restricted.data.kennzahlen).not.toHaveProperty('openInvoices');
 expect(restricted.data).not.toHaveProperty('invoiceRevenueCents');
 expect(await sql`SELECT classification FROM public.customers WHERE tenant_id=${KREILE_TENANT_SLUG} AND id=${first.customerId}`).toEqual([{classification:'B'}]);
 expect(await sql`SELECT count(*)::integer AS n FROM public.events WHERE tenant_id=${KREILE_TENANT_SLUG}`).toEqual(events);
 expect(await withSession(full,()=>confirmPaymentAction(JSON.parse(JSON.stringify(payment))))).toMatchObject({code:'OK',replayed:true});
 expect(await withSession(full,()=>getCustomerSummaryAction({customerId:first.customerId}))).toMatchObject({code:'OK',data:{kennzahlen:{averagePaymentDays:{value:0,invoiceCount:1}}}});
 const financeOnly=await createFixture(['geld']);
 expect(await withSession(financeOnly,()=>getCustomerSummaryAction({customerId:first.customerId}))).toMatchObject({code:'FORBIDDEN'});
});

it('editing visible customer notes without Geld never removes hidden financial or typed agreements',async()=>{
 const {createCustomerAction,saveCustomerAgreementAction,updateCustomerAction,getCustomerSummaryAction}=await import('@/app/actions/customers.actions');
 const created=await withSession(full,()=>createCustomerAction({clientEventId:randomUUID(),customerType:'business',companyName:'TEST verborgene Absprache '+randomUUID(),phone:'+49 711 5550190'}));if(created.code!=='OK')throw Error('ABS_HIDDEN_CUSTOMER:'+created.code);
 const customerId=created.receipt.customerId;
 expect(await withSession(full,()=>saveCustomerAgreementAction({clientKey:randomUUID(),customerId,type:'ausgabe_ohne_zahlung',reason:'TEST geschützte Zahlungsabsprache'}))).toMatchObject({code:'OK'});
 const entries=[{id:null,bezeichnung:'TEST Geldhinweis',wert:'TEST nur fürs Büro',geld:true,hinweis:true,gueltigBis:null},{id:null,bezeichnung:'TEST Verpackung',wert:'TEST alter Hinweis',geld:false,hinweis:true,gueltigBis:null}];
 expect(await withSession(full,()=>updateCustomerAction({customerId,clientEventId:randomUUID(),agreements:entries}))).toMatchObject({code:'OK'});
 const financial=await sql`SELECT id::text,position,bezeichnung,wert,version,widerrufen_am FROM public.customer_agreements WHERE tenant_id=${KREILE_TENANT_SLUG} AND customer_id=${customerId} AND geld ORDER BY id`;
 expect(financial).toHaveLength(2);
 const operational=await createFixture(['kunden'],'werkstatt');
 const read=await withSession(operational,()=>getCustomerSummaryAction({customerId}));if(read.code!=='OK')throw Error('ABS_HIDDEN_READ:'+read.code);
 expect(read.data.agreements).toHaveLength(1);
 const visible=read.data.agreements[0];
 const update={customerId,clientEventId:randomUUID(),agreements:[{id:visible.id,bezeichnung:visible.label,wert:'TEST neuer Verpackungshinweis',geld:false,hinweis:true,gueltigBis:visible.validUntil}]};
 expect(await withSession(operational,()=>updateCustomerAction(update))).toMatchObject({code:'OK'});
 expect(await withSession(operational,()=>getCustomerSummaryAction({customerId}))).toMatchObject({code:'OK',data:{agreements:[{id:visible.id,value:'TEST neuer Verpackungshinweis'}]}});
 expect(await withSession(operational,()=>updateCustomerAction(JSON.parse(JSON.stringify(update))))).toMatchObject({code:'OK',replayed:true});
 const remove={customerId,clientEventId:randomUUID(),agreements:[]};
 expect(await withSession(operational,()=>updateCustomerAction(remove))).toMatchObject({code:'OK'});
 const removed=await withSession(operational,()=>getCustomerSummaryAction({customerId}));
 expect(removed.code).toBe('OK');if(removed.code!=='OK')throw Error('ABS_HIDDEN_REMOVED:'+removed.code);
 expect(removed.data.agreements.filter(agreement=>agreement.revokedAt===null)).toEqual([]);
 expect(removed.data.agreements).toContainEqual(expect.objectContaining({id:visible.id,revokeReason:'aus Kundenkarte entfernt',revokedAt:expect.any(String)}));
 expect(await sql`SELECT id::text,position,bezeichnung,wert,version,widerrufen_am FROM public.customer_agreements WHERE tenant_id=${KREILE_TENANT_SLUG} AND customer_id=${customerId} AND geld ORDER BY id`).toEqual(financial);
 const office=await withSession(full,()=>getCustomerSummaryAction({customerId}));
 expect(office).toMatchObject({code:'OK',data:{agreements:expect.arrayContaining(financial.map(row=>expect.objectContaining({id:row.id})))}});
 for(const key of [update.clientEventId,remove.clientEventId])expect(await sql`SELECT user_id::text FROM public.events WHERE tenant_id=${KREILE_TENANT_SLUG} AND client_event_id=${key}::uuid`).toEqual([{user_id:operational.actorId}]);
});

it('rejected free-text agreement edits roll back every prior list change and preserve the same retry key',async()=>{
 const {createCustomerAction,updateCustomerAction,getCustomerSummaryAction}=await import('@/app/actions/customers.actions');
 const created=await withSession(full,()=>createCustomerAction({clientEventId:randomUUID(),customerType:'business',companyName:'TEST Absprachen atomar '+randomUUID(),phone:'+49 711 5550190'}));if(created.code!=='OK')throw Error('ABS_ATOMIC_CUSTOMER:'+created.code);
 const customerId=created.receipt.customerId;
 const entries=['A','B'].map(label=>({id:null,bezeichnung:'TEST Hinweis '+label,wert:'TEST Wert '+label,geld:false,hinweis:true,gueltigBis:null}));
 expect(await withSession(full,()=>updateCustomerAction({customerId,clientEventId:randomUUID(),agreements:entries}))).toMatchObject({code:'OK'});
 const before=await sql`SELECT id::text,position,bezeichnung,wert,version,widerrufen_am FROM public.customer_agreements WHERE tenant_id=${KREILE_TENANT_SLUG} AND customer_id=${customerId} ORDER BY position,id`;
 expect(before).toHaveLength(2);
 const key=randomUUID();
 const edit={customerId,clientEventId:key,notes:'TEST erst nach erfolgreichem Speichern',agreements:[{...entries[0],id:before[0].id,wert:'TEST geänderter Wert'},{...entries[1],id:randomUUID()}]};
 expect(await withSession(full,()=>updateCustomerAction(edit))).toMatchObject({code:'VALIDATION_ERROR'});
 expect(await sql`SELECT id::text,position,bezeichnung,wert,version,widerrufen_am FROM public.customer_agreements WHERE tenant_id=${KREILE_TENANT_SLUG} AND customer_id=${customerId} ORDER BY position,id`).toEqual(before);
 expect(await sql`SELECT count(*)::integer AS n FROM public.events WHERE tenant_id=${KREILE_TENANT_SLUG} AND client_event_id=${key}::uuid`).toEqual([{n:0}]);
 expect(await withSession(full,()=>getCustomerSummaryAction({customerId}))).toMatchObject({code:'OK',data:{agreements:expect.arrayContaining([expect.objectContaining({id:before[0].id,value:entries[0].wert}),expect.objectContaining({id:before[1].id,value:entries[1].wert})])}});
 const corrected={...edit,agreements:[edit.agreements[0],{...entries[1],id:before[1].id}]};
 expect(await withSession(full,()=>updateCustomerAction(corrected))).toMatchObject({code:'OK'});
 expect(await withSession(full,()=>getCustomerSummaryAction({customerId}))).toMatchObject({code:'OK',data:{agreements:expect.arrayContaining([expect.objectContaining({id:before[0].id,value:'TEST geänderter Wert'}),expect.objectContaining({id:before[1].id,value:entries[1].wert})])}});
 expect(await withSession(full,()=>updateCustomerAction(JSON.parse(JSON.stringify(corrected))))).toMatchObject({code:'OK',replayed:true});
 expect(await sql`SELECT user_id::text FROM public.events WHERE tenant_id=${KREILE_TENANT_SLUG} AND client_event_id=${key}::uuid`).toEqual([{user_id:full.actorId}]);
});

it('a former customer creation receipt cannot expose a contact later converted to supplier without Geld',async()=>{
 const {createCustomerAction,readCustomerCreateReceiptAction,updateCustomerAction}=await import('@/app/actions/customers.actions');
 const operational=await createFixture(['kunden','eingang'],'werkstatt');
 const input={clientEventId:randomUUID(),customerType:'business' as const,companyName:'TEST späterer Lieferant '+randomUUID(),phone:'+49 711 5550190'};
 const created=await withSession(operational,()=>createCustomerAction(input));
 expect(created,JSON.stringify(created)).toMatchObject({code:'OK'});if(created.code!=='OK')throw Error('SUPPLIER_REPLAY_CREATE:'+created.code);
 const customerId=created.receipt.customerId;
 expect(await withSession(operational,()=>readCustomerCreateReceiptAction(structuredClone(input)))).toMatchObject({code:'OK',customer:{customerType:'business'}});
 // The existing type-change form explicitly clears these four incompatible fields after confirmation.
 const converted=await withSession(full,()=>updateCustomerAction({customerId,clientEventId:randomUUID(),customerType:'lieferant',paymentPreference:null,vatId:null,billingEmail:null,handoverPreference:null}));
 expect(converted,JSON.stringify(converted)).toMatchObject({code:'OK',customer:{customerType:'lieferant'}});
 const before=await sql`SELECT count(*)::integer AS n FROM public.events WHERE tenant_id=${KREILE_TENANT_SLUG}`;
 const customerCountBefore=await sql`SELECT count(*)::integer AS n FROM public.customers WHERE tenant_id=${KREILE_TENANT_SLUG}`;
 expect(await withSession(operational,()=>createCustomerAction(JSON.parse(JSON.stringify(input))))).toMatchObject({code:'FORBIDDEN'});
 expect(await withSession(operational,()=>readCustomerCreateReceiptAction(structuredClone(input)))).toMatchObject({code:'FORBIDDEN'});
 expect(await sql`SELECT type FROM public.customers WHERE tenant_id=${KREILE_TENANT_SLUG} AND id=${customerId}`).toEqual([{type:'lieferant'}]);
 expect(await sql`SELECT count(*)::integer AS n FROM public.customers WHERE tenant_id=${KREILE_TENANT_SLUG} AND id=${customerId}`).toEqual([{n:1}]);
 expect(await sql`SELECT count(*)::integer AS n FROM public.customers WHERE tenant_id=${KREILE_TENANT_SLUG}`).toEqual(customerCountBefore);
 expect(await sql`SELECT count(*)::integer AS n FROM public.events WHERE tenant_id=${KREILE_TENANT_SLUG}`).toEqual(before);
});

it('malformed legacy customer lookups return validation instead of a thrown render error and valid lookup still works',async()=>{
 const {createCustomerAction,searchCustomersDb,getCustomerByIdDb}=await import('@/app/actions/customers.actions');
 const name='TEST Kunde Suchfehler '+randomUUID();
 const created=await withSession(full,()=>createCustomerAction({clientEventId:randomUUID(),customerType:'business',companyName:name,phone:'+49 711 5550190'}));if(created.code!=='OK')throw Error('LOOKUP_CREATE:'+created.code);
 const before=await sql`SELECT count(*)::integer AS n FROM public.events WHERE tenant_id=${KREILE_TENANT_SLUG}`;
 for(const value of [42,{},null]){
  expect(await withSession(full,()=>searchCustomersDb(value as unknown as string))).toMatchObject({ok:false,error:'VALIDATION_ERROR'});
  expect(await withSession(full,()=>getCustomerByIdDb(value as unknown as string))).toMatchObject({ok:false,error:'VALIDATION_ERROR'});
 }
 expect(await withSession(full,()=>searchCustomersDb(name))).toMatchObject({ok:true,data:expect.arrayContaining([expect.objectContaining({id:created.receipt.customerId})])});
 expect(await withSession(full,()=>getCustomerByIdDb(created.receipt.customerId))).toMatchObject({ok:true,data:{id:created.receipt.customerId}});
 expect(await sql`SELECT count(*)::integer AS n FROM public.events WHERE tenant_id=${KREILE_TENANT_SLUG}`).toEqual(before);
});

it('supplier visibility uses the same Geld boundary in list, search and direct customer readers',async()=>{
 const {createCustomerAction,getCustomersDb,searchCustomersDb,getCustomerByIdDb,getCustomerSummaryAction}=await import('@/app/actions/customers.actions');
 const name='TEST Lieferant Grenze '+randomUUID();
 const created=await withSession(full,()=>createCustomerAction({clientEventId:randomUUID(),customerType:'lieferant',companyName:name}));
 expect(created,JSON.stringify(created)).toMatchObject({code:'OK'});if(created.code!=='OK')throw Error('SUPPLIER_CREATE:'+created.code);
 const customerId=created.receipt.customerId;
 expect(await withSession(full,()=>searchCustomersDb(name))).toMatchObject({ok:true,data:expect.arrayContaining([expect.objectContaining({id:customerId,type:'lieferant'})])});
 expect(await withSession(full,()=>getCustomerByIdDb(customerId))).toMatchObject({ok:true,data:{id:customerId,type:'lieferant'}});
 const operational=await createFixture(['kunden'],'werkstatt');
 expect(await withSession(operational,()=>searchCustomersDb(name))).toMatchObject({ok:true,data:[]});
 expect(await withSession(operational,()=>getCustomerByIdDb(customerId))).toMatchObject({ok:true,data:null});
 expect(await withSession(operational,()=>getCustomerSummaryAction({customerId}))).toMatchObject({code:'NOT_FOUND'});
 const list=await withSession(operational,()=>getCustomersDb());
 expect(list.ok).toBe(true);if(!list.ok)throw Error('SUPPLIER_LIST:'+list.error);
 expect(list.data.some(customer=>customer.id===customerId)).toBe(false);
 const noCustomers=await createFixture(['auftraege']);
 expect(await withSession(noCustomers,()=>searchCustomersDb(name))).toMatchObject({ok:false,error:'FORBIDDEN'});
 expect(await withSession(noCustomers,()=>getCustomerByIdDb(customerId))).toMatchObject({ok:false,error:'FORBIDDEN'});
 expect(await sql`SELECT type FROM public.customers WHERE tenant_id=${KREILE_TENANT_SLUG} AND id=${customerId}`).toEqual([{type:'lieferant'}]);
});

it('ABS17 an order agreement overrides customer terms only for that order and revocation restores the same customer source',async()=>{
 const {createCustomerAction,saveCustomerAgreementAction,revokeCustomerAgreementAction}=await import('@/app/actions/customers.actions');
 const customer=await withSession(full,()=>createCustomerAction({clientEventId:randomUUID(),customerType:'business',companyName:'TEST Absprache Vorrang '+randomUUID(),salutation:'ohne',firstName:'TEST',lastName:'Kontakt',phone:'+49 711 5550190',email:'TEST-scope@example.invalid',street:'TEST Weg',houseNumber:'1',zipCode:'70176',city:'Stuttgart',country:'DE',paymentPreference:'bar'}));
 expect(customer,JSON.stringify(customer)).toMatchObject({code:'OK'});if(customer.code!=='OK')throw Error('ABS_SCOPE_CUSTOMER:'+customer.code);
 const customerId=customer.receipt.customerId;
 const {createOrderIntakeAction}=await import('@/app/actions/eingang.actions');
 const orders:string[]=[];
 for(const suffix of ['A','B']){
  const created=await withSession(full,()=>createOrderIntakeAction({geprueft:true,clientEventId:randomUUID(),customer:{mode:'EXISTING',customerId},dueDate:'2027-05-15',termStatus:'bestaetigt',intakeSource:'persoenlich',handoverMode:'pickup',paymentMode:'abholung',note:'TEST Absprache '+suffix,items:[{catalogServiceId:null,name:'TEST Teil '+suffix,quantity:1,material:'Messing',surfaceRequested:'Verchromen',executionRequested:'offen',unit:'Stück',unitPriceCents:10000,vatRateBasisPoints:1900}]}));
  expect(created,JSON.stringify(created)).toMatchObject({code:'OK'});if(created.code!=='OK')throw Error('ABS_SCOPE_ORDER:'+created.code);orders.push(created.receipt.orderId);
 }
 const general=await withSession(full,()=>saveCustomerAgreementAction({clientKey:randomUUID(),customerId,type:'zahlungsziel',targetDays:14,reason:'TEST Kundenziel'}));if(general.code!=='OK')throw Error('ABS_SCOPE_GENERAL:'+general.code);
 const input={clientKey:randomUUID(),customerId,orderId:orders[0],type:'sammelrechnung' as const,targetDays:30,reason:'TEST nur Auftrag A'};
 const specific=await withSession(full,()=>saveCustomerAgreementAction(input));if(specific.code!=='OK')throw Error('ABS_SCOPE_SPECIFIC:'+specific.code);
 const {getLiveOrderCardAction}=await import('@/app/actions/orders.actions');
 expect(await withSession(full,()=>getLiveOrderCardAction({orderId:orders[0]}))).toMatchObject({code:'OK',data:{card:{agreement:{id:specific.agreement.id,type:'sammelrechnung',orderId:orders[0]}}}});
 expect(await withSession(full,()=>getLiveOrderCardAction({orderId:orders[1]}))).toMatchObject({code:'OK',data:{card:{agreement:{id:general.agreement.id,type:'zahlungsziel',orderId:null}}}});
 const operational=await createFixture(['auftraege'],'werkstatt');
 expect(await withSession(operational,()=>getLiveOrderCardAction({orderId:orders[0]}))).toMatchObject({code:'OK',data:{card:{agreement:{id:specific.agreement.id}}}});
 const revoke={clientKey:randomUUID(),agreementId:specific.agreement.id,version:specific.agreement.version,reason:'TEST Auftragsabsprache zurückgenommen'};
 expect(await withSession(full,()=>revokeCustomerAgreementAction(revoke))).toMatchObject({code:'OK'});
 expect(await withSession(full,()=>getLiveOrderCardAction({orderId:orders[0]}))).toMatchObject({code:'OK',data:{card:{agreement:{id:general.agreement.id,type:'zahlungsziel'}}}});
 expect(await withSession(full,()=>revokeCustomerAgreementAction(JSON.parse(JSON.stringify(revoke))))).toMatchObject({code:'OK',replayed:true});
 expect(await sql`SELECT widerrufen_am IS NULL AS active FROM public.customer_agreements WHERE tenant_id=${KREILE_TENANT_SLUG} AND id=${general.agreement.id}::uuid`).toEqual([{active:true}]);
 expect(await sql`SELECT user_id::text FROM public.events WHERE tenant_id=${KREILE_TENANT_SLUG} AND client_event_id=${revoke.clientKey}::uuid`).toEqual([{user_id:full.actorId}]);
});

it('agreement validation and scope failures leave no row or event and the corrected request can reuse its key',async()=>{
 const {createCustomerAction,saveCustomerAgreementAction,getCustomerSummaryAction}=await import('@/app/actions/customers.actions');
 const customer=await withSession(full,()=>createCustomerAction({clientEventId:randomUUID(),customerType:'business',companyName:'TEST Absprache Fehlerwege '+randomUUID(),phone:'+49 711 5550190'}));
 if(customer.code!=='OK')throw Error('ABS_INVALID_CUSTOMER:'+customer.code);
 const customerId=customer.receipt.customerId;
 const base={customerId,type:'zahlungsziel' as const,targetDays:14,reason:'TEST gültiger Grund'};
 const cases=[{patch:{targetDays:0},code:'VALIDATION_ERROR'},{patch:{targetDays:121},code:'VALIDATION_ERROR'},{patch:{reason:'xy'},code:'VALIDATION_ERROR'},{patch:{validUntil:'2000-01-01'},code:'VALIDATION_ERROR'},{patch:{validUntil:'2026-02-30'},code:'VALIDATION_ERROR'},{patch:{version:99},code:'CONFLICT'},{patch:{customerId:'TEST-unbekannter-Kunde'},code:'NOT_FOUND'},{patch:{orderId:'TEST-unbekannter-Auftrag'},code:'NOT_FOUND'}];
 const keys:string[]=[];
 for(const testCase of cases){
  const clientKey=randomUUID();keys.push(clientKey);
  expect(await withSession(full,()=>saveCustomerAgreementAction({...base,...testCase.patch,clientKey}))).toMatchObject({code:testCase.code});
 }
 expect(await sql`SELECT count(*)::integer AS n FROM public.customer_agreements WHERE tenant_id=${KREILE_TENANT_SLUG} AND customer_id=${customerId}`).toEqual([{n:0}]);
 expect(await sql`SELECT count(*)::integer AS n FROM public.events WHERE tenant_id=${KREILE_TENANT_SLUG} AND client_event_id=ANY(${sql.array(keys)}::uuid[])`).toEqual([{n:0}]);
 expect(await withSession(full,()=>getCustomerSummaryAction({customerId}))).toMatchObject({code:'OK',data:{agreements:[]}});
 const repaired={...base,clientKey:keys[0]};
 const saved=await withSession(full,()=>saveCustomerAgreementAction(repaired));
 expect(saved).toMatchObject({code:'OK',agreement:{customerId,targetDays:14,createdBy:full.actorId}});if(saved.code!=='OK')throw Error('ABS_INVALID_REPAIR:'+saved.code);
 expect(await withSession(full,()=>getCustomerSummaryAction({customerId}))).toMatchObject({code:'OK',data:{agreements:expect.arrayContaining([expect.objectContaining({id:saved.agreement.id})])}});
 expect(await withSession(full,()=>saveCustomerAgreementAction(structuredClone(repaired)))).toMatchObject({code:'OK',replayed:true});
 expect(await sql`SELECT user_id::text FROM public.events WHERE tenant_id=${KREILE_TENANT_SLUG} AND client_event_id=${repaired.clientKey}::uuid`).toEqual([{user_id:full.actorId}]);
});

it('agreement retries cannot move customer or reason and an old replay never reactivates replaced financial terms',async()=>{
 const {createCustomerAction,saveCustomerAgreementAction,getCustomerSummaryAction}=await import('@/app/actions/customers.actions');
 const customers:string[]=[];
 for(const suffix of ['A','B']){
  const created=await withSession(full,()=>createCustomerAction({clientEventId:randomUUID(),customerType:'business',companyName:'TEST Absprache Schlüssel '+suffix+' '+randomUUID(),phone:'+49 711 5550190'}));
  if(created.code!=='OK')throw Error('ABS_KEY_CUSTOMER:'+created.code);customers.push(created.receipt.customerId);
 }
 const input={clientKey:randomUUID(),customerId:customers[0],type:'ausgabe_ohne_zahlung' as const,reason:'TEST ursprünglicher Grund'};
 const first=await withSession(full,()=>saveCustomerAgreementAction(input));if(first.code!=='OK')throw Error('ABS_KEY_INITIAL:'+first.code);
 for(const changed of [{...input,customerId:customers[1]},{...input,reason:'TEST anderer Grund'}])expect(await withSession(full,()=>saveCustomerAgreementAction(changed))).toMatchObject({code:'CONFLICT'});
 expect(await sql`SELECT count(*)::integer AS n FROM public.customer_agreements WHERE tenant_id=${KREILE_TENANT_SLUG} AND customer_id=${customers[1]}`).toEqual([{n:0}]);
 const update={clientKey:randomUUID(),customerId:customers[0],type:'zahlungsziel' as const,targetDays:14,reason:'TEST neue Absprache',version:first.agreement.version};
 const current=await withSession(full,()=>saveCustomerAgreementAction(update));if(current.code!=='OK')throw Error('ABS_KEY_UPDATE:'+current.code);
 expect(await withSession(full,()=>getCustomerSummaryAction({customerId:customers[0]}))).toMatchObject({code:'OK',data:{agreements:expect.arrayContaining([expect.objectContaining({id:current.agreement.id})])}});
 const oldReplay=await withSession(full,()=>saveCustomerAgreementAction(JSON.parse(JSON.stringify(input))));
 expect(oldReplay).toMatchObject({code:'OK',replayed:true,agreement:{id:first.agreement.id,revokedBy:full.actorId,version:2}});
 if(oldReplay.code!=='OK')throw Error('ABS_KEY_OLD_REPLAY:'+oldReplay.code);
 expect(oldReplay.agreement.revokedAt).not.toBeNull();
 expect(await sql`SELECT id::text FROM public.customer_agreements WHERE tenant_id=${KREILE_TENANT_SLUG} AND customer_id=${customers[0]} AND widerrufen_am IS NULL`).toEqual([{id:current.agreement.id}]);
 const operational=await createFixture(['kunden'],'werkstatt');
 const hidden=await withSession(operational,()=>getCustomerSummaryAction({customerId:customers[0]}));
 expect(hidden.code).toBe('OK');if(hidden.code!=='OK')throw Error('ABS_KEY_HIDDEN:'+hidden.code);
 expect(hidden.data.agreements.some(agreement=>agreement.money)).toBe(false);
 for(const key of [input.clientKey,update.clientKey])expect(await sql`SELECT user_id::text FROM public.events WHERE tenant_id=${KREILE_TENANT_SLUG} AND client_event_id=${key}::uuid`).toEqual([{user_id:full.actorId}]);
});

it('concurrent agreement replacements on one version keep one winner and preserve the superseded agreement as history',async()=>{
 const {createCustomerAction,saveCustomerAgreementAction,getCustomerSummaryAction}=await import('@/app/actions/customers.actions');
 const customer=await withSession(full,()=>createCustomerAction({clientEventId:randomUUID(),customerType:'business',companyName:'TEST Absprache parallel '+randomUUID(),phone:'+49 711 5550190'}));
 if(customer.code!=='OK')throw Error('ABS_RACE_CUSTOMER:'+customer.code);
 const customerId=customer.receipt.customerId;
 const initial=await withSession(full,()=>saveCustomerAgreementAction({clientKey:randomUUID(),customerId,type:'ausgabe_ohne_zahlung',reason:'TEST ursprüngliche Absprache'}));
 if(initial.code!=='OK')throw Error('ABS_RACE_INITIAL:'+initial.code);
 const updates=[7,14].map(targetDays=>({clientKey:randomUUID(),customerId,type:'zahlungsziel' as const,targetDays,reason:'TEST Ziel '+targetDays,version:initial.agreement.version}));
 const results=await Promise.all(updates.map(input=>withSession(full,()=>saveCustomerAgreementAction(structuredClone(input)))));
 expect(results.map(result=>result.code).sort()).toEqual(['CONFLICT','OK']);
 const index=results.findIndex(result=>result.code==='OK'),winner=results[index];if(winner.code!=='OK')throw Error('ABS_RACE_WINNER');
 expect(winner.agreement.version).toBe(initial.agreement.version+1);
 expect(await withSession(full,()=>getCustomerSummaryAction({customerId}))).toMatchObject({code:'OK',data:{agreements:expect.arrayContaining([expect.objectContaining({id:winner.agreement.id,targetDays:updates[index].targetDays})])}});
 expect(await withSession(full,()=>saveCustomerAgreementAction(JSON.parse(JSON.stringify(updates[index]))))).toMatchObject({code:'OK',replayed:true,agreement:{id:winner.agreement.id,version:winner.agreement.version}});
 expect(await sql`SELECT id::text,version FROM public.customer_agreements WHERE tenant_id=${KREILE_TENANT_SLUG} AND customer_id=${customerId} AND widerrufen_am IS NULL`).toEqual([{id:winner.agreement.id,version:initial.agreement.version+1}]);
 expect(await sql`SELECT widerrufen_von::text,version FROM public.customer_agreements WHERE tenant_id=${KREILE_TENANT_SLUG} AND id=${initial.agreement.id}::uuid`).toEqual([{widerrufen_von:full.actorId,version:initial.agreement.version+1}]);
 expect(await sql`SELECT count(*)::integer AS n FROM public.customer_agreements WHERE tenant_id=${KREILE_TENANT_SLUG} AND customer_id=${customerId}`).toEqual([{n:2}]);
 expect(await sql`SELECT client_event_id::text,user_id::text FROM public.events WHERE tenant_id=${KREILE_TENANT_SLUG} AND client_event_id=ANY(${sql.array(updates.map(input=>input.clientKey))}::uuid[])`).toEqual([{client_event_id:updates[index].clientKey,user_id:full.actorId}]);
});

it('ABS02 actual agreement save and revoke retain actor and receipt across customer rereads and fresh retries',async()=>{
 const {createCustomerAction,getCustomerSummaryAction,saveCustomerAgreementAction,revokeCustomerAgreementAction}=await import('@/app/actions/customers.actions');
 const created=await withSession(full,()=>createCustomerAction({clientEventId:randomUUID(),customerType:'business',companyName:'TEST Absprache '+randomUUID(),phone:'+49 711 5550190'}));
 if(created.code!=='OK')throw Error('ABS_CUSTOMER:'+created.code);
 const customerId=created.receipt.customerId;
 const input={clientKey:randomUUID(),customerId,type:'ausgabe_ohne_zahlung' as const,reason:'TEST Rechnung folgt'};
 const saved=await withSession(full,()=>saveCustomerAgreementAction(input));
 expect(saved).toMatchObject({code:'OK',agreement:{customerId,type:input.type,createdBy:full.actorId,version:1}});if(saved.code!=='OK')throw Error('ABS_SAVE:'+saved.code);
 expect(await withSession(full,()=>getCustomerSummaryAction({customerId}))).toMatchObject({code:'OK',data:{agreements:expect.arrayContaining([expect.objectContaining({id:saved.agreement.id,type:input.type})])}});
 expect(await withSession(full,()=>saveCustomerAgreementAction(JSON.parse(JSON.stringify(input))))).toMatchObject({code:'OK',replayed:true,agreement:{id:saved.agreement.id}});
 const denied=await createFixture(['kunden']);
 expect(await withSession(denied,()=>revokeCustomerAgreementAction({agreementId:saved.agreement.id,clientKey:randomUUID(),version:1,reason:'TEST nicht erlaubt'}))).toMatchObject({code:'FORBIDDEN'});
 const revoke={agreementId:saved.agreement.id,clientKey:randomUUID(),version:1,reason:'TEST Absprache beendet'};
 const revoked=await withSession(full,()=>revokeCustomerAgreementAction(revoke));
 expect(revoked).toMatchObject({code:'OK',agreement:{id:saved.agreement.id,version:2,revokedBy:full.actorId,revokeReason:revoke.reason}});
 expect(await sql`SELECT version,widerrufen_von::text,widerruf_grund FROM public.customer_agreements WHERE tenant_id=${KREILE_TENANT_SLUG} AND id=${saved.agreement.id}::uuid`).toEqual([{version:2,widerrufen_von:full.actorId,widerruf_grund:revoke.reason}]);
 expect(await withSession(full,()=>getCustomerSummaryAction({customerId}))).toMatchObject({code:'OK'});
 expect(await withSession(full,()=>revokeCustomerAgreementAction(structuredClone(revoke)))).toMatchObject({code:'OK',replayed:true,agreement:{id:saved.agreement.id,version:2}});
 for(const key of [input.clientKey,revoke.clientKey])expect(await sql`SELECT user_id::text FROM public.events WHERE tenant_id=${KREILE_TENANT_SLUG} AND client_event_id=${key}::uuid`).toEqual([{user_id:full.actorId}]);
});

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

it('customer edits survive real rereads and concurrent retries; rejected money edits leave no row or event',async()=>{
 const {createCustomerAction,updateCustomerAction,getCustomerSummaryAction}=await import('@/app/actions/customers.actions');
 const created=await withSession(full,()=>createCustomerAction({clientEventId:randomUUID(),customerType:'business',companyName:'TEST Kundenänderung '+randomUUID().slice(0,8),phone:'+49 711 5550190'}));
 if(created.code!=='OK')throw Error('CUSTOMER_EDIT_SEED:'+created.code);
 const customerId=created.receipt.customerId;
 const operational=await createFixture(['kunden'],'werkstatt');
 const input={customerId,clientEventId:randomUUID(),phone:'+49 711 5550299',notes:'TEST Rückruf am Nachmittag'};
 const results=await Promise.all([withSession(operational,()=>updateCustomerAction(structuredClone(input))),withSession(operational,()=>updateCustomerAction(structuredClone(input)))]);
 expect(results.map(result=>result.code)).toEqual(['OK','OK']);
 const read=await withSession(operational,()=>getCustomerSummaryAction({customerId}));
 expect(read).toMatchObject({code:'OK',data:{id:customerId,phone:input.phone}});
 expect(await withSession(operational,()=>updateCustomerAction(structuredClone(input)))).toMatchObject({code:'OK',replayed:true});
 expect(await sql`SELECT phone,notes FROM public.customers WHERE tenant_id=${KREILE_TENANT_SLUG} AND id=${customerId}`).toEqual([{phone:input.phone,notes:input.notes}]);
 expect(await sql`SELECT user_id::text,event_type FROM public.events WHERE tenant_id=${KREILE_TENANT_SLUG} AND client_event_id=${input.clientEventId}::uuid`).toEqual([{user_id:operational.actorId,event_type:'CUSTOMER_UPDATED_V1'}]);
 const rejectedKey=randomUUID();
 const before=await sql`SELECT payment_preference,zahlungsziel_tage FROM public.customers WHERE tenant_id=${KREILE_TENANT_SLUG} AND id=${customerId}`;
 expect(await withSession(operational,()=>updateCustomerAction({customerId,clientEventId:rejectedKey,paymentPreference:'bar',phone:'+49 711 5550999'}))).toMatchObject({code:'FORBIDDEN'});
 expect(await sql`SELECT payment_preference,zahlungsziel_tage FROM public.customers WHERE tenant_id=${KREILE_TENANT_SLUG} AND id=${customerId}`).toEqual(before);
 expect(await sql`SELECT count(*)::integer AS n FROM public.events WHERE tenant_id=${KREILE_TENANT_SLUG} AND client_event_id=${rejectedKey}::uuid`).toEqual([{n:0}]);
 expect(await withSession(operational,()=>getCustomerSummaryAction({customerId}))).toMatchObject({code:'OK',data:{phone:input.phone}});
 expect(await withSession(operational,()=>updateCustomerAction({...structuredClone(input),phone:'+49 711 5550888'}))).toMatchObject({code:'CONFLICT'});
 expect(await withSession(operational,()=>getCustomerSummaryAction({customerId}))).toMatchObject({code:'OK',data:{phone:input.phone}});
});
