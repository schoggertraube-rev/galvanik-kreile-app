// @vitest-environment node
import {createHash,randomUUID} from 'node:crypto';
import {expect,it,vi} from 'vitest';

const tenant=vi.hoisted(()=>'TEST-ablauf-'+globalThis.crypto.randomUUID());
vi.mock('@/lib/tenant',()=>({KREILE_TENANT_SLUG:tenant}));

import {createFixture,full,nativeFetch,sql,withSession} from '../../../e2e/ablauf/replayHarness';
import {customerFixture,intakeOrderFixture,readyInvoiceOrder,readyOrderForInvoice} from '../../../e2e/ablauf/orderFixture';
import {resolveAuthorization} from '@/lib/server/authorization';
import {berlinCalendarDay} from '@/lib/domain/workingDays';
import {readIntakeSuggestions} from '@/lib/server/intakeSuggestions';
import {readCustomerDeliveryBlock} from '@/lib/server/paymentSummaryRead';
import {withPrivilegedTenantTransaction} from '@/lib/server/privilegedDb';
import {quoteOperationContext} from '@/lib/server/quoteAuthorization';
import {readBetriebsruheInTransaction} from '@/modules/fundament/server-public';
import {readQuoteCommand} from '@/modules/quotes/server-public';
import {readCustomerProfile} from '@/modules/customers/server-public';
import {leseLagerAuftragsmaterialInTransaction} from '@/modules/lager/server-public';
import {MAIL_PROMISE_COPY} from '@/ui/eingangMailCopy';
import {pruefeZusage as zusage,type ZusageLeser} from '@/modules/eingang/server-public';

const leser:ZusageLeser={
  termin:(auth,input,options)=>readIntakeSuggestions(auth,input,readBetriebsruheInTransaction,options),
  kv:async(auth,quoteId)=>{
    const result=await readQuoteCommand(quoteOperationContext(auth),{quoteId});
    return result.code==='OK'?result.quote:null;
  },
  verbrauch:(auth,orderId)=>withPrivilegedTenantTransaction(auth,tx=>leseLagerAuftragsmaterialInTransaction(tx,orderId)),
  kunde:(auth,customerId)=>withPrivilegedTenantTransaction(auth,tx=>readCustomerProfile(tx,auth.tenantId,customerId)),
};
const pruefeZusage=(auth:Parameters<typeof zusage>[0],input:Parameters<typeof zusage>[1])=>zusage(auth,input,leser);

async function completeInvoiceSettingsFixture(){
  // Extend the isolated company row if a previous mail case already created it.
  await sql`UPDATE public.company_settings SET street='TEST Weg 1',zip='70176',city='Stuttgart',country='Deutschland',
    iban='DE02120300000000202051',bic='BYLADEM1001',bank_name='TEST Bank',tax_id='DE123456789',
    invoice_vat_rate_basis_points=1900,invoice_payment_term_days=14,versand_pauschale_netto_cents=1000 WHERE tenant_id=${tenant}`;
}

// Isolated synthetic incoming notes. Rights, customer, order, quote and payment readers are real.
async function originalFixture(customerId:string,options:{sender?:string;type?:'auftrag'|'kv';target?:string}={}){
  const row=await withSession(full,async()=>{const authorized=await resolveAuthorization();
    if(!authorized.ok)throw Error('TEST_S1_FIXTURE_AUTH');
    return leser.kunde(authorized.data,customerId);});
  if(!row?.email)throw Error('TEST_S1_FIXTURE_CONTACT_REQUIRED');
  const id=randomUUID();
  await sql`INSERT INTO public.intake_item (id,tenant_id,client_key,kanal,richtung,quelle,erstellt_von,
      kunde_id,zuordnung,einsatz,absender_adresse,absender_name,text,vorgang_art,vorgang_id)
    VALUES (${id}::uuid,${tenant},${id},'notiz','rein','app',${full.actorId}::uuid,${customerId},'hand','offen',
      ${options.sender??row.email},'TEST Kontakt','TEST S-1 Meldung',${options.type??null},${options.target??null})`;
  return id;
}

