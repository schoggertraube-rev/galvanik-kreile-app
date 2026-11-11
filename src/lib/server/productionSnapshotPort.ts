import 'server-only';
import {sql} from 'drizzle-orm';
import {createHash} from 'node:crypto';
import {PRODUCTION_PRICING_RETRY_COPY} from '@/ui/situationCatalog';
import type {PrivilegedTenantTransaction} from './privilegedDb';
import {readOrderCommercialQuote,type OrderCommercialQuote} from './orderQuoteReadPort';
import type {AuthorizationSnapshot} from './authorization';
import {withPrivilegedTenantTransaction,withTenantSavepoint} from './privilegedDb';
/** R2: real immutable receipt context survives rollback of the pricing savepoint.
 * The root completion composition binds it to the normal TaskWriter; missing
 * task evidence keeps the device original pending after the physical commit. */
export class ProductionPricingRetryNeeded extends Error {
 constructor(readonly source:{orderId:string;productionEventId:string;itemId:string;pricingEventId:string;pricingOccurredAt:string},cause:unknown){super('PRODUCTION_PRICING_RETRY_REQUIRED',{cause});this.name='ProductionPricingRetryNeeded';}
}
/** U264: all real logins may read the single aggregate, never position prices. */
export async function readProductionWeek(auth:AuthorizationSnapshot,onDate?:string){
 if(onDate!==undefined&&(!/^\d{4}-\d{2}-\d{2}$/.test(onDate)||!Number.isFinite(Date.parse(onDate))||new Date(onDate).toISOString().slice(0,10)!==onDate))return {code:'VALIDATION_ERROR' as const};
 try{return await withPrivilegedTenantTransaction(auth,async tx=>{
  const rows=await tx.execute<{week_start:string;week_end:string;net_cents:string;unpriced:number}>(sql`WITH bounds AS (SELECT date_trunc('week',coalesce(${onDate??null}::date,(statement_timestamp() AT TIME ZONE 'Europe/Berlin')::date))::date AS first)
   SELECT bounds.first::text AS week_start,(bounds.first+7)::text AS week_end,
    coalesce((SELECT sum(snapshot.direction*snapshot.net_cents) FROM private.order_production_snapshots snapshot WHERE snapshot.tenant_id=${auth.tenantId} AND snapshot.valuation='captured'
     AND (snapshot.occurred_at AT TIME ZONE 'UTC' AT TIME ZONE 'Europe/Berlin')>=bounds.first AND (snapshot.occurred_at AT TIME ZONE 'UTC' AT TIME ZONE 'Europe/Berlin')<bounds.first+7),0)::text AS net_cents,
    (SELECT count(*)::int FROM private.order_production_snapshots base WHERE base.tenant_id=${auth.tenantId} AND base.valuation='captured' AND base.component='base' AND base.direction=1 AND base.net_cents IS NULL
     AND NOT EXISTS(SELECT 1 FROM private.order_production_snapshots other WHERE other.item_id=base.item_id AND (other.reverses_event_id=base.event_id AND other.component='base' OR other.origin_event_id=base.event_id AND other.component='pricing'))) AS unpriced
 FROM bounds`);
  if(rows.length!==1||!Number.isSafeInteger(Number(rows[0].net_cents)))throw Error('PRODUCTION_WEEK_AMOUNT_INVALID');
  const row=rows[0];return {code:'OK' as const,data:{weekStart:row.week_start,weekEndExclusive:row.week_end,netCents:Number(row.net_cents),currentlyUnpricedItemCount:row.unpriced}};
 });}catch(error){console.error('[PRODUCTION_WEEK_READ_FAILED]',error instanceof Error?error.message:'UnknownError');return {code:'UNAVAILABLE' as const};}
}

/** Price evidence is read from the existing immutable business receipts, not
 * reconstructed from today's values. The historical unit feeds the same completion
 * amount calculation as online; quotes still use the canonical quote port. */
