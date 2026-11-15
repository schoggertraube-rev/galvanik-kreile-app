import {randomUUID} from 'node:crypto';
import {expect,it} from 'vitest';
import {KREILE_TENANT_SLUG} from '@/lib/tenant';
import {sql,full,withSession,withRequest,createFixture} from './replayHarness';
import {customerFixture,readyInvoiceOrder} from './orderFixture';
import {storeIntakeGoodsPhoto} from './photoFixture';
import {requestMailStep} from './requestMailStep';

it.each([0,1,2])('W-EINGANG E8 offers %i real delivered orders and never creates a complaint merely by reading the choices',async count=>{
 const {getComplaintOrderChoicesAction,getComplaintDialogAction}=await import('@/app/actions/complaints.actions');
 const {recordGoodsOutAction}=await import('@/app/actions/goodsOut.actions');
 const customerId=await customerFixture('S12 E8 '+count),ids:string[]=[];
 for(let index=0;index<count;index++){
  const order=await readyInvoiceOrder('S12 E8 '+index,'pickup',false,customerId);
  expect(await withSession(full,()=>recordGoodsOutAction({orderId:order.orderId,mode:'abholung',expectedVersion:order.version,clientEventId:randomUUID()}))).toMatchObject({code:'OK'});
  ids.push(order.orderId);
 }
 const before=await sql`SELECT count(*)::int AS n FROM public.events WHERE tenant_id=${KREILE_TENANT_SLUG}`;
 const choices=await withSession(full,()=>getComplaintOrderChoicesAction(customerId));
 expect(choices.code).toBe('OK');if(choices.code!=='OK')throw Error('S12_E8_CHOICES:'+choices.code);
 expect(choices.orders.map(row=>row.id).sort()).toEqual([...ids].sort());
 expect(await sql`SELECT count(*)::int AS n FROM public.complaints WHERE tenant_id=${KREILE_TENANT_SLUG} AND customer_id=${customerId}`).toEqual([{n:0}]);
 expect(await withSession(full,()=>getComplaintOrderChoicesAction(customerId))).toEqual(choices);
 expect(await sql`SELECT count(*)::int AS n FROM public.events WHERE tenant_id=${KREILE_TENANT_SLUG}`).toEqual(before);
 const noOrders=await createFixture(['mails'],'werkstatt');
 expect(await withSession(noOrders,()=>getComplaintOrderChoicesAction(customerId))).toMatchObject({code:'FORBIDDEN'});
 if(ids.length){
  const selected=await withSession(full,()=>getComplaintDialogAction({orderId:ids[0]}));
  expect(selected).toMatchObject({code:'OK',data:{complaint:null,source:{id:ids[0]}}});
  expect(await sql`SELECT count(*)::int AS n FROM public.complaints WHERE tenant_id=${KREILE_TENANT_SLUG} AND customer_id=${customerId}`).toEqual([{n:0}]);
 }
});

