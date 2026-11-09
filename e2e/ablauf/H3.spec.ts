import {randomUUID} from 'node:crypto';
import {expect,it} from 'vitest';
import {KREILE_TENANT_SLUG} from '@/lib/tenant';
import {sql,full,withSession} from './replayHarness';

// This prefix verifies direct intake and the next actual station command.
// Invoice/delivery/overdue continuation is still required for a complete H3 PASS.
it('H3 Rechnung auf Ziel / direct personal intake stays in wareneingang until explicit Galvanik handoff',async()=>{
  const customerId=randomUUID(),clientEventId=randomUUID();
  await sql`INSERT INTO public.customers(id,tenant_id,customer_number,name,company_name,type,contact_person,email,phone,street,house_number,zip_code,city,country,payment_preference,ziel_freigeschaltet,ziel_tage,source,first_name,last_name,salutation)
    VALUES(${customerId},${KREILE_TENANT_SLUG},${'TEST-H3-'+customerId},'TEST H3 Firma','TEST H3 Firma GmbH','business','TEST H3 Person',${'TEST-H3-'+customerId+'@example.invalid'},'+49 711 5550189','TEST Weg','1','70176','Stuttgart','DE','rechnung',true,14,'manual','TEST','Person','ohne')`;
  const {createOrderIntakeAction}=await import('@/app/actions/eingang.actions');
  const {getLiveOrderCardAction,transitionWareneingangToGalvanikAction,setOrderItemFinishedAction,setExtraWorkHourlyRateAction,freezeOrderAction}=await import('@/app/actions/orders.actions');
  const input={geprueft:true,clientEventId,customer:{mode:'EXISTING' as const,customerId},dueDate:'2027-05-15',termStatus:'bestaetigt',intakeSource:'persoenlich',handoverMode:'shipping',paymentMode:'rechnung',note:'TEST H3 Rechnung auf Ziel',items:[{catalogServiceId:null,name:'TEST H3 Trompete',quantity:4,material:'Messing',surfaceRequested:'Verchromen',executionRequested:'offen',unit:'Stück',unitPriceCents:2500,vatRateBasisPoints:1900}]};
  const created=await withSession(full,()=>createOrderIntakeAction(input));
  expect(created.code).toBe('OK');
  if(created.code!=='OK')throw Error('H3_DIRECT_INTAKE:'+created.code);
  const orderId=created.receipt.orderId;
  expect(await sql`SELECT station,version,payment_mode,handover_mode,ware,geprueft FROM public.orders WHERE tenant_id=${KREILE_TENANT_SLUG} AND id=${orderId}`).toEqual([{station:'angenommen',version:1,payment_mode:'rechnung',handover_mode:'shipping',ware:'da',geprueft:true}]);
  expect(await sql`SELECT event_type,station,user_id::text FROM public.events WHERE tenant_id=${KREILE_TENANT_SLUG} AND order_id=${orderId} AND client_event_id=${clientEventId}`).toEqual([{event_type:'ORDER_INTAKE_CREATED_V1',station:'wareneingang',user_id:full.actorId}]);
  expect(await withSession(full,()=>getLiveOrderCardAction({orderId}))).toMatchObject({code:'OK',data:{card:{id:orderId,station:'angenommen',version:1}}});
  expect(await withSession(full,()=>createOrderIntakeAction(input))).toMatchObject({code:'OK',replayed:true,receipt:{orderId}});
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
  const rate=await withSession(full,()=>setExtraWorkHourlyRateAction({rateId:randomUUID(),expectedVersion:0,hourlyRateCents:14000,clientEventId:randomUUID()}));
  expect(rate.code).toBe('OK');
  // BAUPLAN werkstattregel.pflichtfoto (U-090): finishing the order, unlike
  // marking a part complete, must be refused without a photo linked to that part.
  const freeze=await withSession(full,()=>freezeOrderAction({orderId,freezeId:randomUUID(),expectedVersion:finished.receipt.aggregateVersion,clientEventId:randomUUID()}));
  expect(freeze).toMatchObject({code:'VALIDATION_ERROR',message:expect.stringContaining('Foto fehlt')});
  expect(await sql`SELECT station,version FROM public.orders WHERE tenant_id=${KREILE_TENANT_SLUG} AND id=${orderId}`).toEqual([{station:'galvanik',version:finished.receipt.aggregateVersion}]);
});