async function historicalProductionEvidence(tx:PrivilegedTenantTransaction,tenantId:string,orderId:string,itemId:string,at:string,quantity:string,quoted:boolean){
 const rows=await tx.execute<{quantity_id:string|null;price_id:string|null;quantity_matches:boolean;price_cents:string|null}>(sql`WITH quantities AS (
  SELECT event.id,event.created_at,item.value->>'quantity' AS quantity,item.value->>'unitPriceCents' AS cents
  FROM private.order_intake_receipts receipt JOIN public.events event ON event.id=receipt.event_id AND event.tenant_id=receipt.tenant_id AND event.order_id=receipt.order_id
  CROSS JOIN LATERAL jsonb_array_elements(receipt.items_snapshot) item(value)
  WHERE receipt.tenant_id=${tenantId} AND receipt.order_id=${orderId} AND event.status='success' AND event.event_type='ORDER_INTAKE_CREATED_V1' AND item.value->>'id'=${itemId}
  UNION ALL
  SELECT event.id,event.created_at,item.value->>'quantity',item.value->>'unitPriceCents' FROM public.events event CROSS JOIN LATERAL jsonb_array_elements(event.payload->'items') item(value)
  WHERE event.tenant_id=${tenantId} AND event.order_id=${orderId} AND event.status='success' AND event.event_type='ORDER_CONTENT_CHANGED_V1' AND item.value->>'id'=${itemId}
 ), prices AS (
  SELECT id,created_at,cents FROM quantities
  UNION ALL
  SELECT event.id,event.created_at,item.value->>'unitPriceCents' FROM public.events event CROSS JOIN LATERAL jsonb_array_elements(event.payload->'prices') item(value)
  WHERE event.tenant_id=${tenantId} AND event.order_id=${orderId} AND event.status='success' AND event.event_type='ORDER_INVOICE_PRICES_SET_V1' AND item.value->>'itemId'=${itemId}
 ), q AS (SELECT * FROM quantities WHERE created_at<=${at}::timestamptz AT TIME ZONE 'UTC' ORDER BY created_at DESC,id DESC LIMIT 1),
 p AS (SELECT * FROM prices WHERE created_at<=${at}::timestamptz AT TIME ZONE 'UTC' ORDER BY created_at DESC,id DESC LIMIT 1),
 award AS (SELECT event.id FROM private.quote_conversion_receipts receipt JOIN public.events event ON event.id=receipt.event_id AND event.tenant_id=receipt.tenant_id
  WHERE receipt.tenant_id=${tenantId} AND receipt.order_id=${orderId} AND event.status='success' AND event.created_at<=${at}::timestamptz AT TIME ZONE 'UTC' AND receipt.created_at<=${at}::timestamptz AT TIME ZONE 'UTC')
 SELECT (SELECT id FROM q) AS quantity_id,CASE WHEN ${quoted} THEN (SELECT id FROM award) ELSE (SELECT id FROM p) END AS price_id,
 coalesce((SELECT quantity::numeric=${quantity}::numeric FROM q),false) AS quantity_matches,
 (SELECT cents FROM p) AS price_cents`);
 if(rows.length!==1)throw Error('PRODUCTION_HISTORICAL_SOURCE_AMBIGUOUS');
 const row=rows[0];return row.quantity_matches&&(quoted||row.price_cents!==null)&&row.price_id&&row.quantity_id?{historicalPriceEventId:row.price_id,historicalQuantityEventId:row.quantity_id,unitPriceCents:row.price_cents}:null;
}

/** Capture the base position price at the existing completion edge. Extra work
 * belongs to its frozen receipt, never to the current hourly rate here. */
