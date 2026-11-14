// @vitest-environment node
// S09 PL13Nov22:20: explicit quote fact, real existing writer/receipt/Auth/DB.
import {randomUUID} from 'node:crypto';
import {writeFileSync} from 'node:fs';
import {beforeAll,expect,it,vi} from 'vitest';
const tenant=vi.hoisted(()=>'TEST-ablauf-'+globalThis.crypto.randomUUID());
vi.mock('@/lib/tenant',()=>({KREILE_TENANT_SLUG:tenant}));
import {KREILE_TENANT_SLUG} from '@/lib/tenant';
import {sql,full,withSession,createFixture} from '../../../e2e/ablauf/replayHarness';
import {customerFixture,readyOrderForInvoice} from '../../../e2e/ablauf/orderFixture';
import {storeIntakeGoodsPhoto,storeItemPhoto} from '../../../e2e/ablauf/photoFixture';
import {createQuoteAction,updateQuoteAction,readQuoteAction,changeQuoteLifecycleAction,convertQuoteToOrderAction,readQuotePdfAction} from '@/app/actions/quotes.actions';
import {getIntakeCaptureAction} from '@/app/actions/eingang.actions';
import {transitionWareneingangToGalvanikAction,setOrderItemFinishedAction,freezeOrderAction,saveManualTrackingAction,getLiveOrderCardAction} from '@/app/actions/orders.actions';
import {issueInvoiceAction} from '@/app/actions/invoices.actions';
beforeAll(()=>{const u=process.env.DATABASE_URL;if(!u||u!==process.env.H18_EXPECTED_DATABASE_URL||new URL(u).hostname!=='127.0.0.1')throw Error('TEST_S09_LOOPBACK_REQUIRED');});
const position=(name:string)=>({name:'TEST '+name,quantity:1,material:'Messing',surfaceRequested:'verchromen',unit:'stueck',plannedMinutes:30,unitPriceCents:10000,lineTotalCents:10000});

it('A09-3 explicit true is persisted and actor-bound; missing means stored false even when the name says Versand enthalten',async()=>{
 const customerId=await customerFixture('S09 KV explicit shipping');
 const request={clientEventId:randomUUID(),customerId,dueDate:'2027-05-15',note:'TEST S09 explicit shipping',positions:[position('S09 part')],shippingIncluded:true};
 const denied=await createFixture([],'werkstatt');expect(await withSession(denied,()=>createQuoteAction(request))).toMatchObject({code:'FORBIDDEN'});
 const created=await withSession(full,()=>createQuoteAction(request));expect(created).toMatchObject({code:'OK',quote:{shippingIncluded:true}});if(created.code!=='OK')throw Error('TEST_KV_SHIPPING_CREATE');
 expect(await withSession(full,()=>createQuoteAction(JSON.parse(JSON.stringify(request))))).toMatchObject({code:'OK',replayed:true,receipt:created.receipt,quote:{shippingIncluded:true}});
 expect(await withSession(full,()=>createQuoteAction({...request,shippingIncluded:false}))).toMatchObject({code:'CONFLICT'});
 expect(await withSession(full,()=>readQuoteAction({quoteId:created.quote.quoteId}))).toMatchObject({code:'OK',quote:{shippingIncluded:true}});
 expect(await sql`SELECT user_id::text,payload FROM public.events WHERE tenant_id=${KREILE_TENANT_SLUG} AND event_type='QUOTE_SHIPPING_INCLUDED_SET_V1' AND correlation_id=${request.clientEventId}::uuid`).toEqual([{user_id:full.actorId,payload:expect.objectContaining({quoteId:created.quote.quoteId,before:false,after:true,edition:1,version:1,requestKey:request.clientEventId})}]);
 expect(await withSession(full,()=>createQuoteAction({...request,clientEventId:randomUUID(),positions:[position('Versand enthalten nur im Namen')],shippingIncluded:undefined}))).toMatchObject({code:'VALIDATION_ERROR'});
 const {shippingIncluded,...withoutFlag}=request;expect(shippingIncluded).toBe(true);
 expect(await withSession(full,()=>createQuoteAction({...withoutFlag,clientEventId:randomUUID(),positions:[position('Versand enthalten nur im Namen')]}))).toMatchObject({code:'OK',quote:{shippingIncluded:false}});
});

