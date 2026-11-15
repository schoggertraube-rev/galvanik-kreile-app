// @vitest-environment node
import {it,expect,vi,afterAll} from 'vitest';
const scope=vi.hoisted(()=>{
 const database=process.env.DATABASE_URL,expected=process.env.H18_EXPECTED_DATABASE_URL;
 if(!database||database!==expected||new URL(database).hostname!=='127.0.0.1'||new URL(database).pathname!=='/postgres')throw Error('OWN_LOOPBACK_REQUIRED');
 const clock=new URL(database);clock.searchParams.set('TimeZone','Europe/Berlin');
 process.env.DATABASE_URL=clock.toString();process.env.H18_EXPECTED_DATABASE_URL=clock.toString();
 return {tenant:'TEST-ablauf-'+globalThis.crypto.randomUUID(),database,expected};
});
vi.mock('@/lib/tenant',()=>({KREILE_TENANT_SLUG:scope.tenant}));
import {sql,full,createFixture,withSession} from '../../../e2e/ablauf/replayHarness';
import {readyInvoiceOrder} from '../../../e2e/ablauf/orderFixture';
import {storeOrderPhoto,storeIntakeGoodsPhoto,storeItemPhoto} from '../../../e2e/ablauf/photoFixture';
import {randomUUID} from 'node:crypto';
// The harness restores its provider environment first; restore the original
// connection URL last, so this file cannot leak the connection-local timezone.
vi.setConfig({sequence:{hooks:'list'}});
afterAll(()=>{process.env.DATABASE_URL=scope.database;process.env.H18_EXPECTED_DATABASE_URL=scope.expected;});