export async function appendProductionCompletion(tx:PrivilegedTenantTransaction,tenantId:string,orderId:string,eventId:string,itemIds:readonly string[]){
 if(!itemIds.length)return;
 const [occurrence]=await tx.execute<{offline:boolean;at:string}>(sql`SELECT event.payload ? 'offlineOriginal' AS offline,to_char(private.order_production_time_v1(event),'YYYY-MM-DD"T"HH24:MI:SS.US"Z"') AS at FROM public.events event WHERE event.tenant_id=${tenantId} AND event.order_id=${orderId} AND event.id=${eventId}`);
 if(!occurrence)throw Error('PRODUCTION_EVENT_SOURCE_MISSING');
 const origins=await tx.execute<{source:string|null;nacharbeit_zu:string|null;has_quote:boolean}>(sql`SELECT source,nacharbeit_zu,EXISTS(SELECT 1 FROM private.quote_conversion_receipts receipt WHERE receipt.tenant_id=orders.tenant_id AND receipt.order_id=orders.id) AS has_quote FROM public.orders WHERE tenant_id=${tenantId} AND id=${orderId}`);
 if(origins.length!==1)throw Error('PRODUCTION_ORDER_SOURCE_MISSING');
 const origin=origins[0],rework=origin.source==='REKLAMATION_NACHARBEIT';
 if(rework&&!origin.nacharbeit_zu)throw Error('PRODUCTION_REWORK_SOURCE_MISSING');
 const quote=!rework&&origin.has_quote?await readOrderCommercialQuote(tx,tenantId,orderId):null;
 const rows=await tx.execute<{id:string;quantity:string;unit:string|null;unit_cents:string|null;active:boolean}>(sql`SELECT item.id,item.quantity::text,item.unit,round(item.preis_netto*100)::text AS unit_cents,
 EXISTS(SELECT 1 FROM private.order_production_snapshots positive WHERE positive.tenant_id=item.tenant_id AND positive.valuation='captured' AND positive.item_id=item.id AND positive.direction=1 AND positive.component='base' AND (positive.event_id=${eventId} OR (SELECT created_at FROM public.events WHERE id=positive.event_id)<=(SELECT created_at FROM public.events WHERE id=${eventId}) AND NOT EXISTS(SELECT 1 FROM private.order_production_snapshots negative WHERE negative.reverses_event_id=positive.event_id AND negative.item_id=positive.item_id AND negative.component='base' AND (SELECT created_at FROM public.events WHERE id=negative.event_id)<=(SELECT created_at FROM public.events WHERE id=${eventId})))) AS active
 FROM public.items item WHERE item.tenant_id=${tenantId} AND item.order_id=${orderId} AND item.id=ANY(ARRAY[${sql.join(itemIds.map(id=>sql`${id}`),sql`, `)}]::text[]) ORDER BY item.id`);
 if(rows.length!==new Set(itemIds).size)throw Error('PRODUCTION_ITEM_SOURCE_MISSING');
 for(const item of rows){
  // Gesamt-Freeze must not count a position already captured by Teil-fertig.
  if(item.active)continue;
  const priced=quote?.positions.find(position=>position.itemId===item.id);
  if(quote&&!priced)throw Error('PRODUCTION_QUOTE_ITEM_MISSING');
  const historical=occurrence.offline&&!rework?await historicalProductionEvidence(tx,tenantId,orderId,item.id,occurrence.at,item.quantity,Boolean(quote)):null;
  const net=occurrence.offline&&!rework&&!historical?sql`NULL::bigint`:rework?sql`0::bigint`:priced?sql`round(${priced.lineTotalCents}::numeric*${item.quantity}::numeric/${priced.quantity}::numeric)::bigint`:sql`round(${occurrence.offline?historical?.unitPriceCents??null:item.unit_cents}::numeric*${item.quantity}::numeric)::bigint`;
  const source={...(historical?{historicalPriceEventId:historical.historicalPriceEventId,historicalQuantityEventId:historical.historicalQuantityEventId}:{}),...(occurrence.offline&&!rework&&!historical?{offlineUnvalued:true}:{}),...(rework?{kind:'rework',complaintId:origin.nacharbeit_zu}:quote?{kind:'quote',quoteId:quote.quoteId,edition:quote.edition,position:priced!.position}:{kind:'item',itemId:item.id})};
  const saved=await tx.execute<{event_id:string;item_id:string}>(sql`INSERT INTO private.order_production_snapshots(event_id,tenant_id,order_id,item_id,occurred_at,direction,quantity,unit,net_cents,rework,valuation,price_source)
   SELECT event.id,event.tenant_id,event.order_id,${item.id},private.order_production_time_v1(event),1,${item.quantity}::numeric,${item.unit},${net}::bigint,${rework},'captured',${JSON.stringify(source)}::jsonb FROM public.events event WHERE event.tenant_id=${tenantId} AND event.order_id=${orderId} AND event.id=${eventId} RETURNING event_id,item_id`);
  if(saved.length!==1||saved[0].event_id!==eventId||saved[0].item_id!==item.id)throw Error('PRODUCTION_COMPLETION_NOT_SAVED');
  if(occurrence.offline&&!rework)await withTenantSavepoint(tx,nested=>appendHistoricalOfflinePricing(nested,tenantId,orderId,eventId,item.id,item.quantity,item.unit,occurrence.at,quote));
 }
}

/** PL12:01: supplement only from real recorded prices, in those actual
 * receipts' weeks; never manufacture a pricing event at reconciliation time. */