it('reads customer-wide debt from the actual invoice source without exposing it to a mail-only financial context',async()=>{
  const customerId=await customerFixture('TEST S-1 Zahlungsvoraussetzung');
  const affected=await intakeOrderFixture('TEST S-1 Abholauftrag',customerId);
  const historicalOrder=await intakeOrderFixture('TEST S-1 Altauftrag',customerId);
  const orderId=affected.receipt.orderId;
  const input={art:'herausgabe' as const,customerId,orderId,sourceItemId:await originalFixture(customerId)};
  const authorized=await withSession(full,()=>resolveAuthorization());
  if(!authorized.ok)throw Error('TEST_S1_AUTH_REQUIRED');
  const auth=authorized.data;
  expect(await pruefeZusage(auth,input)).toEqual({frei:true});
  const thirdPartyPickup={...input,art:'abholer' as const,anliegen:'A10',wirkung:'abholer_vormerken'};
  expect(await pruefeZusage(auth,thirdPartyPickup)).toEqual({
    frei:false,grund:'unbekannt',text:MAIL_PROMISE_COPY.pending.abholer,
  });

  // Explicit synthetic historical debt, matching the existing W-AUSGANG fixture.
  const invoiceId=randomUUID();
  await sql`INSERT INTO public.invoices(id,tenant_id,order_id,customer_id,invoice_number,amount_total,status,
    due_date,gross_amount_cents,payment_contract_version,payment_mode,payment_status,payment_open_amount_cents,
    payment_paid_amount_cents,payment_currency,payment_version)
    VALUES(${invoiceId}::uuid,${tenant},${historicalOrder.receipt.orderId},${customerId},'R-2025-0812',60,'issued',
      (statement_timestamp() AT TIME ZONE 'Europe/Berlin')::date-1,6000,1,'rechnung','offen',6000,0,'EUR',0)`;

  expect(await readCustomerDeliveryBlock(auth,customerId,orderId)).toMatchObject({code:'OK',paymentMode:'rechnung',
    data:{blocked:true,invoiceIds:[invoiceId]},oldest:{number:'R-2025-0812',openAmountCents:6000,daysOverdue:1}});
  expect(await readCustomerDeliveryBlock(auth,customerId)).toMatchObject({code:'OK',data:{blocked:true,invoiceIds:[invoiceId]}});
  expect(await pruefeZusage(auth,input)).toMatchObject({frei:false,grund:'liefersperre',
    hinweis:expect.stringContaining('R-2025-0812')});
  expect(await pruefeZusage(auth,thirdPartyPickup)).toMatchObject({frei:false,grund:'liefersperre',
    hinweis:expect.stringContaining('R-2025-0812')});
  expect(await pruefeZusage(auth,input)).not.toHaveProperty('ausweg');
  const unrelated=await originalFixture(customerId,{sender:'test-fremd@example.invalid'});
  expect(await pruefeZusage(auth,{...input,sourceItemId:unrelated})).toMatchObject({frei:false,grund:'absender_fremd'});
  const shipping=await intakeOrderFixture('TEST S-1 Versandauftrag',customerId,'shipping');
  expect(await pruefeZusage(auth,{...input,orderId:shipping.receipt.orderId})).toMatchObject({
    frei:false,grund:'liefersperre',hinweis:expect.stringContaining('Versand nach Zahlung'),
  });

  const mailOperator=await createFixture(['mails','auftraege'],'werkstatt');
  const limited=await withSession(mailOperator,()=>resolveAuthorization());
  if(!limited.ok)throw Error('TEST_S1_OPERATOR_AUTH_REQUIRED');
  const hidden=await readCustomerDeliveryBlock(limited.data,customerId,orderId);
  expect(hidden).toMatchObject({code:'OK',data:{blocked:true,invoiceIds:[]}});
  expect(hidden).not.toHaveProperty('oldest');
  expect(await pruefeZusage(limited.data,input)).toMatchObject({frei:false,grund:'liefersperre',text:'Abholung erst nach Zahlung.'});
  expect(await pruefeZusage(limited.data,{art:'preis_im_text'})).toMatchObject({frei:false,grund:'preisrecht'});
  expect(await pruefeZusage(auth,{...input,orderId:randomUUID()})).toMatchObject({frei:false,grund:'unbekannt_zahlung'});

  const approver=await createFixture(['mails','auftraege','entscheiden']);
  const authorization=await withSession(approver,()=>resolveAuthorization());
  if(!authorization.ok)throw Error('TEST_S1_APPROVER_AUTH_REQUIRED');
  expect(await pruefeZusage(authorization.data,input)).toEqual({frei:false,grund:'liefersperre',text:'Abholung erst nach Zahlung.'});
  const {confirmPaymentAction}=await import('@/app/actions/payments.actions');
  expect(await withSession(full,()=>confirmPaymentAction({invoiceId,amount:6000,method:'bar',
    expectedVersion:0,clientEventId:randomUUID()}))).toMatchObject({code:'OK'});
  expect(await pruefeZusage(auth,input)).toEqual({frei:true});
  expect(await readCustomerDeliveryBlock(auth,customerId)).toMatchObject({code:'OK',data:{blocked:false,invoiceIds:[]}});
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
  const input={art:'termin' as const,orderId:created.receipt.orderId,customerId,termin:wish,sourceItemId:await originalFixture(customerId)};
  expect(await pruefeZusage(authorized.data,input)).toEqual({frei:false,grund:'termin',text:MAIL_PROMISE_COPY.earliestTerm(wish,earliest)});
  expect(await pruefeZusage(authorized.data,{...input,termin:earliest})).toEqual({frei:true});
  expect(await pruefeZusage(authorized.data,{...input,customerId:randomUUID()})).toMatchObject({frei:false,grund:'absender_fremd'});
  const request={art:'termin' as const,termin:wish,positionen:[{...position,key:created.receipt.items[0].id}]};
  expect(await pruefeZusage(authorized.data,request)).toMatchObject({frei:false,grund:'termin'});
  expect(await pruefeZusage(authorized.data,{...request,positionen:[]})).toMatchObject({frei:false,grund:'unbekannt_termin'});
  const pricedPlan={...input,art:'preisquelle' as const,anliegen:'A4',wirkung:'auftrag_mit_preisquelle_anlegen'};
  expect(await pruefeZusage(authorized.data,pricedPlan)).toEqual({frei:true});
  expect(await pruefeZusage(authorized.data,{...pricedPlan,orderId:undefined,positionen:[{
    ...position,key:randomUUID(),name:`TEST Preis fehlt ${randomUUID()}`,catalogServiceId:null,unitPriceCents:null,
  }]})).toEqual({frei:false,grund:'unbekannt',text:MAIL_PROMISE_COPY.unknownPriceSource});
  expect(await pruefeZusage(authorized.data,{...pricedPlan,art:'preis_im_text'})).toMatchObject({frei:false});
  // Simulate a failed dependency at the planning reader boundary only.
  const unavailable={...leser,termin:async()=>{throw Error('TEST_S1_PLANNING_READ_FAILED');}};
  expect(await zusage(authorized.data,input,unavailable)).toMatchObject({frei:false,grund:'unbekannt_termin'});
});

