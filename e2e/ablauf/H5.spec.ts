import {randomUUID} from 'node:crypto';
import {expect,it} from 'vitest';
import {KREILE_TENANT_SLUG} from '@/lib/tenant';
import {sql,full,withSession,createFixture} from './replayHarness';
import {readyInvoiceOrder} from './orderFixture';
import {installMailProvider} from './mailProvider';

it('DA01 pickup contact save has one actor receipt, enforces areas and remains unchanged after physical handover',async()=>{
 const order=await readyInvoiceOrder('DA01-Kontakt');
 const {changeOrderPickupNoticeAction,getOrderPickupNoticeAction,getLiveOrderCardAction}=await import('@/app/actions/orders.actions');
 const request={orderId:order.orderId,expectedVersion:order.version,clientEventId:randomUUID(),name:'TEST Nora Abholung',note:'TEST Kollegin holt für den Kunden ab',source:'telefon'};
 const changed=await withSession(full,()=>changeOrderPickupNoticeAction(request));
 expect(changed.code).toBe('OK');if(changed.code!=='OK'||!changed.receipt||typeof changed.receipt!=='object'||!('aggregateVersion'in changed.receipt)||typeof changed.receipt.aggregateVersion!=='number')throw Error('DA01_SAVE_FAILED');
 const version=changed.receipt.aggregateVersion;
 expect(await withSession(full,()=>getOrderPickupNoticeAction({orderId:order.orderId}))).toMatchObject({code:'OK',data:{id:order.orderId,version,pickup_by_name:request.name,pickup_by_note:request.note,pickup_by_source:'telefon',pickup_by_login:full.actorId}});
 expect(await withSession(full,()=>changeOrderPickupNoticeAction(structuredClone(request)))).toMatchObject({code:'OK',replayed:true});
 expect(await withSession(full,()=>changeOrderPickupNoticeAction({...request,name:'TEST andere Person'}))).toMatchObject({code:'CONFLICT'});
 const denied=await createFixture(['mails'],'werkstatt');
 expect(await withSession(denied,()=>getOrderPickupNoticeAction({orderId:order.orderId}))).toMatchObject({code:'FORBIDDEN'});
 expect(await withSession(denied,()=>changeOrderPickupNoticeAction({...request,expectedVersion:version,clientEventId:randomUUID()}))).toMatchObject({code:'FORBIDDEN'});
 const {recordGoodsOutAction}=await import('@/app/actions/goodsOut.actions');
 const released=await withSession(full,()=>recordGoodsOutAction({orderId:order.orderId,mode:'abholung',expectedVersion:version,clientEventId:randomUUID()}));
 expect(released.code).toBe('OK');if(released.code!=='OK')throw Error('DA01_RELEASE:'+released.code);
 expect(await withSession(full,()=>getLiveOrderCardAction({orderId:order.orderId}))).toMatchObject({code:'OK',data:{card:{station:'abgeholt',version:released.receipt.orderVersion}}});
 const closedKey=randomUUID();
 expect(await withSession(full,()=>changeOrderPickupNoticeAction({...request,name:'TEST zu spät',expectedVersion:released.receipt.orderVersion,clientEventId:closedKey}))).toMatchObject({code:'CONFLICT'});
 expect(await withSession(full,()=>getOrderPickupNoticeAction({orderId:order.orderId}))).toMatchObject({code:'OK',data:{pickup_by_name:request.name,pickup_by_note:request.note,version:released.receipt.orderVersion}});
 expect(await sql`SELECT user_id::text FROM public.events WHERE tenant_id=${KREILE_TENANT_SLUG} AND client_event_id=${request.clientEventId}::uuid`).toEqual([{user_id:full.actorId}]);
 expect(await sql`SELECT count(*)::integer AS n FROM public.events WHERE tenant_id=${KREILE_TENANT_SLUG} AND client_event_id=${closedKey}::uuid`).toEqual([{n:0}]);
});

