import 'server-only';
import {sql} from 'drizzle-orm';
import type {PrivilegedTenantTransaction} from './privilegedDb';

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