it('W-EINGANG E1 rereads an imported original in the same U2/U3 source before and after real customer assignment',async()=>{
 const {getIntakeCaptureAction,getIntakeMessagesAction,getIntakeAssignmentAction,assignIntakeCustomerAction}=await import('@/app/actions/eingang.actions');
 const itemId=await requestMailStep('S12-E1');
 const messages=await withSession(full,()=>getIntakeMessagesAction('alle'));
 expect(messages.code).toBe('OK');if(messages.code!=='OK')throw Error('S12_E1_MESSAGES:'+messages.code);
 const before=messages.messages.find(row=>row.id===itemId);if(!before)throw Error('S12_E1_ROW');
 expect(before.customerId).toBeNull();
 expect(before.nextActionRule).toMatchObject({code:'OK',erstblick:expect.any(Array)});
 const day=async()=>withSession(full,async()=>{
  const {resolveAuthorization}=await import('@/lib/server/authorization');
  const {readTodayDashboard}=await import('@/lib/server/todayDashboard');
  const {getComplaints}=await import('@/app/actions/complaints.actions');
  const {getQuoteFollowupsForTodayAction}=await import('@/app/actions/quotes.actions');
  const auth=await resolveAuthorization();if(!auth.ok)throw Error('S12_E1_AUTH');
  return readTodayDashboard(auth.data,getComplaints,getQuoteFollowupsForTodayAction);
 });
 const beforeDay=await day();
 expect(beforeDay.messageActions?.rows.find(row=>row.messageId===itemId)).toEqual({messageId:itemId,version:before.version,read:before.nextActionRule});
 expect(beforeDay.assignmentMetric?.code).toBe('OK');
 if(beforeDay.assignmentMetric?.code!=='OK')throw Error('S12_E1_ASSIGNMENT_SOURCE');
 expect(beforeDay.assignmentMetric.sources).toEqual(expect.arrayContaining([expect.objectContaining({id:itemId})]));
 const opened=await withSession(full,()=>getIntakeAssignmentAction({itemId,mode:'normal'}));
 expect(opened.code).toBe('OK');if(opened.code!=='OK')throw Error('S12_E1_OPEN:'+opened.code);
 const customerId=await customerFixture('S12 E1'),input={itemId,version:opened.view.version,customerId,mode:'manual' as const,clientEventId:randomUUID()};
 expect(await withSession(full,()=>assignIntakeCustomerAction(input))).toMatchObject({code:'OK'});
 const reread=await withSession(full,()=>getIntakeMessagesAction('alle'));
 expect(reread.code).toBe('OK');if(reread.code!=='OK')throw Error('S12_E1_REREAD:'+reread.code);
 const after=reread.messages.find(row=>row.id===itemId);if(!after)throw Error('S12_E1_AFTER_ROW');
 expect(after.customerId).toBe(customerId);
 expect(after.nextActionRule?.hauptaktion?.elementId).not.toBe('message.assign');
 const afterDay=await day();
 expect(afterDay.messageActions?.rows.find(row=>row.messageId===itemId)).toEqual({messageId:itemId,version:after.version,read:after.nextActionRule});
 if(afterDay.assignmentMetric?.code!=='OK')throw Error('S12_E1_ASSIGNMENT_REREAD');
 expect(afterDay.assignmentMetric.sources.some(row=>row.id===itemId)).toBe(false);
 expect(await withSession(full,()=>assignIntakeCustomerAction(JSON.parse(JSON.stringify(input))))).toMatchObject({code:'OK',replayed:true});
 expect(await withSession(full,()=>getIntakeCaptureAction(itemId))).toMatchObject({code:'OK',capture:{customerId,files:expect.arrayContaining([expect.objectContaining({mime:'message/rfc822'})])}});
});

it('W-EINGANG E7 stores the actual secured supplier original once without booking a payment',async()=>{
 const supplierId=await customerFixture('S12 E7 Lieferant');
 // Explicit synthetic master data, not a mocked invoice writer or receipt.
 await sql`UPDATE public.customers SET type='lieferant',payment_preference=NULL,vat_id=NULL,billing_email=NULL,handover_preference=NULL WHERE tenant_id=${KREILE_TENANT_SLUG} AND id=${supplierId}`;
 const original=await storeIntakeGoodsPhoto();
 const {getIntakeCaptureAction,saveIncomingInvoiceAction,getIncomingInvoiceAction}=await import('@/app/actions/eingang.actions');
 const source=await withSession(full,()=>getIntakeCaptureAction(original.itemId));
 expect(source.code).toBe('OK');if(source.code!=='OK')throw Error('S12_E7_SOURCE:'+source.code);
 const paymentsBefore=await sql`SELECT id::text FROM public.payments WHERE tenant_id=${KREILE_TENANT_SLUG} ORDER BY id`;
 const input={itemId:original.itemId,fileId:original.fileId,version:source.capture.version,clientKey:randomUUID(),fields:{lieferantId:supplierId,nummer:'TEST S12 E7 '+randomUUID(),datum:'2026-11-15',netto:'10,00',ust:'1,90',brutto:'11,90',faelligAm:'2026-11-29',iban:'DE02120300000000202051',ibanGeprueft:true},status:'offen',paidDate:null,proofFileId:null,duplicateId:null,duplicateReason:null,unclearReason:null};
 const saved=await withSession(full,()=>saveIncomingInvoiceAction(input));
 expect(saved.code).toBe('OK');if(saved.code!=='OK')throw Error('S12_E7_SAVE:'+saved.code);
 expect(await withSession(full,()=>getIncomingInvoiceAction({id:saved.invoice.id}))).toMatchObject({code:'OK',view:{invoice:{id:saved.invoice.id,zahlstatus:'offen',file_id:original.fileId,erfasst_von:full.actorId}}});
 expect(await withSession(full,()=>saveIncomingInvoiceAction(JSON.parse(JSON.stringify(input))))).toMatchObject({code:'OK',invoice:{id:saved.invoice.id},replayed:true});
 expect(await sql`SELECT id::text FROM public.payments WHERE tenant_id=${KREILE_TENANT_SLUG} ORDER BY id`).toEqual(paymentsBefore);
 expect(await sql`SELECT count(*)::int AS n FROM public.supplier_invoice WHERE tenant_id=${KREILE_TENANT_SLUG} AND item_id=${original.itemId}::uuid`).toEqual([{n:1}]);
 expect(await withSession(full,()=>getIntakeCaptureAction(original.itemId))).toMatchObject({code:'OK',capture:{files:expect.arrayContaining([expect.objectContaining({id:original.fileId})])}});
});

