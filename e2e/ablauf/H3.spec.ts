import {randomUUID,createHash} from 'node:crypto';
import {expect,it} from 'vitest';
import {KREILE_TENANT_SLUG} from '@/lib/tenant';
import {sql,full,withSession,createFixture} from './replayHarness';
import {customerFixture} from './orderFixture';
import {storeOrderPhoto,TEST_PHOTO_BYTES} from './photoFixture';

it('H3 existing order-card part photo path must satisfy the completion gate without a second upload',async()=>{
 const customerId=await customerFixture('H3-UI');
 const {createOrderIntakeAction}=await import('@/app/actions/eingang.actions');
 const created=await withSession(full,()=>createOrderIntakeAction({geprueft:true,clientEventId:randomUUID(),customer:{mode:'EXISTING',customerId},dueDate:'2027-05-15',termStatus:'bestaetigt',intakeSource:'persoenlich',handoverMode:'pickup',paymentMode:'rechnung',note:'TEST existing H3 photo port',items:[{catalogServiceId:null,name:'TEST Teilfoto',quantity:1,material:'Messing',surfaceRequested:'Verchromen',executionRequested:'offen',unit:'Stück',unitPriceCents:10000,vatRateBasisPoints:1900}]}));
 expect(created.code).toBe('OK');if(created.code!=='OK')throw Error('H3_EXISTING_CREATE:'+created.code);
 const orderId=created.receipt.orderId,itemId=created.receipt.items[0].id;
 const {transitionWareneingangToGalvanikAction,setOrderItemFinishedAction,getExtraWorkMasterDataAction,setExtraWorkHourlyRateAction,freezeOrderAction,getLiveOrderCardAction}=await import('@/app/actions/orders.actions');
 const moved=await withSession(full,()=>transitionWareneingangToGalvanikAction({orderId,expectedVersion:1,clientEventId:randomUUID()}));
 expect(moved.code).toBe('OK');if(moved.code!=='OK')throw Error('H3_EXISTING_MOVE:'+moved.code);
 const finished=await withSession(full,()=>setOrderItemFinishedAction({orderId,itemId,expectedVersion:moved.receipt.aggregateVersion,clientEventId:randomUUID(),finished:true}));
 expect(finished.code).toBe('OK');if(finished.code!=='OK')throw Error('H3_EXISTING_FINISH:'+finished.code);
 // These are the exact ports passed to OrderStationAttachmentPanel by OrderCardAppAdapter.
 const {reserveGalvanikHandoffAttachmentAction,finalizeGalvanikHandoffAttachmentAction,getGalvanikHandoffAttachmentsAction,getGalvanikHandoffAttachmentOriginalAction}=await import('@/app/warendurchlauf/actions');
 const contentSha256=createHash('sha256').update(TEST_PHOTO_BYTES).digest('hex');
 const reserveInput={orderId,itemId,expectedVersion:finished.receipt.aggregateVersion,clientRequestId:randomUUID(),mimeType:'image/png' as const,fileBytes:TEST_PHOTO_BYTES.length,contentSha256};
 const reader=await createFixture([],'readonly');
 expect(await withSession(reader,()=>reserveGalvanikHandoffAttachmentAction(structuredClone(reserveInput)))).toMatchObject({code:'FORBIDDEN'});
 const reserve=await withSession(full,()=>reserveGalvanikHandoffAttachmentAction(reserveInput));
 expect(reserve,JSON.stringify(reserve)).toMatchObject({code:'OK'});if(reserve.code!=='OK'||!reserve.data.upload)throw Error('H3_EXISTING_RESERVE:'+reserve.code);
 const endpoint=new URL('/storage/v1/object/upload/sign/item-photos/'+reserve.data.upload.path,process.env.NEXT_PUBLIC_SUPABASE_URL);
 expect(endpoint.hostname).toBe('127.0.0.1');endpoint.searchParams.set('token',reserve.data.upload.token);
 const upload=await fetch(endpoint,{method:'PUT',headers:{'content-type':'image/png','x-upsert':'false'},body:new Blob([new Uint8Array(TEST_PHOTO_BYTES).buffer],{type:'image/png'})});
 expect(upload.ok).toBe(true);
 const finalized=await withSession(full,()=>finalizeGalvanikHandoffAttachmentAction({reservationId:reserve.data.receipt.reservationId}));
 expect(finalized,JSON.stringify(finalized)).toMatchObject({code:'OK',data:{receipt:{state:'FINALIZED',contentSha256,actorId:full.actorId}}});
 if(finalized.code!=='OK'||!finalized.data.receipt.receiptId)throw Error('H3_EXISTING_FINALIZED');
 expect(await withSession(full,()=>getGalvanikHandoffAttachmentsAction({orderId,itemId}))).toMatchObject({code:'OK',data:{receipts:expect.arrayContaining([expect.objectContaining({state:'FINALIZED',contentSha256})]),evidenceRecords:expect.arrayContaining([expect.objectContaining({original:expect.objectContaining({state:'VERIFIED',hash:contentSha256}),targets:expect.arrayContaining([{targetType:'ORDER_ITEM',targetId:itemId}])})])}});
 const original=await withSession(full,()=>getGalvanikHandoffAttachmentOriginalAction({receiptId:finalized.data.receipt.receiptId!}));
 expect(original.code).toBe('OK');if(original.code!=='OK')throw Error('H3_EXISTING_ORIGINAL:'+original.code);
 expect(new URL(original.data.downloadUrl).hostname).toBe('127.0.0.1');
 const downloaded=await fetch(original.data.downloadUrl);expect(downloaded.ok).toBe(true);
 expect(createHash('sha256').update(new Uint8Array(await downloaded.arrayBuffer())).digest('hex')).toBe(contentSha256);
 expect(await withSession(full,()=>reserveGalvanikHandoffAttachmentAction(structuredClone(reserveInput)))).toMatchObject({code:'OK',data:{replayed:true,receipt:{receiptId:finalized.data.receipt.receiptId}}});
 expect(await withSession(full,()=>finalizeGalvanikHandoffAttachmentAction(JSON.parse(JSON.stringify({reservationId:reserve.data.receipt.reservationId}))))).toMatchObject({code:'OK',data:{replayed:true}});
 expect(await sql`SELECT count(*)::integer AS n FROM private.evidence_domain_links WHERE tenant_id=${KREILE_TENANT_SLUG} AND target_type='ORDER_ITEM' AND target_id=${itemId}`).toEqual([{n:1}]);
 const master=await withSession(full,()=>getExtraWorkMasterDataAction());
 expect(master.code).toBe('OK');if(master.code!=='OK')throw Error('H3_EXISTING_MASTER:'+master.code);
 if(!master.data.currentRate)expect(await withSession(full,()=>setExtraWorkHourlyRateAction({rateId:randomUUID(),expectedVersion:0,hourlyRateCents:14000,clientEventId:randomUUID()}))).toMatchObject({code:'OK'});
 const freezeInput={orderId,freezeId:randomUUID(),expectedVersion:finished.receipt.aggregateVersion,clientEventId:randomUUID()};
 const frozen=await withSession(full,()=>freezeOrderAction(freezeInput));
 expect(frozen,JSON.stringify(frozen)).toMatchObject({code:'OK'});
 expect(await withSession(full,()=>getLiveOrderCardAction({orderId}))).toMatchObject({code:'OK',data:{card:{station:'fertig'}}});
 expect(await withSession(full,()=>freezeOrderAction(structuredClone(freezeInput)))).toMatchObject({code:'OK',replayed:true});
 expect(await sql`SELECT count(*)::integer AS n FROM public.events WHERE tenant_id=${KREILE_TENANT_SLUG} AND client_event_id=${freezeInput.clientEventId}::uuid`).toEqual([{n:1}]);
});