it('keeps the open complaint as a block while real rework requires no payment',async()=>{
  const customerId=await customerFixture('TEST S-1 Reklamation');
  const order=await intakeOrderFixture('TEST S-1 beanstandeter Auftrag',customerId);
  const actor=await createFixture(['auftraege','mails','kunden','entscheiden']);
  const complaintId=randomUUID();
  const number='RK-TEST-S1-'+complaintId.slice(0,8);
  const itemId=order.receipt.items[0].id;
  // Isolated pre-existing complaint for the read boundary; the rework order is created by its actual action.
  await sql`INSERT INTO public.complaints (id,tenant_id,order_id,customer_id,item_id,reason,description,status,
    nummer,client_key,teile,mangel,fotos,ware_zurueck,stand,version,erstellt_von,erstellt_am)
    VALUES (${complaintId},${tenant},${order.receipt.orderId},${customerId},${itemId},'TEST S-1',
      'TEST S-1 offener Mangel','open',${number},${randomUUID()}::uuid,
      ${sql.json([{position_id:itemId,menge:1}])}::jsonb,'TEST S-1 Mangel','[]'::jsonb,'ja','aufgenommen',1,
      ${actor.actorId}::uuid,statement_timestamp() AT TIME ZONE 'UTC')`;
  const authorization=await withSession(actor,()=>resolveAuthorization());
  if(!authorization.ok)throw Error('TEST_S1_COMPLAINT_AUTH_REQUIRED');
  const sourceItemId=await originalFixture(customerId);
  expect(await pruefeZusage(authorization.data,{art:'herausgabe',customerId,orderId:order.receipt.orderId,sourceItemId})).toMatchObject({
    frei:false,grund:'reklamation',text:expect.stringContaining(number),
  });
  const {nacharbeitAnlegenAction}=await import('@/app/actions/complaints.actions');
  const work=await withSession(actor,()=>nacharbeitAnlegenAction({reklamationId:complaintId,version:1,
    bewertung:'berechtigt',massnahme:'nacharbeit',liefertermin:'2027-05-18'}));
  if(work.code!=='OK')throw Error('TEST_S1_REWORK:'+work.code+':'+work.message);
  expect(await readCustomerDeliveryBlock(authorization.data,customerId,work.receipt.orderId)).toMatchObject({
    code:'OK',paymentMode:'keiner',data:{blocked:false},
  });
  expect(await pruefeZusage(authorization.data,{art:'herausgabe',customerId,orderId:work.receipt.orderId,sourceItemId})).toEqual({frei:true});
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
  const input={art:'menge' as const,orderId,customerId,menge:5,sourceItemId:await originalFixture(customerId)};
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
  const input={art:'auftrag_aus_kv' as const,quoteId:quote.quote.quoteId,customerId,menge:3,sourceItemId:await originalFixture(customerId)};
  const read=()=>pruefeZusage(authorization.data,input);
  expect(await read()).toMatchObject({frei:false,grund:'unbekannt_kv'});
  expect(await send(input.quoteId)).toMatchObject({code:'OK'});
  expect(await withSession(full,()=>changeQuoteLifecycleAction({action:'accept',quoteId:input.quoteId,clientEventId:randomUUID(),
    expectedVersion:2,edition:1,evidence:'TEST aktuelle Fassung angenommen'}))).toMatchObject({code:'OK'});
  expect(await read()).toEqual({frei:true});
  expect(await pruefeZusage(authorization.data,{...input,menge:2})).toEqual({frei:false,grund:'menge',text:MAIL_PROMISE_COPY.quantityMismatch(2,3)});
  const expired=await create();if(expired.code!=='OK')throw Error('TEST_S1_EXPIRED_QUOTE:'+expired.code);
  expect(await send(expired.quote.quoteId)).toMatchObject({code:'OK'});
  // Represent elapsed calendar time in the explicitly isolated TEST quote.
  await sql`UPDATE private.quotes SET valid_until=(statement_timestamp() AT TIME ZONE 'Europe/Berlin')::date-1
    WHERE tenant_id=${tenant} AND id=${expired.quote.quoteId}::uuid`;
  expect(await pruefeZusage(authorization.data,{...input,quoteId:expired.quote.quoteId})).toEqual({
    frei:false,grund:'kv_abgelaufen',text:MAIL_PROMISE_COPY.quoteExpired(expired.quote.quoteNumber),
  });
});

