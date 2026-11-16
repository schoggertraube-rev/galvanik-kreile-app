// @vitest-environment node
// K3 real completion/Auth/DB/snapshot source; explicit TEST device-clock offsets.
import {randomUUID} from 'node:crypto';
import {expect,it,vi} from 'vitest';
const tenant=vi.hoisted(()=>'TEST-ablauf-'+globalThis.crypto.randomUUID());
vi.mock('@/lib/tenant',()=>({KREILE_TENANT_SLUG:tenant}));
import {KREILE_TENANT_SLUG} from '@/lib/tenant';
import {full,sql,withSession} from '../../../e2e/ablauf/replayHarness';
import {customerFixture,intakeOrderFixture,readyInvoiceOrder,manualTrackingFixture} from '../../../e2e/ablauf/orderFixture';
import {storeItemPhoto,storeIntakeGoodsPhoto,TEST_PHOTO_BYTES} from '../../../e2e/ablauf/photoFixture';
import {transitionWareneingangToGalvanikAction,setOrderItemFinishedAction,configureExtraWorkCatalogPositionAction,getExtraWorkMasterDataAction,setExtraWorkHourlyRateAction,changeOrderItemExtraWorkAction,getManualShippingAction} from '@/app/actions/orders.actions';
import {saveIntakeNoteAction,prepareIntakeFileAction,finishIntakeFileAction} from '@/app/actions/eingang.actions';
import {recordGoodsOutAction} from '@/app/actions/goodsOut.actions';
import {offlinePartition} from '@/lib/server/offlinePartition';
import {createHash} from 'node:crypto';
import type {ShipmentGroupInput} from '@/lib/domain/shipmentGroupContract';
it.each([10*60,-3*60])('K3 production occurrence for device offset %i min preserves original time/actor/key and an exact retry',async minutes=>{
 const customer=await customerFixture('TEST K3 clock '+minutes),order=await intakeOrderFixture('TEST K3 clock '+minutes,customer);
 const moved=await withSession(full,()=>transitionWareneingangToGalvanikAction({orderId:order.receipt.orderId,expectedVersion:1,clientEventId:randomUUID()}));
 if(moved.code!=='OK')throw Error('TEST_K3_REAL_HANDOFF');await storeItemPhoto(order.receipt.orderId,order.receipt.items[0].id);
 const key=randomUUID(),deviceCapturedAt=new Date(Date.now()+minutes*60000).toISOString();
 const input={orderId:order.receipt.orderId,itemId:order.receipt.items[0].id,expectedVersion:moved.receipt.aggregateVersion,finished:true,clientEventId:key,offlineOriginal:{actorId:full.actorId,clientEventId:key,deviceCapturedAt}};
 const saved=await withSession(full,()=>setOrderItemFinishedAction(input));expect(saved).toMatchObject({code:'OK'});if(saved.code!=='OK')throw Error('TEST_K3_COMPLETION');
 const rows=()=>sql`SELECT to_char(event.created_at,'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') AS server_at,event.payload,snapshot.occurred_at::text AS occurred_at FROM public.events event JOIN private.order_production_snapshots snapshot ON snapshot.tenant_id=event.tenant_id AND snapshot.event_id=event.id WHERE event.tenant_id=${KREILE_TENANT_SLUG} AND event.id=${saved.receipt.eventId} AND snapshot.component='base' AND snapshot.direction=1`;
 const original=await rows();expect(original).toHaveLength(1);expect(original[0].payload.offlineOriginal).toEqual(input.offlineOriginal);
 const [time]=await sql`SELECT to_char(occurred_at,'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') AS at FROM private.order_production_snapshots WHERE tenant_id=${KREILE_TENANT_SLUG} AND event_id=${saved.receipt.eventId} AND component='base' AND direction=1`;
 expect(time.at).toBe(minutes>0?original[0].server_at:deviceCapturedAt);
 if(minutes>0)expect(original[0].payload.geraetezeit_abweichend).toBe(true);
 else expect(original[0].payload.geraetezeit_abweichend).not.toBe(true);
 expect(await withSession(full,()=>setOrderItemFinishedAction(JSON.parse(JSON.stringify(input))))).toMatchObject({code:'OK',replayed:true});
 expect(await rows()).toEqual(original);
});
it('K3 note/photo originals keep future device evidence and actor while their immutable server events mark the clock discrepancy',async()=>{
 const deviceCapturedAt=new Date(Date.now()+10*60*60*1000).toISOString(),scope=offlinePartition({tenantId:KREILE_TENANT_SLUG,userId:full.actorId});
 const note={itemId:randomUUID(),textstand:randomUUID(),text:'TEST K3 Originalzeit',expectedVersion:0,deviceCapturedAt,concerns:[]};
 const before=Date.now();expect(await withSession(full,()=>saveIntakeNoteAction(note,scope))).toMatchObject({code:'OK'});
 const notes=()=>sql`SELECT nachher,von::text AS actor,(extract(epoch FROM zeit)*1000)::double precision AS at FROM public.intake_event WHERE tenant_id=${KREILE_TENANT_SLUG} AND item_id=${note.itemId}::uuid AND befehl_id=${note.textstand}::uuid AND art='original_gespeichert'`;
 const original=await notes();expect(original).toHaveLength(1);expect(original[0]).toMatchObject({actor:full.actorId,nachher:{deviceCapturedAt,geraetezeit_abweichend:true}});
 expect(original[0].at).toBeGreaterThanOrEqual(before-1000);expect(original[0].at).toBeLessThanOrEqual(Date.now()+1000);
 expect(await withSession(full,()=>saveIntakeNoteAction(JSON.parse(JSON.stringify(note)),scope))).toMatchObject({code:'OK'});expect(await notes()).toEqual(original);
 const photo=await storeIntakeGoodsPhoto(undefined,full,undefined,deviceCapturedAt);
 const files=()=>sql`SELECT nachher,von::text AS actor FROM public.intake_event WHERE tenant_id=${KREILE_TENANT_SLUG} AND item_id=${photo.itemId}::uuid AND nachher->>'fileId'=${photo.fileId} AND nachher->>'action'='offline_original_captured'`;
 const originalPhoto=await files();expect(originalPhoto).toHaveLength(1);expect(originalPhoto[0]).toMatchObject({actor:full.actorId,nachher:{deviceCapturedAt,geraetezeit_abweichend:true}});
 expect(await withSession(full,()=>prepareIntakeFileAction({itemId:photo.itemId,fileId:photo.fileId,name:'TEST-Rücksendung.png',mime:'image/png',bytes:TEST_PHOTO_BYTES.length,sha256:createHash('sha256').update(TEST_PHOTO_BYTES).digest('hex'),captureOrigin:'warenfoto',deviceCapturedAt},scope))).toMatchObject({code:'OK'});
 expect(await withSession(full,()=>finishIntakeFileAction(photo.fileId,scope))).toMatchObject({code:'OK'});expect(await files()).toEqual(originalPhoto);
});
it('K3 actual extra-work retains its original future time/key and marks the server event without changing a retry',async()=>{
 const customer=await customerFixture('TEST K3 extra'),order=await intakeOrderFixture('TEST K3 extra',customer),orderId=order.receipt.orderId,itemId=order.receipt.items[0].id;
 const moved=await withSession(full,()=>transitionWareneingangToGalvanikAction({orderId,expectedVersion:1,clientEventId:randomUUID()}));if(moved.code!=='OK')throw Error('TEST_K3_EXTRA_HANDOFF');
 const catalogPositionId=randomUUID();expect(await withSession(full,()=>configureExtraWorkCatalogPositionAction({positionId:catalogPositionId,expectedVersion:0,name:'TEST K3 Mehrarbeit',standardMinutes:25,active:true,clientEventId:randomUUID()}))).toMatchObject({code:'OK'});
 const master=await withSession(full,()=>getExtraWorkMasterDataAction());if(master.code!=='OK')throw Error('TEST_K3_RATE_READ');if(!master.data.currentRate)expect(await withSession(full,()=>setExtraWorkHourlyRateAction({rateId:randomUUID(),expectedVersion:0,hourlyRateCents:14000,clientEventId:randomUUID()}))).toMatchObject({code:'OK'});
 const key=randomUUID(),metadata={actorId:full.actorId,clientEventId:key,deviceCapturedAt:new Date(Date.now()+10*60*60*1000).toISOString()};
 const input={lineId:randomUUID(),orderId,itemId,catalogPositionId,minutes:25,active:true,expectedLineVersion:0,expectedOrderVersion:moved.receipt.aggregateVersion,clientEventId:key,offlineOriginal:metadata};
 const saved=await withSession(full,()=>changeOrderItemExtraWorkAction(input));expect(saved).toMatchObject({code:'OK'});if(saved.code!=='OK')throw Error('TEST_K3_EXTRA_REAL_WRITE');
 const rows=()=>sql`SELECT payload,user_id::text AS actor FROM public.events WHERE tenant_id=${KREILE_TENANT_SLUG} AND id=${saved.receipt.eventId}`;
 const original=await rows();expect(original).toMatchObject([{actor:full.actorId,payload:{offlineOriginal:metadata,geraetezeit_abweichend:true}}]);
 // Explicit synthetic payload boundaries evaluate the actual persisted DB checks.
 const contracts=await sql`SELECT pg_get_expr(conbin,conrelid) AS expression FROM pg_constraint WHERE conrelid='public.events'::regclass AND conname IN ('events_order_item_extra_work_set_v1_contract_chk','events_extra_work_clock_marker_v1_chk','events_offline_original_v1_contract_chk')`;
 expect(contracts).toHaveLength(3);
 for(const payload of [
  {...original[0].payload,geraetezeit_abweichend:false},
  {...original[0].payload,geraetezeit_abweichend:'true'},
  {...original[0].payload,offlineOriginal:null},
  {...original[0].payload,unexpected:true},
 ]){
  const checks=await sql.unsafe(`SELECT (${contracts.map(row=>'('+row.expression+')').join(' AND ')}) IS TRUE AS accepted FROM (SELECT (jsonb_populate_record(NULL::public.events,to_jsonb(event)||jsonb_build_object('payload',$3::jsonb))).* FROM public.events event WHERE event.tenant_id=$1 AND event.id=$2) candidate`,[KREILE_TENANT_SLUG,saved.receipt.eventId,JSON.stringify(payload)]);
  expect(checks).toEqual([{accepted:false}]);
 }
 expect(await withSession(full,()=>changeOrderItemExtraWorkAction(JSON.parse(JSON.stringify(input))))).toMatchObject({code:'OK',replayed:true});expect(await rows()).toEqual(original);
});
it('K3 actual shipment time clamps a future device clock but keeps the original group receipt and key unchanged on retry',async()=>{
 const order=await readyInvoiceOrder('TEST K3 future shipment','shipping');await manualTrackingFixture(order.orderId);
 const read=await withSession(full,()=>getManualShippingAction({orderId:order.orderId}));if(read.code!=='OK'||read.data.shipmentGroups.length!==1)throw Error('TEST_K3_SHIPMENT_SOURCE');
 const group=read.data.shipmentGroups[0],key=randomUUID(),offlineOriginal={actorId:full.actorId,clientEventId:key,deviceCapturedAt:new Date(Date.now()+10*60*60*1000).toISOString()};
 const input:ShipmentGroupInput={orderId:order.orderId,groupId:group.id,expectedGroupVersion:group.version,clientEventId:key,members:[{orderId:order.orderId,expectedVersion:group.members[0].orderVersion}],offlineOriginal};
 const before=Date.now(),saved=await withSession(full,()=>recordGoodsOutAction(input));expect(saved,JSON.stringify(saved)).toMatchObject({code:'OK',receipt:{offlineOriginal}});if(saved.code!=='OK')throw Error('TEST_K3_SHIPMENT_REAL_WRITE');
 const rows=()=>sql`SELECT (extract(epoch FROM shipped_at)*1000)::double precision AS at,status FROM public.shipments WHERE tenant_id=${KREILE_TENANT_SLUG} AND order_id=${order.orderId}`;
 const physical=await rows();expect(physical).toHaveLength(1);expect(physical[0].status).toBe('shipped');expect(physical[0].at).toBeGreaterThanOrEqual(before-1000);expect(physical[0].at).toBeLessThanOrEqual(Date.now()+1000);
 const [event]=await sql`SELECT payload FROM public.events WHERE tenant_id=${KREILE_TENANT_SLUG} AND id=${saved.receipt.eventId}`;
 expect(event.payload).toMatchObject({geraetezeit_abweichend:true,receipt:{offlineOriginal}});
 expect(await withSession(full,()=>recordGoodsOutAction(JSON.parse(JSON.stringify(input))))).toMatchObject({code:'OK',replayed:true});expect(await rows()).toEqual(physical);
});