it('H3 completion requires a secured photo for each actual part, not an order-level photo',async()=>{
 const customerId=await customerFixture('H3-photo');
 const {createOrderIntakeAction}=await import('@/app/actions/eingang.actions');
 const created=await withSession(full,()=>createOrderIntakeAction({geprueft:true,clientEventId:randomUUID(),customer:{mode:'EXISTING',customerId},dueDate:'2027-05-15',termStatus:'bestaetigt',intakeSource:'persoenlich',handoverMode:'shipping',paymentMode:'rechnung',note:'TEST H3 per-part photos',items:['TEST Teil A','TEST Teil B'].map(name=>({catalogServiceId:null,name,quantity:1,material:'Messing',surfaceRequested:'Verchromen',executionRequested:'offen',unit:'Stück',unitPriceCents:10000,vatRateBasisPoints:1900}))}));
 expect(created.code).toBe('OK');if(created.code!=='OK')throw Error('H3_CREATE:'+created.code);
 const orderId=created.receipt.orderId;
 const {transitionWareneingangToGalvanikAction,setOrderItemFinishedAction,setExtraWorkHourlyRateAction,getExtraWorkMasterDataAction,freezeOrderAction,getLiveOrderCardAction}=await import('@/app/actions/orders.actions');
 const moved=await withSession(full,()=>transitionWareneingangToGalvanikAction({orderId,expectedVersion:1,clientEventId:randomUUID()}));
 expect(moved.code).toBe('OK');if(moved.code!=='OK')throw Error('H3_MOVE:'+moved.code);
 let version=moved.receipt.aggregateVersion;
 for(const item of created.receipt.items){
  const finished=await withSession(full,()=>setOrderItemFinishedAction({orderId,itemId:item.id,expectedVersion:version,clientEventId:randomUUID(),finished:true}));
  expect(finished.code).toBe('OK');if(finished.code!=='OK')throw Error('H3_PART:'+finished.code);
  version=finished.receipt.aggregateVersion;
 }
 const master=await withSession(full,()=>getExtraWorkMasterDataAction());
 expect(master.code).toBe('OK');if(master.code!=='OK')throw Error('H3_NEGATIVE_MASTER:'+master.code);
 if(!master.data.currentRate)expect(await withSession(full,()=>setExtraWorkHourlyRateAction({rateId:randomUUID(),expectedVersion:0,hourlyRateCents:14000,clientEventId:randomUUID()}))).toMatchObject({code:'OK'});
 const request={orderId,freezeId:randomUUID(),expectedVersion:version,clientEventId:randomUUID()};
 expect(await withSession(full,()=>freezeOrderAction(request))).toMatchObject({code:'VALIDATION_ERROR'});
 expect(await sql`SELECT station,version FROM public.orders WHERE tenant_id=${KREILE_TENANT_SLUG} AND id=${orderId}`).toEqual([{station:'galvanik',version}]);
 expect(await sql`SELECT count(*)::integer AS n FROM public.events WHERE tenant_id=${KREILE_TENANT_SLUG} AND client_event_id=${request.clientEventId}::uuid`).toEqual([{n:0}]);
 await storeOrderPhoto(orderId);
 expect(await withSession(full,()=>freezeOrderAction(structuredClone(request)))).toMatchObject({code:'VALIDATION_ERROR'});
 expect(await withSession(full,()=>getLiveOrderCardAction({orderId}))).toMatchObject({code:'OK',data:{card:{station:'galvanik'}}});
 // Separate legacy-test fixture contract: synthetic INITIAL metadata, not an upload proof.
 const {seedSyntheticItemPhotos}=await import('@/test/fixtures/complaintPhoto');
 await seedSyntheticItemPhotos(sql,{tenantId:KREILE_TENANT_SLUG,actorId:full.actorId,orderId});
 const fixture=await sql.begin(async tx=>{await tx`SELECT set_config('app.tenant_id',${KREILE_TENANT_SLUG},true)`;return tx`SELECT count(*)::integer AS n FROM private.v_evidence_records_v2 WHERE tenant_id=${KREILE_TENANT_SLUG} AND source_kind='ORDER_STATION_ATTACHMENT' AND original_state='VERIFIED' AND integrity_ok=true AND target_links @> jsonb_build_array(jsonb_build_object('targetType','ORDER','targetId',${orderId}::text))`;});
 expect(fixture).toEqual([{n:2}]);
});

