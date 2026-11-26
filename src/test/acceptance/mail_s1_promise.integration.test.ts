// @vitest-environment node
import {randomUUID} from 'node:crypto';
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
import {leseLagerAuftragsmaterialInTransaction} from '@/modules/lager/server-public';
import {MAIL_PROMISE_COPY} from '@/ui/eingangMailCopy';
import {pruefeZusage as zusage,recordZusageAusnahmeInTransaction,type ZusageLeser} from '@/modules/eingang/server-public';

const leser:ZusageLeser={
  termin:(auth,input)=>readIntakeSuggestions(auth,input,readBetriebsruheInTransaction),
  kv:async(auth,quoteId)=>{
    const result=await readQuoteCommand(quoteOperationContext(auth),{quoteId});
    return result.code==='OK'?result.quote:null;
  },
  verbrauch:(auth,orderId)=>withPrivilegedTenantTransaction(auth,tx=>leseLagerAuftragsmaterialInTransaction(tx,orderId)),
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
  expect(await readCustomerDeliveryBlock(auth,customerId)).toMatchObject({code:'OK',data:{blocked:true,invoiceIds:[invoiceId]}});
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
  const {confirmPaymentAction}=await import('@/app/actions/payments.actions');
  expect(await withSession(full,()=>confirmPaymentAction({invoiceId,amount:6000,method:'bar',
    expectedVersion:0,clientEventId:randomUUID()}))).toMatchObject({code:'OK'});
  expect(await pruefeZusage(auth,input)).toEqual({frei:true});
  expect(await readCustomerDeliveryBlock(auth,customerId)).toMatchObject({code:'OK',data:{blocked:false,invoiceIds:[]}});
  expect(await record(authorization.data,{...exception,clientEventId:randomUUID()})).toEqual({code:'CONFLICT'});
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
  // Simulate a failed dependency at the planning reader boundary only.
  const unavailable={...leser,termin:async()=>{throw Error('TEST_S1_PLANNING_READ_FAILED');}};
  expect(await zusage(authorized.data,input,unavailable)).toMatchObject({frei:false,grund:'unbekannt'});
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
  expect(await pruefeZusage(authorization.data,{art:'herausgabe',customerId,orderId:order.receipt.orderId})).toMatchObject({
    frei:false,grund:'reklamation',text:expect.stringContaining(number),
  });
  const {nacharbeitAnlegenAction}=await import('@/app/actions/complaints.actions');
  const work=await withSession(actor,()=>nacharbeitAnlegenAction({reklamationId:complaintId,version:1,
    bewertung:'berechtigt',massnahme:'nacharbeit',liefertermin:'2027-05-18'}));
  if(work.code!=='OK')throw Error('TEST_S1_REWORK:'+work.code+':'+work.message);
  expect(await readCustomerDeliveryBlock(authorization.data,customerId,work.receipt.orderId)).toMatchObject({
    code:'OK',paymentMode:'keiner',data:{blocked:false},
  });
  expect(await pruefeZusage(authorization.data,{art:'herausgabe',customerId,orderId:work.receipt.orderId})).toEqual({frei:true});
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

it('uses a secured incoming original for the phone handoff and only allows the connected mail channel',async()=>{
  const {getOpenIntakeMailsAction}=await import('@/app/actions/eingang.actions');
  const sender='TEST S-1 Absender';
  const address='test-s1-'+randomUUID()+'@example.invalid';
  const body='TEST: Bitte neue Bankdaten telefonisch abstimmen.';
  const message={
    id:'TEST-S1-'+randomUUID(),internetMessageId:`<${address}>`,subject:'TEST S-1 Neue Bankverbindung',
    from:{emailAddress:{name:sender,address}},receivedDateTime:new Date().toISOString(),bodyPreview:body,
    body:{contentType:'text',content:body},hasAttachments:false,
  };
  await sql`INSERT INTO public.company_settings(id,tenant_id,company_name)
    SELECT ${randomUUID()},${tenant},'TEST S-1 Mail' WHERE NOT EXISTS(SELECT 1 FROM public.company_settings WHERE tenant_id=${tenant})`;
  // Only the external mailbox response is synthetic. Intake and MIME storage use the usual writer.
  vi.spyOn(globalThis,'fetch').mockImplementation(async(input,init)=>{
    const url=new URL(typeof input==='string'?input:input instanceof URL?input.href:input.url);
    if(url.hostname==='login.microsoftonline.com')return Response.json({access_token:'TEST-S1-mail-provider-token'.repeat(3)});
    if(url.hostname!=='graph.microsoft.com')return nativeFetch(input,init);
    if(url.pathname.includes('/mailFolders/inbox/messages'))return Response.json({value:[message]});
    if(url.pathname.endsWith('/$value'))return new Response(`From: ${address}\r\nMessage-ID: ${message.internetMessageId}\r\nSubject: ${message.subject}\r\n\r\n${body}`);
    if(url.pathname.endsWith('/attachments'))return Response.json({value:[]});
    return Response.json(message);
  });
  expect(await withSession(full,()=>getOpenIntakeMailsAction())).toMatchObject({code:'OK'});
  const [source]=await sql`SELECT item.id::text, item.version FROM public.intake_item item
    JOIN public.intake_file file ON file.tenant_id=item.tenant_id AND file.item_id=item.id AND file.mime='message/rfc822'
    WHERE item.tenant_id=${tenant} AND item.graph_message_id=${message.id}`;
  if(!source)throw Error('TEST_S1_BANK_ORIGINAL_REQUIRED');
  const authorization=await withSession(full,()=>resolveAuthorization());
  if(!authorization.ok)throw Error('TEST_S1_BANK_AUTH_REQUIRED');
  const input={art:'stammdaten' as const,sourceItemId:source.id};
  const text=MAIL_PROMISE_COPY.verifyBankDetails(sender);
  expect(await pruefeZusage(authorization.data,input)).toEqual({
    frei:false,grund:'stammdaten',text,ausweg:{befehl:'saveIntakeTaskAction',text},
  });
  expect(await pruefeZusage(authorization.data,{...input,sourceItemId:randomUUID()})).toMatchObject({frei:false,grund:'unbekannt'});
  expect(await pruefeZusage(authorization.data,{art:'kanal_versand',kanal:'mail'})).toEqual({frei:true});
  expect(await pruefeZusage(authorization.data,{art:'kanal_versand',kanal:'whatsapp'})).toMatchObject({frei:false,grund:'unbekannt'});
  expect(await sql`SELECT version FROM public.intake_item WHERE tenant_id=${tenant} AND id=${source.id}::uuid`).toEqual([{version:source.version}]);
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
    const input={art:'storno' as const,orderId,customerId};
    expect(await pruefeZusage(authorization.data,input)).toEqual({frei:false,grund:'storno',
      text:MAIL_PROMISE_COPY.cancellation(order.order_number,'Fertig','8,16\u00a0€')});
    expect(await pruefeZusage(restricted.data,input)).toEqual({frei:false,grund:'storno',
      text:MAIL_PROMISE_COPY.cancellation(order.order_number,'Fertig',null)});
    expect(await sql`SELECT version FROM public.orders WHERE tenant_id=${tenant} AND id=${orderId}`).toEqual([{version}]);
  }finally{
    await sql`UPDATE public.feature_flags SET enabled=${flag.enabled} WHERE id='p4_lager'`;
  }
});

