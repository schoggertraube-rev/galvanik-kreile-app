import 'server-only';
import {sql} from 'drizzle-orm';
import type {PrivilegedTenantTransaction} from './privilegedDb';

export type OrderCommercialQuote={quoteId:string;quoteNumber:string;edition:number;totalNetCents:number;specialRequests:string|null;positions:Array<{itemId:string;position:number;name:string;quantity:number;lineTotalCents:number}>};
/** Immutable awarded quote is the sole source of its agreed line totals, never a rounded unit-price copy. */
export async function readOrderCommercialQuote(tx:PrivilegedTenantTransaction,tenantId:string,orderId:string):Promise<OrderCommercialQuote>{
 const rows=await tx.execute<OrderCommercialQuote&{integrity:boolean}>(sql`SELECT quote.id::text AS "quoteId",quote.quote_number AS "quoteNumber",quote.fassung AS edition,sum(round(coalesce(position.zeilen_gesamt_cents,position.line_total_cents)::numeric * (item.value->>'quantity')::numeric / position.quantity))::float8 AS "totalNetCents",quote.sonderwuensche AS "specialRequests",
  jsonb_agg(jsonb_build_object('itemId',item.value->>'id','position',position.position,'name',position.name,'quantity',(item.value->>'quantity')::numeric,'lineTotalCents',round(coalesce(position.zeilen_gesamt_cents,position.line_total_cents)::numeric * (item.value->>'quantity')::numeric / position.quantity)) ORDER BY position.position) AS positions,
  bool_and(position.quantity>0 AND (item.value->>'quantity')::numeric>0 AND trunc((item.value->>'quantity')::numeric)=(item.value->>'quantity')::numeric) AND sum(coalesce(position.zeilen_gesamt_cents,position.line_total_cents))=quote.total_net_cents AS integrity
  FROM private.quote_conversion_receipts receipt JOIN private.quotes quote ON quote.tenant_id=receipt.tenant_id AND quote.id=receipt.quote_id AND quote.linked_order_id=receipt.order_id AND quote.version=receipt.quote_version
  JOIN private.order_intake_receipts intake ON intake.tenant_id=receipt.tenant_id AND intake.event_id=receipt.order_intake_event_id AND intake.order_id=receipt.order_id
  CROSS JOIN LATERAL jsonb_array_elements(intake.items_snapshot) WITH ORDINALITY item(value,ordinal)
  JOIN private.quote_positions position ON position.tenant_id=quote.tenant_id AND position.quote_id=quote.id AND position.revision=receipt.quote_version AND position.position=item.ordinal
  WHERE receipt.tenant_id=${tenantId} AND receipt.order_id=${orderId} GROUP BY quote.id,quote.quote_number,quote.fassung,quote.total_net_cents,quote.sonderwuensche LIMIT 2`);
 if(rows.length!==1||!rows[0].integrity)throw Error('ORDER_CARD_QUOTE_PRICE_INVALID');
 const {integrity:_integrity,...quote}=rows[0];void _integrity;
 if(!Number.isSafeInteger(quote.totalNetCents)||quote.totalNetCents<0||!Array.isArray(quote.positions)||!quote.positions.length||quote.positions.some(row=>typeof row.itemId!=='string'||!Number.isSafeInteger(row.lineTotalCents)||row.lineTotalCents<0)||quote.positions.reduce((total,row)=>total+row.lineTotalCents,0)!==quote.totalNetCents)throw Error('ORDER_CARD_QUOTE_PRICE_INVALID');
 return quote;
}