it('H5 malformed explicit order choices return validation without throwing or writing tasks and events',async()=>{
 const {changeOrderPickupNoticeAction}=await import('@/app/actions/orders.actions');
 const before=await sql`SELECT (SELECT count(*)::integer FROM public.events WHERE tenant_id=${KREILE_TENANT_SLUG}) AS events,(SELECT count(*)::integer FROM public.tasks WHERE tenant_id=${KREILE_TENANT_SLUG}) AS tasks`;
 for(const orderId of [42,null,{id:randomUUID()}]){
  const request={command:'handover_from_mail',sourceItemId:randomUUID(),sourceVersion:1,clientEventId:randomUUID(),orderId,expectedVersion:1};
  await expect(withSession(full,()=>changeOrderPickupNoticeAction(request))).resolves.toMatchObject({code:'VALIDATION_ERROR'});
 }
 expect(await sql`SELECT (SELECT count(*)::integer FROM public.events WHERE tenant_id=${KREILE_TENANT_SLUG}) AS events,(SELECT count(*)::integer FROM public.tasks WHERE tenant_id=${KREILE_TENANT_SLUG}) AS tasks`).toEqual(before);
});

async function selectedPickupMail(customerId:string){
 const graphId='TEST-H5-'+randomUUID();
 installMailProvider(graphId,'TEST Ich hole die Teile selbst ab.','TEST-'+customerId+'@example.invalid');
 const {importOutlookMailAction}=await import('@/app/actions/communications.actions');
 expect(await withSession(full,()=>importOutlookMailAction(graphId))).toMatchObject({code:'OK'});
 const {getIntakeAssignmentAction,assignIntakeCustomerAction,selectIntakeConcernAction}=await import('@/app/actions/eingang.actions');
 const [mail]=await sql`SELECT id::text,version,kunde_id FROM public.intake_item WHERE tenant_id=${KREILE_TENANT_SLUG} AND graph_message_id=${graphId}`;
 expect(mail).toBeDefined();
 expect(await withSession(full,()=>getIntakeAssignmentAction({itemId:mail.id,mode:'normal'}))).toMatchObject({code:'OK'});
 if(mail.kunde_id===null)expect(await withSession(full,()=>assignIntakeCustomerAction({itemId:mail.id,version:mail.version,clientEventId:randomUUID(),customerId,mode:'manual'}))).toMatchObject({code:'OK'});
 const [assigned]=await sql`SELECT version,kunde_id FROM public.intake_item WHERE tenant_id=${KREILE_TENANT_SLUG} AND id=${mail.id}::uuid`;
 expect(assigned.kunde_id).toBe(customerId);
 const selected=await withSession(full,()=>selectIntakeConcernAction({itemId:mail.id,version:assigned.version,concern:'abholung',clientEventId:randomUUID()}));
 expect(selected.code).toBe('OK');if(selected.code!=='OK')throw Error('H5_SELECT:'+selected.code);
 return {id:mail.id,version:selected.capture.version};
}

