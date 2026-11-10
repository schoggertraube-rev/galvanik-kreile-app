import 'server-only';
import {sql} from 'drizzle-orm';
import type {PrivilegedTenantTransaction} from './privilegedDb';
import {readOrderCommercialQuote} from './orderQuoteReadPort';

/** Capture the base position price at the existing completion edge. Extra work
 * belongs to its frozen receipt, never to the current hourly rate here. */
export async function appendProductionCompletion(tx:PrivilegedTenantTransaction,tenantId:string,orderId:string,eventId:string,itemIds:readonly string[]){
 if(!itemIds.length)return;
 const origins=await tx.execute<{source:string|null;nacharbeit_zu:string|null;has_quote:boolean}>(sql`SELECT source,nacharbeit_zu,EXISTS(SELECT 1 FROM private.quote_conversion_receipts receipt WHERE receipt.tenant_id=orders.tenant_id AND receipt.order_id=orders.id) AS has_quote FROM public.orders WHERE tenant_id=${tenantId} AND id=${orderId}`);
 if(origins.length!==1)throw Error('PRODUCTION_ORDER_SOURCE_MISSING');
 const origin=origins[0],rework=origin.source==='REKLAMATION_NACHARBEIT';
 if(rework&&!origin.nacharbeit_zu)throw Error('PRODUCTION_REWORK_SOURCE_MISSING');
 const quote=!rework&&origin.has_quote?await readOrderCommercialQuote(tx,tenantId,orderId):null;
 const rows=await tx.execute<{id:string;quantity:string;unit:string|null;net_cents:string|null;active:boolean}>(sql`SELECT item.id,item.quantity::text,item.unit,(round(item.preis_netto*100)::bigint*item.quantity)::text AS net_cents,
 EXISTS(SELECT 1 FROM private.order_production_snapshots positive WHERE positive.tenant_id=item.tenant_id AND positive.item_id=item.id AND positive.direction=1 AND NOT EXISTS(SELECT 1 FROM private.order_production_snapshots negative WHERE negative.reverses_event_id=positive.event_id AND negative.item_id=positive.item_id)) AS active
 FROM public.items item WHERE item.tenant_id=${tenantId} AND item.order_id=${orderId} AND item.id=ANY(ARRAY[${sql.join(itemIds.map(id=>sql`${id}`),sql`, `)}]::text[]) ORDER BY item.id`);
 if(rows.length!==new Set(itemIds).size)throw Error('PRODUCTION_ITEM_SOURCE_MISSING');
 for(const item of rows){
  // Gesamt-Freeze must not count a position already captured by Teil-fertig.
  if(item.active)continue;
  const priced=quote?.positions.find(position=>position.itemId===item.id);
  if(quote&&!priced)throw Error('PRODUCTION_QUOTE_ITEM_MISSING');
  const net=rework?0:priced?.lineTotalCents??(item.net_cents===null?null:Number(item.net_cents));
  if(net!==null&&(!Number.isSafeInteger(net)||net<0))throw Error('PRODUCTION_AMOUNT_INVALID');
  const source=rework?{kind:'rework',sourceOrderId:origin.nacharbeit_zu}:quote?{kind:'quote',quoteId:quote.quoteId,edition:quote.edition,position:priced!.position}:{kind:'item',itemId:item.id};
  const saved=await tx.execute<{event_id:string;item_id:string}>(sql`INSERT INTO private.order_production_snapshots(event_id,tenant_id,order_id,item_id,occurred_at,direction,quantity,unit,net_cents,rework,valuation,price_source)
   SELECT event.id,event.tenant_id,event.order_id,${item.id},event.created_at,1,${item.quantity}::numeric,${item.unit},${net}::bigint,${rework},'captured',${JSON.stringify(source)}::jsonb FROM public.events event WHERE event.tenant_id=${tenantId} AND event.order_id=${orderId} AND event.id=${eventId} RETURNING event_id,item_id`);
  if(saved.length!==1||saved[0].event_id!==eventId||saved[0].item_id!==item.id)throw Error('PRODUCTION_COMPLETION_NOT_SAVED');
 }
}

/** Reverse stored completion facts in the existing command transaction.
 * This never recalculates a historical quantity or amount from today's items.
 * Positive capture and historical reconstruction are separate unfinished steps. */
export async function appendProductionReversals(tx:PrivilegedTenantTransaction,tenantId:string,eventId:string,itemIds:readonly string[]){
 if(!itemIds.length)return;
 const originals=await tx.execute<{event_id:string;item_id:string}>(sql`SELECT positive.event_id,positive.item_id FROM private.order_production_snapshots positive
  WHERE positive.tenant_id=${tenantId} AND positive.direction=1 AND positive.item_id=ANY(ARRAY[${sql.join(itemIds.map(id=>sql`${id}`),sql`, `)}]::text[])
   AND NOT EXISTS(SELECT 1 FROM private.order_production_snapshots negative WHERE negative.tenant_id=positive.tenant_id AND negative.reverses_event_id=positive.event_id AND negative.item_id=positive.item_id) ORDER BY positive.item_id FOR SHARE OF positive`);
 for(const original of originals){
  const saved=await tx.execute<{event_id:string;item_id:string}>(sql`INSERT INTO private.order_production_snapshots(event_id,tenant_id,order_id,item_id,occurred_at,direction,quantity,unit,net_cents,rework,valuation,price_source,reverses_event_id)
   SELECT event.id,positive.tenant_id,positive.order_id,positive.item_id,event.created_at,-1,positive.quantity,positive.unit,positive.net_cents,positive.rework,positive.valuation,positive.price_source,positive.event_id
   FROM private.order_production_snapshots positive JOIN public.events event ON event.tenant_id=positive.tenant_id AND event.order_id=positive.order_id AND event.id=${eventId}
   WHERE positive.tenant_id=${tenantId} AND positive.event_id=${original.event_id} AND positive.item_id=${original.item_id} RETURNING event_id,item_id`);
  if(saved.length!==1||saved[0].event_id!==eventId||saved[0].item_id!==original.item_id)throw Error('PRODUCTION_REVERSAL_NOT_SAVED');
 }
}
