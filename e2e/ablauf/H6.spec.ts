import {randomUUID} from 'node:crypto';
import {expect,it} from 'vitest';
import {KREILE_TENANT_SLUG} from '@/lib/tenant';
import {sql,full,withSession,createFixture} from './replayHarness';
import {customerFixture} from './orderFixture';

it('H6 operational acceptance works for actual logins without Geld and hides all price fields',async()=>{
 const customerId=await customerFixture('H6-op');
 const {createQuoteAction,changeQuoteLifecycleAction,readQuoteAction}=await import('@/app/actions/quotes.actions');
 for(const role of ['werkstatt','buero','readonly','admin'] as const){
  const actor=await createFixture([],role);
  const created=await withSession(full,()=>createQuoteAction({clientEventId:randomUUID(),customerId,dueDate:'2027-05-15',note:'TEST U249 '+role,positions:[{name:'TEST U249 Teil',quantity:1,material:'Messing',surfaceRequested:'verchromen',unitPriceCents:13700,lineTotalCents:13700}]}));
  expect(created.code).toBe('OK');if(created.code!=='OK')throw Error('U249_CREATE:'+created.code);
  const quoteId=created.quote.quoteId;
  expect(await withSession(full,()=>changeQuoteLifecycleAction({quoteId,expectedVersion:1,edition:1,action:'sent',channel:'druck',evidence:'TEST persönlich übergeben',clientEventId:randomUUID()}))).toMatchObject({code:'OK'});
  const input={quoteId,expectedVersion:2,edition:1,action:'accept' as const,evidence:'TEST telefonische Zusage für '+role,clientEventId:randomUUID()};
  const accepted=await withSession(actor,()=>changeQuoteLifecycleAction(input));
  expect(accepted.code,role).toBe('OK');if(accepted.code!=='OK')throw Error('U249_ACCEPT:'+role+':'+accepted.code);
  expect(accepted.quote).toMatchObject({totalNetCents:null,positions:[{unitPriceCents:null,lineTotalCents:null}],lifecycle:{acceptedEdition:1,calculation:null}});
  expect(await sql`SELECT zugesagt_fassung FROM private.quotes WHERE tenant_id=${KREILE_TENANT_SLUG} AND id=${quoteId}::uuid`).toEqual([{zugesagt_fassung:1}]);
  expect(await sql`SELECT user_id::text FROM public.events WHERE tenant_id=${KREILE_TENANT_SLUG} AND client_event_id=${input.clientEventId}::uuid`).toEqual([{user_id:actor.actorId}]);
  expect(await withSession(full,()=>readQuoteAction({quoteId}))).toMatchObject({code:'OK',quote:{version:3,lifecycle:{acceptedEdition:1}}});
  expect(await withSession(actor,()=>changeQuoteLifecycleAction(input))).toMatchObject({code:'OK',replayed:true});
  expect(await sql`SELECT count(*)::integer AS n FROM public.events WHERE tenant_id=${KREILE_TENANT_SLUG} AND client_event_id=${input.clientEventId}::uuid`).toEqual([{n:1}]);
 }
});

