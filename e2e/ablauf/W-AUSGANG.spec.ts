import {randomUUID,createHash} from 'node:crypto';
import {expect,it,vi} from 'vitest';
import {KREILE_TENANT_SLUG} from '@/lib/tenant';
import {sql,full,withSession,createFixture,nativeFetch} from './replayHarness';
import {readyInvoiceOrder,deliveryNoteInputFixture,manualTrackingFixture,intakeOrderFixture} from './orderFixture';
import {readHistoricalDispatchClock} from './historicalDispatchFixture';

it('W-AUSGANG A8 H15/H16 ends the real open callback with its appointment proof without inventing a successful call',async()=>{
 const order=await readyInvoiceOrder('S13 A8 appointment ends callback');
 const {markOrderInformedByPhoneAction,getOrdersDb,getLiveOrderCardAction,setOrderPickupAppointmentAction}=await import('@/app/actions/orders.actions');
 const {createDispatchCallTaskAction,getIntakeTaskAction}=await import('@/app/actions/eingang.actions');
 const {readShippingSettingsAction,saveShippingSettingsAction}=await import('@/app/actions/settings.actions');
 const {emptyDispatchPolicy}=await import('@/modules/fundament/public');
 expect(await withSession(full,()=>markOrderInformedByPhoneAction({orderId:order.orderId,expectedVersion:order.version,clientEventId:randomUUID()}))).toMatchObject({code:'OK'});
 const clock=await readHistoricalDispatchClock(sql,KREILE_TENANT_SLUG,full.actorId);
 await clock.addNotice(order.orderId,8);
 await clock.addReminder(order.customerId,[order.orderId],'E1',6);
 await clock.addReminder(order.customerId,[order.orderId],'E2',4);
 const settings=await withSession(full,()=>readShippingSettingsAction());if(settings.code!=='OK')throw Error('S13_CALL_SETTINGS');
 expect(await withSession(full,()=>saveShippingSettingsAction({service:settings.settings.service,numberPattern:settings.settings.numberPattern,numberHint:settings.settings.numberHint,trackingUrl:settings.settings.trackingUrl,expectedUpdatedAt:settings.settings.updatedAt,dispatchPolicy:{...emptyDispatchPolicy(),reminderDays:0,secondReminderDays:0,callAfterDays:0,storageAfterDays:0,holdMinutes:0}}))).toMatchObject({code:'OK'});
 const queue=await withSession(full,()=>getOrdersDb());if(!queue.ok)throw Error('S13_CALL_QUEUE');
 const plan=queue.data.find(row=>row.id===order.orderId)?.finishedDispatch?.reminder;
 expect(plan).toMatchObject({stage:'E3',state:'DUE'});if(!plan?.due||!plan.clientKey)throw Error('S13_CALL_PLAN');
 const call={customerId:order.customerId,handover:'pickup' as const,dueDate:plan.due,clientKey:plan.clientKey};
 const created=await withSession(full,()=>createDispatchCallTaskAction(call));
 expect(created).toMatchObject({code:'OK'});if(created.code!=='OK')throw Error('S13_CALL_CREATE:'+created.code);
 expect(await withSession(full,()=>createDispatchCallTaskAction(JSON.parse(JSON.stringify(call))))).toMatchObject({code:'OK',taskId:created.taskId,replayed:true});
 expect(await withSession(full,()=>getIntakeTaskAction({taskId:created.taskId}))).toMatchObject({code:'OK',task:{status:'offen'}});
 const card=await withSession(full,()=>getLiveOrderCardAction({orderId:order.orderId}));if(card.code!=='OK')throw Error('S13_CALL_CARD');
 const [date]=await sql`SELECT ((statement_timestamp() AT TIME ZONE 'Europe/Berlin')::date+1)::text AS tomorrow`;
 const input={orderId:order.orderId,expectedVersion:card.data.card.version,previousEventId:null,date:date.tomorrow,channel:'telefon' as const,clientEventId:randomUUID()};
 const appointed=await withSession(full,()=>setOrderPickupAppointmentAction(input));
 expect(appointed).toMatchObject({code:'OK'});if(appointed.code!=='OK')throw Error('S13_CALL_APPOINTMENT:'+appointed.code);
 expect(await withSession(full,()=>setOrderPickupAppointmentAction(JSON.parse(JSON.stringify(input))))).toMatchObject({code:'OK',replayed:true,receipt:{eventId:appointed.receipt.eventId}});
 expect(await withSession(full,()=>getIntakeTaskAction({taskId:created.taskId}))).toMatchObject({code:'OK',task:{status:'erledigt',erledigt_von:full.actorId}});
 expect(await sql`SELECT payload->>'appointmentEventId' AS appointment,user_id::text FROM public.events WHERE tenant_id=${KREILE_TENANT_SLUG} AND event_type='ORDER_COLLECTION_TASK_ENDED_FOR_APPOINTMENT_V1' AND payload->>'taskId'=${created.taskId}`).toEqual([{appointment:appointed.receipt.eventId,user_id:full.actorId}]);
 expect(await sql`SELECT count(*)::int AS n FROM public.events WHERE tenant_id=${KREILE_TENANT_SLUG} AND event_type='ORDER_COLLECTION_CALL_RESULT_V1' AND payload->>'taskId'=${created.taskId}`).toEqual([{n:0}]);
 expect(await withSession(full,()=>createDispatchCallTaskAction(JSON.parse(JSON.stringify(call))))).toMatchObject({code:'OK',taskId:created.taskId,replayed:true});
 expect(await sql`SELECT count(*)::int AS n FROM public.events WHERE tenant_id=${KREILE_TENANT_SLUG} AND event_type='ORDER_COLLECTION_CALL_CREATED_V1' AND payload->>'taskId'=${created.taskId}`).toEqual([{n:1}]);
 expect(await sql`SELECT due_date::date::text AS date FROM public.orders WHERE tenant_id=${KREILE_TENANT_SLUG} AND id=${order.orderId}`).toEqual([{date:'2027-05-15'}]);
});

