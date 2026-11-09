import {randomUUID} from 'node:crypto';
import {expect,it} from 'vitest';
import {KREILE_TENANT_SLUG} from '@/lib/tenant';
import {sql,full,withSession,createFixture} from './replayHarness';
import {customerFixture} from './orderFixture';
import {storeIntakeGoodsPhoto,storeOrderPhoto} from './photoFixture';

it('H1 new quote revisions bind unit, position minutes and company VAT instead of reading later settings',async()=>{
 const customerId=await customerFixture('H1-Terms');
 // Isolated TEST configuration; the quote write and read ports themselves are real.
 await sql`INSERT INTO public.company_settings(id,tenant_id,company_name,invoice_vat_rate_basis_points) VALUES(${randomUUID()},${KREILE_TENANT_SLUG},'TEST KV Satz',700)`;
 const {createQuoteAction,readQuoteAction,updateQuoteAction}=await import('@/app/actions/quotes.actions');
 const position={name:'TEST Fassung Teil',quantity:4,material:'Messing',surfaceRequested:'verchromen',unitPriceCents:2500,lineTotalCents:10000,unit:'stueck',plannedMinutes:120};
 const input={clientEventId:randomUUID(),customerId,dueDate:'2027-05-15',note:'TEST gebundene Fassung',positions:[position]};
 const created=await withSession(full,()=>createQuoteAction(input));
 expect(created,JSON.stringify(created)).toMatchObject({code:'OK',quote:{positions:[{unit:'stueck',plannedMinutes:120,vatRateBasisPoints:700}]}});
 if(created.code!=='OK')throw Error('H1_TERMS_CREATE:'+created.code);
 const quoteId=created.quote.quoteId;
 await sql`UPDATE public.company_settings SET invoice_vat_rate_basis_points=1900 WHERE tenant_id=${KREILE_TENANT_SLUG}`;
 expect(await withSession(full,()=>readQuoteAction({quoteId}))).toMatchObject({code:'OK',quote:{positions:[{unit:'stueck',plannedMinutes:120,vatRateBasisPoints:700}]}});
 expect(await withSession(full,()=>createQuoteAction(structuredClone(input)))).toMatchObject({code:'OK',replayed:true,quote:{positions:[{vatRateBasisPoints:700}]}});
 const update={quoteId,expectedVersion:1,clientEventId:randomUUID(),dueDate:'2027-05-15',note:input.note,positions:[{...position,plannedMinutes:90}]};
 const changed=await withSession(full,()=>updateQuoteAction(update));
 expect(changed).toMatchObject({code:'OK',quote:{version:2,positions:[{unit:'stueck',plannedMinutes:90,vatRateBasisPoints:1900}]}});
 expect(await sql`SELECT revision,unit,aufwand_min,vat_rate_basis_points FROM private.quote_positions WHERE tenant_id=${KREILE_TENANT_SLUG} AND quote_id=${quoteId}::uuid ORDER BY revision`).toEqual([{revision:1,unit:'stueck',aufwand_min:120,vat_rate_basis_points:700},{revision:2,unit:'stueck',aufwand_min:90,vat_rate_basis_points:1900}]);
 expect(await withSession(full,()=>readQuoteAction({quoteId}))).toMatchObject({code:'OK',quote:{positions:[{plannedMinutes:90}]}});
 expect(await withSession(full,()=>updateQuoteAction(structuredClone(update)))).toMatchObject({code:'OK',replayed:true});
 await sql`UPDATE public.company_settings SET invoice_vat_rate_basis_points=700 WHERE tenant_id=${KREILE_TENANT_SLUG}`;
 const {unit:_unit,plannedMinutes:_minutes,...legacyPosition}=position;void _unit;void _minutes;
 expect(await withSession(full,()=>updateQuoteAction({quoteId,expectedVersion:2,clientEventId:randomUUID(),dueDate:'2027-05-20',note:input.note,positions:[legacyPosition]}))).toMatchObject({code:'OK',quote:{version:3,positions:[{unit:'stueck',plannedMinutes:90,vatRateBasisPoints:1900}]}});
});