it('uses a secured incoming original for the phone handoff and only allows the connected mail channel',async()=>{
  const {getOpenIntakeMailsAction}=await import('@/app/actions/eingang.actions');
  const sender='TEST S-1 Absender';
  const address='test-s1-'+randomUUID()+'@example.invalid';
  const customerId=await customerFixture('TEST Kontakt der Bankdatenmeldung');
  await sql`UPDATE public.customers SET email=${address} WHERE tenant_id=${tenant} AND id=${customerId}`;
  const body='TEST: Bitte neue Bankdaten telefonisch abstimmen.';
  const message={
    id:'TEST-S1-'+randomUUID(),internetMessageId:`<${address}>`,subject:'TEST S-1 Neue Bankverbindung',
    from:{emailAddress:{name:sender,address}},receivedDateTime:new Date().toISOString(),bodyPreview:body,
    body:{contentType:'text',content:body},hasAttachments:false,
  };
  const pickupBody='TEST: Bitte nicht versenden. Ich hole die Ware am Freitag ab.';
  const pickupMail={...message,id:'TEST-S1-'+randomUUID(),internetMessageId:`<${randomUUID()}@example.invalid>`,
    subject:'TEST S-1 Abholung',bodyPreview:pickupBody,body:{contentType:'text',content:pickupBody}};
  await sql`INSERT INTO public.company_settings(id,tenant_id,company_name,material_aufschlag_prozent,lager_regelversion)
    SELECT ${randomUUID()},${tenant},'TEST S-1 Mail',20,'TEST-S1'
    WHERE NOT EXISTS(SELECT 1 FROM public.company_settings WHERE tenant_id=${tenant})`;
  // Only the external mailbox response is synthetic. Intake and MIME storage use the usual writer.
  vi.spyOn(globalThis,'fetch').mockImplementation(async(input,init)=>{
    const url=new URL(typeof input==='string'?input:input instanceof URL?input.href:input.url);
    if(url.hostname==='login.microsoftonline.com')return Response.json({access_token:'TEST-S1-mail-provider-token'.repeat(3)});
    if(url.hostname!=='graph.microsoft.com')return nativeFetch(input,init);
    if(url.pathname.includes('/mailFolders/inbox/messages'))return Response.json({value:[message,pickupMail]});
    const original=url.pathname.split('/').includes(pickupMail.id)?pickupMail:message;
    if(url.pathname.endsWith('/$value'))return new Response(`From: ${address}\r\nMessage-ID: ${original.internetMessageId}\r\nSubject: ${original.subject}\r\n\r\n${original.body.content}`);
    if(url.pathname.endsWith('/attachments'))return Response.json({value:[]});
    return Response.json(original);
  });
  expect(await withSession(full,()=>getOpenIntakeMailsAction())).toMatchObject({code:'OK'});
  const [source]=await sql`SELECT item.id::text, item.version FROM public.intake_item item
    JOIN public.intake_file file ON file.tenant_id=item.tenant_id AND file.item_id=item.id AND file.mime='message/rfc822'
    WHERE item.tenant_id=${tenant} AND item.graph_message_id=${message.id}`;
  if(!source)throw Error('TEST_S1_BANK_ORIGINAL_REQUIRED');
  const authorization=await withSession(full,()=>resolveAuthorization());
  if(!authorization.ok)throw Error('TEST_S1_BANK_AUTH_REQUIRED');
  // Synthetic confirmed association of the real imported original.
  await sql`UPDATE public.intake_item SET kunde_id=${customerId}, zuordnung='hand' WHERE tenant_id=${tenant} AND id=${source.id}::uuid`;
  const input={art:'stammdaten' as const,sourceItemId:source.id,customerId};
  const text=MAIL_PROMISE_COPY.verifyBankDetails(sender);
  expect(await pruefeZusage(authorization.data,input)).toEqual({
    frei:false,grund:'stammdaten',text,ausweg:{befehl:'saveIntakeTaskAction',text},
  });
  expect(await pruefeZusage(authorization.data,{...input,sourceItemId:randomUUID()})).toMatchObject({frei:false,grund:'absender_fremd'});
  expect(await pruefeZusage(authorization.data,{...input,sourceItemId:await originalFixture(customerId)})).toMatchObject({frei:false,grund:'stammdaten'});
  expect(await pruefeZusage(authorization.data,{art:'kanal_versand',kanal:'mail'})).toEqual({frei:true});
  expect(await pruefeZusage(authorization.data,{art:'kanal_versand',kanal:'whatsapp'})).toMatchObject({frei:false,grund:'unbekannt_kanal'});
  expect(await sql`SELECT version FROM public.intake_item WHERE tenant_id=${tenant} AND id=${source.id}::uuid`).toEqual([{version:source.version}]);

  const {receipt}=await intakeOrderFixture('TEST S-1 Abholmail',customerId,'shipping');
  const [pickup]=await sql`SELECT item.id::text,item.version FROM public.intake_item item
    JOIN public.intake_file file ON file.tenant_id=item.tenant_id AND file.item_id=item.id AND file.mime='message/rfc822'
    WHERE item.tenant_id=${tenant} AND item.graph_message_id=${pickupMail.id}`;
  if(!pickup)throw Error('TEST_S1_PICKUP_ORIGINAL_REQUIRED');
  // Isolated confirmed association with the real order and secured original.
  await sql`UPDATE public.intake_item SET kunde_id=${customerId},zuordnung='hand',vorgang_art='auftrag',vorgang_id=${receipt.orderId}
    WHERE tenant_id=${tenant} AND id=${pickup.id}::uuid`;
  const plan={art:'herausgabe' as const,anliegen:'A9',customerId,orderId:receipt.orderId,
    sourceItemId:pickup.id,sourceVersion:pickup.version};
  expect(await pruefeZusage(authorization.data,{...plan,wirkung:'antwort_senden'})).toEqual({frei:true});
  for(const wirkung of ['recordGoodsOutAction','confirmPaymentAction','transitionWareneingangToGalvanikAction']){
    expect(await pruefeZusage(authorization.data,{...plan,wirkung})).toEqual({
      frei:false,grund:'unbekannt',text:MAIL_PROMISE_COPY.unavailable,
    });
  }
  expect(await pruefeZusage(authorization.data,plan)).toMatchObject({frei:false});
  expect(await sql`SELECT version,handover_mode FROM public.orders WHERE tenant_id=${tenant} AND id=${receipt.orderId}`)
    .toEqual([{version:receipt.orderVersion,handover_mode:'shipping'}]);
});