it('A09-3 changing the included fact after actual acceptance creates a new edition; omitted later input preserves it',async()=>{
 const customerId=await customerFixture('S09 KV edition shipping'),part=position('S09 edition part'),note='TEST S09 edition';
 const created=await withSession(full,()=>createQuoteAction({clientEventId:randomUUID(),customerId,dueDate:'2027-05-15',note,positions:[part]}));if(created.code!=='OK')throw Error('TEST_KV_EDITION_CREATE');const quoteId=created.quote.quoteId;
 expect(await withSession(full,()=>changeQuoteLifecycleAction({quoteId,expectedVersion:1,edition:1,action:'sent',channel:'druck',evidence:'TEST actual onsite delivery',clientEventId:randomUUID()}))).toMatchObject({code:'OK'});
 expect(await withSession(full,()=>changeQuoteLifecycleAction({quoteId,expectedVersion:2,edition:1,action:'accept',evidence:'TEST actual customer acceptance',clientEventId:randomUUID()}))).toMatchObject({code:'OK'});
 const request={quoteId,expectedVersion:3,clientEventId:randomUUID(),dueDate:'2027-05-15',note,positions:[part],shippingIncluded:true};
 const changed=await withSession(full,()=>updateQuoteAction(request));expect(changed).toMatchObject({code:'OK',quote:{shippingIncluded:true,version:4,lifecycle:{edition:2,acceptedEdition:1}}});if(changed.code!=='OK')throw Error('TEST_KV_SHIPPING_UPDATE');
 expect(await withSession(full,()=>updateQuoteAction(JSON.parse(JSON.stringify(request))))).toMatchObject({code:'OK',replayed:true,receipt:changed.receipt,quote:{shippingIncluded:true,lifecycle:{edition:2,acceptedEdition:1}}});
 expect(await withSession(full,()=>updateQuoteAction({...request,clientEventId:randomUUID(),shippingIncluded:false}))).toMatchObject({code:'CONFLICT'});
 const {shippingIncluded,...withoutFlag}=request;expect(shippingIncluded).toBe(true);
 expect(await withSession(full,()=>updateQuoteAction({...withoutFlag,expectedVersion:4,clientEventId:randomUUID()}))).toMatchObject({code:'OK',quote:{shippingIncluded:true,version:5,lifecycle:{edition:2,acceptedEdition:1}}});
 expect(await sql`SELECT payload FROM public.events WHERE tenant_id=${KREILE_TENANT_SLUG} AND event_type='QUOTE_SHIPPING_INCLUDED_SET_V1' AND correlation_id=${request.clientEventId}::uuid`).toEqual([{payload:expect.objectContaining({before:false,after:true,beforeEdition:1,edition:2,version:4})}]);
});