it('W-EINGANG E2/E6 creates one quote from the persisted note, rereads its U2 and keeps the exact source on retry',async()=>{
 const {saveIntakeNoteAction,getIntakeCaptureAction,selectIntakeConcernAction}=await import('@/app/actions/eingang.actions');
 const {prepareQuoteFromIntakeAction,createQuoteAction,readQuoteAction}=await import('@/app/actions/quotes.actions');
 const customerId=await customerFixture('S12 E6'),itemId=randomUUID();
 const text='Schmidt, 4 Weber-Trompeten verchromen, KV, in zwei Wochen; Die alten Halter bitte erhalten.';
 const note={itemId,textstand:randomUUID(),text,context:{customerId}};
 const saved=await withSession(full,()=>saveIntakeNoteAction(note));
 expect(saved.code).toBe('OK');if(saved.code!=='OK')throw Error('S12_E6_NOTE:'+saved.code);
 expect(await withSession(full,()=>saveIntakeNoteAction(JSON.parse(JSON.stringify(note))))).toMatchObject({code:'OK',capture:{id:itemId,text}});
 const selected=await withSession(full,()=>selectIntakeConcernAction({itemId,version:saved.capture.version,concern:'kv_anfrage',clientEventId:randomUUID()}));
 expect(selected.code).toBe('OK');if(selected.code!=='OK')throw Error('S12_E6_CONCERN:'+selected.code);
 const prepared=await withSession(full,()=>prepareQuoteFromIntakeAction({sourceItemId:itemId}));
 expect(prepared).toMatchObject({code:'OK',preparation:{source:{itemId,version:selected.capture.version,message:false},customer:{id:customerId},recognition:{positions:[{name:'Weber-Trompeten',quantity:'4',surfaceRequested:'Verchromen'}]}}});
 if(prepared.code!=='OK')throw Error('S12_E6_PREPARE:'+prepared.code);
 const input={clientEventId:randomUUID(),customerId,dueDate:'2027-05-15',note:prepared.preparation.text,source:prepared.preparation.source,specialRequests:prepared.preparation.specialRequests,positions:[{name:'Weber-Trompeten',quantity:4,material:'Messing',surfaceRequested:'Verchromen',unitPriceCents:1000,lineTotalCents:4000}]};
 const created=await withSession(full,()=>createQuoteAction(input));
 expect(created.code).toBe('OK');if(created.code!=='OK')throw Error('S12_E2_CREATE:'+created.code);
 expect(await withSession(full,()=>readQuoteAction({quoteId:created.quote.quoteId,purpose:'operations'}))).toMatchObject({code:'OK',nextActionRule:{source:{id:created.quote.quoteId,version:1,edition:1},hauptaktion:{elementId:'quote.send'}}});
 // The note also asks to retain the old brackets. Creating its quote closes
 // only kv_anfrage; the independent recorded task must remain actionable.
 expect(selected.capture.openConcerns).toEqual(expect.arrayContaining(['kv_anfrage','aufgabe']));
 expect(await withSession(full,()=>getIntakeCaptureAction(itemId))).toMatchObject({code:'OK',capture:{id:itemId,text,usage:'offen',openConcerns:['aufgabe']}});
 expect(await withSession(full,()=>createQuoteAction(JSON.parse(JSON.stringify(input))))).toMatchObject({code:'OK',replayed:true,quote:{quoteId:created.quote.quoteId}});
 expect(await sql`SELECT count(*)::int AS n FROM private.quotes WHERE tenant_id=${KREILE_TENANT_SLUG} AND customer_id=${customerId}`).toEqual([{n:1}]);
});