it('holds the reply open only for an automatic marking in the secured MIME header',async()=>{
  const {getOpenIntakeMailsAction}=await import('@/app/actions/eingang.actions');
  const customerId=await customerFixture('TEST S-1 Automatische Antwort');
  const authorization=await withSession(full,()=>resolveAuthorization());
  if(!authorization.ok)throw Error('TEST_S1_REPLY_AUTH_REQUIRED');
  const customer=await leser.kunde(authorization.data,customerId);
  if(!customer?.email)throw Error('TEST_S1_REPLY_CONTACT_REQUIRED');
  const body='TEST: Auto-Submitted: auto-replied';
  const replyTo='<TEST-S1-Rueckfrage@example.invalid>';
  const messages=['auto-replied','no'].map(marking=>{
    const id=`TEST-S1-${randomUUID()}`;
    return {marking,value:{id,internetMessageId:`<${id}@example.invalid>`,subject:'TEST S-1 Automatische Antwort',
      from:{emailAddress:{name:'TEST Kontakt',address:customer.email}},receivedDateTime:new Date().toISOString(),
      bodyPreview:body,body:{contentType:'text',content:body},hasAttachments:false}};
  });
  await sql`INSERT INTO public.company_settings(id,tenant_id,company_name,material_aufschlag_prozent,lager_regelversion)
    SELECT ${randomUUID()},${tenant},'TEST S-1 Mail',20,'TEST-S1'
    WHERE NOT EXISTS(SELECT 1 FROM public.company_settings WHERE tenant_id=${tenant})`;
  // Synthetic provider responses; the usual import secures both originals.
  const fetchMock=vi.spyOn(globalThis,'fetch').mockImplementation(async(input,init)=>{
    const url=new URL(typeof input==='string'?input:input instanceof URL?input.href:input.url);
    if(url.hostname==='login.microsoftonline.com')return Response.json({access_token:'TEST-S1-mail-provider-token'.repeat(3)});
    if(url.hostname!=='graph.microsoft.com')return nativeFetch(input,init);
    if(url.pathname.includes('/mailFolders/inbox/messages'))return Response.json({value:messages.map(row=>row.value)});
    const message=messages.find(row=>url.pathname.split('/').includes(row.value.id));
    if(!message)return new Response(null,{status:404});
    if(url.pathname.endsWith('/$value'))return new Response(`From: ${customer.email}\r\nMessage-ID: ${message.value.internetMessageId}\r\nSubject: ${message.value.subject}\r\nAuto-Submitted: ${message.marking}\r\nIn-Reply-To: ${replyTo}\r\nReferences: <TEST-S1-Faden@example.invalid>\r\n ${replyTo}\r\n\r\n${body}`);
    if(url.pathname.endsWith('/attachments'))return Response.json({value:[]});
    return Response.json(message.value);
  });
  try{
    expect(await withSession(full,()=>getOpenIntakeMailsAction())).toMatchObject({code:'OK'});
    const readbacks=await sql<{id:string;messageId:string;version:number}[]>`SELECT id::text,graph_message_id AS "messageId",version
      FROM public.intake_item WHERE tenant_id=${tenant} AND graph_message_id=ANY(${messages.map(row=>row.value.id)}::text[])`;
    expect(readbacks).toHaveLength(2);
    for(const [index,message] of messages.entries()){
      const original=readbacks.find(row=>row.messageId===message.value.id);
      if(!original)throw Error('TEST_S1_REPLY_ORIGINAL_REQUIRED');
      // Isolated confirmed association, independent of the original headers.
      await sql`UPDATE public.intake_item SET kunde_id=${customerId},zuordnung='hand' WHERE tenant_id=${tenant} AND id=${original.id}::uuid`;
      const result=await pruefeZusage(authorization.data,{art:'abwesenheit',customerId,sourceItemId:original.id,sourceVersion:original.version});
      expect(result).toEqual(index===0
        ?{frei:false,grund:'abwesenheit',text:MAIL_PROMISE_COPY.automaticReply}
        :{frei:false,grund:'unbekannt',text:MAIL_PROMISE_COPY.pending.abwesenheit});
      expect(await sql`SELECT geoeffnet FROM public.intake_file WHERE tenant_id=${tenant} AND item_id=${original.id}::uuid AND mime='message/rfc822'`).toEqual([{geoeffnet:false}]);
      expect(await sql`SELECT nachher->'replyChain' AS chain FROM public.intake_event
        WHERE tenant_id=${tenant} AND item_id=${original.id}::uuid AND art='angelegt'`).toEqual([
        {chain:expect.objectContaining({status:'present',inReplyTo:[replyTo],references:['<TEST-S1-Faden@example.invalid>',replyTo]})},
      ]);
    }
  }finally{fetchMock.mockRestore();}
});

