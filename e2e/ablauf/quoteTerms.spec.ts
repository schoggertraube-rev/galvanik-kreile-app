import {createHash,randomUUID} from 'node:crypto';
import {mkdirSync,writeFileSync} from 'node:fs';
import path from 'node:path';
import {expect,it} from 'vitest';
import {KREILE_TENANT_SLUG} from '@/lib/tenant';
import {sql,full,withSession,createFixture} from './replayHarness';
import {readInvoiceVat} from '@/modules/accounting/server-public';

it('H8 quote creation retry cannot switch customer, price or actor and rereads the one stored quote',async()=>{
 const {customerFixture}=await import('./orderFixture');
 const first=await customerFixture('KV-Key-1'),second=await customerFixture('KV-Key-2');
 const {createQuoteAction,readQuoteAction}=await import('@/app/actions/quotes.actions');
 const input={clientEventId:randomUUID(),customerId:first,dueDate:'2027-05-15',note:'TEST eindeutiger KV-Auftrag',positions:[{name:'TEST KV-Teil',quantity:1,material:'Messing',surfaceRequested:'verchromen',unitPriceCents:2500,lineTotalCents:2500}]};
 const created=await withSession(full,()=>createQuoteAction(input));
 if(created.code!=='OK')throw Error('QUOTE_KEY_INITIAL:'+created.code);
 const snapshot=await withSession(full,()=>readQuoteAction({quoteId:created.quote.quoteId}));
 expect(snapshot).toMatchObject({code:'OK',quote:{customerId:first,totalNetCents:2500}});
 expect(await withSession(full,()=>createQuoteAction({...structuredClone(input),customerId:second}))).toMatchObject({code:'CONFLICT'});
 expect(await withSession(full,()=>createQuoteAction({...structuredClone(input),positions:[{...input.positions[0],unitPriceCents:3500,lineTotalCents:3500}]}))).toMatchObject({code:'CONFLICT'});
 const other=await createFixture(['eingang','mails','kunden','auftraege','preise','zahlungen','buchhaltung','einstellungen']);
 expect(await withSession(other,()=>createQuoteAction(JSON.parse(JSON.stringify(input))))).toMatchObject({code:'CONFLICT'});
 expect(await withSession(full,()=>createQuoteAction(JSON.parse(JSON.stringify(input))))).toMatchObject({code:'OK',replayed:true,quote:{quoteId:created.quote.quoteId,customerId:first,totalNetCents:2500}});
 expect(await withSession(full,()=>readQuoteAction({quoteId:created.quote.quoteId}))).toEqual({...snapshot,serverReadAt:expect.any(String),cacheLoginScope:expect.stringMatching(/^[a-f0-9]{64}$/)});
 expect(await sql`SELECT count(*)::integer AS n FROM private.quotes WHERE tenant_id=${KREILE_TENANT_SLUG} AND customer_id IN (${first},${second})`).toEqual([{n:1}]);
 expect(await sql`SELECT user_id::text FROM public.events WHERE tenant_id=${KREILE_TENANT_SLUG} AND client_event_id=${input.clientEventId}::uuid`).toEqual([{user_id:full.actorId}]);
});
import {customerFixture} from './orderFixture';
import {storeIntakeGoodsPhoto,storeOrderPhoto,storeItemPhoto} from './photoFixture';

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