it('W-EINGANG E6 keeps the previous note after a real SQL failure and saves the retained text once on fresh retry',async()=>{
 const {saveIntakeNoteAction,getIntakeCaptureAction}=await import('@/app/actions/eingang.actions');
 const itemId=randomUUID(),oldText='TEST S12 ursprüngliche Notiz';
 const initial=await withSession(full,()=>saveIntakeNoteAction({itemId,textstand:randomUUID(),text:oldText}));
 expect(initial.code).toBe('OK');if(initial.code!=='OK')throw Error('S12_E6_INITIAL:'+initial.code);
 const input={itemId,textstand:randomUUID(),expectedVersion:initial.capture.version,text:'TEST S12 neuer erhaltener Text'},serialized=JSON.stringify(input);
 if(!KREILE_TENANT_SLUG.startsWith('TEST-ablauf-'))throw Error('S12_TEST_NOTE_TRIGGER_ONLY');
 const trigger='test_s12_note_'+randomUUID().replaceAll('-','');
 await sql.unsafe(`CREATE FUNCTION private.${trigger}() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.tenant_id='${KREILE_TENANT_SLUG}' AND NEW.item_id='${itemId}'::uuid AND NEW.befehl_id='${input.textstand}'::uuid AND NEW.art='original_gespeichert' THEN RAISE EXCEPTION 'TEST_S12_NOTE_WRITE_FAILED'; END IF; RETURN NEW; END $$`);
 await sql.unsafe(`CREATE TRIGGER ${trigger} BEFORE INSERT ON public.intake_event FOR EACH ROW EXECUTE FUNCTION private.${trigger}()`);
 try{
  expect(await withSession(full,()=>saveIntakeNoteAction(input))).toMatchObject({code:'UNAVAILABLE'});
  expect(JSON.stringify(input)).toBe(serialized);
  expect(await withSession(full,()=>getIntakeCaptureAction(itemId))).toMatchObject({code:'OK',capture:{text:oldText,version:initial.capture.version}});
  expect(await sql`SELECT count(*)::int AS n FROM public.intake_event WHERE tenant_id=${KREILE_TENANT_SLUG} AND item_id=${itemId}::uuid AND befehl_id=${input.textstand}::uuid`).toEqual([{n:0}]);
 }finally{
  await sql.unsafe(`DROP TRIGGER ${trigger} ON public.intake_event`);
  await sql.unsafe(`DROP FUNCTION private.${trigger}()`);
 }
 expect(await withSession(full,()=>saveIntakeNoteAction(JSON.parse(serialized)))).toMatchObject({code:'OK',capture:{text:input.text}});
 expect(await withSession(full,()=>getIntakeCaptureAction(itemId))).toMatchObject({code:'OK',capture:{text:input.text,version:initial.capture.version+1}});
 expect(await withSession(full,()=>saveIntakeNoteAction(JSON.parse(serialized)))).toMatchObject({code:'OK',capture:{text:input.text,version:initial.capture.version+1}});
 expect(await sql`SELECT count(*)::int AS n FROM public.intake_event WHERE tenant_id=${KREILE_TENANT_SLUG} AND item_id=${itemId}::uuid AND art='original_gespeichert'`).toEqual([{n:2}]);
});