it('W-AUSGANG A7 H13 confirms the actual extra-shipping proposal while retaining the already issued invoice byte for byte',async()=>{
 const order=await readyInvoiceOrder('S13 A7 released original','pickup');
 const {readShippingSettingsAction,saveShippingSettingsAction}=await import('@/app/actions/settings.actions');
 const {changeOrderPickupNoticeAction,getLiveOrderCardAction}=await import('@/app/actions/orders.actions');
 const {issueInvoiceAction}=await import('@/app/actions/invoices.actions');
 const settings=await withSession(full,()=>readShippingSettingsAction());if(settings.code!=='OK')throw Error('S13_A7_SETTINGS');
 expect(await withSession(full,()=>saveShippingSettingsAction({service:settings.settings.service,numberPattern:settings.settings.numberPattern,numberHint:settings.settings.numberHint,trackingUrl:settings.settings.trackingUrl,expectedUpdatedAt:settings.settings.updatedAt,shippingFeeCents:1000}))).toMatchObject({code:'OK'});
 const original=await sql`SELECT snapshot,pdf_content,pdf_sha256 FROM public.invoices WHERE tenant_id=${KREILE_TENANT_SLUG} AND id=${order.invoice.invoiceId}::uuid`;
 const operator=await createFixture(['auftraege'],'werkstatt');
 const change={command:'handover_manual',orderId:order.orderId,expectedVersion:order.version,clientEventId:randomUUID(),handoverMode:'shipping'};
 expect(await withSession(operator,()=>changeOrderPickupNoticeAction(change))).toMatchObject({code:'OK',receipt:{handoverMode:'shipping'}});
 expect(await withSession(operator,()=>changeOrderPickupNoticeAction(JSON.parse(JSON.stringify(change))))).toMatchObject({code:'OK',replayed:true});
 expect(await sql`SELECT count(*)::int AS n FROM public.invoices WHERE tenant_id=${KREILE_TENANT_SLUG} AND order_id=${order.orderId}`).toEqual([{n:1}]);
 const current=await withSession(full,()=>getLiveOrderCardAction({orderId:order.orderId}));
 if(current.code!=='OK'||current.data.handoverConsequences?.code!=='OK')throw Error('S13_A7_PROPOSAL_SOURCE');
 expect(current.data.handoverConsequences.additionalInvoices).toHaveLength(1);
 const proposal=current.data.handoverConsequences.additionalInvoices[0];
 expect(proposal.befehl).toMatchObject({funktion:'issueInvoiceAction',argumente:{orderId:order.orderId,shippingCosts:{invoiceId:order.invoice.invoiceId,expectedFeeCents:1000}}});
 const input={...JSON.parse(JSON.stringify(proposal.befehl.argumente)),clientEventId:randomUUID()};
 expect(await withSession(operator,()=>issueInvoiceAction(input))).toMatchObject({code:'FORBIDDEN'});
 const issued=await withSession(full,()=>issueInvoiceAction(input));
 expect(issued).toMatchObject({code:'OK',receipt:{belegart:'versandkosten',netAmountCents:1000,ursprungRechnungId:order.invoice.invoiceId}});
 if(issued.code!=='OK')throw Error('S13_A7_EXTRA_INVOICE:'+issued.code);
 expect(await withSession(full,()=>issueInvoiceAction(JSON.parse(JSON.stringify(input))))).toMatchObject({code:'OK',replayed:true,receipt:{invoiceId:issued.receipt.invoiceId}});
 expect(await sql`SELECT snapshot,pdf_content,pdf_sha256 FROM public.invoices WHERE tenant_id=${KREILE_TENANT_SLUG} AND id=${order.invoice.invoiceId}::uuid`).toEqual(original);
 expect(await withSession(full,()=>getLiveOrderCardAction({orderId:order.orderId}))).toMatchObject({code:'OK',data:{handoverConsequences:{code:'OK',additionalInvoices:[]}}});
 expect(await sql`SELECT count(*)::int AS n FROM public.invoices WHERE tenant_id=${KREILE_TENANT_SLUG} AND order_id=${order.orderId}`).toEqual([{n:2}]);
});