it.each([true,false])('H5 historical callback version advances are readable only with their complete task lineage: %s',async(validLineage)=>{
 const order=await readyInvoiceOrder('H5-Altbeleg','shipping'),mail=await selectedPickupMail(order.customerId);
 const {recordGoodsOutAction}=await import('@/app/actions/goodsOut.actions');
 const release={orderId:order.orderId,mode:'versand' as const,expectedVersion:order.version,clientEventId:randomUUID()};
 const released=await withSession(full,()=>recordGoodsOutAction(release));if(released.code!=='OK')throw Error('H5_HISTORY_RELEASE:'+released.code);
 const {changeOrderPickupNoticeAction}=await import('@/app/actions/orders.actions');
 const request={command:'handover_from_mail' as const,sourceItemId:mail.id,sourceVersion:mail.version,orderId:order.orderId,expectedVersion:released.receipt.orderVersion,clientEventId:randomUUID()};
 expect(await withSession(full,()=>changeOrderPickupNoticeAction(request))).toMatchObject({code:'OK',receipt:{outcome:'call_customer'}});
 // Synthetic INITIAL history exactly as the former callback writer persisted it.
 // No product repair rewrites these rows; subsequent calls are actual read/retry ports.
 const oldVersion=released.receipt.orderVersion+1;
 await sql.begin(async tx=>{
  await tx`UPDATE public.orders SET version=${oldVersion} WHERE tenant_id=${KREILE_TENANT_SLUG} AND id=${order.orderId}`;
  await tx`UPDATE public.events SET aggregate_version=${oldVersion},payload=jsonb_set(payload,'{receipt,orderVersion}',to_jsonb(${oldVersion}::integer)) WHERE tenant_id=${KREILE_TENANT_SLUG} AND client_event_id=${request.clientEventId}::uuid`;
  if(!validLineage)await tx`UPDATE public.events SET payload=jsonb_set(payload,'{receipt,taskId}',to_jsonb(${randomUUID()}::text)) WHERE tenant_id=${KREILE_TENANT_SLUG} AND client_event_id=${request.clientEventId}::uuid`;
 });
 const before=await sql`SELECT version FROM public.orders WHERE tenant_id=${KREILE_TENANT_SLUG} AND id=${order.orderId}`;
 const eventsBefore=await sql`SELECT id::text,payload,aggregate_version FROM public.events WHERE tenant_id=${KREILE_TENANT_SLUG} AND order_id=${order.orderId} ORDER BY id`;
 const {getOrderPaymentStateAction}=await import('@/app/actions/payments.actions');
 const read=await withSession(full,()=>getOrderPaymentStateAction({orderId:order.orderId}));
 if(validLineage){
  expect(read).toMatchObject({code:'OK',data:{orderVersion:oldVersion,physicalStatus:'abgeholt',goodsOut:{eventId:released.receipt.eventId,orderVersion:released.receipt.orderVersion}}});
  expect(await withSession(full,()=>recordGoodsOutAction(structuredClone(release)))).toMatchObject({code:'OK',replayed:true,receipt:{eventId:released.receipt.eventId}});
 }else{
  expect(read.code).not.toBe('OK');
  expect((await withSession(full,()=>recordGoodsOutAction(structuredClone(release)))).code).not.toBe('OK');
 }
 expect(await sql`SELECT version FROM public.orders WHERE tenant_id=${KREILE_TENANT_SLUG} AND id=${order.orderId}`).toEqual(before);
 expect(await sql`SELECT id::text,payload,aggregate_version FROM public.events WHERE tenant_id=${KREILE_TENANT_SLUG} AND order_id=${order.orderId} ORDER BY id`).toEqual(eventsBefore);
});