async function appendHistoricalOfflinePricing(tx:PrivilegedTenantTransaction,tenantId:string,orderId:string,baseEventId:string,itemId:string,quantity:string,unit:string|null,at:string,quote:OrderCommercialQuote|null){
 const rows=await tx.execute<{id:string;cents:string|null;occurredAt:string}>(sql`WITH prices AS (
  SELECT event.id,event.created_at,item.value->>'unitPriceCents' AS cents FROM private.order_intake_receipts receipt JOIN public.events event ON event.id=receipt.event_id AND event.tenant_id=receipt.tenant_id AND event.order_id=receipt.order_id CROSS JOIN LATERAL jsonb_array_elements(receipt.items_snapshot) item(value)
  WHERE NOT ${Boolean(quote)} AND receipt.tenant_id=${tenantId} AND receipt.order_id=${orderId} AND item.value->>'id'=${itemId} AND event.status='success' AND event.event_type='ORDER_INTAKE_CREATED_V1'
  UNION ALL
  SELECT event.id,event.created_at,item.value->>'unitPriceCents' FROM public.events event CROSS JOIN LATERAL jsonb_array_elements(event.payload->'items') item(value)
  WHERE NOT ${Boolean(quote)} AND event.tenant_id=${tenantId} AND event.order_id=${orderId} AND event.status='success' AND event.event_type='ORDER_CONTENT_CHANGED_V1' AND item.value->>'id'=${itemId}
  UNION ALL
  SELECT event.id,event.created_at,item.value->>'unitPriceCents' FROM public.events event CROSS JOIN LATERAL jsonb_array_elements(event.payload->'prices') item(value)
  WHERE NOT ${Boolean(quote)} AND event.tenant_id=${tenantId} AND event.order_id=${orderId} AND event.status='success' AND event.event_type='ORDER_INVOICE_PRICES_SET_V1' AND item.value->>'itemId'=${itemId}
  UNION ALL
  SELECT event.id,event.created_at,NULL::text FROM private.quote_conversion_receipts receipt JOIN public.events event ON event.id=receipt.event_id AND event.tenant_id=receipt.tenant_id
  WHERE ${Boolean(quote)} AND receipt.tenant_id=${tenantId} AND receipt.order_id=${orderId} AND event.status='success' AND event.event_type='QUOTE_AWARDED_V1'
 ) SELECT price.id,price.cents,to_char(price.created_at,'YYYY-MM-DD"T"HH24:MI:SS.US"Z"') AS "occurredAt" FROM prices price JOIN public.events booked ON booked.tenant_id=${tenantId} AND booked.order_id=${orderId} AND booked.id=${baseEventId}
 WHERE price.created_at>${at}::timestamptz AT TIME ZONE 'UTC' AND price.created_at<=booked.created_at
 AND NOT EXISTS(SELECT 1 FROM private.order_production_snapshots existing WHERE existing.tenant_id=${tenantId} AND existing.origin_event_id=${baseEventId} AND existing.item_id=${itemId} AND existing.event_id=price.id AND existing.component='pricing') ORDER BY price.created_at,price.id`);
 const priced=quote?.positions.find(position=>position.itemId===itemId);if(quote&&!priced)throw Error('OFFLINE_SUPPLEMENT_QUOTE_ITEM_MISSING');
 for(const row of rows){
  if(!priced&&row.cents===null)continue;
  const amount=priced?sql`round(${priced.lineTotalCents}::numeric*${quantity}::numeric/${priced.quantity}::numeric)::bigint`:sql`round(${row.cents}::numeric*${quantity}::numeric)::bigint`;
  const [change]=await tx.execute<{delta:string}>(sql`SELECT ((${amount})-coalesce((SELECT net_cents FROM private.order_production_snapshots WHERE tenant_id=${tenantId} AND event_id=${baseEventId} AND item_id=${itemId} AND component='base' AND direction=1),0)-coalesce((SELECT sum(net_cents) FROM private.order_production_snapshots WHERE tenant_id=${tenantId} AND origin_event_id=${baseEventId} AND item_id=${itemId} AND component='pricing' AND direction=1),0))::text AS delta`);
  if(!change||!Number.isSafeInteger(Number(change.delta)))throw Error('OFFLINE_SUPPLEMENT_DELTA_INVALID');
  try{
  const saved=await tx.execute<{event_id:string}>(sql`INSERT INTO private.order_production_snapshots(event_id,tenant_id,order_id,item_id,occurred_at,direction,quantity,unit,net_cents,rework,valuation,price_source,component,origin_event_id)
   SELECT event.id,${tenantId},${orderId},${itemId},event.created_at,1,${quantity}::numeric,${unit},${change.delta}::bigint,false,'captured',jsonb_build_object('kind','offline_price_receipt','pricingEventId',event.id),'pricing',${baseEventId}
   FROM public.events event WHERE event.tenant_id=${tenantId} AND event.id=${row.id} RETURNING event_id`);
  if(saved.length!==1||saved[0].event_id!==row.id)throw Error('OFFLINE_SUPPLEMENT_NOT_SAVED');
  }catch(error){throw new ProductionPricingRetryNeeded({orderId,productionEventId:baseEventId,itemId,pricingEventId:row.id,pricingOccurredAt:row.occurredAt},error);}

 }
}