it.each([{stage:'E1' as const,count:1},{stage:'E1' as const,count:2},{stage:'E2' as const,count:1},{stage:'E4' as const,count:1}])('W-AUSGANG A8 H14/H15 sends the real $stage original for $count ready orders and rereads its qualified next stage once',async({stage,count})=>{
 const {sendCustomerMailAction}=await import('@/app/actions/communications.actions');
 const {getOrdersDb,markOrderInformedByPhoneAction}=await import('@/app/actions/orders.actions');
 const {readShippingSettingsAction,saveShippingSettingsAction}=await import('@/app/actions/settings.actions');
 const {emptyDispatchPolicy}=await import('@/modules/fundament/public');
 const clock=await readHistoricalDispatchClock(sql,KREILE_TENANT_SLUG,full.actorId);
 const first=await readyInvoiceOrder('S13 A8 '+stage+' first'),orders=[first];
 for(let index=1;index<count;index++)orders.push(await readyInvoiceOrder('S13 A8 '+stage+' '+index,'pickup',false,first.customerId));
 const settings=await withSession(full,()=>readShippingSettingsAction());if(settings.code!=='OK')throw Error('S13_A8_SETTINGS');
 expect(await withSession(full,()=>saveShippingSettingsAction({service:settings.settings.service,numberPattern:settings.settings.numberPattern,numberHint:settings.settings.numberHint,trackingUrl:settings.settings.trackingUrl,expectedUpdatedAt:settings.settings.updatedAt,dispatchPolicy:{...emptyDispatchPolicy(),reminderDays:0,secondReminderDays:0,callAfterDays:0,storageAfterDays:0,finalStageAfterLetterDays:4,holdMinutes:0}}))).toMatchObject({code:'OK'});
 // PL14.11.02:00/02:30: prior stages are explicit historical starting facts;
 // only the stage under test claims an actual sender/Original/DB proof.
 for(const order of orders){
  expect(await withSession(full,()=>markOrderInformedByPhoneAction({orderId:order.orderId,expectedVersion:order.version,clientEventId:randomUUID()}))).toMatchObject({code:'OK'});
  await clock.addNotice(order.orderId,8);
 }
 const ids=orders.map(order=>order.orderId);
 if(stage==='E2'||stage==='E4')await clock.addReminder(first.customerId,ids,'E1',6);
 if(stage==='E4'){
  await clock.addReminder(first.customerId,ids,'E2',4);
  await clock.addUnreachedCall(first.customerId,ids,2);
 }
 const read=async()=>{const result=await withSession(full,()=>getOrdersDb());if(!result.ok)throw Error('S13_A8_QUEUE');return result.data.find(row=>row.id===first.orderId)?.finishedDispatch;};
 const before=await read(),target=stage==='E4'?before?.storage?.letter:before?.reminder;
 expect(target).toMatchObject({state:'DUE'});if(!target?.due)throw Error('S13_A8_DUE');
 if(stage==='E4'&&!target.clientKey)throw Error('S13_A8_STORAGE_SOURCE');
 let sends=0;
 vi.spyOn(globalThis,'fetch').mockImplementation(async(input,init)=>{
  const url=new URL(typeof input==='string'?input:input instanceof URL?input.href:input.url);
  if(url.hostname==='login.microsoftonline.com')return Response.json({access_token:'TEST-S13-boundary-token'.repeat(4),expires_in:3600});
  if(url.hostname==='graph.microsoft.com'&&url.pathname.endsWith('/sendMail')){sends++;return new Response(null,{status:202});}
  return nativeFetch(input,init);
 });
 const key=randomUUID(),input={targetType:'CUSTOMER' as const,targetId:first.customerId,subject:'TEST S13 Abholerinnerung',body:'TEST S13 Ware liegt bereit',clientRequestId:key,collectionReminder:{stage,handover:'pickup' as const,dueDate:target.due,...(stage==='E4'?{clientKey:target.clientKey!}:{})}};
 const sent=await withSession(full,()=>sendCustomerMailAction(input));
 expect(sent,JSON.stringify(sent)).toMatchObject({code:'OK'});if(sent.code!=='OK')throw Error('S13_A8_SEND:'+sent.code);
 expect(await withSession(full,()=>sendCustomerMailAction(JSON.parse(JSON.stringify(input))))).toMatchObject({code:'OK',data:{threadId:sent.data.threadId,replayed:true}});
 expect(sends).toBe(1);
 const after=await read();
 if(stage==='E4')expect(after?.storage?.letter).toMatchObject({state:'SENT',threadId:sent.data.threadId});
 else expect(after?.reminder).toMatchObject({stage:stage==='E1'?'E2':'E3',...await clock.readSentFollowup(key,0)});
 expect(await read()).toEqual(after);
 const receipts=await sql`SELECT payload,user_id::text FROM public.events WHERE tenant_id=${KREILE_TENANT_SLUG} AND event_type='ORDER_COLLECTION_REMINDER_SENT_V1' AND correlation_id=${key}::uuid`;
 expect(receipts).toHaveLength(1);expect(receipts[0].user_id).toBe(full.actorId);
 expect(receipts[0].payload.meta.orders.map((row:{id:string})=>row.id).sort()).toEqual(ids.toSorted());
 expect(receipts[0].payload.meta.stage).toBe(stage);
});