it('H5 a late pickup request preserves the physical release and creates one readable callback with its original',async()=>{
 const order=await readyInvoiceOrder('H5-ausgegeben','shipping'),mail=await selectedPickupMail(order.customerId);
 const {recordGoodsOutAction}=await import('@/app/actions/goodsOut.actions');
 const release={orderId:order.orderId,mode:'versand' as const,expectedVersion:order.version,clientEventId:randomUUID()};
 const released=await withSession(full,()=>recordGoodsOutAction(release));
 expect(released.code).toBe('OK');if(released.code!=='OK')throw Error('H5_CLOSED_RELEASE:'+released.code);
 const request={command:'handover_from_mail' as const,sourceItemId:mail.id,sourceVersion:mail.version,orderId:order.orderId,expectedVersion:released.receipt.orderVersion,clientEventId:randomUUID()};
 const {changeOrderPickupNoticeAction,getLiveOrderCardAction}=await import('@/app/actions/orders.actions');
 const result=await withSession(full,()=>changeOrderPickupNoticeAction(request));
 expect(result).toMatchObject({code:'OK',receipt:{outcome:'call_customer',handoverMode:'shipping',requestedHandoverMode:'pickup'}});
 if(result.code!=='OK'||!result.receipt||typeof result.receipt!=='object'||!('taskId'in result.receipt)||typeof result.receipt.taskId!=='string')throw Error('H5_CLOSED_CALLBACK_MISSING');
 const taskId=result.receipt.taskId;
 const {getIntakeTaskAction,getIntakeCaptureAction}=await import('@/app/actions/eingang.actions');
 expect(await withSession(full,()=>getIntakeTaskAction({taskId}))).toMatchObject({code:'OK',task:{art:'rueckruf',status:'offen',bezug_id:order.orderId},reference:{type:'auftrag',id:order.orderId}});
 expect(await withSession(full,()=>getIntakeCaptureAction(mail.id))).toMatchObject({code:'OK',capture:{id:mail.id}});
 expect(await withSession(full,()=>getLiveOrderCardAction({orderId:order.orderId}))).toMatchObject({code:'OK',data:{card:{station:'abgeholt',handoverMode:'shipping',handoverNotice:{taskId,taskState:'offen'}}}});
 const {getOrderPaymentStateAction}=await import('@/app/actions/payments.actions');
 expect(await withSession(full,()=>getOrderPaymentStateAction({orderId:order.orderId}))).toMatchObject({code:'OK',data:{physicalStatus:'abgeholt',goodsOut:{eventId:released.receipt.eventId}}});
 expect(await withSession(full,()=>recordGoodsOutAction(structuredClone(release)))).toMatchObject({code:'OK',replayed:true,receipt:{eventId:released.receipt.eventId}});
 expect(await withSession(full,()=>changeOrderPickupNoticeAction(structuredClone(request)))).toMatchObject({code:'OK',replayed:true});
 expect(await sql`SELECT id::text,erstellt_von::text FROM public.tasks WHERE tenant_id=${KREILE_TENANT_SLUG} AND client_key=${request.clientEventId}::uuid`).toEqual([{id:taskId,erstellt_von:full.actorId}]);
 expect(await sql`SELECT user_id::text FROM public.events WHERE tenant_id=${KREILE_TENANT_SLUG} AND client_event_id=${request.clientEventId}::uuid AND event_type='ORDER_HANDOVER_MAIL_V1'`).toEqual([{user_id:full.actorId}]);
 expect(await sql`SELECT station,handover_mode FROM public.orders WHERE tenant_id=${KREILE_TENANT_SLUG} AND id=${order.orderId}`).toEqual([{station:'abgeholt',handover_mode:'shipping'}]);
});

it('H5 actual customer assignment and concern selection precede a pickup change from mail',async()=>{
 const order=await readyInvoiceOrder('H5','shipping'),mail=await selectedPickupMail(order.customerId);
 const {getIntakeMessagesAction}=await import('@/app/actions/eingang.actions');
 const {changeOrderPickupNoticeAction,getLiveOrderCardAction}=await import('@/app/actions/orders.actions');
 const request={command:'handover_from_mail' as const,sourceItemId:mail.id,sourceVersion:mail.version,clientEventId:randomUUID()};
 const result=await withSession(full,()=>changeOrderPickupNoticeAction(request));
 expect(result,JSON.stringify(result)).toMatchObject({code:'OK',receipt:{orderId:order.orderId,handoverMode:'pickup',outcome:'changed'}});
 expect(await sql`SELECT handover_mode FROM public.orders WHERE tenant_id=${KREILE_TENANT_SLUG} AND id=${order.orderId}`).toEqual([{handover_mode:'pickup'}]);
 const [bound]=await sql`SELECT vorgang_art,vorgang_id,anliegen_offen,version FROM public.intake_item WHERE tenant_id=${KREILE_TENANT_SLUG} AND id=${mail.id}::uuid`;
 expect(bound).toMatchObject({vorgang_art:'auftrag',vorgang_id:order.orderId,version:mail.version+1});
 expect(bound.anliegen_offen).not.toContain('abholung');
 expect(await withSession(full,()=>getLiveOrderCardAction({orderId:order.orderId}))).toMatchObject({code:'OK',data:{card:{id:order.orderId,handoverMode:'pickup'}}});
 expect(await withSession(full,()=>getIntakeMessagesAction('offen'))).toMatchObject({code:'OK'});
 expect(await withSession(full,()=>changeOrderPickupNoticeAction(structuredClone(request)))).toMatchObject({code:'OK',replayed:true});
 expect(await sql`SELECT version FROM public.intake_item WHERE tenant_id=${KREILE_TENANT_SLUG} AND id=${mail.id}::uuid`).toEqual([{version:bound.version}]);
 expect(await sql`SELECT von,nachher->>'orderId' AS order_id FROM public.intake_event WHERE tenant_id=${KREILE_TENANT_SLUG} AND item_id=${mail.id}::uuid AND befehl_id=${request.clientEventId}::uuid`).toEqual([{von:full.actorId,order_id:order.orderId}]);
 expect(await sql`SELECT user_id::text FROM public.events WHERE tenant_id=${KREILE_TENANT_SLUG} AND client_event_id=${request.clientEventId}::uuid AND event_type='ORDER_HANDOVER_MAIL_V1'`).toEqual([{user_id:full.actorId}]);
 expect(await sql`SELECT count(*)::integer AS n FROM public.orders WHERE tenant_id=${KREILE_TENANT_SLUG} AND customer_id=${order.customerId}`).toEqual([{n:1}]);
});

