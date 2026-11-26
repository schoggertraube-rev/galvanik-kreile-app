// @vitest-environment node
import {randomUUID} from 'node:crypto';
import {expect,it,vi} from 'vitest';

const tenant=vi.hoisted(()=>'TEST-ablauf-'+globalThis.crypto.randomUUID());
vi.mock('@/lib/tenant',()=>({KREILE_TENANT_SLUG:tenant}));

import {createFixture,full,sql,withSession} from '../../../e2e/ablauf/replayHarness';
import {customerFixture,intakeOrderFixture} from '../../../e2e/ablauf/orderFixture';
import {resolveAuthorization} from '@/lib/server/authorization';
import {berlinCalendarDay} from '@/lib/domain/workingDays';
import {readIntakeSuggestions} from '@/lib/server/intakeSuggestions';
import {readCustomerDeliveryBlock} from '@/lib/server/paymentSummaryRead';
import {withPrivilegedTenantTransaction} from '@/lib/server/privilegedDb';
import {quoteOperationContext} from '@/lib/server/quoteAuthorization';
import {readBetriebsruheInTransaction} from '@/modules/fundament/server-public';
import {readQuoteCommand} from '@/modules/quotes/server-public';
import {MAIL_PROMISE_COPY} from '@/ui/eingangMailCopy';
import {pruefeZusage as zusage,recordZusageAusnahmeInTransaction,type ZusageLeser} from '@/modules/eingang/server-public';

const leser:ZusageLeser={
  termin:(auth,input)=>readIntakeSuggestions(auth,input,readBetriebsruheInTransaction),
  kv:async(auth,quoteId)=>{
    const result=await readQuoteCommand(quoteOperationContext(auth),{quoteId});
    return result.code==='OK'?result.quote:null;
  },
};
const pruefeZusage=(auth:Parameters<typeof zusage>[0],input:Parameters<typeof zusage>[1])=>zusage(auth,input,leser);