it('W-AUSGANG A3 G4 H10/H16 keeps debt customer-wide but its reasoned exception order-specific and actor-bound',async()=>{
 const first=await readyInvoiceOrder('S13 A3 same customer first');
 const second=await readyInvoiceOrder('S13 A3 same customer second','pickup',false,first.customerId);
 const other=await readyInvoiceOrder('S13 A3 different customer');
 const {getOrderPaymentStateAction,confirmPaymentAction}=await import('@/app/actions/payments.actions');
 const {recordGoodsOutAction}=await import('@/app/actions/goodsOut.actions');
 const {getLiveOrderCardAction}=await import('@/app/actions/orders.actions');
 const debtId=randomUUID(),oldOrder=await intakeOrderFixture('S13 A3 historical invoice order',first.customerId);
 // Explicit synthetic historical starting debt, not a second invoice writer.
 await sql`INSERT INTO public.invoices(id,tenant_id,order_id,customer_id,invoice_number,amount_total,status,due_date,gross_amount_cents,payment_contract_version,payment_mode,payment_status,payment_open_amount_cents,payment_paid_amount_cents,payment_currency,payment_version)
 VALUES(${debtId}::uuid,${KREILE_TENANT_SLUG},${oldOrder.receipt.orderId},${first.customerId},'R-2025-0013',60,'issued',(statement_timestamp() AT TIME ZONE 'Europe/Berlin')::date-1,6000,1,'rechnung','offen',6000,0,'EUR',0)`;
 for(const order of [first,second]){
  expect(await withSession(full,()=>getOrderPaymentStateAction({orderId:order.orderId}))).toMatchObject({code:'OK',data:{goodsOutAllowed:true,customerDeliveryBlock:{blocked:true,invoiceIds:[debtId]}}});
  expect(await withSession(full,()=>recordGoodsOutAction({orderId:order.orderId,expectedVersion:order.version,mode:'abholung',clientEventId:randomUUID()}))).toMatchObject({code:'CONFLICT'});
 }
 expect(await withSession(full,()=>getOrderPaymentStateAction({orderId:other.orderId}))).toMatchObject({code:'OK',data:{goodsOutAllowed:true,customerDeliveryBlock:{blocked:false,invoiceIds:[]}}});
 const reason='TEST S13 ausdrueckliche Ausnahme nur fuer ersten Auftrag';
 const input={orderId:first.orderId,expectedVersion:first.version,mode:'abholung' as const,overdueReleaseReason:reason,clientEventId:randomUUID()};
 expect(await withSession(full,()=>recordGoodsOutAction(input))).toMatchObject({code:'FORBIDDEN'});
 const approver=await createFixture(['auftraege','entscheiden']);
 expect(await withSession(approver,()=>recordGoodsOutAction({...input,overdueReleaseReason:''}))).toMatchObject({code:'VALIDATION_ERROR'});
 const released=await withSession(approver,()=>recordGoodsOutAction(input));
 expect(released).toMatchObject({code:'OK'});if(released.code!=='OK')throw Error('S13_A3_OVERRIDE:'+released.code);
 expect(await withSession(approver,()=>recordGoodsOutAction(JSON.parse(JSON.stringify(input))))).toMatchObject({code:'OK',replayed:true,receipt:{eventId:released.receipt.eventId}});
 expect(await withSession(full,()=>getLiveOrderCardAction({orderId:first.orderId}))).toMatchObject({code:'OK',data:{card:{station:'abgeholt'},nextActionRule:{hauptaktion:null}}});
 expect(await withSession(full,()=>getOrderPaymentStateAction({orderId:second.orderId}))).toMatchObject({code:'OK',data:{customerDeliveryBlock:{blocked:true,invoiceIds:[debtId]}}});
 expect(await sql`SELECT user_id::text,notes,payload->>'invoiceId' AS invoice FROM public.events WHERE tenant_id=${KREILE_TENANT_SLUG} AND order_id=${first.orderId} AND event_type='ORDER_GOODS_OUT_DEBT_OVERRIDE_V1'`).toEqual([{user_id:approver.actorId,notes:reason,invoice:debtId}]);
 expect(await sql`SELECT payment_open_amount_cents FROM public.invoices WHERE tenant_id=${KREILE_TENANT_SLUG} AND id=${debtId}::uuid`).toEqual([{payment_open_amount_cents:6000}]);
 const paid=await withSession(full,()=>confirmPaymentAction({invoiceId:debtId,amount:6000,method:'ueberweisung',expectedVersion:0,expectedOpenAmountCents:6000,clientEventId:randomUUID()}));
 expect(paid,JSON.stringify(paid)).toMatchObject({code:'OK'});
 expect(await withSession(full,()=>getOrderPaymentStateAction({orderId:second.orderId}))).toMatchObject({code:'OK',data:{customerDeliveryBlock:{blocked:false,invoiceIds:[]}}});
 expect(await withSession(full,()=>recordGoodsOutAction({orderId:second.orderId,expectedVersion:second.version,mode:'abholung',clientEventId:randomUUID()}))).toMatchObject({code:'OK'});
 expect(await sql`SELECT count(*)::int AS n FROM public.events WHERE tenant_id=${KREILE_TENANT_SLUG} AND order_id=${second.orderId} AND event_type='ORDER_GOODS_OUT_DEBT_OVERRIDE_V1'`).toEqual([{n:0}]);
});

