// @vitest-environment node
// Real TEST quote lifecycle, photographed goods, Auth, DB, Storage and fresh retries.
import {randomUUID} from 'node:crypto';
import {expect,it,vi} from 'vitest';
const tenant=vi.hoisted(()=>'TEST-ablauf-'+globalThis.crypto.randomUUID());
vi.mock('@/lib/tenant',()=>({KREILE_TENANT_SLUG:tenant}));
import {KREILE_TENANT_SLUG} from '@/lib/tenant';
import {sql,full,withSession,withRequest,createFixture} from '../../../e2e/ablauf/replayHarness';
import {customerFixture} from '../../../e2e/ablauf/orderFixture';
import {storeIntakeGoodsPhoto} from '../../../e2e/ablauf/photoFixture';

it.each(['date','content','unaccepted','conditional'] as const)('S07 edition $0 keeps physical goods and applies only the actual current acceptance',async mode=>{
 const customerId=await customerFixture('S07 edition '+mode);
 const {createQuoteAction,updateQuoteAction,changeQuoteLifecycleAction,readQuoteAction,convertQuoteToOrderAction}=await import('@/app/actions/quotes.actions');
 const position={name:'TEST S07 '+mode+' accepted F2 part',quantity:10,material:'Messing',surfaceRequested:'verchromen',unit:'stueck',plannedMinutes:30,unitPriceCents:400,lineTotalCents:4000};
 const note='TEST S07 edition '+mode;
 const created=await withSession(full,()=>createQuoteAction({clientEventId:randomUUID(),customerId,dueDate:'2027-05-15',note,positions:[{...position,name:position.name+' F1',unitPriceCents:100,lineTotalCents:1000}]}));
 expect(created).toMatchObject({code:'OK'});if(created.code!=='OK')throw Error('TEST_S07_EDITION_CREATE');
 const quoteId=created.quote.quoteId;
 expect(await withSession(full,()=>changeQuoteLifecycleAction({quoteId,expectedVersion:1,edition:1,action:'sent',channel:'druck',evidence:'TEST S07 F1 delivered',clientEventId:randomUUID()}))).toMatchObject({code:'OK'});
 expect(await withSession(full,()=>updateQuoteAction({quoteId,expectedVersion:2,clientEventId:randomUUID(),dueDate:'2027-05-15',note,positions:[position]}))).toMatchObject({code:'OK',quote:{version:3,lifecycle:{edition:2}}});
 expect(await withSession(full,()=>changeQuoteLifecycleAction({quoteId,expectedVersion:3,edition:2,action:'sent',channel:'druck',evidence:'TEST S07 F2 delivered',clientEventId:randomUUID()}))).toMatchObject({code:'OK'});
 if(mode!=='unaccepted')expect(await withSession(full,()=>changeQuoteLifecycleAction({quoteId,expectedVersion:4,edition:2,action:mode==='conditional'?'conditional':'accept',evidence:'TEST S07 '+mode+' original customer statement',clientEventId:randomUUID()}))).toMatchObject({code:'OK'});
 if(mode==='date'||mode==='content'){
  const changed=await withSession(full,()=>updateQuoteAction({quoteId,expectedVersion:5,clientEventId:randomUUID(),dueDate:mode==='date'?'2027-05-20':'2027-05-15',note,positions:[mode==='content'?{...position,quantity:11,lineTotalCents:4400}:position]}));
  // Historical acceptance is retained; only equality with the current edition authorizes conversion.
  expect(changed).toMatchObject({code:'OK',quote:{version:6,lifecycle:{acceptedEdition:2,edition:mode==='date'?2:3}}});
 }
 const source=await withSession(full,()=>readQuoteAction({quoteId}));if(source.code!=='OK')throw Error('TEST_S07_EDITION_SOURCE');
 const overview=await storeIntakeGoodsPhoto(),parts=await storeIntakeGoodsPhoto(overview.itemId);
 const {getIntakeCaptureAction,saveGoodsReceiptAction}=await import('@/app/actions/eingang.actions');
 const capture=await withSession(full,()=>getIntakeCaptureAction(overview.itemId));if(capture.code!=='OK')throw Error('TEST_S07_EDITION_CAPTURE');
 const goods={id:randomUUID(),clientKey:randomUUID(),clientEventId:randomUUID(),itemId:overview.itemId,quoteId,expectedQuoteVersion:source.quote.version,sourceVersion:capture.capture.version,expectedVersion:0,mode:'erfassung' as const,command:'accept' as const,card:1,packagesReceived:1,packagesTotal:1,condition:'unauffaellig' as const,deviations:[],foundUnattended:false,foundAt:null,procedure:'stimmt' as const,procedureNote:null,photos:[{fileId:overview.fileId,kind:'uebersicht' as const},{fileId:parts.fileId,kind:'teile' as const}],quantities:source.quote.positions.map(row=>({itemId:row.id,expected:row.quantity,received:null,confirmed:true,note:null})),location:'TEST S07 edition shelf'};
 const award={quoteId,clientEventId:randomUUID(),expectedVersion:source.quote.version,confirmedAward:true as const,confirmedOrderDueDate:source.quote.dueDate,handoverMode:'pickup' as const,paymentMode:'rechnung' as const,goodsReceiptId:goods.id};
 if(mode==='date'){
  const converted=await withSession(full,()=>convertQuoteToOrderAction(award,goods));
  expect(converted,JSON.stringify(converted)).toMatchObject({code:'OK'});if(converted.code!=='OK')throw Error('TEST_S07_EDITION_ORDER');
  const orderId=converted.orderReceipt.orderId;
  const {getLiveOrderCardAction}=await import('@/app/actions/orders.actions');
  expect(await withSession(full,()=>getLiveOrderCardAction({orderId}))).toMatchObject({code:'OK',data:{card:{dueAt:'2027-05-20T00:00:00.000Z',commercialQuote:{edition:2,totalNetCents:4000,positions:[{quantity:10,lineTotalCents:4000}]}}}});
  expect(await withSession(full,()=>convertQuoteToOrderAction(JSON.parse(JSON.stringify(award)),JSON.parse(JSON.stringify(goods))))).toMatchObject({code:'OK',replayed:true,orderReceipt:{orderId}});
  expect(await sql`SELECT count(*)::integer AS n FROM public.orders WHERE tenant_id=${KREILE_TENANT_SLUG} AND customer_id=${customerId}`).toEqual([{n:1}]);
 }else{
  expect(await withSession(full,()=>saveGoodsReceiptAction(goods))).toMatchObject({code:'OK',receipt:{id:goods.id,auftrag_id:null,gesperrt:true}});
  expect(await withSession(full,()=>saveGoodsReceiptAction(JSON.parse(JSON.stringify(goods))))).toMatchObject({code:'OK',replayed:true});
  expect(await withSession(full,()=>convertQuoteToOrderAction(award))).toMatchObject({code:'VALIDATION_ERROR'});
  expect(await withSession(full,()=>readQuoteAction({quoteId}))).toMatchObject({code:'OK',quote:{linkedOrderId:null,lifecycle:{acceptedEdition:mode==='content'?2:null,edition:mode==='content'?3:2,goods:[{id:goods.id,blocked:true,location:goods.location,orderId:null}]}}});
  expect(await sql`SELECT count(*)::integer AS n FROM public.orders WHERE tenant_id=${KREILE_TENANT_SLUG} AND customer_id=${customerId}`).toEqual([{n:0}]);
 }
 expect(await sql`SELECT count(*)::integer AS n FROM public.goods_receipt WHERE tenant_id=${KREILE_TENANT_SLUG} AND kv_id=${quoteId}::uuid`).toEqual([{n:1}]);
});

