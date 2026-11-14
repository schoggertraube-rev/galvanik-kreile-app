// TEST-only scenario: real existing quote/photo/goods/order Actions, Auth, DB and Storage.
import {randomUUID} from 'node:crypto';
import {expect} from 'vitest';
import {KREILE_TENANT_SLUG} from '@/lib/tenant';
import {sql,full,withSession,createFixture} from './replayHarness';
import {customerFixture} from './orderFixture';
import {storeIntakeGoodsPhoto} from './photoFixture';

export type QuoteQuantityCase={name:string;quantity:number;received:number;total:number;expected:number;hours:string|null;operational:boolean;fixed:number;blocked?:boolean;inspect?:(source:{orderId:string;quoteId:string;actor:typeof full})=>Promise<void>};
export async function runQuoteQuantityCase(scenario:QuoteQuantityCase){
 const actor=scenario.operational?await createFixture(['eingang','auftraege'],'werkstatt'):full;
 const customerId=await customerFixture('S07 '+scenario.name);
 await sql`INSERT INTO public.company_settings(id,tenant_id,company_name,invoice_vat_rate_basis_points) SELECT ${randomUUID()},${KREILE_TENANT_SLUG},'TEST S07 quantities',1900 WHERE NOT EXISTS(SELECT 1 FROM public.company_settings WHERE tenant_id=${KREILE_TENANT_SLUG})`;
 const {createQuoteAction,updateQuoteAction,changeQuoteLifecycleAction,readQuoteAction,convertQuoteToOrderAction}=await import('@/app/actions/quotes.actions');
 const position={name:'TEST S07 F2 '+scenario.name,quantity:scenario.quantity,material:'Messing',surfaceRequested:'verchromen',unitPriceCents:Math.round(scenario.total/scenario.quantity),lineTotalCents:scenario.total,unit:'stueck',plannedMinutes:scenario.hours===null?null:30};
 const calculation=scenario.hours===null?undefined:{hours:'0.5000',hourlyRateCents:scenario.fixed?6000:8000,setupCents:scenario.fixed,materialCents:scenario.fixed};
 // Explicit isolated settings boundary: the real KV writer captures each edition's rate.
 await sql`UPDATE public.company_settings SET invoice_vat_rate_basis_points=700 WHERE tenant_id=${KREILE_TENANT_SLUG}`;
 const created=await withSession(full,()=>createQuoteAction({clientEventId:randomUUID(),customerId,dueDate:'2027-05-15',note:'TEST S07 accepted F2',positions:[{...position,name:position.name+' old F1',unitPriceCents:1,lineTotalCents:scenario.quantity,unit:'kg',plannedMinutes:3}]}));
 expect(created,JSON.stringify(created)).toMatchObject({code:'OK'});if(created.code!=='OK')throw Error('TEST_S07_QUANTITY_CREATE');
 const quoteId=created.quote.quoteId;
 expect(created).toMatchObject({quote:{positions:[{unit:'kg',plannedMinutes:3,vatRateBasisPoints:700}]}});
 expect(await withSession(full,()=>changeQuoteLifecycleAction({quoteId,expectedVersion:1,edition:1,action:'sent',channel:'druck',evidence:'TEST S07 F1 original handed over',clientEventId:randomUUID()}))).toMatchObject({code:'OK'});
 await sql`UPDATE public.company_settings SET invoice_vat_rate_basis_points=1900 WHERE tenant_id=${KREILE_TENANT_SLUG}`;
 expect(await withSession(full,()=>updateQuoteAction({quoteId,expectedVersion:2,clientEventId:randomUUID(),dueDate:'2027-05-15',note:'TEST S07 accepted F2',positions:[position],...(calculation?{calculation}:{})}))).toMatchObject({code:'OK',quote:{version:3,lifecycle:{edition:2}}});
 expect(await withSession(full,()=>changeQuoteLifecycleAction({quoteId,expectedVersion:3,edition:2,action:'sent',channel:'druck',evidence:'TEST S07 F2 original handed over',clientEventId:randomUUID()}))).toMatchObject({code:'OK'});
 expect(await withSession(full,()=>changeQuoteLifecycleAction({quoteId,expectedVersion:4,edition:2,action:'accept',evidence:'TEST S07 accepted F2',clientEventId:randomUUID()}))).toMatchObject({code:'OK'});
 const source=await withSession(full,()=>readQuoteAction({quoteId}));if(source.code!=='OK')throw Error('TEST_S07_QUANTITY_SOURCE');
 expect(source).toMatchObject({quote:{lifecycle:{edition:2,acceptedEdition:2},totalNetCents:scenario.total,positions:[{unit:'stueck',vatRateBasisPoints:1900}]}});
 const overview=await storeIntakeGoodsPhoto(undefined,actor),parts=await storeIntakeGoodsPhoto(overview.itemId,actor);
 const {getIntakeCaptureAction}=await import('@/app/actions/eingang.actions');
 const capture=await withSession(actor,()=>getIntakeCaptureAction(overview.itemId));if(capture.code!=='OK')throw Error('TEST_S07_QUANTITY_CAPTURE');
 const damage=scenario.blocked?await storeIntakeGoodsPhoto(overview.itemId,actor):null;
 const goods={id:randomUUID(),clientKey:randomUUID(),clientEventId:randomUUID(),itemId:overview.itemId,quoteId,expectedQuoteVersion:source.quote.version,sourceVersion:capture.capture.version,expectedVersion:0,mode:'erfassung' as const,command:'accept' as const,card:1,packagesReceived:1,packagesTotal:1,condition:scenario.blocked?'abweichung' as const:'unauffaellig' as const,deviations:scenario.blocked?['beschädigt']:[],foundUnattended:false,foundAt:null,procedure:'stimmt' as const,procedureNote:null,photos:[{fileId:overview.fileId,kind:'uebersicht' as const},{fileId:parts.fileId,kind:'teile' as const},...(damage?[{fileId:damage.fileId,kind:'abweichung' as const}]:[])],quantities:source.quote.positions.map(row=>({itemId:row.id,expected:row.quantity,received:scenario.received===row.quantity?null:scenario.received,confirmed:scenario.received===row.quantity,note:scenario.received===row.quantity?null:'TEST actually received quantity'})),location:'TEST S07 quantities shelf'};
 const award={quoteId,clientEventId:randomUUID(),expectedVersion:source.quote.version,confirmedAward:true as const,confirmedOrderDueDate:source.quote.dueDate,handoverMode:'pickup' as const,paymentMode:'rechnung' as const,goodsReceiptId:goods.id};
 const result=await withSession(actor,()=>convertQuoteToOrderAction(award,goods));
 if(scenario.blocked){
  const {QUOTE_CYCLE_COPY}=await import('@/ui/situationCatalog');
  expect(result).toMatchObject({code:'VALIDATION_ERROR',message:QUOTE_CYCLE_COPY.retainedGoodsBlocked('beschädigt')});
  expect(await withSession(actor,()=>convertQuoteToOrderAction(JSON.parse(JSON.stringify(award)),JSON.parse(JSON.stringify(goods))))).toMatchObject({code:'VALIDATION_ERROR',message:QUOTE_CYCLE_COPY.retainedGoodsBlocked('beschädigt')});
  const stored=await sql.begin(async tx=>{await tx`SELECT set_config('app.tenant_id',${KREILE_TENANT_SLUG},true)`;return tx`SELECT id::text,gesperrt,lagerort FROM public.v_quote_goods_receipt_v1 WHERE tenant_id=${KREILE_TENANT_SLUG} AND kv_id=${quoteId}::uuid`;});
  expect(stored).toEqual([{id:goods.id,gesperrt:true,lagerort:goods.location}]);
  expect(await sql`SELECT count(*)::int AS n FROM public.orders WHERE tenant_id=${KREILE_TENANT_SLUG} AND customer_id=${customerId}`).toEqual([{n:0}]);
  return;
 }
 expect(result,JSON.stringify(result)).toMatchObject({code:'OK'});if(result.code!=='OK')throw Error('TEST_S07_QUANTITY_ORDER');
 const orderId=result.orderReceipt.orderId;
 expect(result.orderReceipt.items).toHaveLength(1);
 expect(result.orderReceipt.items[0].quantity).toBe(scenario.received);
 if(scenario.operational){
  expect(result.orderReceipt.items[0]).toMatchObject({unitPriceCents:null,vatRateBasisPoints:null});
  expect(result.quote).toMatchObject({totalNetCents:null,positions:[{unitPriceCents:null,lineTotalCents:null,vatRateBasisPoints:null}]});
 }
 const {getLiveOrderCardAction}=await import('@/app/actions/orders.actions');
 const reread=await withSession(full,()=>getLiveOrderCardAction({orderId}));
 expect(reread,JSON.stringify(reread)).toMatchObject({code:'OK',data:{card:{operationalFacts:{pricesMissing:false},items:[{quantity:scenario.received,unit:'Stück'}],commercialQuote:{quoteId,edition:2,totalNetCents:scenario.expected,plannedHours:scenario.hours,vatRateBasisPoints:1900,positions:[{quantity:scenario.received,lineTotalCents:scenario.expected,unit:'stueck',vatRateBasisPoints:1900}]}}}});
 if(scenario.name==='A07-1 full F2')expect(reread).toMatchObject({data:{card:{commercialQuote:{positions:[{plannedMinutes:30}]}}}});
 if(scenario.operational){
  const operational=await withSession(actor,()=>getLiveOrderCardAction({orderId}));
  expect(operational).toMatchObject({code:'OK',data:{card:{operationalFacts:{pricesMissing:false},items:[{quantity:scenario.received,unit:'Stück',unitPriceCents:null,vatRateBasisPoints:null}]}}});
  if(operational.code==='OK')expect(operational.data.card.commercialQuote).toBeUndefined();
 }
 expect(await withSession(actor,()=>convertQuoteToOrderAction(JSON.parse(JSON.stringify(award)),JSON.parse(JSON.stringify(goods))))).toMatchObject({code:'OK',replayed:true,orderReceipt:{orderId}});
 expect(await sql`SELECT count(*)::integer AS n FROM public.orders WHERE tenant_id=${KREILE_TENANT_SLUG} AND customer_id=${customerId}`).toEqual([{n:1}]);
 expect(await sql`SELECT count(*)::integer AS n FROM public.goods_receipt WHERE tenant_id=${KREILE_TENANT_SLUG} AND kv_id=${quoteId}::uuid AND auftrag_id=${orderId}`).toEqual([{n:1}]);
 expect(await withSession(full,()=>readQuoteAction({quoteId}))).toMatchObject({code:'OK',quote:{totalNetCents:scenario.total,lifecycle:{acceptedEdition:2,...(calculation?{calculation}:{})}}});
 await scenario.inspect?.({orderId,quoteId,actor});
}