// S12 E4 / U-248.2 and U-249: the actual persisted phone decision is
// authoritative. Words in its free note must never turn it into a reservation.
it('W-EINGANG E4 phone acceptance preserves a Vorbehalt note and advances the reread U2 for a login without money rights',async()=>{
 const {createQuoteAction,readQuoteAction,changeQuoteLifecycleAction}=await import('@/app/actions/quotes.actions');
 const customerId=await customerFixture('S12 E4');
 const created=await withSession(full,()=>createQuoteAction({clientEventId:randomUUID(),customerId,dueDate:'2027-05-15',note:'TEST S12 Telefon',positions:[{name:'TEST Teil',quantity:1,material:'Messing',surfaceRequested:'verchromen',unitPriceCents:1000,lineTotalCents:1000}]}));
 expect(created.code).toBe('OK');if(created.code!=='OK')throw Error('S12_E4_CREATE:'+created.code);
 const quoteId=created.quote.quoteId;
 expect(await withSession(full,()=>changeQuoteLifecycleAction({quoteId,expectedVersion:1,edition:1,action:'sent',channel:'druck',evidence:'TEST persönlich ausgehändigt',clientEventId:randomUUID()}))).toMatchObject({code:'OK'});
 const operator=await createFixture([],'werkstatt');
 const statusView=await withSession(full,()=>readQuoteAction({quoteId,purpose:'operations'}));
 expect(statusView).toMatchObject({code:'OK',nextActionRule:{hauptaktion:{elementId:'quote.accept'}}});
 const unauthenticated={quoteId,expectedVersion:2,edition:1,action:'accept' as const,evidence:'TEST ohne Anmeldung',clientEventId:randomUUID()};
 expect(await withRequest('',()=>readQuoteAction({quoteId,purpose:'operations'}))).toMatchObject({code:'UNAUTHENTICATED'});
 expect(await withRequest('',()=>changeQuoteLifecycleAction(unauthenticated))).toMatchObject({code:'UNAUTHENTICATED'});
 const inactive=await createFixture([],'werkstatt');
 await sql`UPDATE public.app_users SET active=false WHERE tenant_id=${KREILE_TENANT_SLUG} AND id=${inactive.actorId}::uuid`;
 expect(await withSession(inactive,()=>readQuoteAction({quoteId,purpose:'operations'}))).toMatchObject({code:'UNAUTHENTICATED'});
 expect(await withSession(inactive,()=>changeQuoteLifecycleAction({...unauthenticated,clientEventId:randomUUID()}))).toMatchObject({code:'UNAUTHENTICATED'});
 const before=await withSession(operator,()=>readQuoteAction({quoteId,purpose:'operations'}));
 expect(before.code).toBe('OK');if(before.code!=='OK')throw Error('S12_E4_BEFORE:'+before.code);
 expect(before.nextActionRule).toMatchObject({hauptaktion:{elementId:'quote.accept'},source:{id:quoteId,version:2}});
 const input={quoteId,expectedVersion:2,edition:1,action:'accept' as const,evidence:'Vorbehalt Termin',clientEventId:randomUUID()};
 expect(await withSession(operator,()=>changeQuoteLifecycleAction(input))).toMatchObject({code:'OK'});
 const after=await withSession(operator,()=>readQuoteAction({quoteId,purpose:'operations'}));
 expect(after.code).toBe('OK');if(after.code!=='OK')throw Error('S12_E4_AFTER:'+after.code);
 expect(after.nextActionRule).toMatchObject({ruleId:'kv.zugesagt',source:{id:quoteId,version:3},hauptaktion:null,gesperrt:expect.arrayContaining([expect.objectContaining({elementId:'quote.receive',grundKey:'error.permission'})])});
 expect(JSON.stringify(after.nextActionRule)).not.toContain('1000');
 const stored=await withSession(full,()=>readQuoteAction({quoteId}));
 expect(stored).toMatchObject({code:'OK',quote:{lifecycle:{stage:'zugesagt',acceptedEdition:1,acceptanceEvidence:'Vorbehalt Termin',conditional:null}}});
 expect(await withSession(operator,()=>changeQuoteLifecycleAction(JSON.parse(JSON.stringify(input))))).toMatchObject({code:'OK',replayed:true});
 expect(await sql`SELECT user_id::text FROM public.events WHERE tenant_id=${KREILE_TENANT_SLUG} AND client_event_id=${input.clientEventId}::uuid`).toEqual([{user_id:operator.actorId}]);
 const stale=await withSession(operator,()=>changeQuoteLifecycleAction({...input,clientEventId:randomUUID(),evidence:'TEST zweite Zusage aus veraltetem Stand'}));
 expect(stale,JSON.stringify(stale)).toMatchObject({code:'CONFLICT'});
 expect(await withSession(full,()=>readQuoteAction({quoteId,purpose:'operations'}))).toMatchObject({code:'OK',nextActionRule:{ruleId:'kv.zugesagt',source:{version:3},hauptaktion:{elementId:'quote.receive'}}});
});
