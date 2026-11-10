import 'server-only';
import {sql} from 'drizzle-orm';
import type {PrivilegedTenantTransaction} from './privilegedDb';
import {readOrderCommercialQuote} from './orderQuoteReadPort';
import type {AuthorizationSnapshot} from './authorization';
import {withPrivilegedTenantTransaction} from './privilegedDb';
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

/** Capture the base position price at the existing completion edge. Extra work
 * belongs to its frozen receipt, never to the current hourly rate here. */
export async function appendProductionCompletion(tx:PrivilegedTenantTransaction,tenantId:string,orderId:string,eventId:string,itemIds:readonly string[]){
 if(!itemIds.length)return;
 const origins=await tx.execute<{source:string|null;nacharbeit_zu:string|null;has_quote:boolean}>(sql`SELECT source,nacharbeit_zu,EXISTS(SELECT 1 FROM private.quote_conversion_receipts receipt WHERE receipt.tenant_id=orders.tenant_id AND receipt.order_id=orders.id) AS has_quote FROM public.orders WHERE tenant_id=${tenantId} AND id=${orderId}`);
 if(origins.length!==1)throw Error('PRODUCTION_ORDER_SOURCE_MISSING');
 const origin=origins[0],rework=origin.source==='REKLAMATION_NACHARBEIT';
 if(rework&&!origin.nacharbeit_zu)throw Error('PRODUCTION_REWORK_SOURCE_MISSING');
 const quote=!rework&&origin.has_quote?await readOrderCommercialQuote(tx,tenantId,orderId):null;
 const rows=await tx.execute<{id:string;quantity:string;unit:string|null;net_cents:string|null;active:boolean}>(sql`SELECT item.id,item.quantity::text,item.unit,round(round(item.preis_netto*100)::bigint*item.quantity)::text AS net_cents,
 EXISTS(SELECT 1 FROM private.order_production_snapshots positive WHERE positive.tenant_id=item.tenant_id AND positive.valuation='captured' AND positive.item_id=item.id AND positive.direction=1 AND positive.component='base' AND (positive.event_id=${eventId} OR positive.occurred_at<=(SELECT created_at FROM public.events WHERE id=${eventId}) AND NOT EXISTS(SELECT 1 FROM private.order_production_snapshots negative WHERE negative.reverses_event_id=positive.event_id AND negative.item_id=positive.item_id AND negative.component='base' AND negative.occurred_at<=(SELECT created_at FROM public.events WHERE id=${eventId})))) AS active
 FROM public.items item WHERE item.tenant_id=${tenantId} AND item.order_id=${orderId} AND item.id=ANY(ARRAY[${sql.join(itemIds.map(id=>sql`${id}`),sql`, `)}]::text[]) ORDER BY item.id`);
 if(rows.length!==new Set(itemIds).size)throw Error('PRODUCTION_ITEM_SOURCE_MISSING');
 for(const item of rows){
  // Gesamt-Freeze must not count a position already captured by Teil-fertig.
  if(item.active)continue;
  const priced=quote?.positions.find(position=>position.itemId===item.id);
  if(quote&&!priced)throw Error('PRODUCTION_QUOTE_ITEM_MISSING');
  const net=rework?sql`0::bigint`:priced?sql`round(${priced.lineTotalCents}::numeric*${item.quantity}::numeric/${priced.quantity}::numeric)::bigint`:sql`${item.net_cents}::bigint`;
  const source={...(rework?{kind:'rework',complaintId:origin.nacharbeit_zu}:quote?{kind:'quote',quoteId:quote.quoteId,edition:quote.edition,position:priced!.position}:{kind:'item',itemId:item.id})};
  const saved=await tx.execute<{event_id:string;item_id:string}>(sql`INSERT INTO private.order_production_snapshots(event_id,tenant_id,order_id,item_id,occurred_at,direction,quantity,unit,net_cents,rework,valuation,price_source)
   SELECT event.id,event.tenant_id,event.order_id,${item.id},event.created_at,1,${item.quantity}::numeric,${item.unit},${net}::bigint,${rework},'captured',${JSON.stringify(source)}::jsonb FROM public.events event WHERE event.tenant_id=${tenantId} AND event.order_id=${orderId} AND event.id=${eventId} RETURNING event_id,item_id`);
  if(saved.length!==1||saved[0].event_id!==eventId||saved[0].item_id!==item.id)throw Error('PRODUCTION_COMPLETION_NOT_SAVED');
 }
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
 AND base.occurred_at<=(SELECT created_at FROM public.events WHERE id=${eventId})
 AND NOT EXISTS(SELECT 1 FROM private.order_production_snapshots existing WHERE existing.event_id=${eventId} AND existing.item_id=base.item_id AND existing.component='extra')
 AND NOT EXISTS(SELECT 1 FROM private.order_production_snapshots negative WHERE negative.reverses_event_id=base.event_id AND negative.item_id=base.item_id AND negative.component='base' AND negative.occurred_at<=(SELECT created_at FROM public.events WHERE id=${eventId})) GROUP BY line.item_id,base.event_id,base.rework`);
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
  WHERE positive.tenant_id=${tenantId} AND positive.valuation='captured' AND positive.direction=1 AND positive.occurred_at<=(SELECT created_at FROM public.events WHERE id=${eventId}) AND positive.item_id=ANY(ARRAY[${sql.join(itemIds.map(id=>sql`${id}`),sql`, `)}]::text[])
   AND NOT EXISTS(SELECT 1 FROM private.order_production_snapshots negative WHERE negative.tenant_id=positive.tenant_id AND negative.reverses_event_id=positive.event_id AND negative.item_id=positive.item_id AND negative.component=positive.component) ORDER BY positive.item_id,positive.component FOR SHARE OF positive`);
 for(const original of originals){
  const saved=await tx.execute<{event_id:string;item_id:string}>(sql`INSERT INTO private.order_production_snapshots(event_id,tenant_id,order_id,item_id,occurred_at,direction,quantity,unit,net_cents,rework,valuation,price_source,reverses_event_id,component,origin_event_id)
   SELECT event.id,positive.tenant_id,positive.order_id,positive.item_id,event.created_at,-1,positive.quantity,positive.unit,positive.net_cents,positive.rework,positive.valuation,positive.price_source,positive.event_id,positive.component,positive.origin_event_id
   FROM private.order_production_snapshots positive JOIN public.events event ON event.tenant_id=positive.tenant_id AND event.order_id=positive.order_id AND event.id=${eventId}
   WHERE positive.tenant_id=${tenantId} AND positive.event_id=${original.event_id} AND positive.item_id=${original.item_id} AND positive.component=${original.component} RETURNING event_id,item_id`);
  if(saved.length!==1||saved[0].event_id!==eventId||saved[0].item_id!==original.item_id)throw Error('PRODUCTION_REVERSAL_NOT_SAVED');
 }
}
