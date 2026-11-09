import {randomUUID,createHash} from 'node:crypto';
import {expect,it} from 'vitest';
import {KREILE_TENANT_SLUG} from '@/lib/tenant';
import {sql,full,withSession,createFixture} from './replayHarness';
import {customerFixture} from './orderFixture';
import {storeOrderPhoto,storeItemPhoto,TEST_PHOTO_BYTES} from './photoFixture';

it('H3 completion requires a secured photo for each actual part, not an order-level photo',async()=>{
 const customerId=await customerFixture('H3-photo');
 const {createOrderIntakeAction}=await import('@/app/actions/eingang.actions');
 const created=await withSession(full,()=>createOrderIntakeAction({geprueft:true,clientEventId:randomUUID(),customer:{mode:'EXISTING',customerId},dueDate:'2027-05-15',termStatus:'bestaetigt',intakeSource:'persoenlich',handoverMode:'shipping',paymentMode:'rechnung',note:'TEST H3 per-part photos',items:['TEST Teil A','TEST Teil B'].map(name=>({catalogServiceId:null,name,quantity:1,material:'Messing',surfaceRequested:'Verchromen',executionRequested:'offen',unit:'Stück',unitPriceCents:10000,vatRateBasisPoints:1900}))}));
 expect(created.code).toBe('OK');if(created.code!=='OK')throw Error('H3_CREATE:'+created.code);
 const orderId=created.receipt.orderId;
 const {transitionWareneingangToGalvanikAction,setOrderItemFinishedAction,setExtraWorkHourlyRateAction,freezeOrderAction,getLiveOrderCardAction}=await import('@/app/actions/orders.actions');
 const moved=await withSession(full,()=>transitionWareneingangToGalvanikAction({orderId,expectedVersion:1,clientEventId:randomUUID()}));
 expect(moved.code).toBe('OK');if(moved.code!=='OK')throw Error('H3_MOVE:'+moved.code);
 let version=moved.receipt.aggregateVersion;
 for(const item of created.receipt.items){
  const finished=await withSession(full,()=>setOrderItemFinishedAction({orderId,itemId:item.id,expectedVersion:version,clientEventId:randomUUID(),finished:true}));
  expect(finished.code).toBe('OK');if(finished.code!=='OK')throw Error('H3_PART:'+finished.code);
  version=finished.receipt.aggregateVersion;
 }
 expect(await withSession(full,()=>setExtraWorkHourlyRateAction({rateId:randomUUID(),expectedVersion:0,hourlyRateCents:14000,clientEventId:randomUUID()}))).toMatchObject({code:'OK'});
 const request={orderId,freezeId:randomUUID(),expectedVersion:version,clientEventId:randomUUID()};
 expect(await withSession(full,()=>freezeOrderAction(request))).toMatchObject({code:'VALIDATION_ERROR'});
 expect(await sql`SELECT station,version FROM public.orders WHERE tenant_id=${KREILE_TENANT_SLUG} AND id=${orderId}`).toEqual([{station:'galvanik',version}]);
 expect(await sql`SELECT count(*)::integer AS n FROM public.events WHERE tenant_id=${KREILE_TENANT_SLUG} AND client_event_id=${request.clientEventId}::uuid`).toEqual([{n:0}]);
 await storeOrderPhoto(orderId);
 expect(await withSession(full,()=>freezeOrderAction(structuredClone(request)))).toMatchObject({code:'VALIDATION_ERROR'});
 expect(await withSession(full,()=>getLiveOrderCardAction({orderId}))).toMatchObject({code:'OK',data:{card:{station:'galvanik'}}});
 const {reserveDomainAttachmentAction,finalizeDomainAttachmentAction,getDomainAttachmentsAction}=await import('@/app/actions/domainAttachments.actions');
 const reserveInput={targetType:'ITEM' as const,targetId:created.receipt.items[0].id,clientRequestId:randomUUID(),mimeType:'image/png' as const,fileBytes:TEST_PHOTO_BYTES.length,contentSha256:createHash('sha256').update(TEST_PHOTO_BYTES).digest('hex')};
 const reader=await createFixture([],'readonly');
 expect(await withSession(reader,()=>reserveDomainAttachmentAction(reserveInput))).toMatchObject({code:'FORBIDDEN'});
 expect(await withSession(full,()=>reserveDomainAttachmentAction({...reserveInput,mimeType:'application/pdf'}))).toMatchObject({code:'VALIDATION_ERROR'});
 const firstPhoto=await storeItemPhoto(created.receipt.items[0].id,reserveInput.clientRequestId,async()=>{
  expect(await withSession(full,()=>freezeOrderAction(structuredClone(request)))).toMatchObject({code:'VALIDATION_ERROR'});
 });
 expect(await sql`SELECT photo_ids FROM public.items WHERE tenant_id=${KREILE_TENANT_SLUG} AND id=${created.receipt.items[0].id}`).toEqual([{photo_ids:[firstPhoto]}]);
 expect(await withSession(full,()=>freezeOrderAction(structuredClone(request)))).toMatchObject({code:'VALIDATION_ERROR'});
 expect(await withSession(full,()=>getDomainAttachmentsAction({targetType:'ORDER',targetId:orderId}))).toMatchObject({code:'OK'});
 expect(await withSession(full,()=>reserveDomainAttachmentAction(structuredClone(reserveInput)))).toMatchObject({code:'OK',data:{replayed:true,receipt:{attachmentId:firstPhoto,targetType:'ITEM',targetId:created.receipt.items[0].id}}});
 expect(await withSession(full,()=>reserveDomainAttachmentAction({...reserveInput,targetType:'ORDER',targetId:orderId}))).toMatchObject({code:'CONFLICT'});
 expect(await withSession(full,()=>finalizeDomainAttachmentAction({attachmentId:firstPhoto,fileBytes:reserveInput.fileBytes,contentSha256:reserveInput.contentSha256}))).toMatchObject({code:'OK',data:{replayed:true}});
 const secondPhoto=await storeItemPhoto(created.receipt.items[1].id);
 expect(await sql`SELECT photo_ids FROM public.items WHERE tenant_id=${KREILE_TENANT_SLUG} AND id=${created.receipt.items[1].id}`).toEqual([{photo_ids:[secondPhoto]}]);
 expect(await sql`SELECT user_id::text,payload->>'itemId' AS item_id FROM public.events WHERE tenant_id=${KREILE_TENANT_SLUG} AND event_type='ORDER_ITEM_PHOTO_ATTACHED_V1' ORDER BY payload->>'itemId'`).toEqual(created.receipt.items.map(item=>({user_id:full.actorId,item_id:item.id})).sort((a,b)=>a.item_id.localeCompare(b.item_id)));
 const frozen=await withSession(full,()=>freezeOrderAction(structuredClone(request)));
 expect(frozen,JSON.stringify(frozen)).toMatchObject({code:'OK'});
 expect(await sql`SELECT station FROM public.orders WHERE tenant_id=${KREILE_TENANT_SLUG} AND id=${orderId}`).toEqual([{station:'fertig'}]);
 expect(await withSession(full,()=>getLiveOrderCardAction({orderId}))).toMatchObject({code:'OK',data:{card:{station:'fertig'}}});
 expect(await withSession(full,()=>freezeOrderAction(structuredClone(request)))).toMatchObject({code:'OK',replayed:true});
 expect(await sql`SELECT user_id::text FROM public.events WHERE tenant_id=${KREILE_TENANT_SLUG} AND client_event_id=${request.clientEventId}::uuid`).toEqual([{user_id:full.actorId}]);
});