it('uses the existing cancellation receipt to explain a pending replacement and keeps the reply date',async()=>{
  const {changeOrderPickupNoticeAction}=await import('@/app/actions/orders.actions');
  const {cancelInvoiceAction}=await import('@/app/actions/invoices.actions');
  const {confirmPaymentAction}=await import('@/app/actions/payments.actions');
  await completeInvoiceSettingsFixture();
  const order=await readyInvoiceOrder('TEST S-1 neue Rechnung','shipping',false,undefined,10000);
  expect(await withSession(full,()=>confirmPaymentAction({invoiceId:order.invoice.invoiceId,amount:order.invoice.grossAmountCents,
    expectedVersion:0,expectedOpenAmountCents:order.invoice.grossAmountCents,method:'ueberweisung',clientEventId:randomUUID()})))
    .toMatchObject({code:'OK'});
  await createFixture(['entscheiden'],'buero');
  const handover=await withSession(full,()=>changeOrderPickupNoticeAction({command:'handover_manual',orderId:order.orderId,
    expectedVersion:order.version,handoverMode:'pickup',clientEventId:randomUUID()}));
  if(handover.code!=='OK'||!handover.receipt||typeof handover.receipt!=='object'||
    !('eventId'in handover.receipt)||typeof handover.receipt.eventId!=='string')
    throw Error('TEST_S1_REISSUE_HANDOVER_REQUIRED');
  const replacementKey=randomUUID();
  const input={invoiceId:order.invoice.invoiceId,expectedVersion:1,reason:'Übergabeart Versand → Abholung',clientEventId:randomUUID(),
    reissueWithoutShipping:{handoverEventId:handover.receipt.eventId,replacementClientEventId:replacementKey}};
  const authorization=await withSession(full,()=>resolveAuthorization());
  if(!authorization.ok)throw Error('TEST_S1_REISSUE_AUTH_REQUIRED');
  const plan={art:'herausgabe' as const,customerId:order.customerId,orderId:order.orderId,
    sourceItemId:await originalFixture(order.customerId),antwortBis:'30.11.2026'};
  // Inject only a TEST SQL failure on the real replacement insert so the existing cancellation remains pending.
  const fault='test_s1_reissue_'+randomUUID().replaceAll('-','');
  await sql.unsafe(`CREATE FUNCTION private.${fault}() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.tenant_id='${tenant}' AND NEW.client_event_id='${replacementKey}'::uuid THEN PERFORM 1/0; END IF; RETURN NEW; END $$`);
  await sql.unsafe(`CREATE TRIGGER ${fault} BEFORE INSERT ON public.invoices FOR EACH ROW EXECUTE FUNCTION private.${fault}()`);
  try{
    expect(await withSession(full,()=>cancelInvoiceAction(input))).toMatchObject({code:'UNAVAILABLE'});
    const [current]=await sql`SELECT order_number FROM public.orders WHERE tenant_id=${tenant} AND id=${order.orderId}`;
    expect(current?.order_number).toBeTruthy();
    expect(await pruefeZusage(authorization.data,plan)).toEqual({
      frei:false,grund:'neuausstellung',
      text:`Die Rechnung zu ${current.order_number} stellen wir gerade neu aus. Wir melden uns zur Abholung bis 30.11.2026.`,
      hinweis:'Im Ausgang: Abholung erst nach neuer Rechnung.',
    });
    expect(await pruefeZusage(authorization.data,{...plan,antwortBis:undefined})).toMatchObject({
      frei:false,grund:'neuausstellung',text:expect.stringMatching(/Wir melden uns zur Abholung\.$/),
    });
  }finally{
    await sql.unsafe(`DROP TRIGGER ${fault} ON public.invoices`);
    await sql.unsafe(`DROP FUNCTION private.${fault}()`);
  }
  expect(await withSession(full,()=>cancelInvoiceAction(JSON.parse(JSON.stringify(input))))).toMatchObject({code:'OK'});
  expect(await pruefeZusage(authorization.data,plan)).toEqual({frei:true});
});