it('H5 two active orders require explicit choice; stale choice changes nothing and retry never duplicates',async()=>{
 const order=await readyInvoiceOrder('H5-two','shipping');
 const {createOrderIntakeAction}=await import('@/app/actions/eingang.actions');
 const second=await withSession(full,()=>createOrderIntakeAction({geprueft:true,clientEventId:randomUUID(),customer:{mode:'EXISTING',customerId:order.customerId},dueDate:'2027-05-15',termStatus:'bestaetigt',intakeSource:'persoenlich',handoverMode:'shipping',paymentMode:'rechnung',note:'TEST second order',items:[{catalogServiceId:null,name:'TEST second part',quantity:1,material:'Messing',surfaceRequested:'Verchromen',executionRequested:'offen',unit:'Stück',unitPriceCents:10000,vatRateBasisPoints:1900}]}));
 expect(second.code).toBe('OK');if(second.code!=='OK')throw Error('H5_SECOND_ORDER:'+second.code);
 const mail=await selectedPickupMail(order.customerId);
 const {changeOrderPickupNoticeAction,getLiveOrderCardAction}=await import('@/app/actions/orders.actions');
 const request={command:'handover_from_mail' as const,sourceItemId:mail.id,sourceVersion:mail.version,clientEventId:randomUUID()};
 const ambiguous=await withSession(full,()=>changeOrderPickupNoticeAction(request));
 expect(ambiguous).toMatchObject({code:'VALIDATION_ERROR',choices:expect.arrayContaining([expect.objectContaining({id:order.orderId}),expect.objectContaining({id:second.receipt.orderId})])});
 expect(await sql`SELECT handover_mode FROM public.orders WHERE tenant_id=${KREILE_TENANT_SLUG} AND customer_id=${order.customerId}`).toEqual([{handover_mode:'shipping'},{handover_mode:'shipping'}]);
 expect(await withSession(full,()=>changeOrderPickupNoticeAction({...request,orderId:order.orderId,expectedVersion:order.version+10}))).toMatchObject({code:'CONFLICT'});
 expect(await sql`SELECT count(*)::integer AS n FROM public.events WHERE tenant_id=${KREILE_TENANT_SLUG} AND client_event_id=${request.clientEventId}::uuid`).toEqual([{n:0}]);
 expect(await withSession(full,()=>getLiveOrderCardAction({orderId:order.orderId}))).toMatchObject({code:'OK',data:{card:{handoverMode:'shipping'}}});
 const chosen={...request,orderId:order.orderId,expectedVersion:order.version};
 expect(await withSession(full,()=>changeOrderPickupNoticeAction(chosen))).toMatchObject({code:'OK',receipt:{orderId:order.orderId,handoverMode:'pickup'}});
 expect(await withSession(full,()=>getLiveOrderCardAction({orderId:order.orderId}))).toMatchObject({code:'OK',data:{card:{handoverMode:'pickup'}}});
 expect(await withSession(full,()=>changeOrderPickupNoticeAction(structuredClone(chosen)))).toMatchObject({code:'OK',replayed:true});
 expect(await sql`SELECT handover_mode FROM public.orders WHERE tenant_id=${KREILE_TENANT_SLUG} AND id=${second.receipt.orderId}`).toEqual([{handover_mode:'shipping'}]);
 expect(await sql`SELECT user_id::text FROM public.events WHERE tenant_id=${KREILE_TENANT_SLUG} AND client_event_id=${chosen.clientEventId}::uuid AND event_type='ORDER_HANDOVER_MAIL_V1'`).toEqual([{user_id:full.actorId}]);
});