it.each([700,null] as const)('H1 partial goods keep a flat amount, allocate time and resolve awarded VAT %s without a guessed default',async(initialRate)=>{
 const customerId=await customerFixture('H1-Partial');
 await sql`INSERT INTO public.company_settings(id,tenant_id,company_name) SELECT ${randomUUID()},${KREILE_TENANT_SLUG},'TEST Teilmenge' WHERE NOT EXISTS(SELECT 1 FROM public.company_settings WHERE tenant_id=${KREILE_TENANT_SLUG})`;
 await sql`UPDATE public.company_settings SET company_name='TEST Teilmenge',street='TEST Weg 1',zip='70176',city='Stuttgart',country='DE',iban='DE02120300000000202051',bic='BYLADEM1001',bank_name='TEST Bank',tax_id='DE123456789',invoice_vat_rate_basis_points=${initialRate},invoice_payment_term_days=14 WHERE tenant_id=${KREILE_TENANT_SLUG}`;
 const {createQuoteAction,readQuoteAction,changeQuoteLifecycleAction,convertQuoteToOrderAction}=await import('@/app/actions/quotes.actions');
 const created=await withSession(full,()=>createQuoteAction({clientEventId:randomUUID(),customerId,dueDate:'2027-05-15',note:'TEST Teilmenge',calculation:{hours:'1.0000',hourlyRateCents:10000,setupCents:0,materialCents:0},positions:[{name:'TEST Pauschalbearbeitung',quantity:4,material:'Messing',surfaceRequested:'verchromen',unitPriceCents:1875,lineTotalCents:7500,unit:null},{name:'TEST Stückbearbeitung',quantity:2,material:'Messing',surfaceRequested:'verchromen',unitPriceCents:1250,lineTotalCents:2500,unit:'stueck'}]}));
 if(created.code!=='OK')throw Error('H1_PARTIAL_CREATE:'+created.code);
 const quoteId=created.quote.quoteId;
 expect(await withSession(full,()=>changeQuoteLifecycleAction({quoteId,expectedVersion:1,edition:1,clientEventId:randomUUID(),action:'sent',channel:'druck',evidence:'TEST ausgehändigt'}))).toMatchObject({code:'OK'});
 const operator=await createFixture(['eingang'],'werkstatt');
 expect(await withSession(operator,()=>changeQuoteLifecycleAction({quoteId,expectedVersion:2,edition:1,clientEventId:randomUUID(),action:'accept',evidence:'TEST telefonisch zugesagt'}))).toMatchObject({code:'OK'});
 if(initialRate!==null)await sql`UPDATE public.company_settings SET invoice_vat_rate_basis_points=1900 WHERE tenant_id=${KREILE_TENANT_SLUG}`;
 const quote=await withSession(full,()=>readQuoteAction({quoteId}));if(quote.code!=='OK')throw Error('H1_PARTIAL_READ:'+quote.code);
 const overview=await storeIntakeGoodsPhoto(undefined,operator),parts=await storeIntakeGoodsPhoto(overview.itemId,operator);
 const {getIntakeCaptureAction}=await import('@/app/actions/eingang.actions');
 const capture=await withSession(full,()=>getIntakeCaptureAction(overview.itemId));if(capture.code!=='OK')throw Error('H1_PARTIAL_CAPTURE');
 const goods={id:randomUUID(),clientKey:randomUUID(),clientEventId:randomUUID(),itemId:overview.itemId,quoteId,expectedQuoteVersion:3,sourceVersion:capture.capture.version,expectedVersion:0,mode:'erfassung' as const,command:'accept' as const,card:1,packagesReceived:1,packagesTotal:1,condition:'unauffaellig' as const,deviations:[],foundUnattended:false,foundAt:null,procedure:'stimmt' as const,procedureNote:null,photos:[{fileId:overview.fileId,kind:'uebersicht' as const},{fileId:parts.fileId,kind:'teile' as const}],location:'TEST Regal Teilmenge',quantities:quote.quote.positions.map((row,index)=>({itemId:row.id,expected:row.quantity,received:index===0?2:null,confirmed:index!==0,note:index===0?'TEST zwei von vier da':null}))};
 const award={quoteId,clientEventId:randomUUID(),expectedVersion:3,confirmedAward:true as const,confirmedOrderDueDate:'2027-05-15',handoverMode:'pickup' as const,paymentMode:'rechnung' as const,goodsReceiptId:goods.id};
 const converted=await withSession(operator,()=>convertQuoteToOrderAction(award,goods));
 expect(converted,JSON.stringify(converted)).toMatchObject({code:'OK'});if(converted.code!=='OK')throw Error('H1_PARTIAL_CONVERT:'+converted.code);
 const orderId=converted.orderReceipt.orderId;
 expect(converted.orderReceipt.items.every(row=>row.unitPriceCents===null&&row.vatRateBasisPoints===null)).toBe(true);
 const {getLiveOrderCardAction,transitionWareneingangToGalvanikAction,setOrderItemFinishedAction,getExtraWorkMasterDataAction,setExtraWorkHourlyRateAction,freezeOrderAction}=await import('@/app/actions/orders.actions');
 const card=await withSession(full,()=>getLiveOrderCardAction({orderId}));
 expect(card).toMatchObject({code:'OK',data:{card:{commercialQuote:{totalNetCents:10000,vatRateBasisPoints:initialRate,plannedHours:'0.6333',hints:[{code:'FLAT_QUOTE_PARTIAL',text:'Pauschale bei Teilmenge prüfen'}],positions:[{quantity:2,lineTotalCents:7500,plannedMinutes:23,flatPartial:true},{quantity:2,lineTotalCents:2500,plannedMinutes:15}]}}}});
 expect(await withSession(operator,()=>convertQuoteToOrderAction(structuredClone(award),structuredClone(goods)))).toMatchObject({code:'OK',replayed:true});
 expect(await sql`SELECT user_id::text FROM public.events WHERE tenant_id=${KREILE_TENANT_SLUG} AND order_id=${orderId} AND event_type='QUOTE_MINUTES_FROM_TOTAL_V1'`).toEqual([{user_id:operator.actorId}]);
 const moved=await withSession(full,()=>transitionWareneingangToGalvanikAction({orderId,expectedVersion:1,clientEventId:randomUUID()}));if(moved.code!=='OK')throw Error('H1_PARTIAL_MOVE');
 let version=moved.receipt.aggregateVersion;
 for(const item of converted.orderReceipt.items){const done=await withSession(full,()=>setOrderItemFinishedAction({orderId,itemId:item.id,expectedVersion:version,clientEventId:randomUUID(),finished:true}));if(done.code!=='OK')throw Error('H1_PARTIAL_FINISH');version=done.receipt.aggregateVersion;}
 const master=await withSession(full,()=>getExtraWorkMasterDataAction());if(master.code!=='OK')throw Error('H1_PARTIAL_MASTER');
 if(!master.data.currentRate)expect(await withSession(full,()=>setExtraWorkHourlyRateAction({rateId:randomUUID(),expectedVersion:0,hourlyRateCents:14000,clientEventId:randomUUID()}))).toMatchObject({code:'OK'});
 await storeOrderPhoto(orderId);
 const frozen=await withSession(full,()=>freezeOrderAction({orderId,expectedVersion:version,freezeId:randomUUID(),clientEventId:randomUUID()}));if(frozen.code!=='OK')throw Error('H1_PARTIAL_FREEZE');
 const {issueInvoiceAction}=await import('@/app/actions/invoices.actions');
 const issue={orderId,expectedVersion:frozen.receipt.aggregateVersion,clientEventId:randomUUID()};
 if(initialRate===null){
  expect(await withSession(full,()=>issueInvoiceAction(issue))).toMatchObject({code:'VALIDATION_ERROR',message:'Steuersatz in Firmendaten eintragen'});
  expect(await sql`SELECT count(*)::integer AS n FROM public.invoices WHERE tenant_id=${KREILE_TENANT_SLUG} AND order_id=${orderId}`).toEqual([{n:0}]);
  expect(await sql`SELECT count(*)::integer AS n FROM public.events WHERE tenant_id=${KREILE_TENANT_SLUG} AND client_event_id=${issue.clientEventId}::uuid`).toEqual([{n:0}]);
  expect(await withSession(full,()=>getLiveOrderCardAction({orderId}))).toMatchObject({code:'OK',data:{card:{version:issue.expectedVersion}}});
  await sql`UPDATE public.company_settings SET invoice_vat_rate_basis_points=700 WHERE tenant_id=${KREILE_TENANT_SLUG}`;
 }
 const invoice=await withSession(full,()=>issueInvoiceAction(structuredClone(issue)));
 expect(invoice,JSON.stringify(invoice)).toMatchObject({code:'OK'});
 expect(await sql`SELECT net_amount_cents::integer AS net,vat_rate_basis_points AS vat,gross_amount_cents::integer AS gross FROM public.invoices WHERE tenant_id=${KREILE_TENANT_SLUG} AND order_id=${orderId}`).toEqual([{net:10000,vat:700,gross:10700}]);
 if(initialRate===null)expect(await sql`SELECT user_id::text,payload->>'vatRateBasisPoints' AS rate FROM public.events WHERE tenant_id=${KREILE_TENANT_SLUG} AND order_id=${orderId} AND event_type='QUOTE_VAT_FROM_COMPANY_V1'`).toEqual([{user_id:full.actorId,rate:'700'}]);
});