it.each([{mode:700,rounding:null},{mode:null,rounding:null},{mode:'changed',rounding:null},{mode:700,rounding:'full'},{mode:700,rounding:'partial'}] as const)('H1 partial goods scale unitless positions, allocate time and resolve awarded VAT $mode / $rounding',async({mode,rounding})=>{
 const sourceQuantity=rounding?3:4,receivedQuantity=rounding==='full'?3:2;
 const expectedNet=rounding==='full'?10000:rounding==='partial'?7500:6250;
 const expectedGross=rounding==='full'?10700:rounding==='partial'?8025:mode==='changed'?7438:6688;
 const initialRate=mode==='changed'?700:mode;
 const customerId=await customerFixture('H1-Partial');
 await sql`INSERT INTO public.company_settings(id,tenant_id,company_name) SELECT ${randomUUID()},${KREILE_TENANT_SLUG},'TEST Teilmenge' WHERE NOT EXISTS(SELECT 1 FROM public.company_settings WHERE tenant_id=${KREILE_TENANT_SLUG})`;
 await sql`UPDATE public.company_settings SET company_name='TEST Teilmenge',street='TEST Weg 1',zip='70176',city='Stuttgart',country='DE',iban='DE02120300000000202051',bic='BYLADEM1001',bank_name='TEST Bank',tax_id='DE123456789',invoice_vat_rate_basis_points=${initialRate},invoice_payment_term_days=14 WHERE tenant_id=${KREILE_TENANT_SLUG}`;
 const {createQuoteAction,readQuoteAction,updateQuoteAction,changeQuoteLifecycleAction,convertQuoteToOrderAction}=await import('@/app/actions/quotes.actions');
 const created=await withSession(full,()=>createQuoteAction({clientEventId:randomUUID(),customerId,dueDate:'2027-05-15',note:'TEST Teilmenge',calculation:{hours:'1.0000',hourlyRateCents:10000,setupCents:0,materialCents:0},positions:[{name:'TEST Bearbeitung ohne Einheit',quantity:sourceQuantity,material:'Messing',surfaceRequested:'verchromen',unitPriceCents:rounding?2500:1875,lineTotalCents:rounding?7501:7500,unit:null},{name:'TEST Stückbearbeitung',quantity:2,material:'Messing',surfaceRequested:'verchromen',unitPriceCents:1250,lineTotalCents:rounding?2499:2500,unit:'stueck'}]}));
 if(created.code!=='OK')throw Error('H1_PARTIAL_CREATE:'+created.code);
 const quoteId=created.quote.quoteId;
 let acceptedVersion=3;
 if(mode==='changed'){
  await sql`UPDATE public.company_settings SET invoice_vat_rate_basis_points=1900 WHERE tenant_id=${KREILE_TENANT_SLUG}`;
  const positions=created.quote.positions.map((row,index)=>({name:index===0?row.name+' neu':row.name,quantity:row.quantity,material:row.material,surfaceRequested:row.surfaceRequested,unitPriceCents:row.unitPriceCents,lineTotalCents:row.lineTotalCents,unit:row.unit??null}));
  expect(await withSession(full,()=>updateQuoteAction({quoteId,expectedVersion:1,clientEventId:randomUUID(),dueDate:'2027-05-15',note:'TEST Teilmenge',positions}))).toMatchObject({code:'OK',quote:{version:2,positions:[{vatRateBasisPoints:1900},{vatRateBasisPoints:1900}]}});
  acceptedVersion=4;
 }
 expect(await withSession(full,()=>changeQuoteLifecycleAction({quoteId,expectedVersion:acceptedVersion-2,edition:1,clientEventId:randomUUID(),action:'sent',channel:'druck',evidence:'TEST ausgehändigt'}))).toMatchObject({code:'OK'});
 const operator=await createFixture(['eingang'],'werkstatt');
 expect(await withSession(operator,()=>changeQuoteLifecycleAction({quoteId,expectedVersion:acceptedVersion-1,edition:1,clientEventId:randomUUID(),action:'accept',evidence:'TEST telefonisch zugesagt'}))).toMatchObject({code:'OK'});
 if(initialRate!==null)await sql`UPDATE public.company_settings SET invoice_vat_rate_basis_points=1900 WHERE tenant_id=${KREILE_TENANT_SLUG}`;
 const quote=await withSession(full,()=>readQuoteAction({quoteId}));if(quote.code!=='OK')throw Error('H1_PARTIAL_READ:'+quote.code);
 const overview=await storeIntakeGoodsPhoto(undefined,operator),parts=await storeIntakeGoodsPhoto(overview.itemId,operator);
 const {getIntakeCaptureAction}=await import('@/app/actions/eingang.actions');
 const capture=await withSession(full,()=>getIntakeCaptureAction(overview.itemId));if(capture.code!=='OK')throw Error('H1_PARTIAL_CAPTURE');
 const goods={id:randomUUID(),clientKey:randomUUID(),clientEventId:randomUUID(),itemId:overview.itemId,quoteId,expectedQuoteVersion:acceptedVersion,sourceVersion:capture.capture.version,expectedVersion:0,mode:'erfassung' as const,command:'accept' as const,card:1,packagesReceived:1,packagesTotal:1,condition:'unauffaellig' as const,deviations:[],foundUnattended:false,foundAt:null,procedure:'stimmt' as const,procedureNote:null,photos:[{fileId:overview.fileId,kind:'uebersicht' as const},{fileId:parts.fileId,kind:'teile' as const}],location:'TEST Regal Teilmenge',quantities:quote.quote.positions.map((row,index)=>({itemId:row.id,expected:row.quantity,received:index===0?receivedQuantity:null,confirmed:index!==0,note:index===0?'TEST zwei von vier da':null}))};
 const award={quoteId,clientEventId:randomUUID(),expectedVersion:acceptedVersion,confirmedAward:true as const,confirmedOrderDueDate:'2027-05-15',handoverMode:'pickup' as const,paymentMode:'rechnung' as const,goodsReceiptId:goods.id};
 const converted=await withSession(operator,()=>convertQuoteToOrderAction(award,goods));
 expect(converted,JSON.stringify(converted)).toMatchObject({code:'OK'});if(converted.code!=='OK')throw Error('H1_PARTIAL_CONVERT:'+converted.code);
 const orderId=converted.orderReceipt.orderId;
 expect(converted.orderReceipt.items.every(row=>row.unitPriceCents===null&&row.vatRateBasisPoints===null)).toBe(true);
 const {getLiveOrderCardAction,transitionWareneingangToGalvanikAction,setOrderItemFinishedAction,getExtraWorkMasterDataAction,setExtraWorkHourlyRateAction,freezeOrderAction}=await import('@/app/actions/orders.actions');
 const card=await withSession(full,()=>getLiveOrderCardAction({orderId}));
 expect(card).toMatchObject({code:'OK',data:{card:{commercialQuote:{totalNetCents:expectedNet,vatRateBasisPoints:mode==='changed'?1900:initialRate,plannedHours:rounding==='full'?'1.0000':null,positions:[{quantity:receivedQuantity,lineTotalCents:rounding==='full'?7501:rounding==='partial'?5001:3750,plannedMinutes:rounding==='full'?46:rounding==='partial'?31:23},{quantity:2,lineTotalCents:rounding?2499:2500,plannedMinutes:rounding?14:15}]}}}});
 expect(await withSession(operator,()=>convertQuoteToOrderAction(structuredClone(award),structuredClone(goods)))).toMatchObject({code:'OK',replayed:true});
 expect(await sql`SELECT user_id::text FROM public.events WHERE tenant_id=${KREILE_TENANT_SLUG} AND order_id=${orderId} AND event_type='QUOTE_MINUTES_FROM_TOTAL_V1'`).toEqual([{user_id:operator.actorId}]);
 const moved=await withSession(full,()=>transitionWareneingangToGalvanikAction({orderId,expectedVersion:1,clientEventId:randomUUID()}));if(moved.code!=='OK')throw Error('H1_PARTIAL_MOVE');
 let version=moved.receipt.aggregateVersion;
 for(const item of converted.orderReceipt.items){const done=await withSession(full,()=>setOrderItemFinishedAction({orderId,itemId:item.id,expectedVersion:version,clientEventId:randomUUID(),finished:true}));if(done.code!=='OK')throw Error('H1_PARTIAL_FINISH');version=done.receipt.aggregateVersion;}
 const master=await withSession(full,()=>getExtraWorkMasterDataAction());if(master.code!=='OK')throw Error('H1_PARTIAL_MASTER');
 if(!master.data.currentRate)expect(await withSession(full,()=>setExtraWorkHourlyRateAction({rateId:randomUUID(),expectedVersion:0,hourlyRateCents:14000,clientEventId:randomUUID()}))).toMatchObject({code:'OK'});
 await storeOrderPhoto(orderId);
 for(const item of converted.orderReceipt.items)await storeItemPhoto(orderId,item.id);
 const frozen=await withSession(full,()=>freezeOrderAction({orderId,expectedVersion:version,freezeId:randomUUID(),clientEventId:randomUUID()}));if(frozen.code!=='OK')throw Error('H1_PARTIAL_FREEZE');
 const {issueInvoiceAction}=await import('@/app/actions/invoices.actions');
 const issue={orderId,expectedVersion:frozen.receipt.aggregateVersion,clientEventId:randomUUID()};
 const quoteOriginals=await sql`SELECT id::text,revision,md5(to_jsonb(position)::text) AS hash FROM private.quote_positions position WHERE tenant_id=${KREILE_TENANT_SLUG} AND quote_id=${quoteId}::uuid ORDER BY revision,id`;
 const freezeOriginals=await sql`SELECT id::text,md5(to_jsonb(original)::text) AS hash FROM private.order_freezes original WHERE tenant_id=${KREILE_TENANT_SLUG} AND order_id=${orderId} ORDER BY id`;
 if(initialRate===null){
  expect(await withSession(full,()=>issueInvoiceAction(issue))).toMatchObject({code:'VALIDATION_ERROR',message:'Für TEST Bearbeitung ohne Einheit fehlt der Steuersatz. Trag ihn in den Einstellungen unter Firmendaten ein.'});
  expect(await sql`SELECT count(*)::integer AS n FROM public.invoices WHERE tenant_id=${KREILE_TENANT_SLUG} AND order_id=${orderId}`).toEqual([{n:0}]);
  expect(await sql`SELECT count(*)::integer AS n FROM public.events WHERE tenant_id=${KREILE_TENANT_SLUG} AND client_event_id=${issue.clientEventId}::uuid`).toEqual([{n:0}]);
  expect(await withSession(full,()=>getLiveOrderCardAction({orderId}))).toMatchObject({code:'OK',data:{card:{version:issue.expectedVersion}}});
  await sql`UPDATE public.company_settings SET invoice_vat_rate_basis_points=700 WHERE tenant_id=${KREILE_TENANT_SLUG}`;
 }
 const invoice=await withSession(full,()=>issueInvoiceAction(structuredClone(issue)));
 expect(invoice,JSON.stringify(invoice)).toMatchObject({code:'OK'});
 const [vatRow]=await sql`SELECT id::text,pdf_sha256,snapshot,pdf_content,net_amount_cents,vat_amount_cents,gross_amount_cents,vat_rate_basis_points FROM public.invoices WHERE tenant_id=${KREILE_TENANT_SLUG} AND order_id=${orderId}`;
 expect(vatRow.snapshot).toMatchObject({schemaVersion:3,lines:[{type:'BASE',unit:'C62',unitSource:'default_piece'}, {type:'BASE',unit:'C62'}]});
 expect(await sql`SELECT id::text,revision,md5(to_jsonb(position)::text) AS hash FROM private.quote_positions position WHERE tenant_id=${KREILE_TENANT_SLUG} AND quote_id=${quoteId}::uuid ORDER BY revision,id`).toEqual(quoteOriginals);
 expect(await sql`SELECT id::text,md5(to_jsonb(original)::text) AS hash FROM private.order_freezes original WHERE tenant_id=${KREILE_TENANT_SLUG} AND order_id=${orderId} ORDER BY id`).toEqual(freezeOriginals);
 if(mode===700){
  const {getDocument}=await import('pdfjs-dist/legacy/build/pdf.mjs');
  const bytes=Uint8Array.from(vatRow.pdf_content),task=getDocument({data:bytes.slice(),verbosity:0});
  try{
   const pdf=await task.promise;expect(pdf.numPages).toBe(1);
   const rows:Array<{str:string;x:number;y:number;width:number}>=[];
   for(let page=1;page<=pdf.numPages;page++){const content=await(await pdf.getPage(page)).getTextContent();rows.push(...content.items.flatMap(item=>'str'in item?[{str:item.str,x:item.transform[4],y:item.transform[5],width:item.width}]:[]));}
   expect(rows.map(row=>row.str).join(' ')).toMatch(new RegExp('\\b'+receivedQuantity+' Stk(?:\\s|$)'));
   const prices=rounding==='full'?['25,0033','12,495']:rounding==='partial'?['25,005','12,495']:['18,75','12,50'];
   const priceRows=prices.map(price=>{const found=rows.filter(row=>row.str.replace(/\u00a0/g,' ')===price+' €');expect(found).toHaveLength(1);return found[0];});
   // Entire price + currency in one text item, on the same fixed right edge.
   expect(Math.abs(priceRows[0].x+priceRows[0].width-priceRows[1].x-priceRows[1].width)).toBeLessThan(0.5);
   if(process.env.S54O_EVIDENCE_DIR){
    const attachments=await pdf.getAttachments();expect(attachments?.size).toBe(1);if(!attachments)throw Error('ACTUAL_PARTIAL_XML_REQUIRED');
    const [key]=[...attachments][0],xml=await pdf.getAttachmentContent(key);if(!xml)throw Error('ACTUAL_PARTIAL_XML_BYTES_REQUIRED');
    for(const price of prices)expect(Buffer.from(xml).toString('utf8')).toContain('<ram:ChargeAmount>'+price.replace(',','.')+'</ram:ChargeAmount>');
    expect(createHash('sha256').update(bytes).digest('hex')).toBe(vatRow.pdf_sha256);
    const name=rounding?'a19-rounded-'+rounding:'a19-partial',stem=path.join(process.env.S54O_EVIDENCE_DIR,'kreile-s54o-'+name);mkdirSync(process.env.S54O_EVIDENCE_DIR,{recursive:true});
    writeFileSync(stem+'.pdf',bytes);writeFileSync(stem+'.xml',xml);writeFileSync(stem+'.json',JSON.stringify({invoiceId:vatRow.id,pdfSha256:vatRow.pdf_sha256,source:'real original unitless KV partial-goods action flow',unitSource:'default_piece',pages:pdf.numPages,completePriceItems:priceRows},null,2)+'\n');
   }
  }finally{await task.destroy();}
 }
 const vat=readInvoiceVat(vatRow);expect(vat.headRate).toBeNull();expect(vat.groups).toEqual([{netCents:expectedNet,rateBp:mode==='changed'?1900:700,vatCents:expectedGross-expectedNet,grossCents:expectedGross}]);
 if(rounding){const [row]=await sql`SELECT snapshot FROM public.invoices WHERE tenant_id=${KREILE_TENANT_SLUG} AND order_id=${orderId}`;expect(row.snapshot.lines).toMatchObject([{quantity:receivedQuantity,unitNetAmountCents:rounding==='full'?2500:2501,lineNetAmountCents:rounding==='full'?7501:5001},{quantity:2,unitNetAmountCents:1250,lineNetAmountCents:2499}]);}
 if(initialRate===null)expect(await sql`SELECT user_id::text,payload->>'vatRateBasisPoints' AS rate FROM public.events WHERE tenant_id=${KREILE_TENANT_SLUG} AND order_id=${orderId} AND event_type='QUOTE_VAT_FROM_COMPANY_V1'`).toEqual([{user_id:full.actorId,rate:'700'}]);
 if(mode===700&&rounding==='partial'){
  const {cancelInvoiceAction,getInvoiceCancellationReceiptAction}=await import('@/app/actions/invoices.actions');
  const input={invoiceId:vatRow.id,expectedVersion:1,clientEventId:randomUUID(),reason:'TEST original price precision cancellation'};
  const cancelled=await withSession(full,()=>cancelInvoiceAction(input));expect(cancelled).toMatchObject({code:'OK'});if(cancelled.code!=='OK')throw Error('PRECISE_CANCELLATION_REQUIRED');
  expect(await withSession(full,()=>getInvoiceCancellationReceiptAction({invoiceId:input.invoiceId,clientEventId:input.clientEventId}))).toMatchObject({code:'OK',data:{cancellationPdfSha256:cancelled.receipt.cancellationPdfSha256}});
  const retryInput=JSON.parse(JSON.stringify(input));
  expect(await withSession(full,()=>cancelInvoiceAction(retryInput))).toMatchObject({code:'OK',replayed:true,receipt:{cancellationPdfSha256:cancelled.receipt.cancellationPdfSha256}});
  const [stored]=await sql`SELECT snapshot,pdf_content,cancellation_pdf_content FROM public.invoices WHERE tenant_id=${KREILE_TENANT_SLUG} AND id=${vatRow.id}::uuid`;
  expect(stored.snapshot).toEqual(vatRow.snapshot);expect(Buffer.from(stored.pdf_content)).toEqual(Buffer.from(vatRow.pdf_content));
  const bytes=Uint8Array.from(stored.cancellation_pdf_content);expect(createHash('sha256').update(bytes).digest('hex')).toBe(cancelled.receipt.cancellationPdfSha256);
  const {getDocument}=await import('pdfjs-dist/legacy/build/pdf.mjs'),task=getDocument({data:bytes.slice(),verbosity:0});
  try{
   const pdf=await task.promise;expect(pdf.numPages).toBe(1);const content=await(await pdf.getPage(1)).getTextContent(),items=content.items.flatMap(item=>'str'in item?[item.str.replace(/\u00a0/g,' ')]:[]);
   expect(items).toContain('25,005 €');expect(items).toContain('12,495 €');expect(items).toContain('-2 Stk');
   if(process.env.S54O_EVIDENCE_DIR){
    const attachments=await pdf.getAttachments();expect(attachments?.size).toBe(1);if(!attachments)throw Error('ACTUAL_PRECISE_CANCEL_XML_REQUIRED');
    const [key]=[...attachments][0],xml=await pdf.getAttachmentContent(key);if(!xml)throw Error('ACTUAL_PRECISE_CANCEL_XML_BYTES_REQUIRED');
    expect(Buffer.from(xml).toString('utf8')).toContain('<ram:TypeCode>384</ram:TypeCode>');
    const stem=path.join(process.env.S54O_EVIDENCE_DIR,'kreile-s54o-a19-rounded-partial-cancel');writeFileSync(stem+'.pdf',bytes);writeFileSync(stem+'.xml',xml);writeFileSync(stem+'.json',JSON.stringify({invoiceId:vatRow.id,pdfSha256:cancelled.receipt.cancellationPdfSha256,source:'actual cancellation action and stored original with precise unit prices',originalBytesUnchanged:true,freshRetry:true},null,2)+'\n');
   }
  }finally{await task.destroy();}
 }
});