it('H5 existing shipping label keeps shipping and creates one real callback task linked to the original',async()=>{
 const order=await readyInvoiceOrder('H5-late','shipping');
 // Synthetic pre-existing carrier result. No carrier API is invoked or claimed.
 const shipmentId=randomUUID();
 await sql`INSERT INTO public.shipments(id,tenant_id,order_id,carrier,label_url,status) VALUES(${shipmentId},${KREILE_TENANT_SLUG},${order.orderId},'TEST carrier','https://TEST.example.invalid/label.pdf','created')`;
 const mail=await selectedPickupMail(order.customerId);
 const {changeOrderPickupNoticeAction,getLiveOrderCardAction}=await import('@/app/actions/orders.actions');
 const request={command:'handover_from_mail' as const,sourceItemId:mail.id,sourceVersion:mail.version,clientEventId:randomUUID()};
 const result=await withSession(full,()=>changeOrderPickupNoticeAction(request));
 expect(result,JSON.stringify(result)).toMatchObject({code:'OK',receipt:{orderId:order.orderId,handoverMode:'shipping',requestedHandoverMode:'pickup',outcome:'call_customer',mailActor:{sender:'test-'+order.customerId+'@example.invalid',originalItemId:mail.id}}});
 if(result.code!=='OK'||!result.receipt||typeof result.receipt!=='object'||!('taskId'in result.receipt)||typeof result.receipt.taskId!=='string')throw Error('H5_CALLBACK_MISSING');
 const taskId=result.receipt.taskId;
 expect(await sql`SELECT handover_mode FROM public.orders WHERE tenant_id=${KREILE_TENANT_SLUG} AND id=${order.orderId}`).toEqual([{handover_mode:'shipping'}]);
 expect(await sql`SELECT status,label_url FROM public.shipments WHERE tenant_id=${KREILE_TENANT_SLUG} AND id=${shipmentId}::uuid`).toEqual([{status:'created',label_url:'https://TEST.example.invalid/label.pdf'}]);
 const {getIntakeTaskAction,completeIntakeTaskAction}=await import('@/app/actions/eingang.actions');
 const task=await withSession(full,()=>getIntakeTaskAction({taskId}));
 expect(task).toMatchObject({code:'OK',task:{art:'rueckruf',status:'offen',bezug_id:order.orderId},reference:{type:'auftrag',id:order.orderId}});
 expect(await withSession(full,()=>getLiveOrderCardAction({orderId:order.orderId}))).toMatchObject({code:'OK',data:{card:{handoverMode:'shipping',handoverNotice:{taskId,taskState:'offen'}}}});
 expect(await withSession(full,()=>changeOrderPickupNoticeAction(structuredClone(request)))).toMatchObject({code:'OK',replayed:true});
 expect(await sql`SELECT id::text,erstellt_von::text FROM public.tasks WHERE tenant_id=${KREILE_TENANT_SLUG} AND client_key=${request.clientEventId}::uuid`).toEqual([{id:taskId,erstellt_von:full.actorId}]);
 if(task.code!=='OK'||!task.task)throw Error('H5_TASK_READ');
 const taskVersion=task.task.version;
 expect(await withSession(full,()=>completeIntakeTaskAction({taskId,version:taskVersion,note:'TEST Kunde telefonisch informiert, Versand bleibt bestehen'}))).toMatchObject({code:'OK'});
 expect(await sql`SELECT status,erledigt_von::text FROM public.tasks WHERE tenant_id=${KREILE_TENANT_SLUG} AND id=${taskId}::uuid`).toEqual([{status:'erledigt',erledigt_von:full.actorId}]);
 expect(await withSession(full,()=>getLiveOrderCardAction({orderId:order.orderId}))).toMatchObject({code:'OK',data:{card:{handoverMode:'shipping',handoverNotice:{taskId,taskState:'erledigt'}}}});
});