export type ProductionPricingFailure=ProductionPricingRetryNeeded['source'];
function pricingRetryKey(tenant:string,source:ProductionPricingFailure){const b=createHash('sha256').update(JSON.stringify(['production-pricing-retry',tenant,source.productionEventId,source.itemId,source.pricingEventId])).digest().subarray(0,16);b[6]=(b[6]&15)|80;b[8]=(b[8]&63)|128;const h=b.toString('hex');return `${h.slice(0,8)}-${h.slice(8,12)}-${h.slice(12,16)}-${h.slice(16,20)}-${h.slice(20)}`;}
/** The marker is provenance in the existing event store, not a second task. */
export async function recordProductionPricingRetry(tx:PrivilegedTenantTransaction,auth:AuthorizationSnapshot,source:ProductionPricingFailure){
 const id=pricingRetryKey(auth.tenantId,source);
 const existing=await tx.execute<{id:string}>(sql`SELECT id FROM public.events WHERE tenant_id=${auth.tenantId} AND id=${id}`);
 if(!existing.length){
  const inserted=await tx.execute<{id:string}>(sql`INSERT INTO public.events(id,tenant_id,order_id,item_id,event_type,description,payload,status,user_id,client_event_id,event_schema_version)
   VALUES(${id},${auth.tenantId},${source.orderId},${source.itemId},'ORDER_PRODUCTION_PRICING_RETRY_REQUIRED_V1','ORDER_PRODUCTION_PRICING_RETRY_REQUIRED_V1',${JSON.stringify(source)}::jsonb,'success',${auth.userId}::uuid,${id}::uuid,1) RETURNING id`);
  if(inserted.length!==1)throw Error('PRODUCTION_PRICING_MARKER_NOT_SAVED');
 }
 const proof=await readProductionPricingRetrySource(tx,auth,id);
 if(!proof||proof.actorId!==auth.userId||proof.pricingEventId!==source.pricingEventId||proof.pricingOccurredAt!==source.pricingOccurredAt)throw Error('PRODUCTION_PRICING_MARKER_SOURCE_INVALID');
 return id;
}
export async function readProductionPricingRetrySource(tx:PrivilegedTenantTransaction,auth:AuthorizationSnapshot,id:string){
 const markers=await tx.execute<{id:string;actorId:string;orderId:string;itemId:string;payload:ProductionPricingFailure}>(sql`SELECT id,user_id::text AS "actorId",order_id AS "orderId",item_id AS "itemId",payload FROM public.events WHERE tenant_id=${auth.tenantId} AND id=${id} AND event_type='ORDER_PRODUCTION_PRICING_RETRY_REQUIRED_V1' AND status='success' AND event_schema_version=1`);
 if(!markers.length)return null;
 const m=markers[0];if(markers.length!==1||pricingRetryKey(auth.tenantId,m.payload)!==id||m.orderId!==m.payload.orderId||m.itemId!==m.payload.itemId)throw Error('PRODUCTION_PRICING_MARKER_CHANGED');
 const rows=await tx.execute<{part:string;day:string;pending:boolean;proof:boolean}>(sql`SELECT item.name AS part,to_char(price.created_at AT TIME ZONE 'UTC' AT TIME ZONE 'Europe/Berlin','DD.MM.YYYY') AS day,
 NOT EXISTS(SELECT 1 FROM private.order_production_snapshots posted WHERE posted.tenant_id=base.tenant_id AND posted.origin_event_id=base.event_id AND posted.item_id=base.item_id AND posted.component='pricing' AND posted.direction=1 AND posted.event_id=price.id)
 AND NOT EXISTS(SELECT 1 FROM private.order_production_snapshots reversed WHERE reversed.tenant_id=base.tenant_id AND reversed.reverses_event_id=base.event_id AND reversed.item_id=base.item_id AND reversed.component='base') AS pending,
 original.user_id::text=${m.actorId} AND original.status='success' AND original.event_type='ORDER_ITEM_FINISHED_CHANGED_V1' AND original.payload->>'finished'='true'
 AND private.valid_offline_original_event_v1(original.payload->'offlineOriginal',original.user_id,original.client_event_id)
 AND to_char(price.created_at,'YYYY-MM-DD"T"HH24:MI:SS.US"Z"')=${m.payload.pricingOccurredAt}
 AND (private.offline_production_supplement_v1(price,jsonb_populate_record(NULL::private.order_production_snapshots,to_jsonb(base)||jsonb_build_object('component','pricing','origin_event_id',base.event_id,'direction',1)))
 OR EXISTS(SELECT 1 FROM private.order_production_snapshots reversed WHERE reversed.tenant_id=base.tenant_id AND reversed.reverses_event_id=base.event_id AND reversed.item_id=base.item_id AND reversed.component='base')) AS proof
 FROM private.order_production_snapshots base JOIN public.events original ON original.tenant_id=base.tenant_id AND original.id=base.event_id AND original.order_id=base.order_id
 JOIN public.events price ON price.tenant_id=base.tenant_id AND price.id=${m.payload.pricingEventId}
 JOIN public.items item ON item.tenant_id=base.tenant_id AND item.order_id=base.order_id AND item.id=base.item_id
 WHERE base.tenant_id=${auth.tenantId} AND base.order_id=${m.orderId} AND base.item_id=${m.itemId} AND base.event_id=${m.payload.productionEventId} AND base.component='base' AND base.direction=1 AND base.valuation='captured'`);
 if(rows.length!==1||rows[0].proof!==true||!rows[0].part||!rows[0].day)throw Error('PRODUCTION_PRICING_RECEIPT_INVALID');
 return {...m.payload,markerId:id,actorId:m.actorId,pending:rows[0].pending,title:PRODUCTION_PRICING_RETRY_COPY.title(rows[0].part,rows[0].day)};
}
/** Existing event reader supplies source keys; the TaskWriter owns only tasks. */
export async function readProductionPricingRetryKeys(tx:PrivilegedTenantTransaction,auth:AuthorizationSnapshot,eventId:string){
 const rows=await tx.execute<{id:string}>(sql`SELECT id FROM public.events WHERE tenant_id=${auth.tenantId} AND event_type='ORDER_PRODUCTION_PRICING_RETRY_REQUIRED_V1' AND payload->>'productionEventId'=${eventId}`);
 return rows.map(row=>row.id);
}
/** Uses the original base quantity and original time, never today's completion. */
export async function repairProductionCompletionPricing(tx:PrivilegedTenantTransaction,auth:AuthorizationSnapshot,orderId:string,eventId:string){
 await tx.execute(sql`SELECT id FROM public.orders WHERE tenant_id=${auth.tenantId} AND id=${orderId} FOR UPDATE NOWAIT`);
 const bases=await tx.execute<{itemId:string;quantity:string;unit:string|null;at:string;hasQuote:boolean}>(sql`SELECT base.item_id AS "itemId",base.quantity::text,base.unit,to_char(base.occurred_at,'YYYY-MM-DD"T"HH24:MI:SS.US"Z"') AS at,
 EXISTS(SELECT 1 FROM private.quote_conversion_receipts receipt WHERE receipt.tenant_id=base.tenant_id AND receipt.order_id=base.order_id) AS "hasQuote"
 FROM private.order_production_snapshots base JOIN public.events original ON original.tenant_id=base.tenant_id AND original.id=base.event_id AND original.order_id=base.order_id
 WHERE base.tenant_id=${auth.tenantId} AND base.order_id=${orderId} AND base.event_id=${eventId} AND base.component='base' AND base.direction=1 AND NOT base.rework AND base.valuation='captured'
 AND original.event_type='ORDER_ITEM_FINISHED_CHANGED_V1' AND original.payload->>'finished'='true' AND private.valid_offline_original_event_v1(original.payload->'offlineOriginal',original.user_id,original.client_event_id)
 AND NOT EXISTS(SELECT 1 FROM private.order_production_snapshots reversed WHERE reversed.tenant_id=base.tenant_id AND reversed.item_id=base.item_id AND reversed.reverses_event_id=base.event_id AND reversed.component='base')`);
 for(const base of bases){const quote=base.hasQuote?await readOrderCommercialQuote(tx,auth.tenantId,orderId):null;await withTenantSavepoint(tx,nested=>appendHistoricalOfflinePricing(nested,auth.tenantId,orderId,eventId,base.itemId,base.quantity,base.unit,base.at,quote));}
}
/** Called only after the normal TaskWriter has checked completion authority. */
export async function repairProductionPricingTask(tx:PrivilegedTenantTransaction,auth:AuthorizationSnapshot,task:{client_key:string;bezug_typ:string;bezug_id:string|null;erstellt_von:string}){
 const source=await readProductionPricingRetrySource(tx,auth,task.client_key);if(!source)return;
 if(task.bezug_typ!=='auftrag'||task.bezug_id!==source.orderId||task.erstellt_von!==source.actorId)throw Error('PRODUCTION_PRICING_TASK_SOURCE_CHANGED');
 if(source.pending)await repairProductionCompletionPricing(tx,auth,source.orderId,source.productionEventId);
 const proof=await readProductionPricingRetrySource(tx,auth,source.markerId);if(!proof||proof.pending)throw Error('PRODUCTION_PRICING_REPAIR_NOT_PROVEN');
}