it('reads customer-wide debt from the actual invoice source without exposing it to a mail-only financial context',async()=>{
  const customerId=await customerFixture('TEST S-1 Zahlungsvoraussetzung');
  const affected=await intakeOrderFixture('TEST S-1 Abholauftrag',customerId);
  const historicalOrder=await intakeOrderFixture('TEST S-1 Altauftrag',customerId);
  const orderId=affected.receipt.orderId;
  const input={art:'herausgabe' as const,customerId,orderId};
  const authorized=await withSession(full,()=>resolveAuthorization());
  if(!authorized.ok)throw Error('TEST_S1_AUTH_REQUIRED');
  const auth=authorized.data;
  expect(await pruefeZusage(auth,input)).toEqual({frei:true});

  // Explicit synthetic historical debt, matching the existing W-AUSGANG fixture.
  const invoiceId=randomUUID();
  await sql`INSERT INTO public.invoices(id,tenant_id,order_id,customer_id,invoice_number,amount_total,status,
    due_date,gross_amount_cents,payment_contract_version,payment_mode,payment_status,payment_open_amount_cents,
    payment_paid_amount_cents,payment_currency,payment_version)
    VALUES(${invoiceId}::uuid,${tenant},${historicalOrder.receipt.orderId},${customerId},'R-2025-0812',60,'issued',
      (statement_timestamp() AT TIME ZONE 'Europe/Berlin')::date-1,6000,1,'rechnung','offen',6000,0,'EUR',0)`;

  expect(await readCustomerDeliveryBlock(auth,customerId,orderId)).toMatchObject({code:'OK',paymentMode:'rechnung',
    data:{blocked:true,invoiceIds:[invoiceId]},oldest:{number:'R-2025-0812',openAmountCents:6000,daysOverdue:1}});
  expect(await pruefeZusage(auth,input)).toMatchObject({frei:false,grund:'liefersperre',
    ausweg:{befehl:'confirmPaymentAction',text:expect.stringContaining('R-2025-0812')}});

  const mailOperator=await createFixture(['mails','auftraege'],'werkstatt');
  const limited=await withSession(mailOperator,()=>resolveAuthorization());
  if(!limited.ok)throw Error('TEST_S1_OPERATOR_AUTH_REQUIRED');
  const hidden=await readCustomerDeliveryBlock(limited.data,customerId,orderId);
  expect(hidden).toMatchObject({code:'OK',data:{blocked:true,invoiceIds:[]}});
  expect(hidden).not.toHaveProperty('oldest');
  expect(await pruefeZusage(limited.data,input)).toMatchObject({frei:false,grund:'liefersperre',text:'Abholung erst nach Zahlung.'});
  expect(await pruefeZusage(limited.data,{art:'preis_im_text'})).toMatchObject({frei:false,grund:'preisrecht'});
  expect(await pruefeZusage(auth,{...input,orderId:randomUUID()})).toMatchObject({frei:false,grund:'unbekannt'});

  const approver=await createFixture(['mails','auftraege','entscheiden']);
  const authorization=await withSession(approver,()=>resolveAuthorization());
  if(!authorization.ok)throw Error('TEST_S1_APPROVER_AUTH_REQUIRED');
  const exception={customerId,orderId,expectedVersion:affected.receipt.orderVersion,
    clientEventId:randomUUID(),reason:'TEST S-1 Verbindliche Ausnahme durch den Meister'};
  const record=(actor:typeof auth,command:Parameters<typeof recordZusageAusnahmeInTransaction>[2])=>withPrivilegedTenantTransaction(actor,
    tx=>recordZusageAusnahmeInTransaction(tx,actor,command));
  expect(await record(limited.data,exception)).toEqual({code:'FORBIDDEN'});
  expect(await record(authorization.data,{...exception,reason:''})).toEqual({code:'VALIDATION_ERROR'});
  expect(await record(authorization.data,{...exception,expectedVersion:exception.expectedVersion+1})).toEqual({code:'CONFLICT'});
  expect(await pruefeZusage(authorization.data,input)).toMatchObject({frei:false,ausnahme:{recht:'entscheiden'}});
  const saved=await record(authorization.data,exception);
  if(saved.code!=='OK')throw Error('TEST_S1_EXCEPTION_NOT_RECORDED:'+saved.code);
  expect(saved.replayed).toBe(false);
  expect(await record(authorization.data,structuredClone(exception))).toEqual({...saved,replayed:true});
  expect(await record(authorization.data,{...exception,reason:'Anderer Grund'})).toEqual({code:'CONFLICT'});
  expect(await sql`SELECT id,user_id,order_id,notes,payload FROM public.events
    WHERE tenant_id=${tenant} AND client_event_id=${exception.clientEventId}::uuid`).toEqual([{
    id:saved.eventId,user_id:authorization.data.userId,order_id:orderId,notes:exception.reason,
    payload:{customerId,grund:'liefersperre'},
  }]);
  expect(await pruefeZusage(auth,input)).toMatchObject({frei:false,grund:'liefersperre'});
});

