import {randomUUID} from 'node:crypto';
import {expect,it} from 'vitest';
import {KREILE_TENANT_SLUG} from '@/lib/tenant';
import {sql,full,withSession} from './replayHarness';
import {readyInvoiceOrder} from './orderFixture';
import {installMailProvider} from './mailProvider';

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