/** A later price is a new fact at the pricing event, never an update/backdate. */
export async function appendProductionPricing(tx:PrivilegedTenantTransaction,tenantId:string,orderId:string,eventId:string){
 const origins=await tx.execute<{has_quote:boolean}>(sql`SELECT EXISTS(SELECT 1 FROM private.quote_conversion_receipts receipt WHERE receipt.tenant_id=orders.tenant_id AND receipt.order_id=orders.id) AS has_quote FROM public.orders WHERE tenant_id=${tenantId} AND id=${orderId}`);
 if(origins.length!==1)throw Error('PRODUCTION_PRICING_ORDER_MISSING');
 const quote=origins[0].has_quote?await readOrderCommercialQuote(tx,tenantId,orderId):null;
 const rows=await tx.execute<{event_id:string;item_id:string;quantity:string;net_cents:string|null;previous_net:string|null}>(sql`SELECT base.event_id,base.item_id,base.quantity::text,
 CASE WHEN base.net_cents IS NULL AND pricing.total IS NULL THEN NULL ELSE coalesce(base.net_cents,0)+coalesce(pricing.total,0) END::text AS previous_net,
 round(round(item.preis_netto*100)::bigint*base.quantity)::text AS net_cents
 FROM private.order_production_snapshots base JOIN public.items item ON item.tenant_id=base.tenant_id AND item.order_id=base.order_id AND item.id=base.item_id
 LEFT JOIN LATERAL (SELECT sum(p.net_cents)::bigint AS total FROM private.order_production_snapshots p
  WHERE p.tenant_id=base.tenant_id AND p.item_id=base.item_id AND p.origin_event_id=base.event_id AND p.component='pricing' AND p.direction=1) pricing ON true
 WHERE base.tenant_id=${tenantId} AND base.valuation='captured' AND base.order_id=${orderId} AND base.component='base' AND base.direction=1 AND NOT base.rework
 AND NOT EXISTS(SELECT 1 FROM private.order_production_snapshots other WHERE other.tenant_id=base.tenant_id AND other.item_id=base.item_id AND other.reverses_event_id=base.event_id AND other.component='base') ORDER BY base.item_id`);
 for(const row of rows){
  const priced=quote?.positions.find(position=>position.itemId===row.item_id);
  if(quote&&!priced)throw Error('PRODUCTION_PRICING_QUOTE_ITEM_MISSING');
  if(!priced&&row.net_cents===null)continue;
  const amount=priced?sql`round(${priced.lineTotalCents}::numeric*${row.quantity}::numeric/${priced.quantity}::numeric)::bigint`:sql`${row.net_cents}::bigint`;
  const [change]=await tx.execute<{delta:string}>(sql`SELECT ((${amount})-coalesce(${row.previous_net}::bigint,0))::text AS delta`);
  if(!change||!Number.isSafeInteger(Number(change.delta)))throw Error('PRODUCTION_PRICING_DELTA_INVALID');
  if(row.previous_net!==null&&Number(change.delta)===0)continue;
  const saved=await tx.execute<{event_id:string}>(sql`INSERT INTO private.order_production_snapshots(event_id,tenant_id,order_id,item_id,occurred_at,direction,quantity,unit,net_cents,rework,valuation,price_source,component,origin_event_id)
   SELECT event.id,base.tenant_id,base.order_id,base.item_id,event.created_at,1,base.quantity,base.unit,${change.delta}::bigint,base.rework,'captured',${JSON.stringify(quote?{kind:'quote',quoteId:quote.quoteId,edition:quote.edition}:{kind:'item',pricingEventId:eventId})}::jsonb,'pricing',base.event_id
   FROM private.order_production_snapshots base JOIN public.events event ON event.tenant_id=base.tenant_id AND event.order_id=base.order_id AND event.id=${eventId}
   WHERE base.tenant_id=${tenantId} AND base.event_id=${row.event_id} AND base.item_id=${row.item_id} AND base.component='base' RETURNING event_id`);
  if(saved.length!==1||saved[0].event_id!==eventId)throw Error('PRODUCTION_PRICING_NOT_SAVED');
 }
}