it('A09-3 missing actual shipping audit rolls the KV back; fresh retry creates one immutable original',async()=>{
 const customerId=await customerFixture('S09 KV shipping rollback'),request={clientEventId:randomUUID(),customerId,dueDate:'2027-05-15',note:'TEST S09 rollback',positions:[position('S09 rollback part')],shippingIncluded:true};
 const fault='test_s09_kv_'+randomUUID().replaceAll('-','');if(!/^[A-Za-z0-9-]+$/.test(KREILE_TENANT_SLUG))throw Error('TEST_TENANT_LITERAL_INVALID');
 await sql.unsafe(`CREATE FUNCTION private.${fault}() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.tenant_id='${KREILE_TENANT_SLUG}' AND NEW.correlation_id='${request.clientEventId}'::uuid AND NEW.event_type='QUOTE_SHIPPING_INCLUDED_SET_V1' THEN RETURN NULL; END IF; RETURN NEW; END $$`);
 await sql.unsafe(`CREATE TRIGGER ${fault} BEFORE INSERT ON public.events FOR EACH ROW EXECUTE FUNCTION private.${fault}()`);
 try{
  expect(await withSession(full,()=>createQuoteAction(request))).toMatchObject({code:'UNAVAILABLE'});
  expect(await sql`SELECT count(*)::int AS n FROM private.quotes WHERE tenant_id=${KREILE_TENANT_SLUG} AND customer_id=${customerId}`).toEqual([{n:0}]);
 }finally{await sql.unsafe(`DROP TRIGGER ${fault} ON public.events`);await sql.unsafe(`DROP FUNCTION private.${fault}()`);}
 const created=await withSession(full,()=>createQuoteAction(JSON.parse(JSON.stringify(request))));expect(created).toMatchObject({code:'OK',replayed:false,quote:{shippingIncluded:true}});
 expect(await withSession(full,()=>createQuoteAction(JSON.parse(JSON.stringify(request))))).toMatchObject({code:'OK',replayed:true});
 const events=await sql`SELECT id FROM public.events WHERE tenant_id=${KREILE_TENANT_SLUG} AND event_type='QUOTE_SHIPPING_INCLUDED_SET_V1' AND correlation_id=${request.clientEventId}::uuid`;expect(events).toHaveLength(1);
 await expect(sql.begin(tx=>tx`UPDATE public.events SET description='TEST forbidden mutation' WHERE tenant_id=${KREILE_TENANT_SLUG} AND id=${events[0].id}`)).rejects.toThrow();
 await expect(sql.begin(tx=>tx`DELETE FROM public.events WHERE tenant_id=${KREILE_TENANT_SLUG} AND id=${events[0].id}`)).rejects.toThrow();
});