it('uses the actual order and planning sources to return the earliest possible appointment',async()=>{
  const customerId=await customerFixture('TEST S-1 Terminwunsch');
  const catalogId=randomUUID();
  const name='TEST S-1 Verchromen';
  // The catalogue and company values are isolated synthetic setup. The order is created by the normal action.
  await sql`INSERT INTO public.catalog_services(id,tenant_id,name,surface,unit,net_price_cents,
    vat_rate_basis_points,standard_lead_time_working_days)
    VALUES(${catalogId}::uuid,${tenant},${name},'verchromen','stueck',10000,1900,3)`;
  await sql`INSERT INTO public.company_settings(id,tenant_id,company_name,tagesleistung_eur,auslastung_passt_pct,
    auslastung_knapp_pct,auslastung_vorrang_pct,material_aufschlag_prozent,lager_regelversion)
    VALUES(${randomUUID()}::uuid,${tenant},'TEST S-1 Kapazität',1200,80,100,130,20,'TEST-S1')`;
  const {createOrderIntakeAction}=await import('@/app/actions/eingang.actions');
  const wish=berlinCalendarDay();
  const position={catalogServiceId:catalogId,name,quantity:1,material:'Messing',surfaceRequested:'Verchromen',
    executionRequested:'offen' as const,unit:'Stück',unitPriceCents:10000,vatRateBasisPoints:1900 as const};
  const created=await withSession(full,()=>createOrderIntakeAction({geprueft:true,clientEventId:randomUUID(),
    customer:{mode:'EXISTING',customerId},dueDate:'2027-05-15',termStatus:'bestaetigt',intakeSource:'persoenlich',
    handoverMode:'pickup',paymentMode:'rechnung',note:'TEST S-1 Terminzusage',items:[position]}));
  if(created.code!=='OK')throw Error('TEST_S1_TERM_ORDER:'+created.code);
  const authorized=await withSession(full,()=>resolveAuthorization());
  if(!authorized.ok)throw Error('TEST_S1_TERM_AUTH_REQUIRED');
  const terms=await leser.termin(authorized.data,{kind:'ORDER',customerId,wishDate:wish,handoverMode:'pickup',
    positions:[{...position,key:created.receipt.items[0].id}]});
  expect(terms.term?.rating).toBe('unmoeglich');
  const earliest=terms.term?.achievableDate;
  if(!earliest)throw Error('TEST_S1_TERM_COUNTEROFFER_REQUIRED');
  const input={art:'termin' as const,orderId:created.receipt.orderId,customerId,termin:wish};
  expect(await pruefeZusage(authorized.data,input)).toEqual({frei:false,grund:'termin',text:MAIL_PROMISE_COPY.earliestTerm(wish,earliest)});
  expect(await pruefeZusage(authorized.data,{...input,termin:earliest})).toEqual({frei:true});
  expect(await pruefeZusage(authorized.data,{...input,customerId:randomUUID()})).toMatchObject({frei:false,grund:'unbekannt'});
});

it('keeps a mixed completion state visible and releases a full quantity only after both parts are finished',async()=>{
  const customerId=await customerFixture('TEST S-1 Teil-Fertig');
  const {createOrderIntakeAction}=await import('@/app/actions/eingang.actions');
  const {transitionWareneingangToGalvanikAction,setOrderItemFinishedAction}=await import('@/app/actions/orders.actions');
  const {storeItemPhoto}=await import('../../../e2e/ablauf/photoFixture');
  const position={catalogServiceId:null,name:'TEST Halter',quantity:2,material:'Messing',surfaceRequested:'Verchromen',
    executionRequested:'offen' as const,unit:'Stück',unitPriceCents:10000,vatRateBasisPoints:1900 as const};
  const created=await withSession(full,()=>createOrderIntakeAction({geprueft:true,clientEventId:randomUUID(),
    customer:{mode:'EXISTING',customerId},dueDate:'2027-05-15',termStatus:'bestaetigt',intakeSource:'persoenlich',
    handoverMode:'pickup',paymentMode:'rechnung',note:'TEST S-1 Teil-Fertig',items:[position,{...position,quantity:3}]}));
  if(created.code!=='OK')throw Error('TEST_S1_QUANTITY_ORDER:'+created.code);
  const orderId=created.receipt.orderId;
  const moved=await withSession(full,()=>transitionWareneingangToGalvanikAction({orderId,expectedVersion:created.receipt.orderVersion,clientEventId:randomUUID()}));
  if(moved.code!=='OK')throw Error('TEST_S1_QUANTITY_HANDOFF:'+moved.code);
  for(const item of created.receipt.items)await storeItemPhoto(orderId,item.id);
  const input={art:'menge' as const,orderId,customerId,menge:5};
  const authorization=await withSession(full,()=>resolveAuthorization());
  if(!authorization.ok)throw Error('TEST_S1_QUANTITY_AUTH_REQUIRED');
  const pending=(finished:number)=>({frei:false,grund:'menge',text:MAIL_PROMISE_COPY.quantityNotReady([
    {ware:'Stück TEST Halter',fertig:finished,gesamt:5},
  ])});
  const read=()=>pruefeZusage(authorization.data,input);
  expect(await read()).toEqual(pending(0));
  let version=moved.receipt.aggregateVersion;
  for(const [index,item] of created.receipt.items.entries()){
    const finished=await withSession(full,()=>setOrderItemFinishedAction({orderId,itemId:item.id,expectedVersion:version,
      clientEventId:randomUUID(),finished:true}));
    if(finished.code!=='OK')throw Error('TEST_S1_QUANTITY_FINISH:'+finished.code);
    version=finished.receipt.aggregateVersion;
    expect(await read()).toEqual(index===0?pending(2):{frei:true});
  }
  expect(await pruefeZusage(authorization.data,{...input,menge:4})).toEqual({frei:false,grund:'menge',text:MAIL_PROMISE_COPY.quantityMismatch(4,5)});
});

