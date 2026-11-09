import {randomUUID} from 'node:crypto';
import {expect,it} from 'vitest';
import {KREILE_TENANT_SLUG} from '@/lib/tenant';
import {sql,full,withSession,createFixture} from './replayHarness';

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