it('H6 conditional acceptance, fresh edition, stale reply, current acceptance and date-only change use the real quote actions',async()=>{
 const customerId=await customerFixture('H6');
 const {createQuoteAction,readQuoteAction,updateQuoteAction,changeQuoteLifecycleAction,convertQuoteToOrderAction}=await import('@/app/actions/quotes.actions');
 const position={name:'TEST H6 Trompete',quantity:4,material:'Messing',surfaceRequested:'verchromen',unitPriceCents:2500,lineTotalCents:10000};
 const created=await withSession(full,()=>createQuoteAction({clientEventId:randomUUID(),customerId,dueDate:'2027-05-15',note:'TEST H6',positions:[position]}));
 expect(created.code).toBe('OK');if(created.code!=='OK')throw Error('H6_CREATE:'+created.code);
 const quoteId=created.quote.quoteId;
 const sent=await withSession(full,()=>changeQuoteLifecycleAction({quoteId,expectedVersion:1,edition:1,clientEventId:randomUUID(),action:'sent',channel:'druck',evidence:'TEST H6 persönlich übergeben'}));
 expect(sent).toMatchObject({code:'OK',quote:{version:2,lifecycle:{edition:1,sentEdition:1}}});
 const conditionalKey=randomUUID();
 expect(await withSession(full,()=>changeQuoteLifecycleAction({quoteId,expectedVersion:2,edition:1,clientEventId:conditionalKey,action:'conditional',evidence:'TEST H6 zugesagt, aber anderer Preis'}))).toMatchObject({code:'OK',quote:{version:3}});
 expect(await sql`SELECT zugesagt_fassung,zugesagt_am,vorbehalt_fassung FROM private.quotes WHERE tenant_id=${KREILE_TENANT_SLUG} AND id=${quoteId}::uuid`).toEqual([{zugesagt_fassung:null,zugesagt_am:null,vorbehalt_fassung:1}]);
 expect(await sql`SELECT user_id::text,payload->>'action' AS action FROM public.events WHERE tenant_id=${KREILE_TENANT_SLUG} AND client_event_id=${conditionalKey}::uuid`).toEqual([{user_id:full.actorId,action:'conditional'}]);
 const changed={...position,unitPriceCents:2750,lineTotalCents:11000};
 expect(await withSession(full,()=>updateQuoteAction({quoteId,expectedVersion:3,clientEventId:randomUUID(),dueDate:'2027-05-15',note:'TEST H6',positions:[changed]}))).toMatchObject({code:'OK',quote:{version:4,lifecycle:{edition:2}}});
 const staleKey=randomUUID();
 expect(await withSession(full,()=>changeQuoteLifecycleAction({quoteId,expectedVersion:4,edition:1,clientEventId:staleKey,action:'accept',evidence:'TEST H6 Antwort auf alte Fassung'}))).toMatchObject({code:'CONFLICT'});
 expect(await sql`SELECT count(*)::integer AS n FROM public.events WHERE tenant_id=${KREILE_TENANT_SLUG} AND client_event_id=${staleKey}::uuid`).toEqual([{n:0}]);
 expect(await withSession(full,()=>readQuoteAction({quoteId}))).toMatchObject({code:'OK',quote:{version:4,lifecycle:{edition:2}}});
 expect(await withSession(full,()=>changeQuoteLifecycleAction({quoteId,expectedVersion:4,edition:2,clientEventId:randomUUID(),action:'sent',channel:'druck',evidence:'TEST H6 Fassung 2 übergeben'}))).toMatchObject({code:'OK',quote:{version:5}});
 const acceptedKey=randomUUID();
 const accept={quoteId,expectedVersion:5,edition:2,clientEventId:acceptedKey,action:'accept' as const,evidence:'TEST H6 aktuelle Fassung telefonisch zugesagt'};
 expect(await withSession(full,()=>changeQuoteLifecycleAction(accept))).toMatchObject({code:'OK',quote:{version:6,lifecycle:{acceptedEdition:2}}});
 expect(await withSession(full,()=>readQuoteAction({quoteId}))).toMatchObject({code:'OK',quote:{version:6,lifecycle:{acceptedEdition:2}}});
 expect(await withSession(full,()=>changeQuoteLifecycleAction(accept))).toMatchObject({code:'OK',replayed:true});
 expect(await sql`SELECT count(*)::integer AS n FROM public.events WHERE tenant_id=${KREILE_TENANT_SLUG} AND client_event_id=${acceptedKey}::uuid`).toEqual([{n:1}]);
 expect(await withSession(full,()=>updateQuoteAction({quoteId,expectedVersion:6,clientEventId:randomUUID(),dueDate:'2027-05-20',note:'TEST H6',positions:[changed]}))).toMatchObject({code:'OK',quote:{version:7,lifecycle:{edition:2,acceptedEdition:2}}});
 expect(await withSession(full,()=>readQuoteAction({quoteId}))).toMatchObject({code:'OK',quote:{version:7,dueDate:'2027-05-20',lifecycle:{edition:2,acceptedEdition:2}}});
 const premature=await withSession(full,()=>convertQuoteToOrderAction({quoteId,clientEventId:randomUUID(),expectedVersion:7,confirmedAward:true,confirmedOrderDueDate:'2027-05-20',handoverMode:'pickup',paymentMode:'rechnung'}));
 expect(premature.code,'H6/W1: acceptance without goods must never create an order').not.toBe('OK');
 expect(await sql`SELECT linked_order_id FROM private.quotes WHERE tenant_id=${KREILE_TENANT_SLUG} AND id=${quoteId}::uuid`).toEqual([{linked_order_id:null}]);
 expect(await sql`SELECT count(*)::integer AS n FROM public.orders WHERE tenant_id=${KREILE_TENANT_SLUG} AND customer_id=${customerId}`).toEqual([{n:0}]);
});
