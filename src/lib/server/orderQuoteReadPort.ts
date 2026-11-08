import 'server-only';
import {sql} from 'drizzle-orm';
import {scaleQuotePositions} from '@/modules/quotes/public';
import type {QuoteCalculation,QuoteQuantityLine} from '@/modules/quotes/public';
import type {PrivilegedTenantTransaction} from './privilegedDb';

export type OrderCommercialQuote={quoteId:string;quoteNumber:string;edition:number;totalNetCents:number;plannedHours:string|null;specialRequests:string|null;positions:Array<{itemId:string;position:number;name:string;quantity:number;lineTotalCents:number}>};
/** Immutable awarded quote is the sole source of its agreed line totals, never a rounded unit-price copy. */
export async function readOrderCommercialQuote(tx:PrivilegedTenantTransaction,tenantId:string,orderId:string):Promise<OrderCommercialQuote>{
 const rows=await tx.execute<OrderCommercialQuote&{integrity:boolean;sourceCalculation:QuoteCalculation|null;sourcePositions:QuoteQuantityLine[]}>(sql`SELECT quote.id::text AS "quoteId",quote.quote_number AS "quoteNumber",quote.fassung AS edition,sum(round(coalesce(position.zeilen_gesamt_cents,position.line_total_cents)::numeric * (item.value->>'quantity')::numeric / position.quantity))::float8 AS "totalNetCents",quote.sonderwuensche AS "specialRequests",
  CASE WHEN quote.kalk_stunden IS NOT NULL THEN jsonb_build_object('hours',quote.kalk_stunden::text,'hourlyRateCents',quote.stundensatz_cents,'setupCents',quote.ruest_cents,'materialCents',quote.material_cents) ELSE NULL END AS "sourceCalculation",(SELECT jsonb_agg(jsonb_build_object('position',original.position,'quantity',original.quantity,'lineTotalCents',coalesce(original.zeilen_gesamt_cents,original.line_total_cents)) ORDER BY original.position) FROM private.quote_positions original WHERE original.tenant_id=quote.tenant_id AND original.quote_id=quote.id AND original.revision=quote.version) AS "sourcePositions",
  CASE WHEN count(*)=(SELECT count(*) FROM private.quote_positions original WHERE original.tenant_id=quote.tenant_id AND original.quote_id=quote.id AND original.revision=quote.version) AND min((item.value->>'quantity')::numeric/position.quantity)=max((item.value->>'quantity')::numeric/position.quantity) THEN round(quote.kalk_stunden*min((item.value->>'quantity')::numeric/position.quantity),4)::text ELSE NULL END AS "plannedHours",
  jsonb_agg(jsonb_build_object('itemId',item.value->>'id','position',position.position,'name',position.name,'quantity',(item.value->>'quantity')::numeric,'lineTotalCents',round(coalesce(position.zeilen_gesamt_cents,position.line_total_cents)::numeric * (item.value->>'quantity')::numeric / position.quantity)) ORDER BY position.position) AS positions,
  bool_and(position.quantity>0 AND (item.value->>'quantity')::numeric>0 AND trunc((item.value->>'quantity')::numeric)=(item.value->>'quantity')::numeric) AND (SELECT sum(coalesce(original.zeilen_gesamt_cents,original.line_total_cents)) FROM private.quote_positions original WHERE original.tenant_id=quote.tenant_id AND original.quote_id=quote.id AND original.revision=quote.version)=quote.total_net_cents AS integrity
  FROM private.quote_conversion_receipts receipt JOIN private.quotes quote ON quote.tenant_id=receipt.tenant_id AND quote.id=receipt.quote_id AND quote.linked_order_id=receipt.order_id AND quote.version=receipt.quote_version
  JOIN private.order_intake_receipts intake ON intake.tenant_id=receipt.tenant_id AND intake.event_id=receipt.order_intake_event_id AND intake.order_id=receipt.order_id
  CROSS JOIN LATERAL jsonb_array_elements(intake.items_snapshot) WITH ORDINALITY item(value,ordinal)
  JOIN public.goods_receipt goods ON goods.tenant_id=receipt.tenant_id AND goods.kv_id=quote.id AND goods.auftrag_id=receipt.order_id
  CROSS JOIN LATERAL jsonb_array_elements(goods.mengen) received(value)
  JOIN private.quote_positions position ON position.tenant_id=quote.tenant_id AND position.quote_id=quote.id AND position.revision=receipt.quote_version AND position.position=(received.value->>'kv_position')::integer AND received.value->>'teil_id'=item.value->>'id' AND (received.value->>'bestaetigt')::numeric>0
  WHERE receipt.tenant_id=${tenantId} AND receipt.order_id=${orderId} GROUP BY quote.id,quote.quote_number,quote.fassung,quote.total_net_cents,quote.sonderwuensche LIMIT 2`);
 if(rows.length!==1||!rows[0].integrity)throw Error('ORDER_CARD_QUOTE_PRICE_INVALID');
 const {integrity:_integrity,sourceCalculation,sourcePositions,...quote}=rows[0];void _integrity;
 if(!Number.isSafeInteger(quote.totalNetCents)||quote.totalNetCents<0||!Array.isArray(quote.positions)||!quote.positions.length||quote.positions.some(row=>typeof row.itemId!=='string'||!Number.isSafeInteger(row.lineTotalCents)||row.lineTotalCents<0)||quote.positions.reduce((total,row)=>total+row.lineTotalCents,0)!==quote.totalNetCents)throw Error('ORDER_CARD_QUOTE_PRICE_INVALID');
 {
  const scaled=scaleQuotePositions(sourceCalculation,sourcePositions,sourcePositions.map(row=>({position:row.position,quantity:quote.positions.find(received=>received.position===row.position)?.quantity??0})));
  if(scaled.code!=='OK')throw Error('ORDER_CARD_QUOTE_CALCULATION_INVALID');
  quote.totalNetCents=scaled.totalNetCents;quote.positions=quote.positions.map(row=>({...row,lineTotalCents:scaled.positions.find(priced=>priced.position===row.position)!.lineTotalCents}));quote.plannedHours=scaled.calculation?.hours??null;
 }
 return quote;
}