it('reads the quote edition and quantity, rejecting an expired or different quote offer',async()=>{
  const customerId=await customerFixture('TEST S-1 KV-Menge');
  const {createQuoteAction,changeQuoteLifecycleAction}=await import('@/app/actions/quotes.actions');
  const authorization=await withSession(full,()=>resolveAuthorization());
  if(!authorization.ok)throw Error('TEST_S1_QUOTE_AUTH_REQUIRED');
  const create=()=>withSession(full,()=>createQuoteAction({clientEventId:randomUUID(),customerId,dueDate:'2027-04-20',
    validUntil:'2027-04-30',note:'TEST S-1 KV',positions:[{name:'TEST Halter',quantity:3,material:null,
      surfaceRequested:'verchromen',unit:'Stück',unitPriceCents:1000}]}));
  const send=(quoteId:string)=>withSession(full,()=>changeQuoteLifecycleAction({action:'sent',quoteId,clientEventId:randomUUID(),
    expectedVersion:1,edition:1,channel:'druck',evidence:'TEST bisherige Fassung gedruckt'}));
  const quote=await create();if(quote.code!=='OK')throw Error('TEST_S1_QUOTE:'+quote.code);
  const input={art:'auftrag_aus_kv' as const,orderId:quote.quote.quoteId,customerId,menge:3};
  const read=()=>pruefeZusage(authorization.data,input);
  expect(await read()).toMatchObject({frei:false,grund:'unbekannt'});
  expect(await send(input.orderId)).toMatchObject({code:'OK'});
  expect(await withSession(full,()=>changeQuoteLifecycleAction({action:'accept',quoteId:input.orderId,clientEventId:randomUUID(),
    expectedVersion:2,edition:1,evidence:'TEST aktuelle Fassung angenommen'}))).toMatchObject({code:'OK'});
  expect(await read()).toEqual({frei:true});
  expect(await pruefeZusage(authorization.data,{...input,menge:2})).toEqual({frei:false,grund:'menge',text:MAIL_PROMISE_COPY.quantityMismatch(2,3)});
  const expired=await create();if(expired.code!=='OK')throw Error('TEST_S1_EXPIRED_QUOTE:'+expired.code);
  expect(await send(expired.quote.quoteId)).toMatchObject({code:'OK'});
  // Represent elapsed calendar time in the explicitly isolated TEST quote.
  await sql`UPDATE private.quotes SET valid_until=(statement_timestamp() AT TIME ZONE 'Europe/Berlin')::date-1
    WHERE tenant_id=${tenant} AND id=${expired.quote.quoteId}::uuid`;
  expect(await pruefeZusage(authorization.data,{...input,orderId:expired.quote.quoteId})).toEqual({
    frei:false,grund:'kv_abgelaufen',text:MAIL_PROMISE_COPY.quoteExpired(expired.quote.quoteNumber),
  });
});