it('W-AUSGANG A6 H14/H15 distinguishes an actual saved tracking original from the physical carrier handover',async()=>{
 const order=await readyInvoiceOrder('S13 A6 real carrier handover','shipping');
 const {getManualShippingAction,getLiveOrderCardAction}=await import('@/app/actions/orders.actions');
 const {recordGoodsOutAction}=await import('@/app/actions/goodsOut.actions');
 const request={orderId:order.orderId,expectedVersion:order.version,mode:'versand' as const,clientEventId:randomUUID()};
 expect(await withSession(full,()=>getManualShippingAction({orderId:order.orderId}))).toMatchObject({code:'OK',data:{shipments:[]}});
 expect(await withSession(full,()=>recordGoodsOutAction(request))).toMatchObject({code:'VALIDATION_ERROR'});
 const tracking=await manualTrackingFixture(order.orderId);
 expect(await withSession(full,()=>getManualShippingAction({orderId:order.orderId}))).toMatchObject({code:'OK',data:{shipments:[{id:tracking.shipmentId,trackingNumber:tracking.trackingNumber,status:'created'}]}});
 expect(await withSession(full,()=>getLiveOrderCardAction({orderId:order.orderId}))).toMatchObject({code:'OK',data:{card:{station:'fertig',version:order.version}}});
 const released=await withSession(full,()=>recordGoodsOutAction(JSON.parse(JSON.stringify(request))));
 expect(released).toMatchObject({code:'OK'});if(released.code!=='OK')throw Error('S13_A6_RELEASE:'+released.code);
 const reread=await withSession(full,()=>getManualShippingAction({orderId:order.orderId}));
 expect(reread).toMatchObject({code:'OK',data:{shipments:[{id:tracking.shipmentId,trackingNumber:tracking.trackingNumber,status:'shipped'}]}});
 expect(await withSession(full,()=>getLiveOrderCardAction({orderId:order.orderId}))).toMatchObject({code:'OK',data:{card:{station:'abgeholt',handoverMode:'shipping'}}});
 expect(await withSession(full,()=>recordGoodsOutAction(JSON.parse(JSON.stringify(request))))).toMatchObject({code:'OK',replayed:true,receipt:{eventId:released.receipt.eventId}});
 expect(await withSession(full,()=>recordGoodsOutAction({...request,expectedVersion:released.receipt.orderVersion,clientEventId:randomUUID()}))).toMatchObject({code:'VALIDATION_ERROR'});
 expect(await sql`SELECT user_id::text FROM public.events WHERE tenant_id=${KREILE_TENANT_SLUG} AND client_event_id=${request.clientEventId}::uuid`).toEqual([{user_id:full.actorId}]);
});