it('K13K-6 real rework stores instants without a UTC cast in a Berlin database session',async()=>{
 const [clock]=await sql`SELECT current_setting('TimeZone') AS zone`;
 expect(clock.zone).toBe('Europe/Berlin');
 const order=await readyInvoiceOrder('K13K clock source');
 const photo=await storeOrderPhoto(order.orderId);
 const {reklamationAusfuehrenAction,nacharbeitAnlegenAction,getByOrder}=await import('@/app/actions/complaints.actions');
 const complaint=await withSession(full,()=>reklamationAusfuehrenAction({action:'aufnehmen',clientKey:randomUUID(),orderId:order.orderId,intakeItemId:null,intakeVersion:null,parts:[{position_id:order.items[0].id,menge:1}],defect:'Abplatzung',description:'TEST K13K Zeitquelle',photoIds:[photo],goodsReturn:'ja'}));
 expect(complaint.code).toBe('OK');if(complaint.code!=='OK')throw Error('TEST_COMPLAINT_REQUIRED');
 const decider=await createFixture(['auftraege','entscheiden']);
 const request={reklamationId:complaint.receipt.complaintId,version:1,bewertung:'berechtigt' as const,massnahme:'nacharbeit' as const,liefertermin:'2027-05-18'};
 const [before]=await sql`SELECT statement_timestamp() AS clock`;
 const result=await withSession(decider,()=>nacharbeitAnlegenAction(request));
 expect(result.code).toBe('OK');if(result.code!=='OK')throw Error('TEST_REWORK_REQUIRED');
 const read=()=>sql`SELECT ware_seit,terminstatus_seit,
  ware_seit BETWEEN ${before.clock}::timestamptz AND statement_timestamp() AS goods_clock,
  terminstatus_seit BETWEEN ${before.clock}::timestamptz AND statement_timestamp() AS term_clock
  FROM public.orders WHERE tenant_id=${scope.tenant} AND id=${result.receipt.orderId}`;
 const rows=await read();expect(rows[0]).toMatchObject({goods_clock:true,term_clock:true});
 expect(await withSession(decider,()=>nacharbeitAnlegenAction(JSON.parse(JSON.stringify(request))))).toMatchObject({code:'OK',replayed:true,receipt:{orderId:result.receipt.orderId}});
 expect(await read()).toEqual(rows);
 // Existing receiving/finish/informed/goods-out commands, now under the same
 // real Berlin DB session. No historical timestamps or business effects fake.
 const {getGoodsReceiptsAction,saveGoodsReceiptAction}=await import('@/app/actions/eingang.actions');
 const waiting=await withSession(full,()=>getGoodsReceiptsAction(result.receipt.orderId));
 expect(waiting.code).toBe('OK');if(waiting.code!=='OK')throw Error('TEST_REWORK_RECEIVING_SOURCE');
 const returnPhoto=await storeIntakeGoodsPhoto();
 expect(await withSession(full,()=>saveGoodsReceiptAction({id:randomUUID(),clientKey:randomUUID(),clientEventId:randomUUID(),itemId:returnPhoto.itemId,orderId:result.receipt.orderId,expectedOrderVersion:waiting.order.version,expectedVersion:0,mode:'erwartet',command:'galvanik',card:0,packagesReceived:1,packagesTotal:1,condition:'unauffaellig',deviations:[],foundUnattended:false,foundAt:null,procedure:null,procedureNote:null,photos:[{fileId:returnPhoto.fileId,kind:'teile'}],quantities:waiting.order.items.map(item=>({itemId:item.id,expected:item.quantity,received:null,confirmed:true,note:null}))}))).toMatchObject({code:'OK'});
 const {getLiveOrderCardAction,setOrderItemFinishedAction,freezeOrderAction,markOrderInformedByPhoneAction}=await import('@/app/actions/orders.actions');
 const active=await withSession(full,()=>getLiveOrderCardAction({orderId:result.receipt.orderId}));
 expect(active.code).toBe('OK');if(active.code!=='OK')throw Error('TEST_REWORK_ACTIVE_CARD');
 const finished=await withSession(full,()=>setOrderItemFinishedAction({orderId:result.receipt.orderId,itemId:waiting.order.items[0].id,expectedVersion:active.data.card.version,clientEventId:randomUUID(),finished:true}));
 expect(finished.code).toBe('OK');if(finished.code!=='OK')throw Error('TEST_REWORK_PART_FINISHED');
 await storeItemPhoto(result.receipt.orderId,waiting.order.items[0].id);
 const frozen=await withSession(full,()=>freezeOrderAction({orderId:result.receipt.orderId,freezeId:randomUUID(),expectedVersion:finished.receipt.aggregateVersion,clientEventId:randomUUID()}));
 expect(frozen.code).toBe('OK');if(frozen.code!=='OK')throw Error('TEST_REWORK_FROZEN');
 expect(await withSession(full,()=>markOrderInformedByPhoneAction({orderId:result.receipt.orderId,expectedVersion:frozen.receipt.aggregateVersion,clientEventId:randomUUID()}))).toMatchObject({code:'OK'});
 const {recordGoodsOutAction}=await import('@/app/actions/goodsOut.actions');
 const requestOut={orderId:result.receipt.orderId,expectedVersion:frozen.receipt.aggregateVersion,mode:'abholung' as const,clientEventId:randomUUID()};
 const [beforeOut]=await sql`SELECT statement_timestamp() AS clock`;
 const out=await withSession(full,()=>recordGoodsOutAction(requestOut));
 expect(out.code).toBe('OK');if(out.code!=='OK')throw Error('TEST_REWORK_ACTUAL_GOODS_OUT');
 const closure=()=>sql`SELECT stand,abgeschlossen_am,abgeschlossen_von::text,
  abgeschlossen_am BETWEEN ${beforeOut.clock}::timestamptz AND statement_timestamp() AS clock_proof
  FROM public.complaints WHERE tenant_id=${scope.tenant} AND id=${complaint.receipt.complaintId}`;
 const closed=await closure();expect(closed).toMatchObject([{stand:'abgeschlossen',abgeschlossen_von:full.actorId,clock_proof:true}]);
 const retryOut=await withSession(full,()=>recordGoodsOutAction(JSON.parse(JSON.stringify(requestOut))));
 expect(retryOut).toMatchObject({code:'OK',replayed:true,receipt:{eventId:out.receipt.eventId}});
 expect(await closure()).toEqual(closed);
 expect(await withSession(full,()=>getByOrder(order.orderId))).toMatchObject({code:'OK',complaints:[{id:complaint.receipt.complaintId,stand:'abgeschlossen'}]});
});