it('S07 two sessions reject a stale proposal and unauthorized goods writes, then recover from a fresh quote',async()=>{
 const customerId=await customerFixture('S07 stale proposal');
 const other=await createFixture(['eingang','mails','kunden','auftraege','geld']);
 const noIntake=await createFixture(['kunden'],'werkstatt');
 const {createQuoteAction,updateQuoteAction,changeQuoteLifecycleAction,readQuoteAction,convertQuoteToOrderAction}=await import('@/app/actions/quotes.actions');
 const position={name:'TEST S07 parallel part',quantity:2,material:'Messing',surfaceRequested:'verchromen',unitPriceCents:1000,lineTotalCents:2000,unit:'stueck'};
 const note='TEST S07 stale proposal';
 const created=await withSession(full,()=>createQuoteAction({clientEventId:randomUUID(),customerId,dueDate:'2027-05-15',note,positions:[position]}));
 if(created.code!=='OK')throw Error('TEST_S07_PARALLEL_CREATE');
 const quoteId=created.quote.quoteId;
 expect(await withSession(full,()=>changeQuoteLifecycleAction({quoteId,expectedVersion:1,edition:1,action:'sent',channel:'druck',evidence:'TEST S07 delivered',clientEventId:randomUUID()}))).toMatchObject({code:'OK'});
 expect(await withSession(full,()=>changeQuoteLifecycleAction({quoteId,expectedVersion:2,edition:1,action:'accept',evidence:'TEST S07 accepted',clientEventId:randomUUID()}))).toMatchObject({code:'OK'});
 const source=await withSession(full,()=>readQuoteAction({quoteId}));if(source.code!=='OK')throw Error('TEST_S07_PARALLEL_SOURCE');
 const overview=await storeIntakeGoodsPhoto(),parts=await storeIntakeGoodsPhoto(overview.itemId);
 const {getIntakeCaptureAction,saveGoodsReceiptAction}=await import('@/app/actions/eingang.actions');
 const capture=await withSession(full,()=>getIntakeCaptureAction(overview.itemId));if(capture.code!=='OK')throw Error('TEST_S07_PARALLEL_CAPTURE');
 const goods={id:randomUUID(),clientKey:randomUUID(),clientEventId:randomUUID(),itemId:overview.itemId,quoteId,expectedQuoteVersion:source.quote.version,sourceVersion:capture.capture.version,expectedVersion:0,mode:'erfassung' as const,command:'accept' as const,card:1,packagesReceived:1,packagesTotal:1,condition:'unauffaellig' as const,deviations:[],foundUnattended:false,foundAt:null,procedure:'stimmt' as const,procedureNote:null,photos:[{fileId:overview.fileId,kind:'uebersicht' as const},{fileId:parts.fileId,kind:'teile' as const}],quantities:source.quote.positions.map(row=>({itemId:row.id,expected:row.quantity,received:null,confirmed:true,note:null})),location:'TEST S07 parallel shelf'};
 const award={quoteId,clientEventId:randomUUID(),expectedVersion:source.quote.version,confirmedAward:true as const,confirmedOrderDueDate:source.quote.dueDate,handoverMode:'pickup' as const,paymentMode:'rechnung' as const,goodsReceiptId:goods.id};
 expect(await withRequest('',()=>convertQuoteToOrderAction(award,goods))).toMatchObject({code:'UNAUTHENTICATED'});
 expect(await withSession(noIntake,()=>saveGoodsReceiptAction(goods))).toMatchObject({code:'FORBIDDEN'});
 expect(await withSession(other,()=>updateQuoteAction({quoteId,expectedVersion:source.quote.version,clientEventId:randomUUID(),dueDate:'2027-05-20',note,positions:[position]}))).toMatchObject({code:'OK'});
 expect(await withSession(full,()=>convertQuoteToOrderAction(award,goods))).toMatchObject({code:'CONFLICT'});
 expect(await sql`SELECT count(*)::integer AS n FROM public.goods_receipt WHERE tenant_id=${KREILE_TENANT_SLUG} AND kv_id=${quoteId}::uuid`).toEqual([{n:0}]);
 expect(await sql`SELECT count(*)::integer AS n FROM public.orders WHERE tenant_id=${KREILE_TENANT_SLUG} AND customer_id=${customerId}`).toEqual([{n:0}]);
 const current=await withSession(full,()=>readQuoteAction({quoteId}));if(current.code!=='OK')throw Error('TEST_S07_PARALLEL_CURRENT');
 const freshAward={...award,expectedVersion:current.quote.version,confirmedOrderDueDate:current.quote.dueDate};
 const freshGoods={...goods,expectedQuoteVersion:current.quote.version,quantities:current.quote.positions.map(row=>({itemId:row.id,expected:row.quantity,received:null,confirmed:true,note:null}))};
 const converted=await withSession(full,()=>convertQuoteToOrderAction(freshAward,freshGoods));
 expect(converted,JSON.stringify(converted)).toMatchObject({code:'OK'});if(converted.code!=='OK')throw Error('TEST_S07_PARALLEL_RECOVERY');
 expect(await withSession(full,()=>convertQuoteToOrderAction(JSON.parse(JSON.stringify(freshAward)),JSON.parse(JSON.stringify(freshGoods))))).toMatchObject({code:'OK',replayed:true,orderReceipt:{orderId:converted.orderReceipt.orderId}});
 expect(await sql`SELECT count(*)::integer AS n FROM public.goods_receipt WHERE tenant_id=${KREILE_TENANT_SLUG} AND kv_id=${quoteId}::uuid`).toEqual([{n:1}]);
 expect(await sql`SELECT count(*)::integer AS n FROM public.orders WHERE tenant_id=${KREILE_TENANT_SLUG} AND customer_id=${customerId}`).toEqual([{n:1}]);
});