it.each([false,true])('A09-3 actual awarded KV shippingIncluded=%s governs the whole shipment group, never the position name',async shippingIncluded=>{
 const customerId=await customerFixture('S09 KV actual invoice '+shippingIncluded),other=await readyOrderForInvoice('S09 KV group ordinary '+shippingIncluded,'shipping',customerId);
 const part=position('Versand enthalten Namensfalle '+shippingIncluded);
 const created=await withSession(full,()=>createQuoteAction({clientEventId:randomUUID(),customerId,dueDate:'2027-05-15',note:'TEST S09 actual accepted shipping '+shippingIncluded,positions:[part],shippingIncluded}));if(created.code!=='OK')throw Error('TEST_KV_GROUP_CREATE');
 const quoteId=created.quote.quoteId;
 const pdf=await withSession(full,()=>readQuotePdfAction({quoteId}));expect(pdf).toMatchObject({code:'OK'});if(pdf.code!=='OK')throw Error('TEST_ACTUAL_KV_PDF');expect(pdf.pdf.subarray(0,5).toString()).toBe('%PDF-');if(shippingIncluded)writeFileSync('.git/kreile-s09-kv-shipping-included.pdf',pdf.pdf);
 expect(await withSession(full,()=>changeQuoteLifecycleAction({quoteId,expectedVersion:1,edition:1,action:'sent',channel:'druck',evidence:'TEST S09 onsite original supplied',clientEventId:randomUUID()}))).toMatchObject({code:'OK'});
 expect(await withSession(full,()=>changeQuoteLifecycleAction({quoteId,expectedVersion:2,edition:1,action:'accept',evidence:'TEST S09 original customer acceptance',clientEventId:randomUUID()}))).toMatchObject({code:'OK'});
 const source=await withSession(full,()=>readQuoteAction({quoteId}));if(source.code!=='OK')throw Error('TEST_KV_GROUP_SOURCE');
 const overview=await storeIntakeGoodsPhoto(),parts=await storeIntakeGoodsPhoto(overview.itemId),capture=await withSession(full,()=>getIntakeCaptureAction(overview.itemId));if(capture.code!=='OK')throw Error('TEST_KV_GROUP_CAPTURE');
 const goods={id:randomUUID(),clientKey:randomUUID(),clientEventId:randomUUID(),itemId:overview.itemId,quoteId,expectedQuoteVersion:source.quote.version,sourceVersion:capture.capture.version,expectedVersion:0,mode:'erfassung' as const,command:'accept' as const,card:1,packagesReceived:1,packagesTotal:1,condition:'unauffaellig' as const,deviations:[],foundUnattended:false,foundAt:null,procedure:'stimmt' as const,procedureNote:null,photos:[{fileId:overview.fileId,kind:'uebersicht' as const},{fileId:parts.fileId,kind:'teile' as const}],quantities:source.quote.positions.map(row=>({itemId:row.id,expected:row.quantity,received:null,confirmed:true,note:null})),location:'TEST S09 quote shipping shelf'};
 const converted=await withSession(full,()=>convertQuoteToOrderAction({quoteId,clientEventId:randomUUID(),expectedVersion:source.quote.version,confirmedAward:true,confirmedOrderDueDate:source.quote.dueDate,handoverMode:'shipping',paymentMode:'rechnung',goodsReceiptId:goods.id},goods));expect(converted).toMatchObject({code:'OK'});if(converted.code!=='OK')throw Error('TEST_KV_GROUP_CONVERSION');
 const orderId=converted.orderReceipt.orderId,live=await withSession(full,()=>getLiveOrderCardAction({orderId}));if(live.code!=='OK')throw Error('TEST_KV_GROUP_LIVE_VERSION');
 const moved=await withSession(full,()=>transitionWareneingangToGalvanikAction({orderId,expectedVersion:live.data.card.version,clientEventId:randomUUID()}));expect(moved).toMatchObject({code:'OK'});if(moved.code!=='OK')throw Error('TEST_KV_GROUP_PRODUCTION');
 let version=moved.receipt.aggregateVersion;
 const items=await sql`SELECT id FROM public.items WHERE tenant_id=${KREILE_TENANT_SLUG} AND order_id=${orderId} ORDER BY id`;
 for(const item of items){await storeItemPhoto(orderId,item.id);const finished=await withSession(full,()=>setOrderItemFinishedAction({orderId,itemId:item.id,expectedVersion:version,finished:true,clientEventId:randomUUID()}));if(finished.code!=='OK')throw Error('TEST_KV_GROUP_PART');version=finished.receipt.aggregateVersion;}
 const frozen=await withSession(full,()=>freezeOrderAction({orderId,freezeId:randomUUID(),expectedVersion:version,clientEventId:randomUUID()}));expect(frozen).toMatchObject({code:'OK'});if(frozen.code!=='OK')throw Error('TEST_KV_GROUP_FREEZE');
 expect(await withSession(full,()=>getLiveOrderCardAction({orderId}))).toMatchObject({code:'OK',data:{card:{commercialQuote:{shippingIncluded}}}});
 expect(await withSession(full,()=>saveManualTrackingAction({orderId:other.orderId,shipmentId:randomUUID(),expectedUpdatedAt:null,trackingNumber:shippingIncluded?'96345678901234':'95345678901234',allowFormatMismatch:false,reason:null,clientEventId:randomUUID(),withOrder:{orderId,shipmentId:null,expectedUpdatedAt:null}}))).toMatchObject({code:'OK'});
 const requests=[{orderId,expectedVersion:frozen.receipt.aggregateVersion,clientEventId:randomUUID()},{orderId:other.orderId,expectedVersion:other.version,clientEventId:randomUUID()}];
 const issued=await Promise.all(requests.map(request=>withSession(full,()=>issueInvoiceAction(request))));expect(issued.map(result=>result.code)).toEqual(['OK','OK']);
 const originals=await sql`SELECT snapshot FROM public.invoices WHERE tenant_id=${KREILE_TENANT_SLUG} AND order_id IN (${orderId},${other.orderId})`;
 expect(originals).toHaveLength(2);const lines=originals.flatMap(row=>row.snapshot.lines).filter((line:{type:string})=>line.type==='SHIPPING');
 if(shippingIncluded)expect(lines).toEqual([]);else expect(lines.reduce((sum:number,line:{amountCents:number})=>sum+line.amountCents,0)).toBe(1000);
 for(const [index,request] of requests.entries()){const result=issued[index];if(result.code!=='OK')throw Error('TEST_KV_GROUP_INVOICE');expect(await withSession(full,()=>issueInvoiceAction(JSON.parse(JSON.stringify(request))))).toEqual({...result,replayed:true});}
});