/** The amount is read ONLY from the line written by this actual freeze. */
export async function appendFrozenProductionExtraWork(tx:PrivilegedTenantTransaction,tenantId:string,orderId:string,eventId:string){
 const rows=await tx.execute<{item_id:string;origin_event_id:string;net_cents:string}>(sql`SELECT line.item_id,base.event_id AS origin_event_id,(CASE WHEN base.rework THEN 0 ELSE sum(line.amount_cents) END)::text AS net_cents
 FROM private.order_frozen_extra_work_lines line JOIN private.order_freezes frozen ON frozen.id=line.freeze_id AND frozen.tenant_id=line.tenant_id
 JOIN private.order_production_snapshots base ON base.tenant_id=line.tenant_id AND base.order_id=line.order_id AND base.item_id=line.item_id AND base.direction=1 AND base.component='base'
 WHERE base.valuation='captured' AND frozen.event_id=${eventId} AND line.tenant_id=${tenantId} AND line.order_id=${orderId}
 AND (SELECT created_at FROM public.events WHERE id=base.event_id)<=(SELECT created_at FROM public.events WHERE id=${eventId})
 AND NOT EXISTS(SELECT 1 FROM private.order_production_snapshots existing WHERE existing.event_id=${eventId} AND existing.item_id=base.item_id AND existing.component='extra')
 AND NOT EXISTS(SELECT 1 FROM private.order_production_snapshots negative WHERE negative.reverses_event_id=base.event_id AND negative.item_id=base.item_id AND negative.component='base' AND (SELECT created_at FROM public.events WHERE id=negative.event_id)<=(SELECT created_at FROM public.events WHERE id=${eventId})) GROUP BY line.item_id,base.event_id,base.rework`);
 for(const row of rows){
  const saved=await tx.execute<{event_id:string}>(sql`INSERT INTO private.order_production_snapshots(event_id,tenant_id,order_id,item_id,occurred_at,direction,quantity,unit,net_cents,rework,valuation,price_source,component,origin_event_id)
   SELECT event.id,base.tenant_id,base.order_id,base.item_id,event.created_at,1,base.quantity,base.unit,${row.net_cents}::bigint,base.rework,'captured',jsonb_build_object('kind','frozen_extra','freezeEventId',event.id),'extra',base.event_id
   FROM private.order_production_snapshots base JOIN public.events event ON event.tenant_id=base.tenant_id AND event.order_id=base.order_id AND event.id=${eventId}
   WHERE base.event_id=${row.origin_event_id} AND base.item_id=${row.item_id} AND base.component='base' AND base.tenant_id=${tenantId} RETURNING event_id`);
  if(saved.length!==1||saved[0].event_id!==eventId)throw Error('PRODUCTION_EXTRA_NOT_SAVED');
 }
}