it('uses the same incoming invoice evidence to stop a second registration',async()=>{
  const {createCustomerAction}=await import('@/app/actions/customers.actions');
  const {prepareIntakeFileAction,finishIntakeFileAction,getIncomingInvoiceAction,saveIncomingInvoiceAction}=await import('@/app/actions/eingang.actions');
  const {createElement}=await import('react');
  const {Document,Page,Text,renderToBuffer}=await import('@react-pdf/renderer');
  const address=`TEST-S1-${randomUUID()}@example.invalid`;
  const supplier=await withSession(full,()=>createCustomerAction({clientEventId:randomUUID(),customerType:'lieferant',
    companyName:'TEST S-1 Lieferantenbeleg',country:'DE',email:address}));
  if(supplier.code!=='OK')throw Error('TEST_S1_SUPPLIER_REQUIRED');
  const customerId=supplier.receipt.customerId,number=`TEST-S1-${randomUUID()}`;
  const ocrHost=process.env.AZURE_DOCINTEL_ENDPOINT?new URL(process.env.AZURE_DOCINTEL_ENDPOINT).hostname:null;
  const captureDocument=async(originalText:string)=>{
    const itemId=randomUUID(),fileId=randomUUID();
    const bytes=await renderToBuffer(createElement(Document,null,
      createElement(Page,null,createElement(Text,null,number+' '+originalText))));
    const grant=await withSession(full,()=>prepareIntakeFileAction({itemId,fileId,name:'TEST-S1-Beleg.pdf',mime:'application/pdf',
      bytes:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex'),captureOrigin:'dokument'}));
    if(grant.code!=='OK'||!grant.upload)throw Error('TEST_S1_DOCUMENT_GRANT_REQUIRED:'+grant.code);
    const url=new URL(`/storage/v1/object/upload/sign/${grant.upload.bucket}/${grant.upload.path}`,process.env.NEXT_PUBLIC_SUPABASE_URL);
    if(url.hostname!=='127.0.0.1')throw Error('TEST_LOOPBACK_ONLY');
    url.searchParams.set('token',grant.upload.token);
    expect((await nativeFetch(url,{method:'PUT',headers:{'content-type':'application/pdf','x-upsert':'false'},body:new Uint8Array(bytes)})).ok).toBe(true);
    const recognition=vi.spyOn(globalThis,'fetch').mockImplementation((request,init)=>{
      const api=new URL(typeof request==='string'?request:request instanceof URL?request.href:request.url);
      return ocrHost&&api.hostname===ocrHost?Promise.resolve(new Response('TEST OCR unavailable',{status:503})):nativeFetch(request,init);
    });
    try{expect(await withSession(full,()=>finishIntakeFileAction(fileId))).toMatchObject({code:'OK',capture:{
      files:expect.arrayContaining([expect.objectContaining({id:fileId,secured:true})]),
    }});}finally{recognition.mockRestore();}
    // Isolated contact fixture. The document and its storage receipt are real.
    await sql`UPDATE public.intake_item SET kunde_id=${customerId},zuordnung='hand',absender_adresse=${address}
      WHERE tenant_id=${tenant} AND id=${itemId}::uuid`;
    const view=await withSession(full,()=>getIncomingInvoiceAction({id:itemId}));
    if(view.code!=='OK')throw Error('TEST_S1_INVOICE_VIEW_REQUIRED');
    return {itemId,fileId,version:view.view.item.version};
  };
  // Isolated OCR fixture. The invoice writer and duplicate reader are real.
  const recognizeNumber=({itemId,fileId}:Awaited<ReturnType<typeof captureDocument>>)=>sql`
    INSERT INTO public.intake_suggestion(tenant_id,item_id,file_id,feld,wert,sicherheit,status)
    VALUES(${tenant},${itemId}::uuid,${fileId}::uuid,'rechnung.nummer',${sql.json(number)}::jsonb,'sicher','offen')`;
  const document=await captureDocument('TEST Original vom Lieferanten');
  const {itemId,fileId,version}=document;
  const authorization=await withSession(full,()=>resolveAuthorization());
  if(!authorization.ok)throw Error('TEST_S1_INVOICE_AUTH_REQUIRED');
  const plan={art:'beleg_dublette' as const,anliegen:'A19',wirkung:'rechnung_im_belegzugang_ablegen',
    sourceItemId:itemId,sourceVersion:version,customerId};
  expect(await pruefeZusage(authorization.data,plan)).toEqual({frei:false,grund:'unbekannt',text:MAIL_PROMISE_COPY.pending.beleg_dublette});
  await recognizeNumber(document);
  expect(await pruefeZusage(authorization.data,plan)).toEqual({frei:true});
  expect(await pruefeZusage(authorization.data,{...plan,wirkung:'lieferschein_an_bestellung_ablegen'})).toMatchObject({frei:false});
  const saved=await withSession(full,()=>saveIncomingInvoiceAction({itemId,fileId,version:plan.sourceVersion,clientKey:randomUUID(),
    fields:{lieferantId:customerId,nummer:number,datum:'2026-11-25',netto:'100,00',ust:'19,00',brutto:'119,00',
      faelligAm:'2026-11-30',iban:'',ibanGeprueft:false},status:'offen',paidDate:null,proofFileId:null,
    duplicateId:null,duplicateReason:null,unclearReason:null}));
  expect(saved).toMatchObject({code:'OK'});
  const current=await withSession(full,()=>getIncomingInvoiceAction({id:itemId}));
  if(current.code!=='OK')throw Error('TEST_S1_SAVED_INVOICE_REQUIRED');
  expect(await pruefeZusage(authorization.data,{...plan,sourceVersion:current.view.item.version})).toEqual({
    frei:false,grund:'beleg_dublette',text:MAIL_PROMISE_COPY.duplicateDocument,
  });
  const other=await captureDocument('TEST Separater Scan derselben Rechnung');
  await recognizeNumber(other);
  expect(await pruefeZusage(authorization.data,{...plan,sourceItemId:other.itemId,sourceVersion:other.version})).toEqual({
    frei:false,grund:'beleg_dublette',text:MAIL_PROMISE_COPY.duplicateDocument,
  });
});

it('reads the actual station and authorized material value without cancelling the order',async()=>{
  const {orderId,customerId,version}=await readyOrderForInvoice('TEST S-1 Stornoübersicht');
  const {bucheAuftragsverbrauchAction}=await import('@/app/actions/lager.actions');
  const [flag]=await sql<{enabled:boolean}[]>`SELECT enabled FROM public.feature_flags WHERE id='p4_lager'`;
  if(!flag)throw Error('TEST_S1_STOCK_FLAG_REQUIRED');
  await sql`UPDATE public.feature_flags SET enabled=true WHERE id='p4_lager'`;
  try{
    // Synthetic stock master data; consumption uses the normal journal action.
    const [category]=await sql`INSERT INTO public.categories (tenant_id,name)
      VALUES (${tenant},'TEST S-1 Material') RETURNING id::text`;
    const [location]=await sql`INSERT INTO public.stock_locations (tenant_id,stockwerk,bereich)
      VALUES (${tenant},'TEST EG','TEST S-1 Material') RETURNING id::text`;
    const articleId='TEST-'+randomUUID();
    await sql`INSERT INTO public.inventory_items (id,tenant_id,name,category,basiseinheit,rubrik_id)
      VALUES (${articleId},${tenant},'TEST S-1 Gestell','chemical','stk',${category.id}::uuid)`;
    await sql`INSERT INTO public.material_prices (tenant_id,artikel_id,einzelpreis,waehrung,quelle,gueltig_ab,bestaetigt_am)
      VALUES (${tenant},${articleId},3.40,'EUR','manuell',statement_timestamp()-interval '1 day',statement_timestamp()-interval '1 day')`;
    await sql`UPDATE public.company_settings SET entnahme_regel_je_rubrik=${sql.json({[category.id]:'verbrauch'})}::jsonb,
      bilanzbewertung_methode='letzter_ek',material_aufschlag_prozent=20,lager_regelversion='TEST-S1' WHERE tenant_id=${tenant}`;
    const admin=await createFixture(['mails','auftraege','lager.stamm'],'admin');
    const booked=await withSession(admin,()=>bucheAuftragsverbrauchAction({orderId,inventoryItemId:articleId,
      einheit:'stk',quantity:'2',imPreisEnthalten:true,ortId:location.id,revision:1,befehlId:randomUUID(),
      fachzeit:new Date(Date.now()-5000).toISOString(),mengenqualitaet:'exakt',movementType:'consumption',geschaeftsgrund:'verbrauch'}));
    if(!booked.ok)throw Error('TEST_S1_MATERIAL_NOT_BOOKED:'+booked.error);
    const authorization=await withSession(admin,()=>resolveAuthorization());
    const restricted=await withSession(full,()=>resolveAuthorization());
    if(!authorization.ok||!restricted.ok)throw Error('TEST_S1_STORNO_AUTH_REQUIRED');
    const [order]=await sql`SELECT order_number,version FROM public.orders WHERE tenant_id=${tenant} AND id=${orderId}`;
    const snapshot=await leser.verbrauch(authorization.data,orderId);
    expect(snapshot).toMatchObject([{wertEur:'8.16',preisFehlt:false,vorlaeufig:false}]);
    const input={art:'storno' as const,orderId,customerId,sourceItemId:await originalFixture(customerId)};
    expect(await pruefeZusage(authorization.data,input)).toEqual({frei:false,grund:'storno',
      text:MAIL_PROMISE_COPY.cancellation(),hinweis:MAIL_PROMISE_COPY.cancellationHint(order.order_number,'Fertig','8,16\u00a0€')});
    expect(await pruefeZusage(restricted.data,input)).toEqual({frei:false,grund:'storno',
      text:MAIL_PROMISE_COPY.cancellation(),hinweis:MAIL_PROMISE_COPY.cancellationHint(order.order_number,'Fertig',null)});
    expect(await sql`SELECT version FROM public.orders WHERE tenant_id=${tenant} AND id=${orderId}`).toEqual([{version}]);
  }finally{
    await sql`UPDATE public.feature_flags SET enabled=${flag.enabled} WHERE id='p4_lager'`;
  }
});

it('blocks unpaid prepayment and allows it after the real payment with or without amount visibility',async()=>{
  await completeInvoiceSettingsFixture();
  const {customerId,orderId,invoice}=await readyInvoiceOrder('TEST S-1 Vorkasse');
  const {setPaymentModeAction,confirmPaymentAction}=await import('@/app/actions/payments.actions');
  expect(await withSession(full,()=>setPaymentModeAction({orderId,paymentMode:'vorkasse',expectedVersion:0,
    clientEventId:randomUUID()}))).toMatchObject({code:'OK'});
  const approver=await createFixture(['mails','auftraege','entscheiden']);
  const [authorized,limited]=await Promise.all([
    withSession(full,()=>resolveAuthorization()),withSession(approver,()=>resolveAuthorization()),
  ]);
  if(!authorized.ok||!limited.ok)throw Error('TEST_S1_PREPAYMENT_AUTH_REQUIRED');
  const input={art:'herausgabe' as const,customerId,orderId,sourceItemId:await originalFixture(customerId)};
  expect(await pruefeZusage(authorized.data,input)).toMatchObject({frei:false,grund:'vorkasse',text:expect.stringContaining('€')});
  expect(await pruefeZusage(limited.data,input)).toEqual({frei:false,grund:'vorkasse',text:'Abholung erst nach Zahlungseingang.'});
  const previous=await intakeOrderFixture('TEST S-1 offener Altauftrag',customerId);
  const earlierInvoiceId=randomUUID();
  // Explicit synthetic historical debt. The current bill comes from the real invoice action.
  await sql`INSERT INTO public.invoices(id,tenant_id,order_id,customer_id,invoice_number,amount_total,status,
    due_date,gross_amount_cents,payment_contract_version,payment_mode,payment_status,payment_open_amount_cents,
    payment_paid_amount_cents,payment_currency,payment_version)
    VALUES(${earlierInvoiceId}::uuid,${tenant},${previous.receipt.orderId},${customerId},'R-2025-0813',60,'issued',
      (statement_timestamp() AT TIME ZONE 'Europe/Berlin')::date-1,6000,1,'rechnung','offen',6000,0,'EUR',0)`;
  const [current]=await sql`SELECT order_number FROM public.orders WHERE tenant_id=${tenant} AND id=${orderId}`;
  const blocked=await pruefeZusage(authorized.data,input);
  expect(blocked).toMatchObject({frei:false,grund:'liefersperre',text:expect.stringContaining('R-2025-0813')});
  expect(blocked).toMatchObject({text:expect.stringContaining(current.order_number),
    hinweis:expect.stringContaining('R-2025-0813 + '+current.order_number)});
  expect(await pruefeZusage(limited.data,input)).toEqual({frei:false,grund:'liefersperre',text:'Abholung erst nach Zahlung.'});
  // Move only the isolated historical fixture out of the overdue class.
  expect(await sql`UPDATE public.invoices SET due_date=(statement_timestamp() AT TIME ZONE 'Europe/Berlin')::date+1
    WHERE tenant_id=${tenant} AND id=${earlierInvoiceId}::uuid RETURNING id::text`).toEqual([{id:earlierInvoiceId}]);
  expect(await withSession(full,()=>confirmPaymentAction({invoiceId:invoice.invoiceId,amount:invoice.grossAmountCents,
    expectedVersion:0,method:'bar',clientEventId:randomUUID()}))).toMatchObject({code:'OK'});
  expect(await pruefeZusage(authorized.data,input)).toEqual({frei:true});
  expect(await pruefeZusage(limited.data,input)).toEqual({frei:true});
});