it('W-AUSGANG A2/A4/A5 G2/G6 H9/H14/H15/H16 requires actual cash before pickup and reuses it in one immutable delivery original',async()=>{
 const order=await readyInvoiceOrder('S13 cash before actual handover');
 const {setPaymentModeAction,confirmPaymentAction,getOrderPaymentStateAction}=await import('@/app/actions/payments.actions');
 const {getLiveOrderCardAction,markOrderInformedByPhoneAction}=await import('@/app/actions/orders.actions');
 const {recordGoodsOutAction}=await import('@/app/actions/goodsOut.actions');
 const {generateDeliveryNote}=await import('@/app/actions/pdf.actions');
 expect(await withSession(full,()=>setPaymentModeAction({orderId:order.orderId,paymentMode:'abholung',expectedVersion:0,clientEventId:randomUUID()}))).toMatchObject({code:'OK'});
 let read=await withSession(full,()=>getLiveOrderCardAction({orderId:order.orderId}));
 if(read.code!=='OK')throw Error('S13_A5_CARD:'+read.code);
 const notice={orderId:order.orderId,expectedVersion:read.data.card.version,clientEventId:randomUUID()};
 expect(await withSession(full,()=>markOrderInformedByPhoneAction(notice))).toMatchObject({code:'OK'});
 expect(await withSession(full,()=>markOrderInformedByPhoneAction(JSON.parse(JSON.stringify(notice))))).toMatchObject({code:'OK',replayed:true});
 read=await withSession(full,()=>getLiveOrderCardAction({orderId:order.orderId}));
 if(read.code!=='OK')throw Error('S13_A5_INFORMED:'+read.code);
 expect(read.data.nextActionRule,JSON.stringify(read.data.nextActionRule)).toMatchObject({hauptaktion:{elementId:'order.payment',befehl:{funktion:'getOrderPaymentStateAction',argumente:{orderId:order.orderId}}}});
 const out={orderId:order.orderId,mode:'abholung' as const,expectedVersion:read.data.card.version,clientEventId:randomUUID()};
 expect(await withSession(full,()=>recordGoodsOutAction(out))).toMatchObject({code:'CONFLICT'});
 expect(await sql`SELECT id FROM public.events WHERE tenant_id=${KREILE_TENANT_SLUG} AND client_event_id=${out.clientEventId}::uuid`).toHaveLength(0);
 const payment={invoiceId:order.invoice.invoiceId,amount:11900,method:'bar' as const,expectedVersion:0,expectedOpenAmountCents:11900,clientEventId:randomUUID()};
 const paid=await withSession(full,()=>confirmPaymentAction(payment));
 expect(paid).toMatchObject({code:'OK',receipt:{source:'manual',openAmountCents:0}});
 if(paid.code!=='OK')throw Error('S13_A5_CASH:'+paid.code);
 expect(await withSession(full,()=>getOrderPaymentStateAction({orderId:order.orderId}))).toMatchObject({code:'OK',data:{goodsOutAllowed:true,payment:{paidAmountCents:11900,openAmountCents:0}}});
 const noteInput=await deliveryNoteInputFixture([order.orderId]);
 const note=await withSession(full,()=>generateDeliveryNote(noteInput));
 expect(note).toMatchObject({code:'OK'});if(note.code!=='OK')throw Error('S13_G6_ORIGINAL:'+note.code);
 expect(createHash('sha256').update(Buffer.from(note.pdfBase64,'base64')).digest('hex')).toBe(note.receipt.pdfSha256);
 expect(await withSession(full,()=>generateDeliveryNote(JSON.parse(JSON.stringify(noteInput))))).toMatchObject({code:'OK',pdfBase64:note.pdfBase64,receipt:{originalEventId:note.receipt.originalEventId}});
 const [original]=await sql`SELECT payload FROM public.events WHERE tenant_id=${KREILE_TENANT_SLUG} AND id=${note.receipt.originalEventId}`;
 expect(original.payload.snapshot.orders[0].payments).toMatchObject([{invoiceId:order.invoice.invoiceId,amountCents:11900,paymentEventId:paid.receipt.eventId}]);
 const ready=await withSession(full,()=>getLiveOrderCardAction({orderId:order.orderId}));
 if(ready.code!=='OK')throw Error('S13_A5_READY:'+ready.code);
 expect(ready.data.nextActionRule).toMatchObject({hauptaktion:{elementId:'order.handover',befehl:{funktion:'recordGoodsOutAction',argumente:{orderId:order.orderId,expectedVersion:ready.data.card.version,mode:'abholung'}}}});
 const action=ready.data.nextActionRule?.hauptaktion;if(!action)throw Error('S13_A5_U2_ACTION');
 const input={...JSON.parse(JSON.stringify(action.befehl.argumente)),clientEventId:out.clientEventId};
 const denied=await createFixture(['kunden']);
 expect(await withSession(denied,()=>recordGoodsOutAction(input))).toMatchObject({code:'FORBIDDEN'});
 const released=await withSession(full,()=>recordGoodsOutAction(input));
 expect(released).toMatchObject({code:'OK'});if(released.code!=='OK')throw Error('S13_A5_RELEASE:'+released.code);
 expect(await withSession(full,()=>recordGoodsOutAction(JSON.parse(JSON.stringify(input))))).toMatchObject({code:'OK',replayed:true,receipt:{eventId:released.receipt.eventId}});
 expect(await withSession(full,()=>getLiveOrderCardAction({orderId:order.orderId}))).toMatchObject({code:'OK',data:{card:{station:'abgeholt'},nextActionRule:{hauptaktion:null}}});
 expect(await withSession(full,()=>recordGoodsOutAction({...input,expectedVersion:released.receipt.orderVersion,clientEventId:randomUUID()}))).toMatchObject({code:'VALIDATION_ERROR'});
 expect(await sql`SELECT count(*)::int AS n FROM public.events WHERE tenant_id=${KREILE_TENANT_SLUG} AND event_type='PAYMENT_CONFIRMED_V1' AND order_id=${order.orderId}`).toEqual([{n:1}]);
 expect(await sql`SELECT count(*)::int AS n FROM public.invoices WHERE tenant_id=${KREILE_TENANT_SLUG} AND order_id=${order.orderId}`).toEqual([{n:1}]);
});