/** Reverse stored completion facts in the existing command transaction.
 * This never recalculates a historical quantity or amount from today's items.
 * Only captured facts participate; pre-adoption events are never reconstructed. */
export async function appendProductionReversals(tx:PrivilegedTenantTransaction,tenantId:string,eventId:string,itemIds:readonly string[]){
 if(!itemIds.length)return;
 const originals=await tx.execute<{event_id:string;item_id:string;component:string}>(sql`SELECT positive.event_id,positive.item_id,positive.component FROM private.order_production_snapshots positive
  WHERE positive.tenant_id=${tenantId} AND positive.valuation='captured' AND positive.direction=1 AND (SELECT created_at FROM public.events WHERE id=positive.event_id)<=(SELECT created_at FROM public.events WHERE id=${eventId}) AND positive.item_id=ANY(ARRAY[${sql.join(itemIds.map(id=>sql`${id}`),sql`, `)}]::text[])
   AND NOT EXISTS(SELECT 1 FROM private.order_production_snapshots negative WHERE negative.tenant_id=positive.tenant_id AND negative.reverses_event_id=positive.event_id AND negative.item_id=positive.item_id AND negative.component=positive.component) ORDER BY positive.item_id,positive.component FOR SHARE OF positive`);
 for(const original of originals){
  const saved=await tx.execute<{event_id:string;item_id:string}>(sql`INSERT INTO private.order_production_snapshots(event_id,tenant_id,order_id,item_id,occurred_at,direction,quantity,unit,net_cents,rework,valuation,price_source,reverses_event_id,component,origin_event_id)
   SELECT event.id,positive.tenant_id,positive.order_id,positive.item_id,event.created_at,-1,positive.quantity,positive.unit,positive.net_cents,positive.rework,positive.valuation,positive.price_source,positive.event_id,positive.component,positive.origin_event_id
   FROM private.order_production_snapshots positive JOIN public.events event ON event.tenant_id=positive.tenant_id AND event.order_id=positive.order_id AND event.id=${eventId}
   WHERE positive.tenant_id=${tenantId} AND positive.event_id=${original.event_id} AND positive.item_id=${original.item_id} AND positive.component=${original.component} RETURNING event_id,item_id`);
  if(saved.length!==1||saved[0].event_id!==eventId||saved[0].item_id!==original.item_id)throw Error('PRODUCTION_REVERSAL_NOT_SAVED');
 }
}