it('blocks unpaid prepayment and allows it after the real payment with or without amount visibility',async()=>{
  // Reuse the company row from the planning case in a full file run.
  await sql`UPDATE public.company_settings SET street='TEST Weg 1',zip='70176',city='Stuttgart',country='Deutschland',
    iban='DE02120300000000202051',bic='BYLADEM1001',bank_name='TEST Bank',tax_id='DE123456789',
    invoice_vat_rate_basis_points=1900,invoice_payment_term_days=14 WHERE tenant_id=${tenant}`;
  const {customerId,orderId,invoice}=await readyInvoiceOrder('TEST S-1 Vorkasse');
  const {setPaymentModeAction,confirmPaymentAction}=await import('@/app/actions/payments.actions');
  expect(await withSession(full,()=>setPaymentModeAction({orderId,paymentMode:'vorkasse',expectedVersion:0,
    clientEventId:randomUUID()}))).toMatchObject({code:'OK'});
  const approver=await createFixture(['mails','auftraege','entscheiden']);
  const [authorized,limited]=await Promise.all([
    withSession(full,()=>resolveAuthorization()),withSession(approver,()=>resolveAuthorization()),
  ]);
  if(!authorized.ok||!limited.ok)throw Error('TEST_S1_PREPAYMENT_AUTH_REQUIRED');
  const input={art:'herausgabe' as const,customerId,orderId};
  expect(await pruefeZusage(authorized.data,input)).toMatchObject({frei:false,grund:'vorkasse',text:expect.stringContaining('€')});
  expect(await pruefeZusage(limited.data,input)).toEqual({frei:false,grund:'vorkasse',text:'Abholung erst nach Zahlung.',
    ausnahme:{recht:'entscheiden'}});
  expect(await withSession(full,()=>confirmPaymentAction({invoiceId:invoice.invoiceId,amount:invoice.grossAmountCents,
    expectedVersion:0,method:'bar',clientEventId:randomUUID()}))).toMatchObject({code:'OK'});
  expect(await pruefeZusage(authorized.data,input)).toEqual({frei:true});
  expect(await pruefeZusage(limited.data,input)).toEqual({frei:true});
});