// This prefix verifies direct intake and the next actual station command.
// Invoice/delivery/overdue continuation is still required for a complete H3 PASS.
it('H3 Rechnung auf Ziel / direct personal intake stays in wareneingang until explicit Galvanik handoff',async()=>{
  const customerId=randomUUID(),clientEventId=randomUUID();
  await sql`INSERT INTO public.customers(id,tenant_id,customer_number,name,company_name,type,contact_person,email,phone,street,house_number,zip_code,city,country,payment_preference,ziel_freigeschaltet,ziel_tage,source,first_name,last_name,salutation)
    VALUES(${customerId},${KREILE_TENANT_SLUG},${'TEST-H3-'+customerId},'TEST H3 Firma','TEST H3 Firma GmbH','business','TEST H3 Person',${'TEST-H3-'+customerId+'@example.invalid'},'+49 711 5550189','TEST Weg','1','70176','Stuttgart','DE','rechnung',true,14,'manual','TEST','Person','ohne')`;
  const {createOrderIntakeAction}=await import('@/app/actions/eingang.actions');
  const {getLiveOrderCardAction,transitionWareneingangToGalvanikAction,setOrderItemFinishedAction,setExtraWorkHourlyRateAction,getExtraWorkMasterDataAction,freezeOrderAction}=await import('@/app/actions/orders.actions');
  const input={geprueft:true,clientEventId,customer:{mode:'EXISTING' as const,customerId},dueDate:'2027-05-15',termStatus:'bestaetigt',intakeSource:'persoenlich',handoverMode:'shipping',paymentMode:'rechnung',note:'TEST H3 Rechnung auf Ziel',items:[{catalogServiceId:null,name:'TEST H3 Trompete',quantity:4,material:'Messing',surfaceRequested:'Verchromen',executionRequested:'offen',unit:'Stück',unitPriceCents:2500,vatRateBasisPoints:1900}]};
  const created=await withSession(full,()=>createOrderIntakeAction(input));
  expect(created.code).toBe('OK');
  if(created.code!=='OK')throw Error('H3_DIRECT_INTAKE:'+created.code);
  const orderId=created.receipt.orderId;
  expect(await sql`SELECT station,version,payment_mode,handover_mode,ware,geprueft FROM public.orders WHERE tenant_id=${KREILE_TENANT_SLUG} AND id=${orderId}`).toEqual([{station:'angenommen',version:1,payment_mode:'rechnung',handover_mode:'shipping',ware:'da',geprueft:true}]);
  expect(await sql`SELECT event_type,station,user_id::text FROM public.events WHERE tenant_id=${KREILE_TENANT_SLUG} AND order_id=${orderId} AND client_event_id=${clientEventId}`).toEqual([{event_type:'ORDER_INTAKE_CREATED_V1',station:'wareneingang',user_id:full.actorId}]);
  expect(await withSession(full,()=>getLiveOrderCardAction({orderId}))).toMatchObject({code:'OK',data:{card:{id:orderId,station:'angenommen',version:1}}});
  expect(await withSession(full,()=>createOrderIntakeAction(structuredClone(input)))).toMatchObject({code:'OK',replayed:true,receipt:{orderId}});
  expect(await sql`SELECT count(*)::integer AS n FROM public.orders WHERE tenant_id=${KREILE_TENANT_SLUG} AND source_ref=${clientEventId}`).toEqual([{n:1}]);
  const handoffKey=randomUUID();
  const handoff=await withSession(full,()=>transitionWareneingangToGalvanikAction({orderId,expectedVersion:1,clientEventId:handoffKey}));
  expect(handoff.code).toBe('OK');
  if(handoff.code!=='OK')throw Error('H3_GALVANIK_HANDOFF:'+handoff.code);
  expect(await sql`SELECT station,version FROM public.orders WHERE tenant_id=${KREILE_TENANT_SLUG} AND id=${orderId}`).toEqual([{station:'galvanik',version:handoff.receipt.aggregateVersion}]);
  expect(await withSession(full,()=>getLiveOrderCardAction({orderId}))).toMatchObject({code:'OK',data:{card:{id:orderId,station:'galvanik',version:handoff.receipt.aggregateVersion}}});
  expect(await withSession(full,()=>transitionWareneingangToGalvanikAction({orderId,expectedVersion:1,clientEventId:handoffKey}))).toMatchObject({code:'OK',replayed:true});
  expect(await sql`SELECT count(*)::integer AS n FROM public.events WHERE tenant_id=${KREILE_TENANT_SLUG} AND order_id=${orderId} AND client_event_id=${handoffKey}`).toEqual([{n:1}]);
  const itemId=created.receipt.items[0].id;
  const finished=await withSession(full,()=>setOrderItemFinishedAction({orderId,itemId,expectedVersion:handoff.receipt.aggregateVersion,clientEventId:randomUUID(),finished:true}));
  expect(finished.code).toBe('OK');
  if(finished.code!=='OK')throw Error('H3_ITEM_FINISH:'+finished.code);
  const master=await withSession(full,()=>getExtraWorkMasterDataAction());
  expect(master.code).toBe('OK');if(master.code!=='OK')throw Error('H3_RATE_READ:'+master.code);
  if(!master.data.currentRate){
   const rate=await withSession(full,()=>setExtraWorkHourlyRateAction({rateId:randomUUID(),expectedVersion:0,hourlyRateCents:14000,clientEventId:randomUUID()}));
   expect(rate.code).toBe('OK');
  }
  // BAUPLAN werkstattregel.pflichtfoto (U-090): finishing the order, unlike
  // marking a part complete, must be refused without a photo linked to that part.
  const freeze=await withSession(full,()=>freezeOrderAction({orderId,freezeId:randomUUID(),expectedVersion:finished.receipt.aggregateVersion,clientEventId:randomUUID()}));
  expect(freeze).toMatchObject({code:'VALIDATION_ERROR',message:'Nimm für jedes Teil ein Foto auf, bevor Du den Auftrag fertig meldest.'});
  expect(await sql`SELECT station,version FROM public.orders WHERE tenant_id=${KREILE_TENANT_SLUG} AND id=${orderId}`).toEqual([{station:'galvanik',version:finished.receipt.aggregateVersion}]);
});
